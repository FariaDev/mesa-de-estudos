/* Medidor de contexto do Claude Code (#58).
 *
 * Casos puros de `claude-usage.cjs`: uso nativo saneado, soma de tokens,
 * janela do modelo que respondeu e o objeto `contextUsage` da Mesa.
 * Sem I/O, sem rede e sem DOM: só a transformação dos payloads. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {
  isSaneUsage, tokenTotal, modelContextWindow, contextUsage,
} = require('../src/agents/claude-usage.cjs');

const MODEL_USAGE = {
  'claude-sonnet-4-5': {
    canonicalModel: 'claude-sonnet-4-5-20250929',
    contextWindow: 200000,
    costUSD: 0.12,
  },
  'claude-opus-4-1': {contextWindow: 180000},
};

/* ---------- uso nativo ---------- */

test('uso nativo vazio, nulo ou ausente é são', () => {
  assert.equal(isSaneUsage({}), true);
  assert.equal(isSaneUsage({input_tokens: 10}), true, 'campo ausente não invalida');
  assert.equal(isSaneUsage({input_tokens: null, output_tokens: undefined}), true, 'nulo é "não reportado"');
});

test('uso nativo negativo, NaN, Infinity ou string não é são', () => {
  for (const value of [-1, NaN, Infinity, '10']) {
    assert.equal(isSaneUsage({input_tokens: value}), false, `${String(value)} não é contagem`);
  }
  assert.equal(isSaneUsage({cache_read_input_tokens: -1}), false);
  assert.equal(isSaneUsage({cache_creation_input_tokens: NaN}), false);
});

test('não-objeto não é uso nativo', () => {
  for (const value of [null, undefined, 42, '10', [], true]) {
    assert.equal(isSaneUsage(value), false, `${String(value)} não é objeto simples`);
  }
});

/* ---------- soma de tokens ---------- */

test('a soma é input + output + cacheRead + cacheWrite', () => {
  assert.equal(tokenTotal({input: 10, output: 5, cacheRead: 100, cacheWrite: 20}), 135);
});

test('campo ausente não conta e soma zero dá null', () => {
  assert.equal(tokenTotal({input: 10, cacheWrite: 5}), 15);
  assert.equal(tokenTotal({cacheRead: 7}), 7);
  assert.equal(tokenTotal({input: 0, output: 0, cacheRead: 0, cacheWrite: 0}), null, 'soma zero não mede');
  assert.equal(tokenTotal({input: 0}), null);
});

test('campo torto ou objeto sem campo de uso dá null', () => {
  for (const value of [-1, NaN, Infinity, '10', null]) {
    assert.equal(tokenTotal({input: 10, output: value}), null, `${String(value)} não é contagem`);
  }
  assert.equal(tokenTotal({}), null);
  assert.equal(tokenTotal({reasoning: 10}), null, 'nenhum dos quatro campos de uso');
  assert.equal(tokenTotal(null), null);
  assert.equal(tokenTotal([]), null);
});

/* ---------- janela do modelo ---------- */

test('a janela casa pela chave exata, pelo canonicalModel e sem diferenciar maiúsculas', () => {
  assert.equal(modelContextWindow(MODEL_USAGE, 'claude-sonnet-4-5'), 200000);
  assert.equal(modelContextWindow(MODEL_USAGE, 'claude-sonnet-4-5-20250929'), 200000, 'canonicalModel');
  assert.equal(modelContextWindow(MODEL_USAGE, 'CLAUDE-OPUS-4-1'), 180000, 'chave sem caixa');
  assert.equal(modelContextWindow(MODEL_USAGE, '  claude-opus-4-1  '), 180000, 'modelo aparado');
});

test('costUSD nunca vira janela', () => {
  assert.equal(modelContextWindow({'claude-x': {costUSD: 0.5}}, 'claude-x'), null);
  assert.equal(modelContextWindow({costUSD: 0.5}, 'costUSD'), null, 'entrada que não é objeto fica de fora');
});

test('janela zero, negativa, torta ou ausente dá null', () => {
  assert.equal(modelContextWindow({m: {contextWindow: 0}}, 'm'), null);
  assert.equal(modelContextWindow({m: {contextWindow: -1}}, 'm'), null);
  assert.equal(modelContextWindow({m: {contextWindow: '200000'}}, 'm'), null);
  assert.equal(modelContextWindow({m: {}}, 'm'), null);
  assert.equal(modelContextWindow({}, 'm'), null);
  assert.equal(modelContextWindow(null, 'm'), null);
});

test('modelo vazio ou que não é string dá null', () => {
  assert.equal(modelContextWindow(MODEL_USAGE, ''), null);
  assert.equal(modelContextWindow(MODEL_USAGE, '   '), null);
  assert.equal(modelContextWindow(MODEL_USAGE, null), null);
  assert.equal(modelContextWindow(MODEL_USAGE, 42), null);
});

/* ---------- medidor ---------- */

test('contextUsage devolve tokens, janela e percentual arredondado', () => {
  const usage = {input: 100000, output: 0, cacheRead: 0, cacheWrite: 0};
  assert.deepEqual(
    contextUsage({usage, model: 'claude-sonnet-4-5', modelUsage: MODEL_USAGE}),
    {tokens: 100000, contextWindow: 200000, percent: 50},
  );

  const oneOfEight = contextUsage({
    usage: {input: 1},
    model: 'm',
    modelUsage: {m: {contextWindow: 8}},
  });
  assert.equal(oneOfEight.percent, 13, '12,5 arredonda para 13');

  const twoOfThree = contextUsage({
    usage: {input: 2},
    model: 'm',
    modelUsage: {m: {contextWindow: 3}},
  });
  assert.equal(twoOfThree.percent, 67, '66,6... arredonda para 67');
});

test('sem uso (ou com uso torto) não há medidor', () => {
  assert.equal(contextUsage({model: 'claude-sonnet-4-5', modelUsage: MODEL_USAGE}), null);
  assert.equal(contextUsage({usage: {}, model: 'claude-sonnet-4-5', modelUsage: MODEL_USAGE}), null);
  assert.equal(contextUsage({usage: {input: -1}, model: 'claude-sonnet-4-5', modelUsage: MODEL_USAGE}), null);
  assert.equal(contextUsage(), null);
});

test('sem janela não há medidor', () => {
  const usage = {input: 100};
  assert.equal(contextUsage({usage, model: 'claude-sonnet-4-5'}), null);
  assert.equal(contextUsage({usage, model: 'outro', modelUsage: MODEL_USAGE}), null);
  assert.equal(contextUsage({
    usage,
    model: 'claude-sonnet-4-5',
    modelUsage: {'claude-sonnet-4-5': {contextWindow: 0}},
  }), null);
});
