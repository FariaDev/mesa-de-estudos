/* PROVA — o `finally` do abort derruba a vaga de um envio NOVO que começou
   durante o interrupt.

   Cenário concreto: turno em voo; o aluno clica Parar e, na mesma janela do
   interrupt (até 500 ms, `CANCEL_INTERRUPT_TIMEOUT_MS`), manda outra mensagem
   ("Enviar agora" da fila, que é steer com o tutor ocupado — `canSteerQueued`).
   O 2º envio entra como steer (não passa pelo `canBegin`) e fica em voo.
   Quando o interrupt responde, o `finally` do `abort` faz `_sending=false` e
   `_sendSeq+=1` SEM saber que há um envio novo: a vaga de "ocupado" some.
   Um 3º envio passa no `canBegin` e os DOIS prompts saem juntos.

   Esperado: enquanto o envio B está em voo, o C é recusado como ocupado.
   Atual (vermelho): o C passa e `adapter.send` recebe B e C.

   Rodar: node --test desk/tests/abort-vaga.test.mjs */
import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {NativeService} = require('../src/agents/service.cjs');

function stubAdapter() {
  const sent = [];
  let busy = false;
  let releaseInterrupt;
  let releaseSend;
  const interruptGate = new Promise((resolve) => { releaseInterrupt = resolve; });
  const sendGate = new Promise((resolve) => { releaseSend = resolve; });
  class Stub extends EventEmitter {
    async connect() {}
    snapshot() { return {busy, compacting: false}; }
    async send(input) {
      sent.push(input.text);
      if (input.text === 'B') { await sendGate; } // B fica em voo (admissão lenta)
      busy = true;
      return {id: input.id, accepted: true};
    }
    /* Modelo do cancel real: interrupt lento com o turno ainda aberto; quando
       responde, `settleTurn` fecha o turno e o `finally` do abort roda. */
    async cancel() {
      await interruptGate;
      busy = false;
      this.emit('event', {type: 'turn_end', cancelled: true});
      return {aborted: true};
    }
    cacheHistory() {}
    stop() {}
  }
  return {sent, adapter: new Stub(), openTurn() { busy = true; }, releaseInterrupt, releaseSend};
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 20));

test('o abort não libera a vaga de um envio novo em voo (dois prompts nunca em paralelo)', async () => {
  const stub = stubAdapter();
  const service = new NativeService({adapter: stub.adapter, engine: 'opencode'});
  stub.openTurn(); // turno A em voo (já aceito; o _prompt dele já terminou)
  const aborting = service.request('abort', {attemptId: 'A'});
  await tick(); // abort preso no interrupt
  const b = service.request('prompt', {message: 'B', attemptId: 'B', streamingBehavior: 'steer'});
  b.catch(() => {});
  await tick(); // B em voo (steer aceito pelo canSteer), _sending=true
  stub.releaseInterrupt(); // interrupt responde → settleTurn → finally do abort
  await aborting;
  await tick();
  let cRefused = null;
  try {
    await service.request('prompt', {message: 'C', attemptId: 'C'});
  } catch (error) {
    cRefused = error;
  }
  stub.releaseSend();
  await Promise.allSettled([b]);
  await tick();
  assert.ok(cRefused, `o C passou enquanto o B estava em voo: saíram ${JSON.stringify(stub.sent)}`);
  assert.deepEqual(stub.sent, ['B'], `só o B deveria sair; mandaram ${JSON.stringify(stub.sent)}`);
});
