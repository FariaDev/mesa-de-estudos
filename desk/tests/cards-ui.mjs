/* Cartões do tutor na janela (#92): o cartão registrado pelo host aparece na
   conversa, a resposta certa só depois de responder, "Concluir" manda UMA
   mensagem nova e o pending sobrevive ao reload. Fake do Pi; nenhum motor real. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {launchDesk,newRuntime,openSessionById,pageWindow,seedCourse,seedNativeSession,statusOnline,withArtifacts,writeConfigJson,writeDeskJson} from './helpers.mjs';
import {pollUntil} from './waits.mjs';

const require=createRequire(import.meta.url);
const cardStore=require('../card-store.cjs');
const {normalizeQuiz,normalizeAsk}=await import('../src/cards/input.mjs');

await withArtifacts('cartoes',async ctx=>{
 const runtime=ctx.runtime=newRuntime('cartoes');
 seedCourse(runtime,'Calculus I');
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'Calculus I',name:'Cálculo I',path:path.join(runtime,'learning','Courses','Calculus I')}]});
 const session=seedNativeSession(runtime,[{role:'assistant',content:[{type:'text',text:'Vamos revisar limites.'}]}],{courseId:'Calculus I'});
 writeDeskJson(runtime,{session,courseId:'Calculus I'});
 const pending=cardStore.createCard(runtime,session,normalizeQuiz({
  question:'Qual é o limite de $\\frac{x^2-1}{x-1}$ quando $x\\to 1$?',
  options:[{label:'0'},{label:'2'},{label:'Não existe'}],
  correctAnswer:'2',
  explanation:'Fatorando: $x+1\\to 2$.',
 }));
 const app=ctx.app=await launchDesk({runtime});
 const page=await app.firstWindow();
 /* O cartão aparece antes de o fake Pi conectar; concluir sem esperar o tutor
    enfileirava a mensagem e o `fila.log` do teste ainda não existia. */
 await statusOnline(page);
 await page.waitForSelector('.quiz-card',{timeout:30000});
 assert.match(await page.locator('.quiz-question').textContent(),/limite/);
 const pendingCard=page.locator(`[data-tool="${pending.id}"]`);
 assert.equal(await page.locator('.quiz-option.correct').count(),0,'resposta certa escondida antes de responder');
 assert.equal(await page.locator('.quiz-explain').count(),0);
 assert.ok(!(await pendingCard.textContent()).includes('Fatorando'),'o texto do cartão não traz a explicação antes da resposta');
 assert.ok(!(await pendingCard.innerHTML()).includes('Fatorando'),'o HTML do cartão não traz a explicação antes da resposta');
 assert.ok(!(await page.locator('#messages').textContent()).includes('Fatorando'),'nem o diário/conversa');
 const listed=await page.evaluate(()=>window.desk.cardList());
 const pendingListed=listed.find((card)=>card.id===pending.id);
 assert.equal(pendingListed.explanation,undefined,'o conteúdo enviado ao renderer não carrega a explicação antes da resposta');
 assert.equal(pendingListed.correctIndices,undefined,'nem os índices certos antes da resposta');
 assert.equal(await pendingCard.evaluate((el)=>el._card().explanation),undefined,'o cartão montado também não guarda a explicação');

 await page.locator('.quiz-option').nth(1).click();
 await page.waitForSelector('.quiz-verdict',{timeout:10000});
 assert.equal(await page.locator('.quiz-option.correct').count(),1,'a opção certa é pintada depois da resposta');
 assert.equal(await page.locator('.quiz-option.wrong').count(),0);
 assert.match(await page.locator('.quiz-explain').textContent(),/Fatorando/);
 assert.match(await pendingCard.textContent(),/Fatorando/,'depois da resposta a explicação entra no cartão');
 await page.locator('.quiz-conclude').click();
 await page.waitForSelector('.quiz-sent',{timeout:15000});
 const sent=fs.readFileSync(session,'utf8');
 assert.match(sent,/\[Resultado do cartão: /,'o resultado vai ao tutor numa mensagem nova');

 const second=cardStore.createCard(runtime,session,normalizeQuiz({question:'Quanto é 2+2?',options:[{label:'3'},{label:'4'}],correctAnswer:'4'}));
 await page.reload();
 await page.waitForFunction(()=>document.querySelectorAll('.quiz-card').length===2,undefined,{timeout:30000});
 assert.equal(await page.locator('.quiz-sent').count(),1,'o cartão concluído continua enviado depois do reload');
 assert.ok(!(await page.locator('#messages').textContent()).includes('[Resultado do cartão'),'o marcador do resultado não vira fala do aluno');
 const open=page.locator(`[data-tool="${pending.id}"]`), fresh=page.locator(`[data-tool="${second.id}"]`);
 assert.equal(await open.locator('.quiz-sent').count(),1,'o cartão concluído continua enviado depois do reload');
 assert.equal(await fresh.locator('.quiz-sent').count(),0);
 assert.equal(await open.locator('.quiz-option.correct').count(),1,'a correção do primeiro cartão continua visível');
 assert.equal(await fresh.locator('.quiz-option.correct').count(),0,'o cartão pendente volta sem a resposta certa');
 await fresh.locator('.quiz-option').nth(1).click();
 await fresh.locator('.quiz-skip').click();
 await page.waitForSelector(`[data-tool="${second.id}"] .quiz-dismissed`,{timeout:10000});

 /* `perguntar` em janela: pergunta com opções e texto livre, sem pular para o
    tutor antes de responder. */
 const ask=cardStore.createCard(runtime,session,normalizeAsk({questions:[
  {header:'Ritmo',question:'Como você resolveu?',options:[{label:'Por partes'}],multiSelect:false},
  {question:'Quer outro exemplo?',options:[{label:'Sim'},{label:'Não'}],multiSelect:false},
 ]}));
 await page.reload();
 await page.waitForFunction(()=>document.querySelectorAll('.quiz-card').length===3,undefined,{timeout:30000});
 const askCard=page.locator(`[data-tool="${ask.id}"]`);
 assert.match(await askCard.textContent(),/Como você resolveu\?/);
 assert.equal(await askCard.locator('.quiz-verdict').count(),0,'sem veredito antes de responder');
 await askCard.locator('.quiz-option').first().click();
 /* #release OpenCode: "Outra resposta" tem o mesmo desenho da opção — raio,
    recuo, altura, largura, borda e tipografia. */
 const sameLook=await askCard.evaluate(card=>{
  const option=[...card.querySelectorAll('.quiz-option')].find((el)=>el.getAttribute('aria-checked')!=='true');
  const free=card.querySelectorAll('.quiz-free')[1];
  const look=el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return {
   width:r.width,height:r.height,radius:s.borderTopLeftRadius,inset:[s.paddingTop,s.paddingRight,s.paddingBottom,s.paddingLeft].join(' '),
   border:[s.borderTopWidth,s.borderTopStyle,s.borderTopColor].join(' '),font:[s.fontFamily,s.fontSize,s.lineHeight].join('|')};};
  return {option:look(option),free:look(free)};
 });
 for(const key of ['width','height','radius','inset','border','font'])assert.equal(sameLook.free[key],sameLook.option[key],`"Outra resposta" acompanha a opção em ${key} (${JSON.stringify(sameLook)})`);
 await askCard.locator('.quiz-free').nth(1).fill('Agora não');
 await askCard.locator('.quiz-send').click();
 await page.waitForSelector(`[data-tool="${ask.id}"] .quiz-verdict`,{timeout:10000});
 assert.match(await askCard.locator('.quiz-verdict').textContent(),/Resposta registrada/);
 assert.equal(await askCard.locator('.quiz-explain').count(),0,'perguntar não tem explicação/correção');
 assert.equal(await askCard.locator('.quiz-option.correct').count(),0);
});

/* Tutor ausente: o envio falha ANTES de escrever. O cartão não pode ficar
   preso em "Enviando…": mostra Reenviar e Dispensar, inclusive depois do
   reload. */
await withArtifacts('cartoes-sem-tutor',async ctx=>{
 const runtime=ctx.runtime=newRuntime('cartoes-sem-tutor');
 seedCourse(runtime,'Calculus I');
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'Calculus I',name:'Cálculo I',path:path.join(runtime,'learning','Courses','Calculus I')}]});
 const session=seedNativeSession(runtime,[{role:'assistant',content:[{type:'text',text:'Sem tutor.'}]}],{courseId:'Calculus I'});
 writeDeskJson(runtime,{session,courseId:'Calculus I'});
 const card=cardStore.createCard(runtime,session,normalizeQuiz({question:'Quanto é 2+2?',options:[{label:'3'},{label:'4'}],correctAnswer:'4'}));
 cardStore.answerCard(runtime,session,card.id,{selected:[2]});
 const brokenEngine=path.join(runtime,'engine-sem-execucao');fs.writeFileSync(brokenEngine,'#!/bin/sh\n');fs.chmodSync(brokenEngine,0o644);
 const app=ctx.app=await launchDesk({runtime,opencode:false,env:{LEARNING_DESK_OPENCODE:brokenEngine}});
 const page=await app.firstWindow();
 await page.waitForSelector('.quiz-card',{timeout:30000});
 await page.locator('.quiz-conclude').click();
 await page.waitForFunction(()=>document.querySelector('[data-tool] .quiz-conclude')?.textContent.includes('Reenviar'),undefined,{timeout:30000});
 assert.equal(await page.locator('.quiz-pending').count(),0,'não fica preso em Enviando');
 const refusal=await page.locator('.quiz-error').textContent();
 assert.doesNotMatch(refusal,/err\.opencode|\uE000|\uE001/,'o motivo do motor chega traduzido, sem chave crua');
 assert.match(refusal,/OpenCode/,'o motivo diz qual motor não abriu');
 assert.equal(await page.locator('.quiz-skip').isVisible(),true,'há uma saída visível (Dispensar)');
 await page.reload();
 await page.waitForSelector('.quiz-card',{timeout:30000});
 assert.match(await page.locator('.quiz-conclude').textContent(),/Reenviar/,'depois do reload ainda dá para reenviar');
 assert.equal(await page.locator('.quiz-skip').isVisible(),true,'depois do reload ainda dá para dispensar');
});

/* Arquivo de cartão malformado não pode derrubar a abertura da conversa. */
await withArtifacts('cartoes-malformados',async ctx=>{
 const runtime=ctx.runtime=newRuntime('cartoes-malformados');
 seedCourse(runtime,'Calculus I');
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'Calculus I',name:'Cálculo I',path:path.join(runtime,'learning','Courses','Calculus I')}]});
 const session=seedNativeSession(runtime,[{role:'assistant',content:[{type:'text',text:'Conversa abre mesmo com cartão torto.'}]}],{courseId:'Calculus I'});
 writeDeskJson(runtime,{session,courseId:'Calculus I'});
 const file=cardStore.fileOf(runtime,session);
 fs.mkdirSync(path.dirname(file),{recursive:true});
 fs.writeFileSync(file,JSON.stringify({schemaVersion:1,session,cards:[{schemaVersion:1,id:'card-22222222-2222-4222-8222-222222222222',kind:'ask',session,createdAt:1,state:{answered:false,correct:false,dismissed:false,send:{$:'SendState.NotSent'},choice:''},answer:{},questions:[{question:'sem options'}]}]}));
 const app=ctx.app=await launchDesk({runtime});
 const page=await app.firstWindow();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.waitForFunction(()=>document.querySelector('#messages')?.textContent.includes('Conversa abre mesmo com cartão torto.'),undefined,{timeout:30000});
 assert.deepEqual(errors,[]);
 assert.equal(await page.locator('.quiz-card').count(),0,'o cartão torto não é montado');
 assert.match(fs.readFileSync(path.join(runtime,'desk.log'),'utf8'),/cartão inválido ignorado/,'o arquivo ruim fica no log');
});

/* Evento atrasado de outra conversa não monta cartão na conversa aberta. */
await withArtifacts('cartoes-conversa-trocada',async ctx=>{
 const runtime=ctx.runtime=newRuntime('cartoes-troca');
 seedCourse(runtime,'Calculus I');
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'Calculus I',name:'Cálculo I',path:path.join(runtime,'learning','Courses','Calculus I')}]});
 const a=seedNativeSession(runtime,[{role:'assistant',content:[{type:'text',text:'Conversa A.'}]}],{courseId:'Calculus I'});
 // espera fixa: o nome do JSONL usa Date.now(); 5 ms separam A de B.
 await new Promise((resolve)=>setTimeout(resolve,5));
 const b=seedNativeSession(runtime,[{role:'assistant',content:[{type:'text',text:'Conversa B.'}]}],{courseId:'Calculus I'});
 writeDeskJson(runtime,{session:a,courseId:'Calculus I',courseStates:{'Calculus I':{session:a,sessions:[{path:a,started:1},{path:b,started:2}]}}});
 const app=ctx.app=await launchDesk({runtime});
 const page=await app.firstWindow();
 await page.waitForFunction(()=>document.querySelector('#messages')?.textContent.includes('Conversa A.'),undefined,{timeout:30000});
 await openSessionById(page,b);
 await page.waitForFunction(()=>document.querySelector('#messages')?.textContent.includes('Conversa B.'),undefined,{timeout:30000});
 const late={type:'shown',conversationId:a,card:{id:'card-44444444-4444-4444-8444-444444444444',kind:'quiz',createdAt:Date.now(),answered:false,correct:false,dismissed:false,sendState:'notSent',sendError:'',answer:{},draft:{},question:'Cartão da conversa antiga',details:'',note:'',multiSelect:false,options:[{label:'a'},{label:'b'}]}};
 const win=await pageWindow(app,page);
 await win.evaluate((bw,payload)=>bw.webContents.send('desk-card',payload),late);
 // espera fixa: o IPC do evento processa no próximo ciclo; 400 ms cobrem o quadro.
 await page.waitForTimeout(400);
 assert.equal(await page.locator('[data-tool="card-44444444-4444-4444-8444-444444444444"]').count(),0,'evento da conversa antiga fica fora da nova');
 assert.ok(!(await page.locator('#messages').textContent()).includes('Cartão da conversa antiga'));
});

/* A fila e o resultado do cartão não podem se perder: com o Pi ocupado, a
   mensagem digitada entra na fila; "Concluir" manda o resultado por fora. Os
   dois chegam ao motor (a ordem pode variar, o que não pode é sumir um). */
await withArtifacts('cartoes-fila',async ctx=>{
 const runtime=ctx.runtime=newRuntime('cartoes-fila');
 seedCourse(runtime,'Calculus I');
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'Calculus I',name:'Cálculo I',path:path.join(runtime,'learning','Courses','Calculus I')}]});
 const session=seedNativeSession(runtime,[{role:'assistant',content:[{type:'text',text:'Fila e cartão.'}]}],{courseId:'Calculus I'});
 writeDeskJson(runtime,{session,courseId:'Calculus I'});
 const card=cardStore.createCard(runtime,session,normalizeQuiz({question:'Quanto é 2+2?',options:[{label:'3'},{label:'4'}],correctAnswer:'4'}));
 cardStore.answerCard(runtime,session,card.id,{selected:[2]});
 const log=path.join(runtime,'fila.log');
 const app=ctx.app=await launchDesk({runtime,env:{FAKE_OPENCODE_QUEUE_LOG:log,FAKE_OPENCODE_QUEUE_HOLD_MS:'2500'}});
 const page=await app.firstWindow();
 await statusOnline(page);
 await page.waitForSelector('.quiz-card',{timeout:30000});
 await page.locator('#prompt').fill('primeira');
 await page.locator('#prompt').press('Enter');
 await page.waitForFunction(()=>document.querySelector('#send')?.disabled===true,undefined,{timeout:30000});
 await pollUntil(()=>fs.existsSync(log)?fs.readFileSync(log,'utf8'):'',value=>/primeira/.test(value),{timeout:30000,what:'o primeiro turno chegar ao motor'});
 await page.locator('#prompt').fill('segunda');
 await page.locator('#prompt').press('Enter');
 await page.waitForFunction(()=>document.querySelectorAll('.queue-item').length===1,undefined,{timeout:10000});
 await page.locator('.quiz-conclude').click();
 await pollUntil(
  ()=>fs.existsSync(log)?fs.readFileSync(log,'utf8').trim().split('\n').filter(Boolean).length:0,
  (count)=>count>=3,
  {timeout:30000,what:'os três prompts no log do fake'},
 );
 const prompts=fs.readFileSync(log,'utf8').trim().split('\n').map((line)=>JSON.parse(line).message);
 assert.ok(prompts.some((text)=>text.startsWith('primeira')),'a mensagem enviada não sumiu');
 assert.ok(prompts.some((text)=>text==='segunda'),'a mensagem da fila não sumiu');
 assert.ok(prompts.some((text)=>text.startsWith('[Resultado do cartão: ')),'o resultado do cartão não sumiu');
});
