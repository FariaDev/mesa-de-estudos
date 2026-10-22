// @ts-check
'use strict';

const fs=require('node:fs');
const path=require('node:path');
const pending=require('./pending.cjs');
const resume=require('./resume.cjs');
const bookmarks=require('./bookmarks.cjs');
const review=require('./review.cjs');
const courseMaterials=require('./src/study-data/course-materials.cjs');
const materialModel=require('./material-model.cjs');
const free=require('./free-workspaces.cjs');
const chatState=require('./src/study-data/chat-state.cjs');
const {sessionStartedFromPath,formatSessionLabel,engineLabelPrefix}=require('./lib.cjs');
const {courseLibrary}=require('./courses.cjs');
const {needsSetup,normalize,pickPdfs}=require('./config.cjs');
const {cleanStudy,authorizeRestoredStudy}=require('./study.cjs');
const {deskLayout}=require('./state-adapter.cjs');
const {sanitizeCourseState}=require('./desk-state-sanitize.cjs');

/* Matéria ativa e estado da mesa (#43 fase 2: saiu do main.cjs): troca de
   matéria, persistência do desk.json, sessões da matéria, registros de
   retomada/favoritos/caderno e o payload inicial do renderer. O estado vivo
   (matéria, sessão, estado) continua no main e chega pelo `live`. */

/**
 * Cria as operações de matéria e estado sobre o `live` do main.
 * Recebe o `live`, caminhos e conjuntos de autorização do main e as funções dos
 * hosts do tutor e da aba Livre que o estado consulta; devolve persist,
 * applyCourse, initialData e os demais payloads da matéria.
 * @param {{live: import('./main.cjs').DeskLive, runtime: string, FREE_ID: string, stateFile: string,
 *   courseStates: Record<string, import('./types/desk-state').CourseState>,
 *   allowed: Set<string>, allowedXopp: Set<string>,
 *   ggb: import('./types/main-hosts').GeogebraHost, ggbCache: import('./types/main-hosts').GgbCache,
 *   appendLog: import('./types/host-deps').AppendLog,
 *   previewFile: import('./types/main-hosts').TutorEngineHost['previewFile'],
 *   sessionInfo: import('./types/main-hosts').TutorEngineHost['sessionInfo'],
 *   conversationData: import('./types/main-hosts').TutorEngineHost['conversationData'],
 *   piBinary: import('./types/main-hosts').TutorEngineHost['piBinary'],
 *   freeSessionList: import('./types/main-hosts').FreeSessionHost['freeSessionList'],
 *   persistFreeSession: import('./types/main-hosts').FreeSessionHost['persistFreeSession'],
 *   applyFreeCourse: import('./types/main-hosts').FreeSessionHost['applyFreeCourse'],
 *   freeWorkspacePayload: import('./types/main-hosts').FreeSessionHost['freeWorkspacePayload'],
 *   captureAvailable: () => boolean, deskVersionLabel: () => string}} options
 * @example const {persist,applyCourse,initialData}=createCourseStateHost({live,runtime,FREE_ID,stateFile,courseStates,...});
 */
function createCourseStateHost({live,runtime,FREE_ID,stateFile,courseStates,allowed,allowedXopp,ggb,ggbCache,appendLog,previewFile,sessionInfo,conversationData,piBinary,freeSessionList,persistFreeSession,applyFreeCourse,freeWorkspacePayload,captureAvailable,deskVersionLabel}){
 function sessionStudy(file=live.session){return cleanStudy(courseStates[live.courseId]?.sessionStudies?.[file]||{});}
 function courseSessions(){
  if(live.courseId===FREE_ID)return freeSessionList();
  const map=new Map();
  for(const s of courseStates[live.courseId]?.sessions||[]){
   if(s?.path&&fs.existsSync(s.path))map.set(s.path,{path:s.path,started:s.started||sessionStartedFromPath(s.path),preview:s.preview||''});
  }
  if(live.session){
   const prev=map.get(live.session);
   const exists=fs.existsSync(live.session);
   map.set(live.session,{path:live.session,started:prev?.started||sessionStartedFromPath(live.session)||Date.now(),preview:prev?.preview||(exists?previewFile(live.session):'')});
  }
  return [...map.values()].map(s=>({...s,...sessionInfo(s.path)})).sort((a,b)=>(b.started||0)-(a.started||0)).map(s=>({...s,label:engineLabelPrefix(s.engine)+formatSessionLabel(s)}));
 }
 function rememberSession(){
  if(!live.session)return;
  const list=(courseStates[live.courseId]?.sessions||[]).filter(s=>s.path&&s.path!==live.session&&fs.existsSync(s.path));
  list.push({path:live.session,started:sessionStartedFromPath(live.session)||Date.now(),preview:fs.existsSync(live.session)?previewFile(live.session):''});
  courseStates[live.courseId]={...(courseStates[live.courseId]||{}),sessions:list};
 }
 function persist(force=false){
  if(live.freeMutation&&!force){live.deferredPersist=true;return;}
  if(live.courseId===FREE_ID){
   /* O store é um arquivo externo: um workspace.json ilegível não pode derrubar
      o save do app inteiro — o erro fica no log e o boot/`recover` cuida. */
   try{persistFreeSession();}catch(error){appendLog('free',`persist da sessão Livre falhou: ${error.message}`);}
  }else if(live.courseId){
   const previous=courseStates[live.courseId]||{};
   const sessionStudies={...(previous.sessionStudies||{}),[live.session]:cleanStudy(live.state.study)};
   const sessionLayouts={...(previous.sessionLayouts||{}),[live.session]:chatState.capture({...live.state,study:cleanStudy(live.state.study)})};
   courseStates[live.courseId]={pdfs:live.state.pdfs,referenceVisible:live.state.referenceVisible,chatWidth:live.state.chatWidth,calcHeight:live.state.calcHeight,pdfSplit:live.state.pdfSplit,draft:live.state.draft,study:cleanStudy(live.state.study),pdfRotations:live.state.pdfRotations||{},sessionStudies,sessionLayouts,session:live.session,sessions:courseSessions()};
   ggbCache.persist(live.courseId,typeof live.state.ggbBase64==='string'?live.state.ggbBase64:'');
  }
  const payload=deskPayload();
  if(payload===live.lastPersist)return;
  live.lastPersist=payload;
  try{fs.writeFileSync(stateFile,payload);}catch(e){console.error(e);}
 }
 function allCourses(){
  return [{id:FREE_ID,name:free.freeCourseName(),kind:'free'},...live.courses.map(course=>({id:course.id,name:course.name,kind:'course'}))];
 }
 /* Payload do desk.json com um courseStates explícito (a promoção grava o
    estado da matéria nova ANTES do commit e restaura byte a byte em falha). */
 function deskPayload(states){
  return JSON.stringify({...live.state,ggbBase64:undefined,session:live.session,courseId:live.courseId,courseStates:states||courseStates,bounds:live.win&&!live.win.isDestroyed()?live.win.getBounds():live.state.bounds});
 }
 function applyCourse(id){
  if(id===FREE_ID){applyFreeCourse();return;}
  const selected=live.courses.find(c=>c.id===id);
  live.courseId=selected?id:'';
  live.course=selected?.path||'';
  const saved=sanitizeCourseState(courseStates[live.courseId]);
  live.session=saved.session||path.join(runtime,`pi-${Date.now()}.jsonl`);
  const restoredStudy=cleanStudy(saved.sessionStudies?.[live.session]||saved.study);
  const ggbSaved=ggbCache.read(live.courseId)||saved.ggbBase64||'';
  ggbCache.remember(live.courseId,ggbSaved);
  const layout=deskLayout({...saved,theme:live.state.theme});
  live.state={...live.state,pdfs:saved.pdfs||[],pdfRotations:saved.pdfRotations||{},referenceVisible:layout.referenceVisible,chatWidth:layout.chatWidth,calcHeight:layout.calcHeight,pdfSplit:layout.pdfSplit,draft:layout.draft,theme:layout.theme,ggbBase64:ggbSaved,study:restoredStudy};
  ggb.resetRestored();
 }
 /* Registro de retomada da matéria ativa (o cartão do "Encerrar por hoje"). O
    `.xopp` guardado volta a ser autorizado como o da questão — sem o arquivo, o
    Retomar não o traz de volta — e só entram as páginas que a biblioteca desta
    matéria conhece. Nunca escreve. */
 function resumePayload(){
  const saved=resume.readResume(runtime,live.courseId);
  if(!saved)return null;
  const xopp=saved.xopp?cleanStudy({title:'',xopp:saved.xopp}).xopp:'';
  if(xopp)allowedXopp.add(xopp);
  return {...saved,xopp,pages:saved.pages.filter(ref=>allowed.has(ref.path))};
 }
 /* Favoritos nomeados da matéria ativa — só os documentos que a biblioteca (ou
    o estado) autoriza, como o resume faz com as páginas. O popover do leitor sai
    daqui. Nunca escreve. */
 /* Uma referência ausente continua visível: a questão e a tentativa ainda
    pertencem ao caderno, mesmo quando o PDF mudou de lugar. */
 function reviewPayload(){
  return review.annotateVisibility(review.readItems(runtime,live.courseId),allowed);
 }
 function bookmarksPayload(){
  return bookmarks.readBookmarks(runtime,live.courseId).filter(item=>allowed.has(item.path));
 }
 /* Último modelo de PDF escolhido, por matéria e por sessão Livre — estado de
    interface (desk.json), fora do config.json. Só é lembrado ao SALVAR o PDF:
    Cancelar descarta a troca. */
 function pdfModelKey(){return live.courseId===FREE_ID?`free:${live.freeSessionId||''}`:`course:${live.courseId}`;}
 function lastPdfModel(){return live.state.pdfModels?.[pdfModelKey()]||null;}
 /** @param {{model?: string, options?: object}} [choice] */
 function rememberPdfModel({model,options}={}){
  if(!materialModel.isKnownModel(model))return;
  const id=materialModel.modelId(model),key=pdfModelKey();
  const next={...(live.state.pdfModels||{})};delete next[key];
  next[key]={model:id,options:materialModel.normalizeOptions(id,options)};
  live.state={...live.state,pdfModels:materialModel.sanitizeMemory(next)};
  persist();
 }
 function materialContext(){return live.courseId===FREE_ID?'':(live.courses.find(c=>c.id===live.courseId)?.name||'');}
 function coursePdfDraft(){try{return courseMaterials.getDraft(runtime,{courseId:live.courseId,session:live.session});}catch(error){appendLog('tutor-pdf',error.message);return null;}}
 function initialData(){
  const freeActive=live.courseId===FREE_ID;
  const record=freeActive?free.findWorkspace(runtime,live.freeSessionId):null;
  /* Em Livre a biblioteca é SÓ o manifesto da sessão: nada de varrer pasta de
    matéria nem herdar fontes de outro curso. */
  const library=freeActive?((record?.materials||[]).map(material=>({name:material.name,path:material.path}))):(live.course?courseLibrary(live.course):[]);
  allowed.clear();
  for(const p of library)allowed.add(p.path);
  for(const p of live.state.pdfs||[])if(p?.path&&fs.existsSync(p.path))allowed.add(p.path);
  allowedXopp.clear();live.state.study=authorizeRestoredStudy(live.state.study,allowedXopp);
  const cfg=normalize(live.config);
  return {
   library,state:live.state,
   course:freeActive?free.freeCourseName():(live.courses.find(c=>c.id===live.courseId)?.name||''),
   courseId:live.courseId,courses:allCourses(),
   workspace:freeActive?freeWorkspacePayload(record):{kind:'course',id:live.courseId},
   pdfDraft:freeActive?null:coursePdfDraft(),
   pdfModel:lastPdfModel(),
   session:live.session,sessions:courseSessions(),...conversationData(),
   /* Fila e bandeja guardadas desta conversa: o renderer hidrata a faixa e os
      anexos com isto (a troca de conversa devolve o que era da outra). */
   pending:pending.readPending(runtime,live.session),
   /* Registro do Encerrar da matéria: o "onde parei" da coluna sai daqui. Em Livre
      não há matéria, então o cartão e os favoritos ficam vazios. */
   resume:freeActive?null:resumePayload(),
   bookmarks:freeActive?[]:bookmarksPayload(),
   review:freeActive?[]:reviewPayload(),
   config:cfg,
   preferred:freeActive?[]:(pickPdfs(library,cfg.desk.panels)||[]).map(p=>p?.path||null),
   needsSetup:needsSetup(live.config,live.courses),
   captureAvailable:captureAvailable(),
   detectedPi:piBinary(),
   platform:process.platform,
   language:live.languageHost.payload(),
   deskVersion:deskVersionLabel()
  };
 }
 return {sessionStudy,courseSessions,rememberSession,persist,allCourses,deskPayload,applyCourse,resumePayload,reviewPayload,bookmarksPayload,pdfModelKey,lastPdfModel,rememberPdfModel,materialContext,coursePdfDraft,initialData};
}

module.exports={createCourseStateHost};
