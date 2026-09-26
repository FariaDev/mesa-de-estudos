/* Ciclo de envio de um prompt: o que conta como entregue (desk/send.cjs).
 *
 * Um bridge de mentira que falha onde o teste manda: validação de anexo,
 * conexão, escrita e `get_state`. O bilhete, esse, é de verdade: os testes usam
 * `claimForDelivery`/`recoverClaims` sobre um runtime temporário, então o que se
 * prova aqui é o comportamento do mesmo código que o app roda, não a ordem das
 * linhas do main.
 *
 * Onde termina a simulação: o provider real não é chamado. `connect` e
 * `bridge.request` são as fronteiras com o Pi, e é exatamente nelas que os
 * cenários de falha precisam acontecer. A queda no meio do envio é de um
 * processo de verdade (`SIGKILL` num filho que roda o mesmo `deliverPrompt` com
 * o mesmo disco), não de Electron nem do Pi do usuário.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const desk = require('../handoff.cjs');
const send = require('../send.cjs');
const deskDir = dirname(dirname(fileURLToPath(import.meta.url)));

const NOW = Date.UTC(2026, 8, 23, 12, 0, 0);

/* O runtime temporário só pode sumir quando o corpo terminar — inclusive
   quando ele é assíncrono (um `finally` sem esperar apagaria o runtime no meio
   do teste e todo mundo veria ENOENT). */
async function withRuntime(fn) {
  const runtime = mkdtempSync(join(tmpdir(), 'mesa-send-'));
  try {
    return await fn(runtime);
  } finally {
    rmSync(runtime, {recursive: true, force: true});
  }
}

function writePending(runtime, {goal = 'revisar limites', question = '', refs = [], createdAt = NOW} = {}) {
  mkdirSync(desk.handoffDir(runtime), {recursive: true});
  writeFileSync(desk.pendentePath(runtime), JSON.stringify({v: 1, from: 'conversa', createdAt, goal, question, refs}, null, 2) + '\n');
}

/* Só a ausência de diretório vira lista vazia: um erro de verdade (chamada
   errada, permissão) tem de estourar, senão uma asserção de "nenhum arquivo"
   passa sem nunca ter lido o diretório. */
function names(runtime, dir) {
  try {
    return readdirSync(dir(runtime));
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
}

/* Bridge de mentira: registra a ordem das chamadas e falha no método pedido. */
function fakeBridge({failAt = '', motivo = 'falha de propósito'} = {}) {
  const seen = [];
  return {
    seen,
    request: async (method, params) => {
      seen.push({method, params});
      if (failAt === method) throw Error(motivo);
      if (method === 'get_state') return {isStreaming: false};
      return {};
    },
  };
}

/* O que o app monta por turno: a mensagem do usuário e, grudado nela, o bloco
   do bilhete. Aqui é montado do mesmo jeito, com o bloco que o disco devolveu. */
function pedidoCom(bilhete) {
  return {message: 'segue o exercício 3' + (bilhete?.block ? '\n\n' + bilhete.block : ''), streamingBehavior: 'followUp'};
}

/* ---------- antes de qualquer escrita ---------- */

test('anexo inválido não chega a conectar nem a escrever, e o bilhete não sai do lugar', async () => {
  await withRuntime(async (runtime) => {
    writePending(runtime);
    const {claim} = desk.claimForDelivery({runtime, now: NOW});
    let aceitos = 0;
    let conectou = false;
    const avisos = [];
    const bridge = fakeBridge();

    await assert.rejects(
      () => send.deliverPrompt({
        request: pedidoCom(claim),
        images: [{dataUrl: 'data:image/png;base64,AAAA'}],
        validateImages() { throw Error('Anexo grande demais: reduza a captura.'); },
        claim,
        runtime,
        connect() { conectou = true; return bridge; },
        onAccepted() { aceitos += 1; },
        onDelivered: (a) => avisos.push(a),
        onAmbiguous: (a) => avisos.push(a),
      }),
      /Anexo grande demais/,
      'o motivo da validação chega ao usuário como veio',
    );

    assert.equal(conectou, false, 'com anexo inválido nem tenta abrir o Pi');
    assert.deepEqual(bridge.seen, [], 'nada foi escrito');
    assert.equal(aceitos, 0, 'o contexto do turno não conta como enviado');
    assert.deepEqual(avisos, [], 'não há aviso de entrega para algo que não foi entregue');
    assert.ok(existsSync(claim.path), 'o bilhete segue reivindicado, e é o mesmo arquivo');
    assert.ok(!existsSync(desk.archiveDir(runtime)), 'nada foi arquivado');
  });
});

test('conexão que falha não escreve nem entrega: a próxima abertura devolve o bilhete à fila', async () => {
  await withRuntime(async (runtime) => {
    writePending(runtime);
    const {claim} = desk.claimForDelivery({runtime, now: NOW});
    let aceitos = 0;

    await assert.rejects(
      () => send.deliverPrompt({
        request: pedidoCom(claim),
        claim,
        runtime,
        connect() { throw Error('não deu para iniciar o Pi (ENOENT)'); },
        onAccepted() { aceitos += 1; },
      }),
      /não deu para iniciar o Pi/,
    );

    assert.equal(aceitos, 0);
    assert.ok(existsSync(claim.path), 'o bilhete continua reivindicado: nada foi entregue');
    const recovery = desk.recoverClaims({runtime});
    assert.equal(recovery.requeued, 1, 'reiniciar devolve à fila');
    assert.equal(desk.readHandoff({runtime, now: NOW}).bilhete.goal, 'revisar limites', 'e é o mesmo bilhete');
  });
});

test('se a fase "envio iniciado" não puder ser persistida, nada é escrito no Pi', async () => {
  await withRuntime(async (runtime) => {
    writePending(runtime);
    const {claim} = desk.claimForDelivery({runtime, now: NOW});
    const bridge = fakeBridge();
    let aceitos = 0;
    /* A transição para `enviando-*` falha de verdade: a pasta do bilhete fica
       sem permissão de escrita depois da reivindicação (disco cheio, pasta
       read-only). Sem a marca, o envio não pode começar — é a única forma de
       garantir que uma queda no meio não devolva o bilhete à fila. */
    chmodSync(desk.handoffDir(runtime), 0o500);
    try {
      await assert.rejects(
        () => send.deliverPrompt({
          request: pedidoCom(claim),
          claim,
          runtime,
          connect: () => bridge,
          onAccepted() { aceitos += 1; },
        }),
        /nada foi enviado ao Pi/,
        'a falha diz que nada saiu, em vez de parecer um envio',
      );
    } finally {
      chmodSync(desk.handoffDir(runtime), 0o700);
    }

    assert.deepEqual(bridge.seen, [], 'a falta da marca impede a escrita, não só a entristece');
    assert.equal(aceitos, 0, 'nada foi entregue');
    assert.ok(existsSync(claim.path), 'o bilhete continua reivindicado, com o envio por começar');
    assert.equal(desk.recoverClaims({runtime, now: NOW}).requeued, 1, 'e a próxima abertura pode tentar de novo');
    assert.equal(desk.readHandoff({runtime, now: NOW}).bilhete.goal, 'revisar limites');
  });
});

/* ---------- depois de tentar escrever ---------- */

test('escrita que falha é incerta: vai para dúvida, o app solta o bilhete e o contexto não conta como enviado', async () => {
  await withRuntime(async (runtime) => {
    writePending(runtime);
    const {claim} = desk.claimForDelivery({runtime, now: NOW});
    let aceitos = 0;
    const ambiguos = [];
    const bridge = fakeBridge({failAt: 'prompt', motivo: 'timeout ao escrever no stdin'});

    await assert.rejects(
      () => send.deliverPrompt({
        request: pedidoCom(claim),
        claim,
        runtime,
        connect: () => bridge,
        onAccepted() { aceitos += 1; },
        onAmbiguous: (a) => ambiguos.push(a),
      }),
      /O Pi não confirmou a mensagem \(timeout ao escrever no stdin\)/,
      'o motivo do Pi vai junto: sem ele não se sabe o que pedir ao usuário',
    );

    assert.equal(aceitos, 0, 'entrega incerta NÃO atualiza o contexto do turno');
    assert.equal(ambiguos.length, 1, 'e o usuário é avisado de que pode ter chegado');
    assert.match(ambiguos[0], /dúvida/);
    assert.equal(names(runtime, desk.doubtDir).length, 1, 'o bilhete fica guardado em dúvida');
    assert.equal(names(runtime, desk.archiveDir).length, 0, 'não é arquivado como se tivesse sido entregue');
    assert.equal(desk.readHandoff({runtime, now: NOW}).reason, 'ausente', 'e não volta para a fila');
    const [guardado] = names(runtime, desk.doubtDir);
    assert.match(readFileSync(join(desk.doubtDir(runtime), guardado), 'utf8'), /revisar limites/, 'o conteúdo fica preservado');
    assert.equal(desk.recoverClaims({runtime}).requeued, 0, 'reiniciar não repete contexto que talvez já esteja na conversa');
  });
});

test('recusa comprovada (o bridge prova que nada foi escrito) não vira dúvida e o bilhete volta na próxima abertura', async () => {
  await withRuntime(async (runtime) => {
    writePending(runtime);
    const {claim} = desk.claimForDelivery({runtime, now: NOW});
    let aceitos = 0;
    const recusas = [];
    const ambiguos = [];
    const vistos = [];
    /* Contrato do bridge: `notSent` é a prova de que o pedido não foi entregue
       ao stdin. Sem essa marca, o mesmo erro seria tratado como incerteza. */
    const bridge = {
      async request(method) {
        vistos.push(method);
        const erro = Error('nada foi enviado: o Pi não aceitou a escrita (ENOENT).');
        erro.notSent = true;
        throw erro;
      },
    };

    await assert.rejects(
      () => send.deliverPrompt({
        request: pedidoCom(claim),
        claim,
        runtime,
        connect: () => bridge,
        onAccepted() { aceitos += 1; },
        onAmbiguous: (a) => ambiguos.push(a),
        onRefused: (a) => recusas.push(a),
      }),
      /Nada foi enviado ao Pi: .*ENOENT/,
      'a mensagem diz que nada foi enviado, não que pode ter chegado',
    );

    assert.equal(aceitos, 0, 'o contexto do turno não conta como enviado');
    assert.equal(ambiguos.length, 0, 'recusa comprovada não é tratada como incerteza');
    assert.equal(recusas.length, 1, 'o usuário é avisado de que nada saiu');
    assert.match(recusas[0], /continua na fila/);
    assert.deepEqual(vistos, ['prompt'], 'não tenta ler o estado depois de recusar');
    assert.equal(names(runtime, desk.doubtDir).length, 0, 'nada vai para dúvida sem transmissão');
    assert.equal(names(runtime, desk.archiveDir).length, 0, 'nem para o arquivo');
    assert.equal(names(runtime, desk.handoffDir).filter((n) => n.startsWith(desk.SENDING_PREFIX)).length, 0, 'a marca de envio iniciado é desfeita');
    assert.equal(names(runtime, desk.handoffDir).filter((n) => n.startsWith(desk.CLAIM_PREFIX)).length, 1, 'o arquivo volta a reivindicado');
    const recovery = desk.recoverClaims({runtime, now: NOW});
    assert.equal(recovery.requeued, 1, 'a próxima abertura devolve o bilhete à fila');
    assert.equal(recovery.doubtful, 0, 'sem linha em dúvida e sem repetir contexto que nunca foi enviado');
    assert.equal(desk.readHandoff({runtime, now: NOW}).bilhete.goal, 'revisar limites', 'o conteúdo é o mesmo');
  });
});

test('recusa comprovada: a tentativa seguinte entrega o mesmo bilhete, sem reiniciar o app', async () => {
  await withRuntime(async (runtime) => {
    writePending(runtime);
    /* A mão (claimHand, no main.cjs) guarda ESTE objeto entre tentativas. A
       recusa devolve o arquivo à fase reivindicada com NOME NOVO: se o caminho
       guardado não acompanhar a fase, a retentativa morre antes de escrever
       ("não deu para marcar o envio") e o bilhete fica na mão para sempre. */
    const hand = desk.claimHand({runtime, now: NOW});
    const bilhete = hand.take().claim;
    const recusa = {
      async request() {
        const erro = Error('nada foi enviado: o Pi não aceitou a escrita (ENOENT).');
        erro.notSent = true;
        throw erro;
      },
    };
    const recusas = [];
    await assert.rejects(
      () => send.deliverPrompt({
        request: pedidoCom(bilhete),
        claim: bilhete,
        runtime,
        connect: () => recusa,
        onRefused: (a) => recusas.push(a),
      }),
      /Nada foi enviado ao Pi/,
    );
    assert.equal(recusas.length, 1);
    assert.ok(bilhete.path.includes(desk.CLAIM_PREFIX), 'a mão guarda o arquivo na fase que pode repetir');
    assert.ok(existsSync(bilhete.path), 'e o arquivo está mesmo lá');

    const bridge = fakeBridge();
    let aceitos = 0;
    await send.deliverPrompt({
      request: pedidoCom(hand.take().claim),
      claim: hand.take().claim,
      runtime,
      connect: () => bridge,
      onAccepted() {
        aceitos += 1;
        hand.release();
      },
    });

    assert.equal(aceitos, 1, 'a retentativa entrega sem reiniciar o app');
    assert.match(bridge.seen[0].params.message, /revisar limites/, 'o bilhete vai junto de novo');
    assert.match(bridge.seen[0].params.message, /segue o exercício 3/, 'e o contexto da mensagem também');
    assert.equal(names(runtime, desk.archiveDir).length, 1, 'a entrega arquiva o bilhete');
    assert.equal(names(runtime, desk.doubtDir).length, 0, 'nada em dúvida: a primeira tentativa não escreveu');
    assert.equal(hand.take().claim, null, 'a mão solta depois do aceite');
  });
});

test('Pi ausente com a ponte de verdade é recusa, não entrega ambígua', async () => {
  await withRuntime(async (runtime) => {
    writePending(runtime);
    const {claim} = desk.claimForDelivery({runtime, now: NOW});
    const {PiBridge} = require('../rpc.cjs');
    const bridge = new PiBridge({cwd: runtime, session: join(runtime, 'sessao.jsonl'), pi: ''});
    const recusas = [];
    const ambiguos = [];

    await assert.rejects(
      () => send.deliverPrompt({
        request: pedidoCom(claim),
        claim,
        runtime,
        connect: () => bridge,
        onRefused: (a) => recusas.push(a),
        onAmbiguous: (a) => ambiguos.push(a),
      }),
      /Nada foi enviado ao Pi/,
    );

    assert.equal(bridge.child, undefined, 'nenhum processo do Pi chegou a existir');
    assert.equal(recusas.length, 1, 'a falha sem escrita é recusa');
    assert.equal(ambiguos.length, 0, 'e não promete dúvida que não houve');
    assert.equal(names(runtime, desk.doubtDir).length, 0, 'o bilhete não é dado como possivelmente entregue');
    assert.equal(names(runtime, desk.archiveDir).length, 0, 'nada é arquivado sem entrega');
    assert.equal(desk.recoverClaims({runtime, now: NOW}).requeued, 1, 'e a próxima abertura tenta de novo');
  });
});

test('aceite confirmado: só então o contexto e o bilhete contam como entregues, e o estado vem depois', async () => {
  await withRuntime(async (runtime) => {
    writePending(runtime);
    const {claim} = desk.claimForDelivery({runtime, now: NOW});
    let aceitos = 0;
    const avisos = [];
    const bridge = fakeBridge();

    const out = await send.deliverPrompt({
      request: pedidoCom(claim),
      claim,
      runtime,
      connect: () => bridge,
      onAccepted() { aceitos += 1; },
      onDelivered: (a) => avisos.push(a),
      onAmbiguous: (a) => avisos.push(a),
    });

    assert.deepEqual(out, {streaming: false}, 'o estado da sessão volta para o renderer');
    assert.equal(aceitos, 1, 'confirmado uma vez, e só depois do aceite');
    assert.deepEqual(avisos, [], 'entrega limpa não gera aviso');
    assert.deepEqual(bridge.seen.map((s) => s.method), ['prompt', 'get_state'], 'primeiro escreve, depois lê o estado');
    assert.equal(names(runtime, desk.archiveDir).length, 1, 'o bilhete foi arquivado');
    assert.equal(names(runtime, desk.handoffDir).filter((n) => n.startsWith(desk.CLAIM_PREFIX)).length, 0, 'e não ficou reivindicado');
    assert.equal(desk.readHandoff({runtime, now: NOW}).reason, 'ausente');
  });
});

test('nova tentativa depois da falha leva de novo o mesmo bilhete e o contexto', async () => {
  await withRuntime(async (runtime) => {
    writePending(runtime);
    const primeira = desk.claimForDelivery({runtime, now: NOW});
    await assert.rejects(
      () => send.deliverPrompt({
        request: pedidoCom(primeira.claim),
        claim: primeira.claim,
        runtime,
        connect() { throw Error('Pi fora do ar'); },
        onAccepted() { throw Error('não podia ter sido aceito'); },
      }),
      /fora do ar/,
    );

    /* A retomada da abertura devolve o bilhete à fila; a próxima tentativa o
       reivindica de novo, com o contexto da mensagem intacto. */
    assert.equal(desk.recoverClaims({runtime}).requeued, 1);
    const segunda = desk.claimForDelivery({runtime, now: NOW});
    assert.equal(segunda.claim.bilhete.goal, 'revisar limites');
    let aceitos = 0;
    const bridge = fakeBridge();
    await send.deliverPrompt({
      request: pedidoCom(segunda.claim),
      claim: segunda.claim,
      runtime,
      connect: () => bridge,
      onAccepted() { aceitos += 1; },
    });

    assert.equal(aceitos, 1);
    const enviado = bridge.seen[0].params.message;
    assert.match(enviado, /segue o exercício 3/, 'o contexto do turno continua junto');
    assert.match(enviado, /revisar limites/, 'e o bilhete também');
    assert.equal(names(runtime, desk.archiveDir).length, 1, 'a segunda tentativa entrega e arquiva');
  });
});

/* ---------- depois do aceite ---------- */

test('aceite seguido de falha ao ler o estado: a entrega vale, o envio NÃO é erro e o aviso diz o que faltou ler', async () => {
  await withRuntime(async (runtime) => {
    writePending(runtime);
    const {claim} = desk.claimForDelivery({runtime, now: NOW});
    let aceitos = 0;
    const avisos = [];
    const bridge = fakeBridge({failAt: 'get_state', motivo: 'RPC caiu'});

    const out = await send.deliverPrompt({
      request: pedidoCom(claim),
      claim,
      runtime,
      connect: () => bridge,
      onAccepted() { aceitos += 1; },
      onWarning: (a) => avisos.push(a),
    });

    /* Resolver — e não rejeitar — é o que separa "não entreguei" de "entreguei e
       não consegui ler o estado": o renderer conta o envio como feito, o item sai
       da fila e a mesma mensagem não é reenviada. */
    assert.equal(out.streaming, undefined, 'o estado fica DESCONHECIDO: nem "não está no turno" nem "está"');
    assert.match(out.warning, /entregue ao Pi, mas o estado da sessão não pôde ser lido \(RPC caiu\)/);
    assert.deepEqual(avisos, [out.warning], 'o aviso também passa pelo callback (o host loga o mesmo texto)');
    assert.equal(aceitos, 1, 'o aceite já tinha acontecido');
    assert.deepEqual(bridge.seen.map((s) => s.method), ['prompt', 'get_state'], 'sem reenvio do prompt');
    assert.equal(names(runtime, desk.archiveDir).length, 1, 'o bilhete fica arquivado: não há reentrega');
    assert.equal(names(runtime, desk.handoffDir).filter((n) => n.startsWith(desk.SENDING_PREFIX)).length, 0, 'e a fase de envio foi fechada, não ficou pela metade');
    assert.equal(desk.recoverClaims({runtime}).requeued, 0, 'nada volta para a fila por causa do get_state');
    const [arquivado] = names(runtime, desk.archiveDir);
    assert.match(readFileSync(join(desk.archiveDir(runtime), arquivado), 'utf8'), /revisar limites/);
  });
});

test('aceite com arquivamento quebrado: a entrega vale, o arquivo fica preservado e o aviso não promete o que não houve', async () => {
  await withRuntime(async (runtime) => {
    writePending(runtime);
    const {claim} = desk.claimForDelivery({runtime, now: NOW});
    mkdirSync(desk.handoffDir(runtime), {recursive: true});
    writeFileSync(desk.archiveDir(runtime), 'bloqueio');
    let aceitos = 0;
    const avisos = [];

    await send.deliverPrompt({
      request: pedidoCom(claim),
      claim,
      runtime,
      connect: () => fakeBridge(),
      onAccepted() { aceitos += 1; },
      onDelivered: (a) => avisos.push(a),
    });

    assert.equal(aceitos, 1, 'o Pi aceitou: o contexto do turno conta como enviado');
    assert.equal(avisos.length, 1);
    assert.match(avisos[0], /arquivo preservado/, 'o aviso diz que o bilhete ficou, não que sumiu');
    assert.doesNotMatch(avisos[0], /pode ser reenviado/, 'e não ameaça repetir contexto entregue');
    const entregues = names(runtime, desk.handoffDir).filter((n) => n.startsWith(desk.DELIVERED_PREFIX));
    assert.equal(entregues.length, 1, 'ficou marcado como entregue, esperando o arquivamento');
    assert.match(readFileSync(join(desk.handoffDir(runtime), entregues[0]), 'utf8'), /revisar limites/);
  });
});

test('aceite com marcação que falha fica numa fase que nunca volta para a fila', async () => {
  await withRuntime(async (runtime) => {
    writePending(runtime);
    const {claim} = desk.claimForDelivery({runtime, now: NOW});
    let aceitos = 0;
    const avisos = [];
    const bridge = {
      seen: [],
      request: async (method) => {
        bridge.seen.push(method);
        /* O Pi aceita e, nesse instante, a pasta do bilhete perde a escrita: a
           marcação de entregue falha de verdade, depois da entrega. */
        if (method === 'prompt') chmodSync(desk.handoffDir(runtime), 0o500);
        return {isStreaming: false};
      },
    };
    try {
      await send.deliverPrompt({
        request: pedidoCom(claim),
        claim,
        runtime,
        connect: () => bridge,
        onAccepted() { aceitos += 1; },
        onDelivered: (a) => avisos.push(a),
      });
    } finally {
      chmodSync(desk.handoffDir(runtime), 0o700);
    }

    assert.equal(aceitos, 1, 'o aceite aconteceu e conta como entregue');
    assert.equal(avisos.length, 1);
    assert.match(avisos[0], /não será reenviado/, 'o aviso não promete repetir o que já foi entregue');
    assert.doesNotMatch(avisos[0], /pode ser reenviado/, 'nem deixa a impressão de que o reinício devolve à fila');
    const fases = names(runtime, desk.handoffDir);
    assert.equal(fases.filter((n) => n.startsWith(desk.SENDING_PREFIX)).length, 1, 'a marca de envio iniciado fica: é ela que proíbe o reenvio');
    assert.equal(fases.filter((n) => n.startsWith(desk.CLAIM_PREFIX)).length, 0, 'nada volta a significar "o envio não começou"');

    const recovery = desk.recoverClaims({runtime, now: NOW});
    assert.equal(recovery.requeued, 0, 'o reinício não recoloca na fila');
    assert.equal(recovery.doubtful, 1, 'fica em dúvida, para conferência');
    assert.equal(desk.claimForDelivery({runtime, now: NOW}).claim, null, 'nem fica disponível para nova entrega');
    const [guardado] = names(runtime, desk.doubtDir);
    assert.match(readFileSync(join(desk.doubtDir(runtime), guardado), 'utf8'), /revisar limites/, 'e o conteúdo fica preservado');
  });
});

/* ---------- queda no meio do envio (processo de verdade) ---------- */

test('queda entre o recebimento no Pi e a confirmação não devolve o bilhete à fila', async () => {
  await withRuntime(async (runtime) => {
    writePending(runtime);
    /* O filho roda o mesmo `deliverPrompt` sobre o mesmo disco: um receptor
       simulado registra o recebimento e o processo morre com SIGKILL antes de
       qualquer confirmação. Não toca no Electron nem no Pi do usuário. */
    const script = `
const fs = require('node:fs');
const path = require('node:path');
const desk = require(${JSON.stringify(join(deskDir, 'handoff.cjs'))});
const {deliverPrompt} = require(${JSON.stringify(join(deskDir, 'send.cjs'))});
const runtime = ${JSON.stringify(runtime)};
const {claim} = desk.claimForDelivery({runtime});
deliverPrompt({
  request: {message: claim.block, streamingBehavior: 'followUp'},
  claim,
  runtime,
  connect: () => ({request: async () => {
    fs.writeFileSync(path.join(runtime, 'recebido.json'), JSON.stringify({recebido: claim.block}));
    process.kill(process.pid, 'SIGKILL');
  }}),
});
`;
    const env = {...process.env};
    delete env.NODE_TEST_CONTEXT;
    delete env.NODE_OPTIONS;
    const child = spawnSync(process.execPath, ['--input-type=commonjs', '-e', script], {env, encoding: 'utf8', timeout: 30000});

    assert.equal(child.signal, 'SIGKILL', `o filho precisa morrer no meio do envio (status ${child.status}, stderr ${child.stderr || ''})`);
    assert.match(readFileSync(join(runtime, 'recebido.json'), 'utf8'), /revisar limites/, 'o receptor simulado registrou o recebimento');
    assert.equal(names(runtime, desk.handoffDir).filter((n) => n.startsWith(desk.SENDING_PREFIX)).length, 1, 'o envio já estava marcado como iniciado no disco');

    const recovery = desk.recoverClaims({runtime, now: NOW});
    assert.equal(recovery.requeued, 0, 'o mesmo bilhete NÃO volta para a fila');
    assert.equal(recovery.doubtful, 1, 'envio iniciado sem confirmação fica em dúvida');
    assert.equal(desk.claimForDelivery({runtime, now: NOW}).claim, null, 'e não fica disponível para nova entrega');
    assert.equal(desk.readHandoff({runtime, now: NOW}).reason, 'ausente', 'a fila fica vazia');
    const [guardado] = names(runtime, desk.doubtDir);
    assert.match(readFileSync(join(desk.doubtDir(runtime), guardado), 'utf8'), /revisar limites/, 'o conteúdo fica preservado para conferência');
  });
});

/* ---------- ligação com o app ---------- */

/* Isto é ligação, não comportamento: garante que o main usa o ciclo extraído em
   vez de reimplementar a decisão. O comportamento está provado acima, contra o
   módulo de verdade. */
test('o main delega o ciclo em vez de refazer a decisão de desfecho', () => {
  const main = readFileSync(join(deskDir, 'main.cjs'), 'utf8');
  assert.match(main, /require\('\.\/send\.cjs'\)/);
  assert.match(main, /return deliverPrompt\(\{/);
  assert.match(main, /onAccepted\(\)\{lastContextKey=block\.key/, 'a confirmação do contexto é o callback do aceite');
  assert.doesNotMatch(main, /outcome = 'ambiguous'|outcome='ambiguous'/, 'a decisão de desfecho não voltou para o main');
  assert.doesNotMatch(main, /settleDelivery\(/, 'nem o destino do bilhete');
  assert.doesNotMatch(main, /motivoDoEnvio/, 'nem o motivo da falha de envio');
  assert.match(main, /claimHand\(\{runtime\}\)/, 'o bilhete fica na mão, um por vez');
  assert.doesNotMatch(main, /handoffChecked|claimHandoffOnce/, 'não voltou a procurar o pendente uma vez por execução');
  assert.match(main, /onAccepted\(\)\{lastContextKey=block\.key;hand\.release\(\)/, 'o aceite solta a mão');
  assert.match(main, /onAmbiguous\(aviso\)\{hand\.release\(\)/, 'a entrega incerta também solta');
});
