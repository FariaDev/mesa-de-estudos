// @ts-check
'use strict';

const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const conversations=require('./src/agents/conversations.cjs');
const free=require('./free-workspaces.cjs');
const {formatSessionLabel,engineLabelPrefix}=require('./lib.cjs');
const {cleanStudy}=require('./study.cjs');
const {deskLayout}=require('./state-adapter.cjs');
const {sanitizeCourseState}=require('./desk-state-sanitize.cjs');

/* Sessões da aba Livre (workspace virtual `mesa-free`, #43 fase 2: saiu do
   main.cjs). Cada conversa Livre tem workspace próprio no store
   (`free-workspaces.cjs`): título/rascunho/materiais/nativePath ficam lá;
   layout, estudo e rotações ficam por sessão em `desk.json`
   (`state.free.sessions`). A sessão ativa é sempre um `sessionId` do store;
   `session` é o caminho nativo (JSONL do Pi ou descritor Claude). */

/**
 * Cria o host das sessões Livre sobre o estado vivo do main.
 * Devolve registros, hidratação, persistência e listagem das sessões Livre.
 * @param {{live: import('./main.cjs').DeskLive, runtime: string, FREE_ID: string,
 *   ggb: import('./types/main-hosts').GeogebraHost,
 *   engine: import('./types/main-hosts').TutorEngineHost['engine'],
 *   previewFile: import('./types/main-hosts').TutorEngineHost['previewFile']}} options
 * @example const {ensureFreeRecord,hydrateFreeRecord}=createFreeSessionHost({live,runtime,FREE_ID,ggb,engine,previewFile});
 */
function createFreeSessionHost({live,runtime,FREE_ID,ggb,engine,previewFile}){
 function isPromotedRecord(record){return !!(record&&record.promotion&&record.promotion.status==='promoted');}
 function freeRecordForToken(file){
  if(typeof file!=='string'||!file)return null;
  for(const record of free.listWorkspaces(runtime))if(record.nativePath&&record.nativePath===file)return record;
  const prefix='free-session:';
  if(file.startsWith(prefix))return free.findWorkspace(runtime,file.slice(prefix.length));
  return null;
 }
 /* Motor da conversa Livre nova: Claude e OpenCode (#57) nascem com descritor; o resto é Pi. */
 const freeEngine=engine=>conversations.NATIVE_ENGINES.includes(engine)?engine:'pi';
 function newFreeNativePath(id,engine){return freeEngine(engine)!=='pi'?conversations.createClaudeConversation({runtime,courseId:FREE_ID,engine}):path.join(free.workspaceDir(runtime,id),`pi-${crypto.randomUUID()}.jsonl`);}
 function ensureFreeNativePath(record){
  if(record.nativePath)return record;
  const native=newFreeNativePath(record.id,'pi');
  free.setNativePath(runtime,record.id,native);
  return free.findWorkspace(runtime,record.id)||record;
 }
 /* Cria workspace + caminho nativo + entrada de layout. Não hidrata: quem chama
    decide quando a sessão vira a ativa. */
 function createFreeRecord(engine='pi'){
  const id=crypto.randomUUID();
  free.ensureWorkspace(runtime,{sessionId:id,title:free.defaultTitle()});
  const nativePath=newFreeNativePath(id,freeEngine(engine));
  free.setNativePath(runtime,id,nativePath);
  const sessions={...(live.state.free?.sessions||{}),[id]:{nativePath,engine:freeEngine(engine),draft:'',study:{title:'',xopp:''}}};
  live.state.free={activeId:id,sessions};
  return free.findWorkspace(runtime,id);
 }
 /* Sessão ativa ao abrir o Livre: a última usada; senão a que casa com o
    `session` salvo; senão a mais recente; senão uma nova. Promovidas ficam de
    fora — não podem continuar nos dois escopos. */
 function ensureFreeRecord(){
  const list=free.listWorkspaces(runtime).filter(record=>!isPromotedRecord(record));
  let record=list.find(entry=>entry.id===live.state.free?.activeId)||list.find(entry=>entry.nativePath&&entry.nativePath===live.state.session)||list[0]||null;
  if(record&&!record.nativePath)record=ensureFreeNativePath(record);
  if(!record)record=createFreeRecord('pi');
  return record;
 }
 function createFreeSession(engine){const record=createFreeRecord(engine);hydrateFreeRecord(record);return record;}
 function freeEntryOf(id){return (live.state.free&&live.state.free.sessions&&live.state.free.sessions[id])||{};}
 function hydrateFreeRecord(record){
  const entry=freeEntryOf(record.id);
  const saved=sanitizeCourseState(entry);
  const layout=deskLayout({...saved,theme:live.state.theme});
  live.state={...live.state,
   pdfs:saved.pdfs||[],
   pdfRotations:saved.pdfRotations||{},
   referenceVisible:layout.referenceVisible,
   chatWidth:layout.chatWidth,
   calcHeight:layout.calcHeight,
   pdfSplit:layout.pdfSplit,
   draft:typeof entry.draft==='string'?entry.draft:(record.draft||''),
   theme:layout.theme,
   study:cleanStudy(saved.study||{}),
   ggbBase64:typeof saved.ggbBase64==='string'?saved.ggbBase64:''};
  let kind='pi';
  try{kind=record.nativePath?freeEngine(engine(record.nativePath)):'pi';}catch{/* descritor ilegível: segue como Pi */}
  live.state.free={...(live.state.free||{}),activeId:record.id,sessions:{...(live.state.free?.sessions||{}),[record.id]:{...entry,nativePath:record.nativePath||entry.nativePath||'',engine:entry.engine||kind}} };
  live.freeSessionId=record.id;
  live.session=record.nativePath||live.session;
  ggb.resetRestored();
 }
 /* Grava o rascunho/nativePath no store e o layout por sessão no desk.json. O
    título só muda no `free-rename`. */
 function persistFreeSession(){
  if(!live.freeSessionId)return;
  let record=free.findWorkspace(runtime,live.freeSessionId);
  if(!record)return;
  const draft=free.cutDraft(typeof live.state.draft==='string'?live.state.draft:'');
  const native=live.session||record.nativePath;
  if(record.draft!==draft||(native&&record.nativePath!==native)){
   try{record=free.updateWorkspace(runtime,live.freeSessionId,{draft,nativePath:native},{expectRev:record.rev});}
   catch(error){
    if(error&&error.code==='STALE')record=free.findWorkspace(runtime,live.freeSessionId)||record;
    else throw error;
   }
  }
  let kind='pi';
  try{kind=engine(record.nativePath||live.session);}catch{/* descritor ilegível: segue como Pi */}
  const entry={...freeEntryOf(live.freeSessionId),nativePath:record.nativePath||native||'',engine:kind,draft,pdfs:live.state.pdfs||[],pdfRotations:live.state.pdfRotations||{},study:cleanStudy(live.state.study),referenceVisible:live.state.referenceVisible,chatWidth:live.state.chatWidth,calcHeight:live.state.calcHeight,pdfSplit:live.state.pdfSplit,ggbBase64:typeof live.state.ggbBase64==='string'?live.state.ggbBase64:''};
  live.state.free={...(live.state.free||{}),activeId:live.freeSessionId,sessions:{...(live.state.free?.sessions||{}),[live.freeSessionId]:entry}};
 }
 function freeSessionList(){
  return free.listWorkspaces(runtime).map(record=>{
   const path=record.nativePath;
   if(!path)return null;
   let kind;
   try{kind=conversations.conversationEngine(path,{runtime});}catch{kind='pi';}
   const started=Date.parse(record.createdAt)||Date.parse(record.updatedAt)||Date.now();
   let preview='';
   try{preview=fs.existsSync(path)?previewFile(path):'';}catch{/* sem prévia: o rótulo cai para a data */}
   const promoted=isPromotedRecord(record);
   const shownTitle=record.title===free.defaultTitle()?live.languageHost.t('free.title.placeholder'):record.title;
   const label=engineLabelPrefix(kind)+(shownTitle||formatSessionLabel({path,started,preview}));
   return {path,started,preview,engine:kind,label,promoted,promotedCourseId:promoted?record.promotion.courseId:''};
  }).filter(Boolean).sort((a,b)=>(b.started||0)-(a.started||0));
 }
 function freeWorkspacePayload(record){
  if(record)return free.workspacePayload(record);
  return {kind:'free',id:FREE_ID,sessionId:'',title:free.defaultTitle(),materials:[],promotedCourseId:''};
 }
 /* Material recém-importado/gerado aparece no PRIMEIRO leitor antes do
    initialData (o `loadCourse` do renderer abre o que está em `state.pdfs`); o
    segundo leitor e o resto do layout ficam intocados. */
 function focusFreeMaterial(material,index=0){
  if(!material||typeof material.path!=='string'||!material.path)return;
  const current=Array.isArray(live.state.pdfs)?live.state.pdfs:[null,null];
  const first={path:material.path,page:1,zoom:1,rotation:0,scrollX:0,scrollY:0,invert:false,minimized:false};
  const next=current.slice(0,2);next[index]=first;
  live.state={...live.state,pdfs:next};
 }
 function applyFreeCourse(){
  live.courseId=FREE_ID;live.course='';
  const record=ensureFreeRecord();
  hydrateFreeRecord(record);
 }
 return {isPromotedRecord,freeRecordForToken,ensureFreeNativePath,ensureFreeRecord,createFreeSession,freeEntryOf,hydrateFreeRecord,persistFreeSession,freeSessionList,freeWorkspacePayload,focusFreeMaterial,applyFreeCourse};
}

module.exports={createFreeSessionHost};
