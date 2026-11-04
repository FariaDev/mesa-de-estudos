// node tests/capture-tema.mjs — capturas para a aprovação do tema (#tema).
// Grava /tmp/mesa-tema-final/ em 2x (deviceScaleFactor 2), claro e escuro, sem
// material de curso. Não é teste do corredor `npm run ui`.
import fs from 'node:fs';
import path from 'node:path';
import {
 withArtifacts,newRuntime,seedCourse,seedSession,writeConfigJson,writeDeskJson,
 launchDesk,statusOnline,freezeMotion,resizeWindow,setTheme,openModelPop
} from './helpers.mjs';
import {layoutStable,nextFrames} from './waits.mjs';

const OUT='/tmp/mesa-tema-final';
fs.mkdirSync(OUT,{recursive:true});
const shotFile=(name,theme)=>path.join(OUT,`${name}-${theme}.png`);
const viewport=page=>page.evaluate(()=>[innerWidth,innerHeight]);
const clipOf=(box,size,margin=0)=>{
 const [width,height]=size;
 return {
  x:Math.max(0,box.x-margin),y:Math.max(0,box.y-margin),
  width:Math.min(width,box.x+box.width+margin)-Math.max(0,box.x-margin),
  height:Math.min(height,box.y+box.height+margin)-Math.max(0,box.y-margin)
 };
};
/* Captura em 2x: o screenshot do Playwright no Electron sai em 1x; o CDP
   captura o mesmo recorte com deviceScaleFactor 2. */
async function capture(page,{selector=null,name,theme,margin=0}){
 await page.mouse.move(1,1);
 await page.evaluate(()=>{for(const tip of document.querySelectorAll('.tip'))tip.hidden=true;});
 await page.waitForTimeout(160);
 await nextFrames(page);
 const size=await viewport(page);
 const box=selector
  ? await page.locator(selector).first().boundingBox()
  : {x:0,y:0,width:size[0],height:size[1]};
 if(!box)throw Error(`sem caixa para capturar ${selector||'janela'}`);
 const cdp=await page.context().newCDPSession(page);
 await cdp.send('Emulation.setDeviceMetricsOverride',{width:size[0],height:size[1],deviceScaleFactor:2,mobile:false,screenWidth:size[0],screenHeight:size[1]});
 const clip=clipOf(box,size,margin);
 const image=await cdp.send('Page.captureScreenshot',{format:'png',clip:{...clip,scale:1},captureBeyondViewport:false});
 fs.writeFileSync(shotFile(name,theme),Buffer.from(image.data,'base64'));
 /* O override prende o viewport: sem limpar, o próximo redimensionamento não
    chega ao renderer (o teste de capturas roda o mesmo app inteiro). */
 await cdp.send('Emulation.clearDeviceMetricsOverride');
}
const conversation=[
 {type:'message',message:{role:'user',content:[{type:'text',text:'Como resolvo a lista 3, questão 2?'}]}},
 {type:'message',message:{role:'assistant',content:[{type:'text',text:'Comece pelo limite fundamental e separe o termo dominante.\n\n1. Divida numerador e denominador por x.\n2. Use sen x / x → 1 quando x → 0.\n3. Só então substitua o valor.\n\n```js\nconst limite = (x) => Math.sin(x) / x;\nconsole.log(limite(1e-6));\n```\n\nSe o denominador zera antes da simplificação, o caminho é fatorar — não substituir.'}]}}
];
const baseConfig=(runtime,course)=>writeConfigJson(runtime,{runtimePath:runtime,vaultPath:runtime,courses:[{id:'calc',name:'Cálculo',path:course}]});
const seedChat=runtime=>{
 const course=seedCourse(runtime,'calc');
 const session=seedSession(runtime,conversation);
 baseConfig(runtime,course);
 writeDeskJson(runtime,{courseId:'calc',session,courseStates:{calc:{session,sessions:[{path:session,started:1700000002000}],pdfs:[],study:{title:'',xopp:''}}}});
 return {course,session};
};

/* ---- janela inteira e caixa de perto ---- */
await withArtifacts('captura-tema-chat',async ctx=>{
 const runtime=ctx.runtime=newRuntime('captura-tema-chat');
 seedChat(runtime);
 const logFile=path.join(runtime,'queue.log');
 const env={FAKE_PI_QUEUE_LOG:logFile,FAKE_PI_QUEUE_HOLD_MS:'60000',FAKE_PI_MANY_MODELS:'1',FAKE_PI_SECOND_MODEL:'1'};
 const app=ctx.app=await launchDesk({runtime,env});
 const page=await app.firstWindow();
 await resizeWindow(app,page,1440,900);
 await freezeMotion(page);
 await statusOnline(page);
 await page.waitForSelector('.codeblock',{timeout:30000});
 await page.waitForFunction(()=>document.querySelector('.message.assistant'));

 for(const theme of ['light','dark']){
  await setTheme(page,theme);
  await capture(page,{name:'janela-conversa',theme});
 }
 /* 960px de altura: o recorte do composer mantém 24px em volta, inclusive embaixo. */
 await resizeWindow(app,page,1440,960);
 for(const theme of ['light','dark']){
  await setTheme(page,theme);
  await capture(page,{selector:'#composer',name:'composer-vazia',theme,margin:24});
 }
 await page.locator('#prompt').fill('Uma pergunta um pouco mais longa para a caixa aparecer com texto e quebrar a linha quando precisar.');
 for(const theme of ['light','dark']){
  await setTheme(page,theme);
  await capture(page,{selector:'#composer',name:'composer-com-texto',theme,margin:24});
 }
 await page.locator('#prompt').fill('');
 await page.locator('#prompt').fill('primeira pergunta');
 await page.locator('#send').click();
 await page.waitForFunction(()=>!document.querySelector('#stop').hidden,undefined,{timeout:30000});
 for(const text of ['mensagem dois','mensagem três']){
  await page.locator('#prompt').fill(text);
  await page.locator('#prompt').press('Enter');
 }
 await page.waitForFunction(()=>document.querySelectorAll('.queue-item').length===2,undefined,{timeout:10000});
 await layoutStable(page,'#composer');
 for(const theme of ['light','dark']){
  await setTheme(page,theme);
  await capture(page,{selector:'#composer',name:'composer-com-fila',theme,margin:24});
 }
 await page.locator('#stop').click();
 await page.waitForFunction(()=>document.querySelector('#stop').hidden,undefined,{timeout:60000});

 /* janela estreita: o mesmo composer com texto (altura com folga para o recorte) */
 await resizeWindow(app,page,900,720);
 await page.locator('#prompt').fill('Uma pergunta um pouco mais longa para a caixa estreita.');
 await layoutStable(page,'#composer');
 for(const theme of ['light','dark']){
  await setTheme(page,theme);
  await capture(page,{selector:'#composer',name:'composer-estreito',theme,margin:24});
 }
 await page.locator('#prompt').fill('');

 /* seletor de modelos */
 await resizeWindow(app,page,1440,900);
 await openModelPop(page);
 await page.locator('#model-list .model-row:not([aria-selected="true"])').first().hover();
 await nextFrames(page);
 for(const theme of ['light','dark']){
  await setTheme(page,theme);
  await page.locator('#model-list .model-row:not([aria-selected="true"])').first().hover();
  await capture(page,{selector:'#model-pop',name:'seletor-modelos',theme,margin:12});
 }
 await page.keyboard.press('Escape');

 /* um diálogo: Configurações */
 await page.locator('#settings-menu .nav-trigger').click();
 await page.locator('#settings-pop #settings').click();
 await page.waitForSelector('#settings-dialog[open]');
 for(const theme of ['light','dark']){
  await setTheme(page,theme);
  await capture(page,{selector:'#settings-dialog',name:'dialogo',theme,margin:12});
 }
});

/* ---- primeira execução ---- */
await withArtifacts('captura-tema-primeira',async ctx=>{
 const runtime=ctx.runtime=newRuntime('captura-tema-primeira');
 const app=ctx.app=await launchDesk({runtime,pi:false});
 const page=await app.firstWindow();
 await resizeWindow(app,page,1440,900);
 await freezeMotion(page);
 await page.waitForSelector('body[data-first-run="true"]',{timeout:30000});
 await page.waitForSelector('#setup');
 for(const theme of ['light','dark']){
  await setTheme(page,theme);
  await capture(page,{selector:'#setup',name:'primeira-execucao',theme});
 }
});

/* ---- janela de Novidades ---- */
await withArtifacts('captura-tema-novidades',async ctx=>{
 const runtime=ctx.runtime=newRuntime('captura-tema-novidades');
 const course=seedCourse(runtime,'calc');
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'calc',name:'Cálculo',path:course}]});
 writeDeskJson(runtime,{courseId:'calc',releaseNotesSeen:'1.0.2'});
 const app=ctx.app=await launchDesk({runtime,env:{LEARNING_DESK_RELEASE_VERSION:'1.1.0'}});
 const page=await app.firstWindow();
 await resizeWindow(app,page,1440,900);
 await freezeMotion(page);
 await page.waitForSelector('#release-notes-dialog[open]',{timeout:30000});
 for(const theme of ['light','dark']){
  await setTheme(page,theme);
  await capture(page,{selector:'#release-notes-dialog',name:'novidades',theme,margin:12});
 }
});
console.log('capturas em',OUT);
