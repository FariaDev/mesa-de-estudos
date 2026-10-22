// @ts-check
'use strict';

// Transient PDF bytes only. Saving remains an explicit, separate operation.
const materialModel=require('./material-model.cjs');
const {message}=require('./src/i18n.mjs');
const {describeReceived}=require('./src/error-detail.mjs');

/** @param {unknown} value @param {number} max @param {number} [min] @returns {value is string} */
const isText=(value,max,min=1)=>typeof value==='string'&&value.length>=min&&value.length<=max;
/* Cada campo com o formato esperado; o primeiro que não bate vai na mensagem (#43 fase 3). */
/** @type {Array<[string, (value: unknown) => boolean, string]>} */
const PREVIEW_FIELDS=[
 ['title',value=>value===undefined||isText(value,120,0),'string(0..120)'],
 ['markdown',value=>isText(value,262144)&&value.trim()!=='','string(1..262144)'],
 ['revision',value=>isText(value,128),'string(1..128)'],
 ['requestId',value=>isText(value,64),'string(1..64)'],
 ['model',value=>value===undefined||(typeof value==='string'&&materialModel.isKnownModel(value)),materialModel.MODEL_IDS.join('|')],
 ['options',value=>value===undefined||(!!value&&typeof value==='object'&&!Array.isArray(value)&&JSON.stringify(value).length<=2000),'object(JSON ..2000)'],
];
/** @param {string} field @param {unknown} value @param {string} expected */
const previewError=(field,value,expected)=>Error(message('err.preview.invalid',{field,received:describeReceived(value),expected}));
/**
 * Confere o pedido de prévia campo a campo.
 * @param {unknown} payload
 * @example assertPreviewPayload({markdown: '# a', revision: 'r1', requestId: 'q1'})
 */
function assertPreviewPayload(payload){
 if(!payload||typeof payload!=='object'||Array.isArray(payload))throw previewError('payload',payload,'object');
 for(const [field,valid,expected] of PREVIEW_FIELDS){
  if(!valid(payload[field]))throw previewError(field,payload[field],expected);
 }
}

/**
 * Prévia do PDF (`material-preview`, `material-preview-cancel`): uma por vez.
 * @param {{
 *   renderPdf: (options: object) => Promise<{buffer: ArrayBufferLike, sha256: string, diagnostics?: unknown[], templateHash?: string,
 *     model?: string, options?: object, columns?: number, columnsAuto?: boolean, columnsLabel?: string, fit?: object}>,
 *   captureScope: () => import('./types/host-deps').MaterialScope,
 *   scopeIsCurrent: (scope: import('./types/host-deps').MaterialScope) => boolean,
 *   allowSender?: import('./types/host-deps').AllowSender, contextName?: () => string,
 * }} deps
 * @example createMaterialPreviewHost({renderPdf, captureScope, scopeIsCurrent}).register(ipcMain);
 */
function createMaterialPreviewHost({renderPdf, captureScope, scopeIsCurrent, allowSender=()=>true, contextName=()=>''}) {
 let job=null;
 function cancel(requestId) {
  if(job&&(!requestId||job.requestId===requestId)){
   job.controller.abort();job=null;return true;
  }
  return false;
 }
 async function preview(event,payload) {
  if(!allowSender(event))throw Error(message('err.ipc.senderDenied',{channel:'material-preview'}));
  assertPreviewPayload(payload);
  const {title='',markdown,revision,requestId,model,options}=payload;
  const scope=captureScope();
  if(!scopeIsCurrent(scope))throw Error(message('err.session.changed'));
  cancel();
  const current={requestId,scope,controller:new AbortController()};job=current;
  try{
   const rendered=await renderPdf({title,markdown,model,options,context:contextName(),signal:current.controller.signal,timeoutMs:60000});
   if(job!==current||current.controller.signal.aborted||!scopeIsCurrent(scope))throw Error(message('err.preview.cancelled'));
   return {requestId,revision,pdf:new Uint8Array(rendered.buffer),sha256:rendered.sha256,
    diagnostics:rendered.diagnostics||[],templateHash:rendered.templateHash||null,
    model:rendered.model||'livre',options:rendered.options||{},columns:rendered.columns||1,columnsAuto:rendered.columnsAuto===true,
    columnsLabel:rendered.columnsLabel||'',fit:rendered.fit||null};
  }finally{if(job===current)job=null;}
 }
 function register(ipcMain){
  ipcMain.handle('material-preview',preview);
  ipcMain.handle('material-preview-cancel',(event,payload)=>{
   if(!allowSender(event))throw Error(message('err.ipc.senderDenied',{channel:'material-preview-cancel'}));
   if(typeof payload?.requestId!=='string'||payload.requestId.length>64)throw previewError('requestId',payload?.requestId,'string(0..64)');
   return {cancelled:cancel(payload.requestId)};
  });
 }
 return {preview,cancel,register};
}
module.exports={createMaterialPreviewHost,assertPreviewPayload};
