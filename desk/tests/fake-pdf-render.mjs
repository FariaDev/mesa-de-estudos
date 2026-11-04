/* Janela e ipc de mentira para o render de PDF, e um pdf.js que classifica
   página visual sem abrir um PDF de verdade. Nenhum Electron. */

/** @param {{png?: string, ready?: boolean, onScript?: (script: string) => void}} [options] */
export function fakePdfWindow({png = '', ready = true, onScript = () => {}} = {}) {
  const scripts = [];
  const win = {
    scripts,
    closed: false,
    loadFile() {
      return Promise.resolve();
    },
    webContents: {
      executeJavaScript(script) {
        scripts.push(script);
        onScript(script);
        if (script.includes('mesaRenderPdfPage===')) return Promise.resolve(ready);
        return Promise.resolve(png);
      },
    },
    on() {},
    close() {
      win.closed = true;
    },
  };
  return win;
}

/**
 * ipcMain de mentira: guarda o único `handle` registrado (o canal de bytes do render).
 * @returns {{handle: (channel: string, fn: Function) => void, channel: string, handler: Function|null}}
 */
export function fakeIpc() {
  const ipc = {channel: '', handler: null, handle(channel, fn) { this.channel = channel; this.handler = fn; }};
  return ipc;
}

/**
 * pdf.js mínimo: uma página, com a lista de operadores que o teste pede.
 * @param {{text?: string, fnArray?: number[], argsArray?: any[], ops?: Record<string, number>, view?: number[], failDocument?: boolean}} spec
 */
export function fakePdfjs({text = '', fnArray = [], argsArray = [], ops = {}, view = [0, 0, 612, 792], failDocument = false} = {}) {
  return {
    OPS: ops,
    getDocument() {
      const loading = {
        promise: failDocument ? Promise.reject(Error('PDF torto')) : Promise.resolve({
          numPages: 1,
          getPage: async () => ({
            view,
            getViewport: ({scale = 1} = {}) => ({width: (view[2] - view[0]) * scale, height: (view[3] - view[1]) * scale}),
            getTextContent: async () => ({items: text ? [{str: text, hasEOL: false}] : []}),
            getOperatorList: async () => ({fnArray, argsArray}),
          }),
        }),
        destroy: async () => {},
      };
      return loading;
    },
  };
}
