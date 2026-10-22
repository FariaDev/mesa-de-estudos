/* GeoGebra no Claude (#53): a MESMA ferramenta do Pi no servidor MCP `mesa`,
   sobre o serviço do host. O serviço é o falso com nome abaixo: guarda o que a
   Mesa receberia e devolve o que o host devolveria. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {InMemoryTransport} from '@modelcontextprotocol/sdk/inMemory.js';
import {fakeSdk} from './claude-fixtures.mjs';
const require = createRequire(import.meta.url);
const {ClaudeAdapter} = require('../src/agents/claude-adapter.cjs');
const {GEOGEBRA_TOOL_NAME} = require('../src/agents/geogebra-tool.cjs');

/** Serviço do host falso: o resultado de cada ação é combinado pelo teste. */
function fakeGeogebraService() {
  const calls = [];
  return {
    calls,
    results: {run: {ok: true, state: {objects: 'f: x^2', count: 1}, board: {cleared: true, origin: 'tutor'}}, state: {ok: true, state: {objects: 'f: x^2', count: 1}}, screenshot: {png: 'UE5H'}},
    failWith: '',
    async run(args) { calls.push(['run', args]); if (this.failWith) throw Error(this.failWith); return this.results.run; },
    async state() { calls.push(['state']); return this.results.state; },
    async screenshot() { calls.push(['screenshot']); return this.results.screenshot; },
  };
}

async function connected(service, tutorLanguage) {
  const sdk = fakeSdk();
  const adapter = new ClaudeAdapter({conversationId: 'synthetic-geogebra', cwd: process.cwd(), sdkLoader: async () => sdk, geogebra: service, tutorLanguage});
  await adapter._ensureQuery();
  const options = sdk.state.queries[0].options;
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({name: 'mesa-geogebra-contract', version: '1'});
  await options.mcpServers.mesa.instance.connect(b);
  await client.connect(a);
  return {adapter, options, client, call: (args) => client.callTool({name: 'geogebra', arguments: args})};
}

test('o servidor mesa anuncia o geogebra, permitido sem confirmação extra', async () => {
  const service = fakeGeogebraService();
  const {adapter, options, client} = await connected(service);
  try {
    assert.deepEqual(options.allowedTools, [GEOGEBRA_TOOL_NAME]);
    assert.deepEqual((await client.listTools()).tools.map((tool) => tool.name), ['geogebra']);
    assert.equal((await options.canUseTool(GEOGEBRA_TOOL_NAME, {action: 'state'}, {})).behavior, 'allow');
    const hook = options.hooks.PreToolUse[0].hooks[0];
    assert.deepEqual(await hook({tool_name: GEOGEBRA_TOOL_NAME, tool_input: {action: 'state'}}), {continue: true});
    assert.equal(adapter.snapshot().capabilities.geogebra, true);
  } finally {
    adapter.close();
    await client.close();
  }
});

test('run leva o comando e o "continuar" ao serviço e devolve o aviso do quadro ao modelo', async () => {
  const service = fakeGeogebraService();
  const {adapter, client, call} = await connected(service);
  try {
    const reply = await call({action: 'run', command: 'f(x)=x^2', continuar: true});
    assert.deepEqual(service.calls, [['run', {command: 'f(x)=x^2', continuar: true}]]);
    const text = reply.content[0].text;
    assert.match(text, /O quadro começou vazio para esta resposta: a sua construção anterior ficou guardada/);
    assert.match(text, /Comando aceito pelo GeoGebra/);
    assert.match(text, /f: x\^2/);
  } finally {
    adapter.close();
    await client.close();
  }
});

test('run sem comando não chama o serviço; state e screenshot chamam', async () => {
  const service = fakeGeogebraService();
  const {adapter, client, call} = await connected(service);
  try {
    assert.match((await call({action: 'run'})).content[0].text, /Informe o command/);
    assert.deepEqual(service.calls, []);
    assert.match((await call({action: 'state'})).content[0].text, /Objetos atuais no GeoGebra:\nf: x\^2/);
    const shot = await call({action: 'screenshot'});
    assert.equal(shot.content[0].type, 'image');
    assert.equal(shot.content[0].data, 'UE5H');
    assert.deepEqual(service.calls.map((item) => item[0]), ['state', 'screenshot']);
  } finally {
    adapter.close();
    await client.close();
  }
});

test('falha do serviço vira uma frase com o motivo, sem derrubar a ferramenta', async () => {
  const service = fakeGeogebraService();
  service.failWith = 'o applet GeoGebra não ficou pronto a tempo (ele precisa de internet)';
  const {adapter, client, call} = await connected(service);
  try {
    const reply = await call({action: 'run', command: 'a=1'});
    assert.match(reply.content[0].text, /GeoGebra indisponível \(o applet GeoGebra não ficou pronto a tempo \(ele precisa de internet\)\)/);
    assert.notEqual(reply.isError, true);
  } finally {
    adapter.close();
    await client.close();
  }
});

test('depois que a sessão encerra, o serviço não é mais chamado', async () => {
  const service = fakeGeogebraService();
  const {adapter, client, call} = await connected(service);
  try {
    adapter.close();
    const reply = await call({action: 'run', command: 'a=1'});
    assert.match(reply.content[0].text, /Sessão encerrada/);
    assert.deepEqual(service.calls, []);
  } finally {
    await client.close();
  }
});

test('em inglês, a descrição e as respostas da ferramenta saem em inglês', async () => {
  const service = fakeGeogebraService();
  const {adapter, client, call} = await connected(service, () => 'en');
  try {
    const listed = (await client.listTools()).tools.find((tool) => tool.name === 'geogebra');
    assert.match(listed.description, /^Control the GeoGebra applet/);
    const text = (await call({action: 'run', command: 'f(x)=x^2'})).content[0].text;
    assert.match(text, /Command accepted by GeoGebra\./);
    assert.match(text, /The board started empty for this reply: your previous construction was saved/);
    assert.match((await call({action: 'run'})).content[0].text, /Provide the command/);
  } finally {
    adapter.close();
    await client.close();
  }
});
