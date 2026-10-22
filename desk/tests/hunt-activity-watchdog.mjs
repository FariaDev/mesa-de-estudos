/* Prova do watchdog com processo compartilhado: 2-3 atividades no mesmo OOPIF,
   uma com laço, Parar deve liberar o kill quando todos os frames do pid estão
   confirmados travados (nenhum saudável/desconhecido), o processo some de
   getAppMetrics, o host segue responsivo e uma montagem nova carrega.
   Segunda cena (R6 P2): falha de enumeração (getAllWebContents,
   framesInSubtree, osProcessId) NÃO pode liberar o kill de um A saudável;
   sarada a enumeração, o kill compartilhado normal volta.

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
  const activityPids = [...new Set(framesBefore.filter((frame) => frame.url.startsWith('mesa-activity://')).map((frame) => frame.osPid))];
  check('as três atividades compartilham um único processo OOPIF', activityPids.length === 1 && activityPids[0] > 0, JSON.stringify(framesBefore));
  check('três frames ativos no mesmo processo', framesBefore.filter((frame) => frame.url.startsWith('mesa-activity://')).length === 3, JSON.stringify(framesBefore));
  const activityPid = activityPids[0] || 0;
  const metricsDuring = await app.evaluate(() => global.__wd.metrics());
  const busyMetric = metricsDuring.find((metric) => metric.pid === activityPid);
  check('processo compartilhado está queimando CPU com o laço', !!busyMetric && busyMetric.cpu >= 5, JSON.stringify(busyMetric || metricsDuring));

  const pingBeforeKill = await app.evaluate(() => global.__wd.ping());
  check('IPC do renderer autorizado antes do kill', pingBeforeKill === 'ok', String(pingBeforeKill));
  const beatDuringLoop = await app.evaluate(() => global.__wd.beat());
  check('mesa segue responsiva durante o laço', beatDuringLoop > 0, String(beatDuringLoop));

  /* Parar o laço remove o frame; os outros dois (travados pelo mesmo laço)
     passam a ser a evidência que libera o kill. */
  await app.evaluate(() => global.__wd.unmount('loop'));
  const killEvent = await waitFor(async () => {
    const log = await app.evaluate(() => global.__wd.watchdog());
    return log.find((event) => event.type === 'kill' && event.pid === activityPid) || null;
  }, 45000, 500);
  check('watchdog mata o processo compartilhado quando todos os frames travam', !!killEvent, JSON.stringify(await app.evaluate(() => global.__wd.watchdog())));
  if (killEvent) check('kill registra o motivo compartilhado', killEvent.reason === 'shared-stalled', killEvent.reason);

  const gone = await waitFor(async () => {
    const metrics = await app.evaluate(() => global.__wd.metrics());
    return !metrics.some((metric) => metric.pid === activityPid);
  }, 10000, 250);
  check('processo do laço desaparece de getAppMetrics', gone === true);

  const pingAfterKill = await app.evaluate(() => global.__wd.ping());
  check('IPC do renderer ainda autorizado após o kill compartilhado', pingAfterKill === 'ok', String(pingAfterKill));
  const beatAfterKill = await app.evaluate(() => global.__wd.beat());
  check('mesa continua responsiva após o kill', beatAfterKill > 0, String(beatAfterKill));

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
  const nextFrame = (framesAfter || []).find((frame) => frame.url.startsWith('mesa-activity://') && frame.url !== urls['healthy-a'] && frame.url !== urls['healthy-b']);
  const metricsAfter = await app.evaluate(() => global.__wd.metrics());
  const freshTab = metricsAfter.find((metric) => metric.type === 'Tab' && metric.pid !== activityPid);
  check('atividade nova tem processo próprio vivo', (!!nextFrame && nextFrame.osPid > 0 && nextFrame.osPid !== activityPid) || !!freshTab, JSON.stringify({framesAfter, freshTab}));

  /* --- Cena 2 (R6 P2): enumeração incompleta recusa o kill; sarada, o kill
     compartilhado normal volta. A = saudável, B = travado pelo mesmo pid. --- */
  /* A cena 1 deixou A/B/next montados no host depois do SIGKILL; remove para a
     árvore não carregar frames dispostos (que tornariam a enumeração
     incompleta de propósito). */
  await app.evaluate(() => global.__wd.unmount('healthy-a'));
  await app.evaluate(() => global.__wd.unmount('healthy-b'));
  await app.evaluate(() => global.__wd.unmount('next'));
  await sleep(500); // espera fixa: tempo do watchdog: os frames saudáveis desmontados não podem ser mortos
  const bId = urls['healthy-b'].split('/')[3];
  const aId = urls['healthy-a'].split('/')[3];
  await app.evaluate(() => global.__wd.clearProbes());
  await app.evaluate((_e, payload) => global.__wd.mount('fault-a', payload.a), {a: urls['healthy-a']});
  await app.evaluate((_e, payload) => global.__wd.mount('fault-b', payload.b), {b: urls['healthy-b']});
  const faultReady = await waitFor(async () => {
    const probes = await app.evaluate(() => global.__wd.probes());
    return probes.filter((probe) => probe && probe.probe === 'healthy-ready').length === 2;
  }, 15000);
  check('cena 2: dois frames saudáveis montam no mesmo OOPIF', faultReady === true);
  const faultPid = await waitFor(() => app.evaluate(() => global.__wd.activityPid()), 10000, 250);
  check('cena 2: pid compartilhado identificado', Number.isInteger(faultPid) && faultPid > 0, String(faultPid));

  await app.evaluate((_e, payload) => global.__wd.inject('stall', payload.b), {b: bId});
  const faultStall = await waitFor(async () => {
    const log = await app.evaluate(() => global.__wd.watchdog());
    return log.find((event) => event.type === 'stalled' && event.pid === faultPid) || null;
  }, 25000, 400);
  check('cena 2: B confirmado travado pelo watchdog', !!faultStall, JSON.stringify(await app.evaluate(() => global.__wd.watchdog())));
  await sleep(6000); // espera fixa: "nada acontece em 6 s" — o controle não é morto pelo watchdog
  const controlKills = await app.evaluate((_e, pid) => global.__wd.watchdog().filter((event) => event.type === 'kill' && event.pid === pid), faultPid);
  check('cena 2: A saudável impede o kill (controle)', controlKills.length === 0, JSON.stringify(controlKills));

  for (const kind of ['getAllWebContents', 'framesInSubtree', 'osProcessId']) {
    await app.evaluate((_e, payload) => global.__wd.inject(payload.kind, payload.needle), {kind, needle: bId});
    await sleep(4000); // espera fixa: "nada acontece em 4 s" — a injeção não causa kill do processo falho
    const kills = await app.evaluate((_e, pid) => global.__wd.watchdog().filter((event) => event.type === 'kill' && event.pid === pid), faultPid);
    const alive = await app.evaluate((_e, pid) => global.__wd.metrics().some((metric) => metric.pid === pid), faultPid);
    check(`cena 2: falha em ${kind} não mata A saudável (pid vivo)`, kills.length === 0 && alive === true, JSON.stringify({kills, alive}));
    await app.evaluate((_e, kindName) => global.__wd.heal(kindName), kind);
  }

  await app.evaluate((_e, payload) => global.__wd.inject('stall', payload.a), {a: aId});
  /* A falha de framesInSubtree limpa os tracked e pode parar o timer (a árvore
     some); a recuperação real é uma montagem nova religar o watchdog. C nasce
     travado por injeção também, então o kill compartilhado vale de novo. */
  const restartUrl = await app.evaluate(() => global.__wd.publishNext());
  const restartId = restartUrl.split('/')[3];
  await app.evaluate((_e, payload) => global.__wd.inject('stall', payload.id), {id: restartId});
  await app.evaluate((_e, url) => global.__wd.mount('restart', url), restartUrl);
  const faultKill = await waitFor(async () => {
    const log = await app.evaluate(() => global.__wd.watchdog());
    return log.find((event) => event.type === 'kill' && event.pid === faultPid) || null;
  }, 45000, 500);
  check('cena 2: sarada a enumeração, o kill compartilhado volta com todos travados', !!faultKill, JSON.stringify(await app.evaluate(() => global.__wd.watchdog())));
  if (faultKill) check('cena 2: kill registra o motivo compartilhado', faultKill.reason === 'shared-stalled', faultKill.reason);
  const faultGone = await waitFor(async () => {
    const metrics = await app.evaluate(() => global.__wd.metrics());
    return !metrics.some((metric) => metric.pid === faultPid);
  }, 10000, 250);
  check('cena 2: processo some de getAppMetrics', faultGone === true);
  const pingAfterFault = await app.evaluate(() => global.__wd.ping());
  check('cena 2: IPC do renderer segue autorizado após o kill', pingAfterFault === 'ok', String(pingAfterFault));
  const beatAfterFault = await app.evaluate(() => global.__wd.beat());
  check('cena 2: mesa segue responsiva após o kill', beatAfterFault > 0, String(beatAfterFault));
  const finalUrl = await app.evaluate(() => global.__wd.publishNext());
  await app.evaluate(() => global.__wd.clearProbes());
  await app.evaluate((_e, url) => global.__wd.mount('after-fault', url), finalUrl);
  const finalReady = await waitFor(async () => {
    const probes = await app.evaluate(() => global.__wd.probes());
    return probes.some((probe) => probe && probe.probe === 'next-ready');
  }, 20000);
  check('cena 2: atividade nova monta e roda depois do kill', finalReady === true);
} finally {
  await app.evaluate(() => global.__wd.cleanup()).catch(() => {});
  await app.close().catch(() => {});
}
console.log(failures === 0 ? 'HUNT ACTIVITY WATCHDOG: PASSOU' : `HUNT ACTIVITY WATCHDOG: ${failures} FALHA(S)`);
if (failures > 0) process.exitCode = 1;
