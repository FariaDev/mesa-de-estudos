/* Caça a bugs da navegação entre a resposta e o material (pedido 5): a citação
   clicável, o popover "Navegar" (favoritos nomeados + sumário) e o Voltar.
   Roda com o mesmo boot do ui-smoke (Playwright + fake Pi + runtime temporário).
   Uso: node tests/hunt-nav.mjs [filtro]

   Cenários:
     N1: citação clicável, favoritos nomeados e Voltar;
     N2: dois leitores — citação com espaço no nome do PDF, favorito salvo pelo
         painel de origem e favorito fora da biblioteca da matéria (a lista da
         tela é filtrada; editar/remover vai pela identidade, não pelo índice).

   NUNCA roda o app real: só helpers.mjs (LEARNING_DESK_RUNTIME temporário).

   Sobre o SUMÁRIO: o PDF artesanal dos helpers não tem `/Outlines`, então o
   cenário prova o caminho "documento sem sumário" (a nota de vazio do núcleo) e
   o mapeamento do sumário fica coberto pela unidade (`pdfnav.test.mjs`, as leis
   em `core/laws/pdfnav.bend` e o `panel.outline()` do host). */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {launchDesk,newRuntime,seedCourse,seedSession,writeDeskJson,writeConfigJson} from './helpers.mjs';

const DESK=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const STAMP=new Date().toISOString().replace(/[:.]/g,'-').replace(/Z$/,'');
const ART=path.join(DESK,'tests','artifacts',`hunt-nav-${STAMP}`);
fs.mkdirSync(ART,{recursive:true});
const slice=(s,n=60)=>String(s??'').replace(/\s+/g,' ').trim().slice(0,n);
const slug=s=>String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,50);

const all=[];
/* PDF de N páginas (o `tinyPdf` dos helpers tem uma só): a citação aponta para
   a página 3 e o `goto` do leitor clampa em `numPages` — com uma página só o
   teste mediria o clamp, não a navegação. */
function pagesPdf(count){
 const objs=['<</Type/Catalog/Pages 2 0 R>>',`<</Type/Pages/Kids[${Array.from({length:count},(_,i)=>`${4+i} 0 R`).join(' ')}]/Count ${count}>>`,'<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>'];
 for(let i=0;i<count;i++)objs.push(`<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Resources<</Font<</F1 3 0 R>>>>/Contents ${4+count+i} 0 R>>`);
 for(let i=0;i<count;i++){const c=`BT /F1 16 Tf 72 720 Td (pagina ${i+1}) Tj ET`;objs.push(`<</Length ${c.length}>>\nstream\n${c}\nendstream`);}
 let out='%PDF-1.4\n';const offs=[];
 objs.forEach((obj,i)=>{offs.push(out.length);out+=`${i+1} 0 obj\n${obj}\nendobj\n`;});
 const start=out.length;
 out+=`xref\n0 ${objs.length+1}\n0000000000 65535 f \n${offs.map(off=>`${String(off).padStart(10,'0')} 00000 n \n`).join('')}trailer\n<</Size ${objs.length+1}/Root 1 0 R>>\nstartxref\n${start}\n%%EOF\n`;
 return Buffer.from(out,'latin1');
}
class Scenario{
 constructor(title){
  this.title=title;this.steps=0;this.failures=[];this.notes=[];
  this.runtime=newRuntime(slug(title)||'hunt-nav');
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
/* N1: citação clicável, favoritos nomeados e Voltar                   */
/* ------------------------------------------------------------------ */

if(only('navegacao')){
 const s=new Scenario('navegacao citação favoritos e voltar');
 try{
  const runtime=s.runtime;
  const course=seedCourse(runtime,'A');
  const pdf=path.join(course,'Limites.pdf');
  fs.writeFileSync(pdf,pagesPdf(3));
  // O histórico pintado é o das mensagens do usuário (o fake Pi não devolve
  // mensagem nova): a citação entra na fala que o usuário já tinha.
  const session=seedSession(runtime,[
   {type:'message',message:{role:'user',content:[{type:'text',text:'Está no começo: veja Limites.pdf, p. 3 e depois volte para os exemplos.'}]}}
  ]);
  writeDeskJson(runtime,{session,courseId:'A',courseStates:{A:{session,pdfs:[{path:pdf,page:1,zoom:1,scrollX:0,scrollY:0}],sessions:[{path:session,started:Date.now(),preview:'sessão com citação'}]}}});
  writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'A',name:'Matéria A',path:course}]});
  const page=await s.launch();
  const pages=()=>page.locator('.pdf-panel .page-number').first().inputValue();
  const backBtn=page.locator('.pdf-panel .pdf-title button.back').first();
  const navBtn=page.locator('.pdf-panel .pdf-title button.nav').first();

  await s.step('o leitor sobe com o Voltar escondido e o Navegar fechado',async()=>{
   await page.waitForSelector('.pdf-panel canvas',{timeout:30000});
   // O histórico pinta na conexão: o vazio da primeira abertura tem o
   // "Conectar". Ele é re-renderizado enquanto o app sobe (o clique do
   // Playwright morre em "detached"), então clica pelo DOM e tenta de novo.
   for(let i=0;i<12;i++){
    if(await page.locator('#messages .body').count())break;
    await page.evaluate(()=>document.querySelector('#connect')?.click());
    await page.waitForTimeout(500);
   }
   await page.waitForSelector('#messages .body',{timeout:25000});
   assert.equal(await backBtn.getAttribute('hidden'),'','o Voltar só aparece com o que voltar');
   assert.equal(await navBtn.getAttribute('aria-expanded'),'false');
   assert.equal(await navBtn.getAttribute('data-icon'),null,'o andaime do ícone sai do DOM');
   assert.equal(await navBtn.locator('svg.icon').count(),1,'o ícone do Navegar é asset do host');
   assert.equal(await page.locator('.pdf-nav-pop').count(),0,'o popover só nasce no primeiro clique');
  });

  await s.step('a citação da resposta vira link para a página',async()=>{
   const ref=page.locator('#messages button.pdf-ref').first();
   assert.equal((await ref.textContent()).trim(),'Limites.pdf, p. 3','o rótulo é o do núcleo');
   assert.match(await ref.getAttribute('title'),/Abrir Limites\.pdf na p\. 3/);
   assert.equal(await ref.getAttribute('aria-label'),'Abrir a página 3 de Limites.pdf');
   assert.equal(await ref.getAttribute('data-path'),pdf);
   assert.equal(await ref.getAttribute('data-page'),'3');
  });

  await s.step('clicar na citação pula a página e acende o Voltar',async()=>{
   await page.locator('#messages button.pdf-ref').first().click();
   await page.waitForFunction(()=>document.querySelector('.pdf-panel .page-number')?.value==='3',undefined,{timeout:10000});
   assert.equal(await pages(),'3');
   await page.waitForFunction(()=>!document.querySelector('.pdf-panel .pdf-title button.back')?.hasAttribute('hidden'),undefined,{timeout:5000});
  });

  await s.step('o popover abre com as notas de vazio (favoritos e sumário)',async()=>{
   await navBtn.click();
   await page.waitForSelector('.pdf-nav-pop');
   // O corpo do popover é remontado depois do sumário (async): o `hidden` sai
   // no clique, mas o `aria-expanded` e o corpo só ficam prontos no fim do
   // refresh — sem esperar, o teste lê o nó velho (e o Playwright recusa
   // clicar num botão que acabou de ser substituído).
   await page.waitForFunction(()=>{
    const pop=document.querySelector('.pdf-nav-pop');
    const btn=document.querySelector('.pdf-panel .pdf-title button.nav');
    return !!pop&&!pop.hidden&&btn?.getAttribute('aria-expanded')==='true';
   },undefined,{timeout:10000});
   assert.equal(await navBtn.getAttribute('aria-expanded'),'true');
   assert.equal((await page.locator('.pdf-nav-pop .nav-section h4').first().textContent()).trim(),'Favoritos desta matéria');
   assert.match(await page.locator('.pdf-nav-pop').textContent(),/Nenhum favorito nesta matéria\./);
   assert.match(await page.locator('.pdf-nav-pop').textContent(),/Este PDF não tem sumário\./);
   assert.equal((await page.locator('.pdf-nav-pop .nav-save').textContent()).trim(),'Guardar esta página…');
  });

  await s.step('Guardar esta página abre o diálogo pré-preenchido',async()=>{
   await page.locator('.pdf-nav-pop .nav-save').click();
   await page.waitForSelector('#bookmark-dialog[open]');
   assert.equal((await page.locator('#bookmark-dialog h2').textContent()).trim(),'Guardar esta página');
   assert.equal(await page.locator('#bookmark-name').inputValue(),'Limites');
   assert.match(await page.locator('#bookmark-dialog .help-lead').textContent(),/Limites, p\. 3/);
   assert.equal(await page.locator('#bookmark-save').getAttribute('value'),'ok');
  });

  await s.step('salvar guarda no disco e a linha aparece no popover',async()=>{
   await page.locator('#bookmark-save').click();
   await page.waitForFunction(()=>!document.querySelector('#bookmark-dialog').open);
   await page.waitForSelector('.pdf-nav-pop .nav-bookmark');
   assert.equal((await page.locator('.pdf-nav-pop .nav-bookmark .nav-name').textContent()).trim(),'Limites');
   assert.equal((await page.locator('.pdf-nav-pop .nav-page').textContent()).trim(),'p. 3');
   assert.equal(await page.locator('.pdf-nav-pop .nav-bookmark').getAttribute('data-page'),'3');
   const saved=JSON.parse(fs.readFileSync(path.join(runtime,'bookmarks.json'),'utf8'));
   assert.deepEqual(saved.A,[{name:'Limites',path:pdf,page:3}]);
  });

  await s.step('clicar no favorito abre a página e fecha o popover',async()=>{
   await page.locator('.pdf-nav-pop .nav-bookmark').click();
   await page.waitForFunction(()=>document.querySelector('.pdf-nav-pop')?.hidden===true,undefined,{timeout:5000});
   assert.equal(await pages(),'3');
  });

  await s.step('remover tira a linha e limpa o arquivo',async()=>{
   await navBtn.click();
   await page.waitForFunction(()=>document.querySelector('.pdf-nav-pop')?.hidden===false,undefined,{timeout:5000});
   await page.locator('.pdf-nav-pop .nav-bookmark-remove').click();
   await page.waitForFunction(()=>!document.querySelector('.pdf-nav-pop .nav-bookmark'),undefined,{timeout:10000});
   assert.match(await page.locator('.pdf-nav-pop').textContent(),/Nenhum favorito nesta matéria\./);
   const saved=JSON.parse(fs.readFileSync(path.join(runtime,'bookmarks.json'),'utf8'));
   assert.deepEqual(saved,{});
  });

  await s.step('Voltar devolve a página e some',async()=>{
   await backBtn.click();
   await page.waitForFunction(()=>document.querySelector('.pdf-panel .page-number')?.value==='1',undefined,{timeout:10000});
   assert.equal(await pages(),'1');
   await page.waitForFunction(()=>document.querySelector('.pdf-panel .pdf-title button.back')?.hasAttribute('hidden'),undefined,{timeout:5000});
  });

  await s.step('clique fora e Esc fecham o popover',async()=>{
   await navBtn.click();
   await page.waitForFunction(()=>document.querySelector('.pdf-nav-pop')?.hidden===false);
   await page.mouse.click(5,400);
   await page.waitForFunction(()=>document.querySelector('.pdf-nav-pop')?.hidden===true);
   await navBtn.click();
   await page.waitForFunction(()=>document.querySelector('.pdf-nav-pop')?.hidden===false);
   await page.keyboard.press('Escape');
   await page.waitForFunction(()=>document.querySelector('.pdf-nav-pop')?.hidden===true);
   assert.equal(await navBtn.getAttribute('aria-expanded'),'false');
  });

  await s.step('sem erros de página',async()=>{
   assert.deepEqual(s.errors,[]);
  });
 }finally{await s.close();}
 s.finish();
}

/* ------------------------------------------------------------------ */
/* N2: dois leitores — citação com espaço no nome, favorito do painel  */
/* certo e favorito oculto (a lista da tela é filtrada)                */
/* ------------------------------------------------------------------ */

if(only('dois leitores')){
 const s=new Scenario('dois leitores citacao com espaco e favorito oculto');
 try{
  const runtime=s.runtime;
  const course=seedCourse(runtime,'A');
  const limites=path.join(course,'Limites.pdf');
  const lista=path.join(course,'Lista 2.pdf');
  fs.writeFileSync(limites,pagesPdf(3));
  fs.writeFileSync(lista,pagesPdf(2));
  const fora=path.join(runtime,'fora','Sumido.pdf');
  /* Três citações na mesma fala: a do nome com espaço, a do fim de uma frase
     longa (o corte antigo parava depois de cinco palavras) e a de um arquivo
     que não está na biblioteca (essa continua texto). */
  const session=seedSession(runtime,[
   {type:'message',message:{role:'user',content:[{type:'text',text:'Anota: o exercício está no Lista 2.pdf, p. 2 e o resumo que eu fiz está no arquivo que veio junto do material impresso é o Limites.pdf, p. 3. O gabarito inventado está no Inexistente.pdf, p. 4.'}]}}
  ]);
  writeDeskJson(runtime,{session,courseId:'A',courseStates:{A:{session,pdfs:[
   {path:limites,page:1,zoom:1,scrollX:0,scrollY:0},
   {path:lista,page:1,zoom:1,scrollX:0,scrollY:0}
  ],sessions:[{path:session,started:Date.now(),preview:'sessão com dois PDFs'}]}}});
  writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'A',name:'Matéria A',path:course}],
   desk:{panels:[{label:'Enunciado',prefer:['Limites']},{label:'Lista',prefer:['Lista']}]}});
  /* Um favorito OCULTO (PDF que saiu da biblioteca) vem PRIMEIRO no arquivo: na
     tela o visível é a posição 0, no arquivo ele é o segundo. */
  fs.writeFileSync(path.join(runtime,'bookmarks.json'),JSON.stringify({A:[
   {name:'Sumido',path:fora,page:1},
   {name:'Limites',path:limites,page:1}
  ]}));
  const page=await s.launch();
  const panel=n=>page.locator('.pdf-panel').nth(n);
  const pages=n=>panel(n).locator('.page-number').inputValue();
  const navBtn=n=>panel(n).locator('.pdf-title button.nav');
  const pop=n=>panel(n).locator('.pdf-nav-pop');
  const rows=n=>pop(n).locator('.nav-row');
  const names=n=>rows(n).locator('.nav-name').allTextContents();
  const bookmarksFile=()=>JSON.parse(fs.readFileSync(path.join(runtime,'bookmarks.json'),'utf8')).A;
  const popOpen=n=>page.waitForFunction(index=>{
   const root=document.querySelectorAll('.pdf-panel')[index];
   const box=root?.querySelector('.pdf-nav-pop');
   const btn=root?.querySelector('.pdf-title button.nav');
   return !!box&&!box.hidden&&btn?.getAttribute('aria-expanded')==='true';
  },n,{timeout:10000});
  /* O `#connect` da boas-vindas é re-renderizado enquanto o app sobe: o clique
     do Playwright morre em "detached". Clica pelo DOM e tenta de novo. */
  const connectIfNeeded=async()=>{
   for(let i=0;i<12;i++){
    if(await page.locator('#messages .body').count())return;
    await page.evaluate(()=>document.querySelector('#connect')?.click());
    await page.waitForTimeout(500);
   }
  };

  await s.step('os dois leitores sobem, um deles com nome de duas palavras',async()=>{
   await page.waitForSelector('.pdf-panel canvas',{timeout:30000});
   await connectIfNeeded();
   await page.waitForFunction(()=>{
    const panels=[...document.querySelectorAll('.pdf-panel')];
    return panels.length===2&&panels.every(one=>one.querySelector('canvas')&&one.querySelector('.page-number')?.value==='1');
   },undefined,{timeout:30000});
   assert.equal(await page.locator('.pdf-panel').count(),2);
   assert.equal(await panel(0).locator('.pdf-select').inputValue(),limites);
   assert.equal(await panel(1).locator('.pdf-select').inputValue(),lista,'o segundo leitor abre o PDF com espaço no nome');
   assert.equal(await pages(0),'1');
   assert.equal(await pages(1),'1');
  });

  await s.step('a citação com espaço e a do fim da frase longa viram link; a desconhecida não',async()=>{
   await page.waitForFunction(()=>document.querySelectorAll('#messages .message.user button.pdf-ref').length===2,undefined,{timeout:25000});
   const refs=page.locator('#messages .message.user button.pdf-ref');
   assert.equal((await refs.nth(0).textContent()).trim(),'Lista 2.pdf, p. 2');
   assert.equal(await refs.nth(0).getAttribute('data-path'),lista);
   assert.equal(await refs.nth(0).getAttribute('data-page'),'2');
   assert.equal((await refs.nth(1).textContent()).trim(),'Limites.pdf, p. 3','a citação depois de uma frase longa também é reconhecida');
   assert.equal(await refs.nth(1).getAttribute('data-path'),limites);
   const body=await page.locator('#messages .message.user .body').innerText();
   assert.match(body,/Inexistente\.pdf, p\. 4/,'citação de arquivo fora da biblioteca continua texto');
   assert.equal(await page.locator('#messages button.pdf-ref[data-name="Inexistente.pdf"]').count(),0);
  });

  await s.step('clicar na citação com espaço abre a página no leitor daquele PDF',async()=>{
   await page.locator('#messages .message.user button.pdf-ref').nth(0).click();
   await page.waitForFunction(()=>document.querySelectorAll('.pdf-panel')[1]?.querySelector('.page-number')?.value==='2',undefined,{timeout:10000});
   assert.equal(await pages(0),'1','o leitor que não é o dono do arquivo não se mexe');
   await page.waitForFunction(()=>!document.querySelectorAll('.pdf-panel')[1]?.querySelector('.pdf-title button.back')?.hasAttribute('hidden'),undefined,{timeout:5000});
  });

  await s.step('clicar na citação da frase longa pula o outro leitor',async()=>{
   await page.locator('#messages .message.user button.pdf-ref').nth(1).click();
   await page.waitForFunction(()=>document.querySelectorAll('.pdf-panel')[0]?.querySelector('.page-number')?.value==='3',undefined,{timeout:10000});
   assert.equal(await pages(1),'2','cada citação abre o leitor do arquivo dela');
  });

  await s.step('o favorito oculto fica fora da tela',async()=>{
   await navBtn(1).click();
   await popOpen(1);
   assert.equal(await rows(1).count(),1,'favorito de PDF fora da biblioteca não entra na lista da tela');
   assert.deepEqual((await names(1)).map(s=>s.trim()),['Limites']);
  });

  await s.step('guardar no segundo leitor usa o PDF e a página DELE',async()=>{
   await pop(1).locator('.nav-save').click();
   await page.waitForSelector('#bookmark-dialog[open]');
   assert.equal(await page.locator('#bookmark-name').inputValue(),'Lista 2','o nome sugerido é o do leitor que pediu');
   assert.match(await page.locator('#bookmark-dialog .help-lead').textContent(),/Lista 2, p\. 2/);
   await page.locator('#bookmark-save').click();
   await page.waitForFunction(()=>!document.querySelector('#bookmark-dialog').open);
   await page.waitForFunction(()=>document.querySelectorAll('.pdf-panel')[1]?.querySelectorAll('.nav-row').length===2,undefined,{timeout:10000});
   assert.deepEqual(bookmarksFile(),[
    {name:'Lista 2',path:lista,page:2},
    {name:'Sumido',path:fora,page:1},
    {name:'Limites',path:limites,page:1}
   ],'o favorito novo entra na frente e o oculto continua no arquivo');
   assert.deepEqual((await names(1)).map(s=>s.trim()),['Lista 2','Limites'],'a tela mostra só os autorizados');
  });

  await s.step('remover o favorito da tela não leva o oculto junto',async()=>{
   // 'Limites' é a posição 1 da TELA, mas no arquivo ele é o último, depois do
   // favorito oculto: remover por posição levaria o 'Sumido' e deixaria o
   // 'Limites'.
   await pop(1).locator('.nav-row',{hasText:'Limites'}).locator('.nav-bookmark-remove').click();
   await page.waitForFunction(()=>document.querySelectorAll('.pdf-panel')[1]?.querySelectorAll('.nav-row').length===1,undefined,{timeout:10000});
   assert.deepEqual(bookmarksFile(),[
    {name:'Lista 2',path:lista,page:2},
    {name:'Sumido',path:fora,page:1}
   ],'saiu o favorito clicado e o oculto ficou no arquivo');
   assert.deepEqual((await names(1)).map(s=>s.trim()),['Lista 2'],'e a tela continua sem o oculto');
  });

  await s.step('guardar no primeiro leitor usa o outro PDF e a página atual dele',async()=>{
   await navBtn(0).click();
   await popOpen(0);
   await pop(0).locator('.nav-save').click();
   await page.waitForSelector('#bookmark-dialog[open]');
   assert.equal(await page.locator('#bookmark-name').inputValue(),'Limites');
   assert.match(await page.locator('#bookmark-dialog .help-lead').textContent(),/Limites, p\. 3/);
   await page.locator('#bookmark-save').click();
   await page.waitForFunction(()=>!document.querySelector('#bookmark-dialog').open);
   await page.waitForFunction(()=>document.querySelectorAll('.pdf-panel')[0]?.querySelectorAll('.nav-row').length===2,undefined,{timeout:10000});
   assert.deepEqual(bookmarksFile(),[
    {name:'Limites',path:limites,page:3},
    {name:'Lista 2',path:lista,page:2},
    {name:'Sumido',path:fora,page:1}
   ],'o favorito do outro leitor guarda o caminho e a página dele');
   assert.deepEqual((await names(0)).map(s=>s.trim()),['Limites','Lista 2']);
  });

  await s.step('sem erros de página',async()=>{
   assert.deepEqual(s.errors,[]);
  });
 }finally{await s.close();}
 s.finish();
}

/* ------------------------------------------------------------------ */
const failed=all.filter(e=>!e.ok);
console.log(`\n==== hunt-nav: ${all.length} cenários, ${all.filter(e=>e.ok).length} ok, ${failed.length} com falha ====`);
for(const entry of failed){
 console.log(`- ${entry.title}: ${entry.failures.map(f=>f.name).join(' | ')}`);
}
console.log(`artefatos: ${ART}`);
if(failed.length)process.exitCode=1;
