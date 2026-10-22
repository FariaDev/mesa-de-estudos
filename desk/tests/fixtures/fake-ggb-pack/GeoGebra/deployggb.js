/* deployggb.js de mentira (#55): a mesma porta de entrada do pacote oficial
   (`GGBApplet`, `setHTML5Codebase(pasta, offline)`, `inject(id)`), mas só carrega o
   `web3d.nocache.js` da pasta pedida, como o real faz. Registra o que recebeu em
   `window.__fakePack` para o teste conferir. */
window.GGBApplet = function GGBApplet(params, version) {
  let codebase = '', offline = null;
  this.setHTML5Codebase = (folder, isOffline) => { codebase = folder; offline = isOffline; };
  this.inject = () => {
    window.__fakePack = {codebase, offline, version, params, net: null, asset: null};
    const script = document.createElement('script');
    script.src = codebase + 'web3d.nocache.js';
    document.head.append(script);
  };
};
