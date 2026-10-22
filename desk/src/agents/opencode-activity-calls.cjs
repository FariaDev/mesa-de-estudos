// @ts-check
'use strict';

/* Identidade das atividades publicadas pelo OpenCode (#57).

   O MCP `mesa` roda num processo que o OpenCode sobe e não recebe o id da
   chamada. O adaptador, porém, vê no SSE `session.tool.called` com o id e os
   argumentos. Este livro guarda `paramsHash → id` das chamadas de
   `mesa_criar_atividade` e a ponte de atividades reivindica o id pelo MESMO
   hash que ela calcula do corpo (`pickPayload`). Cada id é usado uma vez.

   Se o evento não chegar no prazo (a ordem SSE × chamada MCP não foi medida
   com modelo real), a publicação segue com um id próprio `opencode-mcp:…`: o
   quadro aparece, só não fica preso ao balão da ferramenta. Fica no log. */

const crypto = require('node:crypto');
const {paramsHashOfToolInput} = require('../../activity-bridge.cjs');

const CLAIM_WAIT_MS = 3000;
const MAX_CALLS = 64;
const ACTIVITY_TOOL_RE = /(?:^|_)criar_atividade$/;

/**
 * @typedef {{hash: string, id: string}} ObservedCall
 */

/**
 * O livro de chamadas de uma conversa.
 * @param {{waitMs?: number, log?: (line: string) => void}} [options]
 * @returns {{observe: (event: {type?: string, name?: unknown, id?: unknown, args?: unknown}) => void, claim: (paramsHash: string) => Promise<string>}}
 * @example const calls = createOpenCodeActivityCalls(); adapter.on('event', calls.observe); await calls.claim(hash) // 'call_abc'
 */
function createOpenCodeActivityCalls({waitMs = CLAIM_WAIT_MS, log = () => {}} = {}) {
  /** @type {ObservedCall[]} */
  const calls = [];
  /** @type {Map<string, Array<(id: string) => void>>} */
  const waiting = new Map();

  function observe(event) {
    if (event?.type !== 'tool_start' || !ACTIVITY_TOOL_RE.test(String(event.name || ''))) return;
    const id = String(event.id || '');
    const hash = paramsHashOfToolInput(event.args);
    if (!id || !hash) return;
    const waiter = waiting.get(hash)?.shift();
    if (waiter) { waiter(id); return; }
    calls.push({hash, id});
    if (calls.length > MAX_CALLS) calls.shift();
  }

  /** @param {string} paramsHash @returns {Promise<string>} */
  function claim(paramsHash) {
    const index = calls.findIndex((call) => call.hash === paramsHash);
    if (index !== -1) return Promise.resolve(calls.splice(index, 1)[0].id);
    return new Promise((resolve) => {
      const list = waiting.get(paramsHash) || [];
      const timer = setTimeout(() => {
        list.splice(list.indexOf(done), 1);
        const minted = `opencode-mcp:${crypto.randomUUID()}`;
        log(JSON.stringify({level: 'warn', area: 'opencode', msg: 'atividade sem tool.called no prazo; id próprio', waitMs, toolCallId: minted}));
        resolve(minted);
      }, waitMs);
      /** @param {string} id */
      function done(id) { clearTimeout(timer); resolve(id); }
      list.push(done);
      waiting.set(paramsHash, list);
    });
  }

  return {observe, claim};
}

module.exports = {createOpenCodeActivityCalls, CLAIM_WAIT_MS};
