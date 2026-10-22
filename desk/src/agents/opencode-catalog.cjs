// @ts-check
'use strict';

/* Catálogo de modelos do OpenCode v2.0.32 — normalização pura (sem I/O; #57,
 * porte da branch t3/opencode-provider).
 *
 * Medido no binário 2.0.32 (schema das rotas em `GET /openapi.json` do
 * `opencode serve`):
 *   GET  /api/model             {location, data:[{id, modelID, providerID, name,
 *                                           variants:[{id, settings}], limit}]}
 *   POST /api/session           body {…, model: Model.Ref | null}
 *   POST /api/session/:id/model body {model: Model.Ref}   (204 = aplicado)
 *   Model.Ref = {id: string, providerID: string, variant?: string}
 *
 * A VARIANTE do OpenCode 2 é o esforço do modelo (`reasoningEffort`): só os
 * ids que o catálogo realmente lista. Nível que o modelo não tem não é
 * inventado — nem aqui, nem no seletor.
 *
 * O descritor da conversa (o mesmo do Claude) guarda `model` (a string
 * `providerID/id`, até 400 caracteres) e `effort` (o id da variante, até 24).
 * Variante mais longa que 24 fica DE FORA do catálogo: o schema do descritor
 * não é alargado por causa de um id de terceiro.
 *
 * Módulo PURO: só transforma o payload que o host já tem. Não abre rede, não
 * cria timer e não conhece main/IPC/DOM. */

const MAX_MODELS = 200;
const MAX_PROVIDER = 100;
const MAX_ID = 200;
const MAX_NAME = 200;
const MAX_VARIANTS = 32;
/* O campo `effort` do descritor aceita 24 caracteres (ver `conversations.cjs`). */
const MAX_VARIANT_ID = 24;
/* O campo `model` do descritor aceita 400 caracteres. */
const MAX_MODEL_KEY = 400;

/**
 * @typedef {{provider: string, id: string, name: string, variants: string[], cost?: {input: number, output: number}}} CatalogModel
 * @typedef {{provider: string, id: string}} ModelKey
 * @typedef {{model: string|null, effort: string|null}} Selection
 * @typedef {{id: string, providerID: string, variant?: string}} ModelRef
 * @typedef {{ok: boolean, reason: string|null, model: string|null, effort: string|null, ref: ModelRef|null, levels: string[]}} Compiled
 */

const {isPlainObject} = require('../../plain-object.cjs');

/* O catálogo chega como `{location, data}` (ou lista crua). */
/** @param {unknown} payload @returns {unknown[]} */
function modelList(payload) {
  if (Array.isArray(payload)) return payload;
  if (isPlainObject(payload) && Array.isArray(/** @type {{data?: unknown}} */ (payload).data)) {
    return /** @type {{data: unknown[]}} */ (payload).data;
  }
  return [];
}

/* `providerID/id` — a forma que o descritor da conversa já guarda. */
/** @param {unknown} model @returns {string} */
function modelKey(model) {
  if (!isPlainObject(model)) return '';
  const source = /** @type {{provider?: unknown, id?: unknown}} */ (model);
  const provider = typeof source.provider === 'string' ? source.provider.trim() : '';
  const id = typeof source.id === 'string' ? source.id.trim() : '';
  if (!provider || !id) return '';
  return `${provider}/${id}`;
}

/* A chave volta para `{provider, id}`. O id pode ter `/`: o separador é o
 * PRIMEIRO corte. */
/** @param {unknown} key @returns {ModelKey|null} */
function parseModelKey(key) {
  if (typeof key !== 'string') return null;
  const clean = key.trim();
  if (!clean || clean.length > MAX_MODEL_KEY) return null;
  const cut = clean.indexOf('/');
  if (cut <= 0 || cut === clean.length - 1) return null;
  const provider = clean.slice(0, cut);
  const id = clean.slice(cut + 1);
  if (provider.length > MAX_PROVIDER || id.length > MAX_ID) return null;
  return {provider, id};
}

/* As variantes do modelo: ids únicos, curtos e dentro do teto do descritor. */
/** @param {unknown} raw @returns {string[]} */
function variantList(raw) {
  const out = [];
  for (const item of Array.isArray(raw) ? raw : []) {
    const id = isPlainObject(item)
      ? /** @type {{id?: unknown}} */ (item).id
      : item;
    if (typeof id !== 'string') continue;
    const clean = id.trim();
    if (!clean || clean.length > MAX_VARIANT_ID) continue;
    if (!out.includes(clean)) out.push(clean);
    if (out.length >= MAX_VARIANTS) break;
  }
  return out;
}

/* O preço de entrada e saída, para o seletor marcar o Grátis pelo custo zero
   (medido: o 2.0.32 manda `cost` como lista de faixas; a primeira é a base). */
/** @param {unknown} raw @returns {{input: number, output: number}|null} */
function firstCost(raw) {
  const first = Array.isArray(raw) ? raw[0] : raw;
  if (!isPlainObject(first)) return null;
  const {input, output} = /** @type {{input?: unknown, output?: unknown}} */ (first);
  return typeof input === 'number' && typeof output === 'number' ? {input, output} : null;
}

/** @param {unknown} raw @returns {CatalogModel|null} */
function sanitizeModel(raw) {
  if (!isPlainObject(raw)) return null;
  const source = /** @type {{providerID?: unknown, id?: unknown, modelID?: unknown, name?: unknown, variants?: unknown}} */ (raw);
  const provider = typeof source.providerID === 'string' ? source.providerID.trim() : '';
  const id = typeof source.id === 'string' && source.id.trim()
    ? source.id.trim()
    : (typeof source.modelID === 'string' ? source.modelID.trim() : '');
  if (!provider || provider.length > MAX_PROVIDER) return null;
  if (!id || id.length > MAX_ID) return null;
  const name = typeof source.name === 'string' && source.name.trim() ? source.name.trim().slice(0, MAX_NAME) : id;
  /** @type {CatalogModel} */
  const model = {provider, id, name, variants: variantList(source.variants)};
  const cost = firstCost(/** @type {{cost?: unknown}} */ (raw).cost);
  if (cost) model.cost = cost;
  return model;
}

/* Payload de `GET /api/model` → a lista que o seletor consome. */
/** @param {unknown} payload @returns {CatalogModel[]} */
function catalogModels(payload) {
  const out = [];
  const seen = new Set();
  for (const raw of modelList(payload).slice(0, MAX_MODELS)) {
    const model = sanitizeModel(raw);
    if (!model) continue;
    const key = modelKey(model);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(model);
  }
  return out;
}

/* O modelo pedido existe no catálogo? */
/** @param {CatalogModel[]} models @param {unknown} wanted @returns {CatalogModel|null} */
function findModel(models, wanted) {
  if (!isPlainObject(wanted)) return null;
  const source = /** @type {{provider?: unknown, id?: unknown}} */ (wanted);
  const provider = typeof source.provider === 'string' ? source.provider : '';
  const id = typeof source.id === 'string' ? source.id : '';
  if (!provider || !id) return null;
  for (const model of Array.isArray(models) ? models : []) {
    if (model && model.provider === provider && model.id === id) return model;
  }
  return null;
}

/* O `Model.Ref` que o servidor espera. A variante só entra se o modelo a tem. */
/** @param {unknown} model @param {unknown} effort @returns {ModelRef|null} */
function modelRef(model, effort) {
  if (!isPlainObject(model)) return null;
  const source = /** @type {{provider?: unknown, id?: unknown, variants?: unknown}} */ (model);
  const provider = typeof source.provider === 'string' ? source.provider : '';
  const id = typeof source.id === 'string' ? source.id : '';
  if (!provider || !id) return null;
  /** @type {ModelRef} */
  const ref = {id, providerID: provider};
  if (typeof effort === 'string' && effort && Array.isArray(source.variants) && source.variants.includes(effort)) {
    ref.variant = effort;
  }
  return ref;
}

/* Os níveis (variantes) do modelo escolhido. */
/** @param {CatalogModel[]} models @param {unknown} key @returns {string[]} */
function levelsFor(models, key) {
  const parsed = parseModelKey(key);
  if (!parsed) return [];
  const model = findModel(models, parsed);
  return model ? [...model.variants] : [];
}

/* O modelo escolhido no formato do seletor da Mesa (`{provider, id, name}`). */
/** @param {CatalogModel[]} models @param {unknown} key @returns {{provider: string, id: string, name: string}|null} */
function modelView(models, key) {
  const parsed = parseModelKey(key);
  if (!parsed) return null;
  const model = findModel(models, parsed);
  if (!model) return null;
  return {provider: model.provider, id: model.id, name: model.name};
}

/* A escolha normalizada (strings curtas ou null). */
/** @param {unknown} selection @returns {Selection} */
function normalizeSelection(selection) {
  const raw = isPlainObject(selection) ? selection : {};
  const source = /** @type {{model?: unknown, effort?: unknown}} */ (raw);
  const model = typeof source.model === 'string' ? source.model.trim().slice(0, MAX_MODEL_KEY) : '';
  const effort = typeof source.effort === 'string' ? source.effort.trim().slice(0, MAX_VARIANT_ID) : '';
  return {model: model || null, effort: effort || null};
}

/* A escolha é conferida contra o catálogo: modelo fora do catálogo é RECUSA
 * (nada é escrito no servidor); esforço que o modelo não tem também. */
/** @param {unknown} selection @param {CatalogModel[]} models @returns {Compiled} */
function compileSelection(selection, models) {
  const wanted = normalizeSelection(selection);
  if (!wanted.model && !wanted.effort) {
    return {ok: true, reason: null, model: null, effort: null, ref: null, levels: []};
  }
  if (!wanted.model) {
    return {ok: false, reason: 'effort_requires_model', model: null, effort: null, ref: null, levels: []};
  }
  const parsed = parseModelKey(wanted.model);
  if (!parsed) {
    return {ok: false, reason: 'model_invalid', model: null, effort: null, ref: null, levels: []};
  }
  const model = findModel(models, parsed);
  if (!model) {
    return {ok: false, reason: 'model_unknown', model: wanted.model, effort: null, ref: null, levels: []};
  }
  const levels = [...model.variants];
  if (wanted.effort && !levels.includes(wanted.effort)) {
    return {ok: false, reason: 'effort_unknown', model: wanted.model, effort: null, ref: null, levels};
  }
  return {
    ok: true,
    reason: null,
    model: wanted.model,
    effort: wanted.effort,
    ref: modelRef(model, wanted.effort),
    levels,
  };
}

/* Trocar de modelo zera a variante quando ela não existe no modelo novo: o
 * esforço era do modelo antigo e não é erro — é reinício. */
/** @param {unknown} selection @param {CatalogModel[]} models @returns {Selection} */
function reconcileSelection(selection, models) {
  const wanted = normalizeSelection(selection);
  if (!wanted.model) return {model: null, effort: null};
  const levels = levelsFor(models, wanted.model);
  if (wanted.effort && !levels.includes(wanted.effort)) return {model: wanted.model, effort: null};
  return {model: wanted.model, effort: wanted.effort};
}

module.exports = {
  MAX_MODELS,
  MAX_VARIANT_ID,
  MAX_MODEL_KEY,
  modelList,
  modelKey,
  parseModelKey,
  variantList,
  catalogModels,
  findModel,
  modelRef,
  levelsFor,
  modelView,
  normalizeSelection,
  compileSelection,
  reconcileSelection,
};
