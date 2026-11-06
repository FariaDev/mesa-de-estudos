import assert from 'node:assert/strict';
import {withArtifacts} from './helpers.mjs';
import {buildLazyMessages, openLazyDesk} from './chat-history-lazy-seed.mjs';
import {pollUntil} from './waits.mjs';

/* Rolagem e navegação da #118 em janela real, com o fake OpenCode: formatar
   acima da vista não move o leitor (âncora em `scrollTop`), subir ao topo não
   pula, a citação da mensagem mais antiga formata antes de rolar e cai no
 lugar certo, e trocar de conversa com formatação pendente não deixa
 observador vivo nem pinta a conversa errada (nas duas ordens). */

async function settleFormats(page) {
  await pollUntil(async () => page.evaluate(async () => (await import('./src/history-format-lazy.mjs')).lazyStats().pending),
    (pending) => typeof pending === 'number', {timeout: 30000, what: 'a pendência assentar'});
  const before = await page.evaluate(async () => (await import('./src/history-format-lazy.mjs')).lazyStats().pending);
  await page.waitForTimeout(800); // espera fixa: o observador formata em rajadas; a pendência tem que parar de cair
  const after = await page.evaluate(async () => (await import('./src/history-format-lazy.mjs')).lazyStats().pending);
  assert.ok(after <= before, 'a pendência assenta');
}

await withArtifacts('chat-history-lazy-scroll', async (ctx) => {
  const {app, page, errors, runtime, pdfPath} = await openLazyDesk(300, {options: {quoteRef: {name: 'Limites.pdf', page: 7}}, tag: 'rolagem', pdfSeed: 'Limites.pdf'});
  ctx.app = app;
  ctx.runtime = runtime;
  const pendingOpen = await page.evaluate(async () => (await import('./src/history-format-lazy.mjs')).lazyStats().pending);
  assert.ok(pendingOpen > 500, `a conversa longa abre em casca (${pendingOpen} pendentes)`);

  /* Meia altura: espera o que está na vista formatar; o alvo segue em casca.
     O gesto de roda marca a subida do aluno (o seguir só desliga por gesto). */
  await page.evaluate(async () => {
    const {messageScroller} = await import('./src/state.mjs');
    const scroller = messageScroller();
    scroller.dispatchEvent(new WheelEvent('wheel', {bubbles: true, deltaY: -500}));
    scroller.scrollTop = scroller.scrollHeight * 0.5;
    scroller.dispatchEvent(new Event('scroll', {bubbles: true}));
  });
  await settleFormats(page);
  /* Pergunta antiga formatada não puxa o aluno: passar por `applyChatScroll('send')`
     levava a vista até ela, e a subida pulava (achado integrando a #118). */
  const question = await page.evaluate(async () => {
    const {messageScroller} = await import('./src/state.mjs');
    const {formatLazyShell} = await import('./src/history-format-lazy.mjs');
    const scroller = messageScroller();
    const view = scroller.getBoundingClientRect();
    const target = [...document.querySelectorAll('#messages .message.user[data-lazy-shell]')].filter((el) => el.getBoundingClientRect().bottom < view.top).at(-1);
    /* Mede o que o aluno vê: a âncora legítima muda `scrollTop` e deixa a linha no lugar. */
    const sentinel = [...document.querySelectorAll('#messages .message')].find((el) => el.getBoundingClientRect().top >= view.top);
    const before = sentinel.getBoundingClientRect().top;
    const painted = formatLazyShell(target);
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
    return {painted, moved: Math.abs(sentinel.getBoundingClientRect().top - before)};
  });
  assert.equal(question.painted, true, 'havia pergunta em casca acima da vista');
  assert.ok(question.moved <= 2, `formatar a pergunta moveu a vista (${question.moved}px)`);

  /* Sem salto de rolagem: a âncora em `scrollTop` segura o leitor quando uma
     casca acima da vista pinta. Casca fora da vista é pulada pelo layout
     (`content-visibility`): formatar não mexe em nada — o caso que ancora é a
     casca já renderizada (a janela entre pintura e formato), forçada aqui com
     `content-visibility: visible`. O `overflow-anchor` do navegador é desligado
     na medição para isolar a correção (em produção os dois somam, sem briga —
     os outros testes rodam com o padrão ligado). */
  const anchored = await page.evaluate(async () => {
    const {messageScroller} = await import('./src/state.mjs');
    const {formatLazyShell} = await import('./src/history-format-lazy.mjs');
    const scroller = messageScroller();
    scroller.style.overflowAnchor = 'none';
    const view = scroller.getBoundingClientRect();
    const above = [...document.querySelectorAll('#messages .message[data-lazy-shell]')].filter((el) => el.getBoundingClientRect().bottom < view.top);
    /* Alvo com crescimento real: resposta com cerca de código (usuário cresce
       pouco e deixaria o teste vazio de novo). */
    const target = above.filter((el) => el.classList.contains('assistant') && el._raw.includes('```')).at(-1) || above.at(-1);
    target.style.contentVisibility = 'visible';
    const shellHeight = target.getBoundingClientRect().height;
    const sentinel = [...document.querySelectorAll('#messages .message')].find((el) => el.getBoundingClientRect().top >= view.top);
    const before = sentinel.getBoundingClientRect().top;
    const painted = formatLazyShell(target);
    const grown = target.getBoundingClientRect().height - shellHeight;
    const after = sentinel.getBoundingClientRect().top;
    scroller.style.overflowAnchor = '';
    target.style.contentVisibility = '';
    return {painted, aboveCount: above.length, drift: Math.abs(after - before), grown, targetShell: target.hasAttribute('data-lazy-shell')};
  });
  assert.ok(anchored.aboveCount > 5, `há cascas acima da vista (${anchored.aboveCount})`);
  assert.ok(anchored.grown > 50, `o formato cresceu a bolha (${anchored.grown.toFixed(0)}px)`);
  assert.equal(anchored.painted, true, 'a casca acima formata sob demanda');
  assert.equal(anchored.targetShell, false, 'a casca saiu');
  assert.ok(anchored.drift <= 2, `o leitor não se move (${anchored.drift.toFixed(1)}px)`);

  /* Rolagem real em passos para cima, medindo o que está à vista em cada
     passo e descontando o passo pedido. A medida fica no relatório: com
     `content-visibility: auto` (#67) a altura reservada de 160px troca pela
     real quando a bolha entra na margem, e o salto é independente da #118
     (o mesmo acontece com `HISTORY_LAZY_FORMAT_ENABLED=false`); o limite de
     2px do formato vale para a vista parada (medido acima), não para essa
     troca de altura do #67. */
  const walk = await page.evaluate(async () => {
    const {messageScroller} = await import('./src/state.mjs');
    const scroller = messageScroller();
    const firstVisible = () => {
      const view = scroller.getBoundingClientRect();
      return [...document.querySelectorAll('#messages .message')].find((el) => el.getBoundingClientRect().bottom > view.top + 1);
    };
    const drifts = [];
    for (let i = 0; i < 60 && scroller.scrollTop > 0; i++) {
      const anchor = firstVisible();
      const topBefore = anchor.getBoundingClientRect().top;
      const scrollBefore = scroller.scrollTop;
      scroller.scrollBy({top: -200, behavior: 'instant'});
      await new Promise(requestAnimationFrame);
      await new Promise(requestAnimationFrame);
      drifts.push(Math.abs((anchor.getBoundingClientRect().top - topBefore) + (scroller.scrollTop - scrollBefore)));
    }
    return {worst: Math.max(...drifts), steps: drifts.length};
  });
  console.log(`rolagem em passos (${walk.steps}): maior desvio ${walk.worst.toFixed(1)}px, do #67 (content-visibility)`);
  assert.ok(walk.steps >= 50, `subiu em passos (${walk.steps})`);

  /* Subir rápido até o topo não pula (com gesto: o seguir só desliga por gesto). */
  await page.evaluate(async () => {
    const {messageScroller} = await import('./src/state.mjs');
    const scroller = messageScroller();
    scroller.dispatchEvent(new WheelEvent('wheel', {bubbles: true, deltaY: -800}));
    scroller.scrollTop = 0;
    scroller.dispatchEvent(new Event('scroll', {bubbles: true}));
  });
  await page.waitForFunction(() => !document.querySelector('#messages .message')?.hasAttribute('data-lazy-shell'), undefined, {timeout: 30000});
  const top = await page.evaluate(async () => {
    const {messageScroller} = await import('./src/state.mjs');
    return {top: messageScroller().scrollTop, first: document.querySelector('#messages .message .body')?.textContent.slice(0, 40)};
  });
  assert.equal(top.top, 0, 'fica no topo');
  assert.match(top.first, /Pergunta 1/, 'a mais antiga está à vista e formatada');

  /* Citação para longe: o caminho real (`revealInChat`) formata antes de rolar e
     cai no lugar certo. Parte do fim: quem já está à vista não rola, de propósito. */
  const shellJump = await page.evaluate(async () => {
    const {revealInChat} = await import('./src/chat-scroll-view.mjs');
    const {messageScroller} = await import('./src/state.mjs');
    const scroller = messageScroller();
    const view = scroller.getBoundingClientRect();
    const el = [...document.querySelectorAll('#messages .message.assistant[data-lazy-shell]')].find((item) => item.getBoundingClientRect().top > view.bottom);
    if (!el) return {found: false};
    revealInChat(el);
    return {found: true, shell: el.hasAttribute('data-lazy-shell'), bottomGap: Math.abs(el.getBoundingClientRect().bottom - scroller.getBoundingClientRect().bottom)};
  });
  assert.equal(shellJump.found, true, 'há resposta em casca abaixo da vista');
  assert.equal(shellJump.shell, false, 'formatou antes de rolar');
  assert.ok(shellJump.bottomGap <= 4, `abaixo da vista, encosta o fim dela (a ${shellJump.bottomGap.toFixed(1)}px)`);
  const quote = await page.evaluate(async () => {
    const {revealInChat} = await import('./src/chat-scroll-view.mjs');
    const {messageScroller} = await import('./src/state.mjs');
    const el = document.querySelectorAll('#messages .message.assistant')[0];
    const scroller = messageScroller();
    scroller.scrollTop = scroller.scrollHeight;
    revealInChat(el);
    const gap = Math.abs(el.getBoundingClientRect().top - scroller.getBoundingClientRect().top);
    const ref = el.querySelector('button.pdf-ref');
    return {went: !!el.isConnected, shell: el.hasAttribute('data-lazy-shell'), gap, ref: ref ? {page: ref.dataset.page, path: ref.dataset.path, label: ref.textContent} : null};
  });
  assert.equal(quote.went, true, 'navegou até a mais antiga');
  assert.equal(quote.shell, false, 'a mais antiga segue formatada');
  assert.ok(quote.gap <= 4, `caiu no lugar certo (a ${quote.gap.toFixed(1)}px do topo)`);
  assert.deepEqual(quote.ref?.page, '7', 'o botão de citação tem a página');
  assert.equal(quote.ref?.path, pdfPath, 'o botão aponta o PDF da matéria');
  assert.match(quote.ref?.label || '', /Limites\.pdf, p\. 7/);
  await page.locator('#messages button.pdf-ref').first().click();
  await page.waitForFunction(() => document.querySelector('.pdf-panel .page-number')?.value === '7', undefined, {timeout: 15000});
  assert.equal(await page.locator('.pdf-panel .page-number').first().inputValue(), '7', 'o leitor cai na página citada');

  /* Corrida, ordem 1: monta B com a formatação de A pendente. */
  const messagesB = buildLazyMessages(100);
  const raceAB = await page.evaluate(async (msgsB) => {
    const lazy = await import('./src/history-format-lazy.mjs');
    const kept = [...document.querySelectorAll('#messages .message[data-lazy-shell]')].slice(0, 3);
    const genBefore = lazy.lazyStats().generation;
    const {showHistory} = await import('./src/chat.mjs');
    showHistory(msgsB);
    const {messageScroller} = await import('./src/state.mjs');
    messageScroller().scrollTop = messageScroller().scrollHeight;
    await new Promise((done) => setTimeout(done, 1200)); // espera fixa: o observador morto não pode pintar A; o de B pinta a margem
    const stats = lazy.lazyStats();
    const keptState = kept.map((el) => ({connected: el.isConnected, shell: el.hasAttribute('data-lazy-shell'), katex: el.querySelectorAll('.katex').length}));
    return {keptState, genGrew: stats.generation > genBefore, bubbles: document.querySelectorAll('#messages .message').length, pending: stats.pending};
  }, messagesB);
  assert.equal(raceAB.genGrew, true, 'a geração andou');
  assert.ok(raceAB.bubbles < 400 && raceAB.bubbles > 200, `B montou (${raceAB.bubbles} bolhas)`);
  assert.ok(raceAB.pending > 100, `só B tem pendência (${raceAB.pending})`);
  for (const kept of raceAB.keptState) assert.deepEqual(kept, {connected: false, shell: true, katex: 0}, 'A solta não formata nem pinta B');

  /* Corrida, ordem 2: sair antes de formatar mata o observador; voltar pinta. */
  const messagesA = buildLazyMessages(300, {quoteRef: {name: 'Limites.pdf', page: 7}});
  const raceBA = await page.evaluate(async (msgsA) => {
    const lazy = await import('./src/history-format-lazy.mjs');
    window.dispatchEvent(new Event('desk-conversation-changed'));
    const cancelled = lazy.lazyStats();
    const {showHistory} = await import('./src/chat.mjs');
    showHistory(msgsA);
    const {messageScroller} = await import('./src/state.mjs');
    messageScroller().scrollTop = messageScroller().scrollHeight;
    await new Promise((done) => setTimeout(done, 1200)); // espera fixa: a margem de B pinta; nada de A volta
    const stats = lazy.lazyStats();
    const tailKatex = [...document.querySelectorAll('#messages .message.assistant')].at(-1).querySelectorAll('.katex').length;
    return {cancelledPending: cancelled.pending, cancelledArmed: cancelled.armed, pending: stats.pending, tailKatex};
  }, messagesA);
  assert.equal(raceBA.cancelledPending, 0, 'sair zera a pendência');
  assert.equal(raceBA.cancelledArmed, false, 'sair desarma o lote');
  assert.ok(raceBA.pending > 500, `voltar a A rearma (${raceBA.pending} cascas)`);
  assert.ok(raceBA.tailKatex > 0, 'a cauda de A volta formatada');

  assert.deepEqual(errors, [], `sem erro de página (${errors.join(' | ')})`);
  await app.close(); ctx.app = null;
});
