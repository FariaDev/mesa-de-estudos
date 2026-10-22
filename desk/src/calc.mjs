import calcCore from './generated/calcview.core.js';
import {calculate} from '../calculator.mjs';
import {icon} from '../icons.mjs';
import {$,S,toast,save,calcHeightPx} from './state.mjs';
import {preserveFocus,renderChildren} from './view-host.mjs';
import {text,currentLanguage} from './ui-text.mjs';
import {localizeDecimal} from './i18n.mjs';

/* Calculadora da Mesa (ticket #16): recolhida é UMA linha de `--bar` no pé da
   coluna do tutor (campo, resultado e unidade) e calcula ali mesmo; o controle
   `#calc-toggle` expande para o painel com ângulo, histórico e guia. A árvore
   vem do `core/calcview.bend` e este adaptador guarda os fatos que a view
   precisa — colapso, ângulo, expressão, resultado, histórico (8 itens, mais
   novo primeiro) e guia aberta — re-aplicando no casco fixo
   `<section id="calculator">` do `index.html`.

   O colapso é estado de INTERFACE: nasce recolhido, o clique no controle o
   inverte e grava na hora (`save(true)` → `viewLayout.calculatorCollapsed` do
   desk.json, o mesmo caminho dos presets de layout), e `desk-layout-ready`
   o restaura na abertura. Nada disso passa pelo `config.json`.

   A avaliação continua no host (`desk/calculator.mjs`, precisão dupla, sem
   `eval`): o feedback de erro é o mesmo toast de sempre. O `#expression` e o
   `<details>` são controles vivos: antes de renderizar de novo o adaptador lê
   o valor digitado e o `open` (como o `atBottom` lê a rolagem antes de mutar).
   O ícone do título é asset do host (`icons.mjs`), re-injetado a cada render,
   como o `iconize` faz nas abas.

   Eval troca só `#result` e `#calc-history` (defs da própria view): o
   formulário/botão continuam os mesmos nós — quem clica "=" de novo não
   precisa de um botão novo. Colapso/ângulo re-aplicam a seção inteira.

   Altura: recolhida, a linha tem altura fixa (`--bar`) e ignora `--calc`; a
   alça (`#calc-divider`) só existe expandida. `--calc` (o `calcHeight` do
   estado) é a altura do PAINEL expandido e segue guardada por sessão mesmo
   enquanto a linha está recolhida. Medição/arrasto da alça continuam no
   `main.mjs`: é fato de host.

   Expandida, o painel abre INTEIRO (`fitCalculator`): se a barra mais o
   corpo pedem mais que o `--calc` guardado, a altura cresce até o conteúdo,
   com o mesmo teto de 70% da coluna que a alça respeita. Vale ao expandir, ao
   abrir o "Como usar" e na restauração do layout; quem arrastou para mais alto
   fica com a altura que escolheu. */

const MAX_HISTORY=8;
const state={collapsed:true,angle:'rad',expression:'',result:'',history:[],guideOpen:false};
let section=null;

/* Fatos que o DOM vivo carrega (tecla a tecla) e a view não controla. */
function syncFromDom(){
 const input=$('#expression');
 if(input)state.expression=input.value;
 const guide=$('#calc-guide');
 if(guide)state.guideOpen=guide.open;
}

/* O resultado fica guardado como o avaliador o devolve (ponto decimal) e só vira o formato do idioma ao pintar (#41). */
const shown=raw=>localizeDecimal(raw,currentLanguage());

/* `history` é uma lista Bend Con/Nil na ordem do DOM (mais novo primeiro). */
function historyList(){
 let out={$:'Nil'};
 for(let i=state.history.length-1;i>=0;i--){
  const {expr,result}=state.history[i];
  out={$:'Con',head:{$:'CalcEntry',expr,result:shown(result)},tail:out};
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

/* Os SVGs saem do host (a view só reserva o lugar): a calculadora à esquerda
   e o chevron do controle — para cima expande (o painel cresce para cima), para
   baixo recolhe. */
function injectIcons(){
 const lead=section.querySelector('.calc-icon');
 if(lead)lead.innerHTML=icon('calculator');
 const toggle=section.querySelector('#calc-toggle');
 if(toggle)toggle.innerHTML=icon(state.collapsed?'chevronUp':'chevronDown');
}

function renderResult(){
 const el=$('#result');
 if(el)renderChildren(el,calcCore.calcResult(shown(state.result)).kids);
}

/* O bloco inteiro (título, Limpar, lista, frase de vazio): "Limpar" liga e
   desliga com a lista. */
function renderHistory(){
 const box=$('#calc-hist');
 if(box)renderChildren(box,calcCore.historyBlock(historyList()).kids,handlers);
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
   shown(state.result),
   historyList(),
   state.guideOpen
 );
 applySection(node);
 preserveFocus(section,()=>renderChildren(section,node.kids,handlers));
 injectIcons();
}

/* Troca de idioma (#41): o texto da view volta pelo `retranslateTree`; aqui refaz os números (vírgula ou ponto decimal). */
export function relabelCalculator(){
 if(section)render();
}

export function fitCalculator(){
 if(!section||state.collapsed||section.hidden)return false;
 const bar=section.querySelector('#calc-bar'),body=section.querySelector('#calc-body'),side=$('#sidebar');
 if(!bar||!body||!side)return false;
 const need=Math.ceil(bar.offsetHeight+body.scrollHeight);
 if(need<=calcHeightPx())return false;
 const cap=Math.floor(side.getBoundingClientRect().height*0.7);
 document.documentElement.style.setProperty('--calc',Math.max(72,Math.min(need,cap))+'px');
 return true;
}
/* "Como usar" aberto e fechado (#42): abrir cresce o painel até o conteúdo;
   fechar devolve a altura de antes — a menos que a pessoa tenha arrastado a
   alça nesse meio-tempo (aí a altura é a dela). */
let beforeGuide=null;
function guideToggled(open){
 if(open){
  /* Re-render com o guia aberto (ângulo, colapso) dispara `toggle` de novo:
     sem crescer, a altura de antes já guardada continua valendo. */
  const before=calcHeightPx();
  if(!fitCalculator())return false;
  beforeGuide={before:beforeGuide?.before??before,grown:calcHeightPx()};
  return true;
 }
 const back=beforeGuide;beforeGuide=null;
 if(!back||calcHeightPx()!==back.grown)return false;
 document.documentElement.style.setProperty('--calc',back.before+'px');
 return true;
}

/* Chamado pelo `main.mjs` quando o DOM já está montado. */
export function initCalculator(){
 section=$('#calculator');
 if(!section)return false;
 render();
 /* `toggle` do <details> não borbulha: escuta na captura. */
 section.addEventListener('toggle',event=>{
  if(event.target?.id==='calc-guide'&&guideToggled(event.target.open))save();
 },true);
 return true;
}

function pushHistory(expr,result){
 state.history.unshift({expr,result});
 if(state.history.length>MAX_HISTORY)state.history.length=MAX_HISTORY;
}

const handlers={
 ToggleCalc(){
  state.collapsed=!state.collapsed;
  render();
  fitCalculator();
  /* Estado de interface lembrado entre aberturas: grava já, sem esperar o
     próximo save do estudo. */
  save(true);
 },
 SetAngle(event){
  state.angle=event.currentTarget?.dataset?.angle==='deg'?'deg':'rad';
  render();
 },
 ClearHistory(){
  state.history.length=0;
  renderHistory();
  $('#expression')?.focus();
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
   toast(text(e.message));
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

/* ---------- contrato do layout (presets/viewLayout) ----------
   O colapso da calculadora é fato de VIEW: um preset de layout precisa lê-lo e
   escrevê-lo sem tocar em expressão, resultado ou histórico. O setter segue o
   MESMO caminho do clique no título (re-aplica a seção inteira) e é no-op
   quando o estado não muda — quem chama de um reapply não pisca a seção. */
export function getCalculatorCollapsed(){
 return !!state.collapsed;
}

export function setCalculatorCollapsed(value){
 const next=!!value;
 if(next===state.collapsed)return;
 state.collapsed=next;
 render();
 fitCalculator();
}
