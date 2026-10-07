import {$,S,toast,loadCourse,layoutSnapshot,connect,connectionState,labelBtn} from './state.mjs';
import {markup,decorateCode} from './markdown.mjs';
import {htmlNode,renderInto} from './view-host.mjs';
import {send} from './chat.mjs';

/* Aba Livre — a sessão avulsa (workspace `mesa-free`). Este módulo é a UI do
   contrato congelado em /tmp/mesa-free-20261006/contract.md: monta o cabeçalho
   da sessão, os diálogos de gerar PDF e criar matéria e o vazio orientado,
   ouvindo `desk-workspace` (o root hidrata `S.workspace` e envia o initialData
   integral em initial/switch/new/open) e `desk-chrome` (o `loadCourse`
   avisa no meio da troca; repintar é idempotente). Nada aqui conhece matéria
   normal: sem o evento, a barra fica escondida e a mesa segue como sempre.
   As APIs do host são as do contrato (`freeOpenPdf`, `freeSaveMaterial`,
   `freePromote`, `freeRename` opcional) e todas as mutações passam por guarda
   de geração: um resultado que chega depois da troca de escopo é descartado —
   o host revalida de novo do lado dele. */

const FREE_COURSE_ID='mesa-free';
const FREE_DIALOGS=['#free-pdf-dialog','#free-promote-dialog','#tutor-pdf-dialog'];

let generation=0;
let lastData=null;
let inflight='';
let renaming=false;
let sources=[];
let previewFrame=0;
let paintFrame=0;

function bridge(){
 return window.deskFreeBridge&&typeof window.deskFreeBridge==='object'?window.deskFreeBridge:window.desk;
}
function api(name){
 const target=bridge();
 const fn=target&&typeof target[name]==='function'?target[name]:null;
 return fn?fn.bind(target):null;
}
function workspaceOf(data){
 return data&&typeof data==='object'&&data.workspace&&typeof data.workspace==='object'?data.workspace:null;
}
function isFreeData(data){
 const workspace=workspaceOf(data);
 if(workspace)return workspace.kind==='free';
 /* Fallback do contrato: `mesa-free` é id reservado; sem S.workspace ainda (host
    antigo), o id conhecido basta para a UI não ficar morta. */
 return !!(data&&data.courseId===FREE_COURSE_ID);
}
function extractData(result){
 if(!result||typeof result!=='object')return null;
 const data=result.data&&typeof result.data==='object'?result.data:result;
 return data&&typeof data==='object'&&(data.state||data.workspace)?data:null;
}
function mainOf(){return document.querySelector('main');}
function refsOf(){return $('#references');}
function hasOpenPdf(){return Array.isArray(S.panels)&&S.panels.some(panel=>panel&&panel.path);}
/* Mesmo fato do `paint`: o host manda. Um payload livre atrasado com matéria
   real ativa não vale como "sessão livre" para nenhuma ação. */
function isFree(){
 if(!isFreeData(lastData))return false;
 return !(S.currentCourseId&&S.currentCourseId!==FREE_COURSE_ID);
}

/* ---------- pintura do chrome da sessão ---------- */

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
  select.append(new Option('Nenhum material ainda',''));
  select.disabled=true;
  return;
 }
 select.disabled=false;
 select.append(new Option('Abrir um material…',''));
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
 if($('#free-guide'))$('#free-guide').hidden=!free;
 const pdfDraft=free?workspaceOf(data)?.pdfDraft:null;
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
  const title=String(workspace.title||'');
  if(input.value!==title)input.value=title;
 }
 renderMaterials(workspace.materials);
 setEmpty(!hasOpenPdf());
}
/* O `loadCourse` avisa o chrome antes de terminar de carregar os PDFs (os
   caminhos entram logo depois, no mesmo tick): repintar no próximo frame pega o
   estado real sem piscar o vazio. */
function schedulePaint(){
 cancelAnimationFrame(paintFrame);
 paintFrame=requestAnimationFrame(()=>{
  paintFrame=0;
  if(lastData)paint(lastData);
 });
}
function receive(data){
 if(!data||typeof data!=='object')return;
 if(data.courseId&&S.currentCourseId&&data.courseId!==S.currentCourseId)return;
 if(data.session&&S.currentSession&&data.session!==S.currentSession)return;
 const previous=lastData;
 generation++;
 lastData=data;
 /* Diálogo aberto capturou respostas da sessão anterior: mudar de escopo (ou
    de sessão livre A→B) fecha o diálogo para o conteúdo de A não ser salvo em
    B — a guarda de geração só descarta o resultado, não o formulário. */
 const scopeChanged=!!previous&&(String(previous.courseId||'')!==String(data.courseId||'')||String(previous.session||'')!==String(data.session||''));
 const leaving=!isFreeData(data);
 if(leaving||scopeChanged)closeFreeDialogs();
 if(scopeChanged&&$('#tutor-material-status'))$('#tutor-material-status').hidden=true;
 paint(data);
}
/* Aplica um initialData devolvido por uma ação livre: passa pelo `loadCourse`
   normal (leitores, histórico, fila e rascunho como em qualquer troca) e só
   então repinta. A geração prova que o escopo ainda é o mesmo do pedido. */
async function applyData(data,gen){
 if(gen!==generation||!data)return false;
 if(isFreeData(data))lastData=data;
 if(data.state){
  try{
   if(await loadCourse(data,{publishWorkspace:false})===false)return false;
  }catch(error){
   toast(error&&error.message?error.message:'Não foi possível atualizar a sessão livre.');
   return false;
  }
 }
 if(gen!==generation)return false;
 window.dispatchEvent(new CustomEvent('desk-workspace',{detail:data}));
 return true;
}

/* O debounce da digitação pode ainda não ter gravado quando a pessoa escolhe
   uma ação. Salvar primeiro evita reaplicar um rascunho/layout antigo no
   initialData devolvido pelo host. A troca durante esse await cancela a ação. */
async function flushState(gen){
 clearTimeout(S.saveTimer);
 await window.desk.save(layoutSnapshot());
 return gen===generation&&isFree();
}

/* ---------- diálogos ---------- */

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
 for(const selector of ['#free-open-pdf','#free-generate-pdf','#free-promote','#free-empty-open','#free-tutor-pdf','#free-empty-tutor','#free-empty-promote']){
  const button=$(selector);
  if(button)button.disabled=!!busy;
 }
 const select=$('#free-materials');
 if(select&&!busy)select.disabled=!((workspaceOf(lastData)?.materials||[]).length);
}

/* O botão envia um pedido ao tutor; é a ferramenta dele que cria o arquivo.
   O rascunho e os anexos já no composer continuam intocados. */
function openTutorPdfDialog(){
 if(!isFree()||inflight)return;
 $('#tutor-pdf-request').value='';notice('#tutor-pdf-error','');
 $('#tutor-pdf-dialog').showModal();$('#tutor-pdf-request').focus();
}
async function requestTutorPdf(){
 const request=$('#tutor-pdf-request').value.trim();
 if(!request){notice('#tutor-pdf-error','Descreva o tema e o que você quer no PDF.');$('#tutor-pdf-request').focus();return;}
 if(S.busy||inflight){notice('#tutor-pdf-error','Espere o tutor terminar antes de pedir o PDF.');return;}
 const gen=generation;
 $('#tutor-pdf-dialog').close('ok');
 const sent=await send(`Prepare um PDF na Mesa com o seguinte conteúdo: ${request}\n\nEscreva você mesmo o material e use a ferramenta de PDF da Mesa para preencher a prévia. Eu revisarei antes de salvar o arquivo.`,[]);
 if(!sent&&gen===generation&&isFree()){notice('#tutor-pdf-error','O pedido não foi enviado; tente novamente.');$('#tutor-pdf-dialog').showModal();}
}
function showTutorPdfDraft(draft){
 const status=$('#tutor-material-status');if(!status)return;
 status.hidden=!draft;if(!draft)return;
 status.textContent=`Material preparado pelo tutor: ${draft.title} — revise antes de salvar. `;
 const review=document.createElement('button');review.type='button';review.textContent='Revisar e salvar PDF';review.onclick=()=>openPdfDialog(draft);status.append(review);
}
async function receiveTutorMaterial(data){
 if(!isFree()||data?.courseId!==S.currentCourseId||data?.conversationId!==S.currentSession)return;
 if(data.status!=='prepared'||!data.draft)return;
 if(data.workspace){S.workspace=data.workspace;lastData={...lastData,workspace:data.workspace};}
 paint(lastData);
 if(!document.querySelector('dialog[open]'))openPdfDialog(data.draft);
}

function notice(selector,text,kind='error'){
 const element=$(selector);
 if(!element)return;
 element.textContent=String(text||'');
 element.hidden=!text;
 element.classList.toggle('free-note',kind==='note');
 element.classList.toggle('free-error',kind!=='note');
}

/* ---------- materiais da sessão ---------- */

function openMaterial(value){
 if(!value)return;
 const workspace=workspaceOf(lastData);
 const list=workspace&&Array.isArray(workspace.materials)?workspace.materials:[];
 const hit=list.find(material=>String(material.path||material.id||'')===String(value));
 if(!hit)return;
 const path=String(hit.path||'');
 if(!path){
  toast('Este material não tem um arquivo para abrir.');
  return;
 }
 const panel=Array.isArray(S.panels)?S.panels[0]:null;
 if(!panel){
  toast('Nenhum leitor aberto nesta sessão.');
  return;
 }
 /* Mesmo caminho do leitor normal: entra na biblioteca da sessão (uma vez) e
    carrega no primeiro painel. */
 if(!S.library.some(entry=>entry.path===path)){
  S.library.push({path,name:String(hit.name||path.split(/[/\\]/).at(-1)||'PDF')});
  for(const other of S.panels)other.populate();
 }
 Promise.resolve(panel.load(path)).catch(error=>toast(error&&error.message?error.message:'Não foi possível abrir o material.')).finally(()=>{
  if(lastData)paint(lastData);
 });
}

/* ---------- respostas disponíveis para o PDF ---------- */

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

/* ---------- gerar PDF ---------- */

function updatePdfPreview(){
 const box=$('#free-pdf-preview');
 if(!box)return;
 const text=$('#free-pdf-content').value;
 if(!text.trim()){
  const hint=document.createElement('p');
  hint.className='fine';
  hint.textContent='A prévia aparece aqui conforme você escreve.';
  box.replaceChildren(hint);
  return;
 }
 renderInto(box,htmlNode(markup(text,false)));
 decorateCode(box);
}
function openPdfDialog(draft=null){
 if(inflight==='free-open'||inflight==='pdf-save')return;
 sources=draft?[{raw:draft.markdown,preview:'Conteúdo preparado pelo tutor'}]:assistantSources();
 const dialog=$('#free-pdf-dialog');dialog._pdfDraftId=draft?.id||'';
 dialog.querySelector('h2').textContent=draft?'Revisar PDF do tutor':'Montar PDF';
 dialog.querySelector('.help-lead').textContent=draft?'O tutor preparou este conteúdo. Confira a prévia, edite o que quiser e clique em Salvar PDF e abrir.':'Escolha uma resposta (ou cole o texto), ajuste o conteúdo e confira a prévia. O PDF fica entre os materiais desta sessão.';
 const select=$('#free-pdf-source');
 select.replaceChildren();
 if(sources.length){
  sources.forEach((source,index)=>select.append(new Option(draft?'Conteúdo preparado pelo tutor':`Resposta ${index+1} — ${source.preview||'(sem texto)'}`,String(index))));
  select.disabled=false;
  select.value=String(sources.length-1);
 }else{
  select.append(new Option('Sem respostas ainda — cole o conteúdo abaixo',''));
  select.disabled=true;
 }
 const workspace=workspaceOf(lastData)||{};
 $('#free-pdf-title').value=draft?.title||String(workspace.title||'').trim()||'Material da sessão livre';
 $('#free-pdf-content').value=sources.length?sources[sources.length-1].raw:'';
 notice('#free-pdf-error','');
 updatePdfPreview();
 $('#free-pdf-dialog').showModal();
 $('#free-pdf-title').focus();
}
async function savePdf(){
 if(inflight)return;
 const fn=api('freeSaveMaterial');
 const title=$('#free-pdf-title').value.trim();
 const markdown=$('#free-pdf-content').value;
 if(!fn){
  notice('#free-pdf-error','Salvar PDF nesta sessão precisa da versão integrada da Mesa.');
  return;
 }
 if(!title){
  notice('#free-pdf-error','Dê um título ao PDF.');
  return;
 }
 if(!markdown.trim()){
  notice('#free-pdf-error','Escreva ou cole o conteúdo do PDF.');
  return;
 }
 if(S.busy){
  notice('#free-pdf-error',`Espere ${S.agentLabel||'o tutor'} terminar a resposta antes de gerar o PDF.`);
  return;
 }
 const gen=generation;
 inflight='pdf-save';
 setDialogBusy('#free-pdf-dialog',true);
 try{
  if(!await flushState(gen))return;
  const result=await fn({title,markdown,draftId:$('#free-pdf-dialog')._pdfDraftId||''});
  if(gen!==generation)return;
  if(!result||result.saved!==true){
   notice('#free-pdf-error',(result&&result.error)||'Não foi possível salvar o PDF agora.');
   return;
  }
  const data=extractData(result);
  $('#free-pdf-dialog').close('ok');
  if(data&&!await applyData(data,gen))return;
  toast('PDF salvo entre os materiais desta sessão.');
 }catch(error){
  if(gen===generation)notice('#free-pdf-error',(error&&error.message)||'Não foi possível salvar o PDF agora.');
 }finally{
  inflight='';
  setDialogBusy('#free-pdf-dialog',false);
  if(!sources.length)$('#free-pdf-source').disabled=true;
 }
}

/* ---------- criar matéria ---------- */

function openPromoteDialog(){
 if(inflight==='free-open'||inflight==='promote')return;
 const workspace=workspaceOf(lastData)||{};
 const materials=Array.isArray(workspace.materials)?workspace.materials:[];
 $('#free-promote-session').textContent=String(workspace.title||'').trim()||'Sessão livre';
 $('#free-promote-materials').textContent=materials.length?materials.map(material=>String(material.name||material.id||'material')).join(', '):'Nenhum material nesta sessão';
 $('#free-promote-name').value=String(workspace.title||'').trim();
 notice('#free-promote-error','');
 $('#free-promote-dialog').showModal();
 $('#free-promote-name').focus();
}
async function promote(){
 if(inflight)return;
 const fn=api('freePromote');
 const name=$('#free-promote-name').value.trim();
 if(!fn){
  notice('#free-promote-error','Criar matéria precisa da versão integrada da Mesa.');
  return;
 }
 if(!name){
  notice('#free-promote-error','Dê um nome à nova matéria.');
  return;
 }
 if(S.busy){
  notice('#free-promote-error',`Espere ${S.agentLabel||'o tutor'} terminar a resposta antes de criar a matéria.`);
  return;
 }
 const gen=generation;
 inflight='promote';
 setDialogBusy('#free-promote-dialog',true);
 try{
  if(!await flushState(gen))return;
  const result=await fn({name});
  if(gen!==generation)return;
  if(result&&result.cancelled){
   notice('#free-promote-error','Nada foi criado — a escolha da pasta foi cancelada.','note');
   return;
  }
  if(!result||result.created!==true){
   notice('#free-promote-error',(result&&result.error)||'Não foi possível criar a matéria agora.');
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
   connectionState('',`${S.agentLabel} desconectado`);
   connect().catch(()=>{});
  }
  toast(`Matéria "${(result.course&&result.course.name)||name}" criada.`);
 }catch(error){
  if(gen===generation)notice('#free-promote-error',(error&&error.message)||'Não foi possível criar a matéria agora.');
 }finally{
  inflight='';
  setDialogBusy('#free-promote-dialog',false);
 }
}

/* ---------- abrir PDF e renomear ---------- */

async function openPdf(){
 if(inflight)return;
 const fn=api('freeOpenPdf');
 if(!fn){
  toast('Abrir PDF nesta sessão precisa da versão integrada da Mesa.');
  return;
 }
 const gen=generation;
 inflight='free-open';
 setBarBusy(true);
 try{
  if(!await flushState(gen))return;
  const result=await fn();
  if(gen!==generation)return;
  if(!result||result.cancelled)return;
  const data=extractData(result);
  if(!data){
   toast('A sessão não foi devolvida atualizada; tente de novo.');
   return;
  }
  await applyData(data,gen);
 }catch(error){
  if(gen===generation)toast((error&&error.message)||'Não foi possível abrir o PDF.');
 }finally{
  inflight='';
  setBarBusy(false);
  if(lastData)paint(lastData);
 }
}
async function renameSession(){
 const input=$('#free-title');
 if(!input||!isFree()||renaming)return;
 const workspace=workspaceOf(lastData)||{};
 const title=input.value.trim();
 if(title===String(workspace.title||''))return;
 const fn=api('freeRename');
 if(!fn){
  input.value=String(workspace.title||'');
  toast('Salvar o título da sessão precisa da versão integrada da Mesa.');
  return;
 }
 const gen=generation;
 renaming=true;
 input.disabled=true;
 try{
  if(!await flushState(gen))return;
  const result=await fn({title});
  if(gen!==generation)return;
  const data=extractData(result);
  if(data)await applyData(data,gen);
  else{
   lastData={...lastData,workspace:{...workspace,title}};
   toast('Título da sessão salvo.');
  }
 }catch(error){
  if(gen===generation){
   input.value=String(workspace.title||'');
   toast((error&&error.message)||'Não foi possível salvar o título.');
  }
 }finally{
  renaming=false;
  input.disabled=false;
 }
}

/* ---------- montagem ---------- */

export function initFreeStudy(){
 if(window.__deskFreeStudy||!$('#free-bar'))return;
 window.__deskFreeStudy=true;
 labelBtn($('#free-open-pdf'),'plus','Abrir PDF');
 labelBtn($('#free-tutor-pdf'),'download','PDF pelo tutor');
 labelBtn($('#free-empty-tutor'),'download','PDF pelo tutor');
 labelBtn($('#free-empty-promote'),'book','Criar matéria');
 labelBtn($('#free-generate-pdf'),'download','Montar PDF');
 labelBtn($('#free-promote'),'book','Criar matéria');
 labelBtn($('#free-empty-open'),'plus','Abrir PDF');
 $('#free-open-pdf').onclick=openPdf;
 $('#free-empty-open').onclick=openPdf;
 $('#free-tutor-pdf').onclick=openTutorPdfDialog;
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
  const source=sources[Number($('#free-pdf-source').value)];
  if(!source)return;
  $('#free-pdf-content').value=source.raw;
  updatePdfPreview();
 });
 $('#free-pdf-content').addEventListener('input',()=>{
  cancelAnimationFrame(previewFrame);
  previewFrame=requestAnimationFrame(updatePdfPreview);
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
