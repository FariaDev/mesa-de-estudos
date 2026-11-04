/* Cliente de `buscar_material` para o Pi e o OpenCode: a mesma ponte local e o
   mesmo token do quadro (`LEARNING_DESK_ACTIVITY_BRIDGE`), rota `/search`.
   O host recorta a matéria e o texto de PDF; o modelo só manda consulta e limite. */

/**
 * @param {{url?: string, token?: string} | null | undefined} bridge concessão da ponte
 * @param {{consulta?: unknown, limite?: unknown}} args
 * @param {{fetchImpl?: typeof fetch}} [options]
 * @returns {Promise<{query: string, limit: number, short: boolean, truncated: boolean, indexing: boolean, hits: Array<{path: string, name: string, page: number, snippet: string}>}>}
 * @example await searchMaterial({url: 'http://127.0.0.1:9/activity', token: 't'}, {consulta: 'limite'})
 */
export async function searchMaterial(bridge, args, {fetchImpl = fetch} = {}) {
  if (!bridge || typeof bridge.token !== 'string' || !/^http:\/\/127\.0\.0\.1:\d+\/activity$/.test(bridge.url || '')) {
    throw Error('A busca no material está disponível nesta sessão da Mesa.');
  }
  const response = await fetchImpl(String(bridge.url).replace(/\/activity$/, '/search'), {
    method: 'POST',
    headers: {'content-type': 'application/json', 'x-mesa-token': bridge.token},
    body: JSON.stringify({consulta: args?.consulta, limite: args?.limite}),
    signal: AbortSignal.timeout(30000),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data || data.searched !== true) throw Error((data && data.error) || 'A Mesa não conseguiu buscar no material.');
  return data;
}
