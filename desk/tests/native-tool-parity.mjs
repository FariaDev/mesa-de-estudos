/* Paridade Pi × Claude das ferramentas do tutor (#40), de ponta a ponta: o SDK
   do Pi instalado carrega as extensões reais da Mesa (sem modelo, sem
   credencial, numa pasta temporária) e o SDK do Claude anuncia o servidor
   `mesa` pelo protocolo MCP. Para cada ferramenta, o modelo dos dois motores
   tem de ver a MESMA descrição e o MESMO esquema (tipos, limites, opções,
   obrigatórios e textos de campo). Espelha `native-activity-tool.mjs`. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {InMemoryTransport} from '@modelcontextprotocol/sdk/inMemory.js';
import {canonical} from '../src/extensions/tool-fields.mjs';
const require = createRequire(import.meta.url);
const {resolvePi} = require('../pi.cjs');
const {createStudyToolsServer} = require('../src/agents/study-tools.cjs');
const desk = path.resolve(import.meta.dirname, '..');

let bin = '';
try {
  bin = resolvePi({deskDir: desk});
} catch {}
if (!bin || !fs.existsSync(bin)) {
  console.log('PULADO: o Pi não está instalado nesta máquina.');
  process.exit(77);
}
let pkg = path.dirname(fs.realpathSync(bin));
while (!fs.existsSync(path.join(pkg, 'package.json'))) pkg = path.dirname(pkg);
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-tool-parity-'));
const agentDir = path.join(root, 'agent');
fs.mkdirSync(agentDir);
process.env.PI_CODING_AGENT_DIR = agentDir;
/* As extensões só registram as ferramentas com uma ponte; nada é chamado. */
process.env.LEARNING_DESK_ACTIVITY_BRIDGE = JSON.stringify({url: 'http://127.0.0.1:9/activity', token: 'paridade'});
process.env.LEARNING_DESK_MATERIAL_BRIDGE = JSON.stringify({url: 'http://127.0.0.1:9/pdf', token: 'paridade'});
process.env.LEARNING_DESK_GGB_BRIDGE = path.join(root, 'ggb-bridge.json');
/* O GeoGebra segue o idioma do tutor (#41): o Pi lê do ambiente, o Claude do parâmetro. */
process.env.LEARNING_DESK_TUTOR_LANGUAGE = 'en';

let session;
try {
  const sdk = await import(pathToFileURL(path.join(pkg, 'dist', 'index.js')));
  const settingsManager = sdk.SettingsManager.create(root, agentDir);
  const resourceLoader = new sdk.DefaultResourceLoader({
    cwd: root, agentDir, settingsManager, noExtensions: true, noSkills: true,
    noPromptTemplates: true, noProjectContext: true,
    additionalExtensionPaths: ['tutor-pdf', 'mesa-activity', 'mesa-figure', 'mesa-geogebra'].map((name) => path.join(desk, 'src', 'extensions', name)),
  });
  await resourceLoader.reload();
  const model = {id: 'fixture', name: 'No inference', provider: 'fixture', api: 'openai-completions', baseUrl: 'http://127.0.0.1:1', reasoning: false, input: ['text'], cost: {input: 0, output: 0, cacheRead: 0, cacheWrite: 0}, contextWindow: 100000, maxTokens: 1000};
  ({session} = await sdk.createAgentSession({cwd: root, agentDir, model, resourceLoader, settingsManager, sessionManager: sdk.SessionManager.inMemory()}));
  await session.bindExtensions({});
  const piTools = Object.fromEntries(session.agent.state.tools.filter((tool) => tool.name.startsWith('mesa_')).map((tool) => [tool.name.slice('mesa_'.length), tool]));

  const server = await createStudyToolsServer({createMaterial: async () => ({}), createActivity: async () => ({}), previewActivity: async () => ({}), viewFigure: async () => ({}), geogebra: {run: async () => ({}), state: async () => ({}), screenshot: async () => ({})}, tutorLanguage: 'en'});
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({name: 'mesa-parity', version: '1.0.0'});
  await server.instance.connect(b);
  await client.connect(a);
  let claudeTools;
  try {
    claudeTools = Object.fromEntries((await client.listTools()).tools.map((tool) => [tool.name, tool]));
  } finally {
    await client.close();
    await server.instance.close();
  }

  assert.deepEqual(Object.keys(piTools).sort(), ['criar_atividade', 'criar_pdf', 'geogebra', 'previsualizar_atividade', 'ver_figura']);
  assert.deepEqual(Object.keys(claudeTools).sort(), Object.keys(piTools).sort(), 'as mesmas ferramentas nos dois motores');
  assert.match(piTools.geogebra.description, /^Control the GeoGebra applet/, 'geogebra: o Pi fala o idioma do tutor');
  for (const [name, pi] of Object.entries(piTools)) {
    const claude = claudeTools[name];
    assert.equal(pi.description, claude.description, `${name}: descrição`);
    assert.deepEqual(canonical(pi.parameters), canonical(claude.inputSchema), `${name}: esquema`);
  }
  console.log('ok: criar_pdf, criar_atividade, previsualizar_atividade, ver_figura e geogebra iguais no Pi e no Claude (descrição e esquema)');
} finally {
  session?.dispose?.();
  fs.rmSync(root, {recursive: true, force: true});
}
