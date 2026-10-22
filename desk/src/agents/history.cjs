'use strict';

/* Histórico de conversa Claude → forma do renderer da Mesa (e exportação).
   Módulo puro (sem fs, sem IPC, sem relógio próprio): recebe o que o adaptador
   leu/transmitiu e devolve a forma que o diário/exportação já consomem.

   Contrato da forma normalizada (uma mensagem por item, ordem preservada):
     {role:'user'|'assistant'|'toolResult', content:[partes], timestamp?}
     {role:'toolResult', ..., toolCallId?, isError?}
   Partes:
     {type:'text', text}
     {type:'thinking', thinking}
     {type:'image', data, mimeType, source?}   ← base64 puro, como o
       `contentParts`/`attachments.bend` do renderer espera (`data:...;base64,`);
       a `source` do SDK (objeto) vira `data`+`mimeType` (strings); quando a
       origem já é uma referência string (nome de arquivo), ela fica em
       `source` — nunca sobra objeto aninhado no descritor.
     {type:'toolCall', id?, name?, arguments?, argumentsTruncated?}
     {type:'toolResult', toolCallId, text, isError}

   Aceita entradas cruas do SDK/CLI (com ou sem embrulho `message`, blocos
   `tool_use`/`tool_result`/`source`), mensagens já normalizadas (idempotente),
   array, objeto único, JSON e JSONL em string. Lixo é pulado; nada lança.

   Sem replay: isto é cache de exibição/exportação. O texto guardado nunca é
   reaplicado ao agente; retomar usa a sessão nativa pelo ID (descritor). Os
   tetos abaixo cortam a exibição (texto/tool) e descartam imagem fora do teto
   do envio — nunca alimentam o motor de volta.

   Exportação: mesmas linhas do export atual da Mesa (`## Você` / `## Pi`),
   com `## Claude` quando o motor é claude; `now` existe para o teste fixar a
   data (o host passa o relógio). Imagens saem como `[imagem anexada]`; partes
   de ferramenta não entram no markdown (o diário é que as mostra). */

const MAX_TEXT_CHARS = 400000;
const MAX_TOOL_CHARS = 200;
const MAX_ARGS_CHARS = 262144;
/* Teto do imagem persistida: o mesmo do envio validado (8 MiB crus → base64
   de ceil(n/3)*4 chars). O descritor inteiro também tem teto em conversations.cjs. */
const MAX_IMAGE_DATA_CHARS = Math.ceil((8 * 1024 * 1024) / 3) * 4;
const MAX_SOURCE_CHARS = 2000;
const MAX_CONTENT_PARTS = 200;
const MAX_DETAILS_CHARS = 20000;
const ROLES = {
  user: 'user',
  assistant: 'assistant',
  toolResult: 'toolResult',
  tool_result: 'toolResult',
  'tool-result': 'toolResult',
  tool: 'toolResult'
};

const {isPlainObject} = require('../../plain-object.cjs');
const str = (value) => typeof value === 'string' ? value : (typeof value === 'number' && Number.isFinite(value) ? String(value) : '');
const clip = (value, max) => value.length > max ? value.slice(0, max) : value;

/* Detalhe estruturado (`tool_use_result`/`details`): só JSON serializável dentro
   do teto; acima disso vira marcador — o cache de exibição nunca carrega objeto
   gigante nem prova de segurança. Idempotente (re-capar um marcador não muda). */
function detailsOf(value) {
  if (value === undefined) return undefined;
  try {
    const json = JSON.stringify(value);
    if (typeof json !== 'string') return undefined;
    if (json.length > MAX_DETAILS_CHARS) return {truncated: true, length: json.length};
    const parsed = JSON.parse(json);
    return parsed === null ? undefined : parsed;
  } catch {
    return undefined;
  }
}

/* ---------- entradas ---------- */

function entriesOf(raw) {
  if (typeof raw === 'string') {
    const text = raw.trim();
    if (!text) return [];
    try {
      const parsed = JSON.parse(text);
      return Array.isArray(parsed) ? parsed : (isPlainObject(parsed) ? entriesOf(parsed) : []);
    } catch {}
    const out = [];
    for (const line of text.split('\n')) {
      const item = line.trim();
      if (!item) continue;
      try {
        const parsed = JSON.parse(item);
        if (isPlainObject(parsed)) out.push(parsed);
      } catch {}
    }
    return out;
  }
  if (Array.isArray(raw)) return raw;
  if (isPlainObject(raw)) return Array.isArray(raw.messages) && !raw.role ? raw.messages : [raw];
  return [];
}

function blocksOf(content) {
  if (typeof content === 'string') return [{type: 'text', text: content}];
  if (Array.isArray(content)) return content;
  return [];
}

/* ---------- partes ---------- */

function imagePart(block) {
  const nested = isPlainObject(block.source) ? block.source : null;
  let data = str(nested ? nested.data : block.data);
  let mime = str(nested ? (nested.media_type || nested.mimeType) : (block.mimeType || block.mime));
  if (!data) return null;
  if (data.startsWith('data:')) {
    const match = /^data:([^;,]*);base64,([A-Za-z0-9+/=]*)$/.exec(data);
    if (!match) return null;
    mime = mime || match[1];
    data = match[2];
    if (!data) return null;
  }
  if (data.length > MAX_IMAGE_DATA_CHARS) return null;
  const part = {type: 'image', data, mimeType: clip(mime || 'image/png', 100)};
  const ref = typeof block.source === 'string' ? block.source : (typeof block.ref === 'string' ? block.ref : '');
  if (ref) part.source = clip(ref, MAX_SOURCE_CHARS);
  return part;
}

function argumentsOf(value) {
  if (value == null) return {};
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed == null ? {} : parsed;
    } catch {
      return {};
    }
  }
  return value;
}

function toolCallPart(block) {
  const part = {type: 'toolCall'};
  const id = clip(str(block.id), MAX_TOOL_CHARS);
  const name = clip(str(block.name), MAX_TOOL_CHARS);
  if (id) part.id = id;
  if (name) part.name = name;
  if (block.argumentsTruncated === true) {
    part.arguments = {};
    part.argumentsTruncated = true;
    return part;
  }
  const args = argumentsOf(block.arguments !== undefined ? block.arguments : block.input);
  let json = null;
  try {
    json = JSON.stringify(args);
  } catch {}
  if (json == null || json.length > MAX_ARGS_CHARS) {
    part.arguments = {};
    part.argumentsTruncated = true;
  } else {
    part.arguments = args;
  }
  return part;
}

function toolResultPart(block) {
  const toolCallId = clip(str(block.tool_use_id || block.toolCallId || block.id), MAX_TOOL_CHARS);
  let text = '';
  if (typeof block.content === 'string') text = block.content;
  else if (Array.isArray(block.content)) {
    text = block.content
      .map((item) => typeof item === 'string' ? item : str(item && item.text))
      .filter(Boolean)
      .join('\n');
  } else if (typeof block.text === 'string') text = block.text;
  return {
    type: 'toolResult',
    toolCallId,
    text: clip(text, MAX_TEXT_CHARS),
    isError: block.is_error === true || block.isError === true
  };
}

function partOf(block) {
  if (typeof block === 'string') return {type: 'text', text: clip(block, MAX_TEXT_CHARS)};
  if (!isPlainObject(block)) return null;
  const type = str(block.type);
  if (type === 'text') return {type: 'text', text: clip(str(block.text), MAX_TEXT_CHARS)};
  if (type === 'thinking') {
    const thinking = clip(str(block.thinking !== undefined ? block.thinking : block.text), MAX_TEXT_CHARS);
    return thinking ? {type: 'thinking', thinking} : null;
  }
  if (type === 'image') return imagePart(block);
  if (type === 'tool_use' || type === 'toolCall') return toolCallPart(block);
  if (type === 'tool_result' || type === 'toolResult') return toolResultPart(block);
  return null;
}

/* ---------- mensagens ---------- */

function timestampOf(entry, source) {
  for (const value of [source.timestamp, entry.timestamp, source.createdAt, source.created_at, entry.createdAt]) {
    const stamp = Number(value);
    if (Number.isFinite(stamp) && stamp > 0) return stamp;
  }
  return 0;
}

function messageOf(role, parts, timestamp) {
  const message = {role, content: parts.slice(0, MAX_CONTENT_PARTS)};
  if (timestamp) message.timestamp = timestamp;
  return message;
}

function toolResultMessage(result, timestamp, details) {
  const message = {
    role: 'toolResult',
    content: [{type: 'text', text: clip(str(result.text), MAX_TEXT_CHARS)}]
  };
  if (timestamp) message.timestamp = timestamp;
  if (str(result.toolCallId)) message.toolCallId = clip(str(result.toolCallId), MAX_TOOL_CHARS);
  if (result.isError === true) message.isError = true;
  const cap = details !== undefined ? detailsOf(details) : detailsOf(result.details);
  if (cap !== undefined) message.details = cap;
  return message;
}

function normalizeOne(entry) {
  const source = isPlainObject(entry.message) ? entry.message : entry;
  const role = ROLES[str(source.role || entry.role)];
  if (!role) return [];
  const timestamp = timestampOf(entry, source);
  const messageDetails = detailsOf(source.details !== undefined ? source.details : entry.details);
  const entryDetails = messageDetails !== undefined ? messageDetails : detailsOf(entry.tool_use_result);
  /* Forma direta de mensagem de resultado (`role:'toolResult'`): tudo é um
     resultado só. */
  if (role === 'toolResult') {
    const parts = [];
    const results = [];
    for (const block of blocksOf(source.content)) {
      const part = partOf(block);
      if (!part) continue;
      if (part.type === 'toolResult') results.push(part);
      else parts.push(part);
    }
    const id = clip(str(source.toolCallId || entry.toolCallId), MAX_TOOL_CHARS);
    const text = clip(parts.filter((part) => part.type === 'text').map((part) => part.text).join('\n'), MAX_TEXT_CHARS);
    const isError = source.isError === true || entry.isError === true || results.some((part) => part.isError === true);
    const out = [];
    if (text || id || isError || entryDetails !== undefined) {
      out.push(toolResultMessage({toolCallId: id, text, isError}, timestamp, entryDetails));
    }
    const singleResult = results.length === 1;
    for (const result of results) out.push(toolResultMessage(result, timestamp, singleResult ? entryDetails : undefined));
    return out;
  }
  /* Blocos na ORDEM de origem: texto/imagem/toolCall viram uma mensagem do
     papel; cada `tool_result` vira mensagem própria no ponto em que apareceu —
     nunca empurrado para o fim (é o que preserva a âncora do artefato). */
  const out = [];
  let pending = [];
  const blockCount = blocksOf(source.content).filter((block) => isPlainObject(block) && partOf(block)?.type === 'toolResult').length;
  const singleResult = blockCount === 1;
  const flush = () => {
    if (!pending.length) return;
    out.push(messageOf(role, pending, timestamp));
    pending = [];
  };
  for (const block of blocksOf(source.content)) {
    const part = partOf(block);
    if (!part) continue;
    if (part.type === 'toolResult') {
      flush();
      out.push(toolResultMessage(part, timestamp, singleResult ? entryDetails : undefined));
    } else {
      pending.push(part);
    }
  }
  flush();
  return out;
}

/* Bruto (SDK/CLI/descritor) → lista normalizada. Nunca lança; lixo não entra. */
function normalizeClaudeMessages(raw) {
  const out = [];
  for (const entry of entriesOf(raw)) {
    if (!isPlainObject(entry)) continue;
    for (const message of normalizeOne(entry)) out.push(message);
  }
  return out;
}

/* ---------- exportação ---------- */

/* Mesmo markdown do export atual da Mesa: cabeçalho + `## Você`/`## Pi`
   (`## Claude` no motor claude), texto trimado, imagem como `[imagem anexada]`.
   Mensagens sem texto/imagem não geram seção. */
/* Rótulos do arquivo exportado: a Mesa passa os do idioma da interface (#41);
   sem eles valem os de sempre, em português. */
const PT_EXPORT_LABELS = Object.freeze({
  you: 'Você',
  imageAttached: '[imagem anexada]',
  exportedOn: (iso) => `Exportado em ${iso}`,
});

/* Nome do motor no título de cada resposta exportada (#57: OpenCode). */
const EXPORT_ENGINE_NAMES = Object.freeze({claude: 'Claude', opencode: 'OpenCode'});

/**
 * @param {{courseName?: string, engine?: string, messages?: object[], now?: Date | number,
 *   labels?: {you: string, imageAttached: string, exportedOn: (iso: string) => string}}} [options]
 */
function exportConversationMarkdown({courseName, engine, messages, now, labels = PT_EXPORT_LABELS} = {}) {
  const date = now === undefined ? new Date() : new Date(now);
  const iso = Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
  const parts = [];
  for (const message of normalizeClaudeMessages(messages)) {
    if (message.role !== 'user' && message.role !== 'assistant') continue;
    let text = '';
    for (const part of message.content) {
      if (part.type === 'text') text += (text ? '\n' : '') + part.text;
      else if (part.type === 'image') text += (text ? '\n' : '') + labels.imageAttached;
    }
    if (!text.trim()) continue;
    parts.push(`## ${message.role === 'user' ? labels.you : (EXPORT_ENGINE_NAMES[engine] || 'Pi')}\n\n${text.trim()}`);
  }
  return `# Mesa de Estudos — ${String(courseName == null ? '' : courseName)}\n\n${labels.exportedOn(iso)}\n\n` + (parts.length ? parts.join('\n\n') + '\n' : '');
}

module.exports = {
  normalizeClaudeMessages,
  exportConversationMarkdown,
  MAX_TEXT_CHARS,
  MAX_TOOL_CHARS,
  MAX_ARGS_CHARS,
  MAX_IMAGE_DATA_CHARS,
  MAX_SOURCE_CHARS,
  MAX_CONTENT_PARTS
};
