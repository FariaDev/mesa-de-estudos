// @ts-check
'use strict';

/* Atalhos editáveis e menu nativo da Mesa (#43 fase 2: saiu do main.cjs). O
   mapa vem do renderer (`set-keymap`); a validação é pura e o menu lê o estado
   vivo do main pelo `live`. */

/* Padrões dos atalhos que existem no menu nativo. O renderer envia o mapa
   efetivo; null significa "sem atalho". Só chaves conhecidas entram. O remap em
   si acontece no preload (que escuta antes de qualquer script da página); aqui
   só o accelerator do menu. */
const MENU_ACCEL={'command-palette':'CmdOrCtrl+K',check:'CmdOrCtrl+Shift+C','ggb-check':'CmdOrCtrl+Shift+G','chat-toggle':'CmdOrCtrl+\\',help:'CmdOrCtrl+/',settings:'CmdOrCtrl+,',stop:null};
const KEYMAP_MAX=40;
const ACCEL_MODS=new Set(['CmdOrCtrl','Cmd','Command','Ctrl','Control','Alt','Option','AltGr','Shift','Super','Meta']);
const ACCEL_KEY=/^(?:[A-Za-z0-9]|[^\sA-Za-z0-9+]|F(?:[1-9]|1[0-9]|2[0-4])|Plus|Space|Enter|Return|Escape|Esc|Tab|Backspace|Delete|Up|Down|Left|Right|Home|End|PageUp|PageDown)$/;

/**
 * Diz se um accelerator do Electron tem até 3 modificadores conhecidos e uma tecla válida.
 * @param {unknown} value accelerator vindo do renderer
 * @returns {boolean}
 * @example validAccelerator('CmdOrCtrl+Shift+K') // true
 */
function validAccelerator(value){
 if(typeof value!=='string'||!value||value.length>40)return false;
 const parts=value.split('+');
 const key=parts.pop();
 if(!key||!ACCEL_KEY.test(key))return false;
 if(parts.length>3||new Set(parts).size!==parts.length)return false;
 return parts.every(part=>ACCEL_MODS.has(part));
}

/**
 * Limpa o mapa enviado pelo renderer: só ids do menu, accelerators válidos ou null (sem atalho).
 * @param {unknown} raw `{menu:{[id]:string|null}}`
 * @returns {Record<string,string|null>}
 * @example normalizeKeymap({menu:{help:'F1',inventado:'F2'}}) // {help:'F1'}
 */
function normalizeKeymap(raw){
 const clean={};
 const menu=raw&&typeof raw==='object'&&!Array.isArray(raw)?/** @type {{menu?: unknown}} */(raw).menu:null;
 if(!menu||typeof menu!=='object'||Array.isArray(menu))return clean;
 let count=0;
 for(const [id,value] of Object.entries(menu)){
  if(++count>KEYMAP_MAX)break;
  if(!Object.prototype.hasOwnProperty.call(MENU_ACCEL,id))continue;
  if(value===null){clean[id]=null;continue;}
  if(!validAccelerator(value))continue;
  clean[id]=value;
 }
 return clean;
}

/**
 * Cria o menu nativo com os atalhos do usuário por cima dos padrões.
 * @param {{live: import('./main.cjs').DeskLive, Menu: typeof import('electron').Menu, captureAvailable: () => boolean}} options
 *   `live` traz config, estado, janela e o host de idioma do main
 * @returns {{buildMenu:()=>void, setKeymap:(raw:unknown)=>{ok:true, menu:number}, register:(ipcMain:{handle:Function})=>void}}
 * @example const deskMenu=createDeskMenu({live,Menu,captureAvailable});deskMenu.register(ipcMain);deskMenu.buildMenu();
 */
function createDeskMenu({live,Menu,captureAvailable}){
 let keymap={};
 function accelFor(id){
  return Object.prototype.hasOwnProperty.call(keymap,id)?keymap[id]:MENU_ACCEL[id];
 }

 function accelProps(id,{display=false}={}){
  const accel=accelFor(id);
  if(!accel)return {};
  return display?{accelerator:accel,registerAccelerator:false}:{accelerator:accel};
 }
 function buildMenu(){
  /* `conferir:false` esconde o Conferir Xournal++ TAMBÉM no menu nativo (o item
     sai da lista e o atalho deixa de ser registrado): a flag é o único
     interruptor, como no botão do composer. Os outros itens do menu Estudar
     não dependem dela. `save-config` chama este buildMenu, então ligar/desligar
     nas Configurações reflete no menu na hora. */
  const study=[];
  if(live.config.desk?.conferir!==false)study.push({label:live.languageHost.t('menu.check',{app:live.state.conferirApp?.app||'Xournal++'}),...accelProps('check'),enabled:captureAvailable(),click:()=>{if(live.win&&!live.win.isDestroyed())live.win.webContents.send('menu-check');}});
  study.push({label:live.languageHost.t('menu.checkGeogebra'),...accelProps('ggb-check'),click:()=>{if(live.win&&!live.win.isDestroyed())live.win.webContents.send('menu-geogebra');}},{label:live.languageHost.t('menu.toggleTutor'),...accelProps('chat-toggle'),click:()=>{if(live.win&&!live.win.isDestroyed())live.win.webContents.send('menu-chat-toggle');}},{label:live.languageHost.t('menu.stop'),...accelProps('stop'),click:()=>{if(live.win&&!live.win.isDestroyed())live.win.webContents.send('menu-stop');}});
  Menu.setApplicationMenu(Menu.buildFromTemplate([
   {label:'Mesa de Estudos',submenu:[{label:live.languageHost.t('menu.aboutApp'),click:()=>{if(live.win&&!live.win.isDestroyed())live.win.webContents.send('menu-about');}},{label:live.languageHost.t('menu.settingsItem'),...accelProps('settings'),click:()=>{if(live.win&&!live.win.isDestroyed())live.win.webContents.send('menu-settings');}},{type:'separator'},{role:'quit'}]},
   {label:live.languageHost.t('menu.edit'),submenu:[{role:'undo'},{role:'redo'},{type:'separator'},{role:'cut'},{role:'copy'},{role:'paste'},{role:'selectAll'}]},
   {label:live.languageHost.t('chrome.study'),submenu:study},
   {label:live.languageHost.t('menu.view'),submenu:[{id:'command-palette',label:live.languageHost.t('menu.palette'),...accelProps('command-palette'),click:()=>{if(live.win&&!live.win.isDestroyed()){live.win.webContents.focus();
       live.win.webContents.send('menu-palette');}}},{type:'separator'},{role:'reload'},{role:'togglefullscreen'}]},
   {label:live.languageHost.t('menu.help'),submenu:[{label:live.languageHost.t('menu.guide'),...accelProps('help'),click:()=>{if(live.win&&!live.win.isDestroyed())live.win.webContents.send('menu-help');}},{label:live.languageHost.t('menu.about'),click:()=>{if(live.win&&!live.win.isDestroyed())live.win.webContents.send('menu-about');}}]}
  ]));
 }
 /** @param {unknown} raw @returns {{ok: true, menu: number}} */
 function setKeymap(raw){
  keymap=normalizeKeymap(raw);
  if(live.win&&!live.win.isDestroyed())buildMenu();
  return {ok:true,menu:Object.keys(keymap).length};
 }
 function register(ipcMain){ipcMain.handle('set-keymap',(_e,raw)=>setKeymap(raw));}
 return {buildMenu,setKeymap,register};
}

module.exports={MENU_ACCEL,validAccelerator,normalizeKeymap,createDeskMenu};
