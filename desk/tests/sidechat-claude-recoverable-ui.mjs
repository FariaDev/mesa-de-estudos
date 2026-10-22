// Main/preload/native fake/renderer regression: partial → recoverable error →
// result. Temp runtime, synthetic course, no Pi/Claude credentials or inference.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {withArtifacts,newRuntime,seedCourse,writeDeskJson,writeConfigJson,launchDesk,statusOnline,DESK} from './helpers.mjs';
const conversations=createRequire(import.meta.url)('../src/agents/conversations.cjs');
await withArtifacts('sidechat-claude-recoverable',async ctx=>{
 const runtime=ctx.runtime=newRuntime('sidechat-claude-recoverable'),folder=seedCourse(runtime,'Synthetic');
 const file=conversations.createClaudeConversation({runtime,courseId:'Synthetic'});
 const release=path.join(runtime,'release-stream'),log=path.join(runtime,'prompts.log');
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'Synthetic',name:'Synthetic',path:folder}]});
 writeDeskJson(runtime,{courseId:'Synthetic',session:file,courseStates:{Synthetic:{session:file,sessions:[{path:file}]}}});
 ctx.app=await launchDesk({runtime,pi:false,env:{LEARNING_DESK_CLAUDE_SDK_FACTORY:path.join(DESK,'tests/fixtures/claude-sdk-recoverable-fake.mjs'),FAKE_CLAUDE_RECOVERY_RELEASE:release,FAKE_CLAUDE_LOG:log}});
 const page=await ctx.app.firstWindow(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await statusOnline(page,{timeout:30000});
 await page.locator('#sidechat-toggle').click();
 await page.waitForSelector('#sidechat-prompt:not([disabled])');
 await page.locator('#sidechat-prompt').fill('pergunta sintética');
 await page.locator('#sidechat-send').click();
 await page.waitForFunction(()=>document.querySelector('#sidechat-messages').textContent.includes('server_error'));
 assert.equal(await page.locator('#sidechat-stop').isVisible(),true,'erro recuperável mantém Parar até resultado');
 assert.equal(await page.locator('#sidechat-send').isDisabled(),true,'novo envio continua bloqueado');
 await page.waitForFunction(()=>document.querySelector('#sidechat-messages .live .body')?.textContent.trim());
 assert.ok((await page.locator('#sidechat-messages .live .body').textContent()).trim(),'parcial não desaparece no erro');
 await page.locator('#sidechat-prompt').fill('rascunho durante retry');
 await page.locator('#sidechat-prompt').press('Enter');
 assert.equal(fs.readFileSync(log,'utf8').trim().split('\n').length,1,'Enter durante erro recuperável não inicia segundo prompt');
 fs.writeFileSync(release,'released');
 await page.waitForFunction(()=>!document.querySelector('#sidechat-send').disabled);
 assert.ok((await page.locator('#sidechat-messages').textContent()).includes('pergunta sintética'),'resposta final chega depois do erro');
 assert.equal(await page.locator('#sidechat-prompt').inputValue(),'rascunho durante retry');
 assert.deepEqual(errors,[]);
});
console.log('sidechat-claude-recoverable-ui: PASS — partial/error preserves busy until native result, zero authenticated inference.');
