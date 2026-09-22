import {marked} from '../node_modules/marked/lib/marked.esm.js';
import katex from '../node_modules/katex/dist/katex.mjs';
import DOMPurify from '../node_modules/dompurify/dist/purify.es.mjs';
import {displayUserText,contentParts} from '../text.mjs';
import {highlightCode} from '../highlight.mjs';
import {$,S,toast,activity,activityLive,atBottom,connectionState,followBottom,refs,save,layoutSnapshot,setBusy,refreshMeter,connect} from './state.mjs';
import {beginCaptureLock,captureLockValid,endCaptureLock} from './capture-lock.mjs';
import {createWorkLogView} from './worklog-view.mjs';
import {build,htmlNode,preserveFocus,renderChildren} from './view-host.mjs';
import {renderImageChrome,renderPiDialog} from './dialogs.mjs';
import talkCore from './generated/talkview.core.js';
import attachview from './generated/attachview.core.js';
import attachCore from './generated/attachments.core.js';
import * as worklog from './worklog.mjs';
const ASSET_EXT=/\.(?:png|jpe?g|gif|webp|svg)$/i;
const ASSET_LOCAL=/^(?:file:\/\/|\.{0,2}[\\/]|[\\/]|desk[\\/]|[a-zA-Z]:[\\/])/i;
const ASSET_MARKDOWN=/!\[([^\]]*)\]\(\s*(?:<([^<>]+)>|((?:file:\/\/|\.{0,2}[\\/]|[\\/]|desk[\\/]|[a-zA-Z]:[\\/])[^)]*?\.(?:png|jpe?g|gif|webp|svg))(?:\s+"[^"]*")?)\s*\)/gi;
function assetSource(value){const text=String(value||'').trim();return ASSET_LOCAL.test(text)&&ASSET_EXT.test(text.split(/[?#]/)[0]);}
function assetLocalPath(value){const text=String(value||'').trim();if(!text||text.length>4096||/[\n\r]/.test(text)||!assetSource(text))return '';return text;}
function attrValue(value){return String(value).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');}
/* O marked entrega o código já escapado (&gt;, &amp;) e o realce escapa de novo — sem isso
   o bloco mostra "=&gt;" e "&amp;&amp;" na tela. Desescape único (o inverso exato do marked). */
function unescHtml(value){return String(value).replace(/&(amp|lt|gt|quot|apos|#39|#x27);/g,(_,e)=>({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",'#39':"'",'#x27':"'"}[e]));}
function markup(text,allowAssets=true){
 const math=[],assets=[];
 const withMath=text.replace(/\$\$([\s\S]*?)\$\$|\\\[([\s\S]*?)\\\]|\\\(([\s\S]*?)\\\)|(?<!\$)\$([^\n$]+)\$(?!\$)/g,(match,a,b,c,d)=>{const n=math.length,tex=a??b??c??d,display=a!==undefined||b!==undefined;try{const source=display?`$$${tex}$$`:`$${tex}$`;math.push(katex.renderToString(tex,{displayMode:display,throwOnError:false,trust:false}).replace('<span',()=>`<span data-tex="${attrValue(source)}"`));}catch{math.push(match);}return `MATHPLACEHOLDER${n}END`;});
 const protectedText=withMath.replace(ASSET_MARKDOWN,(match,alt,bracketed,plain)=>{const source=(bracketed??plain??'').trim();if(!assetSource(source))return match;if(!allowAssets)return `\`${source}\``;assets.push({source,alt:(alt||'').trim()});return `ASSETPLACEHOLDER${assets.length-1}END`;});
 let html=marked.parse(protectedText,{breaks:true});
 // realce dos blocos de código: fora do DOMPurify via placeholder (os spans não são tags seguras lá)
 const codes=[];
 html=html.replace(/<pre><code(?: class="language-([\w-]+)")?>([\s\S]*?)<\/code><\/pre>/g,(all,lang,code)=>{
  codes.push(`<pre class="hl"><code data-lang="${attrValue(lang||'')}">${highlightCode(unescHtml(code),lang)}</code></pre>`);
  return `CODEPLACEHOLDER${codes.length-1}END`;
 });
 html=html.replace(/MATHPLACEHOLDER(\d+)END/g,(_,n)=>math[n]);
 const figure=n=>{const asset=assets[Number(n)];return `<figure class="asset" data-asset="${attrValue(asset.source)}"${asset.alt?` data-caption="${attrValue(asset.alt)}"`:''}></figure>`;};
 html=html.replace(/<p>\s*ASSETPLACEHOLDER(\d+)END\s*<\/p>/g,(_,n)=>figure(n)).replace(/ASSETPLACEHOLDER(\d+)END/g,(_,n)=>figure(n));
 return DOMPurify.sanitize(html,{FORBID_TAGS:['style','iframe','form','input','button'],FORBID_ATTR:['srcset']})
  .replace(/CODEPLACEHOLDER(\d+)END/g,(_,n)=>codes[Number(n)]||'');
}
function assetFallback(source){return build(talkCore.assetFallback(source));}
/* Markdown+LaTeX de um trecho curto (opção de quiz, observação): sem o <p>
   externo quando é um parágrafo só. Sem assets — é rótulo, não figura. */
function markupInline(text){const html=markup(text,false);const single=/^<p>([\s\S]*?)<\/p>\s*$/.exec(html);return single?single[1]:html;}
/* Fronteira dos assets: `markup` continua dono do HTML do Markdown — a figura
   nasce como placeholder (`figure.asset[data-asset]`) e o `<pre>` realçado sai
   do CODEPLACEHOLDER. A **forma** hidratada (img.plot + figcaption, o `code` de
   fallback e a moldura `.codeblock`) vem do `core/talkview.bend`; ler a imagem
   (IPC `readImage`), o overlay de cópia (clipboard) e os cliques delegados em
   `#messages` ficam aqui. */
function assetRow(source,src,alt,caption){return {$:'AssetRow',src,path:source,alt,caption};}
function hydrateAssets(root){
 for(const figure of root.querySelectorAll('figure.asset[data-asset]')){
  const source=figure.dataset.asset||'',caption=figure.dataset.caption||'';
  if(!source)continue;
  window.desk.readImage(source).then(hit=>{
   if(!figure.isConnected)return;
   if(!hit){figure.replaceWith(assetFallback(source));return;}
   renderChildren(figure,talkCore.assetKids(assetRow(source,hit.dataUrl,caption||hit.name||'Imagem gerada',caption||hit.name||'')));
   const img=figure.querySelector('img.plot');
   if(img)wrapCopy(img);
  }).catch(()=>{if(figure.isConnected)figure.replaceWith(assetFallback(source));});
 }
 for(const code of root.querySelectorAll('code')){
  if(code.closest('pre'))continue;
  const source=assetLocalPath(code.textContent);
  if(!source)continue;
  window.desk.readImage(source).then(hit=>{
   if(!hit||!code.isConnected)return;
   const figure=build(talkCore.assetFigure(assetRow(source,hit.dataUrl,hit.name||'Imagem gerada',hit.name||'')));
   const img=figure.querySelector('img.plot');
   if(img)wrapCopy(img);
   code.replaceWith(figure);
  }).catch(()=>{});
 }
}
function bendList(items){let out={$:'Nil'};for(let i=items.length-1;i>=0;i--)out={$:'Con',head:items[i],tail:out};return out;}
function message(role,text,images=[],parent=null){
 $('#welcome')?.remove();
 let el;
 const handlers={
  CopyMessage:async e=>{e.stopPropagation();try{await navigator.clipboard.writeText(el._raw||el.querySelector('.body').innerText);toast('Mensagem copiada.');}catch(err){toast(err.message);}},
 };
 el=build(talkCore.message(role==='user',htmlNode(''),bendList(images),true,false),handlers);
 (parent||$('#messages')).append(el);updateMessage(el,text,images);return el;
}
function decorateCode(body){
 for(const pre of body.querySelectorAll('pre')){
  if(pre.parentElement?.classList.contains('codeblock'))continue;
  const lang=(pre.querySelector('code')?.dataset.lang||'').trim();
  pre.replaceWith(build(talkCore.codeBlock(htmlNode(pre.outerHTML),lang.toUpperCase())));
 }
}
/* Num lote de histórico a rolagem é medida uma vez (`showHistory`); durante o
   lote `paintMessage` não lê layout (o `atBottom()` por mensagem forçava um
   reflow por mensagem — com um token sem espaço de 20 KB, ~850 ms cada). */
let historyStick=null;
function paintMessage(el,text,images,live){
 /* "Estava no fim?" é medido antes de mexer no DOM: só aí a rolagem segue. */
 const stick=historyStick!==null?historyStick:(el.classList.contains('user')||atBottom());
 const body=el.querySelector('.body');
 const bodyTree=talkCore.messageBody(htmlNode(markup(displayUserText(text||''),!live)),bendList(images||[]));
 renderChildren(body,bodyTree.kids);
 if(!live)hydrateAssets(body);
 decorateCode(body);
 for(const img of body.querySelectorAll('img.shot'))wrapCopy(img);
 if(historyStick===null)followBottom(stick);
}
function updateMessage(el,text,images,live){
 if(text!=null)el._raw=text;
 if(!live){clearTimeout(el._tick);el._tick=0;paintMessage(el,text,images);return;}
 el._live=text;if(el._tick)return;el._tick=setTimeout(()=>{el._tick=0;if(selectionInsideMessages())return;paintMessage(el,el._live,[],true);},80);
}
export function showHistory(messages){
 const turns=worklog.historyTurns(messages||[]);
 /* As últimas 6 imagens ficam; as mais antigas saem (mesma regra de antes). */
 let keep=6;
 for(let i=turns.length-1;i>=0;i--){
  const images=turns[i].userImages||[];
  if(!images.length)continue;
  const kept=[];
  for(let j=images.length-1;j>=0;j--){
   if(keep>0){keep--;kept.unshift(images[j]);}
  }
  turns[i].userImages=kept;
 }
 /* "Estava no fim?" é medido uma vez, antes do lote; o histórico inteiro monta
    num DocumentFragment e entra no DOM de uma vez. O padrão antigo (medir/rolar
    por mensagem) forçava um layout síncrono por mensagem: com um token sem
    espaço a quebra de linha patológica do Blink (~850 ms por layout) multiplicava
    pelas 102 mensagens e congelava o renderer por minutos. */
 const stick=atBottom();
 $('#messages').replaceChildren();
 const frag=document.createDocumentFragment();
 historyStick=stick;
 try{
  for(const turn of turns){
   if(turn.userText||turn.userImages.length)message('user',turn.userText,turn.userImages,frag);
   if(turn.steps.length){
    const view=createWorkLogView();
    frag.append(view.el);
    view.render({steps:turn.steps,startedAt:turn.startedAt,endedAt:turn.endedAt,reason:'',text:turn.text},{live:false});
   }
   if(turn.text)message('assistant',turn.text,[],frag);
  }
 }finally{historyStick=null;}
 $('#messages').append(frag);
 followBottom(stick);
}
export async function doCompact(text){
 if(S.busy){toast('Pare a resposta antes de compactar.');return;}
 const instructions=text.replace(/^\/compact\b/i,'').trim();
 try{activity('Compactando o contexto da conversa…');const result=await window.desk.compact(instructions);
  const before=Number(result?.tokensBefore)||0;
  toast(`Contexto compactado${before?` · ${before.toLocaleString('pt-BR')} tokens resumidos`:''}.`);
  activity('');refreshMeter();
 }catch(e){activity('');toast(e.message);}
}
export async function send(text,images){
 if(S.busy)return;
 const pending=images===undefined?S.attachments.slice():images;
 if(!text.trim()&&!pending.length)return;
 if(images===undefined&&/^\/compact\b/i.test(text.trim())){if(S.busy){toast('Pare a resposta antes de compactar.');return;}$('#prompt').value='';await doCompact(text.trim());return;}
 /* `/conferir` digitado na mão não vai mais para o Pi (evita a captura dupla da
    extensão visual): redireciona para o anexo e devolve a observação como rascunho. */
 if(images===undefined&&/^\/conferir\b/i.test(text.trim())){const note=text.trim().replace(/^\/conferir\b/i,'').trim();$('#prompt').value='';await conferir();if(note)$('#prompt').value=note;return;}
 try{
  setBusy(true);
  clearTimeout(S.saveTimer);await window.desk.save(layoutSnapshot());await connect();
  if(pending.length&&!S.supportsImages){setBusy(false);toast('Escolha um modelo com suporte a imagens para anexar.');return;}
  message('user',text,pending.map(item=>item.dataUrl));$('#prompt').value='';
  const result=await window.desk.prompt({text,refs:refs(),images:pending.map(item=>item.dataUrl)});
  if(images===undefined)clearAttachments(pending);
  if(!result?.streaming)setBusy(false);
 }catch(e){setBusy(false);toast(e.message);}
}
/* dataURL → File sem `fetch` (o CSP do index.html não deixa `connect-src data:`):
   o base64 é decodificado na mão. */
function dataUrlFile(dataUrl,name){
 if(typeof dataUrl!=='string'||!dataUrl.startsWith('data:image/'))return null;
 const mime=/^data:([^;,]+)/.exec(dataUrl)?.[1]||'image/png';
 try{
  const bin=atob(dataUrl.slice(dataUrl.indexOf(',')+1));
  const bytes=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
  return new File([bytes],name,{type:mime});
 }catch{return null;}
}
/* Conferir Xournal++ virou anexo: captura a janela do Xournal++ e entrega a
   imagem na bandeja (`addAttachments` herda re-encode, teto de bytes e o aviso
   de modelo sem visão). Nada vai para o Pi sozinho — o usuário escreve e envia
   junto; uma imagem por captura no JSONL. O requisito de visão é do envio.
   B6: clique duplo engole o segundo clique (uma captura em voo por vez) e a
   matéria/sessão de destino fica FIXADA — se ela mudou durante a captura, a
   imagem é descartada em vez de pousar na conversa de outra matéria. */
export async function conferir(){
 if(S.busy)return;
 if(S.appConfig.desk?.conferir===false)return;
 if(!S.captureOk){toast('Conferir Xournal++ indisponível neste computador.');return;}
 const lock=beginCaptureLock(S);
 if(!lock)return;
 try{
  const shot=await window.desk.captureReady();
  if(!captureLockValid(S,lock)){toast('A matéria mudou durante a captura — captura descartada.');return;}
  const file=dataUrlFile(shot?.dataUrl,'xournal.png');
  if(!file){toast('A captura não produziu uma imagem válida.');return;}
  const added=await addAttachments([file]);
  if(!added)return;
  toast('Captura do Xournal++ anexada — escreva e envie.');
  $('#prompt').focus();
 }catch(e){toast(e.message);}
 finally{endCaptureLock(S,lock);}
}
export async function conferirGeogebra(){
 if(S.busy||S.connecting||S.switching)return;
 if(!S.connected){toast('Conecte ao Pi antes de conferir o GeoGebra.');return;}
 if(!S.supportsImages){toast('Este modelo não aceita imagens; escolha um modelo com visão.');return;}
 try{
  setBusy(true);
  const shot=await window.desk.ggbShot();
  const note=$('#prompt').value.trim();
  const label=note?`Conferir GeoGebra\n${note}`:'Conferir GeoGebra';
  message('user',label,[shot.dataUrl]);
  $('#prompt').value='';
  const text=note||'Confira o applet GeoGebra (print anexo): o gráfico/construção está coerente com o problema? Aponte o primeiro problema relevante. Use a ferramenta geogebra (state) se precisar dos detalhes.';
  const result=await window.desk.prompt({text,refs:refs()});
  if(!result?.streaming)setBusy(false);
 }catch(e){setBusy(false);toast(e.message);}
}
const ATTACH_TYPES=new Set(['image/png','image/jpeg','image/webp','image/gif']);
/* Números do núcleo (`core/attachments.bend`), não literais: MAX_ATTACH é a
   contagem por mensagem e MAX_ATTACH_BYTES é o teto de bytes crus do envio
   aplicado já ao anexar — a mesma recusa que o main faria depois, um passo
   antes. (maxImages é Nat: em JS chega como BigInt.) */
export const MAX_ATTACH=Number(attachCore.maxImages()),MAX_ATTACH_BYTES=attachCore.maxRawBytes();
const ATTACH_MAX_EDGE=1568;
async function prepareAttachment(file){
 const type=file.type||'image/png';
 if(type==='image/gif')return null;
 try{
  const bmp=await createImageBitmap(file);
  try{
   if(Math.max(bmp.width,bmp.height)<=ATTACH_MAX_EDGE)return null;
   const scale=ATTACH_MAX_EDGE/Math.max(bmp.width,bmp.height);
   const canvas=document.createElement('canvas');
   canvas.width=Math.max(1,Math.round(bmp.width*scale));
   canvas.height=Math.max(1,Math.round(bmp.height*scale));
   const ctx=canvas.getContext('2d');
   if(type==='image/jpeg'){ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);}
   ctx.drawImage(bmp,0,0,canvas.width,canvas.height);
   const mime=type==='image/jpeg'?'image/jpeg':(type==='image/webp'?'image/webp':'image/png');
   const blob=await new Promise(resolve=>canvas.toBlob(resolve,mime));
   return blob&&blob.size<file.size?blob:null;
  }finally{bmp.close?.();}
 }catch{return null;}
}
function imageFiles(list){return [...(list||[])].filter(file=>file&&ATTACH_TYPES.has(file.type));}
/* A lista de anexos vem de `core/attachview.bend` (a Conversa usa o mesmo
   núcleo); o host resolve os fatos (alt/rótulo/key/handler) e guarda o estado
   vivo — FileReader/compressão, remoção e o `hidden` da caixa. */
const attachmentHandlers={
 RemoveAttachment(e){
  const key=e.currentTarget?.closest?.('.attachment')?.dataset?.key||'';
  if(!key.startsWith('img-'))return;
  const item=S.attachments[Number(key.slice(4))];
  if(!item)return;
  S.attachments=S.attachments.filter(other=>other!==item);
  renderAttachments();
 }
};
function attachmentFacts(){
 return bendList(S.attachments.map((item,at)=>({
  $:'AttachImage',key:`img-${at}`,dataUrl:item.dataUrl,
  alt:item.name?`Anexo: ${item.name}`:'Imagem anexada',
  removeLabel:`Remover ${item.name||'imagem'}`,removeTitle:'',handler:'RemoveAttachment',lazy:true
 })));
}
function renderAttachments(){
 const box=$('#attachments');
 renderChildren(box,attachview.imageItemViews(attachmentFacts()),attachmentHandlers);
 box.hidden=!S.attachments.length;
}
export async function addAttachments(list){
 const gen=S.attachGen;let added=0;
 for(const file of imageFiles(list)){
  const name=file.name||'imagem';
  let blob=file,mime=file.type||'image/png';
  const prepared=await prepareAttachment(file);
  if(gen!==S.attachGen)return 0;
  if(prepared){blob=prepared;mime=prepared.type||mime;}
  if(blob.size>MAX_ATTACH_BYTES){toast(`Imagem grande demais (máx. ${Math.round(MAX_ATTACH_BYTES/1024/1024)} MB): ${file.name||'imagem'}.`);continue;}
  const dataUrl=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error||Error('Falha ao ler a imagem.'));reader.readAsDataURL(blob);}).catch(()=>'');
  if(gen!==S.attachGen)return 0;
  if(typeof dataUrl!=='string'||!dataUrl.startsWith('data:image/')){toast('Não foi possível ler a imagem.');continue;}
  if(S.attachments.length>=MAX_ATTACH){toast(`Máximo de ${MAX_ATTACH} imagens por mensagem.`);break;}
  S.attachments.push({dataUrl,mimeType:mime,name});added++;
 }
 if(gen!==S.attachGen)return 0;
 renderAttachments();
 if(added&&S.connected&&!S.supportsImages)toast('Este modelo não aceita imagens; escolha um modelo com visão.');
 return added;
}
function clearAttachments(items){S.attachments=items?S.attachments.filter(item=>!items.includes(item)):[];renderAttachments();}
export function resetAttachments(){S.attachGen++;S.attachments=[];renderAttachments();}
$('#attach').onclick=()=>$('#attach-input').click();
$('#attach-input').onchange=()=>{addAttachments($('#attach-input').files);$('#attach-input').value='';};
document.addEventListener('paste',e=>{
 if(S.busy)return;
 const files=[...(e.clipboardData?.items||[])].filter(item=>item.kind==='file'&&item.type.startsWith('image/')).map(item=>item.getAsFile()).filter(Boolean);
 if(files.length){e.preventDefault();addAttachments(files);}
});
document.addEventListener('dragover',e=>{if([...(e.dataTransfer?.types||[])].includes('Files'))e.preventDefault();});
document.addEventListener('drop',e=>{if([...(e.dataTransfer?.types||[])].includes('Files'))e.preventDefault();});
const chatEl=$('#chat');
chatEl.addEventListener('dragover',e=>{if([...(e.dataTransfer?.types||[])].includes('Files')){e.preventDefault();if(!S.busy)chatEl.classList.add('dropping');}});
chatEl.addEventListener('dragleave',e=>{if(!chatEl.contains(e.relatedTarget))chatEl.classList.remove('dropping');});
chatEl.addEventListener('drop',e=>{chatEl.classList.remove('dropping');const files=imageFiles(e.dataTransfer?.files);if(files.length){e.preventDefault();if(!S.busy)addAttachments(files);}});
function texSource(el){return el?.getAttribute?.('data-tex')||el?.querySelector?.('[data-tex]')?.getAttribute('data-tex')||'';}
const QUOTE_BLOCKS=new Set(['P','DIV','LI','UL','OL','H1','H2','H3','H4','H5','H6','PRE','BLOCKQUOTE','FIGURE','TABLE','TR','SECTION','ARTICLE','DETAILS','SUMMARY']);
function selectionText(node){
 if(node.nodeType===3)return node.nodeValue;
 if(node.nodeType!==1&&node.nodeType!==11)return '';
 let text='';
 for(const child of node.childNodes)text+=selectionText(child);
 if(node.nodeType===11)return text;
 const tag=node.tagName;
 if(tag==='BR')return '\n';
 if(tag==='SCRIPT'||tag==='STYLE'||tag==='BUTTON')return '';
 if(QUOTE_BLOCKS.has(tag))text='\n'+text+'\n';
 return text;
}
function selectionInsideMessages(){
 const selection=window.getSelection();
 if(!selection||selection.isCollapsed||!selection.rangeCount)return false;
 const node=selection.anchorNode;
 const el=node?.nodeType===1?node:node?.parentElement;
 return !!el?.closest?.('#messages');
}
function selectionInPdf(selection){
 if(!selection||selection.isCollapsed||!selection.rangeCount)return null;
 const node=selection.getRangeAt(0).commonAncestorContainer;
 const el=node?.nodeType===1?node:node?.parentElement;
 const layer=el?.closest?.('.textLayer');
 const panel=S.panels.find(p=>p.el===layer?.closest('.pdf-panel'));
 if(!panel||!panel.path)return null;
 const page=Number(layer.closest('.pdf-page')?.dataset.page)||panel.page;
 return {panel,page};
}
function enclosingTex(range){
 const wrapper=node=>{
  const el=node?.nodeType===1?node:node?.parentElement;
  return el?.closest?.('.katex-display')||el?.closest?.('.katex')||null;
 };
 const start=wrapper(range.startContainer),end=wrapper(range.endContainer);
 return start&&start===end?texSource(start):'';
}
function selectionQuote(){
 const selection=window.getSelection();
 if(!selection||selection.isCollapsed||!selection.rangeCount)return '';
 const pdf=selectionInPdf(selection);
 if(pdf){
  let text=selection.toString().replace(/\r/g,'').replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
  if(!text)return '';
  if(text.length>8000)text=text.slice(0,8000).trimEnd()+'…';
  return text+`\n\n(${pdf.panel.path.split(/[/\\]/).at(-1)}, p. ${pdf.page})`;
 }
 const range=selection.getRangeAt(0);
 const host=range.commonAncestorContainer.nodeType===1?range.commonAncestorContainer:range.commonAncestorContainer.parentElement;
 if(!host?.closest?.('#messages'))return '';
 const onlyTex=enclosingTex(range);
 if(onlyTex)return onlyTex;
 const fragment=range.cloneContents();
 for(const noise of [...(fragment.querySelectorAll?.('.role,.quiz-actions,.quiz-verdict,.quiz-note,.quiz-mark,.quiz-details')||[])])noise.remove();
 for(const display of [...(fragment.querySelectorAll?.('.katex-display')||[])]){const tex=texSource(display);if(tex)display.replaceWith(document.createTextNode(`\n${tex}\n`));}
 for(const katex of [...(fragment.querySelectorAll?.('.katex')||[])]){if(katex.closest('.katex-display'))continue;const tex=texSource(katex);if(tex)katex.replaceWith(document.createTextNode(tex));}
 let text=selectionText(fragment).replace(/\r/g,'').replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
 if(!text)return '';
 if(text.length>8000)text=text.slice(0,8000).trimEnd()+'…';
 return text;
}
export function hideQuoteButton(){$('#quote-btn').hidden=true;}
let quotePending='',quoteTimer;
function updateQuoteButton(){
 clearTimeout(quoteTimer);
 quoteTimer=setTimeout(()=>{
  const text=selectionQuote();
  if(!text){hideQuoteButton();return;}
  const rect=window.getSelection().getRangeAt(0).getBoundingClientRect();
  if(!rect||(!rect.width&&!rect.height)||rect.bottom<0||rect.top>innerHeight){hideQuoteButton();return;}
  const button=$('#quote-btn');
  button.hidden=false;
  button.style.left=Math.round(Math.max(8,Math.min(rect.right-24,innerWidth-70)))+'px';
  button.style.top=Math.round(Math.min(rect.bottom+8,innerHeight-40))+'px';
 },120);
}
function insertQuote(){
 const text=quotePending||selectionQuote();
 quotePending='';
 if(!text)return;
 const prompt=$('#prompt');
 const sep=!prompt.value?'':(prompt.value.endsWith('\n\n')?'':(prompt.value.endsWith('\n')?'\n':'\n\n'));
 prompt.value=prompt.value+sep+text.split('\n').map(line=>line?`> ${line}`:'>').join('\n')+'\n\n';
 prompt.focus();
 prompt.setSelectionRange(prompt.value.length,prompt.value.length);
 save();hideQuoteButton();window.getSelection()?.removeAllRanges();
}
document.addEventListener('selectionchange',updateQuoteButton);
$('#messages').addEventListener('scroll',hideQuoteButton,{passive:true});
$('#quote-btn').addEventListener('mousedown',e=>{e.preventDefault();quotePending=selectionQuote();});
$('#quote-btn').addEventListener('mouseleave',()=>{quotePending='';});
$('#quote-btn').addEventListener('click',()=>insertQuote());
let assistant=null,assistantText='';
let turnLog=null,turnView=null,liveTick=0,renderTimer=0,stoppedTurn=false;
window.addEventListener('desk-stop',()=>{stoppedTurn=true;});

/* Diário do turno: nasce no agent_start, é alimentado pelos eventos e recolhe no
   agent_end. O quiz fica fora dele — o card do quiz já é a interface da espera. */
function openTurnLog(){
 if(turnLog)return;
 turnLog=worklog.createLog(Date.now());
 turnView=createWorkLogView();
 $('#messages').append(turnView.el);
 turnView.render(turnLog,{live:true});
 clearInterval(liveTick);
 liveTick=setInterval(paintLive,1000);
}
function paintLive(){
 if(!turnLog)return;
 if(S.quizQueue&&S.quizQueue.length)return; /* o quiz manda na linha do composer */
 const step=worklog.runningStep(turnLog);
 const text=step?worklog.liveLabel(step):'Pi está pensando…';
 activityLive(`${text} · ${worklog.formatDuration(Date.now()-turnLog.startedAt)}`);
}
function renderTurn(note=''){
 if(!turnLog||!turnView)return;
 turnView.render(turnLog,{live:true,note});
 paintLive();
}
/* Deltas de pensamento chegam em rajada: repinta no máximo a cada ~90ms. */
function scheduleTurn(){
 if(renderTimer)return;
 renderTimer=setTimeout(()=>{renderTimer=0;if(turnLog)renderTurn();},90);
}
function settleTurn({reason=''}={}){
 if(!turnLog)return;
 worklog.finishLog(turnLog,{now:Date.now(),reason});
 if(turnLog.steps.length)turnView.render(turnLog,{live:false});
 else turnView.destroy();
 turnLog=null;turnView=null;
 clearInterval(liveTick);liveTick=0;
 clearTimeout(renderTimer);renderTimer=0;
}

window.desk.onEvent(e=>{
 if(['agent_start','message_start','message_update','message_end','tool_execution_start','tool_execution_end'].includes(e.type))S.busyStall=0;
 if(e.type==='agent_start'){stoppedTurn=false;openTurnLog();setBusy(true);paintLive();}
 if(e.type==='message_start'&&e.message?.role==='assistant'){assistant=null;assistantText='';}
 if(e.type==='message_update'&&e.assistantMessageEvent?.type==='thinking_delta'){
  openTurnLog();
  worklog.thinkingDelta(turnLog,e.assistantMessageEvent.delta||'');
  scheduleTurn();
 }
 if(e.type==='message_update'&&e.assistantMessageEvent?.type==='text_delta'){
  if(turnLog)worklog.closeThinking(turnLog);
  assistantText+=e.assistantMessageEvent.delta;
  if(!assistant)assistant=message('assistant','');
  updateMessage(assistant,assistantText,[],true);
  scheduleTurn();
 }
 if(e.type==='message_end'&&e.message?.role==='assistant'){
  const {text,images}=contentParts(e.message);
  if(assistant)updateMessage(assistant,text,images);
  else if(text||images.length)message('assistant',text,images);
  assistant=null;assistantText='';
  if(turnLog){worklog.closeThinking(turnLog);scheduleTurn();}
  if(e.message.errorMessage)toast(e.message.errorMessage);
 }
 if(e.type==='tool_execution_start'){
  if(e.toolName==='quiz'){
   S.quizQueue.push({id:e.toolCallId,args:e.args||{},card:null});
   if(S.quizQueue.length>4)S.quizQueue=S.quizQueue.slice(-4);
  }else{
   openTurnLog();
   worklog.closeThinking(turnLog);
   worklog.startTool(turnLog,{id:e.toolCallId,name:e.toolName,args:e.args,now:Date.now()});
   renderTurn();
  }
 }
 if(e.type==='tool_execution_end'){
  if(e.toolName==='quiz'){
   const item=S.quizQueue.find(entry=>entry.id===e.toolCallId);
   if(item){if(item.card)decorateQuizCard(item.card,e.result);S.quizQueue=S.quizQueue.filter(entry=>entry!==item);}
  }else if(turnLog){
   worklog.finishTool(turnLog,{id:e.toolCallId,result:e.result,isError:e.isError,now:Date.now()});
   renderTurn();
  }
 }
 if(e.type==='agent_end'){
  const aborted=stoppedTurn;stoppedTurn=false;
  settleTurn({reason:aborted?'stopped':''});
  setBusy(false);refreshMeter();
 }
 if(e.type==='desk_error'){
  if(turnLog){worklog.addError(turnLog,`Erro do Pi: ${e.message}`);settleTurn({reason:'error'});}
  S.connected=false;connectionState('error','Pi desconectado');setBusy(false);$('#auto-compact').hidden=true;activity(`Erro do Pi: ${e.message}`);toast(e.message);
 }
 if(e.type==='extension_ui_request'){
  if(e.method==='notify'){toast(e.message);if(e.notifyType==='error')setBusy(false);}
  else if(['select','confirm','input','editor'].includes(e.method))showDialog(e);
  else if(e.method==='set_editor_text'&&e.text)$('#prompt').value=e.text;
 }
});
const dialogQueue=[];let currentDialog=null;
function showDialog(e){dialogQueue.push(e);if(currentDialog)return;nextDialog();}
function respondDialog(data){window.desk.respond(data);currentDialog=null;nextDialog();}
function currentQuiz(){return S.quizQueue.find(entry=>!entry.card)||null;}
function quizSelect(e){return e.method==='select'&&Array.isArray(e.options)&&(!!currentQuiz()||/^Quiz\b/i.test(e.title||''));}
function quizMulti(e){return /^Quiz \(múltipla escolha\)/.test(e.title||'')||!!currentQuiz()?.args?.multiSelect;}
function quizQuestion(e){const match=/^Quiz(?: \(múltipla escolha\))? · ([\s\S]*)$/.exec(e.title||'');return String(currentQuiz()?.args?.question||match?.[1]||'Quiz').trim();}
function quizOptionRows(state){
 const details=state.result?.details,correct=new Set(details?.correctIndices||[]),selected=new Set((details?.answers||[]).map(a=>a.index));
 return state.labels.map((label,offset)=>{
  const index=offset+1;let good=false,bad=false,dim=false,mark='';
  if(details&&details.status!=='cancelled'&&details.status!=='unavailable'){
   if(details.dontKnow){if(correct.has(index)){good=true;mark='✓';}else dim=true;}
   else if(selected.has(index)&&correct.has(index)){good=true;mark='✓';}
   else if(selected.has(index)){bad=true;mark='✗';}
   else if(correct.has(index)){good=true;mark='✓';}
   else dim=true;
  }
  return {$:'QuizOptionRow',label,index:String(index),markup:htmlNode(markupInline(label)),checked:state.chosen.has(label),disabled:state.answered,correct:good,wrong:bad,dim,mark};
 });
}
function quizVerdict(state){
 const details=state.result?.details,status=details?.status;
 if(!state.result)return '';
 if(!details||status==='cancelled'||status==='unavailable')return status==='cancelled'?'Quiz cancelado.':(details?.message||'Quiz encerrado.');
 return details.dontKnow?'Você marcou "Não sei".':details.correct?'✓ Correta!':'✗ Incorreta.';
}
function quizRow(state){
 const details=state.result?.details||{},verdict=quizVerdict(state);
 return {
  $:'QuizRow',toolId:state.toolId,multi:state.multi,
  question:htmlNode(markup(state.question)),hasDetails:!!state.details,details:htmlNode(markupInline(state.details||'')),
  options:bendList(quizOptionRows(state)),showSend:state.multi&&!state.answered,sendDisabled:state.chosen.size===0,showSkip:!state.answered,
  hasVerdict:!!verdict,verdict,hasNote:!!details.note,note:htmlNode(markupInline(details.note||'')),
  hasExplain:!!details.explanation,explain:htmlNode(markup(details.explanation||'')),
 };
}
function paintQuiz(state,{append=false}={}){
 const messages=$('#messages'),old=state.card;
 const handlers={
  SelectQuizOption(event){
   if(state.answered)return;
   const label=event.currentTarget.dataset.label||'';
   if(state.multi){if(state.chosen.has(label))state.chosen.delete(label);else state.chosen.add(label);paintQuiz(state);return;}
   state.chosen.add(label);state.answered=true;paintQuiz(state);respondDialog({id:state.dialogId,value:label});
  },
  SendQuiz(){
   if(state.answered||!state.chosen.size)return;
   state.answered=true;paintQuiz(state);respondDialog({id:state.dialogId,value:JSON.stringify([...state.chosen])});
  },
  SkipQuiz(){if(state.answered)return;state.answered=true;paintQuiz(state);respondDialog({id:state.dialogId,cancelled:true});},
 };
 let card=null;
 const render=()=>{
  card=build(talkCore.quizCard(quizRow(state)),handlers);
  card._answered=state.answered;card._talkQuiz=state;
  if(append||!old?.isConnected)messages.append(card);else old.replaceWith(card);
  state.card=card;hydrateAssets(card);
 };
 /* O restore global busca a key em #messages; as keys `quiz-option-N` repetem
    entre cards, então ele pode achar a opção (já disabled) de um card anterior
    e o `focus()` virar no-op. Depois do render, o foco é corrigido dentro do
    card que acabou de ser pintado. */
 const active=document.activeElement;
 const scopedKey=old?.isConnected&&old.contains(active)?(active.dataset?.key||active.id||''):'';
 if(old?.isConnected)preserveFocus(messages,render);else render();
 if(scopedKey&&card){
  const next=card.querySelector(`[data-key="${CSS.escape(scopedKey)}"]`)||card.querySelector(`#${CSS.escape(scopedKey)}`);
  if(next&&!next.disabled)next.focus();
 }
 return state.card;
}
function renderQuizCard(e){
 $('#welcome')?.remove();
 const quiz=currentQuiz();
 const state={dialogId:e.id,toolId:quiz?.id||'',multi:quizMulti(e),question:quizQuestion(e),details:quiz?.args?.details||'',labels:(e.options||[]).map(String),chosen:new Set(),answered:false,result:null,card:null};
 const card=paintQuiz(state,{append:true});$('#messages').scrollTop=$('#messages').scrollHeight;
 if(quiz)quiz.card=card;
 card.querySelector('.quiz-option')?.focus();
 activity('Quiz aguardando sua resposta…');
}
function decorateQuizCard(card,result){
 const state=card?._talkQuiz;if(!state)return;
 state.answered=true;state.result=result;paintQuiz(state);
}
function dialogOptions(options){
 let out={$:'Nil'};
 for(let i=options.length-1;i>=0;i--)out={$:'Con',head:{$:'DialogOption',label:String(options[i]),value:String(options[i])},tail:out};
 return out;
}
function dialogField(e){
 if(e.method==='select')return {$:'FieldPick',label:'',value:String(e.prefill||''),options:dialogOptions(e.options||[])};
 if(e.method==='editor')return {$:'FieldEditor',label:'',value:String(e.prefill||''),hint:String(e.placeholder||'')};
 if(e.method==='input')return {$:'FieldText',label:'',value:String(e.prefill||''),hint:String(e.placeholder||'')};
 return null;
}
function nextDialog(){const e=dialogQueue.shift();S.dialogPending=!!e;if(!e)return;currentDialog=e;
 if(quizSelect(e)){renderQuizCard(e);return;}
 renderPiDialog({title:e.title||'Pi',message:e.message||'',field:dialogField(e)},{inline:markupInline});
 $('#pi-dialog').showModal();}
$('#pi-dialog').addEventListener('close',()=>{const e=currentDialog;if(!e)return;const ok=$('#pi-dialog').returnValue==='ok';respondDialog(ok?{id:e.id,...(e.method==='confirm'?{confirmed:true}:{value:$('#dialog-value')?.value})}:{id:e.id,cancelled:true});});
function dataUrlToBlob(dataUrl){
 const head=dataUrl.slice(0,dataUrl.indexOf(',')),body=dataUrl.slice(dataUrl.indexOf(',')+1);
 const bin=atob(body),bytes=new Uint8Array(bin.length);
 for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
 return new Blob([bytes],{type:head.slice(5,head.indexOf(';'))||'image/png'});
}
function toPngBlob(src){
 return new Promise((resolve,reject)=>{
  const image=new Image();
  image.onload=()=>{
   try{
    const canvas=document.createElement('canvas');
    canvas.width=image.naturalWidth||image.width;canvas.height=image.naturalHeight||image.height;
    canvas.getContext('2d').drawImage(image,0,0);
    canvas.toBlob(blob=>blob?resolve(blob):reject(Error('Não foi possível converter a imagem.')),'image/png');
   }catch(err){reject(err);}
  };
  image.onerror=()=>reject(Error('Não foi possível ler a imagem.'));
  image.src=src;
 });
}
async function copyImageElement(img){
 const src=img?.src||'';
 if(!src)throw Error('Imagem indisponível.');
 const png=src.startsWith('data:image/png')?Promise.resolve(dataUrlToBlob(src)):toPngBlob(src);
 await navigator.clipboard.write([new ClipboardItem({'image/png':png})]);
}
function wrapCopy(img){
 if(img.closest('.img-wrap'))return img;
 const wrap=document.createElement('span');wrap.className='img-wrap';
 img.replaceWith(wrap);wrap.append(img);
 const copy=document.createElement('button');copy.type='button';copy.className='img-copy';copy.textContent='Copiar';
 copy.addEventListener('click',async e=>{e.stopPropagation();try{await copyImageElement(img);toast('Imagem copiada.');}catch(err){toast(err.message);}});
 wrap.append(copy);
 return wrap;
}
function openImageDialog(file,source,alt){
 if(!source||$('#image-dialog').open)return;
 $('#image-preview').src=source;
 $('#image-preview').alt=alt||'Imagem';
 renderImageChrome({file:file||'',hasFile:!!file},imageDialogHandlers);
 $('#image-dialog').showModal();
}
const imageDialogHandlers={
 ImageCopy:async()=>{try{await copyImageElement($('#image-preview'));toast('Imagem copiada.');}catch(e){toast(e.message);}},
 ImageOpen:()=>{const file=$('#image-dialog').dataset.path;if(!file)return;window.desk.openImage(file).catch(e=>toast(e.message));},
};
$('#messages').addEventListener('click',async e=>{const button=e.target.closest?.('.code-copy');if(!button)return;e.stopPropagation();const pre=button.parentElement?.querySelector('pre');if(!pre)return;try{await navigator.clipboard.writeText(pre.textContent);button.classList.add('ok');button.textContent='copiado';setTimeout(()=>{button.classList.remove('ok');button.textContent='cópia';},1200);}catch(err){toast(err.message);}});
$('#messages').addEventListener('click',e=>{const img=e.target.closest?.('img.plot,img.shot');if(img)openImageDialog(img.dataset.path||'',img.src,img.alt);});
$('#image-dialog').addEventListener('close',()=>{$('#image-preview').removeAttribute('src');});
