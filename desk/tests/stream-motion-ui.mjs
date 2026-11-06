/* Movimento do stream e dos pontos (auditoria de UI/UX, rodada 4, movimento):
   as capturas congelam o movimento, então esta é a prova da categoria sem
   `freezeMotion`. Durante um stream longo, nenhuma animação corre por mais de
   2,5s na coluna; os pontos de "Chamando o tutor" usam o laço do token (curto)
   e somem com `prefers-reduced-motion: reduce`. A abertura de diálogo segue
   provada no motion-ui.mjs. Só Web Animations e CSSOM, sem regex de folha. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {withArtifacts,newRuntime,seedCourse,writeConfigJson,writeDeskJson,launchDesk,statusOnline,resizeWindow,setTheme,tinyPdf,FAKE_OPENCODE} from './helpers.mjs';
import {nextFrames} from './waits.mjs';

const SHORT_ENOUGH = 2.5;

function running(page, selector) {
  return page.evaluate((sel) => [...document.querySelectorAll(sel)].flatMap((el) => el.getAnimations({subtree: true})
    .filter((a) => a.playState === 'running')
    .map((a) => {
      const timing = a.effect?.getComputedTiming?.() || {};
      return {name: a.animationName || a.transitionProperty || '?', duration: Number(timing.duration) || 0, infinite: timing.iterations === Infinity};
    })), selector);
}

await withArtifacts('motion-stream', async (ctx) => {
  const runtime = ctx.runtime = newRuntime('motion-stream');
  const course = seedCourse(runtime, 'calc');
  const pdf = path.join(course, 'Limites.pdf');
  fs.writeFileSync(pdf, tinyPdf('Limites e derivadas'));
  writeConfigJson(runtime, {runtimePath: runtime, vaultPath: runtime, courses: [{id: 'calc', name: 'Cálculo I', path: course}]});
  writeDeskJson(runtime, {courseId: 'calc', courseStates: {calc: {pdfs: [{path: pdf, page: 1}], study: {title: '', xopp: ''}}}});
  ctx.app = await launchDesk({runtime, env: {FAKE_OPENCODE_STREAM: 'long', FAKE_OPENCODE_STREAM_DELTAS: '2000', FAKE_OPENCODE_STREAM_DELTA_MS: '50'}});
  const page = await ctx.app.firstWindow();
  await resizeWindow(ctx.app, page, 1440, 900);
  await statusOnline(page);
  /* Sem freezeMotion de propósito: é a categoria do movimento. */
  await page.waitForSelector('.pdf-panel canvas', {timeout: 30000});
  await page.locator('#prompt').fill('stream longo sobre limites');
  await page.locator('#send').click();
  await page.waitForFunction(() => !document.querySelector('#stop')?.hidden, undefined, {timeout: 30000});
  await page.waitForFunction(() => (document.querySelector('.message.assistant .body')?.textContent || '').length > 200, undefined, {timeout: 30000});
  const live = await running(page, '#chat');
  for (const a of live) {
    assert.ok(a.duration <= SHORT_ENOUGH * 1000, `stream: animação ${a.name} dura ${a.duration}ms, esperado até ${SHORT_ENOUGH}s`);
  }
  await page.emulateMedia({reducedMotion: 'reduce'});
  await page.waitForFunction(() => [...document.querySelectorAll('#chat')].every((el) => el.getAnimations({subtree: true}).every((a) => a.playState !== 'running')), undefined, {timeout: 8000});
  const reduced = await running(page, '#chat');
  assert.deepEqual(reduced, [], `stream com movimento reduzido: ${JSON.stringify(reduced)}`);
  await page.emulateMedia({reducedMotion: 'no-preference'});
  await page.locator('#stop').click({timeout: 30000});
  console.log(`MOTION STREAM UI PASSED: ${live.length} animação(ões) curta(s) no stream, zero no reduce.`);
});

await withArtifacts('motion-dots', async (ctx) => {
  /* Motor que não sobe sem o portão: a janela "ligando" (com os pontos) fica
     aberta o tempo que o teste quiser. */
  const runtime = ctx.runtime = newRuntime('motion-dots');
  const course = seedCourse(runtime, 'calc');
  const pdf = path.join(course, 'Limites.pdf');
  fs.writeFileSync(pdf, tinyPdf('Limites e derivadas'));
  writeDeskJson(runtime, {courseId: 'calc', courseStates: {calc: {pdfs: [{path: pdf, page: 1}], study: {title: '', xopp: ''}}}});
  writeConfigJson(runtime, {runtimePath: runtime, vaultPath: runtime, courses: [{id: 'calc', name: 'Cálculo I', path: course}]});
  const wrapper = path.join(runtime, 'opencode-gate.mjs');
  fs.writeFileSync(wrapper, `#!/usr/bin/env node\nimport {spawn} from 'node:child_process';\nimport fs from 'node:fs';\nimport path from 'node:path';\nconst gate=${JSON.stringify(path.join(runtime, 'gate.open'))};\nconst timer=setInterval(()=>{\n if(!fs.existsSync(gate))return;\n clearInterval(timer);\n const child=spawn(process.execPath,[${JSON.stringify(FAKE_OPENCODE)},...process.argv.slice(2)],{stdio:'inherit'});\n child.on('exit',code=>process.exit(code??0));\n},50);\n`);
  fs.chmodSync(wrapper, 0o755);
  ctx.app = await launchDesk({runtime, env: {LEARNING_DESK_OPENCODE: wrapper}});
  const page = await ctx.app.firstWindow();
  await resizeWindow(ctx.app, page, 1440, 900);
  await page.waitForSelector('#tutor-state[data-state="connecting"]', {timeout: 30000});
  await nextFrames(page);
  const dots = await page.evaluate(() => [...document.querySelectorAll('#tutor-state .ts-dots span')].map((el) => {
    const cs = getComputedStyle(el);
    return {name: cs.animationName, duration: cs.animationDuration, delay: cs.animationDelay, running: el.getAnimations().some((a) => a.playState === 'running')};
  }));
  assert.equal(dots.length, 3, `3 pontos de carregamento (veio ${dots.length})`);
  for (const d of dots) {
    assert.equal(d.name, 'ts-dot', `ponto com o laço declarado (veio ${d.name})`);
    assert.ok(parseFloat(d.duration) <= SHORT_ENOUGH, `ponto dura ${d.duration}, esperado até ${SHORT_ENOUGH}s`);
  }
  /* O escalonamento é o do laço do token (docs/design/movimento.md): o 2º ponto
     atrasa --t-loop/8 e o 3º --t-loop/4 — 0.15s e 0.3s com o laço de 1.2s. A
     asserção antiga montava o esperado com o próprio medido (`dots[1].delay`),
     então passava até com os três pontos juntos em 0s; esta cobra os valores
     de verdade, via CSSOM. */
  assert.deepEqual(dots.map((d) => d.delay), ['0s', '0.15s', '0.3s'], `pontos escalonados (veio ${dots.map((d) => d.delay).join(', ')})`);
  assert.ok(dots[1].delay !== dots[2].delay && dots[1].delay !== '0s', `escalonamento distinto (veio ${dots.map((d) => d.delay).join(', ')})`);
  await page.emulateMedia({reducedMotion: 'reduce'});
  await nextFrames(page);
  const still = await page.evaluate(() => [...document.querySelectorAll('#tutor-state .ts-dots span')].map((el) => getComputedStyle(el).animationDuration));
  assert.ok(still.every((d) => d === '0s'), `pontos somem no reduce (veio ${still.join(', ')})`);
  await page.emulateMedia({reducedMotion: 'no-preference'});
  await setTheme(page, 'light');
  console.log('MOTION DOTS UI PASSED: pontos curtos no laço do token, zero no reduce.');
});
