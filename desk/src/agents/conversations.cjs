'use strict';

const deliveryCore = require('../generated/agentdelivery.core.js').default;

/* Registro de conversa Claude da Mesa: um descritor JSON REAL por conversa em
   `runtime/conversations/claude-<uuid>.json`. A identidade que a UI/fila/estado
   usam é o CAMINHO desse arquivo — o mesmo `session` de hoje. Pi continua JSONL
   exatamente como está; este módulo nunca lê nem escreve JSONL.

   Descritor (schemaVersion 1):
     {
       schemaVersion: 1,
       engine: 'claude',
       id: '<uuid>',                 // = nome do arquivo (claude-<uuid>.json)
       nativeSessionId: '<uuid>',    // separado e explícito; criado uma vez
       nativeEstablished: false,     // só true depois de init/replay do nativo
       courseId: '<string>',
       started: <epoch ms>,
       preview: '<string>',
       model?: '<string>',
       pinnedExecutable?: '<caminho>',
       delivery?: {id, status: 'transmitting'|'accepted'|'settled'|'uncertain'|'refused'},
       messages?: [normalizado por history.cjs, para exibição offline]
     }

   Regras:
   - `nativeSessionId` precriado NÃO autoriza retomar: retomar só quando
     `nativeEstablished` for true (o adaptador marca depois do init/replay).
     Um envio novo que falhou depois de possível transmissão é detectado pelo
     adaptador/entrega — aqui só se guarda o estado.
   - `messages` é cache de exibição limitado (~12 MiB); o teto corta do começo
     (mais antigas) e NUNCA encolhe `delivery`/metadados de incerteza.
   - Toda escrita é atômica (tmp + rename); em falha/entrada inválida o arquivo
     anterior fica byte a byte. `create` usa link exclusivo (nunca sobrescreve).
   - `read`/`conversationEngine` com `runtime` resolvem realpath e recusam
     escape de symlink para fora de `runtime/conversations`.

   I/O puro e síncrono: sem IPC, DOM, relógio além do `started` e processos. */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const history = require('./history.cjs');

const SCHEMA_VERSION = 1;
const ENGINE_CLAUDE = 'claude';
const ENGINE_PI = 'pi';
const CONVERSATIONS_DIR = 'conversations';
const CORRUPT_DESCRIPTOR_CODE = 'CLAUDE_DESCRIPTOR_INVALID';
const PATCH_ERROR_CODE = 'CLAUDE_DESCRIPTOR_PATCH';
const DELIVERY_STATUSES = Object.freeze(['transmitting', 'accepted', 'settled', 'uncertain', 'refused']);

const MAX_MESSAGES_BYTES = 12 * 1024 * 1024;
/* Folga para o metadado que nunca é cortado pelo teto de `messages`. */
const MAX_DESCRIPTOR_BYTES = 13 * 1024 * 1024;
const MAX_COURSE_ID = 400;
const MAX_PREVIEW = 4000;
const MAX_MODEL = 400;
const MAX_PATH = 4096;
const MAX_DELIVERY_ID = 200;
const MAX_MESSAGE_COUNT = 5000;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const DESCRIPTOR_RE = /^claude-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.json$/;

const isPlainObject = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
const bytes = (value) => Buffer.byteLength(JSON.stringify(value));
const isUuid = (value) => typeof value === 'string' && UUID_RE.test(value);
const boundedString = (value, max) => typeof value === 'string' && value.length <= max;

function patchError(message) {
  const error = new Error(message);
  error.code = PATCH_ERROR_CODE;
  return error;
}

function corruptError(file) {
  const error = new Error(`Descritor de conversa Claude inválido: ${file}`);
  error.code = CORRUPT_DESCRIPTOR_CODE;
  return error;
}

function conversationsDir(runtime) {
  return path.join(runtime, CONVERSATIONS_DIR);
}

function descriptorName(id) {
  return `claude-${id}.json`;
}

function descriptorPath(runtime, id) {
  return path.join(conversationsDir(runtime), descriptorName(id));
}

/* Nome gerenciado (claude-<uuid>.json) → uuid; qualquer outro arquivo é Pi. */
function managedUuid(file) {
  if (typeof file !== 'string' || !file) return null;
  const match = DESCRIPTOR_RE.exec(path.basename(file));
  return match ? match[1].toLowerCase() : null;
}

function insideConversations(file, runtime) {
  const dir = path.resolve(runtime, CONVERSATIONS_DIR);
  const target = path.resolve(file);
  return target !== dir && target.startsWith(dir + path.sep);
}

/* Contenção por realpath: symlink para fora de runtime/conversations não passa. */
function realInside(file, runtime) {
  try {
    const dir = fs.realpathSync(path.resolve(runtime, CONVERSATIONS_DIR));
    return fs.realpathSync(file).startsWith(dir + path.sep);
  } catch {
    return false;
  }
}

/* ---------- validação (fonte única dos tetos em history.cjs) ---------- */

function validatePart(part) {
  if (!isPlainObject(part)) return false;
  if (part.type === 'text') return typeof part.text === 'string' && part.text.length <= history.MAX_TEXT_CHARS;
  if (part.type === 'thinking') return typeof part.thinking === 'string' && part.thinking.length <= history.MAX_TEXT_CHARS;
  if (part.type === 'image') {
    if (typeof part.data !== 'string' || !part.data || part.data.length > history.MAX_IMAGE_DATA_CHARS) return false;
    if (typeof part.mimeType !== 'string' || part.mimeType.length > 100) return false;
    if (part.source !== undefined && (typeof part.source !== 'string' || part.source.length > history.MAX_SOURCE_CHARS)) return false;
    return true;
  }
  if (part.type === 'toolCall') {
    if (part.id !== undefined && (typeof part.id !== 'string' || part.id.length > history.MAX_TOOL_CHARS)) return false;
    if (part.name !== undefined && (typeof part.name !== 'string' || part.name.length > history.MAX_TOOL_CHARS)) return false;
    if (part.arguments !== undefined) {
      try {
        if (JSON.stringify(part.arguments).length > history.MAX_ARGS_CHARS) return false;
      } catch {
        return false;
      }
    }
    if (part.argumentsTruncated !== undefined && part.argumentsTruncated !== true) return false;
    return true;
  }
  if (part.type === 'toolResult') {
    if (part.toolCallId !== undefined && (typeof part.toolCallId !== 'string' || part.toolCallId.length > history.MAX_TOOL_CHARS)) return false;
    if (part.text !== undefined && (typeof part.text !== 'string' || part.text.length > history.MAX_TEXT_CHARS)) return false;
    if (part.isError !== undefined && typeof part.isError !== 'boolean') return false;
    return true;
  }
  return false;
}

function validateMessage(message) {
  if (!isPlainObject(message)) return false;
  if (message.role !== 'user' && message.role !== 'assistant' && message.role !== 'toolResult') return false;
  if (!Array.isArray(message.content) || message.content.length > history.MAX_CONTENT_PARTS) return false;
  if (message.timestamp !== undefined && !(Number.isFinite(message.timestamp) && message.timestamp > 0)) return false;
  if (message.toolCallId !== undefined && (typeof message.toolCallId !== 'string' || message.toolCallId.length > history.MAX_TOOL_CHARS)) return false;
  if (message.isError !== undefined && typeof message.isError !== 'boolean') return false;
  for (const part of message.content) if (!validatePart(part)) return false;
  return true;
}

function validateMessages(messages) {
  if (!Array.isArray(messages) || messages.length > MAX_MESSAGE_COUNT) return false;
  if (messages.length && bytes(messages) > MAX_MESSAGES_BYTES) return false;
  for (const message of messages) if (!validateMessage(message)) return false;
  return true;
}

function validateDelivery(delivery) {
  return isPlainObject(delivery)
    && boundedString(delivery.id, MAX_DELIVERY_ID)
    && delivery.id.length > 0
    && DELIVERY_STATUSES.includes(delivery.status);
}

/* Descritor válido (schema exato). Fora disso é null — nunca Pi silencioso. */
function validDescriptor(raw, uuid) {
  if (!isPlainObject(raw)) return false;
  if (raw.schemaVersion !== SCHEMA_VERSION) return false;
  if (raw.engine !== ENGINE_CLAUDE) return false;
  if (!isUuid(raw.id) || raw.id.toLowerCase() !== uuid.toLowerCase()) return false;
  if (!isUuid(raw.nativeSessionId)) return false;
  if (typeof raw.nativeEstablished !== 'boolean') return false;
  if (!boundedString(raw.courseId, MAX_COURSE_ID)) return false;
  if (!Number.isFinite(raw.started) || raw.started < 0) return false;
  if (!boundedString(raw.preview, MAX_PREVIEW)) return false;
  if (raw.model !== undefined && !boundedString(raw.model, MAX_MODEL)) return false;
  if (raw.effort !== undefined && !boundedString(raw.effort, 24)) return false;
  if (raw.pinnedExecutable !== undefined && !boundedString(raw.pinnedExecutable, MAX_PATH)) return false;
  if (raw.delivery !== undefined && !validateDelivery(raw.delivery)) return false;
  if (raw.messages !== undefined && !validateMessages(raw.messages)) return false;
  return true;
}

/* ---------- leitura ---------- */

function readClaudeConversation(file, {runtime} = {}) {
  const uuid = managedUuid(file);
  if (!uuid) return null;
  const base = typeof runtime === 'string' && runtime ? runtime : '';
  if (base) {
    if (!insideConversations(file, base)) return null;
    if (!realInside(file, base)) return null;
  }
  let stat;
  try {
    stat = fs.statSync(file);
  } catch {
    return null;
  }
  if (!stat.isFile() || stat.size > MAX_DESCRIPTOR_BYTES) return null;
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
  return validDescriptor(raw, uuid) ? raw : null;
}

/* ---------- escrita ---------- */

function writeDescriptorAtomic(file, descriptor) {
  const payload = JSON.stringify(descriptor);
  const tmp = `${file}.tmp-${process.pid}-${crypto.randomBytes(4).toString('hex')}`;
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(tmp, payload);
  try {
    fs.renameSync(tmp, file);
  } catch (error) {
    try {
      fs.unlinkSync(tmp);
    } catch {}
    throw error;
  }
}

/* Publica o tmp sem sobrescrever: link exclusivo e, onde o sistema não deixar
   criar hard link (ex.: alguns volumes no Windows), `wx` também é exclusivo. */
function publishExclusive(tmp, file, payload) {
  try {
    fs.linkSync(tmp, file);
    return 'linked';
  } catch (error) {
    if (error && error.code === 'EEXIST') return 'exists';
    fs.writeFileSync(file, payload, {flag: 'wx'});
    return 'created';
  }
}

/* Cria o descritor sem sobrescrever nada: escreve um tmp e publica com link
   exclusivo (EEXIST → tenta outro id). Devolve o CAMINHO do arquivo. */
function createClaudeConversation({runtime, courseId, model, effort} = {}) {
  if (typeof runtime !== 'string' || !runtime) throw new Error('runtime obrigatório para criar conversa Claude.');
  if (effort !== undefined && !boundedString(effort, 24)) throw new Error('effort inválido.');
  const dir = conversationsDir(runtime);
  fs.mkdirSync(dir, {recursive: true});
  const course = typeof courseId === 'string' ? courseId.slice(0, MAX_COURSE_ID) : '';
  for (let attempt = 0; attempt < 8; attempt++) {
    const id = crypto.randomUUID();
    const file = path.join(dir, descriptorName(id));
    const descriptor = {
      schemaVersion: SCHEMA_VERSION,
      engine: ENGINE_CLAUDE,
      id,
      nativeSessionId: crypto.randomUUID(),
      nativeEstablished: false,
      courseId: course,
      started: Date.now(),
      preview: ''
    };
    if (typeof model === 'string' && model) descriptor.model = model.slice(0, MAX_MODEL);
    if (effort !== undefined) descriptor.effort = effort;
    const payload = JSON.stringify(descriptor);
    const tmp = `${file}.tmp-${process.pid}-${crypto.randomBytes(4).toString('hex')}`;
    fs.writeFileSync(tmp, payload);
    try {
      const published = publishExclusive(tmp, file, payload);
      try {
        fs.unlinkSync(tmp);
      } catch {}
      if (published === 'exists') continue;
      return file;
    } catch (error) {
      try {
        fs.unlinkSync(tmp);
      } catch {}
      if (error && error.code === 'EEXIST') continue;
      throw error;
    }
  }
  throw new Error('não foi possível reservar um arquivo de conversa Claude.');
}

/* Mescla campos permitidos; `null` remove opcionais. Qualquer outra chave
   (id, engine, schemaVersion, path, file, runtime…) é ignorada. Em falha de
   validação/escrita o descritor anterior fica intacto. */
function updateClaudeConversation(file, patch, {runtime} = {}) {
  if (!isPlainObject(patch)) throw patchError('patch da conversa Claude precisa ser um objeto.');
  const current = readClaudeConversation(file, {runtime});
  if (!current) {
    if (managedUuid(file) && fs.existsSync(file)) throw corruptError(file);
    return null;
  }
  const next = {...current};
  if (Object.hasOwn(patch, 'nativeSessionId')) {
    if (!isUuid(patch.nativeSessionId)) throw patchError('nativeSessionId inválido.');
    if (!deliveryCore.sameNativeIdentity(current.nativeSessionId, patch.nativeSessionId)) throw patchError('nativeSessionId é imutável; comece outra conversa para usar outra sessão nativa.');
  }
  if (Object.hasOwn(patch, 'nativeEstablished')) {
    if (typeof patch.nativeEstablished !== 'boolean') throw patchError('nativeEstablished precisa ser booleano.');
    next.nativeEstablished = patch.nativeEstablished;
  }
  if (Object.hasOwn(patch, 'courseId')) {
    if (!boundedString(patch.courseId, MAX_COURSE_ID)) throw patchError('courseId inválido.');
    next.courseId = patch.courseId;
  }
  if (Object.hasOwn(patch, 'started')) {
    if (!Number.isFinite(patch.started) || patch.started < 0) throw patchError('started inválido.');
    next.started = patch.started;
  }
  if (Object.hasOwn(patch, 'preview')) {
    if (!boundedString(patch.preview, MAX_PREVIEW)) throw patchError('preview inválido.');
    next.preview = patch.preview;
  }
  if (Object.hasOwn(patch, 'model')) {
    if (patch.model === null) delete next.model;
    else if (!boundedString(patch.model, MAX_MODEL)) throw patchError('model inválido.');
    else next.model = patch.model;
  }
  if (Object.hasOwn(patch, 'effort')) {
    if (patch.effort === null) delete next.effort;
    else if (!boundedString(patch.effort, 24)) throw patchError('effort inválido.');
    else next.effort = patch.effort;
  }
  if (Object.hasOwn(patch, 'pinnedExecutable')) {
    if (patch.pinnedExecutable === null) delete next.pinnedExecutable;
    else if (!boundedString(patch.pinnedExecutable, MAX_PATH)) throw patchError('pinnedExecutable inválido.');
    else next.pinnedExecutable = patch.pinnedExecutable;
  }
  if (Object.hasOwn(patch, 'delivery')) {
    if (patch.delivery === null) delete next.delivery;
    else if (!validateDelivery(patch.delivery)) throw patchError('delivery inválido.');
    else next.delivery = {id: patch.delivery.id, status: patch.delivery.status};
  }
  if (Object.hasOwn(patch, 'messages')) {
    if (patch.messages === null) delete next.messages;
    else if (!Array.isArray(patch.messages)) throw patchError('messages precisa ser uma lista normalizada.');
    else {
      const messages = boundMessages(history.normalizeClaudeMessages(patch.messages));
      if (messages.length) next.messages = messages;
      else delete next.messages;
    }
  }
  if (!validDescriptor(next, managedUuid(file))) throw patchError('patch produziria um descritor inválido.');
  writeDescriptorAtomic(file, next);
  return next;
}

/* Teto de `messages`: mantém as mais novas; corta do começo. Metadados de
   entrega/incerteza ficam fora dessa conta e nunca são cortados. */
function boundMessages(messages) {
  const list = (Array.isArray(messages) ? messages : []).slice(-MAX_MESSAGE_COUNT);
  // Array framing is two brackets plus one comma between each row. Count
  // UTF-8 bytes from newest to oldest without reserializing large images for
  // every discarded prefix row. The retained suffix has the same byte cap.
  let total = 2, start = list.length;
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const rowBytes = Buffer.byteLength(JSON.stringify(list[i]) ?? 'null', 'utf8');
    const next = total + rowBytes + (start < list.length ? 1 : 0);
    if (next > MAX_MESSAGES_BYTES) break;
    total = next;
    start = i;
  }
  return list.slice(start);
}

/* ---------- classificação/metadados ---------- */

/* 'claude' só para descritor válido; qualquer outra coisa é 'pi'. Um arquivo
   de nome gerenciado que existe e não valida LANÇA (nunca vira Pi calado);
   ausente não é descritor e cai no fallback Pi. */
function conversationEngine(file, {runtime} = {}) {
  const uuid = managedUuid(file);
  if (!uuid) return ENGINE_PI;
  const base = typeof runtime === 'string' && runtime ? runtime : '';
  if (base && !insideConversations(file, base)) return ENGINE_PI;
  if (readClaudeConversation(file, {runtime: base})) return ENGINE_CLAUDE;
  if (fs.existsSync(file)) throw corruptError(file);
  return ENGINE_PI;
}

/* Só o nome do arquivo Pi (`pi-<digits>.jsonl`); nunca abre o JSONL nativo. */
function startedFromPiPath(file) {
  const match = /^pi-(\d+)\.jsonl$/.exec(path.basename(typeof file === 'string' ? file : ''));
  if (!match) return 0;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : 0;
}

function conversationMetadata(file, {runtime} = {}) {
  const engine = conversationEngine(file, {runtime});
  if (engine === ENGINE_CLAUDE) {
    const descriptor = readClaudeConversation(file, {runtime});
    return {
      engine: ENGINE_CLAUDE,
      id: descriptor.id,
      started: descriptor.started,
      preview: descriptor.preview,
      nativeSessionId: descriptor.nativeSessionId,
      nativeEstablished: descriptor.nativeEstablished,
      courseId: descriptor.courseId,
      model: descriptor.model ?? null,
      effort: descriptor.effort ?? null,
      pinnedExecutable: descriptor.pinnedExecutable ?? null,
      delivery: descriptor.delivery ? {id: descriptor.delivery.id, status: descriptor.delivery.status} : null,
      messageCount: Array.isArray(descriptor.messages) ? descriptor.messages.length : 0
    };
  }
  return {
    engine: ENGINE_PI,
    id: null,
    started: startedFromPiPath(file),
    preview: '',
    nativeSessionId: null,
    nativeEstablished: false,
    courseId: null,
    model: null,
    effort: null,
    pinnedExecutable: null,
    delivery: null,
    messageCount: 0
  };
}

/* Recuperação de abertura: qualquer entrega em voo (transmitting/accepted)
   vira `uncertain` — pode ter chegado e NUNCA é reenviada sozinha. Estados
   terminais (settled/refused) e conversas sem entrega ficam como estão. */
function recoverClaudeConversation(file, {runtime} = {}) {
  const current = readClaudeConversation(file, {runtime});
  if (!current) {
    if (managedUuid(file) && fs.existsSync(file)) throw corruptError(file);
    return null;
  }
  const status = current.delivery?.status;
  if (status === 'transmitting' || status === 'accepted') {
    return updateClaudeConversation(file, {delivery: {id: current.delivery.id, status: 'uncertain'}}, {runtime});
  }
  return current;
}

module.exports = {
  SCHEMA_VERSION,
  ENGINE_CLAUDE,
  ENGINE_PI,
  CONVERSATIONS_DIR,
  CORRUPT_DESCRIPTOR_CODE,
  DELIVERY_STATUSES,
  MAX_MESSAGES_BYTES,
  boundMessages,
  createClaudeConversation,
  readClaudeConversation,
  updateClaudeConversation,
  conversationEngine,
  conversationMetadata,
  recoverClaudeConversation,
  descriptorPath
};
