// @ts-check
'use strict';

/* Motor padrão quando a conversa ainda não tem um (#93): o Pi continua sendo
   o primeiro da fila para não mudar a máquina de quem já o usa; sem ele, a
   Mesa usa o Claude Code ou o OpenCode que a pessoa já instalou. A escolha é
   só presença de executável — login, versão e modelo continuam sendo
   conferidos depois, pelo adaptador de cada motor. Sem nenhum motor, o padrão
   é o OpenCode, o caminho do release: a primeira abertura instala e o erro de
   conexão fala dele, nunca do Pi. */

const fs = require('node:fs');
const {resolvePi} = require('./pi.cjs');
const {findClaudeLauncher} = require('./src/agents/claude-environment.cjs');
const {findOpenCodeLauncher} = require('./src/agents/opencode-process.cjs');
const {oldOpenCode, readOpenCodeVersionSync} = require('./src/agents/opencode-version.cjs');

/** Ordem de preferência: o motor que já existia primeiro. */
const ENGINE_ORDER = Object.freeze(['pi', 'claude', 'opencode']);
const ENGINE_NAMES = Object.freeze({pi: 'Pi', claude: 'Claude Code', opencode: 'OpenCode'});

/** @param {unknown} file @returns {string} */
function existingFile(file) {
  if (typeof file !== 'string' || !file) return '';
  try { return fs.statSync(file).isFile() ? file : ''; } catch { return ''; }
}

/**
 * O primeiro motor instalado, na ordem de preferência; sem nenhum, `opencode`.
 * @param {{pi?: string, claude?: string, opencode?: string}} detected
 * @returns {'pi'|'claude'|'opencode'}
 * @example defaultEngineFrom({pi: '', claude: '/bin/claude'}) // 'claude'
 */
function defaultEngineFrom(detected = {}) {
  return /** @type {'pi'|'claude'|'opencode'} */ (ENGINE_ORDER.find((engine) => !!detected[engine]) || 'opencode');
}

/**
 * Detecta os motores instalados sem executá-los nem pedir login.
 * Em `testMode` só contam os fakes apontados pelo teste — o binário real do
 * usuário (inclusive o `pi` do PATH) nunca decide o motor de uma janela de
 * teste (#93). Fora dos testes, caminhos configurados, instaladores usuais e
 * PATH valem como sempre.
 * @param {{config?: {piPath?: string, claudePath?: string}, deskDir?: string, env?: NodeJS.ProcessEnv,
 *   home?: string, platform?: NodeJS.Platform, testMode?: boolean}} [options]
 * @returns {{pi: string, claude: string, opencode: string, opencodeOld?: string}}
 * @example detectTutorEngines({env: {LEARNING_DESK_OPENCODE: '/bin/opencode'}}).opencode // '/bin/opencode'
 */
function detectTutorEngines({config = {}, deskDir = '', env = process.env, home = '', platform = process.platform, testMode = false} = {}) {
  const pi = testMode
    ? existingFile(env.LEARNING_DESK_PI)
    : resolvePi({configPath: config.piPath || '', deskDir, envPath: env.LEARNING_DESK_PI || ''});
  const claude = testMode
    ? (env.LEARNING_DESK_CLAUDE_SDK_FACTORY || env.LEARNING_DESK_CLAUDE
      ? findClaudeLauncher({configuredPath: env.LEARNING_DESK_CLAUDE || config.claudePath || '',
        ...(env.LEARNING_DESK_CLAUDE_HOME ? {home: env.LEARNING_DESK_CLAUDE_HOME} : {}), platform})
      : '')
    : findClaudeLauncher({configuredPath: config.claudePath || '', ...(home ? {home} : {}), platform});
  const opencodePath = testMode
    ? existingFile(env.LEARNING_DESK_OPENCODE)
    : findOpenCodeLauncher({envPath: env.LEARNING_DESK_OPENCODE || '', ...(home ? {home} : {}), platform});
  /* A 1.x tem o `serve` v2 incompleto: não conta como motor pronto (#93).
     Versão ilegível não bloqueia; só o 1.x confirmado sai da fila. */
  const opencodeOld = opencodePath && !testMode ? oldOpenCode(readOpenCodeVersionSync(opencodePath)) : null;
  return {...(opencodeOld ? {opencode: '', opencodeOld: opencodeOld.text} : {opencode: opencodePath}), pi, claude};
}

/**
 * O motor padrão de uma Mesa com esta configuração e este ambiente.
 * @param {{config?: {piPath?: string, claudePath?: string}, deskDir?: string, env?: NodeJS.ProcessEnv,
 *   home?: string, platform?: NodeJS.Platform, testMode?: boolean}} [options]
 * @returns {'pi'|'claude'|'opencode'}
 * @example defaultTutorEngine({config: {piPath: ''}, env: {LEARNING_DESK_OPENCODE: '/bin/opencode'}}) // 'opencode'
 */
function defaultTutorEngine(options = {}) {
  return defaultEngineFrom(detectTutorEngines(options));
}

/**
 * Os nomes legíveis dos motores achados, para a primeira abertura e o setup.
 * @param {{pi?: string, claude?: string, opencode?: string}} detected
 * @returns {string[]}
 * @example engineNames({claude: '/bin/claude'}) // ['Claude Code']
 */
function engineNames(detected = {}) {
  return ENGINE_ORDER.filter((engine) => !!detected[engine]).map((engine) => ENGINE_NAMES[engine]);
}

module.exports = {ENGINE_ORDER, ENGINE_NAMES, defaultEngineFrom, detectTutorEngines, defaultTutorEngine, engineNames};
