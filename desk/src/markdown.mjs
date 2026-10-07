import {marked} from '../node_modules/marked/lib/marked.esm.js';
import katex from '../node_modules/katex/dist/katex.mjs';
import DOMPurify from '../node_modules/dompurify/dist/purify.es.mjs';
import {highlightCode} from '../highlight.mjs';
import {build,htmlNode} from './view-host.mjs';
import talkCore from './generated/talkview.core.js';

/* Renderer Markdown+LaTeX compartilhado (chat principal e chat lateral). Mesmo
   pipeline do chat.mjs de sempre: o host reescreve fórmulas/figuras como
   placeholders, o marked gera o HTML, o realce de código sai fora do DOMPurify
   (spans não são tags seguras lá) e a figura/`codeblock` viram árvore do
   `core/talkview.bend` (`decorateCode`). Nada aqui conhece o DOM da conversa —
   recebe um elemento e mexe dentro dele. */

const ASSET_EXT=/\.(?:png|jpe?g|gif|webp|svg)$/i;
const ASSET_LOCAL=/^(?:file:\/\/|\.{0,2}[\\/]|[\\/]|desk[\\/]|[a-zA-Z]:[\\/])/i;
const ASSET_MARKDOWN=/!\[([^\]]*)\]\(\s*(?:<([^<>]+)>|((?:file:\/\/|\.{0,2}[\\/]|[\\/]|desk[\\/]|[a-zA-Z]:[\\/])[^)]*?\.(?:png|jpe?g|gif|webp|svg))(?:\s+"[^"]*")?)\s*\)/gi;
export function assetSource(value){const text=String(value||'').trim();return ASSET_LOCAL.test(text)&&ASSET_EXT.test(text.split(/[?#]/)[0]);}
export function assetLocalPath(value){const text=String(value||'').trim();if(!text||text.length>4096||/[\n\r]/.test(text)||!assetSource(text))return '';return text;}
export function attrValue(value){return String(value).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');}
/* O marked entrega o código já escapado (&gt;, &amp;) e o realce escapa de novo — sem isso
   o bloco mostra "=&gt;" e "&amp;&amp;" na tela. Desescape único (o inverso exato do marked). */
function unescHtml(value){return String(value).replace(/&(amp|lt|gt|quot|apos|#39|#x27);/g,(_,e)=>({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",'#39':"'",'#x27':"'"}[e]));}
export function markup(text,allowAssets=true){
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
/* Markdown+LaTeX de um trecho curto (opção de quiz, observação): sem o <p>
   externo quando é um parágrafo só. Sem assets — é rótulo, não figura. */
export function markupInline(text){const html=markup(text,false);const single=/^<p>([\s\S]*?)<\/p>\s*$/.exec(html);return single?single[1]:html;}
/* A moldura `.codeblock` (etiqueta da linguagem + botão cópia) é árvore do
   `core/talkview.bend`; o `<pre>` realçado já veio do `markup`. */
export function decorateCode(body){
 for(const pre of body.querySelectorAll('pre')){
  if(pre.parentElement?.classList.contains('codeblock'))continue;
  const lang=(pre.querySelector('code')?.dataset.lang||'').trim();
  pre.replaceWith(build(talkCore.codeBlock(htmlNode(pre.outerHTML),lang.toUpperCase())));
 }
}
