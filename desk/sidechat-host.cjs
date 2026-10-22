// @ts-check
const fs=require('node:fs');const crypto=require('node:crypto');
const {createSideChatManager,conversationList}=require('./sidechat.cjs');
const {createPiSideEngine,createClaudeSideEngine}=require('./sidechat-engine.cjs');
const {buildStudyContext}=require('./studycontext.cjs');
const {cleanStudy}=require('./study.cjs');
const conversations=require('./src/agents/conversations.cjs');

/* ---------- chat lateral (segundo chat) ----------
   O contexto que o lateral copia do principal na abertura: histórico curto
   ATÉ AGORA, referências PDF/página, questão/rascunho — tudo já validado pela
   biblioteca da matéria. O digest fica no descritor em disco (nunca no IPC);
   a chave estável decide se o bloco precisa ir de novo (núcleo sidechat.bend).

   O main entrega o que o lateral lê do principal como acessores (`session`,
   `courseId`, `courses`, `config`, `state`, `bridge` são reatribuídos lá) e as
   preparações que dependem do motor (`piLaunch`, `prepareClaudeSide`). */
function createMesaSidechat({runtime,freeId,session,courseId,courses,config,state,bridge,engine,validPdf,allowedXopp,descriptorCache,piLaunch,prepareClaudeSide,testClaudeSdkLoader,claudeBinary,claudeDetector,win,appendLog,languageHost}){
 /* O digest vai ao modelo: os rótulos seguem o idioma do tutor (#41). */
 const roleLabel=(isUser)=>languageHost.tutorT(isUser?'sidechatctx.roleUser':'sidechatctx.roleAssistant');
 function mainHistoryLines(limit=12){
  const lines=[];
  const push=(role,text)=>{
   const clean=String(text||'').replace(/\s+/g,' ').trim();
   if(clean)lines.push(`${role}: ${clean.slice(0,800)}`);
  };
  try{
   /* Claude e OpenCode (#57): o histórico vem do descritor nativo, nunca do arquivo cru. */
   if(conversations.NATIVE_ENGINES.includes(engine())){
    const record=(bridge()?descriptorCache.get(session(),{messages:true}):conversations.readClaudeConversation(session(),{runtime}))||null;
    for(const message of (record?.messages||[]).slice(-limit)){
     const text=(Array.isArray(message?.content)?message.content:[]).filter(p=>p&&p.type==='text').map(p=>p.text||'').join(' ');
     push(roleLabel(message?.role==='user'),text);
    }
   }else if(fs.existsSync(session())){
    const rows=fs.readFileSync(session(),'utf8').slice(-200000).split('\n').filter(Boolean);
    for(const row of rows.slice(-limit)){
     let message;
     try{message=JSON.parse(row)?.message;}catch{continue;}
     if(!message||!['user','assistant'].includes(message.role))continue;
     const text=(Array.isArray(message.content)?message.content:[]).filter(p=>p&&p.type==='text').map(p=>p.text||'').join(' ');
     push(roleLabel(message.role==='user'),text);
    }
   }
  }catch(error){appendLog('sidechat',`histórico do principal ilegível: ${error.message}`);}
  return lines.slice(-limit);
 }
 function sidechatSnapshot(refs){
  const formatted=(Array.isArray(refs)?refs:[]).slice(0,2).map(ref=>({path:validPdf(ref.path),page:Math.max(1,Math.trunc(Number(ref.page))||1)}));
  const studyContextOff=config().desk?.studyContext===false;
  const study=studyContextOff?{title:'',xopp:''}:cleanStudy(state().study);
  const courseName=courseId()===freeId?'':(courses().find(c=>c.id===courseId())?.name||courseId()||'');
  const block=buildStudyContext({
   course:studyContextOff?'':courseName,
   study:{title:study.title,xopp:study.xopp&&allowedXopp.has(study.xopp)?study.xopp:''},
   refs:formatted,
   previousKey:'',
   language:languageHost.tutorLanguage(),
  });
  const lines=mainHistoryLines(12);
  const at=Date.now();
  /* A primeira linha é o marcador do envelope (sidechat.cjs `CONTEXT_START`), que o código corta
     da exibição e da busca; fica como está nos dois idiomas. */
  const header=`[Contexto do chat lateral]\n${languageHost.tutorT('sidechatctx.main',{session:session()})}\n${languageHost.tutorT('sidechatctx.copied',{at:new Date(at).toISOString()})}`;
  const history=lines.length?`${languageHost.tutorT('sidechatctx.history')}\n${lines.join('\n')}`:'';
  const digest=[header,history,block.text].filter(Boolean).join('\n\n');
  const key=JSON.stringify([session(),courseId(),block.key,at,crypto.createHash('sha1').update(digest).digest('hex').slice(0,16)]);
  return {mainSession:session(),refs:formatted,study,at,digest,key};
 }
 return createSideChatManager({
  runtime,
  current:()=>({session:session(),courseId:courseId(),engine:engine(),courseName:courseId()===freeId?'':(courses().find(c=>c.id===courseId())?.name||'')}),
  /* O manager chama `snapshot({refs})` (objeto), não o array solto: sem o
     destructuring o `Array.isArray` de `sidechatSnapshot` zerava TODAS as refs
     PDF do snapshot. O contrato é objeto com `refs` já validado. */
  snapshot:({refs})=>sidechatSnapshot(refs),
  validPdf:p=>validPdf(p),
  createEngine:({engine,id,descriptor,onEvent})=>{
   if(engine==='claude'){
    return createClaudeSideEngine({id,descriptor:descriptor.claude,runtime,prepare:record=>prepareClaudeSide(record),sdkLoader:testClaudeSdkLoader(),claudePath:claudeBinary(),detectClaude:claudeDetector(),onEvent,log:(src,line)=>appendLog(src,line)});
   }
   const launch=piLaunch();
   return createPiSideEngine({id,sessionPath:descriptor.session,cwd:launch.cwd,pi:launch.pi,env:launch.env,extraArgs:launch.extraArgs,promptFile:launch.promptFile,onEvent,log:(src,line)=>appendLog(src,line)});
  },
  emit:payload=>{const target=win();if(target&&!target.isDestroyed())target.webContents.send('sidechat-event',payload);},
  log:(src,line)=>appendLog(src,line),
 });
}

/* ---------- chat lateral: IPC e listagem de conversas ----------
   O manager valida escopo (conversa principal + matéria) e limites; o preload
   já corta o que é obviamente inválido. A listagem é SÓ leitura do que o main
   já tem em memória (`courseSessions`), sem iniciar agente nem escrever nada. */
function registerSidechatIpc({ipcMain,sidechatManager,courseSessions}){
 ipcMain.handle('sidechat-open',(_e,payload)=>sidechatManager.open(payload||{}));
 ipcMain.handle('sidechat-read',(_e,payload)=>sidechatManager.read(payload||{}));
 ipcMain.handle('sidechat-prompt',(_e,payload)=>sidechatManager.prompt(payload||{}));
 ipcMain.handle('sidechat-abort',(_e,payload)=>sidechatManager.abort(payload||{}));
 ipcMain.handle('sidechat-save',(_e,payload)=>sidechatManager.save(payload||{}));
 ipcMain.handle('sidechat-context',(_e,payload)=>sidechatManager.context(payload||{}));
 ipcMain.handle('sidechat-respond',(_e,payload)=>sidechatManager.respond(payload||{}));
 ipcMain.handle('conversation-list',()=>conversationList(courseSessions()));
}
module.exports={createMesaSidechat,registerSidechatIpc};
