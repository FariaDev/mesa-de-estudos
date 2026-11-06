// @ts-check
'use strict';

const fs=require('node:fs');
const path=require('node:path');
const pending=require('./pending.cjs');
const resume=require('./resume.cjs');
const bookmarks=require('./bookmarks.cjs');
const review=require('./review.cjs');
const {draftPrompt,draftContext,generateReviewDraft}=require('./review-draft.cjs');
const {createClaudeDraftBridge}=require('./src/agents/claude-review-draft.cjs');
const conversations=require('./src/agents/conversations.cjs');
const {isPlainObject,asString}=require('./desk-state-sanitize.cjs');
const {message}=require('./src/i18n.mjs');
const {invalidRequest}=require('./src/error-detail.mjs');

/* Registros de estudo da matéria ativa (#43 fase 2: saíram do main.cjs): fila
   e bandeja guardadas, o "Encerrar por hoje", favoritos e o caderno de
   revisão (rascunho numa consulta temporária do Claude Code ou do OpenCode;
   #58/#93). O host só aceita o que a matéria autoriza (biblioteca aberta e
   `.xopp` liberado). */

/**
 * Registra os handlers de fila, bandeja, encerramento, favoritos e revisão.
 * Recebe o `ipcMain`, o `live` do main, o runtime, os conjuntos de autorização
 * e as funções do main que montam os payloads e as guardas de mutação.
 * @param {{ipcMain: import('./types/host-deps').IpcMain, live: import('./main.cjs').DeskLive, runtime: string, allowed: Set<string>, allowedXopp: Set<string>,
 *   engine: import('./types/main-hosts').TutorEngineHost['engine'],
 *   claudeBinary: import('./types/main-hosts').TutorEngineHost['claudeBinary'], claudeDetector: import('./types/main-hosts').TutorEngineHost['claudeDetector'],
 *   testClaudeSdkLoader: import('./types/main-hosts').TutorEngineHost['testClaudeSdkLoader'],
 *   openCodeDraft: import('./types/main-hosts').OpenCodeTutorHost['draft'],
 *   bookmarksPayload: import('./types/main-hosts').CourseStateHost['bookmarksPayload'], reviewPayload: import('./types/main-hosts').CourseStateHost['reviewPayload'],
 *   assertNoFreeMutation: import('./types/main-hosts').DeskGuards['assertNoFreeMutation'], assertNoNav: import('./types/main-hosts').DeskGuards['assertNoNav']}} options
 * @returns {{cancelReviewDraft:()=>Promise<void>|null}} aborta e espera o rascunho de revisão em curso (o app chama ao encerrar)
 * @example const {cancelReviewDraft}=registerStudyRecordsHost({ipcMain,live,runtime,allowed,allowedXopp,engine,claudeBinary,claudeDetector,testClaudeSdkLoader,openCodeDraft,bookmarksPayload,reviewPayload,assertNoFreeMutation,assertNoNav});
 */
function registerStudyRecordsHost({ipcMain,live,runtime,allowed,allowedXopp,engine,claudeBinary,claudeDetector,testClaudeSdkLoader,openCodeDraft,bookmarksPayload,reviewPayload,assertNoFreeMutation,assertNoNav}){
 /* Claude Code (#58): adaptador temporário, sem ferramenta e sem sessão salva;
    o modelo e o esforço são os do descritor da conversa, que não é tocada. */
 function nativeDraftSelection(){
  const record=conversations.readClaudeConversation(live.session,{runtime});
  return {model:record?.model||null,effort:record?.effort||null};
 }
 function claudeDraftWorker(folder){
  const record=conversations.readClaudeConversation(live.session,{runtime});
  return createClaudeDraftBridge({cwd:folder,systemPrompt:draftPrompt(live.languageHost.tutorLanguage()),claudePath:claudeBinary()||record?.pinnedExecutable||null,
   detectClaude:claudeDetector(),sdkLoader:testClaudeSdkLoader(),selection:nativeDraftSelection()});
 }
 let activeReviewDraft=null;
 /* Fila e bandeja guardadas (`desk/pending.cjs`, núcleo `core/pending.bend`): o
    renderer manda o que tem — e o `held` da fila — e recebe de volta o que foi
    guardado; os cortes do teto de disco voltam como `dropped`/`trayDropped` para
    a faixa avisar. */
 ipcMain.handle('pending-save',(_e,payload)=>{
  const items=payload?.items;
  if(!Array.isArray(items)||items.length>200)throw Error(invalidRequest('pending-save','items',items,'array(0..200)'));
  return pending.saveQueue(runtime,live.session,items,payload?.held===true);
 });
 ipcMain.handle('tray-save',(_e,payload)=>{
  const images=payload?.images;
  if(!Array.isArray(images)||images.length>16)throw Error(invalidRequest('tray-save','images',images,'array(0..16)'));
  const pdfs=payload?.pdfs===undefined?[]:payload.pdfs;
  if(!Array.isArray(pdfs)||pdfs.length>16)throw Error(invalidRequest('tray-save','pdfs',pdfs,'array(0..16)'));
  return pending.saveTray(runtime,live.session,images,pdfs);
 });
 /* Registro do "Encerrar por hoje": grava LOCAL primeiro (é o ponto do módulo) e
    o host só aceita o que é da matéria: páginas da biblioteca aberta e `.xopp`
    já autorizado, como no `save-state`. Erro de IO sobe — o renderer mantém o
    diálogo aberto com o texto. */
 ipcMain.handle('end-day-save',(_e,payload)=>{
  const raw=payload?.record;
  if(!isPlainObject(raw))throw Error(invalidRequest('end-day-save','record',raw,'object'));
  const pages=(Array.isArray(raw.pages)?raw.pages:[]).filter(ref=>isPlainObject(ref)&&typeof ref.path==='string'&&allowed.has(ref.path));
  const xopp=typeof raw.xopp==='string'&&raw.xopp&&allowedXopp.has(raw.xopp)?raw.xopp:'';
  return resume.saveResume(runtime,live.courseId,{...raw,pages,xopp});
 });
 ipcMain.handle('resume-clear',()=>resume.clearResume(runtime,live.courseId));
 /* Favorito guardado ou removido no popover do leitor. `mode` diz o que fazer:
    `add` recebe o item do diálogo, `remove` recebe o REGISTRO clicado (a
    identidade — o host acha o favorito onde ele estiver). A resposta é a mesma
    lista FILTRADA que o `init` manda: o renderer guarda o que vê, e um favorito
    de PDF fora da biblioteca não reaparece na tela depois de um save. */
 ipcMain.handle('bookmarks-save',(_e,payload)=>{
  const raw=isPlainObject(payload)?payload:{};
  if(raw.mode==='remove')bookmarks.removeBookmark(runtime,live.courseId,raw.item);
  else bookmarks.addBookmark(runtime,live.courseId,raw.item);
  return bookmarksPayload();
 });
 /* `add` e `edit` recebem o item do diálogo; `remove` usa a identidade.
    A resposta preserva todas as questões e informa o estado da referência. */
 ipcMain.handle('review-draft',async(_e,payload)=>{
  const raw=isPlainObject(payload)?payload:{};
  if(typeof raw.id!=='string'||!raw.id||raw.id.length>80)throw Error(message('review.error.request'));
  const context=draftContext(raw);
  activeReviewDraft?.controller.abort();
  const controller=new AbortController(),task={id:raw.id,controller,cancelled:false};
  task.done=new Promise(resolve=>{task.settle=resolve;});activeReviewDraft=task;
  let folder,worker;
  try{
   fs.mkdirSync(runtime,{recursive:true});folder=fs.mkdtempSync(path.join(runtime,'.review-draft-'));
   const source=review.normalizeOne({question:context.question||'Revisão',ref:raw.ref});
   if(engine()==='claude'){worker=claudeDraftWorker(folder);return await generateReviewDraft({bridge:worker,context,ref:source.ref,signal:controller.signal});}
   /* OpenCode (#93): consulta temporária no mesmo servidor, sem MCP nem
      ferramenta nativa; o modelo e o esforço são os da conversa aberta. */
   if(engine()==='opencode'){worker=openCodeDraft({cwd:folder,systemPrompt:draftPrompt(live.languageHost.tutorLanguage()),selection:nativeDraftSelection()});return await generateReviewDraft({bridge:worker,context,ref:source.ref,signal:controller.signal});}
   throw Error(message('review.error.failed'));
  }finally{
   await worker?.stop();if(folder)fs.rmSync(folder,{recursive:true,force:true});
   if(activeReviewDraft===task)activeReviewDraft=null;
   task.settle();
  }
 });
 ipcMain.handle('review-draft-cancel',(_e,id)=>activeReviewDraft?.id===id?cancelReviewDraft():null);
 ipcMain.handle('review-save',(_e,payload)=>{
  assertNoFreeMutation();assertNoNav();
  const raw=isPlainObject(payload)?payload:{};
  if(raw.mode==='remove'){
   const result=review.reviewRemoveWithUndo(runtime,{mode:'remove',item:raw.item,key:raw.key,courseId:live.courseId,conversation:live.session});
   return {items:reviewPayload(),undoToken:result.undoToken,undoExpiresAt:result.undoExpiresAt};
  }
  review.reviewSave(runtime,{...raw,courseId:live.courseId});
  return reviewPayload();
 });
 ipcMain.handle('review-undo',(_e,payload)=>{
  assertNoFreeMutation();assertNoNav();
  const result=review.reviewUndo(runtime,{courseId:live.courseId,conversation:live.session,token:asString(payload?.token).slice(0,64)});
  return {ok:result.ok,reason:result.reason,items:reviewPayload()};
 });
 /* Aborta e espera o `finally` do rascunho, que apaga a sessão temporária do
    OpenCode antes de o main derrubar o servidor (#93). O teto curto impede que
    um motor travado segure o fechamento do app. */
 function cancelReviewDraft(){
  const task=activeReviewDraft;
  if(!task||task.cancelled)return null;
  task.cancelled=true;task.controller.abort();
  /** @type {Promise<void>} */
  const waited=new Promise((resolve)=>{
   const timer=setTimeout(resolve,2000);timer.unref?.();
   task.done.finally(()=>{clearTimeout(timer);resolve();});
  });
  return waited;
 }
 return {cancelReviewDraft};
}

module.exports={registerStudyRecordsHost};
