// node tests/conferir-ui.mjs — Conferir com outros programas (tickets #35 e #38), na janela.
// A lista de janelas e a captura vêm de um fixture (LEARNING_DESK_CAPTURE_FIXTURE,
// só em modo de teste): nenhuma captura de tela de verdade, e por isso o teste
// roda mesmo sem o helper visual-check. Cobre: o Xournal++ sem escolha; a escolha
// do programa nas Configurações → Pastas e programas → Programa de escrita (app
// + título, a Mesa e o sistema fora); escolher vale na hora e Cancelar não
// desfaz; a caixa de mensagem guarda só o botão "Conferir <app>" (sem ▾); o
// rótulo, o anexo, o toast e a linha que vai ao tutor seguem o app; a escolha é
// o APP (sobrevive a outro id de janela); app ausente diz isso numa frase e a
// ação "Escolher outro programa…" leva ao campo, sem capturar outra janela;
// "Voltar ao Xournal++" pelas Configurações; a busca de comandos leva ao campo.
// Nos dois temas, em 1440×900 e 900×650. Capturas só com MESA_REVIEW_SHOTS.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
 withArtifacts,newRuntime,seedCourse,writeConfigJson,writeDeskJson,launchDesk,statusOnline,PLOT_PNG,
 reviewShot,screenshotDirectory,setTheme,freezeMotion,toastWait,resizeWindow
} from './helpers.mjs';
import {layoutStable,nextFrames,pollUntil} from './waits.mjs';

const out=screenshotDirectory('conferir');
const size=(app,page,width,height)=>resizeWindow(app,page,width,height);
const rect=(page,selector)=>page.evaluate(sel=>{const el=document.querySelector(sel);if(!el)return null;const b=el.getBoundingClientRect();return {top:b.top,bottom:b.bottom,left:b.left,right:b.right,width:b.width,height:b.height};},selector);
const DATA_URL='data:image/png;base64,'+PLOT_PNG;
const BOUNDS={X:0,Y:0,Width:1200,Height:800};
const win=(id,app,title,extra={})=>({id,app,title,bounds:BOUNDS,dataUrl:DATA_URL,...extra});

await withArtifacts('conferir',async ctx=>{
 const runtime=ctx.runtime=newRuntime('conferir');
 const course=seedCourse(runtime,'calc');
 writeConfigJson(runtime,{runtimePath:runtime,vaultPath:runtime,courses:[{id:'calc',name:'Cálculo I',path:course}]});
 writeDeskJson(runtime,{courseId:'calc'});
 const fixture=path.join(runtime,'capture-fixture.json');
 const setWindows=windows=>fs.writeFileSync(fixture,JSON.stringify({windows,dataUrl:DATA_URL}));
 const desk=()=>{try{return JSON.parse(fs.readFileSync(path.join(runtime,'desk.json'),'utf8'));}catch{return {};}};
 const FULL=[
  win('101','Mesa de Estudos','Mesa de Estudos'),
  win('102','Dock','Dock'),
  win('103','OneNote','Caderno de Cálculo'),
  win('104','Safari','Aula 7 — limites'),
  win('105','OneNote','Outra página'),
  win('106','Xournal++','Lista 3 — prova.xopp'),
  win('107','Finder','Documentos',{bounds:{X:0,Y:0,Width:600,Height:30}}),
 ];
 setWindows(FULL);
 const app=ctx.app=await launchDesk({runtime,env:{LEARNING_DESK_CAPTURE_FIXTURE:fixture}});
 const page=await app.firstWindow();
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await size(app,page,1440,900);
 await statusOnline(page);
 await freezeMotion(page);
 const label=()=>page.locator('#check').evaluate(el=>el.querySelector('.label-full')?.textContent.trim()||el.innerText.trim());
 const attachments=()=>page.locator('#attachments .attachment').evaluateAll(els=>els.map(el=>el.querySelector('img')?.alt||el.textContent.trim()));
 const clearAttachments=async()=>{
  while(await page.locator('#attachments .attachment').count()){
   const before=await page.locator('#attachments .attachment').count();
   await page.locator('#attachments .attachment-remove').first().click();
   await page.waitForFunction(count=>document.querySelectorAll('#attachments .attachment').length<count,before,{timeout:5000});
  }
 };

 const openField=async()=>{
  await page.keyboard.press('ControlOrMeta+,');
  await page.waitForSelector('#settings-dialog[open]');
  await page.locator('#settings-tab-pastas').click();
  await page.locator('#cfg-conferir-choose').waitFor({state:'visible'});
 };
 const closeSettings=async(how='cancel')=>{
  if(how==='cancel')await page.locator('#settings-dialog button[value="cancel"]').last().click();
  else await page.keyboard.press('Escape');
  await page.waitForFunction(()=>!document.querySelector('#settings-dialog').open);
 };
 const openList=async()=>{
  await page.locator('#cfg-conferir-choose').click();
  await page.locator('#cfg-conferir-list').waitFor({state:'visible'});
  await page.waitForSelector('#cfg-conferir-list .check-row, #cfg-conferir-list .check-empty');
 };
 const appName=()=>page.locator('#cfg-conferir-app').textContent().then(t=>t.trim());
 const savedApp=async expected=>{
  await pollUntil(()=>desk().conferirApp??null,value=>JSON.stringify(value)===JSON.stringify(expected),{timeout:4000,what:'o app salvo em desk.json',onTimeout:'return'});
  assert.deepEqual(desk().conferirApp??null,expected,'o app salvo em desk.json');
 };

 /* ---------- 1. sem escolha, o botão e a captura são os do Xournal++ ---------- */
 assert.equal(await label(),'Conferir Xournal++','sem escolha o botão nomeia o Xournal++');
 assert.equal(await page.locator('#check-more').count(),0,'a caixa de mensagem não tem mais o ▾ do seletor');
 assert.equal(await page.locator('#check-pop').count(),0,'nem o popover do seletor');
 assert.equal(await page.locator('#check-note').isHidden(),true,'o aviso não aparece sozinho');
 await page.locator('#check').click();
 await page.waitForSelector('#attachments .attachment');
 assert.deepEqual(await attachments(),['Anexo: xournal.png'],'o anexo de sempre');
 await toastWait(page,'Captura do Xournal++ anexada');
 assert.equal(desk().conferirApp??null,null,'nada foi salvo: o padrão segue sem estado');
 await clearAttachments();

 /* ---------- 2. o campo nas Configurações: app de agora, Escolher…, lista ---------- */
 await openField();
 assert.equal(await page.locator('#cfg-conferir-label').textContent(),'Programa de escrita');
 assert.equal(await appName(),'Xournal++','o campo mostra o programa de agora');
 assert.equal(await page.locator('#cfg-conferir-choose').textContent(),'Escolher…');
 assert.equal(await page.locator('#cfg-conferir-back').isHidden(),true,'sem escolha salva não há "voltar ao Xournal++"');
 assert.match(await page.locator('#cfg-conferir-hint').textContent(),/Abra o programa e clique em Escolher…/);
 assert.equal(await page.locator('#cfg-conferir-list').isHidden(),true,'a lista não aparece sozinha');
 assert.equal(await page.locator('#cfg-conferir-choose').getAttribute('aria-expanded'),'false');
 await openList();
 assert.equal(await page.locator('#cfg-conferir-choose').getAttribute('aria-expanded'),'true');
 const rows=await page.locator('#cfg-conferir-list .check-row').evaluateAll(els=>els.map(el=>({
  app:el.querySelector('.check-row-app').textContent.trim(),
  title:el.querySelector('.check-row-title').textContent.trim(),
 })));
 assert.deepEqual(rows.map(r=>r.app),['OneNote','Safari','OneNote','Xournal++'],'ordem de frente para trás; sem Mesa, Dock nem janela minúscula');
 assert.equal(rows[0].title,'Caderno de Cálculo');
 assert.equal(rows.some(r=>/Mesa de Estudos|Dock|Documentos/.test(r.app+r.title)),false,'a Mesa e o sistema não são oferecidos');
 await reviewShot(page,out,'campo-lista-claro-1440.png');
 // Esc fecha só a lista? Não: Esc fecha as Configurações (descarta edições); a lista fecha ao escolher.
 await closeSettings('escape');
 assert.equal(await page.locator('#settings-dialog').evaluate(el=>el.open),false);

 /* ---------- 3. escolher uma janela vale na hora; Cancelar não desfaz ---------- */
 await openField();
 await openList();
 await page.locator('#cfg-conferir-list .check-row').first().click();
 await toastWait(page,'O Conferir vai usar OneNote');
 assert.equal(await appName(),'OneNote','o campo passa a mostrar o app escolhido');
 assert.equal(await page.locator('#cfg-conferir-list').isHidden(),true,'a lista fecha ao escolher');
 assert.equal(await page.locator('#cfg-conferir-back').isVisible(),true,'agora há como voltar ao Xournal++');
 assert.equal(await page.locator('#cfg-conferir-back').textContent(),'Voltar ao Xournal++');
 assert.equal(await page.locator('#attachments .attachment').count(),0,'escolher não anexa a imagem da captura de prova');
 await savedApp({app:'OneNote',key:'onenote'});
 assert.equal(JSON.stringify(desk().conferirApp).includes('103'),false,'o que fica salvo é o app, não o id da janela');
 assert.match(await page.locator('#settings-hint').textContent(),/O programa de escrita vale na hora/,'o aviso do rodapé diz que o programa vale na hora');
 await reviewShot(page,out,'campo-onenote-claro-1440.png');
 await closeSettings('cancel');
 assert.equal(await label(),'Conferir OneNote','Cancelar não desfaz: o botão nomeia o app escolhido');
 assert.equal(await page.locator('#check').getAttribute('title').then(t=>/OneNote/.test(t||'')),true,'a dica também nomeia o app');
 assert.deepEqual(desk().conferirApp,{app:'OneNote',key:'onenote'});
 await page.locator('#check').click();
 await page.waitForSelector('#attachments .attachment');
 assert.deepEqual(await attachments(),['Anexo: onenote.png'],'o anexo leva o nome do programa');
 await toastWait(page,'Captura de OneNote anexada');
 await reviewShot(page,out,'onenote-anexado-claro-1440.png');
 await clearAttachments();

 /* ---------- 4. a escolha é o APP: o id muda e o Conferir segue no OneNote ---------- */
 setWindows([win('901','Safari','Aula'),win('902','OneNote','Janela da frente agora'),win('903','OneNote','Atrás')]);
 await page.locator('#check').click();
 await page.waitForSelector('#attachments .attachment');
 assert.deepEqual(await attachments(),['Anexo: onenote.png']);
 await clearAttachments();

 /* ---------- 5. app ausente: uma frase, a saída leva ao campo, nada é capturado ---------- */
 setWindows([win('910','Safari','Aula'),win('911','Xournal++','Lista')]);
 await page.locator('#check').click();
 await page.locator('#check-note').waitFor({state:'visible'});
 assert.match(await page.locator('#check-note .check-note-text').textContent(),/^OneNote não está aberto/,'diz que o app não está aberto, em uma frase');
 assert.equal(await page.locator('#check-note .check-note-pick').textContent(),'Escolher outro programa…');
 /* #42: o texto do link começa na mesma margem da frase de cima (medido no texto, não na caixa do botão). */
 const indent=await page.evaluate(()=>{
  const textLeft=el=>{const range=document.createRange();range.selectNodeContents(el);return range.getClientRects()[0]?.left;};
  return {sentence:textLeft(document.querySelector('#check-note .check-note-text')),link:textLeft(document.querySelector('#check-note .check-note-pick'))};
 });
 assert.ok(Math.abs(indent.sentence-indent.link)<=0.6,`"Escolher outro programa…" alinhado à frase (${JSON.stringify(indent)})`);
 assert.equal(await page.locator('#attachments .attachment').count(),0,'nada foi anexado: nenhuma outra janela foi capturada');
 assert.equal(await label(),'Conferir OneNote','a escolha salva continua');
 await reviewShot(page,out,'onenote-ausente-claro-1440.png');
 await page.keyboard.press('Escape');
 await page.locator('#check-note').waitFor({state:'hidden'});
 await page.locator('#check').click();
 await page.locator('#check-note').waitFor({state:'visible'});
 await page.locator('#check-note .check-note-pick').click();
 await page.waitForSelector('#settings-dialog[open]');
 assert.equal(await page.locator('#settings-sec-pastas').isVisible(),true,'abre em Pastas e programas');
 assert.equal(await page.evaluate(()=>document.activeElement?.id),'cfg-conferir-choose','com o foco no Escolher…');
 assert.equal(await page.locator('#check-note').isHidden(),true,'o aviso sai de cena');

 /* ---------- 6. Voltar ao Xournal++ pelas Configurações ---------- */
 await page.locator('#cfg-conferir-back').click();
 await toastWait(page,'voltou ao Xournal++');
 assert.equal(await appName(),'Xournal++');
 assert.equal(await page.locator('#cfg-conferir-back').isHidden(),true);
 await closeSettings('cancel');
 assert.equal(await label(),'Conferir Xournal++');
 await savedApp(null);
 await page.locator('#check').click();
 await page.waitForSelector('#attachments .attachment');
 assert.deepEqual(await attachments(),['Anexo: xournal.png']);
 await clearAttachments();

 /* ---------- 7. Xournal++ fechado sem escolha: mesma frase de sempre + a saída ---------- */
 setWindows([win('920','Safari','Aula')]);
 await page.locator('#check').click();
 await page.locator('#check-note').waitFor({state:'visible'});
 assert.match(await page.locator('#check-note .check-note-text').textContent(),/^Abra a resolução no Xournal\+\+/);
 assert.equal(await page.locator('#check-note .check-note-pick').textContent(),'Escolher outro programa…');
 assert.equal(await page.locator('#attachments .attachment').count(),0);
 await page.keyboard.press('Escape');
 await page.locator('#check-note').waitFor({state:'hidden'});

 /* ---------- 8. a busca de comandos leva ao campo ---------- */
 await page.keyboard.press('ControlOrMeta+k');
 await page.locator('#command-palette .palette-input').fill('Escolher outra janela');
 await page.waitForFunction(()=>[...document.querySelectorAll('#command-palette .palette-item .label')].some(el=>el.textContent.includes('Escolher outra janela')));
 await nextFrames(page);
 await page.keyboard.press('Enter');
 await page.waitForSelector('#settings-dialog[open]');
 assert.equal(await page.locator('#settings-sec-pastas').isVisible(),true,'a busca de comandos abre em Pastas e programas');
 assert.equal(await page.evaluate(()=>document.activeElement?.id),'cfg-conferir-choose');
 await closeSettings('cancel');

 /* ---------- 9. nos dois temas, 1440×900 e 900×650: nada estoura ---------- */
 setWindows(FULL);
 await openField();
 await openList();
 await page.locator('#cfg-conferir-list .check-row').nth(1).click(); // Safari
 await toastWait(page,'O Conferir vai usar Safari');
 await closeSettings('cancel');
 assert.equal(await label(),'Conferir Safari');
 await page.locator('#check').click();
 await page.waitForSelector('#attachments .attachment');
 for(const [theme,width,height] of [['light',1440,900],['dark',1440,900],['light',900,650],['dark',900,650]]){
  await setTheme(page,theme);
  await size(app,page,width,height);
  await layoutStable(page,'#composer-box');
  const tag=`${theme}-${width}x${height}`;
  const viewport={left:0,top:0,right:width,bottom:height};
  const scroll=await page.evaluate(()=>({sw:document.documentElement.scrollWidth,w:innerWidth}));
  assert.ok(scroll.sw<=scroll.w+1,`${tag}: sem rolagem horizontal da página`);
  const row=await page.evaluate(()=>{
   const el=document.querySelector('.composer-actions');
   const kids=[...el.children].filter(k=>!k.hidden&&k.getBoundingClientRect().width>0);
   const boxes=kids.map(k=>k.getBoundingClientRect());
   return {over:el.scrollWidth-el.clientWidth,overlap:boxes.some((a,i)=>i&&a.left<boxes[i-1].right-0.5)};
  });
  assert.ok(row.over<=1,`${tag}: a fileira de ações não estoura (${row.over}px)`);
  assert.equal(row.overlap,false,`${tag}: os botões da fileira não se sobrepõem`);
  const check=await rect(page,'#check'),box=await rect(page,'#composer-box');
  assert.ok(check.left>=box.left-0.5&&check.right<=box.right+0.5&&check.top>=box.top-0.5&&check.bottom<=box.bottom+0.5,`${tag}: #check dentro da caixa`);
  assert.match(await page.locator('#check').evaluate(el=>(el.getAttribute('aria-label')||el.innerText).trim()),/Conferir/,`${tag}: segue nomeado`);
  await reviewShot(page,out,`caixa-safari-${tag}.png`);

  // o campo e a lista cabem na janela, sem estourar
  await openField();
  await openList();
  const dlg=await rect(page,'#settings-dialog');
  assert.ok(dlg.left>=viewport.left-0.5&&dlg.right<=viewport.right+0.5&&dlg.top>=viewport.top-0.5&&dlg.bottom<=viewport.bottom+0.5,`${tag}: Configurações dentro da janela`);
  const fieldBox=await rect(page,'#cfg-conferir');
  const body=await rect(page,'#settings-body');
  assert.ok(fieldBox.left>=body.left-0.5&&fieldBox.right<=body.right+0.5,`${tag}: o campo cabe na largura da seção`);
  const over=await page.evaluate(()=>['#cfg-conferir','#cfg-conferir-list','#settings-body'].map(sel=>{const el=document.querySelector(sel);return el.scrollWidth-el.clientWidth;}));
  assert.ok(over.every(n=>n<=1),`${tag}: nada estoura na largura (${over})`);
  const chooseBox=await rect(page,'#cfg-conferir-choose'),appBox=await rect(page,'#cfg-conferir-app');
  assert.ok(chooseBox.height>=28&&appBox.height>=28,`${tag}: alvos de pelo menos 28px`);
  assert.ok(appBox.right<=chooseBox.left+1,`${tag}: o programa e o Escolher… não se sobrepõem`);
  await page.locator('#cfg-conferir-list').scrollIntoViewIfNeeded();
  await reviewShot(page,out,`campo-lista-${tag}.png`);
  await closeSettings('cancel');
 }
 assert.deepEqual(errors,[],'nenhum erro de página');
});
