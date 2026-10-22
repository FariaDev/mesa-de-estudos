import {$} from './state.mjs';
import {menuStep} from './menu-roving.mjs';

/* Menus da barra superior (Matéria, Estudar, Ajustes): abrir um fecha os
   outros, clique fora fecha, a saída anima (#43 fase 2: saiu do main.mjs). */

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
 /* #67: Esc com o foco num item volta o foco ao gatilho (padrão de menu do
    WAI-ARIA); antes o foco ia para o body e o Tab recomeçava do topo. */
 if(blur&&el.querySelector('.nav-pop')?.contains(document.activeElement))trigger?.focus();
 else if(blur&&el.contains(document.activeElement))document.activeElement.blur();
 if(!animate)return;
 const pop=el.querySelector('.nav-pop');
 if(!pop)return;
 el.classList.add('closing');
 const done=()=>el.classList.remove('closing');
 pop.addEventListener('transitionend',done,{once:true});
 setTimeout(done,400);
}
function menuItemsOf(el){
 return [...el.querySelectorAll('.nav-pop button[role=menuitem]')].filter(item=>!item.disabled&&!item.hidden&&item.getClientRects().length);
}
/* Foca o item que a tecla pede; devolve se a tecla navegou. O menu acabou de
   abrir por `display:flex`, então os itens já têm caixa no mesmo quadro. */
function focusMenuItem(el,key){
 const items=menuItemsOf(el);
 const next=menuStep(key,items.indexOf(/** @type {HTMLButtonElement} */(document.activeElement)),items.length);
 if(next===null)return false;
 items[next].focus();
 return true;
}
const NAV_MENUS=['#course-menu','#study-menu','#settings-menu'];
function closeMenus(options){for(const id of NAV_MENUS)setMenuOpen($(id),false,options);}
function toggleMenu(el){
 const open=!el.classList.contains('open');
 /* Um menu por vez: abrir um fecha os outros da barra. */
 if(open)for(const id of NAV_MENUS){const other=$(id);if(other&&other!==el)setMenuOpen(other,false,{animate:false});}
 setMenuOpen(el,open);
}
function wireMenu(el){
 const trigger=el.querySelector('.nav-trigger');
 if(!trigger)return;
 trigger.addEventListener('click',e=>{e.stopPropagation();toggleMenu(el);});
 trigger.addEventListener('keydown',e=>{
  if(e.key==='Enter'||e.key===' '){e.preventDefault();toggleMenu(el);if(el.classList.contains('open'))focusMenuItem(el,'Home');return;}
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();if(!el.classList.contains('open'))toggleMenu(el);focusMenuItem(el,e.key==='ArrowDown'?'Home':'End');}
 });
 el.querySelector('.nav-pop')?.addEventListener('keydown',e=>{
  if(e.key==='Tab'){setMenuOpen(el,false,{animate:false});return;}
  if(focusMenuItem(el,e.key))e.preventDefault();
 });
 /* Escolher um item fecha o menu (o handler do item já rodou: o alvo é o botão). */
 el.querySelector('.nav-pop')?.addEventListener('click',e=>{const item=e.target.closest?.('button[role=menuitem]');if(item&&!item.hasAttribute('aria-pressed'))setMenuOpen(el,false);});
}

/**
 * Liga os gatilhos dos menus da barra e o fechamento por clique fora.
 * @returns {void}
 * @example initNavMenus();
 */
function initNavMenus(){
 for(const id of NAV_MENUS)wireMenu($(id));
 /* As ferramentas de estudo abrem pelo handler do item. Os módulos de domínio
    também ouvem o clique no `document` (`#study-notes-open`, `#study-search-open`
    — o delegado da barra antiga, que parava a propagação): sem isto o clique
    chegaria duas vezes e o de Anotações alternaria o diálogo fechado de volta. */
 $('#study-pop')?.addEventListener('click',e=>e.stopPropagation());
 document.addEventListener('click',e=>{
  const path=typeof e.composedPath==='function'?e.composedPath():[];
  for(const id of NAV_MENUS){
   const el=$(id);
   if(!el)continue;
   /* `composedPath` mantém o alvo original mesmo se um re-render no meio do
      clique (ex.: um item re-renderizado) desanexar o nó de dentro do menu; por isso a
      decisão não pode depender de `el.contains(e.target)` depois do handler. */
   if(path.includes(el))continue;
   setMenuOpen(el,false,{animate:false});
  }
 });
}

export {setMenuOpen,closeMenus,initNavMenus};
