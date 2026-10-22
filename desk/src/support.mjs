import {$,S,save,updateContextSummary} from './state.mjs';
import {icon} from '../icons.mjs';
import {t} from './ui-text.mjs';
import {mountSidechat,sidechatElement,setSidechatVisible} from './sidechat.mjs';

/* ---------------------------------------------------------------------------
   Área de apoio: o segundo leitor (Formulário) e o chat lateral dividem o
   mesmo lugar, à direita do primeiro leitor. Não há barra de abas: o chat abre
   e fecha pelo botão do cabeçalho do tutor e pelo cabeçalho dele próprio
   (`toggleSidechat`); o Formulário volta pelo menu Estudar
   (`toggleReferencePanel`) ou pela faixa `#support-restore`, que ocupa o lugar
   do segundo leitor recolhido.

   - O painel 2 NÃO é recriado: ele é movido uma vez para dentro do
     `#support-slot` (o `loadCourse` recria os painéis a cada matéria) e depois
     só recebe `hidden` — documento, página, zoom e rolagem sobrevivem.
   - O `#reference-toggle` do menu Estudar alterna o painel 2 com o mesmo
     significado de antes (`aria-pressed`).
   - Estado por matéria em `localStorage` (`mesa.support`), isolado do
     `desk.json`; o default do autor (2 leitores = Formulário aberto; 1 leitor =
     apoio recolhido) é preservado.
   --------------------------------------------------------------------------- */

const KEY='mesa.support';
export const supportState={courseId:'',two:false,formLabel:'Formulário',tab:'form',open:true,ready:false};
let slot=null,body=null,restore=null,sidechatMounted=false;
/* Onde a área de apoio estava antes de o chat abrir (para fechar devolver). */
let chatBefore=null;

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
 restore=document.createElement('button');
 restore.type='button';
 restore.id='support-restore';
 restore.hidden=true;
 restore.innerHTML=`<span class="pdf-restore-icon">${icon('chevronLeft')}</span><span class="pdf-restore-label"></span>`;
 restore.addEventListener('click',()=>selectTab('form'));
 slot.append(restore,body);
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

/* Com dois leitores e a área recolhida, o slot vira uma faixa estreita com o
   rótulo na vertical (a mesma forma do leitor recolhido); um clique reabre o
   Formulário. Com um leitor só não há o que reabrir. */
function paintRestore(collapsed){
 if(!restore)return;
 restore.hidden=!collapsed;
 const label=supportState.formLabel;
 restore.title=t('palette.refToggle.show',{name:label});
 restore.setAttribute('aria-label',t('palette.refToggle.show',{name:label}));
 const text=restore.querySelector('.pdf-restore-label');
 if(text&&text.textContent!==label)text.textContent=label;
}

export function apply(){
 if(!supportState.ready)return;
 const grid=$('#pdf-grid');
 if(!grid)return;
 const showForm=supportState.two&&supportState.open&&supportState.tab==='form';
 const showChat=supportState.open&&supportState.tab==='chat';
 const collapsed=supportState.two&&!supportState.open;
 paintRestore(collapsed);
 $('#references')?.classList.toggle('support-chat',showChat);
 /* O painel 2 é escondido/mostrado ANTES da classe `chat` entrar no corpo: o
    `display:none` do CSS zeraria a leitura da rolagem no momento de salvar. */
 const panel1=S.panels?.[1];
 if(panel1)setPanelVisible(panel1,showForm);
 if(slot){
  slot.hidden=!(showForm||showChat||collapsed);
  slot.classList.toggle('collapsed',collapsed);
 }
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
 /* O botão do chat lateral do cabeçalho do tutor reflete o mesmo estado. */
 window.dispatchEvent(new Event('desk-support-changed'));
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

export function sidechatOpen(){return !!supportState.open&&supportState.tab==='chat';}

/* Abre e fecha o chat lateral (botão do cabeçalho do tutor e botão Fechar do
   cabeçalho dele): sem estado próprio além de lembrar o que estava antes.
   Fechar devolve a área ao que estava antes de abrir (o Formulário, aberto ou
   recolhido); sem esse registro, com dois leitores volta ao Formulário e com
   um recolhe a área. */
export function toggleSidechat(){
 if(!supportState.ready)return;
 if(!sidechatOpen()){
  chatBefore={tab:supportState.tab,open:supportState.open};
  selectTab('chat');
  return;
 }
 const before=chatBefore;chatBefore=null;
 if(supportState.two){
  selectTab('form');
  if(before&&before.tab==='form'&&before.open===false)setOpen(false);
  return;
 }
 setOpen(false);
}

/* O botão Fechar do cabeçalho do chat lateral avisa por evento (o módulo do
   chat não importa este). Só fecha se ele estiver aberto. */
window.addEventListener('desk-sidechat-close',()=>{if(sidechatOpen())toggleSidechat();});

export function supportTab(){return supportState.tab;}
export function supportOpen(){return supportState.open;}
