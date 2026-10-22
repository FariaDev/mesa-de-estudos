import {_electron as electron} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {testEnv} from './electron-env.mjs';
import {closeApp} from './proc-tree.mjs';
import {appendTimingRow} from './suite-tempos.mjs';

// Boot compartilhado dos smokes de UI (ui-smoke/subjects-ui) + artefatos de falha.
const here=path.dirname(fileURLToPath(import.meta.url));
export const DESK=path.resolve(here,'..');
export const FAKE_PI=path.join(DESK,'tests','fake-pi.mjs');
/** Texto do fake do Pi para um teste que grava uma variante dele noutra pasta.
 *  Os imports relativos (`./fake-pi-opencode.mjs`, #44) viram URL absoluta: a cópia
 *  não leva os vizinhos e morria com código 1 ao subir.
 *  @returns {string} ex.: `fs.writeFileSync(demo,fakePiSource().replace(marker,branch))` */
export function fakePiSource(){
 return fs.readFileSync(FAKE_PI,'utf8').replace(/from '\.\/([\w.-]+\.mjs)'/g,(_,file)=>`from ${JSON.stringify(pathToFileURL(path.join(DESK,'tests',file)).href)}`);
}
export const PLOT_PNG='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const ARTIFACTS=path.join(DESK,'tests','artifacts');

/* Todo runtime (e pasta de capturas em `tests/artifacts`) que o teste cria some
   quando o processo termina com 0; numa falha fica para investigação (e
   `MESA_KEEP_RUNTIME=1` o mantém mesmo no sucesso). */
const createdRuntimes=new Set();
process.once('exit',code=>{
 if(code!==0||process.env.MESA_KEEP_RUNTIME==='1')return;
 for(const dir of createdRuntimes){try{fs.rmSync(dir,{recursive:true,force:true});}catch{}}
});

/* Pasta de evidência com nome fixo: some quando o processo termina com 0
   (sucesso), fica quando falha ou com MESA_KEEP_RUNTIME=1. */
export function artifactDir(name){
 const dir=path.join(ARTIFACTS,name);
 fs.mkdirSync(dir,{recursive:true});
 createdRuntimes.add(dir);
 return dir;
}

/* Captura só quando alguém pediu (MESA_REVIEW_SHOTS): é material de revisão
   visual, nunca asserção, e custa tempo em cada tela. */
export async function reviewShot(target,dir,name){
 if(!process.env.MESA_REVIEW_SHOTS)return;
 await target.screenshot({animations:'disabled',path:path.join(dir,name)});
}

export function screenshotDirectory(tag){
 const requested=process.env.MESA_REVIEW_SHOTS;
 const root=requested&&requested!=='1'?path.resolve(requested):requested?path.join(DESK,'../docs/reviews',new Date().toISOString().slice(0,10)):ARTIFACTS;
 fs.mkdirSync(root,{recursive:true});
 const dir=fs.mkdtempSync(path.join(root,tag+'-'));
 if(root===ARTIFACTS)createdRuntimes.add(dir);
 return dir;
}

export function tinyPdf(text,repeat=1){
 /* Parêntese e barra sem escape quebram a string do PDF (#70: a fórmula do pdf-quote-ui). */
 const lines=(Array.isArray(text)?text:[text]).map(line=>String(line).replace(/[\\()]/g,'\\$&'));
 const contents=Array.from({length:repeat},(_,i)=>`BT /F1 16 Tf 72 ${720-i*30} Td (${lines[i%lines.length]}) Tj ET`).join('\n');
 const objects=['<</Type/Catalog/Pages 2 0 R>>','<</Type/Pages/Kids[3 0 R]/Count 1>>','<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Resources<</Font<</F1 4 0 R>>>>/Contents 5 0 R>>','<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>',`<</Length ${contents.length}>>\nstream\n${contents}\nendstream`];
 let out='%PDF-1.4\n';const offsets=[];
 objects.forEach((obj,i)=>{offsets.push(out.length);out+=`${i+1} 0 obj\n${obj}\nendobj\n`;});
 const startxref=out.length;
 out+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.map(off=>`${String(off).padStart(10,'0')} 00000 n \n`).join('')}trailer\n<</Size ${objects.length+1}/Root 1 0 R>>\nstartxref\n${startxref}\n%%EOF\n`;
 return Buffer.from(out,'latin1');
}

export function newRuntime(tag='run'){
 const runtime=path.resolve(DESK,'.test-runtime-'+Date.now()+'-'+tag);
 fs.mkdirSync(path.join(runtime,'learning','Courses'),{recursive:true});
 createdRuntimes.add(runtime);
 return runtime;
}
export function seedCourse(runtime,id){
 const dir=path.join(runtime,'learning','Courses',id);
 fs.mkdirSync(dir,{recursive:true});
 return dir;
}
export function seedPlot(runtime,course){
 const file=path.join(runtime,'learning','Courses',course,'plot.png');
 fs.mkdirSync(path.dirname(file),{recursive:true});
 fs.writeFileSync(file,Buffer.from(PLOT_PNG,'base64'));
 return file;
}
export function seedSession(runtime,records){
 const file=path.join(runtime,'pi-'+Date.now()+'.jsonl');
 fs.writeFileSync(file,records.map(record=>JSON.stringify(record)+'\n').join(''));
 return file;
}
export function writeDeskJson(runtime,data){fs.writeFileSync(path.join(runtime,'desk.json'),JSON.stringify(data));}
export function writeConfigJson(runtime,data){fs.writeFileSync(path.join(runtime,'config.json'),JSON.stringify(data));}

export function deskEnv(runtime,extra={},pi=true){
 const base={LEARNING_DESK_RUNTIME:runtime};
 if(pi)base.LEARNING_DESK_PI=FAKE_PI;
 return testEnv({...base,...extra});
}
/* O botão Conferir só habilita quando a captura de janela existe: o helper
   compilado do macOS (visual-check/windows, ignorado pelo git) ou, em modo de
   teste, um fixture. Os testes que apenas EXERCITAM o botão (com `capture-ready`
   trocado por um stub) usam este fixture e não dependem do helper: devolve o env
   para o `launchDesk`. */
export function captureFixtureEnv(runtime,env={}){
 const dataUrl='data:image/png;base64,'+PLOT_PNG;
 const file=path.join(runtime,'capture-fixture.json');
 fs.writeFileSync(file,JSON.stringify({windows:[{id:'1',app:'Xournal++',title:'Lista.xopp',bounds:{X:0,Y:0,Width:1200,Height:800},dataUrl}],dataUrl}));
 return {...env,LEARNING_DESK_CAPTURE_FIXTURE:file};
}
/* O corredor (`run-suite.mjs`) liga `MESA_LAUNCH_TIMES`: cada janela aberta
   deixa uma linha com o tempo do launch e o da janela pintada (primeiro frame
   depois do `load`), que decide se reaproveitar a janela compensa (#48). */
function recordLaunchTime(app,startedAt,launchedAt){
 const file=process.env.MESA_LAUNCH_TIMES;
 if(!file)return;
 const row={file:path.basename(process.argv[1]||''),launchMs:launchedAt-startedAt};
 app.firstWindow()
  .then(page=>page.waitForFunction(()=>document.readyState==='complete'&&new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(()=>done(true))))))
  .then(()=>appendTimingRow(file,{...row,paintMs:Date.now()-startedAt,ts:new Date().toISOString()}))
  .catch(()=>{/* app fechado antes de pintar: sem linha */});
}
export async function launchDesk({runtime,env={},pi=true,execPath=''}={}){
 fs.chmodSync(FAKE_PI,0o755);
 const fullEnv=deskEnv(runtime,env,pi);
 const bin=execPath||process.env.DESK_ELECTRON_BIN||'';
 const startedAt=Date.now();
 const app=bin
  ?await electron.launch({executablePath:bin,args:[],cwd:DESK,env:fullEnv})
  :await electron.launch({args:[path.join(DESK,'main.cjs')],cwd:DESK,env:fullEnv});
 recordLaunchTime(app,startedAt,Date.now());
 return app;
}

/* A janela da Mesa é a da página, nunca `BrowserWindow.getAllWindows()[0]`: a
   prévia do PDF e a medição das atividades abrem janelas escondidas que podem
   vir antes na lista e levar o redimensionamento, a medida ou o evento. */
export const pageWindow=(app,page)=>app.browserWindow(page);

/* Redimensiona a janela da página (`setSize`; `content:true` usa
   `setContentSize`) e só volta quando o renderer enxerga o tamanho novo em
   innerWidth/innerHeight. Um pedido que a janela não aceita (abaixo do mínimo
   de 900×650, por exemplo) é erro: medir no tamanho errado passaria calado. */
export async function resizeWindow(app,page,width,height,{content=false,timeout=10000}={}){
 const win=await pageWindow(app,page);
 const got=await win.evaluate((bw,[w,h,content])=>{
  if(content)bw.setContentSize(w,h);else bw.setSize(w,h);
  const [ow,oh]=content?bw.getContentSize():bw.getSize();
  const [cw,ch]=bw.getContentSize();
  const zoom=bw.webContents.getZoomFactor();
  return {ow,oh,inner:[Math.round(cw/zoom),Math.round(ch/zoom)]};
 },[width,height,content]);
 if(got.ow!==width||got.oh!==height)throw Error(`a janela não aceitou ${width}×${height}${content?' (conteúdo)':''}: ficou ${got.ow}×${got.oh}`);
 await page.waitForFunction(([w,h])=>innerWidth===w&&innerHeight===h,got.inner,{timeout});
 return {width:got.inner[0],height:got.inner[1]};
}

/* Sem configuração a Mesa abre na primeira abertura (a tela cheia de passos da
   #64, com a Mesa `inert` atrás). Os testes que querem o estudo avulso saem por
   "Estudar sem matéria", como a pessoa. */
export async function enterFree(page,{timeout=30000}={}){
 await page.waitForFunction(()=>!!document.body.dataset.firstRun||!!document.querySelector('#free-bar:not([hidden])'),undefined,{timeout});
 if(await page.evaluate(()=>!!document.body.dataset.firstRun)){
  await page.locator('#setup-free').click();
  await page.waitForFunction(()=>!document.body.dataset.firstRun,undefined,{timeout});
 }
 await page.waitForSelector('#free-bar:not([hidden])',{timeout});
}

export function toastWait(page,text,{timeout=8000}={}){
 return page.waitForFunction(t=>{
  const box=document.querySelector('#toast');
  return !!box&&[...box.querySelectorAll('.toast-item')].some(el=>!el.classList.contains('out')&&el.textContent.includes(t));
 },text,{timeout});
}
/* Fechado é o atributo [hidden], não o que o Playwright vê: na saída animada
   (#63, src/motion.css) o popover já tem [hidden] mas segue na tela por
   --t-fast, e `isVisible()` diria aberto até ele sumir. */
export function insideHidden(locator){
 return locator.evaluate(el=>!!el.closest('[hidden]'));
}
/* A barra da aba Livre guarda Montar PDF, Adicionar à matéria e Criar matéria no
   menu "Mais opções" (#free-more): abre o menu se preciso e clica no item. */
export async function freeMenuClick(page,selector){
 const item=page.locator(selector);
 if(await insideHidden(item)){
  await page.locator('#free-more').click();
  await item.waitFor({state:'visible'});
 }
 await item.click();
}
export function sendEnabled(page,{timeout=15000}={}){
 return page.waitForFunction(()=>!document.querySelector('#send').disabled,undefined,{timeout});
}
/* `attached`: ligado, o logo do modelo fica no lugar do ponto (2026-10-21). */
export function statusOnline(page,{timeout=30000}={}){
 return page.waitForSelector('#status-dot.online',{timeout,state:'attached'});
}
/* Tema pela mesma porta do app (`auto`, `light` ou `dark`). */
export async function setTheme(page,theme){
 await page.evaluate(async value=>{const state=await import('./src/state.mjs');state.applyTheme(value);},theme);
 await page.waitForTimeout(150);
}
/* A barra não tem mais o botão de tema: troca pela busca de comandos, como o usuário. */
export async function pickTheme(page,theme){
 const label={light:'Tema claro',dark:'Tema escuro',auto:'Tema automático'}[theme];
 await page.keyboard.press('ControlOrMeta+k');
 const input=page.locator('#command-palette .palette-input');
 await input.waitFor({timeout:5000});
 await input.fill(label);
 await page.waitForTimeout(250);
 await page.keyboard.press('Enter');
 await page.waitForFunction(t=>(document.documentElement.dataset.theme||'auto')===t,theme,{timeout:5000});
 await page.waitForFunction(()=>document.querySelector('#command-palette')?.hidden!==false,undefined,{timeout:5000});
}
/* Medidas e capturas estáveis: sem animação, transição nem cursor piscando. */
export async function freezeMotion(page){
 await page.addStyleTag({content:'*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}'});
 await page.waitForTimeout(120);
}

const ARTIFACT_FILE=/(\.jsonl$)|(\.log(\.\d+)?$)|(^desk\.json$)|(^config\.json$)|(ggb-bridge\.json$)/;
export async function saveArtifacts(ctx){
 const stamp=new Date().toISOString().replace(/[:.]/g,'-').replace(/Z$/,'');
 const dir=path.join(ARTIFACTS,`${stamp}-${ctx.block||'falha'}`);
 fs.mkdirSync(dir,{recursive:true});
 const runtime=ctx.runtime;
 if(runtime&&fs.existsSync(runtime)){
  for(const name of fs.readdirSync(runtime)){
   const full=path.join(runtime,name);
   try{
    if(fs.statSync(full).isFile()&&ARTIFACT_FILE.test(name))fs.copyFileSync(full,path.join(dir,name));
   }catch{}
  }
  const ggbDir=path.join(runtime,'ggb');
  if(fs.existsSync(ggbDir))fs.cpSync(ggbDir,path.join(dir,'ggb'),{recursive:true});
 }
 const pages=ctx.app?.windows?.()||[];
 let index=0;
 for(const page of pages){try{await page.screenshot({path:path.join(dir,`page-${++index}.png`)});}catch{}}
 console.error(`[artefatos] falha registrada em: ${dir}`);
 return dir;
}

// withArtifacts('<bloco>', async ctx=>{...}): em QUALQUER falha, copia o runtime do teste
// (desk.json, sessões, desk.log, ggb-bridge.json, ggb/) e um screenshot por janela aberta
// para desk/tests/artifacts/<timestamp>-<bloco>/ antes de rejeitar. No sucesso fecha o app
// e apaga o runtime, como antes. O fechamento tem prazo (`closeApp`): app preso no
// fechamento morre com SIGKILL e, se o teste tinha passado, reprova por isso.
export async function withArtifacts(block,run){
 const ctx={block,runtime:'',app:null};
 let ok=false,out,closeError=null;
 try{
  out=await run(ctx);
  ok=true;
 }catch(e){
  try{await saveArtifacts(ctx);}catch{}
  throw e;
 }finally{
  try{await closeApp(ctx.app);}catch(error){closeError=error;}
  if(closeError){try{await saveArtifacts(ctx);}catch{}}
  else if(ok&&ctx.runtime){try{fs.rmSync(ctx.runtime,{recursive:true,force:true});}catch{}}
 }
 /* Fora do finally (lint, #43 fase 3): o teste passou, mas o app não fechou. */
 if(closeError)throw closeError;
 return out;
}

/* Barra única do leitor (ticket #11): zoom, ajustar, inverter, girar, capturar,
   abrir outro PDF, numeração impressa e recolher moram no menu "Mais opções" de
   cada leitor. `menuLocator` devolve o locator do item como se ele estivesse à
   vista: o clique abre o menu do leitor antes; `.collapse` num leitor já
   recolhido clica a faixa, que o reabre. O resto (contagem, atributos,
   visibilidade, foco) é o do Playwright. `panel` é o locator do `.pdf-panel`. */
const MORE_ITEMS=new Set(['.in','.out','.fit','.invert','.rotate','.page-shot','.open','.printed-toggle','.collapse']);
export async function openMore(panel){
 const pop=panel.locator('.pdf-more-pop');
 if(await insideHidden(pop))await panel.locator('.more').click();
 await pop.waitFor({state:'visible',timeout:5000});
 return pop;
}
function wrapMore(panel,locator,head){
 return new Proxy(locator,{get(target,prop){
  if(prop==='click'&&head)return async options=>{
   if(head==='.collapse'&&await panel.evaluate(el=>el.classList.contains('minimized')))return panel.locator('.pdf-restore').click(options);
   await openMore(panel);
   return target.click(options);
  };
  if(['first','last','nth','locator','filter'].includes(prop))return (...args)=>wrapMore(panel,target[prop](...args),head);
  const value=Reflect.get(target,prop,target);
  return typeof value==='function'?value.bind(target):value;
 }});
}
export function menuLocator(panel,selector){
 const head=String(selector).trim().split(/[\s>]/)[0].replace(/[\[:].*$/,'');
 return wrapMore(panel,panel.locator(selector),MORE_ITEMS.has(head)?head:'');
}
export function moreClick(panel,selector,options){return menuLocator(panel,selector).click(options);}

/* Quantos caracteres de um texto de uma linha (com reticências) aparecem de fato:
   conta os que cabem na caixa do elemento e desconta o espaço das reticências. */
export const visibleChars=(page,selector)=>page.evaluate(sel=>{
 const el=document.querySelector(sel);if(!el)return 0;
 const box=el.getBoundingClientRect();
 const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);
 let count=0,node=walker.nextNode();
 while(node){
  for(let i=0;i<node.length;i++){
   const range=document.createRange();range.setStart(node,i);range.setEnd(node,i+1);
   const b=range.getBoundingClientRect();
   if(b.width&&b.left>=box.left-0.5&&b.right<=box.right+0.5)count++;
  }
  node=walker.nextNode();
 }
 return Math.max(0,count-(el.scrollWidth>el.clientWidth+0.5?1:0));
},selector);
/* Cabeçalho do tutor (ticket #13): o título da sessão abre a lista da matéria;
   sessão nova e Mais opções são menus. Os helpers abrem o menu como o usuário
   (um clique no gatilho) antes de tocar no item, e os itens que moravam no
   cabeçalho (`#export-chat`, `#end-day`, `#chat-collapse`) respondem por
   `tutorMore`. */
export const sessionTitle=async page=>(await page.locator('#session-title .session-title-text').textContent()).trim();
export const currentSession=page=>page.locator('#session-title').getAttribute('data-session');
export const currentEngine=page=>page.locator('#session-title').getAttribute('data-engine');
export async function openSessionList(page){
 const pop=page.locator('#conversations-pop');
 if(await insideHidden(pop))await page.locator('#session-title').click();
 await pop.waitFor({state:'visible',timeout:5000});
 return pop;
}
export async function closeSessionList(page){
 const pop=page.locator('#conversations-pop');
 if(!(await insideHidden(pop)))await page.locator('#conv-close').click();
 await pop.waitFor({state:'hidden',timeout:5000});
}
/* Linhas da lista (id = caminho do arquivo da sessão). */
export async function sessionRows(page){
 await openSessionList(page);
 return page.evaluate(()=>[...document.querySelectorAll('#conv-list .conv-row')].map(row=>({
  id:row.dataset.id,title:row.querySelector('.conv-title')?.textContent||'',meta:row.querySelector('.conv-meta')?.textContent||'',
  preview:row.querySelector('.conv-preview')?.textContent||'',current:row.classList.contains('current')
 })));
}
/* Abre a lista e escolhe a sessão pelo caminho do arquivo. */
export async function openSessionById(page,id){
 await openSessionList(page);
 await page.locator('#conv-list .conv-row').evaluateAll((rows,wanted)=>{
  const row=rows.find(item=>item.dataset.id===wanted);
  if(!row)throw Error('sessão não está na lista: '+wanted);
  row.click();
 },id);
}
/* A biblioteca de sessões (todas as matérias) mora no rodapé da lista. */
/* O contexto de estudo (questão ativa e rascunho .xopp) mora no popover da linha
   "Vai junto" (`#context-edit` → `#context-pop`), não mais solto na coluna. */
export async function openStudyContext(page){
 if(await insideHidden(page.locator('#context-pop')))await page.locator('#context-edit').click();
 await page.locator('#context-pop').waitFor({state:'visible'});
}
export async function closeStudyContext(page){
 if(!(await insideHidden(page.locator('#context-pop'))))await page.keyboard.press('Escape');
 await page.locator('#context-pop').waitFor({state:'hidden'});
}
export async function fillStudyTitle(page,text){
 await openStudyContext(page);
 await page.locator('#exercise-title').fill(text);
 await closeStudyContext(page);
}
export async function openSessionLibrary(page){
 await openSessionList(page);
 await page.locator('#conv-library').click();
}
export async function openNewSessionMenu(page){
 const pop=page.locator('#new-session-pop');
 if(await insideHidden(pop))await page.locator('#new-session').click();
 await pop.waitFor({state:'visible',timeout:5000});
 return pop;
}
export async function newSession(page,{claude=false,opencode=false}={}){
 await openNewSessionMenu(page);
 await page.locator(opencode?'#new-session-opencode':claude?'#new-session-claude':'#new-session-default').click();
}
export async function openTutorMore(page){
 const pop=page.locator('#chat-more-pop');
 if(await insideHidden(pop))await page.locator('#chat-more').click();
 await pop.waitFor({state:'visible',timeout:5000});
 return pop;
}
/* Item do Mais opções como se estivesse à vista: o clique abre o menu antes. */
export function tutorMore(page,selector){
 const target=page.locator(`#chat-more-pop ${selector}`);
 return new Proxy(target,{get(locator,prop){
  if(prop==='click')return async options=>{await openTutorMore(page);return locator.click(options);};
  const value=Reflect.get(locator,prop,locator);
  return typeof value==='function'?value.bind(locator):value;
 }});
}
/* Ids (caminhos) das sessões da matéria, sem abrir a lista. */
export const sessionIds=async page=>(await page.evaluate(()=>window.desk.conversations())).map(item=>item.id);
export const sessionLocked=page=>page.locator('#session-title').isDisabled();

/* Popover do indicador de modelo e esforço (ticket #14): abre pelo clique, como
   o usuário, e espera os campos. Troca de modelo e esforço passa por aqui. */
export async function openModelPop(page){
 const pop=page.locator('#model-pop');
 if(await insideHidden(pop))await page.locator('#model-indicator').click();
 await pop.waitFor({state:'visible',timeout:5000});
 return pop;
}
/* O seletor de modelo (#59) é uma lista com busca, não um <select>: as linhas são
   `[role=option][data-key]`, com a chave `["provedor","id"]` do host. */
export const modelRowSelector=(provider,id)=>`#model-list [role="option"][data-key='${JSON.stringify([provider,id])}']`;
/** Abre o popover (se preciso) e clica a linha do modelo. */
export async function pickModel(page,provider,id){
 await openModelPop(page);
 await page.locator(modelRowSelector(provider,id)).first().click();
}
/** A chave `["provedor","id"]` da linha marcada como em uso ('' se nenhuma). */
export const selectedModelKey=page=>page.evaluate(()=>document.querySelector('#model-list [role="option"][data-key][aria-selected="true"]')?.dataset.key||'');
/** Escolhe um nível na faixa de esforço do popover (acabamento da #59: botões, não um <select>). */
export async function pickEffort(page,level){
 await openModelPop(page);
 await page.locator(`#effort-strip [role="radio"][data-level="${level}"]`).click();
}
/** A faixa de esforço: níveis, o marcado, se está travada e o `title` (como ajustar). */
export const effortState=page=>page.evaluate(()=>{
 const strip=document.querySelector('#effort-strip');
 return {levels:[...strip.querySelectorAll('[role="radio"]')].map(button=>button.dataset.level),value:strip.querySelector('[aria-checked="true"]')?.dataset.level||'',locked:strip.getAttribute('aria-disabled')==='true',title:strip.title};
});
/** O seletor travado (turno, tutor desligado, estado incerto). */
export const modelPickerLocked=page=>page.evaluate(()=>document.querySelector('#model-list')?.getAttribute('aria-disabled')==='true');
/** Nome e detalhe de cada linha escolhível, na ordem da tela. */
export const modelRows=page=>page.evaluate(()=>[...document.querySelectorAll('#model-list [role="option"][data-key]')].map(row=>({
 key:row.dataset.key,name:row.querySelector('.model-row-name')?.textContent||'',note:row.querySelector('.model-row-note')?.textContent||'',
 free:row.dataset.free==='1',paid:row.dataset.zenPaid==='1',selected:row.getAttribute('aria-selected')==='true'})));
export async function closeModelPop(page){
 if(!(await insideHidden(page.locator('#model-pop')))){
  await page.keyboard.press('Escape');
  await page.locator('#model-pop').waitFor({state:'hidden',timeout:5000});
 }
}
/* Texto visível do indicador ("Sonnet · médio" ou o estado do tutor). */
export function indicatorText(page){
 /* O texto inteiro do indicador (modelo · esforço), qualquer que seja o degrau
    da fileira (#42: em caixa estreita o esforço sai da vista, não do texto). */
 return page.locator('#model-indicator .mi-text').textContent().then(text=>text.replace(/\s+/g,' ').trim());
}

/* Área de apoio sem barra de abas (ticket #19): o chat lateral abre pelo botão
   do cabeçalho do tutor e fecha pelo próprio cabeçalho; o Formulário volta pelo
   menu Estudar ou pela faixa de reabrir. Cada auxiliar leva a área ao estado
   pedido sem desfazer o que já está lá. */
export async function showSidechat(page){
 const toggle=page.locator('#sidechat-toggle');
 if(await toggle.getAttribute('aria-pressed')!=='true')await toggle.click();
 await page.waitForFunction(()=>{const el=document.querySelector('#sidechat');return el&&!el.hidden;},undefined,{timeout:15000});
}
export async function closeSidechat(page){
 if(await page.locator('#sidechat').isVisible()){
  await page.locator('#sidechat-close').click();
  await page.waitForFunction(()=>document.querySelector('#sidechat')?.hidden===true,undefined,{timeout:5000});
 }
}
/* Alterna o segundo leitor pelo item Formulário do menu Estudar (o mesmo gesto
   do usuário); `want` liga ou desliga, sem valor só alterna. */
export async function toggleForm(page,want){
 const toggle=page.locator('#reference-toggle');
 const pressed=(await toggle.getAttribute('aria-pressed'))==='true';
 if(want!==undefined&&want===pressed)return;
 await page.locator('#study-menu .nav-trigger').click();
 await toggle.click();
 if(await page.locator('#study-menu.open').count())await page.keyboard.press('Escape');
}
/* O Formulário (segundo leitor) à vista: fecha o chat lateral ou reabre a faixa. */
export async function showForm(page){
 if(await page.locator('#sidechat').isVisible()){await closeSidechat(page);return;}
 if(await page.locator('#support-restore').isVisible())await page.locator('#support-restore').click();
}
/* Nada na área de apoio além da faixa de reabrir (dois leitores) ou do leitor
   sozinho (um leitor). */
export async function collapseSupport(page){
 await closeSidechat(page);
 if((await page.locator('#reference-toggle').getAttribute('aria-pressed'))==='true')await toggleForm(page,false);
}
