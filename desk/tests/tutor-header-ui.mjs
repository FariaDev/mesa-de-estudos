// node tests/tutor-header-ui.mjs — cabeçalho do tutor (ticket #13): uma linha com
// título da sessão, chat lateral, sessão nova e mais opções; testado na janela.
// Cobre cada critério de aceitação e grava capturas (claro/escuro, 1440×900 e
// 900×650, com a lista, o menu de sessão nova e Mais opções abertos).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
 withArtifacts,newRuntime,seedCourse,writeConfigJson,writeDeskJson,launchDesk,statusOnline,tinyPdf,PLOT_PNG,
 reviewShot,screenshotDirectory,setTheme,freezeMotion,toastWait,sendEnabled,
 sessionTitle,currentSession,currentEngine,openSessionList,closeSessionList,sessionRows,openSessionById,
 openSessionLibrary,openNewSessionMenu,newSession,openTutorMore,tutorMore,visibleChars,resizeWindow
} from './helpers.mjs';
import {layoutStable,nextFrames} from './waits.mjs';

const out=screenshotDirectory('tutor-header');
const size=(app,page,width,height)=>resizeWindow(app,page,width,height);
const rect=(page,selector)=>page.evaluate(sel=>{const el=document.querySelector(sel);if(!el)return null;const b=el.getBoundingClientRect();return {top:b.top,bottom:b.bottom,left:b.left,right:b.right,width:b.width,height:b.height};},selector);
const inside=(box,width,height,note)=>{
 assert.ok(box,`${note}: medido`);
 assert.ok(box.left>=-0.5&&box.top>=-0.5&&box.right<=width+0.5&&box.bottom<=height+0.5,`${note}: dentro da janela ${width}×${height} (${JSON.stringify(box)})`);
};
const seedJsonl=(file,text)=>fs.writeFileSync(file,JSON.stringify({type:'message',message:{role:'user',content:[{type:'text',text}]}})+'\n');

await withArtifacts('tutor-header',async ctx=>{
 const runtime=ctx.runtime=newRuntime('tutorhead');
 const course=seedCourse(runtime,'calc');
 const pdf=path.join(course,'Limites.pdf');fs.writeFileSync(pdf,tinyPdf('Limites e derivadas'));
 const older=Date.now()-3*86400000,recent=Date.now()-86400000;
 const sessionA=path.join(runtime,`pi-${older}.jsonl`),sessionB=path.join(runtime,`pi-${recent}.jsonl`);
 seedJsonl(sessionA,'Quero estudar limites fundamentais e as suas propriedades algébricas com calma');
 seedJsonl(sessionB,'Uma dúvida sobre derivadas');
 writeConfigJson(runtime,{runtimePath:runtime,vaultPath:runtime,courses:[{id:'calc',name:'Cálculo',path:course}]});
 writeDeskJson(runtime,{courseId:'calc',session:sessionA,courseStates:{calc:{session:sessionA,sessions:[{path:sessionA,started:older},{path:sessionB,started:recent}],pdfs:[{path:pdf,page:1}],study:{title:'Limites',xopp:''}}}});
 // O fake-pi só devolve `eco: …` no modo fila; segura o turno por pouco tempo.
 const app=ctx.app=await launchDesk({runtime,env:{FAKE_PI_QUEUE_LOG:path.join(runtime,'queue.log'),FAKE_PI_QUEUE_HOLD_MS:'150'}});
 const page=await app.firstWindow();
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await size(app,page,1440,900);
 await statusOnline(page);
 await freezeMotion(page);

 /* ---------- uma linha, título da sessão, nada de seletores fixos ---------- */
 for(const gone of ['#session-select','#new-session-engine','#pi-label','#conversations-toggle','.chat-head #export-chat','.chat-head #chat-collapse','.chat-head h2']){
  assert.equal(await page.locator(gone).count(),0,`${gone} saiu do cabeçalho`);
 }
 const bar=Number.parseFloat(await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--bar')));
 assert.equal(bar,40,'a barra do painel é o token --bar de 40px');
 const head=await rect(page,'.chat-head');
 assert.ok(head.height>=bar&&head.height<=bar+2,`o cabeçalho é uma linha só (altura ${head.height})`);
 const parts={};
 for(const id of ['#session-title','#sidechat-toggle','#new-session','#chat-more'])parts[id]=await rect(page,id);
 /* #42: o indicador de modelo saiu do cabeçalho (mora na fileira da caixa de mensagem). */
 assert.equal(await page.locator('.chat-head #model-indicator').count(),0,'o indicador de modelo não está no cabeçalho');
 assert.equal(await page.locator('#composer-box .composer-actions #model-indicator').count(),1,'o indicador mora na fileira da caixa de mensagem');
 assert.ok(parts['#session-title'].left<parts['#sidechat-toggle'].left&&parts['#sidechat-toggle'].left<parts['#new-session'].left&&parts['#new-session'].left<parts['#chat-more'].left,'título, chat lateral, sessão nova e mais opções, da esquerda para a direita');
 for(const [id,box] of Object.entries(parts))assert.ok(box.top>=head.top-0.5&&box.bottom<=head.bottom+0.5,`${id} fica na linha do cabeçalho`);
 assert.match(await sessionTitle(page),/limites fundamentais/i,'o título é o da sessão atual');
 assert.doesNotMatch(await sessionTitle(page),/Claude Code|Pi/,'o título não leva o nome do motor');
 assert.equal(await currentSession(page),sessionA,'o título guarda a sessão aberta');
 /* O cabeçalho mostra o começo do título, nunca a data (#23): a data fica na lista. */
 const DATE=/\d{2}\/\d{2},\s\d{2}:\d{2}/;
 assert.doesNotMatch(await sessionTitle(page),DATE,'o título do cabeçalho não leva a data');
 assert.match(await sessionTitle(page),/^Quero estudar limites/,'o título começa pelo assunto da sessão');
 assert.ok(await visibleChars(page,'#session-title .session-title-text')>=12,'o cabeçalho mostra o começo do título, não só reticências');
 assert.equal(await page.locator('#study-pop #end-day').count(),0,'Encerrar por hoje saiu do menu Estudar');

 /* ---------- mensagens da coluna (#27 B2) ---------- */
 const bubble=await page.evaluate(()=>{
  const body=document.querySelector('#messages .message.user .body');
  if(!body)return null;
  const cs=getComputedStyle(body),column=document.querySelector('#messages').getBoundingClientRect(),box=body.getBoundingClientRect();
  const role=body.closest('.message').querySelector('.role');
  const rb=role?role.getBoundingClientRect():null;
  return {size:cs.fontSize,line:cs.lineHeight,radius:cs.borderRadius,widthShare:box.width/column.width,rightGap:column.right-box.right,
   role:role?{text:role.textContent.trim(),w:rb.width,h:rb.height}:null};
 });
 assert.ok(bubble,'há uma mensagem do usuário para medir');
 assert.equal(bubble.size,'13.5px','o balão do usuário é 13.5px');
 assert.equal(bubble.radius,'14px 14px 4px','o balão tem o canto de baixo à direita menor');
 assert.ok(bubble.widthShare<=0.851,`o balão ocupa no máximo 85% da coluna (${bubble.widthShare})`);
 assert.ok(bubble.rightGap<=24,`o balão fica à direita (${bubble.rightGap}px da borda)`);
 assert.ok(bubble.role&&bubble.role.text.length>0&&bubble.role.w<=1&&bubble.role.h<=1,`o rótulo de quem fala não aparece, mas segue no DOM (${JSON.stringify(bubble.role)})`);
 const reply=await page.evaluate(()=>{const el=document.querySelector('#messages .message:not(.user) .body, #messages .message:not(.user)');if(!el)return null;const cs=getComputedStyle(el);return {size:cs.fontSize,line:cs.lineHeight};});
 if(reply){assert.equal(reply.size,'15px','a resposta do tutor é 15px');assert.equal(Number.parseFloat(reply.line),24,'com altura de linha 1.6 (24px)');}

 /* ---------- lista de sessões; troca mantém rascunho e anexos ---------- */
 await page.locator('#prompt').fill('rascunho da sessão A');
 await page.locator('#attach-input').setInputFiles({name:'plot.png',mimeType:'image/png',buffer:Buffer.from(PLOT_PNG,'base64')});
 await page.waitForSelector('#attachments:not([hidden]) .attachment');
 const rows=await sessionRows(page);
 assert.deepEqual(rows.map(row=>row.id).sort(),[sessionA,sessionB].sort(),'a lista traz as sessões da matéria');
 assert.equal(rows.filter(row=>row.current).length,1,'uma sessão marcada como atual');
 assert.equal(rows.find(row=>row.current).id,sessionA);
 assert.ok(rows.every(row=>!/Claude Code/.test(row.title)&&!/\bPi\b/.test(row.meta)),'a lista não mostra Pi nem prefixo de motor nas sessões do motor padrão');
 /* Data e título não se repetem em linhas diferentes (#23): a data só na linha de
    meta, o título sem data, e a prévia só quando acrescenta algo. */
 for(const row of rows){
  /* #27 item 6: sem assunto, o nome é "Sessão de <data>" (duas sessões sem assunto
     não podem ser ambas "Sessão"); a data então fica no título e sai da meta. */
  const dated=/^Sessão de /.test(row.title);
  if(dated){
   assert.match(row.title,DATE,`a sessão sem assunto leva a data no nome (${row.title})`);
   assert.doesNotMatch(row.meta,DATE,'a data aparece uma vez, no nome');
  }else{
   assert.doesNotMatch(row.title,DATE,`o título da linha não repete a data (${row.title})`);
   assert.match(row.meta,DATE,'a data aparece uma vez, na linha de meta');
  }
  assert.ok(!row.preview||!row.preview.startsWith(row.title.replace(/…$/,'')),`a prévia não repete o título (${row.title} × ${row.preview})`);
 }
 await reviewShot(page,out,'lista-aberta-1440.png');
 await openSessionById(page,sessionB);
 await page.waitForFunction(id=>document.querySelector('#session-title').dataset.session===id,sessionB,{timeout:30000});
 await statusOnline(page);
 assert.match(await sessionTitle(page),/derivadas/i,'o título acompanha a sessão aberta');
 assert.equal(await page.locator('#conversations-pop').isHidden(),true,'escolher uma sessão fecha a lista');
 assert.equal(await page.locator('#prompt').inputValue(),'','a outra sessão não herda o rascunho');
 await page.locator('#prompt').fill('rascunho da sessão B');
 await openSessionById(page,sessionA);
 await page.waitForFunction(id=>document.querySelector('#session-title').dataset.session===id,sessionA,{timeout:30000});
 await statusOnline(page);
 assert.equal(await page.locator('#prompt').inputValue(),'rascunho da sessão A','o rascunho volta com a sessão');
 assert.equal(await page.locator('#attachments .attachment').count(),1,'o anexo volta com a sessão');

 /* ---------- a biblioteca de sessões continua alcançável ---------- */
 await openSessionLibrary(page);
 await page.waitForSelector('#chat-library-dialog[open]');
 await page.keyboard.press('Escape');
 await page.waitForFunction(()=>!document.querySelector('#chat-library-dialog').open);

 /* ---------- sessão nova: três itens (Pi, Claude, OpenCode da #57); Esc fecha só o menu ---------- */
 await openNewSessionMenu(page);
 assert.deepEqual(await page.locator('#new-session-pop button').allTextContents().then(list=>list.map(text=>text.trim())),['Sessão nova','Sessão nova com Claude (experimental)','Sessão nova com OpenCode (modelos grátis)']);
 assert.equal(await page.locator('#new-session').getAttribute('aria-expanded'),'true');
 await reviewShot(page,out,'sessao-nova-1440.png');
 await page.keyboard.press('Escape');
 await page.locator('#new-session-pop').waitFor({state:'hidden'});
 assert.equal(await page.locator('#new-session').getAttribute('aria-expanded'),'false');
 const before=await currentSession(page);
 await newSession(page);
 await page.waitForFunction(id=>document.querySelector('#session-title').dataset.session!==id,before,{timeout:30000});
 await statusOnline(page,{timeout:60000});
 assert.equal(await currentEngine(page),'pi','a sessão nova nasce no motor padrão');
 assert.equal((await sessionRows(page)).length,3,'a sessão nova entra na lista');
 await closeSessionList(page);
 assert.equal(await page.locator('#prompt').inputValue(),'','a sessão nova começa sem rascunho');

 /* ---------- Mais opções ---------- */
 await openTutorMore(page);
 const labels=await page.locator('#chat-more-pop > *').evaluateAll(list=>list.map(el=>el.id));
 assert.deepEqual(labels,['export-chat','end-day','more-context','more-auto-compact','more-compact-now','more-triage','chat-collapse'],'itens de Mais opções, na ordem');
 await reviewShot(page,out,'mais-opcoes-1440.png');
 await page.keyboard.press('Escape');
 await page.locator('#chat-more-pop').waitFor({state:'hidden'});

 // exportar
 await tutorMore(page,'#export-chat').click();
 await toastWait(page,'exportada',{timeout:15000});
 assert.equal(await page.locator('#chat-more-pop').isHidden(),true,'escolher uma ação fecha o menu');
 assert.equal(fs.readdirSync(path.join(runtime,'Mesa de Estudos')).filter(name=>name.endsWith('.md')).length,1,'a sessão foi exportada em Markdown');

 // Encerrar por hoje
 await tutorMore(page,'#end-day').click();
 await page.waitForSelector('#end-day-dialog[open]');
 await page.keyboard.press('Escape');
 await page.waitForFunction(()=>!document.querySelector('#end-day-dialog').open);

 // uso de contexto e compactação automática
 await page.evaluate(async()=>{const state=await import('./src/state.mjs');await state.refreshMeter();});
 await openTutorMore(page);
 assert.equal(await page.locator('#more-context-slot #ctx-meter').count(),1,'o medidor vivo mora no encaixe do menu');
 const auto=page.locator('#more-auto-compact');
 assert.equal(await auto.isDisabled(),false,'a compactação automática está disponível com o tutor ligado');
 const checked=await auto.getAttribute('aria-checked');
 await auto.click();
 await page.waitForFunction(was=>document.querySelector('#more-auto-compact').getAttribute('aria-checked')!==was,checked,{timeout:10000});
 assert.equal(await page.locator('#auto-compact').getAttribute('aria-pressed'),String(checked!=='true'),'o interruptor espelha o botão vivo da compactação');
 await page.keyboard.press('Escape');

 // recolher e reabrir: item, botão de restaurar e atalho
 await tutorMore(page,'#chat-collapse').click();
 await page.waitForFunction(()=>document.body.classList.contains('chat-collapsed'));
 await page.locator('#chat-restore').click();
 await page.waitForFunction(()=>!document.body.classList.contains('chat-collapsed'));
 await page.waitForTimeout(250);// espera fixa: o atalho tem trava de 150 ms contra repique
 await openTutorMore(page); // menu aberto + atalho: o menu não pode ficar órfão no tutor recolhido
 await page.keyboard.press('ControlOrMeta+\\');
 await page.waitForFunction(()=>document.body.classList.contains('chat-collapsed'));
 assert.equal(await page.locator('#chat-more-pop').isHidden(),true,'recolher pelo atalho fecha o menu aberto');
 await page.waitForTimeout(250);// espera fixa: o atalho tem trava de 150 ms contra repique
 await page.keyboard.press('ControlOrMeta+\\');
 await page.waitForFunction(()=>!document.body.classList.contains('chat-collapsed'));
 await openTutorMore(page);
 assert.equal(await page.locator('#chat-collapse').getAttribute('title'),'Recolher o tutor (⌘\\)','o item volta a oferecer recolher');
 await page.keyboard.press('Escape');

 /* ---------- chat lateral: o mesmo estado nos dois cabeçalhos ---------- */
 const toggle=page.locator('#sidechat-toggle');
 assert.equal(await toggle.getAttribute('aria-pressed'),'false');
 await toggle.click();
 await page.waitForSelector('#sidechat:not([hidden])');
 assert.equal(await toggle.getAttribute('aria-pressed'),'true');
 assert.equal(await page.locator('#sidechat').isVisible(),true,'o chat lateral abre ao lado do leitor');
 await toggle.click();
 await page.waitForFunction(()=>document.querySelector('#sidechat-toggle').getAttribute('aria-pressed')==='false');
 assert.equal(await page.locator('#sidechat').isHidden(),true);
 await toggle.click();
 await page.waitForFunction(()=>document.querySelector('#sidechat-toggle').getAttribute('aria-pressed')==='true');
 await page.locator('#sidechat-close').click();
 await page.waitForFunction(()=>document.querySelector('#sidechat-toggle').getAttribute('aria-pressed')==='false');

 /* ---------- Claude (experimental) no menu ---------- */
 const piSession=await currentSession(page);
 await newSession(page,{claude:true});
 await page.waitForFunction(id=>document.querySelector('#session-title').dataset.session!==id&&document.querySelector('#session-title').dataset.engine==='claude',piSession,{timeout:30000}).catch(async error=>{
  console.log('DIAG',JSON.stringify(await page.evaluate(()=>({title:{...document.querySelector('#session-title').dataset},toast:document.querySelector('#toast')?.textContent,status:document.querySelector('#status-dot').className,activity:document.querySelector('#activity')?.textContent,newDisabled:document.querySelector('#new-session').disabled,pop:document.querySelector('#new-session-pop').hidden}))));
  throw error;
 });
 assert.doesNotMatch(await sessionTitle(page),/^Claude( Code)? ·/,'o título não repete o prefixo do motor');
 const claudeRows=await sessionRows(page);
 const claudeRow=claudeRows.find(row=>row.current);
 assert.match(claudeRow.meta,/Claude \(experimental\)/,'a lista diz o motor só da sessão Claude Code');
 assert.equal(claudeRows.filter(row=>/Claude \(experimental\)/.test(row.meta)).length,1);
 await closeSessionList(page);
 /* A sessão nova vazia não deixa arquivo ao sair (nada a guardar): volta-se à A. */
 await openSessionById(page,sessionA);
 await page.waitForFunction(id=>document.querySelector('#session-title').dataset.session===id,sessionA,{timeout:30000});
 await statusOnline(page,{timeout:60000});
 assert.equal(await currentEngine(page),'pi','a sessão atual nunca trocou de motor');

 /* ---------- janela baixa: nada estoura e o cabeçalho fica à vista ---------- */
 for(const text of ['primeira pergunta','segunda pergunta','terceira pergunta','quarta pergunta']){
  await page.locator('#prompt').fill(text);
  await sendEnabled(page);
  await page.locator('#send').click();
  await page.waitForFunction(count=>document.querySelectorAll('#messages .message.assistant').length>=count,['primeira pergunta','segunda pergunta','terceira pergunta','quarta pergunta'].indexOf(text)+1,{timeout:30000});
  await sendEnabled(page,{timeout:30000});
 }
 for(const [theme,width,height] of [['light',1440,900],['dark',1440,900],['light',900,650],['dark',900,650]]){
  await setTheme(page,theme);
  await size(app,page,width,height);
  await layoutStable(page,'.chat-head');
  const tag=`${theme}-${width}x${height}`;
  const viewport=await page.evaluate(()=>({w:innerWidth,h:innerHeight,sw:document.documentElement.scrollWidth,sh:document.documentElement.scrollHeight}));
  assert.ok(viewport.sw<=viewport.w+1,`${tag}: sem rolagem horizontal da página`);
  /* O painel Ajustes não ocupa mais a coluna: modelo e esforço moram no indicador
     da caixa de mensagem (tickets #14 e #42) e um ponto só aparece nele. */
  assert.equal(await page.locator('#pi-settings-panel, #settings-toggle, .side-foot').count(),0,`${tag}: nada de painel Ajustes nem rodapé de estado na coluna`);
  assert.equal(await page.locator('#status-dot').count(),1,`${tag}: um ponto só`);
  /* Ligado, o logo do modelo fica no lugar do ponto (2026-10-21). */
  assert.equal(await page.locator('#model-indicator #status-dot, #model-indicator[data-logo] .mi-logo').evaluateAll(list=>list.some(el=>el.getBoundingClientRect().width>0)),true,`${tag}: o ponto ou o logo do modelo segue à vista, no indicador`);
  assert.equal(await page.locator('#model-indicator').isVisible(),true,`${tag}: o indicador de modelo está na caixa de mensagem`);
  inside(await rect(page,'#model-indicator'),viewport.w,viewport.h,`${tag} indicador`);
  await page.evaluate(()=>{const chat=document.querySelector('#chat');chat.scrollTop=chat.scrollHeight;document.querySelector('#messages').scrollTop=document.querySelector('#messages').scrollHeight;});
  await nextFrames(page,3);
  const headBox=await rect(page,'.chat-head'),chatBox=await rect(page,'#chat');
  assert.ok(headBox.top>=chatBox.top-0.5&&headBox.top<=chatBox.top+1,`${tag}: o cabeçalho fica no topo da coluna mesmo rolada (${headBox.top} × ${chatBox.top})`);
  assert.ok(headBox.height<=bar+2,`${tag}: o cabeçalho continua com uma linha`);
  for(const id of ['#session-title','#sidechat-toggle','#new-session','#chat-more'])inside(await rect(page,id),viewport.w,viewport.h,`${tag} ${id}`);
  const headOverflow=await page.evaluate(()=>{const el=document.querySelector('.chat-head');return el.scrollWidth-el.clientWidth;});
  assert.ok(headOverflow<=1,`${tag}: nada vaza do cabeçalho`);

  assert.doesNotMatch(await sessionTitle(page),DATE,`${tag}: o título não começa pela data`);
  assert.ok(await visibleChars(page,'#session-title .session-title-text')>=12,`${tag}: o cabeçalho mostra o começo do título (${await visibleChars(page,'#session-title .session-title-text')} caracteres)`);
  await openSessionList(page);
  inside(await rect(page,'#conversations-pop'),viewport.w,viewport.h,`${tag} lista de sessões`);
  {
   const pop=await rect(page,'#conversations-pop'),link=await rect(page,'#conv-library');
   assert.ok(link.top>=pop.top-0.5&&link.bottom<=pop.bottom+0.5,`${tag}: o link do pé da lista fica dentro da lista, sem rolar para achar`);
   const cut=await page.evaluate(()=>{const el=document.querySelector('#conv-library');return el.scrollWidth-el.clientWidth;});
   assert.ok(cut<=0,`${tag}: o link "Buscar e organizar sessões…" aparece inteiro`);
  }
  await reviewShot(page,out,`${tag}-lista.png`);
  await closeSessionList(page);
  await openNewSessionMenu(page);
  inside(await rect(page,'#new-session-pop'),viewport.w,viewport.h,`${tag} menu de sessão nova`);
  await reviewShot(page,out,`${tag}-sessao-nova.png`);
  await page.keyboard.press('Escape');
  await openTutorMore(page);
  inside(await rect(page,'#chat-more-pop'),viewport.w,viewport.h,`${tag} Mais opções`);
  await reviewShot(page,out,`${tag}-mais-opcoes.png`);
  await page.keyboard.press('Escape');
 }
 assert.deepEqual(errors,[],'nenhum erro de página');
 console.log('PASS tutor-header-ui — capturas em',out);
});

/* ---------- flag endDay:false ---------- */
await withArtifacts('tutor-header-endday',async ctx=>{
 const runtime=ctx.runtime=newRuntime('tutorhead-endday');
 const course=seedCourse(runtime,'calc');
 writeConfigJson(runtime,{runtimePath:runtime,vaultPath:runtime,courses:[{id:'calc',name:'Cálculo',path:course}],desk:{endDay:false}});
 const app=ctx.app=await launchDesk({runtime});
 const page=await app.firstWindow();
 await statusOnline(page);
 await openTutorMore(page);
 assert.equal(await page.locator('#chat-more-pop #end-day').isVisible(),false,'endDay:false esconde Encerrar por hoje');
 assert.equal(await page.locator('#chat-more-pop #end-day').count(),1,'o item continua no menu, só escondido');
 assert.ok(await page.locator('#chat-more-pop #export-chat').isVisible(),'o resto de Mais opções continua');
 assert.equal(await page.locator('#study-pop #end-day').count(),0);
 console.log('PASS tutor-header-ui — endDay:false');
});
