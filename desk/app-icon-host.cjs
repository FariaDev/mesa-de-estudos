/* Ícone do app com a Mesa aberta (#61, #101). O Dock do macOS e a janela/barra
   de tarefas do Windows mostram a luminária na cor de acento; o ícone do
   pacote (Finder, Launchpad, Iniciar, instalador) é o azul fixo e não muda.
   As PNGs por acento saem de scripts/lamp-icons.cjs. Acento desconhecido cai
   no pacote. */
const fs=require('node:fs');
const path=require('node:path');

const LAMP_ACCENTS=['blue','violet','green','orange','pink','graphite'];

/** Caminhos do ícone de um acento; acento sem arquivo cai no ícone do pacote.
 * @param {string} assetsDir pasta assets/ do app
 * @param {string} accent id do acento ('blue', 'violet', …)
 * @param {(file: string) => boolean} [exists]
 * @returns {{dock: string, window: string}}
 * @example appIconPaths(path.join(__dirname,'assets'),'green') */
function appIconPaths(assetsDir,accent,exists=fs.existsSync){
  const valid=LAMP_ACCENTS.includes(accent);
  const dock=path.join(assetsDir,'app-icon',`lamp-${accent}-dock.png`);
  const window=path.join(assetsDir,'app-icon',`lamp-${accent}-256.png`);
  if(valid&&exists(dock)&&exists(window))return {dock,window};
  return {dock:path.join(assetsDir,'mesa-1024.png'),window:path.join(assetsDir,'mesa.ico')};
}

/** Aplica a luminária no Dock (macOS) ou na janela (Windows), só quando muda.
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

module.exports={appIconPaths,createAppIcon,LAMP_ACCENTS};
