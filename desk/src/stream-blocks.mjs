/* Divisão pura do texto do stream em prefixo estável + último trecho.
 *
 * O tutor repinta a resposta a cada ~80 ms (`chat-message-view.mjs`). Repintar
 * o Markdown inteiro custa caro porque o `marked`, o DOMPurify e o DOM refazem
 * todos os blocos já fechados. Aqui só se decide, sem DOM, onde termina o
 * último bloco que pode ser reaproveitado. O aplicador (`chat-stream-view.mjs`)
 * guarda o HTML dos blocos estáveis e redesenha apenas o resto.
 *
 * A regra é conservadora: um corte só vale entre blocos de topo, depois de
 * linha em branco, sem cerca/fórmula/HTML/referência atravessando. Na dúvida,
 * o chamador cai no desenho completo (é melhor gastar CPU do que mostrar
 * errado). */

/* Mesmo par de fórmulas que o `markdown.mjs` substitui antes do `marked`:
 * `$$…$$`, `\[…\]` e `\(…\)` atravessam parágrafos; um `$…$` solto não passa
 * de uma linha. O `markdown.mjs` importa esta fonte para não haver duas regex.
 * O `$` solto segue a regra usual: abertura não é seguida de espaço, o
 * fechamento não é precedido de espaço nem seguido de dígito — preço
 * ("custa $5 e $6") continua texto (o `$5 e $` fecharia com espaço antes). */
const MATH_SPAN=/\$\$([\s\S]*?)\$\$|\\\[([\s\S]*?)\\\]|\\\(([\s\S]*?)\\\)|(?<!\$)\$(?!\s|\$)([^\n$]*?[^\s$])\$(?!\$|\d)/g;
const MATH_SOURCE=MATH_SPAN.source;
const MATH_OPENER=/\$\$|\\\[|\\\(/;

/* Código nunca é lido como fórmula, no vivo nem no final (auditoria rodada
 * 5, D3): cerca (fechada ou ainda aberta no stream) e crase inline fechada.
 * Uma única noção de "fora de código" compartilhada por `mathSpans`,
 * `openMathRange` e o que mais detectar matemática. */
const INLINE_CODE=/(`+)(.+?)\1(?!`)/gs;

function fenceRangesOf(value){
  const ranges=[];
  let fence=null,openStart=0;
  for(const line of linesOf(value)){
    const body=bodyOf(line.text);
    if(fence){
      if(closesFence(body,fence)){ranges.push({start:openStart,end:line.start+line.text.length});fence=null;}
      else if(line.start+line.text.length>=value.length){ranges.push({start:openStart,end:value.length});}
    }else{
      const opened=opensFence(body);
      if(opened){
        fence=opened;openStart=line.start;
        if(line.start+line.text.length>=value.length){ranges.push({start:openStart,end:value.length});}
      }
    }
  }
  return ranges;
}

function inRanges(ranges,index,length){
  const end=index+(length||1);
  for(const range of ranges){
    if(index<range.end&&end>range.start)return true;
    if(range.start>=end)break;
  }
  return false;
}

/**
 * Trechos de código (cercas e crases) onde `$`, `$$`, `\[` e `\(` são texto.
 * @param {string} text
 * @returns {Array<{start:number,end:number}>} faixas ordenadas, sem sobrepor
 * @example codeRanges('use `echo $HOME`') // [{start:4,end:16}]
 */
export function codeRanges(text){
  const value=String(text??'');
  if(!value)return [];
  const fences=fenceRangesOf(value);
  const ranges=[...fences];
  let cursor=0;
  const gaps=[];
  for(const fence of fences){if(cursor<fence.start)gaps.push({start:cursor,end:fence.start});cursor=Math.max(cursor,fence.end);}
  if(cursor<value.length)gaps.push({start:cursor,end:value.length});
  for(const gap of gaps){
    const slice=value.slice(gap.start,gap.end);
    INLINE_CODE.lastIndex=0;
    for(let match=INLINE_CODE.exec(slice);match;match=INLINE_CODE.exec(slice)){
      ranges.push({start:gap.start+match.index,end:gap.start+match.index+match[0].length});
      if(!match[0].length)INLINE_CODE.lastIndex+=1;
    }
  }
  ranges.sort((a,b)=>a.start-b.start);
  return ranges;
}

/** Uma regex nova do par de fórmulas (o `markdown.mjs` usa `replace`, que com
 * `g` reinicia o `lastIndex`, mas a fonte compartilhada evita divergência).
 * @returns {RegExp} */
export function mathPattern(){return new RegExp(MATH_SOURCE,'g');}

/**
 * Trechos que o `markdown.mjs` transforma em KaTeX, na ordem do texto.
 * @param {string} text
 * @returns {Array<{start:number,end:number}>}
 * @example mathSpans('a $$x$$ b') // [{start:2,end:7}]
 */
export function mathSpans(text){
 const value=String(text??'');
 const codes=value?codeRanges(value):[];
 const spans=[];
 const pattern=mathPattern();
 for(let match=pattern.exec(value);match;match=pattern.exec(value)){
  const start=match.index,end=start+match[0].length;
  if(!inRanges(codes,start,end-start))spans.push({start,end});
  if(!match[0].length)pattern.lastIndex+=1;
 }
 return spans;
}

/* HTML cru pode engolir parágrafos (um `<details>` aberto atravessa linha em
   branco) e o `marked`/DOMPurify não fecham o bloco no mesmo lugar quando o
   texto é cortado. Qualquer tag de bloco em início de linha desliga o corte. */
const RAW_HTML=/<(?:\/?[A-Za-z][\w:-]*(?:\s[^<>]*)?\/?>|!--|\?|![A-Za-z])/;
const RAW_HTML_LINE=/^[ \t]*<[A-Za-z!/?]/m;
/* Definição de link/imagem (ou nota) vale para o documento inteiro: um uso no
   trecho novo poderia resolver só porque a definição ficou no prefixo. */
const REFERENCE_DEFINITION=/^ {0,3}\[[^\]\n]+\]:[ \t]?/m;
const LIST_MARKER=/^ {0,3}(?:[-+*]|\d{1,9}[.)])(?:[ \t]+|$)/;
const FENCE_OPEN=/^ {0,3}(`{3,}|~{3,})(.*)$/;
const FENCE_ANY=/^(?:[ \t]*>[ \t]*)*[ \t]*(?:`{3,}|~{3,})/;

function no(reason){return {reusable:false,stableEnd:0,safeEnds:[],reason};}

function linesOf(text){
 const lines=[];
 let start=0;
 for(let index=0;index<text.length;index++){
  if(text[index]!=='\n')continue;
  lines.push({start,text:text.slice(start,index+1)});
  start=index+1;
 }
 if(start<text.length)lines.push({start,text:text.slice(start)});
 return lines;
}

function bodyOf(line){
 const withoutLf=line.endsWith('\n')?line.slice(0,-1):line;
 return withoutLf.endsWith('\r')?withoutLf.slice(0,-1):withoutLf;
}

function opensFence(body){
 const match=FENCE_OPEN.exec(body);
 if(!match)return null;
 /* Cerca de crase com crase na info string não é cerca (CommonMark). */
 if(match[1][0]==='`'&&match[2].includes('`'))return null;
 return {char:match[1][0],length:match[1].length};
}

function closesFence(body,fence){
 if(!fence)return false;
 const pattern=new RegExp(`^ {0,3}${fence.char==='`'?'`':'~'}{${fence.length},}[ \\t]*$`);
 return pattern.test(body);
}

function openMathOutside(text,spans){
 const codes=codeRanges(text);
 const opener=new RegExp(MATH_OPENER.source,'g');
 for(let match=opener.exec(text);match;match=opener.exec(text)){
  if(!spanAt(spans,match.index,match[0].length)&&!inRanges(codes,match.index,match[0].length))return true;
 }
 return false;
}

/* Fórmula aberta no fim do stream (auditoria rodada 5, D3): o índice onde
   começa o delimitador sem fechamento, ou -1. `$$`, `\[` e `\(` valem até o
   fim do texto (atravessam parágrafos, como o `markup`); o `$` solto só vale
   até a quebra de linha e só quando parece fórmula (letra, `{`, `(` ou `\`
   depois do `$`) — preço ("custa $5 e $6") continua texto. Só o que está fora
   das fórmulas já fechadas (`spans`) conta; o mais antigo vale, porque tudo
   dali até o fim é a fórmula em chegada. Sem DOM, puro como o resto. */
function spanAt(spans,index,length){
 for(const span of spans){
  if(index>=span.start&&index<span.end)return span;
  if(span.start>=index+length)break;
 }
 return null;
}

function firstDoubleOutside(text,spans,codes,token){
 let from=0;
 for(;;){
  const found=text.indexOf(token,from);
  if(found<0)return -1;
  if(!spanAt(spans,found,token.length)&&!inRanges(codes,found,token.length))return found;
  from=found+token.length;
 }
}

/* `$` solto que abre fórmula: fora de par fechado, de `$$` e de código, com
   cara de fórmula depois e sem outro `$` na mesma linha para fechar. */
function singleOpenStart(text,spans,codes){
 const formulaAfter=/[A-Za-z\\({]/;
 for(let i=0;i<text.length;i++){
  if(text[i]!=='$')continue;
  if(text[i+1]==='$'||text[i-1]==='$')continue;
  if(spanAt(spans,i,1))continue;
  if(inRanges(codes,i,1))continue;
  const next=text[i+1]||'';
  if(!formulaAfter.test(next))continue;
  const lineEnd=text.indexOf('\n',i+1);
  const line=text.slice(i+1,lineEnd<0?text.length:lineEnd);
  if(line.includes('$'))continue;
  return i;
 }
 return -1;
}

/**
 * O trecho aberto da fórmula no fim do texto, para o stream vivo esconder a
 * fonte crua até fechar. `null` sem delimitador aberto.
 * @param {string} text
 * @returns {{start:number,end:number}|null}
 * @example openMathRange('a $$\\int_0^1') // {start:2,end:11}
 * @example openMathRange('custa $5 e $6') // null
 */
export function openMathRange(text){
 const value=String(text??'');
 if(!value)return null;
 const spans=mathSpans(value);
 const codes=codeRanges(value);
 const display=firstDoubleOutside(value,spans,codes,'$$');
 const bracket=firstDoubleOutside(value,spans,codes,'\\[');
 const paren=firstDoubleOutside(value,spans,codes,'\\(');
 const starts=[display,bracket,paren].filter(at=>at>=0);
 if(starts.length){
  const start=Math.min(...starts);
  return {start,end:value.length};
 }
 const single=singleOpenStart(value,spans,codes);
 if(single>=0){
  const lineEnd=value.indexOf('\n',single+1);
  return {start:single,end:lineEnd<0?value.length:lineEnd};
 }
 return null;
}

function boundarySafe(offset,spans,body,previousWasList){
 if(spans.some(span=>span.start<offset&&offset<span.end))return false;
 /* Indentado depois de linha em branco pode ser continuação de item/código. */
 if(/^[ \t]/.test(body))return false;
 /* `- a` + linha em branco + `- b` ainda é a MESMA lista (frouxa): o corte
    antes do segundo item mudaria o HTML. Uma lista depois de parágrafo/título
    é bloco novo e pode ser o último trecho. */
 if(LIST_MARKER.test(body)&&previousWasList)return false;
 if(body.startsWith('<'))return false;
 return true;
}

/**
 * Divide o texto no último ponto em que os blocos já fechados podem ser
 * reaproveitados. `stableEnd` é o começo do último bloco (o prefixo inclui as
 * linhas em branco); `safeEnds` permite ao aplicador estender o prefixo sem
 * refazer os blocos anteriores.
 * @param {string} text
 * @returns {{reusable:boolean, stableEnd:number, safeEnds:number[], reason:string}}
 * @example splitStreamBlocks('a\n\nb\n') // {reusable:true, stableEnd:3, safeEnds:[3], reason:''}
 */
export function splitStreamBlocks(text){
 const value=String(text??'');
 if(!value)return no('empty');
 if(REFERENCE_DEFINITION.test(value))return no('reference-definition');
 if(RAW_HTML.test(value)||RAW_HTML_LINE.test(value))return no('raw-html');
 const spans=mathSpans(value);
 if(openMathOutside(value,spans))return no('open-math');
 const safeEnds=[];
 let fence=null,suspicious=false,blankRun=false,previousWasList=false;
 for(const line of linesOf(value)){
  const body=bodyOf(line.text);
  const start=line.start;
  /* Linha que começa dentro de fórmula: o `markup` já a substituiu inteira;
     não conta cerca nem oferece corte. */
  if(spans.some(span=>span.start<start&&start<span.end)){blankRun=false;continue;}
  if(fence){
   if(closesFence(body,fence))fence=null;
   blankRun=false;
   continue;
  }
  if(/^[ \t]*$/.test(body)){blankRun=true;continue;}
  /* O corte é decidido ANTES de abrir a cerca: o bloco novo pode ser uma
     cerca (fechada ou ainda aberta), e ela inteira fica no último trecho. */
  if(blankRun&&boundarySafe(start,spans,body,previousWasList))safeEnds.push(start);
  const opened=opensFence(body);
  if(opened){fence=opened;blankRun=false;previousWasList=false;continue;}
  if(FENCE_ANY.test(body))suspicious=true;
  /* Continuação indentada de item também é lista; linha de topo que não é
     marcador abre outro bloco. */
  if(LIST_MARKER.test(body)||/^[ \t]/.test(body))previousWasList=true;
  else if(blankRun)previousWasList=false;
  blankRun=false;
 }
 /* Cerca ainda aberta não impede usar um corte ANTERIOR a ela: o último
    trecho (a cerca aberta) é redesenhado inteiro a cada repintura. */
 if(suspicious)return no('fence-in-container');
 if(!safeEnds.length)return no('no-boundary');
 return {reusable:true,stableEnd:safeEnds[safeEnds.length-1],safeEnds,reason:''};
}
