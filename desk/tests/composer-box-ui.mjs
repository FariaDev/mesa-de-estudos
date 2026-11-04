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
/* Composer colado na coluna (#tema): mede a pele nos dois temas e as distâncias
   que o Lucas pediu — sem cartão, um fio só no topo, fundo da coluna e o texto
   a 12px da lateral, com fila, anexos, pílulas e botões na mesma coluna. */
const boxFacts=page=>page.evaluate(()=>{
 const composer=document.querySelector('#composer'),c=composer.getBoundingClientRect(),cs=getComputedStyle(composer);
 const box=document.querySelector('#composer-box'),b=box.getBoundingClientRect(),bs=getComputedStyle(box);
 const chat=document.querySelector('#chat'),columnRect=chat.getBoundingClientRect();
 /* Na janela baixa o #chat rola e a barra do sistema ocupa a direita: a
    coluna útil é o clientWidth, não o rect com a barra. */
 const column={width:chat.clientWidth,left:columnRect.left,right:columnRect.left+chat.clientWidth};
 const field=document.querySelector('#prompt'),fs=getComputedStyle(field),fr=field.getBoundingClientRect();
 const visible=el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0;};
 const desc=[...box.querySelectorAll('*')].filter(visible).map(el=>{const r=el.getBoundingClientRect();return {name:el.id||el.className||el.tagName,r};});
 const outside=desc.filter(({r})=>r.left<b.left-0.5||r.top<b.top-0.5||r.right>b.right+0.5||r.bottom>b.bottom+0.5).map(({name})=>name);
 const send=[document.querySelector('#send'),document.querySelector('#stop')].filter(el=>el&&visible(el)).map(el=>{const r=el.getBoundingClientRect();return {right:c.right-r.right,bottom:c.bottom-r.bottom};});
 const label=document.querySelector('#composer-box .queue-label'),item=document.querySelector('#composer-box .queue-item');
 const lr=label?.getBoundingClientRect(),ir=item?.getBoundingClientRect();
 const resolved=name=>{const probe=document.createElement('span');probe.style.background=name;probe.style.color=name;composer.append(probe);const style=getComputedStyle(probe);const value={bg:style.backgroundColor,color:style.color};probe.remove();return value;};
 return {
  composer:{width:c.width,left:c.left,right:c.right,top:c.top,bottom:c.bottom,radius:parseFloat(cs.borderTopLeftRadius),bg:cs.backgroundColor,shadow:cs.boxShadow,
   borderTop:{width:parseFloat(cs.borderTopWidth),style:cs.borderTopStyle,color:cs.borderTopColor},
   borderLeft:parseFloat(cs.borderLeftWidth),borderRight:parseFloat(cs.borderRightWidth),borderBottom:parseFloat(cs.borderBottomWidth)},
  box:{width:b.width,left:b.left,top:b.top,right:b.right,bottom:b.bottom,radius:parseFloat(bs.borderTopLeftRadius),bg:bs.backgroundColor,shadow:bs.boxShadow,
   borderTop:parseFloat(bs.borderTopWidth),borderLeft:parseFloat(bs.borderLeftWidth),borderRight:parseFloat(bs.borderRightWidth),borderBottom:parseFloat(bs.borderBottomWidth)},
  column,
  prompt:{left:fr.left+parseFloat(fs.paddingLeft)-c.left,top:fr.top+parseFloat(fs.paddingTop)-c.top,right:c.right-(fr.right-parseFloat(fs.paddingRight))},
  queue:lr&&ir?{labelTop:lr.top-c.top,labelLeft:lr.left-c.left,itemLeft:ir.left-c.left,itemRight:c.right-ir.right}:null,
  send,side:resolved('var(--side)'),raised:resolved('var(--raised)'),ring:resolved('var(--ring)'),outside
 };
});
async function assertBoxSkin(page,tag,{queue=false}={}){
 const facts=await boxFacts(page);
 assert.ok(Math.abs(facts.composer.width-facts.column.width)<=0.5,`${tag}: o composer tem a largura da coluna (${facts.composer.width} × ${facts.column.width})`);
 assert.ok(Math.abs(facts.composer.left-facts.column.left)<=0.5&&Math.abs(facts.composer.right-facts.column.right)<=0.5,`${tag}: o composer vai de ponta a ponta da coluna (${JSON.stringify(facts.composer)} × ${JSON.stringify(facts.column)})`);
 assert.ok(facts.composer.borderTop.width>=1&&facts.composer.borderTop.style==='solid'&&facts.composer.borderTop.color!=='rgba(0, 0, 0, 0)',`${tag}: fio de --border no topo (${JSON.stringify(facts.composer.borderTop)})`);
 assert.equal(facts.composer.borderLeft,0,`${tag}: sem borda lateral esquerda (${facts.composer.borderLeft}px)`);
 assert.equal(facts.composer.borderRight,0,`${tag}: sem borda lateral direita (${facts.composer.borderRight}px)`);
 assert.equal(facts.composer.borderBottom,0,`${tag}: sem borda inferior (${facts.composer.borderBottom}px)`);
 assert.equal(facts.composer.radius,0,`${tag}: composer sem raio (${facts.composer.radius}px)`);
 assert.equal(facts.composer.shadow,'none',`${tag}: composer sem sombra (${facts.composer.shadow})`);
 assert.equal(facts.composer.bg,facts.side.bg,`${tag}: fundo do composer é o da coluna (${facts.composer.bg} × ${facts.side.bg})`);
 assert.equal(facts.box.radius,0,`${tag}: caixa sem raio (${facts.box.radius}px)`);
 assert.equal(facts.box.bg,'rgba(0, 0, 0, 0)',`${tag}: caixa sem fundo próprio (${facts.box.bg})`);
 assert.equal(facts.box.shadow,'none',`${tag}: caixa sem sombra (${facts.box.shadow})`);
 for(const side of ['Top','Left','Right','Bottom'])assert.equal(facts.box[`border${side}`],0,`${tag}: caixa sem borda ${side.toLowerCase()} (${facts.box[`border${side}`]}px)`);
 assert.ok(Math.abs(facts.box.left-(facts.composer.left+12))<=0.5&&Math.abs(facts.box.right-(facts.composer.right-12))<=0.5,`${tag}: a coluna de texto fica 12px dentro do composer (${facts.box.left}..${facts.box.right} de ${facts.composer.left}..${facts.composer.right})`);
 for(const [part,min] of [['left',12],['top',8],['right',12]])assert.ok(facts.prompt[part]>=min-0.5,`${tag}: texto do campo a ≥${min}px da lateral (${part} ${facts.prompt[part].toFixed(1)}px)`);
 for(const [i,gap] of facts.send.entries()){
  assert.ok(gap.right>=12-0.5,`${tag}: botão ${i} respira 12px da lateral (right ${gap.right.toFixed(1)}px)`);
  assert.ok(gap.bottom>=8-0.5,`${tag}: botão ${i} respira do pé do composer (bottom ${gap.bottom.toFixed(1)}px)`);
 }
 if(queue){
  assert.ok(facts.queue,`${tag}: fila medida`);
  assert.ok(facts.queue.labelTop>=8-0.5,`${tag}: título da fila respira do topo do composer (${facts.queue.labelTop.toFixed(1)}px)`);
  assert.ok(facts.queue.labelLeft>=12-0.5,`${tag}: título da fila a ≥12px da esquerda (${facts.queue.labelLeft.toFixed(1)}px)`);
  assert.ok(facts.queue.itemLeft>=12-0.5,`${tag}: linha da fila a ≥12px da esquerda (${facts.queue.itemLeft.toFixed(1)}px)`);
  assert.ok(facts.queue.itemRight>=12-0.5,`${tag}: linha da fila a ≥12px da direita (${facts.queue.itemRight.toFixed(1)}px)`);
 }
 assert.deepEqual(facts.outside,[],`${tag}: nenhum filho fora da caixa`);
 return facts;
}
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
 /* 15 s: o bloco 10 mede a fila em quatro temas/tamanhos antes de o turno do fake terminar. */
 const env=captureFixtureEnv(runtime,{FAKE_PI_QUEUE_LOG:logFile,FAKE_PI_QUEUE_HOLD_MS:'15000'});
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
   inBox:['#attachments','#prompt','.composer-actions','#attach','#include-refs','#send','#stop'].filter(sel=>!box.querySelector(sel)),
   hint:!!document.querySelector('#composer-hint'),
   refsState:!!document.querySelector('#refs-state'),
   refsPop:!!document.querySelector('#refs-pop'),
   summaryInBox:box.contains(document.querySelector('#context-summary')),
   studyVisibleAtRest:(()=>{const el=document.querySelector('#study-context');const b=el.getBoundingClientRect();return b.width>0&&b.height>0;})(),
  };
 });
 assert.deepEqual(parts.kids,['goes-along','mention-chips','attachments','prompt','composer-actions'],'a caixa tem a pílula de contexto, chips das ferramentas (#53), anexos, campo e fileira, nessa ordem');
 assert.deepEqual(parts.inBox,[],'anexar, Referências e Enviar/Parar moram dentro da caixa; o Conferir fica no menu Anexar');
 assert.equal(parts.hint,false,'a dica de atalhos saiu da tela principal');
 assert.equal(parts.refsState,false,'a etiqueta de estado das referências saiu (a linha Vai junto a substitui)');
 assert.equal(parts.refsPop,false,'o popover antigo das referências saiu');
 assert.equal(parts.summaryInBox,true,'o contexto vira pílula dentro da caixa');
 assert.equal(parts.studyVisibleAtRest,false,'lista/questão e rascunho não ficam soltos: só aparecem pela linha');
 const lineBox=await rect(page,'#goes-along'),boxBox=await rect(page,'#composer-box');
 assert.ok(lineBox.top>=boxBox.top-0.5&&lineBox.bottom<=boxBox.bottom+0.5,'a pílula de contexto fica dentro da caixa');
 assert.ok(lineBox.top-boxBox.top<24,'a pílula abre a caixa, acima do campo');
 // a fileira: ordem e alinhamento
 const order=await page.evaluate(()=>['#attach','#include-refs','#send'].map(sel=>document.querySelector(sel).getBoundingClientRect().left));
 assert.deepEqual([...order].sort((a,b)=>a-b),order,'Anexar, Referências e Enviar, da esquerda para a direita');
 assert.equal(await page.locator('#send').getAttribute('class'),'','sem texto nem anexo, Enviar fica neutro (cinza)');
 assert.equal(await page.locator('#send').evaluate(el=>el.innerText.trim()),'','Enviar é só a seta (#90)');
 assert.equal(await page.locator('#send svg.icon').count(),1,'Enviar mostra o ícone de seta');
 assert.equal(await page.locator('#send').getAttribute('aria-label'),'Enviar mensagem','a seta mantém o nome acessível');
 assert.equal(await page.locator('#stop').isHidden(),true,'Parar não aparece com o tutor livre');
 const emptyField=await rect(page,'#prompt');
 assert.ok(emptyField.height<=48,`em repouso o campo fica em uma a duas linhas (${emptyField.height}px)`);
 await page.locator('#prompt').fill('linha um\nlinha dois\nlinha três');
 await nextFrames(page);
 const grownField=await rect(page,'#prompt');
 assert.ok(grownField.height>emptyField.height+10,`com texto o campo cresce (${emptyField.height} -> ${grownField.height}px)`);
 assert.equal(await page.locator('#send').getAttribute('class'),'primary','com texto, Enviar acende no acento');
 await page.locator('#prompt').fill('');
 assert.equal(await page.locator('#send').getAttribute('class'),'','esvaziar o campo apaga o acento');
 await reviewShot(page,out,'caixa-vazia-claro-1440.png');

 /* ---------- 1b. o menu Anexar guarda imagem/PDF, Foto do celular e Conferir ---------- */
 await page.locator('#attach').click();
 const attachPop=page.locator('#attach-pop');
 assert.equal(await attachPop.isVisible(),true,'Anexar abre o menu');
 assert.equal(await page.locator('#attach').getAttribute('aria-expanded'),'true');
 assert.deepEqual(await attachPop.locator('button[role="menuitem"]:visible').evaluateAll(els=>els.map(el=>el.id)),['attach-file','phone-photo','check'],'o menu mostra arquivo, Foto do celular e a captura');
 assert.equal(await page.locator('#attach-file').textContent().then(t=>t.trim()),'Imagem ou PDF');
 await reviewShot(page,out,'menu-anexar-claro-1440.png');
 await page.keyboard.press('Escape');
 assert.equal(await attachPop.isHidden(),true,'Esc fecha o menu Anexar');
 assert.equal(await page.evaluate(()=>document.activeElement?.id),'attach','o foco volta ao Anexar');

 /* ---------- 2. Vai junto: materiais, página e contexto; Referências liga/desliga ---------- */
 let text=await line(page);
 const summary=page.locator('#context-summary');
 assert.match(await summary.getAttribute('aria-label'),/^Contexto: /,'o nome acessível da linha mantém o rótulo, mesmo escondido');
 assert.match(text,/Cálculo I/,'a matéria vai junto');
 assert.match(text,/Limites\.pdf p\.\d+/,'o primeiro material e a página vão junto');
 assert.match(text,/Formulario\.pdf p\.\d+/,'o segundo material e a página vão junto');
 assert.equal(await page.locator('#context-summary>.goes-course').count(),1,'a matéria é uma pílula, em primeiro lugar');
 const pillLabels=await page.locator('#context-summary>.goes-pill').evaluateAll(els=>els.map(el=>el.getAttribute('aria-label')));
 assert.deepEqual(pillLabels.slice(0,1),['Cálculo I'],'a matéria vem primeiro, com o nome inteiro no aria-label');
 assert.match(pillLabels[1],/^Limites\.pdf p\.\d+$/,'o primeiro material guarda nome e página no aria-label');
 assert.match(pillLabels[2],/^Formulario\.pdf p\.\d+$/,'o segundo material guarda nome e página no aria-label');
 assert.deepEqual(await page.locator('#context-summary>.goes-pill').evaluateAll(els=>els.map(el=>el.getAttribute('title'))),pillLabels,'e o nome inteiro na dica');
 assert.equal(await page.locator('#context-summary>.goes-lead').isHidden(),true,'o prefixo fica escondido quando há pílula');
 const pillGap=await page.locator('#context-summary').evaluate(box=>{
  const pill=[...box.querySelectorAll(':scope>.goes-pill')].map(el=>el.getBoundingClientRect()).filter(r=>r.width>0);
  return pill.slice(1).map((r,i)=>Math.round(r.left-pill[i].right));
 });
 assert.deepEqual(pillGap,[4,4],`as pílulas ficam a 4px uma da outra (${pillGap})`);
 const pillFit=await page.locator('#context-summary>.goes-pill').evaluateAll(els=>els.map(el=>el.scrollWidth<=el.clientWidth));
 assert.deepEqual(pillFit,[true,true,true],'cada pílula mostra o nome e a página sem cortar na janela larga');
 /* Pílula de contexto é chip compacto (#90, polimento): canto de 6px, não cápsula,
    e o conteúdo fica centrado — o respiro à esquerda e à direita é o mesmo, mesmo
    na matéria curta que herda a largura mínima de 8 caracteres. */
 const pillShape=await page.locator('#context-summary>.goes-pill').evaluateAll(els=>els.map(el=>{
  const r=el.getBoundingClientRect();
  const kids=[...el.children].filter(k=>k.getBoundingClientRect().width>0);
  const first=kids[0]?.getBoundingClientRect(),last=kids[kids.length-1]?.getBoundingClientRect();
  return {radius:parseFloat(getComputedStyle(el).borderTopLeftRadius),left:first?Math.round(first.left-r.left):null,right:last?Math.round(r.right-last.right):null};
 }));
 for(const shape of pillShape){
  assert.ok(shape.radius<=7,`a pílula é chip compacto, não cápsula (raio ${shape.radius}px)`);
  assert.ok(Math.abs(shape.left-shape.right)<=1,`o respiro da pílula é o mesmo dos dois lados (${JSON.stringify(shape)})`);
 }
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
 assert.match(await line(page),/Limites\.pdf p\.\s?\d+/,'ligado de novo, os materiais voltam à linha');
 // a linha acompanha a página do leitor
 await page.evaluate(async()=>{const state=await import('./src/state.mjs');state.S.panels[0].page=7;state.updateContextSummary();});
 assert.match(await line(page),/Limites\.pdf p\.\s?7/,'a linha acompanha a página');
 await page.evaluate(async()=>{const state=await import('./src/state.mjs');state.S.panels[0].page=1;state.updateContextSummary();});

 /* ---------- 3. o contexto de estudo se edita pela linha ---------- */
 const edit=page.locator('#context-edit');
 assert.equal(await edit.isVisible(),true,'a linha oferece editar o contexto');
 assert.equal(await page.locator('#context-pop').isHidden(),true);
 await page.locator('#context-summary').click();
 assert.equal(await page.evaluate(()=>document.querySelector('#context-pop').hidden),false,'clicar a pílula abre a edição (#90)');
 assert.equal(await page.evaluate(()=>document.activeElement?.id),'exercise-title','o foco cai no campo da lista/questão');
 await page.keyboard.press('Escape');
 await page.waitForFunction(()=>document.querySelector('#context-pop').hidden);
 await edit.click();
 await page.locator('#context-pop').waitFor({state:'visible'});
 assert.equal(await edit.getAttribute('aria-expanded'),'true');
 assert.equal(await page.evaluate(()=>document.activeElement?.id),'exercise-title','o foco cai no campo da lista/questão');
 await page.locator('#exercise-title').fill('Lista 3 q.2');
 assert.match(await line(page),/Lista 3 q\.2/,'a linha mostra a questão ativa na hora');
 assert.match(await page.locator('#context-pop-refs').textContent(),/Caminho e página; o PDF não vai\. A captura do Xournal\+\+ vai como imagem\./,'a nota mantém a garantia curta de referências × captura');
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
 await page.locator('#attach').click();
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
 assert.equal(await page.locator('#messages .message[data-latest-answer]').count(),0,'durante o streaming nenhuma resposta fica marcada');
 const stopSlot=await rect(page,'#stop');
 assert.ok(Math.abs(stopSlot.right-sendSlot.right)<=1,`Parar ocupa o lugar do Enviar (${stopSlot.right} × ${sendSlot.right})`);
 assert.ok(Math.abs(stopSlot.top-sendSlot.top)<=1,'Parar fica na mesma linha');
 assert.equal(await page.locator('#stop').getAttribute('class'),null,'Parar não leva a classe de acento');
 assert.equal(await page.locator('#stop').innerText().then(t=>t.trim()),'Parar');
 /* A dica do Parar é curta (#90); a explicação da fila mora no guia. */
 await page.locator('#stop').hover();
 await page.waitForFunction(()=>{const tip=document.querySelector('.tip');return tip&&!tip.hidden&&getComputedStyle(tip).opacity!=='0'&&tip.textContent.trim();},undefined,{timeout:5000});
 const stopTip=await page.locator('.tip').first().textContent();
 assert.equal(stopTip.trim(),'Parar','o balão do Parar diz só o que ele faz');
 await page.mouse.move(2,2);
 await reviewShot(page,out,'respondendo-claro-1440.png');
 /* ---------- 6. fila: a mensagem enfileirada na resposta é entregue depois ---------- */
 await page.locator('#prompt').fill('segunda na fila');
 await page.locator('#prompt').press('Enter');
 await page.waitForSelector('#composer-box .queue-strip');
 assert.equal(await page.locator('.queue-label').textContent(),'Na fila · 1','a faixa da fila abre dentro da caixa, com a contagem');
 assert.deepEqual(await page.locator('.queue-item span').allTextContents(),['segunda na fila']);
 assert.equal(await page.locator('#prompt').inputValue(),'','enfileirar esvazia o campo');
 await reviewShot(page,out,'com-fila-claro-1440.png');
 assert.ok(!sentLines().includes('segunda na fila'),'nada vai ao Pi antes do fim do turno');
 await waitSent('segunda na fila');
 await page.waitForFunction(()=>!document.querySelector('.queue-strip'),undefined,{timeout:60000});
 await idle();
 assert.equal(await page.locator('#send').isVisible(),true,'terminada a resposta, Enviar volta');
 /* #90: a última resposta deixa o salvar à vista; as outras ações esperam o hover. */
 const latestActions=await page.evaluate(()=>{
  const answers=[...document.querySelectorAll('#messages .message:not(.user)')];
  const last=answers.at(-1);
  const opacity=selector=>{const el=last?.querySelector(selector);return el?getComputedStyle(el).opacity:null;};
  return {count:answers.length,marked:last?.hasAttribute('data-latest-answer')||false,
   review:opacity('.msg-review'),copy:opacity('.msg-copy'),copies:last?.querySelectorAll('.msg-review').length||0};
 });
 assert.ok(latestActions.count>=1,'a resposta do tutor está na conversa');
 assert.equal(latestActions.marked,true,'a última resposta concluída fica marcada');
 assert.equal(latestActions.review,'1','o salvar da última resposta aparece sem hover');
 assert.equal(latestActions.copy,'0','copiar continua só no hover');
 assert.equal(latestActions.copies,1,'só o salvar fica marcado');
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
 /* Bloco da fila: cabeçalho "Na fila · N", mensagem cortada e ações à direita.
    Com uma mensagem só não há "Limpar"; o × é ícone com nome acessível. */
 assert.equal(await page.locator('#composer-box .queue-head .queue-label').count(),1,'a fila tem cabeçalho dentro da caixa');
 assert.equal(await page.locator('.queue-item .queue-remove svg.icon').count(),1,'o remover é ícone');
 assert.equal(await page.locator('.queue-item .queue-remove').getAttribute('aria-label'),'Remover da fila');
 assert.equal(await page.locator('.queue-clear').isVisible(),false,'com uma mensagem só, sem Limpar');
 await page.locator('.queue-remove').focus();
 const removeFocus=await page.locator('.queue-remove').evaluate(el=>getComputedStyle(el).outlineStyle);
 assert.notEqual(removeFocus,'none','o × mostra o foco do teclado');
 await page.locator('#prompt').fill('segunda guardada e bem comprida para a linha cortar com reticências em vez de esticar a caixa');
 await page.locator('#prompt').press('Enter');
 await page.waitForFunction(()=>document.querySelectorAll('.queue-item').length===2);
 assert.equal(await page.locator('.queue-clear').isVisible(),true,'com duas mensagens, Limpar entra no cabeçalho');
 const clipped=await page.locator('.queue-item>span').nth(1).evaluate(span=>{const style=getComputedStyle(span);return {overflow:style.textOverflow,nowrap:style.whiteSpace,cuts:span.scrollWidth>span.clientWidth};});
 assert.deepEqual(clipped,{overflow:'ellipsis',nowrap:'nowrap',cuts:true},'a mensagem longa corta com reticências numa linha');
 await page.locator('.queue-remove').nth(1).click();
 await page.waitForFunction(()=>document.querySelectorAll('.queue-item').length===1);
 assert.equal(await page.locator('.queue-clear').isVisible(),false,'de volta a uma mensagem, Limpar sai');
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
  /* A conversa pode estar seguindo o fim (item 15): a posição muda com a
     rolagem, mas o tamanho do layout é o que este teste mede. */
  await layoutStable(page,'#messages',{position:false});
  const tag=`${theme}-${width}x${height}`;
  const viewport={left:0,top:0,right:width,bottom:height};
  const scroll=await page.evaluate(()=>({sw:document.documentElement.scrollWidth,w:innerWidth}));
  assert.ok(scroll.sw<=scroll.w+1,`${tag}: sem rolagem horizontal da página`);
  await page.evaluate(()=>{for(const sel of ['#messages','#chat']){const el=document.querySelector(sel);el.scrollTop=el.scrollHeight;}});
  await nextFrames(page);
  const boxRect=await rect(page,'#composer-box');
  inside(boxRect,viewport,`${tag} caixa`);
  const facts=await assertBoxSkin(page,tag);
  for(const id of ['#attach','#include-refs','#send','#prompt','#context-summary','#context-edit']){
   const box=await rect(page,id);
   inside(box,id==='#context-summary'||id==='#context-edit'?viewport:boxRect,`${tag} ${id}`);
  }
  /* Fila, anexos, pílula e fileira começam na mesma coluna do texto do campo. */
  const aligned=await page.evaluate(()=>{
   const composer=document.querySelector('#composer').getBoundingClientRect();
   const field=document.querySelector('#prompt'),fr=field.getBoundingClientRect();
   const textLeft=fr.left+parseFloat(getComputedStyle(field).paddingLeft);
   const rows=['#composer-box #goes-along','#composer-box #attachments','#composer-box .composer-actions'].map(selector=>{
    const el=document.querySelector(selector),r=el.getBoundingClientRect(),style=getComputedStyle(el);
    return {selector,left:r.left+parseFloat(style.paddingLeft)-textLeft};
   });
   return {textLeft:textLeft-composer.left,rows};
  });
  assert.ok(Math.abs(aligned.textLeft-12)<=0.6,`${tag}: a primeira letra fica a 12px da lateral (${aligned.textLeft}px)`);
  for(const row of aligned.rows)assert.ok(Math.abs(row.left)<=0.6,`${tag}: ${row.selector} alinha com o texto do campo (${row.left}px)`);
  /* Foco: o fio do topo acende em --ring e nada muda de lugar. */
  await page.locator('#prompt').focus();
  await nextFrames(page);
  const focused=await boxFacts(page);
  assert.equal(focused.composer.borderTop.color,focused.ring.color,`${tag}: com foco, o fio do topo acende em --ring (${focused.composer.borderTop.color} × ${focused.ring.color})`);
  assert.equal(focused.composer.borderTop.width,facts.composer.borderTop.width,`${tag}: o foco não engorda o fio (${focused.composer.borderTop.width} × ${facts.composer.borderTop.width})`);
  for(const side of ['top','bottom','left','right'])assert.ok(Math.abs(focused.composer[side]-facts.composer[side])<=0.6,`${tag}: o foco não muda o layout (${side} ${focused.composer[side]} × ${facts.composer[side]})`);
  assert.ok(Math.abs(focused.prompt.left-facts.prompt.left)<=0.6&&Math.abs(focused.prompt.top-facts.prompt.top)<=0.6,`${tag}: o texto não pula com o foco`);
  await page.evaluate(()=>document.activeElement?.blur());
  await nextFrames(page);
  const blurred=await boxFacts(page);
  assert.notEqual(blurred.composer.borderTop.color,blurred.ring.color,`${tag}: sem foco, o fio volta para --border (${blurred.composer.borderTop.color})`);
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
  assert.ok(lineOver<=1,`${tag}: a pílula de contexto cabe (corta com reticências)`);
  /* Janela estreita, matéria e PDF de nomes grandes e quatro itens: a linha
     quebra em até duas linhas; o nome do PDF cede antes da matéria, mas a
     página (p.N) continua à vista e a matéria guarda 8 caracteres legíveis
     (#90). */
  const longCourse='Cálculo Diferencial e Integral Avançado — Turma da Manhã';
  const longPdf=path.join(runtime,'Lista de exercicios muito comprida para nao caber de jeito nenhum.pdf');
  const previousPath=await page.evaluate(async({name,long})=>{
   const state=await import('./src/state.mjs');
   const previous=state.S.panels[1].path;
   state.S.activeCourseName=name;
   state.S.panels[1].path=long;
   state.S.panels[1].page=1;
   state.updateContextSummary();
   return previous;
  },{name:longCourse,long:longPdf});
  const cut=await page.evaluate(()=>{
   const box=document.querySelector('#context-summary');
   const pills=[...box.querySelectorAll(':scope>.goes-pill')].filter(el=>el.getBoundingClientRect().width>0);
   const lines=new Set(pills.map(el=>Math.round(el.getBoundingClientRect().top)));
   const pdf=[...box.querySelectorAll('.goes-rest')].find(el=>(el.getAttribute('aria-label')||'').includes('Lista de exercicios muito comprida'));
   const pdfName=pdf?.querySelector('.goes-pill-name');
   const pdfPage=pdf?.querySelector('.goes-pill-page');
   const course=box.querySelector('.goes-course');
   const courseName=course?.querySelector('.goes-pill-name');
   const cs=course?getComputedStyle(course):null;
   const ctx=document.createElement('canvas').getContext('2d');
   if(cs)ctx.font=`${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
   return {
    over:box.scrollWidth-box.clientWidth,
    lines:lines.size,height:box.clientHeight,labels:pills.map(el=>el.getAttribute('aria-label')),
    course:{client:course?.clientWidth??0,nameClient:courseName?.clientWidth??0,nameScroll:courseName?.scrollWidth??0,char:ctx.measureText('x').width,paddingX:cs?parseFloat(cs.paddingLeft)+parseFloat(cs.paddingRight):0},
    pdf:{label:pdf?.getAttribute('aria-label')||'',nameClient:pdfName?.clientWidth??0,nameScroll:pdfName?.scrollWidth??0,page:pdfPage?.textContent??'',pageClient:pdfPage?.clientWidth??0}
   };
  });
  assert.ok(cut.over<=1,`${tag}: a linha de pílulas não estoura (${cut.over}px)`);
  assert.ok(cut.lines<=2,`${tag}: a linha quebra em até 2 linhas (${cut.lines})`);
  assert.ok(cut.height<=49,`${tag}: a linha não passa de duas linhas de pílula (${cut.height}px)`);
  assert.ok(cut.course.client>=8*cut.course.char+cut.course.paddingX,`${tag}: a pílula da matéria mantém 8 caracteres legíveis (${JSON.stringify(cut.course)})`);
  assert.match(cut.pdf.label,/Lista de exercicios muito comprida/,'a pílula do PDF longo guarda o nome inteiro');
  assert.ok(cut.pdf.nameScroll>cut.pdf.nameClient,`${tag}: o nome do PDF é o que corta (${JSON.stringify(cut.pdf)})`);
  assert.match(cut.pdf.page,/p\.1/,`${tag}: a página continua inteira ao lado do nome cortado (${cut.pdf.page})`);
  assert.ok(cut.pdf.pageClient>0,`${tag}: a página do PDF não encolhe (${cut.pdf.pageClient}px)`);
  assert.ok(cut.labels.includes(`${longCourse}`)&&cut.labels.includes('Lista de exercicios muito comprida para nao caber de jeito nenhum.pdf p.1'),'o nome inteiro segue no aria-label das pílulas');
  await page.evaluate(async previous=>{const state=await import('./src/state.mjs');state.S.activeCourseName='Cálculo I';state.S.panels[1].path=previous;state.updateContextSummary();},previousPath);
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
  /* A conversa pode estar seguindo o fim (item 15): a posição muda com a
     rolagem, mas o tamanho do layout é o que este teste mede. */
  await layoutStable(page,'#messages',{position:false});
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
   /* Primeira letra do "Tutor está pensando…": tem de começar dentro da coluna,
      não colada/cortada pela borda esquerda. */
   const firstText=act.firstChild;
   let firstLetter=null;
   if(firstText?.nodeType===3&&firstText.textContent.trim()){
    const range=document.createRange();range.setStart(firstText,0);range.setEnd(firstText,1);
    firstLetter=range.getBoundingClientRect().left;
   }
   const field=document.querySelector('#prompt');
   const fieldStart=field.getBoundingClientRect().left+parseFloat(getComputedStyle(field).paddingLeft);
   return {activity:start,activityText:text,firstLetter,field:fieldStart,goes:left('#context-summary > :first-child')??left('#context-summary'),box:left('#composer-box'),column:left('#sidebar')};
  });
  if(edges.activityText!==null)assert.ok(Math.abs(edges.activityText-edges.activity)<=0.6,`${tag}: "Pensando…" começa no recuo da linha`);
  if(edges.firstLetter!==null)assert.ok(edges.firstLetter>=edges.column+11.5,`${tag}: a primeira letra de "Pensando…" não é cortada pela borda (${edges.firstLetter} × ${edges.column})`);
  /* O composer recolhe o texto do campo em 12px; a atividade acompanha a
     coluna do texto. Medir o texto do campo — e não a borda do composer — é o
     que mantém "Pensando…" alinhado a ele. */
  assert.ok(Math.abs(edges.activity-edges.field)<=0.6,`${tag}: atividade e texto do campo na mesma margem (${JSON.stringify(edges)})`);
  assert.ok(edges.goes!==null&&edges.goes>=edges.box,`${tag}: a pílula de contexto começa dentro da caixa (${JSON.stringify(edges)})`);
  const boxRect=await rect(page,'#composer-box');
  inside(boxRect,{left:0,top:0,right:width,bottom:height},`${tag} caixa com fila`);
  await assertBoxSkin(page,tag,{queue:true});
  const queueGap=await page.evaluate(()=>{
   const composer=document.querySelector('#composer').getBoundingClientRect();
   const label=document.querySelector('#composer-box .queue-label').getBoundingClientRect();
   const field=document.querySelector('#composer-box #prompt');
   const fieldLeft=field.getBoundingClientRect().left+parseFloat(getComputedStyle(field).paddingLeft);
   return {top:label.top-composer.top,left:label.left-fieldLeft};
  });
  assert.ok(queueGap.top>=8,`${tag}: a fila respira dentro do composer (${queueGap.top}px do topo)`);
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
