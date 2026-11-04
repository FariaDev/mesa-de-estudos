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
 *   measure?: ((spec: object) => Promise<{heights?: number[][], consoleMessages?: {level: string, text: string}[]}>) | null,
 *   resolvePreview?: ((scope: ActivityScope, spec: object) => object | null) | null,
 * }} deps
 * @example
 * const host = createActivityHost({store, runtime, captureScope, scopeIsCurrent});
 * host.register(ipcMain);
 */
function createActivityHost({store,runtime,captureScope,scopeIsCurrent,mutate=(_label,fn)=>fn(),emit=()=>{},allowSender=()=>true,measure=null,resolvePreview=null}){
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
 /* O conteúdo da publicação: direto ou o rascunho que a prévia guardou (A3).
    Id vencido, inventado ou de outra conversa vira erro antes de medir e de
    gravar; o modelo recebe a instrução de reenviar o conteúdo ou pré-visualizar. */
 function contentFor(captured,spec){
  if(typeof resolvePreview!=='function')return spec;
  const resolved=resolvePreview(captured,spec);
  if(resolved)return resolved;
  const previewId=spec&&typeof spec.previaId==='string'?spec.previaId:'';
  throw Error(message('err.activity.previewMissing',{received:describeReceived(previewId)}));
 }
 /* A prévia mede o documento nas larguras do núcleo ANTES de publicar (#42):
    o quadro nasce com a altura certa. Medir é fora da trava — leva um
    instante. Erro de console RECUSA a publicação: o documento já provou que
    está quebrado, e o aluno não deve ver um quadro quebrado. Falha da medição
    em si (janela, prazo) só publica com aviso: pode ser infraestrutura, e um
    quadro válido não deve sumir por isso (M7). */
 async function inspect(spec){
  if(typeof measure!=='function')return {};
  try{
   const measured=await measure(spec);
   const result=measured&&typeof measured==='object'?measured:{};
   const errors=(Array.isArray(result.consoleMessages)?result.consoleMessages:[]).filter(entry=>entry&&entry.level==='error');
   if(errors.length)throw Error(message('err.activity.publishConsoleErrors',{count:errors.length,first:String(errors[0].text||'').slice(0,300)}));
   return {heights:Array.isArray(result.heights)?result.heights:undefined,failed:!Array.isArray(result.heights)};
  }catch(error){
   if(error&&String(error.message||'').includes('err.activity.publishConsoleErrors'))throw error;
   return {failed:true};
  }
 }
 async function publish(captured,spec,caller){
  const resolved=contentFor(captured,spec);
  const measured=scopeIsCurrent(captured)?await inspect(resolved):{};
  return mutate('activity-publish',async()=>{
   if(!scopeIsCurrent(captured))throw Error(message('err.activity.sessionChangedNotPublished'));
   if(typeof caller?.toolCallId!=='string'||!caller.toolCallId.trim())throw Error(message('err.activity.callerMissing',{received:describeReceived(caller?.toolCallId)}));
   // Establish the shell scope before the publication's event.
   current();
   // Revisão opcional: o store confere que o id existe NESTA conversa.
   const activityId=resolved&&typeof resolved.activityId==='string'?resolved.activityId:'';
   const item=await store.publish({...captured,spec:resolved,activityId,heights:measured.heights,toolCallId:caller.toolCallId,callRef:caller.callRef||''});
   if(!scopeIsCurrent(captured))throw Error(message('err.activity.sessionChangedPublishing'));
   if(!runtime.remember(item,resolved))throw Error(message('err.activity.documentInvalid',{id:item.id,version:item.version}));
   const activity={...scoped(item),...(measured.failed?{measureFailed:true}:{})};
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
