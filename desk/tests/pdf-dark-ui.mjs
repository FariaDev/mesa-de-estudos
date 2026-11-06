import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {withArtifacts,launchDesk,newRuntime,seedCourse,writeConfigJson,writeDeskJson,freezeMotion,resizeWindow,menuLocator} from './helpers.mjs';
import {layoutStable,pdfRenderIdle,pollUntil} from './waits.mjs';

/* Página escura do PDF (#107): o padrão continua o inverter da #42, pixel a
   pixel, e a opção Suave é escolha da pessoa em Configurações → Aparência. O
   botão do leitor continua ligando/desligando; a escolha só define o filtro.
   Mede o filtro computado, o papel e as cores de uma figura sintética (vermelho
   e azul seguem reconhecíveis), prova que a camada de texto e o recorte/captura
   não levam o filtro e que a escolha persiste ao reabrir. Capturas em
   /tmp/mesa-107-*.png. */

const WIDE=[1440,900];
const SHOT=name=>`/tmp/mesa-107-${name}.png`;
const RED='1 0 0 rg 72 600 120 80 re f';
const BLUE='0 0 1 rg 220 600 120 80 re f';

/* PDF sintético com duas figuras coloridas e texto — nada de material de curso. */
function colorPdf(){
 const contents=`${RED}\n${BLUE}\nBT /F1 16 Tf 72 500 Td (figura colorida de teste) Tj ET`;
 const objects=['<</Type/Catalog/Pages 2 0 R>>','<</Type/Pages/Kids[3 0 R]/Count 1>>','<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Resources<</Font<</F1 4 0 R>>>>/Contents 5 0 R>>','<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>',`<</Length ${contents.length}>>\nstream\n${contents}\nendstream`];
 let out='%PDF-1.4\n';const offsets=[];
 objects.forEach((object,index)=>{offsets.push(out.length);out+=`${index+1} 0 obj\n${object}\nendobj\n`;});
 const startxref=out.length;
 out+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.map(offset=>`${String(offset).padStart(10,'0')} 00000 n \n`).join('')}trailer\n<</Size ${objects.length+1}/Root 1 0 R>>\nstartxref\n${startxref}\n%%EOF\n`;
 return Buffer.from(out,'latin1');
}

async function boot(runtime,errors=[]){
 const app=await launchDesk({runtime,pi:false});
 const page=await app.firstWindow();
 page.on('pageerror',error=>errors.push(error.message));
 await page.waitForSelector('.pdf-panel canvas',{timeout:30000});
 await pdfRenderIdle(page);
 await freezeMotion(page);
 return {app,page,errors};
}

/* A página inteira precisa caber na vista para as amostras de pixel: 50% deixa
   o A4 sintético (612×792) inteiro na janela de 1440×900. */
async function fitWholePage(page){
 await page.evaluate(async()=>{const {S}=await import('./src/state.mjs');S.panels[0].nudgeZoom(-.5);});
 await page.waitForFunction(()=>document.querySelector('.pdf-more-pop .zoom-label')?.textContent.trim()==='50%',undefined,{timeout:10000});
 await pdfRenderIdle(page);
}

const panel=page=>page.locator('.pdf-panel').first();

async function invertOn(page){
 if(await page.locator('.pdf-panel .pdf-viewport').first().evaluate(el=>el.classList.contains('inverted')))return;
 await menuLocator(panel(page),'.invert').click();
 await page.waitForFunction(()=>document.querySelector('.pdf-panel .pdf-viewport').classList.contains('inverted'));
}
async function invertOff(page){
 if(!(await page.locator('.pdf-panel .pdf-viewport').first().evaluate(el=>el.classList.contains('inverted'))))return;
 await menuLocator(panel(page),'.invert').click();
 await page.waitForFunction(()=>!document.querySelector('.pdf-panel .pdf-viewport').classList.contains('inverted'));
}

const darkFacts=page=>page.evaluate(()=>{
 const viewport=document.querySelector('.pdf-panel .pdf-viewport');
 const canvas=viewport.querySelector('.pdf-page canvas');
 const pageEl=viewport.querySelector('.pdf-page');
 const layer=viewport.querySelector('.pdf-page .textLayer');
 return {
  inverted:viewport.classList.contains('inverted'),
  pdfDark:document.documentElement.dataset.pdfDark||'invert',
  filter:getComputedStyle(canvas).filter,
  paper:getComputedStyle(pageEl).backgroundColor,
  pageFilter:getComputedStyle(pageEl).filter,
  textFilter:layer?getComputedStyle(layer).filter:'',
  imgFilter:getComputedStyle(viewport.querySelector('.pdf-page img')||canvas).filter
 };
});

async function openAppearance(page){
 await page.keyboard.press('ControlOrMeta+,');
 await page.waitForSelector('#settings-dialog[open]');
 await page.locator('#settings-tab-avisos').click();
 await page.locator('#pdf-dark').scrollIntoViewIfNeeded();
}
async function pickSoft(page){
 await openAppearance(page);
 await page.locator('#pdf-dark').selectOption('soft');
 await page.waitForFunction(()=>document.documentElement.dataset.pdfDark==='soft');
 await page.keyboard.press('Escape');
 await page.waitForFunction(()=>!document.querySelector('#settings-dialog').open);
}
async function pickInvert(page){
 await openAppearance(page);
 await page.locator('#pdf-dark').selectOption('invert');
 await page.waitForFunction(()=>!document.documentElement.dataset.pdfDark);
 await page.keyboard.press('Escape');
 await page.waitForFunction(()=>!document.querySelector('#settings-dialog').open);
}

/* Amostra pixels da tela: recorte do canvas no PNG e leitura pelo nativeImage
   do Electron (BGRA). Os pontos são frações do retângulo do canvas. */
async function pixelsOfCanvas(app,page,points){
 const box=await page.locator('.pdf-page canvas').first().boundingBox();
 const shot=await page.screenshot({clip:box,scale:'css'});
 return app.evaluate(({nativeImage},{data,points})=>{
  const image=nativeImage.createFromBuffer(Buffer.from(data,'base64'));
  const size=image.getSize(),bitmap=image.getBitmap();
  const at=({x,y})=>{
   const px=Math.round(x*size.width),py=Math.round(y*size.height);
   const i=(py*size.width+px)*4;
   return {r:bitmap[i+2],g:bitmap[i+1],b:bitmap[i],a:bitmap[i+3]};
  };
  return {size,points:points.map(at)};
 },{data:shot.toString('base64'),points});
}
const RED_POINT={x:.2,y:.19};
const BLUE_POINT={x:.46,y:.19};
const PAPER_POINT={x:.85,y:.08};

/* Papel e figuras de um PNG de anexo (data URL): recorte/captura não podem ter
   o filtro. A imagem é desenhada num canvas e amostrada em frações. */
const attachmentPixels=(page,index,points)=>page.evaluate(async({index,points})=>{
 const img=document.querySelectorAll('#attachments .attachment img')[index];
 if(!img)return null;
 const image=new Image();image.src=img.src;await image.decode();
 const canvas=document.createElement('canvas');
 canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
 const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);
 return points.map(({x,y})=>{
  const data=ctx.getImageData(Math.floor(x*canvas.width),Math.floor(y*canvas.height),1,1).data;
  return {r:data[0],g:data[1],b:data[2],a:data[3]};
 });
},{index,points});

const saved=runtime=>{try{return JSON.parse(fs.readFileSync(path.join(runtime,'desk.json'),'utf8'));}catch{return null;}};

await withArtifacts('pdf-dark-ui',async ctx=>{
 const runtime=ctx.runtime=newRuntime('pdf-dark');
 const course=seedCourse(runtime,'Test');
 fs.writeFileSync(path.join(course,'Cores.pdf'),colorPdf());
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'Test',name:'Cálculo I',path:course}],desk:{panels:[{label:'Lista',prefer:['Cores']}],pinnedExtensions:false}});
 writeDeskJson(runtime,{courseId:'Test'});
 const errors=[];
 let {app,page}=await boot(runtime,errors);
 ctx.app=app;
 await resizeWindow(app,page,...WIDE);
 await layoutStable(page,'main');
 await fitWholePage(page);

 /* ---------- 1. Padrão: exatamente o inverter de hoje ---------- */
 const off=await darkFacts(page);
 assert.equal(off.inverted,false,'a página escura começa desligada');
 assert.equal(off.pdfDark,'invert','quem nunca escolheu está no Inverter');
 assert.equal(off.filter,'none','desligada não há filtro');
 assert.equal(off.paper,'rgb(255, 255, 255)','desligada o papel é branco');
 await page.screenshot({path:SHOT('desligada')});
 await invertOn(page);
 const today=await darkFacts(page);
 assert.equal(today.filter,'invert(1) hue-rotate(180deg)','o padrão computado é o filtro da #42');
 assert.equal(today.paper,'rgb(0, 0, 0)','o papel padrão é preto puro');
 assert.equal(today.pageFilter,'none','o filtro não fica no contêiner da página');
 assert.equal(today.textFilter,'none','a camada de texto não leva filtro');
 await page.screenshot({path:SHOT('inverter')});
 const todayPixels=await pixelsOfCanvas(app,page,[PAPER_POINT,RED_POINT,BLUE_POINT]);
 assert.ok(todayPixels.points[0].r<=4&&todayPixels.points[0].g<=4&&todayPixels.points[0].b<=4,`o papel do Inverter é preto (${JSON.stringify(todayPixels.points[0])})`);
 assert.ok(todayPixels.points[1].r>todayPixels.points[1].g+24&&todayPixels.points[1].r>todayPixels.points[1].b+24,`a figura vermelha continua vermelha no Inverter (${JSON.stringify(todayPixels.points[1])})`);
 assert.ok(todayPixels.points[2].b>todayPixels.points[2].r+24&&todayPixels.points[2].b>todayPixels.points[2].g+24,`a figura azul continua azul no Inverter (${JSON.stringify(todayPixels.points[2])})`);

 /* ---------- 2. Suave: cinza escuro, menos brilho, cores reconhecíveis ---------- */
 await pickSoft(page);
 const soft=await darkFacts(page);
 assert.equal(soft.inverted,true,'a escolha não desliga o botão do leitor');
 assert.equal(soft.pdfDark,'soft');
 assert.equal(soft.filter,'invert(0.85) hue-rotate(180deg) brightness(0.92)','o filtro Suave é o combinado escolhido');
 assert.equal(soft.paper,'rgb(35, 35, 35)','o papel Suave é cinza escuro, não preto puro');
 assert.equal(soft.pageFilter,'none');
 assert.equal(soft.textFilter,'none');
 await page.screenshot({path:SHOT('suave')});
 const softPixels=await pixelsOfCanvas(app,page,[PAPER_POINT,RED_POINT,BLUE_POINT]);
 assert.ok(softPixels.points[0].r>=24&&softPixels.points[0].r<=48,`o papel Suave é cinza escuro (${JSON.stringify(softPixels.points[0])})`);
 assert.ok(softPixels.points[1].r>softPixels.points[1].g+24&&softPixels.points[1].r>softPixels.points[1].b+24,`a figura vermelha continua reconhecível no Suave (${JSON.stringify(softPixels.points[1])})`);
 assert.ok(softPixels.points[2].b>softPixels.points[2].r+24&&softPixels.points[2].b>softPixels.points[2].g+24,`a figura azul continua reconhecível no Suave (${JSON.stringify(softPixels.points[2])})`);

 /* ---------- 3. O botão continua ligando/desligando o que a escolha definiu ---------- */
 await invertOff(page);
 const softOff=await darkFacts(page);
 assert.equal(softOff.filter,'none','desligar tira o filtro Suave');
 assert.equal(softOff.paper,'rgb(255, 255, 255)','desligar devolve o papel branco');
 await invertOn(page);
 assert.equal((await darkFacts(page)).filter,soft.filter,'ligar de novo volta ao Suave');
 await page.screenshot({path:SHOT('suave-ligada')});

 /* ---------- 4. Captura e recorte não levam o filtro ---------- */
 await menuLocator(panel(page),'.page-shot').click();
 await page.waitForSelector('#attachments .attachment img',{timeout:15000});
 const shotPixels=await attachmentPixels(page,0,[{x:.01,y:.01},{x:.85,y:.08}]);
 assert.ok(shotPixels[0].r>220&&shotPixels[0].g>220&&shotPixels[0].b>220,`a captura da página sai do canvas cru, sem filtro (${JSON.stringify(shotPixels[0])})`);
 assert.ok(shotPixels[1].r>240&&shotPixels[1].g>240&&shotPixels[1].b>240,`o papel da captura segue branco (${JSON.stringify(shotPixels[1])})`);
 /* Citar a fórmula do PDF usa o mesmo canvas cru: o recorte também fica branco.
    O glifo de seta entra na camada de texto real (o PDF sintético usa Helvetica,
    sem glifo matemático) só para a seleção ser reconhecida como fórmula. */
 await page.evaluate(()=>{
  const layer=document.querySelector('.pdf-panel .pdf-page .textLayer');
  const span=document.createElement('span');
  span.id='formula-fixture';span.textContent='→';
  span.style.cssText='position:absolute;left:80px;top:360px;font-size:16px;color:transparent';
  layer.append(span);
  const range=document.createRange();range.selectNodeContents(span);
  const selection=getSelection();selection.removeAllRanges();selection.addRange(range);
 });
 await page.waitForFunction(()=>!document.querySelector('#quote-btn').hidden,undefined,{timeout:10000});
 await page.locator('#quote-btn').click();
 await page.waitForFunction(()=>document.querySelectorAll('#attachments .attachment img').length>=2,undefined,{timeout:15000});
 const cropPixels=await attachmentPixels(page,1,[{x:.02,y:.02}]);
 assert.ok(cropPixels[0].r>220&&cropPixels[0].g>220&&cropPixels[0].b>220,`o recorte para o tutor não leva filtro (${JSON.stringify(cropPixels[0])})`);

 /* ---------- 5. Voltar ao Inverter muda na hora; Suave persiste ao reabrir ---------- */
 await pickInvert(page);
 assert.equal((await darkFacts(page)).filter,'invert(1) hue-rotate(180deg)','voltar ao Inverter vale na hora');
 assert.equal((await darkFacts(page)).paper,'rgb(0, 0, 0)');
 await pickSoft(page);
 await pollUntil(()=>saved(runtime),state=>state?.pdfDark==='soft',{timeout:8000,interval:100,what:'a escolha Suave no desk.json'});
 await app.close();
 ({app,page}=await boot(runtime,errors));
 ctx.app=app;
 await resizeWindow(app,page,...WIDE);
 await layoutStable(page,'main');
 await fitWholePage(page);
 await invertOn(page);
 const reopened=await darkFacts(page);
 assert.equal(reopened.pdfDark,'soft','a escolha Suave volta ao reabrir');
 assert.equal(reopened.filter,soft.filter,'o filtro salvo volta ao reabrir');
 assert.equal(reopened.paper,'rgb(35, 35, 35)');
 await page.screenshot({path:SHOT('suave-reaberta')});
 const config=fs.readFileSync(path.join(runtime,'config.json'),'utf8');
 assert.doesNotMatch(config,/pdfDark/,'a página escura não vai para o config.json');

 assert.deepEqual(errors,[]);
 console.log('PASS: página escura do PDF — Inverter padrão pixel a pixel, Suave cinza escuro com cores reconhecíveis, botão liga/desliga, captura/recorte sem filtro e persistência.');
});
