/* A faixa de esforço do popover de modelo (acabamento da #59): a parte pura do
   teclado, como num grupo de rádios nativo. O resto é provado na janela
   (`model-indicator-ui`, `claude-controls-ui`). */
import test from 'node:test';
import assert from 'node:assert/strict';
import {effortKeyTarget, effortLevelText} from '../src/effort-strip.mjs';
import {readFileSync} from 'node:fs';

const PT_BR = JSON.parse(readFileSync(new URL('../locales/pt-BR.json', import.meta.url), 'utf8'));
/** @param {string} key */
const t = (key) => PT_BR[key] ?? key;

test('effortKeyTarget: ←→ e ↑↓ andam com volta nas pontas', () => {
  assert.equal(effortKeyTarget('ArrowRight', 4, 1), 2);
  assert.equal(effortKeyTarget('ArrowDown', 4, 3), 0, '→ no fim volta ao começo');
  assert.equal(effortKeyTarget('ArrowLeft', 4, 0), 3, '← no começo vai ao fim');
  assert.equal(effortKeyTarget('ArrowUp', 4, 2), 1);
});

test('effortKeyTarget: Home e End vão às pontas; sem nível marcado, parte do primeiro', () => {
  assert.equal(effortKeyTarget('Home', 4, 2), 0);
  assert.equal(effortKeyTarget('End', 4, 0), 3);
  assert.equal(effortKeyTarget('ArrowRight', 4, -1), 1);
});

test('effortKeyTarget: outra tecla ou faixa vazia não anda', () => {
  assert.equal(effortKeyTarget('Enter', 4, 1), -1);
  assert.equal(effortKeyTarget('a', 4, 1), -1);
  assert.equal(effortKeyTarget('ArrowRight', 0, -1), -1);
});

test('effortLevelText: o nível padrão diz o motor certo; motor sem nome fica neutro (#58)', () => {
  assert.equal(effortLevelText('default', 'claude', t), 'Padrão do Claude');
  assert.equal(effortLevelText('default', 'opencode', t), 'Padrão do OpenCode', 'no OpenCode não diz Claude');
  assert.equal(effortLevelText('default', 'pi', t), 'Padrão');
  assert.equal(effortLevelText('high', 'opencode', t), t('effort.high'));
  assert.equal(effortLevelText('turbo', 'claude', t), 'turbo', 'nível desconhecido volta cru');
});
