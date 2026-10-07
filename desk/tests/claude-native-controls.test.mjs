/* Controles nativos do Claude Code no adaptador (modelo/esforço) + transição de
 * limite liberado — SÓ dados sintéticos.
 *
 * Nenhum binário, credencial, sessão, catálogo ou inferência real: o "SDK" é um
 * fake local que implementa a superfície usada pelo adaptador
 * (`supportedModels`/`initializationResult`/`setModel`/`applyFlagSettings`) e
 * registra as chamadas. O que se prova:
 *   - initializeControls sem prompt (nada entra no iterador), catálogo sanitizado
 *     na mesma Query, restauração por alias, idempotência e sem retry implícito;
 *   - setControls: catálogo validado, APIs nativas do pin, persistência só depois
 *     do nativo, rollback do estado anterior e bloqueio terminal se o rollback
 *     falhar (nenhum envio passa até um adaptador novo);
 *   - snapshot seguro (default nativo x modelo observado), níveis por modelo,
 *     capacidades dinâmicas pelo Bend `claudeControlCaps`;
 *   - rate_limit_event rejected → allowed emite UMA transição RESUMED por janela.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {join} from 'node:path';
import * as fx from './claude-fixtures.mjs';

const require = createRequire(import.meta.url);
const {ClaudeAdapter} = require('../src/agents/claude-adapter.cjs');
const controls = require('../src/agents/claude-controls.cjs');
const capsCore = require('../src/generated/agentcaps.core.js').default;
const deliveryCore = require('../src/generated/agentdelivery.core.js').default;

const CONV = 'conv-native-controls';

const CATALOG = [
  {value: 'sonnet', resolvedModel: 'claude-sonnet-5', displayName: 'Sonnet', description: 'modelo ágil', supportsEffort: true, supportedEffortLevels: ['low', 'medium', 'high', 'max']},
  {value: 'opus', resolvedModel: 'claude-opus-4-8', displayName: 'Opus', description: 'modelo forte', supportsEffort: true, supportedEffortLevels: ['low', 'high']},
  {value: 'lite', resolvedModel: 'claude-lite-1', displayName: 'Lite', description: 'sem esforço', supportsEffort: false},
];

const noEffortCatalog = [
  {value: 'lite', resolvedModel: 'claude-lite-1', displayName: 'Lite', description: 'sem esforço', supportsEffort: false},
];

/* SDK fake mínimo: cada query() registra opções, expõe o outbox e os métodos de
   controle do SDK pinado. `*Impl` permite error/hang/deferred por teste. */
function controlSdk({
  models = CATALOG,
  supportedModels = true,
  initializationResult = true,
  setModel = true,
  applyFlagSettings = true,
  supportedModelsImpl = null,
  setModelImpl = null,
  applyFlagSettingsImpl = null,
  catalogError = null,
} = {}) {
  const state = {queries: [], supportedModelsCalls: 0, initializationResultCalls: 0};
  const sdk = {
    state,
    query({prompt, options}) {
      const out = fx.pushQueue();
      const query = {
        prompt,
        options,
        out,
        setModelCalls: [],
        applyFlagSettingsCalls: [],
        closed: false,
        async supportedModels() {
          state.supportedModelsCalls += 1;
          if (catalogError) throw Object.assign(new Error(`catálogo caiu (${catalogError})`), {code: catalogError});
          return supportedModelsImpl ? supportedModelsImpl(query) : models;
        },
        async initializationResult() {
          state.initializationResultCalls += 1;
          return {models, account: {apiProvider: 'firstParty', email: 'nao-reter@example.invalid'}};
        },
        async setModel(model) {
          query.setModelCalls.push(model);
          if (setModelImpl) return setModelImpl(model, query);
        },
        async applyFlagSettings(settings) {
          query.applyFlagSettingsCalls.push(settings);
          if (applyFlagSettingsImpl) return applyFlagSettingsImpl(settings, query);
        },
        async interrupt() {},
        close() { query.closed = true; },
        emit(message) { out.push(message); },
        fail(error) { out.fail(error); },
        end() { out.end(); },
        [Symbol.asyncIterator]() { return out[Symbol.asyncIterator](); },
      };
      if (!supportedModels) delete query.supportedModels;
      if (!initializationResult) delete query.initializationResult;
      if (!setModel) delete query.setModel;
      if (!applyFlagSettings) delete query.applyFlagSettings;
      state.queries.push(query);
      return query;
    },
  };
  return sdk;
}

function makeAdapter(overrides = {}) {
  const sdk = overrides.sdk || controlSdk();
  const adapter = new ClaudeAdapter({
    conversationId: CONV,
    cwd: process.cwd(),
    sdkLoader: async () => sdk,
    controlsTimeoutMs: 500,
    timeoutMs: 2000,
    ...overrides,
  });
  return {adapter, sdk};
}

const lastQuery = (sdk) => sdk.state.queries.at(-1);

async function initialize(adapter) {
  return adapter.initializeControls();
}

/* Um turno completo e comprovado (aceite + result) para exercitar busy/portão. */
async function driveTurn(adapter, sdk, {id = fx.UUID.a, text = 'pergunta'} = {}) {
  const promise = adapter.send({id, text});
  await fx.waitFor(() => sdk.state.queries.length > 0, 2000, 'consulta criada');
  const query = lastQuery(sdk);
  const item = await fx.takeInput(query);
  query.emit(fx.replayMessage(item));
  await promise;
  query.emit(fx.resultMessage({userMessageUuid: id}));
  await fx.waitFor(() => adapter.snapshot().busy === false, 2000, 'turno encerra');
  return query;
}

function expectReason(error, code, reason) {
  assert.equal(error.code, code, `código ${code}`);
  assert.equal(error.notSent, true);
  if (reason) assert.equal(error.detail?.reason, reason, `motivo ${reason}`);
  return true;
}

/* ---------------- initializeControls ---------------- */

test('initialize lê o catálogo sem prompt, restaura alias e é idempotente', async () => {
  const {adapter, sdk} = makeAdapter({selection: {model: 'claude-sonnet-5', effort: 'high'}});
  await adapter.connect();
  const snap = await initialize(adapter);

  assert.equal(sdk.state.queries.length, 1, 'uma única Query');
  assert.equal(sdk.state.supportedModelsCalls, 1);
  assert.equal(sdk.state.initializationResultCalls, 0, 'preferiu supportedModels');
  const query = lastQuery(sdk);
  assert.equal(query.prompt.pendingCount, 0, 'nada entrou no iterador de entrada');
  assert.equal(query.options.model, undefined, 'a escolha não vai nas opções da query');
  assert.equal(query.options.effort, undefined);
  assert.deepEqual(query.setModelCalls, ['sonnet'], 'alias persistido casa com a linha native');
  assert.deepEqual(query.applyFlagSettingsCalls, [{effortLevel: 'high'}]);
  assert.equal(adapter.snapshot().busy, false, 'sem inferência');

  assert.equal(snap.ready, true);
  assert.equal(snap.modelSelection, true);
  assert.equal(snap.effort, true);
  assert.equal(snap.catalogReason, null);
  assert.deepEqual(snap.selection, {model: 'sonnet', effort: 'high'});
  assert.deepEqual(snap.levels, ['low', 'medium', 'high', 'max']);
  assert.deepEqual(snap.models.map((model) => model.id), ['', 'sonnet', 'opus', 'lite']);
  const fallback = snap.models.find((model) => model.id === '');
  assert.equal(fallback.provider, 'anthropic');
  assert.equal(fallback.default, true);
  assert.equal(fallback.name, 'Padrão do Claude Code');
  assert.equal(adapter.snapshot().thinkingLevel, 'high');

  const again = await initialize(adapter);
  assert.equal(sdk.state.supportedModelsCalls, 1, 'idempotente: não relê o catálogo');
  assert.deepEqual(query.setModelCalls, ['sonnet'], 'não reaplica o mesmo estado');
  assert.deepEqual(again, snap);
});

test('catálogo ausente desliga seletores; escolha salva recusa antes do envio', async () => {
  const {adapter, sdk} = makeAdapter({
    selection: {model: 'sonnet'},
    sdk: controlSdk({supportedModels: false, initializationResult: false}),
  });
  await adapter.connect();
  const snap = await initialize(adapter);
  assert.equal(snap.ready, false);
  assert.equal(snap.modelSelection, false);
  assert.equal(snap.effort, false);
  assert.deepEqual(snap.models, []);
  assert.equal(snap.catalogReason, controls.REASONS.CATALOG_MISSING);
  assert.equal(snap.selectionValid, false);
  assert.equal(snap.selectionReason, controls.REASONS.CATALOG_UNAVAILABLE);
  assert.deepEqual(adapter.snapshot().capabilities, (({$: _$, ...caps}) => caps)(capsCore.claudeControlCaps(false, false)));

  await assert.rejects(
    () => adapter.send({id: fx.UUID.a, text: 'não pode sair'}),
    (error) => expectReason(error, 'CLAUDE_CONTROLS_UNAVAILABLE', controls.REASONS.CATALOG_MISSING),
  );
  assert.equal(lastQuery(sdk).prompt.pendingCount, 0, 'nenhum item foi entregue');
});

test('catálogo ausente ainda permite o default nativo (escolha nula)', async () => {
  const {adapter, sdk} = makeAdapter({sdk: controlSdk({supportedModels: false, initializationResult: false})});
  await adapter.connect();
  const snap = await initialize(adapter);
  assert.equal(snap.modelSelection, false);
  assert.deepEqual(snap.selection, {model: null, effort: null});
  const query = await driveTurn(adapter, sdk, {text: 'default nativo'});
  assert.equal(query.setModelCalls.length, 0);
  assert.equal(query.applyFlagSettingsCalls.length, 0);
  assert.equal(query.prompt.pendingCount, 0);
});

test('API nativa ausente esconde os controles e recusa a troca', async () => {
  const {adapter, sdk} = makeAdapter({selection: {model: 'sonnet'}, sdk: controlSdk({setModel: false})});
  await adapter.connect();
  const snap = await initialize(adapter);
  assert.equal(snap.modelSelection, false, 'sem setModel não há seletor');
  assert.deepEqual(snap.models, []);
  assert.equal(snap.error.code, 'CLAUDE_CONTROLS_UNAVAILABLE');
  const {$, ...noApiCaps} = capsCore.claudeControlCaps(false, false);
  assert.deepEqual(adapter.snapshot().capabilities, noApiCaps, 'capacidade dinâmica também fecha sem API');

  await assert.rejects(
    () => adapter.send({id: fx.UUID.a, text: 'x'}),
    (error) => expectReason(error, 'CLAUDE_CONTROLS_UNAVAILABLE'),
  );
  assert.equal(lastQuery(sdk).prompt.pendingCount, 0);

  const noFlag = makeAdapter({selection: null, sdk: controlSdk({applyFlagSettings: false})});
  await noFlag.adapter.connect();
  const flagSnap = await initialize(noFlag.adapter);
  assert.equal(flagSnap.modelSelection, true, 'modelo continua disponível');
  assert.equal(flagSnap.effort, false, 'applyFlagSettings ausente desliga esforço');
  await assert.rejects(
    () => noFlag.adapter.setControls({model: 'sonnet', effort: 'high'}),
    (error) => expectReason(error, 'CLAUDE_CONTROLS_UNAVAILABLE'),
  );
  assert.equal(noFlag.sdk.state.queries.length, 1, 'não recriou query para a troca inválida');
});

test('initializeControls concorrente compartilha a promessa; falha só repete em chamada explícita', async () => {
  const gate = fx.deferred();
  let calls = 0;
  const sdk = controlSdk({
    supportedModelsImpl: async () => {
      calls += 1;
      if (calls === 1) await gate.promise;
      return CATALOG;
    },
  });
  const {adapter} = makeAdapter({sdk});
  await adapter.connect();
  const [a, b] = [initialize(adapter), initialize(adapter)];
  await fx.tick();
  assert.equal(calls, 1, 'uma leitura para chamadas concorrentes');
  gate.resolve();
  const [snapA, snapB] = await Promise.all([a, b]);
  assert.deepEqual(snapA, snapB);

  const failing = controlSdk({catalogError: 'ECONNRESET'});
  const failingAdapter = makeAdapter({sdk: failing}).adapter;
  await failingAdapter.connect();
  const first = await initialize(failingAdapter);
  assert.equal(first.ready, false);
  assert.equal(first.catalogReason, controls.REASONS.CATALOG_UNAVAILABLE);
  assert.equal(first.error.reason, controls.REASONS.CATALOG_UNAVAILABLE);
  assert.equal(first.error.detail, 'ECONNRESET');
  await initialize(failingAdapter);
  assert.equal(failing.state.supportedModelsCalls, 2, 'a segunda chamada explícita tenta de novo');
});

test('timeout limita a leitura do catálogo sem pendurar a UI', async () => {
  const {adapter, sdk} = makeAdapter({
    controlsTimeoutMs: 20,
    sdk: controlSdk({supportedModelsImpl: () => new Promise(() => {})}),
  });
  await adapter.connect();
  const snap = await initialize(adapter);
  assert.equal(snap.ready, false);
  assert.equal(snap.error.code, 'CLAUDE_CONTROLS_TIMEOUT');
  assert.equal(sdk.state.supportedModelsCalls, 1, 'sem retry automático');
});

/* ---------------- setControls ---------------- */

test('setControls aplica nativo, persiste depois e limpa para o default', async () => {
  const order = [];
  const persisted = [];
  const sdk = controlSdk({
    setModelImpl: async (model) => { order.push(model === undefined ? 'native:model:default' : `native:model:${model}`); },
    applyFlagSettingsImpl: async (settings) => { order.push(`native:effort:${settings.effortLevel}`); },
  });
  const {adapter} = makeAdapter({sdk});
  await adapter.connect();
  await initialize(adapter);

  const snap = await adapter.setControls({model: 'sonnet', effort: 'high'}, {
    persistSelection: (patch) => { order.push('persist'); persisted.push(patch); },
  });
  assert.deepEqual(order, ['native:model:sonnet', 'native:effort:high', 'persist']);
  assert.deepEqual(persisted, [{model: 'sonnet', effort: 'high'}]);
  assert.equal(sdk.state.queries.length, 1, 'a Query persistente é a mesma');
  assert.deepEqual(snap.selection, {model: 'sonnet', effort: 'high'});
  assert.deepEqual(snap.levels, ['low', 'medium', 'high', 'max']);
  assert.equal(snap.effort, true);
  assert.equal(adapter.snapshot().thinkingLevel, 'high');

  const query = lastQuery(sdk);
  const cleared = await adapter.setControls({model: null, effort: null}, {
    persistSelection: (patch) => persisted.push(patch),
  });
  assert.equal(query.setModelCalls.at(-1), undefined, 'setModel(undefined) volta ao default');
  assert.deepEqual(query.applyFlagSettingsCalls.at(-1), {effortLevel: null}, 'flag de esforço limpa');
  assert.deepEqual(cleared.selection, {model: null, effort: null});
  assert.deepEqual(cleared.levels, []);
  assert.equal(cleared.effort, false);
  assert.equal(adapter.snapshot().thinkingLevel, null);
  assert.deepEqual(persisted, [{model: 'sonnet', effort: 'high'}, {model: null, effort: null}]);

  const before = query.setModelCalls.length;
  await adapter.setControls({model: null, effort: null}, {persistSelection: (patch) => persisted.push(patch)});
  assert.equal(query.setModelCalls.length, before, 'estado já aplicado não chama o nativo de novo');
  assert.deepEqual(persisted.at(-1), {model: null, effort: null});
});

test('setControls recusa esforço sem modelo, modelo desconhecido e roteador', async () => {
  const {adapter, sdk} = makeAdapter();
  await adapter.connect();
  await initialize(adapter);
  const query = lastQuery(sdk);

  await assert.rejects(
    () => adapter.setControls({model: null, effort: 'high'}),
    (error) => expectReason(error, 'CLAUDE_CONTROLS_INVALID', controls.REASONS.EFFORT_REQUIRES_MODEL),
  );
  await assert.rejects(
    () => adapter.setControls({model: 'inexistente', effort: null}),
    (error) => expectReason(error, 'CLAUDE_CONTROLS_INVALID', controls.REASONS.MODEL_UNKNOWN),
  );
  await assert.rejects(
    () => adapter.setControls({model: 'bedrock/sonnet', effort: null}),
    (error) => expectReason(error, 'CLAUDE_CONTROLS_INVALID', controls.REASONS.MODEL_ROUTER),
  );
  await assert.rejects(
    () => adapter.setControls({model: 'lite', effort: 'high'}),
    (error) => expectReason(error, 'CLAUDE_CONTROLS_INVALID', controls.REASONS.EFFORT_UNSUPPORTED),
  );
  assert.equal(query.setModelCalls.length, 0, 'recusa de catálogo não toca o nativo');
  assert.equal(query.applyFlagSettingsCalls.length, 0);
});

test('setControls exige initializeControls antes', async () => {
  const {adapter, sdk} = makeAdapter();
  await adapter.connect();
  await assert.rejects(
    () => adapter.setControls({model: 'sonnet'}),
    (error) => expectReason(error, 'CLAUDE_CONTROLS_REQUIRED'),
  );
  assert.equal(sdk.state.queries.length, 0, 'nem criou query');
});

test('níveis de esforço seguem o modelo escolhido', async () => {
  const {adapter, sdk} = makeAdapter({selection: {model: 'opus', effort: 'high'}});
  await adapter.connect();
  const start = await initialize(adapter);
  assert.deepEqual(start.levels, ['low', 'high']);
  assert.equal(start.effort, true);

  const lite = await adapter.setControls({model: 'lite', effort: null});
  assert.deepEqual(lite.levels, [], 'modelo sem metadado não oferece níveis');
  assert.equal(lite.effort, false);
  assert.equal(lite.modelSelection, true);
  await assert.rejects(
    () => adapter.setControls({model: 'lite', effort: 'low'}),
    (error) => expectReason(error, 'CLAUDE_CONTROLS_INVALID', controls.REASONS.EFFORT_UNSUPPORTED),
  );
  assert.equal(lastQuery(sdk).setModelCalls.at(-1), 'lite');
});

test('troca não passa com turno, permissão pendente ou entrega incerta (Bend)', async () => {
  {
    const {adapter, sdk} = makeAdapter();
    await adapter.connect();
    await initialize(adapter);
    const promise = adapter.send({id: fx.UUID.a, text: 'busy'});
    await fx.waitFor(() => sdk.state.queries.length === 1, 2000, 'query');
    const query = lastQuery(sdk);
    await assert.rejects(
      () => adapter.setControls({model: 'sonnet'}),
      (error) => expectReason(error, 'CLAUDE_CONTROLS_BUSY', controls.SWITCH_REASONS.BUSY),
    );
    const item = await fx.takeInput(query);
    query.emit(fx.replayMessage(item));
    await promise;
    query.emit(fx.resultMessage({userMessageUuid: fx.UUID.a}));
    await fx.waitFor(() => adapter.snapshot().busy === false, 2000, 'encerra');
  }
  {
    const {adapter, sdk} = makeAdapter();
    await adapter.connect();
    await initialize(adapter);
    const q = sdk.state.queries[0];
    const pending = q.options.canUseTool('Read', {file_path: join(process.cwd(), 'controle.pdf')}, {requestId: 'perm-1', signal: new AbortController().signal});
    await assert.rejects(
      () => adapter.setControls({model: 'sonnet'}),
      (error) => expectReason(error, 'CLAUDE_CONTROLS_BUSY', controls.SWITCH_REASONS.PERMISSION),
    );
    adapter.respond({id: 'perm-1', confirmed: false});
    await pending;
  }
  {
    const recorder = fx.persistRecorder({failStatuses: ['settled']});
    const {adapter, sdk} = makeAdapter({persistDelivery: recorder.persist});
    await adapter.connect();
    await initialize(adapter);
    const promise = adapter.send({id: fx.UUID.b, text: 'incerto'});
    await fx.waitFor(() => sdk.state.queries.length === 1, 2000, 'query');
    const q = lastQuery(sdk);
    const item = await fx.takeInput(q);
    q.emit(fx.replayMessage(item));
    await promise;
    q.emit(fx.resultMessage({userMessageUuid: fx.UUID.b}));
    await fx.waitFor(() => adapter.snapshot().busy === false, 2000, 'incerto encerra');
    await assert.rejects(
      () => adapter.setControls({model: 'sonnet'}),
      (error) => expectReason(error, 'CLAUDE_CONTROLS_BUSY', controls.SWITCH_REASONS.UNCERTAIN),
    );
  }
});

test('falha nativa restaura o estado anterior e o envio seguinte passa', async () => {
  const sdk = controlSdk({
    setModelImpl: async (model) => {
      if (model === 'opus') throw Object.assign(new Error('modelo recusado pelo CLI'), {code: 'EPROTO'});
    },
  });
  const {adapter} = makeAdapter({selection: {model: 'sonnet', effort: 'high'}, sdk});
  await adapter.connect();
  await initialize(adapter);
  const persisted = [];
  await assert.rejects(
    () => adapter.setControls({model: 'opus', effort: 'low'}, {persistSelection: (patch) => persisted.push(patch)}),
    (error) => expectReason(error, 'CLAUDE_CONTROLS_APPLY_FAILED'),
  );

  const query = lastQuery(sdk);
  assert.deepEqual(query.setModelCalls, ['sonnet', 'opus', 'sonnet'], 'rollback do modelo');
  assert.deepEqual(query.applyFlagSettingsCalls, [{effortLevel: 'high'}], 'esforço nem foi tocado');
  assert.deepEqual(persisted, [], 'nada foi persistido');
  assert.deepEqual(adapter.controlsSnapshot().selection, {model: 'sonnet', effort: 'high'});
  assert.equal(adapter.controlsSnapshot().failed, false);

  await driveTurn(adapter, sdk, {id: fx.UUID.c, text: 'depois da falha'});
  assert.equal(sdk.state.queries.length, 1, 'a troca falha não recriou a consulta viva');
  assert.equal(query.setModelCalls.length, 3, 'o envio não reaplica a escolha viva');
  assert.equal(adapter.snapshot().thinkingLevel, 'high');
});

test('falha de persistência desfaz o nativo e mantém a escolha antiga', async () => {
  const {adapter, sdk} = makeAdapter({selection: {model: 'sonnet'}});
  await adapter.connect();
  await initialize(adapter);
  const query = lastQuery(sdk);
  const calls = [];
  await assert.rejects(
    () => adapter.setControls({model: 'opus', effort: 'high'}, {
      persistSelection: (patch) => { calls.push(patch); throw new Error('descritor somente leitura'); },
    }),
    (error) => expectReason(error, 'CLAUDE_CONTROLS_PERSIST_FAILED'),
  );
  assert.deepEqual(calls, [{model: 'opus', effort: 'high'}], 'tentou persistir o patch compilado');
  assert.deepEqual(query.setModelCalls, ['sonnet', 'opus', 'sonnet'], 'nativo voltou');
  assert.deepEqual(query.applyFlagSettingsCalls, [{effortLevel: 'high'}, {effortLevel: null}], 'esforço voltou a null');
  assert.deepEqual(adapter.controlsSnapshot().selection, {model: 'sonnet', effort: null});
  assert.equal(adapter.controlsSnapshot().failed, false);
});

test('rollback que falha bloqueia envios até um adaptador novo', async () => {
  let failing = false;
  const sdk = controlSdk({
    setModelImpl: async () => {
      if (failing) throw Object.assign(new Error('transporte de controle caiu'), {code: 'ECONTROL'});
    },
  });
  const {adapter} = makeAdapter({selection: {model: 'sonnet'}, sdk});
  await adapter.connect();
  await initialize(adapter);
  const query = lastQuery(sdk);
  failing = true;
  await assert.rejects(
    () => adapter.setControls({model: 'opus'}, {persistSelection: () => { throw new Error('não devia persistir'); }}),
    (error) => {
      assert.equal(error.code, 'CLAUDE_CONTROLS_ROLLBACK_FAILED');
      assert.equal(error.notSent, true);
      assert.equal(error.detail.phase, 'apply');
      assert.equal(error.detail.rollback, 'model');
      return true;
    },
  );
  const snap = adapter.controlsSnapshot();
  assert.equal(snap.failed, true);
  assert.deepEqual(query.setModelCalls, ['sonnet', 'opus', 'sonnet'], 'tentou aplicar e restaurar o estado anterior');

  await assert.rejects(
    () => adapter.send({id: fx.UUID.a, text: 'bloqueado'}),
    (error) => expectReason(error, 'CLAUDE_CONTROLS_BLOCKED'),
  );
  await assert.rejects(
    () => adapter.setControls({model: null}),
    (error) => expectReason(error, 'CLAUDE_CONTROLS_BLOCKED'),
  );
  await assert.rejects(
    () => initialize(adapter),
    (error) => expectReason(error, 'CLAUDE_CONTROLS_BLOCKED'),
  );
  assert.equal(query.prompt.pendingCount, 0);

  const fresh = makeAdapter({sdk: controlSdk()});
  await fresh.adapter.connect();
  await initialize(fresh.adapter);
  await driveTurn(fresh.adapter, fresh.sdk, {id: fx.UUID.d, text: 'adaptador novo'});
});

test('timeout na chamada nativa restaura o estado anterior', async () => {
  const sdk = controlSdk({
    setModelImpl: async (model) => {
      if (model === 'opus') return new Promise(() => {});
    },
  });
  const {adapter} = makeAdapter({controlsTimeoutMs: 25, sdk});
  await adapter.connect();
  await initialize(adapter);
  await assert.rejects(
    () => adapter.setControls({model: 'opus'}),
    (error) => {
      assert.equal(error.code, 'CLAUDE_CONTROLS_APPLY_FAILED');
      assert.equal(error.detail.timedOut, true);
      return true;
    },
  );
  const query = lastQuery(sdk);
  assert.equal(query.setModelCalls[0], 'opus');
  assert.equal(query.setModelCalls[1], undefined, 'restaurou o default nativo');
  assert.deepEqual(adapter.controlsSnapshot().selection, {model: null, effort: null});
  assert.equal(adapter.controlsSnapshot().failed, false);
});

test('prompt concorrente não passa durante a troca; close cancela a persistência', async () => {
  const gate = fx.deferred();
  const sdk = controlSdk({
    setModelImpl: async (model) => {
      if (model === 'opus') await gate.promise;
    },
  });
  const {adapter} = makeAdapter({sdk});
  await adapter.connect();
  await initialize(adapter);
  const persisted = [];
  const change = adapter.setControls({model: 'opus'}, {persistSelection: (patch) => persisted.push(patch)});
  await fx.waitFor(() => lastQuery(sdk).setModelCalls.length === 1, 2000, 'setModel em voo');
  await assert.rejects(
    () => adapter.send({id: fx.UUID.a, text: 'não pode passar'}),
    (error) => expectReason(error, 'CLAUDE_CONTROLS_BUSY'),
  );
  const concurrent = adapter.setControls({model: 'lite'});
  await assert.rejects(
    () => concurrent,
    (error) => expectReason(error, 'CLAUDE_CONTROLS_BUSY'),
  );
  gate.resolve();
  const snap = await change;
  assert.deepEqual(persisted, [{model: 'opus', effort: null}]);
  assert.deepEqual(snap.selection, {model: 'opus', effort: null});
  await driveTurn(adapter, sdk, {id: fx.UUID.e, text: 'depois'});
});

test('close durante a troca não persiste e não bloqueia um adaptador novo', async () => {
  const gate = fx.deferred();
  const sdk = controlSdk({
    setModelImpl: async (model) => {
      if (model === 'opus') await gate.promise;
    },
  });
  const {adapter} = makeAdapter({sdk});
  await adapter.connect();
  await initialize(adapter);
  const persisted = [];
  const change = adapter.setControls({model: 'opus'}, {persistSelection: (patch) => persisted.push(patch)});
  await fx.waitFor(() => lastQuery(sdk).setModelCalls.length === 1, 2000, 'setModel em voo');
  adapter.stop();
  gate.resolve();
  await assert.rejects(
    () => change,
    (error) => expectReason(error, 'CLAUDE_CLOSED'),
  );
  assert.deepEqual(persisted, [], 'nada persistido depois do close');
  await assert.rejects(
    () => adapter.setControls({model: 'lite'}),
    (error) => expectReason(error, 'CLAUDE_CLOSED'),
  );

  const fresh = makeAdapter({sdk: controlSdk()});
  await fresh.adapter.connect();
  await initialize(fresh.adapter);
  await driveTurn(fresh.adapter, fresh.sdk, {id: fx.UUID.f, text: 'novo'});
});

/* ---------------- snapshot/capacidades ---------------- */

test('snapshot separa default desejado do modelo observado e usa o Bend', async () => {
  const {adapter, sdk} = makeAdapter({selection: {model: 'sonnet', effort: 'high'}});
  await adapter.connect();
  const {$, ...base} = capsCore.claudeControlCaps(false, false);
  assert.deepEqual(adapter.snapshot().capabilities, base, 'antes de inicializar: capacidades base');

  await initialize(adapter);
  const query = lastQuery(sdk);
  query.emit(fx.initMessage({model: 'claude-sonnet-5'}));
  await fx.tick();

  const snap = adapter.snapshot();
  assert.equal(snap.model.id, 'claude-sonnet-5', 'modelo OBSERVADO pelo init nativo');
  assert.equal(snap.model.name, 'Sonnet', 'nome veio do catálogo sanitizado');
  assert.equal(snap.thinkingLevel, 'high');
  const expected = (({$: _$, ...caps}) => caps)(capsCore.claudeControlCaps(true, true));
  assert.deepEqual(snap.capabilities, expected, 'capacidades dinâmicas pelo artefato Bend');

  const view = adapter.controlsSnapshot();
  assert.deepEqual(view.selection, {model: 'sonnet', effort: 'high'}, 'escolha DESEJADA');
  assert.equal(view.observedModel, 'claude-sonnet-5');
  assert.doesNotMatch(JSON.stringify(view), /email|organization|plano|nao-reter/i, 'sem dados privados da conta');
});

test('catálogo sem esforço nenhum mantém só o seletor de modelo', async () => {
  const {adapter} = makeAdapter({sdk: controlSdk({models: noEffortCatalog})});
  await adapter.connect();
  const snap = await initialize(adapter);
  assert.equal(snap.modelSelection, true);
  assert.equal(snap.effort, false);
  assert.deepEqual(snap.levels, []);
  const {$, ...expected} = capsCore.claudeControlCaps(true, false);
  assert.deepEqual(adapter.snapshot().capabilities, expected);
});

test('portão concorda com canChangeControls do Bend em todas as combinações', () => {
  const {adapter} = makeAdapter();
  for (const busy of [false, true]) {
    for (const hasTurn of [false, true]) {
      for (const permissionPending of [false, true]) {
        for (const uncertain of [false, true]) {
          adapter._busy = busy;
          adapter._turn = hasTurn ? {finalized: false} : null;
          adapter._permissions.clear();
          if (permissionPending) adapter._permissions.set('x', {});
          adapter._deliveryUncertain = uncertain;
          const allowed = deliveryCore.canChangeControls(busy, hasTurn, permissionPending, uncertain);
          const gate = adapter._controlsGate();
          assert.equal(gate.allowed, allowed, `Bend ${JSON.stringify({busy, hasTurn, permissionPending, uncertain})}`);
          if (!allowed) {
            const decision = controls.canSwitchSelection({busy, hasTurn, pendingPermission: permissionPending, uncertain});
            assert.equal(gate.reason, decision.reason);
          }
        }
      }
    }
  }
  adapter._busy = false;
  adapter._turn = null;
  adapter._permissions.clear();
  adapter._deliveryUncertain = false;
});

/* ---------------- retomada × catálogo ---------------- */

test('Query de catálogo sem prompt não vira resume; prompt entregue vira', async () => {
  const {adapter, sdk} = makeAdapter({sessionId: fx.UUID.session, resume: false});
  const events = fx.collectEvents(adapter);
  await adapter.connect();
  await initialize(adapter);
  const q1 = sdk.state.queries[0];
  assert.equal(q1.options.sessionId, fx.UUID.session);
  assert.equal(q1.options.resume, undefined, 'catálogo não autoriza resume');
  assert.equal(q1.prompt.pendingCount, 0);

  q1.end();
  await fx.waitFor(() => events.of('warning').some((event) => event.code === 'CLAUDE_QUERY_ENDED'), 2000, 'fim da query de catálogo');

  const promise = adapter.send({id: fx.UUID.a, text: 'primeira de verdade'});
  await fx.waitFor(() => sdk.state.queries.length === 2, 2000, 'segunda query');
  const q2 = sdk.state.queries[1];
  assert.equal(q2.options.sessionId, fx.UUID.session, 'ainda cria sessão, nunca resume sem prompt');
  assert.equal(q2.options.resume, undefined);
  const item = await fx.takeInput(q2);
  q2.emit(fx.replayMessage(item));
  await promise;
  q2.emit(fx.resultMessage({userMessageUuid: fx.UUID.a}));
  await fx.waitFor(() => adapter.snapshot().busy === false, 2000, 'encerra');

  q2.end();
  await fx.waitFor(() => events.of('warning').filter((event) => event.code === 'CLAUDE_QUERY_ENDED').length === 2, 2000, 'segundo fim');

  adapter.send({id: fx.UUID.b, text: 'segunda de verdade'}).catch(() => {});
  await fx.waitFor(() => sdk.state.queries.length === 3, 2000, 'terceira query');
  const q3 = sdk.state.queries[2];
  assert.equal(q3.options.resume, fx.UUID.session, 'prompt já entregue autoriza resume');
  assert.equal(q3.options.sessionId, undefined);
});

/* ---------------- limite de uso: transição RESUMED ---------------- */

test('rejected → allowed emite UMA transição RESUMED por janela, sem mexer no turno', async () => {
  const {adapter, sdk} = makeAdapter();
  await adapter.connect();
  const events = fx.collectEvents(adapter);
  const promise = adapter.send({id: fx.UUID.a, text: 'limite'});
  await fx.waitFor(() => sdk.state.queries.length === 1, 2000, 'query');
  const query = lastQuery(sdk);
  const item = await fx.takeInput(query);
  query.emit(fx.replayMessage(item));
  await promise;

  const resetsAt = Math.floor(Date.now() / 1000) + 3600;
  query.emit(fx.rateLimitMessage({status: 'allowed', rateLimitType: 'five_hour'}));
  await fx.tick();
  assert.equal(events.of('warning').filter((event) => event.code === 'CLAUDE_RATE_LIMIT_RESUMED').length, 0, 'allowed sem pausa anterior não gera transição');

  query.emit(fx.rateLimitMessage({status: 'rejected', rateLimitType: 'five_hour', resetsAt}));
  query.emit(fx.rateLimitMessage({status: 'rejected', rateLimitType: 'seven_day', resetsAt}));
  await fx.tick();
  assert.equal(events.of('warning').filter((event) => event.code === 'CLAUDE_RATE_LIMITED').length, 2, 'duas janelas pausadas');

  query.emit(fx.rateLimitMessage({status: 'allowed', rateLimitType: 'five_hour'}));
  await fx.tick();
  let resumed = events.of('warning').filter((event) => event.code === 'CLAUDE_RATE_LIMIT_RESUMED');
  assert.equal(resumed.length, 1);
  assert.equal(resumed[0].runId, fx.UUID.a, 'a transição carrega a identidade do turno');
  assert.equal(resumed[0].rateLimit.blocked, false);
  assert.equal(resumed[0].rateLimit.status, 'allowed');
  assert.equal(resumed[0].rateLimit.type, 'five_hour');
  assert.equal(resumed[0].rateLimit.resumed, true);
  assert.match(resumed[0].message, /liberado/);

  query.emit(fx.rateLimitMessage({status: 'allowed', rateLimitType: 'five_hour'}));
  await fx.tick();
  assert.equal(events.of('warning').filter((event) => event.code === 'CLAUDE_RATE_LIMIT_RESUMED').length, 1, 'não repete a cada allowed');

  query.emit(fx.rateLimitMessage({status: 'allowed', rateLimitType: 'seven_day'}));
  await fx.tick();
  resumed = events.of('warning').filter((event) => event.code === 'CLAUDE_RATE_LIMIT_RESUMED');
  assert.deepEqual(resumed.map((event) => event.rateLimit.type), ['five_hour', 'seven_day'], 'cada janela tem sua transição');

  assert.equal(adapter.snapshot().busy, true, 'nada de busy alterado');
  assert.equal(events.of('turn_end').length, 0, 'nada de turn_end prematuro');

  query.emit(fx.resultMessage({userMessageUuid: fx.UUID.a}));
  await fx.waitFor(() => adapter.snapshot().busy === false, 2000, 'result encerra');
  assert.deepEqual(events.of('delivery').map((event) => event.status), ['transmitting', 'accepted', 'settled']);
});

test('allowed_warning depois de rejected não limpa a pausa; allowed limpa', async () => {
  const {adapter, sdk} = makeAdapter();
  await adapter.connect();
  const events = fx.collectEvents(adapter);
  const promise = adapter.send({id: fx.UUID.a, text: 'warning'});
  await fx.waitFor(() => sdk.state.queries.length === 1, 2000, 'query');
  const query = lastQuery(sdk);
  const item = await fx.takeInput(query);
  query.emit(fx.replayMessage(item));
  await promise;

  const resetsAt = Math.floor(Date.now() / 1000) + 1800;
  query.emit(fx.rateLimitMessage({status: 'rejected', rateLimitType: 'seven_day_opus', resetsAt}));
  await fx.tick();
  assert.equal(events.of('warning').filter((event) => event.code === 'CLAUDE_RATE_LIMITED').length, 1);

  query.emit(fx.rateLimitMessage({status: 'allowed_warning', rateLimitType: 'seven_day_opus', resetsAt}));
  await fx.tick();
  assert.equal(events.of('warning').filter((event) => event.code === 'CLAUDE_RATE_LIMIT_RESUMED').length, 0, 'aviso de proximidade não é liberação');
  assert.equal(events.of('warning').filter((event) => event.code === 'CLAUDE_RATE_LIMIT_WARNING').length, 1);

  query.emit(fx.rateLimitMessage({status: 'allowed', rateLimitType: 'seven_day_opus'}));
  await fx.tick();
  assert.equal(events.of('warning').filter((event) => event.code === 'CLAUDE_RATE_LIMIT_RESUMED').length, 1);

  query.emit(fx.resultMessage({userMessageUuid: fx.UUID.a}));
  await fx.waitFor(() => adapter.snapshot().busy === false, 2000, 'encerra');
});

test('subtype legado system/rate_limit_event também emite a transição', async () => {
  const {adapter, sdk} = makeAdapter();
  await adapter.connect();
  const events = fx.collectEvents(adapter);
  const promise = adapter.send({id: fx.UUID.a, text: 'legado'});
  await fx.waitFor(() => sdk.state.queries.length === 1, 2000, 'query');
  const query = lastQuery(sdk);
  const item = await fx.takeInput(query);
  query.emit(fx.replayMessage(item));
  await promise;

  const frame = fx.rateLimitMessage({status: 'rejected', rateLimitType: 'seven_day', resetsAt: Math.floor(Date.now() / 1000) + 600});
  query.emit({...frame, type: 'system', subtype: 'rate_limit_event'});
  query.emit({...frame, type: 'system', subtype: 'rate_limit_event', rate_limit_info: {...frame.rate_limit_info, status: 'allowed'}});
  await fx.tick();
  assert.equal(events.of('warning').filter((event) => event.code === 'CLAUDE_RATE_LIMITED').length, 1);
  assert.equal(events.of('warning').filter((event) => event.code === 'CLAUDE_RATE_LIMIT_RESUMED').length, 1);

  query.emit(fx.resultMessage({userMessageUuid: fx.UUID.a}));
  await fx.waitFor(() => adapter.snapshot().busy === false, 2000, 'encerra');
});
