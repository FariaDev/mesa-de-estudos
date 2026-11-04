// @ts-check
'use strict';

/* Texto (e, quando a página é visual, a imagem) de um PDF para o tutor.
   Quem valida o caminho é o resolvedor do tutor (`pdf-read-path.cjs`); aqui
   só se abre o arquivo. O pdf.js entra por `loadPdfjs` (build legacy, sem
   DOM). A imagem, se houver, vem de `renderPage`: no app é uma janela
   escondida com o mesmo pdf.js da janela de PDF, sem poppler. Sem
   `renderPage` (os testes de texto) a página visual segue só com o texto. */

const fs = require('node:fs');
const path = require('node:path');
const {pathToFileURL} = require('node:url');

/* Páginas de texto são baratas; o PNG da página é o que pesa. A faixa para
   antes da quarta página que pediria imagem e o resultado diz onde continuar
   (auditoria A1/M3, 2026-10-30). */
const MAX_PAGES = 10;
const MAX_IMAGE_PAGES = 3;
const MAX_CHARS_PER_PAGE = 12000;
/* 15% da área: um logo de 48×48 pt ocupa 0,5% de uma folha Carta e uma figura
   de 350×300 pt ocupa 21,7%; a medição está no commit da auditoria. */
const FIGURE_AREA_RATIO = 0.15;
const CUT_WORD_MARGIN = 200;
const CACHE_DOCS = 2;
const CACHE_PAGES = 24;
const MAX_IMAGE_CHARS = 1800000;
const FORMULA_PATHS = 100;
const FORMULA_TEXT = 250;
const PATH_OPS = new Set(['constructPath', 'stroke', 'fill', 'eoFill', 'fillStroke', 'eoFillStroke']);
const IDENTITY = [1, 0, 0, 1, 0, 0];

/** O pdf.js do app (build legacy, que roda em Node sem DOM). */
const loadDefaultPdfjs = () => import(pathToFileURL(require.resolve('pdfjs-dist/legacy/build/pdf.mjs')).href);

/**
 * Junta os trechos de uma página em linhas: `hasEOL` é a quebra que o pdf.js viu.
 * @param {Array<{str?: string, hasEOL?: boolean}>} items
 * @returns {string}
 */
function pageText(items) {
  const text = items.map((item) => `${item.str || ''}${item.hasEOL ? '\n' : ''}`).join('');
  return text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Corta o texto da página em `MAX_CHARS_PER_PAGE` tentando terminar numa
 * palavra; devolve também o tamanho original para o aviso ao tutor.
 * @param {string} text
 * @returns {{text: string, truncated: boolean, total: number}}
 */
function cutPageText(text) {
  const total = text.length;
  if (total <= MAX_CHARS_PER_PAGE) return {text, truncated: false, total};
  let cut = text.slice(0, MAX_CHARS_PER_PAGE);
  const at = Math.max(cut.lastIndexOf(' '), cut.lastIndexOf('\n'), cut.lastIndexOf('\t'));
  if (at >= MAX_CHARS_PER_PAGE - CUT_WORD_MARGIN) cut = cut.slice(0, at);
  return {text: cut.trimEnd(), truncated: true, total};
}

/**
 * Intervalo pedido, dentro do PDF e do teto de páginas por chamada.
 * `requestedLast` guarda o `ate` do pedido (mesmo acima do total) para o
 * resultado poder dizer o que foi devolvido.
 * @param {unknown} first @param {unknown} last @param {number} total
 * @returns {{first: number, last: number, requestedLast: number}}
 */
function pageRange(first, last, total) {
  const start = Math.trunc(Number(first));
  if (!Number.isFinite(start) || start < 1 || start > total) throw Error(`Página ${JSON.stringify(first)} fora do PDF; esperado de 1 a ${total}.`);
  const wanted = Math.trunc(Number(last ?? start));
  const requestedLast = Number.isFinite(wanted) && wanted >= start ? wanted : start;
  return {first: start, last: Math.min(requestedLast, total, start + MAX_PAGES - 1), requestedLast};
}

/**
 * scan: sem texto. figure: imagem cobrindo área relevante. formula: muito
 * traço e pouco texto. Logo e tarja pequenos somem na conta e a página fica
 * como texto; o modelo ainda pode pedir `imagem: "sim"` (auditoria M3).
 * @param {string} text @param {number} imageRatio @param {number} paths
 * @returns {'scan'|'figure'|'formula'|'text'}
 */
function kindFromCounts(text, imageRatio, paths) {
  const body = String(text || '').trim();
  if (!body) return 'scan';
  if (imageRatio >= FIGURE_AREA_RATIO) return 'figure';
  if (paths > FORMULA_PATHS && body.length < FORMULA_TEXT) return 'formula';
  return 'text';
}

/** @param {any} pdfjs @returns {Map<number, string>} */
function opsByName(pdfjs) {
  return new Map(Object.entries(pdfjs?.OPS || {}).map(([name, id]) => [id, name]));
}

/**
 * Multiplica duas matrizes afins no formato do `cm` do PDF.
 * @param {number[]} left @param {number[]} right @returns {number[]}
 */
function multiplyMatrix(left, right) {
  return [
    left[0] * right[0] + left[2] * right[1],
    left[1] * right[0] + left[3] * right[1],
    left[0] * right[2] + left[2] * right[3],
    left[1] * right[2] + left[3] * right[3],
    left[0] * right[4] + left[2] * right[5] + left[4],
    left[1] * right[4] + left[3] * right[5] + left[5],
  ];
}

/** Área que a matriz leva do quadrado unitário da imagem para a página. @param {number[]} matrix */
function matrixArea(matrix) {
  return Math.abs(matrix[0] * matrix[3] - matrix[1] * matrix[2]);
}

/**
 * Fração da página coberta por imagens, pelo CTM das operações de pintura.
 * @param {Map<number, string>} byId
 * @param {number[]} fnArray
 * @param {any[]} argsArray
 * @param {number} pageArea
 * @returns {number}
 */
function imageAreaRatio(byId, fnArray, argsArray, pageArea) {
  if (!(pageArea > 0)) return 0;
  let ctm = IDENTITY;
  /** @type {number[][]} */
  const stack = [];
  let area = 0;
  const count = fnArray?.length || 0;
  for (let index = 0; index < count; index += 1) {
    const name = byId.get(fnArray[index]) || '';
    const values = argsArray?.[index];
    switch (name) {
      case 'save': stack.push(ctm); break;
      case 'restore': ctm = stack.pop() || IDENTITY; break;
      case 'transform':
        if (values && typeof values.length === 'number' && values.length >= 6) ctm = multiplyMatrix(ctm, values);
        break;
      case 'paintFormXObjectBegin':
        stack.push(ctm);
        if (values?.[0] && typeof values[0].length === 'number' && values[0].length >= 6) ctm = multiplyMatrix(ctm, values[0]);
        break;
      case 'paintFormXObjectEnd': ctm = stack.pop() || IDENTITY; break;
      case 'paintImageXObject':
      case 'paintInlineImageXObject':
      case 'paintImageMaskXObject':
        area += matrixArea(ctm);
        break;
      case 'paintImageXObjectRepeat': {
        const scaleX = Number(values?.[1]) || 0;
        const scaleY = Number(values?.[2]) || 0;
        const positions = values?.[3];
        const placements = positions && typeof positions.length === 'number' ? positions.length / 2 : 0;
        area += matrixArea(ctm) * Math.abs(scaleX * scaleY) * placements;
        break;
      }
      case 'paintImageMaskXObjectRepeat': {
        const scaleX = Number(values?.[1]) || 0;
        const skewX = Number(values?.[2]) || 0;
        const skewY = Number(values?.[3]) || 0;
        const scaleY = Number(values?.[4]) || 0;
        const positions = values?.[5];
        const placements = positions && typeof positions.length === 'number' ? positions.length / 2 : 0;
        area += matrixArea(ctm) * Math.abs(scaleX * scaleY - skewX * skewY) * placements;
        break;
      }
      case 'paintInlineImageXObjectGroup':
      case 'paintImageMaskXObjectGroup': {
        const entries = values?.[0] && typeof values[0].length === 'number' ? values[0] : [];
        for (const entry of entries) {
          if (entry?.transform && typeof entry.transform.length === 'number' && entry.transform.length >= 6) area += matrixArea(multiplyMatrix(ctm, entry.transform));
        }
        break;
      }
      default: break;
    }
  }
  return area / pageArea;
}

/**
 * @param {any} pdfPage
 * @returns {number}
 */
function pageAreaOf(pdfPage) {
  /* O `view` (MediaBox) está nas mesmas unidades do CTM do operator list; o
     viewport aplicaria `UserUnit` e rotação, que não entram na conta. */
  const view = pdfPage.view;
  if (Array.isArray(view) && view.length === 4) {
    const area = Math.abs((Number(view[2]) - Number(view[0])) * (Number(view[3]) - Number(view[1])));
    if (Number.isFinite(area) && area > 0) return area;
  }
  try {
    const viewport = pdfPage.getViewport?.({scale: 1});
    const area = Number(viewport?.width) * Number(viewport?.height);
    if (Number.isFinite(area) && area > 0) return area;
  } catch {
    /* sem viewport nem view, fica a folha Carta */
  }
  return 612 * 792;
}

/**
 * Classifica a página pelos nomes de `pdfjs.OPS` (os números mudam entre versões).
 * @param {any} pdfjs
 * @param {{fnArray?: number[], argsArray?: any[]}} operatorList
 * @param {string} text
 * @param {number} pageArea
 * @returns {{kind: 'scan'|'figure'|'formula'|'text', imageRatio: number, paths: number}}
 */
function pageStats(pdfjs, operatorList, text, pageArea) {
  const byId = opsByName(pdfjs);
  let paths = 0;
  for (const id of operatorList?.fnArray || []) {
    if (PATH_OPS.has(byId.get(id) || '')) paths += 1;
  }
  const imageRatio = imageAreaRatio(byId, operatorList?.fnArray, operatorList?.argsArray, pageArea);
  return {kind: kindFromCounts(text, imageRatio, paths), imageRatio, paths};
}

/**
 * @param {any} pdfjs
 * @param {{fnArray?: number[], argsArray?: any[]}} operatorList
 * @param {string} text
 * @param {number} pageArea
 * @returns {'scan'|'figure'|'formula'|'text'}
 */
function pageKind(pdfjs, operatorList, text, pageArea) {
  return pageStats(pdfjs, operatorList, text, pageArea).kind;
}

/**
 * @param {any} pdfjs
 * @param {string} file
 * @param {(file: string) => Buffer} readFile
 */
async function openDocument(pdfjs, file, readFile) {
  let bytes;
  try {
    bytes = readFile(file);
  } catch (error) {
    throw Error(`Não abri ${JSON.stringify(file)}: ${error.message}. Esperado: o arquivo ainda estar no disco.`);
  }
  const loading = pdfjs.getDocument({data: new Uint8Array(bytes), isEvalSupported: false, useSystemFonts: false, verbosity: 0});
  try {
    return {loading, doc: await loading.promise};
  } catch (error) {
    await loading.destroy().catch(() => {});
    throw Error(`Não li ${JSON.stringify(path.basename(file))}: ${error.message}. Esperado: um PDF que o leitor da Mesa consiga abrir.`);
  }
}

/**
 * Texto, corte e classificação de uma página. Só a inspeção fica no cache:
 * o PNG é gerado na chamada que pede a imagem.
 * @param {{pdfjs: any, doc: any, number: number}} request
 */
async function inspectPage({pdfjs, doc, number}) {
  const pdfPage = await doc.getPage(number);
  const content = await pdfPage.getTextContent();
  const cut = cutPageText(pageText(content.items));
  const page = {page: number, text: cut.text, kind: 'text', textLength: cut.total, textTruncated: cut.truncated, imageRatio: 0};
  try {
    const stats = pageStats(pdfjs, await pdfPage.getOperatorList(), page.text, pageAreaOf(pdfPage));
    page.kind = stats.kind;
    page.imageRatio = stats.imageRatio;
  } catch {
    /* sem a lista de operadores, texto segue como texto e página muda pede imagem */
    page.kind = page.text ? 'text' : 'scan';
  }
  return page;
}

/**
 * @param {{page: number, text: string, kind: string, image?: string, imageError?: string}} page
 * @param {string} file
 * @param {(request: {file: string, page: number}) => Promise<string>} renderPage
 */
async function attachImage(page, file, renderPage) {
  const copy = {...page};
  try {
    const image = await renderPage({file, page: copy.page});
    if (typeof image !== 'string' || !image) copy.imageError = 'a Mesa não devolveu a imagem';
    else if (image.length > MAX_IMAGE_CHARS) copy.imageError = `imagem com ${image.length} caracteres; o teto é ${MAX_IMAGE_CHARS}`;
    else copy.image = image;
  } catch (error) {
    copy.imageError = String(error?.message || error);
  }
  return copy;
}

/** @param {unknown} imagem */
function imageMode(imagem) {
  return imagem === 'sim' || imagem === 'nao' ? imagem : 'auto';
}

/**
 * `auto` manda imagem de scan, figura grande e fórmula; `sim` força o PNG de
 * cada página; `nao` lê só texto.
 * @param {{kind: string}} page @param {'auto'|'sim'|'nao'} mode @param {boolean} canRender
 */
function wantsImage(page, mode, canRender) {
  if (!canRender || mode === 'nao') return false;
  if (mode === 'sim') return true;
  return page.kind === 'scan' || page.kind === 'figure' || page.kind === 'formula';
}

/**
 * Leitor de páginas com o pdf.js e o render injetados.
 *
 * O mesmo PDF era relido e reparseado a cada `ler_pdf`. O documento fica em
 * memória pela identidade caminho + mtime + tamanho (dois de cada vez, até
 * `CACHE_PAGES` páginas lidas por documento) e as páginas de uma chamada saem
 * juntas. `warm` adianta o texto sem segurar o envio; `count` dá o total ao
 * chip do chat pelo mesmo documento.
 * @param {{loadPdfjs?: () => Promise<any>, readFile?: (file: string) => Buffer, statFile?: (file: string) => {mtimeMs: number, size: number}, renderPage?: ((request: {file: string, page: number}) => Promise<string>) | null}} [deps]
 * @returns {{read: (request: {file: string, first: unknown, last?: unknown, imagem?: unknown}) => Promise<{file: string, total: number, requested: {first: number, last: number}, pages: Array<{page: number, text: string, kind: string, textLength: number, textTruncated: boolean, imageRatio: number, image?: string, imageError?: string}>, next: number|null, imageLimitHit: boolean}>, warm: (request: {file: string, first: unknown, last?: unknown}) => Promise<void>, count: (file: string) => Promise<number>}}
 * @example await createPdfPageReader().read({file: '/c/Apostila.pdf', first: 53})
 */
function createPdfPageReader({loadPdfjs = loadDefaultPdfjs, readFile = (file) => fs.readFileSync(file), statFile = (file) => fs.statSync(file), renderPage = null} = {}) {
  /** @typedef {{key: string, pdfjs: any, doc: any, loading: {destroy?: () => Promise<void>}, pages: Map<number, Promise<any>>, pins: number}} CachedDoc */
  /** @type {Map<string, CachedDoc>} */
  const docs = new Map();
  /** @type {Map<string, Promise<CachedDoc>>} */
  const opening = new Map();

  function cacheKey(file) {
    let name = file;
    try { name = fs.realpathSync(file); } catch { /* o caminho que o chamador passou */ }
    let stat = null;
    try { stat = statFile(file); } catch { /* openDocument diz o erro com o caminho */ }
    return `${name}\0${Number(stat?.mtimeMs)}\0${Number(stat?.size)}`;
  }

  function evict(keep) {
    while (docs.size > CACHE_DOCS) {
      const dropped = [...docs.values()].find((entry) => entry !== keep && entry.pins === 0);
      if (!dropped) return;
      docs.delete(dropped.key);
      Promise.resolve(dropped.loading.destroy?.()).catch(() => {});
    }
  }

  /* O pin sai de `open`, antes de qualquer `evict`: `evict` só derruba documento
     com pins 0. Antes, o pin vinha depois do `await` de `open`, e uma abertura
     concorrente podia derrubar o documento que acabara de chegar (com o cache
     cheio, o `read` seguia com o documento já destruído). `read` e `count`
     soltam o pin no `finally`. */
  function pin(entry) {
    entry.pins += 1;
    return entry;
  }

  /** @param {CachedDoc} entry */
  function unpin(entry) {
    entry.pins -= 1;
  }

  /** Devolve o documento já pinado: quem chama solta com `unpin`. @param {string} file @returns {Promise<CachedDoc>} */
  async function open(file) {
    const key = cacheKey(file);
    const hit = docs.get(key);
    if (hit) {
      docs.delete(key);
      docs.set(key, hit);
      return pin(hit);
    }
    const pending = opening.get(key);
    if (pending) return pin(await pending);
    const job = (async () => {
      const pdfjs = await loadPdfjs();
      const opened = await openDocument(pdfjs, file, readFile);
      /* pins 1 é o pin de quem abriu, posto antes do evict. */
      const entry = {key, pdfjs, doc: opened.doc, loading: opened.loading, pages: new Map(), pins: 1};
      docs.set(key, entry);
      evict(entry);
      return entry;
    })();
    opening.set(key, job);
    try { return await job; } finally { opening.delete(key); }
  }

  /* Falha de página não fica guardada: a próxima chamada tenta de novo. */
  function pageOf(entry, number) {
    const cached = entry.pages.get(number);
    if (cached) return cached;
    const job = inspectPage({pdfjs: entry.pdfjs, doc: entry.doc, number});
    entry.pages.set(number, job);
    job.catch(() => { if (entry.pages.get(number) === job) entry.pages.delete(number); });
    while (entry.pages.size > CACHE_PAGES) entry.pages.delete(entry.pages.keys().next().value);
    return job;
  }

  async function read({file, first, last, imagem}) {
    const entry = await open(file);
    try {
      const total = entry.doc.numPages;
      const range = pageRange(first, last, total);
      const numbers = [];
      for (let number = range.first; number <= range.last; number += 1) numbers.push(number);
      const inspected = await Promise.all(numbers.map((number) => pageOf(entry, number)));
      const mode = imageMode(imagem);
      const canRender = typeof renderPage === 'function';
      const included = [];
      let imageCount = 0;
      let imageLimitHit = false;
      for (const page of inspected) {
        if (wantsImage(page, mode, canRender)) {
          if (imageCount >= MAX_IMAGE_PAGES) {
            imageLimitHit = true;
            break;
          }
          imageCount += 1;
        }
        included.push(page);
      }
      const pages = await Promise.all(included.map((page) => (wantsImage(page, mode, canRender) ? attachImage(page, file, renderPage) : page)));
      const lastPage = pages.length ? pages[pages.length - 1].page : range.first;
      return {file: path.basename(file), total, requested: {first: range.first, last: range.requestedLast}, pages, next: lastPage < total ? lastPage + 1 : null, imageLimitHit};
    } finally {
      unpin(entry);
    }
  }

  /** Adianta o texto das páginas. Falha de arquivo ou de página fica aqui: o foco não quebra. */
  function warm(request) {
    /* Sem PNG: o aquecimento serve ao texto, e a imagem sai na chamada que a pedir. */
    return read({...request, imagem: 'nao'}).then(() => undefined, () => undefined);
  }

  async function count(file) {
    const entry = await open(file);
    try {
      return entry.doc.numPages;
    } finally {
      unpin(entry);
    }
  }

  return {read, warm, count};
}

module.exports = {createPdfPageReader, pageText, cutPageText, pageRange, pageStats, pageKind, kindFromCounts, imageAreaRatio, opsByName, MAX_PAGES, MAX_IMAGE_PAGES, MAX_CHARS_PER_PAGE, FIGURE_AREA_RATIO, MAX_IMAGE_CHARS, FORMULA_PATHS, FORMULA_TEXT};
