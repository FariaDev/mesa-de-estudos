// node tests/chat-follow-gesture-ui.mjs — o seguir só desliga por gesto real.
// Layout crescendo acima, diário recolhendo e figura tardia não desligam;
// roda, PageUp e arrasto da barra desligam e a resposta não puxa de volta.
import assert from 'node:assert/strict';
import {withArtifacts,newRuntime,seedCourse,writeDeskJson,writeConfigJson,launchDesk,statusOnline,freezeMotion,resizeWindow} from './helpers.mjs';
import {nextFrames} from './waits.mjs';

const scrollerState = (page) => page.evaluate(() => {
  const chat = document.querySelector('#chat'), messages = document.querySelector('#messages');
  const el = chat && messages && chat.scrollHeight > chat.clientHeight + 1 ? chat : messages;
  return el ? {top: el.scrollTop, distance: el.scrollHeight - el.scrollTop - el.clientHeight, height: el.scrollHeight, client: el.clientHeight} : null;
});
const toBottom = (page) => page.evaluate(() => {
  const chat = document.querySelector('#chat'), messages = document.querySelector('#messages');
  const el = chat && messages && chat.scrollHeight > chat.clientHeight + 1 ? chat : messages;
  el.scrollTop = el.scrollHeight;
  el.dispatchEvent(new Event('scroll', {bubbles: true}));
});
const streamPull = (page) => page.evaluate(async () => {
  const {applyChatScroll, distanceFromEnd} = await import('./src/state.mjs');
  const before = document.querySelector('#messages')?.scrollTop ?? 0;
  applyChatScroll('stream', null, distanceFromEnd());
  await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  const chat = document.querySelector('#chat'), messages = document.querySelector('#messages');
  const el = chat && messages && chat.scrollHeight > chat.clientHeight + 1 ? chat : messages;
  return {before, after: el.scrollTop, distance: el.scrollHeight - el.scrollTop - el.clientHeight};
});

await withArtifacts('chat-follow-gesture', async (ctx) => {
  const runtime = ctx.runtime = newRuntime('chat-follow-gesture');
  const course = seedCourse(runtime, 'calc');
  writeConfigJson(runtime, {vaultPath: runtime, courses: [{id: 'calc', name: 'Cálculo', path: course}]});
  writeDeskJson(runtime, {courseId: 'calc'});
  const app = ctx.app = await launchDesk({runtime});
  const page = await app.firstWindow();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await resizeWindow(app, page, 1440, 900);
  await statusOnline(page);
  await freezeMotion(page);

  // Base rolável sem tutor: 40 bolhas de 200px.
  await page.evaluate(() => {
    const messages = document.querySelector('#messages');
    messages.replaceChildren();
    for (let i = 0; i < 40; i++) {
      const bubble = document.createElement('div');
      bubble.className = 'message assistant';
      bubble.style.height = '200px';
      bubble.innerHTML = `<div class="body">bolha ${i}</div>`;
      messages.append(bubble);
    }
  });
  await nextFrames(page, 2);
  let base = await scrollerState(page);
  assert.ok(base && base.height > base.client * 2, `base rolável (${JSON.stringify(base)})`);

  // Garante o seguir ligado e a vista no fim.
  await toBottom(page);
  await nextFrames(page, 2);
  let end = await scrollerState(page);
  assert.ok(end.distance <= 2, `começa no fim (${JSON.stringify(end)})`);

  /* 1. Rolagem sem gesto (layout, âncora nativa, clamp) não desliga: vai ao
     meio sem roda e o stream puxa de volta. No código antigo, esse `scroll`
     sem marca desligava o seguir. */
  await page.evaluate(() => {
    const chat = document.querySelector('#chat'), messages = document.querySelector('#messages');
    const el = chat && messages && chat.scrollHeight > chat.clientHeight + 1 ? chat : messages;
    el.scrollTop = Math.max(0, el.scrollHeight - el.clientHeight - 600);
    el.dispatchEvent(new Event('scroll', {bubbles: true}));
  });
  await nextFrames(page, 2);
  const laid = await scrollerState(page);
  assert.ok(laid.distance > 200, `rolagem sem gesto afasta (${JSON.stringify(laid)})`);
  const kept = await streamPull(page);
  assert.ok(kept.distance <= 2, `sem gesto, o stream puxa de volta (${JSON.stringify(kept)})`);
  await toBottom(page);
  await nextFrames(page, 2);

  /* 2. Roda real desliga e o stream não puxa de volta. */
  await page.locator('#messages').hover();
  await page.mouse.wheel(0, -600);
  await nextFrames(page, 2);
  const wheeled = await scrollerState(page);
  assert.ok(wheeled.distance > 200, `a roda subiu (${JSON.stringify(wheeled)})`);
  const heldWheel = await streamPull(page);
  assert.ok(heldWheel.distance > 200, `depois da roda, o stream respeita (${JSON.stringify(heldWheel)})`);
  assert.ok(Math.abs(heldWheel.after - heldWheel.before) <= 4, `não puxou de volta (${JSON.stringify(heldWheel)})`);

  // Volta ao fim religa (roda para baixo até o fim).
  await toBottom(page);
  await nextFrames(page, 2);
  end = await scrollerState(page);
  assert.ok(end.distance <= 2, `volta ao fim (${JSON.stringify(end)})`);

  /* 3. Teclado PageUp desliga: foco real num botão dentro da vista (sem
     rolar até ele) e PageUp real. Sem `keydown` nem `scroll` sintéticos — os
     dois sozinhos já desligariam o seguir. A rolagem nativa é suave: espera
     assentar por condição, sem sleep fixo. */
  await page.evaluate(() => {
    const messages = document.querySelector('#messages');
    if (!messages.querySelector('.probe-focus')) {
      for (const bubble of messages.querySelectorAll('.message')) {
        if (bubble.querySelector('.probe-focus')) continue;
        const focus = document.createElement('button');
        focus.type = 'button';
        focus.className = 'probe-focus';
        focus.textContent = 'foco';
        bubble.querySelector('.body')?.append(focus);
      }
    }
    const view = messages.getBoundingClientRect();
    const target = [...messages.querySelectorAll('.probe-focus')].find((button) => {
      const box = button.getBoundingClientRect();
      return box.top > view.top + 40 && box.bottom < view.bottom - 40;
    });
    if (!target) throw new Error('sem botão dentro da vista para o PageUp');
    target.focus({preventScroll: true});
  });
  await page.keyboard.press('PageUp');
  /* Condição de assento: dois quadros seguidos sem a posição andar e longe do
     fim (a rolagem nativa continua depois do `keydown`). */
  await page.waitForFunction(() => {
    const chat = document.querySelector('#chat'), messages = document.querySelector('#messages');
    const el = chat && messages && chat.scrollHeight > chat.clientHeight + 1 ? chat : messages;
    const top = el.scrollTop, distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distance <= 100) return false;
    if (window.__pageUpLast === top) {
      window.__pageUpStill = (window.__pageUpStill || 0) + 1;
      return window.__pageUpStill >= 2;
    }
    window.__pageUpLast = top;
    window.__pageUpStill = 0;
    return false;
  }, undefined, {timeout: 8000});
  const paged = await scrollerState(page);
  assert.ok(paged.distance > 100, `o PageUp subiu (${JSON.stringify(paged)})`);
  const heldKey = await streamPull(page);
  assert.ok(heldKey.distance > 100, `depois do PageUp, o stream respeita (${JSON.stringify(heldKey)})`);

  await toBottom(page);
  await nextFrames(page, 2);

  /* 4. Arrastar a barra (pointerdown no rolador) desliga, sem wheel. */
  await page.evaluate(() => {
    const chat = document.querySelector('#chat'), messages = document.querySelector('#messages');
    const el = chat && messages && chat.scrollHeight > chat.clientHeight + 1 ? chat : messages;
    el.dispatchEvent(new PointerEvent('pointerdown', {bubbles: true, pointerId: 7, pointerType: 'mouse'}));
    el.scrollTop = Math.max(0, el.scrollHeight - el.clientHeight - 500);
    el.dispatchEvent(new Event('scroll', {bubbles: true}));
    document.dispatchEvent(new PointerEvent('pointerup', {bubbles: true, pointerId: 7, pointerType: 'mouse'}));
  });
  await nextFrames(page, 2);
  const dragged = await scrollerState(page);
  assert.ok(dragged.distance > 200, `o arrasto subiu (${JSON.stringify(dragged)})`);
  const heldDrag = await streamPull(page);
  assert.ok(heldDrag.distance > 200, `depois do arrasto, o stream respeita (${JSON.stringify(heldDrag)})`);

  await toBottom(page);
  await nextFrames(page, 2);
  /* O toBottom acima passou por `followBottom` e a marca de 500 ms ainda está
     viva; cair em cima dela religa o seguir só no papel, e a figura seguinte
     denunciaria como falso negativo (Mac rodada 4b). */
  await page.waitForTimeout(600);// espera fixa: marca OWN_SCROLL_MS de 500 ms

  /* 5. Figura tardia de 571px no fim, sem gesto, não desliga: acompanha. */
  await page.evaluate(() => {
    const figure = document.createElement('div');
    figure.id = 'late-figure';
    figure.style.height = '571px';
    document.querySelector('#messages').append(figure);
  });
  await nextFrames(page, 3);
  const figured = await streamPull(page);
  assert.ok(figured.distance <= 2, `a figura tardia acompanha (${JSON.stringify(figured)})`);
  await page.evaluate(() => document.querySelector('#late-figure')?.remove());

  assert.deepEqual(errors, [], `erros de página: ${JSON.stringify(errors)}`);
});
console.log('chat-follow-gesture-ui: ok');
