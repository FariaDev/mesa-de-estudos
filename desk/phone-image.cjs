// @ts-check
'use strict';

/* Foto que chega do celular (#36): reconhece o tipo pelos primeiros bytes, lê a
   rotação do EXIF e tira os metadados (GPS, aparelho, data, comentários) antes
   de a foto sair do processo principal. Puro: recebe e devolve Buffer.

   A rotação não é aplicada aqui (exigiria decodificar a imagem): ela sai como
   número (1 a 8, a tag Orientation do EXIF) e o renderer desenha a foto já
   girada ao comprimir para a bandeja (`src/phone-photo.mjs`). Como o EXIF sai
   antes, o navegador não gira a foto uma segunda vez.

   O que fica de cada formato é uma lista do que é preciso para desenhar a
   imagem, não uma lista do que sai: um bloco desconhecido nunca passa. */

/** @typedef {'jpeg'|'png'|'webp'} PhotoKind */

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
/* Blocos do PNG que desenham a imagem (cor, transparência, gama); texto, data,
   EXIF e o resto ficam de fora. */
const PNG_KEEP = new Set(['IHDR', 'PLTE', 'IDAT', 'IEND', 'tRNS', 'gAMA', 'cHRM', 'sRGB', 'iCCP', 'sBIT', 'bKGD', 'pHYs']);
/* Blocos do WebP que desenham a imagem; EXIF e XMP ficam de fora. */
const WEBP_KEEP = new Set(['VP8 ', 'VP8L', 'VP8X', 'ALPH', 'ANIM', 'ANMF', 'ICCP']);
const WEBP_EXIF_FLAG = 0x08, WEBP_XMP_FLAG = 0x04;

/**
 * Tipo da foto pelos primeiros bytes (o Content-Type do celular não vale).
 * @param {Buffer} bytes
 * @returns {PhotoKind|null}
 * @example sniffPhoto(Buffer.from([0xff, 0xd8, 0xff, 0xe0])) // 'jpeg'
 */
function sniffPhoto(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';
  if (bytes.subarray(0, 8).equals(PNG_SIGNATURE)) return 'png';
  if (bytes.toString('latin1', 0, 4) === 'RIFF' && bytes.toString('latin1', 8, 12) === 'WEBP') return 'webp';
  return null;
}

/** Tag Orientation (0x0112) de um bloco TIFF; 1 quando não há ou não vale. */
function tiffOrientation(tiff) {
  if (tiff.length < 8) return 1;
  const order = tiff.toString('latin1', 0, 2);
  if (order !== 'II' && order !== 'MM') return 1;
  const le = order === 'II';
  const u16 = (at) => (le ? tiff.readUInt16LE(at) : tiff.readUInt16BE(at));
  const u32 = (at) => (le ? tiff.readUInt32LE(at) : tiff.readUInt32BE(at));
  if (u16(2) !== 42) return 1;
  const ifd = u32(4);
  if (ifd + 2 > tiff.length) return 1;
  const count = u16(ifd);
  for (let i = 0; i < count; i++) {
    const entry = ifd + 2 + 12 * i;
    if (entry + 12 > tiff.length) return 1;
    if (u16(entry) !== 0x0112) continue;
    const value = u16(entry + 8);
    return value >= 1 && value <= 8 ? value : 1;
  }
  return 1;
}

/** Bloco EXIF com ou sem o prefixo `Exif\0\0` → orientação. */
function exifOrientation(block) {
  const tiff = block.toString('latin1', 0, 6) === 'Exif\0\0' ? block.subarray(6) : block;
  return tiffOrientation(tiff);
}

/* JPEG: segmentos até o SOS; dali em diante os dados da imagem vão inteiros.
   Ficam APP0 (JFIF), APP2 só com perfil de cor ICC e APP14 (Adobe, decide a
   cor de alguns JPEGs); os outros APPn (EXIF, XMP, fabricante) e COM saem. */
function keepJpegSegment(marker, body) {
  if (marker < 0xe0 || marker > 0xef) return marker !== 0xfe;
  if (marker === 0xe0 || marker === 0xee) return true;
  return marker === 0xe2 && body.toString('latin1', 0, 12) === 'ICC_PROFILE\0';
}

function cleanJpeg(bytes) {
  const parts = [bytes.subarray(0, 2)];
  let orientation = 1, at = 2;
  while (at < bytes.length) {
    if (bytes[at] !== 0xff) throw new Error(`JPEG malformado: esperado marcador 0xFF no byte ${at}, veio 0x${bytes[at].toString(16)}.`);
    const marker = bytes[at + 1];
    if (marker === 0xff) { at++; continue; }
    if (marker === 0xd9) { parts.push(bytes.subarray(at, at + 2)); return {bytes: Buffer.concat(parts), orientation}; }
    if (at + 4 > bytes.length) throw new Error('JPEG malformado: segmento cortado.');
    const length = bytes.readUInt16BE(at + 2);
    const end = at + 2 + length;
    if (length < 2 || end > bytes.length) throw new Error(`JPEG malformado: segmento 0x${marker.toString(16)} com ${length} bytes passa do fim.`);
    const body = bytes.subarray(at + 4, end);
    if (marker === 0xe1 && body.toString('latin1', 0, 6) === 'Exif\0\0') orientation = exifOrientation(body);
    if (marker === 0xda) { parts.push(bytes.subarray(at)); return {bytes: Buffer.concat(parts), orientation}; }
    if (keepJpegSegment(marker, body)) parts.push(bytes.subarray(at, end));
    at = end;
  }
  throw new Error('JPEG malformado: terminou antes dos dados da imagem.');
}

function cleanPng(bytes) {
  const parts = [PNG_SIGNATURE];
  let orientation = 1, at = 8;
  while (at + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(at);
    const type = bytes.toString('latin1', at + 4, at + 8);
    const end = at + 12 + length;
    if (end > bytes.length) throw new Error(`PNG malformado: bloco ${JSON.stringify(type)} com ${length} bytes passa do fim.`);
    if (type === 'eXIf') orientation = tiffOrientation(bytes.subarray(at + 8, at + 8 + length));
    if (PNG_KEEP.has(type)) parts.push(bytes.subarray(at, end));
    if (type === 'IEND') return {bytes: Buffer.concat(parts), orientation};
    at = end;
  }
  throw new Error('PNG malformado: sem o bloco IEND.');
}

function cleanWebp(bytes) {
  const parts = [];
  let orientation = 1, at = 12;
  while (at + 8 <= bytes.length) {
    const type = bytes.toString('latin1', at, at + 4);
    const length = bytes.readUInt32LE(at + 4);
    const end = at + 8 + length + (length % 2);
    if (at + 8 + length > bytes.length) throw new Error(`WebP malformado: bloco ${JSON.stringify(type)} com ${length} bytes passa do fim.`);
    if (type === 'EXIF') orientation = exifOrientation(bytes.subarray(at + 8, at + 8 + length));
    if (WEBP_KEEP.has(type)) {
      const chunk = Buffer.from(bytes.subarray(at, Math.min(end, bytes.length)));
      if (type === 'VP8X') chunk[8] &= ~(WEBP_EXIF_FLAG | WEBP_XMP_FLAG);
      parts.push(chunk);
    }
    at = end;
  }
  if (!parts.length) throw new Error('WebP malformado: sem dados da imagem.');
  const body = Buffer.concat(parts);
  const head = Buffer.alloc(12);
  head.write('RIFF', 0, 'latin1');
  head.writeUInt32LE(body.length + 4, 4);
  head.write('WEBP', 8, 'latin1');
  return {bytes: Buffer.concat([head, body]), orientation};
}

/**
 * Tira os metadados da foto e devolve a rotação que estava no EXIF.
 * Lança erro (com o que veio e o que se esperava) quando a imagem não fecha.
 *
 * @param {Buffer} bytes
 * @param {PhotoKind} kind  o tipo que `sniffPhoto` reconheceu
 * @returns {{bytes: Buffer, orientation: number}}
 * @example cleanPhoto(jpegComGps, 'jpeg') // {bytes: <sem APP1>, orientation: 6}
 */
function cleanPhoto(bytes, kind) {
  if (kind === 'jpeg') return cleanJpeg(bytes);
  if (kind === 'png') return cleanPng(bytes);
  if (kind === 'webp') return cleanWebp(bytes);
  throw new Error(`Tipo de foto ${JSON.stringify(kind)} desconhecido; esperado "jpeg", "png" ou "webp".`);
}

const MIME = {jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp'};

module.exports = {sniffPhoto, cleanPhoto, exifOrientation, MIME};
