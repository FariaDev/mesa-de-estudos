// @ts-check
const fs=require('node:fs');
const free=require('./free-workspaces.cjs');
const {courseLibrary}=require('./courses.cjs');
const {message: uiMsg}=require('./src/i18n.mjs');

/* ---------- estudo: busca, anotações, revisão e estatísticas (IPC) ----------
   `studyServices` continua sendo criado e ciclado pelo main (fecha/dorme/bate o
   relógio); aqui só o registro dos handlers. O que o main reatribui (`courseId`,
   `session`, `courses`, `state`) chega por acessor. `study-search-open` é a
   única navegação: valida o destino inteiro ANTES de mexer na matéria do host. */
function registerStudyHost({ipcMain,studyServices,sidechatManager,runtime,freeId,courseStates,courses,courseId,session,state,isPlainObject,asString,withHostNav,assertIdle,assertNoFreeMutation,assertNoNav,freeRecordForToken,libraryAuthorizedChats,courseSessions,openSessionWithinNav,persist,stopBridge,applyCourse,initialData}){
 ipcMain.handle('study-search',(_e,payload)=>studyServices.search(isPlainObject(payload)?payload:{}));
 ipcMain.handle('study-search-catalog',()=>studyServices.catalog());
 ipcMain.handle('study-search-resolve',(_e,payload)=>studyServices.resolve(payload?.id));
 ipcMain.handle('study-search-open',(_e,payload)=>withHostNav(async()=>{
  const destination=studyServices.resolve(payload?.id);if(!destination.ok)throw Error(destination.error);
  await assertIdle(uiMsg('err.idle.openStudy'));
  let targetId=destination.courseId||'',freeRecord=null,sideRecord=null;
  if(destination.kind==='free'){
   freeRecord=free.findWorkspace(runtime,destination.sessionId);
   if(!freeRecord)throw Error(uiMsg('err.studyhost.freeGone'));
  }
  if(destination.scope?.startsWith('free:')){
   freeRecord=free.findWorkspace(runtime,destination.scope.slice(5));
   if(!freeRecord)throw Error(uiMsg('err.studyhost.freeGone'));
  }
  if(destination.scope==='free'&&destination.path){
   freeRecord=free.listWorkspaces(runtime).find(record=>record.materials?.some(material=>material.path===destination.path));
   if(!freeRecord)throw Error(uiMsg('err.studyhost.freePdfGone'));
  }
  if(destination.kind==='conversation'){
   freeRecord=freeRecordForToken(destination.sessionPath);
   const known=libraryAuthorizedChats().find(row=>row.session===destination.sessionPath);
   if(known)targetId=known.courseId;
  }
  if(destination.kind==='note'&&!targetId&&!freeRecord)targetId=destination.scope;
  if(destination.kind==='sidechat'){
   try{sideRecord=JSON.parse(fs.readFileSync(destination.sessionPath,'utf8'));}catch{throw Error(uiMsg('err.studyhost.sideUnreadable'));}
   targetId=sideRecord.courseId;freeRecord=freeRecordForToken(sideRecord.mainSession);
  }
  if(freeRecord)targetId=freeId;
  if(destination.scope==='free')targetId=freeId;
  if(targetId&&targetId!==freeId&&!courses().some(c=>c.id===targetId))throw Error(uiMsg('err.studyhost.courseUnset'));
  // Todas as validações acontecem antes de mudar a matéria do host. Uma
  // referência que sumiu não deve deixar renderer e host em matérias distintas.
  const targetCourse=courses().find(c=>c.id===targetId);
  const targetSaved=targetId===courseId()?state():courseStates[targetId];
  const targetPaths=new Set(targetId===freeId?(freeRecord?.materials||[]).map(item=>item.path):[
   ...(targetCourse?.path?courseLibrary(targetCourse.path):[]).map(item=>item.path),
   ...(targetSaved?.pdfs||[]).filter(item=>fs.existsSync(item.path)).map(item=>item.path)
  ]);
  if(['pdf','material'].includes(destination.kind)&&(!destination.path||!targetPaths.has(destination.path)||!fs.existsSync(destination.path)))throw Error(uiMsg('err.studyhost.pdfUnauthorized'));
  if(destination.kind==='note'||destination.kind==='review'){
   if(destination.path&&(!targetPaths.has(destination.path)||!fs.existsSync(destination.path)))destination.unavailable=true;
  }
  if(!freeRecord&&(destination.kind==='conversation'||sideRecord)){
   const file=sideRecord?.mainSession||destination.sessionPath;
   if(!libraryAuthorizedChats().some(row=>row.courseId===targetId&&row.session===file))throw Error(uiMsg('err.studyhost.sessionGone'));
  }
  if(targetId&&targetId!==courseId()){persist();stopBridge();applyCourse(targetId);}
  if(freeRecord){const token=freeRecord.nativePath||`free-session:${freeRecord.id}`;await openSessionWithinNav(token);}
  else if(destination.kind==='conversation'||sideRecord){
   const file=sideRecord?.mainSession||destination.sessionPath;
   if(!courseSessions().some(s=>s.path===file))throw Error(uiMsg('err.studyhost.sessionGone'));
   await openSessionWithinNav(file);
  }
  const data=initialData();
  return {destination,data,...(sideRecord?{sidechat:await sidechatManager.read({id:sideRecord.id})}:{})};
 }));
 /* Anotações só gravam no mesmo (matéria, sessão) em que foram lidas. */
 let noteScope='';
 const scopeNow=()=>JSON.stringify([courseId(),session()]);
 ipcMain.handle('study-notes-read',()=>{noteScope=scopeNow();return studyServices.notesRead();});
 ipcMain.handle('study-notes-save',(_e,payload)=>{
  assertNoFreeMutation();assertNoNav();
  if(noteScope!==scopeNow())throw Error(uiMsg('err.studyhost.sessionChangedSave'));
  const raw=isPlainObject(payload)?payload:{};
  return raw.mode==='remove'?studyServices.notesRemoveWithUndo(raw):studyServices.notesSave(raw);
 });
 ipcMain.handle('study-notes-undo',(_e,payload)=>{
  assertNoFreeMutation();assertNoNav();
  if(noteScope!==scopeNow())throw Error(uiMsg('err.studyhost.sessionChangedUndo'));
  return studyServices.notesUndo({token:asString(payload?.token).slice(0,64)});
 });
 ipcMain.handle('study-review-today',()=>studyServices.reviewToday());
 ipcMain.handle('study-review-grade',(_e,payload)=>studyServices.reviewGrade(payload));
 ipcMain.handle('study-stats-summary',(_e,payload)=>studyServices.statsSummary(payload));
 ipcMain.handle('study-stats-control',(_e,payload)=>studyServices.statsControl(payload));
 ipcMain.handle('study-stats-reset',(_e,payload)=>studyServices.statsReset(payload));
}
module.exports={registerStudyHost};
