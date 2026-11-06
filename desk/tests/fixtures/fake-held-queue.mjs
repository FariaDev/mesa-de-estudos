/* Fila de mentira com a mesma regra do "Enviar agora" do `queue.mjs`
   (`canSendNow`: segurada e com pelo menos um item). A entrada da fila só
   conhece `enqueue`, `release` e `rehold`; este fake liga os dois ao estado que o teste
   observa, sem DOM e sem Electron. */
export function fakeHeldQueue(initialTexts = []) {
  const items = [...initialTexts];
  let held = items.length > 0;
  return {
    enqueue(text) {
      items.push(text);
    },
    release() {
      held = false;
    },
    rehold() {
      if (!held && items.length) held = true;
    },
    canSendNow() {
      return held && items.length > 0;
    },
    get held() {
      return held;
    },
    get items() {
      return [...items];
    },
  };
}
