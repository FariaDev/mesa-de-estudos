import {_electron as electron} from '@playwright/test';import path from 'node:path';import assert from 'node:assert/strict';
import {testEnv} from './electron-env.mjs';
const runtime=path.resolve('.subjects-test-'+Date.now());const app=await electron.launch({args:[path.resolve('main.cjs')],cwd:process.cwd(),env:testEnv({LEARNING_DESK_RUNTIME:runtime})});
const p=await app.firstWindow();const errors=[];p.on('pageerror',e=>errors.push(e.message));
try{
 await p.waitForFunction(()=>document.querySelectorAll('.page-total').length===2&&[...document.querySelectorAll('.page-total')].every(e=>!e.textContent.includes('—')));assert.ok(await p.locator('#course-select option').count()>=4);
 await p.locator('.page-number').first().fill('3');await p.locator('#prompt').fill('rascunho de cálculo');await p.waitForFunction(()=>document.querySelector('.pdf-foot').textContent.includes('Página 3'));
 if(await p.locator('#connect').count())await p.locator('#connect').click();await p.waitForSelector('#status-dot.online',{timeout:60000});
 const original=await p.locator('#model-select').inputValue();const effort=await p.locator('#thinking-select').inputValue();assert.ok(original);assert.ok(await p.locator('#model-select option').count()>1);assert.ok(effort);
 await p.locator('#model-select').selectOption(original);await p.waitForFunction(()=>!document.querySelector('#model-select').disabled);await p.locator('#thinking-select').selectOption(effort);await p.waitForFunction(()=>!document.querySelector('#thinking-select').disabled);
 console.log('MODELS',await p.locator('#model-select option').count(),'EFFORTS',await p.locator('#thinking-select').textContent());
 await p.locator('#course-select').selectOption('Discrete Math');await p.waitForFunction(()=>!document.querySelector('#course-select').disabled&&document.title.includes('Discreta'));assert.equal(await p.locator('#prompt').inputValue(),'');
 if(await p.locator('#connect').count())await p.locator('#connect').click();await p.waitForSelector('#status-dot.online',{timeout:60000});
 assert.equal(await p.locator('.message').count(),0);
 await p.locator('#course-select').selectOption('Physics I');await p.waitForFunction(()=>!document.querySelector('#course-select').disabled&&document.title.includes('Física'));
 await p.locator('#course-select').selectOption('Calculus I');await p.waitForFunction(()=>!document.querySelector('#course-select').disabled&&document.title.includes('Cálculo'));
 assert.equal(await p.locator('.page-number').first().inputValue(),'3');assert.equal(await p.locator('#prompt').inputValue(),'rascunho de cálculo');
 await p.locator('#calc-guide summary').click();await p.locator('#expression').fill('sin(pi/2)');await p.locator('#calc-form button').click();assert.equal(await p.locator('#result').textContent(),'1');
 await p.screenshot({path:'ui-subjects.png'});assert.deepEqual(errors,[]);console.log('SUBJECTS PASSED: course libraries and drafts isolated, model/effort RPC accepted, saved page restored, calculator guide.');
}catch(e){console.log('UI ERROR',await p.locator('#toast').textContent(),'TITLE',await p.title(),errors);throw e;}finally{await app.close();}
