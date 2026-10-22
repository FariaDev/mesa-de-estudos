import assert from 'node:assert/strict';import path from 'node:path';import fs from 'node:fs';
import {captureFixtureEnv,screenshotDirectory,pickTheme,withArtifacts,launchDesk,newRuntime,seedCourse,seedPlot,seedSession,writeDeskJson,writeConfigJson,tinyPdf,toastWait,sendEnabled,statusOnline,PLOT_PNG,menuLocator,tutorMore,sessionIds,openSessionById,openSessionList,closeSessionList,openTutorMore,fillStudyTitle,resizeWindow,pageWindow} from './helpers.mjs';
import {layoutStable,pollUntil} from './waits.mjs';
const deskJson=runtime=>{try{return JSON.parse(fs.readFileSync(path.join(runtime,'desk.json'),'utf8'));}catch{return null;}};

await withArtifacts('smoke',async ctx=>{
 const runtime=ctx.runtime=newRuntime('basico');
 const plot=seedPlot(runtime,'Test');
 const sessionFile=seedSession(runtime,[{type:'message',message:{role:'assistant',content:[{type:'text',text:`Aqui está o gráfico:\n\n![curva de teste](file://${plot})`}]}}]);
 writeDeskJson(runtime,{session:sessionFile,courseId:'Calculus I'});
 const app=ctx.app=await launchDesk({runtime,env:captureFixtureEnv(runtime)});
 const page=await app.firstWindow();const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')console.log('CONSOLE',m.text());});
 assert.equal(await (await pageWindow(app,page)).evaluate(win=>win.isVisible()),false,'janela oculta em testes');
 if(process.platform==='darwin')assert.equal(await app.evaluate(({app})=>app.dock.isVisible()),false,'Dock oculta em testes');
 await page.waitForSelector('.pdf-panel canvas',{timeout:30000});
 await page.waitForFunction(()=>document.querySelectorAll('.page-total').length===2&&[...document.querySelectorAll('.page-total')].every(e=>!e.textContent.includes('—')),{timeout:30000});
 await page.waitForFunction(()=>[...document.querySelectorAll('.pdf-panel')].every(panel=>panel.querySelector('canvas')),{timeout:30000});
 const selects=await page.locator('.pdf-select').evaluateAll(es=>es.map(e=>e.value));assert.ok(selects[0].includes('Limites'));assert.ok(selects[1].includes('Formul'));
 // a moldura do leitor e o documento vêm da view do Bend (core/pdfpageview.bend)
 const shell=await page.evaluate(()=>{const doc=document.querySelector('.pdf-panel .pdf-document'),pages=doc?[...doc.children]:[];return {titles:[...document.querySelectorAll('.pdf-panel > .pdf-title > strong')].map(el=>el.textContent),tools:[...document.querySelector('.pdf-panel > .pdf-title').children].map(el=>el.className.split(' ')[0]||el.tagName.toLowerCase()),menu:[...document.querySelector('.pdf-panel .pdf-more-pop').children].map(el=>el.className.split(' ')[0]),scaffold:document.querySelectorAll('.pdf-panel [data-icon]').length,cls:doc?doc.className:'',pageCls:pages[0]?pages[0].className:'',first:pages[0]?pages[0].dataset.page:'',style:pages[0]?pages[0].getAttribute('style'):'',count:pages.length};});
 assert.deepEqual(shell.titles,['Enunciado','Formulário & apoio'],'títulos dos leitores vêm da view do Bend');
 assert.deepEqual(shell.tools,['strong','pdf-select','back','prev','page-number','page-total','next','find-toggle','nav','more'],'barra única na ordem da view do Bend');
assert.deepEqual(shell.menu,['open','page-shot','more-zoom','fit','invert','rotate','printed-toggle','collapse'],'Mais opções na ordem da view do Bend (a numeração impressa o host encaixa antes de Recolher)');
 assert.equal(shell.scaffold,0,'o andaime data-icon sai do DOM');
 assert.equal(shell.cls,'pdf-document');assert.equal(shell.pageCls,'pdf-page');assert.equal(shell.first,'1');
 assert.match(shell.style,/^width:\d+(\.\d+)?px;height:\d+(\.\d+)?px$/,'a página é a âncora medida (style do Bend)');
 assert.ok(shell.count>=2,'o documento lista todas as páginas');
 const anchors=await page.evaluate(()=>[...document.querySelector('.pdf-panel .pdf-document').children].map(el=>({page:el.dataset.page,style:el.getAttribute('style')})));
 assert.deepEqual(anchors.map(a=>a.page),anchors.map((_,i)=>String(i+1)),'âncoras das páginas em ordem (data-page)');
 assert.ok(anchors.every(a=>/^width:[\d.]+px;height:[\d.]+px$/.test(a.style)),'cada página guarda a caixa medida pelo host (style do Bend)');
 await page.locator('.pdf-panel').first().locator('.next').click();await page.waitForFunction(()=>document.querySelector('.page-number').value==='2');
 assert.match(await page.title(),/p\. 2/,'window title carries the open page');
 assert.equal(await page.locator('.page-number').nth(1).inputValue(),'1');
 await page.locator('#expression').fill('sqrt(16)+sin(pi/2)');await page.locator('#calc-form button').click();assert.equal(await page.locator('#result').textContent(),'5');
 // calculadora da Mesa: a view vem do Bend (`core/calcview.bend` → `desk/src/calc.mjs`)
 assert.equal(await page.locator('#calculator').getAttribute('class'),'collapsed','a calculadora nasce recolhida, numa linha só');
 assert.equal(await page.locator('#calc-toggle').getAttribute('aria-label'),'Expandir calculadora','o rótulo do controle vem da view');
 assert.equal(await page.locator('#calc-bar .calc-icon svg.icon').count(),1,'o ícone da linha é asset do host');
 assert.equal(await page.locator('#calc-toggle svg.icon').count(),1,'o chevron do controle é asset do host');
 await page.locator('#calc-toggle').click();
 assert.equal(await page.locator('#calc-body').isVisible(),true,'o controle expande o painel');
 await page.locator('#angle button[data-angle="deg"]').click();await page.locator('#expression').fill('sin(30)');await page.locator('#calc-form button').click();assert.equal(await page.locator('#result').textContent(),'0,5');
 await page.locator('#calc-toggle').click();
 assert.equal((await page.locator('#calc-bar .calc-unit').textContent()).trim(),'GRAUS','a linha recolhida mostra a unidade vigente');
 await page.locator('#calc-toggle').click();
 assert.equal(await page.locator('#calc-guide summary').textContent(),'Como usar','a guia vem da view do Bend');
 assert.equal(await page.locator('#calc-guide code').count(),32,'os códigos da guia vêm da view');
 assert.deepEqual(await page.locator('#calc-history button').evaluateAll(es=>es.map(el=>({text:el.getAttribute('aria-label'),expr:el.dataset.expr}))),[{text:'sin(30) = 0,5',expr:'sin(30)'},{text:'sqrt(16)+sin(pi/2) = 5',expr:'sqrt(16)+sin(pi/2)'}],'histórico do mais novo para o antigo, com o rótulo pronto');
 await page.locator('#calc-history button').last().click();
 await page.waitForFunction(()=>document.querySelector('#expression').value==='sqrt(16)+sin(pi/2)'&&document.activeElement===document.querySelector('#expression'),undefined,{timeout:5000});
 // erro: vira —, avisa no toast e não entra no histórico
 await page.locator('#expression').fill('sqrt(');
 await page.locator('#calc-form button').click();
 assert.equal(await page.locator('#result').textContent(),'—','expressão inválida vira —');
 await toastWait(page,'Expressão inválida',{timeout:5000});
 assert.equal(await page.locator('#calc-history button').count(),2,'erro não entra no histórico');
 // histórico: no máximo 8, do mais novo para o mais antigo
 for(let i=1;i<=8;i++){await page.locator('#expression').fill(`${i}+0`);await page.locator('#expression').press('Enter');}
 assert.equal(await page.locator('#calc-history button').count(),8,'histórico limita em 8');
 assert.equal(await page.locator('#calc-history button').first().getAttribute('aria-label'),'8+0 = 8','o mais novo fica no topo');
 assert.ok(!(await page.locator('#calc-history button').evaluateAll(es=>es.map(e=>e.getAttribute('aria-label')))).some(t=>t.startsWith('sin(30)')),'os mais antigos saem');
 await page.locator('#expression').fill('');
 // colapso: o clique no select do ângulo não colapsa; o clique no título sim
 await page.evaluate(()=>document.querySelector('#angle').dispatchEvent(new MouseEvent('click',{bubbles:true})));
 assert.equal(await page.locator('#calc-body').isHidden(),false,'clique no ângulo não colapsa');
 await page.locator('#calc-toggle').click();
 assert.equal(await page.locator('#calc-body').isHidden(),true,'o toggle colapsa o corpo');
 assert.equal(await page.locator('#calc-toggle').getAttribute('aria-expanded'),'false','aria-expanded acompanha o colapso');
 assert.equal(await page.locator('#calculator').getAttribute('class'),'collapsed','a seção marca o colapso');
 await page.locator('#calc-toggle').click();
 assert.equal(await page.locator('#calc-body').isVisible(),true,'o toggle reabre a calculadora');
 // guia aberta sobrevive a um render inteiro (colapso/expansão) e volta fechada
 await page.locator('#calc-guide summary').click();
 assert.equal(await page.locator('#calc-guide').evaluate(el=>el.open),true,'a guia abre');
 await page.locator('#calc-toggle').click();
 await page.locator('#calc-toggle').click();
 assert.equal(await page.locator('#calc-guide').evaluate(el=>el.open),true,'o open da guia sobrevive ao render');
 assert.equal(await page.locator('#calc-guide code').count(),32,'os códigos continuam na árvore');
 await page.locator('#calc-guide summary').click();
 // recíprocas (sec/csc/cot), inversas (asin/acos/atan) e ângulos exatos
 await page.locator('#expression').fill('sec(60)');await page.locator('#calc-form button').click();assert.equal(await page.locator('#result').textContent(),'2','sec(60) em GRAUS');
 await page.locator('#expression').fill('csc(30)');await page.locator('#calc-form button').click();assert.equal(await page.locator('#result').textContent(),'2','csc(30) em GRAUS');
 await page.locator('#expression').fill('asin(0.5)');await page.locator('#calc-form button').click();assert.equal(await page.locator('#result').textContent(),'30','asin devolve o ângulo em GRAUS');
 await page.locator('#expression').fill('cos(90)');await page.locator('#calc-form button').click();assert.equal(await page.locator('#result').textContent(),'0','cos(90) sai exato');
 await page.locator('#expression').fill('tan(90)');await page.locator('#calc-form button').click();assert.equal(await page.locator('#result').textContent(),'—','polo vira —');
 await toastWait(page,'Resultado indefinido',{timeout:5000});
 await page.locator('#angle button[data-angle="rad"]').click();
 await page.locator('#expression').fill('');
 // Com --calc alto a coluna pode rolar; Enviar deve ser alcançável e clicável
 // dentro do viewport do chat, sem aparecer por cima da calculadora.
 const calcDefault=await page.evaluate(()=>parseInt(getComputedStyle(document.documentElement).getPropertyValue('--calc'))||220);
 await page.evaluate(()=>document.documentElement.style.setProperty('--calc','700px'));
 await page.locator('#send').scrollIntoViewIfNeeded();
 const tallCalc=await page.evaluate(()=>{
  const chatEl=document.querySelector('#chat'),chat=chatEl.getBoundingClientRect();
  const composer=document.querySelector('#composer').getBoundingClientRect();
  const calc=document.querySelector('#calculator').getBoundingClientRect();
  const send=document.querySelector('#send').getBoundingClientRect();
  const hit=document.elementFromPoint(send.x+send.width/2,send.y+send.height/2);
  return {composerBottom:Math.round(composer.bottom),chatBottom:Math.round(chat.bottom),scrolls:getComputedStyle(chatEl).overflowY==='auto',sendBottom:Math.round(send.bottom),calcTop:Math.round(calc.top),vh:innerHeight,hitSend:!!hit?.closest?.('#send'),hit:hit?.id||hit?.tagName||''};
 });
 assert.ok((tallCalc.scrolls?tallCalc.chatBottom:tallCalc.composerBottom)<=tallCalc.calcTop+1,`chat não sobrepõe a calculadora com --calc alto`);
 assert.ok(tallCalc.sendBottom<=Math.min(tallCalc.calcTop,tallCalc.vh)+1,'Enviar alcançável acima da calculadora');
 assert.equal(tallCalc.hitSend,true,'o Enviar segue clicável com --calc alto (acertou '+tallCalc.hit+')');
 await page.evaluate(h=>document.documentElement.style.setProperty('--calc',h+'px'),calcDefault);
 await page.waitForSelector('#messages img.plot',{timeout:15000});
 assert.match(await page.locator('#messages img.plot').first().getAttribute('src'),/^data:image\/png;base64,/);
 assert.ok(await page.locator('#messages .img-wrap .img-copy').first().isVisible(),'chat images get a copy overlay');
 // figura hidratada: a forma (img.plot + legenda) vem do core/talkview.bend; o HTML do Markdown e a leitura da imagem ficam no host
 const asset=await page.evaluate(()=>{const figure=document.querySelector('#messages figure.asset');const img=figure?.querySelector('img.plot');return{caption:figure?.querySelector('figcaption')?.textContent??null,alt:img?.getAttribute('alt')??null,path:img?.dataset.path??''};});
 assert.equal(asset.caption,'curva de teste','a legenda da figura vem da view do Bend');
 assert.equal(asset.alt,'curva de teste','o alt da figura usa a legenda do Markdown');
 assert.match(asset.path,/plot\.png$/,'o caminho do arquivo fica no data-path do img');
 await page.locator('#messages img.plot').first().click();
 await page.waitForSelector('#image-dialog[open]');
 assert.match(await page.locator('#image-preview').getAttribute('src'),/^data:image\/png;base64,/);
 // o título/ações do diálogo de imagem vêm da view do Bend (dialogsview)
 assert.equal(await page.locator('#image-title').textContent(),'plot.png','título pelo nome do arquivo');
 assert.match(await page.locator('#image-dialog').getAttribute('data-path'),/plot\.png$/,'o caminho do arquivo fica no dataset');
 assert.equal(await page.locator('#image-open').isVisible(),true,'com arquivo o Abrir no Preview aparece');
 await page.locator('#image-copy').click();
 await page.waitForFunction(()=>document.querySelector('#toast')&&!document.querySelector('#toast').hidden&&document.querySelector('#toast').textContent.includes('Imagem copiada'));
 await page.locator('#image-dialog .dialog-close').click();
 // menu de comandos slash: local (/compact) + os que o Pi listar
 await page.locator('#prompt').fill('/');
 await page.waitForSelector('#slash-menu:not([hidden])',{timeout:15000});
 const slashItems=await page.locator('#slash-menu .slash-item').count();
 assert.ok(slashItems>=2,`menu slash com locais + Pi (viu ${slashItems})`);
 assert.match(await page.locator('#slash-menu .slash-item').first().textContent(),/\/compact/,'comando local /compact no topo');
 assert.ok(await page.locator('#slash-menu .slash-item').filter({hasText:'/help'}).count()>=1,'comando do Pi listado');
 // a casca e as linhas vêm do núcleo compartilhado (core/slashview.bend)
 assert.equal(await page.locator('#slash-menu').getAttribute('class'),'slash-pop');
 assert.equal(await page.locator('#slash-menu .slash-head').textContent(),'Comandos');
 assert.equal(await page.locator('#slash-menu .slash-foot').textContent(),'↑↓ navegar · ⏎ inserir · Esc fechar');
 assert.equal(await page.locator('#slash-list').getAttribute('role'),'listbox');
 assert.equal(await page.locator('#slash-list').getAttribute('aria-label'),'Comandos do tutor');
 assert.equal(await page.locator('#slash-menu .slash-item[role="option"]').count(),slashItems,'toda linha nasce option da view');
 assert.equal(await page.locator('#slash-menu .slash-item.active').count(),1,'uma linha ativa vinda da view');
 assert.equal(await page.locator('#slash-menu .slash-item.active').getAttribute('aria-selected'),'true');
 assert.ok(await page.locator('#slash-menu .slash-item').first().getAttribute('data-key'),'a key da linha vira dataset.key');
 assert.equal(await page.locator('#slash-menu .slash-check svg.icon').count(),slashItems,'o SVG do check ocupa o slot do Bend em toda linha');
 await page.locator('#prompt').fill('/hel');
 await page.waitForFunction(()=>document.querySelectorAll('#slash-menu .slash-item').length===1);
 assert.match(await page.locator('#slash-menu .slash-item.active .slash-name').textContent(),/^\/help/,'o filtro repinta a árvore com o ativo certo');
 await page.locator('#prompt').fill('/');
 await page.keyboard.press('Escape');
 await page.waitForFunction(()=>document.querySelector('#slash-menu').hidden===true,undefined,{timeout:5000});
 await page.locator('#prompt').fill('');
 await page.locator('#prompt').fill('me dá um quiz de teste');
 await page.locator('#send').click();
 await page.waitForSelector('.message.quiz .quiz-option');
 assert.equal(await page.locator('.message.quiz').first().getAttribute('data-role'),'assistant','quiz Bend mantém o papel da mensagem');
 assert.ok(await page.locator('.message.quiz').first().getAttribute('data-tool'),'quiz Bend preserva o id da ferramenta');
 assert.ok(await page.locator('.message.quiz .quiz-question .katex').count()>=1,'o enunciado do quiz renderiza LaTeX');
 assert.ok(await page.locator('.message.quiz .quiz-option .katex').count()>=1,'as opções do quiz renderizam LaTeX');
 assert.ok(!(await page.locator('.message.quiz .quiz-question').textContent()).includes('\\('),'sem LaTeX cru no enunciado');
 assert.equal(await page.locator('.message.quiz .quiz-send').count(),0);
 await page.locator('.message.quiz .quiz-option').nth(1).click();
 await page.waitForFunction(()=>[...document.querySelectorAll('.quiz-verdict')].some(el=>el.textContent.includes('Correta')));
 assert.ok(await page.locator('.message.quiz .quiz-explain .katex').count()>=1,'a explicação do quiz renderiza LaTeX');
 assert.equal(await page.locator('.quiz-option.correct').count(),1);
 await page.waitForFunction(()=>!document.querySelector('#send').disabled);
 await page.locator('#prompt').fill('agora um quiz multi');
 await page.locator('#send').click();
 await page.waitForFunction(()=>document.querySelectorAll('.message.quiz').length===2);
 const multi=page.locator('.message.quiz').nth(1);
 await multi.locator('.quiz-option').nth(0).click();
 assert.equal(await multi.locator('.quiz-option').nth(0).evaluate(el=>el===document.activeElement),true,'o foco fica no card clicado (as keys quiz-option-N repetem entre quizzes)');
 await multi.locator('.quiz-option').nth(1).click();
 assert.equal(await multi.locator('.quiz-option').nth(1).evaluate(el=>el===document.activeElement),true,'o foco acompanha a segunda opção do mesmo card');
 assert.equal(await multi.locator('.quiz-send').isEnabled(),true);
 await multi.locator('.quiz-send').click();
 await page.waitForFunction(()=>document.querySelectorAll('.quiz-verdict').length===2&&document.querySelectorAll('.quiz-verdict')[1].textContent.includes('Correta'));
 assert.equal(await multi.locator('.quiz-option.correct').count(),2);
 await page.waitForFunction(()=>!document.querySelector('#send').disabled);
 await page.locator('#prompt').fill('mais um quiz de teste');
 await page.locator('#send').click();
 await page.waitForFunction(()=>document.querySelectorAll('.message.quiz').length===3);
 const dontKnow=page.locator('.message.quiz').nth(2);
 await dontKnow.locator('.quiz-option').last().click();
 await page.waitForFunction(()=>document.querySelectorAll('.quiz-verdict').length===3&&document.querySelectorAll('.quiz-verdict')[2].textContent.includes('Não sei'));
 await page.waitForFunction(()=>!document.querySelector('#send').disabled);
 await page.locator('#prompt').fill('explique o teorema de Pitágoras');
 // a faixa de atividade avisa no mesmo tick do envio: clica e lê sem corrida
 const thinking=await page.evaluate(()=>{document.querySelector('#send').click();const box=document.querySelector('#activity');return {role:box.getAttribute('role'),text:box.textContent,title:box.getAttribute('title')};});
 assert.deepEqual(thinking,{role:'status',text:'Tutor está pensando…',title:'Tutor está pensando…'},'a faixa de atividade avisa enquanto o tutor pensa (title acompanha o rótulo)');
 await page.waitForSelector('#messages .message.assistant:not(.quiz) .katex');
 await page.waitForFunction(()=>!document.querySelector('#send').disabled);
 // medidor de contexto + /compact
 // o medidor mora no Mais opções do tutor (uso de contexto): o menu abre para lê-lo
 await page.waitForSelector('#ctx-meter:not([hidden])',{state:'attached'});
 await openTutorMore(page);
 assert.equal(await page.locator('#more-context-empty').isHidden(),true,'com medição, o "sem medição ainda" some');
 assert.match(await page.locator('#ctx-meter em').textContent(),/%$/);
 // o balão do medidor é a view do Bend (`core/statusview.bend` → ctxTip): texto e
 // hidden vêm do núcleo; medir/posicionar e os eventos são do host
 await page.locator('#ctx-meter').hover();
 await page.waitForFunction(()=>{const tip=document.querySelector('#ctx-tip'),meter=document.querySelector('#ctx-meter');return !!tip&&!tip.hidden&&!!meter._tipText&&tip.textContent===meter._tipText;},{timeout:5000});
 const meterTip=await page.evaluate(()=>({text:document.querySelector('#ctx-tip').textContent,noTip:document.querySelector('#ctx-meter').hasAttribute('data-no-tip')}));
 assert.match(meterTip.text,/^Contexto do modelo: \d+% · .+ de .+ tokens usados · \/compact compacta$/,'o balão do medidor mostra o texto do fato');
 assert.equal(meterTip.noTip,true,'o medidor fica fora da delegação do tooltip (balão próprio)');
 assert.notEqual(await page.locator('#ctx-tip').boundingBox(),null,'o host posiciona o balão');
 const tipBox=await page.locator('#ctx-tip').boundingBox();
 const viewport=await page.evaluate(()=>({w:innerWidth,h:innerHeight}));
 assert.ok(tipBox.x>=0&&tipBox.x+tipBox.width<=viewport.w+1,'o balão do medidor não vaza a janela (x='+Math.round(tipBox.x)+' right='+Math.round(tipBox.x+tipBox.width)+' vw='+viewport.w+')');
 assert.ok(tipBox.y>=0&&tipBox.y+tipBox.height<=viewport.h+1,'o balão do medidor não vaza por baixo (y='+Math.round(tipBox.y)+' bottom='+Math.round(tipBox.y+tipBox.height)+' vh='+viewport.h+')');
 await page.mouse.move(6,400);
 await page.waitForFunction(()=>document.querySelector('#ctx-tip').hidden,undefined,{timeout:5000});
 // balão aberto pelo caminho do host (mouseenter do medidor), sem hover de
 // ponteiro: o resize tem de reposicioná-lo com o medidor, sem deixá-lo fora
 await page.evaluate(()=>document.querySelector('#ctx-meter').dispatchEvent(new MouseEvent('mouseenter')));
 await page.waitForFunction(()=>{const t=document.querySelector('#ctx-tip');return !!t&&!t.hidden&&!!document.querySelector('#ctx-meter')._tipText;},{timeout:5000});
 const windowSize=await (await pageWindow(app,page)).evaluate(win=>{const b=win.getBounds();return {width:b.width,height:b.height};});
 await resizeWindow(app,page,980,760);
 await page.waitForFunction(()=>{const t=document.querySelector('#ctx-tip');if(!t||t.hidden)return false;const r=t.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1;},{timeout:5000});
 const resizedTip=await page.evaluate(()=>{const t=document.querySelector('#ctx-tip'),r=t.getBoundingClientRect();return {open:!t.hidden,right:Math.round(r.right),vw:innerWidth};});
 assert.equal(resizedTip.open,true,'o balão continua aberto depois do resize');
 assert.ok(resizedTip.right<=resizedTip.vw+1,'o balão reposiciona no resize (right='+resizedTip.right+' vw='+resizedTip.vw+')');
 await page.evaluate(()=>document.querySelector('#ctx-meter').dispatchEvent(new MouseEvent('mouseleave')));
 await page.waitForFunction(()=>document.querySelector('#ctx-tip').hidden,undefined,{timeout:5000});
 await page.keyboard.press('Escape');
 await page.locator('#chat-more-pop').waitFor({state:'hidden',timeout:5000});
 const msgsBefore=await page.locator('#messages .message').count();
 await page.locator('#prompt').fill('/compact foque nos quizzes');
 await page.locator('#send').click();
 await page.waitForFunction(()=>document.querySelector('#toast')&&!document.querySelector('#toast').hidden&&document.querySelector('#toast').textContent.includes('Contexto compactado'));
 assert.equal(await page.locator('#messages .message').count(),msgsBefore,'/compact should not add chat messages');
 /* Compactação automática: o item de Mais opções aciona o botão vivo `#auto-compact`
    (ele mora fora da coluna, escondido; o menu é o lugar da escolha). */
 await page.waitForSelector('#auto-compact',{state:'attached'});
 const pressed0=await page.locator('#auto-compact').getAttribute('aria-pressed');
 await tutorMore(page,'#more-auto-compact').click();
 await page.waitForFunction(prev=>{const t=document.querySelector('#toast');return document.querySelector('#auto-compact').getAttribute('aria-pressed')!==prev&&t&&!t.hidden&&t.textContent.includes('Compactação automática');},pressed0,{timeout:8000});
 await tutorMore(page,'#more-auto-compact').click(); // o menu fecha depois do toast: reabre pelo proxy
 await page.waitForFunction(prev=>document.querySelector('#auto-compact').getAttribute('aria-pressed')===prev,pressed0,{timeout:8000});
 await page.keyboard.press('Escape');
 // cabeça do chat: ponto, medidor e compactação vêm da view do Bend
 // (`core/statusview.bend`); o medidor mantém os nós vivos (animação da barra)
 const head=await page.evaluate(()=>{
  const dot=document.querySelector('#model-indicator'),meter=document.querySelector('#ctx-meter'),auto=document.querySelector('#auto-compact');
  const em=meter.querySelector('em');
  return {dotTip:dot.getAttribute('data-tip'),dotTitle:dot.hasAttribute('title'),width:meter.querySelector('i').getAttribute('style'),pct:em.textContent,cls:meter.className,autoTip:auto.getAttribute('data-tip'),autoOn:auto.getAttribute('aria-pressed'),autoCls:auto.getAttribute('class')};
 });
 assert.equal(head.dotTitle,false,'o indicador (ponto de conexão) usa data-tip, não title (view do Bend)');
 assert.match(head.dotTip,/Tutor ligado/,'o tooltip do indicador é o rótulo do fato');
 assert.equal(head.width,`--meter:${head.pct}`,'a barra do medidor enche pelo preenchimento da view (scaleX, #63)');
 assert.equal(head.cls,parseInt(head.pct,10)>=85?'hot':parseInt(head.pct,10)>=60?'warn':'','a cor do medidor segue os cortes da view');
 assert.match(head.autoTip,/Compactação automática/,'o botão de compactação usa o data-tip da view');
 assert.equal(head.autoCls,head.autoOn==='true'?'on':'','a classe .on acompanha o aria-pressed da view');
 await resizeWindow(app,page,windowSize.width,windowSize.height);
 /* Com o leitor 40px mais alto, o resize acima deixa o Enunciado na página 3 (a rolagem
    segue o mesmo deslocamento); o que o roteiro adiante lê é a página 2 do clique em Próxima. */
 await page.locator('.page-number').first().fill('2');await page.locator('.page-number').first().press('Enter');
 await page.waitForFunction(()=>document.querySelector('.page-number').value==='2',undefined,{timeout:5000});
 // o cabeçalho do tutor mostra o título da sessão corrente; a lista da matéria marca a mesma sessão
 const sess=await page.evaluate(()=>{const t=document.querySelector('#session-title');return {aria:t.getAttribute('aria-label'),data:t.dataset.session,text:t.querySelector('.session-title-text').textContent.trim()};});
 assert.match(sess.aria,/^Sessão/,'o título da sessão é o botão que abre a lista');
 assert.ok(sess.data,'a sessão corrente está no data-session do título');
 assert.ok(sess.text,'o título nunca fica vazio');
 await openSessionList(page);
 assert.equal(await page.locator('#conv-list .conv-row.current').count(),1,'a sessão corrente é a linha marcada da lista');
 assert.equal(await page.locator('#conv-list .conv-row.current').getAttribute('data-id'),sess.data,'a linha marcada casa com o data-session do título');
 await closeSessionList(page);
 // vocabulário (CONTEXT.md): a interface diz Tutor e Sessão. "Pi" só em Configurações, Sobre e
 // na escolha do motor; "conversa"/"chat"/"thread" não nomeiam a sessão (Chat lateral mantém o nome).
 const vocab=await page.evaluate(()=>{
  /* Nome de modelo vem do provedor (dado, não vocabulário): `#model-list` e o indicador de modelo; "Claude Code" na sessão nova é nome de motor. */
  /* Relatar um problema (#62) nomeia o programa `pi` do terminal, não o tutor. */
  const skip=['#settings-dialog','#about-dialog','#triage-dialog','#new-session-claude','#model-list','#model-indicator','#model-pop'];
  const allowed=[/Chat lateral/gi,/chat lateral/gi,/Pi \/ Claude Code/g];
  const found=[];
  const scrub=text=>allowed.reduce((out,re)=>out.replace(re,' '),text);
  const inSkipped=el=>skip.some(sel=>el.closest(sel));
  const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
  while(walker.nextNode()){const node=walker.currentNode;const el=node.parentElement;if(!el||inSkipped(el)||el.closest('script,style'))continue;found.push(['texto',node.nodeValue]);}
  for(const el of document.body.querySelectorAll('[title],[aria-label],[placeholder],[data-tip]')){
   if(inSkipped(el))continue;
   for(const attr of ['title','aria-label','placeholder','data-tip']){const v=el.getAttribute(attr);if(v)found.push([attr,v]);}
  }
  /* "Pi" é sensível a caixa: `pi` da calculadora não é o nome do motor. */
  const bad=v=>/\bPi\b/.test(v)||/\b(conversas?|chats?|threads?)\b/i.test(v);
  return found.filter(([,v])=>bad(scrub(v))).map(([kind,v])=>`${kind}: ${v.trim().slice(0,120)}`);
 });
 assert.deepEqual(vocab,[],'nenhum texto visível da Mesa usa Pi, conversa, chat ou thread para o tutor e a sessão');
 // a paleta de comandos nasce ao abrir: precisa falar o mesmo vocabulário
 await page.locator('#palette-field').click();
 await page.waitForSelector('#command-palette:not([hidden])');
 const paletteVocab=await page.evaluate(()=>{
  const root=document.querySelector('#command-palette');
  const bad=v=>/\bPi\b/.test(v)||/\b(conversas?|chats?|threads?)\b/i.test(v);
  const scrub=t=>t.replace(/Chat lateral/gi,' ');
  const found=[];
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  while(walker.nextNode())found.push(walker.currentNode.nodeValue);
  for(const el of root.querySelectorAll('[title],[aria-label],[placeholder]'))for(const attr of ['title','aria-label','placeholder']){const v=el.getAttribute(attr);if(v)found.push(v);}
  return found.filter(v=>bad(scrub(v))).map(v=>v.trim().slice(0,120));
 });
 assert.deepEqual(paletteVocab,[],'a paleta de comandos usa Tutor e Sessão');
 await page.keyboard.press('Escape');
 await page.waitForSelector('#command-palette',{state:'hidden'});
 // indicador de modelo e esforço desenhado pelo Bend (valores empurrados pelo state.mjs)
 await page.waitForFunction(()=>/·/.test(document.querySelector('#model-indicator .mi-text')?.textContent||''));
 const indicator=await page.evaluate(()=>{
  const el=document.querySelector('#model-indicator');
  return {title:el.hasAttribute('title'),tip:el.getAttribute('data-tip')||'',aria:el.getAttribute('aria-label')||'',text:el.querySelector('.mi-text').textContent.trim(),state:el.dataset.state};
 });
 assert.equal(indicator.title,false,'indicador usa data-tip, não title');
 assert.match(indicator.tip,/Tutor ligado/,'tooltip do indicador diz que o tutor está ligado');
 assert.match(indicator.aria,/·/,'aria-label do indicador junta modelo e esforço');
 assert.match(indicator.text,/ · /,'texto do indicador: modelo · esforço');
 assert.equal(indicator.state,'on');
 await page.evaluate(()=>{
  const p=[...document.querySelectorAll('#messages .message.assistant .body p')].find(el=>el.textContent.includes('Pitágoras'));
  p.scrollIntoView({block:'center'});
  const range=document.createRange();range.selectNodeContents(p);
  const selection=getSelection();selection.removeAllRanges();selection.addRange(range);
 });
 await page.waitForSelector('#quote-btn:not([hidden])');
 await page.locator('#quote-btn').click();
 await page.waitForFunction(()=>document.querySelector('#prompt').value.includes('$a^2 + b^2 = c^2$'));
 const quoted=await page.locator('#prompt').inputValue();
 assert.ok(quoted.startsWith('> '),'quote should be a Markdown blockquote');
 assert.match(quoted,/\$a\^2 \+ b\^2 = c\^2\$/, 'quote should keep the LaTeX source');
 /* O botão sai com fade (#63): espera a saída em vez de ler no mesmo instante. */
 await page.locator('#quote-btn').waitFor({state:'hidden',timeout:2000});
 await page.locator('#prompt').fill(quoted.trim()+'\n\nPor que isso vale?');
 await page.locator('#send').click();
 await page.waitForFunction(()=>[...document.querySelectorAll('.message.user')].some(el=>el.textContent.includes('Por que isso vale?')));
 await page.waitForFunction(()=>!document.querySelector('#send').disabled);
 await page.locator('#prompt').fill('');
 await page.evaluate(()=>{
  const katex=document.querySelectorAll('#messages .message.assistant:not(.quiz) .katex')[0];
  katex.scrollIntoView({block:'center'});
  const range=document.createRange();range.selectNodeContents(katex);
  const selection=getSelection();selection.removeAllRanges();selection.addRange(range);
 });
 await page.waitForSelector('#quote-btn:not([hidden])');
 await page.locator('#quote-btn').click();
 await page.waitForFunction(()=>document.querySelector('#prompt').value.trim()==='> $a^2 + b^2 = c^2$');
 await page.locator('#prompt').fill('');
 await page.evaluate(()=>{
  const display=document.querySelector('#messages .message.assistant:not(.quiz) .katex-display');
  display.scrollIntoView({block:'center'});
  const range=document.createRange();range.selectNodeContents(display);
  const selection=getSelection();selection.removeAllRanges();selection.addRange(range);
 });
 await page.waitForSelector('#quote-btn:not([hidden])');
 await page.locator('#quote-btn').click();
 await page.waitForFunction(()=>document.querySelector('#prompt').value.trim()==='> $$E = mc^2$$');
 await page.locator('#prompt').fill('');
 await page.setInputFiles('#attach-input',plot);
 await page.waitForSelector('#attachments .attachment img');
 assert.match(await page.locator('#attachments .attachment').first().getAttribute('data-key'),/^img-/,'o anexo da Mesa vem do Bend com key');
 assert.equal(await page.locator('#attachments .attachment img').first().getAttribute('alt'),'Anexo: plot.png');
 assert.equal(await page.locator('#attachments .attachment-remove').first().getAttribute('aria-label'),'Remover plot.png');
 assert.equal(await page.locator('#attachments .attachment-remove').first().getAttribute('title'),null,'a Mesa não usa title no ×');
 assert.equal(await page.locator('#attachments').isVisible(),true);
 assert.equal(await page.locator('#attachments .attachment img').first().getAttribute('loading'),null,'data URL em memória: a miniatura não é lazy (não pisca)');
 assert.equal(await page.locator('#attachments .attachment img').first().getAttribute('decoding'),null,'sem decoding=async: a miniatura não redesenha em duas fases');
 /* Digitar não pode recriar a miniatura (era o "pisca" do app instalado): a
    bandeja só é renderizada em anexar/remover, então o MESMO nó tem de ficar. */
 await page.evaluate(()=>{document.querySelector('#attachments .attachment img').dataset.marca='viva';});
 await page.locator('#prompt').fill('digitando com a miniatura na bandeja');
 await page.waitForTimeout(200);// espera fixa: "nada acontece em 0,2 s" — digitar no composer não recria a miniatura da bandeja
 const thumb=await page.evaluate(()=>{
  const img=document.querySelector('#attachments .attachment img');
  return {marca:img?.dataset.marca??'',loading:img?.getAttribute('loading')??null,decoding:img?.getAttribute('decoding')??null,src:img?.getAttribute('src')?.slice(0,14)??''};
 });
 assert.equal(thumb.marca,'viva','digitar no composer não recria a miniatura (o mesmo nó continua lá)');
 assert.equal(thumb.loading,null);
 assert.equal(thumb.decoding,null);
 assert.match(thumb.src,/^data:image/,'a miniatura segue com a data URL da imagem');
 await page.locator('#prompt').fill('');
 await page.locator('#attachments .attachment img').first().click();
 await page.waitForSelector('#image-dialog[open]');
 assert.match(await page.locator('#image-preview').getAttribute('src'),/^data:image\/png;base64,/,'clique na miniatura abre a prévia da imagem anexada');
 await page.locator('#image-dialog .dialog-close').click();
 await page.waitForFunction(()=>!document.querySelector('#image-dialog').open);
 await page.locator('#attachments .attachment-remove').click();
 await page.waitForFunction(()=>document.querySelector('#attachments').hidden);
 await page.locator('#prompt').focus();
 await page.evaluate(png=>{
  const binary=atob(png);const bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
  const data=new DataTransfer();data.items.add(new File([bytes],'colada.png',{type:'image/png'}));
  document.querySelector('#prompt').dispatchEvent(new ClipboardEvent('paste',{clipboardData:data,cancelable:true,bubbles:true}));
 },PLOT_PNG);
 await page.waitForSelector('#attachments .attachment img');
 await page.locator('#prompt').fill('olha este gráfico');
 await page.locator('#send').click();
 await page.waitForSelector('#messages .message.user img.shot');
 await page.waitForFunction(()=>document.querySelector('#attachments').hidden);
 // anexo grande (>1568 px) é reduzido antes de entrar na fila
 await page.evaluate(()=>{
  const canvas=document.createElement('canvas');canvas.width=2200;canvas.height=900;
  const c2=canvas.getContext('2d');c2.fillStyle='#246';c2.fillRect(0,0,2200,900);
  const binary=atob(canvas.toDataURL('image/png').split(',')[1]);
  const bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
  const data=new DataTransfer();data.items.add(new File([bytes],'grande.png',{type:'image/png'}));
  document.querySelector('#prompt').dispatchEvent(new ClipboardEvent('paste',{clipboardData:data,cancelable:true,bubbles:true}));
 });
 await page.waitForFunction(()=>{const img=document.querySelector('#attachments .attachment img');return img&&img.complete&&img.naturalWidth>0&&img.naturalWidth<=1568;},undefined,{timeout:10000});
 await page.locator('#attachments .attachment-remove').click();
 await page.waitForFunction(()=>document.querySelector('#attachments').hidden);
 await fillStudyTitle(page,'Lista 2 · questão 7b');
 await page.waitForFunction(()=>document.querySelector('#context-summary').textContent.includes('Lista 2 · questão 7b')&&document.querySelector('#context-summary').textContent.includes('p.2'));
 // flags padrão do `desk`: o botão de referências do composer é view do Bend
 assert.equal(await page.locator('#include-refs').isHidden(),false,'com a flag padrão o botão de referências fica visível');
 assert.equal(await page.locator('#include-refs').getAttribute('aria-pressed'),'true','o aria-pressed acompanha o fato do host');
 // O Encerrar por hoje saiu do composer e do menu Estudar: é item do Mais opções do tutor (núcleo).
 await tutorMore(page,'#end-day').click();assert.equal(await page.locator('#end-day-dialog').getAttribute('open'),'');
 assert.equal(await page.locator('#end-day-dialog h2').textContent(),'Encerrar por hoje','o miolo do Encerrar vem da view do Bend');
 assert.equal(await page.locator('#end-day-dialog label').first().textContent(),'Onde parei');
 assert.equal(await page.locator('#end-day-save').getAttribute('value'),'ok','o botão de salvar mantém id/value');
 await page.locator('#end-day-dialog button[value="cancel"]').click();await page.waitForFunction(()=>!document.querySelector('#end-day-dialog').open);
 await tutorMore(page,'#end-day').click();await page.locator('#end-where').fill('terminei a questão 7b');await page.locator('#end-next').fill('começar a questão 8');await page.locator('#end-day-save').click();
 await page.waitForFunction(()=>document.querySelector('#messages').textContent.includes('terminei a questão 7b')&&document.querySelector('#messages').textContent.includes('começar a questão 8'));
 const saved=fs.readdirSync(runtime).filter(name=>name.endsWith('.jsonl')).map(name=>fs.readFileSync(path.join(runtime,name),'utf8')).join('\n');assert.match(saved,/Onde parei: terminei a questão 7b/);assert.match(saved,/Próximo passo: começar a questão 8/);
 assert.match(saved,/Por que isso vale/);
 assert.match(saved,/> A identidade de Pitágoras: \$a\^2 \+ b\^2 = c\^2\$ vale/);
 assert.match(saved,/"type":"image","data":"iVBOR/);
 assert.match(saved,/"mimeType":"image\/png"/);
 await page.locator('#study-menu .nav-trigger').click();
 const secondName=selects[1].split(/[/\\]/).at(-1);assert.match(await page.locator('#context-summary').textContent(),new RegExp(secondName.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
 await page.locator('#reference-toggle').click();assert.equal(await page.locator('.pdf-panel').nth(1).isVisible(),false);assert.doesNotMatch(await page.locator('#context-summary').textContent(),new RegExp(secondName.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));await page.locator('#reference-toggle').click();assert.match(await page.locator('#context-summary').textContent(),new RegExp(secondName.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
 const continuous=await page.locator('.pdf-viewport').first().evaluate(el=>{const pages=el.querySelectorAll('.pdf-page');el.scrollTop=Math.max(0,pages[1].offsetTop-40);el.dispatchEvent(new Event('scroll'));return {pages:pages.length,top:el.scrollTop,second:pages[1].offsetTop};});
 assert.ok(continuous.pages>1&&continuous.top>0&&continuous.top<continuous.second,'PDF scroll should remain between pages');
 const divider=page.locator('.pdf-divider');
 assert.equal(await divider.count(),1);assert.equal(await divider.isVisible(),true);
 // minimizar um leitor (split ainda no default): o outro ocupa a largura e o estado persiste
 const panel0=page.locator('.pdf-panel').first(),panel1=page.locator('.pdf-panel').nth(1);
 const box0=await panel0.boundingBox(),box1=await panel1.boundingBox();
 await menuLocator(panel0,'.collapse').click();
 await page.waitForFunction(()=>document.querySelector('.pdf-panel').classList.contains('minimized'),undefined,{timeout:5000});
 assert.equal(await panel0.locator('.collapse').getAttribute('aria-pressed'),'true','o botão marca o leitor minimizado');
 const min0=await panel0.boundingBox(),max1=await panel1.boundingBox();
 assert.ok(min0.width<=40&&min0.height>200,'o leitor minimizado vira uma faixa estreita');
 assert.ok(max1.width>box1.width+200,'o outro leitor ocupa a largura liberada (p0 '+Math.round(box0.width)+'→'+Math.round(min0.width)+', p1 '+Math.round(box1.width)+'→'+Math.round(max1.width)+')');
 await pollUntil(()=>deskJson(runtime),desk=>desk?.pdfs?.[0]?.minimized===true,{what:'desk.json com pdfs[0].minimized=true'}).catch(()=>{});
 assert.equal(deskJson(runtime).pdfs[0].minimized,true,'minimized persists');
 await menuLocator(panel0,'.collapse').click();
 await page.waitForFunction(()=>!document.querySelector('.pdf-panel').classList.contains('minimized'),undefined,{timeout:5000});
 const restored=await panel0.boundingBox();
 assert.ok(Math.abs(restored.width-box0.width)<80,'o leitor volta à largura de antes ('+Math.round(box0.width)+' → '+Math.round(restored.width)+')');
 assert.equal(await panel0.locator('.collapse svg.icon').count(),1,'o ícone do colapsar sobrevive ao swap do botão');
 assert.equal(await panel0.locator('.collapse').getAttribute('data-icon'),null,'o andaime data-icon não vaza no swap');
 const before=await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--pdf-left')||'50%');
 const box=await divider.boundingBox();
 await page.mouse.move(box.x+Math.round(box.width/2),box.y+Math.round(box.height/2));
 await page.mouse.down();
 await page.mouse.move(box.x-140,box.y+Math.round(box.height/2),{steps:4});
 await page.mouse.up();
 const after=await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--pdf-left'));
 assert.notEqual(after.trim(),before.trim(),'divider drag should move the split');
 await divider.focus();
 await page.keyboard.press('ArrowRight');
 await page.waitForFunction(v=>getComputedStyle(document.documentElement).getPropertyValue('--pdf-left').trim()!==v.trim(),after,{timeout:3000}).catch(()=>{});
 const afterKey=await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--pdf-left'));
 assert.notEqual(afterKey.trim(),after.trim(),'divider keyboard should adjust the split');
 const deskState=await pollUntil(()=>deskJson(runtime),desk=>typeof desk?.pdfSplit==='number'&&desk.pdfSplit>.2&&desk.pdfSplit<.8,{what:'desk.json com pdfSplit entre 0,2 e 0,8'}).catch(()=>deskJson(runtime));
 assert.ok(deskState.pdfSplit>.2&&deskState.pdfSplit<.8,'pdfSplit should persist');
 // um aviso por vez: o repetido não acumula nem ganha contador; o novo substitui
 await page.evaluate(()=>{document.querySelector('#expression').value='sqrt(';const button=document.querySelector('#calc-form button');button.click();button.click();button.click();});
 await page.waitForFunction(()=>document.querySelectorAll('#toast .toast-item').length>=1,{timeout:5000});
 await page.waitForTimeout(150);// espera fixa: "nada acontece em 0,15 s" — o mesmo aviso não se duplica
 assert.deepEqual(await page.locator('#toast .toast-item').evaluateAll(es=>es.map(el=>el.textContent)),['Expressão inválida. Use números, operadores e funções disponíveis.'],'o mesmo aviso disparado várias vezes aparece uma vez, sem contador');
 assert.deepEqual(await page.locator('#toast .toast-item').evaluateAll(es=>es.map(el=>el.getAttribute('class'))),['toast-item'],'item aberto sem classe de saída');
 await page.locator('#angle button[data-angle="deg"]').click();
 await page.evaluate(()=>{document.querySelector('#expression').value='tan(90)';document.querySelector('#calc-form button').click();});
 await page.waitForFunction(()=>[...document.querySelectorAll('#toast .toast-item')].some(el=>el.textContent.includes('Resultado indefinido')),{timeout:5000});
 assert.equal(await page.locator('#toast .toast-item').count(),1,'o aviso novo substitui o anterior: um só na tela');
 assert.doesNotMatch(await page.locator('#toast').textContent(),/Use números/,'o anterior saiu');
 const closing=await page.waitForFunction(()=>{const cs=[...document.querySelectorAll('#toast .toast-item.closing')].map(el=>el.getAttribute('class'));return cs.length?[...new Set(cs)]:false;},undefined,{timeout:6000}).then(handle=>handle.jsonValue());
 assert.deepEqual(closing,['toast-item closing out'],'a saída entra no fim, juntas, antes de sumir');
 await page.waitForFunction(()=>!document.querySelector('#toast .toast-item'),{timeout:8000});
 // ⌘\ recolhe o chat; botão flutuante devolve
 await page.keyboard.press('ControlOrMeta+\\');
 await page.waitForFunction(()=>document.body.classList.contains('chat-collapsed'),{timeout:5000});
 assert.equal(await page.locator('#chat').isVisible(),false,'chat hides when collapsed');
 assert.equal(await page.locator('#chat-restore').isVisible(),true,'floating restore button shows');
 const refsCollapsed=await page.evaluate(()=>Math.round(document.querySelector('#references').getBoundingClientRect().width));
 await page.locator('#chat-restore').click();
 await page.waitForFunction(()=>!document.body.classList.contains('chat-collapsed'),{timeout:5000});
 assert.equal(await page.locator('#chat').isVisible(),true,'chat comes back');
 assert.ok(refsCollapsed>await page.evaluate(()=>Math.round(document.querySelector('#references').getBoundingClientRect().width))+100,'collapsing the chat widens the readers');
 await page.waitForFunction(()=>document.querySelector('.pdf-panel canvas'),{timeout:15000});
 // ⌘F foca a busca do PDF do painel ativo; Esc limpa e devolve o foco
 await page.keyboard.press('ControlOrMeta+f');
 await page.waitForFunction(()=>{const form=document.querySelector('.pdf-panel .pdf-find');return form&&!form.hidden&&document.activeElement===form.querySelector('input');},{timeout:5000});
 await page.keyboard.press('Escape');
 await page.waitForFunction(()=>{const form=document.querySelector('.pdf-panel .pdf-find');return !!form&&form.hidden&&document.querySelector('.pdf-panel').contains(document.activeElement);},{timeout:5000});
 // inverter páginas: classe, aria-pressed e persistência por documento
 await menuLocator(page.locator('.pdf-panel').first(),'.invert').click();
 await page.waitForFunction(()=>{const viewport=document.querySelector('.pdf-panel .pdf-viewport');return !!viewport&&viewport.classList.contains('inverted');},{timeout:5000});
 assert.equal(await page.locator('.pdf-panel').first().locator('.invert').getAttribute('aria-pressed'),'true');
 await page.waitForFunction(()=>{const canvas=document.querySelector('.pdf-panel .pdf-page canvas');return !!canvas&&getComputedStyle(canvas).filter.includes('invert(1)');},{timeout:5000});
 await pollUntil(()=>deskJson(runtime),desk=>desk?.pdfs?.[0]?.invert===true,{what:'desk.json com pdfs[0].invert=true'}).catch(()=>{});
 assert.equal(deskJson(runtime).pdfs[0].invert,true,'invert persists per document');
 await menuLocator(page.locator('.pdf-panel').first(),'.invert').click();
 await page.waitForFunction(()=>{const viewport=document.querySelector('.pdf-panel .pdf-viewport');return !!viewport&&!viewport.classList.contains('inverted');},{timeout:5000});
 await page.locator('#settings-menu .nav-trigger').click();
 await page.locator('#settings').click();
 await page.waitForSelector('#settings-dialog[open]');
 assert.equal(await page.locator('#settings-title').textContent(),'Configurações','título do diálogo vem da view do Bend');
 await page.locator('#settings-tab-avisos').click();
 // densidade e avisos desenhados pelo Bend (§4.8): opções/selected, body.dense e persistência
 const density=page.locator('#density-mode');
 assert.deepEqual(await density.locator('option').evaluateAll(es=>es.map(o=>o.value)),['padrao','compacta'],'opções do #density-mode vêm do núcleo');
 assert.equal(await density.locator('option[selected]').getAttribute('value'),'padrao','o modo corrente marca o selected');
 await density.selectOption('compacta');
 await page.waitForFunction(()=>document.body.classList.contains('dense'));
 assert.equal(await page.evaluate(()=>localStorage.getItem('mesa.density')),'compacta','a densidade persiste no localStorage');
 assert.equal(await density.locator('option[selected]').getAttribute('value'),'compacta','o re-render do núcleo marca a opção escolhida');
 await density.selectOption('padrao');
 await page.waitForFunction(()=>!document.body.classList.contains('dense'));
 const avisos=await page.evaluate(()=>({
  role:document.querySelector('#notify-mode').getAttribute('role'),
  aria:document.querySelector('#notify-mode').getAttribute('aria-label'),
  legend:document.querySelector('#notify-mode > .set-group-label')?.textContent??null,
  first:document.querySelector('#notify-mode')?.firstElementChild?.classList.contains('set-group-label')??false,
  rows:[...document.querySelectorAll('#notify-mode .set-check')].map(row=>({id:row.querySelector('input').id,checked:row.querySelector('input').checked,label:row.querySelector('span').textContent})),
 }));
 assert.equal(avisos.role,'group','#notify-mode é o grupo do núcleo');
 assert.equal(avisos.aria,'Avisos de conclusão');
 assert.equal(avisos.legend,'Avisos de conclusão','a legenda visível do grupo sobrevive ao render do núcleo');
 assert.equal(avisos.first,true,'a legenda continua o primeiro filho do grupo');
 assert.deepEqual(avisos.rows.map(r=>r.id),['notify-sound','notify-desktop','notify-focused'],'linhas de aviso na ordem do núcleo');
 assert.deepEqual(avisos.rows.map(r=>r.checked),[true,true,false],'marcação reflete as preferências');
 assert.equal(avisos.rows[2].label,'Avisar mesmo com a janela em foco');
 await page.locator('#notify-focused').click();
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('mesa.notify')||'{}').focused===true);
 assert.equal(await page.locator('#notify-focused').isChecked(),true,'a caixa continua marcada depois do re-render do núcleo');
 await page.locator('#notify-focused').click();
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('mesa.notify')||'{}').focused===false);
 await page.locator('#settings-tab-materias').click();
 const rowsBefore=await page.locator('#cfg-courses .cfg-course').count();
 assert.ok(rowsBefore>=1,'a view do Bend desenha as linhas de matéria');
 await page.locator('#cfg-add-course').click();
 assert.equal(await page.locator('#cfg-courses .cfg-course').count(),rowsBefore+1,'Adicionar matéria acrescenta a linha (view do Bend)');
 const addedRow=page.locator('#cfg-courses .cfg-course').last();
 assert.equal(await addedRow.locator('.cfg-name').getAttribute('placeholder'),'Nome');
 assert.equal(await addedRow.locator('.cfg-remove').getAttribute('aria-label'),'Remover');
 await addedRow.locator('.cfg-remove').click();
 assert.equal(await page.locator('#cfg-courses .cfg-course').count(),rowsBefore,'Remover tira a linha (handler do aplicador)');
 await page.locator('#settings-dialog button[value="cancel"]').last().click();
 await page.waitForFunction(()=>!document.querySelector('#settings-dialog').open);
 // dica: o balão .tip é do núcleo; o alvo troca title → data-tip enquanto armado
 await page.locator('#new-tab').hover();
 await page.waitForSelector('.tip:not([hidden])',{timeout:5000});
 assert.equal(await page.locator('.tip').textContent(),'Nova matéria (abre as Configurações)','o balão mostra o texto do alvo');
 assert.equal(await page.locator('#new-tab').getAttribute('title'),null,'o title sai do DOM enquanto o balão está armado');
 assert.equal(await page.locator('#new-tab').getAttribute('data-tip'),'Nova matéria (abre as Configurações)','o alvo guarda o texto em data-tip');
 await page.mouse.move(6,400);
 await page.waitForFunction(()=>document.querySelector('#new-tab').hasAttribute('title'),undefined,{timeout:5000});
 assert.equal(await page.evaluate(()=>document.querySelector('#new-tab').dataset.tip),undefined,'data-tip sai quando o alvo é liberado');
 // ajuda e sobre: versão como fato e itens que as flags escondem
 await page.locator('#settings-menu .nav-trigger').click();
  await page.locator('#help').click();
  await page.waitForSelector('#help-dialog[open]');
  assert.match(await page.locator('#help-version').textContent(),/^Mesa de Estudos \d/,'a versão da ajuda vem da view do Bend');
  await page.locator('#keys-customize').click();
  await page.waitForSelector('#keys-dialog[open]');
  assert.equal(await page.locator('#keys-title').textContent(),'Atalhos de teclado','o editor abre com o título da view do Bend');
  assert.deepEqual(await page.locator('#keys-dialog .keys-group > h3').evaluateAll(es=>es.map(el=>el.textContent)),['Estudar','Visualização','Ajuda','Arquivo','Tutor'],'as seções mantêm a ordem do catálogo');
  assert.equal(await page.locator('#keys-dialog .keys-row[data-action="check"]').getAttribute('data-key'),'check','cada linha tem key estável para foco');
  assert.equal(await page.locator('#keys-dialog .keys-row.is-fixed .keys-note').first().textContent(),'fixo','atalho fixo recebe a nota da view');
  assert.equal(await page.locator('#keys-reset-all').isDisabled(),true,'sem overrides a ação global vem disabled como fato');
  await page.locator('#keys-dialog .keys-row[data-action="check"] .keys-rec').click();
  await page.waitForFunction(()=>document.querySelector('#keys-dialog .keys-row[data-action="check"]')?.classList.contains('recording'));
  assert.equal(await page.locator('#keys-dialog .keys-row[data-action="check"] .keys-kbd').textContent(),'Gravando…','a tecla efetiva vira o estado de gravação');
  assert.equal(await page.locator('#keys-dialog .keys-row[data-action="check"] .keys-rec').getAttribute('aria-pressed'),'true');
  await page.keyboard.press('Escape');
  await page.waitForFunction(()=>!document.querySelector('#keys-dialog .keys-row[data-action="check"]')?.classList.contains('recording'));
  assert.equal(await page.locator('#keys-status').textContent(),'Gravação cancelada.','Esc cancela a captura sem fechar o diálogo');
  await page.locator('#keys-done').click();
  await page.waitForFunction(()=>!document.querySelector('#keys-dialog').open);
  await page.locator('#help-dialog .dialog-close').click();
 await page.waitForFunction(()=>!document.querySelector('#help-dialog').open);
 await page.locator('#settings-menu .nav-trigger').click();
 await page.locator('#about').click();
 await page.waitForSelector('#about-dialog[open]');
 assert.match(await page.locator('#about-lead').textContent(),/^Versão \d.*licença MIT$/,'o lead do Sobre carrega a versão');
 await page.locator('#about-dialog .dialog-close').click();
 await page.waitForFunction(()=>!document.querySelector('#about-dialog').open);
 // Conferir Xournal++ virou anexo: captura → bandeja → envio com UMA imagem no JSONL
 if(process.platform==='darwin'){
  await app.evaluate(({ipcMain})=>{ipcMain.removeHandler('capture-ready');ipcMain.handle('capture-ready',async()=>({title:'Xournal++',dataUrl:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='}));});
  const msgsBeforeCapture=await page.locator('#messages .message').count();
  await page.locator('#check').click();
  await page.waitForFunction(()=>document.querySelectorAll('#attachments .attachment').length===1,undefined,{timeout:8000});
  await toastWait(page,'Captura do Xournal++ anexada');
  assert.equal(await page.locator('#attachments .attachment').count(),1,'a captura vira anexo na bandeja');
  assert.equal(await page.locator('#attachments .attachment img').getAttribute('alt'),'Anexo: xournal.png','o anexo da captura se chama xournal.png');
  assert.equal(await page.evaluate(()=>document.activeElement?.id),'prompt','o foco vai para o prompt');
  assert.equal(await page.locator('#messages .message').count(),msgsBeforeCapture,'nada é enviado sozinho');
  await page.locator('#prompt').fill('Confere a captura anexada');
  await page.locator('#send').click();
  await page.waitForFunction(()=>!document.querySelector('#send').disabled);
  const lastUser=fs.readFileSync(sessionFile,'utf8').trim().split('\n').map(l=>JSON.parse(l)).reverse().find(r=>r.message?.role==='user');
  assert.equal(lastUser.message.content.filter(p=>p?.type==='image').length,1,'o JSONL guarda exatamente UMA imagem');
  assert.equal(await page.locator('#attachments').isHidden(),true,'a bandeja esvazia no envio');
  // /conferir digitado na mão redireciona para o anexo e devolve a observação
  await page.locator('#prompt').fill('/conferir olha o passo 3');
  await page.locator('#send').click();
  await page.waitForFunction(()=>document.querySelectorAll('#attachments .attachment').length===1,undefined,{timeout:8000});
  assert.equal(await page.locator('#attachments .attachment').count(),1,'/conferir vira anexo, não envio');
  await page.waitForFunction(()=>document.querySelector('#prompt')?.value==='olha o passo 3',undefined,{timeout:8000});
  assert.equal(await page.locator('#messages .message').count(),msgsBeforeCapture+1,'o /conferir não enviou mensagem');
  await page.locator('#attachments .attachment-remove').click();
  await page.locator('#prompt').fill('');
 }
 await page.screenshot({path:path.join(screenshotDirectory('ui-smoke'),'ui-desktop.png')});
 const courseTabs=page.locator('#course-tabs button[role="tab"]:not(#review-tab)');
 assert.ok(await courseTabs.count()>=1,'course tabs render');
 const activeTab=page.locator('#course-tabs button.active');
 assert.equal(await activeTab.count(),1,'exactly one tab is active');
 assert.equal(await activeTab.getAttribute('data-id'),'Calculus I','the persisted course is the active tab');
 assert.equal(await activeTab.getAttribute('aria-selected'),'true','active tab is aria-selected');
 await resizeWindow(app,page,1050,760);await layoutStable(page,'#messages');await page.screenshot({path:path.join(screenshotDirectory('ui-smoke'),'ui-compact.png')});
 assert.deepEqual(errors,[]);console.log('UI PASSED: PDFs, live context summary, end-of-day JSONL, calculator, in-chat images, quiz cards (incl. dont-know), quote with inline/display LaTeX, attachments, settings/help/about (rows and version from the Bend view), single toast, chat collapse (⌘\\), ⌘F find, invertible pages, desktop/compact.');
});

await withArtifacts('flags',async ctx=>{
 const runtime=ctx.runtime=newRuntime('flags');
 seedCourse(runtime,'Flags');
 writeDeskJson(runtime,{courseId:'Flags'});
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'Flags',name:'Matéria de teste',path:path.join(runtime,'learning','Courses','Flags')}],desk:{refsToggle:false,endDay:false,studyContext:false,calculator:false,conferir:false,xournal:false}});
 const app=ctx.app=await launchDesk({runtime,env:{LEARNING_VAULT:runtime}});
 const page=await app.firstWindow();
 await page.waitForSelector('.pdf-panel',{timeout:30000});
 assert.equal(await page.locator('#include-refs').isHidden(),true,'refsToggle flag hides the references button');
 assert.equal(await page.locator('#include-refs').getAttribute('aria-pressed'),'true','sem o botão as referências ficam ligadas (view do Bend)');
 assert.equal(await page.locator('#end-day').getAttribute('hidden'),'','endDay flag hides the end-of-day menu item');
 assert.equal(await page.locator('#context-edit').isHidden(),true,'studyContext flag hides the study context editing');
 assert.equal(await page.locator('#calculator').isHidden(),true,'calculator flag hides the calculator section (view do Bend)');
 assert.equal(await page.locator('#calc-divider').isHidden(),true,'calculator flag hides the calc divider');
 assert.equal(await page.locator('#check').isHidden(),true,'conferir flag hides the check button');
 assert.equal(await page.locator('.pdf-panel .invert').first().getAttribute('aria-pressed'),'false','o inverter nasce com aria-pressed="false" (contrato do Electron)');
 // o menu Estudar é do `core/tabsview.bend`: o xournal segue a flag e o toggle do
 // 2º painel fica visível com o rótulo do `desk` normalizado (não é mais o applyDesk)
 assert.equal(await page.locator('#xournal').isHidden(),true,'xournal flag hides the menu item (view do Bend)');
 assert.equal(await page.locator('#reference-toggle').getAttribute('hidden'),null,'com 2 painéis o toggle do formulário fica visível');
 assert.equal((await page.locator('#reference-toggle').textContent()).trim(),'Formulário','o rótulo do toggle vem da view do Bend');
 assert.equal(await page.locator('#help-endday-li').isHidden(),true,'help text follows the flag');
 assert.equal(await page.locator('#help-study-li').isHidden(),true,'help text follows the study flag');
 assert.equal(await page.locator('#help-refs-li').isHidden(),true,'help text follows the refs flag');
 await page.locator('#settings-menu .nav-trigger').click();
 await page.locator('#settings').click();
 await page.waitForSelector('#settings-dialog[open]');
 const deskRaw=JSON.parse(fs.readFileSync(path.join(runtime,'config.json'),'utf8'));
 assert.equal(deskRaw.desk.refsToggle,false);assert.equal(deskRaw.desk.endDay,false);assert.equal(deskRaw.desk.studyContext,false);
 // Enter num campo salva: o `<form method="dialog">` herdado ativava o "×"
 // (primeiro submit, `value=cancel`) e a edição era descartada como cancelamento
 await page.locator('#settings-tab-pastas').click();
 await page.locator('#cfg-pi').fill('/tmp/pi-do-enter');
 await page.locator('#cfg-pi').press('Enter');
 await page.waitForFunction(()=>!document.querySelector('#settings-dialog').open);
 const cfgAfter=await page.evaluate(()=>window.desk.getConfig());
 assert.equal(cfgAfter.config.piPath,'/tmp/pi-do-enter','Enter num campo salva as Configurações');
 assert.equal(cfgAfter.config.desk.endDay,false,'as flags do diálogo seguem no config salvo');
 console.log('FLAGS PASSED: refsToggle/endDay/studyContext/calculator/xournal hide their UI and survive the settings dialog.');
});

await withArtifacts('tabs',async ctx=>{
 const runtime=ctx.runtime=newRuntime('tabs');
 seedCourse(runtime,'A');seedCourse(runtime,'B');
 const textPdf=path.join(runtime,'learning','Courses','A','Integral.pdf');
 fs.writeFileSync(textPdf,tinyPdf('Integral de teste para citar',3));
 const seededSession=seedSession(runtime,[
  {type:'message',message:{role:'user',content:[{type:'text',text:'Integral: como você resolveria a questão 2?'}]}},
  {type:'message',message:{role:'assistant',content:[{type:'text',text:'Pense em fatias sob a curva; depois use o quiz para checar.\n\n```js\nconst area = fatias.reduce((s, f) => s + f, 0);\n```'}]}}
 ]);
 const olderSession=path.join(runtime,'pi-1700000000000.jsonl');
 fs.writeFileSync(olderSession,JSON.stringify({type:'message',message:{role:'user',content:[{type:'text',text:'sessão anterior curta'}]}})+'\n');
 writeDeskJson(runtime,{session:seededSession,courseId:'A',courseStates:{A:{session:seededSession,pdfs:[{path:textPdf,page:1,zoom:1,scrollX:0,scrollY:0}],sessions:[{path:seededSession,started:Date.now(),preview:'sessão integral'},{path:olderSession,started:1700000000000,preview:'sessão anterior curta'}]}}});
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'A',name:'Matéria A',path:path.join(runtime,'learning','Courses','A')},{id:'B',name:'Matéria B',path:path.join(runtime,'learning','Courses','B')}]});
 const app=ctx.app=await launchDesk({runtime,env:{LEARNING_VAULT:runtime}});
 const page=await app.firstWindow();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.text().startsWith('[dbg]'))console.log('[page]',m.text());});
 await page.waitForSelector('.pdf-panel',{timeout:30000});
 const tabs=page.locator('#course-tabs button[role="tab"]:not(#review-tab)');
 await page.waitForFunction(()=>{const tabs=[...document.querySelectorAll('#course-tabs button[role="tab"]:not(#review-tab)')];return tabs.length===4&&tabs.every(tab=>!tab.disabled);},{timeout:30000});
 // deixa a conexão automática do boot assentar: clicar durante o connect inicial é a corrida que o waitIdle cobre, mas o teste não precisa dela
 await statusOnline(page);
 await sendEnabled(page,{timeout:30000});
 assert.equal(await tabs.count(),4,'Livre, two courses and the GeoGebra tab');
 assert.equal(await page.locator('#course-tabs button[data-id="mesa-free"]').textContent(),'Livre','the fixed Livre tab is present');
 assert.equal(await tabs.last().textContent(),'GeoGebra','last tab is GeoGebra');
 assert.equal(await page.locator('#course-tabs button[data-id="A"]').getAttribute('aria-selected'),'true','saved course starts active');
 // abas e menus vêm da view do Bend (core/tabsview.bend): ids/ordem e andaime limpo
 assert.equal(await page.locator('#new-tab').getAttribute('title'),'Nova matéria (abre as Configurações)','o "+" é o nó da view');
 assert.deepEqual(await page.locator('#study-pop button[role="menuitem"]').evaluateAll(es=>es.map(e=>e.id)),['study-search-open','study-review-today','study-notes-open','study-stats-open','study-backup-open','study-share-open','study-tutor-pdf','xournal','reference-toggle'],'itens do menu Estudar na ordem (o Encerrar mora no Mais opções do tutor)');
 assert.deepEqual(await page.locator('#new-session-pop button[role="menuitem"]').evaluateAll(es=>es.map(e=>e.id)),['new-session-default','new-session-claude','new-session-opencode'],'itens da sessão nova na ordem');
 assert.deepEqual(await page.locator('#chat-more-pop [role^="menuitem"]').evaluateAll(es=>es.map(e=>e.id)),['export-chat','end-day','more-auto-compact','more-compact-now','more-triage','chat-collapse'],'itens do Mais opções do tutor na ordem');
 assert.deepEqual(await page.locator('#settings-pop button[role="menuitem"]').evaluateAll(es=>es.map(e=>e.id)),['settings','help','shortcuts','about'],'itens do menu Ajustes na ordem');
 assert.equal(await page.locator('#course-tabs [data-icon],#study-pop [data-icon],#settings-pop [data-icon],#new-session-pop [data-icon],#chat-more-pop [data-icon]').count(),0,'o andaime data-icon sai do DOM');
 assert.equal(await page.locator('#settings-trigger svg.icon').count(),1,'o botão Ajustes é um ícone');
 assert.equal(await page.locator('#theme-cycle').count(),0,'o ciclo de tema saiu da barra');
 assert.equal(await page.locator('#course-tabs [data-id="geogebra"] svg.icon').count(),1,'a aba GeoGebra tem o glifo graph (eixos + parábola)');
 await page.locator('#course-tabs button[data-id="B"]').click();
 await page.waitForFunction(()=>{const tab=document.querySelector('#course-tabs button[data-id="B"]');return tab?.classList.contains('active')&&tab?.getAttribute('aria-selected')==='true';},{timeout:15000});
 assert.match(await page.title(),/Matéria B/,'document title follows the active tab');
 assert.equal(await page.locator('.reader-sheet').count(),2,'empty course shows the Lista 0 sheet in each reader');
 await statusOnline(page);
 await page.waitForFunction(()=>[...document.querySelectorAll('#course-tabs button[role="tab"]:not(#review-tab)')].every(tab=>!tab.disabled),{timeout:30000});
 await page.keyboard.press('ControlOrMeta+2');
 await page.waitForFunction(()=>{const tab=document.querySelector('#course-tabs button[data-id="A"]');return tab?.classList.contains('active')&&tab?.getAttribute('aria-selected')==='true';},{timeout:15000});
 assert.match(await page.title(),/Matéria A/,'⌘2 returns to the first configured course');
 await page.waitForFunction(()=>[...document.querySelectorAll('#course-tabs button[role="tab"]:not(#review-tab)')].every(tab=>!tab.disabled),{timeout:30000});
 // roving tabindex vem do núcleo: ativa `0`, demais `-1`; as setas movem o
 // foco e ativam como o clique (⌘1..9 (Livre occupies ⌘1) e clique seguem iguais)
 const rovingInitial=await page.evaluate(()=>[...document.querySelectorAll('#course-tabs button[role="tab"]:not(#review-tab)')].map(t=>[t.dataset.id,t.getAttribute('tabindex'),t.classList.contains('active')]));
 assert.deepEqual(rovingInitial,[['mesa-free','-1',false],['A','0',true],['B','-1',false],['geogebra','-1',false]],'o tablist usa roving tabindex vindo da view do Bend');
 await page.locator('#course-tabs button[data-id="A"]').focus();
 await page.keyboard.press('ArrowRight');
 await page.waitForFunction(()=>{const t=document.querySelector('#course-tabs button[data-id="B"]');return document.activeElement===t&&t.classList.contains('active');},{timeout:15000});
 assert.deepEqual(await page.evaluate(()=>[...document.querySelectorAll('#course-tabs button[role="tab"]:not(#review-tab)')].map(t=>[t.dataset.id,t.getAttribute('tabindex'),t.classList.contains('active')])),[['mesa-free','-1',false],['A','-1',false],['B','0',true],['geogebra','-1',false]],'a seta move o foco e ativa a aba (roving atualizado)');
 /* #42: durante a ligação a matéria atual fica livre e as outras travam (a seta
    pula as travadas); espera o tutor ligar antes de voltar com a seta. */
 await statusOnline(page);
 await page.waitForFunction(()=>[...document.querySelectorAll('#course-tabs button[role="tab"]:not(#review-tab)')].every(tab=>!tab.disabled),{timeout:30000});
 await page.keyboard.press('ArrowLeft');
 await page.waitForFunction(()=>{const t=document.querySelector('#course-tabs button[data-id="A"]');return document.activeElement===t&&t.classList.contains('active');},{timeout:15000});
 assert.match(await page.title(),/Matéria A/,'a seta de volta reativa a matéria');
 await statusOnline(page);
 await page.waitForFunction(()=>[...document.querySelectorAll('#course-tabs button[role="tab"]:not(#review-tab)')].every(tab=>!tab.disabled),{timeout:30000});
 await page.waitForFunction(()=>document.title.includes('p. 1'),{timeout:15000});
 await page.waitForSelector('.textLayer span',{timeout:30000});
 await page.waitForFunction(()=>document.querySelector('.textLayer')?.textContent.includes('Integral de teste'),{timeout:30000});
 const frame=await page.evaluate(()=>({pages:[...document.querySelector('.pdf-panel .pdf-document').children].map(el=>el.dataset.page),total:document.querySelector('.pdf-panel .page-total').textContent}));
 assert.deepEqual(frame.pages,['1'],'a âncora data-page vem da view do Bend');
 assert.equal(frame.total,'/ 1','o total do rodapé bate com as páginas montadas');
 // the course switch resizes the panels once more after the PDF loads; (re)select the live span until Citar shows
 await page.waitForFunction(()=>{
  const span=document.querySelector('.textLayer span');
  if(!span)return false;
  const selection=getSelection();
  if(selection.isCollapsed||!selection.rangeCount||!String(selection).includes('Integral de teste')){
   const range=document.createRange();range.selectNodeContents(span);
   selection.removeAllRanges();selection.addRange(range);
   return false;
  }
  return !document.querySelector('#quote-btn').hidden;
 },{timeout:15000});
 await page.locator('#quote-btn').click();
 await page.waitForFunction(()=>document.querySelector('#prompt').value.includes('> Integral de teste'));
 const pdfQuote=await page.locator('#prompt').inputValue();
 assert.match(pdfQuote,/Integral\.pdf, p\. 1/,'PDF quote carries the file name and page');
 await menuLocator(page.locator('.pdf-panel').first(),'.page-shot').click();
 await page.waitForSelector('#attachments .attachment img',{timeout:15000});
 assert.match(await page.locator('#attachments .attachment img').getAttribute('alt'),/-p1\.png/,'page shot attachment keeps the page in the name');
 const panel=page.locator('.pdf-panel').first();
 await panel.locator('.find-toggle').click();
 await panel.locator('.pdf-find input').fill('integral');
 await panel.locator('.pdf-find button').click();
 await page.waitForSelector('.pdf-panel .pdf-hl',{timeout:15000});
 const findCount=await panel.locator('.find-count').textContent();
 assert.ok(findCount.trim(),'find counter shows a result count');
 assert.match(findCount,/1\/3/,'counter is first of three occurrences');
 const hl=await panel.locator('.pdf-hl').first().evaluate(el=>({tag:el.tagName,cls:el.className,text:el.textContent,layer:!!el.closest('.textLayer')}));
 assert.equal(hl.tag,'I');assert.equal(hl.cls,'pdf-hl');assert.match(hl.text,/^Integral$/,'o destaque guarda o texto original');assert.equal(hl.layer,true,'o destaque vive no textLayer');
 await panel.locator('.pdf-find button').click();
 await panel.locator('.pdf-hl').first().waitFor({state:'visible',timeout:5000}).catch(()=>{});
 assert.ok(await panel.locator('.pdf-hl').first().isVisible(),'cycling the search keeps highlights');
 const first=page.locator('.message').first();
 assert.equal(await first.getAttribute('data-role'),'user','bolha Bend expõe data-role sem mudar as classes do contrato');
 await first.hover();
 await first.locator('.msg-copy').click();
 await page.waitForFunction(()=>!document.querySelector('#toast').hidden&&document.querySelector('#toast').textContent.includes('Mensagem copiada'),{timeout:10000});
 const codeBlock=page.locator('.codeblock').first();
 assert.equal(await codeBlock.count(),1,'seeded fenced code renders as a copyable block');
 await codeBlock.hover();
 await page.locator('.code-copy').first().click();
 await page.waitForFunction(()=>document.querySelector('.code-copy')?.classList.contains('ok'),{timeout:5000});
 assert.equal(await page.locator('.code-copy').first().textContent(),'copiado','code copy button confirms');
 await tutorMore(page,'#export-chat').click();
 await page.waitForFunction(()=>!document.querySelector('#toast').hidden&&document.querySelector('#toast').textContent.includes('exportada'),{timeout:15000});
 const exportDir=path.join(runtime,'Mesa de Estudos');
 const exported=fs.readdirSync(exportDir).filter(n=>n.endsWith('.md'));
 assert.equal(exported.length,1,'export writes one markdown file into the vault folder');
 const markdown=fs.readFileSync(path.join(exportDir,exported[0]),'utf8');
 assert.match(markdown,/## Pi/);assert.match(markdown,/## Você/);
 assert.match(markdown,/Integral/);assert.match(markdown,/quiz/);
 await pickTheme(page,'light');
 assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),'light','a busca de comandos aplica o tema claro');
 await pickTheme(page,'dark');
 assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),'dark','a busca de comandos aplica o tema escuro');
 await pollUntil(()=>deskJson(runtime),desk=>desk?.theme==='dark',{what:'desk.json com theme=dark'}).catch(()=>{});
 assert.equal(deskJson(runtime).theme,'dark','theme persists to desk.json');
 assert.deepEqual(errors,[]);console.log('TABS PASSED: two courses as tabs, click switches course (aria-selected, title, placeholders), ⌘1 returns to the first; PDF text layer feeds Citar and page-shot attaches the page as image; find scans all pages with highlight+counter, message copy overlay, Markdown export, and theme cycle persist.');
 // GeoGebra: aba especial + ponte HTTP local
 await page.locator('#course-tabs button[data-id="geogebra"]').click();
 await page.waitForFunction(()=>document.querySelector('#references').classList.contains('ggb')&&!document.querySelector('#ggb-bar').hidden);
 assert.notEqual(await page.locator('#pdf-grid').first().evaluate(el=>getComputedStyle(el).visibility),'visible','PDF grid hides while GeoGebra tab is active');
 await (await pageWindow(app,page)).evaluate(win=>{if(win.contentView.children.length<1)throw Error('GeoGebra view not attached');});
 const bridge=JSON.parse(fs.readFileSync(path.join(runtime,'ggb-bridge.json'),'utf8'));
 const denied=await fetch(`http://127.0.0.1:${bridge.port}/run`,{method:'POST',headers:{'content-type':'application/json','x-desk-token':'errado'},body:JSON.stringify({command:'f(x)=x'})});
 assert.equal(denied.status,403,'bridge rejects wrong tokens');
 const rejected=await fetch(`http://127.0.0.1:${bridge.port}/run`,{method:'POST',headers:{'content-type':'application/json','x-desk-token':bridge.token},body:JSON.stringify({command:'f(x)=x'})});
 const payload=await rejected.json();
 assert.ok(typeof payload==='object','bridge answers JSON');
 await page.keyboard.press('ControlOrMeta+Shift+g');
 await page.waitForFunction(()=>{
  const t=document.querySelector('#toast');
  return (t&&!t.hidden&&t.textContent.includes('GeoGebra'))||[...document.querySelectorAll('#messages .message.user')].some(el=>el.textContent.includes('Conferir GeoGebra'));
 },{timeout:8000});
 await page.locator('#course-tabs button[data-id="A"]').click();
 await page.waitForFunction(()=>!document.querySelector('#references').classList.contains('ggb'));
 assert.equal(await page.locator('#pdf-grid').first().evaluate(el=>getComputedStyle(el).visibility),'visible','PDF grid returns after leaving GeoGebra');
 await page.locator('#course-tabs button[data-id="geogebra"]').click();
 await page.waitForFunction(()=>document.querySelector('#references').classList.contains('ggb'));
 let ggbReady=true;
 try{await page.evaluate(()=>window.desk.ggbShot());}
 catch(e){ggbReady=false;assert.match(String(e.message),/carregando/,'ggb-shot gates on applet readiness when offline');}
 if(ggbReady){
  const shot=await page.evaluate(()=>window.desk.ggbShot());
  assert.match(shot.dataUrl,/^data:image\/png;base64,/,'ggb-shot returns a PNG');
  await page.locator('#ggb-shot').click();
  /* Com o pedido do tutor esperando o applet (#53) ele chega pronto aqui; um anexo de antes pode estar na caixa. */
  const shotAttachment=page.locator('#attachments .attachment:has(img[alt*="geogebra" i])');
  await shotAttachment.waitFor();
  // o handler não pode cair no CSP (fetch de data: é bloqueado por connect-src)
  assert.match(await shotAttachment.locator('img').getAttribute('alt'),/geogebra/i,'o Print para o tutor anexa o File do print');
  assert.doesNotMatch(await page.locator('#toast').textContent(),/Failed to fetch/,'o print não pode morrer no fetch(data:) do CSP');
  await shotAttachment.locator('.attachment-remove').click();
  await page.waitForFunction(()=>!document.querySelector('#attachments img[alt*="geogebra" i]'));
 }
 if(ggbReady){
  await page.locator('#course-tabs button[data-id="A"]').click();
  await page.waitForFunction(()=>!document.querySelector('#references').classList.contains('ggb'));
  const ggbFile=path.join(runtime,'ggb','A.b64');
  const savedGgb=await pollUntil(()=>{try{return fs.existsSync(ggbFile)&&fs.readFileSync(ggbFile,'utf8').length>0;}catch{return false;}},Boolean,{timeout:8000,interval:100,what:'o snapshot ggb/A.b64 gravado'}).catch(()=>false);
  assert.ok(savedGgb,'leaving the GeoGebra tab captures a snapshot file for the course');
  const deskGgb=JSON.parse(fs.readFileSync(path.join(runtime,'desk.json'),'utf8'));
  assert.equal(deskGgb.courseStates?.A?.ggbBase64,undefined,'desk.json no longer carries ggbBase64');
  assert.equal(deskGgb.ggbBase64,undefined,'top-level state no longer carries ggbBase64');
  await page.locator('#course-tabs button[data-id="geogebra"]').click();
  await page.waitForFunction(()=>document.querySelector('#references').classList.contains('ggb'));
 }
 assert.deepEqual(errors,[]);console.log('GGB PASSED: GeoGebra tab overlays the PDF area, local bridge validates token and answers JSON, shot gates on applet readiness.');
 // erro forçado no renderer chega ao desk.log rotativo do processo principal
 await page.evaluate(()=>{setTimeout(()=>{throw Error('erro forçado do smoke');},0);});
 const logFile=path.join(runtime,'desk.log');
 await pollUntil(()=>fs.existsSync(logFile)?fs.readFileSync(logFile,'utf8'):'',text=>/erro forçado do smoke/.test(text),{what:'a linha "erro forçado do smoke" em desk.log'}).catch(()=>{});
 assert.ok(fs.existsSync(logFile),'desk.log should exist after a forced renderer error');
 assert.match(fs.readFileSync(logFile,'utf8'),/erro forçado do smoke/,'desk.log carries the renderer error line');
 console.log('LOG PASSED: window error events reach the rotating .runtime/desk.log.');
});

// CHAOS: um runtime por cenário, cada modo do fake-pi dispara uma vez e a UI recupera.
await withArtifacts('chaos-stream-abort',async ctx=>{
 const runtime=ctx.runtime=newRuntime('chaos-abort');
 seedCourse(runtime,'Chaos');
 writeDeskJson(runtime,{courseId:'Chaos'});
 const app=ctx.app=await launchDesk({runtime,env:{FAKE_PI_CHAOS:'stream-abort'}});
 const page=await app.firstWindow();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await statusOnline(page);
 await page.locator('#prompt').fill('comece a responder e caia no meio');
 await page.locator('#send').click();
 await page.waitForSelector('#tutor-state[data-state="error"]',{timeout:20000});
 assert.equal(await page.locator('#toast > *').count(),0,'a queda não repete o aviso: a coluna do tutor escreve o motivo (#27)');
 await sendEnabled(page,{timeout:15000});
 assert.match(await page.locator('#status-dot').getAttribute('class'),/error/,'status dot shows the Pi failure');
 assert.equal(await page.locator('#stop').isHidden(),true,'Parar desaparece quando o busy destrava');
 await page.locator('#prompt').fill('quiz de recuperação');
 await page.locator('#send').click();
 await page.waitForSelector('.message.quiz .quiz-option',{timeout:30000});
 await page.locator('.message.quiz .quiz-option').nth(1).click();
 await page.waitForFunction(()=>[...document.querySelectorAll('.quiz-verdict')].some(el=>el.textContent.includes('Correta')),undefined,{timeout:20000});
 await sendEnabled(page);
 await page.waitForFunction(()=>document.querySelector('#status-dot').classList.contains('online'),undefined,{timeout:30000});
 assert.deepEqual(errors,[]);
 console.log('CHAOS stream-abort PASSED: Pi morto no meio do stream destrava busy com toast e a mensagem seguinte funciona.');
});

await withArtifacts('chaos-desk-error',async ctx=>{
 const runtime=ctx.runtime=newRuntime('chaos-desk');
 seedCourse(runtime,'Chaos');
 writeDeskJson(runtime,{courseId:'Chaos'});
 const app=ctx.app=await launchDesk({runtime,env:{FAKE_PI_CHAOS:'desk-error'}});
 const page=await app.firstWindow();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await statusOnline(page);
 await page.locator('#prompt').fill('comece e falhe no meio');
 await page.locator('#send').click();
 /* Queda de verdade: a coluna do tutor escreve o motivo; o aviso não o repete (#27). */
 await page.waitForFunction(()=>/Falha de teste no meio da resposta/.test(document.querySelector('#tutor-state')?.textContent||''),undefined,{timeout:20000});
 assert.equal(await page.locator('#toast > *').count(),0,'a queda não repete o aviso: a coluna do tutor escreve o motivo');
 await sendEnabled(page,{timeout:15000});
 assert.match(await page.locator('#status-dot').getAttribute('class'),/error/,'status dot shows the desk_error');
 await page.locator('#prompt').fill('explique o teorema de Pitágoras');
 await page.locator('#send').click();
 await page.waitForSelector('#messages .message.assistant:not(.quiz) .katex',{timeout:30000});
 await sendEnabled(page);
 await page.waitForFunction(()=>document.querySelector('#status-dot').classList.contains('online'),undefined,{timeout:30000});
 assert.deepEqual(errors,[]);
 console.log('CHAOS desk-error PASSED: desk_error no meio do stream destrava busy com toast e a mensagem seguinte funciona.');
});

await withArtifacts('chaos-rpc-timeout',async ctx=>{
 const runtime=ctx.runtime=newRuntime('chaos-timeout');
 seedCourse(runtime,'Chaos');
 writeDeskJson(runtime,{courseId:'Chaos'});
 const app=ctx.app=await launchDesk({runtime,env:{FAKE_PI_CHAOS:'rpc-timeout',FAKE_PI_TIMEOUT_MS:'21000'}});
 const page=await app.firstWindow();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await statusOnline(page);
 // o ping de saúde recebe uma resposta atrasada (FAKE_PI_TIMEOUT_MS, default 30s) → o timeout de 20s do health estoura antes
 /* O erro vive na coluna do tutor (sem aviso flutuante repetindo, #23). */
 await page.waitForSelector('#tutor-state[data-state="error"]',{timeout:60000});
 assert.match(await page.locator('#tutor-state .ts-fine').textContent(),/demorou demais/,'a coluna diz o motivo do ping');
 assert.equal(await page.locator('#toast > *').count(),0,'sem aviso flutuante repetindo o erro da coluna');
 assert.match(await page.locator('#status-dot').getAttribute('class'),/error/,'status dot shows the timed out ping');
 // a conversa volta ao normal no uso seguinte; o ping seguinte responde no prazo
 await page.locator('#prompt').fill('quiz depois do timeout');
 await page.locator('#send').click();
 await page.waitForSelector('.message.quiz .quiz-option',{timeout:30000});
 await page.locator('.message.quiz .quiz-option').nth(1).click();
 await page.waitForFunction(()=>[...document.querySelectorAll('.quiz-verdict')].some(el=>el.textContent.includes('Correta')),undefined,{timeout:20000});
 await sendEnabled(page);
 await page.waitForFunction(()=>document.querySelector('#status-dot').classList.contains('online'),undefined,{timeout:30000});
 assert.deepEqual(errors,[]);
 console.log('CHAOS rpc-timeout PASSED: ping além de 20s vira erro visível e a conexão volta no ping seguinte.');
});

await withArtifacts('codigo',async ctx=>{
 const runtime=ctx.runtime=newRuntime('codigo');
 const app=ctx.app=await launchDesk({runtime});
 const page=await app.firstWindow();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await statusOnline(page);
 await page.locator('#prompt').fill('exemplo:\n```js\nconst caros = itens.filter((i) => i > 10);\nconst ok = a && b;\n```');
 await page.locator('#send').click();
 await page.waitForFunction(()=>!!document.querySelector('pre code'),undefined,{timeout:15000});
 const texto=await page.evaluate(()=>document.querySelector('pre code').textContent);
 assert.match(texto,/=>/,'seta sem entidade dupla');
 assert.match(texto,/i > 10/,'comparação sem entidade dupla');
 assert.match(texto,/a && b/,'ampersand sem entidade dupla');
 assert.doesNotMatch(texto,/&gt;|&amp;|&lt;/,'nada de entidade HTML crua no código');
 const cores=await page.evaluate(()=>{const b=document.querySelector('pre code');const base=getComputedStyle(b).color;const t={};for(const s of b.querySelectorAll('[data-hl]'))t[s.dataset.hl]=t[s.dataset.hl]||getComputedStyle(s).color;return {base,t};});
 assert.ok(Object.values(cores.t).some(c=>c!==cores.base),'algum token tem cor própria');
 // a moldura do bloco (rótulo + cópia + pre) vem do core/talkview.bend; o realce segue no host
 const moldura=await page.evaluate(()=>{const block=document.querySelector('.codeblock');return{order:[...block.children].map(el=>el.tagName.toLowerCase()),lang:block.querySelector('.code-lang')?.textContent??'',copy:block.querySelector('.code-copy')?.textContent??''};});
 assert.deepEqual(moldura,{order:['span','button','pre'],lang:'JS',copy:'cópia'},'a moldura do bloco vem da view do Bend');
 assert.deepEqual(errors,[]);
 console.log('código PASSED: o bloco preserva =>, > e && (sem entidade dupla) e tem cor por token.');
});

await withArtifacts('worklog',async ctx=>{
 const runtime=ctx.runtime=newRuntime('worklog');
 const course=seedCourse(runtime,'Calc');
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'Calc',name:'Calc',path:course}]});
 const live=path.join(runtime,'pi-1700000002000.jsonl');
 const other=path.join(runtime,'pi-1700000003000.jsonl');
 fs.writeFileSync(live,'');
 fs.writeFileSync(other,'');
 writeDeskJson(runtime,{session:live,courseId:'Calc',courseStates:{Calc:{session:live,sessions:[{path:live,started:1700000002000,preview:'diário'},{path:other,started:1700000003000,preview:'outra'}]}}});
 const app=ctx.app=await launchDesk({runtime});
 const page=await app.firstWindow();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await statusOnline(page);
 await page.locator('#prompt').fill('pensar profundo');
 await page.locator('#send').click();
 await page.waitForFunction(()=>[...document.querySelectorAll('.message.assistant .body')].some(el=>el.textContent.includes('É o OD.')),undefined,{timeout:20000});
 await sendEnabled(page);
 await page.waitForFunction(()=>{const all=document.querySelectorAll('.work');const el=all[all.length-1];return el&&el.dataset.live==='false';},undefined,{timeout:20000});
 const work=page.locator('.work').last();
 assert.equal(await work.getAttribute('class'),'work','a âncora .work é o nó do núcleo (worklogview)');
 assert.equal(await work.locator('.work-head').getAttribute('aria-expanded'),'false','o fold recolhido vem da árvore');
 assert.equal(await work.locator('.work-mark svg.icon').count(),1,'o SVG do diário continua injeção do host (icons.mjs)');
 assert.equal(await work.getAttribute('data-expanded'),'false','o diário nasce recolhido quando o turno termina');
 assert.match(await work.locator('.work-title').textContent(),/^Trabalhou por .* · 1 busca$/);
 assert.equal(await page.evaluate(()=>[...document.querySelectorAll('.message.assistant')].filter(el=>!el.querySelector('.body')?.textContent.trim()).length),0,'sem bloco vazio de assistente');
 await work.locator('.work-head').click();
 await page.waitForFunction(()=>document.querySelector('.work[data-expanded=true] .work-step'));
 const labels=await work.locator('.step-label').allTextContents();
 assert.match(labels[0],/^Pensou por \d+s$/);
 assert.match(labels[1],/^Procurou na web: «kojima xbox»$/);
 await work.locator('.step-toggle').first().click();
 await page.waitForFunction(()=>{const pre=document.querySelector('.work-step .step-text');return pre&&!pre.hidden&&pre.textContent.includes('Vou considerar');});
 // histórico: trocar de sessão e voltar reconstrói o diário recolhido do JSONL
 await page.waitForFunction(()=>{const s=document.querySelector('#session-title');return s&&!s.disabled;},undefined,{timeout:20000});
 const otherValue=(await sessionIds(page)).find(v=>v.endsWith('pi-1700000003000.jsonl'));
 assert.ok(otherValue,'a outra sessão aparece na lista');
 await openSessionById(page,otherValue);
 await page.waitForFunction(()=>document.querySelector('#session-title').dataset.session.endsWith('pi-1700000003000.jsonl'));
 await page.waitForFunction(()=>{const s=document.querySelector('#session-title');return s&&!s.disabled;},undefined,{timeout:20000});
 const liveValue=(await sessionIds(page)).find(v=>v.endsWith('pi-1700000002000.jsonl'));
 // O guard da troca recusa enquanto a conexão anterior não assentou: tenta de novo.
 let back=false;
 for(let attempt=0;attempt<20&&!back;attempt++){
  await openSessionById(page,liveValue).catch(()=>{});
  back=await pollUntil(()=>page.evaluate(()=>document.querySelector('#session-title').dataset.session.endsWith('pi-1700000002000.jsonl')),Boolean,{timeout:1500,interval:50,what:'a conversa do diário ativa'}).catch(()=>false);
 }
 assert.equal(back,true,'voltou para a conversa do diário');
 await page.waitForFunction(()=>[...document.querySelectorAll('.message.assistant .body')].some(el=>el.textContent.includes('É o OD.')),undefined,{timeout:20000});
 const hist=page.locator('.work').last();
 assert.equal(await hist.getAttribute('data-live'),'false');
 assert.match(await hist.locator('.work-title').textContent(),/^Trabalhou por .* · 1 busca$/);
 await hist.locator('.work-head').click();
 assert.match((await hist.locator('.step-label').allTextContents()).join(' | '),/Procurou na web: «kojima xbox»/);
 assert.deepEqual(errors,[]);
 console.log('WORKLOG PASSED: o diário mostra o pensamento e a busca, recolhe em "Trabalhou por…" (sem bloco vazio) e volta recolhido do histórico.');
});

// O vazio da conversa não tem mais o `#welcome`: o convite para chamar o tutor
// é o estado "desligado" da coluna (`#tutor-state`, ticket #17) e some quando o
// tutor liga e não há registro de retomada. A troca de matéria zera a conversa.
await withArtifacts('welcome',async ctx=>{
 const runtime=ctx.runtime=newRuntime('welcome');
 seedCourse(runtime,'A');seedCourse(runtime,'B');
 writeDeskJson(runtime,{courseId:'A'});
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'A',name:'Matéria A',path:path.join(runtime,'learning','Courses','A')},{id:'B',name:'Matéria B',path:path.join(runtime,'learning','Courses','B')}]});
 const app=ctx.app=await launchDesk({runtime});
 const page=await app.firstWindow();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.waitForSelector('.pdf-panel',{timeout:30000});
 await statusOnline(page);
 await page.locator('#course-tabs button[data-id="B"]').click();
 await statusOnline(page);
 assert.equal(await page.locator('#welcome').count(),0,'o vazio antigo saiu da coluna');
 /* O `statusOnline` logo depois do clique pode ainda ver o tutor da matéria A: espera o bloco assentar. */
 await pollUntil(()=>page.locator('#tutor-state').evaluate(el=>el.hidden),hidden=>hidden===true,{what:'ligado e sem registro: o bloco some'});
 assert.deepEqual(errors,[]);
 console.log('WELCOME PASSED: a troca de matéria não deixa o vazio antigo; com o tutor ligado e sem registro o bloco de estados some.');
});


// IPC: o mesmo erro de conexão chega como `desk_error` e como rejeição do
// `pi-connect`; o usuário não pode ver duas vezes o aviso nem o embrulho do Electron.
await withArtifacts('ipc-error-once',async ctx=>{
 const runtime=ctx.runtime=newRuntime('ipc-uma-vez');
 seedCourse(runtime,'A');
 writeDeskJson(runtime,{courseId:'A'});
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'A',name:'Matéria A',path:path.join(runtime,'learning','Courses','A')}]});
 const app=ctx.app=await launchDesk({runtime,env:{LEARNING_DESK_PI:'/usr/bin/false'}});
 const page=await app.firstWindow();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 /* A falha de conexão aparece UMA vez, escrita na coluna do tutor (#23): sem
    aviso flutuante repetindo o mesmo texto e sem o embrulho do Electron. */
 await page.waitForSelector('#tutor-state[data-state="error"]',{timeout:20000});
 await page.waitForTimeout(700);// espera fixa: "nada acontece em 0,7 s" — a falha de conexão não vira aviso flutuante
 const column=await page.evaluate(()=>({toasts:[...document.querySelectorAll('#toast .toast-item')].map(el=>el.textContent),state:document.querySelector('#tutor-state').textContent}));
 assert.equal(column.toasts.length,0,'a falha de conexão não gera aviso flutuante: a coluna já a escreve');
 assert.doesNotMatch(column.state,/Error invoking remote method/,'a coluna não vaza boilerplate do Electron');
 assert.equal((column.state.match(/O tutor fechou sem aviso|Tutor não encontrado/g)||[]).length,1,'a mensagem original aparece uma vez');
 assert.match(await page.locator('#status-dot').getAttribute('class'),/error/,'o ponto de conexão acusa o erro');
 assert.equal(await page.locator('#send').isEnabled(),true,'send continua habilitado depois da falha');
 assert.deepEqual(errors,[]);
 console.log('IPC ERROR PASSED: falha de conexão vira uma única mensagem na coluna do tutor, sem toast.');
});

// Histórico com um token sem espaço de 20 KB + 100 mensagens: o lote do
// `showHistory` mede a rolagem uma vez. Antes, o `atBottom()`/`followBottom()`
// por mensagem forçava ~850 ms de layout por mensagem (quebra do token com a
// fonte do sistema) e o renderer ficava minutos sem pintar. O limite aqui é a
// garantia contra a regressão: 102 mensagens têm de aparecer em ≤ 20 s (o caso
// patológico levava >130 s) e a ordem/rolagem têm de continuar as mesmas.
await withArtifacts('token-longo',async ctx=>{
 const runtime=ctx.runtime=newRuntime('token-longo');
 const big='x'.repeat(20000)+' fim do bloco gigante';
 const records=[
  {type:'message',message:{role:'user',content:[{type:'text',text:'oi'}]}},
  {type:'message',message:{role:'assistant',content:[{type:'text',text:big}]}},
 ];
 for(let i=0;i<100;i++)records.push({type:'message',message:{role:i%2?'assistant':'user',content:[{type:'text',text:`m ${i}`}]}});
 const sessionFile=seedSession(runtime,records);
 seedCourse(runtime,'Test');
 writeDeskJson(runtime,{session:sessionFile,courseId:'Test'});
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'Test',name:'Test',path:path.join(runtime,'learning','Courses','Test')}]});
 const app=ctx.app=await launchDesk({runtime});
 const page=await app.firstWindow();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const t0=Date.now();
 await page.waitForFunction(()=>document.querySelectorAll('#messages .message').length>=102,undefined,{timeout:20000});
 const ms=Date.now()-t0;
 assert.ok(ms<20000,`histórico com token de 20 KB renderiza em tempo limitado (${ms}ms)`);
 const head=await page.evaluate(()=>{
  const els=[...document.querySelectorAll('#messages .message')];
  return {first:els.slice(0,2).map(el=>({user:el.classList.contains('user'),assistant:el.classList.contains('assistant'),text:el.textContent.slice(0,60)})),giant:els.some(el=>el.textContent.includes('fim do bloco gigante'))};
 });
 assert.equal(head.first[0].user,true,'o histórico começa no usuário');
 assert.equal(head.first[1].assistant,true,'a mensagem gigante vem do Pi');
 assert.ok(head.giant,'o token gigante aparece inteiro');
 const count=await page.locator('#messages .message').count();
 assert.ok(count>=102,`o histórico inteiro renderiza (${count} mensagens)`);
 const scroll=await page.evaluate(()=>{const el=document.querySelector('#messages');return {top:el.scrollTop,sh:el.scrollHeight,ch:el.clientHeight};});
 assert.ok(scroll.sh-scroll.top-scroll.ch<=80,`o lote rola ao fim quando estava no fim (${JSON.stringify(scroll)})`);
 assert.deepEqual(errors,[]);
 console.log(`TOKEN LONGO PASSED: 102 mensagens com token de 20 KB em ${ms}ms, ordem e rolagem preservadas.`);
});

await withArtifacts('primeira-abertura',async ctx=>{
 const runtime=ctx.runtime=newRuntime('setup');
 writeConfigJson(runtime,{vaultPath:'',courses:[]});
 const app=ctx.app=await launchDesk({runtime});
 const page=await app.firstWindow();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.waitForSelector('body[data-first-run="true"]',{timeout:30000});
 assert.equal(await page.locator('dialog[open]').count(),0,'sem configuração a Mesa abre direto no app, sem diálogo');
 assert.equal(await page.locator('#setup').isVisible(),true,'a tela de passos cobre a Mesa (#64)');
 assert.equal(await page.locator('#setup-card').getAttribute('data-step'),'welcome');
 assert.equal(await page.evaluate(()=>document.activeElement?.id),'setup-next','o botão Começar nasce com foco');
 assert.equal(await page.evaluate(()=>document.querySelector('body > main').inert),true,'a Mesa atrás fica inert');
 await page.locator('#first-run-help').click();
 assert.equal(await page.locator('#setup-card').getAttribute('data-step'),'tour','"Como a Mesa funciona" leva ao passeio');
 await page.keyboard.press('ControlOrMeta+/');
 await page.waitForSelector('#help-dialog[open]');
 await page.keyboard.press('Escape');
 await page.waitForFunction(()=>!document.querySelector('#help-dialog').open);
 assert.deepEqual(errors,[]);console.log('PRIMEIRA ABERTURA PASSED: tela de passos, passeio, Guia por ⌘/ e Mesa inert atrás, sem diálogo de boas-vindas.');
});

// Updater por clique + painel "Componentes": a rede é falsa (os handlers são
// sobrescritos; TEST_MODE jamais fala com a rede) e o que se confere é a árvore
// do núcleo (`core/dialogsview.bend`) colada no Sobre — a linha do update, o
// corpo da Release e as quatro linhas na ordem de `componentIds`.
await withArtifacts('atualizacao',async ctx=>{
 const runtime=ctx.runtime=newRuntime('atualizacao');
 seedCourse(runtime,'Upd');
 writeDeskJson(runtime,{courseId:'Upd'});
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'Upd',name:'Upd',path:path.join(runtime,'learning','Courses','Upd')}]});
 const app=ctx.app=await launchDesk({runtime,env:{LEARNING_VAULT:runtime}});
 const page=await app.firstWindow();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.waitForSelector('.pdf-panel',{timeout:30000});
 await app.evaluate(({ipcMain})=>{
  ipcMain.removeHandler('update-check');
  ipcMain.handle('update-check',async()=>({status:'update',version:'9.9.9',notes:'Corpo da Release de teste',url:'https://example.com/release-notes',current:'0.4.0'}));
  ipcMain.removeHandler('components');
  ipcMain.handle('components',async()=>({rows:[
   {id:'pi',label:'Pi',version:'0.86.1',state:'ok',hint:'Em desk/node_modules (atualizável pela Mesa).',canUpdate:true},
   {id:'node',label:'Node',version:'22.18.0',state:'warn',note:'abaixo de 22.19 — o Pi exige Node 22.19+'},
   {id:'xournal',label:'Xournal++',version:'1.2.5',state:'outdated',latest:'1.2.7',link:'https://github.com/xournalpp/xournalpp/releases/latest',linkLabel:'Abrir o site'},
  ]}));
 });
 await page.locator('#settings-menu .nav-trigger').click();
 await page.locator('#about').click();
 await page.waitForSelector('#about-dialog[open]');
 await page.waitForSelector('#update-apply',{timeout:8000});
 assert.equal(await page.locator('#about-update .update-text').textContent(),'v9.9.9 disponível','a faixa diz a versão nova');
 assert.equal(await page.locator('#update-notes').textContent(),'O que mudou');
 assert.equal(await page.locator('#update-notes').getAttribute('data-url'),'https://example.com/release-notes','O que mudou abre pelo handler OpenLink');
 assert.equal(await page.locator('#update-apply').textContent(),'Atualizar e reiniciar');
 assert.equal(await page.locator('#about-update .update-notes').textContent(),'Corpo da Release de teste','o que mudou é o corpo da Release');
 assert.deepEqual(await page.locator('#component-rows .component-row').evaluateAll(es=>es.map(e=>e.dataset.id)),['pi','node','xournal'],'ordem: Pi, Node, Xournal++ (a Mesa não é linha)');
 // o painel nasce "Verificando…" e a checagem (falsa) chega no mesmo lugar (C3)
 await page.waitForFunction(()=>![...document.querySelectorAll('#component-rows .component-state')].some(e=>e.textContent==='Verificando…'),undefined,{timeout:8000});
 assert.equal(await page.locator('#component-rows [data-id="pi"] .component-state').textContent(),'em dia');
 assert.equal(await page.locator('#component-rows [data-id="node"] .component-state').textContent(),'abaixo de 22.19 — o Pi exige Node 22.19+','aviso de Node antigo vem do núcleo');
 assert.equal(await page.locator('#update-pi').isVisible(),true,'Pi local com versão nova mostra Atualizar o Pi');
 assert.equal(await page.locator('#component-rows [data-id="xournal"] .component-link').textContent(),'Abrir o site');
 assert.equal(await page.locator('#component-rows [data-id="xournal"] .component-update').count(),0,'Xournal++ é só informativo (nunca ganha botão)');
 // o mesmo botão manual cobre o painel todo (Pi + Xournal sob demanda)
 await page.locator('#components-refresh').click();
 await page.waitForFunction(()=>document.querySelector('#about-update .update-text')?.textContent.includes('v9.9.9'),undefined,{timeout:8000});
 // sem versão nova a faixa diz "Atualizada." com a hora conferida e o ícone de verificar continua lá
 await app.evaluate(({ipcMain})=>{ipcMain.removeHandler('update-check');ipcMain.handle('update-check',async()=>({status:'current',version:'9.9.9',notes:'',url:'',current:'0.4.0',checkedAt:Date.now()}));});
 await page.locator('#components-refresh').click();
 await page.waitForFunction(()=>/^Atualizada\. Conferido hoje às \d{1,2}:\d{2}\.$/.test(document.querySelector('#about-update .update-text')?.textContent||''),undefined,{timeout:8000});
 assert.equal(await page.locator('#update-check').isVisible(),true,'mesmo na última o verificar atualizações fica');
 await page.locator('#about-dialog .dialog-close').click();
 await page.waitForFunction(()=>!document.querySelector('#about-dialog').open);
 assert.deepEqual(errors,[]);
 console.log('ATUALIZACAO PASSED: faixa do updater (vX disponível · O que mudou · Atualizar e reiniciar; Atualizada. Conferido hoje às H:MM.) e painel O que a Mesa usa (3 linhas nascem Verificando…, estados, Atualizar o Pi só no Pi local) vêm do Bend.');
});

// Fila guardada + bandeja + registro do Encerrar: o estado em que o app abre
// depois de fechar com trabalho pendente (runtime temporário, fake Pi).
await withArtifacts('fila-guardada',async ctx=>{
 const runtime=ctx.runtime=newRuntime('fila-guardada');
 const course=seedCourse(runtime,'Calc');
 const pdf=path.join(course,'lista.pdf');fs.writeFileSync(pdf,tinyPdf('Lista 2 · 7b'));
 const xopp=path.join(runtime,'rascunho.xopp');fs.writeFileSync(xopp,'');
 const session=seedSession(runtime,[{type:'message',message:{role:'user',content:[{type:'text',text:'corrente'}],timestamp:1700000002000}}]);
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'Calc',name:'Cálculo I',path:course}]});
 writeDeskJson(runtime,{session,courseId:'Calc',pdfs:[{path:pdf,page:1}],study:{title:'Lista 2 · 7b',xopp}});
 fs.writeFileSync(path.join(runtime,'pending.json'),JSON.stringify({
  [session]:{items:[{id:'fila-1',text:'pendente um',refs:[{path:pdf,page:0}],images:[]}],attachments:[{dataUrl:'data:image/png;base64,'+PLOT_PNG,mimeType:'image/png',name:'captura.png'}],held:false}
 }));
 fs.writeFileSync(path.join(runtime,'resume.json'),JSON.stringify({
  Calc:{stopped:'travei na 3',next:'seguir para a 4',exercise:'Lista 2 · 7b',xopp,pages:[{path:pdf,page:1}]}
 }));
 const app=ctx.app=await launchDesk({runtime});
 const page=await app.firstWindow();const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')console.log('CONSOLE',m.text());});
 await page.waitForSelector('.pdf-panel canvas',{timeout:30000});
 await statusOnline(page);
 await page.waitForSelector('.queue-strip');
 await page.waitForSelector('#tutor-state[data-state="resume"]');
 const order=await page.evaluate(()=>{
  const name=el=>el.id?`#${el.id}`:`.${el.className.split(' ')[0]}`;
  return {chat:[...document.querySelector('#composer').parentElement.children].filter(el=>['messages','tutor-state','activity','composer'].includes(el.id)).map(el=>`#${el.id}`),column:[...document.querySelector('#composer').children].filter(el=>!el.hidden&&el.tagName!=='INPUT').map(name),box:[...document.querySelector('#composer-box').children].filter(el=>!el.hidden).map(name)};
 });
 assert.deepEqual(order.column,['#goes-along','#composer-box'],'linha Vai junto e a caixa, nessa ordem');
 assert.deepEqual(order.chat,['#messages','#tutor-state','#activity','#composer'],'o "onde parei" mora na coluna, entre as mensagens e a caixa');
 assert.deepEqual(order.box.slice(0,3),['.queue-strip','#attachments','#prompt'],'faixa da fila e bandeja moram dentro da caixa, acima do campo');
 assert.equal(await page.locator('.queue-label').textContent(),'Recuperadas','a fila guardada diz de onde veio');
 assert.equal(await page.locator('.queue-send-now').isVisible(),true,'Enviar agora no lugar do envio automático');
 assert.equal(await page.locator('.queue-clear').isVisible(),true);
 assert.equal(await page.locator('#attachments .attachment').count(),1,'a bandeja guardada volta com o boot');
 assert.equal(await page.locator('#tutor-state .ts-lead').textContent(),'Da última vez você parou em Lista 2 · 7b: travei na 3','a coluna diz onde a pessoa parou');
 assert.equal(await page.locator('#tutor-state .ts-fine').textContent(),'Próximo passo: seguir para a 4');
 assert.equal(await page.locator('#prompt').inputValue(),'','nada é escrito sozinho no composer');
 await page.waitForTimeout(1500);// espera fixa: "nada acontece em 1,5 s" — a fila retomada não sai sozinha
 assert.equal(await page.locator('.message.user').count(),1,'só o turno do histórico: a fila não saiu sozinha');
 await page.locator('#resume-forget').click();
 await page.waitForFunction(()=>document.querySelector('#tutor-state')?.hidden===true);
 assert.deepEqual(Object.keys(JSON.parse(fs.readFileSync(path.join(runtime,'resume.json'),'utf8'))),[],'Esquecer apaga o registro');
 assert.equal(await page.locator('.queue-item').count(),1,'Esquecer não mexe na fila');
 assert.deepEqual(errors,[]);
 console.log('FILA GUARDADA PASSED: fila recuperada (Enviar agora, nada automático), bandeja de volta e bloco "onde parei" na coluna; Esquecer limpa só o registro.');
});

// Hierarquia do composer: o Encerrar por hoje mora no Mais opções do tutor
// (fora da linha de ações e do menu Estudar); Modelo e Esforço vivem no popover
// do indicador do cabeçalho; o Modo compacto entra na busca de comandos e no ⌘/Ctrl⇧D.
await withArtifacts('composer-hierarquia',async ctx=>{
 const runtime=ctx.runtime=newRuntime('hierarquia');
 const course=seedCourse(runtime,'Calc');
 const pdf=path.join(course,'lista.pdf');fs.writeFileSync(pdf,tinyPdf('Lista 2 · 7b'));
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'Calc',name:'Cálculo I',path:course}]});
 writeDeskJson(runtime,{courseId:'Calc',pdfs:[{path:pdf,page:1}]});
 const app=ctx.app=await launchDesk({runtime});
 const page=await app.firstWindow();const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')console.log('CONSOLE',m.text());});
 await page.waitForSelector('.pdf-panel canvas',{timeout:30000});
 assert.equal(await page.locator('.composer-actions #end-day').count(),0,'o Encerrar saiu da linha de ações do composer');
 assert.equal(await page.locator('#study-pop #end-day').count(),0,'o Encerrar saiu do menu Estudar');
 assert.equal(await page.locator('#chat-more-pop #end-day').count(),1,'o Encerrar é item do Mais opções do tutor (view do Bend)');
 assert.equal((await page.locator('#chat-more-pop #end-day').textContent()).trim(),'Encerrar por hoje');
 // O painel Ajustes saiu da coluna (ticket #14): modelo e esforço moram no popover do indicador.
 assert.equal(await page.locator('#pi-settings-panel, #settings-toggle, .side-foot, #foot-status, #compact-tools').count(),0,'sem painel Ajustes nem rodapé de estado na coluna');
 assert.equal(await page.locator('#model-pop #model-search, #model-pop #model-list, #model-pop #effort-strip').count(),3,'modelo (busca e lista) e esforço vivem no popover do indicador');
 assert.equal(await page.locator('#model-pop').isHidden(),true,'o popover nasce fechado');
 assert.equal(await page.evaluate(()=>localStorage.getItem('mesa.piPanel')),null,'não guarda mais a escolha do painel');
 // Modo compacto pela busca de comandos: aperta a coluna e a escolha fica guardada.
 assert.equal(await page.evaluate(()=>document.body.classList.contains('dense')),false,'nasce desligado');
 await page.locator('#palette-field').click();
 await page.locator('#command-palette .palette-input').fill('Modo compacto');
 await page.waitForFunction(()=>/Modo compacto/.test(document.querySelector('#command-palette .palette-item.active')?.textContent||''),undefined,{timeout:5000});
 await page.keyboard.press('Enter');
 await page.waitForFunction(()=>document.body.classList.contains('dense'));
 assert.equal(await page.evaluate(()=>localStorage.getItem('mesa.density')),'compacta');
 await page.keyboard.press('ControlOrMeta+Shift+D');
 await page.waitForFunction(()=>!document.body.classList.contains('dense'));
 // ⌘/Ctrl⇧D (catálogo de atalhos, grupo Visualização) alterna o mesmo modo:
 // `ControlOrMeta` para o mesmo roteiro valer fora do macOS
 await page.keyboard.press('ControlOrMeta+Shift+D');
 await page.waitForFunction(()=>document.body.classList.contains('dense'));
 assert.equal(await page.evaluate(()=>localStorage.getItem('mesa.density')),'compacta','o atalho grava a mesma escolha');
 // O select das Configurações mostra o modo corrente (sync da densidade)
 const menuOpen=await page.evaluate(()=>document.querySelector('#settings-menu').classList.contains('open'));
 if(!menuOpen)await page.locator('#settings-menu .nav-trigger').click();
 await page.locator('#settings').click();
 await page.waitForSelector('#settings-dialog[open]');
 assert.equal(await page.locator('#density-mode').inputValue(),'compacta','o select das Configurações segue o modo');
 await page.locator('#settings-dialog button[value="cancel"]').last().click();
 await page.waitForFunction(()=>!document.querySelector('#settings-dialog').open);
 assert.deepEqual(errors,[]);
 console.log('COMPOSER HIERARQUIA PASSED: Encerrar no Mais opções do tutor (fora da linha de ações e do menu Estudar), modelo e esforço no popover do indicador (sem painel Ajustes), Modo compacto na busca de comandos e no ⌘/Ctrl⇧D com o select das Configurações acompanhando.');
});
