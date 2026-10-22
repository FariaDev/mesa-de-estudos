/* Dono do `opencode serve` (#57): um servidor por app, trocado quando a chave
   muda ou quando ele cai sozinho. `fakeStart` e `fakeSweep` são nomeados:
   nenhum processo real sobe e nenhuma chave aparece no log. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {createServeOwner} = require('../src/agents/opencode-serve-owner.cjs');

const CWD = '/tmp/mesa-cwd';
const LEDGER = '/tmp/mesa-ledger';
const EMPTY_SWEEP = {killed: [], skipped: [], entry: null};

function createOwnerHarness({key = 'chave-falsa-1', binary = '/fake/opencode'} = {}) {
  const state = {
    key,
    binary,
    startCalls: [],
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
    keyEnv: () => ({OPENCODE_API_KEY: state.key}),
    baseEnv: () => ({MESA_TESTE: 'sim'}),
    cwd: CWD,
    ledgerDir: LEDGER,
    log: (area, line) => state.logs.push(`${area}: ${line}`),
    start: fakeStart,
    sweep: fakeSweep,
  });

  return {owner, state};
}

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

test('sweepAtBoot loga recolhido e descartado e não lança quando a recolha falha', () => {
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
  assert.ok(state.logs.some((line) => line.includes('descartado')));

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
