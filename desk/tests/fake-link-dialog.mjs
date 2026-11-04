// Fakes do diálogo de confirmação de link (#81).
// - `fakeLinkDialog`: responde o que o teste manda (Abrir = true, Cancelar =
//   false) e guarda o que foi perguntado e o que chegou a abrir. Entra por
//   parâmetro em `openConfirmedLink`.
// - `fakeDialogElement`: o `<dialog>` do DOM com a fila do evento `close`, para
//   reproduzir o que o navegador faz (o `close` chega numa tarefa depois).

/**
 * @param {boolean | Error} answer resposta do usuário; um Error simula falha no diálogo
 * @returns {{asked: string[], opened: string[], confirm: (url: string) => Promise<boolean>, open: (url: string) => Promise<void>}}
 * @example const dialog = fakeLinkDialog(false); await openConfirmedLink(url, dialog); dialog.opened // []
 */
export function fakeLinkDialog(answer) {
  const asked = [];
  const opened = [];
  return {
    asked,
    opened,
    confirm: async (url) => {
      asked.push(url);
      if (answer instanceof Error) throw answer;
      return answer;
    },
    open: async (url) => {
      opened.push(url);
    },
  };
}

/**
 * Elemento `<dialog>` com a fila do `close`: `close(value)` fecha agora (com o
 * valor do botão em `returnValue`) e deixa o evento na fila; `runQueuedClose()`
 * roda os eventos pendentes, como a tarefa do navegador faria depois.
 * @returns {object} o `<dialog>` fake
 * @example const dialog = fakeDialogElement(); dialog.showModal(); dialog.close('ok'); dialog.runQueuedClose();
 */
export function fakeDialogElement() {
  const listeners = [];
  let queued = 0;
  const fields = new Map();
  const dialog = {
    open: false,
    returnValue: '',
    querySelector(selector) {
      if (!fields.has(selector)) fields.set(selector, {textContent: '', title: ''});
      return fields.get(selector);
    },
    addEventListener(type, listener) {
      if (type === 'close' && !listeners.includes(listener)) listeners.push(listener);
    },
    showModal() {
      this.open = true;
    },
    close(value) {
      this.open = false;
      this.returnValue = value;
      queued += 1;
    },
    runQueuedClose() {
      while (queued > 0) {
        queued -= 1;
        for (const listener of listeners) listener({currentTarget: dialog});
      }
    },
  };
  return dialog;
}

/**
 * `document` mínimo com o `<dialog>` dado; sem ele, `getElementById` devolve null.
 * @param {object | null} dialog
 * @returns {{getElementById: (id: string) => object | null}}
 * @example globalThis.document = fakeDocumentWith(fakeDialogElement());
 */
export function fakeDocumentWith(dialog) {
  return {getElementById: (id) => (id === 'link-dialog' ? dialog : null)};
}
