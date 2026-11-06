/* Continuar a sessão em outro motor (#87): uma troca por vez e o aviso do que
   fica na origem (D4=A: fila, rascunho e anexos não viajam). Puro e sem DOM
   para o teste cobrir sem janela; quem chama lê o S e o DOM.
   @example
   import {createSessionSwitch, leftBehind} from './session-switch.mjs';
   const gate = createSessionSwitch();
   const outcome = await gate.run(() => window.desk.newSession({engine}));
   if (outcome.duplicate) toast(t('session.waitCalling')); */

/** Uma troca por vez: o segundo `run` com a troca em voo é recusado, sem criar
 * outro destino. A trava é síncrona (checar e ocupar no mesmo passo), então
 * dois cliques rápidos não passam juntos; ela solta no `finally`, mesmo em
 * falha.
 * @returns {{inFlight: boolean, run: <T>(task: () => Promise<T>) => Promise<{duplicate: boolean, value?: T}>}} */
export function createSessionSwitch() {
  let flight = false;
  return {
    get inFlight() { return flight; },
    async run(task) {
      if (flight) return {duplicate: true};
      flight = true;
      try {
        return {duplicate: false, value: await task()};
      } finally {
        flight = false;
      }
    },
  };
}

/** O que a passagem não leva: fila, rascunho e anexos ficam na conversa
 * antiga e a nova começa vazia. Devolve quais deles estão pendentes para o
 * aviso; vazio é "nada pendente, sem aviso".
 * @param {{queued?: number, draft?: string, attachments?: number}} [state]
 * @returns {('queue'|'draft'|'attachments')[]}
 * @example leftBehind({queued: 1, draft: '  ', attachments: 0}) // ['queue'] */
export function leftBehind({queued = 0, draft = '', attachments = 0} = {}) {
  const kinds = [];
  if (Number(queued) > 0) kinds.push('queue');
  if (String(draft ?? '').trim()) kinds.push('draft');
  if (Number(attachments) > 0) kinds.push('attachments');
  return kinds;
}
