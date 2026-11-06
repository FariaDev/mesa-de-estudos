/* Dono do `opencode serve` (#57): um servidor por app, trocado quando a chave
   muda ou quando ele cai sozinho. `fakeStart` e `fakeSweep` são nomeados:
   nenhum processo real sobe e nenhuma chave aparece no log. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {trackTempDir} from './temp-dir.mjs';

const require = createRequire(import.meta.url);
const {createServeOwner} = require('../src/agents/opencode-serve-owner.cjs');
const {message} = require('../src/i18n.mjs');

const CWD = '/tmp/mesa-cwd';
const LEDGER = '/tmp/mesa-ledger';
const EMPTY_SWEEP = {killed: [], skipped: [], entry: null};
const CANCELLED_TEXT = message('tutor.error.cancelled');

/* Dono com a subida segurada por uma comporta: o teste decide quando o
   `start` resolve, para encenar o cancelar no meio da subida. */
function createGatedOwner() {
  const state = {startCalls: [], releases: [], servers: []};
  const owner = createServeOwner({
    findBinary: () => '/fake/opencode',
    keyEnv: () => ({OPENCODE_API_KEY: 'chave-falsa'}),
    baseEnv: () => ({}),
    cwd: CWD,
    ledgerDir: LEDGER,
    start: async (options) => {
      state.startCalls.push(options);
      /* Como o `start` real: abortar a subida rejeita, em vez de pendurar. */
      await new Promise((resolve, reject) => {
        state.releases.push(resolve);
        options.signal?.addEventListener('abort', () => reject(Error('subida abortada')));
      });
      const index = state.servers.length + 1;
      const server = {baseUrl: `http://127.0.0.1:${4100 + index}`, password: `senha-${index}`,
        binary: options.binary, pid: 9000 + index, stops: 0,
        stop() { server.stops += 1; }, onExit() {}};
      state.servers.push(server);
      return server;
    },
  });
  return {owner, state};
}

function createOwnerHarness({key = 'chave-falsa-1', binary = '/fake/opencode', cwd = CWD} = {}) {
  const state = {
    key,
    binary,
    startCalls: [],
    keyEnvCalls: 0,
    servers: [],
    sweepCalls: [],
    sweepResult: EMPTY_SWEEP,
    sweepError: null,
    logs: [],
  };

  /* Conta partidas, guarda o env recebido e expõe `fireExit` para o teste. */
  async function fakeStart(options) {
    state.startCalls.push({...options, env: {...options.env}});
    const index = state.servers.length + 1;
    const server = {
      baseUrl: `http://127.0.0.1:${4100 + index}`,
      password: `senha-falsa-${index}`,
      binary: options.binary,
      pid: 9000 + index,
      stops: 0,
      stop() { server.stops += 1; },
      onExit(listener) { server.fireExit = listener; },
      fireExit() {},
    };
    state.servers.push(server);
    return server;
  }

  function fakeSweep(options) {
    state.sweepCalls.push(options);
    if (state.sweepError) throw state.sweepError;
    return state.sweepResult;
  }

  const owner = createServeOwner({
    findBinary: () => state.binary,
    keyEnv: () => { state.keyEnvCalls += 1; return {OPENCODE_API_KEY: state.key}; },
    baseEnv: () => ({MESA_TESTE: 'sim'}),
    cwd,
    ledgerDir: LEDGER,
    log: (area, line) => state.logs.push(`${area}: ${line}`),
    start: fakeStart,
    sweep: fakeSweep,
  });

  return {owner, state};
}

test('a pasta de trabalho existe antes de o servidor subir (#105)', async () => {
  const parent = trackTempDir(fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-owner-')));
  const cwd = path.join(parent, 'opencode-workspaces');
  try {
    const {owner} = createOwnerHarness({cwd});
    await owner.acquireAuth();
    assert.equal(fs.statSync(cwd).isDirectory(), true);
  } finally {
    fs.rmSync(parent, {recursive: true, force: true});
  }
});

test('acquire sobe uma vez e reaproveita o servidor', async () => {
  const {owner, state} = createOwnerHarness();
  const first = await owner.acquire();
  const second = await owner.acquire();
  assert.equal(state.startCalls.length, 1);
  assert.deepEqual(second, first);
  assert.equal(state.servers[0].stops, 0);
});

test('dois acquire simultâneos sobem um só servidor', async () => {
  const {owner, state} = createOwnerHarness();
  const [first, second] = await Promise.all([owner.acquire(), owner.acquire()]);
  assert.equal(state.startCalls.length, 1);
  assert.deepEqual(second, first);
});

test('trocar a chave encerra o antigo e sobe outro', async () => {
  const {owner, state} = createOwnerHarness({key: 'chave-falsa-1'});
  const first = await owner.acquire();
  state.key = 'chave-falsa-2';
  const second = await owner.acquire();
  assert.equal(state.startCalls.length, 2);
  assert.equal(state.servers[0].stops, 1);
  assert.notEqual(second.baseUrl, first.baseUrl);
  assert.equal(state.startCalls[1].env.OPENCODE_API_KEY, 'chave-falsa-2');
});

test('trocar a chave espera o servidor antigo terminar antes de subir outro (#105)', async () => {
  let key = 'chave-1';
  const events = [];
  const owner = createServeOwner({
    findBinary: () => '/fake/opencode',
    keyEnv: () => ({OPENCODE_API_KEY: key}),
    baseEnv: () => ({}),
    cwd: CWD,
    ledgerDir: LEDGER,
    start: async (options) => {
      events.push(`start:${options.env.OPENCODE_API_KEY}`);
      const index = events.length;
      return {
        baseUrl: `http://127.0.0.1:${4300 + index}`, password: 'p', binary: options.binary, pid: 9300 + index,
        stop: async () => { await new Promise((resolve) => setTimeout(resolve, 20)); events.push('stop'); },
        onExit() {},
      };
    },
    sweep: () => EMPTY_SWEEP,
  });
  await owner.acquire();
  key = 'chave-2';
  await owner.acquire();
  assert.deepEqual(events, ['start:chave-1', 'stop', 'start:chave-2']);
  await owner.stop();
});

test('owner.stop espera o stop do servidor antes de resolver (#105)', async () => {
  let released = false;
  const owner = createServeOwner({
    findBinary: () => '/fake/opencode',
    keyEnv: () => ({}),
    baseEnv: () => ({}),
    cwd: CWD,
    ledgerDir: LEDGER,
    start: async (options) => ({
      baseUrl: 'http://127.0.0.1:4400', password: 'p', binary: options.binary, pid: 9400,
      stop: async () => { await new Promise((resolve) => setTimeout(resolve, 20)); released = true; },
      onExit() {},
    }),
    sweep: () => EMPTY_SWEEP,
  });
  await owner.acquire();
  const stopping = owner.stop();
  assert.equal(released, false, 'não resolveu antes do exit do serve');
  await stopping;
  assert.equal(released, true);
});

test('acquireAuth não lê o cofre e sobe sem OPENCODE_API_KEY', async () => {
  const {owner, state} = createOwnerHarness();
  await owner.acquireAuth();
  assert.equal(state.keyEnvCalls, 0, 'abrir Configurações não pode pedir o cofre');
  assert.equal(state.startCalls.length, 1);
  assert.equal(state.startCalls[0].env.OPENCODE_API_KEY, undefined);
  assert.equal(state.startCalls[0].env.MESA_TESTE, 'sim');
});

test('acquireAuth reaproveita o servidor com chave sem chamar o cofre de novo', async () => {
  const {owner, state} = createOwnerHarness();
  const keyed = await owner.acquire();
  assert.equal(state.keyEnvCalls, 1);
  const auth = await owner.acquireAuth();
  assert.deepEqual(auth, keyed);
  assert.equal(state.keyEnvCalls, 1);
  assert.equal(state.startCalls.length, 1);
});

test('dois acquireAuth simultâneos sobem um só servidor', async () => {
  const {owner, state} = createOwnerHarness();
  const [first, second] = await Promise.all([owner.acquireAuth(), owner.acquireAuth()]);
  assert.deepEqual(second, first);
  assert.equal(state.startCalls.length, 1);
  assert.equal(state.keyEnvCalls, 0);
});

test('acquire e acquireAuth juntos não deixam servidor órfão', async () => {
  for (const order of [['acquire', 'acquireAuth'], ['acquireAuth', 'acquire']]) {
    const {owner, state} = createOwnerHarness();
    await Promise.all(order.map((name) => owner[name]()));
    const alive = state.servers.filter((server) => server.stops === 0);
    assert.equal(alive.length, 1, `${order.join(' + ')}: ${state.servers.length} subidos, ${alive.length} vivos`);
  }
});

test('o start recebe o OPENCODE_API_KEY que veio do keyEnv', async () => {
  const {owner, state} = createOwnerHarness({key: 'chave-falsa-1'});
  await owner.acquire();
  assert.equal(state.startCalls[0].env.OPENCODE_API_KEY, 'chave-falsa-1');
  assert.equal(state.startCalls[0].env.MESA_TESTE, 'sim');
});

test('servidor que sai sozinho é trocado no próximo acquire', async () => {
  const {owner, state} = createOwnerHarness();
  await owner.acquire();
  assert.equal(owner.running(), true);
  state.servers[0].fireExit(3);
  assert.equal(owner.running(), false);
  await owner.acquire();
  assert.equal(state.startCalls.length, 2);
  assert.equal(state.servers[0].stops, 0, 'quem já saiu não recebe stop');
  assert.ok(state.logs.some((line) => line.includes('saiu sozinho')));
});

test('sem binário o acquire rejeita e não sobe servidor', async () => {
  const {owner, state} = createOwnerHarness({binary: ''});
  await assert.rejects(owner.acquire(), Error);
  assert.equal(state.startCalls.length, 0);
});

test('falha ao subir o servidor prova que nada foi enviado (notSent)', async () => {
  const {owner, state} = createOwnerHarness();
  const original = state.startCalls;
  const failing = createServeOwner({
    findBinary: () => '/fake/opencode',
    keyEnv: () => ({}),
    baseEnv: () => ({}),
    cwd: CWD,
    ledgerDir: LEDGER,
    start: async () => { throw Error('O OpenCode não abriu (EACCES).'); },
  });
  await assert.rejects(failing.acquire(), (error) => error.notSent === true);
  const missing = createServeOwner({
    findBinary: () => '',
    keyEnv: () => ({}),
    baseEnv: () => ({}),
    cwd: CWD,
    ledgerDir: LEDGER,
  });
  await assert.rejects(missing.acquire(), (error) => error.notSent === true);
  assert.equal(original.length, 0);
  await owner.stop();
});

test('sweepAtBoot loga recolhido e não recolhido e não lança quando a recolha falha', () => {
  const {owner, state} = createOwnerHarness();
  state.sweepResult = {
    killed: [{pid: 11, pgid: 11}],
    skipped: [{pid: 12, reason: 'processo não existe mais'}],
    entry: {pid: 11, pgid: 11, binary: '/fake/opencode'},
  };
  const result = owner.sweepAtBoot();
  assert.deepEqual(result, state.sweepResult);
  assert.deepEqual(state.sweepCalls[0], {dir: LEDGER});
  assert.ok(state.logs.some((line) => line.includes('recolhido')));
  assert.ok(state.logs.some((line) => line.includes('não recolhido')));

  state.sweepError = Error('falha falsa');
  let fallback;
  assert.doesNotThrow(() => { fallback = owner.sweepAtBoot(); });
  assert.deepEqual(fallback, EMPTY_SWEEP);
  assert.ok(state.logs.some((line) => line.includes('recolha de órfãos falhou')));
});

test('nenhuma linha de log contém a chave', async () => {
  const {owner, state} = createOwnerHarness({key: 'chave-falsa-1'});
  await owner.acquire();
  state.key = 'chave-falsa-2';
  await owner.acquire();
  state.servers[1].fireExit(0);
  await owner.acquire();
  state.sweepResult = {
    killed: [{pid: 21, pgid: 21}],
    skipped: [{pid: 22, reason: 'registro velho'}],
    entry: null,
  };
  owner.sweepAtBoot();
  owner.stop();

  assert.ok(state.logs.length > 0, 'houve log para conferir');
  for (const line of state.logs) {
    assert.ok(!line.includes('chave-falsa-1'), line);
    assert.ok(!line.includes('chave-falsa-2'), line);
  }
});

test('cancelar uma subida dividida só derruba quem cancelou, qualquer que seja a ordem (#57)', async () => {
  const {owner, state} = createGatedOwner();
  const main = {}, side = {};
  /* A principal chegou primeiro e é ela quem desiste: a lateral fica. */
  const mainOutcome = owner.acquire(main).then((lease) => ({lease}), (error) => ({error}));
  const sideLease = owner.acquire(side);
  owner.cancelStarting(main);
  const cancelled = await mainOutcome;
  assert.equal(cancelled.error?.message, CANCELLED_TEXT);
  assert.equal(cancelled.error?.notSent, true);
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(state.startCalls.length, 1);
  state.releases.shift()?.();
  assert.match((await sideLease).baseUrl, /^http:\/\/127\.0\.0\.1:/);
  assert.equal(state.startCalls.length, 1, 'quem ficou recebe o servidor, sem subir outro');
  await owner.stop();
});

test('conversa que não espera a subida não derruba a espera da outra ao fechar (#57)', async () => {
  const {owner, state} = createGatedOwner();
  const waiting = owner.acquire({});
  /* O `stop` de um adaptador já ligado também passa pelo cancelamento. */
  owner.cancelStarting({});
  await new Promise((resolve) => setTimeout(resolve, 20));
  state.releases.shift()?.();
  assert.match((await waiting).baseUrl, /^http:\/\/127\.0\.0\.1:/);
  await owner.stop();
});

test('cancelar durante a espera da entrada não dispara subida nova (#57)', async () => {
  const {owner, state} = createGatedOwner();
  const auth = owner.acquireAuth();
  const waiting = owner.acquire();
  const outcome = waiting.then((lease) => ({lease}), (error) => ({error}));
  /* Nessa fase o `startController` ainda é nulo: o cancelar antigo não fazia
     nada e a subida acontecia mesmo assim. */
  owner.cancelStarting();
  const cancelled = await outcome;
  assert.equal(cancelled.error?.message, CANCELLED_TEXT);
  assert.equal(cancelled.error?.notSent, true);
  /* A entrada termina sozinha; sem ninguém esperando, nada de subida com chave. */
  state.releases.shift()?.();
  await auth;
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(state.startCalls.length, 1, 'só a entrada subiu');
  await owner.stop();
});

/* Subida que ignora o abort (o sinal chegou depois do spawn ou o `start` não
   honra o sinal): nem `stop()` nem `cancelStarting()` impedem o `start` de
   resolver tarde. Sem guarda de época, o `launch` publicava o servidor e ele
   ficava vivo sem dono — processo órfão com porta/lock presos. */
function createDeafStartOwner() {
  const state = {started: false, releases: [], servers: []};
  const owner = createServeOwner({
    findBinary: () => '/fake/opencode',
    keyEnv: () => ({OPENCODE_API_KEY: 'chave-falsa'}),
    baseEnv: () => ({}),
    cwd: CWD,
    ledgerDir: LEDGER,
    sweep: () => EMPTY_SWEEP,
    start: async (options) => {
      state.started = true;
      await new Promise((resolve) => { state.releases.push(resolve); });
      const server = {baseUrl: 'http://127.0.0.1:4500', password: 'senha-tardia',
        binary: options.binary, pid: 9500, stops: 0,
        stop() { server.stops += 1; }, onExit() {}};
      state.servers.push(server);
      return server;
    },
  });
  return {owner, state};
}

const tickServe = (ms = 10) => new Promise((resolve) => setTimeout(resolve, ms));

test('start que resolve depois do stop não deixa servidor órfão', async () => {
  const {owner, state} = createDeafStartOwner();
  const outcome = owner.acquire({}).then((lease) => ({lease}), (error) => ({error}));
  await tickServe();
  assert.equal(state.started, true, 'a subida partiu');
  await owner.stop();
  const cancelled = await outcome;
  assert.equal(cancelled.error?.message, CANCELLED_TEXT);
  state.releases.shift()?.();
  await tickServe(20);
  assert.equal(state.servers.length, 1, 'o start tardio resolveu');
  assert.equal(state.servers[0].stops, 1, 'o recém-nascido é parado na hora, em vez de ficar vivo sem dono');
  assert.equal(owner.running(), false);
  /* A próxima subida recomeça do zero. */
  const next = owner.acquire({});
  await tickServe();
  state.releases.shift()?.();
  const lease = await next;
  assert.match(lease.baseUrl, /^http:\/\/127\.0\.0\.1:/);
  assert.equal(state.servers[1].stops, 0);
  await owner.stop();
});

test('start que resolve depois do cancelamento total não deixa servidor órfão', async () => {
  const {owner, state} = createDeafStartOwner();
  const seat = {};
  const outcome = owner.acquire(seat).then((lease) => ({lease}), (error) => ({error}));
  await tickServe();
  assert.equal(state.started, true, 'a subida partiu');
  owner.cancelStarting(seat);
  const cancelled = await outcome;
  assert.equal(cancelled.error?.message, CANCELLED_TEXT);
  assert.equal(cancelled.error?.notSent, true);
  state.releases.shift()?.();
  await tickServe(20);
  assert.equal(state.servers.length, 1, 'o start tardio resolveu');
  assert.equal(state.servers[0].stops, 1, 'o recém-nascido é parado na hora, em vez de ficar vivo sem dono');
  assert.equal(owner.running(), false);
  await owner.stop();
});

test('stop rejeita todas as esperas e a próxima subida recomeça (#57)', async () => {
  const {owner, state} = createGatedOwner();
  const first = owner.acquire();
  const second = owner.acquire();
  const outcomes = [first, second].map((promise) => promise.then((lease) => ({lease}), (error) => ({error})));
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(state.startCalls.length, 1, 'as duas chamadas dividem a mesma subida');
  owner.stop();
  const [cancelledFirst, cancelledSecond] = await Promise.all(outcomes);
  assert.equal(cancelledFirst.error?.message, CANCELLED_TEXT);
  assert.equal(cancelledSecond.error?.message, CANCELLED_TEXT);
  await new Promise((resolve) => setTimeout(resolve, 20));
  state.releases.length = 0;
  const next = owner.acquire();
  await new Promise((resolve) => setTimeout(resolve, 20));
  state.releases.shift()?.();
  const lease = await next;
  assert.match(lease.baseUrl, /^http:\/\/127\.0\.0\.1:/);
  assert.equal(state.startCalls.length, 2, 'a saída abortou a subida órfã; a próxima sobe de novo');
  await owner.stop();
});
