import {makeFixture} from './reference-fixture.mjs';
import {_electron as electron} from '@playwright/test';import path from 'node:path';
import {testEnv} from './electron-env.mjs';
const app=await electron.launch({args:[path.resolve('main.cjs')],cwd:process.cwd(),env:testEnv({LEARNING_VAULT:makeFixture(),LEARNING_DESK_RUNTIME:path.resolve('.live-runtime-reference-'+Date.now())})});
const p=await app.firstWindow();try{
 await p.waitForFunction(()=>document.querySelectorAll('.page-total')[1]?.textContent.includes('/ 1'));
 await p.locator('#connect').click();await p.waitForSelector('#status-dot.online',{timeout:60000});
 await p.locator('#prompt').fill('Verificação da mesa: consulte somente a página 1 do Formulario de teste.pdf listado nas referências abertas. Diga os dois códigos impressos abaixo do título e cite arquivo/página. É um PDF artificial de teste, sem informações pessoais. Use a fonte local, sem web ou subagentes. Responda brevemente.');
 await p.locator('#send').click();await p.waitForFunction(()=>document.querySelector('#messages').textContent.includes('ALFA-8421')&&document.querySelector('#messages').textContent.includes('BETA-7319'),null,{timeout:90000});
 await p.locator('#stop').waitFor({state:'hidden',timeout:90000});console.log('REFERENCE PASSED',await p.locator('.message.assistant').last().textContent());
 await p.screenshot({path:'ui-reference.png'});
}finally{await app.close();}
