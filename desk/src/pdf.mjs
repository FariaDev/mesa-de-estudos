import * as pdfjs from '../node_modules/pdfjs-dist/build/pdf.mjs';
import {icon} from '../icons.mjs';
import {$,S,toast,save,updateContextSummary,updateWindowTitle} from './state.mjs';
import {addAttachments,hideQuoteButton,MAX_ATTACH,MAX_ATTACH_BYTES} from './chat.mjs';
import findCore from './generated/find.core.js';
import pdfView from './generated/pdfview.core.js';
import pdfPage from './generated/pdfpageview.core.js';
import {build,renderInto,renderChildren} from './view-host.mjs';
pdfjs.GlobalWorkerOptions.workerSrc=new URL('../node_modules/pdfjs-dist/build/pdf.worker.mjs',import.meta.url).href;
// Dobra de acento que preserva o comprimento da string (índices continuam válidos
// para o destaque): minúsculas + acentos pt-BR → letra base.
const FOLD_MAP={á:'a',à:'a',â:'a',ã:'a',ä:'a',å:'a',é:'e',è:'e',ê:'e',ë:'e',í:'i',ì:'i',î:'i',ï:'i',ó:'o',ò:'o',ô:'o',õ:'o',ö:'o',ú:'u',ù:'u',û:'u',ü:'u',ç:'c',ñ:'n',ý:'y',ÿ:'y'};
export function foldSearch(text){return String(text??'').toLowerCase().replace(/[áàâãäåéèêëíìîïóòôõöúùûüçñýÿ]/g,ch=>FOLD_MAP[ch]||ch);}
// Páginas com ocorrências no formato do artefato Bend (`PageHits{page,count}`; Nat = BigInt).
const hitsList=hits=>hits.reduceRight((tail,{page,count})=>({$:'Con',head:{page:BigInt(page),count:BigInt(count)},tail}),{$:'Nil'});
function findFacts(term,pages,total,page){
 if(!term||!total)return{hidden:true,shown:false,index:0n,total:0n};
 const out=findCore.findCount(hitsList(pages),BigInt(page));
 const hidden=out.$==='Hidden',shown=out.$==='Shown';
 return{hidden,shown,index:shown?out.index:0n,total:hidden?0n:out.total};
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
  const loading=pdfjs.getDocument({data:bytes,standardFontDataUrl:new URL('../node_modules/pdfjs-dist/standard_fonts/',import.meta.url).href,cMapUrl:new URL('../node_modules/pdfjs-dist/cmaps/',import.meta.url).href,cMapPacked:true});
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
// Andaime `data-icon` do núcleo vira SVG do host (mesma convenção do main.mjs).
// Inclui o próprio root: o `swapInto` do botão de colapsar passa o botão (e não
// o painel) e `querySelectorAll` não enxerga o elemento raiz.
function iconize(root){
 const targets=root.matches?.('[data-icon]')?[root,...root.querySelectorAll('[data-icon]')]:[...root.querySelectorAll('[data-icon]')];
 for(const el of targets){
  const name=el.dataset.icon,label=el.textContent;
  el.removeAttribute('data-icon');
  el.innerHTML=icon(name)+(label?` <span>${label}</span>`:'');
 }
}
// O aplicador não faz diff: a região trocada é substituída pela árvore nova.
function swapInto(oldEl,node,handlers){const next=build(node,handlers);oldEl.replaceWith(next);iconize(next);return next;}
export class PdfPanel {
 constructor(index,label){
  Object.assign(this,{index,label,page:1,zoom:1,scrollX:0,scrollY:0,invert:false,minimized:false,findOpen:false,loading:false,path:null,doc:null,renderTasks:new Map(),pageEls:[],version:0,_renderSeq:0,docMemo:new Map(),findTerm:'',findPages:[],findTotal:0,textDoc:null,textPages:null});
  this.handlers={
   OpenDoc:e=>this.load(e.currentTarget.value),
   OpenFile:()=>this.openFile(),
   ToggleFind:()=>this.setFind(this.q('.pdf-find').hidden),
   PageShot:()=>this.pageShot(),
   ToggleCollapse:()=>this.toggleMinimized(),
   ToggleInvert:()=>this.toggleInvert(),
   Prev:()=>this.goto(this.page-1),
   Next:()=>this.goto(this.page+1),
   GotoPage:e=>this.goto(Number(e.currentTarget.value)),
   ZoomOut:()=>this.nudgeZoom(-.2),
   ZoomIn:()=>this.nudgeZoom(.2),
   Fit:()=>this.fitWidth(),
   Find:e=>this.find(e)
  };
  this.el=build(pdfPage.panelShell(this.shellFacts()),this.handlers);
  iconize(this.el);
  $('#pdf-grid').append(this.el);this.q=s=>this.el.querySelector(s);
  // O contrato antigo já nascia com `aria-pressed="false"` no botão de inverter
  // (o `load` e o `toggleInvert` continuam atualizando o mesmo atributo).
  this.q('.invert').setAttribute('aria-pressed',String(!!this.invert));
  this.paintViewport();
  renderInto(this.q('.page-total'),pdfView.pageTotalEmpty());
  renderInto(this.q('.zoom-label'),pdfView.zoomLabel(100n));
  this.populate();
  const box=this.q('.pdf-viewport');
  box.addEventListener('pointerdown',()=>this.el.focus());
  box.addEventListener('scroll',()=>{if(this._layingOut)return;this.scrollX=box.scrollLeft;this.scrollY=box.scrollTop;this.updateCurrentPage();this.renderVisible();hideQuoteButton();save();},{passive:true});
  box.addEventListener('wheel',e=>{if(e.ctrlKey||e.metaKey){e.preventDefault();this.nudgeZoom(e.deltaY>0?-.2:.2);}},{passive:false});
  this.resize=new ResizeObserver(()=>{const w=box.clientWidth;if(w===this._width)return;this._width=w;this.rememberScroll();clearTimeout(this.resizeTimer);this.resizeTimer=setTimeout(()=>this.render(),120);});this.resize.observe(box);
 }
 // Fatos do painel para o núcleo: rótulo, biblioteca, documento atual e os
 // estados de minimizar/busca (a `pinned` é do `state.mjs`, depois do build).
 shellFacts(){return{$:'PdfShell',label:this.label,options:this.optionList(),path:this.path||'',minimized:!!this.minimized,findOpen:!!this.findOpen};}
 optionList(){return bendList((S.library||[]).map(p=>({$:'PdfOption',name:String(p.name??''),path:String(p.path??'')})));}
 readerState(){return this.loading?{$:'PdfLoading'}:this.doc?{$:'PdfReady'}:{$:'PdfEmpty'};}
 // Estado → miolo (`None` = carregando/erro não mexem no documento, como no Electron).
 paintViewport(){
  const out=pdfPage.viewport(this.readerState(),{$:'Nil'});
  if(out.$==='Some')renderInto(this.q('.pdf-viewport'),out.value);
 }
 populate(){const selected=this.path;renderChildren(this.q('.pdf-select'),pdfPage.optionNodes(this.optionList(),this.path||''));if(selected)this.q('.pdf-select').value=selected;}
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
   if(blob.size>MAX_ATTACH_BYTES){toast('A página ficou grande demais para anexar.');return;}
   if(S.attachments.length>=MAX_ATTACH){toast(`Máximo de ${MAX_ATTACH} imagens por mensagem.`);return;}
   const name=(this.path.split(/[/\\]/).at(-1)||'').replace(/\.pdf$/i,'')||'pagina';
   if(await addAttachments([new File([blob],`${name}-p${n}.png`,{type:'image/png'})]))toast(`Página ${n} anexada ao chat.`);
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
   const limit=Math.min(doc.numPages,400);if(doc.numPages>limit)toast('Busca limitada às primeiras 400 páginas deste PDF.');
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
   if(!total){toast('Texto não encontrado. PDFs digitalizados podem não ter texto pesquisável.');return;}
   const hit=findCore.cycleTarget(cycle,hitsList(this.findPages),BigInt(this.page));
   const target=hit.$==='Some'?Number(hit.value):this.findPages[0].page;
   this.goto(target);
   toast(cycle?`Ocorrência na página ${target}.`:`Encontrado na página ${target}.`);
  }catch(e){toast(e.message);}
  finally{button.disabled=false;button.textContent='Buscar';}
 }
 toggleInvert(){this.invert=!this.invert;this.q('.pdf-viewport').classList.toggle('inverted',this.invert);this.q('.invert').setAttribute('aria-pressed',String(this.invert));save(true);}
 toggleMinimized(value){
  this.minimized=value===undefined?!this.minimized:!!value;
  const other=S.panels.find(p=>p!==this);
  const panel=pdfView.panelFlags(this.minimized,this.el.classList.contains('pinned'));
  this.el.classList.toggle('minimized',panel.minimized);
  this.el.classList.toggle('pinned',panel.pinned);
  // Só o botão de colapsar muda com o fato `minimized`: trocar só ele preserva
  // o foco do teclado (e de outros controles da barra) — o render da barra
  // inteira jogava o foco no `<body>` (achado da revisão independente).
  const collapse=this.q('.collapse');
  if(collapse){
   const hadFocus=document.activeElement===collapse;
   swapInto(collapse,pdfPage.collapseBtn(this.minimized),this.handlers);
   if(hadFocus)this.q('.collapse')?.focus();
  }
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
 async load(path,settings={}){if(!path)return;if(this.path&&this.doc)this.docMemo.set(this.path,{page:this.page,zoom:this.zoom,scrollX:this.scrollX,scrollY:this.scrollY,invert:this.invert});const id=++this.version;this.cancelRenders();this.textDoc=null;this.textPages=null;const memo=Object.prototype.hasOwnProperty.call(settings,'zoom')?null:this.docMemo.get(path);const use=memo||settings;this.loading=true;this.path=path;this.page=Math.max(1,use.page||1);this.zoom=use.zoom||1;this.scrollX=use.scrollX||0;this.scrollY=use.scrollY||0;this.invert=!!use.invert;this.findTerm='';this.findPages=[];this.findTotal=0;this.q('.pdf-select').value=path;this.updateFindCount();this.q('.pdf-viewport').classList.toggle('inverted',this.invert);this.q('.invert').setAttribute('aria-pressed',String(this.invert));this.paintViewport();renderInto(this.q('.pdf-foot'),pdfView.footLoading());try{const {doc}=await cachedPdf(path);if(id!==this.version)return;this.doc=doc;this.page=Math.max(1,Math.min(doc.numPages,this.page));await this.render();this.loading=false;updateWindowTitle();save();}catch(e){this.loading=false;renderInto(this.q('.pdf-foot'),pdfView.footError());toast(e.message);}}
 goto(n){if(!this.doc)return;const page=Math.max(1,Math.min(this.doc.numPages,Math.trunc(n)||1));this.page=page;const target=this.pageEls[page-1];if(target&&target.isConnected&&target.offsetTop>0){const box=this.q('.pdf-viewport');box.scrollTo({top:Math.max(0,target.offsetTop-4),left:0,behavior:'auto'});this.scrollY=box.scrollTop;this.updatePageUI();this.renderVisible();save(true);return;}this.updatePageUI();this.renderVisible();save(true);}
 cancelRenders(){for(const task of this.renderTasks.values())try{task.cancel();}catch{}this.renderTasks.clear();}
 updatePageUI(){
  if(!this.doc)return;
  const page=BigInt(this.page),total=BigInt(this.doc.numPages),file=this.path.split(/[/\\]/).at(-1)||'';
  this.q('.page-number').value=pdfView.pageNumberValue(page);
  this.q('.page-number').max=pdfView.pageNumberMax(total);
  renderInto(this.q('.page-total'),pdfView.pageTotal(total));
  renderInto(this.q('.zoom-label'),pdfView.zoomLabel(BigInt(Math.round(this.zoom*100))));
  renderInto(this.q('.pdf-foot'),pdfView.footReady(page,total,pdfView.modeContinuous(),file));
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
 updateCurrentPage(){if(!this.pageEls.length||!this.el.isConnected)return;const box=this.q('.pdf-viewport');const center=box.scrollTop+box.clientHeight/2;let nearest=0,distance=Infinity;for(let i=0;i<this.pageEls.length;i++){const el=this.pageEls[i];const d=Math.abs(el.offsetTop+el.offsetHeight/2-center);if(d<distance){distance=d;nearest=i;}}const page=nearest+1;if(page!==this.page){this.page=page;this.updatePageUI();}}
 async render(){if(!this.doc||!this.el.offsetWidth)return;const seq=++this._renderSeq,doc=this.doc,box=this.q('.pdf-viewport');this.cancelRenders();const width=box.clientWidth;const style=getComputedStyle(box);const available=width-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight)-2;const boxes=[],viewports=[];try{for(let n=1;n<=doc.numPages;n++){const page=await doc.getPage(n);if(seq!==this._renderSeq||doc!==this.doc)return;const base=page.getViewport({scale:1});const scale=Math.max(.1,available/base.width)*this.zoom;const viewport=page.getViewport({scale});viewports.push(viewport);boxes.push({$:'PdfPageBox',n:BigInt(n),width:`${viewport.width}px`,height:`${viewport.height}px`});}if(seq!==this._renderSeq)return;this._layingOut=true;const frame=pdfPage.viewport({$:'PdfReady'},bendList(boxes));if(frame.$==='Some')renderInto(box,frame.value);this.pageEls=[...box.querySelectorAll('.pdf-page')];for(let i=0;i<this.pageEls.length;i++)this.pageEls[i]._viewport=viewports[i];box.scrollLeft=this.scrollX;box.scrollTop=this.scrollY;const target=this.pageEls[this.page-1];if(target){const top=Math.max(0,target.offsetTop-4),bottom=target.offsetTop+target.offsetHeight;if(box.scrollTop<top-1||box.scrollTop>bottom){box.scrollTop=top;this.scrollY=box.scrollTop;}}this.updatePageUI();this.renderVisible();requestAnimationFrame(()=>{this._layingOut=false;this.updateCurrentPage();});}catch(e){this._layingOut=false;if(e.name!=='RenderingCancelledException')toast('Erro ao preparar PDF: '+e.message);}}
 renderVisible(){if(!this.doc||!this.pageEls.length)return;cancelAnimationFrame(this._visibleFrame);this._visibleFrame=requestAnimationFrame(()=>{if(!this.el.isConnected)return;const box=this.q('.pdf-viewport'),top=box.scrollTop-box.clientHeight,bottom=box.scrollTop+box.clientHeight*2;for(let i=0;i<this.pageEls.length;i++){const el=this.pageEls[i];if(el.offsetTop+el.offsetHeight>=top&&el.offsetTop<=bottom)this.renderPage(i+1,el);}});}
 async renderPage(n,el){if(!this.el.isConnected||!el.isConnected)return;const key=`${this.version}:${this.zoom}:${window.devicePixelRatio||1}`;if(el.dataset.rendered===key||el.dataset.rendering===key)return;el.dataset.rendering=key;try{const page=await this.doc.getPage(n),viewport=el._viewport,dpr=window.devicePixelRatio||1;let output=Math.max(dpr,2);const maxPx=16777216,need=viewport.width*output*viewport.height*output;if(need>maxPx)output=Math.sqrt(maxPx/(viewport.width*viewport.height));const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width*output);canvas.height=Math.ceil(viewport.height*output);canvas.style.width=`${viewport.width}px`;canvas.style.height=`${viewport.height}px`;const task=page.render({canvasContext:canvas.getContext('2d',{alpha:false}),viewport,transform:output===1?null:[output,0,0,output,0,0],intent:'display'});this.renderTasks.set(n,task);await task.promise;if(this.renderTasks.get(n)===task)this.renderTasks.delete(n);if(el.dataset.rendering!==key||!el.isConnected)return;let layer=null;try{layer=document.createElement('div');layer.className='textLayer';layer.style.setProperty('--total-scale-factor',String(viewport.scale));const tl=new pdfjs.TextLayer({textContentSource:await page.getTextContent(),container:layer,viewport});await tl.render();if(!layer.querySelector('span'))layer=null;}catch{layer=null;}if(el.dataset.rendering!==key||!el.isConnected)return;el.replaceChildren(canvas);if(layer){if(this.findTerm)this.highlightLayer(layer);el.append(layer);}el.dataset.rendered=key;}catch(e){if(e.name!=='RenderingCancelledException')toast(`Erro ao renderizar a página ${n}: ${e.message}`);}finally{if(el.dataset.rendering===key)delete el.dataset.rendering;}}
}
export function pdfSplitValue(){const raw=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--pdf-left'));return Number.isFinite(raw)?Math.round(raw*1000)/100000:0.5;}
export function setPdfSplitPct(value){document.documentElement.style.setProperty('--pdf-left',`${Math.round(Math.max(.2,Math.min(.8,value))*1000)/10}%`);}
export function makePdfDivider(){
 const div=build(pdfPage.divider(),{});
 const first=$('#pdf-grid').firstElementChild;
 if(first)first.after(div);else $('#pdf-grid').append(div);
 let drag=false;
 div.addEventListener('pointerdown',e=>{drag=true;div.setPointerCapture(e.pointerId);});
 div.addEventListener('pointermove',e=>{if(!drag)return;const grid=$('#pdf-grid').getBoundingClientRect();setPdfSplitPct((e.clientX-grid.left)/grid.width);});
 div.addEventListener('pointerup',()=>{drag=false;save();});
 div.addEventListener('pointercancel',()=>{drag=false;});
 div.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();setPdfSplitPct(pdfSplitValue()+(e.key==='ArrowLeft'?-.02:.02));save();});
 return div;
}
