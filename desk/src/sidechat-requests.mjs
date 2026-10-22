import {toast} from './state.mjs';
import {t as uiT,text as uiText} from './ui-text.mjs';
import {message as uiMessage} from './i18n.mjs';
import {MAX_ANSWER_CHARS,questionRequest,questionSubmitAction} from './claude-questions.mjs';
import {h} from './sidechat-message-view.mjs';

/* Perguntas/permissões do chat lateral, no canal dele (#43 fase 2: saíram de
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
  card.append(h('p',{class:'sidechat-request-title',text:String(event.title||(method==='confirm'||method==='permission'?uiT('sidechat.request.permission'):uiT('sidechat.request.question')))}));
  if(event.message)card.append(h('p',{class:'sidechat-request-text',text:String(event.message)}));
  if(method==='question'){
   const request=questionRequest(event.questions);
   card._questions=request.questions;
   if(request.ok){
    request.questions.forEach((question,index)=>{
     const block=h('div',{class:'sidechat-question','data-q-index':String(index)});
     block.append(h('p',{class:'sidechat-request-q',text:question.question}));
     const options=h('div',{class:'sidechat-q-options',role:question.multiSelect?'group':'radiogroup','aria-label':question.question});
     for(const option of question.options){
      const input=h('input',{type:question.multiSelect?'checkbox':'radio',name:`sq-${requestId}-${index}`,class:'sidechat-option-input',value:option.label});
      const body=h('span',{},h('span',{text:option.label}));
      if(option.description)body.append(h('small',{class:'sidechat-option-description',text:option.description}));
      options.append(h('label',{class:'sidechat-q-option'},input,body));
     }
     const free=h('input',{type:'text',class:'sidechat-request-input',maxlength:String(MAX_ANSWER_CHARS),placeholder:uiT(question.options.length?'dialog.otherAnswer':'dialog.typeAnswer'),'aria-label':uiT('sidechat.request.answerFor',{question:question.question})});
     free.addEventListener('input',()=>{if(free.value)for(const input of options.querySelectorAll('input'))input.checked=false;clearRequestError(card);});
     options.addEventListener('change',()=>{free.value='';clearRequestError(card);});
     block.append(options,free);card.append(block);
    });
    card.append(h('button',{type:'button',class:'sidechat-request-submit',text:uiT('sidechat.request.respond')}));
   }else{
    card.append(h('p',{class:'sidechat-request-error',role:'alert',text:uiT('sidechat.request.cannotShow')}));
   }
   card.append(h('button',{type:'button',class:'sidechat-request-action',text:uiT('common.cancel'),'data-answer':'cancel'}));
  }else if(method==='confirm'||method==='permission'){
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
  let payload;
  if(card._questions){
   const picks=[...card.querySelectorAll('.sidechat-question')].map(block=>({selected:[...block.querySelectorAll('.sidechat-option-input:checked')].map(input=>input.value),text:block.querySelector('.sidechat-request-input')?.value||''}));
   const action=questionSubmitAction(card._questions,picks,'ok');
   if(action.action!=='answers'){
    requestError(card,action.errors.map(error=>uiText(error.message)).join(' ')||uiT('sidechat.request.checkAnswers'));
    card.querySelector(`.sidechat-question[data-q-index="${action.errors[0]?.index||0}"] input`)?.focus();
    return;
   }
   payload={answers:action.answers};
  }else{
   const inputs=[...card.querySelectorAll('.sidechat-request-input')];
   payload=inputs.length===1?{value:inputs[0].value}:{answers:Object.fromEntries(inputs.map((input,index)=>[uiT('sidechat.request.answerN',{n:index+1}),input.value]))};
  }
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
