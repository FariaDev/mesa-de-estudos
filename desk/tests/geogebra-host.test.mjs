/* GeoGebra sob demanda no host (#53): com a aba fechada, o serviço pede ao
   renderer para abrir, espera o applet e a restauração da matéria e só então
   roda o comando; cada resposta nova começa com o quadro vazio e o botão
   "Voltar" restaura. O Electron é o falso com nome (`fake-ggb-electron.cjs`) e o
   applet, o `FakeGgbApplet`; o código do host roda de verdade. */
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
const enTutor = (key, args) => createI18n({catalogs: {'pt-BR': ptBR, en}, language: 'en'}).t(key, args);

const RECT = {x: 10, y: 40, width: 600, height: 400};

/** O renderer de mentira: ao ouvir `ggb-open` abre a aba (manda o retângulo), como `selectTab('geogebra')`. */
function setup({answerOpen = true, ready = true, saved = '', ggbPackDir = '', tutorLanguage = 'pt-BR'} = {}) {
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), 'ggb-host-'));
  const applet = new FakeGgbApplet();
  const readyFlag = {value: ready};
  const ipcMain = createFakeIpcMain();
  const state = {ggbBase64: saved};
  const window = createFakeWindow((channel) => {
    if (channel === 'ggb-open' && answerOpen) setTimeout(() => ipcMain.invoke('ggb-view', {visible: true, rect: RECT}), 5);
  });
  const ViewClass = createFakeViewClass(applet, readyFlag);
  const host = createGeogebraHost({
    WebContentsView: ViewClass, win: () => window, deskState: () => state, courseKey: () => 'Calc',
    persist() {}, runtime, deskDir: runtime, appendLog() {}, tutorT: tutorLanguage === 'en' ? enTutor : ptTutor, ggbPage: '/ggb-falso.html', openDeadlineMs: 400, ggbPackDir,
  });
  host.register(ipcMain);
  const cleanup = () => { host.close(); fs.rmSync(runtime, {recursive: true, force: true}); };
  return {applet, readyFlag, ipcMain, state, window, host, runtime, cleanup, ViewClass};
}

test('com a aba fechada, o pedido do tutor abre o applet e roda o comando', async (t) => {
  const {applet, window, host, cleanup} = setup();
  t.after(cleanup);
  const result = await host.service.run({command: 'f(x)=x^2'});
  assert.equal(result.ok, true);
  assert.deepEqual(window.sent.filter((item) => item.channel === 'ggb-open').length, 1);
  assert.deepEqual(applet.commands, ['f(x)=x^2']);
  assert.match(result.state.objects, /f: x\^2/);
  assert.deepEqual(result.board, {cleared: false});
});

test('com a aba já aberta não pede para abrir de novo', async (t) => {
  const {window, host, ipcMain, cleanup} = setup();
  t.after(cleanup);
  await ipcMain.invoke('ggb-view', {visible: true, rect: RECT});
  await host.service.run({command: 'a=1'});
  assert.equal(window.sent.filter((item) => item.channel === 'ggb-open').length, 0);
});

test('aba que não abre no prazo: erro em uma frase, sem pendurar', async (t) => {
  const {host, cleanup} = setup({answerOpen: false});
  t.after(cleanup);
  await assert.rejects(host.service.run({command: 'a=1'}), /a aba GeoGebra não abriu a tempo/);
});

test('o erro que o tutor lê segue o idioma do tutor', async (t) => {
  const {host, cleanup} = setup({answerOpen: false, tutorLanguage: 'en'});
  t.after(cleanup);
  await assert.rejects(host.service.run({command: 'a=1'}), /the GeoGebra tab did not open in time/);
});

test('applet que não fica pronto no prazo: erro em uma frase que lembra a internet', async (t) => {
  const {host, cleanup} = setup({ready: false});
  t.after(cleanup);
  await assert.rejects(host.service.run({command: 'a=1'}), /o applet GeoGebra não ficou pronto a tempo \(ele precisa de internet\)/);
});

test('a construção salva da matéria é restaurada ANTES do primeiro comando e fica guardada como do aluno', async (t) => {
  const seed = new FakeGgbApplet();
  seed.evalCommand('aluno=(1,2)');
  const {applet, host, state, ipcMain, runtime, cleanup} = setup({saved: seed.getBase64()});
  t.after(cleanup);
  const result = await host.service.run({command: 'f(x)=x^2'});
  assert.deepEqual(result.board, {cleared: true, origin: 'student'});
  assert.deepEqual([...applet.objects.keys()], ['f']);
  const kept = JSON.parse(fs.readFileSync(path.join(runtime, 'ggb', 'Calc.kept.json'), 'utf8'));
  assert.equal(kept.length, 1);
  assert.equal(kept[0].origin, 'student');
  /* "Voltar" devolve a do aluno e a salva como a da matéria. */
  const back = await ipcMain.invoke('ggb-restore');
  assert.equal(back.restored, true);
  assert.deepEqual([...applet.objects.keys()], ['aluno']);
  assert.equal(state.ggbBase64, applet.getBase64());
});

test('segunda resposta começa vazia, a mesma resposta continua, e o renderer ouve cada mudança do quadro', async (t) => {
  const {applet, window, host, cleanup} = setup();
  t.after(cleanup);
  host.newRequest();
  await host.service.run({command: 'a=1'});
  host.newRequest();
  const second = await host.service.run({command: 'b=2'});
  assert.deepEqual(second.board, {cleared: true, origin: 'tutor'});
  await host.service.run({command: 'c=3'});
  assert.deepEqual([...applet.objects.keys()], ['b', 'c']);
  const boardEvents = window.sent.filter((item) => item.channel === 'ggb-board');
  assert.equal(boardEvents.length, 1);
  assert.equal(boardEvents[0].payload.canGoBack, true);
});

test('sem snapshot na abertura, o que o aluno desenha depois não é desfeito pelo snapshot do uso anterior (#53)', async (t) => {
  const {applet, state, host, cleanup} = setup();
  t.after(cleanup);
  host.newRequest();
  await host.service.run({command: 'a=1'});
  for (let waited = 0; !state.ggbBase64 && waited < 200; waited += 1) await new Promise((resolve) => setTimeout(resolve, 10)); // o snapshot do uso grava em segundo plano
  assert.ok(state.ggbBase64, 'o uso do tutor deixou um snapshot');
  applet.evalCommand('s=5');
  host.newRequest();
  const second = await host.service.run({command: 'b=2'});
  assert.deepEqual(second.board, {cleared: true, origin: 'student'});
  assert.deepEqual([...applet.objects.keys()], ['b']);
});

test('state e screenshot funcionam com a aba fechada e nunca limpam o quadro', async (t) => {
  const seed = new FakeGgbApplet();
  seed.evalCommand('aluno=(1,2)');
  const {applet, host, cleanup} = setup({saved: seed.getBase64()});
  t.after(cleanup);
  host.newRequest();
  const state = await host.service.state();
  assert.match(state.state.objects, /aluno/);
  const shot = await host.service.screenshot();
  assert.equal(Buffer.from(shot.png, 'base64').toString(), 'png-falso');
  assert.deepEqual([...applet.objects.keys()], ['aluno']);
});

test('pedidos simultâneos do tutor rodam um por vez', async (t) => {
  const {applet, host, cleanup} = setup();
  t.after(cleanup);
  host.newRequest();
  await Promise.all([host.service.run({command: 'a=1'}), host.service.run({command: 'b=2'}), host.service.run({command: 'c=3'})]);
  assert.deepEqual(applet.commands, ['a=1', 'b=2', 'c=3']);
  assert.deepEqual([...applet.objects.keys()], ['a', 'b', 'c']);
});

test('a ponte HTTP do Pi usa o mesmo serviço e aceita "continuar"', async (t) => {
  const {applet, host, cleanup} = setup();
  t.after(cleanup);
  host.start();
  const bridgeFile = host.bridgeFile;
  for (let i = 0; i < 100 && !fs.existsSync(bridgeFile); i++) await new Promise((resolve) => setTimeout(resolve, 20));
  const {port, token} = JSON.parse(fs.readFileSync(bridgeFile, 'utf8'));
  const post = async (action, body, headerToken = token) => {
    const response = await fetch(`http://127.0.0.1:${port}/${action}`, {method: 'POST', headers: {'content-type': 'application/json', 'x-desk-token': headerToken}, body: JSON.stringify(body)});
    return {status: response.status, data: await response.json()};
  };
  assert.equal((await post('run', {command: 'a=1'}, 'errado')).status, 403);
  assert.equal((await post('run', {})).status, 400);
  host.newRequest();
  const first = await post('run', {command: 'a=1'});
  assert.equal(first.status, 200);
  host.newRequest();
  const kept = await post('run', {command: 'b=2', continuar: true});
  assert.deepEqual(kept.data.board, {cleared: false});
  assert.deepEqual([...applet.objects.keys()], ['a', 'b']);
});

test('trocar de matéria zera o quadro da resposta: o primeiro comando da outra guarda o que há nela', async (t) => {
  const {applet, host, cleanup} = setup();
  t.after(cleanup);
  host.newRequest();
  await host.service.run({command: 'a=1'});
  host.resetRestored();
  const used = await host.service.run({command: 'b=2'});
  assert.deepEqual(used.board, {cleared: true, origin: 'student'});
  assert.deepEqual([...applet.objects.keys()], ['b']);
});

/** Pacote instalado de mentira: só o que `readInstalledPack` confere. */
function seedInstalledPack(runtime) {
  const {PACK} = require('../geogebra-pack.cjs');
  const dir = path.join(runtime, 'pacote');
  fs.mkdirSync(path.join(dir, 'GeoGebra'), {recursive: true});
  fs.writeFileSync(path.join(dir, 'GeoGebra', 'deployggb.js'), '//');
  fs.writeFileSync(path.join(dir, 'pack.json'), JSON.stringify({version: PACK.version, sha256: PACK.sha256}));
  return dir;
}

test('sem pacote offline, a view carrega o ggb.html da web e a sessão fica como está (#55)', async (t) => {
  const {host, ipcMain, ViewClass, cleanup} = setup({ggbPackDir: '/nao-existe'});
  t.after(cleanup);
  await ipcMain.invoke('ggb-view', {visible: true, rect: RECT});
  const view = ViewClass.instances[0];
  assert.deepEqual(view.webContents.loads, ['/ggb-falso.html']);
  assert.deepEqual(view.webContents.urls, []);
  assert.deepEqual(view.webContents.session.handledSchemes, []);
  assert.equal(view.webContents.session.networkFilter, null, 'a rede não é fechada sem o pacote');
  assert.equal(host.isOffline(), false);
});

test('com o pacote offline, a view carrega mesa-ggb://, registra o protocolo e fecha a rede (#55)', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ggb-host-pack-'));
  t.after(() => fs.rmSync(root, {recursive: true, force: true}));
  const {host, ipcMain, ViewClass, cleanup} = setup({ggbPackDir: seedInstalledPack(root)});
  t.after(cleanup);
  await ipcMain.invoke('ggb-view', {visible: true, rect: RECT});
  const view = ViewClass.instances[0];
  assert.deepEqual(view.webContents.urls, ['mesa-ggb://app/ggb.html']);
  assert.deepEqual(view.webContents.loads, [], 'não carrega o arquivo da web');
  assert.deepEqual(view.webContents.session.handledSchemes, ['mesa-ggb']);
  assert.equal(typeof view.webContents.session.networkFilter, 'function');
  assert.equal(host.isOffline(), true);
});

test('offline que não fica pronto: o erro não manda procurar internet (#55)', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ggb-host-pack-'));
  t.after(() => fs.rmSync(root, {recursive: true, force: true}));
  const {host, cleanup} = setup({ready: false, ggbPackDir: seedInstalledPack(root)});
  t.after(cleanup);
  await assert.rejects(host.service.run({command: 'a=1'}), (error) => /o applet GeoGebra offline não ficou pronto a tempo/.test(error.message) && !/internet/.test(error.message));
});

/* Arrasto do divisor do chat (ajustes do GeoGebra): a view vira captura e some
   durante o arrasto; o retângulo final a devolve, com a mesma construção. */
test('ggb-freeze captura a view, esconde e o próximo ggb-view a devolve no retângulo novo', async (t) => {
  const {ipcMain, ViewClass, cleanup} = setup();
  t.after(cleanup);
  await ipcMain.invoke('ggb-view', {visible: true, rect: RECT});
  const view = ViewClass.instances[0];
  const frozen = await ipcMain.invoke('ggb-freeze');
  assert.match(frozen.dataUrl, /^data:image\/png;base64,/);
  assert.equal(view.visible, false, 'durante o arrasto a view nativa não fica por cima do divisor');
  const wider = {x: 10, y: 40, width: 480, height: 400};
  await ipcMain.invoke('ggb-view', {visible: true, rect: wider});
  assert.equal(view.visible, true);
  assert.deepEqual(view.bounds, wider, 'volta no retângulo do fim do arrasto');
  assert.equal(ViewClass.instances.length, 1, 'a mesma view, sem criar outra');
});

test('ggb-freeze sem a aba aberta não cria view nem falha', async (t) => {
  const {ipcMain, ViewClass, cleanup} = setup();
  t.after(cleanup);
  assert.deepEqual(await ipcMain.invoke('ggb-freeze'), {dataUrl: ''});
  assert.equal(ViewClass.instances.length, 0);
});
