import {bindPointerDrag} from './pointer-drag.mjs';
import * as pdfjs from '../node_modules/pdfjs-dist/build/pdf.mjs';
import {icon} from '../icons.mjs';
import {$,S,toast,save,updateContextSummary,updateWindowTitle,layoutSnapshot,loadCourse} from './state.mjs';
import {addAttachments,hideQuoteButton,MAX_ATTACH,MAX_ATTACH_BYTES} from './chat.mjs';
import findCore from './generated/find.core.js';
import pdfView from './generated/pdfview.core.js';
import pdfPage from './generated/pdfpageview.core.js';
import readerSheet from './generated/readersheet.core.js';
import {applyIcons,build,renderInto,renderChildren} from './view-host.mjs';
import {navBack,toggleNav} from './nav.mjs';
import {offsetFacts,offsetFromRecord,labelsList,readDocLabels} from './pdf-labels.mjs';
import {bindPdfDrop,isPdfFile} from './pdf-drop.mjs';
import {text as uiText} from './ui-text.mjs';
import {message as uiMessage} from './i18n.mjs';
import {roundNat, toNat} from './bend-nat.mjs';
pdfjs.GlobalWorkerOptions.workerSrc=new URL('../node_modules/pdfjs-dist/build/pdf.worker.mjs',import.meta.url).href;
// Dobra de acento que preserva o comprimento da string (índices continuam válidos
// para o destaque): minúsculas + acentos pt-BR → letra base.
const FOLD_MAP={á:'a',à:'a',â:'a',ã:'a',ä:'a',å:'a',é:'e',è:'e',ê:'e',ë:'e',í:'i',ì:'i',î:'i',ï:'i',ó:'o',ò:'o',ô:'o',õ:'o',ö:'o',ú:'u',ù:'u',û:'u',ü:'u',ç:'c',ñ:'n',ý:'y',ÿ:'y'};
export function foldSearch(text){return String(text??'').toLowerCase().replace(/[áàâãäåéèêëíìîïóòôõöúùûüçñýÿ]/g,ch=>FOLD_MAP[ch]||ch);}
// Páginas com ocorrências no formato do artefato Bend (`PageHits{page,count}`; Nat = BigInt).
const hitsList=hits=>hits.reduceRight((tail,{page,count})=>({$:'Con',head:{page:toNat(page),count:toNat(count)},tail}),{$:'Nil'});
function findFacts(term,pages,total,page){
 if(!term||!total)return{hidden:true,shown:false,index:0,total:0};
 const out=findCore.findCount(hitsList(pages),toNat(page));
 const hidden=out.$==='Hidden',shown=out.$==='Shown';
 return{hidden,shown,index:shown?out.index:0,total:hidden?0:out.total};
}
// A árvore do leitor vem do `core/pdfpageview.bend` (moldura, páginas e
// destaques) e do `core/pdfview.bend` (rótulos/classes do chrome). Este arquivo
// só aplica no DOM (`view-host.mjs`), injeta os SVGs e fica com o mundo:
// PDF.js, medição/scroll, virtualização, canvas/textLayer, goto, divisores e IPC.
const pdfCache=new Map(),pdfInflight=new Map();
async function cachedPdf(file){
 if(pdfCache.has(file))return pdfCache.get(file);
 if(pdfInflight.has(file))return pdfInflight.get(file);
 const job=(async()=>{
  const bytes=await window.desk.readPDF(file);
  // JBIG2/JPEG 2000 e perfis ICC precisam dos decodificadores locais. Sem
  // wasmUrl o PDF.js pode concluir a página omitindo partes da imagem.
  const loading=pdfjs.getDocument({data:bytes,standardFontDataUrl:new URL('../node_modules/pdfjs-dist/standard_fonts/',import.meta.url).href,cMapUrl:new URL('../node_modules/pdfjs-dist/cmaps/',import.meta.url).href,cMapPacked:true,wasmUrl:new URL('../node_modules/pdfjs-dist/wasm/',import.meta.url).href});
  const doc=await loading.promise;
  const hit={doc,loading};
  pdfCache.set(file,hit);
  if(pdfCache.size>4){
   for(const [key,entry] of pdfCache){
    if(key===file||S.panels.some(p=>p.doc===entry.doc))continue;
    try{entry.loading.destroy();}catch{}
    pdfCache.delete(key);break;
   }
  }
  return hit;
 })();
 pdfInflight.set(file,job);
 try{return await job;}finally{pdfInflight.delete(file);}
}
// Lista do artefato Bend (`Con`/`Nil`) a partir de um array JS.
function bendList(items){let out={$:'Nil'};for(let i=items.length-1;i>=0;i--)out={$:'Con',head:items[i],tail:out};return out;}
// Orientação por documento (voltas do USUÁRIO, 90° cada): o mapa fica no
// runtime/per-curso e sobrevive à troca de leitor e de matéria; o `docMemo`
// cobre o retorno ao mesmo PDF na mesma sessão. A normalização/validação mora
// no núcleo (`core/pdfpageview.bend`): aqui só entra o que o ciclo aceita.
const pdfRotations=new Map();
// Mesmo contrato estrito do main (`sanitizeRotation`): só número inteiro do
// ciclo entra; string ("90"), fração (90.5) ou qualquer lixo vira 0, sem
// exceção — o snapshot legado de `pdfs[]` chega cru aqui (o main não o sanea).
function normalizeRotation(value){
 if(typeof value!=='number'||!Number.isInteger(value)||value<0||value>270)return 0;
 try{return Number(pdfPage.rotationNormalize(toNat(value)));}catch{return 0;}
}
export function pdfRotationsSnapshot(){const out={};for(const [path,rotation] of pdfRotations)out[path]=rotation;return out;}
export function restorePdfRotations(value){
 pdfRotations.clear();
 if(!value||typeof value!=='object'||Array.isArray(value))return;
 for(const [path,rotation] of Object.entries(value)){
  if(!path||path==='__proto__')continue;
  const r=normalizeRotation(rotation);
  if(r)pdfRotations.set(path,r);
 }
}
function rememberPdfRotation(path,rotation){
 if(!path)return;
 const r=normalizeRotation(rotation);
 if(r)pdfRotations.set(path,r);else pdfRotations.delete(path);
}
// Andaime `data-icon` do núcleo vira SVG do host (o aplicador compartilhado
// com o popover de navegação: `view-host.mjs`).
const iconize=root=>applyIcons(root,icon);
// O aplicador não faz diff: a região trocada é substituída pela árvore nova.
function swapInto(oldEl,node,handlers){const next=build(node,handlers);oldEl.replaceWith(next);iconize(next);return next;}
/* A folha "Lista 0" é do leitor sem material de uma MATÉRIA. A aba Livre tem os
   leitores e o vazio dela (importar/gerar PDF), e sem matéria nenhuma não há
   pasta a mostrar. */
const inFreeSpace=()=>S.workspace?.kind==='free'||S.currentCourseId==='mesa-free';
function hasCourseSheet(){return !!S.currentCourseId&&!inFreeSpace();}
/* A pasta da matéria ganhou arquivos enquanto a Mesa estava em segundo plano
   (o usuário os jogou lá a partir da folha): ao voltar o foco, relê a
   biblioteca e dá a cada leitor ainda sem material o PDF que ele preferiria. Só
   age quando há folha na tela — leitor com material nunca é trocado. */
let refreshingLibrary=false;
async function refreshSheetLibrary(){
 if(refreshingLibrary||S.switching||!hasCourseSheet())return;
 const waiting=(S.panels||[]).filter(p=>p.hasSheet?.());
 if(!waiting.length||typeof window.desk?.courseLibrary!=='function')return;
 refreshingLibrary=true;
 try{
  const courseId=S.currentCourseId;
  const fresh=await window.desk.courseLibrary();
  if(!fresh||fresh.courseId!==courseId||S.currentCourseId!==courseId||S.switching)return;
  let added=false;
  for(const item of fresh.library||[])if(item?.path&&!S.library.some(p=>p.path===item.path)){S.library.push({name:item.name,path:item.path});added=true;}
  if(added)S.panels.forEach(p=>p.populate());
  for(const panel of waiting){
   const path=(fresh.preferred||[])[panel.index];
   if(path&&!panel.doc&&!panel.loading&&S.panels[panel.index]===panel)await panel.load(path);
  }
 }catch{/* sem biblioteca nova: a folha continua e o próximo foco tenta de novo */}
 finally{refreshingLibrary=false;}
}
if(typeof window!=='undefined')window.addEventListener('focus',()=>{refreshSheetLibrary();});
/* O menu "Mais opções" fecha com um clique fora dele e com Esc (o foco volta
   para o botão que o abriu). O Esc é de camada: `escape-policy.mjs` conta o
   menu como popover, então fechar o menu nunca cancela o turno do tutor. */
const openMore=()=>(S.panels||[]).filter(panel=>panel.q?.('.pdf-more-pop')?.hidden===false);
document.addEventListener('click',event=>{
 if(event.target?.closest?.('.pdf-more-pop,.more'))return;
 for(const panel of openMore())panel.setMore(false);
});
document.addEventListener('keydown',event=>{
 if(event.key!=='Escape')return;
 for(const panel of openMore()){
  panel.setMore(false);
  panel.q('.more')?.focus();
 }
});
/* Política de retenção do leitor. A janela de pintura continua a mesma (±1
   viewport acima, +2 abaixo); o descarte só acontece fora de uma janela maior
   (histerese de 1 viewport por ponta), com orçamento para páginas fora da banda —
   em canvases e em pixels, porque o zoom alto multiplica cada backing store.
   Descartar zera width/height antes de soltar o canvas; o shell e as dimensões
   ficam e o textLayer visível nunca é tocado. */
const PDF_RENDER_UP=1,PDF_RENDER_DOWN=2;
const PDF_KEEP_UP=2,PDF_KEEP_DOWN=3;
const PDF_MAX_RETAINED_CANVASES=12;
const PDF_MAX_RETAINED_PIXELS=40*1024*1024;
export class PdfPanel {
 constructor(index,label){
  Object.assign(this,{index,label,page:1,zoom:1,scrollX:0,scrollY:0,invert:false,minimized:false,findOpen:false,loading:false,path:null,doc:null,rotation:0,renderTasks:new Map(),pageEls:[],version:0,_renderSeq:0,docMemo:new Map(),findTerm:'',findPages:[],findTotal:0,textDoc:null,textPages:null,pageLabels:[],pageOffset:null,printedOpen:false,dropHint:null,printedRow:null,printedToggle:null,_dropping:false,_dropOver:false,_drop:null});
  this.handlers={
   OpenDoc:e=>this.load(e.currentTarget.value),
   OpenFile:()=>this.openFile(),
   // Atalhos da folha "Lista 0" do leitor sem material.
   RevealFolder:()=>this.revealFolder(),
   AskTutor:()=>this.askTutor(),
   ToggleFind:()=>this.setFind(this.q('.pdf-find').hidden),
   PageShot:()=>this.pageShot(),
   ToggleCollapse:()=>this.toggleMinimized(),
   // "Mais opções": o menu com o que não cabe na linha única da barra.
   ToggleMore:()=>this.toggleMore(),
   ToggleInvert:()=>this.toggleInvert(),
   Rotate:()=>this.toggleRotation(),
   Prev:()=>this.goto(this.page-1),
   Next:()=>this.goto(this.page+1),
   // Voltar da citação seguida (a pilha é de nav.mjs, por painel).
   NavBack:()=>navBack(this),
   // Popover de favoritos/sumário (o corpo é do nav.mjs).
   ToggleNav:()=>toggleNav(this),
   GotoPage:e=>this.goto(Number(e.currentTarget.value)),
   ZoomOut:()=>this.nudgeZoom(-.2),
   ZoomIn:()=>this.nudgeZoom(.2),
   Fit:()=>this.fitWidth(),
   Find:e=>this.find(e),
   // Numeração impressa (rótulos do PDF e ajuste pessoal por documento).
   TogglePrinted:()=>this.togglePrinted(),
   GoPrinted:e=>this.goPrinted(e),
   PrintedOffsetSave:()=>this.savePrintedOffset(),
   PrintedOffsetAuto:()=>this.clearPrintedOffset()
  };
  this.el=build(pdfPage.panelShell(this.shellFacts()),this.handlers);
  iconize(this.el);
  $('#pdf-grid').append(this.el);this.q=s=>this.el.querySelector(s);
  // O contrato antigo já nascia com `aria-pressed="false"` no botão de inverter
  // (o `load` e o `toggleInvert` continuam atualizando o mesmo atributo).
  this.q('.invert').setAttribute('aria-pressed',String(!!this.invert));
  this.paintViewport();
  renderInto(this.q('.page-total'),pdfView.pageTotalEmpty());
  renderInto(this.q('.zoom-label'),pdfView.zoomLabel(100));
  this.populate();
  /* Controles que o núcleo desenha e o painel monta fora das regiões pinadas
     pelo contrato (`pdfpageview.test`): o botão da numeração impressa entra no
     menu "Mais opções", antes do recolher (que continua o último), e a linha
     entra entre a barra e o palco. A área alvo do PDF solto cobre o palco. */
  this.printedToggle=build(pdfPage.printedToggleBtn(this.label,this.printedOpen),this.handlers);
  iconize(this.printedToggle);
  this.q('.collapse').before(this.printedToggle);
  /* Escolher uma ação do menu o fecha (o zoom − e + ficam, para ajustar de
     novo); o foco volta para o botão que abriu, não se perde no <body>. */
  this.q('.pdf-more-pop').addEventListener('click',event=>{
   const button=event.target.closest?.('button');
   if(!button||button.matches('.in,.out'))return;
   const focusInside=this.q('.pdf-more-pop').contains(document.activeElement);
   this.setMore(false);
   if(focusInside)this.q('.more')?.focus();
  });
  this.printedRow=build(pdfPage.printedRow(this.label,this.printedOpen),this.handlers);
  iconize(this.printedRow);
  this.q('.pdf-stage').before(this.printedRow);
  this.dropHint=build(pdfPage.dropHint(this.label),{});
  this.q('.pdf-stage').append(this.dropHint);
  this._drop=bindPdfDrop(this.el,{onActive:on=>this.setDropActive(on),onDrop:file=>this.dropPDF(file)});
  this.paintPrinted();
  const box=this.q('.pdf-viewport');
  box.addEventListener('pointerdown',()=>this.el.focus());
  box.addEventListener('scroll',()=>{if(this._layingOut)return;this.scrollX=box.scrollLeft;this.scrollY=box.scrollTop;this.updateCurrentPage();this.renderVisible();hideQuoteButton();save();},{passive:true});
  box.addEventListener('wheel',e=>{if(e.ctrlKey||e.metaKey){e.preventDefault();this.nudgeZoom(e.deltaY>0?-.2:.2);}},{passive:false});
  this.resize=new ResizeObserver(()=>{const w=box.clientWidth;box.style.setProperty('--gutter',`${box.offsetWidth-w}px`);if(w===this._width)return;this._width=w;this.rememberScroll();clearTimeout(this.resizeTimer);this.resizeTimer=setTimeout(()=>this.render(),120);});this.resize.observe(box);
 }
 // Fatos do painel para o núcleo: rótulo, biblioteca, documento atual e os
 // estados de minimizar/busca (a `pinned` é do `state.mjs`, depois do build).
 shellFacts(){return{$:'PdfShell',label:this.label,options:this.optionList(),path:this.path||'',minimized:!!this.minimized,findOpen:!!this.findOpen,rotation:toNat(this.rotation)};}
 optionList(){return bendList((S.library||[]).map(p=>({$:'PdfOption',name:String(p.name??''),path:String(p.path??'')})));}
 /* Leitor sem material: numa matéria é a folha "Lista 0" (diz como pôr algo ali);
    na aba Livre (e sem matéria) segue o vazio da própria aba. */
 readerState(){
  if(this.loading)return{$:'PdfLoading'};
  if(this.doc)return{$:'PdfReady'};
  return hasCourseSheet()?{$:'PdfSheet',course:String(S.activeCourseName||'')}:{$:'PdfEmpty'};
 }
 // Estado → miolo (`None` = carregando/erro não mexem no documento, como no Electron).
 paintViewport(){
  const state=this.readerState();
  /* Sem material (folha ou vazio) a barra fica só com o rótulo, "Nenhum material"
     e Mais opções: página, busca e favoritos não têm onde agir (#27 B3). */
  this.el.toggleAttribute('data-no-material',state.$==='PdfSheet'||state.$==='PdfEmpty');
  const out=pdfPage.viewport(state,{$:'Nil'});
  if(out.$!=='Some')return;
  const box=this.q('.pdf-viewport');
  renderInto(box,out.value,this.handlers);
  iconize(box);
 }
 hasSheet(){return !!this.q('.pdf-viewport .reader-sheet');}
 // "Mostrar a pasta": a pasta da matéria no gerenciador de arquivos do sistema.
 async revealFolder(){
  try{await window.desk.revealCourseFolder();}
  catch(e){toast(e?.message||uiMessage('pdf.err.folder'));}
 }
 // "Pedir ao tutor": abre o pedido de PDF já com a lista de exercícios escrita
 // (o diálogo é do free-study.mjs; aqui só se avisa, sem importar o módulo).
 askTutor(){
  window.dispatchEvent(new CustomEvent('desk-reader-sheet',{detail:{action:'tutor',seed:uiText(readerSheet.tutorSeed(String(S.activeCourseName||'')))}}));
 }
 populate(){const selected=this.path;renderChildren(this.q('.pdf-select'),pdfPage.optionNodes(this.optionList(),this.path||''));if(selected)this.q('.pdf-select').value=selected;this.titleSelect();}
 /* Rótulo + nome inteiro do material na dica: a barra estreita encurta o nome com
    reticências e, num leitor de ~250px, esconde o rótulo. */
 titleSelect(){const select=this.q('.pdf-select');if(select)select.title=[this.label,select.selectedOptions[0]?.textContent].filter(Boolean).join(' · ');}
 // Menu "Mais opções": abrir um fecha os dos outros leitores (e o popover de
 // favoritos fecha pelo clique fora, do nav.mjs).
 setMore(open){
  const pop=this.q('.pdf-more-pop'),button=this.q('.more');
  if(!pop||!button)return;
  const next=!!open;
  if(next)for(const other of S.panels||[])if(other!==this)other.setMore?.(false);
  pop.hidden=!next;
  button.setAttribute('aria-expanded',String(next));
 }
 toggleMore(){this.setMore(!!this.q('.pdf-more-pop')?.hidden);}
 setFind(open){
  this.findOpen=!!open;
  const form=this.q('.pdf-find');
  clearTimeout(this._findTimer);
  if(this._findEnd){form.removeEventListener('transitionend',this._findEnd);this._findEnd=null;}
  this.q('.find-toggle').setAttribute('aria-pressed',String(this.findOpen));
  if(open){
   form.classList.remove('closing');form.hidden=false;
   const input=this.q('.pdf-find input');input.focus();input.select();
   return;
  }
  if(form.hidden)return;
  form.classList.add('closing');
  const end=event=>{
   if(event&&event.target!==form)return;
   clearTimeout(this._findTimer);form.removeEventListener('transitionend',end);this._findEnd=null;
   form.hidden=true;form.classList.remove('closing');
  };
  this._findEnd=end;
  form.addEventListener('transitionend',end);
  this._findTimer=setTimeout(end,300);
 }
 async pageText(doc,n){
  if(this.textDoc!==doc){this.textDoc=doc;this.textPages=new Map();}
  if(this.textPages.has(n))return this.textPages.get(n);
  const job=(async()=>{const t=await (await doc.getPage(n)).getTextContent();return foldSearch(t.items.map(i=>i.str||'').join(' '));})();
  this.textPages.set(n,job);
  try{return await job;}catch(e){this.textPages.delete(n);throw e;}
 }
 async openFile(){
  const file=await window.desk.openPDF();
  if(!file)return;
  if(!S.library.some(p=>p.path===file.path)){S.library.push(file);S.panels.forEach(p=>p.populate());}
  this.load(file.path);
 }
 /* ---------- numeração impressa (rótulos do PDF e ajuste pessoal) ---------- */
 // Fatos para o núcleo: rótulos próprios do PDF (1-based) e o ajuste pessoal.
 printedLabelsList(){return labelsList(this.pageLabels);}
 printedOffsetFacts(){return offsetFacts(this.pageOffset);}
 printedLabelText(page){const out=pdfPage.printedLabel(this.printedLabelsList(),this.printedOffsetFacts(),toNat(page));return typeof out==='string'?out:'';}
 setPrintedStatus(text){const el=this.q('.printed-status');if(el)el.textContent=uiText(String(text??''));}
 // Status do modo + rótulo da página atual. O input de deslocamento só é
 // tocado fora do foco (quem está digitando não perde o texto).
 paintPrinted(){
  const own=this.pageLabels.length>0;
  const status=this.q('.printed-status');
  if(status)status.textContent=`${uiText(pdfPage.printedStatusText(own,this.printedOffsetFacts()))} · ${uiText(pdfPage.printedCurrentText(this.printedLabelText(this.page)))}`;
  const offsetInput=this.q('.printed-offset');
  if(offsetInput&&document.activeElement!==offsetInput)offsetInput.value=this.pageOffset==null?'':String(this.pageOffset);
  const editor=this.q('.printed-offset-editor');
  if(editor){
   editor.classList.toggle('disabled',own);
   editor.title=uiText(own?pdfPage.printedOwnHint():pdfPage.printedOffsetTitle());
   for(const control of editor.querySelectorAll('input,button'))control.disabled=own;
  }
 }
 togglePrinted(){
  this.printedOpen=!this.printedOpen;
  if(this.printedRow)this.printedRow.hidden=!this.printedOpen;
  if(this.printedToggle)this.printedToggle.setAttribute('aria-expanded',String(this.printedOpen));
  if(this.printedOpen){this.paintPrinted();this.q('.printed-input')?.focus();}
 }
 // O alvo é SEMPRE a página física; o rótulo/impressa só escolhe o alvo.
 goPrinted(event){
  if(event)event.preventDefault();
  const input=this.q('.printed-input');
  const text=String(input?.value??'').trim();
  if(!this.doc){this.setPrintedStatus(pdfPage.printedInvalidText());return;}
  const found=pdfPage.resolvePrinted(this.printedLabelsList(),this.printedOffsetFacts(),toNat(this.doc.numPages),toNat(this.page),text);
  if(found.$==='Some'){
   const physical=Number(found.value);
   this.goto(physical);
   if(input)input.value='';
   this.setPrintedStatus(pdfPage.printedFoundText(text,toNat(physical)));
   return;
  }
  this.setPrintedStatus(pdfPage.printedNotFoundText());
  toast(pdfPage.printedNotFoundText());
 }
 savePrintedOffset(){
  const raw=String(this.q('.printed-offset')?.value??'').trim();
  const value=raw===''?null:Number(raw);
  if(value!==null&&(!Number.isInteger(value)||Math.abs(value)>1000000)){this.setPrintedStatus(pdfPage.printedBadOffsetText());return;}
  this.persistPrintedOffset(value);
 }
 clearPrintedOffset(){this.persistPrintedOffset(null);}
 async persistPrintedOffset(offset){
  const write=window.desk?.pdfPageLabelsSave;
  if(typeof write!=='function'){this.setPrintedStatus(pdfPage.printedNoApiHint());toast(pdfPage.printedNoApiHint());return;}
  const path=this.path,id=this.version;
  if(!path)return;
  try{
   const out=await write({path,offset});
   if(id!==this.version||path!==this.path)return;
   this.pageOffset=offsetFromRecord(out&&typeof out==='object'?out:{offset});
   this.paintPrinted();this.updatePageUI();
   toast(pdfPage.printedSavedOffsetText(this.printedOffsetFacts()));
  }catch(e){
   const message=e?.message||String(e);
   this.setPrintedStatus(message);
   toast(message);
  }
 }
 // `{offset: null}` = automático; registro inesperado também cai no automático.
 async loadPageOffset(path,id){
  const read=window.desk?.pdfPageLabelsGet;
  let offset=null;
  if(typeof read==='function'){
   try{offset=offsetFromRecord(await read(path));}catch{offset=null;}
  }
  if(id!==this.version||path!==this.path)return;
  this.pageOffset=offset;this.paintPrinted();this.updatePageUI();
 }
 // Rótulos do próprio PDF. Guarda contra troca de documento no meio do await.
 async capturePageLabels(doc,id){
  const labels=await readDocLabels(doc);
  if(id!==this.version||doc!==this.doc)return;
  this.pageLabels=labels;this.paintPrinted();this.updatePageUI();
 }
 /* ---------- PDF solto no leitor alvo ---------- */
 setDropActive(on){
  this._dropOver=!!on;
  if(this._dropping)return;
  this.el.classList.toggle('pdf-drop-over',this._dropOver);
  if(this.dropHint)this.dropHint.hidden=!this._dropOver;
 }
 // Enquanto o backend prepara o arquivo, a dica vira "Abrindo o PDF…"; no
 // Livre a importação copia o arquivo, então o vão pode ser visível.
 dropOpening(on){
  this.el.classList.toggle('pdf-drop-busy',!!on);
  if(!this.dropHint)return;
  this.dropHint.hidden=!on;
  this.dropHint.classList.toggle('busy',!!on);
  this.dropHint.textContent=uiText(on?pdfPage.dropOpeningText():pdfPage.dropHintText(this.label));
 }
 async dropPDF(file){
  if(!isPdfFile(file)){toast(pdfPage.dropInvalidText());return;}
  const open=window.desk?.openDroppedPDF;
  if(typeof open!=='function'){toast(pdfPage.dropUnavailableText());return;}
  if(this._dropping)return;
  this._dropping=true;this.setDropActive(false);this.dropOpening(true);
  const name=String(file?.name||'');
  const courseId=S.currentCourseId,session=S.currentSession,version=this.version;
  const current=()=>!S.switching&&S.currentCourseId===courseId&&S.currentSession===session&&S.panels[this.index]===this&&this.version===version&&this.el.isConnected;
  try{
   /* No Livre o drop importa uma cópia e devolve a sessão inteira: o estado
      atual dos dois leitores precisa estar no disco ANTES, senão o leitor que
      não recebeu o PDF perde a página/zoom que o backend tinha. */
   if(inFreeSpace())await window.desk.save(layoutSnapshot());
   if(!current())return;
   const out=await open(file,this.index);
   if(!current())return;
   if(!out)return;
   if(out.data){await loadCourse(out.data);return;}
   if(!out.path)return;
   if(!S.library.some(p=>p.path===out.path)){S.library.push({name:out.name||name,path:out.path});S.panels.forEach(p=>p.populate());}
   await this.load(out.path);
   toast(pdfPage.dropOpenedText(String(out.name||name),this.label));
  }catch(e){
   if(current())toast(e?.message||pdfPage.dropInvalidText());
  }finally{
   this._dropping=false;this.dropOpening(false);this.setDropActive(false);
  }
 }
 async pageShot(){
  if(!this.doc)return;
  const n=this.page,el=this.pageEls[n-1];
  if(!el)return;
  try{
   if(!el.querySelector('canvas'))await this.renderPage(n,el);
   const canvas=el.querySelector('canvas');
   if(!canvas)return;
   const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
   if(!blob)return;
   if(blob.size>MAX_ATTACH_BYTES){toast(uiMessage('pdf.attach.tooBig'));return;}
   if(S.attachments.length>=MAX_ATTACH){toast(uiMessage('pdf.attach.max',{max:MAX_ATTACH}));return;}
   const name=(this.path.split(/[/\\]/).at(-1)||'').replace(/\.pdf$/i,'')||'pagina';
   if(await addAttachments([new File([blob],`${name}-p${n}.png`,{type:'image/png'})]))toast(uiMessage('pdf.attach.done',{page:n}));
  }catch(e){toast(e.message);}
 }
 fitWidth(){const ratio=1/this.zoom;this.zoom=1;this.scrollY*=ratio;this.render();save(true);}
 async find(e){
  e.preventDefault();
  if(!this.doc)return;
  const term=foldSearch(this.q('.pdf-find input').value.trim());
  if(!term){this.clearFind();return;}
  const doc=this.doc,button=this.q('.pdf-find button'),version=this.version;
  button.disabled=true;button.textContent='…';
  try{
   const pages=[];let total=0;
   const limit=Math.min(doc.numPages,400);if(doc.numPages>limit)toast(uiMessage('pdf.find.limited'));
   for(let n=1;n<=limit;n++){
    const text=await this.pageText(doc,n);
    // A geração da carga invalida a varredura no ato do `load` (o `doc` só
    // troca depois do PDF novo abrir; sem isto a varredura do doc antigo
    // terminava nessa janela e deixava contador/estado presos no doc novo).
    if(version!==this.version||doc!==this.doc)return;
    let idx=0,count=0;
    while((idx=text.indexOf(term,idx))!==-1){count++;idx+=term.length;}
    if(count){pages.push({page:n,count});total+=count;}
   }
   if(version!==this.version||doc!==this.doc)return;
   const cycle=this.findTerm===term&&this.findPages.length>0;
   this.findTerm=total?term:'';this.findPages=pages;this.findTotal=total;this.refreshFind();this.updateFindCount();
   if(!total){toast(uiMessage('pdf.find.none'));return;}
   const hit=findCore.cycleTarget(cycle,hitsList(this.findPages),toNat(this.page));
   const target=hit.$==='Some'?Number(hit.value):this.findPages[0].page;
   this.goto(target);
   toast(uiMessage(cycle?'pdf.find.cycle':'pdf.find.found',{page:target}));
  }catch(e){toast(e.message);}
  finally{button.disabled=false;button.textContent='Buscar';}
 }
 toggleInvert(){this.invert=!this.invert;this.q('.pdf-viewport').classList.toggle('inverted',this.invert);this.q('.invert').setAttribute('aria-pressed',String(this.invert));save(true);}
 // Gira 90° o documento DESTE leitor (ciclo 0→90→180→270→0). A volta entra no
 // viewport do PDF.js somada à rotação nativa da página; fica guardada por
 // caminho (mapa do runtime + snapshot) e o render reancora a página atual
 // depois do novo layout — a chave de render carrega a rotação, então nenhum
 // canvas da orientação antiga sobrevive à troca.
 toggleRotation(){
  if(!this.doc)return;
  this.rememberScroll();
  this.rotation=Number(pdfPage.rotationNext(toNat(this.rotation)));
  rememberPdfRotation(this.path,this.rotation);
  this.paintRotationBtn();
  toast(pdfPage.rotateToast(toNat(this.rotation)));
  save(true);
  this.render();
 }
 // Só o botão de girar muda com a rotação: trocá-lo preserva o foco do teclado
 // (o mesmo motivo do `collapse` no `toggleMinimized`).
 paintRotationBtn(){
  const btn=this.q('.rotate');
  if(!btn)return;
  const hadFocus=document.activeElement===btn;
  swapInto(btn,pdfPage.rotateBtn(this.label,toNat(this.rotation)),this.handlers);
  if(hadFocus)this.q('.rotate')?.focus();
 }
 toggleMinimized(value){
  this.minimized=value===undefined?!this.minimized:!!value;
  const other=S.panels.find(p=>p!==this);
  const panel=pdfView.panelFlags(this.minimized,this.el.classList.contains('pinned'));
  this.el.classList.toggle('minimized',panel.minimized);
  this.el.classList.toggle('pinned',panel.pinned);
  // Só o botão de colapsar muda com o fato `minimized`: trocar só ele preserva
  // o foco do teclado (e de outros controles da barra) — o render da barra
  // inteira jogava o foco no `<body>` (achado da revisão independente). O item
  // vive no menu, que fecha ao escolher: o foco vai para a faixa recolhida e,
  // ao reabrir, volta para o "Mais opções" da barra.
  const collapse=this.q('.collapse'),strip=this.q('.pdf-restore');
  const fromMenu=document.activeElement===collapse,fromStrip=document.activeElement===strip;
  if(collapse)swapInto(collapse,pdfPage.collapseBtn(this.minimized),this.handlers);
  this.setMore(false);
  if(this.minimized&&fromMenu)strip?.focus();
  else if(!this.minimized&&fromStrip)this.q('.more')?.focus();
  const grid=$('#pdf-grid');
  const flags=pdfView.gridFlags(this.minimized,!!other?.minimized);
  grid.classList.toggle('other-min',flags.otherMin);
  grid.classList.toggle('has-min',flags.hasMin);
  grid.classList.toggle('has-other-min',flags.hasOtherMin);
  if(!this.minimized&&this.doc){this.renderVisible();this.updatePageUI();}
  save(true);
 }
 nudgeZoom(delta){this.rememberScroll();const before=this.zoom;this.zoom=Math.max(.5,Math.min(4,+(this.zoom+delta).toFixed(2)));this.scrollY*=this.zoom/before;this.q('.zoom-label').textContent=`${Math.round(this.zoom*100)}%`;save(true);clearTimeout(this.zoomTimer);this.zoomTimer=setTimeout(()=>this.render(),50);}
 rememberScroll(){const box=this.q('.pdf-viewport');if(!box)return;this.scrollX=box.scrollLeft;this.scrollY=box.scrollTop;}
 async load(path,settings={}){if(!path)return;if(this.path&&this.doc)this.docMemo.set(this.path,{page:this.page,zoom:this.zoom,scrollX:this.scrollX,scrollY:this.scrollY,rotation:this.rotation});const id=++this.version;this.cancelRenders();this.textDoc=null;this.textPages=null;this.pageLabels=[];this.pageOffset=null;const memo=Object.prototype.hasOwnProperty.call(settings,'zoom')||Object.prototype.hasOwnProperty.call(settings,'page')?null:this.docMemo.get(path);const use=memo||settings;/* Prioridade da orientação: memo do painel > rotação explícita do snapshot
   (0 incluído) > mapa por caminho. O mapa é compartilhado entre leitores; o
   snapshot é de cada painel — com o mesmo PDF nos dois, cada um volta na sua
   orientação. O mapa só decide quando o snapshot é legado (sem o campo). */
const explicitRotation=Object.prototype.hasOwnProperty.call(settings,'rotation');this.loading=true;this.path=path;this.page=Math.max(1,use.page||1);this.zoom=use.zoom||1;this.rotation=normalizeRotation(memo?memo.rotation:explicitRotation?settings.rotation:(pdfRotations.get(path)??0));this.scrollX=use.scrollX||0;this.scrollY=use.scrollY||0;/* Página escura (#42) é do leitor, não do documento: trocar de material mantém; só a restauração do estado (que traz `invert`) a define. */this.invert=Object.prototype.hasOwnProperty.call(settings,'invert')?!!settings.invert:!!this.invert;this.findTerm='';this.findPages=[];this.findTotal=0;this.q('.pdf-select').value=path;this.titleSelect();this.updateFindCount();this.q('.pdf-viewport').classList.toggle('inverted',this.invert);this.q('.invert').setAttribute('aria-pressed',String(this.invert));this.paintRotationBtn();this.paintPrinted();this.paintViewport();this.loadPageOffset(path,id);renderInto(this.q('.pdf-foot'),pdfView.footLoading());try{const {doc}=await cachedPdf(path);if(id!==this.version)return;this.doc=doc;this.page=Math.max(1,Math.min(doc.numPages,this.page));this.capturePageLabels(doc,id);await this.render();this.loading=false;updateWindowTitle();save();}catch(e){this.loading=false;renderInto(this.q('.pdf-foot'),pdfView.footError());toast(e.message);}}
 // Sumário do documento (pdf.js `getOutline` com o destino resolvido): lista
 // de `{title, page, depth}` com a página 1-based. Cache por doc — o teto de 40
 // linhas é o `maxOutline()` do núcleo. Papelão sem `/Outlines` devolve [].
 async outline(){
  if(!this.doc)return [];
  if(this._outlineDoc===this.doc)return this._outline||[];
  const doc=this.doc,out=[];
  const walk=async(nodes,depth)=>{
   for(const node of nodes||[]){
    if(out.length>=40)return;
    let page=1;
    try{
     const dest=typeof node.dest==='string'?await doc.getDestination(node.dest):node.dest;
     if(dest&&dest[0]!=null)page=(await doc.getPageIndex(dest[0]))+1;
    }catch{}
    out.push({title:String(node.title||'').trim(),page,depth});
    if(node.items&&node.items.length)await walk(node.items,depth+1);
   }
  };
  try{await walk(await doc.getOutline(),0);}catch{}
  this._outlineDoc=doc;this._outline=out;
  return out;
 }
 goto(n){if(!this.doc)return;const page=Math.max(1,Math.min(this.doc.numPages,Math.trunc(n)||1));this.page=page;const target=this.pageEls[page-1];if(target&&target.isConnected&&target.offsetParent){const box=this.q('.pdf-viewport');box.scrollTo({top:target.offsetTop,left:0,behavior:'auto'});this.scrollY=box.scrollTop;this.updatePageUI(true);this.renderVisible();save(true);return;}this.updatePageUI(true);this.renderVisible();save(true);}
 cancelRenders(){for(const task of this.renderTasks.values())try{task.cancel();}catch{}this.renderTasks.clear();}
 updatePageUI(force=false){
  if(!this.doc)return;
  const page=toNat(this.page),total=toNat(this.doc.numPages),file=this.path.split(/[/\\]/).at(-1)||'';
  const pageInput=this.q('.page-number');
  /* Um render atrasado (janela/ResizeObserver) não sobrescreve a página que o
     usuário está digitando: o valor fica até o Enter/blur confirmar; aí o
     `goto` (force) alinha o campo com a página real. */
  if(force||document.activeElement!==pageInput)pageInput.value=pdfView.pageNumberValue(page);
  pageInput.max=pdfView.pageNumberMax(total);
  renderInto(this.q('.page-total'),pdfView.pageTotal(total));
  renderInto(this.q('.zoom-label'),pdfView.zoomLabel(roundNat(this.zoom*100)));
  renderInto(this.q('.pdf-foot'),pdfView.footReadyLabeled(page,total,file,this.printedLabelText(this.page)));
  this.paintPrinted();
  const nav=pdfView.navChrome(true,this.page<=1,this.page>=this.doc.numPages);
  this.q('.prev').disabled=nav.prevDisabled;
  this.q('.next').disabled=nav.nextDisabled;
  this.updateFindCount();updateContextSummary();updateWindowTitle();
 }
 updateFindCount(){
  const el=this.q('.find-count');
  if(!el)return;
  const facts=findFacts(this.findTerm,this.findPages,this.findTotal,this.page);
  const chrome=pdfView.findCountChrome(facts.hidden,facts.shown,facts.index,facts.total);
  el.hidden=chrome.hidden;
  renderInto(el,pdfView.findCountLabel(chrome));
 }
 refreshFind(){for(const el of this.pageEls)if(el.dataset.rendered)delete el.dataset.rendered;this.renderVisible();}
 clearFind(){this.findTerm='';this.findPages=[];this.findTotal=0;this.refreshFind();this.updateFindCount();}
 // Cada `span` do textLayer vira texto + `.pdf-hl` no núcleo; aqui só entra a
 // dobra (mesma largura) e o recorte dos spans que contêm o termo.
 highlightLayer(layer){
  const term=this.findTerm;
  if(!term)return;
  for(const span of layer.querySelectorAll('span')){
   const text=span.textContent,lower=foldSearch(text);
   if(lower.length!==text.length||!lower.includes(term))continue;
   renderChildren(span,pdfPage.hlSegments(text,lower,term),{});
  }
 }
 updateCurrentPage(){if(!this.pageEls.length||!this.el.isConnected)return;const box=this.q('.pdf-viewport');const center=box.scrollTop+box.clientHeight/2;let nearest=0,distance=Infinity;for(let i=0;i<this.pageEls.length;i++){const el=this.pageEls[i];const d=Math.abs(el.offsetTop+el.offsetHeight/2-center);if(d<distance){distance=d;nearest=i;}}const page=nearest+1;if(page!==this.page){this.page=page;this.updatePageUI(true);}}
 // Mede todas as páginas de uma vez. A rotação efetiva é nativa do PDF mais a
 // volta do usuário: entra na base (fit), no viewport final e na chave de
 // render — o PDF.js cuida da geometria; nada de `transform` CSS na página.
 async render(){if(!this.doc||!this.el.offsetWidth)return;const seq=++this._renderSeq,doc=this.doc,box=this.q('.pdf-viewport');this.cancelRenders();const width=box.clientWidth;box.style.setProperty('--gutter',`${box.offsetWidth-width}px`);const style=getComputedStyle(box);const available=width-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight);const boxes=[],viewports=[];try{for(let n=1;n<=doc.numPages;n++){const page=await doc.getPage(n);if(seq!==this._renderSeq||doc!==this.doc)return;const rotation=(page.rotate+this.rotation)%360;const base=page.getViewport({scale:1,rotation});const scale=Math.max(.1,available/base.width)*this.zoom;const viewport=page.getViewport({scale,rotation});viewports.push(viewport);boxes.push({$:'PdfPageBox',n:toNat(n),width:`${viewport.width}px`,height:`${viewport.height}px`});}if(seq!==this._renderSeq)return;this._layingOut=true;const frame=pdfPage.viewport({$:'PdfReady'},bendList(boxes));if(frame.$==='Some'){for(const el of this.pageEls)this.releasePageCanvas(el);renderInto(box,frame.value);}this.pageEls=[...box.querySelectorAll('.pdf-page')];for(let i=0;i<this.pageEls.length;i++)this.pageEls[i]._viewport=viewports[i];box.scrollLeft=this.scrollX;box.scrollTop=this.scrollY;const target=this.pageEls[this.page-1];if(target){const top=target.offsetTop,bottom=target.offsetTop+target.offsetHeight;if(box.scrollTop<top-1||box.scrollTop>bottom){box.scrollTop=top;this.scrollY=box.scrollTop;}}this.updatePageUI();this.renderVisible();requestAnimationFrame(()=>{this._layingOut=false;this.updateCurrentPage();});}catch(e){this._layingOut=false;if(e.name!=='RenderingCancelledException')toast(uiMessage('pdf.err.prepare',{reason:e.message}));}}
 releasePageCanvas(el){
  // Zera o backing store antes de soltar o canvas (a memória sai agora, não no
  // GC) e sobe a geração: render em voo não instala canvas atrasado na página.
  el._renderGen=(el._renderGen||0)+1;
  delete el.dataset.rendering;delete el.dataset.rendered;
  const canvas=el.querySelector(':scope > canvas');
  if(canvas){canvas.width=0;canvas.height=0;canvas.remove();}
  for(const pending of el._pendingCanvases||[]){pending.width=0;pending.height=0;}
  el._pendingCanvases?.clear();
  const layer=el.querySelector(':scope > .textLayer');
  if(layer)layer.remove();
 }
 evictPages(box,bandTop,bandBottom){
  if(!this.doc||box.clientHeight<=0)return;
  const keepTop=box.scrollTop-box.clientHeight*PDF_KEEP_UP,keepBottom=box.scrollTop+box.clientHeight*PDF_KEEP_DOWN;
  const center=box.scrollTop+box.clientHeight/2;
  const retained=[];
  for(let i=0;i<this.pageEls.length;i++){
   const el=this.pageEls[i],canvas=el.querySelector(':scope > canvas');
   if(!canvas&&!el.dataset.rendering)continue;
   const mid=el.offsetTop+el.offsetHeight/2;
   const pixels=(canvas?canvas.width*canvas.height:0)+[...(el._pendingCanvases||[])].reduce((sum,c)=>sum+c.width*c.height,0);
   retained.push({n:i+1,el,pixels,inBand:el.offsetTop+el.offsetHeight>=bandTop&&el.offsetTop<=bandBottom,inKeep:mid>=keepTop&&mid<=keepBottom,distance:Math.abs(mid-center)});
  }
  // A banda pintada é intocável e conta primeiro no orçamento; fora dela,
  // retém do mais perto para o mais longe enquanto couber no orçamento.
  let kept=0,keptPixels=0;
  for(const item of retained)if(item.inBand){kept++;keptPixels+=item.pixels;}
  retained.sort((a,b)=>a.distance-b.distance);
  for(const item of retained){
   if(item.inBand)continue;
   if(item.inKeep&&kept<PDF_MAX_RETAINED_CANVASES&&keptPixels+item.pixels<=PDF_MAX_RETAINED_PIXELS){kept++;keptPixels+=item.pixels;continue;}
   const task=this.renderTasks.get(item.n);
   if(task){try{task.cancel();}catch{}this.renderTasks.delete(item.n);}
   this.releasePageCanvas(item.el);
  }
 }
 renderVisible(){if(!this.doc||!this.pageEls.length)return;cancelAnimationFrame(this._visibleFrame);this._visibleFrame=requestAnimationFrame(()=>{if(!this.el.isConnected)return;const box=this.q('.pdf-viewport'),top=box.scrollTop-box.clientHeight*PDF_RENDER_UP,bottom=box.scrollTop+box.clientHeight*PDF_RENDER_DOWN;for(let i=0;i<this.pageEls.length;i++){const el=this.pageEls[i];if(el.offsetTop+el.offsetHeight>=top&&el.offsetTop<=bottom)this.renderPage(i+1,el);}this.evictPages(box,top,bottom);});}
 async renderPage(n,el){
  if(!this.el.isConnected||!el.isConnected)return;
  const key=`${this.version}:${this.zoom}:${this.rotation}:${window.devicePixelRatio||1}`;
  if(el.dataset.rendered===key||el.dataset.rendering===key)return;
  // Geração por elemento: descarte/repintura sobe o número e invalida o render
  // em voo mesmo que a chave volte igual — página descartada não recebe canvas
  // atrasado, e o `finally` não apaga a marca de um render novo.
  const gen=(el._renderGen||0)+1;el._renderGen=gen;
  const doc=this.doc,version=this.version;
  const stale=()=>doc!==this.doc||version!==this.version||el._renderGen!==gen||el.dataset.rendering!==key||!el.isConnected;
  el.dataset.rendering=key;
  let canvas=null,task=null,installed=false;
  try{
   const page=await doc.getPage(n);
   if(stale())return;
   const viewport=el._viewport,dpr=window.devicePixelRatio||1;let output=Math.max(dpr,2);const maxPx=16777216,need=viewport.width*output*viewport.height*output;if(need>maxPx)output=Math.sqrt(maxPx/(viewport.width*viewport.height));canvas=document.createElement('canvas');
   (el._pendingCanvases??=new Set()).add(canvas);canvas.width=Math.ceil(viewport.width*output);canvas.height=Math.ceil(viewport.height*output);canvas.style.width=`${viewport.width}px`;canvas.style.height=`${viewport.height}px`;
   task=page.render({canvasContext:canvas.getContext('2d',{alpha:false}),viewport,transform:output===1?null:[output,0,0,output,0,0],intent:'display'});
   this.renderTasks.set(n,task);await task.promise;if(this.renderTasks.get(n)===task)this.renderTasks.delete(n);
   if(stale())return;
   let layer=null;
   try{layer=document.createElement('div');layer.className='textLayer';layer.style.setProperty('--total-scale-factor',String(viewport.scale));const tl=new pdfjs.TextLayer({textContentSource:await page.getTextContent(),container:layer,viewport});await tl.render();if(!layer.querySelector('span'))layer=null;}catch{layer=null;}
   if(stale())return;
   const previous=el.querySelector(':scope > canvas');
   if(previous){previous.width=0;previous.height=0;}
   el.replaceChildren(canvas);installed=true;if(layer){if(this.findTerm)this.highlightLayer(layer);el.append(layer);}
   el.dataset.rendered=key;
  }catch(e){if(!stale()&&e.name!=='RenderingCancelledException')toast(uiMessage('pdf.err.render',{page:n,reason:e.message}));}
  finally{
   if(task&&this.renderTasks.get(n)===task)this.renderTasks.delete(n);
   if(canvas&&!installed){canvas.width=0;canvas.height=0;}
   el._pendingCanvases?.delete(canvas);
   if(el._renderGen===gen&&el.dataset.rendering===key)delete el.dataset.rendering;
  }
 }
}
export function pdfSplitValue(){const raw=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--pdf-left'));return Number.isFinite(raw)?Math.round(raw*1000)/100000:0.5;}
export function setPdfSplitPct(value){document.documentElement.style.setProperty('--pdf-left',`${Math.round(Math.max(.2,Math.min(.8,value))*1000)/10}%`);}
export function makePdfDivider(){
 const div=build(pdfPage.divider(),{});
 const first=$('#pdf-grid').firstElementChild;
 if(first)first.after(div);else $('#pdf-grid').append(div);
 bindPointerDrag(div,e=>{const grid=$('#pdf-grid').getBoundingClientRect();setPdfSplitPct((e.clientX-grid.left)/grid.width);},save);
 div.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();setPdfSplitPct(pdfSplitValue()+(e.key==='ArrowLeft'?-.02:.02));save();});
 return div;
}
