// @ts-check
'use strict';

/* Config da pessoa no OpenCode 2.x (#93). O `OPENCODE_CONFIG_DIR` da Mesa
   esconde o config global dela; foi assim que a #91 fechou shell/edit/read. A
   Mesa não pode reabrir o config inteiro para trazer provider e modelo, então
   lê só a lista permitida (`provider`, `model`, `small_model`) e descarta o
   resto — inclusive chave desconhecida. O `auth.json` fica onde o OpenCode o
   guarda (a Mesa não copia credencial): o servidor continua autenticando os
   providers da pessoa pelo ambiente dela.

   O parceiro de leitura é o 2.2.4: `opencode.json[c]` no diretório global
   (XDG/config do macOS/AppData do Windows), mais o arquivo de
   `OPENCODE_CONFIG` e o JSON de `OPENCODE_CONFIG_CONTENT`, se a pessoa os
   definiu. O config do projeto (`.opencode/` e `opencode.json` da pasta) não
   entra: o servidor sobe com `OPENCODE_DISABLE_PROJECT_CONFIG=1`. */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

/** As únicas chaves que definem provider e modelo. Lista permitida. */
const PERSONAL_KEYS = Object.freeze(['provider', 'model', 'small_model']);

/* Lista permitida em toda a árvore de `provider` (#93). `options` vira corpo
   da requisição no 2.2.4, então chave desconhecida nunca é copiada: um
   `instructions`/`system`/`prompt` ali chegaria ao modelo. O schema do 2.2.4
   define estas chaves de catálogo e conexão; o que não estiver aqui sai. */
const PROVIDER_KEYS = Object.freeze([
  'api', 'name', 'env', 'id', 'npm', 'whitelist', 'blacklist', 'options', 'models',
]);
const PROVIDER_OPTION_KEYS = Object.freeze([
  'baseURL', 'apiKey', 'headers', 'timeout', 'headerTimeout', 'chunkTimeout', 'setCacheKey',
  'enterpriseUrl', 'region', 'profile', 'project', 'location',
]);
const MODEL_KEYS = Object.freeze([
  'id', 'name', 'family', 'release_date', 'attachment', 'reasoning', 'temperature', 'tool_call',
  'interleaved', 'cost', 'limit', 'modalities', 'experimental', 'status', 'provider', 'headers',
  'options', 'variants',
]);
/* Ajuste de geração: o que pode ir no corpo de uma chamada sem virar
   instrução, ferramenta ou plugin. Vale para `models.<id>.options` e
   `models.<id>.variants.*`. */
const MODEL_OPTION_KEYS = Object.freeze([
  'temperature', 'topP', 'topK', 'maxOutputTokens', 'reasoningEffort', 'reasoningSummary',
  'textVerbosity', 'thinking', 'thinkingConfig',
]);
const VARIANT_KEYS = Object.freeze(['disabled', ...MODEL_OPTION_KEYS]);
const MODEL_PROVIDER_KEYS = Object.freeze(['npm', 'api', 'shape']);
const SDK_NPM = /^@ai-sdk\/[A-Za-z0-9._-]+$/;

/**
 * A pasta global de config do OpenCode, a mesma que o 2.2.4 resolve.
 * @param {{env?: Record<string, string|undefined>, home?: string, platform?: NodeJS.Platform}} [options]
 * @returns {string}
 * @example personalConfigDirectory({env: {XDG_CONFIG_HOME: '/cfg'}, platform: 'linux'}) // '/cfg/opencode'
 */
function personalConfigDirectory({env = process.env, home = os.homedir(), platform = process.platform} = {}) {
  const configured = typeof env.OPENCODE_CONFIG_DIR === 'string' ? env.OPENCODE_CONFIG_DIR.trim() : '';
  if (configured) return path.resolve(configured);
  if (platform === 'win32') {
    const appData = env.APPDATA || path.join(home, 'AppData', 'Roaming');
    return path.join(appData, 'opencode');
  }
  /* O binário 2.2.4/2.2.5 lê `$XDG_CONFIG_HOME/opencode` e, sem XDG, também
     `~/.config/opencode` no macOS (medido com `debug config`): não é
     `~/Library/Application Support`. Seguir o binário evita a Mesa ler um
     provider que o servidor não vê. */
  return path.join(env.XDG_CONFIG_HOME || path.join(home, '.config'), 'opencode');
}

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function plainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

/* Tira comentários de linha e de bloco fora de string; o 2.2.4 aceita JSONC. */
/** @param {string} source */
function stripComments(source) {
  let out = '';
  let quoted = false;
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    const next = source[i + 1];
    if (quoted) {
      out += char;
      if (char === '\\') { out += source[i + 1] ?? ''; i += 1; continue; }
      if (char === '"') quoted = false;
      continue;
    }
    if (char === '"') { quoted = true; out += char; continue; }
    if (char === '/' && next === '/') {
      while (i < source.length && source[i] !== '\n') i += 1;
      out += '\n';
      continue;
    }
    if (char === '/' && next === '*') {
      i += 2;
      while (i < source.length && !(source[i] === '*' && source[i + 1] === '/')) i += 1;
      i += 1;
      continue;
    }
    out += char;
  }
  return out;
}

/* Tira a vírgula final antes de `}`/`]`, também fora de string. */
/** @param {string} source */
function stripTrailingCommas(source) {
  let out = '';
  let quoted = false;
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (quoted) {
      out += char;
      if (char === '\\') { out += source[i + 1] ?? ''; i += 1; continue; }
      if (char === '"') quoted = false;
      continue;
    }
    if (char === '"') { quoted = true; out += char; continue; }
    if (char === ',') {
      let j = i + 1;
      while (j < source.length && /\s/.test(source[j])) j += 1;
      if (source[j] === '}' || source[j] === ']') continue;
    }
    out += char;
  }
  return out;
}

/**
 * Lê JSONC (comentários e vírgula final) sem dependência nova.
 * @param {string} source
 * @returns {unknown} `undefined` quando o texto não é JSON legível
 * @example parseJsonc('{ // oi\n "model": "a/b", }') // {model: 'a/b'}
 */
function parseJsonc(source) {
  try { return JSON.parse(stripTrailingCommas(stripComments(String(source ?? '')))); } catch { return undefined; }
}

/** @param {unknown} value @returns {unknown} */
function clone(value) {
  if (Array.isArray(value)) return value.map(clone);
  if (!plainObject(value)) return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clone(item)]));
}

/* `provider` soma entre arquivos; `model`/`small_model` seguem a precedência
   do último arquivo lido (explícito > jsonc > json global). */
/** @param {Record<string, unknown>} target @param {Record<string, unknown>} source */
function mergeProvider(target, source) {
  if (!plainObject(source)) return;
  const merged = plainObject(target.provider) ? /** @type {Record<string, unknown>} */ (target.provider) : {};
  for (const [id, entry] of Object.entries(source)) {
    if (!plainObject(entry) || !plainObject(merged[id])) { merged[id] = clone(entry); continue; }
    merged[id] = deepMerge(/** @type {Record<string, unknown>} */ (merged[id]), entry);
  }
  target.provider = merged;
}

/** @param {Record<string, unknown>} left @param {Record<string, unknown>} right */
function deepMerge(left, right) {
  const out = /** @type {Record<string, unknown>} */ (clone(left));
  for (const [key, value] of Object.entries(right)) {
    if (plainObject(value) && plainObject(out[key])) out[key] = deepMerge(/** @type {Record<string, unknown>} */ (out[key]), value);
    else out[key] = clone(value);
  }
  return out;
}

/* Copia só as chaves permitidas e registra o NOME do que saiu. O valor nunca
   entra no log: a config da pessoa pode ter segredo em qualquer campo. */
/** @param {Record<string, unknown>} source @param {readonly string[]} allowed @param {string} where @param {(area: string, line: string) => void} log */
function pickKeys(source, allowed, where, log) {
  /** @type {Record<string, unknown>} */
  const out = {};
  const keep = new Set(allowed);
  for (const [key, value] of Object.entries(source)) {
    if (keep.has(key)) { out[key] = clone(value); continue; }
    log('opencode', `config da pessoa: chave fora da lista ignorada em ${where}: ${key}`);
  }
  return out;
}

/** @param {unknown} raw @param {readonly string[]} allowed @param {string} where @param {(area: string, line: string) => void} log */
function sanitizeOptions(raw, allowed, where, log) {
  if (!plainObject(raw)) return undefined;
  const out = pickKeys(/** @type {Record<string, unknown>} */ (raw), allowed, where, log);
  return Object.keys(out).length ? out : undefined;
}

/* `provider.api` e `provider.env` com tipo errado fazem o 2.2.4 descartar o
   provider inteiro (medido: string no lugar da lista e objeto no lugar da
   string). Valor válido é mantido; tipo inválido sai com o nome no log. */
/** @param {Record<string, unknown>} out @param {string} where @param {(area: string, line: string) => void} log */
function dropBadProviderTypes(out, where, log) {
  for (const key of ['api', 'id', 'name']) {
    if (out[key] !== undefined && typeof out[key] !== 'string') {
      log('opencode', `config da pessoa: tipo inválido em ${where}: ${key}`);
      delete out[key];
    }
  }
  for (const key of ['env', 'whitelist', 'blacklist']) {
    if (out[key] === undefined) continue;
    const value = out[key];
    if (Array.isArray(value) && value.every((item) => typeof item === 'string')) continue;
    log('opencode', `config da pessoa: tipo inválido em ${where}: ${key}`);
    delete out[key];
  }
}

/** @param {unknown} raw @param {string} where @param {(area: string, line: string) => void} log */
function sanitizeConnectionOptions(raw, where, log) {
  const out = sanitizeOptions(raw, PROVIDER_OPTION_KEYS, where, log);
  if (!out) return undefined;
  for (const key of ['timeout', 'headerTimeout', 'chunkTimeout']) {
    if (out[key] !== undefined && typeof out[key] !== 'number' && out[key] !== false) {
      log('opencode', `config da pessoa: tipo inválido em ${where}: ${key}`);
      delete out[key];
    }
  }
  if (out.setCacheKey !== undefined && typeof out.setCacheKey !== 'boolean') {
    log('opencode', `config da pessoa: tipo inválido em ${where}: setCacheKey`);
    delete out.setCacheKey;
  }
  for (const key of ['baseURL', 'apiKey', 'enterpriseUrl', 'region', 'profile', 'project', 'location']) {
    if (out[key] !== undefined && typeof out[key] !== 'string') {
      log('opencode', `config da pessoa: tipo inválido em ${where}: ${key}`);
      delete out[key];
    }
  }
  if (out.headers !== undefined) {
    if (!plainObject(out.headers)) {
      log('opencode', `config da pessoa: tipo inválido em ${where}: headers`);
      delete out.headers;
    } else {
      out.headers = Object.fromEntries(Object.entries(out.headers).filter(([, value]) => typeof value === 'string'));
    }
  }
  return Object.keys(out).length ? out : undefined;
}

/** @param {unknown} raw @param {string} where @param {(area: string, line: string) => void} log */
function sanitizeVariants(raw, where, log) {
  if (!plainObject(raw)) return undefined;
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const [id, value] of Object.entries(raw)) {
    if (!plainObject(value)) { log('opencode', `config da pessoa: variante ignorada em ${where}: ${id}`); continue; }
    const variant = pickKeys(/** @type {Record<string, unknown>} */ (value), VARIANT_KEYS, `${where}.${id}`, log);
    if (Object.keys(variant).length) out[id] = variant;
  }
  return Object.keys(out).length ? out : undefined;
}

/** @param {unknown} raw @param {string} where @param {(area: string, line: string) => void} log */
function sanitizeModelProvider(raw, where, log) {
  if (raw === undefined) return undefined;
  if (!plainObject(raw)) { log('opencode', `config da pessoa: tipo inválido em ${where}: provider`); return undefined; }
  const out = pickKeys(/** @type {Record<string, unknown>} */ (raw), MODEL_PROVIDER_KEYS, `${where}.provider`, log);
  for (const key of MODEL_PROVIDER_KEYS) {
    if (out[key] !== undefined && typeof out[key] !== 'string') {
      log('opencode', `config da pessoa: tipo inválido em ${where}.provider: ${key}`);
      delete out[key];
    }
  }
  return Object.keys(out).length ? out : undefined;
}

/** @param {unknown} raw @param {string} where @param {(area: string, line: string) => void} log */
function sanitizeModel(raw, where, log) {
  if (!plainObject(raw)) { log('opencode', `config da pessoa: modelo ignorado em ${where}`); return undefined; }
  /* O 2.2.4 também carrega `models.<id>.provider.npm` (medido no binário): sem
     este corte, o limite de pacote do provider seria contornado pelo modelo. */
  const npm = plainObject(raw.provider) ? raw.provider.npm : undefined;
  if (npm !== undefined && (typeof npm !== 'string' || !SDK_NPM.test(npm))) {
    log('opencode', `config da pessoa: modelo fora de @ai-sdk/* descartado em ${where}: provider.npm`);
    return undefined;
  }
  const out = pickKeys(/** @type {Record<string, unknown>} */ (raw), MODEL_KEYS, where, log);
  const modelProvider = sanitizeModelProvider(raw.provider, where, log);
  if (modelProvider) out.provider = modelProvider;
  else delete out.provider;
  const options = sanitizeOptions(raw.options, MODEL_OPTION_KEYS, `${where}.options`, log);
  const variants = sanitizeVariants(raw.variants, `${where}.variants`, log);
  if (options) out.options = options;
  else delete out.options;
  if (variants) out.variants = variants;
  else delete out.variants;
  return out;
}

/** @param {unknown} raw @param {string} where @param {(area: string, line: string) => void} log */
function sanitizeProviderEntry(raw, where, log) {
  if (!plainObject(raw)) { log('opencode', `config da pessoa: provider ignorado em ${where}`); return undefined; }
  const npm = raw.npm;
  /* Pacote arbitrário roda dentro do servidor da Mesa: fora de @ai-sdk/*, o
     provider inteiro sai. O nome do pacote é registro, não segredo. */
  if (npm !== undefined && (typeof npm !== 'string' || !SDK_NPM.test(npm))) {
    log('opencode', `config da pessoa: provider fora de @ai-sdk/* descartado em ${where}: npm`);
    return undefined;
  }
  const out = pickKeys(/** @type {Record<string, unknown>} */ (raw), PROVIDER_KEYS, where, log);
  dropBadProviderTypes(out, where, log);
  const options = sanitizeConnectionOptions(raw.options, `${where}.options`, log);
  if (options) out.options = options;
  else delete out.options;
  if (plainObject(raw.models)) {
    /** @type {Record<string, unknown>} */
    const models = {};
    for (const [id, model] of Object.entries(raw.models)) {
      const clean = sanitizeModel(model, `${where}.models.${id}`, log);
      if (clean) models[id] = clean;
    }
    if (Object.keys(models).length) out.models = models;
    else delete out.models;
  } else delete out.models;
  return out;
}

/** @param {unknown} raw @param {(area: string, line: string) => void} log */
function sanitizeProviders(raw, log) {
  if (!plainObject(raw)) return undefined;
  /** @type {Record<string, unknown>} */
  const providers = {};
  for (const [id, entry] of Object.entries(raw)) {
    const clean = sanitizeProviderEntry(entry, `provider.${id}`, log);
    if (clean) providers[id] = clean;
  }
  return Object.keys(providers).length ? providers : undefined;
}

/**
 * A parte permitida de um config já parseado.
 * @param {unknown} raw
 * @param {{log?: (area: string, line: string) => void}} [options]
 * @returns {{provider?: Record<string, unknown>, model?: string, small_model?: string}}
 * @example sanitizePersonalConfig({model: 'a/b', permission: {shell: 'allow'}}) // {model: 'a/b'}
 */
function sanitizePersonalConfig(raw, {log = () => {}} = {}) {
  const source = plainObject(raw) ? raw : {};
  /** @type {{provider?: Record<string, unknown>, model?: string, small_model?: string}} */
  const out = {};
  const provider = sanitizeProviders(source.provider, log);
  if (provider) out.provider = provider;
  if (typeof source.model === 'string' && source.model.trim()) out.model = source.model.trim();
  if (typeof source.small_model === 'string' && source.small_model.trim()) out.small_model = source.small_model.trim();
  return out;
}

/** @param {string} file @returns {string} */
function readText(file) {
  try { return fs.readFileSync(file, 'utf8'); } catch { return ''; }
}

/** @param {unknown} value @returns {value is string} */
function nonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== '';
}

/**
 * O config da pessoa que a Mesa pode herdar: provider e modelo, e só.
 * @param {{env?: Record<string, string|undefined>, home?: string, platform?: NodeJS.Platform, log?: (area: string, line: string) => void}} [options]
 * @returns {{provider?: Record<string, unknown>, model?: string, small_model?: string}}
 * @example readPersonalConfig({env: {HOME: '/home/ana'}}) // {model: 'opencode-go/…', provider: {…}}
 */
function readPersonalConfig({env = process.env, home = os.homedir(), platform = process.platform, log = () => {}} = {}) {
  const directory = personalConfigDirectory({env, home, platform});
  /** @type {string[]} */
  const files = [path.join(directory, 'opencode.json'), path.join(directory, 'opencode.jsonc')];
  if (nonEmptyString(env.OPENCODE_CONFIG)) files.push(path.resolve(env.OPENCODE_CONFIG));
  /** @type {Record<string, unknown>} */
  const personal = {};
  for (const file of files) {
    const text = readText(file);
    if (!text) continue;
    const allowed = sanitizePersonalConfig(parseJsonc(text), {log});
    mergeProvider(personal, allowed.provider || {});
    if (allowed.model) personal.model = allowed.model;
    if (allowed.small_model) personal.small_model = allowed.small_model;
  }
  if (nonEmptyString(env.OPENCODE_CONFIG_CONTENT)) {
    const allowed = sanitizePersonalConfig(parseJsonc(env.OPENCODE_CONFIG_CONTENT), {log});
    mergeProvider(personal, allowed.provider || {});
    if (allowed.model) personal.model = allowed.model;
    if (allowed.small_model) personal.small_model = allowed.small_model;
  }
  return sanitizePersonalConfig(personal, {log});
}

module.exports = {PERSONAL_KEYS, PROVIDER_KEYS, PROVIDER_OPTION_KEYS, MODEL_KEYS, MODEL_OPTION_KEYS, VARIANT_KEYS, personalConfigDirectory, parseJsonc, readPersonalConfig, sanitizePersonalConfig};
