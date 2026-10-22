// node tests/send-offline-ui.mjs — enviar com o tutor desligado (ticket #18),
// testado na janela com o Pi de teste. Cobre os critérios de aceite:
//   - escrever e enviar com o tutor desligado liga o tutor sem outro clique;
//   - a mensagem aparece guardada ("Guardada. Vai quando ele atender.") e vai
//     para a fila que persiste (pending.json);
//   - duas ou três mensagens enquanto ele liga saem UMA vez, na ordem;
//   - Cancelar a chamada não apaga a mensagem guardada;
//   - tutor que não atende mantém a mensagem; "Chamar de novo" entrega;
//   - fechar e reabrir com a mensagem guardada não a perde (volta recuperada,
//     sem envio automático, e "Enviar agora" entrega uma vez);
//   - tutor que atende com a fila vetada (cancelamento a confirmar) segura a
//     guardada e oferece "Enviar agora", sem enviar sozinha.
// Grava capturas (guardada com o tutor ligando, sem resposta e depois de
// entregue) nos dois temas, em 1440×900 e 900×650.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
 withArtifacts,newRuntime,seedCourse,seedPlot,seedSession,writeConfigJson,writeDeskJson,launchDesk,statusOnline,tinyPdf,FAKE_PI,
 reviewShot,screenshotDirectory,setTheme,freezeMotion,resizeWindow
} from './helpers.mjs';
import {layoutStable} from './waits.mjs';

const out=screenshotDirectory('send-offline');
const size=(app,page,width,height)=>resizeWindow(app,page,width,height);
const shot=(page,name)=>reviewShot(page,out,name);

/* Pi de bancada controlado por arquivos: sem `pi-gate.open` ele não sobe (a
   janela "ligando" fica aberta o tempo que o teste quiser); com `pi-gate.fail`
   morre na hora com um código (o motivo da falha); aberto, vira o fake de
   verdade e herda FAKE_PI_QUEUE_LOG (cada prompt entra no log, na ordem). */
function writeGatePi(runtime){
 const wrapper=path.join(runtime,'pi-gate.mjs');
 fs.writeFileSync(wrapper,`#!/usr/bin/env node
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const here=path.dirname(new URL(import.meta.url).pathname);
if(fs.existsSync(path.join(here,'pi-gate.fail'))){process.stderr.write('falha combinada do teste\\n');process.exit(7);}
const gate=path.join(here,'pi-gate.open');
const timer=setInterval(()=>{
 if(!fs.existsSync(gate))return;
 clearInterval(timer);
 const child=spawn(process.execPath,[${JSON.stringify(FAKE_PI)},...process.argv.slice(2)],{stdio:'inherit'});
 child.on('exit',code=>process.exit(code??0));
},50);
`);
 fs.chmodSync(wrapper,0o755);
 return {wrapper,gate:path.join(runtime,'pi-gate.open'),fail:path.join(runtime,'pi-gate.fail')};
}

function seed(tag){
 const runtime=newRuntime(tag);
 const course=seedCourse(runtime,'calc');
 const pdf=path.join(course,'Limites.pdf');fs.writeFileSync(pdf,tinyPdf('Limites e derivadas'));
 const session=seedSession(runtime,[{type:'message',message:{role:'user',content:[{type:'text',text:'corrente'}],timestamp:1700000002000}}]);
 writeConfigJson(runtime,{runtimePath:runtime,vaultPath:runtime,courses:[{id:'calc',name:'Cálculo',path:course}]});
 writeDeskJson(runtime,{session,courseId:'calc',courseStates:{calc:{session,pdfs:[{path:pdf,page:1}],study:{title:'Lista 2 · 7b',xopp:''}}},pdfs:[{path:pdf,page:1}],study:{title:'Lista 2 · 7b',xopp:''}});
 return {runtime,gate:writeGatePi(runtime),log:path.join(runtime,'queue.log'),session};
}

const entries=log=>{
 try{return fs.readFileSync(log,'utf8').trim().split('\n').filter(Boolean).map(line=>JSON.parse(line));}
 catch{return [];}
};
const sent=log=>entries(log).map(entry=>String(entry.message||'').split('\n')[0]);
const waitFor=async(read,ok,note,timeout=30000)=>{
 const until=Date.now()+timeout;
 let last;
 while(Date.now()<until){last=read();if(ok(last))return last;await new Promise(resolve=>setTimeout(resolve,100));/* espera fixa: intervalo do polling */}
 throw new Error(`${note} (último: ${JSON.stringify(last)})`);
};
const stored=(runtime,session)=>{
 try{return (JSON.parse(fs.readFileSync(path.join(runtime,'pending.json'),'utf8'))[session]?.items||[]).map(item=>item.text);}
 catch{return [];}
};
const strip=page=>page.evaluate(()=>({
 label:document.querySelector('.queue-label')?.textContent||'',
 rows:[...document.querySelectorAll('.queue-item span')].map(span=>span.textContent),
 sendNow:!!document.querySelector('.queue-send-now')&&!document.querySelector('.queue-send-now').hidden
}));
const tutorState=page=>page.locator('#tutor-state').getAttribute('data-state');
const type=async(page,text)=>{await page.locator('#prompt').fill(text);await page.locator('#prompt').press('Enter');};

/* A janela pequena: mede que a faixa e a caixa continuam à vista e grava o
   estado nos dois temas; volta ao tamanho de antes. */
async function shots(page,app,name){
 for(const [width,height] of [[1440,900],[900,650]]){
  await size(app,page,width,height);
  await layoutStable(page,'#prompt');
  const box=await page.evaluate(()=>{
   const q=sel=>document.querySelector(sel)?.getBoundingClientRect();
   const composer=q('#composer-box'),strip=q('.queue-strip'),column=q('#chat');
   return {composer:composer&&{top:composer.top,bottom:composer.bottom,left:composer.left,right:composer.right},strip:strip&&{top:strip.top,bottom:strip.bottom,left:strip.left,right:strip.right},column:column&&{left:column.left,right:column.right},win:{width:innerWidth,height:innerHeight},overflowX:document.querySelector('#composer-box').scrollWidth-document.querySelector('#composer-box').clientWidth};
  });
  if(box.strip){
   assert.ok(box.strip.left>=box.column.left-0.5&&box.strip.right<=box.column.right+0.5,`${name} ${width}: a faixa cabe na coluna`);
   assert.ok(box.strip.top>=0&&box.composer.bottom<=box.win.height+0.5,`${name} ${width}: faixa e caixa à vista na janela (${JSON.stringify(box)})`);
  }
  assert.ok(box.overflowX<=0.5,`${name} ${width}: a caixa não vaza para o lado`);
  for(const theme of ['light','dark']){
   await setTheme(page,theme);
   await shot(page,`${theme}-${width}x${height}-${name}.png`);
  }
  await setTheme(page,'light');
 }
 await size(app,page,1440,900);
 await layoutStable(page,'#prompt');
}

await withArtifacts('send-offline',async ctx=>{
 const {runtime,gate,log,session}=seed('send-offline');
 ctx.runtime=runtime;
 const env={LEARNING_DESK_PI:gate.wrapper,FAKE_PI_QUEUE_LOG:log,FAKE_PI_QUEUE_HOLD_MS:'500'};
 const app=ctx.app=await launchDesk({runtime,env});
 const page=await app.firstWindow();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await size(app,page,1440,900);
 await page.waitForSelector('.pdf-panel',{timeout:30000});
 await freezeMotion(page);

 /* ---- tutor desligado: o Pi não sobe (portão fechado) e a pessoa cancela ---- */
 await page.waitForSelector('#tutor-state[data-state="connecting"]',{timeout:20000});
 await page.locator('#connect-cancel').click();
 await page.waitForFunction(()=>document.querySelector('#tutor-state')?.dataset.state==='off',undefined,{timeout:10000});
 assert.equal(await page.locator('.queue-strip').count(),0,'nada guardado ainda');

 /* ---- enviar desligado: liga sozinho e guarda ---- */
 await type(page,'primeira pergunta');
 await page.waitForSelector('#tutor-state[data-state="connecting"]',{timeout:10000});
 assert.equal(await page.locator('#prompt').inputValue(),'','a caixa esvazia: a mensagem foi guardada');
 let view=await strip(page);
 assert.equal(view.label,'Guardada. Vai quando ele atender.');
 assert.deepEqual(view.rows,['primeira pergunta']);
 assert.equal(view.sendNow,false,'ligando: nada a "enviar agora", ela vai sozinha');
 assert.deepEqual(sent(log),[],'nada foi ao tutor antes de ele atender');
 await waitFor(()=>stored(runtime,session),texts=>texts.length===1&&texts[0]==='primeira pergunta','a mensagem guardada vai para o disco na hora');
 assert.equal(await page.locator('.message.user .body',{hasText:'primeira pergunta'}).count(),0,'ainda não é uma fala da sessão');

 /* ---- mais duas enquanto liga (uma pelo botão Enviar) ---- */
 await type(page,'segunda pergunta');
 await page.locator('#prompt').fill('terceira pergunta');
 await page.locator('#send').click();
 await page.waitForFunction(()=>document.querySelectorAll('.queue-item').length===3,undefined,{timeout:10000});
 view=await strip(page);
 assert.deepEqual(view.rows,['primeira pergunta','segunda pergunta','terceira pergunta'],'na ordem em que foram enviadas');
 assert.equal(view.label,'Guardadas · 3. Vão quando ele atender.');
 assert.equal(await tutorState(page),'connecting','continua ligando: não abriu outra chamada');
 await shots(page,app,'guardada-ligando');

 /* ---- Cancelar a chamada não apaga o que foi guardado ---- */
 await page.locator('#connect-cancel').click();
 await page.waitForFunction(()=>document.querySelector('#tutor-state')?.dataset.state==='off',undefined,{timeout:10000});
 view=await strip(page);
 assert.deepEqual(view.rows,['primeira pergunta','segunda pergunta','terceira pergunta'],'Cancelar não apaga as guardadas');
 assert.equal(view.label,'Guardadas · 3. Vão quando ele atender.');
 assert.deepEqual(stored(runtime,session),['primeira pergunta','segunda pergunta','terceira pergunta'],'nem do disco');
 await page.waitForTimeout(1200);// espera fixa: "nada acontece em 1,2 s" — cancelada, nada sai sozinho
 assert.deepEqual(sent(log),[],'cancelada, nada sai sozinho');

 /* ---- o tutor não atende: a mensagem continua guardada ---- */
 fs.writeFileSync(gate.fail,'');
 await page.locator('#connect').click();
 await page.waitForSelector('#tutor-state[data-state="error"]',{timeout:30000});
 view=await strip(page);
 assert.deepEqual(view.rows,['primeira pergunta','segunda pergunta','terceira pergunta'],'sem resposta: continuam guardadas');
 assert.equal(view.label,'Guardadas · 3. Vão quando ele atender.');
 assert.deepEqual(sent(log),[]);
 await shots(page,app,'guardada-sem-resposta');

 /* ---- Chamar de novo: o tutor atende e entrega uma vez, na ordem ---- */
 fs.rmSync(gate.fail);
 fs.writeFileSync(gate.gate,'');
 await page.locator('#connect').click();
 await statusOnline(page,{timeout:30000});
 await waitFor(()=>sent(log),list=>list.length>=3,'as três mensagens chegam ao tutor',60000);
 await page.waitForFunction(()=>!document.querySelector('.queue-strip')&&document.querySelector('#stop').hidden,undefined,{timeout:60000});
 await page.waitForTimeout(1500);// espera fixa: "nada acontece em 1,5 s" — nenhuma entrega duplicada depois da fila vazia
 assert.deepEqual(sent(log),['primeira pergunta','segunda pergunta','terceira pergunta'],'uma vez cada, na ordem');
 assert.deepEqual(stored(runtime,session),[],'entregues: nada fica no disco');
 assert.equal(await page.locator('.message.user .body',{hasText:'primeira pergunta'}).count(),1,'a fala aparece na sessão uma vez');
 await shots(page,app,'depois-de-entregue');
 assert.deepEqual(errors,[]);
});

/* ---- fechar e reabrir com a mensagem guardada ---- */
await withArtifacts('send-offline-reopen',async ctx=>{
 const {runtime,gate,log,session}=seed('send-offline-reopen');
 ctx.runtime=runtime;
 const env={LEARNING_DESK_PI:gate.wrapper,FAKE_PI_QUEUE_LOG:log,FAKE_PI_QUEUE_HOLD_MS:'500'};
 let app=ctx.app=await launchDesk({runtime,env});
 let page=await app.firstWindow();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.waitForSelector('#tutor-state[data-state="connecting"]',{timeout:30000});
 await type(page,'guardada antes de fechar');
 await waitFor(()=>stored(runtime,session),texts=>texts.length===1,'a mensagem chegou ao disco');
 /* só anexo, sem texto: também é guardado, e a faixa diz o que é */
 await page.setInputFiles('#attach-input',seedPlot(runtime,'calc'));
 await page.waitForSelector('#attachments .attachment',{timeout:10000});
 await page.locator('#prompt').press('Enter');
 await page.waitForFunction(()=>document.querySelectorAll('.queue-item').length===2,undefined,{timeout:10000});
 assert.deepEqual((await strip(page)).rows,['guardada antes de fechar','Imagem anexada'],'a mensagem só com anexo não vira linha em branco');
 assert.equal(await page.locator('#attachments .attachment').count(),0,'o anexo saiu da bandeja: foi com a mensagem guardada');
 await waitFor(()=>stored(runtime,session),texts=>texts.length===2,'o item só com anexo também chegou ao disco');
 await app.close();
 assert.deepEqual(sent(log),[],'fechou sem o tutor ter atendido');
 assert.deepEqual(stored(runtime,session),['guardada antes de fechar',''],'o arquivo guarda as duas (a segunda sem texto, com a imagem)');

 /* reabre com o tutor atendendo: a mensagem volta, mas nada sai sozinho */
 fs.writeFileSync(gate.gate,'');
 app=ctx.app=await launchDesk({runtime,env});
 page=await app.firstWindow();
 page.on('pageerror',e=>errors.push(e.message));
 await page.waitForSelector('.queue-strip',{timeout:30000});
 await statusOnline(page,{timeout:30000});
 const view=await strip(page);
 assert.deepEqual(view.rows,['guardada antes de fechar','Imagem anexada']);
 assert.equal(view.label,'Recuperadas · 2','vinda de outra execução: diz de onde veio');
 assert.equal(view.sendNow,true,'e oferece "Enviar agora"');
 await page.waitForTimeout(1500);// espera fixa: "nada acontece em 1,5 s" — nada sai sozinho na abertura
 assert.deepEqual(sent(log),[],'nada sai sozinho na abertura');
 await page.locator('.queue-send-now').click();
 await waitFor(()=>entries(log),list=>list.length>=2,'Enviar agora entrega as duas',60000);
 await page.waitForFunction(()=>!document.querySelector('.queue-strip')&&document.querySelector('#stop').hidden,undefined,{timeout:60000});
 await page.waitForTimeout(1000);// espera fixa: "nada acontece em 1 s" — nenhuma entrega duplicada depois de Enviar agora
 const delivered=entries(log);
 assert.equal(delivered.length,2,'uma vez cada');
 assert.equal(String(delivered[0].message).split('\n')[0],'guardada antes de fechar','na ordem');
 assert.deepEqual(delivered.map(entry=>entry.images),[0,1],'o anexo foi junto da segunda');
 assert.deepEqual(errors,[]);
});
/* Tutor atendeu, mas um cancelamento ainda espera confirmação: a guardada não
   fica parada sem saída — é segurada e oferece "Enviar agora". */
await withArtifacts('send-offline-vetoed',async ctx=>{
 const {runtime,gate,log,session}=seed('send-offline-vetoed');
 ctx.runtime=runtime;
 const env={LEARNING_DESK_PI:gate.wrapper,FAKE_PI_QUEUE_LOG:log,FAKE_PI_QUEUE_HOLD_MS:'500'};
 const app=ctx.app=await launchDesk({runtime,env});
 const page=await app.firstWindow();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.waitForSelector('#tutor-state[data-state="connecting"]',{timeout:30000});
 await type(page,'guardada e vetada');
 await waitFor(()=>stored(runtime,session),texts=>texts.length===1,'a mensagem chegou ao disco');
 await page.evaluate(async()=>{const {S}=await import('./src/state.mjs');S.turnCancelled=true;});
 fs.writeFileSync(gate.gate,'');
 await page.waitForSelector('.queue-send-now:not([hidden])',{timeout:60000});
 await page.waitForTimeout(1500);// espera fixa: "nada acontece em 1,5 s" — vetada, nada sai sozinho
 assert.deepEqual(sent(log),[],'vetada: nada sai sozinho');
 assert.deepEqual(stored(runtime,session),['guardada e vetada'],'e continua no disco');
 await page.evaluate(async()=>{const {S}=await import('./src/state.mjs');S.turnCancelled=false;});
 await page.locator('.queue-send-now').click();
 await waitFor(()=>entries(log),list=>list.length>=1,'Enviar agora entrega',60000);
 await page.waitForFunction(()=>!document.querySelector('.queue-strip'),undefined,{timeout:60000});
 await page.waitForTimeout(800);// espera fixa: "nada acontece em 0,8 s" — a mensagem vetada sai uma vez só
 assert.deepEqual(sent(log),['guardada e vetada'],'uma vez só');
 assert.deepEqual(errors,[]);
});
console.log('SEND OFFLINE PASSED: enviar desligado liga o tutor e guarda; três mensagens saem uma vez e na ordem; Cancelar e "sem resposta" mantêm a guardada; Chamar de novo entrega; fechar e reabrir não perde (recuperada, sem envio automático); fila vetada é segurada com saída.');
console.log('capturas em',out);
