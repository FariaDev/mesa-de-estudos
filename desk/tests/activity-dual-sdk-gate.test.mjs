import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {InMemoryTransport} from '@modelcontextprotocol/sdk/inMemory.js';
import {fakeSdk} from './claude-fixtures.mjs';

const require = createRequire(import.meta.url);
const {ClaudeAdapter} = require('../src/agents/claude-adapter.cjs');
const {ACTIVITY_TOOL_NAME} = require('../src/agents/activity-tools.cjs');
const {createActivityStore} = require('../activity-store.cjs');
const {createActivityRuntime} = require('../activity-runtime.cjs');
const {createActivityService, createCallRegistry} = require('../activity-bridge.cjs');

const SPEC = {title: 'Dual', objective: 'Explorar', alternativeMarkdown: 's = at²/2', html: '<p>Dual</p>', css: '', js: '', katex: false};

/* Plano O2: duas chamadas de payload IDÊNTICO com IDs nativos distintos,
   auto-aprovadas pelo hook real do adaptador e executadas pelo transporte MCP
   real, precisam publicar duas atividades distintas — uma por ID nativo. */
test('SDK real: payloads idênticos com tool_use_id distintos publicam itens distintos por ID nativo', async () => {
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-activity-dual-sdk-'));
  const store = createActivityStore({runtime});
  const activityRuntime = createActivityRuntime({store});
  const conversationId = path.join(runtime, 'claude-dual.jsonl');
  const events = [];
  const service = createActivityService({
    store,
    runtime: activityRuntime,
    registry: createCallRegistry(),
    isScopeActive: (scope) => scope && scope.conversationId === conversationId,
    emit: (event) => events.push(event),
  });
  const sdk = fakeSdk();
  const adapter = new ClaudeAdapter({
    conversationId,
    cwd: process.cwd(),
    sdkLoader: async () => sdk,
    createMaterial: async () => ({prepared: true}),
    createActivity: async (payload) => {
      const scope = {conversationId, generation: 1, scopeRef: 'scopeRef-dual'};
      return service.publish(scope, payload, {toolCallId: payload.toolCallId, callRef: payload.callRef});
    },
  });
  let client;
  try {
    await adapter._ensureQuery();
    const options = sdk.state.queries[0].options;
    const [a, b] = InMemoryTransport.createLinkedPair();
    client = new Client({name: 'mesa-dual-activity', version: '1'});
    await options.mcpServers.mesa.instance.connect(b);
    await client.connect(a);
    adapter._turn = {finalized: false};
    adapter._runId = 'turn-dual';
    const hook = options.hooks.PreToolUse[0].hooks[0];
    const nativeIds = ['toolu_dual_1', 'toolu_dual_2'];
    for (const toolUseId of nativeIds) {
      const reserved = await hook({tool_name: ACTIVITY_TOOL_NAME, tool_use_id: toolUseId, tool_input: {...SPEC, callRef: 'modelo-inventado'}});
      assert.equal(reserved.hookSpecificOutput.permissionDecision, 'allow');
      const injected = reserved.hookSpecificOutput.updatedInput;
      assert.notEqual(injected.callRef, 'modelo-inventado');
      assert.equal((await options.canUseTool(ACTIVITY_TOOL_NAME, injected, {})).behavior, 'allow');
      const result = await client.callTool({name: 'criar_atividade', arguments: injected});
      assert.equal(result.isError, undefined, JSON.stringify(result.content));
    }
    const items = store.list({conversationId});
    assert.equal(items.length, 2, 'duas publicações por IDs nativos distintos');
    const storedIds = items.map((item) => item.toolCallId).sort();
    assert.deepEqual(storedIds, [...nativeIds].sort());
    assert.equal(new Set(items.map((item) => item.id)).size, 2, 'IDs de atividade distintos para chamadas distintas');
    assert.equal(events.length, 2);
    assert.deepEqual(events.map((event) => event.activity.toolCallId).sort(), [...nativeIds].sort());
    assert.ok(events.every((event) => event.scope.scopeRef === 'scopeRef-dual'));
    assert.ok(activityRuntime.listIds().length === 2, 'runtime serve os dois documentos');
  } finally {
    adapter._turn = null;
    adapter.close();
    await client?.close().catch(() => {});
    fs.rmSync(runtime, {recursive: true, force: true});
  }
});
