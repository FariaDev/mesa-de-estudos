/* Contrato da ponte RPC da Mesa com o Pi (`desk/rpc.cjs`).
 *
 * Até a #50 este arquivo era `appcontract.test.mjs` e comparava a Mesa com o
 * app irmão Conversa, que tinha o seu próprio `rpc.cjs`. Sem a Conversa, as
 * mesmas asserções ficam como contrato da Mesa sozinha: linha de comando,
 * ambiente, framing e resposta de UI que o Pi espera. Não provam um turno do
 * modelo — provam o que a Mesa escreve e lê na fronteira.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {EventEmitter} from 'node:events';
import {dirname} from 'node:path';
import {createRequire} from 'node:module';
import {ptText} from './pt-text.mjs';

const require = createRequire(import.meta.url);

/* Captura em vez de executar: troca o `spawn` antes de carregar a ponte, porque
   o módulo desestrutura `{spawn}` no require. */
function captureBridge() {
  const cp = require('node:child_process');
  const original = cp.spawn;
  const launched = [];
  const makeChild = () => {
    const child = new EventEmitter();
    const input = [];
    child.stdout = new EventEmitter();
    child.stdout.setEncoding = () => {};
    child.stderr = new EventEmitter();
    child.stdin = new EventEmitter();
    child.stdin.write = (chunk) => {
      input.push(String(chunk));
      return true;
    };
    child.kill = () => {};
    child.writes = input;
    return child;
  };
  cp.spawn = (cmd, args, opts) => {
    const child = makeChild();
    launched.push({cmd, args, opts, child});
    return child;
  };
  try {
    delete require.cache[require.resolve('../rpc.cjs')];
    return {launched, rpc: require('../rpc.cjs')};
  } finally {
    cp.spawn = original;
  }
}

function startBridge() {
  const captured = captureBridge();
  const bridge = new captured.rpc.PiBridge({
    cwd: '/tmp/contract-cwd',
    session: '/tmp/contract-session.jsonl',
    pi: '/opt/homebrew/bin/pi',
    promptFile: '/tmp/contract-prompt.md',
    extraArgs: [],
  });
  bridge.start();
  return {...captured, bridge};
}

test('a Mesa lança o Pi com a linha de comando base', () => {
  const {launched} = startBridge();
  assert.equal(launched.length, 1, 'um processo do Pi');
  const [launch] = launched;
  assert.deepEqual(launch.args.slice(0, 5), ['--mode', 'rpc', '--session', launch.args[3], '--approve']);
  assert.equal(launch.cmd, '/opt/homebrew/bin/pi');
  assert.deepEqual(launch.opts.stdio, ['pipe', 'pipe', 'pipe']);
  assert.equal(launch.opts.cwd, '/tmp/contract-cwd');
});

test('a Mesa pede silêncio de Obsidian e de memória observacional', () => {
  const {launched} = startBridge();
  assert.equal(launched[0].opts.env.PI_LEARNING_NO_OBSIDIAN, '1', 'sem isto a Mesa abriria o Obsidian');
  assert.equal(launched[0].opts.env.PI_OM_PASSIVE, '1');
});

test('o PATH do Pi preserva o herdado e acrescenta os binários do usuário', () => {
  const {launched} = startBridge();
  const [launch] = launched;
  const inherited = (process.env.PATH || '').split(':').filter(Boolean);
  const parts = launch.opts.env.PATH.split(':').filter(Boolean);
  assert.equal(parts[0], dirname(launch.cmd), 'o diretório do Pi deve vir primeiro');
  for (const dir of inherited) {
    assert.ok(parts.includes(dir), `o PATH herdado perdeu ${dir} — o app quebraria o que já funcionava no terminal`);
  }
  for (const dir of ['/opt/homebrew/bin', '/usr/local/bin']) {
    if (existsSync(dir)) assert.ok(parts.includes(dir), `${dir} existe na máquina e deveria entrar`);
  }
});

test('o framing de linhas separa por quebra e sinaliza estouro', () => {
  const {rpc} = captureBridge();
  const cases = [
    ['', {lines: [], rest: '', overflow: false}],
    ['a\n', {lines: ['a'], rest: '', overflow: false}],
    ['a\nb', {lines: ['a'], rest: 'b', overflow: false}],
    ['\n\n', {lines: ['', ''], rest: '', overflow: false}],
    ['{"type":"x"}\n{"type":"y"}\n', {lines: ['{"type":"x"}', '{"type":"y"}'], rest: '', overflow: false}],
  ];
  for (const [input, expected] of cases) {
    assert.deepEqual(rpc.frameSplit(input), expected, `caso ${JSON.stringify(input)}`);
  }
  assert.equal(rpc.frameSplit('x'.repeat(33554433)).overflow, true);
});

test('a resposta de UI sai no formato que o Pi espera', () => {
  const {bridge} = startBridge();
  bridge.respond({id: 'ask-1', value: 'sim'});
  assert.deepEqual(JSON.parse(bridge.child.writes.at(-1)), {id: 'ask-1', type: 'extension_ui_response', value: 'sim'});
  bridge.respond({id: 'ask-2', confirmed: true});
  assert.deepEqual(JSON.parse(bridge.child.writes.at(-1)), {id: 'ask-2', type: 'extension_ui_response', confirmed: true});
  bridge.respond({id: 'ask-3', cancelled: true});
  assert.deepEqual(JSON.parse(bridge.child.writes.at(-1)), {id: 'ask-3', type: 'extension_ui_response', cancelled: true});
});

test('linha torta vira AVISO, nunca erro que derruba', () => {
  /* O evento de queda (`desk_error`) pintaria o ponto de vermelho e destravaria
     o composer no meio de um turno que está vivo (achado do `hunt-chaos`). A
     linha torta é entregue à ponte de verdade e o que se olha são os eventos
     que saem. */
  const {bridge} = startBridge();
  const events = [];
  bridge.on('event', (event) => events.push(event));

  bridge.child.stdout.emit('data', '){isto-nao-e-json}\n');

  const avisos = events.filter((event) => event.type === 'desk_warn');
  assert.equal(avisos.length, 1, 'a Mesa avisa uma vez');
  assert.match(ptText(avisos[0].message), /Pi/, 'o aviso diz de onde veio');
  assert.equal(events.filter((event) => event.type === 'desk_error').length, 0, 'linha torta não é queda');
  assert.ok(bridge.child, 'a ponte continua viva (o processo não foi descartado)');
  assert.equal(bridge.stopped, false);

  /* Uma linha boa depois do lixo passa normalmente e não gera aviso novo. */
  bridge.child.stdout.emit('data', '{"type":"noop"}\n');
  assert.deepEqual(events.map((event) => event.type), ['desk_warn', 'noop']);
});
