import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fakeIpcMain, fakeShell} from './fake-electron-shell.mjs';

/* Trava anti-rollback no clique "Atualizar" (auditoria de segurança): o
   `update-apply` recusa antes de abrir o worker quando a versão do cache não é
   mais nova que a instalada — metadado público marcando versão assinada antiga
   como `latest` não instala. O lock fica preso de propósito: sem a trava, o
   clique passaria e cairia no lock (ou abriria o worker de verdade); com ela,
   a recusa vem antes. */
const require = createRequire(import.meta.url);
const {registerUpdateHost} = require('../update-host.cjs');
const updater = require('../updater.cjs');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-apply-guard-'));

function hostWith({runtime, installed}) {
 const ipcMain = fakeIpcMain();
 registerUpdateHost({
  ipcMain, shell: fakeShell(), runtime, deskDir: runtime, logFile: path.join(runtime, 'desk.log'), testMode: false,
  app: {isPackaged: true, getVersion: () => installed}, config: () => ({}), win: () => null,
  appendLog: () => {}, toolHost: {state: () => ({}), persist: () => {}, isBusy: () => false, hasBridge: () => false, relink: () => {}},
 });
 return ipcMain;
}

async function refusedWith({cached, installed}) {
 const runtime = tmp();
 updater.writeCache(path.join(runtime, 'update.json'), {release: {at: Date.now(), version: cached, notes: '', url: ''}});
 const held = updater.acquireLock(runtime);
 assert.equal(held.ok, true);
 try {
  const ipcMain = hostWith({runtime, installed});
  return await ipcMain.invoke('update-apply').then(() => assert.fail('devia recusar'), (error) => error);
 } finally {
  held.release();
 }
}

test('update-apply recusa versão do cache mais velha, citando as duas versões', async () => {
 const error = await refusedWith({cached: '1.0.0', installed: '1.1.0'});
 assert.match(error.message, /err\.update\.notNewer/);
 assert.match(error.message, /1\.0\.0/, 'cita a anunciada');
 assert.match(error.message, /1\.1\.0/, 'cita a instalada');
});

test('update-apply recusa versão do cache igual à instalada', async () => {
 const error = await refusedWith({cached: '1.1.0', installed: '1.1.0'});
 assert.match(error.message, /err\.update\.notNewer/);
});
