import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {withArtifacts,launchDesk,newRuntime,seedCourse,writeConfigJson,writeDeskJson,seedSession,tinyPdf,statusOnline,toastWait} from './helpers.mjs';

/* Smoke Electron da área de apoio + chat lateral (frontend).
   Exercita o fluxo REAL: IPC/backend do chat lateral, fake Pi, PDFs de teste.
   Cobre: abas Formulário×Chat, recolher/reabrir preservando o leitor, chat
   lateral (histórico, rascunho persistente, stream, Markdown/LaTeX), "Levar ao
   chat principal" sem enviar, pedido/permissão respondido no canal lateral,
   stop, contexto explícito, conversas da matéria, referências com estado,
   caderno no cabeçalho, tema nas Configurações e integração do módulo Layout. */

async function openSidechatTab(page){
 await page.locator('#support-tab-chat').click();
 await page.waitForFunction(()=>{const sc=document.querySelector('#sidechat');return sc&&!sc.hidden;},{timeout:10000});
 await page.waitForFunction(()=>{
  const box=document.querySelector('#sidechat-messages');
  const error=box&&[...box.querySelectorAll('.sidechat-msg.system')].map(el=>el.textContent).join(' ');
  if(error)throw new Error(error);
  return !!document.querySelector('#sidechat-prompt')&&!document.querySelector('#sidechat-prompt').disabled;
 },undefined,{timeout:20000});
}

async function sidechatFiles(runtime){
 const dir=path.join(runtime,'sidechats');
 if(!fs.existsSync(dir))return {dir,index:null,descriptors:[]};
 const index=fs.existsSync(path.join(dir,'index.json'))?JSON.parse(fs.readFileSync(path.join(dir,'index.json'),'utf8')):{};
 const descriptors=fs.readdirSync(dir).filter(name=>name.endsWith('.json')&&name!=='index.json').map(name=>JSON.parse(fs.readFileSync(path.join(dir,name),'utf8')));
 return {dir,index,descriptors};
}

await withArtifacts('area-apoio-e-lateral',async ctx=>{
 const runtime=ctx.runtime=newRuntime('apoio-lateral'),course=seedCourse(runtime,'Test');
 const first=path.join(course,'Limites.pdf'),second=path.join(course,'Formulario.pdf');
 fs.writeFileSync(first,tinyPdf('Exercise',2));
 fs.writeFileSync(second,tinyPdf('Support',2));
 const current=seedSession(runtime,[{type:'message',message:{role:'user',content:[{type:'text',text:'conversa atual'}]}}]);
 const older=path.join(runtime,'pi-1700000000000.jsonl');
 fs.writeFileSync(older,JSON.stringify({type:'message',message:{role:'user',content:[{type:'text',text:'conversa antiga'}]}})+'\n');
 writeDeskJson(runtime,{session:current,courseId:'Test',courseStates:{Test:{session:current,pdfs:[{path:first,page:1,zoom:1,scrollX:0,scrollY:0},{path:second,page:1,zoom:1,scrollX:0,scrollY:0}],sessions:[{path:current,started:Date.now(),preview:'conversa atual'},{path:older,started:Date.now()-3600000,preview:'conversa antiga'}]}}});
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'Test',name:'Teste',path:course}],desk:{pinnedExtensions:false}});
 ctx.app=await launchDesk({runtime});
 const page=await ctx.app.firstWindow();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')console.log('CONSOLE',m.text());});
 await statusOnline(page);
 await page.waitForSelector('.pdf-panel canvas',{timeout:25000});

 /* ---- 1. Controle sempre visível + alternância sem perder o leitor ---- */
 await page.waitForSelector('#support-bar',{timeout:10000});
 assert.equal(await page.locator('#support-bar').isVisible(),true,'a barra da área de apoio fica visível');
 assert.equal(await page.locator('#support-tab-form').isVisible(),true,'com 2 leitores o Formulário aparece');
 assert.equal(await page.locator('#support-tab-form').getAttribute('aria-selected'),'true','o Formulário é a aba inicial');
 assert.equal(await page.locator('#support-slot .pdf-panel').count(),1,'o painel 2 é movido para o slot (não recriado)');
 assert.equal(await page.locator('#pdf-grid > .pdf-panel').count(),1,'o painel 1 fica na grade');
 const panel2=page.locator('.pdf-panel').nth(1);
 for(let i=0;i<4;i++)await panel2.locator('.in').click();
 await page.waitForFunction(()=>document.querySelectorAll('.pdf-panel')[1]?.querySelector('.zoom-label')?.textContent!=='100%',undefined,{timeout:5000});
 await panel2.locator('.pdf-viewport').evaluate(el=>{el.scrollTop=Math.max(30,el.scrollHeight-el.clientHeight-10);el.dispatchEvent(new Event('scroll'));});
 await page.waitForTimeout(500);
 const savedPanel={path:await panel2.locator('.pdf-select').inputValue(),zoom:await panel2.locator('.zoom-label').textContent(),scroll:await panel2.locator('.pdf-viewport').evaluate(el=>el.scrollTop)};
 assert.ok(savedPanel.scroll>0,'o leitor de apoio rolou para o teste');
 await page.locator('#support-tab-chat').click();
 await page.waitForFunction(()=>!document.querySelector('#sidechat').hidden,{timeout:10000});
 assert.equal(await panel2.isVisible(),false,'o Formulário sai de cena com o Chat lateral');
 await page.locator('#support-tab-form').click();
 await page.waitForTimeout(1200);
 assert.equal(await panel2.isVisible(),true,'o Formulário volta');
 assert.equal(await panel2.locator('.pdf-select').inputValue(),savedPanel.path,'o documento do painel 2 é preservado');
 assert.equal(await panel2.locator('.zoom-label').textContent(),savedPanel.zoom,'o zoom do painel 2 é preservado');
 const restoredScroll=await panel2.locator('.pdf-viewport').evaluate(el=>el.scrollTop);
 assert.ok(Math.abs(restoredScroll-savedPanel.scroll)<=8,'a rolagem do painel 2 é preservada ('+savedPanel.scroll+' -> '+restoredScroll+')');

 /* ---- 2. Chat lateral de verdade (abre, recebe stream, LaTeX) ---- */
 await openSidechatTab(page);
 assert.equal(await page.locator('#sidechat').getAttribute('data-state'),null,'o chat lateral abriu (sem estado de indisponível)');
 await page.locator('#sidechat-prompt').fill('pergunta inicial');
 await page.waitForTimeout(800);
 let files=await sidechatFiles(runtime);
 assert.ok(files.descriptors.length>=1,'o backend persistiu o descritor do chat lateral');
 await page.locator('#sidechat-prompt').fill('teorema do chat lateral');
 await page.locator('#sidechat-prompt').press('Enter');
 await page.waitForFunction(()=>[...document.querySelectorAll('#sidechat-messages .sidechat-msg.assistant .sidechat-body')].some(el=>el.textContent.includes('Pitágoras')),undefined,{timeout:30000});
 assert.ok(await page.locator('#sidechat-messages .sidechat-msg.assistant .katex').count()>0,'a resposta lateral renderizou LaTeX (KaTeX)');
 assert.ok(await page.locator('#sidechat-messages .sidechat-msg.user').count()>=1,'a mensagem do usuário aparece no canal lateral');
 assert.equal(await page.locator('#pi-dialog[open]').count(),0,'o lateral não usa o diálogo do principal');

 /* ---- 3. Levar ao chat principal: append no rascunho, nunca envia ---- */
 await page.locator('#prompt').fill('rascunho principal existente');
 const beforeMessages=await page.locator('#messages .message.user').count();
 await page.locator('#sidechat-messages .sidechat-msg.assistant .sidechat-to-main').last().click();
 const draft=await page.locator('#prompt').inputValue();
 assert.match(draft,/^rascunho principal existente\n\n/,'o rascunho principal é preservado e a resposta é anexada');
 assert.match(draft,/Pitágoras/,'a resposta lateral entrou no rascunho');
 assert.equal(await page.locator('#messages .message.user').count(),beforeMessages,'nada foi enviado ao principal');
 await page.waitForFunction(()=>document.querySelector('#toast')?.textContent.includes('rascunho do chat principal'));

 /* ---- 4. Rascunho e histórico persistem no reload ---- */
 await page.locator('#sidechat-prompt').fill('rascunho lateral persistente');
 await page.waitForTimeout(900);
 files=await sidechatFiles(runtime);
 const live=files.descriptors.find(item=>item.draft==='rascunho lateral persistente');
 assert.ok(live,'o backend guardou o rascunho do lateral');
 await page.reload();
 await statusOnline(page,{timeout:30000});
 await page.waitForFunction(()=>{const sc=document.querySelector('#sidechat');return sc&&!sc.hidden&&!document.querySelector('#sidechat-prompt').disabled;},undefined,{timeout:30000});
 assert.equal(await page.locator('#sidechat-prompt').inputValue(),'rascunho lateral persistente','o rascunho volta após o reload');
 await page.waitForFunction(()=>[...document.querySelectorAll('#sidechat-messages .sidechat-body')].some(el=>el.textContent.includes('Pitágoras')),undefined,{timeout:20000});
 assert.ok(await page.locator('#sidechat-messages .sidechat-msg.assistant .katex').count()>0,'o histórico com LaTeX volta após o reload');

 /* ---- 5. Contexto do principal: detalhes + atualização explícita ---- */
 await page.locator('#sidechat-context').click();
 await page.waitForFunction(()=>!document.querySelector('#sidechat-context-pop').hidden);
 const ctxText=await page.locator('#sidechat-context-pop').innerText();
 assert.match(ctxText,/Conversa principal/);
 assert.match(ctxText,/Limites\.pdf/);
 await page.locator('#sidechat-context-pop .primary').click();
 await page.locator('#sidechat-refresh').click();
 await toastWait(page,'Contexto atualizado',{timeout:10000});
 files=await sidechatFiles(runtime);
 const withStudy=files.descriptors.find(item=>Array.isArray(item.context?.refs)&&item.context.refs.length===2);
 assert.ok(withStudy,'o contexto atualizado guardou os 2 PDFs abertos');

 /* ---- 6. Conversas da matéria (título/data/trecho/motor) ---- */
 await page.locator('#conversations-toggle').click();
 await page.waitForFunction(()=>document.querySelectorAll('#conv-list .conv-row').length>=2,undefined,{timeout:10000});
 const rows=await page.locator('#conv-list .conv-row').evaluateAll(list=>list.map(row=>({title:row.querySelector('.conv-title')?.textContent||'',meta:row.querySelector('.conv-meta')?.textContent||'',preview:row.querySelector('.conv-preview')?.textContent||''})));
 assert.ok(rows.some(row=>row.preview.includes('conversa antiga')),'a prévia da conversa antiga aparece: '+JSON.stringify(rows));
 assert.ok(rows.every(row=>row.title.length>0&&row.meta.length>0),'título e data/motor aparecem em cada conversa');
 await page.locator('#prompt').fill('rascunho principal existente');
 await page.waitForTimeout(700);
 await page.locator('#conv-list .conv-row').filter({hasText:'conversa antiga'}).click();
 await page.waitForFunction(()=>document.querySelector('#session-select')?.value.endsWith('pi-1700000000000.jsonl'),undefined,{timeout:15000});
 /* Mesmo caminho do seletor: o estado da conversa antiga vira o atual e o
    rascunho do principal NÃO vaza para a nova conversa. */
 const deskAfterFlip=JSON.parse(fs.readFileSync(path.join(runtime,'desk.json'),'utf8'));
 const stateAfterFlip=deskAfterFlip.courseStates?.Test||deskAfterFlip;
 assert.equal(stateAfterFlip.session.endsWith('pi-1700000000000.jsonl'),true,'a conversa escolhida vira a sessão da matéria');
 assert.equal(await page.locator('#prompt').inputValue(),'','o rascunho do principal não vaza entre conversas');
 await page.waitForFunction(()=>document.querySelector('#sidechat-prompt')?.value===''||document.querySelector('#sidechat').hidden,undefined,{timeout:15000});
 assert.equal(await page.locator('#sidechat-prompt').inputValue(),'','o rascunho do chat lateral não vaza na troca de conversa');

 /* ---- 7. Referências: estado claro + detalhes ---- */
 await page.locator('#refs-state').click();
 await page.waitForFunction(()=>!document.querySelector('#refs-pop').hidden);
 const refsText=await page.locator('#refs-pop').innerText();
 assert.match(refsText,/câmera/i,'os detalhes explicam a câmera×referências');
 assert.match(refsText,/página 1/,'os detalhes listam caminho e página');
 await page.locator('#refs-pop .primary').click();
 assert.equal((await page.locator('#refs-state').textContent()).trim(),'PDF e página incluídos');
 await page.locator('#include-refs').click();
 assert.equal((await page.locator('#refs-state').textContent()).trim(),'Sem referências','desligar o toggle muda o estado visível');
 await page.locator('#include-refs').click();

 /* ---- 8. Recolher/reabrir a área de apoio + menu Formulário ---- */
 await page.locator('#support-collapse').click();
 await page.waitForFunction(()=>document.querySelector('#support-slot')?.hidden===true);
 assert.equal(await page.locator('#pdf-grid').evaluate(el=>el.classList.contains('single')),true,'recolher volta ao leitor único');
 assert.equal(await page.locator('#support-collapse').isVisible(),true,'o controle de reabrir continua visível');
 assert.match(await page.locator('#support-collapse').textContent(),/Chat lateral|Formulário/);
 await page.locator('#support-collapse').click();
 await page.waitForFunction(()=>document.querySelector('#support-slot')?.hidden===false);
 await page.locator('#support-tab-chat').click();
 await page.locator('#study-menu .nav-trigger').click();
 await page.locator('#reference-toggle').click();
 await page.waitForFunction(()=>document.querySelector('#support-tab-form')?.getAttribute('aria-selected')==='true');
 assert.equal(await page.locator('.pdf-panel').nth(1).isVisible(),true,'o menu form traz o Formulário de volta');
 await page.keyboard.press('Escape');

 /* ---- 9. Caderno no cabeçalho + recolher chat + tema + layout ---- */
 await page.locator('#review-tab').click();
 await page.waitForFunction(()=>document.querySelector('#references')?.classList.contains('review'));
 assert.equal((await page.locator('#review-count').textContent()).trim(),'0','a contagem do caderno aparece no cabeçalho');
 await page.locator('#course-tabs button[data-id="Test"]').click();
 await page.waitForFunction(()=>!document.querySelector('#references')?.classList.contains('review'));
 await page.locator('#chat-collapse').click();
 await page.waitForFunction(()=>document.body.classList.contains('chat-collapsed'));
 assert.equal(await page.locator('#chat-restore').isVisible(),true,'recolher o chat deixa o botão de voltar visível');
 await page.locator('#chat-restore').click();
 await page.waitForFunction(()=>!document.body.classList.contains('chat-collapsed'));
 const themeBefore=await page.evaluate(()=>document.documentElement.dataset.theme||'auto');
 await page.keyboard.press('ControlOrMeta+,');
 await page.waitForSelector('#settings-dialog[open]');
 await page.waitForFunction(()=>document.querySelectorAll('#cfg-layout input, #cfg-layout select').length>0,undefined,{timeout:10000});
 assert.equal(await page.locator('#theme-mode').inputValue(),themeBefore,'o select do tema reflete o estado');
 await page.locator('#theme-mode').selectOption('dark');
 await page.locator('#settings-dialog button[value="cancel"]').last().click();
 await page.waitForFunction(()=>!document.querySelector('#settings-dialog').open);
 assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme||'auto'),themeBefore,'Cancelar não aplica o tema');
 await page.keyboard.press('ControlOrMeta+,');
 await page.waitForSelector('#settings-dialog[open]');
 await page.locator('#theme-mode').selectOption('dark');
 await page.locator('#settings-save').click();
 await page.waitForFunction(()=>!document.querySelector('#settings-dialog').open);
 await page.waitForFunction(()=>document.documentElement.dataset.theme==='dark',undefined,{timeout:5000}).catch(()=>{});
 assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),'dark','Salvar aplica o tema');
 await page.waitForTimeout(800);
 assert.equal(JSON.parse(fs.readFileSync(path.join(runtime,'desk.json'),'utf8')).theme,'dark','o tema fica guardado no estado');
 const cfg=await page.evaluate(()=>window.desk.getConfig());
 assert.equal(cfg.config.desk.panels.length,2,'salvar o tema preserva os 2 painéis');
 assert.equal(cfg.config.desk.panels[1].label,'Formulário & apoio','salvar o tema preserva o nome do painel 2');

 assert.deepEqual(errors,[]);
 console.log('PASS: área de apoio, chat lateral (histórico/draft/LaTeX/stop), conversas, referências, caderno, tema e layout');
});

await withArtifacts('lateral-parar',async ctx=>{
 const runtime=ctx.runtime=newRuntime('lateral-parar'),course=seedCourse(runtime,'Test');
 fs.writeFileSync(path.join(course,'Limites.pdf'),tinyPdf('Exercise'));
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'Test',name:'Teste',path:course}],desk:{pinnedExtensions:false}});
 ctx.app=await launchDesk({runtime,env:{FAKE_PI_QUEUE_LOG:path.join(runtime,'queue.jsonl'),FAKE_PI_QUEUE_HOLD_MS:'4000'}});
 const page=await ctx.app.firstWindow();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await statusOnline(page);
 await page.waitForSelector('.pdf-panel canvas',{timeout:25000});
 await openSidechatTab(page);
 await page.locator('#sidechat-prompt').fill('primeiro turno');
 await page.locator('#sidechat-prompt').press('Enter');
 await page.waitForFunction(()=>document.querySelectorAll('#sidechat-messages .sidechat-msg.assistant .sidechat-body').length>0,undefined,{timeout:30000});
 await page.locator('#sidechat-prompt').fill('segundo turno segurando');
 await page.locator('#sidechat-prompt').press('Enter');
 await page.waitForFunction(()=>!document.querySelector('#sidechat-stop').hidden,undefined,{timeout:15000});
 await page.locator('#sidechat-stop').click();
 await page.waitForFunction(()=>document.querySelector('#sidechat-stop').hidden,undefined,{timeout:20000});
 assert.equal(await page.locator('#sidechat-send').isDisabled(),false,'depois de parar, o lateral volta a aceitar envio');
 assert.deepEqual(errors,[]);
 console.log('PASS: parar o turno do chat lateral não trava o canal');
});

await withArtifacts('lateral-pedido',async ctx=>{
 const runtime=ctx.runtime=newRuntime('lateral-pedido'),course=seedCourse(runtime,'Test');
 fs.writeFileSync(path.join(course,'Limites.pdf'),tinyPdf('Exercise'));
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'Test',name:'Teste',path:course}],desk:{pinnedExtensions:false}});
 ctx.app=await launchDesk({runtime});
 const page=await ctx.app.firstWindow();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await statusOnline(page);
 await page.waitForSelector('.pdf-panel canvas',{timeout:25000});
 await openSidechatTab(page);
 await page.locator('#sidechat-prompt').fill('quiz de teste no lateral');
 await page.locator('#sidechat-prompt').press('Enter');
 await page.waitForSelector('#sidechat-messages .sidechat-request .sidechat-option',{timeout:30000});
 assert.equal(await page.locator('#pi-dialog[open]').count(),0,'a pergunta do lateral não abre o diálogo do principal');
 await page.locator('#sidechat-messages .sidechat-request .sidechat-option').filter({hasText:'4'}).click();
 await page.waitForFunction(()=>[...document.querySelectorAll('#sidechat-messages .sidechat-msg.assistant .sidechat-body')].some(el=>el.textContent.includes('Boa!')),undefined,{timeout:30000});
 assert.equal(await page.locator('#sidechat-messages .sidechat-request').count(),0,'o cartão do pedido some depois da resposta');
 assert.deepEqual(errors,[]);
 console.log('PASS: pergunta do lateral respondida no canal lateral');
});

await withArtifacts('apoio-um-leitor',async ctx=>{
 const runtime=ctx.runtime=newRuntime('apoio-um-leitor'),course=seedCourse(runtime,'Test');
 fs.writeFileSync(path.join(course,'Lista.pdf'),tinyPdf('Only one reader'));
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'Test',name:'Teste',path:course}],desk:{panels:[{label:'Lista',prefer:['Lista']}],pinnedExtensions:false}});
 ctx.app=await launchDesk({runtime});
 const page=await ctx.app.firstWindow();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await statusOnline(page);
 await page.waitForSelector('.pdf-panel canvas',{timeout:25000});
 assert.equal(await page.locator('.pdf-panel').count(),1,'a matéria tem um leitor só');
 assert.equal(await page.locator('#support-bar').isVisible(),true,'o controle da área de apoio continua visível');
 assert.equal(await page.locator('#support-tab-form').isHidden(),true,'sem 2º leitor não há aba Formulário');
 assert.equal(await page.locator('#support-slot').isHidden(),true,'o layout padrão (um leitor) fica intacto');
 await openSidechatTab(page);
 assert.equal(await page.locator('#sidechat').isVisible(),true,'o chat lateral abre mesmo com um leitor só');
 assert.equal(await page.locator('.pdf-panel').isVisible(),true,'o leitor continua visível ao lado do lateral');
 assert.deepEqual(errors,[]);
 console.log('PASS: chat lateral acessível com um leitor, sem mudar o layout padrão');
});
