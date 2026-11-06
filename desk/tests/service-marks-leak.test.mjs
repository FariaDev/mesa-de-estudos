/* Review r5-A: toda marca de Parar por attemptId fica no Set até um `_prompt`
   com o MESMO id chegar. O renderer manda o id no Parar também quando o envio
   nunca chega ao serviço (Parar no "save" antes do pi-prompt; Parar logo depois
   do aceite, quando o _prompt já consumiu a marca). Essas marcas não têm quem
   as consuma e crescem pela sessão inteira. A marca não pode só valer para
   envio já em voo: o Parar entre o pi-prompt e o `_prompt` (connect e contexto
   no main) só chega como marca prévia (opencode-cancel). Então o conjunto é
   limitado às marcas mais recentes. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {NativeService} = require('../src/agents/service.cjs');

function stub() {
  const sent = [];
  class Stub extends EventEmitter {
    async connect() {}
    async initializeControls() { return {}; }
    snapshot() { return {busy: false, compacting: false}; }
    async send(input) { sent.push(input.text); return {id: input.id, accepted: true}; }
    async cancel() { return {aborted: false}; }
    cacheHistory() {}
    stop() {}
  }
  return {sent, adapter: new Stub()};
}

test('Parar de um envio que nunca chega ao _prompt deixa marca para sempre', async () => {
  const s = stub();
  const service = new NativeService({adapter: s.adapter, engine: 'opencode'});
  for (let i = 0; i < 500; i++) await service.request('abort', {attemptId: `envio-que-nao-chegou-${i}`});
  assert.ok(service._cancelledAttempts.size <= 8,
    `o Set de marcas de Parar cresceu sem limite: ${service._cancelledAttempts.size} entradas na sessão`);
});

test('a marca mais recente sobrevive ao teto e cancela o prompt que chega depois', async () => {
  const s = stub();
  const service = new NativeService({adapter: s.adapter, engine: 'opencode'});
  for (let i = 0; i < 50; i++) await service.request('abort', {attemptId: `velho-${i}`});
  await service.request('abort', {attemptId: 'atual'});
  await assert.rejects(service.request('prompt', {message: 'oi', attemptId: 'atual'}));
  assert.deepEqual(s.sent, [], 'o prompt parado antes de chegar não sai');
});

test('Parar logo depois do aceite marca um attemptId que o _prompt já consumiu', async () => {
  const s = stub();
  const service = new NativeService({adapter: s.adapter, engine: 'opencode'});
  await service.request('prompt', {message: 'oi', attemptId: 'A'});
  /* S.sendAttemptId ainda vale A até o finally do chat; o Parar do botão leva A
     quando o aceite chegou mas o renderer ainda não limpou. */
  await service.request('abort', {attemptId: 'A'});
  for (let i = 0; i < 20; i++) await service.request('abort', {attemptId: 'A'});
  assert.ok(service._cancelledAttempts.size <= 1,
    `Parar repetido do mesmo envio ocupa uma marca só: ${[...service._cancelledAttempts]}`);
});
