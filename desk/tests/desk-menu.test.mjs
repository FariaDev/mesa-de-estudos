// Atalhos editáveis e menu nativo (#43 fase 2: saíram do main.cjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fakeIpcMain, fakeMenu, fakeWindow} from './fake-electron-shell.mjs';

const require = createRequire(import.meta.url);
const {validAccelerator, normalizeKeymap, createDeskMenu} = require('../desk-menu.cjs');

test('validAccelerator aceita modificadores conhecidos e recusa repetição ou tecla inválida', () => {
  assert.equal(validAccelerator('CmdOrCtrl+Shift+K'), true);
  assert.equal(validAccelerator('F12'), true);
  assert.equal(validAccelerator('Shift+Shift+K'), false);
  assert.equal(validAccelerator('Hyper+K'), false);
  assert.equal(validAccelerator('Ctrl+Alt+Shift+Super+K'), false);
  assert.equal(validAccelerator(''), false);
  assert.equal(validAccelerator(42), false);
});

test('normalizeKeymap só guarda ids do menu, com accelerator válido ou null', () => {
  assert.deepEqual(normalizeKeymap({menu: {help: 'F1', stop: null, inventado: 'F2', check: 'Hyper+C'}}), {help: 'F1', stop: null});
  assert.deepEqual(normalizeKeymap({menu: []}), {});
  assert.deepEqual(normalizeKeymap(null), {});
});

function deskMenu({conferir = true} = {}) {
  const live = {config: {desk: {conferir}}, state: {}, win: fakeWindow(), languageHost: {t: key => key}};
  const menu = fakeMenu();
  const ipcMain = fakeIpcMain();
  const host = createDeskMenu({live, Menu: menu, captureAvailable: () => true});
  host.register(ipcMain);
  return {host, menu, ipcMain, live};
}
const studyItems = menu => menu.template.find(item => item.label === 'chrome.study').submenu;

test('o menu usa o atalho padrão e troca pelo do usuário quando o renderer manda o mapa', async () => {
  const {host, menu, ipcMain} = deskMenu();
  host.buildMenu();
  assert.equal(studyItems(menu).find(item => item.label === 'menu.check').accelerator, 'CmdOrCtrl+Shift+C');
  assert.deepEqual(await ipcMain.invoke('set-keymap', {menu: {check: 'F5', stop: null}}), {ok: true, menu: 2});
  assert.equal(menu.builds, 2, 'set-keymap remonta o menu com a janela aberta');
  assert.equal(studyItems(menu).find(item => item.label === 'menu.check').accelerator, 'F5');
  assert.equal(studyItems(menu).find(item => item.label === 'menu.stop').accelerator, undefined);
});

test('conferir:false tira o Conferir do menu Estudar', () => {
  const {host, menu} = deskMenu({conferir: false});
  host.buildMenu();
  assert.equal(studyItems(menu).some(item => item.label === 'menu.check'), false);
});
