/* Seleção de modelo e esforço do Claude (desk/src/agents/claude-controls.cjs).
 *
 * Tudo sintético: catálogos no formato REAL do SDK pinado
 * (@anthropic-ai/claude-agent-sdk 0.3.246, `ModelInfo`) e descritores em
 * memória. Nenhum binário, credencial, sessão, rede ou inference é tocado;
 * nenhum arquivo do runtime é lido/escrito. O último teste confere no
 * `sdk.d.ts` instalado que os campos/uniões usados batem com o pin.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {existsSync, readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const require = createRequire(import.meta.url);
const controls = require('../src/agents/claude-controls.cjs');

const SONNET = Object.freeze({
  value: 'sonnet',
  resolvedModel: 'claude-sonnet-5',
  displayName: 'Sonnet 5',
  description: 'Equilíbrio entre velocidade e profundidade',
  supportsEffort: true,
  supportedEffortLevels: ['low', 'medium', 'high'],
  supportsAdaptiveThinking: true,
  supportsFastMode: true,
  supportsAutoMode: false,
});

const OPUS = Object.freeze({
  value: 'claude-opus-4-8',
  resolvedModel: 'claude-opus-4-8',
  displayName: 'Opus 4.8',
  description: 'Máxima capacidade',
  supportsEffort: true,
  supportedEffortLevels: ['low', 'medium', 'high', 'xhigh', 'max'],
  supportsAdaptiveThinking: true,
  supportsFastMode: false,
});

/* Sem metadado de esforço: o controle tem de ficar desligado para ele. */
const HAIKU = Object.freeze({
  value: 'haiku',
  resolvedModel: 'claude-haiku-4-5',
  displayName: 'Haiku 4.5',
  description: 'Rápido',
});

/* `supportsEffort` ligado mas sem níveis: metadado incompleto ⇒ desligado. */
const INCOMPLETE = Object.freeze({
  value: 'claude-incomplete',
  resolvedModel: 'claude-incomplete',
  displayName: 'Incompleto',
  description: '',
  supportsEffort: true,
});

const NATIVE_CATALOG = Object.freeze([SONNET, OPUS, HAIKU, INCOMPLETE]);

/* Forma de resposta de `initializationResult()` do SDK 0.3.246. */
function initializeResponse(models = NATIVE_CATALOG) {
  return {
    commands: [],
    agents: [],
    output_style: 'default',
    available_output_styles: ['default'],
    models,
    account: {apiProvider: 'firstParty'},
  };
}

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

test('sanitiza o catálogo nativo (initialize ou supportedModels) sem mutar a entrada', () => {
  const fromInit = controls.sanitizeCatalog(deepFreeze(initializeResponse()));
  assert.equal(fromInit.ok, true);
  assert.equal(fromInit.reason, null);
  assert.equal(fromInit.models.length, 4);
  assert.equal(fromInit.dropped, 0);
  assert.equal(fromInit.modelSelection, true);
  assert.equal(fromInit.effort, true, 'há modelo com esforço e níveis');

  const fromArray = controls.sanitizeCatalog(NATIVE_CATALOG);
  assert.deepEqual(fromArray.models.map((m) => m.value), ['sonnet', 'claude-opus-4-8', 'haiku', 'claude-incomplete']);

  const sonnet = fromInit.models[0];
  assert.deepEqual(
    {
      value: sonnet.value,
      resolvedModel: sonnet.resolvedModel,
      displayName: sonnet.displayName,
      supportsEffort: sonnet.supportsEffort,
      levels: [...sonnet.supportedEffortLevels],
      adaptive: sonnet.supportsAdaptiveThinking,
      fast: sonnet.supportsFastMode,
      auto: sonnet.supportsAutoMode,
      router: sonnet.routerSuspected,
    },
    {
      value: 'sonnet',
      resolvedModel: 'claude-sonnet-5',
      displayName: 'Sonnet 5',
      supportsEffort: true,
      levels: ['low', 'medium', 'high'],
      adaptive: true,
      fast: true,
      auto: false,
      router: false,
    },
  );

  const haiku = fromInit.models.find((m) => m.value === 'haiku');
  assert.equal(haiku.supportsEffort, false, 'metadado ausente vira false — nunca inferido');
  assert.deepEqual([...haiku.supportedEffortLevels], []);

  const incomplete = fromInit.models.find((m) => m.value === 'claude-incomplete');
  assert.equal(incomplete.supportsEffort, true);
  assert.deepEqual([...incomplete.supportedEffortLevels], []);

  const junk = controls.sanitizeCatalog([SONNET, null, 7, {}, {value: ''}, {value: 'x'.repeat(300)}]);
  assert.equal(junk.ok, true);
  assert.deepEqual(junk.models.map((m) => m.value), ['sonnet']);
  assert.equal(junk.dropped, 5);

  const dupes = controls.sanitizeCatalog([SONNET, {...SONNET, displayName: 'Cópia'}]);
  assert.equal(dupes.models.length, 1);
  assert.equal(dupes.dropped, 1);

  const unknownLevels = controls.sanitizeCatalog([{...SONNET, supportedEffortLevels: ['low', 'turbo', 'max', 'low']}]);
  assert.deepEqual([...unknownLevels.models[0].supportedEffortLevels], ['low', 'max'], 'níveis fora da união nativa são descartados');

  const capped = controls.sanitizeCatalog(Array.from({length: controls.MAX_MODELS + 5}, (_, i) => ({value: `m${i}`})));
  assert.equal(capped.models.length, controls.MAX_MODELS);
  assert.equal(capped.dropped, 5);
});

test('catálogo ausente, vazio ou desconhecido fecha sem inventar modelo', () => {
  const cases = [
    [undefined, controls.REASONS.CATALOG_MISSING],
    [null, controls.REASONS.CATALOG_MISSING],
    [[], controls.REASONS.CATALOG_EMPTY],
    [{models: []}, controls.REASONS.CATALOG_EMPTY],
    [{}, controls.REASONS.CATALOG_INVALID],
    [{models: 'sonnet'}, controls.REASONS.CATALOG_INVALID],
    ['sonnet', controls.REASONS.CATALOG_INVALID],
    [[{value: ''}], controls.REASONS.CATALOG_INVALID],
  ];
  for (const [source, reason] of cases) {
    const catalog = controls.sanitizeCatalog(source);
    assert.equal(catalog.ok, false, `fonte ${JSON.stringify(source)}`);
    assert.equal(catalog.reason, reason);
    assert.deepEqual(catalog.models, []);
    assert.equal(catalog.modelSelection, false);
    assert.equal(catalog.effort, false);
  }
});

test('visão do seletor usa o formato da Mesa e esconde suspeitos de roteador', () => {
  const catalog = controls.sanitizeCatalog(initializeResponse());
  const view = controls.selectionView(catalog);
  assert.equal(view.modelSelection, true);
  assert.equal(view.effort, true);
  assert.equal(view.defaultModel, null, 'default do Claude Code, não um modelo escolhido');
  assert.deepEqual(view.models.map((m) => [m.provider, m.id, m.name]), [
    ['anthropic', 'sonnet', 'Sonnet 5'],
    ['anthropic', 'claude-opus-4-8', 'Opus 4.8'],
    ['anthropic', 'haiku', 'Haiku 4.5'],
    ['anthropic', 'claude-incomplete', 'Incompleto'],
  ]);

  const routerCatalog = controls.sanitizeCatalog([
    {value: 'bedrock/claude-sonnet-5', displayName: 'Bedrock Sonnet', description: ''},
    {value: 'us.anthropic.claude-opus-4-8', displayName: 'AWS Opus', description: ''},
    SONNET,
  ]);
  assert.equal(routerCatalog.ok, true);
  assert.equal(routerCatalog.models.filter((m) => m.routerSuspected).length, 2);
  assert.deepEqual(controls.selectionView(routerCatalog).models.map((m) => m.id), ['sonnet']);
  assert.deepEqual(
    controls.selectionView(routerCatalog, {firstPartyOnly: false}).models.map((m) => m.id),
    ['bedrock/claude-sonnet-5', 'us.anthropic.claude-opus-4-8', 'sonnet'],
  );

  const noEffort = controls.sanitizeCatalog([HAIKU]);
  const noEffortView = controls.selectionView(noEffort);
  assert.equal(noEffortView.modelSelection, true, 'modelo sem esforço ainda é selecionável');
  assert.equal(noEffortView.effort, false, 'esforço exige metadado nativo');

  const badView = controls.selectionView(controls.sanitizeCatalog(null));
  assert.equal(badView.modelSelection, false);
  assert.equal(badView.effort, false);
  assert.equal(badView.catalogReason, controls.REASONS.CATALOG_MISSING);
});

test('sem seleção, as opções saem vazias e o default nativo é preservado', () => {
  const catalog = controls.sanitizeCatalog(initializeResponse());
  for (const selection of [undefined, null, {}, {model: '', effort: ''}, {model: '   '}]) {
    const compiled = controls.compileSelection(selection, catalog);
    assert.equal(compiled.ok, true);
    assert.deepEqual(compiled.options, {}, 'nenhum model/effort é imposto');
    assert.deepEqual(compiled.patch, {model: null, effort: null});
  }
  /* Mesmo com catálogo ruim, não escolher nada continua sendo o default nativo. */
  for (const bad of [undefined, [], {}, 'texto']) {
    const compiled = controls.compileSelection({}, controls.sanitizeCatalog(bad));
    assert.equal(compiled.ok, true);
    assert.deepEqual(compiled.options, {});
  }
  assert.equal(controls.compileSelection(42, catalog).reason, controls.REASONS.SELECTION_INVALID);
});

test('resolve value, alias e id explícito persistido para a linha certa do catálogo', () => {
  const catalog = controls.sanitizeCatalog(initializeResponse());

  const byAlias = controls.compileSelection({model: 'sonnet'}, catalog);
  assert.equal(byAlias.ok, true);
  assert.deepEqual(byAlias.options, {model: 'sonnet'});
  assert.equal(byAlias.model, 'sonnet');

  /* Id canônico persistido casa com a linha de alias que o cobre. */
  const byResolved = controls.compileSelection({model: 'claude-sonnet-5'}, catalog);
  assert.equal(byResolved.ok, true);
  assert.equal(byResolved.model, 'sonnet');
  assert.deepEqual(byResolved.options, {model: 'sonnet'});
  assert.deepEqual(byResolved.patch, {model: 'sonnet', effort: null});

  const byExact = controls.compileSelection({model: 'claude-opus-4-8'}, catalog);
  assert.equal(byExact.model, 'claude-opus-4-8');

  const byCase = controls.compileSelection({model: 'SONNET'}, catalog);
  assert.equal(byCase.ok, true);
  assert.equal(byCase.model, 'sonnet');

  /* Id desconhecido não vira opção nem patch. */
  const unknown = controls.compileSelection({model: 'claude-3-5-sonnet-20241022'}, catalog);
  assert.equal(unknown.ok, false);
  assert.equal(unknown.reason, controls.REASONS.MODEL_UNKNOWN);
  assert.equal(unknown.patch, null);
  assert.deepEqual(unknown.options, {});

  /* Catálogo indisponível nunca libera escolha explícita. */
  const noCatalog = controls.compileSelection({model: 'sonnet'}, controls.sanitizeCatalog(null));
  assert.equal(noCatalog.reason, controls.REASONS.CATALOG_UNAVAILABLE);
  assert.equal(noCatalog.detail, controls.REASONS.CATALOG_MISSING);
});

test('primeira parte: roteador arbitrário é recusado; conta 3P não ganha controles', () => {
  const account = {apiProvider: 'firstParty', email: 'nao-deve-vazar@example.com', organization: 'segredo'};
  const catalog = controls.sanitizeCatalog(initializeResponse(), {account});
  assert.equal(catalog.firstParty, true);
  assert.equal(catalog.accountProvider, 'firstParty');
  assert.equal(JSON.stringify(catalog).includes('nao-deve-vazar'), false);
  assert.equal(JSON.stringify(catalog).includes('segredo'), false);

  const routerSelection = controls.compileSelection({model: 'bedrock/claude-sonnet-5'}, controls.sanitizeCatalog([
    {value: 'bedrock/claude-sonnet-5', displayName: 'Roteador', description: ''},
    SONNET,
  ]), {account});
  assert.equal(routerSelection.ok, false);
  assert.equal(routerSelection.reason, controls.REASONS.MODEL_ROUTER);

  const thirdParty = controls.compileSelection({model: 'sonnet'}, catalog, {account: {apiProvider: 'bedrock'}});
  assert.equal(thirdParty.ok, false);
  assert.equal(thirdParty.reason, controls.REASONS.ACCOUNT_NOT_FIRST_PARTY);
  assert.equal(thirdParty.detail, 'bedrock');

  /* Sem escolha, a conta 3P ainda preserva o default nativo (opções vazias). */
  const untouched = controls.compileSelection({}, catalog, {account: {apiProvider: 'bedrock'}});
  assert.equal(untouched.ok, true);
  assert.deepEqual(untouched.options, {});

  /* Escape só existe com intenção 3P explícita; nunca com firstPartyOnly. */
  const blocked = controls.compileSelection({model: 'custom/router-model'}, catalog, {account, allowUnlistedModel: true});
  assert.equal(blocked.reason, controls.REASONS.MODEL_ROUTER);
  const listed = controls.compileSelection({model: 'custom/router-model'}, controls.sanitizeCatalog([{value: 'custom/router-model'}]), {
    account: {apiProvider: 'gateway'},
    firstPartyOnly: false,
  });
  assert.equal(listed.ok, true, 'linha do próprio catálogo nativo continua valendo no modo gateway');
  assert.deepEqual(listed.options, {model: 'custom/router-model'});
  const unlisted = controls.compileSelection({model: 'nao-listado'}, catalog, {account, firstPartyOnly: false, allowUnlistedModel: true});
  assert.equal(unlisted.ok, true);
  assert.deepEqual(unlisted.options, {model: 'nao-listado'});
  assert.deepEqual(unlisted.patch, {model: 'nao-listado', effort: null});
});

test('esforço só compila com metadado nativo; ausente/incompleto desliga o controle', () => {
  const catalog = controls.sanitizeCatalog(initializeResponse());

  const high = controls.compileSelection({model: 'sonnet', effort: 'high'}, catalog);
  assert.equal(high.ok, true);
  assert.deepEqual(high.options, {model: 'sonnet', effort: 'high'});
  assert.deepEqual(high.levels, ['low', 'medium', 'high']);

  const maxOpus = controls.compileSelection({model: 'claude-opus-4-8', effort: 'max'}, catalog);
  assert.deepEqual(maxOpus.options, {model: 'claude-opus-4-8', effort: 'max'});

  const badLevel = controls.compileSelection({model: 'sonnet', effort: 'xhigh'}, catalog);
  assert.equal(badLevel.ok, false);
  assert.equal(badLevel.reason, controls.REASONS.EFFORT_UNKNOWN);
  assert.deepEqual(badLevel.levels, ['low', 'medium', 'high']);

  const unsupported = controls.compileSelection({model: 'haiku', effort: 'high'}, catalog);
  assert.equal(unsupported.ok, false);
  assert.equal(unsupported.reason, controls.REASONS.EFFORT_UNSUPPORTED);

  const incomplete = controls.compileSelection({model: 'claude-incomplete', effort: 'low'}, catalog);
  assert.equal(incomplete.ok, false);
  assert.equal(incomplete.reason, controls.REASONS.EFFORT_UNSUPPORTED, 'flags sem níveis = indisponível');

  const orphan = controls.compileSelection({effort: 'high'}, catalog);
  assert.equal(orphan.reason, controls.REASONS.EFFORT_REQUIRES_MODEL);

  const unlisted = controls.compileSelection({model: 'nao-listado', effort: 'high'}, catalog, {firstPartyOnly: false, allowUnlistedModel: true});
  assert.equal(unlisted.reason, controls.REASONS.EFFORT_UNVERIFIED, 'sem entrada não há como verificar suporte');

  const normalized = controls.normalizeEffort(catalog.models.find((m) => m.value === 'sonnet'), 'low');
  assert.deepEqual({ok: normalized.ok, effort: normalized.effort, levels: [...normalized.levels]}, {ok: true, effort: 'low', levels: ['low', 'medium', 'high']});
  assert.equal(controls.normalizeEffort(catalog.models.find((m) => m.value === 'haiku'), 'high').ok, false);
  assert.equal(controls.normalizeEffort(catalog.models.find((m) => m.value === 'haiku'), null).ok, true);
  assert.deepEqual(controls.effortLevelsFor(catalog, 'claude-sonnet-5'), ['low', 'medium', 'high']);
  assert.deepEqual(controls.effortLevelsFor(catalog, 'haiku'), []);
});

test('escolha persiste por conversa: descritor → compilar → patch validado', () => {
  const catalog = controls.sanitizeCatalog(initializeResponse());
  const descriptor = {schemaVersion: 1, engine: 'claude', model: 'claude-sonnet-5', effort: 'high', preview: 'oi'};
  const stored = controls.selectionFromDescriptor(descriptor);
  assert.deepEqual(stored, {model: 'claude-sonnet-5', effort: 'high'});
  const compiled = controls.compileSelection(stored, catalog);
  assert.equal(compiled.ok, true);
  assert.deepEqual(compiled.patch, {model: 'sonnet', effort: 'high'});

  /* Trocar só o modelo limpa a escolha? Não: esforço fora do novo modelo é
     recusado inteiro (fail closed), sem meia gravação. */
  const switched = controls.compileSelection({model: 'haiku', effort: 'high'}, catalog);
  assert.equal(switched.ok, false);
  assert.equal(switched.patch, null);

  /* Sem esforço no descritor, o patch mantém o default nativo de esforço. */
  assert.deepEqual(controls.compileSelection(controls.selectionFromDescriptor({model: 'sonnet'}), catalog).patch, {model: 'sonnet', effort: null});

  /* Descritor corrompido/estranho não inventa escolha. */
  assert.deepEqual(controls.selectionFromDescriptor(null), {model: null, effort: null});
  assert.deepEqual(controls.selectionFromDescriptor({model: 7, effort: {}}), {model: null, effort: null});

  /* Escolha persistida que sumiu do catálogo nativo é recusada, não "mantida". */
  const stale = controls.compileSelection(controls.selectionFromDescriptor({model: 'aposentado', effort: 'max'}), catalog);
  assert.equal(stale.ok, false);
  assert.equal(stale.reason, controls.REASONS.MODEL_UNKNOWN);
});

test('troca de seleção só passa com o motor ocioso', () => {
  assert.deepEqual(controls.canSwitchSelection({}), {allowed: true, reason: null});
  assert.deepEqual(controls.canSwitchSelection({busy: true}), {allowed: false, reason: controls.SWITCH_REASONS.BUSY});
  assert.deepEqual(controls.canSwitchSelection({hasTurn: true}), {allowed: false, reason: controls.SWITCH_REASONS.TURN});
  assert.deepEqual(controls.canSwitchSelection({pendingPermission: true}), {allowed: false, reason: controls.SWITCH_REASONS.PERMISSION});
  assert.deepEqual(controls.canSwitchSelection({uncertain: true}), {allowed: false, reason: controls.SWITCH_REASONS.UNCERTAIN});
  assert.deepEqual(controls.canSwitchSelection({uncertain: true, busy: true}), {allowed: false, reason: controls.SWITCH_REASONS.UNCERTAIN});
  assert.equal(controls.canSwitchSelection(null).allowed, true);
});

test('lê o catálogo de uma query já conectada sem criar consulta nem insistir', async () => {
  const calls = [];
  const preferred = {
    supportedModels: async () => {
      calls.push('supportedModels');
      return NATIVE_CATALOG;
    },
    initializationResult: async () => {
      calls.push('initializationResult');
      return initializeResponse();
    },
  };
  const catalog = await controls.readCatalogFromQuery(preferred, {account: {apiProvider: 'firstParty'}});
  assert.equal(catalog.ok, true);
  assert.equal(catalog.models.length, 4);
  assert.deepEqual(calls, ['supportedModels'], 'não faz a segunda chamada quando a primeira serve');

  const fallbackCalls = [];
  const fallback = {
    initializationResult: async () => {
      fallbackCalls.push('initializationResult');
      return initializeResponse();
    },
  };
  assert.equal((await controls.readCatalogFromQuery(fallback)).ok, true);
  assert.deepEqual(fallbackCalls, ['initializationResult']);

  let attempts = 0;
  const failing = {
    supportedModels: async () => {
      attempts += 1;
      throw Object.assign(new Error('transporte caiu'), {code: 'ECONNRESET'});
    },
  };
  const failure = await controls.readCatalogFromQuery(failing);
  assert.equal(failure.ok, false);
  assert.equal(failure.reason, controls.REASONS.CATALOG_UNAVAILABLE);
  assert.equal(failure.detail, 'ECONNRESET');
  assert.equal(attempts, 1, 'sem retry automático');

  assert.equal((await controls.readCatalogFromQuery(null)).reason, controls.REASONS.CATALOG_MISSING);
  assert.equal((await controls.readCatalogFromQuery({})).reason, controls.REASONS.CATALOG_MISSING);
  assert.equal((await controls.readCatalogFromQuery({supportedModels: 'não é função'})).reason, controls.REASONS.CATALOG_MISSING);
});

test('compatibilidade com o SDK pinado 0.3.246 (tipos reais do sdk.d.ts)', {skip: (() => {
  const dts = fileURLToPath(new URL('../node_modules/@anthropic-ai/claude-agent-sdk/sdk.d.ts', import.meta.url));
  return !existsSync(dts);
})()}, () => {
  const pkg = JSON.parse(readFileSync(fileURLToPath(new URL('../node_modules/@anthropic-ai/claude-agent-sdk/package.json', import.meta.url)), 'utf8'));
  assert.equal(pkg.version, '0.3.246', 'o módulo só documenta o pin instalado');

  const dts = readFileSync(fileURLToPath(new URL('../node_modules/@anthropic-ai/claude-agent-sdk/sdk.d.ts', import.meta.url)), 'utf8');
  assert.match(dts, /initializationResult\(\): Promise<SDKControlInitializeResponse>;/, 'initializationResult existe e devolve a resposta de init');
  assert.match(dts, /supportedModels\(\): Promise<ModelInfo\[\]>;/, 'supportedModels devolve ModelInfo[]');
  assert.match(dts, /export declare type SDKControlInitializeResponse = \{[\s\S]*?models: coreTypes\.ModelInfo\[\];[\s\S]*?\};/, 'a resposta de init carrega models');
  const modelBlock = /export declare type ModelInfo = \{([\s\S]*?)\n\};/.exec(dts);
  assert.ok(modelBlock, 'ModelInfo declarado');
  for (const field of [
    /value: string;/,
    /resolvedModel\?: string;/,
    /displayName: string;/,
    /description: string;/,
    /supportsEffort\?: boolean;/,
    /supportedEffortLevels\?: \('low' \| 'medium' \| 'high' \| 'xhigh' \| 'max'\)\[\];/,
    /supportsAdaptiveThinking\?: boolean;/,
    /supportsFastMode\?: boolean;/,
    /supportsAutoMode\?: boolean;/,
  ]) {
    assert.match(modelBlock[1], field, `ModelInfo.${field} presente no pin`);
  }

  const effortUnion = /export declare type EffortLevel = ('low' \| 'medium' \| 'high' \| 'xhigh' \| 'max');/.exec(dts);
  assert.ok(effortUnion, 'EffortLevel declarado no pin');
  assert.deepEqual(
    effortUnion[1].split(' | ').map((part) => part.replaceAll("'", '')),
    [...controls.EFFORT_LEVELS],
    'a união de esforço do módulo é exatamente a do SDK pinado',
  );
  assert.match(dts, /effort\?: EffortLevel;/, 'query() aceita effort tipado');
  assert.match(dts, /model\?: string;/, 'query() aceita model');
  assert.match(dts, /apiProvider\?: 'firstParty' \| 'bedrock'/, 'AccountInfo distingue firstParty de 3P');
});

test('módulo é puro: sem imports, timers, processos, rede ou ambiente', () => {
  /* Comentários citam o contrato do host; o teste olha só o código executável. */
  const source = readFileSync(fileURLToPath(new URL('../src/agents/claude-controls.cjs', import.meta.url)), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  for (const banned of ['require(', 'import(', 'child_process', 'spawn', 'execFile', 'setTimeout', 'setInterval', 'fetch(', 'process.env', 'node:fs', 'node:net', 'node:http']) {
    assert.equal(source.includes(banned), false, `não pode conter ${banned}`);
  }
  for (const name of [
    'EFFORT_LEVELS', 'REASONS', 'SWITCH_REASONS', 'sanitizeCatalog', 'resolveCatalogEntry',
    'effortSupport', 'normalizeEffort', 'compileSelection', 'selectionFromDescriptor',
    'canSwitchSelection', 'modelsForSelector', 'selectionView', 'effortLevelsFor', 'readCatalogFromQuery',
  ]) {
    assert.ok(name in controls, `exporta ${name}`);
  }
});
