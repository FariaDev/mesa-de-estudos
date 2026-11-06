/* Suspeita S2 da revisão de segurança: `ownerStartTime` vazio no ledger fazia
   `ownerStillRuns` responder "não" e a recolha de outra Mesa matava o serve de
   uma Mesa dona ainda viva. Sem a hora do dono não há como separar a Mesa viva
   de um PID reutilizado, mas o pid existir não é prova de morte: na dúvida,
   não recolhe. Os fakes são nomeados e nenhum processo real é tocado. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {rmSync} from 'node:fs';
import {createRequire} from 'node:module';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import {tempDir} from './temp-dir.mjs';

const require = createRequire(import.meta.url);
const {sweepOrphans, readEntry, writeEntry} = require('../src/agents/opencode-orphans.cjs');
const {processStartTime, startTimesMatch} = require('../src/agents/opencode-owner-time.cjs');
const {startOpenCodeServer} = require('../src/agents/opencode-process.cjs');

const SERVE = '/Users/alguem/.opencode/bin/opencode serve --hostname 127.0.0.1 --port 0';
const BINARY = '/Users/alguem/.opencode/bin/opencode';
const START = 'Wed Nov  4 15:00:00 2026';
const OWNER_START = 'Wed Nov  4 14:59:00 2026';
const OWNER_PID = 7000;
const CHILD_PID = 4242;

function orphanEntry(overrides = {}) {
  return {
    pid: CHILD_PID, pgid: CHILD_PID, binary: BINARY, commandLine: SERVE, startTime: START,
    ownerPid: OWNER_PID, ownerStartTime: OWNER_START, ...overrides,
  };
}

function immediateTimer(fn) {
  fn();
  return {unref() {}};
}

/**
 * Mundo falso com o dono (Mesa) e o filho (serve). `read`/`exists` só conhecem
 * esses dois pids; `kill` anota o sinal sem matar nada.
 */
function fakeWorld({ownerInfo = null} = {}) {
  const state = {childAlive: true, ownerInfo, signals: []};
  const read = (pid) => {
    if (pid === OWNER_PID) return state.ownerInfo;
    if (pid === CHILD_PID) return state.childAlive ? {commandLine: SERVE, startTime: START} : null;
    return null;
  };
  const exists = (pid) => {
    if (pid === OWNER_PID) return state.ownerInfo !== null;
    if (pid === CHILD_PID) return state.childAlive;
    return false;
  };
  const kill = (target) => {
    state.signals.push({...target});
    if (target.signal === 'SIGKILL') state.childAlive = false;
  };
  return {state, read, exists, kill};
}

test('S2: ledger sem hora do dono não mata o serve de uma Mesa viva', () => {
  const runtime = tempDir('mesa-owner-proof-');
  writeEntry(runtime, orphanEntry({ownerStartTime: ''}));
  const world = fakeWorld({ownerInfo: {commandLine: 'electron .', startTime: OWNER_START}});
  const result = sweepOrphans({dir: runtime, read: world.read, exists: world.exists, kill: world.kill, setTimer: immediateTimer});
  assert.deepEqual(world.state.signals, [], 'o pid do dono existe: não há prova de que a Mesa morreu');
  assert.equal(result.killed.length, 0);
  assert.match(result.skipped[0].reason, /dona do servidor ainda está viva/);
  assert.notEqual(readEntry(runtime), null, 'o registro da Mesa viva não é apagado');
});

test('S2: sem hora do dono, a ausência do pid dele libera a recolha', () => {
  const runtime = tempDir('mesa-owner-proof-');
  writeEntry(runtime, orphanEntry({ownerStartTime: ''}));
  const world = fakeWorld();
  const result = sweepOrphans({dir: runtime, read: world.read, exists: world.exists, kill: world.kill, setTimer: immediateTimer, graceMs: 0});
  assert.deepEqual(result.killed, [{pid: CHILD_PID, pgid: CHILD_PID}], 'o pid do dono sumiu: o serve é órfão');
  assert.equal(world.state.signals[0].signal, 'SIGTERM');
  rmSync(runtime, {recursive: true, force: true});
});


function fakeChild() {
  return Object.assign(new EventEmitter(), {pid: CHILD_PID, exitCode: null, signalCode: null,
    stdout: new PassThrough(), stderr: new PassThrough(), kill: () => true});
}

test('F2: o ledger grava a hora do dono mesmo quando o ps do dono falha', async () => {
  const runtime = tempDir('mesa-owner-proof-');
  const child = fakeChild();
  /* O ps do filho responde; o do dono falha nas duas tentativas. */
  const readInfo = (pid) => pid === CHILD_PID ? {commandLine: SERVE, startTime: START} : null;
  const pending = startOpenCodeServer({binary: BINARY, env: {}, spawnProcess: () => child, ledgerDir: runtime, readProcessInfo: readInfo});
  child.stdout.write('server listening on http://127.0.0.1:51234\n');
  await pending;
  const entry = readEntry(runtime);
  assert.equal(entry.ownerPid, process.pid);
  assert.ok(entry.ownerStartTime, 'sem ps, a hora do dono vem do relógio e do uptime');
  if (process.platform === 'win32') assert.match(entry.ownerStartTime, /^\d{15,}$/);
  else assert.match(entry.ownerStartTime, /^[A-Z][a-z]{2} [A-Z][a-z]{2} [ 0-9]\d \d\d:\d\d:\d\d \d{4}$/);
  child.exitCode = 0;
  child.emit('exit', 0);
  rmSync(runtime, {recursive: true, force: true});
});

test('F2: dono vivo com hora de fallback 1 s fora do ps não é recolhido', () => {
  const runtime = tempDir('mesa-owner-proof-');
  /* Duas leituras do MESMO instante de início, uma pelo fallback e outra como
     o ps/CIM devolveria; a diferença de 1 s é a resolução das duas. */
  const fallbackStart = processStartTime({now: 1793920000500, uptime: 0.5});
  const psStart = processStartTime({now: 1793920001500, uptime: 0.5});
  writeEntry(runtime, orphanEntry({ownerStartTime: fallbackStart}));
  const world = fakeWorld({ownerInfo: {commandLine: 'electron .', startTime: psStart}});
  const result = sweepOrphans({dir: runtime, read: world.read, exists: world.exists, kill: world.kill, setTimer: immediateTimer});
  assert.deepEqual(world.state.signals, [], 'a dona viva continua dona do serve');
  assert.equal(result.killed.length, 0);
  assert.match(result.skipped[0].reason, /dona do servidor ainda está viva/);
  assert.notEqual(readEntry(runtime), null);
  rmSync(runtime, {recursive: true, force: true});
});

test('F8: dono vivo com a hora de fallback 2 s à frente do ps não é recolhido', () => {
  const runtime = tempDir('mesa-owner-proof-');
  /* Medido numa máquina real com o MESMO processo vivo: o `ps lstart` fica
     2 s atrás do fallback (o `btime` truncado e a exibição truncada de novo),
     acima da folga antiga de 1,5 s. O teste usa a diferença real, não a borda
     de 1 s que passava antes. */
  const fallbackStart = processStartTime({now: 1793920002000, uptime: 0});
  const psStart = processStartTime({now: 1793920000000, uptime: 0});
  assert.notEqual(fallbackStart, psStart, 'premissa: as duas fontes veem 2 s de diferença');
  writeEntry(runtime, orphanEntry({ownerStartTime: fallbackStart}));
  const world = fakeWorld({ownerInfo: {commandLine: 'electron .', startTime: psStart}});
  const result = sweepOrphans({dir: runtime, read: world.read, exists: world.exists, kill: world.kill, setTimer: immediateTimer});
  assert.deepEqual(world.state.signals, [], 'a dona viva continua dona do serve');
  assert.equal(result.killed.length, 0);
  assert.match(result.skipped[0].reason, /dona do servidor ainda está viva/);
  assert.notEqual(readEntry(runtime), null);
  rmSync(runtime, {recursive: true, force: true});
});

test('F8: a folga cobre o pior erro medido e ainda fecha para um pid de outra hora', () => {
  const base = 'Thu Nov  5 21:00:00 2026';
  assert.equal(startTimesMatch('Thu Nov  5 21:00:02 2026', base), true, '2 s medido entre ps e fallback');
  assert.equal(startTimesMatch('Thu Nov  5 21:00:03 2026', base), true, '3 s: pior caso das duas fontes com margem');
  assert.equal(startTimesMatch('Thu Nov  5 21:00:04 2026', base), false, '4 s já não é a mesma dona');
});

test('F2: pid do dono reaproveitado com hora diferente libera a recolha', () => {
  const runtime = tempDir('mesa-owner-proof-');
  const ownerStart = processStartTime({now: 1793920000500, uptime: 0.5});
  const reusedStart = processStartTime({now: 1793980000500, uptime: 0.5});
  writeEntry(runtime, orphanEntry({ownerStartTime: ownerStart}));
  const world = fakeWorld({ownerInfo: {commandLine: 'daemon qualquer', startTime: reusedStart}});
  const result = sweepOrphans({dir: runtime, read: world.read, exists: world.exists, kill: world.kill, setTimer: immediateTimer, graceMs: 0});
  assert.deepEqual(world.state.signals[0], {pid: CHILD_PID, pgid: CHILD_PID, signal: 'SIGTERM'}, 'o pid não é a Mesa dona');
  assert.equal(result.killed.length, 1);
  rmSync(runtime, {recursive: true, force: true});
});

test('F14: a hora do dono medida no boot não anda com a suspensão do sistema', () => {
  /* `Date.now()` conta o tempo de suspensão; `process.uptime()` no Linux
     (`CLOCK_MONOTONIC`) não. Se o fallback fosse refeito na gravação do ledger,
     a dona viva depois de um suspend teria uma hora deslocada pelo tempo
     dormido e a recolha mataria o serve dela. A âncora é medida no boot. */
  const bootNow = 1793920000000;
  const bootUptime = 2;
  const bootStartMs = bootNow - bootUptime * 1000;
  const boot = processStartTime({now: bootNow, uptime: bootUptime, bootStartMs});
  const suspended = processStartTime({now: bootNow + 3600000, uptime: bootUptime + 60, bootStartMs});
  assert.equal(suspended, boot, 'a hora do dono não anda o tempo dormido');
  const naive = processStartTime({now: bootNow + 3600000, uptime: bootUptime + 60});
  assert.notEqual(naive, boot, 'premissa: sem a âncora, a conta anda 59 min de suspensão');
});
