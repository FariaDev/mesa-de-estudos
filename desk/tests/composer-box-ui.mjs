// node tests/composer-box-ui.mjs — caixa de mensagem única (ticket #15), na janela.
// Cobre cada critério de aceitação: uma caixa só (anexos, campo, fileira); a
// captura do Conferir como anexo removível; Referências com estado visível e a
// linha "Vai junto" acompanhando; edição do contexto de estudo pela linha;
// Enviar virando Parar; fila, rascunho e anexos guardados; balão do usuário e
// texto corrido do tutor; as flags do config.json; nada estourando em 900×650.
// Grava capturas (claro/escuro, 1440×900 e 900×650) para olho humano.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
 withArtifacts,newRuntime,seedCourse,writeConfigJson,writeDeskJson,launchDesk,statusOnline,tinyPdf,PLOT_PNG,captureFixtureEnv,
 reviewShot,screenshotDirectory,setTheme,freezeMotion,toastWait,sendEnabled,sessionIds,openSessionById,resizeWindow
} from './helpers.mjs';
import {layoutStable,nextFrames,pollUntil} from './waits.mjs';

const out=screenshotDirectory('composer-box');
const size=(app,page,width,height)=>resizeWindow(app,page,width,height);
const rect=(page,selector)=>page.evaluate(sel=>{const el=document.querySelector(sel);if(!el)return null;const b=el.getBoundingClientRect();return {top:b.top,bottom:b.bottom,left:b.left,right:b.right,width:b.width,height:b.height};},selector);
const inside=(box,outer,note)=>{
 assert.ok(box,`${note}: medido`);
 assert.ok(box.left>=outer.left-0.5&&box.top>=outer.top-0.5&&box.right<=outer.right+0.5&&box.bottom<=outer.bottom+0.5,`${note}: dentro de ${JSON.stringify(outer)} (${JSON.stringify(box)})`);
};
const PNG={name:'plot.png',mimeType:'image/png',buffer:Buffer.from(PLOT_PNG,'base64')};
const CAPTURE_URL='data:image/png;base64,'+PLOT_PNG;
const line=page=>page.locator('#context-summary').textContent().then(text=>text.trim());

await withArtifacts('composer-box',async ctx=>{
 const runtime=ctx.runtime=newRuntime('composerbox');
 const course=seedCourse(runtime,'calc');
 const pdf=path.join(course,'Limites.pdf');fs.writeFileSync(pdf,tinyPdf('Limites e derivadas'));
 const formulas=path.join(course,'Formulario.pdf');fs.writeFileSync(formulas,tinyPdf('Formulas'));
 const logFile=path.join(runtime,'queue.log');
 const other=path.join(runtime,'pi-1700000001000.jsonl');
 fs.writeFileSync(other,JSON.stringify({type:'message',message:{role:'user',content:[{type:'text',text:'outra sessão'}],timestamp:1700000001000}})+'\n');
 const first=path.join(runtime,'pi-1700000002000.jsonl');
 fs.writeFileSync(first,JSON.stringify({type:'message',message:{role:'user',content:[{type:'text',text:'sessão corrente'}],timestamp:1700000002000}})+'\n');
 /* Uma segunda matéria: durante a resposta a aba dela trava (com a dica) e a da atual fica livre (#42). */
 const other2=seedCourse(runtime,'fis');
 writeConfigJson(runtime,{runtimePath:runtime,vaultPath:runtime,courses:[{id:'calc',name:'Cálculo I',path:course},{id:'fis',name:'Física',path:other2}]});
 writeDeskJson(runtime,{courseId:'calc',session:first,courseStates:{calc:{session:first,sessions:[{path:first,started:1700000002000},{path:other,started:1700000001000}],pdfs:[{path:pdf,page:4},{path:formulas,page:1}],study:{title:'',xopp:''}}}});
 const env=captureFixtureEnv(runtime,{FAKE_PI_QUEUE_LOG:logFile,FAKE_PI_QUEUE_HOLD_MS:'3000'});
 let app=ctx.app=await launchDesk({runtime,env});
 let page=await app.firstWindow();
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await size(app,page,1440,900);
 await statusOnline(page);
 await freezeMotion(page);
 const entries=()=>{try{return fs.readFileSync(logFile,'utf8').trim().split('\n').filter(Boolean).map(l=>JSON.parse(l));}catch{return [];}};
 const sentLines=()=>entries().map(entry=>String(entry.message||'').split('\n')[0]);
 const waitSent=async(text,timeout=30000)=>{
  await pollUntil(()=>sentLines(),lines=>lines.includes(text),{timeout,interval:100,what:`«${text}» chegar ao Pi`});
 };
 const busy=()=>page.waitForFunction(()=>!document.querySelector('#stop').hidden,undefined,{timeout:15000});
 const idle=()=>page.waitForFunction(()=>document.querySelector('#stop').hidden,undefined,{timeout:60000});
 const stubCapture=()=>app.evaluate(({ipcMain},url)=>{ipcMain.removeHandler('capture-ready');ipcMain.handle('capture-ready',async()=>({title:'Xournal++',dataUrl:url}));},CAPTURE_URL);
 await stubCapture();

 /* ---------- 1. uma caixa só: anexos, campo e fileira; nada solto em volta ---------- */
 const parts=await page.evaluate(()=>{
  const box=document.querySelector('#composer-box');
  const kids=[...box.children].map(el=>el.id||el.className);
  return {
   kids,
   inBox:['#attachments','#prompt','.composer-actions','#attach','#include-refs','#check','#send','#stop'].filter(sel=>!box.querySelector(sel)),
   hint:!!document.querySelector('#composer-hint'),
   refsState:!!document.querySelector('#refs-state'),
   refsPop:!!document.querySelector('#refs-pop'),
   summaryInBox:box.contains(document.querySelector('#context-summary')),
   studyVisibleAtRest:(()=>{const el=document.querySelector('#study-context');const b=el.getBoundingClientRect();return b.width>0&&b.height>0;})(),
  };
 });
 assert.deepEqual(parts.kids,['mention-chips','attachments','prompt','composer-actions'],'a caixa tem chips das ferramentas (#53), anexos, campo e fileira, nessa ordem');
 assert.deepEqual(parts.inBox,[],'anexar, Referências, Conferir e Enviar/Parar moram dentro da caixa');
 assert.equal(parts.hint,false,'a dica de atalhos saiu da tela principal');
 assert.equal(parts.refsState,false,'a etiqueta de estado das referências saiu (a linha Vai junto a substitui)');
 assert.equal(parts.refsPop,false,'o popover antigo das referências saiu');
 assert.equal(parts.summaryInBox,false,'a linha Vai junto fica acima da caixa, não dentro');
 assert.equal(parts.studyVisibleAtRest,false,'lista/questão e rascunho não ficam soltos: só aparecem pela linha');
 const lineBox=await rect(page,'#goes-along'),boxBox=await rect(page,'#composer-box');
 assert.ok(lineBox.bottom<=boxBox.top+0.5,'a linha Vai junto está acima da caixa');
 // a fileira: ordem e alinhamento
 const order=await page.evaluate(()=>['#attach','#include-refs','#check','#send'].map(sel=>document.querySelector(sel).getBoundingClientRect().left));
 assert.deepEqual([...order].sort((a,b)=>a-b),order,'Anexar, Referências, Conferir e Enviar, da esquerda para a direita');
 assert.equal(await page.locator('#send').getAttribute('class'),'primary','Enviar é a ação principal (acento)');
 assert.equal(await page.locator('#stop').isHidden(),true,'Parar não aparece com o tutor livre');
 await reviewShot(page,out,'caixa-vazia-claro-1440.png');

 /* ---------- 2. Vai junto: materiais, página e contexto; Referências liga/desliga ---------- */
 let text=await line(page);
 assert.match(text,/^Vai junto: /);
 assert.match(text,/Cálculo I/,'a matéria vai junto');
 assert.match(text,/Limites\.pdf p\.\d+/,'o material e a página vão junto');
 assert.match(text,/Formulario\.pdf p\.\d+/,'o segundo material vai junto');
 const refs=page.locator('#include-refs');
 assert.equal(await refs.getAttribute('aria-pressed'),'true','Referências começa ligado');
 const onLook=await refs.evaluate(el=>{const s=getComputedStyle(el);return {bg:s.backgroundColor,fg:s.color};});
 await refs.click();
 assert.equal(await refs.getAttribute('aria-pressed'),'false','Referências desligado');
 const offLook=await refs.evaluate(el=>{const s=getComputedStyle(el);return {bg:s.backgroundColor,fg:s.color};});
 assert.notDeepEqual(offLook,onLook,'o estado ligado/desligado é visível no botão');
 const shape=await refs.evaluate(el=>getComputedStyle(el).borderTopColor);
 assert.notEqual(shape,'rgba(0, 0, 0, 0)','desligado ganha contorno: a forma muda, não só a cor');
 assert.equal(await refs.getAttribute('aria-label'),'Referências','o nome acessível não depende do rótulo visível');
 text=await line(page);
 assert.match(text,/Referências desligadas/,'a linha diz que as referências estão desligadas');
 assert.doesNotMatch(text,/Limites\.pdf/,'desligado, nenhum material vai junto');
 await refs.click();
 assert.match(await line(page),/Limites\.pdf p\.\d+/,'ligado de novo, os materiais voltam à linha');
 // a linha acompanha a página do leitor
 await page.evaluate(async()=>{const state=await import('./src/state.mjs');state.S.panels[0].page=7;state.updateContextSummary();});
 assert.match(await line(page),/Limites\.pdf p\.7/,'a linha acompanha a página');
 await page.evaluate(async()=>{const state=await import('./src/state.mjs');state.S.panels[0].page=1;state.updateContextSummary();});

 /* ---------- 3. o contexto de estudo se edita pela linha ---------- */
 const edit=page.locator('#context-edit');
 assert.equal(await edit.isVisible(),true,'a linha oferece editar o contexto');
 assert.equal(await page.locator('#context-pop').isHidden(),true);
 await edit.click();
 await page.locator('#context-pop').waitFor({state:'visible'});
 assert.equal(await edit.getAttribute('aria-expanded'),'true');
 assert.equal(await page.evaluate(()=>document.activeElement?.id),'exercise-title','o foco cai no campo da lista/questão');
 await page.locator('#exercise-title').fill('Lista 3 q.2');
 assert.match(await line(page),/Lista 3 q\.2/,'a linha mostra a questão ativa na hora');
 assert.match(await page.locator('#context-pop-refs').textContent(),/Vai o caminho e a página.*captura do Conferir/,'a nota explica referências × captura');
 assert.equal(await page.locator('#pick-xopp').isVisible(),true,'o rascunho .xopp se associa pelo mesmo popover');
 await reviewShot(page,out,'edicao-contexto-claro-1440.png');
 // Esc fecha o popover e não toca no turno
 await page.keyboard.press('Escape');
 await page.locator('#context-pop').waitFor({state:'hidden'});
 assert.equal(await edit.getAttribute('aria-expanded'),'false');
 assert.equal(await page.evaluate(()=>document.activeElement?.id),'context-edit','o foco volta ao botão da linha');
 // o contexto editado chega ao desk.json
 const saved=await page.evaluate(async()=>{const state=await import('./src/state.mjs');return state.studySnapshot();});
 assert.equal(saved.title,'Lista 3 q.2','o contexto editado é o contexto de estudo da sessão');

 /* ---------- 4. a captura do Conferir é um anexo removível ---------- */
 await page.locator('#check').click();
 await page.waitForSelector('#composer-box #attachments:not([hidden]) .attachment');
 assert.equal(await page.locator('#composer-box #attachments .attachment').count(),1,'a captura entra como anexo na caixa');
 await page.locator('#prompt').fill('olha o passo 3');
 await reviewShot(page,out,'anexo-e-texto-claro-1440.png');
 await page.locator('#attachments .attachment-remove').first().click();
 await page.waitForFunction(()=>document.querySelector('#attachments').hidden);
 assert.equal(await page.locator('#attachments .attachment').count(),0,'a captura se remove antes de enviar');
 assert.equal(await page.locator('#prompt').inputValue(),'olha o passo 3','remover o anexo não toca no texto');
 // anexar pelo clipe também entra na caixa
 await page.locator('#attach-input').setInputFiles(PNG);
 await page.waitForSelector('#composer-box #attachments:not([hidden]) .attachment');
 await page.locator('#attachments .attachment-remove').first().click();
 await page.waitForFunction(()=>document.querySelector('#attachments').hidden);
 await page.locator('#prompt').fill('');

 /* ---------- 5. Enviar vira Parar, no mesmo lugar, e Parar para a resposta ---------- */
 const sendSlot=await rect(page,'#send');
 await page.locator('#prompt').fill('pergunta um');
 await page.locator('#send').click();
 await busy();
 assert.equal(await page.locator('#send').isHidden(),true,'durante a resposta Enviar some');
 const stopSlot=await rect(page,'#stop');
 assert.ok(Math.abs(stopSlot.right-sendSlot.right)<=1,`Parar ocupa o lugar do Enviar (${stopSlot.right} × ${sendSlot.right})`);
 assert.ok(Math.abs(stopSlot.top-sendSlot.top)<=1,'Parar fica na mesma linha');
 assert.equal(await page.locator('#stop').getAttribute('class'),null,'Parar não leva a classe de acento');
 assert.equal(await page.locator('#stop').innerText().then(t=>t.trim()),'Parar');
 /* A dica do Parar lembra que a caixa segue livre durante a resposta (#23). */
 await page.locator('#stop').hover();
 await page.waitForFunction(()=>{const tip=document.querySelector('.tip');return tip&&!tip.hidden&&getComputedStyle(tip).opacity!=='0'&&tip.textContent.trim();},undefined,{timeout:5000});
 const stopTip=await page.locator('.tip').first().textContent();
 assert.match(stopTip,/Parar a resposta/,'o balão do Parar diz o que ele faz');
 assert.match(stopTip,/escrever e enviar enquanto/,`o balão do Parar diz que dá para escrever e enviar durante a resposta (${stopTip})`);
 await page.mouse.move(2,2);
 await reviewShot(page,out,'respondendo-claro-1440.png');
 /* ---------- 6. fila: a mensagem enfileirada na resposta é entregue depois ---------- */
 await page.locator('#prompt').fill('segunda na fila');
 await page.locator('#prompt').press('Enter');
 await page.waitForSelector('#composer-box .queue-strip');
 assert.equal(await page.locator('.queue-label').textContent(),'Na fila','a faixa da fila abre dentro da caixa');
 assert.deepEqual(await page.locator('.queue-item span').allTextContents(),['segunda na fila']);
 assert.equal(await page.locator('#prompt').inputValue(),'','enfileirar esvazia o campo');
 await reviewShot(page,out,'com-fila-claro-1440.png');
 assert.ok(!sentLines().includes('segunda na fila'),'nada vai ao Pi antes do fim do turno');
 await waitSent('segunda na fila');
 await page.waitForFunction(()=>!document.querySelector('.queue-strip'),undefined,{timeout:60000});
 await idle();
 assert.equal(await page.locator('#send').isVisible(),true,'terminada a resposta, Enviar volta');
 const bubbles=await page.locator('#messages .message.user .body').allTextContents();
 assert.ok(bubbles.some(t=>t.includes('segunda na fila')),'a mensagem da fila foi entregue e aparece na sessão');
 await sendEnabled(page);

 /* parar a resposta pelo Parar */
 await page.locator('#prompt').fill('pergunta para parar');
 await page.locator('#send').click();
 await busy();
 await page.locator('#stop').click();
 await idle();
 assert.equal(await page.locator('#send').isVisible(),true,'Parar parou a resposta e devolveu o Enviar');
 await sendEnabled(page);

 /* a fila segurada sobrevive a trocar de sessão e voltar */
 await page.locator('#prompt').fill('fila da corrente');
 await page.locator('#send').click();
 await busy();
 await page.locator('#prompt').fill('segue guardada');
 await page.locator('#prompt').press('Enter');
 await page.waitForSelector('.queue-item');
 await page.locator('#stop').click();
 await toastWait(page,'a fila ficou segurada');
 await idle();
 const ids=await sessionIds(page);
 const otherId=ids.find(id=>id.endsWith('pi-1700000001000.jsonl'));
 assert.ok(otherId,'a outra sessão aparece na lista');
 await openSessionById(page,otherId);
 await page.waitForFunction(()=>!document.querySelector('.queue-strip'),undefined,{timeout:30000});
 await statusOnline(page);
 await openSessionById(page,first);
 await page.waitForFunction(()=>!!document.querySelector('.queue-item'),undefined,{timeout:30000});
 await statusOnline(page);
 assert.deepEqual(await page.locator('.queue-item span').allTextContents(),['segue guardada'],'a fila volta com a sessão');
 await page.locator('.queue-send-now').click();
 await waitSent('segue guardada');
 await idle();
 await sendEnabled(page);

 /* ---------- 7. balão do usuário; resposta do tutor em texto corrido ---------- */
 const shapes=await page.evaluate(()=>{
  const user=document.querySelector('#messages .message.user .body');
  const tutor=document.querySelector('#messages .message:not(.user) .body');
  const pick=el=>{const s=getComputedStyle(el);return {bg:s.backgroundColor,border:parseFloat(s.borderTopWidth),radius:parseFloat(s.borderTopLeftRadius),pad:parseFloat(s.paddingLeft)};};
  return {user:user&&pick(user),tutor:tutor&&pick(tutor)};
 });
 assert.ok(shapes.user&&shapes.tutor,'há uma fala de cada lado');
 assert.ok(shapes.user.border>=1&&shapes.user.radius>=8&&shapes.user.bg!=='rgba(0, 0, 0, 0)','a mensagem do usuário é um balão (fundo, borda e canto)');
 assert.ok(shapes.tutor.border===0&&shapes.tutor.bg==='rgba(0, 0, 0, 0)','a resposta do tutor é texto corrido (sem fundo nem borda)');
 const aligned=await page.evaluate(()=>{
  const user=document.querySelector('#messages .message.user .body').getBoundingClientRect();
  const tutor=document.querySelector('#messages .message:not(.user) .body').getBoundingClientRect();
  const col=document.querySelector('#messages').getBoundingClientRect();
  return {userRight:user.right,tutorLeft:tutor.left,colLeft:col.left,colRight:col.right};
 });
 assert.ok(aligned.userRight>aligned.colRight-40,'o balão do usuário encosta à direita');
 assert.ok(aligned.tutorLeft<aligned.colLeft+40,'a resposta do tutor começa à esquerda, na largura da coluna');
 await reviewShot(page,out,'sessao-claro-1440.png');

 /* ---------- 8. rascunho e anexos guardados sobrevivem a fechar e reabrir ---------- */
 await page.locator('#prompt').fill('rascunho guardado');
 await page.locator('#attach-input').setInputFiles(PNG);
 await page.waitForSelector('#attachments .attachment');
 await page.waitForTimeout(900);// espera fixa: debounce de gravação do rascunho e dos anexos antes de fechar o app (sem estado observável)
 await app.close();
 app=ctx.app=await launchDesk({runtime,env});
 page=await app.firstWindow();
 page.on('pageerror',error=>errors.push(error.message));
 await size(app,page,1440,900);
 await statusOnline(page);
 await freezeMotion(page);
 await stubCapture();
 assert.equal(await page.locator('#prompt').inputValue(),'rascunho guardado','o rascunho volta');
 assert.equal(await page.locator('#composer-box #attachments .attachment').count(),1,'o anexo guardado volta, dentro da caixa');
 await page.locator('#attachments .attachment-remove').first().click();
 await page.locator('#prompt').fill('');

 /* ---------- 9. medidas: nada estoura, nos dois temas e tamanhos ---------- */
 await page.evaluate(async()=>{const state=await import('./src/state.mjs');state.applyStudy({title:'Lista 3 q.2',xopp:'/tmp/Rascunho da lista com nome comprido.xopp'});});
 await page.locator('#attach-input').setInputFiles(PNG);
 await page.waitForSelector('#attachments .attachment');
 await page.locator('#prompt').fill('Uma pergunta um pouco mais longa para ver a caixa com texto e anexo ao mesmo tempo.');
 for(const [theme,width,height] of [['light',1440,900],['dark',1440,900],['light',900,650],['dark',900,650]]){
  await setTheme(page,theme);
  await size(app,page,width,height);
  await layoutStable(page,'#messages');
  const tag=`${theme}-${width}x${height}`;
  const viewport={left:0,top:0,right:width,bottom:height};
  const scroll=await page.evaluate(()=>({sw:document.documentElement.scrollWidth,w:innerWidth}));
  assert.ok(scroll.sw<=scroll.w+1,`${tag}: sem rolagem horizontal da página`);
  await page.evaluate(()=>{for(const sel of ['#messages','#chat']){const el=document.querySelector(sel);el.scrollTop=el.scrollHeight;}});
  await nextFrames(page);
  const boxRect=await rect(page,'#composer-box');
  inside(boxRect,viewport,`${tag} caixa`);
  for(const id of ['#attach','#include-refs','#check','#send','#prompt','#context-summary','#context-edit']){
   const box=await rect(page,id);
   inside(box,id==='#context-summary'||id==='#context-edit'?viewport:boxRect,`${tag} ${id}`);
  }
  const row=await page.evaluate(()=>{
   const el=document.querySelector('.composer-actions');
   const kids=[...el.children].filter(k=>!k.hidden&&k.getBoundingClientRect().width>0);
   const lefts=kids.map(k=>k.getBoundingClientRect());
   return {over:el.scrollWidth-el.clientWidth,overlap:lefts.some((a,i)=>i&&a.left<lefts[i-1].right-0.5),labels:kids.map(k=>k.getAttribute('aria-label')||k.innerText.trim())};
  });
  assert.ok(row.over<=1,`${tag}: a fileira de ações não estoura (${row.over}px)`);
  assert.equal(row.overlap,false,`${tag}: os botões da fileira não se sobrepõem`);
  const nameOf=async sel=>page.locator(sel).evaluate(el=>(el.getAttribute('aria-label')||el.innerText||'').trim());
  assert.ok((await nameOf('#attach')).length>0,`${tag}: Anexar tem nome acessível`);
  assert.match(await nameOf('#check'),/Conferir/,`${tag}: Conferir segue nomeado`);
  const lineOver=await page.evaluate(()=>{const el=document.querySelector('#goes-along');return el.scrollWidth-el.clientWidth;});
  assert.ok(lineOver<=1,`${tag}: a linha Vai junto cabe (corta com reticências)`);
  /* Quando falta espaço a linha corta primeiro o nome da matéria, que guarda um
     piso e corta com reticências; a lista/questão e a página só perdem o fim
     depois que o nome chegou ao piso (#23, #27 B1). */
  const longCourse='Cálculo Diferencial e Integral Avançado — Turma da Manhã';
  await page.evaluate(async name=>{const state=await import('./src/state.mjs');state.S.activeCourseName=name;state.updateContextSummary();},longCourse);
  const cut=await page.evaluate(()=>{
   const box=document.querySelector('#context-summary');
   const part=sel=>{const el=box.querySelector(sel);return el?{text:el.textContent,client:el.clientWidth,scroll:el.scrollWidth}:null;};
   return {text:box.textContent,lead:part('.goes-lead'),course:part('.goes-course'),sep:part('.goes-sep'),rest:part('.goes-rest'),over:box.scrollWidth-box.clientWidth,boxW:box.clientWidth};
  });
  assert.ok(cut.text.startsWith(`Vai junto: ${longCourse} · Lista 3 q.2 · Rascunho da lista com nome comprido.xopp · Limites.pdf p.`),`${tag}: o texto da linha segue o mesmo, só a forma muda (${cut.text})`);
  assert.ok(cut.lead&&cut.course&&cut.rest,`${tag}: a linha tem partes (Vai junto, matéria, o resto)`);
  assert.equal(cut.lead.scroll<=cut.lead.client,true,`${tag}: "Vai junto:" nunca é cortado`);
  assert.ok(cut.course.scroll>cut.course.client,`${tag}: o nome longo da matéria é o que corta (${JSON.stringify(cut.course)})`);
  assert.ok(cut.rest.scroll<=cut.rest.client||cut.course.client>=30,`${tag}: lista/questão e página só cortam depois do nome da matéria chegar ao piso (${JSON.stringify(cut)})`);
  assert.ok(cut.course.client>=30,`${tag}: o nome da matéria nunca some, guarda um piso (${JSON.stringify(cut.course)})`);
  assert.ok(cut.over<=1,`${tag}: a linha continua cabendo`);
  /* Sem espaço, o nome fica no piso com reticências ("Cál…"), o separador
     continua depois dele e a lista/questão ainda aparece (#27 B1). */
  const squeezed=await page.evaluate(()=>{
   const box=document.querySelector('#context-summary');
   const lead=box.querySelector('.goes-lead');
   box.style.width=`${lead.getBoundingClientRect().width+120}px`;
   const part=sel=>{const el=box.querySelector(sel);return el?{client:el.clientWidth,scroll:el.scrollWidth}:null;};
   const out={course:part('.goes-course'),sep:part('.goes-sep'),rest:part('.goes-rest')};
   box.style.width='';
   return out;
  });
  assert.ok(squeezed.course&&squeezed.sep&&squeezed.rest,`${tag}: matéria, separador e resto existem como partes`);
  assert.ok(squeezed.course.client>=30&&squeezed.course.scroll>squeezed.course.client,`${tag}: sem espaço, o nome da matéria fica no piso e corta com reticências (${JSON.stringify(squeezed)})`);
  assert.ok(squeezed.sep.client>0,`${tag}: o separador segue colado ao nome (${JSON.stringify(squeezed)})`);
  assert.ok(squeezed.rest.client>0,`${tag}: a lista/questão ainda aparece (${JSON.stringify(squeezed)})`);
  await page.evaluate(async()=>{const state=await import('./src/state.mjs');state.S.activeCourseName='Cálculo I';state.updateContextSummary();});
  await reviewShot(page,out,`anexo-e-texto-${tag}.png`);
  // edição do contexto aberta
  await page.locator('#context-edit').click();
  await page.locator('#context-pop').waitFor({state:'visible'});
  inside(await rect(page,'#context-pop'),viewport,`${tag} popover do contexto`);
  const painted=await page.evaluate(()=>{
   const pop=document.querySelector('#context-pop'),b=pop.getBoundingClientRect();
   const hit=(x,y)=>pop.contains(document.elementFromPoint(x,y));
   return {topLeft:hit(b.left+6,b.top+6),topRight:hit(b.right-6,b.top+6),bottomLeft:hit(b.left+6,b.bottom-6),bottomRight:hit(b.right-6,b.bottom-6),title:pop.contains(document.querySelector('#exercise-title'))&&document.elementFromPoint(document.querySelector('#exercise-title').getBoundingClientRect().left+8,document.querySelector('#exercise-title').getBoundingClientRect().top+8)===document.querySelector('#exercise-title')};
  });
  const xopp=await page.locator('#pick-xopp').evaluate(el=>({overflow:getComputedStyle(el).textOverflow,display:getComputedStyle(el).display}));
  assert.deepEqual(xopp,{overflow:'ellipsis',display:'block'},`${tag}: o nome do rascunho corta com reticências, não pelos dois lados`);
  assert.deepEqual(painted,{topLeft:true,topRight:true,bottomLeft:true,bottomRight:true,title:true},`${tag}: o popover aparece inteiro (nada o corta nem o cobre)`);
  const popInner=await page.evaluate(()=>{const pop=document.querySelector('#context-pop');return [...pop.querySelectorAll('input,button')].map(el=>{const b=el.getBoundingClientRect(),p=pop.getBoundingClientRect();return b.right<=p.right+0.5&&b.left>=p.left-0.5;});});
  assert.ok(popInner.every(Boolean),`${tag}: os campos cabem no popover`);
  await reviewShot(page,out,`edicao-contexto-${tag}.png`);
  await page.keyboard.press('Escape');
  await page.locator('#context-pop').waitFor({state:'hidden'});
 }
 // colunas do tutor estreitas (a divisória no mínimo)
 await size(app,page,900,650);
 await page.evaluate(()=>document.documentElement.style.setProperty('--chat','310px'));
 await layoutStable(page,'#composer-box');
 const narrow=await page.evaluate(()=>{const el=document.querySelector('.composer-actions');return {over:el.scrollWidth-el.clientWidth,boxW:document.querySelector('#composer-box').getBoundingClientRect().width};});
 assert.ok(narrow.over<=1,`coluna de 310px: a fileira não estoura (${narrow.over}px, caixa ${narrow.boxW}px)`);
 await page.evaluate(()=>document.documentElement.style.removeProperty('--chat'));

 /* ---------- 10. resposta em andamento e fila, nos dois temas em 900×650 ---------- */
 await page.locator('#attachments .attachment-remove').first().click();
 await page.locator('#prompt').fill('');
 await sendEnabled(page);
 await page.locator('#prompt').fill('pergunta para a captura');
 await page.locator('#send').click();
 await busy();
 await page.locator('#prompt').fill('na fila para a captura');
 await page.locator('#prompt').press('Enter');
 await page.waitForSelector('.queue-item');
 for(const [theme,width,height] of [['light',900,650],['dark',900,650],['dark',1440,900],['light',1440,900]]){
  await setTheme(page,theme);
  await size(app,page,width,height);
  await layoutStable(page,'#messages');
  const tag=`${theme}-${width}x${height}`;
  await page.evaluate(()=>{for(const sel of ['#messages','#chat']){const el=document.querySelector(sel);el.scrollTop=el.scrollHeight;}});
  /* #42 (1): durante a resposta a aba da outra matéria e o Conferir seguem
     travados, mas legíveis — cor --muted, sem opacidade — e dizem por quê (a
     dica do núcleo). A aba da matéria atual não trava. */
  const lock=await page.evaluate(()=>{
   const probe=document.createElement('span');probe.style.color='var(--muted)';document.querySelector('#composer').append(probe);
   const muted=getComputedStyle(probe).color;probe.remove();
   const tip=el=>el.getAttribute('title')||el.dataset.tip||'';
   const look=el=>{const cs=getComputedStyle(el);return {disabled:el.disabled,opacity:cs.opacity,color:cs.color,tip:tip(el)};};
   const compact=document.querySelector('header').classList.contains('tabs-compact');
   return {muted,compact,other:look(document.querySelector('#course-tabs button[data-id="fis"]')),otherOption:look(document.querySelector('#course-pop button[data-id="fis"]')),current:look(document.querySelector('#course-tabs button[data-id="calc"]')),check:look(document.querySelector('#check'))};
  });
  const other=lock.compact?lock.otherOption:lock.other;
  assert.equal(other.disabled,true,`${tag}: a outra matéria trava durante a resposta`);
  assert.equal(other.tip,'Espere a resposta terminar para trocar de matéria',`${tag}: a aba travada diz por quê`);
  if(!lock.compact){
   assert.equal(other.opacity,'1',`${tag}: a aba travada não fica apagada`);
   assert.equal(other.color,lock.muted,`${tag}: a aba travada fica em --muted`);
   assert.equal(lock.current.disabled,false,`${tag}: a aba da matéria atual não trava`);
  }else assert.equal(lock.otherOption.color,lock.muted,`${tag}: a opção travada fica em --muted`);
  assert.equal(lock.check.disabled,true,`${tag}: o Conferir trava durante a resposta`);
  assert.equal(lock.check.opacity,'1',`${tag}: o Conferir não fica apagado`);
  assert.equal(lock.check.color,lock.muted,`${tag}: o Conferir fica em --muted`);
  assert.equal(lock.check.tip,'Espere a resposta terminar para conferir',`${tag}: o Conferir diz por quê`);
  /* #42 (7): "Pensando…", a linha "Vai junto" e a caixa começam na mesma margem. */
  const edges=await page.evaluate(()=>{
   const left=sel=>{const el=document.querySelector(sel);if(!el)return null;const r=el.getBoundingClientRect();return r.width>0?r.left:null;};
   /* Onde o conteúdo da linha de atividade começa (borda + recuo): vale com
      "Pensando…" na tela ou entre dois passos, quando ela está vazia. */
   const act=document.querySelector('#activity');
   const start=act.getBoundingClientRect().left+parseFloat(getComputedStyle(act).paddingLeft);
   const text=left('#activity .pulse')??left('#activity .activity-label');
   return {activity:start,activityText:text,goes:left('#context-summary > :first-child')??left('#context-summary'),box:left('#composer-box'),column:left('#sidebar')};
  });
  if(edges.activityText!==null)assert.ok(Math.abs(edges.activityText-edges.activity)<=0.6,`${tag}: "Pensando…" começa no recuo da linha`);
  assert.ok(Math.abs(edges.activity-edges.box)<=0.6&&Math.abs(edges.goes-edges.box)<=0.6,`${tag}: atividade, "Vai junto" e caixa na mesma margem (${JSON.stringify(edges)})`);
  const boxRect=await rect(page,'#composer-box');
  inside(boxRect,{left:0,top:0,right:width,bottom:height},`${tag} caixa com fila`);
  const queueGap=await page.evaluate(()=>{
   const box=document.querySelector('#composer-box').getBoundingClientRect();
   const label=document.querySelector('#composer-box .queue-label').getBoundingClientRect();
   const field=document.querySelector('#composer-box #prompt');
   const fieldLeft=field.getBoundingClientRect().left+parseFloat(getComputedStyle(field).paddingLeft);
   return {top:label.top-box.top,left:label.left-fieldLeft};
  });
  assert.ok(queueGap.top>=8,`${tag}: a fila respira dentro da caixa (${queueGap.top}px do topo)`);
  assert.ok(Math.abs(queueGap.left)<=3,`${tag}: a fila alinha com o texto do campo (${queueGap.left}px)`);
  const over=await page.evaluate(()=>{const el=document.querySelector('.composer-actions');return el.scrollWidth-el.clientWidth;});
  assert.ok(over<=1,`${tag}: respondendo, com fila, a fileira não estoura`);
  await reviewShot(page,out,`respondendo-com-fila-${tag}.png`);
 }
 await page.locator('#stop').click();
 await idle();

 assert.deepEqual(errors,[],`erros de página: ${JSON.stringify(errors)}`);
});

/* ---------- 11. as flags do config.json somem com os controles ---------- */
await withArtifacts('composer-box-flags',async ctx=>{
 const runtime=ctx.runtime=newRuntime('composerflags');
 const course=seedCourse(runtime,'calc');
 const pdf=path.join(course,'Limites.pdf');fs.writeFileSync(pdf,tinyPdf('Limites'));
 writeConfigJson(runtime,{runtimePath:runtime,vaultPath:runtime,courses:[{id:'calc',name:'Cálculo I',path:course}],desk:{refsToggle:false,conferir:false,studyContext:false}});
 writeDeskJson(runtime,{courseId:'calc',courseStates:{calc:{pdfs:[{path:pdf,page:2}],study:{title:'Lista oculta',xopp:''}}}});
 const app=ctx.app=await launchDesk({runtime});
 const page=await app.firstWindow();
 await size(app,page,900,650);
 await statusOnline(page);
 await freezeMotion(page);
 assert.equal(await page.locator('#include-refs').isHidden(),true,'refsToggle desligado esconde Referências');
 assert.equal(await page.locator('#check').isHidden(),true,'conferir desligado esconde Conferir');
 assert.equal(await page.locator('#context-edit').isHidden(),true,'studyContext desligado esconde a edição do contexto');
 const text=await line(page);
 assert.match(text,/Limites\.pdf p\.\d+/,'sem o botão, as referências seguem ligadas e vão junto');
 assert.doesNotMatch(text,/Lista oculta|Cálculo I/,'sem contexto de estudo, nem a questão nem a matéria vão na linha');
 assert.equal(await page.locator('#send').isVisible(),true,'a caixa segue completa com Anexar e Enviar');
 assert.equal(await page.locator('#attach').isVisible(),true);
 const over=await page.evaluate(()=>{const el=document.querySelector('.composer-actions');return el.scrollWidth-el.clientWidth;});
 assert.ok(over<=1,'a fileira com menos botões não estoura');
 await reviewShot(page,out,'flags-desligadas-900x650.png');
});
console.log('composer-box-ui: ok');
