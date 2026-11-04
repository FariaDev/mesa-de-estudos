import {displayUserText} from '../text.mjs';
import {$,toast,applyChatScroll,distanceFromEnd} from './state.mjs';
import {message as uiMessage} from './i18n.mjs';
import {build,htmlNode,renderChildren,applyIcons} from './view-host.mjs';
import {openReviewFromMessage} from './review.mjs';
import {copiedMark,flashMark} from './icon-motion.mjs';
import {t} from './ui-text.mjs';
import {icon} from '../icons.mjs';
import {hydrateAssets,bendList,wrapCopy} from './chat-assets.mjs';
import {selectionInsideMessages} from './chat-quote.mjs';
import {linkifyRefs} from './chat-refs.mjs';
import talkCore from './generated/talkview.core.js';
import {markup,decorateCode} from './markdown.mjs';
import {turnState} from './chat-turn-state.mjs';

/* Coluna do tutor — a bolha de mensagem: criar, pintar (Markdown + LaTeX,
   imagens) e atualizar no fluxo.
   Saiu de chat.mjs na #43 fase 2. */

function message(role,text,images=[],parent=null,files=[]){
 let el;
 const handlers={
  CopyMessage:async e=>{e.stopPropagation();try{await navigator.clipboard.writeText(el._raw||el.querySelector('.body').innerText);flashMark(e.target.closest?.('.msg-copy'),copiedMark(),t('talk.copied'));toast(uiMessage('toast.messageCopied'));}catch(err){toast(err.message);}},
  SaveForReview:()=>openReviewFromMessage(el),
 };
 el=build(talkCore.message(role==='user',htmlNode(''),bendList(images),true,false,role!=='user'),handlers);
 applyIcons(el,icon);
 el._files=Array.isArray(files)?files.slice():[];
 if(role!=='user')el.querySelector('.role').textContent='Tutor';
 (parent||$('#messages')).append(el);updateMessage(el,text,images);return el;
}
function paintMessage(el,text,images,live){
 /* No lote de histórico quem rola é o `showHistory`, uma vez. Medir aqui
    forçava um layout por mensagem (o token longo congelava o Blink). */
 const batch=turnState.historyStick!==null;
 const distance=batch?0:distanceFromEnd();
 const body=el.querySelector('.body');
 const bodyTree=talkCore.messageBody(htmlNode(markup(displayUserText(text||''),!live)),bendList(images||[]));
 renderChildren(body,bodyTree.kids);
 paintFiles(body,el._files,el);
 if(!live)hydrateAssets(body);
 decorateCode(body);
 if(!live)linkifyRefs(body);
 for(const img of body.querySelectorAll('img.shot'))wrapCopy(img);
 if(batch)return;
 const intent=el.classList.contains('user')&&!live?'send':'stream';
 applyChatScroll(intent,intent==='send'?el:null,distance);
}
function paintFiles(body,files,el){
 const list=Array.isArray(files)?files:[];
 if(!list.length)return;
 const row=document.createElement('div');row.className='message-files';
 for(const file of list){
  const name=typeof file==='string'?file:String(file?.name||'PDF');
  const pages=Number(file?.pages)||0;
  const chip=document.createElement('div');chip.className='attachment message-file';
  const label=document.createElement('div');label.className='file';
  label.textContent=pages>0?t('chatpdf.chip',{name,count:pages}):name;
  const remove=document.createElement('button');
  remove.type='button';remove.className='attachment-remove';remove.textContent='×';
  remove.setAttribute('aria-label',t('attach.remove',{name}));
  remove.addEventListener('click',event=>{
   event.stopPropagation();
   el._files=(el._files||[]).filter(item=>item!==file);
   chip.remove();
   if(!row.childElementCount)row.remove();
  });
  chip.append(label,remove);
  row.append(chip);
 }
 body.append(row);
}
function updateMessage(el,text,images,live){
 if(text!=null)el._raw=text;
 if(!live){clearTimeout(el._tick);el._tick=0;paintMessage(el,text,images);return;}
 el._live=text;if(el._tick)return;el._tick=setTimeout(()=>{el._tick=0;if(selectionInsideMessages())return;paintMessage(el,el._live,[],true);},80);
}

/* A última resposta concluída guarda o ícone de salvar à vista (#90): o aluno
   não precisa passar o mouse pela conversa para achar a última. Durante o
   streaming a marca sai — a resposta ainda está mudando. */
export function clearLatestAnswer(){
 for(const marked of document.querySelectorAll('#messages .message[data-latest-answer]'))marked.removeAttribute('data-latest-answer');
}
export function markLatestAnswer(){
 const box=$('#messages');if(!box)return;
 const answers=[...box.querySelectorAll('.message:not(.user)')].filter(el=>el.querySelector('.msg-review'));
 clearLatestAnswer();
 answers.at(-1)?.setAttribute('data-latest-answer','');
}

export {message,updateMessage};
