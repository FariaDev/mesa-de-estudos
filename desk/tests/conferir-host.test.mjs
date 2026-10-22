import test from 'node:test';
import {ptText, ptMatches} from './pt-text.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {captureFileName} from '../src/capture-name.mjs';

/* Conferir com outros programas (ticket #35), no host: listas de janelas FALSAS
   (nenhuma captura de tela de verdade). A decisão é do núcleo
   (`core/conferir.bend`); aqui se prova o que o host entrega a ele e o que
   faz com a resposta: o Xournal++ sem escolha, a escolha salva presente e
   ausente, várias janelas do mesmo app e a própria Mesa na lista. */
const require = createRequire(import.meta.url);
const {createConferirHost, normalizeChoice, windowFact, normKey} = require('../conferir-host.cjs');
const {listWindows, captureWindow, psLiteral, buildScript} = require('../capture-win.cjs');

const BOUNDS = {X: 0, Y: 0, Width: 1200, Height: 800};
const win = (id, app, title, extra = {}) => ({id, app, title, bounds: BOUNDS, ...extra});
const PNG = 'data:image/png;base64,iVBORw0KGgo=';

/* Um host com a lista dada (da frente para trás) e uma escolha salva em memória. */
function harness({windows, saved = null, platform = 'darwin', selfNames = ['Mesa de Estudos', 'Electron']}) {
  const store = {choice: saved, shots: [], permission: 0};
  const handlers = new Map();
  const host = createConferirHost({
    ipcMain: {handle: (name, fn) => handlers.set(name, fn)},
    platform,
    state: () => store.choice,
    setChoice: (value) => { store.choice = value; },
    selfNames: () => selfNames,
    ensurePermission: async () => { store.permission += 1; },
    listWindows: async () => windows,
    captureWindow: async (raw, label) => { store.shots.push({id: raw.id, label}); return {title: raw.title, dataUrl: PNG}; },
  });
  return {host, store, handlers};
}

test('sem escolha salva, o Conferir captura o Xournal++ como sempre', async () => {
  const {host, store} = harness({windows: [win('11', 'Safari', 'Aula'), win('12', 'Xournal++', 'Lista 3'), win('13', 'OneNote', 'Notas')]});
  const r = await host.ready();
  assert.equal(r.app, 'Xournal++');
  assert.equal(r.title, 'Lista 3');
  assert.equal(r.dataUrl, PNG);
  assert.deepEqual(store.shots, [{id: '12', label: 'Xournal++'}]);
  assert.equal(store.permission, 1, 'a permissão de tela é conferida antes de listar');
});

test('no Windows o processo xournalpp também é o Xournal++', async () => {
  const {host} = harness({platform: 'win32', windows: [{id: '77', app: 'xournalpp', title: 'Prova'}]});
  const r = await host.ready();
  assert.equal(r.app, 'Xournal++', 'o nome para mostrar é um só');
  assert.equal(r.title, 'Prova');
});

test('escolha salva presente: captura o app escolhido, não o Xournal++', async () => {
  const {host, store} = harness({
    saved: {app: 'OneNote', key: 'onenote'},
    windows: [win('12', 'Xournal++', 'Lista 3'), win('13', 'OneNote', 'Notas de aula')],
  });
  const r = await host.ready();
  assert.equal(r.app, 'OneNote');
  assert.equal(r.title, 'Notas de aula');
  assert.deepEqual(store.shots.map((s) => s.id), ['13']);
});

test('escolha salva ausente: diz que o app não está aberto e NÃO captura outra janela', async () => {
  const {host, store} = harness({
    saved: {app: 'OneNote', key: 'onenote'},
    windows: [win('12', 'Xournal++', 'Lista 3'), win('14', 'Safari', 'Aula')],
  });
  const r = await host.ready();
  assert.equal(r.absent, true);
  assert.equal(r.app, 'OneNote');
  assert.equal(r.saved, true);
  assert.match(ptText(r.message), /^OneNote não está aberto/);
  assert.match(ptText(r.message), /^OneNote não está aberto/);
  assert.equal(r.dataUrl, undefined);
  assert.deepEqual(store.shots, [], 'nenhuma captura aconteceu');
});

test('sem escolha e sem Xournal++ aberto: a mesma frase de sempre, com o seletor oferecido', async () => {
  const {host, store} = harness({windows: [win('14', 'Safari', 'Aula')]});
  const r = await host.ready();
  assert.equal(r.absent, true);
  assert.equal(r.app, 'Xournal++');
  assert.equal(r.saved, false);
  assert.match(ptText(r.message), /^Abra a resolução no Xournal\+\+/);
  assert.deepEqual(store.shots, []);
});

test('várias janelas do mesmo app: vale a da frente (a primeira da lista)', async () => {
  const {host, store} = harness({
    saved: {app: 'OneNote', key: 'onenote'},
    windows: [win('20', 'OneNote', 'Frente'), win('21', 'Safari', 'x'), win('22', 'OneNote', 'Atrás')],
  });
  const r = await host.ready();
  assert.equal(r.title, 'Frente');
  assert.deepEqual(store.shots.map((s) => s.id), ['20']);
});

test('o mesmo vale para o Xournal++: duas janelas não são mais erro', async () => {
  const {host} = harness({windows: [win('30', 'Xournal++', 'Aberta agora'), win('31', 'Xournal++', 'Outra')]});
  assert.equal((await host.ready()).title, 'Aberta agora');
});

test('a Mesa na lista é excluída, mesmo escolhida à mão ou salva', async () => {
  const windows = [win('40', 'Mesa de Estudos', 'Mesa'), win('41', 'Electron', 'Mesa (dev)'), win('42', 'OneNote', 'Notas')];
  const salvaMesa = harness({saved: {app: 'Mesa de Estudos', key: 'mesa de estudos'}, windows});
  const r = await salvaMesa.host.ready();
  assert.equal(r.absent, true, 'escolha salva apontando para a Mesa não captura a Mesa');
  assert.deepEqual(salvaMesa.store.shots, []);

  const {host} = harness({windows});
  const listed = await host.windows();
  const eligible = listed.windows.filter((w) => w.usable && !w.self).map((w) => w.id);
  assert.deepEqual(eligible, ['42']);
  assert.deepEqual(listed.windows.filter((w) => w.self).map((w) => w.id), ['40', '41']);
  await assert.rejects(() => host.choose({id: '40'}), ptMatches(/não está mais aberta/));
});

test('janela de sistema e janela minúscula não entram na escolha', async () => {
  const {host} = harness({windows: [
    win('50', 'Dock', 'Dock'),
    win('51', 'Window Server', 'Menubar'),
    win('52', 'Safari', 'Barra', {bounds: {X: 0, Y: 0, Width: 800, Height: 22}}),
    win('53', 'Safari', 'Aula'),
  ]});
  await assert.rejects(() => host.choose({id: '50'}), ptMatches(/não está mais aberta/));
  await assert.rejects(() => host.choose({id: '51'}), ptMatches(/não está mais aberta/));
  await assert.rejects(() => host.choose({id: '52'}), ptMatches(/não está mais aberta/));
  assert.equal((await host.choose({id: '53'})).app, 'Safari');
});

test('escolher uma janela captura exatamente ela e guarda o APP, nunca o id', async () => {
  const {host, store} = harness({windows: [win('60', 'Xournal++', 'Lista'), win('61', 'OneNote', 'Notas')]});
  const r = await host.choose({id: '61'});
  assert.equal(r.app, 'OneNote');
  assert.equal(r.title, 'Notas');
  assert.equal(r.dataUrl, PNG);
  assert.deepEqual(r.choice, {app: 'OneNote', key: 'onenote'});
  assert.deepEqual(store.choice, {app: 'OneNote', key: 'onenote'});
  assert.equal(JSON.stringify(store.choice).includes('61'), false, 'o id da janela não é guardado');
  assert.deepEqual(store.shots, [{id: '61', label: 'OneNote'}]);
});

test('captura que falha não troca o app salvo', async () => {
  const store = {choice: {app: 'OneNote', key: 'onenote'}};
  const host = createConferirHost({
    ipcMain: {handle() {}},
    platform: 'darwin',
    state: () => store.choice,
    setChoice: (value) => { store.choice = value; },
    listWindows: async () => [win('70', 'Safari', 'Aula')],
    captureWindow: async () => { throw Error('A captura não produziu uma imagem PNG válida.'); },
  });
  await assert.rejects(() => host.choose({id: '70'}), ptMatches(/PNG válida/));
  assert.deepEqual(store.choice, {app: 'OneNote', key: 'onenote'});
});

test('escolher o Xournal++ no seletor guarda o nome único dele', async () => {
  const {host, store} = harness({platform: 'win32', windows: [{id: '80', app: 'xournalpp', title: 'Prova'}]});
  const r = await host.choose({id: '80'});
  assert.deepEqual(r.choice, {app: 'Xournal++', key: 'xournalpp'});
  assert.deepEqual(store.choice, {app: 'Xournal++', key: 'xournalpp'});
});

test('Voltar ao Xournal++ esquece a escolha', async () => {
  const {host, store, handlers} = harness({saved: {app: 'OneNote', key: 'onenote'}, windows: []});
  host.register();
  assert.deepEqual([...handlers.keys()].sort(), ['capture-choose', 'capture-default', 'capture-ready', 'capture-windows']);
  assert.equal((await host.windows()).canGoBack, true);
  await handlers.get('capture-default')();
  assert.equal(store.choice, null);
  assert.equal((await host.windows()).canGoBack, false);
});

test('plataforma sem suporte diz isso em vez de capturar', async () => {
  const {host} = harness({platform: 'linux', windows: []});
  await assert.rejects(() => host.ready(), ptMatches(/macOS e no Windows/));
});

test('normalizeChoice: só vale texto com nome; a chave é sempre recalculada', () => {
  assert.deepEqual(normalizeChoice({app: '  OneNote ', key: 'forjada'}), {app: 'OneNote', key: 'onenote'});
  assert.equal(normalizeChoice(null), null);
  assert.equal(normalizeChoice('OneNote'), null);
  assert.equal(normalizeChoice({app: '   '}), null);
  assert.equal(normalizeChoice({app: 7}), null);
  assert.equal(normalizeChoice({app: 'x'.repeat(121)}), null);
  assert.equal(normKey('  Xournal++ '), 'xournal++');
});

test('windowFact: tamanho de janela de verdade e a própria Mesa viram fatos', () => {
  const self = new Set(['mesa de estudos']);
  assert.equal(windowFact(win('1', 'Safari', 't'), self).usable, true);
  assert.equal(windowFact(win('1', 'Safari', 't', {bounds: {Width: 100, Height: 800}}), self).usable, false);
  assert.equal(windowFact({id: 3, app: 'xournalpp', title: 't'}, self).usable, true, 'Windows não informa tamanho');
  assert.equal(windowFact(win('1', 'Mesa de Estudos', 't'), self).self, true);
  assert.equal(windowFact({}, self).app, '');
});

test('captureFileName: o anexo se chama como o programa', () => {
  assert.equal(captureFileName('Xournal++'), 'xournal.png');
  assert.equal(captureFileName('OneNote'), 'onenote.png');
  assert.equal(captureFileName('Microsoft Word'), 'microsoftword.png');
  assert.equal(captureFileName('Notas Rápidas'), 'notasrapidas.png');
  assert.equal(captureFileName('!!!'), 'janela.png');
  assert.equal(captureFileName(undefined), 'janela.png');
});

test('Windows: listWindows lê o JSON do PowerShell e descarta o que não tem processo', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-conferir-list-'));
  const exec = async (cmd, args) => {
    assert.equal(cmd, 'powershell.exe');
    assert.ok(fs.existsSync(args.at(-1)), 'o script entra por -File');
    return {stdout: JSON.stringify([{id: '10', app: 'ONENOTE', title: 'Notas'}, {id: '', app: 'x', title: 'y'}, {id: '11', app: 'xournalpp', title: 'Lista'}])};
  };
  const rows = await listWindows({exec, tmp: () => dir});
  assert.deepEqual(rows, [{id: '10', app: 'ONENOTE', title: 'Notas'}, {id: '11', app: 'xournalpp', title: 'Lista'}]);
  assert.equal(fs.existsSync(dir), false, 'o temporário sai');
  const single = await listWindows({exec: async () => ({stdout: '{"id":"5","app":"code","title":"t"}'}), tmp: () => fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-conferir-list-'))});
  assert.deepEqual(single, [{id: '5', app: 'code', title: 't'}], 'um objeto só (ConvertTo-Json de um item) também vale');
  await assert.rejects(() => listWindows({exec: async () => ({stdout: 'lixo'}), tmp: () => fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-conferir-list-'))}), ptMatches(/ler a lista/));
});

test('Windows: a captura de outro programa nomeia o processo e o rótulo', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-conferir-cap-'));
  let script = '';
  const exec = async (cmd, args) => { script = fs.readFileSync(args.at(-1), 'utf8'); const e = Error('exit 3'); e.code = 3; throw e; };
  await assert.rejects(() => captureWindow({exec, tmp: () => dir, processName: "One'Note", label: 'OneNote'}), ptMatches(/Abra o OneNote primeiro/));
  assert.match(script, /Get-Process -Name 'One''Note'/, 'aspas do nome do processo são duplicadas');
  assert.equal(psLiteral('a\nb'), 'a b');
  assert.match(buildScript('C:\\x.png', 'code'), /Get-Process -Name 'code'/);
});
