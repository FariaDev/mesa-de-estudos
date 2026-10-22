import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {_electron as electron} from '@playwright/test';
import {DESK,FAKE_PI,deskEnv,newRuntime,seedCourse,tinyPdf,writeConfigJson,withArtifacts,screenshotDirectory,setTheme,freezeMotion,toastWait,launchDesk,statusOnline,resizeWindow} from './helpers.mjs';
import {settle} from './layout-measure.mjs';

/* Primeira abertura em tela cheia (#64; antes #21 e #24). Sem configuração a
   pessoa cai numa tela de seis passos por cima da Mesa (que fica `inert`):
   boas-vindas, como a Mesa funciona (quatro quadros), nome, PDFs, tutor
   (opcional) e pronto. A matéria só nasce no botão "Criar a matéria" (ou Enter)
   do último passo; a pasta de dados confirmada é gravada no `config.json`
   LOCAL. Quem já tem configuração nunca vê esta tela.

   Roda com userData e HOME isolados (o `config.json` do usuário nunca é lido
   nem escrito). Os PDFs usados são sintéticos e o teste confere que nenhum
   byte deles muda. As imagens saem em `desk/tests/artifacts/primeira-abertura-…`
   para olho humano; não são asserção. */

const SHOT_DIR=screenshotDirectory('primeira-abertura');
const WIDE=[1440,900],MINIMUM=[900,650];
const THEMES=[['light','claro'],['dark','escuro']];
const HINT_FOLDER='Falta a pasta dos PDFs.';
const HINT_NAME='Falta o nome da matéria.';
const STEPS=['welcome','tour','name','folder','tutor','ready'];

const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

/* Cada cenário tem runtime (userData) e HOME próprios, dentro da pasta de teste.
   O `entry.cjs` põe o userData no runtime e apaga o override de runtime: é o
   que faz a Mesa persistir `config.json` como no uso real. */
function scenario(tag){
 const runtime=newRuntime(tag);
 const home=path.join(runtime,'home');
 fs.mkdirSync(home,{recursive:true});
 const entry=path.join(runtime,'entry.cjs');
 fs.writeFileSync(entry,`require('electron').app.setPath('userData',__dirname);require(${JSON.stringify(path.join(DESK,'main.cjs'))});`);
 fs.chmodSync(FAKE_PI,0o755);
 const launch=()=>{
  const env=deskEnv(runtime,{HOME:home,USERPROFILE:home});delete env.LEARNING_DESK_RUNTIME;
  return electron.launch({args:[entry],cwd:DESK,env});
 };
 const configFile=path.join(runtime,'config.json');
 /* Sem matérias e sem vault: `needsSetup` segue verdadeiro. O `runtimePath`
    mantém sessões e estado de interface dentro da pasta de teste (sem ele a
    Mesa usaria o `desk/.runtime` do clone). */
 fs.writeFileSync(configFile,JSON.stringify({runtimePath:runtime,courses:[]}));
 const readConfig=()=>JSON.parse(fs.readFileSync(configFile,'utf8'));
 return {runtime,home,launch,configFile,readConfig,dataDefault:path.join(home,'Documents','Mesa de Estudos')};
}

async function boot(ctx,s){
 ctx.runtime=s.runtime;
 ctx.app=await s.launch();
 const page=await ctx.app.firstWindow();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.waitForSelector('body[data-first-run="true"]',{timeout:30000});
 await freezeMotion(page);
 return {page,errors};
}

const stubPicker=(app,paths)=>app.evaluate(({dialog},paths)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:paths});},paths);
const setSize=async(app,page,[width,height])=>{
 await resizeWindow(app,page,width,height);
 await settle(page);
};
async function shot(page,name){
 await page.mouse.move(2,2);
 /* A captura não leva caminho real: pasta de dados e pasta escolhida mostram
    só o nome da última pasta durante o clique da foto. */
 const masked=await page.evaluate(()=>[...document.querySelectorAll('.setup-path,#setup-chosen-folder,#setup-summary dd')].map(el=>{const real=el.textContent;el.textContent=real.replace(/\/[^ ·]*\/([^/ ·]+)/g,'…/$1');return real;}));
 await page.screenshot({path:path.join(SHOT_DIR,name)});
 await page.evaluate(real=>{[...document.querySelectorAll('.setup-path,#setup-chosen-folder,#setup-summary dd')].forEach((el,i)=>{el.textContent=real[i];});},masked);
}

/* DataTransfer com arquivos reais do disco (o `File` nativo carrega o caminho
   que `webUtils.getPathForFile` resolve no preload). */
async function transferOf(page,files){
 await page.evaluate(()=>{
  document.querySelector('#drop-source')?.remove();
  const input=document.createElement('input');input.type='file';input.id='drop-source';input.multiple=true;document.body.append(input);
 });
 await page.locator('#drop-source').setInputFiles(files);
 return page.evaluateHandle(()=>{
  const dt=new DataTransfer();
  for(const file of document.querySelector('#drop-source').files)dt.items.add(file);
  return dt;
 });
}
/* Solta em qualquer ponto da tela (aqui, o título do passo): vale no passo dos PDFs. */
async function dropOnSetup(page,files){
 const dt=await transferOf(page,files);
 const target=page.locator('#setup-stage');
 await target.dispatchEvent('dragenter',{dataTransfer:dt});
 await target.dispatchEvent('dragover',{dataTransfer:dt});
 const overActive=await page.locator('#setup').evaluate(el=>el.hasAttribute('data-dragging'));
 await target.dispatchEvent('drop',{dataTransfer:dt});
 return overActive;
}

const setupFacts=page=>page.evaluate(()=>{
 const shown=el=>{if(!el)return false;const cs=getComputedStyle(el),r=el.getBoundingClientRect();return r.width>0&&r.height>0&&cs.visibility!=='hidden'&&cs.display!=='none';};
 const text=sel=>{const el=document.querySelector(sel);return el&&shown(el)?el.textContent.replace(/\s+/g,' ').trim():null;};
 const setup=document.querySelector('#setup');
 const card=document.querySelector('#setup-card');
 const next=document.querySelector('#setup-next');
 const cardBox=card.getBoundingClientRect();
 return {
  firstRun:document.body.dataset.firstRun??null,
  setupShown:shown(setup),
  dialogOpen:!!document.querySelector('dialog[open]'),
  focusId:document.activeElement?.id||'',
  step:card.dataset.step,
  cardShown:shown(card),
  trail:[...document.querySelectorAll('#setup-trail li')].map(li=>li.dataset.status),
  speech:text('#setup-speech'),
  title:text(`#setup-card [data-step="${card.dataset.step}"] h1`),
  next:{text:next.textContent.trim(),disabled:next.disabled},
  backShown:shown(document.querySelector('#setup-back')),
  hint:text('#setup-hint'),
  nameValue:document.querySelector('#first-run-name').value,
  lit:document.querySelector('#setup [data-region][data-lit]')?.dataset.region??null,
  chosen:text('#setup-chosen-folder'),files:text('#setup-chosen-files'),elsewhere:text('#setup-elsewhere'),
  pi:document.querySelector('#setup-pi')?.dataset.pi??null,
  connect:text('#setup-tutor-actions #connect'),piSettings:text('#setup-tutor-actions #state-pi'),
  summary:[...document.querySelectorAll('#setup-summary dd')].map(dd=>dd.textContent.trim()),
  path:text('#setup-data .setup-path'),dataLine:text('#setup-data'),
  changeShown:shown(document.querySelector('#first-run-data-change')),
  helpShown:shown(document.querySelector('#first-run-help')),helpText:text('#first-run-help'),
  freeShown:shown(document.querySelector('#setup-free')),
  mascote:document.querySelector('#setup-mascote .mascote:not([hidden])')?.dataset.humor??null,
  /* Quem do trio ∫ Σ ∇ está em cena, e com que nome para o leitor de tela. */
  cast:[...document.querySelectorAll('#setup-mascote .mascote')].filter(el=>shown(el)).map(el=>el.getAttribute('aria-label')),
  cardInside:cardBox.left>=0&&cardBox.right<=innerWidth+1&&cardBox.bottom<=innerHeight+1,
  hScroll:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,
  deskInert:!!document.querySelector('body > main')?.inert||!!document.querySelector('body > header')?.inert,
  prompt:{disabled:document.querySelector('#prompt').disabled},
  tabs:[...document.querySelectorAll('#course-tabs [data-id]')].map(el=>({id:el.dataset.id,selected:el.getAttribute('aria-selected')})),
 };
});

/* O balão e quem fala (#70, teste manual A1): a distância até os personagens
   e onde a ponta cai. */
const balloonOf=(page,speaker)=>page.evaluate(speaker=>{
 const speech=document.querySelector('#setup-speech');
 const box=speech.getBoundingClientRect();
 const shown=[...document.querySelectorAll('#setup-mascote .mascote')].filter(el=>!el.hidden).map(el=>el.getBoundingClientRect());
 const lead=document.querySelector(`#setup-mascote .mascote-${speaker}`).getBoundingClientRect();
 const tail=getComputedStyle(speech,'::after');
 const tailCenter=box.left+parseFloat(tail.left)+6;
 const stage=document.querySelector('#setup-mascote');
 const side=getComputedStyle(stage,'::before');
 const sideCenter=stage.getBoundingClientRect().left+parseFloat(side.left)+6;
 return {
  below:Math.round(Math.min(...shown.map(r=>r.top))-box.bottom),
  beside:Math.round(Math.min(...shown.map(r=>r.left))-box.right),
  tailOverLead:tailCenter>=lead.left&&tailCenter<=lead.right,
  tailRight:side.content!=='none'&&tail.display==='none'&&Math.abs(sideCenter-box.right)<=2,
 };
},speaker);

const clickNext=page=>page.locator('#setup-next').click();
/* Anda com "Próximo"/"Continuar" até o passo pedido (o passeio vai quadro a quadro). */
async function walkTo(page,step){
 for(let guard=0;guard<12;guard++){
  if(await page.locator('#setup-card').getAttribute('data-step')===step)return;
  await clickNext(page);
 }
 throw new Error(`não chegou ao passo "${step}"; esperado um de ${STEPS.join(', ')}`);
}

/* Nome + pasta (pelo seletor) + pular o tutor + Criar a matéria. */
async function createThrough(ctx,page,name,folder){
 await walkTo(page,'name');
 await page.locator('#first-run-name').fill(name);
 await walkTo(page,'folder');
 await stubPicker(ctx.app,[folder]);
 await page.locator('#first-run-pick').click();
 await page.waitForFunction(()=>!document.querySelector('#setup-next').disabled);
 await walkTo(page,'ready');
 await clickNext(page);
 await page.waitForFunction(()=>!document.body.dataset.firstRun,undefined,{timeout:30000});
}

/* ------------------------------------------------------------------ */
/* A. abrir sem configuração: tela cheia, passos e tutor opcional       */
/* ------------------------------------------------------------------ */
await withArtifacts('primeira-abertura-estado',async ctx=>{
 const s=scenario('first-run-state');
 const {page,errors}=await boot(ctx,s);
 assert.equal(await ctx.app.evaluate(({app})=>app.getPath('userData')),path.join(s.runtime,'electron'),'estado isolado no runtime de teste');

 let f=await setupFacts(page);
 assert.equal(f.firstRun,'true');
 assert.equal(f.setupShown,true,'a tela de passos cobre a Mesa');
 assert.equal(f.deskInert,true,'a Mesa atrás fica inert');
 assert.equal(f.dialogOpen,false,'nenhum diálogo de boas-vindas');
 assert.equal(f.step,'welcome');
 assert.deepEqual(f.trail,['current','todo','todo','todo','todo','todo']);
 assert.equal(f.next.text,'Começar');
 assert.equal(f.backShown,false,'sem Voltar no primeiro passo');
 assert.equal(f.focusId,'setup-next');
 assert.equal(f.helpShown,true);assert.equal(f.helpText,'Como a Mesa funciona');
 assert.equal(f.freeShown,true);
 assert.equal(f.mascote!==null,true,'a mascote grande está na tela');
 assert.deepEqual(f.cast,['Integral','Sigma','Nabla'],'o trio junto nas boas-vindas');
 assert.equal(f.speech,'Vamos montar a sua Mesa.');
 assert.equal(f.hScroll,false);

 /* #70: a cor de acento se escolhe no setup e vale na hora (a marca também). */
 await page.locator('#setup-accent [data-accent="violet"]').click();
 const accent=await page.evaluate(()=>({
  html:document.documentElement.dataset.accent||'blue',
  brand:document.querySelector('#setup .brand-icon').getAttribute('src'),
  checked:document.querySelector('#setup-accent [aria-checked="true"]')?.dataset.accent,
  settings:document.querySelector('#accent-mode [aria-checked="true"]')?.dataset.accent,
  label:document.querySelector('#setup-accent [data-accent="violet"]').textContent.trim(),
 }));
 assert.deepEqual(accent,{html:'violet',brand:'assets/app-icon/mesa-violet.svg',checked:'violet',settings:'violet',label:'Violeta'});
 await shot(page,'acento-setup-1440x900.png');
 await page.keyboard.press('ArrowLeft');
 assert.equal(await page.evaluate(()=>document.documentElement.dataset.accent||'blue'),'blue','as setas trocam como nas Configurações');

 /* #70 (A1): o balão ficava ~330 px acima do trio. Agora encosta nos três e a
    ponta cai sobre a ∫, que fala nas boas-vindas; na janela estreita ele fica
    ao lado, com a ponta para a direita. */
 const wide=await balloonOf(page,'integral');
 assert.ok(wide.below>=0&&wide.below<=24,`1440×900: o balão encosta no trio (${wide.below} px)`);
 assert.equal(wide.tailOverLead,true,'1440×900: a ponta sobre quem fala');
 await shot(page,'balao-trio-1440x900.png');
 await setSize(ctx.app,page,MINIMUM);
 const narrow=await balloonOf(page,'integral');
 assert.ok(narrow.beside>=0&&narrow.beside<=24,`900×650: o balão ao lado do trio (${narrow.beside} px)`);
 assert.equal(narrow.tailRight,true,'900×650: a ponta aponta para o trio');
 await shot(page,'balao-trio-900x650.png');
 await setSize(ctx.app,page,WIDE);
 assert.equal(fs.existsSync(s.dataDefault),false,'sugerir a pasta de dados não a cria');

 /* O passeio: quatro quadros, cada um acende uma região do desenho. */
 await clickNext(page);
 const regions=[];
 for(let i=0;i<4;i++){
  f=await setupFacts(page);
  assert.equal(f.step,'tour');
  /* Regressão (#64): o cartão sumia a cada troca de passo (o `#setup-card` também tem `data-step`). */
  assert.equal(f.cardShown,true,`quadro ${i+1}: o cartão aparece`);
  assert.equal(f.backShown,true,'Voltar em todo passo depois do primeiro');
  regions.push(f.lit);
  if(i===0)await shot(page,'passeio-claro-1440x900.png');
  await clickNext(page);
 }
 assert.deepEqual(regions,['readers','writer','tutor','top']);
 f=await setupFacts(page);
 assert.equal(f.step,'name');
 assert.equal(f.cardShown,true,'o cartão aparece no passo novo');
 assert.equal(f.focusId,'first-run-name','o campo do nome recebe o foco');
 assert.deepEqual(f.cast,['Sigma'],'no nome, só o Σ, grande');
 /* Voltar do nome cai no último quadro do passeio. */
 await page.locator('#setup-back').click();
 f=await setupFacts(page);
 assert.equal(f.step,'tour');assert.equal(f.lit,'top');
 await page.locator('#setup-skip-tour').click();
 f=await setupFacts(page);
 assert.equal(f.step,'name');
 assert.equal(f.next.disabled,true,'sem nome não avança');
 assert.equal(f.hint,HINT_NAME);
 await page.locator('#first-run-name').fill('Cálculo I');
 f=await setupFacts(page);
 assert.equal(f.next.disabled,false);assert.equal(f.hint,null);
 await clickNext(page);
 f=await setupFacts(page);
 assert.equal(f.step,'folder');
 assert.match(f.title,/Cálculo I/);
 assert.equal(f.next.disabled,true,'sem pasta não avança');
 assert.equal(f.hint,HINT_FOLDER);
 assert.equal(f.firstRun,'true','nada é criado no caminho');

 /* "Como a Mesa funciona" leva de volta ao passeio; ⌘/ abre o Guia. */
 await page.locator('#first-run-help').click();
 assert.equal((await setupFacts(page)).step,'tour');
 await page.keyboard.press('ControlOrMeta+/');
 await page.waitForSelector('#help-dialog[open]');
 await page.keyboard.press('Escape');
 await page.waitForFunction(()=>!document.querySelector('#help-dialog').open);
 assert.equal((await setupFacts(page)).firstRun,'true','fechar o Guia mantém a primeira abertura');

 /* O passo do tutor (opcional): Pi achado → Chamar o tutor é a ação principal. */
 await walkTo(page,'name');
 await page.locator('#first-run-name').fill('Cálculo I');
 await walkTo(page,'folder');
 /* #70: a pasta escolhida por engano sai com "Tirar esta pasta". */
 const wrong=path.join(s.runtime,'pdfs','Engano');fs.mkdirSync(wrong,{recursive:true});
 fs.writeFileSync(path.join(wrong,'Outra.pdf'),tinyPdf('Outra',1));
 await stubPicker(ctx.app,[wrong]);
 await page.locator('#first-run-pick').click();
 await page.waitForFunction(()=>!document.querySelector('#setup-next').disabled);
 await shot(page,'pasta-escolhida-1440x900.png');
 await page.locator('#setup-folder-remove').click();
 const removed=await page.evaluate(()=>({chosen:!document.querySelector('#setup-chosen').hidden,next:document.querySelector('#setup-next').disabled,focus:document.activeElement?.id}));
 assert.deepEqual(removed,{chosen:false,next:true,focus:'first-run-pick'},'sem pasta, o quadro volta e o Continuar trava');
 const pdfs=path.join(s.runtime,'pdfs','Calculo');fs.mkdirSync(path.join(pdfs,'Unidade 2'),{recursive:true});
 fs.writeFileSync(path.join(pdfs,'Limites.pdf'),tinyPdf('Limites',2));
 /* #70: PDF em subpasta conta, como na biblioteca da matéria. */
 fs.writeFileSync(path.join(pdfs,'Unidade 2','Derivadas.pdf'),tinyPdf('Derivadas',1));
 await stubPicker(ctx.app,[pdfs]);
 await page.locator('#first-run-pick').click();
 /* Regressão da #64: a pasta do seletor é um caminho e passava pela ponte do
    arrasto (só `File`); o clique nunca valia e o "Continuar" não ligava. */
 await page.waitForFunction(()=>!document.querySelector('#setup-next').disabled);
 assert.equal((await setupFacts(page)).chosen,'Pasta escolhida: '+pdfs,'a pasta do seletor entra');
 assert.equal(await page.locator('#setup-chosen-files').textContent(),'Derivadas.pdf · Limites.pdf','a subpasta conta');
 await clickNext(page);
 f=await setupFacts(page);
 assert.equal(f.step,'tutor');
 assert.equal(f.pi,'found');
 assert.equal(f.connect,'Chamar o tutor');
 assert.equal(f.piSettings,null);
 assert.equal(f.next.text,'Pular por agora','o tutor é opcional');
 for(const [theme,tag] of THEMES){
  await setTheme(page,theme);
  for(const size of [WIDE,MINIMUM]){
   await setSize(ctx.app,page,size);
   const m=await setupFacts(page);
   assert.equal(m.cardInside,true,`${tag} ${size}: o cartão cabe na janela`);
   assert.equal(m.hScroll,false,`${tag} ${size}: sem rolagem horizontal`);
   await shot(page,`tutor-${tag}-${size.join('x')}.png`);
  }
 }
 await setTheme(page,'light');
 await setSize(ctx.app,page,WIDE);

 /* Sem o Pi: "Ajustes do Pi" vira a principal e leva às Configurações. */
 await page.evaluate(async()=>{
  const mod=await import('./src/first-run.mjs');
  await mod.enterFirstRun({needsSetup:true,detectedPi:'',config:{}},{});
 });
 await walkTo(page,'name');
 await page.locator('#first-run-name').fill('Cálculo I');
 await walkTo(page,'folder');
 await page.locator('#first-run-pick').click();
 await page.waitForFunction(()=>!document.querySelector('#setup-next').disabled);
 await clickNext(page);
 await page.waitForSelector('#setup-pi[data-pi="missing"]');
 f=await setupFacts(page);
 assert.equal(f.piSettings,'Ajustes do Pi');
 assert.equal(f.connect,'Chamar o tutor');
 assert.equal(await page.locator('#setup-tutor-actions #state-pi').getAttribute('class'),'primary');
 assert.equal(await page.locator('#setup-tutor-actions #connect').getAttribute('class'),'');
 await shot(page,'sem-pi-claro-1440x900.png');
 await page.locator('#setup-tutor-actions #state-pi').click();
 await page.waitForSelector('#settings-dialog[open]');
 assert.equal(await page.evaluate(()=>document.querySelector('#settings-tabs [aria-current="page"]')?.dataset.sec),'pastas');
 await page.keyboard.press('Escape');
 await page.waitForFunction(()=>!document.querySelector('#settings-dialog').open);
 assert.equal((await setupFacts(page)).firstRun,'true','cancelar não cria matéria nem sai da primeira abertura');

 /* Pi achado e "Chamar o tutor": o passo diz que está ligado e o botão vira Continuar. */
 await page.evaluate(async()=>{
  const mod=await import('./src/first-run.mjs');
  await mod.enterFirstRun({needsSetup:true,detectedPi:'/fake/pi',config:{}},{});
 });
 await walkTo(page,'name');
 await page.locator('#first-run-name').fill('Cálculo I');
 await walkTo(page,'folder');
 await page.locator('#first-run-pick').click();
 await page.waitForFunction(()=>!document.querySelector('#setup-next').disabled);
 await clickNext(page);
 await page.locator('#setup-tutor-actions #connect').click();
 await page.waitForFunction(()=>document.querySelector('#setup-next').textContent.trim()==='Continuar',undefined,{timeout:30000});
 f=await setupFacts(page);
 assert.match(f.title,/O tutor está ligado/);
 assert.equal(f.firstRun,'true','ligar o tutor não cria matéria');
 await clickNext(page);
 f=await setupFacts(page);
 assert.equal(f.step,'ready');
 assert.equal(f.next.text,'Criar a matéria');
 assert.equal(f.summary[0],'Cálculo I');
 assert.equal(f.summary[2],'Ligado');
 assert.equal(f.path,s.dataDefault,'a pasta de dados sugerida é Documentos/Mesa de Estudos do usuário');
 assert.match(f.dataLine,/só neste computador/);
 assert.equal(f.changeShown,true);
 assert.equal(f.mascote,'feliz');
 assert.deepEqual(f.cast,['Integral','Sigma','Nabla'],'o trio junto no Pronto');
 await shot(page,'pronto-claro-1440x900.png');

 /* "Estudar sem matéria" sai para a aba Livre sem criar nada. */
 await page.locator('#setup-free').click();
 await page.waitForFunction(()=>!document.body.dataset.firstRun);
 f=await setupFacts(page);
 assert.equal(f.setupShown,false);
 assert.equal(f.deskInert,false,'a Mesa volta a ser usável');
 assert.equal(f.prompt.disabled,false,'no Livre a caixa é a de sempre');
 assert.equal(fs.existsSync(s.configFile)?(s.readConfig().courses||[]).length:0,0,'nenhuma matéria gravada');
 await shot(page,'livre-claro-1440x900.png');
 assert.deepEqual(errors,[],'sem erro de página');
});

/* ------------------------------------------------------------------ */
/* B. nome + "Escolher a pasta…" + Criar a matéria levam ao app normal  */
/* ------------------------------------------------------------------ */
await withArtifacts('primeira-abertura-criar',async ctx=>{
 const s=scenario('first-run-create');
 const pdfs=path.join(s.runtime,'pdfs','Calculo');
 fs.mkdirSync(pdfs,{recursive:true});
 fs.writeFileSync(path.join(pdfs,'Limites.pdf'),tinyPdf('Limites',3));
 fs.writeFileSync(path.join(pdfs,'Formulario.pdf'),tinyPdf('Formulas',2));
 const before=fs.readdirSync(pdfs).sort().map(n=>[n,sha(path.join(pdfs,n))]);

 let {page,errors}=await boot(ctx,s);
 await walkTo(page,'name');
 await page.locator('#first-run-name').fill('Cálculo I');
 await walkTo(page,'folder');
 await stubPicker(ctx.app,[pdfs]);
 await page.locator('#first-run-pick').click();
 await page.waitForFunction(()=>/Pasta escolhida/.test(document.querySelector('#setup-chosen-folder')?.textContent||''));
 let f=await setupFacts(page);
 assert.equal(f.chosen,'Pasta escolhida: '+pdfs);
 assert.equal(f.files,'Formulario.pdf · Limites.pdf','os nomes dos PDFs, em ordem');
 assert.equal(f.firstRun,'true','escolher a pasta não cria a matéria');
 assert.equal(fs.existsSync(s.configFile)?(s.readConfig().courses||[]).length:0,0,'nenhuma matéria gravada ainda');
 await shot(page,'pasta-claro-1440x900.png');

 /* No pronto, Enter fora de um campo cria. */
 await walkTo(page,'ready');
 f=await setupFacts(page);
 assert.equal(f.summary[1],`${pdfs} · 2 PDFs`);
 await page.locator('#setup-card').focus();
 await page.keyboard.press('Enter');
 await page.waitForFunction(()=>!document.body.dataset.firstRun,undefined,{timeout:30000});
 await page.waitForSelector('.pdf-panel canvas',{timeout:30000});
 await freezeMotion(page);

 const cfg=s.readConfig();
 assert.deepEqual(cfg.courses.map(c=>({id:c.id,name:c.name,path:c.path})),[{id:'Cálculo I',name:'Cálculo I',path:pdfs}]);
 assert.equal(cfg.vaultPath,s.dataDefault,'a pasta de dados confirmada vai para o config.json local');
 assert.equal(fs.statSync(s.dataDefault).isDirectory(),true,'a pasta de dados foi criada ao confirmar');
 assert.deepEqual(fs.readdirSync(pdfs).sort().map(n=>[n,sha(path.join(pdfs,n))]),before,'os PDFs não foram tocados nem ganharam companhia');

 f=await setupFacts(page);
 assert.equal(f.firstRun,null);
 assert.equal(f.setupShown,false);
 assert.equal(f.deskInert,false);
 assert.equal(f.prompt.disabled,false,'a caixa volta a ser a de sempre');
 assert.ok(f.tabs.find(t=>t.id==='Cálculo I'),'a aba da matéria nova existe');
 assert.equal(await page.evaluate(()=>document.querySelector('#course-tabs [data-id="Cálculo I"]')?.getAttribute('aria-selected')),'true');
 await page.waitForSelector('#status-dot.online',{timeout:30000,state:'attached'});
 await shot(page,'depois-de-criar-claro-1440x900.png');
 assert.deepEqual(errors,[]);

 /* Reabrir: a configuração existe, a primeira abertura nunca mais aparece. */
 await ctx.app.close();
 ctx.app=await s.launch();
 page=await ctx.app.firstWindow();
 await page.waitForSelector('.pdf-panel canvas',{timeout:30000});
 f=await setupFacts(page);
 assert.equal(f.firstRun,null);
 assert.equal(f.setupShown,false);
 assert.equal(f.dialogOpen,false);
 assert.equal(f.prompt.disabled,false);
});

/* ------------------------------------------------------------------ */
/* C. soltar PDFs (e o que não é PDF) e a pasta de dados com "Mudar"    */
/* ------------------------------------------------------------------ */
await withArtifacts('primeira-abertura-soltar',async ctx=>{
 const s=scenario('first-run-drop');
 const pdfs=path.join(s.runtime,'pdfs','Fisica');
 const other=path.join(s.runtime,'pdfs','Outra');
 fs.mkdirSync(pdfs,{recursive:true});fs.mkdirSync(other,{recursive:true});
 const a=path.join(pdfs,'Lista 1.pdf'),b=path.join(pdfs,'Lista 2.pdf'),c=path.join(other,'Prova.pdf'),txt=path.join(pdfs,'anotacoes.txt');
 fs.writeFileSync(a,tinyPdf('Lista 1',2));fs.writeFileSync(b,tinyPdf('Lista 2',2));fs.writeFileSync(c,tinyPdf('Prova',2));fs.writeFileSync(txt,'não é PDF');
 const hashes=new Map([a,b,c,txt].map(file=>[file,sha(file)]));
 const mine=path.join(s.runtime,'meus-dados');

 const {page,errors}=await boot(ctx,s);
 await walkTo(page,'name');
 await page.locator('#first-run-name').fill('Física');
 await walkTo(page,'folder');

 /* Não-PDF: avisa e continua no passo. */
 await dropOnSetup(page,[txt]);
 await toastWait(page,'Solte PDFs ou uma pasta de PDFs.');
 let f=await setupFacts(page);
 assert.equal(f.step,'folder');
 assert.equal(f.chosen,null);

 /* PDFs de duas pastas: vale a pasta do primeiro e o resto é avisado. */
 const over=await dropOnSetup(page,[a,b,c]);
 assert.equal(over,true,'durante o arraste a tela sinaliza o alvo');
 await toastWait(page,'1 item está em outra pasta e não entra na matéria.');
 f=await setupFacts(page);
 assert.equal(f.firstRun,'true','soltar não cria a matéria');
 assert.equal(f.chosen,'Pasta escolhida: '+pdfs);
 assert.equal(f.elsewhere,'1 item está em outra pasta e não entra na matéria.');
 assert.equal(f.next.disabled,false);
 await shot(page,'soltou-pdfs-claro-1440x900.png');

 /* "Mudar" a pasta de dados no pronto: o que a pessoa escolhe é o que fica gravado. */
 await walkTo(page,'ready');
 await stubPicker(ctx.app,[mine]);
 await page.locator('#first-run-data-change').click();
 await page.waitForFunction(p=>document.querySelector('.setup-path')?.textContent===p,mine);
 assert.equal(fs.existsSync(mine),false,'escolher a pasta de dados não a cria antes de confirmar');
 await clickNext(page);
 await page.waitForFunction(()=>!document.body.dataset.firstRun,undefined,{timeout:30000});
 await page.waitForSelector('.pdf-panel canvas',{timeout:30000});

 const cfg=s.readConfig();
 assert.deepEqual(cfg.courses.map(x=>({id:x.id,name:x.name,path:x.path})),[{id:'Física',name:'Física',path:pdfs}]);
 assert.equal(cfg.vaultPath,mine,'a pasta de dados escolhida em "Mudar" vai para o config.json local');
 assert.equal(fs.statSync(mine).isDirectory(),true);
 assert.equal(fs.existsSync(s.dataDefault),false,'a sugestão que ficou de fora não é criada');
 for(const [file,hash] of hashes)assert.equal(sha(file),hash,`${path.basename(file)} intacto`);
 assert.deepEqual(fs.readdirSync(pdfs).sort(),['Lista 1.pdf','Lista 2.pdf','anotacoes.txt'],'a pasta dos PDFs não ganhou arquivo nenhum');
 assert.equal((await setupFacts(page)).prompt.disabled,false);
 assert.deepEqual(errors,[]);

 /* Pasta solta: o host usa a pasta como a da matéria (o arrasto de pasta do
    sistema chega ao main como caminho; aqui o seam é o IPC do host). */
 const resolved=await ctx.app.evaluate(async({ipcMain},folder)=>ipcMain._invokeHandlers.get('first-run-resolve-drop')({},[folder]),other);
 assert.deepEqual({folder:resolved.folder,kind:resolved.kind,pdfCount:resolved.pdfCount,elsewhere:resolved.elsewhere,pdfNames:resolved.pdfNames},{folder:other,kind:'folder',pdfCount:1,elsewhere:0,pdfNames:['Prova.pdf']});
});

/* ------------------------------------------------------------------ */
/* D. quem já tem configuração nunca vê a primeira abertura              */
/* ------------------------------------------------------------------ */
await withArtifacts('primeira-abertura-existente',async ctx=>{
 const runtime=ctx.runtime=newRuntime('first-run-existing');
 const course=seedCourse(runtime,'Test');
 fs.writeFileSync(path.join(course,'Limites.pdf'),tinyPdf('Limites',3));
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'Test',name:'Cálculo',path:course}]});
 ctx.app=await launchDesk({runtime});
 const page=await ctx.app.firstWindow();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await statusOnline(page);
 await page.waitForSelector('.pdf-panel canvas',{timeout:30000});
 const f=await setupFacts(page);
 assert.equal(f.firstRun,null);
 assert.equal(f.setupShown,false);
 assert.equal(f.dialogOpen,false);
 assert.equal(f.deskInert,false);
 assert.equal(f.prompt.disabled,false);
 assert.deepEqual(errors,[]);
});

/* ------------------------------------------------------------------ */
/* E. pasta de dados válida e nenhuma matéria: começa no nome, sem pedir */
/*    a pasta de dados de novo (ticket #24)                              */
/* ------------------------------------------------------------------ */
await withArtifacts('primeira-abertura-sem-materia',async ctx=>{
 const s=scenario('first-run-no-course');
 const vault=path.join(s.runtime,'meus-dados');
 const pdfs=path.join(s.runtime,'pdfs','Algebra');
 fs.mkdirSync(vault,{recursive:true});fs.mkdirSync(pdfs,{recursive:true});
 fs.writeFileSync(path.join(pdfs,'Lista.pdf'),tinyPdf('Lista',2));
 const before=fs.readdirSync(pdfs).sort().map(n=>[n,sha(path.join(pdfs,n))]);
 fs.writeFileSync(s.configFile,JSON.stringify({runtimePath:s.runtime,vaultPath:vault,courses:[]}));

 const {page,errors}=await boot(ctx,s);
 let f=await setupFacts(page);
 assert.equal(f.firstRun,'true','pasta de dados válida e zero matérias cai na tela de passos');
 assert.equal(f.dialogOpen,false,'sem diálogo');
 assert.equal(f.step,'name','quem já conhece a Mesa começa no nome');
 assert.equal(f.focusId,'first-run-name');
 assert.equal(f.backShown,true);
 assert.equal(f.hScroll,false);

 for(const [theme,tag] of THEMES){
  await setTheme(page,theme);
  for(const size of [WIDE,MINIMUM]){
   await setSize(ctx.app,page,size);
   const m=await setupFacts(page);
   assert.equal(m.cardInside,true,`${tag} ${size}: o cartão cabe na janela`);
   assert.equal(m.hScroll,false,`${tag} ${size}: sem rolagem horizontal`);
   await shot(page,`sem-materia-${tag}-${size.join('x')}.png`);
  }
 }
 await setTheme(page,'light');
 await setSize(ctx.app,page,WIDE);

 await page.locator('#first-run-name').fill('Álgebra');
 await walkTo(page,'folder');
 await stubPicker(ctx.app,[pdfs]);
 await page.locator('#first-run-pick').click();
 await page.waitForFunction(()=>!document.querySelector('#setup-next').disabled);
 await walkTo(page,'ready');
 f=await setupFacts(page);
 assert.equal(f.path,vault,'a linha dos dados mostra a pasta que a Mesa já tem');
 assert.equal(f.changeShown,false,'a pasta de dados não é pedida de novo: sem "Mudar"');
 await clickNext(page);
 await page.waitForFunction(()=>!document.body.dataset.firstRun,undefined,{timeout:30000});
 await page.waitForSelector('.pdf-panel canvas',{timeout:30000});
 const cfg=s.readConfig();
 assert.deepEqual(cfg.courses.map(c=>({id:c.id,name:c.name,path:c.path})),[{id:'Álgebra',name:'Álgebra',path:pdfs}]);
 assert.equal(cfg.vaultPath,vault,'a pasta de dados segue a que já valia');
 assert.equal(fs.existsSync(s.dataDefault),false,'nenhuma pasta de dados nova nasce');
 assert.deepEqual(fs.readdirSync(pdfs).sort().map(n=>[n,sha(path.join(pdfs,n))]),before,'os PDFs não foram tocados');
 f=await setupFacts(page);
 assert.equal(f.setupShown,false);
 assert.equal(f.prompt.disabled,false);
 assert.equal(await page.evaluate(()=>document.querySelector('#course-tabs [data-id="Álgebra"]')?.getAttribute('aria-selected')),'true');

 /* Criar e depois apagar a matéria na mesma execução: a tela volta. */
 await page.keyboard.press('ControlOrMeta+,');
 await page.waitForSelector('#settings-dialog[open]');
 await page.locator('#cfg-courses .cfg-course').first().getByRole('button',{name:'Remover'}).click();
 await page.locator('#settings-save').click();
 await page.waitForFunction(()=>!document.querySelector('#settings-dialog').open);
 await page.waitForFunction(()=>document.body.dataset.firstRun==='true',undefined,{timeout:30000});
 f=await setupFacts(page);
 assert.equal(f.setupShown,true);
 assert.equal(f.step,'name');
 assert.deepEqual(s.readConfig().courses,[]);
 assert.deepEqual(errors,[]);
});

/* ------------------------------------------------------------------ */
/* F. apagar todas as matérias nas Configurações leva à mesma tela;      */
/*    quem tem matéria nunca vê esse estado (ticket #24)                 */
/* ------------------------------------------------------------------ */
await withArtifacts('primeira-abertura-apagou-tudo',async ctx=>{
 const s=scenario('first-run-deleted');
 const vault=path.join(s.runtime,'meus-dados');
 const pdfs=path.join(s.runtime,'pdfs','Calculo');
 fs.mkdirSync(vault,{recursive:true});fs.mkdirSync(pdfs,{recursive:true});
 fs.writeFileSync(path.join(pdfs,'Limites.pdf'),tinyPdf('Limites',2));
 fs.writeFileSync(s.configFile,JSON.stringify({runtimePath:s.runtime,vaultPath:vault,courses:[{id:'Cálculo',name:'Cálculo',path:pdfs}]}));

 ctx.runtime=s.runtime;
 ctx.app=await s.launch();
 let page=await ctx.app.firstWindow();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.waitForSelector('.pdf-panel canvas',{timeout:30000});
 await statusOnline(page);
 let f=await setupFacts(page);
 assert.equal(f.firstRun,null,'com matéria a tela nunca aparece');
 assert.equal(f.setupShown,false);

 /* Apaga a única matéria e salva: a tela aparece na hora, sem reabrir. */
 const removeOnly=async()=>{
  await page.keyboard.press('ControlOrMeta+,');
  await page.waitForSelector('#settings-dialog[open]');
  await page.locator('#cfg-courses .cfg-course').first().getByRole('button',{name:'Remover'}).click();
  await page.locator('#settings-save').click();
  await page.waitForFunction(()=>!document.querySelector('#settings-dialog').open);
  await page.waitForFunction(()=>document.body.dataset.firstRun==='true',undefined,{timeout:30000});
 };
 await removeOnly();
 f=await setupFacts(page);
 assert.equal(f.step,'name');
 assert.equal(f.focusId,'first-run-name');
 assert.deepEqual(s.readConfig().courses,[]);
 assert.equal(s.readConfig().vaultPath,vault);
 assert.deepEqual(errors,[]);

 /* A tela que voltou cria matéria de verdade e apagar de novo a traz outra vez. */
 await createThrough(ctx,page,'Cálculo',pdfs);
 assert.deepEqual(s.readConfig().courses.map(c=>c.id),['Cálculo'],'a matéria nasce pela tela que voltou');
 assert.equal(s.readConfig().vaultPath,vault,'a pasta de dados segue a mesma');
 await removeOnly();
 assert.deepEqual(s.readConfig().courses,[]);

 /* Reabrir: o estado persiste, sem diálogo. */
 await ctx.app.close();
 ctx.app=await s.launch();
 page=await ctx.app.firstWindow();
 await page.waitForSelector('body[data-first-run="true"]',{timeout:30000});
 f=await setupFacts(page);
 assert.equal(f.dialogOpen,false);
 assert.equal(f.setupShown,true);

 /* Adicionar uma matéria pelas Configurações (⌘, abre o diálogo por cima) tira a pessoa da tela. */
 await page.keyboard.press('ControlOrMeta+,');
 await page.waitForSelector('#settings-dialog[open]');
 const row=page.locator('#cfg-courses .cfg-course').last();
 await row.locator('.cfg-name').fill('Cálculo');
 await row.locator('.cfg-path').fill(pdfs);
 await page.locator('#settings-save').click();
 await page.waitForFunction(()=>!document.querySelector('#settings-dialog').open);
 await page.waitForFunction(()=>!document.body.dataset.firstRun,undefined,{timeout:30000});
 f=await setupFacts(page);
 assert.equal(f.setupShown,false);
 assert.equal(f.prompt.disabled,false);
});
console.log('first-run-ui OK');
