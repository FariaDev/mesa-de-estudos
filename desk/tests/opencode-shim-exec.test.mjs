/* Prova da revisão de segurança: o shim `opencode2` faz `exec` no alvo
   `opencode`. Quando o `ps` do spawn pega a linha do shim (pré-exec) e o `ps`
   do stop/recolha pega a linha do alvo (pós-exec), `isAnnotatedServe` rejeitava
   o MESMO processo (mesmo pid, mesma hora de início, argumentos da Mesa
   intactos): o stop não mandava sinal e a recolha APAGAVA o registro do serve
   vivo (órfão sem rastro, com a chave do provedor em memória).
   Dependências entram por parâmetro: nenhum processo real é morto aqui. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import fs from 'node:fs';
import {basename, dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {tempDir} from './temp-dir.mjs';

const require = createRequire(import.meta.url);
const {isAnnotatedServe, serveBinaryFromCommandLine, sweepOrphans, readEntry, writeEntry, readProcessInfo, processExists, killGroup} = require('../src/agents/opencode-orphans.cjs');
const {startOpenCodeServer} = require('../src/agents/opencode-process.cjs');
const {placeBinary} = require('../src/agents/opencode-install.cjs');
const SHIM_TARGET = join(dirname(fileURLToPath(import.meta.url)), 'fake-opencode-shim-target.cjs');

const START = 'Wed Nov  4 15:00:00 2026';
const OWNER_START = 'Wed Nov  4 14:59:00 2026';
const SHIM = '/Users/alguem/.opencode/bin/opencode2';
const SHIM_LINE = `/bin/sh ${SHIM} serve --hostname 127.0.0.1 --port 0`;
const TARGET_LINE = 'node /Users/alguem/.opencode/bin/opencode serve --hostname 127.0.0.1 --port 0';
const CHILD_PID = 4242;
const OWNER_PID = 7000;

function createFakeSpawn() {
  const calls = [];
  const spawnProcess = (binary, args, options) => {
    const child = Object.assign(new EventEmitter(), {pid: CHILD_PID, exitCode: null, signalCode: null, stdout: new PassThrough(), stderr: new PassThrough(), kills: [],
      kill: (signal) => { child.kills.push(signal); return true; }});
    calls.push({binary, args, options, child});
    return child;
  };
  return {calls, spawnProcess};
}

function immediateTimer(fn) {
  fn();
  return {unref() {}};
}

test('isAnnotatedServe aceita o MESMO processo depois do exec do shim', () => {
  /* O ledger observou o shim no spawn; o alvo só aparece depois do exec. */
  const entry = {pid: CHILD_PID, pgid: CHILD_PID, binary: SHIM, commandLine: SHIM_LINE, startTime: START,
    ownerPid: OWNER_PID, ownerStartTime: OWNER_START, stopping: false};
  const info = {commandLine: TARGET_LINE, startTime: START};
  assert.equal(isAnnotatedServe(entry, info), true,
    'mesmo pid + mesma hora de início + argumentos da Mesa nas duas linhas: é o serve da Mesa');
});

test('F3: a transição do shim exige o alvo irmão e serve na posição certa', () => {
  const entry = {startTime: START, binary: SHIM};
  const casos = [
    {linha: '/opt/malicioso/opencode serve --hostname 127.0.0.1 --port 0', motivo: 'mesmo basename em outro diretório'},
    {linha: '/x/opencode run serve --hostname 127.0.0.1 --port 0', motivo: 'subcomando errado antes do serve'},
    {linha: 'python /tmp/x/opencode --eval serve --hostname 127.0.0.1 --port 0', motivo: 'token no meio do comando de outro programa'},
  ];
  for (const {linha, motivo} of casos) {
    assert.equal(isAnnotatedServe(entry, {commandLine: linha, startTime: START}), false, motivo);
  }
  assert.equal(isAnnotatedServe(entry, {commandLine: TARGET_LINE, startTime: START}), true,
    'o alvo que o placeBinary grava ao lado do shim continua aceito');
  assert.equal(isAnnotatedServe(entry, {commandLine: TARGET_LINE.replace('node ', ''), startTime: START}), true,
    'exec direto do alvo também');
});

test('a recolha NÃO descarta o registro do serve vivo que o shim executou', () => {
  const dir = tempDir('mesa-shim-exec-');
  writeEntry(dir, {pid: CHILD_PID, pgid: CHILD_PID, binary: SHIM, commandLine: SHIM_LINE, startTime: START,
    ownerPid: OWNER_PID, ownerStartTime: OWNER_START, stopping: true});
  const signals = [];
  let alive = true;
  const read = (pid) => {
    if (pid === OWNER_PID) return null;
    if (pid === CHILD_PID) return alive ? {commandLine: TARGET_LINE, startTime: START} : null;
    return null;
  };
  const exists = (pid) => (pid === CHILD_PID ? alive : false);
  const kill = (target) => { signals.push({...target}); alive = false; };
  const result = sweepOrphans({dir, read, exists, kill, setTimer: immediateTimer, graceMs: 0});
  assert.equal(result.killed.length, 1, 'o serve do shim é recolhido (é o do ledger)');
  assert.deepEqual(result.killed, [{pid: CHILD_PID, pgid: CHILD_PID}]);
  assert.equal(result.skipped.length, 0, 'nenhum "não é o serve da Mesa" para o alvo do shim');
});

test('o stop sinaliza o filho mesmo quando o ps mostra o alvo do shim', async () => {
  const {calls, spawnProcess} = createFakeSpawn();
  const dir = tempDir('mesa-shim-exec-stop-');
  const signals = [];
  let phase = 'spawn';
  const readInfo = (pid) => {
    if (pid === CHILD_PID) return phase === 'spawn' ? {commandLine: SHIM_LINE, startTime: START} : {commandLine: TARGET_LINE, startTime: START};
    return {commandLine: 'node mesa', startTime: OWNER_START};
  };
  const pending = startOpenCodeServer({binary: SHIM, env: {}, spawnProcess, ledgerDir: dir,
    readProcessInfo: readInfo, kill: (target) => signals.push({...target}), graceMs: 10, afterKillMs: 10});
  calls[0].child.stdout.write('server listening on http://127.0.0.1:51234\n');
  const server = await pending;
  const entry = readEntry(dir);
  assert.equal(entry.commandLine, SHIM_LINE, 'premissa: o ps do spawn pegou a linha do shim (pré-exec)');
  assert.equal(basename(entry.binary), 'opencode2', 'premissa: o ledger guardou o atalho, não o alvo');
  phase = 'stop';
  await server.stop();
  const signaled = signals.length > 0 || calls[0].child.kills.length > 0;
  assert.equal(signaled, true, 'o stop tem de sinalizar o filho que esta Mesa criou (mesmo pid/hora do ledger)');
  assert.notEqual(readEntry(dir), null, 'o ledger não some enquanto o filho não der exit');
});

test('ponta a ponta: shim real do instalador visto ANTES do exec ainda é parado', {skip: process.platform === 'win32', timeout: 20000}, async () => {
  const home = tempDir('mesa-shim-real-');
  const ledger = tempDir('mesa-shim-real-ledger-');
  await placeBinary({binary: SHIM_TARGET, home, platform: process.platform});
  const shim = join(home, '.opencode', 'bin', 'opencode2');
  const target = join(home, '.opencode', 'bin', 'opencode');
  const shimLine = `/bin/sh ${shim} serve --hostname 127.0.0.1 --port 0`;
  assert.equal(fs.readFileSync(shim, 'utf8'), '#!/bin/sh\nexec "$(dirname "$0")/opencode" "$@"\n', 'conteúdo real do instalador');
  /* Força a corrida: o ps do spawn devolve a linha do shim (pré-exec) e o do
     stop/devolve a linha real do alvo, com a mesma hora de início do processo. */
  let phase = 'spawn';
  const readShimFirst = (pid) => {
    const real = readProcessInfo(pid);
    if (!real || pid === process.pid) return real;
    if (phase === 'spawn') return {commandLine: shimLine, startTime: real.startTime};
    return real;
  };
  const server = await startOpenCodeServer({binary: shim, cwd: tempDir('mesa-shim-real-cwd-'), env: {...process.env}, ledgerDir: ledger,
    readProcessInfo: readShimFirst, timeoutMs: 15000});
  const pid = server.pid;
  try {
    const entry = readEntry(ledger);
    assert.equal(entry.commandLine, shimLine, 'o ledger viu o shim (pré-exec)');
    assert.equal(basename(entry.binary), 'opencode2', 'o ledger guardou o atalho, não o alvo');
    phase = 'stop';
    const realTarget = readProcessInfo(pid);
    assert.ok(realTarget && realTarget.commandLine.includes(target),
      `o ps do stop vê o alvo ($LINE): ${realTarget?.commandLine}`);
    await server.stop();
    const deadline = Date.now() + 5000;
    while (processExists(pid) && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 25));
    assert.equal(processExists(pid), false, 'o serve do shim foi encerrado pelo stop');
    assert.equal(readEntry(ledger), null, 'o ledger só some depois da saída');
  } finally {
    if (processExists(pid)) {
      try { killGroup({pid, pgid: pid, signal: 'SIGKILL'}); } catch { /* já saiu */ }
    }
  }
});

test('F9: shim real em pasta com espaço continua aceito depois do exec', {skip: process.platform === 'win32', timeout: 20000}, async () => {
  /* O `placeBinary` grava o shim com `exec "$(dirname "$0")/opencode"`, que
     funciona com espaço no caminho. A leitura por `\s+` cortava o caminho no
     espaço e o stop/recolha recusava o MESMO processo pós-exec. */
  const home = join(tempDir('mesa-shim-espaco-'), 'Joao Silva');
  fs.mkdirSync(home, {recursive: true});
  await placeBinary({binary: SHIM_TARGET, home, platform: process.platform});
  const shim = join(home, '.opencode', 'bin', 'opencode2');
  const target = join(home, '.opencode', 'bin', 'opencode');
  const shimLine = `/bin/sh ${shim} serve --hostname 127.0.0.1 --port 0`;
  const targetLine = `${target} serve --hostname 127.0.0.1 --port 0`;
  assert.ok(shim.includes(' '), 'premissa: o caminho do shim tem espaço');
  assert.equal(serveBinaryFromCommandLine(shimLine, shim), shim,
    'o ledger guarda o caminho inteiro do shim, não o pedaço depois do espaço');
  assert.equal(isAnnotatedServe({startTime: START, binary: shim}, {commandLine: targetLine, startTime: START}), true,
    'o alvo irmão do shim com espaço na pasta é aceito pós-exec');

  const ledger = tempDir('mesa-shim-espaco-ledger-');
  let phase = 'spawn';
  const readShimFirst = (pid) => {
    const real = readProcessInfo(pid);
    if (!real || pid === process.pid) return real;
    if (phase === 'spawn') return {commandLine: shimLine, startTime: real.startTime};
    return real;
  };
  const server = await startOpenCodeServer({binary: shim, cwd: tempDir('mesa-shim-espaco-cwd-'), env: {...process.env},
    ledgerDir: ledger, readProcessInfo: readShimFirst, timeoutMs: 15000});
  const pid = server.pid;
  try {
    const entry = readEntry(ledger);
    assert.equal(entry.commandLine, shimLine, 'o ledger viu o shim (pré-exec)');
    assert.equal(entry.binary, shim, 'o ledger guardou o caminho inteiro do shim');
    phase = 'stop';
    const realTarget = readProcessInfo(pid);
    assert.ok(realTarget && realTarget.commandLine.includes(target),
      `o ps do stop vê o alvo: ${realTarget?.commandLine}`);
    await server.stop();
    const deadline = Date.now() + 5000;
    while (processExists(pid) && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 25));
    assert.equal(processExists(pid), false, 'o serve do shim com espaço foi encerrado pelo stop');
    assert.equal(readEntry(ledger), null, 'o ledger só some depois da saída');
  } finally {
    if (processExists(pid)) {
      try { killGroup({pid, pgid: pid, signal: 'SIGKILL'}); } catch { /* já saiu */ }
    }
  }
});

test('F21: linha de comando do Windows com aspas não quebra o ramo do shim', () => {
  /* O CIM preserva as aspas do caminho com espaço. O ledger gravava o
     candidato COM aspas; na leitura seguinte o basename do shim virava
     `opencode2.cmd"`, o alvo irmão não era reconhecido e o pós-exec do shim
     era rejeitado. O candidato agora é normalizado para o próprio target. */
  const shim = 'C:\\Users\\Joao Silva\\.opencode\\bin\\opencode2.cmd';
  const target = 'C:\\Users\\Joao Silva\\.opencode\\bin\\opencode.exe';
  const shimLine = `"${shim}" serve --hostname 127.0.0.1 --port 0`;
  const targetLine = `"${target}" serve --hostname 127.0.0.1 --port 0`;
  assert.equal(serveBinaryFromCommandLine(shimLine, shim), shim,
    'o ledger grava o caminho do shim sem as aspas do CIM');
  assert.equal(isAnnotatedServe({startTime: START, binary: shim}, {commandLine: targetLine, startTime: START}), true,
    'o alvo irmão do shim continua aceito depois do exec no formato do Windows');
});
