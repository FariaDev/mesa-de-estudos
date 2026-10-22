/* Catálogo de modelos e medidor de contexto do OpenCode v2.0.32.
 *
 * Porte dos casos puros de `opencode-catalog.test.mjs` e
 * `opencode-usage.test.mjs` (commit cc634be) para os módulos atuais.
 * Sem rede, sem binário e sem DOM: só a transformação dos payloads. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {
  catalogModels, compileSelection, findModel, levelsFor, modelKey, modelRef, modelView,
  normalizeSelection, parseModelKey, reconcileSelection, variantList,
} = require('../src/agents/opencode-catalog.cjs');
const {contextUsage, tokenTotal} = require('../src/agents/opencode-usage.cjs');

const PAYLOAD = {
  location: {directory: '/tmp/estudo'},
  data: [
    {
      id: 'minimax-m3.1-flash-free', modelID: 'minimax-m3.1-flash-free', providerID: 'opencode',
      name: 'MiniMax M3.1 Flash Free', limit: {context: 1000000},
      variants: [
        {id: 'low', settings: {reasoningEffort: 'low'}},
        {id: 'medium', settings: {reasoningEffort: 'medium'}},
        {id: 'high', settings: {reasoningEffort: 'high'}},
        {id: 'xhigh', settings: {reasoningEffort: 'xhigh'}},
        {id: 'max', settings: {reasoningEffort: 'max'}},
      ],
    },
    {id: 'grok-code', modelID: 'grok-code', providerID: 'opencode-go', name: 'Grok Code', variants: []},
    {id: 'sem-nome', providerID: 'opencode', name: '   ', variants: [{id: 'thinking'}]},
  ],
};

const USAGE = {input: 20000, output: 3000, reasoning: 0, cache: {read: 1000, write: 0}};
const CATALOG = [{providerID: 'opencode', id: 'deepseek', limit: {context: 200000}}];
const assistant = (overrides = {}) => ({
  id: 'msg_a',
  type: 'assistant',
  model: {providerID: 'opencode', id: 'deepseek'},
  tokens: USAGE,
  ...overrides,
});

/* ---------- catálogo ---------- */

test('o payload do catálogo vira a lista do seletor (provider, id, name, variants)', () => {
  const models = catalogModels(PAYLOAD);
  assert.equal(models.length, 3);
  assert.deepEqual(models[0], {
    provider: 'opencode', id: 'minimax-m3.1-flash-free', name: 'MiniMax M3.1 Flash Free',
    variants: ['low', 'medium', 'high', 'xhigh', 'max'],
  });
  assert.deepEqual(models[1].variants, [], 'modelo sem variante tem lista vazia (não é erro)');
  assert.equal(models[2].name, 'sem-nome', 'modelo sem nome usa o id');
});

test('a lista crua também é aceita e o payload torto vira lista vazia', () => {
  assert.equal(catalogModels(PAYLOAD.data).length, 3);
  assert.deepEqual(catalogModels(null), []);
  assert.deepEqual(catalogModels({data: 'nope'}), []);
  assert.deepEqual(catalogModels({}), []);
});

test('catalogModels guarda o custo do primeiro item de cost', () => {
  const models = catalogModels({data: [{
    id: 'modelo', providerID: 'opencode',
    cost: [{input: 0, output: 0}, {input: 5, output: 10}],
  }]});
  assert.deepEqual(models[0].cost, {input: 0, output: 0});
});

test('variante repetida some e variante que não cabe no descritor fica de fora', () => {
  assert.deepEqual(variantList([{id: 'low'}, {id: 'low'}, {id: ' high '}]), ['low', 'high']);
  assert.deepEqual(variantList([{id: 'x'.repeat(25)}]), [], 'id acima de 24 não entra no catálogo');
  assert.deepEqual(variantList([{id: 'x'.repeat(24)}]), ['x'.repeat(24)], '24 cabem no descritor');
  assert.deepEqual(variantList([{settings: {}}]), []);
});

test('a chave do modelo é providerID/id e volta para os dois campos', () => {
  assert.equal(modelKey({provider: 'opencode', id: 'grok-code'}), 'opencode/grok-code');
  assert.deepEqual(parseModelKey('opencode-go/grok-code'), {provider: 'opencode-go', id: 'grok-code'});
  assert.deepEqual(parseModelKey('opencode/modelo/com/slash'), {provider: 'opencode', id: 'modelo/com/slash'});
  assert.equal(parseModelKey('sem-barra'), null);
  assert.equal(parseModelKey(''), null);
  assert.equal(parseModelKey(null), null);
});

test('o modelo escolhido aparece no formato do seletor da Mesa', () => {
  const models = catalogModels(PAYLOAD);
  assert.deepEqual(modelView(models, 'opencode-go/grok-code'), {provider: 'opencode-go', id: 'grok-code', name: 'Grok Code'});
  assert.equal(modelView(models, 'opencode/nao-existe'), null);
  assert.equal(modelView(models, null), null);
});

test('os níveis são as variantes do modelo escolhido', () => {
  const models = catalogModels(PAYLOAD);
  assert.deepEqual(levelsFor(models, 'opencode/minimax-m3.1-flash-free'), ['low', 'medium', 'high', 'xhigh', 'max']);
  assert.deepEqual(levelsFor(models, 'opencode-go/grok-code'), []);
  assert.deepEqual(levelsFor(models, null), []);
});

test('o Model.Ref leva id, providerID e a variante que o modelo tem', () => {
  const models = catalogModels(PAYLOAD);
  const model = findModel(models, {provider: 'opencode', id: 'minimax-m3.1-flash-free'});
  assert.deepEqual(modelRef(model, 'high'), {id: 'minimax-m3.1-flash-free', providerID: 'opencode', variant: 'high'});
  assert.deepEqual(modelRef(model, 'nao-existe'), {id: 'minimax-m3.1-flash-free', providerID: 'opencode'});
  assert.equal(modelRef(null, 'high'), null);
});

test('a escolha é conferida contra o catálogo: modelo fora é recusa', () => {
  const models = catalogModels(PAYLOAD);
  const ok = compileSelection({model: 'opencode-go/grok-code', effort: null}, models);
  assert.equal(ok.ok, true);
  assert.equal(ok.model, 'opencode-go/grok-code');
  const unknown = compileSelection({model: 'opencode/nao-existe'}, models);
  assert.equal(unknown.ok, false);
  assert.equal(unknown.reason, 'model_unknown');
  const badEffort = compileSelection({model: 'opencode-go/grok-code', effort: 'high'}, models);
  assert.equal(badEffort.ok, false);
  assert.equal(badEffort.reason, 'effort_unknown');
  const effortWithoutModel = compileSelection({effort: 'high'}, models);
  assert.equal(effortWithoutModel.ok, false);
  assert.equal(effortWithoutModel.reason, 'effort_requires_model');
});

test('sem escolha nada é escrito: o servidor fica no padrão dele', () => {
  const models = catalogModels(PAYLOAD);
  const empty = compileSelection({model: null, effort: null}, models);
  assert.equal(empty.ok, true);
  assert.equal(empty.model, null);
  assert.equal(empty.effort, null);
  assert.equal(empty.ref, null);
});

test('trocar de modelo zera a variante que o modelo novo não tem', () => {
  const models = catalogModels(PAYLOAD);
  const kept = reconcileSelection({model: 'opencode/minimax-m3.1-flash-free', effort: 'max'}, models);
  assert.deepEqual(kept, {model: 'opencode/minimax-m3.1-flash-free', effort: 'max'});
  const zeroed = reconcileSelection({model: 'opencode-go/grok-code', effort: 'max'}, models);
  assert.deepEqual(zeroed, {model: 'opencode-go/grok-code', effort: null});
});

test('a escolha normalizada só aceita string curta', () => {
  assert.deepEqual(normalizeSelection({model: ' opencode/x ', effort: ' high '}), {model: 'opencode/x', effort: 'high'});
  assert.deepEqual(normalizeSelection({model: 42, effort: {}}), {model: null, effort: null});
  assert.deepEqual(normalizeSelection(null), {model: null, effort: null});
  assert.equal(normalizeSelection({model: 'a'.repeat(500)}).model.length, 400);
});

/* ---------- medidor de contexto ---------- */

test('tokens somam os cinco campos; campo ausente ou torto não vira número', () => {
  assert.equal(tokenTotal(USAGE), 24000);
  assert.equal(tokenTotal({input: 1, output: 2, reasoning: 3, cache: {read: 4, write: 5}}), 15);
  assert.equal(tokenTotal({input: 1, output: 2, reasoning: 3}), null, 'cache ausente');
  assert.equal(tokenTotal({input: 1, output: 2, reasoning: 3, cache: {read: 4}}), null, 'write ausente');
  assert.equal(tokenTotal({input: 1, output: 2, reasoning: 3, cache: {read: '4', write: 5}}), null, 'string não é número');
  assert.equal(tokenTotal(null), null);
});

test('o medidor usa a última assistant com tokens e o limit.context do modelo', () => {
  const usage = contextUsage([
    {id: 'msg_u', type: 'user'},
    assistant({id: 'msg_a2'}),
    assistant({id: 'msg_a1', tokens: {input: 100, output: 0, reasoning: 0, cache: {read: 0, write: 0}}}),
  ], CATALOG);
  assert.deepEqual(usage, {tokens: 24000, contextWindow: 200000, percent: 12});
});

test('assistant ainda sem tokens não esconde a medição anterior', () => {
  const usage = contextUsage([assistant({id: 'msg_stream', tokens: undefined}), assistant({id: 'msg_prev'})], CATALOG);
  assert.equal(usage.tokens, 24000);
  assert.equal(contextUsage([assistant({tokens: undefined})], CATALOG), null, 'sem nenhuma medição');
});

test('compactação concluída corta o trecho; compactação em curso não corta', () => {
  assert.equal(contextUsage([{type: 'compaction', status: 'completed'}, assistant()], CATALOG), null);
  assert.equal(contextUsage([{type: 'compaction', status: 'running'}, assistant()], CATALOG).tokens, 24000);
  assert.equal(contextUsage([{type: 'compaction', status: 'failed'}, assistant()], CATALOG).tokens, 24000);
});

test('sem o modelo no catálogo (ou sem limit.context) não há percentual inventado', () => {
  assert.equal(contextUsage([assistant()], []), null);
  assert.equal(contextUsage([assistant()], [{providerID: 'outro', id: 'deepseek', limit: {context: 200000}}]), null);
  assert.equal(contextUsage([assistant()], [{providerID: 'opencode', id: 'outro', limit: {context: 200000}}]), null);
  assert.equal(contextUsage([assistant()], [{providerID: 'opencode', id: 'deepseek', limit: {}}]), null);
  assert.equal(contextUsage([assistant()], [{providerID: 'opencode', id: 'deepseek', limit: {context: 0}}]), null);
  assert.equal(contextUsage([{type: 'assistant', tokens: USAGE}], CATALOG), null, 'sem o modelo da mensagem');
});

test('soma zero/negativa não vira medidor', () => {
  const zero = {input: 0, output: 0, reasoning: 0, cache: {read: 0, write: 0}};
  assert.equal(contextUsage([assistant({tokens: zero})], CATALOG), null);
});
