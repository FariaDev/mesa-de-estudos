// @ts-check
'use strict';

const fs=require('node:fs');
const conversations=require('./src/agents/conversations.cjs');
const pendingCore=require('./src/generated/pending.core.js').default;
const {ClaudeService}=require('./src/agents/service.cjs');
const {ClaudeAdapter}=require('./src/agents/claude-adapter.cjs');
const {nativePersistence}=require('./src/agents/native-persistence.cjs');
const {createUsageEvents}=require('./src/study-data/usage-events.cjs');
const {message}=require('./src/i18n.mjs');

/* Ponte do tutor da conversa ativa (#43 fase 2: saiu do main.cjs): liga o
   Claude Code ou o OpenCode (adaptador + serviço; #57), repassa os eventos para
   a janela e desfaz tudo na troca. Sessões Pi antigas são só leitura. */

/**
 * Cria a ponte do tutor sobre o estado vivo do main.
 * Recebe o `live` (sessão, matéria, ponte, concessões, janela e os serviços
 * criados depois), pastas, o host do GeoGebra, o log e as funções do motor do
 * tutor; devolve connect, assertIdle e stopBridge.
 * @param {{live: import('./main.cjs').DeskLive, runtime: string,
 *   ggb: import('./types/main-hosts').GeogebraHost, pendingDialogs: Set<string>,
 *   appendLog: import('./types/host-deps').AppendLog,
 *   captureActivityScope: () => import('./activity-host.cjs').ActivityScope,
 *   prepareTutorMaterial: (scope: import('./types/host-deps').MaterialScope, payload: object) => Promise<unknown>,
 *   engine: import('./types/main-hosts').TutorEngineHost['engine'],
 *   prepareClaude: import('./types/main-hosts').TutorEngineHost['prepareClaude'],
 *   testClaudeSdkLoader: import('./types/main-hosts').TutorEngineHost['testClaudeSdkLoader'],
 *   claudeBinary: import('./types/main-hosts').TutorEngineHost['claudeBinary'],
 *   claudeDetector: import('./types/main-hosts').TutorEngineHost['claudeDetector'],
 *   isNative: import('./types/main-hosts').TutorEngineHost['isNative'],
 *   openCodeTutor: ReturnType<typeof import('./opencode-tutor-host.cjs').createOpenCodeTutorHost>}} options
 * @example const {connect,stopBridge}=createTutorBridgeHost({live,runtime,ggb,pendingDialogs,appendLog,...});
 */
function createTutorBridgeHost({live,runtime,ggb,pendingDialogs,appendLog,captureActivityScope,prepareTutorMaterial,engine,prepareClaude,testClaudeSdkLoader,claudeBinary,claudeDetector,isNative,openCodeTutor}){
  /* O cofre lê a chave de forma assíncrona: duas conexões pedidas juntas
     compartilham a mesma montagem em vez de subir duas pontes. A geração
     descarta a montagem que o stopBridge atravessou (#r5-D). */
  let connecting=null;let bridgeSeq=0;
  function connect(){
   if(live.bridge)return Promise.resolve(live.bridge);
   if(!connecting){const own=openBridge(bridgeSeq);connecting=own;own.catch(()=>{}).finally(()=>{if(connecting===own)connecting=null;});}
   return connecting;
  }
  async function openBridge(seq){
  if(!live.bridge&&engine()==='claude'){
   conversations.recoverClaudeConversation(live.session,{runtime});
   const {cwd,systemPrompt,record}=prepareClaude();
   const sdkLoader=testClaudeSdkLoader();
   const descriptor=live.session;
   const materialScope={courseId:live.courseId,session:live.session,freeSessionId:live.freeSessionId};
   const activityScope=captureActivityScope();
   const persistence=nativePersistence({descriptor,runtime,preview:record.preview});
   // The launcher follows the user's current CLI; nativeSessionId owns resume.
   // pinnedExecutable is the last observed binary, a fallback without launcher.
   const adapter=new ClaudeAdapter({conversationId:descriptor,sessionId:record.nativeSessionId,resume:record.nativeEstablished,cwd,claudePath:claudeBinary()||record.pinnedExecutable,detectClaude:claudeDetector(),systemPrompt,sdkLoader,deliveryUncertain:record.delivery?.status==='uncertain',selection:{model:record.model||null,effort:record.effort||null},
    priorMessages:record.messages||[],importedPrefixLength:record.importedPrefixLength||0,
    createMaterial:payload=>prepareTutorMaterial(materialScope,payload),
    createActivity:payload=>live.activityHost.publish(activityScope,payload,{toolCallId:payload.toolCallId,callRef:payload.callRef}),
    previewActivity:payload=>live.activityPreview.preview(payload,{theme:payload?.theme,width:payload?.width,scope:activityScope}),
    viewFigure:payload=>live.figurePreview.preview(payload),
    geogebra:ggb.service,readPdf:typeof live.readTutorPdf==='function'?raw=>live.readTutorPdf(raw):null,
    searchMaterial:typeof live.studyServices?.materialSearch==='function'?raw=>live.studyServices.materialSearch(null,raw):null,
    listMaterials:typeof live.studyServices?.materialList==='function'?()=>live.studyServices.materialList(null):null,
    saveNote:typeof live.studyServices?.noteSave==='function'?raw=>live.studyServices.noteSave(null,raw):null,
    showCard:live.cardHost?(kind,args)=>live.cardHost.show({conversationId:descriptor},{kind,args}):null,
    proposeReview:(payload,options)=>live.reviewProposalHost.propose(activityScope,payload,options),
    tutorLanguage:()=>live.languageHost.tutorLanguage(),
    persistDelivery:persistence.persistDelivery
   });
   live.bridge=new ClaudeService({adapter,uncertain:record.delivery?.status==='uncertain',messages:record.messages||[],importedPrefixLength:record.importedPrefixLength||0,
    onMessages:persistence.onMessages,onSelection:persistence.onSelection,
    onInit(e){const patch={};
     if(e.executable&&fs.existsSync(e.executable))patch.pinnedExecutable=fs.realpathSync(e.executable);
     if(Object.keys(patch).length)conversations.updateClaudeConversation(descriptor,patch,{runtime});
     if(e.executableNote)appendLog('claude',e.executableNote);}
   });
  }
  /* OpenCode (#57): servidor da Mesa, MCP `mesa` e serviço nativo. */
  if(!live.bridge&&engine()==='opencode')live.bridge=openCodeTutor.connect();
  if(!live.bridge){
   /* Sessão Pi antiga é só leitura: não há motor para ligar. */
   if(!isNative(engine()))throw Error(message('tutor.error.legacyReadOnly'));
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
    /* Aviso da ponte: fica no desk.log — o usuário
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
   /* O stopBridge atravessou a montagem: descarta sem ressuscitar (#r5-D). */
   if(seq!==bridgeSeq){const staleBridge=live.bridge;try{staleBridge?.stop?.();}catch{}if(live.bridge===staleBridge)live.bridge=null;throw Error(message('tutor.error.cancelled'));}
   return live.bridge;
  }
 async function assertIdle(message){
  if(!live.bridge)return;
  const busy=typeof live.bridge.isTurnActive==='function'?live.bridge.isTurnActive():live.bridge.isRunning();
  if(busy)throw Error(message);
 }
  function stopBridge(){bridgeSeq+=1;connecting=null;live.reviewProposalHost?.cancelAll('session');
  live.materialPreviewHost.cancel();
  live.activityPreview?.clearDrafts?.();
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
 return {connect,assertIdle,stopBridge};
}

module.exports={createTutorBridgeHost};
