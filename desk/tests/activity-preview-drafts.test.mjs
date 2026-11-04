import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const {DRAFT_TTL_MS, MAX_DRAFTS, isDraftId, createActivityPreviewDrafts} = require('../activity-preview-drafts.cjs');

const CONTENT = {html: '<p>x</p>', css: 'p{color:red}', js: 'mesa.ready();', katex: false, kind: 'visualizacao', charts: true, title: 'não entra', objective: 'não entra'};

test('rascunho: id opaco, conteúdo da prévia e escopo da conversa', () => {
  const drafts = createActivityPreviewDrafts();
  const id = drafts.remember({conversationId: 'conversa-a'}, CONTENT);
  assert.equal(isDraftId(id), true);
  assert.match(id, /^prv-[a-z0-9]{8,24}$/);
  const content = drafts.resolve({conversationId: 'conversa-a'}, id);
  assert.deepEqual(content, {html: CONTENT.html, css: CONTENT.css, js: CONTENT.js, katex: false, kind: 'visualizacao', charts: true});
  assert.equal(drafts.resolve({conversationId: 'conversa-b'}, id), null, 'não cruza conversa');
  assert.equal(drafts.resolve({conversationId: 'conversa-a'}, 'inventado'), null);
  assert.equal(drafts.size(), 1);
});

test('rascunho: 30 minutos por padrão e o mais antigo sai quando o teto aperta', () => {
  let clock = 1000;
  const drafts = createActivityPreviewDrafts({ttlMs: 100, max: 2, now: () => clock});
  const first = drafts.remember({conversationId: 'c'}, CONTENT);
  clock += 50;
  const second = drafts.remember({conversationId: 'c'}, CONTENT);
  clock += 50;
  const third = drafts.remember({conversationId: 'c'}, CONTENT);
  assert.equal(drafts.resolve({conversationId: 'c'}, first), null, 'o mais antigo saiu');
  assert.notEqual(drafts.resolve({conversationId: 'c'}, second), null);
  assert.notEqual(drafts.resolve({conversationId: 'c'}, third), null);
  clock += 101;
  assert.equal(drafts.resolve({conversationId: 'c'}, second), null, 'venceu');
  drafts.clear();
  assert.equal(drafts.size(), 0);
  assert.equal(DRAFT_TTL_MS, 30 * 60 * 1000, 'meia hora cobre montar, pré-visualizar e corrigir');
  assert.ok(MAX_DRAFTS >= 8);
});

test('rascunho: sem conversa não há id; cópia não muda o guardado', () => {
  const drafts = createActivityPreviewDrafts();
  assert.throws(() => drafts.remember({}, CONTENT), /conversationId/);
  const id = drafts.remember({conversationId: 'c'}, CONTENT);
  const copy = drafts.resolve({conversationId: 'c'}, id);
  copy.html = '<p>mudou</p>';
  assert.equal(drafts.resolve({conversationId: 'c'}, id).html, CONTENT.html);
});
