'use strict';

/* Rascunhos da prévia do quadro (auditoria das ferramentas do tutor, A3).
 *
 * A prévia devolve um `previaId` opaco; `criar_atividade` reusa o conteúdo
 * pré-visualizado em vez de recebê-lo de novo. O rascunho vive só na memória
 * do processo principal: nada vai para o disco, e o escopo é a conversa que
 * pediu a prévia.
 *
 * Prazo de 30 minutos: montar, pré-visualizar, corrigir e publicar é uma
 * sequência de turnos no mesmo estudo; meia hora cobre a correção tranquilamente
 * e limita o que fica na memória. O teto de 32 rascunhos (cada um já limitado
 * a 64 KiB pelo normalizador do store) mantém o pior caso em ~2 MiB; o mais
 * antigo sai primeiro. O rascunho é somente leitura aqui: um retry de
 * publicação pode reusar o mesmo id, e revisar com `activityId` continua
 * criando uma versão nova no store. */

const crypto = require('node:crypto');
const {invalidValue} = require('./src/error-detail.mjs');

const DRAFT_TTL_MS = 30 * 60 * 1000;
const MAX_DRAFTS = 32;
const DRAFT_ID = /^prv-[a-z0-9]{8,24}$/;
const CONTENT_FIELDS = ['html', 'css', 'js', 'katex', 'kind', 'charts'];

/** @param {unknown} value @returns {boolean} */
function isDraftId(value) {
  return typeof value === 'string' && DRAFT_ID.test(value);
}

/* Só o conteúdo que a publicação reusa; título, objetivo e o texto alternativo
   continuam vindo da chamada de publicação (o guia manda reenviá-los). */
function contentOf(spec) {
  const content = {};
  for (const name of CONTENT_FIELDS) {
    if (spec && spec[name] !== undefined) content[name] = spec[name];
  }
  return content;
}

/**
 * Cria o registro em memória dos rascunhos de prévia.
 * @param {{ttlMs?: number, max?: number, now?: () => number}} [options]
 * @returns {{
 *   remember: (scope: {conversationId?: string} | undefined, spec: object) => string,
 *   resolve: (scope: {conversationId?: string} | undefined, previewId: string) => object | null,
 *   clear: () => void,
 *   size: () => number,
 * }}
 * @example
 * const drafts = createActivityPreviewDrafts();
 * const id = drafts.remember({conversationId: 'conversa'}, {html: '<p>x</p>'});
 * drafts.resolve({conversationId: 'conversa'}, id).html // '<p>x</p>'
 */
function createActivityPreviewDrafts({ttlMs = DRAFT_TTL_MS, max = MAX_DRAFTS, now = Date.now} = {}) {
  if (!Number.isFinite(ttlMs) || ttlMs <= 0) throw new Error(invalidValue('ttlMs', ttlMs, 'número positivo'));
  if (!Number.isInteger(max) || max < 1) throw new Error(invalidValue('max', max, 'inteiro positivo'));
  /** @type {Map<string, {conversationId: string, content: object, at: number}>} */
  const drafts = new Map();
  const prune = () => {
    const at = now();
    for (const [id, draft] of drafts) {
      if (at - draft.at > ttlMs) drafts.delete(id);
    }
    while (drafts.size > max) drafts.delete(drafts.keys().next().value);
  };
  const conversationOf = (scope) => (scope && typeof scope.conversationId === 'string' && scope.conversationId.trim() ? scope.conversationId : '');
  return {
    remember(scope, spec) {
      const conversationId = conversationOf(scope);
      if (!conversationId) throw new Error(invalidValue('scope.conversationId', scope?.conversationId, 'string não vazia'));
      prune();
      let id;
      do {
        id = `prv-${crypto.randomBytes(6).toString('hex')}`;
      } while (drafts.has(id));
      drafts.set(id, {conversationId, content: contentOf(spec), at: now()});
      prune();
      return id;
    },
    resolve(scope, previewId) {
      if (!isDraftId(previewId)) return null;
      const draft = drafts.get(previewId);
      if (!draft) return null;
      if (now() - draft.at > ttlMs) {
        drafts.delete(previewId);
        return null;
      }
      if (draft.conversationId !== conversationOf(scope)) return null;
      return {...draft.content};
    },
    clear() { drafts.clear(); },
    size() { return drafts.size; },
  };
}

module.exports = {DRAFT_TTL_MS, MAX_DRAFTS, isDraftId, createActivityPreviewDrafts};
