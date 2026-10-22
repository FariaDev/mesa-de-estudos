import test from 'node:test';
import assert from 'node:assert/strict';
import {menuStep} from '../src/menu-roving.mjs';

/* #67: foco por teclado nos menus Matéria, Estudar e Ajustes. */
test('setas dão a volta; Home e End vão às pontas', () => {
  assert.equal(menuStep('ArrowDown', 0, 3), 1);
  assert.equal(menuStep('ArrowDown', 2, 3), 0);
  assert.equal(menuStep('ArrowUp', 0, 3), 2);
  assert.equal(menuStep('Home', 2, 3), 0);
  assert.equal(menuStep('End', 0, 3), 2);
});

test('com o foco fora do menu, a seta para baixo entra no primeiro e a para cima no último', () => {
  assert.equal(menuStep('ArrowDown', -1, 4), 0);
  assert.equal(menuStep('ArrowUp', -1, 4), 3);
});

test('tecla que não navega e menu vazio devolvem null', () => {
  assert.equal(menuStep('Enter', 0, 3), null);
  assert.equal(menuStep('ArrowDown', -1, 0), null);
});

test('contagem inválida diz o valor recebido', () => {
  assert.throws(() => menuStep('ArrowDown', 0, -1), /count -1, esperado inteiro ≥ 0/);
});
