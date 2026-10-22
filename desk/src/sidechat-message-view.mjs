import {toast} from './state.mjs';
import {insertMainDraft} from './chat.mjs';
import {markup,decorateCode} from './markdown.mjs';
import {build,renderChildren} from './view-host.mjs';
import talkCore from './generated/talkview.core.js';
import {t as uiT,text as uiText} from './ui-text.mjs';
import {message as uiMessage} from './i18n.mjs';

/* Cartões de mensagem do chat lateral (#43 fase 2: saíram de sidechat.mjs).
   Sem estado: o rótulo do motor entra por parâmetro; o DOM usa o mesmo
   renderer de Markdown+LaTeX do chat principal. */

/**
 * Cria um elemento com atributos e filhos; `class` e `text` são atalhos.
 * @param {string} tag
 * @param {Record<string, unknown>} [attrs]
 * @param {...(Node|string|null|Array<Node|string|null>)} kids
 * @returns {HTMLElement}
 * @example h('p',{class:'fine',text:'oi'})
 */
export function h(tag,attrs={},...kids){
 const node=document.createElement(tag);
 for(const [key,value] of Object.entries(attrs)){
  if(value==null)continue;
  if(key==='class')node.className=String(value);
  else if(key==='text')node.textContent=String(value);
  else node.setAttribute(key,String(value));
 }
 for(const kid of kids.flat())if(kid!=null)node.append(kid);
 return node;
}

/**
 * Cartão de uma mensagem do lateral, com copiar e (resposta do tutor) levar à sessão principal.
 * @param {{role:string,text?:string}} message
 * @param {string} engineLabel rótulo do motor para a resposta do tutor
 * @returns {HTMLElement}
 * @example sidechatMessageCard({role:'assistant',text:'oi'},'Tutor')
 */
export function sidechatMessageCard(message,engineLabel){
 const card=h('article',{class:`sidechat-msg message ${message.role}`,role:'group'},h('div',{class:'role sidechat-role',text:message.role==='user'?uiT('sidechat.role.you'):message.role==='system'?uiT('sidechat.role.system'):engineLabel}));
 const body=h('div',{class:'body sidechat-body'});
 paintSidechatBody(body,uiText(String(message.text??'')),false);
 card.append(body);
 card._text=String(message.text||'');
 const actions=h('div',{class:'sidechat-msg-actions'});
 actions.append(h('button',{type:'button',class:'sidechat-copy',text:uiT('sidechat.copy')}));
 if(message.role==='assistant'&&String(message.text||'').trim())actions.append(h('button',{type:'button',class:'sidechat-to-main',title:uiT('sidechat.toMainTitle'),text:uiT('sidechat.toMain')}));
 card.append(actions);
 return card;
}
export function paintSidechatBody(body,text,live){
 if(!body)return;
 body.innerHTML=markup(String(text||''));
 decorateCode(body);
 if(!live)hydrateSidechatAssets(body);
}
/* Figuras geradas (mesmo caminho do chat principal): `readImage` → `assetKids`
   do núcleo; sem a imagem, o fallback de texto do núcleo. */
export function hydrateSidechatAssets(node){
 for(const figure of node.querySelectorAll('figure.asset[data-asset]')){
  const source=figure.dataset.asset||'',caption=figure.dataset.caption||'';
  if(!source)continue;
  window.desk.readImage(source).then(hit=>{
   if(!figure.isConnected)return;
   if(!hit){figure.replaceWith(build(talkCore.assetFallback(source)));return;}
   renderChildren(figure,talkCore.assetKids({$:'AssetRow',src:hit.dataUrl,path:source,alt:caption||hit.name||'Imagem gerada',caption:caption||hit.name||''}));
  }).catch(()=>{if(figure.isConnected)figure.replaceWith(build(talkCore.assetFallback(source)));});
 }
}
export function copySidechatMessage(button){
 const card=button.closest('.sidechat-msg');
 const text=card?._text||card?.querySelector('.sidechat-body')?.innerText||'';
 if(!text)return;
 navigator.clipboard.writeText(text).then(()=>toast(uiMessage('sidechat.copied'))).catch(error=>toast(error.message));
}
export function sendSidechatMessageToMain(button){
 const card=button.closest('.sidechat-msg');
 const text=card?._text||'';
 if(!String(text).trim())return;
 if(insertMainDraft(text))toast(uiMessage('sidechat.toMainDone'));
}
