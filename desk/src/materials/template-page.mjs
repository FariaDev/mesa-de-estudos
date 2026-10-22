import {autoColumns, columnsLabel, fitNext, fitDone, FIT_START} from './model.mjs';
import {message as uiMsg} from '../i18n.mjs';

/* Material — cabeçalho e rodapé correntes, CSS de página do modelo e a
   medição no DOM (matemática que cabe, colunas do modelo).
   Saiu de template.mjs na #43 fase 2. */

const MIN_MATH_FONT_PT = 9;
const RUNNING_MAX = 160;
const clip = (value) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, RUNNING_MAX);
/* Textos de cabeçalho/rodapé de cada modelo. Na tela entram como linhas no
   fluxo (`.pdf-run`); na impressão o mesmo texto vai para as caixas de margem
   da página nomeada (`modelPageCss`), repetido em todas as folhas. */
function runningTexts(model, {title = '', context = '', options = {}} = {}) {
  const name = clip(title);
  const course = clip(context);
  const owner = course ? `Mesa de Estudos — ${course}` : 'Mesa de Estudos';
  const texts = {headLeft: owner, headRight: name, footLeft: '', footRight: '1'};
  if (model === 'lista') texts.footLeft = clip(options.rodape) || name;
  if (model === 'apostila') texts.headRight = clip(options.capitulo) || name;
  if (model === 'formulario') {
    texts.headLeft = '';
    texts.headRight = '';
    texts.footLeft = owner;
  }
  return texts;
}
/* Literal CSS seguro: aspas e barra escapadas, nada de quebra de linha. */
// eslint-disable-next-line no-control-regex -- tirar caracteres de controle é o propósito
const cssString = (value) => `"${String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
/* Conteúdo das caixas de margem da página nomeada (o estilo — fonte, filete,
   largura — mora no CSS do modelo). Caixa sem conteúdo não é gerada. */
function modelPageCss(model, running) {
  if (!model || model === 'livre') return '';
  const pageNumber = 'counter(page) " / " counter(pages)';
  const boxes = [];
  const put = (box, content) => boxes.push(`@${box}{content:${content}}`);
  if (model === 'lista') {
    put('top-left', cssString(running.headLeft));
    put('top-right', cssString(running.headRight));
    put('bottom-left', cssString(running.footLeft));
    put('bottom-right', pageNumber);
  } else if (model === 'apostila') {
    put('top-left', cssString(running.headLeft));
    put('top-right', cssString(running.headRight));
    put('bottom-center', 'counter(page)');
  } else if (model === 'resumo') {
    put('top-left', cssString(running.headLeft));
    put('top-right', cssString(running.headRight));
    put('bottom-center', pageNumber);
  } else if (model === 'simulado') {
    put('top-left', cssString(running.headLeft));
    put('top-right', cssString(running.headRight));
    put('bottom-right', pageNumber);
  } else if (model === 'formulario') {
    put('bottom-left', cssString(running.footLeft));
    put('bottom-right', 'counter(page)');
  }
  return `@page ${model}{${boxes.join('')}}`;
}
/* Depois das fontes: encolhe fórmula larga até caber, com piso legível
   (`minFontPt`, 9 pt por padrão), registrando TODO ajuste — expressão e fator —
   como diagnóstico. Se ainda estourar (ou a fórmula for mais alta que a
   página), o diagnóstico `error` bloqueia o PDF; o rascunho não é tocado. */
function measureMaterialMath(root, {availableWidthPx, availableHeightPx, minFontPt = MIN_MATH_FONT_PT, useLocalWidth = false} = {}) {
  const adjustments = [];
  const overflows = [];
  const pageWidth = Number(availableWidthPx);
  const height = Number.isFinite(Number(availableHeightPx)) ? Number(availableHeightPx) : Infinity;
  const minFontPx = Number(minFontPt) * (96 / 72);
  const tolerance = 2;
  if (!root || !Number.isFinite(pageWidth) || pageWidth <= 0) return {adjustments, overflows};
  const round = (value) => Math.round(value * 1000) / 1000;
  /* O `.katex` de display é um bloco com conteúdo inline em `nowrap`: a largura
     do rect é a da coluna, mas `scrollWidth` expõe o quanto o conteúdo passa
     dela. É essa largura natural que decide o ajuste. */
  const naturalWidth = (node) => {
    if (node.scrollWidth > 0) return node.scrollWidth;
    return node.getBoundingClientRect().width;
  };
  for (const display of root.querySelectorAll('.math-display')) {
    if (display.dataset.mathError) continue;
    const inner = display.querySelector('.katex');
    const source = display.dataset.tex || '';
    if (!inner) continue;
    /* Dentro de um modelo a fórmula pode estar numa coluna ou numa lista: a
       largura útil é a da própria caixa (margem de numeração incluída). */
    const width = useLocalWidth && display.clientWidth > 0 ? Math.min(pageWidth, display.clientWidth) : pageWidth;
    let measured = naturalWidth(inner);
    if (measured > width + tolerance) {
      const computed = parseFloat(getComputedStyle(inner).fontSize) || 0;
      const targetWidth = width * 0.995;
      const needed = measured > 0 ? targetWidth / measured : 1;
      const floorScale = computed > 0 ? minFontPx / computed : 1;
      const applied = Math.max(Math.min(needed, 1), Math.min(floorScale, 1));
      if (applied < 1 && computed > 0) {
        inner.style.fontSize = `${Math.max(computed * applied, minFontPx)}px`;
        void inner.offsetWidth;
        measured = naturalWidth(inner);
        adjustments.push({
          kind: 'fit', severity: 'warning', code: 'math-scaled',
          message: uiMsg('free.diag.mathScaled', {percent: Math.round(applied * 100)}),
          source, scale: round(applied), needed: round(needed), widthPx: Math.round(measured), availablePx: Math.round(width),
        });
        if (measured > width + tolerance) {
          display.dataset.overflow = '1';
          overflows.push({
            kind: 'overflow', severity: 'error', code: 'math-wide',
            message: uiMsg('free.diag.mathWideMin'),
            source, needed: round(needed), widthPx: Math.round(measured), availablePx: Math.round(width),
          });
        }
      } else if (computed > 0) {
        display.dataset.overflow = '1';
        overflows.push({
          kind: 'overflow', severity: 'error', code: 'math-wide',
          message: uiMsg('free.diag.mathWide'),
          source, needed: round(needed), widthPx: Math.round(measured), availablePx: Math.round(width),
        });
      }
    }
    if (Number.isFinite(height) && height > 0 && display.getBoundingClientRect().height > height + tolerance) {
      display.dataset.overflow = '1';
      overflows.push({
        kind: 'overflow', severity: 'error', code: 'math-tall',
        message: uiMsg('free.diag.mathTall'),
        source,
      });
    }
  }
  return {adjustments, overflows};
}
const MARKER_PX = 28;
function cssLengthPx(host, expression) {
  const probe = document.createElement('div');
  probe.setAttribute('aria-hidden', 'true');
  probe.style.cssText = `position:absolute;visibility:hidden;pointer-events:none;height:0;width:${expression};`;
  host.append(probe);
  const width = probe.getBoundingClientRect().width;
  probe.remove();
  return width;
}
/* Largura natural (sem quebra) de um item: o clone vai para uma caixa
   `max-content` dentro do próprio modelo, então herda fonte e regras. */
function naturalItemWidth(host, item) {
  const probe = document.createElement('div');
  probe.setAttribute('aria-hidden', 'true');
  probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;left:0;top:0;width:max-content;max-width:none;';
  const clone = item.cloneNode(true);
  clone.style.cssText = 'display:block;list-style:none;margin:0;padding:0;';
  probe.append(clone);
  host.append(probe);
  const width = probe.getBoundingClientRect().width;
  probe.remove();
  return width;
}
/* Depois das fontes: decide as colunas do "Auto" pelo item mais largo (a regra
   está em `core/materialmodel.bend`) e, no Formulário com "caber numa folha",
   desce a escala em passos do núcleo até o conteúdo caber numa página.
   Devolve `null` para o Livre. */
function measureMaterialModel(root, {availableHeightPx} = {}) {
  const wrapper = root && root.querySelector ? root.querySelector('.pdf-model') : null;
  if (!wrapper) return null;
  const model = wrapper.dataset.model;
  const result = {model, columns: 1, auto: false, label: '', widestPx: 0, fit: null};
  if (model === 'lista' || model === 'formulario') {
    const choice = wrapper.dataset.colsChoice || 'auto';
    if (choice === 'auto') {
      const selector = model === 'lista' ? 'li li' : '.pdf-cols li';
      let widest = 0;
      for (const item of wrapper.querySelectorAll(selector)) widest = Math.max(widest, naturalItemWidth(wrapper, item));
      const available = wrapper.clientWidth || cssLengthPx(wrapper, 'var(--page-w)');
      const gap = cssLengthPx(wrapper, 'var(--col-gap)');
      result.columns = autoColumns(model, {widestPx: widest + MARKER_PX, availablePx: available, gapPx: gap});
      result.auto = true;
      result.widestPx = Math.round(widest);
      wrapper.dataset.cols = String(result.columns);
    } else {
      result.columns = Number(choice) || 1;
      wrapper.dataset.cols = String(result.columns);
    }
    result.label = columnsLabel(choice, result.columns);
  }
  if (model === 'formulario' && wrapper.dataset.umafolha === '1' && Number.isFinite(Number(availableHeightPx)) && availableHeightPx > 0) {
    const limit = Number(availableHeightPx);
    let percent = FIT_START;
    wrapper.style.setProperty('--fit', '1');
    const tall = () => wrapper.getBoundingClientRect().height > limit + 2;
    while (tall() && !fitDone(percent)) {
      percent = fitNext(percent);
      wrapper.style.setProperty('--fit', String(percent / 100));
    }
    result.fit = {percent, fits: !tall()};
  }
  return result;
}

export {MIN_MATH_FONT_PT,runningTexts,modelPageCss,measureMaterialMath,measureMaterialModel};
