import {$,labelBtn} from './state.mjs';
import {build} from './view-host.mjs';
import composerCore from './generated/composerview.core.js';

/* Painel de ajustes do composer (Mesa): Modelo, Esforço e o `auto` da
   compactação saem da linha de cima e entram num bloco recolhível — a pergunta,
   o envio e os botões de anexo/Conferir continuam à vista, que é o pedido 4 do
   repo (mais espaço para o estudo sem perder o jeito discreto).

   A casca (`#pi-settings-panel` > `#settings-toggle` + `#pi-settings-body`) é
   do `core/composerview.bend`; aqui ficam o DOM e o estado. O host monta a
   casca UMA vez e MOVE para dentro do corpo os controles vivos do index.html
   (`.pi-settings` e `#auto-compact`): re-renderizar trocaria o corpo e perderia
   os controles. Abrir/fechar só troca classe/`aria-expanded`/`hidden`.

   O padrão é aberto; a escolha fica em `localStorage` (`mesa.piPanel`), como a
   densidade — quem recolheu não vê o painel abrir de novo a cada abertura. */

const KEY='mesa.piPanel';

let open=readOpen();

function readOpen(){
 try{return localStorage.getItem(KEY)!=='fechado';}catch{return true;}
}

function panel(){return $('#pi-settings-panel');}
function body(){return $('#pi-settings-body');}

function apply(){
 const box=body();
 const toggle=$('#settings-toggle');
 if(toggle){
  toggle.classList.toggle('open',open);
  toggle.setAttribute('aria-expanded',open?'true':'false');
 }
 if(box)box.hidden=!open;
}

function toggle(){
 open=!open;
 try{localStorage.setItem(KEY,open?'aberto':'fechado');}catch{}
 apply();
}

/* Casca do núcleo + o ícone do host (mesmo andaime `data-icon` das abas). */
function mount(){
 const anchor=$('.pi-settings');
 if(!anchor||panel())return;
 const shell=build(composerCore.settingsPanel(open),{ToggleSettings:toggle});
 const button=shell.querySelector('#settings-toggle');
 if(button){
  const name=button.dataset.icon;
  button.removeAttribute('data-icon');
  labelBtn(button,name,button.textContent);
 }
 anchor.before(shell);
 const box=body();
 if(box){
  box.append(anchor);
  const auto=$('#auto-compact');
  if(auto)box.append(auto);
 }
 apply();
}

export function settingsPanelOpen(){return open;}

export function toggleSettingsPanel(){toggle();}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});
else mount();
