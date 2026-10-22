// New composer/tutor-state with Claude: sending offline calls the tutor, keeps
// durable ordered messages, cancellation keeps them, calling again sends once.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {withArtifacts,newRuntime,seedCourse,writeDeskJson,writeConfigJson,launchDesk,statusOnline,DESK} from './helpers.mjs';
const conversations=createRequire(import.meta.url)('../src/agents/conversations.cjs');
await withArtifacts('claude-offline-queue',async ctx=>{
 const runtime=ctx.runtime=newRuntime('claude-offline-queue'),folder=seedCourse(runtime,'Synthetic');
 const file=conversations.createClaudeConversation({runtime,courseId:'Synthetic'});
 const gate=path.join(runtime,'release-catalog'),log=path.join(runtime,'prompts.log'),fakeHome=path.join(runtime,'empty-home');
 fs.mkdirSync(fakeHome);
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'Synthetic',name:'Synthetic',path:folder}]});
 writeDeskJson(runtime,{courseId:'Synthetic',session:file,courseStates:{Synthetic:{session:file,sessions:[{path:file}]}}});
 ctx.app=await launchDesk({runtime,pi:false,env:{HOME:fakeHome,LEARNING_DESK_CLAUDE_HOME:'',LEARNING_DESK_CLAUDE:path.join(runtime,'absent-claude'),LEARNING_DESK_CLAUDE_SDK_FACTORY:path.join(DESK,'tests/fixtures/claude-sdk-gated-fake.mjs'),FAKE_CLAUDE_CONNECT_RELEASE:gate,FAKE_CLAUDE_LOG:log}});
 const page=await ctx.app.firstWindow(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.waitForSelector('#tutor-state:not([hidden]) #connect');
 assert.equal(await page.locator('#status-dot.online').count(),0,'conversa inicia com tutor desligado');
 const type=async text=>{await page.locator('#prompt').fill(text);await page.locator('#prompt').press('Enter');};
 await type('primeira pergunta Claude');
 await page.waitForSelector('#tutor-state[data-state="connecting"]');
 assert.equal(await page.locator('.queue-label').textContent(),'Guardada. Vai quando ele atender.');
 await type('segunda pergunta Claude');
 await page.waitForFunction(()=>document.querySelectorAll('.queue-item').length===2);
 assert.equal(fs.existsSync(log),false,'catálogo não é inferência e fila não envia antes de atender');
 const stored=()=>{try{return JSON.parse(fs.readFileSync(path.join(runtime,'pending.json'),'utf8'))[file]?.items?.map(item=>item.text)||[];}catch{return [];}};
 const deadline=Date.now()+10000;
 while(stored().length!==2&&Date.now()<deadline)await new Promise(r=>setTimeout(r,25));
 assert.deepEqual(stored(),['primeira pergunta Claude','segunda pergunta Claude']);
 await page.locator('#connect-cancel').click();
 await page.waitForFunction(()=>document.querySelector('#tutor-state')?.dataset.state!=='connecting');
 assert.deepEqual(stored(),['primeira pergunta Claude','segunda pergunta Claude'],'Cancelar mantém fila durável');
 assert.equal(fs.existsSync(log),false);
 fs.writeFileSync(gate,'released');
 await page.locator('#connect').click();
 await statusOnline(page,{timeout:30000});
 // Calling the tutor again is an explicit retry: the offline queue is released
 // on that new successful connection, exactly as with Pi (ticket #18).
 await page.waitForFunction(()=>!document.querySelector('.queue-strip')&&document.querySelector('#stop').hidden);
 const sent=fs.readFileSync(log,'utf8').trim().split('\n').map(line=>JSON.parse(line).text.split('\n')[0]);
 assert.deepEqual(sent,['primeira pergunta Claude','segunda pergunta Claude'],'duas mensagens enviadas uma vez e na ordem');
 assert.deepEqual(errors,[]);
});
console.log('claude-offline-queue-ui: PASS — offline enqueue, native catalog without inference, Cancel keeps durable queue, calling again sends once in order.');
