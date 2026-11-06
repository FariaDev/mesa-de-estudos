import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {withArtifacts,launchDesk,newRuntime,seedCourse,writeConfigJson,tinyPdfPages,statusOnline,freezeMotion,resizeWindow,tutorMore} from './helpers.mjs';
import {layoutStable,nextFrames,pdfRenderIdle} from './waits.mjs';

/* Chat na tela inteira (#98): o botão do cabeçalho e o atalho alternam o modo
   nas abas de matéria e na Livre; a coluna de leitura fica em ~720px numa janela
   grande; os leitores só saem de vista (PDF, página e zoom voltam iguais); o
   modo convive com o chat lateral, com "Recolher o tutor" e com a calculadora.
   A escolha é global — trocar de aba não a desfaz — e não sobrevive a reabrir o
   app (não vai ao estado salvo). */

const WIDE=[1440,900];

async function openDesk(ctx,tag){
 const runtime=ctx.runtime=newRuntime(tag),course=seedCourse(runtime,'Test');
 fs.writeFileSync(path.join(course,'Limites.pdf'),tinyPdfPages(3,'pagina'));
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'Test',name:'Cálculo I',path:course}],desk:{panels:[{label:'Lista',prefer:['Limites']}],pinnedExtensions:false}});
 ctx.app=await launchDesk({runtime});
 const page=await ctx.app.firstWindow();
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await statusOnline(page);
 await page.waitForSelector('.pdf-panel canvas',{timeout:25000});
 await resizeWindow(ctx.app,page,...WIDE);
 await freezeMotion(page);
 await layoutStable(page,'#chat');
 return {page,errors};
}

const fullState=page=>page.evaluate(()=>{
 const chat=document.querySelector('#chat').getBoundingClientRect();
 return {
  full:document.body.classList.contains('chat-full'),
  refsDisplay:getComputedStyle(document.querySelector('#references')).display,
  dividerDisplay:getComputedStyle(document.querySelector('#divider')).display,
  chat:chat.toJSON(),
  calc:document.querySelector('#calculator').getBoundingClientRect().toJSON(),
  leftGap:chat.left,
  rightGap:innerWidth-chat.right,
  reading:Number.parseFloat(getComputedStyle(document.body).getPropertyValue('--reading-column')),
  pressed:document.querySelector('#chat-full').getAttribute('aria-pressed'),
  title:document.querySelector('#chat-full').getAttribute('title')
 };
});

const readerState=page=>page.evaluate(async()=>{
 const {S}=await import('./src/state.mjs');
 const panel=S.panels[0];
 return {path:panel.path,page:panel.page,zoom:panel.zoom,scrollY:Math.round(panel.q('.pdf-viewport').scrollTop),savedY:Math.round(panel.scrollY)};
});

async function waitFull(page,value){
 await page.waitForFunction(want=>document.body.classList.contains('chat-full')===want,value,{timeout:5000});
 await layoutStable(page,'#chat');
}

async function toggleByButton(page){
 await page.locator('#chat-full').click();
}

await withArtifacts('chat-fullscreen-ui',async ctx=>{
 const {page,errors}=await openDesk(ctx,'chat-full');

 /* Ponto de partida: o modo não existe e o botão oferece a tela inteira. */
 assert.equal((await fullState(page)).full,false,'a Mesa abre com o chat ao lado');
 assert.equal(await page.locator('#chat-full').isVisible(),true,'o botão mora no cabeçalho do tutor');
 assert.equal((await fullState(page)).pressed,'false');
 assert.equal((await fullState(page)).title,'Chat na tela inteira');
 assert.equal(await page.locator('#references').isVisible(),true,'os leitores começam à vista');

 /* Deixa o leitor num documento, numa página e num zoom reconhecíveis. */
 await page.evaluate(async()=>{const {S}=await import('./src/state.mjs');S.panels[0].goto(2);S.panels[0].nudgeZoom(0.2);});
 await page.waitForFunction(()=>document.querySelector('.pdf-more-pop .zoom-label')?.textContent.trim()==='120%');
 await pdfRenderIdle(page);
 /* Parado no meio da página: a volta tem de achar o mesmo ponto, não o topo. */
 await page.evaluate(async()=>{const {S}=await import('./src/state.mjs');const panel=S.panels[0];const box=panel.q('.pdf-viewport');box.scrollTop=panel.pageEls[1].offsetTop+Math.round(panel.pageEls[1].offsetHeight/3);});
 /* espera fixa: o leitor grava a posição no evento de rolagem. */
 await page.waitForTimeout(60);
 const before=await readerState(page);
 assert.equal(before.page,2,'o leitor está na página 2 antes do modo');

 /* Ida pelo botão: só a área de referências sai de vista; a coluna central fica
    em 720px de texto, centrada, e a calculadora acompanha no pé. */
 await toggleByButton(page);
 await waitFull(page,true);
 await nextFrames(page,2);
 /* Esconder não é rolar: a posição gravada continua a de antes, senão a troca
    de aba ou o próximo render voltam ao topo (#98). */
 assert.equal((await readerState(page)).savedY,before.scrollY,'esconder não zera a rolagem gravada');
 const full=await fullState(page);
 assert.equal(full.refsDisplay,'none','a área de referências sai de vista');
 assert.equal(full.dividerDisplay,'none','a divisória do tutor sai de vista');
 assert.equal(full.pressed,'true','o botão mostra o modo ligado');
 assert.equal(full.title,'Chat ao lado','o botão passa a oferecer a volta');
 assert.equal(full.reading,720,'a coluna de leitura é de 720px');
 const reading=await page.locator('#messages').evaluate(el=>{
  const style=getComputedStyle(el);
  return el.clientWidth-Number.parseFloat(style.paddingLeft)-Number.parseFloat(style.paddingRight);
 });
 assert.ok(reading>=690&&reading<=720,`o texto ocupa a coluna de leitura (${reading}px)`);
 assert.ok(Math.abs(full.chat.width-744)<=1,`a coluna do tutor para de crescer em 744px (${full.chat.width})`);
 assert.ok(Math.abs(full.leftGap-full.rightGap)<=1,'a coluna do tutor fica centrada');
 assert.ok(Math.abs(full.calc.width-full.chat.width)<=1,'a calculadora acompanha a coluna');
 assert.equal(await page.locator('#calc-bar').isVisible(),true,'a calculadora continua à vista');
 assert.equal(await page.locator('#messages').isVisible(),true,'a conversa continua à vista');

 /* Volta pelo botão: PDF, página e zoom são os mesmos; os leitores reaparecem. */
 await toggleByButton(page);
 await waitFull(page,false);
 await page.locator('#references').waitFor({state:'visible'});
 await pdfRenderIdle(page);
 assert.deepEqual(await readerState(page),before,'PDF, página e zoom voltam iguais');
 assert.equal((await fullState(page)).refsDisplay,'flex','os leitores voltam à vista');
 assert.equal((await fullState(page)).title,'Chat na tela inteira');

 /* Atalho: ida e volta sem colidir com os reservados (⌘⇧E / Ctrl+Shift+E). */
 await page.keyboard.press('ControlOrMeta+Shift+E');
 await waitFull(page,true);
 assert.equal((await fullState(page)).pressed,'true','o atalho entra no modo');
 await page.keyboard.press('ControlOrMeta+Shift+E');
 await waitFull(page,false);
 await page.locator('#references').waitFor({state:'visible'});
 assert.deepEqual(await readerState(page),before,'o atalho também devolve o leitor igual');

 /* O atalho aparece no editor de atalhos, com o combo atual. */
 await page.keyboard.press('ControlOrMeta+/');
 await page.waitForSelector('#help-dialog[open]',{timeout:5000});
 await page.locator('#keys-customize').click();
 await page.waitForSelector('#keys-dialog[open]',{timeout:5000});
 const row=page.locator('#keys-dialog [data-action="chat-full"]');
 assert.equal(await row.count(),1,'a ação nova aparece no editor');
 assert.match(await row.textContent(),/Chat na tela inteira ou ao lado/);
 assert.match(await row.locator('.keys-kbd').textContent(),/E/,'o editor mostra o E do combo');
 await page.locator('#keys-dialog #keys-done').click();
 await page.waitForFunction(()=>!document.querySelector('#keys-dialog')?.open);
 await page.locator('#help-dialog .dialog-close').click();
 await page.waitForFunction(()=>!document.querySelector('#help-dialog')?.open);

 /* Os textos acompanham o idioma da interface. */
 await page.evaluate(async()=>{const {setUiLanguage}=await import('./src/ui-text.mjs');setUiLanguage('en');});
 await page.waitForFunction(()=>document.querySelector('#chat-full')?.title==='Full-screen tutor');
 await page.evaluate(async()=>{const {setUiLanguage}=await import('./src/ui-text.mjs');setUiLanguage('pt-BR');});
 await page.waitForFunction(()=>document.querySelector('#chat-full')?.title==='Chat na tela inteira');

 /* Coexistência com o chat lateral: entrar não fecha o lateral, só o tira de
    vista; sair devolve o que estava aberto. */
 await page.locator('#sidechat-toggle').click();
 await page.waitForFunction(()=>{const el=document.querySelector('#sidechat');return el&&!el.hidden&&el.getBoundingClientRect().width>0;},undefined,{timeout:20000});
 await toggleByButton(page);
 await waitFull(page,true);
 assert.equal(await page.locator('#sidechat').isVisible(),false,'o chat lateral sai de vista com os leitores');
 assert.equal(await page.locator('#sidechat-toggle').getAttribute('aria-pressed'),'true','o estado do lateral continua guardado');
 await toggleByButton(page);
 await waitFull(page,false);
 await page.waitForFunction(()=>{const el=document.querySelector('#sidechat');return el&&!el.hidden&&el.getBoundingClientRect().width>0;},undefined,{timeout:10000});
 assert.equal(await page.locator('#sidechat').isVisible(),true,'sair do modo devolve o chat lateral aberto');
 await page.locator('#sidechat-close').click();
 await page.waitForFunction(()=>document.querySelector('#sidechat')?.hidden);

 /* Coexistência com "Recolher o tutor": recolher sai da tela inteira; o botão
    de reabrir devolve o tutor ao lado. */
 await toggleByButton(page);
 await waitFull(page,true);
 await tutorMore(page,'#chat-collapse').click();
 await page.waitForFunction(()=>document.body.classList.contains('chat-collapsed'));
 assert.equal((await fullState(page)).full,false,'recolher o tutor desfaz a tela inteira');
 await page.locator('#chat-restore').click();
 await page.waitForFunction(()=>!document.body.classList.contains('chat-collapsed'));
 assert.equal((await fullState(page)).full,false,'o tutor volta ao lado, não na tela inteira');

 /* Aba Livre: o mesmo botão e o mesmo atalho, com a escolha global. */
 await page.locator('#course-tabs button[data-id="mesa-free"]').click();
 await page.waitForFunction(()=>!document.querySelector('#free-bar')?.hidden,undefined,{timeout:30000});
 await toggleByButton(page);
 await waitFull(page,true);
 assert.equal((await fullState(page)).refsDisplay,'none','na Livre os leitores também saem de vista');
 await toggleByButton(page);
 await waitFull(page,false);
 assert.equal(await page.locator('#free-bar').isVisible(),true,'sair do modo devolve a barra da Livre');
 await page.keyboard.press('ControlOrMeta+Shift+E');
 await waitFull(page,true);
 assert.equal((await fullState(page)).full,true,'o atalho vale na Livre');
 await page.keyboard.press('ControlOrMeta+Shift+E');
 await waitFull(page,false);
 assert.equal((await fullState(page)).full,false,'o atalho desfaz na Livre');

 assert.deepEqual(errors,[]);
 console.log('PASS: chat na tela inteira pelo botão e atalho, na matéria e na Livre; leitor igual na volta; coluna de 720px; convive com lateral, recolher e calculadora');
});
