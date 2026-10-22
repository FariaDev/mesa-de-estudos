import {$,S,labelBtn,supportsCapability,paintSessionTitle} from './state.mjs';
import {icon} from '../icons.mjs';
import {choiceIcon} from './provider-icons.mjs';
import {build,renderChildren} from './view-host.mjs';
import {sidechatOpen,toggleSidechat} from './support.mjs';
import {resetModelSearch} from './model-picker-ui.mjs';
import core from './generated/tutorheader.core.js';
import boxCore from './generated/composerbox.core.js';
import {t,text as translate,LANGUAGE_EVENT} from './ui-text.mjs';

/* ---------------------------------------------------------------------------
   Cabeçalho do tutor (tickets #13, #14 e #42). Uma linha de --bar: título da
   sessão (abre a lista da matéria), botão do chat lateral, sessão nova e mais
   opções. O indicador de modelo e esforço (com o ponto de conexão; abre o
   popover onde se trocam) mora na fileira da caixa de mensagem, à esquerda do
   Enviar — a ordem e o degrau em caixa estreita vêm do `composerbox`.

   O núcleo (`core/tutorheader.bend` → `tutorheader.core.js`) decide os itens
   dos dois menus; este módulo só aplica a árvore, liga os cliques e cuida do
   que é fato de host: abrir/fechar os popovers, o foco, e espelhar o estado
   vivo (medidor de contexto, interruptor da compactação, chat lateral).

   Não há estado novo: o título vem de `S.sessions`/`S.currentSession`
   (`state.mjs#paintSessionTitle`), o chat lateral é o `supportState` de
   `support.mjs`, a compactação automática é o `#auto-compact` do estado e o
   indicador lê `S.link` (estado e rótulo do ponto) e `S.choice` (modelo e
   esforço em uso) — o texto sai do núcleo (`indicator`/`popNote`). Modelo e
   Esforço são os `<select>` vivos do estado, dentro do popover.
   --------------------------------------------------------------------------- */

const POPS=[
 {pop:'#conversations-pop',trigger:'#session-title'},
 {pop:'#model-pop',trigger:'#model-indicator',anchor:true},
 {pop:'#new-session-pop',trigger:'#new-session'},
 {pop:'#chat-more-pop',trigger:'#chat-more'}
];
const MENUS=['#new-session-pop','#chat-more-pop'];

/* Andaime `data-icon`: o núcleo diz o nome do ícone; o SVG é do host. */
function iconize(root){
 for(const el of root.querySelectorAll('[data-icon]')){
  const name=el.dataset.icon,label=el.textContent;
  el.removeAttribute('data-icon');
  el.innerHTML=icon(name)+(label?` <span>${label}</span>`:'');
 }
}

let host=null;
let listing=false;

function isOpen(selector){const el=$(selector);return !!el&&!el.hidden;}

export function closeTutorPops({restoreFocus=false}={}){
 let focusTarget=null;
 for(const {pop,trigger} of POPS){
  const el=$(pop),button=$(trigger);
  if(!el||el.hidden)continue;
  if(el.contains(document.activeElement))focusTarget=button;
  el.hidden=true;
  button?.setAttribute('aria-expanded','false');
 }
 if(restoreFocus&&focusTarget)focusTarget.focus();
}
function tutorPopOpen(){return POPS.some(({pop})=>isOpen(pop));}

function openPop(selector){
 const entry=POPS.find(item=>item.pop===selector);
 if(!entry)return;
 for(const other of POPS)if(other!==entry){
  const el=$(other.pop);
  if(el&&!el.hidden){el.hidden=true;$(other.trigger)?.setAttribute('aria-expanded','false');}
 }
 const el=$(entry.pop);
 if(!el)return;
 syncMore();
 el.hidden=false;
 $(entry.trigger)?.setAttribute('aria-expanded','true');
 if(entry.anchor)anchorPop(el,$(entry.trigger));
 fitPop(el);
 if(selector==='#model-pop')resetModelSearch();/* depois de visível: a linha em uso precisa de layout para rolar até ela */
}
/* O popover de modelo mora no `#composer` e abre PARA CIMA do indicador (#42),
   com a borda direita alinhada à dele, sem sair da caixa; os menus do
   cabeçalho seguem presos à borda de cima. */
function anchorPop(el,trigger){
 const host=el.offsetParent||el.parentElement;if(!host||!trigger)return;
 const box=host.getBoundingClientRect(),at=trigger.getBoundingClientRect(),gutter=8;
 el.style.top='auto';el.style.right='auto';
 el.style.bottom=`${Math.round(box.bottom-at.top+4)}px`;
 const left=Math.min(at.right-box.left-el.offsetWidth,box.width-el.offsetWidth-gutter);
 el.style.left=`${Math.max(gutter,Math.round(left))}px`;
}
/* O popover cabe na coluna do tutor: a altura máxima é o que sobra entre o
   topo da coluna e o ponto onde ele nasce (embaixo, para os menus do cabeçalho;
   em cima do indicador, para o de modelo); passando disso, rola por dentro. */
function fitPop(el){
 const chat=$('#chat');if(!chat)return;
 el.style.maxHeight='';
 const column=chat.getBoundingClientRect(),at=el.getBoundingClientRect();
 const room=el.id==='model-pop'?at.bottom-column.top-8:column.bottom-at.top-8;
 if(Number.isFinite(room)&&room>0)el.style.maxHeight=`${Math.max(120,Math.floor(room))}px`;
}

/* ---------- a fileira da caixa (#42) ---------- */

/* A ordem da fileira é do núcleo (`composerbox.actionIds`): o host só arruma
   os nós vivos do `index.html` nela. */
function orderActions(){
 const row=$('#composer-box .composer-actions');if(!row)return;
 const ids=[];
 for(let c=boxCore.actionIds();c&&c.$==='Con';c=c.tail)ids.push(String(c.head));
 for(const id of ids){const el=row.querySelector(`#${id}`);if(el)row.append(el);}
 /* Botão fora da lista do núcleo entra logo depois do que ele segue (`data-follows`): Foto do celular depois do Anexar (#36). */
 for(const el of row.querySelectorAll('[data-follows]'))row.querySelector(`#${el.dataset.follows}`)?.after(el);
}
/* Degrau da fileira em caixa estreita (`data-fit` na fileira): o host mede,
   do mais folgado ao mais apertado, se cada degrau cabe; o núcleo
   (`rowFit`) escolhe — o rótulo de Referências cede primeiro, depois o
   esforço, por fim o modelo vira ícone.
   O indicador encolhe com a fileira (ajustes do indicador). Nos dois primeiros
   degraus o nome tem de caber inteiro, até o teto do CSS: antes de cortar o
   nome, sai o esforço. No degrau "model" o nome pode ganhar reticências até o
   piso `--mi-model-floor`; abaixo disso vira ícone. Antes o teto do CSS
   contava como "não cabe": um nome do OpenRouter maior que o teto mandava
   tudo para o ícone, com a fileira vazia. */
function modelRoom(model,floor){
 const cap=Number.parseFloat(getComputedStyle(model).maxWidth);
 const whole=Math.min(model.scrollWidth,Number.isFinite(cap)?cap:Infinity);
 return model.clientWidth+1>=Math.min(whole,floor);
}
function rowFits(row,floor){
 if(row.scrollWidth>row.clientWidth+1)return false;
 const model=row.querySelector('#model-indicator .mi-model');
 return !model||modelRoom(model,floor);
}
export function fitIndicator(){
 const button=$('#model-indicator'),row=button?.parentElement;
 if(!button||!row||!row.getClientRects().length)return;
 const floor=Number.parseFloat(getComputedStyle(button).getPropertyValue('--mi-model-floor'))||0;
 const at=(fit,least)=>{row.dataset.fit=fit;return rowFits(row,least);};
 const full=at('',Infinity),compact=at('compact',Infinity),model=at('model',floor);
 row.dataset.fit=String(boxCore.rowFit(full,compact,model));
}

function focusModelField(){
 const target=[...$('#model-pop').querySelectorAll('input,select,button')].find(el=>!el.disabled&&!el.hidden&&el.getClientRects().length);
 target?.focus();
}

function menuItems(menu){
 return [...menu.querySelectorAll('button[role^="menuitem"]')].filter(button=>!button.hidden&&!button.disabled);
}
function focusFirst(selector){menuItems($(selector)||document.body)[0]?.focus();}

/* ---------- sessão nova e mais opções (árvores do núcleo) ---------- */

function renderMenus(){
 const meter=$('#ctx-meter');
 const handlers={
  NewSession:()=>{closeTutorPops({restoreFocus:true});host.newSession('pi');},
  NewSessionClaude:()=>{closeTutorPops({restoreFocus:true});host.newSession('claude');},
  NewSessionOpenCode:()=>{closeTutorPops({restoreFocus:true});host.newSession('opencode');},
  ExportSession:()=>{closeTutorPops({restoreFocus:true});host.exportSession();},
  OpenEndDay:()=>{closeTutorPops({restoreFocus:true});host.openEndDay();},
  ToggleAutoCompact:()=>{$('#auto-compact')?.click();},
  CompactNow:()=>{closeTutorPops({restoreFocus:true});host.compactNow();},
  ToggleTutor:()=>{closeTutorPops();host.toggleTutor();}
 };
 const sessionPop=$('#new-session-pop'),morePop=$('#chat-more-pop');
 if(sessionPop){renderChildren(sessionPop,core.newSessionItems(),handlers);iconize(sessionPop);}
 if(morePop){
  renderChildren(morePop,core.moreItems(host.endDayEnabled()),handlers);
  morePop.querySelector('#chat-collapse')?.before(triageItem());
  iconize(morePop);
  /* O medidor é nó vivo (a barra anima por transição de largura): sai do
     render com o resto do menu e volta para o encaixe do uso de contexto. */
  const slot=$('#more-context-slot');
  if(meter&&slot)slot.append(meter);
 }
 syncMore();
}

/* "Relatar um problema" (#62): item novo de interface, em JS como manda o
   ADR 0001 (o núcleo `tutorheader` segue com os seis itens dele). Entra antes
   de "Recolher o tutor", com a mesma forma dos itens do núcleo. */
function triageItem(){
 const button=document.createElement('button');
 button.type='button';button.id='more-triage';button.setAttribute('role','menuitem');
 button.dataset.icon='alert';button.textContent=t('triage.menu');
 button.addEventListener('click',()=>{closeTutorPops({restoreFocus:true});host.reportProblem();});
 return button;
}

/* O medidor, o interruptor e o rótulo do recolher são fatos vivos: espelham-se
   no menu a cada render, a cada evento do estado e ao abrir. */
function syncMore(){
 const meter=$('#ctx-meter'),empty=$('#more-context-empty');
 if(empty)empty.hidden=!!meter&&!meter.hidden;
 const toggle=$('#more-auto-compact'),auto=$('#auto-compact');
 if(toggle){
  const canAuto=supportsCapability('autoCompaction');
  const usable=canAuto&&!!S.connected;
  toggle.setAttribute('aria-checked',String(!!auto&&auto.getAttribute('aria-pressed')==='true'));
  toggle.disabled=!usable;
  toggle.title=t(!canAuto?'more.autoCompact.unsupported':!S.connected?'more.autoCompact.needsTutor':'more.autoCompact.hint');
 }
 /* Resumir agora: a ação manual que morava no painel "Contexto da sessão". */
 const now=$('#more-compact-now');
 if(now){
  const canCompact=supportsCapability('compact');
  now.disabled=!canCompact||!S.connected;
  now.title=t(!canCompact?'more.compactNow.unsupported':!S.connected?'more.compactNow.needsTutor':'more.compactNow.hint');
 }
 const collapse=$('#chat-collapse');
 if(collapse){
  const collapsed=document.body.classList.contains('chat-collapsed');
  collapse.setAttribute('aria-expanded',String(!collapsed));
  collapse.title=t(collapsed?'more.collapse.show':'more.collapse.hide');
 }
}

/* ---------- indicador de modelo e esforço ---------- */

/* O logo do modelo fica no lugar do ponto verde enquanto o tutor está ligado
   (2026-10-21: o botão tinha cara de caixa de formulário); ligando, com erro ou
   sem logo, o ponto volta. */
function paintChoiceLogo(button,html){
 let logo=button.querySelector('.mi-logo');
 if(!logo){
  logo=document.createElement('span');logo.className='mi-logo';logo.setAttribute('aria-hidden','true');
  button.querySelector('#status-dot')?.after(logo);
 }
 if(logo.innerHTML!==html)logo.innerHTML=html;
 button.toggleAttribute('data-logo',!!html);
}

/* O texto e o aviso do popover saem do núcleo; o host só passa os fatos (estado
   do ponto, escolha em uso, se o motor deixa escolher) e aplica. O botão e os
   dois campos são nós vivos: só os atributos entram no botão e o aviso é
   trocado no lugar. */
function syncIndicator(){
 const button=$('#model-indicator');if(!button)return;
 const link=S.link||{state:'',label:''},choice=S.choice||{model:'',level:''};
 const online=link.state==='online',connecting=link.state==='connecting';
 const label=translate(String(link.label||''));
 const node=core.indicator(online,label,String(choice.model||''),String(choice.level||''));
 const built=build(node);
 for(const attr of built.attributes)button.setAttribute(attr.name,attr.value);
 const text=button.querySelector('.mi-text');
 const fresh=built.querySelector('.mi-text');
 /* O texto é modelo + esforço em partes (#27): troca os filhos, não só o texto. */
 if(text&&fresh&&text.innerHTML!==fresh.innerHTML)text.replaceChildren(...fresh.childNodes);
 paintChoiceLogo(button,online?choiceIcon(String(choice.provider||''),String(choice.id||'')):'');
 fitIndicator();
 /* Sem Modelo nem Esforço (motor sem seletor), o popover explica em vez de
    mostrar lista vazia. */
 const canPick=!($('#model-field')?.hidden&&$('#effort-field')?.hidden);
 const pop=$('#model-pop');if(!pop)return;
 const note=build(core.popNote(online,connecting,canPick,label),{
  ConnectTutor:()=>{closeTutorPops();host.connect();}
 });
 const old=$('#model-pop-note');
 if(old)old.replaceWith(note);else pop.prepend(note);
 const fields=$('#pi-settings');
 if(fields)fields.hidden=!note.hidden;
 if(isOpen('#model-pop'))fitPop(pop);
}

/* ---------- chat lateral ---------- */

function syncSidechatButton(){
 const button=$('#sidechat-toggle');if(!button)return;
 const open=sidechatOpen();
 button.setAttribute('aria-pressed',String(open));
 button.title=t(open?'sidechat.toggle.close':'sidechat.toggle.open');
 button.setAttribute('aria-label',t(open?'sidechat.toggle.ariaOpen':'sidechat.toggle.aria'));
}

/* ---------- popovers e teclado ---------- */

function wire(){
 $('#session-title').addEventListener('click',async()=>{
  if(isOpen('#conversations-pop')){closeTutorPops({restoreFocus:true});return;}
  if(listing)return;
  listing=true;
  try{await host.renderConversations();}finally{listing=false;}
  openPop('#conversations-pop');
 });
 $('#model-indicator').addEventListener('click',event=>{
  if(isOpen('#model-pop')){closeTutorPops({restoreFocus:true});return;}
  openPop('#model-pop');
  /* Aberto por teclado, o foco entra no primeiro campo; pelo mouse o foco
     fica onde está (um select focado à força ganharia anel de foco). */
  if(event.detail===0)focusModelField();
 });
 $('#model-indicator').addEventListener('keydown',event=>{
  if(event.key==='ArrowDown'){event.preventDefault();if(!isOpen('#model-pop'))openPop('#model-pop');focusModelField();}
 });
 /* Sair do popover com Tab fecha (o foco não fica órfão num popover aberto). */
 $('#model-pop').addEventListener('focusout',event=>{
  const next=event.relatedTarget;
  if(!(next instanceof Element))return;
  if($('#model-pop').contains(next)||next===$('#model-indicator'))return;
  closeTutorPops();
 });
 $('#new-session').addEventListener('click',()=>{
  if(isOpen('#new-session-pop')){closeTutorPops({restoreFocus:true});return;}
  openPop('#new-session-pop');
 });
 $('#chat-more').addEventListener('click',()=>{
  if(isOpen('#chat-more-pop')){closeTutorPops({restoreFocus:true});return;}
  openPop('#chat-more-pop');
 });
 /* Menu aberto por teclado: o foco entra no primeiro item. */
 for(const [trigger,pop] of [['#new-session','#new-session-pop'],['#chat-more','#chat-more-pop']]){
  $(trigger).addEventListener('keydown',event=>{
   if(event.key==='ArrowDown'){event.preventDefault();if(!isOpen(pop))openPop(pop);focusFirst(pop);}
  });
 }
 $('#sidechat-toggle').addEventListener('click',toggleSidechat);
 $('#conv-close').addEventListener('click',()=>closeTutorPops({restoreFocus:true}));
 $('#conv-library').addEventListener('click',()=>{closeTutorPops();host.openLibrary();});
 for(const selector of MENUS){
  const pop=$(selector);
  pop.addEventListener('click',event=>{
   /* Escolher uma ação fecha o menu (o handler do item já rodou); o
      interruptor fica aberto para mostrar o novo estado. */
   const item=event.target.closest?.('button[role="menuitem"]');
   if(item)closeTutorPops({restoreFocus:true});
  });
  pop.addEventListener('keydown',event=>{
   const items=menuItems(pop);
   const at=items.indexOf(document.activeElement);
   if(event.key==='ArrowDown'){event.preventDefault();items[(at+1)%items.length]?.focus();}
   else if(event.key==='ArrowUp'){event.preventDefault();items[(at-1+items.length)%items.length]?.focus();}
   else if(event.key==='Home'){event.preventDefault();items[0]?.focus();}
   else if(event.key==='End'){event.preventDefault();items.at(-1)?.focus();}
   else if(event.key==='Tab')closeTutorPops();
  });
 }
 /* Clique fora fecha. O clique no gatilho é do próprio gatilho (alterna). */
 document.addEventListener('click',event=>{
  if(!tutorPopOpen())return;
  const path=typeof event.composedPath==='function'?event.composedPath():[];
  for(const {pop,trigger} of POPS){
   const el=$(pop),button=$(trigger);
   if((el&&path.includes(el))||(button&&path.includes(button)))return;
  }
  closeTutorPops();
 });
}

export function initTutorHeader(hostApi){
 host=hostApi;
 labelBtn($('#sidechat-toggle'),'messageSquare');
 labelBtn($('#new-session'),'plus');
 labelBtn($('#chat-more'),'more');
 /* A seta do título é do host (asset do ícone), fora do texto. */
 const title=$('#session-title');
 if(title&&!title.querySelector('.icon'))title.insertAdjacentHTML('beforeend',icon('chevronDown'));
 const indicator=$('#model-indicator');
 /* O ícone do degrau "só ícone" e a seta são do host (assets do ícone). */
 if(indicator&&!indicator.querySelector('.mi-icon'))indicator.querySelector('#status-dot')?.insertAdjacentHTML('afterend',`<span class="mi-icon" aria-hidden="true">${icon('sparkles')}</span>`);
 if(indicator&&!indicator.querySelector('.mi-caret'))indicator.insertAdjacentHTML('beforeend',`<span class="mi-caret" aria-hidden="true">${icon('chevronDown')}</span>`);
 orderActions();
 renderMenus();
 wire();
 syncIndicator();
 syncSidechatButton();
 window.addEventListener('desk-tutor-link',()=>{syncIndicator();syncMore();});
 window.addEventListener('desk-support-changed',syncSidechatButton);
 /* O nome da sessão sem assunto traz a data no idioma da interface ("Sessão de…"/"Session of…"). */
 window.addEventListener(LANGUAGE_EVENT,()=>{renderMenus();syncIndicator();syncSidechatButton();paintSessionTitle();});
 window.addEventListener('desk-auto-compact-state',syncMore);
 window.addEventListener('desk-engine-facts',()=>{syncIndicator();syncMore();});
 /* A caixa muda de largura (coluna arrastada, janela, chat lateral): o degrau
    do indicador é medido de novo. */
 const box=$('#composer-box');
 if(box&&typeof ResizeObserver==='function'){
  let last=-1;
  new ResizeObserver(entries=>{
   const width=Math.round(entries[0]?.contentRect?.width||0);
   if(width===last)return;
   last=width;fitIndicator();
  }).observe(box);
 }
 /* A fonte da interface chega depois do primeiro desenho: o degrau medido
    com a fonte de reserva fica velho. */
 document.fonts?.ready.then(()=>fitIndicator());
 for(const id of ['#check','#include-refs','#send','#stop','#phone-photo']){
  const el=$(id);
  if(el&&typeof MutationObserver==='function')new MutationObserver(()=>fitIndicator()).observe(el,{attributes:true,attributeFilter:['hidden','data-app'],childList:true});
 }
 /* O medidor some/aparece e o `#auto-compact` troca `hidden`/`aria-pressed`
    fora de qualquer evento: observa os atributos que importam. */
 if(typeof MutationObserver==='function'){
  const watch=new MutationObserver(syncMore);
  for(const selector of ['#ctx-meter','#auto-compact']){
   const el=$(selector);
   if(el)watch.observe(el,{attributes:true,attributeFilter:['hidden','aria-pressed']});
  }
 }
}

export function renderTutorMenus(){if(host)renderMenus();}
export function syncTutorMenus(){if(host){syncIndicator();syncMore();}}
