/* Caça a bugs da Mesa (onda de views do Bend). Roda com o mesmo boot do
   ui-smoke (Playwright + fake Pi + runtime temporário), mas em vez de parar no
   primeiro assert, registra cada falha com screenshot e mantém o runtime para
   evidência. Uso: node tests/hunt-shell.mjs [filtro]

   NUNCA roda o app real: só helpers.mjs (LEARNING_DESK_RUNTIME temporário). */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {launchDesk,newRuntime,seedCourse,seedPlot,seedSession,writeDeskJson,writeConfigJson,tinyPdf,toastWait,sendEnabled,statusOnline,PLOT_PNG} from './helpers.mjs';

const DESK=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const STAMP=new Date().toISOString().replace(/[:.]/g,'-').replace(/Z$/,'');
const ART=path.join(DESK,'tests','artifacts',`hunt-shell-${STAMP}`);
fs.mkdirSync(ART,{recursive:true});
const slice=(s,n=60)=>String(s??'').replace(/\s+/g,' ').trim().slice(0,n);
const slug=s=>String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,50);

const all=[];
class Scenario{
 constructor(title,{saveOnPass=false}={}){
  this.title=title;this.saveOnPass=saveOnPass;this.steps=0;this.failures=[];this.notes=[];
  this.runtime=newRuntime(slug(title)||'hunt');
  this.app=null;this.page=null;this.errors=[];this.consoleErrors=[];
 }
 async launch(opts={}){
  this.app=await launchDesk({runtime:this.runtime,...opts});
  this.page=await this.app.firstWindow();
  this.page.on('pageerror',e=>this.errors.push(String(e.message||e)));
  this.page.on('console',m=>{if(m.type()==='error')this.consoleErrors.push(m.text());});
  return this.page;
 }
 async step(name,fn,{shot=false}={}){
  this.steps++;
  try{
   await fn();
   console.log(`  ok   ${name}`);
  }catch(e){
   const msg=String(e?.message||e);
   this.failures.push({name,error:msg});
   console.log(`  FAIL ${name}\n       ${slice(msg,220)}`);
   try{await this.page?.screenshot({path:path.join(ART,`${slug(this.title)}-${String(this.failures.length).padStart(2,'0')}-${slug(name)}.png`)});}catch{}
   try{await this.clean();}catch{}
  }
 }
 /* Devolve a UI ao neutro depois de uma falha (diálogos/menus abertos via Esc). */
 async clean(){
  if(!this.page)return;
  await this.page.keyboard.press('Escape').catch(()=>{});
  await this.page.keyboard.press('Escape').catch(()=>{});
  await this.page.mouse.move(5,400).catch(()=>{});
 }
 note(text){this.notes.push(text);console.log(`  note ${text}`);}
 async close(){
  for(const err of this.errors)this.consoleErrors.push('pageerror: '+err);
  try{if(this.app)await this.app.close();}catch{}
 }
 finish(){
  const ok=this.failures.length===0;
  if(ok&&!this.saveOnPass){try{fs.rmSync(this.runtime,{recursive:true,force:true});}catch{}}
  else{
   const dir=path.join(ART,slug(this.title));
   fs.mkdirSync(dir,{recursive:true});
   try{
    for(const name of fs.readdirSync(this.runtime)){
     const full=path.join(this.runtime,name);
     try{if(fs.statSync(full).isFile())fs.copyFileSync(full,path.join(dir,name));}catch{}
    }
    const log=this.page&&fs.existsSync(path.join(this.runtime,'desk.log'))?fs.readFileSync(path.join(this.runtime,'desk.log'),'utf8'):'';
    if(log)fs.writeFileSync(path.join(dir,'desk.log.txt'),log);
    if(this.consoleErrors.length)fs.writeFileSync(path.join(dir,'console.log'),this.consoleErrors.join('\n'));
   }catch{}
  }
  const entry={title:this.title,steps:this.steps,failures:this.failures,consoleErrors:this.consoleErrors,notes:this.notes,ok};
  all.push(entry);
  console.log(`\n${ok?'PASSED':'FALHOU'} ${this.title} (${this.steps} passos, ${this.failures.length} falha(s))`);
  if(this.consoleErrors.length)console.log('  console:',this.consoleErrors.map(e=>slice(e,160)).join(' | '));
  for(const n of this.notes)console.log('  ·',n);
  return entry;
 }
}

const filter=process.argv[2]||'';
const only=title=>!filter||title.toLowerCase().includes(filter.toLowerCase());

/* ------------------------------------------------------------------ */
/* H1: menus (#study-menu / #mesa-menu)                                */
/* ------------------------------------------------------------------ */
if(only('menus')){
 const s=new Scenario('menus abertura foco e itens');
 try{
  seedCourse(s.runtime,'A');seedCourse(s.runtime,'B');
  writeDeskJson(s.runtime,{courseId:'A'});
  writeConfigJson(s.runtime,{vaultPath:s.runtime,courses:[{id:'A',name:'Matéria A',path:path.join(s.runtime,'learning','Courses','A')},{id:'B',name:'Matéria B',path:path.join(s.runtime,'learning','Courses','B')}]});
  await s.launch();
  const page=s.page;
  await page.waitForSelector('.pdf-panel',{timeout:30000});
  await statusOnline(page);

  await s.step('abre pelo clique, marca open/aria-expanded',async()=>{
   await page.locator('#mesa-menu .nav-trigger').click();
   const st=await page.evaluate(()=>({cls:document.querySelector('#mesa-menu').className,exp:document.querySelector('#mesa-menu .nav-trigger').getAttribute('aria-expanded'),popDisplay:getComputedStyle(document.querySelector('#mesa-pop')).display}));
   assert.equal(st.exp,'true');
   assert.ok(st.cls.includes('open'));
   assert.notEqual(st.popDisplay,'none');
  });

  await s.step('Esc fecha, aria-expanded volta e foco não fica preso',async()=>{
   await page.keyboard.press('Escape');
   await page.waitForFunction(()=>!document.querySelector('#mesa-menu').classList.contains('open'));
   const st=await page.evaluate(()=>({exp:document.querySelector('#mesa-menu .nav-trigger').getAttribute('aria-expanded'),active:document.activeElement?.id||document.activeElement?.tagName,closing:document.querySelector('#mesa-menu').classList.contains('closing')}));
   assert.equal(st.exp,'false');
   assert.notEqual(st.active,'help');
  });

  await s.step('clique fora fecha sem animação pendente',async()=>{
   await page.locator('#study-menu .nav-trigger').click();
   assert.ok(await page.evaluate(()=>document.querySelector('#study-menu').classList.contains('open')));
   await page.mouse.click(5,400);
   const st=await page.evaluate(()=>({open:document.querySelector('#study-menu').classList.contains('open'),closing:document.querySelector('#study-menu').classList.contains('closing'),exp:document.querySelector('#study-menu .nav-trigger').getAttribute('aria-expanded')}));
   assert.equal(st.open,false);assert.equal(st.exp,'false');
  });

  await s.step('itens do menu Mesa e do Estudar têm ids/handlers',async()=>{
   const ids=await page.locator('#study-pop button[role="menuitem"]').evaluateAll(es=>es.map(e=>e.id));
   assert.deepEqual(ids,['reference-toggle','xournal']);
   await page.locator('#study-menu .nav-trigger').click();
   const pressed=await page.locator('#reference-toggle').getAttribute('aria-pressed');
   assert.equal(pressed,'true');
   await page.locator('#reference-toggle').click();
   assert.equal(await page.locator('.pdf-panel').nth(1).isVisible(),false);
   assert.equal(await page.locator('#reference-toggle').getAttribute('aria-pressed'),'false');
   await page.locator('#reference-toggle').click();
   await page.keyboard.press('Escape');
  });

  await s.step('item do menu abre diálogo e o menu não fica preso atrás',async()=>{
   await page.locator('#mesa-menu .nav-trigger').click();
   await page.locator('#help').click();
   await page.waitForSelector('#help-dialog[open]');
   await page.locator('#help-dialog .dialog-actions .primary').click();
   await page.waitForFunction(()=>!document.querySelector('#help-dialog').open);
   const st=await page.evaluate(()=>({open:document.querySelector('#mesa-menu').classList.contains('open'),exp:document.querySelector('#mesa-menu .nav-trigger').getAttribute('aria-expanded')}));
   if(st.open||st.exp==='true')s.note(`menu Mesa continua ${st.open?'open':'fechado'} com aria-expanded=${st.exp} depois de abrir/fechar um diálogo por ele`);
   assert.equal(st.exp,st.open?'true':'false');
  });

  await s.step('re-render dos menus (tema) mantém o aberto e os handlers',async()=>{
   await page.locator('#mesa-menu .nav-trigger').click();
   await page.locator('#theme-cycle').click();
   assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),'light');
   const open=await page.evaluate(()=>document.querySelector('#mesa-menu').classList.contains('open'));
   assert.equal(open,true,'re-render não deve fechar o menu aberto');
   const label=(await page.locator('#theme-cycle').textContent()).trim();
   assert.equal(label,'Tema: claro','rótulo re-renderizado');
   await page.locator('#theme-cycle').click();
   assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),'dark');
   await page.keyboard.press('Escape');
  });

  await s.step('Enter no gatilho abre e fecha (sem click duplicado)',async()=>{
   await page.locator('#mesa-menu .nav-trigger').focus();
   await page.keyboard.press('Enter');
   await page.waitForFunction(()=>document.querySelector('#mesa-menu').classList.contains('open'));
   await page.keyboard.press('Enter');
   await page.waitForFunction(()=>!document.querySelector('#mesa-menu').classList.contains('open'));
   assert.equal(await page.locator('#mesa-menu .nav-trigger').getAttribute('aria-expanded'),'false');
  });

  await s.step('foco dentro do menu: Esc fecha e tira o foco',async()=>{
   await page.locator('#mesa-menu .nav-trigger').click();
   await page.locator('#help').focus();
   assert.equal(await page.evaluate(()=>document.activeElement?.id),'help');
   await page.keyboard.press('Escape');
   await page.waitForFunction(()=>!document.querySelector('#mesa-menu').classList.contains('open'));
   assert.equal(await page.evaluate(()=>document.activeElement?.id),'','Esc tira o foco do item do menu');
  });

  await s.step('Salvar não quebra o ciclo de tema nem o menu',async()=>{
   await page.keyboard.press('ControlOrMeta+,');
   await page.waitForSelector('#settings-dialog[open]');
   await page.locator('#settings-save').click();
   await page.waitForFunction(()=>!document.querySelector('#settings-dialog').open,undefined,{timeout:15000});
   await page.waitForFunction(()=>document.querySelector('#theme-cycle')?.textContent.includes('Tema'));
   await page.waitForTimeout(600);
   const before=await page.evaluate(()=>document.documentElement.dataset.theme||'auto');
   const next={auto:'light',light:'dark',dark:'auto'}[before];
   await page.locator('#mesa-menu .nav-trigger').click();
   await page.locator('#theme-cycle').click();
   const after=await page.evaluate(()=>document.documentElement.dataset.theme||'auto');
   assert.equal(after,next,'o tema cicla depois do re-render do Salvar');
   assert.equal(await page.evaluate(()=>document.querySelector('#mesa-menu').classList.contains('open')),true,'o menu segue aberto');
   assert.equal((await page.locator('#theme-cycle').textContent()).trim(),`Tema: ${{auto:'auto',light:'claro',dark:'escuro'}[next]}`,'o rótulo acompanha o ciclo');
   await page.keyboard.press('Escape');
   await page.waitForFunction(()=>!document.querySelector('#mesa-menu').classList.contains('open'));
  });

  await s.step('⌘2 troca para a segunda matéria',async()=>{
   await page.keyboard.press('ControlOrMeta+2');
   await page.waitForFunction(()=>document.querySelector('#course-tabs button[data-id="B"]')?.classList.contains('active'),undefined,{timeout:30000});
   assert.match(await page.title(),/B/);
   await page.keyboard.press('ControlOrMeta+1');
   await page.waitForFunction(()=>document.querySelector('#course-tabs button[data-id="A"]')?.classList.contains('active'),undefined,{timeout:30000});
  });
 }finally{await s.close();}
 s.finish();
}

/* ------------------------------------------------------------------ */
/* H2: dicas (tooltip.mjs)                                             */
/* ------------------------------------------------------------------ */
if(only('tooltip')){
 const s=new Scenario('tooltip hover foco bordas dialog');
 try{
  seedCourse(s.runtime,'A');
  writeDeskJson(s.runtime,{courseId:'A'});
  writeConfigJson(s.runtime,{vaultPath:s.runtime,courses:[{id:'A',name:'Matéria A',path:path.join(s.runtime,'learning','Courses','A')}]});
  await s.launch();
  const page=s.page;
  await page.waitForSelector('.pdf-panel',{timeout:30000});

  await s.step('hover troca title → data-tip e volta ao sair',async()=>{
   await page.locator('#new-tab').hover();
   await page.waitForSelector('.tip:not([hidden])',{timeout:5000});
   assert.equal((await page.locator('.tip').textContent()).trim(),'Nova matéria (abre as Configurações)');
   assert.equal(await page.locator('#new-tab').getAttribute('title'),null);
   assert.equal(await page.locator('#new-tab').getAttribute('data-tip'),'Nova matéria (abre as Configurações)');
   await page.mouse.move(5,400);
   await page.waitForFunction(()=>document.querySelector('#new-tab').hasAttribute('title'),undefined,{timeout:5000});
   assert.equal(await page.evaluate(()=>document.querySelector('#new-tab').dataset.tip),undefined);
  });

  await s.step('foco por teclado mostra o balão do mesmo alvo',async()=>{
   await page.locator('#export-chat').focus();
   await page.waitForSelector('.tip:not([hidden])',{timeout:5000});
   assert.equal((await page.locator('.tip').textContent()).trim(),'Exportar conversa em Markdown');
   await page.locator('#prompt').focus();
   await page.waitForFunction(()=>document.querySelector('.tip')?.hidden===true,undefined,{timeout:5000});
   assert.ok(await page.locator('#export-chat').getAttribute('title'),'title volta ao sair do foco');
  });

  await s.step('alvo colado na borda direita: balão clampado',async()=>{
   await page.locator('#export-chat').hover();
   await page.waitForSelector('.tip:not([hidden])',{timeout:5000});
   const geo=await page.evaluate(()=>{const b=document.querySelector('.tip').getBoundingClientRect();return {left:b.left,right:b.right,w:innerWidth,h:innerHeight,top:b.top,bottom:b.bottom};});
   assert.ok(geo.left>=8-0.5,`left=${geo.left}`);
   assert.ok(geo.right<=geo.w-8+0.5,`right=${geo.right} w=${geo.w}`);
   await page.mouse.move(5,400);
  });

  await s.step('alvo no topo abre para baixo; no rodapé abre para cima',async()=>{
   await page.locator('#new-tab').hover();
   await page.waitForSelector('.tip:not([hidden])',{timeout:5000});
   const top=await page.evaluate(()=>{const tip=document.querySelector('.tip'),t=document.querySelector('#new-tab').getBoundingClientRect(),b=tip.getBoundingClientRect();return {below:tip.classList.contains('below'),gap:b.top-t.bottom};});
   assert.equal(top.below,true,'alvo no topo flipa o balão para baixo');
   assert.ok(top.gap>=7,'balão abaixo com respiro');
   await page.mouse.move(5,400);
   await page.locator('#attach').hover();
   await page.waitForSelector('.tip:not([hidden])',{timeout:5000});
   const bottom=await page.evaluate(()=>{const tip=document.querySelector('.tip'),t=document.querySelector('#attach').getBoundingClientRect(),b=tip.getBoundingClientRect();return {below:tip.classList.contains('below'),gap:t.top-b.bottom};});
   assert.equal(bottom.below,false,'alvo no rodapé abre para cima');
   assert.ok(bottom.gap>=7,'balão acima com respiro');
   await page.mouse.move(5,400);
  });

  await s.step('dentro de dialog em top-layer o balão vive no dialog',async()=>{
   await page.locator('#mesa-menu .nav-trigger').click();
   await page.locator('#help').click();
   await page.waitForSelector('#help-dialog[open]');
   // o markup do diálogo não traz title; dá um ao botão para exercitar o host()
   await page.evaluate(()=>{document.querySelector('#keys-customize').title='Personalizar atalhos';});
   await page.locator('#keys-customize').hover();
   await page.waitForSelector('.tip:not([hidden])',{timeout:5000});
   const st=await page.evaluate(()=>({parent:document.querySelector('.tip').parentElement.id,text:document.querySelector('.tip').textContent}));
   assert.equal(st.parent,'help-dialog');
   assert.equal(st.text,'Personalizar atalhos');
   await page.keyboard.press('Escape');
   await page.waitForFunction(()=>!document.querySelector('#help-dialog').open);
   await page.mouse.move(5,400);
   await page.evaluate(()=>{document.querySelector('#keys-customize')?.removeAttribute('title');});
  });

  await s.step('Esc esconde o balão e o title só volta ao sair do alvo',async()=>{
   await page.locator('#new-tab').hover();
   await page.waitForSelector('.tip:not([hidden])',{timeout:5000});
   await page.keyboard.press('Escape');
   await page.waitForFunction(()=>document.querySelector('.tip')?.hidden===true,undefined,{timeout:5000});
   assert.equal(await page.locator('#new-tab').getAttribute('data-tip'),'Nova matéria (abre as Configurações)');
   await page.mouse.move(5,400);
   await page.waitForFunction(()=>document.querySelector('#new-tab').hasAttribute('title'),undefined,{timeout:5000});
  });

  await s.step('alvo removido no meio do hover não vaza balão nem erro',async()=>{
   await page.locator('#study-menu .nav-trigger').click();
   await page.evaluate(()=>{document.querySelector('#xournal').title='Abrir o Xournal++';});
   await page.locator('#xournal').hover();
   await page.waitForSelector('.tip:not([hidden])',{timeout:5000});
   // re-render dos menus no meio do hover, sem mexer o ponteiro: o item #xournal é recriado
   await page.evaluate(()=>document.querySelector('#theme-cycle').click());
   await page.mouse.move(5,400);
   await page.waitForTimeout(300);
   const st=await page.evaluate(()=>({hidden:document.querySelector('.tip')?.hidden,text:document.querySelector('.tip')?.textContent,stale:document.querySelector('#xournal')?.dataset.tip}));
   if(st.hidden===false)s.note(`balão ficou visível com alvo removido (texto ${JSON.stringify(st.text)})`);
   assert.notEqual(st.hidden,false,'balão precisa sumir quando o alvo sai do DOM');
   assert.equal(st.stale,undefined,'nó novo não herda data-tip do antigo');
   await page.keyboard.press('Escape');
  });

  await s.step('sem erros de página no ciclo',async()=>{
   assert.deepEqual(s.errors,[]);
  });
 }finally{await s.close();}
 s.finish();
}

/* ------------------------------------------------------------------ */
/* H3: densidade e avisos                                              */
/* ------------------------------------------------------------------ */
if(only('density')){
 const s=new Scenario('densidade avisos re-render foco');
 try{
  seedCourse(s.runtime,'A');
  writeDeskJson(s.runtime,{courseId:'A'});
  writeConfigJson(s.runtime,{vaultPath:s.runtime,courses:[{id:'A',name:'Matéria A',path:path.join(s.runtime,'learning','Courses','A')}]});
  await s.launch();
  const page=s.page;
  await page.waitForSelector('.pdf-panel',{timeout:30000});
  await page.locator('#mesa-menu .nav-trigger').click();
  await page.locator('#settings').click();
  await page.waitForSelector('#settings-dialog[open]');

  await s.step('opções e selected do modo padrão',async()=>{
   assert.deepEqual(await page.locator('#density-mode option').evaluateAll(es=>es.map(o=>o.value)),['padrao','compacta']);
   assert.equal(await page.locator('#density-mode option[selected]').getAttribute('value'),'padrao');
   assert.equal(await page.evaluate(()=>document.body.classList.contains('dense')),false);
  });

  await s.step('selecionar compacta mantém o foco no select re-renderizado',async()=>{
   await page.locator('#density-mode').focus();
   await page.locator('#density-mode').selectOption('compacta');
   await page.waitForFunction(()=>document.body.classList.contains('dense'));
   assert.equal(await page.evaluate(()=>document.activeElement?.id),'density-mode','foco precisa sobreviver ao render do núcleo');
   assert.equal(await page.locator('#density-mode').inputValue(),'compacta');
   assert.equal(await page.evaluate(()=>localStorage.getItem('mesa.density')),'compacta');
  });

  await s.step('check de aviso mantém foco e marcação no re-render',async()=>{
   await page.locator('#notify-focused').click();
   await page.waitForFunction(()=>JSON.parse(localStorage.getItem('mesa.notify')||'{}').focused===true);
   assert.equal(await page.evaluate(()=>document.activeElement?.id),'notify-focused','foco precisa sobreviver ao render dos avisos');
   assert.equal(await page.locator('#notify-focused').isChecked(),true);
   const rows=await page.locator('#notify-mode .set-check').count();
   assert.equal(rows,3);
   const legend=await page.locator('#notify-mode > .set-group-label').textContent();
   assert.equal(legend,'Avisos de conclusão');
   await page.locator('#notify-focused').click();
  });

  await s.step('fechar e reabrir Configurações preserva modo e marcações',async()=>{
   await page.locator('#settings-dialog button[value="cancel"]').last().click();
   await page.waitForFunction(()=>!document.querySelector('#settings-dialog').open);
   assert.equal(await page.evaluate(()=>document.body.classList.contains('dense')),true);
   await page.locator('#mesa-menu .nav-trigger').click();
   await page.locator('#settings').click();
   await page.waitForSelector('#settings-dialog[open]');
   assert.equal(await page.locator('#density-mode option[selected]').getAttribute('value'),'compacta');
   assert.deepEqual(await page.locator('#notify-mode input').evaluateAll(es=>es.map(e=>[e.id,e.checked])),[['notify-sound',true],['notify-desktop',true],['notify-focused',false]]);
   await page.locator('#settings-dialog button[value="cancel"]').last().click();
  });

  await s.step('densidade não perde seleção com o diálogo reaberto pelo tema/atalho',async()=>{
   await page.keyboard.press('ControlOrMeta+,');
   await page.waitForSelector('#settings-dialog[open]');
   assert.equal(await page.locator('#density-mode').inputValue(),'compacta');
   await page.locator('#settings-dialog button[value="cancel"]').last().click();
   await page.waitForFunction(()=>!document.querySelector('#settings-dialog').open);
  });

  await s.step('sem erros de página',async()=>{
   assert.deepEqual(s.errors,[]);
  });
 }finally{await s.close();}
 s.finish();
}

/* ------------------------------------------------------------------ */
/* H4: Configurações, ajuda, sobre, Encerrar                           */
/* ------------------------------------------------------------------ */
if(only('dialogs')){
 const s=new Scenario('dialogos settings ajuda sobre encerrar');
 try{
  seedCourse(s.runtime,'A');
  writeDeskJson(s.runtime,{courseId:'A'});
  writeConfigJson(s.runtime,{vaultPath:s.runtime,courses:[{id:'A',name:'Matéria A',path:path.join(s.runtime,'learning','Courses','A')}]});
  await s.launch();
  const page=s.page;
  await page.waitForSelector('.pdf-panel',{timeout:30000});
  await statusOnline(page);

  await s.step('Configurações abre com título/lead e linhas',async()=>{
   await page.keyboard.press('ControlOrMeta+,');
   await page.waitForSelector('#settings-dialog[open]');
   assert.equal(await page.locator('#settings-title').textContent(),'Configurações');
   const rows=await page.locator('#cfg-courses .cfg-course').count();
   assert.ok(rows>=1);
   const first=page.locator('#cfg-courses .cfg-course').first();
   assert.ok((await first.locator('.cfg-name').inputValue()).length>0);
   assert.ok((await first.locator('.cfg-path').inputValue()).length>0);
  });

  await s.step('Adicionar/Remover linha e Cancelar não salva',async()=>{
   const before=await page.locator('#cfg-courses .cfg-course').count();
   await page.locator('#cfg-add-course').click();
   await page.locator('#cfg-courses .cfg-course').last().locator('.cfg-name').fill('Fantasma');
   assert.equal(await page.locator('#cfg-courses .cfg-course').count(),before+1);
   await page.locator('#settings-dialog button[value="cancel"]').last().click();
   await page.waitForFunction(()=>!document.querySelector('#settings-dialog').open);
   await page.keyboard.press('ControlOrMeta+,');
   await page.waitForSelector('#settings-dialog[open]');
   assert.equal(await page.locator('#cfg-courses .cfg-course').count(),before,'Cancelar não pode salvar a linha nova');
   const names=await page.locator('#cfg-courses .cfg-name').evaluateAll(es=>es.map(e=>e.value));
   assert.ok(!names.includes('Fantasma'));
  });

  await s.step('Salvar uma matéria nova atualiza abas e renderiza sem erro',async()=>{
   const dirB=seedCourse(s.runtime,'B2');
   await page.locator('#cfg-add-course').click();
   const row=page.locator('#cfg-courses .cfg-course').last();
   await row.locator('.cfg-name').fill('Matéria B2');
   await row.locator('.cfg-path').fill(dirB);
   await page.locator('#settings-save').click();
   await page.waitForFunction(()=>!document.querySelector('#settings-dialog').open,undefined,{timeout:10000});
   await page.waitForFunction(()=>[...document.querySelectorAll('#course-tabs button')].some(b=>b.textContent.includes('Matéria B2')),undefined,{timeout:10000});
   // em modo de teste o config.json não é persistido (persistConfig=!LEARNING_DESK_RUNTIME);
   // a fonte da verdade é o retorno do saveConfig, refletido na UI
   await page.keyboard.press('ControlOrMeta+,');
   await page.waitForSelector('#settings-dialog[open]');
   assert.equal(await page.locator('#cfg-courses .cfg-course').count(),2,'a linha nova precisa reaparecer no formulário');
   await page.locator('#cfg-courses .cfg-course').nth(1).locator('.cfg-remove').click();
   await page.locator('#settings-save').click();
   await page.waitForFunction(()=>!document.querySelector('#settings-dialog').open,undefined,{timeout:10000});
   await page.waitForFunction(()=>[...document.querySelectorAll('#course-tabs button')].every(b=>!b.textContent.includes('Matéria B2')),undefined,{timeout:10000});
  });

  await s.step('renomear a matéria atualiza aba e título',async()=>{
   await page.keyboard.press('ControlOrMeta+,');
   await page.waitForSelector('#settings-dialog[open]');
   await page.locator('#cfg-courses .cfg-course').first().locator('.cfg-name').fill('Cálculo I');
   await page.locator('#settings-save').click();
   await page.waitForFunction(()=>!document.querySelector('#settings-dialog').open,undefined,{timeout:15000});
   await page.waitForFunction(()=>[...document.querySelectorAll('#course-tabs button')].some(b=>b.textContent.includes('Cálculo I')),undefined,{timeout:15000});
   await page.waitForFunction(()=>document.title.includes('Cálculo I'),undefined,{timeout:15000});
   assert.match(await page.locator('#context-summary').textContent(),/Cálculo I/,'o resumo de contexto acompanha o novo nome');
  });

  await s.step('Enter num campo fecha o diálogo como cancelar (comportamento herdado)',async()=>{
   await page.keyboard.press('ControlOrMeta+,');
   await page.waitForSelector('#settings-dialog[open]');
   const before=await page.locator('#cfg-courses .cfg-course').count();
   await page.locator('#cfg-add-course').click();
   await page.locator('#cfg-courses .cfg-course').last().locator('.cfg-name').fill('Não salva');
   await page.locator('#cfg-vault').focus();
   await page.keyboard.press('Enter');
   await page.waitForFunction(()=>!document.querySelector('#settings-dialog').open);
   await page.keyboard.press('ControlOrMeta+,');
   await page.waitForSelector('#settings-dialog[open]');
   assert.equal(await page.locator('#cfg-courses .cfg-course').count(),before,'Enter descarta a linha (fecha como cancelar)');
   await page.locator('#settings-dialog button[value="cancel"]').last().click();
   await page.waitForFunction(()=>!document.querySelector('#settings-dialog').open);
  });

  await s.step('Ajuda: versão, itens de flag e editor de atalhos',async()=>{
   await page.locator('#mesa-menu .nav-trigger').click();
   await page.locator('#help').click();
   await page.waitForSelector('#help-dialog[open]');
   assert.match(await page.locator('#help-version').textContent(),/^Mesa de Estudos \d/);
   for(const sel of ['#help-study-li','#help-endday-li','#help-refs-li'])assert.equal(await page.locator(sel).isHidden(),false,'com flags padrão o item fica visível');
   assert.equal(await page.locator('#keys-customize').isVisible(),true);
   await page.locator('#help-dialog .dialog-actions .primary').click();
   await page.waitForFunction(()=>!document.querySelector('#help-dialog').open);
  });

  await s.step('Sobre: lead com versão',async()=>{
   await page.locator('#mesa-menu .nav-trigger').click();
   await page.locator('#about').click();
   await page.waitForSelector('#about-dialog[open]');
   assert.match(await page.locator('#about-dialog .help-lead').first().textContent(),/^Mesa de Estudos \d.*licença MIT$/);
   await page.locator('#about-dialog .dialog-actions .primary').click();
   await page.waitForFunction(()=>!document.querySelector('#about-dialog').open);
  });

  await s.step('Encerrar: cancelar preserva o texto; salvar limpa e grava JSONL',async()=>{
   await page.locator('#end-day').click();
   await page.waitForSelector('#end-day-dialog[open]');
   await page.locator('#end-where').fill('rascunho descartado');
   await page.locator('#end-day-dialog button[value="cancel"]').click();
   await page.waitForFunction(()=>!document.querySelector('#end-day-dialog').open);
   await page.locator('#end-day').click();
   await page.waitForSelector('#end-day-dialog[open]');
   assert.equal(await page.locator('#end-where').inputValue(),'rascunho descartado','cancelar mantém o texto (como no app antigo)');
   await page.locator('#end-where').fill('terminei X');
   await page.locator('#end-next').fill('começar Y');
   await page.locator('#end-day-save').click();
   await page.waitForFunction(()=>document.querySelector('#messages').textContent.includes('terminei X'),undefined,{timeout:10000});
   await sendEnabled(page);
   const saved=fs.readdirSync(s.runtime).filter(n=>n.endsWith('.jsonl')).map(n=>fs.readFileSync(path.join(s.runtime,n),'utf8')).join('\n');
   assert.match(saved,/Onde parei: terminei X/);
   assert.match(saved,/Próximo passo: começar Y/);
   await page.locator('#end-day').click();
   await page.waitForSelector('#end-day-dialog[open]');
   assert.equal(await page.locator('#end-where').inputValue(),'','salvar precisa limpar o texto para a próxima');
   await page.keyboard.press('Escape');
   await page.waitForFunction(()=>!document.querySelector('#end-day-dialog').open);
  });

  await s.step('sem erros de página',async()=>{
   assert.deepEqual(s.errors,[]);
  });
 }finally{await s.close();}
 s.finish();
}

/* ------------------------------------------------------------------ */
/* H5: editor de atalhos                                               */
/* ------------------------------------------------------------------ */
if(only('keys')){
 const s=new Scenario('atalhos gravar resetar persistir');
 try{
  seedCourse(s.runtime,'A');
  writeDeskJson(s.runtime,{courseId:'A'});
  writeConfigJson(s.runtime,{vaultPath:s.runtime,courses:[{id:'A',name:'Matéria A',path:path.join(s.runtime,'learning','Courses','A')}]});
  await s.launch();
  const page=s.page;
  await page.waitForSelector('.pdf-panel',{timeout:30000});
  await statusOnline(page);

  await s.step('editor abre pela Ajuda com seções e linhas do contrato',async()=>{
   await page.locator('#mesa-menu .nav-trigger').click();
   await page.locator('#help').click();
   await page.waitForSelector('#help-dialog[open]');
   await page.locator('#keys-customize').click();
   await page.waitForSelector('#keys-dialog[open]');
   assert.deepEqual(await page.locator('#keys-dialog .keys-group > h3').evaluateAll(es=>es.map(e=>e.textContent)),['Estudar','Visualização','Ajuda','Arquivo','Conversa']);
   assert.equal(await page.locator('#keys-reset-all').isDisabled(),true);
   assert.equal(await page.evaluate(()=>document.activeElement?.className.includes('keys-rec')),true,'o primeiro Gravar recebe o foco');
  });

  await s.step('Esc cancela a gravação sem fechar o diálogo',async()=>{
   await page.locator('#keys-dialog .keys-row[data-action="pdf-find"] .keys-rec').click();
   await page.waitForFunction(()=>document.querySelector('#keys-dialog .keys-row[data-action="pdf-find"]').classList.contains('recording'));
   await page.keyboard.press('Escape');
   await page.waitForFunction(()=>!document.querySelector('#keys-dialog .keys-row[data-action="pdf-find"]').classList.contains('recording'));
   assert.equal(await page.locator('#keys-status').textContent(),'Gravação cancelada.');
   assert.equal(await page.evaluate(()=>document.querySelector('#keys-dialog').open),true,'Esc da captura não fecha o diálogo');
  });

  await s.step('conflito com o padrão de outra ação não grava',async()=>{
   await page.locator('#keys-dialog .keys-row[data-action="ggb-check"] .keys-rec').click();
   await page.waitForFunction(()=>document.querySelector('#keys-dialog .keys-row[data-action="ggb-check"]').classList.contains('recording'));
   await page.keyboard.press('ControlOrMeta+Shift+c');
   await page.waitForFunction(()=>document.querySelector('#keys-status').getAttribute('data-kind')==='error');
   assert.match(await page.locator('#keys-status').textContent(),/Conflito/);
   assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('mesa.keys')||'{}').overrides?.['ggb-check']??null),null);
   await page.keyboard.press('Escape');
  });

  await s.step('combo reservado do app não grava',async()=>{
   await page.locator('#keys-dialog .keys-row[data-action="ggb-check"] .keys-rec').click();
   await page.waitForFunction(()=>document.querySelector('#keys-dialog .keys-row[data-action="ggb-check"]').classList.contains('recording'));
   await page.keyboard.press('ControlOrMeta+q');
   await page.waitForFunction(()=>document.querySelector('#keys-status').getAttribute('data-kind')==='error');
   assert.match(await page.locator('#keys-status').textContent(),/reservado/);
   await page.keyboard.press('Escape');
  });

  await s.step('grava Mod+J em Buscar no PDF, persiste e o remap funciona',async()=>{
   await page.locator('#keys-dialog .keys-row[data-action="pdf-find"] .keys-rec').click();
   await page.waitForFunction(()=>document.querySelector('#keys-dialog .keys-row[data-action="pdf-find"]').classList.contains('recording'));
   await page.keyboard.press('ControlOrMeta+j');
   await page.waitForFunction(()=>!document.querySelector('#keys-dialog .keys-row[data-action="pdf-find"]').classList.contains('recording'));
   assert.match(await page.locator('#keys-status').textContent(),/agora é/);
   assert.equal(await page.locator('#keys-dialog .keys-row[data-action="pdf-find"] .keys-kbd').textContent(),'⌘J');
  });

  await s.step('o remap vale de verdade: ⌘J abre a busca e ⌘F fica engolido',async()=>{
   await page.locator('#keys-done').click();
   await page.waitForFunction(()=>!document.querySelector('#keys-dialog').open);
   await page.locator('#help-dialog .dialog-actions .primary').click();
   await page.waitForFunction(()=>!document.querySelector('#help-dialog').open);
   await page.keyboard.press('ControlOrMeta+j');
   await page.waitForFunction(()=>{const form=document.querySelector('.pdf-panel .pdf-find');return form&&!form.hidden&&document.activeElement===form.querySelector('input');},undefined,{timeout:5000});
   await page.keyboard.press('Escape');
   await page.waitForFunction(()=>document.querySelector('.pdf-panel .pdf-find')?.hidden===true,undefined,{timeout:5000});
   await page.keyboard.press('ControlOrMeta+f');
   await page.waitForTimeout(300);
   assert.equal(await page.evaluate(()=>document.querySelector('.pdf-panel .pdf-find')?.hidden),true,'o combo antigo precisa ficar engolido depois do remap');
   await page.locator('#mesa-menu .nav-trigger').click();
   await page.locator('#help').click();
   await page.waitForSelector('#help-dialog[open]');
   await page.locator('#keys-customize').click();
   await page.waitForSelector('#keys-dialog[open]');
  });

  await s.step('persistência local e reset individual',async()=>{
   const over=await page.evaluate(()=>JSON.parse(localStorage.getItem('mesa.keys')||'{}'));
   assert.equal(over.overrides?.['pdf-find'],'Mod+j');
   assert.equal(await page.locator('#keys-reset-all').isDisabled(),false);
   assert.equal(await page.locator('#keys-dialog .keys-row[data-action="pdf-find"] .keys-kbd').textContent(),'⌘J');
   await page.locator('#keys-dialog .keys-row[data-action="pdf-find"] .keys-reset').click();
   await page.waitForFunction(()=>JSON.parse(localStorage.getItem('mesa.keys')||'{}').overrides?.['pdf-find']===undefined);
   assert.equal(await page.locator('#keys-dialog .keys-row[data-action="pdf-find"] .keys-kbd').textContent(),'⌘F');
  });

  await s.step('fechar e reabrir o editor mostra o mesmo estado',async()=>{
   await page.locator('#keys-done').click();
   await page.waitForFunction(()=>!document.querySelector('#keys-dialog').open);
   await page.locator('#keys-customize').click();
   await page.waitForSelector('#keys-dialog[open]');
   assert.equal(await page.locator('#keys-reset-all').isDisabled(),true);
   assert.equal(await page.locator('#keys-status').textContent(),'');
   await page.locator('#keys-done').click();
   await page.locator('#help-dialog .dialog-actions .primary').click();
   await page.waitForFunction(()=>!document.querySelector('#help-dialog').open);
  });

  await s.step('sem erros de página',async()=>{
   assert.deepEqual(s.errors,[]);
  });
 }finally{await s.close();}
 s.finish();
}

/* ------------------------------------------------------------------ */
/* H6: abas, GeoGebra, título e persistência entre reinícios           */
/* ------------------------------------------------------------------ */
if(only('tabs')){
 const s=new Scenario('abas geogebra reinicio');
 let sessionFile;
 try{
  seedCourse(s.runtime,'A');seedCourse(s.runtime,'B');
  fs.writeFileSync(path.join(s.runtime,'learning','Courses','A','Integral.pdf'),tinyPdf('Integral da troca',2));
  sessionFile=seedSession(s.runtime,[{type:'message',message:{role:'user',content:[{type:'text',text:'sessão da A'}]}}]);
  writeDeskJson(s.runtime,{session:sessionFile,courseId:'A'});
  writeConfigJson(s.runtime,{vaultPath:s.runtime,courses:[{id:'A',name:'Matéria A',path:path.join(s.runtime,'learning','Courses','A')},{id:'B',name:'Matéria B',path:path.join(s.runtime,'learning','Courses','B')}]});
  await s.launch({env:{LEARNING_VAULT:s.runtime}});
  const page=s.page;
  await page.waitForSelector('.pdf-panel',{timeout:30000});
  await page.waitForFunction(()=>{const t=[...document.querySelectorAll('#course-tabs button')];return t.length===3&&t.every(b=>!b.disabled);},{timeout:30000});
  await statusOnline(page);

  await s.step('troca de matéria com conversa aberta conecta e titula',async()=>{
   await page.locator('#course-tabs button[data-id="B"]').click();
   await page.waitForFunction(()=>document.querySelector('#course-tabs button[data-id="B"]')?.classList.contains('active'),undefined,{timeout:30000});
   await statusOnline(page,{timeout:30000});
   await page.waitForFunction(()=>document.title.includes('Matéria B'),undefined,{timeout:15000});
   assert.equal(await page.evaluate(()=>document.querySelector('#course-tabs button[data-id="B"]').getAttribute('aria-selected')),'true');
   await page.waitForTimeout(1500);
  });

  await s.step('⌘1 volta e o título/página acompanham',async()=>{
   await page.keyboard.press('ControlOrMeta+1');
   await page.waitForFunction(()=>document.querySelector('#course-tabs button[data-id="A"]')?.classList.contains('active'),undefined,{timeout:30000});
   await statusOnline(page,{timeout:30000});
   await page.waitForFunction(()=>document.title.includes('Matéria A'),undefined,{timeout:15000});
   await page.waitForTimeout(1500);
   assert.match(await page.title(),/p\. 1/,'título leva a página do 1º leitor');
  });

  await s.step('quiz pendente: troca recusada na hora e o card sobrevive',async()=>{
   await page.locator('#prompt').fill('quiz durante a troca');
   await page.locator('#send').click();
   await page.waitForSelector('.message.quiz .quiz-option',{timeout:15000});
   await sendEnabled(page,{timeout:15000});
   // o fake fica esperando a resposta (sem agent_end) com o busy já solto: o
   // quiz pendente é "não ocioso" e a troca tem de ser recusada na hora
   await page.keyboard.press('ControlOrMeta+2');
   await toastWait(page,'responda antes de trocar de matéria',{timeout:5000});
   assert.equal(await page.locator('#course-tabs button[data-id="A"]').evaluate(el=>el.classList.contains('active')),true,'a matéria não troca com o quiz pendente');
   assert.ok(await page.locator('.message.quiz .quiz-option').count()>=1,'o card do quiz continua na tela (o Pi segue esperando)');
   // responde para soltar o turno; aí a troca é permitida
   await page.locator('.message.quiz .quiz-option').first().click();
   await sendEnabled(page,{timeout:30000});
   await page.keyboard.press('ControlOrMeta+2');
   await page.waitForFunction(()=>document.querySelector('#course-tabs button[data-id="B"]')?.classList.contains('active'),undefined,{timeout:60000});
   await statusOnline(page,{timeout:30000});
   await page.waitForTimeout(800);
   assert.match(await page.title(),/Matéria B/);
   assert.equal(await page.locator('.message.quiz').count(),0,'a matéria nova nasce sem o card da anterior');
  });

  await s.step('volta para A e o histórico da conversa reaparece',async()=>{
   await page.locator('#course-tabs button[data-id="A"]').click();
   await page.waitForFunction(()=>document.querySelector('#course-tabs button[data-id="A"]')?.classList.contains('active'),undefined,{timeout:30000});
   await statusOnline(page,{timeout:30000});
   await page.waitForFunction(()=>document.querySelector('#messages').textContent.includes('sessão da A')||document.querySelector('#messages').textContent.includes('quiz durante a troca'),undefined,{timeout:20000});
  });

  await s.step('⌘Tab percorre B, GeoGebra e volta para A',async()=>{
   await page.keyboard.press('ControlOrMeta+Tab');
   await page.waitForFunction(()=>document.querySelector('#course-tabs button[data-id="B"]')?.classList.contains('active'),undefined,{timeout:60000});
   await page.waitForFunction(()=>[...document.querySelectorAll('#course-tabs button')].every(b=>!b.disabled),undefined,{timeout:30000});
   await page.keyboard.press('ControlOrMeta+Tab');
   await page.waitForFunction(()=>document.querySelector('#references').classList.contains('ggb'),undefined,{timeout:30000});
   assert.equal(await page.locator('#course-tabs button[data-id="geogebra"]').getAttribute('aria-selected'),'true');
   await page.keyboard.press('ControlOrMeta+Tab');
   await page.waitForFunction(()=>document.querySelector('#course-tabs button[data-id="A"]')?.classList.contains('active'),undefined,{timeout:30000});
   assert.equal(await page.evaluate(()=>document.querySelector('#references').classList.contains('ggb')),false);
   await statusOnline(page,{timeout:30000});
   await page.waitForTimeout(600);
  });

  await s.step('GeoGebra liga/desliga sem sujar o título e preserva o PDF ao voltar',async()=>{
   await page.locator('#course-tabs button[data-id="geogebra"]').click();
   await page.waitForFunction(()=>document.querySelector('#references').classList.contains('ggb'),undefined,{timeout:30000});
   assert.equal(await page.locator('#course-tabs button[data-id="geogebra"]').getAttribute('aria-selected'),'true');
   assert.equal(await page.locator('#course-tabs button[data-id="A"]').getAttribute('aria-selected'),'false');
   await page.locator('#course-tabs button[data-id="A"]').click();
   await page.waitForFunction(()=>!document.querySelector('#references').classList.contains('ggb'),undefined,{timeout:15000});
   assert.equal(await page.locator('#course-tabs button[data-id="A"]').getAttribute('aria-selected'),'true');
   await statusOnline(page,{timeout:30000});
   await page.waitForTimeout(800);
  });

  await s.step('estado para o reinício: tema, painel escondido, rascunho',async()=>{
   await page.locator('#mesa-menu .nav-trigger').click();
   await page.locator('#theme-cycle').click();
   assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),'light');
   await page.keyboard.press('Escape');
   await page.locator('#study-menu .nav-trigger').click();
   await page.locator('#reference-toggle').click();
   assert.equal(await page.locator('.pdf-panel').nth(1).isHidden(),true);
   await page.keyboard.press('Escape');
   await page.locator('#study-context #exercise-title').fill('Lista 3 · questão 1');
   await page.locator('#prompt').fill('rascunho para voltar');
   await page.waitForTimeout(900);
   // densidade e override de atalho (localStorage) para o reinício
   await page.keyboard.press('ControlOrMeta+,');
   await page.waitForSelector('#settings-dialog[open]');
   await page.locator('#density-mode').selectOption('compacta');
   await page.waitForFunction(()=>document.body.classList.contains('dense'));
   await page.locator('#settings-dialog button[value="cancel"]').last().click();
   await page.waitForFunction(()=>!document.querySelector('#settings-dialog').open);
   await page.evaluate(()=>localStorage.setItem('mesa.keys',JSON.stringify({v:1,overrides:{'pdf-find':'Mod+j'}})));
   await page.evaluate(()=>localStorage.setItem('mesa.notify','both'));
   // minimiza o 1º leitor e inverte as cores: layout por documento
   await page.locator('.pdf-panel').first().locator('.invert').click();
   await page.waitForFunction(()=>document.querySelector('.pdf-panel .pdf-viewport')?.classList.contains('inverted'));
   await page.locator('.pdf-panel').first().locator('.collapse').click();
   await page.waitForFunction(()=>document.querySelector('.pdf-panel').classList.contains('minimized'));
   await page.waitForTimeout(900);
   const desk=JSON.parse(fs.readFileSync(path.join(s.runtime,'desk.json'),'utf8'));
   assert.equal(desk.theme,'light');
   const st=desk.courseStates?.A||{};
   assert.equal(st.referenceVisible===false||desk.referenceVisible===false,true,'referenceVisible=false precisa persistir');
   assert.equal(st.draft||desk.draft,'rascunho para voltar');
   assert.equal(st.study?.title,'Lista 3 · questão 1','o título de estudo precisa persistir');
   assert.equal(st.pdfs?.[0]?.minimized,true,'minimized precisa persistir');
   assert.equal(st.pdfs?.[0]?.invert,true,'invert precisa persistir');
  });

  await s.step('reinício: aba, tema, painel e rascunho voltam iguais',async()=>{
   await s.close();
   s.errors=[];
   await s.launch({env:{LEARNING_VAULT:s.runtime}});
   const p2=s.page;
   await p2.waitForSelector('.pdf-panel',{timeout:30000});
   await p2.waitForFunction(()=>document.querySelector('#course-tabs button[data-id="A"]')?.classList.contains('active'),undefined,{timeout:30000});
   assert.equal(await p2.evaluate(()=>document.documentElement.dataset.theme),'light');
   assert.equal(await p2.locator('#prompt').inputValue(),'rascunho para voltar');
   assert.equal(await p2.locator('.pdf-panel').nth(1).isHidden(),true);
   assert.equal(await p2.locator('#reference-toggle').getAttribute('aria-pressed'),'false');
   assert.equal(await p2.locator('#exercise-title').inputValue(),'Lista 3 · questão 1');
   assert.equal(await p2.locator('.pdf-panel').first().evaluate(el=>el.classList.contains('minimized')),true,'o leitor volta minimizado');
   assert.equal(await p2.locator('.pdf-panel').first().locator('.invert').getAttribute('aria-pressed'),'true');
   assert.match(await p2.title(),/Matéria A/);
   await statusOnline(p2,{timeout:30000});
  });

  await s.step('reinício: densidade e atalho remapeado continuam valendo',async()=>{
   const p2=s.page;
   assert.equal(await p2.evaluate(()=>document.body.classList.contains('dense')),true,'body.dense volta do localStorage');
   assert.equal(await p2.evaluate(()=>window.mesaKeys.effective('pdf-find')),'Mod+j','override volta do localStorage');
   await p2.keyboard.press('ControlOrMeta+,');
   await p2.waitForSelector('#settings-dialog[open]');
   assert.deepEqual(await p2.locator('#notify-mode input').evaluateAll(es=>es.map(e=>[e.id,e.checked])),[['notify-sound',true],['notify-desktop',true],['notify-focused',false]],'o modo legado "both" volta migrado');
   await p2.locator('#settings-dialog button[value="cancel"]').last().click();
   await p2.waitForFunction(()=>!document.querySelector('#settings-dialog').open);
   await p2.locator('.pdf-panel').first().locator('.collapse').click();
   await p2.waitForFunction(()=>!document.querySelector('.pdf-panel').classList.contains('minimized'));
   await p2.keyboard.press('ControlOrMeta+j');
   await p2.waitForFunction(()=>{const form=document.querySelector('.pdf-panel .pdf-find');return form&&!form.hidden&&document.activeElement===form.querySelector('input');},undefined,{timeout:5000});
   await p2.keyboard.press('Escape');
   await p2.waitForFunction(()=>document.querySelector('.pdf-panel .pdf-find')?.hidden===true,undefined,{timeout:5000});
  });

  await s.step('sem erros de página nos dois boots',async()=>{
   assert.deepEqual(s.errors,[]);
  });
 }finally{await s.close();}
 s.finish();
}

/* ------------------------------------------------------------------ */
/* H7: flags do desk                                                   */
/* ------------------------------------------------------------------ */
if(only('flags')){
 const s=new Scenario('flags combinacoes e salvar');
 try{
  seedCourse(s.runtime,'Flags');
  fs.writeFileSync(path.join(s.runtime,'learning','Courses','Flags','Limites.pdf'),tinyPdf('Limites',2));
  fs.writeFileSync(path.join(s.runtime,'learning','Courses','Flags','Formul.pdf'),tinyPdf('Formulário',2));
  writeDeskJson(s.runtime,{courseId:'Flags'});
  writeConfigJson(s.runtime,{vaultPath:s.runtime,courses:[{id:'Flags',name:'Matéria de teste',path:path.join(s.runtime,'learning','Courses','Flags')}],desk:{refsToggle:false,endDay:false,studyContext:false,calculator:false,conferir:false,xournal:false,title:'Mesa da Flags'}});
  await s.launch({env:{LEARNING_VAULT:s.runtime}});
  const page=s.page;
  await page.waitForSelector('.pdf-panel',{timeout:30000});

  await s.step('título do desk vira brand e título da janela',async()=>{
   assert.equal((await page.locator('.brand strong').textContent()).trim(),'Mesa da Flags');
   assert.match(await page.title(),/^Mesa da Flags/);
  });

  await s.step('todos os controles das flags ficam escondidos',async()=>{
   for(const sel of ['#include-refs','#end-day','#study-context','#calculator','#calc-divider','#check'])assert.equal(await page.locator(sel).isHidden(),true,`${sel} devia sumir`);
   await page.locator('#study-menu .nav-trigger').click();
   assert.equal(await page.locator('#xournal').isHidden(),true);
   await page.keyboard.press('Escape');
  });

  await s.step('sem botão de referências o contexto envia os dois painéis',async()=>{
   await page.waitForFunction(()=>document.querySelector('.pdf-panel .pdf-document')?.children.length>0,undefined,{timeout:30000});
   const summary=await page.locator('#context-summary').textContent();
   assert.equal(await page.locator('#include-refs').getAttribute('aria-pressed'),'true');
   assert.match(summary,/Limites\.pdf p\.1/,'com a flag desligada as referências do 1º painel continuam no contexto');
   assert.match(summary,/Formul\.pdf p\.1/,'o 2º painel também entra com a flag desligada');
   assert.doesNotMatch(summary,/Enunciado|Lista/,'sem studyContext o título de estudo não entra');
  });

  await s.step('Salvar nas Configurações preserva as flags',async()=>{
   await page.keyboard.press('ControlOrMeta+,');
   await page.waitForSelector('#settings-dialog[open]');
   await page.locator('#settings-save').click();
   await page.waitForFunction(()=>!document.querySelector('#settings-dialog').open,undefined,{timeout:15000});
   await page.waitForTimeout(800);
   for(const sel of ['#include-refs','#end-day','#study-context','#calculator','#check'])assert.equal(await page.locator(sel).isHidden(),true,`${sel} devia continuar escondido depois de Salvar`);
   await page.locator('#study-menu .nav-trigger').click();
   assert.equal(await page.locator('#xournal').isHidden(),true);
   await page.keyboard.press('Escape');
   const cfg=JSON.parse(fs.readFileSync(path.join(s.runtime,'config.json'),'utf8'));
   assert.equal(cfg.desk.refsToggle,false);assert.equal(cfg.desk.endDay,false);assert.equal(cfg.desk.studyContext,false);assert.equal(cfg.desk.calculator,false);assert.equal(cfg.desk.conferir,false);assert.equal(cfg.desk.xournal,false);
  });

  await s.step('sem erros de página',async()=>{
   assert.deepEqual(s.errors,[]);
  });
 }finally{await s.close();}
 s.finish();
}

/* ------------------------------------------------------------------ */
/* H8: painéis (1 vs 2), needsSetup e nomes                               */
/* ------------------------------------------------------------------ */
if(only('config')){
 const s=new Scenario('config paineis e needs-setup');
 try{
  seedCourse(s.runtime,'A');
  writeDeskJson(s.runtime,{courseId:'A'});
  writeConfigJson(s.runtime,{vaultPath:s.runtime,courses:[{id:'A',name:'A & B <c>',path:path.join(s.runtime,'learning','Courses','A')}],desk:{panels:[{label:'Lista'},{label:'Tabela de apoio',toggle:'Tabela'}]}});
  fs.writeFileSync(path.join(s.runtime,'learning','Courses','A','Lista.pdf'),tinyPdf('Lista',2));
  fs.writeFileSync(path.join(s.runtime,'learning','Courses','A','Tabela.pdf'),tinyPdf('Tabela',2));
  await s.launch();
  const page=s.page;
  await page.waitForSelector('.pdf-panel',{timeout:30000});

  await s.step('dois painéis com rótulos e toggle customizados',async()=>{
   assert.equal(await page.locator('.pdf-panel').count(),2);
   assert.deepEqual(await page.locator('.pdf-panel > .pdf-title > strong').allTextContents(),['Lista','Tabela de apoio']);
   await page.waitForFunction(()=>document.querySelector('#reference-toggle')?.textContent.trim()==='Tabela');
   await page.locator('#study-menu .nav-trigger').click();
   assert.equal((await page.locator('#reference-toggle').textContent()).trim(),'Tabela');
   assert.equal(await page.locator('#reference-toggle').isHidden(),false);
   await page.keyboard.press('Escape');
  });

  await s.step('nome de matéria com & e < vira texto, não markup',async()=>{
   const html=await page.evaluate(()=>{const tab=document.querySelector('#course-tabs button');return {text:tab.textContent,childElements:tab.children.length,inner:tab.innerHTML};});
   assert.equal(html.text,'A & B <c>');
   assert.equal(html.childElements,0,'a aba é texto puro');
   assert.ok(html.inner.includes('&amp;'),'o markup escapa o &');
  });

  await s.step('sem erros de página',async()=>{
   assert.deepEqual(s.errors,[]);
  });
 }finally{await s.close();}
 s.finish();

 const s2=new Scenario('config um painel e setup inicial');
 try{
  seedCourse(s2.runtime,'U');
  writeDeskJson(s2.runtime,{courseId:'U'});
  writeConfigJson(s2.runtime,{vaultPath:'',courses:[],desk:{panels:[{label:'Apostila',prefer:['apostila']}]}});
  await s2.launch();
  const page=s2.page;
  await page.waitForSelector('.pdf-panel',{timeout:30000});

  await s2.step('setup inicial abre a boas-vindas e Configurar agora leva às Configurações',async()=>{
   await page.waitForSelector('#welcome-dialog[open]',{timeout:5000});
   assert.equal(await page.locator('#welcome-dialog h2').textContent(),'Bem-vindo à Mesa de Estudos');
   assert.equal(await page.locator('#welcome-dialog .welcome-block').count(),4,'quatro blocos na boas-vindas');
   await page.locator('#welcome-settings').click();
   await page.waitForSelector('#settings-dialog[open]',{timeout:5000});
   assert.equal(await page.locator('#settings-title').textContent(),'Bem-vindo à Mesa de Estudos');
   const rows=await page.locator('#cfg-courses .cfg-course').count();
   assert.equal(rows,1,'lista vazia vira uma linha em branco');
   assert.equal(await page.locator('#cfg-courses .cfg-name').inputValue(),'');
   await page.locator('#settings-dialog button[value="cancel"]').last().click();
   await page.waitForFunction(()=>!document.querySelector('#settings-dialog').open);
  });

  await s2.step('um painel: toggle do 2º leitor some e o grid fica single',async()=>{
   assert.equal(await page.locator('.pdf-panel').count(),1);
   await page.locator('#study-menu .nav-trigger').click();
   assert.equal(await page.locator('#reference-toggle').isHidden(),true);
   await page.keyboard.press('Escape');
   assert.equal(await page.locator('#pdf-grid').getAttribute('class'),'single');
  });

  await s2.step('reabrir Configurações volta ao título normal',async()=>{
   await page.keyboard.press('ControlOrMeta+,');
   await page.waitForSelector('#settings-dialog[open]');
   assert.equal(await page.locator('#settings-title').textContent(),'Configurações');
   await page.locator('#settings-dialog button[value="cancel"]').last().click();
  });

  await s2.step('sem erros de página',async()=>{
   assert.deepEqual(s2.errors,[]);
  });
 }finally{await s2.close();}
 s2.finish();
}

/* ------------------------------------------------------------------ */
/* H9: turno preso (stall) — Encerrar e abas durante o busy             */
/* ------------------------------------------------------------------ */
if(only('busy')){
 const s=new Scenario('busy encerrar e abas');
 try{
  seedCourse(s.runtime,'A');seedCourse(s.runtime,'B');
  writeDeskJson(s.runtime,{courseId:'A'});
  writeConfigJson(s.runtime,{vaultPath:s.runtime,courses:[{id:'A',name:'Matéria A',path:path.join(s.runtime,'learning','Courses','A')},{id:'B',name:'Matéria B',path:path.join(s.runtime,'learning','Courses','B')}]});
  await s.launch({env:{LEARNING_VAULT:s.runtime,FAKE_PI_CHAOS:'stall'}});
  const page=s.page;
  await page.waitForSelector('.pdf-panel',{timeout:30000});
  await statusOnline(page);

  await s.step('Encerrar por hoje recusa durante o turno',async()=>{
   await page.locator('#prompt').fill('responda e trave');
   await page.locator('#send').click();
   await page.waitForFunction(()=>document.querySelector('#send').disabled,undefined,{timeout:10000});
   assert.equal(await page.locator('#stop').isHidden(),false,'Parar aparece no turno');
   assert.equal(await page.evaluate(()=>[...document.querySelectorAll('#course-tabs button')].every(b=>b.disabled)),true,'abas desabilitadas no turno');
   await page.locator('#end-day').click();
   await page.waitForFunction(()=>document.querySelector('#toast')?.textContent.includes('Pare a resposta'),undefined,{timeout:5000});
   assert.equal(await page.evaluate(()=>document.querySelector('#end-day-dialog').open),false,'o diálogo não abre no meio do turno');
  });

  await s.step('atalhos de aba durante o turno travado (documenta o herdado)',async()=>{
   // atalho não respeita o disabled das abas (herdado): ⌘3 liga o GeoGebra no meio do turno
   await page.keyboard.press('ControlOrMeta+3');
   await page.waitForFunction(()=>document.querySelector('#references').classList.contains('ggb'),undefined,{timeout:10000});
   s.note('⌘3 liga o GeoGebra mesmo com as abas desabilitadas (atalho ignora o disabled; herdado do Electron)');
   await page.keyboard.press('ControlOrMeta+1');
   await page.waitForFunction(()=>!document.querySelector('#references').classList.contains('ggb'),undefined,{timeout:10000});
   // ⌘2 espera o turno (waitIdle ~12s) e o host recusa com o Pi ainda streamando
   await page.keyboard.press('ControlOrMeta+2');
   await page.waitForFunction(()=>document.querySelector('#toast')?.textContent.includes('Pare a resposta antes de trocar'),undefined,{timeout:25000});
   assert.equal(await page.evaluate(()=>[...document.querySelectorAll('#course-tabs button')].find(b=>b.classList.contains('active'))?.dataset.id),'A');
   assert.equal(await page.locator('#send').isDisabled(),true,'o turno continua preso (o stop é do usuário)');
   const tabStates=await page.evaluate(()=>[...document.querySelectorAll('#course-tabs button')].map(b=>[b.dataset.id||b.id,b.disabled]));
   s.note(`depois da recusa as abas ficam ${JSON.stringify(tabStates)} com o turno preso (estado herdado)`);
  });

  await s.step('Salvar Configurações durante o turno é recusado com toast',async()=>{
   await page.keyboard.press('ControlOrMeta+,');
   await page.waitForSelector('#settings-dialog[open]');
   await page.locator('#settings-save').click();
   await page.waitForFunction(()=>document.querySelector('#toast')?.textContent.includes('Pare a resposta antes de mudar as configurações'),undefined,{timeout:10000});
   assert.equal(await page.evaluate(()=>document.querySelector('#settings-dialog').open),true,'o diálogo fica aberto para o usuário tentar depois');
   await page.locator('#settings-dialog button[value="cancel"]').last().click();
   await page.waitForFunction(()=>!document.querySelector('#settings-dialog').open);
  });

  await s.step('Esc com diálogo aberto não aborta o turno',async()=>{
   await page.keyboard.press('ControlOrMeta+/');
   await page.waitForSelector('#help-dialog[open]');
   await page.keyboard.press('Escape');
   await page.waitForFunction(()=>!document.querySelector('#help-dialog').open);
   assert.equal(await page.locator('#send').isDisabled(),true,'o turno segue preso: Esc fechou só o diálogo');
   assert.equal(await page.locator('#stop').isHidden(),false,'Parar continua disponível');
  });

  await s.step('sem erros de página',async()=>{
   assert.deepEqual(s.errors,[]);
  });
 }finally{await s.close();}
 s.finish();
}

/* ------------------------------------------------------------------ */
/* H10: pergunta do Pi (#pi-dialog) com campos                           */
/* ------------------------------------------------------------------ */
if(only('pidialog')){
 const s=new Scenario('pi-dialog pergunta campos');
 try{
  seedCourse(s.runtime,'A');
  writeDeskJson(s.runtime,{courseId:'A'});
  writeConfigJson(s.runtime,{vaultPath:s.runtime,courses:[{id:'A',name:'Matéria A',path:path.join(s.runtime,'learning','Courses','A')}]});
  const fakeDialog=path.join(DESK,'tests','fake-pi-dialog.mjs');
  await s.launch({env:{LEARNING_VAULT:s.runtime,LEARNING_DESK_PI:fakeDialog}});
  const page=s.page;
  await page.waitForSelector('.pdf-panel',{timeout:30000});
  await statusOnline(page);

  await s.step('input: abre com título, mensagem, prefill e placeholder',async()=>{
   await page.locator('#prompt').fill('uma pergunta para você');
   await page.locator('#send').click();
   await page.waitForSelector('#pi-dialog[open]',{timeout:15000});
   assert.equal(await page.locator('#dialog-title').textContent(),'Assunto');
   assert.equal(await page.locator('#dialog-message').textContent(),'Digite o assunto');
   assert.equal(await page.locator('#dialog-value').evaluate(el=>el.tagName),'INPUT');
   assert.equal(await page.locator('#dialog-value').inputValue(),'pré-preenchido');
   assert.equal(await page.locator('#dialog-value').getAttribute('placeholder'),'ex.: limites');
   await page.locator('#dialog-value').fill('limites');
   await page.locator('#pi-dialog .dialog-actions .primary').click();
   await page.waitForFunction(()=>!document.querySelector('#pi-dialog').open);
   await page.waitForFunction(()=>document.querySelector('#messages').textContent.includes('Assunto: limites'),undefined,{timeout:15000});
   await sendEnabled(page);
  });

  await s.step('select: opções com selected no prefill; enviar a escolhida',async()=>{
   await page.locator('#prompt').fill('agora uma escolha');
   await page.locator('#send').click();
   await page.waitForSelector('#pi-dialog[open]',{timeout:15000});
   const sel=await page.locator('#dialog-value').evaluate(el=>({tag:el.tagName,options:[...el.options].map(o=>o.value),selected:el.value}));
   assert.deepEqual(sel,{tag:'SELECT',options:['Alfa','Beta','Gama'],selected:'Beta'});
   await page.locator('#dialog-value').selectOption('Gama');
   await page.locator('#pi-dialog .dialog-actions .primary').click();
   await page.waitForFunction(()=>document.querySelector('#messages').textContent.includes('Escolha: Gama'),undefined,{timeout:15000});
   await sendEnabled(page);
  });

  await s.step('confirm: sem campo e o ok responde confirmado',async()=>{
   await page.locator('#prompt').fill('pode confirmar');
   await page.locator('#send').click();
   await page.waitForSelector('#pi-dialog[open]',{timeout:15000});
   assert.equal(await page.locator('#dialog-fields').evaluate(el=>el.children.length),0);
   await page.locator('#pi-dialog .dialog-actions .primary').click();
   await page.waitForFunction(()=>document.querySelector('#messages').textContent.includes('Confirmação: (confirmado)'),undefined,{timeout:15000});
   await sendEnabled(page);
  });

  await s.step('cancelar responde cancelled e limpa os campos do próximo',async()=>{
   await page.locator('#prompt').fill('outra pergunta');
   await page.locator('#send').click();
   await page.waitForSelector('#pi-dialog[open]',{timeout:15000});
   await page.locator('#pi-dialog .dialog-actions button[value="cancel"]').click();
   await page.waitForFunction(()=>document.querySelector('#messages').textContent.includes('Assunto: (cancelado)'),undefined,{timeout:15000});
   await sendEnabled(page);
   await page.locator('#prompt').fill('confirmar de novo');
   await page.locator('#send').click();
   await page.waitForSelector('#pi-dialog[open]',{timeout:15000});
   assert.equal(await page.locator('#dialog-fields').evaluate(el=>el.children.length),0,'campos do diálogo anterior não vazam');
   await page.locator('#pi-dialog .dialog-actions .primary').click();
   await page.waitForFunction(()=>document.querySelector('#messages').textContent.includes('Confirmação: (confirmado)'),undefined,{timeout:15000});
   await sendEnabled(page);
  });

  await s.step('sem erros de página',async()=>{
   assert.deepEqual(s.errors,[]);
  });
 }finally{await s.close();}
 s.finish();
}

/* ------------------------------------------------------------------ */
const failed=all.filter(e=>!e.ok);
console.log(`\n==== hunt-shell: ${all.length} cenários, ${all.filter(e=>e.ok).length} ok, ${failed.length} com falha ====`);
for(const entry of failed){
 console.log(`- ${entry.title}: ${entry.failures.map(f=>f.name).join(' | ')}`);
}
console.log(`artefatos: ${ART}`);
if(failed.length)process.exitCode=1;
