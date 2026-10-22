import {$,updateContextSummary} from './state.mjs';
import {closeConferirNote} from './conferir.mjs';
import {closeTutorPops} from './tutor-header.mjs';

/* Popover do contexto de estudo (o que vai junto com a mensagem): abrir,
   fechar e posicionar junto do composer.
   Saiu do main.mjs na #43 fase 2; quem liga os eventos continua lá. */

/* Edição do contexto de estudo (ticket #15): o botão "Editar" da linha "Vai
   junto" abre o `#context-pop` com a lista/questão ativa e o rascunho .xopp —
   os campos de antes, agora ancorados na linha que mostra o que vai junto. É
   um popover como os do cabeçalho do tutor: o Esc o fecha antes de qualquer
   outra coisa (escape-policy) e devolve o foco ao botão. */
function closeContextPop({restoreFocus=false}={}){
 const pop=$('#context-pop');
 if(!pop||pop.hidden)return;
 const hadFocus=pop.contains(document.activeElement);
 pop.hidden=true;
 $('#context-edit')?.setAttribute('aria-expanded','false');
 if(restoreFocus&&hadFocus)$('#context-edit')?.focus();
}
function openContextPop(){
 const pop=$('#context-pop'),button=$('#context-edit');
 if(!pop||!button||button.hidden)return;
 closeTutorPops();
 closeConferirNote();
 updateContextSummary();
 pop.hidden=false;
 placeContextPop();
 button.setAttribute('aria-expanded','true');
 $('#exercise-title')?.focus();
}
/* Flutuante (position:fixed): não é cortado pela rolagem da coluna. Abre acima
   da linha quando cabe entre o cabeçalho do tutor e ela; senão, abaixo, sobre a
   caixa (coluna baixa, como em 900×650). */
function placeContextPop(){
 const pop=$('#context-pop');if(!pop||pop.hidden)return;
 const line=$('#goes-along').getBoundingClientRect();
 const column=$('#composer').getBoundingClientRect();
 const top=($('#chat .chat-top')||$('#chat')||document.body).getBoundingClientRect().bottom;
 const gap=4,margin=8,pad=parseFloat(getComputedStyle($('#composer')).paddingLeft)||0;
 pop.style.left=`${column.left+pad}px`;
 pop.style.width=`${Math.max(0,column.width-2*pad)}px`;
 pop.style.maxHeight='';pop.style.top='auto';pop.style.bottom='auto';
 const height=pop.offsetHeight;
 if(line.top-top-gap>=height){pop.style.bottom=`${innerHeight-line.top+gap}px`;}
 else{
  const from=line.bottom+gap;
  pop.style.top=`${from}px`;
  pop.style.maxHeight=`${Math.max(120,innerHeight-from-margin)}px`;
 }
}

export {closeContextPop,openContextPop,placeContextPop};
