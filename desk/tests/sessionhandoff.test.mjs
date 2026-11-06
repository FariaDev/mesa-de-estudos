/* Passagem de contexto entre sessões (#87): o contrato do artefato
   `sessionhandoff.core.js`. As leis provam o invariante; aqui se confere o que
   o host recebe — elegibilidade, seções, teto, sessão antiga e plano. */
import test from 'node:test';
import assert from 'node:assert/strict';
import core from '../src/generated/sessionhandoff.core.js';

const names = (list) => {
  const out = [];
  for (let node = list; node && node.$ === 'Con'; node = node.tail) out.push(node.head.$);
  return out;
};

test('só troca com origem liquidada, sem incerteza, destino pronto e mesma matéria', () => {
  assert.equal(core.canSwitch(true, false, true, true), true);
  assert.equal(core.canSwitch(false, false, true, true), false);
  assert.equal(core.canSwitch(true, true, true, true), false);
  assert.equal(core.canSwitch(true, false, false, true), false);
  assert.equal(core.canSwitch(true, false, true, false), false);
});

test('teto de 50.000 caracteres recusa o que passa e aceita a borda', () => {
  assert.equal(core.handoffCap(), 50000);
  assert.equal(core.withinCap(0), true);
  assert.equal(core.withinCap(50000), true);
  assert.equal(core.withinCap(50001), false);
});

test('seções obrigatórias: matéria primeiro; questão, materiais e falas quando existem', () => {
  assert.deepEqual(names(core.handoffSections(false, false, false, false)), []);
  assert.deepEqual(names(core.handoffSections(true, false, false, false)), ['HandoffSection.Course']);
  assert.deepEqual(names(core.handoffSections(true, true, true, true)), [
    'HandoffSection.Course',
    'HandoffSection.Exercise',
    'HandoffSection.Materials',
    'HandoffSection.Turns',
  ]);
  assert.deepEqual(names(core.handoffSections(false, false, true, true)), [], 'sem matéria não há destino');
});

test('sessão antiga: Pi e nativo fora da vista continuam; nativo visível não é legado', () => {
  assert.equal(core.canContinueLegacy('pi', false, false), true);
  assert.equal(core.canContinueLegacy('claude', false, true), true);
  assert.equal(core.canContinueLegacy('opencode', true, true), false);
  assert.equal(core.canContinueLegacy('outro', false, false), false);
});
