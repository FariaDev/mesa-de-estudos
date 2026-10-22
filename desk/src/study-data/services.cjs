'use strict';
const search=require('./search.cjs');
const notes=require('./annotations.cjs');
const stats=require('./statistics.cjs');
const schedule=require('./review-schedule.cjs');
const review=require('../../review.cjs');
const fs=require('node:fs');

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
