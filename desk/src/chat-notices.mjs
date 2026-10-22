import {$,S,toast,activity} from './state.mjs';
import {text as uiText} from './ui-text.mjs';
import {limitNoticeState} from './claude-questions.mjs';
import {turnState} from './chat-turn-state.mjs';

/* Coluna do tutor — avisos de limite e de atividade na faixa, por conversa.
   Saiu de chat.mjs na #43 fase 2. */

function limitConversation(e){return typeof e?.conversationId==='string'?e.conversationId:(S.currentSession||'');}
function clearLimitBand(){
 const box=$('#activity');
 if(box&&turnState.limitBandText&&box.textContent===turnState.limitBandText&&!S.busy)activity('');
 turnState.limitBandText='';
}
function paintLimitNotice(visible){
 const shown=visible?`${visible.conversationId}\u0000${visible.window}\u0000${visible.key}`:'';
 if(shown===turnState.limitShown)return;
 turnState.limitShown=shown;
 if(visible){turnState.limitBandText=uiText(visible.message);activity(visible.message);toast(visible.message);}
 else clearLimitBand();
}
function clearNotices(){
 const box=$('#activity');
 if(turnState.activityNotice?.message&&box?.textContent===uiText(turnState.activityNotice.message)&&!S.busy)activity('');
 turnState.limitEntries=[];turnState.limitShown='';turnState.activityNotice=null;clearLimitBand();
}
function applyLimitNotice(notice,e){
 const state=limitNoticeState(turnState.limitEntries,notice,limitConversation(e));
 turnState.limitEntries=state.entries;
 paintLimitNotice(state.visible);
}
/* Retry/overload/recusa/fallback: faixa e toast uma vez por aviso; NÃO mexem
   em busy/conexão/fila. A remoção da bolha parcial do fallback fica para
   quando o host souber evictar com segurança (adiada de propósito). */
function applyActivityNotice(notice,e){
 const conversationId=limitConversation(e);
 if(turnState.activityNotice&&turnState.activityNotice.conversationId===conversationId&&turnState.activityNotice.key===notice.key)return;
 turnState.activityNotice={conversationId,key:notice.key,message:notice.message};
 if(!turnState.limitShown)activity(notice.message); /* bloqueio visível não é encoberto */
 toast(notice.message);
}

export {clearNotices,applyLimitNotice,applyActivityNotice};
