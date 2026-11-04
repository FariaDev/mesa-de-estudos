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
 * O cursor da próxima página, ou '' quando acabou.
 * @param {unknown} payload
 * @returns {string}
 * @example nextCursor({data: [], cursor: {next: 'c2'}}) // 'c2'
 */
function nextCursor(payload) {
  const cursor = isPlainObject(payload) ? /** @type {{cursor?: unknown}} */ (payload).cursor : null;
  const next = isPlainObject(cursor) ? /** @type {{next?: unknown}} */ (cursor).next : null;
  return typeof next === 'string' ? next : '';
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

/** Carimbo de parede em ms. 0 não é instante: vira duração de décadas contra `Date.now()`. */
function positiveStamp(value) {
  const stamp = Number(value);
  return Number.isFinite(stamp) && stamp > 0 ? stamp : 0;
}

/** @param {Record<string, any>} item */
function createdStamp(item) {
  const time = isPlainObject(item.time) ? item.time : {};
  return positiveStamp(time.created) || positiveStamp(item.timestamp);
}

function toolResultOf(part) {
  const state = isPlainObject(part.state) ? part.state : {};
  if (state.status !== 'completed' && state.status !== 'error') return null;
  const blocks = Array.isArray(state.content) ? state.content : [];
  const text = blocks.filter((block) => isPlainObject(block) && block.type === 'text' && typeof block.text === 'string').map((block) => block.text).join('\n');
  const result = {role: 'toolResult', toolCallId: String(part.id), toolName: String(part.name || ''), content: [{type: 'text', text}]};
  const time = isPlainObject(part.time) ? part.time : {};
  const stateTime = isPlainObject(state.time) ? state.time : {};
  const stamp = positiveStamp(time.completed) || positiveStamp(stateTime.completed) || positiveStamp(time.created) || positiveStamp(stateTime.created);
  if (stamp) result.timestamp = stamp;
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
 * A sessão na ordem em que as falas nasceram. O servidor devolve pela ordem do
 * id, e as conversas gravadas antes do id crescente (`opencode-ids.cjs`) têm a
 * fala do aluno com id aleatório: ela aparecia depois da resposta ao reabrir.
 * Item sem carimbo fica colado no anterior; empate mantém a ordem do servidor.
 * @param {unknown[]} list
 * @returns {unknown[]}
 * @example chronological([{id: 'b', time: {created: 2}}, {id: 'a', time: {created: 1}}]) // [a, b]
 */
function chronological(list) {
  let previous = 0;
  const keyed = list.map((item, index) => {
    const stamp = isPlainObject(item) ? createdStamp(item) : 0;
    if (stamp) previous = stamp;
    return {item, index, stamp: previous};
  });
  keyed.sort((left, right) => left.stamp - right.stamp || left.index - right.index);
  return keyed.map((entry) => entry.item);
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
  for (const raw of chronological(Array.isArray(list) ? list : [])) {
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
    const stamp = createdStamp(item);
    if (stamp) message.timestamp = stamp;
    out.push(message);
    if (role === 'assistant') out.push(...parts.filter((part) => part.type === 'tool' && part.id).map(toolResultOf).filter(Boolean));
  }
  return out;
}

const HISTORY_MAX_PAGES = 200;

/**
 * Todas as mensagens da sessão, seguindo o `cursor.next` da rota paginada.
 * Ler só a primeira página cortava as conversas longas ao reabrir; o teto
 * evita laço se o servidor repetir o cursor.
 * @param {(method: string, route: string, options?: {query?: Record<string, string>}) => Promise<{ok: boolean, payload: unknown}>} request
 * @param {string} route `/api/session/<id>/message`
 * @returns {Promise<unknown[]>}
 * @example await allMessages(http.request, '/api/session/ses_1/message')
 */
async function allMessages(request, route) {
  const items = [];
  /** @type {Record<string, string>} */
  let query = {order: 'asc'};
  for (let page = 0; page < HISTORY_MAX_PAGES; page += 1) {
    const response = await request('GET', route, {query});
    if (!response.ok) break;
    items.push(...messageList(response.payload));
    const next = nextCursor(response.payload);
    if (!next) break;
    query = {cursor: next};
  }
  return items;
}

module.exports = {allMessages, messageList, normalizeHistory, chronological, nextCursor};
