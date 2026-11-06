import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {restoreConfiguration} = require('../src/study-data/restore-config.cjs');

/* Restauração do config: `stripExecutableLike` apagava qualquer `*Path`
   desconhecido (inclusive extra do usuário); o rollback não repunha o modo do
   arquivo; e com o config existente ilegível o hostil ficava no disco. Agora só
   `piPath` sai, o modo volta no rollback e sem os bytes de antes nada é
   restaurado (sem chamar o `restoreExternal`). */

function tempDir(tag) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `${tag}-`));
}

function cleanup(...dirs) {
  for (const dir of dirs) {
    try {
      fs.rmSync(dir, {recursive: true, force: true});
    } catch {}
  }
}

const BEFORE = {
  vaultPath: '',
  runtimePath: '',
  claudePath: '/opt/claude-seguro',
  xournalPath: '/Applications/Xournal++.app',
  opencodePath: '/opt/opencode-seguro',
  piPath: '',
  courses: [],
};

function mockServices({storedFile, target, failCopy = false, spy = null}) {
  const entry = {ref: 'mesa-config.json', authorized: true, stored: storedFile};
  return {
    externalPlan: () => [entry],
    restoreExternal: (_result, {ref, apply}) => {
      if (spy) spy.calls.push({ref, apply});
      assert.equal(ref, 'mesa-config.json');
      if (!apply) return {ok: true};
      if (failCopy) throw Error('falha simulada na cópia');
      fs.copyFileSync(storedFile, target);
      return {ok: true, ref, target, action: 'restored', backupOf: ''};
    },
  };
}

test('extra *Path do usuário sobrevive; piPath sai; executável fica com o salvo', () => {
  const dir = tempDir('mesa-restore-extra');
  const configFile = path.join(dir, 'config.json');
  const materials = path.join(dir, 'mat');
  fs.mkdirSync(materials);
  try {
    fs.writeFileSync(configFile, JSON.stringify({...BEFORE, libraryPath: '/home/ana/minha-biblioteca'}));
    const result = {materialsRemapped: [{courseId: 'calc', to: materials}]};
    restoreConfiguration({configFile, runtime: dir, result, services: {}});
    const disk = JSON.parse(fs.readFileSync(configFile, 'utf8'));
    assert.equal(disk.libraryPath, '/home/ana/minha-biblioteca', 'extra do usuário apagado');
    assert.ok(!('piPath' in disk), 'piPath devia sair');
    assert.equal(disk.claudePath, '/opt/claude-seguro');
  } finally {
    cleanup(dir);
  }
});

test('rollback repõe os bytes e o modo do arquivo', () => {
  const dir = tempDir('mesa-restore-mode');
  const configFile = path.join(dir, 'config.json');
  const stored = path.join(dir, 'stored.json');
  try {
    fs.writeFileSync(configFile, JSON.stringify(BEFORE), {mode: 0o600});
    fs.chmodSync(configFile, 0o600);
    fs.writeFileSync(stored, JSON.stringify({...BEFORE, claudePath: '/tmp/evil'}), {mode: 0o644});
    const services = mockServices({storedFile: stored, target: configFile});
    const realRename = fs.renameSync;
    fs.renameSync = (from, to) => {
      if (String(to) === configFile && String(from).endsWith('.tmp')) throw Error('rename falhou');
      return realRename(from, to);
    };
    let warnings;
    try {
      const result = {restoreConfig: true};
      restoreConfiguration({configFile, runtime: dir, result, services});
      warnings = result.restoreWarnings;
    } finally {
      fs.renameSync = realRename;
    }
    assert.ok((warnings || []).join(' ').includes('Não foi possível atualizar'), 'aviso do rollback');
    assert.equal(fs.statSync(configFile).mode & 0o777, 0o600, 'modo não voltou');
    assert.equal(JSON.parse(fs.readFileSync(configFile, 'utf8')).claudePath, '/opt/claude-seguro', 'bytes não voltaram');
  } finally {
    cleanup(dir);
  }
});

test('config existente ilegível: não restaura nem chama o restoreExternal', () => {
  const dir = tempDir('mesa-restore-unreadable');
  const configFile = path.join(dir, 'config.json');
  const stored = path.join(dir, 'stored.json');
  try {
    /* Pasta no lugar do arquivo: existe, mas não dá para ler os bytes. */
    fs.mkdirSync(configFile);
    fs.writeFileSync(stored, JSON.stringify({...BEFORE, claudePath: '/tmp/evil'}));
    const spy = {calls: []};
    const services = mockServices({storedFile: stored, target: configFile, spy});
    const result = {restoreConfig: true};
    restoreConfiguration({configFile, runtime: dir, result, services});
    assert.deepEqual(spy.calls, [], 'restoreExternal não podia ser chamado');
    assert.ok((result.restoreWarnings || []).join(' ').includes('ilegíveis'), 'aviso devia dizer que nada foi restaurado');
    assert.ok(fs.statSync(configFile).isDirectory(), 'hostil não podia ficar no disco');
  } finally {
    cleanup(dir);
  }
});
