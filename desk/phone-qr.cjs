// @ts-check
'use strict';

/* QR code do endereço da Foto do celular (#36), sem dependência.

   Só o que o endereço precisa: modo byte, correção M e versões 1 a 10 (até 213
   bytes; `http://<IPv4>:<porta>/<token>` tem uns 50). O algoritmo é o da norma
   ISO/IEC 18004 na forma em que o Nayuki o descreve (Project Nayuki, "QR Code
   generator library", MIT): blocos com Reed-Solomon em GF(256), padrões fixos,
   colocação em zigue-zague e a máscara de menor penalidade. */

/** Correção M por versão: [ecc por bloco, [[blocos, dados por bloco], …]]. */
const ECC_M = {
  1: [10, [[1, 16]]], 2: [16, [[1, 28]]], 3: [26, [[1, 44]]], 4: [18, [[2, 32]]], 5: [24, [[2, 43]]],
  6: [16, [[4, 27]]], 7: [18, [[4, 31]]], 8: [22, [[2, 38], [2, 39]]], 9: [22, [[3, 36], [2, 37]]], 10: [26, [[4, 43], [1, 44]]],
};
const ALIGN = {1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50]};
const MAX_VERSION = 10;

/** @param {number} version */
const dataCapacity = (version) => ECC_M[version][1].reduce((sum, [count, size]) => sum + count * size, 0);
/** @param {number} version */
const countBits = (version) => (version < 10 ? 8 : 16);

/** Menor versão que comporta `length` bytes no modo byte com correção M. */
function pickVersion(length) {
  for (let version = 1; version <= MAX_VERSION; version++) {
    if (4 + countBits(version) + 8 * length <= 8 * dataCapacity(version)) return version;
  }
  throw new Error(`Texto de ${length} bytes não cabe no QR code (máximo da versão ${MAX_VERSION} com correção M: ${dataCapacity(MAX_VERSION) - 3} bytes).`);
}

/* ---------- GF(256) e Reed-Solomon ---------- */

function gfMultiply(x, y) {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z;
}

function rsDivisor(degree) {
  const result = new Array(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      result[j] = gfMultiply(result[j], root);
      if (j + 1 < degree) result[j] ^= result[j + 1];
    }
    root = gfMultiply(root, 0x02);
  }
  return result;
}

function rsRemainder(data, divisor) {
  const result = divisor.map(() => 0);
  for (const byte of data) {
    const factor = byte ^ result.shift();
    result.push(0);
    divisor.forEach((coef, i) => { result[i] ^= gfMultiply(coef, factor); });
  }
  return result;
}

/* ---------- bits de dados ---------- */

function dataCodewords(bytes, version) {
  const bits = [];
  const push = (value, length) => { for (let i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1); };
  push(0b0100, 4);
  push(bytes.length, countBits(version));
  for (const byte of bytes) push(byte, 8);
  const capacity = 8 * dataCapacity(version);
  push(0, Math.min(4, capacity - bits.length));
  push(0, (8 - (bits.length % 8)) % 8);
  const words = [];
  for (let i = 0; i < bits.length; i += 8) words.push(bits.slice(i, i + 8).reduce((acc, bit) => (acc << 1) | bit, 0));
  for (let pad = 0xec; words.length < dataCapacity(version); pad ^= 0xec ^ 0x11) words.push(pad);
  return words;
}

/** Divide em blocos, calcula a correção e intercala, como a norma manda. */
function interleaved(words, version) {
  const [eccLength, groups] = ECC_M[version];
  const divisor = rsDivisor(eccLength);
  const blocks = [];
  let at = 0;
  for (const [count, size] of groups) {
    for (let i = 0; i < count; i++) {
      const data = words.slice(at, at + size);
      at += size;
      blocks.push({data, ecc: rsRemainder(data, divisor)});
    }
  }
  const out = [];
  const longest = Math.max(...blocks.map((block) => block.data.length));
  for (let i = 0; i < longest; i++) for (const block of blocks) if (i < block.data.length) out.push(block.data[i]);
  for (let i = 0; i < eccLength; i++) for (const block of blocks) out.push(block.ecc[i]);
  return out;
}

/* ---------- matriz ---------- */

function createGrid(size) {
  return {
    size,
    dark: Array.from({length: size}, () => new Array(size).fill(false)),
    fixed: Array.from({length: size}, () => new Array(size).fill(false)),
  };
}

function setFixed(grid, x, y, dark) {
  grid.dark[y][x] = dark;
  grid.fixed[y][x] = true;
}

function drawFinder(grid, cx, cy) {
  for (let dy = -4; dy <= 4; dy++) {
    for (let dx = -4; dx <= 4; dx++) {
      const x = cx + dx, y = cy + dy;
      if (x < 0 || y < 0 || x >= grid.size || y >= grid.size) continue;
      const ring = Math.max(Math.abs(dx), Math.abs(dy));
      setFixed(grid, x, y, ring !== 2 && ring !== 4);
    }
  }
}

function drawAlignment(grid, cx, cy) {
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) setFixed(grid, cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }
}

function drawFormat(grid, mask) {
  const data = mask; // correção M = 00 nos dois bits de cima
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  const bits = ((data << 10) | rem) ^ 0x5412;
  const bit = (i) => ((bits >>> i) & 1) === 1;
  const size = grid.size;
  for (let i = 0; i <= 5; i++) setFixed(grid, 8, i, bit(i));
  setFixed(grid, 8, 7, bit(6));
  setFixed(grid, 8, 8, bit(7));
  setFixed(grid, 7, 8, bit(8));
  for (let i = 9; i < 15; i++) setFixed(grid, 14 - i, 8, bit(i));
  for (let i = 0; i < 8; i++) setFixed(grid, size - 1 - i, 8, bit(i));
  for (let i = 8; i < 15; i++) setFixed(grid, 8, size - 15 + i, bit(i));
  setFixed(grid, 8, size - 8, true);
}

function drawVersion(grid, version) {
  if (version < 7) return;
  let rem = version;
  for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
  const bits = (version << 12) | rem;
  for (let i = 0; i < 18; i++) {
    const dark = ((bits >>> i) & 1) === 1;
    const a = grid.size - 11 + (i % 3), b = Math.floor(i / 3);
    setFixed(grid, a, b, dark);
    setFixed(grid, b, a, dark);
  }
}

function drawFixedPatterns(grid, version) {
  const size = grid.size;
  for (let i = 0; i < size; i++) {
    setFixed(grid, 6, i, i % 2 === 0);
    setFixed(grid, i, 6, i % 2 === 0);
  }
  drawFinder(grid, 3, 3);
  drawFinder(grid, size - 4, 3);
  drawFinder(grid, 3, size - 4);
  const spots = ALIGN[version];
  const last = spots.length - 1;
  spots.forEach((x, i) => spots.forEach((y, j) => {
    const onFinder = (i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0);
    if (!onFinder) drawAlignment(grid, x, y);
  }));
  drawFormat(grid, 0); // reserva a área; a máscara escolhida reescreve
  drawVersion(grid, version);
}

function placeCodewords(grid, codewords) {
  const size = grid.size;
  let i = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (grid.fixed[y][x] || i >= codewords.length * 8) continue;
        grid.dark[y][x] = ((codewords[i >>> 3] >>> (7 - (i & 7))) & 1) === 1;
        i++;
      }
    }
  }
}

const MASKS = [
  (x, y) => (x + y) % 2 === 0,
  (_x, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

function applyMask(grid, mask) {
  for (let y = 0; y < grid.size; y++) {
    for (let x = 0; x < grid.size; x++) if (!grid.fixed[y][x] && MASKS[mask](x, y)) grid.dark[y][x] = !grid.dark[y][x];
  }
}

/* ---------- penalidade (escolha da máscara) ---------- */

function lineScore(line) {
  let score = 0, run = 1;
  for (let i = 1; i <= line.length; i++) {
    if (i < line.length && line[i] === line[i - 1]) { run++; continue; }
    if (run >= 5) score += run - 2;
    run = 1;
  }
  const text = line.map((dark) => (dark ? '1' : '0')).join('');
  for (const pattern of ['10111010000', '00001011101']) {
    for (let at = text.indexOf(pattern); at !== -1; at = text.indexOf(pattern, at + 1)) score += 40;
  }
  return score;
}

function penalty(grid) {
  const {size, dark} = grid;
  let score = 0, darkCount = 0;
  for (let y = 0; y < size; y++) {
    score += lineScore(dark[y]);
    score += lineScore(dark.map((row) => row[y]));
  }
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (dark[y][x]) darkCount++;
      if (x + 1 < size && y + 1 < size && dark[y][x] === dark[y][x + 1] && dark[y][x] === dark[y + 1][x] && dark[y][x] === dark[y + 1][x + 1]) score += 3;
    }
  }
  const total = size * size;
  score += Math.floor(Math.abs(darkCount * 20 - total * 10) / total) * 10;
  return score;
}

function cloneGrid(grid) {
  return {size: grid.size, dark: grid.dark.map((row) => [...row]), fixed: grid.fixed.map((row) => [...row])};
}

/**
 * Matriz do QR code de `text` (UTF-8, modo byte, correção M).
 *
 * @param {string} text  endereço que o celular abre
 * @param {{mask?: number}} [options]  `mask` fixa a máscara (só para conferir as oito)
 * @returns {{size: number, version: number, mask: number, rows: string[]}}
 *   `rows[y][x]` é `'1'` para módulo escuro; sem a margem branca.
 * @example qrMatrix('http://192.168.0.10:51234/abc').rows[0].slice(0, 7) // '1111111'
 */
function qrMatrix(text, options = {}) {
  if (typeof text !== 'string' || !text) throw new Error(`Texto do QR code inválido: ${JSON.stringify(text)}; esperado texto não vazio.`);
  const bytes = [...Buffer.from(text, 'utf8')];
  const version = pickVersion(bytes.length);
  const base = createGrid(17 + 4 * version);
  drawFixedPatterns(base, version);
  placeCodewords(base, interleaved(dataCodewords(bytes, version), version));
  let best = null;
  const masks = Number.isInteger(options.mask) ? [options.mask] : MASKS.map((_, i) => i);
  for (const mask of masks) {
    const grid = cloneGrid(base);
    applyMask(grid, mask);
    drawFormat(grid, mask);
    const score = penalty(grid);
    if (!best || score < best.score) best = {grid, mask, score};
  }
  const rows = best.grid.dark.map((row) => row.map((dark) => (dark ? '1' : '0')).join(''));
  return {size: best.grid.size, version, mask: best.mask, rows};
}

module.exports = {qrMatrix, pickVersion, rsRemainder, rsDivisor};
