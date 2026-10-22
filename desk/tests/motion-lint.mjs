// @ts-check
/* Portão da linguagem de movimento (#63, docs/design/movimento.md): duração e
   curva só pelos tokens do style.css, e nada de transição de propriedade de
   layout. Lê CSS como texto, sem parser: as folhas da Mesa são planas o
   bastante, e o que importa é achar o valor escrito na mão. */

/** @typedef {{file:string,line:number,property:string,found:string,expected:string}} MotionViolation */

const MOTION_DECLARATION=/(?<![\w-])((?:transition|animation)(?:-[a-z]+)?)\s*:\s*([^;}]*)/g;
const LITERAL_TIME=/(?<![\w.-])(\d*\.?\d+)(ms|s)(?![\w-])/g;
const NAMED_CURVE=/(?<![\w-])(ease(?:-in-out|-in|-out)?)(?![\w-])/g;
const CURVE_FUNCTION=/(?<![\w-])(cubic-bezier|steps|linear)\(/g;
const LINEAR_KEYWORD=/(?<![\w-])linear(?![\w(-])/;
const LAYOUT_PROPERTY=/(?<![\w-])(all|width|height|top|left|right|bottom|inset|(?:min|max)-(?:width|height)|margin(?:-[a-z]+)*|padding(?:-[a-z]+)*)(?![\w-])/g;

/** O token de duração mais perto do valor escrito, para a mensagem do erro.
 * @param {number} ms
 * @returns {string}
 * @example nearestDurationToken(150) // 'var(--t-base)' */
export function nearestDurationToken(ms){
 if(ms>=800)return 'var(--t-loop)';
 const tokens=[['var(--t-fast)',120],['var(--t-base)',180],['var(--t-slow)',320]];
 const [name]=tokens.reduce((best,next)=>Math.abs(next[1]-ms)<Math.abs(best[1]-ms)?next:best);
 return String(name);
}

/** Acha duração, curva ou transição de layout escrita fora dos tokens.
 * @param {string} css texto da folha
 * @param {string} file nome para a mensagem
 * @returns {MotionViolation[]}
 * @example findMotionViolations('a{transition:opacity .2s ease}','x.css').length // 2 */
export function findMotionViolations(css,file){
 const source=css.replace(/\/\*[\s\S]*?\*\//g,match=>match.replace(/[^\n]/g,' '));
 /** @type {MotionViolation[]} */
 const found=[];
 for(const match of source.matchAll(MOTION_DECLARATION)){
  const [,property,value]=match;
  const line=source.slice(0,match.index).split('\n').length;
  for(const problem of declarationProblems(property,value))found.push({file,line,property,...problem});
 }
 return found;
}

/** @param {string} property @param {string} value @returns {{found:string,expected:string}[]} */
function declarationProblems(property,value){
 const problems=[];
 for(const [,amount,unit] of value.matchAll(LITERAL_TIME)){
  const ms=unit==='s'?Number(amount)*1000:Number(amount);
  problems.push({found:`${amount}${unit}`,expected:`use ${nearestDurationToken(ms)}`});
 }
 for(const [,curve] of value.matchAll(NAMED_CURVE))problems.push({found:curve,expected:curveAdvice()});
 for(const [,curve] of value.matchAll(CURVE_FUNCTION))problems.push({found:`${curve}(…)`,expected:curveAdvice()});
 const loop=property.startsWith('animation')&&/\binfinite\b/.test(value);
 if(LINEAR_KEYWORD.test(value)&&!loop)problems.push({found:'linear',expected:`${curveAdvice()} (linear só em giro infinito)`});
 if(property==='transition'||property==='animation'){
  for(const item of splitTopLevel(value))if(implicitCurve(item))problems.push({found:`${item.trim()} (sem curva: o navegador usa ease)`,expected:curveAdvice()});
 }
 if(property==='transition'||property==='transition-property'){
  for(const [,layout] of value.matchAll(LAYOUT_PROPERTY))problems.push({found:`transition de ${layout}`,expected:'anime só opacity e transform (layout a cada quadro engasga com PDF aberto)'});
 }
 return problems;
}

/* Item com duração e sem curva cai no `ease` padrão. Discreto
   (allow-discrete) não tem curva que se veja. */
/** @param {string} item @returns {boolean} */
function implicitCurve(item){
 const timed=/var\(--t-|calc\(|\d(?:ms|s)\b/.test(item);
 const curved=/var\(--ease-|(?<![\w-])(?:linear|ease(?:-in-out|-in|-out)?|cubic-bezier|steps)(?![\w-])/.test(item);
 return timed&&!curved&&!/allow-discrete/.test(item);
}

/** Separa por vírgula fora de parênteses. @param {string} value @returns {string[]} */
function splitTopLevel(value){
 const items=[''];let depth=0;
 for(const char of value){
  if(char==='(')depth++;
  if(char===')')depth--;
  if(char===','&&depth===0){items.push('');continue;}
  items[items.length-1]+=char;
 }
 return items;
}

function curveAdvice(){
 return 'use var(--ease-out) para entrar/sair ou var(--ease-move) para mudança de lugar';
}

/** Uma linha por violação, no formato `arquivo:linha propriedade: achado → esperado`.
 * @param {MotionViolation[]} violations
 * @returns {string} */
export function formatMotionViolations(violations){
 return violations.map(v=>`${v.file}:${v.line} ${v.property}: ${v.found} → ${v.expected}`).join('\n');
}
