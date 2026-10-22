// Ponte do tutor de mentira para os hosts de IPC (#43 fase 2): responde cada
// método com o valor do roteiro e registra a ordem das chamadas.

/**
 * @param {Record<string, unknown|((params:object)=>unknown)>} script resposta por método
 * @example const bridge = fakeTutorBridge({get_state: {model: null}});
 */
export function fakeTutorBridge(script = {}) {
  const seen = [];
  const responded = [];
  return {
    seen,
    responded,
    uncertain: false,
    isRunning: state => !!state?.isStreaming,
    async request(method, params) {
      seen.push(method);
      const answer = script[method];
      if (answer instanceof Error) throw answer;
      return typeof answer === 'function' ? answer(params) : (answer ?? {});
    },
    respond(payload) { responded.push(payload); return {ok: true}; },
  };
}
