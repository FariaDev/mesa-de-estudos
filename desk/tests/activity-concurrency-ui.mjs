// Main/preload reais, Pi e seletor nativo sintéticos. Confirma que gravações
// de atividades aguardam uma mutação da Mesa sem perder o escopo ou falhar.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {launchDesk,withArtifacts,DESK,enterFree} from './helpers.mjs';
import {pollUntil} from './waits.mjs';

await withArtifacts('activity-concurrency',async ctx=>{
 ctx.runtime=fs.mkdtempSync(path.join(os.tmpdir(),'mesa-activity-concurrency-'));
 const pi=path.join(DESK,'tests/fixtures/mesa-interactive-pi.mjs');fs.chmodSync(pi,0o755);
 fs.writeFileSync(path.join(ctx.runtime,'config.json'),JSON.stringify({runtimePath:ctx.runtime,vaultPath:ctx.runtime,courses:[]}));
 ctx.app=await launchDesk({runtime:ctx.runtime,env:{LEARNING_DESK_PI:pi}});
 const page=await ctx.app.firstWindow();
 await enterFree(page);
 await page.evaluate(async()=>{await (await import('./src/state.mjs')).connect();});
 for(const text of ['Crie uma atividade de movimento.','Crie uma atividade com katex.']){
  await page.locator('#prompt').fill(text);await page.locator('#send').click();
  await page.waitForFunction(()=>!document.querySelector('#send').disabled);
 }
 const items=await page.evaluate(async()=>{const {items}=await window.desk.activityList();return items;});
 assert.equal(items.length,2);
 /* Cada cartão carrega o iframe e, ao ficar pronto, grava o estado inicial dele
    (values {a:2,guess:null}) com um atraso de debounce. Com várias janelas
    abertas esse carregamento e esse debounce passavam a chegar DEPOIS das
    gravações do teste e as sobrescreviam. Espera os dois cartões prontos e os
    PARA — o clique em Parar descarrega o estado pendente e remove o iframe de
    forma síncrona, então nada do cartão escreve mais (o cartão pode ser
    redesenhado depois, por isso não se espera o rótulo "parado") — e só então confere o estado inicial no disco. */
 await page.waitForFunction(()=>{
  const cards=[...document.querySelectorAll('.activity-card')];
  return cards.length>=2&&cards.every(card=>card.dataset.state==='ready');
 },undefined,{timeout:30000});
 for(const stop of await page.locator('.activity-card [data-act="stop"]').all())await stop.click();
 await page.waitForFunction(async items=>{
  const states=await Promise.all(items.map(item=>window.desk.activityStateGet(item)));
  return states.every(entry=>entry&&entry.state&&entry.state.values);
 },items,{timeout:30000});
 // O seletor mantém uma mutação em voo até a liberação explícita do teste.
 await ctx.app.evaluate(({dialog})=>{
  globalThis.__activityDialogRelease=null;
  dialog.showOpenDialog=()=>new Promise(resolve=>{
   globalThis.__activityDialogRelease=()=>resolve({canceled:true,filePaths:[]});
  });
 });
 await page.evaluate(()=>{
  window.__activityDialog=window.desk.freeOpenPdf();
  window.__activitySavesDone=false;window.__activitySaveError=null;
 });
 await pollUntil(()=>ctx.app.evaluate(()=>typeof globalThis.__activityDialogRelease),kind=>kind==='function',{timeout:8000,interval:20,what:'a operação nativa iniciar',onTimeout:'return'});
 assert.equal(await ctx.app.evaluate(()=>typeof globalThis.__activityDialogRelease),'function','operação nativa iniciou');
 await page.evaluate(items=>{
  window.__activitySaves=Promise.all(items.map((item,index)=>window.desk.activityStateSave({
   ...item,state:{values:{index},attempt:{answer:index+10}},
  }))).then(()=>{window.__activitySavesDone=true;},error=>{window.__activitySaveError=error.message;});
 },items);
 await page.waitForTimeout(100);// espera fixa: "nada acontece em 0,1 s" — as gravações aguardam a mutação nativa em vez de recusar
 assert.deepEqual(await page.evaluate(()=>({done:window.__activitySavesDone,error:window.__activitySaveError})),{done:false,error:null},'gravações aguardam a mutação; não recusam nem escrevem durante ela');
 await ctx.app.evaluate(()=>globalThis.__activityDialogRelease());
 await page.evaluate(async()=>{await window.__activityDialog;await window.__activitySaves;});
 assert.equal(await page.evaluate(()=>window.__activitySaveError),null);
 const saved=await page.evaluate(items=>Promise.all(items.map(item=>window.desk.activityStateGet(item))),items);
 saved.forEach((entry,index)=>assert.deepEqual(entry.state,{values:{index},attempt:{answer:index+10}}));
 // Reproduz o conflito original com impressão e persistência de PDF reais.
 const results=await page.evaluate(async item=>{
  const pdf=window.desk.freeSaveMaterial({title:'Concorrência sintética',markdown:'Material sintético com $x=2$.'});
  await new Promise(resolve=>setTimeout(resolve,20));// espera fixa: separa em 20 ms o salvamento do PDF e o do estado — é a corrida do conflito original
  const state=window.desk.activityStateSave({...item,state:{values:{index:4},attempt:null}});
  return Promise.all([pdf,state]);
 },items[0]);
 assert.equal(results[0].saved,true);assert.equal(results[1].saved,true);
 assert.deepEqual((await page.evaluate(item=>window.desk.activityStateGet(item),items[0])).state,{values:{index:4},attempt:null});
});
console.log('activity-concurrency-ui: PASS — two card saves wait for a native operation; real PDF and activity state both persist.');
