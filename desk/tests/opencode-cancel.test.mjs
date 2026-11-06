/* Parar do OpenCode entre o Enviar e o fim do turno (#57, revisão): prompt,
   comando `/`, steer, admissão lenta e aceite tardio. O `serve` é o falso;
   nenhum modelo de verdade. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createFakeOpencodeServe} from './fake-opencode.mjs';
import {parseMessage} from '../src/i18n.mjs';

const require = createRequire(import.meta.url);
const {OpenCodeAdapter} = require('../src/agents/opencode-adapter.cjs');
const {NativeService} = require('../src/agents/service.cjs');

const PASSWORD = 'senha-de-teste';
const fakeReadVersion = async () => 'opencode v2.2.4';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/* Atrasa a CHEGADA de um pedido ao fake (admissão lenta/tardia). O `fetch`
   entra por parâmetro no adaptador, então o servidor só vê o pedido depois. */
function delayedFetch(shouldDelay, delayMs) {
  return async (url, init = {}) => {
    const route = new URL(url).pathname;
    if (init.method === 'POST' && shouldDelay(route, String(init.body || ''))) await sleep(delayMs);
    return fetch(url, init);
  };
}

async function createHarness(t, {serveOptions = {}, delay = null} = {}) {
  const serve = await createFakeOpencodeServe({password: PASSWORD, ...serveOptions});
  const events = [];
  const deliveries = [];
  const adapter = new OpenCodeAdapter({conversationId: 'conv-cancel', sessionId: '', directory: '/tmp/mesa-ws/conv-cancel',
    acquire: async () => ({baseUrl: serve.url, password: PASSWORD, binary: '/fake/opencode'}),
    readVersion: fakeReadVersion, persistDelivery: (patch) => deliveries.push(patch),
    ...(delay ? {fetch: delayedFetch(delay.shouldDelay, delay.delayMs)} : {})});
  adapter.on('event', (event) => events.push(event));
  t.after(() => { adapter.stop(); return serve.close(); });
  return {serve, adapter, events, deliveries};
}

async function waitFor(events, predicate, label, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const found = events.find(predicate);
    if (found) return found;
    await sleep(10);
  }
  throw Error(`evento não chegou: ${label}`);
}

const count = (events, type) => events.filter((event) => event.type === type).length;
const keyOf = (error) => parseMessage(error.message)?.key;

const isCommand = (route) => route.endsWith('/command');
const promptHas = (needle) => (route, body) => route.endsWith('/prompt') && body.includes(needle);

test('Parar antes do aceite de um comando / interrompe o turno que ele abriria', async (t) => {
  const {serve, adapter, events} = await createHarness(t, {
    serveOptions: {turnDelayMs: 60000},
    delay: {shouldDelay: isCommand, delayMs: 400},
  });
  const sending = adapter.command({id: 'c1', name: 'init', text: ''});
  const started = Date.now();
  const stopped = await adapter.cancel();
  assert.ok(Date.now() - started < 1000, `o Parar levou ${Date.now() - started} ms`);
  assert.deepEqual(stopped, {aborted: true});
  assert.deepEqual(await sending, {id: 'c1', accepted: true, cancelled: true});
  await waitFor(events, (event) => event.type === 'turn_end' && event.cancelled === true, 'fim do turno cancelado');
  assert.equal(count(events, 'turn_start'), 0, 'o comando aceito depois do Parar não abre turno na tela');
  assert.equal(adapter.snapshot().busy, false);
  assert.ok(serve.requests.some((item) => item.url.endsWith('/interrupt')), 'o comando em voo foi interrompido');
});

test('aceite tardio depois do Parar não reabre o turno nem duplica o turn_end', async (t) => {
  const {adapter, events, deliveries} = await createHarness(t, {
    serveOptions: {turnDelayMs: 60000},
    delay: {shouldDelay: promptHas('pergunta tardia'), delayMs: 1500},
  });
  const sending = adapter.send({id: 'u-tardia', text: 'pergunta tardia'});
  const started = Date.now();
  const stopped = await adapter.cancel();
  assert.ok(Date.now() - started < 1000, `o Parar levou ${Date.now() - started} ms`);
  assert.deepEqual(stopped, {aborted: true});
  const endsAfterStop = count(events, 'turn_end');
  assert.deepEqual(await sending, {id: 'u-tardia', accepted: true, cancelled: true});
  await sleep(100);
  assert.equal(count(events, 'turn_end'), endsAfterStop, 'nenhum turn_end novo depois do Parar');
  assert.equal(count(events, 'turn_start'), 0, 'o aceite tardio não abre turno');
  assert.equal(adapter.snapshot().busy, false);
  assert.deepEqual(deliveries.map((item) => item.status), ['accepted', 'settled'], 'a entrega tardia foi liquidada, não incerta');
});

test('admissão pendurada: a interface sai do turno em menos de 1 s e o próximo envio funciona', async (t) => {
  const {serve, adapter, events} = await createHarness(t, {
    delay: {shouldDelay: promptHas('pendurada'), delayMs: 2000},
  });
  const sending = adapter.send({id: 'u-pendurada', text: 'pergunta pendurada'});
  await sleep(50);
  const started = Date.now();
  const stopped = await adapter.cancel();
  assert.ok(Date.now() - started < 1000, `o Parar levou ${Date.now() - started} ms`);
  assert.equal(stopped.aborted, true);
  assert.equal(adapter.snapshot().busy, false, 'a coluna sai do turno sem esperar a admissão');
  /* Envio novo logo depois do Parar: id próprio, não herda o aborto. */
  const next = adapter.send({id: 'u-nova', text: 'pergunta nova'});
  assert.deepEqual(await next, {id: 'u-nova', accepted: true});
  await waitFor(events, (event) => event.type === 'turn_end' && event.cancelled !== true, 'fim do turno novo');
  await sending;
  await sleep(100);
  assert.equal(count(events, 'turn_end'), 2, 'um turn_end do Parar e um do turno novo, sem eco duplicado');
  assert.ok(serve.requests.filter((item) => item.url.endsWith('/prompt')).length >= 2);
});

test('Parar durante um steer pendente interrompe o turno principal sem duplicar o fim', async (t) => {
  const {serve, adapter, events} = await createHarness(t, {
    serveOptions: {turnDelayMs: 60000},
    delay: {shouldDelay: promptHas('mude agora'), delayMs: 1200},
  });
  await adapter.send({id: 'u-principal', text: 'pergunta longa'});
  const steering = adapter.send({id: 'u-steer', text: 'mude agora', delivery: 'steer'});
  const started = Date.now();
  const stopped = await adapter.cancel();
  assert.ok(Date.now() - started < 1000, `o Parar levou ${Date.now() - started} ms`);
  assert.equal(stopped.aborted, true);
  await steering;
  assert.equal(count(events, 'turn_end'), 1, 'só o turno principal fecha');
  assert.equal(adapter.snapshot().busy, false);
  const next = adapter.send({id: 'u-depois', text: 'pergunta nova'});
  assert.deepEqual(await next, {id: 'u-depois', accepted: true});
  await adapter.cancel();
  await waitFor(events, (event) => event.type === 'turn_end' && count(events, 'turn_end') === 2, 'fim do turno novo');
  assert.ok(serve.requests.some((item) => item.url.endsWith('/interrupt')));
});

test('serviço: o abort com attemptId desiste do prompt que ainda vai chegar, sem vazar para o próximo', async (t) => {
  const {serve, adapter, events} = await createHarness(t);
  const service = new NativeService({adapter, engine: 'opencode'});
  t.after(() => service.stop());
  service.on('event', (event) => events.push(event));
  await service.request('abort', {attemptId: 'envio-antigo'});
  await assert.rejects(service.request('prompt', {message: 'fala antiga', attemptId: 'envio-antigo'}),
    (error) => keyOf(error) === 'tutor.error.cancelled' && error.notSent === true);
  assert.equal(serve.requests.some((item) => item.url.endsWith('/prompt')), false, 'nada foi enviado');
  await service.request('prompt', {message: 'fala nova', attemptId: 'envio-novo'});
  assert.equal(serve.requests.filter((item) => item.url.endsWith('/prompt')).length, 1, 'o envio novo saiu');
  await waitFor(events, (event) => event.type === 'agent_settled' && event.cancelled !== true, 'fim do turno novo');
});

test('serviço: Parar no meio da admissão libera o próximo Enviar antes do aceite antigo', async (t) => {
  const {adapter, events} = await createHarness(t, {
    delay: {shouldDelay: promptHas('velha'), delayMs: 1500},
  });
  const service = new NativeService({adapter, engine: 'opencode'});
  t.after(() => service.stop());
  service.on('event', (event) => events.push(event));
  /* O Parar acorda o envio velho com o erro de cancelado: o handler entra já,
     não só no fim do teste. Sob carga (portões completos) a rejeição chegava
     antes do `.catch` e o Node a contava como não tratada. */
  const old = service.request('prompt', {message: 'fala velha', attemptId: 'A'})
    .then(() => 'ok', (error) => (keyOf(error) === 'tutor.error.cancelled' ? 'cancelado' : error));
  await sleep(50);
  const started = Date.now();
  await service.request('abort', {attemptId: 'A'});
  assert.ok(Date.now() - started < 1000, `o Parar levou ${Date.now() - started} ms`);
  await service.request('prompt', {message: 'fala nova', attemptId: 'B'});
  await waitFor(events, (event) => event.type === 'agent_settled' && event.cancelled !== true, 'fim do turno novo');
  const oldOutcome = await old;
  /* O envio velho termina ou desiste como cancelado; qualquer outro erro é
     falha real e não pode sumir no handler antecipado (revisão de 9b7b371b). */
  assert.ok(oldOutcome === 'ok' || oldOutcome === 'cancelado', `o envio velho falhou de outro jeito: ${oldOutcome?.message || oldOutcome}`);
  const deadline = Date.now() + 5000;
  while (adapter.snapshot().busy && Date.now() < deadline) await sleep(20);
  assert.equal(adapter.snapshot().busy, false, 'o aceite velho não deixa turno aberto');
});
