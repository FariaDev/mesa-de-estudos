const {app,BrowserWindow,ipcMain,dialog,shell,Menu,screen,systemPreferences,nativeImage,WebContentsView,Notification}=require('electron');
const http=require('node:http');const crypto=require('node:crypto');
const fs=require('node:fs');const path=require('node:path');const os=require('node:os');
const {promisify}=require('node:util');const {execFile,execFileSync}=require('node:child_process');
const execFileAsync=promisify(execFile);
const {PiBridge,DESK_PROMPT}=require('./rpc.cjs');
const {placeWindow,chooseXournal,sessionStartedFromPath,formatSessionLabel,sessionPreviewFromJsonl,imageCandidates}=require('./lib.cjs');
const {courseLibrary,mergeCourses}=require('./courses.cjs');
const {readConfig,writeConfig,seedConfig,needsSetup,normalize,pickPdfs}=require('./config.cjs');
const {resolvePi,spawnEnv,FALLBACK_LEVELS,loadLevelsModule}=require('./pi.cjs');
const {cleanStudy,authorizeRestoredStudy}=require('./study.cjs');
const {buildStudyContext}=require('./studycontext.cjs');
const pending=require('./pending.cjs');
const resume=require('./resume.cjs');
const bookmarks=require('./bookmarks.cjs');
const review=require('./review.cjs');
const {pinnedArgs}=require('./profiles.cjs');
const {claimHand,recoverClaims}=require('./handoff.cjs');
const {deliverPrompt}=require('./send.cjs');
const {deskLayout,saveState,MAX_DRAFT}=require('./state-adapter.cjs');
const updater=require('./updater.cjs');
const components=require('./components.cjs');
const {captureXournalWindow}=require('./capture-win.cjs');

app.setName('Mesa de Estudos');
const deskDir=__dirname;
const envRuntime=process.env.LEARNING_DESK_RUNTIME;
const envVault=process.env.LEARNING_VAULT;
const persistConfig=!envRuntime;

function defaultUserData(){
 try{return app.getPath('userData');}catch{return path.join(os.homedir(),'.mesa-de-estudos');}
}

const configDir=envRuntime||defaultUserData();
fs.mkdirSync(configDir,{recursive:true});
const configFile=path.join(configDir,'config.json');
let config=readConfig(configFile);
if(!config){
 if(envVault)config=normalize({vaultPath:envVault,runtimePath:envRuntime||'',piPath:process.env.LEARNING_DESK_PI||'',xournalPath:'',courses:[]});
 else{
  config=seedConfig({runtimePath:envRuntime||''});
  if(persistConfig&&(config.vaultPath||config.courses.length))writeConfig(configFile,config);
 }
}
if(envVault)config.vaultPath=envVault;
if(process.env.LEARNING_DESK_PI)config.piPath=process.env.LEARNING_DESK_PI;

const runtime=envRuntime||config.runtimePath||path.join(configDir,'runtime');
fs.mkdirSync(runtime,{recursive:true});
const learningRoot=path.join(runtime,'learning');

const ggbDir=path.join(runtime,'ggb');const ggbWritten=new Map();
function persistGgb(id,value){
 if(!id)return;
 const file=path.join(ggbDir,`${id}.b64`);
 if(!value){if(ggbWritten.has(id)){try{fs.rmSync(file,{force:true});}catch{}ggbWritten.delete(id);}return;}
 if(ggbWritten.get(id)===value)return;
 try{fs.mkdirSync(ggbDir,{recursive:true});fs.writeFileSync(file,value);ggbWritten.set(id,value);}catch{}
}
function readGgbFile(id){
 if(!id)return '';
 try{
  const text=fs.readFileSync(path.join(ggbDir,`${id}.b64`),'utf8').trim();
  return text&&text.length<=400000&&/^[A-Za-z0-9+/=\r\n]+$/.test(text)?text:'';
 }catch{return '';}
}
const logFile=path.join(runtime,'desk.log');let logSize=0;try{logSize=fs.statSync(logFile).size;}catch{}
function appendLog(src,line){
 try{
  const text=String(line??'').replace(/\s+$/,'').slice(0,4000);
  if(!text)return;
  if(logSize>262144){try{fs.renameSync(logFile,`${logFile}.1`);}catch{}logSize=0;}
  const entry=JSON.stringify({t:new Date().toISOString(),src,line:text})+'\n';
  fs.appendFileSync(logFile,entry);
  logSize+=Buffer.byteLength(entry);
 }catch{}
}
process.on('uncaughtException',e=>{try{appendLog('main',e&&(e.stack||e.message)||String(e));}catch{}});
process.on('unhandledRejection',e=>{try{appendLog('main',e&&(e.stack||e.message)||String(e));}catch{}});
for(const goneEvent of ['child-process-gone','render-process-gone'])app.on(goneEvent,details=>{try{appendLog(goneEvent,`processo ${details?.type||''} reason=${details?.reason||''} exitCode=${details?.exitCode}`);}catch{}});

let deskVersionMemo=null;
function deskVersionLabel(){
 if(deskVersionMemo!=null)return deskVersionMemo;
 let version='';
 try{version=app.getVersion()||'';}catch{}
 if(!version){try{version=require('./package.json').version||'';}catch{}}
 let suffix='';
 try{
  const repoRoot=path.join(deskDir,'..');
  if(version&&fs.existsSync(path.join(repoRoot,'.git')))suffix=execFileSync('git',['describe','--always','--dirty'],{cwd:repoRoot,timeout:5000}).toString().trim();
 }catch{}
 deskVersionMemo=suffix?`${version} ${suffix}`:version;
 return deskVersionMemo;
}

const IMAGE_MIME={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',gif:'image/gif',webp:'image/webp',svg:'image/svg+xml'};
app.setPath('userData',path.join(runtime,'electron'));

const stateFile=path.join(runtime,'desk.json');let state={};try{state=JSON.parse(fs.readFileSync(stateFile,'utf8'));}catch{}
/* Estado lido é dado não confiável (arquivo editado à mão, versão antiga ou
   gravação interrompida). A normalização de tipos acontece ANTES de
   `initialData()`/`applyCourse()`: `init` não pode rejeitar por estado
   corrompido, e o próximo save regrava o estado sanado. Campos desconhecidos
   seguem intactos — só os que o host itera/consome viram o tipo esperado. */
function isPlainObject(value){return !!value&&typeof value==='object'&&!Array.isArray(value);}
function asString(value){return typeof value==='string'?value:'';}
function asArray(value){return Array.isArray(value)?value:[];}
function asBounds(value){
 if(!isPlainObject(value))return undefined;
 const x=value.x,y=value.y,width=value.width,height=value.height;
 const finite=n=>typeof n==='number'&&Number.isFinite(n);
 if(!finite(x)||!finite(y)||!finite(width)||!finite(height)||width<=0||height<=0)return undefined;
 return {x,y,width,height};
}
function sanitizeCourseState(value){
 const source=isPlainObject(value)?value:{};
 return {...source,
  pdfs:asArray(source.pdfs),
  sessions:asArray(source.sessions).filter(entry=>isPlainObject(entry)&&typeof entry.path==='string'&&entry.path),
  session:asString(source.session),
  sessionStudies:isPlainObject(source.sessionStudies)?source.sessionStudies:{},
  study:isPlainObject(source.study)?source.study:{},
  ggbBase64:asString(source.ggbBase64)};
}
function sanitizeState(value){
 const source=isPlainObject(value)?value:{};
 const out={...source,
  pdfs:asArray(source.pdfs),
  session:asString(source.session),
  study:isPlainObject(source.study)?source.study:{},
  ggbBase64:asString(source.ggbBase64),
  courseStates:{}};
 const states=isPlainObject(source.courseStates)?source.courseStates:{};
 for(const [id,entry] of Object.entries(states)){if(id==='__proto__')continue;out.courseStates[id]=sanitizeCourseState(entry);}
 const bounds=asBounds(source.bounds);
 if(bounds)out.bounds=bounds;else delete out.bounds;
 return out;
}
state=sanitizeState(state);
{
 const saved=deskLayout(state);
 state.draft=saved.draft;state.theme=saved.theme;state.referenceVisible=saved.referenceVisible;
 state.chatWidth=saved.chatWidth;state.calcHeight=saved.calcHeight;state.pdfSplit=saved.pdfSplit;
}
const pendingDialogs=new Set();const liveNotifications=new Set();
let courses=mergeCourses(config);
let courseId=courses.some(c=>c.id===state.courseId)?state.courseId:(courses.find(c=>c.id==='Calculus I')?.id||courses[0]?.id||'');
let course=courses.find(c=>c.id===courseId)?.path||'';
const courseStates=state.courseStates||{};
state.ggbBase64=state.ggbBase64||readGgbFile(courseId);
ggbWritten.set(courseId,typeof state.ggbBase64==='string'?state.ggbBase64:'');
const allowed=new Set(),allowedXopp=new Set();let win,bridge,lastPersist='',levelsMod;const pdfDisk=new Map();
const TEST_MODE=process.env.DESK_TEST==='1';
if(!TEST_MODE){if(!app.requestSingleInstanceLock())app.quit();app.on('second-instance',()=>{if(win){if(win.isMinimized())win.restore();win.show();win.focus();}});}
let session=state.session||path.join(runtime,`pi-${Date.now()}.jsonl`);let ggbRestored=false;
/* Chave do último bloco de contexto enviado nesta sessão: contexto igual não é
   reenviado (o histórico já carrega a versão anterior). Zera quando a conversa
   troca, porque aí o histórico que "já tem" é outro. */
let lastContextKey='';
/* Bilhete da Conversa → Mesa. O bilhete fica na MÃO do app (`claimHand`,
   desk/handoff.cjs) até a entrega ter desfecho: enquanto ele está na mão, a
   mensagem seguinte leva o mesmo bloco, e uma recusa não o perde. Não existe
   "checado uma vez por execução": a Conversa pode escrever o bilhete DEPOIS da
   primeira mensagem da Mesa, então cada prompt procura um pendente — mas só
   quando nenhum está na mão. Antes de escrever no Pi, `deliverPrompt`
   (desk/send.cjs) persiste a fase "envio iniciado" no próprio arquivo
   (`beginDelivery`): a partir daí uma queda no meio do envio não devolve o
   bilhete à fila. O destino do arquivo em cada desfecho é decidido por
   `deliverPrompt` sobre `settleDelivery`: é nos dois que isso é testado, não
   aqui. */
const hand=claimHand({runtime});
function handoffProblem(reason){
 if(!reason)return;
 console.warn('[bilhete]',reason);
 if(win&&!win.isDestroyed())win.webContents.send('handoff-problem',{reason});
}
function claimHandoff(){
 const out=hand.take();
 handoffProblem(out.problem);
 if(out.fresh&&out.claim&&win&&!win.isDestroyed()){
  const b=out.claim.bilhete||{};
  win.webContents.send('handoff-received',{goal:b.goal||'',question:b.question||'',stale:!!out.claim.stale});
 }
 return out.claim;
}

function sessionStudy(file=session){return cleanStudy(courseStates[courseId]?.sessionStudies?.[file]||{});}

function piBinary(){return resolvePi({configPath:config.piPath,deskDir,envPath:process.env.LEARNING_DESK_PI||''});}
function captureHelper(){return [path.join(__dirname,'..','visual-check','windows'),config.vaultPath&&path.join(config.vaultPath,'Code','learning-canvas','visual-check','windows')].filter(Boolean).find(p=>fs.existsSync(p));}
/* A captura existe no macOS (helper visual-check + screencapture -l) e no
   Windows (PowerShell/.NET do sistema — capture-win.cjs); fora disso, some. */
function captureAvailable(){return process.platform==='win32'||(process.platform==='darwin'&&!!captureHelper());}

function previewFile(file){
 try{return sessionPreviewFromJsonl(fs.readFileSync(file,'utf8').slice(0,200000));}catch{return '';}
}
function courseSessions(){
 const map=new Map();
 for(const s of courseStates[courseId]?.sessions||[]){
  if(s?.path&&fs.existsSync(s.path))map.set(s.path,{path:s.path,started:s.started||sessionStartedFromPath(s.path),preview:s.preview||''});
 }
 if(session){
  const prev=map.get(session);
  const exists=fs.existsSync(session);
  map.set(session,{path:session,started:prev?.started||sessionStartedFromPath(session)||Date.now(),preview:prev?.preview||(exists?previewFile(session):'')});
 }
 return [...map.values()].sort((a,b)=>(b.started||0)-(a.started||0)).map(s=>({...s,label:formatSessionLabel(s)}));
}
function rememberSession(){
 if(!session)return;
 const list=(courseStates[courseId]?.sessions||[]).filter(s=>s.path&&s.path!==session&&fs.existsSync(s.path));
 list.push({path:session,started:sessionStartedFromPath(session)||Date.now(),preview:fs.existsSync(session)?previewFile(session):''});
 courseStates[courseId]={...(courseStates[courseId]||{}),sessions:list};
}
function persist(){
 if(courseId){
  const previous=courseStates[courseId]||{};
  const sessionStudies={...(previous.sessionStudies||{}),[session]:cleanStudy(state.study)};
  courseStates[courseId]={pdfs:state.pdfs,referenceVisible:state.referenceVisible,chatWidth:state.chatWidth,calcHeight:state.calcHeight,pdfSplit:state.pdfSplit,draft:state.draft,study:cleanStudy(state.study),sessionStudies,session,sessions:courseSessions()};
  persistGgb(courseId,typeof state.ggbBase64==='string'?state.ggbBase64:'');
 }
 const payload=JSON.stringify({...state,ggbBase64:undefined,session,courseId,courseStates,bounds:win&&!win.isDestroyed()?win.getBounds():state.bounds});
 if(payload===lastPersist)return;
 lastPersist=payload;
 try{fs.writeFileSync(stateFile,payload);}catch(e){console.error(e);}
}
function validPdf(p){if(typeof p!=='string'||!allowed.has(p))throw Error('Escolha um PDF pela biblioteca ou pelo seletor.');return p;}
function readableImage(input){
 const roots=[path.dirname(deskDir),deskDir,runtime];
 let base='';
 try{base=fs.realpathSync(learningRoot);}catch{return null;}
 for(const file of imageCandidates(input,{learningRoot,roots})){
  try{
   const real=fs.realpathSync(file);
   if(real!==base&&!real.startsWith(base+path.sep))continue;
   const stat=fs.statSync(real);
   if(!stat.isFile()||stat.size>25*1024*1024)continue;
   const mime=IMAGE_MIME[path.extname(real).slice(1).toLowerCase()];
   if(!mime)continue;
   return {file:real,mime,bytes:fs.readFileSync(real)};
  }catch{}
 }
 return null;
}
const PROMPT_IMAGE=/^data:(image\/png|image\/jpe?g|image\/webp|image\/gif);base64,([A-Za-z0-9+/=]+)$/;
/* Envio de imagens: núcleo Bend (core/attachments.bend). O host mede bytes,
   encolhe (nativeImage) e mapeia o motivo; o núcleo decide tetos e tipos — os
   números vêm de lá, não daqui. */
const attachCore=require('./src/generated/attachments.core.js').default;
const PROMPT_IMAGE_MAX_RAW=attachCore.maxRawBytes(),PROMPT_IMAGE_MAX_SEND=attachCore.maxSendBytes(),PROMPT_IMAGE_MAX_TOTAL=attachCore.maxTotalBytes();
const coreList=xs=>xs.reduceRight((tail,head)=>({$:'Con',head,tail}),{$:'Nil'});
const coreArray=node=>{const out=[];for(let current=node;current&&current.$==='Con';current=current.tail)out.push(current.head);return out;};
const attachMB=bytes=>Math.round(bytes/1024/1024);
const ATTACH_MSG={
 'AttachError.BadType':'Anexo inválido: envie PNG, JPEG, WebP ou GIF.',
 'AttachError.ImageTooLarge':`Imagem grande demais (máx. ${attachMB(PROMPT_IMAGE_MAX_RAW)} MB).`,
 'AttachError.FileTooLarge':'Arquivo de texto grande demais para o envio.',
 'AttachError.ReducedTooLarge':`Não foi possível reduzir a imagem o bastante (máx. ${attachMB(PROMPT_IMAGE_MAX_SEND)} MB por anexo).`,
 'AttachError.TotalTooLarge':`Os anexos somam mais de ${attachMB(PROMPT_IMAGE_MAX_TOTAL)} MB; envie menos imagens.`
};
const attachError=reason=>Error(ATTACH_MSG[reason?.$]||'Anexo inválido.');
function shrinkPromptImage(mime,bytes){
 if(mime==='image/gif'&&bytes.length<=4*1024*1024)return {mime,bytes};
 let image;
 try{image=nativeImage.createFromBuffer(bytes);}catch{return {mime,bytes};}
 if(image.isEmpty())return {mime,bytes};
 const {width,height}=image.getSize();
 const scale=Math.min(1,2000/Math.max(width||1,height||1));
 if(scale>=1&&bytes.length<=4*1024*1024)return {mime,bytes};
 const resized=scale<1?image.resize({width:Math.max(1,Math.round(width*scale)),height:Math.max(1,Math.round(height*scale)),quality:'good'}):image;
 let out;
 try{out=mime==='image/png'?{mime:'image/png',bytes:resized.toPNG()}:{mime:'image/jpeg',bytes:resized.toJPEG(85)};}catch{return {mime,bytes};}
 return out.bytes?.length&&out.bytes.length<bytes.length?out:{mime,bytes};
}
function promptImages(input){
 const facts=[],shrunkList=[];
 let total=0;
 for(const item of (Array.isArray(input)?input:[]).slice(0,4)){
  const raw=typeof item==='string'?item:item?.dataUrl;
  const match=typeof raw==='string'?PROMPT_IMAGE.exec(raw):null;
  let overRaw=false,overSend=false,overTotal=false,shrunk=null;
  if(match){
   const bytes=Buffer.from(match[2],'base64');
   overRaw=!bytes.length||bytes.length>PROMPT_IMAGE_MAX_RAW;
   if(!overRaw){
    const mime=match[1]==='image/jpg'?'image/jpeg':match[1];
    shrunk=shrinkPromptImage(mime,bytes);
    overSend=shrunk.bytes.length>PROMPT_IMAGE_MAX_SEND;
    if(!overSend){total+=shrunk.bytes.length;overTotal=total>PROMPT_IMAGE_MAX_TOTAL;}
   }
  }
  facts.push({$:'SendIn',mime:match?match[1]:'',valid:!!match,overRaw,overSend,overTotal});
  shrunkList.push(shrunk);
 }
 const out=attachCore.promptImages(coreList(facts));
 if(out.$!=='SendResult.Ok')throw attachError(out.reason);
 return coreArray(out.mimes).map((mime,i)=>({type:'image',data:shrunkList[i].bytes.toString('base64'),mimeType:mime}));
}
function prepareCourse(){
 const root=path.join(runtime,'learning');const target=path.join(root,'Courses',courseId||'default');fs.mkdirSync(target,{recursive:true});
 const templates=path.join(__dirname,'templates');
 const pick=(...cands)=>cands.find(p=>p&&fs.existsSync(p));
 const link=(source,dest)=>{if(!source||fs.existsSync(dest)||!fs.existsSync(source))return;try{fs.symlinkSync(source,dest);}catch{fs.cpSync(source,dest,{recursive:true});}};
 for(const name of ['TUTOR.md','LEARNER.md','.pi']){
  link(pick(course&&path.join(course,name),config.vaultPath&&path.join(config.vaultPath,name),path.join(templates,name)),path.join(root,name));
 }
 if(course)for(const name of ['_state.md','Sources','TUTOR.md','LEARNER.md','.pi'])link(path.join(course,name),path.join(target,name));
 return target;
}
function promptFile(){
 const file=path.join(runtime,'desk-prompt.md');
 try{fs.writeFileSync(file,DESK_PROMPT);}catch{}
 return file;
}
function connect(){
 if(!bridge){
  const pi=piBinary();
  const cwd=process.env.LEARNING_DESK_PI_CWD||prepareCourse();
  /* Perfil fixado (desk/profiles.cjs): a lista de extensões é declarada e
     verificável em vez de herdada da descoberta global — uma extensão nova não
     entra calada na Mesa. Medido em `npm run profile`. `pinnedExtensions:false`
     no config volta a herdar tudo. */
  const profileExtra=config.desk?.pinnedExtensions===false?[]:pinnedArgs({overlayDirs:[path.join(cwd,'.pi'),path.join(runtime,'learning','.pi')]});
  const testExtra=process.env.LEARNING_DESK_TEST_ARGS?JSON.parse(process.env.LEARNING_DESK_TEST_ARGS):[];
  bridge=new PiBridge({cwd,session,pi,env:{...spawnEnv(pi),LEARNING_DESK_GGB_BRIDGE:ggbBridgeFile},promptFile:promptFile(),extraArgs:[...profileExtra,...testExtra]});
  bridge.on('event',e=>{
   /* Aviso da ponte (linha torta no stdout do Pi): fica no desk.log — o usuário
      não precisa ver, e o turno segue vivo. Erro de verdade continua em
      `desk_error`, que a UI trata como queda. */
   if(e.type==='desk_warn')try{appendLog('rpc',e.message);}catch{}
   if(e.type==='extension_ui_request'&&['select','confirm','input','editor'].includes(e.method)&&typeof e.id==='string'){
    pendingDialogs.add(e.id);
    if(pendingDialogs.size>32){
     const evicted=pendingDialogs.values().next().value;pendingDialogs.delete(evicted);
     try{const b=bridge;b.respond({id:evicted,cancelled:true});}catch{}
    }
   }
   if(win&&!win.isDestroyed())win.webContents.send('pi-event',e);
  });
  bridge.on('stderr',text=>{try{appendLog('pi',text);}catch{}});
 }
 return bridge;
}
async function assertIdle(message){
 if(!bridge)return;
 const current=await bridge.request('get_state');
 if(current.isStreaming||current.pendingMessageCount)throw Error(message);
}
function stopBridge(){bridge?.removeAllListeners();bridge?.stop();bridge=null;pendingDialogs.clear();}
function trimMessageImages(messages,keep=6){
 const list=Array.isArray(messages)?messages:[];
 let left=keep;
 for(let i=list.length-1;i>=0;i--){
  const content=list[i]?.content;
  if(!Array.isArray(content)||!content.some(part=>part&&part.type==='image'))continue;
  if(left>0){left--;continue;}
  list[i].content=content.filter(part=>!part||part.type!=='image');
 }
 return list;
}

function applyCourse(id){
 const selected=courses.find(c=>c.id===id);
 courseId=selected?id:'';
 course=selected?.path||'';
 const saved=sanitizeCourseState(courseStates[courseId]);
 session=saved.session||path.join(runtime,`pi-${Date.now()}.jsonl`);
 const restoredStudy=cleanStudy(saved.sessionStudies?.[session]||saved.study);
 const ggbSaved=readGgbFile(courseId)||saved.ggbBase64||'';
 ggbWritten.set(courseId,ggbSaved);
 const layout=deskLayout({...saved,theme:state.theme});
 state={...state,pdfs:saved.pdfs||[],referenceVisible:layout.referenceVisible,chatWidth:layout.chatWidth,calcHeight:layout.calcHeight,pdfSplit:layout.pdfSplit,draft:layout.draft,theme:layout.theme,ggbBase64:ggbSaved,study:config.desk?.studyContext===false?{title:'',xopp:''}:restoredStudy};
 ggbRestored=false;
}

/* Registro de retomada da matéria ativa (o cartão do "Encerrar por hoje"). O
   `.xopp` guardado volta a ser autorizado como o da questão — sem o arquivo, o
   Retomar não o traz de volta — e só entram as páginas que a biblioteca desta
   matéria conhece. Nunca escreve. */
function resumePayload(){
 const saved=resume.readResume(runtime,courseId);
 if(!saved)return null;
 const xopp=saved.xopp?cleanStudy({title:'',xopp:saved.xopp}).xopp:'';
 if(xopp)allowedXopp.add(xopp);
 return {...saved,xopp,pages:saved.pages.filter(ref=>allowed.has(ref.path))};
}

/* Favoritos nomeados da matéria ativa — só os documentos que a biblioteca (ou
   o estado) autoriza, como o resume faz com as páginas. O popover do leitor sai
   daqui. Nunca escreve. */
/* O caderno é da matéria, como os favoritos; item que aponta para um PDF que
   não está mais na biblioteca fica de fora da tela (o arquivo guarda tudo). */
function reviewPayload(){
 return review.readItems(runtime,courseId).filter(item=>!item.ref?.path||allowed.has(item.ref.path));
}

function bookmarksPayload(){
 return bookmarks.readBookmarks(runtime,courseId).filter(item=>allowed.has(item.path));
}

function initialData(){
 const library=course?courseLibrary(course):[];
 allowed.clear();
 for(const p of library)allowed.add(p.path);
 for(const p of state.pdfs||[])if(p?.path&&fs.existsSync(p.path))allowed.add(p.path);
 allowedXopp.clear();state.study=authorizeRestoredStudy(state.study,allowedXopp);
 const cfg=normalize(config);
 return {
  library,state,
  course:courses.find(c=>c.id===courseId)?.name||'',
  courseId,courses:courses.map(({id,name})=>({id,name})),
  session,sessions:courseSessions(),
  /* Fila e bandeja guardadas desta conversa: o renderer hidrata a faixa e os
     anexos com isto (a troca de conversa devolve o que era da outra). */
  pending:pending.readPending(runtime,session),
  /* Registro do Encerrar da matéria: o cartão de retomada sai daqui. */
  resume:resumePayload(),
  bookmarks:bookmarksPayload(),
  review:reviewPayload(),
  config:cfg,
  preferred:(pickPdfs(library,cfg.desk.panels)||[]).map(p=>p?.path||null),
  needsSetup:needsSetup(config,courses),
  captureAvailable:captureAvailable(),
  detectedPi:piBinary(),
  platform:process.platform,
  deskVersion:deskVersionLabel()
 };
}

/* ---------- atalhos editáveis (mapa enviado pelo renderer) ---------- */

/* Padrões dos atalhos que existem no menu nativo. O renderer envia o mapa
   efetivo; null significa "sem atalho". Só chaves conhecidas entram. O remap em
   si acontece no preload (que escuta antes de qualquer script da página); aqui
   só o accelerator do menu. */
const MENU_ACCEL={check:'CmdOrCtrl+Shift+C','ggb-check':'CmdOrCtrl+Shift+G','chat-toggle':'CmdOrCtrl+\\',help:'CmdOrCtrl+/',settings:'CmdOrCtrl+,',stop:null};
const KEYMAP_MAX=40;
const ACCEL_MODS=new Set(['CmdOrCtrl','Cmd','Command','Ctrl','Control','Alt','Option','AltGr','Shift','Super','Meta']);
const ACCEL_KEY=/^(?:[A-Za-z0-9]|[^\sA-Za-z0-9+]|F(?:[1-9]|1[0-9]|2[0-4])|Plus|Space|Enter|Return|Escape|Esc|Tab|Backspace|Delete|Up|Down|Left|Right|Home|End|PageUp|PageDown)$/;
let keymap={};

function validAccelerator(value){
 if(typeof value!=='string'||!value||value.length>40)return false;
 const parts=value.split('+');
 const key=parts.pop();
 if(!key||!ACCEL_KEY.test(key))return false;
 if(parts.length>3||new Set(parts).size!==parts.length)return false;
 return parts.every(part=>ACCEL_MODS.has(part));
}

function normalizeKeymap(raw){
 const clean={};
 const menu=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw.menu:null;
 if(!menu||typeof menu!=='object'||Array.isArray(menu))return clean;
 let count=0;
 for(const [id,value] of Object.entries(menu)){
  if(++count>KEYMAP_MAX)break;
  if(!Object.prototype.hasOwnProperty.call(MENU_ACCEL,id))continue;
  if(value===null){clean[id]=null;continue;}
  if(!validAccelerator(value))continue;
  clean[id]=value;
 }
 return clean;
}

function accelFor(id){
 return Object.prototype.hasOwnProperty.call(keymap,id)?keymap[id]:MENU_ACCEL[id];
}

function accelProps(id,{display=false}={}){
 const accel=accelFor(id);
 if(!accel)return {};
 return display?{accelerator:accel,registerAccelerator:false}:{accelerator:accel};
}

ipcMain.handle('set-keymap',(_e,raw)=>{
 keymap=normalizeKeymap(raw);
 if(win&&!win.isDestroyed())buildMenu();
 return {ok:true,menu:Object.keys(keymap).length};
});

function buildMenu(){
 const study=[{label:'Conferir Xournal++',...accelProps('check'),enabled:captureAvailable(),click:()=>{if(win&&!win.isDestroyed())win.webContents.send('menu-check');}},{label:'Conferir GeoGebra',...accelProps('ggb-check'),click:()=>{if(win&&!win.isDestroyed())win.webContents.send('menu-geogebra');}},{label:'Alternar chat',...accelProps('chat-toggle'),click:()=>{if(win&&!win.isDestroyed())win.webContents.send('menu-chat-toggle');}},{label:'Parar',...accelProps('stop'),click:()=>{if(win&&!win.isDestroyed())win.webContents.send('menu-stop');}}];
 Menu.setApplicationMenu(Menu.buildFromTemplate([
  {label:'Mesa de Estudos',submenu:[{label:'Sobre a Mesa de Estudos',click:()=>{if(win&&!win.isDestroyed())win.webContents.send('menu-about');}},{label:'Configurações…',...accelProps('settings'),click:()=>{if(win&&!win.isDestroyed())win.webContents.send('menu-settings');}},{type:'separator'},{role:'quit'}]},
  {label:'Editar',submenu:[{role:'undo'},{role:'redo'},{type:'separator'},{role:'cut'},{role:'copy'},{role:'paste'},{role:'selectAll'}]},
  {label:'Estudar',submenu:study},
  {label:'Visualizar',submenu:[{role:'reload'},{role:'togglefullscreen'}]},
  {label:'Ajuda',submenu:[{label:'Como usar',...accelProps('help'),click:()=>{if(win&&!win.isDestroyed())win.webContents.send('menu-help');}},{label:'Sobre',click:()=>{if(win&&!win.isDestroyed())win.webContents.send('menu-about');}}]}
 ]));
}

app.whenReady().then(()=>{
 /* Fecha o ciclo do bilhete de uma execução anterior antes de qualquer coisa:
   `reivindicado-*` (envio comprovadamente não começado) volta a pendente,
   `enviando-*` (envio iniciado sem confirmação) vai para `duvida/` — nunca para
   a fila — e `entregue-*` vai para o arquivo. Só mexe em disco: não toca no Pi. */
 try{
  const recovery=recoverClaims({runtime});
  if(recovery.requeued||recovery.archived||recovery.doubtful)console.warn('[bilhete] recuperação:',recovery.requeued,'de volta a pendente,',recovery.archived,'arquivado(s),',recovery.doubtful,'em dúvida');
  for(const detail of recovery.details)if(detail.reason)console.warn('[bilhete] recuperação:',detail.name,detail.action,detail.reason);
 }catch(e){console.warn('[bilhete] recuperação falhou:',e?.message||e);}
 if(TEST_MODE&&process.platform==='darwin'){try{app.setActivationPolicy('accessory');}catch{}try{app.dock?.hide();}catch{}}
 else if(process.platform==='darwin')app.dock.setIcon(path.join(__dirname,'assets','mesa-1024.png'));
 app.setAboutPanelOptions({applicationName:'Mesa de Estudos',applicationVersion:app.getVersion(),copyright:'© 2026 Lucas Faria. Licença MIT.',iconPath:path.join(__dirname,'assets','mesa-1024.png')});
 const displays=screen.getAllDisplays();
 const placed=placeWindow(displays,screen.getPrimaryDisplay().id,state.bounds);
 win=new BrowserWindow({width:placed.width,height:placed.height,...(placed.x!=null?{x:placed.x,y:placed.y}:{}),minWidth:900,minHeight:650,title:'Mesa de Estudos',backgroundColor:state.theme==='dark'?'#0a0a0a':'#fcfcfc',show:!TEST_MODE,backgroundThrottling:false,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,spellcheck:false}});
 win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',(e,url)=>{if(url!==win.webContents.getURL())e.preventDefault();});
 buildMenu();
 startGgbBridge();
 win.on('resize',()=>{captureGgbConstruction();placeGgbView();});win.on('move',placeGgbView);
 /* O reload do renderer (⌘R) derruba a página que ligava a View nativa: sem
    isso a view fica presa por cima de uma Mesa que nem sabe que ela existe. */
 win.webContents.on('did-start-navigation',(_e,_url,_isInPlace,isMainFrame)=>{if(isMainFrame)hideGgbView();});
 win.on('close',()=>persist());win.loadFile(path.join(__dirname,'index.html'));
 scheduleUpdateCheck();
});

function setBadge(value){
 if(TEST_MODE)return;
 if(process.platform!=='darwin'&&process.platform!=='linux')return;
 try{app.setBadgeCount(Math.max(0,Math.min(99,Number(value)||0)));}catch{}
}
function showNotification(body){
 if(TEST_MODE)return false;
 if(win&&!win.isDestroyed()&&win.isFocused())return false;
 if(typeof Notification.isSupported==='function'&&!Notification.isSupported())return false;
 try{
  const n=new Notification({title:'Mesa de Estudos',body,silent:true});
  liveNotifications.add(n);
  const drop=()=>liveNotifications.delete(n);
  n.on('failed',drop);n.on('close',drop);
  n.on('click',()=>{drop();if(win&&!win.isDestroyed()){if(win.isMinimized())win.restore();win.show();win.focus();}});
  n.show();
  return true;
 }catch{return false;}
}
ipcMain.handle('init',initialData);
ipcMain.handle('test-mode',()=>TEST_MODE);
ipcMain.handle('notify',(_e,payload)=>{
 if(typeof payload?.body!=='string')throw Error('Aviso inválido.');
 const body=payload.body.replace(/\s+/g,' ').trim().slice(0,200);
 if(!body)throw Error('Aviso inválido.');
 if(TEST_MODE)return false;
 return showNotification(body);
});
ipcMain.handle('badge',(_e,value)=>{
 if(TEST_MODE)return;
 if(value!=null&&(typeof value!=='number'||!Number.isFinite(value)))throw Error('Selo inválido.');
 setBadge(value);
});
ipcMain.handle('desk-log',(_e,line)=>{appendLog('renderer',typeof line==='string'?line:(line&&(line.stack||line.message))||String(line));});
ipcMain.handle('switch-course',async(_e,id)=>{
 const selected=courses.find(c=>c.id===id);if(!selected)throw Error('Matéria não encontrada.');
 await assertIdle('Pare a resposta antes de trocar de matéria.');
 persist();stopBridge();applyCourse(id);persist();return initialData();
});
ipcMain.handle('open-pdf',async()=>{const r=await dialog.showOpenDialog(win,{filters:[{name:'PDF',extensions:['pdf']}],properties:['openFile']});if(r.canceled)return null;const p=r.filePaths[0];allowed.add(p);return {name:path.basename(p),path:p};});
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
 if(!hit)throw Error('Imagem não encontrada na área da mesa.');
 if(hit.mime==='image/svg+xml')throw Error('SVG fica só dentro da Mesa; use PNG, JPEG, WebP ou GIF para abrir no Preview.');
 const error=await shell.openPath(hit.file);
 if(error)throw Error(error);
});
ipcMain.handle('save-state',(_e,value)=>{
 const pdfs=(value.pdfs||[]).slice(0,2).filter(p=>!p?.path||allowed.has(p.path)).map(p=>({path:p.path,page:p.page,zoom:p.zoom,scrollX:Number(p.scrollX)||0,scrollY:Number(p.scrollY)||0,invert:!!p.invert,minimized:!!p.minimized}));
 const study=cleanStudy(value.study);
 if(study.xopp&&!allowedXopp.has(study.xopp))study.xopp='';
 /* O adaptador monta os fatos e o núcleo decide (fallbacks por campo
    documentados em state-adapter.cjs). */
 const layout=saveState(state,value);
 const theme=layout.theme;
 state={...state,draft:layout.draft,study,pdfs,referenceVisible:layout.referenceVisible,chatWidth:layout.chatWidth,calcHeight:layout.calcHeight,pdfSplit:layout.pdfSplit,theme};
 if(win&&!win.isDestroyed())win.setBackgroundColor(theme==='dark'?'#0a0a0a':'#fcfcfc');
 persist();
});
/* Fila e bandeja guardadas (`desk/pending.cjs`, núcleo `core/pending.bend`): o
   renderer manda o que tem — e o `held` da fila — e recebe de volta o que foi
   guardado; os cortes do teto de disco voltam como `dropped`/`trayDropped` para
   a faixa avisar. */
ipcMain.handle('pending-save',(_e,payload)=>{
 const items=payload?.items;
 if(!Array.isArray(items)||items.length>200)throw Error('Fila inválida.');
 return pending.saveQueue(runtime,session,items,payload?.held===true);
});
ipcMain.handle('tray-save',(_e,payload)=>{
 const images=payload?.images;
 if(!Array.isArray(images)||images.length>16)throw Error('Anexos inválidos.');
 return pending.saveTray(runtime,session,images);
});
/* Registro do "Encerrar por hoje": grava LOCAL primeiro (é o ponto do módulo) e
   o host só aceita o que é da matéria: páginas da biblioteca aberta e `.xopp`
   já autorizado, como no `save-state`. Erro de IO sobe — o renderer mantém o
   diálogo aberto com o texto. */
ipcMain.handle('end-day-save',(_e,payload)=>{
 const raw=payload?.record;
 if(!isPlainObject(raw))throw Error('Registro inválido.');
 const pages=(Array.isArray(raw.pages)?raw.pages:[]).filter(ref=>isPlainObject(ref)&&typeof ref.path==='string'&&allowed.has(ref.path));
 const xopp=typeof raw.xopp==='string'&&raw.xopp&&allowedXopp.has(raw.xopp)?raw.xopp:'';
 return resume.saveResume(runtime,courseId,{...raw,pages,xopp});
});
ipcMain.handle('resume-clear',()=>resume.clearResume(runtime,courseId));
/* Favorito guardado ou removido no popover do leitor. `mode` diz o que fazer:
   `add` recebe o item do diálogo, `remove` recebe o REGISTRO clicado (a
   identidade — o host acha o favorito onde ele estiver). A resposta é a mesma
   lista FILTRADA que o `init` manda: o renderer guarda o que vê, e um favorito
   de PDF fora da biblioteca não reaparece na tela depois de um save. */
ipcMain.handle('bookmarks-save',(_e,payload)=>{
 const raw=isPlainObject(payload)?payload:{};
 if(raw.mode==='remove')bookmarks.removeBookmark(runtime,courseId,raw.item);
 else bookmarks.addBookmark(runtime,courseId,raw.item);
 return bookmarksPayload();
});
/* `add` e `edit` recebem o item do diálogo (o `edit` também a `key`, o registro
   de origem), `remove` recebe a `key`/o `item` — o núcleo acha o item por
   identidade, nunca pela posição. Como nos favoritos, a resposta é a lista
   FILTRADA (a tela é a biblioteca da matéria; o arquivo guarda tudo). */
ipcMain.handle('review-save',(_e,payload)=>{
 const raw=isPlainObject(payload)?payload:{};
 review.reviewSave(runtime,{...raw,courseId});
 return reviewPayload();
});
ipcMain.handle('export-chat',async()=>{ const courseName=courses.find(c=>c.id===courseId)?.name||courseId||'matéria';
 let records=[];
 try{
  records=fs.readFileSync(session,'utf8').split('\n').filter(Boolean).map(line=>{try{return JSON.parse(line);}catch{return null;}}).filter(Boolean);
 }catch{}
 const parts=[];
 for(const record of records){
  const m=record?.message;
  if(!m||!['user','assistant'].includes(m.role))continue;
  let text='';
  for(const part of Array.isArray(m.content)?m.content:[]){
   if(part?.type==='text')text+=(text?'\n':'')+String(part.text||'');
   else if(part?.type==='image')text+=(text?'\n':'')+'[imagem anexada]';
  }
  if(!text.trim())continue;
  parts.push(`## ${m.role==='user'?'Você':'Pi'}\n\n${text.trim()}`);
 }
 const body=`# Mesa de Estudos — ${courseName}\n\nExportado em ${new Date().toISOString()}\n\n`+(parts.length?parts.join('\n\n')+'\n':'');
 const safe=courseName.replace(/[\\/:*?"<>|]+/g,'-').replace(/^[\s.]+|[\s.]+$/g,'').trim()||'materia';
 const now=new Date(),pad=n=>String(n).padStart(2,'0');
 const name=`Mesa — ${safe} — ${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ${pad(now.getHours())}.${pad(now.getMinutes())}.md`;
 const dir=config.vaultPath&&fs.existsSync(config.vaultPath)?path.join(config.vaultPath,'Mesa de Estudos'):path.join(runtime,'exported');
 fs.mkdirSync(dir,{recursive:true});
 const target=path.join(dir,name);
 if(envRuntime){
  fs.writeFileSync(target,body);
  return {saved:true,file:target};
 }
 const r=await dialog.showSaveDialog(win,{defaultPath:target});
 if(r.canceled||!r.filePath)return {saved:false};
 fs.writeFileSync(r.filePath,body);
 shell.showItemInFolder(r.filePath);
 return {saved:true,file:r.filePath};
});
ipcMain.handle('get-config',()=>({config:normalize(config),detectedPi:piBinary(),captureAvailable:captureAvailable(),platform:process.platform,needsSetup:needsSetup(config,courses),deskVersion:deskVersionLabel()}));
ipcMain.handle('pick-folder',async()=>{const r=await dialog.showOpenDialog(win,{properties:['openDirectory']});return r.canceled?null:r.filePaths[0];});
ipcMain.handle('pick-file',async()=>{const r=await dialog.showOpenDialog(win,{properties:['openFile']});return r.canceled?null:r.filePaths[0];});
ipcMain.handle('pick-xopp',async()=>{const r=await dialog.showOpenDialog(win,{filters:[{name:'Xournal++',extensions:['xopp']}],properties:['openFile']});if(r.canceled)return null;const file=r.filePaths[0];allowedXopp.add(file);return file;});
ipcMain.handle('detect-pi',()=>piBinary());
ipcMain.handle('save-config',async(_e,next)=>{
 await assertIdle('Pare a resposta antes de mudar as configurações.');
 const incoming=normalize(next||{});
 if(incoming.runtimePath&&path.resolve(incoming.runtimePath)!==path.resolve(runtime)){
  throw Error('A pasta de dados em uso não pode mudar agora. Reabra o aplicativo depois de alterar o runtime.');
 }
 if(persistConfig)writeConfig(configFile,incoming);
 config=incoming;
 courses=mergeCourses(config);
 persist();stopBridge();
 if(!courses.some(c=>c.id===courseId))applyCourse(courses[0]?.id||'');
 persist();buildMenu();
 return initialData();
});

ipcMain.handle('pi-connect',async()=>{
 persist();
 const b=connect();
 const s=await b.request('get_state');
 const messages=await b.request('get_messages');
 const models=await b.request('get_available_models');
 return {state:s,models:models?.models||[],levels:await levelsFor(s.model),messages:trimMessageImages(messages?.messages||[]),session,sessions:courseSessions(),captureAvailable:captureAvailable(),contextUsage:await statsUsage()};
});
ipcMain.handle('pi-commands',async()=>{
 try{
  const result=await connect().request('get_commands');
  const list=Array.isArray(result?.commands)?result.commands:[];
  return list.slice(0,100).map(c=>({
   name:String(c?.name||'').slice(0,60),
   description:String(c?.description||'').slice(0,200),
   argumentHint:String(c?.argumentHint||c?.argument_hint||'').slice(0,60)
  })).filter(c=>c.name);
 }catch{return [];}
});
async function statsUsage(){
 try{const stats=await connect().request('get_session_stats',{},30000);
  const usage=stats?.contextUsage;
  if(usage)return usage;
  if(stats&&stats.tokens&&stats.contextWindow)return {tokens:stats.tokens,contextWindow:stats.contextWindow,percent:stats.tokens/stats.contextWindow*100};
 }catch{}
 return null;
}
ipcMain.handle('pi-health',async()=>{const state=await connect().request('get_state',{},20000);return {ok:true,isStreaming:!!state?.isStreaming,pendingMessageCount:Number(state?.pendingMessageCount)||0,contextUsage:await statsUsage()};});
ipcMain.handle('pi-compact',async(_e,instructions)=>{
 await assertIdle('Pare a resposta antes de compactar.');
 const b=connect();
 const result=await b.request('compact',{customInstructions:typeof instructions==='string'&&instructions.trim()?instructions.trim().slice(0,2000):undefined},240000);
 return {summary:typeof result?.summary==='string'?result.summary.slice(0,300):'',tokensBefore:Number(result?.tokensBefore)||0};
});
ipcMain.handle('pi-auto-compaction',async(_e,enabled)=>{const b=connect();await b.request('set_auto_compaction',{enabled:!!enabled});const s=await b.request('get_state');return {autoCompactionEnabled:!!s.autoCompactionEnabled,contextUsage:await statsUsage()};});

async function levelsFor(model){
 if(!levelsMod)levelsMod=await loadLevelsModule(piBinary(),deskDir);
 if(!levelsMod?.getSupportedThinkingLevels)return FALLBACK_LEVELS;
 return model?levelsMod.getSupportedThinkingLevels(model):['off'];
}
ipcMain.handle('pi-settings',async(_e,change)=>{const b=connect();let current=await b.request('get_state');if(current.isStreaming||current.pendingMessageCount)throw Error('Aguarde ou pare a resposta antes de mudar o modelo.');if(change.model){const catalog=await b.request('get_available_models');const found=catalog.models?.find(m=>m.provider===change.model.provider&&m.id===change.model.id);if(!found)throw Error('Modelo não disponível no Pi.');await b.request('set_model',{provider:found.provider,modelId:found.id});}if(change.level){current=await b.request('get_state');if(!(await levelsFor(current.model)).includes(change.level))throw Error('Este esforço não é suportado pelo modelo.');await b.request('set_thinking_level',{level:change.level});}current=await b.request('get_state');return {state:current,levels:await levelsFor(current.model),contextUsage:await statsUsage()};});

ipcMain.handle('pi-prompt',async(_e,payload)=>{
 if(typeof payload.text!=='string'||payload.text.length>MAX_DRAFT)throw Error('Mensagem inválida.');
 let message=payload.text;
 const refs=(payload.refs||[]).slice(0,2).map(r=>{
  if(!r||typeof r.path!=='string')throw Error('Referência inválida: selecione as páginas de novo.');
  return `${validPdf(r.path)}#page=${Math.max(1,Math.trunc(r.page)||1)}`;
 });
 const studyContextOff=config.desk?.studyContext===false;
 const study=studyContextOff?{title:'',xopp:''}:cleanStudy(state.study);
 const courseName=courses.find(c=>c.id===courseId)?.name||courseId||'';
 /* Proveniência do anexo: o renderer marca a captura do Xournal++ com o horário
    e o exercício que estava ativo quando ela foi feita (é o que permite avisar
    que uma captura antiga não é do exercício de agora). */
 const shot=(Array.isArray(payload.images)?payload.images:[]).find(item=>item&&typeof item==='object'&&typeof item.capturedAt==='number');
 const block=buildStudyContext({
  course:studyContextOff?'':courseName,
  study:{title:study.title,xopp:study.xopp&&allowedXopp.has(study.xopp)?study.xopp:''},
  refs,
  capture:shot?{capturedAt:shot.capturedAt,exercise:typeof shot.exercise==='string'?shot.exercise:''}:null,
  previousKey:lastContextKey,
 });
 if(block.text)message+='\n\n'+block.text;
 /* Bilhete da Conversa: acompanha a mensagem. A mão (`claimHand`) devolve o
    MESMO bilhete enquanto ele não tem desfecho — por isso ele não é solto
    aqui. */
 const bilhete=claimHandoff();
 const bilheteText=bilhete?.block||'';
 if(bilheteText)message+='\n\n'+bilheteText;
 /* `steer` (⌘/Ctrl+⏎ com o Pi ocupado): o Pi interrompe o turno e trata esta
    mensagem agora; sem ele o prompt entra como follow-up — é o que a fila da
    Mesa manda quando chega a vez de cada item.
    A ordem do envio (validar anexo → conectar → marcar o envio → escrever →
    confirmar → ler o estado) e o destino do bilhete em cada desfecho moram em
    `deliverPrompt` (desk/send.cjs): aqui fica só o que é do app. */
 return deliverPrompt({
  request:{message,streamingBehavior:payload.steer===true?'steer':'followUp'},
  images:payload.images,
  validateImages:promptImages,
  claim:bilhete,
  runtime,
  connect,
  /* Aceite confirmado: o contexto do turno e o bilhete só contam como entregues aqui. */
  onAccepted(){lastContextKey=block.key;hand.release();},
  onDelivered:handoffProblem,
  /* Envio aceito com a leitura do estado falhando: o turno vale (a mensagem
     chegou), o aviso vai para o log e o renderer mostra o mesmo texto — é o que
     impede a fila de repetir a mensagem. */
  onWarning(aviso){try{appendLog('rpc',aviso);}catch{}},
  /* Escrita incerta: o bilhete sai da mão do app (fica em dúvida no disco) e o
     contexto da Mesa não entra na conta do próximo turno. */
  onAmbiguous(aviso){hand.release();handoffProblem(aviso);},
  /* Recusa comprovada (o bridge prova que nada foi escrito): o bilhete continua
     na mão para a próxima tentativa e a próxima abertura o devolve para a fila.
     O contexto do turno não conta como enviado. */
  onRefused:handoffProblem,
 });
});
ipcMain.handle('pi-abort',async()=>{if(bridge){await bridge.request('clear_queue');await bridge.request('abort');}});
ipcMain.handle('pi-response',(_e,data)=>{
 const id=typeof data?.id==='string'?data.id:'';
 if(!id||!pendingDialogs.has(id))throw Error('Não há diálogo pendente para esta resposta.');
 pendingDialogs.delete(id);
 const payload={id};
 if(typeof data.value==='string')payload.value=data.value;
 if(data.confirmed===true)payload.confirmed=true;
 if(data.cancelled===true)payload.cancelled=true;
 connect().respond(payload);
});
ipcMain.handle('new-session',async()=>{
 await assertIdle('Pare a resposta antes de começar outra conversa.');
 rememberSession();stopBridge();session=path.join(runtime,`pi-${Date.now()}.jsonl`);lastContextKey='';state={...state,draft:'',study:{title:'',xopp:''}};persist();
 return {session,sessions:courseSessions(),state,pending:pending.readPending(runtime,session),resume:resumePayload(),bookmarks:bookmarksPayload(),review:reviewPayload()};
});
ipcMain.handle('open-session',async(_e,file)=>{
 if(typeof file!=='string')throw Error('Sessão inválida.');
 if(file===session)return {session,sessions:courseSessions(),pending:pending.readPending(runtime,session),resume:resumePayload(),bookmarks:bookmarksPayload()};
 const allowedSessions=courseSessions();
 if(!allowedSessions.some(s=>s.path===file))throw Error('Sessão não encontrada nesta matéria.');
 if(!fs.existsSync(file))throw Error('Arquivo da sessão não existe mais.');
 await assertIdle('Pare a resposta antes de trocar de conversa.');
 rememberSession();stopBridge();session=file;lastContextKey='';allowedXopp.clear();state={...state,draft:'',study:authorizeRestoredStudy(sessionStudy(file),allowedXopp)};persist();
 return {session,sessions:courseSessions(),state,pending:pending.readPending(runtime,session),resume:resumePayload(),bookmarks:bookmarksPayload()};
});
ipcMain.handle('capture-ready',async()=>{
 /* Windows: janela do Xournal++ via PowerShell/.NET do sistema (capture-win.cjs)
    — mesma saída {title, dataUrl} do caminho macOS abaixo. */
 if(process.platform==='win32')return captureXournalWindow();
 if(process.platform!=='darwin')throw Error('Conferir Xournal++ está disponível no macOS e no Windows.');
 let status=systemPreferences.getMediaAccessStatus('screen');
 if(status!=='granted'){
  if(status==='not-determined'){try{await systemPreferences.askForMediaAccess('screen');}catch{}}
  status=systemPreferences.getMediaAccessStatus('screen');
  if(status!=='granted')throw Error('Autorize Gravação de Tela para Mesa de Estudos em Ajustes > Privacidade e Segurança > Gravação de Tela. Depois reabra o aplicativo.');
 }
 const helper=captureHelper();
 if(!helper)throw Error('A conferência visual não está instalada.');
 const {stdout}=await execFileAsync(helper,[],{timeout:15000,maxBuffer:1024*1024});
 let listed;try{listed=JSON.parse(stdout);}catch{throw Error('Não foi possível listar as janelas do Xournal++.');}
 if(!listed.permission)throw Error('Autorize Gravação de Tela para Mesa de Estudos em Ajustes > Privacidade e Segurança > Gravação de Tela. Depois reabra o aplicativo.');
 const window=chooseXournal(listed.windows);
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mesa-visual-'));
 try{
  const file=path.join(dir,'attempt.png');
  await execFileAsync('/usr/sbin/screencapture',['-x','-o',`-l${window.id}`,file],{timeout:15000});
  const bytes=fs.readFileSync(file);
  if(bytes.length<100||bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw Error('A captura não produziu uma imagem PNG válida.');
  return {title:window.title||'Xournal++',dataUrl:'data:image/png;base64,'+bytes.toString('base64')};
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
ipcMain.handle('open-xournal',()=>{
 const target=config.xournalPath||(process.platform==='darwin'?'/Applications/Xournal++.app':'');
 if(!target)throw Error('Indique o caminho do Xournal++ em Configurações.');
 return shell.openPath(target);
});

/* ---------- updater por clique + painel de componentes ----------
   Somente GETs públicos (releases do GitHub + registry npm); zero telemetria.
   O updater nunca toca `config.json`, Application Support/%APPDATA%, `.runtime/`
   (só o cache `update.json` e o append no `desk.log`), sessões, PDFs nem
   templates do usuário — a lista do que ele substitui é explícita em
   `updater.cjs` (lista de código + caminhos protegidos). Modo de teste não fala
   com a rede (os testes sobrescrevem os handlers com dados falsos). */
const updateCacheFile=path.join(runtime,'update.json');
function updateContext(){
 const root=path.join(deskDir,'..');
 const bundle=path.resolve(deskDir,'..','..','..');
 let source=null;try{source=JSON.parse(fs.readFileSync(path.join(deskDir,'install-source.json'),'utf8'));}catch{}
 const mode=source&&source.path?'bundle':fs.existsSync(path.join(root,'.git'))?'git':'zip';
 const reopen=mode==='bundle'?{cmd:'open',args:[bundle]}:{cmd:'npm',args:['start'],cwd:deskDir,shell:process.platform==='win32'};
 return {mode,rootDir:root,deskDir,runtime,sourceInfo:source,reopen};
}
ipcMain.handle('update-check',(_e,opts)=>{
 if(TEST_MODE)return {status:'unknown',version:'',notes:'',url:'',current:app.getVersion()};
 return updater.checkForUpdates({current:app.getVersion(),manual:!!opts?.manual,cacheFile:updateCacheFile});
});
ipcMain.handle('update-apply',async()=>{
 if(TEST_MODE)throw Error('Atualização desativada no modo de teste.');
 const target=updater.readCache(updateCacheFile)?.release?.version;
 if(!target)throw Error('Nenhuma atualização conhecida. Verifique atualizações primeiro.');
 /* A4: lock compartilhado entre Atualizar Mesa, Atualizar Pi e o CLI — dois
    cliques (ou clique + terminal) não abrem dois workers concorrentes. */
 const lock=updater.acquireLock(runtime);
 if(!lock.ok)throw Error(lock.reason);
 const worker=updater.spawnWorker({...updateContext(),announcedVersion:target,waitPid:process.pid,cacheFile:updateCacheFile,lockFile:lock.file});
 if(!worker.ok){
  updater.releaseLock(lock.file);
  throw Error(worker.error||'não foi possível iniciar o script de atualização');
 }
 /* A4: handshake — o app SÓ fecha depois de o worker confirmar que subiu
    (Node ausente/spawn falho/handshake perdido deixam a Mesa de pé). */
 const ok=await updater.waitForHandshake(worker.status,15000);
 if(!ok){
  appendLog('update','worker não confirmou o arranque — app segue aberto; atualização abortada');
  updater.releaseLock(lock.file);
  throw Error('O script de atualização não iniciou (Node do sistema ausente?). A Mesa segue aberta — rode npm run update no terminal para atualizar.');
 }
 appendLog('update',`aplicando v${target} (worker confirmado: ${worker.script})`);
 setTimeout(()=>app.quit(),400);
 return {ok:true,version:target};
});
ipcMain.handle('update-pi',async()=>{
 if(TEST_MODE)throw Error('Atualização desativada no modo de teste.');
 const ctx=updateContext();
 const pi=piBinary();
 if(!components.piIsLocal(pi,deskDir))throw Error('Seu Pi não é o local da Mesa (desk/.pi-local) — atualize no terminal.');
 const lock=updater.acquireLock(runtime);
 if(!lock.ok)throw Error(lock.reason);
 const worker=updater.spawnWorker({...ctx,piOnly:true,waitPid:process.pid,cacheFile:updateCacheFile,lockFile:lock.file});
 if(!worker.ok){
  updater.releaseLock(lock.file);
  throw Error(worker.error||'não foi possível iniciar o script de atualização');
 }
 const ok=await updater.waitForHandshake(worker.status,15000);
 if(!ok){
  appendLog('update','worker do Pi não confirmou o arranque — app segue aberto; atualização abortada');
  updater.releaseLock(lock.file);
  throw Error('O script de atualização do Pi não iniciou (Node do sistema ausente?). A Mesa segue aberta — rode npm run update -- --pi.');
 }
 appendLog('update','atualizando o Pi local (worker confirmado)');
 setTimeout(()=>app.quit(),400);
 return {ok:true};
});
ipcMain.handle('components',(_e,opts)=>components.collect({deskDir,config,cacheFile:updateCacheFile,version:app.getVersion(),manual:!!opts?.manual,testMode:TEST_MODE}));
/* Resultado REAL da última atualização (C1): gravado pelo worker em
   update.json; o Sobre mostra na reabertura (atualizada/recuperada/incompleta). */
ipcMain.handle('update-result',()=>{
 if(TEST_MODE)return null;
 const r=updater.readCache(updateCacheFile)?.lastResult;
 return r&&typeof r==='object'?r:null;
});
/* Acesso ao desk.log (C1): o resultado de rollback se explica no log. */
ipcMain.handle('open-log',()=>{
 if(TEST_MODE)return {ok:false};
 return shell.openPath(logFile);
});
ipcMain.handle('open-external',(_e,url)=>{
 if(typeof url!=='string'||!/^https:\/\//.test(url))throw Error('Link inválido.');
 return shell.openExternal(url);
});
/* Checagem automática 1×/dia (Mesa + Pi): silenciosa, não bloqueante, cache no
   runtime. O aviso é discreto — um toast por versão + a linha do Sobre. */
function scheduleUpdateCheck(){
 if(TEST_MODE)return;
 setTimeout(async()=>{
  try{
   const r=await updater.checkForUpdates({current:app.getVersion(),manual:false,cacheFile:updateCacheFile});
   await updater.piLatest({cacheFile:updateCacheFile});
   if(r.status==='update'&&r.version&&await updater.markToasted(updateCacheFile,r.version)&&win&&!win.isDestroyed()){
    win.webContents.send('update-available',{version:r.version});
   }
  }catch{}
 },5000);
}

const ggbBridgeFile=path.join(runtime,'ggb-bridge.json');
let ggbView=null,ggbRect=null,ggbVisible=false,ggbServer=null,ggbPort=0,ggbToken='';
/* `ggbRestored` vale por documento do applet: o ggb.html recarrega no resize e
   cada `did-finish-load` reabre a janela para reaplicar o snapshot da matéria. */
let ggbDocumentLoaded=false,ggbCaptureBusy=false;
function restoreGgbConstruction(){
 if(!ggbView||ggbView.webContents.isDestroyed()||!ggbDocumentLoaded)return;
 const b64=state.ggbBase64;
 if(!b64||ggbRestored)return;
 ggbRestored=true;
 ggbView.webContents.executeJavaScript(`(async()=>{const wait=t=>new Promise(r=>setTimeout(r,t));for(let i=0;i<60&&!window.__ggbReady;i++)await wait(500);if(!window.__ggbReady)return false;try{window.ggbApplet.setBase64(${JSON.stringify(b64)});return true}catch(e){return false}})()`,true).catch(()=>{});
}
function ensureGgbView(){
 if(!ggbView){
  ggbView=new WebContentsView({webPreferences:{partition:'persist:geogebra',sandbox:true,contextIsolation:true,nodeIntegration:false,spellcheck:false}});
  win.contentView.addChildView(ggbView);
  /* O applet recarrega sozinho quando a view muda de tamanho: no documento novo
     o snapshot da matéria é reaplicado assim que o applet fica pronto. */
  ggbView.webContents.on('did-finish-load',()=>{
   ggbDocumentLoaded=true;
   ggbRestored=false;
   if(ggbVisible)restoreGgbConstruction();
  });
  ggbView.webContents.loadFile(path.join(__dirname,'ggb.html')).catch(()=>{});
 }
 return ggbView;
}
function placeGgbView(){
 if(!ggbView||!ggbRect||!win||win.isDestroyed())return;
 ggbView.setBounds({x:ggbRect.x,y:ggbRect.y,width:Math.max(1,ggbRect.width),height:Math.max(1,ggbRect.height)});
}
function hideGgbView(){ggbRect=null;ggbVisible=false;if(ggbView&&!ggbView.webContents.isDestroyed())ggbView.setVisible(false);}
ipcMain.handle('ggb-view',(_e,payload)=>{
 if(payload?.visible){
  const rect=payload.rect||{};
  ggbRect={x:Math.max(0,Number(rect.x)||0),y:Math.max(0,Number(rect.y)||0),width:Math.max(1,Number(rect.width)||0),height:Math.max(1,Number(rect.height)||0)};
  ensureGgbView();placeGgbView();ggbView.setVisible(true);ggbVisible=true;
  restoreGgbConstruction();
 }else hideGgbView();
});
async function captureGgbSnapshot(){
 try{
  if(!ggbView||ggbView.webContents.isDestroyed()||!ggbVisible)return {saved:false};
  const data=await ggbView.webContents.executeJavaScript('(function(){if(!window.__ggbReady)return null;try{return window.ggbApplet&&typeof window.ggbApplet.getBase64==="function"?window.ggbApplet.getBase64():null}catch(e){return null}})()',true);
  if(typeof data==='string'&&data&&data.length<=400000){
   state.ggbBase64=data;
   persist();
   return {saved:true,size:data.length};
  }
 }catch{}
 return {saved:false};
}
/* O resize da janela recarrega o applet (o ggb.html só mede o layout no load):
   guarda a construção viva ANTES do documento novo, para o restore não voltar
   apenas ao último snapshot salvo. */
function captureGgbConstruction(){
 if(ggbCaptureBusy||!ggbView||ggbView.webContents.isDestroyed()||!ggbVisible)return;
 ggbCaptureBusy=true;
 captureGgbSnapshot().finally(()=>{ggbCaptureBusy=false;});
}
ipcMain.handle('ggb-snapshot',()=>captureGgbSnapshot());
ipcMain.handle('ggb-shot',async()=>{
 if(!ggbView||ggbView.webContents.isDestroyed()||!ggbVisible)throw Error('Abra a aba GeoGebra primeiro.');
 const ready=await ggbView.webContents.executeJavaScript('Promise.resolve(window.__ggbReady===true)',true).catch(()=>false);
 if(!ready)throw Error('O applet GeoGebra ainda está carregando; aguarde alguns segundos.');
 const image=await ggbView.webContents.capturePage();
 if(image.isEmpty())throw Error('A captura saiu vazia; aguarde o applet renderizar e tente de novo.');
 return {dataUrl:'data:image/png;base64,'+image.toPNG().toString('base64')};
});
async function ggbExec(expression){
 if(!ggbView||ggbView.webContents.isDestroyed()||!ggbVisible)throw Error('Abra a aba GeoGebra primeiro.');
 const wc=ggbView.webContents;
 const ready=await wc.executeJavaScript('Promise.resolve(window.__ggbReady===true)',true);
 if(!ready)throw Error('O applet GeoGebra ainda está carregando (ou falhou ao carregar); aguarde alguns segundos.');
 return wc.executeJavaScript(expression,true);
}
function ggbSummary(){
 return ggbExec(`(async()=>{const A=window.ggbApplet;const names=String(A.getAllObjectNames()||'').split('\\n').map(s=>s.trim()).filter(Boolean);const lines=[];for(const n of names.slice(0,80)){let d='';try{d=String(A.getCommandString(n)||'')}catch{}if(!d){try{d=String(A.getDefinitionString(n)||'')}catch{}}let v='';try{v=String(A.getValueString(n)||'')}catch{}lines.push(\`\${n}\${d?\`: \${d}\`:''}\${v?\` = \${v}\`:''}\`);}return {objects:lines.join('\\n'),count:names.length};})()`);
}
async function ggbRun(command){
 const ok=await ggbExec(`(function(){try{return {ok:!!window.ggbApplet.evalCommand(${JSON.stringify(command)})}}catch(e){return {ok:false,error:String(e&&e.message||e)}}})()`);
 let state=null;
 try{state=await ggbSummary();}catch{}
 return {...(ok||{}),state};
}
function ggbReply(res,code,payload){
 res.on('error',()=>{});
 res.writeHead(code,{'content-type':'application/json; charset=utf-8'});
 res.end(JSON.stringify(payload));
}
function readBody(req,res,cap=65536){
 const declared=Number(req.headers['content-length'])||0;
 if(declared>cap){ggbReply(res,413,{error:'Corpo grande demais.'});req.destroy();return Promise.reject(Error('Corpo grande demais.'));}
 return new Promise((resolve,reject)=>{
  let size=0;const chunks=[];
  req.on('data',chunk=>{size+=chunk.length;if(size>cap){ggbReply(res,413,{error:'Corpo grande demais.'});req.destroy();reject(Error('Corpo grande demais.'));return;}chunks.push(chunk);});
  req.on('end',()=>resolve(Buffer.concat(chunks).toString('utf8')));
  req.on('error',reject);
 });
}
function startGgbBridge(){
 if(ggbServer)return;
 ggbToken=crypto.randomBytes(24).toString('base64url');
 ggbServer=http.createServer(async(req,res)=>{
  try{
   const token=typeof req.headers['x-desk-token']==='string'?req.headers['x-desk-token']:'';
   const given=Buffer.from(token),expected=Buffer.from(ggbToken);
   if(given.length!==expected.length||!crypto.timingSafeEqual(given,expected)){ggbReply(res,403,{error:'Token inválido.'});return;}
   const action=new URL(req.url,'http://127.0.0.1').pathname.replace(/\/+$/,'');
   if(req.method!=='POST'||!['/run','/state','/screenshot'].includes(action)){ggbReply(res,404,{error:'Rota desconhecida.'});return;}
   const body=await readBody(req,res);
   let payload={};
   try{payload=body?JSON.parse(body):{};}catch{ggbReply(res,400,{error:'Corpo JSON inválido.'});return;}
   if(action==='/run'){
    const command=typeof payload.command==='string'?payload.command.trim():'';
    if(!command||command.length>2000){ggbReply(res,400,{error:'Informe command (até 2000 caracteres).'});return;}
    const result=await ggbRun(command);
    ggbReply(res,200,result);
   }else if(action==='/state'){
    const state=await ggbSummary();
    ggbReply(res,200,{ok:!!state,state});
   }else{
    if(!ggbView||ggbView.webContents.isDestroyed()||!ggbVisible){ggbReply(res,400,{error:'Abra a aba GeoGebra primeiro.'});return;}
    const wc=ggbView.webContents;
    const ready=await wc.executeJavaScript('Promise.resolve(window.__ggbReady===true)',true);
    if(!ready){ggbReply(res,400,{error:'O applet GeoGebra ainda está carregando.'});return;}
    const image=await wc.capturePage();
    if(image.isEmpty()){ggbReply(res,400,{error:'A captura saiu vazia; aguarde o applet renderizar e tente de novo.'});return;}
    ggbReply(res,200,{png:image.toPNG().toString('base64')});
   }
  }catch(e){ggbReply(res,500,{error:String(e&&e.message||e)});}
 });
 ggbServer.on('error',()=>{ggbServer=null;ggbPort=0;try{fs.rmSync(ggbBridgeFile,{force:true});}catch{}});
 ggbServer.listen(0,'127.0.0.1',()=>{
  ggbPort=ggbServer.address().port;
  try{fs.writeFileSync(ggbBridgeFile,JSON.stringify({port:ggbPort,token:ggbToken}),{mode:0o600});}catch{}
 });
}

app.on('window-all-closed',()=>app.quit());app.on('before-quit',()=>{bridge?.removeAllListeners();bridge?.stop();try{if(ggbServer){ggbServer.close();ggbServer=null;}}catch{}try{fs.rmSync(ggbBridgeFile,{force:true});}catch{}persist();});
