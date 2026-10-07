/* Ponte isolada Mesa ↔ Claude Code original (fase 1, experimental — rodada 3).
 *
 * Esta é a única superfície que o main deve importar do motor Claude. O
 * transporte é o Agent SDK OFICIAL (@anthropic-ai/claude-agent-sdk 0.3.246,
 * pareado com o CLI 2.1.246), com `import()` dinâmico e
 * `pathToClaudeCodeExecutable` apontando para o binário ORIGINAL do usuário —
 * nunca para Pi, proxy, token copiado ou flag privada.
 *
 * Contrato congelado:
 *   const a = new ClaudeAdapter({conversationId, sessionId, resume, cwd,
 *     claudePath, systemPrompt, env, queryFactory, sdkLoader, persistDelivery,
 *     timeoutMs, toolPolicy, permissionTtlMs, selection, persistSelection,
 *     controlsTimeoutMs});
 *   a.on('event', e => ...);                       // eventos canônicos
 *   await a.connect();                             // sem chamada de modelo
 *   await a.initializeControls();                  // AÇÃO EXPLÍCITA: cria/reusa
 *                                                  // a Query sem prompt, lê o
 *                                                  // catálogo e restaura a escolha
 *   a.setToolPolicy(policy);                       // troca a política sem turno
 *   await a.setControls({model, effort}, {persistSelection}); // só ocioso
 *   a.controlsSnapshot();                          // seletor/estados seguros
 *   await a.send({id, text, images});              // aceite = replay/correlação
 *   a.respond({id, confirmed, cancelled});         // permissões concretas
 *   a.respond({id, answers});                      // pergunta (AskUserQuestion)
 *   await a.cancel();                              // interrupt; busy até result
 *   await a.history();                             // getSessionMessages oficial
 *   a.close();                                     // encerra só a própria Query
 *
 * Modelo/esforço (controles da rodada 3, somente APIs do SDK PINADO 0.3.246):
 * a escolha desejada vive em `selection` e é separada do modelo OBSERVADO
 * (`_model`, vindo do init nativo). `initializeControls()` é a única porta que
 * cria a Query sem prompt; `connect()`/health continuam só versão/auth. O
 * catálogo sanitizado vem de `Query.supportedModels()` (fallback
 * `initializationResult().models`), nunca de nomes fixados em código, e só o
 * NOME do provedor da conta é retido (nunca e-mail/organização/plano). A
 * restauração usa `query.setModel(model || undefined)` e
 * `query.applyFlagSettings({effortLevel: effort || null})`; `setControls()`
 * valida o catálogo, chama o nativo, só então persiste (`persistSelection`) e
 * reaplica o estado anterior se algo falhar. Falha de rollback marca o
 * adaptador como bloqueado: nenhum envio novo passa até um adaptador novo —
 * nunca existe descritor "meio trocado" nem escolha silenciosamente ignorada.
 * Catálogo ausente = seletores desligados; escolha explícita inválida/ausente
 * RECUSA o envio antes de transmitir (nada de fallback silencioso).
 *
 * Ciclo de entrega persistido (o callback pode ser sync ou async; TODAS as
 * transições são aguardadas antes de resolver `send`/emitir `turn_end`):
 *
 * Ciclo de entrega persistido (o callback pode ser sync ou async; TODAS as
 * transições são aguardadas antes de resolver `send`/emitir `turn_end`):
 *   transmitting → (aceite comprovado) accepted → (result correlacionado) settled
 *   transmitting → (queda antes de yield) refused
 *   transmitting → (timeout, queda depois de yield, close) uncertain
 *   accepted     → (queda/close durante o turno) uncertain
 * Falha do callback em `accepted`/final NUNCA confirma sucesso: o turno fica
 * conservador em `uncertain`, a fila não é liberada e nada é reenviado.
 * `result` só encerra o turno atual com UUID/carimbo correto; subagente
 * (`parent_tool_use_id`) e sessão divergente não mudam a identidade nem
 * correlacionam. `--replay-user-messages` é passado via `extraArgs` (flag
 * pública da CLI) para o eco de aceite; `result.user_message_uuid` (e o array
 * `user_message_uuids`, quando existir) é o fallback de correlação.
 *
 * Segurança de ferramentas (v0): base só Read/Glob/Grep; Bash/Edit/Write/
 * Agent/Task/MCP herdado desabilitados; `settingSources: []`,
 * `strictMcpConfig: true`, sem MCP herdado; em Livre, somente a ferramenta
 * nativa `mcp__mesa__criar_pdf` pode salvar um novo material. Hook PreToolUse com realpath
 * aplica `toolPolicy` (readPaths/readRoots) inclusive em chamadas
 * auto-aprovadas; Glob/Grep não escapam a raiz por symlink; `canUseTool` nunca
 * devolve `updatedPermissions`.
 *
 * Liquidação (rodada 3, política pura em `claude-turn-policy.cjs`): um
 * `result` sem eco só encerra o turno ÚNICO com aceite persistido, não
 * degradado, sem eco estrangeiro anterior, sem origem não-humana e sem
 * `num_turns` zero; `taken` não é aceite. Resultado não correlacionado de
 * turno ainda não aceito é ignorado até timeout/fim de consulta. Cancelamento
 * explícito + aceite + fim NATIVO observado (`query` terminou, inclusive com
 * erro de iterador) ⇒ `settled` com `cancelled:true` e `uncertain:false`; sem
 * cancelamento a queda segue incerta; `close()`/timer do host seguem
 * conservadores. Falhas nativas do `result` (blocking_limit, 429/529,
 * contexto/imagem/orçamento, janela rejeitada não liberada) ganham erro
 * `fatal:false` e NÃO desfazem o aceite. `api_retry` preserva
 * tentativa/máximo/atraso/status, dedupe por attempt e nunca encerra o turno
 * (aviso `CLAUDE_API_RETRY`, ou `CLAUDE_OVERLOADED` em 529); recusa/fallback
 * vira aviso `CLAUDE_MODEL_REFUSAL`/`CLAUDE_MODEL_FALLBACK` com retração
 * limitada, com evicção de DOM explicitamente adiada. Incerteza de entrega
 * hidratada (`deliveryUncertain`) é PEGAJOSA: envio, `initializeControls` e
 * `setControls` recusam antes de consulta/nativo/disco até um adaptador novo.
 *
 * Perguntas (AskUserQuestion, APIs do SDK pinado 0.3.246): a ferramenta entra
 * em `tools` (sai de `disallowedTools`) mas NÃO concede escrita/Bash/MCP: o
 * `canUseTool` emite `permission_request {method:'question', questions}` e só
 * devolve allow com respostas ESTRUTURADAS validadas (`respond({id, answers})`),
 * com `updatedInput {questions, answers}` (multiSelect vira "A, B"). Cancelar,
 * abort (AbortSignal do SDK) ou vencer o prazo nega com
 * `permission_cancelled {id, reason}`; ID vencido nunca concede allow.
 *
 * Limite de uso: `rate_limit_event` de PRIMEIRO NÍVEL (o SDK 0.3.246 declara
 * esse tipo fora de `system`; o subtipo em `system` fica como leitura legada
 * defensiva) NÃO encerra o turno: rejected sem overage vira aviso
 * deduplicado `CLAUDE_RATE_LIMITED` com janela/reset; `allowed` libera e
 * permite aviso novo; `allowed_warning` avisa; rejected com overage em uso
 * continua e avisa o overage. A janela rejeitada é rastreada por tipo (várias
 * ao mesmo tempo são possíveis); quando ela passa a `allowed`, sai UMA
 * transição `CLAUDE_RATE_LIMIT_RESUMED` com `rateLimit.blocked:false` para a
 * UI limpar a pausa — nunca a cada `allowed` repetido e sem mexer em
 * busy/fila/liquidação. busy/fila/entrega ficam intactos.
 *
 * Testes usam SOMENTE SDK fake injetado (queryFactory/sdkLoader/detectClaude);
 * nada aqui inicia inferência, login ou processo Claude real por conta própria.
 */
'use strict';

const crypto = require('node:crypto');
const {EventEmitter} = require('node:events');
const fs = require('node:fs');
const path = require('node:path');
const environment = require('./claude-environment.cjs');
const {TOOL_NAME:TUTOR_PDF_TOOL,createTutorPdfServer}=require('./tutor-pdf.cjs');
/* Módulo puro de normalização (sem I/O): catálogo/alias/compilação/portão. */
const controlsMod = require('./claude-controls.cjs');
/* Artefatos Bend: decisões que não podem divergir entre host e UI. */
const capsCore = require('../generated/agentcaps.core.js').default;
const deliveryCore = require('../generated/agentdelivery.core.js').default;
/* Política pura de liquidação do turno (correlação, fim de consulta, falhas
   nativas, retry e recusa): o adaptador mede os fatos e aplica o veredito. */
const turnPolicy = require('./claude-turn-policy.cjs');

const ADAPTER_VERSION = '0.3.0-experimental';
const CLAUDE_CLIENT_APP = 'mesa-de-estudos-experimental/0.3.0';

const DEFAULT_TIMEOUT_MS = 60000;
const DEFAULT_PERMISSION_TTL_MS = 30 * 60 * 1000;
/* `setTimeout` estoura acima de 2^31-1 ms; o teto evita disparo imediato. */
const MAX_PERMISSION_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_IMAGES = 16;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_TEXT_BYTES = 512 * 1024;
const MAX_CONTENT_BYTES = 32 * 1024 * 1024;
const MAX_TOOL_RESULT_CHARS = 20000;
const MAX_HISTORY_MESSAGES = 200;
const MAX_HISTORY_BYTES = 8 * 1024 * 1024;
const MAX_COMPLETED_KEYS = 256;
const MAX_HISTORY_PAGES = 64;
const MAX_RATE_LIMIT_NOTICES = 128;
const MAX_RATE_LIMIT_WAIT_MS = 30 * 24 * 60 * 60 * 1000;
/* Controles (catálogo/troca) têm prazo PRÓPRIO e curto: uma Query que não
   responde a setModel/applyFlagSettings não pode segurar a UI. */
const DEFAULT_CONTROLS_TIMEOUT_MS = 15000;
const MAX_CONTROLS_TIMEOUT_MS = 120000;
const MAX_SELECTION_ID = 200;
/* Estados do subsistema de controles. `failed` é terminal para ESTE adaptador
   (rollback que não fechou): envios ficam bloqueados até um adaptador novo. */
const CONTROLS_STATES = Object.freeze(['idle', 'initializing', 'ready', 'unavailable', 'failed']);

const ALLOWED_IMAGE_TYPES = Object.freeze(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);
const ALLOWED_TOOLS = Object.freeze(['Read', 'Glob', 'Grep']);
/* AskUserQuestion é a única ferramenta interativa exposta: ela não lê nem
   escreve nada sozinha e passa pelo crivo do `canUseTool` com respostas
   estruturadas. Gravação/Bash/agentes/MCP seguem fora. */
const SDK_TOOLS = Object.freeze([...ALLOWED_TOOLS, 'AskUserQuestion']);
const DISALLOWED_TOOLS = Object.freeze([
  'Bash', 'Edit', 'Write', 'NotebookEdit', 'Agent', 'Task',
  'WebFetch', 'WebSearch', 'KillShell', 'BashOutput', 'Skill',
]);

const RATE_LIMIT_WINDOWS = Object.freeze({
  five_hour: 'janela de 5 horas',
  seven_day: 'janela de 7 dias',
  seven_day_opus: 'janela de 7 dias (Opus)',
  seven_day_sonnet: 'janela de 7 dias (Sonnet)',
  seven_day_overage_included: 'janela de 7 dias (modelo com overage)',
  overage: 'overage',
});

/* Erros que o CLI carimba na mensagem assistente (SDK 0.3.246
   `SDKAssistantMessageError`) e o código canônico mostrado à Mesa. */
const ASSISTANT_ERROR_CODES = Object.freeze({
  rate_limit: 'CLAUDE_RATE_LIMITED',
  authentication_failed: 'CLAUDE_AUTH_FAILED',
  oauth_org_not_allowed: 'CLAUDE_AUTH_FAILED',
  account_on_hold: 'CLAUDE_ACCOUNT_ON_HOLD',
  billing_error: 'CLAUDE_BILLING_ERROR',
  overloaded: 'CLAUDE_OVERLOADED',
  server_error: 'CLAUDE_SERVER_ERROR',
  invalid_request: 'CLAUDE_INVALID_REQUEST',
  model_not_found: 'CLAUDE_MODEL_NOT_FOUND',
  max_output_tokens: 'CLAUDE_MAX_OUTPUT_TOKENS',
});

/* Capacidades estruturais desta ponte experimental. Presença no contrato não é
   promessa de inferência real; `steer`, `compact`, etc. ficam falsas até
   integração comprovada. Espelho fiel do `claudeCaps()` do núcleo Bend
   (`core/agentcaps.bend`) — snapshot() só troca os fatos por
   `claudeControlCaps` quando catálogo/APIs estão vivos. */
const CAPABILITIES = Object.freeze({
  images: true,
  permissions: true,
  steer: false,
  compact: false,
  autoCompaction: false,
  modelSelection: false,
  effort: false,
  reviewDraft: false,
  handoff: false,
  commands: false,
  geogebra: false,
  quiz: false,
  contextUsage: false,
});

const MODEL_INFO = Object.freeze({
  provider: 'anthropic',
  id: 'default',
  name: 'Claude Code',
  input: Object.freeze(['text', 'image']),
});

const EVENT_TYPES = Object.freeze([
  'turn_start', 'message_start', 'message_delta', 'message_end',
  'tool_start', 'tool_end', 'permission_request', 'permission_cancelled',
  'turn_end', 'warning', 'error', 'delivery', 'init',
]);

const DELIVERY_STATUSES = Object.freeze(['transmitting', 'accepted', 'settled', 'uncertain', 'refused']);

class ClaudeAdapterError extends Error {
  constructor(code, message, detail, notSent = false) {
    super(message);
    this.name = 'ClaudeAdapterError';
    this.code = code;
    this.notSent = notSent === true;
    if (detail !== undefined && detail !== null) this.detail = detail;
  }
}

/* Fila assíncrona de entrada do SDK. `onTaken` avisa quando uma mensagem foi
   ENTREGUE ao iterador (pré-requisito para distinguir recusa de incerteza) —
   isso não é aceite: aceite é replay/carimbo com o mesmo uuid. */
class MessageQueue {
  constructor() {
    this._items = [];
    this._waiters = [];
    this._ended = false;
    this._error = null;
    this.onTaken = null;
  }

  get pendingCount() {
    return this._items.length;
  }

  push(item) {
    if (this._ended) throw new Error('fila de entrada encerrada');
    if (this._waiters.length) {
      const waiter = this._waiters.shift();
      if (this.onTaken) this.onTaken(item);
      waiter({value: item, done: false});
      return;
    }
    this._items.push(item);
  }

  end() {
    if (this._ended) return;
    this._ended = true;
    for (const waiter of this._waiters.splice(0)) waiter({value: undefined, done: true});
  }

  fail(error) {
    if (this._ended) return;
    this._error = error;
    this._ended = true;
    for (const waiter of this._waiters.splice(0)) waiter({value: undefined, done: true});
  }

  [Symbol.asyncIterator]() {
    return {
      next: async () => {
        for (;;) {
          if (this._items.length) {
            const item = this._items.shift();
            if (this.onTaken) this.onTaken(item);
            return {value: item, done: false};
          }
          if (this._error) {
            const error = this._error;
            this._error = null;
            throw error;
          }
          if (this._ended) return {value: undefined, done: true};
          return await new Promise((resolve) => this._waiters.push(resolve));
        }
      },
      return: async () => {
        this.end();
        return {value: undefined, done: true};
      },
    };
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value) {
  return typeof value === 'string' && UUID_RE.test(value);
}

function errorText(error) {
  if (error instanceof Error) return error.message || error.name;
  return error === undefined ? 'erro desconhecido' : String(error);
}

function asAdapterError(error, notSentDefault = false, fallbackCode = 'CLAUDE_ERROR') {
  if (error instanceof ClaudeAdapterError) return error;
  const code = typeof error?.code === 'string' && error.code ? error.code : fallbackCode;
  const notSent = error?.notSent === true ? true : notSentDefault;
  return new ClaudeAdapterError(code, errorText(error), error?.detail ?? null, notSent);
}

/* Escolha desejada ({model, effort} persistidos pelo usuário). Só strings
   limitadas entram; nomes concretos nunca são adivinhados/completados aqui —
   quem valida contra o catálogo nativo é `compileSelection`. */
function normalizeSelectionInput(selection) {
  const out = {model: null, effort: null};
  if (!selection || typeof selection !== 'object' || Array.isArray(selection)) return out;
  if (typeof selection.model === 'string' && selection.model.trim()) {
    out.model = selection.model.trim().slice(0, MAX_SELECTION_ID);
  }
  if (typeof selection.effort === 'string' && selection.effort.trim()) {
    out.effort = selection.effort.trim().slice(0, MAX_SELECTION_ID);
  }
  return out;
}

function realpathBestEffort(value) {
  try {
    return typeof fs.realpathSync.native === 'function'
      ? fs.realpathSync.native(value)
      : fs.realpathSync(value);
  } catch {
    const parent = path.dirname(value);
    if (!parent || parent === value) return value;
    return path.join(realpathBestEffort(parent), path.basename(value));
  }
}

function canonicalPath(target, cwd) {
  return realpathBestEffort(path.resolve(cwd || process.cwd(), String(target)));
}

function isInside(child, root) {
  if (child === root) return true;
  return typeof child === 'string' && typeof root === 'string' && child.startsWith(root + path.sep);
}

/* Canonicaliza a política (construtor E setToolPolicy) para que trocar o PDF
   por prompt não reabra caminhos antigos: cada chamada re-resolve readPaths e
   readRoots. `readRoots` vazio cai para o cwd controlado. */
function normalizeToolPolicy(policy, cwd) {
  const readPaths = [];
  const readRoots = [];
  const push = (list, value) => {
    if (typeof value === 'string' && value) list.push(realpathBestEffort(path.resolve(cwd || process.cwd(), value)));
  };
  for (const file of policy?.readPaths || []) push(readPaths, file);
  for (const root of policy?.readRoots || []) push(readRoots, root);
  if (!readRoots.length && cwd) readRoots.push(realpathBestEffort(cwd));
  return {readPaths, readRoots};
}

function extractPathFromInput(toolName, input) {
  if (!input || typeof input !== 'object') return null;
  if (toolName === 'Read') return typeof input.file_path === 'string' ? input.file_path : null;
  if (toolName === 'Glob' || toolName === 'Grep') {
    return typeof input.path === 'string' && input.path ? input.path : null;
  }
  return null;
}

function validateImage(image, index) {
  if (!image || typeof image !== 'object' || Array.isArray(image)) {
    throw new ClaudeAdapterError('CLAUDE_BAD_MESSAGE', `imagem ${index + 1}: formato inválido (esperado {type:'image',data,mimeType})`, null, true);
  }
  if (image.type !== 'image') {
    throw new ClaudeAdapterError('CLAUDE_BAD_MESSAGE', `imagem ${index + 1}: type precisa ser 'image'`, null, true);
  }
  const mimeType = typeof image.mimeType === 'string' ? image.mimeType.trim() : '';
  if (!ALLOWED_IMAGE_TYPES.includes(mimeType)) {
    throw new ClaudeAdapterError('CLAUDE_BAD_MESSAGE', `imagem ${index + 1}: mimeType não suportado (${mimeType || 'vazio'})`, null, true);
  }
  const data = typeof image.data === 'string' ? image.data.trim() : '';
  if (!data || data.startsWith('data:') || !/^[A-Za-z0-9+/]+={0,2}$/.test(data) || data.length % 4 === 1) {
    throw new ClaudeAdapterError('CLAUDE_BAD_MESSAGE', `imagem ${index + 1}: dados base64 inválidos (a Mesa reduz a captura antes daqui)`, null, true);
  }
  const bytes = Math.floor((data.length * 3) / 4);
  if (bytes > MAX_IMAGE_BYTES) {
    throw new ClaudeAdapterError('CLAUDE_BAD_MESSAGE', `imagem ${index + 1}: ${bytes} bytes acima do teto de ${MAX_IMAGE_BYTES}`, null, true);
  }
  return {data, mimeType, bytes};
}

/* Normaliza e valida {text, images} (formato Pi já reduzido) para blocos do
   SDK. Nada é gravado nem transmitido nesta função. */
function prepareMessage({text, images} = {}) {
  const cleanText = typeof text === 'string' ? text : '';
  const list = Array.isArray(images) ? images : [];
  if (!cleanText.trim() && list.length === 0) {
    throw new ClaudeAdapterError('CLAUDE_BAD_MESSAGE', 'mensagem vazia: envie texto ou imagem', null, true);
  }
  const textBytes = Buffer.byteLength(cleanText, 'utf8');
  if (textBytes > MAX_TEXT_BYTES) {
    throw new ClaudeAdapterError('CLAUDE_BAD_MESSAGE', `texto grande demais (${textBytes} bytes acima de ${MAX_TEXT_BYTES})`, null, true);
  }
  if (list.length > MAX_IMAGES) {
    throw new ClaudeAdapterError('CLAUDE_BAD_MESSAGE', `imagens demais (${list.length} acima de ${MAX_IMAGES})`, null, true);
  }
  const blocks = [];
  if (cleanText) blocks.push({type: 'text', text: cleanText});
  let totalBytes = textBytes;
  for (let i = 0; i < list.length; i += 1) {
    const image = validateImage(list[i], i);
    totalBytes += image.bytes;
    if (totalBytes > MAX_CONTENT_BYTES) {
      throw new ClaudeAdapterError('CLAUDE_BAD_MESSAGE', `conteúdo grande demais (${totalBytes} bytes acima de ${MAX_CONTENT_BYTES})`, null, true);
    }
    blocks.push({type: 'image', source: {type: 'base64', media_type: image.mimeType, data: image.data}});
  }
  return {blocks, bytes: totalBytes};
}

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

/* Tradução do histórico nativo (SessionMessage[]) para o formato da Mesa:
   [{role, content:[{type:'text'|'image'|'toolCall'}...]}]. Sem reexecutar
   ferramenta nenhuma; tool_result não vira conteúdo, e subagente é ignorado.
   O teto de bytes é explícito: `onTruncate` é chamado quando uma mensagem é
   deixada de fora (nunca truncar em silêncio). */
function normalizeHistory(sessionMessages, {maxBytes = MAX_HISTORY_BYTES, onTruncate = null} = {}) {
  const out = [];
  let bytes = 0;
  for (const entry of sessionMessages || []) {
    if (!entry || typeof entry !== 'object') continue;
    if (entry.parent_tool_use_id != null || entry.parent_agent_id != null) continue;
    if (entry.type !== 'user' && entry.type !== 'assistant') continue;
    const raw = entry.message;
    const blocks = typeof raw === 'string'
      ? [{type: 'text', text: raw}]
      : Array.isArray(raw?.content) ? raw.content : [];
    const content = [];
    for (const block of blocks) {
      if (!block || typeof block !== 'object') continue;
      if (block.type === 'text' && typeof block.text === 'string') content.push({type: 'text', text: block.text});
      else if (block.type === 'image' && block.source?.type === 'base64' && typeof block.source.data === 'string') {
        content.push({type: 'image', data: block.source.data, mimeType: String(block.source.media_type || '')});
      } else if (block.type === 'tool_use') {
        content.push({type: 'toolCall', id: String(block.id || ''), name: String(block.name || ''), arguments: block.input && typeof block.input === 'object' ? block.input : {}});
      }
    }
    if (!content.length) continue;
    const size = Buffer.byteLength(JSON.stringify(content), 'utf8');
    if (bytes + size > maxBytes) {
      if (typeof onTruncate === 'function') {
        onTruncate({reason: 'bytes', kept: out.length, total: (sessionMessages || []).length, maxBytes});
      }
      break;
    }
    bytes += size;
    out.push({role: entry.type, content});
  }
  return out;
}

function resultText(result) {
  if (typeof result?.result === 'string' && result.result.trim()) return result.result;
  if (Array.isArray(result?.errors) && result.errors.length) return result.errors.join('; ');
  return `a execução terminou em ${result?.subtype || 'erro'}`;
}

/* `resetsAt` do CLI é epoch em SEGUNDOS. O ISO do reset sai quando a data é
   válida; a espera só é exibida quando é crível (até 30 dias), para não
   prometer um relógio absurdo vindo de conta errada. */
function rateLimitReset(resetsAt) {
  if (!Number.isFinite(resetsAt) || resetsAt <= 0) return {resetsAt: null, resetAt: null, waitMs: null};
  const ms = resetsAt * 1000;
  const date = new Date(ms);
  const valid = !Number.isNaN(date.getTime());
  const waitMs = ms - Date.now();
  return {
    resetsAt,
    resetAt: valid ? date.toISOString() : null,
    waitMs: valid && waitMs > 0 && waitMs <= MAX_RATE_LIMIT_WAIT_MS ? waitMs : null,
  };
}

function formatWaitMs(waitMs) {
  const totalMinutes = Math.ceil(waitMs / 60000);
  if (totalMinutes < 60) return `${totalMinutes}min`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes ? `${hours}h${minutes}min` : `${hours}h`;
}

/* Normaliza o input de AskUserQuestion (sdk-tools.d.ts do pin 0.3.246) para o
   contrato da Mesa: pergunta sem texto é descartada; header ausente ganha um
   rótulo neutro; opção sem label é descartada; o restante é preservado. */
function normalizeUserQuestions(input) {
  if (!Array.isArray(input)) return [];
  const out = [];
  input.forEach((value, index) => {
    if (!value || typeof value !== 'object') return;
    const question = typeof value.question === 'string' ? value.question.trim() : '';
    if (!question) return;
    const header = typeof value.header === 'string' && value.header.trim()
      ? value.header.trim()
      : `Pergunta ${index + 1}`;
    const options = [];
    for (const option of Array.isArray(value.options) ? value.options : []) {
      if (!option || typeof option !== 'object') continue;
      const label = typeof option.label === 'string' ? option.label.trim() : '';
      if (!label) continue;
      const normalized = {label, description: typeof option.description === 'string' ? option.description.trim() : ''};
      if (typeof option.preview === 'string' && option.preview) normalized.preview = option.preview;
      options.push(normalized);
    }
    out.push({id: question, header, question, options, multiSelect: value.multiSelect === true});
  });
  return out;
}

/* Respostas estruturadas: chave = texto exato da pergunta; valor string (ou
   lista de strings para multiSelect, juntada com ", " como o CLI espera).
   "Other" é texto livre, então NÃO se exige que a resposta seja uma opção —
   exige-se forma válida, pergunta conhecida e nenhuma pergunta sem resposta. */
function validateQuestionAnswers(questions, answers) {
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
    return {ok: false, code: 'CLAUDE_QUESTION_ANSWERS_INVALID', detail: {reason: 'answers precisa ser objeto'}};
  }
  for (const key of Object.keys(answers)) {
    if (!questions.some((question) => question.question === key)) {
      return {ok: false, code: 'CLAUDE_QUESTION_ANSWERS_UNKNOWN', detail: {question: key}};
    }
  }
  const normalized = {};
  for (const question of questions) {
    if (!Object.prototype.hasOwnProperty.call(answers, question.question)) {
      return {ok: false, code: 'CLAUDE_QUESTION_ANSWERS_MISSING', detail: {question: question.question}};
    }
    const raw = answers[question.question];
    if (Array.isArray(raw) && !question.multiSelect && raw.length > 1) {
      return {ok: false, code: 'CLAUDE_QUESTION_ANSWER_INVALID', detail: {question: question.question, reason: 'escolha única com múltiplas respostas'}};
    }
    const values = Array.isArray(raw) ? raw : [raw];
    const texts = [];
    for (const value of values) {
      if (typeof value !== 'string' || !value.trim()) {
        return {ok: false, code: 'CLAUDE_QUESTION_ANSWER_INVALID', detail: {question: question.question, reason: 'resposta vazia ou não textual'}};
      }
      texts.push(value.trim());
    }
    if (!texts.length) {
      return {ok: false, code: 'CLAUDE_QUESTION_ANSWER_INVALID', detail: {question: question.question, reason: 'resposta vazia'}};
    }
    /* Chave EXATA (inclusive '__proto__'/'constructor'): defineProperty cria
       propriedade PRÓPRIA enumerável — atribuição dispararia o setter de
       protótipo e perderia a resposta. O valor segue string juntada com ", ",
       no formato nativo. */
    Object.defineProperty(normalized, question.question, {
      value: texts.join(', '),
      enumerable: true,
      writable: true,
      configurable: true,
    });
  }
  return {ok: true, answers: normalized};
}

class ClaudeAdapter extends EventEmitter {
  constructor(options = {}) {
    super();
    const {
      conversationId,
      sessionId = null,
      resume = false,
      cwd = null,
      claudePath = null,
      systemPrompt = '',
      env = null,
      queryFactory = null,
      sdkLoader = null,
      persistDelivery = null,
      timeoutMs = DEFAULT_TIMEOUT_MS,
      toolPolicy = null,
      detectClaude = null,
      permissionTtlMs = DEFAULT_PERMISSION_TTL_MS,
      selection = null,
      persistSelection = null,
      controlsTimeoutMs = DEFAULT_CONTROLS_TIMEOUT_MS,
      deliveryUncertain = false,
      createMaterial = null,
    } = options;

    if (typeof conversationId !== 'string' || !conversationId.trim()) {
      throw new ClaudeAdapterError('CLAUDE_BAD_ARGUMENTS', 'conversationId obrigatório', null, true);
    }
    this._conversationId = conversationId;
    this._sessionId = typeof sessionId === 'string' && sessionId ? sessionId : null;
    this._resume = resume === true;
    if (this._resume && !this._sessionId) {
      throw new ClaudeAdapterError('CLAUDE_RESUME_WITHOUT_SESSION', 'resume=true exige sessionId explícito (nunca "última sessão")', null, true);
    }
    this._cwd = typeof cwd === 'string' && cwd ? path.resolve(cwd) : null;
    this._claudePath = typeof claudePath === 'string' && claudePath ? claudePath : null;
    this._systemPrompt = typeof systemPrompt === 'string' ? systemPrompt : '';
    this._childEnv = env && typeof env === 'object' ? env : null;
    this._queryFactory = typeof queryFactory === 'function' ? queryFactory : null;
    this._sdkLoader = typeof sdkLoader === 'function' ? sdkLoader : null;
    this._createMaterial = typeof createMaterial === 'function' ? createMaterial : null;
    this._persistDelivery = typeof persistDelivery === 'function' ? persistDelivery : null;
    this._timeoutMs = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : DEFAULT_TIMEOUT_MS;
    this._permissionTtlMs = Number.isFinite(permissionTtlMs) && permissionTtlMs > 0
      ? Math.min(Math.floor(permissionTtlMs), MAX_PERMISSION_TTL_MS)
      : 0;
    this._toolPolicy = normalizeToolPolicy(toolPolicy, this._cwd);
    this._detectClaude = typeof detectClaude === 'function' ? detectClaude : environment.detectClaude;
    this._injected = Boolean(this._queryFactory || this._sdkLoader);
    this._controlsTimeoutMs = Number.isFinite(controlsTimeoutMs) && controlsTimeoutMs > 0
      ? Math.min(Math.floor(controlsTimeoutMs), MAX_CONTROLS_TIMEOUT_MS)
      : DEFAULT_CONTROLS_TIMEOUT_MS;
    this._persistSelection = typeof persistSelection === 'function' ? persistSelection : null;

    this._connected = false;
    this._closed = false;
    this._busy = false;
    this._generation = 0;
    this._runId = null;
    this._query = null;
    this._queue = null;
    this._queryDead = true;
    /* Um prompt SÓ conta como entregue quando um item passou pelo yield (é o
       que decide sessionId × resume na próxima consulta — a inicialização de
       catálogo sem prompt não pode virar "resume" de sessão inexistente). */
    this._promptDelivered = false;
    this._sdk = null;
    this._initEmitted = false;
    this._version = null;
    this._model = null;
    this._permissions = new Map();
    this._rateLimitNotices = new Map();
    this._rejectedWindows = new Map();
    this._turn = null;
    this._foreignSessions = new Set();
    this._cancelRequested = false;
    this._streamed = new Set();
    this._completed = new Map();
    this._toolNames = new Map();

    /* Controles: escolha DESEJADA (persistida) ≠ estado NATIVO aplicado. */
    this._selection = normalizeSelectionInput(selection);
    this._nativeSelection = {model: null, effort: null};
    this._controlsState = 'idle';
    this._controlsCatalog = null;
    this._controlsError = null;
    this._controlsInitPromise = null;
    this._controlsChanging = false;
    this._controlsFailed = false;
    this._controlsFailedDetail = null;
    this._accountProvider = null;
    /* Hidratação ESTRITA: só o booleano `true` liga a incerteza de entrega
       herdada do descritor. O fato é PEGAJOSO neste adaptador (envio,
       initializeControls e troca de controles recusam); só um adaptador novo
       resolve, exatamente como o Bend `canChangeControls`/`canBegin` exige. */
    this._deliveryUncertain = deliveryUncertain === true;
    this._apiRetryNotices = new Map();
  }

  /* Modelo OBSERVADO quando o CLI já disse qual usou; senão, o rótulo neutro
     do contrato ("Claude Code"). O id 'default' NÃO é um modelo escolhido. */
  _currentModelInfo() {
    if (!this._model) {
      return {provider: MODEL_INFO.provider, id: MODEL_INFO.id, name: MODEL_INFO.name, input: [...MODEL_INFO.input]};
    }
    const entry = this._controlsCatalog?.ok === true
      ? controlsMod.resolveCatalogEntry(this._controlsCatalog, this._model)
      : null;
    return {
      provider: MODEL_INFO.provider,
      id: this._model,
      name: entry?.displayName || this._model,
      input: [...MODEL_INFO.input],
    };
  }

  /* Capacidades dinâmicas pelo artefato Bend `claudeControlCaps`: catálogo
     válido E API nativa de troca viva. Sem isso, capacidades base (controles
     ocultos). Esforço ainda exige o metadado nativo E applyFlagSettings. */
  _capabilities() {
    const queryAlive = Boolean(this._query && !this._queryDead && !this._closed);
    const catalogReady = this._controlsState === 'ready'
      && queryAlive
      && this._controlsCatalog?.ok === true
      && typeof this._query.setModel === 'function';
    const effortSupported = catalogReady
      && this._controlsCatalog.effort === true
      && typeof this._query.applyFlagSettings === 'function';
    const {$, ...caps} = capsCore.claudeControlCaps(catalogReady, effortSupported);
    return caps;
  }

  snapshot() {
    return {
      connected: this._connected && !this._closed,
      busy: this._busy,
      model: this._currentModelInfo(),
      capabilities: this._capabilities(),
      sessionId: this._sessionId,
      /* Esforço NATIVO aplicado por este adaptador (null = default do CLI). */
      thinkingLevel: this._nativeSelection.effort,
    };
  }

  /* Estado do turno corrente/último turno ainda em liquidação — sobrevive ao
     aceite (o main pode conferir o registro mesmo depois do replay). */
  deliveryState() {
    const turn = this._turn;
    if (!turn) return null;
    return {
      id: turn.id,
      wireUuid: turn.wireUuid,
      status: turn.phase,
      accepted: turn.acceptResolved,
      degraded: turn.degraded,
      finalized: turn.finalized,
    };
  }

  /* Detecta binário/versão/login ANTES de existir consulta. Nenhuma chamada de
     modelo. Testes injetam queryFactory/sdkLoader (e podem injetar detectClaude). */
  async connect() {
    if (this._connected && !this._closed) return this.snapshot();
    if (this._closed) {
      this._closed = false;
      this._generation += 1;
      this._initEmitted = false;
      this._foreignSessions.clear();
    }
    if (!this._cwd) {
      throw new ClaudeAdapterError('CLAUDE_CWD_REQUIRED', 'cwd obrigatório: a conversa precisa de pasta de trabalho controlada (nunca o vault inteiro)', null, true);
    }
    if (!this._injected) {
      let info;
      try {
        info = await this._detectClaude({configuredPath: this._claudePath, env: process.env});
      } catch (error) {
        throw asAdapterError(error, true);
      }
      if (info?.path) this._claudePath = info.path;
      if (info?.version) this._version = info.version;
      /* Só o NOME do provedor (firstParty/bedrock/...) — nunca e-mail,
         organização ou plano; é o suficiente para o compile first-party. */
      if (typeof info?.auth?.apiProvider === 'string') {
        const provider = info.auth.apiProvider.trim();
        if (provider && provider.length <= 100) this._accountProvider = provider;
      }
      for (const warning of info?.warnings || []) {
        this._emit('warning', {message: warning.message, code: warning.code});
      }
    }
    this._connected = true;
    return this.snapshot();
  }

  /* Troca a política de caminhos (ex.: PDF ativo muda por prompt). Sempre
     canonicaliza; recusa com turno em andamento ou permissão pendente para
     não mudar a regra no meio de uma decisão já apresentada. */
  setToolPolicy(policy) {
    if (this._closed) {
      throw new ClaudeAdapterError('CLAUDE_CLOSED', 'conexão encerrada; reconecte antes de trocar a política', null, true);
    }
    if (this._busy || this._turn || this._permissions.size) {
      throw new ClaudeAdapterError('CLAUDE_BUSY', 'não troque a política de caminhos com turno ou permissão pendente', null, true);
    }
    this._toolPolicy = normalizeToolPolicy(policy, this._cwd);
    return {readPaths: [...this._toolPolicy.readPaths], readRoots: [...this._toolPolicy.readRoots]};
  }

  /* ---------------- modelo/esforço (controles nativos) ----------------
   *
   * Contrato público para o host (main/serviço):
   *   await adapter.initializeControls()            // ação explícita, sem prompt
   *   adapter.controlsSnapshot()                   // seletor + estados seguros
   *   await adapter.setControls({model, effort}, {persistSelection})
   *   adapter.snapshot()                           // modelo/esforço OBSERVADOS
   *
   * `_selection` é a escolha DESEJADA (persistida no descritor); `_nativeSelection`
   * é o que ESTE adaptador aplicou na Query viva. Os dois só divergem em falha
   * explícita — e a divergência bloqueia o envio (nunca fallback silencioso).
   */

  /* AÇÃO EXPLÍCITA (conexão da UI ou antes de um prompt real). Conecta (só
     versão/auth), cria/reusa a Query NATIVA sem prompt, lê o catálogo
     sanitizado NA MESMA Query e restaura a escolha salva com as APIs do pin.
     Idempotente quando já está saudável; chamadas concorrentes compartilham a
     promessa. NÃO faz inferência: nenhum item entra no iterador de entrada. */
  async initializeControls({timeoutMs} = {}) {
    if (this._deliveryUncertain) {
      throw new ClaudeAdapterError('CLAUDE_DELIVERY_UNCERTAIN', 'a entrega anterior está incerta; comece uma conversa nova antes de inicializar os controles', null, true);
    }
    if (this._controlsFailed) {
      throw new ClaudeAdapterError(
        'CLAUDE_CONTROLS_BLOCKED',
        'uma troca de controles falhou sem restauração; comece uma conversa nova antes de inicializar de novo',
        {...this._controlsFailedDetail},
        true,
      );
    }
    await this.connect();
    if (this._controlsHealthy()) return this.controlsSnapshot();
    if (this._controlsInitPromise) return this._controlsInitPromise;
    const promise = this._initializeControlsOnce(timeoutMs);
    this._controlsInitPromise = promise;
    try {
      return await promise;
    } finally {
      if (this._controlsInitPromise === promise) this._controlsInitPromise = null;
    }
  }

  _controlsHealthy() {
    return this._controlsState === 'ready'
      && this._controlsCatalog?.ok === true
      && Boolean(this._query && !this._queryDead && !this._closed);
  }

  async _initializeControlsOnce(timeoutMs) {
    const bound = Number.isFinite(timeoutMs) && timeoutMs > 0
      ? Math.min(Math.floor(timeoutMs), MAX_CONTROLS_TIMEOUT_MS)
      : this._controlsTimeoutMs;
    const generation = this._generation;
    this._controlsState = 'initializing';
    this._controlsError = null;
    try {
      const query = await this._bounded(this._ensureQuery(), bound, 'CLAUDE_CONTROLS_TIMEOUT');
      this._assertControlsQuery(query, generation);
      const catalog = await this._bounded(
        controlsMod.readCatalogFromQuery(query, {account: this._accountInfo()}),
        bound,
        'CLAUDE_CONTROLS_TIMEOUT',
      );
      this._assertControlsQuery(query, generation);
      this._controlsCatalog = catalog;
      if (catalog.ok !== true) {
        this._controlsState = 'unavailable';
        this._controlsError = {code: 'CLAUDE_CONTROLS_UNAVAILABLE', reason: catalog.reason, detail: catalog.detail ?? null};
        return this.controlsSnapshot();
      }
      const compiled = this._compileSelection(this._selection);
      if (compiled.ok !== true) {
        /* Escolha SALVA não vale contra o catálogo vivo: nada é aplicado (o
           default nativo fica) e o envio recusa até o usuário corrigir. */
        this._controlsState = 'ready';
        this._controlsError = {code: 'CLAUDE_CONTROLS_INVALID', reason: compiled.reason, detail: compiled.detail};
        return this.controlsSnapshot();
      }
      if (compiled.model || compiled.effort) {
        await this._commitNative(query, {model: compiled.model, effort: compiled.effort}, {
          bound,
          persist: null,
          guard: () => this._assertControlsQuery(query, generation),
        });
      }
      /* A escolha desejada passa a ser a forma NORMALIZADA (alias resolvido),
         igual ao que foi aplicado no nativo e ao patch que o host persiste. */
      this._selection = {model: compiled.model, effort: compiled.effort};
      this._controlsState = 'ready';
      this._controlsError = null;
      return this.controlsSnapshot();
    } catch (error) {
      if (error?.code === 'CLAUDE_CONTROLS_ROLLBACK_FAILED') throw error;
      if (error?.code === 'CLAUDE_CLOSED' || error?.code === 'CLAUDE_QUERY_STALE') {
        this._controlsState = 'idle';
        throw error;
      }
      this._controlsState = 'unavailable';
      this._controlsError = {
        code: typeof error?.code === 'string' && error.code ? error.code : 'CLAUDE_CONTROLS_ERROR',
        reason: error?.detail?.reason ?? error?.detail?.method ?? null,
        detail: errorText(error),
      };
      return this.controlsSnapshot();
    }
  }

  /* Troca de modelo/esforço: SÓ com o motor ocioso (Bend `canChangeControls`),
     catálogo validado, sem chamadas concorrentes. Persiste `compiled.patch`
     apenas DEPOIS do sucesso nativo; qualquer falha restaura o estado anterior
     e falha de restauração bloqueia novos envios até um adaptador novo. */
  async setControls(selection, {persistSelection} = {}) {
    if (this._closed) {
      throw new ClaudeAdapterError('CLAUDE_CLOSED', 'conexão encerrada; reconecte antes de trocar os controles', null, true);
    }
    if (this._controlsFailed) {
      throw new ClaudeAdapterError('CLAUDE_CONTROLS_BLOCKED', 'uma troca anterior falhou sem restauração; novos envios e trocas ficam bloqueados até um adaptador novo', {...this._controlsFailedDetail}, true);
    }
    if (this._controlsChanging) {
      throw new ClaudeAdapterError('CLAUDE_CONTROLS_BUSY', 'outra troca de controles está em andamento; aguarde', null, true);
    }
    const desired = normalizeSelectionInput(selection);
    const gate = this._controlsGate();
    if (gate.allowed !== true) {
      throw new ClaudeAdapterError('CLAUDE_CONTROLS_BUSY', `não dá para trocar modelo/esforço agora (${gate.reason})`, {reason: gate.reason}, true);
    }
    if (!this._controlsHealthy()) {
      if (this._controlsState === 'initializing' || this._controlsInitPromise) {
        throw new ClaudeAdapterError('CLAUDE_CONTROLS_BUSY', 'os controles ainda estão inicializando; aguarde', {state: this._controlsState}, true);
      }
      const reason = this._controlsCatalog?.reason ?? controlsMod.REASONS.CATALOG_MISSING;
      throw new ClaudeAdapterError('CLAUDE_CONTROLS_REQUIRED', `controles não inicializados ou sem catálogo vivo (${reason}); chame initializeControls antes`, {reason, state: this._controlsState}, true);
    }
    const persist = typeof persistSelection === 'function' ? persistSelection : this._persistSelection;
    const compiled = this._compileSelection(desired);
    if (compiled.ok !== true) {
      throw new ClaudeAdapterError('CLAUDE_CONTROLS_INVALID', `seleção recusada pelo catálogo nativo (${compiled.reason})`, {reason: compiled.reason, detail: compiled.detail}, true);
    }
    const generation = this._generation;
    this._controlsChanging = true;
    try {
      const query = await this._bounded(this._ensureQuery(), this._controlsTimeoutMs, 'CLAUDE_CONTROLS_TIMEOUT');
      this._assertControlsQuery(query, generation);
      await this._commitNative(query, {model: compiled.model, effort: compiled.effort}, {
        bound: this._controlsTimeoutMs,
        persist: persist ? () => persist(compiled.patch) : null,
        guard: () => this._assertControlsQuery(query, generation),
      });
      this._selection = {model: compiled.model, effort: compiled.effort};
      return this.controlsSnapshot();
    } finally {
      this._controlsChanging = false;
    }
  }

  /* Fatos seguros para a UI montar o seletor e o esforço. `models` começa pela
     entrada reservada do default nativo (id '') e segue o catálogo no formato
     do seletor da Mesa; `levels` é o metadado do MODELO ESCOLHIDO (sem modelo
     explícito não há níveis: o compile exige modelo para esforço). Nunca
     devolve e-mail/organização/plano — só o nome do provedor já sanitizado. */
  controlsSnapshot() {
    const query = this._query;
    const catalog = this._controlsCatalog;
    const catalogOk = catalog?.ok === true;
    const queryAlive = Boolean(query && !this._queryDead && !this._closed);
    const modelApi = catalogOk && queryAlive && typeof query.setModel === 'function';
    const effortApi = modelApi && typeof query.applyFlagSettings === 'function';
    const view = catalogOk ? controlsMod.selectionView(catalog, {account: this._accountInfo()}) : null;
    const selection = {model: this._selection.model, effort: this._selection.effort};
    const compiled = this._compileSelection(selection);
    const selectionValid = compiled.ok === true;
    const levels = selectionValid && selection.model ? controlsMod.effortLevelsFor(catalog, selection.model) : [];
    const defaultEntry = Object.freeze({
      provider: 'anthropic',
      id: '',
      name: 'Padrão do Claude Code',
      description: 'Usa o modelo padrão da sessão',
      resolvedModel: null,
      default: true,
    });
    return {
      ready: modelApi,
      state: this._controlsState,
      models: modelApi && view ? Object.freeze([defaultEntry, ...view.models]) : Object.freeze([]),
      levels: Object.freeze(levels),
      selection,
      modelSelection: Boolean(modelApi && view && view.modelSelection),
      effort: Boolean(effortApi && selectionValid && selection.model && levels.length > 0),
      catalogReason: catalogOk ? null : (catalog?.reason ?? controlsMod.REASONS.CATALOG_MISSING),
      selectionValid,
      selectionReason: compiled && compiled.ok !== true ? compiled.reason : null,
      selectionDetail: compiled && compiled.ok !== true ? compiled.detail : null,
      observedModel: this._model,
      nativeSelection: {model: this._nativeSelection.model, effort: this._nativeSelection.effort},
      error: this._controlsError ? {...this._controlsError} : null,
      failed: this._controlsFailed,
    };
  }

  _accountInfo() {
    return this._accountProvider ? {apiProvider: this._accountProvider} : null;
  }

  _compileSelection(selection) {
    return controlsMod.compileSelection(selection, this._controlsCatalog, {account: this._accountInfo()});
  }

  _controlFacts() {
    return {
      busy: this._busy === true,
      hasTurn: Boolean(this._turn),
      permissionPending: this._permissions.size > 0,
      uncertain: this._deliveryUncertain === true,
    };
  }

  /* Portão do Bend (`canChangeControls`) decide; o módulo puro só NOMEIA o
     motivo com o mesmo veredito (os dois nunca são usados como autoridades
     concorrentes). */
  _controlsGate() {
    const facts = this._controlFacts();
    const allowed = deliveryCore.canChangeControls(facts.busy, facts.hasTurn, facts.permissionPending, facts.uncertain);
    if (allowed === true) return {allowed: true, reason: null, facts};
    const decision = controlsMod.canSwitchSelection({
      uncertain: facts.uncertain,
      busy: facts.busy,
      hasTurn: facts.hasTurn,
      pendingPermission: facts.permissionPending,
    });
    return {allowed: false, reason: decision.reason ?? controlsMod.SWITCH_REASONS.BUSY, facts};
  }

  /* Recusa do envio quando a escolha salva não pôde ser honrada. Nenhum código
     aqui sugere transmitir com outro modelo: é recusa comprovada (notSent). */
  _controlsSendBlock() {
    if (this._controlsFailed) {
      return new ClaudeAdapterError('CLAUDE_CONTROLS_BLOCKED', 'uma troca de controles falhou sem restauração; comece uma conversa nova antes de enviar', {...this._controlsFailedDetail}, true);
    }
    if (this._controlsChanging) {
      return new ClaudeAdapterError('CLAUDE_CONTROLS_BUSY', 'uma troca de controles está em andamento; aguarde antes de enviar', null, true);
    }
    const desired = this._selection;
    if (!desired.model && !desired.effort) return null;
    if (this._controlsState === 'idle') {
      return new ClaudeAdapterError('CLAUDE_CONTROLS_REQUIRED', 'há uma escolha de modelo/esforço salva, mas os controles ainda não foram inicializados; chame initializeControls antes de enviar', null, true);
    }
    if (this._controlsState === 'initializing') {
      return new ClaudeAdapterError('CLAUDE_CONTROLS_BUSY', 'os controles ainda estão inicializando; aguarde antes de enviar', null, true);
    }
    if (this._controlsState !== 'ready') {
      const reason = this._controlsError?.reason ?? this._controlsCatalog?.reason ?? controlsMod.REASONS.CATALOG_MISSING;
      const code = this._controlsError?.code === 'CLAUDE_CONTROLS_UNAVAILABLE' ? 'CLAUDE_CONTROLS_UNAVAILABLE' : 'CLAUDE_CONTROLS_INVALID';
      return new ClaudeAdapterError(code, `a escolha salva de modelo/esforço não pode ser honrada (${reason}); corrija antes de enviar`, {reason, state: this._controlsState}, true);
    }
    const compiled = this._compileSelection(desired);
    if (compiled.ok !== true) {
      return new ClaudeAdapterError('CLAUDE_CONTROLS_INVALID', `a escolha salva de modelo/esforço não vale contra o catálogo nativo (${compiled.reason}); corrija antes de enviar`, {reason: compiled.reason, detail: compiled.detail}, true);
    }
    if (this._nativeSelection.model !== compiled.model || this._nativeSelection.effort !== compiled.effort) {
      return new ClaudeAdapterError('CLAUDE_CONTROLS_DESYNC', 'a escolha salva ainda não foi aplicada à sessão nativa; chame initializeControls antes de enviar', {
        desired: {model: compiled.model, effort: compiled.effort},
        applied: {...this._nativeSelection},
      }, true);
    }
    return null;
  }

  _assertControlsQuery(query, generation) {
    if (this._closed || generation !== this._generation) {
      throw new ClaudeAdapterError('CLAUDE_CLOSED', 'a conexão foi encerrada durante a operação de controles; nada foi enviado', null, true);
    }
    if (this._query !== query || this._queryDead) {
      throw new ClaudeAdapterError('CLAUDE_QUERY_STALE', 'a consulta nativa terminou durante a operação de controles; nada foi aplicado', null, true);
    }
  }

  /* Prazo explícito para UMA operação nativa (a UI não fica pendurada em
     Query que não responde). */
  _bounded(promise, ms, code) {
    if (!Number.isFinite(ms) || ms <= 0) return Promise.resolve(promise);
    const timeout = Math.floor(ms);
    let timer = null;
    return Promise.race([
      Promise.resolve(promise),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new ClaudeAdapterError(code, `tempo esgotado (${timeout}ms)`, {timeoutMs: timeout}, true)), timeout);
        timer.unref?.();
      }),
    ]).finally(() => {
      if (timer) clearTimeout(timer);
    });
  }

  _assertControlApi(query, kind) {
    const method = kind === 'model' ? 'setModel' : 'applyFlagSettings';
    if (!query || typeof query[method] !== 'function') {
      throw new ClaudeAdapterError('CLAUDE_CONTROLS_UNAVAILABLE', `a consulta nativa não expõe ${method}(); controles desligados`, {method}, true);
    }
  }

  _nativeCall(query, kind, value, bound) {
    this._assertControlApi(query, kind);
    if (kind === 'model') {
      return this._bounded(Promise.resolve().then(() => query.setModel(value ?? undefined)), bound, 'CLAUDE_CONTROLS_TIMEOUT');
    }
    return this._bounded(Promise.resolve().then(() => query.applyFlagSettings({effortLevel: value ?? null})), bound, 'CLAUDE_CONTROLS_TIMEOUT');
  }

  /* Aplica deltas contra o estado NATIVO anterior e só marca como aplicado
     depois do sucesso; persistência vem por último e, se falhar, o nativo
     volta. Sem rollback possível, `_controlsFailed` é terminal. */
  async _commitNative(query, target, {bound, persist = null, guard = null} = {}) {
    const previous = {...this._nativeSelection};
    const steps = [];
    if (target.model !== previous.model) steps.push({kind: 'model', value: target.model});
    if (target.effort !== previous.effort) steps.push({kind: 'effort', value: target.effort});
    for (const step of steps) this._assertControlApi(query, step.kind);
    const attempted = [];
    try {
      for (const step of steps) {
        attempted.push(step);
        await this._nativeCall(query, step.kind, step.value, bound);
      }
    } catch (error) {
      const cause = asAdapterError(error, true, 'CLAUDE_CONTROLS_APPLY_FAILED');
      throw await this._restoreNative(query, previous, attempted, bound, {
        phase: 'apply',
        cause: cause.code,
        causeDetail: {message: cause.message, timedOut: cause.code === 'CLAUDE_CONTROLS_TIMEOUT'},
      });
    }
    if (typeof guard === 'function') guard();
    if (persist) {
      try {
        await persist();
      } catch (error) {
        const cause = asAdapterError(error, true, 'CLAUDE_CONTROLS_PERSIST_FAILED');
        throw await this._restoreNative(query, previous, steps, bound, {
          phase: 'persist',
          cause: cause.code,
          causeDetail: {message: cause.message},
        });
      }
    }
    this._nativeSelection = {model: target.model, effort: target.effort};
  }

  async _rollbackNative(query, previous, steps, bound) {
    for (const step of steps) {
      try {
        await this._nativeCall(query, step.kind, previous[step.kind], bound);
      } catch (error) {
        return {ok: false, kind: step.kind, error};
      }
    }
    return {ok: true, kind: null, error: null};
  }

  async _restoreNative(query, previous, steps, bound, {phase, cause, causeDetail}) {
    const rollback = await this._rollbackNative(query, previous, steps, bound);
    if (rollback.ok !== true) {
      this._controlsFailed = true;
      this._controlsFailedDetail = {
        phase,
        cause,
        rollback: rollback.kind,
        rollbackError: errorText(rollback.error),
      };
      throw new ClaudeAdapterError(
        'CLAUDE_CONTROLS_ROLLBACK_FAILED',
        `a troca de controles falhou e o estado anterior não pôde ser restaurado (${cause}); novos envios ficam bloqueados até um adaptador novo`,
        {...this._controlsFailedDetail},
        true,
      );
    }
    if (phase === 'persist') {
      throw new ClaudeAdapterError(
        'CLAUDE_CONTROLS_PERSIST_FAILED',
        `a troca foi aplicada à sessão, mas não pôde ser persistida; o estado anterior foi restaurado (${cause})`,
        {cause, ...causeDetail},
        true,
      );
    }
    throw new ClaudeAdapterError(
      'CLAUDE_CONTROLS_APPLY_FAILED',
      `não deu para aplicar a troca de modelo/esforço; o estado anterior foi restaurado (${cause})`,
      {cause, ...causeDetail},
      true,
    );
  }

  /* Um turno por vez. A promise só resolve no aceite comprovado E persistido. */
  async send(input = {}) {
    const id = typeof input?.id === 'string' && input.id.trim() ? input.id.trim() : crypto.randomUUID();
    const text = typeof input?.text === 'string' ? input.text : '';
    const images = Array.isArray(input?.images) ? input.images : [];
    const prepared = prepareMessage({text, images});

    if (!this._connected || this._closed) {
      throw new ClaudeAdapterError('CLAUDE_NOT_CONNECTED', 'conecte a conversa antes de enviar', null, true);
    }
    /* Entrega incerta (hidratada do descritor ou medida neste adaptador) é
       PEGAJOSA: nenhum envio novo a limpa. Recusa ANTES de marca no disco,
       consulta ou item no iterador — só um adaptador novo resolve. */
    if (this._deliveryUncertain) {
      throw new ClaudeAdapterError('CLAUDE_DELIVERY_UNCERTAIN', 'a entrega anterior está incerta; comece outra conversa antes de enviar', null, true);
    }
    /* Controles em troca/falha ou escolha salva não honrada recusam ANTES de
       qualquer marca no disco ou item no iterador. */
    const controlsBlock = this._controlsSendBlock();
    if (controlsBlock) throw controlsBlock;
    if (this._busy || this._turn) {
      throw new ClaudeAdapterError('CLAUDE_BUSY', 'já existe um turno em andamento; a fila espera o turno terminar', {id}, true);
    }

    const wireUuid = isUuid(id) ? id : crypto.randomUUID();
    const turn = {
      id,
      wireUuid,
      generation: this._generation,
      item: null,
      taken: false,
      phase: null,
      acceptAttempted: false,
      acceptResolved: false,
      degraded: false,
      finalized: false,
      delivered: new Set(),
      pending: null,
      timer: null,
      chain: Promise.resolve(),
      lateAckWarned: false,
      foreignWarned: false,
      foreignSeen: false,
      announcedRateLimits: new Set(),
      /* Fatos por turno para classificar o `result` (limite/autenticação),
         sem contaminação entre turnos. */
      rejectedRateLimitTypes: new Set(),
      latestAssistantRateLimited: false,
      authenticationFailure: false,
      lastRateLimit: null,
      apiRetries: new Set(),
      history: null,
    };
    turn.pending = {settled: false, resolve: null, reject: null};
    turn.history = new Promise((resolve, reject) => {
      turn.pending.resolve = resolve;
      turn.pending.reject = reject;
    });
    /* Ninguém pode deixar o processo morrer por um reject interno. O caller que
       fizer await continua vendo a rejeição. */
    turn.history.catch(() => {});

    this._busy = true;
    this._turn = turn;
    this._cancelRequested = false;
    this._runId = wireUuid;

    /* 1) marca de envio iniciado no disco ANTES de entregar qualquer coisa. */
    const transmitting = await this._record(turn, 'transmitting');
    if (!transmitting.ok) {
      this._busy = false;
      this._turn = null;
      this._runId = null;
      throw new ClaudeAdapterError(
        'CLAUDE_PERSIST_FAILED',
        `não deu para registrar o envio iniciado; nada foi enviado (${errorText(transmitting.error)})`,
        null,
        true,
      );
    }
    this._emitDelivery(turn, 'transmitting');
    this._emitTurn(turn, 'turn_start', {model: this._model});

    /* 2) sobe/reaproveita o processo do SDK. Falha aqui é recusa comprovada. */
    try {
      await this._ensureQuery();
    } catch (error) {
      const failure = asAdapterError(error, true, 'CLAUDE_QUERY_START_FAILED');
      await this._enqueue(turn, () => this._refuseBeforeDelivery(turn, failure));
      return turn.history;
    }

    const item = {
      type: 'user',
      message: {role: 'user', content: prepared.blocks},
      parent_tool_use_id: null,
      uuid: wireUuid,
      session_id: this._sessionId || undefined,
    };
    turn.item = item;

    /* 3) entrega ao AsyncIterable (não é aceite; só replay/carimbo é). */
    try {
      this._queue.push(item);
    } catch (error) {
      const failure = asAdapterError(error, true, 'CLAUDE_DELIVERY_REFUSED');
      await this._enqueue(turn, () => this._refuseBeforeDelivery(turn, failure));
      return turn.history;
    }

    turn.timer = setTimeout(() => {
      this._enqueue(turn, () => this._timeoutTurn(turn)).catch(() => {});
    }, this._timeoutMs);
    turn.timer.unref?.();
    return turn.history;
  }

  /* Interrompe o turno. Permissões/perguntas pendentes são negadas aqui;
     busy continua até `result`/fim de consulta/close (nada é inferido). */
  async cancel() {
    this._cancelRequested = true;
    this._invalidatePermissions('Cancelado pelo usuário', this._turn, 'user');
    const query = this._query;
    if (!query || !this._busy) return {cancelled: false, requested: true};
    try {
      if (typeof query.interrupt === 'function') await query.interrupt();
    } catch (error) {
      this._emit('warning', {message: `não deu para interromper a consulta (${errorText(error)})`, code: 'CLAUDE_INTERRUPT_FAILED'});
    }
    return {cancelled: true, requested: true};
  }

  /* Resposta de permissão/pergunta. `allow` de confirmação só com
     confirmed === true; pergunta exige `answers` estruturadas e validadas
     (nunca `confirmed` sozinho). Nunca aplica `updatedPermissions`/sugestões
     globais. ID vencido/desconhecido não aceita nada. */
  respond(input = {}) {
    const id = input && typeof input.id === 'string' ? input.id : null;
    const entry = id ? this._permissions.get(id) : null;
    if (!entry) return {ok: false, id, code: 'CLAUDE_PERMISSION_UNKNOWN'};

    if (input.cancelled === true) {
      this._emit('permission_cancelled', {id, reason: 'user'});
      entry.finish({behavior: 'deny', message: 'Cancelado pelo usuário'});
      return {ok: true, id, cancelled: true};
    }

    if (entry.method === 'question') {
      if (input.confirmed === false) {
        entry.finish({behavior: 'deny', message: 'Recusado pelo usuário'});
        return {ok: true, id, allowed: false};
      }
      if (input.answers === undefined || input.answers === null) {
        return {ok: false, id, code: 'CLAUDE_QUESTION_ANSWERS_REQUIRED'};
      }
      const validation = validateQuestionAnswers(entry.questions, input.answers);
      if (!validation.ok) return {ok: false, id, code: validation.code, detail: validation.detail};
      const result = {behavior: 'allow', updatedInput: {questions: entry.rawQuestions, answers: validation.answers}};
      if (entry.toolUseID) result.toolUseID = entry.toolUseID;
      entry.finish(result);
      return {ok: true, id, allowed: true, answers: validation.answers};
    }

    if (input.confirmed !== true) {
      entry.finish({behavior: 'deny', message: 'Recusado pelo usuário'});
      return {ok: true, id, allowed: false};
    }

    entry.finish({behavior: 'allow'});
    return {ok: true, id, allowed: true};
  }

  /* Histórico da PRÓPRIA sessão via API oficial; `options.sessionId` é ignorado
     de propósito (nunca consultar outra conversa). Pagina até o limite
     explícito (teto de 200/8 MB — não é histórico completo; o export é do
     host). Sem exigir login/conexão e sem reexecutar ferramenta. */
  async history(options = {}) {
    this.historyComplete = false;
    const sessionId = this._sessionId;
    if (!sessionId) return [];
    const sdk = await this._loadSdk();
    const getSessionMessages = typeof sdk?.getSessionMessages === 'function'
      ? sdk.getSessionMessages
      : sdk?.default?.getSessionMessages;
    if (typeof getSessionMessages !== 'function') {
      throw new ClaudeAdapterError('CLAUDE_SDK_UNAVAILABLE', 'getSessionMessages indisponível no SDK oficial', null, false);
    }
    const requested = Number.isFinite(options.limit) && options.limit > 0 ? Math.floor(options.limit) : MAX_HISTORY_MESSAGES;
    const limit = Math.min(requested, MAX_HISTORY_MESSAGES);
    const offset = Number.isFinite(options.offset) && options.offset > 0 ? Math.floor(options.offset) : 0;
    const raw = [];
    let cursor = offset;
    let pages = 0;
    while (raw.length < limit && pages < MAX_HISTORY_PAGES) {
      pages += 1;
      const page = await getSessionMessages(sessionId, {dir: this._cwd || undefined, limit: limit - raw.length, offset: cursor});
      if (!Array.isArray(page)) throw new ClaudeAdapterError('CLAUDE_HISTORY_UNAVAILABLE', 'Formato de histórico inesperado do SDK', null, false);
      if (page.length === 0) { this.historyComplete = true; break; }
      raw.push(...page);
      cursor += page.length;
    }
    if (raw.length >= limit && options.limit == null) {
      const tail = await getSessionMessages(sessionId, {dir: this._cwd || undefined, limit: 1, offset: cursor});
      this.historyComplete = Array.isArray(tail) && tail.length === 0;
      if (!this.historyComplete) this._emit('warning', {
        message: `A prévia nativa mostra as primeiras ${limit} mensagens. O cache local recente foi preservado; use Exportar para consultar o histórico.`,
        code: 'CLAUDE_HISTORY_TRUNCATED',
      });
    }
    return normalizeHistory(raw, {
      maxBytes: MAX_HISTORY_BYTES,
      onTruncate: (info) => { this.historyComplete = false; this._emit('warning', {
        message: `histórico maior que o teto de ${info.maxBytes} bytes: ${info.kept} de ${info.total} mensagens exibidas; exportação completa é do host`,
        code: 'CLAUDE_HISTORY_TRUNCATED',
      }); },
    });
  }

  /* Encerra APENAS a própria consulta. Não apaga sessão nem estado: o
     histórico continua recuperável. A liquidação do turno (recusa/incerteza)
     é persistida e só então o `turn_end` sai. */
  close() {
    if (this._closed) return;
    this._closed = true;
    this._generation += 1;
    const turn = this._turn;
    const cancelRequested = this._cancelRequested;
    if (turn) {
      this._turn = null;
      this._busy = false;
      this._runId = null;
      this._cancelRequested = false;
    }
    this._invalidatePermissions('Conexão encerrada', turn, 'close');
    const queue = this._queue;
    const query = this._query;
    this._queue = null;
    this._query = null;
    this._queryDead = true;
    /* O catálogo/controles pertenciam à Query encerrada; a escolha DESEJADA
       (`_selection`) e o bloqueio terminal (`_controlsFailed`) permanecem. */
    this._controlsState = 'idle';
    this._controlsCatalog = null;
    this._controlsError = null;
    this._nativeSelection = {model: null, effort: null};
    /* A incerteza de entrega NÃO é limpa aqui: é pegajosa até um adaptador
       novo (close/reconnect deste objeto continua bloqueado para envio). */
    /* Janelas rejeitadas são estado da sessão encerrada: a próxima conexão
       não herda pausa nem transição de liberação. */
    this._rejectedWindows.clear();
    if (queue) queue.end();
    try {
      if (query && typeof query.close === 'function') {
        const result = query.close();
        if (result && typeof result.catch === 'function') result.catch(() => {});
      }
    } catch {
      /* fechar à força não pode derrubar o chamador */
    }
    if (turn && !turn.finalized) {
      /* close() do host NÃO é fim nativo observado: o desfecho é conservador
         mesmo com aceite e cancelamento (`endKind:'close'`). */
      const end = turnPolicy.classifyQueryEnd({
        accepted: turn.acceptResolved,
        taken: turn.taken,
        phase: turn.phase,
        cancelled: cancelRequested,
        degraded: turn.degraded,
        endKind: 'close',
      });
      this._enqueue(turn, () => this._finalizeTurn(turn, end.outcome, {
        cancelled: true,
        isError: true,
        message: 'close da conexão antes da confirmação',
        reason: 'close',
      })).catch(() => {});
    }
  }

  stop() {
    this.close();
  }

  /* ---------------- interno ---------------- */

  _emit(type, payload = {}, identity = null) {
    this.emit('event', {
      type,
      conversationId: this._conversationId,
      runId: identity ? identity.runId : this._runId,
      generation: identity ? identity.generation : this._generation,
      adapter: 'claude',
      at: new Date().toISOString(),
      ...payload,
    });
  }

  _emitTurn(turn, type, payload = {}) {
    this._emit(type, payload, {runId: turn.wireUuid, generation: turn.generation});
  }

  _emitDelivery(turn, status) {
    if (turn.delivered.has(status)) return;
    turn.delivered.add(status);
    /* Incerteza de entrega é fato PEGAJOSO do adaptador (o Bend a usa no
       portão dos controles e no envio): só um adaptador novo resolve. */
    if (status === 'uncertain') this._deliveryUncertain = true;
    this._emitTurn(turn, 'delivery', {id: turn.id, status});
  }

  _enqueue(turn, fn) {
    const run = () => Promise.resolve().then(fn);
    const next = turn.chain.then(run, run);
    turn.chain = next.then(() => undefined, () => undefined);
    return next;
  }

  _clearTimer(turn) {
    if (turn.timer) {
      clearTimeout(turn.timer);
      turn.timer = null;
    }
  }

  _rejectPending(turn, error) {
    if (!turn.pending || turn.pending.settled) return;
    turn.pending.settled = true;
    this._clearTimer(turn);
    turn.pending.reject(error);
  }

  /* Registro de entrega: idempotente por status, callback sync OU async é
     aguardado. Falha NÃO muda a fase (conservador). */
  async _record(turn, status, detail) {
    if (turn.phase === status) return {ok: true, changed: false};
    if (!this._persistDelivery) {
      turn.phase = status;
      return {ok: true, changed: true};
    }
    try {
      await this._persistDelivery(detail ? {id: turn.id, status, ...detail} : {id: turn.id, status});
      turn.phase = status;
      return {ok: true, changed: true};
    } catch (error) {
      return {ok: false, changed: false, error};
    }
  }

  _invalidatePermissions(message, turn = null, reason = null) {
    for (const [id, entry] of [...this._permissions.entries()]) {
      this._permissions.delete(id);
      if (turn) this._emitTurn(turn, 'permission_cancelled', reason ? {id, reason} : {id});
      else this._emit('permission_cancelled', reason ? {id, reason} : {id});
      entry.finish({behavior: 'deny', message});
    }
  }

  /* Prazo do pedido: ID vencido nega e sai da fila; nunca vira allow. */
  _expirePermission(id) {
    const entry = this._permissions.get(id);
    if (!entry || entry.done) return;
    this._emit('permission_cancelled', {id, reason: 'expired'});
    entry.finish({behavior: 'deny', message: 'O pedido expirou sem resposta'});
  }

  _permissionExpiresAt() {
    if (!this._permissionTtlMs) return null;
    return new Date(Date.now() + this._permissionTtlMs).toISOString();
  }

  _emitInitOnce(turn) {
    if (this._initEmitted || !this._sessionId) return;
    this._initEmitted = true;
    const payload = {
      sessionId: this._sessionId,
      version: this._version || null,
      model: this._model || null,
      executable: this._claudePath,
    };
    if (turn) this._emitTurn(turn, 'init', payload);
    else this._emit('init', payload);
  }

  _finishTurn(turn) {
    if (!turn || this._turn === turn) {
      this._busy = false;
      this._turn = null;
      this._runId = null;
      this._cancelRequested = false;
      this._toolNames.clear();
      this._streamed.clear();
    }
  }

  /* Aceite comprovado: primeiro PERSISTE, só então resolve o envio. Se o
     registro falhar, o turno vira incerto e a mensagem nunca é repetida. */
  async _resolveAccepted(turn) {
    if (turn.acceptResolved || turn.finalized || turn.acceptAttempted) return;
    turn.acceptAttempted = true;
    this._emitInitOnce(turn);
    const recorded = await this._record(turn, 'accepted');
    if (recorded.ok) {
      turn.acceptResolved = true;
      this._emitDelivery(turn, 'accepted');
      this._clearTimer(turn);
      if (turn.pending && !turn.pending.settled) {
        turn.pending.settled = true;
        turn.pending.resolve({accepted: true, id: turn.id});
      }
      return;
    }
    turn.degraded = true;
    this._emitTurn(turn, 'error', {
      message: `o aceite foi comprovado, mas não deu para registrar; tratado como incerto e nunca repetido (${errorText(recorded.error)})`,
      code: 'CLAUDE_PERSIST_FAILED',
      detail: {phase: 'accepted'},
    });
    await this._record(turn, 'uncertain');
    this._emitDelivery(turn, 'uncertain');
    this._rejectPending(turn, new ClaudeAdapterError(
      'CLAUDE_DELIVERY_UNCERTAIN',
      'o aceite foi comprovado mas não pôde ser registrado; a mensagem NÃO é repetida automaticamente',
      {persistFailure: true, phase: 'accepted'},
      false,
    ));
  }

  async _timeoutTurn(turn) {
    if (turn.finalized || turn.acceptResolved || turn.phase !== 'transmitting') return;
    const recorded = await this._record(turn, 'uncertain', {timedOut: true});
    if (!recorded.ok) {
      this._emitTurn(turn, 'error', {
        message: `tempo esgotado sem confirmação e o registro incerto falhou (${errorText(recorded.error)}); o registro anterior fica como está`,
        code: 'CLAUDE_PERSIST_FAILED',
        detail: {phase: 'uncertain'},
      });
    }
    this._emitDelivery(turn, 'uncertain');
    this._rejectPending(turn, new ClaudeAdapterError(
      'CLAUDE_DELIVERY_UNCERTAIN',
      'tempo esgotado sem confirmação de recebimento; a mensagem não é repetida automaticamente',
      {timedOut: true},
      false,
    ));
  }

  /* Falha comprovada ANTES do yield: tentar registrar recusa; se o registro
     falhar, cai para incerto (conservador) em vez de prometer recusa. */
  async _refuseBeforeDelivery(turn, failure) {
    if (turn.finalized) return;
    turn.finalized = true;
    this._clearTimer(turn);
    const recorded = await this._record(turn, 'refused');
    if (recorded.ok) {
      this._emitDelivery(turn, 'refused');
      this._emitTurn(turn, 'error', {message: failure.message, code: failure.code});
      this._rejectPending(turn, failure);
      this._emitTurn(turn, 'turn_end', {cancelled: false, isError: true, uncertain: false});
      this._finishTurn(turn);
      return;
    }
    await this._record(turn, 'uncertain');
    this._emitTurn(turn, 'error', {
      message: `a recusa não pôde ser registrada; tratado como incerto (${errorText(recorded.error)})`,
      code: 'CLAUDE_PERSIST_FAILED',
      detail: {phase: 'refused', cause: failure.code},
    });
    this._emitDelivery(turn, 'uncertain');
    this._rejectPending(turn, new ClaudeAdapterError(
      'CLAUDE_DELIVERY_UNCERTAIN',
      'a recusa não pôde ser registrada; tratado como incerto e nunca repetido automaticamente',
      {persistFailure: true, phase: 'refused', cause: failure.code},
      false,
    ));
    this._emitTurn(turn, 'turn_end', {cancelled: false, isError: true, uncertain: true});
    this._finishTurn(turn);
  }

  /* Fim de turno: persistir o desfecho ANTES do evento final. */
  async _finalizeTurn(turn, outcome, meta = {}) {
    if (turn.finalized) return;
    turn.finalized = true;
    this._clearTimer(turn);
    this._invalidatePermissions('Rodada terminou', turn, 'turn_end');
    let uncertain = outcome !== 'settled';

    if (outcome === 'settled') {
      const recorded = await this._record(turn, 'settled');
      if (recorded.ok) {
        uncertain = false;
        this._emitDelivery(turn, 'settled');
      } else {
        uncertain = true;
        await this._record(turn, 'uncertain');
        this._emitTurn(turn, 'error', {
          message: `não deu para registrar o término do turno; mantido como incerto (${errorText(recorded.error)})`,
          code: 'CLAUDE_PERSIST_FAILED',
          detail: {phase: 'settled'},
        });
        this._emitDelivery(turn, 'uncertain');
      }
    } else if (outcome === 'refused') {
      const recorded = await this._record(turn, 'refused');
      if (recorded.ok) {
        uncertain = false;
        this._emitDelivery(turn, 'refused');
        this._rejectPending(turn, meta.error || new ClaudeAdapterError(
          'CLAUDE_DELIVERY_REFUSED',
          `nada foi enviado ao Claude Code (${meta.message || 'queda antes da entrega'})`,
          meta.detail || null,
          true,
        ));
      } else {
        uncertain = true;
        await this._record(turn, 'uncertain');
        this._emitTurn(turn, 'error', {
          message: `a recusa não pôde ser registrada; tratado como incerto (${errorText(recorded.error)})`,
          code: 'CLAUDE_PERSIST_FAILED',
          detail: {phase: 'refused'},
        });
        this._emitDelivery(turn, 'uncertain');
        this._rejectPending(turn, new ClaudeAdapterError(
          'CLAUDE_DELIVERY_UNCERTAIN',
          'a recusa não pôde ser registrada; tratado como incerto e nunca repetido automaticamente',
          {persistFailure: true, phase: 'refused'},
          false,
        ));
      }
    } else {
      uncertain = true;
      const recorded = await this._record(turn, 'uncertain', meta.recordDetail);
      if (!recorded.ok) {
        this._emitTurn(turn, 'error', {
          message: `não deu para registrar a incerteza (${errorText(recorded.error)}); o registro anterior fica como está`,
          code: 'CLAUDE_PERSIST_FAILED',
          detail: {phase: 'uncertain'},
        });
      }
      this._emitDelivery(turn, 'uncertain');
      this._rejectPending(turn, meta.error || new ClaudeAdapterError(
        'CLAUDE_DELIVERY_UNCERTAIN',
        `a mensagem pode ter chegado ao Claude Code sem confirmação (${meta.message || 'sem confirmação'}); não é repetida automaticamente`,
        meta.detail || null,
        false,
      ));
    }

    this._emitTurn(turn, 'turn_end', {
      cancelled: meta.cancelled === true,
      isError: meta.isError === true,
      uncertain,
    });
    this._finishTurn(turn);
  }

  async _loadSdk() {
    if (this._sdk) return this._sdk;
    if (this._sdkLoader) {
      this._sdk = await this._sdkLoader();
      return this._sdk;
    }
    this._sdk = await import('@anthropic-ai/claude-agent-sdk');
    return this._sdk;
  }

  async _ensureQuery() {
    if (this._query && !this._queryDead) return this._query;
    let queryFn = this._queryFactory;
    if (!queryFn) {
      const sdk = await this._loadSdk();
      queryFn = typeof sdk?.query === 'function'
        ? sdk.query
        : sdk?.default?.query;
    }
    if (typeof queryFn !== 'function') {
      throw new ClaudeAdapterError('CLAUDE_SDK_UNAVAILABLE', 'query() indisponível no SDK oficial', null, true);
    }
    const generation = this._generation;
    const queue = new MessageQueue();
    queue.onTaken = (item) => {
      /* O item passou pelo yield: a sessão nativa passa a existir de fato. É
         isso (não a mera criação da Query de catálogo) que autoriza `resume`. */
      this._promptDelivered = true;
      const turn = this._turn;
      if (turn && !turn.finalized && item === turn.item) turn.taken = true;
    };
    const options = this._buildOptions(generation);
    if(this._createMaterial){
      options.mcpServers={mesa:await createTutorPdfServer(args=>{
        if(generation!==this._generation||this._closed)throw Error('Conversa encerrada.');
        return this._createMaterial(args);
      })};
      options.allowedTools=[TUTOR_PDF_TOOL];
    }
    if(generation!==this._generation||this._closed)throw new ClaudeAdapterError('CLAUDE_QUERY_STALE','a consulta foi encerrada durante a inicialização',null,true);
    const query = await Promise.resolve(queryFn({prompt: queue, options}));
    if (generation !== this._generation) {
      try {
        if (query && typeof query.close === 'function') query.close();
      } catch {
        /* descartar consulta velha não pode derrubar o envio */
      }
      throw new ClaudeAdapterError('CLAUDE_QUERY_STALE', 'a consulta foi encerrada durante a inicialização', null, true);
    }
    if (!query || typeof query[Symbol.asyncIterator] !== 'function') {
      try {
        if (query && typeof query.close === 'function') query.close();
      } catch {
        /* fechar o que não é iterador não pode derrubar a recusa */
      }
      throw new ClaudeAdapterError('CLAUDE_SDK_UNAVAILABLE', 'query() do SDK não devolveu um iterador', null, true);
    }
    this._queue = queue;
    this._query = query;
    this._queryDead = false;
    this._consume(query, generation);
    return query;
  }

  _buildOptions(generation) {
    const options = {
      cwd: this._cwd,
      settingSources: [],
      strictMcpConfig: true,
      mcpServers: {},
      tools: [...SDK_TOOLS],
      disallowedTools: [...DISALLOWED_TOOLS],
      permissionMode: 'default',
      includePartialMessages: true,
      /* Flag PÚBLICA da CLI: ecoa a mensagem do usuário de volta com
         `isReplay: true`, que é a evidência de aceite usada pela ponte. */
      extraArgs: {'replay-user-messages': null},
      canUseTool: (toolName, input, opts) => this._canUseTool(generation, toolName, input, opts),
      hooks: {PreToolUse: [{hooks: [async (input) => this._preToolUse(generation, input)]}]},
      env: this._spawnEnv(),
    };
    if (this._claudePath) options.pathToClaudeCodeExecutable = this._claudePath;
    if (this._systemPrompt) options.systemPrompt = this._systemPrompt;
    if (this._sessionId) {
      /* ID explícito vindo do registro: na primeira consulta ele É o ID nativo
         (retomada por ID exato depois); ao reconectar, `resume` com o mesmo ID.
         Nunca se combinam `sessionId` e `resume` na mesma consulta. A retomada
         exige prompt JÁ ENTREGUE: a Query de catálogo sem prompt não conta. */
      if (this._resume || this._promptDelivered) options.resume = this._sessionId;
      else options.sessionId = this._sessionId;
    }
    return options;
  }

  /* Env do subprocesso: mescla process.env + overrides; desliga o
     auto-update SÓ deste processo (sem tocar em config global). */
  _spawnEnv() {
    const base = {...process.env};
    if (this._childEnv) Object.assign(base, this._childEnv);
    base.CLAUDE_AGENT_SDK_CLIENT_APP = CLAUDE_CLIENT_APP;
    base.DISABLE_AUTOUPDATER = '1';
    return base;
  }

  async _consume(query, generation) {
    let failure = null;
    try {
      for await (const message of query) {
        if (generation !== this._generation) return;
        try {
          await this._handleMessage(message);
        } catch (error) {
          this._emit('warning', {message: `mensagem ignorada (${errorText(error)})`, code: 'CLAUDE_MESSAGE_DISCARDED'});
        }
      }
    } catch (error) {
      failure = error;
    } finally {
      if (generation === this._generation) await this._finishQuery(failure);
    }
  }

  async _finishQuery(failure) {
    this._queryDead = true;
    this._query = null;
    this._queue = null;
    /* A Query morreu: o catálogo e o estado nativo dela não valem mais. A
       escolha DESEJADA fica para a próxima inicialização explícita. */
    this._controlsState = 'idle';
    this._controlsCatalog = null;
    this._controlsError = null;
    this._nativeSelection = {model: null, effort: null};
    this._invalidatePermissions('Consulta encerrada', this._turn, 'query_end');
    const turn = this._turn;
    /* Fim NATIVO observado (`endKind:'query'`), com ou sem erro de iterador.
       Cancelamento explícito + aceite comprovado + não degradado ⇒ settled
       cancelled sem incerteza; qualquer outra combinação preserva a espera. */
    const end = turn && !turn.finalized
      ? turnPolicy.classifyQueryEnd({
        accepted: turn.acceptResolved,
        taken: turn.taken,
        phase: turn.phase,
        cancelled: this._cancelRequested,
        degraded: turn.degraded,
        endKind: 'query',
        failure: failure || null,
      })
      : null;
    /* Cancelamento comprovado com fim nativo observado não vira erro fatal de
       consulta: o turn_end cancelled/uncertain é o desfecho. */
    const settledCancelledEnd = Boolean(end && end.outcome === 'settled' && end.cancelled === true);
    if (failure && !settledCancelledEnd) {
      this._emit('error', {message: `consulta do Claude Code terminou com erro: ${errorText(failure)}`, code: 'CLAUDE_QUERY_ERROR'});
    }
    if (end) {
      await this._enqueue(turn, () => this._finalizeTurn(turn, end.outcome, {
        cancelled: end.cancelled,
        isError: true,
        message: failure ? `consulta encerrada (${errorText(failure)})` : 'consulta encerrada sem confirmação',
        reason: 'query-ended',
      }));
      return;
    }
    if (!failure && this._connected && !this._closed) {
      this._emit('warning', {message: 'o processo do Claude Code terminou sem turno em andamento', code: 'CLAUDE_QUERY_ENDED'});
    }
  }

  /* Sessão divergente nunca muda a identidade em silêncio: avisa uma vez e o
     evento é descartado (nem conteúdo, nem correlação). */
  _sessionMatches(message) {
    const sid = typeof message?.session_id === 'string' && message.session_id ? message.session_id : null;
    if (!sid) return true;
    if (!this._sessionId) {
      this._sessionId = sid;
      return true;
    }
    if (sid === this._sessionId) return true;
    if (!this._foreignSessions.has(sid)) {
      this._foreignSessions.add(sid);
      this._emit('warning', {
        message: 'evento de outra sessão do Claude Code foi ignorado; a identidade desta conversa não muda',
        code: 'CLAUDE_SESSION_MISMATCH',
      });
    }
    return false;
  }

  async _handleMessage(message) {
    if (!message || typeof message !== 'object') return;
    const subagent = message.parent_tool_use_id != null;
    if (!subagent && !this._sessionMatches(message)) return;

    const turn = this._turn;
    if (!subagent && turn && !turn.finalized) {
      const correlation = turnPolicy.correlationEvidence(message, turn.wireUuid);
      if (correlation.evidence === 'match') {
        if (!turn.acceptResolved) {
          if (turn.phase === 'transmitting') {
            await this._enqueue(turn, () => this._resolveAccepted(turn));
          } else {
            this._noteLateAck(turn);
          }
        }
      } else if (correlation.evidence === 'mismatch') {
        /* Eco estrangeiro EXPLÍCITO (result ou não) marca o turno para sempre:
           nenhum result sem eco deste turno pode liquidá-lo depois. */
        turn.foreignSeen = true;
        if (message.type === 'result') {
          this._emitTurn(turn, 'warning', {message: 'resultado de outro envio foi ignorado; o turno atual continua', code: 'CLAUDE_RESULT_FOREIGN'});
          return;
        }
        if (!turn.foreignWarned) {
          turn.foreignWarned = true;
          this._emitTurn(turn, 'warning', {message: 'mensagem de outro envio foi ignorada na conversa principal', code: 'CLAUDE_MESSAGE_FOREIGN'});
        }
        return;
      }
    }

    if (message.type === 'user' && message.isReplay === true) return;

    switch (message.type) {
      case 'system':
        this._handleSystem(message);
        break;
      case 'rate_limit_event':
        this._handleRateLimit(message);
        break;
      case 'auth_status':
        if (message.error) {
          this._emit('warning', {message: `estado de autenticação: ${String(message.error)}`, code: 'CLAUDE_AUTH_STATUS'});
        }
        break;
      case 'stream_event':
        this._handleStreamEvent(message);
        break;
      case 'assistant':
        this._handleAssistant(message);
        break;
      case 'user':
        this._handleUser(message);
        break;
      case 'result':
        await this._handleResult(message);
        break;
      default:
        break;
    }
  }

  _noteLateAck(turn) {
    if (turn.lateAckWarned || turn.acceptResolved) return;
    turn.lateAckWarned = true;
    this._emitTurn(turn, 'warning', {
      message: 'confirmação atrasada ignorada: o turno já não aguardava aceite (nada é repetido)',
      code: 'CLAUDE_LATE_ACK',
    });
  }

  _handleSystem(message) {
    if (message.parent_tool_use_id != null) return;
    const subtype = message.subtype;
    if (subtype === 'init') {
      if (typeof message.claude_code_version === 'string' && message.claude_code_version) this._version = message.claude_code_version;
      if (typeof message.model === 'string' && message.model) this._model = message.model;
      this._emitInitOnce(this._turn);
      const servers = Array.isArray(message.mcp_servers) ? message.mcp_servers : [];
      const unexpected = servers.filter(server=>!(this._createMaterial&&server?.name==='mesa'));
      if (unexpected.length) {
        this._emit('warning', {message: `MCP inesperado nesta sessão: ${unexpected.map((server) => server?.name).filter(Boolean).join(', ')}`, code: 'CLAUDE_MCP_UNEXPECTED'});
      }
      return;
    }
    if (subtype === 'compact_boundary') {
      this._emit('warning', {message: 'O Claude Code compactou o contexto desta conversa.', code: 'CLAUDE_COMPACTED'});
      return;
    }
    if (subtype === 'informational' && (message.level === 'warning' || message.level === 'suggestion')) {
      this._emit('warning', {message: String(message.content || ''), code: 'CLAUDE_INFORMATIONAL'});
      return;
    }
    if (subtype === 'api_retry') {
      this._handleApiRetry(message);
      return;
    }
    if (subtype === 'rate_limit_event') {
      this._handleRateLimit(message);
      return;
    }
    if (subtype === 'model_refusal_fallback' || subtype === 'model_refusal_no_fallback') {
      this._handleRefusalNotice(message);
    }
  }

  /* `api_retry` nativo (SDK pinado): preserva tentativa/máximo/atraso/status,
     com o código canônico (429/529 inclusos). NUNCA encerra turno, não mexe em
     entrega/fila e não reenvia; o mesmo attempt é deduplicado no turno. */
  _handleApiRetry(message) {
    const retry = turnPolicy.classifyApiRetry(message);
    if (!retry) return;
    const turn = this._rateLimitActiveTurn();
    const seen = turn ? turn.apiRetries : this._apiRetryNotices;
    if (seen.has(retry.dedupeKey)) return;
    seen.add(retry.dedupeKey);
    if (!turn) {
      while (this._apiRetryNotices.size > MAX_RATE_LIMIT_NOTICES) {
        const oldest = this._apiRetryNotices.keys().next().value;
        this._apiRetryNotices.delete(oldest);
      }
    }
    const payload = {message: retry.message, code: retry.code, detail: retry.detail};
    if (turn) this._emitTurn(turn, 'warning', payload);
    else this._emit('warning', payload);
  }

  /* Recusa/fallback do modelo (SDK 0.3.246): aviso com dados limitados e a
     retração exposta no detalhe (UUIDs limitados/deduplicados). A evicção de
     DOM fica explicitamente ADIADA: o adaptador não remove mensagem nenhuma. */
  _handleRefusalNotice(message) {
    const refusal = turnPolicy.classifyRefusalNotice(message);
    if (!refusal) return;
    let text = refusal.notice;
    if (!text && refusal.kind === 'no_fallback') {
      text = `o modelo recusou a solicitação (${refusal.detail.apiRefusalCategory || 'sem categoria'})`;
    } else if (!text && refusal.detail.retractedMessageUuids.length) {
      text = 'o modelo original recusou parte da resposta; o texto anterior foi retratado';
    }
    if (!text) return;
    const payload = {message: text, code: refusal.code, detail: refusal.detail};
    const turn = this._rateLimitActiveTurn();
    if (turn) this._emitTurn(turn, 'warning', payload);
    else this._emit('warning', payload);
  }

  /* ---------------- limite de uso (rate_limit_event) ---------------- */

  _rateLimitOverage(info) {
    return info.overageStatus === 'allowed'
      || info.overageStatus === 'allowed_warning'
      || info.isUsingOverage === true
      || info.overageInUse === true;
  }

  _rateLimitActiveTurn() {
    return this._turn && !this._turn.finalized ? this._turn : null;
  }

  _rateLimitAnnounced(key) {
    const turn = this._rateLimitActiveTurn();
    if (turn) return turn.announcedRateLimits.has(key);
    return this._rateLimitNotices.has(key);
  }

  _rateLimitRemember(key) {
    const turn = this._rateLimitActiveTurn();
    if (turn) {
      turn.announcedRateLimits.add(key);
      return;
    }
    this._rateLimitNotices.set(key, true);
    if (this._rateLimitNotices.size > MAX_RATE_LIMIT_NOTICES) {
      const oldest = this._rateLimitNotices.keys().next().value;
      this._rateLimitNotices.delete(oldest);
    }
  }

  /* `allowed` libera a janela: um novo rejected da mesma janela volta a
     avisar em vez de ficar silencioso para sempre. */
  _forgetRateLimit(type) {
    const marker = `:${type}:`;
    const turn = this._rateLimitActiveTurn();
    if (turn) {
      for (const key of [...turn.announcedRateLimits]) {
        if (key.includes(marker)) turn.announcedRateLimits.delete(key);
      }
    }
    for (const key of [...this._rateLimitNotices.keys()]) {
      if (key.includes(marker)) this._rateLimitNotices.delete(key);
    }
  }

  /* Memória de janelas REJEITADAS (pode haver várias ao mesmo tempo). É o que
     permite emitir UMA transição de liberação por janela, e não a cada
     `allowed` repetido. */
  _rememberRejectedWindow(type, info) {
    this._rejectedWindows.set(type, {resetsAt: Number.isFinite(info.resetsAt) ? info.resetsAt : null});
    if (this._rejectedWindows.size > MAX_RATE_LIMIT_NOTICES) {
      const oldest = this._rejectedWindows.keys().next().value;
      this._rejectedWindows.delete(oldest);
    }
  }

  /* Transição rejected → allowed: UM aviso canônico para a UI limpar a pausa.
     Só sai quando a janela estava marcada como rejeitada; não mexe em
     busy/fila/liquidação. */
  _noteRateLimitResumed(info, type) {
    if (!this._rejectedWindows.has(type)) return;
    this._rejectedWindows.delete(type);
    const reset = rateLimitReset(info.resetsAt);
    const payload = {
      code: 'CLAUDE_RATE_LIMIT_RESUMED',
      message: `Limite de uso liberado (${RATE_LIMIT_WINDOWS[type] || 'janela de uso'}). A execução pode continuar.`,
      rateLimit: {...this._rateLimitPayload(info, type, reset, {blocked: false, overageInUse: this._rateLimitOverage(info)}), resumed: true},
    };
    const turn = this._rateLimitActiveTurn();
    if (turn) this._emitTurn(turn, 'warning', payload);
    else this._emit('warning', payload);
  }

  _rateLimitPayload(info, type, reset, {blocked, overageInUse}) {
    const overageReset = rateLimitReset(Number.isFinite(info.overageResetsAt) ? info.overageResetsAt : NaN);
    return {
      status: info.status,
      type: type === 'unknown' ? null : type,
      window: RATE_LIMIT_WINDOWS[type] || null,
      resetsAt: reset.resetsAt,
      resetAt: reset.resetAt,
      waitMs: reset.waitMs,
      utilization: Number.isFinite(info.utilization) ? info.utilization : null,
      blocked: blocked === true,
      overage: {
        status: typeof info.overageStatus === 'string' ? info.overageStatus : null,
        inUse: overageInUse === true,
        disabledReason: typeof info.overageDisabledReason === 'string' ? info.overageDisabledReason : null,
        resetsAt: overageReset.resetsAt,
        resetAt: overageReset.resetAt,
        waitMs: overageReset.waitMs,
      },
      surpassedThreshold: Number.isFinite(info.surpassedThreshold) ? info.surpassedThreshold : null,
    };
  }

  _rateLimitMessage(type, reset, kind) {
    const window = RATE_LIMIT_WINDOWS[type] || 'janela de uso';
    const wait = reset.waitMs != null ? ` em ${formatWaitMs(reset.waitMs)}` : '';
    if (kind === 'blocked') {
      return `Limite de uso do Claude Code atingido (${window}). A execução fica pausada até o limite reiniciar${wait}.`;
    }
    if (kind === 'warning') {
      return `Atenção: o limite de uso do Claude Code está próximo (${window}${wait ? ` reinicia${wait}` : ''}).`;
    }
    return `Limite atingido (${window}); a execução continua usando overage${wait}.`;
  }

  /* Evento de primeiro nível do SDK 0.3.246 (o subtipo em `system` é legado
     defensivo). NÃO encerra o turno e NÃO libera busy: o CLI pausa a própria
     janela rejeitada. Avisos são deduplicados por janela/turno; `allowed`
     libera (e emite UMA transição RESUMED se a janela estava rejeitada);
     overage em uso continua. */
  _handleRateLimit(message) {
    const info = message?.rate_limit_info;
    if (!info || typeof info !== 'object') return;
    const status = info.status;
    if (status !== 'allowed' && status !== 'allowed_warning' && status !== 'rejected') return;
    const type = typeof info.rateLimitType === 'string' && info.rateLimitType ? info.rateLimitType : 'unknown';

    if (status === 'allowed') {
      const activeTurn = this._rateLimitActiveTurn();
      if (activeTurn) {
        /* `allowed` limpa a evidência da janela rejeitada DESTE turno: um
           result depois não pode ser rotulado como limite recuperado. */
        activeTurn.rejectedRateLimitTypes.delete(type);
        activeTurn.lastRateLimit = null;
      }
      this._forgetRateLimit(type);
      this._noteRateLimitResumed(info, type);
      return;
    }

    const overageInUse = this._rateLimitOverage(info);
    const blocked = status === 'rejected' && !overageInUse;
    const turn = this._rateLimitActiveTurn();
    if (turn) {
      if (blocked) turn.rejectedRateLimitTypes.add(type);
      else if (status === 'allowed_warning' || overageInUse) turn.rejectedRateLimitTypes.delete(type);
    }
    if (blocked) this._rememberRejectedWindow(type, info);
    /* `allowed_warning` e rejected-com-overage NÃO limpam a pausa: a transição
       que a UI espera é o `allowed` da janela rejeitada (um RESUMED por vez). */
    const kind = blocked ? 'blocked' : status === 'allowed_warning' ? 'warning' : 'overage';
    const reset = rateLimitReset(info.resetsAt);
    const key = `${kind}:${type}:${reset.resetsAt ?? 'unknown'}`;
    /* O texto do overage usa a janela do próprio overage quando o CLI manda. */
    const messageReset = kind === 'overage' && Number.isFinite(info.overageResetsAt) && info.overageResetsAt > 0
      ? rateLimitReset(info.overageResetsAt)
      : reset;
    const payload = {
      code: kind === 'blocked' ? 'CLAUDE_RATE_LIMITED' : kind === 'warning' ? 'CLAUDE_RATE_LIMIT_WARNING' : 'CLAUDE_RATE_LIMIT_OVERAGE',
      message: this._rateLimitMessage(type, messageReset, kind),
      rateLimit: this._rateLimitPayload(info, type, reset, {blocked, overageInUse}),
    };
    if (turn) turn.lastRateLimit = payload.rateLimit;
    if (this._rateLimitAnnounced(key)) return;
    this._rateLimitRemember(key);
    if (turn) this._emitTurn(turn, 'warning', payload);
    else this._emit('warning', payload);
  }

  _markCompleted(key) {
    if (!key) return true;
    if (this._completed.has(key)) return false;
    this._completed.set(key, true);
    if (this._completed.size > MAX_COMPLETED_KEYS) {
      const oldest = this._completed.keys().next().value;
      this._completed.delete(oldest);
    }
    return true;
  }

  _handleStreamEvent(message) {
    if (message.parent_tool_use_id) return;
    const event = message.event;
    if (!event || typeof event !== 'object') return;
    const key = event.message?.id || message.uuid || null;
    if (event.type === 'message_start') {
      if (key) this._streamed.add(key);
      this._emit('message_start', {message: {role: 'assistant', id: event.message?.id ?? null}});
      return;
    }
    if (event.type !== 'content_block_delta') return;
    const delta = event.delta;
    if (!delta || typeof delta !== 'object') return;
    if (delta.type === 'text_delta' && typeof delta.text === 'string' && delta.text) {
      this._emit('message_delta', {delta: delta.text, kind: 'text', messageId: event.message?.id ?? null});
    } else if (delta.type === 'thinking_delta' && typeof delta.thinking === 'string' && delta.thinking) {
      this._emit('message_delta', {delta: delta.thinking, kind: 'thinking', messageId: event.message?.id ?? null});
    }
    /* message_stop NÃO libera busy: só result/fim de consulta/close. */
  }

  _handleAssistant(message) {
    if (message.parent_tool_use_id) return;
    const turn = this._rateLimitActiveTurn();
    if (turn) {
      /* Fatos do turno para classificar o `result` (mesma leitura do T3):
         `rate_limit` mais recente do assistente e falha de autenticação
         acumulada — nunca contaminam o turno seguinte. */
      turn.latestAssistantRateLimited = message.error === 'rate_limit';
      if (message.error === 'authentication_failed' || message.error === 'oauth_org_not_allowed') {
        turn.authenticationFailure = true;
      }
    }
    if (message.error) {
      const code = ASSISTANT_ERROR_CODES[message.error] || 'CLAUDE_ASSISTANT_ERROR';
      /* Erro de assistente nativo é recuperável: a consulta pode continuar
         (retry/result à frente), então `fatal:false`. Falha de autenticação
         pode ser terminal (`fatal:true`). */
      this._emit('error', {
        message: `Claude Code: ${String(message.error)}`,
        code,
        fatal: code === 'CLAUDE_AUTH_FAILED',
        detail: {error: message.error},
      });
    }
    const key = message.uuid || message.message?.id || null;
    if (!this._markCompleted(key)) return;
    const streamKey = message.message?.id || key;
    if (!(streamKey && this._streamed.has(streamKey))) {
      this._emit('message_start', {message: {role: 'assistant', id: message.message?.id ?? null}});
    }
    const content = normalizeAssistantBlocks(message.message?.content);
    for (const block of content) {
      if (block.type !== 'toolCall') continue;
      this._toolNames.set(block.id, block.name);
      this._emit('tool_start', {id: block.id, name: block.name, args: block.arguments});
    }
    if (streamKey) this._streamed.delete(streamKey);
    this._emit('message_end', {
      message: {
        role: 'assistant',
        id: message.message?.id ?? null,
        uuid: key,
        model: message.message?.model || this._model || null,
        content,
      },
    });
  }

  _handleUser(message) {
    if (message.parent_tool_use_id) return;
    const content = message.message?.content;
    const blocks = Array.isArray(content) ? content : [];
    for (const block of blocks) {
      if (!block || block.type !== 'tool_result') continue;
      const id = typeof block.tool_use_id === 'string' ? block.tool_use_id : null;
      this._emit('tool_end', {
        id,
        name: this._toolNames.get(id) || null,
        result: summarizeToolResult(block.content),
        isError: block.is_error === true,
      });
      this._toolNames.delete(id);
    }
  }

  async _handleResult(message) {
    if (message.parent_tool_use_id) return;
    const turn = this._turn;
    if (!turn || turn.finalized) {
      this._emit('warning', {message: 'resultado recebido fora de um turno ativo', code: 'CLAUDE_RESULT_UNEXPECTED'});
      return;
    }
    const correlation = turnPolicy.correlationEvidence(message, turn.wireUuid);
    if (correlation.evidence === 'mismatch') {
      turn.foreignSeen = true;
      this._emitTurn(turn, 'warning', {message: 'resultado de outro envio foi ignorado; o turno atual continua', code: 'CLAUDE_RESULT_FOREIGN'});
      return;
    }
    /* Veredito PURO do turno: sem eco, só liquida o turno ÚNICO com aceite
       comprovado e não degradado, sem evidência estrangeira, sem origem
       não-humana e sem `num_turns` zero. `taken` NÃO é prova de aceite;
       resultado sem correlação de turno ainda não aceito é ignorado até
       timeout/fim de consulta. */
    const decision = turnPolicy.classifyResultCorrelation({
      message,
      wireUuid: turn.wireUuid,
      accepted: turn.acceptResolved,
      degraded: turn.degraded,
      foreignSeen: turn.foreignSeen,
      outstandingTurns: 1,
    });
    if (decision.action !== 'finalize') {
      this._emitTurn(turn, 'warning', {message: 'resultado sem correlação e sem entrega comprovada foi ignorado', code: 'CLAUDE_RESULT_FOREIGN'});
      return;
    }
    const cancelled = this._cancelRequested;
    /* A falha nativa é classificada à parte: o aceite comprovado continua
       `settled`; o erro é reportado com código/detalhe canônicos. */
    const failure = turnPolicy.classifyResultFailure(message, {
      rejectedRateLimitTypes: turn.rejectedRateLimitTypes,
      latestAssistantRateLimited: turn.latestAssistantRateLimited,
      authenticationFailure: turn.authenticationFailure,
      rateLimit: turn.lastRateLimit,
    });
    const envelopeError = message.is_error === true || message.subtype !== 'success';
    if (!cancelled) {
      if (failure) {
        this._emit('error', {
          message: failure.message,
          code: failure.code,
          fatal: false,
          detail: {
            ...failure.detail,
            failureClass: failure.class,
            terminalReason: failure.terminalReason,
            apiErrorStatus: failure.apiErrorStatus,
            providerRetryable: failure.providerRetryable,
          },
        });
      } else if (envelopeError) {
        this._emit('error', {
          message: resultText(message),
          code: 'CLAUDE_RESULT_ERROR',
          fatal: false,
          detail: {subtype: message.subtype || null, terminalReason: message.terminal_reason || null},
        });
      }
    }
    await this._enqueue(turn, () => this._finalizeTurn(turn, decision.outcome, {
      cancelled,
      isError: envelopeError || failure !== null,
      message: decision.settled ? undefined : 'a rodada terminou sem confirmação de recebimento',
      reason: 'result',
    }));
  }

  _pathAllowed(real) {
    for (const file of this._toolPolicy.readPaths) {
      if (real === file) return true;
    }
    for (const root of this._toolPolicy.readRoots) {
      if (isInside(real, root)) return true;
    }
    return false;
  }

  _pathDecision(target) {
    let real;
    try {
      real = canonicalPath(target, this._cwd);
    } catch {
      return {allowed: false, reason: 'caminho inválido'};
    }
    if (this._pathAllowed(real)) return {allowed: true};
    return {allowed: false, reason: 'fora das pastas autorizadas desta conversa'};
  }

  /* Glob e Grep confinam a pasta base; só Glob interpreta o padrão como
     caminho e canonicaliza seus segmentos literais para barrar symlinks. */
  _globPatternDecision(toolName, input) {
    const pattern = String(input?.pattern || '');
    if (!pattern) return {allowed: true};
    if (toolName === 'Glob' && (path.isAbsolute(pattern) || pattern.startsWith('~'))) {
      return {allowed: false, reason: 'padrão absoluto fora da pasta controlada'};
    }
    const rawBase = typeof input?.path === 'string' && input.path ? input.path : (this._cwd || process.cwd());
    let current = canonicalPath(rawBase, this._cwd);
    if (!this._pathAllowed(current)) {
      return {allowed: false, reason: 'fora das pastas autorizadas desta conversa'};
    }
    if (toolName !== 'Glob') return {allowed: true};
    for (const segment of pattern.split(/[\\/]+/)) {
      if (!segment || segment === '.') continue;
      if (segment === '..') return {allowed: false, reason: 'padrão com ".." sairia da pasta controlada'};
      if (/[*?[\]{}]/.test(segment)) continue;
      current = path.join(current, segment);
      const real = realpathBestEffort(current);
      if (!this._pathAllowed(real)) {
        return {allowed: false, reason: 'o padrão atravessa um link fora das pastas autorizadas'};
      }
    }
    return {allowed: true};
  }

  _permissionRequestId(options) {
    return (typeof options?.requestId === 'string' && options.requestId)
      || (typeof options?.toolUseID === 'string' && options.toolUseID)
      || crypto.randomUUID();
  }

  /* Registro comum de pedido: prazo (ID que vence), abort do SDK, evento
     canônico e resolução única. `entry` carrega só o que o respond precisa. */
  _waitForPermission(request, entry, options) {
    const signal = options?.signal || null;
    return new Promise((resolve) => {
      entry.done = false;
      entry.finish = (result) => {
        if (entry.done) return;
        entry.done = true;
        this._permissions.delete(request.id);
        if (entry.timer) {
          clearTimeout(entry.timer);
          entry.timer = null;
        }
        if (entry.onAbort && signal?.removeEventListener) signal.removeEventListener('abort', entry.onAbort);
        resolve(result);
      };
      entry.onAbort = () => {
        if (entry.done) return;
        this._emit('permission_cancelled', {id: request.id, reason: 'abort'});
        entry.finish({behavior: 'deny', message: 'A execução foi encerrada antes da resposta'});
      };
      if (signal) {
        if (signal.aborted) {
          entry.done = true;
          this._emit('permission_cancelled', {id: request.id, reason: 'abort'});
          resolve({behavior: 'deny', message: 'A execução foi encerrada antes da resposta'});
          return;
        }
        signal.addEventListener?.('abort', entry.onAbort, {once: true});
      }
      this._permissions.set(request.id, entry);
      if (this._permissionTtlMs > 0) {
        entry.timer = setTimeout(() => this._expirePermission(request.id), this._permissionTtlMs);
        entry.timer.unref?.();
      }
      this._emit('permission_request', request);
    });
  }

  _requestConfirmation(toolName, input, options, target) {
    const id = this._permissionRequestId(options);
    const pathTarget = target != null ? canonicalPath(target, this._cwd) : null;
    const request = {
      id,
      title: typeof options?.title === 'string' && options.title ? options.title : `Usar ${toolName}`,
      message: typeof options?.description === 'string' ? options.description : '',
      toolName,
      target: pathTarget,
      input,
      method: 'confirm',
      expiresAt: this._permissionExpiresAt(),
    };
    const entry = {
      id,
      method: 'confirm',
      toolName,
      input,
      requestId: options?.requestId || null,
      toolUseID: typeof options?.toolUseID === 'string' ? options.toolUseID : null,
    };
    return this._waitForPermission(request, entry, options);
  }

  /* AskUserQuestion: nenhuma concessão de ferramenta — o pedido é uma pergunta
     estruturada. O allow só sai pelo `respond({id, answers})` validado. */
  _requestUserInput(toolName, input, options) {
    const questions = normalizeUserQuestions(input?.questions);
    const id = this._permissionRequestId(options);
    if (!questions.length) {
      return Promise.resolve({behavior: 'deny', message: 'pergunta sem questões válidas (nada a responder)'});
    }
    const request = {
      id,
      title: typeof options?.title === 'string' && options.title ? options.title : 'Pergunta do Claude Code',
      message: typeof options?.description === 'string' && options.description
        ? options.description
        : (typeof options?.decisionReason === 'string' ? options.decisionReason : ''),
      toolName,
      method: 'question',
      questions,
      expiresAt: this._permissionExpiresAt(),
    };
    const entry = {
      id,
      method: 'question',
      toolName,
      input,
      requestId: options?.requestId || null,
      toolUseID: typeof options?.toolUseID === 'string' ? options.toolUseID : null,
      questions,
      rawQuestions: Array.isArray(input?.questions) ? input.questions : [],
    };
    return this._waitForPermission(request, entry, options);
  }

  _canUseTool(generation, toolName, input, options) {
    if (generation !== this._generation) return Promise.resolve({behavior: 'deny', message: 'conexão antiga'});
    if(toolName===TUTOR_PDF_TOOL&&this._createMaterial&&!this._closed)return Promise.resolve({behavior:'allow',updatedInput:input});
    if (toolName === 'AskUserQuestion') return this._requestUserInput(toolName, input, options);
    if (!ALLOWED_TOOLS.includes(toolName)) {
      return Promise.resolve({behavior: 'deny', message: `ferramenta não permitida nesta versão: ${toolName}`});
    }
    const target = extractPathFromInput(toolName, input);
    if (target != null) {
      const decision = this._pathDecision(target);
      if (!decision.allowed) return Promise.resolve({behavior: 'deny', message: decision.reason});
    }
    if (toolName === 'Glob' || toolName === 'Grep') {
      const decision = this._globPatternDecision(toolName, input);
      if (!decision.allowed) return Promise.resolve({behavior: 'deny', message: decision.reason});
    }
    return this._requestConfirmation(toolName, input, options, target);
  }

  /* Hook PreToolUse: aplica a política de caminhos inclusive em chamadas que o
     CLI auto-aprovaria (canUseTool não cobre essas). Nunca libera escrita;
     AskUserQuestion segue para o canUseTool, que exige respostas. */
  async _preToolUse(generation, input) {
    const deny = (reason) => ({
      continue: true,
      hookSpecificOutput: {hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason},
    });
    if (generation !== this._generation) return deny('conexão antiga');
    const toolName = input?.tool_name;
    if(toolName===TUTOR_PDF_TOOL&&this._createMaterial&&!this._closed)return {continue:true};
    if (toolName === 'AskUserQuestion') return {continue: true};
    if (typeof toolName !== 'string' || !ALLOWED_TOOLS.includes(toolName)) {
      return deny(`ferramenta não permitida nesta versão: ${toolName || 'desconhecida'}`);
    }
    const target = extractPathFromInput(toolName, input?.tool_input);
    if (target != null) {
      const decision = this._pathDecision(target);
      if (!decision.allowed) return deny(decision.reason);
    }
    if (toolName === 'Glob' || toolName === 'Grep') {
      const decision = this._globPatternDecision(toolName, input?.tool_input);
      if (!decision.allowed) return deny(decision.reason);
    }
    return {continue: true};
  }
}

module.exports = {
  ClaudeAdapter,
  ClaudeAdapterError,
  MessageQueue,
  ADAPTER_VERSION,
  CLAUDE_CLIENT_APP,
  CAPABILITIES,
  MODEL_INFO,
  EVENT_TYPES,
  DELIVERY_STATUSES,
  ALLOWED_TOOLS,
  SDK_TOOLS,
  DISALLOWED_TOOLS,
  ALLOWED_IMAGE_TYPES,
  RATE_LIMIT_WINDOWS,
  ASSISTANT_ERROR_CODES,
  LIMITS: Object.freeze({
    MAX_IMAGES,
    MAX_IMAGE_BYTES,
    MAX_TEXT_BYTES,
    MAX_CONTENT_BYTES,
    MAX_TOOL_RESULT_CHARS,
    MAX_HISTORY_MESSAGES,
    MAX_HISTORY_BYTES,
    DEFAULT_TIMEOUT_MS,
    DEFAULT_PERMISSION_TTL_MS,
    MAX_PERMISSION_TTL_MS,
    MAX_RATE_LIMIT_NOTICES,
    MAX_RATE_LIMIT_WAIT_MS,
    DEFAULT_CONTROLS_TIMEOUT_MS,
    MAX_CONTROLS_TIMEOUT_MS,
  }),
  CONTROLS_STATES,
  prepareMessage,
  validateImage,
  normalizeAssistantBlocks,
  normalizeHistory,
  normalizeUserQuestions,
  validateQuestionAnswers,
  summarizeToolResult,
  formatWaitMs,
  rateLimitReset,
  canonicalPath,
  normalizeToolPolicy,
  extractPathFromInput,
  isInside,
  isUuid,
};
