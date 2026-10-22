// @ts-check
import {$,S} from './state.mjs';
import {t,applyStaticText} from './ui-text.mjs';
import {piCommand} from '../triage-outputs.mjs';

/* "Relatar um problema" (#62), na janela: pede o relatório limpo ao main
   (`triage-report`, montado no `triage-worker.mjs`), mostra para a pessoa ler
   e oferece as saídas (Claude/Codex, Pi, OpenCode e a issue). Copiar só usa a área de transferência; a issue só
   abre no navegador depois do clique, e quem envia é a pessoa, no GitHub. */

const DIALOG='#triage-dialog';
/* O diálogo nasce aqui, e não no `index.html` (que tem teto de linhas): as
   frases são `data-i18n`, então a troca de idioma o alcança como aos outros. */
const DIALOG_HTML=`
  <form method="dialog">
    <h2 id="triage-title" data-i18n="triage.title"></h2>
    <p class="study-muted" data-i18n="triage.lead"></p>
    <pre id="triage-report" tabindex="0" data-i18n-attr="aria-label=triage.reportAria"></pre>
    <div class="triage-outputs">
      <div class="triage-output">
        <div><strong data-i18n="triage.out.agent"></strong><p class="study-muted" data-i18n="triage.out.agentHint"></p></div>
        <button type="button" id="triage-copy-agent" data-i18n="triage.copyPrompt" disabled></button>
      </div>
      <div class="triage-output" id="triage-pi-row" hidden>
        <div>
          <strong data-i18n="triage.out.pi"></strong>
          <select id="triage-pi-model" data-i18n-attr="aria-label=triage.pi.models" hidden></select>
          <p id="triage-pi-note" class="study-muted"></p>
        </div>
        <button type="button" id="triage-copy-pi" data-i18n="triage.copyCommand" hidden></button>
      </div>
      <div class="triage-output" id="triage-opencode-row" hidden>
        <div><strong data-i18n="triage.out.opencode"></strong><p id="triage-opencode-note" class="study-muted"></p></div>
        <button type="button" id="triage-copy-opencode" data-i18n="triage.copyCommand" hidden></button>
      </div>
    </div>
    <p id="triage-status" class="study-muted" role="status" aria-live="polite" hidden></p>
    <div class="study-footer">
      <button value="cancel" data-i18n="common.close"></button>
      <button type="button" id="triage-open-issue" class="primary" data-i18n="triage.openIssue" disabled></button>
    </div>
  </form>`;

/** @type {import('../triage-host.cjs').TriageResult | null} */
let current=null;

/** @param {string} text */
function say(text){
 const status=$('#triage-status');
 status.textContent=text;
 status.hidden=!text;
}

/** @param {HTMLElement} node @param {boolean} on */
function enable(node,on){if(node)/** @type {HTMLButtonElement} */(node).disabled=!on;}

/** O motor e o modelo em uso, sem nada da sessão. */
function currentChoice(){
 const choice=S.choice||{};
 const model=choice.provider&&choice.id?`${choice.provider}/${choice.id}`:String(choice.model||'');
 return {engine:String(S.engine||''),model};
}

/** @param {import('../triage-host.cjs').TriageResult['opencode']} opencode */
function paintOpencode(opencode){
 const note=$('#triage-opencode-note');
 $('#triage-copy-opencode').hidden=!opencode.command;
 $('#triage-opencode-row').hidden=false;
 if('reason' in opencode){note.textContent=t(opencode.reason);return;}
 note.textContent=t('triage.freeWarning',{model:opencode.model,policy:t(opencode.policyKey).toLowerCase()});
}

/* Pi (#62, pedido no próprio ticket): o modelo que a pessoa já usa, trocável
   entre os recentes e favoritos do seletor; o comando é refeito pela mesma
   função do terminal (`piCommand`). */
/** @param {string} model */
function pickPiModel(model){
 const pi=current?.pi;
 if(!pi||'reason' in pi)return;
 const next=piCommand(pi.facts,current.agentPrompt,pi.platform,model);
 if('reason' in next)return;
 current.pi={...pi,...next};
 $('#triage-pi-note').textContent=next.model?t('triage.pi.cost',{model:next.model}):t('triage.pi.costDefault');
}

/** @param {import('../triage-host.cjs').TriageResult['pi']} pi */
function paintPi(pi){
 const select=/** @type {HTMLSelectElement} */($('#triage-pi-model'));
 $('#triage-pi-row').hidden=false;
 const missing='reason' in pi;
 $('#triage-copy-pi').hidden=missing;
 select.hidden=missing||pi.facts.piModels.length===0;
 if(missing){$('#triage-pi-note').textContent=t(pi.reason);return;}
 select.replaceChildren(...pi.facts.piModels.map(model=>new Option(model,model,false,model===pi.model)));
 pickPiModel(pi.model);
}

/** @param {import('../triage-host.cjs').TriageResult | null} result */
function paint(result){
 current=result;
 $('#triage-report').textContent=result?.report||'';
 enable($('#triage-copy-agent'),!!result);
 enable($('#triage-open-issue'),!!result);
 if(!result){
  for(const id of ['#triage-pi-row','#triage-opencode-row'])$(id).hidden=true;
  return;
 }
 paintPi(result.pi);
 paintOpencode(result.opencode);
 say(result.issue.truncated?t('triage.issueTruncated'):'');
}

/**
 * Abre o diálogo e junta o relatório.
 * @example openTriage() // pelo item "Relatar um problema" de Mais opções
 */
export async function openTriage(){
 const dialog=/** @type {HTMLDialogElement} */($(DIALOG));
 paint(null);
 say(t('triage.loading'));
 if(!dialog.open)dialog.showModal();
 const answer=await window.desk.triageReport(currentChoice()).catch(error=>({ok:false,error:String(error?.message||error)}));
 if(!dialog.open)return;
 if(!answer?.ok){say(t('triage.failed',{error:answer?.error||''}));return;}
 paint(answer.result);
}

/** @param {string} text */
async function copy(text){
 try{await navigator.clipboard.writeText(text);say(t('triage.copied'));}
 catch(error){say(t('triage.failed',{error:String(error?.message||error)}));}
}

/**
 * Cria o diálogo e liga os botões (uma vez, no início do app).
 * @example initTriage()
 */
export function initTriage(){
 const dialog=document.createElement('dialog');
 dialog.id='triage-dialog';dialog.className='study-dialog';dialog.setAttribute('aria-labelledby','triage-title');
 dialog.innerHTML=DIALOG_HTML;
 document.body.append(dialog);
 applyStaticText(dialog);
 $('#triage-copy-agent').addEventListener('click',()=>{if(current)copy(current.agentPrompt);});
 $('#triage-copy-opencode').addEventListener('click',()=>{if(current?.opencode.command)copy(current.opencode.command);});
 $('#triage-copy-pi').addEventListener('click',()=>{if(current?.pi.command)copy(current.pi.command);});
 $('#triage-pi-model').addEventListener('change',event=>pickPiModel(/** @type {HTMLSelectElement} */(event.target).value));
 $('#triage-open-issue').addEventListener('click',async()=>{
  if(!current)return;
  const answer=await window.desk.triageOpenIssue(current.issue.url);
  say(answer?.ok?t('triage.opened'):t('triage.failed',{error:answer?.error||''}));
 });
}
