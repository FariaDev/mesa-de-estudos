// node tests/composer-pdf-quote-ui.mjs — citar e continuar digitando (#110), na janela.
// Depois de Citar (trecho da sessão ou do PDF), o foco tem de ficar no composer,
// com o cursor no fim e a digitação entrando no campo — sem outro clique.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {withArtifacts,newRuntime,seedCourse,seedNativeSession,writeConfigJson,writeDeskJson,launchDesk,statusOnline,tinyPdf,freezeMotion,resizeWindow,reviewShot,screenshotDirectory} from './helpers.mjs';

const out=screenshotDirectory('composer-pdf-quote');

const selectText=page=>page.waitForFunction(()=>{
 const holder=document.querySelector('#messages .message:not(.user) .body');
 if(!holder)return false;
 const selection=getSelection();
 if(selection.isCollapsed||!holder.contains(selection.anchorNode)){
  const range=document.createRange();
  range.selectNodeContents(holder);
  selection.removeAllRanges();
  selection.addRange(range);
  return false;
 }
 return !document.querySelector('#quote-btn').hidden;
},undefined,{timeout:20000});

const selectLayer=page=>page.waitForFunction(()=>{
 const layer=document.querySelector('.pdf-panel .textLayer');
 if(!layer||!layer.querySelector('span'))return false;
 const selection=getSelection();
 if(selection.isCollapsed||!layer.contains(selection.anchorNode)){
  const range=document.createRange();
  range.selectNodeContents(layer);
  selection.removeAllRanges();
  selection.addRange(range);
  return false;
 }
 return !document.querySelector('#quote-btn').hidden;
},undefined,{timeout:20000});

const composerState=page=>page.evaluate(()=>{
 const prompt=document.querySelector('#prompt');
 return {active:document.activeElement?.id||document.activeElement?.tagName,start:prompt.selectionStart,end:prompt.selectionEnd,length:prompt.value.length,value:prompt.value};
});

await withArtifacts('composer-pdf-quote',async ctx=>{
 const runtime=ctx.runtime=newRuntime('composer-pdf-quote');
 const course=seedCourse(runtime,'calc');
 const pdf=path.join(course,'Limites.pdf');
 fs.writeFileSync(pdf,tinyPdf('Limites e derivadas'));
 const session=seedNativeSession(runtime,[
  {type:'message',message:{role:'user',content:[{type:'text',text:'Como resolvo a lista?'}],timestamp:1700000001000}},
  {type:'message',message:{role:'assistant',content:[{type:'text',text:'Comece isolando o termo.'}],timestamp:1700000002000}},
 ],{courseId:'calc'});
 writeConfigJson(runtime,{runtimePath:runtime,vaultPath:runtime,courses:[{id:'calc',name:'Cálculo I',path:course}]});
 writeDeskJson(runtime,{courseId:'calc',session,courseStates:{calc:{session,pdfs:[{path:pdf,page:1}],study:{title:'',xopp:''}}}});
 ctx.app=await launchDesk({runtime});
 const page=await ctx.app.firstWindow();
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await resizeWindow(ctx.app,page,1440,900);
 await statusOnline(page);
 await freezeMotion(page);

 /* Sessão: Citar deixa o composer focado, cursor no fim e digitação entrando. */
 await page.waitForSelector('#messages .message:not(.user) .body',{timeout:30000});
 await selectText(page);
 await reviewShot(page,out,'sessao-selecionada.png');
 await page.locator('#quote-btn').click();
 let state=await composerState(page);
 assert.equal(state.active,'prompt','depois de citar a sessão, o foco fica no composer');
 assert.match(state.value,/^> Comece isolando o termo\./,'o trecho da sessão entra citado no rascunho');
 assert.equal(state.start,state.length,'o cursor fica no fim da citação (início)');
 assert.equal(state.end,state.length,'o cursor fica no fim da citação (fim)');
 const quoted=state.value;
 await page.keyboard.press('Shift+Enter');
 state=await composerState(page);
 assert.equal(state.value,quoted+'\n','⇧⏎ quebra a linha no fim da citação, como no composer vazio');
 await page.keyboard.type('continuo daqui');
 state=await composerState(page);
 assert.equal(state.value,quoted+'\ncontinuo daqui','digitar entra no composer sem outro clique');
 assert.equal(state.active,'prompt','o foco continua no composer depois de digitar');
 await reviewShot(page,out,'sessao-citada.png');

 /* PDF: o mesmo depois de Citar do leitor. */
 await page.locator('#prompt').fill('');
 await page.waitForSelector('.pdf-panel .textLayer span',{timeout:30000});
 await selectLayer(page);
 await page.locator('#quote-btn').click();
 state=await composerState(page);
 assert.equal(state.active,'prompt','depois de citar o PDF, o foco fica no composer');
 assert.match(state.value,/^> Limites e derivadas/,'o trecho do PDF entra citado no rascunho');
 assert.match(state.value,/\(Limites\.pdf, p\. 1\)\n\n$/,'a citação leva arquivo e página');
 assert.equal(state.start,state.length,'o cursor fica no fim da citação do PDF (início)');
 assert.equal(state.end,state.length,'o cursor fica no fim da citação do PDF (fim)');
 const pdfQuoted=state.value;
 await page.keyboard.type('continuo do PDF');
 state=await composerState(page);
 assert.equal(state.value,pdfQuoted+'continuo do PDF','digitar entra no composer depois do PDF');
 assert.equal(state.active,'prompt','o foco continua no composer depois de digitar');
 await reviewShot(page,out,'pdf-citado.png');

 assert.deepEqual(errors,[]);
});
console.log('composer-pdf-quote-ui: PASS — Citar (sessão e PDF) devolve o foco ao composer com o cursor no fim.');
