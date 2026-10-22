/* Compactação manual do Claude Code (#58).
 *
 * Casos puros de `claude-compaction.cjs`: texto do pedido, catálogo nativo,
 * classificação de `system/status` e `system/compact_boundary`, e o pedido em
 * voo (`CompactRequest`). Sem I/O, sem rede e sem DOM. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {
  MAX_INSTRUCTIONS, commandText, hasCompactCommand, classifyStatus, classifyBoundary, CompactRequest,
} = require('../src/agents/claude-compaction.cjs');

/* ---------- texto do pedido ---------- */

test('sem instrução o pedido é /compact', () => {
  assert.equal(commandText(undefined), '/compact');
  assert.equal(commandText(''), '/compact');
  assert.equal(commandText('   '), '/compact');
});

test('com instrução o pedido é /compact com o texto aparado', () => {
  assert.equal(commandText('  foque nas fórmulas  '), '/compact foque nas fórmulas');
});

test('a instrução é cortada em MAX_INSTRUCTIONS caracteres', () => {
  const long = 'x'.repeat(MAX_INSTRUCTIONS + 50);
  assert.equal(commandText(long), `/compact ${'x'.repeat(MAX_INSTRUCTIONS)}`);

  const padded = `  ${'y'.repeat(MAX_INSTRUCTIONS + 10)}  `;
  assert.equal(commandText(padded), `/compact ${'y'.repeat(MAX_INSTRUCTIONS)}`, 'corta depois de aparar');
});

test('instrução que não é string vira /compact', () => {
  for (const value of [null, 42, {}, [], true]) {
    assert.equal(commandText(value), '/compact', `${String(value)} não é texto`);
  }
});

/* ---------- catálogo nativo ---------- */

test('o catálogo tem o comando compact quando uma entrada se chama compact', () => {
  assert.equal(hasCompactCommand([{name: 'compact'}]), true);
  assert.equal(hasCompactCommand([{name: 'clear'}, {name: 'compact'}]), true);
});

test('sem o comando (ou com catálogo torto) não há compactação', () => {
  assert.equal(hasCompactCommand([]), false);
  assert.equal(hasCompactCommand([{name: 'clear'}]), false);
  assert.equal(hasCompactCommand([null, {}, {name: 42}]), false);
  assert.equal(hasCompactCommand(null), false);
  assert.equal(hasCompactCommand('compact'), false);
});

/* ---------- resultado no stream ---------- */

test('compact_result success vira sucesso', () => {
  assert.deepEqual(
    classifyStatus({type: 'system', subtype: 'status', status: null, compact_result: 'success'}),
    {status: 'success', error: ''},
  );
});

test('compact_result failed traz o compact_error', () => {
  assert.deepEqual(
    classifyStatus({type: 'system', subtype: 'status', compact_result: 'failed', compact_error: 'contexto cheio'}),
    {status: 'failed', error: 'contexto cheio'},
  );
  assert.deepEqual(
    classifyStatus({type: 'system', subtype: 'status', compact_result: 'failed'}),
    {status: 'failed', error: ''},
    'sem compact_error o texto fica vazio',
  );
});

test('status compacting é o pedido em andamento', () => {
  assert.deepEqual(
    classifyStatus({type: 'system', subtype: 'status', status: 'compacting'}),
    {status: 'compacting', error: ''},
  );
});

test('mensagem de outro subtipo (ou sem resultado) não classifica', () => {
  assert.equal(classifyStatus({type: 'system', subtype: 'compact_boundary', status: 'compacting'}), null);
  assert.equal(classifyStatus({type: 'assistant', subtype: 'status', status: 'compacting'}), null);
  assert.equal(classifyStatus({type: 'system', subtype: 'status', status: 'idle'}), null);
  assert.equal(classifyStatus(null), null);
});

/* ---------- fronteira da compactação ---------- */

test('a fronteira manual lê gatilho e tokens antes/depois', () => {
  assert.deepEqual(
    classifyBoundary({
      type: 'system',
      subtype: 'compact_boundary',
      compact_metadata: {trigger: 'manual', pre_tokens: 900, post_tokens: 120},
    }),
    {trigger: 'manual', preTokens: 900, postTokens: 120},
  );
});

test('a fronteira auto também é lida (o adaptador avisa, não usa os tokens)', () => {
  assert.deepEqual(
    classifyBoundary({
      type: 'system',
      subtype: 'compact_boundary',
      compact_metadata: {trigger: 'auto', pre_tokens: 5000, post_tokens: 400},
    }),
    {trigger: 'auto', preTokens: 5000, postTokens: 400},
  );
});

test('tokens ausentes, zero ou negativos viram 0', () => {
  assert.deepEqual(
    classifyBoundary({type: 'system', subtype: 'compact_boundary', compact_metadata: {trigger: 'manual'}}),
    {trigger: 'manual', preTokens: 0, postTokens: 0},
  );
  assert.deepEqual(
    classifyBoundary({
      type: 'system',
      subtype: 'compact_boundary',
      compact_metadata: {trigger: 'manual', pre_tokens: -10, post_tokens: -1},
    }),
    {trigger: 'manual', preTokens: 0, postTokens: 0},
  );
  assert.deepEqual(
    classifyBoundary({type: 'system', subtype: 'compact_boundary', compact_metadata: {trigger: 'manual', pre_tokens: 0, post_tokens: 0}}),
    {trigger: 'manual', preTokens: 0, postTokens: 0},
  );
});

test('mensagem de outro subtipo não é fronteira', () => {
  assert.equal(classifyBoundary({type: 'system', subtype: 'status'}), null);
  assert.equal(classifyBoundary({type: 'assistant', subtype: 'compact_boundary'}), null);
  assert.equal(classifyBoundary(null), null);
});

/* ---------- pedido em voo ---------- */

test('succeed resolve com os tokens da fronteira e resumo vazio', async () => {
  const request = new CompactRequest({id: 'compact-1', item: {type: 'user'}});
  request.noteBoundary({trigger: 'manual', preTokens: 900, postTokens: 120});
  request.succeed();
  assert.deepEqual(await request.promise, {
    accepted: true,
    compacted: true,
    summary: '',
    tokensBefore: 900,
    tokensAfter: 120,
  });
});

test('fail rejeita com o mesmo erro', async () => {
  const request = new CompactRequest({id: 'compact-2', item: {}});
  const error = new Error('fila fechada');
  request.fail(error);
  await assert.rejects(request.promise, (reason) => reason === error);
});

test('segunda liquidação é ignorada', async () => {
  const succeeded = new CompactRequest({id: 'compact-3', item: {}});
  succeeded.succeed();
  succeeded.fail(new Error('tarde demais'));
  assert.deepEqual(await succeeded.promise, {
    accepted: true,
    compacted: true,
    summary: '',
    tokensBefore: 0,
    tokensAfter: 0,
  });

  const failed = new CompactRequest({id: 'compact-4', item: {}});
  const error = new Error('falhou primeiro');
  failed.fail(error);
  failed.succeed();
  await assert.rejects(failed.promise, (reason) => reason === error);
});

test('arm chama o callback com o próprio pedido quando o prazo vence', async () => {
  const request = new CompactRequest({id: 'compact-5', item: {}, timeoutMs: 20});
  const fired = new Promise((resolve) => request.arm((timedOut) => resolve(timedOut)));
  assert.equal(await fired, request);
  request.succeed();
});

test('arm depois de liquidado não agenda nada', async () => {
  const request = new CompactRequest({id: 'compact-6', item: {}, timeoutMs: 20});
  request.succeed();

  let calls = 0;
  request.arm(() => { calls += 1; });
  assert.equal(request.timer, null);

  await new Promise((resolve) => setTimeout(resolve, 40));
  assert.equal(calls, 0);
});
