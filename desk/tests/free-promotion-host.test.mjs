// Host da promoção Livre → matéria (#43 fase 2: saiu do main.cjs) e a escrita
// da config que preserva extras. Runtime sintético em pasta temporária.
import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const store = require('../free-workspaces.cjs');
const {normalize} = require('../config.cjs');
const {createFreePromotionHost} = require('../free-promotion-host.cjs');
const {writeConfigPreservingExtras} = require('../config-write.cjs');

const dirs = [];
after(() => { for (const dir of dirs) fs.rmSync(dir, {recursive: true, force: true}); });
function tempDir(tag) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `mesa-promo-${tag}-`));
  dirs.push(dir);
  return dir;
}

/** Estado vivo do main, só com o que a promoção lê e escreve. */
function fakeLive() {
  return {config: normalize({courses: []}), courses: [], session: '', state: {theme: 'light', study: {}, draft: 'rascunho'}, win: null, lastContextKey: 'antes'};
}

function promotionHost(rt, live, extra = {}) {
  const calls = [];
  const host = createFreePromotionHost({
    live, runtime: rt, configFile: path.join(rt, 'config.json'), stateFile: path.join(rt, 'desk.json'),
    persistConfig: false, courseStates: {}, allowedXopp: new Set(['x.xopp']), ggbCache: {persist: () => calls.push('ggb')},
    appendLog: (scope, text) => calls.push(`log:${text}`), freeEntryOf: () => ({}), previewFile: () => '',
    engine: () => 'pi', stopBridge: () => calls.push('stop'), applyCourse: (id) => calls.push(`apply:${id}`), persist: () => calls.push('persist'),
    ...extra,
  });
  return {host, calls};
}

test('runFreePromotion cria a matéria, grava o desk.json nela e adota em memória', async () => {
  const rt = tempDir('ok');
  const parent = path.join(rt, 'destino');
  fs.mkdirSync(parent);
  const record = store.ensureWorkspace(rt, {sessionId: 's', title: 'Cálculo'});
  const live = fakeLive();
  const {host, calls} = promotionHost(rt, live);
  const {course} = await host.runFreePromotion({record, parentDir: parent, name: 'Cálculo'});
  assert.equal(course.name, 'Cálculo');
  assert.ok(fs.existsSync(course.path));
  const desk = JSON.parse(fs.readFileSync(path.join(rt, 'desk.json'), 'utf8'));
  assert.equal(desk.courseId, course.id);
  assert.equal(desk.draft, 'rascunho');
  assert.deepEqual(live.config.courses.map(item => item.id), [course.id]);
  assert.equal(live.lastContextKey, '');
  assert.deepEqual(calls, ['stop', `apply:${course.id}`, 'ggb', 'persist']);
  assert.equal(fs.existsSync(path.join(rt, 'config.json')), false, 'sem persistConfig nem config.json, a config não é escrita');
});

test('runFreePromotion desfaz o destino novo quando a gravação falha antes do commit', async () => {
  const rt = tempDir('fail');
  const parent = path.join(rt, 'destino');
  fs.mkdirSync(parent);
  const record = store.ensureWorkspace(rt, {sessionId: 's', title: 'Física'});
  const live = fakeLive();
  const {host} = promotionHost(rt, live, {stateFile: path.join(rt, 'nao-existe', 'desk.json')});
  await assert.rejects(host.runFreePromotion({record, parentDir: parent, name: 'Física'}));
  assert.deepEqual(fs.readdirSync(parent), []);
  assert.deepEqual(live.config.courses, []);
  assert.equal(store.promotionPlan(rt, 's'), null);
});

test('writeConfigPreservingExtras mantém chaves do usuário que o schema não modela', () => {
  const dir = tempDir('config');
  const file = path.join(dir, 'config.json');
  fs.writeFileSync(file, JSON.stringify({minhaChave: 1, courses: [{id: 'a', name: 'A', path: '/a', cor: 'azul'}]}));
  writeConfigPreservingExtras(file, normalize({courses: [{id: 'a', name: 'A2', path: '/a'}]}));
  const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(saved.minhaChave, 1);
  assert.equal(saved.courses[0].cor, 'azul');
  assert.equal(saved.courses[0].name, 'A2');
});

test('writeConfigPreservingExtras cria a pasta quando a config ainda não existe', () => {
  const file = path.join(tempDir('novo'), 'sub', 'config.json');
  writeConfigPreservingExtras(file, normalize({courses: []}));
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')).courses, []);
});
