/* Vocabulário SSE do OpenCode v2.0.32 → eventos da Mesa.
 *
 * Cada caso usa um `emit` falso que guarda `[tipo, payload]`; nenhum SSE de
 * verdade é aberto. O leitor é de UMA sessão: evento de outra é ignorado. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {parseMessage} from '../src/i18n.mjs';
import {FREE_TIER_403} from './fake-opencode.mjs';

const require = createRequire(import.meta.url);
const {OpenCodeEventReader} = require('../src/agents/opencode-events.cjs');

const SESSION = 'ses_1';

function createReader() {
  const events = [];
  const reader = new OpenCodeEventReader({
    sessionId: SESSION,
    emit: (type, payload) => events.push([type, payload]),
  });
  return {reader, events};
}

const types = (events) => events.map(([type]) => type);

test('o primeiro delta de uma resposta abre o balão; o segundo não repete', () => {
  const {reader, events} = createReader();
  reader.handle('session.text.delta', {sessionID: SESSION, assistantMessageID: 'msg_a', delta: 'oi'});
  reader.handle('session.text.delta', {sessionID: SESSION, assistantMessageID: 'msg_a', delta: '!'});

  assert.deepEqual(types(events), ['message_start', 'message_delta', 'message_delta']);
  assert.deepEqual(events[0][1], {message: {role: 'assistant', id: 'msg_a'}});
  assert.equal(events[1][1].delta, 'oi');
  assert.equal(events[1][1].contentIndex, 0);
  assert.equal(events[1][1].messageId, 'msg_a');
  assert.equal(events[2][1].delta, '!');
});

test('session.text.ended manda só o sufixo que falta', () => {
  const {reader, events} = createReader();
  reader.handle('session.text.delta', {sessionID: SESSION, assistantMessageID: 'msg_a', delta: 'oi'});
  reader.handle('session.text.ended', {sessionID: SESSION, assistantMessageID: 'msg_a', text: 'oi, tudo bem'});

  const deltas = events.filter(([type]) => type === 'message_delta').map(([, payload]) => payload.delta);
  assert.deepEqual(deltas, ['oi', ', tudo bem']);
});

test('execution.succeeded fecha a mensagem e depois emite execution', () => {
  const {reader, events} = createReader();
  reader.handle('session.text.delta', {sessionID: SESSION, assistantMessageID: 'msg_a', delta: 'resposta'});
  reader.handle('session.execution.succeeded', {sessionID: SESSION});

  assert.deepEqual(types(events), ['message_start', 'message_delta', 'message_end', 'execution']);
  const ended = events[2][1].message;
  assert.equal(ended.role, 'assistant');
  assert.equal(ended.id, 'msg_a');
  assert.equal(ended.uuid, 'msg_a');
  assert.deepEqual(ended.content, [{type: 'text', text: 'resposta'}]);
  assert.equal(events[3][1].status, 'succeeded');
});

test('evento de outra sessão é ignorado', () => {
  const {reader, events} = createReader();
  reader.handle('session.text.delta', {sessionID: 'ses_2', assistantMessageID: 'msg_b', delta: 'fora'});
  reader.handle('session.execution.succeeded', {sessionID: 'ses_2'});

  assert.deepEqual(events, []);
});

test('permission.asked vira permission_request com a ação e os recursos', () => {
  const {reader, events} = createReader();
  reader.handle('permission.asked', {
    sessionID: SESSION,
    id: 'per_1',
    action: 'acao',
    resources: ['recurso1', 'recurso2'],
  });

  assert.deepEqual(types(events), ['permission_request']);
  assert.equal(events[0][1].title, '');
  assert.equal(events[0][1].message, 'acao: recurso1, recurso2');
});

test('tool.input.started guarda o nome usado em tool_start e tool_end', () => {
  const {reader, events} = createReader();
  reader.handle('session.tool.input.started', {sessionID: SESSION, id: 'tool_1', name: 'read'});
  reader.handle('session.tool.called', {sessionID: SESSION, id: 'tool_1', input: {path: 'x'}});
  reader.handle('session.tool.success', {sessionID: SESSION, id: 'tool_1', content: 'ok'});

  assert.deepEqual(types(events), ['tool_start', 'tool_end']);
  assert.equal(events[0][1].name, 'read');
  assert.deepEqual(events[0][1].args, {path: 'x'});
  assert.equal(events[1][1].name, 'read');
  assert.equal(events[1][1].result, 'ok');
});

test('compaction.failed sem mensagem usa a mensagem marcada do catálogo', () => {
  const {reader, events} = createReader();
  reader.handle('session.compaction.failed', {sessionID: SESSION, reason: 'deu ruim'});

  assert.deepEqual(types(events), ['compaction_failed']);
  assert.equal(parseMessage(events[0][1].message)?.key, 'opencode.compact.failed');
});

test('step.failed + execution.failed do grátis viram UM error não fatal com a frase própria, antes do execution', () => {
  const {reader, events} = createReader();
  reader.handle('session.step.failed', {sessionID: SESSION, assistantMessageID: 'msg_a', error: FREE_TIER_403});
  reader.handle('session.execution.failed', {sessionID: SESSION, error: FREE_TIER_403});

  assert.deepEqual(types(events), ['error', 'execution']);
  assert.equal(events[0][1].fatal, false);
  assert.equal(events[0][1].code, 'OPENCODE_TURN_FAILED');
  assert.equal(parseMessage(events[0][1].message)?.key, 'opencode.event.freeTier');
  assert.equal(events[1][1].status, 'failed');
});

test('execution.failed sem erro próprio usa o erro do passo que falhou, com a frase do provedor', () => {
  const {reader, events} = createReader();
  reader.handle('session.step.failed', {sessionID: SESSION, error: {type: 'provider.auth', status: 401, message: 'Invalid API key'}});
  reader.handle('session.execution.failed', {sessionID: SESSION});

  const parsed = parseMessage(events[0][1].message);
  assert.equal(parsed?.key, 'opencode.event.providerFailed');
  assert.equal(parsed?.args.reason, 'Invalid API key');
});

test('passo que falha e turno que termina bem não mostram erro', () => {
  const {reader, events} = createReader();
  reader.handle('session.step.failed', {sessionID: SESSION, error: {message: 'retry'}});
  reader.handle('session.execution.succeeded', {sessionID: SESSION});

  assert.deepEqual(types(events), ['execution']);
});

test('execution.failed sem frase nenhuma cai no aviso genérico do catálogo', () => {
  const {reader, events} = createReader();
  reader.handle('session.execution.failed', {sessionID: SESSION, error: {status: 500}});

  assert.equal(parseMessage(events[0][1].message)?.key, 'opencode.event.turnFailed');
});
