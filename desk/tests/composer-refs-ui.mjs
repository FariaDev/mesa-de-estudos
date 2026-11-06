/* Botão Referências reconhecível (auditoria de UI/UX, rodada 4): o toggle do
   composer levava o glifo de colunas, que em 14px se lia como quadrado com
   "T". Passa ao livro (`book`, do conjunto da Mesa — o código já o chama de
   "o livro"), com rótulo acessível e dica, sem mexer na ordem nem nas
   dimensões da fileira. Compara o SVG com o do conjunto (sem regex) e prende
   ordem e tamanho. */
import assert from 'node:assert/strict';
import path from 'node:path';
import {icon} from '../icons.mjs';
import {withArtifacts,newRuntime,seedCourse,writeConfigJson,writeDeskJson,launchDesk,statusOnline,freezeMotion,resizeWindow,setTheme,tinyPdf} from './helpers.mjs';
import {settle} from './layout-measure.mjs';

const BOOK_SVG = icon('book');

await withArtifacts('composer-refs', async (ctx) => {
  const runtime = ctx.runtime = newRuntime('composer-refs');
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
  await page.waitForSelector('#composer-box .composer-actions #include-refs svg', {timeout: 30000});
  for (const [width, height] of [[1440, 900], [900, 650]]) {
    await resizeWindow(ctx.app, page, width, height);
    await settle(page);
    const tag = `${width}x${height}`;
    const refs = await page.evaluate((book) => {
      const btn = document.querySelector('#composer-box .composer-actions #include-refs');
      const r = btn.getBoundingClientRect();
      const svg = btn.querySelector('svg');
      /* Normaliza pelo parser do navegador (`<path/>` serializa como
         `<path></path>` no DOM, então a string crua nunca casa). */
      const norm = document.createElement('span');
      norm.innerHTML = book;
      return {
        book: !!svg && svg.outerHTML === norm.querySelector('svg').outerHTML,
        aria: btn.getAttribute('aria-label') || '',
        title: btn.getAttribute('title') || '',
        w: r.width, h: r.height,
        orderIds: [...btn.parentElement.children].map((el) => el.id || el.tagName.toLowerCase()),
      };
    }, BOOK_SVG);
    assert.equal(refs.book, true, `${tag}: o toggle usa o livro do conjunto`);
    assert.equal(refs.aria, 'Referências', `${tag}: rótulo acessível (veio "${refs.aria}")`);
    assert.equal(refs.title, 'Incluir PDFs na mensagem', `${tag}: dica (veio "${refs.title}")`);
    assert.ok(Math.abs(refs.w - 28) <= 1 && Math.abs(refs.h - 28) <= 1, `${tag}: 28×28 (veio ${refs.w.toFixed(1)}×${refs.h.toFixed(1)})`);
    assert.deepEqual(refs.orderIds.slice(0, 2), ['attach', 'include-refs'], `${tag}: ordem da fileira (${refs.orderIds.join(', ')})`);
  }
  await setTheme(page, 'light');
  console.log('COMPOSER REFS UI PASSED: livro reconhecível, rótulo, dica, ordem e 28×28.');
});
