/* Template de material da Mesa (aba Livre e matéria): título único, estrutura
   Markdown lida por tokens (nada de regex de heading em código-fonte), matemática
   tokenizada fora de escapes/código inline/cercado/indentado (inclusive dentro
   de citação e item de lista, por árvore de tokens) e renderização própria que
   reutiliza marked/DOMPurify/KaTeX/highlight offline. O chat
   (`markdown.mjs`) NÃO passa por aqui e não muda por causa deste módulo.

   Este arquivo é importável em Node puro para os testes de tokenização, títulos
   e matemática. As funções marcadas como DOM só funcionam no renderer/Electron.

   Contrato de diagnóstico (usado pelo host e pela prévia): lista de objetos
   JSON-serializáveis `{kind, severity, code, message, source?, index?, line?,
   scale?, needed?, widthPx?, availablePx?}`. `severity:'error'` BLOQUEIA o PDF;
   `warning`/`info` apenas informam. */

import {marked} from '../../node_modules/marked/lib/marked.esm.js';
import katex from '../../node_modules/katex/dist/katex.mjs';
import DOMPurify from '../../node_modules/dompurify/dist/purify.es.mjs';
import {highlightCode} from '../../highlight.mjs';
import {modelId as normalizeModelId, normalizeOptions, modelSignature} from './model.mjs';
import {structureMaterialTokens, numberEquations} from './structure.mjs';
import {message as uiMsg} from '../i18n.mjs';
import {blockChildren,fillerGap,lineOf,locateRaw,normalizeCompare,normalizeLineEndings,protectedScan} from './template-protect.mjs';
import {modelPageCss,runningTexts} from './template-page.mjs';
import {segmentMaterial} from './template-tokens.mjs';
import {plotFigure} from '../figures/plot-figure.mjs';
import {svgSafeConfig} from '../figures/svg-guard.mjs';
export {tokenizeMaterial} from './template-tokens.mjs';
export {MIN_MATH_FONT_PT, runningTexts, modelPageCss, measureMaterialMath, measureMaterialModel} from './template-page.mjs';

export const MATERIAL_TEMPLATE_VERSION = 'material-2026-10-20.1';

/* Marca o renderizador de material. A prévia real usa a revisão (título +
   conteúdo + template) para descartar bytes antigos; mudanças de CSS/HTML que
   alterem a saída DEVEM subir a versão para invalidar prévias anteriores. */
export function materialTemplateHash() {
  return MATERIAL_TEMPLATE_VERSION;
}

/* Chave de revisão da prévia (leve e síncrona no renderer) — não é hash
   criptográfico: serve só para invalidar resultado assíncrono antigo. */
export function materialRevision({title = '', markdown = '', model = '', options = null, context = ''} = {}) {
  const input = `${MATERIAL_TEMPLATE_VERSION}\u0000${String(title)}\u0000${String(markdown)}\u0000${modelSignature(model, options)}\u0000${String(context ?? '').trim()}`;
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `${MATERIAL_TEMPLATE_VERSION}:${input.length}:${(hash >>> 0).toString(16)}`;
}

/* ---------- títulos por estrutura Markdown ---------- */

/* O título do campo vira o único H1. Se o primeiro bloco do Markdown for um
   heading com o mesmo texto, ele sai; os demais headings descem um nível
   (h1→h2, …, h6 continua h6) para o outline começar no título. A decisão usa
   os tokens do marked (ATX e setext), nunca regex no texto do código-fonte; a
   reescrita desce em citação/lista e edita a fonte pelos offsets localizados,
   preservando os prefixos de contêiner.

   Limite conhecido: um heading que a árvore não consiga localizar mantém a
   fonte inteira e emite `heading-rewrite-skipped` (mesmo contrato de antes). */
export function prepareMaterialMarkdown({title = '', markdown = ''} = {}) {
  const source = normalizeLineEndings(markdown);
  const plainTitle = String(title ?? '').trim();
  const diagnostics = [];
  if (!plainTitle || !source.trim()) return {markdown: source, diagnostics};
  const tokens = marked.lexer(source);
  if (tokens.map((token) => token.raw).join('') !== source) {
    diagnostics.push({
      kind: 'headings', severity: 'warning', code: 'heading-rewrite-skipped',
      message: uiMsg('free.diag.structureTitles'),
    });
    return {markdown: source, diagnostics};
  }
  const firstContent = tokens.find((token) => token.type !== 'space' && String(token.raw || '').trim() !== '');
  const dedupe = firstContent && firstContent.type === 'heading' && normalizeCompare(firstContent.text) === normalizeCompare(plainTitle);
  const edits = [];
  let shifted = 0;
  let failed = false;
  const visit = (token, start, end) => {
    if (token.type === 'heading') {
      if (dedupe && token === firstContent) {
        edits.push({start, end, replace: ''});
        return;
      }
      const depth = Math.min(Number(token.depth) + 1, 6);
      shifted += 1;
      /* Preserva o recuo da fonte (tab inclusive): o raw do marked expande
         tabs para espaços e pode não representar a largura do contêiner. */
      const lead = /^[ \t]*/.exec(source.slice(start))[0];
      edits.push({
        start,
        end,
        replace: `${lead}${'#'.repeat(depth)} ${token.text}${/\n$/.test(token.raw) ? '\n' : ''}`,
      });
      return;
    }
    const children = blockChildren(token);
    if (children.length === 0) return;
    let cursor = start;
    for (let index = 0; index < children.length; index += 1) {
      const child = children[index];
      const found = locateRaw(source, child.raw, cursor, end);
      if (!found || (index > 0 && !fillerGap.test(source.slice(cursor, found[0])))) { failed = true; return; }
      visit(child, found[0], found[1]);
      if (failed) return;
      cursor = found[1];
    }
    if (!fillerGap.test(source.slice(cursor, end))) failed = true;
  };
  let cursor = 0;
  for (const token of tokens) {
    visit(token, cursor, cursor + token.raw.length);
    cursor += token.raw.length;
    if (failed) break;
  }
  if (failed) {
    diagnostics.push({
      kind: 'headings', severity: 'warning', code: 'heading-rewrite-skipped',
      message: uiMsg('free.diag.structureTitles'),
    });
    return {markdown: source, diagnostics};
  }
  const rebuilt = applyEdits(source, edits);
  if (dedupe) {
    diagnostics.push({
      kind: 'title', severity: 'info', code: 'title-deduped',
      message: uiMsg('free.diag.repeatedHeading'),
    });
  }
  if (shifted > 0) {
    diagnostics.push({
      kind: 'headings', severity: 'info', code: 'headings-shifted',
      message: uiMsg('free.diag.headingsShifted', {count: shifted}),
    });
  }
  return {markdown: rebuilt, diagnostics};
}

/* Aplica as edições de heading em ordem crescente de offset, sem sobrepor. */
function applyEdits(text, edits) {
  const ordered = [...edits].sort((left, right) => left.start - right.start);
  let out = '';
  let cursor = 0;
  for (const edit of ordered) {
    if (edit.start < cursor) continue;
    out += text.slice(cursor, edit.start) + edit.replace;
    cursor = edit.end;
  }
  return out + text.slice(cursor);
}

/* ---------- matemática: erro × aviso ---------- */

function evaluateMath(tex, display, onWarning) {
  return katex.renderToString(tex, {
    displayMode: !!display,
    throwOnError: true,
    trust: false,
    strict: (code, message, token) => {
      if (typeof onWarning === 'function') {
        onWarning({
          code: String(code || 'katex-warning'),
          message: String(message || 'aviso do KaTeX'),
          token: token && typeof token === 'object' ? String(token.text || '') : '',
        });
      }
      /* 'ignore' mantém o aviso sem poluir o console; erros de parsing ainda
         lançam por causa de throwOnError. Unicode válido não bloqueia. */
      return 'ignore';
    },
  });
}

/* Aviso único do fallback heurístico de proteção de código: usado pelo
   `checkMaterialMath` (validação/salvar) e pelo `renderMaterialHtml` (render). */
function codeProtectionDiagnostic(fallback) {
  if (!fallback) return null;
  return {
    kind: 'code-guard', severity: 'warning', code: 'code-protection-fallback',
    message: uiMsg('free.diag.structureCode'),
  };
}

/* Valida a matemática tokenizada. Erros de parsing/comando lançam no KaTeX e
   são `severity:'error'` (bloqueiam o PDF); avisos de estilo (`strict`) são
   `severity:'warning'` e não bloqueiam. Código/cifrão escapado/dinheiro nem
   chegam aqui (o tokenizador os deixa como texto). */
export function checkMaterialMath(markdown) {
  const text = normalizeLineEndings(markdown);
  const protection = protectedScan(text);
  const segments = segmentMaterial(text, protection.ranges);
  const diagnostics = [];
  const errors = [];
  const warnings = [];
  const guard = codeProtectionDiagnostic(protection.fallback);
  if (guard) diagnostics.push(guard);
  for (const segment of segments) {
    if (segment.type !== 'math') continue;
    const line = lineOf(text, segment.start);
    const warned = [];
    try {
      evaluateMath(segment.tex, segment.display, (warning) => warned.push(warning));
    } catch (error) {
      const record = {
        kind: 'math', severity: 'error', code: 'math-parse',
        message: String(error?.message || error),
        source: segment.display ? `$$${segment.tex}$$` : `$${segment.tex}$`,
        index: segment.start, line,
      };
      errors.push(record);
      diagnostics.push(record);
      continue;
    }
    for (const warning of warned) {
      const record = {
        kind: 'math-warning', severity: 'warning', code: warning.code,
        message: warning.message,
        source: segment.display ? `$$${segment.tex}$$` : `$${segment.tex}$`,
        index: segment.start, line,
      };
      warnings.push(record);
      diagnostics.push(record);
    }
  }
  return {errors, warnings, diagnostics, segments};
}

/* ---------- renderização HTML (DOM/renderer) ---------- */

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const attr = (value) => escapeHtml(value);

const ASSET_EXT = /\.(?:png|jpe?g|gif|webp|svg)$/i;
const ASSET_LOCAL = /^(?:file:\/\/|\.{0,2}[\\/]|[\\/]|desk[\\/]|[a-zA-Z]:[\\/])/i;
const ASSET_MARKDOWN = /!\[([^\]]*)\]\(\s*(?:<([^<>]+)>|((?:file:\/\/|\.{0,2}[\\/]|[\\/]|desk[\\/]|[a-zA-Z]:[\\/])[^)]*?\.(?:png|jpe?g|gif|webp|svg))(?:\s+"[^"]*")?)\s*\)/gi;

const assetSource = (value) => {
  const text = String(value || '').trim();
  return ASSET_LOCAL.test(text) && ASSET_EXT.test(text.split(/[?#]/)[0]);
};

function unescapeHtml(value) {
  return String(value).replace(/&(amp|lt|gt|quot|apos|#39|#x27);/g, (_match, entity) => ({
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'", '#x27': "'",
  }[entity]));
}

function renderMathSegment(segment) {
  const source = segment.display ? `$$${segment.tex}$$` : `$${segment.tex}$`;
  try {
    const html = evaluateMath(segment.tex, segment.display);
    if (segment.display) return `<div class="math-display" data-tex="${attr(source)}">${html}</div>`;
    return `<span class="math-inline" data-tex="${attr(source)}">${html}</span>`;
  } catch (error) {
    const message = attr(error?.message || error);
    if (segment.display) {
      return `<div class="math-display math-error" data-tex="${attr(source)}" data-math-error="1" title="${message}"><span class="katex-error">${escapeHtml(source)}</span></div>`;
    }
    return `<span class="math-inline math-error" data-tex="${attr(source)}" data-math-error="1" title="${message}"><span class="katex-error">${escapeHtml(source)}</span></span>`;
  }
}

/* Constrói um fragmento a partir do HTML já gerado do KaTeX (injetado depois
   do DOMPurify, como antes). */
function mathFragment(markup) {
  const template = document.createElement('template');
  template.innerHTML = markup;
  return template.content;
}

/* Troca os placeholders de matemática pelo HTML do KaTeX sem tocar em
   atributos: primeiro o parágrafo inteiro de uma fórmula de display, depois os
   nós de texto; placeholder que sobrar em atributo (href de link, title…) vira
   o texto matemático cru, nunca o HTML do KaTeX — a estrutura do elemento fica
   de pé. Sem DOM (fora do renderer) mantém a troca em string antiga para a
   importação continuar funcionando. */
function materialMathNodes(html, placeholders) {
  if (placeholders.size === 0) return html;
  const sourceOf = (segment) => (segment.display ? `$$${segment.tex}$$` : `$${segment.tex}$`);
  if (typeof document === 'undefined') {
    let fallback = html;
    for (const [key, segment] of placeholders) fallback = fallback.replace(new RegExp(key, 'g'), () => renderMathSegment(segment));
    return fallback;
  }
  const container = document.createElement('div');
  container.innerHTML = html;
  const keys = [...placeholders.keys()];
  for (const paragraph of [...container.querySelectorAll('p')]) {
    const key = paragraph.textContent.trim();
    const segment = placeholders.get(key);
    if (!segment || !segment.display) continue;
    paragraph.replaceWith(mathFragment(renderMathSegment(segment)));
  }
  const walker = document.createTreeWalker(container, 4 /* NodeFilter.SHOW_TEXT */);
  const textNodes = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode);
  for (const node of textNodes) {
    const value = node.data;
    if (!keys.some((key) => value.includes(key))) continue;
    const fragment = document.createDocumentFragment();
    let at = 0;
    while (at < value.length) {
      let keyAt = -1;
      let key = '';
      for (const candidate of keys) {
        const found = value.indexOf(candidate, at);
        if (found !== -1 && (keyAt === -1 || found < keyAt || (found === keyAt && candidate.length > key.length))) {
          keyAt = found;
          key = candidate;
        }
      }
      if (keyAt === -1) {
        fragment.append(document.createTextNode(value.slice(at)));
        break;
      }
      if (keyAt > at) fragment.append(document.createTextNode(value.slice(at, keyAt)));
      fragment.append(mathFragment(renderMathSegment(placeholders.get(key))));
      at = keyAt + key.length;
    }
    node.replaceWith(fragment);
  }
  for (const element of container.querySelectorAll('*')) {
    for (const attribute of [...element.attributes]) {
      let value = attribute.value;
      let changed = false;
      for (const key of keys) {
        if (!value.includes(key)) continue;
        value = value.split(key).join(sourceOf(placeholders.get(key)));
        changed = true;
      }
      if (changed) element.setAttribute(attribute.name, value);
    }
  }
  return container.innerHTML;
}

/* O título do campo é o único H1 do documento. Os headings Markdown já descem
   um nível em `prepareMaterialMarkdown`; o HTML cru não passa por lá, então
   rebaixa os `<h1>` que sobraram para `<h2>` depois do DOMPurify e antes do
   título confiável ser anexado. Atributos e filhos seguros são preservados. */
function demoteContentHeadings(html) {
  if (!/<h1[\s>/]/i.test(html)) return html;
  if (typeof document === 'undefined') return html;
  const container = document.createElement('div');
  container.innerHTML = html;
  for (const heading of [...container.querySelectorAll('h1')]) {
    const replacement = document.createElement('h2');
    for (const attribute of [...heading.attributes]) replacement.setAttribute(attribute.name, attribute.value);
    while (heading.firstChild) replacement.appendChild(heading.firstChild);
    heading.replaceWith(replacement);
  }
  return container.innerHTML;
}

/* Renderiza o material completo: `prepareMaterialMarkdown` (título único) →
   tokenização própria → marked → DOMPurify (H1 cru rebaixado a H2) → realce de
   código pelo highlight local → KaTeX injetado fora do DOMPurify. Nenhum texto
   cru passa pela regex do chat (`markup`) nem toca o `markdown.mjs` global.

   `allowAssets=false` (o padrão do material): figura vira código e tags de
   mídia são removidas — nada é buscado na rede nem embutido no PDF. */
export function renderMaterialHtml({title = '', markdown = '', allowAssets = false, model = '', options = null, context = ''} = {}) {
  const plainTitle = String(title ?? '').trim();
  const modelName = normalizeModelId(model);
  const modelOptions = normalizeOptions(modelName, options);
  const prepared = prepareMaterialMarkdown({title: plainTitle, markdown});
  const protection = protectedScan(prepared.markdown);
  const segments = segmentMaterial(prepared.markdown, protection.ranges);
  const diagnostics = [...prepared.diagnostics];
  const guard = codeProtectionDiagnostic(protection.fallback);
  if (guard) diagnostics.push(guard);
  const prefix = prepared.markdown.includes('MATHPLACEHOLDER') ? 'MATHPH' + 'X' : 'MATHPLACEHOLDER';
  const placeholders = new Map();
  let protectedText = '';
  let mathIndex = 0;
  for (const segment of segments) {
    if (segment.type === 'text') {
      protectedText += segment.value;
      continue;
    }
    const key = `${prefix}${mathIndex}END`;
    placeholders.set(key, segment);
    protectedText += key;
    mathIndex += 1;
  }
  let body = allowAssets ? protectedText : protectedText.replace(ASSET_MARKDOWN, (match, _alt, bracketed, plain) => {
    const source = String(bracketed ?? plain ?? '').trim();
    return assetSource(source) ? `\`${source}\`` : match;
  });
  let html;
  if (modelName === 'livre') {
    html = marked.parse(body, {breaks: true});
  } else {
    /* `lexer`/`parser` não mesclam os padrões como `parse` faz: sem eles o gfm
       some e a tabela vira parágrafo. */
    const markedOptions = {...marked.defaults, breaks: true};
    const tokens = marked.lexer(body, markedOptions);
    html = marked.parser(structureMaterialTokens(tokens, modelName, modelOptions), markedOptions);
  }
  const codes = [];
  html = html.replace(/<pre><code(?: class="language-([\w-]+)")?>([\s\S]*?)<\/code><\/pre>/g, (_all, lang, code) => {
    /* Cerca `plot` (#60): a figura entra no HTML e passa pelo DOMPurify (a guarda de SVG do chat); cerca mal formada vira aviso no PDF e diagnóstico, nunca some. */
    if (lang === 'plot') {
      const figure = plotFigure(unescapeHtml(code));
      if (figure.diagnostic) diagnostics.push(figure.diagnostic);
      return figure.html;
    }
    codes.push(`<pre class="hl"><code data-lang="${attr(lang || '')}">${highlightCode(unescapeHtml(code), lang)}</code></pre>`);
    return `CODEPLACEHOLDER${codes.length - 1}END`;
  });
  html = DOMPurify.sanitize(html, svgSafeConfig(DOMPurify, {
    FORBID_TAGS: ['style', 'iframe', 'form', 'input', 'button', 'img', 'picture', 'figure', 'video', 'audio', 'source', 'object', 'embed'],
    FORBID_ATTR: ['srcset', 'ping'],
  }));
  html = demoteContentHeadings(html);
  html = html.replace(/CODEPLACEHOLDER(\d+)END/g, (_match, number) => codes[Number(number)] || '');
  html = materialMathNodes(html, placeholders);
  const titleHtml = plainTitle ? `<h1 class="pdf-title" data-material-title="1">${escapeHtml(plainTitle)}</h1>` : '';
  if (modelName === 'livre') {
    return {
      html: titleHtml + html,
      diagnostics,
      templateVersion: MATERIAL_TEMPLATE_VERSION,
      mathCount: mathIndex,
      model: modelName,
      options: modelOptions,
      pageCss: '',
    };
  }
  if (modelName === 'apostila' && modelOptions.equacoes) html = numberEquations(html);
  const running = runningTexts(modelName, {title: plainTitle, context, options: modelOptions});
  const flags = Object.entries(modelOptions)
    .filter(([, value]) => typeof value === 'boolean')
    .map(([key, value]) => ` data-${key}="${value ? 1 : 0}"`)
    .join('');
  const columns = modelOptions.colunas ? ` data-cols="${attr(modelOptions.colunas)}" data-cols-choice="${attr(modelOptions.colunas)}"` : '';
  const wrapped = `<div class="pdf-model" data-model="${modelName}"${columns}${flags}>`
    + `<div class="pdf-run pdf-run-head" aria-hidden="true"><span class="pdf-run-l">${escapeHtml(running.headLeft)}</span><span class="pdf-run-r">${escapeHtml(running.headRight)}</span></div>`
    + titleHtml + html
    + `<div class="pdf-run pdf-run-foot" aria-hidden="true"><span class="pdf-run-l">${escapeHtml(running.footLeft)}</span><span class="pdf-run-r">${escapeHtml(running.footRight)}</span></div>`
    + '</div>';
  return {
    html: wrapped,
    diagnostics,
    templateVersion: MATERIAL_TEMPLATE_VERSION,
    mathCount: mathIndex,
    model: modelName,
    options: modelOptions,
    pageCss: modelPageCss(modelName, running),
  };
}

