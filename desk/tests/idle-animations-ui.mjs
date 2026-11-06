// node tests/idle-animations-ui.mjs — a Mesa parada não pode animar página que
// ninguém está desenhando. A faixa `pdf-shimmer` existia em TODA página ainda
// sem canvas, inclusive nas fora da vista: 12 animações infinitas no repouso
// (medido em `tests/perf-probe.mjs`), gastando CPU/GPU com a janela parada.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {withArtifacts,launchDesk,newRuntime,seedCourse,writeDeskJson,writeConfigJson,tinyPdfPages,statusOnline} from './helpers.mjs';
import {pdfRenderIdle} from './waits.mjs';

const shimmer=page=>page.evaluate(()=>document.getAnimations()
 .filter(animation=>animation.animationName==='pdf-shimmer'&&animation.playState==='running').length);

await withArtifacts('idle-animations',async ctx=>{
 const runtime=ctx.runtime=newRuntime('idle-animations');
 const course=seedCourse(runtime,'Sonda');
 const first=path.join(course,'Longo-A.pdf');
 const second=path.join(course,'Longo-B.pdf');
 fs.writeFileSync(first,tinyPdfPages(8));
 fs.writeFileSync(second,tinyPdfPages(8));
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'Sonda',name:'Sonda',path:course}],desk:{panels:[{label:'A',prefer:['Longo-A']},{label:'B',prefer:['Longo-B']}]}});
 writeDeskJson(runtime,{courseId:'Sonda',pdfs:[{path:first,page:1,zoom:1},{path:second,page:1,zoom:1}],layoutVersion:1});
 const app=ctx.app=await launchDesk({runtime,env:{LEARNING_VAULT:runtime}});
 const page=await app.firstWindow();
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await statusOnline(page);
 await pdfRenderIdle(page);

 const pages=await page.evaluate(()=>({
  total:document.querySelectorAll('.pdf-page').length,
  rendered:document.querySelectorAll('.pdf-page[data-rendered]').length,
  waiting:document.querySelectorAll('.pdf-page:not([data-rendered])').length,
 }));
 assert.ok(pages.waiting>0,`o teste precisa de páginas fora da vista à espera (veio ${JSON.stringify(pages)})`);
 assert.equal(await shimmer(page),0,`página à espera fora da vista não pode brilhar parada (${pages.waiting} esperando)`);

 // A página QUE ESTÁ sendo desenhada continua com a faixa: o ganho não pode
 // tirar o aviso de carregamento de quem espera por ela.
 const drawing=await page.evaluate(()=>{
  const el=document.querySelector('.pdf-page:not([data-rendered])');
  el.dataset.rendering='teste';
  void getComputedStyle(el,'::after').animationName;
  const running=document.getAnimations().filter(animation=>animation.animationName==='pdf-shimmer'&&animation.playState==='running').length;
  delete el.dataset.rendering;
  return running;
 });
 assert.equal(drawing,1,'a página em desenho (data-rendering) mantém a faixa');
 assert.equal(await shimmer(page),0,'ao terminar o desenho a faixa sai');
 assert.deepEqual(errors,[],`erros na página: ${errors.join(' | ')}`);
});
