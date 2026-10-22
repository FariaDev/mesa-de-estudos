import {displayUserText} from '../text.mjs';
import {$,toast,atBottom,followBottom} from './state.mjs';
import {message as uiMessage} from './i18n.mjs';
import {build,htmlNode,renderChildren} from './view-host.mjs';
import {openReviewFromMessage} from './review.mjs';
import {copiedMark,flashMark} from './icon-motion.mjs';
import {t} from './ui-text.mjs';
import {hydrateAssets,bendList,wrapCopy} from './chat-assets.mjs';
import {selectionInsideMessages} from './chat-quote.mjs';
import {linkifyRefs} from './chat-refs.mjs';
import talkCore from './generated/talkview.core.js';
import {markup,decorateCode} from './markdown.mjs';
import {turnState} from './chat-turn-state.mjs';

/* Coluna do tutor — a bolha de mensagem: criar, pintar (Markdown + LaTeX,
   imagens) e atualizar no fluxo.
   Saiu de chat.mjs na #43 fase 2. */

function message(role,text,images=[],parent=null){
 let el;
 const handlers={
  CopyMessage:async e=>{e.stopPropagation();try{await navigator.clipboard.writeText(el._raw||el.querySelector('.body').innerText);flashMark(e.target.closest?.('.msg-copy'),copiedMark(),t('talk.copied'));toast(uiMessage('toast.messageCopied'));}catch(err){toast(err.message);}},
  SaveForReview:()=>openReviewFromMessage(el),
 };
 el=build(talkCore.message(role==='user',htmlNode(''),bendList(images),true,false,role!=='user'),handlers);
 if(role!=='user')el.querySelector('.role').textContent='Tutor';
 (parent||$('#messages')).append(el);updateMessage(el,text,images);return el;
}
function paintMessage(el,text,images,live){
 /* "Estava no fim?" é medido antes de mexer no DOM: só aí a rolagem segue. */
 const stick=turnState.historyStick!==null?turnState.historyStick:(el.classList.contains('user')||atBottom());
 const body=el.querySelector('.body');
 const bodyTree=talkCore.messageBody(htmlNode(markup(displayUserText(text||''),!live)),bendList(images||[]));
 renderChildren(body,bodyTree.kids);
 if(!live)hydrateAssets(body);
 decorateCode(body);
 if(!live)linkifyRefs(body);
 for(const img of body.querySelectorAll('img.shot'))wrapCopy(img);
 if(turnState.historyStick===null)followBottom(stick);
}
function updateMessage(el,text,images,live){
 if(text!=null)el._raw=text;
 if(!live){clearTimeout(el._tick);el._tick=0;paintMessage(el,text,images);return;}
 el._live=text;if(el._tick)return;el._tick=setTimeout(()=>{el._tick=0;if(selectionInsideMessages())return;paintMessage(el,el._live,[],true);},80);
}

export {message,updateMessage};
