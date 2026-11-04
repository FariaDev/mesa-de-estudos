// @ts-check
'use strict';

/* Quais motores a interface mostra e aceita numa sessão nova (#release OpenCode).
   A decisão do release: só o OpenCode aparece, para todo mundo, mesmo com Pi ou
   Claude Code instalados. O código dos outros motores fica para a remoção do
   próximo release; aqui ele só sai da vista e do uso novo.

   A chave `LEARNING_DESK_VISIBLE_ENGINES` é SÓ de teste: lida apenas com
   `testMode`, como os outros fixtures do repositório. Em produção a lista é
   sempre `['opencode']`. */

const ALL_ENGINES = Object.freeze(['pi', 'claude', 'opencode']);
const ENGINE_NAMES = Object.freeze({pi: 'Pi', claude: 'Claude Code', opencode: 'OpenCode'});

/** @param {unknown} value @returns {string[]} */
function normalizeList(value) {
  const raw = Array.isArray(value) ? value : String(value ?? '').split(',');
  const wanted = new Set(raw.map((item) => String(item).trim().toLowerCase()));
  return ALL_ENGINES.filter((engine) => wanted.has(engine));
}

/**
 * Os motores visíveis. Em produção, só o OpenCode; em teste, a chave
 * `LEARNING_DESK_VISIBLE_ENGINES` (lista separada por vírgula) pode reabrir os
 * fakes. Sem a chave no teste, vale a regra de produção.
 * @param {{testMode?: boolean, env?: NodeJS.ProcessEnv}} [options]
 * @returns {string[]}
 * @example visibleEngines() // ['opencode']
 * @example visibleEngines({testMode: true, env: {LEARNING_DESK_VISIBLE_ENGINES: 'pi,claude,opencode'}}) // ['pi','claude','opencode']
 */
function visibleEngines({testMode = false, env = process.env} = {}) {
  if (!testMode) return ['opencode'];
  if (env.LEARNING_DESK_VISIBLE_ENGINES === undefined) return ['opencode'];
  return normalizeList(env.LEARNING_DESK_VISIBLE_ENGINES);
}

/**
 * O motor aparece na interface?
 * @param {unknown} engine
 * @param {{testMode?: boolean, env?: NodeJS.ProcessEnv}} [options]
 * @returns {boolean}
 * @example engineVisible('pi') // false; engineVisible('opencode') // true
 */
function engineVisible(engine, options) {
  return typeof engine === 'string' && visibleEngines(options).includes(engine);
}

/**
 * O primeiro motor visível e instalado, na ordem de preferência; sem nenhum,
 * OpenCode (o caminho do release).
 * @param {{pi?: string, claude?: string, opencode?: string}} detected
 * @param {{testMode?: boolean, env?: NodeJS.ProcessEnv}} [options]
 * @returns {'pi'|'claude'|'opencode'}
 * @example defaultVisibleEngine({pi: '/p', opencode: '/o'}) // 'opencode'
 */
function defaultVisibleEngine(detected = {}, options) {
  const visible = visibleEngines(options);
  return /** @type {'pi'|'claude'|'opencode'} */ (visible.find((engine) => !!detected[engine]) || 'opencode');
}

/**
 * Zera a detecção dos motores que não aparecem, para telas que só mostram o que
 * está visível (primeira abertura, doctor, componentes e triagem).
 * @param {{pi?: string, claude?: string, opencode?: string, opencodeOld?: string}} detected
 * @param {{testMode?: boolean, env?: NodeJS.ProcessEnv}} [options]
 * @returns {{pi: string, claude: string, opencode: string, opencodeOld?: string}}
 */
function filterDetected(detected = {}, options) {
  const visible = new Set(visibleEngines(options));
  return {
    ...detected,
    pi: visible.has('pi') ? String(detected.pi || '') : '',
    claude: visible.has('claude') ? String(detected.claude || '') : '',
    opencode: visible.has('opencode') ? String(detected.opencode || '') : '',
  };
}

module.exports = {ALL_ENGINES, ENGINE_NAMES, normalizeList, visibleEngines, engineVisible, defaultVisibleEngine, filterDetected};
