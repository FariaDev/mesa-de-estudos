// Synthetic runtime, real preload/IPC and Electron PDF generation; no provider.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {launchDesk,withArtifacts,enterFree,freeMenuClick} from './helpers.mjs';

await withArtifacts('material-preview-ui',async ctx=>{
 ctx.runtime=fs.mkdtempSync(path.join(os.tmpdir(),'mesa-material-preview-'));
 fs.writeFileSync(path.join(ctx.runtime,'config.json'),JSON.stringify({runtimePath:ctx.runtime,vaultPath:ctx.runtime,courses:[]}));
 ctx.app=await launchDesk({runtime:ctx.runtime});const page=await ctx.app.firstWindow();
 await page.waitForFunction(()=>typeof window.desk?.materialPreview==='function');
 const out=await page.evaluate(async()=>{
  const preview=await window.desk.materialPreview({title:'Material sintético',markdown:'# Movimento\n\n$$s=s_0+v_0t+\\frac{at^2}{2}$$\n\nPreço: \\$5 e \\$10.\n\n`$isto não é matemática$`',revision:'revision-1',requestId:'preview-1'});
  return {revision:preview.revision,requestId:preview.requestId,signature:new TextDecoder().decode(preview.pdf.slice(0,5)),length:preview.pdf.length,sha256:preview.sha256};
 });
 assert.equal(out.signature,'%PDF-');assert.ok(out.length>1000);assert.equal(out.sha256.length,64);
 assert.equal(out.revision,'revision-1');assert.equal(out.requestId,'preview-1');
 const files=[];
 function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())walk(file);else if(entry.name.endsWith('.pdf'))files.push(file);}}
 walk(ctx.runtime);assert.deepEqual(files,[],'preview does not save or register PDF materials');
 const rejected=await page.evaluate(async()=>{try{await window.desk.materialPreview({title:'x'.repeat(121),markdown:'texto',revision:'1',requestId:'bad'});return false;}catch{return true;}});
 assert.equal(rejected,true,'preload validates before invoking host');
 const cancelled=await page.evaluate(async()=>{
  const work=window.desk.materialPreview({title:'Cancelar',markdown:'Texto sintético',revision:'revision-2',requestId:'preview-2'}).then(()=>false,()=>true);
  await window.desk.materialPreviewCancel({requestId:'preview-2'});return work;
 });
 assert.equal(cancelled,true,'cancel closes a real in-flight PDF renderer');
 await enterFree(page);
 await freeMenuClick(page,'#free-generate-pdf');
 await page.waitForSelector('#free-pdf-dialog[open]');
 await page.locator('#free-pdf-title').fill('Corrida de revisão');
 await page.locator('#free-pdf-content').fill('Conteúdo original\n\n$$x=2$$');
 // Change the draft precisely when pdf.js asks for the first preview canvas,
 // after host generation completed but before client rendering completed.
 await page.evaluate(()=>{
  const original=HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext=function(...args){
   if(this.classList.contains('material-page-canvas')&&!window.__previewRaceTriggered){
    window.__previewRaceTriggered=true;
    const area=document.querySelector('#free-pdf-content');
    area.value='Conteúdo editado durante desenho';area.dispatchEvent(new Event('input',{bubbles:true}));
   }
   return original.apply(this,args);
  };
 });
 await page.locator('#free-pdf-verify').click();
 await page.waitForFunction(()=>window.__previewRaceTriggered===true);
 await page.waitForFunction(()=>!document.querySelector('#free-pdf-verify').disabled);
 assert.equal(await page.locator('#free-pdf-pages canvas').count(),0,'late canvas cannot publish after draft edit');
 assert.equal(await page.locator('#free-pdf-content').inputValue(),'Conteúdo editado durante desenho');
});
console.log('material-preview-ui: PASS — real PDF bytes, no saved material, preload validation, cancellation and edit during client drawing.');
