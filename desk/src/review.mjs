import {$,S,toast,markCourseTab,updateContextSummary} from './state.mjs';
import {build,renderChildren} from './view-host.mjs';
import {renderReview} from './dialogs.mjs';
import {openRef} from './nav.mjs';
import reviewCore from './generated/review.core.js';

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

const listOf=()=>$('#review-list');
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
 return {name:String(source.name||''),page:BigInt(Math.max(1,Math.trunc(Number(source.page)||1))),path:String(source.path||'')};
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

/* ---------- desenho ---------- */

export function drawReview(){
 const items=Array.isArray(S.reviewItems)?S.reviewItems:[];
 const bar=$('#review-bar');
 if(bar)renderChildren(bar,[reviewCore.reviewBar(BigInt(items.length))]);
 const list=listOf();
 if(!list)return;
 const coreItems=items.reduceRight((tail,head)=>({$:'Con',head:coreItem(head),tail}),{$:'Nil'});
 renderChildren(list,items.length?reviewCore.reviewRows(coreItems):[reviewCore.reviewEmpty()]);
}

/* ---------- a aba ---------- */

export function activateReview(){
 S.reviewActive=true;
 $('#references')?.classList.add('review');
 const bar=$('#review-bar'),view=$('#review-view');
 if(bar)bar.hidden=false;
 if(view)view.hidden=false;
 markCourseTab('review');
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

function promptFor(index,kind){
 const item=items()[index];
 if(!item)return '';
 const core=coreItem(item);
 const text=kind==='redo'?reviewCore.redoPrompt(core):reviewCore.similarPrompt(core);
 return text.length>MAX_PROMPT_CHARS?text.slice(0,MAX_PROMPT_CHARS):text;
}

function usePrompt(index,kind){
 const text=promptFor(index,kind);
 if(!text)return;
 const prompt=$('#prompt');
 if(!prompt)return;
 prompt.value=text;
 prompt.focus();
 prompt.setSelectionRange?.(text.length,text.length);
 updateContextSummary();
 toast(kind==='redo'?'Prompt de refazer no composer.':'Prompt de exercício semelhante no composer.');
}

/* ---------- salvar e remover ---------- */

async function saveReview(payload){
 try{
  const saved=await window.desk.reviewSave({...payload,courseId:S.currentCourseId});
  S.reviewItems=Array.isArray(saved)?saved:[];
  drawReview();
  return true;
 }catch(err){
  toast(err.message);
  return false;
 }
}

/* Remover e editar vão pelo REGISTRO clicado (a identidade: mesma questão no
   mesmo material), como o host e o núcleo fazem — a posição da linha na tela não
   serve porque a lista é filtrada. */
async function removeItem(index){
 const item=items()[index];
 if(!item)return;
 if(!confirm(`Remover do caderno: ${item.question.slice(0,60)}?`))return;
 if(await saveReview({mode:'remove',item}))toast('Item removido do caderno.');
}

/* ---------- o diálogo ---------- */

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
  reviewCore.refHint(coreRef(reference))
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
 if(current)current.textContent=text;
 else form.insertBefore(build(reviewCore.draftStatus(text)),form.lastElementChild);
}

export function openReviewFromMessage(node=null){
 const selection=String(window.getSelection?.()?.toString()||'').trim();
 const attempt=attemptFrom(node).trim(),ref=openRefOf();
 const question=String($('#exercise-title')?.value||'').trim();
 openReviewDialog({mode:'add',item:{question,attempt:attempt.slice(0,400),difficulty:selection.slice(0,240),ref}});
 const dialog=dialogOf();
 const answer=String(node?._raw||node?.querySelector('.body')?.innerText||'');
 if(!dialog||!answer.trim()||!window.desk.reviewDraft)return;
 const id=`review-${Date.now()}-${++draftSequence}`;dialog._draftId=id;
 draftStatus('Preparando sugestão do Pi… Você pode editar os campos.');
 window.desk.reviewDraft({id,question,attempt,answer,selection,ref}).then(item=>{
  for(const key of ['question','attempt','difficulty']){
   const field=dialog.querySelector(`#review-${key}`);
   if(field&&reviewCore.canFillDraft(dialog.open,dialog._draftId===id,!dialog._dirty.has(key)))field.value=String(item[key]||'');
  }
  if(dialog.open&&dialog._draftId===id)draftStatus('Sugestão do Pi pronta. Revise ou edite antes de guardar.');
 }).catch(error=>{
  if(dialog.open&&dialog._draftId===id)draftStatus(`Não foi possível preparar a sugestão: ${error.message} Preencha os campos para guardar.`);
 });
}
let draftSequence=0;
$('#review-dialog')?.addEventListener('input',event=>{
 const key=event.target?.id?.replace(/^review-/,'');
 if(['question','attempt','difficulty'].includes(key))dialogOf()._dirty?.add(key);
});

$('#review-dialog')?.addEventListener('close',event=>{
 const dialog=event.currentTarget;
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
  if(saved)toast(mode==='edit'?'Item atualizado.':'Guardado no caderno de revisão.');
 });
});

/* ---------- os cliques da lista ---------- */

const reviewHandlers={
 CloseReview:()=>closeTab(),
 EditReview:event=>{
  const item=items()[Number(event.currentTarget.dataset.id)||0];
  if(item)openReviewDialog({mode:'edit',item});
 },
 SimilarReview:event=>usePrompt(Number(event.currentTarget.dataset.id)||0,'similar'),
 RedoReview:event=>usePrompt(Number(event.currentTarget.dataset.id)||0,'redo'),
 RemoveReview:event=>removeItem(Number(event.currentTarget.dataset.id)||0),
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
 if(node.classList?.contains('review-open'))return reviewHandlers.EditReview;
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

delegate($('#review-list'));
delegate($('#review-bar'));
