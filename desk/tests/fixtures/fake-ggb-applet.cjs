'use strict';

/* Applet GeoGebra falso com nome (#53): a mesma superfície que a Mesa usa do
   `window.ggbApplet` (comando, nomes, definição, valor, apagar, base64), em
   memória e sem internet. `FakeGgbApplet` serve ao host de verdade (via
   `fake-ggb-electron.cjs`); `boardAppletOf` entrega ao `ggb-board.cjs` o mesmo
   contrato que o host monta sobre o applet real. */

class FakeGgbApplet {
  /** @param {{rejects?: string}} [options] `rejects`: trecho que faz o comando falhar, como um erro de sintaxe. */
  constructor({rejects = 'ERRO'} = {}) {
    this.rejects = rejects;
    this.objects = new Map();
    this.commands = [];
  }

  evalCommand(command) {
    this.commands.push(String(command));
    if (String(command).includes(this.rejects)) return false;
    const named = /^\s*([A-Za-z]\w*)\s*(?:\(\s*\w+\s*\))?\s*=\s*(.+)$/.exec(String(command));
    const name = named ? named[1] : `obj${this.objects.size + 1}`;
    const definition = named ? named[2] : String(command);
    this.objects.set(name, {definition, value: `valor(${definition})`});
    return true;
  }

  getAllObjectNames() { return [...this.objects.keys()].join('\n'); }
  getCommandString(name) { return this.objects.get(name)?.definition ?? ''; }
  getDefinitionString(name) { return this.objects.get(name)?.definition ?? ''; }
  getValueString(name) { return this.objects.get(name)?.value ?? ''; }
  deleteObject(name) { this.objects.delete(name); }
  getBase64() { return Buffer.from(JSON.stringify([...this.objects])).toString('base64'); }
  setBase64(b64) { this.objects = new Map(JSON.parse(Buffer.from(String(b64), 'base64').toString('utf8'))); }
}

/** Contrato `BoardApplet` do `ggb-board.cjs` sobre o applet falso. */
function boardAppletOf(applet) {
  return {
    summary: async () => ({objects: [...applet.objects].map(([name, item]) => `${name}: ${item.definition}`).join('\n'), count: applet.objects.size}),
    snapshot: async () => applet.getBase64(),
    load: async (b64) => applet.setBase64(b64),
    clear: async () => applet.objects.clear(),
  };
}

/** Histórico em memória no lugar do disco (`KeptStore`). */
function memoryKeptStore() {
  const lists = new Map();
  return {read: (key) => lists.get(key) ?? [], write: (key, list) => { lists.set(key, list); }};
}

module.exports = {FakeGgbApplet, boardAppletOf, memoryKeptStore};
