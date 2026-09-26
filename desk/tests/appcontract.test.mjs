/* Contrato entre os dois apps irmãos (Mesa/desk e Conversa/chat).
 *
 * Os dois falam com o MESMO Pi pelo mesmo modo RPC, mas cada um tem o seu
 * `rpc.cjs` e o seu `pi.cjs`. Nada no repositório garante que continuem de
 * acordo: a Mesa pode passar a lançar com outro sinal e a Conversa não, e o
 * desalinhamento só aparece em produção.
 *
 * Estes testes pinam o que PRECISA ser igual (linha de comando, ambiente,
 * framing, resposta de UI) e deixam explícito o que é de propósito diferente.
 * Não provam um turno do modelo — provam que os dois lados combinam.
 *
 * `chat/` não existe na árvore pública (snapshot da Mesa): sem ele, os testes
 * são pulados em vez de falhar.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import {EventEmitter} from 'node:events';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const desk = dirname(dirname(fileURLToPath(import.meta.url)));
const chat = join(dirname(desk), 'chat');
const hasChat = existsSync(join(chat, 'rpc.cjs'));
const skip = hasChat ? false : 'chat/ não está nesta árvore (snapshot público da Mesa)';

/* Captura em vez de executar: troca o `spawn` antes de carregar os bridges,
   porque os dois módulos desestruturam `{spawn}` no require. */
function captureBridges() {
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
  const children = [];
  cp.spawn = (cmd, args, opts) => {
    const child = makeChild();
    children.push(child);
    launched.push({cmd, args, opts, child});
    return child;
  };
  try {
    delete require.cache[require.resolve('../rpc.cjs')];
    delete require.cache[require.resolve(join(chat, 'rpc.cjs'))];
    return {
      launched,
      children,
      desk: require('../rpc.cjs'),
      chat: hasChat ? require(join(chat, 'rpc.cjs')) : null,
    };
  } finally {
    cp.spawn = original;
  }
}

function startBoth() {
  const captured = captureBridges();
  const bridges = [captured.desk, captured.chat]
    .filter(Boolean)
    .map((module) => new module.PiBridge({
      cwd: '/tmp/contract-cwd',
      session: '/tmp/contract-session.jsonl',
      pi: '/opt/homebrew/bin/pi',
      promptFile: '/tmp/contract-prompt.md',
      extraArgs: [],
    }));
  for (const bridge of bridges) bridge.start();
  return {...captured, bridges};
}

test('os dois apps lançam o Pi com a mesma linha de comando base', {skip}, () => {
  const {launched} = startBoth();
  assert.equal(launched.length, 2, 'cada app deve ter lançado um processo');
  const [deskLaunch, chatLaunch] = launched;
  const base = (args) => args.slice(0, 5);
  assert.deepEqual(base(deskLaunch.args), ['--mode', 'rpc', '--session', deskLaunch.args[3], '--approve']);
  assert.deepEqual(base(chatLaunch.args), base(deskLaunch.args), 'a base da linha de comando divergiu entre Mesa e Conversa');
  assert.equal(deskLaunch.cmd, '/opt/homebrew/bin/pi');
  assert.equal(chatLaunch.cmd, deskLaunch.cmd);
  assert.deepEqual(deskLaunch.opts.stdio, ['pipe', 'pipe', 'pipe']);
  assert.deepEqual(chatLaunch.opts.stdio, deskLaunch.opts.stdio);
  assert.equal(deskLaunch.opts.cwd, '/tmp/contract-cwd');
  assert.equal(chatLaunch.opts.cwd, deskLaunch.opts.cwd);
});

test('os dois apps pedem o mesmo silêncio de Obsidian e de memória observacional', {skip}, () => {
  const {launched} = startBoth();
  for (const launch of launched) {
    assert.equal(launch.opts.env.PI_LEARNING_NO_OBSIDIAN, '1', 'sem isto a Mesa/Conversa abriria o Obsidian');
    assert.equal(launch.opts.env.PI_OM_PASSIVE, '1');
  }
});

test('o PATH do Pi preserva o herdado e acrescenta os binários do usuário, nos dois apps', {skip}, () => {
  const {launched} = startBoth();
  const inherited = (process.env.PATH || '').split(':').filter(Boolean);
  for (const launch of launched) {
    const parts = launch.opts.env.PATH.split(':').filter(Boolean);
    assert.equal(parts[0], dirname(launch.cmd), 'o diretório do Pi deve vir primeiro');
    for (const dir of inherited) {
      assert.ok(parts.includes(dir), `o PATH herdado perdeu ${dir} — o app quebraria o que já funcionava no terminal`);
    }
    for (const dir of ['/opt/homebrew/bin', '/usr/local/bin']) {
      if (existsSync(dir)) assert.ok(parts.includes(dir), `${dir} existe na máquina e deveria entrar`);
    }
  }
});

test('o framing de linhas é idêntico nos dois apps', {skip}, () => {
  const {desk, chat: chatRpc} = captureBridges();
  const cases = [
    ['', {lines: [], rest: '', overflow: false}],
    ['a\n', {lines: ['a'], rest: '', overflow: false}],
    ['a\nb', {lines: ['a'], rest: 'b', overflow: false}],
    ['\n\n', {lines: ['', ''], rest: '', overflow: false}],
    ['{"type":"x"}\n{"type":"y"}\n', {lines: ['{"type":"x"}', '{"type":"y"}'], rest: '', overflow: false}],
  ];
  for (const [input, expected] of cases) {
    assert.deepEqual(desk.frameSplit(input), expected, `Mesa divergiu no caso ${JSON.stringify(input)}`);
    assert.deepEqual(chatRpc.frameSplit(input), desk.frameSplit(input), `Conversa divergiu no caso ${JSON.stringify(input)}`);
  }
  /* Guarda contra o teste vazio: são duas implementações (não a mesma função
     exportada duas vezes), então comparar as duas diz alguma coisa. */
  assert.notEqual(desk.frameSplit, chatRpc.frameSplit, 'comparing a function to itself would pass vacuously');
  assert.notEqual(desk.PiBridge, chatRpc.PiBridge);
  const big = 'x'.repeat(33554433);
  assert.equal(desk.frameSplit(big).overflow, true);
  assert.deepEqual(chatRpc.frameSplit(big), desk.frameSplit(big), 'o limite de overflow divergiu');
});

test('a resposta de UI sai no mesmo formato para os dois apps', {skip}, () => {
  const {desk, chat: chatRpc} = captureBridges();
  const deskBridge = new desk.PiBridge({cwd: '/tmp/c', session: '/tmp/s.jsonl', pi: '/opt/homebrew/bin/pi'});
  const chatBridge = new chatRpc.PiBridge({cwd: '/tmp/c', session: '/tmp/s.jsonl', pi: '/opt/homebrew/bin/pi'});
  deskBridge.start();
  chatBridge.start();
  for (const bridge of [deskBridge, chatBridge]) {
    bridge.respond({id: 'ask-1', value: 'sim'});
    const payload = JSON.parse(bridge.child.writes.at(-1));
    assert.deepEqual(payload, {id: 'ask-1', type: 'extension_ui_response', value: 'sim'});
    bridge.respond({id: 'ask-2', confirmed: true});
    assert.deepEqual(JSON.parse(bridge.child.writes.at(-1)), {id: 'ask-2', type: 'extension_ui_response', confirmed: true});
    bridge.respond({id: 'ask-3', cancelled: true});
    assert.deepEqual(JSON.parse(bridge.child.writes.at(-1)), {id: 'ask-3', type: 'extension_ui_response', cancelled: true});
  }
});

test('os dois apps usam o mesmo núcleo de estado RPC, byte a byte', {skip}, () => {
  const deskCore = join(desk, 'src', 'generated', 'rpcstate.core.js');
  const chatCore = join(chat, 'src', 'generated', 'rpcstate.core.js');
  assert.ok(existsSync(deskCore) && existsSync(chatCore), 'os dois artefatos do núcleo devem existir');
  assert.equal(readFileSync(chatCore, 'utf8'), readFileSync(deskCore, 'utf8'), 'o artefato do núcleo RPC divergiu entre os apps — regenere com npm run verify:bend');
});

test('os dois apps usam o mesmo núcleo do bilhete, byte a byte', {skip}, () => {
  /* O bilhete é o único módulo gerado para os dois apps de propósito: um lado
     escreve, o outro lê. Se os artefatos divergirem, a Conversa grava um
     formato e a Mesa lê outro — sem erro visível, só um bilhete ignorado. */
  const deskCore = join(desk, 'src', 'generated', 'handoff.core.js');
  const chatCore = join(chat, 'src', 'generated', 'handoff.core.js');
  assert.ok(existsSync(deskCore) && existsSync(chatCore), 'os dois artefatos do bilhete devem existir');
  assert.equal(readFileSync(chatCore, 'utf8'), readFileSync(deskCore, 'utf8'), 'o artefato do bilhete divergiu entre os apps — regenere com npm run verify:bend');
});

test('os dois adaptadores do bilhete produzem o mesmo texto', {skip}, () => {
  /* Os adaptadores são duas cópias do mesmo formato (os apps não compartilham
     código de host). A comparação é o que impede a cópia de virar divergência:
     o mesmo bilhete tem de render o mesmo bloco dos dois lados. */
  const deskHandoff = require('../handoff.cjs');
  const chatHandoff = require(join(chat, 'handoff.cjs'));
  assert.notEqual(deskHandoff.buildBlock, chatHandoff.buildBlock, 'comparing a function to itself would pass vacuously');
  const cases = [
    {goal: 'revisar limites', question: 'como isolar x?', refs: ['Limites.pdf', 'Lista 3 · q3']},
    {goal: 'revisar limites', question: '', refs: []},
    {goal: '', question: 'e agora?', refs: ['a.pdf']},
    {refs: ['so-ref.pdf']},
    {goal: '  aparado  ', question: '  e agora?  '},
    {goal: 'antigo', stale: true},
    {},
    /* Os tetos são a parte do formato que só aparece no limite: referência
       longa demais e lista acima do máximo precisam ser cortadas do mesmo jeito
       nos dois lados, senão o bilhete muda de tamanho dependendo de quem leu.
       O comprimento tem de PASSAR de REF_MAX (300) — uma referência curta não
       exercita o corte e o teste passaria vazio. */
    {goal: 'x', refs: [Array.from({length: 400}, () => 'a').join('')]},
    {goal: 'x', refs: Array.from({length: 25}, (_, i) => `arq-${i}.pdf`)},
    {goal: 'x', refs: ['  ', 'ok.pdf', null, 42, 'ok2.pdf']},
  ];
  for (const entry of cases) {
    assert.equal(
      chatHandoff.buildBlock(entry),
      deskHandoff.buildBlock(entry),
      `os adaptadores divergiram no bilhete ${JSON.stringify(entry)}`,
    );
  }
  for (const entry of cases) {
    assert.deepEqual(chatHandoff.normalizeFields(entry), deskHandoff.normalizeFields(entry));
  }
  assert.equal(chatHandoff.VERSION, deskHandoff.VERSION);
  assert.equal(chatHandoff.FROM, deskHandoff.FROM);
  assert.equal(chatHandoff.MAX_REFS, deskHandoff.MAX_REFS);
  assert.equal(chatHandoff.STALE_MS, deskHandoff.STALE_MS);
});

test('linha torta vira AVISO nos dois apps, nunca erro que derruba', {skip}, () => {
  /* A Mesa e a Conversa tratam linha inválida do stdout do Pi de jeitos
     diferentes de propósito: os dois avisam e seguem (núcleo `onGarbage`), mas
     cada um com o nome de evento do seu app — `desk_warn`/`pi_warning`. O que
     NÃO pode acontecer em nenhum dos dois é o evento de queda
     (`desk_error`/`chat_error`): a UI pintaria o ponto de vermelho e destravaria
     o composer no meio de um turno que está vivo (achado do `hunt-chaos`).

     O teste ANTES disto procurava `/desk_error/` no TEXTO do rpc.cjs da Mesa —
     passava por causa da queda de verdade e não dizia nada sobre a linha torta.
     Agora a linha torta é entregue ao bridge de verdade e o que se olha são os
     eventos que saem. */
  const {bridges} = startBoth();
  const [deskBridge, chatBridge] = bridges;
  const deskEvents = [];
  const chatEvents = [];
  deskBridge.on('event', (event) => deskEvents.push(event));
  chatBridge.on('event', (event) => chatEvents.push(event));

  for (const bridge of bridges) bridge.child.stdout.emit('data', '){isto-nao-e-json}\n');

  const avisos = (events, type) => events.filter((event) => event.type === type);
  assert.equal(avisos(deskEvents, 'desk_warn').length, 1, 'a Mesa avisa uma vez');
  assert.equal(avisos(chatEvents, 'pi_warning').length, 1, 'a Conversa avisa uma vez');
  assert.match(avisos(deskEvents, 'desk_warn')[0].message, /Pi/, 'o aviso diz de onde veio');
  assert.match(avisos(chatEvents, 'pi_warning')[0].message, /Pi/, 'nos dois apps');
  assert.equal(avisos(deskEvents, 'desk_error').length, 0, 'linha torta não é queda na Mesa');
  assert.equal(avisos(chatEvents, 'chat_error').length, 0, 'nem na Conversa');
  assert.ok(deskBridge.child && chatBridge.child, 'a ponte continua viva (o processo não foi descartado)');
  assert.equal(deskBridge.stopped, false);
  assert.equal(chatBridge.stopped, false);

  /* Uma linha boa depois do lixo passa normalmente e não gera aviso novo. */
  for (const bridge of bridges) bridge.child.stdout.emit('data', '{"type":"noop"}\n');
  assert.deepEqual(deskEvents.map((event) => event.type), ['desk_warn', 'noop']);
  assert.deepEqual(chatEvents.map((event) => event.type), ['pi_warning', 'noop'], 'o mesmo fluxo nos dois apps');
});
