/* O grátis do Zen respondendo na janela real, sem chave (achado de
   2026-11-05: o 429 `FreeUsageLimitError` só aparece quando `read` não é
   oferecida). Contra o `fake-opencode.mjs` no lugar do `serve`: o modelo
   grátis escolhido responde, a conexão fica de pé e NENHUM aviso novo aparece
   — em especial o `#free-limit-note`, que continua reservado ao limite real. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {withArtifacts,newRuntime,seedCourse,writeDeskJson,writeConfigJson,launchDesk,sendEnabled,statusOnline,currentEngine,pickModel,selectedModelKey,modelRows} from './helpers.mjs';
import {pollUntil} from './waits.mjs';
import {trackTempDir} from './temp-dir.mjs';

const require = createRequire(import.meta.url);
const conversations = require('../src/agents/conversations.cjs');
const FAKE_OPENCODE_BIN = path.resolve(import.meta.dirname, 'fake-opencode.mjs');
const FREE_MODEL = 'deepseek-v4.1-flash-free';

const readLog = (file) => fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line)) : [];

await withArtifacts('opencode-free-answers', async (ctx) => {
  const runtime = ctx.runtime = newRuntime('opencode-free-answers');
  const folder = seedCourse(runtime, 'Calculo');
  writeConfigJson(runtime, {vaultPath: runtime, courses: [{id: 'Calculo', name: 'Cálculo', path: folder}]});
  const first = conversations.createClaudeConversation({runtime, courseId: 'Calculo', engine: 'opencode'});
  writeDeskJson(runtime, {courseId: 'Calculo', session: first, courseStates: {Calculo: {session: first, sessions: [{path: first}]}}});
  fs.chmodSync(FAKE_OPENCODE_BIN, 0o755);
  const serveLog = path.join(trackTempDir(fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-free-answer-'))), 'serve.jsonl');
  const app = ctx.app = await launchDesk({runtime, opencode: false, env: {LEARNING_DESK_OPENCODE: FAKE_OPENCODE_BIN, FAKE_OPENCODE_LOG: serveLog}});
  const page = await app.firstWindow();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await statusOnline(page, {timeout: 60000});
  assert.equal(await currentEngine(page), 'opencode');
  await pollUntil(async () => (await modelRows(page)).length, (count) => count >= 3, {what: 'o catálogo do servidor no seletor', timeout: 30000});
  await pickModel(page, 'opencode', FREE_MODEL);
  await pollUntil(() => selectedModelKey(page), (value) => value && JSON.parse(value)[1] === FREE_MODEL, {what: `o modelo ${FREE_MODEL} escolhido`, timeout: 30000});

  await page.locator('#prompt').fill('Diga só: oi');
  await page.locator('#send').click();
  await page.waitForFunction(() => [...document.querySelectorAll('.message.assistant .body')].some((el) => el.textContent.includes('Resposta do OpenCode falso')), undefined, {timeout: 30000});
  await sendEnabled(page, {timeout: 30000});
  await statusOnline(page, {timeout: 15000});

  const start = readLog(serveLog).find((entry) => entry.start);
  assert.equal(start.keyPresent, false, 'o servidor subiu sem chave');
  const text = await page.evaluate(() => document.body.innerText);
  for (const line of ['O modelo grátis não respondeu aqui.', 'Entre numa conta ou use uma chave.', 'Escolha outro modelo para continuar.']) {
    assert.equal(text.includes(line), false, `sem a frase do limite: ${line}`);
  }
  assert.equal(await page.locator('#free-limit-note').isHidden(), true, 'sem aviso de limite do grátis');
  assert.equal(await page.locator('#toast').isHidden(), true, 'sem aviso novo');
  assert.deepEqual(errors, [], 'sem erro de página');
});
console.log('ok opencode-free-answers-ui');
