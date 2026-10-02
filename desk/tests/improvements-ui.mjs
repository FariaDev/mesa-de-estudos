import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {withArtifacts,launchDesk,newRuntime,seedCourse,writeConfigJson,tinyPdf,statusOnline} from './helpers.mjs';

await withArtifacts('improvements',async ctx=>{
 const runtime=ctx.runtime=newRuntime('improvements'),course=seedCourse(runtime,'Test');
 fs.writeFileSync(path.join(course,'Limites.pdf'),tinyPdf('Exercise'));
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'Test',name:'Teste',path:course}],desk:{pinnedExtensions:false}});
 const refusalLog=path.join(runtime,'refusals.jsonl'),queueLog=path.join(runtime,'queue.jsonl');
 const stateFailureFile=path.join(runtime,'state-failure');
 const draft={question:'Limite lateral',attempt:'Dividi por x',difficulty:'Sinal pela direita'};
 ctx.app=await launchDesk({runtime,env:{FAKE_PI_STATE_FAILURE_FILE:stateFailureFile,FAKE_PI_REVIEW_DRAFT:JSON.stringify(draft),FAKE_PI_REVIEW_DELAY:'900',FAKE_PI_REFUSAL_LOG:refusalLog,FAKE_PI_QUEUE_LOG:queueLog,FAKE_PI_QUEUE_HOLD_MS:'1500'}});
 const page=await ctx.app.firstWindow();await statusOnline(page);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 // Hover and focus cannot open a menu; click/keyboard and Escape own its state.
 for(const id of ['study','mesa']){
  const trigger=page.locator(`#${id}-menu .nav-trigger`),pop=page.locator(`#${id}-pop`);
  await trigger.hover();assert.equal(await pop.isVisible(),false);
  await trigger.focus();assert.equal(await pop.isVisible(),false);
  await trigger.click();assert.equal(await pop.isVisible(),true);assert.equal(await trigger.getAttribute('aria-expanded'),'true');
  await trigger.click();assert.equal(await pop.isVisible(),false);
  await trigger.press('Enter');assert.equal(await pop.isVisible(),true);
  await trigger.press('Escape');assert.equal(await pop.isVisible(),false);
 }
 // A real IPC/worker draft fills untouched fields, leaves a user's edit intact,
 // and is saved only after explicit confirmation.
 await page.locator('#prompt').fill('primeiro');await page.locator('#send').click();
 await page.waitForSelector('.message.assistant button.msg-review');
 fs.writeFileSync(stateFailureFile,'fail once');
 await page.locator('.message.assistant button.msg-review').first().click();
 await page.waitForSelector('#review-dialog[open]');
 await page.locator('#review-question').fill('Minha questão editada');
 await page.waitForFunction(()=>document.querySelector('#review-draft-status')?.textContent.includes('pronta'),undefined,{timeout:10000});
 assert.equal(await page.locator('#review-question').inputValue(),'Minha questão editada');
 assert.equal(await page.locator('#review-attempt').inputValue(),draft.attempt);
 assert.equal(await page.locator('#review-difficulty').inputValue(),draft.difficulty);
 assert.equal(fs.existsSync(path.join(runtime,'review.json')),false);
 await page.locator('#review-difficulty').fill('Minha dificuldade');await page.locator('#review-save').click();
 await page.waitForFunction(()=>!document.querySelector('#review-dialog').open);
 await page.waitForFunction(()=>document.querySelector('#toast')?.textContent.includes('Guardado'));
 const stored=JSON.parse(fs.readFileSync(path.join(runtime,'review.json'),'utf8')).Test[0];
 assert.equal(stored.question,'Minha questão editada');assert.equal(stored.difficulty,'Minha dificuldade');
 // Cancel an in-flight draft. It must not reopen or overwrite a later dialog.
 await page.locator('.message.assistant button.msg-review').first().click();await page.locator('#review-dialog button[value=cancel]').click();
 await page.waitForFunction(()=>!document.querySelector('#review-dialog').open);
 // Safe refusal from Pi: exactly initial + 3 repeats, spaced by 2/4/8 seconds.
 await page.locator('#prompt').fill('primeiro de novo');await page.locator('#send').click();
 await page.locator('#prompt').fill('falhar');await page.locator('#prompt').press('Enter');
 await page.waitForFunction(()=>document.querySelector('#toast')?.textContent.includes('tentativas acabaram'),undefined,{timeout:25000});
 const attempts=fs.readFileSync(refusalLog,'utf8').trim().split('\n').map(JSON.parse);
 assert.equal(attempts.length,4);
 for(let i=1;i<attempts.length;i++)assert.ok(attempts[i].at-attempts[i-1].at>=[1900,3900,7900][i-1]);
 assert.match(await page.locator('.queue-strip').textContent(),/falhar/);
 assert.match(await page.locator('.queue-strip').textContent(),/Enviar agora/);
 assert.equal(await page.locator('.message.user .body').filter({hasText:'falhar'}).count(),0);
 assert.deepEqual(errors,[]);
 console.log('PASS: menus by click/keyboard, model draft with editable fields/cancel/save, bounded queue retries with 2/4/8s backoff');
});
