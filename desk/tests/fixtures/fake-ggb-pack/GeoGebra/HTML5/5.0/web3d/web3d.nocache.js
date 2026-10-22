/* web3d.nocache.js de mentira (#55). Faz o que o GWT do applet real faz — busca arquivos
   do próprio pacote por fetch — e ainda tenta sair para a rede (`net.json` traz a URL do
   servidor de prova do teste): a sessão do applet offline precisa recusar tudo isso. */
/* exported objects, draw */
const objects = new Map();
const draw = () => {};
(() => {
  const base = document.currentScript.src.replace(/[^/]*$/, '');
  const pack = window.__fakePack;
  const attempt = (run) => run().then(() => 'passou', () => 'bloqueado');
  (async () => {
    pack.asset = await fetch(base + 'asset.json').then((response) => response.json());
    const net = await fetch(base + 'net.json').then((response) => response.json());
    pack.net = {
      fetch: await attempt(() => fetch(net.url + 'fetch', {mode: 'no-cors'})),
      xhr: await attempt(() => new Promise((resolve, reject) => { const x = new XMLHttpRequest(); x.open('GET', net.url + 'xhr'); x.onload = resolve; x.onerror = reject; x.send(); })),
      img: await attempt(() => new Promise((resolve, reject) => { const i = new Image(); i.onload = resolve; i.onerror = reject; i.src = net.url + 'img.png'; })),
      script: await attempt(() => new Promise((resolve, reject) => { const s = document.createElement('script'); s.onload = resolve; s.onerror = reject; s.src = net.url + 'script.js'; document.head.append(s); })),
    };
    const applet = document.createElement('script');
    applet.src = base + 'fake-ggb-applet-browser.js';
    applet.onload = () => pack.params.appletOnLoad();
    document.head.append(applet);
  })();
})();
