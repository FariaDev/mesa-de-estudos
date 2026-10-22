/* Regressão da identidade sintética do Pi (achado B da revisão independente de
   2026-10-08): o Pi NÃO manda `message.id`; o host cria a identidade por
   sequência de `message_start` e o `message_end` reconcilia TODOS os blocos
   finais — sem perder/sobrescrever fala e sem deslocar a fala que nasceu
   depois de uma ferramenta já declarada. No fim, o vivo e o reload do
   histórico precisam ter a MESMA ordem de grupos e os MESMOS textos.

   Runtime sintético e fixture própria (`tests/timeline-pi.mjs`); Electron real,
   sem provedor. Uso: node tests/timeline-noid.mjs
   Evidência em tests/artifacts/ quando EVIDENCE=1 ou em falha. */
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import {withArtifacts,launchDesk,newRuntime,seedCourse,seedSession,writeDeskJson,writeConfigJson,statusOnline,sendEnabled,saveArtifacts,DESK} from './helpers.mjs';
import {pollUntil} from './waits.mjs';

const EVIDENCE=process.env.EVIDENCE==='1';
const PI_FIXTURE=path.join(DESK,'tests','timeline-pi.mjs');
function watch(page){
 const errors=[],consoleErrors=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
 return {errors,consoleErrors};
}
/* Agrupa os filhos diretos do #messages por turno (a partir de cada `user`) e
   captura os textos das falas e os slots — a comparação vivo × reload é sobre
   essa forma, não sobre detalhes de marcação. */
const SNAPSHOT=`(()=>{
 const groups=[];
 for(const el of document.querySelector('#messages').children){
  const cls=[...el.classList];
  const kind=cls.includes('activity-slot')?'activity-slot':cls.includes('work')?'work':cls.includes('message')?(cls.includes('user')?'user':'assistant'):'other';
  if(kind==='user')groups.push([]);
  if(groups.length)groups[groups.length-1].push(kind);
 }
 return {
  groups,
  texts:[...document.querySelectorAll('#messages .message.assistant .body')].map(el=>el.textContent.trim()),
  slots:[...document.querySelectorAll('.activity-slot')].map(el=>({call:el.dataset.activityCall,status:el.dataset.status})),
 };
})()`;
const snapshot=page=>page.evaluate(SNAPSHOT);
/* A linha do tempo parou de mudar: três leituras iguais em ~180 ms. */
async function settleSnapshot(page){
 let previous=null,equalReads=0;
 await pollUntil(async()=>{
  const now=JSON.stringify(await snapshot(page));
  equalReads=now===previous?equalReads+1:0;
  previous=now;
  return equalReads;
 },reads=>reads>=3,{interval:60,what:'a linha do tempo parar de mudar'});
}
const lastGroup=s=>s.groups.at(-1);
async function ask(page,text,{wait}={}){
 await sendEnabled(page,{timeout:20000});
 await page.locator('#prompt').fill(text);
 await page.locator('#send').click();
 if(wait)await page.waitForFunction(wait,undefined,{timeout:20000});
 await sendEnabled(page,{timeout:20000});
 await settleSnapshot(page);
}

await withArtifacts('timeline-noid',async ctx=>{
 const runtime=ctx.runtime=newRuntime('timeline-noid');
 const course=seedCourse(runtime,'Calc');
 const sessionFile=seedSession(runtime,[]);
 writeDeskJson(runtime,{session:sessionFile,courseId:'Calc'});
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'Calc',name:'Calc',path:course}]});
 fs.chmodSync(PI_FIXTURE,0o755);
 const app=ctx.app=await launchDesk({runtime,env:{LEARNING_DESK_PI:PI_FIXTURE}});
 const page=await app.firstWindow();const w=watch(page);
 await statusOnline(page);

 /* 1. texto-ferramenta-texto sem id, com deltas: cada fala na sua bolha. */
 await ask(page,'sem id com deltas',{wait:()=>document.querySelector('.activity-slot[data-activity-call="act-ns-1"]')?.dataset.status==='done'});
 let s=await snapshot(page);
 assert.deepEqual(lastGroup(s),['user','work','assistant','work','activity-slot','assistant'],'sem id: pensamento→fala→ferramenta/slot→fala');
 assert.deepEqual(s.texts.slice(-2),['Antes.','Depois noid.'],'sem id: as duas falas ficam separadas');

 /* 2. texto só no `message_end` com a ferramenta JÁ declarada: a fala de
    índice anterior nasce antes do passo (e do slot); a posterior vem depois.
    O slot é o MESMO nó da declaração e não se move. */
 await page.evaluate(()=>{
  window.__noid={count:0,slot:null,work:null};
  window.addEventListener('desk-activity-slot',e=>{
   if(e.detail.toolCallId!=='act-nf-1')return;
   window.__noid.count+=1;window.__noid.slot=e.detail.element;window.__noid.work=e.detail.element.previousElementSibling||null;
  });
 });
 await ask(page,'sem id só final',{wait:()=>document.querySelector('.activity-slot[data-activity-call="act-nf-1"]')?.dataset.status==='done'});
 s=await snapshot(page);
 assert.deepEqual(lastGroup(s),['user','assistant','work','activity-slot','assistant'],'sem id só final: fala→tool→fala (a primeira não pula para depois do slot)');
 assert.deepEqual(s.texts.slice(-2),['Antes sem stream.','Depois sem stream.'],'sem id só final: nenhuma fala perdida/sobrescrita');
 const declaredSlot=await page.evaluate(()=>{
  const el=window.__noid.slot;
  return {
   count:window.__noid.count,
   same:el===document.querySelector('.activity-slot[data-activity-call="act-nf-1"]'),
   connected:!!el?.isConnected,
   sameWork:window.__noid.work===el?.previousElementSibling,
   prev:el?.previousElementSibling?[...el.previousElementSibling.classList].join(' '):'',
   next:el?.nextElementSibling?[...el.nextElementSibling.classList].join(' '):'',
  };
 });
 assert.equal(declaredSlot.count,1,'o slot da fala final emite uma vez só');
 assert.equal(declaredSlot.same,true,'o slot é o mesmo nó depois da reconciliação');
 assert.equal(declaredSlot.connected,true,'o slot continua conectado');
 assert.equal(declaredSlot.sameWork,true,'o passo da ferramenta continua o mesmo nó');
 assert.match(declaredSlot.prev,/work/,'a fala anterior ficou ANTES do work (e do slot)');
 assert.match(declaredSlot.next,/message/,'a fala posterior ficou depois do slot');

 /* 3. `message_end` sem nenhum `message_start` (identidade criada na hora). */
 await ask(page,'sem id sem início',{wait:()=>document.querySelector('.activity-slot[data-activity-call="act-nn-1"]')?.dataset.status==='done'});
 s=await snapshot(page);
 assert.deepEqual(lastGroup(s),['user','assistant','work','activity-slot','assistant'],'sem id sem início: fala→tool→fala');
 assert.deepEqual(s.texts.slice(-2),['Antes sem início.','Depois sem início.'],'sem id sem início: nenhuma fala perdida/sobrescrita');

 /* 4. texto→pensamento→texto (deltas + final): cada bloco preservado e a
    sequência bate com a projeção do histórico (`texto, work, texto`). */
 await ask(page,'sem id pensamento',{wait:()=>[...document.querySelectorAll('#messages .message.assistant .body')].some(el=>el.textContent.includes('Segunda fala.'))});
 s=await snapshot(page);
 assert.deepEqual(lastGroup(s),['user','assistant','work','assistant'],'sem id pensamento: texto→work→texto');
 assert.deepEqual(s.texts.slice(-2),['Primeira fala.','Segunda fala.'],'sem id pensamento: cada fala preservada');

 /* 5. duas mensagens sem id na MESMA rodada: cada `message_start` abre a
    identidade seguinte; a segunda mensagem (índice 0 de novo) não sobrescreve
    a primeira. */
 await ask(page,'sem id duas mensagens',{wait:()=>document.querySelector('.activity-slot[data-activity-call="act-n2-1"]')?.dataset.status==='done'});
 s=await snapshot(page);
 assert.deepEqual(lastGroup(s),['user','assistant','work','activity-slot','assistant'],'sem id duas mensagens: fala→tool/slot→fala');
 assert.deepEqual(s.texts.slice(-2),['Primeira mensagem.','Segunda mensagem.'],'sem id duas mensagens: a segunda mensagem tem identidade própria');
 const live=s;

 /* Reload: o histórico projeta a MESMA sequência do vivo (o caminho que o
    achado B acusava de divergir). */
 await page.reload();
 await statusOnline(page);
 await page.waitForFunction(()=>[...document.querySelectorAll('#messages .message.assistant .body')].some(el=>el.textContent.includes('Segunda mensagem.')),undefined,{timeout:20000});
 await settleSnapshot(page);
 const reloaded=await snapshot(page);
 assert.deepEqual(reloaded.groups,live.groups,'reload: a ordem dos grupos coincide com o vivo');
 assert.deepEqual(reloaded.texts,live.texts,'reload: os textos coincidem com o vivo');
 assert.deepEqual(reloaded.slots,live.slots,'reload: os slots e os estados coincidem com o vivo');
 assert.deepEqual(w.errors,[]);
 assert.deepEqual(w.consoleErrors.filter(text=>!/Autofill|DevTools/.test(text)),[]);
 if(EVIDENCE)await saveArtifacts(ctx);
 console.log('timeline-noid: PASS — Pi sem message.id (deltas, só final, sem início, pensamento e duas mensagens) e reload coincidem; achado B coberto.');
});
