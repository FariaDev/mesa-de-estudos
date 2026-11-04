/* GeoGebra no Pi (#53/B1): a extensão real no SDK instalado, sem modelo nem
   credencial. A ponte aponta para um arquivo que não existe: é o caso "ponte
   fechada", que precisa voltar como isError — comando recusado continua
   resultado normal. Espelha `native-figure-tool.mjs`. */
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {mesaExtensionPaths} from '../src/agents/mesa-tool-catalog.cjs';
import {guideFor} from '../src/extensions/mesa-geogebra/guide.mjs';

const require = createRequire(import.meta.url);
const {resolvePi} = require('../pi.cjs');
const desk = path.resolve(import.meta.dirname, '..');

let bin = '';
try { bin = resolvePi({deskDir: desk}); } catch { /* sem Pi */ }

test('B1 no Pi: ponte fechada vira isError; run sem comando não', {skip: !bin || !fs.existsSync(bin) ? 'o Pi não está instalado nesta máquina' : false}, async () => {
  let pkg = path.dirname(fs.realpathSync(bin));
  while (!fs.existsSync(path.join(pkg, 'package.json'))) pkg = path.dirname(pkg);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-geogebra-errors-'));
  const agentDir = path.join(root, 'agent');
  fs.mkdirSync(agentDir);
  process.env.PI_CODING_AGENT_DIR = agentDir;
  process.env.LEARNING_DESK_GGB_BRIDGE = path.join(root, 'ponte-que-nao-existe.json');
  process.env.LEARNING_DESK_TUTOR_LANGUAGE = 'pt-BR';
  let session;
  try {
    const sdk = await import(pathToFileURL(path.join(pkg, 'dist', 'index.js')));
    const settingsManager = sdk.SettingsManager.create(root, agentDir);
    const resourceLoader = new sdk.DefaultResourceLoader({
      cwd: root, agentDir, settingsManager, noExtensions: true, noSkills: true,
      noPromptTemplates: true, noProjectContext: true,
      additionalExtensionPaths: mesaExtensionPaths(desk).filter((dir) => dir.endsWith('mesa-geogebra')),
    });
    await resourceLoader.reload();
    const model = {id: 'fixture', name: 'Sem inferência', provider: 'fixture', api: 'openai-completions', baseUrl: 'http://127.0.0.1:9', reasoning: false, input: ['text'], cost: {input: 0, output: 0, cacheRead: 0, cacheWrite: 0}, contextWindow: 100000, maxTokens: 1000};
    ({session} = await sdk.createAgentSession({cwd: root, agentDir, model, resourceLoader, settingsManager, sessionManager: sdk.SessionManager.inMemory()}));
    await session.bindExtensions({});
    const tool = session.agent.state.tools.find((entry) => entry.name === 'mesa_geogebra');
    assert.ok(tool, 'extensão nativa mesa-geogebra disponível ao tutor');
    const guide = guideFor('pt-BR');
    const closed = await tool.execute('call-ggb-1', {action: 'state'}, new AbortController().signal);
    assert.equal(closed.isError, true, 'ponte fechada é erro do protocolo');
    assert.match(closed.content[0].text, new RegExp(guide.unavailableText(guide.bridgeClosed).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    const missing = await tool.execute('call-ggb-2', {action: 'run'}, new AbortController().signal);
    assert.notEqual(missing.isError, true, 'falta de comando continua resultado normal');
    assert.equal(missing.content[0].text, guide.missingCommandText);
  } finally {
    if (session) {
      await session._extensionRunner.emit({type: 'session_shutdown'});
      session.dispose();
    }
    fs.rmSync(root, {recursive: true, force: true});
  }
});
