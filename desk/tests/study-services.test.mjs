/* Integração pelo adapter do host (`desk/src/study-data/services.cjs`).

   O adapter é a camada que o `main.cjs` já chama pelos IPCs
   `study-review-today`, `study-review-grade`, `study-stats-summary`,
   `study-stats-control` e `study-stats-reset`. Aqui ele roda com runtime
   temporário e escopo de mentira, provando que estatísticas e agenda funcionam
   ponta a ponta com as funções que o app usa — sem Electron e sem tocar em
   material real. */

import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRequire} from 'node:module';
import {buildStudyCores} from './study-core-build.mjs';
import {ptText} from './pt-text.mjs';

const built = buildStudyCores();
process.env.MESA_STUDYSTATS_CORE = built.corePath('studystats');
process.env.MESA_REVIEWSCHEDULE_CORE = built.corePath('reviewschedule');
const require = createRequire(import.meta.url);
const {createStudyServices} = require('../src/study-data/services.cjs');
const statistics = require('../src/study-data/statistics.cjs');
const review = require('../review.cjs');

function withServices(fn, library = []) {
  const runtime = mkdtempSync(join(tmpdir(), 'mesa-study-services-'));
  try {
    const allowed = new Set(library);
    const services = createStudyServices({
      runtime: () => runtime,
      courses: () => [{id: 'A', name: 'Cálculo'}],
      scope: () => ({courseId: 'A'}),
      allowed: () => allowed,
      persist: () => {},
      log: () => {},
    });
    return fn({runtime, services});
  } finally {
    rmSync(runtime, {recursive: true, force: true});
  }
}

const reviewItem = {
  question: 'Limites no infinito',
  attempt: 'dividi por x²',
  difficulty: 'não vi a fatoração',
  ref: {name: 'Limites.pdf', page: 3, path: '/p/Limites.pdf'},
};

test('reviewToday migra o caderno antigo e reviewGrade agenda a próxima revisão', () => {
  const pdf = join(tmpdir(), `mesa-services-${process.pid}-limites.pdf`);
  writeFileSync(pdf, '%PDF-1.4 sintético\n');
  try {
    withServices(({runtime, services}) => {
      review.writeItems(runtime, 'A', [{...reviewItem, ref: {...reviewItem.ref, path: pdf}}]);
      const today = services.reviewToday();
      assert.equal(today.items.length, 1, 'o item do caderno vence hoje e entra na fila');
      assert.equal(today.summary.due, 1);
      assert.equal(today.items[0].question, 'Limites no infinito');
      assert.equal(today.items[0].refState, 'ok', 'na biblioteca e no disco nada é acusado');
      assert.equal(readFileSync(join(runtime, 'review-schedule.json'), 'utf8').includes('Limites'), true, 'a agenda foi gravada');

      const graded = services.reviewGrade({id: today.items[0].id, result: 'bom'});
      assert.match(ptText(graded.explain), /^Bom:/);
      assert.equal(graded.item.interval, 1);
      assert.equal(graded.item.history.length, 1);

      const after = services.reviewToday();
      assert.equal(after.items.length, 0, 'marcada como Bom, ela sai da fila de hoje');
      assert.equal(after.summary.total, 1, 'o item continua no caderno');
      assert.equal(after.summary.history, 1);
    }, [pdf]);
  } finally {
    rmSync(pdf, {force: true});
  }
});

test('reviewGrade recusa resultado e id desconhecidos', () => {
  withServices(({services}) => {
    assert.throws(() => services.reviewGrade({id: 'x', result: 'mais ou menos'}), (error) => /resultado de revisão desconhecido/.test(ptText(error.message)));
    assert.throws(() => services.reviewGrade({id: 'x', result: 'bom'}), (error) => /não encontrado/.test(ptText(error.message)));
  });
});

test('estatísticas: control + beat contam tempo ativo; invisível não soma', () => {
  withServices(({runtime, services}) => {
    const at = Date.now();
    statistics.control(runtime, {action: 'start', at: at - 30000, courseId: 'A'});
    statistics.recordActivity(runtime, {id: 'prime', at: at - 30000, now: at - 30000, running: true, visible: true, courseId: 'A'});

    services.beat(true);
    const summary = services.statsSummary({period: '7'});
    assert.ok(summary.totals.seconds >= 29 && summary.totals.seconds <= 31, `segundos do batimento: ${summary.totals.seconds}`);
    assert.equal(summary.timer.running, true);

    const before = summary.totals.seconds;
    services.beat(false);
    assert.equal(services.statsSummary({period: '7'}).totals.seconds, before, 'janela invisível não acrescenta tempo');
  });
});

/* #70: o cronômetro nunca ligava sozinho; 112 perguntas e zero minuto, com
   "Pausado" na tela. O batimento com a janela à vista agora liga a sessão. */
test('#70: o batimento visível liga o cronômetro sem o botão', () => {
  withServices(({runtime, services}) => {
    services.beat(false);
    assert.equal(statistics.readStore(runtime).meta.timer.running, false, 'janela escondida não liga nada');
    services.beat(true);
    const timer = statistics.readStore(runtime).meta.timer;
    assert.equal(timer.running, true);
    assert.equal(timer.courseId, 'A');
  });
});

test('#70: a pausa do aluno segura o cronômetro; continuar solta', () => {
  withServices(({runtime, services}) => {
    services.beat(true);
    services.statsControl({action: 'pause'});
    services.beat(true);
    assert.equal(statistics.readStore(runtime).meta.timer.running, false, 'o batimento respeita a pausa');
    assert.equal(services.statsSummary({period: '7'}).timer.held, true, 'o resumo diz que a pausa foi do aluno');
    services.statsControl({action: 'resume'});
    services.beat(true);
    assert.equal(statistics.readStore(runtime).meta.timer.running, true);
    assert.equal(statistics.readStore(runtime).meta.timer.held, false);
  });
});

test('#70: trocar de matéria fecha a sessão anterior e abre a da nova', () => {
  const runtime = mkdtempSync(join(tmpdir(), 'mesa-study-services-'));
  let courseId = 'A';
  try {
    const services = createStudyServices({
      runtime: () => runtime,
      courses: () => [{id: 'A', name: 'Cálculo'}, {id: 'B', name: 'Física'}],
      scope: () => ({courseId}),
      allowed: () => new Set(),
      persist: () => {},
      log: () => {},
    });
    services.beat(true);
    courseId = 'B';
    services.beat(true);
    const timer = statistics.readStore(runtime).meta.timer;
    assert.equal(timer.running, true);
    assert.equal(timer.courseId, 'B');
    courseId = 'sem-materia';
    services.beat(true);
    assert.equal(statistics.readStore(runtime).meta.timer.running, false, 'matéria fora da lista não conta');
  } finally {
    rmSync(runtime, {recursive: true, force: true});
  }
});

test('estatísticas: lifecycle, pergunta aceita, uso e reset consciente', () => {
  withServices(({runtime, services}) => {
    services.lifecycle('freeze');
    assert.equal(statistics.readStore(runtime).meta.frozen, true);
    services.lifecycle('resume');
    assert.equal(statistics.readStore(runtime).meta.frozen, false);

    services.accepted({id: 'p1', engine: 'pi'});
    services.accepted({id: 'p1', engine: 'pi'});
    services.usage({input: {available: true, count: 12}, output: {available: true, count: 3}});
    const summary = services.statsSummary({period: 'all'});
    assert.equal(summary.totals.prompts, 1, 'a repetição do mesmo id não conta');
    assert.deepEqual(summary.usage.input, {available: true, count: 12});
    assert.deepEqual(summary.usage.cache, {available: false, count: 0});

    assert.throws(() => services.statsReset({confirm: false}), /confirmação explícita/);
    services.statsReset({confirm: true});
    assert.equal(services.statsSummary({period: 'all'}).totals.prompts, 0);
  });
});

test('statsControl usa o escopo do host, não o payload', () => {
  withServices(({runtime, services}) => {
    const timer = services.statsControl({action: 'start', courseId: 'OUTRA'});
    assert.equal(timer.courseId, 'A', 'o adapter fixa a matéria ativa');
    assert.equal(statistics.readStore(runtime).meta.timer.courseId, 'A');
  });
});

test('statsSummary só aceita courseId que existe na lista do host', () => {
  withServices(({runtime, services}) => {
    services.accepted({id: 'p1', engine: 'pi'});
    statistics.recordPrompt(runtime, {id: 'p2', accepted: true, courseId: 'B'});
    const scoped = services.statsSummary({period: 'all', courseId: 'A'});
    assert.equal(scoped.totals.prompts, 1, 'o payload não amplia o escopo');
    const all = services.statsSummary({period: 'all', courseId: 'B'});
    assert.equal(all.totals.prompts, 2, 'matéria fora da lista do host é ignorada no filtro');
  });
});
