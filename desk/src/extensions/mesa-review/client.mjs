/* Cliente de `propor_revisao` para o Pi e o OpenCode: a mesma ponte local e o
   mesmo token do quadro, rota `/review-proposal`. O prazo daqui é maior que o
   do host (120 s) para a resposta do aluno chegar antes do fetch desistir. */

const CLIENT_TIMEOUT_MS = 135000

/**
 * @param {{url?: string, token?: string} | null | undefined} bridge concessão (`LEARNING_DESK_ACTIVITY_BRIDGE`)
 * @param {{question?: string, attempt?: string, difficulty?: string}} spec o card, sem caminho
 * @param {{signal?: AbortSignal, timeoutMs?: number}} [options]
 * @returns {Promise<{proposed: true, status: string, saved: boolean, item: object | null, reason?: string}>}
 * @example proposeReview({url: 'http://127.0.0.1:9/activity', token: 't'}, {question: 'Limite'})
 */
export async function proposeReview(bridge, spec, {signal, timeoutMs = CLIENT_TIMEOUT_MS} = {}) {
  if (!bridge || typeof bridge.token !== 'string' || !/^http:\/\/127\.0\.0\.1:\d+\/activity$/.test(bridge.url || '')) {
    throw Error('Propor revisão está disponível na sessão principal da Mesa.')
  }
  const controller = new AbortController()
  const abort = () => controller.abort()
  if (signal?.aborted) throw Error('Proposta cancelada.')
  signal?.addEventListener('abort', abort, {once: true})
  const timer = setTimeout(abort, timeoutMs)
  timer.unref?.()
  try {
    const response = await fetch(String(bridge.url).replace(/\/activity$/, '/review-proposal'), {
      method: 'POST',
      headers: {'content-type': 'application/json', 'x-mesa-token': bridge.token},
      body: JSON.stringify({question: spec?.question, attempt: spec?.attempt, difficulty: spec?.difficulty}),
      signal: controller.signal,
    })
    const data = await response.json().catch(() => null)
    if (!response.ok || !data || data.proposed !== true) throw Error((data && data.error) || 'A Mesa não abriu a proposta de revisão.')
    delete data.items
    return data
  } catch (error) {
    if (error?.name === 'AbortError' && !signal?.aborted) {
      return {proposed: true, status: 'pending', saved: false, item: null, reason: 'timeout'}
    }
    throw error
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', abort)
  }
}
