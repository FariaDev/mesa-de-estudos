/* Encerramento da árvore do processo (CI windows-latest). O teste usa um filho fake com
   nome e um `execFile` fake: nenhum processo é morto de verdade. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {killProcessTree, waitForExit} = require('../src/proc-tree.cjs');

/** Filho fake: registra o sinal e deixa o teste controlar o 'exit'. */
function fakeChild({pid = 4242} = {}) {
  const child = new EventEmitter();
  child.pid = pid;
  child.exitCode = null;
  child.signalCode = null;
  child.killed = [];
  child.kill = (signal) => { child.killed.push(signal ?? 'default'); return true; };
  return child;
}

test('no Windows o kill desce a árvore com taskkill /PID <pid> /T /F', () => {
  const calls = [];
  const child = fakeChild();
  const killed = killProcessTree(child, {
    platform: 'win32',
    execFile: (file, args, options) => { calls.push({file, args, options}); },
  });
  assert.equal(killed, true);
  assert.deepEqual(calls.map(({file, args}) => ({file, args})), [{file: 'taskkill', args: ['/PID', '4242', '/T', '/F']}]);
  assert.deepEqual(calls[0].options, {stdio: 'ignore'});
  assert.deepEqual(child.killed, [], 'não mata só o cmd.exe: o node.exe neto ficaria vivo');
});

test('no POSIX o sinal vai direto ao filho, sem taskkill', () => {
  const calls = [];
  const child = fakeChild();
  killProcessTree(child, {platform: 'linux', execFile: () => { calls.push('exec'); }});
  assert.deepEqual(calls, []);
  assert.deepEqual(child.killed, ['default']);
});

test('taskkill que falha cai no kill direto e nunca lança', () => {
  const child = fakeChild();
  killProcessTree(child, {platform: 'win32', execFile: () => { throw Error('já saiu'); }});
  assert.deepEqual(child.killed, ['default']);
  assert.equal(killProcessTree(null, {platform: 'win32'}), false);
});

test('waitForExit só resolve quando o exit chega', async () => {
  const child = fakeChild();
  let resolved = false;
  const waiting = waitForExit(child).then((value) => { resolved = value; return value; });
  await Promise.resolve();
  assert.equal(resolved, false, 'não resolve antes de o processo sair');
  child.exitCode = 0;
  child.emit('exit', 0, null);
  assert.equal(await waiting, true);
});

test('waitForExit resolve na hora para um filho que já saiu', async () => {
  const child = fakeChild();
  child.exitCode = 1;
  assert.equal(await waitForExit(child), true);
});

test('waitForExit tem prazo e não pendura o stop para sempre', async () => {
  const child = fakeChild();
  assert.equal(await waitForExit(child, {timeoutMs: 10}), false);
});
