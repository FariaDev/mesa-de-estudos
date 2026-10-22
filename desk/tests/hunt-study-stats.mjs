/* Caça a bugs do painel de Estatísticas na janela real: o botão aparece, o
   `<dialog>` abre, o resumo vem do host (IPC), a sessão liga o batimento do
   `main` e o tempo ativo cresce, e o reset consciente limpa. O painel é um
   módulo independente (`src/study-stats.mjs`); o hunt o importa na página, que
   é o mesmo que o `main.mjs` fará com `initStudyStats`.
   Uso: node tests/hunt-study-stats.mjs [filtro]

   NUNCA roda o app real: só helpers.mjs (LEARNING_DESK_RUNTIME temporário). */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {artifactDir,launchDesk,newRuntime,seedCourse,seedSession,writeDeskJson,writeConfigJson,tinyPdf} from './helpers.mjs';
import {pollUntil} from './waits.mjs';
const {createRequire}=await import('node:module');
const require=createRequire(import.meta.url);
const statistics=require('../src/study-data/statistics.cjs');
const STAMP=new Date().toISOString().replace(/[:.]/g,'-').replace(/Z$/,'');
const ART=artifactDir(`hunt-study-stats-${STAMP}`);
fs.mkdirSync(ART,{recursive:true});
const slice=(s,n=60)=>String(s??'').replace(/\s+/g,' ').trim().slice(0,n);
const slug=s=>String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,50);

const all=[];

class Scenario{
 constructor(title){
  this.title=title;this.steps=0;this.failures=[];this.notes=[];
  this.runtime=newRuntime(slug(title)||'hunt-study-stats');
  this.app=null;this.page=null;this.errors=[];this.consoleErrors=[];
 }
 async launch(opts={}){
  this.app=await launchDesk({runtime:this.runtime,...opts});
  this.page=await this.app.firstWindow();
  this.page.on('pageerror',e=>this.errors.push(String(e.message||e)));
  this.page.on('console',m=>{if(m.type()==='error')this.consoleErrors.push(m.text());});
  return this.page;
 }
 async step(name,fn){
  this.steps++;
  try{
   await fn();
   console.log(`  ok   ${name}`);
  }catch(e){
   const msg=String(e?.message||e);
   this.failures.push({name,error:msg});
   console.log(`  FAIL ${name}\n       ${slice(msg,220)}`);
   try{await this.page?.screenshot({path:path.join(ART,`${slug(this.title)}-${String(this.failures.length).padStart(2,'0')}-${slug(name)}.png`)});}catch{}
   try{await this.page?.keyboard.press('Escape').catch(()=>{});}catch{}
  }
 }
 note(text){this.notes.push(text);console.log(`  note ${text}`);}
 async close(){
  for(const err of this.errors)this.consoleErrors.push('pageerror: '+err);
  try{if(this.app)await this.app.close();}catch{}
 }
 finish(){
  const ok=this.failures.length===0;
  if(ok){try{fs.rmSync(this.runtime,{recursive:true,force:true});}catch{}}
  else{
   const dir=path.join(ART,slug(this.title));
   fs.mkdirSync(dir,{recursive:true});
   try{
    for(const name of fs.readdirSync(this.runtime)){
     const full=path.join(this.runtime,name);
     try{if(fs.statSync(full).isFile())fs.copyFileSync(full,path.join(dir,name));}catch{}
    }
    if(this.consoleErrors.length)fs.writeFileSync(path.join(dir,'console.log'),this.consoleErrors.join('\n'));
   }catch{}
  }
  const entry={title:this.title,steps:this.steps,failures:this.failures,consoleErrors:this.consoleErrors,notes:this.notes,ok};
  all.push(entry);
  console.log(`\n${ok?'PASSED':'FALHOU'} ${this.title} (${this.steps} passos, ${this.failures.length} falha(s))`);
  if(this.consoleErrors.length)console.log('  console:',this.consoleErrors.map(e=>slice(e,160)).join(' | '));
  return entry;
 }
}

const filter=process.argv[2]||'';
const only=title=>!filter||title.toLowerCase().includes(filter.toLowerCase());

if(only('estatisticas locais')){
 const s=new Scenario('estatisticas locais: painel, sessão, tempo ativo e reset');
 try{
  const runtime=s.runtime;
  const course=seedCourse(runtime,'A');
  const pdf=path.join(course,'Limites.pdf');
  fs.writeFileSync(pdf,tinyPdf('Limites1'));
  const session=seedSession(runtime,[{type:'message',message:{role:'user',content:[{type:'text',text:'oi'}]}}]);
  writeDeskJson(runtime,{session,courseId:'A',courseStates:{A:{session,pdfs:[{path:pdf,page:1,zoom:1,scrollX:0,scrollY:0}],sessions:[{path:session,started:Date.now(),preview:'sessão das estatísticas'}]}}});
  writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'A',name:'Matéria A',path:course}]});
  /* Semeia evidência NATIVA pelo próprio módulo: 3 batimentos de 30 s e uma
     sessão encerrada, uma pergunta aceita e tokens do provedor. O hunt roda em
     máquina automatizada (o SO pode estar ocioso > 120 s), então o tempo vem
     do arquivo; o batimento do main é provado à parte, pelo carimbo da régua. */
  const now=Date.now();
  statistics.control(runtime,{action:'start',at:now-90000,courseId:'A'});
  for(const at of [now-60000,now-30000,now])statistics.recordActivity(runtime,{id:`seed-${at}`,at,now:at,running:true,visible:true,courseId:'A'});
  statistics.control(runtime,{action:'stop',at:now,courseId:'A'});
  statistics.recordPrompt(runtime,{id:'seed-p1',at:now,accepted:true,courseId:'A'});
  statistics.recordUsage(runtime,{id:'seed-u1',at:now,courseId:'A',engine:'pi',input:{available:true,count:12},output:{available:true,count:3}});
  const page=await s.launch();
  const openPanel=async()=>{
   await page.waitForSelector('.pdf-panel canvas',{timeout:30000});
   /* O ponto de descoberta é o menu Estudar; o botão flutuante
      fica escondido quando ela está pronta (`study-tools.css`), mas o painel é o
      mesmo módulo. */
   await page.locator('#study-menu .nav-trigger').click();
   await page.locator('#study-menu #study-stats-open').click();
   await page.waitForSelector('#study-stats-dialog[open]');
  };
  const summaryOf=()=>page.evaluate(()=>window.desk.studyStatsSummary({period:'7',courseId:''}));
  const ensureOpen=async()=>{if(!(await page.locator('#study-stats-dialog[open]').count()))await openPanel();};

  await s.step('o botão da barra abre o diálogo acessível com o resumo do host',async()=>{
   await openPanel();
   assert.equal((await page.locator('#study-menu #study-stats-open').textContent()).trim(),'Estatísticas');
   assert.match(await page.locator('.study-stats-dialog').getAttribute('aria-labelledby'),/study-stats-title/);
   const headline=(await page.locator('#study-stats-headline').textContent()).trim();
   assert.match(headline,/^(1 min|menos de 1 min|1 min 30 s|2 min).* de estudo em 1 sessão$|^.* de estudo em 1 sessão$/,'a manchete soma os batimentos semeados e conta a sessão encerrada');
   assert.match(await page.locator('#study-stats-support').textContent(),/^1 pergunta ao tutor · melhor dia: .+, \d+ min$/);
   await page.locator('#study-stats-usage summary').click();
   assert.equal((await page.locator('#study-stats-usage-text').textContent()).trim(),'12 tokens lidos · 3 escritos','cache não informado some do texto, não vira zero');
   assert.equal(await page.locator('.study-stats-chart .study-stats-bar').count(),7,'a janela de 7 dias tem sete barras');
   assert.match(await page.locator('.study-stats-courses').textContent(),/Matéria[\s\S]*Tempo[\s\S]*Sessões[\s\S]*Perguntas[\s\S]*A/,'a matéria aparece na tabela');
  });

  await s.step('iniciar a sessão liga o batimento do main (régua do host anda)',async()=>{
   await ensureOpen();
   assert.equal((await page.locator('#study-stats-timer-action').textContent()).trim(),'Retomar');
   await page.locator('#study-stats-timer-action').click();
   await page.waitForFunction(()=>document.querySelector('#study-stats-session-text')?.textContent.includes('Contando agora'));
   assert.equal((await page.locator('#study-stats-timer-action').textContent()).trim(),'Pausar');
   const startedAt=statistics.readStore(runtime).meta.beats.A||0;
   const beat=await pollUntil(()=>statistics.readStore(runtime).meta.beats.A||0,value=>value>startedAt,{timeout:20000,interval:250,what:'o batimento do main avançar',onTimeout:'return'});
   const advanced=beat>startedAt;
   assert.ok(advanced,'o batimento do main carimba a régua da sessão em andamento');
  });

  await s.step('pausar e retomar mexem no estado; encerrar fecha a sessão',async()=>{
   await ensureOpen();
   await page.locator('#study-stats-timer-action').click();
   await page.waitForFunction(()=>document.querySelector('#study-stats-session-text')?.textContent.includes('Pausado'));
   assert.equal(statistics.timerOf(statistics.readStore(runtime)).running,false);
   await page.locator('#study-stats-timer-action').click();
   await page.waitForFunction(()=>document.querySelector('#study-stats-session-text')?.textContent.includes('Contando agora'));
   assert.equal(statistics.timerOf(statistics.readStore(runtime)).running,true);
   await page.locator('#study-stats-dialog .study-stats-end').click();
   await page.waitForFunction(()=>document.querySelector('#study-stats-session-text')?.textContent.includes('Pausado'));
   assert.equal(await page.locator('#study-stats-dialog .study-stats-end').isHidden(),true);
  });

  await s.step('o período troca e o gráfico se ajusta',async()=>{
   await ensureOpen();
   await page.locator('#study-stats-period [data-period="30"]').click();
   await page.waitForFunction(()=>document.querySelectorAll('.study-stats-chart .study-stats-bar').length===30);
   await page.locator('#study-stats-period [data-period="all"]').click();
   await page.waitForFunction(()=>document.querySelectorAll('.study-stats-chart .study-stats-bar').length>=1);
   await page.locator('#study-stats-period [data-period="7"]').click();
   await page.waitForFunction(()=>document.querySelectorAll('.study-stats-chart .study-stats-bar').length===7);
  });

  await s.step('o reset pede confirmação e limpa o resumo',async()=>{
   await ensureOpen();
   page.once('dialog',dialog=>dialog.accept());
   await page.locator('.study-stats-reset').click();
   await page.waitForFunction(()=>document.querySelector('#study-stats-headline')?.textContent==='Nada estudado neste período');
   assert.equal((await summaryOf()).totals.seconds,0);
   assert.equal((await summaryOf()).totals.sessions,0);
   assert.equal((await summaryOf()).totals.prompts,0);
  });

  await s.step('sem erros de página',async()=>{
   assert.deepEqual(s.errors,[],s.errors.join(' | '));
  });
 }finally{
  await s.close();
  s.finish();
 }
}

const failed=all.filter(entry=>!entry.ok);
console.log(`\n==== hunt-study-stats: ${all.length} cenários, ${all.length-failed.length} ok, ${failed.length} com falha ====`);
if(failed.length)console.log(failed.map(entry=>`- ${entry.title}: ${entry.failures.map(f=>f.name).join(' | ')}`).join('\n'));
console.log(`artefatos: ${ART}`);
process.exit(failed.length?1:0);
