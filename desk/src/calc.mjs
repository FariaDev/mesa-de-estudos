import calcCore from './generated/calcview.core.js';
import {calculate} from '../calculator.mjs';
import {icon} from '../icons.mjs';
import {$,S,toast} from './state.mjs';
import {preserveFocus,renderChildren} from './view-host.mjs';

/* Calculadora da Mesa: a árvore vem do `core/calcview.bend` e este adaptador
   guarda os fatos que a view precisa — colapso, ângulo, expressão, resultado,
   histórico (8 itens, mais novo primeiro) e guia aberta — re-aplicando no
   casco fixo `<section id="calculator">` do `index.html`.

   A avaliação continua no host (`desk/calculator.mjs`, precisão dupla, sem
   `eval`): o feedback de erro é o mesmo toast de sempre. O `#expression` e o
   `<details>` são controles vivos: antes de renderizar de novo o adaptador lê
   o valor digitado e o `open` (como o `atBottom` lê a rolagem antes de mutar).
   O ícone do título é asset do host (`icons.mjs`), re-injetado a cada render,
   como o `iconize` faz nas abas.

   Eval troca só `#result` e `#calc-history` (defs da própria view): o
   formulário/botão continuam os mesmos nós — quem clica "=" de novo não
   precisa de um botão novo. Colapso/ângulo re-aplicam a seção inteira.

   Medição/arrasto do divisor (`#calc-divider`, `--calc`, `calcHeightPx`)
   continua no `main.mjs`: é fato de host. */

const MAX_HISTORY=8;
const state={collapsed:false,angle:'rad',expression:'',result:'0',history:[],guideOpen:false};
let section=null;

/* Fatos que o DOM vivo carrega (tecla a tecla) e a view não controla. */
function syncFromDom(){
 const input=$('#expression');
 if(input)state.expression=input.value;
 const guide=$('#calc-guide');
 if(guide)state.guideOpen=guide.open;
}

/* `history` é uma lista Bend Con/Nil na ordem do DOM (mais novo primeiro). */
function historyList(){
 let out={$:'Nil'};
 for(let i=state.history.length-1;i>=0;i--){
  const {expr,result}=state.history[i];
  out={$:'Con',head:{$:'CalcEntry',expr,result},tail:out};
 }
 return out;
}

/* A seção é do HTML: a view decide `hidden`/`class` e o adaptador aplica no
   nó vivo (o resto — filhos — vem da árvore, trocado de uma vez). */
function applySection(node){
 const attrs=new Map();
 for(let a=node.attrs;a&&a.$==='Con';a=a.tail)attrs.set(String(a.head.name),String(a.head.value));
 const cls=attrs.get('class')||'';
 if(cls)section.setAttribute('class',cls);
 else section.removeAttribute('class');
 if(attrs.has('hidden'))section.setAttribute('hidden','');
 else section.removeAttribute('hidden');
}

/* O SVG do título sai do host; o texto continua sendo o da view. */
function injectIcon(){
 const label=section.querySelector('#calc-toggle > span');
 if(label)label.innerHTML=`${icon('calculator')} ${label.textContent}`;
}

function renderResult(){
 const el=$('#result');
 if(el)renderChildren(el,calcCore.calcResult(state.result).kids);
}

function renderHistory(){
 const box=$('#calc-history');
 if(box)renderChildren(box,calcCore.calcHistory(historyList()).kids,handlers);
}

/* Render inteiro: colapso, ângulo, visibilidade e o estado todo. */
function render(){
 if(!section)return;
 syncFromDom();
 const visible=S.appConfig.desk?.calculator!==false;
 const node=calcCore.calculator(
   visible,
   state.collapsed,
   state.angle,
   state.expression,
   state.result,
   historyList(),
   state.guideOpen
 );
 applySection(node);
 preserveFocus(section,()=>renderChildren(section,node.kids,handlers));
 injectIcon();
}

/* Chamado pelo `main.mjs` quando o DOM já está montado. */
export function initCalculator(){
 section=$('#calculator');
 if(!section)return false;
 render();
 return true;
}

/* O arrasto do divisor força a calculadora aberta (como o antigo pixel-poke). */
export function expandCalculator(){
 if(!section||!state.collapsed)return;
 state.collapsed=false;
 render();
}

function pushHistory(expr,result){
 state.history.unshift({expr,result});
 if(state.history.length>MAX_HISTORY)state.history.length=MAX_HISTORY;
}

const handlers={
 ToggleCalc(event){
  /* O select do ângulo mora dentro do botão: clique nele não colapsa. */
  if(event.target.closest('select'))return;
  state.collapsed=!state.collapsed;
  render();
 },
 SetAngle(event){
  state.angle=event.currentTarget.value==='deg'?'deg':'rad';
  render();
 },
 Eval(event){
  event.preventDefault();
  const input=$('#expression');
  const expr=input?input.value:state.expression;
  state.expression=expr;
  try{
   const result=calculate(expr,state.angle==='deg');
   state.result=result;
   pushHistory(expr,result);
  }catch(e){
   state.result='—';
   toast(e.message);
  }
  renderResult();
  renderHistory();
 },
 Reuse(event){
  const expr=event.currentTarget?.dataset?.expr||'';
  const input=$('#expression');
  if(input)input.value=expr;
  state.expression=expr;
  input?.focus();
 },
};
