// Electron controls regression with artificial SDK/account/course only.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {withArtifacts,newRuntime,seedCourse,writeDeskJson,writeConfigJson,launchDesk,sendEnabled,statusOnline,pickModel,pickEffort,DESK} from './helpers.mjs';
const conversations=createRequire(import.meta.url)('../src/agents/conversations.cjs');
await withArtifacts('claude-controls',async ctx=>{
 const runtime=ctx.runtime=newRuntime('claude-controls'),folder=seedCourse(runtime,'Controls');
 const file=conversations.createClaudeConversation({runtime,courseId:'Controls'});
 const starts=path.join(runtime,'pi-starts'),trap=path.join(runtime,'pi-trap.sh'),log=path.join(runtime,'claude-prompts.log');
 fs.writeFileSync(trap,`#!/bin/sh\nprintf started >> '${starts}'\nexit 1\n`,{mode:0o755});
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'Controls',name:'Controls',path:folder}]});
 writeDeskJson(runtime,{courseId:'Controls',session:file,courseStates:{Controls:{session:file,sessions:[{path:file}]}}});
 const nativeId=conversations.readClaudeConversation(file,{runtime}).nativeSessionId;
 const launch=()=>launchDesk({runtime,pi:false,env:{LEARNING_DESK_PI:trap,FAKE_CLAUDE_LOG:log,LEARNING_DESK_CLAUDE_SDK_FACTORY:path.join(DESK,'tests','fixtures','claude-sdk-fake.mjs')}});
 const rows=()=>fs.existsSync(log)?fs.readFileSync(log,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse):[];
 let app=ctx.app=await launch(),page=await app.firstWindow();
 await statusOnline(page,{timeout:60000});
 assert.equal(rows().length,0,'catalog initialization must not send a prompt');
 await page.waitForSelector('#model-field:not([hidden])',{state:'attached'}); // o campo mora no popover (fechado)
 await page.evaluate(()=>window.desk.settings({model:{provider:'anthropic',id:'claude-fake'},level:'max'}));
 assert.equal(conversations.readClaudeConversation(file,{runtime}).effort,'max','combined patch validates the new model');
 const unsupportedCombined=await page.evaluate(async()=>{try{await window.desk.settings({model:{provider:'anthropic',id:'claude-lite'},level:'max'});return '';}catch(error){return error.message;}});
 assert.ok(unsupportedCombined,'unsupported combined patch rejected atomically');
 assert.equal(conversations.readClaudeConversation(file,{runtime}).model,'claude-fake');
 assert.equal(conversations.readClaudeConversation(file,{runtime}).effort,'max');
 await page.evaluate(()=>window.desk.settings({model:{provider:'anthropic',id:''},level:'default'}));
 await pickModel(page,'anthropic','claude-fake'); // modelo e esforço moram no popover do indicador (ticket #14)
 await page.waitForFunction(()=>document.querySelector('#effort-strip').getAttribute('aria-disabled')==='false');
 await pickEffort(page,'max');
 await page.waitForFunction(()=>document.querySelector('#effort-strip').getAttribute('aria-disabled')==='false'&&document.querySelector('#effort-strip [aria-checked="true"]')?.dataset.level==='max');
 assert.equal(await page.locator('#effort-strip [data-level="default"]').textContent(),'Padrão do Claude','o nível padrão diz o motor (#58)');
 let record=conversations.readClaudeConversation(file,{runtime});
 assert.equal(record.model,'claude-fake');assert.equal(record.effort,'max');assert.equal(record.nativeSessionId,nativeId);
 await page.locator('#prompt').fill('selected controls');await page.locator('#send').click();await sendEnabled(page);
 assert.equal(rows().at(-1).model,'claude-fake');assert.equal(rows().at(-1).effort,'max');
 await pickModel(page,'anthropic','claude-lite'); // o clique fora (enviar) fechou o popover
 await page.waitForFunction(()=>{const field=document.querySelector('#effort-field'),strip=document.querySelector('#effort-strip');return field?.hidden===false&&strip.getAttribute('aria-disabled')==='true'&&strip.querySelector('[aria-checked="true"]')?.dataset.level==='default'&&/Escolha um modelo/.test(strip.title);});
 record=conversations.readClaudeConversation(file,{runtime});assert.equal(record.model,'claude-lite');assert.equal(record.effort,undefined);
 const rejected=await page.evaluate(async()=>{try{await window.desk.settings({level:'max'});return '';}catch(error){return error.message;}});
 /* O erro sai do processo principal como mensagem marcada e é traduzido onde aparece (#41 fase 3). */
 assert.match(rejected,/err\.model\.effort/);
 await pickModel(page,'anthropic','');
 await page.waitForFunction(()=>document.querySelector('#model-list').getAttribute('aria-disabled')==='false'&&document.querySelector('#model-list [role="option"][data-key][aria-selected="true"]')?.dataset.key===JSON.stringify(['anthropic','']));
 record=conversations.readClaudeConversation(file,{runtime});assert.equal(record.model,undefined);assert.equal(record.effort,undefined);
 await page.locator('#prompt').fill('native default');await page.locator('#send').click();await sendEnabled(page);
 assert.equal(rows().at(-1).model,null);assert.equal(rows().at(-1).effort,null);
 await pickModel(page,'anthropic','claude-fake');
 await page.waitForFunction(()=>document.querySelector('#effort-strip').getAttribute('aria-disabled')==='false');
 await pickEffort(page,'high');
 await page.waitForFunction(()=>document.querySelector('#effort-strip').getAttribute('aria-disabled')==='false'&&document.querySelector('#effort-strip [aria-checked="true"]')?.dataset.level==='high');
 await page.locator('#prompt').fill('[claude:stall]');await page.locator('#send').click();
 await page.waitForSelector('#stop:not([hidden])');
 const busy=await page.evaluate(async()=>{try{await window.desk.settings({model:{provider:'anthropic',id:'claude-lite'}});return '';}catch(error){return error.message;}});
 assert.match(busy,/err\.model\.busy/);
 assert.equal(conversations.readClaudeConversation(file,{runtime}).model,'claude-fake');
 await page.locator('#stop').click();await sendEnabled(page);
 await app.close();
 app=ctx.app=await launch();page=await app.firstWindow();await statusOnline(page,{timeout:60000});
 await page.waitForFunction(()=>document.querySelector('#model-list [role="option"][data-key][aria-selected="true"]')?.dataset.key===JSON.stringify(['anthropic','claude-fake'])&&document.querySelector('#effort-strip [aria-checked="true"]')?.dataset.level==='high');
 await page.locator('#prompt').fill('restored controls');await page.locator('#send').click();await sendEnabled(page);
 assert.equal(rows().at(-1).model,'claude-fake');assert.equal(rows().at(-1).effort,'high');
 assert.equal(conversations.readClaudeConversation(file,{runtime}).nativeSessionId,nativeId);
 assert.equal(fs.existsSync(starts),false,'controls never start Pi');
 console.log('CLAUDE CONTROLS UI PASSED: catalog without prompt; model/effort/default; unsupported and busy guards; restore; native identity; zero Pi.');
});
