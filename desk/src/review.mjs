import {$,S,toast,markCourseTab,updateContextSummary,supportsCapability} from './state.mjs';
import {build,renderChildren} from './view-host.mjs';
import {renderReview} from './dialogs.mjs';
import {openRef} from './nav.mjs';
import {showUndoNotice,cancelUndoNotice} from './undo-deletion.mjs';
import reviewCore from './generated/review.core.js';
import {t,text as uiText,formatDate} from './ui-text.mjs';
import {message} from './i18n.mjs';
import {flashMark,savedMark} from './icon-motion.mjs';
import {reviewPrompt} from './review-prompts.mjs';
import {toNat, wholeNat} from './bend-nat.mjs';

/* ---------------------------------------------------------------------------
   Caderno de revisão (pedido 6): a aba que guarda o que o aluno quer revisar.

   A aba é a irmã da aba GeoGebra: `#references.review` esconde o `#pdf-grid` e
   mostra o `#review-view` (o `#ggb-bar` continua sendo do GeoGebra). Quem cuida
   da exclusividade entre as duas é o `main.mjs` — aqui só o estado da aba e o
   desenho.

   A FORMA dos itens, a contagem, a barra e os dois prompts vêm do núcleo
   (`core/review.bend`); o arquivo e o IPC ficam no `desk/review.cjs`. Este
   módulo só monta o DOM, liga os cliques e leva os prompts ao `#prompt`.

   Guardar abre um rascunho editável e pede ao Pi uma sugestão em sessão
   separada, sem ferramentas. Campos que o usuário editou nunca são substituídos;
   cancelar o diálogo cancela a sugestão. A referência vem da página aberta.
   --------------------------------------------------------------------------- */

const MAX_PROMPT_CHARS = 4000;

const dialogOf=()=>$('#review-dialog');

function baseName(path){return String(path||'').split(/[/\\]/).pop()||'';}

function libraryName(path){
 const entry=(S.library||[]).find(p=>String(p.path||'')===String(path||''));
 return String(entry?.name||baseName(path)||'').replace(/\.pdf$/i,'');
}

/* A referência do leitor aberto (a mesma que a citação usa). */
function openRefOf(){
 const panel=(S.panels||[]).find(p=>p.path);
 if(!panel)return {name:'',page:1,path:''};
 return {name:libraryName(panel.path),page:Math.max(1,Number(panel.page)||1),path:String(panel.path||'')};
}

/* O núcleo espera o registro posicional `ReviewRef` (a página é Nat). */
function coreRef(ref){
 const source=ref||{};
 return {name:String(source.name||''),page:wholeNat(source.page,1),path:String(source.path||'')};
}

function coreItem(item){
 const source=item||{};
 return {
  question:String(source.question||''),
  attempt:String(source.attempt||''),
  difficulty:String(source.difficulty||''),
  ref:coreRef(source.ref)
 };
}

/* O registro como o caderno o guarda (a identidade de editar e remover): só a
   questão, a tentativa, a dificuldade e a referência — nada da agenda. */
function coreItemPlain(item){
 return {
  question:String(item.question||''),
  attempt:String(item.attempt||''),
  difficulty:String(item.difficulty||''),
  ref:{name:String(item.ref?.name||''),page:Number(item.ref?.page)||1,path:String(item.ref?.path||'')}
 };
}

/* ---------- desenho ---------- */

/* A tela é UM quadro (núcleo `reviewBoard`): à esquerda o item do dia — o
   progresso, o cartão e o "Como foi?" —, à direita "Todos os itens". Os itens
   vêm da agenda (`studyReviewToday` → `all`), que já traz o id estável, quando
   volta e o intervalo atual; sem agenda (host de teste) cai para a lista
   guardada, com tudo vencendo hoje.

   `done` conta o que o aluno já marcou nesta abertura: o "1 de 3" não volta a
   "1 de 2" a cada item que sai da fila. */

const board={data:null,selected:'',done:0,sequence:0};

function savedLabel(at){
 const time=Number(at);
 if(!Number.isFinite(time)||time<=0)return '';
 const date=new Date(time);
 return formatDate(date,{day:'numeric',month:'short'});
}

function warnOf(state){
 if(state==='missing')return message('review.warn.missing');
 if(state==='outside')return message('review.warn.outside');
 return '';
}

function entryOf(item){
 return {
  id:String(item.id||''),
  question:String(item.question||''),
  attempt:String(item.attempt||''),
  difficulty:String(item.difficulty||''),
  ref:coreRef(item.ref),
  due:item.active!==false&&item.dueNow!==false,
  when:String(item.nextLabel||message('review.when.today')),
  saved:savedLabel(item.createdAt),
  interval:wholeNat(item.interval),
  warn:warnOf(item.refState)
 };
}

function scheduleItems(){
 if(board.data)return board.data.items;
 return items().map((item,index)=>({...item,id:`item-${index}`,dueNow:true,active:true,nextLabel:message('review.when.today')}));
}

function courseName(){
 const courses=Array.isArray(S.appConfig?.courses)?S.appConfig.courses:[];
 const one=courses.find(course=>String(course.id)===String(S.currentCourseId));
 return String(one?.name||'');
}

function toList(array){
 return array.reduceRight((tail,head)=>({$:'Con',head,tail}),{$:'Nil'});
}

function focusKey(){
 const node=document.activeElement;
 const view=$('#review-view');
 if(!node||!view||!view.contains(node))return null;
 const id=node.dataset?.id;
 const cls=['review-row','review-redo','review-similar','review-grade'].find(name=>node.classList.contains(name));
 return cls&&id?{cls,id,result:node.dataset.result||''}:null;
}

function restoreFocus(key){
 if(!key)return;
 const selector=`.${key.cls}[data-id="${CSS.escape(key.id)}"]${key.result?`[data-result="${CSS.escape(key.result)}"]`:''}`;
 const node=$('#review-view')?.querySelector(selector);
 if(node)node.focus({preventScroll:true});
}

function paint(){
 const entries=scheduleItems().filter(item=>item.active!==false).map(entryOf);
 const known=Boolean(board.data);
 const due=entries.filter(entry=>entry.due).length;
 const key=focusKey();
 const bar=$('#review-bar');
 if(bar)renderChildren(bar,[reviewCore.reviewBar(courseName(),toNat(due),toNat(entries.length),known)]);
 const view=$('#review-view');
 if(!view)return;
 renderChildren(view,reviewCore.reviewBoard(toList(entries),String(board.selected||''),toNat(board.done),true));
 for(const kid of view.querySelectorAll('.review-card .review-question'))kid.tabIndex=-1;
 restoreFocus(key);
}

async function refresh(){
 const api=window.desk;
 if(typeof api?.studyReviewToday!=='function')return;
 const sequence=++board.sequence;
 try{
  const data=await api.studyReviewToday();
  if(sequence!==board.sequence)return;
  const all=Array.isArray(data?.all)?data.all:(Array.isArray(data?.items)?data.items:[]);
  board.data={items:all,summary:data?.summary||null};
  paint();
 }catch(error){
  if(sequence===board.sequence)toast(t('review.loadFailed',{reason:uiText(error.message)}));
 }
}

export function drawReview(){
 paint();
 refresh();
}

function selectReview(id){
 board.selected=String(id||'');
 paint();
}

async function gradeReview(id,result){
 const api=window.desk;
 if(!id||typeof api?.studyReviewGrade!=='function')return;
 const wasDue=scheduleItems().find(item=>String(item.id)===String(id))?.dueNow!==false;
 try{
  const graded=await api.studyReviewGrade({id,result});
  if(wasDue)board.done+=1;
  board.selected='';
  toast(graded?.explain||message('review.graded'));
  await refresh();
  $('#review-view .review-card .review-question')?.focus({preventScroll:true});
 }catch(error){
  toast(error.message);
 }
}

function entryItem(id){
 return scheduleItems().find(item=>String(item.id)===String(id))||null;
}

/* ---------- a aba ---------- */

export function activateReview(){
 S.reviewActive=true;
 $('#references')?.classList.add('review');
 const bar=$('#review-bar'),view=$('#review-view');
 if(bar)bar.hidden=false;
 if(view)view.hidden=false;
 markCourseTab('review');
 board.done=0;board.selected='';board.data=null;
 updateContextSummary();
 drawReview();
}

export function deactivateReview(){
 S.reviewActive=false;
 $('#references')?.classList.remove('review');
 const bar=$('#review-bar'),view=$('#review-view');
 if(bar)bar.hidden=true;
 if(view)view.hidden=true;
}

function closeTab(){
 deactivateReview();
 markCourseTab(S.currentCourseId||'');
}

/* ---------- prompts (as duas ações de cada item) ---------- */

function items(){return Array.isArray(S.reviewItems)?S.reviewItems:[];}

function promptFor(item,kind){
 if(!item)return '';
 const prompt=reviewPrompt(coreItemPlain(item),kind);
 return prompt.length>MAX_PROMPT_CHARS?prompt.slice(0,MAX_PROMPT_CHARS):prompt;
}

function usePrompt(id,kind){
 const text=promptFor(entryItem(id),kind);
 if(!text)return;
 const prompt=$('#prompt');
 if(!prompt)return;
 prompt.value=text;
 prompt.focus();
 prompt.setSelectionRange?.(text.length,text.length);
 updateContextSummary();
 toast(message(kind==='redo'?'review.promptReady.redo':'review.promptReady.similar'));
}

/* ---------- salvar e remover ---------- */

async function saveReview(payload){
 try{
  const saved=await window.desk.reviewSave({...payload,courseId:S.currentCourseId});
  /* O `reviewSave` do host continua devolvendo array; a remoção com Desfazer
     responde `{items, undoToken, undoExpiresAt}` — as duas formas valem. */
  S.reviewItems=Array.isArray(saved)?saved:(Array.isArray(saved?.items)?saved.items:[]);
  board.data=null;
  drawReview();
  if(typeof saved?.undoToken==='string'&&saved.undoToken){
   showUndoNotice({
    kind:'review',
    token:saved.undoToken,
    expiresAt:saved.undoExpiresAt,
    scopeKey:String(S.currentCourseId||''),
    scopeNow:()=>String(S.currentCourseId||''),
    onUndone:result=>{
     if(Array.isArray(result?.items)){S.reviewItems=result.items;board.data=null;drawReview();}
    }
   }).catch(error=>console.error('Desfazer do caderno:',error?.message||error));
  }
  return true;
 }catch(err){
  toast(err.message);
  return false;
 }
}

/* Remover e editar vão pelo REGISTRO clicado (a identidade: mesma questão no
   mesmo material), como o host e o núcleo fazem — a posição da linha na tela não
   serve porque a lista é filtrada. */
async function removeItem(id){
 const item=entryItem(id);
 if(!item)return;
 if(!confirm(t('review.confirmRemove',{question:item.question.slice(0,60)})))return;
 if(await saveReview({mode:'remove',item:coreItemPlain(item)}))toast(message('review.removed'));
}

/* ---------- o diálogo ---------- */

/* A dica do diálogo diz também quando o PDF da referência não está à mão. */
function refStateSuffix(state){
 if(state==='missing')return ` · ${t('review.ref.stateMissing')}`;
 if(state==='outside')return ` · ${t('review.ref.stateOutside')}`;
 return '';
}

export function openReviewDialog({mode='add',item,ref}={}){
 const dialog=dialogOf();
 if(!dialog)return;
 window.desk.reviewDraftCancel?.(dialog._draftId).catch(()=>{});
 dialog._draftId='';dialog._dirty=new Set();
 const source=item||{};
 const reference=ref||source.ref||openRefOf();
 dialog._mode=mode;
 /* A origem da edição: o registro como estava quando o diálogo abriu. É por ele
    que o host acha o item no arquivo (mesmo que a lista tenha mudado entre o
    clique e o Salvar). */
 dialog._key=mode==='edit'?coreItem(source):null;
 dialog._ref=coreRef(reference);
 renderReview(
  String(source.question||''),
  String(source.attempt||''),
  String(source.difficulty||''),
  uiText(reviewCore.refHint(coreRef(reference)))+refStateSuffix(source.refState)
 );
 if(!dialog.open)dialog.showModal();
}

/* A tentativa vem da mensagem DO USUÁRIO que aquela resposta do Pi estava
   respondendo (a última `.message.user` antes da resposta clicada). Antes vinha
   sempre a PRIMEIRA do histórico, que não tem nada a ver com o que está sendo
   guardado. Numa ação geral (sem resposta na mão), a última do histórico é a
   pertinente. */
function attemptFrom(node){
 const root=$('#messages');
 if(!root)return '';
 const users=[...root.querySelectorAll('.message.user .body')];
 if(!users.length)return '';
 const before=node?users.filter(body=>body.compareDocumentPosition(node)&Node.DOCUMENT_POSITION_FOLLOWING):users;
 return String((before.length?before:users).at(-1)?.innerText||'');
}

/* Guardar a partir de uma mensagem do Pi: o que já existe na tela vira o
   rascunho do item. */
function draftStatus(text){
 const dialog=dialogOf(),form=dialog?.querySelector('#review-form');
 if(!form)return;
 const current=form.querySelector('#review-draft-status');
 if(current)current.textContent=uiText(text);
 else form.insertBefore(build(reviewCore.draftStatus(text)),form.lastElementChild);
}

export function openReviewFromMessage(node=null){
 const selection=String(window.getSelection?.()?.toString()||'').trim();
 const attempt=attemptFrom(node).trim(),ref=openRefOf();
 const question=String($('#exercise-title')?.value||'').trim();
 openReviewDialog({mode:'add',item:{question,attempt:attempt.slice(0,400),difficulty:selection.slice(0,240),ref}});
 const dialog=dialogOf();
 /* Guardado a partir da resposta: o chip dela toca o marcador enchendo (#61). */
 if(dialog)dialog._fromMessage=node;
 const answer=String(node?._raw||node?.querySelector('.body')?.innerText||'');
 if(!dialog||!answer.trim())return;
 /* Motor sem geração auxiliar (Claude nesta versão): o caderno manual continua,
    mas a sugestão automática não é pedida — nada de fallback silencioso no Pi. */
 if(!supportsCapability('reviewDraft')){
  if(window.desk.reviewDraft)draftStatus(message('review.draft.unavailable'));
  return;
 }
 if(!window.desk.reviewDraft)return;
 const id=`review-${Date.now()}-${++draftSequence}`;dialog._draftId=id;
 draftStatus(message('review.draft.preparing'));
 window.desk.reviewDraft({id,question,attempt,answer,selection,ref}).then(item=>{
  for(const key of ['question','attempt','difficulty']){
   const field=dialog.querySelector(`#review-${key}`);
   if(field&&reviewCore.canFillDraft(dialog.open,dialog._draftId===id,!dialog._dirty.has(key)))field.value=String(item[key]||'');
  }
  if(dialog.open&&dialog._draftId===id)draftStatus(message('review.draft.ready'));
 }).catch(error=>{
  if(dialog.open&&dialog._draftId===id)draftStatus(message('review.draft.failed',{reason:error.message}));
 });
}
let draftSequence=0;
$('#review-dialog')?.addEventListener('input',event=>{
 const key=event.target?.id?.replace(/^review-/,'');
 if(['question','attempt','difficulty'].includes(key))dialogOf()._dirty?.add(key);
});

$('#review-dialog')?.addEventListener('close',event=>{
 const dialog=event.currentTarget;
 const fromMessage=dialog._fromMessage;dialog._fromMessage=null;
 window.desk.reviewDraftCancel?.(dialog._draftId).catch(()=>{});dialog._draftId='';
 if(dialog.returnValue!=='ok')return;
 const item={
  question:String(dialog.querySelector('#review-question')?.value||''),
  attempt:String(dialog.querySelector('#review-attempt')?.value||''),
  difficulty:String(dialog.querySelector('#review-difficulty')?.value||''),
  ref:dialog._ref||openRefOf()
 };
 const mode=dialog._mode==='edit'?'edit':'add';
 const payload=mode==='edit'?{mode,key:dialog._key,item}:{mode:'add',item};
 saveReview(payload).then(saved=>{
  if(!saved)return;
  if(mode==='add')flashMark(fromMessage?.querySelector('.msg-review'),savedMark(),t('talk.saved'));
  toast(message(mode==='edit'?'review.updated':'review.saved'));
 });
});

/* ---------- os cliques da lista ---------- */

const reviewHandlers={
 CloseReview:()=>closeTab(),
 EditReview:event=>{
  const item=entryItem(event.currentTarget.dataset.id);
  if(item)openReviewDialog({mode:'edit',item:coreItemPlain(item)});
 },
 SimilarReview:event=>usePrompt(event.currentTarget.dataset.id,'similar'),
 RedoReview:event=>usePrompt(event.currentTarget.dataset.id,'redo'),
 RemoveReview:event=>removeItem(event.currentTarget.dataset.id),
 GradeReview:event=>gradeReview(event.currentTarget.dataset.id,event.currentTarget.dataset.result),
 SelectReview:event=>selectReview(event.currentTarget.dataset.id),
 OpenReviewRef:event=>{
  const button=event.currentTarget;
  closeTab();
  openRef(button.dataset.name||'',Number(button.dataset.page)||1,button.dataset.path||'');
 }
};

/* A lista (e a barra) são re-montadas pelo núcleo a cada mudança, então os
   cliques são delegados no contêiner — a classe do botão diz qual ação é. */
function handlerFrom(node){
 const fromAttr=reviewHandlers[node.dataset?.handler||''];
 if(fromAttr)return fromAttr;
 if(node.classList?.contains('review-close'))return reviewHandlers.CloseReview;
 if(node.classList?.contains('review-edit'))return reviewHandlers.EditReview;
 if(node.classList?.contains('review-grade'))return reviewHandlers.GradeReview;
 if(node.classList?.contains('review-row'))return reviewHandlers.SelectReview;
 if(node.classList?.contains('review-similar'))return reviewHandlers.SimilarReview;
 if(node.classList?.contains('review-redo'))return reviewHandlers.RedoReview;
 if(node.classList?.contains('review-remove'))return reviewHandlers.RemoveReview;
 if(node.classList?.contains('review-ref'))return reviewHandlers.OpenReviewRef;
 return null;
}

function delegate(container){
 container?.addEventListener('click',event=>{
  const button=event.target?.closest?.('button');
  if(!button)return;
  const handler=handlerFrom(button);
  if(!handler)return;
  event.preventDefault();
  handler({currentTarget:button});
 });
}

delegate($('#review-view'));
delegate($('#review-bar'));

/* Trocar de matéria/conversa desativa o aviso de Desfazer: o token vale no
   escopo de onde o item saiu. A troca também é barrada pelo host, e os dados de
   recuperação continuam lá até o prazo. */
if(typeof window!=='undefined'&&typeof window.addEventListener==='function'){
 window.addEventListener('desk-conversation-changed',()=>cancelUndoNotice());
}
