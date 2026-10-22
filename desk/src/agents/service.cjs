// Transitional facade: the renderer keeps its IPC names while each engine owns
// its transport. No Pi process is created for a Claude conversation.
const {EventEmitter}=require('node:events');
const crypto=require('node:crypto');
const {boundMessages}=require('./conversations.cjs');
const {parseSlashCommand}=require('./opencode-commands.cjs');
const {message: uiMsg}=require('../i18n.mjs');
const capsCore=require('../generated/agentcaps.core.js').default;
const deliveryCore=require('../generated/agentdelivery.core.js').default;
/* Caps por motor (#57): Pi, Claude e OpenCode têm os seus; qualquer outro
   nome fica com `unknownCaps` (tudo fechado), nunca com os do Pi. Com os
   controles lidos do motor, Claude e OpenCode ganham modelo/esforço. */
const STRUCTURAL_CAPS={pi:()=>capsCore.piCaps(),claude:()=>capsCore.claudeCaps(),opencode:()=>capsCore.opencodeCaps()};
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
  adapter.on('event',e=>{
   if((e.type==='delivery'&&e.status==='uncertain')||(e.type==='turn_end'&&e.uncertain===true))this.uncertain=true;
   if(e.type==='delivery'&&e.status==='accepted'&&e.id===this.pendingUser?.uuid){
    this.messages.push(this.pendingUser);this._saveMessages();this.pendingUser=null;
   }
   if(e.type==='init'){try{onInit?.(e);}catch{this.emit('event',{type:'desk_warn',conversationId:e.conversationId,message:this._t('metaFail')});}}
   if(e.type==='message_end'&&e.message&&['user','assistant'].includes(e.message.role)){
    const m=e.message;if(!m.uuid||!this.messages.some(x=>x.uuid===m.uuid)){this.messages.push(m);this._saveMessages();}
   }
   onEvent?.(e);const event=rendererEvent(e);if(event)this.emit('event',event);
  });
 }
 /** Texto do catálogo com o nome do motor (`claude.svc.busy`, `opencode.svc.busy`…). @param {string} key */
 _t(key){return uiMsg(this.engine==='opencode'?`opencode.svc.${key}`:`claude.svc.${key}`);}
 _saveMessages(){
  const before=this.messages.length;
  this.messages=boundMessages(this.messages);
  this.importedPrefixLength=Math.max(0,this.importedPrefixLength-(before-this.messages.length));
  // O adaptador e o descritor recebem a MESMA fronteira importado/nativo.
  this.adapter.cacheHistory?.(this.messages,this.importedPrefixLength);
  try{this.onMessages?.(this.messages,{importedPrefixLength:this.importedPrefixLength});}catch{this.emit('event',{type:'desk_warn',message:this._t('cacheFail')});}
 }
 _busy(){return !!this._sending||!!this._configuring||!!this.adapter.snapshot().busy;}
 isRunning(state){return !!(this._busy()||state?.isStreaming||state?.isCompacting||this.adapter.snapshot().compacting);}
 _refuse(text){const e=Error(text);e.notSent=true;return e;}
 async request(type,args={}){
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
  if(type==='abort')return this.adapter.cancel();
  if(type==='compact'){if(!this.adapter.compact||!capabilities(this.engine).compact)throw this._refuse(this._t('noControl'));return this.adapter.compact(args);}
  if(type==='prompt')return this._prompt(args);
  throw Error(this._t('noControl'));
 }
 async _controls(type,args){
  if(!deliveryCore.canChangeControls(this._busy(),false,false,!!this.uncertain))throw Error(this._t('waitTurn'));
  this._configuring=true;
  try{
   await this.adapter.connect();
   if(type==='initialize_controls')return this.adapter.initializeControls?await this.adapter.initializeControls():{};
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
  const wantsSteer=args.streamingBehavior==='steer';
  if(wantsSteer&&!capabilities(this.engine).steer)throw this._refuse(this._t('noSteer'));
  const steering=wantsSteer&&deliveryCore.canSteer(!!this.adapter.snapshot().busy,!!this._sending,!!this._configuring,!!this.uncertain);
  if(!steering&&!deliveryCore.canBegin(this._busy(),!!this.uncertain))throw this._refuse(this.uncertain?this._t('uncertain'):this._t('busy'));
  this._sending=true;
  try{
   await this.adapter.connect();
   if(this.adapter.initializeControls)await this.adapter.initializeControls();
   /* O steer entra no turno em voo, que já tem a política dele: o adaptador
      recusa trocá-la com turno aberto, e o envio morreria antes de sair (#58). */
   if(args.toolPolicy&&!steering)this.adapter.setToolPolicy(args.toolPolicy);
   const id=crypto.randomUUID();this.pendingUser={role:'user',content:[{type:'text',text:args.message},...(args.images||[])],uuid:id};
   const slash=steering?null:await this._slash(args.message);
   const result=slash?await this.adapter.command({id,...slash,images:args.images||[]}):await this.adapter.send({id,text:args.message,images:args.images||[],...(steering?{delivery:'steer'}:{})});
   if(deliveryCore.outcome(!!result?.accepted,false).$!=='DeliveryOutcome.Accepted')throw Error(this._t('notConfirmed'));
   if(this.pendingUser){this.messages.push(this.pendingUser);this._saveMessages();this.pendingUser=null;}
   return result;
  }catch(error){this.pendingUser=null;error.retryable=deliveryCore.mayRetry(deliveryCore.outcome(false,error?.notSent!==true));throw error;}
  finally{this._sending=false;}
 }
 /** @param {unknown} text @returns {Promise<{name: string, text: string}|null>} */
 async _slash(text){
  if(!this.adapter.command||typeof text!=='string'||!text.startsWith('/'))return null;
  return parseSlashCommand(text,await this._commands());
 }
 respond(data){return this.adapter.respond(data);}
 stop(){this.adapter.stop();}
}
/* Nome antigo do serviço do Claude: o sidechat e os testes ainda o usam. */
class ClaudeService extends NativeService{
 /** @param {ConstructorParameters<typeof NativeService>[0]} options */
 constructor(options){super({...options,engine:'claude'});}
}
module.exports={NativeService,ClaudeService,capabilities,metadata,rendererEvent};
