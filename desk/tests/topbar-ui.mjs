import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {withArtifacts,launchDesk,newRuntime,seedCourse,writeConfigJson,statusOnline,screenshotDirectory,setTheme,freezeMotion,tinyPdf,tutorMore,resizeWindow} from './helpers.mjs';
import {HEADER,near,settle} from './layout-measure.mjs';
import {nextFrames} from './waits.mjs';

/* Barra superior (ticket #10 da spec de redesenho): marca, abas de matéria
   (com Livre), Caderno, GeoGebra, menu Estudar, campo da busca de comandos e o
   botão Ajustes, nessa ordem. As ferramentas de estudo moram no menu Estudar e
   cada uma abre como antes; Ajustes reúne Configurações, Ajuda, Atalhos e
   Sobre; o ciclo de tema saiu da barra e tudo o que saiu da tela principal se
   acha na busca de comandos pelo nome. Em janela estreita as abas viram um
   seletor único. Mede e age na janela real, nos dois temas, em 1440×900 e
   900×650. As imagens ficam numa pasta `barra-…` de desk/tests/artifacts. */

const SHOT_DIR=screenshotDirectory('barra');
const WIDE=[1440,900],MINIMUM=[900,650];
const THEMES=[['light','claro'],['dark','escuro']];

const STUDY_IDS=['study-search-open','study-review-today','study-notes-open','study-stats-open','study-backup-open','study-share-open','study-tutor-pdf','xournal','reference-toggle'];
const STUDY_LABELS=['Buscar estudos','Revisar hoje','Anotações','Estatísticas','Backup','Compartilhar','PDF pelo tutor','Xournal++','Formulário'];
const SETTINGS_LABELS=['Configurações','Ajuda','Atalhos','Sobre'];

async function setSize(app,page,[width,height]){
 await resizeWindow(app,page,width,height);
 await settle(page);
}
async function shot(page,name){
 await page.mouse.move(2,2);
 await page.screenshot({path:path.join(SHOT_DIR,name)});
}

async function openDesk(ctx,tag,{desk={}}={}){
 const runtime=ctx.runtime=newRuntime(tag);
 const calculo=seedCourse(runtime,'Calculo'),fisica=seedCourse(runtime,'Fisica');
 fs.writeFileSync(path.join(calculo,'Limites.pdf'),tinyPdf('Limites pagina 1'));
 fs.writeFileSync(path.join(calculo,'Formulario.pdf'),tinyPdf('Formulario pagina 1'));
 fs.writeFileSync(path.join(fisica,'Cinematica.pdf'),tinyPdf('Cinematica pagina 1'));
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'Calculo',name:'Cálculo I',path:calculo},{id:'Fisica',name:'Física I',path:fisica}],desk:{pinnedExtensions:false,...desk}});
 ctx.app=await launchDesk({runtime});
 const page=await ctx.app.firstWindow();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await statusOnline(page);
 await page.waitForSelector('.pdf-panel canvas',{timeout:25000});
 await freezeMotion(page);
 return {page,errors};
}

/* A barra superior medida de uma vez: cada controle à vista, na ordem em que
   o usuário os encontra. */
function barra(page){
 return page.evaluate(()=>{
  const shown=el=>{if(!el)return false;const cs=getComputedStyle(el),r=el.getBoundingClientRect();return r.width>0&&r.height>0&&cs.visibility!=='hidden'&&cs.display!=='none';};
  const rect=el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};};
  const header=document.querySelector('header');
  const q=sel=>{const el=header.querySelector(sel);return shown(el)?{...rect(el),text:(el.textContent||'').trim(),label:el.getAttribute('aria-label')||''}:null;};
  const tabs=[...header.querySelectorAll('#course-tabs button[role=tab]')].filter(shown).filter(el=>el.id!=='review-tab'&&el.dataset.id!=='geogebra').map(el=>({...rect(el),text:el.textContent.trim(),active:el.classList.contains('active')}));
  const controls=[...header.querySelectorAll('button,select,input')].filter(shown).map(el=>({id:el.id,left:rect(el).left,right:rect(el).right,top:rect(el).top,bottom:rect(el).bottom,label:el.getAttribute('aria-label')||el.textContent.trim()}));
  return {
   header:rect(header),headerScroll:header.scrollWidth-header.clientWidth,docScroll:document.documentElement.scrollWidth-innerWidth,
   brand:q('.brand-icon'),tabs,selector:q('#course-menu .nav-trigger'),
   review:q('#review-tab'),reviewCount:q('#review-count'),ggb:q('#course-tabs [data-id=geogebra]'),
   study:q('#study-menu .nav-trigger'),palette:q('#palette-field'),ajustes:q('#settings-menu .nav-trigger'),
   notice:q('#update-notice'),controls,
   legacy:{mesaMenu:!!document.querySelector('#mesa-menu'),themeCycle:!!document.querySelector('#theme-cycle'),toolsBar:!!document.querySelector('#study-tools-bar'),pdfBar:!!document.querySelector('#course-pdf-bar')},
   triggers:[...document.querySelectorAll('header .nav-trigger')].filter(shown).map(el=>(el.getAttribute('aria-label')||el.textContent).trim())
  };
 });
}

function assertInOrder(items,label){
 const named=items.filter(([,box])=>box);
 for(let i=1;i<named.length;i++){
  const [prevName,prev]=named[i-1],[name,box]=named[i];
  assert.ok(box.left>=prev.right-.5,`${label}: ${name} vem depois de ${prevName} (${box.left} >= ${prev.right})`);
 }
}

function assertBar(bar,label,{narrow}){
 assert.ok(near(bar.header.height,HEADER,.6),`${label}: barra superior de ${HEADER}px (${bar.header.height})`);
 assert.deepEqual(bar.legacy,{mesaMenu:false,themeCycle:false,toolsBar:false,pdfBar:false},`${label}: sem menu Mesa, sem botão de tema, sem faixa de ferramentas nem faixa "PDF pelo tutor"`);
 assert.ok(!bar.triggers.some(t=>/^Mesa$/i.test(t)),`${label}: nenhum menu chamado Mesa (${bar.triggers})`);
 assert.deepEqual(bar.triggers.slice(-2),['Estudar','Ajustes'],`${label}: os menus da barra são Estudar e Ajustes (${bar.triggers})`);
 assert.equal(bar.triggers.length,narrow?3:2,`${label}: ${narrow?'seletor, Estudar e Ajustes':'Estudar e Ajustes'}`);
 assert.ok(bar.study&&/Estudar/.test(bar.study.text),`${label}: menu Estudar à vista`);
 assert.ok(bar.ajustes&&bar.ajustes.label==='Ajustes',`${label}: botão Ajustes com nome acessível (${bar.ajustes?.label})`);
 assert.ok(bar.palette,`${label}: campo da busca de comandos à vista`);
 assert.ok(bar.review&&/^Caderno/.test(bar.review.text),`${label}: Caderno à vista`);
 assert.ok(bar.reviewCount&&/^\d+$/.test(bar.reviewCount.text),`${label}: a contagem de revisar hoje continua no Caderno (${bar.reviewCount?.text})`);
 assert.ok(bar.ggb&&/GeoGebra/.test(bar.ggb.text),`${label}: GeoGebra à vista`);
 if(narrow){
  assert.equal(bar.tabs.length,0,`${label}: janela estreita não mostra as abas de matéria`);
  assert.ok(bar.selector,`${label}: as abas viram um seletor único`);
 }else{
  assert.ok(bar.tabs.length>=3,`${label}: abas de matéria (Livre, Cálculo I, Física I) à vista (${bar.tabs.map(t=>t.text)})`);
  assert.equal(bar.selector,null,`${label}: sem seletor com a janela larga`);
 }
 assertInOrder([
  ['marca',bar.brand],
  narrow?['seletor de matéria',bar.selector]:['abas de matéria',bar.tabs.at(-1)],
  ['Caderno',bar.review],['GeoGebra',bar.ggb],['Estudar',bar.study],['busca de comandos',bar.palette],['Ajustes',bar.ajustes]
 ],label);
 if(!narrow){
  const first=bar.tabs[0];
  assert.ok(first.right<=bar.review.left,`${label}: as abas vêm antes do Caderno`);
 }
 /* #27 B10: busca de 168px com "Buscar…" e ⌘K; em janela estreita vira só o ícone,
    com o nome acessível "Buscar ações". */
 assert.equal(bar.palette.label,'Buscar ações',`${label}: a busca guarda o nome acessível`);
 if(narrow){
  assert.ok(bar.palette.width<=30,`${label}: a busca vira só o ícone (${bar.palette.width}px)`);
 }else{
  assert.ok(near(bar.palette.width,168,1.5),`${label}: a busca tem 168px (${bar.palette.width})`);
  assert.match(bar.palette.text,/^Buscar…/,`${label}: o campo diz "Buscar…" (${bar.palette.text})`);
 }
 /* Nada sai da janela nem gera rolagem horizontal. */
 assert.ok(bar.headerScroll<=0,`${label}: a barra não rola na horizontal (${bar.headerScroll})`);
 assert.ok(bar.docScroll<=0,`${label}: a página não rola na horizontal (${bar.docScroll})`);
 for(const control of bar.controls){
  assert.ok(control.left>=-.5&&control.right<=bar.header.right+.5,`${label}: ${control.id||control.label} dentro da janela (${control.left}..${control.right} de ${bar.header.right})`);
  assert.ok(control.top>=bar.header.top-.5&&control.bottom<=bar.header.bottom+.5,`${label}: ${control.id||control.label} dentro da altura da barra`);
 }
 /* O último controle encosta no recuo de 12px (o ícone compensa a folga). */
 assert.ok(bar.ajustes.right<=bar.header.right-6+.5,`${label}: Ajustes respeita o recuo da borda (${bar.header.right-bar.ajustes.right})`);
}

async function openMenu(page,id){
 const menu=page.locator(id);
 if(!(await menu.evaluate(el=>el.classList.contains('open'))))await menu.locator('.nav-trigger').click();
 await page.waitForSelector(`${id}.open .nav-pop`);
}
async function itemIds(page,id){
 return page.locator(`${id} .nav-pop button[role=menuitem]`).evaluateAll(list=>list.filter(el=>!el.hidden&&el.getClientRects().length).map(el=>el.id));
}
async function itemTexts(page,id){
 return page.locator(`${id} .nav-pop button[role=menuitem]`).evaluateAll(list=>list.filter(el=>!el.hidden&&el.getClientRects().length).map(el=>{const copy=el.cloneNode(true);copy.querySelectorAll('.menu-kbd').forEach(k=>k.remove());return copy.textContent.trim();}));
}
async function closeDialog(page,selector){
 await page.keyboard.press('Escape');
 await page.waitForFunction(sel=>!document.querySelector(sel)?.open,selector,{timeout:5000});
}
async function paletteLabels(page){
 await page.waitForSelector('#command-palette:not([hidden]) .palette-input');
 return page.locator('#command-palette .palette-item').evaluateAll(list=>list.map(el=>({text:el.textContent.replace(/\s+/g,' ').trim(),disabled:el.getAttribute('aria-disabled')==='true'})));
}
async function searchPalette(page,text){
 const input=page.locator('#command-palette .palette-input');
 await input.fill('');
 await input.fill(text);
 /* A lista é redesenhada a cada tecla: espera assentar antes de ler. */
 await nextFrames(page,3);
 await page.waitForFunction(()=>document.querySelectorAll('#command-palette .palette-item').length>0,undefined,{timeout:1500}).catch(()=>{});
 return paletteLabels(page);
}

await withArtifacts('barra-superior',async ctx=>{
 const {page,errors}=await openDesk(ctx,'barra-superior');

 /* Ordem, altura e nada fora da tela, nos dois temas e nos dois tamanhos. */
 for(const [theme,tag] of THEMES){
  await setTheme(page,theme);
  await setSize(ctx.app,page,WIDE);
  assertBar(await barra(page),`${tag} 1440x900`,{narrow:false});
  await shot(page,`barra-${tag}-1440x900.png`);
  await setSize(ctx.app,page,MINIMUM);
  assertBar(await barra(page),`${tag} 900x650`,{narrow:true});
  await shot(page,`barra-${tag}-900x650.png`);
 }
 await setTheme(page,'light');
 await setSize(ctx.app,page,WIDE);

 /* Pior caso: o aviso de atualização na barra, com a janela mínima. */
 await page.evaluate(()=>{const n=document.querySelector('#update-notice');n.hidden=false;n.textContent='Atualizar para v9.9.9';});
 assertBar(await barra(page),'com aviso de atualização 1440x900',{narrow:false});
 await setSize(ctx.app,page,MINIMUM);
 const withNotice=await barra(page);
 assertBar(withNotice,'com aviso de atualização 900x650',{narrow:true});
 assert.ok(withNotice.notice,'o aviso de atualização continua visível na barra');
 assertInOrder([['aviso',withNotice.notice],['Estudar',withNotice.study]],'aviso de atualização');
 await shot(page,'barra-aviso-900x650.png');
 await page.evaluate(()=>{const n=document.querySelector('#update-notice');n.hidden=true;n.textContent='';});
 await setSize(ctx.app,page,WIDE);

 /* Menu Estudar: itens, ordem e cada ação como era na faixa. */
 await openMenu(page,'#study-menu');
 assert.deepEqual(await itemIds(page,'#study-menu'),STUDY_IDS,'itens do menu Estudar na ordem');
 assert.deepEqual(await itemTexts(page,'#study-menu'),STUDY_LABELS,'rótulos do menu Estudar');
 /* #27 B8: menu de 256px e a tecla da busca à direita do rótulo. */
 const studyBox=await page.evaluate(()=>{
  const pop=document.querySelector('#study-pop').getBoundingClientRect();
  const kbd=document.querySelector('#study-pop .menu-kbd');
  const item=document.querySelector('#study-search-open').getBoundingClientRect();
  const k=kbd?kbd.getBoundingClientRect():null;
  return {width:pop.width,kbd:kbd?kbd.textContent.trim():null,kbdRight:k?item.right-k.right:null,kbdW:k?k.width:0};
 });
 assert.ok(near(studyBox.width,256,1.5),`o menu Estudar tem 256px (${studyBox.width})`);
 assert.match(studyBox.kbd||'',/⇧F$|Shift\+F$/,`a busca de estudos mostra a tecla (${studyBox.kbd})`);
 assert.ok(studyBox.kbdW>0&&studyBox.kbdRight<=14,`a tecla fica à direita da linha (${studyBox.kbdRight}px da borda)`);
 await shot(page,'estudar-claro-1440x900.png');
 await setTheme(page,'dark');
 await shot(page,'estudar-escuro-1440x900.png');
 await setTheme(page,'light');
 await setSize(ctx.app,page,MINIMUM);
 await openMenu(page,'#study-menu');
 const pop=await page.locator('#study-pop').boundingBox();
 assert.ok(pop.x>=0&&pop.x+pop.width<=900&&pop.y>=0&&pop.y+pop.height<=650,`o menu Estudar cabe em 900x650 (${JSON.stringify(pop)})`);
 await shot(page,'estudar-claro-900x650.png');
 await page.keyboard.press('Escape');
 await setSize(ctx.app,page,WIDE);

 /* #67: teclado no menu Estudar. Seta abre e entra no item, as setas dão a
    volta e o Esc devolve o foco ao gatilho (antes ia para o body). */
 const focusedId=()=>page.evaluate(()=>document.activeElement?.id||document.activeElement?.className||document.activeElement?.tagName);
 const studyIds=async()=>{await openMenu(page,'#study-menu');const ids=await itemIds(page,'#study-menu');await page.keyboard.press('Escape');return ids;};
 const ids=await studyIds();
 await page.locator('#study-menu .nav-trigger').focus();
 await page.keyboard.press('ArrowDown');
 await page.waitForSelector('#study-menu.open .nav-pop');
 assert.equal(await focusedId(),ids[0],'seta para baixo abre o menu no primeiro item');
 await page.keyboard.press('ArrowUp');
 assert.equal(await focusedId(),ids.at(-1),'seta para cima no primeiro dá a volta ao último');
 await page.keyboard.press('Home');
 assert.equal(await focusedId(),ids[0],'Home vai ao primeiro');
 await page.keyboard.press('Escape');
 await page.waitForFunction(()=>!document.querySelector('#study-menu').classList.contains('open'));
 assert.equal(await page.evaluate(()=>document.activeElement===document.querySelector('#study-menu .nav-trigger')),true,'Esc devolve o foco ao gatilho');

 const runItem=async(id,expect,close)=>{
  await openMenu(page,'#study-menu');
  await page.locator(`#study-menu #${id}`).click();
  await expect();
  assert.equal(await page.locator('#study-menu').evaluate(el=>el.classList.contains('open')),false,`${id}: o menu fecha ao escolher`);
  if(close)await close();
 };
 await runItem('study-search-open',()=>page.waitForSelector('#study-search-dialog[open]'),()=>closeDialog(page,'#study-search-dialog'));
 await runItem('study-notes-open',()=>page.waitForSelector('#study-notes-dialog[open]'),()=>closeDialog(page,'#study-notes-dialog'));
 await runItem('study-stats-open',()=>page.waitForSelector('#study-stats-dialog[open]'),()=>closeDialog(page,'#study-stats-dialog'));
 await runItem('study-backup-open',()=>page.waitForSelector('#mesa-backup-panel[open]'),()=>closeDialog(page,'#mesa-backup-panel'));
 await runItem('study-share-open',()=>page.waitForSelector('#mesa-backup-panel[open]'),()=>closeDialog(page,'#mesa-backup-panel'));
 await runItem('study-tutor-pdf',()=>page.waitForSelector('#tutor-pdf-dialog[open]'),()=>closeDialog(page,'#tutor-pdf-dialog'));
 /* O Encerrar por hoje saiu do menu Estudar: é do Mais opções do tutor e segue na busca de comandos. */
 assert.equal(await page.locator('#study-menu #end-day').count(),0,'o Encerrar não é mais item do menu Estudar');
 await tutorMore(page,'#end-day').click();
 await page.waitForSelector('#end-day-dialog[open]');
 await closeDialog(page,'#end-day-dialog');
 await page.keyboard.press('ControlOrMeta+k');
 await paletteLabels(page);
 assert.ok((await searchPalette(page,'Encerrar')).some(h=>/Encerrar por hoje/.test(h.text)),'Encerrar por hoje continua na busca de comandos');
 await page.keyboard.press('Escape');
 await runItem('study-review-today',()=>page.waitForFunction(()=>document.querySelector('#review-tab')?.classList.contains('active')&&document.querySelector('#review-view')?.hidden===false),undefined);
 assert.ok(await page.locator('#review-view').isVisible(),'Revisar hoje abre o Caderno');
 await page.locator('#course-tabs button[data-id=Calculo]').click();
 await page.waitForFunction(()=>document.querySelector('#review-view')?.hidden===true);

 /* Caderno e GeoGebra continuam na barra e alternam a área de estudo. */
 await page.locator('#review-tab').click();
 await page.waitForFunction(()=>document.querySelector('#review-tab')?.getAttribute('aria-selected')==='true');
 await page.locator('#course-tabs [data-id=geogebra]').click();
 await page.waitForFunction(()=>document.querySelector('#course-tabs [data-id=geogebra]')?.getAttribute('aria-selected')==='true'&&document.querySelector('#review-tab')?.getAttribute('aria-selected')==='false');
 await page.locator('#course-tabs button[data-id=Calculo]').click();
 await page.waitForFunction(()=>document.querySelector('#course-tabs button[data-id=Calculo]')?.getAttribute('aria-selected')==='true');

 /* Ajustes: Configurações, Ajuda, Atalhos e Sobre — e nada além. */
 await openMenu(page,'#settings-menu');
 assert.deepEqual(await itemTexts(page,'#settings-menu'),SETTINGS_LABELS,'itens do menu Ajustes');
 await shot(page,'ajustes-claro-1440x900.png');
 await setTheme(page,'dark');
 await shot(page,'ajustes-escuro-1440x900.png');
 await setTheme(page,'light');
 await page.keyboard.press('Escape');
 const settingsItem=async(label,dialog)=>{
  await openMenu(page,'#settings-menu');
  await page.locator('#settings-menu .nav-pop button',{hasText:new RegExp(`^\\s*${label}\\s*$`)}).click();
  await page.waitForSelector(`${dialog}[open]`);
  assert.equal(await page.locator('#settings-menu').evaluate(el=>el.classList.contains('open')),false,`${label}: o menu fecha ao escolher`);
  await closeDialog(page,dialog);
 };
 await settingsItem('Configurações','#settings-dialog');
 /* A Ajuda descreve o app como ele é: nada da barra de abas de apoio, do seletor
    de motor, do painel Ajustes nem de Encerrar por hoje no menu Estudar. */
 await openMenu(page,'#settings-menu');
 await page.locator('#settings-menu .nav-pop button',{hasText:/^\s*Ajuda\s*$/}).click();
 await page.waitForSelector('#help-dialog[open]');
 const helpText=await page.locator('#help-dialog').innerText();
 for(const stale of [/barra acima dos leitores/,/seletor\s+Pi \/ Claude Code/,/painel\s+Ajustes/,/No menu\s+Estudar,\s+Encerrar por hoje/,/Ajustes → Contexto da sessão/,/seta no topo/,/seletor ao lado de/,/como no seletor/,/menu\s+Mesa/])
  assert.doesNotMatch(helpText,stale,`a Ajuda não cita o que saiu do app: ${stale}`);
 await closeDialog(page,'#help-dialog');
 await settingsItem('Ajuda','#help-dialog');
 await settingsItem('Atalhos','#keys-dialog');
 await settingsItem('Sobre','#about-dialog');

 /* A busca de comandos: o campo da barra abre; cada ação que saiu da tela se
    acha pelo nome e executa. */
 await page.locator('#palette-field').click();
 await paletteLabels(page);
 await page.keyboard.press('Escape');
 await page.waitForFunction(()=>document.querySelector('#command-palette')?.hidden!==false);
 await page.keyboard.press('ControlOrMeta+k');
 await paletteLabels(page);
 const reachable=[
  ['Buscar estudos','Buscar estudos'],['Revisar hoje','Revisar hoje'],['Anotações','Anotações'],['Estatísticas','Estatísticas'],
  ['Backup','Backup'],['Compartilhar','Compartilhar'],['PDF pelo tutor','PDF pelo tutor'],['Xournal','Xournal++'],
  ['Configurações','Configurações'],['Ajuda','Ajuda'],['Atalhos','Atalhos'],['Sobre','Sobre'],
  ['Caderno','Caderno de revisão'],['GeoGebra','GeoGebra'],['Tema claro','Tema claro'],['Tema escuro','Tema escuro'],['Tema autom','Tema automático']
 ];
 for(const [query,label] of reachable){
  const hits=await searchPalette(page,query);
  assert.ok(hits.some(h=>h.text.includes(label)&&!h.disabled),`a busca de comandos acha "${label}" (${JSON.stringify(hits.map(h=>h.text))})`);
 }
 await shot(page,'busca-de-comandos-claro-1440x900.png');
 await searchPalette(page,'Tema escuro');
 await page.keyboard.press('Enter');
 await page.waitForFunction(()=>document.documentElement.dataset.theme==='dark');
 await page.waitForFunction(()=>document.querySelector('#command-palette')?.hidden!==false);
 await page.keyboard.press('ControlOrMeta+k');
 await paletteLabels(page);
 await searchPalette(page,'Tema claro');
 await page.keyboard.press('Enter');
 await page.waitForFunction(()=>document.documentElement.dataset.theme==='light');
 await page.keyboard.press('ControlOrMeta+k');
 await paletteLabels(page);
 await searchPalette(page,'Estatísticas');
 await page.keyboard.press('Enter');
 await page.waitForSelector('#study-stats-dialog[open]');
 await closeDialog(page,'#study-stats-dialog');

 /* Janela estreita: o seletor lista as matérias e troca a ativa. */
 await setSize(ctx.app,page,MINIMUM);
 await page.locator('#course-menu .nav-trigger').click();
 await page.waitForSelector('#course-menu.open .nav-pop');
 assert.deepEqual(await itemTexts(page,'#course-menu'),['Livre','Cálculo I','Física I'],'o seletor lista as matérias na ordem das abas');
 await shot(page,'seletor-claro-900x650.png');
 await page.locator('#course-menu .nav-pop button',{hasText:/^\s*Física I\s*$/}).click();
 await page.waitForFunction(()=>/Física I/.test(document.querySelector('#course-menu .nav-trigger')?.textContent||''),undefined,{timeout:15000});
 assert.equal(await page.locator('#course-menu').evaluate(el=>el.classList.contains('open')),false,'o seletor fecha ao escolher');
 await page.waitForSelector('#course-tabs button[data-id=Fisica].active',{state:'attached'});
 await setSize(ctx.app,page,WIDE);

 assert.deepEqual(errors,[],'nenhum erro de página');
});

/* Recursos desligados no config.json somem dos menus e da busca. */
await withArtifacts('barra-superior-flags',async ctx=>{
 const {page,errors}=await openDesk(ctx,'barra-superior-flags',{desk:{xournal:false,endDay:false}});
 await openMenu(page,'#study-menu');
 assert.deepEqual(await itemIds(page,'#study-menu'),STUDY_IDS.filter(id=>id!=='xournal'),'xournal desligado some do menu Estudar');
 await page.keyboard.press('Escape');
 await page.locator('#chat-more').click();
 assert.equal(await page.locator('#chat-more-pop #end-day').isHidden(),true,'endDay desligado some do Mais opções do tutor');
 await page.keyboard.press('Escape');
 await page.keyboard.press('ControlOrMeta+k');
 await paletteLabels(page);
 const xournal=await searchPalette(page,'Xournal');
 assert.ok(!xournal.some(h=>/Abrir Xournal/.test(h.text)),'Xournal++ desligado some da busca de comandos');
 assert.deepEqual(errors,[],'nenhum erro de página');
});
