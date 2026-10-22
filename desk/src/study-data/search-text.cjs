'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const core = require('../generated/studysearch.core.js').default;

/* Busca de estudos — limites, ids opacos, dobra de acento e trecho, leitura
 * limitada de arquivo.
 * Saiu de search.cjs na #43 fase 2; a política continua no núcleo
 * (`core/studysearch.bend`). */

const INDEX_DIR = 'study-search';
const INDEX_FILE = 'index.json';
const INDEX_VERSION = 1;
const MAX_INDEX_BYTES = 24 * 1024 * 1024;
const MAX_DOC_CHARS = 4000;
const MAX_DOCS = 400;
const MAX_PDF_PAGES = 400;
const MAX_TITLE_CHARS = 160;
const MAX_STATE_SESSIONS = 2000;
const SNIPPET_RADIUS = 48;
const FREE_COURSE_ID = 'mesa-free';
const FREE_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const PDF_RE = /\.pdf$/i;
const PI_SESSION_RE = /^pi-\d+\.jsonl$/;
/* Descritores nativos (Claude e OpenCode, #57): o mesmo JSON, lido do mesmo jeito. */
const NATIVE_DESCRIPTOR_RE = /^(?:claude|opencode)-[0-9a-f-]{36}\.json$/;
const SIDECHAT_RE = /^sc-[0-9a-f-]{36}\.json$/;
const CHAT_LIBRARY_FILE = 'chat-library.json';
const CHAT_LIBRARY_MAX_BYTES = 2 * 1024 * 1024;
const CHAT_LIBRARY_MAX_ITEMS = 10000;
const CHAT_ID_RE = /^chat-[a-f0-9]{32}$/;
const MARK = /[\u0300-\u036f]/g;
const CONTEXT_END = '\n[Fim do contexto do chat lateral]\n\n';
const KNOWN_SOURCES = Object.freeze(['conversa', 'lateral', 'nota', 'caderno', 'livre', 'materia', 'pdf']);
/* Tags do artefato (bend 2.0.6+ emite a tag sem o prefixo do módulo). */
const SRC_TAG = Object.freeze({
  conversa: {$: 'HsConv'},
  lateral: {$: 'HsSide'},
  nota: {$: 'HsNote'},
  caderno: {$: 'HsReview'},
  livre: {$: 'HsFree'},
  materia: {$: 'HsMaterial'},
  pdf: {$: 'HsPdf'},
});
const plain = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value, max = 4096) => (typeof value === 'string' ? value.slice(0, max) : '');
const whole = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.trunc(number) : 0;
};
const sha1 = (value) => crypto.createHash('sha1').update(String(value)).digest('hex');
const sha256 = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');
const keyOf = (file) => sha1(path.resolve(String(file))).slice(0, 20);
/* Slug do material para o id opaco (`materia`); não é caminho. */
const materialKey = (courseId, name) => sha1(`${courseId}\u0000${name}`).slice(0, 20);
const reviewKey = (courseId, question, file, page) => sha1(`${courseId}\u0000${question}\u0000${file}\u0000${page}`).slice(0, 20);
/* Dobra por code point com mapa UTF-16 → índice original (mesma técnica da
 * busca das conversas): `formulario` acha "Formulário" e o recorte cai no texto
 * de verdade, nunca no dobrado. */
function foldText(source) {
  const input = String(source ?? '');
  let folded = '';
  const map = [];
  let index = 0;
  for (const ch of input) {
    const piece = ch.normalize('NFD').replace(MARK, '').toLowerCase().normalize('NFD').replace(MARK, '');
    for (let i = 0; i < piece.length; i++) {
      folded += piece[i];
      map.push(index);
    }
    index += ch.length;
  }
  return {folded, map};
}
function fold(source) {
  return foldText(source).folded;
}
const isHighSurrogate = (code) => code >= 0xd800 && code <= 0xdbff;
const isLowSurrogate = (code) => code >= 0xdc00 && code <= 0xdfff;
/* Trecho em volta do casamento, cortado do texto ORIGINAL com espaços
 * colapsados; `…` nas pontas aparadas vem daqui (core.clipText). Emoji nunca
 * sai pela metade. */
function snippetOf(source, start, end) {
  const input = String(source ?? '');
  const len = input.length;
  const matchLen = Math.max(0, end - start);
  const budget = Math.max(0, Number(core.maxSnippetChars()) - matchLen);
  const before = Math.min(SNIPPET_RADIUS, Math.floor(budget / 2));
  const after = Math.max(0, budget - before);
  let from = Math.max(0, start - before);
  let to = Math.min(len, end + after);
  if (from > 0 && from < len && isLowSurrogate(input.charCodeAt(from)) && isHighSurrogate(input.charCodeAt(from - 1))) from -= 1;
  if (to > 0 && to < len && isHighSurrogate(input.charCodeAt(to - 1)) && isLowSurrogate(input.charCodeAt(to))) to += 1;
  const body = input.slice(from, to).replace(/\s+/g, ' ').trim() || input.slice(start, end);
  return core.clipText(from > 0, to < len, body);
}
/* Casamentos não sobrepostos da agulha dobrada; devolve índice no texto
 * original + trecho + se o casamento começa o texto/palavra (fatos da
 * pontuação — o núcleo decide a prioridade). */
function findMatches(source, needle, limit) {
  const input = String(source ?? '');
  if (!input || !needle) return [];
  const {folded, map} = foldText(input);
  const out = [];
  let at = 0;
  while ((at = folded.indexOf(needle, at)) !== -1) {
    const start = map[at];
    if (start == null) break;
    let end = at + needle.length < map.length ? map[at + needle.length] : input.length;
    if (end <= start) {
      const point = input.codePointAt(start) || 0;
      end = start + (point > 0xFFFF ? 2 : 1);
    }
    if (end > input.length) end = input.length;
    const before = at === 0 ? '' : folded[at - 1];
    const wordHit = at === 0 || !/[a-z0-9]/.test(before);
    out.push({index: start, snippet: snippetOf(input, start, end), startHit: at === 0, wordHit});
    if (out.length >= limit) break;
    at += Math.max(1, needle.length);
  }
  return out;
}
function clampLimit(value) {
  const number = Math.floor(Number(value));
  return Number(core.clampLimit(!Number.isFinite(number) || number < 1, number > Number(core.maxLimit()), Number.isFinite(number) ? Math.max(0, number) : 0));
}
const maxPerFile = () => Number(core.maxPerFile());
const maxHits = () => Number(core.maxHits());
const minQueryChars = () => Number(core.minQueryChars());
const maxQueryChars = () => Number(core.maxQueryChars());
function readJson(file) {
  try {
    const stats = fs.statSync(file);
    if (!stats.isFile() || stats.size > 64 * 1024 * 1024) return null;
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return plain(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
function readText(file, maxBytes = Number(core.maxFileBytes())) {
  try {
    const stats = fs.statSync(file);
    if (!stats.isFile() || stats.size > maxBytes) return null;
    return fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}
function statOf(file) {
  try {
    const stats = fs.statSync(file);
    return stats.isFile() ? stats : null;
  } catch {
    return null;
  }
}

module.exports = {INDEX_DIR, INDEX_FILE, INDEX_VERSION, MAX_INDEX_BYTES, MAX_DOC_CHARS, MAX_DOCS, MAX_PDF_PAGES, MAX_TITLE_CHARS, MAX_STATE_SESSIONS, FREE_COURSE_ID, FREE_ID_RE, PDF_RE, PI_SESSION_RE, NATIVE_DESCRIPTOR_RE, SIDECHAT_RE, CHAT_LIBRARY_FILE, CHAT_LIBRARY_MAX_BYTES, CHAT_LIBRARY_MAX_ITEMS, CHAT_ID_RE, CONTEXT_END, KNOWN_SOURCES, SRC_TAG, plain, text, whole, sha1, sha256, keyOf, materialKey, reviewKey, foldText, fold, snippetOf, findMatches, clampLimit, maxPerFile, maxHits, minQueryChars, maxQueryChars, readJson, readText, statOf};
