/* Caça à linha do tempo do turno (Mesa de Estudos): ordem ao vivo e ao
   reabrir, slots de atividade estáveis no ponto da chamada, ferramentas
   concorrentes, retry, Parar/troca e o quiz sem regressão.

   Runtime sintético e fixture própria (`tests/timeline-pi.mjs`); não altera
   `fake-pi.mjs`, `hunt-pi.mjs` nem os helpers compartilhados. Uso:
     node tests/hunt-timeline.mjs                # todos os blocos
     HUNT=order node tests/hunt-timeline.mjs
   Evidências em tests/artifacts/ quando EVIDENCE=1 ou em falha. Nunca toca em
   .runtime/ nem em dado pessoal. */
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import {withArtifacts,launchDesk,newRuntime,seedCourse,seedSession,writeDeskJson,writeConfigJson,statusOnline,sendEnabled,saveArtifacts,DESK} from './helpers.mjs';

const WANT=(process.env.HUNT||process.argv.slice(2).join(',')||'').split(',').map(s=>s.trim()).filter(Boolean);
const EVIDENCE=process.env.EVIDENCE==='1';
const want=name=>!WANT.length||WANT.includes(name);
const log=(...a)=>console.log(...a);
const PI_FIXTURE=path.join(DESK,'tests','timeline-pi.mjs');
function watch(page){
 const errors=[],consoleErrors=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
 return {errors,consoleErrors};
}
function launch(runtime,gap){
 fs.chmodSync(PI_FIXTURE,0o755);
 return launchDesk({runtime,env:{LEARNING_DESK_PI:PI_FIXTURE,...(gap?{HUNT_TIMELINE_GAP:String(gap)}:{})}});
}

/* ------------------------------------------------------------------ */
/* 1. Ordem ao vivo + slot estável + reload pela sessão sintética       */
/* ------------------------------------------------------------------ */
if(want('order'))await withArtifacts('hunt-timeline-order',async ctx=>{
 const runtime=ctx.runtime=newRuntime('hunt-timeline');
 const course=seedCourse(runtime,'Calc');
 const sessionFile=seedSession(runtime,[]);
 writeDeskJson(runtime,{session:sessionFile,courseId:'Calc'});
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'Calc',name:'Calc',path:course}]});
 const app=ctx.app=await launch(runtime,600);
 const page=await app.firstWindow();const w=watch(page);
 await statusOnline(page);
 await page.evaluate(()=>{
  window.__slots=[];window.__slotEl=null;
  window.addEventListener('desk-activity-slot',e=>{
   window.__slots.push({toolCallId:e.detail.toolCallId,connected:e.detail.element.isConnected,status:e.detail.element.dataset.status});
   window.__slotEl=e.detail.element;
  });
 });
 await page.locator('#prompt').fill('monte uma atividade sobre MRUV');
 await page.locator('#send').click();

 /* Declaração: o slot nasce pendente, ancorado no ponto da chamada e ANTES da
    próxima fala. */
 await page.waitForSelector('.activity-slot[data-activity-call="act-1"]',{state:'attached',timeout:20000});
 const declared=await page.evaluate(()=>({
  order:[...document.querySelector('#messages').children].map(el=>{
   const cls=[...el.classList];
   if(cls.includes('activity-slot'))return 'activity-slot';
   if(cls.includes('work'))return 'work';
   if(cls.includes('message'))return cls.includes('user')?'user':'assistant';
   return el.tagName.toLowerCase();
  }),
  status:document.querySelector('.activity-slot[data-activity-call="act-1"]').dataset.status,
  connected:document.querySelector('.activity-slot[data-activity-call="act-1"]').isConnected,
  steps:[...document.querySelectorAll('.work-step')].map(s=>s.dataset.key),
 }));
 log('[order] declaração:',JSON.stringify(declared));
 assert.equal(declared.status,'pending');
 assert.equal(declared.connected,true);
 assert.ok(declared.order.indexOf('activity-slot')>=0);
 assert.deepEqual(declared.order.slice(-1),['activity-slot'],'o slot é o último nó na declaração, antes da fala seguinte');
 assert.deepEqual(declared.steps.filter(id=>id==='act-1').length,1,'a declaração cria UM passo de ferramenta');
 assert.ok(declared.steps.includes('act-1'));

 await sendEnabled(page,{timeout:20000});
 const final=await page.evaluate(()=>{
  const slot=document.querySelector('.activity-slot[data-activity-call="act-1"]');
  return {
   order:[...document.querySelector('#messages').children].map(el=>{
    const cls=[...el.classList];
    if(cls.includes('activity-slot'))return 'activity-slot';
    if(cls.includes('work'))return 'work';
    if(cls.includes('message'))return cls.includes('user')?'user':'assistant';
    return el.tagName.toLowerCase();
   }),
   slotStatus:slot?.dataset.status,
   slotConnected:!!slot?.isConnected,
   sameNode:slot===window.__slotEl,
   slotNext:slot?.nextElementSibling?[...slot.nextElementSibling.classList].join(' '):'',
   slotCount:document.querySelectorAll('.activity-slot[data-activity-call="act-1"]').length,
   stepCount:document.querySelectorAll('.work-step[data-key="act-1"]').length,
   texts:[...document.querySelectorAll('.message.assistant .body')].map(el=>el.textContent.trim()),
   events:window.__slots,
  };
 });
 log('[order] final:',JSON.stringify(final));
 assert.deepEqual(final.order,['user','work','assistant','work','activity-slot','assistant'],'pensamento → fala → ferramenta/slot → fala');
 assert.equal(final.slotConnected,true);
 assert.equal(final.sameNode,true,'o slot é o MESMO nó da declaração (nada de recriar no repaint)');
 assert.equal(final.slotCount,1,'um slot por chamada');
 assert.equal(final.stepCount,1,'declaração e execução no mesmo passo');
 assert.equal(final.slotStatus,'done','o fim da ferramenta preenche o lugar original');
 assert.match(final.slotNext,/message/,'a fala final fica depois do slot, que não se move');
 assert.deepEqual(final.texts,['Antes.','Depois.'],'as duas falas ficam separadas pelo trabalho');
 assert.ok(final.events.some(e=>e.toolCallId==='act-1'&&e.connected),'evento desk-activity-slot emitido com o nó conectado');
 assert.equal(final.events.filter(e=>e.toolCallId==='act-1').length,1,'evento de criação uma vez só');
 assert.deepEqual(w.errors,[]);

 /* Reload: a sessão sintética reabre na MESMA sequência, com o slot no ponto. */
 await page.addInitScript(()=>{
  window.__history=[];window.__slotEvents=[];
  window.addEventListener('desk-history-rendered',e=>window.__history.push((e.detail&&e.detail.slots)||[]));
  window.addEventListener('desk-activity-slot',e=>window.__slotEvents.push(e.detail.toolCallId));
 });
 await page.reload();
 await statusOnline(page);
 await page.waitForSelector('.activity-slot[data-activity-call="act-1"]',{state:'attached',timeout:20000});
 const reloaded=await page.evaluate(()=>({
  order:[...document.querySelector('#messages').children].map(el=>{
   const cls=[...el.classList];
   if(cls.includes('activity-slot'))return 'activity-slot';
   if(cls.includes('work'))return 'work';
   if(cls.includes('message'))return cls.includes('user')?'user':'assistant';
   return el.tagName.toLowerCase();
  }),
  status:document.querySelector('.activity-slot[data-activity-call="act-1"]').dataset.status,
  slotNext:document.querySelector('.activity-slot[data-activity-call="act-1"]')?.nextElementSibling?[...document.querySelector('.activity-slot[data-activity-call="act-1"]').nextElementSibling.classList].join(' '):'',
  texts:[...document.querySelectorAll('.message.assistant .body')].map(el=>el.textContent.trim()),
  history:window.__history,
  slotEvents:window.__slotEvents,
 }));
 log('[order] reload:',JSON.stringify(reloaded));
 assert.deepEqual(reloaded.order,['user','work','assistant','work','activity-slot','assistant'],'o histórico reabre na ordem do turno');
 assert.equal(reloaded.status,'done');
 assert.match(reloaded.slotNext,/message/);
 assert.deepEqual(reloaded.texts,['Antes.','Depois.']);
 assert.ok(reloaded.history.length>=1,'desk-history-rendered emitido depois da carga');
 assert.ok(reloaded.history.at(-1).includes('act-1'),'a carga anuncia o slot para o renderer hidratar');
 assert.ok(reloaded.slotEvents.includes('act-1'),'o slot do histórico também emite desk-activity-slot');
 assert.deepEqual(w.errors,[]);
 if(EVIDENCE)await saveArtifacts(ctx);
 log('HUNT timeline order PASSED');
});

/* ------------------------------------------------------------------ */
/* 2. Interações: ferramentas concorrentes, retry, quiz, Parar e troca  */
/* ------------------------------------------------------------------ */
if(want('mixed'))await withArtifacts('hunt-timeline-mixed',async ctx=>{
 const runtime=ctx.runtime=newRuntime('hunt-timeline-mixed');
 const course=seedCourse(runtime,'Calc');
 const sessionFile=seedSession(runtime,[]);
 writeDeskJson(runtime,{session:sessionFile,courseId:'Calc'});
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'Calc',name:'Calc',path:course}]});
 const app=ctx.app=await launch(runtime);
 const page=await app.firstWindow();const w=watch(page);
 await statusOnline(page);

 /* 2a. Duas atividades na mesma rodada, resultados fora de ordem. */
 await sendEnabled(page);
 await page.locator('#prompt').fill('duas atividades');
 await page.locator('#send').click();
 await page.waitForFunction(()=>document.querySelectorAll('.activity-slot').length===2,undefined,{timeout:20000});
 const duoDeclared=await page.evaluate(()=>({
  slots:[...document.querySelectorAll('.activity-slot')].map(el=>el.dataset.activityCall),
  steps:[...document.querySelectorAll('.work-step')].map(s=>s.dataset.key),
  order:[...document.querySelector('#messages').children].map(el=>{
   const cls=[...el.classList];
   if(cls.includes('activity-slot'))return 'activity-slot';
   if(cls.includes('work'))return 'work';
   if(cls.includes('message'))return cls.includes('user')?'user':'assistant';
   return el.tagName.toLowerCase();
  }),
 }));
 log('[mixed] duo declaração:',JSON.stringify(duoDeclared));
 assert.deepEqual(duoDeclared.slots,['duo-a','duo-b'],'slots na ordem de declaração');
 assert.deepEqual(duoDeclared.steps.filter(id=>id==='duo-a'||id==='duo-b'),['duo-a','duo-b'],'passos na ordem de declaração');
 await sendEnabled(page,{timeout:20000});
 const duoFinal=await page.evaluate(()=>({
  slots:[...document.querySelectorAll('.activity-slot')].map(el=>({id:el.dataset.activityCall,status:el.dataset.status})),
  order:[...document.querySelector('#messages').children].map(el=>{
   const cls=[...el.classList];
   if(cls.includes('activity-slot'))return 'activity-slot';
   if(cls.includes('work'))return 'work';
   if(cls.includes('message'))return cls.includes('user')?'user':'assistant';
   return el.tagName.toLowerCase();
  }),
  lastText:(document.querySelector('#messages').lastElementChild?.textContent||'').trim(),
 }));
 log('[mixed] duo final:',JSON.stringify(duoFinal));
 assert.deepEqual(duoFinal.slots,[{id:'duo-a',status:'error'},{id:'duo-b',status:'done'}],'resultado fora de ordem cai no slot do próprio id');
 assert.deepEqual(duoFinal.order,['user','work','activity-slot','activity-slot','assistant'],'os dois slots ficam depois do trabalho e antes da fala');
 assert.match(duoFinal.lastText,/Prontas\./);

 /* 2b. Retry: o mesmo bloco re-streamado não duplica pensamento nem fala. */
 await sendEnabled(page);
 await page.locator('#prompt').fill('tente com retry');
 await page.locator('#send').click();
 await page.waitForFunction(()=>[...document.querySelectorAll('.message.assistant .body')].some(el=>el.textContent.includes('Resposta final.')),undefined,{timeout:20000});
 await sendEnabled(page,{timeout:20000});
 const retry=await page.evaluate(()=>{
  const works=[...document.querySelectorAll('.work')];
  const last=works.at(-1);
  const steps=[...last.querySelectorAll('.work-step')];
  const thinking=steps.find(s=>s.dataset.kind==='thinking');
  return {
   stepCount:steps.length,
   thinkingCount:steps.filter(s=>s.dataset.kind==='thinking').length,
   thinkingText:thinking?.querySelector('.step-text')?.textContent||'',
   speech:[...document.querySelectorAll('.message.assistant .body')].map(el=>el.textContent.trim()),
  };
 });
 log('[mixed] retry:',JSON.stringify(retry));
 assert.equal(retry.thinkingCount,1,'um passo de pensamento depois do retry');
 assert.equal(retry.stepCount,1,'a ferramenta não entrou nesse turno');
 assert.equal(retry.thinkingText.trim(),'Pensando muito.','thinking_end autoritativo substitui os deltas');
 assert.deepEqual(retry.speech.slice(-1),['Resposta final.'],'a bolha final não duplica');

 /* 2c. Quiz continua fora do diário e no chat, com veredito. */
 await sendEnabled(page);
 await page.locator('#prompt').fill('quiz de teste');
 await page.locator('#send').click();
 await page.waitForSelector('.message.quiz .quiz-option',{timeout:20000});
 const quizBefore=await page.evaluate(()=>({
  workSteps:[...document.querySelectorAll('.work-step')].map(s=>s.dataset.key),
  quizAfterWork:(()=>{
   const children=[...document.querySelector('#messages').children];
   const quizAt=children.findIndex(el=>el.classList.contains('quiz'));
   const workAt=children.findIndex(el=>el.classList.contains('work'));
   return workAt>=0&&quizAt>workAt;
  })(),
 }));
 assert.equal(quizBefore.workSteps.some(id=>id==='quiz-1'),false,'quiz não vira passo do diário');
 assert.equal(quizBefore.quizAfterWork,true,'o cartão aparece depois do trabalho');
 await page.locator('.message.quiz .quiz-option').nth(1).click();
 await page.waitForFunction(()=>[...document.querySelectorAll('.quiz-verdict')].some(el=>el.textContent.includes('Correta')),undefined,{timeout:20000});
 await sendEnabled(page,{timeout:20000});
 assert.equal(await page.locator('.message.quiz .quiz-verdict').first().textContent(),'✓ Correta.');

 /* 2d. Parar: o turno recolhe na hora e o evento atrasado não pinta. */
 await sendEnabled(page);
 const beforeStop=await page.locator('.message.assistant .body').count();
 await page.locator('#prompt').fill('devagar agora');
 await page.locator('#send').click();
 await page.waitForSelector('.activity-slot[data-activity-call="slow-1"]',{state:'attached',timeout:20000});
 await page.keyboard.press('Escape');
 await page.waitForFunction(()=>{
  const works=[...document.querySelectorAll('.work')];
  const el=works.at(-1);
  return el&&el.dataset.live==='false';
 },undefined,{timeout:20000});
 await page.waitForTimeout(2600); /* deixa o texto atrasado chegar e ser descartado */ // espera fixa: "nada acontece em 2,6 s" — o texto atrasado chega e é descartado
 const stopped=await page.evaluate(()=>({
  slotStatus:document.querySelector('.activity-slot[data-activity-call="slow-1"]')?.dataset.status,
  speeches:[...document.querySelectorAll('.message.assistant .body')].map(el=>el.textContent.trim()),
 }));
 log('[mixed] stop:',JSON.stringify(stopped));
 assert.equal(stopped.slotStatus,'stopped','o slot do turno parado fica stopped');
 assert.equal(stopped.speeches.length,beforeStop,'evento atrasado depois de Parar não cria fala');
 assert.equal(stopped.speeches.some(t=>t.includes('Depois do intervalo')),false);

 /* 2e. Evento de conversa DURANTE o turno (a adoção do caminho de sessão no
    primeiro envio): NÃO pode matar o turno vivo — o Parar seguinte é quem
    descarta o atraso. Troca real de conversa é recusada com o turno aberto e
    recarrega via `showHistory`, que recolhe antes. */
 await sendEnabled(page,{timeout:20000});
 const beforeAdoption=await page.locator('.message.assistant .body').count();
 await page.locator('#prompt').fill('devagar de novo');
 await page.locator('#send').click();
 await page.waitForSelector('.activity-slot[data-activity-call="slow-2"]',{state:'attached',timeout:20000});
 await page.evaluate(()=>window.dispatchEvent(new Event('desk-conversation-changed')));
 const survived=await page.evaluate(()=>({
  live:!!document.querySelector('.work[data-live="true"]'),
  slot:!!document.querySelector('.activity-slot[data-activity-call="slow-2"]'),
 }));
 log('[mixed] adoption:',JSON.stringify(survived));
 assert.equal(survived.live,true,'evento de conversa durante o turno não recolhe o diário vivo');
 assert.equal(survived.slot,true,'o slot do turno continua no lugar');
 await page.keyboard.press('Escape');
 await page.waitForTimeout(2600); // espera fixa: "nada acontece em 2,6 s" — o atraso não vira fala depois do Parar
 const adoption=await page.evaluate(()=>({
  speeches:[...document.querySelectorAll('.message.assistant .body')].map(el=>el.textContent.trim()),
  turnLive:!!document.querySelector('.work[data-live="true"]'),
  lastSlotStatus:document.querySelector('.activity-slot[data-activity-call="slow-2"]')?.dataset.status,
 }));
 log('[mixed] adoption done:',JSON.stringify(adoption));
 assert.equal(adoption.speeches.length,beforeAdoption,'o atraso não vira fala');
 assert.equal(adoption.turnLive,false,'o Parar recolhe o diário');
 assert.equal(adoption.lastSlotStatus,'stopped');
 assert.deepEqual(w.errors,[]);
 if(EVIDENCE)await saveArtifacts(ctx);
 log('HUNT timeline mixed PASSED');
});
