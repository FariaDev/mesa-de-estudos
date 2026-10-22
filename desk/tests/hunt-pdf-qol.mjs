import {reviewShot,screenshotDirectory,resizeWindow} from './helpers.mjs';
// QoL do leitor de PDF, no app de verdade (Electron, runtime sintético e Pi de
// mentira): rodapé em fluxo que não cobre o texto, numeração impressa
// (rótulos do PDF + ajuste pessoal por documento) e PDF solto direto no leitor
// alvo — em matéria e na sessão Livre.
//
// O que este teste distingue:
//   inspeção   — leitura de DOM/geometria sem depender de API nova;
//   simulação  — File sem caminho de SO (`new File([...])`) precisa ser RECUSADO;
//   real       — File nativo (input type=file + setInputFiles) entregue por drop,
//                com o preload resolvendo o caminho (`webUtils`) e o main copiando.
//
// Rodar em desk/: node tests/hunt-pdf-qol.mjs
import fs from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';
import {withArtifacts,launchDesk,newRuntime,seedCourse,writeDeskJson,writeConfigJson,toastWait,menuLocator} from './helpers.mjs';
import {pdfRenderIdle} from './waits.mjs';

const SIZE_SMALL = {width: 900, height: 650};
const SIZE_LARGE = {width: 1400, height: 900};

let failures = 0;
const check = (name, cond, detail = '') => {
  if (!cond) failures += 1;
  console.log(`${cond ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
};

/* ------------------------------------------------------------------ */
/* PDFs sintéticos (sem material de curso; WinAnsi para acento)        */
/* ------------------------------------------------------------------ */

function pdfBytes(objects) {
  let out = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((obj, i) => { offsets.push(out.length); out += `${i + 1} 0 obj\n${obj}\nendobj\n`; });
  const startxref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((off) => `${String(off).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<</Size ${objects.length + 1}/Root 1 0 R>>\nstartxref\n${startxref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

function multiPagePdf(count, line) {
  const objects = [
    '<</Type/Catalog/Pages 2 0 R>>',
    `<</Type/Pages/Kids[${Array.from({length: count}, (_, i) => `${4 + i} 0 R`).join(' ')}]/Count ${count}>>`,
    '<</Type/Font/Subtype/Type1/BaseFont/Helvetica/Encoding/WinAnsiEncoding>>',
  ];
  for (let i = 0; i < count; i += 1) objects.push(`<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Resources<</Font<</F1 3 0 R>>>>/Contents ${4 + count + i} 0 R>>`);
  for (let i = 0; i < count; i += 1) {
    const contents = `BT /F1 16 Tf 72 720 Td (${String(line(i + 1, count)).replace(/([\\()])/g, '\\$1')}) Tj ET`;
    objects.push(`<</Length ${Buffer.byteLength(contents, 'latin1')}>>\nstream\n${contents}\nendstream`);
  }
  return pdfBytes(objects);
}

// 8 páginas com rótulos próprios: 2 de front matter romano (i, ii) e 6
// decimais (1..6) — o caso real de material de curso com capa/sumário.
function labeledPdf() {
  const count = 8;
  const kids = Array.from({length: count}, (_, i) => `${4 + i} 0 R`).join(' ');
  const objects = [
    '<</Type/Catalog/Pages 2 0 R/PageLabels<</Nums[0<</S/r>>2<</S/D>>]>>>>',
    `<</Type/Pages/Kids[${kids}]/Count ${count}>>`,
    '<</Type/Font/Subtype/Type1/BaseFont/Helvetica/Encoding/WinAnsiEncoding>>',
  ];
  for (let i = 0; i < count; i += 1) objects.push(`<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Resources<</Font<</F1 3 0 R>>>>/Contents ${4 + count + i} 0 R>>`);
  for (let i = 0; i < count; i += 1) {
    const contents = `BT /F1 16 Tf 72 720 Td (Rotulo fisico ${i + 1}) Tj ET`;
    objects.push(`<</Length ${Buffer.byteLength(contents, 'latin1')}>>\nstream\n${contents}\nendstream`);
  }
  return pdfBytes(objects);
}

/* ------------------------------------------------------------------ */
/* Ajudantes de página                                                 */
/* ------------------------------------------------------------------ */

const waitPanels = (page, total, pages0) => page.waitForFunction(([n, p0]) => {
  const panels = [...document.querySelectorAll('.pdf-panel')];
  return panels.length === n && panels[0]?.querySelectorAll('.pdf-document > .pdf-page').length === p0;
}, [total, pages0], {timeout: 30000});

const field = (page, index, selector) => menuLocator(page.locator('.pdf-panel').nth(index), selector);

function footerFacts(page, index) {
  return page.evaluate((idx) => {
    const panel = document.querySelectorAll('.pdf-panel')[idx];
    const foot = panel.querySelector('.pdf-foot');
    const box = panel.querySelector('.pdf-viewport');
    const pages = [...panel.querySelectorAll('.pdf-document > .pdf-page')];
    const fr = foot.getBoundingClientRect();
    const br = box.getBoundingClientRect();
    // A página é recortada pelo viewport (overflow:auto): o que interessa é se
    // o pedaço VISÍVEL da página invade a faixa do rodapé.
    const overlap = pages.some((el) => {
      const r = el.getBoundingClientRect();
      const top = Math.max(r.top, br.top);
      const bottom = Math.min(r.bottom, br.bottom);
      return bottom > fr.top + 0.5 && top < fr.bottom - 0.5 && r.right > fr.left && r.left < fr.right;
    });
    const visible = pages.filter((el) => {
      const r = el.getBoundingClientRect();
      return r.bottom > br.top + 1 && r.top < br.bottom - 1;
    });
    return {
      position: getComputedStyle(foot).position,
      footTop: fr.top, footBottom: fr.bottom, footHeight: fr.height, boxBottom: br.bottom,
      overlap, visible: visible.length,
      text: foot.textContent,
      title: foot.querySelector('span')?.getAttribute('title') || '',
      toolsVisible: !!panel.querySelector('.pdf-title .more')?.getBoundingClientRect().height,
      pageInputVisible: !!panel.querySelector('.page-number')?.getBoundingClientRect().height,
      selectVisible: !!panel.querySelector('.pdf-select')?.getBoundingClientRect().height,
    };
  }, index);
}

// O `src/pdf-reader-qol.css` é do root: enquanto o link não estiver no
// `index.html`, o teste injeta a folha para medir o layout e avisa alto.
async function ensureQolCss(page) {
  const linked = await page.evaluate(() => [...document.querySelectorAll('link[rel="stylesheet"]')]
    .some((link) => (link.getAttribute('href') || '').includes('pdf-reader-qol.css')));
  assert.equal(linked, true, 'CSS do leitor está ligado no app');
  return true;
}

function dropProbeInput(page) {
  return page.evaluate(() => {
    let input = document.querySelector('#__qol_drop_input');
    if (!input) {
      input = document.createElement('input');
      input.type = 'file';
      input.id = '__qol_drop_input';
      input.hidden = true;
      document.body.append(input);
    }
    return true;
  });
}

function nativeDrop(page, index, {activate = false} = {}) {
  return page.evaluate(([idx, onlyOver]) => {
    const panel = document.querySelectorAll('.pdf-panel')[idx];
    const input = document.querySelector('#__qol_drop_input');
    const transfer = new DataTransfer();
    transfer.items.add(input.files[0]);
    panel.dispatchEvent(new DragEvent('dragover', {bubbles: true, cancelable: true, dataTransfer: transfer}));
    if (onlyOver) return true;
    panel.dispatchEvent(new DragEvent('drop', {bubbles: true, cancelable: true, dataTransfer: transfer}));
    return true;
  }, [index, activate]);
}

const waitFoot = (page, index, text) => page.waitForFunction(([idx, needle]) => {
  const foot = document.querySelectorAll('.pdf-panel')[idx]?.querySelector('.pdf-foot');
  return !!foot && foot.textContent.includes(needle);
}, [index, text], {timeout: 30000});

const waitPage = (page, index, value) => page.waitForFunction(([idx, page0]) => {
  const input = document.querySelectorAll('.pdf-panel')[idx]?.querySelector('.page-number');
  return !!input && input.value === String(page0);
}, [index, value], {timeout: 15000});

// ------------------------------------------------------------------ //
// Fase A — matéria: rodapé, rótulos/offset e drop nos dois leitores   //
// ------------------------------------------------------------------ //

await withArtifacts('pdf-qol', async (ctx) => {
  const runtime = ctx.runtime = newRuntime('pdf-qol');
  const curso = seedCourse(runtime, 'QoL');
  const principal = path.join(curso, 'Principal - Referencia sintetica com nome longo para conferir a legibilidade do rodape.pdf');
  const apoio = path.join(curso, 'Apoio.pdf');
  const droparUm = path.join(curso, 'Dropar-um.pdf');
  const droparDois = path.join(curso, 'Dropar-dois.pdf');
  const imagem = path.join(curso, 'Nao-e-pdf.png');
  fs.writeFileSync(principal, labeledPdf());
  fs.writeFileSync(apoio, multiPagePdf(4, (n, total) => `Apoio ${n} de ${total}`));
  fs.writeFileSync(droparUm, multiPagePdf(3, (n, total) => `Dropar um ${n} de ${total}`));
  fs.writeFileSync(droparDois, multiPagePdf(2, (n, total) => `Dropar dois ${n} de ${total}`));
  fs.writeFileSync(imagem, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'));
  writeConfigJson(runtime, {
    vaultPath: runtime,
    courses: [{id: 'QoL', name: 'QoL', path: curso}],
    desk: {panels: [{label: 'Principal', prefer: ['Principal']}, {label: 'Apoio', prefer: ['Apoio']}]},
  });
  writeDeskJson(runtime, {courseId: 'QoL', pdfs: [{path: principal, page: 1, zoom: 1}, {path: apoio, page: 1, zoom: 1}], layoutVersion: 1});

  const app = ctx.app = await launchDesk({runtime, env: {LEARNING_VAULT: runtime}});
  const page = await app.firstWindow();
  const pageErrors = [], consoleErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  const settle = () => pdfRenderIdle(page);
  const size = (value) => resizeWindow(app, page, value.width, value.height);

  try {
    await waitPanels(page, 2, 8);
    await page.waitForFunction(() => document.querySelectorAll('.pdf-panel')[1]?.querySelectorAll('.pdf-document > .pdf-page').length === 4, undefined, {timeout: 30000});
    await page.waitForFunction(() => document.querySelectorAll('.pdf-panel .pdf-page[data-rendered] canvas').length >= 2, undefined, {timeout: 45000});
    const linked = await ensureQolCss(page);

    // ---------- rodapé em fluxo (não cobre o texto) nos dois tamanhos ----------
    for (const [tag, dim] of [['900x650', SIZE_SMALL], ['1400x900', SIZE_LARGE]]) {
      await size(dim);
      await settle();
      const facts = await footerFacts(page, 0);
      check(`rodapé ${tag}: em fluxo, fora do viewport`, facts.position === 'static' && facts.footTop >= facts.boxBottom - 1, JSON.stringify({position: facts.position, footTop: facts.footTop, boxBottom: facts.boxBottom}));
      check(`rodapé ${tag}: não sobrepõe nenhuma página`, facts.overlap === false);
      check(`rodapé ${tag}: compacto (<= 22px)`, facts.footHeight <= 22, `${facts.footHeight}px`);
      check(`rodapé ${tag}: controles e seleção continuam visíveis`, facts.toolsVisible && facts.pageInputVisible && facts.selectVisible);
      check(`rodapé ${tag}: página e rótulo impresso`, facts.text.includes('Página 1 de 8 · rótulo i · rolagem contínua · '+path.basename(principal)), facts.text);
      check(`rodapé ${tag}: nome completo no tooltip`, facts.title === facts.text, facts.title);
      const qa=screenshotDirectory('pdf-qol');
      for(const theme of ['light','dark']){
        await page.evaluate(async mode=>{const {applyTheme}=await import('./src/state.mjs');applyTheme(mode);},theme);
        await settle();
        const themed=await footerFacts(page,0);
        check(`rodapé ${tag} ${theme}: sem sobreposição`,!themed.overlap&&themed.footTop>=themed.boxBottom-1);
        await reviewShot(page,qa,`pdf-${tag}-${theme}.png`);
      }
    }

    // ---------- rolagem até o fim e seleção (900x650) ----------
    await size(SIZE_SMALL);
    await settle();
    await page.evaluate(() => { const box = document.querySelector('.pdf-panel .pdf-viewport'); box.scrollTop = box.scrollHeight; });
    await waitFoot(page, 0, 'Página 8 de 8 · rótulo 6');
    await page.waitForFunction(() => !!document.querySelector('.pdf-panel .pdf-page[data-page="8"][data-rendered] canvas'), undefined, {timeout: 30000});
    const bottom = await footerFacts(page, 0);
    check('rolagem até o fim: última página sem sobreposição do rodapé', bottom.overlap === false && bottom.footTop >= bottom.boxBottom - 1, JSON.stringify({footTop: bottom.footTop, boxBottom: bottom.boxBottom}));
    const selection = await page.evaluate(() => {
      const panel = document.querySelector('.pdf-panel');
      const box = panel.querySelector('.pdf-viewport');
      const pageEl = [...panel.querySelectorAll('.pdf-document > .pdf-page')].find((el) => {
        const layer = el.querySelector(':scope > .textLayer');
        return layer && el.offsetTop + el.offsetHeight >= box.scrollTop && el.offsetTop <= box.scrollTop + box.clientHeight;
      });
      if (!pageEl) return null;
      const layer = pageEl.querySelector('.textLayer');
      const range = document.createRange();
      range.selectNodeContents(layer);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      const text = sel.toString();
      sel.removeAllRanges();
      return {text: text.trim(), spans: layer.querySelectorAll('span').length};
    });
    check('seleção a 900x650: textLayer visível continua selecionável', !!selection && selection.text.length > 5 && selection.spans > 0, JSON.stringify(selection));

    // ---------- rótulos impressos: exibir e navegar ----------
    await field(page, 0, '.printed-toggle').click();
    await page.waitForFunction(() => !document.querySelectorAll('.pdf-panel')[0].querySelector('.pdf-printed').hidden);
    check('rótulo: PDF com numeração própria mostra o modo', (await field(page, 0, '.printed-status').textContent()).includes('Numeração do PDF'), await field(page, 0, '.printed-status').textContent());
    await field(page, 0, '.printed-input').fill('II');
    await field(page, 0, '.printed-input').press('Enter');
    await waitPage(page, 0, 2);
    await waitFoot(page, 0, 'rótulo ii');
    check('rótulo: navegação por rótulo (caixa ignorada)', true);
    await field(page, 0, '.printed-input').fill('1');
    await field(page, 0, '.printed-input').press('Enter');
    await waitPage(page, 0, 3);
    await waitFoot(page, 0, 'Página 3 de 8 · rótulo 1');
    check('rótulo: número impresso 1 vira a página FÍSICA 3', true);
    await field(page, 0, '.printed-input').fill('6');
    await field(page, 0, '.printed-input').press('Enter');
    await waitPage(page, 0, 8);
    await waitFoot(page, 0, 'rótulo 6');
    check('rótulo: último número impresso vira a última física', true);
    await field(page, 0, '.printed-input').fill('zz');
    await field(page, 0, '.printed-input').press('Enter');
    await toastWait(page, 'Rótulo não encontrado neste PDF.', {timeout: 8000});
    check('rótulo: rótulo inexistente é recusado sem trocar de página', (await field(page, 0, '.page-number').inputValue()) === '8');
    // A página FÍSICA continua sendo a do campo numérico (citações/refs).
    await field(page, 0, '.page-number').fill('7');
    await field(page, 0, '.page-number').press('Enter');
    await waitPage(page, 0, 7);
    await waitFoot(page, 0, 'Página 7 de 8 · rótulo 5');
    check('campo numérico continua físico (rótulo só acompanha)', true);
    await field(page, 0, '.page-number').fill('1');
    await field(page, 0, '.page-number').press('Enter');
    await waitPage(page, 0, 1);

    // ---------- ajuste pessoal por documento (PDF sem rótulos) ----------
    await field(page, 1, '.printed-toggle').click();
    await page.waitForFunction(() => !document.querySelectorAll('.pdf-panel')[1].querySelector('.pdf-printed').hidden);
    check('offset: PDF sem rótulos começa no automático', (await field(page, 1, '.printed-status').textContent()).includes('Sem ajuste (impressa = física)'), await field(page, 1, '.printed-status').textContent());
    check('offset: automático guardado como null', JSON.stringify(await page.evaluate((p) => window.desk.pdfPageLabelsGet(p), apoio)) === '{"offset":null}');
    await field(page, 1, '.page-number').fill('4');
    await field(page, 1, '.page-number').press('Enter');
    await waitPage(page, 1, 4);
    await field(page, 1, '.printed-offset').fill('-3');
    await field(page, 1, '.printed-offset-save').click();
    await page.waitForFunction((p) => window.desk.pdfPageLabelsGet(p).then((r) => r.offset === -3), apoio, {timeout: 8000});
    await waitFoot(page, 1, 'Página 4 de 4 · rótulo 1');
    check('offset: impressa = física + offset (com sinal)', true);
    await field(page, 1, '.page-number').fill('1');
    await field(page, 1, '.page-number').press('Enter');
    await waitPage(page, 1, 1);
    await waitFoot(page, 1, 'Página 1 de 4 ·'); // sem rótulo: front matter (impressa <= 0)
    check('offset: página física sem número impresso não mostra rótulo', (await footerFacts(page, 1)).text.includes('rótulo') === false);
    await field(page, 1, '.printed-input').fill('1');
    await field(page, 1, '.printed-input').press('Enter');
    await waitPage(page, 1, 4);
    check('offset: navegar pelo número impresso desfaz o deslocamento', true);
    await field(page, 1, '.printed-offset').fill('2000000');
    await field(page, 1, '.printed-offset-save').click();
    check('offset: fora do teto é recusado com aviso', (await field(page, 1, '.printed-status').textContent()).includes('Use um inteiro entre'), await field(page, 1, '.printed-status').textContent());
    check('offset: recusa não grava nada', JSON.stringify(await page.evaluate((p) => window.desk.pdfPageLabelsGet(p), apoio)) === '{"offset":-3}');
    await field(page, 1, '.printed-offset-auto').click();
    await page.waitForFunction((p) => window.desk.pdfPageLabelsGet(p).then((r) => r.offset === null), apoio, {timeout: 8000});
    check('offset: Automático limpa o ajuste', true);

    // ---------- persistência fora do PDF (recarrega o renderer) ----------
    await field(page, 1, '.printed-offset').fill('2');
    await field(page, 1, '.printed-offset-save').click();
    await page.waitForFunction((p) => window.desk.pdfPageLabelsGet(p).then((r) => r.offset === 2), apoio, {timeout: 8000});
    await page.reload();
    await waitPanels(page, 2, 8);
    await waitFoot(page, 0, path.basename(principal));
    await field(page, 1, '.printed-toggle').click();
    await page.waitForFunction(() => document.querySelectorAll('.pdf-panel')[1]?.querySelector('.printed-status')?.textContent.includes('Impressa = física + 2'), undefined, {timeout: 15000});
    check('offset: sobrevive ao reinício do renderer (guardado fora do PDF)', true);

    // ---------- PDF solto: área alvo + arquivo nativo nos dois leitores ----------
    await dropProbeInput(page);
    await page.locator('#__qol_drop_input').setInputFiles(droparUm);
    await nativeDrop(page, 0, {activate: true});
    await page.waitForFunction(() => {
      const panel = document.querySelectorAll('.pdf-panel')[0];
      return panel.classList.contains('pdf-drop-over') && !panel.querySelector('.pdf-drop-hint').hidden;
    }, undefined, {timeout: 5000});
    check('drop: arrasto de PDF acende a área alvo do leitor 1', true);
    await nativeDrop(page, 0);
    await waitFoot(page, 0, 'Dropar-um.pdf');
    await waitPage(page, 0, 1);
    await page.waitForFunction(() => document.querySelectorAll('.pdf-panel')[0].querySelector('.pdf-drop-hint').hidden, undefined, {timeout: 5000});
    check('drop: PDF nativo abre no leitor alvo (1)', true);
    await waitFoot(page, 1, 'Apoio.pdf');
    check('drop: o outro leitor não mudou', (await field(page, 1, '.pdf-select').inputValue()).endsWith('Apoio.pdf'));
    await page.locator('#__qol_drop_input').setInputFiles(droparDois);
    await nativeDrop(page, 1);
    await waitFoot(page, 1, 'Dropar-dois.pdf');
    await waitFoot(page, 0, 'Dropar-um.pdf');
    check('drop: PDF nativo abre no leitor alvo (2)', true);
    // File sem caminho de SO (simulação): o preload recusa e o leitor não muda.
    const refused = await page.evaluate(() => {
      const panel = document.querySelectorAll('.pdf-panel')[0];
      const transfer = new DataTransfer();
      transfer.items.add(new File([new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52])], 'falso.pdf', {type: 'application/pdf'}));
      panel.dispatchEvent(new DragEvent('dragover', {bubbles: true, cancelable: true, dataTransfer: transfer}));
      panel.dispatchEvent(new DragEvent('drop', {bubbles: true, cancelable: true, dataTransfer: transfer}));
      return true;
    });
    check('drop: File sintético (sem caminho) é entregue ao preload', refused === true);
    await toastWait(page, 'Solte um arquivo PDF local neste leitor.', {timeout: 8000});
    await waitFoot(page, 0, 'Dropar-um.pdf');
    check('drop: File sintético é recusado e não troca o documento', true);
    // Arquivo real que não é PDF: a primeira peneira recusa sem chamar o backend.
    await page.locator('#__qol_drop_input').setInputFiles(imagem);
    await nativeDrop(page, 0);
    await toastWait(page, 'Solte um arquivo PDF neste leitor.', {timeout: 8000});
    await waitFoot(page, 0, 'Dropar-um.pdf');
    check('drop: imagem real é recusada sem abrir no leitor', true);

    check('fase matéria: sem pageerror', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));
    check('fase matéria: sem erro no console', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));
    if (!linked) console.log('PENDÊNCIA ROOT: ligar `src/pdf-reader-qol.css` no `index.html` (depois do style.css).');
  } catch (error) {
    check('fase matéria: execução do roteiro', false, error.stack?.split('\n').slice(0, 3).join(' | ') || error.message);
  }
});

// ------------------------------------------------------------------ //
// Fase B — Livre: drop devolve initialData e o outro leitor sobrevive //
// ------------------------------------------------------------------ //

await withArtifacts('pdf-qol-livre', async (ctx) => {
  const runtime = ctx.runtime = newRuntime('pdf-qol-livre');
  const curso = seedCourse(runtime, 'QoL');
  const droparUm = path.join(curso, 'Dropar-um.pdf');
  const droparDois = path.join(curso, 'Dropar-dois.pdf');
  fs.writeFileSync(droparUm, multiPagePdf(3, (n, total) => `Livre um ${n} de ${total}`));
  fs.writeFileSync(droparDois, multiPagePdf(2, (n, total) => `Livre dois ${n} de ${total}`));
  writeConfigJson(runtime, {
    vaultPath: runtime,
    courses: [{id: 'QoL', name: 'QoL', path: curso}],
    desk: {panels: [{label: 'Livre A', prefer: []}, {label: 'Livre B', prefer: []}]},
  });
  writeDeskJson(runtime, {courseId: 'mesa-free', pdfs: [], layoutVersion: 1});

  const app = ctx.app = await launchDesk({runtime, env: {LEARNING_VAULT: runtime}});
  const page = await app.firstWindow();
  const pageErrors = [], consoleErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });

  try {
    await page.waitForFunction(() => document.querySelectorAll('.pdf-panel').length === 2, undefined, {timeout: 30000});
    await page.waitForFunction(() => !!document.querySelector('.pdf-panel .pdf-placeholder'), undefined, {timeout: 15000});
    await ensureQolCss(page);
    check('Livre: os dois leitores nascem vazios', await page.evaluate(() => [...document.querySelectorAll('.pdf-panel .pdf-placeholder')].length === 2));
    await dropProbeInput(page);
    await page.locator('#__qol_drop_input').setInputFiles(droparUm);
    await nativeDrop(page, 1);
    await waitFoot(page, 1, 'Dropar-um');
    const imported = await field(page, 1, '.pdf-select').inputValue();
    check('Livre: drop importa a cópia e abre no leitor alvo (índice 1)', imported.includes(`${path.sep}free${path.sep}`) && /Dropar-um(\.pdf)+$/.test(imported), imported);
    check('Livre: a cópia importada tem os mesmos bytes do arquivo solto', fs.readFileSync(imported).equals(fs.readFileSync(droparUm)), imported);
    check('Livre: o leitor 0 continua vazio', await page.evaluate(() => !!document.querySelectorAll('.pdf-panel')[0].querySelector('.pdf-placeholder')));
    check('Livre: caminho importado aceita a numeração impressa', JSON.stringify(await page.evaluate((p) => window.desk.pdfPageLabelsGet(p), imported)) === '{"offset":null}');
    // Anda até a página 3 e depois dropa OUTRO PDF no leitor 0: o flush do
    // layout antes do drop é o que mantém o leitor 1 na página 3.
    await field(page, 1, '.page-number').fill('3');
    await field(page, 1, '.page-number').press('Enter');
    await waitPage(page, 1, 3);
    await page.locator('#__qol_drop_input').setInputFiles(droparDois);
    await nativeDrop(page, 0);
    await waitFoot(page, 0, 'Dropar-dois');
    await waitFoot(page, 1, 'Dropar-um');
    await waitPage(page, 1, 3);
    check('Livre: o outro leitor mantém arquivo e página no drop', true);
    await field(page, 0, '.printed-toggle').click();
    await field(page, 0, '.printed-offset').fill('-2');
    await field(page, 0, '.printed-offset-save').click();
    await page.waitForFunction((p) => window.desk.pdfPageLabelsGet(p).then((r) => r.offset === -2), await field(page, 0, '.pdf-select').inputValue(), {timeout: 8000});
    check('Livre: ajuste por documento também grava no caminho importado', true);
    check('fase Livre: sem pageerror', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));
    check('fase Livre: sem erro no console', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));
  } catch (error) {
    check('fase Livre: execução do roteiro', false, error.stack?.split('\n').slice(0, 3).join(' | ') || error.message);
  }
});

console.log(`\nHUNT PDF QoL: ${failures} falha(s)`);
if (failures) throw new Error(`hunt-pdf-qol: ${failures} falha(s) (artefatos salvos pelo harness)`);
