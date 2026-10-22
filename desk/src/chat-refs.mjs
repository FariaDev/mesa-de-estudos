import {S} from './state.mjs';
import refCore from './generated/pdfref.core.js';
import {text as uiText} from './ui-text.mjs';
import {wholeNat} from './bend-nat.mjs';

/* Citação → link (pedido 5): `Limites.pdf, p. 7` — o que o "Citar" escreve e o
   que o Pi costuma repetir — vira um botão que abre a página no leitor. Nome e
   página são decididos no núcleo (`pdfref.bend`); aqui é só o DOM. Nada dentro
   de código, link, fórmula ou quiz: ali é o texto do Pi, não citação.

   O candidato pode ter ESPAÇO ("Lista 2.pdf") e vem com a frase à esquerda
   ("veja o arquivo Lista 2.pdf"): por isso a classe aceita espaço (quebras de
   linha não) e o corte da esquerda é palavra a palavra, sem teto de tentativas
   — o teto é o tamanho do candidato (`maxCandidate` do núcleo). */
const REF_HINT=/[^\s()\[\]{}<>",;:][^()\[\]{}<>",;:\n\r\t]{0,199}?\.pdf/gi;
const NO_REFS='pre,code,a,.codeblock,.katex,.quiz-actions,.quiz-verdict,.quiz-details,.step';
function bendNameList(names){let out={$:'Nil'};for(let i=names.length-1;i>=0;i--)out={$:'Con',head:names[i],tail:out};return out;}
/* O candidato do regex pode trazer palavras coladas à esquerda ("veja o
   Limites.pdf", "e o resumo está no arquivo Lista 2.pdf"): o núcleo só conhece o
   nome inteiro, então o host encurta da esquerda até casar (ou desiste quando
   não há mais espaço). O primeiro casamento é o nome MAIS LONGO — "Lista
   2.pdf" antes de "2.pdf". */
function matchName(candidate,names){
 let probe=candidate;
 for(;;){
  const known=refCore.knownName(probe,names);
  if(known.$==='Some')return {name:known.value,offset:candidate.length-probe.length};
  const cut=probe.indexOf(' ');
  if(cut<0)return null;
  probe=probe.slice(cut+1);
 }
}
export function linkifyRefs(root){
 const names=(S.library||[]).map(p=>String(p.name||'')).filter(Boolean);
 if(!names.length)return;
 const list=bendNameList(names);
 const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
 const nodes=[];
 while(walker.nextNode()){
  const node=walker.currentNode;
  if(!node.nodeValue||!node.nodeValue.includes('.pdf'))continue;
  if(node.parentElement?.closest?.(NO_REFS))continue;
  nodes.push(node);
 }
 for(const node of nodes){
  const text=node.nodeValue;
  const found=[];
  let cursor=0;
  REF_HINT.lastIndex=0;
  let hit;
  while((hit=REF_HINT.exec(text))){
   const candidate=hit[0];
   const named=matchName(candidate,list);
   if(!named)continue;
   const start=hit.index+named.offset;
   if(start<cursor)continue;
   const cue=refCore.cueFrom(text.slice(hit.index+candidate.length));
   if(cue.$!=='Some')continue;
   const page=Number(cue.value.page);
   if(!Number.isFinite(page)||page<1)continue;
   const end=hit.index+candidate.length+Number(cue.value.length);
   found.push({start,end,name:named.name,page});
   cursor=end;
  }
  if(!found.length)continue;
  const frag=document.createDocumentFragment();
  let at=0;
  for(const item of found){
   if(item.start>at)frag.append(text.slice(at,item.start));
   const page=wholeNat(item.page);
   const button=document.createElement('button');
   button.type='button';
   button.className='pdf-ref';
   button.dataset.name=item.name;
   button.dataset.page=String(item.page);
   const entry=(S.library||[]).find(p=>String(p.name||'')===item.name);
   if(entry)button.dataset.path=entry.path;
   button.textContent=refCore.refLabel(item.name,page);
   button.title=uiText(refCore.refTitle(item.name,page));
   button.setAttribute('aria-label',uiText(refCore.refAria(item.name,page)));
   frag.append(button);
   at=item.end;
  }
  if(at<text.length)frag.append(text.slice(at));
  node.replaceWith(frag);
 }
}
