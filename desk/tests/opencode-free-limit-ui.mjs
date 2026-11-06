/* O limite do grátis na janela real (429 `FreeUsageLimitError` do 2.2.4, sem
   credencial e com as travas da Mesa): o turno falha sem derrubar a conexão —
   a frase clara aparece NA CONVERSA (diário do turno), o envio volta e a
   conexão segue de pé. A saída mora no aviso sob a faixa: sem conta, "Usar
   modelos grátis" abre o diálogo de login e chave; depois da chave, o mesmo
   erro sugere outro modelo e o botão abre o seletor; trocar para um pago e
   reenviar funciona na mesma conversa. Nenhum modelo de verdade: o `serve` é
   o `fake-opencode.mjs` com `FAKE_OPENCODE_FAIL=free-limit` (o formato real,
   que só falha no grátis) e a chave é testada no console falso. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {withArtifacts,newRuntime,seedCourse,writeDeskJson,writeConfigJson,launchDesk,sendEnabled,statusOnline,currentEngine,pickModel,selectedModelKey,modelRows} from './helpers.mjs';
import {pollUntil} from './waits.mjs';
import {createFakeOpencode} from './fake-opencode.mjs';
import {trackTempDir} from './temp-dir.mjs';

const require = createRequire(import.meta.url);
const conversations = require('../src/agents/conversations.cjs');
const FAKE_OPENCODE_BIN = path.resolve(import.meta.dirname, 'fake-opencode.mjs');
const CIPHER = path.resolve(import.meta.dirname, 'fake-secret-cipher.cjs');
const KEY = 'sk-janela-teste-limite-gratis-11223344';
const FREE_MODEL = 'deepseek-v4.1-flash-free';
const PAID_MODEL = 'gpt-5.5';
const FREE_LINE = 'O modelo grátis não respondeu aqui. Entre numa conta ou use uma chave.';
const LOGGED_LINE = 'O modelo grátis não respondeu aqui. Escolha outro modelo para continuar.';
const ASK = 'Explique derivadas, por favor';

const tempDir = (tag) => trackTempDir(fs.mkdtempSync(path.join(os.tmpdir(), `mesa-${tag}-`)));
const dialogText = (page) => page.locator('#free-models-dialog').innerText().then((text) => text.replace(/\s+/g, ' ').trim());
const bodyText = (page) => page.evaluate(() => document.body.innerText);
const noticeText = (page) => page.locator('#free-limit-note').innerText();
const errorVisible = (page, line) => page.waitForFunction((wanted) => {
  const toast = document.querySelector('#toast');
  return [...document.querySelectorAll('body *')].some((el) => !toast?.contains(el) && el.children.length === 0 && el.textContent.includes(wanted));
}, line, {timeout: 30000});
/* A troca de modelo ainda pode estar em voo quando a linha é clicada (o host
   recusa o envio com "turno em andamento" e a fila segura); esperar o
   indicador evita a corrida sem espera fixa. */
const pickSettled = (page, id) => pollUntil(() => selectedModelKey(page), (value) => value && JSON.parse(value)[1] === id, {what: `o modelo ${id} escolhido`, timeout: 30000});

await withArtifacts('opencode-free-limit', async (ctx) => {
  const fake = await createFakeOpencode({validKeys: [KEY]});
  const runtime = ctx.runtime = newRuntime('opencode-free-limit');
  const folder = seedCourse(runtime, 'Calculo');
  writeConfigJson(runtime, {vaultPath: runtime, courses: [{id: 'Calculo', name: 'Cálculo', path: folder}]});
  const first = conversations.createClaudeConversation({runtime, courseId: 'Calculo', engine: 'opencode'});
  writeDeskJson(runtime, {courseId: 'Calculo', session: first, courseStates: {Calculo: {session: first, sessions: [{path: first}]}}});
  fs.chmodSync(FAKE_OPENCODE_BIN, 0o755);
  const clipboardFile = path.join(tempDir('clip'), 'clipboard.txt');
  fs.writeFileSync(clipboardFile, 'texto qualquer que não é chave');
  const app = ctx.app = await launchDesk({runtime, opencode: false, env: {
    LEARNING_DESK_OPENCODE: FAKE_OPENCODE_BIN, FAKE_OPENCODE_FAIL: 'free-limit',
    LEARNING_DESK_OPENCODE_BASE: fake.url, LEARNING_DESK_SECRET_CIPHER: CIPHER,
    LEARNING_DESK_FAKE_CLIPBOARD: clipboardFile,
  }});
  const page = await app.firstWindow();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await statusOnline(page, {timeout: 60000});
  assert.equal(await currentEngine(page), 'opencode');
  await pollUntil(async () => (await modelRows(page)).length, (count) => count >= 3, {what: 'o catálogo do servidor no seletor', timeout: 30000});
  await pickModel(page, 'opencode', FREE_MODEL);
  await pickSettled(page, FREE_MODEL);

  /* 1. O grátis falha com a frase clara na conversa; a sessão não trava. */
  await page.locator('#prompt').fill(ASK);
  await page.locator('#send').click();
  await errorVisible(page, FREE_LINE);
  await sendEnabled(page, {timeout: 30000});
  await statusOnline(page, {timeout: 15000});
  assert.ok((await bodyText(page)).includes(ASK), 'a mensagem do aluno continua na conversa');
  assert.ok(!(await bodyText(page)).includes('FreeUsageLimitError'), 'o formato cru não vaza para a tela');
  assert.ok(!(await bodyText(page)).includes('retryAfterMs'), 'o detalhe do serviço não vaza para a tela');

  /* 2. A saída sem conta: o aviso sugere entrar ou usar chave e abre o diálogo. */
  await page.locator('#free-limit-note:not([hidden])').waitFor({timeout: 15000});
  assert.equal(((await noticeText(page)).replace(/\s+/g, ' ').trim()), `${FREE_LINE} Entrar ou usar chave`);
  /* A frase aparece uma vez fora do diário e não encosta na lateral da coluna. */
  const shown = await page.evaluate((line) => {
    const note = document.querySelector('#free-limit-note');
    return {
      activity: document.querySelector('#activity')?.textContent.includes(line),
      toast: document.querySelector('#toast')?.textContent.includes(line),
      gap: note.querySelector('p').getBoundingClientRect().left - note.parentElement.getBoundingClientRect().left,
      role: note.getAttribute('role'),
    };
  }, FREE_LINE);
  assert.deepEqual([shown.activity, shown.toast, shown.role], [false, false, 'status'], `aviso repetido: ${JSON.stringify(shown)}`);
  assert.ok(shown.gap >= 8, `aviso encostado na lateral (${shown.gap}px)`);
  await page.locator('#free-limit-note .free-limit-action').click();
  await page.waitForSelector('#free-models-dialog[open]', {timeout: 15000});
  assert.ok((await dialogText(page)).includes('Os modelos grátis vêm do OpenCode Zen'), 'abre o diálogo de login e chave que já existe');

  /* 3. Entrar com a chave (console falso): testa só a lista, guarda e religa. */
  await page.locator('#free-models-open-site').click();
  await page.locator('#free-models-key').waitFor({state: 'visible', timeout: 15000});
  fs.writeFileSync(clipboardFile, `${KEY}\n`);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.locator('#free-models-clip').waitFor({state: 'visible', timeout: 15000});
  await page.locator('#free-models-clip-yes').click();
  await page.waitForSelector('#free-models-done:not(:empty)', {timeout: 30000});
  assert.ok(!(await page.content()).includes(KEY), 'a chave inteira nunca chega à página');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('#free-models-dialog').open, undefined, {timeout: 15000});
  assert.equal(await page.evaluate(() => window.desk.opencodeStatus().then((info) => !!info?.saved)), true, 'a chave ficou guardada');
  await statusOnline(page, {timeout: 60000});

  /* 4. Com conta, o mesmo erro não pede login: sugere outro modelo. */
  await pickModel(page, 'opencode', FREE_MODEL);
  await pickSettled(page, FREE_MODEL);
  await page.locator('#prompt').fill(ASK);
  await page.locator('#send').click();
  await errorVisible(page, LOGGED_LINE);
  await sendEnabled(page, {timeout: 30000});
  await page.locator('#free-limit-note:not([hidden])').waitFor({timeout: 15000});
  /* A mudança de conexão que chega depois do erro avisa pelo mesmo evento da troca
     de modelo; com o modelo igual, o aviso fica (sumia em 1 de cada 5 execuções). */
  await page.evaluate(() => window.dispatchEvent(new Event('desk-tutor-link')));
  assert.equal(await page.locator('#free-limit-note').isHidden(), false, 'o aviso não some sem troca de modelo');
  const logged = (await noticeText(page)).replace(/\s+/g, ' ').trim();
  assert.equal(logged, `${LOGGED_LINE} Escolher outro modelo`);
  assert.ok(!/entre numa conta/i.test(logged), 'quem já entrou não ouve "entre"');
  await page.locator('#free-limit-note .free-limit-action').click();
  await page.locator('#model-pop:not([hidden])').waitFor({timeout: 15000});

  /* 5. Modelo pago + reenvio: a mesma conversa responde, sem repetir o erro. */
  await pickModel(page, 'opencode', PAID_MODEL);
  if (await page.locator('#free-models-dialog[open]').count()) {
    await page.locator('#free-models-paid-yes').click();
    await page.waitForFunction(() => !document.querySelector('#free-models-dialog').open, undefined, {timeout: 15000});
  }
  await pickSettled(page, PAID_MODEL);
  /* Escolher outro modelo, sem enviar, já esconde o aviso (a troca chega pelo
     evento de seleção de modelo). */
  await page.waitForFunction(() => document.querySelector('#free-limit-note')?.hidden, undefined, {timeout: 15000});
  assert.equal(await page.locator('#free-limit-note').isHidden(), true, 'trocar de modelo esconde o aviso antes de enviar');
  const answersBefore = await page.locator('#messages .message:not(.user)').count();
  await page.locator('#prompt').fill(ASK);
  await page.locator('#send').click();
  await page.waitForFunction((count) => document.querySelectorAll('#messages .message:not(.user)').length > count, answersBefore, {timeout: 60000});
  await sendEnabled(page, {timeout: 30000});
  await statusOnline(page, {timeout: 15000});
  assert.ok((await bodyText(page)).includes('Resposta do OpenCode falso'), 'o pago responde na mesma conversa');
  assert.deepEqual(errors, [], 'sem erro de página');
  await fake.close();
});
console.log('ok opencode-free-limit-ui');
