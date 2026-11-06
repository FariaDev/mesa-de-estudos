// node tests/capture-polimento.mjs — capturas recortadas do polimento visual.
// Grava /tmp/mesa-polimento/<componente>-<tema>.png em 2x (deviceScaleFactor 2),
// sem material de curso. Não é teste do corredor `npm run ui`.
import fs from 'node:fs';
import path from 'node:path';
import {withArtifacts,newRuntime,seedCourse,seedSession,tinyPdf,writeConfigJson,writeDeskJson,launchDesk,statusOnline,freezeMotion,resizeWindow,setTheme,openModelPop,openSessionById} from './helpers.mjs';
import {nextFrames} from './waits.mjs';

const OUT='/tmp/mesa-polimento';
fs.mkdirSync(OUT,{recursive:true});
/* O screenshot do Playwright no Electron sai em 1x mesmo com devicePixelRatio 2;
   o CDP captura o mesmo recorte do locator em 2x (deviceScaleFactor 2). */
const shot=async(page,selector,name,theme)=>{
 await page.mouse.move(1,1);
 await page.evaluate(()=>{for(const tip of document.querySelectorAll('.tip'))tip.hidden=true;});
 await page.waitForTimeout(200);
 await nextFrames(page);
 const box=await page.locator(selector).first().boundingBox();
 if(!box)throw Error(`sem caixa para capturar ${selector}`);
 const cdp=await page.context().newCDPSession(page);
 const viewport=await page.evaluate(()=>[innerWidth,innerHeight]);
 await cdp.send('Emulation.setDeviceMetricsOverride',{width:viewport[0],height:viewport[1],deviceScaleFactor:2,mobile:false,screenWidth:viewport[0],screenHeight:viewport[1]});
 const image=await cdp.send('Page.captureScreenshot',{format:'png',clip:{x:box.x,y:box.y,width:box.width,height:box.height,scale:1},captureBeyondViewport:false});
 fs.writeFileSync(path.join(OUT,`${name}-${theme}.png`),Buffer.from(image.data,'base64'));
};
async function scale2(page,width=1440,height=900){
 const cdp=await page.context().newCDPSession(page);
 await cdp.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:2,mobile:false,screenWidth:width,screenHeight:height});
}
const baseConfig=(runtime,course)=>writeConfigJson(runtime,{runtimePath:runtime,vaultPath:runtime,courses:[{id:'calc',name:'Cálculo',path:course}]});

/* ---- fila (2 e 1 mensagem), com o tutor pensando ---- */
await withArtifacts('captura-fila',async ctx=>{
 const runtime=ctx.runtime=newRuntime('captura-fila');
 const course=seedCourse(runtime,'calc');
 const session=seedSession(runtime,[{type:'message',message:{role:'user',content:[{type:'text',text:'corrente'}]}}]);
 baseConfig(runtime,course);
 writeDeskJson(runtime,{courseId:'calc',session,courseStates:{calc:{session,sessions:[{path:session,started:1700000002000}]}}});
 const app=ctx.app=await launchDesk({runtime,env:{FAKE_OPENCODE_QUEUE_LOG:path.join(runtime,'queue.log'),FAKE_OPENCODE_QUEUE_HOLD_MS:'60000'}});
 const page=await app.firstWindow();
 await resizeWindow(app,page,1440,900);
 await scale2(page);
 await freezeMotion(page);
 await statusOnline(page);
 await page.waitForTimeout(1500);
 await page.waitForFunction(()=>document.querySelector('#stop').hidden);
 await page.locator('#prompt').fill('primeira pergunta');
 await page.locator('#send').click();
 await page.waitForFunction(()=>!document.querySelector('#stop').hidden,undefined,{timeout:30000});
 for(const text of ['mensagem dois','mensagem três']){
  await page.locator('#prompt').fill(text);
  await page.locator('#prompt').press('Enter');
 }
 await page.waitForFunction(()=>document.querySelectorAll('.queue-item').length===2,undefined,{timeout:10000});
 for(const theme of ['light','dark']){
  await setTheme(page,theme);await nextFrames(page);
  await shot(page,'#composer-box','fila-2-mensagens',theme);
 }
 await page.locator('.queue-remove').last().click();
 await page.waitForFunction(()=>document.querySelectorAll('.queue-item').length===1);
 for(const theme of ['light','dark']){
  await setTheme(page,theme);await nextFrames(page);
  await shot(page,'#composer-box','fila-1-mensagem',theme);
 }
});

/* ---- tutor desligado e sem OpenCode ---- */
await withArtifacts('captura-estados',async ctx=>{
 const runtime=ctx.runtime=newRuntime('captura-estados');
 const course=seedCourse(runtime,'calc');
 const pdf=path.join(course,'Limites.pdf');fs.writeFileSync(pdf,tinyPdf('Limites'));
 baseConfig(runtime,course);
 writeDeskJson(runtime,{courseId:'calc',pdfs:[{path:pdf,page:1}],study:{title:'Lista 2 · 7b',xopp:''}});
 const app=ctx.app=await launchDesk({runtime,opencode:false,env:{LEARNING_DESK_VISIBLE_ENGINES:'opencode',LEARNING_DESK_OPENCODE:'',LEARNING_DESK_CLAUDE_HOME:''}});
 const page=await app.firstWindow();
 await resizeWindow(app,page,1440,900);
 await scale2(page);
 await freezeMotion(page);
 await page.waitForSelector('#tutor-state[data-state="off"]',{timeout:30000});
 for(const theme of ['light','dark']){
  await setTheme(page,theme);await nextFrames(page);
  await shot(page,'#tutor-state','tutor-desligado',theme);
 }
 await page.locator('#connect').click();
 await page.waitForSelector('#tutor-state[data-state="error"]',{timeout:30000});
 for(const theme of ['light','dark']){
  await setTheme(page,theme);await nextFrames(page);
  await shot(page,'#tutor-state','tutor-nao-atendeu',theme);
 }
});

/* ---- conversa antiga ---- */
await withArtifacts('captura-legado',async ctx=>{
 const runtime=ctx.runtime=newRuntime('captura-legado');
 const course=seedCourse(runtime,'calc');
 const old=path.join(runtime,'pi-1700000000000.jsonl');
 fs.writeFileSync(old,[
  {type:'message',message:{role:'user',content:[{type:'text',text:'Como resolvo a lista?'}]}},
  {type:'message',message:{role:'assistant',content:[{type:'text',text:'Comece isolando o termo.'}]}}
 ].map(line=>JSON.stringify(line)).join('\n')+'\n');
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'calc',name:'Cálculo',path:course}]});
 writeDeskJson(runtime,{courseId:'calc',session:old,courseStates:{calc:{session:old,sessions:[{path:old,started:1700000000000,preview:'Como resolvo a lista?'}]}}});
 const app=ctx.app=await launchDesk({runtime,env:{LEARNING_DESK_VISIBLE_ENGINES:'opencode'}});
 const page=await app.firstWindow();
 await resizeWindow(app,page,1440,900);
 await scale2(page);
 await freezeMotion(page);
 await openSessionById(page,old);
 await page.waitForFunction(()=>!document.querySelector('#legacy-session')?.hidden,undefined,{timeout:30000});
 for(const theme of ['light','dark']){
  await setTheme(page,theme);await nextFrames(page);
  await shot(page,'#legacy-session','conversa-antiga',theme);
 }
});

/* ---- bloco de código e seletor de modelos ---- */
await withArtifacts('captura-codigo',async ctx=>{
 const runtime=ctx.runtime=newRuntime('captura-codigo');
 const course=seedCourse(runtime,'calc');
 baseConfig(runtime,course);
 const session=seedSession(runtime,[{type:'message',message:{role:'assistant',content:[{type:'text',text:'Veja o código:\n\n```js\nconst soma = (a, b) => a + b;\nconsole.log(soma(2, 3));\n```'}]}}]);
 writeDeskJson(runtime,{courseId:'calc',session});
 const app=ctx.app=await launchDesk({runtime,env:{FAKE_OPENCODE_MANY_MODELS:'1',FAKE_OPENCODE_SECOND_MODEL:'1'}});
 const page=await app.firstWindow();
 await resizeWindow(app,page,1440,900);
 await scale2(page);
 await freezeMotion(page);
 await statusOnline(page);
 await page.waitForSelector('.codeblock',{timeout:30000});
 for(const theme of ['light','dark']){
  await setTheme(page,theme);await nextFrames(page);
  await shot(page,'.codeblock','codigo-com-linguagem',theme);
 }
 await openModelPop(page);
 await page.locator('#model-list .model-row:not([aria-selected="true"])').first().hover();
 for(const theme of ['light','dark']){
  await setTheme(page,theme);await nextFrames(page);
  await page.locator('#model-list .model-row:not([aria-selected="true"])').first().hover();
  await shot(page,'#model-pop','seletor-hover',theme);
 }
});
console.log('capturas em',OUT);
