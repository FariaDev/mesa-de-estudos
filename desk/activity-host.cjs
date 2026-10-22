// @ts-check
'use strict';
const crypto=require('node:crypto');
const {message}=require('./src/i18n.mjs');
const {describeReceived}=require('./src/error-detail.mjs');

// Only the trusted shell gets these APIs. scopeRef binds asynchronous UI work
// to the conversation and host generation from which its metadata was read.
/**
 * @typedef {{courseId: string, conversationId: string, freeSessionId: string, generation: number}} ActivityScope
 *   Conversa de onde a atividade veio; `generation` muda a cada troca no main.
 * @typedef {{toolCallId: string, callRef?: string}} ActivityCaller
 */
/**
 * Canais `activity-*` da janela principal e a publicação pedida pelo tutor.
 * @param {{
 *   store: ReturnType<typeof import('./activity-store.cjs').createActivityStore>,
 *   runtime: ReturnType<typeof import('./activity-runtime.cjs').createActivityRuntime>,
 *   captureScope: () => ActivityScope, scopeIsCurrent: (scope: ActivityScope) => boolean,
 *   mutate?: import('./types/host-deps').Mutate,
 *   emit?: (event: object) => void,
 *   allowSender?: import('./types/host-deps').AllowSender,
 *   measure?: ((spec: object) => Promise<unknown>) | null,
 * }} deps
 * @example
 * const host = createActivityHost({store, runtime, captureScope, scopeIsCurrent});
 * host.register(ipcMain);
 */
function createActivityHost({store,runtime,captureScope,scopeIsCurrent,mutate=(_label,fn)=>fn(),emit=()=>{},allowSender=()=>true,measure=null}){
 let scopeRef='',scope=null;
 /* Largura do texto da resposta na coluna do tutor (#42): o renderer informa;
    é a largura padrão da prévia do tutor. */
 let columnWidth=360;
 function current(){
  const next=captureScope();
  if(!scope||!scopeIsCurrent(scope)){
   scope=next;scopeRef=crypto.randomUUID();
  }
  if(!scopeIsCurrent(scope))throw Error(message('err.session.changed'));
  return {...scope};
 }
 function scoped(item){return {...item,scopeRef};}
 function requireScope(payload){
  if(!payload||typeof payload.scopeRef!=='string'||payload.scopeRef!==scopeRef||!scope||!scopeIsCurrent(scope))throw Error(message('err.activity.sessionChangedReopen'));
  return {...scope};
 }
 function invalidate(){scope=null;scopeRef='';}
 async function publish(captured,spec,caller){
  /* A prévia mede o documento nas larguras do núcleo ANTES de publicar (#42):
     o quadro nasce com a altura certa. Medir é fora da trava — leva um
     instante — e falhar só deixa a versão sem medição. */
  const heights=typeof measure==='function'&&scopeIsCurrent(captured)?await measure(spec).catch(()=>undefined):undefined;
  return mutate('activity-publish',async()=>{
   if(!scopeIsCurrent(captured))throw Error(message('err.activity.sessionChangedNotPublished'));
   if(typeof caller?.toolCallId!=='string'||!caller.toolCallId.trim())throw Error(message('err.activity.callerMissing',{received:describeReceived(caller?.toolCallId)}));
   // Establish the shell scope before the publication's event.
   current();
   // Revisão opcional: o store confere que o id existe NESTA conversa.
   const activityId=spec&&typeof spec.activityId==='string'?spec.activityId:'';
   const item=await store.publish({...captured,spec,activityId,heights,toolCallId:caller.toolCallId,callRef:caller.callRef||''});
   if(!scopeIsCurrent(captured))throw Error(message('err.activity.sessionChangedPublishing'));
   if(!runtime.remember(item,spec))throw Error(message('err.activity.documentInvalid',{id:item.id,version:item.version}));
   const activity=scoped(item);
   emit({status:'published',courseId:captured.courseId,conversationId:captured.conversationId,scope:{...captured,scopeRef},activity});
   return activity;
  });
 }
 function list(){const captured=current();return {items:store.list(captured).map(scoped)};}
 function activeScope(){return {...current(),scopeRef};}
 function read(payload){
  const captured=requireScope(payload);
  const result=store.read({...captured,id:payload.id,version:payload.version});
  if(!runtime.remember(result.item,result.spec))throw Error(message('err.activity.documentInvalid',{id:result.item.id,version:result.item.version}));
  return {...result,item:scoped(result.item)};
 }
 function stateGet(payload){const captured=requireScope(payload);return store.stateGet({...captured,id:payload.id,version:payload.version,hash:payload.hash});}
 async function stateSave(payload){
  const captured=requireScope(payload);
  return mutate('activity-state',async()=>{
   if(!scopeIsCurrent(captured))throw Error(message('err.activity.sessionChangedNotSaved'));
   return store.stateSave({...captured,id:payload.id,version:payload.version,hash:payload.hash,state:payload.state});
  });
 }
 function setColumn(payload){
  const width=Math.round(Number(payload&&payload.width));
  if(Number.isFinite(width)&&width>=200&&width<=2000)columnWidth=width;
  return {width:columnWidth};
 }
 function register(ipcMain){
  /** @type {Array<[string,(payload: unknown) => unknown]>} */
  const channels=[['activity-column',setColumn],['activity-scope',activeScope],['activity-list',list],['activity-read',read],['activity-state-get',stateGet],['activity-state-save',stateSave]];
  for(const [channel,fn] of channels){
   ipcMain.handle(channel,(event,payload)=>{
    if(!allowSender(event))throw Error(message('err.ipc.senderDenied',{channel}));
    return fn(payload);
   });
  }
 }
 return {publish,list,read,stateGet,stateSave,register,invalidate,activeScope,columnWidth:()=>columnWidth};
}
module.exports={createActivityHost};
