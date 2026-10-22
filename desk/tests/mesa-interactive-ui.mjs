import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {launchDesk,withArtifacts,DESK,screenshotDirectory,newSession,enterFree} from './helpers.mjs';
import {pollUntil} from './waits.mjs';
/* global mesa */ // a API da atividade, dentro do quadro (só no diagnóstico de falha)

await withArtifacts('mesa-interactive-integrated',async ctx=>{
 ctx.runtime=fs.mkdtempSync(path.join(os.tmpdir(),'mesa-interactive-integrated-'));
 const pi=path.join(DESK,'tests/fixtures/mesa-interactive-pi.mjs');fs.chmodSync(pi,0o755);
 fs.writeFileSync(path.join(ctx.runtime,'config.json'),JSON.stringify({runtimePath:ctx.runtime,vaultPath:ctx.runtime,courses:[]}));
 ctx.app=await launchDesk({runtime:ctx.runtime,env:{LEARNING_DESK_PI:pi}});
 const page=await ctx.app.firstWindow(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 page.on('dialog',dialog=>dialog.accept());
 await enterFree(page);
 await page.evaluate(async()=>{await (await import('./src/state.mjs')).connect();});
 async function send(text){await page.locator('#prompt').fill(text);await page.locator('#send').click();}
 async function waitDesk(predicate,arg){await pollUntil(()=>page.evaluate(predicate,arg),settled=>!!settled,{timeout:8000,what:'o estado do IPC assentar'});}
 await send('Crie uma atividade de movimento.');
 const slot=page.locator('.activity-slot[data-activity-call="integrated-call-1"]');
 try{await slot.locator('.activity-card[data-state="ready"]').waitFor({timeout:12000});}
 catch(error){console.error('Activity facts',await page.evaluate(async()=>({slots:[...document.querySelectorAll('.activity-slot')].map(el=>({status:el.dataset.status,text:el.textContent,state:el.querySelector('.activity-card')?.dataset.state})),scope:await window.desk.activityScope(),messages:document.querySelector('#messages').textContent,frames:[...document.querySelectorAll('.activity-iframe')].map(el=>el.src)})),errors);throw error;}
 const frame=page.frames().find(f=>f.url().startsWith('mesa-activity://artifact/'));assert.ok(frame);
 assert.deepEqual(await frame.evaluate(()=>({node:typeof require,desk:typeof window.desk,rtc:typeof RTCPeerConnection})),{node:'undefined',desk:'undefined',rtc:'undefined'});
 assert.equal(await frame.locator('#s').textContent(),'15 m');
 await frame.locator('#a').evaluate(el=>{el.value='4';el.dispatchEvent(new Event('input',{bubbles:true}));});
 assert.equal(await frame.locator('#s').textContent(),'24 m');
 await page.evaluate(()=>{document.documentElement.dataset.theme='dark';});
 console.log('Theme facts',await page.evaluate(()=>({theme:document.documentElement.dataset.theme,state:document.querySelector('.activity-card')?.dataset.state})),await frame.evaluate(()=>({theme:document.documentElement.dataset.theme})));
 await frame.waitForFunction(()=>document.documentElement.dataset.theme==='dark');
 assert.equal(await frame.locator('#s').textContent(),'24 m');
 await page.evaluate(()=>{document.documentElement.dataset.theme='light';});
 await frame.waitForFunction(()=>document.documentElement.dataset.theme==='light');
 const shots=screenshotDirectory('mesa-interactive-ui');
 await slot.screenshot({path:path.join(shots,'interactive-light.png')});
 await frame.locator('#attempt').click();
 await waitDesk(async()=>{const items=await window.desk.activityList();if(!items.items[0])return false;const state=await window.desk.activityStateGet(items.items[0]);return state.state?.attempt?.posicao===24&&state.state?.values?.a===4;});
 await page.locator('#prompt').fill('Meu rascunho preservado.');
 await slot.locator('[data-act="draft"]').click();
 assert.match(await page.locator('#prompt').inputValue(),/^Meu rascunho preservado\./);assert.match(await page.locator('#prompt').inputValue(),/24/);
 const facts=await page.evaluate(()=>[...document.querySelector('#messages').children].map(el=>el.classList.contains('activity-slot')?'activity':el.querySelector('.body')?.textContent||''));
 assert.ok(facts.findIndex(x=>x.includes('Antes da atividade.'))<facts.indexOf('activity'));
 assert.ok(facts.indexOf('activity')<facts.findIndex(x=>x.includes('Depois da declaração.')));
 const oldItem=await page.evaluate(async()=>{const {items}=await window.desk.activityList();return items[0];});
 console.log('State before reload',JSON.stringify(await page.evaluate(item=>window.desk.activityStateGet(item),oldItem)));
 /* Sem matéria configurada a Mesa reabre na folha de primeira abertura, com o
    tutor desligado: a sessão Livre está a um clique e o histórico do Pi volta
    quando o tutor é chamado. */
 await page.reload();await enterFree(page);
 await page.evaluate(async()=>{await (await import('./src/state.mjs')).connect();});
 await page.waitForSelector('.activity-slot .activity-card');
 assert.equal(await page.locator('.activity-iframe').count(),0,'restoring history does not execute old scripts');
 await page.locator('.activity-slot [data-act="open"]').click();
 await page.waitForSelector('.activity-card[data-state="ready"]');
 const reopened=page.frames().find(f=>f.url().startsWith('mesa-activity://artifact/'));
 try{await reopened.waitForFunction(()=>document.querySelector('#a').value==='4',{},{timeout:8000});}
 catch(error){console.error('Restored facts',await reopened.evaluate(()=>({slider:document.querySelector('#a')?.value,runtime:mesa.getState()})),await page.evaluate(async()=>{const {items}=await window.desk.activityList();return window.desk.activityStateGet(items[0]);}));throw error;}
 await page.evaluate(()=>{window.__activityFrame=document.querySelector('.activity-iframe');});
 const restoredSlot=page.locator('.activity-slot[data-activity-call="integrated-call-1"]');
 await restoredSlot.locator('[data-act="expand"]').click();
 assert.equal(await page.evaluate(()=>window.__activityFrame===document.querySelector('.activity-iframe')),true,'expansion retains mounted iframe');
 assert.equal(await reopened.locator('#a').inputValue(),'4');
 await restoredSlot.locator('.activity-card').screenshot({path:path.join(shots,'interactive-expanded.png')});
 /* #42: a tela cheia cobre a janela; Esc sai e o mesmo iframe continua. */
 await page.keyboard.press('Escape');
 await page.waitForFunction(()=>!document.querySelector('.activity-card.activity-fullscreen'));
 assert.equal(await page.evaluate(()=>window.__activityFrame===document.querySelector('.activity-iframe')),true,'sair da tela cheia mantém o iframe');
 await restoredSlot.locator('[data-act="expand"]').click();
 await restoredSlot.locator('[data-act="stop"]').click();
 await restoredSlot.locator('[data-act="open"]').click();
 await restoredSlot.locator('.activity-card[data-state="ready"]').waitFor();
 const resumed=page.frames().find(f=>f.url().startsWith('mesa-activity://artifact/'));
 await resumed.waitForFunction(()=>document.querySelector('#a').value==='4',undefined,{timeout:8000});
 await send('Crie uma atividade com katex.');
 await page.waitForSelector('.activity-slot[data-activity-call="integrated-call-2"] .activity-card[data-state="ready"]');
 const math=page.frames().find(f=>f.url().startsWith('mesa-activity://artifact/')&&f!==resumed);
 assert.ok(await math.locator('.katex').count()>0,'packaged KaTeX works offline in real activity origin');
 await page.waitForFunction(()=>!document.querySelector('#send').disabled);
 await send('Crie uma atividade loop.');
 const loop=page.locator('.activity-slot[data-activity-call="integrated-call-3"]');
 await loop.locator('.activity-card[data-state="ready"]').waitFor();
 await page.waitForTimeout(500);// espera fixa: o laço da atividade precisa estar rodando antes de medir a resposta do host
 await page.locator('#prompt').fill('Host responsivo durante laço.');
 await loop.locator('[data-act="stop"]').click();
 assert.equal(await loop.locator('.activity-iframe').count(),0,'trusted stop removes looping activity without closing Mesa');
 assert.equal(await page.locator('#prompt').inputValue(),'Host responsivo durante laço.');
 await page.waitForFunction(()=>!document.querySelector('#new-session').disabled);
 await newSession(page);
 await waitDesk(async old=>{const scope=await window.desk.activityScope();return scope.conversationId!==old;},oldItem.conversationId);
 const stale=await page.evaluate(async item=>{try{await window.desk.activityStateSave({...item,state:{bad:true}});return false;}catch{return true;}},oldItem);
 assert.equal(stale,true,'old scopeRef cannot save into newly active conversation');
 assert.equal((await page.evaluate(()=>window.desk.activityList())).items.length,0);
 assert.deepEqual(errors,[]);
});
console.log('mesa-interactive-ui: PASS — real main/preload/bridge/runtime, MRUV, draft, timeline, lazy reload, state, offline KaTeX, loop stop and scope isolation; Pi simulated.');
