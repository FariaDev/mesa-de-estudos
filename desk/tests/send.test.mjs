/* Ciclo de envio de um prompt: o que conta como entregue (desk/send.cjs).
 *
 * Um bridge de mentira que falha onde o teste manda: validação de anexo,
 * conexão, escrita e `get_state`. O que se prova aqui é o comportamento do mesmo
 * código que o app roda, não a ordem das linhas do main.
 *
 * Onde termina a simulação: o provider real não é chamado. `connect` e
 * `bridge.request` são as fronteiras com o Pi, e é exatamente nelas que os
 * cenários de falha precisam acontecer.
 *
 * A #50 tirou daqui o bilhete Conversa → Mesa (marca de envio, dúvida, arquivo):
 * os cenários de entrega que sobram valem para a mensagem e o contexto do turno.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, readFileSync, readdirSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {ptText} from './pt-text.mjs';

const require = createRequire(import.meta.url);
const send = require('../send.cjs');
const deskDir = dirname(dirname(fileURLToPath(import.meta.url)));

/* Bridge de mentira: registra a ordem das chamadas e falha no método pedido. */
function fakeBridge({failAt = '', motivo = 'falha de propósito', notSent = false} = {}) {
  const seen = [];
  return {
    seen,
    request: async (method, params) => {
      seen.push({method, params});
      if (failAt === method) {
        const error = Error(motivo);
        if (notSent) error.notSent = true;
        throw error;
      }
      if (method === 'get_state') return {isStreaming: false};
      return {};
    },
  };
}

const PEDIDO = {message: 'segue o exercício 3', streamingBehavior: 'followUp'};

test('o módulo exporta só o ciclo de envio: a #50 aposentou o bilhete', () => {
  assert.deepEqual(Object.keys(send), ['deliverPrompt']);
});

test('anexo inválido não chega a conectar nem a escrever', async () => {
  let aceitos = 0;
  let conectou = false;
  const bridge = fakeBridge();

  await assert.rejects(
    () => send.deliverPrompt({
      request: PEDIDO,
      images: [{dataUrl: 'data:image/png;base64,AAAA'}],
      validateImages() { throw Error('Anexo grande demais: reduza a captura.'); },
      connect() { conectou = true; return bridge; },
      onAccepted() { aceitos += 1; },
    }),
    /Anexo grande demais/,
    'o motivo da validação chega ao usuário como veio',
  );

  assert.equal(conectou, false, 'com anexo inválido nem tenta abrir o Pi');
  assert.deepEqual(bridge.seen, [], 'nada foi escrito');
  assert.equal(aceitos, 0, 'o contexto do turno não conta como enviado');
});

test('anexo válido vai junto no pedido, sem mexer no pedido original', async () => {
  const bridge = fakeBridge();
  const anexos = [{type: 'image', data: 'AAAA'}];
  const original = {...PEDIDO};

  await send.deliverPrompt({request: original, images: ['cru'], validateImages: () => anexos, connect: () => bridge});

  assert.deepEqual(bridge.seen[0].params, {...PEDIDO, images: anexos});
  assert.deepEqual(original, PEDIDO, 'o pedido do chamador não ganha campos');
});

test('conexão que falha não escreve nem conta o contexto como enviado', async () => {
  let aceitos = 0;

  await assert.rejects(
    () => send.deliverPrompt({
      request: PEDIDO,
      connect() { throw Error('não deu para iniciar o Pi (ENOENT)'); },
      onAccepted() { aceitos += 1; },
    }),
    /não deu para iniciar o Pi/,
  );

  assert.equal(aceitos, 0);
});

test('escrita que falha é incerta: o erro diz que pode ter chegado e o contexto não conta como enviado', async () => {
  let aceitos = 0;
  const bridge = fakeBridge({failAt: 'prompt', motivo: 'timeout ao escrever no stdin'});

  const erro = await send.deliverPrompt({request: PEDIDO, connect: () => bridge, onAccepted() { aceitos += 1; }})
    .then(() => assert.fail('devia rejeitar'), (error) => error);

  assert.match(ptText(erro.message), /O tutor não confirmou a mensagem \(timeout ao escrever no stdin\)/, 'o motivo do Pi vai junto: sem ele não se sabe o que pedir ao usuário');
  assert.match(ptText(erro.message), /pode ter sido recebida/);
  assert.notEqual(erro.notSent, true, 'incerta não é recusa: a fila não pode repetir sozinha');
  assert.equal(aceitos, 0, 'entrega incerta NÃO atualiza o contexto do turno');
  assert.deepEqual(bridge.seen.map((s) => s.method), ['prompt'], 'sem get_state depois de um envio incerto');
});

test('recusa comprovada (o bridge prova que nada foi escrito) vira notSent e não promete entrega', async () => {
  let aceitos = 0;
  const bridge = fakeBridge({failAt: 'prompt', motivo: 'stdin fechado', notSent: true});

  const erro = await send.deliverPrompt({request: PEDIDO, connect: () => bridge, onAccepted() { aceitos += 1; }})
    .then(() => assert.fail('devia rejeitar'), (error) => error);

  assert.equal(erro.notSent, true, 'é a marca que deixa o renderer repetir o item');
  assert.match(ptText(erro.message), /Nada foi enviado ao tutor: stdin fechado/);
  assert.equal(aceitos, 0);
});

test('Pi ausente com a ponte de verdade é recusa, não entrega ambígua', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'mesa-send-'));
  try {
    const {PiBridge} = require('../rpc.cjs');
    const bridge = new PiBridge({cwd: dir, session: join(dir, 'sessao.jsonl'), pi: ''});

    const erro = await send.deliverPrompt({request: PEDIDO, connect: () => bridge})
      .then(() => assert.fail('devia rejeitar'), (error) => error);

    assert.match(ptText(erro.message), /Nada foi enviado ao tutor/);
    assert.equal(erro.notSent, true);
    assert.equal(bridge.child, undefined, 'nenhum processo do Pi chegou a existir');
  } finally {
    rmSync(dir, {recursive: true, force: true});
  }
});

test('aceite confirmado: só então o contexto conta como entregue, e o estado vem depois', async () => {
  let aceitos = 0;
  const bridge = fakeBridge();

  const out = await send.deliverPrompt({request: PEDIDO, connect: () => bridge, onAccepted() { aceitos += 1; }});

  assert.deepEqual(out, {streaming: false}, 'o estado da sessão volta para o renderer');
  assert.equal(aceitos, 1, 'confirmado uma vez, e só depois do aceite');
  assert.deepEqual(bridge.seen.map((s) => s.method), ['prompt', 'get_state'], 'primeiro escreve, depois lê o estado');
});

test('aceite seguido de falha ao ler o estado: a entrega vale, o envio NÃO é erro e o aviso diz o que faltou ler', async () => {
  let aceitos = 0;
  const avisos = [];
  const bridge = fakeBridge({failAt: 'get_state', motivo: 'RPC caiu'});

  const out = await send.deliverPrompt({
    request: PEDIDO,
    connect: () => bridge,
    onAccepted() { aceitos += 1; },
    onWarning: (aviso) => avisos.push(aviso),
  });

  /* Resolver — e não rejeitar — é o que separa "não entreguei" de "entreguei e
     não consegui ler o estado": o renderer conta o envio como feito, o item sai
     da fila e a mesma mensagem não é reenviada. */
  assert.equal(out.streaming, undefined, 'o estado fica DESCONHECIDO: nem "não está no turno" nem "está"');
  assert.match(ptText(out.warning), /entregue ao tutor, mas o estado da sessão não pôde ser lido \(RPC caiu\)/);
  assert.deepEqual(avisos, [out.warning], 'o aviso também passa pelo callback (o host loga o mesmo texto)');
  assert.equal(aceitos, 1, 'o aceite já tinha acontecido');
  assert.deepEqual(bridge.seen.map((s) => s.method), ['prompt', 'get_state'], 'sem reenvio do prompt');
});

test('o host do envio liga o aceite do ciclo ao contexto do turno e o main não guarda nada do bilhete', () => {
  /* O pi-prompt saiu do main para tutor-prompt-host.cjs na #43 fase 2. */
  const prompt = readFileSync(join(deskDir, 'tutor-prompt-host.cjs'), 'utf8');
  assert.match(prompt, /return deliverPrompt\(\{/);
  assert.match(prompt, /onAccepted\(\)\{live\.lastContextKey=block\.key;/, 'o aceite atualiza o contexto do turno');
  const hosts = readdirSync(deskDir).filter((name) => name === 'main.cjs' || /(-host|-ipc)\.cjs$/.test(name));
  for (const name of hosts) {
    assert.doesNotMatch(readFileSync(join(deskDir, name), 'utf8'), /handoff|bilhete/i, `${name}: o recebimento do bilhete saiu do main (#50)`);
  }
});
