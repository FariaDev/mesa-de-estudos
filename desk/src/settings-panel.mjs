import {$,labelBtn,supportsCapability,syncChatScrollMode} from './state.mjs';
import {build} from './view-host.mjs';
import {doCompact} from './chat.mjs';
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

/* Resumo do contexto (pedido 6): o rótulo explícito "Resumir automaticamente"
   com descrição, o `auto` do núcleo ao lado e a ação manual "Resumir contexto".
   O botão manual é desabilitado com explicação REAL onde o motor não oferece a
   capacidade (Claude experimental) — nada de chamar o Pi no lugar. O bloco vive
   DENTRO do `.pi-settings` para não mudar os filhos do corpo (contrato dos
   smokes antigos). */
function mountCompactTools(){
 const anchor=$('.pi-settings');
 if(!anchor||$('#compact-now'))return;
 const tools=document.createElement('div');
 tools.className='compact-tools';
 const label=document.createElement('span');
 label.className='compact-auto-label';
 label.textContent='Resumir automaticamente';
 const desc=document.createElement('span');
 desc.className='fine';
 desc.id='compact-auto-desc';
 const manual=document.createElement('button');
 manual.type='button';
 manual.id='compact-now';
 manual.textContent='Resumir contexto';
 manual.addEventListener('click',()=>doCompact(''));
 tools.append(label,desc,manual);
 anchor.append(tools);
 syncCompactTools();
}
export function syncCompactTools(){
 const manual=$('#compact-now');
 if(manual){
  const canCompact=supportsCapability('compact');
  manual.disabled=!canCompact;
  manual.title=canCompact?'Resumir o contexto da conversa principal agora':'Indisponível neste motor: o Claude Code (experimental) não expõe compactação pela Mesa.';
 }
 const desc=$('#compact-auto-desc');
 if(desc){
  desc.textContent=supportsCapability('autoCompaction')
   ?'Com ela ligada, o contexto é resumido sozinho quando enche (botão auto).'
   :'Este motor não oferece resumo automático pela Mesa; o resumo manual também fica indisponível.';
 }
}
window.addEventListener('desk-engine-facts',syncCompactTools);

function apply(){
 const box=body();
 const toggle=$('#settings-toggle');
 if(toggle){
  toggle.classList.toggle('open',open);
  toggle.setAttribute('aria-expanded',open?'true':'false');
 }
 if(box)box.hidden=!open;
 /* O painel muda a altura da coluna: acerta o modo de rolagem na hora, sem
    esperar o ResizeObserver (o composer não pode vazar na calculadora). */
 syncChatScrollMode();
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
 mountCompactTools();
 apply();
}

export function settingsPanelOpen(){return open;}

export function toggleSettingsPanel(){toggle();}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});
else mount();
