import {$,S,save} from './state.mjs';
import {t} from './ui-text.mjs';
import {addAttachments} from './chat-attachments.mjs';
import {cropRect,formulaLike} from './pdf-quote.mjs';

/* Citar seleção (mensagens ou PDF) e inserir texto no rascunho principal
   (extraído de chat.mjs, #29). O botão #quote-btn e o rascunho são do host; o
   chat só precisa saber se há seleção dentro de #messages. */
function texSource(el){return el?.getAttribute?.('data-tex')||el?.querySelector?.('[data-tex]')?.getAttribute('data-tex')||'';}
const QUOTE_BLOCKS=new Set(['P','DIV','LI','UL','OL','H1','H2','H3','H4','H5','H6','PRE','BLOCKQUOTE','FIGURE','TABLE','TR','SECTION','ARTICLE','DETAILS','SUMMARY']);
function selectionText(node){
 if(node.nodeType===3)return node.nodeValue;
 if(node.nodeType!==1&&node.nodeType!==11)return '';
 let text='';
 for(const child of node.childNodes)text+=selectionText(child);
 if(node.nodeType===11)return text;
 const tag=node.tagName;
 if(tag==='BR')return '\n';
 if(tag==='SCRIPT'||tag==='STYLE'||tag==='BUTTON')return '';
 if(QUOTE_BLOCKS.has(tag))text='\n'+text+'\n';
 return text;
}
export function selectionInsideMessages(){
 const selection=window.getSelection();
 if(!selection||selection.isCollapsed||!selection.rangeCount)return false;
 const node=selection.anchorNode;
 const el=node?.nodeType===1?node:node?.parentElement;
 return !!el?.closest?.('#messages');
}
function selectionInPdf(selection){
 if(!selection||selection.isCollapsed||!selection.rangeCount)return null;
 const node=selection.getRangeAt(0).commonAncestorContainer;
 const el=node?.nodeType===1?node:node?.parentElement;
 const layer=el?.closest?.('.textLayer');
 const panel=S.panels.find(p=>p.el===layer?.closest('.pdf-panel'));
 if(!panel||!panel.path)return null;
 const pageEl=layer.closest('.pdf-page');
 const page=Number(pageEl?.dataset.page)||panel.page;
 return {panel,page,pageEl};
}
function enclosingTex(range){
 const wrapper=node=>{
  const el=node?.nodeType===1?node:node?.parentElement;
  return el?.closest?.('.katex-display')||el?.closest?.('.katex')||null;
 };
 const start=wrapper(range.startContainer),end=wrapper(range.endContainer);
 return start&&start===end?texSource(start):'';
}
/* Seleção de fórmula no PDF (#70): o texto sai em retalhos, então a citação
   leva o recorte da página como imagem e só a origem no rascunho. */
function formulaQuote(selection,pdf,file){
 const canvas=pdf.pageEl?.querySelector(':scope > canvas');
 if(!canvas)return null;
 const box=canvas.getBoundingClientRect();
 const crop=cropRect(selection.getRangeAt(0).getBoundingClientRect(),box,canvas.width/box.width);
 if(!crop)return null;
 return {text:t('quote.formula',{file,page:pdf.page}),crop:{canvas,rect:crop,name:`${file.replace(/\.pdf$/i,'')} p${pdf.page}.png`}};
}
function pdfQuote(selection,pdf){
 const file=pdf.panel.path.split(/[/\\]/).at(-1);
 let text=selection.toString().replace(/\r/g,'').replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
 if(!text)return null;
 if(formulaLike(text)){const formula=formulaQuote(selection,pdf,file);if(formula)return formula;}
 if(text.length>8000)text=text.slice(0,8000).trimEnd()+'…';
 return {text:text+`\n\n(${file}, p. ${pdf.page})`};
}
/* O recorte sai do canvas já desenhado (sem render novo): é o que o aluno vê. */
async function attachCrop({canvas,rect,name}){
 const out=document.createElement('canvas');
 out.width=rect.width;out.height=rect.height;
 out.getContext('2d').drawImage(canvas,rect.x,rect.y,rect.width,rect.height,0,0,rect.width,rect.height);
 const blob=await new Promise(resolve=>out.toBlob(resolve,'image/png'));
 if(blob)await addAttachments([new File([blob],name,{type:'image/png'})]);
}
/** A citação da seleção: `{text}` no chat; no PDF, `crop` quando é fórmula. */
function selectionQuoteOf(selection){
 if(!selection||selection.isCollapsed||!selection.rangeCount)return null;
 const pdf=selectionInPdf(selection);
 if(pdf)return pdfQuote(selection,pdf);
 const text=messageQuote(selection);
 return text?{text}:null;
}
function selectionQuote(){return selectionQuoteOf(window.getSelection())?.text||'';}
function messageQuote(selection){
 const range=selection.getRangeAt(0);
 const host=range.commonAncestorContainer.nodeType===1?range.commonAncestorContainer:range.commonAncestorContainer.parentElement;
 if(!host?.closest?.('#messages'))return '';
 const onlyTex=enclosingTex(range);
 if(onlyTex)return onlyTex;
 const fragment=range.cloneContents();
 for(const noise of [...(fragment.querySelectorAll?.('.role,.quiz-actions,.quiz-verdict,.quiz-note,.quiz-mark,.quiz-details')||[])])noise.remove();
 for(const display of [...(fragment.querySelectorAll?.('.katex-display')||[])]){const tex=texSource(display);if(tex)display.replaceWith(document.createTextNode(`\n${tex}\n`));}
 for(const katex of [...(fragment.querySelectorAll?.('.katex')||[])]){if(katex.closest('.katex-display'))continue;const tex=texSource(katex);if(tex)katex.replaceWith(document.createTextNode(tex));}
 let text=selectionText(fragment).replace(/\r/g,'').replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
 if(!text)return '';
 if(text.length>8000)text=text.slice(0,8000).trimEnd()+'…';
 return text;
}
export function hideQuoteButton(){$('#quote-btn').hidden=true;}
let quotePending=null,quoteTimer;
function updateQuoteButton(){
 clearTimeout(quoteTimer);
 quoteTimer=setTimeout(()=>{
  const text=selectionQuote();
  if(!text){hideQuoteButton();return;}
  const rect=window.getSelection().getRangeAt(0).getBoundingClientRect();
  if(!rect||(!rect.width&&!rect.height)||rect.bottom<0||rect.top>innerHeight){hideQuoteButton();return;}
  const button=$('#quote-btn');
  button.hidden=false;
  button.style.left=Math.round(Math.max(8,Math.min(rect.right-24,innerWidth-70)))+'px';
  button.style.top=Math.round(Math.min(rect.bottom+8,innerHeight-40))+'px';
 },120);
}
function insertQuote(){
 const quote=quotePending||selectionQuoteOf(window.getSelection());
 quotePending=null;
 if(!quote)return;
 const {text,crop}=quote;
 if(crop)attachCrop(crop);
 const prompt=$('#prompt');
 const sep=!prompt.value?'':(prompt.value.endsWith('\n\n')?'':(prompt.value.endsWith('\n')?'\n':'\n\n'));
 prompt.value=prompt.value+sep+text.split('\n').map(line=>line?`> ${line}`:'>').join('\n')+'\n\n';
 prompt.focus();
 prompt.setSelectionRange(prompt.value.length,prompt.value.length);
 save();hideQuoteButton();window.getSelection()?.removeAllRanges();
}
/* Chat lateral → principal: insere o texto no rascunho SEM enviar e SEM tocar no
   que já estava digitado (append previsível — separador só quando já há texto).
   O envio continua sendo decisão do usuário; nenhum prompt sai daqui. */
export function insertMainDraft(text){
 const prompt=$('#prompt');
 const body=String(text||'').trim();
 if(!prompt||!body)return false;
 const base=prompt.value;
 const sep=!base?'':(base.endsWith('\n\n')?'':(base.endsWith('\n')?'\n':'\n\n'));
 prompt.value=`${base}${sep}${body}\n\n`;
 prompt.focus();
 prompt.setSelectionRange(prompt.value.length,prompt.value.length);
 save();
 return true;
}
/* Os listeners entram na mesma posição em que o chat sempre os registrou. */
export function installQuoteListeners(){
 document.addEventListener('selectionchange',updateQuoteButton);
 $('#messages').addEventListener('scroll',hideQuoteButton,{passive:true});
 /* No modo rolagem quem rola é o #chat (o #messages cresce com o conteúdo):
    o botão de citar some do mesmo jeito quando a conversa anda. */
 $('#chat')?.addEventListener('scroll',hideQuoteButton,{passive:true});
 $('#quote-btn').addEventListener('mousedown',e=>{e.preventDefault();quotePending=selectionQuoteOf(window.getSelection());});
 $('#quote-btn').addEventListener('mouseleave',()=>{quotePending=null;});
 $('#quote-btn').addEventListener('click',()=>insertQuote());
}
