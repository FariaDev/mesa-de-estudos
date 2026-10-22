/* Estatísticas locais de estudo (Mesa).

   O caminho real: o `main.cjs` bate o batimento de atividade (janela visível,
   sistema acordado, sessão rodando), registra a pergunta aceita e o uso do
   provedor; `summary` agrega 7/30/tudo por dia/matéria; a aba Estatísticas lê
   o resumo. Aqui o teste fala direto com o host (sem Electron e sem Pi), em
   runtime temporário e relógio fixo.

   O núcleo (`core/studystats.bend`) decide as regras de tempo ativo, dia/fuso,
   período, tokens e contadores; as leis estão em `core/laws/studystats.bend`.
   Este teste prova o HOST: sanitização, dedupe, persistência atômica, poda,
   reset e a agregação determinística. */

import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRequire} from 'node:module';
import {buildStudyCores} from './study-core-build.mjs';

const built = buildStudyCores({entries: ['studystats.bend']});
process.env.MESA_STUDYSTATS_CORE = built.corePath('studystats');
const require = createRequire(import.meta.url);
const stats = require('../src/study-data/statistics.cjs');

/* 2026-01-10T12:00:00Z; dia civil 20463 em UTC. */
const AT = Date.UTC(2026, 0, 10, 12, 0, 0);
const DAY = 86400000;
const fileOf = (runtime) => join(runtime, stats.FILENAME);

function withRuntime(fn) {
  const runtime = mkdtempSync(join(tmpdir(), 'mesa-study-stats-'));
  try {
    return fn(runtime);
  } finally {
    rmSync(runtime, {recursive: true, force: true});
  }
}

const event = (extra = {}) => ({at: AT, now: AT, courseId: 'A', tzOffset: 0, ...extra});

test('sem arquivo a leitura é vazia e nada é criado', () => {
  withRuntime((runtime) => {
    const store = stats.readStore(runtime);
    assert.deepEqual(store.activity, {});
    assert.equal(existsSync(fileOf(runtime)), false);
  });
});

test('arquivo corrompido não derruba a leitura', () => {
  withRuntime((runtime) => {
    writeFileSync(fileOf(runtime), '{ isso não é json');
    assert.deepEqual(stats.readStore(runtime).prompts, []);
    assert.deepEqual(stats.readStore(runtime).meta.timer, {running: false, idle: false, held: false, courseId: '', startedAt: 0, seconds: 0});
  });
});

test('sessão: batimento com timer rodando conta o intervalo; parado não conta', () => {
  withRuntime((runtime) => {
    let timer = stats.control(runtime, event({action: 'start'}));
    assert.equal(timer.running, true);
    const first = stats.recordActivity(runtime, event({id: 'hb-1', at: AT + 30000}));
    assert.equal(first.counted, 30, 'o primeiro batimento depois do start conta 30 s');
    const paused = stats.control(runtime, event({action: 'pause', at: AT + 30000}));
    assert.equal(paused.running, false);
    const idleBeat = stats.recordActivity(runtime, event({id: 'hb-2', at: AT + 60000}));
    assert.equal(idleBeat.counted, 0, 'pausado, o batimento não vira tempo');
    stats.control(runtime, event({action: 'resume', at: AT + 60000}));
    const afterResume = stats.recordActivity(runtime, event({id: 'hb-3', at: AT + 90000}));
    assert.equal(afterResume.counted, 30, 'retomar carimba a régua e o próximo intervalo conta');
  });
});

test('batimento com janela escondida, sistema congelado ou intervalo grande não conta', () => {
  withRuntime((runtime) => {
    stats.control(runtime, event({action: 'start'}));
    assert.equal(stats.recordActivity(runtime, event({id: 'hb-hide', at: AT + 30000, visible: false})).counted, 0);
    assert.equal(stats.recordActivity(runtime, event({id: 'hb-freeze', at: AT + 60000, frozen: true})).counted, 0);
    assert.equal(stats.recordActivity(runtime, event({id: 'hb-gap', at: AT + 600000})).counted, 0, 'intervalo acima do teto perde a evidência');
    assert.equal(stats.recordActivity(runtime, event({id: 'hb-ok', at: AT + 630000})).counted, 30);
  });
});

test('batimento repetido (mesmo id) não conta duas vezes', () => {
  withRuntime((runtime) => {
    stats.control(runtime, event({action: 'start'}));
    assert.equal(stats.recordActivity(runtime, event({id: 'hb-x', at: AT + 30000})).counted, 30);
    const again = stats.recordActivity(runtime, event({id: 'hb-x', at: AT + 30000}));
    assert.equal(again.duplicate, true);
    assert.equal(again.counted, 0);
    assert.equal(stats.summary(runtime, {now: AT + 30000, tzOffset: 0}).totals.seconds, 30);
  });
});

test('retroativo sem evidência é recusado; com evidência nativa entra', () => {
  withRuntime((runtime) => {
    stats.control(runtime, event({action: 'start', at: AT - DAY}));
    const rejected = stats.recordActivity(runtime, event({id: 'hb-old', at: AT - DAY + 30000, now: AT}));
    assert.equal(rejected.rejected, 'retroactive-without-evidence');
    assert.equal(rejected.counted, 0);
    const accepted = stats.recordActivity(runtime, event({
      id: 'hb-old-evidence',
      at: AT - DAY + 60000,
      now: AT,
      evidence: 'powerMonitor@2026-01-09T12:00:30Z',
    }));
    assert.equal(accepted.counted, 60, 'a evidência cobre o intervalo desde a última régua aceita');
  });
});

test('congelar/suspender carimba a régua e nenhum intervalo atravessa o evento', () => {
  withRuntime((runtime) => {
    stats.control(runtime, event({action: 'start'}));
    stats.recordActivity(runtime, event({id: 'hb-1', at: AT + 30000}));
    assert.equal(stats.recordLifecycle(runtime, event({id: 'life-1', kind: 'freeze', at: AT + 40000})).applied, true);
    const ignored = stats.recordActivity(runtime, event({id: 'hb-2', at: AT + 100000}));
    assert.equal(ignored.counted, 0, 'congelado não conta mesmo com a régua perto');
    stats.recordLifecycle(runtime, event({id: 'life-2', kind: 'resume', at: AT + 100000}));
    assert.equal(stats.recordActivity(runtime, event({id: 'hb-3', at: AT + 130000})).counted, 30);
    assert.equal(stats.readStore(runtime).meta.frozen, false);
  });
});

test('parar a sessão conta a sessão só quando passou de zero segundo', () => {
  withRuntime((runtime) => {
    stats.control(runtime, event({action: 'start'}));
    stats.control(runtime, event({action: 'stop', at: AT + 1000}));
    assert.equal(stats.summary(runtime, {now: AT + 1000, tzOffset: 0}).totals.sessions, 0, 'sessão sem tempo ativo não conta');

    stats.control(runtime, event({action: 'start', at: AT + DAY}));
    stats.recordActivity(runtime, event({id: 'hb-s', at: AT + DAY + 30000}));
    const timer = stats.control(runtime, event({action: 'stop', at: AT + DAY + 30000}));
    assert.equal(timer.running, false);
    assert.equal(timer.lastSession.seconds, 30);
    const summary = stats.summary(runtime, {now: AT + DAY + 30000, tzOffset: 0});
    assert.equal(summary.totals.sessions, 1);
    assert.equal(summary.totals.seconds, 30);
  });
});

test('ocioso e ações desconhecidas', () => {
  withRuntime((runtime) => {
    const timer = stats.control(runtime, event({action: 'idle'}));
    assert.equal(timer.idle, true);
    assert.equal(timer.running, false);
    assert.throws(() => stats.control(runtime, event({action: 'dormir'})), /ação de sessão desconhecida/);
  });
});

test('pergunta: aceita conta; recusada e duplicada ficam fora', () => {
  withRuntime((runtime) => {
    assert.equal(stats.recordPrompt(runtime, event({id: 'p1', accepted: true})).counted, true);
    assert.equal(stats.recordPrompt(runtime, event({id: 'p2', accepted: false})).counted, false);
    assert.equal(stats.recordPrompt(runtime, event({id: 'p3', accepted: true, duplicate: true})).counted, false);
    assert.equal(stats.recordPrompt(runtime, event({id: 'p1', accepted: true})).counted, false, 'id repetido não conta de novo');
    const summary = stats.summary(runtime, {now: AT, tzOffset: 0});
    assert.equal(summary.totals.prompts, 1);
    assert.equal(summary.series.at(-1).prompts, 1);
  });
});

test('tokens: entrada/saída/cache separados e a falta fica indisponível', () => {
  withRuntime((runtime) => {
    assert.equal(stats.recordUsage(runtime, event({
      id: 'u1',
      input: {available: true, count: 120},
      engine: 'pi',
      model: 'modelo-x',
    })).merged, true);
    assert.equal(stats.recordUsage(runtime, event({
      id: 'u2',
      output: {available: true, count: 30},
      engine: 'pi',
    })).merged, true);
    const summary = stats.summary(runtime, {now: AT, tzOffset: 0});
    assert.deepEqual(summary.usage.input, {available: true, count: 120});
    assert.deepEqual(summary.usage.output, {available: true, count: 30});
    assert.deepEqual(summary.usage.cache, {available: false, count: 0}, 'cache não informado continua indisponível');
    assert.deepEqual(summary.engines, ['pi'], 'engines são rótulos de motor, não modelos');
    assert.deepEqual(summary.models, ['modelo-x']);
    assert.equal(stats.recordUsage(runtime, event({id: 'u3', input: {available: true, count: 5}, engine: 'claude', model: 'modelo-y'})).merged, true);
    const both = stats.summary(runtime, {now: AT, tzOffset: 0});
    assert.deepEqual(both.engines, ['claude', 'pi'], 'o rótulo do último evento não apaga o motor anterior');
    assert.deepEqual(both.models, ['modelo-x', 'modelo-y']);
    assert.equal(stats.recordUsage(runtime, event({id: 'u2'})).duplicate, true);
  });
});

test('dia civil segue o fuso: oeste e leste caem em dias diferentes', () => {
  withRuntime((runtime) => {
    const at = Date.UTC(2026, 0, 10, 1, 0, 0);
    stats.control(runtime, event({action: 'start', at: at - 30000, tzOffset: 180}));
    stats.recordActivity(runtime, event({id: 'hb-west', at, now: at, tzOffset: 180}));
    const west = stats.summary(runtime, {now: at, tzOffset: 180, period: '7'});
    assert.equal(west.series.at(-1).day, west.series.at(-2).day + 1);
    assert.equal(west.totals.seconds, 30);
    const westDay = Number(Object.keys(stats.readStore(runtime).activity)[0]);

    withRuntime((east) => {
      stats.control(east, event({action: 'start', at: at - 30000, tzOffset: -120}));
      stats.recordActivity(east, event({id: 'hb-east', at, now: at, tzOffset: -120}));
      const eastDay = Number(Object.keys(stats.readStore(east).activity)[0]);
      assert.notEqual(westDay, eastDay, '22:00 de 09/01 em UTC-3 e 03:00 de 10/01 em UTC+2');
    });
  });
});

test('resumo 7/30/tudo com dias determinísticos e por matéria', () => {
  withRuntime((runtime) => {
    const today = stats.localDay(AT, {offsetMinutes: 0, west: false});
    const store = {
      version: 1,
      activity: {
        [today]: {A: {seconds: 600, sessions: 1}, B: {seconds: 300, sessions: 1}},
        [today - 1]: {A: {seconds: 1200, sessions: 2}},
        [today - 8]: {A: {seconds: 3600, sessions: 1}},
      },
      prompts: [
        {id: 'p1', day: today, courseId: 'A', engine: 'pi', model: ''},
        {id: 'p2', day: today - 1, courseId: 'B', engine: 'pi', model: ''},
      ],
      usage: {
        [today]: {A: {input: {available: true, count: 10}, output: {available: true, count: 4}, cache: {available: false, count: 0}, engine: 'pi', model: ''}},
        [today - 8]: {A: {input: {available: true, count: 999}, output: {available: false, count: 0}, cache: {available: false, count: 0}, engine: 'pi', model: ''}},
      },
      meta: {createdAt: AT - 30 * DAY, resetAt: 0, frozen: false, beats: {}, timer: {running: false, idle: false, courseId: '', startedAt: 0, seconds: 0}, seen: []},
    };
    writeFileSync(fileOf(runtime), JSON.stringify(store));

    const week = stats.summary(runtime, {now: AT, tzOffset: 0, period: '7'});
    assert.equal(week.series.length, 7, 'a janela de 7 dias mostra os sete dias, inclusive vazios');
    assert.equal(week.totals.seconds, 600 + 300 + 1200, 'o dia -8 fica fora dos 7 dias');
    assert.equal(week.series.at(-1).seconds, 900);
    assert.equal(week.totals.sessions, 4);
    assert.equal(week.totals.prompts, 2);
    assert.equal(week.totals.prompts, 2);

    const month = stats.summary(runtime, {now: AT, tzOffset: 0, period: '30'});
    assert.equal(month.series.length, 30);

    const all = stats.summary(runtime, {now: AT, tzOffset: 0, period: 'all'});
    assert.equal(all.series.length, 3, 'tudo mostra só os dias com registro');
    assert.equal(all.totals.seconds, 600 + 300 + 1200 + 3600);
    assert.equal(all.totals.prompts, 2, 'prompt do dia -8 (fora dele) não existe neste fixture');

    const onlyA = stats.summary(runtime, {now: AT, tzOffset: 0, period: 'all', courseId: 'A'});
    assert.equal(onlyA.totals.seconds, 600 + 1200 + 3600);
    assert.equal(onlyA.totals.sessions, 4);
    assert.equal(onlyA.totals.prompts, 1);
    assert.deepEqual(onlyA.courses.map((course) => course.courseId), ['A']);

    const weekAll = stats.summary(runtime, {now: AT, tzOffset: 0, period: '7'});
    assert.equal(weekAll.courses.find((course) => course.courseId === 'B').seconds, 300);
    assert.equal(weekAll.courses.find((course) => course.courseId === 'A').prompts, 1);
  });
});

test('resumo "tudo" devolve a primeira evidência e o último reset', () => {
  withRuntime((runtime) => {
    stats.recordPrompt(runtime, event({id: 'p1', accepted: true}));
    const summary = stats.summary(runtime, {now: AT, tzOffset: 0, period: 'all'});
    assert.equal(summary.series.length, 1);
    assert.equal(summary.recordedSince, 0, 'o carimbo de criação é do primeiro write real (o host pode marcar)');
    stats.reset(runtime, {confirm: true});
    assert.ok(stats.summary(runtime, {now: AT, tzOffset: 0}).resetAt > 0);
  });
});

test('reset exige confirmação, limpa os agregados e preserva o dedupe', () => {
  withRuntime((runtime) => {
    stats.control(runtime, event({action: 'start'}));
    stats.recordActivity(runtime, event({id: 'hb-1', at: AT + 30000}));
    assert.equal(stats.summary(runtime, {now: AT + 30000, tzOffset: 0}).totals.seconds, 30);
    assert.throws(() => stats.reset(runtime, {confirm: 'sim'}), /confirmação explícita/);
    assert.equal(stats.reset(runtime, {confirm: true}).cleared, true);
    assert.equal(stats.summary(runtime, {now: AT + 30000, tzOffset: 0}).totals.seconds, 0);
    const replay = stats.recordActivity(runtime, event({id: 'hb-1', at: AT + 30000}));
    assert.equal(replay.duplicate, true, 'evento repetido da fila não ressuscita o que foi apagado');
    stats.recordUsage(runtime, event({id: 'u-reset', input: {available: true, count: 9}}));
    stats.reset(runtime, {confirm: true});
    assert.equal(stats.recordUsage(runtime, event({id: 'u-reset', input: {available: true, count: 9}})).merged, false, 'o dedupe estável também sobrevive ao reset');
  });
});

test('a gravação é atômica e o arquivo fica em runtime/<FILENAME>', () => {
  withRuntime((runtime) => {
    stats.recordPrompt(runtime, event({id: 'p1', accepted: true}));
    assert.equal(existsSync(fileOf(runtime)), true);
    assert.equal(existsSync(`${fileOf(runtime)}.tmp`), false);
    assert.match(readFileSync(fileOf(runtime), 'utf8'), /"prompts"/);
  });
});

test('campos hostis viram valores seguros', () => {
  withRuntime((runtime) => {
    const result = stats.recordUsage(runtime, event({
      id: 'x'.repeat(500),
      courseId: 'C'.repeat(500),
      input: {available: 'sim', count: -7},
      output: {available: true, count: 2.9},
      cache: null,
    }));
    assert.equal(result.merged, true);
    const store = stats.readStore(runtime);
    const day = Object.keys(store.usage)[0];
    const course = Object.keys(store.usage[day])[0];
    assert.equal(course.length, 120);
    assert.deepEqual(store.usage[day][course].output, {available: true, count: 2});
    assert.deepEqual(store.usage[day][course].input, {available: false, count: 0});
    assert.match(store.meta.seenStable[0], /^[a-f0-9]{16}$/, 'o id hostil vira impressão curta no dedupe estável');
  });
});

test('dedupe estável não é expulso pelo dilúvio de batimentos', () => {
  withRuntime((runtime) => {
    stats.recordUsage(runtime, event({id: 'usage-estavel', input: {available: true, count: 100}, engine: 'pi'}));
    stats.recordPrompt(runtime, event({id: 'prompt-estavel', accepted: true}));
    for (let i = 0; i < 4200; i += 1) stats.recordActivity(runtime, event({id: `hb-ruido-${i}`}));
    assert.equal(stats.recordUsage(runtime, event({id: 'usage-estavel', input: {available: true, count: 100}, engine: 'pi'})).merged, false);
    assert.equal(stats.recordPrompt(runtime, event({id: 'prompt-estavel', accepted: true})).counted, false);
    const summary = stats.summary(runtime, {now: AT, tzOffset: 0});
    assert.deepEqual(summary.usage.input, {available: true, count: 100}, 'os tokens não dobram depois do dilúvio');
    assert.equal(summary.totals.prompts, 1);
  });
});

test('reinício do app não conta o intervalo fechado nem herda o congelamento antigo', () => {
  withRuntime((runtime) => {
    const frozen = (extra) => ({
      version: 1, activity: {}, prompts: [], usage: {},
      meta: {
        createdAt: AT, resetAt: 0, frozen: true, beats: {A: AT},
        boot: {id: 'processo-anterior', at: AT - 1000},
        timer: {running: true, idle: false, courseId: 'A', startedAt: AT - 90000, seconds: 30},
        seen: [], seenStable: [],
        ...extra,
      },
    });
    writeFileSync(fileOf(runtime), JSON.stringify(frozen()));
    const first = stats.recordActivity(runtime, event({id: 'hb-1', at: AT + 30000}));
    assert.equal(first.restarted, true);
    assert.equal(first.counted, 0, 'o intervalo entre o último batimento e o reinício não vira tempo');
    assert.equal(stats.readStore(runtime).meta.frozen, false, 'o congelamento do processo anterior não tranca a sessão nova');
    const second = stats.recordActivity(runtime, event({id: 'hb-2', at: AT + 60000}));
    assert.equal(second.counted, 30, 'a régua recomeça no reinício');

    writeFileSync(fileOf(runtime), JSON.stringify(frozen({boot: {id: 'processo-anterior-2', at: AT - 1000}, timer: {running: false, idle: false, courseId: 'A', startedAt: 0, seconds: 0}})));
    stats.control(runtime, event({action: 'start', at: AT + 1000}));
    assert.equal(stats.readStore(runtime).meta.frozen, false, 'começar sessão em processo novo destrava o congelamento herdado');
  });
});
