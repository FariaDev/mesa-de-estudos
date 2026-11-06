/* Gravação por turno (#116): o aceite do aluno grava na hora; os `message_end`
   do mesmo turno saem numa gravação só, no fim do turno, no teto de tempo ou em
   qualquer caminho que derrube o motor. O descritor em disco nunca fica sem o que já chegou. */
import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fakeAgentAdapter} from './fake-agent-adapter.mjs';

const require = createRequire(import.meta.url);
const {ClaudeService} = require('../src/agents/service.cjs');
const conversations = require('../src/agents/conversations.cjs');
const {nativePersistence} = require('../src/agents/native-persistence.cjs');
const {createTutorEngineHost} = require('../tutor-engine-host.cjs');
const {createTutorBridgeHost} = require('../tutor-bridge-host.cjs');

const runtime = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-turn-writes-'));
after(() => fs.rmSync(runtime, {recursive: true, force: true}));

const texts = messages => messages.map(message => message.content?.[0]?.text ?? '');

function harness({messages = []} = {}) {
  const adapter = fakeAgentAdapter({messages});
  const saves = [];
  const service = new ClaudeService({
    adapter,
    messages,
    onMessages: (list, meta) => saves.push({messages: texts(list), meta}),
  });
  return {adapter, service, saves};
}

function messageEnd(adapter, text) {
  adapter.emit('event', {type: 'message_end', message: {role: 'assistant', content: [{type: 'text', text}]}});
}

function turnEnd(adapter, extra = {}) {
  adapter.emit('event', {type: 'turn_end', cancelled: false, isError: false, uncertain: false, ...extra});
}

function descriptorHarness() {
  const file = conversations.createClaudeConversation({runtime, courseId: 'calc'});
  const record = conversations.readClaudeConversation(file, {runtime});
  const adapter = fakeAgentAdapter({messages: record.messages});
  const persistence = nativePersistence({descriptor: file, runtime});
  let saves = 0;
  const service = new ClaudeService({
    adapter,
    messages: record.messages,
    importedPrefixLength: record.importedPrefixLength || 0,
    onMessages(messages, meta) {
      saves += 1;
      persistence.onMessages(messages, meta);
    },
  });
  return {file, adapter, service, saves: () => saves};
}

test('turno com três message_end grava no aceite e uma vez só no fim (#116)', async () => {
  const {adapter, service, saves} = harness();
  await service.request('prompt', {message: 'pergunta'});
  assert.equal(saves.length, 1, 'a mensagem aceita do aluno grava na hora');
  assert.deepEqual(saves[0].messages, ['pergunta']);

  messageEnd(adapter, 'bloco 1');
  messageEnd(adapter, 'bloco 2');
  messageEnd(adapter, 'bloco 3');
  assert.equal(saves.length, 1, 'message_end não grava um a um');
  assert.deepEqual(texts(service.messages), ['pergunta', 'bloco 1', 'bloco 2', 'bloco 3']);
  assert.deepEqual(texts(adapter.cached), ['pergunta', 'bloco 1', 'bloco 2', 'bloco 3'], 'o cache do adaptador atualiza na hora');

  turnEnd(adapter);
  assert.equal(saves.length, 2, 'o fim do turno grava o pendente uma vez');
  assert.deepEqual(saves[1].messages, ['pergunta', 'bloco 1', 'bloco 2', 'bloco 3']);

  turnEnd(adapter);
  assert.equal(saves.length, 2, 'turn_end repetido não grava de novo');
});

test('fim do turno com erro, incerteza ou cancelamento também grava o pendente', async () => {
  for (const [label, extra] of [['erro', {isError: true}], ['incerteza', {uncertain: true}], ['cancelamento', {cancelled: true}]]) {
    const {adapter, service, saves} = harness();
    await service.request('prompt', {message: 'pergunta'});
    messageEnd(adapter, `parcial ${label}`);
    assert.equal(saves.length, 1, `${label}: ainda pendente`);
    turnEnd(adapter, extra);
    assert.equal(saves.length, 2, `${label}: o fim grava uma vez`);
    assert.deepEqual(saves[1].messages, ['pergunta', `parcial ${label}`]);
  }
});

test('interromper grava o pendente sem esperar o turn_end', async () => {
  const {adapter, service, saves} = harness();
  await service.request('prompt', {message: 'pergunta'});
  messageEnd(adapter, 'parcial');
  await service.request('abort');
  assert.equal(adapter.cancelled, true);
  assert.equal(saves.length, 2, 'abort grava o que já chegou');
  assert.deepEqual(saves[1].messages, ['pergunta', 'parcial']);
  turnEnd(adapter, {cancelled: true});
  assert.equal(saves.length, 2, 'o turn_end posterior não grava de novo');
});

test('parar o serviço (troca de sessão/matéria e saída do app) grava o pendente', async () => {
  const {adapter, service, saves} = harness();
  await service.request('prompt', {message: 'pergunta'});
  messageEnd(adapter, 'parcial');
  service.stop();
  assert.equal(adapter.stopped, true);
  assert.equal(saves.length, 2, 'stop grava o pendente');
  assert.deepEqual(saves[1].messages, ['pergunta', 'parcial']);
  service.stop();
  assert.equal(saves.length, 2, 'parar de novo não grava de novo');
});

test('motor morre no meio do turno: o descritor guarda o que já chegou', async () => {
  const {file, adapter, service} = descriptorHarness();
  await service.request('prompt', {message: 'pergunta'});
  messageEnd(adapter, 'parcial');
  assert.deepEqual(texts(conversations.readClaudeConversation(file, {runtime}).messages), ['pergunta'], 'ainda pendente no disco');
  service.stop();
  assert.deepEqual(texts(conversations.readClaudeConversation(file, {runtime}).messages), ['pergunta', 'parcial'],
    'a queda do motor grava o que já tinha chegado');
});

test('stopBridge na troca de sessão grava o pendente antes de soltar a ponte', async () => {
  const {file, adapter, service} = descriptorHarness();
  const live = {config: {desk: {}}, courseId: 'calc', session: file, freeSessionId: '', state: {}, win: null, bridge: service,
    activityGeneration: 1, activityGrant: null, tutorMaterialGrant: null,
    materialPreviewHost: {cancel() {}}, activityHost: {invalidate() {}},
    activityBridge: {grant: () => ({token: 'a'}), revoke() {}},
    tutorMaterialBridge: {grant: () => ({token: 'm'}), revoke() {}},
    sidechatManager: {suspend() {}}, languageHost: {tutor: () => 'pt-BR', tutorLanguage: () => 'pt-BR'}};
  const host = createTutorBridgeHost({live, runtime, ggb: {bridgeFile: '/tmp/ggb.json'}, pendingDialogs: new Set(),
    appendLog() {}, captureActivityScope: () => ({generation: 1}), prepareTutorMaterial: async () => ({}),
    engine: () => 'claude', prepareClaude: () => { throw Error('sem Claude'); }, testClaudeSdkLoader: () => undefined,
    claudeBinary: () => '', claudeDetector: () => undefined, isNative: kind => kind === 'claude',
    openCodeTutor: {connect: () => null, release() {}}});

  await service.request('prompt', {message: 'pergunta'});
  messageEnd(adapter, 'parcial');
  host.stopBridge();
  assert.equal(live.bridge, null);
  assert.deepEqual(texts(conversations.readClaudeConversation(file, {runtime}).messages), ['pergunta', 'parcial']);
});

test('conversationData no meio do turno grava o pendente antes de ler o descritor', async () => {
  const {file, adapter, service, saves} = descriptorHarness();
  const live = {config: {piPath: '', claudePath: '', vaultPath: ''}, session: file, courseId: 'calc', course: '',
    bridge: service, state: {}, languageHost: {tutor: () => 'pt-BR'}};
  const host = createTutorEngineHost({live, runtime, deskDir: path.resolve(import.meta.dirname, '..'), TEST_MODE: false, FREE_ID: 'mesa-free'});
  await service.request('prompt', {message: 'pergunta'});
  messageEnd(adapter, 'parcial');

  assert.equal(host.conversationData({messages: false}).messages, undefined);
  assert.deepEqual(texts(conversations.readClaudeConversation(file, {runtime}).messages), ['pergunta'], 'metadados não forçam gravação');

  const data = host.conversationData();
  assert.deepEqual(texts(data.messages), ['pergunta', 'parcial'], 'a leitura pesada recebe a resposta parcial');
  assert.deepEqual(texts(conversations.readClaudeConversation(file, {runtime}).messages), ['pergunta', 'parcial']);
  assert.equal(saves(), 2, 'a leitura grava o pendente uma vez');
});

test('get_messages devolve a resposta parcial da memória sem esperar o disco', async () => {
  const {adapter, service, saves} = harness();
  adapter.historyComplete = false;
  await service.request('prompt', {message: 'pergunta'});
  messageEnd(adapter, 'parcial');
  const out = await service.request('get_messages');
  assert.deepEqual(texts(out.messages), ['pergunta', 'parcial']);
  assert.equal(saves.length, 1, 'get_messages não precisa gravar o pendente para responder');
});

test('delivery e uncertain gravados por outro caminho preservam a fronteira e a ordem', async () => {
  const {file, adapter, service} = descriptorHarness();
  const persistence = nativePersistence({descriptor: file, runtime});
  await service.request('prompt', {message: 'pergunta'});
  messageEnd(adapter, 'parcial');
  persistence.persistDelivery({id: 'd-1', status: 'accepted'});
  turnEnd(adapter, {uncertain: true});
  persistence.persistDelivery({id: 'd-1', status: 'uncertain'});
  const saved = conversations.readClaudeConversation(file, {runtime});
  assert.deepEqual(texts(saved.messages), ['pergunta', 'parcial']);
  assert.deepEqual(saved.delivery, {id: 'd-1', status: 'uncertain'});
  assert.equal(saved.importedPrefixLength, 0);
});

/* Revisão do release: queda dura antes do `turn_end` perdia o turno inteiro. */
test('turno longo grava o pendente no teto de tempo, sem esperar o fim do turno', async (t) => {
  t.mock.timers.enable({apis: ['setTimeout']});
  const {adapter, service, saves} = harness();
  await service.request('prompt', {message: 'pergunta'});
  messageEnd(adapter, 'bloco 1');
  messageEnd(adapter, 'bloco 2');
  t.mock.timers.tick(7999);
  assert.equal(saves.length, 1, 'antes do teto continua só o aceite');
  t.mock.timers.tick(1);
  assert.equal(saves.length, 2, 'duas mensagens saem numa gravação só');
  assert.deepEqual(saves[1].messages, ['pergunta', 'bloco 1', 'bloco 2']);
  t.mock.timers.tick(60000);
  assert.equal(saves.length, 2, 'sem mensagem nova o relógio não grava');
  messageEnd(adapter, 'bloco 3');
  turnEnd(adapter);
  assert.equal(saves.length, 3);
  t.mock.timers.tick(60000);
  assert.equal(saves.length, 3, 'o fim do turno cancela o relógio pendente');
});

test('descritor gravado no meio do turno reabre igual, sem linha duplicada', async (t) => {
  t.mock.timers.enable({apis: ['setTimeout']});
  const {file, adapter, service} = descriptorHarness();
  await service.request('prompt', {message: 'pergunta'});
  messageEnd(adapter, 'bloco 1');
  t.mock.timers.tick(8000);
  assert.deepEqual(texts(conversations.readClaudeConversation(file, {runtime}).messages), ['pergunta', 'bloco 1'], 'uma queda aqui mantém o que estava na tela');
  messageEnd(adapter, 'bloco 2');
  turnEnd(adapter);
  assert.deepEqual(texts(conversations.readClaudeConversation(file, {runtime}).messages), ['pergunta', 'bloco 1', 'bloco 2']);
});

/* 3ª revisão do release: uma resposta longa num passo só não tem `message_end`
   por dezenas de segundos, e o texto já na tela sumia numa queda dura. */
function messageDelta(adapter, delta, messageId = 'resposta-1') {
  adapter.emit('event', {type: 'message_delta', kind: 'text', delta, messageId, contentIndex: 0});
}

test('resposta em andamento entra no teto de tempo, sem esperar o message_end', async (t) => {
  t.mock.timers.enable({apis: ['setTimeout']});
  const {adapter, service, saves} = harness();
  await service.request('prompt', {message: 'pergunta'});
  messageDelta(adapter, 'resposta ');
  messageDelta(adapter, 'longa');
  t.mock.timers.tick(8000);
  assert.deepEqual(saves.at(-1).messages, ['pergunta', 'resposta longa'], 'o que está na tela vai para o disco');
  assert.deepEqual(texts(service.messages), ['pergunta'], 'o parcial não entra na lista em memória');

  adapter.emit('event', {type: 'message_end', message: {role: 'assistant', uuid: 'resposta-1', id: 'resposta-1', content: [{type: 'text', text: 'resposta longa e completa'}]}});
  turnEnd(adapter);
  assert.deepEqual(saves.at(-1).messages, ['pergunta', 'resposta longa e completa'], 'a mensagem final substitui o parcial, sem duplicar');
  t.mock.timers.tick(60000);
  assert.deepEqual(saves.at(-1).messages, ['pergunta', 'resposta longa e completa']);
});

test('turno que termina sem message_end não deixa parcial para o próximo turno', async (t) => {
  t.mock.timers.enable({apis: ['setTimeout']});
  const {adapter, service, saves} = harness();
  await service.request('prompt', {message: 'pergunta'});
  messageDelta(adapter, 'interrompida');
  turnEnd(adapter, {cancelled: true});
  assert.deepEqual(saves.at(-1).messages, ['pergunta']);
  t.mock.timers.tick(60000);
  assert.deepEqual(saves.at(-1).messages, ['pergunta']);
});

test('falha de gravação no teto tenta de novo no intervalo seguinte e avisa uma vez', async (t) => {
  t.mock.timers.enable({apis: ['setTimeout']});
  const adapter = fakeAgentAdapter({messages: []});
  const saved = [];
  let failing = true;
  const service = new ClaudeService({adapter, messages: [], onMessages: (list) => {
    if (failing) throw Error('disco cheio');
    saved.push(texts(list));
  }});
  const warnings = [];
  service.on('event', (event) => { if (event.type === 'desk_warn') warnings.push(event); });
  messageEnd(adapter, 'bloco');
  t.mock.timers.tick(8000);
  t.mock.timers.tick(8000);
  assert.equal(warnings.length, 1, 'a falha repetida não vira um aviso a cada 8 s');
  failing = false;
  t.mock.timers.tick(8000);
  assert.deepEqual(saved.at(-1), ['bloco'], 'o pendente grava quando o disco volta');
  t.mock.timers.tick(60000);
  assert.equal(saved.length, 1, 'gravado, o teto desarma');
});

test('falha de gravação direta rearma o teto e o stop parado não escreve depois (#116)', async (t) => {
  t.mock.timers.enable({apis: ['setTimeout']});
  const adapter = fakeAgentAdapter({messages: []});
  let failing = true;
  let calls = 0;
  const saved = [];
  const service = new ClaudeService({adapter, messages: [], onMessages: (list) => { calls += 1; if (failing) throw Error('disco cheio'); saved.push(texts(list)); }});
  const warnings = [];
  service.on('event', (event) => { if (event.type === 'desk_warn') warnings.push(event); });
  await service.request('prompt', {message: 'pergunta'});
  assert.equal(calls, 1, 'o aceite tenta gravar na hora');
  assert.equal(warnings.length, 1);
  failing = false;
  t.mock.timers.tick(8000);
  assert.equal(calls, 2, 'a falha direta rearma o teto, que grava quando o disco volta');
  assert.deepEqual(saved.at(-1), ['pergunta']);
  messageEnd(adapter, 'bloco');
  failing = true;
  service.stop();
  assert.equal(calls, 3, 'o stop tenta o flush final');
  failing = false;
  t.mock.timers.tick(60000);
  assert.equal(calls, 3, 'parado, o serviço não escreve depois do flush final');
});
