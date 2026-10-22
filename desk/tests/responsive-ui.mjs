import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {artifactDir,withArtifacts,launchDesk,newRuntime,seedCourse,writeConfigJson,tinyPdf,statusOnline,setTheme,freezeMotion,collapseSupport,showForm,resizeWindow} from './helpers.mjs';
import {measure,assertLayout,settle} from './layout-measure.mjs';
import {layoutStable} from './waits.mjs';

/* QA responsivo real (finding R2 8): janela 900×650 (mínima do app) com 1 e 2
   leitores, Formulário/Chat lateral, recolhido e Ajustes abertos/fechados.
   Mede bounding rect dos controles principais e o overflow do documento, e
   cobra em cada estado as regras de layout do redesenho (`layout-measure.mjs`:
   painéis colados, barras de 44/40px, recuo de 12px, PDF na largura do leitor
   e nenhum controle cortado). As capturas claro/escuro saem com animações
   desligadas (estáveis) em desk/tests/artifacts/r2-ui-<stamp>/ (fora do
   runtime, não são apagadas). */

const SHOT_DIR=artifactDir(`r2-ui-${new Date().toISOString().replace(/[:.]/g,'-').replace(/Z$/,'')}`);
fs.mkdirSync(SHOT_DIR,{recursive:true});

const CONTROLS=['send','session-title','sidechat-toggle','new-session','chat-more','review-tab','course-tabs','prompt','composer','support-restore','sidechat-close','sidechat-more','sidechat-new','sidechat-send','sidechat-prompt','divider'];

async function setViewport(app,page){
 await resizeWindow(app,page,900,650);
 await layoutStable(page,'#messages');
}

/* Cada estado da janela mínima: as regras de layout e, por cima, os controles
   principais dentro da janela. */
async function assertState(page,label){
 await settle(page);
 assertLayout(await measure(page),label);
 await assertNoOverflow(page,label);
}

async function assertNoOverflow(page,label){
 const data=await page.evaluate(ids=>{
  const rects={};
  for(const id of ids){
   const el=document.getElementById(id);
   if(!el)continue;
   const style=getComputedStyle(el);
   const r=el.getBoundingClientRect();
   rects[id]={top:Math.round(r.top),bottom:Math.round(r.bottom),left:Math.round(r.left),right:Math.round(r.right),visible:r.width>0&&r.height>0&&style.visibility!=='hidden'&&style.display!=='none'};
  }
  return {rects,innerWidth,innerHeight,docScroll:document.documentElement.scrollWidth,bodyScroll:document.body.scrollWidth};
 },CONTROLS);
 for(const [id,r] of Object.entries(data.rects)){
  if(!r.visible)continue;
  assert.ok(r.top>=-1&&r.bottom<=data.innerHeight+1,`${label}: ${id} vertical dentro da janela (${r.top}..${r.bottom} de ${data.innerHeight})`);
  assert.ok(r.left>=-1&&r.right<=data.innerWidth+1,`${label}: ${id} horizontal dentro da janela (${r.left}..${r.right} de ${data.innerWidth})`);
 }
 /* Largura utilizável: nenhum controle principal vira um risco ilegível. */
 const minWidths={'session-title':64,'sidechat-toggle':24,'new-session':24,'chat-more':24,'send':44,'sidechat-close':24};
 for(const [id,min] of Object.entries(minWidths)){
  const r=data.rects[id];
  if(!r||!r.visible)continue;
  assert.ok(r.right-r.left>=min,`${label}: ${id} tem largura utilizável (${r.right-r.left} >= ${min})`);
 }
 assert.ok(data.docScroll<=data.innerWidth+1,`${label}: documentElement sem overflow horizontal (${data.docScroll} > ${data.innerWidth})`);
 assert.ok(data.bodyScroll<=data.innerWidth+1,`${label}: body sem overflow horizontal (${data.bodyScroll} > ${data.innerWidth})`);
 /* O composer não pode invadir a calculadora (era o vazamento visual do
    relatório em 900×650). */
 const overlap=await page.evaluate(()=>{
  const composer=document.querySelector('#composer')?.getBoundingClientRect();
  const calc=document.querySelector('#calculator')?.getBoundingClientRect();
  if(!composer||!calc)return false;
  const overlapY=Math.min(composer.bottom,calc.bottom)-Math.max(composer.top,calc.top);
  const overlapX=Math.min(composer.right,calc.right)-Math.max(composer.left,calc.left);
  return overlapX>0&&overlapY>1;
 });
 assert.equal(overlap,false,`${label}: composer não invade a calculadora`);
 /* Nenhum botão do cabeçalho (matérias, Caderno, menus) vaza para a direita. */
 const headerButtons=await page.evaluate(()=>[...document.querySelectorAll('header button')].filter(el=>{
  const style=getComputedStyle(el),rect=el.getBoundingClientRect();
  return style.display!=='none'&&style.visibility!=='hidden'&&rect.width>0&&rect.height>0;
 }).map(el=>{const rect=el.getBoundingClientRect();return {name:el.id||el.textContent.trim().slice(0,20),left:Math.round(rect.left),right:Math.round(rect.right),top:Math.round(rect.top),bottom:Math.round(rect.bottom)};}));
 for(const button of headerButtons){
  assert.ok(button.left>=-1&&button.right<=data.innerWidth+1,`${label}: botão do cabeçalho "${button.name}" horizontal dentro da janela (${button.left}..${button.right})`);
  assert.ok(button.top>=-1&&button.bottom<=data.innerHeight+1,`${label}: botão do cabeçalho "${button.name}" vertical dentro da janela`);
 }
 return data;
}

async function shot(page,name){
 await freezeMotion(page);
 await page.screenshot({path:path.join(SHOT_DIR,name)});
}

async function openLateral(page){
 await page.locator('#sidechat-toggle').click();
 await page.waitForFunction(()=>{const sc=document.querySelector('#sidechat');return sc&&!sc.hidden;},{timeout:15000});
 await layoutStable(page,'#sidechat');
}

await withArtifacts('responsivo-900-dois',async ctx=>{
 const runtime=ctx.runtime=newRuntime('responsivo-900-dois'),course=seedCourse(runtime,'Test');
 fs.writeFileSync(path.join(course,'Limites.pdf'),tinyPdf('Exercise'));
 fs.writeFileSync(path.join(course,'Formulario.pdf'),tinyPdf('Support'));
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'Test',name:'Teste',path:course}],desk:{pinnedExtensions:false}});
 ctx.app=await launchDesk({runtime});
 const page=await ctx.app.firstWindow();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await statusOnline(page);
 await page.waitForSelector('.pdf-panel canvas',{timeout:25000});
 await setViewport(ctx.app,page);
 await freezeMotion(page);

 /* Dois leitores, Formulário à frente. */
 await assertState(page,'900x650 dois leitores');
 await shot(page,'900-dois-claro.png');

 /* Ajustes abertos: o diálogo inteiro cabe na janela. */
 await page.keyboard.press('ControlOrMeta+,');
 await page.waitForSelector('#settings-dialog[open]');
 const dialog=await page.locator('#settings-dialog').evaluate(el=>{const r=el.getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,innerWidth,innerHeight};});
 assert.ok(dialog.top>=-1&&dialog.bottom<=dialog.innerHeight+1,'Ajustes: diálogo vertical dentro da janela');
 assert.ok(dialog.left>=-1&&dialog.right<=dialog.innerWidth+1,'Ajustes: diálogo horizontal dentro da janela');
 await assertState(page,'900x650 com Ajustes abertos');
 await page.keyboard.press('Escape');
 await page.waitForFunction(()=>!document.querySelector('#settings-dialog').open);

 /* Chat lateral aberto e depois recolhido. */
 await openLateral(page);
 await assertState(page,'900x650 com lateral aberto');
 await shot(page,'900-dois-lateral.png');
 await collapseSupport(page);
 await page.locator('#support-restore').waitFor({state:'visible',timeout:5000});
 await assertState(page,'900x650 apoio recolhido');
 await shot(page,'900-dois-recolhido.png');
 await showForm(page);
 await page.waitForFunction(()=>document.querySelector('#support-restore')?.hidden===true);
 await layoutStable(page,'#messages');

 /* endDay off no menu e de volta. */
 await page.keyboard.press('ControlOrMeta+,');
 await page.waitForSelector('#settings-dialog[open]');
 await page.locator('#settings-tab-mesa').click();
 await page.locator('#cfg-desk-endDay').uncheck();
 await page.locator('#settings-save').click();
 await page.waitForFunction(()=>!document.querySelector('#settings-dialog').open);
 await page.waitForSelector('.pdf-panel',{timeout:15000});
 await layoutStable(page,'.pdf-panel');
 await page.locator('#chat-more').click();
 assert.equal(await page.locator('#chat-more-pop #end-day').isHidden(),true,'endDay desligado some do Mais opções do tutor');
 await page.keyboard.press('Escape');
 await assertState(page,'900x650 endDay off');
 await page.keyboard.press('ControlOrMeta+,');
 await page.waitForSelector('#settings-dialog[open]');
 await page.locator('#settings-tab-mesa').click();
 await page.locator('#cfg-desk-endDay').check();
 await page.locator('#settings-save').click();
 await page.waitForFunction(()=>!document.querySelector('#settings-dialog').open);
 await page.waitForSelector('.pdf-panel',{timeout:15000});
 await layoutStable(page,'.pdf-panel');
 await page.locator('#chat-more').click();
 assert.equal(await page.locator('#chat-more-pop #end-day').isVisible(),true,'endDay ligado volta ao Mais opções do tutor');
 await page.keyboard.press('Escape');
 await assertState(page,'900x650 endDay on');

 /* Flag `conferir` e disponibilidade da captura na dica do composer (R2 7). */
 await page.keyboard.press('ControlOrMeta+,');
 await page.waitForSelector('#settings-dialog[open]');
 await page.locator('#settings-tab-mesa').click();
 await page.locator('#cfg-desk-conferir').uncheck();
 await page.locator('#settings-save').click();
 await page.waitForFunction(()=>!document.querySelector('#settings-dialog').open);
 await page.waitForSelector('.pdf-panel',{timeout:15000});
 await page.waitForFunction(()=>document.querySelector('#check')?.hidden===true,undefined,{timeout:5000}).catch(()=>{});
assert.equal(await page.locator('#check').isHidden(),true,'conferir off esconde o botão de captura');
 assert.doesNotMatch(await page.locator('#goes-along').textContent(),/Conferir|captura/i,'conferir off não deixa rastro na linha Vai junto');
 await page.keyboard.press('ControlOrMeta+,');
 await page.waitForSelector('#settings-dialog[open]');
 await page.locator('#settings-tab-mesa').click();
 await page.locator('#cfg-desk-conferir').check();
 await page.locator('#settings-save').click();
 await page.waitForFunction(()=>!document.querySelector('#settings-dialog').open);
 await page.waitForSelector('.pdf-panel',{timeout:15000});
 await page.waitForFunction(()=>document.querySelector('#check')?.hidden===false,undefined,{timeout:5000}).catch(()=>{});
assert.equal(await page.locator('#check').isHidden(),false,'conferir on volta com o botão de captura');
 await page.evaluate(async()=>{const state=await import('./src/state.mjs');state.S.captureOk=false;state.setBusy(false);});
 assert.match(await page.locator('#check').getAttribute('title'),/indisponível/i,'captura indisponível aparece no botão Conferir');
 await page.evaluate(async()=>{const state=await import('./src/state.mjs');state.S.captureOk=true;state.setBusy(false);});
 assert.match(await page.locator('#check').getAttribute('title'),/Anexar a captura/i,'captura disponível aparece no botão Conferir');
 await assertState(page,'900x650 conferir on');

 /* Tema escuro (captura estabilizada). */
 await setTheme(page,'dark');
 await shot(page,'900-dois-escuro.png');
 await setTheme(page,'auto');

 assert.deepEqual(errors,[]);
 console.log('PASS: 900x650 com 2 leitores, Ajustes, lateral/recolhido e endDay on/off sem overflow');
});

await withArtifacts('responsivo-900-um-leitor',async ctx=>{
 const runtime=ctx.runtime=newRuntime('responsivo-900-um'),course=seedCourse(runtime,'Test');
 fs.writeFileSync(path.join(course,'Lista.pdf'),tinyPdf('Only one reader'));
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'Test',name:'Teste',path:course}],desk:{panels:[{label:'Lista',prefer:['Lista']}],pinnedExtensions:false}});
 ctx.app=await launchDesk({runtime});
 const page=await ctx.app.firstWindow();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await statusOnline(page);
 await page.waitForSelector('.pdf-panel canvas',{timeout:25000});
 await setViewport(ctx.app,page);
 await freezeMotion(page);
 await assertState(page,'900x650 um leitor');
 await openLateral(page);
 await assertState(page,'900x650 um leitor com lateral');
 await shot(page,'900-um-lateral.png');
 assert.deepEqual(errors,[]);
 console.log('PASS: 900x650 com 1 leitor e lateral aberto sem overflow');
});

console.log('Screenshots:',SHOT_DIR);
