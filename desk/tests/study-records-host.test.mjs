// Registros de estudo da matéria ativa (#43 fase 2: saíram do main.cjs).
import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import {ptMatches} from './pt-text.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fakeIpcMain} from './fake-electron-shell.mjs';
import * as fx from './claude-fixtures.mjs';

const require = createRequire(import.meta.url);
const {registerStudyRecordsHost} = require('../study-records-host.cjs');
const resume = require('../resume.cjs');
const bookmarks = require('../bookmarks.cjs');

const dirs = [];
after(() => { for (const dir of dirs) fs.rmSync(dir, {recursive: true, force: true}); });

function studyRecordsHost({engine = 'pi', sdk = null} = {}) {
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-records-'));
  dirs.push(runtime);
  const ipcMain = fakeIpcMain();
  const allowed = new Set(['/p/Limites.pdf']);
  const guards = [];
  const live = {courseId: 'calc', session: path.join(runtime, 's.jsonl'), bridge: null, languageHost: {tutorLanguage: () => 'pt-BR'}, opencodeHost: {keyEnv: () => ({})}};
  const host = registerStudyRecordsHost({ipcMain, live, runtime, allowed, allowedXopp: new Set(['/x/q.xopp']), appendLog: () => {},
    engine: () => engine, piBinary: () => '', claudeBinary: () => null, claudeDetector: () => null, testClaudeSdkLoader: () => (sdk ? async () => sdk : null), bookmarksPayload: () => bookmarks.readBookmarks(runtime, live.courseId).filter(item => allowed.has(item.path)),
    reviewPayload: () => [], assertNoFreeMutation: () => guards.push('free'), assertNoNav: () => guards.push('nav')});
  return {host, ipcMain, runtime, guards};
}

test('pending-save e tray-save recusam forma inválida', async () => {
  const {ipcMain} = studyRecordsHost();
  await assert.rejects(async () => ipcMain.invoke('pending-save', {items: 'x'}), ptMatches(/Pedido inválido em pending-save: items recebeu "x"/));
  await assert.rejects(async () => ipcMain.invoke('tray-save', {images: Array(17).fill({})}), ptMatches(/images recebeu array\(17\); esperado array\(0\.\.16\)/));
});

test('end-day-save só guarda páginas da biblioteca e o .xopp autorizado', async () => {
  const {ipcMain, runtime} = studyRecordsHost();
  await ipcMain.invoke('end-day-save', {record: {stopped: 'parei', next: 'seguir', xopp: '/x/outro.xopp', pages: [{path: '/p/Limites.pdf', page: 2}, {path: '/p/fora.pdf', page: 1}]}});
  const saved = resume.readResume(runtime, 'calc');
  assert.deepEqual(saved.pages.map(ref => ref.path), ['/p/Limites.pdf']);
  assert.equal(saved.xopp, '');
  await ipcMain.invoke('resume-clear');
  assert.equal(resume.readResume(runtime, 'calc'), null);
});

test('bookmarks-save adiciona, remove e devolve a lista filtrada', async () => {
  const {ipcMain} = studyRecordsHost();
  const added = await ipcMain.invoke('bookmarks-save', {item: {name: 'Limites', path: '/p/Limites.pdf', page: 3}});
  assert.equal(added.length, 1);
  assert.deepEqual(await ipcMain.invoke('bookmarks-save', {mode: 'remove', item: added[0]}), []);
});

test('review-draft no Claude roda numa consulta temporária, sem ferramenta, e apaga a pasta (#58)', async () => {
  const sdk = fx.fakeSdk();
  const {ipcMain, runtime} = studyRecordsHost({engine: 'claude', sdk});
  const draft = ipcMain.invoke('review-draft', {id: 'r1', question: 'Quanto é 2 + 2?', attempt: '', answer: 'É 4.'});
  await fx.waitFor(() => sdk.state.queries.length === 1, 2000, 'consulta temporária');
  const query = sdk.state.queries[0];
  assert.deepEqual(query.options.tools, []);
  assert.equal(query.options.persistSession, false);
  assert.match(path.basename(query.options.cwd), /^\.review-draft-/);
  const item = await fx.takeInput(query);
  query.emit(fx.replayMessage(item));
  query.emit(fx.assistantMessage({text: '{"question":"Quanto é 2 + 2?","attempt":"","difficulty":"Conta simples"}'}));
  query.emit(fx.resultMessage({userMessageUuid: item.uuid}));
  assert.equal((await draft).difficulty, 'Conta simples');
  assert.deepEqual(fs.readdirSync(runtime).filter((name) => name.startsWith('.review-draft-')), [], 'a pasta temporária sai');
});

test('review-draft sem resposta selecionada recusa; review-save passa pelas guardas', async () => {
  const {ipcMain, guards, host} = studyRecordsHost({engine: 'claude'});
  await assert.rejects(async () => ipcMain.invoke('review-draft', {id: 'r1'}));
  await assert.rejects(async () => ipcMain.invoke('review-save', {mode: 'add', item: {}}));
  assert.deepEqual(guards, ['free', 'nav']);
  host.cancelReviewDraft();
});
