/* Recolha do `opencode serve` que a Mesa deixou para trás (#105).
 *
 * O ledger guarda o pid/pgid, a linha de comando, a hora de início do filho e
 * o dono (pid e hora de início da Mesa). No próximo arranque só esse processo
 * é tocado, e só quando a hora de início E os argumentos do serve da Mesa
 * ainda batem. Processo fora do ledger não é tocado; PID reutilizado, serve do
 * usuário e Mesa irmã viva também não. Sem prova, nada é morto.
 *
 * As dependências entram por parâmetro (leitura de processo, existência,
 * kill e timer): os testes de unidade usam fakes nomeados e NÃO matam
 * processo de verdade. O último teste reproduz a queda com o
 * `fake-opencode.mjs` e mata só o que ele mesmo criou. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {chmodSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join} from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {trackTempDir} from './temp-dir.mjs';

const require = createRequire(import.meta.url);
const {sweepOrphans, killGroup, isMesaServe, isAnnotatedServe, serveBinaryFromCommandLine, readEntry, writeEntry, clearEntry, ledgerPath, readProcessInfo, processExists, markEntryStopping} = require('../src/agents/opencode-orphans.cjs');

const SERVE = '/Users/alguem/.opencode/bin/opencode serve --hostname 127.0.0.1 --port 0';
const USER_SERVE = '/Users/alguem/.opencode/bin/opencode serve --hostname 127.0.0.1 --port 4096';
const BINARY = '/Users/alguem/.opencode/bin/opencode';
const START = 'Wed Nov  4 15:00:00 2026';
const OWNER_START = 'Wed Nov  4 14:59:00 2026';
const OWNER_PID = 7000;
const CHILD_PID = 4242;

function tempRuntime() {
  return trackTempDir(mkdtempSync(join(tmpdir(), 'mesa-opencode-orphans-')));
}

function orphanEntry(overrides = {}) {
  return {
    pid: CHILD_PID, pgid: CHILD_PID, binary: BINARY, commandLine: SERVE, startTime: START,
    ownerPid: OWNER_PID, ownerStartTime: OWNER_START, ...overrides,
  };
}

/** Roda o timer na hora: o teste não espera a carência do SIGKILL. */
function immediateTimer(fn) {
  fn();
  return {unref() {}};
}

/**
 * Mundo falso com dois processos: o dono (Mesa) e o filho (serve). `read` e
 * `exists` só conhecem esses dois pids; `kill` anota o sinal e, por padrão,
 * considera que o SIGTERM já encerrou o filho.
 */
function fakeWorld({childInfo = {commandLine: SERVE, startTime: START}, ownerInfo = null, dieOnTerm = true} = {}) {
  const state = {childAlive: true, childInfo, ownerInfo, signals: []};
  const read = (pid) => {
    if (pid === OWNER_PID) return state.ownerInfo;
    if (pid === CHILD_PID) return state.childAlive ? state.childInfo : null;
    return null;
  };
  const exists = (pid) => {
    if (pid === OWNER_PID) return state.ownerInfo !== null;
    if (pid === CHILD_PID) return state.childAlive;
    return false;
  };
  const kill = (target) => {
    state.signals.push({...target});
    if (target.signal === 'SIGKILL' || dieOnTerm) state.childAlive = false;
  };
  return {state, read, exists, kill};
}

test('a linha de comando aceita o binário direto e o script com shebang', () => {
  assert.equal(isMesaServe(SERVE, BINARY), true);
  assert.equal(isMesaServe('node /Users/alguem/.opencode/bin/opencode serve --hostname 127.0.0.1 --port 0', BINARY), true, 'script com shebang (#105)');
  assert.equal(isMesaServe(SERVE, ''), true, 'sem binário no ledger, o nome opencode serve');
  assert.equal(isMesaServe('/usr/bin/python3 servidor.py', BINARY), false);
  assert.equal(isMesaServe('/Users/alguem/.opencode/bin/opencode run', BINARY), false, 'outro subcomando não é o serve');
  assert.equal(isMesaServe('/Users/alguem/.opencode/bin/opencode serve', BINARY), false, 'serve sem os argumentos da Mesa não é o da Mesa');
  assert.equal(isMesaServe('/Users/alguem/.opencode/bin/opencode serve --port 5555', BINARY), false, 'serve do usuário em outra porta não é o da Mesa');
  assert.equal(isMesaServe('', BINARY), false);
  assert.equal(isMesaServe(null, ''), false);
});

test('a prova de identidade também exige o binário quando o registro o tem', () => {
  const info = {commandLine: `node ${BINARY} serve --hostname 127.0.0.1 --port 0`, startTime: START};
  assert.equal(isAnnotatedServe({startTime: START, binary: BINARY}, info), true, 'script com shebang');
  const outro = {commandLine: '/usr/local/bin/outro-opencode serve --hostname 127.0.0.1 --port 0', startTime: START};
  assert.equal(isAnnotatedServe({startTime: START, binary: BINARY}, outro), false, 'mesmo sufixo de argumentos, outro binário');
  assert.equal(isAnnotatedServe({startTime: START}, outro), true, 'registro antigo sem binário mantém a regra atual');
});

test('a prova de identidade aceita o alvo que o shim opencode2 executou', () => {
  const shim = '/Users/alguem/.opencode/bin/opencode2';
  const info = {commandLine: `node ${BINARY} serve --hostname 127.0.0.1 --port 0`, startTime: START};
  assert.equal(isAnnotatedServe({startTime: START, binary: shim, commandLine: info.commandLine}, info), true,
    'o ledger registra a linha de comando real, não o nome do atalho');
  assert.equal(isAnnotatedServe({startTime: START, binary: shim}, info), true,
    'o shim opencode2 executa o opencode irmão: mesmo pid/hora e argumentos da Mesa');
  assert.equal(isAnnotatedServe({startTime: 'Thu Nov  5 09:00:00 2026', binary: shim}, info), false,
    'hora de início diferente não é o mesmo processo');
  assert.equal(isAnnotatedServe({startTime: START, binary: shim},
    {commandLine: '/usr/local/bin/outro-opencode serve --hostname 127.0.0.1 --port 0', startTime: START}), false,
    'outro binário com o mesmo sufixo de argumentos não é o alvo do shim');
});

test('serveBinaryFromCommandLine devolve o alvo executado, não o atalho', () => {
  assert.equal(serveBinaryFromCommandLine(`node ${BINARY} serve --hostname 127.0.0.1 --port 0`), BINARY);
  assert.equal(serveBinaryFromCommandLine(SERVE, '/atalho/opencode2'), BINARY);
  assert.equal(serveBinaryFromCommandLine('node outro.js', '/atalho/opencode2'), '/atalho/opencode2', 'sem os argumentos da Mesa, fica o binário configurado');
});

test('baseName cobre .exe, .cmd e .bat do Windows', () => {
  assert.equal(isMesaServe('C:\\tools\\opencode serve --hostname 127.0.0.1 --port 0', 'C:\\tools\\opencode.exe'), true);
  assert.equal(isMesaServe('C:\\tools\\opencode serve --hostname 127.0.0.1 --port 0', 'C:\\tools\\opencode.cmd'), true);
  assert.equal(isMesaServe('C:\\tools\\opencode serve --hostname 127.0.0.1 --port 0', 'C:\\tools\\opencode.bat'), true);
});

test('registro do shim opencode2: a recolha reconhece o alvo executado', () => {
  const runtime = tempRuntime();
  try {
    const commandLine = `node ${BINARY} serve --hostname 127.0.0.1 --port 0`;
    writeEntry(runtime, orphanEntry({binary: '/Users/alguem/.opencode/bin/opencode2', commandLine}));
    const world = fakeWorld({childInfo: {commandLine, startTime: START}});
    const result = sweepOrphans({dir: runtime, read: world.read, exists: world.exists, kill: world.kill, setTimer: immediateTimer, graceMs: 0});
    assert.deepEqual(result.killed, [{pid: CHILD_PID, pgid: CHILD_PID}], 'o serve do shim é recolhido');
    assert.deepEqual(world.state.signals, [{pid: CHILD_PID, pgid: CHILD_PID, signal: 'SIGTERM'}]);
  } finally {
    rmSync(runtime, {recursive: true, force: true});
  }
});

test('serve de outro binário com o mesmo sufixo não é recolhido', () => {
  const runtime = tempRuntime();
  try {
    writeEntry(runtime, orphanEntry());
    const world = fakeWorld({childInfo: {commandLine: '/usr/local/bin/outro-opencode serve --hostname 127.0.0.1 --port 0', startTime: START}});
    const result = sweepOrphans({dir: runtime, read: world.read, exists: world.exists, kill: world.kill, setTimer: immediateTimer});
    assert.deepEqual(world.state.signals, [], 'nada é morto');
    assert.equal(result.skipped.length, 1);
    assert.match(result.skipped[0].reason, /linha de comando/);
  } finally {
    rmSync(runtime, {recursive: true, force: true});
  }
});

test('readProcessInfo tem prazo: estouro vira ausência de prova', () => {
  const calls = [];
  const timeout = () => { throw Object.assign(Error('ETIMEDOUT'), {code: 'ETIMEDOUT'}); };
  const execFile = (file, args, options) => { calls.push({file, args, options}); return timeout(); };
  assert.equal(readProcessInfo(4242, {execFile, platform: 'linux'}), null);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].file, 'ps');
  assert.ok(Number.isInteger(calls[0].options.timeout) && calls[0].options.timeout > 0 && calls[0].options.timeout <= 3000,
    'o ps leva timeout curto, não espera para sempre');
});

test('readProcessInfo no Windows também tem prazo', () => {
  const calls = [];
  const execFile = (file, args, options) => { calls.push({file, args, options}); throw Object.assign(Error('ETIMEDOUT'), {code: 'ETIMEDOUT'}); };
  assert.equal(readProcessInfo(4242, {execFile, platform: 'win32'}), null);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].file, 'powershell');
  assert.ok(Number.isInteger(calls[0].options.timeout) && calls[0].options.timeout > 0 && calls[0].options.timeout <= 5000,
    'o CIM também tem prazo');
});

test('readProcessInfo lê a própria linha de comando e a hora de início', {skip: process.platform === 'win32'}, () => {
  const info = readProcessInfo(process.pid);
  assert.ok(info);
  assert.match(info.startTime, /^[A-Z][a-z]{2} [A-Z][a-z]{2} [ 0-9]\d \d\d:\d\d:\d\d \d{4}$/);
  assert.match(info.commandLine, /node/i);
});

test('o servidor do ledger é encerrado com SIGTERM e o registro some', async () => {
  const runtime = tempRuntime();
  try {
    writeEntry(runtime, orphanEntry());
    const world = fakeWorld();
    const result = sweepOrphans({dir: runtime, read: world.read, exists: world.exists, kill: world.kill, setTimer: immediateTimer, graceMs: 0});
    assert.deepEqual(result.killed, [{pid: CHILD_PID, pgid: CHILD_PID}]);
    assert.deepEqual(world.state.signals, [{pid: CHILD_PID, pgid: CHILD_PID, signal: 'SIGTERM'}]);
    await result.done;
    assert.equal(readEntry(runtime), null, 'o registro é apagado depois da recolha');
  } finally {
    rmSync(runtime, {recursive: true, force: true});
  }
});

test('SIGTERM não bastou: escala para SIGKILL depois da carência', async () => {
  const runtime = tempRuntime();
  try {
    writeEntry(runtime, orphanEntry());
    const world = fakeWorld({dieOnTerm: false});
    const result = sweepOrphans({dir: runtime, read: world.read, exists: world.exists, kill: world.kill, setTimer: immediateTimer, graceMs: 0});
    await result.done;
    assert.deepEqual(world.state.signals.map((item) => item.signal), ['SIGTERM', 'SIGKILL']);
    assert.equal(readEntry(runtime), null);
  } finally {
    rmSync(runtime, {recursive: true, force: true});
  }
});

test('a escalada atrasada não apaga o ledger de um servidor novo', async () => {
  const runtime = tempRuntime();
  try {
    writeEntry(runtime, orphanEntry());
    const world = fakeWorld({dieOnTerm: false});
    let fire = () => {};
    const result = sweepOrphans({dir: runtime, read: world.read, exists: world.exists, kill: world.kill,
      setTimer: (fn) => { fire = fn; return {unref() {}}; }, graceMs: 1});
    writeEntry(runtime, orphanEntry({pid: 5151, pgid: 5151, startTime: 'Wed Nov  4 16:00:00 2026'}));
    fire();
    await result.done;
    assert.equal(readEntry(runtime).pid, 5151, 'o registro do servidor novo fica');
  } finally {
    rmSync(runtime, {recursive: true, force: true});
  }
});

test('linha de comando que não é o serve da Mesa: o processo não é tocado', () => {
  const runtime = tempRuntime();
  try {
    writeEntry(runtime, orphanEntry());
    const world = fakeWorld({childInfo: {commandLine: '/usr/bin/python3 meu-servidor.py', startTime: START}});
    const result = sweepOrphans({dir: runtime, read: world.read, exists: world.exists, kill: world.kill, setTimer: immediateTimer});
    assert.deepEqual(world.state.signals, [], 'nada é morto');
    assert.equal(result.killed.length, 0);
    assert.equal(result.skipped.length, 1);
    assert.match(result.skipped[0].reason, /linha de comando/);
    assert.equal(readEntry(runtime), null, 'na dúvida, limpa a anotação');
  } finally {
    rmSync(runtime, {recursive: true, force: true});
  }
});

test('serve do usuário em outra porta não é tocado pela recolha', () => {
  const runtime = tempRuntime();
  try {
    writeEntry(runtime, orphanEntry());
    const world = fakeWorld({childInfo: {commandLine: USER_SERVE, startTime: START}});
    const result = sweepOrphans({dir: runtime, read: world.read, exists: world.exists, kill: world.kill, setTimer: immediateTimer});
    assert.deepEqual(world.state.signals, [], 'o serve do usuário continua vivo');
    assert.equal(result.skipped.length, 1);
    assert.equal(readEntry(runtime), null);
  } finally {
    rmSync(runtime, {recursive: true, force: true});
  }
});

test('PID reutilizado: argumentos iguais com hora de início diferente não bastam', () => {
  const runtime = tempRuntime();
  try {
    writeEntry(runtime, orphanEntry());
    const world = fakeWorld({childInfo: {commandLine: SERVE, startTime: 'Thu Nov  5 09:00:00 2026'}});
    const result = sweepOrphans({dir: runtime, read: world.read, exists: world.exists, kill: world.kill, setTimer: immediateTimer});
    assert.deepEqual(world.state.signals, [], 'outro processo com o mesmo pid não é morto');
    assert.equal(result.skipped.length, 1);
    assert.match(result.skipped[0].reason, /hora de início/);
    assert.equal(readEntry(runtime), null);
  } finally {
    rmSync(runtime, {recursive: true, force: true});
  }
});

test('Mesa irmã viva: o serve dela não é tocado e o ledger fica', () => {
  const runtime = tempRuntime();
  try {
    writeEntry(runtime, orphanEntry());
    const world = fakeWorld({ownerInfo: {commandLine: 'electron .', startTime: OWNER_START}});
    const result = sweepOrphans({dir: runtime, read: world.read, exists: world.exists, kill: world.kill, setTimer: immediateTimer});
    assert.deepEqual(world.state.signals, [], 'a Mesa viva continua dona do serve');
    assert.equal(result.killed.length, 0);
    assert.match(result.skipped[0].reason, /dona do servidor ainda está viva/);
    assert.notEqual(readEntry(runtime), null, 'o registro da Mesa viva não é apagado');
  } finally {
    rmSync(runtime, {recursive: true, force: true});
  }
});

test('marcar "encerrando" só vale para o mesmo pid e a mesma hora de início', () => {
  const runtime = tempRuntime();
  try {
    writeEntry(runtime, orphanEntry());
    assert.equal(markEntryStopping(runtime, {pid: CHILD_PID, startTime: START}), true);
    assert.equal(readEntry(runtime).stopping, true);
    writeEntry(runtime, orphanEntry({pid: 5151, pgid: 5151, startTime: 'Wed Nov  4 16:00:00 2026'}));
    assert.equal(markEntryStopping(runtime, {pid: CHILD_PID, startTime: START}), false, 'o registro de outra Mesa não é tocado');
    const other = readEntry(runtime);
    assert.equal(other.pid, 5151);
    assert.equal(other.stopping, false);
  } finally {
    rmSync(runtime, {recursive: true, force: true});
  }
});

test('registro "encerrando" com dono morto é recolhido na próxima abertura', async () => {
  const runtime = tempRuntime();
  try {
    writeEntry(runtime, orphanEntry({stopping: true}));
    assert.equal(readEntry(runtime).stopping, true, 'a marca fica no ledger');
    const world = fakeWorld();
    const result = sweepOrphans({dir: runtime, read: world.read, exists: world.exists, kill: world.kill, setTimer: immediateTimer, graceMs: 0});
    assert.deepEqual(result.killed, [{pid: CHILD_PID, pgid: CHILD_PID}]);
    await result.done;
    assert.equal(readEntry(runtime), null);
  } finally {
    rmSync(runtime, {recursive: true, force: true});
  }
});

test('registro "encerrando" com dono vivo não é tocado: quem encerra ainda é a Mesa', () => {
  const runtime = tempRuntime();
  try {
    writeEntry(runtime, orphanEntry({stopping: true}));
    const world = fakeWorld({ownerInfo: {commandLine: 'electron .', startTime: OWNER_START}});
    const result = sweepOrphans({dir: runtime, read: world.read, exists: world.exists, kill: world.kill, setTimer: immediateTimer});
    assert.deepEqual(world.state.signals, []);
    assert.match(result.skipped[0].reason, /dona do servidor ainda está viva/);
    assert.equal(readEntry(runtime).stopping, true);
  } finally {
    rmSync(runtime, {recursive: true, force: true});
  }
});

test('dono com PID reutilizado por outro programa não conta como Mesa viva', () => {
  const runtime = tempRuntime();
  try {
    writeEntry(runtime, orphanEntry());
    const world = fakeWorld({ownerInfo: {commandLine: 'outro programa', startTime: 'Thu Nov  5 08:00:00 2026'}});
    const result = sweepOrphans({dir: runtime, read: world.read, exists: world.exists, kill: world.kill, setTimer: immediateTimer});
    assert.equal(result.killed.length, 1);
    assert.equal(world.state.signals[0].signal, 'SIGTERM');
  } finally {
    rmSync(runtime, {recursive: true, force: true});
  }
});

test('registro sem hora de início: não há prova, não mata e não descarta', () => {
  const runtime = tempRuntime();
  try {
    writeEntry(runtime, orphanEntry({commandLine: '', startTime: ''}));
    const world = fakeWorld();
    const result = sweepOrphans({dir: runtime, read: world.read, exists: world.exists, kill: world.kill, setTimer: immediateTimer});
    assert.deepEqual(world.state.signals, []);
    assert.match(result.skipped[0].reason, /sem hora de início/);
    assert.notEqual(readEntry(runtime), null, 'sem prova, o registro fica para a próxima abertura');
  } finally {
    rmSync(runtime, {recursive: true, force: true});
  }
});

test('ps estourou na recolha: sem prova, não mata e mantém o registro', () => {
  const runtime = tempRuntime();
  try {
    writeEntry(runtime, orphanEntry());
    const kills = [];
    const result = sweepOrphans({dir: runtime, read: () => null, exists: (pid) => pid === CHILD_PID, kill: (target) => kills.push(target), setTimer: immediateTimer});
    assert.deepEqual(kills, []);
    assert.equal(result.killed.length, 0);
    assert.match(result.skipped[0].reason, /sem prova/);
    assert.notEqual(readEntry(runtime), null, 'a ausência de prova não pode apagar o registro');
  } finally {
    rmSync(runtime, {recursive: true, force: true});
  }
});

test('pid que não existe mais: nada é morto e o registro some', () => {
  const runtime = tempRuntime();
  try {
    writeEntry(runtime, orphanEntry());
    const world = fakeWorld();
    world.state.childAlive = false;
    const result = sweepOrphans({dir: runtime, read: world.read, exists: world.exists, kill: world.kill, setTimer: immediateTimer});
    assert.deepEqual(world.state.signals, []);
    assert.equal(result.killed.length, 0);
    assert.equal(readEntry(runtime), null);
  } finally {
    rmSync(runtime, {recursive: true, force: true});
  }
});

test('ledger corrompido no meio da escrita não impede a Mesa de abrir', () => {
  const runtime = tempRuntime();
  try {
    writeFileSync(ledgerPath(runtime), '{"pid": 4242, "startTime":');
    const world = fakeWorld();
    const result = sweepOrphans({dir: runtime, read: world.read, exists: world.exists, kill: world.kill, setTimer: immediateTimer});
    assert.deepEqual(result, {killed: [], skipped: [], entry: null});
    writeEntry(runtime, orphanEntry());
    assert.notEqual(readEntry(runtime), null, 'o próximo servidor grava o ledger de novo');
  } finally {
    rmSync(runtime, {recursive: true, force: true});
  }
});

test('processo fora do ledger nunca é tocado', () => {
  const runtime = tempRuntime();
  try {
    clearEntry(runtime);
    const world = fakeWorld();
    const seen = [];
    const result = sweepOrphans({dir: runtime, read: (pid) => { seen.push(pid); return world.read(pid); }, exists: world.exists, kill: world.kill, setTimer: immediateTimer});
    assert.deepEqual(world.state.signals, []);
    assert.deepEqual(seen, [], 'sem registro, nem se procura processo nenhum');
    assert.equal(result.entry, null);
  } finally {
    rmSync(runtime, {recursive: true, force: true});
  }
});

test('o ledger não guarda senha e só vale para o runtime da Mesa', () => {
  const runtime = tempRuntime();
  try {
    writeEntry(runtime, orphanEntry());
    const entry = readEntry(runtime);
    assert.deepEqual(Object.keys(entry).sort(), ['binary', 'commandLine', 'ownerPid', 'ownerStartTime', 'pgid', 'pid', 'startTime', 'stopping']);
    assert.equal(JSON.stringify(entry).includes('password'), false);
    assert.equal(JSON.stringify(entry).includes('senha'), false);
  } finally {
    rmSync(runtime, {recursive: true, force: true});
  }
});

test('pgid estragado no ledger: encerra só o grupo do pid conferido, nunca kill(-1)', () => {
  const runtime = tempRuntime();
  try {
    writeFileSync(ledgerPath(runtime), JSON.stringify(orphanEntry({pgid: 1})));
    const world = fakeWorld();
    const result = sweepOrphans({dir: runtime, read: world.read, exists: world.exists, kill: world.kill, setTimer: immediateTimer});
    assert.deepEqual(world.state.signals, [{pid: CHILD_PID, pgid: CHILD_PID, signal: 'SIGTERM'}]);
    assert.deepEqual(result.killed, [{pid: CHILD_PID, pgid: CHILD_PID}]);
  } finally {
    rmSync(runtime, {recursive: true, force: true});
  }
});

async function waitUntil(predicate, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    /* espera fixa: o processo sai alguns milissegundos depois do SIGTERM */
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

test('ponta a ponta: SIGKILL no pai e a recolha encerra o fake-opencode', {skip: process.platform === 'win32'}, async () => {
  const runtime = tempRuntime();
  const testsDir = dirname(fileURLToPath(import.meta.url));
  const helper = join(testsDir, 'fake-opencode-orphan-parent.cjs');
  const binary = join(testsDir, 'fake-opencode.mjs');
  chmodSync(binary, 0o755);
  /* Este cenário é a queda do dono: o fake NÃO pode sair sozinho pela guarda
     de órfão do harness, senão não há o que a recolha recolha. */
  const parent = spawn(process.execPath, [helper, runtime, binary],
    {stdio: ['ignore', 'pipe', 'pipe'], env: {...process.env, FAKE_OPENCODE_IGNORE_PARENT_DEATH: '1', MESA_TEST_OWNER_PID: ''}});
  let childPid = 0;
  let ledgerEntry = null;
  try {
    childPid = await new Promise((resolve, reject) => {
      let output = '';
      const timer = setTimeout(() => reject(Error(`o pai falso não anunciou o servidor: ${output}`)), 15000);
      parent.stdout.setEncoding('utf8');
      parent.stderr.setEncoding('utf8');
      parent.stderr.on('data', (chunk) => { output += chunk; });
      parent.stdout.on('data', (chunk) => {
        output += chunk;
        const line = output.split('\n')[0];
        if (!line || !line.includes('pid')) return;
        clearTimeout(timer);
        resolve(JSON.parse(line).pid);
      });
      parent.on('exit', (code) => { clearTimeout(timer); reject(Error(`o pai falso saiu (${code}): ${output}`)); });
    });
    ledgerEntry = readEntry(runtime);
    assert.equal(ledgerEntry.pid, childPid);
    assert.equal(ledgerEntry.ownerPid, parent.pid);
    assert.ok(ledgerEntry.startTime, 'a hora de início foi anotada');
    assert.equal(processExists(childPid), true);

    parent.kill('SIGKILL');
    await new Promise((resolve) => parent.once('exit', resolve));
    const result = sweepOrphans({dir: runtime, graceMs: 50});
    assert.deepEqual(result.killed, [{pid: childPid, pgid: childPid}]);
    await result.done;
    await waitUntil(() => !processExists(childPid), 5000);
    assert.equal(processExists(childPid), false, 'o filho do fake-opencode saiu');
    assert.equal(readEntry(runtime), null);
  } finally {
    if (parent.exitCode === null && parent.signalCode === null) {
      try { parent.kill('SIGKILL'); } catch { /* já saiu */ }
    }
    if (childPid && processExists(childPid)) {
      const info = readProcessInfo(childPid);
      const mine = info && ledgerEntry && info.startTime === ledgerEntry.startTime
        && info.commandLine.includes('fake-opencode.mjs') && info.commandLine.includes('serve');
      if (mine) {
        try { process.kill(-childPid, 'SIGKILL'); } catch { try { process.kill(childPid, 'SIGKILL'); } catch { /* já saiu */ } }
      }
    }
    rmSync(runtime, {recursive: true, force: true});
  }
});

/* Revisão do release: `kill(-0)` é `kill(0)`, que sinaliza o grupo da própria Mesa. */
test('killGroup sem pid não sinaliza o grupo da própria Mesa', {skip: process.platform === 'win32'}, (t) => {
  const kill = t.mock.method(process, 'kill', () => true);
  killGroup({pid: 0, pgid: 0, signal: 'SIGTERM'});
  killGroup({});
  assert.equal(kill.mock.callCount(), 0);
});

test('killGroup nunca chama process.kill com alvo de valor absoluto <= 1', {skip: process.platform === 'win32'}, (t) => {
  const kill = t.mock.method(process, 'kill', () => true);
  killGroup({pid: 0, pgid: 1, signal: 'SIGTERM'});
  killGroup({pid: 1, pgid: 1, signal: 'SIGTERM'});
  killGroup({pid: 1, pgid: 4242, signal: 'SIGTERM'});
  killGroup({pid: -9, pgid: 1, signal: 'SIGTERM'});
  assert.equal(kill.mock.callCount(), 0, 'init, grupo 1 e pid 1 ficam fora');
  killGroup({pid: 4242, pgid: 1, signal: 'SIGTERM'});
  assert.deepEqual(kill.mock.calls.map((call) => call.arguments), [[-4242, 'SIGTERM']], 'pgid estragado cai no grupo do pid validado');
});

test('processExists não manda sinal para pid <= 1', {skip: process.platform === 'win32'}, (t) => {
  const kill = t.mock.method(process, 'kill', () => true);
  assert.equal(processExists(0), false);
  assert.equal(processExists(1), false);
  assert.equal(kill.mock.callCount(), 0);
  assert.equal(processExists(4242), true);
  assert.deepEqual(kill.mock.calls.map((call) => call.arguments), [[4242, 0]]);
});

test('registro com pid <= 1 é recusado na leitura e na gravação', () => {
  const runtime = tempRuntime();
  try {
    writeFileSync(ledgerPath(runtime), JSON.stringify(orphanEntry({pid: 1, pgid: 1})));
    assert.equal(readEntry(runtime), null, 'pid 1 não vira registro');
    assert.throws(() => writeEntry(runtime, {pid: 0}), /pid 0/);
    assert.throws(() => writeEntry(runtime, {pid: 1}), /pid 1/);
    assert.equal(readEntry(runtime), null);
  } finally {
    rmSync(runtime, {recursive: true, force: true});
  }
});
