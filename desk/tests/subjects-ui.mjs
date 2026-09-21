import {_electron as electron} from '@playwright/test';import assert from 'node:assert/strict';
import {withArtifacts,launchDesk,newRuntime} from './helpers.mjs';

await withArtifacts('subjects',async ctx=>{
 // subjects-ui usa o Pi REAL (sem fake-pi) e descobre matérias pelo vault (seedConfig).
 const runtime=ctx.runtime=newRuntime('subjects');
 const app=ctx.app=await launchDesk({runtime,pi:false});
 const p=await app.firstWindow();const errors=[];p.on('pageerror',e=>errors.push(e.message));
 try{
 await p.waitForFunction(()=>document.querySelectorAll('.page-total').length===2&&[...document.querySelectorAll('.page-total')].every(e=>!e.textContent.includes('—')));assert.ok(await p.locator('#course-tabs button').count()>=4);
 let page3=false;
 for(let i=0;i<6&&!page3;i++){
  await p.locator('.page-number').first().fill('3');
  await p.locator('.page-number').first().blur();
  try{await p.waitForFunction(()=>document.querySelector('.pdf-foot').textContent.includes('Página 3'),{timeout:2000});page3=true;}catch{}
 }
 assert.ok(page3,'page-number change should survive the deferred re-render');
 await p.locator('#prompt').fill('rascunho de cálculo');
 if(await p.locator('#connect').count())await p.locator('#connect').click();await p.waitForSelector('#status-dot.online',{timeout:60000});
 const original=await p.locator('#model-select').inputValue();const effort=await p.locator('#thinking-select').inputValue();assert.ok(original);assert.ok(await p.locator('#model-select option').count()>1);assert.ok(effort);
 await p.locator('#model-select').selectOption(original);await p.waitForFunction(()=>!document.querySelector('#model-select').disabled);await p.locator('#thinking-select').selectOption(effort);await p.waitForFunction(()=>!document.querySelector('#thinking-select').disabled);
 console.log('MODELS',await p.locator('#model-select option').count(),'EFFORTS',await p.locator('#thinking-select').textContent());
 await p.locator('#course-tabs button[data-id="Discrete Math"]').click();await p.waitForFunction(()=>document.title.includes('Discreta'));assert.equal(await p.locator('#prompt').inputValue(),'');
 if(await p.locator('#connect').count())await p.locator('#connect').click();await p.waitForSelector('#status-dot.online',{timeout:60000});
 assert.equal(await p.locator('.message').count(),0);
 await p.locator('#course-tabs button[data-id="Physics I"]').click();await p.waitForFunction(()=>document.title.includes('Física'));if(await p.locator('#connect').count())await p.locator('#connect').click();await p.waitForSelector('#status-dot.online',{timeout:60000});
 await p.locator('#course-tabs button[data-id="Calculus I"]').click();await p.waitForFunction(()=>document.title.includes('Cálculo'));await p.waitForFunction(()=>document.querySelectorAll('.page-number')[0].value==='3',{timeout:30000});
 assert.equal(await p.locator('.page-number').first().inputValue(),'3');assert.equal(await p.locator('#prompt').inputValue(),'rascunho de cálculo');
 await p.locator('#calc-guide summary').click();await p.locator('#expression').fill('sin(pi/2)');await p.locator('#calc-form button').click();assert.equal(await p.locator('#result').textContent(),'1');
 await p.screenshot({path:'ui-subjects.png'});assert.deepEqual(errors,[]);console.log('SUBJECTS PASSED: course libraries and drafts isolated, model/effort RPC accepted, saved page restored, calculator guide.');
 }catch(e){console.log('UI ERROR',await p.locator('#toast').textContent(),'TITLE',await p.title(),errors);throw e;}
});
