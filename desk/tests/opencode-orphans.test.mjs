/* Recolha do `opencode serve` que a Mesa deixou para trás.
 *
 * O ledger guarda o pid/pgid que a MESMA Mesa subiu. No próximo arranque só
 * esse processo é tocado, e só quando a linha de comando ainda for o
 * `opencode serve` da Mesa, com os argumentos exatos que ela lança
 * (`serve --hostname 127.0.0.1 --port 0`). Processo fora do ledger não é
 * tocado; linha de comando diferente também não — inclusive um serve do
 * usuário em outra porta.
 *
 * As dependências entram por parâmetro (leitura da linha de comando e o
 * kill): o teste usa fakes nomeados e NÃO mata processo de verdade. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {sweepOrphans, isMesaServe, readEntry, writeEntry, clearEntry, ledgerPath} = require('../src/agents/opencode-orphans.cjs');

const SERVE = '/Users/alguem/.opencode/bin/opencode serve --hostname 127.0.0.1 --port 0';
const USER_SERVE = '/Users/alguem/.opencode/bin/opencode serve --hostname 127.0.0.1 --port 4096';

function tempRuntime() {
  return mkdtempSync(join(tmpdir(), 'mesa-opencode-orphans-'));
}

test('a linha de comando precisa ser o serve da Mesa', () => {
  assert.equal(isMesaServe(SERVE, '/Users/alguem/.opencode/bin/opencode'), true);
  assert.equal(isMesaServe(SERVE, ''), true, 'sem binário no ledger, o nome opencode serve');
  assert.equal(isMesaServe('/usr/bin/python3 servidor.py', '/Users/alguem/.opencode/bin/opencode'), false);
  assert.equal(isMesaServe('/Users/alguem/.opencode/bin/opencode run', '/Users/alguem/.opencode/bin/opencode'), false, 'outro subcomando não é o serve');
  assert.equal(isMesaServe('/Users/alguem/.opencode/bin/opencode serve', '/Users/alguem/.opencode/bin/opencode'), false, 'serve sem os argumentos da Mesa não é o da Mesa');
  assert.equal(isMesaServe('/Users/alguem/.opencode/bin/opencode serve --port 5555', '/Users/alguem/.opencode/bin/opencode'), false, 'serve do usuário em outra porta não é o da Mesa');
  assert.equal(isMesaServe('', '/Users/alguem/.opencode/bin/opencode'), false);
  assert.equal(isMesaServe(null, ''), false);
});

test('o servidor do ledger é encerrado pelo grupo', () => {
  const runtime = tempRuntime();
  try {
    writeEntry(runtime, {pid: 4242, pgid: 4242, binary: '/Users/alguem/.opencode/bin/opencode'});
    const killed = [];
    const result = sweepOrphans({
      dir: runtime,
      readCommandLine: () => SERVE,
      kill: (target) => killed.push(target),
      exists: () => true,
    });
    assert.equal(result.killed.length, 1);
    assert.equal(result.killed[0].pid, 4242);
    assert.deepEqual(killed, [{pid: 4242, pgid: 4242, signal: 'SIGTERM'}]);
    assert.equal(readEntry(runtime), null, 'o registro é apagado depois da recolha');
  } finally {
    rmSync(runtime, {recursive: true, force: true});
  }
});

test('linha de comando que não é o serve da Mesa: o processo não é tocado', () => {
  const runtime = tempRuntime();
  try {
    writeEntry(runtime, {pid: 4242, pgid: 4242, binary: '/Users/alguem/.opencode/bin/opencode'});
    const killed = [];
    const result = sweepOrphans({
      dir: runtime,
      readCommandLine: () => '/usr/bin/python3 meu-servidor.py',
      kill: (target) => killed.push(target),
      exists: () => true,
    });
    assert.deepEqual(killed, [], 'nada é morto');
    assert.equal(result.killed.length, 0);
    assert.equal(result.skipped.length, 1);
    assert.match(result.skipped[0].reason, /não é o serve da Mesa/);
  } finally {
    rmSync(runtime, {recursive: true, force: true});
  }
});

test('serve do usuário em outra porta não é tocado pela recolha', () => {
  const runtime = tempRuntime();
  try {
    writeEntry(runtime, {pid: 4242, pgid: 4242, binary: '/Users/alguem/.opencode/bin/opencode'});
    const killed = [];
    const result = sweepOrphans({
      dir: runtime,
      readCommandLine: () => USER_SERVE,
      kill: (target) => killed.push(target),
      exists: () => true,
    });
    assert.deepEqual(killed, [], 'o serve do usuário continua vivo');
    assert.equal(result.killed.length, 0);
    assert.equal(result.skipped.length, 1);
    assert.match(result.skipped[0].reason, /não é o serve da Mesa/);
  } finally {
    rmSync(runtime, {recursive: true, force: true});
  }
});

test('pid que não existe mais: nada é morto e o registro some', () => {
  const runtime = tempRuntime();
  try {
    writeEntry(runtime, {pid: 4242, pgid: 4242, binary: '/Users/alguem/.opencode/bin/opencode'});
    const killed = [];
    const result = sweepOrphans({
      dir: runtime,
      readCommandLine: () => null,
      kill: (target) => killed.push(target),
      exists: () => true,
    });
    assert.deepEqual(killed, []);
    assert.equal(result.killed.length, 0);
    assert.equal(readEntry(runtime), null);
  } finally {
    rmSync(runtime, {recursive: true, force: true});
  }
});

test('processo fora do ledger nunca é tocado', () => {
  const runtime = tempRuntime();
  try {
    clearEntry(runtime);
    const killed = [];
    const seen = [];
    const result = sweepOrphans({
      dir: runtime,
      readCommandLine: (pid) => { seen.push(pid); return SERVE; },
      kill: (target) => killed.push(target),
      exists: () => true,
    });
    assert.deepEqual(killed, []);
    assert.deepEqual(seen, [], 'sem registro, nem se procura processo nenhum');
    assert.equal(result.entry, null);
  } finally {
    rmSync(runtime, {recursive: true, force: true});
  }
});

test('o ledger não guarda senha e só vale para o runtime da Mesa', () => {
  const runtime = tempRuntime();
  try {
    writeEntry(runtime, {pid: 4242, pgid: 4242, binary: '/Users/alguem/.opencode/bin/opencode'});
    const entry = readEntry(runtime);
    assert.deepEqual(Object.keys(entry).sort(), ['binary', 'pgid', 'pid']);
    assert.equal(JSON.stringify(entry).includes('password'), false);
    assert.equal(JSON.stringify(entry).includes('senha'), false);
  } finally {
    rmSync(runtime, {recursive: true, force: true});
  }
});

test('pgid estragado no ledger: encerra só o grupo do pid conferido, nunca kill(-1)', () => {
  const runtime = tempRuntime();
  try {
    writeFileSync(ledgerPath(runtime), JSON.stringify({pid: 4242, pgid: 1, binary: '/Users/alguem/.opencode/bin/opencode'}));
    const killed = [];
    const result = sweepOrphans({
      dir: runtime,
      readCommandLine: () => SERVE,
      kill: (target) => killed.push(target),
      exists: () => true,
    });
    assert.deepEqual(killed, [{pid: 4242, pgid: 4242, signal: 'SIGTERM'}]);
    assert.deepEqual(result.killed, [{pid: 4242, pgid: 4242}]);
  } finally {
    rmSync(runtime, {recursive: true, force: true});
  }
});
