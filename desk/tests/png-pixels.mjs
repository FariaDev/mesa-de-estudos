/* Leitor de PNG dos testes de pixel (#114): o canvas do Electron devolve
   base64 e o teste compara cores em posições conhecidas sem biblioteca nova. */

import zlib from 'node:zlib';

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const CHANNELS = {0: 1, 2: 3, 4: 2, 6: 4};

function paeth(left, up, upLeft) {
  const estimate = left + up - upLeft;
  const toLeft = Math.abs(estimate - left);
  const toUp = Math.abs(estimate - up);
  const toUpLeft = Math.abs(estimate - upLeft);
  if (toLeft <= toUp && toLeft <= toUpLeft) return left;
  return toUp <= toUpLeft ? up : upLeft;
}

/**
 * Decodifica um PNG de 8 bits, sem entrelaçamento, para canais crus.
 * @param {string} base64
 * @returns {{width: number, height: number, channels: number, pixels: Buffer}}
 * @example const png = decodePng(data); pixelAt(png, 0, 0) // {r, g, b, a}
 */
export function decodePng(base64) {
  const buffer = Buffer.from(base64, 'base64');
  if (!buffer.subarray(0, 8).equals(SIGNATURE)) throw Error('o resultado não começa com a assinatura PNG');
  let width = 0;
  let height = 0;
  let colorType = 0;
  let bitDepth = 0;
  let interlace = 0;
  const chunks = [];
  for (let offset = 8; offset + 12 <= buffer.length;) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === 'IDAT') chunks.push(data);
    else if (type === 'IEND') break;
    offset += 12 + length;
  }
  const channels = CHANNELS[colorType];
  if (!channels) throw Error(`PNG com tipo de cor ${colorType}; esperado RGB ou RGBA`);
  if (bitDepth !== 8 || interlace !== 0) throw Error(`PNG com profundidade ${bitDepth} e entrelaçamento ${interlace}; esperado 8 e 0`);
  const raw = zlib.inflateSync(Buffer.concat(chunks));
  const stride = width * channels;
  const pixels = Buffer.alloc(height * stride);
  let offset = 0;
  for (let row = 0; row < height; row += 1) {
    const filter = raw[offset];
    offset += 1;
    const line = raw.subarray(offset, offset + stride);
    offset += stride;
    const out = pixels.subarray(row * stride, (row + 1) * stride);
    const up = row > 0 ? pixels.subarray((row - 1) * stride, row * stride) : null;
    for (let index = 0; index < stride; index += 1) {
      const left = index >= channels ? out[index - channels] : 0;
      const above = up ? up[index] : 0;
      const upLeft = up && index >= channels ? up[index - channels] : 0;
      switch (filter) {
        case 0: out[index] = line[index]; break;
        case 1: out[index] = (line[index] + left) & 0xff; break;
        case 2: out[index] = (line[index] + above) & 0xff; break;
        case 3: out[index] = (line[index] + Math.floor((left + above) / 2)) & 0xff; break;
        case 4: out[index] = (line[index] + paeth(left, above, upLeft)) & 0xff; break;
        default: throw Error(`PNG com filtro ${filter}; esperado de 0 a 4`);
      }
    }
  }
  return {width, height, channels, pixels};
}

/**
 * Cor de um pixel, em RGBA.
 * @param {{width: number, height: number, channels: number, pixels: Buffer}} png
 * @param {number} x
 * @param {number} y
 * @returns {{r: number, g: number, b: number, a: number}}
 */
export function pixelAt(png, x, y) {
  const at = (y * png.width + x) * png.channels;
  const alpha = png.channels === 4 ? png.pixels[at + 3] : 255;
  return {r: png.pixels[at], g: png.pixels[at + 1], b: png.pixels[at + 2], a: alpha};
}

/**
 * O pixel na fração (fx, fy) da imagem.
 * @param {{width: number, height: number, channels: number, pixels: Buffer}} png
 * @param {number} fx 0 (esquerda) a 1 (direita)
 * @param {number} fy 0 (topo) a 1 (base)
 * @returns {{r: number, g: number, b: number, a: number}}
 */
export function pixelAtFraction(png, fx, fy) {
  const x = Math.min(png.width - 1, Math.max(0, Math.floor(png.width * fx)));
  const y = Math.min(png.height - 1, Math.max(0, Math.floor(png.height * fy)));
  return pixelAt(png, x, y);
}
