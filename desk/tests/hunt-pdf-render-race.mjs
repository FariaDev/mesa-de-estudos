// Um getPage deliberadamente atrasado não pode repintar uma página descartada.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {withArtifacts,launchDesk,newRuntime,seedCourse,writeDeskJson,writeConfigJson} from './helpers.mjs';
import {pdfRenderIdle} from './waits.mjs';
function pdf(count){
 const objects=['<</Type/Catalog/Pages 2 0 R>>',`<</Type/Pages/Kids[${Array.from({length:count},(_,i)=>`${4+i} 0 R`).join(' ')}]/Count ${count}>>`,'<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>'];
 for(let i=0;i<count;i++)objects.push(`<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Resources<</Font<</F1 3 0 R>>>>/Contents ${4+count+i} 0 R>>`);
 for(let i=0;i<count;i++){const text=`BT /F1 16 Tf 72 720 Td (Page ${i+1}) Tj ET`;objects.push(`<</Length ${text.length}>>\nstream\n${text}\nendstream`);}
 let text='%PDF-1.4\n';const offsets=[];
 objects.forEach((obj,i)=>{offsets.push(text.length);text+=`${i+1} 0 obj\n${obj}\nendobj\n`;});
 const xref=text.length;text+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.map(n=>`${String(n).padStart(10,'0')} 00000 n \n`).join('')}trailer\n<</Size ${objects.length+1}/Root 1 0 R>>\nstartxref\n${xref}\n%%EOF\n`;return Buffer.from(text);
}
await withArtifacts('pdf-render-race',async ctx=>{
 const runtime=ctx.runtime=newRuntime('pdf-render-race'),course=seedCourse(runtime,'Race'),file=path.join(course,'race.pdf');fs.writeFileSync(file,pdf(36));
 writeConfigJson(runtime,{vaultPath:path.join(runtime,'learning'),courses:[{id:'Race',name:'Race',path:course}],desk:{panels:[{label:'Race',prefer:['race']}]}});
 writeDeskJson(runtime,{courseId:'Race',pdfs:[{path:file,page:1}]});
 const app=ctx.app=await launchDesk({runtime});const page=await app.firstWindow();
 await page.waitForFunction(()=>document.querySelector('.pdf-page[data-rendered] canvas'),undefined,{timeout:30000});
 await pdfRenderIdle(page);
 await page.evaluate(async()=>{
  const {S}=await import('./src/state.mjs');const panel=S.panels[0],getPage=panel.doc.getPage.bind(panel.doc);
  let release;const gate=new Promise(resolve=>release=resolve);
  window.__releasePdf=release;window.__racePanel=panel;
  panel.doc.getPage=async n=>{const result=await getPage(n);if(n===30){window.__waitingPdf=true;await gate;}return result;};
  panel.goto(30);
 });
 await page.waitForFunction(()=>window.__waitingPdf===true);
 await page.evaluate(()=>window.__racePanel.goto(2));
 await page.waitForFunction(()=>document.querySelector('.pdf-page[data-page="2"][data-rendered] canvas'));
 await page.evaluate(()=>window.__releasePdf());
 await page.waitForTimeout(500);// espera fixa: "nada acontece em 0,5 s" — getPage atrasado não instala canvas fora da janela
 assert.equal(await page.locator('.pdf-page[data-page="30"] canvas').count(),0,'getPage atrasado não instala canvas fora da janela');
 assert.equal(await page.locator('.pdf-page[data-page="30"]').getAttribute('data-rendering'),null,'a página descartada não conserva marca em voo');
 await page.evaluate(()=>window.__racePanel.goto(30));
 await page.waitForFunction(()=>document.querySelector('.pdf-page[data-page="30"][data-rendered] canvas'));
 await page.evaluate(()=>{
  const panel=window.__racePanel,getPage=panel.doc.getPage.bind(panel.doc);
  let release;const gate=new Promise(resolve=>release=resolve);
  window.__releaseText=release;
  panel.doc.getPage=async n=>{
   const result=await getPage(n);
   if(n===16&&!result.__raceWrapped){
    result.__raceWrapped=true;
    const render=result.render.bind(result),text=result.getTextContent.bind(result);
    result.render=options=>{window.__detachedCanvas=options.canvasContext.canvas;return render(options);};
    result.getTextContent=async()=>{window.__waitingText=true;await gate;return text();};
   }
   return result;
  };
  panel.goto(16);
 });
 await page.waitForFunction(()=>window.__waitingText===true);
 await page.evaluate(()=>window.__racePanel.goto(2));
 await page.waitForFunction(()=>document.querySelector('.pdf-page[data-page="2"][data-rendered] canvas'));
 // O buffer deve sair no descarte, mesmo enquanto a extração de texto espera.
 await page.waitForFunction(()=>window.__detachedCanvas.width===0&&window.__detachedCanvas.height===0);
 await page.evaluate(()=>window.__releaseText());
 await page.waitForTimeout(300);// espera fixa: "nada acontece em 0,3 s" — textLayer atrasado não reinstala página descartada
 assert.equal(await page.locator('.pdf-page[data-page="16"] canvas').count(),0,'textLayer atrasado não reinstala página descartada');
 await page.evaluate(()=>window.__racePanel.goto(16));
 await page.waitForFunction(()=>document.querySelector('.pdf-page[data-page="16"][data-rendered] canvas'));
 console.log('PDF RENDER RACE PASSED: getPage/textLayer atrasados descartados, buffer zerado e páginas repintadas ao retornar.');
});
