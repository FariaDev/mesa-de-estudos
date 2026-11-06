import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {withArtifacts,launchDesk,newRuntime,seedCourse,writeConfigJson,writeDeskJson,tinyPdf,freezeMotion,resizeWindow} from './helpers.mjs';
import {layoutStable,pollUntil} from './waits.mjs';

/* Leitura do chat (#106): tamanho do texto e largura da coluna em degraus
   nomeados, na janela real. Prova que o padrão resolve nos MESMOS valores
   computados de antes (15px, código 13, tabela 12, títulos 17/16/15, coluna
   720px), que cada degrau muda o computado, que vale no tutor e no chat
   lateral, que a largura só age quando a coluna é maior, que persiste ao
   reabrir e que não há rolagem horizontal na janela pequena. Capturas
   sintéticas em /tmp/mesa-106-*.png. */

const WIDE=[1440,900],MINIMUM=[900,650];
const SHOT=name=>`/tmp/mesa-106-${name}.png`;

async function boot(runtime,errors=[]){
 const app=await launchDesk({runtime,pi:false});
 const page=await app.firstWindow();
 page.on('pageerror',error=>errors.push(error.message));
 await page.waitForSelector('.pdf-panel canvas',{timeout:30000});
 await freezeMotion(page);
 return {app,page,errors};
}

async function setSize(app,page,[width,height]){
 await resizeWindow(app,page,width,height);
 await layoutStable(page,'main');
}

async function openAppearance(page){
 await page.keyboard.press('ControlOrMeta+,');
 await page.waitForSelector('#settings-dialog[open]');
 await page.locator('#settings-tab-avisos').click();
 await page.locator('#reading-size').scrollIntoViewIfNeeded();
}

async function injectFixture(page){
 await page.evaluate(()=>{
  if(document.querySelector('#reading-fixture'))return;
  const article=document.createElement('article');
  article.className='message assistant';
  article.id='reading-fixture';
  article.innerHTML='<div class="role">Tutor</div><div class="body">'
   +'<h1>Título de leitura</h1><h2>Subtítulo</h2><h3>Seção</h3>'
   +'<p>Um parágrafo com <strong>texto de estudo</strong> e uma palavra bem comprida: '
   +'hipopotomonstrosesquipedaliofobiaparalelepipedo. O resto quebra normalmente na coluna.</p>'
   +'<pre><code>const resposta = 42; // código acompanha</code></pre>'
   +'<table><tbody><tr><th>a</th><th>b</th></tr><tr><td>1</td><td>2</td></tr></tbody></table>'
   +'<p><span class="katex"><span class="katex-html">x² + y²</span></span></p>'
   +'</div>';
  document.querySelector('#messages').append(article);
 });
}

const measure=page=>page.evaluate(()=>{
 const root=document.documentElement,message=document.querySelector('#reading-fixture');
 const style=(el,prop)=>getComputedStyle(el)[prop];
 const num=(el,prop)=>Number.parseFloat(style(el,prop));
 return {
  dataset:{...root.dataset},
  column:Number.parseFloat(getComputedStyle(root).getPropertyValue('--reading-column')),
  messageFont:num(message,'fontSize'),
  bodyFont:num(message.querySelector('.body'),'fontSize'),
  lineHeight:num(message,'lineHeight'),
  codeFont:num(message.querySelector('pre code'),'fontSize'),
  tableFont:num(message.querySelector('table'),'fontSize'),
  h1Font:num(message.querySelector('h1'),'fontSize'),
  h2Font:num(message.querySelector('h2'),'fontSize'),
  h3Font:num(message.querySelector('h3'),'fontSize'),
  messageWidth:message.getBoundingClientRect().width,
  composerWidth:document.querySelector('#composer').getBoundingClientRect().width,
  pageOverflow:root.scrollWidth-root.clientWidth,
  messagesOverflow:document.querySelector('#messages').scrollWidth-document.querySelector('#messages').clientWidth
 };
});

const sidechatMeasure=page=>page.evaluate(()=>{
 const msgs=document.querySelector('#sidechat-messages');
 let fixture=document.querySelector('#sidechat-reading-fixture');
 if(!fixture){
  fixture=document.createElement('article');
  fixture.className='message assistant';
  fixture.id='sidechat-reading-fixture';
  fixture.innerHTML='<div class="body"><p>Leitura do chat lateral.</p></div>';
  msgs.append(fixture);
 }
 return {hidden:document.querySelector('#sidechat').hidden,font:Number.parseFloat(getComputedStyle(fixture).fontSize),width:fixture.getBoundingClientRect().width};
});

async function pick(page,select,value){
 await page.locator(select).selectOption(value);
 await page.waitForFunction(([selector,want])=>document.querySelector(selector).value===want,[select,value],{timeout:5000});
}

const savedPrefs=runtime=>{try{return JSON.parse(fs.readFileSync(path.join(runtime,'desk.json'),'utf8'));}catch{return null;}};
const waitSaved=(runtime,predicate,label)=>pollUntil(()=>savedPrefs(runtime),predicate,{timeout:8000,interval:100,what:label});

await withArtifacts('chat-reading-ui',async ctx=>{
 const runtime=ctx.runtime=newRuntime('chat-reading');
 const course=seedCourse(runtime,'Test');
 const pdf=path.join(course,'Leitura.pdf');
 fs.writeFileSync(pdf,tinyPdf('texto sintetico de leitura'));
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'Test',name:'Cálculo I',path:course}],desk:{panels:[{label:'Lista',prefer:['Leitura']}],pinnedExtensions:false}});
 writeDeskJson(runtime,{courseId:'Test'});
 const errors=[];
 let {app,page}=await boot(runtime,errors);
 ctx.app=app;
 await setSize(app,page,WIDE);
 await injectFixture(page);

 /* ---------- 1. O padrão é exatamente o de hoje ---------- */
 const defaults=await measure(page);
 assert.deepEqual(defaults.dataset,{},'quem nunca escolheu não ganha atributo de leitura');
 assert.equal(defaults.column,720,'a coluna de leitura padrão segue 720px');
 assert.equal(defaults.messageFont,15,'o texto do chat padrão segue 15px');
 assert.equal(defaults.bodyFont,15);
 assert.equal(defaults.lineHeight,24,'a linha padrão segue 24px (15 × 1.6)');
 assert.equal(defaults.codeFont,13,'o código padrão segue 13px');
 assert.equal(defaults.tableFont,12,'a tabela padrão segue 12px');
 assert.equal(defaults.h1Font,17,'o h1 padrão segue 17px');
 assert.equal(defaults.h2Font,16,'o h2 padrão segue 16px');
 assert.equal(defaults.h3Font,15,'o h3 padrão segue 15px');
 assert.equal(defaults.composerWidth,await page.locator('#composer').evaluate(el=>el.getBoundingClientRect().width),'o composer está na largura da coluna');
 const narrow=await page.locator('#messages').evaluate(el=>el.clientWidth-Number.parseFloat(getComputedStyle(el).paddingLeft)-Number.parseFloat(getComputedStyle(el).paddingRight));
 assert.ok(defaults.messageWidth<=narrow+1,`a mensagem cabe na coluna do tutor (${defaults.messageWidth} de ${narrow}px)`);
 await page.screenshot({path:SHOT('padrao')});

 /* ---------- 2. Cada degrau muda o computado ---------- */
 await openAppearance(page);
 const seen=new Set();
 for(const [value,font,code,table,h1,h2,h3] of [
  ['small',14,12,11,16,15,14],
  ['normal',15,13,12,17,16,15],
  ['large',16,14,13,18,17,16],
  ['larger',17,15,14,19,18,17]
 ]){
  await pick(page,'#reading-size',value);
  const fact=await measure(page);
  assert.equal(fact.messageFont,font,`${value}: texto`);
  assert.equal(fact.codeFont,code,`${value}: código`);
  assert.equal(fact.tableFont,table,`${value}: tabela`);
  assert.equal(fact.h1Font,h1,`${value}: h1`);
  assert.equal(fact.h2Font,h2,`${value}: h2`);
  assert.equal(fact.h3Font,h3,`${value}: h3`);
  assert.equal(seen.has(fact.messageFont),false,`${value}: degrau novo`);
  seen.add(fact.messageFont);
 }
 assert.equal(seen.size,4,'os quatro degraus têm valores diferentes');

 /* ---------- 3. Largura: só age quando a coluna é maior que ela ---------- */
 await pick(page,'#reading-width','normal');
 const beforeWidth=await measure(page);
 assert.equal(beforeWidth.column,720);
 assert.equal(await page.locator('#messages').evaluate(el=>el.scrollWidth-el.clientWidth),0,'a coluna padrão não rola na horizontal');
 await pick(page,'#reading-width','narrow');
 const narrowWidth=await measure(page);
 assert.equal(narrowWidth.column,560,'Estreita resolve em 560px');
 assert.ok(narrowWidth.messageWidth<560+1,`a mensagem respeita a coluna estreita (${narrowWidth.messageWidth})`);
 await pick(page,'#reading-width','wide');
 const wideWidth=await measure(page);
 assert.equal(wideWidth.column,880,'Larga resolve em 880px');
 /* Na janela de 1440px a coluna do tutor (390) é menor que 880: nada muda nela. */
 assert.ok(Math.abs(wideWidth.messageWidth-defaults.messageWidth)<=1,`coluna menor que a largura escolhida não muda (${wideWidth.messageWidth} × ${defaults.messageWidth})`);
 /* O botão da tela inteira usa a MESMA coluna (#98) e continua funcionando. */
 await page.keyboard.press('Escape');
 await page.waitForFunction(()=>!document.querySelector('#settings-dialog').open);
 await page.locator('#chat-full').click();
 await page.waitForFunction(()=>document.body.classList.contains('chat-full'));
 await layoutStable(page,'#chat');
 const full=await page.evaluate(()=>{
  const chat=document.querySelector('#chat').getBoundingClientRect();
  const msg=document.querySelector('#reading-fixture').getBoundingClientRect();
  return {chatWidth:chat.width,messageWidth:msg.width,column:Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--reading-column'))};
 });
 assert.equal(full.column,880);
 assert.ok(Math.abs(full.chatWidth-904)<=1,`a tela inteira acompanha a coluna larga (${full.chatWidth})`);
 assert.ok(Math.abs(full.messageWidth-880)<=1,`o texto ocupa a coluna larga (${full.messageWidth})`);
 await page.screenshot({path:SHOT('larga-tela-inteira')});
 await page.locator('#chat-full').click();
 await page.waitForFunction(()=>!document.body.classList.contains('chat-full'));

 /* ---------- 4. Vale no chat lateral ---------- */
 await page.locator('#sidechat-toggle').click();
 await page.waitForFunction(()=>{const el=document.querySelector('#sidechat');return el&&!el.hidden&&el.getBoundingClientRect().width>0;},undefined,{timeout:15000});
 const lateral=await sidechatMeasure(page);
 assert.equal(lateral.hidden,false,'o chat lateral está aberto');
 assert.equal(lateral.font,17,'o texto do lateral segue o degrau Maior');
 await page.screenshot({path:SHOT('lateral-maior')});

 /* ---------- 5. Persiste ao reabrir e não vaza para o config.json ---------- */
 await waitSaved(runtime,state=>state?.readingSize==='larger'&&state?.readingWidth==='wide','as preferências de leitura no desk.json');
 const config=fs.readFileSync(path.join(runtime,'config.json'),'utf8');
 assert.doesNotMatch(config,/readingSize|readingWidth|pdfDark/,'leitura não vai para o config.json');
 await app.close();
 ({app,page}=await boot(runtime,errors));
 ctx.app=app;
 await setSize(app,page,WIDE);
 await injectFixture(page);
 const reopened=await measure(page);
 assert.equal(reopened.dataset.readingSize,'larger','o tamanho volta ao reabrir');
 assert.equal(reopened.dataset.readingWidth,'wide','a largura volta ao reabrir');
 assert.equal(reopened.messageFont,17);
 assert.equal(reopened.column,880);
 await openAppearance(page);
 assert.equal(await page.locator('#reading-size').inputValue(),'larger','o seletor mostra o tamanho salvo');
 assert.equal(await page.locator('#reading-width').inputValue(),'wide','o seletor mostra a largura salva');
 await page.keyboard.press('Escape');
 await page.waitForFunction(()=>!document.querySelector('#settings-dialog').open);

 /* ---------- 6. Janela pequena: Maior + Larga sem rolagem horizontal ---------- */
 await setSize(app,page,MINIMUM);
 const small=await measure(page);
 assert.equal(small.pageOverflow,0,`a janela pequena não rola na horizontal (${small.pageOverflow}px)`);
 assert.equal(small.messagesOverflow,0,`a conversa não rola na horizontal (${small.messagesOverflow}px)`);
 await page.screenshot({path:SHOT('janela-pequena')});

 assert.deepEqual(errors,[]);
 console.log('PASS: leitura do chat — padrão 15px/720px provado, quatro tamanhos e três larguras computados, tutor e lateral, persistência, sem rolagem horizontal em 900×650.');
});
