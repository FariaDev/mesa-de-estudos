import assert from 'node:assert/strict';import path from 'node:path';import fs from 'node:fs';
import {withArtifacts,launchDesk,newRuntime,seedCourse,seedPlot,seedSession,writeDeskJson,writeConfigJson,tinyPdf,toastWait,sendEnabled,statusOnline,PLOT_PNG} from './helpers.mjs';

await withArtifacts('smoke',async ctx=>{
 const runtime=ctx.runtime=newRuntime('basico');
 const plot=seedPlot(runtime,'Test');
 const sessionFile=seedSession(runtime,[{type:'message',message:{role:'assistant',content:[{type:'text',text:`Aqui está o gráfico:\n\n![curva de teste](file://${plot})`}]}}]);
 writeDeskJson(runtime,{session:sessionFile,courseId:'Calculus I'});
 const app=ctx.app=await launchDesk({runtime});
 const page=await app.firstWindow();const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')console.log('CONSOLE',m.text());});
 assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isVisible()),false,'janela oculta em testes');
 if(process.platform==='darwin')assert.equal(await app.evaluate(({app})=>app.dock.isVisible()),false,'Dock oculta em testes');
 await page.waitForSelector('.pdf-panel canvas',{timeout:30000});
 await page.waitForFunction(()=>document.querySelectorAll('.page-total').length===2&&[...document.querySelectorAll('.page-total')].every(e=>!e.textContent.includes('—')),{timeout:30000});
 await page.waitForFunction(()=>[...document.querySelectorAll('.pdf-panel')].every(panel=>panel.querySelector('canvas')),{timeout:30000});
 const selects=await page.locator('.pdf-select').evaluateAll(es=>es.map(e=>e.value));assert.ok(selects[0].includes('Limites'));assert.ok(selects[1].includes('Formul'));
 // a moldura do leitor e o documento vêm da view do Bend (core/pdfpageview.bend)
 const shell=await page.evaluate(()=>{const doc=document.querySelector('.pdf-panel .pdf-document'),pages=doc?[...doc.children]:[];return {titles:[...document.querySelectorAll('.pdf-panel > .pdf-title > strong')].map(el=>el.textContent),tools:[...document.querySelector('.pdf-panel .pdf-tools').children].map(el=>el.className.split(' ')[0]),scaffold:document.querySelectorAll('.pdf-panel [data-icon]').length,cls:doc?doc.className:'',pageCls:pages[0]?pages[0].className:'',first:pages[0]?pages[0].dataset.page:'',style:pages[0]?pages[0].getAttribute('style'):'',count:pages.length};});
 assert.deepEqual(shell.titles,['Enunciado','Formulário & apoio'],'títulos dos leitores vêm da view do Bend');
 assert.deepEqual(shell.tools,['prev','page-number','page-total','next','out','zoom-label','in','fit','invert'],'ferramentas na ordem da view do Bend');
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
 await page.locator('#angle').selectOption('deg');await page.locator('#expression').fill('sin(30)');await page.locator('#calc-form button').click();assert.equal(await page.locator('#result').textContent(),'0.5');
 // calculadora da Mesa: a view vem do Bend (`core/calcview.bend` → `desk/src/calc.mjs`)
 assert.equal((await page.locator('#calc-toggle > span').first().textContent()).trim(),'Calculadora','o título do toggle vem da view');
 assert.equal(await page.locator('#calc-toggle svg.icon').count(),1,'o ícone do título é asset do host');
 assert.equal(await page.locator('#calc-guide summary').textContent(),'Como usar','a guia vem da view do Bend');
 assert.equal(await page.locator('#calc-guide code').count(),8,'os códigos da guia vêm da view');
 assert.deepEqual(await page.locator('#calc-history button').evaluateAll(es=>es.map(el=>({text:el.textContent,expr:el.dataset.expr}))),[{text:'sin(30) = 0.5',expr:'sin(30)'},{text:'sqrt(16)+sin(pi/2) = 5',expr:'sqrt(16)+sin(pi/2)'}],'histórico do mais novo para o antigo, com o rótulo pronto');
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
 assert.equal(await page.locator('#calc-history button').first().textContent(),'8+0 = 8','o mais novo fica no topo');
 assert.ok(!(await page.locator('#calc-history button').allTextContents()).some(t=>t.startsWith('sin(30)')),'os mais antigos saem');
 await page.locator('#expression').fill('');
 // colapso: o clique no select do ângulo não colapsa; o clique no título sim
 await page.evaluate(()=>document.querySelector('#angle').dispatchEvent(new MouseEvent('click',{bubbles:true})));
 assert.equal(await page.locator('#calc-body').isHidden(),false,'clique no ângulo não colapsa');
 await page.locator('#calc-toggle > span').first().click();
 assert.equal(await page.locator('#calc-body').isHidden(),true,'o toggle colapsa o corpo');
 assert.equal(await page.locator('#calc-toggle').getAttribute('aria-expanded'),'false','aria-expanded acompanha o colapso');
 assert.equal(await page.locator('#calculator').getAttribute('class'),'collapsed','a seção marca o colapso');
 await page.locator('#calc-toggle > span').first().click();
 assert.equal(await page.locator('#calc-body').isVisible(),true,'o toggle reabre a calculadora');
 // guia aberta sobrevive a um render inteiro (colapso/expansão) e volta fechada
 await page.locator('#calc-guide summary').click();
 assert.equal(await page.locator('#calc-guide').evaluate(el=>el.open),true,'a guia abre');
 await page.locator('#calc-toggle > span').first().click();
 await page.locator('#calc-toggle > span').first().click();
 assert.equal(await page.locator('#calc-guide').evaluate(el=>el.open),true,'o open da guia sobrevive ao render');
 assert.equal(await page.locator('#calc-guide code').count(),8,'os códigos continuam na árvore');
 await page.locator('#calc-guide summary').click();
 // com --calc alto nada fica coberto: o composer cede espaço e a calculadora
 // encolhe até caber (o Enviar continua acessível)
 const calcDefault=await page.evaluate(()=>parseInt(getComputedStyle(document.documentElement).getPropertyValue('--calc'))||220);
 await page.evaluate(()=>document.documentElement.style.setProperty('--calc','700px'));
 await page.waitForTimeout(200);
 const tallCalc=await page.evaluate(()=>{
  const composer=document.querySelector('#composer').getBoundingClientRect();
  const calc=document.querySelector('#calculator').getBoundingClientRect();
  const send=document.querySelector('#send').getBoundingClientRect();
  const hit=document.elementFromPoint(send.x+send.width/2,send.y+send.height/2);
  return {composerBottom:Math.round(composer.bottom),calcTop:Math.round(calc.top),vh:innerHeight,hitSend:!!hit?.closest?.('#send'),hit:hit?.id||hit?.tagName||''};
 });
 assert.ok(tallCalc.composerBottom<=tallCalc.calcTop+1,`nada coberto com --calc alto (composer bottom=${tallCalc.composerBottom}, calc top=${tallCalc.calcTop})`);
 assert.ok(tallCalc.composerBottom<=tallCalc.vh,'o composer cabe na janela com --calc alto');
 assert.equal(tallCalc.hitSend,true,'o Enviar segue clicável com --calc alto (acertou '+tallCalc.hit+')');
 await page.evaluate(h=>document.documentElement.style.setProperty('--calc',h+'px'),calcDefault);
 await page.waitForTimeout(150);
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
 await page.locator('#image-dialog .primary').click();
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
 assert.equal(await page.locator('#slash-list').getAttribute('aria-label'),'Comandos do Pi');
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
 assert.deepEqual(thinking,{role:'status',text:'Pi está pensando…',title:'Pi está pensando…'},'a faixa de atividade avisa enquanto o Pi pensa (title acompanha o rótulo)');
 await page.waitForSelector('#messages .message.assistant:not(.quiz) .katex');
 await page.waitForFunction(()=>!document.querySelector('#send').disabled);
 // medidor de contexto + /compact
 await page.waitForSelector('#ctx-meter:not([hidden])');
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
 const windowSize=await app.evaluate(({BrowserWindow})=>{const b=BrowserWindow.getAllWindows()[0].getBounds();return {width:b.width,height:b.height};});
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(980,760));
 await page.waitForFunction(()=>{const t=document.querySelector('#ctx-tip');if(!t||t.hidden)return false;const r=t.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1;},{timeout:5000});
 const resizedTip=await page.evaluate(()=>{const t=document.querySelector('#ctx-tip'),r=t.getBoundingClientRect();return {open:!t.hidden,right:Math.round(r.right),vw:innerWidth};});
 assert.equal(resizedTip.open,true,'o balão continua aberto depois do resize');
 assert.ok(resizedTip.right<=resizedTip.vw+1,'o balão reposiciona no resize (right='+resizedTip.right+' vw='+resizedTip.vw+')');
 await app.evaluate(({BrowserWindow},size)=>BrowserWindow.getAllWindows()[0].setSize(size.width,size.height),windowSize);
 await page.waitForTimeout(200);
 await page.evaluate(()=>document.querySelector('#ctx-meter').dispatchEvent(new MouseEvent('mouseleave')));
 await page.waitForFunction(()=>document.querySelector('#ctx-tip').hidden,undefined,{timeout:5000});
 const msgsBefore=await page.locator('#messages .message').count();
 await page.locator('#prompt').fill('/compact foque nos quizzes');
 await page.locator('#send').click();
 await page.waitForFunction(()=>document.querySelector('#toast')&&!document.querySelector('#toast').hidden&&document.querySelector('#toast').textContent.includes('Contexto compactado'));
 assert.equal(await page.locator('#messages .message').count(),msgsBefore,'/compact should not add chat messages');
 await page.waitForSelector('#auto-compact:not([hidden])');
 const pressed0=await page.locator('#auto-compact').getAttribute('aria-pressed');
 await page.locator('#auto-compact').click();
 await page.waitForFunction(prev=>{const t=document.querySelector('#toast');return document.querySelector('#auto-compact').getAttribute('aria-pressed')!==prev&&t&&!t.hidden&&t.textContent.includes('Compactação automática');},pressed0,{timeout:8000});
 await page.locator('#auto-compact').click();
 await page.waitForFunction(prev=>document.querySelector('#auto-compact').getAttribute('aria-pressed')===prev,pressed0,{timeout:8000});
 // cabeça do chat: ponto, medidor e compactação vêm da view do Bend
 // (`core/statusview.bend`); o medidor mantém os nós vivos (animação da barra)
 const head=await page.evaluate(()=>{
  const dot=document.querySelector('#status-dot'),meter=document.querySelector('#ctx-meter'),auto=document.querySelector('#auto-compact');
  const em=meter.querySelector('em');
  return {dotTip:dot.getAttribute('data-tip'),dotTitle:dot.hasAttribute('title'),width:meter.querySelector('i').getAttribute('style'),pct:em.textContent,cls:meter.className,autoTip:auto.getAttribute('data-tip'),autoOn:auto.getAttribute('aria-pressed'),autoCls:auto.getAttribute('class')};
 });
 assert.equal(head.dotTitle,false,'o ponto de conexão usa data-tip, não title (view do Bend)');
 assert.match(head.dotTip,/Pi conectado/,'o tooltip do ponto é o rótulo do fato');
 assert.equal(head.width,`width:${head.pct}`,'a barra do medidor usa a largura da view');
 assert.equal(head.cls,parseInt(head.pct,10)>=85?'hot':parseInt(head.pct,10)>=60?'warn':'','a cor do medidor segue os cortes da view');
 assert.match(head.autoTip,/Compactação automática/,'o botão de compactação usa o data-tip da view');
 assert.equal(head.autoCls,head.autoOn==='true'?'on':'','a classe .on acompanha o aria-pressed da view');
 // as opções do seletor de conversa são view do Bend (`statusview.sessionSelect`)
 const sess=await page.evaluate(()=>{const s=document.querySelector('#session-select');return {label:s.getAttribute('aria-label'),selected:[...s.options].filter(o=>o.selected).map(o=>o.value),value:s.value};});
 assert.equal(sess.label,'Conversa','o seletor de conversa é o nó da view');
 assert.equal(sess.selected.length,1,'a conversa corrente é a opção marcada da view');
 assert.equal(sess.selected[0],sess.value,'o selected da view casa com o value do seletor');
 // rodapé de status desenhado pelo Bend (valores empurrados pelo state.mjs)
 await page.waitForSelector('#foot-status:not([hidden])');
 const foot=await page.evaluate(()=>{
  const el=document.querySelector('#foot-status');
  return {title:el.hasAttribute('title'),tip:el.getAttribute('data-tip')||'',aria:el.getAttribute('aria-label')||'',items:[...el.querySelectorAll('.fs-item')].map(i=>i.textContent),seps:el.querySelectorAll('.fs-sep').length};
 });
 assert.equal(foot.title,false,'rodapé usa data-tip, não title');
 assert.match(foot.tip,/·/,'tooltip do rodapé junta as partes');
 assert.match(foot.aria,/·/,'aria-label do rodapé');
 assert.equal(foot.items.length,3,'rodapé com modelo, esforço e contexto');
 assert.match(foot.items[2],/%$/,'contexto do rodapé em %');
 assert.equal(foot.seps,2,'um separador entre cada par');
 await page.waitForTimeout(200);
 await page.evaluate(()=>{
  const p=[...document.querySelectorAll('#messages .message.assistant .body p')].find(el=>el.textContent.includes('Pitágoras'));
  const range=document.createRange();range.selectNodeContents(p);
  const selection=getSelection();selection.removeAllRanges();selection.addRange(range);
 });
 await page.waitForSelector('#quote-btn:not([hidden])');
 await page.locator('#quote-btn').click();
 await page.waitForFunction(()=>document.querySelector('#prompt').value.includes('$a^2 + b^2 = c^2$'));
 const quoted=await page.locator('#prompt').inputValue();
 assert.ok(quoted.startsWith('> '),'quote should be a Markdown blockquote');
 assert.match(quoted,/\$a\^2 \+ b\^2 = c\^2\$/, 'quote should keep the LaTeX source');
 assert.equal(await page.locator('#quote-btn').isHidden(),true);
 await page.locator('#prompt').fill(quoted.trim()+'\n\nPor que isso vale?');
 await page.locator('#send').click();
 await page.waitForFunction(()=>[...document.querySelectorAll('.message.user')].some(el=>el.textContent.includes('Por que isso vale?')));
 await page.waitForFunction(()=>!document.querySelector('#send').disabled);
 await page.locator('#prompt').fill('');
 await page.evaluate(()=>{
  const katex=document.querySelectorAll('#messages .message.assistant:not(.quiz) .katex')[0];
  const range=document.createRange();range.selectNodeContents(katex);
  const selection=getSelection();selection.removeAllRanges();selection.addRange(range);
 });
 await page.waitForSelector('#quote-btn:not([hidden])');
 await page.locator('#quote-btn').click();
 await page.waitForFunction(()=>document.querySelector('#prompt').value.trim()==='> $a^2 + b^2 = c^2$');
 await page.locator('#prompt').fill('');
 await page.evaluate(()=>{
  const display=document.querySelector('#messages .message.assistant:not(.quiz) .katex-display');
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
 await page.locator('#exercise-title').fill('Lista 2 · questão 7b');
 await page.waitForFunction(()=>document.querySelector('#context-summary').textContent.includes('Lista 2 · questão 7b')&&document.querySelector('#context-summary').textContent.includes('p.2'));
 // flags padrão do `desk`: o botão de referências do composer é view do Bend
 assert.equal(await page.locator('#include-refs').isHidden(),false,'com a flag padrão o botão de referências fica visível');
 assert.equal(await page.locator('#include-refs').getAttribute('aria-pressed'),'true','o aria-pressed acompanha o fato do host');
 await page.locator('#end-day').click();assert.equal(await page.locator('#end-day-dialog').getAttribute('open'),'');
 assert.equal(await page.locator('#end-day-dialog h2').textContent(),'Encerrar por hoje','o miolo do Encerrar vem da view do Bend');
 assert.equal(await page.locator('#end-day-dialog label').first().textContent(),'Onde parei');
 assert.equal(await page.locator('#end-day-save').getAttribute('value'),'ok','o botão de salvar mantém id/value');
 await page.locator('#end-day-dialog button[value="cancel"]').click();await page.waitForFunction(()=>!document.querySelector('#end-day-dialog').open);
 await page.locator('#end-day').click();await page.locator('#end-where').fill('terminei a questão 7b');await page.locator('#end-next').fill('começar a questão 8');await page.locator('#end-day-save').click();
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
 await panel0.locator('.collapse').click();
 await page.waitForFunction(()=>document.querySelector('.pdf-panel').classList.contains('minimized'),undefined,{timeout:5000});
 assert.equal(await panel0.locator('.collapse').getAttribute('aria-pressed'),'true','o botão marca o leitor minimizado');
 const min0=await panel0.boundingBox(),max1=await panel1.boundingBox();
 assert.ok(min0.height<60,'o leitor minimizado vira uma faixa');
 assert.ok(max1.width>box1.width+200,'o outro leitor ocupa a largura liberada (p0 '+Math.round(box0.width)+'→'+Math.round(min0.width)+', p1 '+Math.round(box1.width)+'→'+Math.round(max1.width)+')');
 await page.waitForTimeout(600);
 assert.equal(JSON.parse(fs.readFileSync(path.join(runtime,'desk.json'),'utf8')).pdfs[0].minimized,true,'minimized persists');
 await panel0.locator('.collapse').click();
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
 await page.waitForTimeout(80);
 const afterKey=await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--pdf-left'));
 assert.notEqual(afterKey.trim(),after.trim(),'divider keyboard should adjust the split');
 await page.waitForTimeout(600);
 const deskState=JSON.parse(fs.readFileSync(path.join(runtime,'desk.json'),'utf8'));
 assert.ok(deskState.pdfSplit>.2&&deskState.pdfSplit<.8,'pdfSplit should persist');
 // toasts em fila: dois avisos coexistem e saem sozinhos
 await page.evaluate(()=>{document.querySelector('#expression').value='sqrt(';const button=document.querySelector('#calc-form button');button.click();button.click();});
 await page.waitForFunction(()=>document.querySelectorAll('#toast .toast-item').length===2,{timeout:5000});
 assert.deepEqual(await page.locator('#toast .toast-item').evaluateAll(es=>es.map(el=>el.getAttribute('class'))),['toast-item','toast-item'],'itens abertos sem classe de saída');
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
 await page.locator('.pdf-panel').first().locator('.invert').click();
 await page.waitForFunction(()=>{const viewport=document.querySelector('.pdf-panel .pdf-viewport');return !!viewport&&viewport.classList.contains('inverted');},{timeout:5000});
 assert.equal(await page.locator('.pdf-panel').first().locator('.invert').getAttribute('aria-pressed'),'true');
 await page.waitForFunction(()=>{const canvas=document.querySelector('.pdf-panel .pdf-page canvas');return !!canvas&&getComputedStyle(canvas).filter.includes('invert(1)');},{timeout:5000});
 await page.waitForTimeout(600);
 assert.equal(JSON.parse(fs.readFileSync(path.join(runtime,'desk.json'),'utf8')).pdfs[0].invert,true,'invert persists per document');
 await page.locator('.pdf-panel').first().locator('.invert').click();
 await page.waitForFunction(()=>{const viewport=document.querySelector('.pdf-panel .pdf-viewport');return !!viewport&&!viewport.classList.contains('inverted');},{timeout:5000});
 await page.locator('#mesa-menu .nav-trigger').click();
 await page.locator('#settings').click();
 await page.waitForSelector('#settings-dialog[open]');
 assert.equal(await page.locator('#settings-title').textContent(),'Configurações','título do diálogo vem da view do Bend');
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
 await page.locator('#mesa-menu .nav-trigger').click();
  await page.locator('#help').click();
  await page.waitForSelector('#help-dialog[open]');
  assert.match(await page.locator('#help-version').textContent(),/^Mesa de Estudos \d/,'a versão da ajuda vem da view do Bend');
  await page.locator('#keys-customize').click();
  await page.waitForSelector('#keys-dialog[open]');
  assert.equal(await page.locator('#keys-title').textContent(),'Atalhos de teclado','o editor abre com o título da view do Bend');
  assert.deepEqual(await page.locator('#keys-dialog .keys-group > h3').evaluateAll(es=>es.map(el=>el.textContent)),['Estudar','Visualização','Ajuda','Arquivo','Conversa'],'as seções mantêm a ordem do catálogo');
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
  await page.locator('#help-dialog .dialog-actions .primary').click();
 await page.waitForFunction(()=>!document.querySelector('#help-dialog').open);
 await page.locator('#mesa-menu .nav-trigger').click();
 await page.locator('#about').click();
 await page.waitForSelector('#about-dialog[open]');
 assert.match(await page.locator('#about-dialog .help-lead').first().textContent(),/^Mesa de Estudos \d.*licença MIT$/,'o lead do Sobre carrega a versão');
 await page.locator('#about-dialog .dialog-actions .primary').click();
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
 await page.screenshot({path:'ui-desktop.png'});
 const courseTabs=page.locator('#course-tabs button');
 assert.ok(await courseTabs.count()>=1,'course tabs render');
 const activeTab=page.locator('#course-tabs button.active');
 assert.equal(await activeTab.count(),1,'exactly one tab is active');
 assert.equal(await activeTab.getAttribute('data-id'),'Calculus I','the persisted course is the active tab');
 assert.equal(await activeTab.getAttribute('aria-selected'),'true','active tab is aria-selected');
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1050,760));await page.waitForTimeout(500);await page.screenshot({path:'ui-compact.png'});
 assert.deepEqual(errors,[]);console.log('UI PASSED: PDFs, live context summary, end-of-day JSONL, calculator, in-chat images, quiz cards (incl. dont-know), quote with inline/display LaTeX, attachments, settings/help/about (rows and version from the Bend view), toast queue, chat collapse (⌘\\), ⌘F find, invertible pages, desktop/compact.');
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
 assert.equal(await page.locator('#end-day').isHidden(),true,'endDay flag hides the end-of-day button');
 assert.equal(await page.locator('#study-context').isHidden(),true,'studyContext flag hides the study context row');
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
 await page.locator('#mesa-menu .nav-trigger').click();
 await page.locator('#settings').click();
 await page.waitForSelector('#settings-dialog[open]');
 const deskRaw=JSON.parse(fs.readFileSync(path.join(runtime,'config.json'),'utf8'));
 assert.equal(deskRaw.desk.refsToggle,false);assert.equal(deskRaw.desk.endDay,false);assert.equal(deskRaw.desk.studyContext,false);
 // Enter num campo salva: o `<form method="dialog">` herdado ativava o "×"
 // (primeiro submit, `value=cancel`) e a edição era descartada como cancelamento
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
 const tabs=page.locator('#course-tabs button');
 await page.waitForFunction(()=>{const tabs=[...document.querySelectorAll('#course-tabs button')];return tabs.length===3&&tabs.every(tab=>!tab.disabled);},{timeout:30000});
 // deixa a conexão automática do boot assentar: clicar durante o connect inicial é a corrida que o waitIdle cobre, mas o teste não precisa dela
 await statusOnline(page);
 await page.waitForTimeout(2500);
 assert.equal(await tabs.count(),3,'two courses plus the GeoGebra tab');
 assert.equal(await tabs.nth(2).textContent(),'GeoGebra','last tab is GeoGebra');
 assert.equal(await tabs.first().getAttribute('aria-selected'),'true','first course starts active');
 // abas e menus vêm da view do Bend (core/tabsview.bend): ids/ordem e andaime limpo
 assert.equal(await page.locator('#new-tab').getAttribute('title'),'Nova matéria (abre as Configurações)','o "+" é o nó da view');
 assert.deepEqual(await page.locator('#study-pop button[role="menuitem"]').evaluateAll(es=>es.map(e=>e.id)),['reference-toggle','xournal'],'itens do menu Estudar na ordem');
 assert.deepEqual(await page.locator('#mesa-pop button[role="menuitem"]').evaluateAll(es=>es.map(e=>e.id)),['help','settings','theme-cycle','about'],'itens do menu Mesa na ordem');
 assert.equal(await page.locator('#course-tabs [data-icon],#study-pop [data-icon],#mesa-pop [data-icon]').count(),0,'o andaime data-icon sai do DOM');
 assert.match(await page.locator('#theme-cycle').textContent(),/^Tema: (auto|claro|escuro)$/,'rótulo do tema no item');
 await tabs.nth(1).click();
 await page.waitForFunction(()=>{const tab=document.querySelectorAll('#course-tabs button')[1];return tab?.classList.contains('active')&&tab?.getAttribute('aria-selected')==='true';},{timeout:15000});
 assert.match(await page.title(),/Matéria B/,'document title follows the active tab');
 assert.equal(await page.locator('.pdf-placeholder').count(),2,'empty course shows the PDF placeholders');
 await statusOnline(page);
 await page.waitForFunction(()=>[...document.querySelectorAll('#course-tabs button')].every(tab=>!tab.disabled),{timeout:30000});
 await page.keyboard.press('ControlOrMeta+1');
 await page.waitForFunction(()=>{const tab=document.querySelectorAll('#course-tabs button')[0];return tab?.classList.contains('active')&&tab?.getAttribute('aria-selected')==='true';},{timeout:15000});
 assert.match(await page.title(),/Matéria A/,'⌘1 returns to the first tab');
 await page.waitForFunction(()=>[...document.querySelectorAll('#course-tabs button')].every(tab=>!tab.disabled),{timeout:30000});
 // roving tabindex vem do núcleo: ativa `0`, demais `-1`; as setas movem o
 // foco e ativam como o clique (⌘1..9 e clique seguem iguais)
 const rovingInitial=await page.evaluate(()=>[...document.querySelectorAll('#course-tabs button')].map(t=>[t.dataset.id,t.getAttribute('tabindex'),t.classList.contains('active')]));
 assert.deepEqual(rovingInitial,[['A','0',true],['B','-1',false],['geogebra','-1',false]],'o tablist usa roving tabindex vindo da view do Bend');
 await page.locator('#course-tabs button[data-id="A"]').focus();
 await page.keyboard.press('ArrowRight');
 await page.waitForFunction(()=>{const t=document.querySelector('#course-tabs button[data-id="B"]');return document.activeElement===t&&t.classList.contains('active');},{timeout:15000});
 assert.deepEqual(await page.evaluate(()=>[...document.querySelectorAll('#course-tabs button')].map(t=>[t.dataset.id,t.getAttribute('tabindex'),t.classList.contains('active')])),[['A','-1',false],['B','0',true],['geogebra','-1',false]],'a seta move o foco e ativa a aba (roving atualizado)');
 await page.keyboard.press('ArrowLeft');
 await page.waitForFunction(()=>{const t=document.querySelector('#course-tabs button[data-id="A"]');return document.activeElement===t&&t.classList.contains('active');},{timeout:15000});
 assert.match(await page.title(),/Matéria A/,'a seta de volta reativa a matéria');
 await statusOnline(page);
 await page.waitForFunction(()=>[...document.querySelectorAll('#course-tabs button')].every(tab=>!tab.disabled),{timeout:30000});
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
 await page.locator('.pdf-panel').first().locator('.page-shot').click();
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
 await page.waitForTimeout(300);
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
 await page.locator('#export-chat').click();
 await page.waitForFunction(()=>!document.querySelector('#toast').hidden&&document.querySelector('#toast').textContent.includes('exportada'),{timeout:15000});
 const exportDir=path.join(runtime,'Mesa de Estudos');
 const exported=fs.readdirSync(exportDir).filter(n=>n.endsWith('.md'));
 assert.equal(exported.length,1,'export writes one markdown file into the vault folder');
 const markdown=fs.readFileSync(path.join(exportDir,exported[0]),'utf8');
 assert.match(markdown,/## Pi/);assert.match(markdown,/## Você/);
 assert.match(markdown,/Integral/);assert.match(markdown,/quiz/);
 await page.locator('#mesa-menu .nav-trigger').click();
 await page.locator('#theme-cycle').click();
 assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),'light','first cycle applies the light theme');
 // regressão: o clique no item não pode desanexar o alvo no meio do dispatch (o menu fecharia)
 assert.equal(await page.evaluate(()=>document.querySelector('#mesa-menu').classList.contains('open')),true,'o menu continua aberto depois do tema');
 assert.equal((await page.locator('#theme-cycle').textContent()).trim(),'Tema: claro','o rótulo do item acompanha o tema');
 await page.locator('#theme-cycle').click();
 assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),'dark','second cycle applies the dark theme');
 assert.equal(await page.evaluate(()=>document.querySelector('#mesa-menu').classList.contains('open')),true,'o menu segue aberto no segundo ciclo');
 await page.keyboard.press('Escape');
 await page.waitForFunction(()=>!document.querySelector('#mesa-menu').classList.contains('open'));
 await page.waitForTimeout(700);
 assert.equal(JSON.parse(fs.readFileSync(path.join(runtime,'desk.json'),'utf8')).theme,'dark','theme persists to desk.json');
 assert.deepEqual(errors,[]);console.log('TABS PASSED: two courses as tabs, click switches course (aria-selected, title, placeholders), ⌘1 returns to the first; PDF text layer feeds Citar and page-shot attaches the page as image; find scans all pages with highlight+counter, message copy overlay, Markdown export, and theme cycle persist.');
 // GeoGebra: aba especial + ponte HTTP local
 await page.locator('#course-tabs button[data-id="geogebra"]').click();
 await page.waitForFunction(()=>document.querySelector('#references').classList.contains('ggb')&&!document.querySelector('#ggb-bar').hidden);
 assert.notEqual(await page.locator('#pdf-grid').first().evaluate(el=>getComputedStyle(el).visibility),'visible','PDF grid hides while GeoGebra tab is active');
 await app.evaluate(({BrowserWindow})=>{const win=BrowserWindow.getAllWindows()[0];if(win.contentView.children.length<1)throw Error('GeoGebra view not attached');});
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
  await page.waitForSelector('#attachments .attachment img');
  // o handler não pode cair no CSP (fetch de data: é bloqueado por connect-src)
  assert.match(await page.locator('#attachments .attachment img').getAttribute('alt'),/geogebra/i,'o Print no chat anexa o File do print');
  assert.doesNotMatch(await page.locator('#toast').textContent(),/Failed to fetch/,'o print não pode morrer no fetch(data:) do CSP');
  await page.locator('#attachments .attachment-remove').click();
  await page.waitForFunction(()=>document.querySelector('#attachments').hidden);
 }
 if(ggbReady){
  await page.locator('#course-tabs button[data-id="A"]').click();
  await page.waitForFunction(()=>!document.querySelector('#references').classList.contains('ggb'));
  let savedGgb=false;
  for(let i=0;i<40&&!savedGgb;i++){await page.waitForTimeout(200);try{savedGgb=fs.existsSync(path.join(runtime,'ggb','A.b64'))&&fs.readFileSync(path.join(runtime,'ggb','A.b64'),'utf8').length>0;}catch{}}
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
 await page.waitForTimeout(700);
 const logFile=path.join(runtime,'desk.log');
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
 await toastWait(page,'Pi encerrou',{timeout:20000});
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
 await toastWait(page,'Falha de teste no meio da resposta',{timeout:20000});
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
 await toastWait(page,'demorou demais',{timeout:60000});
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
 // histórico: trocar de conversa e voltar reconstrói o diário recolhido do JSONL
 await page.waitForFunction(()=>{const s=document.querySelector('#session-select');return s&&!s.disabled;},undefined,{timeout:20000});
 const otherValue=await page.evaluate(()=>[...document.querySelector('#session-select').options].map(o=>o.value).find(v=>v.endsWith('pi-1700000003000.jsonl')));
 assert.ok(otherValue,'a outra conversa aparece no seletor');
 await page.locator('#session-select').selectOption(otherValue);
 await page.waitForFunction(()=>document.querySelector('#session-select').value.endsWith('pi-1700000003000.jsonl'));
 await page.waitForFunction(()=>{const s=document.querySelector('#session-select');return s&&!s.disabled;},undefined,{timeout:20000});
 const liveValue=await page.evaluate(()=>[...document.querySelector('#session-select').options].map(o=>o.value).find(v=>v.endsWith('pi-1700000002000.jsonl')));
 // O guard da troca recusa enquanto a conexão anterior não assentou: tenta de novo.
 let back=false;
 for(let attempt=0;attempt<20&&!back;attempt++){
  await page.locator('#session-select').selectOption(liveValue).catch(()=>{});
  await page.waitForTimeout(250);
  back=await page.evaluate(()=>document.querySelector('#session-select').value.endsWith('pi-1700000002000.jsonl'));
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

// O vazio da conversa (#welcome) é view do Bend (`core/welcomeview.bend`): a
// troca de matéria o recria com o título da matéria e o connect do host o
// remove quando a sessão abre. A leitura é atômica (dentro do poll) porque o
// vazio com o Pi de teste é transitório.
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
 const welcome=await page.waitForFunction(()=>{
  const box=document.querySelector('#welcome');if(!box)return false;
  const h3=box.querySelector('h3');if(!h3||h3.textContent!=='Matéria B')return false;
  const button=document.querySelector('#connect');
  return {kids:[...box.children].map(el=>el.tagName.toLowerCase()),h3:h3.textContent,p:box.querySelector('p')?.textContent||'',connect:button?.textContent.trim()||'',icon:!!button?.querySelector('svg')};
 },undefined,{timeout:15000}).then(handle=>handle.jsonValue());
 assert.deepEqual(welcome,{kids:['h3','button','p'],h3:'Matéria B',p:'Sessão local desta matéria.',connect:'Conectar ao Pi',icon:true},'o vazio da conversa vem da view do Bend (título da matéria e botão do host)');
 await page.waitForFunction(()=>!document.querySelector('#welcome'),undefined,{timeout:20000});
 assert.deepEqual(errors,[]);
 console.log('WELCOME PASSED: a troca de matéria desenha o vazio pelo Bend (título da matéria, botão Conectar) e o connect o recolhe.');
});

// IPC: o mesmo erro de conexão chega como `desk_error` e como rejeição do
// `pi-connect`; o usuário não pode ver dois avisos nem o embrulho do Electron.
await withArtifacts('ipc-error-once',async ctx=>{
 const runtime=ctx.runtime=newRuntime('ipc-uma-vez');
 seedCourse(runtime,'A');
 writeDeskJson(runtime,{courseId:'A'});
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'A',name:'Matéria A',path:path.join(runtime,'learning','Courses','A')}]});
 const app=ctx.app=await launchDesk({runtime,env:{LEARNING_DESK_PI:'/usr/bin/false'}});
 const page=await app.firstWindow();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.waitForFunction(()=>{const t=document.querySelector('#toast');return !!t&&/Pi/i.test(t.textContent);},undefined,{timeout:20000});
 await page.waitForTimeout(700);
 const toast=await page.evaluate(()=>({items:[...document.querySelectorAll('#toast .toast-item')].map(el=>el.textContent),all:document.querySelector('#toast').textContent}));
 assert.equal(toast.items.length,1,'uma falha de conexão gera um único aviso');
 assert.doesNotMatch(toast.all,/Error invoking remote method/,'o aviso não vaza boilerplate do Electron');
 assert.equal((toast.all.match(/Pi encerrou|Pi não encontrado/g)||[]).length,1,'a mensagem original aparece uma vez');
 assert.match(await page.locator('#status-dot').getAttribute('class'),/error/,'o ponto de conexão acusa o erro');
 assert.equal(await page.locator('#send').isEnabled(),true,'send continua habilitado depois da falha');
 assert.deepEqual(errors,[]);
 console.log('IPC ERROR PASSED: falha de conexão vira um único toast com a mensagem original do host.');
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
 await page.waitForSelector('#welcome-dialog[open]',{timeout:30000});
 assert.equal(await page.locator('#welcome-dialog h2').textContent(),'Bem-vindo à Mesa de Estudos');
 assert.equal(await page.locator('#welcome-dialog .welcome-block').count(),4,'quatro blocos na boas-vindas');
 assert.deepEqual(await page.locator('#welcome-dialog .welcome-block h3').allTextContents(),['O que é a Mesa','O Pi','Customização por agentes','Dicas de uso']);
 assert.ok(await page.locator('#welcome-settings').isVisible(),'o Configurar agora vem do núcleo');
 await page.locator('#welcome-settings').click();
 await page.waitForSelector('#settings-dialog[open]');
 assert.equal(await page.locator('#settings-title').textContent(),'Bem-vindo à Mesa de Estudos','Configurar agora abre as Configurações de primeira vez');
 assert.equal(await page.locator('#welcome-dialog').isHidden(),true,'a boas-vindas fecha');
 await page.locator('#settings-dialog button[value="cancel"]').last().click();
 await page.waitForFunction(()=>!document.querySelector('#settings-dialog').open);
 assert.deepEqual(errors,[]);console.log('PRIMEIRA ABERTURA PASSED: boas-vindas do Bend (4 blocos + Configurar agora) abrem a primeira Configuração.');
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
   {id:'mesa',label:'Mesa',version:'0.4.0',state:'outdated',latest:'9.9.9'},
   {id:'pi',label:'Pi',version:'0.86.1',state:'ok',hint:'Em desk/node_modules (atualizável pela Mesa).',canUpdate:true},
   {id:'node',label:'Node',version:'22.18.0',state:'warn',note:'abaixo de 22.19 — o Pi exige Node 22.19+'},
   {id:'xournal',label:'Xournal++',version:'1.2.5',state:'outdated',latest:'1.2.7',link:'https://github.com/xournalpp/xournalpp/releases/latest',linkLabel:'Ver página'},
  ]}));
 });
 await page.locator('#mesa-menu .nav-trigger').click();
 await page.locator('#about').click();
 await page.waitForSelector('#about-dialog[open]');
 await page.waitForSelector('#about-update .update-line',{timeout:8000});
 const linha=await page.locator('#about-update .update-line').textContent();
 assert.match(linha,/^v9\.9\.9 disponível — o que mudou \(/,'a linha do update é a literal do plano');
 assert.match(linha,/\) · Atualizar e reiniciar$/);
 assert.equal(await page.locator('#update-notes').textContent(),'Notas da versão');
 assert.equal(await page.locator('#update-notes').getAttribute('data-url'),'https://example.com/release-notes','Notas da versão abre pelo handler OpenLink');
 assert.equal(await page.locator('#update-apply').textContent(),'Atualizar e reiniciar');
 assert.equal(await page.locator('#about-update .update-notes').textContent(),'Corpo da Release de teste','o que mudou é o corpo da Release');
 assert.deepEqual(await page.locator('#component-rows .component-row').evaluateAll(es=>es.map(e=>e.dataset.id)),['mesa','pi','node','xournal'],'ordem: Mesa, Pi, Node, Xournal++');
 // o painel nasce "Verificando…" e a checagem (falsa) chega no mesmo lugar (C3)
 await page.waitForFunction(()=>![...document.querySelectorAll('#component-rows .component-state')].some(e=>e.textContent==='Verificando…'),undefined,{timeout:8000});
 assert.equal(await page.locator('#component-rows .component-row').first().locator('.component-state').textContent(),'→ v9.9.9 disponível');
 assert.equal(await page.locator('#component-rows [data-id="node"] .component-state').textContent(),'abaixo de 22.19 — o Pi exige Node 22.19+','aviso de Node antigo vem do núcleo');
 assert.equal(await page.locator('#update-pi').isVisible(),true,'Pi local com versão nova mostra Atualizar Pi');
 assert.equal(await page.locator('#component-rows [data-id="xournal"] .component-link').textContent(),'Ver página');
 assert.equal(await page.locator('#component-rows [data-id="xournal"] .component-update').count(),0,'Xournal++ é só informativo (nunca ganha botão)');
 // o mesmo botão manual cobre o painel todo (Mesa + Pi + Xournal sob demanda)
 await page.locator('#components-refresh').click();
 await page.waitForFunction(()=>document.querySelector('#about-update .update-line')?.textContent.includes('v9.9.9'),undefined,{timeout:8000});
 // sem versão nova a linha diz "última versão" e o botão manual continua lá
 await app.evaluate(({ipcMain})=>{ipcMain.removeHandler('update-check');ipcMain.handle('update-check',async()=>({status:'current',version:'9.9.9',notes:'',url:'',current:'0.4.0'}));});
 await page.locator('#components-refresh').click();
 await page.waitForFunction(()=>document.querySelector('#about-update')?.textContent.includes('última versão'),undefined,{timeout:8000});
 assert.equal(await page.locator('#update-check').isVisible(),true,'mesmo na última o Verificar atualizações fica');
 await page.locator('#about-dialog .dialog-actions .primary').click();
 await page.waitForFunction(()=>!document.querySelector('#about-dialog').open);
 assert.deepEqual(errors,[]);
 console.log('ATUALIZACAO PASSED: linha do updater (vX disponível — o que mudou (Notas da versão) · Atualizar e reiniciar) e painel Componentes (4 linhas nascem Verificando…, estados, Atualizar Pi só no Pi local) vêm do Bend.');
});
