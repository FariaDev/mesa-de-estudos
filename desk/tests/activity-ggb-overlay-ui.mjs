/* O applet do GeoGebra é uma view nativa, acima de toda a página: qualquer
   sobreposição de página inteira tem de tirá-la de cima (#52). Prova por pixel,
   na janela como o usuário vê (`screencapture`, que inclui a view):
   - o applet recebe um marcador magenta, no documento dele, para o teste não
     depender de o GeoGebra ter terminado de carregar;
   - tela cheia de visualização, imagem ampliada (lightbox) e diálogo de
     Configurações: o magenta some e quem está por cima é a página;
   - ao fechar, o magenta volta no mesmo lugar, e o MESMO documento (o marcador
     segue lá): o applet não foi recarregado nem perdeu a construção.
   Só no macOS (captura de janela com views). */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
 withArtifacts,newRuntime,seedCourse,writeConfigJson,writeDeskJson,launchDesk,statusOnline,tinyPdf,DESK,
 reviewShot,screenshotDirectory,freezeMotion,resizeWindow,pageWindow
} from './helpers.mjs';
import {layoutStable,nextFrames,pollUntil} from './waits.mjs';
import {captureWindow,pixelsAt,rgbDistance} from './window-pixels.mjs';

if(process.platform!=='darwin'){
 console.log('activity-ggb-overlay-ui: SKIP — a prova por pixel usa a captura de janela do macOS.');
 process.exit(0);
}

const out=screenshotDirectory('activity-ggb-overlay');
const MAGENTA=[255,0,255];
const MARKER_ID='mesa-test-marker';

/** Pinta o documento da view do GeoGebra e devolve o retângulo dela (px CSS da página). */
async function paintApplet(app,page){
 const win=await pageWindow(app,page);
 const painted=await win.evaluate(async(bw,id)=>{
  const view=bw.contentView.children.find(child=>child.webContents&&child.webContents!==bw.webContents);
  if(!view)return false;
  return view.webContents.executeJavaScript(`(()=>{let el=document.getElementById(${JSON.stringify(id)});if(!el){el=document.createElement('div');el.id=${JSON.stringify(id)};el.style.cssText='position:fixed;inset:0;background:#ff00ff;z-index:2147483647';document.body.append(el);}return true;})()`);
 },MARKER_ID);
 assert.equal(painted,true,'a view do GeoGebra existe e aceitou o marcador');
}
const markerAlive=async(app,page)=>(await pageWindow(app,page)).evaluate((bw,id)=>{
 const view=bw.contentView.children.find(child=>child.webContents&&child.webContents!==bw.webContents);
 return view?view.webContents.executeJavaScript(`!!document.getElementById(${JSON.stringify(id)})`):false;
},MARKER_ID);

/** Pontos dentro da área do applet (abaixo da barra dele), longe das bordas. */
const appletPoints=page=>page.evaluate(()=>{
 const ref=document.querySelector('#references').getBoundingClientRect(),bar=document.querySelector('#ggb-bar').offsetHeight;
 const left=ref.left,top=ref.top+bar,width=ref.width,height=ref.height-bar;
 return [[.25,.3],[.5,.5],[.75,.7],[.5,.85]].map(([x,y])=>({x:Math.round(left+width*x),y:Math.round(top+height*y)}));
});

await withArtifacts('activity-ggb-overlay',async ctx=>{
 const runtime=ctx.runtime=newRuntime('ggb-overlay');
 const course=seedCourse(runtime,'calc');
 const pdf=path.join(course,'Limites.pdf');fs.writeFileSync(pdf,tinyPdf('Limites'));
 writeConfigJson(runtime,{runtimePath:runtime,vaultPath:runtime,courses:[{id:'calc',name:'Cálculo I',path:course}]});
 writeDeskJson(runtime,{courseId:'calc',courseStates:{calc:{pdfs:[{path:pdf,page:1}],study:{title:'',xopp:''}}}});
 const pi=path.join(DESK,'tests/fixtures/mesa-interactive-pi.mjs');fs.chmodSync(pi,0o755);
 ctx.app=await launchDesk({runtime,env:{LEARNING_DESK_PI:pi}});
 const page=await ctx.app.firstWindow(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await resizeWindow(ctx.app,page,1440,900,{content:true});
 await statusOnline(page);
 await freezeMotion(page);
 await page.waitForSelector('.pdf-panel canvas',{timeout:30000});
 await page.evaluate(async()=>{await (await import('./src/state.mjs')).connect();});
 await page.waitForFunction(()=>!document.querySelector('#send').disabled,undefined,{timeout:30000});
 await page.locator('#prompt').fill('Mostre uma figura.');
 await page.locator('#send').click();
 const slot=page.locator('.activity-slot[data-activity-call="integrated-call-1"]');
 await slot.locator('.activity-card[data-state="ready"]').waitFor({timeout:30000});

 await page.locator('#course-tabs button[data-id="geogebra"]').click();
 await page.waitForFunction(()=>document.querySelector('#references').classList.contains('ggb'));
 await paintApplet(ctx.app,page);
 await layoutStable(page,'#references');
 const points=await appletPoints(page);
 const sample=async name=>{
  await nextFrames(page,4);
  const shot=await captureWindow(ctx.app,page,path.join(runtime,`${name}.png`));
  return pixelsAt(ctx.app,shot,points);
 };
 const allMagenta=rgbs=>rgbs.every(rgb=>rgbDistance(rgb,MAGENTA)<=8);
 const noMagenta=rgbs=>rgbs.every(rgb=>rgbDistance(rgb,MAGENTA)>=60);
 const settle=(what,want)=>pollUntil(async()=>sample('poll'),rgbs=>want(rgbs),{timeout:6000,interval:150,what,onTimeout:'return'});

 /* Aberto, sem nada por cima: o applet é o que se vê. */
 await settle('o applet aparecer',allMagenta);
 assert.ok(allMagenta(await sample('aberto')),'GeoGebra aberto: o applet está à vista');
 await reviewShot(page,out,'ggb-aberto.png');

 const cover=async(label,open,close)=>{
  await open();
  await settle(`${label}: o applet sair de cima`,noMagenta);
  const covered=await sample(label);
  assert.ok(noMagenta(covered),`${label}: a sobreposição fica por cima do applet (${JSON.stringify(covered)})`);
  await reviewShot(page,out,`${label}.png`);
  await close();
  await settle(`${label}: o applet voltar`,allMagenta);
  assert.ok(allMagenta(await sample(`${label}-fechado`)),`${label}: ao fechar o applet volta no mesmo lugar`);
  assert.equal(await markerAlive(ctx.app,page),true,`${label}: é o mesmo documento do applet, sem recarregar`);
  assert.equal(await page.evaluate(()=>document.querySelector('#references').classList.contains('ggb')),true,`${label}: a aba GeoGebra segue ativa`);
 };

 await cover('tela-cheia-visualizacao',async()=>{
  await slot.locator('.activity-stage').hover();
  await slot.locator('[data-act="expand"]').evaluate(el=>el.click());
  await page.waitForFunction(()=>!!document.querySelector('.activity-fullscreen'));
 },async()=>{
  await page.keyboard.press('Escape');
  await page.waitForFunction(()=>!document.querySelector('.activity-fullscreen'));
 });

 await cover('imagem-ampliada',async()=>{
  await page.evaluate(async()=>{
   const svg='<svg xmlns="http://www.w3.org/2000/svg" width="320" height="220"><rect width="320" height="220" fill="#2b6cb0"/></svg>';
   (await import('./src/chat-assets.mjs')).openImageDialog('','data:image/svg+xml;utf8,'+encodeURIComponent(svg),'Figura');
  });
  await page.waitForSelector('#image-dialog[open]');
 },async()=>{
  await page.keyboard.press('Escape');
  await page.waitForFunction(()=>!document.querySelector('#image-dialog').open);
 });

 await cover('configuracoes',async()=>{
  await page.keyboard.press('ControlOrMeta+,');
  await page.waitForSelector('#settings-dialog[open]');
 },async()=>{
  await page.locator('#settings-dialog button[value="cancel"]').last().click();
  await page.waitForFunction(()=>!document.querySelector('#settings-dialog').open);
 });

 /* Duas sobreposições ao mesmo tempo: só volta quando a última fecha. */
 await page.keyboard.press('ControlOrMeta+,');
 await page.waitForSelector('#settings-dialog[open]');
 await page.evaluate(async()=>{(await import('./src/chat-assets.mjs')).openImageDialog('','data:image/svg+xml;utf8,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"/>'),'Figura');});
 await page.waitForSelector('#image-dialog[open]');
 await page.keyboard.press('Escape');
 await page.waitForFunction(()=>!document.querySelector('#image-dialog').open);
 await nextFrames(page,6);
 assert.ok(noMagenta(await sample('uma-restante')),'com uma sobreposição ainda aberta o applet segue escondido');
 await page.locator('#settings-dialog button[value="cancel"]').last().click();
 await settle('o applet voltar depois da última',allMagenta);
 assert.ok(allMagenta(await sample('todas-fechadas')),'fechada a última sobreposição o applet volta');
 assert.deepEqual(errors,[]);
});
console.log('activity-ggb-overlay-ui: PASS — tela cheia, imagem ampliada e diálogo ficam por cima do applet do GeoGebra (por pixel) e ele volta no mesmo lugar e no mesmo documento ao fechar.');
