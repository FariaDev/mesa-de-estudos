// @ts-check

/* As três saídas do "Relatar um problema" (#62), a partir do relatório já
   limpo: o prompt para Claude Code / Codex, o comando `opencode run` com um
   modelo grátis e o endereço da issue nova no GitHub, preenchida para a pessoa
   revisar e enviar. Nada aqui manda dado para fora: só monta texto. */
import {SAFE_MODEL_ID} from './triage-free-model.mjs';

export const ISSUE_REPO='FariaDev/mesa-de-estudos';
const ISSUE_NEW=`https://github.com/${ISSUE_REPO}/issues/new`;
/* O GitHub recusa endereço muito longo; 7500 caracteres cabem com folga nos navegadores. */
const ISSUE_URL_MAX=7500;
const ISSUE_TITLE='[Mesa] Descreva o problema em uma linha';

/** Os campos que a pessoa preenche antes do relatório, no formato das issues do repositório. */
const ISSUE_FORM=[
 '## O que aconteceu',
 '(descreva aqui)',
 '',
 '## Como reproduzir',
 '1. ',
 '',
 '## O que eu esperava',
 '',
];

/**
 * Prompt completo para rodar com Claude Code ou Codex no repositório.
 * @param {string} report relatório limpo (`reportText`)
 * @param {string} commit commit em uso
 * @returns {string}
 * @example agentPrompt(report, 'ca681f7').includes('rascunhe') // true
 */
export function agentPrompt(report,commit){
 return [
  `Você está no repositório da Mesa de Estudos (${ISSUE_REPO}), no commit ${commit}. Alguém achou um problema e gerou o relatório limpo abaixo com \`npm run triage\`.`,
  '',
  'Faça nesta ordem:',
  '1. Leia o AGENTS.md. Rode `npm run doctor` em `desk/` e compare com o relatório.',
  '2. Decida se é problema desta máquina (instalação, configuração, versão de motor). Se for, conserte aqui e explique o que mudou. Não altere os defaults de `desk/config.cjs`, PDFs nem material de curso.',
  `3. Procure issues parecidas: \`gh issue list --repo ${ISSUE_REPO} --state all --search "<palavras do erro>"\`. Se achar, diga qual e pare.`,
  `4. Se for bug da Mesa, rascunhe a issue no formato do repositório (O que aconteceu / Como reproduzir / O que eu esperava / relatório). Não crie a issue: mostre o rascunho para a pessoa revisar.`,
  '5. Não leia sessões JSONL, `auth.json` nem chaves de API, e não cole nada disso em lugar nenhum.',
  '',
  report,
 ].join('\n');
}

/**
 * Prompt curto e passo a passo para um modelo grátis: não conserta código.
 * @param {string} report
 * @returns {string}
 */
export function freePrompt(report){
 return [
  `Relatório de problema da Mesa de Estudos (${ISSUE_REPO}). Faça só estes passos, um de cada vez:`,
  '1. Rode `npm run doctor` dentro de `desk/` e diga o que falhou.',
  '2. Leia o relatório abaixo e resuma o problema em uma frase.',
  `3. Procure issue parecida: \`gh issue list --repo ${ISSUE_REPO} --state all --search "<palavras do erro>"\`.`,
  '4. Se não houver, escreva um rascunho de issue (O que aconteceu / Como reproduzir / O que eu esperava). Não crie a issue e não altere nenhum arquivo.',
  '',
  report,
 ].join('\n');
}

/**
 * Aspas para o terminal: simples no zsh/bash; no PowerShell, a aspa simples dobra.
 * @param {string} text @param {string} platform
 * @returns {string}
 * @example shellQuote("it's", 'darwin') // "'it'\\''s'"
 */
export function shellQuote(text,platform){
 if(platform==='win32')return `'${text.replace(/'/g,"''")}'`;
 return `'${text.replace(/'/g,"'\\''")}'`;
}

/**
 * Como chamar o OpenCode no terminal. A Mesa o instala em `~/.opencode/bin`, fora
 * do PATH, onde `opencode` puro daria "command not found". Sem caminho pessoal.
 * @param {string} found binário encontrado @param {string} home @param {string} platform
 * @returns {string}
 * @example opencodeLauncher('/Users/a/.opencode/bin/opencode', '/Users/a', 'darwin') // '~/.opencode/bin/opencode'
 */
export function opencodeLauncher(found,home,platform){
 const dir=String(found||'').startsWith(String(home||'\0'))?String(found).slice(String(home).length).replace(/\\/g,'/'):'';
 if(!/^\/\.opencode\/bin\/opencode(\.exe)?$/.test(dir))return 'opencode';
 return platform==='win32'?`& "$HOME${dir.replace(/\//g,'\\')}"`:`~${dir}`;
}

/**
 * Palavra que o shell passa sem aspas: só o formato de id de modelo (a mesma
 * fonte do filtro de `freeZenIds`). O comando comum segue legível
 * (`--model opencode/x-free` sem aspas); o que foge do formato vai citado
 * íntegro — colar o modelo cru executaria na máquina de quem colou.
 * @param {string} text @param {string} platform
 * @returns {string}
 * @example shellWord('opencode/x-free', 'darwin') // 'opencode/x-free'
 */
export function shellWord(text,platform){
 if(text&&SAFE_MODEL_ID.test(String(text)))return String(text);
 return shellQuote(String(text),platform);
}

/**
 * O comando do OpenCode, ou o motivo de não haver um.
 * @param {{opencode: boolean, opencodeLauncher?: string, opencodeStandalone?: boolean, freeModel: {model: string, policyKey: string} | null}} facts
 * @param {string} report @param {string} platform
 * @returns {{command: string, model: string, policyKey: string} | {command: null, reason: 'triage.opencode.missing' | 'triage.opencode.noFree'}}
 */
export function opencodeCommand(facts,report,platform){
 if(!facts.opencode)return {command:null,reason:'triage.opencode.missing'};
 if(!facts.freeModel)return {command:null,reason:'triage.opencode.noFree'};
 const {model,policyKey}=facts.freeModel;
 return {command:`${facts.opencodeLauncher||'opencode'} run ${facts.opencodeStandalone?'--standalone ':''}--model ${shellWord(model,platform)} ${shellQuote(freePrompt(report),platform)}`,model,policyKey};
}

/**
 * Endereço da issue nova, com título e relatório. Se passar do limite, o
 * relatório é cortado com um aviso para a pessoa colar o resto.
 * @param {string} report
 * @returns {{url: string, truncated: boolean}}
 * @example issueUrl('## Ambiente').url.startsWith('https://github.com/FariaDev/mesa-de-estudos/issues/new?') // true
 */
export function issueUrl(report){
 const build=body=>`${ISSUE_NEW}?${new URLSearchParams({title:ISSUE_TITLE,body:[...ISSUE_FORM,body].join('\n')})}`;
 const whole=build(report);
 if(whole.length<=ISSUE_URL_MAX)return {url:whole,truncated:false};
 const note='\n\n(relatório cortado para caber no endereço: cole aqui o resto do relatório copiado da Mesa)';
 let size=report.length;
 while(size>0&&build(report.slice(0,size)+note).length>ISSUE_URL_MAX)size=Math.floor(size*0.9);
 return {url:build(report.slice(0,size)+note),truncated:true};
}

/**
 * Se o endereço é mesmo uma issue nova deste repositório (o host só abre isso).
 * @param {unknown} url
 * @returns {boolean}
 */
export function isIssueUrl(url){
 return typeof url==='string'&&url.startsWith(`${ISSUE_NEW}?`)&&url.length<=ISSUE_URL_MAX;
}
