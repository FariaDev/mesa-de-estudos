// Sessões da aba Livre que saíram do main.cjs (#43 fase 2), num runtime temporário.
import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {createFreeSessionHost} = require('../free-session-host.cjs');
const free = require('../free-workspaces.cjs');

const runtimes = [];
after(() => { for (const dir of runtimes) fs.rmSync(dir, {recursive: true, force: true}); });

function setup({engine = () => 'opencode'} = {}) {
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-free-host-'));
  runtimes.push(runtime);
  const live = {courseId: 'calc', course: '/c', session: '', freeSessionId: '', state: {theme: 'dark', free: {activeId: '', sessions: {}}},
    languageHost: {t: () => 'Nova conversa'}};
  let resets = 0;
  const host = createFreeSessionHost({live, runtime, FREE_ID: free.freeCourseId(), ggb: {resetRestored: () => { resets++; }},
    engine, defaultEngine: () => 'opencode', visibleEngines: () => ['opencode'], previewFile: () => ''});
  return {runtime, live, host, resets: () => resets};
}

test('applyFreeCourse cria a primeira sessão Livre e a torna ativa', () => {
  const {live, host, resets} = setup();
  host.applyFreeCourse();
  assert.equal(live.courseId, free.freeCourseId());
  assert.equal(live.course, '');
  assert.ok(live.freeSessionId);
  assert.equal(live.state.free.activeId, live.freeSessionId);
  assert.ok(live.session.endsWith('.json'));
  assert.equal(resets(), 1);
});

test('persistFreeSession grava o rascunho no store e a lista mostra a sessão', () => {
  const {runtime, live, host} = setup();
  const record = host.createFreeSession('opencode');
  live.state.draft = 'rascunho da Livre';
  host.persistFreeSession();
  assert.equal(free.findWorkspace(runtime, record.id).draft, 'rascunho da Livre');
  const listed = host.freeSessionList();
  assert.equal(listed.length, 1);
  assert.equal(listed[0].path, live.session);
  assert.equal(host.freeRecordForToken(`free-session:${record.id}`).id, record.id);
});

test('focusFreeMaterial põe o material no primeiro leitor sem mexer no segundo', () => {
  const {live, host} = setup();
  live.state.pdfs = [null, {path: '/b.pdf'}];
  host.focusFreeMaterial({path: '/a.pdf'});
  assert.equal(live.state.pdfs[0].path, '/a.pdf');
  assert.equal(live.state.pdfs[1].path, '/b.pdf');
});

/* Regressão (#43 fase 3, achado pelo tsc): a fase 2 levou `ensureFreeNativePath`
   para este host sem devolvê-lo, e o main ainda o chamava ao abrir uma sessão
   Livre sem caminho nativo, o que dava ReferenceError. */
test('ensureFreeNativePath dá caminho nativo à sessão Livre que não tem', () => {
  const {runtime, host} = setup();
  const id = 'sem-nativo-0001';
  free.createWorkspace(runtime, {sessionId: id, title: 'Sem caminho'});
  const record = host.ensureFreeNativePath(free.findWorkspace(runtime, id));
  assert.ok(record.nativePath.endsWith('.json'));
  assert.equal(free.findWorkspace(runtime, id).nativePath, record.nativePath);
});

/* Revisão do release: abrir o Livre trocava o caminho da conversa do Pi por um
   descritor novo; o JSONL ficava no disco, mas sumia da lista. */
const engineByExtension = (file) => String(file).endsWith('.jsonl') ? 'pi' : 'opencode';

function legacyPiRecord(runtime) {
  const id = 'conversa-pi-antiga';
  const file = path.join(runtime, 'free', id, 'pi-old.jsonl');
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file, '{"type":"session"}\n');
  free.ensureWorkspace(runtime, {sessionId: id, title: 'Conversa do Pi'});
  free.setNativePath(runtime, id, file);
  return {id, file};
}

test('abrir o Livre com conversa do Pi ativa cria outra e mantém a antiga na lista', () => {
  const {runtime, live, host} = setup({engine: engineByExtension});
  const {id, file} = legacyPiRecord(runtime);
  live.state.free = {activeId: id, sessions: {}};
  host.applyFreeCourse();
  assert.equal(free.findWorkspace(runtime, id).nativePath, file);
  assert.notEqual(live.freeSessionId, id);
  assert.ok(live.session.endsWith('.json'));
  assert.ok(host.freeSessionList().some((entry) => entry.path === file));
});

test('abrir o Livre com conversa do Pi ativa prefere uma conversa atual já existente', () => {
  const {runtime, live, host} = setup({engine: engineByExtension});
  const current = host.createFreeSession('opencode');
  const {id} = legacyPiRecord(runtime);
  live.state.free = {...live.state.free, activeId: id};
  assert.equal(host.ensureFreeRecord().id, current.id);
  assert.equal(free.listWorkspaces(runtime).length, 2);
});

/* 3ª revisão do release: o Claude está no código, fora da vista; o fallback do
   Livre não pode pôr uma conversa dele como ativa sem aviso. */
test('o Livre não elege conversa de motor fora da vista quando a ativa é antiga', () => {
  const claudeFile = (runtime, id) => path.join(runtime, 'free', id, 'claude-11111111-1111-1111-1111-111111111111.json');
  const {runtime, live, host} = setup({engine: (file) => path.basename(String(file)).split('-')[0]});
  free.ensureWorkspace(runtime, {sessionId: 'conversa-claude', title: 'Claude'});
  free.setNativePath(runtime, 'conversa-claude', claudeFile(runtime, 'conversa-claude'));
  const {id} = legacyPiRecord(runtime);
  live.state.free = {activeId: id, sessions: {}};
  const chosen = host.ensureFreeRecord();
  assert.match(path.basename(chosen.nativePath), /^opencode-/);
});
