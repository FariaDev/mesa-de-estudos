/* Ritmo dos Ajustes e do Backup (auditoria de UI/UX, rodada 4, F4): as abas
   do menu medem a mesma altura (uma ou duas linhas) em 1440 e 900, e os três
   ajustes numéricos do backup ("a cada … horas", "depois de … min sem uso",
   "guardar … versões") ocupam três linhas distintas em vez de um bloco só.
   Só medidas do navegador real e CSSOM, sem regex de folha. */
import assert from 'node:assert/strict';
import {withArtifacts,newRuntime,seedCourse,writeConfigJson,writeDeskJson,launchDesk,statusOnline,freezeMotion,resizeWindow,setTheme,tinyPdf} from './helpers.mjs';
import {settle} from './layout-measure.mjs';
import path from 'node:path';

await withArtifacts('settings-rhythm', async (ctx) => {
  const runtime = ctx.runtime = newRuntime('settings-rhythm');
  const course = seedCourse(runtime, 'calc');
  const pdf = path.join(course, 'Limites.pdf');
  const {writeFileSync} = await import('node:fs');
  writeFileSync(pdf, tinyPdf('Limites e derivadas'));
  writeConfigJson(runtime, {runtimePath: runtime, vaultPath: runtime, courses: [{id: 'calc', name: 'Cálculo I', path: course}]});
  writeDeskJson(runtime, {courseId: 'calc', courseStates: {calc: {pdfs: [{path: pdf, page: 1}], study: {title: '', xopp: ''}}}});
  ctx.app = await launchDesk({runtime});
  const page = await ctx.app.firstWindow();
  await statusOnline(page);
  await freezeMotion(page);
  await page.waitForSelector('.pdf-panel canvas', {timeout: 30000});
  for (const [width, height] of [[1440, 900], [900, 650]]) {
    await resizeWindow(ctx.app, page, width, height);
    const tag = `${width}x${height}`;
    await page.keyboard.press('ControlOrMeta+,');
    await page.waitForSelector('#settings-dialog[open]', {timeout: 10000});
    await settle(page);
    const tabs = await page.evaluate(() => [...document.querySelectorAll('.settings-tab')].map((el) => {
      const r = el.getBoundingClientRect();
      return {text: el.textContent.trim(), h: r.height};
    }));
    assert.ok(tabs.length >= 4, `${tag}: esperava as abas dos Ajustes, mediu ${tabs.length}`);
    for (const t of tabs) {
      assert.ok(Math.abs(t.h - tabs[0].h) <= 1, `${tag}: aba "${t.text}" com ${t.h.toFixed(1)}px, esperado ${tabs[0].h.toFixed(1)}px como as vizinhas`);
    }
    await page.keyboard.press('Escape');
    await page.locator('#study-menu .nav-trigger').click();
    await page.locator('#study-menu #study-backup-open').click();
    await page.waitForSelector('#mesa-backup-panel[open]', {timeout: 15000});
    await settle(page);
    const rows = await page.evaluate(() => ['mesa-bkp-intervalo', 'mesa-bkp-parado', 'mesa-bkp-guardar'].map((id) => {
      const el = document.getElementById(id);
      const r = el ? el.getBoundingClientRect() : {top: -1, height: 0};
      return {id, top: r.top, h: r.height};
    }));
    assert.ok(rows.every((r) => r.top >= 0), `${tag}: os três ajustes numéricos estão à vista`);
    const tops = new Set(rows.map((r) => Math.round(r.top)));
    assert.equal(tops.size, 3, `${tag}: três ajustes em três linhas, mediu topos ${[...tops].join(', ')}`);
    await page.keyboard.press('Escape');
  }
  await setTheme(page, 'light');
  console.log('SETTINGS RHYTHM UI PASSED: abas uniformes e três ajustes em três linhas, 900 e 1440.');
});
