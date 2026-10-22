/* A identidade da chamada é o `toolCallId` do motor (Pi). No MCP `mesa` do
   OpenCode (#57) o servidor MCP não conhece o id da chamada: ele manda um
   `callRef` e a Mesa casa a chamada com o `session.tool.called` do SSE. */
export async function createActivity(bridge, spec, {toolCallId = '', callRef = '', signal} = {}) {
  if (!bridge || typeof bridge.token !== 'string' || !/^http:\/\/127\.0\.0\.1:\d+\/activity$/.test(bridge.url || '')) {
    throw Error('Publicar atividade pelo tutor está disponível na sessão principal da Mesa.');
  }
  const hasCall = typeof toolCallId === 'string' && toolCallId.trim() !== '';
  const hasRef = typeof callRef === 'string' && callRef.trim() !== '';
  if (!hasCall && !hasRef) {
    throw Error('A chamada da atividade não tem identidade; nada foi publicado.');
  }
  const body = {
    title: spec && spec.title,
    objective: spec && spec.objective,
    alternativeMarkdown: spec && spec.alternativeMarkdown,
    html: (spec && spec.html) || '',
    css: (spec && spec.css) || '',
    js: (spec && spec.js) || '',
    katex: spec && spec.katex === true,
    kind: spec && spec.kind === 'visualizacao' ? 'visualizacao' : undefined,
    charts: spec && spec.charts === true,
    activityId: spec && typeof spec.activityId === 'string' ? spec.activityId : undefined,
    toolCallId: hasCall ? toolCallId : '',
    ...(hasRef ? {callRef} : {}),
  };
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) throw Error('Publicação cancelada.');
  signal?.addEventListener('abort', abort, {once: true});
  const timer = setTimeout(abort, 30000);
  try {
    const response = await fetch(bridge.url, {
      method: 'POST',
      headers: {'content-type': 'application/json', 'x-mesa-token': bridge.token},
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data || data.published !== true) {
      throw Error((data && data.error) || 'A Mesa não confirmou a publicação da atividade.');
    }
    return data;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}

/* Prévia do quadro (#42): mesma ponte, mesmo token, rota `/preview`. Nada é
   publicado nem gravado; a Mesa devolve o print, a altura e o console. */
export async function previewActivity(bridge, spec, {signal} = {}) {
  if (!bridge || typeof bridge.token !== 'string' || !/^http:\/\/127\.0\.0\.1:\d+\/activity$/.test(bridge.url || '')) {
    throw Error('A prévia do quadro está disponível na sessão principal da Mesa.');
  }
  const body = {
    title: spec && spec.title, objective: spec && spec.objective, alternativeMarkdown: spec && spec.alternativeMarkdown,
    html: (spec && spec.html) || '', css: (spec && spec.css) || '', js: (spec && spec.js) || '',
    katex: spec && spec.katex === true, charts: spec && spec.charts === true,
    kind: spec && spec.kind === 'visualizacao' ? 'visualizacao' : undefined,
    theme: spec && spec.theme === 'escuro' ? 'escuro' : 'claro',
    width: spec && Number.isFinite(Number(spec.width)) ? Number(spec.width) : undefined,
  };
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) throw Error('Prévia cancelada.');
  signal?.addEventListener('abort', abort, {once: true});
  const timer = setTimeout(abort, 30000);
  try {
    const response = await fetch(bridge.url.replace(/\/activity$/, '/preview'), {
      method: 'POST',
      headers: {'content-type': 'application/json', 'x-mesa-token': bridge.token},
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data || data.previewed !== true) throw Error((data && data.error) || 'A Mesa não conseguiu montar a prévia.');
    return data;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}
