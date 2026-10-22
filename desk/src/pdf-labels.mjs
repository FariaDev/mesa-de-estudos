/* Numeração impressa do leitor de PDF.
   O núcleo (`core/pdfpageview.bend`) decide rótulo/deslocamento/navegação; aqui
   ficam só os fatos do mundo: o que o backend devolveu (`pdf-page-labels-get`),
   o que o PDF.js respondeu (`getPageLabels`) e a tradução para os tipos do
   artefato (`OffsetAuto`/`OffsetValue`, `Con`/`Nil`). Sem DOM, sem IPC: este
   módulo é testável sozinho e o `pdf.mjs` só aplica.
   Contrato do host (root):
     window.desk.pdfPageLabelsGet(path) -> {offset: null | int}
     window.desk.pdfPageLabelsSave({path, offset: null | int}) -> mesmo formato
   O ajuste mora fora do PDF (`state.pdfPageOffsets`, por usuário); nada aqui
   grava em localStorage nem toca no arquivo. */

import {toNat} from './bend-nat.mjs';

// Mesmo teto do main: fora disso não é ajuste, é dado corrompido.
export const MAX_PAGE_OFFSET = 1000000;

// `null` = automático (sem ajuste). Zero é um ajuste explícito.
export function normalizeOffset(value) {
  return Number.isInteger(value) && Math.abs(value) <= MAX_PAGE_OFFSET ? value : null;
}

// Registro do IPC -> offset local. Formato inesperado (backend antigo, lixo)
// vira automático, nunca um número inventado.
export function offsetFromRecord(record) {
  return normalizeOffset(record && typeof record === 'object' ? record.offset : null);
}

// Fatos do núcleo: OffsetAuto{} ou OffsetValue{negative, magnitude}.
export function offsetFacts(offset) {
  const value = normalizeOffset(offset);
  return value == null
    ? {$: 'OffsetAuto'}
    : {$: 'OffsetValue', negative: value < 0, magnitude: toNat(Math.abs(value))};
}

// Lista do artefato (`Con`/`Nil`) de rótulos do PDF, 1-based e na ordem das
// páginas. Entradas nulas/estranhas viram string vazia (página sem rótulo).
export function labelsList(labels) {
  let out = {$: 'Nil'};
  const list = Array.isArray(labels) ? labels : [];
  for (let i = list.length - 1; i >= 0; i -= 1) out = {$: 'Con', head: String(list[i] ?? ''), tail: out};
  return out;
}

// O que o PDF.js trouxe, saneado: array de strings com no máximo `numPages`
// posições. Rugas viram lista vazia (cai no ajuste pessoal, se houver).
export async function readDocLabels(doc) {
  if (!doc || typeof doc.getPageLabels !== 'function') return [];
  let raw;
  try {
    raw = await doc.getPageLabels();
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) return [];
  const total = Number.isInteger(doc.numPages) ? doc.numPages : raw.length;
  return raw.slice(0, total).map((label) => (label == null ? '' : String(label)));
}
