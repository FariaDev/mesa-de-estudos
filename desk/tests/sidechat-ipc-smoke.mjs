/* Smoke de CONTRATO do chat lateral na ponte real (preload + main + fake OpenCode):
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
import {ptText} from './pt-text.mjs';
import {FAKE_OPENCODE,seedNativeSession,tinyPdf} from './helpers.mjs';

const DESK = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const runtime = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-sidechat-ipc-smoke-'));
fs.chmodSync(FAKE_OPENCODE, 0o755);
const mainSession = seedNativeSession(runtime, [], {courseId: 'Synthetic'});
const promptLog = path.join(runtime, 'prompts.jsonl');
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

fs.writeFileSync(path.join(runtime, 'desk.json'), JSON.stringify({session: mainSession, courseId: 'Synthetic'}));
const quizCall = {name: 'quiz', input: {question: 'Quanto é 2+2?', options: [{label: '5'}, {label: '3'}, {label: '4'}], correctAnswer: '4'}};
const launch = () => electron.launch({
  args: [path.join(DESK, 'main.cjs')],
  cwd: DESK,
  env: testEnv({LEARNING_DESK_RUNTIME: runtime, LEARNING_DESK_OPENCODE: FAKE_OPENCODE, FAKE_OPENCODE_QUEUE_LOG: promptLog, FAKE_OPENCODE_MCP_CALLS: JSON.stringify([null, quizCall])}),
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
  check('abre como OpenCode', opened, (value) => value.engine === 'opencode' && /^sc-/.test(value.id));
  check('contexto escopado à conversa principal', opened.context, (value) => typeof value.mainSession === 'string' && Array.isArray(value.refs));
  check('open preserva a ref PDF validada (path, página != 1)', opened.context.refs,
    (value) => value.length === 1 && value[0].path === pdfPath && value[0].page === 3);
  check('abrir não inicia turno', opened, (value) => value.busy === false && value.messages.length === 0);
  const conversations = await page.evaluate(() => window.desk.conversations());
  check('conversations() é lista', conversations, (value) => Array.isArray(value));
  const prompt = await page.evaluate((id) => window.desk.sidechatPrompt({id, text: 'teorema'}), opened.id);
  check('prompt aceito sem esperar o turno, com streaming medido', prompt, (value) => value.sent === true && typeof value.streaming === 'boolean');
  await page.waitForFunction(() => window.__scEvents.some((payload) => payload.event.type === 'agent_settled'), undefined, {timeout: 20000});
  let sentPromptText = '';
  for (let i = 0; i < 200 && !sentPromptText; i += 1) {
    try { sentPromptText = fs.readFileSync(promptLog, 'utf8').split('\n').filter(Boolean).map((line) => String(JSON.parse(line).message || '')).join('\n'); } catch { /* log ainda vazio */ }
    // espera fixa: o log do fake é escrito fora do processo; 50 ms é o intervalo entre leituras
    if (!sentPromptText) await new Promise((resolve) => setTimeout(resolve, 50));
  }
  check('prompt do fake OpenCode carrega a ref do snapshot (página 3)', sentPromptText,
    (value) => value.includes(pdfPath) && /\(p\. 3\)/.test(value));
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
  await page.evaluate(() => window.desk.newSession('opencode'));
  const afterSwitch = await page.evaluate((id) => window.desk.sidechatRead({id}).then(() => 'sem-erro', (error) => error.message), opened.id);
  check('trocar de conversa encerra o escopo do chat antigo', afterSwitch, (value) => /não pertence/.test(ptText(String(value))));
  const reopened = await page.evaluate(() => window.desk.sidechatOpen({refs: []}));
  check('conversa nova abre chat novo', reopened, (value) => value.id !== opened.id);
  const quiz = await page.evaluate((id) => window.desk.sidechatPrompt({id, text: 'quiz'}), reopened.id);
  check('prompt de quiz aceito', quiz, (value) => value.sent === true);
  await page.waitForFunction((id) => window.__scEvents.some((payload) => payload.id === id && payload.event.type === 'card' && payload.event.cardType === 'shown'), reopened.id, {timeout: 20000});
  const card = await page.evaluate((id) => window.__scEvents.filter((payload) => payload.id === id && payload.event.type === 'card' && payload.event.cardType === 'shown').at(-1).event.card, reopened.id);
  check('cartão do quiz chega ao lateral', card, (value) => value?.kind === 'quiz' && value.options.length === 3);
  const answered = await page.evaluate(({id, cardId}) => window.desk.sidechatCardAnswer({id, cardId, answer: {selected: [3]}}), {id: reopened.id, cardId: card.id});
  check('resposta do cartão roteada ao canal', answered, (value) => value?.answered === true && value.correct === true);
  const concluded = await page.evaluate(({id, cardId}) => window.desk.sidechatCardConclude({id, cardId}), {id: reopened.id, cardId: card.id});
  check('resultado do cartão enviado uma vez', concluded, (value) => value?.ok === true && value.card?.sendState === 'sent');
  await page.waitForFunction((id) => window.__scEvents.some((payload) => payload.id === id && payload.event.type === 'message_end'), reopened.id, {timeout: 20000});
  const quizRead = await page.evaluate((id) => window.desk.sidechatRead({id}), reopened.id);
  check('quiz respondido entra no histórico', quizRead, (value) => value.messages.some((message) => message.role === 'assistant') && value.cards.some((item) => item.id === card.id && item.sendState === 'sent'));
  const stale = await page.evaluate(() => window.desk.sidechatRead({id: 'sc-11111111-1111-4111-8111-111111111111'}).then(() => 'sem-erro', (error) => error.message));
  check('id desconhecido é recusado', stale, (value) => /não encontrado/.test(ptText(String(value))));

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
  check('reinício: envio com entrega incerta é recusado (não repete sozinho)', recoveredPrompt,
    (value) => value.sent === false && value.uncertain === true && value.retryable === false);
  const recoveredRead = await page2.evaluate((id) => window.desk.sidechatRead({id}), recoveryId);
  check('reinício: o histórico recuperado mantém as falas anteriores', recoveredRead,
    (value) => value.messages.filter((message) => message.role === 'user').length >= 2 && value.delivery?.status === 'uncertain');
  const fresh = await page2.evaluate(() => window.desk.sidechatOpen({refs: [], fresh: true}));
  check('fresh continua disponível depois da recuperação', fresh, (value) => /^sc-/.test(value.id) && value.id !== recoveryId && value.uncertain === false);
  console.log(failed ? 'SMOKE_FALHOU' : 'SMOKE_OK');
} finally {
  await app2?.close().catch(() => {});
  await app.close().catch(() => {});
  fs.rmSync(runtime, {recursive: true, force: true});
}
process.exit(failed ? 1 : 0);
