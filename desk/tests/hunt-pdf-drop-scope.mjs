// Resposta IPC atrasada não pode adicionar PDF à matéria que abriu depois.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {withArtifacts,launchDesk,newRuntime,seedCourse,tinyPdf,writeConfigJson,writeDeskJson} from './helpers.mjs';

await withArtifacts('pdf-drop-scope',async ctx=>{
 const runtime=ctx.runtime=newRuntime('pdf-drop-scope');
 const a=seedCourse(runtime,'A'),b=seedCourse(runtime,'B');
 fs.writeFileSync(path.join(a,'A.pdf'),tinyPdf('Course A'));
 fs.writeFileSync(path.join(b,'B.pdf'),tinyPdf('Course B'));
 const dropped=path.join(runtime,'dropped.pdf');fs.writeFileSync(dropped,tinyPdf('Dropped in A'));
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'A',name:'A',path:a},{id:'B',name:'B',path:b}]});
 writeDeskJson(runtime,{courseId:'A'});
 ctx.app=await launchDesk({runtime});const page=await ctx.app.firstWindow();
 await page.waitForSelector('.pdf-page[data-rendered] canvas');
 await ctx.app.evaluate(({ipcMain})=>{
  const original=ipcMain._invokeHandlers.get('open-dropped-pdf');
  const gate=new Promise(resolve=>{globalThis.releasePdfDrop=resolve;});
  globalThis.pdfDropEntered=new Promise(resolve=>{globalThis.markPdfDropEntered=resolve;});
  ipcMain.removeHandler('open-dropped-pdf');
  ipcMain.handle('open-dropped-pdf',async(...args)=>{
   const result=await original(...args);globalThis.markPdfDropEntered();await gate;return result;
  });
 });
 await page.evaluate(()=>{
  const input=document.createElement('input');input.type='file';input.id='synthetic-drop';document.body.append(input);
 });
 await page.locator('#synthetic-drop').setInputFiles(dropped);
 await page.evaluate(async()=>{
  const {S}=await import('./src/state.mjs');
  globalThis.pendingPdfDrop=S.panels[0].dropPDF(document.getElementById('synthetic-drop').files[0]);
 });
 await ctx.app.evaluate(async()=>{await globalThis.pdfDropEntered;});
 await page.evaluate(async()=>{
  const {loadCourse}=await import('./src/state.mjs');
  await loadCourse(await window.desk.switchCourse('B'));
 });
 await ctx.app.evaluate(()=>{globalThis.releasePdfDrop();});
 await page.evaluate(async()=>{await globalThis.pendingPdfDrop;});
 const state=await page.evaluate(async()=>{
  const {S}=await import('./src/state.mjs');
  return {course:S.currentCourseId,library:S.library.map(p=>p.path),reader:S.panels[0].path};
 });
 assert.equal(state.course,'B');assert.equal(state.reader,path.join(b,'B.pdf'));
 assert.equal(state.library.includes(dropped),false);
 console.log('PDF DROP SCOPE PASSED: resposta atrasada preserva matéria, biblioteca e leitor atuais.');
});
