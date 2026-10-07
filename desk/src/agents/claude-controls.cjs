/* Seleção de modelo e esforço do Claude Code — normalização portátil (Mesa).
 *
 * Módulo PURO: não importa o SDK, não faz I/O, não cria timer, não abre rede e
 * NUNCA inicia consulta/inferência. Ele só transforma dados que o host já tem:
 * o catálogo nativo do SDK pinado (@anthropic-ai/claude-agent-sdk 0.3.246,
 * `Query.supportedModels()` → `ModelInfo[]`, ou
 * `Query.initializationResult()` → `SDKControlInitializeResponse.models`),
 * mais a escolha do usuário persistida no descritor da conversa.
 *
 * Regras conservadoras (fail closed):
 *   - catálogo ausente/vazio/ inválido ⇒ capacidades falsas; modelo nunca é
 *     inventado;
 *   - seleção explícita fora do catálogo nativo ⇒ recusa (inclusive com conta
 *     first-party: nada de modelo de roteador arbitrário);
 *   - esforço só é compilado quando o metadado nativo traz
 *     `supportsEffort === true` E `supportedEffortLevels` não vazio; metadado
 *     ausente DESLIGA o controle — suporte jamais é adivinhado;
 *   - sem seleção, as opções saem vazias: o default nativo do CLI permanece;
 *   - troca de seleção só é permitida com o motor ocioso (sem turno, sem
 *     permissão pendente e sem entrega incerta).
 *
 * Referência conceitual (sem cópia de código): T3 Code, commit
 * 1604ccc9d79f5270fb8e14d60664184bf142c4cb, `apps/server/src/claudeModelOptions.ts`
 * e `apps/server/src/provider/ClaudeModelCatalog.ts` (MIT, T3 Tools Inc.).
 * A implementação abaixo usa os tipos REAIS do SDK pinado, não o catálogo
 * futuro do T3: nenhum nome de modelo é fixado aqui.
 *
 * Contrato do host (o pai liga; este módulo não conhece main/IPC/DOM):
 *   const controls = require('./claude-controls.cjs');
 *   const catalog = await controls.readCatalogFromQuery(query, {account}); // ação explícita do usuário
 *   const view = controls.selectionView(catalog);                          // seletor existente
 *   const compiled = controls.compileSelection(selection, catalog, {account}); // → compiled.options
 *   const gate = controls.canSwitchSelection(facts);                       // busy/incerteza bloqueiam
 */
'use strict';

/* União exata de `EffortLevel`/`ModelInfo.supportedEffortLevels` no SDK 0.3.246. */
const EFFORT_LEVELS = Object.freeze(['low', 'medium', 'high', 'xhigh', 'max']);

const MAX_MODELS = 200;
const MAX_ID = 200;
const MAX_NAME = 200;
const MAX_DESCRIPTION = 1000;
const MAX_PROVIDER = 100;
const MAX_DETAIL = 200;

/* Códigos estáveis de recusa/estado. O host pode mapeá-los para mensagens. */
const REASONS = Object.freeze({
  CATALOG_MISSING: 'catalog_missing',
  CATALOG_EMPTY: 'catalog_empty',
  CATALOG_INVALID: 'catalog_invalid',
  CATALOG_UNAVAILABLE: 'catalog_unavailable',
  SELECTION_INVALID: 'selection_invalid',
  MODEL_UNKNOWN: 'model_unknown',
  MODEL_ROUTER: 'model_router',
  EFFORT_REQUIRES_MODEL: 'effort_requires_model',
  EFFORT_UNSUPPORTED: 'effort_unsupported',
  EFFORT_UNKNOWN: 'effort_unknown',
  EFFORT_UNVERIFIED: 'effort_unverified',
  ACCOUNT_NOT_FIRST_PARTY: 'account_not_first_party',
});

const SWITCH_REASONS = Object.freeze({
  UNCERTAIN: 'delivery_uncertain',
  BUSY: 'engine_busy',
  TURN: 'turn_pending',
  PERMISSION: 'permission_pending',
});

const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

function safeText(value, max) {
  return typeof value === 'string' && value.length > 0 && value.length <= max ? value : null;
}

function safeDetail(value) {
  return typeof value === 'string' && value ? value.slice(0, MAX_DETAIL) : null;
}

/* Só o nome do provedor ativo (sem e-mail/organização/plano): o suficiente para
   decidir se a assinatura é first-party. */
function sanitizeAccountProvider(account) {
  if (!isPlainObject(account)) return null;
  const provider = account.apiProvider;
  if (typeof provider !== 'string') return null;
  const clean = provider.trim();
  return clean && clean.length <= MAX_PROVIDER ? clean : null;
}

/* `true` first-party, `false` outro provedor conhecido, `null` desconhecido. */
function accountFirstParty(account) {
  const provider = sanitizeAccountProvider(account);
  return provider ? provider.toLowerCase() === 'firstparty' : null;
}

/* Heurística estreita de ID de roteador/3P: a assinatura first-party usa ids
   canônicos (`sonnet`, `claude-opus-4-8`), que não têm `/`, `@`, `:` nem
   prefixos de nuvem. Catálogo nativo continua sendo a autoridade; isto é
   defesa em profundidade para a intenção first-party. */
const ROUTER_PREFIX_RE = /^(?:bedrock|vertex|foundry|mantle|gateway|anthropicaws|anthropicgooglecloud)(?:[.:/_-]|$)/i;
const ROUTER_CLOUD_RE = /^(?:arn:|projects\/|(?:us|eu|apac|global)\.anthropic)/i;

function looksLikeRouterModelId(value) {
  if (typeof value !== 'string') return false;
  const clean = value.trim();
  if (!clean) return false;
  if (clean.includes('/') || clean.includes('@') || clean.includes(':')) return true;
  return ROUTER_PREFIX_RE.test(clean) || ROUTER_CLOUD_RE.test(clean);
}

/* Uma linha de `ModelInfo` (SDK 0.3.246) validada e limitada. Campos fora da
   união nativa viram `false`/vazio — nunca "provavelmente suportado". */
function sanitizeModel(raw) {
  if (!isPlainObject(raw)) return null;
  const value = typeof raw.value === 'string' ? raw.value.trim() : '';
  if (!value || value.length > MAX_ID) return null;
  const resolved = typeof raw.resolvedModel === 'string' ? raw.resolvedModel.trim() : '';
  const resolvedModel = resolved && resolved.length <= MAX_ID ? resolved : null;
  const levels = [];
  if (Array.isArray(raw.supportedEffortLevels)) {
    for (const level of raw.supportedEffortLevels) {
      if (typeof level === 'string' && EFFORT_LEVELS.includes(level) && !levels.includes(level)) levels.push(level);
    }
  }
  return Object.freeze({
    value,
    resolvedModel,
    displayName: safeText(raw.displayName, MAX_NAME) ?? value,
    description: safeText(raw.description, MAX_DESCRIPTION) ?? '',
    supportsEffort: raw.supportsEffort === true,
    supportedEffortLevels: Object.freeze(levels),
    supportsAdaptiveThinking: raw.supportsAdaptiveThinking === true,
    supportsFastMode: raw.supportsFastMode === true,
    supportsAutoMode: raw.supportsAutoMode === true,
    routerSuspected: looksLikeRouterModelId(value) || (resolvedModel ? looksLikeRouterModelId(resolvedModel) : false),
  });
}

function emptyCatalog(reason, {account = null, detail = null, dropped = 0} = {}) {
  return Object.freeze({
    ok: false,
    reason,
    models: Object.freeze([]),
    dropped,
    firstParty: accountFirstParty(account),
    accountProvider: sanitizeAccountProvider(account),
    modelSelection: false,
    effort: false,
    detail,
  });
}

/* Aceita o array de `supportedModels()` OU a resposta de
   `initializationResult()` (`{models}`). Qualquer outra forma é inválida. */
function sanitizeCatalog(source, {account = null} = {}) {
  let rawModels = null;
  let reason = null;
  if (Array.isArray(source)) rawModels = source;
  else if (source === null || source === undefined) reason = REASONS.CATALOG_MISSING;
  else if (isPlainObject(source) && Array.isArray(source.models)) rawModels = source.models;
  else reason = REASONS.CATALOG_INVALID;
  if (!reason && rawModels.length === 0) reason = REASONS.CATALOG_EMPTY;
  if (reason) return emptyCatalog(reason, {account});

  const models = [];
  const seen = new Set();
  let dropped = Math.max(0, rawModels.length - MAX_MODELS);
  for (const raw of rawModels.slice(0, MAX_MODELS)) {
    const model = sanitizeModel(raw);
    if (!model || seen.has(model.value)) {
      dropped += 1;
      continue;
    }
    seen.add(model.value);
    models.push(model);
  }
  if (models.length === 0) return emptyCatalog(REASONS.CATALOG_INVALID, {account, dropped});

  return Object.freeze({
    ok: true,
    reason: null,
    models: Object.freeze(models),
    dropped,
    firstParty: accountFirstParty(account),
    accountProvider: sanitizeAccountProvider(account),
    modelSelection: true,
    effort: models.some((model) => model.supportsEffort && model.supportedEffortLevels.length > 0),
    detail: null,
  });
}

/* Resolve por `value` exato, depois por `resolvedModel` (um id explícito
   persistido casa com a linha de alias que o cobre — semântica documentada do
   próprio SDK) e por fim sem diferenciar maiúsculas. */
function resolveCatalogEntry(catalog, value) {
  if (!catalog || catalog.ok !== true || typeof value !== 'string') return null;
  const wanted = value.trim();
  if (!wanted) return null;
  const models = catalog.models;
  const exact = models.find((model) => model.value === wanted);
  if (exact) return exact;
  const canonical = models.find((model) => model.resolvedModel === wanted);
  if (canonical) return canonical;
  const lower = wanted.toLowerCase();
  return models.find((model) => model.value.toLowerCase() === lower)
    ?? models.find((model) => model.resolvedModel && model.resolvedModel.toLowerCase() === lower)
    ?? null;
}

/* Metadado nativo de esforço. `supportsEffort:true` com lista ausente/vazia é
   tratado como indisponível (regra conservadora documentada), não como "usa o
   default do modelo". */
function effortSupport(entry) {
  if (!entry || entry.supportsEffort !== true || !Array.isArray(entry.supportedEffortLevels) || entry.supportedEffortLevels.length === 0) {
    return Object.freeze({supported: false, levels: Object.freeze([]), reason: REASONS.EFFORT_UNSUPPORTED});
  }
  return Object.freeze({supported: true, levels: Object.freeze([...entry.supportedEffortLevels]), reason: null});
}

/* Normaliza um pedido de esforço contra UMA entrada do catálogo. Sem pedido,
   `effort:null` = default nativo. Com pedido e sem metadado ⇒ recusa. */
function normalizeEffort(entry, requested) {
  const support = effortSupport(entry);
  const wanted = typeof requested === 'string' && requested.trim() ? requested.trim() : null;
  if (!support.supported) {
    return Object.freeze({
      ok: wanted === null,
      effort: null,
      levels: support.levels,
      reason: wanted === null ? null : REASONS.EFFORT_UNSUPPORTED,
    });
  }
  if (wanted === null) return Object.freeze({ok: true, effort: null, levels: support.levels, reason: null});
  if (!support.levels.includes(wanted)) {
    return Object.freeze({ok: false, effort: null, levels: support.levels, reason: REASONS.EFFORT_UNKNOWN});
  }
  return Object.freeze({ok: true, effort: wanted, levels: support.levels, reason: null});
}

function compileFailure(reason, detail = null, levels = []) {
  return Object.freeze({
    ok: false,
    reason,
    model: null,
    effort: null,
    options: Object.freeze({}),
    patch: null,
    levels: Object.freeze([...levels]),
    entry: null,
    detail,
  });
}

/* Compila a escolha para as opções NATIVAS da `query()` do SDK pinado
   (`model?: string`, `effort?: EffortLevel`). Sem seleção devolve opções
   vazias — o default do CLI é preservado. `patch` é o que pode ser persistido
   no descritor da conversa (o pai atualiza lá; aqui não há I/O).
 *
 * `firstPartyOnly` (default TRUE): exige que a conta seja first-party quando
 * conhecida, recusa id com cara de roteador e exige presença no catálogo.
 * `allowUnlistedModel` só tem efeito com `firstPartyOnly:false` (experimento
 * de gateway/custom) e NUNCA libera esforço sem metadado verificado. */
function compileSelection(selection, catalog, {account = null, firstPartyOnly = true, allowUnlistedModel = false} = {}) {
  const raw = selection === null || selection === undefined ? {} : selection;
  if (!isPlainObject(raw)) return compileFailure(REASONS.SELECTION_INVALID);
  const model = typeof raw.model === 'string' && raw.model.trim() ? raw.model.trim() : null;
  const effort = typeof raw.effort === 'string' && raw.effort.trim() ? raw.effort.trim() : null;
  if (!model && !effort) {
    return Object.freeze({
      ok: true,
      reason: null,
      model: null,
      effort: null,
      options: Object.freeze({}),
      patch: Object.freeze({model: null, effort: null}),
      levels: Object.freeze([]),
      entry: null,
      detail: null,
    });
  }
  if (firstPartyOnly && accountFirstParty(account) === false) {
    return compileFailure(REASONS.ACCOUNT_NOT_FIRST_PARTY, sanitizeAccountProvider(account));
  }
  if (model && firstPartyOnly && looksLikeRouterModelId(model)) {
    return compileFailure(REASONS.MODEL_ROUTER, safeDetail(model));
  }
  if (!catalog || catalog.ok !== true) {
    return compileFailure(REASONS.CATALOG_UNAVAILABLE, safeDetail(catalog?.reason ?? REASONS.CATALOG_MISSING));
  }
  if (effort && !model) return compileFailure(REASONS.EFFORT_REQUIRES_MODEL);

  const entry = model ? resolveCatalogEntry(catalog, model) : null;
  const unlistedAllowed = allowUnlistedModel === true && firstPartyOnly === false;
  if (model && !entry && !unlistedAllowed) return compileFailure(REASONS.MODEL_UNKNOWN, safeDetail(model));
  const resolvedModel = entry ? entry.value : model;
  const support = effortSupport(entry);
  if (effort) {
    if (!entry) return compileFailure(REASONS.EFFORT_UNVERIFIED, safeDetail(model));
    if (!support.supported) return compileFailure(REASONS.EFFORT_UNSUPPORTED, safeDetail(model));
    if (!support.levels.includes(effort)) return compileFailure(REASONS.EFFORT_UNKNOWN, safeDetail(effort), support.levels);
  }

  return Object.freeze({
    ok: true,
    reason: null,
    model: resolvedModel,
    effort: effort ?? null,
    options: Object.freeze(effort ? {model: resolvedModel, effort} : {model: resolvedModel}),
    patch: Object.freeze({model: resolvedModel, effort: effort ?? null}),
    levels: Object.freeze([...support.levels]),
    entry,
    detail: null,
  });
}

/* Extrai a escolha gravada no descritor da conversa (schemaVersion 1 aceita
   `model`; o pai deve acrescentar `effort` — ver docs de integração). Não
   valida contra catálogo: `compileSelection` faz isso antes de usar/persistir. */
function selectionFromDescriptor(descriptor) {
  const selection = {model: null, effort: null};
  if (!isPlainObject(descriptor)) return selection;
  if (typeof descriptor.model === 'string' && descriptor.model.trim()) selection.model = descriptor.model.trim().slice(0, MAX_ID);
  if (typeof descriptor.effort === 'string' && descriptor.effort.trim()) selection.effort = descriptor.effort.trim().slice(0, MAX_ID);
  return selection;
}

/* Portão de troca: um turno/permissão em andamento ou entrega incerta seguram a
   escolha; ela só é aplicada com o motor ocioso. Nada é iniciado aqui. */
function canSwitchSelection(facts = {}) {
  const state = isPlainObject(facts) ? facts : {};
  if (state.uncertain === true) return Object.freeze({allowed: false, reason: SWITCH_REASONS.UNCERTAIN});
  if (state.busy === true) return Object.freeze({allowed: false, reason: SWITCH_REASONS.BUSY});
  if (state.hasTurn === true) return Object.freeze({allowed: false, reason: SWITCH_REASONS.TURN});
  if (state.pendingPermission === true) return Object.freeze({allowed: false, reason: SWITCH_REASONS.PERMISSION});
  return Object.freeze({allowed: true, reason: null});
}

/* Modelos no formato do seletor que a Mesa já usa no Pi
   (`{provider, id, name}`); provider 'anthropic' é o rótulo exibido. */
function modelsForSelector(catalog, {firstPartyOnly = true} = {}) {
  if (!catalog || catalog.ok !== true) return [];
  const models = firstPartyOnly === false
    ? catalog.models
    : catalog.models.filter((model) => !model.routerSuspected);
  return models.map((model) => Object.freeze({
    provider: 'anthropic',
    id: model.value,
    name: model.displayName,
    description: model.description,
    resolvedModel: model.resolvedModel,
  }));
}

/* Fatos para a UI: seletor e esforço só aparecem com catálogo nativo válido e
   metadado presente. `defaultModel:null` = "default do Claude Code". */
function selectionView(catalog, {firstPartyOnly = true, account = null} = {}) {
  const models = catalog && catalog.ok === true ? modelsForSelector(catalog, {firstPartyOnly}) : [];
  const effort = catalog && catalog.ok === true && (firstPartyOnly === false ? catalog.models : catalog.models.filter((model) => !model.routerSuspected))
    .some((model) => model.supportsEffort && model.supportedEffortLevels.length > 0);
  return Object.freeze({
    modelSelection: models.length > 0,
    effort: effort === true,
    models: Object.freeze(models),
    defaultModel: null,
    firstParty: catalog?.firstParty ?? accountFirstParty(account),
    catalogReason: catalog?.reason ?? null,
  });
}

function effortLevelsFor(catalog, modelValue) {
  const support = effortSupport(resolveCatalogEntry(catalog, modelValue));
  return support.supported ? [...support.levels] : [];
}

/* Leitura única do catálogo nativo a partir de uma Query JÁ existente e
   conectada, em ação explícita do usuário (nunca health em segundo plano).
   Prefere `supportedModels()`; cai para `initializationResult().models` só
   quando o método preferido não existe. Falha vira catálogo indisponível —
   sem retry, sem inventar modelos. */
async function readCatalogFromQuery(query, {account = null} = {}) {
  if (!query || typeof query !== 'object') return sanitizeCatalog(null, {account});
  if (typeof query.supportedModels !== 'function' && typeof query.initializationResult !== 'function') {
    return sanitizeCatalog(null, {account});
  }
  let source;
  try {
    if (typeof query.supportedModels === 'function') {
      source = await query.supportedModels();
    } else {
      const init = await query.initializationResult();
      source = init ? init.models : null;
    }
  } catch (error) {
    return emptyCatalog(REASONS.CATALOG_UNAVAILABLE, {account, detail: safeDetail(typeof error?.code === 'string' ? error.code : null)});
  }
  return sanitizeCatalog(source, {account});
}

module.exports = {
  EFFORT_LEVELS,
  REASONS,
  SWITCH_REASONS,
  MAX_MODELS,
  sanitizeAccountProvider,
  accountFirstParty,
  looksLikeRouterModelId,
  sanitizeCatalog,
  resolveCatalogEntry,
  effortSupport,
  normalizeEffort,
  compileSelection,
  selectionFromDescriptor,
  canSwitchSelection,
  modelsForSelector,
  selectionView,
  effortLevelsFor,
  readCatalogFromQuery,
};
