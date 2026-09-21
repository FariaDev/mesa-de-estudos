// Sonda de isolamento: abre hunt-bench.html numa janela Electron oculta e
// imprime no stdout cada linha de BENCH do renderer. Uso:
//   node_modules/electron/dist/Electron.app/Contents/MacOS/Electron tests/hunt-bench.cjs
const {app,BrowserWindow}=require('electron');
const path=require('node:path');
app.whenReady().then(async()=>{
 const win=new BrowserWindow({show:false,width:900,height:600,webPreferences:{contextIsolation:true,nodeIntegration:false}});
 win.webContents.on('console-message',(_e,_level,message)=>{if(/^BENCH/.test(message))console.log(message);});
 win.webContents.on('render-process-gone',(_e,details)=>console.log('BENCH renderer-gone',JSON.stringify(details)));
 await win.loadFile(path.join(__dirname,'hunt-bench.html'));
 setTimeout(()=>{app.quit();process.exit(0);},40000);
});
