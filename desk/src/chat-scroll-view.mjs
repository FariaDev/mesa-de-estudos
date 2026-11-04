/* Aplicador da rolagem da coluna do tutor: mede o DOM e aplica a decisão pura
   de `chat-scroll.mjs`. Saiu de `state.mjs`, que passava do teto de linhas;
   `state.mjs` reexporta o que os outros módulos já importavam de lá. */
import {chatFollowDecision} from './chat-scroll.mjs';
import {messageScroller,syncChatScrollMode,followBottom} from './state.mjs';

/**
 * Pixels que faltam para o fim da coluna do tutor (0 sem coluna). Mede antes de
 * crescer o conteúdo: é o que diz se a conversa estava seguindo o fim.
 * @returns {number}
 * @example if(distanceFromEnd() < 40) followBottom(true)
 */
export function distanceFromEnd(){
 const el=messageScroller();
 if(!el)return 0;
 return el.scrollHeight-el.scrollTop-el.clientHeight;
}
/* Posições que este código acabou de pedir. O `scroll` do Chromium sai depois
   do quadro e, sem isso, a rolagem automática pareceria que o aluno subiu. */
let ownScrollTops=[];
/**
 * Anota uma posição pedida pelo próprio código. O `scroll` que o Chromium
 * dispara depois dela pode chegar atrasado e com o conteúdo já maior; a marca
 * fica até o evento chegar (com prazo), senão ele pareceria rolagem do aluno.
 * @param {number|string} top posição pedida (`scrollTop`)
 * @returns {void}
 * @example noteOwnScroll(scroller.scrollTop)
 */
export function noteOwnScroll(top){
 const value=Number(top)||0;
 ownScrollTops.push({value,at:Date.now()});
 if(ownScrollTops.length>16)ownScrollTops.shift();
}
function ownScroll(top){
 const now=Date.now();
 for(let i=ownScrollTops.length-1;i>=0;i--){
  const entry=ownScrollTops[i];
  if(now-entry.at>500){ownScrollTops.splice(i,1);continue;}
  if(Math.abs(entry.value-top)<1){ownScrollTops.splice(i,1);return true;}
 }
 return false;
}
/**
 * Traz a mensagem enviada para dentro da vista: o fim dela, se estava abaixo
 * (é de onde a resposta começa); o topo, se estava acima.
 * @param {Element|null} el a bolha enviada
 * @returns {void}
 * @example revealInChat(document.querySelector('.message.user:last-of-type'))
 */
export function revealInChat(el){
 const scroller=messageScroller();
 if(!scroller||!el?.getBoundingClientRect)return;
 const box=scroller.getBoundingClientRect();
 const row=el.getBoundingClientRect();
 const before=scroller.scrollTop;
 if(row.bottom>box.bottom+1)scroller.scrollTop+=row.bottom-box.bottom;
 else if(row.top<box.top-1)scroller.scrollTop+=row.top-box.top;
 /* Só marca a posição se o código realmente rolou: anotar a posição em que a
    vista já estava engolia, por até 500 ms, a rolagem do aluno que parasse
    nela (o topo depois de enviar, por exemplo) e o acompanhamento puxava a
    conversa de volta (hunt-chat "diary-selection"). */
 if(scroller.scrollTop!==before)noteOwnScroll(scroller.scrollTop);
}
/* Seguir o fim é escolha do aluno: sobe, para; volta ao fim, segue de novo. */
let chatFollow=true,chatScrollGuard=0,chatScrollEpoch=0;
/* Seguir o fim não pode depender só do próximo token: o texto final, o diário
   recolhendo, o KaTeX e uma figura/imagem que termina de carregar mudam a
   altura DEPOIS da última correção. Observar os filhos de `#messages` cobre
   todas essas mudanças; se o aluno subiu, `chatFollow` já está falso e nada é
   puxado. O quadro coalesce rajadas e não anima (respeita reduced-motion). */
let followResize=null,followMutations=null,followFrame=0;
function followContentFrame(){
 if(!chatFollow||followFrame)return;
 followFrame=requestAnimationFrame(()=>{
  followFrame=0;
  if(chatFollow)followBottom(true);
 });
}
function watchFollowContent(){
 const messages=document.querySelector('#messages');
 if(!messages||followResize)return;
 const observed=new WeakSet();
 const observeChildren=()=>{
  for(const el of messages.children){
   if(observed.has(el))continue;
   observed.add(el);followResize.observe(el);
  }
 };
 followResize=new ResizeObserver(followContentFrame);
 followMutations=new MutationObserver(observeChildren);
 followMutations.observe(messages,{childList:true});
 observeChildren();
}
if(typeof document!=='undefined'){
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',watchFollowContent,{once:true});
 else watchFollowContent();
}
function guardChatScroll(run){
 chatScrollGuard+=1;
 try{run();}finally{chatScrollGuard-=1;}
}
function onChatUserScroll(event){
 if(chatScrollGuard)return;
 const scroller=messageScroller();
 if(!scroller||event.target!==scroller||ownScroll(scroller.scrollTop))return;
 chatScrollEpoch+=1;
 chatFollow=chatFollowDecision({intent:'scroll',distanceFromEnd:distanceFromEnd(),following:chatFollow}).following;
}
if(typeof document!=='undefined'&&document.addEventListener)document.addEventListener('scroll',onChatUserScroll,true);
/**
 * Rola a coluna do tutor. `distance` é a distância ao fim antes de crescer o conteúdo.
 * @param {'send'|'stream'|'history'} intent
 * @param {Element|null} [anchor] mensagem enviada, no envio
 * @param {number} [distance]
 * @returns {void}
 * @example applyChatScroll('send', sentBubble, distanceFromEnd())
 */
export function applyChatScroll(intent,anchor=null,distance=distanceFromEnd()){
 const decision=chatFollowDecision({intent,distanceFromEnd:distance,following:chatFollow});
 chatFollow=decision.following;
 const epoch=chatScrollEpoch;
 const run=()=>guardChatScroll(()=>{
  syncChatScrollMode();
  if(decision.alignSent&&anchor?.isConnected)revealInChat(anchor);
  else if(decision.followEnd)followBottom(true);
 });
 run();
 if(!(decision.alignSent||decision.followEnd)||typeof requestAnimationFrame!=='function')return;
 /* O layout e o modo `chat-scroll` fecham no quadro seguinte. Rolagem do aluno nesse meio muda a época. */
 requestAnimationFrame(()=>{if(chatScrollEpoch===epoch)run();});
}
