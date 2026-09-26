/* Caça a bugs da fila/steer da Mesa (mesma feature da Conversa, sobre o núcleo
   `core/composerview.bend`). Roda com o harness do ui-smoke:
     node tests/hunt-queue.mjs
   Evidências ficam em tests/artifacts/<stamp>-<bloco> quando EVIDENCE=1 ou o
   bloco falha. Usa o fake Pi padrão no modo `FAKE_PI_QUEUE_LOG`: cada prompt é
   registrado com o `streamingBehavior` recebido e a contagem de anexos (é o que
   prova followUp × steer e que o anexo guardado chegou ao Pi).
   Cobre: enfileirar com o Pi ocupado (⏎), editar (⏎ salva / Esc cancela),
   remover (×), a ordem e o `streamingBehavior` do flush, o rascunho digitado
   durante o envio, o steer (⌘/Ctrl+⏎), **Parar segurado** ("Enviar agora"),
   **Limpar** (com confirmação), **fechar com a fila e reabrir** (faixa
   "Recuperadas", anexo do item preservado, nada saindo sozinho), a **troca de
   conversa** (a fila da outra conversa fica no disco e volta com ela) e o
   **envio aceito com a leitura do estado falhando** (aviso na tela, item não
   volta para a fila — nada de mensagem repetida). */
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import {withArtifacts,launchDesk,newRuntime,seedCourse,seedPlot,seedSession,writeDeskJson,writeConfigJson,toastWait,sendEnabled,statusOnline,saveArtifacts} from './helpers.mjs';

const EVIDENCE=process.env.EVIDENCE==='1';
const log=(...a)=>console.log(...a);
function watch(page){
 const errors=[],consoleErrors=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
 return {errors,consoleErrors};
}

await withArtifacts('hunt-queue',async ctx=>{
 const runtime=ctx.runtime=newRuntime('hunt-queue');
 const course=seedCourse(runtime,'Calc');
 const logFile=path.join(runtime,'queue.log');
 const current=seedSession(runtime,[{type:'message',message:{role:'user',content:[{type:'text',text:'corrente'}],timestamp:1700000002000}}]);
 /* A segunda conversa da matéria (a fila é por conversa: trocar não mistura). */
 const other=path.join(runtime,'pi-1700000001000.jsonl');
 fs.writeFileSync(other,JSON.stringify({type:'message',message:{role:'user',content:[{type:'text',text:'outra conversa'}],timestamp:1700000001000}})+'\n');
 /* Matéria explícita: sem config o app cairia no curso de exemplo (e na pasta
    real do autor). */
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'Calc',name:'Cálculo I',path:course}]});
 writeDeskJson(runtime,{session:current,courseId:'Calc',courseStates:{Calc:{session:current,sessions:[{path:other,started:1700000001000,preview:'outra conversa'}]}}});
 const env={FAKE_PI_QUEUE_LOG:logFile,FAKE_PI_QUEUE_HOLD_MS:'4000'};
 let app=ctx.app=await launchDesk({runtime,env});
 let page=await app.firstWindow();
 const windows=[watch(page)];

 const entries=()=>{
  try{return fs.readFileSync(logFile,'utf8').trim().split('\n').filter(Boolean).map(line=>JSON.parse(line));}
  catch{return [];}
 };
 const firstLines=()=>entries().map(entry=>String(entry.message||'').split('\n')[0]);
 /* O log é escrito pelo fake antes de responder: esperar por ele (e não só pela
    bolha, que nasce antes do round-trip) tira a corrida do teste. */
 const waitLog=async(text,timeout=20000)=>{
  const until=Date.now()+timeout;
  while(Date.now()<until){
   if(firstLines().includes(text))return;
   await new Promise(resolve=>setTimeout(resolve,100));
  }
  throw new Error(`«${text}» não chegou ao Pi (log: ${JSON.stringify(firstLines())})`);
 };
 /* Ações de UI por janela: o teste reabre o app no meio (bloco 7). */
 const ui=pg=>({
  bubble:text=>pg.waitForFunction(t=>[...document.querySelectorAll('.message.user .body')].some(el=>el.textContent.includes(t)),text,{timeout:20000}),
  busy:()=>pg.waitForFunction(()=>!document.querySelector('#stop').hidden,undefined,{timeout:15000}),
  idle:()=>pg.waitForFunction(()=>document.querySelector('#stop').hidden,undefined,{timeout:30000}),
  settle:()=>pg.waitForFunction(()=>document.querySelector('#stop').hidden&&!document.querySelector('.queue-strip'),undefined,{timeout:60000}),
  queueIn:async texts=>{
   for(const text of texts){
    await pg.locator('#prompt').fill(text);
    await pg.locator('#prompt').press('Enter');
   }
  },
  rows:()=>pg.evaluate(()=>[...document.querySelectorAll('.queue-item span')].map(span=>span.textContent)),
  strip:()=>pg.evaluate(()=>({
   label:document.querySelector('.queue-label')?.textContent,
   rows:[...document.querySelectorAll('.queue-item span')].map(span=>span.textContent),
   sendNow:!!document.querySelector('.queue-send-now')&&!document.querySelector('.queue-send-now').hidden,
   clear:!!document.querySelector('.queue-clear')&&!document.querySelector('.queue-clear').hidden,
  })),
 });
 let {bubble,busy,idle,settle,queueIn,rows,strip}=ui(page);

 /* ---------- 1. ⏎ livre envia; ocupado enfileira ---------- */
 await page.locator('#prompt').fill('base');
 await page.locator('#prompt').press('Enter');
 await bubble('base');
 await busy();
 assert.match(await page.locator('#composer-hint').textContent(),/⏎ enfileira · .*interrompe e envia/, 'a dica do composer acompanha o turno');
 await queueIn(['um','dois']);
 const queued=await page.evaluate(()=>({
  label:document.querySelector('.queue-label')?.textContent,
  rows:[...document.querySelectorAll('.queue-item span')].map(span=>span.textContent),
  sending:document.querySelectorAll('.queue-item.sending').length,
  field:document.querySelector('#prompt').value,
 }));
 log('[fila] enfileirado:',JSON.stringify(queued));
 assert.equal(queued.label,'Na fila · 2','a faixa conta os dois itens');
 assert.deepEqual(queued.rows,['um','dois']);
 assert.equal(queued.sending,0,'nenhum item nasce sending');
 assert.equal(queued.field,'','⏎ enfileirou: o campo esvaziou');
 assert.deepEqual(firstLines(),['base'],'nada foi para o Pi antes de o turno acabar');

 /* ---------- 2. editar (⏎ salva / Esc cancela) e remover (×) ---------- */
 await page.locator('.queue-item span').first().click();
 assert.equal(await page.locator('.queue-edit').inputValue(),'um','clicar no texto abre a edição');
 await page.locator('.queue-edit').fill('um editado');
 await page.locator('.queue-edit').press('Enter');
 assert.equal(await page.evaluate(()=>document.activeElement?.id),'prompt','⏎ que salva devolve o foco ao composer');
 assert.deepEqual(await rows(),['um editado','dois'],'o texto salvo vai para a linha');
 await page.locator('.queue-item span').nth(1).click();
 await page.locator('.queue-edit').fill('esc mexido');
 await page.locator('.queue-edit').press('Escape');
 assert.deepEqual(await rows(),['um editado','dois'],'Esc descarta o texto mexido');
 assert.equal(await page.evaluate(()=>document.activeElement?.id),'prompt','Esc devolve o foco ao composer');
 await page.locator('.queue-item button').nth(1).click();
 assert.deepEqual(await rows(),['um editado'],'o × remove a linha');

 /* ---------- 3. flush na ordem, como followUp, sem perder o rascunho ---------- */
 await page.waitForFunction(()=>!!document.querySelector('.queue-item.sending'),undefined,{timeout:30000});
 await page.locator('#prompt').fill('rascunho novo');
 await page.waitForFunction(()=>!document.querySelector('.queue-strip'),undefined,{timeout:60000});
 await settle();
 await sendEnabled(page,{timeout:60000});
 const flushed=entries();
 log('[fila] prompts:',JSON.stringify(flushed));
 assert.deepEqual(flushed.map(entry=>String(entry.message).split('\n')[0]),['base','um editado'],'a fila esvaziou na ordem');
 assert.ok(flushed.every(entry=>entry.streamingBehavior==='followUp'),'na Mesa o envio normal vai como followUp');
 assert.equal(await page.locator('#prompt').inputValue(),'rascunho novo','o rascunho digitado durante o envio não some');
 await page.locator('#prompt').fill('');

 /* ---------- 4. ⌘/Ctrl+⏎ com o Pi ocupado sai como steer ---------- */
 await page.locator('#prompt').fill('segura');
 await page.locator('#prompt').press('Enter');
 await busy();
 await queueIn(['depois']);
 assert.equal(await page.locator('.queue-label').textContent(),'Na fila','a faixa abre com um item só');
 await page.locator('#prompt').fill('agora');
 await page.locator('#prompt').press('ControlOrMeta+Enter');
 await bubble('agora');
 await waitLog('agora');
 const steer=entries().find(entry=>String(entry.message).split('\n')[0]==='agora');
 log('[fila] steer:',JSON.stringify(steer));
 assert.equal(steer.streamingBehavior,'steer','⌘/Ctrl+⏎ sai como steer');
 assert.equal(steer.inFlight,true,'o steer saiu com o turno em curso');
 /* O steer interrompe: o agent_end do turno antigo escoa a fila (o Pi real
    enfileira o followUp atrás do steer). O item sai, mas depois do steer. */
 await waitLog('depois');
 assert.equal(entries().at(-1).streamingBehavior,'followUp','o item que ficou na fila sai depois, como followUp');
 await settle();

 /* ---------- 5. Parar só interrompe: a fila fica segurada e "Enviar agora" manda ---------- */
 await page.locator('#prompt').fill('segura dois');
 await page.locator('#prompt').press('Enter');
 await busy();
 await queueIn(['segurada um','segurada dois']);
 assert.equal(await page.locator('.queue-item').count(),2);
 await page.locator('#stop').click();
 await toastWait(page,'a fila ficou segurada');
 await idle();
 const stopped=await strip();
 log('[fila] depois de Parar:',JSON.stringify(stopped));
 assert.deepEqual(stopped.rows,['segurada um','segurada dois'],'Parar não descarta a fila');
 assert.equal(stopped.label,'Na fila · 2');
 assert.equal(stopped.sendNow,true,'a faixa oferece Enviar agora');
 await page.waitForTimeout(1600);
 assert.ok(!firstLines().includes('segurada um')&&!firstLines().includes('segurada dois'),'nada sai sozinho depois de Parar');
 const held=JSON.parse(fs.readFileSync(path.join(runtime,'pending.json'),'utf8'));
 assert.equal(held[current].held,true,'a guarda do Parar vai para o disco');
 assert.deepEqual(held[current].items.map(item=>item.text),['segurada um','segurada dois']);
 await page.locator('.queue-send-now').click();
 await waitLog('segurada um');
 await waitLog('segurada dois');
 await settle();
 assert.deepEqual(firstLines().slice(-2),['segurada um','segurada dois'],'Enviar agora manda na ordem');
 assert.deepEqual(entries().slice(-2).map(entry=>entry.streamingBehavior),['followUp','followUp']);

 /* ---------- 6. Limpar (com confirmação) é a única ação que descarta ---------- */
 await page.locator('#prompt').fill('base de novo');
 await page.locator('#prompt').press('Enter');
 await busy();
 await queueIn(['descartavel um','descartavel dois']);
 await page.locator('#stop').click();
 await toastWait(page,'a fila ficou segurada');
 await idle();
 assert.equal((await strip()).clear,true,'Limpar aparece na faixa segurada');
 page.once('dialog',dialog=>dialog.dismiss());
 await page.locator('.queue-clear').click();
 await page.waitForTimeout(500);
 assert.equal(await page.locator('.queue-item').count(),2,'cancelar a confirmação mantém a fila');
 page.once('dialog',dialog=>dialog.accept());
 await page.locator('.queue-clear').click();
 await toastWait(page,'Fila limpa.');
 await page.waitForFunction(()=>!document.querySelector('.queue-strip'),undefined,{timeout:10000});
 assert.equal(await page.locator('.queue-item').count(),0,'Limpar some com a faixa');
 await page.waitForTimeout(1600);
 assert.ok(!firstLines().includes('descartavel um')&&!firstLines().includes('descartavel dois'),'o que foi limpo não vai para o Pi');
 const emptied=JSON.parse(fs.readFileSync(path.join(runtime,'pending.json'),'utf8'));
 assert.ok(!emptied[current]||emptied[current].items.length===0,'o arquivo fica sem a fila');

 /* ---------- 7. fechar com a fila: volta recuperada, com o anexo, sem enviar ---------- */
 await page.locator('#prompt').fill('segura o fechamento');
 await page.locator('#prompt').press('Enter');
 await busy();
 await page.locator('#prompt').fill('com anexo');
 await page.setInputFiles('#attach-input',seedPlot(runtime,'Calc'));
 await page.waitForSelector('#attachments .attachment',{timeout:15000});
 await page.locator('#prompt').press('Enter');
 await page.locator('#prompt').fill('sem anexo');
 await page.locator('#prompt').press('Enter');
 assert.deepEqual(await rows(),['com anexo','sem anexo']);
 const before7=JSON.parse(fs.readFileSync(path.join(runtime,'pending.json'),'utf8'))[current];
 assert.equal(before7.items.length,2,'enfileirar grava na hora');
 assert.equal(before7.items[0].images.length,1,'o anexo do item vai para o disco');
 assert.equal(before7.items[1].images.length,0,'o item seguinte não herda o anexo');
 assert.equal(before7.attachments.length,0,'a bandeja foi junto com o item');
 assert.ok(!firstLines().includes('com anexo'),'nada saiu antes de fechar');

 await app.close();
 app=ctx.app=await launchDesk({runtime,env});
 page=await app.firstWindow();
 windows.push(watch(page));
 ({bubble,busy,idle,settle,queueIn,rows,strip}=ui(page));
 await statusOnline(page);
 await toastWait(page,'mensagens pendentes foram recuperadas');
 const recovered=await strip();
 log('[fila] recuperada:',JSON.stringify(recovered));
 assert.equal(recovered.label,'Recuperadas · 2','a faixa diz que a fila veio do disco');
 assert.deepEqual(recovered.rows,['com anexo','sem anexo'],'os itens voltam na ordem, com o texto');
 assert.equal(recovered.sendNow,true,'Enviar agora aparece: nada sai sozinho');
 await page.waitForTimeout(1600);
 assert.ok(!firstLines().includes('com anexo'),'reabrir não envia nada sozinho');
 await page.locator('.queue-send-now').click();
 await waitLog('com anexo');
 await waitLog('sem anexo');
 await settle();
 const sent=entries().filter(entry=>['com anexo','sem anexo'].includes(String(entry.message).split('\n')[0]));
 log('[fila] recuperados enviados:',JSON.stringify(sent));
 assert.deepEqual(sent.map(entry=>entry.streamingBehavior),['followUp','followUp'],'a fila recuperada sai como followUp, na ordem');
 assert.deepEqual(sent.map(entry=>entry.images),[1,0],'o anexo guardado chegou ao Pi com o item dele');

 /* ---------- 8. trocar de conversa guarda a fila e a devolve ---------- */
 await page.locator('#prompt').fill('fila da conversa A');
 await page.locator('#prompt').press('Enter');
 await busy();
 await queueIn(['fica na A']);
 await page.locator('#stop').click();
 await toastWait(page,'a fila ficou segurada');
 await idle();
 assert.deepEqual((await strip()).rows,['fica na A']);
 const otherValue=await page.evaluate(()=>{const s=document.querySelector('#session-select');return [...s.options].map(o=>o.value).find(v=>v.endsWith('pi-1700000001000.jsonl'));});
 assert.ok(otherValue,'a outra conversa aparece no seletor');
 await page.locator('#session-select').selectOption(otherValue);
 await page.waitForFunction(()=>!document.querySelector('.queue-strip'),undefined,{timeout:30000});
 assert.equal(await page.locator('.queue-item').count(),0,'a conversa B nasce sem a fila da A');
 await statusOnline(page);
 const parked=JSON.parse(fs.readFileSync(path.join(runtime,'pending.json'),'utf8'));
 assert.deepEqual(parked[current].items.map(item=>item.text),['fica na A'],'a fila da A fica no disco enquanto se está na B');
 assert.equal(parked[other],undefined,'a B não ganhou fila nenhuma');
 await page.locator('#session-select').selectOption(current);
 await page.waitForFunction(()=>!!document.querySelector('.queue-item'),undefined,{timeout:30000});
 await statusOnline(page);
 const back=await strip();
 log('[fila] de volta à A:',JSON.stringify(back));
 assert.equal(back.label,'Na fila','a fila é desta execução (não é recuperação)');
 assert.deepEqual(back.rows,['fica na A'],'a fila da conversa volta com ela');
 assert.equal(back.sendNow,true,'a guarda do Parar voltou junto');
 await page.locator('.queue-send-now').click();
 await waitLog('fica na A');
 await settle();
 assert.ok(firstLines().includes('fila da conversa A'),'a conversa A continua a mesma do Pi');

 assert.deepEqual(windows.flatMap(w=>w.errors),[],`erros de página: ${JSON.stringify(windows.flatMap(w=>w.errors))}`);

 /* ---------- 9. aceite + falha do estado: a mensagem vale e a fila não repete ---------- */
 /* A fila recuperada tem UM item: o "Enviar agora" o manda e a leitura de estado
    que o main faz logo depois do aceite falha de propósito (FAKE_PI_CHAOS=
    state-fail). O envio não pode virar erro — se virasse, o item continuaria na
    fila e o mesmo texto seria reenviado no fim do turno. */
 await app.close();
 fs.writeFileSync(path.join(runtime,'pending.json'),JSON.stringify({
  [current]:{items:[{id:'fila-estado',text:'fila com estado falho',refs:[],images:[]}],attachments:[],held:false}
 }));
 app=ctx.app=await launchDesk({runtime,env:{...env,FAKE_PI_CHAOS:'state-fail'}});
 page=await app.firstWindow();
 windows.push(watch(page));
 ({bubble,busy,idle,settle,queueIn,rows,strip}=ui(page));
 await statusOnline(page);
 await toastWait(page,'pendente foi recuperada');
 await page.locator('.queue-send-now').click();
 await waitLog('fila com estado falho');
 await toastWait(page,'estado da sessão não pôde ser lido');
 await page.waitForFunction(()=>!document.querySelector('.queue-strip'),undefined,{timeout:30000});
 await settle();
 /* O turno do item aceito termina (agent_end do fake) e a fila não pode repetir. */
 await page.waitForTimeout(1800);
 const repeated=entries().filter(entry=>String(entry.message).split('\n')[0]==='fila com estado falho');
 log('[fila] depois do estado falho:',JSON.stringify(firstLines()));
 assert.equal(repeated.length,1,`a mensagem aceita não é reenviada (log: ${JSON.stringify(firstLines())})`);
 const rest=JSON.parse(fs.readFileSync(path.join(runtime,'pending.json'),'utf8'));
 assert.ok(!rest[current]||rest[current].items.length===0,'o arquivo da fila ficou sem o item entregue');

 if(EVIDENCE)await saveArtifacts(ctx);
 log('HUNT queue PASSED');
});

log('HUNT QUEUE DONE');
