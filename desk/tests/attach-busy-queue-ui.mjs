/* Colar/soltar durante a resposta entra na bandeja e depois na fila: o turno em
   voo não descarta o anexo (antes, `chat-attachments.mjs` ignorava com
   `if(S.busy)`). O envio com o tutor ocupado enfileira (followUp) pelo caminho
   do texto, levando a imagem no item.
   Roda: node tests/attach-busy-queue-ui.mjs (ou `npm run -s ui -- attach-busy-queue`). */
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import {withArtifacts,launchDesk,newRuntime,seedCourse,seedNativeSession,writeDeskJson,writeConfigJson,sendEnabled,statusOnline,PLOT_PNG} from './helpers.mjs';
import {pollUntil} from './waits.mjs';

await withArtifacts('attach-busy-queue',async ctx=>{
 const runtime=ctx.runtime=newRuntime('attach-busy-queue');
 const course=seedCourse(runtime,'Calc');
 const logFile=path.join(runtime,'queue.log');
 const current=seedNativeSession(runtime,[{role:'user',content:[{type:'text',text:'corrente'}],timestamp:1700000002000}],{courseId:'Calc'});
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'Calc',name:'Cálculo I',path:course}]});
 writeDeskJson(runtime,{session:current,courseId:'Calc'});
 const env={FAKE_OPENCODE_QUEUE_LOG:logFile,FAKE_OPENCODE_QUEUE_HOLD_MS:'8000',FAKE_OPENCODE_REFUSAL_LOG:path.join(runtime,'refusal.log'),FAKE_OPENCODE_LOG:path.join(runtime,'fake.log')};
 const app=ctx.app=await launchDesk({runtime,env});
 const page=await app.firstWindow();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await statusOnline(page);
 await sendEnabled(page);
 const entries=()=>{
  try{return fs.readFileSync(logFile,'utf8').trim().split('\n').filter(Boolean).map(line=>JSON.parse(line));}
  catch{return [];}
 };
 const firstLines=()=>entries().map(entry=>String(entry.message||'').split('\n')[0]);
 const waitLog=(text,timeout=20000)=>pollUntil(firstLines,lines=>lines.includes(text),{timeout,interval:100,what:`«${text}» no log do OpenCode`});
 const pasteImage=(name='colada.png')=>page.evaluate(([png,fileName])=>{
  const binary=atob(png);const bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
  const data=new DataTransfer();data.items.add(new File([bytes],fileName,{type:'image/png'}));
  document.querySelector('#prompt').dispatchEvent(new ClipboardEvent('paste',{clipboardData:data,cancelable:true,bubbles:true}));
 },[PLOT_PNG,name]);
 const dropImage=(name='solta.png')=>page.evaluate(([png,fileName])=>{
  const binary=atob(png);const bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
  const data=new DataTransfer();data.items.add(new File([bytes],fileName,{type:'image/png'}));
  document.querySelector('#chat').dispatchEvent(new DragEvent('drop',{dataTransfer:data,cancelable:true,bubbles:true}));
 },[PLOT_PNG,name]);
 /* Base ocupa o turno; o paste cai com o tutor respondendo (S.busy). */
 await page.locator('#prompt').fill('base ocupada');
 await page.locator('#prompt').press('Enter');
 await page.waitForFunction(()=>!document.querySelector('#stop').hidden,undefined,{timeout:15000});
 await pasteImage();
 await page.waitForSelector('#attachments .attachment img',{timeout:15000});
 assert.equal(await page.locator('#attachments .attachment').count(),1,'colar durante a resposta põe o anexo na bandeja');
 await page.locator('#prompt').fill('olha o gráfico');
 await page.locator('#prompt').press('Enter');
 await page.waitForFunction(()=>[...document.querySelectorAll('.queue-item span')].some(el=>el.textContent==='olha o gráfico'),undefined,{timeout:10000});
 /* A faixa pinta antes do `persist` (IPC assíncrono): espera o arquivo ter o item. */
 const pendingFile=path.join(runtime,'pending.json');
 const disk=await pollUntil(()=>{try{return JSON.parse(fs.readFileSync(pendingFile,'utf8'));}catch{return null;}},value=>value?.[current]?.items?.length===1,{timeout:10000,what:'o item da fila em pending.json'});
 assert.equal(disk[current].items.length,1,'o envio com anexo durante o turno enfileirou');
 assert.equal(disk[current].items[0].images.length,1,'o item da fila leva a imagem colada');
 assert.equal(disk[current].items[0].text,'olha o gráfico');
 /* Soltar arquivo no chat com o turno ainda em voo também entra na bandeja. */
 await page.waitForFunction(()=>!document.querySelector('#stop').hidden);
 await dropImage();
 await page.waitForSelector('#attachments .attachment img',{timeout:15000});
 assert.equal(await page.locator('#attachments .attachment').count(),1,'soltar durante a resposta põe o anexo na bandeja');
 await waitLog('base ocupada');
 await waitLog('olha o gráfico');
 const sent=entries().find(entry=>String(entry.message).split('\n')[0]==='olha o gráfico');
 assert.equal(sent.streamingBehavior,'followUp','o item com anexo sai como followUp, como o texto');
 assert.equal(sent.images,1,'o anexo colado durante a resposta chegou ao motor');
 assert.deepEqual(errors,[],`erros de página: ${JSON.stringify(errors)}`);
 console.log('ATTACH BUSY QUEUE UI PASSED: colar e soltar durante a resposta entram na bandeja; o envio vai à fila com a imagem.');
});
