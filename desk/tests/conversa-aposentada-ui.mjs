/* Regressão da #50: dado antigo do bilhete Conversa → Mesa continua abrindo.
 *
 * O app Conversa saiu e levou o recebimento do bilhete. A pasta
 * `<runtime>/handoff/` (em todas as fases que o protocolo antigo deixava no
 * disco) e as sessões que já carregam o bloco `[Da Conversa]` ficam nos
 * computadores de quem usava os dois apps, então a Mesa nova tem de:
 *   - abrir sem erro de página e sem aviso de bilhete;
 *   - mostrar a sessão antiga sem o bloco do bilhete;
 *   - NÃO injetar o `conversa.json` pendente no turno seguinte;
 *   - não tocar em nenhum byte da pasta antiga (nem arquivar, nem apagar).
 *
 * Tudo roda em runtime próprio com o Pi de mentira; nada do usuário é lido.
 */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {withArtifacts, launchDesk, newRuntime, seedCourse, seedSession, writeDeskJson, sendEnabled, statusOnline} from './helpers.mjs';
import {pollUntil} from './waits.mjs';

const BLOCO_ANTIGO = '\n\n[Da Conversa]\n- objetivo: revisar limites\n- pergunta pendente: como isolar x?';

/** Árvore antiga do bilhete: uma entrada por fase que o protocolo deixava no disco. */
const ARVORE_ANTIGA = {
  'conversa.json': {v: 1, from: 'conversa', createdAt: 1790000000000, goal: 'revisar limites', question: 'como isolar x?', refs: []},
  'reivindicado-1790000000000-111-1': {v: 1, from: 'conversa', goal: 'reivindicado', question: '', refs: []},
  'enviando-1790000000000-222-1': {v: 1, from: 'conversa', goal: 'enviando', question: '', refs: []},
  'entregue-1790000000000': {v: 1, from: 'conversa', goal: 'entregue', question: '', refs: []},
  'arquivo/1790000000000.json': {v: 1, from: 'conversa', goal: 'arquivado', question: '', refs: []},
  'falha/1790000000000-torto.json': {v: 9, from: 'futuro'},
  'duvida/1790000000000-incerto.json': {v: 1, from: 'conversa', goal: 'em dúvida', question: '', refs: []},
};

function escreverArvoreAntiga(runtime) {
  for (const [rel, body] of Object.entries(ARVORE_ANTIGA)) {
    const file = path.join(runtime, 'handoff', rel);
    fs.mkdirSync(path.dirname(file), {recursive: true});
    fs.writeFileSync(file, JSON.stringify(body, null, 2) + '\n');
  }
}

/** Impressão digital da pasta: nome e conteúdo de cada arquivo, em ordem. */
function digestDaPasta(dir) {
  const hash = crypto.createHash('sha256');
  const walk = (current) => {
    for (const name of fs.readdirSync(current).sort()) {
      const file = path.join(current, name);
      if (fs.statSync(file).isDirectory()) walk(file);
      else hash.update(path.relative(dir, file) + '\0').update(fs.readFileSync(file));
    }
  };
  walk(dir);
  return hash.digest('hex');
}

const promptsEnviados = (logFile) => (fs.existsSync(logFile) ? fs.readFileSync(logFile, 'utf8') : '')
  .split('\n').filter(Boolean).map((line) => JSON.parse(line).message);

await withArtifacts('conversa-aposentada', async (ctx) => {
  const runtime = ctx.runtime = newRuntime('conversa-aposentada');
  seedCourse(runtime, 'Calc');
  escreverArvoreAntiga(runtime);
  const antes = digestDaPasta(path.join(runtime, 'handoff'));

  const current = seedSession(runtime, [
    {type: 'message', message: {role: 'user', content: [{type: 'text', text: 'quanto vale o limite?' + BLOCO_ANTIGO}]}, timestamp: 1700000002000},
    {type: 'message', message: {role: 'assistant', content: [{type: 'text', text: 'Vale 2.'}]}, timestamp: 1700000003000},
  ]);
  writeDeskJson(runtime, {session: current, courseId: 'Calc'});
  const logFile = path.join(runtime, 'pi-prompts.log');

  ctx.app = await launchDesk({runtime, env: {FAKE_PI_QUEUE_LOG: logFile}});
  const page = await ctx.app.firstWindow();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await statusOnline(page, {timeout: 30000});

  /* A sessão antiga abre, com a pergunta e sem o bloco do bilhete. */
  const bolhas = () => page.$$eval('.message.user .body', (els) => els.map((el) => el.textContent));
  await pollUntil(bolhas, (textos) => textos.some((texto) => texto.includes('quanto vale o limite?')), {timeout: 15000, what: 'a pergunta antiga na conversa'});
  assert.ok((await bolhas()).every((texto) => !texto.includes('[Da Conversa]') && !texto.includes('revisar limites')), 'o bloco do bilhete antigo não aparece na conversa');

  /* A ponte do bilhete não existe mais no preload. */
  const ganchos = await page.evaluate(() => ({onHandoff: typeof window.desk.onHandoff, onHandoffProblem: typeof window.desk.onHandoffProblem}));
  assert.deepEqual(ganchos, {onHandoff: 'undefined', onHandoffProblem: 'undefined'}, 'o preload não expõe mais o bilhete');

  /* Um turno novo não leva o `conversa.json` pendente, e nenhum aviso de bilhete aparece. */
  await page.locator('#prompt').fill('mensagem depois da aposentadoria');
  await page.locator('#prompt').press('Enter');
  await pollUntil(() => promptsEnviados(logFile), (enviados) => enviados.some((mensagem) => mensagem.includes('mensagem depois da aposentadoria')), {timeout: 30000, what: 'o turno novo no log do Pi'});
  await sendEnabled(page, {timeout: 60000});
  for (const mensagem of promptsEnviados(logFile)) {
    assert.doesNotMatch(mensagem, /\[Da Conversa\]|revisar limites/, 'o bilhete pendente não é injetado no turno');
  }
  const toasts = await page.$$eval('.toast-item', (els) => els.map((el) => el.textContent));
  assert.ok(toasts.every((texto) => !/bilhete/i.test(texto)), `nenhum aviso de bilhete: ${JSON.stringify(toasts)}`);

  assert.equal(digestDaPasta(path.join(runtime, 'handoff')), antes, 'a pasta antiga do bilhete ficou intacta (nada arquivado, apagado ou movido)');
  assert.deepEqual(errors, [], `erros de página: ${JSON.stringify(errors)}`);
});

console.log('conversa-aposentada-ui OK');
