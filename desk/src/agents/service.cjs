// Transitional facade: the renderer keeps its IPC names while each engine owns
// its transport. No extra process is created for a Claude conversation.
const {EventEmitter}=require('node:events');
const crypto=require('node:crypto');
const {boundMessages}=require('./conversations.cjs');
const {parseSlashCommand}=require('./opencode-commands.cjs');
const {message: uiMsg}=require('../i18n.mjs');
const capsCore=require('../generated/agentcaps.core.js').default;
const deliveryCore=require('../generated/agentdelivery.core.js').default;
/* Teto do que uma queda dura perde de um turno longo (#116): sem isto, o processo
   morto antes do `turn_end` levava tudo que já estava na tela. */
const PENDING_MESSAGES_FLUSH_MS=8000;
/* Marcas de Parar guardadas para prompts que ainda vão chegar: o renderer tem
   no máximo um envio em preparação, então poucas bastam (review r5-A). */
const MAX_CANCELLED_ATTEMPTS=8;
/* Caps por motor (#57): Claude e OpenCode têm os seus; qualquer outro nome
   (inclusive o histórico Pi) fica com `unknownCaps` (tudo fechado). Com os
   controles lidos do motor, Claude e OpenCode ganham modelo/esforço. */
const STRUCTURAL_CAPS={claude:()=>capsCore.claudeCaps(),opencode:()=>capsCore.opencodeCaps()};
const CONTROL_CAPS={claude:(model,effort)=>capsCore.claudeControlCaps(model,effort),opencode:(model,effort)=>capsCore.opencodeControlCaps(model,effort)};
function capabilities(engine,controls=null){
 const own=(table)=>typeof engine==='string'&&Object.hasOwn(table,engine)?table[engine]:null;
 const controlled=controls?own(CONTROL_CAPS):null;
 const structural=own(STRUCTURAL_CAPS)||(()=>capsCore.unknownCaps());
 const chosen=controlled?controlled(controls.modelSelection===true,controls.effort===true):structural();
 const {$,...caps}=chosen;return caps;
}
function metadata(engine,controls=null){const caps=capabilities(engine,controls);return {engine,caps,capabilities:caps};}
function rendererEvent(e){
 const shared={conversationId:e.conversationId,runId:e.runId};
 switch(e.type){
  case 'turn_start':return {...shared,type:'agent_start'};
  case 'message_start':case 'message_end':return {...shared,type:e.type,message:e.message};
  case 'message_delta':return {...shared,type:'message_update',assistantMessageEvent:{type:e.kind==='thinking'?'thinking_delta':'text_delta',delta:e.delta,...(e.messageId!=null?{messageId:e.messageId}:{}),...(e.contentIndex!=null?{contentIndex:e.contentIndex}:{})}};
  case 'tool_start':return {...shared,type:'tool_execution_start',toolCallId:e.id,toolName:e.name,args:e.args,...(e.pending===true?{pending:true}:{})};
  case 'tool_end':return {...shared,type:'tool_execution_end',toolCallId:e.id,toolName:e.name,result:e.result,isError:e.isError,...(e.details!==undefined?{details:e.details}:{})};
  case 'permission_request':return {...e,...shared,type:'extension_ui_request',permission:true};
  case 'permission_cancelled':return {...shared,type:'agent_request_cancelled',id:e.id};
  case 'turn_end':return {...shared,type:'agent_settled',cancelled:!!e.cancelled,isError:!!e.isError,uncertain:!!e.uncertain};
  case 'warning':return {...shared,type:'desk_warn',message:e.message,code:e.code,...(e.rateLimit?{rateLimit:e.rateLimit}:{}),...(e.detail?{detail:e.detail}:{})};
  case 'error':return {...shared,type:'desk_error',message:e.message,code:e.code,...(typeof e.fatal==='boolean'?{fatal:e.fatal}:{}),...(e.detail?{detail:e.detail}:{})};
  default:return null;
 }
}
/* Serviço de motor nativo (Claude e OpenCode; #57): o MESMO conjunto de tipos
   de request para os dois. O que um motor não tem (steer, comandos, medidor,
   compactação) sai dos caps do núcleo e dos métodos opcionais do adaptador —
   a #58 liga no Claude sem mudar o serviço. As regras de entrega (canBegin,
   canSteer, outcome, mayRetry) são as de `agentdelivery.bend`. */
class NativeService extends EventEmitter{
 /**
  * @param {{adapter: import('./claude-adapter.cjs').ClaudeAdapter|import('./opencode-adapter.cjs').OpenCodeAdapter, engine?: 'claude'|'opencode', onEvent?: (event: object) => void,
  *   onMessages?: (messages: import('../../types/agent').AgentMessage[], meta: {importedPrefixLength: number}) => void,
  *   onInit?: (event: import('../../types/agent').AgentInitEvent) => void, onSelection?: (patch: object) => void,
  *   uncertain?: boolean, messages?: import('../../types/agent').AgentMessage[], importedPrefixLength?: number}} options
  */
 constructor({adapter,engine='claude',onEvent,onMessages,onInit,onSelection,uncertain=false,messages=[],importedPrefixLength=0}){
  super();this.engine=engine;this.uncertain=uncertain===true;this.adapter=adapter;this.messages=messages;this.onMessages=onMessages;this.onSelection=onSelection;
  this.importedPrefixLength=Number.isInteger(importedPrefixLength)?Math.max(0,Math.min(messages.length,importedPrefixLength)):0;
  this._messagesPending=false;this._flushTimer=null;this._flushFailed=false;this._partials=new Map();
  /* Parar pode chegar entre o Enviar e o prompt sair (conexão/controles):
     o pedido fica marcado e o `_prompt` desiste antes do aceite. A marca é do
     ENVIO (attemptId + sequência ativa), nunca global: o próximo Enviar nasce
     limpo e não apaga a marca do anterior (#r5-A). */
  this._cancelledAttempts=new Set();this._cancelledSeqs=new Set();this._activePrompts=new Map();this._sendSeq=0;this._stopped=false;
  /** @type {Map<string, {role: 'user', content: object[], uuid: string}>} */
  this._pendingUsers=new Map();
  adapter.on('event',e=>{
   if((e.type==='delivery'&&e.status==='uncertain')||(e.type==='turn_end'&&e.uncertain===true))this.uncertain=true;
   if(e.type==='delivery'&&e.status==='accepted'&&this._pendingUsers.has(e.id)){
    this.messages.push(this._pendingUsers.get(e.id));this._pendingUsers.delete(e.id);this._saveMessages();
   }
   if(e.type==='init'){try{onInit?.(e);}catch{this.emit('event',{type:'desk_warn',conversationId:e.conversationId,message:this._t('metaFail')});}}
   if(e.type==='message_delta')this._notePartial(e);
   if(e.type==='message_end'&&e.message&&['user','assistant'].includes(e.message.role)){
    const m=e.message;this._settlePartial(m);if(!m.uuid||!this.messages.some(x=>x.uuid===m.uuid)){this.messages.push(m);this._deferMessages();}
   }
   /* O fim do turno (inclusive erro/incerteza) é o ponto único dos
      `message_end` adiados (#116). `stop()` e `abort()` também descarregam,
      porque o motor pode morrer sem emitir `turn_end`. */
   if(e.type==='turn_end'){this._partials.clear();this.flush();}
   onEvent?.(e);const event=rendererEvent(e);if(event)this.emit('event',event);
  });
 }
 /** Texto do catálogo com o nome do motor (`claude.svc.busy`, `opencode.svc.busy`…). @param {string} key */
 _t(key){return uiMsg(this.engine==='opencode'?`opencode.svc.${key}`:`claude.svc.${key}`);}
 _saveMessages(){
  this._rememberMessages();
  this.flush();
 }
 /* Atualiza a lista em memória e o cache do adaptador na hora; a gravação em
    disco espera o fim do turno (#116) ou o teto de tempo: no máximo uma por
    intervalo, e só se chegou mensagem. */
 _deferMessages(){
  this._rememberMessages();
  this._armFlush();
 }
 _armFlush(){
  if(this._flushTimer)return;
  this._flushTimer=setTimeout(()=>{
   this.flush();
   /* Falha de gravação não desarma o teto (3ª revisão do release): o turno
      longo ainda pode cair antes do `turn_end`. */
   if(this._messagesPending)this._armFlush();
  },PENDING_MESSAGES_FLUSH_MS);
  this._flushTimer.unref?.();
 }
 /* Texto em andamento (3ª revisão do release): um passo longo fica dezenas de
    segundos sem `message_end`, e o que já estava na tela sumia numa queda dura.
    O parcial só vai para o disco: a lista em memória e o cache do adaptador
    continuam só com mensagens completas. */
 _notePartial({messageId,kind,delta}){
  if(typeof delta!=='string'||!delta)return;
  const key=messageId??'';
  const entry=this._partials.get(key)||{text:'',thinking:''};
  if(kind==='thinking')entry.thinking+=delta;else entry.text+=delta;
  this._partials.set(key,entry);
  this._messagesPending=true;
  this._armFlush();
 }
 _settlePartial({id,uuid}){
  const known=this._partials.delete(id)||this._partials.delete(uuid);
  if(!known)this._partials.clear();
 }
 _messagesWithPartials(){
  if(!this._partials.size)return this.messages;
  const partials=[...this._partials].filter(([,entry])=>entry.text.trim()||entry.thinking.trim()).map(([key,entry])=>({
   role:'assistant',...(key?{id:key,uuid:key}:{}),
   content:[...(entry.text?[{type:'text',text:entry.text}]:[]),...(entry.thinking?[{type:'thinking',thinking:entry.thinking}]:[])]
  }));
  return [...this.messages,...partials];
 }
 _rememberMessages(){
  const before=this.messages.length;
  this.messages=boundMessages(this.messages);
  this.importedPrefixLength=Math.max(0,this.importedPrefixLength-(before-this.messages.length));
  // O adaptador e o descritor recebem a MESMA fronteira importado/nativo.
  this.adapter.cacheHistory?.(this.messages,this.importedPrefixLength);
  this._messagesPending=true;
 }
 /**
  * Grava agora o que ficou pendente do turno. Idempotente: sem pendência não
  * toca no descritor.
  * @returns {void}
  * @example service.flush();
  */
 flush(){
  clearTimeout(this._flushTimer);this._flushTimer=null;
  if(!this._messagesPending)return;
  if(!this.onMessages){this._messagesPending=false;return;}
  try{this.onMessages(this._messagesWithPartials(),{importedPrefixLength:this.importedPrefixLength});this._messagesPending=false;this._flushFailed=false;}
  catch{
   if(this._flushFailed){this._armFlush();return;}
   this._flushFailed=true;
   this.emit('event',{type:'desk_warn',message:this._t('cacheFail')});
   /* A gravação direta falhou fora do teto (aceite, fim de turno): rearma
      para o intervalo tentar de novo, sem aviso a cada tentativa (#116). */
   this._armFlush();
  }
 }
 _busy(){return !!this._sending||!!this._configuring||!!this.adapter.snapshot().busy;}
 _cancelled(){const error=Error(uiMsg('tutor.error.cancelled'));error.cancelled=true;error.notSent=true;return error;}
 isRunning(state){return !!(this._busy()||state?.isStreaming||state?.isCompacting||this.adapter.snapshot().compacting);}
 /* Turno em voo para navegação: conectar/configurar controles não conta. O
    MCP do OpenCode pode demorar no macOS; trocar de matéria, salvar Ajustes ou
    apagar matéria não pode esperar por isso. */
 isTurnActive(state){return !!(this._sending||this.adapter.snapshot().busy||state?.isStreaming||state?.isCompacting||this.adapter.snapshot().compacting);}
 _refuse(text){const e=Error(text);e.notSent=true;return e;}
  async request(type,args={}){
   /* Ponte parada (troca de sessão, save-config): não responde como vivo (#r5-D). */
   if(this._stopped)throw this._cancelled();
   if(type==='get_state'){await this.adapter.connect();const s=this.adapter.snapshot();return {model:s.model,thinkingLevel:s.thinkingLevel,selection:this.adapter.controlsSnapshot?.().selection,isStreaming:!!s.busy,isCompacting:!!s.compacting,pendingMessageCount:0};}
  if(type==='initialize_controls'||type==='set_controls')return this._controls(type,args);
  if(type==='get_messages'){
   const list=await this.adapter.history().catch(()=>[]);if(list.length&&(!this.messages.length||(this.adapter.historyComplete!==false&&list.length>=this.messages.length))){this.messages=list;this._saveMessages();}return {messages:this.messages};
  }
  if(type==='get_available_models'){
   const controls=this.adapter.controlsSnapshot?.();const models=controls?.models||[];
   if(this.engine!=='claude')return {models};
   return {models:controls?.modelSelection&&!models.some(m=>m.id==='')?[{provider:'anthropic',id:'',name:uiMsg('claude.model.default')},...models]:models};
  }
  if(type==='get_controls')return this.adapter.controlsSnapshot?.()||{models:[],levels:[],selection:{model:null,effort:null},modelSelection:false,effort:false};
  if(type==='get_commands')return {commands:await this._commands()};
  if(type==='get_session_stats'){const usage=capabilities(this.engine).contextUsage?await this.adapter.sessionUsage?.().catch(()=>null):null;return usage?{contextUsage:usage}:{};}
  if(type==='clear_queue')return {};
  if(type==='abort'){
   const target=typeof args.attemptId==='string'&&args.attemptId?args.attemptId:'';
   const abortSeq=this._sendSeq;
   /* A marca precisa existir ANTES do prompt: entre o pi-prompt do renderer e o
      `_prompt` há o connect e o contexto no main, e o Parar dessa janela só
      chega aqui como marca. Parar sem envio que a consuma deixaria a marca
      para sempre (review r5-A): guarda só as mais recentes. */
   if(target){this._cancelledAttempts.delete(target);this._cancelledAttempts.add(target);}
   while(this._cancelledAttempts.size>MAX_CANCELLED_ATTEMPTS)this._cancelledAttempts.delete(this._cancelledAttempts.values().next().value);
   /* Marca aquele envio e todos os anteriores ainda não entregues (#r5-A):
      foto dos ativos agora; envio novo depois daqui nasce limpo. O Parar
      acorda quem está preso antes do token (#r5-E). */
   const stopError=this._cancelled();
   for(const [seq,entry] of this._activePrompts){this._cancelledSeqs.add(seq);entry.wake?.(stopError);}
   try{return await this.adapter.cancel();}finally{
    /* Libera a vaga só do envio que o abort encerrou (#r5-B): com outro envio
       em voo (steer durante o interrupt), a sequência mudou e a vaga é dele. */
    if(this._sendSeq===abortSeq){this._sendSeq+=1;this._sending=false;}
    this.flush();
   }
  }
  if(type==='compact'){if(!this.adapter.compact||!capabilities(this.engine).compact)throw this._refuse(this._t('noControl'));return this.adapter.compact(args);}
  if(type==='prompt')return this._prompt(args);
  throw Error(this._t('noControl'));
 }
 async _controls(type,args){
  if(!deliveryCore.canChangeControls(this._busy(),false,false,!!this.uncertain))throw Error(this._t('waitTurn'));
  /* Carregar o catálogo é leitura, não troca: o connect/MCP pode demorar no
     macOS e não pode fechar o steer nem a navegação. */
  if(type==='initialize_controls'){
   await this.adapter.connect();
   return this.adapter.initializeControls?await this.adapter.initializeControls():{};
  }
  this._configuring=true;
  try{
   await this.adapter.connect();
   if(!this.adapter.setControls)throw Error(this._t('noControls'));
   return await this.adapter.setControls(args.selection,{persistSelection:patch=>this.onSelection?.(patch)});
  }finally{this._configuring=false;}
 }
 /** @returns {Promise<Array<{name: string, description: string}>>} */
 async _commands(){
  if(!this.adapter.commands||!capabilities(this.engine).commands)return [];
  const list=await this.adapter.commands().catch(()=>[]);return Array.isArray(list)?list:[];
 }
 /* Steer (⌘/Ctrl+⏎) só com turno do motor em voo e nada nosso pendente
    (`canSteer`); sem turno, é um envio normal. `/nome` do catálogo do motor
    vira comando nativo, com as MESMAS regras de entrega. */
  async _prompt(args){
   const attemptId=typeof args.attemptId==='string'?args.attemptId:'';
   /* Parar chegou antes deste prompt (o botão nasce no connect do renderer):
      desiste sem enviar e consome SÓ a marca deste envio (#r5-A). */
   if(attemptId&&this._cancelledAttempts.has(attemptId)){this._cancelledAttempts.delete(attemptId);throw this._cancelled();}
   const wantsSteer=args.streamingBehavior==='steer';
   if(wantsSteer&&!capabilities(this.engine).steer)throw this._refuse(this._t('noSteer'));
   const steering=wantsSteer&&deliveryCore.canSteer(!!this.adapter.snapshot().busy,!!this._sending,!!this._configuring,!!this.uncertain);
   if(!steering&&!deliveryCore.canBegin(this._busy(),!!this.uncertain))throw this._refuse(this.uncertain?this._t('uncertain'):this._t('busy'));
   this._sending=true;
   const seq=++this._sendSeq;
   this._activePrompts.set(seq,{attemptId,wake:null});
   const id=crypto.randomUUID();
   const cancelled=()=>this._cancelledSeqs.has(seq)||Boolean(attemptId&&this._cancelledAttempts.has(attemptId));
   const consume=()=>{if(attemptId)this._cancelledAttempts.delete(attemptId);this._cancelledSeqs.delete(seq);};
   try{
    await this._raceActive(seq,this.adapter.connect());
    if(cancelled()){consume();throw this._cancelled();}
    if(this.adapter.initializeControls)await this._raceActive(seq,this.adapter.initializeControls());
    if(cancelled()){consume();throw this._cancelled();}
    const user={role:'user',content:[{type:'text',text:args.message},...(args.images||[])],uuid:id};
    this._pendingUsers.set(id,user);
    const slash=steering?null:await this._raceActive(seq,this._slash(args.message));
    if(cancelled()){consume();throw this._cancelled();}
    /* Daqui em diante o adaptador coordena o Parar com o envio em voo. */
    consume();
    const result=slash?await this.adapter.command({id,...slash,images:args.images||[]}):await this.adapter.send({id,text:args.message,images:args.images||[],...(steering?{delivery:'steer'}:{})});
    if(deliveryCore.outcome(!!result?.accepted,false).$!=='DeliveryOutcome.Accepted')throw Error(this._t('notConfirmed'));
    if(this._pendingUsers.has(id)){this.messages.push(this._pendingUsers.get(id));this._pendingUsers.delete(id);this._saveMessages();}
    return result;
   }catch(error){this._pendingUsers.delete(id);error.retryable=deliveryCore.mayRetry(deliveryCore.outcome(false,error?.notSent!==true));throw error;}
   finally{this._activePrompts.delete(seq);this._cancelledSeqs.delete(seq);if(attemptId)this._cancelledAttempts.delete(attemptId);if(seq===this._sendSeq)this._sending=false;}
  }
  /* Espera abortável da fase antes do token (#r5-E): o Parar acorda o envio
     preso no connect/controles/comando sem esperar ele resolver. Depois do
     aceite o adaptador coordena pelo token, então só a pré-admissão corre aqui.
     @param {number} seq @param {Promise<unknown>} promise @returns {Promise<unknown>}
     @example await this._raceActive(seq, this.adapter.connect()); */
  _raceActive(seq,promise){
   const entry=this._activePrompts.get(seq);
   if(!entry)return promise;
   if(this._cancelledSeqs.has(seq))throw this._cancelled();
   return new Promise((resolve,reject)=>{
    entry.wake=(error)=>{entry.wake=null;reject(error);};
    promise.then((value)=>{if(entry.wake){entry.wake=null;resolve(value);}},(error)=>{if(entry.wake){entry.wake=null;reject(error);}});
   });
  }
  /** @param {unknown} text @returns {Promise<{name: string, text: string}|null>} */
  async _slash(text){
  if(!this.adapter.command||typeof text!=='string'||!text.startsWith('/'))return null;
  return parseSlashCommand(text,await this._commands());
 }
 respond(data){return this.adapter.respond(data);}
  stop(){this._stopped=true;try{return this.adapter.stop();}finally{try{this.flush();}finally{clearTimeout(this._flushTimer);this._flushTimer=null;}}}
}
/* Nome antigo do serviço do Claude: o sidechat e os testes ainda o usam. */
class ClaudeService extends NativeService{
 /** @param {ConstructorParameters<typeof NativeService>[0]} options */
 constructor(options){super({...options,engine:'claude'});}
}
module.exports={NativeService,ClaudeService,capabilities,metadata,rendererEvent};
