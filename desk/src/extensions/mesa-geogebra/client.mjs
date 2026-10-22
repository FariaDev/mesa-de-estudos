import {readFileSync} from 'node:fs';

/* Cliente da ponte local do GeoGebra para o Pi: a Mesa publica `{port, token}`
   num arquivo (LEARNING_DESK_GGB_BRIDGE) e este lado só lê e chama. O prazo é
   maior que o da Mesa (abrir a aba e esperar o applet), para a Mesa errar
   primeiro e dizer o motivo em uma frase. */
const REQUEST_TIMEOUT_MS = 45000;

/* Código do erro "ponte fechada": quem chama o traduz para o idioma do tutor. */
export const BRIDGE_CLOSED = 'BRIDGE_CLOSED';

function readBridge(bridgeFile) {
  const raw = JSON.parse(readFileSync(bridgeFile, 'utf8'));
  if (typeof raw?.port !== 'number' || typeof raw?.token !== 'string') throw Error('arquivo da ponte inválido');
  return raw;
}

/**
 * @param {string} bridgeFile caminho do `ggb-bridge.json`
 * @param {'run'|'state'|'screenshot'} action
 * @param {{command?: string, continuar?: boolean}} params
 * @param {AbortSignal} [signal]
 * @returns {Promise<{ok?: boolean, error?: string, state?: object, board?: object, png?: string}>}
 */
export async function callGeogebra(bridgeFile, action, params, signal) {
  let bridge;
  try { bridge = readBridge(bridgeFile); } catch { throw Object.assign(Error('a Mesa não está com a ponte do GeoGebra aberta'), {code: BRIDGE_CLOSED}); }
  const controller = new AbortController();
  const abort = () => controller.abort();
  const timer = setTimeout(abort, REQUEST_TIMEOUT_MS);
  signal?.addEventListener('abort', abort, {once: true});
  try {
    const response = await fetch(`http://127.0.0.1:${bridge.port}/${action}`, {
      method: 'POST',
      headers: {'content-type': 'application/json', 'x-desk-token': bridge.token},
      body: JSON.stringify({command: params?.command, continuar: params?.continuar === true}),
      signal: controller.signal,
    });
    const data = await response.json();
    if (!response.ok) throw Error(String(data?.error || `HTTP ${response.status}`));
    return data;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}
