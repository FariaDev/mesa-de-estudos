/* Dono da operação em voo da aba Livre (§16): `freeState.inflight` era uma
   string limpa no `finally` de qualquer operação — a antiga, terminando depois
   de trocar de aba/workspace e de uma nova começar, zerava o lock da nova e
   duas mutações corriam juntas (`free-study.mjs:137`, `:168`,
   `free-study-pdf.mjs:484`). O dono agora é um token `{name,generation}` e o
   fim só limpa se ainda for o token corrente.
   Rodar: node --test --test-force-exit tests/free-inflight.test.mjs */
import test from 'node:test';
import assert from 'node:assert/strict';
import {installDom} from './dom-shim.mjs';

installDom();
const {freeState, beginFreeInflight, endFreeInflight} = await import('../src/free-study-base.mjs');

function resetFlight() {
  freeState.generation = 0;
  freeState.inflight = '';
}

test('operação antiga termina depois da nova sem liberar a nova', () => {
  resetFlight();
  const old = beginFreeInflight('promote');
  assert.ok(old, 'a primeira operação ocupa');
  /* Troca de aba/workspace: `receive()` incrementa a geração e o resultado da
     antiga passa a ser descartado — o lock dela morreu com o escopo. */
  freeState.generation += 1;
  const current = beginFreeInflight('pdf-save');
  assert.ok(current, 'a nova toma o lock do dono morto');
  assert.notEqual(current, old);
  endFreeInflight(old);
  assert.equal(freeState.inflight, current, 'o fim da antiga não libera a nova');
  endFreeInflight(current);
  assert.equal(freeState.inflight, '', 'o fim da corrente libera');
});

test('segunda operação na mesma geração é recusada', () => {
  resetFlight();
  const first = beginFreeInflight('promote');
  assert.ok(first);
  assert.equal(beginFreeInflight('pdf-save'), null, 'ocupado na geração corrente recusa');
  assert.equal(freeState.inflight, first, 'o dono segue sendo o primeiro');
  endFreeInflight(first);
  assert.equal(freeState.inflight, '');
});

test('só o token corrente limpa; token estranho mantém', () => {
  resetFlight();
  const token = beginFreeInflight('free-open');
  endFreeInflight({name: 'free-open', generation: 0});
  assert.equal(freeState.inflight, token, 'objeto igual mas não idêntico não limpa');
  endFreeInflight(null);
  assert.equal(freeState.inflight, token, 'sem token não limpa');
  endFreeInflight(token);
  assert.equal(freeState.inflight, '');
});

test('o token carrega nome e geração para os guards de diálogo', () => {
  resetFlight();
  const token = beginFreeInflight('promote');
  assert.equal(token.name, 'promote');
  assert.equal(token.generation, freeState.generation);
  endFreeInflight(token);
});

test('o fim da antiga diz que não pode limpar a interface da nova', () => {
  resetFlight();
  const old = beginFreeInflight('pdf-save');
  freeState.generation += 1;
  const current = beginFreeInflight('pdf-save');
  assert.equal(endFreeInflight(old), false, 'a nova está ocupada: a antiga não reabilita campos');
  assert.equal(endFreeInflight(current), true, 'o fim da corrente libera a interface');
});
