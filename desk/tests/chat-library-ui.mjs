import {reviewShot,screenshotDirectory,resizeWindow} from './helpers.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {openSessionLibrary,launchDesk,seedCourse,writeConfigJson,writeDeskJson,tinyPdf,statusOnline} from './helpers.mjs';
const out=screenshotDirectory('chat-library-ui');

const runtime=fs.mkdtempSync(path.join(os.tmpdir(),'mesa-chat-library-ui-'));
const course=seedCourse(runtime,'calc');const pdf=path.join(course,'Limites.pdf');fs.writeFileSync(pdf,tinyPdf('Limites e derivadas'));
const old=Date.now()-365*86400000,recent=Date.now()-86400000;
const sessionA=path.join(runtime,`pi-${old}.jsonl`),sessionB=path.join(runtime,`pi-${recent}.jsonl`);
for(const [file,text] of [[sessionA,'Quero estudar limites fundamentais'],[sessionB,'Uma dúvida sobre derivadas']])fs.writeFileSync(file,JSON.stringify({type:'message',message:{role:'user',content:[{type:'text',text}]}})+'\n');
writeConfigJson(runtime,{runtimePath:runtime,vaultPath:runtime,courses:[{id:'calc',name:'Cálculo',path:course}]});
writeDeskJson(runtime,{courseId:'calc',session:sessionA,courseStates:{calc:{session:sessionA,sessions:[{path:sessionA,started:old},{path:sessionB,started:recent}],draft:'rascunho inicial',pdfs:[{path:pdf,page:1}],study:{title:'Limites',xopp:''}}}});
let app;
try{
 app=await launchDesk({runtime});const page=await app.firstWindow();const errors=[];page.on('pageerror',error=>errors.push(error.message));
 /* O `#session-title` já está no HTML: esperar só por ele deixava o clique
    cair logo antes de o boot ligar o tutor, que trava o título durante a
    conexão — o clique era engolido e a lista não abria. Espera o tutor ligado. */
 await statusOnline(page);
 await openSessionLibrary(page);
 await page.waitForSelector('#chat-library-dialog[open]');
 assert.equal(await page.locator('.chat-library-row').count(),2);
 const first=page.locator('.chat-library-row').filter({hasText:'limites fundamentais'});
 await first.getByRole('button',{name:'Título e assunto'}).click();
 await page.locator('#chat-library-edit-title').fill('Limites: propriedades e exemplos');
 await page.locator('#chat-library-edit-topic').fill('Limites');
 await page.locator('#chat-library-editor').getByRole('button',{name:'Salvar',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('#chat-library-editor').hidden);
 await page.locator('#chat-library-query').fill('propriedades');assert.equal(await page.locator('.chat-library-row').count(),1);
 await page.locator('.chat-library-row').getByRole('button',{name:'☆ Favoritar',exact:true}).click();
 await page.waitForSelector('.chat-library-row button:has-text("★ Favorita")');
 await page.locator('#chat-library-query').fill('');
 await reviewShot(page,out,'01-conversas.png');
 await reviewShot(page.locator('#chat-library-dialog'),out,'01-conversas-detalhe.png');
 await page.getByRole('button',{name:'Fechar',exact:true}).click();
 await page.evaluate(async()=>{const data=await window.desk.init();await window.desk.save({...data.state,draft:'rascunho A que precisa continuar'});});
 await page.locator('#prompt').fill('rascunho A que precisa continuar');
 await openSessionLibrary(page);
 await page.waitForSelector('#chat-library-dialog[open]');
 await page.waitForFunction(()=>document.querySelectorAll('.chat-library-row').length===2);
 await page.locator('.chat-library-row').filter({hasText:'Uma dúvida sobre derivadas'}).locator('.chat-library-resume').click();
 await page.waitForFunction(()=>!document.querySelector('#chat-library-dialog').open);
 assert.equal(await page.locator('#prompt').inputValue(),'');
 await page.locator('#prompt').fill('rascunho B separado');
 await page.evaluate(async()=>{const data=await window.desk.init();await window.desk.save({...data.state,draft:'rascunho B separado'});});
 await openSessionLibrary(page);
 await page.locator('#chat-library-topic').selectOption('Limites');
 assert.equal(await page.locator('.chat-library-row').count(),1);
 await page.locator('.chat-library-resume').click();
 await page.waitForFunction(()=>!document.querySelector('#chat-library-dialog').open);
 assert.equal(await page.locator('#prompt').inputValue(),'rascunho A que precisa continuar');
 const labels=JSON.parse(fs.readFileSync(path.join(runtime,'chat-library.json'),'utf8'));assert.ok(Object.values(labels.items).some(x=>x.topic==='Limites'&&x.favorite));
 await app.close();app=null;
 app=await launchDesk({runtime});const reopened=await app.firstWindow();
 await statusOnline(reopened);await openSessionLibrary(reopened);
 await reopened.locator('#chat-library-favorites').check();assert.equal(await reopened.locator('.chat-library-row').count(),1);
 assert.ok((await reopened.locator('.chat-library-row').textContent()).includes('Limites: propriedades e exemplos'));
 assert.equal(await reopened.locator('#prompt').inputValue(),'rascunho A que precisa continuar');
 /* A janela muda depois de o pedido voltar: mede só com a página em 900×650. */
 await resizeWindow(app,reopened,900,650,{content:true});
 const bounds=await reopened.locator('#chat-library-dialog').boundingBox();assert.ok(bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=900&&bounds.y+bounds.height<=650);
 assert.deepEqual(errors,[]);
 console.log('CHAT LIBRARY UI PASSED: conversa de um ano, título/assunto/favoritos, filtros, retomada, rascunhos por conversa, reabertura e 900x650. Provider fake-Pi; dados sintéticos.');
}finally{if(app)await app.close();fs.rmSync(runtime,{recursive:true,force:true});}
