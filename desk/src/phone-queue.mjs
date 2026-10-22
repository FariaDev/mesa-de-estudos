// @ts-check

/* Fila das fotos do celular (#36) no renderer: uma de cada vez, na ordem em que
   chegaram. Antes, cada foto que chegava abria outro laço de entrega enquanto o
   anterior ainda desenhava a sua foto em pé; a PNG pequena passava na frente da
   JPEG girada e a bandeja ficava fora de ordem (achado no `phone-photo-ui`
   da #66). Aqui só um laço roda por vez. */

/**
 * @template T
 * @typedef {object} PhoneQueue
 * @property {(item: T) => Promise<void>} push guarda e entrega (se um laço já roda, ele leva o item e esta promessa resolve logo)
 * @property {() => Promise<void>} release retoma depois que `canRun` voltou a valer
 * @property {() => number} size quantas esperam
 */

/**
 * Cria a fila. `run` entrega um item; `canRun` diz se pode entregar agora
 * (durante a resposta do tutor, não pode: os itens esperam o `release`).
 * @template T
 * @param {{run: (item: T) => Promise<void>, canRun?: () => boolean}} options
 * @returns {PhoneQueue<T>}
 * @example const queue=createPhoneQueue({run:attachPhoto,canRun:()=>!S.busy});queue.push(photo);
 */
export function createPhoneQueue({run, canRun = () => true}) {
  /** @type {T[]} */
  const held = [];
  /* Liga e desliga no mesmo tique da checagem: um item que chega durante o
     `await` é visto pelo laço que já roda, sem janela para ficar parado. */
  let running = false;

  async function release() {
    if (running) return;
    running = true;
    try {
      while (held.length && canRun()) await run(/** @type {T} */ (held.shift()));
    } finally { running = false; }
  }

  return {
    push(item) { held.push(item); return release(); },
    release,
    size: () => held.length,
  };
}
