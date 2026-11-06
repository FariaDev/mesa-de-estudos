/* Revisão aberta, uma aba ativa só (auditoria de UI/UX, rodada 6, G3): com o
   Caderno aberto, só ele lê como ativo — a aba da matéria não mantém pill e o
   hover de outra aba não pinta o mesmo preenchimento (no claro, hover 241 vs
   pill 230; no escuro, .05 vs .09 — indistinguíveis). Conta as abas com fundo
   resolvido de pill, nos dois temas, com e sem hover na matéria. */
import assert from 'node:assert/strict';
import {
  withArtifacts,launchDesk,newRuntime,seedCourse,writeConfigJson,writeDeskJson,
  resizeWindow,setTheme,statusOnline,freezeMotion,
} from './helpers.mjs';
import {layoutStable} from './waits.mjs';

const TRANSPARENT = new Set(['rgba(0, 0, 0, 0)', 'transparent']);

function tabs(page) {
  return page.evaluate(() => [...document.querySelectorAll('#course-tabs button[role="tab"]')].map((button) => ({
    id: button.dataset.id,
    active: button.classList.contains('active'),
    selected: button.getAttribute('aria-selected'),
    bg: getComputedStyle(button).backgroundColor,
  })));
}

function pilled(list) {
  return list.filter((tab) => !TRANSPARENT.has(tab.bg)).map((tab) => tab.id);
}

await withArtifacts('revisao-aba-unica', async (ctx) => {
  const runtime = ctx.runtime = newRuntime('revisao-aba-unica');
  const calc = seedCourse(runtime, 'calc');
  const fis = seedCourse(runtime, 'fis');
  writeConfigJson(runtime, {
    runtimePath: runtime, vaultPath: runtime,
    courses: [{id: 'calc', name: 'Cálculo I', path: calc}, {id: 'fis', name: 'Física', path: fis}],
    desk: {panels: [{label: 'Enunciado'}, {label: 'Formulário'}]},
  });
  writeDeskJson(runtime, {courseId: 'calc'});
  ctx.app = await launchDesk({runtime});
  const page = await ctx.app.firstWindow();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await statusOnline(page);
  await page.waitForSelector('.pdf-panel .reader-sheet', {timeout: 25000});
  await freezeMotion(page);
  await resizeWindow(ctx.app, page, 1440, 900);
  for (const theme of ['light', 'dark']) {
    await setTheme(page, theme);
    const tag = `${theme} revisão aberta`;
    await page.locator('#course-tabs #review-tab').click();
    await page.waitForSelector('#references.review');
    await layoutStable(page, 'main');
    /* Sem hover: só o Caderno com pill. */
    let list = await tabs(page);
    assert.deepEqual(pilled(list), ['review'], `${tag}: só o Caderno com pill (veio ${JSON.stringify(pilled(list))})`);
    assert.deepEqual(list.filter((tab) => tab.selected === 'true').map((tab) => tab.id), ['review'], `${tag}: aria-selected único no Caderno`);
    /* Com o mouse sobre a matéria: ela não pinta pill igual. */
    await page.locator('#course-tabs [data-id="calc"]').hover();
    list = await tabs(page);
    assert.deepEqual(pilled(list), ['review'], `${tag} com hover na matéria: só o Caderno com pill (veio ${JSON.stringify(pilled(list))})`);
    /* Fechar volta o pill para a matéria, ainda único. */
    await page.mouse.move(1, 1);
    await page.locator('#review-bar .review-close').click();
    await page.waitForSelector('#references:not(.review)');
    await layoutStable(page, 'main');
    list = await tabs(page);
    assert.deepEqual(pilled(list), ['calc'], `${tag} fechada: só a matéria com pill (veio ${JSON.stringify(pilled(list))})`);
  }
  assert.deepEqual(errors, [], 'nenhum erro de página durante o fluxo');
  console.log('REVIEW SINGLE ACTIVE UI PASSED: com a revisão aberta só o Caderno tem pill, nos dois temas, com e sem hover.');
});
