// node tests/message-links-ui.mjs — links no corpo da resposta do tutor
// (auditoria de UI/UX, rodada 1, F), na janela. O https abre o diálogo da Mesa
// com o domínio em destaque; Cancelar não abre e Abrir registra em
// `opened-links.jsonl` (modo de teste, sem navegador de verdade). http e
// âncora interna não fazem nada.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {withArtifacts,newRuntime,seedCourse,writeConfigJson,writeDeskJson,launchDesk,statusOnline,tinyPdf,seedNativeSession,resizeWindow,freezeMotion,screenshotDirectory,reviewShot} from './helpers.mjs';
import {pollUntil} from './waits.mjs';

const out=screenshotDirectory('message-links');

await withArtifacts('message-links',async ctx=>{
 const runtime=ctx.runtime=newRuntime('message-links');
 const course=seedCourse(runtime,'calc');
 const pdf=path.join(course,'Limites.pdf');
 fs.writeFileSync(pdf,tinyPdf('Limites e derivadas'));
 writeConfigJson(runtime,{runtimePath:runtime,vaultPath:runtime,courses:[{id:'calc',name:'Cálculo I',path:course}]});
 const body='Veja o [guia da matéria](https://exemplo.com/guia) e o [legado](http://exemplo.com/legado), depois volte ao [topo](#topo).';
 const session=seedNativeSession(runtime,[{role:'user',content:[{type:'text',text:'onde está o guia?'}]},{role:'assistant',content:[{type:'text',text:body}]}],{courseId:'calc'});
 writeDeskJson(runtime,{courseId:'calc',session,courseStates:{calc:{session,pdfs:[{path:pdf,page:1}],study:{title:'',xopp:''}}}});
 const app=ctx.app=await launchDesk({runtime});
 const page=await app.firstWindow();
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await app.evaluate(({shell})=>{globalThis.__openedLinks=[];shell.openExternal=async url=>{globalThis.__openedLinks.push(url);};});
 const opened=()=>app.evaluate(()=>globalThis.__openedLinks);
 await resizeWindow(app,page,1440,900);
 await statusOnline(page);
 await freezeMotion(page);
 await page.waitForSelector('.message.assistant',{timeout:30000});
 const dialog=page.locator('#link-dialog');

 /* https: o diálogo mostra o domínio em destaque; Cancelar não abre. */
 await page.locator('.message.assistant .body a[href="https://exemplo.com/guia"]').click();
 await dialog.waitFor({state:'visible'});
 assert.equal(await page.locator('#link-host').textContent(),'exemplo.com','domínio de destino em destaque');
 await reviewShot(page,out,'link-dialog.png');
 await page.locator('#link-dialog button[value="cancel"]').click();
 await page.waitForFunction(()=>!document.querySelector('#link-dialog').open);
 assert.deepEqual(await opened(),[],'cancelar não abre');

 /* http e âncora interna: parecem link, mas não fazem nada. */
 await page.locator('.message.assistant .body a[href="http://exemplo.com/legado"]').click();
 await page.waitForTimeout(500);// espera fixa: "nada acontece em 0,5 s"
 assert.equal(await dialog.count(),1,'o diálogo existe');
 assert.equal(await dialog.evaluate(el=>el.open),false,'http não abre o diálogo');
 await page.locator('.message.assistant .body a[href="#topo"]').click();
 await page.waitForTimeout(300);// espera fixa: "nada acontece em 0,3 s"
 assert.equal(await dialog.evaluate(el=>el.open),false,'âncora interna não abre o diálogo');
 assert.deepEqual(await opened(),[],'nada chegou a abrir');

 /* Abrir: o mesmo endereço mostrado chega ao registro de links. */
 await page.locator('.message.assistant .body a[href="https://exemplo.com/guia"]').click();
 await dialog.waitFor({state:'visible'});
 await page.locator('#link-dialog button[value="ok"]').click();
 await page.waitForFunction(()=>!document.querySelector('#link-dialog').open);
 await pollUntil(opened,list=>list.length>0,{what:'o link aberto depois do Abrir'});
  assert.deepEqual(await opened(),['https://exemplo.com/guia'],'abre o destino confirmado');
  assert.deepEqual(errors,[],'sem erro na página');
});

/* Imagem dentro de link: o clique fica com o visualizador de imagem e o link
   não abre diálogo (antes abriam os dois). */
await withArtifacts('message-links-image',async ctx=>{
 const runtime=ctx.runtime=newRuntime('message-links-image');
 const course=seedCourse(runtime,'calc');
 const pdf=path.join(course,'Limites.pdf');
 fs.writeFileSync(pdf,tinyPdf('Limites e derivadas'));
 writeConfigJson(runtime,{runtimePath:runtime,vaultPath:runtime,courses:[{id:'calc',name:'Cálculo I',path:course}]});
 const session=seedNativeSession(runtime,[{role:'user',content:[{type:'text',text:'mostre o gráfico'}]},{role:'assistant',content:[{type:'text',text:'aqui está o gráfico.'}]}],{courseId:'calc'});
 writeDeskJson(runtime,{courseId:'calc',session,courseStates:{calc:{session,pdfs:[{path:pdf,page:1}],study:{title:'',xopp:''}}}});
 const app=ctx.app=await launchDesk({runtime});
 const page=await app.firstWindow();
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await resizeWindow(app,page,1440,900);
 await statusOnline(page);
 await freezeMotion(page);
 await page.waitForSelector('.message.assistant',{timeout:30000});
 await page.evaluate(()=>{
  const body=document.querySelector('.message.assistant .body');
  const anchor=document.createElement('a');
  anchor.href='https://exemplo.com/imagem';
  const img=document.createElement('img');
  img.className='plot';
  img.alt='gráfico';
  img.src='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  anchor.append(img);
  body.append(anchor);
 });
  await page.locator('.message.assistant .body a img.plot').click();
  await page.waitForFunction(()=>document.querySelector('#image-dialog').open);
  assert.equal(await page.locator('#image-dialog').evaluate(el=>el.open),true,'o clique na imagem abre o visualizador');
  assert.equal(await page.locator('#link-dialog').evaluate(el=>el.open),false,'o link não abre diálogo no clique da imagem');
  await page.keyboard.press('Escape');
  assert.deepEqual(errors,[],'sem erro na página');
});

/* Imagem remota em link: passa pelo Markdown de verdade, sem rede e sem criar
   o elemento à mão — o clique segue o diálogo normal (só `img.plot`/`img.shot`
   ficam com o visualizador). A CSP (`img-src 'self' data: blob:`) barra a rede. */
await withArtifacts('message-links-remote',async ctx=>{
  const runtime=ctx.runtime=newRuntime('message-links-remote');
  const course=seedCourse(runtime,'calc');
  const pdf=path.join(course,'Limites.pdf');
  fs.writeFileSync(pdf,tinyPdf('Limites e derivadas'));
  writeConfigJson(runtime,{runtimePath:runtime,vaultPath:runtime,courses:[{id:'calc',name:'Cálculo I',path:course}]});
  const body='Veja a figura [![g](https://exemplo.com/g.png)](https://exemplo.com/x) no texto.';
  const session=seedNativeSession(runtime,[{role:'user',content:[{type:'text',text:'onde está a figura?'}]},{role:'assistant',content:[{type:'text',text:body}]}],{courseId:'calc'});
  writeDeskJson(runtime,{courseId:'calc',session,courseStates:{calc:{session,pdfs:[{path:pdf,page:1}],study:{title:'',xopp:''}}}});
  const app=ctx.app=await launchDesk({runtime});
  const page=await app.firstWindow();
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await app.evaluate(({shell})=>{globalThis.__openedLinks=[];shell.openExternal=async url=>{globalThis.__openedLinks.push(url);};});
  await resizeWindow(app,page,1440,900);
  await statusOnline(page);
  await freezeMotion(page);
  await page.waitForSelector('.message.assistant .body a[href="https://exemplo.com/x"] img',{timeout:30000});
  const remote=await page.evaluate(()=>{
    const img=document.querySelector('.message.assistant .body a[href="https://exemplo.com/x"] img');
    return {cls:img.className, src:img.getAttribute('src'), wide:img.naturalWidth, complete:img.complete};
  });
  assert.ok(!/\b(plot|shot)\b/.test(remote.cls),`a remota não vira plot/shot (${remote.cls})`);
  assert.equal(remote.src,'https://exemplo.com/g.png','o src remoto passa pelo Markdown');
  assert.equal(remote.wide,0,`a CSP barra a rede: sem pixels (${remote.wide}px, complete ${remote.complete})`);
  await page.locator('.message.assistant .body a[href="https://exemplo.com/x"] img').click();
  await page.waitForFunction(()=>document.querySelector('#link-dialog').open,undefined,{timeout:15000});
  assert.equal(await page.locator('#image-dialog').evaluate(el=>el.open),false,'a remota não abre o visualizador');
  assert.equal(await page.locator('#link-host').textContent(),'exemplo.com','o clique morto agora abre o diálogo');
  await page.locator('#link-dialog button[value="cancel"]').click();
  await page.waitForFunction(()=>!document.querySelector('#link-dialog').open);
  assert.deepEqual(errors,[],'sem erro na página');
});
console.log('MESSAGE LINKS PASSED: https abre pelo diálogo da Mesa; http e âncora não fazem nada.');
