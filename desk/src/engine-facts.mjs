// @ts-check
/* Fatos do motor da conversa na janela (#57): Claude Code e OpenCode, com o Pi
   antigo só para abrir histórico em somente leitura. Um
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
 * @param {{engine?: unknown, detectedClaude?: unknown, detectedOpenCode?: unknown}|null|undefined} data
 * @returns {boolean}
 * @example engineReady({engine: 'opencode', detectedOpenCode: '/bin/opencode'}) // true
 */
export function engineReady(data) {
  if (!data) return false;
  if (data.engine === 'claude') return !!data.detectedClaude;
  if (data.engine === 'opencode') return !!data.detectedOpenCode;
  return false;
}

/**
 * Os motores visíveis que estão prontos (binário achado), na ordem da vista.
 * A lista visível entra por parâmetro para o teste passar os fakes sem mudar
 * a produção (#87).
 * @param {{detectedClaude?: unknown, detectedOpenCode?: unknown}} data
 * @param {unknown} visible
 * @returns {Array<'claude'|'opencode'>}
 * @example readyVisibleEngines({detectedOpenCode: '/bin/opencode'}, ['opencode']) // ['opencode']
 */
export function readyVisibleEngines(data, visible) {
  const list = Array.isArray(visible) ? visible : [];
  return list.filter((engine) => (engine === 'claude' || engine === 'opencode') && engineReady({engine, detectedClaude: data?.detectedClaude, detectedOpenCode: data?.detectedOpenCode}));
}

/**
 * O outro motor visível e pronto, além do motor da conversa. É a saída de D7=C
 * quando o connect falha: a coluna oferece continuar no motor que já existe,
 * com passagem (#87).
 * @param {{engine?: unknown, detectedClaude?: unknown, detectedOpenCode?: unknown}} data
 * @param {unknown} visible
 * @returns {'claude'|'opencode'|''}
 * @example otherReadyVisibleEngine({engine: 'opencode', detectedClaude: '/bin/claude'}, ['claude','opencode']) // 'claude'
 */
export function otherReadyVisibleEngine(data, visible) {
  return readyVisibleEngines(data, visible).find((engine) => engine !== data?.engine) || '';
}

/**
 * Existe outro motor instalado além do motor da conversa? É o caso de trocar
 * de sessão ao chamar o tutor quando o motor dela sumiu: sem nenhum outro, a
 * chamada continua e mostra o erro do motor que falta (#93).
 * @param {{engine?: unknown, detectedClaude?: unknown, detectedOpenCode?: unknown}|null|undefined} data
 * @returns {boolean}
 * @example otherEngineDetected({engine: 'claude', detectedOpenCode: '/bin/opencode'}) // true
 */
export function otherEngineDetected(data) {
  if (!data) return false;
  const found = {claude: !!data.detectedClaude, opencode: !!data.detectedOpenCode};
  return Object.entries(found).some(([engine, ready]) => ready && engine !== data.engine);
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
 * Capacidade quando o host não mandou a lista: o histórico Pi antigo nasce com
 * tudo; motor nativo nasce fechado. Motor desconhecido nem chega aqui:
 * `applyEngineData` o recusa.
 * @param {unknown} engine
 * @returns {boolean}
 * @example defaultCapability('pi') // true; defaultCapability('opencode') // false
 */
export function defaultCapability(engine) {
  return !isNativeEngine(engine);
}
