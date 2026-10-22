/* Rasteriza as peças da v1.0.0 (#68) no Chromium do Electron do projeto, como
   desk/scripts/app-icons.cjs faz com os ícones. Rode a partir de desk/:
     node_modules/.bin/electron ../docs/release-assets/v1.0.0/src/render.cjs
   Cada HTML de src/ marca onde vai a arte com [data-logo] e [data-trio]; o
   script põe ali o SVG real (app-icon-art.mjs e trio-art.mjs), espera as
   fontes e tira o PNG pelo DevTools, no tamanho exato e na escala pedida.
   Cada peça sai em pt-BR e em inglês (`-en`): o inglês troca o innerHTML de
   cada [data-t] pelo texto de en.json, com o nome "Study Desk" do app. */
const {app,BrowserWindow}=require('electron');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');

const SRC=__dirname;
const OUT=path.join(__dirname,'..');
const DESK=path.join(__dirname,'..','..','..','..','desk');

/** @type {Array<{html:string,png:string,width:number,height:number,scales:number[]}>} */
const PECAS=[
 {html:'novidades.html',png:'mesa-1.0-novidades',width:1600,height:1000,scales:[1,2]},
 {html:'social-preview.html',png:'social-preview',width:1280,height:640,scales:[1]},
 {html:'banner-readme.html',png:'banner-readme',width:1600,height:400,scales:[1]},
 {html:'trio-quadrado.html',png:'trio-logo-quadrado',width:1080,height:1080,scales:[1]},
];

/** @type {Array<{id:string,suffix:string,texts:Record<string,string>|null}>} */
const IDIOMAS=[
 {id:'pt-BR',suffix:'',texts:null},
 {id:'en',suffix:'-en',texts:JSON.parse(fs.readFileSync(path.join(SRC,'en.json'),'utf8'))},
];

/** Troca os textos marcados com [data-t]; chave sem tradução para o render. */
function translateScript(lang){
 return `(()=>{
  const texts=${JSON.stringify(lang.texts)};
  document.documentElement.lang=${JSON.stringify(lang.id)};
  for(const el of document.querySelectorAll('[data-t]')){
   const text=texts[el.dataset.t];
   if(typeof text!=='string')throw new Error('sem tradução ${lang.id} para data-t='+JSON.stringify(el.dataset.t)+'; esperado uma chave de en.json');
   el.innerHTML=text;
  }
 })()`;
}

/** Põe a logo e o trio nos lugares marcados e espera as fontes. */
function fillArtScript(logoSvg,trio){
 return `(async()=>{
  for(const el of document.querySelectorAll('[data-logo]'))el.innerHTML=${JSON.stringify(logoSvg)};
  const trio=${JSON.stringify(trio)};let n=0;
  for(const el of document.querySelectorAll('[data-trio]')){
   const svg=trio[el.dataset.trio];
   if(!svg)throw new Error('data-trio desconhecido: '+JSON.stringify(el.dataset.trio)+'; esperado integral, sigma ou nabla');
   el.innerHTML=svg.replaceAll('UID',(n++).toString(36));
  }
  await document.fonts.ready;
  return document.fonts.check('500 20px "STIX Two Text"');
 })()`;
}

async function capture(win,peca,scale){
 const dbg=win.webContents.debugger;
 await dbg.sendCommand('Emulation.setDeviceMetricsOverride',{width:peca.width,height:peca.height,deviceScaleFactor:scale,mobile:false});
 const shot=await dbg.sendCommand('Page.captureScreenshot',{format:'png',clip:{x:0,y:0,width:peca.width,height:peca.height,scale:1}});
 return Buffer.from(shot.data,'base64');
}

async function renderPeca(win,peca,art,lang){
 await win.loadURL(pathToFileURL(path.join(SRC,peca.html)).href);
 if(lang.texts)await win.webContents.executeJavaScript(translateScript(lang));
 const stix=await win.webContents.executeJavaScript(fillArtScript(art.logo,art.trio));
 if(!stix)throw new Error(`STIX Two Text não carregou em ${peca.html}; confira o @import de desk/src/fonts.css`);
 for(const scale of peca.scales){
  const name=`${peca.png}${lang.suffix}${scale===1?'':`@${scale}x`}.png`;
  fs.writeFileSync(path.join(OUT,name),await capture(win,peca,scale));
  console.log(JSON.stringify({area:'release-assets',msg:'png',file:name,width:peca.width*scale,height:peca.height*scale}));
 }
}

app.whenReady().then(async()=>{
 const icon=await import(pathToFileURL(path.join(DESK,'scripts','app-icon-art.mjs')).href);
 const {trioSvg}=await import(pathToFileURL(path.join(DESK,'src','trio-art.mjs')).href);
 const art={
  logo:icon.appIconSvg(icon.BUNDLE_ACCENT),
  trio:{integral:trioSvg('integral','UID'),sigma:trioSvg('sigma','UID'),nabla:trioSvg('nabla','UID')},
 };
 const win=new BrowserWindow({show:false,width:1600,height:1000,webPreferences:{sandbox:true,contextIsolation:true}});
 win.webContents.debugger.attach('1.3');
 const only=process.argv.find(a=>a.endsWith('.html'));
 for(const peca of PECAS){
  if(only&&peca.html!==path.basename(only))continue;
  for(const lang of IDIOMAS)await renderPeca(win,peca,art,lang);
 }
 app.quit();
}).catch(error=>{console.error(error);app.exit(1);});
