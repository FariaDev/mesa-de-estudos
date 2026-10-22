// @ts-check
/* O pedaço de uma mensagem de erro que diz o que veio (#43 fase 3). Erro
   bom traz o valor recebido e o formato esperado, mas sem caminho pessoal
   nem segredo. Por isso o valor vira notação curta e neutra de idioma:
   `"high"`, `string(120)`, `array(3)`, `{a, b}`. Texto só aparece por
   inteiro quando é curto e não começa com barra; caminho, token e trecho de sessão
   viram só o tamanho. Sem DOM e sem Electron: o main faz `require` e o
   renderer faz `import` da mesma fonte. O "esperado" também vai em notação
   neutra (`string(1..64)`, `array(0..200)`, `number|null`): a mesma frase
   serve aos dois catálogos. Segredo (chave, token) não passa
   por aqui: texto curto sem barra sairia inteiro. */

import {message} from './i18n.mjs';

/* Barra no meio passa (`text/plain`); no começo seria caminho (`/Users/…`, `~/…`). */
const SAFE_TEXT = /^(?![/~])[\p{L}\p{N} _.,:@+#=/-]{0,40}$/u;
const MAX_KEYS = 6;
/* Um caminho absoluto (POSIX, `~`, Windows ou UNC) até o último separador;
   caminho relativo (`desk/package.json`) não começa assim e fica como está. */
const ABSOLUTE_PATH = /(?<![\w.~-])(?:[A-Za-z]:\\|\\\\|~?\/)(?:[^\s'"`:\\/]+[\\/])+/g;

/**
 * O valor recebido em notação curta, sem caminho nem conteúdo longo.
 * @param {unknown} value
 * @returns {string}
 * @example describeReceived('high') // '"high"'
 * @example describeReceived('/Users/ana/x.pdf') // 'string(16)'
 * @example describeReceived({title: 'a', body: 'b'}) // '{title, body}'
 */
export function describeReceived(value) {
  if (value === null || value === undefined) return String(value);
  if (typeof value === 'string') return SAFE_TEXT.test(value) ? JSON.stringify(value) : `string(${value.length})`;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return String(value);
  if (typeof value === 'function') return 'function';
  if (Array.isArray(value)) return `array(${value.length})`;
  if (typeof value !== 'object') return typeof value;
  return describeKeys(value);
}

/** @param {object} value */
function describeKeys(value) {
  const keys = Object.keys(value);
  const shown = keys.slice(0, MAX_KEYS).map((key) => (SAFE_TEXT.test(key) ? key : '?'));
  const more = keys.length > MAX_KEYS ? `, +${keys.length - MAX_KEYS}` : '';
  return `{${shown.join(', ')}${more}}`;
}

/**
 * Frase de erro para quem programa: o que estava errado, o que veio e o que se esperava.
 * @param {string} label o nome do campo ou argumento
 * @param {unknown} value o valor recebido
 * @param {string} expected o formato esperado, em notação curta
 * @returns {string}
 * @example invalidValue('effort', 'super', 'low|medium|high') // 'effort inválido: recebido "super"; esperado low|medium|high'
 */
export function invalidValue(label, value, expected) {
  return `${label} inválido: recebido ${describeReceived(value)}; esperado ${expected}`;
}

/**
 * A mensagem de um erro de terceiro (fs, spawn, zlib) sem a parte pessoal do
 * caminho: `ENOENT: … open '/Users/ana/x.pdf'` vira `… open '…/x.pdf'`.
 * Mensagem marcada passa inteira: a tela ainda a traduz.
 * @param {unknown} error
 * @returns {string}
 * @example causeText(new Error("EACCES: permission denied, open '/Users/ana/a.pdf'")) // "EACCES: permission denied, open '…/a.pdf'"
 */
export function causeText(error) {
  const raw = error instanceof Error ? error.message : String(error ?? '');
  return raw.replace(ABSOLUTE_PATH, '…/');
}

/**
 * A causa como argumento de outra mensagem marcada: `causeText` com as marcas
 * achatadas (`chave a b`), porque `message()` recusa argumento com o separador U+E001.
 * @param {unknown} error
 * @returns {string}
 * @example message('err.claude.persistFailed', {cause: causeArg(error)})
 */
export function causeArg(error) {
  return causeText(error).replace(/\uE000/g, '').replace(/\uE001/g, ' ');
}

/**
 * Mensagem marcada de pedido IPC fora do contrato: canal, campo, o que veio e o esperado.
 * @param {string} channel o canal `ipcMain.handle`
 * @param {string} field o campo do payload
 * @param {unknown} value o valor recebido
 * @param {string} expected o formato, em notação neutra (`string(1..64)`)
 * @returns {string} mensagem para `text()` traduzir na tela
 * @example invalidRequest('notify', 'body', 3, 'string(1..200)')
 */
export function invalidRequest(channel, field, value, expected) {
  return message('err.ipc.invalid', {channel, field, received: describeReceived(value), expected});
}
