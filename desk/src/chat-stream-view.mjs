/* Aplicador do stream incremental no DOM da conversa.
 *
 * O `paintMessage` de sempre refazia `markup(texto inteiro)` e trocava o corpo
 * da mensagem a cada ~80 ms. Aqui o prefixo estável (blocos já fechados) vira
 * nós uma vez e fica no lugar; só o último trecho é redesenhado. A decisão de
 * onde cortar é pura e mora em `stream-blocks.mjs`; este módulo só monta e
 * troca os nós. Na dúvida (corte inseguro), faz o desenho completo de sempre.
 *
 * Todo HTML continua passando pelo `markup`, que sanitiza com o DOMPurify —
 * não existe atalho de `innerHTML` para o texto do tutor. */
import {markup,markupLive,decorateCode} from './markdown.mjs';
import {build,htmlNode,renderChildren} from './view-host.mjs';
import {splitStreamBlocks} from './stream-blocks.mjs';
import talkCore from './generated/talkview.core.js';

/* Lista do núcleo para as imagens do desenho completo; local para o módulo
   não depender de `chat-assets` (que puxa o chat inteiro). */
const bendList=items=>{let out={$:'Nil'};for(let i=items.length-1;i>=0;i--)out={$:'Con',head:items[i],tail:out};return out;};

const stats={paints:0,fullPaints:0,stableRenders:0,stableExtensions:0,stableRebuilds:0,tailRenders:0,blocksReparsed:0,maxBlocksPerPaint:0,maxBlocksPerIncrementalPaint:0,fallbacks:{},reusableFallbacks:0,markupMs:0,domMs:0};

/** Zera os contadores de trabalho do stream (sonda e teste de regressão). */
export function resetStreamPaintStats(){
 stats.paints=0;stats.fullPaints=0;stats.stableRenders=0;stats.stableExtensions=0;stats.stableRebuilds=0;stats.tailRenders=0;stats.blocksReparsed=0;stats.maxBlocksPerPaint=0;stats.maxBlocksPerIncrementalPaint=0;stats.fallbacks={};stats.reusableFallbacks=0;stats.markupMs=0;stats.domMs=0;
}

/** Contadores desde o último `resetStreamPaintStats`.
 * `blocksReparsed` conta os blocos de topo que passaram pelo `markup` em cada
 * repintura; `maxBlocksPerPaint` é o pior caso de uma repintura.
 * @returns {{paints:number, fullPaints:number, stableRenders:number, stableExtensions:number, stableRebuilds:number, tailRenders:number, blocksReparsed:number, maxBlocksPerPaint:number, maxBlocksPerIncrementalPaint:number, fallbacks:Record<string,number>, reusableFallbacks:number, markupMs:number, domMs:number}} */
export function streamPaintStats(){return {...stats};}

function topBlocks(nodes){return nodes.reduce((count,node)=>count+(node.nodeType===1?1:0),0);}

/* Monta o HTML já sanitizado em nós de topo. O `decorateCode` roda com o pai
   temporário para o `<pre>` virar `.codeblock` uma vez só; o nó guardado já
   sai pronto para ser reaproveitado nas repinturas seguintes. */
function nodesOf(html){
 const started=performance.now();
 const holder=document.createElement('div');
 holder.append(build(htmlNode(html)));
 decorateCode(holder);
 const nodes=[...holder.childNodes];
 stats.domMs+=performance.now()-started;
 return nodes;
}

function fullPaint(body,text,images,live=false){
 body._streamPaint=null;
 const markupStarted=performance.now();
 /* No stream vivo a fórmula aberta vira linha quieta (D3); no desenho final
    o texto aparece como está, sem perder nada. */
 const html=live?markupLive(text,true):markup(text,true);
 stats.markupMs+=performance.now()-markupStarted;
 const tree=talkCore.messageBody(htmlNode(html),bendList(images||[]));
 renderChildren(body,tree.kids);
 decorateCode(body);
 const blocks=topBlocks([...body.childNodes]);
 stats.fullPaints+=1;
 stats.blocksReparsed+=blocks;
 stats.maxBlocksPerPaint=Math.max(stats.maxBlocksPerPaint,blocks);
}

/**
 * Pinta o corpo de uma mensagem. `live` usa o caminho incremental; o desenho
 * final (`live=false`) refaz tudo uma vez, como o `message_end` pede.
 * @param {HTMLElement} body o `.body` da mensagem
 * @param {string} text Markdown já passado pelo `displayUserText`
 * @param {string[]} [images] imagens da mensagem (só no desenho completo)
 * @param {boolean} [live]
 * @returns {void}
 * @example paintMessageBody(body, 'texto **novo**', [], true)
 */
export function paintMessageBody(body,text,images=[],live=false){
 stats.paints+=1;
 const value=String(text??'');
 /* `__mesaStreamFull` é o freio da sonda de desempenho: mede o caminho antigo
    com o mesmo app, para o antes/depois não depender da carga da máquina. */
 if(!live){fullPaint(body,value,images,false);return;}
 if(globalThis.__mesaStreamFull===true){fullPaint(body,value,images,false);return;}
 const split=splitStreamBlocks(value);
 /* O texto vivo pode mudar no começo: só vale o prefixo que continua igual. */
 const state=body._streamPaint&&value.startsWith(body._streamPaint.stableText)?body._streamPaint:null;
 /* O prefixo estável anterior continua seguro quando o texto só cresce — a
    exceção é uma definição de referência nova, que muda links do prefixo.
    Assim o meio de uma fórmula aberta reaproveita os blocos de antes dela em
    vez de redesenhar a resposta inteira a cada repintura. */
 const reuseFallback=!split.reusable&&!!state&&split.reason!=='reference-definition'&&state.stableEnd>0&&state.stableEnd<=value.length&&state.stableNodes.every(node=>node.parentNode===body);
 if(!split.reusable&&!reuseFallback){stats.fallbacks[split.reason]=(stats.fallbacks[split.reason]||0)+1;fullPaint(body,value,images,true);return;}
 if(reuseFallback){stats.fallbacks[split.reason]=(stats.fallbacks[split.reason]||0)+1;stats.reusableFallbacks+=1;}
 const stableEnd=reuseFallback?state.stableEnd:split.stableEnd;
 const canExtend=!reuseFallback&&!!state&&state.stableEnd>0&&stableEnd>=state.stableEnd&&split.safeEnds.includes(state.stableEnd)&&state.stableNodes.every(node=>node.parentNode===body);
 let stableNodes,stableText,stableBlocks=0,chunkNodes=[];
 if(reuseFallback||(canExtend&&stableEnd===state.stableEnd)){
  stableNodes=state.stableNodes;stableText=state.stableText;
 }else if(canExtend){
  const chunkStarted=performance.now();
  const chunkHtml=markupLive(value.slice(state.stableEnd,stableEnd),true);
  stats.markupMs+=performance.now()-chunkStarted;
  chunkNodes=nodesOf(chunkHtml);
  stableNodes=state.stableNodes.concat(chunkNodes);
  stableText=value.slice(0,stableEnd);
  stableBlocks=topBlocks(chunkNodes);
  stats.stableRenders+=1;stats.stableExtensions+=1;
 }else{
  const stableStarted=performance.now();
  const stableHtml=markupLive(value.slice(0,stableEnd),true);
  stats.markupMs+=performance.now()-stableStarted;
  stableNodes=nodesOf(stableHtml);
  stableText=value.slice(0,stableEnd);
  stableBlocks=topBlocks(stableNodes);
  stats.stableRenders+=1;stats.stableRebuilds+=1;
 }
 const tailStarted=performance.now();
 const tailHtml=markupLive(value.slice(stableEnd),true);
 stats.markupMs+=performance.now()-tailStarted;
 const tailNodes=nodesOf(tailHtml);
 const tailBlocks=topBlocks(tailNodes);
 stats.tailRenders+=1;
 const blocks=stableBlocks+tailBlocks;
 stats.blocksReparsed+=blocks;
 stats.maxBlocksPerPaint=Math.max(stats.maxBlocksPerPaint,blocks);
 stats.maxBlocksPerIncrementalPaint=Math.max(stats.maxBlocksPerIncrementalPaint,blocks);
 if(reuseFallback||canExtend){
  /* Só o fim muda: os nós estáveis ficam onde estão (o navegador não refaz o
     layout deles) e o trecho novo entra depois. */
  for(const node of state.tailNodes)node.remove();
  body.append(...chunkNodes,...tailNodes);
 }else{
  body.replaceChildren(...stableNodes,...tailNodes);
 }
 body._streamPaint={stableEnd,stableText,stableNodes,tailNodes};
}
