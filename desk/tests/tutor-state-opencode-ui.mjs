// node tests/tutor-state-opencode-ui.mjs — sem OpenCode no computador, a coluna
// diz só "O tutor não atendeu." + "O OpenCode não está instalado." (sem caminho
// nem variável), oferece instalar pelas novidades e não oferece "Chamar de
// novo". O texto do motivo nunca é cortado, inclusive a 900×650.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {withArtifacts,newRuntime,seedCourse,tinyPdf,writeConfigJson,writeDeskJson,launchDesk,setTheme,freezeMotion,resizeWindow,screenshotDirectory,reviewShot} from './helpers.mjs';
import {layoutStable,nextFrames} from './waits.mjs';

const out=screenshotDirectory('tutor-state-opencode');
const read=page=>page.evaluate(()=>{
 const state=document.querySelector('#tutor-state');
 const fine=state?.querySelector('.ts-fine');
 const style=fine?getComputedStyle(fine):null;
 return {
  lead:state?.querySelector('.ts-lead')?.textContent||'',
  fine:fine?.textContent||'',
  buttons:[...(state?.querySelectorAll('.ts-actions button')||[])].map(b=>b.textContent.trim()),
  connect:!!state?.querySelector('#connect'),
  scrollHeight:fine?.scrollHeight||0,
  clientHeight:fine?.clientHeight||0,
  clamp:style?.webkitLineClamp||'',
  overflow:style?.overflowY||''
 };
});

await withArtifacts('tutor-state-opencode',async ctx=>{
 const runtime=ctx.runtime=newRuntime('tutor-opencode-missing');
 const course=seedCourse(runtime,'calc');
 const pdf=path.join(course,'Limites.pdf');fs.writeFileSync(pdf,tinyPdf('Limites'));
 writeConfigJson(runtime,{runtimePath:runtime,vaultPath:runtime,courses:[{id:'calc',name:'Cálculo',path:course}]});
 writeDeskJson(runtime,{courseId:'calc',pdfs:[{path:pdf,page:1}],study:{title:'Lista 2 · 7b',xopp:''}});
 const app=ctx.app=await launchDesk({runtime,opencode:false,env:{LEARNING_DESK_VISIBLE_ENGINES:'opencode',LEARNING_DESK_OPENCODE:'',LEARNING_DESK_CLAUDE_HOME:''}});
 const page=await app.firstWindow();
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await resizeWindow(app,page,1440,900);
 await freezeMotion(page);
 await page.waitForSelector('#tutor-state[data-state="off"]',{timeout:30000});
 await page.locator('#connect').click();
 await page.waitForSelector('#tutor-state[data-state="error"]',{timeout:30000});
 let view=await read(page);
 assert.equal(view.lead,'O tutor não atendeu.');
 assert.equal(view.fine,'O OpenCode não está instalado.','sem caminho nem variável na tela; o detalhe fica no log');
 assert.deepEqual(view.buttons,['Instalar o OpenCode','Ver o log','Ajustes do tutor']);
 assert.equal(view.connect,false,'sem "Chamar de novo": a falha é a instalação ausente');
 assert.equal(view.clamp,'none','sem clamp de reticências');
 assert.ok(view.scrollHeight<=view.clientHeight,`o motivo cabe inteiro (${view.scrollHeight} × ${view.clientHeight})`);
 for(const theme of ['light','dark']){
  await setTheme(page,theme);await nextFrames(page);
  await reviewShot(page,out,`${theme}-1440x900-tutor-nao-atendeu.png`);
 }
 await setTheme(page,'light');

 /* Janela mínima: o texto quebra dentro da coluna, sem corte. */
 await resizeWindow(app,page,900,650);
 await layoutStable(page,'#messages');
 view=await read(page);
 assert.deepEqual(view.buttons,['Instalar o OpenCode','Ver o log','Ajustes do tutor']);
 assert.ok(view.scrollHeight<=view.clientHeight,`900×650: o motivo cabe inteiro (${view.scrollHeight} × ${view.clientHeight})`);
 const width=await page.evaluate(()=>{
  const column=document.querySelector('#sidebar').getBoundingClientRect();
  const fine=document.querySelector('#tutor-state .ts-fine').getBoundingClientRect();
  return {inside:fine.left>=column.left-0.5&&fine.right<=column.right+0.5,over:document.querySelector('#tutor-state').scrollWidth-document.querySelector('#tutor-state').clientWidth};
 });
 assert.equal(width.inside,true,'o motivo fica dentro da coluna');
 assert.ok(width.over<=0.5,`nada vaza para o lado (${width.over})`);
 await reviewShot(page,out,'light-900x650-tutor-nao-atendeu.png');
 await setTheme(page,'dark');await nextFrames(page);
 await reviewShot(page,out,'dark-900x650-tutor-nao-atendeu.png');
 await setTheme(page,'light');

 /* Instalar o OpenCode abre as novidades (onde a instalação acontece). */
 await page.locator('#state-opencode-install').click();
 await page.waitForSelector('#release-notes-dialog[open]',{timeout:10000});
 await page.locator('#release-close').click();
 await page.waitForFunction(()=>!document.querySelector('#release-notes-dialog')?.open);

 assert.deepEqual(errors,[],`erros de página: ${JSON.stringify(errors)}`);
});
console.log('tutor-state-opencode-ui: ok');
