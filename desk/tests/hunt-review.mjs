/* Caça a bugs do caderno de revisão (pedido 6): guardar de uma resposta do Pi
   (o enunciado vem da mensagem de usuário QUE O PI RESPONDEU, não da primeira da
   conversa; o trecho selecionado vira a dificuldade), a aba com os itens, os dois
   prompts que caem no composer, a edição, a remoção e a convivência com o
   GeoGebra. Roda com o mesmo boot do ui-smoke (Playwright + fake Pi + runtime
   temporário).
   Uso: node tests/hunt-review.mjs [filtro]

   NUNCA roda o app real: só helpers.mjs (LEARNING_DESK_RUNTIME temporário). */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {launchDesk,newRuntime,seedCourse,seedSession,writeDeskJson,writeConfigJson,tinyPdf} from './helpers.mjs';

const DESK=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const STAMP=new Date().toISOString().replace(/[:.]/g,'-').replace(/Z$/,'');
const ART=path.join(DESK,'tests','artifacts',`hunt-review-${STAMP}`);
fs.mkdirSync(ART,{recursive:true});
const slice=(s,n=60)=>String(s??'').replace(/\s+/g,' ').trim().slice(0,n);
const slug=s=>String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,50);

const all=[];

class Scenario{
 constructor(title){
  this.title=title;this.steps=0;this.failures=[];this.notes=[];
  this.runtime=newRuntime(slug(title)||'hunt-review');
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

/* ------------------------------------------------------------------ */
/* R1: guardar da resposta, ver na aba, prompts, editar e remover      */
/* ------------------------------------------------------------------ */

if(only('caderno')){
 const s=new Scenario('caderno guardar editar remover e prompts');
 try{
  const runtime=s.runtime;
  const course=seedCourse(runtime,'A');
  const pdf=path.join(course,'Limites.pdf');
  fs.writeFileSync(pdf,tinyPdf('Limites1'));
  // O histórico pintado é o das mensagens já salvas (o fake Pi não devolve
  // mensagem nova): a resposta do Pi que vira item do caderno entra semeada.
  // A PRIMEIRA fala do usuário é isca: a tentativa guardada tem de ser a que o
  // Pi estava respondendo (a última antes da resposta), não a primeira do
  // histórico.
  const session=seedSession(runtime,[
   {type:'message',message:{role:'user',content:[{type:'text',text:'primeira tentativa: errei a primeira'}]}},
   {type:'message',message:{role:'user',content:[{type:'text',text:'tentei dividir por x²'}]}},
   {type:'message',message:{role:'assistant',content:[{type:'text',text:'Comece pelo limite pela direita e depois fatore o numerador.'}]}}
  ]);
  writeDeskJson(runtime,{session,courseId:'A',courseStates:{A:{session,pdfs:[{path:pdf,page:1,zoom:1,scrollX:0,scrollY:0}],sessions:[{path:session,started:Date.now(),preview:'sessão do caderno'}]}}});
  writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'A',name:'Matéria A',path:course}]});
  const page=await s.launch();
  const prompt=()=>page.locator('#prompt').inputValue();
  const fileOf=()=>path.join(runtime,'review.json');
  const itemsOf=()=>{
   try{return (JSON.parse(fs.readFileSync(fileOf(),'utf8')).A)||[];}catch{return [];}
  };
  const openCaderno=async()=>{
   const isOpen=await page.evaluate(()=>document.querySelector('#study-menu')?.classList.contains('open')===true);
   if(!isOpen)await page.locator('#study-menu .nav-trigger').click();
   await page.locator('#study-pop #review-open').click();
  };

  /* O `#connect` da boas-vindas é re-renderizado enquanto o app sobe: o clique
     do Playwright morre em "detached". Clica pelo DOM e tenta de novo até o
     histórico estar pintado. */
  const connectIfNeeded=async()=>{
   for(let i=0;i<12;i++){
    if(await page.locator('.message').count())return;
    await page.evaluate(()=>document.querySelector('#connect')?.click());
    await page.waitForTimeout(500);
   }
  };

  await s.step('a resposta do Pi oferece "Guardar para revisar"',async()=>{
   await page.waitForSelector('.pdf-panel canvas',{timeout:30000});
   await connectIfNeeded();
   await page.waitForSelector('.message.assistant button.msg-review',{timeout:25000});
   const button=page.locator('.message.assistant button.msg-review').first();
   assert.equal((await button.textContent()).trim(),'Guardar para revisar');
   assert.equal(await page.locator('.message.user button.msg-review').count(),0,'o usuário não guarda a própria fala');
   await page.fill('#exercise-title','Lista 3 — Limites');
  });

  await s.step('Guardar abre o diálogo pré-preenchido (questão, tentativa, trecho e referência)',async()=>{
   await page.evaluate(()=>{
    const body=document.querySelector('.message.assistant .body');
    const needle='pela direita';
    const walker=document.createTreeWalker(body,NodeFilter.SHOW_TEXT);
    let node=null;
    while(walker.nextNode()){if(walker.currentNode.nodeValue.includes(needle)){node=walker.currentNode;break;}}
    if(!node)throw new Error('trecho não achado na resposta');
    const start=node.nodeValue.indexOf(needle);
    const range=document.createRange();
    range.setStart(node,start);range.setEnd(node,start+needle.length);
    const selection=window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
   });
   await page.locator('.message.assistant button.msg-review').first().click();
   await page.waitForSelector('#review-dialog[open]');
   assert.equal((await page.locator('#review-dialog h2').textContent()).trim(),'Guardar para revisar');
   assert.equal(await page.locator('#review-question').inputValue(),'Lista 3 — Limites');
   assert.equal(await page.locator('#review-attempt').inputValue(),'tentei dividir por x²','a tentativa é a fala que o Pi estava respondendo, não a primeira do histórico');
   assert.equal(await page.locator('#review-difficulty').inputValue(),'pela direita');
   assert.equal((await page.locator('#review-ref').textContent()).trim(),'Referência: Limites, p. 1');
  });

  await s.step('salvar guarda no arquivo por matéria',async()=>{
   await page.locator('#review-save').click();
   await page.waitForFunction(()=>!document.querySelector('#review-dialog').open);
   // O arquivo é escrito pelo IPC depois do fechamento do diálogo: espera.
   for(let i=0;i<20&&itemsOf().length!==1;i++)await page.waitForTimeout(250);
   const saved=itemsOf();
   assert.equal(saved.length,1);
   assert.deepEqual(saved[0],{
    question:'Lista 3 — Limites',
    attempt:'tentei dividir por x²',
    difficulty:'pela direita',
    ref:{name:'Limites',page:1,path:pdf}
   });
  });

  await s.step('a aba Caderno mostra o item, a contagem e a referência',async()=>{
   await openCaderno();
   await page.waitForSelector('#references.review');
   assert.equal(await page.locator('#review-view').isVisible(),true);
   assert.equal(await page.locator('.review-item').count(),1);
   assert.equal((await page.locator('.review-count').textContent()).trim(),'1 item');
   assert.equal((await page.locator('.review-open').textContent()).trim(),'Lista 3 — Limites');
   assert.equal((await page.locator('.review-trouble').textContent()).trim(),'pela direita');
   assert.equal((await page.locator('.review-attempt').textContent()).trim(),'tentei dividir por x²');
   assert.equal((await page.locator('.review-ref').textContent()).trim(),'Limites, p. 1');
   assert.equal(await page.evaluate(()=>getComputedStyle(document.querySelector('#pdf-grid')).visibility),'hidden');
  });

  await s.step('Semelhante escreve o prompt no composer e foca',async()=>{
   await page.locator('.review-similar').click();
   const text=await prompt();
   assert.match(text,/^Quero um exercício semelhante a este, com outros números:/);
   assert.match(text,/Lista 3 — Limites/);
   assert.match(text,/Onde eu travei: pela direita/);
   assert.match(text,/Referência: Limites, p\. 1/);
   assert.equal(await page.evaluate(()=>document.activeElement?.id),'prompt');
  });

  await s.step('Tentar de novo escreve o outro prompt (com a tentativa)',async()=>{
   await page.locator('.review-redo').click();
   const text=await prompt();
   assert.match(text,/^Vou refazer este exercício:/);
   assert.match(text,/O que eu tentei: tentei dividir por x²/);
  });

  await s.step('clicar no item abre a edição e salvar atualiza a linha',async()=>{
   await page.locator('.review-open').click();
   await page.waitForSelector('#review-dialog[open]');
   assert.equal(await page.locator('#review-question').inputValue(),'Lista 3 — Limites');
   await page.fill('#review-difficulty','fatoração');
   await page.locator('#review-save').click();
   await page.waitForFunction(()=>!document.querySelector('#review-dialog').open);
   await page.waitForFunction(()=>document.querySelector('.review-trouble')?.textContent.trim()==='fatoração');
   assert.equal((await page.locator('.review-count').textContent()).trim(),'1 item','editar não duplica');
   assert.equal(itemsOf()[0].difficulty,'fatoração');
  });

  await s.step('remover pede confirmação, limpa a linha e o arquivo',async()=>{
   page.once('dialog',dialog=>dialog.accept());
   await page.locator('.review-remove').click();
   await page.waitForSelector('.review-empty');
   assert.equal(await page.locator('.review-item').count(),0);
   assert.equal((await page.locator('.review-count').textContent()).trim(),'0 itens');
   assert.deepEqual(itemsOf(),[]);
  });

  await s.step('o caderno e o GeoGebra não dividem a área de estudo',async()=>{
   await page.locator('#course-tabs button[data-id="geogebra"]').click();
   await page.waitForSelector('#references.ggb');
   assert.equal(await page.locator('#review-view').isVisible(),false,'abrir o applet fecha o caderno');
   await openCaderno();
   await page.waitForSelector('#references.review');
   assert.equal(await page.evaluate(()=>document.querySelector('#references').classList.contains('ggb')),false);
   assert.equal(await page.locator('#ggb-bar').isVisible(),false);
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
console.log(`\n==== hunt-review: ${all.length} cenários, ${all.length-failed.length} ok, ${failed.length} com falha ====`);
if(failed.length)console.log(failed.map(entry=>`- ${entry.title}: ${entry.failures.map(f=>f.name).join(' | ')}`).join('\n'));
console.log(`artefatos: ${ART}`);
process.exit(failed.length?1:0);
