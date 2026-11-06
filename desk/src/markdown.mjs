import {marked} from '../node_modules/marked/lib/marked.esm.js';
import katex from '../node_modules/katex/dist/katex.mjs';
import DOMPurify from '../node_modules/dompurify/dist/purify.es.mjs';
import {highlightCode} from '../highlight.mjs';
import {icon} from '../icons.mjs';
import {t} from './ui-text.mjs';
import {build,htmlNode} from './view-host.mjs';
import talkCore from './generated/talkview.core.js';
import {plotFigure} from './figures/plot-figure.mjs';
import {svgSafeConfig} from './figures/svg-guard.mjs';
import {svgFence} from './figures/svg-fence.mjs';
import {createMathCache} from './math-cache.mjs';
import {mathPattern,openMathRange,codeRanges} from './stream-blocks.mjs';
import {modelAttrsPresent,stripModelAttrs} from './model-attrs.mjs';
export {modelAttrsPresent,stripModelAttrs} from './model-attrs.mjs';

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
/* Uma repintura do stream reencontra todas as fórmulas já fechadas: o cache
   guarda o HTML por TeX+modo e evita renderizar de novo o que não mudou. */
const mathCache=createMathCache((tex,display)=>{
 const source=display?`$$${tex}$$`:`$${tex}$`;
 try{return katex.renderToString(tex,{displayMode:display,throwOnError:false,trust:false}).replace('<span',()=>`<span data-tex="${attrValue(source)}"`);}catch{return null;}
});
/* Faixa do modelo antes dos nossos (#seg-markup): o `marked.parse` entrega o
   HTML do modelo cru (fórmula, figura, asset e código ainda são texto
   `PLACEHOLDER` nessa hora) e os nossos entram depois — então o que tem
   atributo aqui é do modelo, sem isenção por marca que ele também sabe
   escrever (`<span class="katex">` não vale). A passagem Allowlist
   (`model-attrs.mjs`) só roda quando a checagem barata acha atributo fora de
   código; SVG/MathML do modelo fora de cerca passam pela mesma regra. */
/* Contador de `marked.parse` para a sonda de desempenho: cada `markup` faz
   exatamente uma chamada. A repintura incremental só conta o trecho novo. */
let markupCalls=0;
let markupStrips=0;
export function markupStats(){return {calls:markupCalls,math:mathCache.stats(),strips:markupStrips};}
export function resetMarkupStats(){markupCalls=0;markupStrips=0;mathCache.reset();}
export function markup(text,allowAssets=true){
 markupCalls++;
 const math=[],assets=[];
 const value=String(text??'');
 const codeSpans=value?codeRanges(value):[];
 const inCode=(index,length)=>codeSpans.some(range=>index<range.end&&index+(length||0)>range.start);
 const withMath=value.replace(mathPattern(),(match,a,b,c,d,offset)=>{if(inCode(offset,match.length))return match;const n=math.length,tex=a??b??c??d,display=a!==undefined||b!==undefined;math.push(mathCache.render(tex,display)??match);return `MATHPLACEHOLDER${n}END`;});
 const protectedText=withMath.replace(ASSET_MARKDOWN,(match,alt,bracketed,plain)=>{const source=(bracketed??plain??'').trim();if(!assetSource(source))return match;if(!allowAssets)return `\`${source}\``;assets.push({source,alt:(alt||'').trim()});return `ASSETPLACEHOLDER${assets.length-1}END`;});
 let html=marked.parse(protectedText,{breaks:true});
 if(modelAttrsPresent(html)){html=stripModelAttrs(html);markupStrips++;}
 // realce dos blocos de código: fora do DOMPurify via placeholder (os spans não são tags seguras lá)
 const codes=[];
 html=html.replace(/<pre><code(?: class="language-([\w-]+)")?>([\s\S]*?)<\/code><\/pre>/g,(all,lang,code)=>{
  /* Cerca `plot` (#60): vira a figura (ou o aviso) e segue pelo DOMPurify junto com o resto. */
  if(lang==='plot')return plotFigure(unescHtml(code)).html;
  const svg=svgFence(unescHtml(code),lang);
  if(svg)return svg.html;
  codes.push(`<pre class="hl"><code data-lang="${attrValue(lang||'')}">${highlightCode(unescHtml(code),lang)}</code></pre>`);
  return `CODEPLACEHOLDER${codes.length-1}END`;
 });
 html=html.replace(/MATHPLACEHOLDER(\d+)END/g,(_,n)=>math[n]);
 const figure=n=>{const asset=assets[Number(n)];return `<figure class="asset" data-asset="${attrValue(asset.source)}"${asset.alt?` data-caption="${attrValue(asset.alt)}"`:''}></figure>`;};
 html=html.replace(/<p>\s*ASSETPLACEHOLDER(\d+)END\s*<\/p>/g,(_,n)=>figure(n)).replace(/ASSETPLACEHOLDER(\d+)END/g,(_,n)=>figure(n));
 return DOMPurify.sanitize(html,svgSafeConfig(DOMPurify,{FORBID_TAGS:['style','iframe','form','input','button'],FORBID_ATTR:['srcset']}))
  .replace(/CODEPLACEHOLDER(\d+)END/g,(_,n)=>codes[Number(n)]||'');
}
/* Markdown+LaTeX de um trecho curto (opção de quiz, observação): sem o <p>
   externo quando é um parágrafo só. Sem assets — é rótulo, não figura. */
export function markupInline(text){const html=markup(text,false);const single=/^<p>([\s\S]*?)<\/p>\s*$/.exec(html);return single?single[1]:html;}
/* O stream vivo com fórmula sem fechamento (auditoria rodada 5, D3): o
   delimitador aberto (`$$`, `\[`, `\(` ou `$` com cara de fórmula) não aparece
   como fonte crua — vira uma linha quieta até fechar, e fechou renderiza. O
   desenho final (`markup`) mostra o texto como está, sem perder nada; preço
   ("custa $5 e $6") nunca é fórmula. Uma chamada só, como o `markup`. */
const MATH_PENDING_SENTINEL='MATHPENDING0END';
function escapePending(value){return String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
/**
 * @param {string} text Markdown já passado pelo `displayUserText`
 * @param {boolean} [allowAssets]
 * @returns {string} HTML sanitizado, com a fórmula aberta como linha quieta
 * @example markupLive('veja $$\int_0^1') // HTML com .math-pending, sem '$$'
 */
export function markupLive(text,allowAssets=true){
 const value=String(text??'');
 const range=openMathRange(value);
 if(!range)return markup(value,allowAssets);
 /* Só o trecho aberto vira linha quieta (auditoria rodada 5, D3): o que vem
    depois de `range.end` continua aparecendo no vivo. Uma chamada só. */
 const html=markup(value.slice(0,range.start)+MATH_PENDING_SENTINEL+value.slice(range.end),allowAssets);
 return html.replace(MATH_PENDING_SENTINEL,()=>`<span class="math-pending">${escapePending(t('talk.mathPending'))}</span>`);
}
/* A moldura `.codeblock` (etiqueta da linguagem + botão cópia) é árvore do
   `core/talkview.bend`; o `<pre>` realçado já veio do `markup`. */
export function decorateCode(body){
 for(const pre of body.querySelectorAll('pre')){
  if(pre.parentElement?.classList.contains('codeblock'))continue;
  const lang=(pre.querySelector('code')?.dataset.lang||'').trim();
  const block=build(talkCore.codeBlock(htmlNode(pre.outerHTML),lang.toUpperCase()));
  /* O botão de copiar é ícone (o mesmo da mensagem), com o nome acessível do núcleo. */
  const copy=block.querySelector('.code-copy');
  if(copy){copy.innerHTML=icon('copy');copy.title=t('talk.copy');}
  pre.replaceWith(block);
 }
}
