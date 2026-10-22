'use strict';

/* Controles nativos do ClaudeAdapter (modelo e esforço): catálogo, modelo
   observado e caps dinâmicos (vieram do claude-adapter.cjs na #58, para ele
   caber no teto de 800 linhas), troca com rollback e portão de envio. Métodos instalados no protótipo pelo
   claude-adapter.cjs (#43 fase 2). */

const {message: uiMsg} = require('../i18n.mjs');
/* Módulo puro de normalização (sem I/O): catálogo/alias/compilação/portão. */
const controlsMod = require('./claude-controls.cjs');
const deliveryCore = require('../generated/agentdelivery.core.js').default;
const capsCore = require('../generated/agentcaps.core.js').default;
const {MAX_CONTROLS_TIMEOUT_MS, MODEL_INFO, ClaudeAdapterError} = require('./claude-adapter-contract.cjs');
const {errorText, asAdapterError, normalizeSelectionInput} = require('./claude-adapter-input.cjs');

class ClaudeAdapterControls {
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

  async initializeControls({timeoutMs} = {}) {
    if (this._deliveryUncertain) {
      throw new ClaudeAdapterError('CLAUDE_DELIVERY_UNCERTAIN', uiMsg('err.claude.deliveryUncertainControls'), null, true);
    }
    if (this._controlsFailed) {
      throw new ClaudeAdapterError(
        'CLAUDE_CONTROLS_BLOCKED',
        uiMsg('err.claude.controlsBlockedInit'),
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
      throw new ClaudeAdapterError('CLAUDE_CLOSED', uiMsg('err.claude.closedControls'), null, true);
    }
    if (this._controlsFailed) {
      throw new ClaudeAdapterError('CLAUDE_CONTROLS_BLOCKED', uiMsg('err.claude.controlsBlocked'), {...this._controlsFailedDetail}, true);
    }
    if (this._controlsChanging) {
      throw new ClaudeAdapterError('CLAUDE_CONTROLS_BUSY', uiMsg('err.claude.controlsBusy'), null, true);
    }
    const desired = normalizeSelectionInput(selection);
    const gate = this._controlsGate();
    if (gate.allowed !== true) {
      throw new ClaudeAdapterError('CLAUDE_CONTROLS_BUSY', uiMsg('err.claude.controlsBusyReason', {reason: gate.reason}), {reason: gate.reason}, true);
    }
    if (!this._controlsHealthy()) {
      if (this._controlsState === 'initializing' || this._controlsInitPromise) {
        throw new ClaudeAdapterError('CLAUDE_CONTROLS_BUSY', uiMsg('err.claude.controlsStarting'), {state: this._controlsState}, true);
      }
      const reason = this._controlsCatalog?.reason ?? controlsMod.REASONS.CATALOG_MISSING;
      throw new ClaudeAdapterError('CLAUDE_CONTROLS_REQUIRED', uiMsg('err.claude.controlsRequired', {reason}), {reason, state: this._controlsState}, true);
    }
    const persist = typeof persistSelection === 'function' ? persistSelection : this._persistSelection;
    const compiled = this._compileSelection(desired);
    if (compiled.ok !== true) {
      throw new ClaudeAdapterError('CLAUDE_CONTROLS_INVALID', uiMsg('err.claude.controlsInvalid', {reason: compiled.reason}), {reason: compiled.reason, detail: compiled.detail}, true);
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
      name: uiMsg('claude.model.default'),
      description: uiMsg('claude.model.defaultHint'),
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
      return new ClaudeAdapterError('CLAUDE_CONTROLS_BLOCKED', uiMsg('err.claude.controlsBlockedSend'), {...this._controlsFailedDetail}, true);
    }
    if (this._controlsChanging) {
      return new ClaudeAdapterError('CLAUDE_CONTROLS_BUSY', uiMsg('err.claude.controlsBusySend'), null, true);
    }
    const desired = this._selection;
    if (!desired.model && !desired.effort) return null;
    if (this._controlsState === 'idle') {
      return new ClaudeAdapterError('CLAUDE_CONTROLS_REQUIRED', uiMsg('err.claude.controlsRequiredSend'), null, true);
    }
    if (this._controlsState === 'initializing') {
      return new ClaudeAdapterError('CLAUDE_CONTROLS_BUSY', uiMsg('err.claude.controlsStartingSend'), null, true);
    }
    if (this._controlsState !== 'ready') {
      const reason = this._controlsError?.reason ?? this._controlsCatalog?.reason ?? controlsMod.REASONS.CATALOG_MISSING;
      const code = this._controlsError?.code === 'CLAUDE_CONTROLS_UNAVAILABLE' ? 'CLAUDE_CONTROLS_UNAVAILABLE' : 'CLAUDE_CONTROLS_INVALID';
      return new ClaudeAdapterError(code, uiMsg('err.claude.savedChoiceUnavailable', {reason}), {reason, state: this._controlsState}, true);
    }
    const compiled = this._compileSelection(desired);
    if (compiled.ok !== true) {
      return new ClaudeAdapterError('CLAUDE_CONTROLS_INVALID', uiMsg('err.claude.savedChoiceInvalid', {reason: compiled.reason}), {reason: compiled.reason, detail: compiled.detail}, true);
    }
    if (this._nativeSelection.model !== compiled.model || this._nativeSelection.effort !== compiled.effort) {
      return new ClaudeAdapterError('CLAUDE_CONTROLS_DESYNC', uiMsg('err.claude.controlsDesync'), {
        desired: {model: compiled.model, effort: compiled.effort},
        applied: {...this._nativeSelection},
      }, true);
    }
    return null;
  }

  _assertControlsQuery(query, generation) {
    if (this._closed || generation !== this._generation) {
      throw new ClaudeAdapterError('CLAUDE_CLOSED', uiMsg('err.claude.closedDuringControls'), null, true);
    }
    if (this._query !== query || this._queryDead) {
      throw new ClaudeAdapterError('CLAUDE_QUERY_STALE', uiMsg('err.claude.staleDuringControls'), null, true);
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
        timer = setTimeout(() => reject(new ClaudeAdapterError(code, uiMsg('err.claude.controlsTimeout', {ms: timeout}), {timeoutMs: timeout}, true)), timeout);
        timer.unref?.();
      }),
    ]).finally(() => {
      if (timer) clearTimeout(timer);
    });
  }

  _assertControlApi(query, kind) {
    const method = kind === 'model' ? 'setModel' : 'applyFlagSettings';
    if (!query || typeof query[method] !== 'function') {
      throw new ClaudeAdapterError('CLAUDE_CONTROLS_UNAVAILABLE', uiMsg('err.claude.controlsUnavailable', {method}), {method}, true);
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
        uiMsg('err.claude.rollbackFailed', {cause}),
        {...this._controlsFailedDetail},
        true,
      );
    }
    if (phase === 'persist') {
      throw new ClaudeAdapterError(
        'CLAUDE_CONTROLS_PERSIST_FAILED',
        uiMsg('err.claude.controlsPersistFailed', {cause}),
        {cause, ...causeDetail},
        true,
      );
    }
    throw new ClaudeAdapterError(
      'CLAUDE_CONTROLS_APPLY_FAILED',
      uiMsg('err.claude.controlsApplyFailed', {cause}),
      {cause, ...causeDetail},
      true,
    );
  }
}

module.exports = {ClaudeAdapterControls};
