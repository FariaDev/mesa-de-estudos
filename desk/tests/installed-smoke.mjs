import {_electron as electron} from '@playwright/test';import path from 'node:path';import assert from 'node:assert/strict';
import {testEnv} from './electron-env.mjs';
const executable=path.resolve('..','Mesa de Estudos.app','Contents','MacOS','Electron');
const runtime=path.resolve('.installed-test-'+Date.now());let app;
try{app=await electron.launch({executablePath:executable,args:[],env:testEnv({LEARNING_DESK_RUNTIME:runtime})});const p=await app.firstWindow();
 await p.waitForFunction(()=>document.querySelectorAll('.page-total').length===2&&[...document.querySelectorAll('.page-total')].every(e=>!e.textContent.includes('—')));
 await p.locator('.page-number').first().fill('3');await p.locator('.page-number').first().press('Enter');await p.locator('#expression').click();
 await p.waitForFunction(()=>document.querySelector('.pdf-foot').textContent.includes('Página 3'));
 await p.locator('.pdf-panel').first().locator('.in').click();await p.waitForFunction(()=>document.querySelector('.zoom-label').textContent==='120%');
 if(await p.locator('#connect').count())await p.locator('#connect').click();await p.waitForSelector('#status-dot.online',{timeout:60000});
 await p.locator('#expression').fill('2^3^2');await p.locator('#calc-form button').click();assert.equal(await p.locator('#result').textContent(),'512');
 await p.screenshot({path:'ui-installed.png'});await app.close();app=null;
 app=await electron.launch({executablePath:executable,args:[],env:testEnv({LEARNING_DESK_RUNTIME:runtime})});const restored=await app.firstWindow();await restored.waitForFunction(()=>document.querySelector('.pdf-foot')?.textContent.includes('Página 3'));
 assert.equal(await restored.locator('.zoom-label').first().textContent(),'120%');assert.equal(await restored.locator('.page-number').nth(1).inputValue(),'1');
 console.log('PACKAGED APP PASSED: actual bundle, PDFs, Pi extension discovery, calculator, page/zoom restoration.');
}finally{await app?.close();}
