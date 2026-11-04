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
import {withArtifacts,launchDesk,newRuntime,seedCourse,seedPlot,seedSession,writeDeskJson,writeConfigJson,toastWait,sendEnabled,statusOnline,saveArtifacts,sessionIds,openSessionById} from './helpers.mjs';
import {pollUntil} from './waits.mjs';

const EVIDENCE=process.env.EVIDENCE==='1';
const log=(...a)=>console.log(...a);
/* O abort ainda re-renderiza a faixa por alguns quadros; clicar no × durante
   essa troca desanexa o botão (o Playwright chama de "not stable"). Espera a
   faixa parar de mudar por 300 ms — estado, não tempo fixo — antes de remover. */
async function quietQueue(page,quietMs=300){
 return page.evaluate(ms=>new Promise(resolve=>{
  const strip=document.querySelector('.queue-strip');
  if(!strip)return resolve(true);
  let timer=setTimeout(done,ms);
  const observer=new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(done,ms);});
  function done(){observer.disconnect();resolve(true);}
  observer.observe(strip,{childList:true,subtree:true,attributes:true});
  setTimeout(()=>{observer.disconnect();resolve(false);},2000);
 }),quietMs);
}
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
 /* 8 s: dá folga para editar/remover a fila antes de o turno do fake terminar. */
 const env={FAKE_PI_QUEUE_LOG:logFile,FAKE_PI_QUEUE_HOLD_MS:'8000',FAKE_PI_REFUSAL_LOG:path.join(runtime,'refusal.log')};
 let app=ctx.app=await launchDesk({runtime,env});
 let page=await app.firstWindow();
 const windows=[watch(page)];
 await statusOnline(page);

 const entries=()=>{
  try{return fs.readFileSync(logFile,'utf8').trim().split('\n').filter(Boolean).map(line=>JSON.parse(line));}
  catch{return [];}
 };
 const firstLines=()=>entries().map(entry=>String(entry.message||'').split('\n')[0]);
 /* O log é escrito pelo fake antes de responder: esperar por ele (e não só pela
    bolha, que nasce antes do round-trip) tira a corrida do teste. */
 const waitLog=(text,timeout=20000)=>pollUntil(
  firstLines,
  lines=>lines.includes(text),
  {timeout,interval:100,what:`«${text}» no log do Pi`}
 );
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
 let strip;
 let {bubble,busy,idle,settle,queueIn,rows}=ui(page);

 /* ---------- 1. ⏎ livre envia; ocupado enfileira ---------- */
 await page.locator('#prompt').fill('base');
 await page.locator('#prompt').press('Enter');
 await bubble('base');
 await busy();
 assert.equal(await page.locator('#composer-hint').count(),0,'a dica de atalhos saiu da tela principal (os atalhos seguem valendo)');
 assert.equal(await page.locator('#stop').isVisible(),true,'durante o turno o Parar ocupa o lugar do Enviar');
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
 /* Para o turno e segura a fila: editar/remover não corre contra o fim do
    turno do fake (o auto-flush só volta depois, no "Enviar agora"). */
 await page.locator('#stop').click();
 await toastWait(page,'a fila ficou segurada');
 await idle();

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
 await page.locator('.queue-item button[title="Remover da fila"]').nth(1).click();
 assert.deepEqual(await rows(),['um editado'],'o × remove a linha');

 /* ---------- 3. flush na ordem, como followUp, sem perder o rascunho ---------- */
 await page.locator('#prompt').fill('rascunho novo');
 await page.locator('.queue-send-now').click();
 await waitLog('um editado');
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
 assert.equal(await page.locator('.queue-label').textContent(),'Na fila · 1','a faixa abre com um item só, com a contagem');
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

 /* ---------- 4b. "Enviar agora" da linha manda o item guardado como steer ---------- */
 await page.locator('#prompt').fill('base do item');
 await page.locator('#prompt').press('Enter');
 await busy();
 await page.locator('#prompt').fill('item com anexo');
 await page.setInputFiles('#attach-input',seedPlot(runtime,'Calc'));
 await page.waitForSelector('#attachments .attachment',{timeout:15000});
 await page.locator('#prompt').press('Enter');
 await page.locator('#prompt').fill('item depois');
 await page.locator('#prompt').press('Enter');
 assert.deepEqual(await rows(),['item com anexo','item depois']);
 assert.equal(await page.locator('.queue-item .queue-steer-now').count(),2,'cada linha oferece Enviar agora com o tutor ocupado');
 await page.locator('.queue-item span').first().click();
 assert.equal(await page.locator('.queue-item .queue-steer-now').count(),1,'a linha em edição não oferece Enviar agora');
 await page.locator('.queue-edit').press('Escape');
 /* O fato "motor sem steer" é do host: o render acompanha o evento. */
 await page.evaluate(async()=>{const state=await import('./src/state.mjs');state.S.capabilities={...state.capabilities(),steer:false};window.dispatchEvent(new Event('desk-engine-facts'));});
 assert.equal(await page.locator('.queue-item .queue-steer-now').count(),0,'motor sem steer esconde o botão');
 await page.evaluate(async()=>{const state=await import('./src/state.mjs');state.S.capabilities={...state.capabilities(),steer:true};window.dispatchEvent(new Event('desk-engine-facts'));});
 assert.equal(await page.locator('.queue-item .queue-steer-now').count(),2,'com steer, o botão volta');
 await page.locator('.queue-item .queue-steer-now').first().click();
 await bubble('item com anexo');
 await waitLog('item com anexo');
 await waitLog('item depois');
 const rowSteer=entries().find(entry=>String(entry.message).split('\n')[0]==='item com anexo');
 log('[fila] steer da linha:',JSON.stringify(rowSteer));
 assert.equal(rowSteer.streamingBehavior,'steer','o item da fila saiu como steer');
 assert.equal(rowSteer.images,1,'o anexo do snapshot do enqueue foi junto');
 assert.equal(entries().filter(entry=>String(entry.message).split('\n')[0]==='item com anexo').length,1,'o item saiu uma vez só');
 await settle();
 const afterRowSteer=JSON.parse(fs.readFileSync(path.join(runtime,'pending.json'),'utf8'));
 assert.ok(!afterRowSteer[current]||afterRowSteer[current].items.length===0,'o item steer saiu do disco e o flush não repetiu');

 /* ---------- 4c. recusa provada devolve o item à posição original ---------- */
 await page.locator('#prompt').fill('base da recusa');
 await page.locator('#prompt').press('Enter');
 await busy();
 await queueIn(['fica antes','falhar na fila','fica depois']);
 assert.equal(await page.locator('.queue-item .queue-steer-now').count(),3);
 await page.locator('.queue-item .queue-steer-now').nth(1).click();
 await toastWait(page,'Recusa de teste antes do aceite');
 await page.waitForFunction(()=>[...document.querySelectorAll('.queue-item span')].map(el=>el.textContent).join('|')==='fica antes|falhar na fila|fica depois',undefined,{timeout:10000});
 const restored=JSON.parse(fs.readFileSync(path.join(runtime,'pending.json'),'utf8'));
 assert.deepEqual(restored[current].items.map(item=>item.text),['fica antes','falhar na fila','fica depois'],'o item recusado voltou ao disco na posição original');
 assert.ok(!firstLines().includes('falhar na fila'),'a recusa não chegou ao Pi');
 /* A recusa escondeu o Parar enquanto o turno antigo ainda roda: segura a fila
    e aborta antes de mexer nas linhas (o auto-flush tentaria a recusada de novo). */
 await page.evaluate(()=>{window.dispatchEvent(new Event('desk-stop'));return window.desk.abort().catch(()=>{});});
 await idle();
 assert.equal(await quietQueue(page),true,'a faixa da fila parou de re-renderizar depois do abort');
 for(let i=0;i<3;i++){
  await page.locator('.queue-item button[title="Remover da fila"]').last().click();
  await page.waitForFunction(n=>document.querySelectorAll('.queue-item').length===n,2-i,{timeout:10000});
 }
 await page.waitForFunction(()=>!document.querySelector('.queue-strip'),undefined,{timeout:10000});
 const emptiedRefusal=JSON.parse(fs.readFileSync(path.join(runtime,'pending.json'),'utf8'));
 assert.ok(!emptiedRefusal[current]||emptiedRefusal[current].items.length===0,'o item recusado não fica no disco depois de removido');
 /* Reabre limpo para os blocos seguintes. */
 await app.close();
 app=ctx.app=await launchDesk({runtime,env});
 page=await app.firstWindow();
 windows.push(watch(page));
 ({busy,idle,settle,queueIn,rows,strip}=ui(page));
 await statusOnline(page);

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
 assert.equal(await page.locator('.queue-item .queue-steer-now').count(),0,'livre (segurada), a linha não oferece steer');
 await page.waitForTimeout(1600);// espera fixa: "nada acontece em 1,6 s" — depois de Parar nada sai sozinho para o Pi
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
 await page.waitForTimeout(500);// espera fixa: "nada acontece em 0,5 s" — cancelar a confirmação não pode esvaziar a fila
 assert.equal(await page.locator('.queue-item').count(),2,'cancelar a confirmação mantém a fila');
 page.once('dialog',dialog=>dialog.accept());
 await page.locator('.queue-clear').click();
 await toastWait(page,'Fila limpa.');
 await page.waitForFunction(()=>!document.querySelector('.queue-strip'),undefined,{timeout:10000});
 assert.equal(await page.locator('.queue-item').count(),0,'Limpar some com a faixa');
 await page.waitForTimeout(1600);// espera fixa: "nada acontece em 1,6 s" — o que foi limpo não chega ao Pi
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
 ({busy,idle,settle,queueIn,strip}=ui(page));
 /* O aviso de recuperação nasce no boot e vive ~3 s: espera antes do ping. */
 await toastWait(page,'mensagens pendentes foram recuperadas');
 await statusOnline(page);
 const recovered=await strip();
 log('[fila] recuperada:',JSON.stringify(recovered));
 assert.equal(recovered.label,'Recuperadas · 2','a faixa diz que a fila veio do disco');
 assert.deepEqual(recovered.rows,['com anexo','sem anexo'],'os itens voltam na ordem, com o texto');
 assert.equal(recovered.sendNow,true,'Enviar agora aparece: nada sai sozinho');
 await page.waitForTimeout(1600);// espera fixa: "nada acontece em 1,6 s" — reabrir com fila recuperada não envia nada sozinho
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
 const otherValue=(await sessionIds(page)).find(v=>v.endsWith('pi-1700000001000.jsonl'));
 assert.ok(otherValue,'a outra sessão aparece na lista');
 await openSessionById(page,otherValue);
 await page.waitForFunction(()=>!document.querySelector('.queue-strip'),undefined,{timeout:30000});
 assert.equal(await page.locator('.queue-item').count(),0,'a conversa B nasce sem a fila da A');
 await statusOnline(page);
 const parked=JSON.parse(fs.readFileSync(path.join(runtime,'pending.json'),'utf8'));
 assert.deepEqual(parked[current].items.map(item=>item.text),['fica na A'],'a fila da A fica no disco enquanto se está na B');
 assert.equal(parked[other],undefined,'a B não ganhou fila nenhuma');
 await openSessionById(page,current);
 await page.waitForFunction(()=>!!document.querySelector('.queue-item'),undefined,{timeout:30000});
 await statusOnline(page);
 const back=await strip();
 log('[fila] de volta à A:',JSON.stringify(back));
 assert.equal(back.label,'Na fila · 1','a fila é desta execução (não é recuperação), com a contagem');
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
 ({busy,settle,queueIn}=ui(page));
 await statusOnline(page);
 await toastWait(page,'pendente foi recuperada');
 await page.locator('.queue-send-now').click();
 await waitLog('fila com estado falho');
 await toastWait(page,'estado da sessão não pôde ser lido');
 await page.waitForFunction(()=>!document.querySelector('.queue-strip'),undefined,{timeout:30000});
 await settle();
 /* O turno do item aceito termina (agent_end do fake) e a fila não pode repetir. */
 await page.waitForTimeout(1800);// espera fixa: "nada acontece em 1,8 s" — o turno do item aceito termina e a fila não pode repetir o envio
 const repeated=entries().filter(entry=>String(entry.message).split('\n')[0]==='fila com estado falho');
 log('[fila] depois do estado falho:',JSON.stringify(firstLines()));
 assert.equal(repeated.length,1,`a mensagem aceita não é reenviada (log: ${JSON.stringify(firstLines())})`);
 const rest=JSON.parse(fs.readFileSync(path.join(runtime,'pending.json'),'utf8'));
 assert.ok(!rest[current]||rest[current].items.length===0,'o arquivo da fila ficou sem o item entregue');

 /* ---------- 10. entrega incerta não devolve o item (não duplica a fala) ---------- */
 await page.locator('#prompt').fill('base incerta');
 await page.locator('#prompt').press('Enter');
 await busy();
 await queueIn(['talvez tenha ido']);
 /* O Pi de teste aceita tudo: a incerteza é encenada no handler, como o
    renderer a recebe de um transporte que não provou a entrega. */
 await app.evaluate(({ipcMain})=>{ipcMain.removeHandler('pi-prompt');ipcMain.handle('pi-prompt',async()=>({sent:false,retryable:false,error:'entrega incerta (teste)'}));});
 await page.locator('.queue-item .queue-steer-now').first().click();
 await toastWait(page,'entrega incerta (teste)');
 await page.waitForFunction(()=>!document.querySelector('.queue-item'),undefined,{timeout:10000});
 assert.equal(await page.locator('.queue-strip').count(),0,'entrega incerta não devolve o item à fila');
 const uncertainDisk=JSON.parse(fs.readFileSync(path.join(runtime,'pending.json'),'utf8'));
 assert.ok(!uncertainDisk[current]||uncertainDisk[current].items.length===0,'o arquivo não guarda o item incerto');
 assert.ok(!firstLines().includes('talvez tenha ido'),'o item incerto não chegou ao Pi de teste');
 assert.deepEqual(windows.flatMap(w=>w.errors),[],`erros de página: ${JSON.stringify(windows.flatMap(w=>w.errors))}`);

 if(EVIDENCE)await saveArtifacts(ctx);
 log('HUNT queue PASSED');
});

log('HUNT QUEUE DONE');
