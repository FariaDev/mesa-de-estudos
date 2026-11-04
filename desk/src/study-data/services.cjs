'use strict';
const search=require('./search.cjs');
const materialSearch=require('./material-search.cjs');
const notes=require('./annotations.cjs');
const stats=require('./statistics.cjs');
const schedule=require('./review-schedule.cjs');
const review=require('../../review.cjs');
const courseNotes=require('./course-notes.cjs');
const free=require('../../free-workspaces.cjs');
const fs=require('node:fs');
const path=require('node:path');
const {message}=require('../i18n.mjs');

const MAX_LISTED_MATERIALS=200;
const sameFree=entry=>entry?.courseId===search.FREE_COURSE_ID?String(entry.freeSessionId||''):'';
/* A concessão capturada no grant só vale enquanto a sessão for a mesma: um
   token antigo não lista nem grava na matéria que o aluno abriu depois. */
const sameScope=(provided,current)=>!!provided&&provided.courseId===current.courseId&&sameFree(provided)===sameFree(current);

/* O host fornece escopo e biblioteca atuais; nenhum payload amplia acesso. */
/**
 * @param {{runtime: () => string, courses: () => Array<{id: string, name: string}>,
 *   scope: () => {courseId: string, conversation: string, freeSessionId: string},
 *   allowed: () => Set<string>, persist: () => void, log?: (scope: string, line: string) => void}} options
 */
function createStudyServices({runtime,courses,scope,allowed,persist,log=()=>{}}){
 const options=()=>({courses:courses()});
 const safe=fn=>{try{return fn();}catch(error){log('study',error.message);return null;}};
 const reviewOptions=()=>({courseId:scope().courseId,today:schedule.localDay(Date.now()),exists:fs.existsSync,allowed:file=>allowed().has(file)});
 /* O cronômetro acompanha o estudo (#70): antes ele só ligava pelo botão das
    Estatísticas, ficava em "Pausado" para sempre e o tempo nunca contava. Com
    a janela à vista numa matéria, a sessão liga ou continua; trocar de matéria
    fecha a sessão da anterior. A pausa do aluno (`held`) segura tudo. */
 const followCourse=visible=>{
  const courseId=scope().courseId;
  let timer=stats.timerOf(stats.readStore(runtime()));
  if(timer.running&&timer.courseId!==courseId)timer=stats.control(runtime(),{action:'stop',courseId:timer.courseId});
  if(timer.running||timer.held||!visible||!courses().some(course=>course.id===courseId))return timer;
  return stats.control(runtime(),{action:timer.startedAt&&timer.courseId===courseId?'resume':'start',courseId});
 };
 const syncReview=()=>{const opts=reviewOptions();schedule.sync(runtime(),{...opts,items:review.readItems(runtime(),opts.courseId)});return opts;};
 return {
  search:payload=>{persist();return search.search(runtime(),{...payload,...options()});},
  /* O tutor busca só na matéria da sessão (e, na Livre, só na sessão atual).
     O grant da atividade carrega a sessão Livre mesmo numa matéria; ela só
     conta quando o curso É a Livre. */
  materialSearch:async(provided,payload)=>{
   const current=scope();
   const freeOf=entry=>entry?.courseId===search.FREE_COURSE_ID?String(entry.freeSessionId||''):'';
   if(provided&&(provided.courseId!==current.courseId||freeOf(provided)!==freeOf(current)))throw Error(message('err.searchTool.sessionChanged'));
   persist();
   return materialSearch.tutorSearch(runtime(),{courses:courses(),courseId:current.courseId,freeSessionId:current.freeSessionId,raw:payload});
  },
  /* Lista de PDFs da biblioteca da sessão (matéria ou Livre). O caminho sai
     canônico e a lista é a MESMA que `ler_pdf` já autoriza; o modelo não manda
     pasta nem amplia escopo. */
  materialList:provided=>{
   const current=scope();
   if(provided&&!sameScope(provided,current))throw Error(message('err.materials.sessionChanged'));
   const byPath=new Map();
   for(const file of allowed()){
    if(typeof file!=='string'||!/\.pdf$/i.test(file))continue;
    try{
     const real=fs.realpathSync(file);
     if(path.extname(real).toLowerCase()!=='.pdf'||!fs.statSync(real).isFile())continue;
     if(!byPath.has(real))byPath.set(real,{name:path.basename(real),path:real});
    }catch{/* PDF que sumiu da biblioteca não entra na lista */}
   }
   const materials=[...byPath.values()].sort((a,b)=>a.name.localeCompare(b.name)||a.path.localeCompare(b.path));
   return {materials:materials.slice(0,MAX_LISTED_MATERIALS),truncated:materials.length>MAX_LISTED_MATERIALS};
  },
  /* Nota do tutor (#91): a raiz é a matéria ou o workspace da Livre; a gravação
     (realpath, `O_EXCL`, sem sobrescrever) mora em `course-notes.cjs`. */
  noteSave:(provided,payload)=>{
   const current=scope();
   if(provided&&!sameScope(provided,current))throw Error(message('err.note.sessionChanged'));
   const root=current.freeSessionId
    ?free.workspaceDir(runtime(),current.freeSessionId)
    :(courses().find(course=>course.id===current.courseId)?.path||'');
   if(!root)throw Error(message('err.note.badRoot'));
   return courseNotes.saveNote({root,title:payload?.titulo,content:payload?.conteudo});
  },
  catalog:()=>search.catalog(runtime(),options()),
  resolve:id=>search.resolve(runtime(),id,options()),
  notesRead:()=>({scope:notes.scopeOf(scope()),items:notes.readNotes(runtime(),scope())}),
  notesSave:payload=>({scope:notes.scopeOf(scope()),items:notes.saveNote(runtime(),scope(),{...payload,authorizedPaths:[...allowed()]})}),
  notesRemoveWithUndo:payload=>notes.notesRemoveWithUndo(runtime(),scope(),{mode:'remove',key:payload?.key,id:payload?.id,item:payload?.item,authorizedPaths:[...allowed()]}),
  notesUndo:payload=>notes.notesUndo(runtime(),scope(),{token:payload?.token,authorizedPaths:[...allowed()]}),
  reviewToday:()=>{const opts=syncReview();return {items:schedule.dueItems(runtime(),opts),all:schedule.listItems(runtime(),opts).filter(item=>item.active),summary:schedule.summary(runtime(),opts)};},
  reviewGrade:payload=>schedule.grade(runtime(),{id:payload?.id,result:payload?.result,...syncReview()}),
  statsSummary:payload=>stats.summary(runtime(),{period:payload?.period,courseId:payload?.courseId&&courses().some(c=>c.id===payload.courseId)?payload.courseId:''}),
  statsControl:payload=>stats.control(runtime(),{action:payload?.action,courseId:scope().courseId,by:'user'}),
  statsReset:payload=>stats.reset(runtime(),{confirm:payload?.confirm===true}),
  beat:visible=>safe(()=>{const timer=followCourse(visible);if(!timer?.running)return;return stats.recordActivity(runtime(),{id:require('node:crypto').randomUUID(),courseId:timer.courseId,running:true,visible});}),
  lifecycle:kind=>safe(()=>stats.recordLifecycle(runtime(),{id:require('node:crypto').randomUUID(),kind})),
  /** @param {{id: string, engine: string, model?: string}} prompt */
  accepted:({id,engine,model})=>safe(()=>stats.recordPrompt(runtime(),{id,engine,model,courseId:scope().courseId,accepted:true})),
  usage:payload=>safe(()=>stats.recordUsage(runtime(),{...payload,courseId:scope().courseId})),
 };
}
module.exports={createStudyServices};
