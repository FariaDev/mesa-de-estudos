import {icon} from '../icons.mjs';
import {$,S,markCourseTab,switchCourse} from './state.mjs';
import {activateGeogebra,deactivateGeogebra} from './ggb.mjs';
import {activateReview,deactivateReview} from './review.mjs';
import tabsCore from './generated/tabsview.core.js';
import {renderChildren} from './view-host.mjs';
import {t} from './ui-text.mjs';
import {renderTutorMenus} from './tutor-header.mjs';

/* Abas de matéria e menus Estudar/Ajustes (#43 fase 2: saiu do main.mjs). As
   ações dos itens moram no main e entram por `initHeaderTabs`. */
const headerActions={openSettings:()=>{},syncPaletteField:()=>{}};

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
 return {$:'MenuFacts',twoPanels:panels.length>1,toggle:String(panels[1]?.toggle||''),refVisible:!!S.refVisible,xournal:desk.xournal!==false,win32:S.appConfig.platform==='win32',hasXournalPath:!!S.appConfig.xournalPath};
}
const tabsHandlers={SelectCourse:e=>selectTab(e.currentTarget.dataset.id),OpenGeoGebra:()=>selectTab('geogebra'),OpenReview:()=>selectTab('review'),NewCourse:()=>headerActions.openSettings()};
/* As ferramentas de estudo (Buscar estudos, Anotações…) entram aqui quando os
   módulos de domínio montam (`studyToolHandlers`, mais abaixo). */
/* Preenchido pelo main em `initHeaderTabs` (as ações moram lá). */
const menuHandlers={};
/* Andaime `data-icon`: o núcleo diz o nome do ícone; o SVG é deste arquivo. */
function iconize(root){
 for(const el of root.querySelectorAll('[data-icon]')){
  /* A tecla do item (`.menu-kbd`, #27 B8) é irmã do rótulo: sai antes de o texto virar <span> e volta depois. */
  const keys=[...el.querySelectorAll(':scope>.menu-kbd')];
  for(const key of keys)key.remove();
  const name=el.dataset.icon,tight=el.hasAttribute('data-icon-tight'),label=el.textContent;
  el.removeAttribute('data-icon');el.removeAttribute('data-icon-tight');
  el.innerHTML=icon(name)+(label?(tight?'':' ')+`<span>${label}</span>`:'');
  el.append(...keys);
 }
}
/* O Caderno mostra a contagem de revisar hoje; o `activeId` "review" o marca
   como aba aberta (nenhuma matéria fica ativa). */
let renderedReviewCount=-1;
function reviewCount(){return Array.isArray(S.reviewItems)?S.reviewItems.length:0;}
function activeTabId(){return S.reviewActive?'review':(S.currentCourseId||'');}
/* Abas travadas (resposta, ligação, troca): o fato vem do `setTabsDisabled`
   do estado; antes do primeiro, o que o estado já diz. */
function tabsLocked(){return typeof S.tabsLocked==='boolean'?S.tabsLocked:!!(S.busy||S.connecting||S.switching);}
function renderTabsView(){
 const box=$('#course-tabs');if(!box)return;
 const busy=tabsLocked();
 renderedReviewCount=reviewCount();
 /* A trava re-renderiza as abas (#42): a aba que tinha o foco (setas do
    tablist) continua com ele, se ainda puder recebê-lo. */
 const focused=box.contains(document.activeElement)?document.activeElement?.dataset?.id||'':'';
 renderChildren(box,tabsCore.courseTabsAt(toCoreCourses(tabsCourses),activeTabId(),String(S.currentCourseId||''),!!S.ggbActive,busy,String(renderedReviewCount)),tabsHandlers);
 iconize(box);
 if(focused){const again=box.querySelector(`button[data-id="${CSS.escape(focused)}"]`);if(again&&!again.disabled&&document.activeElement!==again)again.focus();}
 renderCourseMenu();
 fitTabs();
}
/* Janela estreita: o seletor único (`#course-menu`) lista as matérias e a
   barra mostra só ele, o "+", o Caderno e o GeoGebra. O `tabs-compact` do
   header liga em janela estreita ou quando as abas de matéria não cabem na
   linha; é medido na janela e re-medido a cada mudança de tamanho ou de
   conteúdo. */
function renderCourseMenu(){
 const pop=$('#course-pop'),label=$('#course-menu-label');
 if(!pop)return;
 renderChildren(pop,tabsCore.courseMenuItemsAt(toCoreCourses(tabsCourses),activeTabId(),String(S.currentCourseId||''),!!S.ggbActive,tabsLocked()),tabsHandlers);
 iconize(pop);
 const current=tabsCourses.find(c=>c?.id===S.currentCourseId);
 const courseName=String(current?.name||current?.id||t('tabs.course'));
 if(label&&label.textContent!==courseName){
  label.textContent=courseName;
  const trigger=label.parentElement;
  if(trigger&&!trigger.querySelector('.icon'))trigger.insertAdjacentHTML('beforeend',icon('chevronDown'));
 }
}
const TABS_COMPACT_MAX=1100;
function fitTabs(){
 const header=document.querySelector('header'),tabs=$('#course-tabs'),nav=header?.querySelector('.header-nav');
 if(!header||!tabs||!nav)return;
 header.classList.remove('tabs-compact');
 /* Janela estreita (≤1100px) usa o seletor sempre; mais larga, só quando as
    matérias não cabem na linha. */
 const overflow=window.innerWidth<=TABS_COMPACT_MAX||tabs.scrollWidth>tabs.clientWidth+1||header.scrollWidth>header.clientWidth+1;
 if(overflow)header.classList.add('tabs-compact');
}
function renderMenus(){
 const facts=menuFactsOf(),study=$('#study-pop'),settings=$('#settings-pop');
 if(study){
  renderChildren(study,tabsCore.studyItems(facts),menuHandlers);iconize(study);
  /* A tecla da busca de estudos (study-search.mjs: Ctrl/Cmd+Shift+F) escrita para a plataforma. */
  for(const kbd of study.querySelectorAll('.menu-kbd[data-shortcut="study-search"]'))kbd.textContent=navigator.userAgent.includes('Mac')?'⌘⇧F':'Ctrl+Shift+F';
 }
 if(settings){renderChildren(settings,tabsCore.settingsItems(),menuHandlers);iconize(settings);}
 renderTutorMenus();
 headerActions.syncPaletteField();
}
function selectTab(id){
 if(!id)return;
 /* O caderno e o applet não dividem a área de estudo: abrir um fecha o outro. */
 if(id==='review'){if(!S.reviewActive){deactivateGeogebra();activateReview();}return;}
 if(id==='geogebra'){if(!S.ggbActive){deactivateReview();activateGeogebra();}return;}
 if(S.ggbActive&&id===S.currentCourseId){deactivateGeogebra();markCourseTab(id);return;}
 if(S.reviewActive&&id===S.currentCourseId){deactivateReview();markCourseTab(id);return;}
 /* A matéria atual já aberta: nada a trocar (durante a resposta ela fica
    clicável para voltar do Caderno/GeoGebra; aqui não pode virar recusa). */
 if(id===S.currentCourseId&&!S.ggbActive&&!S.reviewActive)return;
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
/* Abas que valem para ⌘⌥←/→ e ⌘1–9: as matérias e o GeoGebra, as que estão à
   vista (o Caderno tem o próprio atalho; o "+" e o seletor não são abas). */
function numberedTabs(){
 return [...document.querySelectorAll('#course-tabs button[role="tab"]:not(#review-tab)')].filter(t=>t.getClientRects().length);
}
function cycleToTab(dir){
 const tabs=numberedTabs();
 if(tabs.length<2)return;
 const i=tabs.findIndex(t=>t.classList.contains('active'));
 selectTab(tabs[((i<0?0:i)+dir+tabs.length)%tabs.length].dataset.id);
}

/** Matérias que as abas mostram (o main as troca quando a lista muda). */
function getTabsCourses(){return tabsCourses;}
/** @param {Array<{id:string,name:string}>} courses */
function setTabsCourses(courses){tabsCourses=courses;}
/* O Caderno é aba da árvore (`core/tabsview.bend`): re-renderiza só quando a
   contagem mudou, para não recriar os botões a cada mutação do caderno. */
function refreshTabsOnReviewCount(){if(reviewCount()!==renderedReviewCount)renderTabsView();}

/**
 * Recebe as ações do main e liga a medição das abas (resize e troca de conteúdo).
 * @param {{openSettings:Function, syncPaletteField:Function, menu:Record<string,Function>}} actions
 * @returns {void}
 * @example initHeaderTabs({openSettings,syncPaletteField,menu:{OpenHelp:openHelp}});
 */
function initHeaderTabs({openSettings,syncPaletteField,menu}){
 headerActions.openSettings=openSettings;
 headerActions.syncPaletteField=syncPaletteField;
 Object.assign(menuHandlers,menu);
 window.addEventListener('resize',fitTabs);
 {const header=document.querySelector('header');if(header&&typeof ResizeObserver==='function')new ResizeObserver(()=>fitTabs()).observe(header);}
 window.addEventListener('desk-tab-marked',()=>renderCourseMenu());
 window.addEventListener('desk-tabs-lock',()=>renderTabsView());
}

export {menuHandlers,renderTabsView,renderMenus,selectTab,moveTabFocus,numberedTabs,cycleToTab,getTabsCourses,setTabsCourses,refreshTabsOnReviewCount,initHeaderTabs};
