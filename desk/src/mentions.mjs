import {icon} from '../icons.mjs';
import {build,renderChildren,applyIcons} from './view-host.mjs';
import core from './generated/toolmentions.core.js';
import {supportsCapability,toast} from './state.mjs';
import {t,LANGUAGE_EVENT} from './ui-text.mjs';

/* Menções `@` das ferramentas do tutor (#53): digitar `@` no campo abre a lista
   curta do que o motor atual oferece; ↑↓ navegam com wrap, ⏎/Tab escolhem, Esc
   fecha. A escolhida vira um chip acima do campo e segue com a mensagem como
   `mentions: [id]` (o main monta a instrução no idioma do aluno). O catálogo,
   quem aparece, o teto de chips e os textos são do núcleo
   (`core/toolmentions.bend`); aqui ficam o gatilho no campo, o filtro pelo nome
   na língua da tela, o índice ativo, a posição e o foco. Mesma mecânica e mesmas
   classes do menu `/` (`slash.mjs`). */

const GAP=6;
const EDGE=8;
const WIDTH=400;
const TRIGGER=/(^|\s)@([^\s@]*)$/;
const Nil={$:'Nil'};

let field=null,menu=null,list=null,chipBox=null;
let built=false,open=false;
let hits=[],active=-1,frame=0;
let chips=[];

const toList=(items)=>items.reduceRight((tail,head)=>({$:'Con',head,tail}),Nil);
const fromList=(node)=>{const out=[];for(let at=node;at?.$==='Con';at=at.tail)out.push(at.head);return out;};
const fold=(value)=>String(value||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
const offeredTools=()=>fromList(core.offered(supportsCapability('geogebra')));
const toolOf=(id)=>fromList(core.catalog()).find(tool=>tool.id===id);

/** Ids dos chips que o motor atual ainda oferece, na ordem em que entraram. */
export function mentionIds(){
 const offered=new Set(offeredTools().map(tool=>tool.id));
 return chips.filter(id=>offered.has(id));
}

/** Tira os chips enviados (ou todos, sem argumento). */
export function clearMentions(ids){
 chips=ids?chips.filter(id=>!ids.includes(id)):[];
 renderChips();
}

function renderChips(){
 if(!chipBox)return;
 const tools=chips.map(toolOf).filter(Boolean);
 chipBox.hidden=!tools.length;
 renderChildren(chipBox,fromList(core.chipViews(toList(tools))),CHIP_HANDLERS);
 applyIcons(chipBox,icon);
}

function addChip(id){
 const before=chips.length;
 chips=fromList(core.addId(toList(chips),id));
 if(chips.length===before&&!chips.includes(id))toast(t('mention.full',{count:Number(core.maxChips())}));
 renderChips();
}

const CHIP_HANDLERS={
 remove(event){
  const id=String(event.currentTarget?.dataset?.key||'');
  chips=fromList(core.removeId(toList(chips),id));
  renderChips();
  field?.focus();
 },
};

function triggerMatch(){
 if(!field||document.querySelector('dialog[open]'))return null;
 const caret=field.selectionStart??field.value.length;
 const match=TRIGGER.exec(field.value.slice(0,caret));
 if(!match)return null;
 const query=match[2];
 return {query,from:caret-query.length-1,to:caret};
}

function filterTools(query){
 const needle=fold(query);
 return offeredTools().filter(tool=>fold(t(`mention.${tool.id}.name`)).includes(needle)||fold(tool.id).includes(needle));
}

function activeKey(){return hits[active]?.id||'';}

function paint(){
 const items=list.children;
 for(let i=0;i<items.length;i++){
  const on=i===active;
  items[i].classList.toggle('active',on);
  items[i].setAttribute('aria-selected',String(on));
 }
 const el=items[active];
 if(el){el.scrollIntoView({block:'nearest'});field.setAttribute('aria-activedescendant',el.id);}
 else field.removeAttribute('aria-activedescendant');
}

function renderList(){
 renderChildren(list,fromList(core.itemViews(toList(hits),activeKey())),ITEM_HANDLERS);
 applyIcons(list,icon);
}

/* Acima do composer; só cai para baixo quando não cabe em cima. */
function place(){
 if(!field||!menu)return;
 const card=field.closest('#composer')||field;
 const rect=card.getBoundingClientRect();
 const width=Math.min(WIDTH,window.innerWidth-EDGE*2);
 menu.style.width=`${width}px`;
 menu.style.left=`${Math.max(EDGE,Math.min(Math.round(rect.left),window.innerWidth-width-EDGE))}px`;
 const height=menu.offsetHeight;
 const above=rect.top-GAP-height;
 const below=rect.bottom+GAP;
 if(above>=EDGE||below+height>window.innerHeight-EDGE){
  menu.style.top='auto';
  menu.style.bottom=`${Math.round(window.innerHeight-rect.top+GAP)}px`;
 }else{
  menu.style.top=`${Math.round(below)}px`;
  menu.style.bottom='auto';
 }
}

function show(){
 open=true;
 menu.hidden=false;
 field.setAttribute('aria-expanded','true');
 place();
 paint();
}

function hide(){
 if(!open)return;
 open=false;
 menu.hidden=true;
 field.setAttribute('aria-expanded','false');
 field.removeAttribute('aria-activedescendant');
 active=-1;
}

/* Reabre ou fecha conforme o que está antes do cursor; filtro novo volta ao primeiro. */
function sync(){
 if(!built||!field)return;
 const match=triggerMatch();
 if(!match){hide();return;}
 const keep=activeKey();
 hits=filterTools(match.query);
 if(!hits.length){hide();return;}
 const at=keep?hits.findIndex(tool=>tool.id===keep):-1;
 active=at<0?0:at;
 renderList();
 show();
}

function move(delta){
 if(!hits.length)return;
 active=(active+delta+hits.length)%hits.length;
 paint();
}

/* O `@trecho` sai do campo (a ferramenta vira chip, não texto) e o espaço que
   sobrava junto dele também. */
function pick(tool){
 const match=triggerMatch();
 if(!tool||!match)return;
 const before=field.value.slice(0,match.from);
 const rest=field.value.slice(match.to);
 const after=/[ \n]$/.test(before)&&rest.startsWith(' ')?rest.slice(1):rest;
 field.value=before+after;
 field.setSelectionRange(before.length,before.length);
 hide();
 addChip(tool.id);
 field.focus();
 field.dispatchEvent(new Event('input'));
}

const consume=(event)=>{event.preventDefault();event.stopPropagation();};

/* Captura na janela: com o menu aberto o ⏎ não pode chegar ao envio e ↑↓ são do menu. */
function onKeyDown(event){
 if(!open||event.target!==field||event.isComposing)return;
 if(event.key==='Escape'){consume(event);hide();return;}
 if(event.key==='ArrowDown'||event.key==='ArrowUp'){consume(event);move(event.key==='ArrowDown'?1:-1);return;}
 if(event.key==='Tab'||event.key==='Enter'){
  if(event.metaKey||event.ctrlKey||event.altKey||event.shiftKey){hide();return;}
  consume(event);
  pick(hits[active]);
 }
}

const ITEM_HANDLERS={
 hold(event){event.preventDefault();},
 hover(event){
  if(!open)return;
  const at=hits.findIndex(tool=>tool.id===String(event.currentTarget?.dataset?.key||''));
  if(at<0||at===active)return;
  active=at;
  paint();
 },
 pick(event){pick(hits.find(tool=>tool.id===String(event.currentTarget?.dataset?.key||'')));},
};

function reposition(){
 if(!open||frame)return;
 frame=requestAnimationFrame(()=>{frame=0;if(open)place();});
}

export function init(){
 const el=document.querySelector('#prompt');
 if(!el||built||document.querySelector('#mention-menu'))return;
 field=el;
 menu=build(core.menuView(false,Nil,''));
 list=menu.querySelector('#mention-list');
 document.body.append(menu);
 chipBox=document.querySelector('#mention-chips');
 built=true;
 field.addEventListener('input',sync);
 field.addEventListener('click',sync);
 field.addEventListener('focusout',event=>{
  const to=event.relatedTarget;
  if(!open||!to||to===field||menu.contains(to))return;
  hide();
 });
 window.addEventListener('keydown',onKeyDown,true);
 document.addEventListener('pointerdown',event=>{
  if(!open)return;
  const target=event.target instanceof Node?event.target:null;
  if(target&&(menu.contains(target)||field.contains(target)))return;
  hide();
 },true);
 window.addEventListener('resize',reposition);
 window.addEventListener('scroll',reposition,true);
 window.addEventListener(LANGUAGE_EVENT,()=>{renderChips();if(open)sync();});
 if(typeof ResizeObserver!=='undefined')new ResizeObserver(reposition).observe(field.closest('#composer')||field);
 renderChips();
}
