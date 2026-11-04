import test from 'node:test';
import assert from 'node:assert/strict';
import {steerQueuedOutcome, restoreQueuedAt} from '../src/queue-steer.mjs';

/* Destino de um item da fila enviado como steer: aceite sai de vez; recusa
   provada volta à posição; entrega incerta NÃO volta (reenviar duplicaria a
   fala) e a fila fica segurada. O `queue.mjs` usa estas duas decisões puras. */

test('aceite não devolve o item à fila', () => {
  assert.equal(steerQueuedOutcome(true, true), 'delivered');
  assert.equal(steerQueuedOutcome(true, false), 'delivered');
});

test('recusa provada devolve; entrega incerta não volta', () => {
  assert.equal(steerQueuedOutcome(false, true), 'restore');
  assert.equal(steerQueuedOutcome(false, false), 'hold');
});

test('o item volta à posição original da fila', () => {
  const queue = [{id: 'a'}, {id: 'b'}, {id: 'c'}];
  const [item] = queue.splice(1, 1);
  assert.equal(restoreQueuedAt(queue, item, 1), 1);
  assert.deepEqual(queue.map((entry) => entry.id), ['a', 'b', 'c']);
});

test('posição guardada maior que a fila de agora entra no fim, sem buraco', () => {
  const queue = [{id: 'a'}];
  assert.equal(restoreQueuedAt(queue, {id: 'b'}, 7), 1);
  assert.deepEqual(queue.map((entry) => entry.id), ['a', 'b']);
  assert.equal(restoreQueuedAt(queue, {id: 'c'}, -2), 0);
  assert.deepEqual(queue.map((entry) => entry.id), ['c', 'a', 'b']);
});
