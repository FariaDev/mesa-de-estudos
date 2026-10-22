// @ts-check
'use strict';

/* Imagem da Mesa → arquivo temporário → `files:[{uri:'file://…'}]`.
 * Sem arquivo não há anexo: o aviso é explícito, o modelo não vê o anexo. */

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {message} = require('../i18n.mjs');

const MAX_IMAGE_BYTES = 16 * 1024 * 1024;
const MIME_EXTENSIONS = Object.freeze({
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
});

function writeTempImage(base64, extension, tempDir) {
  try {
    const buffer = Buffer.from(base64, 'base64');
    if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) return '';
    const file = path.join(tempDir, `${crypto.randomUUID()}.${extension}`);
    fs.writeFileSync(file, buffer);
    return file;
  } catch {
    return '';
  }
}

/**
 * Grava cada imagem num temporário e devolve os anexos `file://` do prompt.
 * @param {unknown} images lista `{type:'image', mimeType, data: base64}` da Mesa
 * @param {{tempDir: () => string, warn: (code: string, text: string) => void}} deps
 * @returns {Array<{uri: string}>}
 * @example materializeImages([{mimeType: 'image/png', data}], {tempDir, warn}) // [{uri: 'file:///…png'}]
 */
function materializeImages(images, {tempDir, warn}) {
  const files = [];
  for (const image of Array.isArray(images) ? images : []) {
    if (!image || typeof image !== 'object' || Array.isArray(image)) continue;
    const data = typeof image.data === 'string' ? image.data : '';
    const extension = MIME_EXTENSIONS[image.mimeType];
    if (!data || !extension) {
      warn('OPENCODE_IMAGE_UNSUPPORTED', message('opencode.image.unsupported', {mime: String(image.mimeType || '')}));
      continue;
    }
    const file = writeTempImage(data, extension, tempDir());
    if (!file) {
      warn('OPENCODE_IMAGE_FAILED', message('opencode.image.failed'));
      continue;
    }
    files.push({uri: pathToFileURL(file).href});
  }
  return files;
}

module.exports = {materializeImages};
