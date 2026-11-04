import test from 'node:test';
import assert from 'node:assert/strict';
import {createLazyModule} from '../src/lazy-module.mjs';

test('carrega e prepara uma vez, mesmo com dois pedidos simultâneos', async () => {
  let imports = 0;
  let prepares = 0;
  const fake = {initSettings: () => prepares++};
  const lazy = createLazyModule({
    importModule: async () => {
      imports++;
      await new Promise((resolve) => setTimeout(resolve, 5));
      return fake;
    },
    prepare: (module) => module.initSettings(),
  });
  assert.equal(lazy.ready(), false);
  assert.equal(lazy.current(), null);
  const [first, second] = await Promise.all([lazy.load(), lazy.load()]);
  assert.equal(first, fake);
  assert.equal(second, fake);
  assert.equal(imports, 1);
  assert.equal(prepares, 1);
  assert.equal(lazy.ready(), true);
  assert.equal(lazy.current(), fake);
  assert.equal(await lazy.load(), fake);
});

test('falha no import não deixa a promessa presa nem marca pronto', async () => {
  let imports = 0;
  const lazy = createLazyModule({
    importModule: async () => {
      imports++;
      if (imports === 1) throw Error('arquivo faltando');
      return {valor: 2};
    },
  });
  await assert.rejects(lazy.load(), /arquivo faltando/);
  assert.equal(lazy.ready(), false);
  assert.equal(lazy.current(), null);
  assert.deepEqual(await lazy.load(), {valor: 2});
  assert.equal(imports, 2);
});

test('falha no prepare também libera a próxima tentativa', async () => {
  let prepares = 0;
  const lazy = createLazyModule({
    importModule: async () => ({init: () => prepares++}),
    prepare: (module) => {
      module.init();
      if (prepares === 1) throw Error('sem DOM');
    },
  });
  await assert.rejects(lazy.load(), /sem DOM/);
  assert.equal(lazy.ready(), false);
  await lazy.load();
  assert.equal(lazy.ready(), true);
  assert.equal(prepares, 2);
});
