import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {_electron as electron} from '@playwright/test';
import {DESK,FAKE_PI,deskEnv,newRuntime,seedCourse,tinyPdf,writeConfigJson,withArtifacts,screenshotDirectory,setTheme,freezeMotion,resizeWindow} from './helpers.mjs';
import {layoutStable,pollUntil} from './waits.mjs';

/* Configurações com seções na lateral (ticket #20 da spec de redesenho): mede e
   exercita na janela real, nos dois temas e em 1440×900 e 900×650, o que o
   usuário vê — as cinco seções, a abertura em Matérias, o inventário de campos,
   Salvar que aplica, Cancelar/Esc que descartam as edições de todas as seções,
   o erro ao lado do campo que leva à seção dele, os campos extras dos leitores,
   tema e acento na hora, o recuo de 16px e o item selecionado em cinza neutro.
   Roda com userData isolado (o `config.json` do usuário nunca é tocado). As
   imagens saem em `desk/tests/artifacts/configuracoes-…` para olho humano; não
   são asserção. */

const SHOT_DIR=screenshotDirectory('configuracoes');
const SIZES=[[1440,900],[900,650]];
const SECTIONS=['materias','leitores','mesa','avisos','pastas'];
const LABELS=['Matérias','Leitores','Recursos da mesa','Aparência e avisos','Pastas e programas'];
const FLAGS=['endDay','studyContext','calculator','xournal','conferir','refsToggle'];

/* Todo campo das Configurações de antes, e a seção em que ele mora agora. */
const INVENTORY={
 materias:['#cfg-courses','#cfg-add-course'],
 leitores:['#cfg-layout','#layout-presets-open'],
 mesa:['#cfg-title',...FLAGS.map(key=>'#cfg-desk-'+key)],
 avisos:['#ui-language','#tutor-language','#theme-mode','#accent-mode','#density-mode','#notify-sound','#notify-desktop','#notify-focused'],
 pastas:['#cfg-vault','#cfg-vault-browse','#cfg-pi','#cfg-pi-detect','#cfg-pi-browse','#cfg-claude','#cfg-claude-browse','#cfg-xournal','#cfg-xournal-browse','#cfg-opencode-key','#cfg-opencode-save','#cfg-opencode-create']
};

const rgb=text=>{
 const m=/^rgba?\(([^)]+)\)$/.exec(String(text).trim());
 assert.ok(m,`cor legível (${text})`);
 return m[1].split(/[,\s/]+/).filter(Boolean).map(Number).slice(0,3);
};

await withArtifacts('configuracoes-secoes',async ctx=>{
 const runtime=ctx.runtime=newRuntime('settings-sections');
 const courseA=seedCourse(runtime,'A'),courseB=seedCourse(runtime,'B'),courseC=seedCourse(runtime,'C');
 fs.writeFileSync(path.join(courseA,'Limites.pdf'),tinyPdf('Exercise',6));
 fs.writeFileSync(path.join(courseA,'Formulario.pdf'),tinyPdf('Formula',2));
 const panels=[
  {label:'Enunciado',prefer:['Limites'],extraDoLeitor:'um'},
  {label:'Apoio',prefer:['Formul'],toggle:'Formulário',outroExtra:{n:2}}
 ];
 writeConfigJson(runtime,{
  runtimePath:runtime,vaultPath:runtime,
  courses:[{id:'A',name:'Cálculo',path:courseA},{id:'B',name:'Física',path:courseB}],
  desk:{title:'Mesa de teste',panels,campoExtraDoDesk:'preservado'}
 });
 const configFile=path.join(runtime,'config.json');
 const readConfig=()=>JSON.parse(fs.readFileSync(configFile,'utf8'));
 // userData temporário: a persistência normal (o override de runtime dos
 // smokes comuns deliberadamente não grava configurações).
 const entry=path.join(runtime,'entry.cjs');
 fs.writeFileSync(entry,`require('electron').app.setPath('userData',__dirname);require(${JSON.stringify(path.join(DESK,'main.cjs'))});`);
 fs.chmodSync(FAKE_PI,0o755);
 const launch=()=>{
  const env=deskEnv(runtime);delete env.LEARNING_DESK_RUNTIME;
  return electron.launch({args:[entry],cwd:DESK,env});
 };

 ctx.app=await launch();
 let page=await ctx.app.firstWindow();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.waitForSelector('.pdf-panel canvas',{timeout:30000});
 await freezeMotion(page);

 const open=async()=>{
  await page.keyboard.press('ControlOrMeta+,');
  await page.waitForSelector('#settings-dialog[open]');
 };
 const cancel=async()=>{
  await page.locator('#settings-dialog button[value="cancel"]').last().click();
  await page.waitForFunction(()=>!document.querySelector('#settings-dialog').open);
 };
 const escape=async()=>{
  await page.keyboard.press('Escape');
  await page.waitForFunction(()=>!document.querySelector('#settings-dialog').open);
 };
 const tab=id=>page.locator(`#settings-tab-${id}`).click();
 const current=()=>page.evaluate(()=>document.querySelector('#settings-tabs [aria-current="page"]')?.dataset.sec??null);
 const visibleSections=()=>page.evaluate(()=>[...document.querySelectorAll('#settings-body > [data-sec]')].filter(el=>!el.hidden).map(el=>el.dataset.sec));
 const save=async()=>{
  await page.locator('#settings-save').click();
  await page.waitForFunction(()=>!document.querySelector('#settings-dialog').open,undefined,{timeout:15000});
  await page.waitForSelector('.pdf-panel',{timeout:15000});
 };
 const setSize=async([width,height])=>{
  await resizeWindow(ctx.app,page,width,height);
  await layoutStable(page,'main');
 };
 /* Capturas não levam caminho real: os campos de pasta mostram só o nome da
    última pasta durante o clique da foto e voltam ao valor depois. */
 const shot=async name=>{
  const masked=await page.evaluate(()=>[...document.querySelectorAll('#settings-form input')].filter(i=>i.value.startsWith('/')||/^[A-Za-z]:[\\/]/.test(i.value)).map(i=>{const real=i.value;i.value='…/'+real.split(/[\\/]/).filter(Boolean).pop();return [i.id,[...document.querySelectorAll('#settings-form input')].indexOf(i),real];}));
  await page.screenshot({path:path.join(SHOT_DIR,name)});
  await page.evaluate(items=>{const inputs=[...document.querySelectorAll('#settings-form input')];for(const [,index,real] of items)inputs[index].value=real;},masked);
 };
 const values=()=>page.evaluate(()=>({
  rows:[...document.querySelectorAll('#cfg-courses .cfg-course')].map(r=>[r.querySelector('.cfg-name').value,r.querySelector('.cfg-path').value]),
  label1:document.querySelector('#cfg-layout-label-1')?.value??null,
  title:document.querySelector('#cfg-title').value,
  flags:Object.fromEntries(['endDay','studyContext','calculator','xournal','conferir','refsToggle'].map(k=>[k,document.querySelector('#cfg-desk-'+k).checked])),
  vault:document.querySelector('#cfg-vault').value,pi:document.querySelector('#cfg-pi').value,
  claude:document.querySelector('#cfg-claude').value,xournal:document.querySelector('#cfg-xournal').value
 }));

 /* ---- 1. Abre em Matérias, com as cinco seções na lateral ---- */
 assert.deepEqual(await page.evaluate(()=>{const ids=[...document.querySelectorAll('[id]')].map(el=>el.id);return ids.filter((id,i)=>ids.indexOf(id)!==i);}),[],'IDs únicos');
 await open();
 assert.equal(await page.locator('#settings-title').textContent(),'Configurações');
 assert.deepEqual(await page.locator('#settings-tabs .settings-tab').evaluateAll(list=>list.map(el=>el.textContent.trim())),LABELS,'cinco seções, na ordem da spec');
 assert.equal(await current(),'materias','abre em Matérias');
 assert.deepEqual(await visibleSections(),['materias'],'só a seção corrente aparece');
 assert.equal(await page.locator('#settings-save').isVisible(),true,'rodapé com Salvar');
 assert.equal(await page.locator('#settings-dialog button[value="cancel"]').last().isVisible(),true,'rodapé com Cancelar');

 /* ---- 2. Inventário: nenhum campo sumiu e cada um mora na seção dita ---- */
 for(const [section,selectors] of Object.entries(INVENTORY)){
  for(const selector of selectors){
   const where=await page.evaluate(sel=>document.querySelector(sel)?.closest('[data-sec]')?.dataset.sec??null,selector);
   assert.equal(where,section,`${selector} mora em ${section}`);
  }
 }
 assert.equal(await page.locator('#accent-mode [data-accent]').count(),6,'seis acentos');
 assert.ok(await page.locator('#cfg-layout input').count()>=3,'o editor de leitores está montado');
 /* Nenhum controle novo escondido: tudo o que há no corpo (fora das linhas de
    matéria e do editor de leitores) está no inventário. */
 const known=new Set(Object.values(INVENTORY).flat().map(sel=>sel.slice(1)));
 const stray=await page.evaluate(()=>[...document.querySelectorAll('#settings-body input, #settings-body select, #settings-body textarea')]
  .filter(el=>!el.closest('#cfg-courses,#cfg-layout'))
  .map(el=>el.id));
 for(const id of stray)assert.ok(known.has(id),`campo ${id} está no inventário`);
 for(const id of ['cfg-title','cfg-vault','cfg-pi','cfg-claude','cfg-xournal','theme-mode','density-mode','notify-sound','notify-desktop','notify-focused',...FLAGS.map(k=>'cfg-desk-'+k)]){
  assert.ok(stray.includes(id),`campo ${id} continua existindo`);
 }

 /* ---- 3. Trocar de seção não salva nem descarta; Cancelar e Esc descartam tudo ---- */
 const original=await values();
 const dirty=async()=>{
  await tab('materias');
  await page.locator('#cfg-courses .cfg-course').first().locator('.cfg-name').fill('Cálculo editado');
  await tab('mesa');
  await page.locator('#cfg-title').fill('Título editado');
  await page.locator('#cfg-desk-calculator').uncheck();
  await tab('pastas');
  await page.locator('#cfg-pi').fill('/tmp/pi-editado');
  await tab('leitores');
  await page.locator('#cfg-layout-label-1').fill('Leitor editado');
 };
 await dirty();
 await tab('materias');
 assert.equal(await page.locator('#cfg-courses .cfg-course').first().locator('.cfg-name').inputValue(),'Cálculo editado','trocar de seção não descarta');
 await tab('pastas');
 assert.equal(await page.locator('#cfg-pi').inputValue(),'/tmp/pi-editado','nem a edição das outras seções');
 assert.deepEqual(readConfig().courses.map(c=>c.name),['Cálculo','Física'],'trocar de seção não salva');
 await cancel();
 await open();
 assert.equal(await current(),'materias','reabre em Matérias');
 assert.deepEqual(await values(),original,'Cancelar descartou as edições de todas as seções');
 await dirty();
 await escape();
 await open();
 assert.deepEqual(await values(),original,'Esc descartou as edições de todas as seções');
 assert.deepEqual(readConfig().courses.map(c=>c.name),['Cálculo','Física']);
 await cancel();

 /* ---- 4. Tema e acento valem na hora e Cancelar não os desfaz ---- */
 await open();
 await tab('avisos');
 const themeBefore=await page.evaluate(()=>document.documentElement.dataset.theme||'auto');
 assert.equal(await page.locator('#theme-mode').inputValue(),themeBefore);
 const themeNew=themeBefore==='dark'?'light':'dark';
 await page.locator('#theme-mode').selectOption(themeNew);
 await page.waitForFunction(t=>document.documentElement.dataset.theme===t,themeNew,{timeout:5000});
 await page.locator('#accent-mode [data-accent="violet"]').click();
 await page.waitForFunction(()=>document.documentElement.dataset.accent==='violet',undefined,{timeout:5000});
 await cancel();
 assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme||'auto'),themeNew,'Cancelar não desfaz o tema');
 assert.equal(await page.evaluate(()=>document.documentElement.dataset.accent),'violet','nem o acento');
 const deskFile=path.join(runtime,'desk.json');
 await pollUntil(()=>{try{return JSON.parse(fs.readFileSync(deskFile,'utf8'));}catch{return null;}},s=>!!s&&s.theme===themeNew&&s.accent==='violet',{timeout:4000,interval:100,what:'tema e acento em desk.json',onTimeout:'return'});
 const ui=JSON.parse(fs.readFileSync(deskFile,'utf8'));
 assert.equal(ui.theme,themeNew,'tema gravado como estado de interface');
 assert.equal(ui.accent,'violet','acento gravado como estado de interface');
 assert.equal('theme' in readConfig()||'accent' in readConfig(),false,'tema e acento não são campos do config.json');

 /* ---- 5. Erro ao lado do campo: bloqueia o Salvar e leva à seção dele ---- */
 const configBefore=fs.readFileSync(configFile,'utf8');
 await open();
 await tab('materias');
 await page.locator('#cfg-add-course').click();
 const added=page.locator('#cfg-courses .cfg-course').last();
 await added.locator('.cfg-name').fill('Nova sem pasta');
 await tab('pastas');
 await page.locator('#cfg-pi').fill('/tmp/pi-nao-salva');
 await page.locator('#settings-save').click();
 await page.waitForSelector('#cfg-courses .cfg-error',{timeout:5000});
 assert.equal(await page.evaluate(()=>document.querySelector('#settings-dialog').open),true,'o erro impede o Salvar');
 assert.equal(await current(),'materias','o diálogo vai para a seção do erro');
 assert.deepEqual(await visibleSections(),['materias']);
 assert.equal(await page.locator('#cfg-courses .cfg-error').innerText(),'Escolha a pasta dos PDFs desta matéria para salvar.');
 assert.equal(await page.evaluate(()=>{const row=document.querySelector('#cfg-courses .cfg-course:last-of-type');return row.nextElementSibling?.classList.contains('cfg-error');}),true,'o aviso fica logo abaixo da linha do campo');
 const pathField=added.locator('.cfg-path');
 assert.equal(await pathField.getAttribute('aria-invalid'),'true');
 const describedBy=await pathField.getAttribute('aria-describedby');
 assert.equal(await page.locator('#cfg-courses .cfg-error').getAttribute('id'),describedBy,'o campo aponta para o aviso');
 assert.equal(await page.evaluate(()=>document.activeElement.classList.contains('cfg-path')),true,'o foco vai para o campo do erro');
 assert.equal(fs.readFileSync(configFile,'utf8'),configBefore,'nada foi gravado');
 await shot('erro-validacao-prova.png');
 /* Corrigir o campo tira o aviso. */
 await pathField.fill(courseC);
 assert.equal(await page.locator('#cfg-courses .cfg-error').count(),0,'digitar na pasta tira o aviso');
 /* Nome repetido entre duas linhas novas. */
 await page.locator('#cfg-add-course').click();
 const twin=page.locator('#cfg-courses .cfg-course').last();
 await twin.locator('.cfg-name').fill('Nova sem pasta');
 await twin.locator('.cfg-path').fill(courseB);
 await tab('pastas');
 await page.locator('#settings-save').click();
 await page.waitForSelector('#cfg-courses .cfg-error',{timeout:5000});
 assert.equal(await page.locator('#cfg-courses .cfg-error').innerText(),'Já existe outra matéria com este nome.');
 assert.equal(await twin.locator('.cfg-name').getAttribute('aria-invalid'),'true');
 assert.equal(await current(),'materias');
 await escape();
 assert.equal(fs.readFileSync(configFile,'utf8'),configBefore,'Esc depois do erro não grava nada');

 /* ---- 6. Salvar aplica: cada campo grava o valor de sempre; extras preservados ---- */
 await open();
 await tab('materias');
 await page.locator('#cfg-courses .cfg-course').first().locator('.cfg-name').fill('Cálculo I');
 await page.locator('#cfg-add-course').click();
 const fresh=page.locator('#cfg-courses .cfg-course').last();
 await fresh.locator('.cfg-name').fill('Química');
 await fresh.locator('.cfg-path').fill(courseC);
 await tab('leitores');
 await page.locator('#cfg-layout-label-1').fill('Prova');
 await tab('mesa');
 await page.locator('#cfg-title').fill('Mesa nova');
 await page.locator('#cfg-desk-conferir').uncheck();
 await page.locator('#cfg-desk-refsToggle').uncheck();
 await tab('pastas');
 await page.locator('#cfg-pi').fill('/tmp/pi-secoes');
 await page.locator('#cfg-claude').fill('/tmp/claude-secoes');
 await page.locator('#cfg-xournal').fill('/tmp/xournal-secoes');
 await save();
 const saved=readConfig();
 assert.deepEqual(saved.courses.map(c=>[c.id,c.name,c.path]),[['A','Cálculo I',courseA],['B','Física',courseB],['Química','Química',courseC]],'matérias gravadas como antes');
 assert.equal(saved.desk.title,'Mesa nova');
 for(const key of FLAGS)assert.equal(saved.desk[key],!['conferir','refsToggle'].includes(key),`flag ${key}`);
 assert.equal(saved.piPath,'/tmp/pi-secoes');
 assert.equal(saved.claudePath,'/tmp/claude-secoes');
 assert.equal(saved.xournalPath,'/tmp/xournal-secoes');
 assert.equal(saved.vaultPath,runtime,'a pasta de dados segue igual');
 assert.equal(saved.desk.panels[0].label,'Prova','o editor de leitores gravou o rótulo');
 assert.equal(saved.desk.panels[0].extraDoLeitor,'um','campo extra do 1º leitor preservado');
 assert.deepEqual(saved.desk.panels[1].outroExtra,{n:2},'campo extra do 2º leitor preservado');
 assert.equal(saved.desk.campoExtraDoDesk,'preservado','campo extra do desk preservado');
 assert.equal('theme' in saved||'accent' in saved,false);

 /* ---- 7. Reabrir depois de reiniciar: os valores gravados voltam nos campos ---- */
 await ctx.app.close();
 ctx.app=await launch();
 page=await ctx.app.firstWindow();page.on('pageerror',e=>errors.push(e.message));
 await page.waitForSelector('.pdf-panel',{timeout:30000});
 await freezeMotion(page);
 await open();
 const after=await values();
 assert.deepEqual(after.rows.map(r=>r[0]),['Cálculo I','Física','Química']);
 assert.equal(after.title,'Mesa nova');
 /* O campo do Pi mostra o executável em uso (o teste injeta o Pi falso por
    ambiente); o que foi gravado segue no arquivo. */
 assert.equal(readConfig().piPath,'/tmp/pi-secoes');
 assert.equal(after.claude,'/tmp/claude-secoes');
 assert.equal(after.xournal,'/tmp/xournal-secoes');
 assert.equal(after.label1,'Prova');
 assert.equal(await page.evaluate(()=>document.documentElement.dataset.accent),'violet','o acento volta na abertura seguinte');
 await cancel();

 /* ---- 8. Medidas e capturas: dois temas × dois tamanhos × cinco seções ---- */
 const measure=()=>page.evaluate(()=>{
  const box=el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};};
  const pad=el=>{const s=getComputedStyle(el);return [s.paddingTop,s.paddingRight,s.paddingBottom,s.paddingLeft].map(parseFloat);};
  const probe=(prop)=>{const i=document.createElement('i');i.style.cssText=`position:fixed;${prop}`;document.body.append(i);const c=getComputedStyle(i).backgroundColor;i.remove();return c;};
  const dialog=document.querySelector('#settings-dialog');
  const nav=document.querySelector('.settings-nav'),body=document.querySelector('#settings-body'),foot=document.querySelector('.settings-actions');
  const current=document.querySelector('.settings-tab[aria-current="page"]');
  const other=document.querySelector('.settings-tab:not([aria-current])');
  return {
   inner:{w:innerWidth,h:innerHeight},
   dialog:box(dialog),nav:box(nav),body:box(body),foot:box(foot),save:box(document.querySelector('#settings-save')),
   navPad:pad(nav),bodyPad:pad(body),footPad:pad(foot),
   selectedBg:getComputedStyle(current).backgroundColor,
   otherBg:getComputedStyle(other).backgroundColor,
   rolesSelected:probe('background:var(--selected)'),
   accentFill:probe('background:var(--accent-fill)'),
   scrolls:getComputedStyle(body).overflowY,
   scrollHeight:body.scrollHeight,clientHeight:body.clientHeight
  };
 });
 for(const theme of ['light','dark']){
  for(const size of SIZES){
   const tag=`${theme}-${size.join('x')}`;
   await setSize(size);
   await setTheme(page,theme);
   await open();
   for(const id of SECTIONS){
    await tab(id);
    await page.mouse.move(2,2);
    const m=await measure();
    const label=`${tag} ${id}`;
    assert.equal(await current(),id);
    // cabe na janela, com o rodapé à vista
    assert.ok(m.dialog.top>=-1&&m.dialog.bottom<=m.inner.h+1,`${label}: diálogo cabe na altura`);
    assert.ok(m.dialog.left>=-1&&m.dialog.right<=m.inner.w+1,`${label}: diálogo cabe na largura`);
    assert.ok(m.foot.bottom<=m.dialog.bottom+1&&m.save.bottom<=m.inner.h,`${label}: rodapé e Salvar à vista`);
    // recuo interno de 16px nas três partes
    assert.deepEqual(m.navPad,[16,16,16,16],`${label}: lateral com 16px`);
    assert.deepEqual(m.bodyPad,[16,16,16,16],`${label}: corpo com 16px`);
    assert.deepEqual(m.footPad,[0,16,0,16],`${label}: rodapé com 16px nas laterais`);
    assert.equal(Math.round(m.foot.height),52,`${label}: rodapé de 52px (canvas)`);
    assert.equal(Math.round(m.nav.width),164,`${label}: lateral de 164px (canvas)`);
    // item selecionado: cinza neutro do papel de seleção, não o acento
    assert.equal(m.selectedBg,m.rolesSelected,`${label}: item selecionado usa --selected`);
    assert.notEqual(m.selectedBg,m.accentFill,`${label}: não é o acento`);
    const [r,g,b]=rgb(m.selectedBg);
    assert.ok(Math.max(r,g,b)-Math.min(r,g,b)<=8,`${label}: cinza neutro (${m.selectedBg})`);
    assert.ok(m.otherBg==='rgba(0, 0, 0, 0)'||m.otherBg==='transparent','os outros itens não têm fundo');
    assert.ok(['auto','scroll'].includes(m.scrolls),`${label}: a área da seção rola`);
    // rodapé: só diz "depois de salvar" onde isso é verdade
    const hint=(await page.locator('#settings-hint').textContent()).trim();
    if(id==='avisos'){
     assert.doesNotMatch(hint,/depois de salvar/,`${label}: tema e acento valem na hora, o rodapé não contradiz (${hint})`);
     assert.match(hint,/na hora/,`${label}: o rodapé diz que vale na hora (${hint})`);
    }else if(id==='pastas'){
     assert.match(hint,/Os caminhos só valem depois de salvar/,`${label}: os caminhos seguem com o aviso de salvar (${hint})`);
     assert.match(hint,/O programa de escrita vale na hora/,`${label}: o programa de escrita vale na hora e o rodapé diz (${hint})`);
    }else{
     assert.equal(hint,'As mudanças só valem depois de salvar.',`${label}: as outras seções seguem com o aviso de salvar`);
    }
    assert.equal(await page.locator('#settings-hint').evaluate(el=>el.scrollWidth<=el.clientWidth+1),true,`${label}: o aviso do rodapé não é cortado`);
    const type=await page.evaluate(()=>{const fs=sel=>{const el=document.querySelector(sel);return el?getComputedStyle(el).fontSize:'';};return {hint:fs('#settings-hint'),title:fs('#settings-form .set-sec:not([hidden]) .set-head h3'),intro:fs('#settings-form .set-sec:not([hidden]) .set-head p')};});
    assert.equal(type.hint,'12px',`${label}: o aviso do rodapé é 12px (canvas)`);
    if(type.title)assert.equal(type.title,'15px',`${label}: o título da seção é 15px (canvas)`);
    if(type.intro)assert.equal(type.intro,'13px',`${label}: a introdução da seção é 13px (canvas)`);
    await shot(`${tag}-${id}.png`);
   }
   // Ritmo vertical: Leitores segue o de Matérias (medido na mesma janela).
   const rhythm=async id=>{
    await tab(id);
    return page.evaluate(sectionId=>{
     const root=document.querySelector('#settings-sec-'+sectionId);
     const rect=el=>el.getBoundingClientRect();
     const head=rect(root.querySelector('.set-head'));
     const gaps=list=>list.slice(1).map((el,i)=>Math.round((rect(el).top-rect(list[i]).bottom)*10)/10);
     if(sectionId==='materias'){
      const rows=[...root.querySelectorAll('#cfg-courses .cfg-course')];
      const first=root.querySelector('#cfg-courses > :first-child');
      return {headGap:Math.round((rect(first).top-head.bottom)*10)/10,rowGaps:gaps(rows),rows:rows.length};
     }
     const link=root.querySelector('#layout-presets-open');
     const blocks=[link,...root.querySelectorAll('.cfg-layout > fieldset, .cfg-layout > .cfg-layout-preview')].filter(el=>el&&!el.hidden);
     const legends=[...root.querySelectorAll('.cfg-layout > fieldset')].filter(el=>!el.hidden).map(f=>{
      const legend=f.querySelector(':scope > legend');
      const next=[...f.children].find(k=>k!==legend&&!k.hidden);
      return {indent:Math.round((rect(legend).left-rect(f).left)*10)/10,gap:Math.round((rect(next).top-rect(legend).bottom)*10)/10};
     });
     const cs=getComputedStyle(link);
     return {headGap:Math.round((rect(link).top-head.bottom)*10)/10,blockGaps:gaps(blocks),legends,
      linkBorder:cs.borderTopWidth,linkBg:cs.backgroundColor,linkColor:cs.color,
      accentText:(()=>{const i=document.createElement('i');i.style.cssText='position:fixed;color:var(--accent-text)';document.body.append(i);const c=getComputedStyle(i).color;i.remove();return c;})()};
    },id);
   };
   {
    const mat=await rhythm('materias'),lei=await rhythm('leitores');
    assert.ok(mat.rows>=2,`${tag}: Matérias tem duas linhas para medir o ritmo`);
    assert.equal(lei.headGap,mat.headGap,`${tag}: título → primeiro bloco igual em Leitores e Matérias`);
    assert.ok(lei.blockGaps.length>=3&&lei.blockGaps.every(g=>g===mat.headGap),`${tag}: os blocos de Leitores se separam pelo mesmo espaço do título (${mat.headGap}px): ${JSON.stringify(lei.blockGaps)}`);
    for(const legend of lei.legends){
     assert.equal(legend.indent,0,`${tag}: a legenda alinha com o bloco, sem recuo próprio`);
     assert.equal(legend.gap,mat.rowGaps[0],`${tag}: legenda → primeiro campo = espaço entre linhas de Matérias (${mat.rowGaps[0]}px)`);
    }
    assert.equal(lei.linkBorder,'0px',`${tag}: "Layouts pessoais…" é link como "Adicionar matéria", sem borda de botão`);
    assert.equal(lei.linkColor,lei.accentText,`${tag}: e leva a cor de ação do acento`);
   }
   // Teste à mão de 2026-10-14: dentro de cada leitor, rótulo a 6px do campo,
   // explicação a 4px, próximo rótulo a 16px; "Adicionar termo" a 6px do último
   // termo, fantasma como "Adicionar matéria"; × de remover sem borda.
   {
    await tab('leitores');
    const panel=await page.evaluate(()=>{
     const p=document.querySelector('#cfg-layout-panel-2'),r=el=>el.getBoundingClientRect(),gap=(a,b)=>Math.round(r(b).top-r(a).bottom);
     const q=s=>p.querySelector(s),rows=[...p.querySelectorAll('.cfg-layout-prefer-row')];
     const add=q('.cfg-layout-prefer-add'),rm=q('.cfg-layout-prefer-remove');
     return {
      labelToInput:gap(q('label[for="cfg-layout-label-2"]'),q('#cfg-layout-label-2')),
      inputToNote:gap(q('#cfg-layout-label-2'),q('#cfg-layout-note-2')),
      noteToTitle:gap(q('#cfg-layout-note-2'),q('.cfg-layout-prefer-title')),
      titleToRow:gap(q('.cfg-layout-prefer-title'),rows[0]),
      rowToAdd:gap(rows[rows.length-1],add),
      hintToToggle:gap(q('#cfg-layout-prefer-hint-2'),q('label[for="cfg-layout-toggle-2"]')),
      toggleLabelToInput:gap(q('label[for="cfg-layout-toggle-2"]'),q('#cfg-layout-toggle-2')),
      addBorder:getComputedStyle(add).borderTopWidth,addH:Math.round(r(add).height),
      rmBorder:getComputedStyle(rm).borderTopWidth,
     };
    });
    assert.deepEqual(panel,{labelToInput:6,inputToNote:4,noteToTitle:16,titleToRow:6,rowToAdd:6,hintToToggle:16,toggleLabelToInput:6,addBorder:'0px',addH:30,rmBorder:'0px'},`${tag}: ritmo do leitor 2`);
   }
   // #27 B9 — editor de matérias nas medidas do canvas.
   {
    await tab('materias');
    const b9=await page.evaluate(()=>{
     const q=s=>document.querySelector(s),r=el=>el.getBoundingClientRect(),cs=el=>getComputedStyle(el);
     const row=q('#cfg-courses .cfg-course'),head=q('#cfg-courses .cfg-course-head');
     const name=row.querySelector('.cfg-name'),path=row.querySelector('.cfg-path'),browse=row.querySelector('.cfg-browse'),rm=row.querySelector('.cfg-remove');
     const add=q('#cfg-add-course'),dlg=q('#settings-dialog'),tabEl=q('.settings-tab');
     return {
      cols:cs(row).gridTemplateColumns.split(' ').map(parseFloat),gap:cs(row).gap,
      headTexts:[...head.children].map(c=>c.textContent.trim()),
      nameH:r(name).height,pathH:r(path).height,browseH:r(browse).height,browseText:browse.textContent.trim(),browseW:cs(browse).fontWeight,
      rmW:r(rm).width,rmH:r(rm).height,
      nameLeft:r(name).left,headNameLeft:r(head.children[0]).left,pathLeft:r(path).left,headPathLeft:r(head.children[1]).left,
      addH:r(add).height,addText:add.textContent.trim(),addBefore:getComputedStyle(add,'::before').content,addBorder:cs(add).borderTopWidth,
      dialogRadius:cs(dlg).borderTopLeftRadius,tabH:r(tabEl).height,tabRadius:cs(tabEl).borderTopLeftRadius
     };
    });
    assert.equal(b9.cols[0],170,`${tag}: coluna do nome de 170px`);
    assert.equal(b9.cols[3],28,`${tag}: remover com 28px`);
    assert.equal(b9.gap,'8px 6px',`${tag}: espaço da grade 8px 6px`);
    assert.deepEqual(b9.headTexts,['Nome','Pasta dos PDFs'],`${tag}: cabeçalho das colunas`);
    assert.equal(Math.round(b9.nameLeft),Math.round(b9.headNameLeft),`${tag}: "Nome" alinha com o campo`);
    assert.equal(Math.round(b9.pathLeft),Math.round(b9.headPathLeft),`${tag}: "Pasta dos PDFs" alinha com o campo`);
    assert.deepEqual([b9.nameH,b9.pathH,b9.browseH],[30,30,30],`${tag}: campos e Escolher… com 30px`);
    assert.equal(b9.browseText,'Escolher…');
    assert.equal(b9.browseW,'600',`${tag}: Escolher… em semibold`);
    assert.deepEqual([b9.rmW,b9.rmH],[28,28],`${tag}: remover 28×28`);
    assert.equal(b9.addH,30,`${tag}: Adicionar matéria com 30px`);
    assert.equal(b9.addBorder,'0px',`${tag}: Adicionar matéria é ação fantasma`);
    assert.match(b9.addBefore,/\+/,`${tag}: Adicionar matéria leva o +`);
    assert.equal(b9.dialogRadius,'16px',`${tag}: diálogo com raio 16px`);
    assert.equal(b9.tabH,30,`${tag}: itens da lateral com 30px`);
    assert.equal(b9.tabRadius,'8px',`${tag}: itens da lateral com raio 8px`);
   }
   // Erro de validação (captura): linha com nome e sem pasta.
   await tab('materias');
   await page.locator('#cfg-add-course').click();
   await page.locator('#cfg-courses .cfg-course').last().locator('.cfg-name').fill('Sem pasta');
   await page.locator('#settings-save').click();
   await page.waitForSelector('#cfg-courses .cfg-error');
   await page.locator('#cfg-courses .cfg-error').scrollIntoViewIfNeeded();
   await page.mouse.move(2,2);
   await shot(`${tag}-erro.png`);
   // Muitas matérias: só o corpo rola; lateral e rodapé ficam onde estão.
   await escape();
   await open();
   for(let i=0;i<8;i++)await page.locator('#cfg-add-course').click();
   const before=await measure();
   await page.locator('#settings-body').evaluate(el=>{el.scrollTop=el.scrollHeight;});
   const scrolled=await measure();
   assert.ok(scrolled.scrollHeight>scrolled.clientHeight,`${tag}: com muitas matérias o corpo rola`);
   assert.equal(Math.round(scrolled.foot.top),Math.round(before.foot.top),`${tag}: rodapé fixo ao rolar`);
   assert.equal(Math.round(scrolled.nav.top),Math.round(before.nav.top),`${tag}: lateral fixa ao rolar`);
   assert.ok(scrolled.save.bottom<=scrolled.inner.h,`${tag}: Salvar continua à vista`);
   await escape();
  }
 }
 await setSize([1440,900]);

 assert.deepEqual(errors,[]);
 console.log('PASS: Configurações com seções — cinco seções, inventário, salvar/cancelar/Esc, erro ao lado do campo, tema e acento na hora, 16px e seleção neutra (dois temas, 1440×900 e 900×650).');
});

console.log('Screenshots:',SHOT_DIR);
