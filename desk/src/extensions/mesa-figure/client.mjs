/* Cliente da ferramenta "ver o que desenhei" (#60): a mesma ponte local e o
   mesmo token do quadro (`mesa-activity/client.mjs`), rota `/figure`. Nada é
   publicado nem gravado; a Mesa devolve o print e o resumo. */

/**
 * @param {{url?: string, token?: string} | null | undefined} bridge concessão da ponte (`LEARNING_DESK_ACTIVITY_BRIDGE`)
 * @param {{kind?: string, source?: string, theme?: string, width?: number}} spec
 * @param {{signal?: AbortSignal}} [options]
 * @returns {Promise<any>} `{screenshot, width, theme, contentHeight, plots, svgs, warnings, removed}`
 * @example await viewFigure(bridge, {kind: 'plot', source: 'funcao: x^2'})
 */
export async function viewFigure(bridge, spec, {signal} = {}) {
  if (!bridge || typeof bridge.token !== 'string' || !/^http:\/\/127\.0\.0\.1:\d+\/activity$/.test(bridge.url || '')) {
    throw Error('Ver a figura está disponível na sessão principal da Mesa.');
  }
  const body = {
    kind: spec && spec.kind,
    source: spec && spec.source,
    theme: spec && spec.theme === 'escuro' ? 'escuro' : 'claro',
    width: spec && Number.isFinite(Number(spec.width)) ? Number(spec.width) : undefined,
  };
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) throw Error('Figura cancelada.');
  signal?.addEventListener('abort', abort, {once: true});
  const timer = setTimeout(abort, 30000);
  try {
    const response = await fetch(String(bridge.url).replace(/\/activity$/, '/figure'), {
      method: 'POST',
      headers: {'content-type': 'application/json', 'x-mesa-token': bridge.token},
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data || data.viewed !== true) throw Error((data && data.error) || 'A Mesa não conseguiu desenhar a figura.');
    return data;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}
