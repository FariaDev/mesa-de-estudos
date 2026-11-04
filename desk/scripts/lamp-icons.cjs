/* Gera os ícones da luminária (#101).
   Rode com o Electron do projeto:
     node_modules/.bin/electron scripts/lamp-icons.cjs
   A PNG-mestra de cada acento está em scripts/lamp-art/lamp-<acento>.png; as
   saídas são só redimensionadas dela (nada de redesenhar), porque a arte inteira
   ainda se lê em 32 px. Só o 16 px usa o desenho simplificado de
   scripts/lamp-art.mjs. Saídas:
     assets/app-icon/lamp-<acento>-dock.png     Dock do macOS
     assets/app-icon/lamp-<acento>-{256,128,64,32}.png
     assets/app-icon/lamp-<acento>-16.png       variante pequena
     assets/mesa-1024.png, mesa.icns, mesa.ico  pacote azul */
const {app,BrowserWindow,nativeImage}=require('electron');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {legacyIconChunks}=require('./icns-legacy.cjs');

const ASSETS=path.join(__dirname,'..','assets');
const ART=path.join(__dirname,'lamp-art');
const ICO_SIZES=[16,24,32,48,64,128,256];
const ICNS=[['icp6',64],['ic07',128],['ic08',256],['ic09',512],['ic10',1024],['ic11',32],['ic12',64],['ic13',256],['ic14',512]];

/** Rasteriza um SVG em PNG de `size` px pelo canvas do Chromium. */
async function rasterize(win,svg,size){
  const url='data:image/svg+xml;base64,'+Buffer.from(svg).toString('base64');
  const dataUrl=await win.webContents.executeJavaScript(`new Promise((ok,fail)=>{const img=new Image();
    img.onload=()=>{const c=document.createElement('canvas');c.width=c.height=${size};const g=c.getContext('2d');g.imageSmoothingQuality='high';g.drawImage(img,0,0,${size},${size});ok(c.toDataURL('image/png'));};
    img.onerror=()=>fail(new Error('SVG não abriu'));img.src=${JSON.stringify(url)};})`);
  return Buffer.from(dataUrl.split(',')[1],'base64');
}

/** Redimensiona a PNG-mestra; em 1024 devolve os bytes originais. */
function resizeMaster(master,size){
  if(size===1024)return fs.readFileSync(master);
  const image=nativeImage.createFromPath(master);
  if(image.isEmpty())throw new Error(`PNG-mestra não abriu: ${master}`);
  return image.resize({width:size,height:size,quality:'best'}).toPNG();
}

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

function icnsFrom(pngs){
  const header=Buffer.alloc(8);header.write('icns',0,'ascii');
  const chunks=pngs.map(({type,png})=>{
    const chunk=Buffer.alloc(8);chunk.write(type,0,'ascii');chunk.writeUInt32BE(png.length+8,4);
    return Buffer.concat([chunk,png]);
  });
  const body=Buffer.concat(chunks);header.writeUInt32BE(8+body.length,4);
  return Buffer.concat([header,body]);
}

async function writeAccentIcons(win,art,accent){
  const dir=path.join(ASSETS,'app-icon');
  const master=path.join(ART,`lamp-${accent}.png`);
  if(!fs.existsSync(master))throw new Error(`PNG-mestra ausente: ${master}`);
  fs.writeFileSync(path.join(dir,`lamp-${accent}-dock.png`),resizeMaster(master,512));
  for(const size of [256,128,64,32])fs.writeFileSync(path.join(dir,`lamp-${accent}-${size}.png`),resizeMaster(master,size));
  const tiny=art.tinyLampSvg(accent);
  fs.writeFileSync(path.join(dir,`lamp-${accent}-16.png`),await rasterize(win,tiny,16));
}

async function writeBundleIcons(win,art){
  const master=path.join(ART,'lamp-blue.png');
  const tiny=art.tinyLampSvg('blue');
  fs.writeFileSync(path.join(ASSETS,'mesa-1024.png'),resizeMaster(master,1024));
  const ico=[];
  for(const size of ICO_SIZES)ico.push({size,png:size===16?await rasterize(win,tiny,size):resizeMaster(master,size)});
  fs.writeFileSync(path.join(ASSETS,'mesa.ico'),icoFrom(ico));
  const icns=[
    ...legacyIconChunks(nativeImage.createFromBuffer(await rasterize(win,tiny,16)).toBitmap(),16),
    ...legacyIconChunks(nativeImage.createFromBuffer(resizeMaster(master,32)).toBitmap(),32),
  ];
  for(const [type,size] of ICNS)icns.push({type,png:resizeMaster(master,size)});
  fs.writeFileSync(path.join(ASSETS,'mesa.icns'),icnsFrom(icns));
}

app.whenReady().then(async()=>{
  const art=await import(pathToFileURL(path.join(__dirname,'lamp-art.mjs')).href);
  const dir=path.join(ASSETS,'app-icon');
  fs.rmSync(dir,{recursive:true,force:true});
  fs.mkdirSync(dir,{recursive:true});
  const win=new BrowserWindow({show:false,webPreferences:{sandbox:true,contextIsolation:true}});
  await win.loadURL('about:blank');
  for(const accent of Object.keys(art.LAMP_ACCENTS))await writeAccentIcons(win,art,accent);
  await writeBundleIcons(win,art);
  console.log('ícones da luminária gerados em assets/');
  app.quit();
}).catch(error=>{console.error(error);app.exit(1);});
