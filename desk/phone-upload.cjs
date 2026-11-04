// @ts-check
'use strict';

/* Fila de envio das fotos na página do celular (#36). A página é uma só, sem
   módulos (a CSP só deixa o script com o nonce), então `createPhotoUploader`
   vai inteira para dentro dela: `phone-page.cjs` põe `toString()` no `<script>`,
   e `tests/phone-upload.test.mjs` roda a mesma cópia num contexto vazio. Por
   isso o corpo não cita nada deste módulo: tudo entra por `deps`.

   O porquê: o celular bloqueado suspende a aba, e a conexão que o navegador
   reaproveita pode ter morrido. Antes, o POST não tinha prazo e `busy` ficava
   preso, então toda foto nova era descartada em silêncio (isso o código fazia,
   de fato). Agora cada envio tem prazo, ganha uma tentativa a mais, e a fila
   guarda o que não saiu. */

/* 20 s + 1 s por MB, com teto de 60 s. O teto fica abaixo do `requestTimeout`
   do servidor (`phone-host.cjs`), para o servidor não cortar um envio que a
   página ainda considera vivo. */
const UPLOAD_LIMITS = {base: 20000, perMb: 1000, cap: 60000};

/**
 * Fila de fotos da página do celular: uma de cada vez, na ordem em que foram
 * escolhidas. Foto escolhida durante um envio entra na mesma fila. Erro de rede
 * ou prazo vencido ganha uma tentativa; se a segunda também falha, a fila para
 * em `offline` e guarda as fotos para o "Tentar de novo". Recusa da Mesa (404 ou
 * sessão cheia) esvazia a fila; tamanho (413) e tipo (415) recusam só a foto.
 *
 * @param {{
 *   post: (file: Blob, signal: AbortSignal, id: string) => Promise<{ok: boolean, status: number, reason?: string}>,
 *   newController: () => AbortController,
 *   setTimer: (run: () => void, ms: number) => unknown,
 *   clearTimer: (id: unknown) => void,
 *   limits: {base: number, perMb: number, cap: number},
 *   on: {
 *     added: (item: {id: string, file: Blob}) => void,
 *     sent: (item: {id: string, file: Blob}, done: number, total: number) => void,
 *     dropped: (item: {id: string, file: Blob}) => void,
 *     phase: (name: 'sending'|'sent'|'refused'|'offline', detail: {done: number, total: number, verdict: {ok: boolean, status: number, reason?: string} | null}) => void,
 *   },
 * }} deps
 * @returns {{enqueue: (files: Blob[]) => Promise<void>, resume: () => Promise<void>, wake: () => Promise<void>, busy: () => boolean}}
 *   `enqueue` põe fotos na fila; `resume` retoma depois de `offline`; `wake` aborta
 *   o envio pendurado (o celular voltou da suspensão) e retoma.
 * @example
 * const uploader = createPhotoUploader({post, newController: () => new AbortController(), setTimer, clearTimer, limits: UPLOAD_LIMITS, on});
 * await uploader.enqueue([photo]);
 */
function createPhotoUploader({post, newController, setTimer, clearTimer, limits, on}) {
  const queue = [];
  let done = 0, total = 0, refusal = null, inFlight = null, running = null;

  /* Id do envio: o servidor guarda os aceitos e responde OK de novo em vez de
     emitir a foto duas vezes quando a fila refaz um POST que já chegou (#36).
     `crypto.randomUUID` não existe em página HTTP fora de contexto seguro; os
     bytes aleatórios do `getRandomValues` existem. */
  function newPhotoId() {
    const bytes = new Uint8Array(12);
    const source = typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function' ? crypto : null;
    if (source) source.getRandomValues(bytes);
    else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  const deadlineMs = (bytes) => Math.min(limits.cap, limits.base + limits.perMb * (bytes / 1048576));
  const endsQueue = (verdict) => verdict.status === 404 || verdict.reason === 'full';

  /* Só erro de rede ou prazo repete; resposta da Mesa, ok ou recusa, não.
     A tentativa repetida leva o mesmo `item.id` (o servidor não duplica a
     foto). `null` quando as duas tentativas falham. */
  async function deliver(item) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const controller = newController();
      inFlight = controller;
      const timer = setTimer(() => controller.abort(), deadlineMs(item.file.size));
      try {
        return await post(item.file, controller.signal, item.id);
      } catch {
        /* rede caiu ou o prazo venceu: a próxima volta tenta de novo */
      } finally {
        clearTimer(timer);
        if (inFlight === controller) inFlight = null;
      }
    }
    return null;
  }

  async function sendQueue() {
    while (queue.length) {
      const item = queue[0];
      on.phase('sending', {done, total, verdict: null});
      const verdict = await deliver(item);
      if (!verdict) {
        on.phase('offline', {done, total, verdict: null});
        return;
      }
      queue.shift();
      if (verdict.ok) {
        done += 1;
        on.sent(item, done, total);
        continue;
      }
      refusal = verdict;
      on.dropped(item);
      if (endsQueue(verdict)) {
        while (queue.length) on.dropped(queue.shift());
      }
    }
    if (total) on.phase(refusal ? 'refused' : 'sent', {done, total, verdict: refusal});
    done = 0;
    total = 0;
    refusal = null;
  }

  /* O `await` faz o `finally` rodar depois de `running` receber a promessa, até
     quando a fila já estava vazia; assim `busy` nunca fica preso em `true`. */
  async function loop() {
    try {
      await sendQueue();
    } finally {
      running = null;
    }
  }

  function drain() {
    if (!running) running = loop();
    return running;
  }

  return {
    enqueue(files) {
      total += files.length;
      for (const file of files) {
        const item = {id: newPhotoId(), file};
        queue.push(item);
        on.added(item);
      }
      return drain();
    },
    resume: () => drain(),
    wake() {
      if (inFlight) inFlight.abort();
      return drain();
    },
    busy: () => running !== null,
  };
}

module.exports = {createPhotoUploader, UPLOAD_LIMITS};
