// @ts-check
const path=require('node:path');
const free=require('./free-workspaces.cjs');
const materialPdf=require('./material-pdf.cjs');
const courseMaterials=require('./src/study-data/course-materials.cjs');
const {message}=require('./src/i18n.mjs');

/* ---------- APIs da aba Livre (preload: freeOpenPdf/freeSaveMaterial/…) ----------
   Todas capturam o escopo no começo, rechecam depois de cada await (diálogo
   nativo/render) e só então gravam; a mutação bloqueia troca/nova conversa/abrir
   e o save de config. O resultado é SEMPRE o initialData integral — o renderer
   reaplica com `loadCourse` sem perder tema/rascunho/fila/leitores.

   O estado compartilhado continua com UM dono, o main: `courseId`, `session`,
   `courses`, `freeSessionId` e `state` chegam como acessores (são reatribuídos
   lá); `setState` é a única escrita, usada só por `course-save-material`. */
/**
 * @param {{
 *   ipcMain: import('./types/host-deps').IpcMain, dialog: import('./types/host-deps').Dialog,
 *   win: () => import('./types/host-deps').BrowserWindow, runtime: string,
 *   courses: () => Array<{id: string, name: string}>, courseId: () => string, session: () => string,
 *   freeSessionId: () => string, state: () => import('./types/desk-state').DeskState,
 *   setState: (next: import('./types/desk-state').DeskState) => void, allowed: Set<string>, freeJobs: Set<AbortController>,
 *   isFree: () => boolean, isPromotedRecord: (record: object) => boolean,
 *   freeMutate: import('./types/host-deps').Mutate, assertIdle: (reason: string) => Promise<void>,
 *   focusFreeMaterial: (material: object) => void,
 *   runFreePromotion: (request: {record: object, parentDir: string, name: string}) => Promise<{course: object}>,
 *   persist: () => void, initialData: () => object, appendLog: import('./types/host-deps').AppendLog,
 *   contextName?: () => string, rememberPdfModel?: (choice: {model?: string, options?: object}) => void,
 *   t?: import('./types/host-deps').Translate,
 * }} deps
 * @example registerFreeHost({ipcMain, dialog, win: () => win, runtime, ...accessors});
 */
function registerFreeHost({ipcMain,dialog,win,runtime,courses,courseId,session,freeSessionId,state,setState,allowed,freeJobs,isFree,isPromotedRecord,freeMutate,assertIdle,focusFreeMaterial,runFreePromotion,persist,initialData,appendLog,contextName=()=>'',rememberPdfModel=()=>{},t=key=>key}){
 ipcMain.handle('free-open-pdf',async()=>{
  const out=await freeMutate('open-pdf',async()=>{
   if(!isFree()||!freeSessionId())throw Error(message('err.free.inactive'));
   const record=free.findWorkspace(runtime,freeSessionId());
   if(!record)throw Error(message('err.free.unavailable'));
   const scope=free.captureScope(runtime,freeSessionId());
   await assertIdle(message('err.idle.openPdf'));
   const picked=await dialog.showOpenDialog(win(),{title:t('free.dialog.openPdf'),filters:[{name:'PDF',extensions:['pdf']}],properties:['openFile']});
   if(picked.canceled||!picked.filePaths[0])return {cancelled:true};
   free.assertScope(runtime,scope);
   if(!isFree()||freeSessionId()!==record.id)throw Error(message('err.free.changedImport'));
   const imported=free.importPdf(runtime,record.id,{sourcePath:picked.filePaths[0],name:path.basename(picked.filePaths[0])});
   focusFreeMaterial(imported.material);
   persist();
   return {cancelled:false};
  });
  if(out.cancelled)return {cancelled:true};
  return initialData();
 });
 ipcMain.handle('free-save-material',async(_e,payload)=>{
  const title=typeof payload?.title==='string'?payload.title.slice(0,free.maxTitle()):'';
  const markdown=typeof payload?.markdown==='string'?payload.markdown:'';
  const material=await freeMutate('save-material',async()=>{
   if(!isFree()||!freeSessionId())throw Error(message('err.free.inactive'));
   const record=free.findWorkspace(runtime,freeSessionId());
   if(!record)throw Error(message('err.free.unavailable'));
   const scope=free.captureScope(runtime,freeSessionId());
   free.assertScope(runtime,scope);
   await assertIdle(message('err.idle.makePdf'));
   const controller=new AbortController();
   freeJobs.add(controller);
   try{
    const saved=await free.saveMaterial(runtime,record.id,{title,markdown,model:payload?.model,options:payload?.options,context:contextName(),signal:controller.signal,timeoutMs:60000});
    /* O próprio `saveMaterial` bumpa o `rev` ao registrar o material; o que
       precisa continuar verdadeiro depois do render é o ESCOPO (a sessão ativa
       não trocou). Troca/nova conversa/abrir ficam bloqueadas pela mutação. */
    if(!isFree()||freeSessionId()!==record.id)throw Error(message('err.free.changedLink'));
    if(typeof payload?.draftId==='string'&&free.findWorkspace(runtime,record.id)?.pdfDraft?.id===payload.draftId){
     try{free.updateWorkspace(runtime,record.id,{pdfDraft:null});}catch(error){appendLog('tutor-pdf',`PDF salvo; não foi possível limpar o rascunho: ${error.message}`);}
    }
    try{rememberPdfModel({model:payload?.model,options:payload?.options});}catch(error){appendLog('tutor-pdf',`PDF salvo; modelo não lembrado: ${error.message}`);}
    focusFreeMaterial(saved.material);
    persist();
    return saved.material;
   }finally{freeJobs.delete(controller);}
  });
  return {saved:true,material,data:initialData()};
 });
 ipcMain.handle('course-save-material',async(_e,payload)=>freeMutate('course-pdf',async()=>{
  if(isFree())throw Error(message('err.free.pickCourseToSave'));
  const target=courses().find(c=>c.id===courseId());if(!target)throw Error(message('err.course.notFound'));
  const scope={courseId:courseId(),session:session()},controller=new AbortController();freeJobs.add(controller);
  try{
   await assertIdle(message('err.idle.makePdf'));
   const material=await materialPdf.savePdf({dir:courseMaterials.materialDirectory(target),stem:materialPdf.sanitizeStem(payload?.title),title:payload?.title,markdown:payload?.markdown,model:payload?.model,options:payload?.options,context:target.name,signal:controller.signal,timeoutMs:60000});
   try{rememberPdfModel({model:payload?.model,options:payload?.options});}catch(error){appendLog('tutor-pdf',`PDF salvo; modelo não lembrado: ${error.message}`);}
   try{courseMaterials.clearDraft(runtime,scope,payload?.draftId);}catch(error){appendLog('tutor-pdf',`PDF salvo; prévia preservada: ${error.message}`);}
   allowed.add(material.path);setState({...state(),pdfs:[{path:material.path,page:1,zoom:1},...(state().pdfs||[]).slice(1,2)]});persist();
   return {saved:true,material,data:initialData()};
  }finally{freeJobs.delete(controller);}
 }));
 ipcMain.handle('free-add-material',async(_e,payload)=>freeMutate('add-material',async()=>{
  if(!isFree()||!freeSessionId())throw Error(message('err.free.pickPdf'));
  const target=courses().find(c=>c.id===payload?.courseId);if(!target)throw Error(message('err.free.targetNotFound'));
  const material=courseMaterials.addToCourse({workspace:free.findWorkspace(runtime,freeSessionId()),materialId:payload?.materialId,course:target});
  return {added:true,material};
 }));
 ipcMain.handle('free-rename',async(_e,payload)=>{
  const title=typeof payload?.title==='string'?payload.title.slice(0,free.maxTitle()):'';
  await freeMutate('rename',async()=>{
   if(!isFree()||!freeSessionId())throw Error(message('err.free.inactive'));
   const record=free.findWorkspace(runtime,freeSessionId());
   if(!record)throw Error(message('err.free.unavailable'));
   free.renameWorkspace(runtime,record.id,title);
   persist();
  });
  return initialData();
 });
 ipcMain.handle('free-promote',async(_e,payload)=>{
  const name=typeof payload?.name==='string'?payload.name.trim():'';
  if(!name)throw Error(message('err.free.nameCourse'));
  const out=await freeMutate('promote',async()=>{
   if(!isFree()||!freeSessionId())throw Error(message('err.free.inactive'));
   const record=free.findWorkspace(runtime,freeSessionId());
   if(!record)throw Error(message('err.free.unavailable'));
   if(isPromotedRecord(record))throw Error(message('err.free.alreadyPromoted'));
   const scope=free.captureScope(runtime,freeSessionId());
   await assertIdle(message('err.idle.makeCourse'));
   /* A prévia/confirmação fica na UI; aqui só a escolha NATIVA da pasta-mãe. */
   const picked=await dialog.showOpenDialog(win(),{title:t('free.dialog.pickCourseFolder'),properties:['openDirectory','createDirectory']});
   if(picked.canceled||!picked.filePaths[0])return {cancelled:true};
   free.assertScope(runtime,scope);
   if(!isFree()||freeSessionId()!==record.id)throw Error(message('err.free.changedNothing'));
   const created=await runFreePromotion({record,parentDir:picked.filePaths[0],name});
   return {cancelled:false,course:created.course};
  });
  if(out.cancelled)return {cancelled:true};
  return {created:true,course:out.course,data:initialData()};
 });
}
module.exports={registerFreeHost};
