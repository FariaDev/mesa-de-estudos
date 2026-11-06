import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {withArtifacts,launchDesk,newRuntime,seedCourse,tinyPdfPages,writeDeskJson,writeConfigJson,statusOnline,toggleForm,pageWindow} from './helpers.mjs';
import {pollUntil} from './waits.mjs';

/* Zoom por atalho no leitor selecionado (#111): ⌘/Ctrl + (=/+) e ⌘/Ctrl -
   mudam só o zoom do último leitor em que a pessoa clicou ou rolou, enquanto
   ele continua visível. O outro leitor e o zoom da janela não mudam. Sem leitor
   selecionado o atalho não é consumido — o comportamento de antes fica. */

const labels=page=>page.evaluate(()=>[...document.querySelectorAll('.pdf-panel')].map(panel=>panel.querySelector('.zoom-label')?.textContent.trim()));
const waitLabels=(page,expected)=>pollUntil(()=>labels(page),seen=>seen.join('|')===expected.join('|'),{timeout:6000,what:`os zooms ${expected.join(' e ')}`});
const clearKeys=page=>page.evaluate(()=>{window.__zoomKeys=[];});
const seenKeys=page=>page.evaluate(()=>window.__zoomKeys||[]);

await withArtifacts('leitor-zoom',async ctx=>{
 const runtime=ctx.runtime=newRuntime('leitor-zoom');
 const course=seedCourse(runtime,'Zoom');
 const firstPdf=path.join(course,'Primeiro.pdf'),secondPdf=path.join(course,'Segundo.pdf');
 fs.writeFileSync(firstPdf,tinyPdfPages(3,'Primeiro'));
 fs.writeFileSync(secondPdf,tinyPdfPages(3,'Segundo'));
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'Zoom',name:'Zoom',path:course}],desk:{panels:[{label:'Primeiro',prefer:['Primeiro']},{label:'Segundo',prefer:['Segundo']}],pinnedExtensions:false}});
 writeDeskJson(runtime,{courseId:'Zoom',pdfs:[{path:firstPdf,page:1,zoom:1},{path:secondPdf,page:1,zoom:1}],layoutVersion:1});

 const app=ctx.app=await launchDesk({runtime});
 const page=await app.firstWindow();
 await statusOnline(page);
 await page.waitForFunction(()=>document.querySelectorAll('.pdf-panel canvas').length>=2,undefined,{timeout:30000});
 const win=await pageWindow(app,page);
 const windowZoom=()=>win.evaluate(browserWindow=>browserWindow.webContents.getZoomFactor());
 /* O listener entra depois do handler da Mesa: `defaultPrevented` diz se o
    atalho foi consumido pelo app ou seguiu o caminho de antes. */
 await page.evaluate(()=>{
  window.__zoomKeys=[];
  window.addEventListener('keydown',event=>{
   if(['=','+','-'].includes(event.key))window.__zoomKeys.push({key:event.key,prevented:event.defaultPrevented});
  });
 });

 // ---------- sem leitor selecionado: nada muda ----------
 await clearKeys(page);
 await page.keyboard.press('ControlOrMeta+Equal');
 await page.keyboard.press('ControlOrMeta+Minus');
 await page.waitForFunction(()=>window.__zoomKeys.length>=2,undefined,{timeout:5000});
 assert.deepEqual(await labels(page),['100%','100%'],'sem leitor selecionado: nenhum PDF muda de zoom');
 assert.equal(await windowZoom(),1,'sem leitor selecionado: o zoom da janela continua 1');
 assert.deepEqual((await seenKeys(page)).map(key=>key.prevented),[false,false],'sem leitor selecionado: o atalho não é consumido');

 // ---------- clique seleciona o primeiro leitor ----------
 await page.locator('.pdf-panel').nth(0).locator('.pdf-viewport').click({position:{x:140,y:140}});
 await clearKeys(page);
 await page.keyboard.press('ControlOrMeta+Equal');
 await waitLabels(page,['120%','100%']);
 assert.equal(await windowZoom(),1,'⌘/Ctrl+= no leitor 1: a janela não muda de zoom');
 assert.deepEqual((await seenKeys(page)).map(key=>key.prevented),[true],'com leitor selecionado: o atalho é consumido');

 await page.keyboard.press('ControlOrMeta+Shift+Equal');
 await waitLabels(page,['140%','100%']);
 assert.equal(await windowZoom(),1,'⌘⇧= vale como + e não mexe na janela');

 await page.keyboard.press('ControlOrMeta+Minus');
 await waitLabels(page,['120%','100%']);
 assert.equal(await windowZoom(),1,'⌘/Ctrl- no leitor 1: a janela não muda de zoom');

 // ---------- rolar seleciona o segundo leitor ----------
 const secondBox=await page.locator('.pdf-panel').nth(1).locator('.pdf-viewport').boundingBox();
 await page.mouse.move(secondBox.x+secondBox.width/2,secondBox.y+secondBox.height/2);
 await page.mouse.wheel(0,500);
 await page.waitForFunction(()=>document.querySelectorAll('.pdf-panel')[1].querySelector('.pdf-viewport').scrollTop>0,undefined,{timeout:5000});
 await clearKeys(page);
 await page.keyboard.press('ControlOrMeta+Equal');
 await waitLabels(page,['120%','120%']);
 assert.equal(await windowZoom(),1,'rolar no leitor 2 e usar o atalho: a janela continua em 1');
 assert.deepEqual((await seenKeys(page)).map(key=>key.prevented),[true],'a rolagem tornou o leitor 2 o selecionado');

 // ---------- leitor selecionado escondido deixa de valer ----------
 await toggleForm(page,false);
 await page.waitForFunction(()=>document.querySelectorAll('.pdf-panel')[1].hidden,undefined,{timeout:5000});
 const before=await labels(page);
 await clearKeys(page);
 await page.keyboard.press('ControlOrMeta+Equal');
 await page.waitForFunction(()=>window.__zoomKeys.length===1,undefined,{timeout:5000});
 assert.deepEqual(await labels(page),before,'com o leitor selecionado escondido, nenhum PDF muda');
 assert.equal(await windowZoom(),1,'com o leitor selecionado escondido, a janela não muda');
 assert.deepEqual((await seenKeys(page)).map(key=>key.prevented),[false],'leitor escondido: o atalho volta ao comportamento de antes');
});
console.log('PASS: ⌘/Ctrl + e − mudam só o zoom do leitor selecionado; a janela e o outro leitor ficam');
