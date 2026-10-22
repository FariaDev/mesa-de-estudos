// @ts-check
/* O motivo que a coluna do tutor mostra quando ele não atende (#23, #51).
   Puro (sem DOM): o `tutor-state.mjs` pinta, os testes leem daqui. */
import claudeVersionCore from './generated/claudeversion.core.js';
import {parseMessage} from './i18n.mjs';

/* O motivo é uma frase: a primeira do que o motor devolveu (o texto inteiro
   fica no log da Mesa). Quando a frase seguinte é uma instrução do motor
   ("Pi não encontrado. Rode npm run setup."), ela vem junto: é o que a pessoa
   precisa fazer (#23). Frase de contexto ("A sessão foi preservada…") não entra.
   O núcleo apara e corta o que passar do teto. */
const INSTRUCTION=/^(?:Rode|Indique|Instale|Reinstale|Atualize|Abra|Verifique|Confira|Escolha|Aponte|Configure|Defina|Reinicie|Use)\b/;
/** @param {string} text */
const sentenceEnd=text=>text.search(/[.!?](?=\s+\p{Lu})/u);
/**
 * A primeira frase do motivo (mais a instrução que vem logo depois).
 * @param {unknown} message
 * @returns {string}
 * @example reasonText('Error: Pi não encontrado. Rode npm run setup. Outra.') // 'Pi não encontrado. Rode npm run setup.'
 */
export function reasonText(message){
 const first=String(message??'').split(/\r?\n/).map(line=>line.trim()).find(Boolean)||'';
 /* O nome da classe do erro ("ClaudeAdapterError: …") não é frase para quem
    estuda (#51: a coluna mostrava "ClaudeAdapterError: Versão do Claude Code…"). */
 const clean=first.replace(/^[A-Za-z]*Error:\s*/i,'');
 const end=sentenceEnd(clean);
 if(end<=0)return clean;
 const head=clean.slice(0,end+1);
 const rest=clean.slice(end+1).trim();
 if(!INSTRUCTION.test(rest))return head;
 const next=sentenceEnd(rest);
 return `${head} ${next>0?rest.slice(0,next+1):rest}`;
}

/* O motivo que chega como mensagem do catálogo (Claude Code fora da faixa,
   #51) vai inteiro ao núcleo, que a mostra com o conserto; o view-host a traduz
   no idioma da interface. Qualquer outro motivo segue a frase de sempre. */
/**
 * Motivo e conserto para o núcleo `tutorstate` (`stateViewFix`).
 * @param {unknown} raw o motivo como o `connect()` recebeu
 * @returns {{reason: string, fix: string}} `fix`: "update", "about" ou "".
 * @example reasonFacts('Tutor sem resposta.') // {reason: 'Tutor sem resposta.', fix: ''}
 */
export function reasonFacts(raw){
 const message=parseMessage(String(raw??''));
 if(!message)return {reason:reasonText(raw),fix:''};
 return {reason:String(raw),fix:claudeVersionCore.fixFor(message.key)};
}

