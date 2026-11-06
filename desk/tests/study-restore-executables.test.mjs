import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {restoreConfiguration} = require('../src/study-data/restore-config.cjs');

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
  courses: [{id: 'mat-1', name: 'Algebra', path: '/materias/algebra'}],
};

const HOSTILE = {
  vaultPath: '',
  runtimePath: '',
  claudePath: '/tmp/evil-claude',
  xournalPath: '/tmp/evil.sh',
  opencodePath: '/tmp/evil-opencode',
  piPath: '/tmp/evil-pi',
  courses: [{id: 'mat-1', name: 'Algebra Hostil', path: '/tmp/evil-mat'}],
};

function mockServices({storedFile, writer}) {
  const entry = {ref: 'mesa-config.json', authorized: true, stored: storedFile};
  return {
    externalPlan: () => [entry],
    restoreExternal: (_result, {ref, apply}) => {
      assert.equal(ref, 'mesa-config.json');
      if (!apply) return {ok: true};
      const target = writer.target;
      if (writer.failCopy) throw Error('falha simulada na cópia');
      fs.mkdirSync(path.dirname(target), {recursive: true});
      fs.copyFileSync(storedFile, target);
      return {ok: true, ref, target, action: 'restored', backupOf: ''};
    },
  };
}

test('restauração com snapshot hostil preserva os executáveis de antes', () => {
  const dir = tempDir('mesa-restore-exec');
  const configFile = path.join(dir, 'config.json');
  const runtime = tempDir('mesa-rt-exec');
  const storedDir = tempDir('mesa-stored-exec');
  const storedFile = path.join(storedDir, 'mesa-config.json');
  const matDir = tempDir('mesa-mat-nova');
  try {
    fs.writeFileSync(configFile, `${JSON.stringify(BEFORE, null, 2)}\n`);
    fs.writeFileSync(storedFile, `${JSON.stringify(HOSTILE, null, 2)}\n`);
    const services = mockServices({storedFile, writer: {target: configFile}});
    const result = {
      restoreConfig: true,
      materialsRemapped: [{courseId: 'mat-1', name: 'Algebra', to: matDir}],
    };
    const config = restoreConfiguration({configFile, runtime, result, services});
    assert.equal(config.claudePath, BEFORE.claudePath);
    assert.equal(config.xournalPath, BEFORE.xournalPath);
    assert.equal(config.opencodePath, BEFORE.opencodePath);
    assert.notEqual(config.claudePath, HOSTILE.claudePath);
    const disk = JSON.parse(fs.readFileSync(configFile, 'utf8'));
    assert.equal(disk.claudePath, BEFORE.claudePath);
    assert.equal(disk.xournalPath, BEFORE.xournalPath);
    assert.equal(disk.opencodePath, BEFORE.opencodePath);
    assert.equal(disk.piPath, undefined, 'piPath hostil sai do arquivo');
    assert.ok(!JSON.stringify(disk).includes('/tmp/evil'), 'nenhum caminho hostil no disco');
    assert.equal(disk.courses.find((course) => course.id === 'mat-1').path, matDir, 'matéria continua remapeada como hoje');
  } finally {
    cleanup(dir, runtime, storedDir, matDir);
  }
});

test('restauração preserva vazio anterior nos executáveis', () => {
  const dir = tempDir('mesa-restore-exec');
  const configFile = path.join(dir, 'config.json');
  const runtime = tempDir('mesa-rt-exec');
  const storedDir = tempDir('mesa-stored-exec');
  const storedFile = path.join(storedDir, 'mesa-config.json');
  try {
    const empty = {...BEFORE, claudePath: '', xournalPath: '', opencodePath: ''};
    fs.writeFileSync(configFile, `${JSON.stringify(empty, null, 2)}\n`);
    fs.writeFileSync(storedFile, `${JSON.stringify(HOSTILE, null, 2)}\n`);
    const services = mockServices({storedFile, writer: {target: configFile}});
    const config = restoreConfiguration({configFile, runtime, result: {restoreConfig: true}, services});
    assert.equal(config.claudePath, '');
    assert.equal(config.xournalPath, '');
    assert.equal(config.opencodePath, '');
    const disk = JSON.parse(fs.readFileSync(configFile, 'utf8'));
    assert.equal(disk.claudePath, '');
    assert.equal(disk.xournalPath, '');
    assert.equal(disk.opencodePath, '');
  } finally {
    cleanup(dir, runtime, storedDir);
  }
});

test('falha ao gravar o arquivo depois do restoreExternal não deixa o hostil no disco', () => {
  const dir = tempDir('mesa-restore-exec');
  const configFile = path.join(dir, 'config.json');
  const runtime = tempDir('mesa-rt-exec');
  const storedDir = tempDir('mesa-stored-exec');
  const storedFile = path.join(storedDir, 'mesa-config.json');
  const realWrite = fs.writeFileSync;
  try {
    fs.writeFileSync(configFile, `${JSON.stringify(BEFORE, null, 2)}\n`);
    fs.writeFileSync(storedFile, `${JSON.stringify(HOSTILE, null, 2)}\n`);
    const services = mockServices({storedFile, writer: {target: configFile}});
    let writes = 0;
    fs.writeFileSync = (...args) => {
      writes++;
      // A gravação do merged usa temp+rename: só ela falha. O rollback
      // (restaura os bytes de antes) tem de conseguir gravar.
      if (String(args[0]).endsWith('.tmp')) {
        throw Error('disco cheio (simulado)');
      }
      return realWrite(...args);
    };
    const result = {restoreConfig: true};
    const config = restoreConfiguration({configFile, runtime, result, services});
    assert.ok(Array.isArray(result.restoreWarnings) && result.restoreWarnings.length > 0);
    const disk = JSON.parse(realWrite && fs.readFileSync(configFile, 'utf8'));
    assert.ok(!JSON.stringify(disk).includes('/tmp/evil'), 'hostil não fica no disco quando a gravação falha');
    assert.equal(writes > 0, true);
    assert.equal(config.claudePath, BEFORE.claudePath);
  } finally {
    fs.writeFileSync = realWrite;
    cleanup(dir, runtime, storedDir);
  }
});
