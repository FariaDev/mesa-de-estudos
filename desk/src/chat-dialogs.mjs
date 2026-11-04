import {$,S} from './state.mjs';
import {renderPiDialog} from './dialogs.mjs';
import {markupInline} from './markdown.mjs';
import {t} from './ui-text.mjs';

/* Diálogos do tutor (extraído de chat.mjs, #29).
   A fila (`dialogQueue`), o diálogo aberto e o contador de closes ignorados
   moram aqui e só aqui; o handler de eventos do chat chama `showDialog` e
   `cancelDialogRequest`. Quiz e pergunta viraram cartões do host (#92) e não
   passam por `extension_ui_request`; o caminho nativo de pergunta saiu. */
const dialogQueue=[];let currentDialog=null,ignoredDialogCloses=0;
export function showDialog(e){dialogQueue.push(e);if(currentDialog)return;nextDialog();}
function respondDialog(data){window.desk.respond(data).catch(error=>console.warn('resposta ao tutor não entregue:',error?.message||error));currentDialog=null;nextDialog();}
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
function nextDialog(){const e=dialogQueue.shift();S.dialogPending=!!e;if(!e)return;currentDialog=e;
 const dialog=$('#pi-dialog');
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
  if(dialog){dialog._requestId='';if(dialog.open){ignoredDialogCloses++;dialog.returnValue='cancel';dialog.close();}}
  nextDialog();
  removed=true;
 }
 if(removed)S.dialogPending=!!currentDialog||dialogQueue.length>0;
}
/* Os listeners do casco entram na mesma posição em que o chat sempre os
   registrou (depois do handler de eventos), por isso são instalados pelo chat. */
export function installDialogListeners(){
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
  if(!e)return;
  const ok=dialog.returnValue==='ok';
  respondDialog(ok?{id:e.id,...(e.method==='confirm'?{confirmed:true}:{value:$('#dialog-value')?.value})}:{id:e.id,cancelled:true});
 });
}
