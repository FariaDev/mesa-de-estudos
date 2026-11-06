// @ts-check
'use strict';

/* Guarda dos desfechos tardios do adaptador OpenCode (#57), em duas frentes.

   - Ligação: `stop()` invalida o `bind()` em voo para ele não instalar
     `lease`/`client` nem abrir sessão num adaptador parado. É geração, não
     flag: o adaptador volta a ligar depois de um `stop` (a troca de sessão
     religa o mesmo adaptador).
   - Interrupt: cada `cancel()` com 200 gera UM `session.execution.interrupted`
     no SSE. Se um envio novo já abriu outro turno, o eco atrasado é do turno
     antigo e não pode fechá-lo.

   Sem identificador no evento, a guarda assume a ordem do servidor: um eco
   por cancel com 200, na ordem (ponto não medido no binário real). Se o eco
   vier antes da resposta do POST, ele mesmo fecha o turno e nada fica devido. */

/**
 * Cria a guarda dos desfechos tardios do adaptador.
 * @param {{cancelled: () => Error}} options `cancelled` cunha o erro do desfecho invalidado
 * @returns {{generation: number, interruptEchoes: number, capture: () => number, invalidate: () => void,
 *   throwIfStale: (generation: number) => void, noteInterrupt: () => void, forgetEchoes: () => void, consumeInterruptEcho: (status: unknown) => boolean,
 *   settleExecution: (settle: (end: {isError?: boolean, cancelled?: boolean}) => void, status: unknown) => void}}
 * @example const guard = createTurnGuard({cancelled: () => failure('tutor.error.cancelled', {}, {notSent: true})});
 */
function createTurnGuard({cancelled}) {
  return {
    generation: 0,
    interruptEchoes: 0,
    capture() { return this.generation; },
    invalidate() { this.generation += 1; },
    throwIfStale(generation) { if (generation !== this.generation) throw cancelled(); },
    noteInterrupt() { this.interruptEchoes += 1; },
    /* Sem SSE o eco nunca chega: a dívida não pode engolir um `interrupted` futuro. */
    forgetEchoes() { this.interruptEchoes = 0; },
    consumeInterruptEcho(status) {
      if (status !== 'interrupted' || this.interruptEchoes <= 0) return false;
      /* Eco do interrupt que o `cancel()` já liquidou: o turno em voo (se há)
         é novo e segue; sem turno, já não há nada a fechar. */
      this.interruptEchoes -= 1;
      return true;
    },
    /* O `execution` do SSE fecha o turno, menos o eco do interrupt já pago. */
    settleExecution(settle, status) {
      if (this.consumeInterruptEcho(status)) return;
      settle({isError: status === 'failed', cancelled: status === 'interrupted'});
    },
  };
}

module.exports = {createTurnGuard};
