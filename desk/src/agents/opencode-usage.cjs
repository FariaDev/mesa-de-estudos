// @ts-check
'use strict';

/* Medidor de contexto do OpenCode v2 → objeto `contextUsage` da Mesa.
 *
 * Contrato medido no opencode v2.0.32: o próprio OpenCode (TUI/ACP) mede o
 * contexto pela ÚLTIMA mensagem `assistant` com `tokens`, depois da última
 * compactação `compaction`/`completed` — no binário, `Er`/`b$(…)`:
 *
 *   tokens  = input + output + reasoning + cache.read + cache.write
 *   percent = Math.round(tokens / limit.context * 100)
 *
 * `limit.context` vem do catálogo (`GET /api/model`), no MESMO modelo da
 * mensagem (`providerID` + `id`). A Mesa usa a mesma conta; nada é inventado:
 * sem mensagem com tokens, sem o modelo no catálogo ou sem `limit.context`,
 * devolve `null` — o medidor não aparece (a capacidade não esconde número).
 *
 * Ordem do fio: `/api/session/:id/message` devolve `order=desc` (nova
 * primeiro). Nessa ordem, a primeira `assistant` com tokens é a mais nova das
 * elegíveis; uma `compaction`/`completed` antes dela desqualifica tudo o que
 * é mais velho (o trecho pós-compactação ainda não tem medição). */

const {isPlainObject} = require('../../plain-object.cjs');

/* `tokens` do fio: {input, output, reasoning, cache:{read, write}}. Só vale com
 * os cinco números; campo ausente ou torto = sem medição (nunca NaN). */
function tokenTotal(tokens) {
  if (!isPlainObject(tokens) || !isPlainObject(tokens.cache)) return null;
  const parts = [tokens.input, tokens.output, tokens.reasoning, tokens.cache.read, tokens.cache.write];
  if (!parts.every((part) => typeof part === 'number' && Number.isFinite(part))) return null;
  return /** @type {number[]} */ (parts).reduce((sum, part) => sum + part, 0);
}

/* A mensagem que o OpenCode usaria: a primeira `assistant` com tokens da página
 * nova-primeiro, desde que nenhuma compactação CONCLUÍDA venha antes dela.
 * `compaction` que ainda roda (ou falhou) não corta o trecho. */
function lastAssistantWithTokens(messages) {
  for (const message of Array.isArray(messages) ? messages : []) {
    if (!isPlainObject(message)) continue;
    if (message.type === 'compaction' && message.status === 'completed') return null;
    if (message.type === 'assistant' && message.tokens !== undefined) return message;
  }
  return null;
}

/* O catálogo chega como `{location, data}` (ou lista crua). */
function modelList(payload) {
  if (Array.isArray(payload)) return payload;
  if (isPlainObject(payload) && Array.isArray(payload.data)) return payload.data;
  return [];
}

/* Uso de contexto da página (nova-primeiro) + catálogo → `{tokens,
 * contextWindow, percent}`, ou `null` sem número real. */
function contextUsage(messages, catalog) {
  const message = lastAssistantWithTokens(messages);
  if (!message || !isPlainObject(message.model)) return null;
  const wanted = message.model;
  const tokens = tokenTotal(message.tokens);
  if (tokens === null || tokens <= 0) return null;
  const model = modelList(catalog).find((candidate) => isPlainObject(candidate)
    && candidate.providerID === wanted.providerID
    && candidate.id === wanted.id);
  const limit = isPlainObject(model) && isPlainObject(model.limit) ? model.limit : {};
  const contextWindow = limit.context;
  if (typeof contextWindow !== 'number' || !Number.isFinite(contextWindow) || contextWindow <= 0) return null;
  return {tokens, contextWindow, percent: Math.round(tokens / contextWindow * 100)};
}

module.exports = {contextUsage, tokenTotal, modelList, lastAssistantWithTokens};
