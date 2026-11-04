/* Prova do watchdog com um site por atividade (#88) e por revisão (#89): o
   quadro normal ganha processo próprio, o laço trava só o OOPIF dele, as
   atividades saudáveis continuam respondendo durante o laço e, depois do
   Parar, o watchdog mata só o processo destacado — nenhum renderer de
   atividade fica com CPU alta e uma atividade nova carrega.

   Cena 2 (#89): duas revisões do MESMO id montadas ao mesmo tempo; a v1 entra
   em laço REAL (não injetado) e a v2 precisa responder durante o laço,
   sobreviver ao kill e seguir respondendo depois. Cena 3: a MESMA revisão
   montada duas vezes divide o OOPIF (o isolamento é por revisão, não por
   card); o unitário do process-guard cobre o caminho compartilhado. O host de
   78 caracteres (id máximo + versão 1000000) prova o teto do parser no
   Chromium.

   Uso: node tests/hunt-activity-watchdog.mjs */
import {_electron as electron} from '@playwright/test';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {testEnv} from './electron-env.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const DESK = path.resolve(here, '..');
const MAIN = path.join(here, 'fixtures', 'activity', 'watchdog-main.cjs');
let failures = 0;

function check(label, condition, detail = '') {
  if (condition) {
    console.log(`[PASS] ${label}`);
  } else {
    failures += 1;
    console.log(`[FAIL] ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor(run, timeout = 15000, interval = 250) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const value = await run();
    if (value) return value;
    await sleep(interval); // espera fixa: intervalo do próprio polling
  }
  return null;
}

const activityFramesOf = (frames) => frames.filter((frame) => frame.url.startsWith('mesa-activity://act-'));
const pidOf = (frames, url) => (frames.find((frame) => frame.url === url) || {}).osPid || 0;

const app = await electron.launch({args: [MAIN], cwd: DESK, env: testEnv()});
try {
  await app.firstWindow();
  const ready = await waitFor(() => app.evaluate(() => !!global.__wd).catch(() => false), 20000, 150);
  check('fixture do watchdog pronta', ready === true);
  const urls = await app.evaluate(() => global.__wd.urls());

  await app.evaluate(() => global.__wd.clearProbes());
  await app.evaluate((_e, payload) => global.__wd.mount('healthy-a', payload.a), {a: urls['healthy-a']});
  await app.evaluate((_e, payload) => global.__wd.mount('healthy-b', payload.b), {b: urls['healthy-b']});
  const healthyReady = await waitFor(async () => {
    const probes = await app.evaluate(() => global.__wd.probes());
    return probes.filter((probe) => probe && probe.probe === 'healthy-ready').length === 2;
  }, 15000);
  check('duas atividades saudáveis montam', healthyReady === true);

  await app.evaluate((_e, payload) => global.__wd.mount('loop', payload.loop), {loop: urls.loop});
  /* O postMessage do frame com laço não é entregue (a thread do renderer trava
     antes do IPC), então a evidência de que ele roda é CPU + watchdog. */
  await sleep(1500); // espera fixa: janela de amostragem de CPU/watchdog com o laço rodando — o postMessage não é entregue

  const framesBefore = await app.evaluate(() => global.__wd.frames());
  const artifactsBefore = activityFramesOf(framesBefore);
  check('três frames de atividade ativos', artifactsBefore.length === 3, JSON.stringify(framesBefore));
  const loopPid = pidOf(framesBefore, urls.loop);
  const healthyAPid = pidOf(framesBefore, urls['healthy-a']);
  const healthyBPid = pidOf(framesBefore, urls['healthy-b']);
  check('cada atividade tem processo próprio (#88)', [healthyAPid, healthyBPid, loopPid].every((pid) => pid > 0) && new Set([healthyAPid, healthyBPid, loopPid]).size === 3, JSON.stringify(artifactsBefore));

  const metricsDuring = await app.evaluate(() => global.__wd.metrics());
  const busyMetric = metricsDuring.find((metric) => metric.pid === loopPid);
  check('processo do laço está queimando CPU', !!busyMetric && busyMetric.cpu >= 5, JSON.stringify(busyMetric || metricsDuring));

  const pingBeforeKill = await app.evaluate(() => global.__wd.ping());
  check('IPC do renderer autorizado antes do kill', pingBeforeKill === 'ok', String(pingBeforeKill));
  const beatDuringLoop = await app.evaluate(() => global.__wd.beat());
  check('mesa segue responsiva durante o laço', beatDuringLoop > 0, String(beatDuringLoop));
  const healthyDuring = await Promise.all([
    app.evaluate((_e, url) => global.__wd.probe(url), urls['healthy-a']),
    app.evaluate((_e, url) => global.__wd.probe(url), urls['healthy-b']),
  ]);
  check('atividades normais continuam respondendo durante o laço', healthyDuring.every((state) => state === 'ok'), JSON.stringify(healthyDuring));

  /* Critério 3 da #88: uma atividade de OUTRO id, montada DEPOIS que o laço
     já começou, carrega e responde enquanto o laço continua girando. */
  const duringUrl = await app.evaluate(() => global.__wd.publishNext());
  await app.evaluate(() => global.__wd.clearProbes());
  await app.evaluate((_e, url) => global.__wd.mount('during-loop', url), duringUrl);
  const duringReady = await waitFor(async () => {
    const probes = await app.evaluate(() => global.__wd.probes());
    return probes.some((probe) => probe && probe.probe === 'next-ready');
  }, 20000);
  check('atividade nova monta depois do laço começar', duringReady === true);
  const duringProbe = await app.evaluate((_e, url) => global.__wd.probe(url), duringUrl);
  check('atividade montada durante o laço continua respondendo', duringProbe === 'ok', String(duringProbe));
  await app.evaluate(() => global.__wd.unmount('during-loop'));

  /* Parar o laço remove o frame; como ninguém mais divide o site dele, o
     watchdog pode matar só esse processo. */
  await app.evaluate(() => global.__wd.unmount('loop'));
  /* Com um site só para ele, o OOPIF do laço pode ser recolhido assim que o
     frame sai; se ainda ficar girando, o watchdog mata o processo destacado.
     Os dois caminhos valem: o critério é o processo sumir de getAppMetrics. */
  const gone = await waitFor(async () => {
    const metrics = await app.evaluate(() => global.__wd.metrics());
    return !metrics.some((metric) => metric.pid === loopPid);
  }, 45000, 250);
  check('processo do laço some depois do Parar', gone === true);
  const loopKills = await app.evaluate((_e, pid) => global.__wd.watchdog().filter((event) => event.type === 'kill' && event.pid === pid), loopPid);
  /* Destacado = `detached-unresponsive` (travou antes de sair) ou
     `detached-frameless` (o pid ficou sem frame); no Mac o watchdog chega
     pelo segundo (relatório de 2026-10-31). Nunca `shared-stalled`. */
  if (loopKills.length) check('kill do laço é o caminho destacado, não o compartilhado', ['detached-unresponsive', 'detached-frameless'].includes(loopKills[0].reason), loopKills[0].reason);
  else console.log('[NOTE] o Chromium recolheu o OOPIF do laço sem frame antes do kill do watchdog');

  const pingAfterKill = await app.evaluate(() => global.__wd.ping());
  check('IPC do renderer ainda autorizado após o kill', pingAfterKill === 'ok', String(pingAfterKill));
  const beatAfterKill = await app.evaluate(() => global.__wd.beat());
  check('mesa continua responsiva após o kill', beatAfterKill > 0, String(beatAfterKill));

  const metricsAfterKill = await app.evaluate(() => global.__wd.metrics());
  check('kill do laço não derruba as atividades saudáveis', [healthyAPid, healthyBPid].every((pid) => metricsAfterKill.some((metric) => metric.pid === pid)), JSON.stringify(metricsAfterKill));
  const healthyAfter = await Promise.all([
    app.evaluate((_e, url) => global.__wd.probe(url), urls['healthy-a']),
    app.evaluate((_e, url) => global.__wd.probe(url), urls['healthy-b']),
  ]);
  check('atividades normais seguem respondendo depois do Parar', healthyAfter.every((state) => state === 'ok'), JSON.stringify(healthyAfter));

  /* Critério da #88: depois do Parar nenhum renderer de ATIVIDADE fica com CPU
     alta (o processo do laço já saiu; os saudáveis estão ociosos). */
  const idle = await waitFor(async () => {
    const frames = await app.evaluate(() => global.__wd.frames());
    const pids = [...new Set(activityFramesOf(frames).map((frame) => frame.osPid))];
    const metrics = await app.evaluate(() => global.__wd.metrics());
    const hot = metrics.filter((metric) => pids.includes(metric.pid) && metric.cpu >= 5);
    return hot.length === 0 ? {pids, hot} : null;
  }, 15000, 500);
  check('nenhum renderer de atividade fica com CPU alta depois do Parar', !!idle && idle.pids.length > 0, JSON.stringify(idle));

  /* Parar rápido (#88): a atividade entra em laço no load e o aluno para em
     menos de 1 s. O frame some sem misses suficientes para o caminho de
     travamento; o watchdog ainda tem de encerrar o processo sem frames. Se o
     Chromium recolher o OOPIF sozinho, o teste exige a prova de que o pid
     sumiu — nunca aceita "sem kill" em silêncio. */
  const fastUrl = await app.evaluate(() => global.__wd.publishLoop());
  await app.evaluate(() => global.__wd.clearProbes());
  const fastStart = Date.now();
  await app.evaluate((_e, url) => global.__wd.mount('fast-loop', url), fastUrl);
  const fastPid = await waitFor(async () => {
    const frames = await app.evaluate(() => global.__wd.frames());
    return pidOf(frames, fastUrl);
  }, 900, 50);
  const settle = Math.min(300, Math.max(0, 700 - (Date.now() - fastStart)));
  await sleep(settle); // espera fixa: deixa o js do laço começar, ainda dentro de 1 s
  await app.evaluate(() => global.__wd.unmount('fast-loop'));
  const stopElapsed = Date.now() - fastStart;
  check('parar rápido: laço desmontado em menos de 1 s', !!fastPid && stopElapsed < 1000, JSON.stringify({fastPid, stopElapsed}));
  const fastOutcome = await waitFor(async () => {
    const log = await app.evaluate(() => global.__wd.watchdog());
    const kill = log.find((event) => event.type === 'kill' && event.pid === fastPid);
    if (kill) return {kind: 'kill', kill};
    const metrics = await app.evaluate(() => global.__wd.metrics());
    return metrics.some((metric) => metric.pid === fastPid) ? null : {kind: 'gone'};
  }, 15000, 250);
  check('parar rápido: processo do laço encerrado (kill ou pid sumiu)', !!fastOutcome, JSON.stringify(fastOutcome));
  if (fastOutcome?.kind === 'kill') check('parar rápido: kill registra o motivo sem frames', fastOutcome.kill.reason === 'detached-frameless', fastOutcome.kill.reason);
  else if (fastOutcome?.kind === 'gone') console.log('[NOTE] o Chromium recolheu o OOPIF do laço rápido antes do kill do watchdog; pid sumiu');
  const fastMetric = await app.evaluate((_e, pid) => global.__wd.metrics().find((metric) => metric.pid === pid) || null, fastPid);
  check('parar rápido: CPU do processo do laço ~0 depois', !fastMetric || fastMetric.cpu < 5, JSON.stringify(fastMetric));

  /* Remontar a MESMA atividade logo depois de desmontar (rolar a conversa,
     Parar e Abrir): o Chromium pode reusar o processo do subframe removido, e
     o frame novo ainda sem commit não aparece no pid. O kill sem frames não
     pode derrubar essa carga legítima (#88). */
  const remountUrl = await app.evaluate(() => global.__wd.publishNext());
  await app.evaluate(() => global.__wd.clearProbes());
  await app.evaluate((_e, url) => global.__wd.mount('remount', url), remountUrl);
  const remountFirst = await waitFor(async () => (await app.evaluate(() => global.__wd.probes())).some((probe) => probe && probe.probe === 'next-ready'), 20000);
  check('remontagem: primeira carga pronta', remountFirst === true);
  const killsBefore = (await app.evaluate(() => global.__wd.watchdog())).filter((event) => event.type === 'kill').length;
  await app.evaluate(() => global.__wd.clearProbes());
  await app.evaluate(() => global.__wd.unmount('remount'));
  await app.evaluate((_e, url) => global.__wd.mount('remount', url), remountUrl);
  const remountAgain = await waitFor(async () => (await app.evaluate(() => global.__wd.probes())).some((probe) => probe && probe.probe === 'next-ready'), 20000);
  check('remontagem: segunda carga pronta', remountAgain === true);
  await sleep(4000); // espera fixa: passa do prazo de confirmação e de retentativa do watchdog
  const killsAfter = (await app.evaluate(() => global.__wd.watchdog())).filter((event) => event.type === 'kill').length;
  check('remontagem: o watchdog não mata o processo reusado', killsAfter === killsBefore, JSON.stringify({killsBefore, killsAfter}));
  const remountProbe = await app.evaluate((_e, url) => global.__wd.probe(url), remountUrl);
  check('remontagem: a atividade remontada continua respondendo', remountProbe === 'ok', String(remountProbe));
  await app.evaluate(() => global.__wd.unmount('remount'));

  const nextUrl = await app.evaluate(() => global.__wd.publishNext());
  await app.evaluate(() => global.__wd.clearProbes());
  await app.evaluate((_e, url) => global.__wd.mount('next', url), nextUrl);
  const nextReady = await waitFor(async () => {
    const probes = await app.evaluate(() => global.__wd.probes());
    return probes.some((probe) => probe && probe.probe === 'next-ready');
  }, 20000);
  check('atividade nova monta e roda depois do kill', nextReady === true);
  const framesAfter = await waitFor(async () => {
    const list = await app.evaluate(() => global.__wd.frames());
    return list.length && !list.some((frame) => frame.error) ? list : null;
  }, 10000, 500);
  const nextFrame = activityFramesOf(framesAfter || []).find((frame) => frame.url === nextUrl);
  check('atividade nova carrega com host próprio', !!nextFrame && nextFrame.osPid > 0 && new URL(nextUrl).host !== new URL(urls['healthy-a']).host, JSON.stringify(framesAfter));

  /* --- Cena 2 (#89): duas revisões do MESMO id, laço REAL na v1 e a v2
     saudável. O host carrega a versão, então são origens (e processos)
     diferentes: o watchdog mata o processo do laço sem tocar na outra. --- */
  await app.evaluate(() => global.__wd.unmount('healthy-a'));
  await app.evaluate(() => global.__wd.unmount('healthy-b'));
  await app.evaluate(() => global.__wd.unmount('next'));
  await sleep(500); // espera fixa: o watchdog solta as entradas saudáveis desmontadas
  const revLoopUrl = urls['rev-loop'];
  const revHealthyUrl = urls['rev-healthy'];
  await app.evaluate(() => global.__wd.clearProbes());
  await app.evaluate((_e, url) => global.__wd.mount('rev-loop', url), revLoopUrl);
  await app.evaluate((_e, url) => global.__wd.mount('rev-healthy', url), revHealthyUrl);
  const revReady = await waitFor(async () => {
    const probes = await app.evaluate(() => global.__wd.probes());
    return probes.some((probe) => probe && probe.probe === 'healthy-ready');
  }, 20000);
  check('cena 2: revisão saudável monta ao lado do laço real', revReady === true);
  const revFrames = await waitFor(async () => {
    const frames = await app.evaluate(() => global.__wd.frames());
    const loop = frames.find((frame) => frame.url === revLoopUrl && frame.osPid > 0);
    const healthy = frames.find((frame) => frame.url === revHealthyUrl && frame.osPid > 0);
    return loop && healthy ? {loop, healthy} : null;
  }, 15000);
  check('cena 2: as duas revisões têm pid próprio (#89)', !!revFrames && revFrames.loop.osPid !== revFrames.healthy.osPid, JSON.stringify(revFrames));
  const revLoopPid = revFrames ? revFrames.loop.osPid : 0;
  const revHealthyPid = revFrames ? revFrames.healthy.osPid : 0;
  await sleep(1500); // espera fixa: laço real da v1 rodando antes da amostragem
  const revMetrics = await app.evaluate(() => global.__wd.metrics());
  const revBusy = revMetrics.find((metric) => metric.pid === revLoopPid);
  check('cena 2: processo do laço real queima CPU', !!revBusy && revBusy.cpu >= 5, JSON.stringify(revBusy || revMetrics));
  const revHealthyDuring = await app.evaluate((_e, url) => global.__wd.probe(url), revHealthyUrl);
  check('cena 2: a outra revisão responde durante o laço real', revHealthyDuring === 'ok', String(revHealthyDuring));
  const revBeat = await app.evaluate(() => global.__wd.beat());
  check('cena 2: mesa segue responsiva durante o laço real', revBeat > 0, String(revBeat));
  const revKill = await waitFor(async () => {
    const log = await app.evaluate(() => global.__wd.watchdog());
    return log.find((event) => event.type === 'kill' && event.pid === revLoopPid) || null;
  }, 30000, 250);
  check('cena 2: watchdog encerra o processo do laço', !!revKill, JSON.stringify(await app.evaluate(() => global.__wd.watchdog())));
  if (revKill) check('cena 2: kill do laço usa o caminho próprio', revKill.reason === 'detached-unresponsive', revKill.reason);
  const revHealthyKills = await app.evaluate((_e, pid) => global.__wd.watchdog().filter((event) => event.type === 'kill' && event.pid === pid), revHealthyPid);
  check('cena 2: a revisão saudável nunca é morta', revHealthyKills.length === 0, JSON.stringify(revHealthyKills));
  const revHealthyAlive = await app.evaluate((_e, pid) => global.__wd.metrics().some((metric) => metric.pid === pid), revHealthyPid);
  check('cena 2: processo da revisão saudável sobrevive ao kill', revHealthyAlive === true);
  const revHealthyAfter = await app.evaluate((_e, url) => global.__wd.probe(url), revHealthyUrl);
  check('cena 2: a outra revisão segue respondendo depois do kill', revHealthyAfter === 'ok', String(revHealthyAfter));
  await app.evaluate(() => global.__wd.unmount('rev-loop'));
  await app.evaluate(() => global.__wd.unmount('rev-healthy'));
  await sleep(500); // espera fixa: watchdog solta as entradas das revisões antes da cena compartilhada

  /* --- Cena 3 (#89, contraponto): a MESMA revisão montada duas vezes (mesmo
     host) cai no mesmo OOPIF. O isolamento é por revisão, não por card; o
     caminho compartilhado do watchdog continua coberto pelos unitários de
     `activity-process-guard.test.mjs`. --- */
  const sharedUrl = urls['rev-healthy'];
  const sharedDarkUrl = sharedUrl.replace(/([?&])theme=system/, '$1theme=dark');
  await app.evaluate(() => global.__wd.clearProbes());
  await app.evaluate((_e, url) => global.__wd.mount('shared-a', url), sharedUrl);
  await app.evaluate((_e, url) => global.__wd.mount('shared-b', url), sharedDarkUrl);
  const sharedFrames = await waitFor(async () => {
    const frames = await app.evaluate(() => global.__wd.frames());
    const a = frames.find((frame) => frame.url === sharedUrl && frame.osPid > 0);
    const b = frames.find((frame) => frame.url === sharedDarkUrl && frame.osPid > 0);
    return a && b ? {a, b} : null;
  }, 20000);
  check('cena 3: a mesma revisão montada duas vezes divide o OOPIF', !!sharedFrames && sharedFrames.a.osPid === sharedFrames.b.osPid, JSON.stringify(sharedFrames));
  const sharedProbes = await Promise.all([
    app.evaluate((_e, url) => global.__wd.probe(url), sharedUrl),
    app.evaluate((_e, url) => global.__wd.probe(url), sharedDarkUrl),
  ]);
  check('cena 3: as duas montagens da mesma revisão respondem', sharedProbes.every((state) => state === 'ok'), JSON.stringify(sharedProbes));
  await app.evaluate(() => global.__wd.unmount('shared-a'));
  await app.evaluate(() => global.__wd.unmount('shared-b'));
  await sleep(500); // espera fixa: watchdog solta as entradas antes do host máximo

  /* Host de 78 caracteres (#89): id máximo do store + `--v` + 1000000. Prova
     no Chromium que o teto do parser é carregável neste esquema. */
  const longUrl = await app.evaluate(() => global.__wd.publishLongHost());
  check('host máximo do id+versão tem 78 caracteres', new URL(longUrl).host.length === 78, String(new URL(longUrl).host.length));
  await app.evaluate(() => global.__wd.clearProbes());
  await app.evaluate((_e, url) => global.__wd.mount('long-host', url), longUrl);
  const longReady = await waitFor(async () => {
    const probes = await app.evaluate(() => global.__wd.probes());
    return probes.some((probe) => probe && probe.probe === 'healthy-ready');
  }, 20000);
  check('Chromium carrega o host de 78 caracteres do id+versão', longReady === true);
  const longProbe = await app.evaluate((_e, url) => global.__wd.probe(url), longUrl);
  check('atividade de host máximo responde', longProbe === 'ok', String(longProbe));
  await app.evaluate(() => global.__wd.unmount('long-host'));
} finally {
  await app.evaluate(() => global.__wd.cleanup()).catch(() => {});
  await app.close().catch(() => {});
}
console.log(failures === 0 ? 'HUNT ACTIVITY WATCHDOG: PASSOU' : `HUNT ACTIVITY WATCHDOG: ${failures} FALHA(S)`);
if (failures > 0) process.exitCode = 1;
