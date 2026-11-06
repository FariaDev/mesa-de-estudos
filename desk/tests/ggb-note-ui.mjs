/* Frase explicativa não corta (auditoria de UI/UX, rodada 4, F7): o aviso da
   barra do GeoGebra lia "pela ferram…" em 900. Cobre a classe: todo elemento
   visível com `text-overflow: ellipsis` nas telas principais em 900 mostra o
   texto inteiro ou está na lista de NOMES (arquivo, matéria, modelo, comando,
   expressão, código), que podem cortar — frase não. Os botões da barra do
   GeoGebra medem o mesmo que em 1440. Só medidas do navegador real e CSSOM,
   sem regex de folha. */
import assert from 'node:assert/strict';
import path from 'node:path';
import {withArtifacts,newRuntime,seedCourse,writeConfigJson,writeDeskJson,launchDesk,statusOnline,freezeMotion,resizeWindow,setTheme,tinyPdf} from './helpers.mjs';
import {settle} from './layout-measure.mjs';

/* Nomes (podem cortar com reticências); o resto é frase e mostra inteiro. */
const NAMES = [
  '.pdf-select', '.pdf-select option', '.session-title-text', '.mi-model',
  '#course-menu .nav-trigger > span', '#palette-field .palette-field-text',
  '.goes-pill-name', '.mention-chip-name', '.attachment .file',
  '.queue-item > span', '.queue-label', '.chat-pop button span', '.more-item span',
  '.nav-bookmark .nav-name', '.nav-outline', '.op-name', '.op-url code',
  '.slash-name', '.calc-hist-expr', '.goes-pill-page', '.step-label',
  '.step-link', '.check-row-app', '.check-row-title', '.about-origin-path',
  '.code-lang', '.model-indicator .mi-level',
];

function ellipsisCut(page) {
  return page.evaluate((names) => [...document.querySelectorAll('body *')].flatMap((el) => {
    if (!(el instanceof HTMLElement)) return [];
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return [];
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return [];
    if (el.closest('[hidden]')) return [];
    if (cs.textOverflow !== 'ellipsis') return [];
    if (el.scrollWidth <= el.clientWidth + 1) return [];
    if (el.children.length > 0) return [];
    const named = names.some((sel) => { try { return el.matches(sel); } catch { return false; } });
    const text = (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 50);
    return [{text, named, cls: String(el.className || '').split(/\s+/).filter(Boolean).slice(0, 2).join('.'), id: el.id || ''}];
  }), NAMES);
}

await withArtifacts('ggb-note', async (ctx) => {
  const runtime = ctx.runtime = newRuntime('ggb-note');
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
  await page.locator('#course-tabs [data-id="geogebra"]').click();
  await page.waitForSelector('#ggb-bar:not([hidden])', {timeout: 15000});
  await settle(page);
  const ref = {};
  for (const [width, height] of [[1440, 900], [900, 650]]) {
    await resizeWindow(ctx.app, page, width, height);
    await settle(page);
    const tag = `${width}x${height}`;
    const note = await page.evaluate(() => {
      const el = document.querySelector('#ggb-bar small:not([hidden])');
      const cs = getComputedStyle(el);
      return {text: (el.textContent || '').replace(/\s+/g, ' ').trim(), cut: el.scrollWidth > el.clientWidth + 1, overflow: `${cs.overflow} / ${cs.textOverflow} / ${cs.whiteSpace}`, shot: document.querySelector('#ggb-shot').getBoundingClientRect().toJSON()};
    });
    assert.equal(note.cut, false, `${tag}: aviso do GeoGebra cortado ("${note.text}", ${note.overflow})`);
    if (width === 1440) Object.assign(ref, {shotW: note.shot.width, shotH: note.shot.height});
    else {
      assert.ok(Math.abs(note.shot.width - ref.shotW) <= 1 && Math.abs(note.shot.height - ref.shotH) <= 1,
        `${tag}: botão com ${note.shot.width.toFixed(1)}×${note.shot.height.toFixed(1)}, em 1440 media ${ref.shotW.toFixed(1)}×${ref.shotH.toFixed(1)}`);
    }
    const cuts = (await ellipsisCut(page)).filter((c) => !c.named);
    assert.deepEqual(cuts, [], `${tag}: frases cortadas por reticências: ${JSON.stringify(cuts)}`);
  }
  await setTheme(page, 'light');
  console.log('GGB NOTE UI PASSED: aviso inteiro em 900, botões intactos, sem frase cortada.');
});
