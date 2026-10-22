// @ts-check
'use strict';

const fs=require('node:fs');
const path=require('node:path');
const conversations=require('./src/agents/conversations.cjs');
const pendingCore=require('./src/generated/pending.core.js').default;
const free=require('./free-workspaces.cjs');
const {PiBridge}=require('./rpc.cjs');
const {ClaudeService}=require('./src/agents/service.cjs');
const {ClaudeAdapter}=require('./src/agents/claude-adapter.cjs');
const {nativePersistence}=require('./src/agents/native-persistence.cjs');
const {piPrompt}=require('./src/agents/desk-prompts.cjs');
const {spawnEnv}=require('./pi.cjs');
const {createUsageEvents}=require('./src/study-data/usage-events.cjs');
const {pinnedArgs}=require('./profiles.cjs');
const {message}=require('./src/i18n.mjs');

/* Ponte do tutor da conversa ativa (#43 fase 2: saiu do main.cjs): monta a
   pasta e o prompt do Pi, lança o Pi ou liga o Claude Code ou o OpenCode
   (adaptador + serviço; #57), repassa os eventos para a janela e desfaz tudo na troca. */

/**
 * Cria a ponte do tutor sobre o estado vivo do main.
 * Recebe o `live` (sessão, matéria, ponte, concessões, janela e os serviços
 * criados depois), pastas, o host do GeoGebra, o log e as funções do motor do
 * tutor; devolve connect, assertIdle, stopBridge e piLaunch.
 * @param {{live: import('./main.cjs').DeskLive, runtime: string, deskDir: string, FREE_ID: string,
 *   ggb: import('./types/main-hosts').GeogebraHost, pendingDialogs: Set<string>,
 *   appendLog: import('./types/host-deps').AppendLog,
 *   captureActivityScope: () => import('./activity-host.cjs').ActivityScope,
 *   prepareTutorMaterial: (scope: import('./types/host-deps').MaterialScope, payload: object) => Promise<unknown>,
 *   engine: import('./types/main-hosts').TutorEngineHost['engine'],
 *   prepareClaude: import('./types/main-hosts').TutorEngineHost['prepareClaude'],
 *   testClaudeSdkLoader: import('./types/main-hosts').TutorEngineHost['testClaudeSdkLoader'],
 *   claudeBinary: import('./types/main-hosts').TutorEngineHost['claudeBinary'],
 *   claudeDetector: import('./types/main-hosts').TutorEngineHost['claudeDetector'],
 *   piBinary: import('./types/main-hosts').TutorEngineHost['piBinary'],
 *   isNative: import('./types/main-hosts').TutorEngineHost['isNative'],
 *   openCodeTutor: ReturnType<typeof import('./opencode-tutor-host.cjs').createOpenCodeTutorHost>}} options
 * @example const {connect,stopBridge}=createTutorBridgeHost({live,runtime,deskDir,FREE_ID,ggb,pendingDialogs,appendLog,...});
 */
function createTutorBridgeHost({live,runtime,deskDir,FREE_ID,ggb,pendingDialogs,appendLog,captureActivityScope,prepareTutorMaterial,engine,prepareClaude,testClaudeSdkLoader,claudeBinary,claudeDetector,piBinary,isNative,openCodeTutor}){
 function prepareCourse(){
  const root=path.join(runtime,'learning');const target=path.join(root,'Courses',live.courseId||'default');fs.mkdirSync(target,{recursive:true});
  const templates=path.join(__dirname,'templates');
  const pick=(...cands)=>cands.find(p=>p&&fs.existsSync(p));
  const link=(source,dest)=>{if(!source||fs.existsSync(dest)||!fs.existsSync(source))return;try{fs.symlinkSync(source,dest);}catch{fs.cpSync(source,dest,{recursive:true});}};
  for(const name of ['TUTOR.md','LEARNER.md','.pi']){
   link(pick(live.course&&path.join(live.course,name),live.config.vaultPath&&path.join(live.config.vaultPath,name),path.join(templates,name)),path.join(root,name));
  }
  if(live.course)for(const name of ['_state.md','Sources','TUTOR.md','LEARNER.md','.pi'])link(path.join(live.course,name),path.join(target,name));
  return target;
 }
 function promptFile(materialTools=false){
  const file=path.join(runtime,materialTools?'desk-prompt-material.md':'desk-prompt.md');
  try{fs.writeFileSync(file,piPrompt({materialTools,tutorLanguage:live.languageHost.tutor(),writingApp:live.state?.conferirApp?.app}));}catch(error){appendLog('desk',`prompt do tutor não gravado: ${error.message}`);}
  return file;
 }
 /* Parâmetros de lançamento do Pi (principal e chat lateral usam o MESMO binário,
    pasta, perfil fixado e prompt de sistema; só a sessão é própria de cada um). */
 function piLaunch({materialTools=false}={}){
  const pi=piBinary();
  /* Livre: cwd é o workspace da PRÓPRIA conversa (nunca a pasta de uma
     matéria) e o prompt fixado é o genérico — sem TUTOR/LEARNER, sem fontes
     de outro curso. O perfil exclui as extensões que ativam o modo da matéria
     e desliga a descoberta de arquivos de contexto dos ancestrais. */
  const freeMode=live.courseId===FREE_ID&&!!live.freeSessionId;
  const cwd=process.env.LEARNING_DESK_PI_CWD||(freeMode?free.workspaceDir(runtime,live.freeSessionId):prepareCourse());
  if(freeMode)fs.mkdirSync(cwd,{recursive:true});
  /* Perfil fixado (desk/profiles.cjs): a lista de extensões é declarada e
     verificável em vez de herdada da descoberta global — uma extensão nova não
     entra calada na Mesa. Medido em `npm run profile`. `pinnedExtensions:false`
     no config volta a herdar tudo nas matérias; Livre mantém o isolamento. */
  const overlayDirs=[path.join(cwd,'.pi'),path.join(runtime,'learning','.pi')];
  const profileExtra=freeMode?pinnedArgs({overlayDirs,freeWorkspace:true}):(live.config.desk?.pinnedExtensions===false?[]:pinnedArgs({overlayDirs}));
  const materialEnv={LEARNING_DESK_MATERIAL_BRIDGE:'',LEARNING_DESK_ACTIVITY_BRIDGE:''};
  if(materialTools){
   live.tutorMaterialGrant=live.tutorMaterialBridge.grant({courseId:live.courseId,session:live.session,freeSessionId:live.freeSessionId});
   materialEnv.LEARNING_DESK_MATERIAL_BRIDGE=JSON.stringify(live.tutorMaterialGrant);
   profileExtra.push('--extension',path.join(deskDir,'src','extensions','tutor-pdf'));
   live.activityGrant=live.activityBridge.grant(captureActivityScope());
   materialEnv.LEARNING_DESK_ACTIVITY_BRIDGE=JSON.stringify(live.activityGrant);
   profileExtra.push('--extension',path.join(deskDir,'src','extensions','mesa-activity'));
   profileExtra.push('--extension',path.join(deskDir,'src','extensions','mesa-figure'));
   profileExtra.push('--extension',path.join(deskDir,'src','extensions','mesa-geogebra'));
  }
  const testExtra=process.env.LEARNING_DESK_TEST_ARGS?JSON.parse(process.env.LEARNING_DESK_TEST_ARGS):[];
  return {pi,cwd,env:{...spawnEnv(pi),...live.opencodeHost.keyEnv(),...materialEnv,LEARNING_DESK_GGB_BRIDGE:ggb.bridgeFile,LEARNING_DESK_TUTOR_LANGUAGE:live.languageHost.tutorLanguage()},promptFile:promptFile(materialTools),extraArgs:[...profileExtra,...live.opencodeHost.launchArgs(),...testExtra]};
 }
 function connect(){
  if(!live.bridge&&engine()==='claude'){
   conversations.recoverClaudeConversation(live.session,{runtime});
   const {cwd,systemPrompt,record}=prepareClaude();
   const sdkLoader=testClaudeSdkLoader();
   const descriptor=live.session;
   const materialScope={courseId:live.courseId,session:live.session,freeSessionId:live.freeSessionId};
   const activityScope=captureActivityScope();
   const toolPolicy={readPaths:[],readRoots:[cwd]};
   const persistence=nativePersistence({descriptor,runtime,preview:record.preview});
   // The launcher follows the user's current CLI; nativeSessionId owns resume.
   // pinnedExecutable is the last observed binary, a fallback without launcher.
   const adapter=new ClaudeAdapter({conversationId:descriptor,sessionId:record.nativeSessionId,resume:record.nativeEstablished,cwd,claudePath:claudeBinary()||record.pinnedExecutable,detectClaude:claudeDetector(),systemPrompt,sdkLoader,deliveryUncertain:record.delivery?.status==='uncertain',selection:{model:record.model||null,effort:record.effort||null},
    priorMessages:record.messages||[],importedPrefixLength:record.importedPrefixLength||0,
    createMaterial:payload=>prepareTutorMaterial(materialScope,payload),
    createActivity:payload=>live.activityHost.publish(activityScope,payload,{toolCallId:payload.toolCallId,callRef:payload.callRef}),
    previewActivity:payload=>live.activityPreview.preview(payload,{theme:payload?.theme,width:payload?.width}),
    viewFigure:payload=>live.figurePreview.preview(payload),
    geogebra:ggb.service,tutorLanguage:()=>live.languageHost.tutorLanguage(),
    toolPolicy,persistDelivery:persistence.persistDelivery
   });
   live.bridge=new ClaudeService({adapter,uncertain:record.delivery?.status==='uncertain',messages:record.messages||[],importedPrefixLength:record.importedPrefixLength||0,
    onMessages:persistence.onMessages,onSelection:persistence.onSelection,
    onInit(e){const patch={};
     if(e.executable&&fs.existsSync(e.executable))patch.pinnedExecutable=fs.realpathSync(e.executable);
     if(Object.keys(patch).length)conversations.updateClaudeConversation(descriptor,patch,{runtime});
     if(e.executableNote)appendLog('claude',e.executableNote);}
   });
   live.bridge.toolPolicy=toolPolicy;
  }
  /* OpenCode (#57): servidor da Mesa, MCP `mesa` e serviço nativo — nunca o Pi. */
  if(!live.bridge&&engine()==='opencode')live.bridge=openCodeTutor.connect();
  if(!live.bridge){
   const launch=piLaunch({materialTools:true});
   live.bridge=new PiBridge({cwd:launch.cwd,session:live.session,pi:launch.pi,env:launch.env,promptFile:launch.promptFile,extraArgs:launch.extraArgs});
  }
  if(!live.bridge._mesaBound){
   live.bridge._mesaBound=true;const sourceSession=live.session;
   const usageEvents=createUsageEvents({session:sourceSession,engine:()=>engine(),record:payload=>live.studyServices.usage(payload)});
   live.bridge.on('event',e=>{
    if(live.bridge==null||sourceSession!==live.session)return;
    e={...e,conversationId:sourceSession};
    usageEvents(e);
    if(e.type==='agent_request_cancelled')pendingDialogs.delete(e.id);
    if(['auto_retry_start','summarization_retry_scheduled'].includes(e.type)&&Number(e.attempt)>Number(pendingCore.maxAutoRetries())){
     live.bridge.breakConnection(Error(message('err.tutor.retryLimit')));return;
    }
    /* Aviso da ponte (linha torta no stdout do Pi): fica no desk.log — o usuário
       não precisa ver, e o turno segue vivo. Erro de verdade continua em
       `desk_error`, que a UI trata como queda. */
    if(e.type==='desk_warn')try{appendLog('rpc',e.message,{level:'warn'});}catch{/* o log não pode falhar o tratador de eventos */}
    if(e.type==='extension_ui_request'&&['select','confirm','input','editor','question'].includes(e.method)&&typeof e.id==='string'){
     pendingDialogs.add(e.id);
     if(pendingDialogs.size>32){
      const evicted=pendingDialogs.values().next().value;pendingDialogs.delete(evicted);
      try{const b=live.bridge;b.respond({id:evicted,cancelled:true});}catch{/* ponte já parou: o pedido evictado some do mesmo jeito */}
     }
    }
    if(live.win&&!live.win.isDestroyed())live.win.webContents.send('pi-event',e);
   });
   live.bridge.on('stderr',text=>{try{appendLog(engine(),text,{level:'warn',stream:'stderr'});}catch{/* o log não pode falhar o tratador de eventos */}});
  }
  return live.bridge;
 }
 async function assertIdle(message){
  if(!live.bridge)return;
  if(isNative(engine())){if(live.bridge.isRunning())throw Error(message);return;}
  /* Ponte caída (o Pi morreu): não há turno a proteger, e o `request` religaria
     o processo só para perguntar — a sessão nova precisa sair mesmo assim (#27). */
  if(typeof live.bridge.isAlive==='function'&&!live.bridge.isAlive())return;
  const current=await live.bridge.request('get_state');
  if(live.bridge.isRunning(current))throw Error(message);
 }
 function stopBridge(){live.materialPreviewHost.cancel();
  live.activityHost.invalidate();
  live.activityGeneration++;
  if(live.activityGrant){live.activityBridge.revoke(live.activityGrant.token);
   live.activityGrant=null;}if(live.tutorMaterialGrant){live.tutorMaterialBridge.revoke(live.tutorMaterialGrant.token);
   live.tutorMaterialGrant=null;}live.sidechatManager?.suspend('troca de sessão ou matéria');
  openCodeTutor.release();
  live.bridge?.removeAllListeners();
  live.bridge?.stop();
  live.bridge=null;
  pendingDialogs.clear();}
 return {connect,assertIdle,stopBridge,piLaunch};
}

module.exports={createTutorBridgeHost};
