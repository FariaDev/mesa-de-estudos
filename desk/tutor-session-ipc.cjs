// @ts-check
'use strict';

const conversations=require('./src/agents/conversations.cjs');
const {EFFORT_LEVELS:CLAUDE_EFFORT_LEVELS}=require('./src/agents/claude-controls.cjs');
const {selectionFromChange}=require('./src/agents/opencode-controls.cjs');
const {FALLBACK_LEVELS,loadLevelsModule}=require('./pi.cjs');
const {isPlainObject}=require('./desk-state-sanitize.cjs');
const {message}=require('./src/i18n.mjs');
const {describeReceived,invalidRequest}=require('./src/error-detail.mjs');

/* IPC da sessão do tutor (#43 fase 2: saiu do main.cjs): chamar/cancelar,
   comandos, saúde e contexto, compactação, modelo e esforço, interromper e
   responder diálogos. O envio de mensagem mora em tutor-prompt-host.cjs. */

/**
 * Registra os handlers `pi-*` da sessão do tutor (menos `pi-prompt`).
 * Recebe o `ipcMain`, o `live` do main, os diálogos pendentes e as funções dos
 * hosts do tutor e do estado que as respostas montam.
 * @param {{ipcMain: import('./types/host-deps').IpcMain, live: import('./main.cjs').DeskLive, runtime: string, deskDir: string, pendingDialogs: Set<string>,
 *   appendLog: import('./types/host-deps').AppendLog, engine: import('./types/main-hosts').TutorEngineHost['engine'], connect: import('./types/main-hosts').TutorBridgeHost['connect'], stopBridge: import('./types/main-hosts').TutorBridgeHost['stopBridge'],
 *   assertIdle: import('./types/main-hosts').TutorBridgeHost['assertIdle'], persist: import('./types/main-hosts').CourseStateHost['persist'], courseSessions: import('./types/main-hosts').CourseStateHost['courseSessions'],
 *   conversationData: import('./types/main-hosts').TutorEngineHost['conversationData'], captureAvailable: () => boolean,
 *   trimMessageImages: import('./types/main-hosts').PromptImages['trimMessageImages'], piBinary: import('./types/main-hosts').TutorEngineHost['piBinary'],
 *   isNative: import('./types/main-hosts').TutorEngineHost['isNative']}} options
 * @returns {void}
 * @example registerTutorSessionIpc({ipcMain,live,runtime,deskDir,pendingDialogs,appendLog,engine,connect,stopBridge,assertIdle,persist,courseSessions,conversationData,captureAvailable,trimMessageImages,piBinary,isNative});
 */
function registerTutorSessionIpc({ipcMain,live,runtime,deskDir,pendingDialogs,appendLog,engine,connect,stopBridge,assertIdle,persist,courseSessions,conversationData,captureAvailable,trimMessageImages,piBinary,isNative}){
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
  return typeof notice==='string'&&notice?Error(notice):error;
 }
 ipcMain.handle('pi-connect',async()=>{
  persist();
  const attempt={cancelled:false};connectAttempt=attempt;
  const step=async value=>{const out=await value;if(attempt.cancelled)throw Error(message('tutor.error.cancelled'));return out;};
  try{
   const b=connect();
   const kind=engine();
   if(isNative(kind)&&!b.uncertain)await step(b.request('initialize_controls'));
   const s=await step(b.request('get_state'));
   const messages=await step(b.request('get_messages'));
   const models=await step(b.request('get_available_models'));
   await live.opencodeHost.liveReady();
   const controls=isNative(kind)?await step(b.request('get_controls')):null;
   const levels=controls?(controls.effort?['default',...(controls.levels||[])]:[]):await step(levelsFor(s.model));
   const contextUsage=await step(statsUsage());
   return {state:s,models:live.opencodeHost.annotate(models?.models||[],{keepFree:kind==='opencode'}),levels,messages:trimMessageImages(messages?.messages||[]),session:live.session,sessions:courseSessions(),...conversationData({messages:false}),captureAvailable:captureAvailable(),contextUsage};
  }catch(error){
   /* A tela diz o que aconteceu em português; o código de saída e o texto do
      motor ficam aqui, no log (#27). */
   if(!attempt.cancelled){try{appendLog('desk',`Chamada ao tutor falhou: ${live.languageHost.logText(error&&error.message||error)}`);}catch{/* o log não pode falhar o tratador de erro */}}
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
   const result=await connect().request('get_commands');
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
  try{const stats=await connect().request('get_session_stats',{},30000);
   const usage=stats?.contextUsage;
   if(usage)return usage;
   if(stats&&stats.tokens&&stats.contextWindow)return {tokens:stats.tokens,contextWindow:stats.contextWindow,percent:stats.tokens/stats.contextWindow*100};
  }catch{/* sem estatística: o medidor fica sem valor */}
  return null;
 }
 ipcMain.handle('pi-health',async()=>{const state=await connect().request('get_state',{},20000);
  return {...conversationData({messages:false}),ok:true,isRunning:live.bridge.isRunning(state),isCompacting:!!state?.isCompacting,isStreaming:!!state?.isStreaming,pendingMessageCount:Number(state?.pendingMessageCount)||0,contextUsage:await statsUsage()};});
 ipcMain.handle('pi-compact',async(_e,instructions)=>{
  /* Claude (#58) e OpenCode (#57): a compactação manual é do motor; o fim chega
     pelo `compact_result` do stream ou pelo SSE. */
  await assertIdle(message('err.idle.compact'));
  const b=connect();
  const result=await b.request('compact',{customInstructions:typeof instructions==='string'&&instructions.trim()?instructions.trim().slice(0,2000):undefined},240000);
  return {summary:typeof result?.summary==='string'?result.summary.slice(0,300):'',tokensBefore:Number(result?.tokensBefore)||0};
 });
 ipcMain.handle('pi-auto-compaction',async(_e,enabled)=>{if(engine()==='claude')throw Error(message('err.compaction.controlClaude'));
  if(engine()==='opencode')throw Error(message('err.compaction.controlOpenCode'));
  const b=connect();
  await b.request('set_auto_compaction',{enabled:!!enabled});
  const s=await b.request('get_state');
  return {autoCompactionEnabled:!!s.autoCompactionEnabled,contextUsage:await statsUsage()};});

 async function levelsFor(model){
  if(!live.levelsMod)live.levelsMod=await loadLevelsModule(piBinary(),deskDir);
  if(!live.levelsMod?.getSupportedThinkingLevels)return FALLBACK_LEVELS;
  return model?live.levelsMod.getSupportedThinkingLevels(model):['off'];
 }
 ipcMain.handle('pi-settings',async(_e,change={})=>{
  if(!isPlainObject(change))throw Error(invalidRequest('pi-settings','change',change,'object'));
  const b=connect();let current=await b.request('get_state');
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
  if(change.model){const wanted=/** @type {{provider?: unknown, id?: unknown}} */(change.model);
   const catalog=await b.request('get_available_models');
   const found=catalog.models?.find(m=>m.provider===wanted.provider&&m.id===wanted.id);
   if(!found)throw Error(message('err.model.notInTutor'));
   await b.request('set_model',{provider:found.provider,modelId:found.id});live.opencodeHost.rememberModel(found);}
  if(change.level){current=await b.request('get_state');
   if(!(await levelsFor(current.model)).includes(change.level))throw Error(message('err.model.effort'));
   await b.request('set_thinking_level',{level:change.level});}
  current=await b.request('get_state');return {state:current,levels:await levelsFor(current.model),contextUsage:await statsUsage()};
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

 ipcMain.handle('pi-abort',async()=>{if(live.bridge){await live.bridge.request('clear_queue');await live.bridge.request('abort');}});
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
  const result=await connect().respond(payload);
  if(isNative(engine())&&result?.ok===false)throw Error(message('err.dialog.notAccepted'));
  pendingDialogs.delete(id);
  return result;
 });
}

module.exports={registerTutorSessionIpc};
