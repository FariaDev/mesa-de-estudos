import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {launchDesk,newRuntime,seedCourse,seedNativeSession,writeConfigJson,writeDeskJson,statusOnline,freezeMotion,resizeWindow,setTheme,withArtifacts} from './helpers.mjs';
import {layoutStable} from './waits.mjs';
import {buildLazyMessages} from './chat-history-lazy-seed.mjs';

/* Moldura da #118 em janela real, com o fake OpenCode: tema, tamanho de letra,
   idioma e tela cheia com cascas pendentes; cartões, atividade, figuras e
   imagem antiga; exportação completa; acessibilidade com todo o texto; e o
   texto cru achável pela busca. */

const require = createRequire(import.meta.url);
const cardStore = require('../card-store.cjs');
const {normalizeQuiz} = await import('../src/cards/input.mjs');

await withArtifacts('chat-history-lazy-chrome', async (ctx) => {
  const runtime = ctx.runtime = newRuntime('lazy-moldura');
  const course = seedCourse(runtime, 'calc');
  const messages = buildLazyMessages(300, {toolCalls: true, svgAt: 5, plotAt: 7});
  const session = seedNativeSession(runtime, messages, {courseId: 'calc', started: Date.now() - 86400000, preview: 'sintético 1200'});
  const pending = cardStore.createCard(runtime, session, normalizeQuiz({
    question: 'Quanto é 2+2?', options: [{label: '3'}, {label: '4'}], correctAnswer: '4', explanation: 'Dois mais dois.',
  }));
  writeConfigJson(runtime, {runtimePath: runtime, vaultPath: runtime, courses: [{id: 'calc', name: 'Cálculo I', path: course}]});
  writeDeskJson(runtime, {courseId: 'calc', session, courseStates: {calc: {session, sessions: [{path: session, started: Date.now() - 86400000}], pdfs: [], study: {title: '', xopp: ''}}}});
  const app = ctx.app = await launchDesk({runtime});
  const page = await app.firstWindow();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await statusOnline(page, {timeout: 90000});
  await page.waitForFunction((text) => document.querySelector('#messages')?.textContent.includes(text), 'Fechando a resposta 300', {timeout: 120000});
  await page.waitForSelector('.quiz-card', {timeout: 30000});
  await resizeWindow(app, page, 1440, 900);
  await freezeMotion(page);

  const shells = () => page.evaluate(() => document.querySelectorAll('#messages .message[data-lazy-shell]').length);
  assert.ok((await shells()) > 500, 'a conversa longa abre em casca');
  assert.match(await page.locator('.quiz-question').textContent(), /2\+2/, 'o cartão continua ao lado das cascas');

  /* Tema escuro, letra maior e inglês: a casca acompanha e depois formata. */
  await setTheme(page, 'dark');
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'dark', 'o tema escuro entra');
  await page.evaluate(async () => {
    const {applyDisplayState} = await import('./src/display-preferences.mjs');
    const {S} = await import('./src/state.mjs');
    applyDisplayState(S, {readingSize: 'larger'});
  });
  const reading = await page.evaluate(() => ({attr: document.documentElement.dataset.readingSize, px: parseFloat(getComputedStyle(document.querySelector('#messages .message')).fontSize)}));
  assert.equal(reading.attr, 'larger', 'a letra maior entra');
  assert.ok(reading.px > 15, `a letra cresce (${reading.px}px)`);
  await page.evaluate(async () => (await import('./src/ui-text.mjs')).setUiLanguage('en'));
  assert.equal(await page.evaluate(() => document.documentElement.lang), 'en', 'o idioma troca');
  assert.ok((await shells()) > 500, 'as cascas sobrevivem a tema, letra e idioma');
  const styled = await page.evaluate(async () => {
    const {formatLazyShell} = await import('./src/history-format-lazy.mjs');
    const el = [...document.querySelectorAll('#messages .message.assistant[data-lazy-shell]')].find((node) => node._raw.includes('$$'));
    formatLazyShell(el);
    return el.querySelectorAll('.katex').length;
  });
  assert.ok(styled > 0, 'formata certo no tema escuro, em inglês e com letra maior');
  await page.evaluate(async () => {
    const {applyDisplayState} = await import('./src/display-preferences.mjs');
    const {S} = await import('./src/state.mjs');
    applyDisplayState(S, {readingSize: 'normal'});
    (await import('./src/ui-text.mjs')).setUiLanguage('pt-BR');
  });

  /* Tela cheia com cascas pendentes, e de volta. */
  await page.locator('#chat-full').click();
  await page.waitForFunction(() => document.body.classList.contains('chat-full'), undefined, {timeout: 5000});
  await layoutStable(page, '#chat');
  assert.ok((await shells()) > 100, 'a tela cheia não formata tudo');
  await page.locator('#chat-full').click();
  await page.waitForFunction(() => !document.body.classList.contains('chat-full'), undefined, {timeout: 5000});

  /* Atividade e figuras: o slot nasce na hora; a figura pinta ao chegar perto. */
  const slots = await page.evaluate(() => document.querySelectorAll('#messages [data-activity-call]').length);
  assert.ok(slots > 10, `os slots de atividade nascem na montagem (${slots})`);
  const figure = await page.evaluate(async () => {
    const {revealInChat} = await import('./src/chat-scroll-view.mjs');
    const svg = [...document.querySelectorAll('#messages .message.assistant')].find((el) => el._raw.includes('```svg'));
    revealInChat(svg);
    const plot = [...document.querySelectorAll('#messages .message.assistant')].find((el) => el._raw.includes('```plot'));
    revealInChat(plot);
    return {
      svg: svg.querySelectorAll('.figure[data-figure="svg"] svg').length,
      plotFigure: plot.querySelectorAll('.plot-figure').length,
      plotWarning: plot.querySelectorAll('.plot-warning').length,
    };
  });
  assert.equal(figure.svg, 1, 'a figura svg pinta ao chegar perto');
  assert.ok(figure.plotFigure + figure.plotWarning > 0, 'a cerca plot vira figura ou aviso legível');

  /* Marcar mensagem (SaveForReview): o botão existe na casca e a tentativa sai
     do `_raw` — por isso vale com a bolha do usuário FORA da vista, sem
     revelar e sem repetir (o `innerText` fora da vista é vazio pelo
     `content-visibility`). */
  await page.evaluate(() => {
    const el = [...document.querySelectorAll('#messages .message.assistant[data-lazy-shell]')].find((node) => node.querySelector('.msg-review'));
    el.querySelector('.msg-review').click();
  });
  await page.waitForSelector('#review-dialog[open]', {timeout: 15000});
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('#review-dialog').open);
  const reviewCheck = await page.evaluate(async () => {
    const {messageScroller} = await import('./src/state.mjs');
    const scroller = messageScroller();
    scroller.scrollTop = scroller.scrollHeight;
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
    /* Entre o usuário e a resposta pode haver o diário de trabalho: a
       próxima bolha de assistente é a que responde. */
    const user = [...document.querySelectorAll('#messages .message.user')].find((node) => node._raw.startsWith('Pergunta 30:'));
    const view = scroller.getBoundingClientRect();
    const box = user.getBoundingClientRect();
    const outOfView = box.bottom < view.top || box.top > view.bottom;
    let assistant = user.nextElementSibling;
    while (assistant && !assistant.classList?.contains('assistant')) assistant = assistant.nextElementSibling;
    assistant.querySelector('.msg-review').click();
    return {
      outOfView,
      shell: user.hasAttribute('data-lazy-shell'),
      attempt: document.querySelector('#review-attempt')?.value.slice(0, 120) || '',
    };
  });
  /* A casca é achada pelo texto cru (`_raw`); formatar não desmonta nada. */
  assert.equal(reviewCheck.outOfView, true, 'a bolha do usuário está fora da vista no clique');
  assert.match(reviewCheck.attempt, /Pergunta 30/, 'a revisão parte do texto da mensagem mesmo fora da vista');
  await page.keyboard.press('Escape');

  /* Exportação traz tudo, formatado ou não. */
  const exported = await page.evaluate(() => window.desk.exportChat());
  assert.equal(exported.saved, true, 'a exportação salva');
  const body = fs.readFileSync(exported.file, 'utf8');
  assert.match(body, /Pergunta 1/, 'a mais antiga está no arquivo');
  assert.match(body, /Fechando a resposta 300/, 'a mais nova está no arquivo');

  /* Acessibilidade e busca leem o texto cru: nada sai da árvore mesmo sem o
     rico (a casca nunca esconde nada — sem `aria-hidden`, sem desmontar). O
     `content-visibility` (#67) pula o fora da vista sem pintar — no direto de
     antes, igual (paridade): por isso o CDP direto, sem visitar, afirma só o
     que é verdade — a cauda à vista no snapshot e tudo no DOM. */
  const cdp = await page.context().newCDPSession(page);
  const tree = await cdp.send('Accessibility.getFullAXTree', {});
  const axText = JSON.stringify(tree?.nodes || tree);
  assert.match(axText, /Fechando a resposta 300/, 'o snapshot tem a mais nova (à vista, formatada)');
  const domText = await page.evaluate(() => document.querySelector('#messages')?.textContent || '');
  assert.match(domText, /Pergunta 1:/, 'o DOM tem a mais antiga (texto cru da casca)');
  assert.match(domText, /Pergunta 150:/, 'o DOM tem a do meio');
  assert.match(domText, /Fechando a resposta 300:/, 'o DOM tem a mais nova');
  const found = await page.evaluate(() => window.find('Pergunta 3: como resolvo'));
  assert.equal(found, true, 'a busca acha texto ainda sem formatação');

  assert.deepEqual(errors, [], `sem erro de página (${errors.join(' | ')})`);
  await app.close(); ctx.app = null;
  void pending;
});
