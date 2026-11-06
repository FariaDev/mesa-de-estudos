/* Prova E — Parar com o envio preso antes do token (connect/controles/_slash).
   O token de entrega só nasce em `adapter.send`; se o Parar chega antes, o
   `cancel()` do adaptador não tem tokens nem turno e não emite `turn_end`.
   O `_prompt` do serviço ficava pendurado no `connect()` até ele resolver —
   a interface (stage 'prompt', sem `setBusy(false)` no `desk-stop`) mostrava o
   spinner até o connect travado terminar.

   Esperado: o Parar acorda o `_prompt` preso e ele desiste em <500 ms, sem
   esperar o connect; nada é enviado.
   Atual (vermelho): o `_prompt` segue pendente com o connect fechado.

   Rodar: node --test desk/tests/prompt-abort-connect.test.mjs */
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
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test('Parar acorda o prompt preso no connect sem esperar ele resolver', async () => {
  const stub = stubAdapter();
  const service = new NativeService({adapter: stub.adapter, engine: 'opencode'});
  const first = service.request('prompt', {message: 'fala presa', attemptId: 'A'});
  first.catch(() => {});
  await tick();
  const started = Date.now();
  await service.request('abort', {attemptId: 'A'});
  const outcome = await Promise.race([
    first.then(() => 'resolved', () => 'rejected'),
    sleep(500).then(() => 'pending'),
  ]);
  assert.ok(Date.now() - started < 1000, 'o Parar não pode ficar preso no connect');
  assert.equal(outcome, 'rejected', 'o prompt preso devia desistir sem o connect resolver');
  stub.releaseConnect();
  await Promise.allSettled([first]);
  await tick();
  assert.deepEqual(stub.sent, [], 'nada do envio parado pode sair depois');
});
