/* Ícone do app na cor de acento (#61). Com a Mesa aberta, o Dock do macOS e a
   janela/barra de tarefas do Windows mostram a logo no acento escolhido; o
   ícone do pacote (Finder, Launchpad, Iniciar, instalador) é um arquivo fixo,
   violeta, e não muda. Os PNGs por acento saem de scripts/app-icons.cjs. O
   acento chega já normalizado pelo state-adapter (core/accent.bend). */
const fs=require('node:fs');
const path=require('node:path');

/** Caminhos do ícone de um acento; acento sem arquivo cai no ícone do pacote.
 * @param {string} assetsDir pasta assets/ do app
 * @param {string} accent id do acento ('blue', 'violet', …)
 * @param {(file: string) => boolean} [exists]
 * @returns {{dock: string, window: string}}
 * @example appIconPaths(path.join(__dirname,'assets'),'green') */
function appIconPaths(assetsDir,accent,exists=fs.existsSync){
  const dock=path.join(assetsDir,'app-icon',`mesa-${accent}-dock.png`);
  const window=path.join(assetsDir,'app-icon',`mesa-${accent}-256.png`);
  if(/^[a-z]+$/.test(String(accent))&&exists(dock)&&exists(window))return {dock,window};
  return {dock:path.join(assetsDir,'mesa-1024.png'),window:path.join(assetsDir,'mesa.ico')};
}

/** Aplica o ícone do acento no Dock (macOS) ou na janela (Windows), só quando muda.
 * @param {{app: {dock?: {setIcon: (file: string) => void}}, platform: string, assetsDir: string, dockEnabled?: boolean, exists?: (file: string) => boolean}} deps
 * `dockEnabled` é falso no modo de teste, em que o Dock fica escondido.
 * @returns {{apply: (win: {setIcon?: (file: string) => void, isDestroyed?: () => boolean} | null, accent: string) => void}}
 * @example const appIcon=createAppIcon({app,platform:process.platform,assetsDir}); appIcon.apply(win,state.accent) */
function createAppIcon({app,platform,assetsDir,dockEnabled=true,exists}){
  let applied='';
  return {
    apply(win,accent){
      const files=appIconPaths(assetsDir,accent,exists);
      if(files.dock===applied)return;
      if(platform==='darwin'){
        if(!dockEnabled)return;
        app.dock?.setIcon(files.dock);applied=files.dock;return;
      }
      if(platform!=='win32'||!win||win.isDestroyed?.())return;
      win.setIcon?.(files.window);applied=files.dock;
    },
  };
}

module.exports={appIconPaths,createAppIcon};
