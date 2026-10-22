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

function setup() {
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-free-host-'));
  runtimes.push(runtime);
  const live = {courseId: 'calc', course: '/c', session: '', freeSessionId: '', state: {theme: 'dark', free: {activeId: '', sessions: {}}},
    languageHost: {t: () => 'Nova conversa'}};
  let resets = 0;
  const host = createFreeSessionHost({live, runtime, FREE_ID: free.freeCourseId(), ggb: {resetRestored: () => { resets++; }},
    engine: () => 'pi', previewFile: () => ''});
  return {runtime, live, host, resets: () => resets};
}

test('applyFreeCourse cria a primeira sessão Livre e a torna ativa', () => {
  const {live, host, resets} = setup();
  host.applyFreeCourse();
  assert.equal(live.courseId, free.freeCourseId());
  assert.equal(live.course, '');
  assert.ok(live.freeSessionId);
  assert.equal(live.state.free.activeId, live.freeSessionId);
  assert.ok(live.session.endsWith('.jsonl'));
  assert.equal(resets(), 1);
});

test('persistFreeSession grava o rascunho no store e a lista mostra a sessão', () => {
  const {runtime, live, host} = setup();
  const record = host.createFreeSession('pi');
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
  assert.ok(record.nativePath.endsWith('.jsonl'));
  assert.equal(free.findWorkspace(runtime, id).nativePath, record.nativePath);
});
