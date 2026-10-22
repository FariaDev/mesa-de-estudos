import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

/* #61: com o app aberto, o ícone segue o acento; o do pacote é fixo. O app,
   a janela e o disco são falsos com nome; só o último teste olha os arquivos
   gerados de verdade em assets/. */
const require=createRequire(import.meta.url);
const {appIconPaths,createAppIcon}=require('../app-icon-host.cjs');
const DESK=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const ASSETS='/mesa/assets';

function fakeDisk(files){return (file)=>files.includes(file);}
function fakeElectronApp(){const calls=[];return {calls,app:{dock:{setIcon:(file)=>calls.push(file)}}};}
function fakeWindow(){const calls=[];return {calls,setIcon:(file)=>calls.push(file),isDestroyed:()=>false};}
const ALL_GREEN=fakeDisk([`${ASSETS}/app-icon/mesa-green-dock.png`,`${ASSETS}/app-icon/mesa-green-256.png`]);

test('appIconPaths acha os arquivos do acento', () => {
  assert.deepEqual(appIconPaths(ASSETS,'green',ALL_GREEN),{dock:`${ASSETS}/app-icon/mesa-green-dock.png`,window:`${ASSETS}/app-icon/mesa-green-256.png`});
});

test('appIconPaths cai no ícone do pacote sem arquivo ou com nome estranho', () => {
  const bundle={dock:`${ASSETS}/mesa-1024.png`,window:`${ASSETS}/mesa.ico`};
  assert.deepEqual(appIconPaths(ASSETS,'teal',ALL_GREEN),bundle);
  assert.deepEqual(appIconPaths(ASSETS,'../green',()=>true),bundle);
});

test('no macOS o Dock troca de ícone só quando o acento muda', () => {
  const {app,calls}=fakeElectronApp();
  const icon=createAppIcon({app,platform:'darwin',assetsDir:ASSETS,exists:ALL_GREEN});
  icon.apply(null,'green');icon.apply(null,'green');icon.apply(null,'blue');
  assert.deepEqual(calls,[`${ASSETS}/app-icon/mesa-green-dock.png`,`${ASSETS}/mesa-1024.png`]);
});

test('no modo de teste o Dock escondido não é tocado', () => {
  const {app,calls}=fakeElectronApp();
  createAppIcon({app,platform:'darwin',assetsDir:ASSETS,dockEnabled:false,exists:ALL_GREEN}).apply(null,'green');
  assert.deepEqual(calls,[]);
});

test('no Windows a janela recebe o PNG de 256 do acento', () => {
  const win=fakeWindow();
  createAppIcon({app:{},platform:'win32',assetsDir:ASSETS,exists:ALL_GREEN}).apply(win,'green');
  assert.deepEqual(win.calls,[`${ASSETS}/app-icon/mesa-green-256.png`]);
});

test('os seis acentos têm os três arquivos gerados', () => {
  for (const accent of ['blue','violet','green','orange','pink','graphite']) {
    const files=appIconPaths(path.join(DESK,'assets'),accent);
    assert.match(files.dock,new RegExp(`mesa-${accent}-dock\\.png$`),`${accent}: falta o PNG do Dock`);
    assert.ok(fs.existsSync(path.join(DESK,'assets','app-icon',`mesa-${accent}.svg`)),`${accent}: falta o SVG do cabeçalho`);
  }
});

test('no Windows, chamar antes da janela existir não conta como aplicado', () => {
  const icon=createAppIcon({app:{},platform:'win32',assetsDir:ASSETS,exists:ALL_GREEN});
  icon.apply(null,'green');
  const win=fakeWindow();icon.apply(win,'green');
  assert.deepEqual(win.calls,[`${ASSETS}/app-icon/mesa-green-256.png`]);
});
