// node tests/about-origin-ui.mjs — de onde o app se atualiza no Sobre (#109).
// Mesma versão, origens diferentes: Release oficial, worktree e origem que
// sumiu. A origem inválida NÃO diz "Atualizada": diz que não dá para verificar.
// Capturas sintéticas em /tmp/mesa-109-{normal,worktree,unavailable}.png.
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import {
 withArtifacts,newRuntime,seedCourse,writeConfigJson,writeDeskJson,launchDesk,freezeMotion,setTheme
} from './helpers.mjs';

const shotFile=state=>path.join(os.tmpdir(),`mesa-109-${state}.png`);
const CHECK_CURRENT={status:'current',version:'1.1.0',notes:'',url:'',current:'1.1.0',checkedAt:Date.now()};
const CHECK_UNVERIFIABLE={status:'unverifiable',version:'',notes:'',url:'',current:'1.1.0'};

async function paintState(app,origin,check){
 await app.evaluate(({ipcMain},payload)=>{
  ipcMain.removeHandler('update-origin');
  ipcMain.handle('update-origin',async()=>payload.origin);
  ipcMain.removeHandler('update-check');
  ipcMain.handle('update-check',async()=>payload.check);
 },{origin,check});
}

async function openAbout(page){
 await page.locator('#settings-menu .nav-trigger').click();
 await page.locator('#about').click();
 await page.waitForSelector('#about-dialog[open]');
 await page.waitForFunction(()=>![...document.querySelectorAll('#component-rows .component-state')].some(e=>e.textContent==='Verificando…'),undefined,{timeout:10000});
}

async function closeAbout(page){
 await page.locator('#about-dialog .dialog-close').click();
 await page.waitForFunction(()=>!document.querySelector('#about-dialog').open);
}

const originText=page=>page.locator('#about-origin').evaluate(el=>el.textContent);
const updateText=page=>page.locator('#about-update .update-text').evaluate(el=>el.textContent);

await withArtifacts('about-origin',async ctx=>{
 const runtime=ctx.runtime=newRuntime('about-origin-ui');
 const course=seedCourse(runtime,'calc');
 writeConfigJson(runtime,{runtimePath:runtime,vaultPath:runtime,courses:[{id:'calc',name:'Cálculo I',path:course}]});
 writeDeskJson(runtime,{accent:'violet',courseId:'calc',courseStates:{calc:{pdfs:[],study:{title:'',xopp:''}}}});
 ctx.app=await launchDesk({runtime});
 const page=await ctx.app.firstWindow();
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.waitForSelector('#settings-menu .nav-trigger');
 await freezeMotion(page);
 await ctx.app.evaluate(({ipcMain})=>{
  ipcMain.removeHandler('components');
  ipcMain.handle('components',async()=>({rows:[]}));
 });
 await setTheme(page,'light');

 /* 1. Origem normal: a instalação da Release não tem caminho na tela. */
 await paintState(ctx.app,{kind:'normal',path:'',worktree:false},CHECK_CURRENT);
 await openAbout(page);
 await page.waitForFunction(()=>document.querySelector('#about-origin')?.textContent==='Release oficial');
 assert.equal(await page.locator('#about-origin').isVisible(),true);
 assert.equal(await originText(page),'Release oficial');
 assert.equal(await page.locator('#about-origin .about-origin-path').count(),0,'origem normal não mostra caminho');
 await page.waitForFunction(()=>/^Atualizada\. Conferido hoje às \d{1,2}:\d{2}\.$/.test(document.querySelector('#about-update .update-text')?.textContent||''));
 await page.screenshot({path:shotFile('normal'),animations:'disabled'});
 await closeAbout(page);

 /* 2. Worktree que recebe atualização: estado real + pasta de desenvolvimento. */
 const worktree='~/Developer/mesa-e-conversa-worktrees/modelo-de-testes-da-issue-109-bem-comprido';
 await paintState(ctx.app,{kind:'development',path:worktree,worktree:true},CHECK_CURRENT);
 await openAbout(page);
 await page.waitForFunction(()=>document.querySelector('#about-origin')?.textContent?.startsWith('Pasta de desenvolvimento (worktree) ·'));
 assert.equal(await originText(page),`Pasta de desenvolvimento (worktree) · ${worktree}`);
 const labelEl=page.locator('#about-origin .about-origin-label');
 assert.ok(await labelEl.evaluate(el=>el.scrollWidth<=el.clientWidth),'o rótulo inteiro fica à vista');
 const pathEl=page.locator('#about-origin .about-origin-path');
 assert.equal(await pathEl.getAttribute('title'),worktree,'o caminho completo fica no title');
 assert.equal(await pathEl.evaluate(el=>getComputedStyle(el).textOverflow),'ellipsis','o caminho corta por CSS');
 assert.ok(await pathEl.evaluate(el=>el.scrollWidth>el.clientWidth),'o caminho longo é cortado na linha');
 await page.waitForFunction(()=>/^Atualizada\./.test(document.querySelector('#about-update .update-text')?.textContent||''),undefined,{timeout:10000});
 await page.screenshot({path:shotFile('worktree'),animations:'disabled'});

 /* A mesma versão da origem normal, distinguível pela tela. */
 assert.notEqual(await originText(page),'Release oficial');

 /* 3. Origem inválida: nada de "Atualizada"; o Sobre diz que não dá para verificar. */
 await closeAbout(page);
 await paintState(ctx.app,{kind:'unavailable',path:'~/Developer/mesa-e-conversa-worktrees/issue-109-sumiu'},CHECK_UNVERIFIABLE);
 await openAbout(page);
 await page.waitForFunction(()=>document.querySelector('#about-origin')?.textContent?.startsWith('Origem indisponível ·'));
 assert.equal(await originText(page),'Origem indisponível · ~/Developer/mesa-e-conversa-worktrees/issue-109-sumiu');
 await page.waitForFunction(()=>document.querySelector('#about-update .update-text')?.textContent==='Não dá para verificar atualizações: a origem não está disponível.');
 assert.doesNotMatch(await updateText(page),/Atualizada/);
 assert.equal(await page.locator('#update-apply').count(),0,'sem origem não há "Atualizar e reiniciar"');
 await page.screenshot({path:shotFile('unavailable'),animations:'disabled'});

 assert.deepEqual(errors,[]);
});
console.log('about-origin-ui: PASS — Release oficial, worktree e origem inválida medidos no Sobre; capturas em /tmp/mesa-109-*.png.');
