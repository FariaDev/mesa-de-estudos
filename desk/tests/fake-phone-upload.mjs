/* Fakes da fila de fotos da página do celular (#36), para `phone-upload.test.mjs`:
   - `fakeNetwork()`: cada `post` fica no ar até o teste responder (`answer`) com
     ok, recusa (`{status, reason}`) ou falha de rede. O aborto do `AbortSignal`
     chega como rejeição, igual ao fetch de verdade.
   - `fakeClock()`: os prazos da fila ficam guardados até o teste disparar
     (`fire`), e `delays` mostra quanto cada um pediu. */

export function fakeNetwork() {
  const calls = [];
  const post = (file, signal, id) => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => reject(new DOMException('The operation was aborted.', 'AbortError')));
    calls.push({
      file,
      id,
      signal,
      answer(outcome) {
        if (outcome === 'network') reject(new TypeError('Failed to fetch'));
        else if (outcome === 'ok') resolve({ok: true, status: 201});
        else resolve({ok: false, status: outcome.status, reason: outcome.reason});
      },
    });
  });
  return {post, calls};
}

export function fakeClock() {
  const pending = new Map();
  let next = 1;
  return {
    setTimer: (run, ms) => {
      const id = next++;
      pending.set(id, {run, ms});
      return id;
    },
    clearTimer: (id) => pending.delete(id),
    fire: () => {
      for (const [id, {run}] of [...pending]) {
        pending.delete(id);
        run();
      }
    },
    delays: () => [...pending.values()].map((timer) => timer.ms),
  };
}
