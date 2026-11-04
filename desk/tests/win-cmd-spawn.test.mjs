/* Linha do cmd.exe para o `pi.cmd` do Windows (CI do PR #86): o `shell: true`
   juntava os argumentos sem aspas e um caminho com espaço ou `&` virava
   sintaxe. Função pura: o teste roda em qualquer sistema. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {cmdSpawnArgs, quoteCmdArgument, spawnPlan} = require('../src/win-cmd-spawn.cjs');

test('argumento vai entre aspas com metacaracteres escapados duas vezes (o %* do shim reinterpreta)', () => {
  assert.equal(quoteCmdArgument('rpc'), '^^^"rpc^^^"');
  assert.equal(quoteCmdArgument('a b&c'), '^^^"a^^^ b^^^&c^^^"');
  assert.equal(quoteCmdArgument('C:\\Users\\Lucas Faria\\'), '^^^"C:\\Users\\Lucas^^^ Faria\\\\^^^"');
  assert.equal(quoteCmdArgument('diz "oi"'), '^^^"diz^^^ \\^^^"oi\\^^^"^^^"');
});

test('quebra de linha é recusada com o valor recebido', () => {
  assert.throws(() => quoteCmdArgument('linha 1\nlinha 2'), /quebra de linha.*linha 1/);
});

test('.cmd no Windows passa pelo cmd.exe com a linha literal; o resto roda direto', () => {
  const plan = cmdSpawnArgs('C:\\npm dir\\pi.cmd', ['--session', 'x y'], {ComSpec: 'C:\\Windows\\system32\\cmd.exe'});
  assert.equal(plan.file, 'C:\\Windows\\system32\\cmd.exe');
  assert.deepEqual(plan.args.slice(0, 3), ['/d', '/s', '/c']);
  assert.equal(plan.args[3], '"C:\\npm^ dir\\pi.cmd ^^^"--session^^^" ^^^"x^^^ y^^^""');
  assert.equal(plan.options.windowsVerbatimArguments, true);
  assert.deepEqual(spawnPlan('/usr/bin/pi', ['a b'], {platform: 'linux'}), {file: '/usr/bin/pi', args: ['a b'], options: {}});
  assert.deepEqual(spawnPlan('C:\\pi.exe', ['a b'], {platform: 'win32'}), {file: 'C:\\pi.exe', args: ['a b'], options: {}});
  assert.equal(spawnPlan('C:\\pi.CMD', [], {platform: 'win32', env: {}}).file, 'cmd.exe');
});
