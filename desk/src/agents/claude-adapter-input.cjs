'use strict';

/* Entrada do ClaudeAdapter, sem I/O de rede: ids, erros, escolha de controles,
   política de caminhos, imagens e mensagem do aluno, e perguntas do
   AskUserQuestion. Saiu do claude-adapter.cjs na #43 fase 2. */

const fs = require('node:fs');
const path = require('node:path');
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

function realpathBestEffort(value) {
  try {
    return typeof fs.realpathSync.native === 'function'
      ? fs.realpathSync.native(value)
      : fs.realpathSync(value);
  } catch {
    const parent = path.dirname(value);
    if (!parent || parent === value) return value;
    return path.join(realpathBestEffort(parent), path.basename(value));
  }
}

function canonicalPath(target, cwd) {
  return realpathBestEffort(path.resolve(cwd || process.cwd(), String(target)));
}

function isInside(child, root) {
  if (child === root) return true;
  return typeof child === 'string' && typeof root === 'string' && child.startsWith(root + path.sep);
}

/* Canonicaliza a política (construtor E setToolPolicy) para que trocar o PDF
   por prompt não reabra caminhos antigos: cada chamada re-resolve readPaths e
   readRoots. `readRoots` vazio cai para o cwd controlado. */
function normalizeToolPolicy(policy, cwd) {
  const readPaths = [];
  const readRoots = [];
  const push = (list, value) => {
    if (typeof value === 'string' && value) list.push(realpathBestEffort(path.resolve(cwd || process.cwd(), value)));
  };
  for (const file of policy?.readPaths || []) push(readPaths, file);
  for (const root of policy?.readRoots || []) push(readRoots, root);
  if (!readRoots.length && cwd) readRoots.push(realpathBestEffort(cwd));
  return {readPaths, readRoots};
}

function extractPathFromInput(toolName, input) {
  if (!input || typeof input !== 'object') return null;
  if (toolName === 'Read') return typeof input.file_path === 'string' ? input.file_path : null;
  if (toolName === 'Glob' || toolName === 'Grep') {
    return typeof input.path === 'string' && input.path ? input.path : null;
  }
  return null;
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

function normalizeUserQuestions(input) {
  if (!Array.isArray(input)) return [];
  const out = [];
  input.forEach((value, index) => {
    if (!value || typeof value !== 'object') return;
    // The CLI looks up answers by its original question text, including spaces.
    const question = typeof value.question === 'string' ? value.question : '';
    if (!question.trim()) return;
    const header = typeof value.header === 'string' && value.header.trim()
      ? value.header.trim()
      : `Pergunta ${index + 1}`;
    const options = [];
    for (const option of Array.isArray(value.options) ? value.options : []) {
      if (!option || typeof option !== 'object') continue;
      const label = typeof option.label === 'string' ? option.label.trim() : '';
      if (!label) continue;
      const normalized = {label, description: typeof option.description === 'string' ? option.description.trim() : ''};
      if (typeof option.preview === 'string' && option.preview) normalized.preview = option.preview;
      options.push(normalized);
    }
    out.push({id: question, header, question, options, multiSelect: value.multiSelect === true});
  });
  return out;
}

/* Respostas estruturadas: chave = texto exato da pergunta; valor string (ou
   lista de strings para multiSelect, juntada com ", " como o CLI espera).
   "Other" é texto livre, então NÃO se exige que a resposta seja uma opção —
   exige-se forma válida, pergunta conhecida e nenhuma pergunta sem resposta. */
function validateQuestionAnswers(questions, answers) {
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
    return {ok: false, code: 'CLAUDE_QUESTION_ANSWERS_INVALID', detail: {reason: 'answers precisa ser objeto'}};
  }
  for (const key of Object.keys(answers)) {
    if (!questions.some((question) => question.question === key)) {
      return {ok: false, code: 'CLAUDE_QUESTION_ANSWERS_UNKNOWN', detail: {question: key}};
    }
  }
  const normalized = {};
  for (const question of questions) {
    if (!Object.prototype.hasOwnProperty.call(answers, question.question)) {
      return {ok: false, code: 'CLAUDE_QUESTION_ANSWERS_MISSING', detail: {question: question.question}};
    }
    const raw = answers[question.question];
    if (Array.isArray(raw) && !question.multiSelect && raw.length > 1) {
      return {ok: false, code: 'CLAUDE_QUESTION_ANSWER_INVALID', detail: {question: question.question, reason: 'escolha única com múltiplas respostas'}};
    }
    const values = Array.isArray(raw) ? raw : [raw];
    const texts = [];
    for (const value of values) {
      if (typeof value !== 'string' || !value.trim()) {
        return {ok: false, code: 'CLAUDE_QUESTION_ANSWER_INVALID', detail: {question: question.question, reason: 'resposta vazia ou não textual'}};
      }
      texts.push(value.trim());
    }
    if (!texts.length) {
      return {ok: false, code: 'CLAUDE_QUESTION_ANSWER_INVALID', detail: {question: question.question, reason: 'resposta vazia'}};
    }
    /* Chave EXATA (inclusive '__proto__'/'constructor'): defineProperty cria
       propriedade PRÓPRIA enumerável — atribuição dispararia o setter de
       protótipo e perderia a resposta. O valor segue string juntada com ", ",
       no formato nativo. */
    Object.defineProperty(normalized, question.question, {
      value: texts.join(', '),
      enumerable: true,
      writable: true,
      configurable: true,
    });
  }
  return {ok: true, answers: normalized};
}

module.exports = {
  UUID_RE,
  isUuid,
  errorText,
  asAdapterError,
  normalizeSelectionInput,
  realpathBestEffort,
  canonicalPath,
  isInside,
  normalizeToolPolicy,
  extractPathFromInput,
  validateImage,
  prepareMessage,
  normalizeUserQuestions,
  validateQuestionAnswers,
};
