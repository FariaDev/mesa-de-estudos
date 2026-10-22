import {$,S,toast,loadCourse,layoutSnapshot} from './state.mjs';
import {t,text as translated} from './ui-text.mjs';
import {displayFreeTitle} from './free-names.mjs';
import {FREE_COURSE_ID,FREE_DIALOGS,freeState,hasOpenPdf,isFreeData,mainOf,refsOf,workspaceOf} from './free-study-base.mjs';

/* Aba Livre — o cabeçalho da sessão (materiais, vazio orientado), a chegada
   dos dados do host com guarda de geração e os avisos dos diálogos.
   Saiu de free-study.mjs na #43 fase 2. */

function setEmpty(empty){
 const main=mainOf(),references=refsOf();
 main?.classList.toggle('free-empty',!!empty);
 references?.classList.toggle('free-empty',!!empty);
}
function renderMaterials(materials){
 const select=$('#free-materials');
 if(!select)return;
 const list=Array.isArray(materials)?materials.filter(material=>material&&(material.path||material.id||material.name)):[];
 const current=select.value;
 select.replaceChildren();
 if(!list.length){
  select.append(new Option(t('free.materials.none'),''));
  select.disabled=true;
  return;
 }
 select.disabled=false;
 select.append(new Option(t('free.materials.open'),''));
 for(const material of list){
  const value=String(material.path||material.id||'');
  if(!value)continue;
  select.append(new Option(String(material.name||material.id||value),value));
 }
 if([...select.options].some(option=>option.value===current))select.value=current;
}
function paint(data){
 let free=isFreeData(data);
 /* O host é autoritativo: com uma matéria real ativa, nenhum resíduo de
    payload mantém a aba Livre (defesa contra evento perdido/atrasado). */
 if(free&&S.currentCourseId&&S.currentCourseId!==FREE_COURSE_ID)free=false;
 const bar=$('#free-bar');
 if(bar)bar.hidden=!free;
 const pdfDraft=free?workspaceOf(data)?.pdfDraft:data.pdfDraft;
 showTutorPdfDraft(pdfDraft);
 const main=mainOf(),references=refsOf();
 main?.classList.toggle('workspace-free',free);
 references?.classList.toggle('workspace-free',free);
 if(!free){
  setEmpty(false);
  return;
 }
 const workspace=workspaceOf(data)||{};
 const input=$('#free-title');
 /* O título é do usuário: só espelha o dado quando o campo não está em edição. */
 if(input&&document.activeElement!==input){
  const title=displayFreeTitle(String(workspace.title||''));
  if(input.value!==title)input.value=title;
 }
 renderMaterials(workspace.materials);
 setEmpty(!hasOpenPdf());
}
/* O `loadCourse` avisa o chrome antes de terminar de carregar os PDFs (os
   caminhos entram logo depois, no mesmo tick): repintar no próximo frame pega o
   estado real sem piscar o vazio. */
function schedulePaint(){
 cancelAnimationFrame(freeState.paintFrame);
 freeState.paintFrame=requestAnimationFrame(()=>{
  freeState.paintFrame=0;
  if(freeState.lastData)paint(freeState.lastData);
 });
}
function receive(data){
 if(!data||typeof data!=='object')return;
 if(data.courseId&&S.currentCourseId&&data.courseId!==S.currentCourseId)return;
 if(data.session&&S.currentSession&&data.session!==S.currentSession)return;
 const previous=freeState.lastData;
 freeState.generation++;
 freeState.lastData=data;
 /* Diálogo aberto capturou respostas da sessão anterior: mudar de escopo (ou
    de sessão livre A→B) fecha o diálogo para o conteúdo de A não ser salvo em
    B — a guarda de geração só descarta o resultado, não o formulário. */
 const scopeChanged=!!previous&&(String(previous.courseId||'')!==String(data.courseId||'')||String(previous.session||'')!==String(data.session||''));
 if(scopeChanged)closeFreeDialogs();
 if(scopeChanged&&$('#tutor-material-status'))$('#tutor-material-status').hidden=true;
 paint(data);
}
/* Aplica um initialData devolvido por uma ação livre: passa pelo `loadCourse`
   normal (leitores, histórico, fila e rascunho como em qualquer troca) e só
   então repinta. A geração prova que o escopo ainda é o mesmo do pedido. */
async function applyData(data,gen){
 if(gen!==freeState.generation||!data)return false;
 if(isFreeData(data))freeState.lastData=data;
 if(data.state){
  try{
   if(await loadCourse(data,{publishWorkspace:false})===false)return false;
  }catch(error){
   toast(error&&error.message?translated(error.message):t('free.err.refresh'));
   return false;
  }
 }
 if(gen!==freeState.generation)return false;
 window.dispatchEvent(new CustomEvent('desk-workspace',{detail:data}));
 return true;
}
/* O debounce da digitação pode ainda não ter gravado quando a pessoa escolhe
   uma ação. Salvar primeiro evita reaplicar um rascunho/layout antigo no
   initialData devolvido pelo host. A troca durante esse await cancela a ação. */
async function flushState(gen){
 clearTimeout(S.saveTimer);
 await window.desk.save(layoutSnapshot());
 return gen===freeState.generation;
}
function closeFreeDialogs(){
 for(const selector of FREE_DIALOGS){
  const dialog=$(selector);
  if(dialog&&dialog.open)dialog.close('cancel');
 }
}
function setDialogBusy(selector,busy){
 const dialog=$(selector);
 if(!dialog)return;
 dialog.setAttribute('aria-busy',String(!!busy));
 for(const field of dialog.querySelectorAll('input,textarea,select,button'))field.disabled=!!busy;
}
function setBarBusy(busy){
 for(const selector of ['#free-open-pdf','#free-generate-pdf','#free-promote','#free-empty-open','#free-tutor-pdf','#free-empty-tutor','#free-empty-promote','#free-pdf-verify','#free-add-material','#study-tutor-pdf']){
  const button=$(selector);
  if(button)button.disabled=!!busy;
 }
 const select=$('#free-materials');
 if(select&&!busy)select.disabled=!((workspaceOf(freeState.lastData)?.materials||[]).length);
}
function showTutorPdfDraft(draft){
 const status=$('#tutor-material-status');if(!status)return;
 status.hidden=!draft;if(!draft)return;
 status.textContent=t('free.pdf.draftReady',{title:draft.title});
 const review=document.createElement('button');review.type='button';review.textContent=t('free.pdf.reviewSave');review.onclick=()=>pdfDialogOpener(draft);status.append(review);
}
/* O diálogo de PDF mora num módulo acima deste (free-study-pdf.mjs): o
   initFreeStudy entrega o abridor antes de o primeiro dado chegar (#43 fase 2). */
let pdfDialogOpener=()=>{};
function connectPdfDialog(open){pdfDialogOpener=open;}
function notice(selector,text,kind='error'){
 const element=$(selector);
 if(!element)return;
 element.textContent=String(text||'');
 element.hidden=!text;
 element.classList.toggle('free-note',kind==='note');
 element.classList.toggle('free-error',kind!=='note');
}
function messagePreview(element,raw){
 const body=element.querySelector('.body');
 const text=String((body&&body.innerText)||raw||'').replace(/\s+/g,' ').trim();
 return text.slice(0,100);
}
function assistantSources(){
 const out=[];
 let index=0;
 for(const element of document.querySelectorAll('#messages article.message.assistant')){
  /* Texto cru do chat (`_raw`), nunca o DOM com KaTeX: a fonte é fiel ao que o
     tutor escreveu. `typing` fica fora — resposta em andamento não vira PDF. */
  if(element.classList.contains('typing'))continue;
  const raw=typeof element._raw==='string'?element._raw:'';
  if(!raw.trim())continue;
  index++;
  out.push({raw,index,preview:messagePreview(element,raw)});
 }
 return out;
}

export {connectPdfDialog,paint,schedulePaint,receive,applyData,flushState,setDialogBusy,setBarBusy,notice,assistantSources};
