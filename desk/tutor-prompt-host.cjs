// @ts-check
'use strict';

const crypto=require('node:crypto');
const conversations=require('./src/agents/conversations.cjs');
const {cleanStudy}=require('./study.cjs');
const {buildStudyContext,buildPdfAttachments,formatRef}=require('./studycontext.cjs');
const {deliverPrompt}=require('./send.cjs');
const {MAX_DRAFT}=require('./state-adapter.cjs');
const {message}=require('./src/i18n.mjs');
const {causeArg,invalidRequest}=require('./src/error-detail.mjs');
const {validMentions,mentionBlock}=require('./mentions-host.cjs');

/* Envio de mensagem ao tutor (`pi-prompt`; #43 fase 2: saiu do main.cjs).
   Monta o texto (refs de PDF, menções `@`, bloco de estudo) e entrega pelo
   motor ativo: Claude e OpenCode (#57) direto no serviço nativo
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
 *   authorizePdfs?: (raw: unknown) => Array<{name: string, path: string, pages: number}>,
 *   assertNoFreeMutation: import('./types/main-hosts').DeskGuards['assertNoFreeMutation'], assertNoNav: import('./types/main-hosts').DeskGuards['assertNoNav'],
 *   warmPdf?: (request: {file: string, first: number}) => unknown}} options
 * @returns {{sendText: (text: string, options?: {conversationId?: string}) => Promise<any>}}
 * @example registerTutorPromptHost({ipcMain,live,runtime,FREE_ID,allowedXopp,ggb,appendLog,engine,connect,promptImages,validPdf,authorizePdfs,assertNoFreeMutation,assertNoNav});
 */
function registerTutorPromptHost({ipcMain,live,runtime,FREE_ID,allowedXopp,ggb,appendLog,engine,connect,promptImages,validPdf,authorizePdfs,assertNoFreeMutation,assertNoNav,warmPdf}){
 /* OpenCode: o texto do PDF citado sai do caminho do envio. O timer deixa o
    prompt ir primeiro; a leitura cai no cache quando o tutor pedir `ler_pdf`. */
 function warmListedPdfs(list){
  if(engine()!=='opencode'||typeof warmPdf!=='function'||!Array.isArray(list))return;
  const refs=list.slice(0,2);
  setTimeout(()=>{
   for(const ref of refs){
    if(!ref||typeof ref.path!=='string')continue;
    let file;
    try{file=validPdf(ref.path);}catch{continue;}
    const page=Math.trunc(Number(ref.page));
    try{warmPdf({file,first:Number.isFinite(page)&&page>=1?page:1});}catch{/* aquecer não segura o envio */}
   }
  },0);
 }
 ipcMain.handle('tutor-warm',async(_e,payload)=>{
  warmListedPdfs(Array.isArray(payload)?payload:payload?.refs);
  return {warmed:engine()==='opencode'};
 });
 ipcMain.handle('pi-prompt',async(_e,payload)=>{
  assertNoFreeMutation();assertNoNav();
  if(typeof payload?.text!=='string'||payload.text.length>MAX_DRAFT)throw Error(invalidRequest('pi-prompt','text',payload?.text,`string(0..${MAX_DRAFT})`));
  /* `promptText`, não `message`: o nome sombreava a função do i18n e a ref
     inválida virava TypeError (#43 fase 2). */
  let promptText=payload.text;
  const kind=engine();
  warmListedPdfs(payload.refs);
  const refs=(payload.refs||[]).slice(0,2).map(r=>{
   if(!r||typeof r.path!=='string')throw Error(message('err.ref.reselect'));
   return formatRef(validPdf(r.path),r.page,kind);
  });
  /* PDFs anexados: o host do chat já os validou ao soltar, mas o envio valida de
     novo (a fila e a bandeja podem vir do disco) e autoriza o caminho na conversa. */
  const pdfs=typeof authorizePdfs==='function'?authorizePdfs(payload.pdfs):[];
  const pdfTool=kind==='claude'?'mcp__mesa__ler_pdf':'mesa_ler_pdf';
  const pdfBlock=buildPdfAttachments({pdfs,language:live.languageHost.tutorLanguage(),tool:pdfTool});
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
  if(pdfBlock)promptText+='\n\n'+pdfBlock;
   const delivered=await deliver(promptText,{images:payload.images,steer:payload.steer===true,attemptId:payload.attemptId,onAccepted(){live.lastContextKey=block.key;live.studyServices.accepted({id:crypto.randomUUID(),engine:kind,model:conversations.readClaudeConversation(live.session,{runtime})?.model});
    /* Turno novo do aluno: libera o teto de `salvar_nota` para esta rodada.
       Resultado de cartão (`sendText`) não é turno e não libera. */
    live.studyServices.newStudentTurn?.();}});
  return delivered;
 });

 /* Envio de uma mensagem da própria Mesa (resultado de cartão, #92): mesmo
    caminho dos três motores, sem refs, anexos ou contexto de estudo. Não é a
    fala do aluno; o host decide quando chamar.
    @param {string} text
    @param {{conversationId?: string}} [options]
    @returns {Promise<object>} */
 async function sendText(text,options={}){
  if(typeof text!=='string'||!text.trim())throw Error('O resultado do cartão está vazio.');
  const conversationId=typeof options.conversationId==='string'?options.conversationId:'';
  /* Troca de matéria/sessão ou mutação da aba Livre em voo: o resultado espera
     na fila do cartão (retryable) em vez de correr com a troca. */
  try{assertNoFreeMutation();assertNoNav();}
  catch(error){return {sent:false,retryable:true,error:causeArg(error)};}
  /* O resultado do cartão não é fala do aluno e não pode esperar a vez da
     fila: com o tutor ocupado, entra como steer para não sumir. */
  const turnActive=live.bridge?.isTurnActive?.()??live.bridge?.isRunning?.();
  const delivered=/** @type {any} */ (await deliver(text,{images:[],steer:!!turnActive,expectedConversation:String(conversationId||'')}));
  return delivered?.sent===false?delivered:{sent:true,...delivered};
 }

 /* A ordem do envio (validar anexo → conectar → escrever → confirmar → ler o
    estado) mora em `deliverPrompt` (desk/send.cjs): aqui fica só o que é do app.
    `steer` (⌘/Ctrl+⏎ com o tutor ocupado): o motor interrompe o turno e trata esta
    mensagem agora; sem ele o prompt entra como follow-up — é o que a fila da
    Mesa manda quando chega a vez de cada item. */
 async function deliver(promptText,{images=[],steer=false,attemptId='',onAccepted=null,expectedConversation=''}={}){
  /* Resultado de cartão amarrado à conversa dona: a troca de sessão no meio do
     envio não pode entregar na conversa que abriu depois. `connect()` pode
     demorar, então a checagem se repete depois dele. */
  const wrongConversation=()=>expectedConversation&&live.session!==expectedConversation;
  const notSent=()=>({sent:false,retryable:true,error:live.languageHost.t('quiz.wrongConversation')});
  if(wrongConversation())return notSent();
  ggb.newRequest();
  const kind=engine();
  if(conversations.NATIVE_ENGINES.includes(kind)){
   const record=conversations.readClaudeConversation(live.session,{runtime});
   /* Motor/registro ausente: NADA foi escrito, então o cartão pode reenviar
      (antes ficava preso em "Enviando…"). */
   if(!record)return {sent:false,retryable:true,error:kind==='claude'?'O registro desta sessão Claude está indisponível. Comece uma nova sessão; o arquivo existente foi preservado.':message('err.opencode.recordMissing')};
   const recovered=!live.bridge?conversations.recoverClaudeConversation(live.session,{runtime}):record;
   if(recovered.delivery?.status==='uncertain'||live.bridge?.uncertain)return {sent:false,retryable:false,uncertain:true,error:'O envio anterior ficou incerto. Abra outra sessão para continuar sem repetir a mensagem.'};
   const imageList=promptImages(images);
   let b;
   try{b=await connect();}
   catch(error){return {sent:false,retryable:true,error:error.message};}
   if(wrongConversation())return notSent();
   try{await b.request('prompt',{message:promptText,images:imageList,streamingBehavior:steer?'steer':'followUp',...(typeof attemptId==='string'&&attemptId?{attemptId}:{})});
    onAccepted?.();
    return {streaming:!!b.adapter.snapshot().busy};}
   catch(error){return {sent:false,retryable:error.notSent===true,error:error.message,uncertain:error.notSent!==true};}
  }
  return deliverPrompt({
   request:{message:promptText,streamingBehavior:steer?'steer':'followUp',...(typeof attemptId==='string'&&attemptId?{attemptId}:{})},
   images,
   validateImages:promptImages,
   connect:async()=>{
    if(wrongConversation()){const error=/** @type {Error & {notSent?: boolean}} */ (Error(live.languageHost.t('quiz.wrongConversation')));error.notSent=true;throw error;}
    return connect();
   },
   onAccepted,
   /* Envio aceito com a leitura do estado falhando: o turno vale (a mensagem
      chegou), o aviso vai para o log e o renderer mostra o mesmo texto — é o que
      impede a fila de repetir a mensagem. */
   onWarning(aviso){try{appendLog('rpc',aviso);}catch{/* o log não pode falhar o aviso da ponte */}},
  }).catch(error=>{
   if(error?.notSent===true)return {sent:false,retryable:true,error:error.message};
   /* Falhou DEPOIS de escrever: incerta, nunca reenvia sozinha. */
   return {sent:false,retryable:false,uncertain:true,error:error?.message||String(error)};
  });
 }
 return {sendText};
}

module.exports={registerTutorPromptHost};
