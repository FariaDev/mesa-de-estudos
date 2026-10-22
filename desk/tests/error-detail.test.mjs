// O pedaço "o que veio" das mensagens de erro (src/error-detail.mjs, #43 fase 3).
import test from 'node:test';
import assert from 'node:assert/strict';
import {describeReceived, invalidValue, causeArg, causeText} from '../src/error-detail.mjs';
import {message} from '../src/i18n.mjs';

test('describeReceived mostra texto curto e esconde caminho, token e texto longo', () => {
  assert.equal(describeReceived('high'), '"high"');
  assert.equal(describeReceived('/Users/ana/Cálculo/aula.pdf'), 'string(27)');
  assert.equal(describeReceived('C:\\Users\\ana'), 'string(12)');
  assert.equal(describeReceived('a'.repeat(64)), 'string(64)');
  assert.equal(describeReceived('linha\noutra'), 'string(11)');
  assert.equal(describeReceived('text/plain'), '"text/plain"');
  assert.equal(describeReceived('~/notas'), 'string(7)');
});

test('describeReceived resume tipos sem abrir o conteúdo', () => {
  assert.equal(describeReceived(undefined), 'undefined');
  assert.equal(describeReceived(null), 'null');
  assert.equal(describeReceived(3), '3');
  assert.equal(describeReceived(false), 'false');
  assert.equal(describeReceived([1, 2, 3]), 'array(3)');
  assert.equal(describeReceived(() => {}), 'function');
  assert.equal(describeReceived({title: 'x', body: 'segredo'}), '{title, body}');
  assert.equal(describeReceived({a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, g: 7, h: 8}), '{a, b, c, d, e, f, +2}');
  assert.equal(describeReceived({'/Users/ana': 1}), '{?}');
});

test('invalidValue diz campo, valor e formato esperado', () => {
  assert.equal(invalidValue('effort', 'super', 'low|medium|high'), 'effort inválido: recebido "super"; esperado low|medium|high');
});

test('causeText tira a parte pessoal do caminho e mantém o resto', () => {
  assert.equal(causeText(new Error("EACCES: permission denied, open '/Users/ana/Estudos/a.pdf'")), "EACCES: permission denied, open '…/a.pdf'");
  assert.equal(causeText(new Error("ENOENT: rename 'C:\\Users\\ana\\x.tmp' -> 'C:\\Users\\ana\\x'")), "ENOENT: rename '…/x.tmp' -> '…/x'");
  assert.equal(causeText('~/Mesa/desk.log sumiu'), '…/desk.log sumiu');
  assert.equal(causeText(new Error('zip sem desk/package.json')), 'zip sem desk/package.json');
  assert.equal(causeText(undefined), '');
});

test('causeText mantém mensagem marcada; causeArg a achata para entrar como argumento', () => {
  const marked = message('err.claude.controlsTimeout', {ms: 50});
  assert.equal(causeText(new Error(marked)), marked);
  const nested = causeArg(new Error(marked));
  assert.equal(nested, 'err.claude.controlsTimeout ms 50');
  assert.doesNotThrow(() => message('err.claude.controlsApplyFailed', {cause: nested}));
});
