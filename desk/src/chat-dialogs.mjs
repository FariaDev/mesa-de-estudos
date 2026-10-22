import {$,S,activity,followBottom} from './state.mjs';
import talkCore from './generated/talkview.core.js';
import {build,htmlNode,preserveFocus} from './view-host.mjs';
import {markup,markupInline} from './markdown.mjs';
import {renderPiDialog} from './dialogs.mjs';
import {MAX_ANSWER_CHARS,questionRequest,questionSubmitAction} from './claude-questions.mjs';
import {hydrateAssets,bendList} from './chat-assets.mjs';
import {t,text as uiText} from './ui-text.mjs';
import {message} from './i18n.mjs';

/* Diálogos do tutor, quiz e perguntas estruturadas (extraído de chat.mjs, #29).
   A fila (`dialogQueue`), o diálogo aberto e o contador de closes ignorados
   moram aqui e só aqui; o handler de eventos do chat chama `showDialog`,
   `cancelDialogRequest` e `decorateQuizCard`. */
const dialogQueue=[];let currentDialog=null,ignoredDialogCloses=0;
export function showDialog(e){dialogQueue.push(e);if(currentDialog)return;nextDialog();}
function respondDialog(data){window.desk.respond(data).catch(error=>console.warn('resposta ao tutor não entregue:',error?.message||error));currentDialog=null;nextDialog();}
function cancelQuiz(id){
 for(const entry of S.quizQueue){
  if(!entry.card||entry.card._talkQuiz?.dialogId!==id)continue;
  const state=entry.card._talkQuiz;
  state.answered=true;state.result={details:{status:'cancelled'}};
  paintQuiz(state);
 }
}
function currentQuiz(){return S.quizQueue.find(entry=>!entry.card)||null;}
function quizSelect(e){return e.method==='select'&&Array.isArray(e.options)&&(!!currentQuiz()||/^Quiz\b/i.test(e.title||''));}
function quizMulti(e){return /^Quiz \(múltipla escolha\)/.test(e.title||'')||!!currentQuiz()?.args?.multiSelect;}
function quizQuestion(e){const match=/^Quiz(?: \(múltipla escolha\))? · ([\s\S]*)$/.exec(e.title||'');return String(currentQuiz()?.args?.question||match?.[1]||'Quiz').trim();}
function quizOptionRows(state){
 const details=state.result?.details,correct=new Set(details?.correctIndices||[]),selected=new Set((details?.answers||[]).map(a=>a.index));
 return state.labels.map((label,offset)=>{
  const index=offset+1;let good=false,bad=false,dim=false,mark='';
  if(details&&details.status!=='cancelled'&&details.status!=='unavailable'){
   if(details.dontKnow){if(correct.has(index)){good=true;mark='✓';}else dim=true;}
   else if(selected.has(index)&&correct.has(index)){good=true;mark='✓';}
   else if(selected.has(index)){bad=true;mark='✗';}
   else if(correct.has(index)){good=true;mark='✓';}
   else dim=true;
  }
  return {$:'QuizOptionRow',label,index:String(index),markup:htmlNode(markupInline(label)),checked:state.chosen.has(label),disabled:state.answered,correct:good,wrong:bad,dim,mark};
 });
}
function quizVerdict(state){
 const details=state.result?.details,status=details?.status;
 if(!state.result)return '';
 if(!details||status==='cancelled'||status==='unavailable')return status==='cancelled'?message('quiz.cancelled'):(details?.message||message('quiz.ended'));
 return message(details.dontKnow?'quiz.dontKnow':details.correct?'quiz.correct':'quiz.incorrect');
}
function quizRow(state){
 const details=state.result?.details||{},verdict=quizVerdict(state);
 return {
  $:'QuizRow',toolId:state.toolId,multi:state.multi,
  question:htmlNode(markup(state.question)),hasDetails:!!state.details,details:htmlNode(markupInline(state.details||'')),
  options:bendList(quizOptionRows(state)),showSend:state.multi&&!state.answered,sendDisabled:state.chosen.size===0,showSkip:!state.answered,
  hasVerdict:!!verdict,verdict,hasNote:!!details.note,note:htmlNode(markupInline(details.note||'')),
  hasExplain:!!details.explanation,explain:htmlNode(markup(details.explanation||'')),
 };
}
function paintQuiz(state,{append=false}={}){
 const messages=$('#messages'),old=state.card;
 const handlers={
  SelectQuizOption(event){
   if(state.answered)return;
   const label=event.currentTarget.dataset.label||'';
   if(state.multi){if(state.chosen.has(label))state.chosen.delete(label);else state.chosen.add(label);paintQuiz(state);return;}
   state.chosen.add(label);state.answered=true;paintQuiz(state);respondDialog({id:state.dialogId,value:label});
  },
  SendQuiz(){
   if(state.answered||!state.chosen.size)return;
   state.answered=true;paintQuiz(state);respondDialog({id:state.dialogId,value:JSON.stringify([...state.chosen])});
  },
  SkipQuiz(){if(state.answered)return;state.answered=true;paintQuiz(state);respondDialog({id:state.dialogId,cancelled:true});},
 };
 let card=null;
 const render=()=>{
  card=build(talkCore.quizCard(quizRow(state)),handlers);
  card._answered=state.answered;card._talkQuiz=state;
  if(append||!old?.isConnected)messages.append(card);else old.replaceWith(card);
  state.card=card;hydrateAssets(card);
 };
 /* O restore global busca a key em #messages; as keys `quiz-option-N` repetem
    entre cards, então ele pode achar a opção (já disabled) de um card anterior
    e o `focus()` virar no-op. Depois do render, o foco é corrigido dentro do
    card que acabou de ser pintado. */
 const active=document.activeElement;
 const scopedKey=old?.isConnected&&old.contains(active)?(active.dataset?.key||active.id||''):'';
 if(old?.isConnected)preserveFocus(messages,render);else render();
 if(scopedKey&&card){
  const next=card.querySelector(`[data-key="${CSS.escape(scopedKey)}"]`)||card.querySelector(`#${CSS.escape(scopedKey)}`);
  if(next&&!next.disabled)next.focus();
 }
 return state.card;
}
function renderQuizCard(e){
 const quiz=currentQuiz();
 const state={dialogId:e.id,toolId:quiz?.id||'',multi:quizMulti(e),question:quizQuestion(e),details:quiz?.args?.details||'',labels:(e.options||[]).map(String),chosen:new Set(),answered:false,result:null,card:null};
 const card=paintQuiz(state,{append:true});followBottom(true);
 if(quiz)quiz.card=card;
 card.querySelector('.quiz-option')?.focus();
 activity(message('quiz.waiting'));
}
export function decorateQuizCard(card,result){
 const state=card?._talkQuiz;if(!state)return;
 state.answered=true;state.result=result;paintQuiz(state);
}
function dialogOptions(options){
 let out={$:'Nil'};
 for(let i=options.length-1;i>=0;i--)out={$:'Con',head:{$:'DialogOption',label:String(options[i]),value:String(options[i])},tail:out};
 return out;
}
function dialogField(e){
 if(e.method==='select')return {$:'FieldPick',label:'',value:String(e.prefill||''),options:dialogOptions(e.options||[])};
 if(e.method==='editor')return {$:'FieldEditor',label:'',value:String(e.prefill||''),hint:String(e.placeholder||'')};
 if(e.method==='input')return {$:'FieldText',label:'',value:String(e.prefill||''),hint:String(e.placeholder||'')};
 return null;
}
/* Perguntas estruturadas (AskUserQuestion) no MESMO casco do #pi-dialog: o
   formulário vive no #dialog-fields, rótulos/descrições entram como TEXTO
   (nunca HTML) e as respostas saem por `compileQuestionAnswers` (módulo puro).
   Texto livre e opções marcadas são excludentes nos dois sentidos: digitar
   limpa as opções, marcar limpa o texto — a resposta nunca mistura os dois. */
function questionBlock(question,index){
 const block=document.createElement('section');
 block.className='cq-question';
 block.dataset.cqIndex=String(index);
 if(question.header){
  const header=document.createElement('h3');header.className='cq-header';header.textContent=uiText(question.header);block.append(header);
 }
 const text=document.createElement('p');text.className='cq-text';text.textContent=question.question;block.append(text);
 const group=document.createElement('div');
 group.className='cq-options';
 group.setAttribute('role',question.multiSelect?'group':'radiogroup');
 group.setAttribute('aria-label',question.question);
 for(const option of question.options){
  const label=document.createElement('label');label.className='cq-option';
  const input=document.createElement('input');
  input.type=question.multiSelect?'checkbox':'radio';
  input.name=`cq-${index}`;
  input.value=option.label;
  label.append(input);
  const body=document.createElement('span');body.className='cq-option-body';
  const name=document.createElement('span');name.className='cq-option-label';name.textContent=option.label;body.append(name);
  if(option.description){const desc=document.createElement('span');desc.className='cq-option-desc';desc.textContent=option.description;body.append(desc);}
  label.append(body);group.append(label);
 }
 block.append(group);
 const other=document.createElement('label');other.className='cq-other';
 const otherLabel=document.createElement('span');otherLabel.className='cq-other-label';otherLabel.textContent=t('dialog.otherAnswer');
 const free=document.createElement('input');
 free.type='text';free.className='cq-text-input';free.maxLength=MAX_ANSWER_CHARS;free.autocomplete='off';
 free.placeholder=t(question.multiSelect?'dialog.typeOther':'dialog.typeAnswer');
 other.append(otherLabel,free);block.append(other);
 free.addEventListener('input',()=>{
  if(free.value)for(const input of group.querySelectorAll('input'))input.checked=false;
  clearQuestionError(block);
 });
 group.addEventListener('change',()=>{
  if(free.value)free.value='';
  clearQuestionError(block);
 });
 return block;
}
function clearQuestionError(block){
 block.classList.remove('cq-invalid');
 block.querySelector('.cq-error')?.remove();
 for(const input of block.querySelectorAll('[aria-invalid]'))input.removeAttribute('aria-invalid');
}
function focusQuestionErrors(errors){
 let first=null;
 for(const error of errors){
  const block=$('#dialog-fields').querySelector(`.cq-question[data-cq-index="${error.index}"]`);
  if(!block)continue;
  block.classList.add('cq-invalid');
  let note=block.querySelector('.cq-error');
  if(!note){note=document.createElement('p');note.className='cq-error';note.setAttribute('role','alert');block.append(note);}
  note.textContent=uiText(error.message);
  if(!first)first=block.querySelector('.cq-option input,.cq-text-input');
 }
 first?.focus();
}
function collectQuestionPicks(questions){
 const box=$('#dialog-fields');
 return questions.map((question,index)=>{
  const block=box.querySelector(`.cq-question[data-cq-index="${index}"]`);
  if(!block)return {selected:[],text:''};
  return {selected:[...block.querySelectorAll('.cq-option input:checked')].map(input=>input.value),text:block.querySelector('.cq-text-input')?.value||''};
 });
}
function showQuestionDialog(e,questions){
 const dialog=$('#pi-dialog');
 dialog.dataset.permission='true';
 dialog.dataset.question='true';
 dialog._questionList=questions;
 renderPiDialog({title:e.title||t('dialog.tutorQuestion'),message:e.message||'',field:null},{inline:markupInline});
 $('#dialog-fields').replaceChildren(...questions.map(questionBlock));
 $('#dialog-ok').textContent=t('dialog.answer');
 dialog._requestId=String(e.id||'');
 dialog._questionDraft=null;
 dialog.returnValue='';
 dialog.showModal();
 $('#dialog-fields').querySelector('.cq-option input,.cq-text-input')?.focus();
}
/* O submit do casco é o único caminho que fecha com `returnValue='ok'`; a
   validação mora aqui para o diálogo NÃO fechar sem resposta (o adaptador
   recusa faltantes). Só o botão Responder (`value='ok'`) exige respostas: o
   Cancelar submete pelo mesmo evento e precisa fechar SEMPRE, mesmo com o
   formulário vazio — sem botão identificado, mantém o caminho exigente. Enter
   em campo do formulário clica o `#dialog-ok` (keydown acima), então cai no
   mesmo caminho do Responder. */
function nextDialog(){const e=dialogQueue.shift();S.dialogPending=!!e;if(!e)return;currentDialog=e;
 const dialog=$('#pi-dialog');
 dialog._questionDraft=null;
 dialog._questionList=null;
 if(quizSelect(e)){renderQuizCard(e);return;}
 if(e.method==='question'){
  const request=questionRequest(e.questions);
  if(!request.ok){respondDialog({id:e.id,cancelled:true});return;}
  showQuestionDialog(e,request.questions);
  return;
 }
 delete dialog.dataset.question;
 $('#dialog-ok').textContent=t('dialog.continue');
 dialog.dataset.permission=e.permission===true?'true':'false';
 renderPiDialog({title:e.title||(t(e.permission===true?'dialog.permission':'dialog.tutor')),message:e.message||'',field:dialogField(e)},{inline:markupInline});
 dialog._requestId=String(e.id||'');
 dialog.returnValue='';
 dialog.showModal();}

/* Pedido interativo vencido (cancelamento/perda da execução): o diálogo daquele
   id sai da fila e o aberto é fechado SEM resposta — nada de responder um pedido
   que não existe mais. */
export function cancelDialogRequest(id){
 let removed=false;
 for(let i=dialogQueue.length-1;i>=0;i--)if(dialogQueue[i].id===id){dialogQueue.splice(i,1);removed=true;}
 if(currentDialog&&currentDialog.id===id){
  const dialog=$('#pi-dialog');
  currentDialog=null;
  if(dialog){dialog._requestId='';dialog._questionDraft=null;if(dialog.open){ignoredDialogCloses++;dialog.returnValue='cancel';dialog.close();}}
  nextDialog();
  removed=true;
 }
 if(removed)S.dialogPending=!!currentDialog||dialogQueue.length>0;
 cancelQuiz(id);
}
/* Os listeners do casco entram na mesma posição em que o chat sempre os
   registrou (depois do handler de eventos), por isso são instalados pelo chat. */
export function installDialogListeners(){
 $('#pi-dialog form')?.addEventListener('submit',event=>{
  if(!currentDialog||currentDialog.method!=='question')return;
  const dialog=$('#pi-dialog');
  const questions=Array.isArray(dialog._questionList)?dialog._questionList:[];
  const action=questionSubmitAction(questions,collectQuestionPicks(questions),event.submitter?event.submitter.value:null);
  if(action.action==='cancel')return;
  if(action.action==='invalid'){event.preventDefault();focusQuestionErrors(action.errors);return;}
  dialog._questionDraft={id:String(currentDialog.id||''),answers:action.answers};
 });
 $('#dialog-fields')?.addEventListener('keydown',event=>{
  if(!currentDialog||currentDialog.method!=='question')return;
  if(event.key!=='Enter'||event.shiftKey||event.isComposing)return;
  if(!(event.target instanceof HTMLInputElement))return;
  event.preventDefault();
  $('#dialog-ok').click();
 });
 /* O fechamento só responde ao pedido que ESTE diálogo estava mostrando: um
    `agent_request_cancelled` pode abrir o diálogo seguinte antes do evento de
    close do anterior, e a resposta não pode vazar para o pedido novo. */
 $('#pi-dialog').addEventListener('close',()=>{
  // Native close events are queued. Revoking A may already have opened B on
  // this same element; A's delayed close must not read or clear B's identity.
  if(ignoredDialogCloses){ignoredDialogCloses--;return;}
  const dialog=$('#pi-dialog');
  const requestId=dialog._requestId||'';
  dialog._requestId='';
  const e=currentDialog&&currentDialog.id===requestId?currentDialog:null;
  if(!e){dialog._questionDraft=null;return;}
  const ok=dialog.returnValue==='ok';
  if(e.method==='question'){
   const draft=dialog._questionDraft;
   dialog._questionDraft=null;
   respondDialog(ok&&draft&&draft.id===e.id&&draft.answers?{id:e.id,answers:draft.answers}:{id:e.id,cancelled:true});
   return;
  }
  respondDialog(ok?{id:e.id,...(e.method==='confirm'?{confirmed:true}:{value:$('#dialog-value')?.value})}:{id:e.id,cancelled:true});
 });
}
