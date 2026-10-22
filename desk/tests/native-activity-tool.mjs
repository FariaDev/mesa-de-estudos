/* SDK Pi instalado, extensão real e ponte HTTP real; nenhum modelo/credencial.
   Prova que `mesa_criar_atividade` envia o toolCallId do execute e que o
   documento fica servível pelo runtime. Espelha `native-tutor-pdf.mjs`. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const {resolvePi} = require('../pi.cjs');
const {createActivityStore} = require('../activity-store.cjs');
const {createActivityRuntime} = require('../activity-runtime.cjs');
const {createActivityBridge, createActivityService, createCallRegistry} = require('../activity-bridge.cjs');
const desk = path.resolve(import.meta.dirname, '..');
let pkg = path.dirname(fs.realpathSync(resolvePi({deskDir: desk})));
while (!fs.existsSync(path.join(pkg, 'package.json'))) pkg = path.dirname(pkg);
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-native-activity-'));
const agentDir = path.join(root, 'agent');
fs.mkdirSync(agentDir);
process.env.PI_CODING_AGENT_DIR = agentDir;

const runtime = path.join(root, 'runtime');
fs.mkdirSync(runtime);
const store = createActivityStore({runtime});
const activityRuntime = createActivityRuntime({store});
const conversationId = path.join(runtime, 'pi-native.jsonl');
const service = createActivityService({store, runtime: activityRuntime, registry: createCallRegistry(), isScopeActive: () => true, emit: () => {}});
const bridge = createActivityBridge({publish: (scope, spec, caller) => service.publish(scope, spec, caller)});
await bridge.start();
process.env.LEARNING_DESK_ACTIVITY_BRIDGE = JSON.stringify(bridge.grant({conversationId, generation: 1}));

let session;
try {
  const sdk = await import(pathToFileURL(path.join(pkg, 'dist', 'index.js')));
  const settingsManager = sdk.SettingsManager.create(root, agentDir);
  const resourceLoader = new sdk.DefaultResourceLoader({
    cwd: root, agentDir, settingsManager, noExtensions: true, noSkills: true,
    noPromptTemplates: true, noProjectContext: true,
    additionalExtensionPaths: [path.join(desk, 'src', 'extensions', 'mesa-activity')],
  });
  await resourceLoader.reload();
  const model = {id: 'fixture', name: 'No inference', provider: 'fixture', api: 'openai-completions', baseUrl: 'http://127.0.0.1:1', reasoning: false, input: ['text'], cost: {input: 0, output: 0, cacheRead: 0, cacheWrite: 0}, contextWindow: 100000, maxTokens: 1000};
  ({session} = await sdk.createAgentSession({cwd: root, agentDir, model, resourceLoader, settingsManager, sessionManager: sdk.SessionManager.inMemory()}));
  await session.bindExtensions({});
  const tool = session.agent.state.tools.find((entry) => entry.name === 'mesa_criar_atividade');
  assert.ok(tool, 'extensão nativa mesa-activity disponível ao tutor');
  /* #42: a prévia vem junto, e os textos são os mesmos do Claude (paridade). */
  const previewTool = session.agent.state.tools.find((entry) => entry.name === 'mesa_previsualizar_atividade');
  assert.ok(previewTool, 'a prévia do quadro está disponível ao tutor no Pi');
  const claude = require('../src/agents/activity-tools.cjs');
  assert.equal(tool.description, claude.ACTIVITY_TOOL_DESCRIPTION, 'descrição de mostrar idêntica no Pi e no Claude');
  assert.equal(previewTool.description, claude.PREVIEW_TOOL_DESCRIPTION, 'descrição da prévia idêntica no Pi e no Claude');
  assert.ok(tool.parameters?.properties?.kind && tool.parameters?.properties?.charts, 'o Pi aceita o tipo e os gráficos');
  const result = await tool.execute('call-native-1', {
    title: 'MRUV nativo',
    objective: 'Explorar aceleração sem provedor',
    alternativeMarkdown: 's(3) = 6 + 4,5a',
    html: '<p>Explore</p>',
    css: '',
    js: 'window.mesa.state({a:2});',
  }, new AbortController().signal);
  assert.equal(result.details.activity.toolCallId, 'call-native-1');
  assert.equal(result.details.activity.kind, 'activity');
  const items = store.list({conversationId});
  assert.equal(items.length, 1);
  assert.equal(items[0].toolCallId, 'call-native-1');
  assert.equal(items[0].generation, 1);
  assert.equal(activityRuntime.has(items[0].id, items[0].version), true, 'runtime serve o documento publicado');
  const response = await activityRuntime.protocolHandler({url: `mesa-activity://artifact/${items[0].id}/${items[0].version}/index.html`});
  assert.equal(response.status, 200);
  console.log('PASS: SDK Pi carrega a extensão mesa-activity e publica pela ponte HTTP real; sem inferência.');
} finally {
  if (session) {
    await session._extensionRunner.emit({type: 'session_shutdown'});
    session.dispose();
  }
  await bridge.close();
  fs.rmSync(root, {recursive: true, force: true});
}
