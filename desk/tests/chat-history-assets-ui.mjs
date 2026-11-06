import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {launchDesk,seedCourse,seedNativeSession,writeConfigJson,writeDeskJson,statusOnline,freezeMotion,resizeWindow,sendEnabled,PLOT_PNG} from './helpers.mjs';
import {tempDir} from './temp-dir.mjs';
import {layoutStable} from './waits.mjs';
import {closeApp} from './proc-tree.mjs';

/* Histórico com imagem e asset no stream (#117 e o vazio do asset): a
   mensagem só com imagem aparece certa (bolha com o `img.shot`, sem texto) e
   não some ao reabrir — o corte para a tela nunca apaga o descritor; durante
   o stream a figura ainda não carregada reserva espaço (não vira um vão vazio
   que pula a rolagem ao hidratar). Janela real com o fake OpenCode. */

const imagePart=()=>({type:'image',data:PLOT_PNG,mimeType:'image/png'});

function seedHistory(runtime,courseId){
  const messages=[];
  for(let i=0;i<7;i++){
    messages.push({role:'user',content:[{type:'text',text:`pergunta ${i}`},imagePart()]});
    messages.push({role:'assistant',content:[{type:'text',text:`resposta ${i}`}]});
  }
  /* A mais recente é só imagem, sem texto: é a que não pode sumir. */
  messages.push({role:'user',content:[imagePart()]});
  return seedNativeSession(runtime,messages,{courseId,started:Date.now()-3600000,preview:'pergunta 6'});
}

function openDeskJson(runtime,courseId,session){
  writeDeskJson(runtime,{courseId,session,courseStates:{[courseId]:{session,sessions:[{path:session,started:Date.now()-3600000}],pdfs:[],study:{title:'',xopp:''}}}});
}

function descriptorImages(file){
  const saved=JSON.parse(fs.readFileSync(file,'utf8'));
  return saved.messages.flatMap(message=>message.content||[]).filter(part=>part&&part.type==='image');
}

function descriptorHasText(file,text){
  try{
    const saved=JSON.parse(fs.readFileSync(file,'utf8'));
    return saved.messages.some(message=>(message.content||[]).some(part=>part&&part.type==='text'&&typeof part.text==='string'&&part.text.includes(text)));
  }catch{return false;}
}

const scroller=page=>page.evaluate(()=>{
  const chat=document.querySelector('#chat'),messages=document.querySelector('#messages');
  const el=chat&&messages&&chat.scrollHeight>chat.clientHeight+1?chat:messages;
  return {top:el.scrollTop,distance:el.scrollHeight-el.scrollTop-el.clientHeight};
});

/* Janela com prazo e motivo: `firstWindow` sem timeout espera a janela na
   fé do default do Playwright e uma abertura que não vem virava silêncio até
   o timeout externo do laço de rodadas. */
const firstPageOf=app=>app.firstWindow({timeout:30000}).catch(error=>{throw Error(`a janela da Mesa não abriu em 30 s: ${error.message}`);});

const runtime=tempDir('mesa-chat-history-assets');
const courseId='calc';
const course=seedCourse(runtime,courseId);
const session=seedHistory(runtime,courseId);
writeConfigJson(runtime,{runtimePath:runtime,vaultPath:runtime,courses:[{id:courseId,name:'Cálculo',path:course}]});
openDeskJson(runtime,courseId,session);
let app=null;
let runtimeB=null;
try{
  /* (a) a mensagem só com imagem aparece certa na tela. */
  app=await launchDesk({runtime,env:{FAKE_OPENCODE_REPLY:'Entendido.'}});
  let page=await firstPageOf(app);
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await resizeWindow(app,page,1440,900);
  await statusOnline(page);
  await freezeMotion(page);
  await page.waitForFunction(()=>document.querySelectorAll('#messages .message.user').length===8,undefined,{timeout:60000});
  await layoutStable(page,'#messages');
  const lastUser=await page.evaluate(()=>{
    const bubbles=[...document.querySelectorAll('#messages .message.user')];
    const el=bubbles.at(-1),body=el.querySelector('.body');
    return {shots:[...body.querySelectorAll('img.shot')].filter(img=>img.src.startsWith('data:')).length,paras:body.querySelectorAll('p').length,visible:el.getBoundingClientRect().height>0};
  });
  assert.deepEqual(lastUser,{shots:1,paras:0,visible:true},'a mensagem só com imagem vira bolha com o shot e sem parágrafo');
  /* A tela corta nas 6 mais recentes (regra antiga); o disco guarda as 8. */
  assert.equal(await page.evaluate(()=>document.querySelectorAll('#messages .message.user img.shot').length),6,'a tela mostra as 6 imagens mais recentes');
  assert.equal(descriptorImages(session).length,8,'o descritor ainda tem as 8 imagens depois de abrir');

  /* Enviar guarda a conversa: o corte da tela não pode vazar para o disco (#117). */
  await sendEnabled(page);
  await page.locator('#prompt').fill('pode guardar');
  await page.locator('#send').click();
  await page.waitForFunction(()=>[...document.querySelectorAll('#messages .message.assistant .body')].some(el=>el.textContent.includes('Entendido.')),undefined,{timeout:60000});
  /* A gravação é assíncrona: sonda o descritor até a mensagem nova chegar. */
  const savedWithNew=await (async()=>{
    const deadline=Date.now()+15000;
    for(;;){
      if(descriptorHasText(session,'pode guardar'))return descriptorImages(session).length;
      if(Date.now()>deadline)throw new Error('o descritor não guardou a mensagem enviada');
      await new Promise(r=>setTimeout(r,100));// espera fixa: intervalo de polling até a gravação do descritor
    }
  })();
  assert.equal(savedWithNew,8,'enviar depois de abrir não apaga as imagens antigas do descritor');

  /* Reabrir mostra a mensagem só com imagem de novo. */
  await closeApp(app);app=null;
  app=await launchDesk({runtime,env:{FAKE_OPENCODE_REPLY:'Entendido.'}});
  page=await firstPageOf(app);
  page.on('pageerror',error=>errors.push(error.message));
  await statusOnline(page);
  await freezeMotion(page);
  await page.waitForFunction(()=>document.querySelectorAll('#messages .message.user').length===9,undefined,{timeout:60000});
  await layoutStable(page,'#messages');
  const reopened=await page.evaluate(()=>{
    const bubbles=[...document.querySelectorAll('#messages .message.user')];
    const el=bubbles.find(node=>[...node.querySelectorAll('.body img.shot')].length&&!node.querySelector('.body p'));
    return {found:!!el,shots:el?[...el.querySelectorAll('img.shot')].filter(img=>img.src.startsWith('data:')).length:0};
  });
  assert.deepEqual(reopened,{found:true,shots:1},'a mensagem só com imagem continua na tela ao reabrir');
  assert.equal(descriptorImages(session).length,8,'o descritor continua com as 8 imagens ao reabrir');
  await closeApp(app);app=null;

  /* (b) a figura do stream reserva espaço antes de carregar. */
  runtimeB=tempDir('mesa-chat-stream-asset');
  const courseB=seedCourse(runtimeB,'calc');
  const figure=path.join(courseB,'longa.svg');
  fs.writeFileSync(figure,`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="600" height="400" fill="#eee"/><circle cx="300" cy="200" r="120" fill="#999"/></svg>`);
  writeConfigJson(runtimeB,{runtimePath:runtimeB,vaultPath:runtimeB,courses:[{id:'calc',name:'Cálculo',path:courseB}]});
  writeDeskJson(runtimeB,{courseId:'calc'});
  app=await launchDesk({runtime:runtimeB,env:{FAKE_OPENCODE_LONG_IMAGE:figure,FAKE_OPENCODE_LONG_HOLD_MS:'700'}});
  page=await firstPageOf(app);
  page.on('pageerror',error=>errors.push(error.message));
  await resizeWindow(app,page,1440,900);
  await statusOnline(page);
  await freezeMotion(page);
  await sendEnabled(page);
  await page.locator('#prompt').fill('resposta longa');
  await page.locator('#send').click();
  await page.waitForFunction(()=>{
    const figureEl=document.querySelector('#messages figure.asset');
    return figureEl&&figureEl.querySelector('img.plot')?.complete;
  },undefined,{timeout:60000});
  /* Volta ao estado "ainda não carregado" e mede: o vão não pode colapsar. */
  const reserved=await page.evaluate(()=>{
    const figureEl=document.querySelector('#messages figure.asset');
    figureEl.replaceChildren();
    return {empty:figureEl.childElementCount===0,height:figureEl.getBoundingClientRect().height};
  });
  assert.equal(reserved.empty,true,'a figura nasce vazia antes de hidratar');
  assert.ok(reserved.height>=100,`a figura vazia reserva espaço (${reserved.height}px), sem vão esquisito nem pulo ao carregar`);
  /* Seguindo o fim, a hidratação não tira a vista do fim. */
  await page.waitForFunction(()=>{
    const chat=document.querySelector('#chat'),messages=document.querySelector('#messages');
    const el=chat&&messages&&chat.scrollHeight>chat.clientHeight+1?chat:messages;
    return el.scrollHeight-el.scrollTop-el.clientHeight<=2;
  },undefined,{timeout:15000});
  const end=await scroller(page);
  assert.ok(end.distance<=2,`hidratar a figura com o fim seguindo não pula a rolagem (distância ${end.distance})`);
  /* Lendo acima durante o stream: a figura que chega embaixo não puxa. O envio
     ancora a vista de propósito; o que não pode puxar é o crescimento alheio —
     por isso a subida acontece no meio do turno, não antes de enviar. */
  await page.locator('#prompt').fill('resposta longa');
  await page.locator('#send').click();
  await page.waitForFunction(()=>{
    const chat=document.querySelector('#chat'),messages=document.querySelector('#messages');
    const el=chat&&messages&&chat.scrollHeight>chat.clientHeight+1?chat:messages;
    const tall=el.scrollHeight-el.clientHeight>=900;
    return tall&&[...document.querySelectorAll('#messages .message.assistant .body')].some(node=>node.textContent.includes('Parágrafo 50'));
  },undefined,{timeout:60000});
  /* Gesto real de roda (d7e5f464: seguir só desliga por gesto do aluno). */
  const box=await page.locator('#messages').boundingBox();
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
  await page.mouse.wheel(0,-600);
  await page.waitForFunction(()=>{
    const chat=document.querySelector('#chat'),messages=document.querySelector('#messages');
    const el=chat&&messages&&chat.scrollHeight>chat.clientHeight+1?chat:messages;
    return el.scrollHeight-el.scrollTop-el.clientHeight>=400;
  },undefined,{timeout:15000});
  const held=await scroller(page);
  assert.ok(held.distance>=400,'o teste precisa começar 500px acima do fim');
  /* A primeira figura foi esvaziada de propósito no B1; o que prova a segunda
     hidratação é o segundo placeholder com a imagem completa. */
  await page.waitForFunction(()=>document.querySelectorAll('#messages figure.asset').length===2&&[...document.querySelectorAll('#messages figure.asset')].some(figureEl=>figureEl.querySelector('img.plot')?.complete),undefined,{timeout:60000});
  const after=await scroller(page);
  assert.ok(Math.abs(after.top-held.top)<=2,`hidratar a figura embaixo não move quem lê acima (${held.top} → ${after.top})`);

  assert.deepEqual(errors,[],`erros na página: ${errors.join(' | ')}`);
  console.log('PASS chat-history-assets-ui — imagem só no histórico aparece e sobrevive a reabrir; figura do stream reserva espaço sem pular a rolagem.');
}finally{
  if(app)await closeApp(app);
  fs.rmSync(runtime,{recursive:true,force:true});
  if(runtimeB)try{fs.rmSync(runtimeB,{recursive:true,force:true});}catch{/* o sweep do tempDir cobre a falha */}
}
