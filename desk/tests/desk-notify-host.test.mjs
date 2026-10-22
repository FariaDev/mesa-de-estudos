// Selo e notificação do sistema (#43 fase 2: saíram do main.cjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import {ptMatches} from './pt-text.mjs';
import {createRequire} from 'node:module';
import {fakeIpcMain, fakeNotificationClass, fakeWindow} from './fake-electron-shell.mjs';

const require = createRequire(import.meta.url);
const {createDeskNotifier} = require('../desk-notify-host.cjs');

function notifier({TEST_MODE = false, focused = false, platform = 'darwin'} = {}) {
  const badges = [];
  const Notification = fakeNotificationClass();
  const live = {win: fakeWindow({focused, minimized: true})};
  const host = createDeskNotifier({app: {setBadgeCount: value => badges.push(value)}, Notification, live, TEST_MODE, platform});
  const ipcMain = fakeIpcMain();
  host.register(ipcMain);
  return {host, ipcMain, badges, Notification, live};
}

test('notify limpa o texto, mostra fora de foco e o clique traz a janela de volta', async () => {
  const {ipcMain, Notification, live} = notifier();
  assert.equal(await ipcMain.invoke('notify', {body: '  pronto \n  para  revisar '}), true);
  const [shown] = Notification.created;
  assert.equal(shown.options.body, 'pronto para revisar');
  assert.equal(shown.shown, true);
  shown.emit('click');
  assert.deepEqual(live.win.calls, ['restore', 'show', 'focus']);
  await assert.rejects(async () => ipcMain.invoke('notify', {body: '   '}), ptMatches(/Pedido inválido em notify: body recebeu "   "/));
});

test('com a janela em foco ou no modo de teste não há notificação', async () => {
  assert.equal(await notifier({focused: true}).ipcMain.invoke('notify', {body: 'x'}), false);
  const quiet = notifier({TEST_MODE: true});
  assert.equal(await quiet.ipcMain.invoke('notify', {body: 'x'}), false);
  assert.equal(quiet.Notification.created.length, 0);
});

test('badge limita entre 0 e 99, recusa valor não numérico e some fora de macOS/Linux', async () => {
  const {ipcMain, badges} = notifier();
  await ipcMain.invoke('badge', 250);
  await ipcMain.invoke('badge', null);
  assert.deepEqual(badges, [99, 0]);
  await assert.rejects(async () => ipcMain.invoke('badge', 'muito'), ptMatches(/badge: value recebeu "muito"; esperado number\|null/));
  const windows = notifier({platform: 'win32'});
  await windows.ipcMain.invoke('badge', 3);
  assert.deepEqual(windows.badges, []);
});
