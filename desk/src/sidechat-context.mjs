import {toast} from './state.mjs';
import {t as uiT,formatDate} from './ui-text.mjs';
import {message as uiMessage} from './i18n.mjs';
import {h} from './sidechat-message-view.mjs';

/* Contexto do chat lateral (#43 fase 2: saiu de sidechat.mjs para caber no
   teto). O estado e o bridge continuam no sidechat; entram por parâmetro, com
   os elementos lidos na hora (só existem depois do mount). */

/**
 * Cria o desenho e a atualização do popover de contexto do chat lateral.
 * @param {{state:{id:string,context:object|null,messages:object[],cards:object[]},api:()=>any,currentRefs:()=>object[],normalizeMessage:(raw:unknown)=>object|null,paintScope:()=>void,root:()=>HTMLElement|null,pop:()=>HTMLElement|null}} deps
 * @returns {{refsLabel:(refs:unknown)=>string,paintContextPop:()=>void,toggleContextPop:()=>void,hideContextPop:()=>void,refreshContext:()=>Promise<void>}}
 * @example const context=createSidechatContext({state,api:()=>window.desk,currentRefs:()=>[],normalizeMessage:(raw)=>raw,paintScope(){},root:()=>null,pop:()=>null});
 */
export function createSidechatContext({state,api,currentRefs,normalizeMessage,paintScope,root,pop}){
 function refsLabel(refs){
  const list=Array.isArray(refs)?refs:[];
  if(!list.length)return uiT('sidechat.refs.none');
  return list.map(ref=>`${String(ref?.path||'').split(/[/\\]/).pop()||'PDF'} p.${Number(ref?.page)||1}`).join(', ');
 }

 function contextRows(){
  const context=state.context||{};
  const rows=[];
  rows.push(h('p',{class:'fine'},h('strong',{text:uiT('sidechat.ctx.main')}),document.createTextNode(` ${uiT('sidechat.ctx.mainBody')}`)));
  rows.push(h('p',{class:'fine'},h('strong',{text:uiT('sidechat.ctx.pdfs')}),document.createTextNode(` ${refsLabel(context.refs)}.`)));
  const study=context.study||{};
  if(study.title||study.xopp)rows.push(h('p',{class:'fine'},h('strong',{text:uiT('sidechat.ctx.study')}),document.createTextNode(` ${[study.title,study.xopp&&String(study.xopp).split(/[/\\]/).pop()].filter(Boolean).join(' · ')}.`)));
  if(context.at)rows.push(h('p',{class:'fine'},h('strong',{text:uiT('sidechat.ctx.copiedAt')}),document.createTextNode(` ${formatWhen(context.at)}.`)));
  rows.push(h('button',{type:'button',class:'guide-link','data-open-guide':'lateral',text:uiT('guide.howItWorks')}));
  return rows;
 }

 function formatWhen(value){
  const date=new Date(value);if(Number.isNaN(date.getTime()))return String(value);
  return formatDate(date,{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
 }

 function paintContextPop(){
  const ctxPop=pop();if(!ctxPop)return;
  const close=h('button',{type:'button',class:'primary',text:uiT('common.close')});
  close.addEventListener('click',hideContextPop);
  ctxPop.replaceChildren(...contextRows());
  ctxPop.append(h('div',{class:'dialog-actions'},close));
 }
 function toggleContextPop(){
  const ctxPop=pop();if(!ctxPop)return;
  if(!ctxPop.hidden){hideContextPop();return;}
  paintContextPop();
  ctxPop.hidden=false;
  root()?.querySelector('#sidechat-context')?.setAttribute('aria-expanded','true');
 }
 function hideContextPop(){
  const ctxPop=pop();if(!ctxPop)return;
  ctxPop.hidden=true;
  root()?.querySelector('#sidechat-context')?.setAttribute('aria-expanded','false');
 }

 async function refreshContext(){
  if(!state.id){toast(uiMessage('toast.openSidechatFirst'));return;}
  const id=state.id;
  try{
   const payload=await api().sidechatContext({id,refs:currentRefs()});
   if(state.id!==id)return;
   if(payload&&typeof payload==='object')state.context=payload.context&&typeof payload.context==='object'?payload.context:payload;
   if(Array.isArray(payload?.messages)&&payload.messages.length&&!state.messages.length)state.messages=payload.messages.map(normalizeMessage).filter(message=>message&&String(message.text||'').trim());
   if(Array.isArray(payload?.cards))state.cards=payload.cards.filter(card=>card&&typeof card.id==='string');
   paintContextPop();
   paintScope();
   const context=state.context||{};
   toast(uiMessage('toast.contextUpdated',{refs:refsLabel(context.refs)}));
  }catch(error){
   toast(error.message);
  }
 }

 return {refsLabel,paintContextPop,toggleContextPop,hideContextPop,refreshContext};
}
