// Transitional facade: the renderer keeps its IPC names while each engine owns
// its transport. No Pi process is created for a Claude conversation.
const {EventEmitter}=require('node:events');
const crypto=require('node:crypto');
const {boundMessages}=require('./conversations.cjs');
const capsCore=require('../generated/agentcaps.core.js').default;
const deliveryCore=require('../generated/agentdelivery.core.js').default;
function capabilities(engine,controls=null){const {$,...caps}=engine==='claude'?(controls?capsCore.claudeControlCaps(controls.modelSelection===true,controls.effort===true):capsCore.claudeCaps()):capsCore.piCaps();return caps;}
function metadata(engine,controls=null){const caps=capabilities(engine,controls);return {engine,agentLabel:engine==='claude'?'Claude Code':'Pi',caps,capabilities:caps};}
function rendererEvent(e){
 const shared={conversationId:e.conversationId,runId:e.runId};
 switch(e.type){
  case 'turn_start':return {...shared,type:'agent_start'};
  case 'message_start':case 'message_end':return {...shared,type:e.type,message:e.message};
  case 'message_delta':return {...shared,type:'message_update',assistantMessageEvent:{type:e.kind==='thinking'?'thinking_delta':'text_delta',delta:e.delta}};
  case 'tool_start':return {...shared,type:'tool_execution_start',toolCallId:e.id,toolName:e.name,args:e.args};
  case 'tool_end':return {...shared,type:'tool_execution_end',toolCallId:e.id,toolName:e.name,result:e.result,isError:e.isError};
  case 'permission_request':return {...e,...shared,type:'extension_ui_request',permission:true};
  case 'permission_cancelled':return {...shared,type:'agent_request_cancelled',id:e.id};
  case 'turn_end':return {...shared,type:'agent_settled',cancelled:!!e.cancelled,isError:!!e.isError,uncertain:!!e.uncertain};
  case 'warning':return {...shared,type:'desk_warn',message:e.message,code:e.code,...(e.rateLimit?{rateLimit:e.rateLimit}:{}),...(e.detail?{detail:e.detail}:{})};
  case 'error':return {...shared,type:'desk_error',message:e.message,code:e.code,...(typeof e.fatal==='boolean'?{fatal:e.fatal}:{}),...(e.detail?{detail:e.detail}:{})};
  default:return null;
 }
}
class ClaudeService extends EventEmitter{
 constructor({adapter,onEvent,onMessages,onInit,onSelection,uncertain=false,messages=[]}){
  super();this.uncertain=uncertain===true;this.adapter=adapter;this.messages=messages;this.onMessages=onMessages;this.onSelection=onSelection;
  adapter.on('event',e=>{
   if((e.type==='delivery'&&e.status==='uncertain')||(e.type==='turn_end'&&e.uncertain===true))this.uncertain=true;
   if(e.type==='delivery'&&e.status==='accepted'&&e.id===this.pendingUser?.uuid){
    this.messages.push(this.pendingUser);this._saveMessages();this.pendingUser=null;
   }
   if(e.type==='init'){try{onInit?.(e);}catch{this.emit('event',{type:'desk_warn',conversationId:e.conversationId,message:'Não foi possível atualizar os metadados locais do Claude Code.'});}}
   if(e.type==='message_end'&&e.message&&['user','assistant'].includes(e.message.role)){
    const m=e.message;if(!m.uuid||!this.messages.some(x=>x.uuid===m.uuid)){this.messages.push(m);this._saveMessages();}
   }
   onEvent?.(e);const event=rendererEvent(e);if(event)this.emit('event',event);
  });
 }
 _saveMessages(){this.messages=boundMessages(this.messages);try{this.onMessages?.(this.messages);}catch{this.emit('event',{type:'desk_warn',message:'Não foi possível salvar o cache local do histórico. A sessão nativa do Claude permanece como origem.'});}}
 isRunning(state){return !!(this._sending||this._configuring||state?.isStreaming||this.adapter.snapshot().busy);}
 async request(type,args={}){
  if(type==='get_state'){await this.adapter.connect();const s=this.adapter.snapshot();return {model:s.model,thinkingLevel:s.thinkingLevel,selection:this.adapter.controlsSnapshot?.().selection,isStreaming:!!s.busy,isCompacting:false,pendingMessageCount:0};}
  if(type==='initialize_controls'||type==='set_controls'){
   if(!deliveryCore.canChangeControls(!!this._sending||!!this._configuring||!!this.adapter.snapshot().busy,false,false,!!this.uncertain))throw Error('Aguarde o turno e os pedidos pendentes antes de mudar os controles.');
   this._configuring=true;
   try{
    await this.adapter.connect();
    if(type==='initialize_controls')return this.adapter.initializeControls?await this.adapter.initializeControls():{};
    if(!this.adapter.setControls)throw Error('Controles de modelo indisponíveis nesta conexão.');
    return await this.adapter.setControls(args.selection,{persistSelection:patch=>this.onSelection?.(patch)});
   }finally{this._configuring=false;}
  }
  if(type==='get_messages'){
   const list=await this.adapter.history().catch(()=>[]);if(list.length&&(!this.messages.length||(this.adapter.historyComplete!==false&&list.length>=this.messages.length))){this.messages=list;this._saveMessages();}return {messages:this.messages};
  }
  if(type==='get_available_models'){
   const controls=this.adapter.controlsSnapshot?.();const models=controls?.models||[];
   return {models:controls?.modelSelection&&!models.some(m=>m.id==='')?[{provider:'anthropic',id:'',name:'Padrão do Claude Code'},...models]:models};
  }
  if(type==='get_controls')return this.adapter.controlsSnapshot?.()||{models:[],levels:[],selection:{model:null,effort:null},modelSelection:false,effort:false};
  if(type==='get_commands')return {commands:[]};
  if(type==='get_session_stats')return {};
  if(type==='clear_queue')return {};
  if(type==='abort')return this.adapter.cancel();
  if(type==='prompt'){
   if(args.streamingBehavior==='steer'){const e=Error('Claude Code não oferece steer nesta versão. Use a fila.');e.notSent=true;throw e;}
   if(!deliveryCore.canBegin(!!this._sending||!!this._configuring||!!this.adapter.snapshot().busy,!!this.uncertain)){const e=Error(this.uncertain?'A entrega anterior está incerta; comece outra conversa.':'Claude Code já tem um envio ou turno em andamento.');e.notSent=true;throw e;}
   this._sending=true;
   try{
    await this.adapter.connect();
    if(this.adapter.initializeControls)await this.adapter.initializeControls();
    if(args.toolPolicy)this.adapter.setToolPolicy(args.toolPolicy);
    const id=crypto.randomUUID();this.pendingUser={role:'user',content:[{type:'text',text:args.message},...(args.images||[])],uuid:id};
    const result=await this.adapter.send({id,text:args.message,images:args.images||[]});
    if(deliveryCore.outcome(!!result?.accepted,false).$!=='DeliveryOutcome.Accepted')throw Error('Claude Code não confirmou o envio.');
    if(this.pendingUser){this.messages.push(this.pendingUser);this._saveMessages();this.pendingUser=null;}
    return result;
   }catch(error){this.pendingUser=null;error.retryable=deliveryCore.mayRetry(deliveryCore.outcome(false,error?.notSent!==true));throw error;}
   finally{this._sending=false;}
  }
  throw Error('Este controle ainda não está disponível para Claude Code.');
 }
 respond(data){return this.adapter.respond(data);}
 stop(){this.adapter.stop();}
}
module.exports={ClaudeService,capabilities,metadata,rendererEvent};
