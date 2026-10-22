// @ts-check
'use strict';

const crypto=require('node:crypto');
const conversations=require('./src/agents/conversations.cjs');
const {cleanStudy}=require('./study.cjs');
const {buildStudyContext,formatRef}=require('./studycontext.cjs');
const {deliverPrompt}=require('./send.cjs');
const {MAX_DRAFT}=require('./state-adapter.cjs');
const {message}=require('./src/i18n.mjs');
const {invalidRequest}=require('./src/error-detail.mjs');
const {validMentions,mentionBlock}=require('./mentions-host.cjs');

/* Envio de mensagem ao tutor (`pi-prompt`; #43 fase 2: saiu do main.cjs).
   Monta o texto (refs de PDF, menções `@`, bloco de estudo) e entrega pelo
   motor ativo: Claude e OpenCode (#57) direto no serviço nativo, Pi por
   `deliverPrompt` (desk/send.cjs).
   O contexto do turno só conta como enviado no aceite. */

/**
 * Registra o handler `pi-prompt`.
 * Recebe o `ipcMain`, o `live` do main e as funções do tutor, das guardas e da
 * autorização de PDF que o envio usa.
 * @param {{ipcMain: import('./types/host-deps').IpcMain, live: import('./main.cjs').DeskLive, runtime: string, FREE_ID: string, allowedXopp: Set<string>,
 *   ggb: import('./types/main-hosts').GeogebraHost, appendLog: import('./types/host-deps').AppendLog,
 *   engine: import('./types/main-hosts').TutorEngineHost['engine'], connect: import('./types/main-hosts').TutorBridgeHost['connect'],
 *   promptImages: import('./types/main-hosts').PromptImages['promptImages'], validPdf: (path: string) => string,
 *   assertNoFreeMutation: import('./types/main-hosts').DeskGuards['assertNoFreeMutation'], assertNoNav: import('./types/main-hosts').DeskGuards['assertNoNav']}} options
 * @returns {void}
 * @example registerTutorPromptHost({ipcMain,live,runtime,FREE_ID,allowedXopp,ggb,appendLog,engine,connect,promptImages,validPdf,assertNoFreeMutation,assertNoNav});
 */
function registerTutorPromptHost({ipcMain,live,runtime,FREE_ID,allowedXopp,ggb,appendLog,engine,connect,promptImages,validPdf,assertNoFreeMutation,assertNoNav}){
 ipcMain.handle('pi-prompt',async(_e,payload)=>{
  assertNoFreeMutation();assertNoNav();
  if(typeof payload?.text!=='string'||payload.text.length>MAX_DRAFT)throw Error(invalidRequest('pi-prompt','text',payload?.text,`string(0..${MAX_DRAFT})`));
  /* `promptText`, não `message`: o nome sombreava a função do i18n e a ref
     inválida virava TypeError (#43 fase 2). */
  let promptText=payload.text;
  const kind=engine();
  const refs=(payload.refs||[]).slice(0,2).map(r=>{
   if(!r||typeof r.path!=='string')throw Error(message('err.ref.reselect'));
   return formatRef(validPdf(r.path),r.page,kind);
  });
  const studyContextOff=live.config.desk?.studyContext===false;
  const study=studyContextOff?{title:'',xopp:''}:cleanStudy(live.state.study);
  const courseName=live.courseId===FREE_ID?'':(live.courses.find(c=>c.id===live.courseId)?.name||live.courseId||'');
  /* Proveniência do anexo: o renderer marca a captura do Xournal++ com o horário
     e o exercício que estava ativo quando ela foi feita (é o que permite avisar
     que uma captura antiga não é do exercício de agora). */
  const shot=(Array.isArray(payload.images)?payload.images:[]).find(item=>item&&typeof item==='object'&&typeof item.capturedAt==='number');
  /* `studyContext:false` desliga o bloco de estudo inteiro. A captura continua
     indo (imagem + horário), mas o nome do exercício gravado no anexo NÃO vai:
     a captura pode ter sido feita antes de a flag ser desligada, então o nome
     antigo não é o contexto atual. */
  const capture=shot?{capturedAt:shot.capturedAt,exercise:studyContextOff?'':(typeof shot.exercise==='string'?shot.exercise:''),app:typeof shot.app==='string'?shot.app:''}:null;
  const block=buildStudyContext({
   course:studyContextOff?'':courseName,
   study:{title:study.title,xopp:study.xopp&&allowedXopp.has(study.xopp)?study.xopp:''},
   refs,
   capture,
   previousKey:live.lastContextKey,
   language:live.languageHost.tutorLanguage(),
  });
  /* Menções `@` (#53): a instrução vem logo depois do texto do aluno e antes do
     contexto, que segue até o fim da mensagem; o idioma é o do aluno. */
  const mentionIds=validMentions(payload.mentions,true);
  if(mentionIds.length)promptText+=mentionBlock(mentionIds,live.languageHost.tutorLanguage());
  if(block.text)promptText+='\n\n'+block.text;
  ggb.newRequest();
  /* `steer` (⌘/Ctrl+⏎ com o Pi ocupado): o Pi interrompe o turno e trata esta
     mensagem agora; sem ele o prompt entra como follow-up — é o que a fila da
     Mesa manda quando chega a vez de cada item.
     A ordem do envio (validar anexo → conectar → escrever → confirmar → ler o
     estado) mora em `deliverPrompt` (desk/send.cjs): aqui fica só o que é do app. */
  if(conversations.NATIVE_ENGINES.includes(kind)){
   const record=conversations.readClaudeConversation(live.session,{runtime});
   if(!record)return {sent:false,retryable:false,error:kind==='claude'?'O registro desta sessão Claude está indisponível. Comece uma nova sessão; o arquivo existente foi preservado.':message('err.opencode.recordMissing')};
   const recovered=!live.bridge?conversations.recoverClaudeConversation(live.session,{runtime}):record;
   if(recovered.delivery?.status==='uncertain'||live.bridge?.uncertain)return {sent:false,retryable:false,error:'O envio anterior ficou incerto. Abra outra sessão para continuar sem repetir a mensagem.'};
   const images=promptImages(payload.images);
   const b=connect();
   /* A política de leitura é do Claude (Read só nos PDFs citados); o OpenCode lê pelas permissões da sessão. */
   const toolPolicy=kind==='claude'?{readPaths:(payload.refs||[]).slice(0,2).map(r=>validPdf(r.path)),readRoots:b.toolPolicy.readRoots}:undefined;
   try{await b.request('prompt',{message:promptText,images,...(toolPolicy?{toolPolicy}:{}),streamingBehavior:payload.steer===true?'steer':'followUp'});
    live.lastContextKey=block.key;
    live.studyServices.accepted({id:crypto.randomUUID(),engine:kind,model:record.model});
    return {streaming:!!b.adapter.snapshot().busy};}
   catch(error){return {sent:false,retryable:error.notSent===true,error:error.message,uncertain:error.notSent!==true};}
  }
  return deliverPrompt({
   request:{message:promptText,streamingBehavior:payload.steer===true?'steer':'followUp'},
   images:payload.images,
   validateImages:promptImages,
   connect,
   /* Aceite confirmado: só agora o contexto do turno conta como enviado. */
   onAccepted(){live.lastContextKey=block.key;live.studyServices.accepted({id:crypto.randomUUID(),engine:'pi'});},
   /* Envio aceito com a leitura do estado falhando: o turno vale (a mensagem
      chegou), o aviso vai para o log e o renderer mostra o mesmo texto — é o que
      impede a fila de repetir a mensagem. */
   onWarning(aviso){try{appendLog('rpc',aviso);}catch{/* o log não pode falhar o aviso da ponte */}},
  }).catch(error=>{
   if(error?.notSent===true)return {sent:false,retryable:true,error:error.message};
   throw error;
  });
 });
}

module.exports={registerTutorPromptHost};
