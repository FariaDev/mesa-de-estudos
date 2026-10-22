// node tests/pdf-quote-ui.mjs — citar fórmula do PDF (#70), na janela.
// No teste manual da v1.0.0, citar `lim f(x)→0 sen[f(x)]/f(x) = 1` levava texto em
// retalhos ao rascunho. Com a seleção feita de retalhos, o Quote anexa o recorte da
// página como imagem e escreve só a origem; texto corrido segue citado como texto.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {withArtifacts,newRuntime,seedCourse,writeConfigJson,writeDeskJson,launchDesk,statusOnline,tinyPdf,reviewShot,screenshotDirectory} from './helpers.mjs';

const out=screenshotDirectory('pdf-quote');

/* Seleciona todo o texto da camada da página e espera o botão Citar. */
const selectLayer=page=>page.waitForFunction(()=>{
 const layer=document.querySelector('.pdf-panel .textLayer');
 if(!layer||!layer.querySelector('span'))return false;
 const selection=getSelection();
 if(selection.isCollapsed||!layer.contains(selection.anchorNode)){
  const range=document.createRange();range.selectNodeContents(layer);
  selection.removeAllRanges();selection.addRange(range);
  return false;
 }
 return !document.querySelector('#quote-btn').hidden;
},undefined,{timeout:20000});

await withArtifacts('pdf-quote',async ctx=>{
 const runtime=ctx.runtime=newRuntime('pdf-quote');
 const course=seedCourse(runtime,'calc');
 const pdf=path.join(course,'Formula.pdf');
 fs.writeFileSync(pdf,tinyPdf(['sen','[','f','(','x',')',']','= 1'],8));
 writeConfigJson(runtime,{runtimePath:runtime,vaultPath:runtime,courses:[{id:'calc',name:'Cálculo I',path:course}]});
 writeDeskJson(runtime,{courseId:'calc',courseStates:{calc:{pdfs:[{path:pdf,page:1}],study:{title:'',xopp:''}}}});
 ctx.app=await launchDesk({runtime});
 const page=await ctx.app.firstWindow();
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await statusOnline(page);
 await page.waitForSelector('.pdf-panel canvas',{timeout:30000});
 await selectLayer(page);
 await reviewShot(page,out,'formula-selecionada.png');
 await page.locator('#quote-btn').click();
 await page.waitForSelector('#attachments .attachment img',{timeout:15000});
 const prompt=await page.locator('#prompt').inputValue();
 assert.equal(prompt.trim(),'> (Formula.pdf, p. 1: fórmula anexada como imagem)','o rascunho leva só a origem, sem retalhos');
 assert.equal(await page.locator('#attachments .attachment img').getAttribute('alt'),'Anexo: Formula p1.png');
 const crop=await page.locator('#attachments .attachment img').evaluate(img=>new Promise(resolve=>{const done=()=>resolve({w:img.naturalWidth,h:img.naturalHeight});img.complete?done():img.onload=done;}));
 assert.ok(crop.w>20&&crop.h>20,`o recorte tem conteúdo (${crop.w}×${crop.h})`);
 await reviewShot(page,out,'formula-citada.png');
 assert.deepEqual(errors,[]);
});
console.log('pdf-quote-ui: PASS — fórmula do PDF citada como recorte com arquivo e página.');
