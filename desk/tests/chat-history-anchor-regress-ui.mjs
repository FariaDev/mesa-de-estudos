import assert from 'node:assert/strict';
import {withArtifacts} from './helpers.mjs';
import {openLazyDesk} from './chat-history-lazy-seed.mjs';

/* Regressão da revisão da #118 (âncora do histórico preguiçoso): cenários
   determinísticos dos itens 1 (desvio pendente engolido), 2 (âncora sai da
   vista com +800px), 4 (última casca drena até assentar) e o item 3 medido em
   janela (rolagem de seguir o fim não liga o acompanhamento). Itens 5
   (`beginLazyHistory` limpa o adiado), 6 (delta só de espaço não é resposta) e
   7 (aviso velho do limite não volta depois do `hide`) no mesmo abrir, para
   não pagar outra janela de 300 turnos. Adaptado das sondas do revisor
   (`probe-anchor-bugs`, `probe-stream-follow`, `probe5c`). */

await withArtifacts('chat-history-anchor-regress', async (ctx) => {
  const {app, page, errors, runtime} = await openLazyDesk(300, {tag: 'ancora-regress'});
  ctx.app = app;
  ctx.runtime = runtime;
  const pendingOpen = await page.evaluate(async () => (await import('./src/history-format-lazy.mjs')).lazyStats().pending);
  assert.ok(pendingOpen > 500, `a conversa longa abre em casca (${pendingOpen} pendentes)`);

  /* Meia altura: espera o que está na vista formatar; o alvo segue em casca.
     O gesto de roda marca a subida do aluno (o seguir só desliga por gesto);
     sem ele a vista voltaria ao fim e os itens 1 e 2 mediriam o fim. */
  await page.evaluate(async () => {
    const {messageScroller} = await import('./src/state.mjs');
    const scroller = messageScroller();
    scroller.dispatchEvent(new WheelEvent('wheel', {bubbles: true, deltaY: -500}));
    scroller.scrollTop = scroller.scrollHeight * 0.5;
    scroller.dispatchEvent(new Event('scroll', {bubbles: true}));
  });
  // espera fixa: o observador formata em rajadas; a vista assenta antes da medida
  await page.waitForTimeout(1200);
  const half = await page.evaluate(async () => {
    const {messageScroller, distanceFromEnd} = await import('./src/state.mjs');
    const scroller = messageScroller();
    return {top: scroller.scrollTop, max: scroller.scrollHeight - scroller.clientHeight, distance: distanceFromEnd()};
  });
  assert.ok(half.distance > 1000, `a vista fica no meio, longe do fim (${JSON.stringify(half)})`);
  assert.ok(half.top < half.max - 1000, `a vista fica no meio, longe do topo (${JSON.stringify(half)})`);

  /* Item 1: a segunda casca não engole o desvio pendente da primeira. */
  const item1 = await page.evaluate(async () => {
    const {messageScroller} = await import('./src/state.mjs');
    const anchorMod = await import('./src/history-scroll-anchor.mjs');
    const scroller = messageScroller();
    anchorMod.stopHistoryAnchor();
    for (const spacer of document.querySelectorAll('[data-probe-spacer]')) spacer.remove();
    const root = document.querySelector('#messages');
    root.getBoundingClientRect();
    const view = scroller.getBoundingClientRect();
    const pick = [...root.children].find((el) => el.getBoundingClientRect().top >= view.top + 0.5);
    if (!pick || !pick.previousElementSibling) return {skip: 'sem âncora'};
    const beforeScroll = scroller.scrollTop;
    anchorMod.aroundHistoryLayout(scroller, () => {});
    const above = pick.previousElementSibling;
    const spacer = document.createElement('div');
    spacer.dataset.probeSpacer = '1';
    spacer.style.height = '200px';
    above.after(spacer);
    root.getBoundingClientRect();
    const shift = pick.getBoundingClientRect().top - pick.getBoundingClientRect().top + 200;
    anchorMod.aroundHistoryLayout(scroller, () => {});
    for (let i = 0; i < 8; i++) await new Promise(requestAnimationFrame);
    const corrected = scroller.scrollTop - beforeScroll;
    anchorMod.stopHistoryAnchor();
    for (const node of document.querySelectorAll('[data-probe-spacer]')) node.remove();
    return {shift, corrected};
  });
  assert.ok(!item1.skip, 'item 1: há âncora para medir');
  assert.ok(Math.abs(item1.corrected - 200) <= 4, `item 1: o desvio pendente volta (${item1.corrected.toFixed(1)}px de 200px)`);

  /* Item 2: a âncora sai da vista (+800px) e o desvio corrige antes da troca. */
  const item2 = await page.evaluate(async () => {
    const {messageScroller} = await import('./src/state.mjs');
    const anchorMod = await import('./src/history-scroll-anchor.mjs');
    const scroller = messageScroller();
    anchorMod.stopHistoryAnchor();
    for (const spacer of document.querySelectorAll('[data-probe-spacer]')) spacer.remove();
    const root = document.querySelector('#messages');
    root.getBoundingClientRect();
    const view = scroller.getBoundingClientRect();
    const pick = [...root.children].find((el) => el.getBoundingClientRect().top >= view.top + 0.5);
    if (!pick || !pick.previousElementSibling) return {skip: 'sem âncora'};
    const beforeScroll = scroller.scrollTop;
    anchorMod.aroundHistoryLayout(scroller, () => {});
    const above = pick.previousElementSibling;
    const spacer = document.createElement('div');
    spacer.dataset.probeSpacer = '1';
    spacer.style.height = '800px';
    above.after(spacer);
    root.getBoundingClientRect();
    for (let i = 0; i < 10; i++) await new Promise(requestAnimationFrame);
    const corrected = scroller.scrollTop - beforeScroll;
    const overflow = scroller.style.overflowAnchor;
    anchorMod.stopHistoryAnchor();
    for (const node of document.querySelectorAll('[data-probe-spacer]')) node.remove();
    return {corrected, overflow};
  });
  assert.ok(!item2.skip, 'item 2: há âncora para medir');
  assert.ok(Math.abs(item2.corrected - 800) <= 6, `item 2: +800px acima corrige antes da troca (${item2.corrected.toFixed(1)}px)`);

  /* Item 4: zerar o `wanted` drena até assentar, em vez de parar na hora. */
  const item4 = await page.evaluate(async () => {
    const {messageScroller} = await import('./src/state.mjs');
    const anchorMod = await import('./src/history-scroll-anchor.mjs');
    const scroller = messageScroller();
    anchorMod.stopHistoryAnchor();
    anchorMod.setHistoryAnchorWanted(true);
    anchorMod.aroundHistoryLayout(scroller, () => {});
    anchorMod.setHistoryAnchorWanted(false);
    const draining = anchorMod.isHistoryAnchorActive();
    const overflowDuring = scroller.style.overflowAnchor;
    // espera fixa: a drenagem assenta em quadros; a folga cobre a máquina carregada
    await new Promise((done) => setTimeout(done, 1200));
    const settled = {
      active: anchorMod.isHistoryAnchorActive(),
      overflow: scroller.style.overflowAnchor,
    };
    anchorMod.setHistoryAnchorWanted(true);
    anchorMod.stopHistoryAnchor();
    return {draining, overflowDuring, settled};
  });
  assert.equal(item4.draining, true, 'item 4: a última casca drena em vez de parar na hora');
  assert.equal(item4.settled.active, false, 'item 4: depois de assentar, para');
  assert.ok(item4.settled.overflow !== 'none', `item 4: o overflow-anchor volta (${JSON.stringify(item4.settled.overflow)})`);

  /* Item 3 (honesto): o aluno sobe com roda real e o `followBottom` rola de
     verdade até o fim. O scroll do código chega como evento atrasado; sem a
     anotação na fonte única ele pareceria rolagem do aluno e ligaria o
     acompanhamento. A âncora desliga sozinha em 4 quadros quietos, então a
     medida conta se ela ligou em algum momento (`everActive`), não só no fim. */
  const wheelFrom = await page.evaluate(async () => (await import('./src/state.mjs')).messageScroller().scrollTop);
  await page.locator('#messages').hover();
  await page.mouse.wheel(0, -600);
  await page.waitForFunction((from) => {
    const chat = document.querySelector('#chat'), messages = document.querySelector('#messages');
    const el = chat && messages && chat.scrollHeight > chat.clientHeight + 1 ? chat : messages;
    return el.scrollTop < from - 50;
  }, wheelFrom, {timeout: 8000});
  const item3 = await page.evaluate(async () => {
    const {messageScroller, followBottom} = await import('./src/state.mjs');
    const anchorMod = await import('./src/history-scroll-anchor.mjs');
    const lazy = await import('./src/history-format-lazy.mjs');
    const scroller = messageScroller();
    /* A roda subiu de verdade (medido fora); o scroll dela é um gesto real e
       liga a âncora por desenho. Espera assinar parado — âncora desligada e
       `scrollTop` estável em quadros seguidos — senão o evento dela em voo
       contaminaria a medida do `followBottom`. */
    let stable = 0, last = scroller.scrollTop;
    for (let i = 0; i < 60; i++) {
      await new Promise(requestAnimationFrame);
      if (!anchorMod.isHistoryAnchorActive() && scroller.scrollTop === last) {
        stable += 1;
        if (stable >= 6) break;
      } else {
        stable = 0;
        last = scroller.scrollTop;
      }
    }
    const settled = {active: anchorMod.isHistoryAnchorActive(), stable, top: scroller.scrollTop};
    anchorMod.stopHistoryAnchor();
    scroller.style.overflowAnchor = '';
    window.__anchorScrolls = [];
    const onProbe = () => window.__anchorScrolls.push(scroller.scrollTop);
    scroller.addEventListener('scroll', onProbe, {passive: true});
    const pendingBefore = lazy.lazyStats().pending;
    const before = scroller.scrollTop;
    const max = scroller.scrollHeight - scroller.clientHeight;
    const away = max - before;
    followBottom(true);
    const after = scroller.scrollTop;
    const noted = anchorMod.isHistoryOwnScroll(scroller.scrollTop);
    let everActive = anchorMod.isHistoryAnchorActive();
    for (let i = 0; i < 6; i++) {
      await new Promise(requestAnimationFrame);
      if (anchorMod.isHistoryAnchorActive()) everActive = true;
    }
    // espera fixa: o scroll do Chromium chega depois do quadro
    await new Promise((done) => setTimeout(done, 120));
    if (anchorMod.isHistoryAnchorActive()) everActive = true;
    const pendingAfter = lazy.lazyStats().pending;
    const out = {
      settled,
      pendingBefore,
      pendingAfter,
      before,
      after,
      max,
      away,
      noted,
      events: window.__anchorScrolls.slice(),
      everActive,
      active: anchorMod.isHistoryAnchorActive(),
      overflow: scroller.style.overflowAnchor,
    };
    scroller.removeEventListener('scroll', onProbe);
    anchorMod.stopHistoryAnchor();
    scroller.style.overflowAnchor = '';
    return out;
  });
  assert.ok(item3.away > 50, `a roda subiu antes do follow (${(item3.away).toFixed(0)}px do fim)`);
  assert.ok(item3.settled.stable >= 6 && !item3.settled.active, `a roda assentou antes de medir (${JSON.stringify(item3.settled)})`);
  assert.ok(item3.after - item3.before > 50, `o followBottom rolou de verdade (${(item3.after - item3.before).toFixed(0)}px)`);
  assert.ok(item3.events.length > 0, `o scroll do código chegou como evento (${item3.events.length})`);
  assert.equal(item3.noted, true, 'a rolagem nossa sai de uma fonte só');
  assert.equal(item3.pendingAfter, item3.pendingBefore, `nenhuma casca formatou na medida (${item3.pendingBefore} → ${item3.pendingAfter})`);
  assert.equal(item3.everActive, false, 'seguir o fim não liga o acompanhamento em momento algum');
  assert.equal(item3.active, false, 'seguir o fim não liga o acompanhamento');
  assert.ok(item3.overflow !== 'none', `o overflow-anchor segue ligado (${JSON.stringify(item3.overflow)})`);

  /* Item 6: delta só de espaço/quebra não conta como resposta. */
  const item6 = await page.evaluate(async () => {
    const {turnState} = await import('./src/chat-turn-state.mjs');
    const turn = await import('./src/chat-turn.mjs');
    const savedAnswer = turnState.turnHadAnswer;
    turnState.turnHadAnswer = false;
    turn.appendAssistantDelta('\n', null);
    const newlineCounts = turnState.turnHadAnswer;
    turn.appendAssistantDelta('   ', null);
    const spacesCount = turnState.turnHadAnswer;
    turn.appendAssistantDelta('oi', null);
    const wordCounts = turnState.turnHadAnswer;
    const bubble = turnState.assistant;
    if (bubble && bubble.isConnected) bubble.remove();
    turn.resetAssistantBuffers();
    turnState.turnHadAnswer = savedAnswer;
    return {newlineCounts, spacesCount, wordCounts};
  });
  assert.equal(item6.newlineCounts, false, 'item 6: "\\n" sozinho não é resposta (esconderia o 403)');
  assert.equal(item6.spacesCount, false, 'item 6: só espaços não é resposta');
  assert.equal(item6.wordCounts, true, 'item 6: texto de verdade conta');

  /* Item 7: o aviso velho não volta depois do `hide` na janela do `await`. */
  const item7 = await page.evaluate(async () => {
    const {hideFreeLimitNote} = await import('./src/free-limit-notice.mjs');
    const {paintFreeLimitTurn} = await import('./src/chat.mjs');
    const {S} = await import('./src/state.mjs');
    hideFreeLimitNote();
    const desk = window.desk;
    const originalStatus = desk.opencodeStatus?.bind(desk);
    // espera fixa: a consulta da conta demora; a troca de modelo cai dentro do await
    desk.opencodeStatus = () => new Promise((done) => setTimeout(() => done({saved: false}), 300));
    const savedModel = S.choice?.model;
    const pending = paintFreeLimitTurn();
    // espera fixa: o paint precisa entrar no await antes da troca simulada
    await new Promise((done) => setTimeout(done, 30));
    if (S.choice) S.choice.model = '__race__';
    hideFreeLimitNote();
    await pending;
    const hidden = document.querySelector('#free-limit-note')?.hidden !== false;
    if (S.choice && savedModel !== undefined) S.choice.model = savedModel;
    if (originalStatus) desk.opencodeStatus = originalStatus;
    hideFreeLimitNote();
    return {hidden};
  });
  assert.equal(item7.hidden, true, 'item 7: trocar de modelo no `await` cancela o aviso velho');

  /* Item 5 por último: `beginLazyHistory` limpa o adiado da seleção. */
  const item5 = await page.evaluate(async () => {
    const lazy = await import('./src/history-format-lazy.mjs');
    const shell = document.querySelector('#messages .message[data-lazy-shell]');
    if (!shell) return {skip: 'sem casca'};
    const text = shell.querySelector('.body') || shell;
    const range = document.createRange();
    range.selectNodeContents(text);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    const touches = lazy.formatLazyShell(shell) === false && lazy.lazyDeferredCount() === 1;
    lazy.beginLazyHistory(50, null);
    const cleared = lazy.lazyDeferredCount() === 0;
    selection?.removeAllRanges();
    return {touches, cleared};
  });
  assert.ok(!item5.skip, 'item 5: há casca para adiar pela seleção');
  assert.equal(item5.touches, true, 'item 5: a seleção adia a casca tocada');
  assert.equal(item5.cleared, true, 'item 5: remontar limpa o adiado sem `desk-conversation-changed`');

  assert.deepEqual(errors, [], `sem erro de página (${errors.join(' | ')})`);
  await app.close(); ctx.app = null;
});
