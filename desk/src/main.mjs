import {bindPointerDrag} from './pointer-drag.mjs';
import {icon} from '../icons.mjs';
import {$,S,toast,connectionState,save,calcHeightPx,studySnapshot,pageRefs,layoutSnapshot,updateContextSummary,fillSessions,applyStudy,applyTheme,THEME_LABELS,labelBtn,settings,connect,loadCourse,markCourseTab,switchCourse,supportsCapability,refs} from './state.mjs';
import {conferir,conferirGeogebra,send,resetAttachments,restoreAttachments,hideQuoteButton,showHistory} from './chat.mjs';
import {initSupport,toggleReferencePanel} from './support.mjs';
import {initSidechat} from './sidechat.mjs';
import {initFreeStudy} from './free-study.mjs';
import {renderResumeCard} from './resume.mjs';
import resumeCore from './generated/resume.core.js';

import {sendGgbRect,activateGeogebra,deactivateGeogebra} from './ggb.mjs';
import {activateReview,deactivateReview,drawReview} from './review.mjs';
import {expandCalculator,initCalculator} from './calc.mjs';
import tabsCore from './generated/tabsview.core.js';
import {build,renderChildren} from './view-host.mjs';
import {appendCourseRow,clearEndDay,renderAboutLead,renderAboutUpdate,renderComponentChecking,renderComponentRows,renderCourseRows,renderEndDay,renderHelpVersion,renderSettingsHead,renderWelcome} from './dialogs.mjs';
import * as slash from './slash.mjs';
import * as queue from './queue.mjs';
import {toggleDensity,compactMode} from './density.mjs';
function setMenuOpen(el,open,{animate=true,blur=false}={}){
 if(!el)return;
 const trigger=el.querySelector('.nav-trigger');
 if(open){
  el.classList.remove('closing');
  el.classList.add('open');
  trigger?.setAttribute('aria-expanded','true');
  return;
 }
 const wasOpen=el.classList.contains('open');
 el.classList.remove('open');
 trigger?.setAttribute('aria-expanded','false');
 if(!wasOpen)return;
 if(blur&&el.contains(document.activeElement))document.activeElement.blur();
 if(!animate)return;
 const pop=el.querySelector('.nav-pop');
 if(!pop)return;
 el.classList.add('closing');
 const done=()=>el.classList.remove('closing');
 pop.addEventListener('transitionend',done,{once:true});
 setTimeout(done,400);
}
function closeMenus(options){for(const id of ['#study-menu','#mesa-menu'])setMenuOpen($(id),false,options);}
function wireMenu(el){
 const trigger=el.querySelector('.nav-trigger');
 if(!trigger)return;
 trigger.addEventListener('click',e=>{e.stopPropagation();setMenuOpen(el,!el.classList.contains('open'));});
 trigger.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setMenuOpen(el,!el.classList.contains('open'));}});
}
for(const id of ['#study-menu','#mesa-menu'])wireMenu($(id));
document.addEventListener('click',e=>{
 const path=typeof e.composedPath==='function'?e.composedPath():[];
 for(const id of ['#study-menu','#mesa-menu']){
  const el=$(id);
  if(!el)continue;
  /* `composedPath` mantém o alvo original mesmo se um re-render no meio do
     clique (ex.: `#theme-cycle`) desanexar o nó de dentro do menu; por isso a
     decisão não pode depender de `el.contains(e.target)` depois do handler. */
  if(path.includes(el))continue;
  setMenuOpen(el,false,{animate:false});
 }
});
/* Abas e menus vêm do Bend (`core/tabsview.bend`): este arquivo só aplica a
   árvore (view-host) e injeta os ícones do host (icons.mjs). Fatos: matérias
   resolvidas pelo main, flags do `desk` normalizado e o tema corrente. */
let tabsCourses=[];
function toCoreCourses(courses){
 let out={$:'Nil'};
 for(let i=(courses||[]).length-1;i>=0;i--){
  const c=courses[i]||{};
  out={$:'Con',head:{$:'Tab',id:String(c.id??''),name:String(c.name??'')},tail:out};
 }
 return out;
}
function menuFactsOf(){
 const desk=S.appConfig.desk||{};
 const panels=Array.isArray(desk.panels)?desk.panels:[];
 return {$:'MenuFacts',twoPanels:panels.length>1,toggle:String(panels[1]?.toggle||''),refVisible:!!S.refVisible,xournal:desk.xournal!==false,win32:S.appConfig.platform==='win32',hasXournalPath:!!S.appConfig.xournalPath,theme:S.currentTheme||'auto',endDay:desk.endDay!==false,compact:compactMode()};
}
const tabsHandlers={SelectCourse:e=>selectTab(e.currentTarget.dataset.id),OpenGeoGebra:()=>selectTab('geogebra'),NewCourse:()=>openSettings(false)};
const menuHandlers={ToggleReference:toggleReference,OpenXournal:openXournal,CycleTheme:cycleTheme,OpenHelp:openHelp,OpenSettings:()=>openSettings(false),OpenAbout:openAbout,OpenEndDay:openEndDay,ToggleDensity:toggleDensityMode,OpenReview:()=>selectTab('review')};
/* Andaime `data-icon`: o núcleo diz o nome do ícone; o SVG é deste arquivo. */
function iconize(root){
 for(const el of root.querySelectorAll('[data-icon]')){
  const name=el.dataset.icon,tight=el.hasAttribute('data-icon-tight'),label=el.textContent;
  el.removeAttribute('data-icon');el.removeAttribute('data-icon-tight');
  el.innerHTML=icon(name)+(label?(tight?'':' ')+`<span>${label}</span>`:'');
 }
}
function renderTabsView(){
 const box=$('#course-tabs');if(!box)return;
 renderChildren(box,tabsCore.courseTabs(toCoreCourses(tabsCourses),S.currentCourseId||'',!!S.ggbActive,!!(S.busy||S.connecting||S.switching)),tabsHandlers);
 iconize(box);
}
function renderMenus(){
 const facts=menuFactsOf(),study=$('#study-pop'),mesa=$('#mesa-pop');
 if(study){renderChildren(study,tabsCore.studyItems(facts),menuHandlers);iconize(study);}
 if(mesa){renderChildren(mesa,tabsCore.mesaItems(facts),menuHandlers);iconize(mesa);}
}
function selectTab(id){
 if(!id)return;
 /* O caderno e o applet não dividem a área de estudo: abrir um fecha o outro. */
 if(id==='review'){if(!S.reviewActive){deactivateGeogebra();activateReview();}return;}
 if(id==='geogebra'){if(!S.ggbActive){deactivateReview();activateGeogebra();}return;}
 if(S.ggbActive&&id===S.currentCourseId){deactivateGeogebra();markCourseTab(id);return;}
 if(S.reviewActive&&id===S.currentCourseId){deactivateReview();markCourseTab(id);return;}
 if(S.reviewActive)deactivateReview();
 selectCourse(id);
}
let tabFocusId='',tabFocusGen=0;
/* A troca recria as abas e o connect que ela dispara as desabilita por um
   instante (botão disabled não recebe foco): espera a aba ativa poder recebê-lo. */
function focusTabWhenReady(id){
 const gen=++tabFocusGen;
 let tries=0;
 const tick=()=>{
  if(gen!==tabFocusGen)return;
  const el=document.querySelector(`#course-tabs button[data-id="${CSS.escape(id)}"]`);
  if(el&&!el.disabled&&el.classList.contains('active')){el.focus();return;}
  if(tries++<120){setTimeout(tick,100);return;}
  if(el&&!el.disabled)document.querySelector('#course-tabs button.active')?.focus();
 };
 tick();
}
async function selectCourse(id){
 await switchCourse(id);
 renderTabsView();
 /* A troca recria as abas; devolve o foco à ativa quando a seta o moveu. */
 if(tabFocusId){
  const want=tabFocusId;
  tabFocusId='';
  const el=document.querySelector(`#course-tabs button[data-id="${CSS.escape(want)}"]`);
  if(el&&!el.disabled&&el.classList.contains('active'))el.focus();
  else if(S.currentCourseId===want&&!S.ggbActive)focusTabWhenReady(want);
  else document.querySelector('#course-tabs button.active')?.focus();
 }
}
/* Setas do tablist: movem o foco e ativam como o clique (o roving tabindex vem
   do núcleo: aba ativa `0`, demais `-1`). */
function moveTabFocus(dir){
 const tabs=[...document.querySelectorAll('#course-tabs button[role="tab"]:not([disabled])')];
 if(!tabs.length)return;
 const i=Math.max(0,tabs.indexOf(document.activeElement));
 const next=tabs[(i+dir+tabs.length)%tabs.length];
 const id=next.dataset.id||'';
 next.focus();
 if(id&&id!=='geogebra')tabFocusId=id;
 selectTab(id);
}
function cycleToTab(dir){
 const tabs=[...document.querySelectorAll('#course-tabs button')];
 if(tabs.length<2)return;
 const i=tabs.findIndex(t=>t.classList.contains('active'));
 selectTab(tabs[((i<0?0:i)+dir+tabs.length)%tabs.length].dataset.id);
}
function openXournal(){window.desk.openXournal().catch(e=>toast(e.message));}
/* O menu Estudar → Formulário delega à área de apoio (mesma semântica de antes:
   alterna o painel 2; se o Chat lateral está à frente, traz o Formulário). */
function toggleReference(){toggleReferencePanel();}
function cycleTheme(){
 const order=['auto','light','dark'];
 const next=order[(order.indexOf(S.currentTheme)+1)%order.length];
 applyTheme(next);
 toast(`${THEME_LABELS[next]}.`);
 save();
 /* Sem re-render dos menus: o `applyTheme` já troca o rótulo do item vivo e
    recriar os filhos no meio do clique desanexaria o alvo (o menu fecharia). */
}
/* Encerrar por hoje saiu do composer e virou item do menu Estudar (o `hidden`
   pela flag `endDay` e o rótulo vêm do núcleo). O diálogo é o mesmo; o miolo é
   do `dialogsview` e o submit à prova de falha segue no `#end-day-form`. */
function openEndDay(){
 if(S.busy){toast('Pare a resposta antes de encerrar.');return;}
 $('#end-day-dialog').showModal();
}
/* Modo compacto (menu Mesa e ⌘⇧D): o item vivo só troca o que o núcleo manda —
   ícone do modo corrente e `aria-pressed` —, então o menu fica aberto e o
   `selected` do select das Configurações acompanha pelo `sync` da densidade. */
function refreshDensityItem(){
 const button=$('#density-cycle');
 if(!button)return;
 const compact=compactMode();
 button.setAttribute('aria-pressed',String(compact));
 labelBtn(button,tabsCore.densityIcon(compact),tabsCore.densityLabel());
}
function toggleDensityMode(){
 toggleDensity();
 refreshDensityItem();
}
$('#new-tab')?.replaceWith(build(tabsCore.newTab(),tabsHandlers));
$('#send').onclick=()=>{queue.release();send($('#prompt').value);};
/* ⏎ envia; ⇧⏎ quebra linha; ⌘/Ctrl+⏎ interrompe e envia (steer) com o Pi
   ocupado — livre, vale como ⏎. Ocupado, o ⏎ do composer vira fila: quem captura
   antes é o `queue.mjs` (com o menu `/` aberto, o slash consome na janela e passa
   na frente dos dois). Enviar à mão solta a fila segurada (`release`): o usuário
   voltou ao comando. */
$('#prompt').onkeydown=e=>{
 if(e.key!=='Enter'||e.isComposing)return;
 const steer=e.metaKey||e.ctrlKey;
 if(e.shiftKey&&!steer)return;
 e.preventDefault();
 const value=$('#prompt').value;
 if(steer){
  /* Motor sem steer: ⌘/Ctrl+⏎ com o turno aberto enfileira — a Mesa não promete
     interromper e reenviar onde o transporte não oferece. */
  if(S.busy&&!supportsCapability('steer')){queue.enqueueFromComposer();return;}
  if(value.trim()||S.attachments.length)send(value,undefined,{steer:true});
  return;
 }
 if(!S.busy){queue.release();send(value);}
};
$('#check').onclick=()=>conferir();$('#connect').onclick=()=>connect().catch(()=>{});$('#stop').onclick=()=>{window.dispatchEvent(new Event('desk-stop'));window.desk.abort().catch(e=>toast(e.message));};
$('#exercise-title').addEventListener('input',()=>{updateContextSummary();save();});
$('#pick-xopp').onclick=async()=>{try{const file=await window.desk.pickXopp();if(file)applyStudy({...studySnapshot(),xopp:file});save(true);}catch(e){toast(e.message);}};
/* O Encerrar por hoje mora no menu Estudar (`OpenEndDay`), decidido pelo núcleo
   com a flag `endDay`. O miolo do `#end-day-dialog` vem do Bend
   (`core/dialogsview.bend`) — rótulos, textareas e ações; o `<form>` e o submit
   continuam aqui. */
renderEndDay();
/* Encerrar por hoje à prova de falha: o registro local é gravado PRIMEIRO — o
   diálogo só fecha se gravou (erro de IO mantém o texto na tela) — e só então o
   Pi é chamado. Sem conexão, sem provedor ou com o Pi recusando, o registro
   fica no disco e o cartão de retomada aparece na próxima abertura. */
$('#end-day-form').addEventListener('submit',async e=>{
 if(e.submitter?.id!=='end-day-save')return;
 e.preventDefault();
 const stopped=$('#end-where').value.trim(),next=$('#end-next').value.trim();
 if(!stopped||!next)return;
 const study=studySnapshot();
 let saved=null;
 try{
  saved=await window.desk.endDaySave({record:{stopped,next,exercise:study.title,xopp:study.xopp,pages:pageRefs()}});
 }catch(err){
  toast(`Não consegui guardar o registro: ${err.message}`);
  return;
 }
 $('#end-day-dialog').close();
 clearEndDay();
 renderResumeCard(saved);
 if(!(await send(resumeCore.endDayDraft(stopped,next),[])))toast(`Registro guardado localmente — o envio ao ${S.agentLabel} falhou.`);
});
window.desk.onMenuCheck(()=>conferir());
window.desk.onMenuGeogebra(()=>conferirGeogebra());
window.desk.onMenuStop(()=>{if(S.busy&&!$('#pi-dialog').open){window.dispatchEvent(new Event('desk-stop'));window.desk.abort().catch(e=>toast(e.message));}});
window.desk.onMenuChatToggle(()=>toggleChat());
/* Nova conversa: o seletor `#new-session-engine` escolhe o motor SÓ desta
   conversa nova — a atual continua no motor dela até aqui. O host devolve os
   metadados do motor criado e o `fillSessions` reajusta rótulo/capacidades. */
$('#new-session').onclick=async()=>{
 if(S.busy||S.connecting||S.switching){toast(`Aguarde: ${S.agentLabel} está conectando.`);return;}
 const picker=$('#new-session-engine');
 const engine=picker?.value==='claude'?'claude':'pi';
 const question=engine==='claude'?'Começar uma nova conversa com o Claude Code (experimental)? A conversa atual continuará salva.':'Começar uma nova conversa? A sessão atual continuará salva.';
 if(!confirm(question))return;
 try{
  clearTimeout(S.saveTimer);await window.desk.save(layoutSnapshot());
  const data=await window.desk.newSession(engine);
  S.connected=false;
  if(data.workspace){$('#messages').replaceChildren();await loadCourse(data);}
  else fillSessions(data);
  connectionState('',`${S.agentLabel} desconectado`);
  if(!data.workspace){
   applyStudy(data.state?.study);
   $('#prompt').value=data.state?.draft||'';
   $('#messages').replaceChildren();
   /* Cache do descritor antes do connect: offline/sem login, a conversa Claude
      continua visível (nada de cair para o Pi). */
   if(Array.isArray(data.messages)&&data.messages.length)showHistory(data.messages);
   resetAttachments();
   queue.adopt(data.pending);
   restoreAttachments(data.pending);
   renderResumeCard(data.resume);
  }
  await connect();
  toast('Nova conversa iniciada.');
 }catch(e){toast(e.message);}
};
/* Conversas da matéria (pedido 3): o seletor continua (compatibilidade), e o
   painel visível lista título/data/trecho/motor. A escolha passa pelo MESMO
   caminho do seletor — rascunho, fila e anexos são salvos/restaurados como
   sempre, e nada é enviado sozinho. Leitura pura: a lista não renomeia/apaga. */
async function openConversation(file){
 if(!file||file===S.currentSession)return false;
 if(S.busy||S.connecting||S.switching){toast(`Aguarde ${S.agentLabel} terminar de conectar.`);$('#session-select').value=S.currentSession;return false;}
 try{
  clearTimeout(S.saveTimer);await window.desk.save(layoutSnapshot());
  const data=await window.desk.openSession(file);
  S.connected=false;
  if(data.workspace){$('#messages').replaceChildren();await loadCourse(data);}
  else fillSessions(data);
  connectionState('',`${S.agentLabel} desconectado`);
  if(!data.workspace){
   applyStudy(data.state?.study);
   $('#prompt').value=data.state?.draft||'';
   $('#messages').replaceChildren();
   if(Array.isArray(data.messages)&&data.messages.length)showHistory(data.messages);
   resetAttachments();queue.adopt(data.pending);restoreAttachments(data.pending);renderResumeCard(data.resume);
  }
  await connect();
  return true;
 }catch(e){toast(e.message);$('#session-select').value=S.currentSession;return false;}
}
$('#session-select').onchange=()=>openConversation($('#session-select').value);
function conversationWhen(value){
 const stamp=Number(value)||0;if(!stamp)return '';
 const date=new Date(stamp),today=new Date();
 const sameDay=date.toDateString()===today.toDateString();
 return date.toLocaleString('pt-BR',sameDay?{hour:'2-digit',minute:'2-digit'}:{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
}
function conversationEngineLabel(engine){return engine==='claude'?'Claude Code (experimental)':engine==='pi'?'Pi':(engine||S.engine||'pi');}
function fallbackConversations(){
 return [...document.querySelectorAll('#session-select option')].map(option=>({id:option.value,title:option.textContent,preview:'',at:0,engine:S.engine}));
}
async function renderConversations(){
 const list=$('#conv-list');if(!list)return;
 let items=null;
 try{if(typeof window.desk.conversations==='function')items=await window.desk.conversations();}catch{}
 if(!Array.isArray(items)||!items.length)items=fallbackConversations();
 list.replaceChildren();
 if(!items.length){const empty=document.createElement('p');empty.className='conv-empty';empty.textContent='Nenhuma conversa nesta matéria ainda.';list.append(empty);return;}
 for(const item of items){
  const entry={...item,id:String(item.id||item.path||''),title:String(item.title||item.label||'(sem título)'),preview:String(item.preview||''),engine:item.engine||S.engine,at:Number(item.at||item.started||0)};
  const button=document.createElement('button');
  button.type='button';button.className='conv-row'+(entry.id===S.currentSession?' current':'');
  button.dataset.id=entry.id;
  const head=document.createElement('span');head.className='conv-title';head.textContent=entry.title;
  const meta=document.createElement('span');meta.className='conv-meta';meta.textContent=[conversationWhen(entry.at),conversationEngineLabel(entry.engine)].filter(Boolean).join(' · ');
  const preview=document.createElement('span');preview.className='conv-preview';preview.textContent=entry.preview||'Sem prévia';
  button.append(head,meta,preview);
  button.addEventListener('click',async()=>{closeConversations();await openConversation(entry.id);});
  list.append(button);
 }
}
function closeConversations(){const pop=$('#conversations-pop');if(!pop)return;pop.hidden=true;$('#conversations-toggle')?.setAttribute('aria-expanded','false');}
$('#conversations-toggle').onclick=async()=>{
 const pop=$('#conversations-pop');if(!pop)return;
 if(!pop.hidden){closeConversations();return;}
 await renderConversations();
 pop.hidden=false;
 $('#conversations-toggle').setAttribute('aria-expanded','true');
};
$('#conv-close').onclick=()=>closeConversations();
document.addEventListener('click',event=>{
 const pop=$('#conversations-pop');if(!pop||pop.hidden)return;
 if(event.target?.closest?.('#conversations-pop, #conversations-toggle'))return;
 closeConversations();
});
document.addEventListener('keydown',event=>{if(event.key==='Escape')closeConversations();});
$('#include-refs').onclick=()=>{S.includeRefs=!S.includeRefs;$('#include-refs').setAttribute('aria-pressed',String(S.includeRefs));updateContextSummary();};
/* Estado das referências (pedido 4): a etiqueta ao lado do toggle diz o que vai
   junto ("PDF e página incluídos" / "Sem referências") e abre os detalhes —
   caminho+página versus a câmera, que envia imagem. O toggle não muda. */
function closeRefsPop(){
 const pop=$('#refs-pop');
 if(pop)pop.hidden=true;
 $('#refs-state')?.setAttribute('aria-expanded','false');
}
function placeRefsPop(){
 const pop=$('#refs-pop'),button=$('#refs-state');
 if(!pop||!button||pop.hidden)return;
 const rect=button.getBoundingClientRect();
 pop.style.left=Math.round(Math.max(8,Math.min(rect.left,innerWidth-pop.offsetWidth-8)))+'px';
 pop.style.top=Math.round(Math.max(8,rect.top-pop.offsetHeight-8))+'px';
}
window.addEventListener('resize',placeRefsPop);
function refsPopRow(text,className=''){
 const row=document.createElement('p');row.className=className;row.textContent=text;return row;
}
function renderRefsPop(){
 const pop=$('#refs-pop');if(!pop)return;
 const list=refs();
 pop.replaceChildren();
 const title=document.createElement('strong');title.textContent='Referências desta mensagem';
 pop.append(title);
 if(S.includeRefs&&list.length){
  for(const ref of list)pop.append(refsPopRow(`${String(ref.path).split(/[/\\]/).pop()||'PDF'} — página ${ref.page}`,'refs-item'));
  pop.append(refsPopRow('Vai o caminho do arquivo e a página; o PDF inteiro não é enviado.','fine'));
 }else{
  pop.append(refsPopRow(S.includeRefs?'Nenhum PDF aberto agora.':'O botão Referências está desligado — nenhuma referência vai junto.','fine'));
 }
 pop.append(refsPopRow('A câmera do leitor é separada: ela anexa uma imagem da página à mensagem.','fine'));
 const close=document.createElement('button');close.type='button';close.className='primary';close.textContent='Fechar';
 close.addEventListener('click',closeRefsPop);
 const actions=document.createElement('div');actions.className='dialog-actions';actions.append(close);pop.append(actions);
}
$('#refs-state').onclick=()=>{
 const pop=$('#refs-pop');if(!pop)return;
 if(!pop.hidden){closeRefsPop();return;}
 renderRefsPop();
 pop.hidden=false;
 placeRefsPop();
 $('#refs-state').setAttribute('aria-expanded','true');
};
document.addEventListener('click',event=>{
 const pop=$('#refs-pop');if(!pop||pop.hidden)return;
 if(event.target?.closest?.('#refs-pop, #refs-state'))return;
 closeRefsPop();
});
document.addEventListener('keydown',event=>{if(event.key==='Escape')closeRefsPop();});
/* A calculadora é view do Bend (`core/calcview.bend` → `desk/src/calc.mjs`):
   colapso, ângulo, avaliação, histórico e guia saem de lá; o divisor abaixo
   continua aqui (arrasto/medição são fatos de host). */
initCalculator();
bindPointerDrag($('#divider'),e=>{document.documentElement.style.setProperty('--chat',Math.max(310,Math.min(650,innerWidth-e.clientX))+'px');},save);
$('#divider').onkeydown=e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){const w=parseInt(getComputedStyle(document.documentElement).getPropertyValue('--chat'));document.documentElement.style.setProperty('--chat',Math.max(310,Math.min(650,w+(e.key==='ArrowLeft'?20:-20)))+'px');save();}};
bindPointerDrag($('#calc-divider'),e=>{const side=$('#sidebar').getBoundingClientRect();const height=Math.max(72,Math.min(side.height*0.7,side.bottom-e.clientY));document.documentElement.style.setProperty('--calc',Math.round(height)+'px');expandCalculator();},save);
$('#calc-divider').onkeydown=e=>{if(['ArrowUp','ArrowDown'].includes(e.key)){const h=calcHeightPx();document.documentElement.style.setProperty('--calc',Math.max(72,Math.min(700,h+(e.key==='ArrowUp'?20:-20)))+'px');save();}};
let chatCollapsed=false,lastChatToggle=0;
function setChatCollapsed(value){
 chatCollapsed=!!value;
 document.body.classList.toggle('chat-collapsed',chatCollapsed);
 $('#chat-restore').hidden=!chatCollapsed;
 const collapse=$('#chat-collapse');
 if(collapse){
  collapse.setAttribute('aria-expanded',String(!chatCollapsed));
  collapse.title=chatCollapsed?'Mostrar o chat (⌘\\)':'Recolher o chat (⌘\\)';
 }
 if(S.ggbActive)sendGgbRect();
}
function toggleChat(){const now=Date.now();if(now-lastChatToggle<150)return;lastChatToggle=now;setChatCollapsed(!chatCollapsed);}
function focusPdfFind(){(S.panels.find(p=>p.el.contains(document.activeElement))||S.panels[0])?.setFind(true);}
$('#chat-restore').onclick=()=>setChatCollapsed(false);
/* Botão visível de recolher (pedido 7): mesmo caminho do atalho ⌘\; o botão de
   restaurar continua flutuando com o chat recolhido. */
$('#chat-collapse').onclick=()=>toggleChat();
labelBtn($('#chat-collapse'),'chevronRight');
function typingTarget(el){return el?.closest?.('input,textarea,select')||['INPUT','TEXTAREA','SELECT'].includes(el?.tagName);}
window.addEventListener('keydown',e=>{
 /* Guard de modal no topo do handler: com um diálogo aberto, nenhum atalho pode
    abrir outro (⌘, empilhava Configurações sobre a Ajuda). Esc passa: cada
    diálogo se fecha pelo cancelamento nativo/handler próprio. */
 const modal=document.querySelector('dialog[open]');
 if(modal&&e.key!=='Escape')return;
 if(e.key==='Escape'){
  closeMenus({blur:true});
  if(modal)return;
  if(S.busy){e.preventDefault();window.dispatchEvent(new Event('desk-stop'));window.desk.abort().catch(err=>toast(err.message));return;}
  if(!$('#quote-btn').hidden){e.preventDefault();hideQuoteButton();window.getSelection()?.removeAllRanges();return;}
  const focusedFind=document.activeElement?.closest?.('.pdf-find');
  if(focusedFind&&!focusedFind.hidden){e.preventDefault();const panel=S.panels.find(p=>p.el===focusedFind.closest('.pdf-panel'));if(panel){panel.clearFind();panel.setFind(false);panel.el.focus();}return;}
  if(S.panels.some(p=>p.findTerm)){const panel=S.panels.find(p=>p.findTerm);if(panel){panel.clearFind();panel.setFind(false);}return;}
  return;
 }
 if((e.metaKey||e.ctrlKey)&&e.key===','){e.preventDefault();openSettings();return;}
 if((e.metaKey||e.ctrlKey)&&e.key==='/'){e.preventDefault();openHelp();return;}
 if((e.metaKey||e.ctrlKey)&&e.shiftKey&&e.key.toLowerCase()==='c'){e.preventDefault();if(!S.busy)conferir();return;}
 if((e.metaKey||e.ctrlKey)&&e.shiftKey&&e.key.toLowerCase()==='g'){e.preventDefault();conferirGeogebra();return;}
 if((e.metaKey||e.ctrlKey)&&!e.altKey){
  if(e.key==='Tab'){e.preventDefault();cycleToTab(e.shiftKey?-1:1);return;}
  if(e.key.toLowerCase()==='t'){e.preventDefault();openSettings(false);return;}
  if(e.shiftKey&&e.key.toLowerCase()==='i'){e.preventDefault();const panel=S.panels.find(p=>p.el.contains(document.activeElement))||S.panels[0];if(panel&&panel.doc)panel.toggleInvert();return;}
  if(e.shiftKey&&e.key.toLowerCase()==='d'){e.preventDefault();toggleDensityMode();return;}
  if(e.key.toLowerCase()==='f'){e.preventDefault();focusPdfFind();return;}
  if(e.key==='\\'){e.preventDefault();toggleChat();return;}
  if(/^[1-9]$/.test(e.key)){e.preventDefault();const tab=document.querySelectorAll('#course-tabs button')[Number(e.key)-1];if(tab)selectTab(tab.dataset.id);return;}
 }
 if((e.key==='ArrowLeft'||e.key==='ArrowRight')&&e.target?.closest?.('#course-tabs')){e.preventDefault();moveTabFocus(e.key==='ArrowRight'?1:-1);return;}
 if(typingTarget(e.target)||e.target===document.getElementById('divider')||e.target===document.getElementById('calc-divider')||e.target?.classList?.contains('pdf-divider'))return;
 if(e.key==='ArrowLeft'||e.key==='ArrowRight'){const panel=document.activeElement?.closest?.('.pdf-panel')||S.panels[0]?.el;const inst=S.panels.find(p=>p.el===panel);if(!inst)return;e.preventDefault();inst.goto(inst.page+(e.key==='ArrowRight'?1:-1));}
});
$('#model-select').onchange=()=>{const [provider,id]=JSON.parse($('#model-select').value);settings({model:{provider,id}});};$('#thinking-select').onchange=()=>settings({level:$('#thinking-select').value});
labelBtn($('#new-session'),'plus');
labelBtn($('#conversations-toggle'),'chevronDown');
labelBtn($('#check'),'scan','Conferir Xournal++');
labelBtn($('#stop'),'square','Parar');
labelBtn($('#send'),'arrowUp','Enviar');
labelBtn($('#connect'),'plug','Conectar ao Pi');
labelBtn($('#include-refs'),'columns','Referências');
labelBtn($('#attach'),'paperclip','Anexar');
labelBtn($('#quote-btn'),'textQuote','Citar');
labelBtn($('#export-chat'),'download','Exportar');
$('#export-chat').onclick=async()=>{try{const r=await window.desk.exportChat();if(r?.saved)toast('Conversa exportada: '+String(r.file).split(/[/\\]/).at(-1));}catch(e){toast(e.message);}};
/* Caderno de revisão (pedido 5): acesso visível no cabeçalho com a contagem de
   itens — atualiza com a carga da matéria e quando a barra do caderno (núcleo)
   é redesenhada por salvar/remover. */
function updateReviewBadge(){
 const count=Array.isArray(S.reviewItems)?S.reviewItems.length:0;
 const badge=$('#review-count');if(badge)badge.textContent=String(count);
 const button=$('#review-tab');
 if(button){
  button.title=count?`Abrir o caderno de revisão — ${count} ${count===1?'item':'itens'}`:'Abrir o caderno de revisão';
  button.setAttribute('aria-label',button.title);
  button.classList.toggle('has-items',count>0);
 }
}
$('#review-tab').onclick=()=>selectTab('review');
const reviewBar=$('#review-bar');
if(reviewBar)new MutationObserver(updateReviewBadge).observe(reviewBar,{childList:true,subtree:true,characterData:true});
function openHelp(){if($('#help-dialog').open)return;renderHelpVersion(S.deskVersion);$('#help-dialog').showModal();}
/* Sobre: a linha de atualização e o painel "Componentes" são do núcleo
   (`core/dialogsview.bend`); aqui só se liga o updater (IPC do main) e os
   cliques (verificar / Release notes / Atualizar e reiniciar / Atualizar Pi).
   Node e Xournal++ são checados só sob demanda (Verificar agora); a checagem
   automática 1×/dia cobre Mesa + Pi e mantém o aviso no cabeçalho. */
function updateStateOf(result){
 syncUpdateNotice(result);
 if(result?.status==='update')return {$:'UpdateReady',version:String(result.version||''),notes:String(result.notes||'').replace(/\s+/g,' ').trim().slice(0,400),url:String(result.url||'')};
 if(result?.status==='current')return {$:'UpdateNone',current:String(result.current||'')};
 if(result?.status==='error')return {$:'UpdateFailed'};
 return {$:'UpdateIdle'};
}
/* C1: o resultado REAL da última atualização (gravado pelo worker no
   update.json) vira estado do núcleo — é o que o Sobre mostra na reabertura. */
function resultStateOf(result){
 if(!result)return {$:'UpdateIdle'};
 if(result.status==='applied')return {$:'UpdateDone',version:String(result.version||'')};
 if(result.status==='recovered')return {$:'UpdateRecovered',version:String(result.version||''),reason:String(result.reason||'')};
 if(result.status==='incomplete')return {$:'UpdateIncomplete',version:String(result.version||''),reason:String(result.reason||'')};
 return {$:'UpdateIdle'};
}
const aboutHandlers={
 OpenLink:e=>{const url=e.currentTarget?.dataset?.url;if(url)window.desk.openExternal(url).catch(err=>toast(err.message));},
 /* C1: abre o desk.log do runtime (o motivo de um rollback fica lá). */
 OpenLog:async()=>{try{await window.desk.openLog();}catch(err){toast(err.message);}},
 CheckUpdate:async()=>{renderAboutUpdate({$:'UpdateChecking'},aboutHandlers);try{renderAboutUpdate(updateStateOf(await window.desk.updateCheck({manual:true})),aboutHandlers);}catch(e){renderAboutUpdate({$:'UpdateFailed'},aboutHandlers);toast(e.message);}},
 RefreshComponents:()=>refreshAbout(true),
 /* C1: aplicar desliga a ação; na falha o Sobre volta ao resultado real. */
 ApplyUpdate:async()=>{
  renderAboutUpdate({$:'UpdateApplying'},aboutHandlers);
  try{
   const r=await window.desk.updateApply();
   toast(`Atualizando para v${r?.version||''} — a Mesa reabre sozinha.`);
  }catch(e){
   toast(e.message);
   try{renderAboutUpdate(resultStateOf(await window.desk.updateResult()),aboutHandlers);}
   catch{renderAboutUpdate({$:'UpdateIdle'},aboutHandlers);}
  }
 },
 UpdatePi:async()=>{if(!confirm('Atualizar o Pi e reiniciar a Mesa? O app fecha e reabre sozinho.'))return;try{await window.desk.updatePi();toast('Atualizando o Pi — a Mesa reabre sozinha.');}catch(e){toast(e.message);}},
};
/* B4: os componentes não esperam a checagem da Mesa — versões/estados locais
   primeiro (com a checagem de rede deles, que tem prazo), linha do update
   depois. */
async function refreshComponents(manual){
 try{renderComponentRows((await window.desk.components({manual:!!manual}))?.rows||[],aboutHandlers);}
 catch(e){if(manual)toast(e.message);}
}
async function refreshAbout(manual){
 /* Não espera: o painel de componentes pinta por conta própria. */
 refreshComponents(manual);
 try{renderAboutUpdate(updateStateOf(await window.desk.updateCheck({manual:!!manual})),aboutHandlers);}
 catch(e){if(manual)toast(e.message);}
}
async function openAbout(){
 if($('#about-dialog').open)return;
 renderAboutLead(S.deskVersion);
 /* C3: as 4 linhas nascem já com "Verificando…" (Mesa com a versão local); a
    checagem chega em seguida sem abrir vão. */
 renderComponentChecking(S.deskVersion);
 $('#about-dialog').showModal();
 try{renderAboutUpdate(resultStateOf(await window.desk.updateResult()),aboutHandlers);}
 catch{renderAboutUpdate({$:'UpdateIdle'},aboutHandlers);}
 refreshAbout(false);
}
window.desk.onMenuHelp(openHelp);
window.desk.onMenuAbout(openAbout);
function syncUpdateNotice(result){
 const button=$('#update-notice');
 if(result?.status==='current'){button.hidden=true;button.textContent='';return;}
 // Uma falha de rede não apaga uma atualização já confirmada.
 if(result?.status!=='update'||!result.version)return;
 button.textContent=`Atualização disponível · v${result.version}`;
 button.hidden=false;
}
$('#update-notice').onclick=()=>openAbout();
window.desk.onUpdateAvailable?.(data=>syncUpdateNotice({status:'update',version:data?.version}));
/* Bilhete da Conversa: o contexto em si já vai no turno (main.cjs); o aviso
   existe para a resposta não parecer vir do nada. */
window.desk.onHandoff?.(data=>{
 if(!data)return;
 const alvo=data.goal||data.question||'';
 toast(`Bilhete da Conversa${alvo?`: ${alvo}`:''} — vai no próximo envio.`);
});
/* Recusa ou falha do bilhete também aparece. O motivo é código curto montado no
   main (sem o conteúdo do bilhete), então nada privado entra em aviso ou log. */
window.desk.onHandoffProblem?.(data=>{
 if(data?.reason)toast(`Bilhete da Conversa: ${data.reason}`);
});
const DESK_SETTINGS=['endDay','studyContext','calculator','xournal','conferir','refsToggle'];
/* Layout (pedido 9): o módulo é do outro agente (`src/layout-settings.mjs`).
   Import dinâmico: o resto das Configurações funciona mesmo antes do módulo
   existir, e nada do `desk` é sobrescrito sem o ler/editar dele. */
let layoutSettings=null;
const layoutSettingsReady=(async()=>{
 try{
  const module=await import('./layout-settings.mjs');
  module.mountLayoutSettings?.($('#cfg-layout'));
  layoutSettings=module;
  return module;
 }catch{
  const box=$('#cfg-layout');
  if(box)box.textContent='Layout indisponível neste build.';
  return null;
 }
})();
async function fillSettingsForm(cfg){
 $('#cfg-title').value=cfg.desk?.title||'';
 for(const key of DESK_SETTINGS)$('#cfg-desk-'+key).checked=cfg.desk?.[key]!==false;
 $('#cfg-vault').value=cfg.vaultPath||'';
 $('#cfg-pi').value=cfg.piPath||'';
 $('#cfg-claude').value=cfg.claudePath||'';
 $('#cfg-xournal').value=cfg.xournalPath||'';
 $('#theme-mode').value=S.currentTheme;
 // campo do Xournal++ fica sempre à mostra: sem caminho no Windows é para configurar
 /* As linhas de matéria vêm do Bend (`core/dialogsview.bend`); o casco da
    seção (título, lead, "+") continua no `index.html`. */
 const layout=await layoutSettingsReady;
 if(layout?.fillLayoutSettings)layout.fillLayoutSettings(cfg.desk||{});
 renderCourseRows(cfg.courses);
}
function readSettingsForm(){
 const courses=[...$('#cfg-courses').querySelectorAll('.cfg-course')].map(row=>{
  const name=row.querySelector('.cfg-name').value.trim();
  const folder=row.querySelector('.cfg-path').value.trim();
  if(!folder)return null;
  const id=row.dataset.id||name||folder.split(/[/\\]/).filter(Boolean).at(-1);
  return {id,name:name||id,path:folder};
 }).filter(Boolean);
 let desk={...S.appConfig.desk,title:$('#cfg-title').value.trim()};
 /* O layout lê/edita o `desk` antes das flags: as flags não mexem em `panels` e
    o módulo nunca sobrescreve o que ele não edita. */
 if(layoutSettings?.readLayoutSettings)desk=layoutSettings.readLayoutSettings(desk)||desk;
 for(const key of DESK_SETTINGS)desk[key]=$('#cfg-desk-'+key).checked;
 return {vaultPath:$('#cfg-vault').value.trim(),runtimePath:S.appConfig.runtimePath||'',piPath:$('#cfg-pi').value.trim(),claudePath:$('#cfg-claude').value.trim(),xournalPath:$('#cfg-xournal').value.trim(),courses,desk};
}
/* Primeira abertura: a boas-vindas do núcleo; o "Configurar agora" fecha e abre
   as Configurações com o título de primeira vez. */
function openWelcome(){
 if($('#welcome-dialog').open)return;
 renderWelcome(S.appConfig.platform==='win32',{handlers:{WelcomeConfigure:()=>{$('#welcome-dialog').close('ok');openSettings(true);}}});
 $('#welcome-dialog').showModal();
}
async function openSettings(first){
 const info=await window.desk.getConfig();
 S.appConfig={...S.appConfig,...info.config,platform:info.platform};
 renderSettingsHead(first);
 await fillSettingsForm(info.config||{});
 /* Dica do campo Claude: o caminho detectado quando o host manda um; senão o
    placeholder padrão continua. Nada de login/credencial na UI. */
 const claudeField=$('#cfg-claude');
 if(claudeField)claudeField.placeholder=info.detectedClaude||'detectar automaticamente';
 if(!$('#settings-dialog').open)$('#settings-dialog').showModal();
}
$('#cfg-vault-browse').onclick=async()=>{const folder=await window.desk.pickFolder();if(folder)$('#cfg-vault').value=folder;};
$('#cfg-pi-browse').onclick=async()=>{const file=await window.desk.pickFile();if(file)$('#cfg-pi').value=file;};
$('#cfg-pi-detect').onclick=async()=>{const found=await window.desk.detectPi();if(found){$('#cfg-pi').value=found;toast('Pi encontrado.'); }else toast('Pi não encontrado. Rode npm run setup.');};
$('#cfg-xournal-browse').onclick=async()=>{const file=await window.desk.pickFile();if(file)$('#cfg-xournal').value=file;};
$('#cfg-claude-browse').onclick=async()=>{const file=await window.desk.pickFile();if(file)$('#cfg-claude').value=file;};
$('#cfg-add-course').onclick=()=>appendCourseRow();
$('#components-refresh').onclick=()=>refreshAbout(true);
window.desk.onMenuSettings(()=>openSettings(false));
let settingsSaving=false;
async function saveSettings(){
 if(settingsSaving)return;
 settingsSaving=true;
 try{
  const pickedTheme=$('#theme-mode')?.value;
  const data=await window.desk.saveConfig(readSettingsForm());
  $('#settings-dialog').close('ok');
  S.connected=false;
  tabsCourses=data.courses||[];
  await loadCourse(data);
  /* Tema só entra no Salvar (Cancelar/Esc não aplicam nem persistem) e DEPOIS
     do loadCourse: a carga re-aplica o tema do estado salvo e sobrescreveria a
     escolha nova. */
  if(pickedTheme&&pickedTheme!==S.currentTheme){applyTheme(pickedTheme);save(true);}
  connectionState('',`${S.agentLabel} desconectado`);
  renderTabsView();renderMenus();
  /* Sem Pi configurado a Mesa não tenta conectar sozinha; a conversa Claude
     segue a mesma regra com o executável detectado (o host manda o caminho ou
     `''` — sem binário, nada de tentativa nem de toast no save/boot). */
  const ready=data.engine==='claude'?!!data.detectedClaude:!!data.detectedPi;
  if(!data.needsSetup&&ready)connect().catch(()=>{});
 }catch(err){toast(err.message);}
 finally{settingsSaving=false;}
}
/* Enter num campo salva: o `<form method="dialog">` herdado ativava o "×"
   (primeiro submit do form, `value=cancel`) e a edição era descartada. O submit
   é sempre interceptado e só o botão Salvar salva; os botões de cancelar
   fecham explicitamente. Esc segue cancelando pelo comportamento nativo. */
$('#settings-form').addEventListener('keydown',e=>{
 if(e.key!=='Enter')return;
 const field=e.target;
 if(!field?.matches?.('input,select'))return;
 e.preventDefault();
 saveSettings();
});
$('#settings-form').addEventListener('submit',e=>{
 e.preventDefault();
 if(e.submitter?.id==='settings-save'||e.submitter?.value==='ok'){saveSettings();return;}
 $('#settings-dialog').close('cancel');
});
$('#prompt').addEventListener('input',save);
slash.init();
/* Área de apoio + chat lateral: barra sempre visível, eventos do lateral
   assinados uma vez. */
initSupport();
initSidechat();
/* Aba Livre (sessão avulsa): módulo próprio que escuta `desk-workspace`/
   `desk-chrome`; montado antes do `window.desk.init()` do rodapé para pegar o
   primeiro estado sem perder evento. */
initFreeStudy();
/* Fila de mensagens + steer da Mesa (mesma feature da Conversa, sobre o núcleo
   `core/composerview.bend`): ⏎ ocupado enfileira, ⌘/Ctrl+⏎ interrompe e envia. */
queue.init();
/* O `loadCourse` avisa quando o `desk` normalizado entra: abas e menus são
   aplicados antes do carregamento dos PDFs — o chrome inteiro fica pronto no
   mesmo tick (abas parciais deixariam o #course-tabs vazio no meio do boot). */
window.addEventListener('desk-workspace',event=>{
 if(event.detail?.courseId&&event.detail.courseId!==S.currentCourseId)return;
 if(event.detail?.session&&event.detail.session!==S.currentSession)return;
 if(Array.isArray(event.detail?.courses))tabsCourses=event.detail.courses;
 renderTabsView();renderMenus();updateReviewBadge();
});
window.addEventListener('desk-chrome',()=>{renderTabsView();renderMenus();updateReviewBadge();});
try{
 const data=await window.desk.init();
 tabsCourses=data.courses||[];
 await loadCourse(data);
 renderTabsView();renderMenus();updateReviewBadge();
 if(data.needsSetup)openWelcome();
 else if(data.engine==='claude'?!!data.detectedClaude:!!data.detectedPi)connect().catch(()=>{});
}catch(e){toast(e.message);}
