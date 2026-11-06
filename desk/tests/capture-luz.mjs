// node tests/capture-luz.mjs — capturas da luminária (#101).
// Grava /tmp/mesa-luz/ em 2x, claro e escuro, sem material de curso. Não é
// teste do corredor `npm run ui`: abre cada estado do setup, o tutor pensando,
// Configurações, Guia, cabeçalho e os ícones nas seis cores.
import fs from 'node:fs';
import path from 'node:path';
import {withArtifacts,newRuntime,seedCourse,seedSession,writeConfigJson,writeDeskJson,launchDesk,statusOnline,freezeMotion,resizeWindow,setTheme,tinyPdf} from './helpers.mjs';
import {nextFrames} from './waits.mjs';

const OUT='/tmp/mesa-luz';
fs.rmSync(OUT,{recursive:true,force:true});
fs.mkdirSync(OUT,{recursive:true});
const ACCENTS=['blue','violet','green','orange','pink','graphite'];
const ACCENT_NAMES={blue:'Azul',violet:'Violeta',green:'Verde',orange:'Laranja',pink:'Rosa',graphite:'Grafite'};
const THEMES=['light','dark'];
const WIDE=[1440,900],MIN=[900,650];

async function shot(page,{name,theme,selector='#setup',scale=2}){
 await page.mouse.move(1,1);
 await nextFrames(page);
 const masked=await page.evaluate(()=>[...document.querySelectorAll('.setup-path,#setup-chosen-folder,#setup-summary dd')].map(el=>{const real=el.textContent;el.textContent=real.replace(/\/[^ ·]*\/([^/ ·]+)/g,'…/$1');return real;}));
 const viewport=await page.evaluate(()=>[innerWidth,innerHeight]);
 const box=selector?await page.locator(selector).first().boundingBox():{x:0,y:0,width:viewport[0],height:viewport[1]};
 if(!box)throw new Error(`sem caixa para capturar ${selector||'janela'}`);
 const cdp=await page.context().newCDPSession(page);
 await cdp.send('Emulation.setDeviceMetricsOverride',{width:viewport[0],height:viewport[1],deviceScaleFactor:scale,mobile:false,screenWidth:viewport[0],screenHeight:viewport[1]});
 const clip={x:Math.max(0,box.x),y:Math.max(0,box.y),width:Math.min(viewport[0]-Math.max(0,box.x),box.width),height:Math.min(viewport[1]-Math.max(0,box.y),box.height)};
 const image=await cdp.send('Page.captureScreenshot',{format:'png',clip:{...clip,scale:1}});
 fs.writeFileSync(path.join(OUT,`${name}-${theme}.png`),Buffer.from(image.data,'base64'));
 await cdp.send('Emulation.clearDeviceMetricsOverride');
 await page.evaluate(real=>{[...document.querySelectorAll('.setup-path,#setup-chosen-folder,#setup-summary dd')].forEach((el,i)=>{el.textContent=real[i];});},masked);
}

async function shotThemes(page,name,selector='#setup'){
 for(const theme of THEMES){
  await setTheme(page,theme);
  await shot(page,{name,theme,selector});
 }
}

const stubPicker=(app,paths)=>app.evaluate(({dialog},paths)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:paths});},paths);

async function transferOf(page,files){
 await page.evaluate(()=>{
  document.querySelector('#drop-source')?.remove();
  const input=document.createElement('input');input.type='file';input.id='drop-source';input.multiple=true;document.body.append(input);
 });
 await page.locator('#drop-source').setInputFiles(files);
 return page.evaluateHandle(()=>{const dt=new DataTransfer();for(const file of document.querySelector('#drop-source').files)dt.items.add(file);return dt;});
}

async function setupStates(ctx){
 const runtime=ctx.runtime=newRuntime('captura-luz-setup');
 const pdfs=path.join(runtime,'pdfs','Calculo');
 fs.mkdirSync(pdfs,{recursive:true});
 fs.writeFileSync(path.join(pdfs,'Limites.pdf'),tinyPdf('Limites',2));
 fs.writeFileSync(path.join(pdfs,'Formulario.pdf'),tinyPdf('Formulas',1));
 const app=ctx.app=await launchDesk({runtime});
 const page=await app.firstWindow();
 await page.waitForSelector('body[data-first-run="true"]',{timeout:30000});
 await resizeWindow(app,page,...WIDE);
 await freezeMotion(page);
 await nextFrames(page);

 let number=0;
 const state=async(name)=>{
  number+=1;
  await shotThemes(page,`${String(number).padStart(2,'0')}-${name}-1440x900`);
 };
 const clickNext=()=>page.locator('#setup-next').click();
 const walkTo=async(step)=>{
  for(let guard=0;guard<12;guard++){
   if(await page.locator('#setup-card').getAttribute('data-step')===step)return;
   await clickNext();
  }
  throw new Error(`não chegou a ${step}`);
 };

 await state('boas-vindas');
 await clickNext();
 await state('passeio-material');
 await clickNext();
 await state('passeio-escrita');
 await clickNext();
 await state('passeio-tutor');
 await clickNext();
 await state('passeio-onde');
 await clickNext();
 await page.locator('#first-run-name').fill('Cálculo I');
 await nextFrames(page);
 await state('nome');
 await clickNext();
 await state('pasta-esperando');
 const dt=await transferOf(page,[path.join(pdfs,'Limites.pdf')]);
 await page.locator('#setup-stage').dispatchEvent('dragenter',{dataTransfer:dt});
 await page.locator('#setup-stage').dispatchEvent('dragover',{dataTransfer:dt});
 await nextFrames(page);
 await state('pasta-arrastando');
 await page.locator('#setup-stage').dispatchEvent('dragleave',{dataTransfer:dt});
 await stubPicker(app,[pdfs]);
 await page.locator('#first-run-pick').click();
 await page.waitForFunction(()=>!document.querySelector('#setup-next').disabled);
 await nextFrames(page);
 await state('pasta-achada');
 await clickNext();
 await state('tutor-ligando');
 await page.locator('#setup-tutor-actions #connect').click();
 await page.waitForFunction(()=>document.querySelector('#setup-next').textContent.trim()==='Continuar',undefined,{timeout:30000});
 await nextFrames(page);
 await state('tutor-ligado');
 await clickNext();
 await state('pronto');

 /* Janela mínima: os passos principais não podem cortar nem esconder o botão. */
 await resizeWindow(app,page,...MIN);
 await nextFrames(page);
 for(const theme of THEMES){await setTheme(page,theme);await shot(page,{name:'min-pronto-900x650',theme});}
 await page.evaluate(async()=>{
  const mod=await import('./src/first-run.mjs');
  await mod.enterFirstRun({needsSetup:true,detectedPi:'/fake/pi',config:{}},{});
 });
 await nextFrames(page);
 for(const theme of THEMES){await setTheme(page,theme);await shot(page,{name:'min-boas-vindas-900x650',theme});}
 await clickNext();
 for(const theme of THEMES){await setTheme(page,theme);await shot(page,{name:'min-passeio-material-900x650',theme});}
 await walkTo('name');
 await page.locator('#first-run-name').fill('Cálculo I');
 await nextFrames(page);
 for(const theme of THEMES){await setTheme(page,theme);await shot(page,{name:'min-nome-900x650',theme});}
 await clickNext();
 await stubPicker(app,[pdfs]);
 await page.locator('#first-run-pick').click();
 await page.waitForFunction(()=>!document.querySelector('#setup-next').disabled);
 await nextFrames(page);
 for(const theme of THEMES){await setTheme(page,theme);await shot(page,{name:'min-pasta-achada-900x650',theme});}
 await clickNext();
 await nextFrames(page);
 for(const theme of THEMES){await setTheme(page,theme);await shot(page,{name:'min-tutor-ligando-900x650',theme});}
 await resizeWindow(app,page,...WIDE);

}

async function noEngineStates(ctx){
 const runtime=ctx.runtime=newRuntime('captura-luz-sem-motor');
 const pdfs=path.join(runtime,'pdfs','Calculo');
 fs.mkdirSync(pdfs,{recursive:true});
 fs.writeFileSync(path.join(pdfs,'Limites.pdf'),tinyPdf('Limites',2));
 const app=ctx.app=await launchDesk({runtime});
 const page=await app.firstWindow();
 await page.waitForSelector('body[data-first-run="true"]',{timeout:30000});
 await resizeWindow(app,page,...WIDE);
 await freezeMotion(page);
 await nextFrames(page);
 await page.evaluate(async()=>{
  const mod=await import('./src/first-run.mjs');
  await mod.enterFirstRun({needsSetup:true,detectedPi:'',detectedOpenCode:'',config:{}},{});
 });
 const clickNext=()=>page.locator('#setup-next').click();
 for(let guard=0;guard<12;guard++){
  if(await page.locator('#setup-card').getAttribute('data-step')==='name')break;
  await clickNext();
 }
 await page.locator('#first-run-name').fill('Cálculo I');
 await clickNext();
 await stubPicker(app,[pdfs]);
 await page.locator('#first-run-pick').click();
 await page.waitForFunction(()=>!document.querySelector('#setup-next').disabled);
 await clickNext();
 await page.waitForSelector('#setup-tutor-actions #install-opencode',{state:'visible'});
 await nextFrames(page);
 await shotThemes(page,'13-tutor-sem-motor-1440x900');
 await app.evaluate(({ipcMain})=>{
  ipcMain.removeHandler('opencode-install');
  ipcMain.handle('opencode-install',()=>new Promise(resolve=>{globalThis.__luzInstallResolve=resolve;}));
 });
 await page.locator('#setup-tutor-actions #install-opencode').click();
 await page.waitForSelector('#setup-install');
 await nextFrames(page);
 await shotThemes(page,'14-tutor-instalando-1440x900');
 await app.evaluate(()=>{globalThis.__luzInstallResolve?.({ok:false,code:'network',message:'Sem rede.'});});
 await page.waitForSelector('#setup-install-error');
 await nextFrames(page);
 await shotThemes(page,'15-tutor-falha-1440x900');
}

async function appShots(ctx){
 const runtime=ctx.runtime=newRuntime('captura-luz-app');
 const course=seedCourse(runtime,'calc');
 const session=seedSession(runtime,[]);
 writeConfigJson(runtime,{runtimePath:runtime,vaultPath:runtime,courses:[{id:'calc',name:'Cálculo',path:course}]});
 writeDeskJson(runtime,{courseId:'calc',courseStates:{calc:{session,sessions:[{path:session,started:1700000002000}],pdfs:[],study:{title:'',xopp:''}}}});
 const app=ctx.app=await launchDesk({runtime});
 const page=await app.firstWindow();
 await freezeMotion(page);
 await resizeWindow(app,page,...WIDE);

 /* Cabeçalho: a marca segue o acento nos dois temas. */
 for(const theme of THEMES){
  await setTheme(page,theme);
  for(const accent of ACCENTS){
   await page.evaluate((accent)=>{
    document.documentElement.dataset.accent=accent;
    for(const img of document.querySelectorAll('.brand-icon'))img.setAttribute('src',`assets/app-icon/lamp-${accent}-128.png`);
   },accent);
   await nextFrames(page);
   await shot(page,{name:`cabecalho-${accent}`,theme,selector:'header'});
  }
 }
 await page.evaluate(()=>{delete document.documentElement.dataset.accent;for(const img of document.querySelectorAll('.brand-icon'))img.setAttribute('src','assets/app-icon/lamp-blue-128.png');});

 /* Configurações/Aparência. */
 await page.locator('#settings-menu .nav-trigger').click();
 await page.locator('#settings-pop #settings').click();
 await page.waitForSelector('#settings-dialog[open]');
 await page.locator('#settings-tabs [data-sec="avisos"]').click();
 await page.locator('#accent-mode').scrollIntoViewIfNeeded();
 await nextFrames(page);
 for(const theme of THEMES){
  await setTheme(page,theme);
  await shot(page,{name:'configuracoes',theme,selector:'#settings-dialog'});
 }
 await page.keyboard.press('Escape');
 await page.waitForFunction(()=>!document.querySelector('#settings-dialog').open);

 /* Guia: trio na lateral e o ∇ fixo no vazio. */
 await page.keyboard.press('ControlOrMeta+/');
 await page.waitForSelector('#help-dialog[open]');
 await nextFrames(page);
 for(const theme of THEMES){
  await setTheme(page,theme);
  await shot(page,{name:'guia',theme,selector:'#help-dialog'});
 }
 await page.locator('#guide-search').fill('zzz nao existe');
 await page.waitForSelector('#guide-empty:not([hidden])');
 for(const theme of THEMES){
  await setTheme(page,theme);
  await shot(page,{name:'guia-vazio',theme,selector:'#help-dialog'});
 }
 await page.keyboard.press('Escape');
}

async function tutorThinking(ctx){
 const runtime=ctx.runtime=newRuntime('captura-luz-pensando');
 const course=seedCourse(runtime,'calc');
 const session=seedSession(runtime,[]);
 writeConfigJson(runtime,{runtimePath:runtime,vaultPath:runtime,courses:[{id:'calc',name:'Cálculo',path:course}]});
 writeDeskJson(runtime,{courseId:'calc',courseStates:{calc:{session,sessions:[{path:session,started:1700000002000}],pdfs:[],study:{title:'',xopp:''}}}});
 const app=ctx.app=await launchDesk({runtime,env:{FAKE_OPENCODE_LONG_HOLD_MS:'60000'}});
 const page=await app.firstWindow();
 await resizeWindow(app,page,...WIDE);
 await freezeMotion(page);
 await statusOnline(page);
 await page.locator('#prompt').fill('Faça uma resposta longa, por favor.');
 await page.locator('#send').click();
 await page.waitForSelector('.work-mark[data-lamp="dome"] .lamp-mark',{timeout:30000});
 for(const theme of THEMES){
  await setTheme(page,theme);
  await nextFrames(page);
  const box=await page.locator('.work-mark .lamp-mark').first().boundingBox();
  if(!box)throw new Error('sem cúpula do pensando');
  const cdp=await page.context().newCDPSession(page);
  for(const scale of [1,4]){
   await cdp.send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:scale,mobile:false,screenWidth:1440,screenHeight:900});
   const clip={x:Math.max(0,box.x-8),y:Math.max(0,box.y-8),width:box.width+16,height:box.height+16};
   const image=await cdp.send('Page.captureScreenshot',{format:'png',clip:{...clip,scale:1}});
   fs.writeFileSync(path.join(OUT,`tutor-pensando${scale===4?'-4x':''}-${theme}.png`),Buffer.from(image.data,'base64'));
  }
  await cdp.send('Emulation.clearDeviceMetricsOverride');
  await shot(page,{name:'chat-pensando',theme,selector:'#chat'});
 }
}

async function iconSheet(ctx){
 const runtime=ctx.runtime=newRuntime('captura-luz-icones');
 const app=ctx.app=await launchDesk({runtime,opencode:false});
 const page=await app.firstWindow();
 await resizeWindow(app,page,1200,1000);
 await freezeMotion(page);
 const b64=(file)=>fs.readFileSync(path.join('assets/app-icon',file)).toString('base64');
 const rows=[];
 for(const accent of ACCENTS){
  rows.push(`<h2>${ACCENT_NAMES[accent]}</h2><div class="grid">`);
  for(const size of [128,64,32,16]){
   const file=size<=32?`lamp-${accent}-${size}.png`:`lamp-${accent}-${size}.png`;
   rows.push(`<figure><img style="width:${size}px;height:${size}px" src="data:image/png;base64,${b64(file)}"><figcaption>${size} px</figcaption></figure>`);
  }
  rows.push('</div>');
 }
 const sheet=path.join(OUT,'folha-icones.html');
 fs.writeFileSync(sheet,`<!doctype html><meta charset="utf-8"><style>
 body{margin:24px;background:#f3f3f3;color:#111;font:14px system-ui,sans-serif}
 h1{font-size:22px;margin:0 0 8px}h2{font-size:14px;margin:14px 0 6px;color:#555}
 .grid{display:flex;align-items:end;gap:18px}figure{margin:0;text-align:center}
 figcaption{font-size:11px;color:#555;margin-top:4px}
 </style><h1>Luminária · seis cores · 128/64/32/16 px</h1>${rows.join('')}`);
 await page.goto('file://'+sheet);
 await page.waitForFunction(()=>[...document.images].every(i=>i.complete));
 await page.evaluate(()=>document.documentElement.style.background='#f3f3f3');
 await shot(page,{name:'folha-icones',theme:'claro',selector:'body',scale:2});
}

await withArtifacts('captura-luz-setup',setupStates);
await withArtifacts('captura-luz-sem-motor',noEngineStates);
await withArtifacts('captura-luz-app',appShots);
await withArtifacts('captura-luz-pensando',tutorThinking);
await withArtifacts('captura-luz-icones',iconSheet);
console.log('capturas em',OUT);
