/* Fórmula de bloco sem barra vertical (auditoria de UI/UX, rodada 4, F1):
   todo `.katex-display` da conversa (tutor e lateral usam a mesma regra
   `.message .katex-display`) mede `scrollHeight <= clientHeight + 1` em 1440 e
   900, claro e escuro, com fórmulas de altura variada (integral, fração,
   matriz, somatório); a fórmula larga mantém rolagem horizontal
   (`scrollWidth > clientWidth` com `overflow-x: auto`). Só CSSOM e medidas do
   navegador real, sem regex de folha. */
import assert from 'node:assert/strict';
import path from 'node:path';
import {withArtifacts,newRuntime,seedCourse,seedNativeSession,writeConfigJson,writeDeskJson,launchDesk,statusOnline,freezeMotion,resizeWindow,setTheme,tinyPdf} from './helpers.mjs';

const RICH_MATH = [
  'Integral de altura variada:',
  '',
  '$$\\int_0^1 x^2\\,dx = \\frac{1}{3}$$',
  '',
  'Fração alta:',
  '',
  '$$\\frac{\\frac{1}{2} + \\frac{3}{4}}{\\frac{5}{6} - \\frac{7}{8}}$$',
  '',
  'Matriz:',
  '',
  '$$\\begin{matrix} a & b \\\\ c & d \\end{matrix}$$',
  '',
  'Somatório:',
  '',
  '$$\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}$$',
  '',
  'Fórmula larga (força rolagem horizontal):',
  '',
  '$$\\frac{1}{123456789} + \\frac{2}{987654321} + \\frac{3}{123456789} + \\frac{4}{987654321} + \\frac{5}{123456789} + \\frac{6}{987654321} = x$$',
].join('\n');

await withArtifacts('katex-display', async (ctx) => {
  const runtime = ctx.runtime = newRuntime('katex-display');
  const course = seedCourse(runtime, 'calc');
  const pdf = path.join(course, 'Limites.pdf');
  const {writeFileSync} = await import('node:fs');
  writeFileSync(pdf, tinyPdf('Limites e derivadas'));
  writeConfigJson(runtime, {runtimePath: runtime, vaultPath: runtime, courses: [{id: 'calc', name: 'Cálculo I', path: course}]});
  const session = seedNativeSession(runtime, [
    {role: 'user', content: [{type: 'text', text: 'mostre as fórmulas'}]},
    {role: 'assistant', content: [{type: 'text', text: RICH_MATH}]},
  ], {courseId: 'calc'});
  writeDeskJson(runtime, {courseId: 'calc', session, courseStates: {calc: {session, pdfs: [{path: pdf, page: 1}], study: {title: '', xopp: ''}}}});
  ctx.app = await launchDesk({runtime});
  const page = await ctx.app.firstWindow();
  await statusOnline(page);
  await freezeMotion(page);
  await page.waitForSelector('.message.assistant .katex-display', {timeout: 30000});
  for (const [width, height] of [[1440, 900], [900, 650]]) {
    await resizeWindow(ctx.app, page, width, height);
    for (const theme of ['light', 'dark']) {
      await setTheme(page, theme);
      const rows = await page.evaluate(() => [...document.querySelectorAll('.message .katex-display')].map((el) => {
        const cs = getComputedStyle(el);
        return {
          text: (el.textContent || '').slice(0, 40),
          clientH: el.clientHeight,
          scrollH: el.scrollHeight,
          clientW: el.clientWidth,
          scrollW: el.scrollWidth,
          overflowX: cs.overflowX,
          overflowY: cs.overflowY,
        };
      }));
      assert.ok(rows.length >= 5, `${width}x${height} ${theme}: esperava ao menos 5 fórmulas de bloco, mediu ${rows.length}`);
      for (const row of rows) {
        /* Sem barra vertical visível: o eixo Y não rola (`hidden`/`clip` nunca
           mostra barra) e o que fica de fora cabe no arredondamento (2px da
           auditoria), então nada de conteúdo é cortado de verdade. */
        assert.ok(['hidden', 'clip'].includes(row.overflowY), `${width}x${height} ${theme}: "${row.text}" pode abrir barra vertical (overflow-y=${row.overflowY})`);
        assert.ok(row.scrollH - row.clientH <= 2, `${width}x${height} ${theme}: "${row.text}" corta conteúdo na vertical (clientH=${row.clientH}, scrollH=${row.scrollH})`);
        assert.ok(['auto', 'scroll'].includes(row.overflowX), `${width}x${height} ${theme}: "${row.text}" sem rolagem horizontal declarada (overflow-x=${row.overflowX})`);
      }
      const wide = rows[rows.length - 1];
      assert.ok(wide.scrollW > wide.clientW, `${width}x${height} ${theme}: a fórmula larga devia estourar na horizontal (clientW=${wide.clientW}, scrollW=${wide.scrollW})`);
    }
  }
  await setTheme(page, 'light');
  console.log('KATEX DISPLAY UI PASSED: bloco sem barra vertical, larga com rolagem horizontal, 1440 e 900, claro e escuro.');
});
