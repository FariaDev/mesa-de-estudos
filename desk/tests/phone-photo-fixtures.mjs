/* Fotos sintéticas para os testes da Foto do celular (#36). Nada aqui é
   material de curso nem foto de verdade: são imagens de duas cores feitas para
   o teste (metade esquerda vermelha, direita azul) e metadados inventados que
   o teste procura depois de limpar.

   - `syntheticJpeg()`: JPEG 64×32 gerado uma vez com `sips` a partir de um BMP
     de duas cores e limpo pela própria Mesa (só JFIF, sem EXIF).
   - `withExif(jpeg, {orientation})`: o mesmo JPEG com um APP1 EXIF que leva a
     rotação, uma descrição e um bloco GPS com marca procurável (`GPS_MARK`) e
     um comentário COM com outra marca (`COMMENT_MARK`).
   - `syntheticPng({w, h, text})`: PNG feito aqui com zlib, com um `tEXt` e um
     `eXIf` opcionais.
   - `syntheticWebp()`: RIFF/WEBP mínimo com VP8X, um bloco de imagem e EXIF/XMP
     (estrutura só: o servidor não decodifica WebP). */
import zlib from 'node:zlib';

export const GPS_MARK = 'MESA-SEGREDO-GPS';
export const COMMENT_MARK = 'MESA-COMENTARIO-SECRETO';

const JPEG_BASE64 = '/9j/4AAQSkZJRgABAQAASABIAAD/wAARCAAgAEADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9sAQwACAgICAgIEAgIEBgQEBAYIBgYGBggKCAgICAgKDAoKCgoKCgwMDAwMDAwMDg4ODg4OEBAQEBASEhISEhISEhIS/9sAQwEDAwMFBAUIBAQIEw0LDRMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMT/90ABAAE/9oADAMBAAIRAxEAPwD4Hooor8cP9JQooooAx6KKK/1TP8ZwooooA//Q+B6KKK/HD/SUKKKKAMeiiiv9Uz/GcKKKKAP/2Q==';

/** JPEG 64×32 de duas cores, sem EXIF. */
export const syntheticJpeg = () => Buffer.from(JPEG_BASE64, 'base64');

/* Bloco TIFF big-endian: IFD0 com Orientation, ImageDescription e o ponteiro
   do GPS; o IFD do GPS com uma latitude. */
function tiffBlock(orientation) {
  const description = Buffer.from(`${GPS_MARK}\0`, 'latin1');
  const ifd0 = 8, ifd0Size = 2 + 3 * 12 + 4;
  const descAt = ifd0 + ifd0Size;
  const gpsAt = descAt + description.length + (description.length % 2);
  const gpsSize = 2 + 12 + 4;
  const latAt = gpsAt + gpsSize;
  const out = Buffer.alloc(latAt + 24);
  out.write('MM', 0, 'latin1');
  out.writeUInt16BE(42, 2);
  out.writeUInt32BE(ifd0, 4);
  out.writeUInt16BE(3, ifd0);
  const entry = (at, tag, type, count, value) => { out.writeUInt16BE(tag, at); out.writeUInt16BE(type, at + 2); out.writeUInt32BE(count, at + 4); out.writeUInt32BE(value, at + 8); };
  entry(ifd0 + 2, 0x010e, 2, description.length, descAt);
  entry(ifd0 + 14, 0x0112, 3, 1, orientation << 16);
  entry(ifd0 + 26, 0x8825, 4, 1, gpsAt);
  description.copy(out, descAt);
  out.writeUInt16BE(1, gpsAt);
  entry(gpsAt + 2, 0x0002, 5, 3, latAt);
  [23, 1, 33, 1, 15, 1].forEach((n, i) => out.writeUInt32BE(n, latAt + 4 * i));
  return out;
}

function segment(marker, body) {
  const head = Buffer.from([0xff, marker, 0, 0]);
  head.writeUInt16BE(body.length + 2, 2);
  return Buffer.concat([head, body]);
}

/** O JPEG sintético com EXIF (rotação + GPS) e um comentário logo depois do SOI. */
export function withExif(jpeg, {orientation = 6} = {}) {
  const exif = segment(0xe1, Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), tiffBlock(orientation)]));
  const comment = segment(0xfe, Buffer.from(COMMENT_MARK, 'latin1'));
  return Buffer.concat([jpeg.subarray(0, 2), exif, comment, jpeg.subarray(2)]);
}

function crc32(bytes) {
  let crc = ~0;
  for (const byte of bytes) {
    crc ^= byte;
    for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}

function pngChunk(type, body) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(body.length, 0);
  head.write(type, 4, 'latin1');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), body])), 0);
  return Buffer.concat([head, body, crc]);
}

/** PNG RGB de duas cores, `w`×`h`, com `tEXt` (marca do GPS) e `eXIf` opcionais. */
export function syntheticPng({w = 8, h = 4, text = true, orientation = 0} = {}) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) raw.set(x < w / 2 ? [220, 0, 0] : [0, 60, 220], y * (w * 3 + 1) + 1 + x * 3);
  }
  const parts = [Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), pngChunk('IHDR', ihdr)];
  if (text) parts.push(pngChunk('tEXt', Buffer.from(`Comment\0${GPS_MARK}`, 'latin1')));
  if (orientation) parts.push(pngChunk('eXIf', tiffBlock(orientation)));
  parts.push(pngChunk('IDAT', zlib.deflateSync(raw)), pngChunk('IEND', Buffer.alloc(0)));
  return Buffer.concat(parts);
}

function riffChunk(type, body) {
  const head = Buffer.alloc(8);
  head.write(type, 0, 'latin1');
  head.writeUInt32LE(body.length, 4);
  return Buffer.concat([head, body, body.length % 2 ? Buffer.alloc(1) : Buffer.alloc(0)]);
}

/** RIFF/WEBP com VP8X (flags de EXIF e XMP ligadas), VP8L, EXIF e XMP. */
export function syntheticWebp() {
  const vp8x = Buffer.alloc(10);
  vp8x[0] = 0x08 | 0x04;
  const body = Buffer.concat([
    riffChunk('VP8X', vp8x),
    riffChunk('VP8L', Buffer.from([0x2f, 0, 0, 0, 0])),
    riffChunk('EXIF', Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), tiffBlock(3)])),
    riffChunk('XMP ', Buffer.from(`<x>${GPS_MARK}</x>`, 'latin1')),
  ]);
  const head = Buffer.alloc(12);
  head.write('RIFF', 0, 'latin1');
  head.writeUInt32LE(body.length + 4, 4);
  head.write('WEBP', 8, 'latin1');
  return Buffer.concat([head, body]);
}
