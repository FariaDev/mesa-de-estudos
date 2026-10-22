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

/**
 * Um id de mensagem novo, no formato que o servidor aceita.
 * @returns {string}
 * @example mintWireMessageId() // 'msg_Zk…'
 */
function mintWireMessageId() {
  return `msg_${crypto.randomBytes(12).toString('base64url')}`;
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
