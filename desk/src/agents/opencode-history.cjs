// @ts-check
'use strict';

/* Histórico do OpenCode v2 → mensagens de exibição da Mesa.
 * A rota real devolve `{data, cursor}`. O assistente traz `content`,
 * o usuário traz `text`. `parts` fica como fallback do contrato antigo. */

const {isPlainObject} = require('../../plain-object.cjs');

/**
 * A lista de mensagens da resposta (`{data, cursor}` ou lista crua).
 * @param {unknown} payload
 * @returns {unknown[]}
 * @example messageList({data: [m], cursor: {}}) // [m]
 */
function messageList(payload) {
  if (Array.isArray(payload)) return payload;
  const data = isPlainObject(payload) ? /** @type {{data?: unknown}} */ (payload).data : null;
  if (Array.isArray(data)) return data;
  return [];
}

/**
 * @typedef {{type?: unknown, text?: unknown, role?: unknown, id?: unknown, parts?: unknown, content?: unknown}} WireItem
 */

/** @param {WireItem} item @returns {WireItem[]} */
function partsOf(item) {
  if (Array.isArray(item.parts)) return item.parts;
  if (Array.isArray(item.content)) return item.content;
  return [];
}

/* Parte `tool` do v2 (`SessionMessageAssistantTool`): `{id, name, state:{status,
   input, content}}`. Vira `toolCall` no assistente e, quando terminou, uma
   mensagem `toolResult` com o mesmo id — o formato do Pi que o `historyTurns`
   pareia. Sem isso o quadro de `criar_atividade` sumia ao reabrir a conversa:
   o slot nasce da chamada no histórico. */
function toolCallOf(part) {
  const state = isPlainObject(part.state) ? part.state : {};
  const input = isPlainObject(state.input) ? state.input : {};
  return {type: 'toolCall', id: String(part.id), name: String(part.name || ''), arguments: input};
}

/** @param {Record<string, any>} part */
function toolResultOf(part) {
  const state = isPlainObject(part.state) ? part.state : {};
  if (state.status !== 'completed' && state.status !== 'error') return null;
  const blocks = Array.isArray(state.content) ? state.content : [];
  const text = blocks.filter((block) => isPlainObject(block) && block.type === 'text' && typeof block.text === 'string').map((block) => block.text).join('\n');
  const result = {role: 'toolResult', toolCallId: String(part.id), toolName: String(part.name || ''), content: [{type: 'text', text}]};
  return state.status === 'error' ? {...result, isError: true} : result;
}

/** @param {Record<string, any>} part @returns {{type: string, text?: string, thinking?: string}|null} */
function displayPartOf(part) {
  if (part.type === 'text' && typeof part.text === 'string' && part.text) return {type: 'text', text: part.text};
  if ((part.type === 'reasoning' || part.type === 'thinking') && typeof part.text === 'string' && part.text) return {type: 'thinking', thinking: part.text};
  if (part.type === 'tool' && typeof part.id === 'string' && part.id) return toolCallOf(part);
  return null;
}

/**
 * Mensagens do servidor → mensagens de exibição `{role, content, uuid}`; o
 * resultado de cada ferramenta vem logo depois, como `role: 'toolResult'`.
 * @param {unknown} list
 * @returns {Array<{role: 'user'|'assistant'|'toolResult', content: Array<{type: string, text?: string}>, uuid?: string, toolCallId?: string}>}
 * @example normalizeHistory([{id: 'msg_1', type: 'user', text: 'oi'}]) // [{role: 'user', content: [{type: 'text', text: 'oi'}], uuid: 'msg_1'}]
 */
function normalizeHistory(list) {
  const out = [];
  for (const raw of Array.isArray(list) ? list : []) {
    if (!isPlainObject(raw)) continue;
    const item = /** @type {WireItem} */ (raw);
    const role = item.role || (item.type === 'assistant' ? 'assistant' : item.type === 'user' ? 'user' : '');
    if (role !== 'user' && role !== 'assistant') continue;
    const parts = partsOf(item).filter(isPlainObject);
    const content = parts.map(displayPartOf).filter(Boolean);
    if (!content.length && typeof item.text === 'string' && item.text) content.push({type: 'text', text: item.text});
    if (!content.length) continue;
    const message = {role, content};
    if (item.id) message.uuid = String(item.id);
    out.push(message);
    if (role === 'assistant') out.push(...parts.filter((part) => part.type === 'tool' && part.id).map(toolResultOf).filter(Boolean));
  }
  return out;
}

module.exports = {messageList, normalizeHistory};
