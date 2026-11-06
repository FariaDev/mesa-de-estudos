/* Botão de citar com rect zerado (Mac rodada 4b): a seleção sobrevive mas o
   `content-visibility` ainda não materializou o conteúdo, então o retângulo
   vem zerado 120 ms depois do `selectionchange`. O produto retenta (até 4
   vezes, de 80 ms) antes de esconder; sem texto ou fora da vista, esconde. */
import assert from 'node:assert/strict';
import test from 'node:test';
import {installDom} from './dom-shim.mjs';

installDom();
const {quoteButtonDecision} = await import('../src/chat-quote.mjs');

test('com texto e rect zerado, retenta até 4 vezes', () => {
  const zero = {width: 0, height: 0, top: 100, bottom: 100};
  assert.deepEqual(quoteButtonDecision({hasText: true, rect: zero, tries: 0, viewportHeight: 800}), {action: 'retry'});
  assert.deepEqual(quoteButtonDecision({hasText: true, rect: zero, tries: 3, viewportHeight: 800}), {action: 'retry'});
});

test('com texto e rect zerado na 5ª vez, esconde', () => {
  const zero = {width: 0, height: 0, top: 100, bottom: 100};
  assert.deepEqual(quoteButtonDecision({hasText: true, rect: zero, tries: 4, viewportHeight: 800}), {action: 'hide'});
});

test('sem rect (sem range), retenta como zerado', () => {
  assert.deepEqual(quoteButtonDecision({hasText: true, rect: null, tries: 0, viewportHeight: 800}), {action: 'retry'});
});

test('sem texto, esconde sem gastar tentativa', () => {
  const zero = {width: 0, height: 0, top: 100, bottom: 100};
  assert.deepEqual(quoteButtonDecision({hasText: false, rect: zero, tries: 0, viewportHeight: 800}), {action: 'hide'});
});

test('rect fora da vista, esconde sem retentar', () => {
  assert.deepEqual(quoteButtonDecision({hasText: true, rect: {width: 10, height: 10, top: -20, bottom: -10}, tries: 0, viewportHeight: 800}), {action: 'hide'});
  assert.deepEqual(quoteButtonDecision({hasText: true, rect: {width: 10, height: 10, top: 801, bottom: 811}, tries: 0, viewportHeight: 800}), {action: 'hide'});
});

test('rect válido, mostra', () => {
  assert.deepEqual(quoteButtonDecision({hasText: true, rect: {width: 10, height: 10, top: 100, bottom: 110}, tries: 2, viewportHeight: 800}), {action: 'show'});
});
