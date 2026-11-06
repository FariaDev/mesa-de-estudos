// @ts-check
'use strict';

const conversations=require('./src/agents/conversations.cjs');
const {EFFORT_LEVELS:CLAUDE_EFFORT_LEVELS}=require('./src/agents/claude-controls.cjs');
const {selectionFromChange}=require('./src/agents/opencode-controls.cjs');
const {isPlainObject}=require('./desk-state-sanitize.cjs');
const {message,parseMessage}=require('./src/i18n.mjs');
const {describeReceived,invalidRequest}=require('./src/error-detail.mjs');

/* IPC da sessão do tutor (#43 fase 2: saiu do main.cjs): chamar/cancelar,
   comandos, saúde e contexto, compactação, modelo e esforço, interromper e
   responder diálogos. O envio de mensagem mora em tutor-prompt-host.cjs. */

/**
 * Registra os handlers `pi-*` da sessão do tutor (menos `pi-prompt`).
 * Recebe o `ipcMain`, o `live` do main, os diálogos pendentes e as funções dos
 * hosts do tutor e do estado que as respostas montam.
 * @param {{ipcMain: import('./types/host-deps').IpcMain, live: import('./main.cjs').DeskLive, runtime: string, pendingDialogs: Set<string>,
 *   appendLog: import('./types/host-deps').AppendLog, engine: import('./types/main-hosts').TutorEngineHost['engine'], connect: import('./types/main-hosts').TutorBridgeHost['connect'], stopBridge: import('./types/main-hosts').TutorBridgeHost['stopBridge'],
 *   assertIdle: import('./types/main-hosts').TutorBridgeHost['assertIdle'], persist: import('./types/main-hosts').CourseStateHost['persist'], courseSessions: import('./types/main-hosts').CourseStateHost['courseSessions'],
 *   conversationData: import('./types/main-hosts').TutorEngineHost['conversationData'], captureAvailable: () => boolean,
 *   historyIdentity?: (history: {session?: string, messages?: unknown[], cards?: unknown[]}) => string,
 *   trimMessageImages: import('./types/main-hosts').PromptImages['trimMessageImages'],
 *   isNative: import('./types/main-hosts').TutorEngineHost['isNative']}} options
 * @returns {void}
 * @example registerTutorSessionIpc({ipcMain,live,runtime,pendingDialogs,appendLog,engine,connect,stopBridge,assertIdle,persist,courseSessions,conversationData,captureAvailable,trimMessageImages,isNative});
 */
function registerTutorSessionIpc({ipcMain,live,runtime,pendingDialogs,appendLog,engine,connect,stopBridge,assertIdle,persist,courseSessions,conversationData,captureAvailable,historyIdentity,trimMessageImages,isNative}){
 /* Chamar o tutor pode ser cancelado (ticket #17): `pi-connect-cancel` marca a
    tentativa em voo e derruba a ponte (`stopBridge` rejeita os pedidos
    pendentes). A tentativa confere a marca entre um pedido e outro — uma ponte
    parada religa sozinha em `request()`, e a chamada cancelada não pode
    ressuscitar o processo que a pessoa acabou de interromper. */
 let connectAttempt=null;
 /* Claude Code fora da faixa (#51): a coluna do tutor recebe a mensagem do
    catálogo (versão encontrada + faixa) e a traduz no idioma da interface; o
    log fica com a frase em português. Os outros erros seguem como vieram. */
 function tutorFacingError(error){
  const notice=error?.code==='CLAUDE_VERSION_UNSUPPORTED'?error.detail?.notice:'';
  if(typeof notice==='string'&&notice)return Error(notice);
  /* O código de saída do `opencode serve` fica no log (#27): a coluna diz o
     que aconteceu sem number técnico no lugar da frase. */
  if(parseMessage(error?.message)?.key==='err.opencode.startExit')return Error(message('tutor.reason.exit'));
  return error;
 }
  ipcMain.handle('pi-connect',async(_event,request)=>{
   persist();
   const attempt={cancelled:false};connectAttempt=attempt;
   /* A navegação (troca de sessão/matéria, save-config → stopBridge) cancela a
      tentativa em voo: sem isto o motor antigo respondia na sessão nova (#r5-D). */
   const sessionAtStart=live.session;
   let b=null;
   const stale=()=>attempt.cancelled||live.session!==sessionAtStart||(b!==null&&typeof live.bridge!=='undefined'&&live.bridge!==b);
   const step=async value=>{const out=await value;if(stale())throw Error(message('tutor.error.cancelled'));return out;};
   try{
    b=await connect();
    if(stale())throw Error(message('tutor.error.cancelled'));
   const kind=engine();
   const native=isNative(kind);
   if(native&&!b.uncertain)await step(b.request('initialize_controls'));
   /* Estado, histórico, catálogo, controles e medidor não dependem entre si. */
   const [s,messages,models,controls,contextUsage]=await Promise.all([
    step(b.request('get_state')),
    step(b.request('get_messages')),
    step(b.request('get_available_models')),
    native?step(b.request('get_controls')):null,
    step(statsUsage()),
    live.opencodeHost.liveReady(),
   ]);
   const levels=controls&&controls.effort?['default',...(controls.levels||[])]:[];
   /* O renderer manda a identidade do histórico que está na tela. Se o motor
      devolve o mesmo conteúdo, mensagens e cartões NÃO voltam pelo IPC (#115);
      só o selo diz que nada mudou, e o `showHistory` do connect não roda. */
   const originalMessages=Array.isArray(messages?.messages)?messages.messages:[];
   const screenMessages=trimMessageImages(originalMessages);
   const {cards,...meta}=conversationData({messages:false});
   const cardsList=Array.isArray(cards)?cards:[];
   const identity=typeof historyIdentity==='function'?historyIdentity({session:live.session,messages:originalMessages,cards:cardsList}):'';
   const asked=request&&typeof request==='object'&&typeof request.historyIdentity==='string'?request.historyIdentity:'';
   const unchanged=!!identity&&asked===identity;
   return {state:s,models:live.opencodeHost.annotate(models?.models||[],{keepFree:kind==='opencode'}),levels,session:live.session,sessions:courseSessions(),...meta,
    ...(identity?{historyIdentity:identity}:{}),...(unchanged?{historyUnchanged:true}:{messages:screenMessages,cards}),captureAvailable:captureAvailable(),contextUsage};
   }catch(error){
    /* A tela diz o que aconteceu em português; o código de saída e o texto do
       motor ficam aqui, no log (#27). Troca de sessão não é falha: não loga. */
    if(!attempt.cancelled&&live.session===sessionAtStart){try{appendLog('desk',`Chamada ao tutor falhou: ${live.languageHost.logText(error&&error.message||error)}`);}catch{/* o log não pode falhar o tratador de erro */}}
    throw tutorFacingError(error);
  }finally{if(connectAttempt===attempt)connectAttempt=null;}
 });
 ipcMain.handle('pi-connect-cancel',()=>{
  const attempt=connectAttempt;
  if(!attempt)return false;
  attempt.cancelled=true;
  try{appendLog('desk','Chamada ao tutor cancelada pela pessoa.');}catch{/* o log não pode falhar o tratador de erro */}
  stopBridge();
  return true;
 });
 ipcMain.handle('pi-commands',async()=>{
  try{
   const result=await (await connect()).request('get_commands');
   const list=Array.isArray(result?.commands)?result.commands:[];
   return list.slice(0,100).map(c=>({
    name:String(c?.name||'').slice(0,60),
    description:String(c?.description||'').slice(0,200),
    argumentHint:String(c?.argumentHint||c?.argument_hint||'').slice(0,60)
   })).filter(c=>c.name);
  }catch{return [];}
 });
 async function statsUsage(){
  /* Nativo: o serviço só pergunta ao motor que tem medidor (caps `contextUsage`). */
  try{const stats=await (await connect()).request('get_session_stats',{},30000);
   const usage=stats?.contextUsage;
   if(usage)return usage;
   if(stats&&stats.tokens&&stats.contextWindow)return {tokens:stats.tokens,contextWindow:stats.contextWindow,percent:stats.tokens/stats.contextWindow*100};
  }catch{/* sem estatística: o medidor fica sem valor */}
  return null;
 }
 ipcMain.handle('pi-health',async()=>{const state=await (await connect()).request('get_state',{},20000);
  return {...conversationData({messages:false}),ok:true,isRunning:live.bridge.isRunning(state),isCompacting:!!state?.isCompacting,isStreaming:!!state?.isStreaming,pendingMessageCount:Number(state?.pendingMessageCount)||0,contextUsage:await statsUsage()};});
 ipcMain.handle('pi-compact',async(_e,instructions)=>{
  /* Claude (#58) e OpenCode (#57): a compactação manual é do motor; o fim chega
     pelo `compact_result` do stream ou pelo SSE. */
  await assertIdle(message('err.idle.compact'));
  const b=await connect();
  const result=await b.request('compact',{customInstructions:typeof instructions==='string'&&instructions.trim()?instructions.trim().slice(0,2000):undefined},240000);
  return {summary:typeof result?.summary==='string'?result.summary.slice(0,300):'',tokensBefore:Number(result?.tokensBefore)||0};
 });
 ipcMain.handle('pi-auto-compaction',async()=>{throw Error(message(engine()==='claude'?'err.compaction.controlClaude':'err.compaction.controlOpenCode'));});
 ipcMain.handle('pi-settings',async(_e,change={})=>{
  if(!isPlainObject(change))throw Error(invalidRequest('pi-settings','change',change,'object'));
  const b=await connect();let current=await b.request('get_state');
  if(live.bridge.isRunning(current))throw Error(message('err.model.busy'));
  if(isNative(engine())&&(Object.hasOwn(change,'model')||Object.hasOwn(change,'level'))&&(b.uncertain||conversations.readClaudeConversation(live.session,{runtime})?.delivery?.status==='uncertain'))throw Error(message('err.model.uncertain'));
  if(engine()==='opencode')return openCodeSettings(b,change);
  if(engine()==='claude'){
   const controls=await b.request('get_controls');
   const selection={model:controls.selection?.model||null,effort:controls.selection?.effort||null};
   const hasModel=Object.hasOwn(change,'model'),hasLevel=Object.hasOwn(change,'level');
   if(hasModel){
    if(!isPlainObject(change.model)||change.model.provider!=='anthropic'||typeof change.model.id!=='string')throw Error(message('err.model.notInClaude'));
    const wantedId=change.model.id;
    const catalog=await b.request('get_available_models');
    if(!catalog.models.some(m=>m.provider==='anthropic'&&m.id===wantedId))throw Error(message('err.model.notInClaude'));
    selection.model=wantedId||null;selection.effort=null;
   }
   if(hasLevel){
    // A combined patch targets the NEW model: the adapter validates its native
    // catalog atomically before applying either value. Old levels only govern
    // effort-only patches, never a simultaneous model change.
    if(typeof change.level!=='string'||!['default',...CLAUDE_EFFORT_LEVELS].includes(change.level)||(!hasModel&&change.level!=='default'&&!controls.levels?.includes(change.level)))throw Error(message('err.model.effort'));
    selection.effort=change.level==='default'?null:change.level;
   }
   if(hasModel||hasLevel)await b.request('set_controls',{selection});
   current=await b.request('get_state');
   const next=await b.request('get_controls'),catalog=await b.request('get_available_models');
   return {state:current,models:catalog.models,levels:next.effort?['default',...(next.levels||[])]:[],...conversationData({messages:false}),contextUsage:await statsUsage()};
  }
  throw Error(message('err.model.notInTutor'));
 });

 /* OpenCode (#57): a escolha vai ao adaptador, que a confere no catálogo do
    servidor; os grátis do Zen ficam no seletor com selo e política. */
 async function openCodeSettings(b,change){
  const controls=await b.request('get_controls');
  if(Object.hasOwn(change,'model')||Object.hasOwn(change,'level'))await b.request('set_controls',{selection:selectionFromChange(controls.selection||{model:null,effort:null},change)});
  const state=await b.request('get_state');
  const next=await b.request('get_controls');
  return {state,models:live.opencodeHost.annotate(next.models||[],{keepFree:true}),levels:next.effort?['default',...(next.levels||[])]:[],...conversationData({messages:false}),contextUsage:await statsUsage()};
 }

 ipcMain.handle('pi-abort',async(_e,payload)=>{if(live.bridge){await live.bridge.request('clear_queue');await live.bridge.request('abort',typeof payload?.attemptId==='string'?{attemptId:payload.attemptId}:{});}});
 ipcMain.handle('pi-response',async(_e,data)=>{
  const id=typeof data?.id==='string'?data.id:'';
  if(!id||!pendingDialogs.has(id))throw Error(message('err.dialog.noPending',{received:describeReceived(data?.id)}));
  const payload={id};
  if(typeof data.value==='string')payload.value=data.value;
  if(data.confirmed===true)payload.confirmed=true;
  if(data.cancelled===true)payload.cancelled=true;
  if(engine()==='claude'&&data.answers!==undefined){
   if(!isPlainObject(data.answers)||Object.keys(data.answers).length>16)throw Error(invalidRequest('pi-response','answers',data.answers,'object(0..16)'));
   const answers=Object.create(null);
   for(const [question,value] of Object.entries(data.answers)){
    if(!question||question.length>4000)throw Error(invalidRequest('pi-response','answers[question]',question,'string(1..4000)'));
    if(typeof value==='string'&&value.length<=4000)answers[question]=value;
    else if(Array.isArray(value)&&value.length<=32&&value.every(v=>typeof v==='string'&&v.length<=4000))answers[question]=value;
    else throw Error(invalidRequest('pi-response',`answers[${describeReceived(question)}]`,value,'string(0..4000)|array(0..32)'));
   }
   payload.answers=answers;
  }
  const result=await (await connect()).respond(payload);
  if(isNative(engine())&&result?.ok===false)throw Error(message('err.dialog.notAccepted'));
  pendingDialogs.delete(id);
  return result;
 });
}

module.exports={registerTutorSessionIpc};
