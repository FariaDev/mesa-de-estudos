/* "Como a Mesa funciona" é botão (auditoria de UI/UX, rodada 4, F6): na barra
   da primeira abertura ele levava a borda de campo, enquanto os vizinhos são
   quietos — passa ao mesmo tratamento secundário quieto (sem caixa, texto
   discreto) com fundo no hover, que o diz botão sem sombra de dúvida. No menu
   do leitor, os controles do mesmo tipo medem a mesma altura (28px). Só
   medidas do navegador real e CSSOM, sem regex de folha. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {_electron as electron} from '@playwright/test';
import {DESK,deskEnv,newRuntime,seedCourse,writeConfigJson,writeDeskJson,launchDesk,statusOnline,freezeMotion,resizeWindow,setTheme,tinyPdf,withArtifacts} from './helpers.mjs';
import {settle} from './layout-measure.mjs';

function scenario(tag) {
  const runtime = newRuntime(tag);
  const home = path.join(runtime, 'home');
  fs.mkdirSync(home, {recursive: true});
  const entry = path.join(runtime, 'entry.cjs');
  fs.writeFileSync(entry, `require('electron').app.setPath('userData',__dirname);require(${JSON.stringify(path.join(DESK, 'main.cjs'))});`);
  fs.writeFileSync(path.join(runtime, 'config.json'), JSON.stringify({runtimePath: runtime, courses: []}));
  const launch = () => {
    const env = deskEnv(runtime, {HOME: home, USERPROFILE: home});
    delete env.LEARNING_DESK_RUNTIME;
    return electron.launch({args: [entry], cwd: DESK, env});
  };
  return {runtime, launch};
}

await withArtifacts('first-run-help', async (ctx) => {
  const s = scenario('first-run-help');
  ctx.runtime = s.runtime;
  ctx.app = await s.launch();
  const page = await ctx.app.firstWindow();
  await page.waitForSelector('body[data-first-run="true"]', {timeout: 30000});
  await resizeWindow(ctx.app, page, 1440, 900);
  await freezeMotion(page);
  const look = await page.evaluate(() => {
    const css = (el) => getComputedStyle(el);
    const help = document.querySelector('#first-run-help');
    const quiet = document.querySelector('.setup-bar-actions .setup-quiet');
    return {
      help: {border: css(help).borderTopWidth, bg: css(help).backgroundColor, h: help.getBoundingClientRect().height},
      quiet: {border: css(quiet).borderTopWidth, bg: css(quiet).backgroundColor, h: quiet.getBoundingClientRect().height},
    };
  });
  assert.equal(look.help.border, '0px', `"Como a Mesa funciona" sem borda de campo (veio ${look.help.border})`);
  assert.equal(look.quiet.border, '0px', 'vizinho quieto sem borda');
  assert.equal(look.help.h, look.quiet.h, `"Como a Mesa funciona" com a altura do vizinho (${look.help.h} vs ${look.quiet.h})`);
  await page.locator('#first-run-help').hover();
  const hoverBg = await page.evaluate(() => getComputedStyle(document.querySelector('#first-run-help')).backgroundColor);
  assert.notEqual(hoverBg, look.help.bg, '"Como a Mesa funciona" acende o fundo no hover (é botão)');
  assert.ok(!/rgba\(0, 0, 0, 0\)|transparent/.test(hoverBg), `fundo do hover opaco (veio ${hoverBg})`);
  console.log('FIRST RUN HELP UI PASSED: controle secundário quieto com hover de botão.');
});

await withArtifacts('reader-menu-height', async (ctx) => {
  const runtime = ctx.runtime = newRuntime('reader-menu-height');
  const course = seedCourse(runtime, 'calc');
  const pdf = path.join(course, 'Limites.pdf');
  fs.writeFileSync(pdf, tinyPdf('Limites e derivadas'));
  writeConfigJson(runtime, {runtimePath: runtime, vaultPath: runtime, courses: [{id: 'calc', name: 'Cálculo I', path: course}]});
  writeDeskJson(runtime, {courseId: 'calc', courseStates: {calc: {pdfs: [{path: pdf, page: 1}], study: {title: '', xopp: ''}}}});
  ctx.app = await launchDesk({runtime});
  const page = await ctx.app.firstWindow();
  await statusOnline(page);
  await freezeMotion(page);
  await page.waitForSelector('.pdf-panel canvas', {timeout: 30000});
  for (const [width, height] of [[1440, 900], [900, 650]]) {
    await resizeWindow(ctx.app, page, width, height);
    await page.locator('.pdf-panel .more').first().click();
    await page.waitForSelector('.pdf-more-pop:not([hidden])', {timeout: 10000});
    await settle(page);
    const rows = await page.evaluate(() => [...document.querySelectorAll('.pdf-more-pop:not([hidden]) button, .pdf-more-pop:not([hidden]) .more-zoom')].map((el) => {
      const label = (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40);
      return {label, h: el.getBoundingClientRect().height};
    }));
    assert.ok(rows.length >= 5, `${width}x${height}: esperava os controles do menu, mediu ${rows.length}`);
    for (const r of rows) {
      assert.ok(Math.abs(r.h - 28) <= 1, `${width}x${height}: "${r.label}" com ${r.h.toFixed(1)}px, esperado 28px como os vizinhos`);
    }
    await page.keyboard.press('Escape');
  }
  await setTheme(page, 'light');
  console.log('READER MENU HEIGHT UI PASSED: controles do menu com 28px, 900 e 1440.');
});
