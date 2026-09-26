/* Bilhete Conversa → Mesa de ponta a ponta, com os DOIS apps de verdade.
 *
 * O que é real aqui: os apps Electron (renderer, IPC, protocolo do bilhete em
 * disco, arquivamento), o botão "Levar para a Mesa" da Conversa e o turno da
 * Mesa. O que é isolado: runtime próprio (nada é lido nem escrito no runtime do
 * usuário), sessão própria, `DESK_TEST`/`CONVERSA_TEST` (a trava de instância
 * única não vale e a janela não aparece) e o Pi — por padrão o fake do harness,
 * porque a fronteira com o provedor não é o que este teste mede.
 *
 *   node tests/hunt-handoff.mjs            # fake Pi (determinístico)
 *   REAL_PI=1 node tests/hunt-handoff.mjs  # turno contra o Pi de verdade
 *
 * Evidências em tests/artifacts/<stamp>-hunt-handoff quando EVIDENCE=1 ou o
 * bloco falha.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {withArtifacts,launchDesk,newRuntime,seedCourse,seedSession,writeDeskJson,toastWait,sendEnabled,statusOnline,saveArtifacts} from './helpers.mjs';

const require = createRequire(import.meta.url);
const deskHandoff = require('../handoff.cjs');
const EVIDENCE = process.env.EVIDENCE === '1';
const REAL_PI = process.env.REAL_PI === '1';
const log = (...a) => console.log(...a);

const CHAT = new URL('../../chat/tests/helpers.mjs', import.meta.url).href;

/* A Conversa é o app irmão: na árvore pública da Mesa ele não existe. */
async function loadChatHelpers() {
  try {
    return await import(CHAT);
  } catch {
    return null;
  }
}

function watch(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

const jsonlLine = (text) => JSON.stringify({type: 'message', message: {role: 'user', content: [{type: 'text', text}]}});

await withArtifacts('hunt-handoff', async (ctx) => {
  const chatHelpers = await loadChatHelpers();
  if (!chatHelpers) {
    log('HUNT handoff SKIP: chat/ não está nesta árvore (snapshot público da Mesa).');
    return;
  }
  const runtime = ctx.runtime = newRuntime('hunt-handoff');
  seedCourse(runtime, 'Calc');

  const handoffFile = deskHandoff.pendentePath(runtime);
  const lerBilhete = () => JSON.parse(fs.readFileSync(handoffFile, 'utf8'));

  /* ---------- 1. Conversa vazia: o bilhete sai sem objetivo inventado ---------- */
  const sessions = path.join(runtime, 'sessions');
  fs.mkdirSync(sessions, {recursive: true});
  const vazia = path.join(sessions, 'pi-vazia.jsonl');
  fs.writeFileSync(vazia, '');
  fs.writeFileSync(path.join(runtime, 'chat.json'), JSON.stringify({session: vazia, sessions: [{path: vazia, started: Date.now(), title: '', preview: ''}]}));

  const chatEnv = {LEARNING_DESK_RUNTIME: runtime};
  let chat = await chatHelpers.launchChat({runtime, env: chatEnv});
  let page = await chat.firstWindow();
  const chatErrors = watch(page);
  await chatHelpers.statusOnline(page);
  await page.locator('#prompt').fill('preciso de ajuda com limites laterais');
  await page.locator('#handoff').click();
  await chatHelpers.toastWait(page, 'Bilhete guardado');
  const semAssunto = lerBilhete();
  log('[handoff] conversa vazia →', JSON.stringify(semAssunto));
  assert.equal(semAssunto.goal, '', 'conversa vazia não tem objetivo: "Nova conversa" não vai como assunto');
  assert.match(semAssunto.question, /limites laterais/, 'a pergunta pendente vai');
  assert.deepEqual(chatErrors, [], `erros de página na Conversa: ${JSON.stringify(chatErrors)}`);
  await chat.close();

  /* ---------- 2. Conversa com assunto: o objetivo é o que a conversa tem ---------- */
  fs.rmSync(handoffFile, {recursive: true, force: true});
  const comAssunto = path.join(sessions, 'pi-assunto.jsonl');
  fs.writeFileSync(comAssunto, jsonlLine('revisão de limites e continuidade') + '\n');
  fs.writeFileSync(path.join(runtime, 'chat.json'), JSON.stringify({session: comAssunto, sessions: [{path: comAssunto, started: Date.now(), title: '', preview: ''}]}));

  chat = await chatHelpers.launchChat({runtime, env: chatEnv});
  page = await chat.firstWindow();
  await chatHelpers.statusOnline(page);
  await page.locator('#prompt').fill('confere essa passagem?');
  await page.locator('#handoff').click();
  await chatHelpers.toastWait(page, 'Bilhete guardado');
  const comTema = lerBilhete();
  log('[handoff] conversa com assunto →', JSON.stringify(comTema));
  assert.match(comTema.goal, /limites e continuidade/, 'o assunto da conversa vira objetivo, sem o "quando" do rótulo');
  assert.ok(!/Nova conversa/.test(comTema.goal), 'e nunca o rótulo padrão');
  await chat.close();

  /* ---------- 3. Mesa: o bilhete entra no turno, é arquivado e não repete ---------- */
  const logFile = path.join(runtime, 'pi-prompts.log');
  /* Com o Pi de verdade a sessão é dele: um JSONL semeado à mão é recusado
     ("not a valid pi session"). Então a Mesa abre uma sessão nova e o teste lê
     o arquivo que o Pi gravou. */
  const current = REAL_PI ? '' : seedSession(runtime, [{type: 'message', message: {role: 'user', content: [{type: 'text', text: 'corrente'}]}, timestamp: 1700000002000}]);
  writeDeskJson(runtime, REAL_PI ? {courseId: 'Calc'} : {session: current, courseId: 'Calc'});
  const mesa = ctx.app = await launchDesk({
    runtime,
    pi: !REAL_PI,
    env: REAL_PI ? {} : {FAKE_PI_QUEUE_LOG: logFile},
  });
  const mesaPage = await mesa.firstWindow();
  const mesaErrors = watch(mesaPage);
  await statusOnline(mesaPage, {timeout: REAL_PI ? 120000 : 30000});
  const sessao = () => REAL_PI
    ? path.join(runtime, fs.readdirSync(runtime).filter((n) => /^pi-.*\.jsonl$/.test(n)).sort().at(-1) || '')
    : current;
  /* As mensagens do usuário na sessão (é onde o bilhete tem de estar). */
  const mensagensDoUsuario = () => fs.readFileSync(sessao(), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).filter((r) => r?.message?.role === 'user');

  /* O aviso de recebimento aparece no primeiro envio, que é quando a Mesa
     reivindica o bilhete. */
  await mesaPage.locator('#prompt').fill('primeira mensagem com o bilhete');
  await mesaPage.locator('#prompt').press('Enter');
  await toastWait(mesaPage, 'Bilhete da Conversa', {timeout: 30000});
  const settle = () => mesaPage.waitForFunction(() => document.querySelector('#stop').hidden && !document.querySelector('.queue-strip'), undefined, {timeout: REAL_PI ? 300000 : 60000});
  await settle();
  await sendEnabled(mesaPage, {timeout: 60000});

  /* Onde o bilhete chegou: no prompt do fake, ou no JSONL da sessão quando o Pi
     é o de verdade (é ele que grava a sessão). */
  const enviado = REAL_PI
    ? mensagensDoUsuario().map((r) => (r.message.content || []).map((c) => c.text || '').join('\n')).join('\n')
    : fs.readFileSync(logFile, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l).message).join('\n');
  if (REAL_PI) log('[handoff] sessão do Pi:', path.basename(sessao()));
  assert.match(enviado, /\[Da Conversa\]/, 'o bloco do bilhete foi junto no turno');
  assert.match(enviado, /limites e continuidade/, 'com o assunto da conversa');
  assert.match(enviado, /confere essa passagem\?/, 'e com a pergunta pendente');

  const arquivados = fs.readdirSync(deskHandoff.archiveDir(runtime));
  log('[handoff] arquivo →', JSON.stringify(arquivados));
  assert.equal(arquivados.length, 1, 'o bilhete entregue foi arquivado');
  assert.ok(!fs.readdirSync(deskHandoff.handoffDir(runtime)).some((n) => n.startsWith(deskHandoff.CLAIM_PREFIX)), 'e não ficou reivindicado');
  assert.equal(fs.existsSync(handoffFile), false, 'a fila ficou vazia');

  /* A bolha do usuário não mostra o bloco (é contexto, não conversa). */
  const bolhas = await mesaPage.$$eval('.message.user .body', (els) => els.map((el) => el.textContent));
  assert.ok(bolhas.some((t) => t.includes('primeira mensagem com o bilhete')), 'a mensagem do usuário aparece');
  assert.ok(bolhas.every((t) => !t.includes('[Da Conversa]')), 'e sem o bloco do bilhete à mostra');

  /* Turno seguinte: o bilhete já foi entregue, então não volta. */
  const antes = REAL_PI
    ? mensagensDoUsuario().length
    : fs.readFileSync(logFile, 'utf8').split('\n').filter(Boolean).length;
  await mesaPage.locator('#prompt').fill('segunda mensagem, sem bilhete');
  await mesaPage.locator('#prompt').press('Enter');
  await settle();
  await sendEnabled(mesaPage, {timeout: 60000});
  const depois = REAL_PI
    ? mensagensDoUsuario().length
    : fs.readFileSync(logFile, 'utf8').split('\n').filter(Boolean).length;
  assert.equal(depois, antes + 1, 'o segundo turno foi para o Pi');
  const segundo = REAL_PI
    ? mensagensDoUsuario().at(-1).message.content.map((c) => c.text || '').join('\n')
    : JSON.parse(fs.readFileSync(logFile, 'utf8').trim().split('\n').filter(Boolean).at(-1)).message;
  assert.doesNotMatch(segundo, /\[Da Conversa\]/, 'o bilhete NÃO repete no turno seguinte');
  assert.equal(fs.readdirSync(deskHandoff.archiveDir(runtime)).length, 1, 'e o arquivo continua com um bilhete só');

  assert.deepEqual(mesaErrors, [], `erros de página na Mesa: ${JSON.stringify(mesaErrors)}`);
  if (EVIDENCE) await saveArtifacts(ctx);
  log(`HUNT handoff PASSED${REAL_PI ? ' (Pi real)' : ' (fake Pi)'}`);
});

log('HUNT HANDOFF DONE');
