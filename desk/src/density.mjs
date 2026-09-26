import {$} from './state.mjs';
import {build,preserveFocus,renderChildren} from './view-host.mjs';
import aux from './generated/auxview.core.js';

/* Densidade: aperta o espaçamento do chat e da lateral (CSS em body.dense).
   Não mexe no tamanho da fonte. O controle entra na seção "Avisos" das
   Configurações (fallback: antes do rodapé do diálogo).

   A árvore do controle vem do `core/auxview.bend` (`auxview.core.js`) e é
   aplicada pelo `view-host.mjs`: o núcleo decide o modo canonizado, as opções
   com `selected` e a árvore `label > "Densidade" + select`. Aqui ficam os
   fatos do host: localStorage, a classe do `body`, o observer e os listeners
   do diálogo. O `change` é a convenção `on:change` → tabela de handlers. */

const KEY='mesa.density';

let built=false;
let observer=null;

const HANDLERS={SetDensity:onDensity};

function read(){
 try{return aux.densityValue(localStorage.getItem(KEY)||'');}catch{return 'padrao';}
}

function apply(mode){
 document.body.classList.toggle('dense',aux.densityDense(mode));
}

/* Grava a escolha e re-desenha (o `selected` do modo corrente volta do núcleo). */
function onDensity(event){
 const select=event.currentTarget;
 if(!select)return;
 try{localStorage.setItem(KEY,select.value);}catch{}
 apply(select.value);
 sync();
}

/* O markup do index.html é `label > select#density-mode`; o conteúdo do label
   (texto + select) é trocado inteiro pela árvore do Bend. */
function sync(){
 const select=$('#density-mode');
 const label=select?.closest('label');
 if(!select||!label)return;
 const mode=read();
 preserveFocus(label,()=>renderChildren(label,aux.densityFields(mode),HANDLERS));
}

/* Caminho sem markup (como no build antigo): o controle inteiro vem do núcleo
   e entra na seção de avisos; sem seção, antes das ações do diálogo. */
function buildControl(){
 const form=$('#settings-form');
 if(!form)return;
 const label=build(aux.densityControl(read()),HANDLERS);
 const box=form.querySelector('.set-sec[data-sec="avisos"]')||form.querySelector('.set-sec');
 if(box)box.append(label);
 else{
  const menu=form.querySelector('menu, .dialog-actions');
  if(menu)menu.before(label);
  else form.append(label);
 }
 sync();
 if(!$('#density-mode')&&!observer){
  observer=new MutationObserver(()=>{
   if($('#density-mode')&&observer){observer.disconnect();observer=null;}
  });
  observer.observe(form,{childList:true,subtree:true});
 }
}

export function init(){
 if(built)return;
 built=true;
 apply(read());
 if(!$('#density-mode'))buildControl();
 else sync();
 const dialog=$('#settings-dialog');
 if(dialog){
  dialog.addEventListener('close',sync);
  dialog.addEventListener('toggle',()=>{if(dialog.open)sync();});
 }
}

/* O item "Modo compacto" do menu Mesa (e o ⌘⇧D) alterna o MESMO modo do select
   das Configurações: grava a escolha, aperta o `body` e o `sync` devolve o
   `selected` do diálogo. O host do menu só troca ícone/`aria-pressed` do item
   vivo depois (recriar os filhos no meio do clique desanexaria o alvo). */
export function compactMode(){
 return read()==='compacta';
}

export function toggleDensity(){
 const next=compactMode()?'padrao':'compacta';
 try{localStorage.setItem(KEY,next);}catch{}
 apply(next);
 sync();
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
else init();
