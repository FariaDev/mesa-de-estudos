/* Cliente de `listar_materiais` para o Pi e o OpenCode: a mesma ponte local do
   quadro (`LEARNING_DESK_ACTIVITY_BRIDGE`), rota `/materials`. O host recorta
   a matéria/Livre e devolve só os PDFs; o modelo não manda caminho. */

/**
 * @param {{url?: string, token?: string} | null | undefined} bridge concessão da ponte
 * @param {{fetchImpl?: typeof fetch}} [options]
 * @returns {Promise<{materials: Array<{name: string, path: string}>, truncated: boolean}>}
 * @example await listMaterials({url: 'http://127.0.0.1:9/activity', token: 't'})
 */
export async function listMaterials(bridge, {fetchImpl = fetch} = {}) {
  if (!bridge || typeof bridge.token !== 'string' || !/^http:\/\/127\.0\.0\.1:\d+\/activity$/.test(bridge.url || '')) {
    throw Error('Listar materiais está disponível nesta sessão da Mesa.');
  }
  const response = await fetchImpl(String(bridge.url).replace(/\/activity$/, '/materials'), {
    method: 'POST',
    headers: {'content-type': 'application/json', 'x-mesa-token': bridge.token},
    body: '{}',
    signal: AbortSignal.timeout(30000),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data || data.listed !== true) throw Error((data && data.error) || 'A Mesa não conseguiu listar os materiais.');
  return {materials: Array.isArray(data.materials) ? data.materials : [], truncated: data.truncated === true};
}
