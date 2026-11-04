/* Regressão do harness (#49): a janela de teste nasce escondida e, no X11,
   uma janela que nunca apareceu recebe ~1 requestAnimationFrame por segundo.
   As esperas de layout/transição (`layoutStable`, `nextFrames`) nunca fecham
   nesse ritmo. O `launchDesk` mostra a janela fora da tela por dois quadros e
   esconde de novo antes de devolver o app; aqui se prova que a janela segue
   escondida e que os quadros continuam a 60 fps. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {withArtifacts,newRuntime,seedCourse,writeConfigJson,launchDesk,statusOnline,tinyPdf,pageWindow} from './helpers.mjs';

await withArtifacts('ritmo-de-quadros',async ctx=>{
 const runtime=ctx.runtime=newRuntime('ritmo-de-quadros');
 const course=seedCourse(runtime,'Calc');
 fs.writeFileSync(path.join(course,'Lista.pdf'),tinyPdf('Lista'));
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'Calc',name:'Cálculo',path:course}]});
 ctx.app=await launchDesk({runtime});
 const page=await ctx.app.firstWindow();
 await statusOnline(page);
 const win=await pageWindow(ctx.app,page);
 assert.equal(await win.evaluate(w=>w.isVisible()),false,'a janela do teste segue escondida depois do aquecimento');
 const intervals=await page.evaluate(()=>new Promise(done=>{
  const times=[];let last=performance.now();
  const step=()=>{const now=performance.now();times.push(now-last);last=now;if(times.length>=10)done(times);else requestAnimationFrame(step);};
  requestAnimationFrame(step);
 }));
 const slow=intervals.filter(ms=>ms>250);
 assert.deepEqual(slow.map(ms=>Math.round(ms)),[],`a janela escondida recebe quadros a 60 fps (intervalos: ${intervals.map(ms=>Math.round(ms)).join(',')})`);
});
console.log('frame-pacing-ui: PASS — janela escondida com rAF a 60 fps.');
