// @ts-check
/* Estados e planos de entrada por provedor do OpenCode 2.2.4 (sem DOM, sem
   rede). A fonte é a rota `GET /api/integration` do `opencode serve` — o
   OpenAPI do binário 2.2.4 a descreve em `/openapi.json`; o `auth list` da CLI
   é a mesma lista em texto. Nada aqui lê `auth.json` nem devolve credencial:
   `connections` vira só `connected`/`expired`, e o valor do token nunca é
   pedido.

   Os métodos vêm do servidor. `oauth` e `key` sem formulário podem ser feitos
   dentro da Mesa; `command`, `external` e métodos com formulário não podem, e
   a tela mostra o comando `opencode auth login <id>` em vez de fingir. */

/** @typedef {'connected'|'expired'|'off'} ProviderStatus */
/** @typedef {{id: string, type: string, label: string, hasForm: boolean, usable: boolean}} ProviderMethod */
/** @typedef {{kind: 'oauth'|'key'|'unsupported', methodID: string, label: string, reason: string}} LoginPlan */
/** @typedef {{id: string, name: string, status: ProviderStatus, environment: boolean, methods: ProviderMethod[], plan: LoginPlan, command: string}} ProviderRow */

/** Os dois provedores que a primeira abertura e as Configurações mostram por nome. */
export const CURATED = Object.freeze([
  {id: 'openai', nameKey: 'opencodeProviders.chatgpt', subKey: 'opencodeProviders.chatgptSub', icon: 'openai', preferred: ['chatgpt-token-sharing', 'chatgpt-headless', 'chatgpt-browser']},
  {id: 'xai', nameKey: 'opencodeProviders.grok', subKey: 'opencodeProviders.grokSub', icon: 'xai', preferred: ['device']},
]);

const MAX_METHODS = 12;
const MAX_OTHERS = 300;
const MAX_ID = 80;
const MAX_NAME = 120;
const MAX_LABEL = 120;
const MAX_URL = 2000;
const MAX_INSTRUCTIONS = 500;

/** @param {unknown} value @returns {value is Record<string, unknown>} */
const isObject = (value) => !!value && typeof value === 'object' && !Array.isArray(value);

/** @param {unknown} value @param {number} max @returns {string} */
function shortText(value, max) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

/* Segredo que aparece por acidente numa frase de terceiro vira marcador. A
   ordem importa: `Bearer` antes das chaves soltas, query de OAuth por último. */
/** @type {Array<[RegExp, string]>} */
const SECRET_PATTERNS = [
  [/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [oculto]'],
  [/\b(?:sk|pk|rk|xai|gsk|ghp|github_pat|glpat)[-_][A-Za-z0-9_-]{6,}/gi, '[chave]'],
  [/((?:api[_-]?key|access[_-]?token|refresh[_-]?token|token|secret|authorization)["']?\s*[:=]\s*["']?)[^\s"',;}]+/gi, '$1[oculto]'],
  [/([?&](?:code|token|access_token|refresh_token|key|api_key)=)[^&\s]+/gi, '$1[oculto]'],
];

/**
 * Uma frase de erro de terceiro sem token, segredo, URL de código ou quebra de linha.
 * @param {unknown} raw @param {number} [max]
 * @returns {string}
 * @example safeReason('invalid key sk-abc123456') // 'invalid key [chave]'
 */
export function safeReason(raw, max = 200) {
  let text = String(raw ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
  for (const [pattern, replacement] of SECRET_PATTERNS) text = text.replace(pattern, replacement);
  return text.slice(0, max);
}

/** @param {unknown} raw @returns {string} */
function urlText(raw) {
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (!value || value.length > MAX_URL) return '';
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? value : '';
  } catch { return ''; }
}

/** @param {unknown} raw @returns {ProviderMethod|null} */
function methodOf(raw) {
  if (!isObject(raw)) return null;
  const type = ['oauth', 'key', 'command', 'external', 'env'].includes(String(raw.type)) ? String(raw.type) : '';
  if (!type) return null;
  const id = shortText(raw.id, MAX_ID);
  const label = shortText(raw.label, MAX_LABEL) || type;
  const hasForm = Array.isArray(raw.form) && raw.form.length > 0;
  const usable = !hasForm && ((type === 'oauth' && !!id) || type === 'key');
  return {id, type, label, hasForm, usable};
}

/** @param {unknown} raw @returns {ProviderRow['status']} */
function statusOf(raw) {
  if (!Array.isArray(raw)) return 'off';
  let connected = false;
  let expired = false;
  for (const item of raw.slice(0, 20)) {
    if (!isObject(item)) continue;
    if (item.type !== 'credential' && item.type !== 'env') continue;
    connected = true;
    const status = isObject(item.status) ? item.status : {};
    if (item.type === 'credential' && status.status === 'needs_auth') expired = true;
  }
  return expired ? 'expired' : connected ? 'connected' : 'off';
}

/** @param {unknown} raw @returns {boolean} */
function usesEnvironment(raw) {
  return Array.isArray(raw) && raw.some((item) => isObject(item) && item.type === 'env');
}

/** @param {unknown} raw @returns {{id: string, name: string, methods: ProviderMethod[], connections: unknown[]}} */
function integrationOf(raw) {
  const source = isObject(raw) ? raw : {};
  const id = shortText(source.id, MAX_ID);
  const name = shortText(source.name, MAX_NAME) || id;
  const methods = (Array.isArray(source.methods) ? source.methods : []).map(methodOf).filter(Boolean).slice(0, MAX_METHODS);
  return {id, name, methods: /** @type {ProviderMethod[]} */ (methods), connections: Array.isArray(source.connections) ? source.connections : []};
}

/**
 * As integrações de `GET /api/integration` (envelope `{data}` ou lista crua).
 * @param {unknown} payload
 * @returns {Array<{id: string, name: string, methods: ProviderMethod[], connections: unknown[]}>}
 * @example integrationList({data: [{id: 'openai', name: 'OpenAI', methods: [], connections: []}]})[0].id // 'openai'
 */
export function integrationList(payload) {
  const list = isObject(payload) && Array.isArray(payload.data) ? payload.data : Array.isArray(payload) ? payload : [];
  const out = [];
  const seen = new Set();
  for (const raw of list) {
    const item = integrationOf(raw);
    if (!item.id || seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}

/** @param {ProviderMethod} method @returns {LoginPlan} */
function planOf(method) {
  return {kind: method.type === 'oauth' ? 'oauth' : 'key', methodID: method.id, label: method.label, reason: ''};
}

/**
 * O caminho preferido de entrada: OAuth preferido, depois OAuth, depois chave.
 * Sem método utilizável, o plano diz por que e qual comando mostrar.
 * @param {{methods: ProviderMethod[]}} integration @param {string[]} [preferred]
 * @returns {LoginPlan}
 * @example loginPlan({methods: [{id: 'chatgpt-token-sharing', type: 'oauth', label: 'ChatGPT', hasForm: false, usable: true}]}).kind // 'oauth'
 */
export function loginPlan(integration, preferred = []) {
  const methods = Array.isArray(integration?.methods) ? integration.methods : [];
  for (const id of preferred) {
    const found = methods.find((method) => method.id === id && method.usable && method.type === 'oauth');
    if (found) return planOf(found);
  }
  const oauth = methods.find((method) => method.type === 'oauth' && method.usable);
  if (oauth) return planOf(oauth);
  const key = methods.find((method) => method.type === 'key' && method.usable);
  if (key) return planOf(key);
  const blocked = methods.find((method) => method.hasForm) || methods.find((method) => method.type === 'command' || method.type === 'external');
  return {kind: 'unsupported', methodID: blocked?.id || '', label: blocked?.label || '', reason: blocked?.hasForm ? 'form' : blocked ? 'command' : 'none'};
}

/**
 * Qual ação o botão principal do provedor dispara: plano só de chave abre o
 * campo da chave, porque `/connect/oauth` recusaria um método de chave.
 * @param {LoginPlan} plan
 * @returns {'login'|'key'|''} '' quando o provedor não entra por aqui
 * @example providerLoginAction({kind: 'key', methodID: 'manual'}) // 'key'
 */
export function providerLoginAction(plan) {
  if (plan?.kind === 'oauth') return 'login';
  return plan?.kind === 'key' ? 'key' : '';
}

/** @param {string} id @param {LoginPlan} plan @returns {string} */
function commandOf(id, plan) {
  if (plan.kind === 'unsupported' && plan.methodID) return `auth login ${id} --method ${plan.methodID}`;
  return `auth login ${id}`;
}

/** @param {{id: string, name: string, methods: ProviderMethod[], connections: unknown[]}} integration @param {{preferred?: string[]}} [spec] @returns {ProviderRow} */
function rowOf(integration, spec = {}) {
  const plan = loginPlan(integration, spec.preferred || []);
  return {
    id: integration.id,
    name: integration.name,
    status: statusOf(integration.connections),
    environment: usesEnvironment(integration.connections),
    methods: integration.methods.map((method) => ({...method})),
    plan,
    command: commandOf(integration.id, plan),
  };
}

/** @param {unknown} raw @param {ProviderRow} fallback @returns {ProviderRow} */
function safeRow(raw, fallback) {
  if (!isObject(raw)) return fallback;
  const status = ['connected', 'expired', 'off'].includes(String(raw.status)) ? /** @type {ProviderStatus} */ (raw.status) : 'off';
  const methods = (Array.isArray(raw.methods) ? raw.methods : []).map(methodOf).filter(Boolean).slice(0, MAX_METHODS);
  const plan = isObject(raw.plan) && ['oauth', 'key', 'unsupported'].includes(String(raw.plan.kind))
    ? {kind: /** @type {'oauth'|'key'|'unsupported'} */ (raw.plan.kind), methodID: shortText(raw.plan.methodID, MAX_ID), label: shortText(raw.plan.label, MAX_LABEL), reason: shortText(raw.plan.reason, 16)}
    : fallback.plan;
  return {
    id: shortText(raw.id, MAX_ID) || fallback.id,
    name: shortText(raw.name, MAX_NAME) || fallback.name,
    status,
    environment: raw.environment === true,
    methods: /** @type {ProviderMethod[]} */ (methods),
    plan,
    command: shortText(raw.command, 200) || fallback.command,
  };
}

/**
 * A vista da Mesa a partir da lista do servidor: os dois provedores por nome e
 * os outros (conectados primeiro; só os que têm algum método).
 * @param {unknown} payload
 * @param {{curated?: typeof CURATED}} [options]
 * @returns {{providers: ProviderRow[], others: ProviderRow[]}}
 */
export function providerView(payload, {curated = CURATED} = {}) {
  const list = integrationList(payload);
  const byId = new Map(list.map((item) => [item.id, item]));
  const providers = curated.map((spec) => {
    const found = byId.get(spec.id);
    const row = found ? rowOf(found, spec) : rowOf({id: spec.id, name: spec.id, methods: [], connections: []}, spec);
    return safeRow(row, row);
  });
  const named = new Set(curated.map((spec) => spec.id));
  const others = list
    .filter((item) => !named.has(item.id))
    .map((item) => rowOf(item))
    .filter((row) => row.status !== 'off' || row.methods.some((method) => ['oauth', 'key', 'command', 'external'].includes(method.type)))
    .sort((left, right) => rank(left.status) - rank(right.status) || left.name.localeCompare(right.name, 'en'))
    .slice(0, MAX_OTHERS);
  return {providers, others};
}

/** @param {ProviderStatus} status @returns {number} */
function rank(status) {
  return status === 'connected' ? 0 : status === 'expired' ? 1 : 2;
}

/**
 * Normaliza o retorno do host para a vista sem confiar no payload.
 * @param {unknown} raw
 * @returns {{state: string, providers: ProviderRow[], others: ProviderRow[], binary: string, platform: string, version: string}}
 * @example providersResult({state: 'ready', providers: []}).state // 'ready'
 */
export function providersResult(raw) {
  const source = isObject(raw) ? raw : {};
  const known = ['ready', 'missing', 'old', 'unreachable', 'port', 'server', 'timeout'];
  return {
    state: known.includes(String(source.state)) ? String(source.state) : 'unreachable',
    providers: Array.isArray(source.providers) ? /** @type {ProviderRow[]} */ (source.providers) : [],
    others: Array.isArray(source.others) ? /** @type {ProviderRow[]} */ (source.others) : [],
    binary: typeof source.binary === 'string' ? source.binary : '',
    platform: typeof source.platform === 'string' ? source.platform : '',
    version: typeof source.version === 'string' ? source.version : '',
  };
}

/**
 * O começo de um login OAuth do servidor, sem o URL no log.
 * @param {unknown} payload
 * @param {number} [now]
 * @returns {{attemptID: string, url: string, instructions: string, mode: 'auto'|'code', expiresInMs: number}|null}
 * @example normalizeAttempt({data: {attemptID: 'con_1', url: 'https://x.test', instructions: '…', mode: 'auto', time: {expires: Date.now() + 600000}}})?.mode // 'auto'
 */
export function normalizeAttempt(payload, now = Date.now()) {
  const data = isObject(payload) && isObject(payload.data) ? payload.data : payload;
  if (!isObject(data)) return null;
  const attemptID = shortText(data.attemptID, 120);
  if (!attemptID) return null;
  const created = Number(isObject(data.time) ? data.time.created : NaN);
  const expires = Number(isObject(data.time) ? data.time.expires : NaN);
  const duration = Number.isFinite(expires) && Number.isFinite(created) ? Math.max(0, expires - created) : 10 * 60 * 1000;
  const left = Number.isFinite(expires) ? Math.max(0, expires - now) : duration;
  return {
    attemptID,
    url: urlText(data.url),
    instructions: shortText(data.instructions, MAX_INSTRUCTIONS),
    mode: data.mode === 'code' ? 'code' : 'auto',
    expiresInMs: Math.max(1000, Math.min(15 * 60 * 1000, left || duration)),
  };
}

/**
 * O estado de uma tentativa OAuth.
 * @param {unknown} payload
 * @returns {{status: 'pending'|'complete'|'failed'|'expired', message: string}}
 * @example normalizeAttemptStatus({data: {status: 'pending'}}).status // 'pending'
 */
export function normalizeAttemptStatus(payload) {
  const data = isObject(payload) && isObject(payload.data) ? payload.data : payload;
  const status = isObject(data) && ['pending', 'complete', 'failed', 'expired'].includes(String(data.status)) ? /** @type {'pending'|'complete'|'failed'|'expired'} */ (data.status) : 'failed';
  return {status, message: status === 'failed' ? safeReason(isObject(data) ? data.message : '') : ''};
}
