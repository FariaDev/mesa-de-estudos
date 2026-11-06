/* E3 (auditoria rodada 3): turno que falha antes de qualquer resposta mostra o
   motivo sem clique — o diário começa aberto. Turno com resposta parcial segue
   recolhido, e o 429 do limite do grátis segue recolhido (o aviso próprio já
   mostra o motivo, sem virar duas mensagens). Contra o `fake-opencode.mjs`:
   `FAKE_OPENCODE_FAIL=free-tier` (403), `=free-limit` (429) e
   `FAKE_OPENCODE_CHAOS=desk-error` (texto parcial + falha). Capturas em
   /tmp/opencode/ui-auditoria/e3-e4 (antes de cada asserção, para a rodada do
   "antes" também deixar PNG). */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {withArtifacts, newRuntime, seedCourse, writeDeskJson, writeConfigJson, launchDesk, sendEnabled, statusOnline, resizeWindow, pickModel, modelRows, selectedModelKey} from './helpers.mjs';
import {pollUntil} from './waits.mjs';

const require = createRequire(import.meta.url);
const conversations = require('../src/agents/conversations.cjs');
const FAKE_OPENCODE_BIN = path.resolve(import.meta.dirname, 'fake-opencode.mjs');
const OUT = '/tmp/opencode/ui-auditoria/e3-e4';
fs.mkdirSync(OUT, {recursive: true});
const FREE_TIER_LINE = 'recusou o modelo grátis';
const FREE_LIMIT_LINE = 'não respondeu aqui';
const PARTIAL_LINE = 'Começou a responder';

const boot = async (ctx, tag, env) => {
  const runtime = ctx.runtime = newRuntime(tag);
  const folder = seedCourse(runtime, 'Calculo');
  writeConfigJson(runtime, {vaultPath: runtime, courses: [{id: 'Calculo', name: 'Cálculo', path: folder}]});
  const first = conversations.createClaudeConversation({runtime, courseId: 'Calculo', engine: 'opencode'});
  writeDeskJson(runtime, {courseId: 'Calculo', session: first, courseStates: {Calculo: {session: first, sessions: [{path: first}]}}});
  fs.chmodSync(FAKE_OPENCODE_BIN, 0o755);
  const app = ctx.app = await launchDesk({runtime, opencode: false, env: {LEARNING_DESK_OPENCODE: FAKE_OPENCODE_BIN, ...env}});
  const page = await app.firstWindow();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await resizeWindow(app, page, 1440, 900);
  await statusOnline(page, {timeout: 60000});
  return {page, errors};
};
const FREE_MODEL = 'deepseek-v4.1-flash-free';
const pickFreeModel = async (page) => {
  /* O 429 só falha no grátis (medido no 2.2.4 real): escolhe o grátis antes. */
  await pollUntil(async () => (await modelRows(page)).length, (count) => count >= 3, {what: 'o catálogo do servidor no seletor', timeout: 30000});
  await pickModel(page, 'opencode', FREE_MODEL);
  await pollUntil(() => selectedModelKey(page), (value) => value && JSON.parse(value)[1] === FREE_MODEL, {what: `o modelo ${FREE_MODEL} escolhido`, timeout: 30000});
};
const failTurn = async (page, text) => {
  await page.locator('#prompt').fill(text);
  await page.locator('#send').click();
  await page.waitForSelector('article.work', {timeout: 30000});
  await sendEnabled(page, {timeout: 30000});
};
const leafVisible = (page, line) => page.evaluate((wanted) => {
  const toast = document.querySelector('#toast');
  const hit = [...document.querySelectorAll('body *')].find((el) => !toast?.contains(el) && el.children.length === 0 && el.textContent.includes(wanted));
  if (!hit) return false;
  const box = hit.getBoundingClientRect();
  return box.width > 0 && box.height > 0 && getComputedStyle(hit).visibility !== 'hidden';
}, line);
const visibleLeaves = (page, line) => page.evaluate((wanted) => {
  const toast = document.querySelector('#toast');
  return [...document.querySelectorAll('body *')].filter((el) => {
    if (toast?.contains(el) || el.children.length !== 0 || !el.textContent.includes(wanted)) return false;
    const box = el.getBoundingClientRect();
    return box.width > 0 && box.height > 0 && getComputedStyle(el).visibility !== 'hidden';
  }).length;
}, line);

/* 1. 403 sem resposta: o diário começa ABERTO com o motivo à vista; o clique
   recolhe/abre e a escolha vale. */
await withArtifacts('worklog-error-freetier', async (ctx) => {
  const {page, errors} = await boot(ctx, 'e3-freetier', {FAKE_OPENCODE_FAIL: 'free-tier'});
  await failTurn(page, 'explique derivadas');
  const diary = page.locator('article.work').last();
  await page.screenshot({path: path.join(OUT, 'e3-403-depois-1440x900.png')});
  assert.equal(await diary.getAttribute('data-expanded'), 'true', 'diário do 403 sem resposta começa aberto');
  assert.ok(await leafVisible(page, FREE_TIER_LINE), 'motivo do 403 à vista sem clique');
  assert.match(await diary.locator('.work-title').innerText(), /Turno interrompido/, 'cabeça de interrompido');
  await diary.locator('.work-head').click();
  assert.equal(await diary.getAttribute('data-expanded'), 'false', 'clique recolhe');
  assert.ok(!(await leafVisible(page, FREE_TIER_LINE)), 'recolhido esconde o motivo');
  await diary.locator('.work-head').click();
  assert.equal(await diary.getAttribute('data-expanded'), 'true', 'clique abre de novo');
  await statusOnline(page, {timeout: 15000});
  assert.deepEqual(errors, [], 'sem erro de página');
});

/* 2. 429 com o aviso próprio: a frase aparece UMA vez visível (só o aviso) e
   nenhum diário abre — sem duplicar o motivo. (Sem trabalho antes da falha o
   turno nem deixa diário: só o aviso cobre; com trabalho, o diário segue
   recolhido pelo `isFreeLimit`.) */
await withArtifacts('worklog-error-freelimit', async (ctx) => {
  const {page, errors} = await boot(ctx, 'e3-freelimit', {FAKE_OPENCODE_FAIL: 'free-limit'});
  await pickFreeModel(page);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.querySelector('#model-pop')?.hidden !== false, undefined, {timeout: 15000});
  await page.locator('#prompt').fill('explique integrais');
  await page.locator('#send').click();
  await page.locator('#free-limit-note:not([hidden])').waitFor({timeout: 30000});
  await sendEnabled(page, {timeout: 30000});
  await page.screenshot({path: path.join(OUT, 'e3-429-depois-1440x900.png')});
  assert.equal(await page.locator('article.work[data-expanded="true"]').count(), 0, 'nenhum diário aberto no 429 (só o aviso)');
  assert.equal(await visibleLeaves(page, FREE_LIMIT_LINE), 1, 'motivo do 429 visível uma vez só (o aviso)');
  await statusOnline(page, {timeout: 15000});
  assert.deepEqual(errors, [], 'sem erro de página');
});

/* 3. Resposta parcial + falha: segue recolhido, como antes. */
await withArtifacts('worklog-error-partial', async (ctx) => {
  const {page, errors} = await boot(ctx, 'e3-partial', {FAKE_OPENCODE_CHAOS: 'desk-error'});
  await page.locator('#prompt').fill('conte até três');
  await page.locator('#send').click();
  await page.waitForFunction((line) => [...document.querySelectorAll('#messages .message.assistant')].some((el) => el.textContent.includes(line)), PARTIAL_LINE, {timeout: 30000});
  await sendEnabled(page, {timeout: 30000});
  const diary = page.locator('article.work').last();
  await page.screenshot({path: path.join(OUT, 'e3-parcial-depois-1440x900.png')});
  assert.equal(await diary.getAttribute('data-expanded'), 'false', 'com resposta parcial o diário segue recolhido');
  assert.ok(await leafVisible(page, PARTIAL_LINE), 'a resposta parcial continua à vista');
  await statusOnline(page, {timeout: 15000});
  assert.deepEqual(errors, [], 'sem erro de página');
});
console.log('ok worklog-error-ui');
