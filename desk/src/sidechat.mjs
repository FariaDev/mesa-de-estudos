import {S,toast} from './state.mjs';
import {insertMainDraft} from './chat.mjs';
import {markup,decorateCode} from './markdown.mjs';
import {build,renderChildren} from './view-host.mjs';
import talkCore from './generated/talkview.core.js';
import {MAX_ANSWER_CHARS,questionRequest,questionSubmitAction} from './claude-questions.mjs';

/* ---------------------------------------------------------------------------
   Chat lateral: uma conversa INDEPENDENTE da principal, no espaço da área de
   apoio (segundo leitor). Estado e DOM isolados: nada aqui usa `#messages`,
   `#prompt`, `#pi-dialog` nem a fila do composer principal.

   Quem conversa com o motor é o backend (`window.desk.sidechat*`); a UI:
   - abre/reabre a sessão lateral escopada à sessão principal;
   - recebe eventos normalizados por `onSidechatEvent` e ignora id obsoleto;
   - renderiza Markdown+LaTeX com o MESMO renderer do chat (`markdown.mjs`);
   - salva o rascunho no backend (com espelho em `localStorage` por matéria e
     sessão) e o restaura na abertura;
   - responde perguntas/permissões do lateral no seu próprio canal;
   - "Levar ao chat principal" insere rascunho SEM enviar.

   Sem API no host (build antigo), o painel mostra indisponível e não quebra.
   --------------------------------------------------------------------------- */

const DRAFT_KEY='mesa.sidechat.draft';
/* Metadados do espelho local (mesmo escopo da chave antiga): `rev`/`dirty`/`id`.
   O TEXTO continua na chave `mesa.sidechat.draft.<matéria>.<sessão>` como
   string simples (leitura por versões anteriores/testes); a chave nova só
   marca se aquele texto é mais novo que o host e ainda não foi confirmado. */
const DRAFT_META_KEY='mesa.sidechat.draftmeta';
const DRAFT_SAVE_MS=400;
/* Só papéis de conversa entram no transcript; `toolResult`/`tool`/`toolCall`
   são atividade de ferramenta, não resposta do tutor (finding R2 4). */
const CONVERSATION_ROLES=new Set(['user','assistant','system']);

function h(tag,attrs={},...kids){
 const node=document.createElement(tag);
 for(const [key,value] of Object.entries(attrs)){
  if(value==null)continue;
  if(key==='class')node.className=String(value);
  else if(key==='text')node.textContent=String(value);
  else node.setAttribute(key,String(value));
 }
 for(const kid of kids.flat())if(kid!=null)node.append(kid);
 return node;
}

export function sidechatAvailable(){
 return typeof api()?.sidechatOpen==='function';
}

/* Seam de teste: a suíte controlada (`tests/sidechat-ui-races.mjs`) injeta um
   bridge falso para cronometrar ACK/eventos; o app real usa `window.desk`. */
let bridgeOverride=null;
export function setSidechatBridge(bridge){bridgeOverride=bridge||null;initSidechat();}
function api(){return bridgeOverride||window.desk;}

/* O escopo (matéria+sessão) é CONGELADO na abertura do chat: a troca de
   conversa dispara o reset DEPOIS de `S.currentSession`/`S.currentCourseId` já
   terem mudado — usar o escopo vivo guardaria o rascunho antigo na chave nova.
   Estado/DOM isolados: nada aqui usa `#messages`, `#prompt`, `#pi-dialog` nem a
   fila do composer principal. */
const state={id:'',engine:'',scope:null,messages:[],draft:'',busy:false,sending:false,sendGen:0,uncertain:false,stopping:false,context:null,requests:new Map(),visible:false,gen:0,opening:null,unavailable:false};
let root=null,promptEl=null,msgsEl=null,activityEl=null,sendEl=null,stopEl=null,ctxPop=null,engineEl=null;
let draftTimer=0,paintTimer=0,liveText='',liveEl=null,lastRequestSeq=0;
/* Eventos do motor vistos durante o `await` do aceite: o aceite pode voltar
   antes (tardio) ou depois do terminal; o estado do turno sai do que o motor
   emitiu, nunca de um timer hipotético de 2,5s. */
let ackWatch=null;
/* Os saves são serializados: o save do clique (''/B) não pode ultrapassar o
   save do debounce seguinte e ressuscitar A numa reabertura. */
let saveChain=Promise.resolve();

/* ---------- DOM ---------- */

export function mountSidechat(container){
 if(root){if(root.parentElement!==container)container.append(root);return root;}
 root=h('section',{id:'sidechat','aria-label':'Chat lateral',hidden:''},
  h('div',{class:'sidechat-head'},
   h('h3',{class:'sidechat-head-title'},h('span',{id:'sidechat-title',text:'Chat lateral'}),h('span',{id:'sidechat-engine',class:'sidechat-engine',hidden:''})),
   h('div',{class:'sidechat-head-actions'},
    h('button',{type:'button',id:'sidechat-new',class:'link-btn',title:'Começar um chat lateral novo para esta conversa (o atual fica guardado)',text:'Novo'}),
    h('button',{type:'button',id:'sidechat-context',class:'link-btn','aria-haspopup':'dialog','aria-expanded':'false',title:'Contexto copiado do principal',text:'Contexto'}),
    h('button',{type:'button',id:'sidechat-refresh',class:'link-btn',title:'Recopiar os trechos recentes da conversa principal, os PDFs abertos e a questão ativa para o contexto do chat lateral',text:'Atualizar contexto do principal'}),
    h('button',{type:'button',id:'sidechat-collapse',class:'icon-btn',title:'Recolher a área de apoio','aria-label':'Recolher a área de apoio'}))),
  h('div',{id:'sidechat-context-pop',role:'dialog','aria-label':'Contexto do chat lateral',hidden:''}),
  h('div',{id:'sidechat-messages','aria-live':'polite'}),
  h('div',{id:'sidechat-activity',role:'status'}),
  h('div',{id:'sidechat-composer'},
   h('textarea',{id:'sidechat-prompt',rows:'2',placeholder:'Pergunte no chat lateral…','aria-label':'Mensagem no chat lateral'}),
   h('div',{class:'sidechat-actions'},
    h('button',{type:'button',id:'sidechat-stop',hidden:'',text:'Parar'}),
    h('button',{type:'button',id:'sidechat-send',class:'primary',text:'Enviar'}))));
 container.append(root);
 promptEl=root.querySelector('#sidechat-prompt');
 msgsEl=root.querySelector('#sidechat-messages');
 activityEl=root.querySelector('#sidechat-activity');
 sendEl=root.querySelector('#sidechat-send');
 stopEl=root.querySelector('#sidechat-stop');
 ctxPop=root.querySelector('#sidechat-context-pop');
 engineEl=root.querySelector('#sidechat-engine');

 promptEl.addEventListener('input',onDraftInput);
 promptEl.addEventListener('keydown',event=>{
  if(event.key!=='Enter'||event.isComposing)return;
  if(event.shiftKey)return;
  event.preventDefault();
  sendMessage();
 });
 sendEl.addEventListener('click',()=>sendMessage());
 stopEl.addEventListener('click',()=>stopMessage());
 root.querySelector('#sidechat-new').addEventListener('click',()=>newSidechat());
 root.querySelector('#sidechat-context').addEventListener('click',()=>toggleContextPop());
 root.querySelector('#sidechat-refresh').addEventListener('click',()=>refreshContext());
 msgsEl.addEventListener('click',onMessagesClick);
 msgsEl.addEventListener('keydown',event=>{if(event.key==='Enter'&&event.target?.classList?.contains('sidechat-request-input')){event.preventDefault();submitFreeAnswer(event.target.closest('.sidechat-request'));}});
 document.addEventListener('click',event=>{
  if(!ctxPop||ctxPop.hidden)return;
  if(event.target?.closest?.('#sidechat-context, #sidechat-context-pop'))return;
  hideContextPop();
 });
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&ctxPop&&!ctxPop.hidden)hideContextPop();});
 renderAll();
 return root;
}

export function sidechatElement(){return root;}

function onMessagesClick(event){
 const target=event.target;
 const option=target?.closest?.('.sidechat-option');
 if(option){answerRequest(option.closest('.sidechat-request'),{value:option.dataset.value||option.textContent||''});return;}
 const requestAction=target?.closest?.('.sidechat-request-action');
 if(requestAction){answerRequest(requestAction.closest('.sidechat-request'),requestAction.dataset.answer==='cancel'?{cancelled:true}:{confirmed:true});return;}
 const submit=target?.closest?.('.sidechat-request-submit');
 if(submit){submitFreeAnswer(submit.closest('.sidechat-request'));return;}
 const copy=target?.closest?.('.sidechat-copy');
 if(copy){copyMessage(copy);return;}
 const toMain=target?.closest?.('.sidechat-to-main');
 if(toMain)toMainMessage(toMain);
}

/* ---------- rascunho ---------- */

function scopeOf(){return {courseId:String(S.currentCourseId||''),session:String(S.currentSession||'')};}
function draftKey(scope=state.scope||scopeOf()){
 const course=String(scope?.courseId||''),session=String(scope?.session||'');
 return `${DRAFT_KEY}.${encodeURIComponent(course)}.${encodeURIComponent(session)}`;
}
function draftMetaKey(scope=state.scope||scopeOf()){
 const course=String(scope?.courseId||''),session=String(scope?.session||'');
 return `${DRAFT_META_KEY}.${encodeURIComponent(course)}.${encodeURIComponent(session)}`;
}
function readLocalDraft(scope){
 try{return localStorage.getItem(draftKey(scope));}catch{return null;}
}
function readDraftMeta(scope){
 try{
  const raw=localStorage.getItem(draftMetaKey(scope));
  if(!raw)return null;
  const meta=JSON.parse(raw);
  return meta&&typeof meta==='object'?meta:null;
 }catch{return null;}
}
function writeDraftMeta(scope,meta){try{localStorage.setItem(draftMetaKey(scope),JSON.stringify(meta));}catch{}}
/* Registro local do escopo: texto (chave antiga, string) + metadados. Sem
   metadados é espelho LEGADO (gravado por versão anterior): só vale se o host
   não tiver rascunho, como antes. O `rev` é local e monotônico. */
function draftRecord(scope){
 const text=readLocalDraft(scope),meta=readDraftMeta(scope);
 if(text===null&&!meta)return null;
 return {text:text===null?'':String(text),meta};
}
let draftRev=0;
function mirrorDraft(text,{dirty=true,id=state.id,scope=null}={}){
 const target=scope||state.scope||scopeOf();
 const value=String(text??'');
 try{localStorage.setItem(draftKey(target),value);}catch{}
 const meta={rev:++draftRev,dirty:!!dirty,id:String(id||'')};
 writeDraftMeta(target,meta);
 return meta;
}
function clearLocalDraft(scope){
 try{localStorage.removeItem(draftKey(scope));}catch{}
 try{localStorage.removeItem(draftMetaKey(scope));}catch{}
}
function onDraftInput(){
 state.draft=promptEl?.value||'';
 mirrorDraft(state.draft,{scope:state.scope});
 clearTimeout(draftTimer);
 draftTimer=setTimeout(saveDraftNow,DRAFT_SAVE_MS);
}
/* Confirma o save SÓ quando ele ainda corresponde ao registro local (valor,
   revisão e id): o ACK de um save antigo não pode limpar o `dirty` de um input
   novo. Um erro mantém o `dirty` (o texto só existe localmente; a restauração
   reagenda o save). */
function ackDraftSave({id,draft,scope,rev}){
 const record=draftRecord(scope);
 if(!record?.meta?.dirty)return;
 if(rev!==null&&rev!==undefined&&Number(record.meta.rev)!==Number(rev))return;
 if(String(record.text)!==String(draft))return;
 if(record.meta.id&&id&&String(record.meta.id)!==String(id))return;
 writeDraftMeta(scope,{...record.meta,dirty:false,id:String(id||record.meta.id||'')});
}
function saveDraftNow(){
 clearTimeout(draftTimer);draftTimer=0;
 if(!state.id||!sidechatAvailable())return;
 const id=state.id,draft=state.draft,scope=state.scope||scopeOf();
 const record=draftRecord(scope);
 const rev=record?.meta&&Number.isFinite(Number(record.meta.rev))?Number(record.meta.rev):null;
 const save=()=>{
  let pending=null;
  try{pending=api()?.sidechatSave?.({id,draft});}catch{return;}
  if(pending?.then)return pending.then(()=>ackDraftSave({id,draft,scope,rev}),()=>{});
  ackDraftSave({id,draft,scope,rev});
 };
 saveChain=saveChain.then(save,save);
}
/* O host é a fonte quando o espelho está limpo (ou ausente). Um espelho DIRTY
   (gravado a cada tecla, ainda não confirmado) é mais novo que o payload do
   host — vale mesmo VAZIO (campo limpo de propósito) — até o ACK do save
   correspondente; a restauração reagenda esse save se o reload cortou o
   debounce. `useLocal:false` (fresh) começa VAZIO mesmo com espelho antigo do
   mesmo escopo (chat novo não ressuscita o anterior). */
function restoreDraft(payloadDraft,useLocal=true){
 const payloadText=String(payloadDraft??'');
 const record=useLocal?draftRecord(state.scope):null;
 const localText=record?record.text:'';
 const dirty=record?.meta?.dirty===true;
 const sameId=!record?.meta||!record.meta.id||!state.id||String(record.meta.id)===String(state.id);
 const legacy=!!record&&!record.meta&&localText!=='';
 const preferLocal=(dirty&&sameId)||(legacy&&!payloadText);
 state.draft=preferLocal?localText:payloadText;
 if(promptEl)promptEl.value=state.draft;
 if(!preferLocal)return;
 if(localText!==payloadText){
  mirrorDraft(localText,{dirty:true,id:state.id,scope:state.scope});
  saveDraftNow();
 }else if(dirty&&sameId){
  /* O save já chegou ao host antes do reload; só falta marcar o espelho. */
  writeDraftMeta(state.scope,{...record.meta,dirty:false,id:String(state.id||record.meta.id||'')});
 }
}

/* ---------- ciclo de vida ---------- */

function currentRefs(){
 return (S.panels||[]).filter(panel=>panel.path).map(panel=>({path:panel.path,page:panel.page||1}));
}

export function setSidechatVisible(visible){
 state.visible=!!visible;
 if(root)root.hidden=!visible;
 if(visible)openSidechat();
 else saveDraftNow();
}

export function openSidechat({fresh=false}={}){
 if(!sidechatAvailable()){
  state.unavailable=true;
  renderUnavailable();
  return;
 }
 state.unavailable=false;
 if(state.opening)return state.opening;
 if(state.id&&!fresh)return;
 const scope=scopeOf();
 const generation=++state.gen;
 const request=fresh?{refs:currentRefs(),fresh:true}:{refs:currentRefs()};
 state.opening=(async()=>{
  try{
   const payload=await api().sidechatOpen(request);
   if(generation!==state.gen)return;
   adopt(payload,{scope,useLocal:!fresh});
  }catch(error){
   if(generation!==state.gen)return;
   renderError(`Não foi possível abrir o chat lateral: ${error.message}`);
  }finally{
   if(generation===state.gen)state.opening=null;
  }
 })();
 return state.opening;
}

/* "Novo" (contrato ADITIVO `fresh:true`): começa outro chat lateral para a
   conversa principal; o atual fica guardado. É o caminho explícito quando a
   entrega está incerta — nada é reenviado sozinho. O espelho local do escopo é
   limpo: o chat novo começa vazio (o antigo já foi salvo no backend). */
async function newSidechat(){
 if(!sidechatAvailable()){renderUnavailable();return;}
 if(state.busy||state.sending){toast('Pare a resposta lateral antes de começar outra.');return;}
 const question=state.uncertain
  ?'A entrega anterior está incerta. Começar um chat lateral novo? O atual fica guardado e nada é reenviado.'
  :'Começar um chat lateral novo para esta conversa? O atual continua guardado.';
 if(!confirm(question))return;
 saveDraftNow();
 clearLocalDraft(state.scope||scopeOf());
 state.gen++;
 state.sendGen++;
 state.opening=null;
 state.id='';state.messages=[];state.requests.clear();state.busy=false;state.sending=false;state.stopping=false;state.uncertain=false;state.context=null;liveText='';liveEl=null;state.draft='';
 if(promptEl)promptEl.value='';
 adopt(pendingPlaceholder(),{scope:scopeOf(),useLocal:false});
 await openSidechat({fresh:true});
}
function pendingPlaceholder(){
 return {id:'',engine:state.engine||S.engine||'pi',messages:[],draft:'',busy:false,uncertain:false,context:null};
}

function adopt(payload,{scope=null,useLocal=true}={}){
 payload=payload&&typeof payload==='object'?payload:{};
 state.scope=scope||state.scope||scopeOf();
 state.id=String(payload.id||'');
 state.engine=String(payload.engine||S.engine||'pi');
 state.messages=(Array.isArray(payload.messages)?payload.messages:[]).map(normalizeMessage).filter(message=>message&&String(message.text||'').trim());
 state.busy=!!payload.busy;
 state.stopping=false;
 state.uncertain=!!payload.uncertain;
 state.context=payload.context&&typeof payload.context==='object'?payload.context:null;
 state.requests.clear();
 liveText='';liveEl=null;
 /* O rascunho local é a rede de segurança do input (grava a cada tecla); o do
    host é a fonte quando existe (outro computador/reabertura limpa). */
 restoreDraft(payload.draft,useLocal);
 renderAll();
}

export function resetSidechat(){
 clearTimeout(draftTimer);draftTimer=0;
 saveDraftNow(); /* salva sob o escopo ANTIGO (id antigo), antes de re-apontar */
 state.gen++;
 state.sendGen++;
 state.opening=null;
 state.id='';state.messages=[];state.requests.clear();state.busy=false;state.sending=false;state.stopping=false;state.uncertain=false;state.context=null;liveText='';liveEl=null;
 state.draft='';
 state.scope=scopeOf();
 if(promptEl)promptEl.value='';
 renderAll();
 /* Se o painel está visível, a sessão nova abre quando o host terminar de
    trocar (o evento chega antes dos painéis novos; o timeout deixa a troca
    terminar e o `open` escopa à sessão certa). */
 if(state.visible)setTimeout(()=>{if(state.visible&&!state.id)openSidechat();},0);
}

window.addEventListener('desk-conversation-changed',()=>resetSidechat());

/* ---------- envio/parada ---------- */

function removeLocalMessage(message){
 const index=state.messages.indexOf(message);
 if(index>=0)state.messages.splice(index,1);
}
/* Recusa comprovada: o texto volta para o campo (o original BRUTO, com os
   espaços que o usuário digitou) se ele não tiver digitado nada novo; se já
   houver um texto B do usuário, B fica — nada é sobrescrito. */
function restoreRefusedDraft(raw){
 if(promptEl&&promptEl.value==='')promptEl.value=raw;
 state.draft=promptEl?.value||'';
 mirrorDraft(state.draft,{scope:state.scope});
 saveDraftNow();
}
async function sendMessage(){
 if(!state.id||state.busy||state.sending||state.unavailable)return;
 const raw=String(promptEl?.value||'');
 const text=raw.trim();
 if(!text)return;
 const id=state.id;
 const token=++state.sendGen;
 state.sending=true;
 /* A fala local aparece ANTES de qualquer evento do motor: com aceite tardio,
   a ordem "user antes de assistant" continua certa. O eco `role:'user'` do
   motor é suprimido pelo backend; a bolha local é a fonte. */
 const localUser={role:'user',text,id:''};
 state.messages.push(localUser);
 renderMessages();
 /* O campo esvazia no clique (comparação com o texto BRUTO: só espaços em
   volta também limpam); se o usuário digitar B durante o aceite, B fica. */
 if(promptEl&&promptEl.value===raw)promptEl.value='';
 state.draft=promptEl?.value||'';
 mirrorDraft(state.draft,{scope:state.scope});
 saveDraftNow(); /* A aceito não pode ressuscitar no hide/show/restart */
 const watch={terminal:false};
 ackWatch=watch;
 try{
  const result=await api().sidechatPrompt({id,text});
  if(state.id!==id){removeLocalMessage(localUser);return;}
  if(result?.sent===false){
   if(result.uncertain){
    /* Pode ter chegado: a bolha fica (não reenviamos), com o aviso do cabeçalho. */
    state.uncertain=true;
    toast(result.error||'A entrega desta mensagem está incerta.');
   }else{
    removeLocalMessage(localUser);
    restoreRefusedDraft(raw);
    toast(result.error||'O chat lateral recusou a mensagem.');
   }
   renderAll();
   return;
  }
  /* Aceito = turno a caminho: o `busy` só cai com o evento terminal (o motor
     Pi pode ainda não ter emitido `agent_start`; `streaming` medido no canal
     não é prova de que não há turno). Terminal visto durante o aceite mantém o
     desfecho e libera já — nada de timer hipotético. */
  state.busy=!watch.terminal;
  if(state.busy)ensureLive();
  paintHeader();
 }catch(error){
  if(state.id===id){
   removeLocalMessage(localUser);
   restoreRefusedDraft(raw);
   toast(error.message);
   renderAll();
  }
 }finally{
  if(ackWatch===watch)ackWatch=null;
  if(state.sendGen===token)state.sending=false;
  paintHeader();
 }
}

async function stopMessage(){
 if(!state.id||(!state.busy&&!state.stopping))return;
 state.stopping=true;
 paintHeader();
 try{await api()?.sidechatAbort?.({id:state.id});}
 catch(error){toast(error.message);}
 finally{state.stopping=false;paintHeader();}
}

/* ---------- contexto ---------- */

function refsLabel(refs){
 const list=Array.isArray(refs)?refs:[];
 if(!list.length)return 'Sem referências de PDF';
 return list.map(ref=>`${String(ref?.path||'').split(/[/\\]/).pop()||'PDF'} p.${Number(ref?.page)||1}`).join(', ');
}

function contextRows(){
 const context=state.context||{};
 const rows=[];
 rows.push(h('p',{class:'fine'},h('strong',{text:'Conversa principal'}),document.createTextNode(' Trechos recentes do chat principal e a questão ativa, copiados no momento indicado abaixo.')));
 rows.push(h('p',{class:'fine'},h('strong',{text:'PDFs e páginas'}),document.createTextNode(` ${refsLabel(context.refs)}.`)));
 const study=context.study||{};
 if(study.title||study.xopp)rows.push(h('p',{class:'fine'},h('strong',{text:'Estudo'}),document.createTextNode(` ${[study.title,study.xopp&&String(study.xopp).split(/[/\\]/).pop()].filter(Boolean).join(' · ')}.`)));
 if(context.at)rows.push(h('p',{class:'fine'},h('strong',{text:'Copiado em'}),document.createTextNode(` ${formatWhen(context.at)}.`)));
 rows.push(h('p',{class:'fine',text:'O chat lateral é uma conversa independente; o contexto acima é um recorte do principal no momento da cópia. Use "Atualizar contexto do principal" para recopiar os trechos recentes, os PDFs e a questão atuais.'}));
 return rows;
}

function formatWhen(value){
 const date=new Date(value);if(Number.isNaN(date.getTime()))return String(value);
 return date.toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
}

function paintContextPop(){
 if(!ctxPop)return;
 const close=h('button',{type:'button',class:'primary',text:'Fechar'});
 close.addEventListener('click',hideContextPop);
 ctxPop.replaceChildren(...contextRows());
 ctxPop.append(h('div',{class:'dialog-actions'},close));
}
function toggleContextPop(){
 if(!ctxPop)return;
 if(!ctxPop.hidden){hideContextPop();return;}
 paintContextPop();
 ctxPop.hidden=false;
 root.querySelector('#sidechat-context')?.setAttribute('aria-expanded','true');
}
function hideContextPop(){
 if(!ctxPop)return;
 ctxPop.hidden=true;
 root.querySelector('#sidechat-context')?.setAttribute('aria-expanded','false');
}

export async function refreshContext(){
 if(!state.id){toast('Abra o chat lateral primeiro.');return;}
 const id=state.id;
 try{
  const payload=await api().sidechatContext({id,refs:currentRefs()});
  if(state.id!==id)return;
  if(payload&&typeof payload==='object')state.context=payload.context&&typeof payload.context==='object'?payload.context:payload;
  if(Array.isArray(payload?.messages)&&payload.messages.length&&!state.messages.length)state.messages=payload.messages.map(normalizeMessage).filter(message=>message&&String(message.text||'').trim());
  paintContextPop();
  const context=state.context||{};
  toast(`Contexto atualizado: ${refsLabel(context.refs)}.`);
 }catch(error){
  toast(error.message);
 }
}

/* ---------- eventos do motor ---------- */

function normalizeMessage(raw){
 if(!raw)return null;
 if(typeof raw==='string')return {role:'assistant',text:raw,id:''};
 if(typeof raw!=='object')return null;
 const role=String(raw.role||'');
 /* `toolResult`/`tool`/`toolCall` (e qualquer papel desconhecido) são
    atividade de ferramenta — não viram "assistant" por engano nem aparecem
    como resposta do tutor. Só papéis de conversa entram. */
 if(!CONVERSATION_ROLES.has(role))return null;
 let text='';
 if(typeof raw.text==='string')text=raw.text;
 else if(typeof raw.content==='string')text=raw.content;
 else if(Array.isArray(raw.content))text=raw.content.filter(part=>part?.type==='text'&&typeof part.text==='string').map(part=>part.text).join('\n');
 return {role,text,id:String(raw.id||'')};
}

function noteText(text){
 state.messages.push({role:'assistant',text:String(text||''),id:''});
 renderMessages();
}

function handleEvent(event){
 if(!event||typeof event!=='object')return;
 const type=String(event.type||'');
 if(ackWatch){
  if(type==='agent_end'||type==='agent_settled'||type==='desk_error'||type==='error')ackWatch.terminal=true;
 }
 if(type==='agent_start'||type==='turn_start'){
  state.busy=true;state.stopping=false;liveText='';
  paintBusy();
  return;
 }
 if(type==='message_update'){
  const delta=event.assistantMessageEvent?.delta??event.delta??event.text??'';
  const kind=event.assistantMessageEvent?.type||event.deltaType||'text_delta';
  if(kind!=='text_delta'||!delta)return;
  liveText+=String(delta);
  ensureLive();
  schedulePaint();
  return;
 }
 if(type==='message_end'){
  const message=normalizeMessage(event.message);
  /* O backend suprime o eco `role:'user'` do motor (a bolha local já está na
     tela); se um eco escapar, ignorar evita duplicar e mentir a ordem. */
  if(message&&message.role!=='user'&&message.text){
   if(liveEl){liveEl.remove();liveEl=null;}
   liveText='';
   state.messages.push(message);
   renderMessages();
  }
  return;
 }
 if(type==='agent_end'||type==='agent_settled'){
  finishTurn(event);
  return;
 }
 if(type==='desk_error'||type==='error'){
  if(liveEl){liveEl.remove();liveEl=null;}
  liveText='';
  state.busy=false;state.stopping=false;paintBusy();
  noteText(`Erro do chat lateral: ${event.message||'falha desconhecida'}`);
  if(event.message)toast(String(event.message));
  return;
 }
 if(type==='desk_warn'){console.warn('Chat lateral:',event.message);return;}
 if(type==='extension_ui_request'||type==='request'){
  if(['select','confirm','input','editor','question','permission'].includes(String(event.method||'')))showRequest(event);
  else if(event.method==='notify'&&event.message)toast(String(event.message));
  return;
 }
 if(type==='agent_request_cancelled'||type==='request_cancelled'){
  const id=String(event.id||'');
  const card=state.requests.get(id);
  if(card){card.remove();state.requests.delete(id);}
 }
}

function finishTurn(event){
 const cancelled=event.cancelled===true;
 const failed=event.isError===true&&!cancelled;
 const uncertain=event.uncertain===true;
 if(liveEl){
  if(liveText)state.messages.push({role:'assistant',text:liveText,id:''});
  liveEl.remove();liveEl=null;
 }
 liveText='';
 state.busy=false;state.stopping=false;
 if(uncertain)state.uncertain=true;
 if(cancelled)noteText('Resposta cancelada no chat lateral.');
 else if(uncertain)noteText('Entrega incerta: a mensagem pode ter sido recebida. Confira antes de reenviar.');
 else if(failed)noteText(`A resposta do chat lateral falhou${event.message?`: ${event.message}`:''}.`);
 renderAll();
}

function ensureLive(){
 if(!msgsEl)return;
 if(!liveEl||!liveEl.isConnected){
  liveEl=h('article',{class:'sidechat-msg message assistant live'},h('div',{class:'role sidechat-role',text:engineLabel()}));
  liveEl.append(h('div',{class:'body sidechat-body'}));
  msgsEl.append(liveEl);
 }
}
function schedulePaint(){
 if(paintTimer)return;
 paintTimer=setTimeout(()=>{
  paintTimer=0;
  if(!liveEl||!liveEl.isConnected)return;
  paintBody(liveEl.querySelector('.sidechat-body'),liveText,true);
  scrollBottom();
 },80);
}

/* ---------- perguntas/permissões (canal do lateral) ---------- */

function showRequest(event){
 const requestId=String(event.id||`req-${++lastRequestSeq}`);
 const method=String(event.method||'select');
 const card=h('div',{class:'sidechat-request',role:'group','aria-label':'Pedido do chat lateral'});
 card.append(h('p',{class:'sidechat-request-title',text:String(event.title||(method==='confirm'||method==='permission'?'Permissão do chat lateral':'Pergunta do chat lateral'))}));
 if(event.message)card.append(h('p',{class:'sidechat-request-text',text:String(event.message)}));
 if(method==='question'){
  const request=questionRequest(event.questions);
  card._questions=request.questions;
  if(request.ok){
   request.questions.forEach((question,index)=>{
    const block=h('div',{class:'sidechat-question','data-q-index':String(index)});
    block.append(h('p',{class:'sidechat-request-q',text:question.question}));
    const options=h('div',{class:'sidechat-q-options',role:question.multiSelect?'group':'radiogroup','aria-label':question.question});
    for(const option of question.options){
     const input=h('input',{type:question.multiSelect?'checkbox':'radio',name:`sq-${requestId}-${index}`,class:'sidechat-option-input',value:option.label});
     const body=h('span',{},h('span',{text:option.label}));
     if(option.description)body.append(h('small',{class:'sidechat-option-description',text:option.description}));
     options.append(h('label',{class:'sidechat-q-option'},input,body));
    }
    const free=h('input',{type:'text',class:'sidechat-request-input',maxlength:String(MAX_ANSWER_CHARS),placeholder:question.options.length?'Outra resposta':'Digite a resposta','aria-label':`Resposta para: ${question.question}`});
    free.addEventListener('input',()=>{if(free.value)for(const input of options.querySelectorAll('input'))input.checked=false;clearRequestError(card);});
    options.addEventListener('change',()=>{free.value='';clearRequestError(card);});
    block.append(options,free);card.append(block);
   });
   card.append(h('button',{type:'button',class:'sidechat-request-submit',text:'Responder'}));
  }else{
   card.append(h('p',{class:'sidechat-request-error',role:'alert',text:'Não foi possível exibir esta pergunta. Cancele o pedido para continuar.'}));
  }
  card.append(h('button',{type:'button',class:'sidechat-request-action',text:'Cancelar','data-answer':'cancel'}));
 }else if(method==='confirm'||method==='permission'){
  card.append(h('div',{class:'sidechat-request-actions'},
   h('button',{type:'button',class:'sidechat-request-action',text:'Permitir','data-answer':'ok'}),
   h('button',{type:'button',class:'sidechat-request-action',text:'Negar','data-answer':'cancel'})));
 }else if(method==='select'&&Array.isArray(event.options)){
  for(const option of event.options)card.append(h('button',{type:'button',class:'sidechat-option','data-value':String(option),text:String(option)}));
  card.append(h('button',{type:'button',class:'sidechat-request-action',text:'Cancelar','data-answer':'cancel'}));
 }else{
  card.append(h('input',{type:'text',class:'sidechat-request-input',value:String(event.prefill||''),placeholder:String(event.placeholder||''),'aria-label':'Resposta do chat lateral'}));
  card.append(h('div',{class:'sidechat-request-actions'},
   h('button',{type:'button',class:'sidechat-request-submit',text:'Responder'}),
   h('button',{type:'button',class:'sidechat-request-action',text:'Cancelar','data-answer':'cancel'})));
 }
 card.dataset.requestId=requestId;
 state.requests.set(requestId,card);
 msgsEl?.append(card);
 scrollBottom();
 toast('O chat lateral está esperando uma resposta.');
}

function answerRequest(card,response){
 if(!card)return;
 sendRespond(card,response.cancelled?{cancelled:true}:response.confirmed?{confirmed:true}:{value:response.value||''});
}
function submitFreeAnswer(card){
 if(!card||card._responding)return;
 let payload;
 if(card._questions){
  const picks=[...card.querySelectorAll('.sidechat-question')].map(block=>({selected:[...block.querySelectorAll('.sidechat-option-input:checked')].map(input=>input.value),text:block.querySelector('.sidechat-request-input')?.value||''}));
  const action=questionSubmitAction(card._questions,picks,'ok');
  if(action.action!=='answers'){
   requestError(card,action.errors.map(error=>error.message).join(' ')||'Confira as respostas.');
   card.querySelector(`.sidechat-question[data-q-index="${action.errors[0]?.index||0}"] input`)?.focus();
   return;
  }
  payload={answers:action.answers};
 }else{
  const inputs=[...card.querySelectorAll('.sidechat-request-input')];
  payload=inputs.length===1?{value:inputs[0].value}:{answers:Object.fromEntries(inputs.map((input,index)=>[`Resposta ${index+1}`,input.value]))};
 }
 sendRespond(card,payload);
}
function clearRequestError(card){card.querySelector('.sidechat-request-error')?.remove();}
function requestError(card,message){
 clearRequestError(card);
 card.append(h('p',{class:'sidechat-request-error',role:'alert',text:message}));
}
async function sendRespond(card,response){
 if(!state.id||card._responding)return;
 const id=state.id,requestId=card.dataset.requestId||'';
 const controls=[...card.querySelectorAll('input,button')];
 card._responding=true;clearRequestError(card);
 for(const control of controls)control.disabled=true;
 try{
  const source=api();
  if(typeof source?.sidechatRespond!=='function')throw Error('A ponte do chat lateral está indisponível.');
  const result=await source.sidechatRespond({id,response:{id:requestId,...response}});
  if(result?.ok===false)throw Error('A resposta não foi aceita. Confira as opções e tente novamente.');
  if(state.id===id&&state.requests.get(requestId)===card){state.requests.delete(requestId);card.remove();}
 }catch(error){
  if(state.id===id&&state.requests.get(requestId)===card)requestError(card,error?.message||'Não foi possível responder. Tente novamente.');
 }finally{
  card._responding=false;
  for(const control of controls)control.disabled=false;
 }
}

/* ---------- desenho ---------- */

function engineLabel(){
 const engine=state.engine||S.engine||'pi';
 return engine==='claude'?`Claude Code (experimental)`:(engine==='pi'?'Pi':String(engine));
}
function renderEngine(){
 if(!engineEl)return;
 const engine=state.engine||S.engine||'';
 engineEl.hidden=!engine;
 engineEl.textContent=engine?engineLabel():'';
}
function renderUnavailable(){
 if(root)root.dataset.state='unavailable';
 if(msgsEl)msgsEl.replaceChildren(h('article',{class:'sidechat-msg system'},h('div',{class:'sidechat-body',text:'Chat lateral indisponível nesta versão do host: falta a ponte `window.desk.sidechat*`. Atualize a Mesa para usar este recurso.'})));
 if(sendEl)sendEl.disabled=true;
 if(promptEl)promptEl.disabled=true;
 if(activityEl)activityEl.textContent='';
}
function renderError(text){noteText(text);}
function renderAll(){
 paintHeader();
 renderMessages();
 renderEngine();
 if(state.unavailable)renderUnavailable();
}
function paintHeader(){
 const busy=state.busy||state.stopping;
 if(stopEl)stopEl.hidden=!busy;
 if(sendEl)sendEl.disabled=state.unavailable||state.busy;
 if(activityEl)activityEl.textContent=state.busy?(state.stopping?'Parando…':'O chat lateral está respondendo…'):(state.uncertain?'Entrega incerta nesta conversa lateral.':'');
}
function paintBusy(){
 paintHeader();
 if(state.busy)ensureLive();
}
function renderMessages(){
 if(!msgsEl)return;
 const frag=document.createDocumentFragment();
 for(const message of state.messages)frag.append(messageCard(message));
 if(!state.messages.length&&!state.uncertain)frag.append(h('p',{class:'sidechat-empty',text:'Conversa lateral independente. Ela começa com um recorte recente do contexto do principal (conversa, PDFs abertos e questão ativa).'}));
 if(state.uncertain)frag.append(h('p',{class:'sidechat-warn',text:'Há uma entrega incerta nesta conversa lateral: confira antes de reenviar.'}));
 msgsEl.replaceChildren(frag);
 for(const card of state.requests.values())if(!card.isConnected)msgsEl.append(card);
 scrollBottom();
}
function messageCard(message){
 const card=h('article',{class:`sidechat-msg message ${message.role}`,role:'group'},h('div',{class:'role sidechat-role',text:message.role==='user'?'Você':message.role==='system'?'Aviso':engineLabel()}));
 const body=h('div',{class:'body sidechat-body'});
 paintBody(body,message.text,false);
 card.append(body);
 card._text=String(message.text||'');
 const actions=h('div',{class:'sidechat-msg-actions'});
 actions.append(h('button',{type:'button',class:'sidechat-copy',text:'Copiar'}));
 if(message.role==='assistant'&&String(message.text||'').trim())actions.append(h('button',{type:'button',class:'sidechat-to-main',title:'Insere esta resposta no rascunho do chat principal, sem enviar',text:'Levar ao chat principal'}));
 card.append(actions);
 return card;
}
function paintBody(body,text,live){
 if(!body)return;
 body.innerHTML=markup(String(text||''));
 decorateCode(body);
 if(!live)hydrateAssets(body);
}
/* Figuras geradas (mesmo caminho do chat principal): `readImage` → `assetKids`
   do núcleo; sem a imagem, o fallback de texto do núcleo. */
function hydrateAssets(node){
 for(const figure of node.querySelectorAll('figure.asset[data-asset]')){
  const source=figure.dataset.asset||'',caption=figure.dataset.caption||'';
  if(!source)continue;
  window.desk.readImage(source).then(hit=>{
   if(!figure.isConnected)return;
   if(!hit){figure.replaceWith(build(talkCore.assetFallback(source)));return;}
   renderChildren(figure,talkCore.assetKids({$:'AssetRow',src:hit.dataUrl,path:source,alt:caption||hit.name||'Imagem gerada',caption:caption||hit.name||''}));
  }).catch(()=>{if(figure.isConnected)figure.replaceWith(build(talkCore.assetFallback(source)));});
 }
}
function copyMessage(button){
 const card=button.closest('.sidechat-msg');
 const text=card?._text||card?.querySelector('.sidechat-body')?.innerText||'';
 if(!text)return;
 navigator.clipboard.writeText(text).then(()=>toast('Mensagem lateral copiada.')).catch(error=>toast(error.message));
}
function toMainMessage(button){
 const card=button.closest('.sidechat-msg');
 const text=card?._text||'';
 if(!String(text).trim())return;
 if(insertMainDraft(text))toast('Resposta inserida no rascunho do chat principal — revise e envie.');
}
function scrollBottom(){
 if(msgsEl)msgsEl.scrollTop=msgsEl.scrollHeight;
}

/* O contrato de eventos entra UMA vez por bridge; ids obsoletos são ignorados.
   O seam de teste pode trocar o bridge e o listener é registrado no novo. */
export function initSidechat(){
 const source=api();
 if(initSidechat.source===source)return;
 initSidechat.source=source;
 source?.onSidechatEvent?.(payload=>{
  const id=payload&&payload.id!==undefined?String(payload.id):'';
  if(!id||!state.id||id!==state.id)return;
  handleEvent(payload.event||payload);
 });
}

/* Estado exposto só para testes de unidade/inspeção (não usar no DOM). */
export function sidechatState(){return state;}
