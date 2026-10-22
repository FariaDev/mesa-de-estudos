// @ts-check
'use strict';

/* Adaptador do motor OpenCode (#57; porte da branch t3/opencode-provider,
   refeito no estilo do main e medido no binário 2.0.32). Fala HTTP com o
   `opencode serve` que a Mesa é dona (`opencode-serve-owner.cjs`); nada de
   ACP e nenhum processo do Pi.

   Sessão: `POST /api/session` com a pasta da conversa (`location.directory`),
   as permissões de estudo (sem editar, sem shell, sem subagente, sem
   navegador) e o modelo escolhido. Na primeira vez vai SEM `id`: o servidor
   cunha o `ses_` e o adaptador o entrega a `onSessionId` para o descritor
   (o Zen recusa o grátis com id de fora; veja `native-identity.cjs`). Depois
   o POST leva esse id, e repetir o mesmo id devolve a MESMA sessão (medido),
   então recriar depois de um servidor novo é seguro.

   Entrega (prompt e comando) segue `agentdelivery.bend`: aceite comprovado
   (200 + item `user` da inbox, ou 204 no comando) abre o turno, que só fecha
   pelo SSE; recusa comprovada (400/401/404/409) pode ser repetida; o resto é
   INCERTEZA e nunca é reenviado sozinho. Queda do SSE com turno em voo também
   vira incerteza.

   O `serve` não tem campo de system prompt: as instruções da Mesa entram no
   PRIMEIRO prompt (só no fio) e saem do histórico na leitura. */

const {EventEmitter} = require('node:events');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const deliveryCore = require('../generated/agentdelivery.core.js').default;
const {createOpenCodeClient, isRefusal, wireItem} = require('./opencode-http.cjs');
const {OpenCodeEventReader} = require('./opencode-events.cjs');
const {CompactionTracker, runCompaction} = require('./opencode-compaction.cjs');
const {listCommands} = require('./opencode-commands.cjs');
const {OpenCodeControls} = require('./opencode-controls.cjs');
const {messageList, normalizeHistory} = require('./opencode-history.cjs');
const {contextUsage} = require('./opencode-usage.cjs');
const {WIRE_SESSION_RE, wireMessageId} = require('./opencode-ids.cjs');
const {materializeImages} = require('./opencode-images.cjs');
const {message} = require('../i18n.mjs');

const PROMPT_TIMEOUT_MS = 120000;
/* Estudo, não oficina: o tutor lê e conversa, não mexe no computador. */
const STUDY_PERMISSIONS = Object.freeze(['edit', 'shell', 'subagent', 'browser'].map((action) => Object.freeze({action, resource: '*', effect: 'deny'})));

/**
 * @typedef {import('./opencode-serve-owner.cjs').ServeLease} ServeLease
 * @typedef {import('./opencode-http.cjs').OpenCodeClient} OpenCodeClient
 * @typedef {{conversationId?: string, sessionId: string, acquire: () => Promise<ServeLease>, directory: string,
 *   resume?: boolean, systemPrompt?: string, onSessionId?: (id: string) => unknown, sessionTitle?: string, selection?: unknown, fetch?: typeof globalThis.fetch,
 *   persistDelivery?: (patch: {id: string, status: string}) => unknown, log?: (area: string, line: string) => void,
 *   mcpConfig?: () => Record<string, unknown>|null, compactTimeoutMs?: number}} OpenCodeAdapterOptions
 */

/** @param {string} key @param {Record<string, string|number>} args @param {Record<string, unknown>} flags */
const failure = (key, args, flags) => Object.assign(Error(message(key, args)), flags);
/** @param {unknown} payload */
const inboxUser = (payload) => { const item = wireItem(payload); return item.type === 'user' || item.role === 'user'; };

class OpenCodeAdapter extends EventEmitter {
  /** @param {OpenCodeAdapterOptions} options */
  constructor(options) {
    super();
    if (options.sessionId && !WIRE_SESSION_RE.test(String(options.sessionId))) throw failure('err.opencode.badSession', {received: JSON.stringify(options.sessionId)}, {notSent: true});
    this.options = options;
    this.conversationId = options.conversationId || '';
    /** @type {string} vazio até o servidor cunhar o `ses_` */
    this.sessionId = options.sessionId || '';
    this.log = options.log || (() => {});
    this.systemSent = options.resume === true;
    /** @type {ServeLease|null} */
    this.lease = null;
    /** @type {OpenCodeClient|null} */
    this.client = null;
    /** @type {import('./opencode-http.cjs').EventStream|null} */
    this.stream = null;
    /** @type {Promise<void>|null} */
    this.binding = null;
    this.busy = false;
    /** @type {{id: string}|null} */
    this.turn = null;
    this.runId = '';
    this.tempDir = '';
    /** @type {import('./opencode-commands.cjs').SlashCommand[]|null} */
    this.commandCache = null;
    this.compactions = new CompactionTracker({timeoutMs: options.compactTimeoutMs});
    this.controls = new OpenCodeControls({request: () => this.http().request, selection: options.selection});
    this.reader = new OpenCodeEventReader({emit: (type, payload) => this.fromReader(type, /** @type {Record<string, unknown>} */ (payload || {})), sessionId: this.sessionId});
  }

  /* ---------- servidor e sessão ---------- */

  /** @returns {OpenCodeClient} */
  http() {
    if (!this.client) throw failure('err.opencode.notConnected', {}, {notSent: true});
    return this.client;
  }

  /** @param {string} suffix */
  route(suffix) {
    return `/api/session/${encodeURIComponent(this.sessionId)}${suffix}`;
  }

  location() {
    return {'location[directory]': this.options.directory};
  }

  /* O servidor pode ter sido trocado (chave nova ou queda): a sessão é
     religada no servidor que o dono entregar agora. */
  async connect() {
    if (this.binding) return this.binding;
    this.binding = this.bind().finally(() => { this.binding = null; });
    return this.binding;
  }

  async bind() {
    const lease = await this.options.acquire();
    if (this.lease && lease.baseUrl === this.lease.baseUrl && this.client) return;
    this.closeStream();
    this.lease = lease;
    this.client = createOpenCodeClient({baseUrl: lease.baseUrl, password: lease.password, fetch: this.options.fetch, log: this.log});
    this.commandCache = null;
    await this.controls.load();
    if (!this.controls.selectionAvailable()) this.emitEvent('warning', {code: 'OPENCODE_MODEL_UNAVAILABLE', message: message('opencode.controls.savedUnavailable')});
    await this.admitSession();
    await this.registerMcp();
    this.emitEvent('init', {executable: lease.binary, sessionId: this.sessionId});
    await this.ensureEvents();
  }

  async admitSession() {
    const found = this.options.resume ? await this.http().request('GET', this.route('')) : null;
    if (found?.ok) return this.applyModel();
    if (found) this.emitEvent('warning', {code: 'OPENCODE_SESSION_MISSING', message: message('opencode.session.missing')});
    const ref = this.controls.ref();
    const body = {...(this.sessionId ? {id: this.sessionId} : {}), title: this.options.sessionTitle || message('opencode.session.title'), location: {directory: this.options.directory},
      permissions: STUDY_PERMISSIONS, ...(ref ? {model: ref} : {})};
    const created = await this.http().request('POST', '/api/session', {body});
    const id = String(wireItem(created.payload).id || '');
    if (created.ok && id && id === this.sessionId) return;
    if (created.ok && !this.sessionId && WIRE_SESSION_RE.test(id)) return this.adoptSession(id);
    throw failure(created.ok ? 'err.opencode.otherSession' : 'err.opencode.sessionRefused', {status: created.status, received: JSON.stringify(id)}, {notSent: true});
  }

  /** O `ses_` que o servidor cunhou passa a ser o desta conversa. @param {string} id */
  async adoptSession(id) {
    this.sessionId = id;
    this.reader.sessionId = id;
    try { await this.options.onSessionId?.(id); } catch (error) { this.log('opencode', `id da sessão não gravado no descritor: ${error?.message || error}`); }
  }

  async applyModel() {
    const ref = this.controls.ref();
    if (ref) await this.switchModel(ref);
  }

  /** @param {import('./opencode-catalog.cjs').ModelRef} ref */
  async switchModel(ref) {
    const response = await this.http().request('POST', this.route('/model'), {body: {model: ref}});
    if (!response.ok) throw failure('err.opencode.modelRefused', {status: response.status, model: `${ref.providerID}/${ref.id}`}, {notSent: true, status: response.status});
  }

  /* As ferramentas da Mesa (GeoGebra, atividades) entram como MCP `mesa` na
     pasta da conversa. Falhar aqui não derruba o estudo: só avisa. */
  async registerMcp() {
    const config = this.options.mcpConfig?.() || null;
    if (!config) return;
    const response = await this.http().request('PUT', '/api/experimental/mcp/mesa', {body: {config}, query: this.location()}).catch((error) => ({ok: false, status: 0, error}));
    if (!response.ok) this.emitEvent('warning', {code: 'OPENCODE_MCP_FAILED', message: message('opencode.mcp.failed', {status: response.status})});
  }

  /* ---------- eventos ---------- */

  /** @param {string} type @param {Record<string, unknown>} [payload] */
  emitEvent(type, payload = {}) {
    this.emit('event', {type, conversationId: this.conversationId, runId: this.runId, adapter: 'opencode', at: new Date().toISOString(), ...payload});
  }

  /** @param {string} type @param {Record<string, unknown>} payload */
  fromReader(type, payload) {
    if (type.startsWith('compaction_')) {
      this.compactions.receive(type, payload);
      if (type !== 'compaction_delta') this.emitEvent(type, payload);
      return;
    }
    if (type === 'execution') return this.settleTurn({isError: payload.status === 'failed', cancelled: payload.status === 'interrupted'});
    if (type === 'idle') return this.settleTurn({});
    this.emitEvent(type, payload);
    if (type === 'error') this.settleTurn({isError: true});
  }

  /** @param {string} status @param {string} id */
  async delivery(status, id) {
    this.emitEvent('delivery', {status, id});
    try { await this.options.persistDelivery?.({id, status}); } catch (error) { this.log('opencode', `fase da entrega não gravada: ${error?.message || error}`); }
  }

  /** @param {{isError?: boolean, cancelled?: boolean, uncertain?: boolean}} end */
  endTurn({isError = false, cancelled = false, uncertain = false}) {
    if (!this.turn) return;
    this.turn = null;
    this.busy = false;
    this.emitEvent('turn_end', {isError, cancelled, uncertain});
  }

  /** Fim comprovado: `settled` é terminal e não reenvia. @param {{isError?: boolean, cancelled?: boolean}} end */
  settleTurn(end) {
    if (this.turn?.id) void this.delivery('settled', this.turn.id);
    this.endTurn(end);
  }

  /** O SSE vivo; reabre se caiu. @returns {Promise<boolean>} */
  async ensureEvents() {
    if (this.stream) return true;
    const stream = await this.http().openEvents((event) => this.reader.handle(event.type, event.data));
    if (!stream) return false;
    this.stream = stream;
    void stream.closed.then(() => this.streamClosed(stream));
    return true;
  }

  /** @param {import('./opencode-http.cjs').EventStream} stream */
  streamClosed(stream) {
    if (this.stream !== stream) return;
    this.stream = null;
    this.compactions.abandon(this.compactions.current);
    /* Queda depois do aceite: a entrega fica incerta e NUNCA é reenviada. */
    const id = this.turn?.id;
    if (!id) return;
    void this.delivery('uncertain', id);
    this.endTurn({uncertain: true});
  }

  closeStream() {
    const stream = this.stream;
    this.stream = null;
    try { stream?.abort(); } catch { /* já fechado */ }
  }

  /* ---------- entrega ---------- */

  /**
   * Manda um prompt ou comando e classifica a resposta pelo núcleo.
   * @param {{id: string, route: string, body: Record<string, unknown>, accepts: (response: import('./opencode-http.cjs').OpenCodeResponse) => boolean, action: string, onRefused?: () => void}} admission
   */
  async admitTurn({id, route, body, accepts, action, onRefused}) {
    if (!await this.ensureEvents()) throw failure('opencode.noEvents', {}, {notSent: true});
    let response;
    try {
      response = await this.http().request('POST', route, {body, timeoutMs: PROMPT_TIMEOUT_MS});
    } catch (error) {
      await this.delivery('uncertain', id);
      throw error;
    }
    const accepted = accepts(response);
    const verdict = deliveryCore.outcome(accepted, !accepted && !isRefusal(response.status)).$;
    if (verdict === 'DeliveryOutcome.Accepted') return this.openTurn(id, response);
    if (verdict === 'DeliveryOutcome.Refused') {
      onRefused?.();
      await this.delivery('refused', id);
      throw failure('err.opencode.refused', {action, status: response.status}, {notSent: true, status: response.status});
    }
    await this.delivery('uncertain', id);
    throw failure('err.opencode.unconfirmed', {action, status: response.status}, {uncertain: true, notSent: false, status: response.status});
  }

  /** @param {string} id @param {import('./opencode-http.cjs').OpenCodeResponse} response */
  async openTurn(id, response) {
    const item = wireItem(response.payload);
    this.runId = String(inboxUser(response.payload) ? item.id || id : id);
    this.busy = true;
    this.turn = {id};
    await this.delivery('accepted', id);
    this.emitEvent('turn_start', {id});
    return {id, accepted: true};
  }

  /** @param {unknown} images */
  files(images) {
    return materializeImages(images, {
      tempDir: () => this.tempDir || (this.tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-opencode-'))),
      warn: (code, text) => this.emitEvent('warning', {code, message: text}),
    });
  }

  /**
   * Envia uma mensagem do aluno; `delivery: 'steer'` interrompe o turno em voo.
   * @param {{id?: string, text?: string, images?: unknown[], delivery?: 'steer'}} input
   */
  async send(input) {
    const id = String(input.id || '');
    await this.connect();
    let text = String(input.text || '');
    const withSystem = Boolean(this.options.systemPrompt) && !this.systemSent;
    if (withSystem) { this.systemSent = true; text = `${this.options.systemPrompt}\n\n${text}`; }
    const files = this.files(input.images);
    const body = {id: wireMessageId(id), text, resume: true, ...(input.delivery === 'steer' ? {delivery: 'steer'} : {}), ...(files.length ? {files} : {})};
    /* Recusa comprovada desfaz a marca: a retentativa ainda leva as instruções. */
    return this.admitTurn({id, route: this.route('/prompt'), body, action: 'opencode.action.prompt',
      accepts: (response) => response.status === 200 && inboxUser(response.payload),
      onRefused: () => { if (withSystem) this.systemSent = false; }});
  }

  /** @param {{id?: string, name: string, text?: string, images?: unknown[]}} input */
  async command(input) {
    const id = String(input.id || '');
    await this.connect();
    const files = this.files(input.images);
    const body = {name: String(input.name || '').replace(/^\/+/, ''), text: String(input.text || ''), ...(files.length ? {files} : {})};
    return this.admitTurn({id, route: this.route('/command'), body, action: 'opencode.action.command',
      accepts: (response) => response.status === 204 || (response.status === 200 && inboxUser(response.payload))});
  }

  /** @param {{id?: string}} [input] */
  async compact(input = {}) {
    await this.connect();
    return runCompaction({request: this.http().request, route: (suffix) => this.route(suffix), ensureEvents: () => this.ensureEvents(), compactions: this.compactions}, input);
  }

  async cancel() {
    if (!this.client) return {aborted: false};
    const response = await this.http().request('POST', this.route('/interrupt')).catch((error) => {
      this.log('opencode', `falha ao interromper: ${error?.message || error}`);
      return null;
    });
    this.endTurn({cancelled: true});
    return {aborted: Boolean(response?.ok)};
  }

  /** @param {{id?: string, decision?: string, confirmed?: boolean}} input */
  async respond(input) {
    const requestID = String(input?.id || '');
    if (!requestID) throw failure('err.opencode.permissionId', {received: JSON.stringify(input?.id)}, {notSent: true});
    const decision = ['once', 'always', 'reject'].includes(String(input.decision)) ? input.decision : (input.confirmed === true ? 'once' : 'reject');
    const response = await this.http().request('POST', this.route(`/permission/${encodeURIComponent(requestID)}/reply`), {body: {decision}});
    if (!response.ok) throw failure('err.opencode.permissionRefused', {status: response.status}, {notSent: true});
    return {ok: true, decision};
  }

  /* ---------- leitura ---------- */

  async history() {
    await this.connect();
    const response = await this.http().request('GET', this.route('/message'));
    const list = normalizeHistory(messageList(response.ok ? response.payload : null));
    return this.stripSystemPrompt(list);
  }

  /** @param {Array<{role: string, content: Array<{type: string, text?: string}>}>} list */
  stripSystemPrompt(list) {
    const prefix = this.options.systemPrompt ? `${this.options.systemPrompt}\n\n` : '';
    const first = list.find((item) => item.role === 'user');
    const part = first?.content?.find((item) => item.type === 'text');
    if (prefix && part?.text?.startsWith(prefix)) part.text = part.text.slice(prefix.length);
    return list;
  }

  async commands() {
    await this.connect();
    if (!this.commandCache) this.commandCache = await listCommands({request: this.http().request, location: () => this.location()});
    return this.commandCache;
  }

  /* Página nova-primeiro + catálogo. Sem tokens reais ou sem `limit.context`,
     null: o medidor some em vez de inventar. */
  async sessionUsage() {
    if (!this.client) return null;
    try {
      const [messages, models] = await Promise.all([
        this.http().request('GET', this.route('/message'), {query: {limit: '50', order: 'desc'}}),
        this.http().request('GET', '/api/model'),
      ]);
      return messages.ok && models.ok ? contextUsage(messageList(messages.payload), models.payload) : null;
    } catch {
      return null;
    }
  }

  snapshot() {
    return {busy: this.busy, compacting: Boolean(this.compactions.current), ...this.controls.view()};
  }

  controlsSnapshot() {
    return this.controls.snapshot();
  }

  async initializeControls() {
    await this.connect();
    await this.controls.load();
    return this.controls.snapshot();
  }

  /** @param {unknown} selection @param {{persistSelection?: (patch: {model: string|null, effort: string|null}) => void}} [options] */
  async setControls(selection, {persistSelection} = {}) {
    if (this.busy) throw failure('opencode.svc.waitTurn', {}, {notSent: true});
    await this.connect();
    await this.controls.load();
    const compiled = this.controls.compile(selection);
    if (compiled.ref) await this.switchModel(compiled.ref);
    this.controls.selection = {model: compiled.model, effort: compiled.effort};
    persistSelection?.({model: compiled.model, effort: compiled.effort});
    return this.controls.snapshot();
  }

  /* A política de ferramentas do Claude não se aplica: as regras de estudo
     já vão na criação da sessão. */
  setToolPolicy() {}

  cacheHistory() {}

  stop() {
    this.closeStream();
    this.compactions.abandon(this.compactions.current);
    this.turn = null;
    this.busy = false;
    if (this.tempDir) { try { fs.rmSync(this.tempDir, {recursive: true, force: true}); } catch { /* temporário já saiu */ } }
    this.tempDir = '';
  }
}

module.exports = {OpenCodeAdapter, STUDY_PERMISSIONS, PROMPT_TIMEOUT_MS};
