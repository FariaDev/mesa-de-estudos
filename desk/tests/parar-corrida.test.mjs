/* PROVA — corrida do Parar: o envio cancelado passa quando um envio NOVO limpa
   `_abortRequested` antes do connect do antigo resolver.

   Cenário (alcançável: "Enviar agora" da fila / resultado de cartão mandam um
   2º envio enquanto o 1º ainda está no `adapter.connect()` do serviço, depois
   do Parar):
     1. prompt A (attemptId 'A') entra em `_prompt` e trava no `adapter.connect()`.
     2. Parar chega como `abort {attemptId:'A'}` → marca `_abortRequested`,
        libera `_sending` e NÃO cancela token nenhum (A ainda não registrou).
     3. prompt B (attemptId 'B') começa: `_prompt` limpa `_abortRequested`.
     4. o connect resolve: A devia desistir, mas a marca foi apagada por B.

   Esperado: `adapter.send` só recebe 'fala nova'.
   Atual (vermelho): `adapter.send` também recebe 'fala cancelada' — o tutor
   responde uma mensagem que o aluno parou.

   Rodar: node --test desk/tests/parar-corrida.test.mjs */
import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {NativeService} = require('../src/agents/service.cjs');

function stubAdapter() {
  let releaseConnect;
  const connectGate = new Promise((resolve) => { releaseConnect = resolve; });
  const sent = [];
  class Stub extends EventEmitter {
    async connect() { return connectGate; }
    async initializeControls() { return {}; }
    snapshot() { return {busy: false, compacting: false}; }
    async send(input) { sent.push(input.text); return {id: input.id, accepted: true}; }
    async cancel() { return {aborted: false}; }
    cacheHistory() {}
    stop() {}
  }
  return {sent, releaseConnect, adapter: new Stub()};
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 20));

test('Parar + envio seguinte não deixa o envio antigo sair depois do connect', async () => {
  const stub = stubAdapter();
  const service = new NativeService({adapter: stub.adapter, engine: 'opencode'});
  const first = service.request('prompt', {message: 'fala cancelada', attemptId: 'A'});
  first.catch(() => {});
  await tick(); // _prompt A pendurado em adapter.connect()
  await service.request('abort', {attemptId: 'A'});
  const second = service.request('prompt', {message: 'fala nova', attemptId: 'B'});
  second.catch(() => {});
  await tick(); // _prompt B também pendurado, e já limpou _abortRequested
  stub.releaseConnect();
  await Promise.allSettled([first, second]);
  await tick();
  assert.deepEqual(stub.sent, ['fala nova'],
    `o Parar não valeu: o serviço mandou ${JSON.stringify(stub.sent)} (o envio cancelado saiu junto)`);
});

test('sem envio seguinte, o Parar sozinho cancela o prompt preso no connect', async () => {
  const stub = stubAdapter();
  const service = new NativeService({adapter: stub.adapter, engine: 'opencode'});
  const first = service.request('prompt', {message: 'fala cancelada', attemptId: 'A'});
  await tick();
  await service.request('abort', {attemptId: 'A'});
  stub.releaseConnect();
  await assert.rejects(first, (error) => error.cancelled === true);
  assert.deepEqual(stub.sent, [], 'nada deveria sair');
});
