/* Spike real de contenção da superfície de atividade (Electron sintético,
   independente do app). Mede: processo do iframe vs renderer do host, laço,
   flood, sondas de rede/arquivos/navegação/WebRTC/WebTransport e a alternativa
   WebContentsView. Não abre o app pessoal, não usa dados pessoais.

   Uso: node tests/hunt-activity-spike.mjs
   Saída: relatório + JSON final; exit != 0 se o gate inline falhar.
   Gate A = OOPIF separado + rede/arquivos zero com wrapper + laço contido +
   flood contido, tudo no iframe inline. */
import {_electron as electron} from '@playwright/test';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {testEnv} from './electron-env.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const MAIN = path.join(here, 'fixtures', 'activity', 'spike-main.cjs');
const SECRET = path.join(here, 'fixtures', 'activity', 'secret.txt');
const DESK = path.resolve(here, '..');
const report = {attempts: [], verdict: null};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function launch(extra = {}) {
  const app = await electron.launch({args: [MAIN], cwd: DESK, env: testEnv(extra)});
  await app.evaluate(() => global.__spike && global.__spike.ready);
  await app.firstWindow();
  return app;
}

async function call(app, fn, arg) {
  return app.evaluate(fn, arg);
}

async function waitForDone(app, timeout = 20000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const messages = await call(app, () => global.__spike.messages());
    if (messages.some((m) => m?.data?.probe === 'done')) return messages;
    await sleep(120); // espera fixa: intervalo do próprio polling
  }
  return await call(app, () => global.__spike.messages());
}

async function record(name, run) {
  const entry = {name, pass: false, notes: [], data: {}};
  const started = Date.now();
  try {
    await run(entry);
    entry.pass = true;
  } catch (error) {
    entry.notes.push('ERRO: ' + String(error && error.message || error));
  }
  entry.ms = Date.now() - started;
  report.attempts.push(entry);
  console.log(`[${entry.pass ? 'PASS' : 'FAIL'}] ${name} (${entry.ms} ms)`);
  for (const note of entry.notes) console.log('        ' + note);
  return entry;
}

/* -------- sondas de isolamento no iframe inline -------- */
async function runProbe(fixture, entry, {expectLeak = false} = {}) {
  const app = await launch();
  try {
    const ports = await call(app, () => global.__spike.ports());
    const parentPid = await (await app.browserWindow(await app.firstWindow())).evaluate((win) => win.webContents.getOSProcessId());
    const url = `mesa-activity-spike://artifact/${fixture}?http=${ports.http}&udp=${ports.udp}&file=${encodeURIComponent(SECRET)}`;
    const mounted = await call(app, (_e, mountUrl) => global.__spike.mountSafe(mountUrl), url);
    if (mounted !== true) throw Error('iframe não montou: ' + String(mounted));
    const messages = await waitForDone(app);
    const probes = Object.create(null);
    for (const message of messages) {
      if (message?.data?.probe) probes[message.data.probe] = message.data.detail;
    }
    const counts = await call(app, () => global.__spike.counts());
    const frames = await call(app, () => global.__spike.frameInfo());
    const navLog = await call(app, () => global.__spike.navLog());
    entry.data = {probes, counts, frames, parentPid, navLog};
    const netHits = Object.values(counts.http).reduce((a, b) => a + b, 0);
    const child = frames[0];
    entry.notes.push(`http hits=${netHits} udp=${counts.udp} processo do iframe=${child ? child.osProcessId : '?'} host=${parentPid}`);
    if (child && child.processId === parentPid) entry.notes.push('OOPIF NÃO separado: mesmo processo do host');
    if (!expectLeak) {
      if (netHits !== 0) entry.notes.push(`VIOLOU rede HTTP: ${JSON.stringify(counts.http)}`);
      if (counts.udp !== 0) entry.notes.push(`VIOLOU UDP/STUN: ${counts.udp} datagramas`);
      for (const [name, branch] of [['fileimg', 'file'], ['filefetch', 'file']]) {
        if (probes[name] && probes[name].ok === true) entry.notes.push(`VIOLOU ${branch}: ${name}=${JSON.stringify(probes[name])}`);
      }
      if (probes.navegacao && probes.navegacao.ok) entry.notes.push('location.href externo foi reportado como aceito pelo JS; ver navLog/frame final');
      const navCanceled = navLog.some((n) => String(n.url).includes('example.invalid'));
      if (!navCanceled) entry.notes.push('navegação externa não apareceu no navLog do host');
      const schemeCanceled = navLog.some((n) => String(n.url).includes('mesa-activity-spike://artifact/quiet.html'));
      const frameUrl = child ? child.url : '';
      if (!schemeCanceled) entry.notes.push('navegação entre artefatos não apareceu no navLog');
      if (frameUrl.includes('example.invalid') || frameUrl.includes('quiet')) entry.notes.push(`VIOLOU: frame trocou de documento (${frameUrl})`);
      if (entry.notes.some((n) => /VIOLOU|NÃO separado|não apareceu/.test(n))) throw Error('probe reprovou');
    } else if (counts.udp === 0) {
      entry.notes.push('esperava-se medir o vazamento RTC cru, mas udp=0 (ambiente mudou)');
    }
  } finally {
    await app.close().catch(() => {});
  }
}

await record('probe-raw (superfície sem prelude)', (entry) => runProbe('probe-raw.html', entry, {expectLeak: true}));
await record('probe-wrapped (runtime com prelude)', (entry) => runProbe('probe.html', entry));

/* -------- laço no iframe inline -------- */
await record('loop-inline', async (entry) => {
  const app = await launch();
  try {
    const parentPid = await (await app.browserWindow(await app.firstWindow())).evaluate((win) => win.webContents.getOSProcessId());
    const before = await call(app, () => global.__spike.beatSafe(1500));
    await sleep(1200); // espera fixa: janela de medição do batimento (a taxa é o que se mede)
    const after = await call(app, () => global.__spike.beatSafe(1500));
    const baselineRate = typeof before === 'number' && typeof after === 'number' ? after - before : null;
    const mounted = await call(app, (_e, url) => global.__spike.mountSafe(url), 'mesa-activity-spike://artifact/loop.html');
    if (mounted !== true) throw Error('loop não montou: ' + String(mounted));
    await sleep(1600); // espera fixa: janela de medição do batimento com o laço montado
    const during = await call(app, () => global.__spike.beatSafe(1500));
    await sleep(700); // espera fixa: janela de medição do batimento com o laço montado
    const during2 = await call(app, () => global.__spike.beatSafe(1500));
    const frames = await call(app, () => global.__spike.frameInfo());
    const metrics = await call(app, () => global.__spike.metrics());
    const messages = await call(app, () => global.__spike.messages());
    const started = messages.some((m) => m?.data?.probe === 'started');
    const frameProbe = await call(app, () => global.__spike.probeFrame(1500));
    const unmount = await call(app, () => global.__spike.unmountSafe(3000));
    await sleep(3000); // espera fixa: janela de medição do batimento depois de desmontar o iframe
    const afterUnmount = await call(app, () => global.__spike.beatSafe(1500));
    const framesAfter = await call(app, () => global.__spike.frameInfo());
    const metricsAfter = await call(app, () => global.__spike.metrics());
    const processLog = await call(app, () => global.__spike.processLog());
    const busy = metrics.filter((m) => m.cpu > 20).map((m) => ({pid: m.pid, type: m.type, cpu: Math.round(m.cpu)}));
    const framePid = frames[0] ? frames[0].osProcessId : null;
    const pidAlive = framePid ? metricsAfter.some((m) => m.pid === framePid) : null;
    entry.data = {parentPid, baselineRate, during, during2, frames, busy, metrics, unmount, afterUnmount, framesAfter, pidAlive, started, frameProbe, processLog: processLog.map((p) => p.type)};
    entry.notes.push(`beat: baseline ${baselineRate}/1,2s; durante ${during}/${during2}; após remover ${afterUnmount}`);
    entry.notes.push(`iframe os pid=${framePid}; host=${parentPid}; js do laço (frame executeJavaScript)=${frameProbe}; CPU>20%: ${JSON.stringify(busy)}`);
    entry.notes.push(`unmount=${String(unmount)}; frames restantes=${framesAfter.length}; pid do iframe ainda listado=${pidAlive}`);
    const responsiveDuring = typeof during === 'number' && typeof during2 === 'number';
    if (!responsiveDuring) entry.notes.push('host congelou durante o laço (beat TIMEOUT)');
    if (unmount !== true) entry.notes.push('não foi possível remover o iframe com o laço rodando');
    if (!responsiveDuring || unmount !== true) {
      await call(app, () => global.__spike.reloadWindow()).catch(() => {});
      await sleep(1500); // espera fixa: tempo de recuperação da janela recarregada, medido pelo próprio teste
      const recovered = await call(app, () => global.__spike.beatSafe(1500));
      entry.data.recoveredAfterReload = recovered;
      entry.notes.push(`recuperação só por reload da janela: beat=${recovered}`);
      throw Error('laço inline não contido');
    }
  } finally {
    await app.close().catch(() => {});
  }
});

/* -------- flood no iframe inline -------- */
await record('flood-inline', async (entry) => {
  const app = await launch();
  try {
    const mounted = await call(app, (_e, url) => global.__spike.mountSafe(url), 'mesa-activity-spike://artifact/flood.html');
    if (mounted !== true) throw Error('flood não montou: ' + String(mounted));
    await sleep(1500); // espera fixa: janela de medição do batimento com o flood montado
    const beat = await call(app, () => global.__spike.beatSafe(1500));
    await sleep(800); // espera fixa: janela de medição do batimento com o flood montado
    const beat2 = await call(app, () => global.__spike.beatSafe(1500));
    const messages = await call(app, () => global.__spike.messages());
    const unmount = await call(app, () => global.__spike.unmountSafe(3000));
    const messages2 = unmount === true ? messages : await call(app, () => global.__spike.messages());
    entry.data = {beat, beat2, messageCount: messages.length, messagesAfter: messages2.length, unmount};
    entry.notes.push(`beat durante flood: ${beat}/${beat2}; mensagens recebidas=${messages.length}; unmount=${String(unmount)}`);
    if (typeof beat !== 'number' && typeof beat2 !== 'number') {
      await call(app, () => global.__spike.reloadWindow()).catch(() => {});
      throw Error('host congelou com flood');
    }
  } finally {
    await app.close().catch(() => {});
  }
});

/* -------- alternativa WebContentsView com laço -------- */
await record('loop-webcontentsview', async (entry) => {
  const app = await launch({SPIKE_FIXTURE: 'loop.html'});
  try {
    const view = await call(app, () => global.__spike.makeView('loop.html'));
    await sleep(1600); // espera fixa: janela de medição do batimento com a view montada
    const beat = await call(app, () => global.__spike.beatSafe(1500));
    await sleep(800); // espera fixa: janela de medição do batimento com a view montada
    const beat2 = await call(app, () => global.__spike.beatSafe(1500));
    const destroyedPid = await call(app, () => global.__spike.destroyView());
    await sleep(1600); // espera fixa: prazo do próprio teste para o processo da view destruída sumir
    const metrics = await call(app, () => global.__spike.metrics());
    const stillThere = metrics.some((m) => m.pid === destroyedPid);
    const beatAfter = await call(app, () => global.__spike.beatSafe(1500));
    entry.data = {view, beat, beat2, destroyedPid, stillThere, beatAfter};
    entry.notes.push(`view pid=${view.pid}; beat do host durante laço: ${beat}/${beat2}; após destruir: ${beatAfter}; pid ainda vive=${stillThere}`);
    if (typeof beat !== 'number' || typeof beat2 !== 'number') throw Error('host congelou com WebContentsView');
    if (view.pid === 0) throw Error('view sem processo próprio');
  } finally {
    await app.close().catch(() => {});
  }
});

const raw = report.attempts.find((a) => a.name.startsWith('probe-raw'));
const wrapped = report.attempts.find((a) => a.name.startsWith('probe-wrapped') && a.pass);
const loop = report.attempts.find((a) => a.name === 'loop-inline' && a.pass);
const flood = report.attempts.find((a) => a.name === 'flood-inline' && a.pass);
report.verdict = {
  rawRtcLeakMeasured: !!(raw?.data?.counts?.udp > 0),
  wrappedHttpZero: !!(wrapped?.data?.counts && Object.values(wrapped.data.counts.http).reduce((a, b) => a + b, 0) === 0),
  wrappedNetworkZero: !!(wrapped?.data?.counts && Object.values(wrapped.data.counts.http).reduce((a, b) => a + b, 0) === 0 && wrapped.data.counts.udp === 0),
  inlineProcessSeparate: !!(wrapped?.data?.frames?.[0] && wrapped.data.frames[0].processId !== wrapped.data.parentPid && wrapped.data.frames[0].osProcessId !== wrapped.data.parentPid),
  loopContainedInline: !!loop,
  floodContainedInline: !!flood,
  viewFallbackWorks: !!report.attempts.find((a) => a.name === 'loop-webcontentsview' && a.pass),
};
console.log('\n===== JSON do spike =====');
console.log(JSON.stringify(report, null, 2));
const gateA = report.verdict.wrappedNetworkZero && report.verdict.inlineProcessSeparate && report.verdict.loopContainedInline && report.verdict.floodContainedInline;
console.log(gateA ? 'GATE A (inline) PASSOU' : 'GATE A (inline) FALHOU — ver medidas acima');
if (!gateA) process.exitCode = 1;
