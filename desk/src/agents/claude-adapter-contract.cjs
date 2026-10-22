'use strict';

/* Contrato do ClaudeAdapter: limites, listas de ferramentas, capacidades,
   tipos de evento, erro canônico e a fila de entrada do SDK. Saiu do
   claude-adapter.cjs na #43 fase 2, sem mudar valor nenhum. */

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
const MAX_TOOL_DETAILS_CHARS = 20000;
const MAX_HISTORY_MESSAGES = 200;
const MAX_HISTORY_BYTES = 8 * 1024 * 1024;
/* Teto defensivo do prefixo importado; o descritor já limita a 5000 mensagens. */
const MAX_PRIOR_MESSAGES = 5000;
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

/* Nomes curtos e iguais nos dois idiomas: a mensagem marcada que os leva
   (`claude.limit.*`) não aceita outra mensagem como argumento (#41). */
const RATE_LIMIT_WINDOWS = Object.freeze({
  five_hour: '5h',
  seven_day: '7d',
  seven_day_opus: '7d Opus',
  seven_day_sonnet: '7d Sonnet',
  seven_day_overage_included: '7d overage',
  overage: 'overage',
});

/* Erros que o CLI carimba na mensagem assistente (SDK 0.3.301
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

/* Capacidades estruturais desta ponte. Espelho fiel do `claudeCaps()` do
   núcleo Bend (`core/agentcaps.bend`) — snapshot() só troca os fatos por
   `claudeControlCaps` quando catálogo/APIs estão vivos. A #58 ligou steer,
   compactação manual, rascunho, comandos, quiz e medidor; compactação
   automática segue fechada. O bilhete saiu do contrato na #49. */
const CAPABILITIES = Object.freeze({
  images: true,
  permissions: true,
  steer: true,
  compact: true,
  autoCompaction: false,
  modelSelection: false,
  effort: false,
  reviewDraft: true,
  commands: true,
  geogebra: true,
  quiz: true,
  contextUsage: true,
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

module.exports = {
  ADAPTER_VERSION,
  CLAUDE_CLIENT_APP,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_PERMISSION_TTL_MS,
  MAX_PERMISSION_TTL_MS,
  MAX_IMAGES,
  MAX_IMAGE_BYTES,
  MAX_TEXT_BYTES,
  MAX_CONTENT_BYTES,
  MAX_TOOL_RESULT_CHARS,
  MAX_TOOL_DETAILS_CHARS,
  MAX_HISTORY_MESSAGES,
  MAX_HISTORY_BYTES,
  MAX_PRIOR_MESSAGES,
  MAX_COMPLETED_KEYS,
  MAX_HISTORY_PAGES,
  MAX_RATE_LIMIT_NOTICES,
  MAX_RATE_LIMIT_WAIT_MS,
  DEFAULT_CONTROLS_TIMEOUT_MS,
  MAX_CONTROLS_TIMEOUT_MS,
  MAX_SELECTION_ID,
  CONTROLS_STATES,
  ALLOWED_IMAGE_TYPES,
  ALLOWED_TOOLS,
  SDK_TOOLS,
  DISALLOWED_TOOLS,
  RATE_LIMIT_WINDOWS,
  ASSISTANT_ERROR_CODES,
  CAPABILITIES,
  MODEL_INFO,
  EVENT_TYPES,
  DELIVERY_STATUSES,
  ClaudeAdapterError,
  MessageQueue,
};
