// @ts-check
'use strict';

const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const conversations=require('./src/agents/conversations.cjs');
const free=require('./free-workspaces.cjs');
const freePromotion=require('./free-promotion.cjs');
const {mergeCourses}=require('./courses.cjs');
const {normalize}=require('./config.cjs');
const {cleanStudy}=require('./study.cjs');
const {deskLayout}=require('./state-adapter.cjs');
const {sanitizeCourseState}=require('./desk-state-sanitize.cjs');
const {writeConfigPreservingExtras}=require('./config-write.cjs');
const {message}=require('./src/i18n.mjs');

/* Promoção Livre → matéria (#43 fase 2: saiu do main.cjs): transação com o
   diário externo (`free-promotion.cjs`). Ordem: prepare do store (staging +
   destino novo) → diário com backups byte a byte → config + descritor
   Claude + desk.json → commit do store (rename + recibo) → diário concluído.
   Qualquer falha desfaz SÓ o destino novo e restaura os arquivos. O
   `courseId` dentro de runFreePromotion é o da matéria NOVA (local). */

/**
 * Cria a promoção sobre o estado vivo do main (config, matérias, estado, sessão).
 * Recebe o `live`, caminhos da config e do desk.json, o mapa de estados por
 * matéria e as funções do main que a adoção pós-commit chama.
 * @param {{live: import('./main.cjs').DeskLive, runtime: string, configFile: string, stateFile: string, persistConfig: boolean,
 *   courseStates: Record<string, import('./types/desk-state').CourseState>, allowedXopp: Set<string>,
 *   ggbCache: import('./types/main-hosts').GgbCache, appendLog: import('./types/host-deps').AppendLog,
 *   freeEntryOf: import('./types/main-hosts').FreeSessionHost['freeEntryOf'],
 *   previewFile: import('./types/main-hosts').TutorEngineHost['previewFile'], engine: import('./types/main-hosts').TutorEngineHost['engine'], stopBridge: import('./types/main-hosts').TutorBridgeHost['stopBridge'],
 *   applyCourse: import('./types/main-hosts').CourseStateHost['applyCourse'], persist: import('./types/main-hosts').CourseStateHost['persist']}} options
 * @returns {{runFreePromotion:(args:{record:object, parentDir:string, name:string})=>Promise<{course:object}>}}
 * @example const {runFreePromotion}=createFreePromotionHost({live,runtime,configFile,stateFile,...});
 */
function createFreePromotionHost({live,runtime,configFile,stateFile,persistConfig,courseStates,allowedXopp,ggbCache,appendLog,freeEntryOf,previewFile,engine,stopBridge,applyCourse,persist}){
 /* Snapshot do desk.json como se a matéria nova já fosse a ATIVA: o crash entre
    o journal e a adoção em memória precisa acordar no curso promovido, com os
    caminhos mapeados — nunca com o estado solto da sessão Livre. */
 function deskSnapshotForCourse(courseIdValue,courseStateValue,states){
  const saved=sanitizeCourseState(courseStateValue);
  const layout=deskLayout({...saved,theme:live.state.theme});
  return JSON.stringify({...live.state,ggbBase64:undefined,
   session:saved.session||'',
   courseId:courseIdValue,
   draft:layout.draft,
   study:cleanStudy(saved.study),
   pdfs:saved.pdfs||[],
   pdfRotations:saved.pdfRotations||{},
   referenceVisible:layout.referenceVisible,
   chatWidth:layout.chatWidth,
   calcHeight:layout.calcHeight,
   pdfSplit:layout.pdfSplit,
   theme:layout.theme,
   courseStates:states||courseStates,
   bounds:live.win&&!live.win.isDestroyed()?live.win.getBounds():live.state.bounds});
 }
 function uniqueCourseId(){
  for(let attempt=0;attempt<8;attempt++){
   const id=crypto.randomUUID();
   if(live.courses.some(course=>course.id===id))continue;
   if(free.findByCourseId(runtime,id))continue;
   return id;
  }
  throw Error(message('err.course.noId'));
 }
 /* Promoção Livre → matéria: transação com o diário externo. Ordem: prepare do
    store (staging + destino novo) → diário com backups byte a byte → config +
    descritor Claude + desk.json → commit do store (rename + recibo) → diário
    concluído. Qualquer falha desfaz SÓ o destino novo e restaura os arquivos. */
 async function runFreePromotion({record,parentDir,name}){
  const plan=free.preparePromotion(runtime,record.id,{parentDir,name});
  let txn=null,committed=false;
  let courseId,courseName,folderPath='',nativePath,canWriteConfig,courseEntry,courseState;
  try{
   courseId=uniqueCourseId();
   courseName=name.trim().slice(0,free.maxName())||plan.folderName;
   folderPath=plan.folderPath;
   const materialMap=new Map();
   record.materials.forEach((material,index)=>{
    const staged=plan.materials[index];
    if(staged)materialMap.set(material.path,path.join(folderPath,free.MATERIALS_DIR,staged.name));
   });
   const entry=freeEntryOf(record.id);
   const saved=sanitizeCourseState(entry);
   const pdfs=[];
   const seen=new Set();
   for(const item of saved.pdfs||[]){
    const target=item?.path?materialMap.get(item.path):'';
    if(!target||seen.has(target))continue;
    seen.add(target);
    pdfs.push({...item,path:target});
   }
   const pdfRotations={};
   for(const [from,rotation] of Object.entries(saved.pdfRotations||{})){
    const target=materialMap.get(from);
    if(target)pdfRotations[target]=rotation;
   }
   nativePath=record.nativePath||live.session;
   const started=Date.parse(record.createdAt)||Date.now();
   let preview='';
   try{if(nativePath&&fs.existsSync(nativePath))preview=previewFile(nativePath);}catch{/* sem prévia da sessão */}
   const study=cleanStudy(live.state.study);
   courseState={
    pdfs,pdfRotations,
    session:nativePath,
    sessions:[{path:nativePath,started,preview}],
    sessionStudies:{[nativePath]:study},
    draft:typeof live.state.draft==='string'?live.state.draft:'',
    study,
    referenceVisible:live.state.referenceVisible,
    chatWidth:live.state.chatWidth,
    calcHeight:live.state.calcHeight,
    pdfSplit:live.state.pdfSplit,
    ggbBase64:typeof live.state.ggbBase64==='string'?live.state.ggbBase64:''
   };
   courseEntry={id:courseId,name:courseName,path:folderPath};
   const kind=engine();
   const descriptorFile=kind==='claude'?nativePath:'';
   canWriteConfig=persistConfig||fs.existsSync(configFile);
   const files=[{label:'desk',file:stateFile}];
   if(canWriteConfig)files.push({label:'config',file:configFile});
   if(descriptorFile)files.push({label:'descriptor',file:descriptorFile});
   txn=freePromotion.begin(runtime,{
    token:plan.token,freeSessionId:record.id,courseId,courseName,
    folderPath,folderName:plan.folderName,stagingPath:plan.stagingPath,parentDir:plan.parentDir,
    nativePath,engine:kind,descriptorFile,configFile:canWriteConfig?configFile:'',deskFile:stateFile,
    activeCourseId:courseId,activeSession:nativePath,
    courseEntry,courseState,files
   });
   txn.mark('applying');
   if(canWriteConfig)writeConfigPreservingExtras(configFile,{...live.config,courses:[...live.config.courses,courseEntry]});
   if(descriptorFile)conversations.updateClaudeConversation(descriptorFile,{courseId},{runtime});
   fs.writeFileSync(stateFile,deskSnapshotForCourse(courseId,courseState,{...courseStates,[courseId]:courseState}));
   txn.mark('committing');
   free.commitPromotion(runtime,record.id,{token:plan.token,courseId,courseName});
   /* Ponto de virada durável: depois do recibo do store a promoção está feita.
      Nada aqui pode voltar atrás — se o diário não puder ser removido/finalizado,
      o boot conclui para frente (`recover` em `committing`/`committed`). */
   committed=true;
   try{txn.mark('committed');}catch(error){appendLog('free',`diário da promoção ${plan.token} não avançou: ${error.message}`);}
   try{txn.finish();}catch(error){appendLog('free',`diário da promoção ${plan.token} não foi removido: ${error.message}`);}
  }catch(error){
   if(!committed){
    if(txn){try{txn.rollback({store:free});}catch(rollbackError){appendLog('free',`rollback da promoção falhou: ${rollbackError.message}`);}}
    else{try{free.rollbackPromotion(runtime,record.id);}catch(rollbackError){appendLog('free',`rollback da promoção falhou: ${rollbackError.message}`);}}
   }
   throw error;
  }
  /* Adoção em memória pós-commit, best-effort: matéria na config, `courseState`
     com os caminhos NOVOS (inclusive `pdfRotations`) e o curso ativo passa a ser
     a matéria nova. Erro aqui NÃO pode virar rollback (o diário já foi
     consumido); o boot lê o snapshot já coerente escrito antes do commit. */
  try{
   live.config=canWriteConfig?normalize({...live.config,courses:[...live.config.courses,courseEntry]}):{...live.config,courses:[...live.config.courses,courseEntry]};
   live.courses=mergeCourses(live.config);
   courseStates[courseId]=sanitizeCourseState(courseState);
   /* A ponte da sessão Livre não pode sobreviver à promoção: reutilizá-la
      manteria cwd/prompt/descritor do Livre no motor da matéria nova. Para e
      deixa o renderer reconectar com o contexto da matéria (mesma sessão). */
   stopBridge();live.lastContextKey='';allowedXopp.clear();applyCourse(courseId);
   try{ggbCache.persist(courseId,typeof courseState.ggbBase64==='string'?courseState.ggbBase64:'');}catch{/* best-effort: o erro aqui não pode virar rollback (o diário já foi consumido) */}
   persist();
  }catch(error){
   appendLog('free',`promoção concluída; adoção parcial: ${error.message}`);
  }
  return {course:{id:courseId,name:courseName,path:folderPath}};
 }
 return {runFreePromotion};
}

module.exports={createFreePromotionHost};
