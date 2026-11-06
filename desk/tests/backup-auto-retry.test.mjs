/* Retentativa do backup automático (auditoria de máquinas de estado, §14): o
   agendador marcava `lastAutoAt` ANTES do snapshot, então um snapshot que
   falhava (ou uma queda no meio) calava as próximas tentativas até a próxima
   atividade — a checagem seguinte lia "já rodou depois da última atividade"
   sem snapshot novo. Agora o "já rodou" só é gravado no sucesso, a falha
   tenta de novo no próximo tique e duas tentativas não correm juntas. O
   snapshot é o falso com nome (`fake-backup-snapshot.cjs`); o resto do caminho
   (porta, estado, ledger) é de verdade. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {seedRuntime, tempDir, cleanup} from './study-backup-fixtures.mjs';

const require = createRequire(import.meta.url);
const backup = require('../src/study-data/backup.cjs');
const {FakeBackupSnapshot} = require('./fixtures/fake-backup-snapshot.cjs');

const IDLE = {auto: true, idleMinutes: 30, intervalHours: 24, keep: 3, binaries: 'include'};

test('automático que falha não marca "já rodou": o próximo tique tenta de novo e passa', async () => {
  const fixture = seedRuntime();
  const dest = tempDir('mesa-dest');
  try {
    const base = Date.now();
    const activityAt = base - 31 * 60 * 1000;
    const fake = new FakeBackupSnapshot({failures: 1});
    const takeSnapshot = (args) => fake.take(args);
    const failed = await backup.runAutoBackup({runtime: fixture.runtime, root: dest, settings: IDLE, now: base, activityAt, takeSnapshot});
    assert.equal(failed.ran, true);
    assert.equal(failed.ok, false);
    assert.equal(backup.readAutoState(dest).lastAutoAt, '', 'a falha não podia marcar "já rodou"');
    const soon = backup.shouldAutoBackup({runtime: fixture.runtime, root: dest, settings: IDLE, now: base + 61 * 1000, activityAt});
    assert.equal(soon.due, false, 'falha recente espera antes de tentar outro snapshot inteiro');
    assert.match(soon.why, /falhou há pouco/);
    const later = base + 16 * 60 * 1000;
    const retry = backup.shouldAutoBackup({runtime: fixture.runtime, root: dest, settings: IDLE, now: later, activityAt});
    assert.equal(retry.due, true, 'sem snapshot novo, passada a espera, devia tentar de novo');
    const passed = await backup.runAutoBackup({runtime: fixture.runtime, root: dest, settings: IDLE, now: later, activityAt, takeSnapshot});
    assert.equal(passed.ok, true);
    assert.ok(backup.readAutoState(dest).lastAutoId, 'o sucesso grava qual snapshot vale');
    const calm = backup.shouldAutoBackup({runtime: fixture.runtime, root: dest, settings: IDLE, now: later + 1000, activityAt});
    assert.equal(calm.due, false, 'depois do sucesso, sem laço');
  } finally {
    cleanup(fixture.runtime, dest, fixture.materialsDir, fixture.agentHome);
  }
});

test('duas tentativas para o mesmo destino não correm juntas', async () => {
  const fixture = seedRuntime();
  const dest = tempDir('mesa-dest');
  let release = () => {};
  const held = new Promise((resolve) => { release = resolve; });
  const fake = new FakeBackupSnapshot({failures: 0, waitFor: held});
  try {
    const base = Date.now();
    const activityAt = base - 31 * 60 * 1000;
    const takeSnapshot = (args) => fake.take(args);
    const first = backup.runAutoBackup({runtime: fixture.runtime, root: dest, settings: IDLE, now: base, activityAt, takeSnapshot});
    const start = Date.now();
    while (fake.calls.length < 1 && Date.now() - start < 5000) await new Promise((resolve) => setTimeout(resolve, 5));
    assert.equal(fake.calls.length, 1, 'a primeira tentativa entrou no snapshot');
    const second = await backup.runAutoBackup({runtime: fixture.runtime, root: dest, settings: IDLE, now: base + 1000, activityAt, takeSnapshot});
    assert.equal(second.ran, false);
    assert.match(second.why, /em curso/, 'a segunda volta sem rodar junto');
    release();
    const done = await first;
    assert.equal(done.ok, true);
    assert.equal(fake.calls.length, 1, 'o snapshot correu uma vez só');
  } finally {
    release();
    cleanup(fixture.runtime, dest, fixture.materialsDir, fixture.agentHome);
  }
});

test('destino que não aceita escrita: a falha não rejeita e o freio vale mesmo sem ledger', {skip: process.platform === 'win32' || process.getuid?.() === 0}, async () => {
  const fixture = seedRuntime();
  const dest = tempDir('mesa-dest');
  try {
    const base = Date.now();
    const activityAt = base - 31 * 60 * 1000;
    const fake = new FakeBackupSnapshot({failures: 1});
    fs.chmodSync(dest, 0o555);
    const failed = await backup.runAutoBackup({runtime: fixture.runtime, root: dest, settings: IDLE, now: base, activityAt, takeSnapshot: (args) => fake.take(args)});
    assert.equal(failed.ok, false, 'a falha volta como resultado, sem rejeitar');
    const soon = backup.shouldAutoBackup({runtime: fixture.runtime, root: dest, settings: IDLE, now: base + 61 * 1000, activityAt});
    assert.equal(soon.due, false, 'sem ledger gravável, o freio de 15 min ainda vale');
  } finally {
    fs.chmodSync(dest, 0o755);
    cleanup(fixture.runtime, dest, fixture.materialsDir, fixture.agentHome);
  }
});
