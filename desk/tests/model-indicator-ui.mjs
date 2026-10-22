// node tests/model-indicator-ui.mjs — indicador de modelo e esforço (tickets #14
// e #42), testado na janela. O indicador mora na fileira da caixa de mensagem,
// à esquerda do Enviar, com o ponto de conexão; clicar abre, para cima, o
// popover onde se trocam modelo e esforço. Em caixa estreita a fileira cede em
// degraus: Referências vira ícone, o esforço sai, o modelo vira ícone. Cobre
// cada critério de aceitação e grava capturas (claro/escuro, 1440×900 e 900×650).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import boxCore from '../src/generated/composerbox.core.js';
import headCore from '../src/generated/tutorheader.core.js';
import {
 withArtifacts,newRuntime,seedCourse,writeConfigJson,writeDeskJson,launchDesk,statusOnline,tinyPdf,PLOT_PNG,
 reviewShot,screenshotDirectory,setTheme,freezeMotion,toastWait,sendEnabled,openTutorMore,openModelPop,closeModelPop,pickModel,pickEffort,modelRows,modelPickerLocked,indicatorText,
 openSessionList,closeSessionList,resizeWindow
} from './helpers.mjs';
import {layoutStable} from './waits.mjs';

const out=screenshotDirectory('model-indicator');
const size=(app,page,width,height)=>resizeWindow(app,page,width,height);
const rect=(page,selector)=>page.evaluate(sel=>{const el=document.querySelector(sel);if(!el)return null;const b=el.getBoundingClientRect();return {top:b.top,bottom:b.bottom,left:b.left,right:b.right,width:b.width,height:b.height};},selector);
const inside=(box,width,height,note)=>{
 assert.ok(box,`${note}: medido`);
 assert.ok(box.left>=-0.5&&box.top>=-0.5&&box.right<=width+0.5&&box.bottom<=height+0.5,`${note}: dentro da janela ${width}×${height} (${JSON.stringify(box)})`);
};
const seedJsonl=(file,text)=>fs.writeFileSync(file,JSON.stringify({type:'message',message:{role:'user',content:[{type:'text',text}]}})+'\n');
const listOf=l=>{const out=[];for(let c=l;c&&c.$==='Con';c=c.tail)out.push(String(c.head));return out;};
const LADDER=['','compact','model','icon'];
const LONG_TITLE='Uma sessão com um título bem comprido sobre limites fundamentais, continuidade e a regra de L’Hôpital em detalhe';

/* ---------- tutor ligado: indicador, popover, troca e saídas ---------- */
await withArtifacts('model-indicator',async ctx=>{
 const runtime=ctx.runtime=newRuntime('modelind');
 const course=seedCourse(runtime,'calc');
 const pdf=path.join(course,'Limites.pdf');fs.writeFileSync(pdf,tinyPdf('Limites e derivadas'));
 const session=path.join(runtime,`pi-${Date.now()-86400000}.jsonl`);
 seedJsonl(session,LONG_TITLE);
 writeConfigJson(runtime,{runtimePath:runtime,vaultPath:runtime,courses:[{id:'calc',name:'Cálculo',path:course}]});
 writeDeskJson(runtime,{courseId:'calc',session,courseStates:{calc:{session,sessions:[{path:session,started:Date.now()-86400000}],pdfs:[{path:pdf,page:1}],study:{title:'Limites',xopp:''}}}});
 const app=ctx.app=await launchDesk({runtime,env:{FAKE_PI_SECOND_MODEL:'1',FAKE_PI_REASONING:'1'}});
 const page=await app.firstWindow();
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await size(app,page,1440,900);
 await statusOnline(page);
 await freezeMotion(page);

 /* ---- o indicador diz modelo, esforço e estado; um só ponto no cabeçalho ---- */
 const indicator=page.locator('#model-indicator');
 assert.equal(await indicator.count(),1);
 assert.equal(await indicator.evaluate(el=>!!el.closest('.chat-head')),false,'o indicador saiu do cabeçalho do tutor');
 assert.equal(await indicator.evaluate(el=>el.parentElement?.matches('#composer-box .composer-actions')),true,'o indicador mora na fileira da caixa de mensagem');
 const row=await page.locator('#composer-box .composer-actions > *').evaluateAll(list=>list.map(el=>({id:el.id,follows:el.dataset.follows||''})));
 assert.deepEqual(row.filter(el=>!el.follows).map(el=>el.id),listOf(boxCore.actionIds()),'a fileira segue a ordem do núcleo: o indicador logo antes de Parar/Enviar');
 /* Botão fora do núcleo (`data-follows`) fica logo depois do que segue: Foto do celular depois do Anexar (#36). */
 for(const [i,el] of row.entries())if(el.follows)assert.equal(row[i-1]?.id,el.follows,`#${el.id} logo depois de #${el.follows}`);
 assert.deepEqual(await page.locator('.chat-head > *, .chat-head-actions > *').evaluateAll(list=>list.filter(el=>el.id).map(el=>el.id)),listOf(headCore.headIds()),'o cabeçalho fica com título, chat lateral, sessão nova e Mais opções');
 assert.equal(await indicatorText(page),'Pi de teste · desligado','mostra o modelo e o esforço em uso (esforço em palavra curta)');
 assert.equal(await indicator.getAttribute('data-state'),'on','o estado de conexão está no indicador');
 assert.equal(await page.locator('#status-dot').count(),1,'um só ponto de estado');
 assert.equal(await page.locator('#model-indicator #status-dot.online').count(),1,'o ponto mora dentro do indicador e diz ligado');
 assert.match(await indicator.getAttribute('aria-label'),/^Tutor ligado: Pi de teste · desligado\./,'o nome acessível diz o estado e a escolha');
 /* Ligado, o logo do modelo fica no lugar do ponto, e o botão não tem borda
    (2026-10-21: a pílula com borda destoava dos outros botões da fileira). O
    provedor `test` do fake não tem logo: vale o monograma. */
 const look=await page.evaluate(()=>{const b=document.querySelector('#model-indicator'),logo=b.querySelector('.mi-logo'),t=b.querySelector('.mi-text'),cs=getComputedStyle(b);return {border:cs.borderTopWidth,borderColor:cs.borderTopColor,logo:!!b.hasAttribute('data-logo')&&logo.getBoundingClientRect().width>0,logoRight:logo.getBoundingClientRect().right,textLeft:t.getBoundingClientRect().left,dot:document.querySelector('#status-dot').getBoundingClientRect().width,mono:logo.textContent.trim()};});
 assert.ok(look.border==='0px'||look.borderColor==='rgba(0, 0, 0, 0)',`o indicador não tem borda (${look.border} ${look.borderColor})`);
 assert.equal(look.logo,true,'ligado, o logo do modelo aparece no indicador');
 assert.equal(look.mono,'T','o provedor sem logo mostra o monograma');
 assert.equal(look.dot,0,'ligado e com logo, o ponto verde sai');
 assert.ok(look.logoRight<=look.textLeft+0.5,'o logo vem antes do texto');
 /* Regressão (ajustes pós-41): com Foto do celular na fileira, 1440×900 na coluna padrão
    ainda mostra o nome do modelo; o Conferir cede antes, virando só ícone. */
 const padrao=await page.evaluate(()=>{const r=document.querySelector('#composer-box .composer-actions'),t=document.querySelector('#model-indicator .mi-text'),c=document.querySelector('#check');return {fit:r.dataset.fit||'',textDisplay:getComputedStyle(t).display,text:t.textContent.trim(),checkAria:c.getAttribute('aria-label'),checkLabelShown:[...c.querySelectorAll('.label-full,.label-short')].some(el=>getComputedStyle(el).display!=='none')};});
 assert.notEqual(padrao.textDisplay,'none','em 1440×900 o nome do modelo (.mi-text) aparece');
 assert.match(padrao.text,/^Pi de teste/,'em 1440×900 o .mi-text diz o modelo');
 assert.match(padrao.checkAria,/Conferir/,'o Conferir mantém o nome acessível completo');
 if(padrao.fit!=='')assert.equal(padrao.checkLabelShown,false,'nos degraus apertados o Conferir é só ícone');

 /* ---- a faixa fixa e o rodapé não existem mais ---- */
 for(const gone of ['#pi-settings-panel','#pi-settings-body','#settings-toggle','.side-foot','#foot-status','#compact-tools','#compact-now']){
  assert.equal(await page.locator(gone).count(),0,`${gone} saiu da coluna`);
 }
 assert.equal(await page.locator('#model-pop').isHidden(),true,'o popover nasce fechado');

 /* ---- o título da sessão continua clicável e a lista abre ---- */
 const title=await rect(page,'#session-title');
 assert.ok(title.width>=60,`o título da sessão ainda tem largura (${title.width})`);
 await openSessionList(page);
 assert.equal(await page.locator('#conversations-pop').isVisible(),true,'o título abre a lista de sessões');
 await closeSessionList(page);

 /* ---- popover: abre pelo indicador, mostra os campos, não empurra a coluna ---- */
 const messagesBefore=await rect(page,'#messages');
 await openModelPop(page);
 assert.equal(await indicator.getAttribute('aria-expanded'),'true');
 assert.equal(await page.locator('#model-pop #model-search').isVisible(),true,'o campo Modelo (busca) está no popover');
 assert.equal(await page.locator('#model-pop #model-list').isVisible(),true,'a lista de modelos está no popover');
 assert.equal(await page.locator('#model-pop #effort-strip').isVisible(),true,'a faixa de esforço está no rodapé do popover');
 assert.equal(await page.locator('#effort-strip').getAttribute('role'),'radiogroup');
 assert.equal(await page.locator('#model-pop select').count(),0,'nenhum <select> nativo no popover');
 assert.equal(await page.locator('#model-pop-note').isHidden(),true,'ligado e escolhável: sem aviso');
 assert.equal(await modelPickerLocked(page),false);
 assert.deepEqual((await modelRows(page)).map(row=>row.name),['Pi com visão','Pi de teste'],'a lista traz o catálogo, por nome');
 assert.deepEqual(await page.locator('#model-list .model-group-title').allTextContents(),['test'],'o provedor sem nome conhecido aparece cru, como título do grupo');
 const messagesOpen=await rect(page,'#messages');
 assert.deepEqual(messagesOpen,messagesBefore,'o popover flutua: as mensagens não se mexem');
 inside(await rect(page,'#model-pop'),1440,900,'popover 1440×900');
 await reviewShot(page,out,'claro-1440x900-popover.png');

 /* ---- trocar esforço reflete no indicador ---- */
 await pickEffort(page,'high');
 await page.waitForFunction(()=>document.querySelector('#model-indicator .mi-text').textContent.trim()==='Pi de teste · alto',undefined,{timeout:15000});
 assert.equal(await page.locator('#model-pop').isVisible(),true,'trocar o esforço não fecha o popover');
 /* ---- trocar modelo reflete no indicador (o esforço fica) ---- */
 await pickModel(page,'test','offline-vision');
 await page.waitForFunction(()=>document.querySelector('#model-indicator .mi-text').textContent.trim()==='Pi com visão · alto',undefined,{timeout:15000});
 assert.match(await indicator.getAttribute('aria-label'),/Pi com visão · alto/);

 /* ---- Esc fecha só o popover e devolve o foco ao indicador ---- */
 await page.keyboard.press('Escape');
 await page.locator('#model-pop').waitFor({state:'hidden'});
 assert.equal(await indicator.getAttribute('aria-expanded'),'false');
 assert.equal(await page.evaluate(()=>document.activeElement?.id),'model-indicator','o foco volta ao indicador');
 /* clique fora fecha; clicar no indicador alterna */
 await openModelPop(page);
 /* o popover abre para cima, sobre o campo (#42): clicar fora é clicar nas mensagens */
 await page.locator('#messages').click({position:{x:20,y:20}});
 await page.locator('#model-pop').waitFor({state:'hidden'});
 await openModelPop(page);
 await indicator.click();
 await page.locator('#model-pop').waitFor({state:'hidden'});
 /* um menu por vez: abrir Mais opções fecha o popover do modelo */
 await openModelPop(page);
 await page.locator('#chat-more').click();
 await page.locator('#chat-more-pop').waitFor({state:'visible'});
 assert.equal(await page.locator('#model-pop').isHidden(),true,'um popover por vez');
 await page.keyboard.press('Escape');

 /* ---- "Contexto da sessão" mora em Mais opções (sem espaço fixo) ---- */
 await openTutorMore(page);
 const ids=await page.locator('#chat-more-pop > *').evaluateAll(list=>list.map(el=>el.id));
 assert.deepEqual(ids,['export-chat','end-day','more-context','more-auto-compact','more-compact-now','more-triage','chat-collapse']);
 assert.equal(await page.locator('#more-compact-now').isEnabled(),true,'Resumir agora disponível com o tutor ligado');
 await page.locator('#more-compact-now').click();
 await toastWait(page,'Contexto compactado',{timeout:15000});
 assert.equal(await page.locator('#chat-more-pop').isHidden(),true,'escolher a ação fecha o menu');

 /* ---- capturas e medidas nos dois temas e tamanhos ---- */
 for(const text of ['primeira pergunta','segunda pergunta','terceira pergunta']){
  await page.locator('#prompt').fill(text);
  await sendEnabled(page);
  await page.locator('#send').click();
  await sendEnabled(page,{timeout:30000});
 }
 const bar=Number.parseFloat(await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--bar')));
 for(const [theme,width,height] of [['light',1440,900],['dark',1440,900],['light',900,650],['dark',900,650]]){
  await setTheme(page,theme);
  await size(app,page,width,height);
  await layoutStable(page,'#messages');
  const tag=`${theme==='light'?'claro':'escuro'}-${width}x${height}`;
  const viewport=await page.evaluate(()=>({w:innerWidth,h:innerHeight,sw:document.documentElement.scrollWidth}));
  assert.ok(viewport.sw<=viewport.w+1,`${tag}: sem rolagem horizontal`);
  /* o cabeçalho é uma linha, com o título longo cortado e tudo dentro */
  const headBox=await rect(page,'.chat-head'),chatBox=await rect(page,'#chat');
  assert.ok(headBox.height<=bar+2,`${tag}: o cabeçalho continua uma linha (${headBox.height})`);
  assert.ok(headBox.top>=chatBox.top-0.5&&headBox.top<=chatBox.top+1,`${tag}: cabeçalho no topo da coluna`);
  const headIds=listOf(headCore.headIds()).map(id=>`#${id}`);
  for(const id of headIds)inside(await rect(page,id),viewport.w,viewport.h,`${tag} ${id}`);
  const parts=await page.evaluate(ids=>ids.map(sel=>{const b=document.querySelector(sel).getBoundingClientRect();return {sel,left:b.left,right:b.right,top:b.top,bottom:b.bottom};}),headIds);
  for(let i=1;i<parts.length;i++)assert.ok(parts[i].left>=parts[i-1].right-0.5,`${tag}: ${parts[i].sel} não invade ${parts[i-1].sel}`);
  for(const part of parts)assert.ok(part.top>=headBox.top-0.5&&part.bottom<=headBox.bottom+0.5,`${tag}: ${part.sel} na linha do cabeçalho`);
  assert.equal(await page.evaluate(()=>{const el=document.querySelector('.chat-head');return el.scrollWidth-el.clientWidth<=1;}),true,`${tag}: nada vaza do cabeçalho`);
  const titleBox=await rect(page,'#session-title');
  assert.ok(titleBox.width>=96,`${tag}: sem o indicador, o título ganha a linha (${titleBox.width}px)`);
  /* #42: o indicador na fileira — antes do Enviar, na mesma linha, nada vaza,
     o ponto à vista e o nome do modelo inteiro (ou só o ícone, no último degrau). */
  const row=await page.evaluate(()=>{
   const r=document.querySelector('#composer-box .composer-actions'),b=document.querySelector('#model-indicator'),send=document.querySelector('#send');
   const model=b.querySelector('.mi-model'),dot=b.querySelector(b.hasAttribute('data-logo')?'.mi-logo':'#status-dot').getBoundingClientRect(),ib=b.getBoundingClientRect(),sb=send.getBoundingClientRect();
   return {fit:r.dataset.fit||'',overflow:r.scrollWidth-r.clientWidth,cut:model.offsetWidth>0&&model.scrollWidth>model.clientWidth+0.5,shown:getComputedStyle(b.querySelector('.mi-text')).display==='none'?'':model.textContent.trim(),dot:dot.width>0&&dot.height>0,before:ib.right<=sb.left+0.5,sameLine:Math.abs((ib.top+ib.bottom)/2-(sb.top+sb.bottom)/2)<=1,height:ib.height,label:b.getAttribute('aria-label')};
  });
  assert.ok(LADDER.includes(row.fit),`${tag}: degrau conhecido (${row.fit})`);
  assert.ok(row.overflow<=1,`${tag}: nada vaza da fileira (${row.overflow}px, degrau "${row.fit}")`);
  assert.equal(row.before,true,`${tag}: o indicador fica à esquerda do Enviar`);
  assert.equal(row.sameLine,true,`${tag}: indicador e Enviar na mesma linha`);
  assert.equal(row.dot,true,`${tag}: o logo (ou o ponto) continua à vista`);
  assert.equal(row.cut,false,`${tag}: o nome do modelo nunca sai cortado (${row.shown})`);
  assert.match(row.label,/^Tutor ligado: Pi (de teste|com visão)/,`${tag}: o nome acessível segue completo`);
  if(width===1440)assert.match(row.shown,/^Pi (de teste|com visão)/,`${tag}: na coluna padrão o nome do modelo aparece`);
  console.log(`indicador ${tag}: degrau "${row.fit}", texto "${row.shown}"`);
  /* as mensagens começam logo abaixo do cabeçalho (sem faixa no meio) */
  const first=await page.evaluate(()=>{
   const chat=document.querySelector('#chat'),m=document.querySelector('#messages');
   chat.scrollTop=0;m.scrollTop=0;
   const mr=m.getBoundingClientRect();
   return {headBottom:document.querySelector('.chat-head').getBoundingClientRect().bottom,messagesTop:mr.top};
  });
  assert.ok(first.messagesTop-first.headBottom<=1.5,`${tag}: as mensagens começam logo abaixo do cabeçalho (${first.messagesTop-first.headBottom}px)`);
  await reviewShot(page,out,`${tag}-ligado-mensagens.png`);
  await openModelPop(page);
  const popBox=await rect(page,'#model-pop'),indBox=await rect(page,'#model-indicator');
  inside(popBox,viewport.w,viewport.h,`${tag} popover`);
  assert.ok(popBox.bottom<=indBox.top+0.5,`${tag}: o popover abre para cima do indicador`);
  assert.ok(popBox.top>=headBox.bottom-0.5,`${tag}: o popover não sobe por cima do cabeçalho`);
  await reviewShot(page,out,`${tag}-popover.png`);
  await closeModelPop(page);
 }

 /* ---- #42: degraus da fileira, da caixa larga à mais estreita. A ordem é a
    do núcleo (`rowFit`): Referências vira ícone, o esforço sai, o modelo vira
    ícone — nunca o contrário. ---- */
 await size(app,page,1440,900);
 await layoutStable(page,'#messages');
 const seen=[];
 for(const w of [720,560,420,360,320,280,240,210]){
  await page.evaluate(px=>{const box=document.querySelector('#composer-box');box.style.width=`${px}px`;box.style.maxWidth='none';},w);
  await layoutStable(page,'#model-indicator');
  const step=await page.evaluate(()=>{const r=document.querySelector('#composer-box .composer-actions'),b=document.querySelector('#model-indicator'),m=b.querySelector('.mi-model');return {fit:r.dataset.fit||'',overflow:r.scrollWidth-r.clientWidth,dot:b.querySelector(b.hasAttribute('data-logo')?'.mi-logo':'#status-dot').getBoundingClientRect().width>0,cut:m.offsetWidth>0&&m.scrollWidth>m.clientWidth+0.5,refsLabel:getComputedStyle(document.querySelector('#include-refs span')||document.body).display!=='none'};});
  seen.push({w,...step});
  assert.equal(step.dot,true,`caixa ${w}px: o logo (ou o ponto) continua à vista`);
  assert.equal(step.cut,false,`caixa ${w}px: nome do modelo inteiro ou só o ícone`);
 }
 console.log('degraus da fileira:',seen.map(x=>`${x.w}px→"${x.fit}"`).join(', '));
 const order=seen.map(x=>LADDER.indexOf(x.fit));
 for(let i=1;i<order.length;i++)assert.ok(order[i]>=order[i-1],`a fileira só cede mais quando estreita (${JSON.stringify(seen)})`);
 assert.equal(seen[0].fit,'','caixa larga: tudo com rótulo, o par modelo · esforço inteiro');
 assert.equal(seen.at(-1).fit,'icon','caixa mínima: o modelo vira só o ícone');
 assert.ok(seen.some(x=>x.fit==='model'),'há um degrau só com o nome do modelo (o esforço cede antes)');
 for(const x of seen.filter(x=>x.fit!==''))assert.equal(x.refsLabel,false,`caixa ${x.w}px: Referências cedeu o rótulo antes do indicador`);
 await page.evaluate(()=>{const box=document.querySelector('#composer-box');box.style.width='240px';});
 await layoutStable(page,'#model-indicator');
 await reviewShot(page,out,'caixa-240-so-icone.png');
 await page.evaluate(()=>{const box=document.querySelector('#composer-box');box.style.width='';box.style.maxWidth='';});
 await layoutStable(page,'#model-indicator');

 /* ---- 900×650 com a calculadora expandida ---- */
 await size(app,page,900,650);
 await layoutStable(page,'#messages');
 await page.locator('#calc-toggle').click();
 await page.waitForFunction(()=>document.querySelector('#calc-toggle').getAttribute('aria-expanded')==='true');
 await layoutStable(page,'#messages');
 const head2=await rect(page,'.chat-head'),messages2=await rect(page,'#messages'),composer2=await rect(page,'#composer');
 assert.ok(head2.bottom<=messages2.top+1.5,'com a calculadora aberta, as mensagens seguem sob o cabeçalho');
 inside(composer2,900,650,'composer com a calculadora aberta');
 assert.ok(messages2.height>=60,`as mensagens ainda têm altura com a calculadora aberta (${messages2.height}px)`);
 await openModelPop(page);
 inside(await rect(page,'#model-pop'),900,650,'popover com a calculadora aberta');
 await reviewShot(page,out,'900x650-calculadora-aberta-popover.png');
 await closeModelPop(page);
 await reviewShot(page,out,'900x650-calculadora-aberta.png');
 await page.locator('#calc-toggle').click();

 assert.deepEqual(errors,[],'nenhum erro de página');
 console.log('PASS model-indicator-ui (ligado) — capturas em',out);
});

/* ---------- tutor desligado: o indicador diz isso, sem lista vazia quebrada ---------- */
await withArtifacts('model-indicator-off',async ctx=>{
 const runtime=ctx.runtime=newRuntime('modelind-off');
 const course=seedCourse(runtime,'calc');
 writeConfigJson(runtime,{runtimePath:runtime,vaultPath:runtime,courses:[{id:'calc',name:'Cálculo',path:course}]});
 writeDeskJson(runtime,{courseId:'calc'});
 const app=ctx.app=await launchDesk({runtime,env:{LEARNING_DESK_PI:'/usr/bin/false'}});
 const page=await app.firstWindow();
 await size(app,page,1440,900);
 await page.waitForSelector('#status-dot.error,#status-dot:not(.online):not(.connecting)',{timeout:30000});
 await page.waitForFunction(()=>/Tutor (desligado|sem resposta)/.test(document.querySelector('#model-indicator .mi-text').textContent),undefined,{timeout:30000});
 assert.equal(await page.locator('#model-indicator').getAttribute('data-state'),'off');
 assert.match(await indicatorText(page),/^Tutor (desligado|sem resposta)$/,'o indicador diz o estado e não um modelo velho');
 assert.equal(await page.locator('#model-indicator #status-dot.online').count(),0,'o ponto não diz ligado');
 assert.equal(await page.locator('#model-indicator #status-dot').isVisible(),true,'desligado, o ponto volta no lugar do logo');
 assert.equal(await page.locator('#model-indicator[data-logo]').count(),0,'desligado, sem logo');
 await openModelPop(page);
 assert.equal(await page.locator('#model-pop-note').isVisible(),true,'o popover explica em vez de mostrar lista vazia');
 assert.match(await page.locator('#model-pop-note').innerText(),/Chame o tutor para escolher o modelo e o esforço/);
 assert.equal(await page.locator('#model-pop #model-search').isVisible(),false,'nenhuma lista vazia aparece');
 assert.equal(await page.locator('#model-pop #effort-strip').isVisible(),false);
 assert.equal(await page.locator('#model-pop-connect').isVisible(),true,'há um jeito de chamar o tutor');
 inside(await rect(page,'#model-pop'),1440,900,'popover desligado');
 await reviewShot(page,out,'claro-1440x900-desligado-popover.png');
 await closeModelPop(page);
 await reviewShot(page,out,'claro-1440x900-desligado.png');
 await setTheme(page,'dark');
 await reviewShot(page,out,'escuro-1440x900-desligado.png');
 await size(app,page,900,650);
 await layoutStable(page,'#messages');
 const head=await rect(page,'.chat-head');
 assert.ok(head.height<=42,'900×650: uma linha');
 for(const id of ['#session-title','#model-indicator','#chat-more'])inside(await rect(page,id),900,650,`900×650 ${id}`);
 await openModelPop(page);
 await reviewShot(page,out,'escuro-900x650-desligado-popover.png');
 await closeModelPop(page);
 await openTutorMore(page);
 assert.equal(await page.locator('#more-compact-now').isDisabled(),true,'sem tutor ligado não há o que resumir');
 await page.keyboard.press('Escape');
 console.log('PASS model-indicator-ui (desligado) — capturas em',out);
});

/* ---------- modelo sem imagem: o aviso continua aparecendo ---------- */
await withArtifacts('model-indicator-image',async ctx=>{
 const runtime=ctx.runtime=newRuntime('modelind-img');
 const course=seedCourse(runtime,'calc');
 writeConfigJson(runtime,{runtimePath:runtime,vaultPath:runtime,courses:[{id:'calc',name:'Cálculo',path:course}]});
 writeDeskJson(runtime,{courseId:'calc'});
 const app=ctx.app=await launchDesk({runtime,env:{FAKE_PI_TEXT_ONLY:'1'}});
 const page=await app.firstWindow();
 await size(app,page,1440,900);
 await statusOnline(page);
 assert.equal(await indicatorText(page),'Pi de teste · desligado');
 await page.locator('#attach-input').setInputFiles({name:'plot.png',mimeType:'image/png',buffer:Buffer.from(PLOT_PNG,'base64')});
 await toastWait(page,'Este modelo não aceita imagens',{timeout:10000});
 const toast=await rect(page,'#toast .toast-item');
 inside(toast,1440,900,'aviso de imagem');
 await reviewShot(page,out,'claro-1440x900-aviso-imagem.png');
 await size(app,page,900,650);
 await layoutStable(page,'#messages');
 await page.locator('#attach-input').setInputFiles({name:'plot2.png',mimeType:'image/png',buffer:Buffer.from(PLOT_PNG,'base64')});
 await toastWait(page,'Este modelo não aceita imagens',{timeout:10000});
 inside(await rect(page,'#toast .toast-item'),900,650,'aviso de imagem em 900×650');
 console.log('PASS model-indicator-ui (imagem) — capturas em',out);
});
