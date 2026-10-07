import {$,S,save,updateContextSummary} from './state.mjs';
import {labelBtn} from './state.mjs';
import {mountSidechat,sidechatElement,setSidechatVisible} from './sidechat.mjs';

/* ---------------------------------------------------------------------------
   Área de apoio: o controle sempre visível que alterna o segundo leitor
   (Formulário) e o chat lateral, e recolhe/reabre a área inteira.

   - O painel 2 NÃO é recriado: ele é movido uma vez para dentro do
     `#support-slot` (o `loadCourse` recria os painéis a cada matéria) e depois
     só recebe `hidden` — documento, página, zoom e rolagem sobrevivem.
   - Recolher esconde o conteúdo mas deixa a barra de abas visível (affordance
     clara); o `#reference-toggle` do menu Estudar continua alternando o painel 2
     com o mesmo significado de antes (`aria-pressed`).
   - Estado por matéria em `localStorage` (`mesa.support`), isolado do
     `desk.json`; o default do autor (2 leitores = Formulário aberto; 1 leitor =
     apoio recolhido) é preservado.
   --------------------------------------------------------------------------- */

const KEY='mesa.support';
export const supportState={courseId:'',two:false,formLabel:'Formulário',tab:'form',open:true,ready:false};
let slot=null,body=null,sidechatMounted=false;

function readStore(){
 try{const raw=JSON.parse(localStorage.getItem(KEY));return raw&&typeof raw==='object'?raw:{};}catch{return {};}
}
function persist(){
 if(!supportState.ready)return;
 try{
  const all=readStore();
  all[supportState.courseId]={tab:supportState.tab,open:supportState.open};
  localStorage.setItem(KEY,JSON.stringify(all));
 }catch{}
}
function defaults(){
 return supportState.two?{tab:'form',open:true}:{tab:'chat',open:false};
}

export function initSupport(){
 const form=$('#support-tab-form'),chat=$('#support-tab-chat'),collapse=$('#support-collapse');
 if(form)form.addEventListener('click',()=>selectTab('form'));
 if(chat)chat.addEventListener('click',()=>selectTab('chat'));
 if(collapse)collapse.addEventListener('click',()=>setOpen(!supportState.open));
 for(const tab of [form,chat].filter(Boolean))tab.addEventListener('keydown',event=>{
  if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
  const tabs=[form,chat].filter(button=>button&&!button.hidden&&!button.disabled);
  if(!tabs.length)return;
  event.preventDefault();event.stopPropagation();
  const index=tabs.indexOf(tab);
  const next=event.key==='Home'?tabs[0]:event.key==='End'?tabs.at(-1):tabs[(index+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length];
  selectTab(next===form?'form':'chat');
  next.focus();
 });
}

/* A matéria entra: estado salvo por matéria manda; sem estado salvo vale o
   layout de sempre (2 leitores com o Formulário aberto; 1 leitor recolhido). */
export function beginCourse({courseId,two,formLabel,referenceVisible}={}){
 supportState.courseId=courseId||'';
 supportState.two=!!two;
 supportState.formLabel=String(formLabel||'Formulário');
 const saved=readStore()[supportState.courseId]||{};
 const def=defaults();
 let tab=saved.tab==='chat'||saved.tab==='form'?saved.tab:def.tab;
 if(!supportState.two)tab='chat';
 let open=Object.prototype.hasOwnProperty.call(saved,'open')?!!saved.open:def.open;
 if(tab==='form'&&!Object.prototype.hasOwnProperty.call(saved,'open'))open=referenceVisible!==false;
 supportState.tab=tab;
 supportState.open=open;
 supportState.ready=true;
 apply();
}

/* O `loadCourse` chamou `#pdf-grid.replaceChildren()` e recriou os painéis: o
   slot volta ao fim da grade, o painel 2 entra no corpo e o chat lateral é
   montado uma vez (o mesmo nó sobrevive às trocas). */
export function attachPanels(panels,divider){
 const grid=$('#pdf-grid');
 if(!grid)return;
 ensureSlot(grid);
 const panel1=Array.isArray(panels)?panels[1]:null;
 if(panel1&&body)body.append(panel1.el);
 void divider;
 grid.append(slot);
 if(!sidechatMounted){mountSidechat(body);sidechatMounted=true;}
 else if(sidechatElement()&&sidechatElement().parentElement!==body)body.append(sidechatElement());
 apply();
}

function ensureSlot(grid){
 if(slot&&slot.isConnected)return;
 slot=document.createElement('div');
 slot.id='support-slot';
 slot.hidden=true;
 body=document.createElement('div');
 body.id='support-body';
 slot.append(body);
 grid.append(slot);
 if(sidechatElement())body.append(sidechatElement());
}

/* Painel 2 escondido sem perder rolagem: desconecta o ResizeObserver antes de
   esconder (um observer vendo largura 0 sobrescreveria a posição) e no retorno
   re-observa e re-renderiza — o `render()` do próprio painel repõe
   `scrollX/scrollY` salvos. */
function setPanelVisible(panel,visible){
 if(!panel?.el)return;
 if(visible===!panel.el.hidden)return;
 if(!visible){
  if(panel.rememberScroll)panel.rememberScroll();
  panel._supportScroll={x:panel.scrollX||0,y:panel.scrollY||0};
  try{panel.resize?.disconnect();}catch{}
  panel.el.hidden=true;
  return;
 }
 const saved=panel._supportScroll||{x:panel.scrollX||0,y:panel.scrollY||0};
 panel.el.hidden=false;
 panel.scrollX=saved.x;panel.scrollY=saved.y;
 const restore=()=>{
  if(panel.el.hidden)return;
  panel.scrollX=saved.x;panel.scrollY=saved.y;
  const box=panel.q?.('.pdf-viewport');
  if(box){box.scrollLeft=saved.x;box.scrollTop=saved.y;}
 };
 try{panel.resize?.observe?.(panel.q('.pdf-viewport'));}catch{}
 requestAnimationFrame(restore);
 /* O ResizeObserver do painel mede a saída de `display:none` (0) e pode
    sobrescrever a posição depois; o render repõe, mas re-aplicamos a posição
    salva por alguns instantes até o layout estabilizar. */
 setTimeout(restore,250);
 setTimeout(()=>{restore();panel.updateCurrentPage?.();},700);
 if(panel.doc&&panel.render)panel.render();
 else restore();
}

function paintBar(){
 const bar=$('#support-bar');
 if(!bar)return;
 bar.hidden=false;
 const form=$('#support-tab-form'),chat=$('#support-tab-chat'),collapse=$('#support-collapse');
 if(form){
  form.hidden=!supportState.two;
  form.textContent=supportState.formLabel;
  form.setAttribute('aria-selected',String(supportState.tab==='form'&&supportState.open));
  form.tabIndex=supportState.two&&supportState.tab==='form'?0:-1;
 }
 if(chat){chat.setAttribute('aria-selected',String(supportState.tab==='chat'&&supportState.open));chat.tabIndex=supportState.tab==='chat'||!supportState.two?0:-1;}
 if(collapse){
  collapse.setAttribute('aria-expanded',String(supportState.open));
  const label=supportState.open?'Recolher a área de apoio':`Mostrar ${supportState.tab==='chat'?'o chat lateral':'o formulário'}`;
  collapse.title=label;
  collapse.setAttribute('aria-label',label);
  labelBtn(collapse,supportState.open?'chevronRight':'chevronLeft',supportState.open?'Recolher':(supportState.tab==='chat'?'Chat lateral':'Formulário'));
 }
 bar.dataset.tab=supportState.tab;
 bar.dataset.open=String(supportState.open);
}

export function apply(){
 if(!supportState.ready)return;
 const grid=$('#pdf-grid');
 if(!grid)return;
 paintBar();
 const showForm=supportState.two&&supportState.open&&supportState.tab==='form';
 const showChat=supportState.open&&supportState.tab==='chat';
 $('#references')?.classList.toggle('support-chat',showChat);
 /* O painel 2 é escondido/mostrado ANTES da classe `chat` entrar no corpo: o
    `display:none` do CSS zeraria a leitura da rolagem no momento de salvar. */
 const panel1=S.panels?.[1];
 if(panel1)setPanelVisible(panel1,showForm);
 if(slot)slot.hidden=!(showForm||showChat);
 if(body)body.classList.toggle('chat',showChat);
 if(S.pdfDivider)S.pdfDivider.hidden=!(supportState.two&&supportState.open);
 grid.classList.toggle('single',!supportState.two||!supportState.open);
 /* A semântica antiga do `referenceVisible` continua: painel 2 do PDF visível.
    O `#reference-toggle` do menu e o contexto enviado seguem esse fato. */
 S.refVisible=showForm;
 const toggle=$('#reference-toggle');
 if(toggle)toggle.setAttribute('aria-pressed',String(showForm));
 setSidechatVisible(showChat);
 updateContextSummary();
}

export function selectTab(tab){
 if(tab!=='form'&&tab!=='chat')return;
 if(tab==='form'&&!supportState.two)return;
 const changed=supportState.tab!==tab||!supportState.open;
 supportState.tab=tab;
 supportState.open=true;
 apply();
 if(changed){persist();save();}
}

export function setOpen(open){
 const next=!!open;
 if(next===supportState.open)return;
 supportState.open=next;
 apply();
 persist();save();
}

/* Menu Estudar → Formulário: alterna o painel 2 (comportamento de sempre); se o
   chat lateral está à frente, o clique traz o Formulário e o abre. */
export function toggleReferencePanel(){
 if(supportState.tab!=='form'){supportState.tab='form';supportState.open=true;}
 else supportState.open=!supportState.open;
 apply();
 persist();save();
}

export function supportTab(){return supportState.tab;}
export function supportOpen(){return supportState.open;}
