/* Restauração que falha tenta de novo na próxima abertura (auditoria de
   máquinas de estado, §9): o host marcava `ggbRestored=true` ANTES de o
   `executeJavaScript` resolver; se o applet não respondeu ou devolveu
   `false`, a próxima abertura via `early return` e a construção salva nunca
   era reaplicada até recarregar o documento. Agora a marca só acontece no
   sucesso; a falha deixa a porta aberta para a próxima oportunidade natural
   (reabertura ou `ggb-ready`), sem laço. O Electron é o falso com nome e o
   applet responde `false` na 1ª vez e aplica na 2ª. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {pollUntil} from './waits.mjs';
import {createI18n} from '../src/i18n.mjs';
import ptBR from '../src/locales/pt-BR.json' with {type: 'json'};
import en from '../src/locales/en.json' with {type: 'json'};

const require = createRequire(import.meta.url);
const {createGeogebraHost} = require('../geogebra-host.cjs');
const {FakeGgbApplet} = require('./fixtures/fake-ggb-applet.cjs');
const {createFakeViewClass, createFakeWindow, createFakeIpcMain} = require('./fixtures/fake-ggb-electron.cjs');

const ptTutor = (key, args) => createI18n({catalogs: {'pt-BR': ptBR, en}, language: 'pt-BR'}).t(key, args);
const RECT = {x: 10, y: 40, width: 600, height: 400};

/** Applet que falha na 1ª restauração (como o applet ainda carregando) e
 *  aplica da 2ª em diante, sem inventar protocolo novo. */
class FlakyRestoreApplet extends FakeGgbApplet {
  constructor() {
    super();
    this.restoreCalls = 0;
    this.desired = new FakeGgbApplet();
    this.desired.evalCommand('aluno=(1,2)');
  }

  setBase64() {
    this.restoreCalls += 1;
    if (this.restoreCalls === 1) throw Error('applet ainda carregando (fake)');
    super.setBase64(this.desired.getBase64());
  }
}

test('restauração que falha na 1ª vez é tentada de novo e vale na 2ª, sem recarregar', async (t) => {
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), 'ggb-retry-'));
  t.after(() => { fs.rmSync(runtime, {recursive: true, force: true}); });
  const applet = new FlakyRestoreApplet();
  const readyFlag = {value: true};
  const ipcMain = createFakeIpcMain();
  const state = {ggbBase64: applet.desired.getBase64()};
  const window = createFakeWindow(() => {});
  const ViewClass = createFakeViewClass(applet, readyFlag);
  const logged = [];
  const host = createGeogebraHost({
    WebContentsView: ViewClass, win: () => window, deskState: () => state, courseKey: () => 'Calc',
    persist() {}, runtime, appendLog: (scope, line) => logged.push([scope, line]), tutorT: ptTutor,
    ggbPage: '/ggb-falso.html', openDeadlineMs: 400,
    openExternal: () => {}, confirmExternal: () => false,
  });
  t.after(() => host.close());
  host.register(ipcMain);

  /* 1ª abertura: o snapshot tenta entrar e o applet falha, como quando ele
     ainda está carregando. */
  await ipcMain.invoke('ggb-view', {visible: true, rect: RECT});
  for (let waited = 0; applet.restoreCalls < 1 && waited < 200; waited += 1) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.equal(applet.restoreCalls, 1, 'a 1ª abertura tentou restaurar');
  assert.deepEqual([...applet.objects.keys()], [], 'nada aplicado na falha');
  const count = ViewClass.instances.length;

  /* Fecha e abre de novo, sem recarregar o documento nem trocar de matéria:
     a próxima oportunidade natural tenta outra vez e aplica. */
  await ipcMain.invoke('ggb-view', {visible: false});
  await ipcMain.invoke('ggb-view', {visible: true, rect: RECT});
  for (let waited = 0; applet.restoreCalls < 2 && waited < 200; waited += 1) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.equal(applet.restoreCalls, 2, 'a reabertura tentou de novo');
  assert.deepEqual([...applet.objects.keys()], ['aluno'], 'a 2ª tentativa aplicou a construção salva');
  assert.equal(ViewClass.instances.length, count, 'sem recarga no meio');
});

/** Applet que conta as restaurações e aplica todas. */
class CountingRestoreApplet extends FakeGgbApplet {
  constructor() {
    super();
    this.restoreCalls = 0;
    this.desired = new FakeGgbApplet();
    this.desired.evalCommand('aluno=(1,2)');
  }

  setBase64() {
    this.restoreCalls += 1;
    super.setBase64(this.desired.getBase64());
  }
}

test('reabrir enquanto a restauração espera o applet não dispara uma segunda', async (t) => {
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), 'ggb-retry-'));
  t.after(() => { fs.rmSync(runtime, {recursive: true, force: true}); });
  const applet = new CountingRestoreApplet();
  const readyFlag = {value: false};
  const ipcMain = createFakeIpcMain();
  const state = {ggbBase64: applet.desired.getBase64()};
  const window = createFakeWindow(() => {});
  const ViewClass = createFakeViewClass(applet, readyFlag);
  const host = createGeogebraHost({
    WebContentsView: ViewClass, win: () => window, deskState: () => state, courseKey: () => 'Calc',
    persist() {}, runtime, appendLog: () => {}, tutorT: ptTutor,
    ggbPage: '/ggb-falso.html', openDeadlineMs: 50,
    openExternal: () => {}, confirmExternal: () => false,
  });
  t.after(() => host.close());
  host.register(ipcMain);

  /* O applet ainda carrega: a 1ª restauração fica esperando `__ggbReady`. */
  await ipcMain.invoke('ggb-view', {visible: true, rect: RECT});
  await new Promise((resolve) => setTimeout(resolve, 60));
  await ipcMain.invoke('ggb-view', {visible: false});
  await ipcMain.invoke('ggb-view', {visible: true, rect: RECT});
  readyFlag.value = true;
  await pollUntil(() => [...applet.objects.keys()], (keys) => keys.includes('aluno'), {timeout: 5000, what: 'a construção restaurada'});
  await new Promise((resolve) => setTimeout(resolve, 600)); // espera fixa: "nada acontece em 0,6 s" — um passo da espera do applet (500 ms), onde a 2ª restauração cairia
  assert.equal(applet.restoreCalls, 1, 'uma restauração só, mesmo com a reabertura no meio');
  assert.deepEqual([...applet.objects.keys()], ['aluno']);
});

test('trocar de matéria com a restauração em voo: vale a construção da matéria nova', async (t) => {
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), 'ggb-retry-'));
  t.after(() => { fs.rmSync(runtime, {recursive: true, force: true}); });
  const applet = new FakeGgbApplet();
  const courseA = new FakeGgbApplet();
  courseA.evalCommand('a=1');
  const courseB = new FakeGgbApplet();
  courseB.evalCommand('b=2');
  const readyFlag = {value: false};
  const ipcMain = createFakeIpcMain();
  const state = {ggbBase64: courseA.getBase64()};
  const ViewClass = createFakeViewClass(applet, readyFlag);
  const window = createFakeWindow(() => {});
  const host = createGeogebraHost({
    WebContentsView: ViewClass, win: () => window, deskState: () => state, courseKey: () => 'Calc',
    persist() {}, runtime, appendLog: () => {}, tutorT: ptTutor,
    ggbPage: '/ggb-falso.html', openDeadlineMs: 50,
    openExternal: () => {}, confirmExternal: () => false,
  });
  t.after(() => host.close());
  host.register(ipcMain);

  /* A restauração da matéria A espera o applet; o aluno troca para B. */
  await ipcMain.invoke('ggb-view', {visible: true, rect: RECT});
  await new Promise((resolve) => setTimeout(resolve, 60));
  state.ggbBase64 = courseB.getBase64();
  host.resetRestored();
  readyFlag.value = true;
  await ipcMain.invoke('ggb-view', {visible: false});
  await ipcMain.invoke('ggb-view', {visible: true, rect: RECT});
  await pollUntil(() => [...applet.objects.keys()].join(','), (keys) => keys === 'b', {timeout: 5000, what: 'a construção da matéria B'});
  await new Promise((resolve) => setTimeout(resolve, 600)); // espera fixa: "nada acontece em 0,6 s" — a tentativa antiga não volta por cima
  assert.deepEqual([...applet.objects.keys()], ['b'], 'a construção da matéria A não volta por cima da B');
});
