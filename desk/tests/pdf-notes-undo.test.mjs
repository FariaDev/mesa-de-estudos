/* Desfazer nas Anotações de página (`desk/src/study-data/annotations.cjs`).
 *
 * O host guarda o item removido (id, datas, referência) atrás de um token
 * escopado à matéria/conversa e só reinsere a MESMA entrada se o escopo atual
 * continuar sendo o dela e o material continuar na biblioteca autorizada.
 * Runtime temporário, PDF de mentira; nada em `desk/src/generated` é tocado. */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {ptText} from './pt-text.mjs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {useUndoviewCore} from './undo-core-build.mjs';

useUndoviewCore();
const require = createRequire(import.meta.url);
const notes = require('../src/study-data/annotations.cjs');

const TTL = 60000;
const runtimes = [];
test.after(() => {
  for (const dir of runtimes) {
    try {
      fs.rmSync(dir, {recursive: true, force: true});
    } catch { /* já foi */ }
  }
});

function withNotes(fn) {
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-notes-undo-'));
  runtimes.push(runtime);
  const pdf = path.join(runtime, 'Limites.pdf');
  fs.writeFileSync(pdf, '%PDF-1.4\n');
  return fn({runtime, pdf, scope: {courseId: 'Calculo'}});
}

const baseItem = (pdf, extra = {}) => ({
  kind: extra.kind || 'nota',
  quote: extra.quote ?? 'trecho',
  note: extra.note ?? 'observação',
  ref: {name: extra.name ?? 'Limites.pdf', rel: extra.rel ?? 'Limites.pdf', path: extra.path ?? pdf, page: extra.page ?? 0},
});

const stored = (runtime) => JSON.parse(fs.readFileSync(notes.fileOf(runtime), 'utf8'));

test('falha ao gravar anotação preserva o token e todos os metadados', () => {
  withNotes(({runtime, pdf, scope}) => {
    const before = notes.saveNote(runtime, scope, {mode: 'add', authorizedPaths: [pdf], item: baseItem(pdf)});
    const removed = notes.notesRemoveWithUndo(runtime, scope, {id: before[0].id, authorizedPaths: [pdf]});
    const write = fs.writeFileSync;
    try {
      fs.writeFileSync = (file, ...args) => {
        if (String(file).startsWith(notes.fileOf(runtime))) throw Object.assign(new Error('disco cheio'), {code: 'ENOSPC'});
        return write(file, ...args);
      };
      assert.throws(() => notes.notesUndo(runtime, scope, {token: removed.undoToken, authorizedPaths: [pdf]}), {code: 'ENOSPC'});
    } finally { fs.writeFileSync = write; }
    assert.equal(notes.notesUndo(runtime, scope, {token: removed.undoToken, authorizedPaths: [pdf]}).ok, true);
    assert.deepEqual(notes.readNotes(runtime, scope), before);
  });
});

test('remover e desfazer devolve a MESMA anotação (id, datas e referência) na mesma posição', () => {
  withNotes(({runtime, pdf, scope}) => {
    const first = notes.saveNote(runtime, scope, {mode: 'add', authorizedPaths: [pdf], item: baseItem(pdf, {page: 1, note: 'antiga'})});
    const id = first[0].id;
    notes.saveNote(runtime, scope, {mode: 'add', authorizedPaths: [pdf], item: baseItem(pdf, {page: 2, note: 'segunda'})});
    const before = notes.readNotes(runtime, scope);
    assert.deepEqual(before.map((one) => one.id), [before[0].id, id]);

    const removed = notes.notesRemoveWithUndo(runtime, scope, {id, authorizedPaths: [pdf]});
    assert.equal(typeof removed.undoToken, 'string');
    assert.ok(removed.undoToken.length > 0);
    assert.deepEqual(removed.items.map((one) => one.id), [before[0].id]);

    const undone = notes.notesUndo(runtime, scope, {token: removed.undoToken, authorizedPaths: [pdf]});
    assert.equal(undone.ok, true);
    assert.equal(undone.restored, true);
    assert.deepEqual(notes.readNotes(runtime, scope), before, 'a mesma anotação, com as MESMAS datas e a mesma ordem');
    assert.equal(notes.readNotes(runtime, scope)[1].createdAt, before[1].createdAt);
    assert.equal(notes.readNotes(runtime, scope)[1].updatedAt, before[1].updatedAt);
  });
});

test('alvo desconhecido não remove nem emite token', () => {
  withNotes(({runtime, pdf, scope}) => {
    notes.saveNote(runtime, scope, {mode: 'add', authorizedPaths: [pdf], item: baseItem(pdf)});
    const before = fs.readFileSync(notes.fileOf(runtime), 'utf8');
    const removed = notes.notesRemoveWithUndo(runtime, scope, {id: 'n-fantasma', authorizedPaths: [pdf]});
    assert.equal(removed.undoToken, '');
    assert.equal(removed.undoExpiresAt, 0);
    assert.equal(fs.readFileSync(notes.fileOf(runtime), 'utf8'), before);
  });
});

test('PDF fora da biblioteca: desfazer restaura apenas o registro original do host', () => {
  withNotes(({runtime, pdf, scope}) => {
    const list = notes.saveNote(runtime, scope, {mode: 'add', authorizedPaths: [pdf], item: baseItem(pdf, {page: 1})});
    const removed = notes.notesRemoveWithUndo(runtime, scope, {id: list[0].id, authorizedPaths: [pdf]});
    const restored = notes.notesUndo(runtime, scope, {token: removed.undoToken, authorizedPaths: []});
    assert.equal(restored.ok, true);
    assert.deepEqual(restored.items, list, 'referência órfã preservada, sem acesso novo ao PDF');
    assert.throws(() => notes.saveNote(runtime, scope, {mode: 'add', authorizedPaths: [], item: baseItem(pdf)}), (error) => /autorizad/.test(ptText(error.message)));
  });
});

test('anotação sem PDF continua desfazendo sem biblioteca', () => {
  withNotes(({runtime, scope}) => {
    const list = notes.saveNote(runtime, scope, {mode: 'add', authorizedPaths: [], item: baseItem(runtime, {path: '', name: '', rel: ''})});
    assert.equal(list[0].ref.path, '');
    const removed = notes.notesRemoveWithUndo(runtime, scope, {id: list[0].id, authorizedPaths: []});
    const undone = notes.notesUndo(runtime, scope, {token: removed.undoToken, authorizedPaths: []});
    assert.equal(undone.ok, true);
    assert.equal(notes.readNotes(runtime, scope).length, 1);
  });
});

test('escopo trocado (matéria ou conversa Livre) não desfaz; a origem continua valendo', () => {
  withNotes(({runtime, pdf, scope}) => {
    const list = notes.saveNote(runtime, scope, {mode: 'add', authorizedPaths: [pdf], item: baseItem(pdf)});
    const removed = notes.notesRemoveWithUndo(runtime, scope, {id: list[0].id, authorizedPaths: [pdf]});
    const otherCourse = notes.notesUndo(runtime, {courseId: 'Fisica'}, {token: removed.undoToken, authorizedPaths: [pdf]});
    assert.deepEqual({ok: otherCourse.ok, reason: otherCourse.reason}, {ok: false, reason: 'scope'});
    assert.deepEqual(notes.readNotes(runtime, scope), [], 'outra matéria não reabre a anotação');
    assert.equal(notes.notesUndo(runtime, scope, {token: removed.undoToken, authorizedPaths: [pdf]}).ok, true);
  });
  withNotes(({runtime, pdf}) => {
    const freeA = {courseId: 'mesa-free', freeSessionId: 'sess-1'};
    const freeB = {courseId: 'mesa-free', freeSessionId: 'sess-2'};
    const list = notes.saveNote(runtime, freeA, {mode: 'add', authorizedPaths: [pdf], item: baseItem(pdf)});
    const removed = notes.notesRemoveWithUndo(runtime, freeA, {id: list[0].id, authorizedPaths: [pdf]});
    const otherFree = notes.notesUndo(runtime, freeB, {token: removed.undoToken, authorizedPaths: [pdf]});
    assert.deepEqual({ok: otherFree.ok, reason: otherFree.reason}, {ok: false, reason: 'scope'});
    assert.equal(notes.notesUndo(runtime, freeA, {token: removed.undoToken, authorizedPaths: [pdf]}).ok, true);
  });
});

test('token vence no prazo do host', () => {
  withNotes(({runtime, pdf, scope}) => {
    const list = notes.saveNote(runtime, scope, {mode: 'add', authorizedPaths: [pdf], item: baseItem(pdf)});
    const removed = notes.notesRemoveWithUndo(runtime, scope, {id: list[0].id, authorizedPaths: [pdf], at: 2000});
    assert.equal(removed.undoExpiresAt, 2000 + TTL);
    const late = notes.notesUndo(runtime, scope, {token: removed.undoToken, authorizedPaths: [pdf], at: 2000 + TTL});
    assert.deepEqual({ok: late.ok, reason: late.reason}, {ok: false, reason: 'expired'});
    assert.deepEqual(notes.readNotes(runtime, scope), []);
  });
});

test('duplicata: desfazer duas vezes (ou com a id já presente) não cria duas entradas', () => {
  withNotes(({runtime, pdf, scope}) => {
    const list = notes.saveNote(runtime, scope, {mode: 'add', authorizedPaths: [pdf], item: baseItem(pdf)});
    const removed = notes.notesRemoveWithUndo(runtime, scope, {id: list[0].id, authorizedPaths: [pdf]});
    assert.equal(notes.notesUndo(runtime, scope, {token: removed.undoToken, authorizedPaths: [pdf]}).ok, true);
    const again = notes.notesUndo(runtime, scope, {token: removed.undoToken, authorizedPaths: [pdf]});
    assert.deepEqual({ok: again.ok, reason: again.reason}, {ok: false, reason: 'unknown'});
    assert.equal(notes.readNotes(runtime, scope).length, 1, 'token consumido não duplica');
  });
  withNotes(({runtime, pdf, scope}) => {
    const list = notes.saveNote(runtime, scope, {mode: 'add', authorizedPaths: [pdf], item: baseItem(pdf)});
    const original = notes.readNotes(runtime, scope)[0];
    const removed = notes.notesRemoveWithUndo(runtime, scope, {id: list[0].id, authorizedPaths: [pdf]});
    /* A id voltou por fora (ex.: backup/import); o Desfazer só reconhece a identidade. */
    const bucket = stored(runtime);
    bucket[notes.scopeOf(scope)] = [original, ...(bucket[notes.scopeOf(scope)] || [])];
    fs.writeFileSync(notes.fileOf(runtime), JSON.stringify(bucket));
    const undone = notes.notesUndo(runtime, scope, {token: removed.undoToken, authorizedPaths: [pdf]});
    assert.equal(undone.ok, true);
    assert.equal(undone.restored, false);
    assert.equal(notes.readNotes(runtime, scope).length, 1, 'identidade já presente: não insere de novo');
  });
});

test('edição independente feita entre a remoção e o desfazer fica preservada', () => {
  withNotes(({runtime, pdf, scope}) => {
    const antiga = notes.saveNote(runtime, scope, {mode: 'add', authorizedPaths: [pdf], item: baseItem(pdf, {page: 1, note: 'antiga'})});
    const segunda = notes.saveNote(runtime, scope, {mode: 'add', authorizedPaths: [pdf], item: baseItem(pdf, {page: 2, note: 'segunda'})});
    const removed = notes.notesRemoveWithUndo(runtime, scope, {id: antiga[0].id, authorizedPaths: [pdf]});
    notes.saveNote(runtime, scope, {mode: 'edit', id: segunda[0].id, authorizedPaths: [pdf], item: baseItem(pdf, {page: 2, note: 'segunda (editada)'})});
    const undone = notes.notesUndo(runtime, scope, {token: removed.undoToken, authorizedPaths: [pdf]});
    assert.equal(undone.ok, true);
    const list = notes.readNotes(runtime, scope);
    assert.deepEqual(list.map((one) => one.note), ['segunda (editada)', 'antiga'], 'a edição da outra anotação sobrevive');
  });
});

test('anotação de matéria não pode ser desfeita em outra conversa da mesma matéria', () => {
  withNotes(({runtime,pdf,scope}) => {
    const first={...scope,conversation:'first'}, second={...scope,conversation:'second'};
    const items=notes.saveNote(runtime,first,{mode:'add',authorizedPaths:[pdf],item:baseItem(pdf)});
    const removed=notes.notesRemoveWithUndo(runtime,first,{id:items[0].id,authorizedPaths:[pdf]});
    assert.equal(notes.notesUndo(runtime,second,{token:removed.undoToken,authorizedPaths:[pdf]}).reason,'scope');
    assert.equal(notes.notesUndo(runtime,first,{token:removed.undoToken,authorizedPaths:[pdf]}).ok,true);
  });
});
