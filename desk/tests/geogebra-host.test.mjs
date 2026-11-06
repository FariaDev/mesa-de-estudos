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
import {guideFor} from '../src/extensions/mesa-geogebra/guide.mjs';
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
function setup({answerOpen = true, ready = true, saved = '', ggbPackDir = '', tutorLanguage = 'pt-BR', confirmExternal = async () => true} = {}) {
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), 'ggb-host-'));
  const applet = new FakeGgbApplet();
  const readyFlag = {value: ready};
  const ipcMain = createFakeIpcMain();
  const state = {ggbBase64: saved};
  const opened = [];
  const confirmed = [];
  const window = createFakeWindow((channel) => {
    if (channel === 'ggb-open' && answerOpen) setTimeout(() => ipcMain.invoke('ggb-view', {visible: true, rect: RECT}), 5);
  });
  const ViewClass = createFakeViewClass(applet, readyFlag);
  const host = createGeogebraHost({
    WebContentsView: ViewClass, win: () => window, deskState: () => state, courseKey: () => 'Calc',
    persist() {}, runtime, deskDir: runtime, appendLog() {}, tutorT: tutorLanguage === 'en' ? enTutor : ptTutor, ggbPage: '/ggb-falso.html', openDeadlineMs: 400, ggbPackDir,
    openExternal: (url) => opened.push(url),
    confirmExternal: (url) => { confirmed.push(url); return confirmExternal(url); },
  });
  host.register(ipcMain);
  const cleanup = () => { host.close(); fs.rmSync(runtime, {recursive: true, force: true}); };
  return {applet, readyFlag, ipcMain, state, window, host, runtime, cleanup, ViewClass, opened, confirmed};
}

test('a view do GeoGebra não ganha permissão de página e não sai da própria página', async (t) => {
  /* Revisão de segurança: antes, a sessão `persist:geogebra` concedia tudo e a view
     seguia qualquer link; agora só a cópia passa, a navegação fica no documento
     do applet e link externo vai só ao navegador do sistema (https). */
  const {ipcMain, ViewClass, opened, confirmed, cleanup} = setup();
  t.after(cleanup);
  await ipcMain.invoke('ggb-view', {visible: true, rect: RECT});
  const contents = ViewClass.instances[0].webContents;
  assert.equal(await contents.askPermission('media'), false);
  assert.equal(await contents.askPermission('notifications'), false);
  assert.equal(contents.checkPermission('geolocation'), false);
  assert.equal(await contents.askPermission('clipboard-sanitized-write'), true);
  assert.equal(contents.navigate('https://evil.example/').defaultPrevented, true);
  assert.equal(contents.navigate(contents.getURL()).defaultPrevented, false);
  assert.deepEqual(contents.openWindow('https://exemplo.org/ajuda'), {action: 'deny'});
  assert.deepEqual(contents.openWindow('file:///etc/passwd'), {action: 'deny'});
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(confirmed, ['https://exemplo.org/ajuda'], 'o link passa pelo diálogo da Mesa (#81)');
  assert.deepEqual(opened, ['https://exemplo.org/ajuda']);
});

test('link externo do applet recusado no diálogo não abre no navegador (#81)', async (t) => {
  const {ipcMain, ViewClass, opened, confirmed, cleanup} = setup({confirmExternal: async () => false});
  t.after(cleanup);
  await ipcMain.invoke('ggb-view', {visible: true, rect: RECT});
  const contents = ViewClass.instances[0].webContents;
  assert.deepEqual(contents.openWindow('https://evil.example/phishing'), {action: 'deny'});
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(confirmed, ['https://evil.example/phishing']);
  assert.deepEqual(opened, [], 'o "Cancelar" do diálogo mantém o navegador fechado');
});

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

test('M4: o resumo corta em 80 objetos, mas devolve o total para o texto avisar', async (t) => {
  const {applet, host, cleanup} = setup();
  t.after(cleanup);
  for (let i = 1; i <= 85; i += 1) applet.evalCommand(`o${i}=${i}`);
  const result = await host.service.state();
  assert.equal(result.state.count, 85);
  assert.equal(result.state.objects.split('\n').length, 80);
  assert.match(guideFor('pt-BR').stateText(result), /\(mostrando 80 de 85 objetos\)$/);
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

test('sem pacote offline, a view carrega o ggb.html da web com filtro só para geogebra.org', async (t) => {
  const {host, ipcMain, ViewClass, cleanup} = setup({ggbPackDir: '/nao-existe'});
  t.after(cleanup);
  await ipcMain.invoke('ggb-view', {visible: true, rect: RECT});
  const view = ViewClass.instances[0];
  assert.deepEqual(view.webContents.loads, ['/ggb-falso.html']);
  assert.deepEqual(view.webContents.urls, []);
  assert.deepEqual(view.webContents.session.handledSchemes, []);
  assert.equal(typeof view.webContents.session.networkFilter, 'function', 'a sessão online também tem filtro');
  const decide = (url) => new Promise((resolve) => view.webContents.session.networkFilter({url}, resolve));
  assert.deepEqual(await decide('https://www.geogebra.org/apps/deployggb.js'), {cancel: false}, 'o applet carrega');
  assert.deepEqual(await decide('https://cdn.geogebra.org/x.js'), {cancel: false}, 'subdomínio do applet passa');
  assert.deepEqual(await decide('https://sink.exemplo/p.png?d=DADOS'), {cancel: true}, 'sink externo não sai');
  assert.deepEqual(await decide('http://127.0.0.1:9/p.png'), {cancel: true}, 'nem o sink local do teste');
  assert.deepEqual(await decide('file:///etc/passwd'), {cancel: true}, 'file: fora do app não sai');
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

/* A barra espelha o carregamento (auditoria de UI/UX, rodada 1, A4): o
   renderer mostra "Carregando…" até o `ggb-ready` chegar. */
async function waitGgbReady(sent, timeout, what) {
  const start = Date.now();
  for (;;) {
    const found = sent.filter((s) => s.channel === 'ggb-ready');
    if (found.length) return found;
    if (Date.now() - start > timeout) throw new Error(`sem ggb-ready: ${what}`);
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

test('a barra espelha o carregamento: pronto avisa ok, travado avisa falha', async (t) => {
  const live = setup({ready: true});
  t.after(live.cleanup);
  await live.ipcMain.invoke('ggb-view', {visible: true, rect: RECT});
  const ok = await waitGgbReady(live.window.sent, 2000, 'o applet pronto');
  assert.ok(ok.length >= 1 && ok.every((s) => s.payload.ok === true), 'o pronto chega como {ok:true}');
  const stuck = setup({ready: false});
  t.after(stuck.cleanup);
  await stuck.ipcMain.invoke('ggb-view', {visible: true, rect: RECT});
  const failed = await waitGgbReady(stuck.window.sent, 5000, 'o applet travado');
  assert.deepEqual(failed.map((s) => s.payload), [{ok: false}], 'o travado chega como {ok:false}');
});
