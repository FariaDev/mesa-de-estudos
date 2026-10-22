// "Ver o log" do Sobre (#43 fase 3): o desk.log é JSON por linha; o Sobre abre
// a versão em texto, montada na hora pelo leitor.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fakeIpcMain, fakeShell} from './fake-electron-shell.mjs';
import {logEntryLine} from '../src/log-entry.mjs';

const require = createRequire(import.meta.url);
const {registerUpdateHost} = require('../update-host.cjs');

const toolHostStub = {state: () => ({}), persist: () => {}, isBusy: () => false, hasBridge: () => false, relink: () => {}};

function hostWith(runtime) {
  const ipcMain = fakeIpcMain();
  const shell = fakeShell();
  registerUpdateHost({
    ipcMain, shell, runtime, deskDir: runtime, logFile: path.join(runtime, 'desk.log'), testMode: false,
    app: {getVersion: () => '0.5.0'}, config: () => ({}), win: () => null, piBinary: () => '', appendLog: () => {}, toolHost: toolHostStub,
  });
  return {ipcMain, shell};
}

test('open-log abre o desk-legivel.log com o log em texto, não o JSON', async () => {
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-open-log-'));
  try {
    fs.writeFileSync(path.join(runtime, 'desk.log'), logEntryLine({area: 'update', msg: 'rollback aplicado', level: 'error', fields: {version: '0.5.1'}, now: new Date('2026-10-19T14:03:22.120Z')}));
    const {ipcMain, shell} = hostWith(runtime);
    await ipcMain.invoke('open-log');
    const readable = path.join(runtime, 'desk-legivel.log');
    assert.deepEqual(shell.opened, [readable]);
    assert.equal(fs.readFileSync(readable, 'utf8'), '2026-10-19 14:03:22Z ERROR [update] rollback aplicado (version=0.5.1)\n');
  } finally {
    fs.rmSync(runtime, {recursive: true, force: true});
  }
});
