/* Apoio de testes (sintético). Não é usado pelo CLI em produção.
   - makeSyntheticPdf: PDF válido de verdade (Poppler aceita), sem material real;
   - makeFakePng: bytes com magic PNG + IHDR para validadores e prévias;
   - withTempDir: diretório temporário descartável. */

import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import {PNG_MAGIC} from './config.mjs';

function escapePdfText(text) {
  return String(text).replace(/[\\()]/g, (char) => `\\${char}`).replace(/[^\x20-\x7e]/g, '?');
}

export function makeSyntheticPdf({pages = 2, texts = null, width = 595, height = 842, fontSize = 18} = {}) {
  const pageTexts = Array.isArray(texts) && texts.length > 0
    ? texts
    : Array.from({length: pages}, (_, index) => `Test page ${index + 1}`);
  const count = pageTexts.length;

  const objects = [];
  const kids = [];
  let nextId = 4;
  const pageIds = [];
  for (let index = 0; index < count; index += 1) {
    pageIds.push(nextId);
    kids.push(`${nextId} 0 R`);
    nextId += 2; // page + content stream
  }

  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[2] = `<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${count} >>`;
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
  for (let index = 0; index < count; index += 1) {
    const contentId = pageIds[index] + 1;
    const entry = pageTexts[index];
    const stream = Array.isArray(entry)
      ? textBlockStream(entry, {fontSize, width, height})
      : `BT /F1 ${fontSize} Tf 72 720 Td (${escapePdfText(entry)}) Tj ET`;
    objects[pageIds[index]] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`;
    objects[contentId] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  }

  let out = '%PDF-1.4\n';
  const offsets = [];
  for (let id = 1; id < objects.length; id += 1) {
    if (!objects[id]) continue;
    offsets[id] = Buffer.byteLength(out, 'latin1');
    out += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xrefAt = Buffer.byteLength(out, 'latin1');
  out += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id += 1) {
    out += `${String(offsets[id] || 0).padStart(10, '0')} 00000 n \n`;
  }
  out += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

/* Bloco de N linhas no mesmo stream de conteúdo (fonte Helvetica). */
function textBlockStream(lines, {fontSize, width, height}) {
  const leading = Math.max(fontSize + 1, Math.round(fontSize * 1.25));
  const parts = ['BT', `/F1 ${fontSize} Tf`, `${leading} TL`, `36 ${height - 40} Td`];
  for (const line of lines) parts.push(`(${escapePdfText(line)}) Tj T*`);
  parts.push('ET');
  return parts.join('\n');
}

/* PDF sintético de UMA página com >= 55 linhas de texto ASCII longo. O SVG
   do pdftocairo para essa página passa de SVG_CHAR_LIMIT, sem material de
   curso e sem rede — serve para o fallback da prévia vetorial. */
export function makeSyntheticTextPdf({lines = 55, width = 595, height = 1400, fontSize = 12, text = null} = {}) {
  const count = Number.isInteger(lines) && lines > 0 ? lines : 55;
  const lineFor = typeof text === 'function'
    ? (index) => text(index)
    : (index) => `Linha ${String(index + 1).padStart(2, '0')}: f(x) = 2 x^2 + 3 x - 5, g(x) = sen(x) + cos(2 x), h(x) = sqrt(x + 1)`;
  const content = Array.from({length: count}, (_, index) => lineFor(index));
  return makeSyntheticPdf({texts: [content], width, height, fontSize});
}

/* Bytes sintéticos com magic PNG e IHDR legível por pngSize(). Não é um PNG
   completo; serve só para os validadores e para a prévia SVG. */
export function makeFakePng({width = 8, height = 6, bytes = 256, fill = 7} = {}) {
  const size = Math.max(bytes, 64);
  const buffer = Buffer.alloc(size, fill);
  PNG_MAGIC.copy(buffer, 0);
  buffer.writeUInt32BE(13, 8);
  buffer.write('IHDR', 12, 'latin1');
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  return buffer;
}

export async function writeValidFakePdf(file, {padding = 128} = {}) {
  await fs.writeFile(file, Buffer.concat([Buffer.from('%PDF-1.4\n', 'latin1'), Buffer.alloc(padding, 0x20)]));
  return file;
}

export async function withTempDir(prefix, fn) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  try {
    return await fn(dir);
  } finally {
    await fs.rm(dir, {recursive: true, force: true});
  }
}
