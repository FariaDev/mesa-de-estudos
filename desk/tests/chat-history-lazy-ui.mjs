import assert from 'node:assert/strict';
import {withArtifacts} from './helpers.mjs';
import {openLazyDesk} from './chat-history-lazy-seed.mjs';

/* Núcleo da #118 em janela real, com o fake OpenCode: a conversa de 5.000
   mensagens nasce em casca (texto real, sem rico), a cauda pinta na montagem,
   o rico tardio é idêntico ao direto, a curta monta direta e a casca é segura
   (fórmula/código literais, sem execução) com seleção e cópia funcionando. */

const shells = (page) => page.evaluate(() => document.querySelectorAll('#messages .message[data-lazy-shell]').length);
const bubbles = (page) => page.evaluate(() => document.querySelectorAll('#messages .message').length);

await withArtifacts('chat-history-lazy', async (ctx) => {
  const {app, page, errors, messages, runtime} = await openLazyDesk(1250, {options: {dangerAt: 3, imagesEvery: 25, imageOnlyLast: true}, tag: 'nucleo'});
  ctx.app = app;
  ctx.runtime = runtime;

  const total = await bubbles(page);
  assert.ok(total >= 3700, `as 5.000 mensagens viram bolhas no DOM (${total})`);
  const pending = await shells(page);
  assert.ok(pending > 3000, `a maioria nasce em casca (${pending})`);
  const lastAssistant = await page.evaluate(() => {
    const list = [...document.querySelectorAll('#messages .message.assistant')];
    const el = list.at(-1);
    return {shell: el.hasAttribute('data-lazy-shell'), katex: el.querySelectorAll('.katex').length};
  });
  assert.equal(lastAssistant.shell, false, 'o fim, que abre primeiro, já nasce formatado');
  assert.ok(lastAssistant.katex > 0, 'a última resposta tem KaTeX pintado');
  const stats = await page.evaluate(async () => (await import('./src/history-format-lazy.mjs')).lazyStats());
  assert.equal(stats.armed, false, 'o lote fecha depois da montagem');

  /* Anúncio em massa (#118): a região segue `polite`, mas a bolha em casca não
     anuncia (leitor de tela real não foi testado — só o atributo). A formatada
     mantém o `off`; curta, como hoje, sem `off`. */
  const announce = await page.evaluate(() => ({
    region: document.querySelector('#messages')?.getAttribute('aria-live'),
    shellsOff: [...document.querySelectorAll('#messages .message[data-lazy-shell]')].slice(0, 20).map((el) => el.getAttribute('aria-live')),
    tailOff: [...document.querySelectorAll('#messages .message.assistant')].at(-1)?.getAttribute('aria-live'),
    tailText: ([...document.querySelectorAll('#messages .message.assistant')].at(-1)?.textContent || '').slice(0, 40),
  }));
  assert.equal(announce.region, 'polite', 'a região segue anunciando');
  assert.ok(announce.shellsOff.length > 0 && announce.shellsOff.every((value) => value === 'off'), 'a casca nasce com aria-live off');
  assert.equal(announce.tailOff, 'off', 'a cauda formatada mantém o off');
  assert.match(announce.tailText, /Fechando/, 'o texto da cauda segue na árvore');

  /* O rico custa chamadas de `markup`: com a casca, só a cauda pinta. */
  const second = await page.evaluate(async (msgs) => {
    const {showHistory} = await import('./src/chat.mjs');
    const {resetMarkupStats, markupStats} = await import('./src/markdown.mjs');
    resetMarkupStats();
    const started = performance.now();
    showHistory(msgs);
    return {calls: markupStats().calls, ms: performance.now() - started};
  }, messages);
  console.log(`remontagem com casca: ${second.calls} markups em ${second.ms.toFixed(0)} ms (direto seriam ${total})`);
  assert.ok(second.calls <= 90, `só a cauda passa pelo markup (${second.calls})`);
  assert.ok((await shells(page)) > 3000, 'remontar volta a ser casca');

  /* O HTML tardio é idêntico ao desenho direto. */
  const identical = await page.evaluate(async () => {
    const {message} = await import('./src/chat-message-view.mjs');
    const shell = [...document.querySelectorAll('#messages .message.assistant[data-lazy-shell]')].find((el) => !el._raw.includes('```') && !el._raw.includes('<script>'));
    const {formatLazyShell} = await import('./src/history-format-lazy.mjs');
    const scroller = document.querySelector('#chat').scrollHeight > document.querySelector('#chat').clientHeight + 1 ? document.querySelector('#chat') : document.querySelector('#messages');
    const top = scroller.scrollTop;
    const painted = formatLazyShell(shell);
    const fresh = message('assistant', shell._raw, [], document.createElement('div'));
    scroller.scrollTop = top;
    return {painted, same: shell.querySelector('.body').innerHTML === fresh.querySelector('.body').innerHTML};
  });
  assert.equal(identical.painted, true, 'a casca formata sob demanda');
  assert.equal(identical.same, true, 'o HTML tardio é idêntico ao desenho direto');

  /* Texto cru provisório: `$...$` e cerca ficam literais, sem executar nada. */
  const provisional = await page.evaluate(() => {
    const userShell = document.querySelector('#messages .message.user[data-lazy-shell]');
    const codeShell = [...document.querySelectorAll('#messages .message.assistant[data-lazy-shell]')].find((el) => el._raw.includes('```js'));
    const dangerShell = [...document.querySelectorAll('#messages .message.assistant[data-lazy-shell]')].find((el) => el._raw.includes('<script>'));
    const raw = (el) => ({text: el.querySelector('.body').textContent, katex: el.querySelectorAll('.katex,.katex-display').length, pres: el.querySelectorAll('pre').length, scripts: el.querySelectorAll('script').length});
    return {user: raw(userShell), code: raw(codeShell), danger: raw(dangerShell), xss: window.__lazyXss};
  });
  assert.ok(provisional.user.text.includes('$'), 'a fórmula crua aparece como texto');
  assert.equal(provisional.user.katex, 0, 'sem KaTeX antes da hora');
  assert.ok(provisional.code.text.includes('```'), 'a cerca crua aparece como texto');
  assert.equal(provisional.code.pres, 0, 'sem <pre> antes da hora');
  assert.equal(provisional.danger.scripts, 0, 'o <script> cru não vira elemento');
  assert.ok(provisional.danger.text.includes('<script>'), 'o <script> cru aparece como texto');
  assert.equal(provisional.xss, undefined, 'nada executa na casca');
  const dangerAfter = await page.evaluate(async () => {
    const {formatLazyShell} = await import('./src/history-format-lazy.mjs');
    const el = [...document.querySelectorAll('#messages .message.assistant[data-lazy-shell]')].find((node) => node._raw.includes('<script>'));
    formatLazyShell(el);
    return {scripts: el.querySelectorAll('script').length, jsLinks: el.querySelectorAll('a[href^="javascript:"]').length, code: el.querySelectorAll('pre.hl').length, xss: window.__lazyXss};
  });
  assert.equal(dangerAfter.scripts, 0, 'formatada continua sem <script>');
  assert.equal(dangerAfter.jsLinks, 0, 'sem href javascript: depois de formatar');
  assert.ok(dangerAfter.code > 0, 'o bloco de código pinta ao formatar');
  assert.equal(dangerAfter.xss, undefined, 'nada executa ao formatar');

  /* Imagem antiga em casca: o shot continua, com o texto cru junto. */
  const shot = await page.evaluate(() => {
    const el = [...document.querySelectorAll('#messages .message.user[data-lazy-shell]')].find((node) => node.querySelector('img.shot'));
    return el ? {shots: [...el.querySelectorAll('img.shot')].filter((img) => img.src.startsWith('data:')).length, shell: el.hasAttribute('data-lazy-shell')} : null;
  });
  assert.deepEqual(shot, {shots: 1, shell: true}, 'a imagem antiga aparece na casca');
  /* A mensagem só com imagem (a última, da cauda) continua como antes. */
  const onlyImage = await page.evaluate(() => {
    const users = [...document.querySelectorAll('#messages .message.user')];
    const el = users.at(-1);
    return {shots: [...el.querySelectorAll('img.shot')].filter((img) => img.src.startsWith('data:')).length, paras: el.querySelectorAll('p').length};
  });
  assert.deepEqual(onlyImage, {shots: 1, paras: 0}, 'só-imagem da cauda: bolha com shot e sem parágrafo');

  /* Seleção atravessa cascas; copiar leva o texto cru. */
  const selection = await page.evaluate(async () => {
    const {selectionInsideMessages} = await import('./src/chat-quote.mjs');
    const list = [...document.querySelectorAll('#messages .message[data-lazy-shell]')].slice(400, 403);
    const range = document.createRange();
    range.setStart(list[0].querySelector('.body').firstChild, 0);
    range.setEnd(list[2].querySelector('.body').lastChild, list[2].querySelector('.body').lastChild.length || 0);
    const get = window.getSelection();
    get.removeAllRanges();
    get.addRange(range);
    const text = get.toString();
    const inside = selectionInsideMessages();
    get.removeAllRanges();
    return {inside, first: text.includes('Pergunta'), last: text.length > 100};
  });
  assert.equal(selection.inside, true, 'a seleção mora nas mensagens');
  assert.equal(selection.first && selection.last, true, 'a seleção atravessa cascas');
  const copied = await page.evaluate(async () => {
    window.__lazyCopied = null;
    navigator.clipboard.writeText = (text) => { window.__lazyCopied = text; return Promise.resolve(); };
    const el = [...document.querySelectorAll('#messages .message.assistant[data-lazy-shell]')][20];
    el.querySelector('.msg-copy').click();
    await new Promise((done) => setTimeout(done, 50)); // espera fixa: o clique escreve no clipboard por promise sem evento para esperar
    return {same: window.__lazyCopied === el._raw, shell: el.hasAttribute('data-lazy-shell')};
  });
  assert.deepEqual(copied, {same: true, shell: true}, 'copiar na casca leva o texto cru');

  /* Seleção em curso (#118): formatar com seleção dentro da casca não formata
     agora — a casca fica pendente, a seleção intacta; ao sair, formata. */
  const deferId = await page.evaluate(async () => {
    const {formatLazyShell} = await import('./src/history-format-lazy.mjs');
    const el = [...document.querySelectorAll('#messages .message.user[data-lazy-shell]')].find((node) => node.textContent.includes('Pergunta 60:'));
    const body = el.querySelector('.body');
    const range = document.createRange();
    range.setStart(body.firstChild, 0);
    range.setEnd(body.firstChild, Math.min(8, (body.firstChild.textContent || '').length));
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    const before = String(selection);
    const painted = formatLazyShell(el);
    const kept = el.hasAttribute('data-lazy-shell');
    const after = String(window.getSelection());
    el.dataset.deferProbe = '1';
    return {painted, kept, before, after};
  });
  assert.equal(deferId.painted, false, 'com seleção dentro, não formata agora');
  assert.equal(deferId.kept, true, 'a casca fica pendente');
  assert.equal(deferId.after, deferId.before, 'a seleção segue intacta');
  await page.evaluate(() => {
    window.getSelection().removeAllRanges();
  });
  await page.waitForFunction(() => !document.querySelector('[data-defer-probe="1"]')?.hasAttribute('data-lazy-shell'), undefined, {timeout: 15000});
  const deferDone = await page.evaluate(() => {
    const el = document.querySelector('[data-defer-probe="1"]');
    const done = el && !el.hasAttribute('data-lazy-shell') && el.querySelectorAll('p').length > 0;
    el?.removeAttribute('data-defer-probe');
    return !!done;
  });
  assert.equal(deferDone, true, 'ao sair a seleção, a casca formata');

  assert.deepEqual(errors, [], `sem erro de página (${errors.join(' | ')})`);
  await app.close(); ctx.app = null;

  /* Conversa curta (200 mensagens): direta, sem casca e sem observador. */
  const small = await openLazyDesk(50, {tag: 'curta'});
  ctx.app = small.app;
  ctx.runtime = small.runtime;
  assert.equal(await shells(small.page), 0, 'curta não deixa casca');
  assert.ok((await bubbles(small.page)) >= 140, 'as bolhas montam');
  const smallStats = await small.page.evaluate(async () => (await import('./src/history-format-lazy.mjs')).lazyStats());
  assert.deepEqual({pending: smallStats.pending, armed: smallStats.armed}, {pending: 0, armed: false}, 'sem pendência');
  const katex = await small.page.evaluate(() => document.querySelectorAll('#messages .katex').length);
  assert.ok(katex > 50, `a curta já abre toda formatada (${katex} KaTeX)`);
  const smallLive = await small.page.evaluate(() => [...document.querySelectorAll('#messages .message')].slice(0, 10).map((el) => el.getAttribute('aria-live')));
  assert.ok(smallLive.every((value) => value !== 'off'), 'curta, como hoje, sem aria-live off');
  assert.deepEqual(errors, [], `sem erro de página (${errors.join(' | ')})`);
  await small.app.close(); ctx.app = null;

  /* A viva do stream nunca é adiada: enviar numa conversa longa formata na hora. */
  const live = await openLazyDesk(60, {tag: 'viva', env: {FAKE_OPENCODE_REPLY: 'Entendido $x=1$.'}});
  ctx.app = live.app;
  ctx.runtime = live.runtime;
  await live.page.locator('#prompt').fill('pode confirmar?');
  await live.page.locator('#send').click();
  await live.page.waitForFunction(() => [...document.querySelectorAll('#messages .message.assistant .body')].some((el) => el.textContent.includes('Entendido')), undefined, {timeout: 60000});
  const liveBubbles = await live.page.evaluate(() => {
    const list = [...document.querySelectorAll('#messages .message')];
    const fresh = list.slice(-2);
    return fresh.map((el) => ({shell: el.hasAttribute('data-lazy-shell'), katex: el.querySelectorAll('.katex').length, paras: el.querySelectorAll('p').length, live: el.getAttribute('aria-live')}));
  });
  assert.ok(liveBubbles.every((bubble) => !bubble.shell), 'as bolhas do turno vivo não nascem em casca');
  assert.ok(liveBubbles.every((bubble) => bubble.live !== 'off'), 'mensagem nova (envio e stream) continua anunciada');
  assert.ok(liveBubbles.some((bubble) => bubble.katex > 0), 'a resposta viva pinta o KaTeX na hora');
  assert.deepEqual(live.errors, [], `sem erro de página (${live.errors.join(' | ')})`);
  await live.app.close(); ctx.app = null;
});
