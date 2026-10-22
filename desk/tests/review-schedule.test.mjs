/* Agenda do caderno de revisão (Mesa) — `runtime/review-schedule.json`.

   O caminho real: o caderno (`runtime/review.json`, schema antigo) guarda o
   item; `sync` migra o que falta para a agenda (vencendo HOJE, nada escondido),
   a aba Caderno mostra "Revisar hoje" e o aluno marca Errei/Difícil/Bom/Fácil;
   `grade` agenda a próxima revisão com o núcleo `core/reviewschedule.bend`
   (leis em `core/laws/reviewschedule.bend`) e guarda o histórico.

   Este teste prova o HOST: migração determinística e idempotente, id estável,
   dedupe, datas determinísticas por dia civil, referência visível (nunca
   filtrada), itens fora do caderno preservados e sanitização. */

import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRequire} from 'node:module';
import {buildStudyCores} from './study-core-build.mjs';
import {ptText} from './pt-text.mjs';

const built = buildStudyCores({entries: ['studystats.bend', 'reviewschedule.bend']});
process.env.MESA_STUDYSTATS_CORE = built.corePath('studystats');
process.env.MESA_REVIEWSCHEDULE_CORE = built.corePath('reviewschedule');
const require = createRequire(import.meta.url);
const schedule = require('../src/study-data/review-schedule.cjs');

const AT = Date.UTC(2026, 0, 10, 12, 0, 0);
const DAY = 86400000;
const TODAY = schedule.localDay(AT, 0);
const fileOf = (runtime) => join(runtime, schedule.FILENAME);
const stored = (runtime) => JSON.parse(readFileSync(fileOf(runtime), 'utf8'));

function withRuntime(fn) {
  const runtime = mkdtempSync(join(tmpdir(), 'mesa-review-schedule-'));
  try {
    return fn(runtime);
  } finally {
    rmSync(runtime, {recursive: true, force: true});
  }
}

const item = (question, extra = {}) => ({
  question,
  attempt: extra.attempt ?? '',
  difficulty: extra.difficulty ?? '',
  ref: extra.ref ?? {name: 'Limites.pdf', page: 3, path: '/p/Limites.pdf'},
});

test('sem arquivo a agenda é vazia e a leitura não cria nada', () => {
  withRuntime((runtime) => {
    assert.deepEqual(schedule.listItems(runtime, {courseId: 'A', today: TODAY}), []);
    assert.equal(existsSync(fileOf(runtime)), false);
  });
});

test('arquivo corrompido não derruba a leitura', () => {
  withRuntime((runtime) => {
    writeFileSync(fileOf(runtime), 'não é json');
    const {dueLabel, ...counts} = schedule.summary(runtime, {courseId: 'A', today: TODAY});
    assert.deepEqual(counts, {due: 0, total: 0, active: 0, inactive: 0, history: 0});
    assert.equal(ptText(dueLabel), 'nada para revisar hoje');
  });
});

test('id estável: o mesmo item dá o mesmo id; questão ou referência muda o id', () => {
  const base = schedule.stableId(item('Limites no infinito'));
  assert.equal(schedule.stableId(item('  Limites no infinito  ')), base, 'o núcleo apara os textos da chave');
  assert.notEqual(schedule.stableId(item('Outra questão')), base);
  assert.notEqual(schedule.stableId(item('Limites no infinito', {ref: {name: 'Outro.pdf', page: 3, path: '/p/Outro.pdf'}})), base);
  assert.match(base, /^[0-9a-f]{16}$/);
});

test('migração: cria vencendo hoje, idempotente e preservando o texto do caderno', () => {
  withRuntime((runtime) => {
    const items = [item('Limites no infinito', {attempt: 'dividi por x²', difficulty: 'não vi a fatoração'}), item('Derivadas')];
    const first = schedule.sync(runtime, {courseId: 'A', items, today: TODAY, at: AT});
    assert.equal(first.added, 2);
    assert.equal(first.kept, 0);
    assert.deepEqual(first.items.map((one) => one.due), [TODAY, TODAY]);
    assert.deepEqual(first.items.map((one) => one.interval), [0, 0]);

    const second = schedule.sync(runtime, {courseId: 'A', items, today: TODAY, at: AT + 1000});
    assert.equal(second.added, 0, 'sincronizar de novo não duplica');
    assert.equal(second.kept, 2);
    assert.equal(second.items.length, 2);

    const rich = first.items.find((one) => one.question === 'Limites no infinito');
    assert.equal(rich.attempt, 'dividi por x²');
    assert.equal(rich.difficulty, 'não vi a fatoração');
    assert.equal(rich.ref.path, '/p/Limites.pdf');
    assert.deepEqual(rich.history, []);
    assert.equal(rich.active, true);
  });
});

test('migração é determinística entre execuções (mesmos ids no arquivo)', () => {
  const items = [item('Limites'), item('Derivadas')];
  const ids = [];
  for (let run = 0; run < 2; run += 1) {
    withRuntime((runtime) => {
      schedule.sync(runtime, {courseId: 'A', items, today: TODAY, at: AT});
      ids.push(stored(runtime).courses.A.items.map((one) => one.id).sort());
    });
  }
  assert.deepEqual(ids[0], ids[1]);
});

test('o caderno manda no texto; a agenda manda nas datas', () => {
  withRuntime((runtime) => {
    schedule.sync(runtime, {courseId: 'A', items: [item('Limites')], today: TODAY, at: AT});
    schedule.grade(runtime, {courseId: 'A', id: schedule.stableId(item('Limites')), result: 'bom', at: AT, today: TODAY});
    const edited = schedule.sync(runtime, {
      courseId: 'A',
      items: [item('Limites', {attempt: 'agora com tentativa'})],
      today: TODAY + 5,
      at: AT + DAY,
    });
    const one = edited.items[0];
    assert.equal(one.attempt, 'agora com tentativa');
    assert.equal(one.due, TODAY + 1, 'a data agendada continua');
    assert.equal(one.history.length, 1);
  });
});

test('item que sai do caderno fica inativo com histórico; item que volta reativa', () => {
  withRuntime((runtime) => {
    schedule.sync(runtime, {courseId: 'A', items: [item('Limites'), item('Derivadas')], today: TODAY, at: AT});
    schedule.grade(runtime, {courseId: 'A', id: schedule.stableId(item('Derivadas')), result: 'facil', at: AT, today: TODAY});
    const removed = schedule.sync(runtime, {courseId: 'A', items: [item('Limites')], today: TODAY, at: AT + DAY});
    const gone = removed.items.find((one) => one.question === 'Derivadas');
    assert.equal(gone.active, false);
    assert.equal(gone.history.length, 1, 'o histórico do item removido continua guardado');
    assert.equal(schedule.listItems(runtime, {courseId: 'A', today: TODAY + 1}).length, 2, 'a lista mostra os dois (um inativo)');
    assert.deepEqual(schedule.dueItems(runtime, {courseId: 'A', today: TODAY + 1}).map((one) => one.question), ['Limites'], 'vencidos saem só dos ativos');

    const back = schedule.sync(runtime, {courseId: 'A', items: [item('Limites'), item('Derivadas')], today: TODAY + 2, at: AT + 2 * DAY});
    assert.equal(back.items.find((one) => one.question === 'Derivadas').active, true);
    assert.equal(back.items.find((one) => one.question === 'Derivadas').history.length, 1);
  });
});

test('marcar o resultado agenda a próxima revisão e guarda o histórico', () => {
  withRuntime((runtime) => {
    schedule.sync(runtime, {courseId: 'A', items: [item('Limites')], today: TODAY, at: AT});
    const id = schedule.stableId(item('Limites'));

    const first = schedule.grade(runtime, {courseId: 'A', id, result: 'bom', at: AT, today: TODAY});
    assert.equal(first.nextDue, TODAY + 1);
    assert.equal(first.item.interval, 1);
    assert.equal(first.item.reps, 1);
    assert.equal(first.item.lapses, 0);
    assert.equal(first.item.lastResult, 'bom');
    assert.equal(ptText(first.explain), 'Bom: primeira revisão amanhã (1 dia).');
    assert.equal(ptText(first.nextLabel), 'amanhã');
    assert.deepEqual(first.item.history, [{day: TODAY, result: 'bom', at: AT}]);

    const second = schedule.grade(runtime, {courseId: 'A', id, result: 'bom', at: AT + DAY, today: TODAY + 1});
    assert.equal(second.nextDue, TODAY + 3, '1 dia cresce para 2');
    assert.equal(second.item.reps, 2);
    assert.deepEqual(second.item.history.map((log) => log.day), [TODAY + 1, TODAY]);

    const failed = schedule.grade(runtime, {courseId: 'A', id, result: 'errei', at: AT + 2 * DAY, today: TODAY + 2});
    assert.equal(failed.nextDue, TODAY + 3, 'errei volta para 1 dia');
    assert.equal(failed.item.reps, 0);
    assert.equal(failed.item.lapses, 1);
    assert.equal(ptText(failed.explain), 'Errei: volta amanhã (1 dia).');
  });
});

test('resultado inválido e item inexistente são recusados sem gravar', () => {
  withRuntime((runtime) => {
    schedule.sync(runtime, {courseId: 'A', items: [item('Limites')], today: TODAY, at: AT});
    assert.throws(
      () => schedule.grade(runtime, {courseId: 'A', id: schedule.stableId(item('Limites')), result: 'talvez', today: TODAY}),
      (error) => /resultado de revisão desconhecido/.test(ptText(error.message)),
    );
    assert.throws(
      () => schedule.grade(runtime, {courseId: 'A', id: 'nao-existe', result: 'bom', today: TODAY}),
      (error) => /não encontrado/.test(ptText(error.message)),
    );
    assert.deepEqual(stored(runtime).courses.A.items[0].history, []);
  });
});

test('vencidos: hoje conta, atrasado conta, futuro não', () => {
  withRuntime((runtime) => {
    schedule.sync(runtime, {courseId: 'A', items: [item('Hoje'), item('Amanhã'), item('Atrasado')], today: TODAY, at: AT});
    schedule.grade(runtime, {courseId: 'A', id: schedule.stableId(item('Amanhã')), result: 'facil', at: AT, today: TODAY});
    /* Marcado há três dias: a agenda fica vencida e continua na fila. */
    const graded = schedule.grade(runtime, {courseId: 'A', id: schedule.stableId(item('Atrasado')), result: 'bom', at: AT - 3 * DAY, today: TODAY - 3});
    assert.equal(graded.nextDue, TODAY - 2, 'a data fica no passado do dia de hoje');
    const due = schedule.dueItems(runtime, {courseId: 'A', today: TODAY});
    assert.deepEqual(due.map((one) => one.question).sort(), ['Atrasado', 'Hoje']);
    assert.equal(ptText(due.find((one) => one.question === 'Atrasado').nextLabel), 'hoje', 'o vencido aparece como hoje');
    assert.equal(schedule.summary(runtime, {courseId: 'A', today: TODAY}).due, 2);
    assert.equal(ptText(schedule.summary(runtime, {courseId: 'A', today: TODAY}).dueLabel), '2 para revisar');
  });
});

test('referência fora da biblioteca ou não encontrada é estado visível, nunca filtro', () => {
  withRuntime((runtime) => {
    const items = [
      item('Ok', {ref: {name: 'Limites.pdf', page: 1, path: '/p/Limites.pdf'}}),
      item('Sumiu', {ref: {name: 'Velho.pdf', page: 1, path: '/p/Velho.pdf'}}),
      item('Fora', {ref: {name: 'Outro.pdf', page: 1, path: '/outro/Outro.pdf'}}),
      item('Sem ref', {ref: {name: '', page: 0, path: ''}}),
    ];
    const exists = (file) => file !== '/p/Velho.pdf';
    const allowed = new Set(['/p/Limites.pdf']);
    const listed = schedule.sync(runtime, {courseId: 'A', items, today: TODAY, at: AT, exists, allowed}).items;
    assert.equal(listed.length, 4, 'nada é escondido por causa da referência');
    const byName = Object.fromEntries(listed.map((one) => [one.question, one]));
    assert.equal(byName.Ok.refState, 'ok');
    assert.equal(byName.Ok.refNote, '');
    assert.equal(byName.Sumiu.refState, 'missing');
    assert.match(ptText(byName.Sumiu.refNote), /não encontrada/);
    assert.equal(byName.Fora.refState, 'outside');
    assert.match(ptText(byName.Fora.refNote), /fora da biblioteca/);
    assert.equal(byName['Sem ref'].refState, 'ok');
    assert.equal(schedule.dueItems(runtime, {courseId: 'A', today: TODAY, exists, allowed}).length, 4);
  });
});

test('biblioteca como predicado (adapter de serviços) também é aceita', () => {
  withRuntime((runtime) => {
    const items = [item('Dentro', {ref: {name: 'A.pdf', page: 1, path: '/p/A.pdf'}}), item('Fora', {ref: {name: 'B.pdf', page: 1, path: '/b/B.pdf'}})];
    const listed = schedule.sync(runtime, {
      courseId: 'A',
      items,
      today: TODAY,
      at: AT,
      exists: () => true,
      allowed: (file) => file.startsWith('/p/'),
    }).items;
    assert.equal(listed.find((one) => one.question === 'Dentro').refState, 'ok');
    assert.equal(listed.find((one) => one.question === 'Fora').refState, 'outside');
  });
});

test('coleção vazia acusa fora como o Caderno; sem `allowed` não acusa', () => {
  withRuntime((runtime) => {
    const items = [item('Referência', {ref: {name: 'A.pdf', page: 1, path: '/p/A.pdf'}})];
    const closed = schedule.sync(runtime, {courseId: 'A', items, today: TODAY, at: AT, exists: () => true, allowed: new Set()}).items;
    assert.equal(closed[0].refState, 'outside', 'o Caderno mostra a mesma referência como fora');
    const open = schedule.sync(runtime, {courseId: 'A', items, today: TODAY, at: AT, exists: () => true}).items;
    assert.equal(open[0].refState, 'ok', 'sem biblioteca informada nada é acusado');
    const emptyList = schedule.listItems(runtime, {courseId: 'A', today: TODAY, exists: () => true, allowed: []});
    assert.equal(emptyList[0].refState, 'outside', 'lista vazia segue a mesma regra do Set vazio');
  });
});

test('resumo por matéria separa os cadernos', () => {
  withRuntime((runtime) => {
    schedule.sync(runtime, {courseId: 'A', items: [item('A1'), item('A2')], today: TODAY, at: AT});
    schedule.sync(runtime, {courseId: 'B', items: [item('B1')], today: TODAY, at: AT});
    schedule.grade(runtime, {courseId: 'A', id: schedule.stableId(item('A1')), result: 'bom', at: AT, today: TODAY});
    const a = schedule.summary(runtime, {courseId: 'A', today: TODAY});
    assert.deepEqual({due: a.due, total: a.total, active: a.active, history: a.history}, {due: 1, total: 2, active: 2, history: 1});
    const b = schedule.summary(runtime, {courseId: 'B', today: TODAY});
    assert.deepEqual({due: b.due, total: b.total}, {due: 1, total: 1});
    assert.equal(schedule.listItems(runtime, {courseId: 'B', today: TODAY}).length, 1);
  });
});

test('datas determinísticas: mesmo instante e fuso dão o mesmo dia', () => {
  const at = Date.UTC(2026, 0, 10, 1, 0, 0);
  assert.equal(schedule.localDay(at, 180), schedule.dayOf(at, 180, true));
  assert.notEqual(schedule.localDay(at, 180), schedule.localDay(at, -120));
  assert.equal(schedule.localDay(AT, 0), TODAY);
});

test('campos hostis e schema antigo extra são reduzidos à forma segura', () => {
  withRuntime((runtime) => {
    schedule.sync(runtime, {
      courseId: 'C'.repeat(500),
      items: [{
        question: 'Q'.repeat(900),
        attempt: 'A'.repeat(900),
        difficulty: 'D'.repeat(900),
        ref: {name: 'N'.repeat(200), page: -3, path: 'P'.repeat(5000)},
        extra: 'descartado',
      }],
      today: TODAY,
      at: AT,
    });
    const course = Object.keys(stored(runtime).courses)[0];
    assert.equal(course.length, 120);
    const one = stored(runtime).courses[course].items[0];
    assert.equal(one.question.length, 400);
    assert.equal(one.attempt.length, 400);
    assert.equal(one.difficulty.length, 240);
    assert.equal(one.ref.name.length, 60);
    assert.equal(one.ref.path.length, 1024);
    assert.equal(one.ref.page, 0);
    assert.equal('extra' in one, false);
  });
});

test('a gravação é atômica e o arquivo fica em runtime/<FILENAME>', () => {
  withRuntime((runtime) => {
    schedule.sync(runtime, {courseId: 'A', items: [item('Limites')], today: TODAY, at: AT});
    assert.equal(existsSync(fileOf(runtime)), true);
    assert.equal(existsSync(`${fileOf(runtime)}.tmp`), false);
    assert.match(readFileSync(fileOf(runtime), 'utf8'), /"courses"/);
  });
});
