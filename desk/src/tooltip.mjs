import {build} from './view-host.mjs';
import aux from './generated/auxview.core.js';

/* Tooltips instantâneos: no hover/foco, o title nativo (lento e sem estilo) vira um balão do app.
   Delegação global — nenhum markup muda; o title vai para dataset.tip enquanto o alvo está em uso
   e volta ao sair (se ninguém tiver reescrito nesse meio-tempo). O balão próprio do medidor
   (#ctx-tip, vida própria em state.mjs) fica fora da delegação para os dois não brigarem.

   O balão é a árvore do `core/auxview.bend` (`tooltipView`: `.tip[.below][hidden]` + texto);
   medir/posicionar, os tempos, a delegação e a troca `title` → `dataset.tip` continuam aqui. */

const SKIP='[data-no-tip], #ctx-tip'; // elementos com balão próprio (não entram na delegação)

const DELAY=150; // espera antes de mostrar (troca de alvo já visível é na hora)
const GAP=8;     // distância entre o alvo e o balão
const EDGE=8;    // respiro mínimo das bordas da janela
const FLIP=64;   // alvo colado no topo: o balão abre para baixo
const ARROW=10;  // recuo mínimo da setinha

let box=null;     // .tip criado sob demanda
let target=null;  // alvo atual (title guardado em dataset.tip)
let timer=0;      // agendamento da exibição
let visible=false;
let frame=0;
let started=false;
let pressed=false;

/* Aplica a árvore do Bend no balão vivo sem trocar a identidade: os estilos
   inline de posição (left/top/bottom/--tip-arrow) são do host e sobrevivem. */
function applyAttrs(el,view){
 const wanted=new Map();
 for(let a=view.attrs;a&&a.$==='Con';a=a.tail)wanted.set(String(a.head.name),String(a.head.value??''));
 for(const attr of [...el.attributes])if(attr.name!=='style'&&!wanted.has(attr.name))el.removeAttribute(attr.name);
 for(const [name,value] of wanted)if(el.getAttribute(name)!==value)el.setAttribute(name,value);
}

function paint(open,text,below){
 const view=aux.tooltipView(!!open,String(text||''),!!below);
 if(!box)box=build(view);
 applyAttrs(box,view);
 const kid=view.kids&&view.kids.$==='Con'?view.kids.head:null;
 const shown=kid&&kid.$==='ViewText'?String(kid.text??''):'';
 if(box.textContent!==shown)box.textContent=shown;
}

/* Innermost com title/data-tip de verdade. Title vazio no filho não “engole” o pai;
   data-tip conta porque o title sai do DOM enquanto o balão está armado. */
function targetOf(node){
 if(!(node instanceof Element))return null;
 if(node.closest(SKIP))return null;
 let el=node;
 while(el){
  if(el.matches(SKIP))return null;
  const text=(el.getAttribute?.('title')||el.dataset?.tip||'').trim();
  if(text)return el;
  el=el.parentElement;
 }
 return null;
}

/* Dentro de um dialog (top layer) o balão vai para o próprio dialog: z-index sozinho não vence a top layer. */
function host(){
 const dialogs=document.querySelectorAll('dialog[open]');
 return dialogs.length?dialogs[dialogs.length-1]:document.body;
}

function place(){
 if(!target||!target.isConnected){reset();return;}
 const rect=target.getBoundingClientRect();
 const off=rect.bottom<=0||rect.top>=window.innerHeight||rect.right<=0||rect.left>=window.innerWidth;
 if(off||(!rect.width&&!rect.height)){
  if(box)paint(false,target?.dataset.tip||'',rect.top<FLIP);
  return;
 }
 const below=rect.top<FLIP;
 paint(true,target.dataset.tip||'',below);
 const width=box.offsetWidth;
 const center=rect.left+rect.width/2;
 const left=Math.max(EDGE,Math.min(Math.round(center-width/2),window.innerWidth-width-EDGE));
 box.style.left=`${left}px`;
 box.style.top=below?`${Math.round(rect.bottom+GAP)}px`:'auto';
 box.style.bottom=below?'auto':`${Math.round(window.innerHeight-rect.top+GAP)}px`;
 const arrow=Math.round(center-left);
 box.style.setProperty('--tip-arrow',`${Math.max(ARROW,Math.min(arrow,width-ARROW))}px`);
}

function show(){
 timer=0;
 if(pressed)return;
 if(!target||!target.isConnected){reset();return;}
 if(!box){
  box=build(aux.tooltipView(false,'',false));
  box.style.position='fixed';
  box.style.zIndex='200';
  box.style.pointerEvents='none';
  document.body.append(box);
 }
 const parent=host();
 if(box.parentElement!==parent)parent.append(box);
 visible=true;
 place();
}

/* Esconde o balão, mas segura o title no alvo: o ponteiro pode continuar em cima (clique, Esc, blur). */
function hide(){
 clearTimeout(timer);timer=0;
 visible=false;
 if(box)paint(false,target?.dataset.tip||'',box.classList.contains('below'));
}

function restoreTitle(el){
 if(!el)return;
 if(el.isConnected&&!el.hasAttribute('title'))el.setAttribute('title',el.dataset.tip||'');
 delete el.dataset.tip;
}

/* Sai do alvo de vez: esconde e devolve o title (sem sobrescrever um title novo de outro módulo). */
function reset(){
 hide();
 const el=target;
 target=null;
 restoreTitle(el);
}

function arm(el,instant){
 clearTimeout(timer);
 target=el;
 if(!el.dataset.tip)el.dataset.tip=el.getAttribute('title')||el.dataset.tip||'';
 el.removeAttribute('title');
 if(instant)show();
 else timer=setTimeout(show,DELAY);
}

function switchTo(el){
 if(el===target)return;
 const keep=visible;
 const prev=target;
 target=null;
 restoreTitle(prev);
 if(!el){hide();return;}
 arm(el,keep);
}

function onEnter(e){
 if(pressed)return;
 const node=e.target;
 if(!(node instanceof Element))return;
 const el=targetOf(node);
 if(el===target)return;
 switchTo(el);
}

function onLeave(e){
 if(!target)return;
 const to=e.relatedTarget;
 if(to instanceof Element){
  const next=targetOf(to);
  if(next===target)return;
  if(next){switchTo(next);return;}
 }
 if(to instanceof Node&&target.contains(to))return;
 reset();
}

function reposition(){
 if(frame)return;
 frame=requestAnimationFrame(()=>{frame=0;if(visible||(box&&!box.hidden))place();});
}

function onKey(e){
 if(e.key==='Escape')hide();
}

function onPress(e){
 if(e.button!=null&&e.button!==0)return;
 pressed=true;
 hide();
}

function onRelease(){
 pressed=false;
}

export function init(){
 if(started)return;
 started=true;
 document.addEventListener('pointerover',onEnter);
 document.addEventListener('pointerout',onLeave);
 document.addEventListener('focusin',onEnter);
 document.addEventListener('focusout',onLeave);
 document.addEventListener('pointerdown',onPress,true);
 document.addEventListener('mousedown',hide);
 document.addEventListener('click',hide);
 document.addEventListener('keydown',onKey);
 window.addEventListener('pointerup',onRelease,true);
 window.addEventListener('pointercancel',onRelease,true);
 window.addEventListener('blur',reset);
 window.addEventListener('scroll',reposition,{passive:true,capture:true});
 window.addEventListener('resize',reposition,{passive:true});
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
