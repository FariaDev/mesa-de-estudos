// @ts-check
/* Fatos do motor da conversa na janela (#57): Pi, Claude Code e OpenCode. Um
   lugar só para o que antes era `engine==='claude'` espalhado pelo renderer:
   qual motor é conhecido, quais são nativos (descritor, controles do motor),
   se o binário dele foi achado e o esforço padrão. Motor desconhecido não vira
   Pi em silêncio: `knownEngine` devolve null e quem chama recusa. */

export const ENGINES = Object.freeze(['pi', 'claude', 'opencode']);
const NATIVE = Object.freeze(['claude', 'opencode']);

/**
 * O motor, se a Mesa o conhece.
 * @param {unknown} engine
 * @returns {'pi'|'claude'|'opencode'|null}
 * @example knownEngine('opencode') // 'opencode'; knownEngine('x') // null
 */
export function knownEngine(engine) {
  return typeof engine === 'string' && ENGINES.includes(engine) ? /** @type {'pi'|'claude'|'opencode'} */ (engine) : null;
}

/**
 * Motor de uma linha da lista de sessões: nativo fica, o resto é Pi (arquivo JSONL).
 * @param {unknown} engine
 * @returns {'pi'|'claude'|'opencode'}
 * @example sessionEngine('opencode') // 'opencode'; sessionEngine(undefined) // 'pi'
 */
export function sessionEngine(engine) {
  const known = knownEngine(engine);
  return known && known !== 'pi' ? known : 'pi';
}

/**
 * Claude e OpenCode têm descritor e controles do próprio motor.
 * @param {unknown} engine
 * @returns {boolean}
 * @example isNativeEngine('claude') // true; isNativeEngine('pi') // false
 */
export function isNativeEngine(engine) {
  return typeof engine === 'string' && NATIVE.includes(engine);
}

/**
 * O binário do motor da conversa foi achado? Só então a Mesa chama o tutor sozinha.
 * @param {{engine?: unknown, detectedPi?: unknown, detectedClaude?: unknown, detectedOpenCode?: unknown}|null|undefined} data
 * @returns {boolean}
 * @example engineReady({engine: 'opencode', detectedOpenCode: '/bin/opencode'}) // true
 */
export function engineReady(data) {
  if (!data) return false;
  if (data.engine === 'claude') return !!data.detectedClaude;
  if (data.engine === 'opencode') return !!data.detectedOpenCode;
  return !!data.detectedPi;
}

/**
 * Esforço mostrado quando o motor não disse: "Padrão" nos nativos, `off` no Pi.
 * @param {unknown} engine
 * @returns {string}
 * @example defaultEffort('opencode') // 'default'
 */
export function defaultEffort(engine) {
  return isNativeEngine(engine) ? 'default' : 'off';
}

/**
 * Capacidade quando o host não mandou a lista: o Pi (e a janela antes do
 * primeiro dado, que é Pi) nasce com tudo; motor nativo nasce fechado. Motor
 * desconhecido nem chega aqui: `applyEngineData` o recusa.
 * @param {unknown} engine
 * @returns {boolean}
 * @example defaultCapability('pi') // true; defaultCapability('opencode') // false
 */
export function defaultCapability(engine) {
  return !isNativeEngine(engine);
}
