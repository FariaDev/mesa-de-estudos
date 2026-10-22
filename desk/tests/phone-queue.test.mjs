import test from 'node:test';
import assert from 'node:assert/strict';
import {createPhoneQueue} from '../src/phone-queue.mjs';

/* Entrega com tempo próprio por item: a primeira foto (JPEG girada) demora, a segunda (PNG pequena) é rápida. */
function fakeAttach(delays) {
  const order = [];
  const run = (item) => new Promise((resolve) => setTimeout(() => { order.push(item); resolve(); }, delays[item]));
  return {order, run};
}

test('regressão #66: a foto rápida que chega depois não passa na frente da lenta', async () => {
  const {order, run} = fakeAttach({jpeg: 30, png: 1});
  const queue = createPhoneQueue({run});
  const first = queue.push('jpeg');
  queue.push('png');
  await first;
  assert.deepEqual(order, ['jpeg', 'png']);
  assert.equal(queue.size(), 0);
});

test('enquanto não pode entregar, guarda; o release entrega na ordem', async () => {
  const {order, run} = fakeAttach({a: 1, b: 1});
  let busy = true;
  const queue = createPhoneQueue({run, canRun: () => !busy});
  await queue.push('a');
  await queue.push('b');
  assert.deepEqual(order, []);
  assert.equal(queue.size(), 2);
  busy = false;
  await queue.release();
  assert.deepEqual(order, ['a', 'b']);
});

test('depois de esvaziar, um item novo volta a ser entregue', async () => {
  const {order, run} = fakeAttach({a: 1, b: 1});
  const queue = createPhoneQueue({run});
  await queue.push('a');
  await queue.push('b');
  assert.deepEqual(order, ['a', 'b']);
});
