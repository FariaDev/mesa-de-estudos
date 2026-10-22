// @ts-check
'use strict';

/* Medidor de contexto do ClaudeAdapter (#58). Guarda a amostra (uso da
   última resposta + modelo que respondeu) e a janela do `modelUsage` do
   `result`; a conta é de `claude-usage.cjs`. São fatos da CONVERSA, não da
   Query: valem depois que o turno acaba. Métodos instalados no protótipo pelo
   claude-adapter.cjs. */

const usageMod = require('./claude-usage.cjs');

/* A classe só leva métodos; o tipo do adaptador montado vem de
   `types/claude-adapter-host.d.ts`. `Object` não entra no que é copiado. */
const AdapterBase = /** @type {new () => import('../../types/claude-adapter-host').ClaudeAdapterHost} */ (/** @type {unknown} */ (Object));

class ClaudeAdapterMeter extends AdapterBase {
  /**
   * Uso real da última resposta contra a janela nativa do modelo; null sem
   * número real (o medidor some).
   * @returns {Promise<import('./claude-usage.cjs').ContextUsage|null>}
   * @example await adapter.sessionUsage() // {tokens: 1200, contextWindow: 200000, percent: 1}
   */
  async sessionUsage() {
    if (!this._usageSample) return null;
    return usageMod.contextUsage({...this._usageSample, modelUsage: this._modelUsage});
  }

  /* Resposta sem uso não troca a amostra; uso com campo torto a APAGA. */
  /** @param {unknown} raw @param {object|null} usage @param {string|null} model */
  _noteUsageSample(raw, usage, model) {
    if (raw && !usageMod.isSaneUsage(raw)) this._usageSample = null;
    else if (usage) this._usageSample = {usage, model};
  }

  /* A janela é fato do MODELO: entra de qualquer `result`, mesmo de outro
     envio, e o último lido vale. */
  /** @param {any} message */
  _noteModelUsage(message) {
    const value = message?.modelUsage;
    if (value && typeof value === 'object' && !Array.isArray(value)) this._modelUsage = value;
  }

  _resetUsageSample() {
    this._usageSample = null;
  }
}

module.exports = {ClaudeAdapterMeter};
