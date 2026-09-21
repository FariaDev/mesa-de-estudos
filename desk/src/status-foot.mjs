import {$,toggleMeterTip} from './state.mjs';
import {preserveFocus,renderInto} from './view-host.mjs';
import sv from './generated/statusview.core.js';

/* Rodapé da lateral: modelo · esforço · contexto. A árvore é desenhada no
   `core/statusview.bend` e aplicada pelo `view-host.mjs` — o host só empurra
   valores (`footValues`) e nunca lê o DOM dos selects/medidor nem observa
   mutação. Quem empurra é o `state.mjs`, nos mesmos pontos em que esses
   controles mudam (settings, medidor, turno e troca de matéria).

   O botão (`#foot-status`) é recriado a cada render; o clique vem da tabela
   de handlers do view-host (`toggleMeterTip`), não de um listener preso ao nó.
   O texto do balão sai do Bend como `data-tip` (o `tooltip.mjs` cuida do
   resto), e o `aria-label` cai em "Status do modelo" quando não há tooltip.

   Turno em andamento (`busy`) esconde modelo/esforço, como os selects
   desabilitados faziam: o contexto continua. */

let sideFoot=null;
let values={model:'',level:'',context:'',tip:'',busy:false};
let painted='';
let frame=0;
let built=false;

const HANDLERS={toggleMeterTip};

/* Valores puros do rodapé; campo ausente fica como está. */
export function footValues(patch={}){
 values={...values,...patch};
 schedule();
}

function schedule(){
 if(frame)return;
 frame=1;
 requestAnimationFrame(()=>{frame=0;render();});
}

function render(){
 if(!sideFoot)return;
 const model=values.busy?'':values.model;
 const level=values.busy?'':values.level;
 const signature=`${model}\n${level}\n${values.context}\n${values.tip}`;
 if(signature===painted)return;
 painted=signature;
 preserveFocus(sideFoot,()=>{
  renderInto(sideFoot,sv.footStatus(model,level,values.context,values.tip,''),HANDLERS);
 });
}

function build(){
 const sidebar=$('#sidebar');
 if(!sidebar)return false;
 let foot=$('.side-foot');
 if(!foot){
  // A lateral é flex column: entra depois da calculadora, no fim.
  foot=document.createElement('div');
  foot.className='side-foot';
  sidebar.append(foot);
 }
 sideFoot=foot;
 render();
 return true;
}

export function init(){
 if(built)return;
 if(!$('#sidebar')){
  // Lateral ainda não montada (init cedo demais): tenta de novo quando o DOM estiver pronto.
  document.addEventListener('DOMContentLoaded',init,{once:true});
  return;
 }
 built=build();
}

if(typeof document!=='undefined'){
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
 else init();
}
