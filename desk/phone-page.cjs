// @ts-check
'use strict';

/* A página que o celular abre pelo QR code (#36). Uma página só, montada na
   memória a cada pedido: nada vem do disco. Os textos são do catálogo
   (`phone.page.*`) no idioma da Mesa; a página não carrega nada de fora
   (a Content-Security-Policy do host só deixa o script com o nonce desta
   resposta e o envio para a própria origem).

   "Tirar foto" usa `capture="environment"`: abre a câmera e, no iPhone, o
   escaneamento de documento, sem HTTPS. Cada foto vai num pedido próprio para
   `<caminho>/photo`, uma de cada vez, e a página confirma "Enviado para a Mesa".

   Redesenho da #66: três estados em `main[data-state]`, cada um com um do trio
   (`phone-cast.cjs`): start (∫, o convite), sending (Σ, a barra e as enviadas)
   e offline (∇, sem conexão, com "Tentar de novo" para as fotos que faltaram).
   O layout mora em `src/phone-page.css`. */

const {phoneCastMarkup} = require('./phone-cast.cjs');

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[c]);

/* Plural escolhido no celular, pela contagem da hora: vão as duas formas. */
const READY_KEY = 'phone.page.ready';

/* Frases que o script troca na hora: os nomes entre chaves ficam literais. */
function pageTexts(t, maxMb) {
  return {
    sending: t('phone.page.sending', {n: '{n}', total: '{total}'}),
    sent: t('phone.page.sent', {n: '{n}', total: '{total}'}),
    readyOne: t(`${READY_KEY}.one`, {count: '{count}'}),
    readyOther: t(`${READY_KEY}.other`, {count: '{count}'}),
    camera: t('phone.page.camera'),
    gallery: t('phone.page.gallery'),
    more: t('phone.page.more'),
    moreGallery: t('phone.page.moreGallery'),
    gone: t('phone.page.gone'),
    tooBig: t('phone.page.tooBig', {mb: maxMb}),
    wrongType: t('phone.page.wrongType'),
    full: t('phone.page.full'),
    network: t('phone.page.network'),
    sentAlt: t('phone.page.sentAlt', {n: '{n}'}),
  };
}

/* Ícones de traço (câmera, galeria, cadeado, ✓), sem estilo inline por causa da CSP. */
const ICON = {
  camera: '<svg class="icon" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="13" r="3.5"/></svg>',
  gallery: '<svg class="icon" width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/></svg>',
  lock: '<svg class="icon" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
  done: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7"/></svg>',
};

/* Script da página: envia cada foto num pedido, uma de cada vez. Sem rede, as
   que faltaram ficam em `pending` para o "Tentar de novo". */
const SCRIPT = `
const texts=JSON.parse(document.getElementById('texts').textContent);
const $=id=>document.getElementById(id);
const main=document.querySelector('main'),status=$('status'),ready=$('ready'),progress=$('progress'),fillBar=$('bar-fill'),log=$('log'),sent=$('sent'),doneMark=$('done-mark').content;
for(const el of document.querySelectorAll('[data-style]'))for(const rule of el.dataset.style.split(';')){const at=rule.indexOf(':');if(at>0)el.style.setProperty(rule.slice(0,at).trim(),rule.slice(at+1).trim());}
let sentCount=0,busy=false,pending=[];
const fill=(s,v)=>s.replace(/\\{(\\w+)\\}/g,(m,k)=>k in v?v[k]:m);
const failure={404:texts.gone,413:texts.tooBig,415:texts.wrongType};
function setState(state){
 main.dataset.state=state;
 const more=state!=='start';
 $('camera-text').textContent=more?texts.more:texts.camera;
 $('gallery-text').textContent=more?texts.moreGallery:texts.gallery;
}
function showProgress(text,done,total,bad){
 status.textContent=text;status.classList.toggle('bad',!!bad);progress.classList.toggle('busy',busy);
 ready.textContent=busy&&done?fill(done===1?texts.readyOne:texts.readyOther,{count:done}):'';
 fillBar.style.setProperty('--done',String(total?done/total:0));
}
function addThumb(file){
 const thumb=document.createElement('figure');thumb.className='thumb pending';
 const img=document.createElement('img');img.alt='';img.src=URL.createObjectURL(file);
 const mark=document.createElement('span');mark.className='done';mark.append(doneMark.cloneNode(true));
 thumb.append(img,mark);sent.append(thumb);document.querySelector('.sent-title').hidden=false;
 return thumb;
}
function dropThumb(thumb){URL.revokeObjectURL(thumb.querySelector('img').src);thumb.remove();if(!sent.children.length)document.querySelector('.sent-title').hidden=true;}
async function send(files){
 if(busy||!files.length)return;busy=true;pending=[...files];setState('sending');
 const total=files.length;let done=0;
 for(const file of files){
  showProgress(fill(texts.sending,{n:done+1,total}),done,total);
  const thumb=addThumb(file);
  let reply;
  try{reply=await fetch(location.pathname.replace(/\\/$/,'')+'/photo',{method:'POST',body:file,headers:{'Content-Type':file.type||'application/octet-stream'}});}
  catch{dropThumb(thumb);busy=false;setState('offline');return;}
  if(!reply.ok){
   const body=await reply.json().catch(()=>({}));
   dropThumb(thumb);busy=false;pending=[];
   showProgress(body.reason==='full'?texts.full:(failure[reply.status]||texts.network),done,total,true);return;
  }
  done++;pending.shift();
  thumb.classList.remove('pending');thumb.querySelector('img').alt=fill(texts.sentAlt,{n:sentCount+=1});
  const item=document.createElement('li');item.textContent=fill(texts.sent,{n:done,total});log.prepend(item);
 }
 busy=false;showProgress(fill(texts.sent,{n:done,total}),done,total);
}
for(const input of document.querySelectorAll('input[type=file]'))input.addEventListener('change',()=>{const files=[...input.files];input.value='';send(files);});
$('retry').addEventListener('click',()=>send(pending));
`;

/** O topo: ∫ no início e Σ enquanto envia, ao lado do título; no erro, só o título. */
function headHtml(t) {
  return `<header class="head">
<div class="cast cast-start">${phoneCastMarkup('start')}</div>
<div class="cast cast-sending">${phoneCastMarkup('sending')}</div>
<div class="titles"><span class="kicker">${escapeHtml(t('phone.page.connected'))}</span><h1 class="serif">${escapeHtml(t('phone.page.title'))}</h1></div>
</header>`;
}

/** O cartão de "Sem conexão", com o ∇ aflito. */
function offlineHtml(t) {
  return `<section id="offline" role="alert">
<div class="cast">${phoneCastMarkup('offline')}</div>
<strong class="serif">${escapeHtml(t('phone.page.network'))}</strong>
<p>${escapeHtml(t('phone.page.networkHelp'))}</p>
<button id="retry" type="button">${escapeHtml(t('phone.page.retry'))}</button>
</section>`;
}

/** Os dois botões de foto e, no início, a dica. */
function actionsHtml(t) {
  return `<div class="actions">
<label class="button primary">${ICON.camera}<span id="camera-text">${escapeHtml(t('phone.page.camera'))}</span><input id="camera" type="file" accept="image/*" capture="environment"></label>
<label class="button">${ICON.gallery}<span id="gallery-text">${escapeHtml(t('phone.page.gallery'))}</span><input id="gallery" type="file" accept="image/*" multiple></label>
</div>
<section class="tips"><h2 class="serif">${escapeHtml(t('phone.page.tipsTitle'))}</h2><ol>
<li>${escapeHtml(t('phone.page.tipFrame'))}</li><li>${escapeHtml(t('phone.page.tipLight'))}</li><li>${escapeHtml(t('phone.page.tipPage'))}</li>
</ol></section>`;
}

/**
 * HTML da página do celular.
 *
 * @param {{t: (key: string, args?: Record<string, string|number>) => string, lang: string, nonce: string, maxMb: number, lookCss?: string, castCss?: string}} options
 *   `lookCss` é o `:root` com o tema e o acento da Mesa (`phone-look.cjs`); `castCss` é o trio e o layout (`phoneCastCss`).
 * @returns {string}
 * @example phonePageHtml({t, lang: 'pt-BR', nonce: 'abc', maxMb: 15}).startsWith('<!doctype html>') // true
 */
function phonePageHtml({t, lang, nonce, maxMb, lookCss = '', castCss = ''}) {
  const texts = JSON.stringify(pageTexts(t, maxMb)).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="${escapeHtml(lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="referrer" content="no-referrer">
<title>${escapeHtml(t('phone.page.title'))}</title>
<style nonce="${nonce}">${lookCss}${castCss}</style>
</head>
<body>
<main data-state="start">
${headHtml(t)}
${offlineHtml(t)}
<p class="lead">${escapeHtml(t('phone.page.lead'))}</p>
<div id="progress"><div class="progress-line"><strong id="status" role="status" aria-live="polite"></strong><span id="ready"></span></div><div class="bar" aria-hidden="true"><div id="bar-fill"></div></div></div>
${actionsHtml(t)}
<h2 class="sent-title serif" hidden>${escapeHtml(t('phone.page.sentTitle'))}</h2>
<div id="sent" aria-label="${escapeHtml(t('phone.page.sentTitle'))}"></div>
<ul id="log"></ul>
<div class="spacer"></div>
<p class="privacy">${ICON.lock}<span>${escapeHtml(t('phone.page.privacy'))}</span></p>
</main>
<template id="done-mark">${ICON.done}</template>
<script id="texts" type="application/json">${texts}</script>
<script nonce="${nonce}">${SCRIPT}</script>
</body>
</html>`;
}

module.exports = {phonePageHtml};
