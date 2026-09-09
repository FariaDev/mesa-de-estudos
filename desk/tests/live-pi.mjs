import {_electron as electron} from '@playwright/test';import path from 'node:path';import assert from 'node:assert/strict';
import {testEnv} from './electron-env.mjs';
const runtime=path.resolve('.live-runtime-'+Date.now());
const app=await electron.launch({args:[path.resolve('main.cjs')],cwd:process.cwd(),env:testEnv({LEARNING_DESK_RUNTIME:runtime})});
const page=await app.firstWindow();page.on('pageerror',e=>console.error(e));
try{
 await page.waitForSelector('.pdf-panel canvas',{timeout:30000});
 await page.locator('#connect').click();
 await page.waitForSelector('#status-dot.online',{timeout:60000});
 console.log('CONNECTED',await page.locator('#model').textContent());
 await page.locator('#include-refs').uncheck();
 await page.locator('#prompt').fill('Teste da mesa: responda apenas "MESA-8421" e a expressão x ao quadrado em LaTeX. Não use ferramentas.');
 await page.locator('#send').click();
 await page.waitForFunction(()=>[...document.querySelectorAll('.message.assistant')].some(e=>e.textContent.includes('MESA-8421')),{timeout:60000});
 await page.locator('#stop').waitFor({state:'hidden',timeout:60000});
 console.log('TEXT PASSED',await page.locator('.message.assistant').last().textContent());
 assert.ok(await page.locator('.message.assistant .katex').count());
 await page.locator('#prompt').fill('Confira apenas a imagem do Xournal++. Informe o identificador do teste e o primeiro erro, sem solução completa.');
 await page.locator('#check').click();
 await page.waitForFunction(()=>[...document.querySelectorAll('.message.assistant')].some(e=>e.textContent.includes('7319')),{timeout:60000});
 await page.locator('#stop').waitFor({state:'hidden',timeout:60000});
 console.log('VISUAL PASSED',await page.locator('.message.assistant').last().textContent());
 await page.screenshot({path:'ui-live.png'});
}finally{await app.close();}
const reopened=await electron.launch({args:[path.resolve('main.cjs')],cwd:process.cwd(),env:testEnv({LEARNING_DESK_RUNTIME:runtime})});
try{const p=await reopened.firstWindow();await p.locator('#connect').click();await p.waitForSelector('#status-dot.online',{timeout:60000});await p.waitForFunction(()=>document.querySelector('#messages').textContent.includes('7319'),{timeout:30000});console.log('RESTORE PASSED: real Pi session restored after closing app.');}finally{await reopened.close();}
