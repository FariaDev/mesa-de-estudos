// @ts-check
'use strict';

/* Modelo e esforço de uma conversa OpenCode (#57, porte da branch
   t3/opencode-provider; medido no binário 2.0.32):

     GET  /api/model               {location, data: [{providerID, id, name, variants: [{id}], cost, limit}]}
     POST /api/session             body {…, model: {id, providerID, variant?}}
     POST /api/session/:id/model   body {model}; 204 = aplicado

   A variante do OpenCode é o ESFORÇO do modelo: só os ids que o catálogo
   lista. Sem escolha, nenhum modelo vai no corpo e o servidor usa o padrão.
   Catálogo vazio ou leitura falha: os caps de modelo/esforço continuam
   fechados (nada é inventado) e a próxima leitura tenta de novo. */

const {catalogModels, compileSelection, findModel, levelsFor, modelRef, modelView, normalizeSelection, parseModelKey} = require('./opencode-catalog.cjs');
const {message} = require('../i18n.mjs');

/**
 * @typedef {import('./opencode-catalog.cjs').CatalogModel} CatalogModel
 * @typedef {{model: string|null, effort: string|null}} Selection
 * @typedef {{models: CatalogModel[], levels: string[], selection: Selection, modelSelection: boolean, effort: boolean, autoCompaction: false}} ControlsSnapshot
 */

/**
 * O catálogo e a escolha de uma conversa.
 * @example const controls = new OpenCodeControls({request: client.request, selection: descriptor.selection});
 */
class OpenCodeControls {
  /** @param {{request: () => import('./opencode-http.cjs').OpenCodeClient['request'], selection?: unknown}} options */
  constructor({request, selection}) {
    this.request = request;
    /** @type {Selection} */
    this.selection = normalizeSelection(selection);
    /** @type {CatalogModel[]} */
    this.catalog = [];
  }

  /** O catálogo em cache; só relê quando a leitura anterior veio vazia. @returns {Promise<CatalogModel[]>} */
  async load() {
    if (this.catalog.length) return this.catalog;
    try {
      const response = await this.request()('GET', '/api/model', {timeoutMs: 15000});
      this.catalog = response.ok ? catalogModels(response.payload) : [];
    } catch {
      this.catalog = [];
    }
    return this.catalog;
  }

  /** O `Model.Ref` da escolha, ou null sem escolha (ou com modelo que saiu do catálogo). */
  ref() {
    const parsed = parseModelKey(this.selection.model);
    const found = parsed ? findModel(this.catalog, parsed) : null;
    return found ? modelRef(found, this.selection.effort) : null;
  }

  /** A escolha salva ainda existe? Sem escolha, sempre. @returns {boolean} */
  selectionAvailable() {
    return !this.selection.model || this.ref() !== null;
  }

  /** @returns {{model: {provider: string, id: string, name: string}|null, thinkingLevel: string|null}} */
  view() {
    return {model: modelView(this.catalog, this.selection.model), thinkingLevel: this.selection.effort};
  }

  /** @returns {ControlsSnapshot} */
  snapshot() {
    const models = this.catalog.map((model) => ({...model, variants: [...model.variants]}));
    const levels = levelsFor(this.catalog, this.selection.model);
    return {models, levels, selection: {...this.selection}, modelSelection: models.length > 0, effort: models.length > 0 && levels.length > 0, autoCompaction: false};
  }

  /**
   * Confere a escolha nova contra o catálogo. Variante do modelo antigo que o
   * novo não tem é reinício, não erro; modelo fora do catálogo é recusa antes
   * de qualquer escrita.
   * @param {unknown} wanted
   * @returns {import('./opencode-catalog.cjs').Compiled}
   */
  compile(wanted) {
    const selection = normalizeSelection(wanted);
    const changing = Boolean(selection.model) && selection.model !== this.selection.model;
    const compiled = compileSelection(selection, this.catalog);
    if (!compiled.ok && compiled.reason === 'effort_unknown' && changing) return compileSelection({model: selection.model, effort: null}, this.catalog);
    if (compiled.ok) return compiled;
    const key = compiled.reason === 'model_unknown' || compiled.reason === 'model_invalid' ? 'opencode.controls.modelUnavailable' : 'opencode.controls.effortUnsupported';
    throw Object.assign(Error(message(key, {model: String(selection.model || ''), effort: String(selection.effort || '')})), {notSent: true, reason: compiled.reason});
  }
}

/**
 * A escolha nova a partir do pedido da janela (`pi-settings`): `{provider, id}`
 * vira a chave `provider/id`; trocar o modelo zera o esforço; `default` é sem
 * esforço. O catálogo confere depois, no `compile` do adaptador.
 * @param {Selection} current
 * @param {{model?: unknown, level?: unknown}} change
 * @returns {Selection}
 * @example selectionFromChange({model: null, effort: null}, {model: {provider: 'opencode', id: 'big-pickle'}}) // {model: 'opencode/big-pickle', effort: null}
 */
function selectionFromChange(current, change) {
  const next = {model: current.model || null, effort: current.effort || null};
  if (Object.hasOwn(change, 'model')) {
    const wanted = /** @type {{provider?: unknown, id?: unknown}} */ (change.model && typeof change.model === 'object' ? change.model : {});
    if (typeof wanted.provider !== 'string' || !wanted.provider || typeof wanted.id !== 'string' || !wanted.id) throw Object.assign(Error(message('err.model.notInTutor')), {notSent: true});
    next.model = `${wanted.provider}/${wanted.id}`;
    next.effort = null;
  }
  if (!Object.hasOwn(change, 'level')) return next;
  if (typeof change.level !== 'string' || !change.level) throw Object.assign(Error(message('err.model.effort')), {notSent: true});
  next.effort = change.level === 'default' ? null : change.level;
  return next;
}

module.exports = {OpenCodeControls, selectionFromChange};
