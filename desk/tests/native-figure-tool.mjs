/* SDK Pi instalado, extensão real e ponte HTTP real; nenhum modelo/credencial.
   Prova que `mesa_ver_figura` (#60) vai do `execute` do Pi até o host de captura
   pela ponte e volta com o print e o resumo. A janela é a falsa de
   `figure-tool.test.mjs`: o desenho real é provado em `figures-sanitize.test.mjs`.
   Espelha `native-activity-tool.mjs`. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {PLOT_PARABOLA} from './figures-fixtures.mjs';
const require = createRequire(import.meta.url);
const {resolvePi} = require('../pi.cjs');
const {createActivityBridge} = require('../activity-bridge.cjs');
const {createFigurePreview} = require('../figure-preview.cjs');
const guide = await import('../src/extensions/mesa-figure/guide.mjs');
const desk = path.resolve(import.meta.dirname, '..');

let bin = '';
try { bin = resolvePi({deskDir: desk}); } catch { /* sem Pi */ }
if (!bin || !fs.existsSync(bin)) {
  console.log('PULADO: o Pi não está instalado nesta máquina.');
  process.exit(77);
}
let pkg = path.dirname(fs.realpathSync(bin));
while (!fs.existsSync(path.join(pkg, 'package.json'))) pkg = path.dirname(pkg);
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-native-figure-'));
const agentDir = path.join(root, 'agent');
fs.mkdirSync(agentDir);
process.env.PI_CODING_AGENT_DIR = agentDir;

const seen = [];
const fakeWindow = {
  loadFile: async () => {}, isDestroyed: () => false, destroy: () => {}, setContentSize: () => {},
  webContents: {
    executeJavaScript: async (code) => { seen.push(code); return {plots: 1, svgs: 0, warnings: [], removed: [], contentHeight: 240}; },
    capturePage: async ({width, height}) => ({getSize: () => ({width, height}), toPNG: () => Buffer.from('png-do-pi')}),
  },
};
const figure = createFigurePreview({createWindow: () => fakeWindow});
const bridge = createActivityBridge({publish: async () => ({}), figure: (raw) => figure.preview(raw)});
await bridge.start();
process.env.LEARNING_DESK_ACTIVITY_BRIDGE = JSON.stringify(bridge.grant({conversationId: path.join(root, 'pi-native.jsonl'), generation: 1}));

let session;
try {
  const sdk = await import(pathToFileURL(path.join(pkg, 'dist', 'index.js')));
  const settingsManager = sdk.SettingsManager.create(root, agentDir);
  const resourceLoader = new sdk.DefaultResourceLoader({
    cwd: root, agentDir, settingsManager, noExtensions: true, noSkills: true,
    noPromptTemplates: true, noProjectContext: true,
    additionalExtensionPaths: [path.join(desk, 'src', 'extensions', 'mesa-figure')],
  });
  await resourceLoader.reload();
  const model = {id: 'fixture', name: 'No inference', provider: 'fixture', api: 'openai-completions', baseUrl: 'http://127.0.0.1:1', reasoning: false, input: ['text'], cost: {input: 0, output: 0, cacheRead: 0, cacheWrite: 0}, contextWindow: 100000, maxTokens: 1000};
  ({session} = await sdk.createAgentSession({cwd: root, agentDir, model, resourceLoader, settingsManager, sessionManager: sdk.SessionManager.inMemory()}));
  await session.bindExtensions({});
  const tool = session.agent.state.tools.find((entry) => entry.name === 'mesa_ver_figura');
  assert.ok(tool, 'extensão nativa mesa-figure disponível ao tutor');
  assert.equal(tool.description, guide.FIGURE_DESCRIPTION, 'descrição idêntica à do Claude e do OpenCode');
  const result = await tool.execute('call-figure-1', {kind: 'plot', source: PLOT_PARABOLA, theme: 'escuro', width: 400}, new AbortController().signal);
  assert.deepEqual(result.content[0], {type: 'image', data: Buffer.from('png-do-pi').toString('base64'), mimeType: 'image/png'});
  assert.match(result.content[1].text, /^Figura em 400px \(escuro\)/);
  assert.match(seen[0], /"kind":"plot".*"theme":"escuro"/);
  assert.deepEqual(result.details.figure.warnings, []);
  await assert.rejects(tool.execute('call-figure-2', {kind: 'png', source: 'x'}, new AbortController().signal), /esperado "plot" ou "svg"/);
  console.log('PASS: SDK Pi carrega a extensão mesa-figure e desenha pela ponte HTTP real; sem inferência.');
} finally {
  if (session) {
    await session._extensionRunner.emit({type: 'session_shutdown'});
    session.dispose();
  }
  await bridge.close();
  fs.rmSync(root, {recursive: true, force: true});
}
