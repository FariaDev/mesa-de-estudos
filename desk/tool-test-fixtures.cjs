'use strict';
/**
 * Avisos de atualização do Claude Code (#45). Os fixtures só existem no modo de
 * teste: versões "mais novas" injetadas, uma pasta de binários falsos
 * (`brew`/`npm`/`claude`) que é a ÚNICA onde o comando é procurado, e o launcher
 * do Claude. Nenhum teste fala com a rede nem roda o `brew` de verdade.
 *
 * @param {boolean} testMode se o app roda em modo de teste
 * @param {NodeJS.ProcessEnv} [env] ambiente de onde ler os fixtures
 * @returns {{latestOverride?: object, searchDirs?: string[], allowRunInTest?: boolean, claudeLauncher?: string}}
 * @example toolTestFixtures(false) // {}
 */
function toolTestFixtures(testMode, env = process.env) {
  if (!testMode) return {};
  const fixtures = {};
  try {
    const latest = JSON.parse(env.LEARNING_DESK_TOOL_LATEST || 'null');
    if (latest && typeof latest === 'object') fixtures.latestOverride = latest;
  } catch { /* fixture inválida: sem versão injetada */ }
  if (env.LEARNING_DESK_TOOL_FAKE_BIN) {
    fixtures.searchDirs = [env.LEARNING_DESK_TOOL_FAKE_BIN];
    fixtures.allowRunInTest = true;
  }
  if (env.LEARNING_DESK_CLAUDE_LAUNCHER !== undefined) fixtures.claudeLauncher = env.LEARNING_DESK_CLAUDE_LAUNCHER;
  return fixtures;
}

module.exports = {toolTestFixtures};
