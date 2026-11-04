import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

/* #101: com o app aberto, a luminária segue o acento; o pacote fica no azul.
   O app, a janela e o disco são falsos com nome; o último teste olha os
   arquivos gerados de verdade em assets/. */
const require=createRequire(import.meta.url);
const {appIconPaths,createAppIcon,LAMP_ACCENTS}=require('../app-icon-host.cjs');
const DESK=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const ASSETS='/mesa/assets';
const asset=(...parts)=>path.join(ASSETS,...parts);

function fakeDisk(files){return (file)=>files.includes(file);}
function fakeElectronApp(){const calls=[];return {calls,app:{dock:{setIcon:(file)=>calls.push(file)}}};}
function fakeWindow(){const calls=[];return {calls,setIcon:(file)=>calls.push(file),isDestroyed:()=>false};}
const GREEN=fakeDisk([asset('app-icon','lamp-green-dock.png'),asset('app-icon','lamp-green-256.png')]);

test('appIconPaths acha os arquivos do acento', () => {
  assert.deepEqual(appIconPaths(ASSETS,'green',GREEN),{dock:asset('app-icon','lamp-green-dock.png'),window:asset('app-icon','lamp-green-256.png')});
});

test('acento desconhecido ou sem arquivo cai no ícone do pacote', () => {
  const bundle={dock:asset('mesa-1024.png'),window:asset('mesa.ico')};
  assert.deepEqual(appIconPaths(ASSETS,'teal',()=>true),bundle);
  assert.deepEqual(appIconPaths(ASSETS,'../blue',()=>true),bundle);
  assert.deepEqual(appIconPaths(ASSETS,'blue',GREEN),bundle);
});

test('no macOS o Dock troca de ícone quando o acento muda', () => {
  const {app,calls}=fakeElectronApp();
  const icon=createAppIcon({app,platform:'darwin',assetsDir:ASSETS,exists:()=>true});
  icon.apply(null,'blue');
  icon.apply(null,'blue');
  icon.apply(null,'violet');
  icon.apply(null,'green');
  assert.deepEqual(calls,[asset('app-icon','lamp-blue-dock.png'),asset('app-icon','lamp-violet-dock.png'),asset('app-icon','lamp-green-dock.png')]);
});

test('no modo de teste o Dock escondido não é tocado', () => {
  const {app,calls}=fakeElectronApp();
  createAppIcon({app,platform:'darwin',assetsDir:ASSETS,dockEnabled:false,exists:()=>true}).apply(null,'green');
  assert.deepEqual(calls,[]);
});

test('no Windows a janela recebe o PNG de 256 do acento', () => {
  const win=fakeWindow();
  createAppIcon({app:{},platform:'win32',assetsDir:ASSETS,exists:()=>true}).apply(win,'green');
  assert.deepEqual(win.calls,[asset('app-icon','lamp-green-256.png')]);
});

test('no Windows, chamar antes da janela existir não conta como aplicado', () => {
  const icon=createAppIcon({app:{},platform:'win32',assetsDir:ASSETS,exists:()=>true});
  icon.apply(null,'green');
  const win=fakeWindow();icon.apply(win,'green');
  assert.deepEqual(win.calls,[asset('app-icon','lamp-green-256.png')]);
});

test('as seis cores têm SVG, Dock e os PNGs de 256 a 16 gerados', () => {
  assert.deepEqual([...LAMP_ACCENTS],['blue','violet','green','orange','pink','graphite']);
  for (const accent of LAMP_ACCENTS) {
    for (const suffix of ['-dock.png','-256.png','-128.png','-64.png','-32.png','-16.png']) {
      const file=path.join(DESK,'assets','app-icon',`lamp-${accent}${suffix}`);
      assert.ok(fs.existsSync(file),`falta ${path.basename(file)}`);
    }
  }
  for (const file of ['mesa-1024.png','mesa.icns','mesa.ico']) assert.ok(fs.existsSync(path.join(DESK,'assets',file)),`falta ${file}`);
});
