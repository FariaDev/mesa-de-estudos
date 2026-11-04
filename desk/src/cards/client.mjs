/* Cliente dos cartões pela ponte da Mesa (#92): valida com a MESMA função dos
   três motores e pede o registro ao host. A ferramenta volta assim que o
   cartão está guardado e mostrado — não espera o aluno. */

import {normalizeAsk, normalizeQuiz} from './input.mjs';

/**
 * @param {{url?: string, token?: string} | null | undefined} bridge concessão da ponte
 * @param {'quiz'|'ask'} kind
 * @param {unknown} args argumentos do modelo
 * @param {{toolCallId?: string, callRef?: string, signal?: AbortSignal, fetchImpl?: typeof fetch}} [options]
 * @returns {Promise<{shown: boolean, id: string, card?: object}>}
 * @example await showCard(grant, 'quiz', {question: '2+2?', options: [{label: '3'}, {label: '4'}], correctAnswer: '4'})
 */
export async function showCard(bridge, kind, args, {toolCallId = '', callRef = '', signal, fetchImpl = fetch} = {}) {
  if (kind === 'quiz') normalizeQuiz(args); else normalizeAsk(args);
  if (!bridge || typeof bridge.token !== 'string' || !/^http:\/\/127\.0\.0\.1:\d+\/activity$/.test(bridge.url || '')) {
    throw Error('Mostrar cartão pelo tutor está disponível na sessão principal da Mesa.');
  }
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) throw Error('Cartão cancelado.');
  signal?.addEventListener('abort', abort, {once: true});
  const timer = setTimeout(abort, 30000);
  try {
    const response = await fetchImpl(String(bridge.url).replace(/\/activity$/, '/card'), {
      method: 'POST',
      headers: {'content-type': 'application/json', 'x-mesa-token': bridge.token},
      body: JSON.stringify({kind, args, toolCallId, ...(callRef ? {callRef} : {})}),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data || data.shown !== true) throw Error((data && data.error) || 'A Mesa não confirmou o cartão.');
    return data;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}
