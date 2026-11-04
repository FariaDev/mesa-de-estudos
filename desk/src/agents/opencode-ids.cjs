// @ts-check
'use strict';

/* Ids do fio do `opencode serve` 2.0.32 (#57). O descritor da Mesa continua
   UUID; o servidor recusa sessão que não comece com `ses` e mensagem que não
   comece com `msg`. O `ses_` NÃO é cunhado aqui: o servidor o cria (o Zen
   recusa o grátis com id de fora; `native-identity.cjs`). Medido no binário:
   `POST /api/session` com o mesmo `ses_` duas vezes devolve 200 e a MESMA
   sessão, então reabrir com o id guardado é seguro. */

const crypto = require('node:crypto');

const WIRE_SESSION_RE = /^ses[A-Za-z0-9_-]{1,80}$/;
const WIRE_MESSAGE_RE = /^msg[A-Za-z0-9_-]{1,80}$/;

const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
let lastStamp = 0;
let counter = 0;

/* O servidor ordena as mensagens da sessão pelo id. O id antigo era
   `msg_` + bytes aleatórios: ao reabrir a conversa, a fala do aluno caía
   antes ou depois da resposta conforme a sorte. Aqui o id segue o formato
   crescente do OpenCode (`Identifier.ascending`): 12 hex de
   `ms * 0x1000 + contador` e 14 caracteres base62. */
function stampHex(now) {
  if (now !== lastStamp) { lastStamp = now; counter = 0; }
  counter = Math.min(counter + 1, 0xfff);
  /* `ms * 0x1000 + contador` em hex é o hex do ms seguido de 3 dígitos do
     contador: mesma string, sem passar de 2^53. */
  return `${now.toString(16)}${counter.toString(16).padStart(3, '0')}`.padStart(12, '0').slice(-12);
}

function randomBase62(length) {
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (const byte of bytes) out += BASE62[byte % 62];
  return out;
}

/**
 * Um id de mensagem novo, crescente no tempo como os do servidor.
 * @param {number} [now] relógio em ms (teste)
 * @returns {string}
 * @example mintWireMessageId(1793393632844) // 'msg_1a1a…' (12 hex + 14 base62)
 */
function mintWireMessageId(now = Date.now()) {
  return `msg_${stampHex(now)}${randomBase62(14)}`;
}

/**
 * O uuid da Mesa identifica a entrega; o fio só leva um id `msg_`.
 * @param {unknown} id
 * @returns {string}
 * @example wireMessageId('msg_abc') // 'msg_abc'; wireMessageId('uuid') // 'msg_…' novo
 */
function wireMessageId(id) {
  return typeof id === 'string' && WIRE_MESSAGE_RE.test(id) ? id : mintWireMessageId();
}

module.exports = {WIRE_SESSION_RE, WIRE_MESSAGE_RE, mintWireMessageId, wireMessageId};
