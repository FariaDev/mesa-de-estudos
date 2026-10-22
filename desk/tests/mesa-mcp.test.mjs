/* MCP `mesa` do OpenCode (#57): protocolo JSON-RPC por linha, as ferramentas
   com os mesmos guias do Pi e do Claude, e o livro que dá identidade às
   atividades. Pontes falsas nomeadas; o último caso sobe o servidor real por
   stdio com o Node do teste. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createMcpServer} from '../src/extensions/mesa-mcp/protocol.mjs';
import {activityTools, geogebraTool, mesaTools} from '../src/extensions/mesa-mcp/tools.mjs';
import {guideFor} from '../src/extensions/mesa-geogebra/guide.mjs';
import {CREATE_FIELDS} from '../src/extensions/mesa-activity/guide.mjs';
import {canonical, canonicalFields} from '../src/extensions/tool-fields.mjs';

const require = createRequire(import.meta.url);
const {createOpenCodeActivityCalls} = require('../src/agents/opencode-activity-calls.cjs');
const {pickPayload} = require('../activity-bridge.cjs');
const SERVER = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'extensions', 'mesa-mcp', 'server.mjs');
const GRANT = {url: 'http://127.0.0.1:5000/activity', token: 'token-falso'};

const echoTool = {name: 'eco', description: 'eco', inputSchema: {type: 'object'}, call: async (args) => ({content: [{type: 'text', text: String(args.x)}]})};

test('protocolo: initialize, ping, tools/list, tools/call e erros do JSON-RPC', async () => {
  const reply = createMcpServer({tools: [echoTool], name: 'mesa', version: '1'});
  const init = await reply('{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26"}}');
  assert.deepEqual(init.result, {protocolVersion: '2025-03-26', capabilities: {tools: {}}, serverInfo: {name: 'mesa', version: '1'}});
  assert.equal(await reply('{"jsonrpc":"2.0","method":"notifications/initialized"}'), null);
  assert.deepEqual((await reply('{"jsonrpc":"2.0","id":2,"method":"ping"}')).result, {});
  assert.deepEqual((await reply('{"jsonrpc":"2.0","id":3,"method":"tools/list"}')).result.tools, [{name: 'eco', description: 'eco', inputSchema: {type: 'object'}}]);
  assert.deepEqual((await reply('{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"eco","arguments":{"x":7}}}')).result, {content: [{type: 'text', text: '7'}]});
  assert.equal((await reply('{"jsonrpc":"2.0","id":5,"method":"resources/list"}')).error.code, -32601);
  assert.equal((await reply('{"jsonrpc":"2.0","id":6,"method":"tools/call","params":{"name":"nada"}}')).error.code, -32602);
  assert.equal((await reply('não é json')).error.code, -32700);
});

test('ferramenta que lança vira resultado isError com a mensagem, e o log sai em JSON', async () => {
  const lines = [];
  const broken = {...echoTool, call: async () => { throw Error('ponte caiu'); }};
  const reply = createMcpServer({tools: [broken], name: 'mesa', version: '1', log: (line) => lines.push(JSON.parse(line))});
  const answer = await reply('{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"eco","arguments":{}}}');
  assert.deepEqual(answer.result, {content: [{type: 'text', text: 'ponte caiu'}], isError: true});
  assert.equal(lines[0].tool, 'eco');
});

test('GeoGebra: mesmo guia do Pi, esquema igual aos campos, captura vira imagem e ponte fechada vira frase', async () => {
  const calls = [];
  /* Ponte falsa nomeada: responde como a da Mesa. */
  const fakeGeogebra = async (file, action, params) => {
    calls.push({file, action, params});
    if (action === 'screenshot') return {png: 'iVBOR'};
    if (action === 'state') throw Object.assign(Error('fechada'), {code: 'BRIDGE_CLOSED'});
    return {ok: true, state: {objects: 'f(x) = x²'}};
  };
  const tool = geogebraTool({bridgeFile: '/runtime/ggb-bridge.json', language: 'pt-BR', call: fakeGeogebra});
  const guide = guideFor('pt-BR');
  assert.equal(tool.description, guide.description);
  assert.deepEqual(canonical(tool.inputSchema), canonicalFields(guide.fields));
  assert.equal((await tool.call({action: 'run', command: ' '})).content[0].text, guide.missingCommandText);
  assert.match((await tool.call({action: 'run', command: 'f(x)=x^2', continuar: true})).content[0].text, /f\(x\) = x²/);
  assert.deepEqual(calls[0], {file: '/runtime/ggb-bridge.json', action: 'run', params: {command: 'f(x)=x^2', continuar: true}});
  assert.deepEqual((await tool.call({action: 'screenshot'})).content[0], {type: 'image', data: 'iVBOR', mimeType: 'image/png'});
  assert.equal((await tool.call({action: 'state'})).content[0].text, guide.unavailableText(guide.bridgeClosed));
});

test('quadro: criar manda um callRef próprio e nunca o do modelo; prévia devolve o print', async () => {
  const sent = [];
  const fakeCreate = async (grant, spec, options) => { sent.push({grant, spec, options}); return {id: 'act_1', version: 1, title: spec.title}; };
  const fakePreview = async () => ({screenshot: {data: 'iVBOR', mimeType: 'image/png'}, width: 360, theme: 'claro', contentHeight: 200, consoleMessages: []});
  const [preview, create] = activityTools({grant: GRANT, create: fakeCreate, preview: fakePreview});
  assert.deepEqual(canonical(create.inputSchema), canonicalFields(CREATE_FIELDS));
  const published = await create.call({title: 'Derivada', objective: 'ver', alternativeMarkdown: 'texto', callRef: 'forjado-pelo-modelo'});
  assert.match(published.content[0].text, /act_1 v1/);
  assert.match(sent[0].options.callRef, /^opencode-[0-9a-f-]{36}$/);
  assert.equal((await preview.call({html: '<p>oi</p>'})).content[0].type, 'image');
});

test('sem ponte no ambiente a ferramenta não existe', () => {
  assert.deepEqual(mesaTools({}).map((tool) => tool.name), []);
  assert.deepEqual(mesaTools({LEARNING_DESK_GGB_BRIDGE: '/r/ggb.json', LEARNING_DESK_ACTIVITY_BRIDGE: JSON.stringify(GRANT)}).map((tool) => tool.name),
    ['geogebra', 'previsualizar_atividade', 'criar_atividade', 'ver_figura', 'ler_pdf']);
  assert.deepEqual(mesaTools({LEARNING_DESK_ACTIVITY_BRIDGE: 'torto'}).map((tool) => tool.name), []);
});

test('livro de chamadas: o hash do SSE casa com o da ponte, nos dois sentidos, e cada id vale uma vez', async () => {
  const calls = createOpenCodeActivityCalls({waitMs: 50});
  const args = {title: 'Derivada', objective: 'ver', alternativeMarkdown: 'texto', html: '<p>x</p>'};
  const {paramsHash} = pickPayload({...args, callRef: 'opencode-x'});
  calls.observe({type: 'tool_start', name: 'mesa_geogebra', id: 'call_g', args});
  calls.observe({type: 'tool_start', name: 'mesa_criar_atividade', id: 'call_1', args});
  assert.equal(await calls.claim(paramsHash), 'call_1');
  const later = calls.claim(paramsHash);
  calls.observe({type: 'tool_start', name: 'mesa_criar_atividade', id: 'call_2', args});
  assert.equal(await later, 'call_2');
  const lines = [];
  const lonely = createOpenCodeActivityCalls({waitMs: 20, log: (line) => lines.push(JSON.parse(line))});
  assert.match(await lonely.claim(paramsHash), /^opencode-mcp:/);
  assert.equal(lines[0].level, 'warn');
});

test('ponta a ponta por stdio: o servidor sobe e lista as ferramentas da Mesa', async () => {
  const child = spawn(process.execPath, [SERVER], {env: {...process.env, LEARNING_DESK_GGB_BRIDGE: '/r/ggb.json', LEARNING_DESK_ACTIVITY_BRIDGE: JSON.stringify(GRANT)}, stdio: ['pipe', 'pipe', 'pipe']});
  const answers = [];
  child.stdout.setEncoding('utf8');
  let buffer = '';
  const listed = new Promise((resolve) => child.stdout.on('data', (chunk) => {
    buffer += chunk;
    for (const line of buffer.split('\n').slice(0, -1)) answers.push(JSON.parse(line));
    buffer = buffer.slice(buffer.lastIndexOf('\n') + 1);
    if (answers.length >= 2) resolve();
  }));
  child.stdin.write('{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}\n{"jsonrpc":"2.0","method":"notifications/initialized"}\n{"jsonrpc":"2.0","id":2,"method":"tools/list"}\n');
  await listed;
  child.kill();
  assert.equal(answers[0].result.serverInfo.name, 'mesa');
  assert.deepEqual(answers[1].result.tools.map((tool) => tool.name), ['geogebra', 'previsualizar_atividade', 'criar_atividade', 'ver_figura', 'ler_pdf']);
});
