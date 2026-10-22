// Electron real, backend real e material sintético. O botão do modal precisa
// receber um clique físico; IPC direto cobre escopo/edições concorrentes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {withArtifacts,launchDesk,newRuntime,seedCourse,tinyPdf,writeConfigJson,writeDeskJson,statusOnline} from './helpers.mjs';
await withArtifacts('qol-undo',async ctx=>{
 const runtime=ctx.runtime=newRuntime('qol-undo'),course=seedCourse(runtime,'A');
 const pdf=path.join(course,'Limites.pdf');fs.writeFileSync(pdf,tinyPdf('Synthetic undo document'));
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'A',name:'A',path:course}]});writeDeskJson(runtime,{courseId:'A'});
 ctx.app=await launchDesk({runtime});const page=await ctx.app.firstWindow(),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.waitForSelector('.pdf-page[data-rendered] canvas');await statusOnline(page);
 await page.evaluate(()=>{window.confirm=()=>true;});
 await page.locator('#study-menu .nav-trigger').click();await page.locator('#study-menu #study-notes-open').click();
 await page.locator('#study-note-note').fill('Anotação original');await page.locator('#study-note-save').click();
 await page.waitForSelector('.study-note-remove');
 const beforeNotes=await page.evaluate(()=>window.desk.studyNotesRead());
 await page.locator('.study-note-remove').click();
 await page.waitForSelector('#study-notes-dialog #undo-notice:not([hidden])');
 const seconds=parseInt(await page.locator('#undo-notice .undo-notice-timer').textContent());assert.ok(seconds>0&&seconds<=25);
 await page.locator('#undo-notice .undo-notice-undo').click();
 await page.waitForFunction(()=>document.querySelector('#study-notes-list').textContent.includes('Anotação original'));
 assert.deepEqual((await page.evaluate(()=>window.desk.studyNotesRead())).items,beforeNotes.items);
 await page.locator('#study-notes-close').click();
 await page.evaluate(async ref=>{
  const result=await window.desk.reviewSave({mode:'add',item:{question:'Questão original',attempt:'Tentativa',difficulty:'Dúvida',ref}});
  const {S}=await import('./src/state.mjs');S.reviewItems=result;
 },{name:'Limites.pdf',path:pdf,page:1});
 const beforeReview=(await page.evaluate(()=>window.desk.init())).review;
 await page.locator('#review-tab').click();
 await page.waitForSelector('.review-remove');await page.locator('.review-remove').click();
 await page.waitForSelector('body > #undo-notice:not([hidden])');
 await page.locator('#undo-notice .undo-notice-undo').click();
 await page.waitForSelector('.review-remove');
 assert.deepEqual((await page.evaluate(()=>window.desk.init())).review,beforeReview);
 const removal=await page.evaluate(item=>window.desk.reviewSave({mode:'remove',item}),beforeReview[0]);
 await page.evaluate(async()=>{
  const data=await window.desk.newSession('pi');const {loadCourse}=await import('./src/state.mjs');await loadCourse(data);
 });
 assert.equal((await page.evaluate(token=>window.desk.reviewUndo({token}),removal.undoToken)).reason,'scope');
 assert.deepEqual(errors,[]);
 console.log('QOL UNDO PASSED: botão clicável dentro do modal, registro original restaurado, Caderno real e token recusado em outra conversa.');
});
