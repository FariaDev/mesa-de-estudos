import {$,S,toast} from './state.mjs';
import {htmlNode,renderInto} from './view-host.mjs';
import {renderMaterialHtml,prepareMaterialMarkdown,checkMaterialMath,materialRevision,measureMaterialModel,MATERIAL_TEMPLATE_VERSION} from './materials/template.mjs';
import {draftModel,modelLabel,statusPhrase,pageOf} from './materials/model.mjs';
import {t,text as translated} from './ui-text.mjs';
import {message} from './i18n.mjs';
import {displayFreeTitle} from './free-names.mjs';
import {FREE_COURSE_ID,api,extractData,freeState,isFree,workspaceOf} from './free-study-base.mjs';
import {applyData,assistantSources,flushState,notice,setBarBusy,setDialogBusy} from './free-study-chrome.mjs';

/* Aba Livre — gerar PDF: fonte (respostas do tutor), modelo, prévia fiel
   com páginas, verificação e salvar; também adicionar material.
   Saiu de free-study.mjs na #43 fase 2. */

function materialPreviewApi(name){
 for(const target of [window.desk,window.deskFreeBridge]){
  const fn=target&&typeof target[name]==='function'?target[name]:null;
  if(fn)return fn.bind(target);
 }
 return null;
}
const MATERIAL_STYLES=['pdf-template','pdf-models','pdf-model-lista','pdf-model-apostila','pdf-model-resumo','pdf-model-simulado','pdf-model-formulario'];
function ensureMaterialStyles(){
 for(const name of MATERIAL_STYLES){
  if(document.querySelector(`link[href$="materials/${name}.css"]`))continue;
  const link=document.createElement('link');
  link.rel='stylesheet';
  if(name==='pdf-template')link.dataset.materialTemplate='1';
  else link.dataset.materialModel=name;
  link.href=new URL(`src/materials/${name}.css`,document.baseURI).href;
  document.head.append(link);
 }
}
function previewStatusNode(){
 let node=$('#free-pdf-math-status');
 if(node)return node;
 const anchor=$('#free-pdf-form .pdf-options')||$('#free-pdf-preview');
 if(!anchor)return null;
 node=document.createElement('p');
 node.id='free-pdf-math-status';node.className='material-status';node.setAttribute('role','alert');node.hidden=true;
 anchor.before(node);
 return node;
}
function previewPagesNode(){
 let node=$('#free-pdf-pages');
 if(node)return node;
 const box=$('#free-pdf-preview');
 if(!box)return null;
 node=document.createElement('div');
 node.id='free-pdf-pages';node.className='material-pages';node.hidden=true;
 box.after(node);
 return node;
}
function invalidatePreview(){
 if(freeState.previewJob){
  const job=freeState.previewJob,requestId=job.requestId;freeState.previewJob=null;
  try{job.renderTask?.cancel();}catch{/* já encerrou */}
  try{job.loadingTask?.destroy().catch(()=>{});}catch{/* já encerrou */}
  const cancel=materialPreviewApi('materialPreviewCancel');
  if(cancel){try{const pending=cancel({requestId});if(pending&&typeof pending.catch==='function')pending.catch(()=>{});}catch{/* já foi */}}
 }
 const pages=$('#free-pdf-pages');
 if(pages){pages.replaceChildren();pages.hidden=true;}
 const box=$('#free-pdf-preview');
 if(box)box.hidden=false;
}
function selectMaterialSource(source){
 const area=$('#free-pdf-content');
 if(!area||!source)return;
 const needle=String(source).replace(/^\$\$/,'').replace(/\$\$$/,'').replace(/^\$/,'').replace(/\$$/,'');
 const index=area.value.indexOf(needle);
 if(index<0)return;
 area.focus();area.setSelectionRange(index,index+needle.length);
}
function showMaterialDiagnostics(diagnostics){
 const node=previewStatusNode();
 if(!node)return;
 const list=Array.isArray(diagnostics)?diagnostics:[];
 const errors=list.filter(entry=>entry&&entry.severity==='error');
 const warnings=list.filter(entry=>entry&&entry.severity==='warning');
 node.replaceChildren();
 if(!errors.length&&!warnings.length){node.hidden=true;return;}
 node.hidden=false;
 const heading=document.createElement('strong');
 if(errors.length){
  heading.textContent=t('free.math.errors',{count:errors.length});
  node.append(heading);
  const listNode=document.createElement('ul');
  for(const error of errors.slice(0,5)){
   const item=document.createElement('li');
   const button=document.createElement('button');
   button.type='button';
   button.textContent=String(error.source||'').slice(0,60)||t('free.math.badSnippet');
   button.title=translated(String(error.message||''));
   button.onclick=()=>selectMaterialSource(error.source);
   item.append(button,' — ',document.createTextNode(translated(String(error.message||''))));
   listNode.append(item);
  }
  node.append(listNode);
 } else {
  heading.textContent=t('free.math.warnings',{count:warnings.length});
  node.append(heading);
 }
}
function fitPreviewZoom(box){
 const page=box.querySelector('.pdf-page');
 if(!page)return;
 page.style.zoom='1';
 const style=getComputedStyle(box);
 const available=box.clientWidth-(parseFloat(style.paddingLeft)||0)-(parseFloat(style.paddingRight)||0);
 const width=page.offsetWidth||794;
 if(!available||!width)return;
 const scale=Math.min(1,Math.max(.35,available/width));
 page.style.zoom=String(Math.round(scale*1000)/1000);
}
function pdfContext(){return isFree()?'':String(freeState.lastData?.course||'');}
function pdfModelNow(){return freeState.modelPanel?freeState.modelPanel.get():{model:'livre',options:{}};}
function paintModelStatus(){
 const {model}=pdfModelNow();
 const status=$('#free-pdf-status');
 if(status){const phrase=translated(statusPhrase(freeState.modelSource,model));status.textContent=phrase;status.title=phrase;}
 const label=$('#free-pdf-view-label');
 if(label)label.textContent=t('free.preview.label',{model:translated(modelLabel(model))});
}
function paintCounts(segments,errors){
 const node=$('#free-pdf-counts');
 if(!node)return;
 const formulas=(Array.isArray(segments)?segments:[]).filter(segment=>segment&&segment.type==='math').length;
 const bad=Array.isArray(errors)?errors.length:0;
 let text=formulas===0?t('free.counts.none'):t('free.counts.formulas',{count:formulas});
 if(bad)text+=', '+t('free.counts.bad',{count:bad});
 node.textContent=text;
}
function mmPx(host,length){
 const probe=document.createElement('div');
 probe.setAttribute('aria-hidden','true');
 probe.style.cssText=`position:absolute;visibility:hidden;pointer-events:none;height:0;width:${length};`;
 host.append(probe);
 const width=probe.getBoundingClientRect().width;
 probe.remove();
 return width;
}
/* Páginas mostradas no cabeçalho da prévia: o total vem do PDF real quando há
   ("Ver PDF" ou a prévia automática) e é estimativa pela altura do HTML antes. */
const pageView={total:1,exact:false};
function paintPageIndicator(){
 const label=$('#free-pdf-page-count');
 if(!label)return;
 const scroll=document.querySelector('#free-pdf-form .pdf-view-scroll');
 const canvases=[...document.querySelectorAll('#free-pdf-pages canvas')];
 let current=1;
 if(scroll){
  const probe=scroll.scrollTop+scroll.clientHeight/3;
  if(canvases.length&&!$('#free-pdf-pages').hidden){
   canvases.forEach((canvas,index)=>{if(canvas.offsetTop-scroll.offsetTop<=probe)current=index+1;});
  }else if(pageView.total>1&&scroll.scrollHeight>0){
   current=Math.min(pageView.total,Math.floor(probe/(scroll.scrollHeight/pageView.total))+1);
  }
 }
 label.textContent=translated(pageOf(current,pageView.total));
 if(pageView.exact){label.removeAttribute('data-estimate');label.removeAttribute('title');}
 else{label.dataset.estimate='1';label.title=t('free.preview.estimate');}
}
function setPageTotal(total,exact){
 pageView.total=Math.max(1,Math.trunc(Number(total)||1));
 pageView.exact=exact===true;
 paintPageIndicator();
}
/* Mede o modelo na prévia (colunas do Auto, "caber numa folha") com a escala
   em 1: a medida é do papel, não da caixa do diálogo. */
function measureModelPreview(box,token){
 const wrapper=box.querySelector('.pdf-model');
 const page=box.querySelector('.pdf-page');
 if(!wrapper||!page||!freeState.modelPanel)return;
 const zoom=page.style.zoom;
 page.style.zoom='1';
 try{
  const height=mmPx(wrapper,getComputedStyle(wrapper).getPropertyValue('--page-h').trim()||'253mm');
  const choice=wrapper.dataset.colsChoice;
  if(choice&&choice!=='auto'){
   wrapper.dataset.colsChoice='auto';
   const probe=measureMaterialModel(box,{availableHeightPx:0});
   wrapper.dataset.colsChoice=choice;
   freeState.modelPanel.setAuto(probe?probe.columns:0);
  }
  const result=measureMaterialModel(box,{availableHeightPx:height});
  if(result&&(!choice||choice==='auto'))freeState.modelPanel.setAuto(result.auto?result.columns:0);
  if(!result||!result.columns)freeState.modelPanel.setAuto(0);
  if(result&&result.fit&&!result.fit.fits&&token===freeState.previewToken)notice('#free-pdf-error',t('free.preview.noFit'),'note');
  else if(token===freeState.previewToken&&$('#free-pdf-error').classList.contains('free-note'))notice('#free-pdf-error','','note');
 }finally{
  page.style.zoom=zoom;
 }
}
/* Estimativa pela altura do HTML: o gabarito em página separada começa folha
   nova. A paginação real vem do PDF (prévia automática ou Ver PDF). */
function estimatePages(box){
 const page=box.querySelector('.pdf-page');
 const doc=box.querySelector('.pdf-doc');
 if(!page||!doc)return 1;
 const zoom=page.style.zoom;
 page.style.zoom='1';
 try{
  const wrapper=box.querySelector('.pdf-model')||doc;
  const pageHeight=mmPx(doc,getComputedStyle(wrapper).getPropertyValue('--page-h').trim()||'259mm');
  if(!pageHeight)return 1;
  const total=doc.scrollHeight;
  const apart=doc.querySelector('.pdf-gabarito[data-break="1"]');
  if(apart){
   const at=Math.min(total,apart.getBoundingClientRect().top-doc.getBoundingClientRect().top);
   return Math.max(1,Math.ceil(at/pageHeight))+Math.max(1,Math.ceil((total-at)/pageHeight));
  }
  return Math.max(1,Math.ceil(total/pageHeight));
 }finally{
  page.style.zoom=zoom;
 }
}
function updatePdfPreview(){
 const box=$('#free-pdf-preview');
 if(!box)return;
 const title=String($('#free-pdf-title')?.value||'').trim();
 const text=$('#free-pdf-content').value;
 const {model,options}=pdfModelNow();
 invalidatePreview();
 paintModelStatus();
 const token=++freeState.previewToken;
 if(!text.trim()){
  const hint=document.createElement('p');
  hint.className='fine';
  hint.textContent=t('free.preview.empty');
  box.replaceChildren(hint);
  showMaterialDiagnostics([]);
  paintCounts([],[]);
  setPageTotal(1,false);
  return;
 }
 let html,diagnostics;
 try{
  const prepared=prepareMaterialMarkdown({title,markdown:text});
  const math=checkMaterialMath(prepared.markdown);
  diagnostics=[...prepared.diagnostics,...math.diagnostics];
  paintCounts(math.segments,math.errors);
  html=renderMaterialHtml({title,markdown:text,model,options,context:pdfContext()}).html;
 }catch(error){
  const hint=document.createElement('p');
  hint.className='fine';
  hint.textContent=t('free.preview.failed',{reason:translated(String(error&&error.message||error))});
  box.replaceChildren(hint);
  return;
 }
 /* Mesmo HTML/CSS da impressão, em papel A4 escalado para a caixa. */
 renderInto(box,htmlNode(`<div class="pdf-page" data-model="${model}"><div class="pdf-doc">${html}</div></div>`));
 measureModelPreview(box,token);
 fitPreviewZoom(box);
 showMaterialDiagnostics(diagnostics);
 setPageTotal(estimatePages(box),false);
 /* Fontes que chegam depois mudam larguras: mede de novo uma vez. */
 if(document.fonts&&document.fonts.ready){
  document.fonts.ready.then(()=>{
   if(token!==freeState.previewToken||!$('#free-pdf-dialog')?.open)return;
   measureModelPreview(box,token);
   fitPreviewZoom(box);
  }).catch(()=>{});
 }
}
/* Trocar de modelo ou de opção refaz a prévia na hora; a prévia real (o PDF
   que a Mesa gera) vem logo atrás, sem clique, e a edição de texto a descarta. */
function onModelChange(){
 freeState.modelSource='changed';
 updatePdfPreview();
 scheduleRealPreview();
}
function scheduleRealPreview(){
 clearTimeout(freeState.realPreviewTimer);
 freeState.realPreviewTimer=setTimeout(()=>{
  if(!$('#free-pdf-dialog')?.open||freeState.inflight)return;
  verifyPdf({auto:true}).catch(()=>{});
 },600);
}
function previewStillCurrent(job){
 return freeState.previewJob===job&&$('#free-pdf-dialog')?.open&&
  $('#free-pdf-title').value.trim()===job.title&&$('#free-pdf-content').value===job.markdown;
}
async function renderPreviewPages(bytes,job){
 const pages=previewPagesNode();
 if(!pages)return 0;
 const data=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes||0);
 if(!data.length)throw Error(message('free.preview.noPdf'));
 const pdfjs=await import('../node_modules/pdfjs-dist/build/pdf.mjs');
 if(!previewStillCurrent(job))return 0;
 if(!pdfjs.GlobalWorkerOptions.workerSrc)pdfjs.GlobalWorkerOptions.workerSrc=new URL('../node_modules/pdfjs-dist/build/pdf.worker.mjs',import.meta.url).href;
 job.loadingTask=pdfjs.getDocument({data,useWorkerFetch:false,isEvalSupported:false});
 const loaded=await job.loadingTask.promise;
 try{
  if(!previewStillCurrent(job))return 0;
  const fragment=document.createDocumentFragment();
  for(let number=1;number<=loaded.numPages;number+=1){
   const page=await loaded.getPage(number);
   if(!previewStillCurrent(job))return 0;
   const viewport=page.getViewport({scale:1});
   const canvas=document.createElement('canvas');
   canvas.className='material-page-canvas';
   canvas.width=Math.floor(viewport.width);canvas.height=Math.floor(viewport.height);
   job.renderTask=page.render({canvasContext:canvas.getContext('2d'),viewport});
   await job.renderTask.promise;
   job.renderTask=null;
   if(!previewStillCurrent(job))return 0;
   fragment.append(canvas);
  }
  if(!previewStillCurrent(job))return 0;
  pages.replaceChildren(fragment);
  pages.hidden=false;
  return loaded.numPages;
 }finally{
  /* O `PDFDocumentProxy` não tem `destroy`: quem encerra é a tarefa de carga. */
  try{await job.loadingTask?.destroy();}catch{/* já encerrou */}
 }
}
/* Gera os bytes da revisão atual pelo host (`renderPdf`), desenha as páginas
   reais com pdf.js e descarta tudo que chegou fora de hora. */
async function verifyPdf({auto=false}={}){
 const dialog=$('#free-pdf-dialog');
 if(!dialog||!dialog.open||freeState.inflight)return;
 const title=$('#free-pdf-title').value.trim();
 const markdown=$('#free-pdf-content').value;
 const {model,options}=pdfModelNow();
 const context=pdfContext();
 if(!title){if(!auto)notice('#free-pdf-error',t('free.title.required'));return;}
 if(!markdown.trim()){if(!auto)notice('#free-pdf-error',t('free.content.required'));return;}
 const prepared=prepareMaterialMarkdown({title,markdown});
 const local=checkMaterialMath(prepared.markdown);
 const localDiagnostics=[...prepared.diagnostics,...local.diagnostics];
 if(local.errors.length){
  showMaterialDiagnostics(localDiagnostics);
  if(!auto)notice('#free-pdf-error',translated(local.errors[0].message));
  return;
 }
 const preview=materialPreviewApi('materialPreview');
 if(!preview){
  if(!auto)notice('#free-pdf-error',t('free.preview.needHost'));
  return;
 }
 const revision=materialRevision({title,markdown,model,options,context});
 const requestId='pv-'+Math.random().toString(36).slice(2,10)+Date.now().toString(36);
 invalidatePreview();
 const job={requestId,revision,title,markdown};freeState.previewJob=job;
 const button=$('#free-pdf-verify');
 if(button)button.disabled=true;
 if(!auto)notice('#free-pdf-error','','note');
 try{
  const result=await preview({title,markdown,revision,requestId,model,options});
  const current=$('#free-pdf-content').value,currentTitle=$('#free-pdf-title').value.trim();
  /* O host devolve `requestId`/`revision`/`templateHash`: confere os três antes
     de desenhar os bytes (a revisão precisa continuar ativa e no mesmo template). */
  const echoed=result&&result.requestId===requestId&&result.revision===revision;
  const sameTemplate=!result||!result.templateHash||result.templateHash===MATERIAL_TEMPLATE_VERSION;
  const now=pdfModelNow();
  if(!previewStillCurrent(job)||!echoed||!sameTemplate||materialRevision({title:currentTitle,markdown:current,model:now.model,options:now.options,context:pdfContext()})!==revision)return;
  const pdf=result&&(result.pdf||result.bytes);
  if(!pdf){if(!auto)notice('#free-pdf-error',t('free.preview.notReturned'));return;}
  const hostDiagnostics=Array.isArray(result.diagnostics)?result.diagnostics.filter(entry=>entry&&entry.severity!=='info'):[];
  if(hostDiagnostics.length)showMaterialDiagnostics([...localDiagnostics,...hostDiagnostics]);
  const numPages=await renderPreviewPages(pdf,job);
  if(freeState.previewJob&&freeState.previewJob.requestId===requestId&&numPages){
   if(freeState.modelPanel&&result.columnsAuto===true)freeState.modelPanel.setAuto(result.columns);
   const box=$('#free-pdf-preview');
   if(box)box.hidden=true;
   setPageTotal(numPages,true);
   if(!auto)toast(t('free.preview.real',{count:numPages}));
  }
 }catch(error){
  if(!auto&&freeState.previewJob&&freeState.previewJob.requestId===requestId)notice('#free-pdf-error',error&&error.message?translated(error.message):t('free.preview.realFail'));
 }finally{
  if(freeState.previewJob&&freeState.previewJob.requestId===requestId)freeState.previewJob=null;
  if(button&&!freeState.previewJob)button.disabled=false;
 }
}
function openPdfDialog(draft=null){
 if(freeState.inflight==='free-open'||freeState.inflight==='pdf-save')return;
 freeState.sources=draft?[{raw:draft.markdown,preview:t('free.pdf.draftSource')}]:assistantSources();
 const dialog=$('#free-pdf-dialog');dialog._pdfDraftId=draft?.id||'';
 dialog.querySelector('h2').textContent=draft?t('free.pdf.draftHeading'):t('free.pdf.buildHeading');
 dialog.querySelector('.help-lead').textContent=draft?t('free.pdf.draftLead'):t('free.pdf.lead');
 const select=$('#free-pdf-source');
 select.replaceChildren();
 if(freeState.sources.length){
  freeState.sources.forEach((source,index)=>select.append(new Option(draft?t('free.pdf.draftSource'):t('free.pdf.answerOption',{number:index+1,preview:source.preview||t('free.pdf.noText')}),String(index))));
  select.disabled=false;
  select.value=String(freeState.sources.length-1);
 }else{
  select.append(new Option(t('free.pdf.noAnswers'),''));
  select.disabled=true;
 }
 const workspace=workspaceOf(freeState.lastData)||{};
 $('#free-pdf-title').value=draft?.title||displayFreeTitle(String(workspace.title||'').trim())||(isFree()?t('free.pdf.titlePlaceholder'):t('free.pdf.defaultTitleCourse',{course:freeState.lastData?.course||t('free.pdf.studyFallback')}));
 $('#free-pdf-content').value=freeState.sources.length?freeState.sources[freeState.sources.length-1].raw:'';
 notice('#free-pdf-error','');
 /* Modelo inicial: o do rascunho do tutor (com a origem da escolha) ou o último
    desta matéria/sessão; sem nenhum dos dois, Livre como sempre foi. */
 clearTimeout(freeState.realPreviewTimer);
 const kept=freeState.lastData&&freeState.lastData.pdfModel&&typeof freeState.lastData.pdfModel==='object'?freeState.lastData.pdfModel:null;
 let chosen;
 if(draft&&draft.model){chosen=draftModel(draft);freeState.modelSource=chosen.modelSource;}
 else if(kept&&kept.model){chosen=draftModel({model:kept.model,options:kept.options});freeState.modelSource='last';}
 else{chosen=draftModel({});freeState.modelSource='default';}
 freeState.modelPanel?.set(chosen.model,chosen.options);
 $('#free-pdf-dialog').showModal();
 /* Com o diálogo aberto a caixa tem largura: a escala da folha e a medição
    do Auto dependem dela. */
 updatePdfPreview();
 $('#free-pdf-title').focus();
 if(chosen.model!=='livre')scheduleRealPreview();
}
function openAddMaterial(){
 if(!isFree()||freeState.inflight)return;
 const materials=workspaceOf(freeState.lastData)?.materials||[],courses=(freeState.lastData?.courses||[]).filter(c=>c.id!==FREE_COURSE_ID);
 if(!materials.length){toast(t('free.add.needMaterial'));return;}
 if(!courses.length){toast(t('free.add.needCourse'));return;}
 const pdfs=$('#free-add-pdf'),targets=$('#free-add-course');
 pdfs.replaceChildren(...materials.map(m=>new Option(m.name,m.id)));
 const current=materials.find(m=>m.path===$('#free-materials').value||S.panels?.some(p=>p.path===m.path));if(current)pdfs.value=current.id;
 targets.replaceChildren(...courses.map(c=>new Option(c.name,c.id)));
 notice('#free-add-error','');$('#free-add-dialog').showModal();targets.focus();
}
async function addMaterial(){
 if(!isFree()||freeState.inflight)return;
 const gen=freeState.generation;freeState.inflight='add-material';setDialogBusy('#free-add-dialog',true);
 try{
  const result=await api('freeAddMaterial')({materialId:$('#free-add-pdf').value,courseId:$('#free-add-course').value});
  if(gen!==freeState.generation)return;
  if(!result?.added)throw Error(t('free.add.fail'));
  $('#free-add-dialog').close();toast(t('free.add.done',{material:result.material.name,course:result.material.courseName}));
 }catch(error){if(gen===freeState.generation)notice('#free-add-error',translated(error.message));}
 finally{freeState.inflight='';setDialogBusy('#free-add-dialog',false);}
}
async function savePdf(){
 if(freeState.inflight)return;
 const fn=api(isFree()?'freeSaveMaterial':'courseSaveMaterial');
 const title=$('#free-pdf-title').value.trim();
 const markdown=$('#free-pdf-content').value;
 if(!fn){
  notice('#free-pdf-error',t('free.save.needHost'));
  return;
 }
 if(!title){
  notice('#free-pdf-error',t('free.title.required'));
  return;
 }
 if(!markdown.trim()){
  notice('#free-pdf-error',t('free.content.required'));
  return;
 }
 if(S.busy){
  notice('#free-pdf-error',t('free.save.waitTutor'));
  return;
 }
 const gen=freeState.generation;
 /* Salvar sempre re-renderiza no host; a prévia anterior é descartada aqui. */
 clearTimeout(freeState.realPreviewTimer);
 invalidatePreview();
 freeState.inflight='pdf-save';
 setBarBusy(true);
 setDialogBusy('#free-pdf-dialog',true);
 try{
  if(!await flushState(gen))return;
  const {model,options}=pdfModelNow();
  const result=await fn({title,markdown,draftId:$('#free-pdf-dialog')._pdfDraftId||'',model,options});
  if(gen!==freeState.generation)return;
  if(!result||result.saved!==true){
   notice('#free-pdf-error',result&&result.error?translated(result.error):t('free.save.fail'));
   return;
  }
  const data=extractData(result);
  $('#free-pdf-dialog').close('ok');
  if(data&&!await applyData(data,gen))return;
  toast(t(isFree()?'free.save.doneFree':'free.save.doneCourse'));
 }catch(error){
  if(gen===freeState.generation)notice('#free-pdf-error',error&&error.message?translated(error.message):t('free.save.fail'));
 }finally{
  freeState.inflight='';
  setBarBusy(false);
  setDialogBusy('#free-pdf-dialog',false);
  if(!freeState.sources.length)$('#free-pdf-source').disabled=true;
 }
}

export {ensureMaterialStyles,invalidatePreview,showMaterialDiagnostics,fitPreviewZoom,paintPageIndicator,updatePdfPreview,onModelChange,verifyPdf,openPdfDialog,openAddMaterial,addMaterial,savePdf};
