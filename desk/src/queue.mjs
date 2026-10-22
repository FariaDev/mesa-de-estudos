import {$,S,toast,refs,mayAdvanceQueue,connect} from './state.mjs';
import {mentionIds,clearMentions} from './mentions.mjs';
import {send,resetAttachments,persistTray,isComposerCommand} from './chat.mjs';
import core from './generated/composerview.core.js';
import pendingCore from './generated/pending.core.js';
import {createQueueRetry} from './queue-retry.mjs';
import {build,renderChildren,preserveFocus} from './view-host.mjs';
import {t} from './ui-text.mjs';
import {message} from './i18n.mjs';
import {toNat} from './bend-nat.mjs';

/* Fila de mensagens da Mesa — nasceu como espelho da fila da Conversa (aposentada na #50)
   e segue sobre o núcleo (`core/composerview.bend`), com uma diferença que aqui é
   o ponto: a fila SOBREVIVE ao fechamento do app (`desk/pending.cjs`, núcleo
   `core/pending.bend`), por conversa.
   ⏎ com o Pi livre não passa por aqui (o #prompt envia); ocupado, enfileira.
   ⌘/Ctrl+⏎ também não: o #prompt manda como steer (interrompe e envia agora).
   Parar a resposta NÃO descarta mais a fila: `held` a segura e a faixa oferece
   "Enviar agora"; quem descarta é o "Limpar" (com confirmação). Fila lida de
   outra execução nasce `held` (recuperada) e nunca sai sozinha.
   Enviar com o tutor desligado (ticket #18) também passa por aqui: `submit`
   guarda a mensagem na fila (que persiste) e chama o tutor; quando ele atende,
   a fila sai uma vez, na ordem. A regra (guardar × enviar, o rótulo "Guardada",
   quando sair) é do núcleo `core/pending.bend`; este arquivo mede os fatos. */
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
function holdQueue(reason){
 retries.reset();
 /* Já segurada: repetir o aviso só faria eco (desk_error + settled de falha,
   por exemplo); o motivo novo entra no log do estado, não em outro toast. */
 const wasHeld=held;
 held=true;
 renderQueue();persist(true);
 if(queue.length&&reason&&!wasHeld)toast(reason);
}
const retries=createQueueRetry({
 retry:()=>flushQueue(),hold:holdQueue,
 waiting:(count,delay)=>toast(message('queue.retry',{count,max:Number(pendingCore.maxAutoRetries()),seconds:delay/1000}))
});

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

/* Mensagem só com anexo (a captura do Conferir, sem texto) não pode virar uma
   linha em branco na faixa: diz o que está guardado. Em edição vale o texto real. */
function rowText(item){
 if(item.id===editingId)return liveEditText(item);
 return item.text||(item.payload.images.length?'Imagem anexada':'');
}

function rowOf(item){
 const sending=item.id===sendingId;
 return {$:'QueueRow',id:item.id,text:rowText(item),sending,enabled:!sending,editing:item.id===editingId};
}

function idFromEvent(e){
 return e.currentTarget?.closest?.('.queue-item')?.dataset?.id||'';
}

/* ---------- disco ---------- */

/* O que vai para o arquivo: texto, referências e anexos do item (o snapshot do
   composer no momento do enqueue), nunca o estado vivo do DOM. */
function snapshot(){
 return queue.map(item=>({id:item.id,text:item.text,refs:item.payload.refs,images:item.payload.images,mentions:item.payload.mentions}));
}

/* Escrita imediata nas mudanças discretas (enfileirar, remover, enviar, limpar)
   e com atraso no texto em edição. A resposta mais nova é a única que avisa:
   os toasts do teto de disco não podem repetir a cada escrita. */
function persist(immediate=false){
 if(S.currentSession&&owner&&S.currentSession!==owner)return; // a vez é da sessão de `owner`
 clearTimeout(saveTimer);
 const write=()=>{
  saveTimer=0;
  const mine=++saveSeq;
  window.desk.pendingSave({items:snapshot(),held}).then(out=>{
   if(mine!==saveSeq)return;
   if(out?.trayDropped)toast(message('queue.trayDropped'));
   if(out?.dropped)toast(message('queue.dropped',{count:out.dropped}));
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
    usuário); o usuário assume o comando e o envio começa pelo primeiro item.
    Nunca vira steer nem cancelamento: cada item sai como turno normal
    (followUp), motor sem steer inclusive. */
 sendNow(){
  if(!queue.length)return;
  if(S.busy){toast(message('queue.busyNow'));return;}
  retries.reset();
  held=false;
  recovered=false;
  /* Comando explícito do usuário: o cancelamento do último turno deixa de
     vetar o avanço (a incerteza continua sendo fato do host — o envio tenta e
     o host recusa, nunca repete sozinho). */
  S.turnCancelled=false;
  renderQueue();
  persist(true);
  flushQueue({force:true});
 },
 /* A única ação que descarta — separada do Parar. */
 clear(){
  if(!queue.length)return;
  if(!confirm(t('queue.clearConfirm')))return;
  dropQueue(message('queue.cleared'));
 }
};

/* A fila é por conversa: o `adopt` (boot, troca de conversa, conversa nova) é
   quem manda — e a escrita fica travada enquanto a conversa do main não é a de
   `owner` (uma troca sem `adopt` não pode gravar a fila na conversa errada). */
function dropQueue(reason){
 retries.reset();
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

/* Saída animada (--t-fast via .closing, src/motion.css); o timeout garante a remoção mesmo
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

/* O rótulo da faixa: com o tutor sem atender ela diz "Guardada. Vai quando ele
   atender."; recuperada continua dizendo de onde veio (decisão do núcleo). */
let shownLabel='';
function currentLabel(many){
 const count=String(queue.length);
 const plain=core.queueLabel(recovered,many,count);
 return pendingCore.stripLabel(recovered,S.link?.state!=='online',many,count,plain);
}

function renderQueue(){
 /* A faixa mora dentro da caixa de mensagem (ticket #15): é a primeira coisa
    da caixa, acima dos anexos e do campo. */
 const card=$('#composer-box');
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
 shownLabel=currentLabel(many);
 const tree=core.queueStripView(false,shownLabel,listOf(queue.map(rowOf)),canSendNow(),true);
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
 queue.push({id:`fila-${Date.now()}-${seq}`,text,payload:{images:S.attachments.slice(),refs:refs(),mentions:mentionIds()}});
 clearMentions();
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

async function flushQueue({force=false}={}){
 if(flushing||!queue.length||held||retries.pending)return;
 /* O avanço da fila é a decisão provada do núcleo (`core/agentdelivery.bend`
    → `mayAdvanceQueue`): turno aberto, permissão pendente, entrega incerta ou
    cancelamento vetam. `force` é o comando explícito do usuário em "Enviar
    agora" — aí o envio tenta (e o host recusa, se for o caso), sem auto-retry. */
 if(!force&&!mayAdvanceQueue())return;
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
 let posted,retryable=false;
 const generationOwner=owner;
 try{
  posted=await send(item.text,item.payload.images,{refs:item.payload.refs,mentions:item.payload.mentions||[],onFailure:safe=>{retryable=safe;}})===true;
 }finally{
  sendingId='';
  flushing=false;
 }
 /* O item só sai da fila — e do disco — depois que o Pi aceitou. */
 if(owner!==generationOwner||queue[0]!==item)return;
 if(posted){
  retries.reset();
  queue.shift();
  persist(true);
 }
 renderQueue();
 if(!posted&&!held)retries.fail(retryable);
 if(posted&&queue.length&&!S.busy&&!held)queueMicrotask(flushQueue);
}

/* Cmd/Ctrl+⏎ com o motor sem steer: em vez de prometer interromper e reenviar,
   a mensagem enfileira — o mesmo caminho do ⏎ ocupado (o `#prompt` chama daqui
   quando `capabilities.steer` é false). */
export function enqueueFromComposer(){
 const el=$('#prompt');
 if(!el)return false;
 const text=el.value.trim();
 if(!text)return false;
 enqueue(text);
 el.value='';
 el.dispatchEvent(new Event('input'));
 return true;
}

/* ⏎/Enviar/⌘⏎ no composer com o Pi livre. Tutor ligado: vai direto, como
   sempre. Tutor desligado, ligando ou sem resposta: a mensagem é GUARDADA na
   fila (texto, referências e anexos do momento; vai para o disco na hora) e o
   tutor é chamado sem outro clique — quando ele atende, o `desk-tutor-link`
   abaixo solta a fila, uma por vez e na ordem. Cancelar ou não ser atendido
   não apaga nada: a mensagem espera a próxima chamada. */
export function submit(value,options={}){
 const text=String(value??'').trim();
 if(options.release!==false)release();
 const keep=pendingCore.keptWhileOff(!!S.connected,!!S.busy,isComposerCommand(text),text,toNat(S.attachments.length));
 if(!keep)return send(value,undefined,options.steer===true?{steer:true}:{});
 enqueue(text);
 const el=$('#prompt');
 if(el){el.value='';el.dispatchEvent(new Event('input'));}
 /* Troca de matéria/sessão em curso: ela mesma chama o tutor no fim. */
 if(!S.switching)connect().catch(()=>{});
 return true;
}

/* O usuário voltou ao comando (⏎/Enviar/⌘⏎ no composer): a fila segurada pode
   voltar ao fluxo normal. Chamado pelo `main.mjs`. */
export function release(){
 retries.reset();
 S.turnCancelled=false;
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
 retries.reset();
 const next=String(data.session||S.currentSession||'');
 if(next!==owner&&queue.length)persist(true);
 owner=next;
 const items=Array.isArray(data.items)?data.items:[];
 queue.splice(0);
 sendingId='';editingId='';editDraft='';editJustStarted=false;
 for(const raw of items){
  const text=typeof raw?.text==='string'?raw.text:'';
  const payload={images:Array.isArray(raw?.images)?raw.images:[],refs:Array.isArray(raw?.refs)?raw.refs:[],mentions:Array.isArray(raw?.mentions)?raw.mentions.filter(id=>typeof id==='string'):[]};
  if(!text.trim()&&!payload.images.length)continue;
  seq++;
  queue.push({id:typeof raw?.id==='string'&&raw.id?raw.id:`fila-${Date.now()}-${seq}`,text,payload});
 }
 recovered=!data.live&&queue.length>0;
 held=pendingCore.heldOnLoad(!!data.held,recovered);
 renderQueue();
 if(recovered)toast(message('queue.restored',{count:queue.length}));
}

export function init(){
 owner=S.currentSession||'';
 document.addEventListener('keydown',onPromptKeydown,true);
 /* O × da fila é um clique de remoção: o mousedown tira o foco do input de
    edição, mas não pode confirmar a edição (senão o re-render tira o botão
    debaixo do clique e a linha só sai no segundo clique). */
 document.addEventListener('pointerdown',e=>{removeIntent=!!e.target?.closest?.('.queue-item button');},true);
 document.addEventListener('pointerup',()=>{removeIntent=false;},true);
 window.addEventListener('desk-idle',()=>flushQueue());
 /* O tutor passou a atender (chamada nova, "Chamar de novo", abertura): a fila
    guardada sai. Só na virada para "ligado" — a checagem de saúde repete o
    estado a cada rodada e não pode soltar a fila. O adiamento deixa o
    `connect()` terminar de carregar o histórico antes do primeiro envio. A fila
    recuperada de outra execução segue segurada (`held`): nada sai sozinho. A fila
    vetada por incerteza/cancelamento é segurada (`holdAfterAnswer`). */
 let linkOnline=false;
 window.addEventListener('desk-tutor-link',()=>{
  const now=S.link?.state==='online';
  const answered=pendingCore.tutorAnswered(linkOnline,now);
  linkOnline=now;
  if(queue.length&&currentLabel(queue.length>1)!==shownLabel)renderQueue();
  if(!answered)return;
  setTimeout(()=>{
   /* Vetada por incerteza ou cancelamento (nada disso passa sozinho): segura e
      oferece "Enviar agora" em vez de deixar a mensagem parada sem saída. */
   if(queue.length&&!held&&!flushing&&pendingCore.holdAfterAnswer(!!S.busy,!!S.dialogPending,!!S.uncertain,!!S.turnCancelled)){
    holdQueue(message('queue.heldUncertain'));
    return;
   }
   flushQueue();
  },0);
 });
 window.addEventListener('desk-failed',()=>{if(!flushing)holdQueue(message('queue.heldFailed'));});
 /* Cancelamento que NÃO veio do usuário (ex.: o motor encerrou o turno): a
    fila fica segurada, sem drenar no próximo evento por acidente. */
 window.addEventListener('desk-held',event=>{if(!flushing)holdQueue(event?.detail?.message||message('queue.heldDefault'));});
 /* Parar interrompe a resposta: a fila fica, segurada, e a faixa passa a
    oferecer "Enviar agora" (o aviso diz isso — antes, Parar descartava). */
 window.addEventListener('desk-stop',()=>{
  retries.reset();
  if(!queue.length)return;
  held=true;
  renderQueue();
  persist(true);
  toast(message('queue.heldInterrupted'));
 });
 /* Fechar a janela não pode perder o que ainda está no atraso da edição. */
 window.addEventListener('beforeunload',()=>{retries.reset();if(saveTimer)persist(true);});
}
