import {renderMaterialHtml, measureMaterialMath, measureMaterialModel, MIN_MATH_FONT_PT} from './template.mjs';
import {message as uiMsg} from '../i18n.mjs';

/* Página de impressão do material (aba Livre e matéria). Roda em janela
   escondida, sandbox e sem Node: recebe {token, title, markdown}, renderiza com
   o renderizador PRÓPRIO do template (`template.mjs`) — que tokeniza matemática
   sem a regex do chat e sem passar nada pelo `markdown.mjs` global —, espera as
   fontes, mede as colunas do modelo (Auto) e as fórmulas largas (piso de 9 pt,
   cada ajuste vira diagnóstico) e só então reporta. Overflows reais voltam como bloqueio: o main falha o PDF
   com `OVERFLOW` e o rascunho segue intacto para edição. */

const MAX_CHARS = 262144;
const doc = document.getElementById('doc');

let token = '';
let finished = false;

function report(ok, extra = {}) {
  if (finished) return;
  finished = true;
  try {
    window.materialPrint.done({token, ok, ...extra});
  } catch { /* a página está sendo destruída */ }
}

async function settleFonts(root) {
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  void root.offsetHeight;
  const families = new Set();
  try {
    for (const face of document.fonts) {
      if (face.family) families.add(face.family);
    }
  } catch { /* sem FontFaceSet: segue com o que der */ }
  const loads = [];
  for (const family of families) {
    for (const spec of ['16px', 'italic 16px', 'bold 16px', 'bold italic 16px']) {
      loads.push(Promise.resolve(document.fonts.load(`${spec} "${family}"`)).catch(() => null));
    }
  }
  await Promise.all(loads);
  try { await document.fonts.ready; } catch { /* segue */ }
  await new Promise((resolve) => requestAnimationFrame(resolve));
}

/* Mede a área útil pela própria variável do template (178 mm), para a medição
   no renderizador de tela bater com a impressão. */
function contentSize() {
  const probe = document.createElement('div');
  probe.setAttribute('aria-hidden', 'true');
  probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;width:var(--page-w);height:var(--page-h);';
  (doc.querySelector('.pdf-model') || doc).append(probe);
  const rect = probe.getBoundingClientRect();
  probe.remove();
  return {width: rect.width, height: rect.height};
}

if (window.materialPrint) {
  window.materialPrint.onRender(async (payload) => {
    token = String(payload?.token ?? '');
    finished = false;
    try {
      const markdown = String(payload?.markdown ?? '');
      const title = String(payload?.title ?? '').slice(0, 200);
      if (markdown.length > MAX_CHARS) throw new Error(uiMsg('err.pdf.tooBig'));
      document.title = title || 'Mesa de Estudos';
      const context = String(payload?.context ?? '').slice(0, 200);
      const rendered = renderMaterialHtml({title, markdown, model: payload?.model, options: payload?.options, context});
      /* A folha de página nomeada do modelo (cabeçalho/rodapé correntes) entra
         antes de medir: o `printToPDF` usa o `@page` do próprio documento. */
      const pageStyle = document.getElementById('model-page-style');
      if (pageStyle) pageStyle.textContent = rendered.pageCss;
      if (rendered.model && rendered.model !== 'livre') doc.style.setProperty('page', rendered.model);
      else doc.style.removeProperty('page');
      doc.innerHTML = rendered.html;
      await settleFonts(doc);
      const size = contentSize();
      const modelMeasure = measureMaterialModel(doc, {availableHeightPx: size.height});
      const measured = measureMaterialMath(doc, {
        availableWidthPx: size.width,
        availableHeightPx: size.height,
        minFontPt: MIN_MATH_FONT_PT,
        useLocalWidth: Boolean(modelMeasure),
      });
      if (doc.querySelector('.math-error')) {
        report(false, {message: uiMsg('free.diag.mathSyntax')});
        return;
      }
      /* Os avisos do render (cerca `plot` mal formada, #60) seguem para o relatório do PDF. */
      const diagnostics = [...rendered.diagnostics.filter((entry) => entry.kind === 'figure'), ...measured.adjustments];
      if (modelMeasure && modelMeasure.fit && !modelMeasure.fit.fits) {
        diagnostics.push({
          kind: 'fit', severity: 'warning', code: 'sheet-overflow',
          message: uiMsg('free.diag.sheetOverflow', {percent: modelMeasure.fit.percent}),
        });
      }
      const modelInfo = modelMeasure
        ? {model: modelMeasure.model, options: rendered.options, columns: modelMeasure.columns, columnsAuto: modelMeasure.auto, columnsLabel: modelMeasure.label, fit: modelMeasure.fit}
        : {model: rendered.model || 'livre', options: rendered.options, columns: 1, columnsAuto: false, columnsLabel: '', fit: null};
      window.__materialLastReport = {diagnostics, overflows: measured.overflows, mathCount: rendered.mathCount, ...modelInfo};
      report(true, {diagnostics, overflows: measured.overflows, ...modelInfo});
    } catch (error) {
      doc.textContent = '';
      report(false, {message: String(error?.message || error)});
    }
  });
}

window.addEventListener('error', (event) => report(false, {message: String(event.message || uiMsg('free.diag.pdfRenderFail'))}));
window.addEventListener('unhandledrejection', (event) => report(false, {message: String(event.reason?.message || event.reason || uiMsg('free.diag.pdfRenderFail'))}));
