/* Caça a bugs do "Revisar hoje" (agenda do caderno) na janela real: a fila do
   dia aparece na aba Caderno com o resultado marcável, a referência fora da
   biblioteca NÃO some (só avisa), o histórico/agenda é gravado e os botões de
   prompt só escrevem no composer. Roda com o mesmo boot do ui-smoke (Playwright
   + runtime temporário), sem Pi.
   Uso: node tests/hunt-review-today.mjs [filtro]

   NUNCA roda o app real: só helpers.mjs (LEARNING_DESK_RUNTIME temporário). */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {artifactDir,launchDesk,newRuntime,seedCourse,seedSession,writeDeskJson,writeConfigJson,tinyPdf} from './helpers.mjs';
import {pollUntil} from './waits.mjs';

const STAMP=new Date().toISOString().replace(/[:.]/g,'-').replace(/Z$/,'');
const ART=artifactDir(`hunt-review-today-${STAMP}`);
fs.mkdirSync(ART,{recursive:true});
const slice=(s,n=60)=>String(s??'').replace(/\s+/g,' ').trim().slice(0,n);
const slug=s=>String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,50);

const all=[];

class Scenario{
 constructor(title){
  this.title=title;this.steps=0;this.failures=[];this.notes=[];
  this.runtime=newRuntime(slug(title)||'hunt-review-today');
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

if(only('revisar hoje completa')){
 const s=new Scenario('revisar hoje: fila, resultado, referência e prompts');
 try{
  const runtime=s.runtime;
  const course=seedCourse(runtime,'A');
  const pdf=path.join(course,'Limites.pdf');
  fs.writeFileSync(pdf,tinyPdf('Limites1'));
  const outside=path.join(runtime,'Material antigo.pdf');
  fs.writeFileSync(outside,tinyPdf('Fora da biblioteca'));
  const session=seedSession(runtime,[
   {type:'message',message:{role:'user',content:[{type:'text',text:'tentei fatorar'}]}},
   {type:'message',message:{role:'assistant',content:[{type:'text',text:'Fatore o numerador e simplifique.'}]}}
  ]);
  fs.writeFileSync(path.join(runtime,'review.json'),JSON.stringify({A:[
   {question:'Limite pela direita',attempt:'tentei 2',difficulty:'fatoração',ref:{name:'Limites',page:1,path:pdf}},
   {question:'Derivada da soma',attempt:'',difficulty:'',ref:{name:'Limites',page:2,path:pdf}},
   {question:'Item de outro material',attempt:'',difficulty:'',ref:{name:'Material antigo',page:5,path:outside}}
  ]},null,1));
  writeDeskJson(runtime,{session,courseId:'A',courseStates:{A:{session,pdfs:[{path:pdf,page:1,zoom:1,scrollX:0,scrollY:0}],sessions:[{path:session,started:Date.now(),preview:'sessão da revisão'}]}}});
  writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'A',name:'Matéria A',path:course}]});
  const page=await s.launch();
  const scheduleFile=()=>path.join(runtime,'review-schedule.json');
  const scheduleOf=()=>{try{return JSON.parse(fs.readFileSync(scheduleFile(),'utf8'));}catch{return {};}};
  const openCaderno=async()=>{
   /* Caminho de descoberta novo: o menu Estudar abre o Caderno
      e rola até "Revisar hoje". O menu Estudar continua coberto pelo hunt-review. */
   await page.locator('#study-menu .nav-trigger').click();
   await page.locator('#study-menu #study-review-today').click();
  };
  const prompt=()=>page.locator('#prompt').inputValue();

  const rowOf=title=>page.locator('.review-row',{hasText:title});
  await s.step('a aba Caderno mostra o item do dia, a fila migrada e o progresso',async()=>{
   await page.waitForSelector('.pdf-panel canvas',{timeout:30000});
   await openCaderno();
   await page.waitForSelector('#references.review');
   await page.waitForSelector('#review-today');
   await page.waitForFunction(()=>document.querySelectorAll('.review-row').length===3);
   assert.equal((await page.locator('.review-count').textContent()).trim(),'3 para hoje · 3 no caderno');
   assert.equal((await page.locator('.review-position').textContent()).trim(),'1 de 3');
   assert.equal(await page.locator('#review-today .review-grade').count(),4,'quatro resultados, um cartão por vez');
   assert.equal(await page.locator('.review-group-title').first().textContent(),'Vence hoje');
   for(const label of ['Errei','Difícil','Bom','Fácil'])assert.ok(await page.locator('#review-today .review-grade',{hasText:label}).count(),label);
   assert.match((await page.locator('.review-grade-when').first().textContent()).trim(),/^volta amanhã$/);
  });

  await s.step('referência fora da biblioteca aparece com aviso, não some',async()=>{
   await rowOf('Item de outro material').click();
   const warned=page.locator('.review-card .review-reference-warning');
   await warned.waitFor({state:'visible',timeout:10000});
   assert.match((await warned.textContent()).trim(),/fora da biblioteca/,'o item continua visível com a explicação');
   assert.equal(await page.locator('.review-card .review-ref').isDisabled(),true,'a citação não abre o que não existe');
  });

  await s.step('marcar Bom agenda a próxima revisão e sai da fila de hoje',async()=>{
   await rowOf('Limite pela direita').click();
   assert.equal((await page.locator('.review-question').textContent()).trim(),'Limite pela direita');
   await page.locator('#review-today button[data-result="bom"]').click();
   await page.waitForFunction(()=>document.querySelector('.review-count')?.textContent.trim()==='2 para hoje · 3 no caderno');
   const scheduledEntry=()=>(scheduleOf().courses?.A?.items||[]).find(one=>one.question==='Limite pela direita');
   await pollUntil(scheduledEntry,found=>found?.history?.length===1&&found.interval===1,{timeout:3000,interval:150,what:'a revisão agendada em disco',onTimeout:'return'});
   const entry=(scheduleOf().courses?.A?.items||[]).find(one=>one.question==='Limite pela direita');
   assert.equal(entry.interval,1,'Bom em item novo = 1 dia');
   assert.equal(entry.history.length,1,'o histórico guarda a revisão');
   assert.equal(entry.history[0].result,'bom');
   assert.equal(await page.locator('.review-group-title',{hasText:'Próximos'}).count(),1,'o avaliado passa para Próximos');
   assert.equal((await page.locator('.review-position').textContent()).trim(),'2 de 3','o progresso continua contando quem já foi marcado');
  });

  await s.step('Pedir um parecido e Tentar de novo só escrevem no composer',async()=>{
   await rowOf('Derivada da soma').click();
   await page.locator('.review-card .review-similar').click();
   assert.match(await prompt(),/^Quero um exercício semelhante a este/);
   assert.match(await prompt(),/Derivada da soma/);
   await page.locator('.review-card .review-redo').click();
   assert.match(await prompt(),/^Vou refazer este exercício/);
   assert.equal(await page.evaluate(()=>document.activeElement?.id),'prompt');
  });

  await s.step('o caderno lista os três itens e a agenda fica com o histórico',async()=>{
   /* Referências ausentes permanecem visíveis no caderno e na agenda. */
   assert.equal(await page.locator('.review-row').count(),3);
   const agenda=(scheduleOf().courses?.A?.items||[]);
   assert.equal(agenda.length,3,'a agenda guarda os três itens, inclusive o de fora da biblioteca');
   const today=Math.floor((Date.now()-new Date().getTimezoneOffset()*60000)/86400000);
   assert.equal(agenda.find(one=>one.question==='Limite pela direita').due,today+1,'o item marcado vence amanhã, fora da fila de hoje');
   assert.equal(agenda.find(one=>one.question==='Item de outro material').active,true,'o item fora da biblioteca continua ativo');
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
console.log(`\n==== hunt-review-today: ${all.length} cenários, ${all.length-failed.length} ok, ${failed.length} com falha ====`);
if(failed.length)console.log(failed.map(entry=>`- ${entry.title}: ${entry.failures.map(f=>f.name).join(' | ')}`).join('\n'));
console.log(`artefatos: ${ART}`);
process.exit(failed.length?1:0);
