/* Estatísticas sem dados (auditoria de UI/UX, rodada 6, G1): o gráfico vazio
   mantinha 150 px e parecia área não carregada. Sem barras, o gráfico marca
   `data-empty` e vira uma linha quieta; com dados, segue com 150 px. Medido na
   janela real, nos dois temas, PT e EN, com e sem dados. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {
  withArtifacts,newRuntime,seedCourse,writeConfigJson,writeDeskJson,launchDesk,statusOnline,
  freezeMotion,resizeWindow,setTheme,tinyPdf,
} from './helpers.mjs';
import {layoutStable} from './waits.mjs';
import ptBR from '../src/locales/pt-BR.json' with {type: 'json'};
import en from '../src/locales/en.json' with {type: 'json'};

const require = createRequire(import.meta.url);
const statistics = require('../src/study-data/statistics.cjs');

async function boot(tag, {locale, seed}) {
  const runtime = newRuntime(tag);
  const course = seedCourse(runtime, 'calc');
  const pdf = path.join(course, 'Limites.pdf');
  fs.writeFileSync(pdf, tinyPdf('Limites'));
  writeConfigJson(runtime, {runtimePath: runtime, vaultPath: runtime, courses: [{id: 'calc', name: 'Cálculo I', path: course}]});
  writeDeskJson(runtime, {courseId: 'calc', courseStates: {calc: {pdfs: [{path: pdf, page: 1}], study: {title: '', xopp: ''}}}});
  if (seed) {
    const now = Date.now();
    statistics.control(runtime, {action: 'start', at: now - 90000, courseId: 'calc'});
    for (const beat of [now - 60000, now - 30000, now]) statistics.recordActivity(runtime, {id: `seed-${beat}`, at: beat, now: beat, running: true, visible: true, courseId: 'calc'});
    statistics.control(runtime, {action: 'stop', at: now, courseId: 'calc'});
  }
  const env = locale === 'en' ? {LEARNING_DESK_LOCALE: 'en-US'} : {};
  const app = await launchDesk({runtime, env});
  return {runtime, app};
}

async function chartState(ctx, theme) {
  const page = await ctx.app.firstWindow();
  await resizeWindow(ctx.app, page, 1440, 900);
  await statusOnline(page);
  await freezeMotion(page);
  await page.waitForSelector('.pdf-panel canvas', {timeout: 30000});
  await setTheme(page, theme);
  await page.locator('#study-menu .nav-trigger').click();
  await page.locator('#study-menu #study-stats-open').click();
  await page.waitForSelector('#study-stats-dialog[open]');
  await page.waitForSelector('#study-stats-chart');
  await layoutStable(page, '#study-stats-chart');
  const state = await page.evaluate(() => {
    const chart = document.querySelector('#study-stats-chart');
    const box = chart.getBoundingClientRect();
    const line = chart.querySelector('.study-stats-empty');
    return {
      empty: chart.getAttribute('data-empty'),
      height: box.height,
      bars: chart.querySelectorAll('.study-stats-bar').length,
      line: line ? line.textContent.trim() : null,
    };
  });
  await page.keyboard.press('Escape');
  return state;
}

await withArtifacts('stats-vazio', async (ctx) => {
  for (const {locale, catalog} of [{locale: 'pt-BR', catalog: ptBR}, {locale: 'en', catalog: en}]) {
    /* Sem dados: linha quieta, sem o vão de 150 px. */
    {
      const {runtime, app} = await boot(`stats-vazio-${locale}`, {locale, seed: false});
      ctx.runtime = runtime;
      ctx.app = app;
      try {
        for (const theme of ['light', 'dark']) {
          const state = await chartState(ctx, theme);
          const tag = `${locale} ${theme} vazio`;
          assert.equal(state.empty, 'true', `${tag}: o gráfico marca data-empty`);
          assert.equal(state.bars, 0, `${tag}: sem barras`);
          assert.equal(state.line, catalog['stats.chart.empty'], `${tag}: linha quieta do catálogo`);
          assert.ok(state.height <= 48, `${tag}: sem o vão de 150 px (altura ${state.height}px)`);
        }
      } finally {
        await app.close();
      }
    }
    /* Com dados: o gráfico segue com 150 px. */
    {
      const {runtime, app} = await boot(`stats-dados-${locale}`, {locale, seed: true});
      ctx.runtime = runtime;
      ctx.app = app;
      try {
        const state = await chartState(ctx, 'light');
        const tag = `${locale} light com dados`;
        assert.equal(state.empty, null, `${tag}: sem data-empty`);
        assert.ok(state.bars > 0, `${tag}: com barras`);
        assert.equal(state.line, null, `${tag}: sem linha quieta`);
        assert.ok(Math.abs(state.height - 150) <= 1, `${tag}: gráfico de 150 px (altura ${state.height}px)`);
      } finally {
        await app.close();
      }
    }
  }
  console.log('STUDY STATS EMPTY UI PASSED: vazio vira linha quieta, com dados segue 150 px, PT e EN, light e dark.');
});
