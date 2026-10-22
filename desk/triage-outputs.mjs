// @ts-check

/* As três saídas do "Relatar um problema" (#62), a partir do relatório já
   limpo: o prompt para Claude Code / Codex, o comando `opencode run` com um
   modelo grátis e o endereço da issue nova no GitHub, preenchida para a pessoa
   revisar e enviar. Nada aqui manda dado para fora: só monta texto. */

export const ISSUE_REPO='FariaDev/mesa-e-conversa';
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
 * O comando do OpenCode, ou o motivo de não haver um.
 * @param {{opencode: boolean, freeModel: {model: string, policyKey: string} | null}} facts
 * @param {string} report @param {string} platform
 * @returns {{command: string, model: string, policyKey: string} | {command: null, reason: 'triage.opencode.missing' | 'triage.opencode.noFree'}}
 */
export function opencodeCommand(facts,report,platform){
 if(!facts.opencode)return {command:null,reason:'triage.opencode.missing'};
 if(!facts.freeModel)return {command:null,reason:'triage.opencode.noFree'};
 const {model,policyKey}=facts.freeModel;
 return {command:`opencode run --model ${model} ${shellQuote(freePrompt(report),platform)}`,model,policyKey};
}

/**
 * O comando do Pi com o prompt completo, no modo interativo (a pessoa
 * acompanha e responde). Sem modelo, fica o padrão do Pi; o modelo só vem da
 * lista do próprio relatório (`piModels`), nunca de texto livre.
 * @param {{pi: boolean, piModels: string[]}} facts
 * @param {string} prompt `agentPrompt` @param {string} platform
 * @param {string} [model] um de `facts.piModels`; o primeiro é o padrão
 * @returns {{command: string, model: string} | {command: null, reason: 'triage.pi.missing'}}
 * @example piCommand({pi: true, piModels: ['xai/grok-4']}, 'p', 'darwin').command // "pi --model xai/grok-4 'p'"
 */
export function piCommand(facts,prompt,platform,model=facts.piModels[0]||''){
 if(!facts.pi)return {command:null,reason:'triage.pi.missing'};
 const picked=facts.piModels.includes(model)?model:(facts.piModels[0]||'');
 const flag=picked?`--model ${/^[\w./:@+-]+$/.test(picked)?picked:shellQuote(picked,platform)} `:'';
 return {command:`pi ${flag}${shellQuote(prompt,platform)}`,model:picked};
}

/**
 * Endereço da issue nova, com título e relatório. Se passar do limite, o
 * relatório é cortado com um aviso para a pessoa colar o resto.
 * @param {string} report
 * @returns {{url: string, truncated: boolean}}
 * @example issueUrl('## Ambiente').url.startsWith('https://github.com/FariaDev/mesa-e-conversa/issues/new?') // true
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
