/* Applet GeoGebra de mentira, em memória (#53, #55): a mesma superfície do applet real
   (`window.ggbApplet`). Quem carrega define antes `objects` (Map) e `draw()`: a página
   falsa `fake-ggb.html` e o pacote falso do GeoGebra offline (`ggb-offline-ui`). */
/* global objects, draw */
window.ggbApplet = {
  evalCommand(command) {
    if (String(command).includes('ERRO')) return false;
    const named = /^\s*([A-Za-z]\w*)\s*(?:\(\s*\w+\s*\))?\s*=\s*(.+)$/.exec(String(command));
    objects.set(named ? named[1] : 'obj' + (objects.size + 1), named ? named[2] : String(command));
    draw();
    return true;
  },
  getAllObjectNames: () => [...objects.keys()].join('\n'),
  getCommandString: (name) => objects.get(name) || '',
  getDefinitionString: (name) => objects.get(name) || '',
  getValueString: (name) => 'valor(' + (objects.get(name) || '') + ')',
  deleteObject(name) { objects.delete(name); draw(); },
  getBase64: () => btoa(unescape(encodeURIComponent(JSON.stringify([...objects])))),
  setBase64(b64) { objects.clear(); for (const [name, def] of JSON.parse(decodeURIComponent(escape(atob(String(b64)))))) objects.set(name, def); draw(); },
};
