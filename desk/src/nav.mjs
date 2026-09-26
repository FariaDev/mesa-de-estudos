import {$,S,toast} from './state.mjs';
import {icon} from '../icons.mjs';
import {applyIcons,build} from './view-host.mjs';
import {renderBookmark} from './dialogs.mjs';
import pdfnavCore from './generated/pdfnav.core.js';

/* Navegação entre a resposta e o material (pedido 5): a citação que o "Citar"
   escreve (`Limites.pdf, p. 7`) — e qualquer citação parecida que o Pi devolva
   — vira link para a página do leitor. O núcleo `core/pdfref.bend` decide o
   nome e a página; aqui ficam a biblioteca da matéria, o DOM e a pilha de
   Voltar.

   A pilha é POR PAINEL (máx. 20): seguir uma citação guarda onde o leitor
   estava e o botão `.back` da cabeça do leitor desfaz. Trocar o arquivo pelo
   select da cabeça ou de matéria limpa a pilha — voltar para um documento que
   não está mais ali confundiria.

   Aqui também mora o popover "Navegar" da cabeça de cada leitor: os favoritos
   nomeados da matéria (`runtime/bookmarks.json` pelo IPC, a lista inteira em
   `S.bookmarks`) e o sumário do documento (`panel.outline()`). O ESQUELETO e as
   linhas são do núcleo (`core/pdfnav.bend`); este módulo só monta o corpo no
   painel e liga os cliques. */

const MAX_BACK=20;
const stacks=new Map();

function stackOf(panel){
 let stack=stacks.get(panel);
 if(!stack){stack=[];stacks.set(panel,stack);}
 return stack;
}

function backButton(panel){
 return panel?.el?.querySelector?.('.pdf-title button.back')||null;
}

function updateBack(panel){
 const button=backButton(panel);
 if(!button)return;
 const has=stackOf(panel).length>0;
 button.hidden=!has;
}

function entryFor(name,path){
 const library=S.library||[];
 if(path){const byPath=library.find(p=>String(p.path||'')===String(path));if(byPath)return byPath;}
 return library.find(p=>String(p.name||'')===String(name||''))||null;
}

/* Segue uma citação: o painel que já mostra o arquivo (senão o primeiro). */
export function openRef(name,page,path){
 const hit=entryFor(name,path);
 if(!hit){toast(`Não achei ${name||path} na biblioteca desta matéria.`);return false;}
 const panel=S.panels.find(p=>p.path===hit.path)||S.panels[0];
 if(!panel){toast('Nenhum leitor aberto.');return false;}
 const target=Math.max(1,Math.trunc(Number(page)||1));
 if(panel.path&&panel.path!==hit.path){
  const stack=stackOf(panel);
  if(stack.length<MAX_BACK)stack.push({path:panel.path,page:panel.page||1});
  panel.load(hit.path,{page:target});
 }else{
  /* Mesmo arquivo, outra página (o caso comum da citação): guarda a página
     atual antes de pular, senão o Voltar não teria para onde voltar. */
  const here=panel.page||1;
  if(target!==here){
   const stack=stackOf(panel);
   if(stack.length<MAX_BACK)stack.push({path:panel.path,page:here});
  }
  panel.goto(target);
 }
 updateBack(panel);
 return true;
}

export function navBack(panel){
 if(!panel)return;
 const stack=stackOf(panel);
 let last=stack.pop();
 // Entrada de outro curso (a biblioteca mudou): não há mais onde voltar.
 while(last&&!entryFor('',last.path))last=stack.pop();
 if(!last)return;
 if(panel.path===last.path)panel.goto(last.page);
 else panel.load(last.path,{page:last.page});
 updateBack(panel);
}

export function clearNavStacks(){
 stacks.clear();
 for(const panel of S.panels||[])updateBack(panel);
}

/* ---------- popover de navegação (favoritos + sumário) ---------- */

/* Sobe do nó até o painel dono dele (o popover não tem id: cada leitor tem o
   seu). */
function panelOfNode(node){
 const el=node?.closest?.('.pdf-panel');
 return (S.panels||[]).find(p=>p.el===el)||null;
}

function navButtonOf(panel){return panel?.el?.querySelector?.('.pdf-title button.nav')||null;}
function popoverOf(panel){return panel?.el?.querySelector?.('.pdf-nav-pop')||null;}

/* As listas do host viram as listas do núcleo (`Bookmark`/`OutlineEntry`) —
   Nat é BigInt, como em todo artefato. */
function bendBooks(items){
 return (items||[]).reduceRight((tail,item)=>({$:'Con',head:{$:'Bookmark',
  name:String(item?.name||''),
  path:String(item?.path||''),
  page:BigInt(Math.max(1,Math.trunc(Number(item?.page)||1)))},tail}),{$:'Nil'});
}

function bendOutline(items){
 return (items||[]).reduceRight((tail,item)=>({$:'Con',head:{$:'OutlineEntry',
  title:String(item?.title||''),
  page:BigInt(Math.max(1,Math.trunc(Number(item?.page)||1))),
  depth:BigInt(Math.max(0,Math.trunc(Number(item?.depth)||0)))},tail}),{$:'Nil'});
}

async function outlineOf(panel){
 try{if(panel?.outline)return await panel.outline();}catch{}
 return [];
}

/* Remonta o corpo do popover: os favoritos mudam com a matéria e o sumário com
   o documento. O estado aberto/fechado é o do próprio nó (`hidden`). */
async function refreshPopover(panel){
 const pop=popoverOf(panel);
 if(!pop)return;
 const open=!pop.hidden;
 const entries=await outlineOf(panel);
 const node=build(pdfnavCore.navPopover(open,bendBooks(S.bookmarks),bendOutline(entries),String(panel.path||'')),navHandlers);
 applyIcons(node,icon);
 pop.replaceWith(node);
 navButtonOf(panel)?.setAttribute('aria-expanded',String(open));
}

/* O popover nasce fechado na cabeça do leitor (o `panelShell` do núcleo não o
   conhece: o corpo é do host, montado aqui). */
function mountPopover(panel){
 if(!panel?.el||popoverOf(panel))return;
 const node=build(pdfnavCore.navPopover(false,{$:'Nil'},{$:'Nil'},String(panel.path||'')),navHandlers);
 applyIcons(node,icon);
 panel.el.append(node);
}

export async function toggleNav(panel){
 if(!panel?.el)return;
 mountPopover(panel);
 const pop=popoverOf(panel);
 if(!pop)return;
 pop.hidden=!pop.hidden;
 if(pop.hidden){
  navButtonOf(panel)?.setAttribute('aria-expanded','false');
  return;
 }
 await refreshPopover(panel);
}

function closePopovers(){
 for(const panel of S.panels||[]){
  const pop=popoverOf(panel);
  if(!pop||pop.hidden)continue;
  pop.hidden=true;
  navButtonOf(panel)?.setAttribute('aria-expanded','false');
 }
}

/* ---------- favorito nomeado ---------- */

function baseName(path){return String(path||'').split(/[/\\]/).pop()||'';}
function suggestedName(panel){
 const entry=(S.library||[]).find(p=>String(p.path||'')===String(panel?.path||''));
 const label=String(entry?.name||baseName(panel?.path)||'').replace(/\.pdf$/i,'').trim();
 return label||'Favorito';
}

/* O favorito nasce do leitor que pediu (o botão Navegar do painel dele): com
   dois PDFs abertos, guarda a página do painel CERTO, não a do primeiro. */
function openBookmarkDialog(panel){
 if(!panel?.path){toast('Abra um PDF para guardar a página.');return;}
 const dialog=$('#bookmark-dialog');
 if(!dialog)return;
 const name=suggestedName(panel);
 renderBookmark(name,pdfnavCore.bookmarkDialogHint(name,BigInt(Math.max(1,Math.trunc(Number(panel.page)||1)))));
 dialog._panel=panel;
 dialog.showModal();
}

async function saveBookmark(payload){
 try{
  const saved=await window.desk.bookmarksSave({...payload,courseId:S.currentCourseId});
  S.bookmarks=Array.isArray(saved)?saved:[];
  for(const panel of S.panels||[])await refreshPopover(panel);
  if(payload.mode==='add')toast('Favorito guardado.');
 }catch(err){toast(err.message);}
}

/* O diálogo do favorito é um `<dialog>` do index.html; o miolo vem do núcleo
   (`core/dialogsview.bend`) e o salvar é do host, como no Encerrar. */
$('#bookmark-dialog')?.addEventListener('close',event=>{
 const dialog=event.currentTarget;
 if(dialog.returnValue!=='ok')return;
 const panel=dialog._panel;
 if(!panel?.path)return;
 saveBookmark({mode:'add',item:{name:dialog.querySelector('#bookmark-name')?.value||'',path:panel.path,page:panel.page||1}});
});

const navHandlers={
 SaveBookmark:event=>openBookmarkDialog(panelOfNode(event.currentTarget)),
 OpenBookmark:event=>{const button=event.currentTarget;closePopovers();openRef('',Number(button.dataset.page)||1,button.dataset.path||'');},
 /* O `data-id` da linha dá a POSIÇÃO na lista da tela; o registro removido é
    que vai pela IPC (a lista é filtrada, então a posição não identifica nada no
    arquivo). */
 RemoveBookmark:event=>{
  const button=event.currentTarget;
  const item=(S.bookmarks||[])[Number(button.dataset.id)];
  if(item)saveBookmark({mode:'remove',item});
 },
 OpenOutline:event=>{const button=event.currentTarget;const panel=panelOfNode(button);closePopovers();if(panel)openRef('',Number(button.dataset.page)||1,panel.path||'');}
};

/* Clique na citação: o handler é delegado no documento — o link nasce dentro
   de uma mensagem que pode ser re-renderizada a qualquer momento. */
document.addEventListener('click',event=>{
 const ref=event.target?.closest?.('button.pdf-ref');
 if(!ref)return;
 event.preventDefault();
 openRef(ref.dataset.name||'',Number(ref.dataset.page)||1,ref.dataset.path||'');
});

/* Trocar o arquivo pelo select da cabeça do leitor invalida a pilha daquele
   leitor (o curso novo carrega os arquivos dele pelo mesmo select). */
document.addEventListener('click',event=>{
 const target=event.target;
 if(target?.closest?.('.pdf-nav-pop')||target?.closest?.('.pdf-title button.nav'))return;
 /* Clique dentro de um diálogo modal (o do favorito, que nasce do popover)
    não é clique "fora": o popover de onde ele veio continua aberto. */
 if(target?.closest?.('dialog'))return;
 closePopovers();
});

document.addEventListener('keydown',event=>{
 if(event.key==='Escape')closePopovers();
});

document.addEventListener('change',event=>{
 if(event.target?.classList?.contains('pdf-select'))clearNavStacks();
},true);
