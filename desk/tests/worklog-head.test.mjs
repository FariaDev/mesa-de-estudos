import test from 'node:test';
import assert from 'node:assert/strict';
import {headlineElapsed, headBase, shouldStartOpen} from '../src/worklog-head.mjs';

/* E3 (auditoria rodada 3): turno interrompido com motivo e sem resposta mostra
   o motivo sem clique — o diário começa aberto. Puro (sem DOM): a janela pinta
   a partir daqui (`worklog-view.mjs`). */

const errorStep = (over = {}) => ({
  id: 'erro-1', kind: 'error', status: 'error', startedAt: 1, endedAt: 2,
  text: '', error: 'O OpenCode Zen recusou o modelo grátis nesta sessão (403).',
  results: [], resultText: '', ...over,
});
const failedLog = (over = {}) => ({startedAt: 1, endedAt: 2, reason: 'error', text: '', steps: [errorStep()], ...over});

test('interrompido com motivo e sem resposta começa aberto', () => {
  assert.equal(shouldStartOpen(failedLog()), true);
});

test('com resposta parcial segue recolhido', () => {
  assert.equal(shouldStartOpen(failedLog(), {hasAnswer: true}), false);
  assert.equal(shouldStartOpen(failedLog({text: 'metade da resposta'})), false);
});

test('limite do grátis não abre o diário: o aviso próprio já mostra o motivo', () => {
  assert.equal(shouldStartOpen(failedLog(), {isFreeLimit: true}), false);
});

test('parado pelo aluno ou sem motivo segue recolhido', () => {
  assert.equal(shouldStartOpen(failedLog({reason: 'stopped'})), false);
  assert.equal(shouldStartOpen(failedLog({reason: ''})), false);
});

test('sem passo de erro não há motivo para mostrar', () => {
  assert.equal(shouldStartOpen(failedLog({steps: []})), false);
  assert.equal(shouldStartOpen(failedLog({
    steps: [{id: 'pensar-1', kind: 'thinking', status: 'done', text: 'vou considerar'}],
  })), false);
});

test('cabeça do interrompido continua a mesma', () => {
  assert.equal(headBase({reason: 'error'}, '1s', false), 'Turno interrompido após 1s');
  assert.equal(headlineElapsed({startedAt: 1000, endedAt: 2000}), 1000);
});
