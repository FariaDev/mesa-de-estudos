import {icon} from '../icons.mjs';
import {build, htmlNode, renderChildren} from './view-host.mjs';
import core from './generated/slashview.core.js';

/* Menu de comandos slash do Pi na Mesa (mesma mecânica do app Conversa):
   digitar "/" abre a lista filtrada pelo trecho digitado; ↑↓ navega com wrap,
   ⏎/Tab inserem o comando no campo sem enviar, Esc/clique fora fecham. O foco
   nunca sai do #prompt — a navegação é por índice interno.

   A árvore vem do núcleo compartilhado `core/slashview.bend` (mesmo artefato
   nos dois apps) e é aplicada pelo `view-host.mjs`: casca, linhas, classes,
   `aria-selected`, `key` e o slot do check são decididos lá. Ficam aqui os
   fatos do host: filtro/dobra da lista, índice ativo com wrap, inserção no
   prompt, abertura/fechamento, posição, foco e timers. O SVG do check é asset
   do host (`icons.mjs`), trocado por cima do slot `.slash-check`.

   A lista junta os comandos LOCAIS (que o app implementa: /compact e /conferir
   são interceptados no envio em chat.mjs — o /conferir vira anexo de captura)
   com os que o Pi devolver em get_commands — assim o menu nunca fica vazio
   quando o Pi só lista comandos próprios. */

const GAP=6;               // folga entre o card do composer e o popover
const EDGE=8;              // respiro mínimo das bordas da janela
const WIDTH=400;           // largura preferida do popover (o CSS limita à janela)
const TTL=5*60*1000;       // revalida a lista com folga de 5 min
const TRIGGER=/^\/(\S*)$/; // só abre com "/" inicial e ainda sem espaço
const LOCAL=[
 {name:'compact',description:'Resumir o contexto da conversa',argumentHint:'[instruções]'},
];

const Nil={$:'Nil'};

let field=null,menu=null,list=null;
let built=false,open=false,armed=false;
let commands=null,fetchedAt=0,inflight=null;
let hits=[],active=-1,query='',lastQuery='',frame=0;
/* Valor recém-inserido: enquanto o campo continuar igual a ele, o menu não reabre
   (senão "/compact" ficaria casando o gatilho e o popover nunca sairia da tela). */
let muted='';

function fold(text){
 return (text||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
}

function valid(item){
 return !!item&&!!item.name;
}

/* Lista `Con/Nil` de fatos para o núcleo: o nome do comando é a `key` (a
   identidade da linha e o que o `activeKey` compara). */
function itemFacts(){
 let out=Nil;
 for(let i=hits.length-1;i>=0;i--){
  const item=hits[i];
  out={$:'Con',head:{$:'SlashItem',key:item.name,name:item.name,hint:item.argumentHint,desc:item.description},tail:out};
 }
 return out;
}

function activeKey(){
 const hit=hits[active];
 return hit?hit.name:'';
}

/* Ícones: o Bend entrega o slot (classe + nome) e esta ponte troca pelo SVG
   do host — `.slash-check` recebe o SVG por dentro, como `.mp-check`. */
const ICON_SLOTS=new Set(['slash-check']);

function attrValue(node,name){
 for(let a=node?.attrs;a?.$==='Con';a=a.tail)if(a.head?.name===name)return a.head.value;
 return '';
}

function materializeIcons(node){
 if(!node||node.$!=='ViewEl')return node;
 const cls=attrValue(node,'class').split(/\s+/);
 if(cls.some((name)=>ICON_SLOTS.has(name))&&node.kids?.$==='Con'&&node.kids.head?.$==='ViewText'){
  return {...node,kids:toList([htmlNode(icon(String(node.kids.head.text||'')))])};
 }
 const kids=[];
 for(let xs=node.kids;xs?.$==='Con';xs=xs.tail)kids.push(materializeIcons(xs.head));
 return {...node,kids:toList(kids)};
}

function toList(items,convert=(value)=>value){
 let out=Nil;
 for(let i=items.length-1;i>=0;i--)out={$:'Con',head:convert(items[i]),tail:out};
 return out;
}

function materializeList(nodes){
 const out=[];
 for(let xs=nodes;xs?.$==='Con';xs=xs.tail)out.push(materializeIcons(xs.head));
 return out;
}

/* Busca a lista no Pi (uma requisição por vez) e guarda com carimbo.
   Falhou? Os comandos locais continuam valendo e a próxima abertura tenta de novo. */
function load(){
 if(inflight)return inflight;
 if(typeof window.desk?.commands!=='function'){commands=LOCAL.slice();fetchedAt=Date.now();return Promise.resolve();}
 inflight=(async()=>{
  try{
   const list=await window.desk.commands();
   const fromPi=(Array.isArray(list)?list:[])
    .map(item=>({
     name:String(item?.name||'').replace(/^\/+/,'').trim(),
     description:String(item?.description||''),
     argumentHint:String(item?.argumentHint||''),
    }))
    .filter(valid);
   const seen=new Set(LOCAL.map(item=>item.name));
   commands=[...LOCAL,...fromPi.filter(item=>!seen.has(item.name))].slice(0,120);
   fetchedAt=Date.now();
  }catch{
   if(!commands)commands=LOCAL.slice();
   fetchedAt=0;
  }finally{inflight=null;}
 })();
 const pending=inflight;
 /* Com dados novos, repinta se o menu continua "armado" (campo ainda em "/…"). */
 pending.then(()=>{if(armed&&commands)sync(false);});
 return pending;
}

function ensure(){
 if(inflight)return;
 if(commands&&Date.now()-fetchedAt<=TTL)return;
 load();
}

/* Estado do menu a partir do campo: fora de "/…" fecha; sem lista ainda, espera. */
function sync(revalidate=true){
 if(!built||!field)return;
 if(muted){if(field.value===muted)return;muted='';}
 const match=document.querySelector('dialog[open]')?null:TRIGGER.exec(field.value);
 if(!match){armed=false;hide();return;}
 armed=true;query=match[1];
 if(revalidate)ensure();
 if(!commands){hide();return;}
 render();
 if(!hits.length){hide();return;}
 show();
}

/* Mantém o item ativo quando a mesma busca é repintada (revalidação em segundo plano). */
function render(){
 const keep=query===lastQuery&&hits[active]?hits[active].name:'';
 lastQuery=query;
 const needle=fold(query);
 hits=commands.filter(item=>fold(item.name).includes(needle));
 const at=keep?hits.findIndex(item=>item.name===keep):-1;
 active=hits.length?(at<0?0:at):-1;
 renderChildren(list,materializeList(core.slashItemViews(itemFacts(),activeKey())),ITEM_HANDLERS);
 if(!hits.length){active=-1;return;}
 paint();
}

/* Realce do teclado/hover: alterna classe/ARIA nas linhas vivas, sem recriar o
   nó sob o cursor (a árvore do núcleo já nasce com o realce a cada filtro). */
function paint(){
 const items=list.children;
 for(let i=0;i<items.length;i++){
  const on=i===active;
  items[i].classList.toggle('active',on);
  items[i].setAttribute('aria-selected',String(on));
 }
 const el=items[active];
 if(el){
  el.scrollIntoView({block:'nearest'});
  field.setAttribute('aria-activedescendant',el.id);
 }else field.removeAttribute('aria-activedescendant');
}

/* Acima do composer (o rodapé): só cai para baixo quando não cabe em cima. */
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

function move(delta){
 if(!hits.length)return;
 active=active<0?(delta>0?0:hits.length-1):(active+delta+hits.length)%hits.length;
 paint();
}

/* Insere "/nome" no campo (com espaço final quando o comando aceita argumento);
   o input disparado fecha o menu e deixa o app cuidar de altura/rascunho/envio. */
function insert(item){
 if(!item||!field)return;
 armed=false;
 field.value=`/${item.name}`+(item.argumentHint?' ':'');
 muted=field.value;
 hide();
 field.focus();
 try{field.setSelectionRange(field.value.length,field.value.length);}catch{}
 field.dispatchEvent(new Event('input'));
}

function consume(event){
 event.preventDefault();
 event.stopPropagation();
}

/* Captura na janela: com o menu aberto o ⏎ não pode chegar ao envio (chat.mjs)
   e ↑↓ são do menu. */
function onKeyDown(event){
 if(!open||!field||event.target!==field||event.isComposing)return;
 if(event.key==='Escape'){armed=false;consume(event);hide();return;}
 if(event.key==='ArrowDown'||event.key==='ArrowUp'){
  consume(event);
  move(event.key==='ArrowDown'?1:-1);
  return;
 }
 if(event.key==='Tab'){
  if(event.metaKey||event.ctrlKey||event.altKey)return;
  consume(event);
  insert(hits[active]);
  return;
 }
 if(event.key!=='Enter')return;
 if(event.metaKey||event.ctrlKey||event.altKey){armed=false;hide();return;}
 if(event.shiftKey)return;
 consume(event);
 insert(hits[active]);
}

function reposition(){
 if(!open||frame)return;
 frame=requestAnimationFrame(()=>{frame=0;if(open)place();});
}

/* As linhas: `hold` não deixa o clique tirar o foco do campo; `hover` move o
   ativo; `pick` insere. Tudo por `dataset.key` (o `key` da árvore). */
const ITEM_HANDLERS={
 hold(event){event.preventDefault();},
 hover(event){
  if(!open)return;
  const key=String(event.currentTarget?.dataset?.key||'');
  const at=hits.findIndex(item=>item.name===key);
  if(at<0||at===active)return;
  active=at;
  paint();
 },
 pick(event){
  const key=String(event.currentTarget?.dataset?.key||'');
  insert(hits.find(item=>item.name===key));
 },
};

/* A casca vem do Bend e é montada uma vez; só os filhos do `#slash-list`
   trocam a cada busca/realce (o campo e a posição nunca são recriados). */
function buildMenu(){
 menu=build(core.slashMenuView(false,Nil,''));
 list=menu.querySelector('#slash-list');
 document.body.append(menu);
}

export function init(){
 const el=document.querySelector('#prompt');
 if(!el||built||document.querySelector('#slash-menu'))return;
 field=el;
 buildMenu();
 built=true;
 /* Rótulo do campo: atributos no próprio #prompt (sem wrapper, que mexeria no DOM
    do composer) — aria-haspopup/aria-controls apontam para o listbox e aria-expanded
    acompanha a abertura. */
 field.setAttribute('aria-haspopup','listbox');
 field.setAttribute('aria-controls','slash-list');
 field.setAttribute('aria-expanded','false');
 field.setAttribute('aria-autocomplete','list');
 field.addEventListener('input',()=>sync());
 field.addEventListener('focusout',event=>{
  const to=event.relatedTarget;
  if(!open||!to||to===field||menu.contains(to))return;
  armed=false;
  hide();
 });
 window.addEventListener('keydown',onKeyDown,true);
 document.addEventListener('pointerdown',event=>{
  if(!open)return;
  const target=event.target instanceof Node?event.target:null;
  if(target&&(menu.contains(target)||field.contains(target)))return;
  armed=false;
  hide();
 },true);
 window.addEventListener('resize',reposition);
 window.addEventListener('scroll',reposition,true);
 if(typeof ResizeObserver!=='undefined')new ResizeObserver(reposition).observe(field.closest('#composer')||field);
}
