// UI do diálogo de PDF (Playwright + runtime sintético): diagnóstico de erro de
// sintaxe sem chamar o host, ajuste de fórmula larga relatado pelo host e
// invalidação da prévia real ao editar. Não roda em `npm test` (script de UI).
// Uso: `node tests/material-template-dialog-ui.mjs`.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {launchDesk, enterFree,freeMenuClick} from './helpers.mjs';

const runtime = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-mat-diag-ui-'));
fs.writeFileSync(path.join(runtime, 'config.json'), JSON.stringify({runtimePath: runtime, vaultPath: runtime, courses: []}));
const app = await launchDesk({runtime});
const page = await app.firstWindow();
try {
  await enterFree(page);
  await freeMenuClick(page,'#free-generate-pdf');
  await page.waitForSelector('#free-pdf-dialog[open]');
  await page.locator('#free-pdf-title').fill('Diagnóstico sintético');
  await page.evaluate(() => { window.deskFreeBridge = {freeSaveMaterial: async () => ({saved: false, error: 'gate'})}; });

  /* Erro de sintaxe: prévia marca o erro e não chama o host. */
  await page.locator('#free-pdf-content').fill('Válida $x$ mas inválida $$\\frac{1}{$$ no fim.');
  await page.waitForFunction(() => {
    const node = document.querySelector('#free-pdf-math-status');
    return node && !node.hidden && /erro/.test(node.textContent);
  }, undefined, {timeout: 8000});
  /* O CSS do template é injetado pelo próprio módulo (sem editar o index). */
  const styles = await page.evaluate(() => ({
    link: !!document.querySelector('link[data-material-template]'),
    font: (() => { const p = document.querySelector('#free-pdf-preview .pdf-doc p'); return p ? getComputedStyle(p).fontFamily : ''; })(),
    zoom: (() => { const pageNode = document.querySelector('#free-pdf-preview .pdf-page'); return pageNode ? pageNode.style.zoom : ''; })(),
  }));
  assert.equal(styles.link, true, 'link do template injetado no diálogo');
  assert.match(styles.font, /Georgia|serif/i, 'prévia usa a tipografia do template');
  assert.ok(styles.zoom, 'prévia escalada para a caixa do diálogo');

  const invalidStatus = await page.locator('#free-pdf-math-status').textContent();
  assert.match(invalidStatus, /1 equação com erro/);
  await page.locator('#free-pdf-verify').click();
  await page.waitForFunction(() => {
    const error = document.querySelector('#free-pdf-error');
    return error && !error.hidden && /parse error|Unexpected end/.test(error.textContent);
  });
  assert.equal(await page.evaluate(() => { const pages = document.querySelector('#free-pdf-pages'); return !pages || pages.hidden; }), true, 'erro não desenha páginas');
  assert.equal(await page.locator('#free-pdf-save').isEnabled(), true, 'salvar continua habilitado; o host é o portão final');

  /* P1-1/P2-1/P2-3/residual r6 na prévia real: fórmulas em continuação de
     lista (espaço e tab), H1 cru rebaixado com título único e matemática em
     atributo sem corromper a estrutura. */
  await page.locator('#free-pdf-content').fill('# Outro\n\n- item\n\n    $x+1$ continuação\n\n- item com tab\n\n\t$u+1$ continuação por tab\n\n<h1 id="prev-raw" class="extra">HTML cru <em>desce</em></h1>\n\n[link]($a$)\n\n<div title="$b$">caixa com atributo</div>');
  await page.waitForFunction(() => {
    const doc = document.querySelector('#free-pdf-preview .pdf-doc');
    return doc && doc.querySelectorAll('li .katex').length === 2;
  }, undefined, {timeout: 8000});
  const structure = await page.evaluate(() => {
    const doc = document.querySelector('#free-pdf-preview .pdf-doc');
    const anchor = doc.querySelector('a');
    const raw = doc.querySelector('#prev-raw');
    return {
      h1: doc.querySelectorAll('h1').length,
      rawTag: raw ? raw.tagName : '',
      rawHtml: raw ? raw.outerHTML : '',
      anchorHref: anchor ? (anchor.getAttribute('href') || '') : '',
      divTitle: doc.querySelector('div[title]') ? (doc.querySelector('div[title]').getAttribute('title') || '') : '',
      leak: /MATHPLACEHOLDER|CODEPLACEHOLDER/.test(doc.innerHTML),
    };
  });
  assert.equal(structure.h1, 1, 'título único na prévia com heading de conteúdo rebaixado');
  assert.equal(structure.rawTag, 'H2', 'H1 cru da prévia desce para H2');
  assert.match(structure.rawHtml, /^<h2[^>]*id="prev-raw"/i, 'o H1 cru rebaixado preserva atributos');
  assert.match(structure.rawHtml, /<em>desce<\/em>/, 'o H1 cru rebaixado preserva filhos seguros');
  assert.equal(structure.anchorHref, '$a$', 'href recebe o texto matemático, não o HTML do KaTeX (P2-3)');
  assert.equal(/<|katex/i.test(structure.anchorHref), false, 'href não carrega HTML do KaTeX');
  assert.equal(structure.divTitle, '$b$', 'title recebe o texto matemático (P2-3)');
  assert.equal(structure.leak, false, 'nenhum placeholder sobrou na prévia (P2-3)');

  /* Fórmula larga: o host devolve diagnóstico de ajuste e o diálogo o mostra. */
  await page.locator('#free-pdf-content').fill('Larga:\n\n$$' + Array.from({length: 20}, (_, i) => `x_{${i + 1}}^{2}`).join('+') + '$$');
  await page.waitForFunction(() => {
    const node = document.querySelector('#free-pdf-math-status');
    return node && node.hidden;
  }, undefined, {timeout: 8000});
  await page.locator('#free-pdf-verify').click();
  await page.waitForSelector('#free-pdf-pages canvas', {timeout: 60000});
  await page.waitForFunction(() => {
    const node = document.querySelector('#free-pdf-math-status');
    return node && !node.hidden && /aviso(s)? do material/.test(node.textContent);
  }, undefined, {timeout: 8000});
  /* Editar depois de uma prévia real invalida as páginas desenhadas. */
  await page.locator('#free-pdf-content').fill('Editado depois da prévia real.');
  await page.waitForFunction(() => {
    const pages = document.querySelector('#free-pdf-pages');
    return !pages || pages.hidden;
  }, undefined, {timeout: 8000});
  assert.equal(await page.locator('#free-pdf-dialog').evaluate((dialog) => dialog.open), true);
  console.log('material-template-dialog-ui: PASS — erro visível sem chamar o host, fit diagnosticado pelo host no diálogo e edição invalidando a prévia.');
} finally {
  await app.close();
  fs.rmSync(runtime, {recursive: true, force: true});
}
