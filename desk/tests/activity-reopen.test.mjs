/* Quadro publicado volta ao reabrir a conversa, nos três motores.
 *
 * O renderer só hidrata um quadro se o histórico reaberto tiver a chamada da
 * ferramenta (`historyTurns` → parte `artifact` com o `toolCallId`) e o store
 * tiver o item com esse mesmo id. A cadeia aqui é a do app: o motor (fake)
 * devolve o histórico pelo serviço real, `historyTurns` monta os turnos e o
 * store responde `list`/`stateGet` com o estado salvo, `kind` e `heights`.
 *
 * Regressão do relato do autor (2026-10-20): gráfico interativo de
 * `criar_atividade` sumia depois de fechar e abrir a Mesa. O OpenCode
 * descartava as partes `tool` do histórico, então o slot nunca nascia. As
 * funções do quadro são inventadas (nada de material de curso). */
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {historyTurns} from '../src/worklog.mjs';
import * as fx from './claude-fixtures.mjs';
import {createFakeOpencodeServe} from './fake-opencode.mjs';

const require = createRequire(import.meta.url);
const {createActivityStore} = require('../activity-store.cjs');
const {NativeService, ClaudeService} = require('../src/agents/service.cjs');
const {OpenCodeAdapter} = require('../src/agents/opencode-adapter.cjs');
const {ClaudeAdapter} = require('../src/agents/claude-adapter.cjs');

/* Visualização com controles (h e x₀) sobre uma função inventada. */
const SPEC = {
  title: 'Secante de f(x) = x³ − 2x',
  objective: 'Ver a secante virar tangente quando h encolhe.',
  alternativeMarkdown: 'Gráfico de f(x) = x³ − 2x com a secante entre x₀ e x₀ + h.',
  html: '<canvas id="g"></canvas><label>h <input id="h" type="range" min="0.01" max="2" step="0.01"></label><label>x₀ <input id="x0" type="range" min="-2" max="2" step="0.1"></label><p id="m"></p>',
  js: 'window.mesa && window.mesa.ready && window.mesa.ready();',
  kind: 'visualizacao',
  charts: true,
};
const HEIGHTS = [[360, 420], [720, 480]];
const SAVED = {values: {h: 0.25, x0: 1.5}};

function tempRuntime(t) {
  const runtime = mkdtempSync(join(tmpdir(), 'mesa-reabrir-'));
  t.after(() => rmSync(runtime, {recursive: true, force: true}));
  return runtime;
}

async function publishWithState(store, conversationId, toolCallId) {
  const item = await store.publish({conversationId, toolCallId, spec: SPEC, heights: HEIGHTS});
  await store.stateSave({conversationId, id: item.id, version: item.version, hash: item.hash, state: SAVED});
  return item;
}

/* O que o renderer faz depois da carga: cada parte `artifact` acha o item do
   store pelo `toolCallId` e lê o estado salvo. */
function boardsAfterReopen(store, conversationId, messages) {
  const ids = historyTurns(messages).flatMap((turn) => turn.parts).filter((part) => part.type === 'artifact').map((part) => part.toolCallId);
  const items = store.list({conversationId});
  return ids.map((toolCallId) => {
    const item = items.find((entry) => entry.toolCallId === toolCallId) || null;
    const saved = item ? store.stateGet({conversationId, id: item.id, version: item.version, hash: item.hash}).state : null;
    return {toolCallId, item, saved};
  });
}

function assertBoardBack(boards, published, engine) {
  assert.equal(boards.length, 1, `${engine}: o histórico reaberto tem o slot do quadro (${JSON.stringify(boards)})`);
  const [{item, saved}] = boards;
  assert.ok(item, `${engine}: o store acha o quadro pelo toolCallId do histórico`);
  assert.equal(item.hash, published.hash, `${engine}: mesmo hash`);
  assert.equal(item.version, published.version, `${engine}: mesma versão`);
  assert.equal(item.view, 'visualizacao', `${engine}: kind preservado`);
  assert.deepEqual(item.heights, HEIGHTS, `${engine}: heights preservados`);
  assert.deepEqual(saved, SAVED, `${engine}: estado salvo volta`);
}

/* ---------------- Pi: JSONL lido pelo fake por `get_messages` ---------------- */

function piGetMessages(session) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [new URL('./fake-pi.mjs', import.meta.url).pathname, '--session', session], {stdio: ['pipe', 'pipe', 'inherit']});
    let buffer = '';
    const timer = setTimeout(() => { child.kill(); reject(Error('fake-pi não respondeu get_messages')); }, 10000);
    child.stdout.on('data', (chunk) => {
      buffer += chunk;
      for (const line of buffer.split('\n').slice(0, -1)) {
        const event = JSON.parse(line);
        if (event.type !== 'response' || event.id !== 'h1') continue;
        clearTimeout(timer);
        child.kill();
        resolve(event.data.messages);
      }
      buffer = buffer.slice(buffer.lastIndexOf('\n') + 1);
    });
    child.stdin.write(JSON.stringify({type: 'get_messages', id: 'h1'}) + '\n');
  });
}

test('Pi: quadro publicado volta ao reabrir, com estado, kind e heights', async (t) => {
  const runtime = tempRuntime(t);
  const session = join(runtime, 'pi-1.jsonl');
  const store = createActivityStore({runtime});
  const published = await publishWithState(store, session, 'call-pi-1');
  /* O JSONL como o Pi grava: chamada no assistente e o resultado à parte. */
  const rows = [
    {role: 'user', content: [{type: 'text', text: 'Mostre a secante.'}]},
    {role: 'assistant', content: [{type: 'toolCall', id: 'call-pi-1', name: 'mesa_criar_atividade', arguments: SPEC}]},
    {role: 'toolResult', toolCallId: 'call-pi-1', toolName: 'mesa_criar_atividade', content: [{type: 'text', text: 'publicada'}]},
    {role: 'assistant', content: [{type: 'text', text: 'Arraste h para perto de zero.'}]},
  ];
  writeFileSync(session, rows.map((message) => JSON.stringify({type: 'message', message})).join('\n') + '\n');
  assertBoardBack(boardsAfterReopen(store, session, await piGetMessages(session)), published, 'pi');
});

/* ---------------- Claude: histórico nativo pelo SDK fake ---------------- */

test('Claude: quadro publicado volta ao reabrir, com estado, kind e heights', async (t) => {
  const runtime = tempRuntime(t);
  const conversationId = join(runtime, 'claude-1.json');
  const store = createActivityStore({runtime});
  /* O gate registra o `tool_use_id` do PreToolUse: é o id do bloco. */
  const published = await publishWithState(store, conversationId, 'toolu_reabrir_1');
  const sdk = fx.fakeSdk();
  sdk.state.history = [
    fx.historyEntry({role: 'user', text: 'Mostre a secante.'}),
    fx.historyEntry({role: 'assistant', content: [{type: 'tool_use', id: 'toolu_reabrir_1', name: 'mcp__mesa__criar_atividade', input: SPEC}]}),
    fx.historyEntry({role: 'user', content: [{type: 'tool_result', tool_use_id: 'toolu_reabrir_1', content: 'publicada'}]}),
    fx.historyEntry({role: 'assistant', text: 'Arraste h para perto de zero.'}),
  ];
  const adapter = new ClaudeAdapter({conversationId, sessionId: fx.UUID.session, cwd: runtime, sdkLoader: async () => sdk, timeoutMs: 2000});
  t.after(() => adapter.close());
  const service = new ClaudeService({adapter});
  const {messages} = await service.request('get_messages');
  assertBoardBack(boardsAfterReopen(store, conversationId, messages), published, 'claude');
});

/* ---------------- OpenCode: turno real contra o serve falso ---------------- */

const PASSWORD = 'senha-de-teste';

function openCodeService(serve, sessionId) {
  const adapter = new OpenCodeAdapter({conversationId: 'conv-oc', sessionId, directory: '/tmp/mesa-ws/conv-oc',
    acquire: async () => ({baseUrl: serve.url, password: PASSWORD, binary: '/fake/opencode'})});
  const service = new NativeService({adapter, engine: 'opencode'});
  const events = [];
  service.on('event', (event) => events.push(event));
  return {adapter, service, events};
}

async function until(check, label) {
  for (let i = 0; i < 300; i++) {
    const value = check();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw Error(`não chegou: ${label}`);
}

test('OpenCode: quadro publicado volta ao reabrir, com estado, kind e heights', async (t) => {
  const runtime = tempRuntime(t);
  const conversationId = join(runtime, 'opencode-1.json');
  const store = createActivityStore({runtime});
  const serve = await createFakeOpencodeServe({password: PASSWORD, tool: {name: 'mesa_criar_atividade', input: SPEC, output: 'publicada'}});
  t.after(() => serve.close());
  const first = openCodeService(serve, '');
  await first.service.request('prompt', {message: 'Mostre a secante.'});
  /* A ponte reivindica o id pelo `tool.called` do SSE: é o id que o store guarda. */
  const started = await until(() => first.events.find((event) => event.type === 'tool_execution_start'), 'tool_execution_start');
  await until(() => first.events.find((event) => event.type === 'agent_settled'), 'agent_settled');
  const published = await publishWithState(store, conversationId, started.toolCallId);
  const sessionId = first.adapter.sessionId;
  first.service.stop();

  const reopened = openCodeService(serve, sessionId);
  t.after(() => reopened.service.stop());
  const {messages} = await reopened.service.request('get_messages');
  assertBoardBack(boardsAfterReopen(store, conversationId, messages), published, 'opencode');
});
