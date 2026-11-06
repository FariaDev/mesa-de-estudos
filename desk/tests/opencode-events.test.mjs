/* Vocabulário SSE do OpenCode v2.0.32 → eventos da Mesa.
 *
 * Cada caso usa um `emit` falso que guarda `[tipo, payload]`; nenhum SSE de
 * verdade é aberto. O leitor é de UMA sessão: evento de outra é ignorado. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {parseMessage} from '../src/i18n.mjs';
import {FREE_LIMIT_429, FREE_TIER_403, PROVIDER_TRANSPORT_ECONNREFUSED, PROVIDER_TRANSPORT_SELF_SIGNED} from './fake-opencode.mjs';

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

test('texto → ferramenta → texto fecha cada passo antes do próximo (a primeira frase não volta, #112)', () => {
  const {reader, events} = createReader();
  /* Sequência do 2.2.4 real (sonda sintética): cada passo do modelo tem o seu
     `assistantMessageID`; a ferramenta fica entre os dois. */
  reader.handle('session.step.started', {sessionID: SESSION, assistantMessageID: 'msg_a'});
  reader.handle('session.text.started', {sessionID: SESSION, assistantMessageID: 'msg_a'});
  reader.handle('session.text.delta', {sessionID: SESSION, assistantMessageID: 'msg_a', delta: 'Primeira frase.'});
  reader.handle('session.text.ended', {sessionID: SESSION, assistantMessageID: 'msg_a', text: 'Primeira frase.'});
  reader.handle('session.tool.input.started', {sessionID: SESSION, id: 'call_1', name: 'mesa_calcular'});
  reader.handle('session.tool.called', {sessionID: SESSION, id: 'call_1', input: {expressao: '2+2'}});
  reader.handle('session.tool.success', {sessionID: SESSION, id: 'call_1', content: '4'});
  reader.handle('session.step.ended', {sessionID: SESSION, assistantMessageID: 'msg_a'});
  reader.handle('session.step.started', {sessionID: SESSION, assistantMessageID: 'msg_b'});
  reader.handle('session.text.started', {sessionID: SESSION, assistantMessageID: 'msg_b'});
  reader.handle('session.text.delta', {sessionID: SESSION, assistantMessageID: 'msg_b', delta: 'Segunda frase.'});
  reader.handle('session.text.ended', {sessionID: SESSION, assistantMessageID: 'msg_b', text: 'Segunda frase.'});
  reader.handle('session.step.ended', {sessionID: SESSION, assistantMessageID: 'msg_b'});
  reader.handle('session.execution.succeeded', {sessionID: SESSION});

  const ends = events.filter(([type]) => type === 'message_end').map(([, payload]) => payload.message);
  assert.deepEqual(ends.map((message) => [message.id, message.content[0].text]), [['msg_a', 'Primeira frase.'], ['msg_b', 'Segunda frase.']]);
  assert.deepEqual(events.filter(([type]) => type === 'message_start').map(([, payload]) => payload.message.id), ['msg_a', 'msg_b']);
  const endA = events.findIndex(([type, payload]) => type === 'message_end' && payload.message.id === 'msg_a');
  const startB = events.findIndex(([type, payload]) => type === 'message_start' && payload.message.id === 'msg_b');
  assert.ok(endA >= 0 && endA < startB, 'o fim do passo anterior chega antes do início do próximo');
  assert.deepEqual(events.filter(([type]) => type === 'message_delta').map(([, payload]) => payload.delta), ['Primeira frase.', 'Segunda frase.']);
});

test('sem step.ended no fio, o delta da resposta seguinte fecha a anterior antes de abrir', () => {
  const {reader, events} = createReader();
  reader.handle('session.text.delta', {sessionID: SESSION, assistantMessageID: 'msg_a', delta: 'Primeira frase.'});
  reader.handle('session.text.ended', {sessionID: SESSION, assistantMessageID: 'msg_a', text: 'Primeira frase.'});
  reader.handle('session.text.delta', {sessionID: SESSION, assistantMessageID: 'msg_b', delta: 'Segunda frase.'});
  reader.handle('session.execution.succeeded', {sessionID: SESSION});

  const ends = events.filter(([type]) => type === 'message_end').map(([, payload]) => payload.message);
  assert.deepEqual(ends.map((message) => message.id), ['msg_a', 'msg_b']);
  const endA = events.findIndex(([type, payload]) => type === 'message_end' && payload.message.id === 'msg_a');
  const startB = events.findIndex(([type, payload]) => type === 'message_start' && payload.message.id === 'msg_b');
  assert.ok(endA >= 0 && endA < startB, 'a versão sem step.ended também fecha antes de abrir');
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
  assert.equal(events[0][1].action, 'acao');
  assert.deepEqual(events[0][1].resources, ['recurso1', 'recurso2']);
});

test('permission.v2.asked do 1.19.5 e o formato permission/patterns entram no mesmo evento', () => {
  const {reader, events} = createReader();
  reader.handle('permission.v2.asked', {
    sessionID: SESSION,
    id: 'per_2',
    permission: 'bash',
    patterns: ['ls *'],
    metadata: {command: 'ls'},
  });

  assert.deepEqual(types(events), ['permission_request']);
  assert.equal(events[0][1].action, 'bash');
  assert.deepEqual(events[0][1].resources, ['ls *']);
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

test('tool.failed leva a frase recebida ao tool_end, em string, output ou error.data', () => {
  const received = '/Users/ana/Documents/Curso/Aula 6 - Parte 5.pdf';
  const phrase = `PDF recusado: recebi ${JSON.stringify(received)}`;
  const {reader, events} = createReader();
  reader.handle('session.tool.input.started', {sessionID: SESSION, id: 'tool_pdf', name: 'mesa_ler_pdf'});
  reader.handle('session.tool.failed', {sessionID: SESSION, id: 'tool_pdf', error: phrase});
  reader.handle('session.tool.input.started', {sessionID: SESSION, id: 'tool_out', name: 'mesa_ler_pdf'});
  reader.handle('session.tool.failed', {sessionID: SESSION, id: 'tool_out', output: {message: phrase}});
  reader.handle('session.tool.input.started', {sessionID: SESSION, id: 'tool_data', name: 'mesa_ler_pdf'});
  reader.handle('session.tool.failed', {sessionID: SESSION, id: 'tool_data', error: {data: {message: phrase}}});

  const ends = events.filter(([type]) => type === 'tool_end').map(([, payload]) => payload);
  assert.equal(ends.length, 3);
  for (const end of ends) {
    assert.equal(end.isError, true);
    assert.equal(end.name, 'mesa_ler_pdf');
    assert.equal(end.result, phrase);
  }
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
  assert.equal(parsed?.key, 'opencode.event.providerAuth', '401 vira aviso de credencial, não JSON cru');
  assert.equal(parsed?.args.reason, undefined);
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

test('session.error terminal vira aviso de credencial e fecha o turno', () => {
  const {reader, events} = createReader();
  reader.handle('session.error', {sessionID: SESSION, error: {status: 401, message: 'Invalid credential'}});
  assert.deepEqual(types(events), ['error', 'turn_end']);
  assert.equal(parseMessage(events[0][1].message)?.key, 'opencode.event.providerAuth');
  assert.equal(events[1][1].isError, true, 'a tela não fica em pensando depois da recusa');
});

test('permission.asked do 2.2.4 mantém ação e recursos para o adaptador recusar', () => {
  const {reader, events} = createReader();
  reader.handle('session.tool.input.started', {sessionID: SESSION, id: 'call_1', name: 'shell'});
  reader.handle('session.tool.called', {sessionID: SESSION, id: 'call_1', input: {command: 'ls'}});
  reader.handle('permission.asked', {
    sessionID: SESSION,
    id: 'per_1',
    action: 'shell',
    resources: ['echo JAIL', 'ls'],
    save: ['echo *', 'ls *'],
    source: {type: 'tool', messageID: 'msg_a', id: 'call_1'},
  });

  const ask = events.find(([type]) => type === 'permission_request')[1];
  assert.equal(ask.action, 'shell');
  assert.deepEqual(ask.resources, ['echo JAIL', 'ls']);
});

test('permission.asked do 2.2.4 de edit mantém o recurso para o adaptador recusar', () => {
  const {reader, events} = createReader();
  reader.handle('session.tool.called', {sessionID: SESSION, id: 'call_2', input: {filePath: '/w/nota.md'}});
  reader.handle('permission.asked', {
    sessionID: SESSION,
    id: 'per_2',
    action: 'edit',
    resources: ['/w/nota.md'],
    source: {type: 'tool', messageID: 'msg_b', id: 'call_2'},
  });
  const ask = events.find(([type]) => type === 'permission_request')[1];
  assert.equal(ask.action, 'edit');
  assert.deepEqual(ask.resources, ['/w/nota.md']);
});

test('execution.failed do 2.2.4 (modelo padrão sem rota) vira erro visível com a frase', () => {
  const {reader, events} = createReader();
  reader.handle('session.execution.failed', {
    sessionID: SESSION,
    error: {type: 'provider.no-route', message: 'Model unavailable: opencode/gpt-6.1-terra'},
  });
  const error = events.find(([type]) => type === 'error')[1];
  assert.equal(error.code, 'OPENCODE_TURN_FAILED');
  assert.equal(parseMessage(error.message)?.key, 'opencode.event.providerFailed');
  assert.equal(parseMessage(error.message)?.args.reason, 'Model unavailable: opencode/gpt-6.1-terra');
  assert.deepEqual(types(events), ['error', 'execution']);
});

/* Formato real medido no 2.2.4 (2026-11-05, grátis sem credencial e travas da
   Mesa): `provider.free-limit`, 429, `FreeUsageLimitError`. Vira a frase
   própria, não o `providerFailed` genérico nem papo de cota. */
test('step.failed + execution.failed do limite do grátis viram UM error não fatal com a frase própria', () => {
  const {reader, events} = createReader();
  reader.handle('session.step.failed', {sessionID: SESSION, assistantMessageID: 'msg_a', error: FREE_LIMIT_429});
  reader.handle('session.execution.failed', {sessionID: SESSION, error: FREE_LIMIT_429});

  assert.deepEqual(types(events), ['error', 'execution']);
  assert.equal(events[0][1].fatal, false);
  assert.equal(events[0][1].code, 'OPENCODE_TURN_FAILED');
  assert.equal(parseMessage(events[0][1].message)?.key, 'opencode.event.freeLimit');
  assert.equal(parseMessage(events[0][1].message)?.args?.reason, undefined);
  assert.equal(events[0][1].detail, undefined, 'sem detalhe cru na tela: só a frase curta');
  assert.equal(events[1][1].status, 'failed');
});

test('session.error do limite do grátis usa a mesma frase e fecha o turno com erro', () => {
  const {reader, events} = createReader();
  reader.handle('session.error', {sessionID: SESSION, error: FREE_LIMIT_429});
  assert.deepEqual(types(events), ['error', 'turn_end']);
  assert.equal(parseMessage(events[0][1].message)?.key, 'opencode.event.freeLimit');
  assert.equal(events[1][1].isError, true);
});

test('o limite do grátis não vira aviso de credencial: 429 fica no freeLimit, 401 no providerAuth', () => {
  const {reader, events} = createReader();
  reader.handle('session.execution.failed', {sessionID: SESSION, error: {type: 'provider.free-limit', status: 429, message: 'Free usage limit reached.'}});
  reader.handle('session.execution.failed', {sessionID: SESSION, error: {type: 'provider.auth', status: 401, message: 'Invalid API key'}});
  const keys = events.filter(([type]) => type === 'error').map(([, payload]) => parseMessage(payload.message)?.key);
  assert.deepEqual(keys, ['opencode.event.freeLimit', 'opencode.event.providerAuth']);
});

/* Enviar sem rede (auditoria rodada 4, sem-conexão): o fetch do provedor morre
   com `fetch failed`/DNS e a tela diz falta de conexão com a saída, não o
   inglês cru do motor. Vale para `session.error` também. */
test('falha de rede do turno vira o aviso de sem-conexão, não o inglês cru', () => {
  for (const error of [
    {message: 'fetch failed', cause: {code: 'EAI_AGAIN', message: 'getaddrinfo EAI_AGAIN api.openai.com'}},
    {code: 'ENOTFOUND', message: 'getaddrinfo ENOTFOUND api.openai.com'},
    {message: 'network error'},
  ]) {
    const {reader, events} = createReader();
    reader.handle('session.step.failed', {sessionID: SESSION, assistantMessageID: 'msg_a', error});
    reader.handle('session.execution.failed', {sessionID: SESSION, error});
    assert.deepEqual(types(events), ['error', 'execution']);
    assert.equal(parseMessage(events[0][1].message)?.key, 'opencode.event.network', JSON.stringify(error));
    assert.equal(events[0][1].fatal, false);
  }
  const {reader, events} = createReader();
  reader.handle('session.error', {sessionID: SESSION, error: {message: 'fetch failed'}});
  assert.equal(parseMessage(events[0][1].message)?.key, 'opencode.event.network');
});

/* Revisão rodada 5: o `fetch` do Node embrulha `ECONNREFUSED` em `fetch
   failed`, e o diagnóstico dizia "confira sua internet" com o provedor local
   parado. Recusa local e TLS têm frase própria — nunca a de sem-conexão. */
test('provedor local parado (ECONNREFUSED no cause do fetch) não é falta de internet', () => {
  for (const error of [
    {message: 'fetch failed', cause: {code: 'ECONNREFUSED', message: 'connect ECONNREFUSED 127.0.0.1:11434'}},
    {code: 'ECONNREFUSED', message: 'connect ECONNREFUSED 127.0.0.1:11434'},
    {message: 'connect ECONNREFUSED 127.0.0.1:11434'},
  ]) {
    const {reader, events} = createReader();
    reader.handle('session.step.failed', {sessionID: SESSION, assistantMessageID: 'msg_a', error});
    reader.handle('session.execution.failed', {sessionID: SESSION, error});
    assert.equal(parseMessage(events[0][1].message)?.key, 'opencode.event.providerUnreachable', JSON.stringify(error));
    assert.equal(events[0][1].fatal, false);
  }
  const {reader, events} = createReader();
  reader.handle('session.error', {sessionID: SESSION, error: {message: 'fetch failed', cause: {code: 'ECONNREFUSED'}}});
  assert.equal(parseMessage(events[0][1].message)?.key, 'opencode.event.providerUnreachable');
});

/* Formato REAL medido no 2.2.4 (2026-11-05, provedor OpenAI-compatible local,
   sem chave de verdade): a falha de transporte chega PLANA em
   `{type:'provider.transport', message:'<CÓDIGO>: <frase>'}` — não em
   `data.message` nem em `cause`. Porta fechada e certificado autoassinado são
   provedor inalcançável, não "confira sua internet". */
test('provider.transport do 2.2.4 (porta fechada e TLS) vira provedor inalcançável', () => {
  for (const error of [PROVIDER_TRANSPORT_ECONNREFUSED, PROVIDER_TRANSPORT_SELF_SIGNED]) {
    const {reader, events} = createReader();
    reader.handle('session.step.failed', {sessionID: SESSION, assistantMessageID: 'msg_a', error});
    reader.handle('session.execution.failed', {sessionID: SESSION, error});
    assert.deepEqual(types(events), ['error', 'execution']);
    assert.equal(parseMessage(events[0][1].message)?.key, 'opencode.event.providerUnreachable', JSON.stringify(error));
    assert.equal(events[0][1].fatal, false);
  }
});

test('certificado (vencido, autoassinado, TLS) não é falta de internet', () => {
  for (const error of [
    {message: 'fetch failed', cause: {code: 'CERT_HAS_EXPIRED', message: 'certificate has expired'}},
    {message: 'self signed certificate in certificate chain'},
    {message: 'unable to verify the first certificate'},
    {code: 'ERR_TLS_CERT_ALTNAME_INVALID', message: 'Hostname/IP does not match certificate'},
  ]) {
    const {reader, events} = createReader();
    reader.handle('session.step.failed', {sessionID: SESSION, assistantMessageID: 'msg_a', error});
    reader.handle('session.execution.failed', {sessionID: SESSION, error});
    assert.equal(parseMessage(events[0][1].message)?.key, 'opencode.event.providerUnreachable', JSON.stringify(error));
  }
});

test('modelo parado ("model is offline") não é falta de internet', () => {
  const {reader, events} = createReader();
  reader.handle('session.execution.failed', {sessionID: SESSION, error: {message: 'model is offline'}});
  assert.notEqual(parseMessage(events[0][1].message)?.key, 'opencode.event.network');
  assert.equal(parseMessage(events[0][1].message)?.key, 'opencode.event.providerUnreachable');
});

/* Negativos: credencial, cota e cancelamento nunca viram rede nem provedor
   inalcançável — cada um segue para o seu diagnóstico. */
test('401, cota e cancelamento não viram rede nem provedor inalcançável', () => {
  const cases = [
    [{status: 401, message: 'Invalid API key'}, 'opencode.event.providerAuth'],
    [{status: 429, message: 'quota exceeded for quota metric'}, 'opencode.event.providerFailed'],
    [{message: 'Usage quota exceeded, try again later'}, 'opencode.event.providerFailed'],
    [{name: 'AbortError', message: 'This operation was aborted'}, 'opencode.event.providerFailed'],
  ];
  for (const [error, expected] of cases) {
    const {reader, events} = createReader();
    reader.handle('session.execution.failed', {sessionID: SESSION, error});
    const key = parseMessage(events[0][1].message)?.key;
    assert.equal(key, expected, `${JSON.stringify(error)} virou ${key}`);
  }
});
