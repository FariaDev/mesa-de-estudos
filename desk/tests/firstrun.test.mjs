import test from 'node:test';
import assert from 'node:assert/strict';
import firstRun from '../src/generated/firstrun.core.js';

/* Núcleo da primeira abertura (#21, #64): desde a #64 só a invariante de
   domínio mora no Bend (ADR 0001). Os passos e os textos da tela cheia são
   testados em `setup-flow.test.mjs`. */

test('sem nome e sem pasta falta tudo; com os dois não falta nada', () => {
  assert.equal(firstRun.missing('', ''), 'both');
  assert.equal(firstRun.missing('   ', '  '), 'both');
  assert.equal(firstRun.missing('Cálculo I', ''), 'folder');
  assert.equal(firstRun.missing('', '/pdfs/calculo'), 'name');
  assert.equal(firstRun.missing('  ', '/pdfs/calculo'), 'name');
  assert.equal(firstRun.missing('Cálculo I', '/pdfs/calculo'), '');
});

test('só cria a matéria com nome e pasta', () => {
  assert.equal(firstRun.canCreate('Cálculo I', '/pdfs/calculo'), true);
  assert.equal(firstRun.canCreate('Cálculo I', ''), false);
  assert.equal(firstRun.canCreate('', '/pdfs/calculo'), false);
  assert.equal(firstRun.canCreate('  ', '  '), false);
});

test('o id da matéria segue a regra das Configurações: o nome, ou a pasta sem nome', () => {
  assert.equal(firstRun.courseId('Cálculo I', '/pdfs/calculo'), 'Cálculo I');
  assert.equal(firstRun.courseId('  Cálculo I  ', '/pdfs/calculo'), 'Cálculo I');
  assert.equal(firstRun.courseId('', '/pdfs/Física'), 'Física');
});

test('sem configuração é "setup"; pasta de dados válida sem matéria é "empty"; com matéria, nunca', () => {
  assert.equal(firstRun.entry(true, false), 'setup');
  assert.equal(firstRun.entry(false, false), 'empty');
  assert.equal(firstRun.entry(false, true), '');
  assert.equal(firstRun.entry(true, true), '', 'matéria vence qualquer outro fato');
});

test('criar a matéria no "empty" não confirma a pasta de dados; no "setup" confirma', () => {
  assert.equal(firstRun.dataToConfirm('empty', '/dados'), '');
  assert.equal(firstRun.dataToConfirm('setup', '/dados'), '/dados');
});

test('o núcleo de interface antigo saiu (#64): sem folha, sem rótulos e sem a árvore do tutor', () => {
  for (const gone of ['sheet', 'tutorView', 'composerHint', 'nameLabel', 'freeModelsButton']) {
    assert.equal(firstRun[gone], undefined, `${gone} devia ter saído do núcleo`);
  }
});
