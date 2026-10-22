/* Quadro limpo do GeoGebra por uso do tutor (#53): o `ggb-board.cjs` aplica a
   regra do núcleo (`core/ggbboard.bend`) sobre um applet falso com nome. Cobre
   quando limpa, o que guarda (e de quem é), o "voltar" com troca e o histórico
   em disco. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const {createGgbBoard, createKeptStore} = require('../ggb-board.cjs');
const {FakeGgbApplet, boardAppletOf, memoryKeptStore} = require('./fixtures/fake-ggb-applet.cjs');

function setup(key = 'Calc') {
  const applet = new FakeGgbApplet();
  const store = memoryKeptStore();
  const changes = [];
  let clock = 0;
  const board = createGgbBoard({applet: boardAppletOf(applet), store, key: () => key, onChange: (status) => changes.push(status), now: () => ++clock});
  /* Um comando do tutor, como o host o faz: antes do uso, rodar, depois do uso. */
  const tutorRun = async (command, continues = false) => {
    const used = await board.beforeUse({kind: 'run', continues});
    applet.evalCommand(command);
    board.afterRun(await boardAppletOf(applet).summary());
    return used;
  };
  return {applet, store, board, changes, tutorRun};
}

test('o primeiro uso da resposta com o quadro vazio não guarda nada', async () => {
  const {board, store, tutorRun} = setup();
  board.newRequest();
  assert.deepEqual(await tutorRun('f(x)=x^2'), {cleared: false});
  assert.deepEqual(store.read('Calc'), []);
});

test('a resposta seguinte começa vazia e guarda a construção do tutor', async () => {
  const {applet, board, store, tutorRun, changes} = setup();
  board.newRequest();
  await tutorRun('f(x)=x^2');
  board.newRequest();
  const used = await tutorRun('g(x)=x+1');
  assert.deepEqual(used, {cleared: true, origin: 'tutor'});
  assert.deepEqual([...applet.objects.keys()], ['g']);
  assert.equal(store.read('Calc').length, 1);
  assert.equal(store.read('Calc')[0].origin, 'tutor');
  assert.equal(changes.at(-1).canGoBack, true);
  assert.match(changes.at(-1).note, /ggb\.board\.freshTutor/);
});

test('na mesma resposta o quadro só limpa uma vez', async () => {
  const {applet, board, store, tutorRun} = setup();
  board.newRequest();
  await tutorRun('a=1');
  board.newRequest();
  await tutorRun('b=2');
  await tutorRun('c=3');
  assert.deepEqual([...applet.objects.keys()], ['b', 'c']);
  assert.equal(store.read('Calc').length, 1);
});

test('ler nunca limpa: o aluno que pede para conferir vê a construção dele', async () => {
  const {applet, board, store} = setup();
  applet.evalCommand('aluno=(1,2)');
  board.newRequest();
  assert.deepEqual(await board.beforeUse({kind: 'read'}), {cleared: false});
  assert.deepEqual([...applet.objects.keys()], ['aluno']);
  assert.deepEqual(store.read('Calc'), []);
});

test('continuar mantém o quadro e conta como uso da resposta', async () => {
  const {applet, board, store, tutorRun} = setup();
  applet.evalCommand('aluno=(1,2)');
  board.newRequest();
  assert.deepEqual(await tutorRun('b=2', true), {cleared: false});
  assert.deepEqual([...applet.objects.keys()].sort(), ['aluno', 'b']);
  assert.deepEqual(store.read('Calc'), []);
});

test('o que o aluno montou (ou mexeu depois do tutor) fica guardado como do aluno', async () => {
  const {applet, board, store, tutorRun} = setup();
  board.newRequest();
  await tutorRun('f(x)=x^2');
  applet.evalCommand('aluno=(3,4)');
  board.newRequest();
  const used = await tutorRun('g(x)=x');
  assert.deepEqual(used, {cleared: true, origin: 'student'});
  assert.equal(store.read('Calc')[0].origin, 'student');
});

test('voltar traz a construção anterior e a atual toma o lugar dela (voltar também se desfaz)', async () => {
  const {applet, board, store, tutorRun} = setup();
  board.newRequest();
  await tutorRun('f(x)=x^2');
  board.newRequest();
  await tutorRun('g(x)=x+1');
  const first = await board.restore();
  assert.deepEqual(first, {restored: true, kept: 1, canGoBack: true});
  assert.deepEqual([...applet.objects.keys()], ['f']);
  assert.equal(store.read('Calc')[0].origin, 'tutor');
  await board.restore();
  assert.deepEqual([...applet.objects.keys()], ['g']);
});

test('voltar com o quadro vazio só tira do histórico', async () => {
  const {applet, board, store, tutorRun} = setup();
  board.newRequest();
  await tutorRun('f(x)=x^2');
  board.newRequest();
  await tutorRun('g(x)=x');
  applet.objects.clear();
  assert.deepEqual(await board.restore(), {restored: true, kept: 0, canGoBack: false});
  assert.deepEqual(store.read('Calc'), []);
});

test('sem nada guardado, voltar não faz nada', async () => {
  const {board} = setup();
  assert.deepEqual(await board.restore(), {restored: false, kept: 0, canGoBack: false});
});

test('o histórico guarda no máximo 3 construções e perde a mais antiga', async () => {
  const {board, store, tutorRun} = setup();
  for (const name of ['a', 'b', 'c', 'd', 'e']) {
    board.newRequest();
    await tutorRun(`${name}=1`);
  }
  assert.equal(store.read('Calc').length, 3);
});

test('o histórico é por matéria e a troca de matéria zera os marcadores da resposta', async () => {
  let key = 'Calc';
  const applet = new FakeGgbApplet();
  const store = memoryKeptStore();
  const board = createGgbBoard({applet: boardAppletOf(applet), store, key: () => key});
  board.newRequest();
  await board.beforeUse({kind: 'run'});
  applet.evalCommand('a=1');
  key = 'Algebra';
  board.reset();
  assert.deepEqual(await board.beforeUse({kind: 'run'}), {cleared: true, origin: 'student'});
  assert.equal(store.read('Algebra').length, 1);
  assert.deepEqual(store.read('Calc'), []);
});

test('o histórico em disco: ida e volta, descarte de lixo e remoção do arquivo vazio', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ggb-kept-'));
  try {
    const store = createKeptStore(dir);
    assert.deepEqual(store.read('Cálculo 1/2'), []);
    const item = {b64: 'QUJD', origin: 'tutor', at: 1};
    store.write('Cálculo 1/2', [item]);
    assert.deepEqual(store.read('Cálculo 1/2'), [item]);
    assert.deepEqual(fs.readdirSync(dir), ['C_lculo_1_2.kept.json']);
    fs.writeFileSync(path.join(dir, 'C_lculo_1_2.kept.json'), JSON.stringify([item, {b64: '', origin: 'tutor', at: 2}, {b64: 'x', origin: 'outro', at: 3}, 'lixo']));
    assert.deepEqual(store.read('Cálculo 1/2'), [item]);
    fs.writeFileSync(path.join(dir, 'C_lculo_1_2.kept.json'), '{não é json');
    assert.deepEqual(store.read('Cálculo 1/2'), []);
    store.write('Cálculo 1/2', [item]);
    store.write('Cálculo 1/2', []);
    assert.deepEqual(fs.readdirSync(dir), []);
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
  }
});
