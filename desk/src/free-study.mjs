import {$,S,toast,connect,connectionState,labelBtn} from './state.mjs';
import {send} from './chat.mjs';
import {createModelPanel} from './material-models-ui.mjs';
import {t,text as translated,tutorText,LANGUAGE_EVENT} from './ui-text.mjs';
import {displayFreeTitle} from './free-names.mjs';
import {FREE_COURSE_ID,api,extractData,freeState,isFree,isFreeData,workspaceOf} from './free-study-base.mjs';
import {addMaterial,ensureMaterialStyles,fitPreviewZoom,invalidatePreview,onModelChange,openAddMaterial,openPdfDialog,paintPageIndicator,savePdf,showMaterialDiagnostics,updatePdfPreview,verifyPdf} from './free-study-pdf.mjs';
import {applyData,connectPdfDialog,flushState,notice,paint,receive,schedulePaint,setBarBusy,setDialogBusy} from './free-study-chrome.mjs';

/* Aba Livre — a sessão avulsa (workspace `mesa-free`). Este módulo é a UI do
   contrato congelado em /tmp/mesa-free-20261006/contract.md: monta o cabeçalho
   da sessão, os diálogos de gerar PDF e criar matéria e o vazio orientado,
   ouvindo `desk-workspace` (o root hidrata `S.workspace` e envia o initialData
   integral em initial/switch/new/open) e `desk-chrome` (o `loadCourse`
   avisa no meio da troca; repintar é idempotente). A prévia de PDF também
   atende às matérias; o host mantém cada rascunho na conversa de origem.
   As APIs do host são as do contrato (`freeOpenPdf`, `freeSaveMaterial`,
   `freePromote`, `freeRename` opcional) e todas as mutações passam por guarda
   de geração: um resultado que chega depois da troca de escopo é descartado —
   o host revalida de novo do lado dele. */

/* ---------- diálogos ---------- */

/* O botão envia um pedido ao tutor; é a ferramenta dele que cria o arquivo.
   O rascunho e os anexos já no composer continuam intocados. */
export function openTutorPdfDialog(seed=''){
 if(freeState.inflight)return;
 /* `seed` é o pedido que a folha "Lista 0" já deixa escrito; o clique de
    menu/botão chega aqui sem argumento (ou com o evento) e abre vazio. */
 $('#tutor-pdf-request').value=typeof seed==='string'?seed:'';notice('#tutor-pdf-error','');
 $('#tutor-pdf-dialog').showModal();$('#tutor-pdf-request').focus();
}
async function requestTutorPdf(){
 const request=$('#tutor-pdf-request').value.trim();
 if(!request){notice('#tutor-pdf-error',t('free.pdf.needTopic'));$('#tutor-pdf-request').focus();return;}
 if(S.busy||freeState.inflight){notice('#tutor-pdf-error',t('free.pdf.waitTutor'));return;}
 const gen=freeState.generation;
 $('#tutor-pdf-dialog').close('ok');
 const sent=await send(await tutorText('free.pdf.prompt',{request}),[]);
 if(!sent&&gen===freeState.generation){notice('#tutor-pdf-error',t('free.pdf.notSent'));$('#tutor-pdf-dialog').showModal();}
}
async function receiveTutorMaterial(data){
 if(data?.courseId!==S.currentCourseId||data?.conversationId!==S.currentSession)return;
 if(data.status!=='prepared'||!data.draft)return;
 if(data.workspace){S.workspace=data.workspace;freeState.lastData={...freeState.lastData,workspace:data.workspace};}
 else freeState.lastData={...freeState.lastData,pdfDraft:data.draft};
 paint(freeState.lastData);
 if(!document.querySelector('dialog[open]'))openPdfDialog(data.draft);
}

/* ---------- materiais da sessão ---------- */

function openMaterial(value){
 if(!value)return;
 const workspace=workspaceOf(freeState.lastData);
 const list=workspace&&Array.isArray(workspace.materials)?workspace.materials:[];
 const hit=list.find(material=>String(material.path||material.id||'')===String(value));
 if(!hit)return;
 const path=String(hit.path||'');
 if(!path){
  toast(t('free.material.noFile'));
  return;
 }
 const panel=Array.isArray(S.panels)?S.panels[0]:null;
 if(!panel){
  toast(t('free.material.noReader'));
  return;
 }
 /* Mesmo caminho do leitor normal: entra na biblioteca da sessão (uma vez) e
    carrega no primeiro painel. */
 if(!S.library.some(entry=>entry.path===path)){
  S.library.push({path,name:String(hit.name||path.split(/[/\\]/).at(-1)||'PDF')});
  for(const other of S.panels)other.populate();
 }
 Promise.resolve(panel.load(path)).catch(error=>toast(error&&error.message?translated(error.message):t('free.material.openFail'))).finally(()=>{
  if(freeState.lastData)paint(freeState.lastData);
 });
}

/* ---------- criar matéria ---------- */

function openPromoteDialog(){
 if(freeState.inflight==='free-open'||freeState.inflight==='promote')return;
 const workspace=workspaceOf(freeState.lastData)||{};
 const materials=Array.isArray(workspace.materials)?workspace.materials:[];
 $('#free-promote-session').textContent=displayFreeTitle(String(workspace.title||'').trim())||t('free.title.placeholder');
 $('#free-promote-materials').textContent=materials.length?materials.map(material=>String(material.name||material.id||t('free.promote.materialFallback'))).join(', '):t('free.promote.noMaterials');
 $('#free-promote-name').value=displayFreeTitle(String(workspace.title||'').trim());
 notice('#free-promote-error','');
 $('#free-promote-dialog').showModal();
 $('#free-promote-name').focus();
}
async function promote(){
 if(freeState.inflight)return;
 const fn=api('freePromote');
 const name=$('#free-promote-name').value.trim();
 if(!fn){
  notice('#free-promote-error',t('free.promote.needHost'));
  return;
 }
 if(!name){
  notice('#free-promote-error',t('free.promote.needName'));
  return;
 }
 if(S.busy){
  notice('#free-promote-error',t('free.promote.waitTutor'));
  return;
 }
 const gen=freeState.generation;
 freeState.inflight='promote';
 setDialogBusy('#free-promote-dialog',true);
 try{
  if(!await flushState(gen))return;
  const result=await fn({name});
  if(gen!==freeState.generation)return;
  if(result&&result.cancelled){
   notice('#free-promote-error',t('free.promote.cancelled'),'note');
   return;
  }
  if(!result||result.created!==true){
   notice('#free-promote-error',result&&result.error?translated(result.error):t('free.promote.fail'));
   return;
  }
  const data=extractData(result);
  $('#free-promote-dialog').close('ok');
  if(data&&!await applyData(data,gen))return;
  /* A matéria nova muda o cwd da conversa: o host fecha o processo antigo. O
     renderer não pode continuar dizendo "conectado" para ele — mesmo
     tratamento do `switchCourse`, sem tocar no histórico transferido. */
  const leftFree=!!data&&(!isFreeData(data)||(S.currentCourseId&&S.currentCourseId!==FREE_COURSE_ID));
  if(leftFree){
   S.connected=false;
   connectionState('');
   connect().catch(()=>{});
  }
  toast(t('free.promote.done',{name:(result.course&&result.course.name)||name}));
 }catch(error){
  if(gen===freeState.generation)notice('#free-promote-error',error&&error.message?translated(error.message):t('free.promote.fail'));
 }finally{
  freeState.inflight='';
  setDialogBusy('#free-promote-dialog',false);
 }
}

/* ---------- abrir PDF e renomear ---------- */

async function openPdf(){
 if(freeState.inflight)return;
 const fn=api('freeOpenPdf');
 if(!fn){
  toast(t('free.openPdf.needHost'));
  return;
 }
 const gen=freeState.generation;
 freeState.inflight='free-open';
 setBarBusy(true);
 try{
  if(!await flushState(gen))return;
  const result=await fn();
  if(gen!==freeState.generation)return;
  if(!result||result.cancelled)return;
  const data=extractData(result);
  if(!data){
   toast(t('free.openPdf.stale'));
   return;
  }
  await applyData(data,gen);
 }catch(error){
  if(gen===freeState.generation)toast(error&&error.message?translated(error.message):t('free.openPdf.fail'));
 }finally{
  freeState.inflight='';
  setBarBusy(false);
  if(freeState.lastData)paint(freeState.lastData);
 }
}
async function renameSession(){
 const input=$('#free-title');
 if(!input||!isFree()||freeState.renaming)return;
 const workspace=workspaceOf(freeState.lastData)||{};
 const title=input.value.trim();
 if(title===displayFreeTitle(String(workspace.title||'')))return;
 const fn=api('freeRename');
 if(!fn){
  input.value=displayFreeTitle(String(workspace.title||''));
  toast(t('free.rename.needHost'));
  return;
 }
 const gen=freeState.generation;
 freeState.renaming=true;
 input.disabled=true;
 try{
  if(!await flushState(gen))return;
  const result=await fn({title});
  if(gen!==freeState.generation)return;
  const data=extractData(result);
  if(data)await applyData(data,gen);
  else{
   freeState.lastData={...freeState.lastData,workspace:{...workspace,title}};
   toast(t('free.rename.saved'));
  }
 }catch(error){
  if(gen===freeState.generation){
   input.value=displayFreeTitle(String(workspace.title||''));
   toast(error&&error.message?translated(error.message):t('free.rename.fail'));
  }
 }finally{
  freeState.renaming=false;
  input.disabled=false;
 }
}

/* ---------- montagem ---------- */

/* A prévia real precisa dos controles que o host ainda não coloca no index;
   são criados aqui para a UI funcionar sem editar o root. O CSS do template é
   carregado por link próprio (escopado em .pdf-doc/.pdf-page). */
function setupPreviewControls(){
 ensureMaterialStyles();
 const title=$('#free-pdf-title');
 if(title&&title.maxLength>120)title.maxLength=120;
 const actions=$('#free-pdf-form .dialog-actions');
 if(actions&&!$('#free-pdf-verify')){
  const button=document.createElement('button');
  button.type='button';button.id='free-pdf-verify';
  button.textContent=t('free.pdf.verify');
  button.title=t('free.pdf.verify.title');
  const save=$('#free-pdf-save');
  actions.insertBefore(button,save||null);
 }
 const verify=$('#free-pdf-verify');
 if(verify&&!verify.dataset.previewBound){
  verify.dataset.previewBound='1';
  verify.addEventListener('click',()=>verifyPdf().catch(error=>notice('#free-pdf-error',error&&error.message?translated(error.message):t('free.preview.realFail'))));
 }
 const dialog=$('#free-pdf-dialog');
 if(dialog)dialog.addEventListener('close',()=>{clearTimeout(freeState.realPreviewTimer);invalidatePreview();showMaterialDiagnostics([]);});
 const strip=$('#pdf-model-strip'),optionsBox=$('#pdf-model-options');
 if(strip&&optionsBox&&!freeState.modelPanel)freeState.modelPanel=createModelPanel({strip,optionsBox,onChange:onModelChange});
 const scroller=document.querySelector('#free-pdf-form .pdf-view-scroll');
 if(scroller){
  scroller.addEventListener('scroll',paintPageIndicator,{passive:true});
  /* A folha acompanha a largura da caixa (janela redimensionada com o diálogo aberto). */
  if(typeof ResizeObserver==='function'){
   new ResizeObserver(()=>{
    const box=$('#free-pdf-preview');
    if(box&&!box.hidden&&dialog?.open)fitPreviewZoom(box);
   }).observe(scroller);
  }
 }
 $('#free-pdf-title')?.addEventListener('input',()=>{
  cancelAnimationFrame(freeState.previewFrame);
  freeState.previewFrame=requestAnimationFrame(updatePdfPreview);
 });
}

/* "Mais opções" da barra: Montar PDF, Adicionar à matéria e Criar matéria. Menu
   comum da Mesa (`.chat-pop`): abre pelo ···, fecha com Esc, clique fora, Tab ou
   ao escolher — e devolve o foco ao ···, de onde o diálogo aberto o devolve. */
function initMoreMenu(){
 const trigger=$('#free-more'),pop=$('#free-more-pop');
 if(!trigger||!pop)return;
 const items=()=>[...pop.querySelectorAll('button')].filter(item=>!item.hidden);
 const hide=({restoreFocus=false}={})=>{
  if(pop.hidden)return;
  pop.hidden=true;
  trigger.setAttribute('aria-expanded','false');
  if(restoreFocus)trigger.focus();
 };
 const show=()=>{
  pop.hidden=false;
  trigger.setAttribute('aria-expanded','true');
 };
 trigger.addEventListener('click',()=>{
  if(pop.hidden){show();return;}
  hide({restoreFocus:true});
 });
 trigger.addEventListener('keydown',event=>{
  if(event.key!=='ArrowDown')return;
  event.preventDefault();
  if(pop.hidden)show();
  items().find(item=>!item.disabled)?.focus();
 });
 pop.addEventListener('keydown',event=>{
  if(event.key==='Tab'){hide();return;}
  if(event.key!=='ArrowDown'&&event.key!=='ArrowUp')return;
  event.preventDefault();
  const list=items().filter(item=>!item.disabled);
  const at=list.indexOf(document.activeElement);
  const next=event.key==='ArrowDown'?(at+1)%list.length:(at<=0?list.length-1:at-1);
  list[next]?.focus();
 });
 /* Em captura: roda antes do clique do item, então o diálogo que ele abrir
    encontra o foco já no ··· e o devolve para lá ao fechar. */
 pop.addEventListener('click',()=>hide({restoreFocus:true}),true);
 document.addEventListener('click',event=>{
  if(pop.hidden||event.target?.closest?.('#free-more, #free-more-pop'))return;
  hide();
 });
 document.addEventListener('keydown',event=>{
  if(event.key!=='Escape'||pop.hidden)return;
  hide({restoreFocus:true});
 });
}

/* Rótulos com ícone que o JS escreve (não passam pelo `data-i18n`): refeitos na troca de idioma. */
function paintBarLabels(){
 labelBtn($('#free-open-pdf'),'plus',t('free.openPdf'));
 labelBtn($('#free-tutor-pdf'),'sparkles',t('free.bar.tutorPdf'));
 labelBtn($('#free-add-material'),'upload',t('free.addMaterial'));
 labelBtn($('#free-empty-tutor'),'sparkles',t('free.bar.tutorPdf'));
 labelBtn($('#free-empty-promote'),'book',t('free.promote'));
 labelBtn($('#free-generate-pdf'),'textQuote',t('free.generatePdf'));
 labelBtn($('#free-promote'),'book',t('free.promote'));
 labelBtn($('#free-empty-open'),'plus',t('free.openPdf'));
}

export function initFreeStudy(){
 connectPdfDialog(openPdfDialog);
 if(window.__deskFreeStudy||!$('#free-bar'))return;
 window.__deskFreeStudy=true;
 setupPreviewControls();
 labelBtn($('#free-more'),'more');
 paintBarLabels();
 window.addEventListener(LANGUAGE_EVENT,()=>{paintBarLabels();if(freeState.lastData)paint(freeState.lastData);const verify=$('#free-pdf-verify');if(verify){verify.textContent=t('free.pdf.verify');verify.title=t('free.pdf.verify.title');}});
 initMoreMenu();
 $('#free-open-pdf').onclick=openPdf;
 $('#free-empty-open').onclick=openPdf;
 $('#free-tutor-pdf').onclick=openTutorPdfDialog;
 $('#free-add-material').onclick=openAddMaterial;
 $('#free-add-form').addEventListener('submit',event=>{if(event.submitter?.id==='free-add-save'){event.preventDefault();addMaterial();}});
 $('#free-empty-tutor').onclick=openTutorPdfDialog;
 $('#free-empty-promote').onclick=openPromoteDialog;
 $('#free-generate-pdf').onclick=()=>openPdfDialog();
 $('#free-promote').onclick=openPromoteDialog;
 $('#free-materials').addEventListener('change',event=>openMaterial(event.target.value));
 $('#free-title').addEventListener('change',renameSession);
 $('#free-title').addEventListener('keydown',event=>{
  if(event.key==='Enter'){
   event.preventDefault();
   renameSession();
  }
 });
 /* O botão `×` do cabeçalho é o primeiro submit do formulário: sem isto o
    Enter no título cairia nele (fechar) em vez da ação principal. O Enter do
    campo de texto confirma; o do conteúdo (textarea) continua quebrando linha. */
 $('#free-pdf-title').addEventListener('keydown',event=>{
  if(event.key==='Enter'){
   event.preventDefault();
   savePdf();
  }
 });
 $('#free-promote-name').addEventListener('keydown',event=>{
  if(event.key==='Enter'){
   event.preventDefault();
   promote();
  }
 });
 $('#free-pdf-source').addEventListener('change',()=>{
  const source=freeState.sources[Number($('#free-pdf-source').value)];
  if(!source)return;
  $('#free-pdf-content').value=source.raw;
  updatePdfPreview();
 });
 $('#free-pdf-content').addEventListener('input',()=>{
  cancelAnimationFrame(freeState.previewFrame);
  freeState.previewFrame=requestAnimationFrame(updatePdfPreview);
 });
 $('#free-pdf-form').addEventListener('submit',event=>{
  event.preventDefault();
  if(event.submitter&&event.submitter.id==='free-pdf-save')savePdf();
  else $('#free-pdf-dialog').close('cancel');
 });
 $('#free-promote-form').addEventListener('submit',event=>{
  event.preventDefault();
  if(event.submitter&&event.submitter.id==='free-promote-save')promote();
  else $('#free-promote-dialog').close('cancel');
 });
 $('#tutor-pdf-form').addEventListener('submit',event=>{event.preventDefault();if(event.submitter?.id==='tutor-pdf-send')requestTutorPdf();else $('#tutor-pdf-dialog').close('cancel');});
 window.desk.onTutorMaterial?.(data=>receiveTutorMaterial(data).catch(error=>toast(error.message)));
 window.addEventListener('desk-workspace',event=>receive(event&&event.detail));
 window.addEventListener('desk-chrome',schedulePaint);
 /* O root hidrata S.workspace antes de despachar; se a montagem vier depois do
    primeiro `desk-workspace`, o fato já hidratado evita uma aba morta. */
 if(isFreeData({workspace:S.workspace}))receive({workspace:S.workspace});
}
