// @ts-check
'use strict';

/* O religar da ponte parada (#chave do Zen, conta de provedor, idioma): quem
   chama decide quando, mas a resposta em curso nunca é interrompida. Fica fora
   do `main.cjs` para o religar ser um só e o arquivo não crescer. */

/**
 * Cria a função que derruba a ponte parada e pede outra conexão.
 * @param {{bridge: () => unknown, toolHost: () => {isBusy: () => Promise<boolean>},
 *   persist: () => void, stopBridge: () => void}} deps
 * @returns {() => Promise<{relinked: boolean, busy?: boolean}>}
 * @example const relink = createTutorRelink({bridge: () => bridge, toolHost: () => toolHost, persist, stopBridge});
 */
function createTutorRelink({bridge, toolHost, persist, stopBridge}) {
  return async () => {
    if (!bridge()) return {relinked: false};
    if (await toolHost().isBusy()) return {relinked: false, busy: true};
    persist();
    stopBridge();
    return {relinked: true};
  };
}

module.exports = {createTutorRelink};
