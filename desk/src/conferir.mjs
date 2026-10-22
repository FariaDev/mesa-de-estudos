import {$,S,toast,conferirAppName,updateCheckButton} from './state.mjs';
import {build} from './view-host.mjs';
import {closeTutorPops} from './tutor-header.mjs';
import conferirCore from './generated/conferir.core.js';
import {LANGUAGE_EVENT} from './ui-text.mjs';
import {message as uiMessage} from './i18n.mjs';

/* A escolha do programa do Conferir (tickets #35 e #38). O núcleo
   (`core/conferir.bend`) decide o que a lista mostra e monta as árvores; aqui
   ficam o que é vivo: o campo "Programa de escrita" nas Configurações →
   Pastas e programas (com a lista de janelas abertas logo abaixo) e o aviso de
   "app ausente" na caixa de mensagem, cuja ação leva ao mesmo campo.

   A escolha vale na hora, como tema e acento: é o APP (o host o guarda, a
   janela só serve para esta listagem) e Cancelar nas Configurações não a
   desfaz. Escolher aqui passa por `capture-choose` — o host captura a janela
   para provar que ela é capturável antes de trocar o app salvo — e a imagem é
   descartada: nada vai para a bandeja de anexos. */
const toList=items=>items.reduceRight((tail,head)=>({$:'Con',head,tail}),{$:'Nil'});
const field=()=>$('#cfg-conferir');
const list=()=>$('#cfg-conferir-list');
const note=()=>$('#check-note');
const trigger=()=>$('#check');

let listing=false;

/* ---------- o campo nas Configurações ---------- */

const listOpen=()=>{const el=list();return !!el&&!el.hidden;};

function setListOpen(open){
 const el=list();
 if(!el)return;
 el.hidden=!open;
 $('#cfg-conferir-choose')?.setAttribute('aria-expanded',String(open));
}

export function closeConferirList(){setListOpen(false);}

/* Redesenha o campo com o programa de agora. Chamado ao abrir as Configurações
   e depois de cada escolha. A lista aberta fica como está. */
export function paintConferirField(){
 const el=field();
 if(!el)return;
 const expanded=listOpen();
 const tree=conferirCore.fieldView(conferirAppName(),!!S.conferirApp,!!S.captureOk);
 el.replaceChildren(build(tree,fieldHandlers));
 $('#cfg-conferir-choose')?.setAttribute('aria-expanded',String(expanded));
}

async function paintList(){
 if(listing)return;
 listing=true;
 try{
  const data=await window.desk.captureWindows();
  S.conferirApp=data.choice||null;
  updateCheckButton();
  paintConferirField();
  const el=list();
  el.replaceChildren(build(conferirCore.listView(conferirCore.pickHint(),toList(Array.isArray(data.windows)?data.windows:[])),listHandlers));
 }finally{listing=false;}
}

const listHandlers={
 Pick:async event=>{
  const id=event.currentTarget?.dataset?.key||'';
  if(!id)return;
  try{
   const shot=await window.desk.captureChoose({id});
   S.conferirApp=shot?.choice||null;
   updateCheckButton();
   setListOpen(false);
   paintConferirField();
   toast(uiMessage('conferir.willUse',{app:conferirAppName()}));
   $('#cfg-conferir-choose')?.focus();
  }catch(error){toast(error.message);}
 },
 Refresh:()=>{paintList().catch(error=>toast(error.message));},
};

const fieldHandlers={
 Choose:async()=>{
  if(!S.captureOk)return;
  if(listOpen()){setListOpen(false);return;}
  try{
   await paintList();
   setListOpen(true);
   (list().querySelector('.check-row')||list().querySelector('button'))?.focus();
  }catch(error){toast(error.message);}
 },
 Back:async()=>{
  try{
   await window.desk.captureDefault();
   S.conferirApp=null;
   updateCheckButton();
   setListOpen(false);
   paintConferirField();
   toast(uiMessage('conferir.returned',{app:conferirCore.defaultApp()}));
   $('#cfg-conferir-choose')?.focus();
  }catch(error){toast(error.message);}
 },
};

/* Leva ao campo: Configurações → Pastas e programas, com o foco no Escolher…. */
export function openConferirSettings(){
 window.dispatchEvent(new CustomEvent('desk-open-settings',{detail:{section:'pastas',focus:'#cfg-conferir-choose'}}));
}

/* ---------- o aviso de app ausente ---------- */

export function conferirNoteOpen(){const el=note();return !!el&&!el.hidden;}

export function closeConferirNote({restoreFocus=false}={}){
 const el=note();
 if(!el||el.hidden)return;
 const hadFocus=el.contains(document.activeElement);
 el.hidden=true;
 if(restoreFocus&&hadFocus)trigger()?.focus();
}

/* Flutuante (position:fixed), como o `#context-pop`: acima da caixa de mensagem
   quando cabe, senão abaixo da linha "Vai junto". */
export function placeConferirNote(){
 const el=note();if(!el||el.hidden)return;
 const anchor=$('#composer-box')||$('#composer');
 const box=anchor.getBoundingClientRect();
 const column=$('#composer').getBoundingClientRect();
 const top=($('#chat .chat-top')||$('#chat')||document.body).getBoundingClientRect().bottom;
 const gap=4,margin=8,pad=parseFloat(getComputedStyle($('#composer')).paddingLeft)||0;
 el.style.left=`${column.left+pad}px`;
 el.style.width=`${Math.max(0,column.width-2*pad)}px`;
 el.style.maxHeight='';el.style.top='auto';el.style.bottom='auto';
 const height=el.offsetHeight;
 if(box.top-top-gap>=height){el.style.bottom=`${innerHeight-box.top+gap}px`;}
 else{
  const from=Math.max(top+gap,margin);
  el.style.top=`${from}px`;
  el.style.maxHeight=`${Math.max(160,box.top-from-gap)}px`;
 }
}

function showAbsent({app,saved}){
 const el=note();
 if(!el)return;
 closeTutorPops();
 window.dispatchEvent(new Event('desk-conferir-note-open'));
 el.replaceChildren(build(conferirCore.absentView(app,saved),{
  ChooseOther:()=>{closeConferirNote();openConferirSettings();},
 }));
 el.hidden=false;
 placeConferirNote();
 el.querySelector('button')?.focus();
}

export function initConferir(){
 window.addEventListener(LANGUAGE_EVENT,()=>{paintConferirField();if(listOpen())paintList().catch(()=>{});});
 document.addEventListener('click',event=>{
  if(!conferirNoteOpen())return;
  if(event.target?.closest?.('#check-note, #check'))return;
  closeConferirNote();
 });
 window.addEventListener('resize',()=>placeConferirNote());
 window.addEventListener('desk-conversation-changed',()=>closeConferirNote());
 /* O app escolhido (ou o Xournal++) não está aberto: a frase vai no aviso, com
    a saída ao lado — nunca outra janela no lugar. */
 window.addEventListener('desk-conferir-absent',event=>{
  showAbsent({
   app:String(event.detail?.app||conferirCore.defaultApp()),
   saved:!!event.detail?.saved,
  });
 });
 $('#settings-dialog')?.addEventListener('close',()=>closeConferirList());
}
