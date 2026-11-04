import test from 'node:test';
import assert from 'node:assert/strict';
import {createFirstRunBoot, wantsFirstRunScreen} from '../src/first-run-boot.mjs';

const configured = {needsSetup: false, courses: [{id: 'calculo', kind: 'course'}]};
const empty = {needsSetup: false, courses: [{id: 'mesa-free', kind: 'free'}]};

test('a regra da primeira abertura é a mesma do host', () => {
  assert.equal(wantsFirstRunScreen({needsSetup: true, courses: configured.courses}), true);
  assert.equal(wantsFirstRunScreen(empty), true);
  assert.equal(wantsFirstRunScreen({courses: []}), true);
  assert.equal(wantsFirstRunScreen({}), true);
  assert.equal(wantsFirstRunScreen(configured), false);
});

test('quem tem matéria não importa nem monta a primeira abertura', async () => {
  let imports = 0;
  let syncs = 0;
  const boot = createFirstRunBoot({
    importModule: async () => {
      imports++;
      return {syncFirstRun: async () => syncs++, isFirstRun: () => false};
    },
  });
  assert.equal(boot.isActive(), false);
  await boot.prepare(configured);
  assert.equal(imports, 0, 'prepare não importa sem a tela');
  await boot.sync(configured);
  assert.equal(imports, 0);
  assert.equal(syncs, 0);
  assert.equal(boot.isActive(), false);
});

test('a primeira abertura importa e monta uma vez, e depois delega ao módulo', async () => {
  let imports = 0;
  let active = false;
  const calls = [];
  const boot = createFirstRunBoot({
    importModule: async () => {
      imports++;
      return {
        syncFirstRun: async (data, hooks) => {
          calls.push([data, hooks]);
          active = true;
        },
        isFirstRun: () => active,
      };
    },
  });
  const hooks = {createCourse: () => {}};
  await boot.sync(configured, hooks);
  assert.equal(imports, 0, 'com matéria não importa');
  await boot.prepare(empty);
  assert.equal(imports, 1, 'prepare adianta o import da tela');
  await boot.sync(empty);
  assert.equal(imports, 1, 'sync não importa de novo');
  assert.deepEqual(calls, [[empty, hooks]], 'os ganchos do boot valem quando a tela entra depois');
  assert.equal(boot.isActive(), true);
  await boot.sync(configured);
  assert.equal(imports, 1, 'não importa de novo');
  assert.deepEqual(calls[1], [configured, hooks]);
});
