// @ts-check
const {app,BrowserWindow,ipcMain,dialog,shell,Menu,screen,systemPreferences,nativeImage,WebContentsView,Notification,powerMonitor,protocol,safeStorage,clipboard}=require('electron');
const crypto=require('node:crypto');
const fs=require('node:fs');const path=require('node:path');const os=require('node:os');
const {promisify}=require('node:util');const {execFile}=require('node:child_process');
const execFileAsync=promisify(execFile);
const conversations=require('./src/agents/conversations.cjs');
const {placeWindow}=require('./lib.cjs');
const {mergeCourses}=require('./courses.cjs');
const {readConfig,needsSetup,normalize,installRoot}=require('./config.cjs');
const firstRun=require('./first-run.cjs');
const {cleanStudy,authorizeRestoredStudy}=require('./study.cjs');
const layoutPolicy=require('./layout-presets.cjs');
const {createStudyServices}=require('./src/study-data/services.cjs');
const courseMaterials=require('./src/study-data/course-materials.cjs');
const materialPdf=require('./material-pdf.cjs');
const materialModel=require('./material-model.cjs');
const {createMaterialPreviewHost}=require('./material-preview-host.cjs');
const {registerBackupHost}=require('./study-backup-host.cjs');
const {restoreConfiguration}=require('./src/study-data/restore-config.cjs');
const {adoptPackage}=require('./src/study-data/adopt-package.cjs');
const {deskLayout,saveState}=require('./state-adapter.cjs');
const {isPlainObject,asString,sanitizeRotation,sanitizePdfRotations,sanitizeCourseState,sanitizeState,sanitizePdfPageOffsets,sanitizeModelRecents,sanitizeModelFavorites}=require('./desk-state-sanitize.cjs');
const {createDeskLog,processGoneEntry}=require('./desk-log.cjs');
const {createGgbCache}=require('./ggb-cache.cjs');
const {loadBootConfig,applyEnvOverrides}=require('./desk-boot-config.cjs');
const {createDeskVersionLabel}=require('./desk-version.cjs');
const {recoverFreePromotions}=require('./free-boot-recovery.cjs');
const {createTutorEngineHost}=require('./tutor-engine-host.cjs');
const {registerTutorSessionIpc}=require('./tutor-session-ipc.cjs');
const {registerTutorPromptHost}=require('./tutor-prompt-host.cjs');
const {registerChatExportHost}=require('./chat-export-host.cjs');
const {registerStudyRecordsHost}=require('./study-records-host.cjs');
const {createCourseStateHost}=require('./course-state-host.cjs');
const {createDeskMenu}=require('./desk-menu.cjs');
const {createDeskNotifier}=require('./desk-notify-host.cjs');
const {createFreePromotionHost}=require('./free-promotion-host.cjs');
const {writeConfigPreservingExtras}=require('./config-write.cjs');
const {createFreeSessionHost}=require('./free-session-host.cjs');
const {createDeskGuards}=require('./desk-guards-host.cjs');
const {createTutorBridgeHost}=require('./tutor-bridge-host.cjs');
const {createOpenCodeTutorHost}=require('./opencode-tutor-host.cjs');
const {createPromptImages}=require('./prompt-images.cjs');
const {captureWindow:captureWindowWin,listWindows:listWindowsWin}=require('./capture-win.cjs');
const {createConferirHost}=require('./conferir-host.cjs');
const {createPhoneHost}=require('./phone-host.cjs');
const {readPalette,phoneLookCss}=require('./phone-look.cjs');
const {phoneCastCss}=require('./phone-cast.cjs');
const {createLanguageHost}=require('./language-host.cjs');
const {createAppIcon}=require('./app-icon-host.cjs');
const {createOpencodeHost}=require('./opencode-host.cjs');
const {registerTriageHost}=require('./triage-host.cjs');
const {createKeyStore,electronCipher}=require('./opencode-key-store.cjs');
const {message}=require('./src/i18n.mjs');
const {invalidRequest}=require('./src/error-detail.mjs');
const {createMesaSidechat,registerSidechatIpc}=require('./sidechat-host.cjs');
const {registerFreeHost}=require('./free-host.cjs');
const {registerStudyHost}=require('./study-host.cjs');
const {registerPdfHost}=require('./pdf-host.cjs');
const {registerUpdateHost}=require('./update-host.cjs');
const {createGeogebraHost}=require('./geogebra-host.cjs');
const {packDirFor}=require('./geogebra-pack.cjs');
const {GGB_SCHEME}=require('./ggb-pack-protocol.cjs');
const free=require('./free-workspaces.cjs');
const chatLibrary=require('./src/study-data/chat-library.cjs');
const chatState=require('./src/study-data/chat-state.cjs');
const {createTutorMaterialBridge}=require('./tutor-materials.cjs');
const {createActivityStore}=require('./activity-store.cjs');
const {createActivityRuntime,ACTIVITY_SCHEME}=require('./activity-runtime.cjs');
const {createActivityBridge}=require('./activity-bridge.cjs');
const {createPdfPageReader}=require('./pdf-page-text.cjs');
const {createActivityHost}=require('./activity-host.cjs');
const {createActivityPreview}=require('./activity-preview.cjs');
const {createFigurePreview}=require('./figure-preview.cjs');
protocol.registerSchemesAsPrivileged([{scheme:ACTIVITY_SCHEME,privileges:{standard:true,secure:true,stream:true,supportFetchAPI:false,corsEnabled:false}},{scheme:GGB_SCHEME,privileges:{standard:true,secure:true,stream:true,supportFetchAPI:true,corsEnabled:true}}]);
const FREE_ID=free.freeCourseId();

app.setName('Mesa de Estudos');
const WINDOWS_APP_ID='br.com.fariadev.mesa-de-estudos';
if(process.platform==='win32')app.setAppUserModelId(WINDOWS_APP_ID);
const deskDir=__dirname;
const envRuntime=process.env.LEARNING_DESK_RUNTIME;
const persistConfig=!envRuntime;

function defaultUserData(){
 try{return app.getPath('userData');}catch{return path.join(os.homedir(),'.mesa-de-estudos');}
}

const configDir=envRuntime||defaultUserData();
fs.mkdirSync(configDir,{recursive:true});
const configFile=path.join(configDir,'config.json');
let config=loadBootConfig({configFile,env:process.env,persist:persistConfig});

const runtime=envRuntime||config.runtimePath||path.join(configDir,'runtime');
fs.mkdirSync(runtime,{recursive:true});
// A restauração interrompida deve voltar ao estado anterior antes da leitura
// das sessões e dos leitores, inclusive quando o renderer ainda não existe.
const restoredBackups=require('./src/study-data/backup.cjs').recoverRestore({runtime,log:message=>console.error('[backup]',message)});
if(restoredBackups.some(result=>!result.ok))throw Error(message('err.restore.interrupted'));
if(restoredBackups.length){const recoveredConfig=readConfig(configFile);if(recoveredConfig)config=recoveredConfig;}
const learningRoot=path.join(runtime,'learning');

const ggbCache=createGgbCache({dir:path.join(runtime,'ggb'),log:(area,line)=>appendLog(area,line)});
const logFile=path.join(runtime,'desk.log');
const appendLog=createDeskLog({logFile,logText:raw=>languageHost.logText(raw)});
process.on('uncaughtException',e=>{try{appendLog('main',e&&(e.stack||e.message)||String(e));}catch{/* o log não pode falhar o tratador de erro */}});
process.on('unhandledRejection',e=>{try{const error=/** @type {{stack?: string, message?: string}} */(e);appendLog('main',error&&(error.stack||error.message)||String(e));}catch{/* o log não pode falhar o tratador de erro */}});
/* O Electron entrega (event, details) e (event, webContents, details): até a
   #43 fase 3 o tratador lia `details` do primeiro argumento (o evento) e a
   linha saía sem tipo, motivo nem código (achado pelo tsc). */
app.on('child-process-gone',(_event,details)=>{try{const gone=processGoneEntry(details);appendLog('child-process-gone',gone.msg,gone.extra);}catch{/* o log não pode falhar o tratador de erro */}});
app.on('render-process-gone',(_event,_contents,details)=>{try{const gone=processGoneEntry(details);appendLog('render-process-gone',gone.msg,gone.extra);}catch{/* o log não pode falhar o tratador de erro */}});

const deskVersionLabel=createDeskVersionLabel({app,deskDir});

app.setPath('userData',path.join(runtime,'electron'));

/* Diário externo da promoção Livre → matéria + promoções de store sem diário.
   Roda ANTES de ler desk.json/config.json: um crash no meio da promoção deixa
   arquivos restaurados ou concluídos aqui, e o app nasce consistente. Sessões
   com diário ainda aberto não são tocadas por esta varredura (o diário decide). */
recoverFreePromotions({runtime,config,log:line=>appendLog('free',line)});
/* O diário pode ter restaurado/ajustado a config no disco: relê preservando
   os overrides de ambiente (que valem para esta execução). */
if(fs.existsSync(configFile)){
 const disk=readConfig(configFile);
 if(disk)config=applyEnvOverrides(disk,process.env);
}

const stateFile=path.join(runtime,'desk.json');
/** @type {import('./types/desk-state').DeskState} */
let state={};try{state=JSON.parse(fs.readFileSync(stateFile,'utf8'));}catch{/* sem desk.json: começa com o estado vazio */}
state=sanitizeState(state);
state.pdfPageOffsets=sanitizePdfPageOffsets(state.pdfPageOffsets);
{
 const saved=deskLayout(state);
 state.draft=saved.draft;state.theme=saved.theme;state.accent=saved.accent;state.referenceVisible=saved.referenceVisible;
 state.chatWidth=saved.chatWidth;state.calcHeight=saved.calcHeight;state.pdfSplit=saved.pdfSplit;
}
const pendingDialogs=new Set();
let courses=mergeCourses(config);
/* `needsSetup` continua sendo o das matérias de verdade: a aba Livre é virtual
   (id reservado), nunca entra no config/defaults e não desliga a primeira abertura. */
let courseId=state.courseId===FREE_ID?FREE_ID:(courses.some(c=>c.id===state.courseId)?state.courseId:(courses.find(c=>c.id==='Calculus I')?.id||courses[0]?.id||FREE_ID));
let course=courses.find(c=>c.id===courseId)?.path||'';
const courseStates=state.courseStates||{};
state.ggbBase64=state.ggbBase64||ggbCache.read(courseId);
ggbCache.remember(courseId,typeof state.ggbBase64==='string'?state.ggbBase64:'');
const allowed=new Set(),allowedXopp=new Set();let win,bridge,lastPersist='',levelsMod,appIcon=null;const pdfDisk=new Map();
const TEST_MODE=process.env.DESK_TEST==='1';
if(!TEST_MODE){if(!app.requestSingleInstanceLock())app.quit();app.on('second-instance',()=>{if(win){if(win.isMinimized())win.restore();win.show();win.focus();}});}
let session=state.session||path.join(runtime,`pi-${Date.now()}.jsonl`);
const ggb=createGeogebraHost({WebContentsView,win:()=>win,deskState:()=>state,courseKey:()=>courseId===FREE_ID?`free-${freeSessionId}`:courseId,persist:(...args)=>persist(...args)/* persist vem do host de estado, criado depois */,runtime,appendLog,tutorT:(key,args)=>languageHost.tutorT(key,args),ggbPage:TEST_MODE&&process.env.LEARNING_DESK_GGB_PAGE||undefined,
 /* Teste: só o pacote que o teste aponta (um `setup` de verdade na máquina de quem testa não pode mudar o resultado). */
 ggbPackDir:TEST_MODE?process.env.LEARNING_DESK_GGB_PACK||'':packDirFor(installRoot())});
let freeSessionId='';
/* Chave do último bloco de contexto enviado nesta sessão: contexto igual não é
   reenviado (o histórico já carrega a versão anterior). Zera quando a conversa
   troca, porque aí o histórico que "já tem" é outro. */
let lastContextKey='';
/* Exclusão da aba Livre, navegação e saída (as guardas que os hosts consultam). */
let freeMutation=false,navInFlight=false,deferredPersist=false;
let freeMutationIdle=Promise.resolve(),releaseFreeMutation=null;
let tutorMaterialGrant=null,quitting=false;
let activityGeneration=1,activityGrant=null;
/* Estado vivo do main (#43 fase 2): as variáveis continuam aqui e os hosts as
   leem e trocam por estes acessores, no padrão dos `*-host.cjs`. */
const live={
 get config(){return config;},set config(value){config=value;},
 get courses(){return courses;},set courses(value){courses=value;},
 get courseId(){return courseId;},set courseId(value){courseId=value;},
 get course(){return course;},set course(value){course=value;},
 get session(){return session;},set session(value){session=value;},
 get state(){return state;},set state(value){state=value;},
 get win(){return win;},set win(value){win=value;},
 get bridge(){return bridge;},set bridge(value){bridge=value;},
 get freeSessionId(){return freeSessionId;},set freeSessionId(value){freeSessionId=value;},
 get lastContextKey(){return lastContextKey;},set lastContextKey(value){lastContextKey=value;},
 get freeMutation(){return freeMutation;},set freeMutation(value){freeMutation=value;},
 get navInFlight(){return navInFlight;},set navInFlight(value){navInFlight=value;},
 get deferredPersist(){return deferredPersist;},set deferredPersist(value){deferredPersist=value;},
 get quitting(){return quitting;},set quitting(value){quitting=value;},
 get activityGeneration(){return activityGeneration;},set activityGeneration(value){activityGeneration=value;},
 get activityGrant(){return activityGrant;},set activityGrant(value){activityGrant=value;},
 get tutorMaterialGrant(){return tutorMaterialGrant;},set tutorMaterialGrant(value){tutorMaterialGrant=value;},
 get lastPersist(){return lastPersist;},set lastPersist(value){lastPersist=value;},
 get levelsMod(){return levelsMod;},set levelsMod(value){levelsMod=value;},
 get freeMutationIdle(){return freeMutationIdle;},set freeMutationIdle(value){freeMutationIdle=value;},
 get releaseFreeMutation(){return releaseFreeMutation;},set releaseFreeMutation(value){releaseFreeMutation=value;},
 /* Serviços criados mais abaixo: só leitura, e só depois da partida. */
 get languageHost(){return languageHost;},
 get activityBridge(){return activityBridge;},
 get activityHost(){return activityHost;},
 get activityPreview(){return activityPreview;},
 get figurePreview(){return figurePreview;},
 get materialPreviewHost(){return materialPreviewHost;},
 get opencodeHost(){return opencodeHost;},
 get sidechatManager(){return sidechatManager;},
 get studyServices(){return studyServices;},
 get tutorMaterialBridge(){return tutorMaterialBridge;},
};
/** O estado vivo que os hosts recebem (#43 fase 3: o tipo deles sai daqui). @typedef {typeof live} DeskLive */
const {piBinary,engine,isNative,openCodeBinary,claudeBinary,claudeDetector,descriptorCache,conversationData,sessionInfo,prepareClaude,prepareOpenCode,prepareClaudeSide,prepareOpenCodeSide,testClaudeSdkLoader,previewFile}=createTutorEngineHost({live,runtime,deskDir,TEST_MODE,FREE_ID});
const {readableImage,promptImages,trimMessageImages}=createPromptImages({runtime,deskDir,learningRoot,nativeImage});
const openCodeTutor=createOpenCodeTutorHost({live,runtime,ggbBridge:()=>ggb.bridgeFile,appendLog,captureActivityScope,prepareOpenCode,prepareOpenCodeSide,openCodeBinary});
const {connect,assertIdle,stopBridge,piLaunch}=createTutorBridgeHost({live,runtime,deskDir,FREE_ID,ggb,pendingDialogs,appendLog,captureActivityScope,prepareTutorMaterial,engine,prepareClaude,testClaudeSdkLoader,claudeBinary,claudeDetector,piBinary,isNative,openCodeTutor});
const {isPromotedRecord,freeRecordForToken,ensureFreeNativePath,ensureFreeRecord,createFreeSession,freeEntryOf,hydrateFreeRecord,persistFreeSession,freeSessionList,freeWorkspacePayload,focusFreeMaterial,applyFreeCourse}=createFreeSessionHost({live,runtime,FREE_ID,ggb,engine,previewFile});
const {courseSessions,rememberSession,persist,applyCourse,reviewPayload,bookmarksPayload,lastPdfModel,rememberPdfModel,materialContext,initialData}=createCourseStateHost({live,runtime,FREE_ID,stateFile,courseStates,allowed,allowedXopp,ggb,ggbCache,appendLog,previewFile,sessionInfo,conversationData,piBinary,freeSessionList,persistFreeSession,applyFreeCourse,freeWorkspacePayload,captureAvailable,deskVersionLabel});
const {isFree,assertNoFreeMutation,assertNoNav,freeMutate,activityMutate,withHostNav}=createDeskGuards({live,FREE_ID,persist,appendLog});
const {runFreePromotion}=createFreePromotionHost({live,runtime,configFile,stateFile,persistConfig,courseStates,allowedXopp,ggbCache,appendLog,freeEntryOf,previewFile,engine,stopBridge,applyCourse,persist});
const bootFree=courseId===FREE_ID?ensureFreeRecord():null;
if(bootFree)hydrateFreeRecord(bootFree);/* depois dos hosts: a hidratação pergunta o `engine` ao host do tutor */

function captureHelper(){return [path.join(__dirname,'..','visual-check','windows'),path.join(installRoot(),'visual-check','windows')].filter(Boolean).find(p=>fs.existsSync(p));}
/* A captura existe no macOS (helper visual-check + screencapture -l) e no
   Windows (PowerShell/.NET do sistema — capture-win.cjs); fora disso, some. */
function captureAvailable(){return (TEST_MODE&&!!process.env.LEARNING_DESK_CAPTURE_FIXTURE)||process.platform==='win32'||(process.platform==='darwin'&&!!captureHelper());}

function validPdf(p){if(typeof p!=='string'||!allowed.has(p))throw Error(message('err.pdf.pick'));return p;}

/* chat lateral: o gerenciador mora em sidechat-host.cjs; o main entrega o que
   lê do principal por acessores (as variáveis são reatribuídas aqui). */
const sidechatManager=createMesaSidechat({runtime,freeId:FREE_ID,session:()=>session,courseId:()=>courseId,courses:()=>courses,config:()=>config,state:()=>state,bridge:()=>bridge,engine,validPdf,allowedXopp,descriptorCache,piLaunch,prepareClaudeSide,connectOpenCodeSide:side=>openCodeTutor.connectSide(side),testClaudeSdkLoader,claudeBinary,claudeDetector,win:()=>win,appendLog,languageHost:{tutorT:(...args)=>languageHost.tutorT(...args),tutorLanguage:()=>languageHost.tutorLanguage()}});

/* ---------- aba Livre (workspace virtual `mesa-free`) ----------
   Cada conversa Livre tem workspace próprio no store (`free-workspaces.cjs`):
   título/rascunho/materiais/nativePath ficam lá; layout, estudo e rotações
   ficam por sessão em `desk.json` (`state.free.sessions`). A sessão ativa é
   sempre um `sessionId` do store; `session` é o caminho nativo (JSONL do Pi
   ou descritor Claude), e é ele que a fila/`pending` usa como chave. */
const freeJobs=new Set();
const tutorMaterialBridge=createTutorMaterialBridge({createMaterial:prepareTutorMaterial,tutorText:raw=>languageHost.tutorText(raw)});
const activityStore=createActivityStore({runtime});
const activityRuntime=createActivityRuntime({store:activityStore});
function captureActivityScope(){return {courseId,conversationId:session,freeSessionId,generation:activityGeneration};}
function activityScopeIsCurrent(scope){return !quitting&&!navInFlight&&scope.courseId===courseId&&scope.conversationId===session&&scope.freeSessionId===freeSessionId&&scope.generation===activityGeneration;}
function trustedMainSender(event){return !!win&&!win.isDestroyed()&&event.sender===win.webContents&&event.senderFrame===win.webContents.mainFrame;}
/* Prévia do tutor (#42): janela escondida, offline, com o mesmo quadro isolado
   da conversa (sessão, protocolo e guardas do runtime). Mede antes de publicar
   e responde à ferramenta de prévia; nada é gravado. */
let previewSessionReady=null;
function previewSession(){
 if(previewSessionReady)return previewSessionReady;
 const ses=require('electron').session.fromPartition('mesa-activity-preview');
 activityRuntime.installProtocol(ses);
 activityRuntime.installSessionGuards(ses);
 ses.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));
 previewSessionReady=ses;
 return ses;
}
const activityPreview=createActivityPreview({runtime:activityRuntime,columnWidth:()=>activityHost.columnWidth(),
 createWindow:({width,height})=>{
  /* Partição própria e em memória (sem `persist:`): a prévia roda em outro
     processo — um laço no documento do tutor não trava os quadros da
     conversa — e nada vai para o disco. Protocolo e guardas do runtime valem
     nela também. */
  const ses=previewSession();
  const preview=new BrowserWindow({show:false,width,height,useContentSize:true,paintWhenInitiallyHidden:true,skipTaskbar:true,focusable:false,
   webPreferences:{session:ses,sandbox:true,contextIsolation:true,nodeIntegration:false,backgroundThrottling:false,spellcheck:false}});
  preview.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  preview.webContents.on('will-navigate',event=>event.preventDefault());
  activityRuntime.attachWindow(preview,{watchdog:false});
  return preview;
 }});
const figurePreview=createFigurePreview();
const pdfPageReader=createPdfPageReader();
const activityHost=createActivityHost({store:activityStore,runtime:activityRuntime,captureScope:captureActivityScope,scopeIsCurrent:activityScopeIsCurrent,mutate:activityMutate,allowSender:trustedMainSender,
 measure:spec=>activityPreview.measure(spec),
 emit:event=>{if(win&&!win.isDestroyed())win.webContents.send('desk-activity',event);},
});
activityHost.register(ipcMain);
/* OpenCode (#57): o MCP não sabe o id da chamada; `identifyCaller` o casa pelo SSE. */
const activityBridge=createActivityBridge({publish:async(scope,spec,caller)=>activityHost.publish(scope,spec,await openCodeTutor.identifyCaller(caller)),preview:(raw,options)=>activityPreview.preview(raw,options),figure:raw=>figurePreview.preview(raw),
 /* #70: o OpenCode não lê PDF; `ler_pdf` pede o texto só de PDFs da biblioteca autorizada. */
 pdfPage:raw=>pdfPageReader.read({file:validPdf(raw.path),first:raw.first,last:raw.last}),
 tutorText:raw=>languageHost.tutorText(raw)});
const materialPreviewHost=createMaterialPreviewHost({
 renderPdf:options=>materialPdf.renderPdf(options),
 captureScope:()=>({courseId,session,freeSessionId}),
 scopeIsCurrent:scope=>!quitting&&!navInFlight&&scope.courseId===courseId&&scope.session===session&&scope.freeSessionId===freeSessionId,
 allowSender:trustedMainSender,
 contextName:materialContext,
});
materialPreviewHost.register(ipcMain);
function materialEvent(scope,payload){if(win&&!win.isDestroyed())win.webContents.send('tutor-material',{courseId:scope.courseId,conversationId:scope.session,...payload});}
/** @param {import('./types/host-deps').MaterialScope} scope @param {{title?: string, markdown?: string, modelo?: string, opcoes?: object, signal?: AbortSignal}} [request] */
async function prepareTutorMaterial(scope,{title,markdown,modelo,opcoes,signal}={}){
 return freeMutate('tutor-pdf',async()=>{
  if(scope.courseId!==courseId||scope.session!==session||(isFree()&&scope.freeSessionId!==freeSessionId))throw Error(message('err.pdf.sessionChanged'));
  if(signal?.aborted)throw Error(message('err.pdf.prepCancelled'));
  const checked=await materialPdf.checkMaterial({title,markdown});
  if(signal?.aborted)throw Error(message('err.pdf.prepCancelled'));
  if(scope.courseId!==courseId||scope.session!==session||(isFree()&&scope.freeSessionId!==freeSessionId))throw Error(message('err.pdf.sessionChanged'));
  /* Pedido do tutor → último modelo da matéria/sessão → Livre; as opções do
     pedido valem sobre as do último modelo, que só voltam se for o mesmo. */
  const last=lastPdfModel();
  const picked=materialModel.resolveModel({requested:modelo,last:last?.model});
  const options=materialModel.normalizeOptions(picked.id,opcoes!==undefined?opcoes:(last&&last.model===picked.id?last.options:undefined));
  const draft={id:crypto.randomUUID(),title,markdown,model:picked.id,options,modelSource:picked.source};
  const validation={diagnostics:checked.diagnostics,templateHash:checked.templateHash};
  if(isFree()){
   const workspace=free.updateWorkspace(runtime,scope.freeSessionId,{pdfDraft:draft});
   materialEvent(scope,{status:'prepared',draft,workspace:freeWorkspacePayload(workspace),...validation});
  }else{
   const prepared=courseMaterials.prepareDraft(runtime,scope,{title,markdown,model:draft.model,options:draft.options,modelSource:draft.modelSource});
   materialEvent(scope,{status:'prepared',draft:prepared,...validation});
  }
  return {prepared:true,reviewRequired:true,title:draft.title,model:draft.model,options:draft.options,...validation,message:checked.blocking.length?checked.message:'Conteúdo pronto no diálogo de PDF. O usuário deve revisar e clicar em Salvar PDF e abrir. O arquivo PDF ainda não foi salvo.'};
 });
}







const deskMenu=createDeskMenu({live,Menu,captureAvailable});
deskMenu.register(ipcMain);
const {buildMenu}=deskMenu;

app.whenReady().then(async()=>{
 openCodeTutor.sweepAtBoot();
 await tutorMaterialBridge.start().catch(error=>appendLog('tutor-pdf',error.message));
 await activityBridge.start().catch(error=>appendLog('activity',error.message));
 if(quitting)return;
 if(TEST_MODE&&process.platform==='darwin'){try{app.setActivationPolicy('accessory');}catch{/* só existe no macOS */}try{app.dock?.hide();}catch{/* só existe no macOS */}}
 /* #61: com o app aberto, o Dock e a janela seguem a cor de acento. */
 appIcon=createAppIcon({app,platform:process.platform,assetsDir:path.join(__dirname,'assets'),dockEnabled:!TEST_MODE});
 appIcon.apply(null,state.accent);
 app.setAboutPanelOptions({applicationName:'Mesa de Estudos',applicationVersion:app.getVersion(),copyright:languageHost.t('about.copyright'),iconPath:path.join(__dirname,'assets','mesa-1024.png')});
 const displays=screen.getAllDisplays();
 const placed=placeWindow(displays,screen.getPrimaryDisplay().id,state.bounds);
 win=new BrowserWindow({width:placed.width,height:placed.height,...(placed.x!=null?{x:placed.x,y:placed.y}:{}),minWidth:900,minHeight:650,title:'Mesa de Estudos',icon:path.join(__dirname,'assets',process.platform==='win32'?'mesa.ico':'mesa-1024.png'),backgroundColor:state.theme==='dark'?'#1f1f1f':'#efefef',show:!TEST_MODE,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,spellcheck:false,additionalArguments:[`--mesa-language=${languageHost.ui()}`]}});
 for(const event of ['hide','minimize'])win.on(event,()=>studyServices.lifecycle('hide'));
 /* Recarregar a página fecha o popover da Foto do celular: o servidor vai junto (#36). */
 win.webContents.on('did-start-loading',()=>phoneHost.stop());
 win.on('closed',()=>phoneHost.stop());
 for(const event of ['show','restore'])win.on(event,()=>studyServices.lifecycle('show'));
 if(process.platform==='win32'){
  // O botão da barra de tarefas também precisa da identidade/ícone próprios.
  // Em npm start, relançar o Electron exige o caminho absoluto da Mesa;
  // num executável empacotado, basta relançar o próprio executável.
  const args=process.defaultApp?[process.execPath,app.getAppPath()]:[process.execPath];
  win.setAppDetails({appId:WINDOWS_APP_ID,appIconPath:path.join(__dirname,'assets','mesa.ico'),appIconIndex:0,relaunchCommand:args.map(arg=>'"'+arg+'"').join(' '),relaunchDisplayName:'Mesa de Estudos'});
 }
 appIcon.apply(win,state.accent);
 activityRuntime.installProtocol(win.webContents.session);
 activityRuntime.installSessionGuards(win.webContents.session);
 activityRuntime.attachWindow(win);
 win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',(e,url)=>{if(url!==win.webContents.getURL())e.preventDefault();});
 buildMenu();
 ggb.start();
 win.on('resize',()=>{ggb.captureConstruction();ggb.placeView();});win.on('move',ggb.placeView);
 /* O reload do renderer (⌘R) derruba a página que ligava a View nativa: sem
    isso a view fica presa por cima de uma Mesa que nem sabe que ela existe. */
 win.webContents.on('did-start-navigation',(_e,_url,_isInPlace,isMainFrame)=>{if(isMainFrame)ggb.hideView();});
 win.on('close',()=>persist());win.loadFile(path.join(__dirname,'index.html'));
 scheduleUpdateCheck();
});

const deskNotifier=createDeskNotifier({app,Notification,live,TEST_MODE});
ipcMain.handle('init',initialData);
ipcMain.handle('test-mode',()=>TEST_MODE);
deskNotifier.register(ipcMain);
ipcMain.handle('desk-log',(_e,line)=>{appendLog('renderer',typeof line==='string'?line:(line&&(line.stack||line.message))||String(line),{level:'error'});});
ipcMain.handle('switch-course',async(_e,id)=>withHostNav(async()=>{
 if(typeof id!=='string'||(id!==FREE_ID&&!courses.some(c=>c.id===id)))throw Error(message('err.course.notFound'));
 await assertIdle(message('err.idle.switchCourse'));
 persist();stopBridge();applyCourse(id);persist();return initialData();
}));
/* PDFs e imagens da mesa (open-pdf … open-image): pdf-host.cjs, mesma posição de registro. */
registerPdfHost({ipcMain,dialog,shell,win:()=>win,runtime,freeId:FREE_ID,allowed,pdfDisk,course:()=>course,courseId:()=>courseId,config:()=>config,state:()=>state,freeSessionId:()=>freeSessionId,isPlainObject,isFree,validPdf,readableImage,assertNoFreeMutation,assertNoNav,assertIdle,freeMutate,focusFreeMaterial,persist,initialData});
ipcMain.handle('save-state',(_e,value)=>{
 const pdfs=(value.pdfs||[]).slice(0,2).filter(p=>!p?.path||allowed.has(p.path)).map(p=>({path:p.path,page:p.page,zoom:p.zoom,rotation:sanitizeRotation(p.rotation),scrollX:Number(p.scrollX)||0,scrollY:Number(p.scrollY)||0,invert:!!p.invert,minimized:!!p.minimized}));
 const pdfRotations=sanitizePdfRotations(value.pdfRotations);
 const study=cleanStudy(value.study);
 if(study.xopp&&!allowedXopp.has(study.xopp))study.xopp='';
 /* O adaptador monta os fatos e o núcleo decide (fallbacks por campo
    documentados em state-adapter.cjs). */
 const layout=saveState(state,value);
 const theme=layout.theme;
 state={...state,draft:layout.draft,study,pdfs,pdfRotations,referenceVisible:layout.referenceVisible,chatWidth:layout.chatWidth,calcHeight:layout.calcHeight,pdfSplit:layout.pdfSplit,theme,accent:layout.accent,viewLayout:layoutPolicy.normalizeViewLayout(value?.viewLayout)??state.viewLayout??null,modelRecents:value?.modelRecents===undefined?state.modelRecents:sanitizeModelRecents(value.modelRecents),modelFavorites:value?.modelFavorites===undefined?state.modelFavorites:sanitizeModelFavorites(value.modelFavorites)};
 if(win&&!win.isDestroyed())win.setBackgroundColor(theme==='dark'?'#1f1f1f':'#efefef');
 appIcon?.apply(win,state.accent);
 persist();
});
ipcMain.handle('layout-presets-get',()=>layoutPolicy.read(state));
ipcMain.handle('layout-presets-save',(_e,payload)=>{
 assertNoFreeMutation();assertNoNav();
 const result=layoutPolicy.modify(state.layoutPresets,payload);
 if(!result.ok)throw Error(result.error);
 state={...state,layoutPresets:result.store};persist();return result.store;
});
const {cancelReviewDraft}=registerStudyRecordsHost({ipcMain,live,runtime,allowed,allowedXopp,appendLog,engine,piBinary,claudeBinary,claudeDetector,testClaudeSdkLoader,bookmarksPayload,reviewPayload,assertNoFreeMutation,assertNoNav});
registerChatExportHost({ipcMain,live,runtime,envRuntime,dialog,shell,appendLog,engine,testClaudeSdkLoader});
ipcMain.handle('get-config',()=>({config:normalize(config),detectedPi:piBinary(),...conversationData({messages:false}),captureAvailable:captureAvailable(),platform:process.platform,needsSetup:needsSetup(config,courses),deskVersion:deskVersionLabel()}));
ipcMain.handle('pick-folder',async()=>{const r=await dialog.showOpenDialog(win,{properties:['openDirectory']});return r.canceled?null:r.filePaths[0];});
/* Primeira abertura dentro do app (ticket #21). O que a pessoa soltou na folha
   vira a pasta da matéria (`first-run.cjs`); a pasta de dados sugerida só é
   criada na confirmação; o resto (gravar matéria e pasta de dados na
   configuração local) é o `save-config` de sempre. */
ipcMain.handle('first-run-defaults',()=>({dataFolder:firstRun.suggestedDataFolder(config,os.homedir())}));
ipcMain.handle('first-run-prepare',(_e,folder)=>({path:firstRun.prepareDataFolder(folder)}));
ipcMain.handle('first-run-resolve-drop',(_e,paths)=>firstRun.resolveDrop(paths));
ipcMain.handle('pick-file',async()=>{const r=await dialog.showOpenDialog(win,{properties:['openFile']});return r.canceled?null:r.filePaths[0];});
ipcMain.handle('pick-xopp',async()=>{const r=await dialog.showOpenDialog(win,{filters:[{name:'Xournal++',extensions:['xopp']}],properties:['openFile']});
 if(r.canceled)return null;
 const file=r.filePaths[0];
 allowedXopp.add(file);
 return file;});
ipcMain.handle('detect-pi',()=>piBinary());
ipcMain.handle('save-config',async(_e,next)=>withHostNav(async()=>{
 await assertIdle(message('err.idle.settings'));
 const incoming=normalize(next||{});
 if(incoming.runtimePath&&path.resolve(incoming.runtimePath)!==path.resolve(runtime)){
  throw Error(message('err.runtime.cannotChange'));
 }
 if(persistConfig)writeConfigPreservingExtras(configFile,incoming);
 config=incoming;
 courses=mergeCourses(config);
 persist();stopBridge();
 if(courseId===FREE_ID)applyFreeCourse();
 else if(!courses.some(c=>c.id===courseId))applyCourse(courses[0]?.id||FREE_ID);
 persist();buildMenu();
 return initialData();
}));

registerTutorSessionIpc({ipcMain,live,runtime,deskDir,pendingDialogs,appendLog,engine,connect,stopBridge,assertIdle,persist,courseSessions,conversationData,captureAvailable,trimMessageImages,piBinary,isNative});
registerTutorPromptHost({ipcMain,live,runtime,FREE_ID,allowedXopp,ggb,appendLog,engine,connect,promptImages,validPdf,assertNoFreeMutation,assertNoNav});
/* ---------- chat lateral: IPC e listagem de conversas ----------
   O manager valida escopo (conversa principal + matéria) e limites; o preload
   já corta o que é obviamente inválido. A listagem é SÓ leitura do que o main
   já tem em memória (`courseSessions`), sem iniciar agente nem escrever nada. */
registerSidechatIpc({ipcMain,sidechatManager,courseSessions});
const studyServices=createStudyServices({runtime:()=>runtime,courses:()=>[{id:FREE_ID,name:'Livre'},...courses],scope:()=>({courseId,conversation:session,freeSessionId:courseId===FREE_ID?freeSessionId:''}),allowed:()=>allowed,persist,log:appendLog});
const backupHost=registerBackupHost({ipcMain,dialog,shell,t:(key,args)=>languageHost.t(key,args),win:()=>win,runtime:()=>runtime,deskDir,courses:()=>courses,courseId:()=>courseId,persist:()=>persist(true),idle:async reason=>{if(sidechatManager.isBusy())throw Error(message('err.sidechat.busy'));
  await assertIdle(reason);},mutate:freeMutate,stop:stopBridge,log:appendLog,
 external:()=>[...(!path.resolve(configFile).startsWith(path.resolve(runtime)+path.sep)?[{path:configFile,ref:'mesa-config.json',resume:'preferences'}]:[]),...libraryAuthorizedChats().filter(row=>!path.resolve(row.session).startsWith(path.resolve(runtime)+path.sep)).map(row=>({path:row.session,ref:'session-'+crypto.createHash('sha256').update(row.session).digest('hex').slice(0,24)+path.extname(row.session),resume:'transcript-only'}))],
 afterRestore(result){
  state=sanitizeState(JSON.parse(fs.readFileSync(stateFile,'utf8')));
  const disk=restoreConfiguration({configFile,runtime,result,services:backupHost.services});if(disk){config=disk;if(process.env.LEARNING_DESK_PI)config.piPath=process.env.LEARNING_DESK_PI;}
  courses=mergeCourses(config);for(const key of Object.keys(courseStates))delete courseStates[key];Object.assign(courseStates,state.courseStates);
  const target=state.courseId===FREE_ID?FREE_ID:(courses.find(c=>c.id===state.courseId)?.id||courses[0]?.id||FREE_ID);
  pdfDisk.clear();ggbCache.clear();lastPersist='';applyCourse(target);return initialData();
 },
 adopt(result){
  if(courses.some(c=>c.id===result.courseId))throw Error(message('err.course.importExists'));
  const next=normalize({...config,courses:[...(config.courses||[]),result.course]});
  const adopted=adoptPackage({runtime,result,writeConfiguration:()=>writeConfigPreservingExtras(configFile,next)});
  config=next;courses=mergeCourses(config);courseStates[result.courseId]=sanitizeCourseState({sessions:adopted.sessions,session:adopted.sessions[0]?.path||''});persist(true);return initialData();
 }
});
const backupTimer=setInterval(()=>{if(freeMutation||navInFlight||quitting)return;
 backupHost.auto().catch(error=>{if(!/Pare a resposta|Aguarde/.test(error.message))appendLog('backup',error.message);});},60000);
backupTimer.unref();
let systemAwake=true;
app.whenReady().then(()=>{
 powerMonitor?.on('suspend',()=>{systemAwake=false;studyServices.lifecycle('suspend');});
 powerMonitor?.on('resume',()=>{systemAwake=true;studyServices.lifecycle('resume');});
});
const studyTimer=setInterval(()=>{if(freeMutation||quitting)return;
 studyServices.beat(systemAwake&&!!win&&!win.isDestroyed()&&win.isVisible()&&!win.isMinimized()&&(powerMonitor?.getSystemIdleTime?.()??Infinity)<120);},15000);
studyTimer.unref();
registerStudyHost({ipcMain,studyServices,sidechatManager,runtime,freeId:FREE_ID,courseStates,courses:()=>courses,courseId:()=>courseId,session:()=>session,state:()=>state,isPlainObject,asString,withHostNav,assertIdle,assertNoFreeMutation,assertNoNav,freeRecordForToken,libraryAuthorizedChats,courseSessions,openSessionWithinNav,persist,stopBridge,applyCourse,initialData});
function libraryAuthorizedChats(){
 const rows=[],seen=new Set();
 const add=(item,id,name)=>{
  const file=item.path||item.session;if(!file)return;
  const key=JSON.stringify([id,file]);if(seen.has(key))return;seen.add(key);
  const info=sessionInfo(file);
  rows.push({...item,session:file,courseId:id,courseName:name,engine:info.engine||item.engine,
   preview:info.preview||item.preview||previewFile(file),title:item.title||'',current:id===courseId&&file===session});
 };
 for(const c of courses){
  const items=c.id===courseId?courseSessions():(courseStates[c.id]?.sessions||[]);
  for(const item of items)if(item.path&&(fs.existsSync(item.path)||(c.id===courseId&&item.path===session)))add(item,c.id,c.name);
 }
 for(const item of freeSessionList())if(!item.promoted)add({...item,title:item.label},FREE_ID,languageHost.t('free.tab'));
 return rows;
}
ipcMain.handle('library-chats',()=>chatLibrary.list(runtime,libraryAuthorizedChats()));
ipcMain.handle('library-chat-update',(_e,payload)=>chatLibrary.update(runtime,payload?.id,payload?.patch,libraryAuthorizedChats()));
ipcMain.handle('library-chat-open',async(_e,id)=>withHostNav(async()=>{
 const target=chatLibrary.resolve(runtime,id,libraryAuthorizedChats());
 await assertIdle(message('err.idle.switchSession'));
 if(target.courseId!==courseId){persist();stopBridge();applyCourse(target.courseId);}
 return openSessionWithinNav(target.session);
}));
ipcMain.handle('new-session',async(_e,options={})=>withHostNav(async()=>{
 if(options.engine!=null&&!['pi','claude','opencode'].includes(options.engine))throw Error(invalidRequest('new-session','engine',options.engine,'"pi"|"claude"|"opencode"|null'));
 await assertIdle(message('err.idle.newSession'));
 if(courseId===FREE_ID){
  /* Conversa Livre nova: workspace/vazio próprio, caminho nativo único (Pi
     nasce sem JSONL — o store lista mesmo assim) e caminho pelo seletor. */
  persist();stopBridge();
  createFreeSession(options.engine||'pi');
  lastContextKey='';allowedXopp.clear();state={...state,draft:'',study:{title:'',xopp:''}};
  persist();
  return initialData();
 }
 persist();
 rememberSession();
 stopBridge();
 session=isNative(options.engine)?conversations.createClaudeConversation({runtime,courseId,engine:options.engine}):path.join(runtime,`pi-${Date.now()}.jsonl`);
 lastContextKey='';
 state={...state,draft:'',study:{title:'',xopp:''}};
 persist();
 return initialData();
}));
async function openSessionWithinNav(file){
 if(typeof file!=='string'||!file)throw Error(invalidRequest('open-session','file',file,'string(1..)'));
 if(courseId===FREE_ID){
  const record=freeRecordForToken(file);
  if(!record)throw Error(message('err.session.notFound'));
  /* Conversa promovida não pode continuar em dois escopos: a lista do Livre
     continua mostrando o título, mas abrir leva para a matéria de destino. */
  if(isPromotedRecord(record)){
   const promoted=courses.find(c=>c.id===record.promotion.courseId);
   if(!promoted)throw Error(message('err.session.promotedMissing'));
   await assertIdle(message('err.idle.switchSession'));
   persist();stopBridge();applyCourse(promoted.id);persist();
   return initialData();
  }
  if(record.nativePath&&record.nativePath===session)return initialData();
  await assertIdle(message('err.idle.switchSession'));
  const target=record.nativePath?record:ensureFreeNativePath(record);
  persist();stopBridge();hydrateFreeRecord(target);lastContextKey='';allowedXopp.clear();persist();
  return initialData();
 }
 if(file===session)return initialData();
 const allowedSessions=courseSessions();
 if(!allowedSessions.some(s=>s.path===file))throw Error(message('err.session.notFound'));
 if(!fs.existsSync(file))throw Error(message('err.session.fileGone'));
 await assertIdle(message('err.idle.switchSession'));
 persist();rememberSession();stopBridge();session=file;lastContextKey='';allowedXopp.clear();
 state=chatState.restore(state,courseStates[courseId],file);
 state.study=authorizeRestoredStudy(state.study,allowedXopp);persist();
 return initialData();
}
ipcMain.handle('open-session',async(_e,file)=>withHostNav(()=>openSessionWithinNav(file)));
/* APIs da aba Livre e `course-save-material`: free-host.cjs (mesma posição de registro). */
registerFreeHost({ipcMain,dialog,win:()=>win,runtime,courses:()=>courses,courseId:()=>courseId,session:()=>session,freeSessionId:()=>freeSessionId,state:()=>state,setState:next=>{state=next;},allowed,freeJobs,isFree,isPromotedRecord,freeMutate,assertIdle,focusFreeMaterial,runFreePromotion,persist,initialData,appendLog,contextName:materialContext,rememberPdfModel,t:(key,args)=>languageHost.t(key,args)});
/* Conferir (capture-ready/windows/choose/default): conferir-host.cjs. A decisão
   de qual janela capturar é do núcleo (core/conferir.bend); aqui ficam o
   helper do macOS, o `screencapture`, a permissão de tela e o PowerShell do
   Windows, entregues ao host como funções. */
function conferirFixture(){
 /* Teste: lista e captura vêm de um JSON (nunca a tela de verdade). Só em
    TEST_MODE e só de dentro dos fixtures do repo ou do runtime do teste. */
 const file=process.env.LEARNING_DESK_CAPTURE_FIXTURE;
 if(!TEST_MODE||!file)return null;
 const real=fs.realpathSync(file);
 const roots=[path.join(deskDir,'tests','fixtures'),fs.realpathSync(runtime)];
 if(!roots.some(root=>real.startsWith(root+path.sep)))throw Error(`Captura simulada fora dos fixtures: ${path.basename(real)} não está em tests/fixtures nem no runtime do teste.`);
 const read=()=>JSON.parse(fs.readFileSync(real,'utf8'));
 return {read,capture:fact=>{const data=read();const hit=(data.windows||[]).find(w=>String(w.id)===fact.id);return {title:hit?.title||fact.title,dataUrl:hit?.dataUrl||data.dataUrl};}};
}
/* LEARNING_DESK_LOCALE fixa o "idioma do sistema" nos testes de janela. */
const languageHost=createLanguageHost({
 ipcMain,
 state:()=>state,
 patchState:patch=>{state={...state,...patch};persist(true);},
 systemLocale:()=>process.env.LEARNING_DESK_LOCALE||app.getLocale?.()||Intl.DateTimeFormat().resolvedOptions().locale,
 onChange:()=>{if(win&&!win.isDestroyed())buildMenu();},
 /* O prompt do tutor é montado ao ligar; derrubar a ponte parada faz o renderer ligar de novo já no idioma novo. */
 relinkTutor:async()=>{
  if(!bridge)return {relinked:false};
  if(await toolHost.isBusy())return {relinked:false,busy:true};
  persist();stopBridge();
  return {relinked:true};
 }
});
/* Link para o navegador do sistema; em teste, só gravado em `opened-links.jsonl` (#44, #62). */
function openExternalLink(url){
 if(!TEST_MODE)return shell.openExternal(url);
 fs.appendFileSync(path.join(runtime,'opened-links.jsonl'),JSON.stringify({url})+'\n');
 return true;
}
/* Modelos grátis do OpenCode Zen (#44). Os fakes dos testes (área de transferência, cifra, console, pasta do OpenCode e navegador) só valem em modo de teste. */
const opencodeCipher=TEST_MODE&&process.env.LEARNING_DESK_SECRET_CIPHER?require(process.env.LEARNING_DESK_SECRET_CIPHER):electronCipher(safeStorage);
const opencodeHost=createOpencodeHost({
 ipcMain,
 keyStore:createKeyStore({dir:runtime,cipher:opencodeCipher}),
 state:()=>state,
 patchState:patch=>{state={...state,...patch};persist(true);},
 fetchImpl:fetch,
 /* Em teste, sem console falso apontado, nada sai para a rede: a porta 9 recusa. */
 baseUrl:TEST_MODE?(process.env.LEARNING_DESK_OPENCODE_BASE||'http://127.0.0.1:9'):undefined,
 homeDir:TEST_MODE&&process.env.LEARNING_DESK_OPENCODE_HOME?process.env.LEARNING_DESK_OPENCODE_HOME:os.homedir(),
 xdgDataHome:TEST_MODE?'':(process.env.XDG_DATA_HOME||''),
 readClipboard:()=>TEST_MODE&&process.env.LEARNING_DESK_FAKE_CLIPBOARD?fs.readFileSync(process.env.LEARNING_DESK_FAKE_CLIPBOARD,'utf8'):clipboard.readText(),
 openExternal:openExternalLink,
 /* O Pi lê a chave do ambiente ao nascer: derrubar a ponte parada faz o renderer ligar de novo já com ela. */
 relinkTutor:async()=>{
  if(!bridge)return {relinked:false};
  if(await toolHost.isBusy())return {relinked:false,busy:true};
  persist();stopBridge();
  return {relinked:true};
 },
 appendLog
});
opencodeHost.refreshLive();
/* Relatar um problema (#62): relatório limpo e as três saídas, montados fora do processo principal. */
registerTriageHost({ipcMain,openExternal:openExternalLink,electronVersion:process.versions.electron||''});
const conferirHost=createConferirHost({
 ipcMain,
 state:()=>state?.conferirApp,
 setChoice:value=>{state.conferirApp=value;persist();if(win&&!win.isDestroyed())buildMenu();},
 selfNames:()=>[app.getName(),'Mesa de Estudos',...(app.isPackaged?[]:['Electron'])],
 fixture:conferirFixture(),
 ensurePermission:async()=>{
  if(process.platform!=='darwin')return;
  let status=systemPreferences.getMediaAccessStatus('screen');
  if(status!=='granted'){
   /* Não há pedido de tela no Electron: `askForMediaAccess` só aceita câmera e
      microfone e recusava 'screen' (o catch engolia). O aviso do macOS sai na
      primeira captura; até lá vale a mensagem de autorização (#43 fase 3). */
   status=systemPreferences.getMediaAccessStatus('screen');
   if(status!=='granted')throw Error(message('err.capture.permission'));
  }
 },
 listWindows:async()=>{
  /* Windows: processos com janela via PowerShell/.NET do sistema (capture-win.cjs). */
  if(process.platform==='win32')return listWindowsWin();
  const helper=captureHelper();
  if(!helper)throw Error(message('err.capture.helperMissing'));
  const {stdout}=await execFileAsync(helper,[],{timeout:15000,maxBuffer:1024*1024});
  let listed;try{listed=JSON.parse(stdout);}catch{throw Error(message('err.capture.listFail'));}
  if(!listed.permission)throw Error(message('err.capture.permission'));
  return Array.isArray(listed.windows)?listed.windows:[];
 },
 captureWindow:async(window,label)=>{
  if(process.platform==='win32')return captureWindowWin({processName:window.app,label});
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mesa-visual-'));
  try{
   const file=path.join(dir,'attempt.png');
   await execFileAsync('/usr/sbin/screencapture',['-x','-o',`-l${window.id}`,file],{timeout:15000});
   const bytes=fs.readFileSync(file);
   if(bytes.length<100||bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw Error(message('err.capture.notPng'));
   return {title:window.title||label,dataUrl:'data:image/png;base64,'+bytes.toString('base64')};
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
 },
});
conferirHost.register();
/* Foto do celular (#36): o servidor da rede local só sobe pelo popover (`phone-start`) e desliga ao fechá-lo, com 10 min sem uso ou ao fechar a Mesa.
   Em teste, LEARNING_DESK_PHONE_HOST força o endereço (127.0.0.1): o cliente HTTP do teste faz o papel do celular. */
let phonePaletteCache=null;
const phonePalette=()=>phonePaletteCache??=readPalette(fs.readFileSync(path.join(__dirname,'style.css'),'utf8'));
/* O trio da página do celular (#66): tokens de movimento, trio.css e o layout, lidos uma vez. */
let phoneCastCache=null;
const readDeskText=(name)=>fs.readFileSync(path.join(__dirname,name),'utf8');
const phoneCast=()=>phoneCastCache??=phoneCastCss({styleCss:readDeskText('style.css'),motionCss:readDeskText('src/motion.css'),trioCss:readDeskText('src/trio.css'),pageCss:readDeskText('src/phone-page.css')});
const phoneHost=createPhoneHost({
 ipcMain,
 t:(key,args)=>languageHost.t(key,args),
 language:()=>languageHost.ui(),
 /* A página do celular segue o tema e o acento da Mesa; as cores vêm do style.css. */
 lookCss:()=>phoneLookCss({theme:state.theme,accent:state.accent,palette:phonePalette()}),
 castCss:phoneCast,
 interfaces:()=>os.networkInterfaces(),
 forcedAddress:TEST_MODE?(process.env.LEARNING_DESK_PHONE_HOST||''):'',
 send:(channel,payload)=>{if(win&&!win.isDestroyed())win.webContents.send(channel,payload);},
 appendLog,
});
phoneHost.register();
ipcMain.handle('open-xournal',()=>{
 const target=config.xournalPath||(process.platform==='darwin'?'/Applications/Xournal++.app':'');
 if(!target)throw Error(message('err.capture.pathMissing'));
 return shell.openPath(target);
});

/* Avisos de atualização do Pi e do Claude Code (#45). Os fixtures só existem no
   modo de teste: versões "mais novas" injetadas, uma pasta de binários falsos
   (`brew`/`npm`/`claude`) que é a ÚNICA onde o comando é procurado, e o launcher
   do Claude. Nenhum teste fala com a rede nem roda o `brew` de verdade. */
function toolTestFixtures(){
 if(!TEST_MODE)return {};
 const fixtures={};
 try{
  const latest=JSON.parse(process.env.LEARNING_DESK_TOOL_LATEST||'null');
  if(latest&&typeof latest==='object')fixtures.latestOverride=latest;
 }catch{/* fixture inválida: sem versão injetada */}
 if(process.env.LEARNING_DESK_TOOL_FAKE_BIN){
  fixtures.searchDirs=[process.env.LEARNING_DESK_TOOL_FAKE_BIN];
  fixtures.allowRunInTest=true;
 }
 if(process.env.LEARNING_DESK_CLAUDE_LAUNCHER!==undefined)fixtures.claudeLauncher=process.env.LEARNING_DESK_CLAUDE_LAUNCHER;
 /* O Pi "instalado" que os avisos leem (Cellar falso), separado do `LEARNING_DESK_PI` que o tutor executa. */
 if(process.env.LEARNING_DESK_TOOL_PI_PATH)fixtures.piPath=process.env.LEARNING_DESK_TOOL_PI_PATH;
 return fixtures;
}
const toolHost={
 state:()=>state,persist:()=>persist(),
 isBusy:async()=>{try{await assertIdle('ocupado');return false;}catch{return true;}},
 hasBridge:()=>!!bridge,
 relink:()=>{persist();stopBridge();},
 fixtures:toolTestFixtures(),
};
const {scheduleUpdateCheck}=registerUpdateHost({ipcMain,app,shell,runtime,deskDir,logFile,testMode:TEST_MODE,config:()=>config,win:()=>win,piBinary,appendLog,toolHost});
ggb.register(ipcMain);

app.on('window-all-closed',()=>app.quit());
app.on('before-quit',()=>{quitting=true;
 phoneHost.stop();
 materialPreviewHost.cancel();
 activityHost.invalidate();
 activityBridge.close().catch(()=>{/* encerrando: ponte já fechada */});
 studyServices.lifecycle('freeze');
 tutorMaterialBridge.close().catch(()=>{/* encerrando: ponte já fechada */});
 try{sidechatManager?.suspend('encerrando o aplicativo');}catch{/* encerrando: o chat lateral já parou */}cancelReviewDraft();
 for(const controller of freeJobs)try{controller.abort();}catch{/* encerrando: a geração já terminou */}bridge?.removeAllListeners();
 bridge?.stop();
 openCodeTutor.stop();
 ggb.close();
 persist();});
