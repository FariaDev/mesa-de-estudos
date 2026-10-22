import {S,toast,labelBtn} from './state.mjs';
import {icon} from '../icons.mjs';
import sidechatCore from './generated/sidechat.core.js';
import {t as uiT,text as uiText,formatDate,LANGUAGE_EVENT} from './ui-text.mjs';
import {message as uiMessage} from './i18n.mjs';
import {deskErrorIsFatal} from './claude-questions.mjs';
import {h,sidechatMessageCard,paintSidechatBody,copySidechatMessage,sendSidechatMessageToMain} from './sidechat-message-view.mjs';
import {createSidechatRequests} from './sidechat-requests.mjs';

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
   - "Levar à sessão principal" insere rascunho SEM enviar.

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
let root=null,promptEl=null,msgsEl=null,activityEl=null,sendEl=null,stopEl=null,ctxPop=null,engineEl=null,morePop=null,scopeTextEl=null;
let draftTimer=0,paintTimer=0,liveText='',liveEl=null;
/* Eventos do motor vistos durante o `await` do aceite: o aceite pode voltar
   antes (tardio) ou depois do terminal; o estado do turno sai do que o motor
   emitiu, nunca de um timer hipotético de 2,5s. */
let ackWatch=null;
/* Os saves são serializados: o save do clique (''/B) não pode ultrapassar o
   save do debounce seguinte e ressuscitar A numa reabertura. */
let saveChain=Promise.resolve();
/* Perguntas/permissões do lateral no seu próprio canal (#43 fase 2: saíram
   para sidechat-requests.mjs); o cartão vive em `state.requests`. */
const {showRequest,answerRequest,submitFreeAnswer}=createSidechatRequests({state,api:()=>api(),messagesEl:()=>msgsEl,scrollBottom:()=>scrollBottom()});

/* ---------- DOM ---------- */

export function mountSidechat(container){
 if(root){if(root.parentElement!==container)container.append(root);return root;}
 /* Mesmo desenho da coluna do tutor (ticket #19): cabeçalho de --bar (nome,
    chat novo, Mais opções, fechar), a linha de escopo acima da caixa — no
    lugar da "Vai junto" — e a MESMA caixa de mensagem, só com Enviar/Parar.
    O texto da linha de escopo e o nome da única ação de contexto são do núcleo
    (`core/sidechat.bend`); o estado, a fila e o envio seguem independentes. */
 const menuItem=h('button',{type:'button',id:'sidechat-context',role:'menuitem','aria-haspopup':'dialog','aria-expanded':'false'});
 menuItem.innerHTML=`${icon('textQuote')} <span></span>`;
 root=h('section',{id:'sidechat',hidden:''},
  h('div',{class:'sidechat-head'},
   h('h3',{class:'sidechat-head-title'},h('span',{id:'sidechat-title'}),h('span',{id:'sidechat-engine',class:'sidechat-engine',hidden:''})),
   h('div',{class:'sidechat-head-actions'},
    h('button',{type:'button',id:'sidechat-new',class:'icon-btn'}),
    h('button',{type:'button',id:'sidechat-more',class:'icon-btn','aria-haspopup':'menu','aria-expanded':'false','aria-controls':'sidechat-more-pop'}),
    h('button',{type:'button',id:'sidechat-close',class:'icon-btn'}))),
  h('div',{id:'sidechat-more-pop',class:'chat-pop',role:'menu',hidden:''},menuItem),
  h('div',{id:'sidechat-context-pop',role:'dialog',hidden:''}),
  h('div',{id:'sidechat-messages','aria-live':'polite'}),
  h('div',{id:'sidechat-activity',role:'status'}),
  h('div',{id:'sidechat-composer'},
   h('div',{id:'sidechat-scope',class:'goes-along'},
    h('span',{id:'sidechat-scope-text',role:'status'}),
    h('button',{type:'button',id:'sidechat-refresh'})),
   h('div',{id:'sidechat-box',class:'composer-box'},
    h('textarea',{id:'sidechat-prompt',class:'composer-field',rows:'3'}),
    h('div',{class:'composer-actions'},
     h('button',{type:'button',id:'sidechat-stop',hidden:''}),
     h('button',{type:'button',id:'sidechat-send',class:'primary'})))));
 container.append(root);
 labelBtn(root.querySelector('#sidechat-new'),'plus');
 labelBtn(root.querySelector('#sidechat-more'),'more');
 labelBtn(root.querySelector('#sidechat-close'),'close');
 promptEl=root.querySelector('#sidechat-prompt');
 msgsEl=root.querySelector('#sidechat-messages');
 activityEl=root.querySelector('#sidechat-activity');
 sendEl=root.querySelector('#sidechat-send');
 stopEl=root.querySelector('#sidechat-stop');
 ctxPop=root.querySelector('#sidechat-context-pop');
 morePop=root.querySelector('#sidechat-more-pop');
 engineEl=root.querySelector('#sidechat-engine');
 scopeTextEl=root.querySelector('#sidechat-scope-text');
 relabelSidechat();
 window.addEventListener(LANGUAGE_EVENT,repaintForLanguage);

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
 root.querySelector('#sidechat-close').addEventListener('click',()=>window.dispatchEvent(new Event('desk-sidechat-close')));
 root.querySelector('#sidechat-more').addEventListener('click',()=>toggleMorePop());
 root.querySelector('#sidechat-more').addEventListener('keydown',event=>{
  if(event.key!=='ArrowDown')return;
  event.preventDefault();
  if(morePop.hidden)toggleMorePop();
  menuItem.focus();
 });
 morePop.addEventListener('keydown',event=>{if(event.key==='Tab')hideMorePop();});
 menuItem.addEventListener('click',()=>{hideMorePop();toggleContextPop();});
 root.querySelector('#sidechat-refresh').addEventListener('click',()=>refreshContext());
 msgsEl.addEventListener('click',onMessagesClick);
 msgsEl.addEventListener('keydown',event=>{if(event.key==='Enter'&&event.target?.classList?.contains('sidechat-request-input')){event.preventDefault();submitFreeAnswer(event.target.closest('.sidechat-request'));}});
 document.addEventListener('click',event=>{
  if(morePop&&!morePop.hidden&&!event.target?.closest?.('#sidechat-more, #sidechat-more-pop'))hideMorePop();
  if(!ctxPop||ctxPop.hidden)return;
  if(event.target?.closest?.('#sidechat-context, #sidechat-context-pop'))return;
  hideContextPop();
 });
 document.addEventListener('keydown',event=>{
  if(event.key!=='Escape')return;
  if(morePop&&!morePop.hidden){hideMorePop({restoreFocus:true});return;}
  if(ctxPop&&!ctxPop.hidden)hideContextPop();
 });
 renderAll();
 return root;
}

function toggleMorePop(){
 if(!morePop)return;
 if(!morePop.hidden){hideMorePop({restoreFocus:true});return;}
 morePop.hidden=false;
 root.querySelector('#sidechat-more')?.setAttribute('aria-expanded','true');
}
function hideMorePop({restoreFocus=false}={}){
 if(!morePop||morePop.hidden)return;
 const hadFocus=morePop.contains(document.activeElement);
 morePop.hidden=true;
 const trigger=root.querySelector('#sidechat-more');
 trigger?.setAttribute('aria-expanded','false');
 if(restoreFocus&&hadFocus)trigger?.focus();
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
 if(copy){copySidechatMessage(copy);return;}
 const toMain=target?.closest?.('.sidechat-to-main');
 if(toMain)sendSidechatMessageToMain(toMain);
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
  let pending;
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
   renderError(uiMessage('sidechat.err.open',{reason:uiText(String(error.message))}));
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
 if(state.busy||state.sending){toast(uiMessage('sidechat.stopFirst'));return;}
 const question=state.uncertain
  ?uiT('sidechat.confirmNewUncertain')
  :uiT('sidechat.confirmNew');
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
export function openSavedSidechat(payload){
 initSidechat();state.gen++;state.opening=null;adopt(payload,{scope:scopeOf(),useLocal:true});
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
    toast(result.error||uiMessage('sidechat.err.uncertainDelivery'));
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
 if(!list.length)return uiT('sidechat.refs.none');
 return list.map(ref=>`${String(ref?.path||'').split(/[/\\]/).pop()||'PDF'} p.${Number(ref?.page)||1}`).join(', ');
}

function contextRows(){
 const context=state.context||{};
 const rows=[];
 rows.push(h('p',{class:'fine'},h('strong',{text:uiT('sidechat.ctx.main')}),document.createTextNode(` ${uiT('sidechat.ctx.mainBody')}`)));
 rows.push(h('p',{class:'fine'},h('strong',{text:uiT('sidechat.ctx.pdfs')}),document.createTextNode(` ${refsLabel(context.refs)}.`)));
 const study=context.study||{};
 if(study.title||study.xopp)rows.push(h('p',{class:'fine'},h('strong',{text:uiT('sidechat.ctx.study')}),document.createTextNode(` ${[study.title,study.xopp&&String(study.xopp).split(/[/\\]/).pop()].filter(Boolean).join(' · ')}.`)));
 if(context.at)rows.push(h('p',{class:'fine'},h('strong',{text:uiT('sidechat.ctx.copiedAt')}),document.createTextNode(` ${formatWhen(context.at)}.`)));
 rows.push(h('p',{class:'fine',text:uiT('sidechat.ctx.note')}));
 return rows;
}

function formatWhen(value){
 const date=new Date(value);if(Number.isNaN(date.getTime()))return String(value);
 return formatDate(date,{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
}

function paintContextPop(){
 if(!ctxPop)return;
 const close=h('button',{type:'button',class:'primary',text:uiT('common.close')});
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
 if(!state.id){toast(uiMessage('toast.openSidechatFirst'));return;}
 const id=state.id;
 try{
  const payload=await api().sidechatContext({id,refs:currentRefs()});
  if(state.id!==id)return;
  if(payload&&typeof payload==='object')state.context=payload.context&&typeof payload.context==='object'?payload.context:payload;
  if(Array.isArray(payload?.messages)&&payload.messages.length&&!state.messages.length)state.messages=payload.messages.map(normalizeMessage).filter(message=>message&&String(message.text||'').trim());
  paintContextPop();
  paintScope();
  const context=state.context||{};
  toast(uiMessage('toast.contextUpdated',{refs:refsLabel(context.refs)}));
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
  if(type==='agent_end'||type==='agent_settled'||((type==='desk_error'||type==='error')&&deskErrorIsFatal(event)))ackWatch.terminal=true;
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
  // Native recoverable errors leave ownership with the current turn. The
  // result/agent_settled, not an error notice, releases the composer.
  if(!deskErrorIsFatal(event)){
   noteText(uiMessage('sidechat.err.generic',{reason:uiText(String(event.message||uiMessage('sidechat.err.unknown')))}));
   if(state.busy){ensureLive();schedulePaint();}
   if(event.message)toast(String(event.message));
   return;
  }
  if(liveEl){liveEl.remove();liveEl=null;}
  liveText='';
  state.busy=false;state.stopping=false;paintBusy();
  noteText(uiMessage('sidechat.err.generic',{reason:uiText(String(event.message||uiMessage('sidechat.err.unknown')))}));
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
 if(cancelled)noteText(uiMessage('sidechat.note.cancelled'));
 else if(uncertain)noteText(uiMessage('sidechat.note.uncertain'));
 else if(failed)noteText(event.message?uiMessage('sidechat.note.failedReason',{reason:uiText(String(event.message))}):uiMessage('sidechat.note.failed'));
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
  paintSidechatBody(liveEl.querySelector('.sidechat-body'),liveText,true);
  scrollBottom();
 },80);
}

/* ---------- desenho ---------- */

function engineLabel(){
 const engine=state.engine||S.engine||'pi';
 return engine==='claude'?`Claude (experimental)`:(engine==='pi'?'Tutor':String(engine));
}
function renderEngine(){
 if(!engineEl)return;
 const engine=state.engine||S.engine||'';
 engineEl.hidden=!engine;
 engineEl.textContent=engine?engineLabel():'';
}
function renderUnavailable(){
 if(root)root.dataset.state='unavailable';
 if(msgsEl)msgsEl.replaceChildren(h('article',{class:'sidechat-msg system'},h('div',{class:'sidechat-body',text:uiT('sidechat.unavailable')})));
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
/* Linha de escopo: de onde veio o contexto (material e página) e que ele não
   entra na sessão principal. O contexto copiado manda; antes de existir um (a
   abertura ainda está em curso) vale o que está aberto nos leitores agora. */
function scopeLabels(){
 const refs=state.context?(Array.isArray(state.context.refs)?state.context.refs:[]):currentRefs();
 return refs.map(ref=>`${String(ref?.path||'').split(/[/\\]/).pop()||'PDF'} p. ${Number(ref?.page)||1}`);
}
/* Os rótulos fixos do painel saem do catálogo (#41): montados uma vez e refeitos
   quando a interface troca de idioma. */
const SIDECHAT_LABELS=[
 ['#sidechat','aria-label','sidechat.toggle.aria'],['#sidechat-title','text','sidechat.toggle.aria'],
 ['#sidechat-new','title','sidechat.newTitle'],['#sidechat-new','aria-label','sidechat.newAria'],
 ['#sidechat-more','title','sidechat.moreTitle'],['#sidechat-more','aria-label','sidechat.moreAria'],
 ['#sidechat-close','title','sidechat.toggle.close'],['#sidechat-close','aria-label','sidechat.toggle.close'],
 ['#sidechat-more-pop','aria-label','sidechat.moreAria'],['#sidechat-context-pop','aria-label','sidechat.contextAria'],
 ['#sidechat-context','title','sidechat.contextItemTitle'],['#sidechat-context span','text','sidechat.contextItem'],
 ['#sidechat-refresh','title','sidechat.refreshTitle'],['#sidechat-refresh','aria-label','scope.refresh'],
 ['#sidechat-prompt','placeholder','sidechat.promptPlaceholder'],['#sidechat-prompt','aria-label','sidechat.promptAria'],
 ['#sidechat-stop','text','sidechat.stop'],['#sidechat-send','aria-label','sidechat.sendAria']
];
function relabelSidechat(){
 if(!root)return;
 for(const [selector,attribute,key] of SIDECHAT_LABELS){
  const el=root.querySelector(selector);
  if(!el)continue;
  if(attribute==='text')el.textContent=uiT(key);else el.setAttribute(attribute,uiT(key));
 }
 labelBtn(root.querySelector('#sidechat-send'),'arrowUp',uiT('sidechat.send'));
 /* Em coluna estreita só o ícone fica (o CSS esconde o rótulo): a linha de escopo
    cabe em duas linhas e o nome acessível segue completo. */
 labelBtn(root.querySelector('#sidechat-refresh'),'rotateCw',uiT('scope.refresh'));
}
function repaintForLanguage(){
 relabelSidechat();
 renderAll();
 if(ctxPop&&!ctxPop.hidden)paintContextPop();
}
function paintScope(){
 if(!scopeTextEl)return;
 const labels=scopeLabels();
 const list=labels.reduceRight((tail,head)=>({$:'Con',head,tail}),{$:'Nil'});
 const text=uiText(String(sidechatCore.scopeLine(list)));
 if(scopeTextEl.textContent!==text)scopeTextEl.textContent=text;
}
function paintHeader(){
 paintScope();
 const busy=state.busy||state.stopping;
 if(stopEl)stopEl.hidden=!busy;
 if(sendEl)sendEl.disabled=state.unavailable||state.busy;
 if(activityEl)activityEl.textContent=state.busy?uiT(state.stopping?'sidechat.stopping':'sidechat.answering'):(state.uncertain?uiT('sidechat.uncertainShort'):'');
}
function paintBusy(){
 paintHeader();
 if(state.busy)ensureLive();
}
function renderMessages(){
 if(!msgsEl)return;
 const frag=document.createDocumentFragment();
 for(const message of state.messages)frag.append(sidechatMessageCard(message,engineLabel()));
 if(!state.messages.length&&!state.uncertain)frag.append(h('p',{class:'sidechat-empty',text:uiT('sidechat.empty')}));
 if(state.uncertain)frag.append(h('p',{class:'sidechat-warn',text:uiT('sidechat.warn')}));
 msgsEl.replaceChildren(frag);
 for(const card of state.requests.values())if(!card.isConnected)msgsEl.append(card);
 scrollBottom();
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
