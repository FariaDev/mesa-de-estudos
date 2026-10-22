'use strict';

/* Zip mínimo (leitura + escrita) do domínio estudo/backup, SÓ com builtins.
   É o mesmo caminho que o updater já usa (parser próprio + `inflateRaw`),
   com três diferenças que o compartilhamento de matéria exige:

     1. CRC-32 de cada entrada é CONFERIDO na leitura — zip corrompido não
        vira conteúdo em disco;
     2. limites explícitos (entradas, bytes por entrada, bytes totais, razão
        de compressão) barram zip bomb; a razão só recusa acima de 1000:1,
        o teto de bytes totais é que manda;
     3. path traversal/symlink/absoluto/`..` são recusados em `assertSafePath`
        ANTES de qualquer escrita, e `writeZip` nunca cria entrada perigosa.

   Não mexe no updater: a cópia de leitura é independente de propósito (o
   updater valida a própria codeload e tem a lista explícita dele). Nada de
   dependência nova — `zlib` é builtin. */

const zlib = require('node:zlib');
const {message: uiMsg} = require('../i18n.mjs');
const {causeArg} = require('../error-detail.mjs');

const ZIP_ERROR = 'MESA_ZIP_INVALID';

class ZipError extends Error {
  constructor(message, code = ZIP_ERROR) {
    super(message);
    this.name = 'ZipError';
    this.code = code;
  }
}

/* ---------- caminhos ---------- */

/* Caminho relativo em forma portátil (barra), ou `null` quando é perigoso:
   absoluto, com `..`, com unidade de disco, com byte nulo, vazio, longo
   demais ou com componente vazio (`a//b`). Link simbólico não existe em zip;
   o que se recusa é o NOME que escaparia da raiz. */
const MAX_PATH_CHARS = 1024;

function safeRelPath(name) {
  if (typeof name !== 'string') return null;
  const raw = name.replace(/\\/g, '/');
  if (!raw || raw.length > MAX_PATH_CHARS) return null;
  if (raw.includes('\0')) return null;
  if (/^[a-zA-Z]:/.test(raw)) return null;
  if (raw.startsWith('/')) return null;
  const norm = raw.replace(/\/+/g, '/').replace(/^\.\//, '');
  const parts = norm.split('/');
  if (!norm || parts.some((part) => !part || part === '.' || part === '..')) return null;
  return parts.join('/');
}

function assertSafePath(name, context = 'entrada') {
  const norm = safeRelPath(name);
  if (!norm) throw new ZipError(uiMsg('err.zip.suspiciousPath', {context, name: String(name)}));
  return norm;
}

/* Concatenação segura sob uma raiz: devolve o absoluto ou lança. `rootAbs`
   precisa existir como caminho absoluto normalizado. */
function joinUnder(rootAbs, rel) {
  const path = require('node:path');
  const norm = assertSafePath(rel, 'destino');
  const target = path.resolve(rootAbs, ...norm.split('/'));
  const root = path.resolve(rootAbs);
  if (target !== root && !target.startsWith(root + path.sep)) {
    throw new ZipError(uiMsg('err.zip.outsideRoot', {rel}));
  }
  return target;
}

/* ---------- CRC-32 ---------- */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/* ---------- limites ---------- */

const DEFAULT_LIMITS = Object.freeze({
  maxEntries: 20000,
  maxEntryBytes: 256 * 1024 * 1024,
  maxTotalBytes: 2 * 1024 * 1024 * 1024,
  maxRatio: 1000,
  maxZipBytes: 2 * 1024 * 1024 * 1024,
});

function withLimits(limits = {}) {
  const out = {...DEFAULT_LIMITS};
  for (const [key, value] of Object.entries(limits || {})) {
    if (!(key in out)) continue;
    const num = Number(value);
    if (Number.isFinite(num) && num > 0) out[key] = Math.trunc(num);
  }
  return out;
}

/* ---------- leitura ---------- */

/* EOCD (fim do diretório central) pode ter até 64 KiB de comentário. */
function findEndOfCentralDirectory(buffer) {
  const min = Math.max(0, buffer.length - 66000);
  for (let at = buffer.length - 22; at >= min; at--) {
    if (buffer.readUInt32LE(at) === 0x06054b50) return at;
  }
  return -1;
}

function readZip(buffer, options = {}) {
  const limits = withLimits(options.limits);
  if (!Buffer.isBuffer(buffer)) throw new ZipError(uiMsg('err.zip.notBuffer'));
  if (buffer.length > limits.maxZipBytes) throw new ZipError(uiMsg('err.zip.tooBig'));
  const end = findEndOfCentralDirectory(buffer);
  if (end < 0) throw new ZipError(uiMsg('err.zip.noDirectory'));
  const count = buffer.readUInt16LE(end + 10);
  const cdOffset = buffer.readUInt32LE(end + 16);
  if (count > limits.maxEntries) throw new ZipError(uiMsg('err.zip.tooManyEntries', {count}));
  if (cdOffset >= buffer.length) throw new ZipError(uiMsg('err.zip.directoryOutside'));
  const entries = [];
  const seen = new Set();
  let total = 0;
  let pos = cdOffset;
  for (let index = 0; index < count; index++) {
    if (pos + 46 > buffer.length || buffer.readUInt32LE(pos) !== 0x02014b50) {
      throw new ZipError(uiMsg('err.zip.badEntry', {index}));
    }
    const method = buffer.readUInt16LE(pos + 10);
    const crc = buffer.readUInt32LE(pos + 16);
    const compressedSize = buffer.readUInt32LE(pos + 20);
    const size = buffer.readUInt32LE(pos + 24);
    const nameLen = buffer.readUInt16LE(pos + 28);
    const extraLen = buffer.readUInt16LE(pos + 30);
    const commentLen = buffer.readUInt16LE(pos + 32);
    const localAt = buffer.readUInt32LE(pos + 42);
    const name = buffer.toString('utf8', pos + 46, pos + 46 + nameLen);
    /* Atributos externos: o tipo POSIX (segundo byte alto) diz se a entrada é
       link simbólico — zip não guarda link de verdade, mas zip feito em
       Linux/macOS marca assim. Recusado antes de qualquer escrita. */
    const external = buffer.readUInt32LE(pos + 38);
    const posixMode = (external >>> 16) & 0xffff;
    pos += 46 + nameLen + extraLen + commentLen;
    if (name.endsWith('/')) continue; // diretório explícito: nada a extrair
    if ((posixMode & 0xf000) === 0xa000) throw new ZipError(uiMsg('err.zip.symlink', {name}));
    const norm = assertSafePath(name, `entrada ${index}`);
    /* Nome repetido é ambiguidade de extração (o último sobrescreveria o
       primeiro): recusado antes de qualquer escrita. */
    if (seen.has(norm)) throw new ZipError(uiMsg('err.zip.duplicate', {name: norm}));
    seen.add(norm);
    if (localAt + 30 > buffer.length || buffer.readUInt32LE(localAt) !== 0x04034b50) {
      throw new ZipError(uiMsg('err.zip.badHeader', {name: norm}));
    }
    const localNameLen = buffer.readUInt16LE(localAt + 26);
    const localExtraLen = buffer.readUInt16LE(localAt + 28);
    const localCompressedSize = buffer.readUInt32LE(localAt + 18); // tamanho COMPRIMIDO do cabeçalho local
    const dataAt = localAt + 30 + localNameLen + localExtraLen;
    if (dataAt + localCompressedSize > buffer.length) throw new ZipError(uiMsg('err.zip.badContent', {name: norm}));
    if (size > limits.maxEntryBytes) throw new ZipError(uiMsg('err.zip.entryTooBig', {name: norm}));
    const raw = buffer.subarray(dataAt, dataAt + localCompressedSize);
    /* O diretório central é a autoridade: quando ele declara outro tamanho,
       o zip está inconsistente (não inventa dado comprimido). */
    if (compressedSize !== localCompressedSize) {
      throw new ZipError(uiMsg('err.zip.badCompressedSize', {name: norm}));
    }
    if (size > 0 && localCompressedSize > 0 && size / localCompressedSize > limits.maxRatio) {
      throw new ZipError(uiMsg('err.zip.suspiciousRatio', {name: norm}));
    }
    let data;
    if (method === 0) data = Buffer.from(raw);
    else if (method === 8) {
      try {
        data = zlib.inflateRawSync(raw);
      } catch (error) {
        throw new ZipError(uiMsg('err.zip.inflate', {name: norm, detail: causeArg(error)}));
      }
    } else {
      throw new ZipError(uiMsg('err.zip.method', {method, name: norm}));
    }
    if (data.length !== size) throw new ZipError(uiMsg('err.zip.badSize', {name: norm}));
    if (crc32(data) !== crc) throw new ZipError(uiMsg('err.zip.badCrc', {name: norm}));
    total += data.length;
    if (total > limits.maxTotalBytes) throw new ZipError(uiMsg('err.zip.tooBigUnpacked'));
    entries.push({name: norm, data, size: data.length, crc});
  }
  return entries;
}

/* Índice por nome: leitura de manifesto e de payload sem varrer de novo. */
function zipMap(entries) {
  const map = new Map();
  for (const entry of entries) map.set(entry.name, entry);
  return map;
}

/* ---------- escrita ---------- */

/* Escreve zip (método store por padrão; deflate opcional). Nomes passam por
   `assertSafePath`: um zip gerado aqui nunca é um zip perigoso. A ordem das
   chaves/entradas é preservada — o teste confere byte a byte o que entrou.
   `symlink: true` numa entrada de teste marca o bit POSIX de link, para o
   leitor recusar (o domínio nunca gera link). */
function writeZip(files, {deflate = false} = {}) {
  const pairs = [];
  if (files instanceof Map) for (const [name, data] of files) pairs.push([name, data]);
  else if (Array.isArray(files)) for (const entry of files) pairs.push([entry.name, entry.data, !!entry.symlink]);
  else for (const [name, data] of Object.entries(files || {})) pairs.push([name, data]);
  const locals = [];
  const centrals = [];
  let offset = 0;
  let seen = 0;
  for (const [name, value, symlink] of pairs) {
    const norm = assertSafePath(name, 'saída');
    const data = Buffer.isBuffer(value) ? value : Buffer.from(String(value));
    const method = deflate ? 8 : 0;
    const body = deflate ? zlib.deflateRawSync(data) : data;
    const crc = crc32(data);
    const nameBuf = Buffer.from(norm, 'utf8');
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    if (symlink) central.writeUInt32LE((0xa1ff * 0x10000) >>> 0, 38);
    central.writeUInt32LE(offset, 42);
    locals.push(local, nameBuf, body);
    centrals.push(central, nameBuf);
    offset += local.length + nameBuf.length + body.length;
    seen++;
  }
  if (seen > 65535) throw new ZipError(uiMsg('err.zip.tooManyForFormat'));
  const centralBuf = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(seen, 8);
  eocd.writeUInt16LE(seen, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);
  return Buffer.concat([...locals, centralBuf, eocd]);
}

module.exports = {
  ZipError,
  ZIP_ERROR,
  DEFAULT_LIMITS,
  crc32,
  safeRelPath,
  assertSafePath,
  joinUnder,
  readZip,
  writeZip,
  zipMap,
};
