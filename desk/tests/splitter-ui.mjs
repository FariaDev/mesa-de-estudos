import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {withArtifacts,launchDesk,newRuntime,seedCourse,writeConfigJson,tinyPdf,statusOnline} from './helpers.mjs';
await withArtifacts('splitter',async ctx=>{
 const runtime=ctx.runtime=newRuntime('splitter'),course=seedCourse(runtime,'Test');
 fs.writeFileSync(path.join(course,'Limites.pdf'),tinyPdf('Exercise'));
 fs.writeFileSync(path.join(course,'Formulario.pdf'),tinyPdf('Support'));
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'Test',name:'Teste',path:course}],desk:{pinnedExtensions:false}});
 ctx.app=await launchDesk({runtime});const page=await ctx.app.firstWindow();await statusOnline(page);
 for(const [selector,prop] of [['#divider','--chat'],['.pdf-divider','--pdf-left'],['#calc-divider','--calc']]){
  const div=page.locator(selector);await div.waitFor();const box=await div.boundingBox();
  const value=()=>page.evaluate(p=>getComputedStyle(document.documentElement).getPropertyValue(p),prop);
  const start=await value();await div.hover();await page.mouse.move(box.x+box.width/2+30,box.y+box.height/2+30);assert.equal(await value(),start,'hover changes '+prop);
  for(const cancellation of ['pointercancel','lostpointercapture','blur','buttons']){
   await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();
   if(cancellation==='blur')await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
   else if(cancellation!=='buttons')await div.dispatchEvent(cancellation,{pointerId:1,pointerType:'mouse'});
   const after=await value();await div.dispatchEvent('pointermove',{pointerId:1,pointerType:'mouse',buttons:0,clientX:box.x-50,clientY:box.y-40});
   assert.equal(await value(),after,cancellation+' drag continues on hover: '+prop);await page.mouse.up();
  }
  // A normal primary-button drag must still resize, as must the keyboard.
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();
  await page.mouse.move(box.x+box.width/2-30,box.y+box.height/2-30);await page.mouse.up();
  assert.notEqual(await value(),start,'drag disabled: '+prop);
  const dragged=await value();await div.focus();await div.press(prop==='--calc'?'ArrowUp':'ArrowLeft');
  assert.notEqual(await value(),dragged,'keyboard disabled: '+prop);

 }
 console.log('PASS: hovering and cancelled drags preserve panel sizes');
});
