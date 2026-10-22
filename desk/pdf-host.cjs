// @ts-check
const fs=require('node:fs');
const {message: uiMsg}=require('./src/i18n.mjs');
const path=require('node:path');
const free=require('./free-workspaces.cjs');
const {courseLibrary,courseDropFolder}=require('./courses.cjs');
const {normalize,pickPdfs}=require('./config.cjs');
const {validateDroppedPdf}=require('./pdf-drop-host.cjs');

/* ---------- leitores de PDF e imagens da mesa (IPC) ----------
   Só liga o IPC ao que o main já decide: o que é "PDF autorizado" (`validPdf`,
   `allowed`) e "imagem legível" (`readableImage`) continua lá. O que o main
   reatribui (`course`, `courseId`, `config`, `state`, `freeSessionId`) chega por
   acessor; `pdfDisk` é o cache de bytes (o main o limpa na restauração). */
function registerPdfHost({ipcMain,dialog,shell,win,runtime,freeId,allowed,pdfDisk,course,courseId,config,state,freeSessionId,isPlainObject,isFree,validPdf,readableImage,assertNoFreeMutation,assertNoNav,assertIdle,freeMutate,focusFreeMaterial,persist,initialData}){
 ipcMain.handle('open-pdf',async()=>{
  if(courseId()===freeId)throw Error(uiMsg('err.pdf.freeUseOpen'));
  const r=await dialog.showOpenDialog(win(),{filters:[{name:'PDF',extensions:['pdf']}],properties:['openFile']});
  if(r.canceled)return null;
  const p=r.filePaths[0];
  allowed.add(p);
  return {name:path.basename(p),path:p};
 });
 /* Folha "Lista 0" do leitor vazio: abrir a pasta da matéria no sistema e reler a
    biblioteca dela sem recarregar a sessão (a Mesa volta ao primeiro plano com
    PDFs que o usuário jogou na pasta). Livre não tem pasta de matéria. */
 ipcMain.handle('course-reveal-folder',async()=>{
  if(courseId()===freeId||!course())throw Error(uiMsg('err.pdf.noFolder'));
  const folder=courseDropFolder(course());
  if(!folder)throw Error(uiMsg('err.pdf.folderGone'));
  const error=await shell.openPath(folder);
  if(error)throw Error(error);
  return {ok:true};
 });
 ipcMain.handle('course-library',()=>{
  if(courseId()===freeId||!course())return {courseId:courseId(),library:[],preferred:[]};
  const library=courseLibrary(course());
  for(const p of library)allowed.add(p.path);
  return {courseId:courseId(),library,preferred:(pickPdfs(library,normalize(config()).desk.panels)||[]).map(p=>p?.path||null)};
 });
 ipcMain.handle('open-dropped-pdf',async(_e,payload)=>{
  const raw=isPlainObject(payload)?payload:{};
  const index=raw.panelIndex;
  if(!Number.isInteger(index)||index<0||index>=normalize(config()).desk.panels.length)throw Error(uiMsg('err.pdf.badReader'));
  assertNoFreeMutation();assertNoNav();
  const chosen=validateDroppedPdf(raw.path);
  if(!isFree()){allowed.add(chosen.path);return chosen;}
  return freeMutate('open-dropped-pdf',async()=>{
   if(!isFree()||!freeSessionId())throw Error(uiMsg('err.free.inactive'));
   const record=free.findWorkspace(runtime,freeSessionId());
   if(!record)throw Error(uiMsg('err.free.unavailable'));
   const scope=free.captureScope(runtime,freeSessionId());
   await assertIdle(uiMsg('err.idle.openPdf'));
   free.assertScope(runtime,scope);
   if(!isFree()||freeSessionId()!==record.id)throw Error(uiMsg('err.free.changedImport'));
   const imported=free.importPdf(runtime,record.id,{sourcePath:chosen.path,name:path.basename(chosen.path,path.extname(chosen.path))});
   focusFreeMaterial(imported.material,index);persist();
   const data=initialData();
   return {name:imported.material.name,path:imported.material.path,data};
  });
 });
 ipcMain.handle('pdf-page-labels-get',(_e,file)=>{
  validPdf(file);
  return {offset:Object.hasOwn(state().pdfPageOffsets,file)?state().pdfPageOffsets[file]:null};
 });
 ipcMain.handle('pdf-page-labels-save',(_e,payload)=>{
  assertNoFreeMutation();assertNoNav();
  const raw=isPlainObject(payload)?payload:{};
  const file=validPdf(raw.path),offset=raw.offset;
  const offsets=state().pdfPageOffsets;
  if(offset!==null&&(!Number.isInteger(offset)||Math.abs(offset)>1000000))throw Error(uiMsg('err.pdf.badOffset'));
  if(offset===null)delete offsets[file];
  else{
   if(!Object.hasOwn(offsets,file)&&Object.keys(offsets).length>=2000)throw Error(uiMsg('err.pdf.offsetLimit'));
   offsets[file]=offset;
  }
  persist();return {offset};
 });
 ipcMain.handle('read-pdf',(_e,p)=>{
  p=validPdf(p);
  const st=fs.statSync(p);
  const hit=pdfDisk.get(p);
  if(hit&&hit.mtime===st.mtimeMs&&hit.size===st.size)return hit.bytes;
  const bytes=new Uint8Array(fs.readFileSync(p));
  pdfDisk.set(p,{mtime:st.mtimeMs,size:st.size,bytes});
  if(pdfDisk.size>6)pdfDisk.delete(pdfDisk.keys().next().value);
  return bytes;
 });
 ipcMain.handle('read-image',(_e,input)=>{
  const hit=readableImage(input);
  return hit?{name:path.basename(hit.file),dataUrl:`data:${hit.mime};base64,${hit.bytes.toString('base64')}`}:null;
 });
 ipcMain.handle('open-image',async(_e,input)=>{
  const hit=readableImage(input);
  if(!hit)throw Error(uiMsg('err.pdf.imageGone'));
  if(hit.mime==='image/svg+xml')throw Error(uiMsg('err.pdf.svgOnly'));
  const error=await shell.openPath(hit.file);
  if(error)throw Error(error);
 });
}
module.exports={registerPdfHost};
