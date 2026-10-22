// @ts-check
import {redactSecrets} from './src/log-entry.mjs';

/* Limpeza do "Relatar um problema" (#62): tudo o que sai da máquina passa por
   aqui antes. O relatório é mostrado à pessoa antes de sair, mas a limpeza não
   conta com ela: caminhos pessoais viram `~` ou um rótulo, nomes de matéria e
   de PDF viram rótulos, segredos viram `[oculto]` e linha de log com cara de
   sessão (JSONL) sai inteira. O teste de vazamento
   (`tests/triage-leak.test.mjs`, perfil falso `fake-triage-profile.mjs`) é
   quem prova que nada passa. */

/* Além do `redactSecrets` do log (sk-…, Bearer, nome=valor): tokens do GitHub,
   do Slack e do Google, e JSON com campo de segredo (`"key": "…"`, o formato
   dos `auth.json` do Pi e do OpenCode). */
const EXTRA_SECRETS=[
 /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}/g,
 /\bgithub_pat_[A-Za-z0-9_]{20,}/g,
 /\bxox[abprs]-[A-Za-z0-9-]{10,}/g,
 /\bAIza[A-Za-z0-9_-]{30,}/g,
 /"(?:key|access|refresh|apiKey|api_key|token|secret)"\s*:\s*"[^"]*"/gi,
];
/* Arquivo de material e captura: nome some mesmo sem estar em lista conhecida.
   O nome vai até o separador mais próximo (barra, aspas, pontuação, parênteses);
   nome com espaço pode levar junto a palavra de antes, e isso é de propósito:
   melhor perder contexto do que vazar o nome. */
const FILE_NAMES=[
 {pattern:/[^\s/\\"'`:;,()[\]<>]+(?: [^\s/\\"'`:;,()[\]<>]+)*\.pdf\b/gi,label:'<pdf>'},
 {pattern:/[^\s/\\"'`:;,()[\]<>]+(?: [^\s/\\"'`:;,()[\]<>]+)*\.(?:xopp|png|jpe?g|heic|webp)\b/gi,label:'<arquivo>'},
 {pattern:/[^\s/\\"'`:;,()[\]<>]+(?: [^\s/\\"'`:;,()[\]<>]+)*\.jsonl\b/gi,label:'<sessão>'},
];
/* Casa de outra pessoa (outro usuário, cópia de caminho de outra máquina). */
const OTHER_HOMES=[/\/Users\/[^/\s"'`]+/g,/\/home\/[^/\s"'`]+/g,/[A-Za-z]:\\Users\\[^\\\s"'`]+/g];
/* Uma linha de log que traz conteúdo de sessão (JSONL do Pi/Claude/OpenCode) não é diagnóstico. */
const SESSION_MARKERS=/"(?:role|content|parts|message)"\s*:|"type"\s*:\s*"(?:message|user|assistant|text|tool_result)"/i;

/** @typedef {{text: string, label: string}} Replacement */

/** @param {string} text @returns {string} */
function escapeRegExp(text){return text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}

/**
 * Lista de trocas exatas, da mais longa para a mais curta (um caminho de
 * matéria dentro do vault some antes do vault). Texto vazio ou curto demais
 * para ser pessoal (menos de 3 caracteres) fica de fora.
 * @param {Replacement[]} items
 * @returns {Replacement[]}
 */
function orderReplacements(items){
 const seen=new Set();
 return items
  .filter(item=>typeof item?.text==='string'&&item.text.trim().length>=3)
  .filter(item=>!seen.has(item.text)&&seen.add(item.text))
  .sort((a,b)=>b.text.length-a.text.length);
}

/**
 * Variantes de um caminho que aparecem em texto: barras normais, invertidas e
 * a forma escapada de JSON no Windows.
 * @param {string} file
 * @returns {string[]}
 */
function pathForms(file){
 return [file,file.replace(/\\/g,'/'),file.replace(/\//g,'\\'),file.replace(/\\/g,'\\\\')];
}

/**
 * Monta o limpador do perfil desta máquina.
 * @param {{home: string, paths?: Replacement[], names?: Replacement[]}} profile
 *   `home` vira `~`; `paths` (runtime, vault, pastas de matéria) e `names`
 *   (matérias, PDFs) viram o rótulo dado
 * @returns {(text: string) => string}
 * @example createScrubber({home: '/Users/ana', names: [{text: 'Cálculo II', label: '<matéria 1>'}]})('erro em /Users/ana/Cálculo II/x') // 'erro em ~/<matéria 1>/x'
 */
export function createScrubber({home,paths=[],names=[]}){
 const exact=orderReplacements([
  ...paths.flatMap(item=>pathForms(item.text).map(text=>({text,label:item.label}))),
  ...names,
  ...pathForms(home||'').map(text=>({text,label:'~'})),
 ]).map(item=>({pattern:new RegExp(escapeRegExp(item.text),'giu'),label:item.label}));
 return function scrub(text){
  let out=String(text??'');
  for(const {pattern,label} of exact)out=out.replace(pattern,label);
  for(const pattern of OTHER_HOMES)out=out.replace(pattern,'~');
  for(const {pattern,label} of FILE_NAMES)out=out.replace(pattern,label);
  out=redactSecrets(out);
  for(const pattern of EXTRA_SECRETS)out=out.replace(pattern,'[oculto]');
  return out;
 };
}

/**
 * Se a linha do log carrega conteúdo de sessão e não pode sair nem limpa.
 * @param {string} text
 * @returns {boolean}
 * @example looksLikeSession('{"role":"user","content":"minha dúvida"}') // true
 */
export function looksLikeSession(text){
 return SESSION_MARKERS.test(String(text||''));
}

/**
 * Uma linha do `desk.log` (JSON por linha; linha antiga em texto também vale)
 * vira `{level, line}` legível, ou null quando não é aviso nem erro.
 * @param {string} raw
 * @returns {{level: string, line: string} | null}
 */
function logLine(raw){
 let entry=null;
 try{entry=JSON.parse(raw);}catch{/* linha antiga, em texto: vale como erro */}
 if(!entry||typeof entry!=='object')return raw.trim()?{level:'error',line:raw.trim()}:null;
 const level=String(entry.level||'');
 if(level!=='error'&&level!=='warn')return null;
 /* Só os três primeiros trechos da mensagem: o resto do stack é caminho repetido. */
 const msg=String(entry.msg||'').split('\n').slice(0,3).join(' | ');
 return {level,line:`${String(entry.ts||'')} ${level} [${String(entry.area||'')}] ${msg}`.trim()};
}

/**
 * As últimas `limit` linhas de aviso/erro do `desk.log`, limpas. Linha com cara
 * de sessão sai com um marcador, sem o texto.
 * @param {string} rawLog conteúdo de `desk.log.1` + `desk.log`
 * @param {{scrub: (text: string) => string, limit?: number}} options
 * @returns {string[]}
 * @example cleanLogLines('{"ts":"t","level":"error","area":"main","msg":"x"}\n', {scrub: s => s}) // ['t error [main] x']
 */
export function cleanLogLines(rawLog,{scrub,limit=20}){
 const out=[];
 for(const raw of String(rawLog||'').split('\n')){
  const entry=logLine(raw);
  if(!entry)continue;
  out.push(looksLikeSession(entry.line)?'(linha omitida: parecia conteúdo de sessão)':scrub(entry.line).slice(0,500));
 }
 return out.slice(-limit);
}
