/* Barreira da fila (#57, volta do `settled-ui` do Pi): com o turno acabando
   mas ainda não fechado, a fila não anda; depois do fechamento, o próximo
   item é enviado exatamente uma vez. Em janela, contra o fake OpenCode: a
   primeira mensagem segura o turno (QUEUE_HOLD_MS) enquanto a segunda espera
   na faixa, e o log do fake prova que nada sai antes do settled. */
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import {withArtifacts,launchDesk,newRuntime,seedCourse,writeConfigJson,statusOnline,sendEnabled} from './helpers.mjs';
import {pollUntil} from './waits.mjs';

await withArtifacts('settled',async ctx=>{
 const runtime=ctx.runtime=newRuntime('settled');
 const course=seedCourse(runtime,'Test');
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'Test',name:'Teste',path:course}],desk:{pinnedExtensions:false}});
 const log=path.join(runtime,'queue.jsonl');
 /* 8 s de turno: folga para enfileirar e conferir que nada anda antes do fim. */
 ctx.app=await launchDesk({runtime,env:{FAKE_OPENCODE_QUEUE_LOG:log,FAKE_OPENCODE_QUEUE_HOLD_MS:'8000'}});
 const page=await ctx.app.firstWindow(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await statusOnline(page);
 await sendEnabled(page);

 const entries=()=>{
  try{return fs.readFileSync(log,'utf8').trim().split('\n').filter(Boolean).map(line=>JSON.parse(line));}
  catch{return [];}
 };
 const firstLines=()=>entries().map(entry=>String(entry.message||'').split('\n')[0]);
 const waitLog=(text,timeout=30000)=>pollUntil(firstLines,lines=>lines.includes(text),{timeout,interval:100,what:`«${text}» no log do OpenCode`});

 await page.locator('#prompt').fill('settle-test');
 await page.locator('#send').click();
 await page.waitForFunction(text=>[...document.querySelectorAll('.message.user .body')].some(el=>el.textContent.includes(text)),'settle-test',{timeout:20000});
 await page.waitForFunction(()=>!document.querySelector('#stop').hidden,undefined,{timeout:15000});
 await page.locator('#prompt').fill('item seguinte');
 await page.locator('#prompt').press('Enter');
 await page.waitForFunction(()=>document.querySelectorAll('.queue-item').length===1,undefined,{timeout:10000});
 /* Turno em voo: a fila mostra o item, o Parar ocupa o Enviar e o fake só viu a primeira. */
 assert.equal(await page.locator('#stop').isVisible(),true,'a coluna segue ocupada antes do settled');
 await waitLog('settle-test');
 assert.deepEqual(firstLines(),['settle-test'],'a fila não anda com o turno acabando mas ainda não fechado');
 /* Depois do fechamento o item sai uma vez só, como followUp. */
 await page.waitForFunction(()=>document.querySelector('#stop').hidden&&!document.querySelector('.queue-strip'),undefined,{timeout:60000});
 await waitLog('item seguinte');
 const records=entries().filter(entry=>['settle-test','item seguinte'].includes(String(entry.message).split('\n')[0]));
 assert.equal(records.length,2,'o próximo item é enviado exatamente uma vez');
 assert.match(String(records[1].message),/item seguinte/);
 assert.deepEqual(records.map(entry=>entry.streamingBehavior),['followUp','followUp']);
 assert.deepEqual(errors,[]);
 console.log('PASS: a fila espera o settled e envia o próximo item uma vez só.');
});
