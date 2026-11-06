/* GeoGebra lento (#7 no achado): depois do prazo a barra dizia "não carregou"
   mesmo com o applet pronto depois, e fechar e reabrir no meio deixava o
   "Carregando…" para sempre. A sonda continua em baixa frequência depois do
   prazo até a view sumir (o `ok:true` tardio limpa a falha); a reabertura sem
   applet pronto reinicia a sonda; nada fica vivo depois de destruída. O
   Electron é o falso com nome e o prazo é curto. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {createI18n} from '../src/i18n.mjs';
import ptBR from '../src/locales/pt-BR.json' with {type: 'json'};
import en from '../src/locales/en.json' with {type: 'json'};

const require = createRequire(import.meta.url);
const {createGeogebraHost} = require('../geogebra-host.cjs');
const {FakeGgbApplet} = require('./fixtures/fake-ggb-applet.cjs');
const {createFakeViewClass, createFakeWindow, createFakeIpcMain} = require('./fixtures/fake-ggb-electron.cjs');

const ptTutor = (key, args) => createI18n({catalogs: {'pt-BR': ptBR, en}, language: 'pt-BR'}).t(key, args);
const RECT = {x: 10, y: 40, width: 600, height: 400};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function setup({ready = false, deadline = 120} = {}) {
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), 'ggb-late-'));
  const applet = new FakeGgbApplet();
  const readyFlag = {value: ready};
  const ipcMain = createFakeIpcMain();
  const state = {ggbBase64: ''};
  const window = createFakeWindow(() => {});
  const ViewClass = createFakeViewClass(applet, readyFlag);
  const host = createGeogebraHost({
    WebContentsView: ViewClass, win: () => window, deskState: () => state, courseKey: () => 'Calc',
    persist() {}, runtime, deskDir: runtime, appendLog() {}, tutorT: ptTutor, ggbPage: '/ggb-falso.html', openDeadlineMs: deadline,
    openExternal: () => {}, confirmExternal: () => false,
  });
  host.register(ipcMain);
  const readySends = () => window.sent.filter((entry) => entry.channel === 'ggb-ready').map((entry) => entry.payload.ok);
  const cleanup = () => {
    host.close();
    fs.rmSync(runtime, {recursive: true, force: true});
  };
  return {applet, readyFlag, ipcMain, state, window, host, runtime, cleanup, ViewClass, readySends};
}

async function waitForSends(readySends, count, what) {
  const start = Date.now();
  while (readySends().length < count) {
    if (Date.now() - start > 5000) throw Error(`sem aviso: ${what}`);
    await sleep(20);
  }
  return readySends();
}

test('applet pronto depois do prazo ainda manda ok:true e limpa a falha', async () => {
  const ctx = setup({ready: false, deadline: 120});
  try {
    ctx.ipcMain.invoke('ggb-view', {visible: true, rect: RECT});
    assert.deepEqual(await waitForSends(ctx.readySends, 1, 'a falha do prazo'), [false]);
    ctx.readyFlag.value = true;
    assert.deepEqual(await waitForSends(ctx.readySends, 2, 'o ok tardio'), [false, true]);
  } finally {
    ctx.cleanup();
  }
});

test('reabertura sem applet pronto reinicia a sonda', async () => {
  const ctx = setup({ready: false, deadline: 120});
  try {
    ctx.ipcMain.invoke('ggb-view', {visible: true, rect: RECT});
    assert.deepEqual(await waitForSends(ctx.readySends, 1, 'a falha da primeira abertura'), [false]);
    ctx.ipcMain.invoke('ggb-view', {visible: false});
    ctx.window.sent.length = 0;
    ctx.ipcMain.invoke('ggb-view', {visible: true, rect: RECT});
    assert.deepEqual(await waitForSends(ctx.readySends, 1, 'a falha da reabertura'), [false]);
  } finally {
    ctx.cleanup();
  }
});

test('view destruída não deixa intervalo vivo', async () => {
  const ctx = setup({ready: false, deadline: 120});
  try {
    ctx.ipcMain.invoke('ggb-view', {visible: true, rect: RECT});
    await waitForSends(ctx.readySends, 1, 'a falha do prazo');
    assert.equal(ctx.host.watchAlive(), true, 'a sonda devia seguir em baixa frequência');
    const view = ctx.ViewClass.instances[ctx.ViewClass.instances.length - 1];
    view.webContents.destroyed = true;
    view.webContents.listeners.get('destroyed')?.();
    await sleep(300);
    assert.equal(ctx.host.watchAlive(), false, 'nada podia ficar vivo depois de destruída');
    const count = ctx.readySends().length;
    await sleep(300);
    assert.equal(ctx.readySends().length, count, 'sem aviso depois de destruída');
  } finally {
    ctx.cleanup();
  }
});
