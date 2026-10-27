'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {boundMessages} = require('./src/agents/conversations.cjs');
const {MAX_DRAFT} = require('./state-adapter.cjs');
const {message: uiMsg} = require('./src/i18n.mjs');

/* Chat lateral — limites e estados, envelope de contexto e texto de exibição,
   o store dos descritores (escrita atômica, índice, validação), refs de PDF,
   eventos e a listagem read-only das conversas da matéria.
   Saiu de sidechat.cjs na #43 fase 2; o gerenciador continua lá. */

const SCHEMA_VERSION = 1;
const ID_RE = /^sc-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const MAX_REFS = 2;
const MAX_PATH = 4096;
const MAX_PAGE = 100000;
const MAX_MESSAGE_ID = 200;
const MAX_DIALOG_IDS = 32;
const STATUS_BY_CORE = Object.freeze({
  Idle: 'idle',
  Transmitting: 'transmitting',
  Accepted: 'accepted',
  Settled: 'settled',
  Refused: 'refused',
  Uncertain: 'uncertain',
});
const CORE_BY_STATUS = Object.freeze(Object.fromEntries(Object.entries(STATUS_BY_CORE).map(([coreName, name]) => [name, coreName])));
const STATUSES = new Set(Object.values(STATUS_BY_CORE));
const {isPlainObject} = require('./plain-object.cjs');
const nowMs = (value) => (Number.isFinite(value) ? Math.trunc(value) : 0);
/* Envelope do bloco de contexto enviado ao motor: o digest começa por
   CONTEXT_START e o host fecha com CONTEXT_END antes da fala original. É o que
   permite exibir o histórico sem o bloco interno sem reescrever o descritor. */
const CONTEXT_START = '[Contexto do chat lateral]';
const CONTEXT_END = '[Fim do contexto do chat lateral]';
const CONTEXT_END_MARKER = `\n${CONTEXT_END}\n\n`;
/* Texto de exibição de uma fala do usuário: corta o envelope de contexto quando
   presente. Fora do envelope nada muda (o texto não é reescrito). */
function displayUserText(text) {
  if (typeof text !== 'string' || !text.startsWith(CONTEXT_START)) return text;
  const at = text.indexOf(CONTEXT_END_MARKER);
  return at === -1 ? text : text.slice(at + CONTEXT_END_MARKER.length);
}
/* Projeção de exibição do cache do motor. O Claude guarda no cache/descritor o
   texto que FOI ao motor (com o bloco de contexto); a UI recebe só a fala. A
   história nativa e o arquivo em disco ficam intactos — é cópia para payload. */
function displayMessages(messages) {
  return (Array.isArray(messages) ? messages : []).map((message) => {
    if (!isPlainObject(message) || message.role !== 'user' || !Array.isArray(message.content)) return message;
    return {
      ...message,
      content: message.content.map((part) =>
        isPlainObject(part) && part.type === 'text' && typeof part.text === 'string' ? {...part, text: displayUserText(part.text)} : part),
    };
  });
}
function fail(message) {
  throw Error(message);
}
function sidechatsDir(runtime) {
  return path.join(runtime, 'sidechats');
}
function descriptorPath(runtime, id) {
  return path.join(sidechatsDir(runtime), `${id}.json`);
}
function piSessionPath(runtime, id) {
  return path.join(sidechatsDir(runtime), `${id}.jsonl`);
}
function indexFile(runtime) {
  return path.join(sidechatsDir(runtime), 'index.json');
}
function writeAtomic(file, value) {
  const tmp = `${file}.tmp-${process.pid}-${crypto.randomBytes(4).toString('hex')}`;
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(tmp, JSON.stringify(value));
  try {
    fs.renameSync(tmp, file);
  } catch (error) {
    try {
      fs.unlinkSync(tmp);
    } catch {}
    throw error;
  }
}
const {readJson} = require('./json-file.cjs');
function readIndex(runtime) {
  const raw = readJson(indexFile(runtime));
  const mapping = isPlainObject(raw?.mapping) ? raw.mapping : {};
  const clean = {};
  for (const [session, id] of Object.entries(mapping)) {
    if (typeof session === 'string' && typeof id === 'string' && ID_RE.test(id)) clean[session] = id;
  }
  return clean;
}
function writeIndex(runtime, mapping) {
  writeAtomic(indexFile(runtime), {version: SCHEMA_VERSION, mapping});
}
function validContext(raw) {
  if (!isPlainObject(raw)) return null;
  if (typeof raw.mainSession !== 'string') return null;
  const refs = safeRefs(raw.refs);
  if (!refs) return null;
  if (!isPlainObject(raw.study)) return null;
  if (typeof raw.digest !== 'string' || raw.digest.length > 200000) return null;
  if (typeof raw.key !== 'string' || raw.key.length > 4000) return null;
  return {
    mainSession: raw.mainSession,
    refs,
    study: {title: String(raw.study.title || '').slice(0, 240), xopp: String(raw.study.xopp || '').slice(0, MAX_PATH)},
    at: nowMs(raw.at) || Date.now(),
    digest: raw.digest,
    key: raw.key,
  };
}
function validDelivery(raw) {
  if (raw === null || raw === undefined) return null;
  if (!isPlainObject(raw)) return null;
  if (typeof raw.id !== 'string' || !raw.id || raw.id.length > MAX_MESSAGE_ID) return null;
  if (!STATUSES.has(raw.status)) return null;
  return {id: raw.id, status: raw.status, at: nowMs(raw.at) || Date.now()};
}
/* Descritor válido (schema exato). Fora disso é null — nunca se adivinha. */
function validDescriptor(raw, id) {
  if (!isPlainObject(raw)) return false;
  if (raw.schemaVersion !== SCHEMA_VERSION || raw.id !== id) return false;
  if (!['pi', 'claude', 'opencode'].includes(raw.engine)) return false;
  if (typeof raw.mainSession !== 'string' || !raw.mainSession) return false;
  if (typeof raw.courseId !== 'string') return false;
  if (!Number.isFinite(raw.createdAt) || raw.createdAt < 0) return false;
  if (!Number.isFinite(raw.updatedAt) || raw.updatedAt < 0) return false;
  if (typeof raw.draft !== 'string' || raw.draft.length > MAX_DRAFT) return false;
  if (!Array.isArray(raw.messages)) return false;
  if (!validContext(raw.context)) return false;
  if (typeof raw.contextDeliveredKey !== 'string') return false;
  if (raw.engine === 'pi') {
    if (typeof raw.session !== 'string' || !raw.session) return false;
    if (raw.claude != null) return false;
  } else {
    if (typeof raw.claude !== 'string' || !raw.claude) return false;
    if (raw.session != null) return false;
  }
  if (raw.delivery !== null && raw.delivery !== undefined && !validDelivery(raw.delivery)) return false;
  return true;
}
function readDescriptorRaw(runtime, id) {
  if (typeof id !== 'string' || !ID_RE.test(id)) return null;
  const file = descriptorPath(runtime, id);
  let stat;
  try {
    stat = fs.statSync(file);
  } catch {
    return null;
  }
  if (!stat.isFile() || stat.size > 20 * 1024 * 1024) return null;
  const raw = readJson(file);
  if (!validDescriptor(raw, id)) return null;
  raw.context = validContext(raw.context);
  raw.delivery = validDelivery(raw.delivery);
  return raw;
}
function saveDescriptor(runtime, descriptor) {
  writeAtomic(descriptorPath(runtime, descriptor.id), descriptor);
}
/* Leitura tolerante para o descritor lido do disco: nunca lança (arquivo
   editado à mão vira "não é descritor", não derruba o IPC). */
function safeRefs(raw) {
  if (!Array.isArray(raw) || raw.length > MAX_REFS) return null;
  const out = [];
  for (const item of raw) {
    if (!isPlainObject(item) || typeof item.path !== 'string' || !item.path || item.path.length > MAX_PATH) return null;
    const page = item.page === undefined || item.page === null ? 1 : Math.trunc(Number(item.page));
    if (!Number.isFinite(page) || page < 1 || page > MAX_PAGE) return null;
    out.push({path: item.path, page});
  }
  return out;
}
/* Validação estrita da entrada do IPC (referências do renderer): erro claro. */
function normalizeRefs(raw) {
  if (raw == null) return [];
  if (!Array.isArray(raw)) fail('Referências inválidas: envie uma lista de páginas.');
  if (raw.length > MAX_REFS) fail(uiMsg('err.sidechat.refsMax'));
  const out = [];
  for (const item of raw) {
    if (!isPlainObject(item) || typeof item.path !== 'string' || !item.path) fail(uiMsg('err.ref.reselect'));
    if (item.path.length > MAX_PATH) fail('Referência inválida: caminho grande demais.');
    const page = item.page === undefined || item.page === null ? 1 : Math.trunc(Number(item.page));
    if (!Number.isFinite(page) || page < 1 || page > MAX_PAGE) fail(uiMsg('err.sidechat.refRange'));
    out.push({path: item.path, page});
  }
  return out;
}
const DISPLAY_ROLES = new Set(['user', 'assistant', 'toolResult']);
/* Mensagens de exibição do Pi entram na ordem em que chegam. Nada de dedupe por
   igualdade: duas respostas idênticas seguidas são legítimas (o mesmo pedido
   repetido) e o RPC emite um `message_end` por mensagem. O teto do descritor
   corta do começo. */
function appendMessage(descriptor, message) {
  if (!isPlainObject(message) || !DISPLAY_ROLES.has(message.role)) return false;
  const list = Array.isArray(descriptor.messages) ? descriptor.messages : [];
  list.push(message);
  descriptor.messages = boundMessages(list);
  return true;
}
/* Mapeia a lista que o main já monta (`courseSessions`) para o contrato da UI:
   nada de I/O, nada de agente — só o que já foi lido. */
function conversationList(sessions, {max = 100} = {}) {
  return (Array.isArray(sessions) ? sessions : [])
    .slice(0, Math.max(0, max))
    .map((session) => ({
      id: String(session?.path || ''),
      title: String(session?.label || ''),
      preview: String(session?.preview || '').slice(0, 200),
      at: nowMs(session?.started),
      engine: session?.engine === 'claude' ? 'claude' : 'pi',
    }))
    .filter((entry) => entry.id);
}

module.exports = {SCHEMA_VERSION, ID_RE, MAX_MESSAGE_ID, MAX_DIALOG_IDS, STATUS_BY_CORE, CORE_BY_STATUS, isPlainObject, nowMs, CONTEXT_END_MARKER, displayUserText, displayMessages, fail, sidechatsDir, descriptorPath, piSessionPath, readIndex, writeIndex, validDescriptor, readDescriptorRaw, saveDescriptor, normalizeRefs, appendMessage, conversationList};
