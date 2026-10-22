'use strict';

/* Transcrição do ClaudeAdapter: blocos do assistente, resumo de ferramenta,
   histórico nativo, uso de tokens e junção com o prefixo importado. Saiu do
   claude-adapter.cjs na #43 fase 2. */

const {MAX_TOOL_RESULT_CHARS, MAX_TOOL_DETAILS_CHARS, MAX_HISTORY_BYTES, MAX_PRIOR_MESSAGES} = require('./claude-adapter-contract.cjs');

function normalizeAssistantBlocks(content) {
  const blocks = typeof content === 'string' ? [{type: 'text', text: content}] : Array.isArray(content) ? content : [];
  const out = [];
  for (const block of blocks) {
    if (!block || typeof block !== 'object') continue;
    if (block.type === 'text' && typeof block.text === 'string') out.push({type: 'text', text: block.text});
    else if (block.type === 'thinking' && typeof block.thinking === 'string') out.push({type: 'thinking', text: block.thinking});
    else if (block.type === 'redacted_thinking') out.push({type: 'thinking', text: '[pensamento omitido]'});
    else if (block.type === 'tool_use') {
      out.push({type: 'toolCall', id: String(block.id || ''), name: String(block.name || ''), arguments: block.input && typeof block.input === 'object' ? block.input : {}});
    }
  }
  return out;
}

/* Detalhes estruturados (`tool_use_result` do SDK) para a UI/histórico.
   Guarda só JSON serializável dentro do teto; acima disso vira um marcador —
   nada de objeto gigante atravessando o IPC ou o cache. */
function capToolDetails(value) {
  if (value === undefined) return undefined;
  try {
    const json = JSON.stringify(value);
    if (typeof json !== 'string') return undefined;
    if (json.length > MAX_TOOL_DETAILS_CHARS) return {truncated: true, length: json.length};
    const parsed = JSON.parse(json);
    return parsed === null ? undefined : parsed;
  } catch {
    return undefined;
  }
}

/* Chave de dedupe de um quadro assistente SEM `uuid`: usa o conteúdo normalizado
   junto do `message.id` — quadro repetido byte a byte deduplica, blocos
   distintos com o mesmo `message.id` NÃO. */
function assistantFrameKey(message) {
  const id = typeof message?.message?.id === 'string' ? message.message.id : '';
  let json;
  try {
    json = JSON.stringify(normalizeAssistantBlocks(message?.message?.content));
  } catch {
    json = '';
  }
  return `${id}|${json.length > 4096 ? json.slice(0, 4096) : json}`;
}

function summarizeToolResult(content, maxChars = MAX_TOOL_RESULT_CHARS) {
  let text;
  if (typeof content === 'string') text = content;
  else if (Array.isArray(content)) {
    text = content.map((block) => {
      if (block?.type === 'text' && typeof block.text === 'string') return block.text;
      if (block?.type === 'image') return '[imagem]';
      return block?.type ? `[${block.type}]` : '';
    }).filter(Boolean).join('\n');
  } else {
    text = '';
  }
  if (text.length > maxChars) {
    text = `${text.slice(0, maxChars)}\n… [saída truncada em ${maxChars} de ${text.length} caracteres]`;
  }
  return text;
}

/* Parte de conteúdo do histórico nativo; `tool_result` NÃO entra aqui (vira
   mensagem própria, na posição original). */
function historyPartOf(block) {
  if (block.type === 'text' && typeof block.text === 'string') return {type: 'text', text: block.text};
  if (block.type === 'image' && block.source?.type === 'base64' && typeof block.source.data === 'string') {
    return {type: 'image', data: block.source.data, mimeType: String(block.source.media_type || '')};
  }
  if (block.type === 'tool_use') {
    return {type: 'toolCall', id: String(block.id || ''), name: String(block.name || ''), arguments: block.input && typeof block.input === 'object' ? block.input : {}};
  }
  return null;
}

/* Tradução do histórico nativo (SessionMessage[]) para o formato da Mesa:
   [{role, content:[...]}] com `role:'toolResult'` no lugar em que o resultado
   aconteceu (o renderer pareia por `toolCallId` e o diário recupera a ordem).
   Subagente é ignorado; nenhuma ferramenta é reexecutada. O teto de bytes é
   explícito: `onTruncate` é chamado quando uma mensagem fica de fora (nunca
   truncar em silêncio). */
function normalizeHistory(sessionMessages, {maxBytes = MAX_HISTORY_BYTES, onTruncate = null} = {}) {
  const out = [];
  let bytes = 0;
  const over = () => {
    if (typeof onTruncate === 'function') {
      onTruncate({reason: 'bytes', kept: out.length, total: (sessionMessages || []).length, maxBytes});
    }
  };
  for (const entry of sessionMessages || []) {
    if (!entry || typeof entry !== 'object') continue;
    if (entry.parent_tool_use_id != null || entry.parent_agent_id != null) continue;
    if (entry.type !== 'user' && entry.type !== 'assistant') continue;
    const raw = entry.message;
    const blocks = typeof raw === 'string'
      ? [{type: 'text', text: raw}]
      : Array.isArray(raw?.content) ? raw.content : [];
    const resultBlocks = blocks.filter((block) => block && typeof block === 'object' && block.type === 'tool_result');
    const details = resultBlocks.length === 1 ? capToolDetails(entry.tool_use_result) : undefined;
    /* Mantém a ordem DENTRO da mensagem: uma sequência de partes vira uma
       mensagem `entry.type`; cada `tool_result` vira mensagem `toolResult` no
       ponto em que aparece (não tudo empurrado para o fim). */
    const ordered = [];
    let content = [];
    const flush = () => {
      if (!content.length) return;
      ordered.push({role: entry.type, content});
      content = [];
    };
    let resultSeen = 0;
    for (const block of blocks) {
      if (!block || typeof block !== 'object') continue;
      if (block.type === 'tool_result' && entry.type === 'user') {
        flush();
        resultSeen += 1;
        const text = summarizeToolResult(block.content);
        const message = {role: 'toolResult', content: [{type: 'text', text}]};
        if (typeof block.tool_use_id === 'string' && block.tool_use_id) message.toolCallId = block.tool_use_id;
        if (block.is_error === true) message.isError = true;
        if (details !== undefined && resultSeen === 1) message.details = details;
        ordered.push(message);
        continue;
      }
      const part = historyPartOf(block);
      if (part) content.push(part);
    }
    flush();
    let truncated = false;
    for (const message of ordered) {
      const size = Buffer.byteLength(JSON.stringify(message), 'utf8');
      if (bytes + size > maxBytes) {
        over();
        truncated = true;
        break;
      }
      bytes += size;
      out.push(message);
    }
    if (truncated) break;
  }
  return out;
}

/* Uso nativo do provedor (BetaUsage do SDK) → forma que o host já consome
   (`input`/`output`/`cacheRead`/`cacheWrite`). Só métrica reportada como
   número finito e não negativo entra: ausente/nulo fica de fora (a estatística
   registra "indisponível", nunca zero inventado) e 0 REAL continua 0. O par
   de cache sai SEPARADO — quem soma cacheRead+cacheWrite é o host, então nada
   é pré-somado aqui (pré-somar duplicaria a conta). */
function normalizeUsage(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const pick = (value) => (typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null);
  const input = pick(raw.input_tokens);
  const output = pick(raw.output_tokens);
  const cacheRead = pick(raw.cache_read_input_tokens);
  const cacheWrite = pick(raw.cache_creation_input_tokens);
  if (input == null && output == null && cacheRead == null && cacheWrite == null) return null;
  const usage = {};
  if (input != null) usage.input = input;
  if (output != null) usage.output = output;
  if (cacheRead != null) usage.cacheRead = cacheRead;
  if (cacheWrite != null) usage.cacheWrite = cacheWrite;
  return usage;
}

/* Prefixo importado que o host manda preservar (ex.: transcrição que só foi ao
   system prompt do primeiro turno). O descritor já valida o conteúdo; aqui só
   se exige a forma normalizada e se aplica um teto defensivo SEM cortar o
   começo — o prefixo antigo é justamente o que precisa sobreviver. */
function normalizePriorMessages(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const message of list) {
    if (out.length >= MAX_PRIOR_MESSAGES) break;
    if (!message || typeof message !== 'object' || Array.isArray(message)) continue;
    if (message.role !== 'user' && message.role !== 'assistant' && message.role !== 'toolResult') continue;
    if (!Array.isArray(message.content)) continue;
    out.push({...message, role: message.role, content: [...message.content]});
  }
  return out;
}

/* Forma canônica de UMA parte, só para comparar histórico de origens
   diferentes (o descritor guarda `thinking`; o histórico nativo não o expõe
   por `normalizeHistory`; imagem pode trazer `source`). Pensamento NÃO entra
   na impressão digital: o texto/toolCall visível é o que identifica a
   mensagem nas duas origens. Não é o que vai para a tela. */
function canonicalPart(part) {
  if (!part || typeof part !== 'object' || Array.isArray(part)) return null;
  if (part.type === 'text' && typeof part.text === 'string') return {type: 'text', text: part.text};
  if (part.type === 'thinking' || part.type === 'redacted_thinking') return null;
  if (part.type === 'image') {
    if (typeof part.data === 'string' && part.data) {
      return {type: 'image', data: part.data, mimeType: typeof part.mimeType === 'string' ? part.mimeType : ''};
    }
    return typeof part.source === 'string' && part.source ? {type: 'image', source: part.source} : null;
  }
  if (part.type === 'toolCall') {
    return {
      type: 'toolCall',
      id: typeof part.id === 'string' ? part.id : '',
      name: typeof part.name === 'string' ? part.name : '',
      arguments: part.arguments && typeof part.arguments === 'object' ? part.arguments : {},
    };
  }
  if (part.type === 'toolResult') {
    return {
      type: 'toolResult',
      toolCallId: typeof part.toolCallId === 'string' ? part.toolCallId : '',
      text: typeof part.text === 'string' ? part.text : '',
      isError: part.isError === true,
    };
  }
  return null;
}

/* JSON estável (chaves ordenadas) para a impressão digital não depender da
   ordem de serialização de objetos de ferramenta. */
function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
}

function messageFingerprint(message) {
  const parts = [];
  for (const part of Array.isArray(message?.content) ? message.content : []) {
    const canonical = canonicalPart(part);
    if (canonical) parts.push(canonical);
  }
  /* Resultado de ferramenta carrega identidade própria (`toolCallId`/`isError`):
     duas saídas de texto igual de chamadas diferentes NÃO são a mesma mensagem. */
  const role = typeof message?.role === 'string' ? message.role : '';
  const tail = role === 'toolResult'
    ? `|${typeof message.toolCallId === 'string' ? message.toolCallId : ''}|${message.isError === true ? '1' : ''}`
    : '';
  return `${role}|${stableStringify(parts)}${tail}`;
}

/* Prefixo preservado + histórico nativo SEM repetir o que já está no prefixo.
   A comparação é por impressão digital (papel + partes canônicas) em
   multiconjunto: mensagens iguais de verdade no prefixo continuam contando;
   só as cópias nativas correspondentes são descartadas. Usado por
   `history()` e exportado para o host que preferir mesclar no callback. */
function mergePriorHistory(prior, native) {
  const priorList = Array.isArray(prior) ? prior : [];
  const nativeList = Array.isArray(native) ? native : [];
  if (!priorList.length) return nativeList;
  const counts = new Map();
  for (const message of priorList) {
    const fingerprint = messageFingerprint(message);
    counts.set(fingerprint, (counts.get(fingerprint) || 0) + 1);
  }
  const merged = [...priorList];
  for (const message of nativeList) {
    const fingerprint = messageFingerprint(message);
    const remaining = counts.get(fingerprint) || 0;
    if (remaining > 0) {
      counts.set(fingerprint, remaining - 1);
      continue;
    }
    merged.push(message);
  }
  return merged;
}

function resultText(result) {
  if (typeof result?.result === 'string' && result.result.trim()) return result.result;
  if (Array.isArray(result?.errors) && result.errors.length) return result.errors.join('; ');
  return `a execução terminou em ${result?.subtype || 'erro'}`;
}

/* `resetsAt` do CLI é epoch em SEGUNDOS. O ISO do reset sai quando a data é
   válida; a espera só é exibida quando é crível (até 30 dias), para não
   prometer um relógio absurdo vindo de conta errada. */

module.exports = {
  normalizeAssistantBlocks,
  capToolDetails,
  assistantFrameKey,
  summarizeToolResult,
  historyPartOf,
  normalizeHistory,
  normalizeUsage,
  normalizePriorMessages,
  canonicalPart,
  stableStringify,
  messageFingerprint,
  mergePriorHistory,
  resultText,
};
