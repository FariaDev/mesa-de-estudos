import {$,S,toast,refs} from './state.mjs';
import {send,resetAttachments,persistTray} from './chat.mjs';
import core from './generated/composerview.core.js';
import pendingCore from './generated/pending.core.js';
import {build,renderChildren,preserveFocus} from './view-host.mjs';

/* Fila de mensagens da Mesa — espelho da Conversa (`chat/src/features/queue.mjs`)
   sobre o mesmo núcleo (`core/composerview.bend`), com uma diferença que aqui é
   o ponto: a fila SOBREVIVE ao fechamento do app (`desk/pending.cjs`, núcleo
   `core/pending.bend`), por conversa.
   ⏎ com o Pi livre não passa por aqui (o #prompt envia); ocupado, enfileira.
   ⌘/Ctrl+⏎ também não: o #prompt manda como steer (interrompe e envia agora).
   Parar a resposta NÃO descarta mais a fila: `held` a segura e a faixa oferece
   "Enviar agora"; quem descarta é o "Limpar" (com confirmação). Fila lida de
   outra execução nasce `held` (recuperada) e nunca sai sozinha. */
const queue=[];
let seq=0,flushing=false,owner='',sendingId='',editingId='',editDraft='',editJustStarted=false;
/* `rendering` esconde da edição os blurs causados pela própria troca de nós
   (replaceChildren tira o input focado do DOM e dispara blur); `removeIntent`
   marca o clique no × da fila, que só remove — não confirma a edição. */
let rendering=false,removeIntent=false;
/* `held` segura o envio automático; `recovered` é só o rótulo da faixa
   ("Recuperadas · N"). `saveTimer`/`saveSeq` seguram a escrita no texto em
   edição (o arquivo pode ter MBs de anexo; cada tecla não pode virar uma). */
let held=false,recovered=false,saveTimer=0,saveSeq=0;

const Nil={$:'Nil'};
function listOf(xs){
 return xs.reduceRight((tail,head)=>({$:'Con',head,tail}),Nil);
}

/* Texto vivo do input de edição: qualquer re-render da faixa (envio, remoção de
   outra linha) reconstrói o `<input>` a partir do Bend e não pode descartar o
   que o usuário já digitou. */
function liveEditText(item){
 if(item.id!==editingId)return item.text;
 const input=document.querySelector('.queue-edit');
 return input?input.value:editDraft;
}

function rowOf(item){
 const sending=item.id===sendingId;
 return {$:'QueueRow',id:item.id,text:liveEditText(item),sending,enabled:!sending,editing:item.id===editingId};
}

function idFromEvent(e){
 return e.currentTarget?.closest?.('.queue-item')?.dataset?.id||'';
}

/* ---------- disco ---------- */

/* O que vai para o arquivo: texto, referências e anexos do item (o snapshot do
   composer no momento do enqueue), nunca o estado vivo do DOM. */
function snapshot(){
 return queue.map(item=>({id:item.id,text:item.text,refs:item.payload.refs,images:item.payload.images}));
}

/* Escrita imediata nas mudanças discretas (enfileirar, remover, enviar, limpar)
   e com atraso no texto em edição. A resposta mais nova é a única que avisa:
   os toasts do teto de disco não podem repetir a cada escrita. */
function persist(immediate=false){
 if(S.currentSession&&owner&&S.currentSession!==owner)return; // a vez é da conversa de `owner`
 clearTimeout(saveTimer);
 const write=()=>{
  saveTimer=0;
  const mine=++saveSeq;
  window.desk.pendingSave({items:snapshot(),held}).then(out=>{
   if(mine!==saveSeq)return;
   if(out?.trayDropped)toast('A bandeja ficou só nesta sessão: a fila guardada não coube inteira.');
   if(out?.dropped)toast(`${out.dropped} mensagem(ns) do fim da fila ficaram só nesta sessão — envie antes de fechar.`);
  }).catch(e=>toast(e.message));
 };
 if(immediate)write();else saveTimer=setTimeout(write,400);
}

const handlers={
 edit(e){
  const item=queue.find(q=>q.id===idFromEvent(e));
  if(item)beginEdit(item);
 },
 editKey(e){
  if(e.key==='Enter'||e.key===' '){e.preventDefault();handlers.edit(e);}
 },
 remove(e){
  const id=idFromEvent(e);
  if(!id||id===sendingId)return;
  const at=queue.findIndex(q=>q.id===id);
  if(at<0)return;
  queue.splice(at,1);
  if(editingId===id){editingId='';editDraft='';}
  renderQueue();
  persist(true);
 },
 editInput(e){
  if(e.key==='Enter'){e.preventDefault();e.stopPropagation();finishEdit(true,true);}
  else if(e.key==='Escape'){e.preventDefault();e.stopPropagation();finishEdit(false,true);}
 },
 editBlur(){
  if(rendering||removeIntent)return;
  finishEdit(true);
 },
 /* "Enviar agora": a fila estava segurada (recuperada do disco ou parada pelo
    usuário); o usuário assume o comando e o envio começa pelo primeiro item. */
 sendNow(){
  if(!queue.length)return;
  if(S.busy){toast('O Pi está respondendo — pare ou espere para enviar a fila.');return;}
  held=false;
  recovered=false;
  renderQueue();
  persist(true);
  flushQueue();
 },
 /* A única ação que descarta — separada do Parar. */
 clear(){
  if(!queue.length)return;
  if(!confirm('Limpar a fila? As mensagens pendentes serão descartadas.'))return;
  dropQueue('Fila limpa.');
 }
};

/* A fila é por conversa: o `adopt` (boot, troca de conversa, conversa nova) é
   quem manda — e a escrita fica travada enquanto a conversa do main não é a de
   `owner` (uma troca sem `adopt` não pode gravar a fila na conversa errada). */
function dropQueue(reason){
 if(!queue.length)return;
 queue.splice(0);
 sendingId='';
 editingId='';
 recovered=false;
 held=false;
 renderQueue();
 persist(true);
 if(reason)toast(reason);
}

/* Saída animada (~140ms via .closing, CSS); o timeout garante a remoção mesmo
   sem CSS. Reaproveitar a faixa durante a saída cancela o fechamento. */
function closeQueueStrip(strip){
 if(!strip||strip.dataset.closing==='1')return;
 strip.dataset.closing='1';
 strip.classList.add('closing');
 const done=()=>{if(strip.dataset.closing==='1')strip.remove();};
 strip.addEventListener('transitionend',done,{once:true});
 setTimeout(done,180);
}

/* "Enviar agora" aparece sempre que a fila está segurada: o clique é quem
   decide (com o Pi ocupado, ele explica em vez de enviar). */
function canSendNow(){return held&&queue.length>0;}

function renderQueue(){
 const card=$('#composer');
 if(!card)return;
 const current=card.querySelector('.queue-strip');
 if(!queue.length){
  editingId='';editDraft='';
  closeQueueStrip(current);
  return;
 }
 if(current&&current.dataset.closing==='1'){delete current.dataset.closing;current.classList.remove('closing');}
 if(editingId&&!queue.some(item=>item.id===editingId)){editingId='';editDraft='';}
 const many=queue.length>1;
 const tree=core.queueStripView(false,core.queueLabel(recovered,many,String(queue.length)),listOf(queue.map(rowOf)),canSendNow(),true);
 let strip=current;
 if(!strip){
  strip=build(tree,handlers);
  card.prepend(strip);
 }else{
  rendering=true;
  try{preserveFocus(strip,()=>renderChildren(strip,tree.kids,handlers));}
  finally{rendering=false;}
 }
 const input=editingId?strip.querySelector('.queue-edit'):null;
 if(input)input.addEventListener('input',()=>{editDraft=input.value;persist();});
 if(input&&editingId&&editJustStarted){
  editJustStarted=false;
  input.focus();input.select();
 }else if(input&&editingId&&document.activeElement!==input&&!document.activeElement?.closest?.('.queue-strip')){
  /* Re-render durante a edição (envio/remoção): o input novo recebe o foco de
     volta para o usuário não perder a digitação. */
  input.focus();
 }
}

function beginEdit(item){
 if(item.id===sendingId)return;
 editingId=item.id;
 editDraft=item.text;
 editJustStarted=true;
 renderQueue();
}

function finishEdit(keep,refocus){
 if(!editingId)return;
 const item=queue.find(q=>q.id===editingId);
 const input=document.querySelector('.queue-edit');
 editingId='';
 editDraft='';
 editJustStarted=false;
 if(keep&&item&&input){
  const next=input.value.trim();
  if(!next){
   const at=queue.indexOf(item);
   if(at>=0)queue.splice(at,1);
  }else item.text=next;
 }
 renderQueue();
 persist(true);
 /* Enter/Esc salvam ou cancelam pelo teclado: o input some no re-render e o
    foco ficaria no body. Devolve ao composer (o blur do mouse não passa aqui). */
 if(refocus)$('#prompt')?.focus();
}

function enqueue(text){
 seq++;
 /* O item leva o snapshot do composer (anexos e as referências abertas agora) e
    o composer esvazia: o payload desta mensagem não pode vazar para as próximas
    nem ser capturado pelo envio anterior (que ainda não voltou). A bandeja
    esvaziada também vai para o disco — senão o anexo ficaria nos dois lugares. */
 queue.push({id:`fila-${Date.now()}-${seq}`,text,payload:{images:S.attachments.slice(),refs:refs()}});
 resetAttachments();
 persistTray();
 renderQueue();
 persist(true);
}

/* ⏎ no #prompt com o Pi ocupado. Captura no document para chegar antes do
   handler do campo (o menu `/`, quando aberto, consome na janela e não deixa
   passar); ⌘/Ctrl+⏎ sai daqui para o #prompt mandar steer. */
function onPromptKeydown(e){
 if(e.isComposing)return;
 if(e.target?.id!=='prompt')return;
 if(e.metaKey||e.ctrlKey)return;
 const el=$('#prompt');
 if(!el)return;
 if(e.key!=='Enter'||e.shiftKey)return;
 if(!S.busy)return;
 const text=el.value.trim();
 if(!text)return;
 e.preventDefault();
 enqueue(text);
 el.value='';
 el.dispatchEvent(new Event('input'));
}

/* send() zera o #prompt depois do Pi aceitar. Se o usuário já estiver
   digitando o próximo rascunho, esse texto não pode sumir. */
function holdDraft(el){
 if(!el)return ()=>{};
 let draft=el.value;
 let caret=el.selectionEnd;
 const onInput=()=>{draft=el.value;caret=el.selectionEnd;};
 el.addEventListener('input',onInput);
 let live=true;
 const restore=()=>{
  if(el.value===draft)return;
  if(el.value!==''){draft=el.value;caret=el.selectionEnd;return;}
  if(!draft)return;
  el.value=draft;
  if(document.activeElement===el){
   const pos=Math.min(Math.max(0,caret),el.value.length);
   try{el.setSelectionRange(pos,pos);}catch{}
  }
  el.dispatchEvent(new Event('input'));
 };
 const tick=setInterval(()=>{if(live)restore();},16);
 return ()=>{
  live=false;
  clearInterval(tick);
  el.removeEventListener('input',onInput);
  restore();
 };
}

async function flushQueue(){
 if(flushing||!queue.length||S.busy||held)return;
 /* A linha da vez aberta para edição: salva o que está no input antes de enviar
    (o envio troca os nós e o texto digitado se perderia). */
 if(editingId===queue[0].id){
  finishEdit(true,true);
  if(!queue.length)return;
 }
 flushing=true;
 const item=queue[0];
 sendingId=item.id;
 if(editingId===item.id)editingId='';
 renderQueue();
 const release=holdDraft($('#prompt'));
 let posted=false;
 try{
  posted=await send(item.text,item.payload.images,{refs:item.payload.refs})===true;
 }finally{
  release();
  sendingId='';
  flushing=false;
 }
 /* O item só sai da fila — e do disco — depois que o Pi aceitou. */
 if(posted&&queue[0]===item){
  queue.shift();
  persist(true);
 }
 renderQueue();
 if(posted&&queue.length&&!S.busy&&!held)queueMicrotask(flushQueue);
}

/* O usuário voltou ao comando (⏎/Enviar/⌘⏎ no composer): a fila segurada pode
   voltar ao fluxo normal. Chamado pelo `main.mjs`. */
export function release(){
 if(!held&&!recovered)return;
 held=false;
 recovered=false;
 renderQueue();
 persist(true);
}

/* Hidrata a fila da conversa corrente: boot, troca de conversa e conversa nova
   passam por aqui. Fila de outra execução (`live=false`) nasce recuperada e
   segurada — nada é enviado sozinho. */
export function adopt(data){
 if(!data||typeof data!=='object')return;
 const next=String(data.session||S.currentSession||'');
 if(next!==owner&&queue.length)persist(true);
 owner=next;
 const items=Array.isArray(data.items)?data.items:[];
 queue.splice(0);
 sendingId='';editingId='';editDraft='';editJustStarted=false;
 for(const raw of items){
  const text=typeof raw?.text==='string'?raw.text:'';
  const payload={images:Array.isArray(raw?.images)?raw.images:[],refs:Array.isArray(raw?.refs)?raw.refs:[]};
  if(!text.trim()&&!payload.images.length)continue;
  seq++;
  queue.push({id:typeof raw?.id==='string'&&raw.id?raw.id:`fila-${Date.now()}-${seq}`,text,payload});
 }
 recovered=!data.live&&queue.length>0;
 held=pendingCore.heldOnLoad(!!data.held,recovered);
 renderQueue();
 if(recovered)toast(queue.length===1?'1 mensagem pendente foi recuperada — envie ou limpe.':`${queue.length} mensagens pendentes foram recuperadas — envie ou limpe.`);
}

export function init(){
 owner=S.currentSession||'';
 document.addEventListener('keydown',onPromptKeydown,true);
 /* O × da fila é um clique de remoção: o mousedown tira o foco do input de
    edição, mas não pode confirmar a edição (senão o re-render tira o botão
    debaixo do clique e a linha só sai no segundo clique). */
 document.addEventListener('pointerdown',e=>{removeIntent=!!e.target?.closest?.('.queue-item button');},true);
 document.addEventListener('pointerup',()=>{removeIntent=false;},true);
 window.addEventListener('desk-idle',flushQueue);
 window.addEventListener('desk-failed',flushQueue);
 /* Parar interrompe a resposta: a fila fica, segurada, e a faixa passa a
    oferecer "Enviar agora" (o aviso diz isso — antes, Parar descartava). */
 window.addEventListener('desk-stop',()=>{
  if(!queue.length)return;
  held=true;
  renderQueue();
  persist(true);
  toast('Resposta interrompida — a fila ficou segurada.');
 });
 /* Fechar a janela não pode perder o que ainda está no atraso da edição. */
 window.addEventListener('beforeunload',()=>{if(saveTimer)persist(true);});
}
