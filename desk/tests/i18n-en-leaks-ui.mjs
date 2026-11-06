/* Vazamentos de português que a auditoria EN (rodada 8) achou no código, não nas
   capturas (E8–E11), mais o estado da compactação automática (o mesmo padrão de
   `::after` de E1, achado na varredura `content:`): tudo provado em inglês, com
   o app aberto em `en-US`. A E10 mora em `study-dialogs-ui.mjs` (harness). */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {withArtifacts,launchDesk,newRuntime,seedCourse,seedPlot,seedNativeSession,writeConfigJson,writeDeskJson,freezeMotion,tinyPdfPages,FAKE_OPENCODE} from './helpers.mjs';

/* Motor de bancada fechado: o tutor fica "ligando" até o teste cancelar, para a
   faixa da fila aparecer sem nada ir ao motor (a técnica do send-offline). */
function writeGateEngine(runtime){
 const wrapper=path.join(runtime,'engine-gate.mjs');
 fs.writeFileSync(wrapper,`#!/usr/bin/env node
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const here=path.dirname(new URL(import.meta.url).pathname);
const timer=setInterval(()=>{
 if(!fs.existsSync(path.join(here,'engine-gate.open')))return;
 clearInterval(timer);
 const child=spawn(process.execPath,[${JSON.stringify(FAKE_OPENCODE)},...process.argv.slice(2)],{stdio:'inherit'});
 child.on('exit',code=>process.exit(code??0));
},50);
`);
 fs.chmodSync(wrapper,0o755);
 return wrapper;
}

await withArtifacts('i18n-en-leaks',async ctx=>{
 const runtime=ctx.runtime=newRuntime('i18n-en-leaks');
 const course=seedCourse(runtime,'calc');
 const pdf=path.join(course,'Limites.pdf');
 fs.writeFileSync(pdf,tinyPdfPages(3,'Limits and derivatives'));
 const plot=seedPlot(runtime,'calc');
 const session=seedNativeSession(runtime,[
  {role:'user',content:[{type:'text',text:'hello'}],timestamp:1700000001000},
  {role:'assistant',content:[{type:'text',text:`Here is the chart:\n\n![test chart](file://${plot})`}],timestamp:1700000002000},
 ],{courseId:'calc'});
 writeConfigJson(runtime,{runtimePath:runtime,vaultPath:runtime,courses:[{id:'calc',name:'Cálculo',path:course}]});
 writeDeskJson(runtime,{session,courseId:'calc',courseStates:{calc:{session,pdfs:[{path:pdf,page:1}]}},pdfs:[{path:pdf,page:1}]});
 const app=ctx.app=await launchDesk({runtime,env:{LEARNING_DESK_LOCALE:'en-US',LEARNING_DESK_OPENCODE:writeGateEngine(runtime)}});
 const page=await app.firstWindow();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.waitForSelector('.pdf-panel canvas',{timeout:30000});
 await freezeMotion(page);

 /* E8: a busca corre e o botão volta em inglês, não "Buscar". */
 const panel=page.locator('#pdf-grid .pdf-panel').first();
 await panel.locator('.find-toggle').click();
 await panel.locator('.pdf-find').waitFor({state:'visible'});
 await panel.locator('.pdf-find input').fill('Limits');
 await panel.locator('.pdf-find button').click();
 await page.waitForFunction(()=>{
  const button=document.querySelector('#pdf-grid .pdf-panel .pdf-find button');
  return !!button&&!button.disabled&&button.textContent.trim()==='Search';
 },undefined,{timeout:30000});
 assert.equal(await panel.locator('.pdf-find button').textContent(),'Search','E8: depois da busca o botão volta em inglês');
 await page.keyboard.press('Escape');

 /* E9: o hover de copiar da imagem do tutor nasce em inglês, não "Copiar". */
 await page.waitForSelector('#messages .img-copy',{timeout:20000});
 assert.equal((await page.locator('#messages .img-copy').first().textContent()).trim(),'Copy','E9: copiar a imagem do tutor em inglês');
 /* Troca de idioma com o app aberto: os dois rótulos acompanham (revisão
    i18n, baixos de E8 e E9: só nasciam no idioma certo). */
 const swap=async lang=>{
  await page.evaluate(value=>{const select=document.querySelector('#ui-language');select.value=value;select.dispatchEvent(new Event('change',{bubbles:true}));},lang);
  await page.waitForFunction(l=>document.documentElement.lang===l,lang,{timeout:10000});
 };
 await swap('pt-BR');
 assert.equal(await panel.locator('.pdf-find button').textContent(),'Buscar','E8: a troca para PT repinta o botão da busca');
 assert.equal((await page.locator('#messages .img-copy').first().textContent()).trim(),'Copiar','E9: a troca para PT repinta o copiar');
 await swap('en');
 assert.equal(await panel.locator('.pdf-find button').textContent(),'Search','E8: e volta para EN');

 /* Varredura `content:`: o interruptor da compactação automática mostra o
    estado em inglês, não "Desativada". */
 await page.waitForFunction(()=>document.querySelector('#more-auto-compact')?.dataset.state==='Off',undefined,{timeout:10000});
 const compact=await page.evaluate(()=>{
  const el=document.querySelector('#more-auto-compact');
  return {state:el.dataset.state,shown:getComputedStyle(el,'::after').content};
 });
 assert.equal(compact.state,'Off','o data-state do interruptor vem do catálogo inglês');
 assert.equal(compact.shown,'"Off"','o menu mostra Off, sem português');

 /* E11: mensagem só com anexo vira linha em inglês na fila, não "Imagem anexada". */
 await page.waitForSelector('#tutor-state[data-state="connecting"]',{timeout:20000});
 await page.locator('#connect-cancel').click();
 await page.waitForFunction(()=>document.querySelector('#tutor-state')?.dataset.state==='off',undefined,{timeout:10000});
 await page.setInputFiles('#attach-input',plot);
 await page.waitForSelector('#attachments .attachment',{timeout:10000});
 await page.locator('#prompt').press('Enter');
 await page.waitForFunction(()=>document.querySelectorAll('.queue-item').length===1,undefined,{timeout:10000});
 assert.deepEqual(
  await page.locator('.queue-item span').evaluateAll(list=>list.map(el=>el.textContent)),
  ['Attached image'],'E11: a linha só com anexo sai em inglês');

 assert.deepEqual(errors,[],'sem erros na página');
});
