/* Desfazer no Caderno de revisão (`desk/review.cjs` + `deletion-undo.cjs`).
 *
 * O caminho real: o aluno remove um item, o backend emite um token opaco com o
 * registro ORIGINAL e a agenda dele; o botão Desfazer devolve UMA entrada ao
 * mesmo caderno. Aqui rodamos o host com runtime temporário, sem Electron.
 *
 * Prova: identidade (mesma entrada, mesma posição), escopo trocado não desfaz,
 * vencimento, duplicata (não insere duas), edição independente preservada,
 * token inventado recusado e — o ponto sensível — o histórico de avaliação da
 * agenda sobrevive à remoção/desfazer sem um `sync` que recomece a agenda. */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {existsSync, mkdtempSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {buildStudyCores} from './study-core-build.mjs';
import {useUndoviewCore} from './undo-core-build.mjs';

useUndoviewCore();
const require = createRequire(import.meta.url);
const generated = (name) => fileURLToPath(new URL(`../src/generated/${name}.core.js`, import.meta.url));
if (!existsSync(generated('reviewschedule')) || !existsSync(generated('studystats'))) {
  const study = buildStudyCores();
  process.env.MESA_STUDYSTATS_CORE = study.corePath('studystats');
  process.env.MESA_REVIEWSCHEDULE_CORE = study.corePath('reviewschedule');
}
const review = require('../review.cjs');
const schedule = require('../src/study-data/review-schedule.cjs');

const TTL = 60000;
const fileOf = (runtime) => join(runtime, review.FILENAME);
const item = (question, extra = {}) => ({
  question,
  attempt: extra.attempt ?? '',
  difficulty: extra.difficulty ?? '',
  ref: extra.ref ?? {name: 'Limites.pdf', page: 3, path: '/p/Limites.pdf'},
});

function withRuntime(fn) {
  const runtime = mkdtempSync(join(tmpdir(), 'mesa-review-undo-'));
  try {
    return fn(runtime);
  } finally {
    rmSync(runtime, {recursive: true, force: true});
  }
}

function seed(runtime) {
  review.reviewSave(runtime, {courseId: 'A', mode: 'add', item: item('Primeiro')});
  review.reviewSave(runtime, {courseId: 'A', mode: 'add', item: item('Segundo', {ref: {name: 'Outro.pdf', page: 1, path: '/p/Outro.pdf'}})});
}

test('falha ao gravar o Caderno preserva o token para uma nova tentativa', () => {
  withRuntime(runtime => {
    seed(runtime);
    const before = review.readItems(runtime, 'A');
    const removed = review.reviewRemoveWithUndo(runtime, {courseId: 'A', mode: 'remove', item: item('Primeiro')});
    const write = fs.writeFileSync;
    try {
      fs.writeFileSync = (file, ...args) => {
        if (String(file).startsWith(fileOf(runtime))) throw Object.assign(new Error('disco cheio'), {code: 'ENOSPC'});
        return write(file, ...args);
      };
      assert.throws(() => review.reviewUndo(runtime, {courseId: 'A', token: removed.undoToken}), {code: 'ENOSPC'});
    } finally { fs.writeFileSync = write; }
    assert.equal(review.reviewUndo(runtime, {courseId: 'A', token: removed.undoToken}).ok, true);
    assert.deepEqual(review.readItems(runtime, 'A'), before);
  });
});

test('falha na agenda permite repetir a restauração sem duplicar o item', () => {
  withRuntime(runtime => {
    seed(runtime);
    const at = Date.UTC(2026, 0, 10, 12);
    const today = schedule.localDay(at, 0);
    const synced = schedule.sync(runtime, {courseId: 'A', items: review.readItems(runtime, 'A'), today, at, exists: () => true, allowed: () => true});
    const id = synced.items.find(one => one.question === 'Primeiro').id;
    schedule.grade(runtime, {courseId: 'A', id, result: 'bom', at, today});
    const graded = schedule.readStore(runtime).courses.A.items.find(one => one.id === id);
    const removed = review.reviewRemoveWithUndo(runtime, {courseId: 'A', mode: 'remove', item: item('Primeiro')});
    schedule.sync(runtime, {courseId: 'A', items: review.readItems(runtime, 'A'), today, at, exists: () => true, allowed: () => true});
    const write = fs.writeFileSync;
    try {
      fs.writeFileSync = (file, ...args) => {
        if (String(file).startsWith(join(runtime, schedule.FILENAME))) throw Object.assign(new Error('disco cheio'), {code: 'ENOSPC'});
        return write(file, ...args);
      };
      assert.throws(() => review.reviewUndo(runtime, {courseId: 'A', token: removed.undoToken}), {code: 'ENOSPC'});
    } finally { fs.writeFileSync = write; }
    assert.equal(review.reviewUndo(runtime, {courseId: 'A', token: removed.undoToken}).ok, true);
    assert.equal(review.readItems(runtime, 'A').filter(one => one.question === 'Primeiro').length, 1);
    const restored = schedule.readStore(runtime).courses.A.items.find(one => one.id === id);
    assert.equal(restored.active, true);
    assert.deepEqual(restored.history, graded.history);
    assert.equal(restored.due, graded.due);
  });
});

test('remover e desfazer devolve a MESMA entrada na mesma posição', () => {
  withRuntime((runtime) => {
    seed(runtime);
    const before = review.readItems(runtime, 'A');
    assert.deepEqual(before.map((one) => one.question), ['Segundo', 'Primeiro']);

    const removed = review.reviewRemoveWithUndo(runtime, {courseId: 'A', mode: 'remove', item: item('Primeiro')});
    assert.deepEqual(removed.items.map((one) => one.question), ['Segundo']);
    assert.equal(typeof removed.undoToken, 'string');
    assert.ok(removed.undoToken.length > 0);
    assert.ok(removed.undoExpiresAt > 0);
    assert.deepEqual(JSON.parse(readFileSync(fileOf(runtime), 'utf8')).A.map((one) => one.question), ['Segundo']);

    const undone = review.reviewUndo(runtime, {courseId: 'A', token: removed.undoToken});
    assert.equal(undone.ok, true);
    assert.equal(undone.restored, true);
    assert.deepEqual(review.readItems(runtime, 'A'), before, 'id, texto, referência e posição voltam iguais');
  });
});

test('alvo que não está mais no caderno não remove nem emite token (tela envelhecida)', () => {
  withRuntime((runtime) => {
    seed(runtime);
    const before = readFileSync(fileOf(runtime), 'utf8');
    const removed = review.reviewRemoveWithUndo(runtime, {courseId: 'A', mode: 'remove', item: item('Fantasma')});
    assert.equal(removed.undoToken, '');
    assert.equal(removed.undoExpiresAt, 0);
    assert.equal(readFileSync(fileOf(runtime), 'utf8'), before, 'nada foi regravado');
  });
});

test('escopo trocado não desfaz; o token continua valendo no caderno de origem', () => {
  withRuntime((runtime) => {
    seed(runtime);
    const removed = review.reviewRemoveWithUndo(runtime, {courseId: 'A', mode: 'remove', item: item('Primeiro')});
    const foreign = review.reviewUndo(runtime, {courseId: 'B', token: removed.undoToken});
    assert.deepEqual({ok: foreign.ok, reason: foreign.reason}, {ok: false, reason: 'scope'});
    assert.deepEqual(review.readItems(runtime, 'B'), []);
    assert.deepEqual(review.readItems(runtime, 'A').map((one) => one.question), ['Segundo'], 'recusa não consome o token');
    assert.equal(review.reviewUndo(runtime, {courseId: 'A', token: removed.undoToken}).ok, true);
    assert.deepEqual(review.readItems(runtime, 'A').map((one) => one.question), ['Segundo', 'Primeiro']);
  });
});

test('token vence no prazo do host e não desfaz depois', () => {
  withRuntime((runtime) => {
    seed(runtime);
    const removed = review.reviewRemoveWithUndo(runtime, {courseId: 'A', mode: 'remove', item: item('Primeiro'), at: 1000});
    assert.equal(removed.undoExpiresAt, 1000 + TTL);
    const late = review.reviewUndo(runtime, {courseId: 'A', token: removed.undoToken, at: 1000 + TTL});
    assert.deepEqual({ok: late.ok, reason: late.reason}, {ok: false, reason: 'expired'});
    assert.deepEqual(review.readItems(runtime, 'A').map((one) => one.question), ['Segundo']);
    assert.equal(review.reviewUndo(runtime, {courseId: 'A', token: removed.undoToken, at: 1000 + TTL + 1}).reason, 'unknown');
  });
  withRuntime((runtime) => {
    seed(runtime);
    const removed = review.reviewRemoveWithUndo(runtime, {courseId: 'A', mode: 'remove', item: item('Primeiro'), at: 1000});
    assert.equal(review.reviewUndo(runtime, {courseId: 'A', token: removed.undoToken, at: 1000 + TTL - 1}).ok, true);
  });
});

test('duplicata: item já de volta (mesma identidade) não vira dois registros', () => {
  withRuntime((runtime) => {
    seed(runtime);
    const removed = review.reviewRemoveWithUndo(runtime, {courseId: 'A', mode: 'remove', item: item('Primeiro')});
    /* O aluno guardou o mesmo item de novo antes de desfazer. */
    review.reviewSave(runtime, {courseId: 'A', mode: 'add', item: item('Primeiro')});
    const undone = review.reviewUndo(runtime, {courseId: 'A', token: removed.undoToken});
    assert.equal(undone.ok, true);
    assert.equal(undone.restored, false, 'identidade já presente: nada a inserir');
    assert.deepEqual(review.readItems(runtime, 'A').map((one) => one.question), ['Primeiro', 'Segundo'], 'sem duplicar');
    assert.equal(removed.undoToken && review.reviewUndo(runtime, {courseId: 'A', token: removed.undoToken}).reason, 'unknown', 'token consumido');
  });
});

test('edição independente feita entre a remoção e o desfazer fica preservada', () => {
  withRuntime((runtime) => {
    seed(runtime);
    const removed = review.reviewRemoveWithUndo(runtime, {courseId: 'A', mode: 'remove', item: item('Primeiro')});
    review.reviewSave(runtime, {
      courseId: 'A',
      mode: 'edit',
      key: item('Segundo', {ref: {name: 'Outro.pdf', page: 1, path: '/p/Outro.pdf'}}),
      item: item('Segundo (editado)', {ref: {name: 'Outro.pdf', page: 1, path: '/p/Outro.pdf'}}),
    });
    const undone = review.reviewUndo(runtime, {courseId: 'A', token: removed.undoToken});
    assert.equal(undone.ok, true);
    assert.deepEqual(review.readItems(runtime, 'A').map((one) => one.question), ['Segundo (editado)', 'Primeiro']);
  });
});

test('desfazer restaura a agenda por ID sem perder datas nem histórico', () => {
  withRuntime((runtime) => {
    const at = Date.UTC(2026, 0, 10, 12, 0, 0);
    const today = schedule.localDay(at, 0);
    review.reviewSave(runtime, {courseId: 'A', mode: 'add', item: item('Limites no infinito')});
    const synced = schedule.sync(runtime, {courseId: 'A', items: review.readItems(runtime, 'A'), today, at, exists: () => true, allowed: () => true});
    const id = synced.items[0].id;
    schedule.grade(runtime, {courseId: 'A', id, result: 'bom', at, today});
    const graded = schedule.readStore(runtime).courses.A.items.find((one) => one.id === id);
    assert.equal(graded.history.length, 1);

    const removed = review.reviewRemoveWithUndo(runtime, {courseId: 'A', mode: 'remove', item: item('Limites no infinito')});
    /* A releitura do pai (sync) marca o item como inativo, sem apagar nada. */
    schedule.sync(runtime, {courseId: 'A', items: review.readItems(runtime, 'A'), today, at: at + 1000, exists: () => true, allowed: () => true});
    const inactive = schedule.readStore(runtime).courses.A.items.find((one) => one.id === id);
    assert.equal(inactive.active, false, 'removido do caderno fica inativo na agenda');
    assert.equal(inactive.history.length, 1, 'o histórico não é apagado pela remoção');

    const undone = review.reviewUndo(runtime, {courseId: 'A', token: removed.undoToken});
    assert.equal(undone.ok, true);
    const restored = schedule.readStore(runtime).courses.A.items.find((one) => one.id === id);
    assert.equal(restored.active, true, 'o item volta ativo na agenda');
    assert.equal(restored.history.length, 1, 'histórico de avaliação preservado');
    assert.equal(restored.due, graded.due, 'a data agendada continua a mesma');
    assert.equal(restored.interval, graded.interval, 'o intervalo continua o mesmo');
    assert.equal(restored.lastResult, 'bom');
  });
});

test('modo diferente de remove não emite token e o array antigo continua igual', () => {
  withRuntime((runtime) => {
    const add = review.reviewSave(runtime, {courseId: 'A', mode: 'add', item: item('Limites')});
    assert.deepEqual(add.map((one) => one.question), ['Limites']);
    const wrapped = review.reviewRemoveWithUndo(runtime, {courseId: 'A', mode: 'edit', item: item('Limites')});
    assert.equal(wrapped.undoToken, '');
    assert.deepEqual(wrapped.items.map((one) => one.question), ['Limites']);
  });
});

test('token não atravessa conversa e material bloqueado não é restaurado', () => {
  withRuntime(runtime => {
    seed(runtime);
    const removed = review.reviewRemoveWithUndo(runtime, {courseId:'A',conversation:'first',mode:'remove',item:item('Primeiro')});
    assert.equal(review.reviewUndo(runtime,{courseId:'A',conversation:'second',token:removed.undoToken}).reason,'scope');
    assert.equal(review.reviewUndo(runtime,{courseId:'A',conversation:'first',token:removed.undoToken,authorized:()=>false}).reason,'unauthorized');
    assert.equal(review.reviewUndo(runtime,{courseId:'A',conversation:'first',token:removed.undoToken,authorized:()=>true}).ok,true);
  });
});
