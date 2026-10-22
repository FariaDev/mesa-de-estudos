// @ts-check
'use strict';

/* Modelos grátis do OpenCode Zen pelo Pi, no host (#44). A decisão — o que vale
   como chave, o que é grátis, a política de cada modelo, o padrão, a frase do
   teste — é do núcleo (`core/freemodels.bend`); aqui ficam o cofre da chave
   (`opencode-key-store.cjs`), a área de transferência, o arquivo do OpenCode, a
   rede e o catálogo do Pi, todos entrando por parâmetro (nos testes, por fakes
   com nome: `tests/fake-opencode.mjs`, `tests/fake-secret-cipher.cjs`).

   A chave só existe cifrada no disco; em claro, só na memória do processo e no
   ambiente do Pi (`OPENCODE_API_KEY`), lida a cada lançamento. Nenhuma mensagem,
   log nem retorno de canal carrega a chave: o renderer recebe só a máscara.

   Canais (todos devolvem `{ok, outcome, message, masked?}` onde há resultado;
   `message` é mensagem do catálogo, chave + argumentos, que o renderer traduz):
   - `opencode-status`            → {saved, masked, secure, authFile:{exists, display}, model, paidConfirmed, consoleUrl}
   - `opencode-open-console`      → abre o console do OpenCode no navegador do sistema
   - `opencode-clipboard-peek`    → {found, masked?}: lê a área de transferência AGORA
                                     e guarda o candidato só na memória
   - `opencode-clipboard-accept`  → testa e guarda o candidato do `peek`
   - `opencode-clipboard-forget`  → esquece o candidato sem guardar
   - `opencode-key-save` {key}    → testa e guarda o que a pessoa digitou
   - `opencode-key-test` {key?}   → só testa (a digitada, ou a guardada)
   - `opencode-key-remove`        → apaga a chave e o modelo padrão grátis
   - `opencode-auth-file-use`     → lê o `auth.json` do OpenCode (só neste clique) e copia a chave
   - `opencode-paid-ack`          → lembra que o aviso de modelo pago foi aceito */
const fs = require('node:fs');
const path = require('node:path');
const core = require('./src/generated/freemodels.core.js').default;
const {toNat} = require('./src/bend-nat.mjs');
const {message} = require('./src/i18n.mjs');
const policyTable = require('./free-models.json');

const CONSOLE_URL = 'https://opencode.ai/auth';
const MODELS_PATH = '/inference/v1/models';
const DEFAULT_BASE = 'https://opencode.ai';
const PROBE_TIMEOUT_MS = 8000;
const LIVE_TIMEOUT_MS = 4000;
const CLIPBOARD_MAX = 400;

const fromList = (node) => { const out = []; for (let at = node; at?.$ === 'Con'; at = at.tail) out.push(at.head); return out; };

/** Onde o OpenCode guarda a chave (docs: ~/.local/share/opencode/auth.json; XDG_DATA_HOME vale). */
function authFilePath({homeDir, xdgDataHome = ''}) {
  return path.join(xdgDataHome || path.join(homeDir, '.local', 'share'), 'opencode', 'auth.json');
}

/** Caminho para mostrar na tela, com `~` no lugar da casa. */
function displayPath(file, homeDir) {
  return homeDir && file.startsWith(homeDir) ? `~${file.slice(homeDir.length)}` : file;
}

/**
 * A ordem de preferência do padrão: só o que a tabela marca como recomendado E retenção zero.
 * @param {{models: Record<string, {policy: string, recommended?: boolean}>}} [table]
 */
function preferredDefaults(table = policyTable) {
  return Object.entries(table.models)
    .filter(([, entry]) => entry.recommended === true && core.isZeroRetention(entry.policy))
    .map(([id]) => id);
}

/**
 * @param {{ipcMain: {handle: Function}, keyStore: ReturnType<typeof import('./opencode-key-store.cjs').createKeyStore>,
 *   state: () => any, patchState: (patch: object) => void,
 *   fetchImpl?: typeof fetch, readClipboard: () => string | Promise<string>, openExternal: (url: string) => any,
 *   homeDir: string, xdgDataHome?: string, baseUrl?: string,
 *   relinkTutor: () => Promise<{relinked: boolean, busy?: boolean}>,
 *   appendLog?: (area: string, line: string) => void}} deps
 */
function createOpencodeHost(deps) {
  const {ipcMain, keyStore, state, patchState, readClipboard, openExternal, homeDir, relinkTutor,
    fetchImpl = fetch, xdgDataHome = '', baseUrl = DEFAULT_BASE, appendLog = () => {}} = deps;
  const excluded = policyTable.excluded || {};
  let candidate = '';
  let liveIds = null;
  let livePromise = null;

  const policyOf = (id) => policyTable.models[id]?.policy || '';
  const authFile = () => authFilePath({homeDir, xdgDataHome});

  /* ---------- lista ao vivo do Zen (sem chave, sem inferência) ---------- */

  async function fetchLiveIds() {
    try {
      const res = await fetchImpl(baseUrl + MODELS_PATH, {signal: AbortSignal.timeout(LIVE_TIMEOUT_MS)});
      if (res.status !== 200) return null;
      const body = await res.json();
      const ids = Array.isArray(body?.data) ? body.data.map((m) => String(m?.id || '')).filter(Boolean) : [];
      return ids.length ? new Set(ids) : null;
    } catch { return null; }
  }

  /** Confere a lista ao vivo (uma por vez); sem rede o aviso "pode ter saído" simplesmente não existe. */
  function refreshLive() {
    if (!livePromise) livePromise = fetchLiveIds().then((ids) => { liveIds = ids; livePromise = null; return ids; });
    return livePromise;
  }

  /** Espera a conferência em andamento por no máximo `ms`: conectar não pode esperar a rede. */
  async function liveReady(ms = 1500) {
    if (!livePromise) return;
    await Promise.race([livePromise, new Promise((resolve) => setTimeout(resolve, ms))]);
  }

  /* ---------- catálogo do Pi → o que o seletor mostra ---------- */

  /** Custo zero só com o preço presente e zero na entrada e na saída: preço ausente não prova nada. */
  const provenCostZero = (model) => !!model?.cost && model.cost.input === 0 && model.cost.output === 0;

  /**
   * Tira o que não dá para chamar e marca o grátis com a política e o aviso.
   * O Pi (`keepFree: false`) não leva os grátis: o OpenCode só libera o plano
   * grátis no próprio cliente, e pelo Pi a inferência volta 403 `FreeTierError`
   * (#57, medido em 2026-10-19). O motor OpenCode passa `keepFree: true`.
   * @param {Array<{provider?: string, id?: string, cost?: {input?: number, output?: number}}>} models
   * @param {{keepFree?: boolean}} [options]
   * @example annotate(piModels) // sem os `-free` do Zen
   */
  function annotate(models, {keepFree = false} = {}) {
    const known = liveIds !== null;
    const out = [];
    for (const model of Array.isArray(models) ? models : []) {
      if (model?.provider === core.routerProvider()) { out.push(annotateRouter(model)); continue; }
      if (model?.provider !== core.zenProvider()) { out.push(model); continue; }
      if (Object.hasOwn(excluded, model.id)) continue;
      const costZero = provenCostZero(model);
      const free = core.isFree(model.provider, model.id, costZero);
      if (free && !keepFree) continue;
      const left = core.mayHaveLeft(free, known, known && liveIds.has(model.id));
      const policy = policyOf(model.id);
      out.push({...model, free: {is: free, policy, tail: fromList(core.optionTail(free, policy, left))}});
    }
    return out;
  }

  /**
   * O grátis do OpenRouter (ajustes do seletor) leva a marca e "sem informação
   * de privacidade": a política de dados dele não é conhecida. Pago passa intacto.
   * @example annotateRouter({provider: 'openrouter', id: 'x/y:free'}).free.is // true
   */
  function annotateRouter(model) {
    if (!core.isRouterFree(model.provider, String(model.id || ''), provenCostZero(model))) return model;
    return {...model, free: {is: true, policy: '', tail: fromList(core.optionTail(true, '', false))}};
  }

  /* ---------- teste e guarda da chave ---------- */

  async function probe(key) {
    try {
      const res = await fetchImpl(baseUrl + MODELS_PATH, {
        headers: {authorization: `Bearer ${key}`},
        signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      });
      return core.outcome(false, toNat(res.status));
    } catch { return core.outcome(true, 0); }
  }

  /** @param {string} outcome @param {{masked?: string}} [extra] */
  const reply = (outcome, extra = {}) => ({ok: core.keepsKey(outcome), outcome, message: core.outcomeMsg(outcome), ...extra});

  async function test(rawKey) {
    const key = String(rawKey ?? '').trim();
    const shapeOk = core.typedKey(key);
    const outcome = shapeOk ? await probe(key) : core.outcomeFor(false, false, 0);
    appendLog('opencode', `teste da chave: ${outcome}`);
    return reply(outcome, shapeOk ? {masked: core.mask(key)} : {});
  }

  /** Testa e, só se valer, guarda e religa o tutor para o Pi nascer com a chave. */
  async function accept(rawKey, source) {
    const key = String(rawKey ?? '').trim();
    const result = await test(key);
    if (!result.ok) return result;
    try { keyStore.save(key); } catch (error) {
      appendLog('opencode', `chave não guardada: ${error.message}`);
      return {ok: false, outcome: 'vault', message: message('freeModels.save.noVault'), masked: result.masked};
    }
    patchState({opencodeModel: ''});
    appendLog('opencode', `chave guardada (${source})`);
    return {...result, relink: await relinkTutor()};
  }

  /* ---------- fontes da chave ---------- */

  /* `clipboard.readText()` do Electron 44 devolve Promise: sem o await o peek
     lia "[object Promise]" e nunca achava a chave (#43 fase 3, achado pelo tsc). */
  async function peekClipboard() {
    candidate = '';
    const raw = String((await readClipboard()) ?? '').trim();
    if (!raw || raw.length > CLIPBOARD_MAX || !core.clipboardKey(raw)) return {found: false};
    if (keyStore.has() && raw === keyStore.load()) return {found: false};
    candidate = raw;
    return {found: true, masked: core.mask(raw)};
  }

  async function acceptCandidate() {
    const key = candidate;
    candidate = '';
    if (!key) return {ok: false, outcome: 'shape', message: core.outcomeMsg('shape')};
    return accept(key, 'área de transferência');
  }

  /** Só chamada pelo clique da pessoa; diz qual arquivo vai ler antes (na tela). */
  async function useAuthFile() {
    let key;
    try {
      const data = JSON.parse(fs.readFileSync(authFile(), 'utf8'));
      key = data?.opencode?.type === 'api' ? String(data.opencode.key || '') : '';
    } catch (error) {
      appendLog('opencode', `auth.json do OpenCode não lido: ${error.code || 'ilegível'}`);
      return {ok: false, outcome: 'authFile', message: message('freeModels.authFile.unreadable')};
    }
    if (!key) return {ok: false, outcome: 'authFile', message: message('freeModels.authFile.noKey')};
    return accept(key, 'auth.json do OpenCode');
  }

  /* ---------- estado e padrão ---------- */

  function status() {
    const file = authFile();
    let exists;
    try { exists = fs.statSync(file).isFile(); } catch { exists = false; }
    return {
      saved: keyStore.has(),
      masked: keyStore.has() ? core.mask(keyStore.load()) : '',
      secure: keyStore.available(),
      authFile: {exists, display: displayPath(file, homeDir)},
      model: String(state()?.opencodeModel || ''),
      paidConfirmed: state()?.opencodePaidOk === true,
      consoleUrl: CONSOLE_URL,
    };
  }

  async function remove() {
    keyStore.clear();
    patchState({opencodeModel: ''});
    candidate = '';
    appendLog('opencode', 'chave removida');
    return {ok: true, relink: await relinkTutor()};
  }

  /** O Pi nasce com a chave (e só se ela existe) no ambiente do provedor `opencode`. */
  const keyEnv = () => { const key = keyStore.load(); return key ? {OPENCODE_API_KEY: key} : {}; };

  /** Quem escolheu um modelo do Zen nasce com ele; trocar para outro provedor desfaz.
      Um grátis lembrado de antes da #57 não volta: pelo Pi ele dá 403. */
  function launchArgs() {
    const id = String(state()?.opencodeModel || '');
    if (!id || !keyStore.has() || Object.hasOwn(policyTable.models, id)) return [];
    return ['--provider', core.zenProvider(), '--model', id];
  }

  function rememberModel(model) {
    const remembered = String(state()?.opencodeModel || '');
    if (model?.provider === core.zenProvider() && typeof model.id === 'string') { if (model.id !== remembered) patchState({opencodeModel: model.id}); return; }
    if (remembered) patchState({opencodeModel: ''});
  }

  ipcMain.handle('opencode-status', () => status());
  ipcMain.handle('opencode-open-console', () => openExternal(CONSOLE_URL));
  ipcMain.handle('opencode-clipboard-peek', () => peekClipboard());
  ipcMain.handle('opencode-clipboard-accept', () => acceptCandidate());
  ipcMain.handle('opencode-clipboard-forget', () => { candidate = ''; });
  ipcMain.handle('opencode-key-save', (_event, request) => accept(request?.key, 'campo'));
  ipcMain.handle('opencode-key-test', (_event, request) => test(request?.key ? request.key : keyStore.load()));
  ipcMain.handle('opencode-key-remove', () => remove());
  ipcMain.handle('opencode-auth-file-use', () => useAuthFile());
  ipcMain.handle('opencode-paid-ack', () => { patchState({opencodePaidOk: true}); return true; });

  return {annotate, refreshLive, liveReady, keyEnv, launchArgs, rememberModel, status, preferredDefaults};
}

module.exports = {createOpencodeHost, authFilePath, displayPath, preferredDefaults, CONSOLE_URL, MODELS_PATH};
