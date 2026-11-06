// @ts-check
'use strict';

/* Entrada por provedor do OpenCode, do lado do main (#login no app). A lista e
   o login usam a API v2 do `opencode serve` 2.2.4 (`/api/integration`,
   `/connect/oauth`, `/connect/key`), a mesma que o `/connect` do TUI usa. Nunca
   lemos `auth.json`, nunca pedimos o `credential.list` (que devolve o segredo)
   e nunca devolvemos token ao renderer.

   O servidor é o da Mesa, mas `acquireAuth` não lê o cofre: abrir as
   Configurações não pode pedir a chave do macOS (#104). A conta fica no banco
   do OpenCode, como manda a documentação v2; o servidor a lê na próxima lista
   de modelos, então o seletor atualiza ao religar a ponte.

   Canais:
   - `opencode-providers`                → {state, providers, others, binary, platform, version?}
   - `opencode-provider-login-start`     → {ok, kind, attemptID?, url?, instructions?, mode?, expiresInMs?}
   - `opencode-provider-login-status`    → {status, message?, relinked?, busy?}
   - `opencode-provider-login-open`      → reabre o navegador da tentativa viva
   - `opencode-provider-login-complete`  → conclui uma tentativa `code` com o código
   - `opencode-provider-login-cancel`    → DELETE da tentativa
   Nenhuma linha de log leva chave, token, código ou URL de autorização. */

const {createOpenCodeClient} = require('./src/agents/opencode-http.cjs');
const {invalidRequest} = require('./src/error-detail.mjs');

const LIST_TIMEOUT_MS = 15000;
const LOGIN_TIMEOUT_MS = 30000;
const ATTEMPT_TTL_MS = 15 * 60 * 1000;
const INTEGRATION_RE = /^[a-z0-9][a-z0-9-]{0,79}$/;
const METHOD_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/;
const ATTEMPT_RE = /^[A-Za-z0-9_-]{1,120}$/;

/** @type {Promise<typeof import('./src/opencode-providers-state.mjs')>|null} */
let stateModule = null;
const states = () => (stateModule ||= import('./src/opencode-providers-state.mjs'));

/**
 * Cria o host da entrada por provedor.
 * @param {{ipcMain: {handle: Function}, acquire: () => Promise<{baseUrl: string, password: string}>,
 *   binary: () => string, oldVersion?: () => string, platform?: string,
 *   openExternal: (url: string) => Promise<unknown>|unknown,
 *   relinkTutor: () => Promise<{relinked: boolean, busy?: boolean}>,
 *   fetchImpl?: typeof fetch, appendLog?: (area: string, line: string) => void}} deps
 * @example const host = createOpenCodeProvidersHost({ipcMain, acquire: () => owner.acquireAuth(), binary, openExternal, relinkTutor});
 */
function createOpenCodeProvidersHost(deps) {
  const {ipcMain, acquire, binary, oldVersion = () => '', platform = process.platform,
    openExternal, relinkTutor, fetchImpl = fetch, appendLog = () => {}} = deps;
  /** @type {Map<string, {integrationID: string, url: string, relinked: boolean, at: number}>} */
  const attempts = new Map();

  /** @param {string} line */
  const log = (line) => appendLog('opencode', line);

  /** @returns {Promise<import('./src/agents/opencode-http.cjs').OpenCodeClient>} */
  async function client() {
    const lease = await acquire();
    return createOpenCodeClient({baseUrl: lease.baseUrl, password: lease.password, fetch: fetchImpl, log: appendLog});
  }

  /** @param {unknown} error @returns {string} */
  function failureOf(error) {
    const source = /** @type {{name?: string, code?: string, timeout?: boolean}} */ (error) || {};
    if (['port', 'missing', 'server', 'notFound', 'rejected', 'timeout'].includes(String(source.code))) return String(source.code);
    if (source.name === 'TimeoutError' || source.timeout || source.code === 'timeout') return 'timeout';
    if (source.code === 'ECONNREFUSED') return 'port';
    if (source.code === 'ENOENT') return 'missing';
    return 'unreachable';
  }

  /** @param {number} status @returns {string} */
  function statusFailure(status) {
    if (status === 401 || status === 403) return 'server';
    if (status === 404) return 'notFound';
    if (status === 400 || status === 409) return 'rejected';
    return status >= 500 ? 'server' : 'unreachable';
  }

  /** @returns {Promise<unknown>} */
  async function readIntegrations() {
    const response = await (await client()).request('GET', '/api/integration', {timeoutMs: LIST_TIMEOUT_MS});
    if (!response.ok) {
      const error = /** @type {Error & {code?: string}} */ (Error(`HTTP ${response.status}`));
      error.code = statusFailure(response.status);
      throw error;
    }
    return response.payload;
  }

  /**
   * A lista para a primeira abertura e as Configurações. Não bloqueia a
   * partida: o handler é assíncrono e a tela pinta "conferindo" antes.
   * @returns {Promise<Record<string, unknown>>}
   */
  async function providers() {
    const mod = await states();
    const old = String(oldVersion() || '');
    if (old) return {state: 'old', version: old, binary: binary(), platform};
    const found = String(binary() || '');
    if (!found) return {state: 'missing', binary: '', platform};
    try {
      const view = mod.providerView(await readIntegrations());
      return {state: 'ready', ...view, binary: found, platform};
    } catch (error) {
      const outcome = failureOf(error);
      log(`provedores não lidos: ${outcome} ${mod.safeReason(/** @type {{message?: string}} */ (error)?.message)}`);
      return {state: outcome === 'notFound' ? 'old' : outcome, binary: found, platform};
    }
  }

  /** @param {unknown} value @returns {string} */
  function integrationID(value) {
    if (typeof value !== 'string' || !INTEGRATION_RE.test(value)) throw Error(invalidRequest('opencode-provider-login-start', 'integrationID', value, 'string(a-z0-9-)'));
    return value;
  }

  /** @param {unknown} value @returns {string} */
  function methodID(value) {
    if (value === undefined || value === '') return '';
    if (typeof value !== 'string' || !METHOD_RE.test(value)) throw Error(invalidRequest('opencode-provider-login-start', 'methodID', value, 'string(A-Za-z0-9._-)'));
    return value;
  }

  /** @param {unknown} value @returns {string} */
  function attemptID(value) {
    if (typeof value !== 'string' || !ATTEMPT_RE.test(value)) throw Error(invalidRequest('opencode-provider-login-status', 'attemptID', value, 'string(A-Za-z0-9_-)'));
    return value;
  }

  /** @param {unknown} value @returns {string} */
  function keyOf(value) {
    if (typeof value !== 'string') throw Error(invalidRequest('opencode-provider-login-start', 'key', value, 'string(1..400)'));
    const key = value.trim();
    if (!key || key.length > 400) throw Error(invalidRequest('opencode-provider-login-start', 'key', value, 'string(1..400)'));
    return key;
  }

  /** @param {unknown} value @returns {string} */
  function codeOf(value) {
    if (typeof value !== 'string') throw Error(invalidRequest('opencode-provider-login-complete', 'code', value, 'string(1..4000)'));
    const code = value.trim();
    if (!code || code.length > 4000) throw Error(invalidRequest('opencode-provider-login-complete', 'code', value, 'string(1..4000)'));
    return code;
  }

  /** @param {string} id @param {string} method */
  async function startOAuth(id, method) {
    const response = await (await client()).request('POST', `/api/integration/${id}/connect/oauth`, {body: {methodID: method}, timeoutMs: LOGIN_TIMEOUT_MS});
    if (!response.ok) return {ok: false, outcome: statusFailure(response.status)};
    const mod = await states();
    const attempt = mod.normalizeAttempt(response.payload);
    if (!attempt) return {ok: false, outcome: 'server'};
    attempts.set(attempt.attemptID, {integrationID: id, url: attempt.url, relinked: false, at: Date.now()});
    const browser = await openBrowser(attempt.url);
    log(`login ${id} por ${method}: tentativa aberta`);
    return {ok: true, kind: 'oauth', ...attempt, browser};
  }

  /** @param {string} id @param {string} key @param {string} label */
  async function startKey(id, key, label) {
    const body = {key, ...(label ? {label} : {})};
    const response = await (await client()).request('POST', `/api/integration/${id}/connect/key`, {body, timeoutMs: LOGIN_TIMEOUT_MS});
    if (!response.ok) return {ok: false, outcome: [400, 401, 403].includes(response.status) ? 'rejected' : statusFailure(response.status)};
    log(`login ${id} por chave: completo`);
    return {ok: true, kind: 'complete', ...(await relink())};
  }

  /** @param {string} url @returns {Promise<boolean>} */
  async function openBrowser(url) {
    if (!url) return false;
    try { return (await openExternal(url)) !== false; } catch { return false; }
  }

  /** @returns {Promise<{relinked: boolean, busy?: boolean}>} */
  async function relink() {
    try { return await relinkTutor(); } catch (error) {
      log(`religação depois do login falhou: ${String(/** @type {{message?: string}} */ (error)?.message || error).slice(0, 160)}`);
      return {relinked: false};
    }
  }

  /**
   * Começa um login: chave de API (completa na hora) ou OAuth (a tentativa fica
   * viva e o navegador abre no sistema).
   * @param {unknown} raw
   * @returns {Promise<Record<string, unknown>>}
   */
  async function start(raw) {
    const body = raw && typeof raw === 'object' ? /** @type {Record<string, unknown>} */ (raw) : {};
    const id = integrationID(body.integrationID);
    const method = methodID(body.methodID);
    try {
      if (body.key !== undefined) {
        const label = typeof body.label === 'string' ? body.label.trim().slice(0, 120) : '';
        return await startKey(id, keyOf(body.key), label);
      }
      if (!method) return {ok: false, outcome: 'invalid'};
      return await startOAuth(id, method);
    } catch (error) {
      const mod = await states();
      const outcome = failureOf(error);
      log(`login ${id} falhou: ${outcome} ${mod.safeReason(/** @type {{message?: string}} */ (error)?.message)}`);
      return {ok: false, outcome};
    }
  }

  /** @param {unknown} raw @returns {Promise<Record<string, unknown>>} */
  async function status(raw) {
    const id = attemptID(raw && typeof raw === 'object' ? /** @type {{attemptID?: unknown}} */ (raw).attemptID : undefined);
    const attempt = attempts.get(id);
    if (!attempt) return {status: 'expired'};
    if (Date.now() - attempt.at > ATTEMPT_TTL_MS) { attempts.delete(id); return {status: 'expired'}; }
    try {
      const response = await (await client()).request('GET', `/api/integration/${attempt.integrationID}/connect/oauth/${encodeURIComponent(id)}`, {timeoutMs: LOGIN_TIMEOUT_MS});
      if (!response.ok) return {status: response.status === 404 ? 'expired' : 'failed'};
      const mod = await states();
      const next = mod.normalizeAttemptStatus(response.payload);
      if (next.status !== 'complete') return next;
      const relinkResult = attempt.relinked ? {relinked: false} : await relink();
      attempt.relinked = true;
      attempts.delete(id);
      log(`login ${attempt.integrationID}: completo`);
      return {status: 'complete', ...relinkResult};
    } catch (error) {
      const mod = await states();
      const outcome = failureOf(error);
      log(`estado do login ${attempt.integrationID} não lido: ${outcome} ${mod.safeReason(/** @type {{message?: string}} */ (error)?.message)}`);
      return {status: 'failed', outcome};
    }
  }

  /** @param {string} id @param {string} route @param {unknown} body @returns {Promise<Record<string, unknown>>} */
  async function attemptAction(id, route, body) {
    const attempt = attempts.get(id);
    if (!attempt) return {ok: false, outcome: 'expired'};
    try {
      const response = await (await client()).request('POST', `/api/integration/${attempt.integrationID}/connect/oauth/${encodeURIComponent(id)}${route}`, {body, timeoutMs: LOGIN_TIMEOUT_MS});
      if (!response.ok) return {ok: false, outcome: statusFailure(response.status)};
      if (route === '/complete') {
        attempt.relinked = true;
        attempts.delete(id);
        log(`login ${attempt.integrationID}: código concluído`);
        return {ok: true, status: 'complete', ...(await relink())};
      }
      return {ok: true};
    } catch (error) {
      const mod = await states();
      return {ok: false, outcome: failureOf(error), reason: mod.safeReason(/** @type {{message?: string}} */ (error)?.message)};
    }
  }

  /** @param {unknown} raw @returns {Promise<Record<string, unknown>>} */
  async function complete(raw) {
    const body = raw && typeof raw === 'object' ? /** @type {Record<string, unknown>} */ (raw) : {};
    return attemptAction(attemptID(body.attemptID), '/complete', {code: codeOf(body.code)});
  }

  /** @param {unknown} raw @returns {Promise<Record<string, unknown>>} */
  async function reopen(raw) {
    const id = attemptID(raw && typeof raw === 'object' ? /** @type {{attemptID?: unknown}} */ (raw).attemptID : undefined);
    const attempt = attempts.get(id);
    if (!attempt) return {ok: false, outcome: 'expired'};
    return {ok: await openBrowser(attempt.url)};
  }

  /** @param {unknown} raw @returns {Promise<Record<string, unknown>>} */
  async function cancel(raw) {
    const id = attemptID(raw && typeof raw === 'object' ? /** @type {{attemptID?: unknown}} */ (raw).attemptID : undefined);
    const attempt = attempts.get(id);
    if (!attempt) return {ok: true};
    attempts.delete(id);
    try {
      await (await client()).request('DELETE', `/api/integration/${attempt.integrationID}/connect/oauth/${encodeURIComponent(id)}`, {timeoutMs: LOGIN_TIMEOUT_MS});
      log(`login ${attempt.integrationID}: cancelado`);
    } catch (error) {
      log(`login ${attempt.integrationID}: cancelamento sem resposta (${failureOf(error)})`);
    }
    return {ok: true};
  }

  ipcMain.handle('opencode-providers', () => providers());
  ipcMain.handle('opencode-provider-login-start', (_event, request) => start(request));
  ipcMain.handle('opencode-provider-login-status', (_event, request) => status(request));
  ipcMain.handle('opencode-provider-login-open', (_event, request) => reopen(request));
  ipcMain.handle('opencode-provider-login-complete', (_event, request) => complete(request));
  ipcMain.handle('opencode-provider-login-cancel', (_event, request) => cancel(request));

  return {providers, start, status, reopen, complete, cancel};
}

module.exports = {createOpenCodeProvidersHost};
