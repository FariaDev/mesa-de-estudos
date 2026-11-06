/* Processo do `opencode serve` da Mesa (#57). `fakeSpawn` é um filho nomeado
   que não abre nada; o último caso sobe o `fake-opencode.mjs` de verdade como
   binário para provar o Basic auth com a senha gerada. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseMessage} from '../src/i18n.mjs';
import {trackTempDir} from './temp-dir.mjs';

const require = createRequire(import.meta.url);
const {startOpenCodeServer, childEnv, secretsInEnv, redact, createStderrLogger, candidatePaths} = require('../src/agents/opencode-process.cjs');
const {readEntry, writeEntry, processExists, killGroup} = require('../src/agents/opencode-orphans.cjs');
const {placeBinary} = require('../src/agents/opencode-install.cjs');
const TESTS_DIR = path.dirname(fileURLToPath(import.meta.url));
const FAKE_BINARY = path.join(TESTS_DIR, 'fake-opencode.mjs');
const STUBBORN_BINARY = path.join(TESTS_DIR, 'fake-opencode-stubborn.mjs');
const SHIM_TARGET = path.join(TESTS_DIR, 'fake-opencode-shim-target.cjs');

/** Filho falso: guarda args/env e deixa o teste falar pelo stdout/stderr. */
function createFakeSpawn() {
  const calls = [];
  const spawnProcess = (binary, args, options) => {
    const child = Object.assign(new EventEmitter(), {pid: 4242, exitCode: null, signalCode: null, stdout: new PassThrough(), stderr: new PassThrough(), kills: [],
      kill: (signal) => { child.kills.push(signal); return true; }});
    calls.push({binary, args, options, child});
    return child;
  };
  return {calls, spawnProcess};
}

const tempDir = () => trackTempDir(fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-oc-proc-')));
const FAKE_CHILD_INFO = {commandLine: '/x/opencode serve --hostname 127.0.0.1 --port 0', startTime: 'Wed Nov  4 15:00:00 2026'};
const FAKE_OWNER_INFO = {commandLine: 'node tests', startTime: 'Wed Nov  4 14:59:00 2026'};
const fakeProcessInfo = (pid) => pid === 4242 ? FAKE_CHILD_INFO : FAKE_OWNER_INFO;

test('a senha do shell não viaja e o filho recebe a senha gerada', () => {
  const env = childEnv({OPENCODE_SERVER_PASSWORD: 'do-shell', PATH: '/bin'}, 'gerada');
  assert.equal(env.OPENCODE_PASSWORD, 'gerada');
  assert.equal('OPENCODE_SERVER_PASSWORD' in env, false);
  assert.equal(env.PATH, '/bin');
});

test('spawn usa exatamente os argumentos da Mesa e o ledger guarda a identidade', async () => {
  const {calls, spawnProcess} = createFakeSpawn();
  const dir = tempDir();
  const pending = startOpenCodeServer({binary: '/x/opencode', env: {OPENCODE_SERVER_PASSWORD: 'do-shell'}, spawnProcess, ledgerDir: dir, readProcessInfo: fakeProcessInfo});
  const [{args, options, child}] = calls;
  assert.deepEqual(args, ['serve', '--hostname', '127.0.0.1', '--port', '0']);
  assert.equal(options.env.OPENCODE_SERVER_PASSWORD, undefined);
  child.stdout.write('server listening on http://127.0.0.1:51234\n');
  const server = await pending;
  assert.equal(server.baseUrl, 'http://127.0.0.1:51234');
  assert.equal(server.password, options.env.OPENCODE_PASSWORD);
  assert.deepEqual(readEntry(dir), {pid: 4242, pgid: 4242, binary: '/x/opencode',
    commandLine: FAKE_CHILD_INFO.commandLine, startTime: FAKE_CHILD_INFO.startTime,
    ownerPid: process.pid, ownerStartTime: FAKE_OWNER_INFO.startTime, stopping: false});
  assert.equal(fs.readFileSync(path.join(dir, 'opencode-servers.json'), 'utf8').includes(server.password), false);
  child.exitCode = 0;
  server.stop();
  assert.equal(readEntry(dir), null);
});

test('sem ledgerDir nada é gravado', async () => {
  const {calls, spawnProcess} = createFakeSpawn();
  const pending = startOpenCodeServer({binary: '/x/opencode', env: {}, spawnProcess});
  calls[0].child.stdout.write('server listening on http://127.0.0.1:40000\n');
  const server = await pending;
  assert.equal(server.pid, 4242);
});

test('binário vazio rejeita sem abrir processo', async () => {
  const {calls, spawnProcess} = createFakeSpawn();
  await assert.rejects(startOpenCodeServer({binary: '', spawnProcess}), (error) => parseMessage(error.message)?.key === 'err.opencode.notFound');
  assert.equal(calls.length, 0);
});

test('stderr com a senha ou a chave vai ao log mascarado', async () => {
  const {calls, spawnProcess} = createFakeSpawn();
  const lines = [];
  const pending = startOpenCodeServer({binary: '/x/opencode', env: {OPENCODE_API_KEY: 'chave-falsa-123'}, spawnProcess, log: (area, line) => lines.push(line)});
  const {child, options} = calls[0];
  child.stderr.write(`erro com ${options.env.OPENCODE_PASSWORD} e chave-falsa-123\n`);
  child.stdout.write('server listening on http://127.0.0.1:40001\n');
  await pending;
  assert.equal(lines.length, 1);
  assert.equal(lines[0], 'erro com *** e ***');
});

test('stderr com o segredo partido entre dois eventos data sai mascarado', async () => {
  const {calls, spawnProcess} = createFakeSpawn();
  const lines = [];
  const pending = startOpenCodeServer({binary: '/x/opencode', env: {OPENAI_API_KEY: 'sk-1234567890abcdef'}, spawnProcess,
    log: (area, line) => lines.push(line)});
  const {child} = calls[0];
  child.stderr.write('erro: chave sk-12345');
  child.stderr.write('67890abcdef recusada');
  child.stderr.write('\n');
  child.stdout.write('server listening on http://127.0.0.1:40003\n');
  await pending;
  assert.deepEqual(lines, ['erro: chave *** recusada'], 'a máscara vale para a linha inteira, não para o chunk');
});

test('stderr sem quebra de linha é descarregado no fim, mascarado', async () => {
  const {calls, spawnProcess} = createFakeSpawn();
  const lines = [];
  const pending = startOpenCodeServer({binary: '/x/opencode', env: {OPENAI_API_KEY: 'sk-1234567890abcdef'}, spawnProcess,
    log: (area, line) => lines.push(line)});
  const {child} = calls[0];
  child.stderr.write('resto sem newline sk-1234567890abcdef');
  child.exitCode = 1;
  child.emit('exit', 1);
  await assert.rejects(pending, (error) => parseMessage(error.message)?.key === 'err.opencode.startExit');
  assert.deepEqual(lines, ['resto sem newline ***'], 'o buffer é descarregado no exit');
});

test('o buffer do stderr tem teto e mascara segredo que cruza o corte', () => {
  const lines = [];
  const logger = createStderrLogger({log: (area, line) => lines.push(line), secrets: ['sk-1234567890abcdef'], maxLineLength: 20});
  logger.push(`${'x'.repeat(20)}sk-12`);
  logger.push('34567890abcdef fim\n');
  logger.flush();
  const out = lines.join('\n');
  assert.equal(out.includes('sk-'), false, 'nem o pedaço antes do teto vaza');
  assert.match(out, /\*\*\*/);
});

test('filho que sai antes de anunciar a porta rejeita e limpa o ledger', async () => {
  const {calls, spawnProcess} = createFakeSpawn();
  const dir = tempDir();
  const pending = startOpenCodeServer({binary: '/x/opencode', env: {}, spawnProcess, ledgerDir: dir, readProcessInfo: fakeProcessInfo});
  calls[0].child.exitCode = 3;
  calls[0].child.emit('exit', 3);
  await assert.rejects(pending, (error) => parseMessage(error.message)?.key === 'err.opencode.startExit' && parseMessage(error.message).args.code === '3');
  assert.equal(readEntry(dir), null);
});

test('abortar a subida mata o filho e limpa o ledger', async () => {
  const {calls, spawnProcess} = createFakeSpawn();
  const dir = tempDir();
  const controller = new AbortController();
  const signals = [];
  const kill = (target) => {
    signals.push(target.signal);
    calls[0].child.exitCode = 0;
    calls[0].child.emit('exit', 0);
  };
  const pending = startOpenCodeServer({binary: '/x/opencode', env: {}, spawnProcess, ledgerDir: dir, signal: controller.signal, kill});
  assert.ok(readEntry(dir), 'o processo entrou no ledger antes de anunciar a porta');
  controller.abort();
  await assert.rejects(pending, (error) => parseMessage(error.message)?.key === 'tutor.error.cancelled');
  assert.deepEqual(signals, ['SIGTERM'], 'o filho pendente recebeu SIGTERM');
  assert.equal(readEntry(dir), null, 'o ledger não fica com um servidor que não subiu');
});

test('stop teimoso: marca encerrando, escala para SIGKILL e só apaga o ledger depois do exit', async () => {
  const {calls, spawnProcess} = createFakeSpawn();
  const dir = tempDir();
  let alive = true;
  const signals = [];
  const readInfo = (pid) => pid === 4242 ? (alive ? FAKE_CHILD_INFO : null) : FAKE_OWNER_INFO;
  const kill = (target) => { signals.push(target.signal); if (target.signal === 'SIGKILL') alive = false; };
  const pending = startOpenCodeServer({binary: '/x/opencode', env: {}, spawnProcess, ledgerDir: dir,
    readProcessInfo: readInfo, kill, graceMs: 10, afterKillMs: 10});
  calls[0].child.stdout.write('server listening on http://127.0.0.1:51235\n');
  const server = await pending;
  assert.equal(readEntry(dir).stopping, false);
  const stopped = server.stop();
  assert.deepEqual(signals, ['SIGTERM'], 'o SIGTERM sai antes de a carência terminar');
  assert.equal(readEntry(dir)?.stopping, true, 'o ledger fica marcado "encerrando", não é apagado');
  await stopped;
  assert.deepEqual(signals, ['SIGTERM', 'SIGKILL'], 'depois da carência o grupo leva SIGKILL');
  assert.equal(readEntry(dir)?.stopping, true, 'sem exit nem leitura do ps, o ledger fica para a próxima abertura');
});

test('ps estoura no spawn: a hora de início é tentada de novo antes de gravar', async () => {
  const {calls, spawnProcess} = createFakeSpawn();
  const dir = tempDir();
  const reads = new Map();
  const readInfo = (pid) => {
    const count = (reads.get(pid) || 0) + 1;
    reads.set(pid, count);
    if (pid === 4242 && count === 1) return null;
    return pid === 4242 ? FAKE_CHILD_INFO : FAKE_OWNER_INFO;
  };
  const pending = startOpenCodeServer({binary: '/x/opencode', env: {}, spawnProcess, ledgerDir: dir, readProcessInfo: readInfo});
  calls[0].child.stdout.write('server listening on http://127.0.0.1:51240\n');
  await pending;
  const entry = readEntry(dir);
  assert.equal(entry.startTime, FAKE_CHILD_INFO.startTime, 'a segunda leitura preencheu a prova');
  assert.equal(entry.commandLine, FAKE_CHILD_INFO.commandLine);
});

test('ps estoura no stop: o handle vivo recebe o sinal e o ledger fica encerrando', async () => {
  const {calls, spawnProcess} = createFakeSpawn();
  const dir = tempDir();
  let psUp = true;
  const signals = [];
  const readInfo = (pid) => {
    if (!psUp) return null;
    return pid === 4242 ? FAKE_CHILD_INFO : FAKE_OWNER_INFO;
  };
  const pending = startOpenCodeServer({binary: '/x/opencode', env: {}, spawnProcess, ledgerDir: dir, readProcessInfo: readInfo,
    kill: (target) => signals.push(target.signal), graceMs: 5, afterKillMs: 5});
  calls[0].child.stdout.write('server listening on http://127.0.0.1:51241\n');
  const server = await pending;
  psUp = false;
  await server.stop();
  assert.deepEqual(signals, [], 'sem prova, o grupo do pid não é sinalizado');
  assert.deepEqual(calls[0].child.kills, ['SIGTERM', 'SIGKILL'], 'o ChildProcess vivo recebe os sinais pelo handle');
  assert.equal(readEntry(dir)?.stopping, true, 'sem prova de saída, o registro fica para a próxima abertura');
});

test('stop de uma Mesa não apaga o registro de outra no mesmo runtime', async () => {
  const {calls, spawnProcess} = createFakeSpawn();
  const dir = tempDir();
  const signals = [];
  const kill = (target) => {
    signals.push(target.signal);
    calls[0].child.exitCode = 0;
    calls[0].child.emit('exit', 0);
  };
  const pending = startOpenCodeServer({binary: '/x/opencode', env: {}, spawnProcess, ledgerDir: dir,
    readProcessInfo: fakeProcessInfo, kill});
  calls[0].child.stdout.write('server listening on http://127.0.0.1:51338\n');
  const server = await pending;
  const outra = {pid: 5151, pgid: 5151, binary: '/x/opencode', commandLine: FAKE_CHILD_INFO.commandLine,
    startTime: 'Thu Nov  5 09:00:00 2026', ownerPid: 7001, ownerStartTime: 'Thu Nov  5 08:59:00 2026', stopping: false};
  writeEntry(dir, outra);
  await server.stop();
  assert.deepEqual(signals, ['SIGTERM'], 'o serve da própria Mesa ainda é encerrado');
  assert.deepEqual(readEntry(dir), outra, 'o registro da outra Mesa fica intacto, não vira órfão sem anotação');
});

test('SIGKILL sem confirmação da morte: o stop respeita o teto e deixa o ledger encerrando', async () => {
  const {calls, spawnProcess} = createFakeSpawn();
  const dir = tempDir();
  const signals = [];
  const pending = startOpenCodeServer({binary: '/x/opencode', env: {}, spawnProcess, ledgerDir: dir,
    readProcessInfo: () => FAKE_CHILD_INFO, kill: (target) => { signals.push(target.signal); }, graceMs: 5, afterKillMs: 5});
  calls[0].child.stdout.write('server listening on http://127.0.0.1:51236\n');
  const server = await pending;
  await server.stop();
  assert.deepEqual(signals, ['SIGTERM', 'SIGKILL']);
  assert.equal(readEntry(dir)?.stopping, true, 'sem provar a saída, o registro fica para a próxima abertura');
});

test('PID reciclado na carência: não manda SIGKILL a processo alheio', async () => {
  const {calls, spawnProcess} = createFakeSpawn();
  const dir = tempDir();
  const signals = [];
  const mine = {...FAKE_CHILD_INFO};
  const other = {commandLine: '/usr/bin/python3 outro.py', startTime: 'Thu Nov  5 09:00:00 2026'};
  const kill = (target) => {
    signals.push(target.signal);
    if (target.signal === 'SIGTERM') Object.assign(mine, other);
  };
  const pending = startOpenCodeServer({binary: '/x/opencode', env: {}, spawnProcess, ledgerDir: dir,
    readProcessInfo: () => mine, kill, graceMs: 5, afterKillMs: 5});
  calls[0].child.stdout.write('server listening on http://127.0.0.1:51237\n');
  const server = await pending;
  await server.stop();
  assert.deepEqual(signals, ['SIGTERM'], 'o SIGKILL não vai para um pid reciclado');
  assert.equal(readEntry(dir), null, 'sem o processo anotado, o registro é descartado');
});

test('redact mascara segredo a partir de 6 e poupa booleano, número curto e palavra comum', () => {
  assert.equal(redact('chave=abc123', ['abc123']), 'chave=***', 'segredo curto não vaza em claro');
  assert.equal(redact('id=abc12 ok', ['abc12']), 'id=abc12 ok', 'piso de 6: valor de 5 não picaria o texto do log');
  assert.equal(redact('a=1 b=2', ['1', '2']), 'a=1 b=2');
  assert.equal(redact('segundo false default', ['seg', 'false', 'default']), 'segundo false default',
    'palavra comum, booleano e valor abaixo do piso ficam');
  assert.deepEqual(secretsInEnv({MONKEY: 'x', OPENAI_API_KEY: 'abc123', GITHUB_TOKEN: 'ab'}), ['abc123'], 'só nome de segredo inteiro e valor a partir de 6');
  assert.deepEqual(secretsInEnv({OPENAI_API_KEY: 'curta1', GITHUB_TOKEN: 'segredo-longo'}), ['segredo-longo', 'curta1'], 'do mais longo ao mais curto');
  assert.equal(candidatePaths({envPath: '~/bin/oc', home: '/h', platform: 'darwin'})[0], path.resolve('/h', 'bin', 'oc'));
});

test('F11: segredo multilinha (PEM) não é reconstruído linha a linha no log', () => {
  const body = 'MIIEowIBAAKCAQEA7vXk9sQ2mB1cD4eF6gH8jK0lN3pR5tV7xZ9aB2dE4fG6hJ8kL0mN2oP4qR6sT8uV0wX2yZ4aB6cD8eF0gH2iJ4kL6mN8oP0qR2sT4uV6wX8yZ0aB2cD4eF6gH8iJ0kL2mN4oP6qR8sT0uV2wX4yZ6';
  const secret = `-----BEGIN PRIVATE KEY-----\n${body}\n-----END PRIVATE KEY-----`;
  const lines = [];
  const logger = createStderrLogger({log: (area, line) => lines.push(line), secrets: [secret]});
  logger.push(`cabeçalho ${secret} rodapé\n`);
  logger.flush(true);
  const logged = lines.join('\n');
  for (const part of secret.split('\n')) assert.equal(logged.includes(part), false, `parte do PEM vazou: ${part}`);
  assert.match(logged, /\*\*\*/, 'o segredo foi mascarado');
});

test('flag booleana do ambiente não vira máscara no log', () => {
  const secrets = secretsInEnv({PASSWORD_STORE_ENABLE_EXTENSIONS: 'false', OPENAI_API_KEY: 'seg', GITHUB_TOKEN: '12345'});
  assert.deepEqual(secrets, [], 'false, seg e 12345 não são credenciais');
  assert.equal(redact('segundo false 12345', secrets), 'segundo false 12345');
});

test('stderr mascara todo segredo do ambiente do filho, inclusive curto', async () => {
  const {calls, spawnProcess} = createFakeSpawn();
  const lines = [];
  const pending = startOpenCodeServer({binary: '/x/opencode', spawnProcess, log: (area, line) => lines.push(line),
    env: {OPENAI_API_KEY: 'seg123', AWS_SECRET_ACCESS_KEY: 'segredo-aws', GITHUB_TOKEN: 'ab'}});
  const {child, options} = calls[0];
  child.stderr.write(`erro seg123 segredo-aws ab ${options.env.OPENCODE_PASSWORD}\n`);
  child.stdout.write('server listening on http://127.0.0.1:40002\n');
  await pending;
  assert.equal(lines.length, 1);
  assert.equal(lines[0], 'erro *** *** ab ***');
});

test('ponta a ponta: o shim opencode2 do instalador não impede o stop', {skip: process.platform === 'win32', timeout: 20000}, async () => {
  const home = tempDir();
  const dir = tempDir();
  try {
    /* Conteúdo real do instalador: `opencode` + o shim `opencode2` que faz exec. */
    await placeBinary({binary: SHIM_TARGET, home, platform: process.platform});
    const shim = path.join(home, '.opencode', 'bin', 'opencode2');
    const server = await startOpenCodeServer({binary: shim, cwd: tempDir(), env: {...process.env}, ledgerDir: dir, timeoutMs: 15000});
    const pid = server.pid;
    try {
      const entry = readEntry(dir);
      assert.ok(entry, 'o serve do shim entrou no ledger');
      /* O `ps` do spawn lê a linha antes ou depois do `exec` do shim (mesmo
         pid): no Linux o exec quase sempre já passou; no macOS (rodada 4 do
         Mac) ainda não. As duas leituras são válidas — a recolha aceita a
         transição (`isShimTargetServe`, opencode-orphans.cjs) —, e o que este
         teste prova é o stop atravessar o shim. */
      assert.ok(['opencode', 'opencode2'].includes(path.basename(entry.binary)), `o ledger guarda o shim ou o alvo, veio ${entry.binary}`);
      assert.equal(processExists(pid), true);
      await server.stop();
      const deadline = Date.now() + 5000;
      while (processExists(pid) && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 25));
      assert.equal(processExists(pid), false, 'o serve do shim foi encerrado pelo stop');
      assert.equal(readEntry(dir), null, 'o ledger só some depois da saída');
    } finally {
      if (processExists(pid)) {
        try { killGroup({pid, pgid: pid, signal: 'SIGKILL'}); } catch { /* já saiu */ }
      }
    }
  } finally {
    fs.rmSync(home, {recursive: true, force: true});
    fs.rmSync(dir, {recursive: true, force: true});
  }
});

test('ponta a ponta com o fake-opencode: 401 sem senha, 200 com a senha gerada', {skip: process.platform === 'win32'}, async () => {
  const log = path.join(tempDir(), 'fake.jsonl');
  const server = await startOpenCodeServer({binary: FAKE_BINARY, env: {...process.env, FAKE_OPENCODE_LOG: log, OPENCODE_SERVER_PASSWORD: 'do-shell'}, timeoutMs: 15000});
  const exited = new Promise((resolve) => server.onExit(resolve));
  try {
    const open = await fetch(`${server.baseUrl}/api/model`);
    assert.equal(open.status, 401);
    const auth = `Basic ${Buffer.from(`opencode:${server.password}`).toString('base64')}`;
    const ok = await fetch(`${server.baseUrl}/api/model`, {headers: {authorization: auth}});
    assert.equal(ok.status, 200);
    const first = JSON.parse(fs.readFileSync(log, 'utf8').split('\n')[0]);
    assert.deepEqual(first.argv, ['serve', '--hostname', '127.0.0.1', '--port', '0']);
    assert.equal(first.serverPasswordInherited, false);
  } finally {
    server.stop();
  }
  await exited;
});

test('ponta a ponta: serve que ignora SIGTERM morre no SIGKILL e o ledger some só depois', {skip: process.platform === 'win32', timeout: 20000}, async () => {
  fs.chmodSync(STUBBORN_BINARY, 0o755);
  const dir = tempDir();
  let pid;
  try {
    const server = await startOpenCodeServer({binary: STUBBORN_BINARY, cwd: tempDir(), env: {...process.env}, ledgerDir: dir,
      graceMs: 200, afterKillMs: 1000, timeoutMs: 15000});
    pid = server.pid;
    assert.ok(readEntry(dir), 'o serve teimoso entrou no ledger');
    assert.equal(processExists(pid), true);
    const stopped = server.stop();
    assert.equal(readEntry(dir)?.stopping, true, 'o ledger fica "encerrando" enquanto o serve resiste');
    assert.equal(processExists(pid), true, 'o SIGTERM sozinho não o derruba');
    await stopped;
    const deadline = Date.now() + 5000;
    while (processExists(pid) && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 25));
    assert.equal(processExists(pid), false, 'o SIGKILL do grupo encerrou o serve');
    assert.equal(readEntry(dir), null, 'o ledger só foi apagado depois do exit');
  } finally {
    const entry = readEntry(dir);
    if (entry && processExists(entry.pid)) {
      try { killGroup({pid: entry.pid, pgid: entry.pid, signal: 'SIGKILL'}); } catch { /* já saiu */ }
    }
    fs.rmSync(dir, {recursive: true, force: true});
  }
});

test('spawn que falha sem pid rejeita e não sinaliza grupo nenhum', {skip: process.platform === 'win32'}, async (t) => {
  const kill = t.mock.method(process, 'kill', () => true);
  const child = Object.assign(new EventEmitter(), {pid: undefined, exitCode: null, signalCode: null, stdout: new PassThrough(), stderr: new PassThrough(), kill: () => true});
  const pending = startOpenCodeServer({binary: '/x/nao-executavel', env: {}, spawnProcess: () => child});
  child.emit('error', Object.assign(Error('spawn EACCES'), {code: 'EACCES'}));
  await assert.rejects(pending);
  assert.equal(kill.mock.calls.filter((call) => Number(call.arguments[0]) <= 0).length, 0);
});

test('F18: linha curta ou só espaço do segredo multilinha não vira alvo global', () => {
  /* O piso de 6 valia só para o valor inteiro; a linha `x` (1 char) e a linha
     ` ` (um espaço) viravam alvo do split/join e destruíam o texto do log. */
  assert.equal(redact('texto normal com x e mais x aqui', ['headervalue\nx\nfootervalue']),
    'texto normal com x e mais x aqui', 'linha de 1 caractere não pode picar o log');
  assert.equal(redact('um dois tres quatro', ['headervalue\n \nfootervalue']),
    'um dois tres quatro', 'linha só de espaço não pode mascarar todo espaço');
  const lines = [];
  const logger = createStderrLogger({log: (area, line) => lines.push(line), secrets: ['headervalue\nx\nfootervalue']});
  logger.push('texto normal com x e mais x aqui\n');
  logger.flush(true);
  assert.deepEqual(lines, ['texto normal com x e mais x aqui']);
});
