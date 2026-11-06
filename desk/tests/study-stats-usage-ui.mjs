/* Uso do tutor recolhido com marcador visível (auditoria de UI/UX, rodada 7, D2):
   o bloco "Uso do tutor no período" é um `<details>` cujo `summary` usava
   `display:flex` sem chevron nem `::after`, então recolhido parecia seção
   vazia. Aqui se prova na janela real, em PT e EN, nos dois temas e em
   1440×900 e 900×650: o summary tem um chevron Lucide visível (gira com
   [open]), altura de 24 px, e abre com clique e teclado. Capturas em
   /tmp/opencode/ui-rodada7-consertos/ (olho humano, não asserção). */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  withArtifacts, newRuntime, seedCourse, writeConfigJson, writeDeskJson,
  launchDesk, freezeMotion, resizeWindow, setTheme, tinyPdf,
} from './helpers.mjs';
import {layoutStable} from './waits.mjs';
import ptBR from '../src/locales/pt-BR.json' with {type: 'json'};
import en from '../src/locales/en.json' with {type: 'json'};

const OUT = '/tmp/opencode/ui-rodada7-consertos';
const SIZES = [[1440, 900], [900, 650]];
const THEMES = ['light', 'dark'];
const LOCALES = [
  {locale: 'pt-BR', env: {}, catalog: ptBR},
  {locale: 'en', env: {LEARNING_DESK_LOCALE: 'en-US'}, catalog: en},
];

async function boot(tag, env) {
  const runtime = newRuntime(tag);
  const course = seedCourse(runtime, 'calc');
  const pdf = path.join(course, 'Limites.pdf');
  fs.writeFileSync(pdf, tinyPdf('Limites'));
  writeConfigJson(runtime, {runtimePath: runtime, vaultPath: runtime, courses: [{id: 'calc', name: 'Cálculo I', path: course}]});
  writeDeskJson(runtime, {courseId: 'calc', courseStates: {calc: {pdfs: [{path: pdf, page: 1}], study: {title: '', xopp: ''}}}});
  const app = await launchDesk({runtime, env});
  return {runtime, app};
}

async function openStats(page) {
  await page.locator('#study-menu .nav-trigger').click();
  await page.locator('#study-menu #study-stats-open').click();
  await page.waitForSelector('#study-stats-dialog[open]');
  await page.waitForSelector('#study-stats-usage summary');
}

await withArtifacts('study-stats-usage', async (ctx) => {
  fs.mkdirSync(OUT, {recursive: true});
  for (const {locale, env, catalog} of LOCALES) {
    const {runtime, app} = await boot(`stats-usage-${locale}`, env);
    ctx.runtime = runtime;
    ctx.app = app;
    try {
      const page = await app.firstWindow();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.waitForSelector('.pdf-panel canvas', {timeout: 30000});
      await freezeMotion(page);
      await openStats(page);
      await page.waitForFunction(() => document.querySelector('#study-stats-usage-text')?.textContent.length > 0);
      for (const [width, height] of SIZES) {
        await resizeWindow(ctx.app, page, width, height);
        for (const theme of THEMES) {
          await setTheme(page, theme);
          await layoutStable(page, '#study-stats-dialog');
          const tag = `${locale} ${theme} ${width}x${height}`;
          /* Recolhido de partida em cada ponto. */
          await page.evaluate(() => { document.querySelector('#study-stats-usage').open = false; });
          await page.screenshot({path: path.join(OUT, `d2-stats-${locale}-${theme}-${width}x${height}.png`)});
          assert.equal(await page.locator('#study-stats-usage summary').first().textContent().then((text) => text.trim()), catalog['stats.usage.title'], `${tag}: título do catálogo`);
          const marker = await page.evaluate(() => {
            const summary = document.querySelector('#study-stats-usage summary');
            const box = summary.getBoundingClientRect();
            const chevron = summary.querySelector('.study-stats-usage-chevron');
            const icon = chevron?.querySelector('svg, .icon');
            const iconBox = icon?.getBoundingClientRect?.();
            const style = chevron ? getComputedStyle(chevron) : null;
            return {
              hasChevron: !!chevron,
              iconW: iconBox?.width || 0,
              iconH: iconBox?.height || 0,
              visible: !!chevron && style.visibility !== 'hidden' && style.display !== 'none' && (iconBox?.width || 0) > 0,
              summaryH: box.height,
            };
          });
          assert.ok(marker.hasChevron, `${tag}: summary com chevron`);
          assert.ok(marker.visible && marker.iconW > 0 && marker.iconH > 0, `${tag}: chevron visível (${marker.iconW}x${marker.iconH})`);
          assert.ok(marker.summaryH >= 24, `${tag}: alvo de 24 px (altura ${marker.summaryH})`);
          /* Clique abre e mostra o texto; de novo, fecha. */
          await page.locator('#study-stats-usage summary').click();
          await page.waitForFunction(() => document.querySelector('#study-stats-usage').open === true);
          assert.match(await page.locator('#study-stats-usage-text').textContent(), /token|Token/, `${tag}: abrir mostra o uso`);
          await page.locator('#study-stats-usage summary').click();
          await page.waitForFunction(() => document.querySelector('#study-stats-usage').open === false);
          /* Teclado: foco + Enter abre. */
          await page.locator('#study-stats-usage summary').focus();
          await page.keyboard.press('Enter');
          await page.waitForFunction(() => document.querySelector('#study-stats-usage').open === true);
          await page.locator('#study-stats-usage summary').click();
          await page.waitForFunction(() => document.querySelector('#study-stats-usage').open === false);
          await page.evaluate(() => { document.querySelector('#study-stats-usage').open = false; });
        }
      }
      assert.deepEqual(errors, [], 'sem erro de página');
    } finally {
      await app.close();
    }
  }
  console.log('STUDY STATS USAGE UI PASSED: chevron visível, 24 px, clique e teclado, PT e EN, light/dark, 1440×900 e 900×650.');
});
