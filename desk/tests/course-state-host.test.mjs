// Host de matéria e estado da mesa (#43 fase 2: saiu do main.cjs). Runtime
// sintético em pasta temporária; o `live` é um objeto simples no lugar do main.
import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {createCourseStateHost} = require('../course-state-host.cjs');

const dirs = [];
after(() => { for (const dir of dirs) fs.rmSync(dir, {recursive: true, force: true}); });

/** Cache do GeoGebra em memória, no formato de ggb-cache.cjs. */
function memoryGgbCache() {
  const saved = new Map();
  return {saved, persist: (id, value) => saved.set(id, value), read: id => saved.get(id) || '', remember: (id, value) => saved.set(id, value)};
}

function courseStateHost({courseStates = {}, live: liveOverrides = {}} = {}) {
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-course-state-'));
  dirs.push(runtime);
  const live = {config: {courses: []}, courses: [{id: 'calc', name: 'Cálculo', path: path.join(runtime, 'calc')}, {id: 'fis', name: 'Física', path: ''}],
    courseId: 'calc', course: '', session: path.join(runtime, 'a.jsonl'), state: {theme: 'dark', study: {}, pdfs: []}, win: null, freeSessionId: '',
    freeMutation: false, deferredPersist: false, lastPersist: '', languageHost: {payload: () => ({lang: 'pt-BR'})}, ...liveOverrides};
  const ggbCache = memoryGgbCache();
  const calls = [];
  const host = createCourseStateHost({live, runtime, FREE_ID: '__free__', stateFile: path.join(runtime, 'desk.json'), courseStates,
    allowed: new Set(), allowedXopp: new Set(), ggb: {resetRestored: () => calls.push('ggb-reset')}, ggbCache, appendLog: () => {},
    previewFile: () => '', sessionInfo: () => ({}), conversationData: () => ({}), piBinary: () => '', freeSessionList: () => [],
    persistFreeSession: () => calls.push('free-persist'), applyFreeCourse: () => calls.push('free-apply'), freeWorkspacePayload: () => null,
    captureAvailable: () => false, deskVersionLabel: () => 'v-teste'});
  return {host, live, runtime, courseStates, ggbCache, calls};
}

test('persist grava o desk.json da matéria e guarda o último payload', () => {
  const {host, live, runtime, courseStates} = courseStateHost();
  host.persist();
  const written = fs.readFileSync(path.join(runtime, 'desk.json'), 'utf8');
  assert.equal(JSON.parse(written).courseId, 'calc');
  assert.equal(live.lastPersist, written, 'o mesmo payload não é regravado na próxima chamada');
  assert.ok(courseStates.calc, 'o estado da matéria ativa entra em courseStates');
});

test('persist durante mutação Livre só adia; com force grava', () => {
  const {host, live, runtime} = courseStateHost({live: {freeMutation: true}});
  host.persist();
  assert.equal(live.deferredPersist, true);
  assert.equal(fs.existsSync(path.join(runtime, 'desk.json')), false);
  host.persist(true);
  assert.ok(fs.existsSync(path.join(runtime, 'desk.json')));
});

test('applyCourse troca para a matéria salva e Livre vai para o host da aba Livre', () => {
  const {host, live, calls} = courseStateHost({courseStates: {fis: {session: '/x/fis.jsonl', draft: 'equação', pdfs: []}}});
  host.applyCourse('fis');
  assert.equal(live.courseId, 'fis');
  assert.equal(live.session, '/x/fis.jsonl');
  assert.equal(live.state.draft, 'equação');
  assert.equal(live.state.theme, 'dark');
  host.applyCourse('__free__');
  assert.deepEqual(calls, ['ggb-reset', 'free-apply']);
  host.applyCourse('sumiu');
  assert.equal(live.courseId, '');
});

test('rememberPdfModel lembra o modelo por matéria e ignora modelo desconhecido', () => {
  const {host} = courseStateHost();
  host.rememberPdfModel({model: 'nao-existe'});
  assert.equal(host.lastPdfModel(), null);
  const known = require('../material-model.cjs').MODEL_IDS[0];
  host.rememberPdfModel({model: known});
  assert.equal(host.lastPdfModel().model, known);
});

test('initialData monta o payload da matéria com sessão, versão e matérias', () => {
  const {host, live} = courseStateHost();
  const payload = host.initialData();
  assert.equal(payload.course, 'Cálculo');
  assert.equal(payload.session, live.session);
  assert.equal(payload.deskVersion, 'v-teste');
  assert.deepEqual(payload.courses.map(item => item.id), ['__free__', 'calc', 'fis']);
  assert.equal(host.materialContext(), 'Cálculo');
});
