import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {artifactDir,withArtifacts,launchDesk,newRuntime,seedCourse,seedPlot,seedSession,writeDeskJson,writeConfigJson,tinyPdf,statusOnline,PLOT_PNG,tutorMore,resizeWindow} from './helpers.mjs';
import {layoutStable,nextFrames} from './waits.mjs';

/* R3 pós-R2 — a coluna da conversa x calculadora na geometria PADRÃO real
   (1480x840, altura > 700, como o default de 1600x1020 limitado pela workArea):
   a conversa com a calculadora grande, anexo e retomada NÃO cabe na altura real
   da coluna (o painel Ajustes saiu da coluna no ticket #14: modelo e esforço
   moram no indicador do cabeçalho). Quando o conteúdo não cabe, o host liga
   `body.chat-scroll` medindo o overflow (state.mjs#syncChatScrollMode): o #chat
   vira o scroller, o #messages cresce e o composer fica sticky — em vez de o
   composer vazar por cima do #calc-form. O teste mede rect + elementFromPoint no
   centro do botão do formulário e clica de verdade para calcular; Enviar/Nova/
   Exportar/recolher continuam acessíveis; a resposta do assistente fica
   legível/rolável; e no caso padrão o #messages segue sendo o scroller (contrato
   dos hunts/smoke antigos), com atBottom/followBottom. Capturas estabilizadas em
   desk/tests/artifacts/r3-ui-<stamp>/. */

const SHOT_DIR=artifactDir(`r3-ui-${new Date().toISOString().replace(/[:.]/g,'-').replace(/Z$/,'')}`);
fs.mkdirSync(SHOT_DIR,{recursive:true});

async function stabilize(page){
 await page.addStyleTag({content:'*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}'});
 await layoutStable(page,'#messages');
}
async function shot(page,name){await stabilize(page);await page.screenshot({path:path.join(SHOT_DIR,name)});}
async function setSize(app,page,w,h){
 await resizeWindow(app,page,w,h);
 await layoutStable(page,'#messages');
}
async function hitOK(page,selector){
 // No modo adaptativo, controles fora da área visível são alcançados rolando.
 await page.locator(selector).scrollIntoViewIfNeeded();
 return page.evaluate(sel=>{const el=document.querySelector(sel);if(!el)return false;const r=el.getBoundingClientRect();if(!r.width||!r.height)return false;const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return !!hit?.closest?.(sel);},selector);
}
/* Quadro da coluna: rects, scrollers e o modo medido. */
async function frame(page){
 // Com histórico longo, mede a coluna no fim da conversa, onde fica o envio.
 await page.evaluate(async()=>{const {followBottom}=await import('./src/state.mjs');followBottom(true);});
 return page.evaluate(()=>{
  const rect=el=>{const r=el?.getBoundingClientRect();return r?{top:Math.round(r.top),bottom:Math.round(r.bottom),height:Math.round(r.height)}:null;};
  const chat=document.querySelector('#chat'),messages=document.querySelector('#messages'),composer=document.querySelector('#composer'),calc=document.querySelector('#calculator');
  return {
   iw:innerWidth,ih:innerHeight,classOn:document.body.classList.contains('chat-scroll'),
   sidebar:rect(document.querySelector('#sidebar')),chat:rect(chat),messages:rect(messages),composer:rect(composer),calc:rect(calc),
   messagesOverflowY:getComputedStyle(messages).overflowY,
   chatScroll:{sh:chat.scrollHeight,ch:chat.clientHeight},
   messagesScroll:{sh:messages.scrollHeight,ch:messages.clientHeight,st:messages.scrollTop},
   chatScrollable:chat.scrollHeight>chat.clientHeight+1,
   messagesScrollable:messages.scrollHeight>messages.clientHeight+1
  };
 });
}

await withArtifacts('r3-coluna-1480x840',async ctx=>{
 const runtime=ctx.runtime=newRuntime('r3-coluna'),course=seedCourse(runtime,'Test');
 fs.writeFileSync(path.join(course,'Limites.pdf'),tinyPdf('Exercise'));
 fs.writeFileSync(path.join(course,'Formulario.pdf'),tinyPdf('Support'));
 const plot=seedPlot(runtime,'Test');
 const records=[{type:'message',message:{role:'user',content:[{type:'text',text:'Lista 1: limites'}]}}];
 for(let i=0;i<30;i++)records.push({type:'message',message:{role:i%2?'assistant':'user',content:[{type:'text',text:`resposta ${i}: texto de estudo com o tamanho suficiente para a conversa ocupar a coluna.`}]}});
 records.push({type:'message',message:{role:'assistant',content:[{type:'text',text:`Aqui está o gráfico:\n\n![curva de teste](file://${plot})`}]}});
 const sessionFile=seedSession(runtime,records);
 writeDeskJson(runtime,{session:sessionFile,courseId:'Test'});
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'Test',name:'Teste',path:course}],desk:{pinnedExtensions:false}});
 const app=ctx.app=await launchDesk({runtime});
 const page=await app.firstWindow();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await statusOnline(page);
 await page.waitForSelector('.pdf-panel canvas',{timeout:30000});
 await setSize(app,page,1480,840);

 /* --- geometria padrão: calculadora recolhida (uma linha) -------------------
    Sem media de altura curta: o composer fica na coluna e o #messages segue
    como scroller (contrato dos hunts). */
 const base=await frame(page);
 assert.ok(base.ih>700,`janela acima da media de altura curta (innerHeight=${base.ih})`);
 assert.equal(await page.locator('#pi-settings-panel').count(),0,'não há painel Ajustes ocupando a coluna');
 assert.equal(base.messagesOverflowY,base.classOn?'visible':'auto','a conversa usa o scroller correspondente à altura disponível');
 assert.equal(await page.locator('#compact-tools').count(),0,'o contexto da sessão não ocupa a coluna (mora em Mais opções)');
 assert.ok(base.chat.bottom<=base.calc.top+1,`#chat não vaza na calculadora (chat bottom=${base.chat.bottom}, calc top=${base.calc.top})`);
 assert.equal(base.calc.height,40,'recolhida, a calculadora é a linha de 40px (--bar)');
 assert.ok(base.composer.bottom<=base.chat.bottom+1,`composer fica dentro da coluna (bottom=${base.composer.bottom}, chat=${base.chat.bottom})`);
 assert.equal(await hitOK(page,'#calc-form button'),true,'o centro do botão = pertence ao #calc-form');
 await page.locator('#expression').fill('sqrt(16)+sin(pi/2)');
 await page.locator('#calc-form button').click();
 assert.equal(await page.locator('#result').textContent(),'5','clique real calcula com a coluna apertada');
 for(const sel of ['#send','#session-title','#sidechat-toggle','#new-session','#chat-more'])assert.equal(await hitOK(page,sel),true,`${sel} acessível na coluna apertada`);
 await shot(page,'1480-840-ajustes-calc220.png');

 /* recolher e reabrir o chat no modo apertado */
 await tutorMore(page,'#chat-collapse').click();
 await page.waitForFunction(()=>document.body.classList.contains('chat-collapsed'));
 assert.equal(await page.locator('#chat-restore').isVisible(),true,'recolher deixa a affordance de reabrir');
 await page.locator('#chat-restore').click();
 await page.waitForFunction(()=>!document.body.classList.contains('chat-collapsed'));
 await layoutStable(page,'#messages');
 assert.equal((await frame(page)).classOn,base.classOn,'reabrir o chat mantém o modo de rolagem da mesma geometria');

 /* --- calculadora grande (--calc 700 clampa no teto de 70%): o painel não
    basta e a coluna inteira passa a rolar (modo medido) -------------------- */
 await page.locator('#calc-toggle').click(); // a altura --calc só vale com o painel aberto
 await page.waitForFunction(()=>document.querySelector('#calc-body').hidden===false);
 await page.evaluate(()=>document.documentElement.style.setProperty('--calc','700px'));
 await layoutStable(page,'#messages');
 const tall=await frame(page);
 assert.equal(tall.classOn,true,'calculadora grande liga o modo de rolagem medido');
 assert.ok(tall.calc.height<=tall.sidebar.height*0.71+1,`calculadora no teto de 70% (${tall.calc.height} de ${tall.sidebar.height})`);
 assert.ok(tall.chat.bottom<=tall.calc.top+1,`nada cobre a calculadora grande (chat=${tall.chat.bottom}, calc=${tall.calc.top})`);
 assert.ok(tall.composer.bottom<=tall.chat.bottom+1,'composer não invade a calculadora grande');
 assert.equal(await hitOK(page,'#calc-form button'),true,'botão = acessível com a calculadora grande');
 await page.locator('#calc-guide summary').click();
 assert.equal(await page.locator('#calc-guide').evaluate(el=>el.open),true,'guia aberta não muda o quadro');
 await page.locator('#angle button[data-angle="deg"]').click();
 await page.locator('#expression').fill('sin(30)');
 await page.locator('#calc-form button').click();
 assert.equal(await page.locator('#result').textContent(),'0,5','cálculo real com a calculadora grande');
 assert.equal(await hitOK(page,'#send'),true,'Enviar acessível com a calculadora grande');
 await shot(page,'1480-840-ajustes-calc700.png');

 /* --- anexos e cartão de retomada aumentam o composer --------------------- */
 await page.evaluate(async png=>{
  const {restoreAttachments}=await import('./src/chat.mjs');
  restoreAttachments({attachments:[{dataUrl:`data:image/png;base64,${png}`,mimeType:'image/png',name:'anexo.png'}]});
 },PLOT_PNG);
 await page.waitForFunction(()=>document.querySelector('#attachments')?.hidden===false);
 await page.evaluate(async()=>{
  const {setResumeRecord}=await import('./src/resume.mjs');
  setResumeRecord({stopped:'parei na questão 3',next:'seguir para a 4',exercise:'Lista 1'});
 });
 await page.waitForSelector('#tutor-state[data-state="resume"]',{timeout:5000});
 /* No modo de rolagem o composer é o fim do conteúdo: a conversa no fim o
    mantém à vista (é o que o followBottom garante ao receber mensagem). */
 await page.evaluate(()=>{const c=document.querySelector('#chat');if(c.scrollHeight>c.clientHeight)c.scrollTop=c.scrollHeight;});
 await nextFrames(page);
 const stress=await frame(page);
 assert.ok(stress.composer.bottom<=stress.chat.bottom+1,'composer com anexo/retomada fica dentro da coluna');
 assert.equal(await hitOK(page,'#calc-form button'),true,'botão = segue acessível com anexo e retomada');
 await shot(page,'1480-840-anexo-retomada.png');
 await page.evaluate(async()=>{const {resetAttachments}=await import('./src/chat.mjs');resetAttachments();const {setResumeRecord}=await import('./src/resume.mjs');setResumeRecord(null);});

 /* --- quando o conteúdo volta a caber, o modo normal volta ---------------
    calculadora 220: o #messages recupera o posto de scroller
    (é o contrato dos hunts/smoke antigos) e o followBottom volta a rolar nele. */
 await page.evaluate(()=>document.documentElement.style.setProperty('--calc','220px'));
 await layoutStable(page,'#messages');
 const normal=await frame(page);
 assert.equal(normal.messagesOverflowY,normal.classOn?'visible':'auto','o histórico continua rolável no modo adequado à coluna');
 assert.ok(normal.classOn?normal.chatScrollable:normal.messagesScrollable,'o histórico longo continua rolável');
 assert.ok(normal.composer.bottom<=normal.chat.bottom+1,'voltar ao normal mantém o composer dentro da coluna');
 const follow=await page.evaluate(async()=>{const {followBottom}=await import('./src/state.mjs');followBottom(true);const m=document.querySelector(document.body.classList.contains('chat-scroll')?'#chat':'#messages');return m.scrollHeight-m.scrollTop-m.clientHeight;});
 assert.ok(follow<=2,`followBottom rola o #messages no modo normal (faltou ${Math.round(follow)}px)`);

 /* --- resposta do principal com a calculadora aberta ----- */
 await page.locator('#prompt').fill('explique o teorema de Pitágoras');
 await page.locator('#send').click();
 await page.waitForSelector('#messages .message.assistant .katex',{timeout:20000});
 await page.waitForFunction(()=>!document.querySelector('#send').disabled,undefined,{timeout:20000});
 await page.evaluate(async()=>{const {followBottom}=await import('./src/state.mjs');followBottom(true);});
 await nextFrames(page);
 const resp=await frame(page);
 const last=await page.evaluate(()=>{
  const msgs=[...document.querySelectorAll('#messages .message:not(.quiz)')];
  const body=msgs.filter(el=>el.classList.contains('assistant')).at(-1)?.querySelector('.body');
  const r=body.getBoundingClientRect(),c=document.querySelector('#composer').getBoundingClientRect();
  return {text:body.textContent.slice(0,90),bottom:Math.round(r.bottom),composerTop:Math.round(c.top),top:Math.round(r.top)};
 });
 assert.match(last.text,/Pitágoras/,'a resposta do principal chega ao histórico');
 assert.ok(last.bottom<=last.composerTop+2,`a última resposta fica legível acima do composer (msg bottom=${last.bottom}, composer top=${last.composerTop})`);
 assert.equal(resp.classOn?resp.chatScrollable:resp.messagesScrollable,true,'a conversa continua rolável');
 await shot(page,'1480-840-resposta-ajustes.png');

 /* O modo de rolagem trocou de classe várias vezes (calculadora grande, anexo/
    retomada, volta ao normal): nenhuma transição pode sair como aviso de loop
    do ResizeObserver no log do renderer. O sync do observador é agendado fora
    da entrega (`state.mjs#scheduleChatScrollMode`); as chamadas explícitas
    (histórico) continuam síncronas — e o modo medido continua ligando. */
 let deskLog='';
 try{deskLog=fs.readFileSync(path.join(runtime,'desk.log'),'utf8');}catch{}
 const roLoops=deskLog.split('\n').filter(line=>line.includes('ResizeObserver loop'));
 assert.deepEqual(roLoops,[],`aviso de loop do ResizeObserver no desk.log: ${roLoops.slice(0,2).join(' | ')}`);

 assert.deepEqual(errors,[]);
 console.log('PASS: coluna 1480x840 (calculadora grande/anexo/retomada no modo de rolagem medido) sem o composer cobrir a calculadora; #messages e followBottom preservados; sem aviso de loop do ResizeObserver.');
});

console.log('Screenshots:',SHOT_DIR);
