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

const require = createRequire(import.meta.url);
const {startOpenCodeServer, childEnv, redact, candidatePaths} = require('../src/agents/opencode-process.cjs');
const {readEntry} = require('../src/agents/opencode-orphans.cjs');
const FAKE_BINARY = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fake-opencode.mjs');

/** Filho falso: guarda args/env e deixa o teste falar pelo stdout/stderr. */
function createFakeSpawn() {
  const calls = [];
  const spawnProcess = (binary, args, options) => {
    const child = Object.assign(new EventEmitter(), {pid: 4242, exitCode: null, signalCode: null, stdout: new PassThrough(), stderr: new PassThrough(), kill: () => true});
    calls.push({binary, args, options, child});
    return child;
  };
  return {calls, spawnProcess};
}

const tempDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-oc-proc-'));

test('a senha do shell não viaja e o filho recebe a senha gerada', () => {
  const env = childEnv({OPENCODE_SERVER_PASSWORD: 'do-shell', PATH: '/bin'}, 'gerada');
  assert.equal(env.OPENCODE_PASSWORD, 'gerada');
  assert.equal('OPENCODE_SERVER_PASSWORD' in env, false);
  assert.equal(env.PATH, '/bin');
});

test('spawn usa exatamente os argumentos da Mesa e o ledger guarda só pid/pgid', async () => {
  const {calls, spawnProcess} = createFakeSpawn();
  const dir = tempDir();
  const pending = startOpenCodeServer({binary: '/x/opencode', env: {OPENCODE_SERVER_PASSWORD: 'do-shell'}, spawnProcess, ledgerDir: dir});
  const [{args, options, child}] = calls;
  assert.deepEqual(args, ['serve', '--hostname', '127.0.0.1', '--port', '0']);
  assert.equal(options.env.OPENCODE_SERVER_PASSWORD, undefined);
  child.stdout.write('server listening on http://127.0.0.1:51234\n');
  const server = await pending;
  assert.equal(server.baseUrl, 'http://127.0.0.1:51234');
  assert.equal(server.password, options.env.OPENCODE_PASSWORD);
  assert.deepEqual(readEntry(dir), {pid: 4242, pgid: 4242, binary: '/x/opencode'});
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

test('filho que sai antes de anunciar a porta rejeita e limpa o ledger', async () => {
  const {calls, spawnProcess} = createFakeSpawn();
  const dir = tempDir();
  const pending = startOpenCodeServer({binary: '/x/opencode', env: {}, spawnProcess, ledgerDir: dir});
  calls[0].child.exitCode = 3;
  calls[0].child.emit('exit', 3);
  await assert.rejects(pending, (error) => parseMessage(error.message)?.key === 'err.opencode.startExit' && parseMessage(error.message).args.code === '3');
  assert.equal(readEntry(dir), null);
});

test('redact ignora segredo curto demais e candidatePaths começa pelo caminho do ambiente', () => {
  assert.equal(redact('abc abc', ['abc']), 'abc abc');
  assert.equal(candidatePaths({envPath: '~/bin/oc', home: '/h', platform: 'darwin'})[0], '/h/bin/oc');
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
