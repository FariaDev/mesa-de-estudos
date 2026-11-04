'use strict';

/* Entrada do ClaudeAdapter, sem I/O de rede: ids, erros, escolha de controles,
   imagens e mensagem do aluno. Saiu do claude-adapter.cjs na #43 fase 2. */

const {message: uiMsg} = require('../i18n.mjs');
const {invalidValue} = require('../error-detail.mjs');
const {MAX_IMAGES, MAX_IMAGE_BYTES, MAX_TEXT_BYTES, MAX_CONTENT_BYTES, MAX_SELECTION_ID, ALLOWED_IMAGE_TYPES, ClaudeAdapterError} = require('./claude-adapter-contract.cjs');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value) {
  return typeof value === 'string' && UUID_RE.test(value);
}

function errorText(error) {
  if (error instanceof Error) return error.message || error.name;
  return error === undefined ? 'erro desconhecido' : String(error);
}

function asAdapterError(error, notSentDefault = false, fallbackCode = 'CLAUDE_ERROR') {
  if (error instanceof ClaudeAdapterError) return error;
  const code = typeof error?.code === 'string' && error.code ? error.code : fallbackCode;
  const notSent = error?.notSent === true ? true : notSentDefault;
  return new ClaudeAdapterError(code, errorText(error), error?.detail ?? null, notSent);
}

/* Escolha desejada ({model, effort} persistidos pelo usuário). Só strings
   limitadas entram; nomes concretos nunca são adivinhados/completados aqui —
   quem valida contra o catálogo nativo é `compileSelection`. */
function normalizeSelectionInput(selection) {
  const out = {model: null, effort: null};
  if (!selection || typeof selection !== 'object' || Array.isArray(selection)) return out;
  if (typeof selection.model === 'string' && selection.model.trim()) {
    out.model = selection.model.trim().slice(0, MAX_SELECTION_ID);
  }
  if (typeof selection.effort === 'string' && selection.effort.trim()) {
    out.effort = selection.effort.trim().slice(0, MAX_SELECTION_ID);
  }
  return out;
}

function validateImage(image, index) {
  if (!image || typeof image !== 'object' || Array.isArray(image)) {
    throw new ClaudeAdapterError('CLAUDE_BAD_MESSAGE', `imagem ${index + 1}: ${invalidValue('formato', image, '{type, data, mimeType}')}`, null, true);
  }
  if (image.type !== 'image') {
    throw new ClaudeAdapterError('CLAUDE_BAD_MESSAGE', `imagem ${index + 1}: ${invalidValue('type', image.type, '"image"')}`, null, true);
  }
  const mimeType = typeof image.mimeType === 'string' ? image.mimeType.trim() : '';
  if (!ALLOWED_IMAGE_TYPES.includes(mimeType)) {
    throw new ClaudeAdapterError('CLAUDE_BAD_MESSAGE', `imagem ${index + 1}: ${invalidValue('mimeType', image.mimeType, ALLOWED_IMAGE_TYPES.join('|'))}`, null, true);
  }
  const data = typeof image.data === 'string' ? image.data.trim() : '';
  if (!data || data.startsWith('data:') || !/^[A-Za-z0-9+/]+={0,2}$/.test(data) || data.length % 4 === 1) {
    throw new ClaudeAdapterError('CLAUDE_BAD_MESSAGE', `imagem ${index + 1}: ${invalidValue('data', image.data, 'base64 sem prefixo data:')} (a Mesa reduz a captura antes daqui)`, null, true);
  }
  const bytes = Math.floor((data.length * 3) / 4);
  if (bytes > MAX_IMAGE_BYTES) {
    throw new ClaudeAdapterError('CLAUDE_BAD_MESSAGE', uiMsg('err.claude.imageTooBig', {index: index + 1, bytes, max: MAX_IMAGE_BYTES}), null, true);
  }
  return {data, mimeType, bytes};
}

/* Normaliza e valida {text, images} (formato Pi já reduzido) para blocos do
   SDK. Nada é gravado nem transmitido nesta função. */
function prepareMessage({text, images} = {}) {
  const cleanText = typeof text === 'string' ? text : '';
  const list = Array.isArray(images) ? images : [];
  if (!cleanText.trim() && list.length === 0) {
    throw new ClaudeAdapterError('CLAUDE_BAD_MESSAGE', uiMsg('err.claude.emptyMessage'), null, true);
  }
  const textBytes = Buffer.byteLength(cleanText, 'utf8');
  if (textBytes > MAX_TEXT_BYTES) {
    throw new ClaudeAdapterError('CLAUDE_BAD_MESSAGE', uiMsg('err.claude.textTooBig', {bytes: textBytes, max: MAX_TEXT_BYTES}), null, true);
  }
  if (list.length > MAX_IMAGES) {
    throw new ClaudeAdapterError('CLAUDE_BAD_MESSAGE', uiMsg('err.claude.tooManyImages', {count: list.length, max: MAX_IMAGES}), null, true);
  }
  const blocks = [];
  if (cleanText) blocks.push({type: 'text', text: cleanText});
  let totalBytes = textBytes;
  for (let i = 0; i < list.length; i += 1) {
    const image = validateImage(list[i], i);
    totalBytes += image.bytes;
    if (totalBytes > MAX_CONTENT_BYTES) {
      throw new ClaudeAdapterError('CLAUDE_BAD_MESSAGE', uiMsg('err.claude.contentTooBig', {bytes: totalBytes, max: MAX_CONTENT_BYTES}), null, true);
    }
    blocks.push({type: 'image', source: {type: 'base64', media_type: image.mimeType, data: image.data}});
  }
  return {blocks, bytes: totalBytes};
}

module.exports = {
  UUID_RE,
  isUuid,
  errorText,
  asAdapterError,
  normalizeSelectionInput,
  validateImage,
  prepareMessage,
};
