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

   As instruções da Mesa vão no canal da sessão
   (`PUT …/instructions/entries/mesa`). O `serve` 2.0.32 não tem essa rota:
   aí o prompt vai marcado no envio e sai de TODA mensagem de usuário na leitura
   — não só da primeira, e mesmo se o texto do prompt tiver mudado. */

const {EventEmitter} = require('node:events');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {createOpenCodeClient, wireItem} = require('./opencode-http.cjs');
const {OpenCodeEventReader} = require('./opencode-events.cjs');
const {CompactionTracker, runCompaction} = require('./opencode-compaction.cjs');
const {listCommands} = require('./opencode-commands.cjs');
const {OpenCodeControls} = require('./opencode-controls.cjs');
const {allMessages, messageList, normalizeHistory} = require('./opencode-history.cjs');
const {publishSessionInstructions} = require('./opencode-instructions.cjs');
const {markTutorPrompt, visibleHistory} = require('./tutor-prompt-text.mjs');
const {contextUsage} = require('./opencode-usage.cjs');
const {WIRE_SESSION_RE, wireMessageId} = require('./opencode-ids.cjs');
const {materializeImages} = require('./opencode-images.cjs');
const {PROMPT_TIMEOUT_MS, admitTurn, failure, inboxUser, redactErrorDetail, stringStatus} = require('./opencode-delivery.cjs');
const {trackDelivery, cancel: cancelAdapter, cancelledAcceptance: settleCancelledAcceptance} = require('./opencode-cancel.cjs');
const {createTurnGuard} = require('./opencode-turn-guard.cjs');
const {readOpenCodeVersion, oldOpenCode} = require('./opencode-version.cjs');
const {message} = require('../i18n.mjs');
/**
 * @typedef {import('./opencode-serve-owner.cjs').ServeLease} ServeLease
 * @typedef {import('./opencode-http.cjs').OpenCodeClient} OpenCodeClient
 * @typedef {{conversationId?: string, sessionId: string, acquire: () => Promise<ServeLease>, directory: string,
 *   resume?: boolean, systemPrompt?: string, onSessionId?: (id: string) => unknown, sessionTitle?: string, selection?: unknown, fetch?: typeof globalThis.fetch,
 *   persistDelivery?: (patch: {id: string, status: string}) => unknown, log?: (area: string, line: string) => void,
 *   mcpConfig?: () => Record<string, unknown>|null, compactTimeoutMs?: number,
 *   cancelAcquire?: () => void, readVersion?: (binary: string) => Promise<string>, deleteSessionOnStop?: boolean}} OpenCodeAdapterOptions
 */

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
    /** @type {''|'channel'|'prefix'|'none'} vazio até o `bind` publicar o prompt */
    this.instructionMode = '';
    this.prefixArmed = false;
    /** @type {ServeLease|null} */
    this.lease = null;
    /** @type {OpenCodeClient|null} */
    this.client = null;
    /** @type {import('./opencode-http.cjs').EventStream|null} */
    this.stream = null;
    /** @type {Promise<void>|null} */
    this.binding = null;
    this.turnGuard = createTurnGuard({cancelled: () => failure('tutor.error.cancelled', {}, {notSent: true})});
    this.busy = false;
    /** @type {{id: string, token?: import('./opencode-delivery.cjs').DeliveryToken}|null} */
    this.turn = null;
    /** @type {Set<import('./opencode-delivery.cjs').DeliveryToken>} */
    this.pendingDeliveries = new Set();
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
    const generation = this.turnGuard.capture();
    const lease = await this.options.acquire();
    this.turnGuard.throwIfStale(generation);
    /* O turno usa a API v2 do `serve`: o 1.19.5 estável recusa todo pedido com
       400 Missing key ["prompt"] e nem expõe o MCP `mesa`. Isso vem de antes
       da #91; versão ilegível segue sem bloquear. */
    const versionText = await (this.options.readVersion || readOpenCodeVersion)(lease.binary).catch(() => '');
    this.turnGuard.throwIfStale(generation);
    const old = oldOpenCode(versionText);
    if (old) throw failure('err.opencode.versionUnsupported', {version: old.text}, {notSent: true});
    if (this.lease && lease.baseUrl === this.lease.baseUrl && this.client) return;
    this.closeStream();
    this.lease = lease;
    this.client = createOpenCodeClient({baseUrl: lease.baseUrl, password: lease.password, fetch: this.options.fetch, log: this.log});
    this.commandCache = null;
    try {
      await this.openSession(lease, generation);
    } catch (error) {
      /* Sem isto o próximo connect veria o lease e voltaria cedo: "online" sobre
         uma sessão que nunca existiu, com todo envio recusado. */
      this.closeStream();
      this.lease = null;
      this.client = null;
      throw error;
    }
  }

  async openSession(lease, generation) {
    /* O MCP é da pasta, não da sessão: sobe junto com o catálogo e o admit.
       O SSE espera o ses_ — antes disso o evento de outra conversa no mesmo
       servidor entraria neste leitor. As instruções precisam do ses_. */
    const mcp = this.registerMcp();
    try {
      await this.controls.load();
      /* O MCP é da pasta e a sessão nasce com as ferramentas que ele já
         registrou: esperar aqui, ANTES do admit, evita o primeiro turno sem
         `mesa_*` quando o handshake passa do retorno do PUT. */
      await mcp;
      if (!this.controls.selectionAvailable()) {
        /* Sessão nova com padrão que sumiu do catálogo cai no "OpenCode
           default" sem erro; conversa aberta avisa que a escolha salva não
           existe mais. */
        if (!this.options.resume) this.controls.selection = {model: null, effort: null};
        else this.emitEvent('warning', {code: 'OPENCODE_MODEL_UNAVAILABLE', message: message('opencode.controls.savedUnavailable')});
      }
      await this.admitSession(generation);
    } finally {
      await mcp;
    }
    this.turnGuard.throwIfStale(generation);
    await this.publishTutorPrompt();
    this.emitEvent('init', {executable: lease.binary, sessionId: this.sessionId});
    await this.ensureEvents();
  }

  async admitSession(generation) {
    this.turnGuard.throwIfStale(generation);
    const found = this.options.resume ? await this.http().request('GET', this.route('')) : null;
    if (found?.ok) return this.applyModel();
    if (found) this.emitEvent('warning', {code: 'OPENCODE_SESSION_MISSING', message: message('opencode.session.missing')});
    const ref = this.controls.ref();
    const body = {...(this.sessionId ? {id: this.sessionId} : {}), title: this.options.sessionTitle || message('opencode.session.title'), location: {directory: this.options.directory},
      ...(ref ? {model: ref} : {})};
    const created = await this.http().request('POST', '/api/session', {body});
    this.turnGuard.throwIfStale(generation); // POST tardio não adota após stop/troca (#r5-C)
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

  /* Canal de instruções. Falha (404 do binário antigo, 413, rede) não derruba
     o estudo: o envio leva o prompt marcado e a leitura o tira. */
  async publishTutorPrompt() {
    const prompt = String(this.options.systemPrompt || '');
    this.prefixArmed = false;
    if (!prompt) { this.instructionMode = 'none'; return; }
    const ok = await publishSessionInstructions(this.http().request, this.sessionId, prompt).catch(() => false);
    this.instructionMode = ok ? 'channel' : 'prefix';
  }

  /* As ferramentas da Mesa (GeoGebra, atividades) entram como MCP `mesa` na
     pasta da conversa. Falhar aqui não derruba o estudo: só avisa. */
  async registerMcp() {
    const config = this.options.mcpConfig?.() || null;
    if (!config) return;
    const response = await this.http().request('PUT', '/api/experimental/mcp/mesa', {body: {config}, query: this.location()}).catch((error) => ({ok: false, status: 0, error}));
    if (!response.ok) {
      this.emitEvent('warning', {code: 'OPENCODE_MCP_FAILED', message: message('opencode.mcp.failed', {status: response.status})});
      return;
    }
    await this.waitMcpConnected();
  }

  /* O PUT só enfileira o MCP; no macOS o handshake pode terminar depois do
     retorno. Sem esperar, a sessão nasce e o primeiro prompt vai sem as
     ferramentas da Mesa (o modelo vê só `skill`). Espera o estado `connected`
     por até 10 s; falha não derruba o estudo, só avisa. O `/api/mcp` real não
     lista as ferramentas (2.2.4 e 2.2.5): esperar por elas gastava os 10 s em
     toda conexão e dava um aviso falso (regressão da 596ecc4). */
  async waitMcpConnected() {
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
      const status = await this.http().request('GET', '/api/mcp', {query: this.location()})
        .then((reply) => {
          const payload = /** @type {{data?: unknown}} */ (reply?.payload);
          const items = Array.isArray(payload?.data) ? payload.data : [];
          const mesa = items.find((item) => String(item?.name || '') === 'mesa');
          return typeof mesa?.status === 'string' ? mesa.status : stringStatus(mesa?.status);
        })
        .catch(() => '');
      if (status === 'connected' || status === 'ready') {
        /* O status conecta antes de o catálogo de ferramentas da sessão
           aparecer no primeiro prompt; um quadro de folga fecha essa janela. */
        await new Promise((resolve) => setTimeout(resolve, 250));
        return true;
      }
      if (status === 'failed' || status === 'error') break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    this.emitEvent('warning', {code: 'OPENCODE_MCP_FAILED', message: message('opencode.mcp.failed', {status: 'timeout'})});
    return false;
  }

  /* ---------- eventos ---------- */

  /** @param {string} type @param {Record<string, unknown>} [payload] */
  emitEvent(type, payload = {}) {
    this.emit('event', {type, conversationId: this.conversationId, runId: this.runId, adapter: 'opencode', at: new Date().toISOString(), ...payload});
  }

  /** @param {string} type @param {Record<string, unknown>} payload */
  receive(type, payload) { return this.fromReader(type, payload); }

  /** @param {string} type @param {Record<string, unknown>} payload */
  fromReader(type, payload) {
    if (type.startsWith('compaction_')) {
      this.compactions.receive(type, payload);
      if (type !== 'compaction_delta') this.emitEvent(type, payload);
      return;
    }
    if (type === 'execution') return this.turnGuard.settleExecution((end) => this.settleTurn(end), payload.status);
    if (type === 'idle') return this.settleTurn({});
    if (type === 'permission_request') return void this.refusePermission(payload);
    if (type === 'error' && payload.detail) this.log('opencode', `erro do provedor: ${redactErrorDetail(payload.detail)}`);
    this.emitEvent(type, payload);
    if (type === 'error') this.settleTurn({isError: true});
  }

  /* Pedido de permissão inesperado: o tutor não tem ferramenta nativa que
     devesse pedir. A recusa é imediata e o aviso vai ao log/UI; nunca abre
     diálogo nem aprova por engano. */
  async refusePermission(request) {
    const id = String(request?.id || '');
    if (!id) return;
    this.emitEvent('warning', {code: 'OPENCODE_PERMISSION_REFUSED', message: message('opencode.permission.refused')});
    try {
      const route = this.route(`/permission/${encodeURIComponent(id)}/reply`);
      let response = await this.http().request('POST', route, {body: {decision: 'reject'}});
      if (response.status === 400) response = await this.http().request('POST', route, {body: {reply: 'reject'}});
    } catch (error) {
      this.log('opencode', `pedido de permissão recusado sem resposta do servidor: ${error?.message || error}`);
    }
  }

  /** @param {string} status @param {string} id */
  async delivery(status, id) {
    this.emitEvent('delivery', {status, id});
    try { await this.options.persistDelivery?.({id, status}); } catch (error) { this.log('opencode', `fase da entrega não gravada: ${error?.message || error}`); }
  }

  /** @param {{isError?: boolean, cancelled?: boolean, uncertain?: boolean}} end @param {{force?: boolean}} [options] */
  endTurn({isError = false, cancelled = false, uncertain = false}, {force = false} = {}) {
    if (!this.turn && !force) return;
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
    this.stream = null; this.turnGuard.forgetEchoes();
    this.compactions.abandon(this.compactions.current);
    /* Queda depois do aceite: a entrega fica incerta e NUNCA é reenviada. */
    const id = this.turn?.id;
    if (!id) return;
    void this.delivery('uncertain', id);
    this.endTurn({uncertain: true});
  }

  closeStream() {
    const stream = this.stream;
    this.stream = null; this.turnGuard.forgetEchoes();
    try { stream?.abort(); } catch { /* já fechado */ }
  }

  /* ---------- entrega ---------- */

  /** @param {unknown} images */
  files(images) {
    return materializeImages(images, {
      tempDir: () => this.tempDir || (this.tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-opencode-'))),
      warn: (code, text) => this.emitEvent('warning', {code, message: text}),
    });
  }

  /* O Parar de todo envio (prompt ou comando) mora em `opencode-cancel.cjs`. */
  _trackDelivery(start) { return trackDelivery(this, start); }
  /**
   * Envia uma mensagem do aluno; `delivery: 'steer'` interrompe o turno em voo.
   * @param {{id?: string, text?: string, images?: unknown[], delivery?: 'steer'}} input
   */
  async send(input) {
    const id = String(input.id || '');
    return this._trackDelivery((token) => this.deliverPrompt(input, id, token));
  }
  async deliverPrompt(input, id, token) {
    await this.connect();
    /* Steer só é steer com turno em voo; ocioso, é um envio normal (o serviço
       já decide assim, e o adaptador repete a regra para quem o chama direto). */
    const steer = input.delivery === 'steer' && this.busy && Boolean(this.turn);
    let text = String(input.text || '');
    const marked = this.instructionMode === 'prefix' && !this.prefixArmed && Boolean(this.options.systemPrompt);
    if (marked) { this.prefixArmed = true; text = markTutorPrompt(String(this.options.systemPrompt), text); }
    const files = this.files(input.images);
    const body = {id: wireMessageId(id), text, resume: true, ...(input.delivery === 'steer' ? {delivery: 'steer'} : {}), ...(files.length ? {files} : {})};
    /* Recusa comprovada desfaz a marca: a retentativa ainda leva as instruções. */
    return admitTurn(this, {id, route: this.route('/prompt'), body, action: 'opencode.action.prompt', steer, token,
      accepts: (response) => response.status === 200 && inboxUser(response.payload),
      onRefused: () => { if (marked) this.prefixArmed = false; }});
  }
  /** @param {{id?: string, name: string, text?: string, images?: unknown[]}} input */
  async command(input) {
    const id = String(input.id || '');
    return this._trackDelivery((token) => this.deliverCommand(input, id, token));
  }

  async deliverCommand(input, id, token) {
    await this.connect();
    const files = this.files(input.images);
    const body = {name: String(input.name || '').replace(/^\/+/, ''), text: String(input.text || ''), ...(files.length ? {files} : {})};
    return admitTurn(this, {id, route: this.route('/command'), body, action: 'opencode.action.command', token,
      accepts: (response) => response.status === 204 || (response.status === 200 && inboxUser(response.payload))});
  }
  /** @param {{id?: string}} [input] */
  async compact(input = {}) {
    await this.connect();
    return runCompaction({request: this.http().request, route: (suffix) => this.route(suffix), ensureEvents: () => this.ensureEvents(), compactions: this.compactions}, input);
  }

  async cancel() { return cancelAdapter(this); }

  async cancelledAcceptance(token, id) { return settleCancelledAcceptance(this, token, id); }

  /* ---------- leitura ---------- */

  async history() {
    await this.connect();
    const list = normalizeHistory(await allMessages(this.http().request, this.route('/message')));
    return visibleHistory(list, String(this.options.systemPrompt || ''));
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
    /* Já ligado, com catálogo: não passa de novo pelo acquire (que relê a chave).
       No meio do bind o catálogo pode existir antes do ses_: aí espera o bind. */
    if (this.client && this.lease && !this.binding && this.controls.catalog.length) return this.controls.snapshot();
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

  cacheHistory() {}

  stop() {
    /* A subida em voo não pode ficar pendurada: sem isto, cancelar a chamada
       deixava a coluna em "Chamando…" até o servidor responder. */
    this.turnGuard.invalidate();
    for (const token of this.pendingDeliveries) { token.cancelled = true; token.closed = true; }
    try { this.options.cancelAcquire?.(); } catch { /* já cancelado */ }
    const deletion = this.deleteTemporarySession();
    this.closeStream();
    this.compactions.abandon(this.compactions.current);
    this.turn = null;
    this.busy = false;
    if (this.tempDir) { try { fs.rmSync(this.tempDir, {recursive: true, force: true}); } catch { /* temporário já saiu */ } }
    this.tempDir = '';
    return deletion;
  }

  /* Só o rascunho de revisão (#93) pede a sessão descartável: a conversa de
     estudo continua no histórico da pessoa. O `DELETE` é do servidor da Mesa
     e não apaga arquivo local nenhum. */
  async deleteTemporarySession() {
    if (this.options.deleteSessionOnStop !== true || !this.sessionId || !this.client) return;
    const id = this.sessionId;
    try {
      /* O 2.2.4 só acha a sessão com a pasta na query: sem ela o DELETE dá 404
         e a sessão fica (medido no binário real). */
      const response = await this.client.request('DELETE', `/api/session/${encodeURIComponent(id)}`, {timeoutMs: 5000, query: this.location()});
      if (!response.ok) this.log('opencode', `sessão temporária ${id} não apagada: HTTP ${response.status}`);
    } catch (error) { this.log('opencode', `sessão temporária ${id} não apagada: ${error?.message || error}`); }
  }
}

module.exports = {OpenCodeAdapter, PROMPT_TIMEOUT_MS};
