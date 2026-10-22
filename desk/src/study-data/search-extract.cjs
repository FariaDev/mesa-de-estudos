'use strict';

const fs = require('node:fs');
const path = require('node:path');
const notesStore = require('./annotations.cjs');
const {pathToFileURL} = require('node:url');
const {message} = require('../i18n.mjs');
const {MAX_DOCS, MAX_DOC_CHARS, MAX_PDF_PAGES, MAX_TITLE_CHARS, materialKey, plain, readJson, readText, reviewKey, text, whole} = require('./search-text.cjs');
const {chatFields, docsFromMessages, parsePiLine, stripContextEnvelope} = require('./search-sources.cjs');

/* Busca de estudos — extração de documentos por fonte (fala user/assistant,
 * itens do Caderno, Livre, materiais, notas e texto de PDF).
 * Saiu de search.cjs na #43 fase 2; a política continua no núcleo
 * (`core/studysearch.bend`). */

function clip(value) {
  return String(value ?? '').slice(0, MAX_DOC_CHARS);
}
function firstUserTitle(docs) {
  for (const doc of docs) {
    if (doc.role === 'user' && doc.text.trim()) return doc.text.replace(/\s+/g, ' ').trim().slice(0, MAX_TITLE_CHARS);
  }
  return '';
}
function extractPi(candidate) {
  const raw = readText(candidate.file);
  if (raw === null) throw new Error(message('search.error.unreadable'));
  const docs = [];
  let partial = false;
  const lines = raw.split('\n');
  if (lines.length > 20000) partial = true;
  for (let index = 0; index < lines.length && index < 20000; index++) {
    const message = parsePiLine(lines[index]);
    if (!message) continue;
    if (docs.length >= MAX_DOCS) {
      partial = true;
      break;
    }
    if (message.text.length > MAX_DOC_CHARS) partial = true;
    docs.push({i: docs.length, role: message.role, text: clip(message.text), when: message.when || candidate.when || 0});
  }
  return {title: candidate.chat?.title || candidate.title || firstUserTitle(docs), docs, partial, ...chatFields(candidate)};
}
function extractMessages(candidate) {
  const {docs, partial} = docsFromMessages(candidate.messages || [], candidate.when || 0);
  return {title: candidate.chat?.title || candidate.title || firstUserTitle(docs), docs, partial, ...chatFields(candidate)};
}
function extractSidechat(candidate) {
  if (candidate.messages) {
    const {docs, partial} = docsFromMessages(candidate.messages, candidate.when);
    return {title: candidate.title || firstUserTitle(docs), docs, partial};
  }
  const docs = [];
  let partial = false;
  const raw = readText(candidate.fallbackFile);
  if (raw !== null) {
    const lines = raw.split('\n');
    if (lines.length > 20000) partial = true;
    for (let index = 0; index < lines.length && index < 20000; index++) {
      const message = parsePiLine(lines[index]);
      if (!message) continue;
      if (docs.length >= MAX_DOCS) {
        partial = true;
        break;
      }
      if (message.text.length > MAX_DOC_CHARS) partial = true;
      docs.push({i: docs.length, role: message.role, text: clip(message.role === 'user' ? stripContextEnvelope(message.text) : message.text), when: message.when || candidate.when || 0});
    }
  }
  return {title: candidate.title || firstUserTitle(docs), docs, partial};
}
function extractReview(candidate) {
  const store = readJson(candidate.file);
  const docs = [];
  let partial = false;
  if (store) {
    for (const [courseId, items] of Object.entries(store)) {
      if (!Array.isArray(items)) continue;
      for (const item of items) {
        if (!plain(item)) continue;
        const question = text(item.question, 400);
        const attempt = text(item.attempt, 400);
        const difficulty = text(item.difficulty, 240);
        const ref = plain(item.ref) ? item.ref : {};
        const page = Math.max(1, whole(ref.page));
        const file = text(ref.path, 4096);
        const name = text(ref.name, 200);
        const body = [question, attempt, difficulty].filter((part) => part.trim()).join('\n') || name;
        if (!body.trim()) continue;
        if (docs.length >= MAX_DOCS) {
          partial = true;
          break;
        }
        docs.push({
          i: docs.length,
          role: '',
          text: clip(body),
          title: clip(question || name),
          page,
          when: 0,
          courseId,
          reviewId: reviewKey(courseId, question, file, page),
          materialName: name,
        });
      }
      if (partial) break;
    }
  }
  return {title: candidate.title, docs, partial};
}
function extractFree(candidate) {
  const record = readJson(candidate.file);
  const docs = [];
  let partial = false;
  if (record) {
    const title = text(record.title, MAX_TITLE_CHARS);
    const draftRaw = typeof record.draft === 'string' ? record.draft : '';
    if (draftRaw.length > 20000) partial = true;
    const draft = text(draftRaw, 20000);
    if (title || draft) docs.push({i: docs.length, role: '', text: clip([title, draft].filter(Boolean).join('\n')), title: clip(title), when: candidate.when});
    for (const material of Array.isArray(record.materials) ? record.materials : []) {
      const name = text(material?.name, 200);
      if (!name) continue;
      if (docs.length >= MAX_DOCS) {
        partial = true;
        break;
      }
      docs.push({i: docs.length, role: '', text: clip(name), title: clip(name), when: candidate.when, materialName: name});
    }
  }
  return {title: candidate.chat?.title || candidate.title || text(record?.title, MAX_TITLE_CHARS), docs, partial, ...chatFields(candidate)};
}
function extractMaterial(candidate) {
  const docs = [];
  let partial = false;
  if (candidate.title) docs.push({i: docs.length, role: '', text: clip(candidate.title), title: clip(candidate.title), when: 0, materialName: candidate.title, materialId: materialKey(candidate.courseId, candidate.title)});
  for (const pdf of candidate.names || []) {
    if (docs.length >= MAX_DOCS) {
      partial = true;
      break;
    }
    docs.push({i: docs.length, role: '', text: clip(pdf.name), title: clip(pdf.name), when: 0, materialName: pdf.name, materialPath: pdf.path, materialId: materialKey(candidate.courseId, pdf.name)});
  }
  return {title: candidate.title, docs, partial};
}
function extractNotes(candidate) {
  const docs = [];
  let partial = false;
  for (const [scope, items] of Object.entries(candidate.store || {})) {
    for (const item of Array.isArray(items) ? items : []) {
      const one = notesStore.normalizeStored(item);
      if (!one) continue;
      const body = [one.ref.name, one.quote, one.note].filter((part) => String(part || '').trim()).join('\n');
      if (!body.trim()) continue;
      if (docs.length >= MAX_DOCS) {
        partial = true;
        break;
      }
      docs.push({
        i: docs.length,
        role: '',
        text: clip(body),
        title: clip(one.note || one.quote || one.ref.name),
        page: one.ref.page,
        when: one.updatedAt,
        courseId: scope,
        noteId: one.id,
        materialName: one.ref.name,
        materialPath: one.ref.path,
      });
    }
    if (partial) break;
  }
  return {title: candidate.title, docs, partial};
}
function extractPdf(candidate, provider) {
  return Promise.resolve(provider(candidate.file, candidate)).then((result) => {
    const pages = Array.isArray(result) ? result : Array.isArray(result?.pages) ? result.pages : [];
    const docs = [];
    let partial = pages.length > MAX_PDF_PAGES;
    for (const page of pages.slice(0, MAX_PDF_PAGES)) {
      const number = Math.max(1, whole(page?.page));
      if (typeof page?.text === 'string' && page.text.length > MAX_DOC_CHARS) partial = true;
      const body = clip(page?.text);
      if (!body.trim()) continue;
      docs.push({i: docs.length, role: '', page: number, text: body, when: 0, materialName: candidate.materialName || path.basename(candidate.file)});
    }
    return {title: candidate.title || path.basename(candidate.file), docs, partial};
  });
}
/* Extração padrão de PDF pelo próprio PDF.js (host). O texto é o mesmo que o
 * leitor mostra; nada é escrito no PDF. */
let pdfModule = null;
async function pdfjs() {
  if (!pdfModule) {
    const entry = require.resolve('pdfjs-dist/legacy/build/pdf.mjs');
    pdfModule = await import(pathToFileURL(entry).href);
  }
  return pdfModule;
}
async function defaultPdfText(file) {
  const pdf = await pdfjs();
  const bytes = fs.readFileSync(file);
  const task = pdf.getDocument({data: new Uint8Array(bytes), isEvalSupported: false, useSystemFonts: true, disableFontFace: true});
  const doc = await task.promise;
  const pages = [];
  try {
    const total = Math.min(doc.numPages, MAX_PDF_PAGES);
    for (let number = 1; number <= total; number++) {
      const page = await doc.getPage(number);
      const content = await page.getTextContent();
      const body = content.items.map((item) => (typeof item?.str === 'string' ? item.str : '')).join(' ').replace(/\s+/g, ' ').trim();
      if (body) pages.push({page: number, text: body});
      try {
        page.cleanup();
      } catch { /* página descartável */ }
    }
  } finally {
    try {
      await task.destroy();
    } catch { /* já destruído */ }
  }
  return pages;
}
async function extractCandidate(candidate, provider) {
  switch (candidate.kind) {
    case 'pi':
      return extractPi(candidate);
    case 'claude':
      return extractMessages(candidate);
    case 'sidechat':
      return extractSidechat(candidate);
    case 'review':
      return extractReview(candidate);
    case 'free':
      return extractFree(candidate);
    case 'material':
      return extractMaterial(candidate);
    case 'notes':
      return extractNotes(candidate);
    case 'pdf':
      return extractPdf(candidate, provider);
    default:
      return {title: candidate.title || '', docs: []};
  }
}

module.exports = {defaultPdfText, extractCandidate};
