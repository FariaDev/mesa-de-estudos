/* Smoke de CONTRATO do chat lateral na ponte real (preload + main + fake Pi):
   abre, promove o turno, lê histórico, salva rascunho, atualiza contexto,
   cancela e lista conversas — tudo por `window.desk`. Não usa o índice de
   teste (`npm test` não pega este arquivo); rode com `node tests/sidechat-ipc-smoke.mjs`.
   O curso/PDF é sintético (fixture), autorizado pelo config.json do runtime:
   é o único jeito de exercitar `validPdf` do main de verdade, como no app. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {_electron as electron} from '@playwright/test';
import {testEnv} from './electron-env.mjs';
import {tinyPdf} from './helpers.mjs';

const DESK = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const FAKE_PI = path.join(DESK, 'tests', 'fake-pi.mjs');
const runtime = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-sidechat-ipc-smoke-'));
fs.chmodSync(FAKE_PI, 0o755);
/* Curso sintético autorizado: o PDF entra na biblioteca da matéria (é o
   `validPdf` do main que valida as refs do open/prompt) e a página é != 1
   para o check não passar por default. */
const courseDir = path.join(runtime, 'learning', 'Courses', 'Synthetic');
fs.mkdirSync(courseDir, {recursive: true});
const pdfPath = path.join(courseDir, 'Limites.pdf');
fs.writeFileSync(pdfPath, tinyPdf('Limites', 3));
fs.writeFileSync(path.join(runtime, 'config.json'), JSON.stringify({
  runtimePath: runtime,
  vaultPath: runtime,
  courses: [{id: 'Synthetic', name: 'Matemática sintética', path: courseDir}],
}));

const launch = () => electron.launch({
  args: [path.join(DESK, 'main.cjs')],
  cwd: DESK,
  env: testEnv({LEARNING_DESK_RUNTIME: runtime, LEARNING_DESK_PI: FAKE_PI}),
});
const app = await launch();
let app2 = null;
let failed = false;
const check = (name, value, predicate) => {
  const ok = predicate(value);
  console.log(`${ok ? 'ok' : 'FALHA'}  ${name}${ok ? '' : ' -> ' + JSON.stringify(value)}`);
  if (!ok) failed = true;
  return ok;
};
try {
  const page = await app.firstWindow();
  await page.waitForFunction(() => window.desk && typeof window.desk.sidechatOpen === 'function', undefined, {timeout: 20000});
  /* `.pdf-panel` só existe depois do `init()` do renderer: a biblioteca já foi
     autorizada no main quando as refs do open chegam. */
  await page.waitForSelector('.pdf-panel', {timeout: 20000});
  await page.evaluate(() => {
    window.__scEvents = [];
    window.desk.onSidechatEvent((payload) => window.__scEvents.push(payload));
  });
  const opened = await page.evaluate((ref) => window.desk.sidechatOpen({refs: [ref]}), {path: pdfPath, page: 3});
  check('abre como Pi', opened, (value) => value.engine === 'pi' && /^sc-/.test(value.id));
  check('contexto escopado à conversa principal', opened.context, (value) => typeof value.mainSession === 'string' && Array.isArray(value.refs));
  check('open preserva a ref PDF validada (path, página != 1)', opened.context.refs,
    (value) => value.length === 1 && value[0].path === pdfPath && value[0].page === 3);
  check('abrir não inicia turno', opened, (value) => value.busy === false && value.messages.length === 0);
  const conversations = await page.evaluate(() => window.desk.conversations());
  check('conversations() é lista', conversations, (value) => Array.isArray(value));
  const prompt = await page.evaluate((id) => window.desk.sidechatPrompt({id, text: 'teorema'}), opened.id);
  check('prompt aceito sem esperar o turno, com streaming medido', prompt, (value) => value.sent === true && typeof value.streaming === 'boolean');
  await page.waitForFunction(() => window.__scEvents.some((payload) => payload.event.type === 'agent_settled'), undefined, {timeout: 20000});
  const lateralSession = path.join(runtime, 'sidechats', `${opened.id}.jsonl`);
  const sentPromptText = (() => {
    try {
      return fs.readFileSync(lateralSession, 'utf8').split('\n').filter(Boolean)
        .flatMap((line) => { try { return (JSON.parse(line).message?.content || []).filter((part) => part?.type === 'text').map((part) => part.text || ''); } catch { return []; } })
        .join('\n');
    } catch { return ''; }
  })();
  check('prompt do fake Pi carrega a ref do snapshot como PDF#page=3', sentPromptText,
    (value) => value.includes(`${pdfPath}#page=3`));
  const descriptor = JSON.parse(fs.readFileSync(path.join(runtime, 'sidechats', `${opened.id}.json`), 'utf8'));
  check('descritor persistiu a ref validada (path, página)', descriptor.context.refs,
    (value) => value.length === 1 && value[0].path === pdfPath && value[0].page === 3);
  const reopenedSame = await page.evaluate(() => window.desk.sidechatOpen({refs: []}));
  check('reabrir preserva o snapshot da abertura (não recopia o principal)', reopenedSame,
    (value) => value.id === opened.id && value.context.at === opened.context.at);
  const read = await page.evaluate((id) => window.desk.sidechatRead({id}), opened.id);
  check('histórico do lateral com resposta', read, (value) => value.messages.length >= 2 && value.messages.at(-1).role === 'assistant');
  check('eventos chegam com id do canal', await page.evaluate(() => window.__scEvents[0]), (value) => typeof value.id === 'string' && typeof value.event.type === 'string');
  const saved = await page.evaluate((id) => window.desk.sidechatSave({id, draft: 'rascunho lateral'}), opened.id);
  check('rascunho salvo', saved, (value) => value.ok === true && value.draft === 'rascunho lateral');
  const ctx = await page.evaluate((id) => window.desk.sidechatContext({id, refs: []}), opened.id);
  check('contexto atualizado', ctx, (value) => typeof value.context.at === 'number' && value.draft === 'rascunho lateral');
  const abort = await page.evaluate((id) => window.desk.sidechatAbort({id}), opened.id);
  check('abort responde pelo canal', abort, (value) => value.aborted === true || value.aborted === false);
  await page.evaluate(() => window.desk.newSession('pi'));
  const afterSwitch = await page.evaluate((id) => window.desk.sidechatRead({id}).then(() => 'sem-erro', (error) => error.message), opened.id);
  check('trocar de conversa encerra o escopo do chat antigo', afterSwitch, (value) => /não pertence/.test(String(value)));
  const reopened = await page.evaluate(() => window.desk.sidechatOpen({refs: []}));
  check('conversa nova abre chat novo', reopened, (value) => value.id !== opened.id);
  const quiz = await page.evaluate((id) => window.desk.sidechatPrompt({id, text: 'quiz'}), reopened.id);
  check('prompt de quiz aceito', quiz, (value) => value.sent === true);
  await page.waitForFunction(() => window.__scEvents.some((payload) => payload.event.type === 'extension_ui_request' && payload.event.method === 'select'), undefined, {timeout: 20000});
  const questionId = await page.evaluate(() => window.__scEvents.filter((payload) => payload.event.type === 'extension_ui_request').at(-1).event.id);
  const responded = await page.evaluate(({id, questionId: requestId}) => window.desk.sidechatRespond({id, response: {id: requestId, value: '\\(4\\)'}}), {id: reopened.id, questionId});
  check('resposta de pergunta roteada ao canal', responded, (value) => value.ok === true);
  await page.waitForFunction((id) => window.__scEvents.some((payload) => payload.id === id && payload.event.type === 'message_end'), reopened.id, {timeout: 20000});
  const quizRead = await page.evaluate((id) => window.desk.sidechatRead({id}), reopened.id);
  check('quiz respondido entra no histórico', quizRead, (value) => value.messages.some((message) => message.role === 'assistant'));
  const stale = await page.evaluate(() => window.desk.sidechatRead({id: 'sc-11111111-1111-4111-8111-111111111111'}).then(() => 'sem-erro', (error) => error.message));
  check('id desconhecido é recusado', stale, (value) => /não encontrado/.test(String(value)));

  /* ---- reinício de verdade: transmitting no disco vira incerto no open ---- */
  await app.close();
  const recoveryId = reopened.id;
  const descriptorFile = path.join(runtime, 'sidechats', `${recoveryId}.json`);
  const onDisk = JSON.parse(fs.readFileSync(descriptorFile, 'utf8'));
  onDisk.delivery = {id: onDisk.delivery.id, status: 'transmitting', at: onDisk.delivery.at};
  fs.writeFileSync(descriptorFile, JSON.stringify(onDisk));
  app2 = await launch();
  const page2 = await app2.firstWindow();
  await page2.waitForFunction(() => window.desk && typeof window.desk.sidechatOpen === 'function', undefined, {timeout: 20000});
  await page2.evaluate(() => {
    window.__scEvents = [];
    window.desk.onSidechatEvent((payload) => window.__scEvents.push(payload));
  });
  const recovered = await page2.evaluate(() => window.desk.sidechatOpen({refs: []}));
  check('reinício: open recupera envio em voo como incerto (não fica transmitting eterno)', recovered,
    (value) => value.id === recoveryId && value.uncertain === true && value.delivery?.status === 'uncertain' && value.busy === false);
  const recoveredPrompt = await page2.evaluate((id) => window.desk.sidechatPrompt({id, text: 'teorema da retomada'}), recoveryId);
  check('reinício: envio explícito é aceito depois da recuperação', recoveredPrompt, (value) => value.sent === true && typeof value.streaming === 'boolean');
  await page2.waitForFunction((id) => window.__scEvents.some((payload) => payload.id === id && payload.event.type === 'agent_settled'), recoveryId, {timeout: 20000});
  const recoveredRead = await page2.evaluate((id) => window.desk.sidechatRead({id}), recoveryId);
  check('reinício: o histórico recuperado mantém as falas anteriores', recoveredRead,
    (value) => value.messages.filter((message) => message.role === 'user').length >= 2 && value.delivery?.status === 'settled');
  const fresh = await page2.evaluate(() => window.desk.sidechatOpen({refs: [], fresh: true}));
  check('fresh continua disponível depois da recuperação', fresh, (value) => /^sc-/.test(value.id) && value.id !== recoveryId && value.uncertain === false);
  console.log(failed ? 'SMOKE_FALHOU' : 'SMOKE_OK');
} finally {
  await app2?.close().catch(() => {});
  await app.close().catch(() => {});
  fs.rmSync(runtime, {recursive: true, force: true});
}
process.exit(failed ? 1 : 0);
