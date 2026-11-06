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
    /* A prévia viva prefixa o id do modelo (`pvN-prev-raw`, c94c0264). */
    const raw = doc.querySelector('h2[id$="-prev-raw"]');
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
  assert.match(structure.rawHtml, /^<h2[^>]*id="pv\d+-prev-raw"/i, 'o H1 cru rebaixado preserva atributos (id sob prefixo da prévia)');
  assert.match(structure.rawHtml, /<em>desce<\/em>/, 'o H1 cru rebaixado preserva filhos seguros');
  assert.equal(structure.anchorHref, '', 'href relativo/matemático sai pela faixa Allowlist (c94c0264)');
  assert.equal(/<|katex/i.test(structure.anchorHref), false, 'href não carrega HTML do KaTeX');
  assert.equal(structure.divTitle, '$b$', 'title recebe o texto matemático (P2-3)');
  assert.equal(structure.leak, false, 'nenhum placeholder sobrou na prévia (P2-3)');

  /* A marca da casa poupa o envoltório da faixa Allowlist: o modelo não pode
     forjá-la, em nenhuma caixa (o parser HTML normaliza o nome) nem com o atributo aberto
     num bloco e fechado no seguinte. */
  await page.locator('#free-pdf-content').fill(['data-pdf-house', 'DATA-PDF-HOUSE', 'Data-Pdf-House'].map((mark, index) => `<div ${mark}="1" id="forjado${index}" for="send" data-forjado="1" style="position:fixed;inset:0">forjado ${index}</div>`).join('\n\n') + '\n\n<div a="\n\n<div b=" data-pdf-house="1" id="forjado3" data-forjado="1">forjado 3</div>');
  await page.waitForFunction(() => /forjado 3/.test(document.querySelector('#free-pdf-preview .pdf-doc')?.textContent || ''), undefined, {timeout: 8000});
  const forged = await page.evaluate(() => [...document.querySelectorAll('#free-pdf-preview .pdf-doc div')].filter((node) => /^forjado \d$/.test(node.textContent)).map((node) => node.outerHTML));
  assert.equal(forged.length, 4, 'os quatro blocos forjados aparecem como texto');
  for (const html of forged) assert.doesNotMatch(html, /data-pdf-house|for=|data-forjado|position:|id="forjado/i, `marca forjada não poupa a faixa: ${html}`);

  /* Prova positiva: a marca da casa cobre TODA tag gerada (não só a primeira),
     então a prévia viva preserva `class`/`--ans` e o CSS do modelo continua
     valendo nos cinco modelos — e a marca sorteada não sobra no HTML. */
  const samples = {
    lista: '1. Item um\n2. Item dois\n\n## Gabarito\n\n1. Resposta',
    apostila: '## 1. Capítulo\n\n**Definição 1.1.** Uma ideia.\n\n**Exemplo 01:** outro.',
    resumo: '**Regra.** Some.\n\n## Erros comuns\n\n- Esquecer\n\n## Para revisar\n\n- Revisar',
    simulado: '## Questão 1 (2,0 pontos)\n\nCalcule.\n\n- ( ) a\n- ( ) b',
    formulario: '## Seção\n\n1. Um\n2. Dois',
  };
  const expected = {
    lista: ['.pdf-gabarito'],
    apostila: ['.pdf-def', '.pdf-exemplo'],
    resumo: ['.pdf-regra', '.pdf-duo'],
    simulado: ['.pdf-q', '.pdf-q-head', '.pdf-q-n', '.pdf-q-v'],
    formulario: ['.pdf-cols'],
  };
  for (const [model, markdown] of Object.entries(samples)) {
    await page.locator('#free-pdf-content').fill(markdown);
    await page.locator(`#pdf-model-strip [data-model="${model}"]`).click();
    await page.waitForFunction(([id, selector]) => {
      const doc = document.querySelector('#free-pdf-preview .pdf-doc');
      return !!doc?.querySelector(`.pdf-model[data-model="${id}"]`) && !!doc.querySelector(selector);
    }, [model, expected[model][0]], {timeout: 8000});
    const view = await page.evaluate(([_id, selectors]) => {
      const doc = document.querySelector('#free-pdf-preview .pdf-doc');
      const nodes = selectors.flatMap((selector) => [...doc.querySelectorAll(selector)].map((el) => ({
        selector, className: el.className, classes: [...el.classList],
      })));
      const question = doc.querySelector('.pdf-q');
      const head = doc.querySelector('.pdf-q-head');
      return {
        houseMark: /data-pdf-house/i.test(doc.innerHTML),
        nodes,
        counts: Object.fromEntries(selectors.map((selector) => [selector, doc.querySelectorAll(selector).length])),
        questionClass: question ? question.className : '',
        answerHeight: question ? getComputedStyle(question).getPropertyValue('--ans').trim() : '',
        headDisplay: head ? getComputedStyle(head).display : '',
        model: doc.querySelector('.pdf-model')?.dataset.model || '',
      };
    }, [model, expected[model]]);
    assert.equal(view.model, model);
    assert.equal(view.houseMark, false, `${model}: a marca sorteada não sobra no HTML da prévia`);
    for (const selector of expected[model]) {
      assert.ok(view.counts[selector] > 0, `${model}: ${selector} sumiu da prévia (class da casa prefixada)`);
    }
    for (const node of view.nodes) {
      const wanted = node.selector.slice(1);
      assert.ok(node.classes.includes(wanted), `${model}: ${node.selector} perdeu a classe da casa (${node.className})`);
      assert.equal(node.classes.some((token) => /^pv\d+-/.test(token)), false, `${model}: ${node.selector} foi prefixado pela faixa (${node.className})`);
    }
    if (model === 'simulado') {
      assert.equal(view.headDisplay, 'flex', 'o CSS do simulado vale na prévia (.pdf-q-head em flex)');
      assert.match(view.answerHeight, /^\d+(\.\d+)?mm$/, `--ans da casa preservado (${view.answerHeight})`);
      assert.equal(view.questionClass.split(/\s+/).includes('pdf-q'), true);
    }
  }

  /* O teste de forja é sensível: com a marca FIXA (parâmetro de teste), o mesmo
     ataque passaria — é por isso que o nome é sorteado por carga. */
  const fixedForge = await page.evaluate(async () => {
    const {stripModelAttrs} = await import('./src/model-attrs.mjs');
    return {
      whole: stripModelAttrs('<div data-pdf-house="1" id="forjado" for="send" data-forjado="1" style="position:fixed">forjado</div>', {idPrefix: 'pv9-', keepMark: 'data-pdf-house'}),
      split: stripModelAttrs('<div a="\n\n<div b=" data-pdf-house="1" id="forjado3" data-forjado="1">forjado 3</div>', {keepMark: 'data-pdf-house'}),
    };
  });
  for (const html of [fixedForge.whole, fixedForge.split]) {
    assert.match(html, /data-forjado="1"/, 'com nome fixo a forja sobreviveria (prova de sensibilidade)');
  }
  assert.match(fixedForge.whole, /for="send"/, 'a marca fixa pouparia até o `for` forjado');
  assert.match(fixedForge.whole, /style="position:fixed"/, 'a marca fixa pouparia o `style` forjado');

  /* Volta ao modelo Livre para a prova de fórmula larga (o modelo anterior não
     muda o diagnóstico, mas o PDF real do formulário mede colunas). */
  await page.locator('#pdf-model-strip [data-model="livre"]').click();
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
