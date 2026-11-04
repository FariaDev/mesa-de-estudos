import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {renameWithWindowsRetry} = require('../json-file.cjs');

/* Fake de rename que falha N vezes com o código pedido antes de dar certo. */
function fakeFlakyRename(failures, code) {
  const fake = {calls: 0, waits: []};
  fake.rename = () => {
    fake.calls += 1;
    if (fake.calls > failures) return;
    throw Object.assign(new Error(`${code}: rename`), {code});
  };
  fake.wait = (ms) => fake.waits.push(ms);
  return fake;
}

const call = (fake, platform) => renameWithWindowsRetry('a.tmp', 'a', {platform, rename: fake.rename, wait: fake.wait});

for (const code of ['EPERM', 'EACCES', 'EBUSY']) {
  test(`rename no Windows repete quando ${code} é passageiro`, () => {
    const fake = fakeFlakyRename(2, code);
    call(fake, 'win32');
    assert.equal(fake.calls, 3);
    assert.deepEqual(fake.waits, [50, 100]);
  });
}

test('rename no Windows desiste e devolve o erro original depois de 8 tentativas', () => {
  const fake = fakeFlakyRename(Infinity, 'EPERM');
  assert.throws(() => call(fake, 'win32'), {code: 'EPERM'});
  assert.equal(fake.calls, 8);
});

test('rename no Windows não repete erro que não passa sozinho', () => {
  const fake = fakeFlakyRename(Infinity, 'ENOENT');
  assert.throws(() => call(fake, 'win32'), {code: 'ENOENT'});
  assert.equal(fake.calls, 1);
});

test('rename fora do Windows sobe EPERM na primeira tentativa', () => {
  for (const platform of ['linux', 'darwin']) {
    const fake = fakeFlakyRename(Infinity, 'EPERM');
    assert.throws(() => call(fake, platform), {code: 'EPERM'});
    assert.equal(fake.calls, 1);
    assert.deepEqual(fake.waits, []);
  }
});
