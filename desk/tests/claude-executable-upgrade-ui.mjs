// Resume an established synthetic session whose last observed executable is
// obsolete. Main and sidechat must use the current launcher with the same ID.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {withArtifacts,newRuntime,seedCourse,writeDeskJson,writeConfigJson,launchDesk,statusOnline,sendEnabled,DESK} from './helpers.mjs';
const conversations=createRequire(import.meta.url)('../src/agents/conversations.cjs');
await withArtifacts('claude-executable-upgrade',async ctx=>{
 const runtime=ctx.runtime=newRuntime('claude-executable-upgrade'),folder=seedCourse(runtime,'Synthetic');
 const file=conversations.createClaudeConversation({runtime,courseId:'Synthetic'});
 const old=path.join(runtime,'claude-old-2.1.246'),current=path.join(runtime,'claude-current-2.1.301'),trace=path.join(runtime,'executables.log');
 for(const target of [old,current]){fs.writeFileSync(target,'#!/bin/sh\nexit 1\n');fs.chmodSync(target,0o755);}
 conversations.updateClaudeConversation(file,{pinnedExecutable:old,nativeEstablished:true},{runtime});
 const id=conversations.readClaudeConversation(file,{runtime}).nativeSessionId;
 writeConfigJson(runtime,{vaultPath:runtime,claudePath:current,courses:[{id:'Synthetic',name:'Synthetic',path:folder}]});
 writeDeskJson(runtime,{courseId:'Synthetic',session:file,courseStates:{Synthetic:{session:file,sessions:[{path:file}]}}});
 ctx.app=await launchDesk({runtime,pi:false,env:{LEARNING_DESK_CLAUDE:current,LEARNING_DESK_CLAUDE_SDK_FACTORY:path.join(DESK,'tests/fixtures/claude-sdk-executable-spy.mjs'),FAKE_CLAUDE_EXECUTABLE_TRACE:trace}});
 const page=await ctx.app.firstWindow(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const rows=()=>fs.readFileSync(trace,'utf8').trim().split('\n').map(JSON.parse);
 await statusOnline(page,{timeout:30000});
 assert.deepEqual(rows()[0],{executable:current,resume:id,newSession:null},'principal retoma ID exato no launcher atual');
 await page.locator('#prompt').fill('continuar o estudo');await page.locator('#send').click();await sendEnabled(page);
 assert.equal(conversations.readClaudeConversation(file,{runtime}).pinnedExecutable,current,'init atualiza somente o caminho observado');
 await page.locator('#sidechat-toggle').click();await page.waitForSelector('#sidechat-prompt:not([disabled])');
 const opened=await page.evaluate(()=>window.desk.sidechatOpen({}));
 const side=JSON.parse(fs.readFileSync(path.join(runtime,'sidechats',opened.id+'.json'),'utf8')).claude;
 conversations.updateClaudeConversation(side,{pinnedExecutable:old,nativeEstablished:true},{runtime});
 const sideId=conversations.readClaudeConversation(side,{runtime}).nativeSessionId;
 await page.locator('#sidechat-prompt').fill('continuar no lateral');await page.locator('#sidechat-send').click();
 await page.waitForFunction(()=>document.querySelector('#sidechat-messages')?.textContent.includes('Resposta de teste'));
 assert.deepEqual(rows().at(-1),{executable:current,resume:sideId,newSession:null},'lateral também retoma próprio ID no launcher atual');
 assert.equal(conversations.readClaudeConversation(side,{runtime}).pinnedExecutable,current);
 assert.deepEqual(errors,[]);
});
console.log('claude-executable-upgrade-ui: PASS — main and sidechat resume exact IDs through current launcher, old binary stays untouched; synthetic SDK only.');
