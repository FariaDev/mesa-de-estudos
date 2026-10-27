/* Visualização e atividade soltas na conversa (#42, parte B), medidas na janela.
   Uma visualização (Chart.js embutido, tokens da Mesa) e uma atividade, com o
   Pi sintético (sem modelo) publicando pela ponte real. Mede, nos dois temas,
   em 1440×900 e 900×650:
   - o quadro está solto: sem borda, cartão nem fundo próprio, e o fundo do
     documento é o da coluna do tutor;
   - a borda esquerda é a do texto da resposta;
   - a visualização não tem nada embaixo; a atividade tem a linha "Levar ao
     tutor"; as ferramentas do canto só aparecem no hover/foco;
   - a altura inicial já é a final (medida antes de publicar), sem pulo;
   - trocar o tema e o acento muda os tokens dentro do quadro;
   - com o quadro acima da dobra a coluna fica parada (nada do #messages
     escapa para o #chat e o modo de rolagem não pisca);
   - a tela cheia cobre a janela com o MESMO iframe e o Esc sai;
   - na tela cheia de conteúdo misto (gráfico + controles + texto), o conteúdo
     fica numa coluna de leitura centralizada, o gráfico mantém a proporção do
     quadro, texto e controles não escalam e a margem é o fundo da coluna.
   Capturas só com MESA_REVIEW_SHOTS. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {launchDesk,withArtifacts,DESK,screenshotDirectory,reviewShot,enterFree,setTheme,freezeMotion,resizeWindow} from './helpers.mjs';
import {layoutStable,nextFrames,pollUntil} from './waits.mjs';

const out=screenshotDirectory('activity-viz');
const size=(app,page,width,height)=>resizeWindow(app,page,width,height,{content:true});

await withArtifacts('activity-viz-ui',async ctx=>{
 ctx.runtime=fs.mkdtempSync(path.join(os.tmpdir(),'mesa-activity-viz-'));
 const pi=path.join(DESK,'tests/fixtures/mesa-interactive-pi.mjs');fs.chmodSync(pi,0o755);
 fs.writeFileSync(path.join(ctx.runtime,'config.json'),JSON.stringify({runtimePath:ctx.runtime,vaultPath:ctx.runtime,courses:[]}));
 ctx.app=await launchDesk({runtime:ctx.runtime,env:{LEARNING_DESK_PI:pi}});
 const page=await ctx.app.firstWindow(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await size(ctx.app,page,1440,900);
 await enterFree(page);
 await page.evaluate(async()=>{await (await import('./src/state.mjs')).connect();});
 await freezeMotion(page);
 /* Registra toda altura que o quadro já teve, desde que o iframe entrou. */
 await page.evaluate(()=>{
  window.__heights={};
  new MutationObserver(()=>{
   for(const host of document.querySelectorAll('.activity-frame')){
    const slot=host.closest('.activity-slot')?.dataset.activityCall;if(!slot||!host.querySelector('iframe'))continue;
    const list=window.__heights[slot]||(window.__heights[slot]=[]);const h=host.style.height;if(list.at(-1)!==h)list.push(h);
   }
  }).observe(document.querySelector('#messages'),{subtree:true,childList:true,attributes:true,attributeFilter:['style']});
 });
 const send=async text=>{await page.waitForFunction(()=>!document.querySelector('#send').disabled,undefined,{timeout:30000});await page.locator('#prompt').fill(text);await page.locator('#send').click();};
 await send('Mostre um grafico.');
 const viz=page.locator('.activity-slot[data-activity-call="integrated-call-1"]');
 await viz.locator('.activity-card[data-state="ready"]').waitFor({timeout:30000});
 await send('Crie uma atividade de movimento.');
 const act=page.locator('.activity-slot[data-activity-call="integrated-call-2"]');
 await act.locator('.activity-card[data-state="ready"]').waitFor({timeout:30000});
 await pollUntil(()=>page.frames().some(f=>f.url().startsWith('mesa-activity://artifact/')),Boolean,{timeout:10000,interval:50,what:'o iframe do artefato carregado',onTimeout:'return'});
 const frames=()=>page.frames().filter(f=>f.url().startsWith('mesa-activity://artifact/'));

 /* ---- altura inicial = final: o quadro nasceu com a altura medida ---- */
 const heights=await page.evaluate(()=>window.__heights);
 const item=await page.evaluate(async()=>{const {items}=await window.desk.activityList();return items.map(i=>({view:i.view||'',heights:i.heights||null,toolCallId:i.toolCallId}));});
 const vizItem=item.find(i=>i.toolCallId==='integrated-call-1');
 assert.equal(vizItem.view,'visualizacao','a publicação guarda o tipo');
 assert.ok(Array.isArray(vizItem.heights)&&vizItem.heights.length===9,`a prévia mediu as nove larguras antes de publicar (${JSON.stringify(vizItem.heights)})`);
 assert.equal(heights['integrated-call-1'].length,1,`a visualização nasceu com a altura final, sem pulo (${JSON.stringify(heights['integrated-call-1'])})`);

 const facts=slot=>page.evaluate(id=>{
  const s=document.querySelector(`.activity-slot[data-activity-call="${id}"]`),card=s.querySelector('.activity-card'),stage=card.querySelector('.activity-stage'),frame=card.querySelector('.activity-iframe');
  const cs=el=>getComputedStyle(el);
  const text=[...document.querySelectorAll('#messages .message.assistant .body')].map(b=>b.getBoundingClientRect().left);
  const vis=el=>!!el&&!el.hidden&&el.getClientRects().length>0&&cs(el).display!=='none';
  return {
   kind:card.dataset.kind,
   left:card.getBoundingClientRect().left,stageLeft:stage.getBoundingClientRect().left,textLeft:text,
   border:[card,stage,frame].map(el=>cs(el).borderTopWidth+'/'+cs(el).borderLeftWidth),
   background:[card,stage].map(el=>cs(el).backgroundColor),
   radius:cs(card).borderTopLeftRadius,shadow:cs(card).boxShadow,
   foot:vis(card.querySelector('.activity-foot')),draft:vis(card.querySelector('[data-act="draft"]')),
   tools:cs(card.querySelector('.activity-tools')).opacity,
   description:card.querySelector('.activity-alternative')?.textContent.length||0,descriptionBox:card.querySelector('.activity-alternative')?.getBoundingClientRect().width||0,
   head:!!card.querySelector('.activity-head,.activity-badge'),
   column:cs(document.querySelector('#sidebar')).backgroundColor,
   frameH:Math.round(card.querySelector('.activity-frame').getBoundingClientRect().height),
  };
 },slot);
 const docFacts=frame=>frame.evaluate(()=>{const v=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();return {bg:getComputedStyle(document.documentElement).backgroundColor,body:getComputedStyle(document.body).backgroundColor,mesaBg:v('--mesa-bg'),accent:v('--mesa-accent'),chart1:v('--mesa-chart-1'),mcp:v('--color-background-primary'),serif:v('--mesa-font-serif')};});

 for(const [w,h] of [[1440,900],[900,650]]){
  await size(ctx.app,page,w,h);
  await page.waitForFunction(([w])=>Math.abs(innerWidth-w)<=1,[w]);
  for(const theme of ['light','dark']){
   await setTheme(page,theme);
   await layoutStable(page,'.activity-stage');
   const tag=`${w}x${h} ${theme}`;
   for(const [slot,locator,kind] of [['integrated-call-1',viz,'visualizacao'],['integrated-call-2',act,'atividade']]){
    await locator.scrollIntoViewIfNeeded();
    await locator.locator('.activity-card[data-state="ready"] .activity-iframe').waitFor({timeout:15000});
    await page.mouse.move(2,2);
    await nextFrames(page);
    const f=await facts(slot);
    assert.equal(f.kind,kind,`${tag}: tipo ${kind}`);
    assert.ok(f.textLeft.some(x=>Math.abs(x-f.left)<=1),`${tag} ${kind}: alinhado ao texto da resposta (${f.left} × ${f.textLeft})`);
    assert.ok(f.border.every(b=>b==='0px/0px'),`${tag} ${kind}: sem borda (${f.border})`);
    assert.ok(f.background.every(b=>b==='rgba(0, 0, 0, 0)'),`${tag} ${kind}: sem fundo próprio (${f.background})`);
    assert.equal(f.shadow,'none',`${tag} ${kind}: sem sombra de cartão`);
    assert.equal(f.head,false,`${tag} ${kind}: sem cabeçalho nem selo`);
    assert.equal(f.tools,'0',`${tag} ${kind}: ferramentas escondidas fora do hover`);
    assert.ok(f.description>20&&f.descriptionBox<=1,`${tag} ${kind}: descrição textual no DOM, fora da vista`);
    if(kind==='visualizacao'){assert.equal(f.foot,false,`${tag}: visualização sem nada embaixo`);}
    else{assert.equal(f.foot,true,`${tag}: atividade com a linha de baixo`);assert.equal(f.draft,true,`${tag}: "Levar ao tutor" à mão`);}
    await locator.locator('.activity-stage').hover();
    await pollUntil(()=>facts(slot),f=>f.tools==='1',{timeout:3000,interval:50,what:'as ferramentas aparecerem no hover',onTimeout:'return'});
    assert.equal((await facts(slot)).tools,'1',`${tag} ${kind}: ferramentas aparecem no hover`);
    await reviewShot(locator,out,`${kind}-${w}x${h}-${theme}.png`);
   }
   /* Fundo e tokens do documento seguem a coluna e o tema. */
   const vf=await facts('integrated-call-1');
   for(const frame of frames()){
    const d=await docFacts(frame);
    assert.equal(d.bg,vf.column,`${tag}: o fundo do quadro é o da coluna do tutor (${d.bg} × ${vf.column})`);
    assert.equal(d.mesaBg,theme==='dark'?'#242424':'#f4f4f4');
    assert.equal(d.mcp,d.mesaBg,`${tag}: nome do MCP Apps espelhado`);
    assert.match(d.serif,/STIX Two Text/);
   }
   await reviewShot(page,out,`conversa-${w}x${h}-${theme}.png`);
  }
 }

 /* ---- acento ao vivo: muda os tokens dentro do quadro ---- */
 await size(ctx.app,page,1440,900);
 await setTheme(page,'dark');
 for(const [accent,fill,text] of [['green','#13865e','#5fd3a4'],['pink','#d8306b','#f783ac'],['blue','#506cdf','#8fa8ff']]){
  await page.evaluate(a=>{if(a==='blue')delete document.documentElement.dataset.accent;else document.documentElement.dataset.accent=a;},accent);
  for(const frame of frames()){
   await frame.waitForFunction(([fill])=>getComputedStyle(document.documentElement).getPropertyValue('--mesa-accent').trim()===fill,[fill],{timeout:5000});
   const d=await docFacts(frame);
   assert.equal(d.chart1,text,`acento ${accent}: a paleta começa no acento`);
  }
 }
 await setTheme(page,'light');
 for(const frame of frames())await frame.waitForFunction(()=>getComputedStyle(document.documentElement).getPropertyValue('--mesa-bg').trim()==='#f4f4f4',undefined,{timeout:5000});

 /* ---- coluna estável com o quadro acima da dobra ----
    O que fica dentro do #messages (a descrição `.activity-sr`, fora da vista)
    não escapa para o #chat: senão, com a atividade abaixo da dobra, o
    `body.chat-scroll` liga e desliga a cada quadro, a conversa salta entre duas
    posições e o clique no botão do canto cai no iframe. */
 await page.evaluate(()=>document.querySelector('.activity-slot[data-activity-call="integrated-call-1"] .activity-stage').scrollIntoView({block:'start'}));
 await layoutStable(page,'.activity-stage');
 const steady=await page.evaluate(()=>new Promise(done=>{
  const messages=document.querySelector('#messages'),stage=document.querySelector('.activity-slot[data-activity-call="integrated-call-1"] .activity-stage');
  const escaped=[...messages.querySelectorAll('*')].filter(el=>/absolute|fixed/.test(getComputedStyle(el).position)&&el.offsetParent&&!messages.contains(el.offsetParent)&&el.offsetParent!==messages).map(el=>el.className||el.tagName);
  const seen=new Set();let n=0;
  const tick=()=>{seen.add(`${document.body.classList.contains('chat-scroll')}/${Math.round(stage.getBoundingClientRect().top)}`);if(++n<20)requestAnimationFrame(tick);else done({escaped,seen:[...seen]});};
  requestAnimationFrame(tick);
 }));
 assert.deepEqual(steady.escaped,[],`nada dentro do #messages tem o #chat como contenção (${JSON.stringify(steady.escaped)})`);
 assert.equal(steady.seen.length,1,`a coluna fica parada com o quadro acima da dobra: modo de rolagem e posição do quadro não mudam a cada quadro (${JSON.stringify(steady.seen)})`);

 /* ---- tela cheia: o MESMO iframe cobre a janela; Esc sai ---- */
 for(const [w,h] of [[1440,900],[900,650]]){
  await size(ctx.app,page,w,h);
  await page.waitForFunction(([w])=>Math.abs(innerWidth-w)<=1,[w]);
  for(const theme of ['light','dark']){
   await setTheme(page,theme);
   await viz.scrollIntoViewIfNeeded();
   /* Fora da tela por mais de 4 s o quadro é pausado (e remonta ao voltar): espera pronto. */
   await viz.locator('.activity-card[data-state="ready"] .activity-iframe').waitFor({timeout:15000});
   /* A coluna parada não troca de modo de rolagem sozinha: absolutos de dentro
      do #messages que escapavam do recorte faziam `chat-scroll` ligar e
      desligar a cada frame, e o clique da tela cheia caía no meio da troca. */
   const flips=await page.evaluate(()=>new Promise(resolve=>{let n=0;const mo=new MutationObserver(()=>n++);mo.observe(document.body,{attributes:true,attributeFilter:['class']});setTimeout(()=>{mo.disconnect();resolve(n);},400);}));
   assert.equal(flips,0,`${w}x${h} ${theme}: a coluna não oscila entre os modos de rolagem`);
   await page.evaluate(()=>{window.__vizFrame=document.querySelector('.activity-slot[data-activity-call="integrated-call-1"] .activity-iframe');});
   await viz.locator('.activity-stage').hover();
   await viz.locator('[data-act="expand"]').click();
   await layoutStable(page,'.activity-stage');
   const full=await page.evaluate(()=>{const s=document.querySelector('.activity-slot[data-activity-call="integrated-call-1"] .activity-stage').getBoundingClientRect();return {l:s.left,t:s.top,r:s.right,b:s.bottom,w:innerWidth,h:innerHeight,same:window.__vizFrame===document.querySelector('.activity-slot[data-activity-call="integrated-call-1"] .activity-iframe'),label:document.querySelector('.activity-slot[data-activity-call="integrated-call-1"] [data-act="expand"]').getAttribute('aria-label')};});
   assert.ok(full.l<=0.5&&full.t<=0.5&&Math.abs(full.r-full.w)<=0.5&&Math.abs(full.b-full.h)<=0.5,`${w}x${h} ${theme}: tela cheia cobre a janela (${JSON.stringify(full)})`);
   assert.equal(full.same,true,'tela cheia não recarrega o quadro');
   assert.equal(full.label,'Sair da tela cheia');
   await reviewShot(page,out,`tela-cheia-${w}x${h}-${theme}.png`);
   await page.keyboard.press('Escape');
   await page.waitForFunction(()=>!document.querySelector('.activity-card.activity-fullscreen'));
  }
 }

 /* ---- tela cheia de conteúdo misto (gráfico + controles + texto) ----
    Coluna de leitura centralizada, gráfico com a proporção que tinha no
    quadro, texto e controles no tamanho de sempre, fundo da coluna; sai pelo
    botão e pelo Esc. A captura vem antes das asserções (serve de "antes"). */
 await size(ctx.app,page,1440,900);
 await send('Mostre a secante.');
 const mixed=page.locator('.activity-slot[data-activity-call="integrated-call-3"]');
 await mixed.locator('.activity-card[data-state="ready"]').waitFor({timeout:30000});
 const mixedId=(await page.evaluate(async()=>(await window.desk.activityList()).items.find(i=>i.toolCallId==='integrated-call-3').id));
 const mixedFrame=()=>page.frames().find(f=>f.url().includes(`/${mixedId}/`));
 const inside=()=>mixedFrame().evaluate(()=>{
  const r=el=>{const b=el.getBoundingClientRect();return {left:b.left,right:b.right,top:b.top,bottom:b.bottom,width:b.width,height:b.height};};
  const cs=el=>getComputedStyle(el);
  return {vw:innerWidth,vh:innerHeight,display:document.documentElement.dataset.display||'',root:r(document.getElementById('mesa-activity-root')),box:r(document.getElementById('box')),
   text:cs(document.getElementById('slope')).fontSize,label:cs(document.querySelector('label')).fontSize,range:r(document.getElementById('h')).height,bg:cs(document.documentElement).backgroundColor};
 });
 for(const [w,h] of [[1440,900],[900,650]]){
  await size(ctx.app,page,w,h);
  await page.waitForFunction(([w])=>Math.abs(innerWidth-w)<=1,[w]);
  for(const theme of ['light','dark']){
   const tag=`misto ${w}x${h} ${theme}`;
   await setTheme(page,theme);
   await mixed.scrollIntoViewIfNeeded();
   await mixed.locator('.activity-card[data-state="ready"] .activity-iframe').waitFor({timeout:15000});
   await layoutStable(page,'.activity-stage');
   const before=await pollUntil(inside,f=>f.box.width>0,{timeout:5000,interval:50,what:'o gráfico no quadro'});
   await mixed.locator('.activity-stage').hover();
   await mixed.locator('[data-act="expand"]').click();
   await layoutStable(page,'.activity-stage');
   const full=await pollUntil(inside,f=>f.display==='fullscreen'&&f.vw>before.vw,{timeout:5000,interval:50,what:'o quadro em tela cheia'});
   await nextFrames(page);
   const after=await inside();
   const stage=await page.evaluate(()=>({bg:getComputedStyle(document.querySelector('.activity-slot[data-activity-call="integrated-call-3"] .activity-stage')).backgroundColor,column:getComputedStyle(document.querySelector('#sidebar')).backgroundColor}));
   await reviewShot(page,out,`misto-tela-cheia-${w}x${h}-${theme}.png`);
   const ratio=b=>b.width/b.height;
   assert.ok(after.root.width<=760.5,`${tag}: largura de leitura (${after.root.width})`);
   assert.ok(Math.abs(after.root.left-(after.vw-after.root.right))<=1,`${tag}: centralizado (${JSON.stringify(after.root)} em ${after.vw})`);
   assert.ok(Math.abs(ratio(after.box)/ratio(before.box)-1)<=0.03,`${tag}: gráfico com a proporção do quadro (${ratio(before.box).toFixed(3)} → ${ratio(after.box).toFixed(3)})`);
   assert.ok(after.box.bottom<=after.vh,`${tag}: gráfico inteiro na tela (${after.box.bottom} > ${after.vh})`);
   assert.deepEqual([after.text,after.label,after.range],[before.text,before.label,before.range],`${tag}: texto e controles no tamanho normal`);
   assert.equal(after.bg,stage.column,`${tag}: fundo do quadro é o da coluna`);
   assert.equal(stage.bg,stage.column,`${tag}: margem da tela cheia no fundo da coluna`);
   assert.ok(full.root.top>=0,`${tag}: nada cortado em cima (${full.root.top})`);
   /* Sai pelo botão no tema claro e pelo Esc no escuro. */
   if(theme==='light')await mixed.locator('[data-act="expand"]').click();
   else await page.keyboard.press('Escape');
   await page.waitForFunction(()=>!document.querySelector('.activity-card.activity-fullscreen'));
   const back=await pollUntil(inside,f=>f.display==='inline',{timeout:5000,interval:50,what:'o quadro voltar ao inline'});
   assert.ok(Math.abs(back.box.height-240)<=1,`${tag}: de volta, o gráfico tem a altura do autor (${back.box.height})`);
  }
 }
 assert.deepEqual(errors,[]);
});
console.log('activity-viz-ui: PASS — visualização e atividade soltas na conversa, alinhadas ao texto, sem borda nem fundo, altura sem pulo, coluna parada com o quadro acima da dobra, tokens ao vivo e tela cheia, nos dois temas e tamanhos.');
