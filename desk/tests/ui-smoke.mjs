import {_electron as electron} from '@playwright/test';import assert from 'node:assert/strict';import path from 'node:path';import fs from 'node:fs';
import {testEnv} from './electron-env.mjs';
const app=await electron.launch({args:[path.resolve('main.cjs')],cwd:process.cwd(),env:testEnv({LEARNING_DESK_RUNTIME:path.resolve('.test-runtime-'+Date.now())})});
const page=await app.firstWindow();const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')console.log('CONSOLE',m.text());});
try{
 await page.waitForSelector('.pdf-panel canvas',{timeout:30000});
 await page.waitForFunction(()=>document.querySelectorAll('.page-total').length===2&&[...document.querySelectorAll('.page-total')].every(e=>!e.textContent.includes('—')),{timeout:30000});
 assert.equal(await page.locator('.pdf-panel canvas').count(),2);
 const selects=await page.locator('.pdf-select').evaluateAll(es=>es.map(e=>e.value));assert.ok(selects[0].includes('Limites'));assert.ok(selects[1].includes('Formul'));
 await page.locator('.pdf-panel').first().locator('.next').click();await page.waitForFunction(()=>document.querySelector('.page-number').value==='2');
 assert.equal(await page.locator('.page-number').nth(1).inputValue(),'1');
 await page.locator('#expression').fill('sqrt(16)+sin(pi/2)');await page.locator('#calc-form button').click();assert.equal(await page.locator('#result').textContent(),'5');
 await page.locator('#angle').selectOption('deg');await page.locator('#expression').fill('sin(30)');await page.locator('#calc-form button').click();assert.equal(await page.locator('#result').textContent(),'0.5');
 await page.locator('#study-menu .nav-trigger').click();
 await page.locator('#reference-toggle').click();assert.equal(await page.locator('.pdf-panel').nth(1).isVisible(),false);await page.locator('#reference-toggle').click();
 await page.locator('.pdf-viewport').first().evaluate(el=>{el.scrollTop=0;el.dispatchEvent(new WheelEvent('wheel',{deltaY:-120,bubbles:true,cancelable:true}));});
 await page.waitForFunction(()=>document.querySelector('.page-number').value==='1');
 await page.locator('#mesa-menu .nav-trigger').click();
 await page.locator('#settings').click();
 await page.waitForSelector('#settings-dialog[open]');
 await page.locator('#settings-dialog button[value="cancel"]').last().click();
 await page.screenshot({path:'ui-desktop.png'});
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1050,760));await page.waitForTimeout(500);await page.screenshot({path:'ui-compact.png'});
 assert.deepEqual(errors,[]);console.log('UI PASSED: two real PDFs, independent pages, calculator RAD/DEG, reference toggle, wheel page turn, settings, desktop/compact.');
}finally{await app.close();}
