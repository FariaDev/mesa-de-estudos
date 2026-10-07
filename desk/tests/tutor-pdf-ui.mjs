/* Conversa Pi simulada; ferramenta HTTP, impressão, registro, abertura e UI reais. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {DESK,FAKE_PI,launchDesk,withArtifacts} from './helpers.mjs';
const out=path.resolve(DESK,'../docs/reviews/2026-10-07/tutor-pdf-ui');fs.mkdirSync(out,{recursive:true});
const markdown='# Teorema de Pitágoras\n\nEm um triângulo retângulo:\n\n$$a^2+b^2=c^2$$\n\n## Exemplo resolvido\n\nPara catetos de 3 cm e 4 cm:\n\n$$c=\\sqrt{3^2+4^2}=\\sqrt{25}=5\\text{ cm}$$\n\n## Pratique\n\n1. Calcule a hipotenusa com catetos de 5 cm e 12 cm.\n2. Explique como identificar a hipotenusa.';
await withArtifacts('tutor-pdf-ui',async ctx=>{
 const runtime=ctx.runtime=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'mesa-tutor-pdf-ui-')));
 const demo=path.join(runtime,'pi-tutor-demo.mjs');
 const source=fs.readFileSync(FAKE_PI,'utf8'),marker="else if(/quiz/i.test(e.message))emitQuiz(e.message);";assert.ok(source.includes(marker));
 const branch=`else if(String(e.message).includes('Prepare um PDF na Mesa')){
 streaming=true;emit({type:'agent_start'});
 (async()=>{
  try{
   const {createTutorPdf}=await import(${JSON.stringify(pathToFileURL(path.join(DESK,'src/extensions/tutor-pdf/client.mjs')).href)});
   const result=await createTutorPdf(JSON.parse(process.env.LEARNING_DESK_MATERIAL_BRIDGE),{title:'Teorema de Pitágoras',markdown:${JSON.stringify(markdown)}});
   fs.writeFileSync(${JSON.stringify(path.join(runtime,'tool-result.json'))},JSON.stringify(result));
   streaming=false;emitText('Preparei o material **Teorema de Pitágoras** com um exemplo resolvido e exercícios. Revise a prévia e clique em Salvar PDF e abrir.');
  }catch(error){streaming=false;emitText('Falha: '+error.message);}
 })();
 } ${marker}`;
 fs.writeFileSync(demo,source.replace(marker,()=>branch).replace('function emitText(text){',"function emitText(text){\n if(session)fs.appendFileSync(session,JSON.stringify({type:'message',message:{role:'assistant',content:[{type:'text',text}]}})+'\\n');"));fs.chmodSync(demo,0o755);
 fs.writeFileSync(path.join(runtime,'config.json'),JSON.stringify({runtimePath:runtime,vaultPath:runtime,courses:[],desk:{title:'Mesa de Estudos',panels:[{label:'Material',prefer:[],toggle:''},{label:'Formulário',prefer:[],toggle:'Formulário'}]}}));
 ctx.app=await launchDesk({runtime,env:{LEARNING_DESK_PI:demo}});
 const page=await ctx.app.firstWindow(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.waitForSelector('#free-bar');
 if(await page.locator('#welcome-dialog').evaluate(el=>el.open))await page.keyboard.press('Escape');
 await ctx.app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1500,960));
 await page.evaluate(async()=>{const {S,applyTheme,connect}=await import('./src/state.mjs');window.__mesaState=S;applyTheme('light');if(!S.connected)await connect();});
 await page.waitForFunction(()=>window.__mesaState.connected&&!window.__mesaState.busy);
 await page.locator('#settings-toggle').click();await page.locator('#calc-toggle').click();
 const shot=async name=>{await page.waitForTimeout(4500);await page.screenshot({path:path.join(out,name+'.png')});};
 await shot('01-livre');
 // Lateral disponível mesmo sem PDF; volta ao estado inicial antes de gerar.
 await page.locator('#support-tab-chat').click();await page.waitForSelector('#sidechat:not([hidden])');
 assert.ok(await page.locator('#sidechat').isVisible());await page.locator('#support-collapse').click();
 await page.locator('#prompt').fill('Rascunho preservado');
 await page.locator('#free-tutor-pdf').click();await page.locator('#tutor-pdf-request').fill('Um resumo de Pitágoras com exemplo resolvido e exercícios.');
 await shot('02-pedido');
 const margins=async selector=>page.locator(selector).evaluate(async dialog=>{
  await Promise.all(dialog.getAnimations().map(animation=>animation.finished.catch(()=>{})));
  const r=dialog.getBoundingClientRect(),footer=dialog.querySelector('.dialog-actions'),buttons=[...footer.querySelectorAll('button')].map(b=>b.getBoundingClientRect());
  return {right:r.right-Math.max(...buttons.map(b=>b.right)),bottom:r.bottom-Math.max(...buttons.map(b=>b.bottom))};
 });
 for(const size of [[900,650],[1500,960]]){
  await ctx.app.evaluate(({BrowserWindow},size)=>BrowserWindow.getAllWindows()[0].setSize(...size),size);
  const m=await margins('#tutor-pdf-dialog');assert.ok(m.right>=16&&m.bottom>=16,JSON.stringify(m));
 }
 await page.locator('#tutor-pdf-send').click();
 await page.waitForFunction(()=>document.querySelector('#free-pdf-dialog').open&&!window.__mesaState.busy,undefined,{timeout:30000});
 assert.equal(await page.locator('#free-pdf-title').inputValue(),'Teorema de Pitágoras');
 assert.equal(await page.locator('#free-pdf-content').inputValue(),markdown);
 assert.equal(JSON.parse(fs.readFileSync(path.join(runtime,'tool-result.json'),'utf8')).prepared,true);
 assert.equal(await page.evaluate(()=>window.__mesaState.workspace.materials.length),0,'nenhum PDF é salvo antes da revisão');
 await shot('03-previa-tutor');
 await page.keyboard.press('Escape');
 await page.reload();await page.waitForSelector('#free-bar');
 await page.evaluate(async()=>{const {S}=await import('./src/state.mjs');window.__mesaState=S;});
 await page.locator('#tutor-material-status button').click();
 assert.equal(await page.locator('#free-pdf-content').inputValue(),markdown,'conteúdo preparado persiste após reload');
 await page.locator('#free-pdf-content').fill(markdown+'\n\n**Nota da minha revisão:** identificar o ângulo reto primeiro.');
 await page.locator('#free-pdf-save').click();
 await page.waitForFunction(()=>!document.querySelector('#free-pdf-dialog').open&&!!document.querySelector('.pdf-page[data-rendered] canvas'),undefined,{timeout:60000});
 assert.equal(await page.locator('#prompt').inputValue(),'Rascunho preservado');
 await page.locator('#tutor-material-status').waitFor({state:'hidden',timeout:15000});
 const saved={path:await page.evaluate(()=>window.__mesaState.panels[0].path)};assert.ok(fs.statSync(saved.path).size>1000);
 const text=execFileSync('pdftotext',[saved.path,'-'],{encoding:'utf8'});assert.match(text,/Teorema de Pitágoras/);assert.match(text,/Pratique/);assert.match(text,/identificar o ângulo reto primeiro/);
 assert.ok(await page.locator('.pdf-panel .rotate').first().getByText('Girar').isVisible());
 await shot('04-pdf-salvo');
 await page.locator('#free-promote').click();await page.locator('#free-promote-name').fill('Geometria');
 let m=await margins('#free-promote-dialog');assert.ok(m.right>=16&&m.bottom>=16,JSON.stringify(m));await shot('05-criar-materia');await page.keyboard.press('Escape');
 await ctx.app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(900,650));
 await page.locator('#free-generate-pdf').click();m=await margins('#free-pdf-dialog');assert.ok(m.right>=16&&m.bottom>=16,JSON.stringify(m));await shot('06-montar-pdf-menor');await page.keyboard.press('Escape');
 await page.locator('#free-promote').click();m=await margins('#free-promote-dialog');assert.ok(m.right>=16&&m.bottom>=16,JSON.stringify(m));await shot('07-criar-materia-menor');await page.keyboard.press('Escape');
 assert.deepEqual(errors,[]);fs.copyFileSync(saved.path,path.join(out,'Teorema de Pitágoras.pdf'));
});
console.log('PASS: pedido visível, conteúdo do tutor persistido, revisão antes de salvar, PDF real aberto, rascunho preservado, lateral sem PDF e margens em 1500x960/900x650. Capturas: '+out);
