/* Continuar a sessão em outro motor (#87): uma operação por vez e o aviso do
   que fica na origem (D4=A: fila, rascunho e anexos não viajam). Puro, sem janela. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createSessionSwitch, leftBehind} from '../src/session-switch.mjs';

test('dois cliques rápidos criam um destino só', async () => {
  const gate = createSessionSwitch();
  let calls = 0;
  const task = async () => {
    calls++;
    await new Promise((resolve) => setTimeout(resolve, 20));
    return 'destino';
  };
  const first = gate.run(task);
  assert.equal(gate.inFlight, true, 'a troca em voo trava a porta');
  const second = await gate.run(task);
  assert.deepEqual(second, {duplicate: true}, 'o segundo clique em voo não cria outro destino');
  assert.deepEqual(await first, {duplicate: false, value: 'destino'});
  assert.equal(calls, 1);
  assert.equal(gate.inFlight, false, 'a porta abre quando a troca termina');
  assert.deepEqual(await gate.run(task), {duplicate: false, value: 'destino'});
  assert.equal(calls, 2, 'depois de livre, cria de novo');
});

test('a porta abre mesmo quando a troca falha', async () => {
  const gate = createSessionSwitch();
  const failure = await gate.run(async () => { throw Error('host recusou'); }).catch((error) => error);
  assert.match(String(failure && failure.message || failure), /host recusou/);
  assert.equal(gate.inFlight, false);
});

test('leftBehind diz o que ficou na origem', () => {
  assert.deepEqual(leftBehind({}), []);
  assert.deepEqual(leftBehind({queued: 2}), ['queue']);
  assert.deepEqual(leftBehind({draft: 'rascunho'}), ['draft']);
  assert.deepEqual(leftBehind({draft: '   '}), [], 'só espaço não é rascunho');
  assert.deepEqual(leftBehind({attachments: 1}), ['attachments']);
  assert.deepEqual(leftBehind({queued: 1, draft: 'x', attachments: 2}), ['queue', 'draft', 'attachments']);
});
