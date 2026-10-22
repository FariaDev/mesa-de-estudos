/* Gera os ícones da Mesa a partir de scripts/app-icon-art.mjs (#61).
   Rode com o Electron do projeto, que rasteriza o SVG no mesmo Chromium do app:
     node_modules/.bin/electron scripts/app-icons.cjs
   Saídas em assets/:
     mesa.svg, mesa-dock.svg, mesa-1024.png, mesa.icns, mesa.ico   ícone do pacote, violeta
     app-icon/mesa-<acento>.svg        marca do cabeçalho, por acento
     app-icon/mesa-<acento>-dock.png   Dock do macOS com o app aberto (grade do macOS)
     app-icon/mesa-<acento>-256.png    janela e barra de tarefas do Windows */
const {app,BrowserWindow}=require('electron');
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const {pathToFileURL}=require('node:url');

const ASSETS=path.join(__dirname,'..','assets');
const ICO_SIZES=[16,24,32,48,64,128,256];
const ICNS_SIZES=[16,32,128,256,512];
/* Até 32 px (de verdade, contando o @2x) vai a variante pequena (#67). */
const SMALL_MAX=32;

/** Rasteriza um SVG em PNG de `size` px pelo canvas do Chromium. */
async function rasterize(win,svg,size){
  const url='data:image/svg+xml;base64,'+Buffer.from(svg).toString('base64');
  const dataUrl=await win.webContents.executeJavaScript(`new Promise((ok,fail)=>{const img=new Image();
    img.onload=()=>{const c=document.createElement('canvas');c.width=c.height=${size};const g=c.getContext('2d');g.imageSmoothingQuality='high';g.drawImage(img,0,0,${size},${size});ok(c.toDataURL('image/png'));};
    img.onerror=()=>fail(new Error('SVG não abriu'));img.src=${JSON.stringify(url)};})`);
  return Buffer.from(dataUrl.split(',')[1],'base64');
}

/** Monta um .ico com PNGs dentro (aceito do Windows Vista em diante). */
function icoFrom(pngs){
  const header=Buffer.alloc(6);header.writeUInt16LE(1,2);header.writeUInt16LE(pngs.length,4);
  let offset=6+16*pngs.length;
  const entries=pngs.map(({size,png})=>{
    const entry=Buffer.alloc(16);
    entry.writeUInt8(size>=256?0:size,0);entry.writeUInt8(size>=256?0:size,1);
    entry.writeUInt16LE(1,4);entry.writeUInt16LE(32,6);
    entry.writeUInt32LE(png.length,8);entry.writeUInt32LE(offset,12);
    offset+=png.length;return entry;
  });
  return Buffer.concat([header,...entries,...pngs.map(({png})=>png)]);
}

async function writeBundleIcons(win,art){
  const full=art.appIconSvg(art.BUNDLE_ACCENT),grid=art.appIconSvg(art.BUNDLE_ACCENT,{grid:true});
  const smallFull=art.appIconSvg(art.BUNDLE_ACCENT,{small:true}),smallGrid=art.appIconSvg(art.BUNDLE_ACCENT,{grid:true,small:true});
  const pick=(size,big,small)=>size<=SMALL_MAX?small:big;
  fs.writeFileSync(path.join(ASSETS,'mesa.svg'),full);
  fs.writeFileSync(path.join(ASSETS,'mesa-dock.svg'),grid);
  fs.writeFileSync(path.join(ASSETS,'mesa-1024.png'),await rasterize(win,grid,1024));
  const pngs=[];
  for(const size of ICO_SIZES)pngs.push({size,png:await rasterize(win,pick(size,full,smallFull),size)});
  fs.writeFileSync(path.join(ASSETS,'mesa.ico'),icoFrom(pngs));
  const iconset=fs.mkdtempSync(path.join(app.getPath('temp'),'mesa-iconset-'))+'.iconset';
  fs.mkdirSync(iconset);
  for(const size of ICNS_SIZES){
    fs.writeFileSync(path.join(iconset,`icon_${size}x${size}.png`),await rasterize(win,pick(size,grid,smallGrid),size));
    fs.writeFileSync(path.join(iconset,`icon_${size}x${size}@2x.png`),await rasterize(win,pick(size*2,grid,smallGrid),size*2));
  }
  execFileSync('iconutil',['-c','icns',iconset,'-o',path.join(ASSETS,'mesa.icns')]);
  fs.rmSync(iconset,{recursive:true,force:true});
}

async function writeAccentIcons(win,art){
  const dir=path.join(ASSETS,'app-icon');
  fs.mkdirSync(dir,{recursive:true});
  for(const accent of Object.keys(art.ICON_ACCENTS)){
    const full=art.appIconSvg(accent);
    fs.writeFileSync(path.join(dir,`mesa-${accent}.svg`),full);
    fs.writeFileSync(path.join(dir,`mesa-${accent}-dock.png`),await rasterize(win,art.appIconSvg(accent,{grid:true}),512));
    fs.writeFileSync(path.join(dir,`mesa-${accent}-256.png`),await rasterize(win,full,256));
  }
}

app.whenReady().then(async()=>{
  const art=await import(pathToFileURL(path.join(__dirname,'app-icon-art.mjs')).href);
  const win=new BrowserWindow({show:false,webPreferences:{sandbox:true,contextIsolation:true}});
  await win.loadURL('about:blank');
  await writeBundleIcons(win,art);
  await writeAccentIcons(win,art);
  console.log('ícones gerados em assets/');
  app.quit();
}).catch(error=>{console.error(error);app.exit(1);});
