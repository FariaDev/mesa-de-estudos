/* Regressão dos achados N1/N2/N3 da revisão final independente de 2026-10-08:

   - N1: Parar a rodada 1 e enviar a rodada 2 com os eventos atrasados da 1
     (delta, `message_end` e `tool_execution_end` que citam a ferramenta
     aposentada) chegando no MEIO do stream da 2. O slot da 1 tem de continuar
     `stopped`, o `message_end` atrasado não pode sobrescrever/fechar a fala da
     2 e o resultado atrasado não pode montar artefato no slot antigo. A
     variação "com text_start" é o host documentado (o `text_start` reconcilia
     o bloco); a "sem início" repete a forma crua do probe original (end
     atrasado antes da fala); a "fala cedo" põe a fala da 2 antes do delta
     atrasado e mostra o limite honesto (o delta anônimo se anexa; o end
     aposentado NÃO apaga nada por texto).
   - N2: texto→ferramenta→texto SEM `contentIndex` (host legado) não pode
     duplicar a primeira fala nem fundir as duas; vivo × reload coincidem.
   - N3: dois `message_end` sem `message_start` não podem reusar a identidade
     encerrada (a primeira fala era sobrescrita).
   - R1/R3 residuais: texto novo igual/sufixo ao atraso sobrevive ao end
     aposentado, e troca real de conversa reusa ids nativos sem `stale`.

   Runtime sintético e fixture própria (`tests/timeline-pi.mjs`), Electron real,
   sem provedor. Uso: node tests/timeline-late.mjs
   Evidência em tests/artifacts/ quando EVIDENCE=1 ou em falha. */
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import {withArtifacts,launchDesk,newRuntime,seedCourse,seedSession,writeDeskJson,writeConfigJson,statusOnline,sendEnabled,saveArtifacts,DESK,newSession,currentSession} from './helpers.mjs';
import {pollUntil} from './waits.mjs';

const EVIDENCE=process.env.EVIDENCE==='1';
const PI_FIXTURE=path.join(DESK,'tests','timeline-pi.mjs');
const GAP=160;
/* Resposta do abort atrasada de propósito: o teste prova que o próximo envio
   sai com o abort ainda pendente (as linhas do RPC são concorrentes; o que
   segura o turno novo é o settle/`isStreaming` do Pi, não a resposta). */
const ABORT_DELAY=1500;

function watch(page){
 const errors=[],consoleErrors=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
 return {errors,consoleErrors};
}
/* Agrupa os filhos diretos do #messages por turno (a partir de cada `user`) e
   captura falas, slots e a identidade do artefato montado. */
const SNAPSHOT=`(()=>{
 const kindOf=el=>{
  const cls=[...el.classList];
  if(cls.includes('activity-slot'))return 'activity-slot';
  if(cls.includes('work'))return 'work';
  if(cls.includes('message'))return cls.includes('user')?'user':'assistant';
  return 'other';
 };
 const groups=[];
 for(const el of document.querySelector('#messages').children){
  const kind=kindOf(el);
  if(kind==='user')groups.push([]);
  if(groups.length)groups[groups.length-1].push(kind);
 }
 return {
  order:[...document.querySelector('#messages').children].map(kindOf),
  groups,
  texts:[...document.querySelectorAll('#messages .message.assistant .body')].map(el=>el.textContent.trim()),
  slots:[...document.querySelectorAll('.activity-slot')].map(el=>({call:el.dataset.activityCall,status:el.dataset.status,activityId:el.dataset.activityId||'',version:el.dataset.activityVersion||''})),
 };
})()`;
const snapshot=page=>page.evaluate(SNAPSHOT);

async function boot(ctx,tag){
 const runtime=ctx.runtime=newRuntime(tag);
 const course=seedCourse(runtime,'Calc');
 const sessionFile=seedSession(runtime,[]);
 writeDeskJson(runtime,{session:sessionFile,courseId:'Calc'});
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'Calc',name:'Calc',path:course}]});
 fs.chmodSync(PI_FIXTURE,0o755);
 const app=ctx.app=await launchDesk({runtime,env:{LEARNING_DESK_PI:PI_FIXTURE,HUNT_TIMELINE_GAP:String(GAP),HUNT_TIMELINE_ABORT_DELAY:String(ABORT_DELAY)}});
 const page=await app.firstWindow();
 const w=watch(page);
 await statusOnline(page);
 return {page,w,sessionFile};
}
/* Sincroniza em cima da emissão real dos atrasos: a fixture grava um arquivo
   marcador ao disparar o `tool_execution_end` atrasado (o JSONL não é poluído
   com um evento de protocolo inválido). */
async function waitLateMarker(file,{timeout=20000}={}){
 const marker=`${file}.late-marker`;
 await pollUntil(()=>fs.existsSync(marker),found=>found,{timeout,what:`o marcador do atraso da fixture (${marker})`});
}
/* A linha do tempo parou de mudar: três leituras iguais em ~180 ms, mais que o
   GAP da fixture, então nenhum evento atrasado fica para trás. */
async function settleSnapshot(page){
 let previous=null,equalReads=0;
 await pollUntil(async()=>{
  const now=JSON.stringify(await snapshot(page));
  equalReads=now===previous?equalReads+1:0;
  previous=now;
  return equalReads;
 },reads=>reads>=3,{interval:60,what:'a linha do tempo parar de mudar'});
}
async function ask(page,text,{wait}={}){
 await sendEnabled(page,{timeout:20000});
 await page.locator('#prompt').fill(text);
 await page.locator('#send').click();
 if(wait)await page.waitForFunction(wait,undefined,{timeout:20000});
 await sendEnabled(page,{timeout:30000});
 await settleSnapshot(page);
}

async function runN1(ctx,{comInicio,falaCedo=false}={}){
 const variacao=falaCedo?'fala cedo':(comInicio?'com text_start':'sem início');
 const {page,w,sessionFile}=await boot(ctx,comInicio?'timeline-late-contract':falaCedo?'timeline-late-cedo':'timeline-late-original');

 /* Rodada 1: mensagem ABERTA e `late-x1` declarada até o Parar. */
 await sendEnabled(page,{timeout:20000});
 await page.locator('#prompt').fill('atraso cruzando o turno');
 await page.locator('#send').click();
 await page.waitForSelector('.activity-slot[data-activity-call="late-x1"]',{state:'attached',timeout:20000});
 await page.evaluate(()=>{window.__late1=document.querySelector('.activity-slot[data-activity-call="late-x1"]');});
 await page.keyboard.press('Escape');
 await page.waitForFunction(()=>{const w=[...document.querySelectorAll('.work')].at(-1);return w&&w.dataset.live==='false';},undefined,{timeout:20000});
 await sendEnabled(page,{timeout:20000});
 /* Contrato do Pi: o settle fecha o turno antes da RESPOSTA do abort; o
    próximo envio não espera essa resposta. A prova é o marcador escrito pela
    fixture na resposta do abort (abaixo). */
 assert.equal(fs.existsSync(`${sessionFile}.abort-replied`),false,'o próximo envio sai com o abort ainda pendente (parada → settle → envio novo)');
 const stopped=await page.evaluate(()=>document.querySelector('.activity-slot[data-activity-call="late-x1"]')?.dataset.status);
 assert.equal(stopped,'stopped','o slot da rodada 1 fica stopped ao Parar');

 /* Rodada 2 longa: os atrasos da 1 chegam no meio do stream dela. */
 await page.locator('#prompt').fill(falaCedo?'rodada dois atrasada com fala cedo':(comInicio?'rodada dois atrasada':'rodada dois atrasada sem início'));
 await page.locator('#send').click();
 await page.waitForSelector('.activity-slot[data-activity-call="late-x2"]',{state:'attached',timeout:20000});
 await page.waitForFunction(()=>[...document.querySelectorAll('#messages .message.assistant .body')].some(el=>el.textContent.includes('Fala da rodada 2.')),undefined,{timeout:20000});
 await waitLateMarker(sessionFile);
 await page.waitForTimeout(GAP*2);// espera fixa: o atraso é do próprio tempo da fixture (GAP) — deixa o delta/message_end/tool_end atrasados chegarem
 const during=await snapshot(page);
 const late1During=during.slots.find(slot=>slot.call==='late-x1');
 assert.equal(late1During?.status,'stopped','o resultado atrasado NÃO muda o slot da rodada 1 para done');
 assert.equal(late1During?.activityId,'','o resultado atrasado NÃO monta artefato no slot antigo');
 const identity=await page.evaluate(()=>({
  same:window.__late1===document.querySelector('.activity-slot[data-activity-call="late-x1"]'),
  connected:!!window.__late1?.isConnected,
 }));
 assert.equal(identity.same,true,'o slot da rodada 1 é o MESMO nó (nada de recriar)');
 assert.equal(identity.connected,true,'o slot da rodada 1 continua conectado');
 const late1BeforeTurn2=await page.evaluate(()=>{
  const nodes=[...document.querySelector('#messages').children];
  const slot=nodes.findIndex(el=>el.classList?.contains('activity-slot')&&el.dataset.activityCall==='late-x1');
  const turn2=nodes.findIndex((el,index)=>index>slot&&el.classList?.contains('message')&&el.classList.contains('user'));
  return slot>=0&&turn2>slot;
 });
 assert.equal(late1BeforeTurn2,true,'o slot atrasado continua na rodada 1, antes do usuário da rodada 2');
 assert.equal(during.texts.filter(text=>text.includes('Fala da rodada 2.')).length,1,'a rodada 2 tem UMA fala própria');
 if(comInicio){
  assert.deepEqual(during.texts.filter(Boolean),['Fala da rodada 2.'],'text_start (contrato) zera o bloco anônimo atrasado: a rodada 2 fica limpa durante o stream');
 }else if(falaCedo){
  assert.deepEqual(during.texts.filter(Boolean),['Fala da rodada 2.Fala atrasada da rodada 1.'],`${variacao}: fora do contrato o delta anônimo se anexa ao bloco novo; o end aposentado NÃO apaga por texto e a fala da rodada 2 fica inteira`);
 }else{
  assert.deepEqual(during.texts.filter(Boolean),['Fala atrasada da rodada 1.Fala da rodada 2.'],`${variacao}: fora do contrato o delta anônimo precede a fala nova; o end aposentado é descartado por identidade`);
 }
 assert.equal(during.texts.includes('Fala atrasada da rodada 1.'),false,'o message_end atrasado NÃO fecha/sobrescreve a fala da rodada 2');
 const lastDuringKinds=during.groups.length?during.groups.at(-1):[];
 assert.deepEqual(lastDuringKinds,['user','work','activity-slot','assistant'],'durante o stream a rodada 2 é fala→trabalho/slot→fala');

 /* Fim do turno vivo. */
 await sendEnabled(page,{timeout:30000});
 await page.waitForTimeout(GAP*2);// espera fixa: o atraso é do próprio tempo da fixture (GAP)
 await pollUntil(()=>fs.existsSync(`${sessionFile}.abort-replied`),found=>found,{timeout:5000,what:'a resposta atrasada do abort',onTimeout:'return'});
 assert.equal(fs.existsSync(`${sessionFile}.abort-replied`),true,'o abort respondeu depois; o turno novo não esperou a resposta');
 const after=await snapshot(page);
 assert.deepEqual(after.groups.at(-1),['user','work','activity-slot','assistant'],'fim da rodada 2: fala→trabalho/slot→fala final');
 assert.deepEqual(after.texts.filter(text=>text.includes('Fala da rodada 2.')),['Fala da rodada 2.'],'o message_end autoritativo da rodada 2 vence');
 assert.equal(after.texts.includes('Fala atrasada da rodada 1.'),false,'a fala atrasada não vira bolha própria na rodada 2');
 assert.equal(after.texts.filter(Boolean).at(-1),'Fala da rodada 2.','a última fala é a da rodada 2');
 const late1After=after.slots.find(slot=>slot.call==='late-x1');
 assert.equal(late1After?.status,'stopped','no fim, o slot da rodada 1 segue stopped');
 assert.equal(late1After?.activityId,'','no fim, o slot da rodada 1 segue sem artefato');
 const late2After=after.slots.find(slot=>slot.call==='late-x2');
 assert.deepEqual([late2After?.status,late2After?.activityId,late2After?.version],['done','art-late-2','9'],'o resultado da rodada 2 preenche o próprio slot com a identidade do artefato');
 const users=[];
 after.order.forEach((kind,index)=>{if(kind==='user')users.push(index);});
 assert.equal(users.length,2,'a rodada 1 continua uma rodada própria antes da 2');
 assert.equal(after.order.filter(kind=>kind==='activity-slot').length,2,'nenhum slot novo foi montado pelo atraso');

 /* Reload: a rodada 2 reabre com a mesma forma do vivo. */
 await page.reload();
 await statusOnline(page);
 await page.waitForFunction(()=>[...document.querySelectorAll('#messages .message.assistant .body')].some(el=>el.textContent.includes('Fala da rodada 2.')),undefined,{timeout:20000});
 await settleSnapshot(page);
 const reloaded=await snapshot(page);
 assert.deepEqual(reloaded.groups.at(-1),after.groups.at(-1),'reload: a ordem da última rodada coincide com o vivo');
 assert.deepEqual(reloaded.texts.filter(text=>text.includes('Fala da rodada 2.')),['Fala da rodada 2.'],'reload: a fala da rodada 2 coincide');
 const late2Reload=reloaded.slots.find(slot=>slot.call==='late-x2');
 assert.equal(late2Reload?.status,'done','reload: slot da rodada 2 no ponto (status do passo pareado)');
 assert.equal(reloaded.slots.filter(slot=>slot.call==='late-x2').length,1,'reload: um slot por chamada');
 assert.deepEqual(w.errors,[]);
 assert.deepEqual(w.consoleErrors.filter(text=>!/Autofill|DevTools/.test(text)),[]);
 if(EVIDENCE)await saveArtifacts(ctx);
 console.log(`timeline-late N1 (${variacao}): PASS — slot da 1 stopped, message_end atrasado não fecha/sobrescreve a rodada 2 e nenhum artefato atrasado é montado.`);
}

if(!process.env.HUNT||process.env.HUNT==='late-contract'){
 await withArtifacts('timeline-late-contract',ctx=>runN1(ctx,{comInicio:true}));
}
if(!process.env.HUNT||process.env.HUNT==='late-original'){
 await withArtifacts('timeline-late-original',ctx=>runN1(ctx,{comInicio:false}));
}
if(!process.env.HUNT||process.env.HUNT==='late-cedo'){
 await withArtifacts('timeline-late-cedo',ctx=>runN1(ctx,{comInicio:false,falaCedo:true}));
}

/* R1 residual (revisão residual): igualdade/sufixo de texto NUNCA prova posse.
   A rodada 1 é parada com `late-x1` aberta; a rodada 2 produz fala legítima
   IGUAL (igual) ou SUFIXO (sufixo) ao atraso e recebe o `message_end` atrasado
   da rodada 1 DEPOIS do fim próprio — o end aposentado tem de ser descartado
   por IDENTIDADE, sem apagar nem truncar a fala nova. O `cont` põe o end
   atrasado no MEIO do stream (entre os dois deltas), caso em que o bloco era
   zerado pelo heurístico. */
for(const kind of ['igual','sufixo','cont']){
 if(process.env.HUNT&&process.env.HUNT!==`residual-${kind}`)continue;
 await withArtifacts(`timeline-residual-${kind}`,async ctx=>{
  const {page,w}=await boot(ctx,`timeline-residual-${kind}`);
  /* Rodada 1 aberta + Parar (mesmo fluxo do N1). */
  await sendEnabled(page,{timeout:20000});
  await page.locator('#prompt').fill('atraso cruzando o turno');
  await page.locator('#send').click();
  await page.waitForSelector('.activity-slot[data-activity-call="late-x1"]',{state:'attached',timeout:20000});
  await page.keyboard.press('Escape');
  await page.waitForFunction(()=>{const work=[...document.querySelectorAll('.work')].at(-1);return work&&work.dataset.live==='false';},undefined,{timeout:20000});
  await sendEnabled(page,{timeout:20000});
  /* Rodada 2 com texto novo igual/sufixo (ou cont). */
  const own=kind==='igual'?'Fala atrasada da rodada 1.':`Introdução nova. Fala atrasada da rodada 1.`;
  const expected=kind==='cont'?`${own} Mais texto.`:own;
  await page.locator('#prompt').fill(`atraso residual ${kind}`);
  await page.locator('#send').click();
  await page.waitForFunction(({expected})=>[...document.querySelectorAll('#messages .message.assistant .body')].map(el=>el.textContent.trim()).includes(expected),{expected},{timeout:20000});
  await sendEnabled(page,{timeout:30000});
  await page.waitForTimeout(GAP*2);// espera fixa: o atraso é do próprio tempo da fixture (GAP)
  const live=await snapshot(page);
  assert.equal(live.texts.filter(Boolean).at(-1),expected,`R1 ${kind}: o end atrasado (com id aposentado) NÃO apaga/trunca a fala nova`);
  assert.equal(live.texts.filter(text=>text===expected).length,1,`R1 ${kind}: a fala nova fica UMA vez no DOM`);
  assert.equal(live.texts.filter(text=>text.includes('Fala atrasada da rodada 1.')&&text!==expected).length,0,`R1 ${kind}: o end atrasado não vira bolha própria`);
  if(kind==='sufixo')assert.equal(live.texts.includes('Introdução nova.'),false,`R1 ${kind}: nada de truncar o sufixo legítimo`);
  await page.reload();
  await statusOnline(page);
  await page.waitForFunction(text=>[...document.querySelectorAll('#messages .message.assistant .body')].some(el=>el.textContent.trim()===text),expected,{timeout:20000});
  await settleSnapshot(page);
  const reloaded=await snapshot(page);
  assert.equal(reloaded.texts.filter(Boolean).at(-1),expected,`R1 ${kind}: vivo × reload coincidem (nada apagado no vivo)`);
  assert.deepEqual(w.errors,[]);
  assert.deepEqual(w.consoleErrors.filter(text=>!/Autofill|DevTools/.test(text)),[]);
  if(EVIDENCE)await saveArtifacts(ctx);
  console.log(`timeline-residual R1 (${kind}): PASS — identidade do end aposentado descarta; texto legítimo igual/sufixo preservado (vivo × reload).`);
 });
}

/* N2/N3 no mesmo app: nenhum dos dois depende dos atrasos do N1. */
if(!process.env.HUNT||process.env.HUNT==='noid-variants')await withArtifacts('timeline-late-noid-variants',async ctx=>{
 const {page,w}=await boot(ctx,'timeline-late-noid-variants');

 /* N2: texto→ferramenta→texto sem contentIndex (host legado). */
 await ask(page,'sem índice aqui',{wait:()=>document.querySelector('.activity-slot[data-activity-call="si-1"]')?.dataset.status==='done'});
 const n2Live=await snapshot(page);
 assert.deepEqual(n2Live.groups.at(-1),['user','assistant','work','activity-slot','assistant'],'N2 vivo: fala→tool/slot→fala (sem fundir texto→ferramenta→texto)');
 assert.deepEqual(n2Live.texts.filter(Boolean).slice(-2),['Antes sem índice.','Depois sem índice.'],'N2 vivo: cada fala preservada, sem duplicar a primeira');
 await page.reload();
 await statusOnline(page);
 await page.waitForSelector('.activity-slot[data-activity-call="si-1"]',{state:'attached',timeout:20000});
 await settleSnapshot(page);
 const n2Reload=await snapshot(page);
 assert.deepEqual(n2Reload.groups.at(-1),n2Live.groups.at(-1),'N2 reload: a ordem coincide com o vivo');
 assert.deepEqual(n2Reload.texts.filter(Boolean).slice(-2),['Antes sem índice.','Depois sem índice.'],'N2 reload: as falas coincidem com o vivo');

 /* N3: dois message_end sem message_start. */
 await ask(page,'dois finais isolados',{wait:()=>[...document.querySelectorAll('#messages .message.assistant .body')].some(el=>el.textContent.includes('Final isolado dois.'))});
 const n3Live=await snapshot(page);
 assert.deepEqual(n3Live.groups.at(-1),['user','assistant','assistant'],'N3 vivo: as duas mensagens têm bolhas próprias');
 assert.deepEqual(n3Live.texts.filter(Boolean).slice(-2),['Final isolado um.','Final isolado dois.'],'N3 vivo: a segunda identidade não sobrescreve a primeira');
 await page.reload();
 await statusOnline(page);
 await page.waitForFunction(()=>[...document.querySelectorAll('#messages .message.assistant .body')].some(el=>el.textContent.includes('Final isolado dois.')),undefined,{timeout:20000});
 await settleSnapshot(page);
 const n3Reload=await snapshot(page);
 assert.deepEqual(n3Reload.groups.at(-1),n3Live.groups.at(-1),'N3 reload: a ordem coincide com o vivo');
 assert.deepEqual(n3Reload.texts.filter(Boolean).slice(-2),['Final isolado um.','Final isolado dois.'],'N3 reload: as falas coincidem com o vivo');
 assert.deepEqual(w.errors,[]);
 assert.deepEqual(w.consoleErrors.filter(text=>!/Autofill|DevTools/.test(text)),[]);
 if(EVIDENCE)await saveArtifacts(ctx);
 console.log('timeline-late N2/N3: PASS — sem contentIndex reconcilia sem duplicar e dois message_end sem início têm identidades próprias.');
});

/* R3 residual: troca REAL de conversa zera o ledger local (ferramentas
   recolhidas). A conversa B reusa os MESMOS ids nativos da conversa A
   (`duo-a`/`duo-b`): os passos/slots têm de nascer de novo. Sem o reset, o
   `retiredTurnTools` do renderer descarta as declarações por identidade
   antiga. */
if(!process.env.HUNT||process.env.HUNT==='switch-reuse')await withArtifacts('timeline-residual-switch-reuse',async ctx=>{
 const {page,w}=await boot(ctx,'timeline-residual-switch-reuse');
 await ask(page,'duas atividades',{wait:()=>document.querySelector('.activity-slot[data-activity-call="duo-a"]')?.dataset.status==='error'});
 const first=await snapshot(page);
 assert.deepEqual(first.slots.filter(slot=>slot.call.startsWith('duo-')).map(slot=>[slot.call,slot.status]),[['duo-a','error'],['duo-b','done']],'A: as duas chamadas do par de ids pintam na primeira conversa');
 await sendEnabled(page,{timeout:30000});
 const sessionA=await currentSession(page);
 await newSession(page);
 await page.waitForFunction(old=>{const sel=document.querySelector('#session-title');return sel&&sel.dataset.session&&sel.dataset.session!==old&&!sel.disabled;},sessionA,{timeout:30000});
 await statusOnline(page);
 assert.equal(await page.locator('#messages .message').count(),0,'B nasce vazia (sem o histórico da conversa A)');
 await ask(page,'duas atividades',{wait:()=>document.querySelector('.activity-slot[data-activity-call="duo-a"]')?.dataset.status==='error'});
 const second=await snapshot(page);
 assert.deepEqual(second.slots.filter(slot=>slot.call.startsWith('duo-')).map(slot=>[slot.call,slot.status]),[['duo-a','error'],['duo-b','done']],'B: os ids nativos reusados pintam normalmente (ledger local zerado na troca)');
 assert.ok(second.texts.some(text=>text.includes('Prontas.')),'B: a fala final da rodada nova pinta');
 assert.equal(second.texts.includes('Fala atrasada da rodada 1.'),false,'B não herda nada da conversa A');
 assert.deepEqual(w.errors,[]);
 assert.deepEqual(w.consoleErrors.filter(text=>!/Autofill|DevTools/.test(text)),[]);
 if(EVIDENCE)await saveArtifacts(ctx);
 console.log('timeline-residual R3: PASS — troca real de conversa zera o ledger local; ids nativos reusados pintam na conversa nova.');
});
