// Guardas que saíram do main.cjs (#43 fase 2): mutex da aba Livre e navegação.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {createDeskGuards} = require('../desk-guards-host.cjs');

/** Estado vivo mínimo das guardas, no formato do `live` do main. */
function fakeLive() {
  return {courseId: 'calc', freeMutation: false, navInFlight: false, deferredPersist: false,
    freeMutationIdle: Promise.resolve(), releaseFreeMutation: null};
}

test('freeMutate é exclusivo, recusa a segunda e roda o persist adiado no fim', async () => {
  const live = fakeLive();
  let persisted = 0;
  const guards = createDeskGuards({live, FREE_ID: 'mesa-free', persist: () => { persisted++; }, appendLog: () => {}});
  await guards.freeMutate('pdf', async () => {
    assert.throws(() => guards.beginFreeMutation('outra'), /busy|operação|Aguarde|err\./i);
    live.deferredPersist = true;
  });
  assert.equal(live.freeMutation, false);
  assert.equal(persisted, 1);
});

test('activityMutate espera a gravação em curso em vez de falhar', async () => {
  const live = fakeLive();
  const guards = createDeskGuards({live, FREE_ID: 'mesa-free', persist: () => {}, appendLog: () => {}});
  const order = [];
  const first = guards.freeMutate('pdf', async () => { await new Promise((resolve) => setImmediate(resolve)); order.push('pdf'); });
  const second = guards.activityMutate('atividade', async () => { order.push('atividade'); });
  await Promise.all([first, second]);
  assert.deepEqual(order, ['pdf', 'atividade']);
});

test('withHostNav recusa navegação concorrente e libera no fim, mesmo com erro', async () => {
  const live = fakeLive();
  const guards = createDeskGuards({live, FREE_ID: 'mesa-free', persist: () => {}, appendLog: () => {}});
  await assert.rejects(guards.withHostNav(async () => {
    await assert.rejects(guards.withHostNav(async () => {}));
    throw Error('falhou');
  }), /falhou/);
  assert.equal(live.navInFlight, false);
  assert.equal(guards.isFree(), false);
});
