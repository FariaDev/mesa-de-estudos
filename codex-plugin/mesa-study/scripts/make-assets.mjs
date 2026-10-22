#!/usr/bin/env node
/* Gera os PNGs provisórios referenciados pelo manifesto (`assets/icon.png` e
   `assets/logo.png`). São placeholders geométricos determinísticos, não a
   identidade visual final: nenhum desenho externo é importado e a validação de
   pacote Codex exige ícones quadrados (>= 48x48). O doctor e os testes não
   dependem deste script ter rodado; eles só leem os PNGs.

   - sem dependências npm (só node:zlib/node:fs);
   - nunca sobrescreve um arquivo existente sem `--force`;
   - só grava dentro de `assets/` do próprio plugin (`--root` existe para
     testes, com o mesmo confinamento). */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import {fileURLToPath} from 'node:url';

export const PLACEHOLDER_SIZE = 128;
export const ASSET_FILES = Object.freeze(['icon.png', 'logo.png']);

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

export function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

/* PNG RGBA de 8 bits, sem entrelaçamento. `draw(x, y)` devolve [r,g,b,a]. */
export function encodePng(width, height, draw) {
  const raw = Buffer.alloc(height * (1 + width * 4));
  let offset = 0;
  for (let y = 0; y < height; y += 1) {
    raw[offset] = 0;
    offset += 1;
    for (let x = 0; x < width; x += 1) {
      const pixel = draw(x, y);
      raw[offset] = pixel[0];
      raw[offset + 1] = pixel[1];
      raw[offset + 2] = pixel[2];
      raw[offset + 3] = pixel[3];
      offset += 4;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, {level: 9})),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* Cartão claro com três linhas sobre fundo escuro: um "caderno" genérico. */
export function buildPlaceholderPng(size = PLACEHOLDER_SIZE) {
  const background = [29, 53, 87, 255];
  const card = [233, 196, 106, 255];
  const line = [244, 243, 238, 255];
  const margin = Math.round(size * 0.22);
  const cardEnd = size - margin;
  const lineX0 = margin + Math.round((size - 2 * margin) * 0.18);
  const lineX1 = size - margin - Math.round((size - 2 * margin) * 0.18);
  const lineHeight = Math.max(2, Math.round(size * 0.05));
  const lineCenters = [0.32, 0.5, 0.68].map((f) => margin + Math.round((size - 2 * margin) * f));
  return encodePng(size, size, (x, y) => {
    if (x < margin || x >= cardEnd || y < margin || y >= cardEnd) return background;
    for (const center of lineCenters) {
      const top = center - Math.floor(lineHeight / 2);
      const bottom = center + Math.ceil(lineHeight / 2);
      if (x >= lineX0 && x < lineX1 && y >= top && y < bottom) return line;
    }
    return card;
  });
}

/**
 * Garante `assets/icon.png` e `assets/logo.png` sob `root`.
 * Sem `force`, arquivo existente é preservado (contado em `skipped`).
 */
export function ensurePlaceholderAssets({root, force = false, size = PLACEHOLDER_SIZE} = {}) {
  if (typeof root !== 'string' || root === '') throw new Error('root ausente.');
  const assetsDir = path.join(root, 'assets');
  fs.mkdirSync(assetsDir, {recursive: true});
  const png = buildPlaceholderPng(size);
  const written = [];
  const skipped = [];
  for (const name of ASSET_FILES) {
    const target = path.join(assetsDir, name);
    if (!force && fs.existsSync(target)) {
      skipped.push(target);
      continue;
    }
    fs.writeFileSync(target, png, force ? undefined : {flag: 'wx'});
    written.push(target);
  }
  return {written, skipped, assetsDir};
}

function isMainEntry(entry, moduleUrl = import.meta.url) {
  if (typeof entry !== 'string' || entry === '') return false;
  try {
    return fs.realpathSync(entry) === fs.realpathSync(fileURLToPath(moduleUrl));
  } catch {
    return false;
  }
}

function parseArgs(argv) {
  const options = {root: null, force: false, help: false};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = String(argv[index]);
    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }
    if (arg === '--force') {
      options.force = true;
      continue;
    }
    if (arg === '--root' || arg.startsWith('--root=')) {
      const eq = arg.indexOf('=');
      if (eq !== -1) {
        options.root = arg.slice(eq + 1);
      } else {
        options.root = argv[index + 1];
        index += 1;
      }
      continue;
    }
    throw new Error(`Argumento desconhecido: ${arg}`);
  }
  return options;
}

function usage() {
  return [
    'Uso: node scripts/make-assets.mjs [--root DIR] [--force]',
    '',
    '  --root DIR   raiz do plugin (padrão: a pasta que contém scripts/)',
    '  --force      sobrescreve PNGs existentes (sem isso, nada é tocado)',
  ].join('\n');
}

if (isMainEntry(process.argv[1])) {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
      process.stdout.write(`${usage()}\n`);
      process.exitCode = 0;
    } else {
      const root = options.root
        ? path.resolve(options.root)
        : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
      const result = ensurePlaceholderAssets({root, force: options.force});
      process.stdout.write(
        `${JSON.stringify({root, written: result.written, skipped: result.skipped}, null, 2)}\n`,
      );
      process.exitCode = 0;
    }
  } catch (error) {
    process.stderr.write(`make-assets: ${error && error.message ? error.message : error}\n${usage()}\n`);
    process.exitCode = 1;
  }
}
