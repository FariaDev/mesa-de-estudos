import {toast} from './state.mjs';
import {t as uiT,text as uiText} from './ui-text.mjs';
import {message as uiMessage} from './i18n.mjs';
import {h} from './sidechat-message-view.mjs';

/* Permissões do chat lateral, no canal dele (#43 fase 2: saíram de
   sidechat.mjs). O estado e o bridge continuam no sidechat; aqui entram por
   parâmetro, com o elemento das mensagens lido na hora (ele só existe depois
   do mount). */

/**
 * Cria o desenho e a resposta dos pedidos do motor no chat lateral.
 * @param {{state:{id:string,requests:Map<string,HTMLElement>},api:()=>any,messagesEl:()=>HTMLElement|null,scrollBottom:()=>void}} deps
 * @returns {{showRequest:(event:object)=>void,answerRequest:(card:HTMLElement|null,response:object)=>void,submitFreeAnswer:(card:HTMLElement|null)=>void}}
 * @example const {showRequest}=createSidechatRequests({state,api:()=>window.desk,messagesEl:()=>el,scrollBottom(){}});
 */
export function createSidechatRequests({state,api,messagesEl,scrollBottom}){
 let lastRequestSeq=0;
 function showRequest(event){
  const requestId=String(event.id||`req-${++lastRequestSeq}`);
  const method=String(event.method||'select');
  const card=h('div',{class:'sidechat-request',role:'group','aria-label':uiT('sidechat.request.aria')});
  const fallbackTitle=method==='confirm'||method==='permission'?uiT('sidechat.request.permission'):uiT('sidechat.request.aria');
  card.append(h('p',{class:'sidechat-request-title',text:String(event.title||fallbackTitle)}));
  if(event.message)card.append(h('p',{class:'sidechat-request-text',text:String(event.message)}));
  if(method==='confirm'||method==='permission'){
   card.append(h('div',{class:'sidechat-request-actions'},
    h('button',{type:'button',class:'sidechat-request-action',text:uiT('sidechat.request.allow'),'data-answer':'ok'}),
    h('button',{type:'button',class:'sidechat-request-action',text:uiT('sidechat.request.deny'),'data-answer':'cancel'})));
  }else if(method==='select'&&Array.isArray(event.options)){
   for(const option of event.options)card.append(h('button',{type:'button',class:'sidechat-option','data-value':String(option),text:String(option)}));
   card.append(h('button',{type:'button',class:'sidechat-request-action',text:uiT('common.cancel'),'data-answer':'cancel'}));
  }else{
   card.append(h('input',{type:'text',class:'sidechat-request-input',value:String(event.prefill||''),placeholder:String(event.placeholder||''),'aria-label':uiT('sidechat.request.answerAria')}));
   card.append(h('div',{class:'sidechat-request-actions'},
    h('button',{type:'button',class:'sidechat-request-submit',text:uiT('sidechat.request.respond')}),
    h('button',{type:'button',class:'sidechat-request-action',text:uiT('common.cancel'),'data-answer':'cancel'})));
  }
  card.dataset.requestId=requestId;
  state.requests.set(requestId,card);
  messagesEl()?.append(card);
  scrollBottom();
  toast(uiMessage('sidechat.request.waiting'));
 }

 function answerRequest(card,response){
  if(!card)return;
  sendRespond(card,response.cancelled?{cancelled:true}:response.confirmed?{confirmed:true}:{value:response.value||''});
 }
 function submitFreeAnswer(card){
  if(!card||card._responding)return;
  const inputs=[...card.querySelectorAll('.sidechat-request-input')];
  const payload=inputs.length===1?{value:inputs[0].value}:{answers:Object.fromEntries(inputs.map((input,index)=>[uiT('sidechat.request.answerN',{n:index+1}),input.value]))};
  sendRespond(card,payload);
 }
 function clearRequestError(card){card.querySelector('.sidechat-request-error')?.remove();}
 function requestError(card,message){
  clearRequestError(card);
  card.append(h('p',{class:'sidechat-request-error',role:'alert',text:uiText(String(message))}));
 }
 async function sendRespond(card,response){
  if(!state.id||card._responding)return;
  const id=state.id,requestId=card.dataset.requestId||'';
  const controls=[...card.querySelectorAll('input,button')];
  card._responding=true;clearRequestError(card);
  for(const control of controls)control.disabled=true;
  try{
   const source=api();
   if(typeof source?.sidechatRespond!=='function')throw Error(uiMessage('sidechat.err.bridge'));
   const result=await source.sidechatRespond({id,response:{id:requestId,...response}});
   if(result?.ok===false)throw Error(uiMessage('sidechat.err.notAccepted'));
   if(state.id===id&&state.requests.get(requestId)===card){state.requests.delete(requestId);card.remove();}
  }catch(error){
   if(state.id===id&&state.requests.get(requestId)===card)requestError(card,error?.message||uiMessage('sidechat.err.respond'));
  }finally{
   card._responding=false;
   for(const control of controls)control.disabled=false;
  }
 }
 return {showRequest,answerRequest,submitFreeAnswer};
}
