import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {electronBinaryMissing, ensureElectronBinary} from '../scripts/electron-binary.mjs';

/* Relatório do Mac (2026-10-31): Electron 45 baixa o binário na primeira
   chamada, e N testes em paralelo disparavam N downloads que se atropelavam. */
function electronPackage({pathTxt = 'Electron.app/Contents/MacOS/Electron', binary = false} = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-electron-test-'));
  fs.writeFileSync(path.join(dir, 'install.js'), '');
  if (pathTxt !== null) fs.writeFileSync(path.join(dir, 'path.txt'), pathTxt);
  if (binary) {
    fs.mkdirSync(path.dirname(path.join(dir, 'dist', pathTxt)), {recursive: true});
    fs.writeFileSync(path.join(dir, 'dist', pathTxt), '');
  }
  return dir;
}

/* Download de mentira: grava o binário que o path.txt pede e conta as vezes. */
function fakeInstall(dir, {status = 0, writes = true} = {}) {
  const calls = [];
  const run = (script) => {
    calls.push(script);
    if (writes) {
      const rel = 'electron';
      fs.writeFileSync(path.join(dir, 'path.txt'), rel);
      fs.mkdirSync(path.join(dir, 'dist'), {recursive: true});
      fs.writeFileSync(path.join(dir, 'dist', rel), '');
    }
    return status;
  };
  return {run, calls};
}

test('Electron 45: binário presente não baixa de novo', () => {
  const dir = electronPackage({binary: true});
  const fake = fakeInstall(dir);
  assert.equal(electronBinaryMissing(dir), false);
  assert.equal(ensureElectronBinary({electronDir: dir, run: fake.run}), 'present');
  assert.equal(fake.calls.length, 0);
});

test('Electron 45: sem path.txt ou sem o binário, baixa uma vez', () => {
  for (const dir of [electronPackage({pathTxt: null}), electronPackage({binary: false})]) {
    const fake = fakeInstall(dir);
    assert.equal(electronBinaryMissing(dir), true);
    assert.equal(ensureElectronBinary({electronDir: dir, run: fake.run}), 'downloaded');
    assert.deepEqual(fake.calls, [path.join(dir, 'install.js')]);
    assert.equal(ensureElectronBinary({electronDir: dir, run: fake.run}), 'present', 'a segunda chamada já acha o binário');
  }
});

test('Electron 45: download que falha diz o status em vez de seguir', () => {
  const dir = electronPackage();
  assert.throws(() => ensureElectronBinary({electronDir: dir, run: fakeInstall(dir, {status: 1, writes: false}).run}), /status 1/);
  assert.throws(() => ensureElectronBinary({electronDir: dir, run: fakeInstall(dir, {status: 0, writes: false}).run}), /esperado o binário/);
});

test('Electron 45: sem o pacote não faz nada', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-electron-test-'));
  assert.equal(ensureElectronBinary({electronDir: dir, run: () => assert.fail('não pode baixar')}), 'no-package');
});
