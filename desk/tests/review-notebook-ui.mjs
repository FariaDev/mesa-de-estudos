// node tests/review-notebook-ui.mjs — Caderno de revisão (ticket #34), medido na janela.
// Cobre os critérios da tela: barra de 40px (título, matéria, contagem e ×),
// vazio como UM bloco centrado (título serifado, frase, miniatura), duas colunas
// quando há itens (item do dia à esquerda; "Todos os itens" em 340px à direita),
// cartão com UMA ação preenchida, "Como foi?" com quatro respostas e a lista
// agrupada em "Vence hoje" e "Próximos". Nos dois temas, em 1440×900 e 900×650.
// Capturas para olho humano só com MESA_REVIEW_SHOTS.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
 withArtifacts,newRuntime,seedCourse,writeConfigJson,writeDeskJson,launchDesk,statusOnline,tinyPdf,
 reviewShot,screenshotDirectory,setTheme,freezeMotion,resizeWindow
} from './helpers.mjs';
import {layoutStable} from './waits.mjs';

const out=screenshotDirectory('review-notebook');
const near=(a,b,tol=1)=>Math.abs(a-b)<=tol;
const resize=async(ctx,page,width,height)=>{
 await resizeWindow(ctx.app,page,width,height,{content:true});
 await layoutStable(page,'main');
};
const measureBoard=page=>page.evaluate(()=>{
 const box=sel=>{const el=document.querySelector(sel);if(!el)return null;const b=el.getBoundingClientRect(),s=getComputedStyle(el);return {top:b.top,bottom:b.bottom,left:b.left,right:b.right,width:b.width,height:b.height,font:s.fontSize,family:s.fontFamily,radius:s.borderTopLeftRadius,bg:s.backgroundColor,weight:s.fontWeight,scrollW:el.scrollWidth,clientW:el.clientWidth};};
 const all=sel=>[...document.querySelectorAll(sel)].map(el=>{const b=el.getBoundingClientRect(),s=getComputedStyle(el);return {top:b.top,bottom:b.bottom,left:b.left,right:b.right,width:b.width,height:b.height,bg:s.backgroundColor};});
 return {
  bar:box('#review-bar'),title:box('#review-bar h2'),course:box('.review-course'),count:box('.review-count'),close:box('.review-close'),
  view:box('#review-view'),main:box('.review-main'),aside:box('#review-list'),asideHead:box('.review-all-head'),
  card:box('.review-card'),question:box('.review-question'),progress:box('.review-progress'),track:box('.review-bar-track'),
  grades:all('.review-grade'),gradesBlock:box('.review-grades'),rows:all('.review-row'),
  actions:all('.review-actions button'),empty:box('.review-empty-block'),emptyTitle:box('.review-empty-title'),emptySample:box('.review-empty-sample'),
  overflowX:document.documentElement.scrollWidth-document.documentElement.clientWidth
 };
});

function seed(tag){
 const runtime=newRuntime(tag);
 const course=seedCourse(runtime,'calc');
 const pdf=path.join(course,'Limites.pdf');fs.writeFileSync(pdf,tinyPdf('Limites e derivadas'));
 writeConfigJson(runtime,{runtimePath:runtime,vaultPath:runtime,courses:[{id:'calc',name:'Cálculo I',path:course}]});
 writeDeskJson(runtime,{courseId:'calc',courseStates:{calc:{pdfs:[{path:pdf,page:1}],study:{title:'',xopp:''}}}});
 return {runtime,pdf};
}

const openCaderno=async page=>{
 await page.locator('#study-menu .nav-trigger').click();
 await page.locator('#study-menu #study-review-today').click();
 await page.waitForSelector('#references.review');
};

await withArtifacts('review-notebook',async ctx=>{
 const {runtime,pdf}=ctx.seed=seed('review-notebook');
 ctx.runtime=runtime;
 ctx.app=await launchDesk({runtime});
 const page=await ctx.app.firstWindow();
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await resize(ctx,page,1440,900);
 await statusOnline(page);
 await freezeMotion(page);
 await page.waitForSelector('.pdf-panel canvas',{timeout:30000});

 /* ---------- vazio ---------- */
 await openCaderno(page);
 for(const [width,height] of [[1440,900],[900,650]]){
  await resize(ctx,page,width,height);
  for(const theme of ['light','dark']){
   await setTheme(page,theme);
   const tag=`vazio ${theme} ${width}×${height}`;
   await page.waitForSelector('.review-empty-block');
   const m=await measureBoard(page);
   assert.ok(near(m.bar.height,40,0.6),`${tag}: barra de 40px (${m.bar.height})`);
   assert.equal((await page.locator('#review-bar h2').textContent()).trim(),'Caderno de revisão',`${tag}: título`);
   assert.equal(m.course.width>0,true,`${tag}: a matéria aparece na barra`);
   assert.equal((await page.locator('.review-course').textContent()).trim(),'Cálculo I');
   assert.equal((await page.locator('.review-count').textContent()).trim(),'0 itens',`${tag}: contagem`);
   assert.ok(near(m.close.width,28,0.6)&&near(m.close.height,28,0.6),`${tag}: × de 28px (${m.close.width}×${m.close.height})`);
   assert.equal(await page.locator('.review-close').getAttribute('aria-label'),'Fechar o caderno');
   assert.equal(m.emptyTitle.font,'24px',`${tag}: título do vazio em 24px`);
   assert.match(m.emptyTitle.family,/^"?STIX Two Text/,`${tag}: título na STIX`);
   assert.equal((await page.locator('.review-empty-title').textContent()).trim(),'Nada guardado ainda');
   assert.match((await page.locator('.review-empty').textContent()),/Guardar para revisar/);
   assert.equal(await page.locator('.review-empty-sample').count(),1,`${tag}: miniatura da fileira de ações`);
   /* Centrado, sem vão: o bloco ocupa o meio da área, não o topo. */
   const centerX=(m.empty.left+m.empty.right)/2,viewX=(m.view.left+m.view.right)/2;
   const centerY=(m.empty.top+m.empty.bottom)/2,viewY=(m.view.top+m.view.bottom)/2;
   assert.ok(near(centerX,viewX,2),`${tag}: bloco centrado na horizontal`);
   assert.ok(near(centerY,viewY,4),`${tag}: bloco centrado na vertical`);
   assert.ok(m.empty.width<=420.5,`${tag}: bloco de até 420px (${m.empty.width})`);
   assert.equal(m.overflowX,0,`${tag}: sem rolagem horizontal`);
   assert.equal(await page.locator('#review-today').count(),0,`${tag}: sem coluna do dia quando não há itens`);
   await reviewShot(page,out,`caderno-vazio-${theme}-${width}.png`);
  }
 }

 /* ---------- com itens ---------- */
 await page.evaluate(async path=>{
  const ref=(page)=>({path,name:'Limites.pdf',page});
  await window.desk.reviewSave({mode:'add',item:{question:'Calcule o limite de (x² − 4)/(x − 2) quando x tende a 2 e explique por que substituir direto não funciona.',attempt:'Esqueci de fatorar antes de substituir. Dá 0/0.',difficulty:'Fatorar (x−2)(x+2).',ref:ref(12)}});
  await window.desk.reviewSave({mode:'add',item:{question:'Limite lateral de |x|/x em 0',attempt:'',difficulty:'',ref:ref(3)}});
  await window.desk.reviewSave({mode:'add',item:{question:'Regra de L’Hôpital: quando vale',attempt:'',difficulty:'Esqueço a hipótese de indeterminação.',ref:ref(31)}});
 },pdf);
 await page.locator('.review-close').click();
 await openCaderno(page);
 await page.waitForFunction(()=>document.querySelectorAll('.review-row').length===3,{timeout:15000});
 await page.waitForFunction(()=>document.querySelector('.review-count')?.textContent.trim()==='3 para hoje · 3 no caderno');

 for(const [width,height] of [[1440,900],[900,650]]){
  await resize(ctx,page,width,height);
  for(const theme of ['light','dark']){
   await setTheme(page,theme);
   const tag=`itens ${theme} ${width}×${height}`;
   const m=await measureBoard(page);
   assert.ok(near(m.bar.height,40,0.6),`${tag}: barra de 40px`);
   assert.equal(m.empty,null,`${tag}: sem bloco vazio`);
   /* Duas colunas: a direita tem 340px na janela larga e nunca passa disso. */
   if(width===1440)assert.ok(near(m.aside.width,340,0.6),`${tag}: lista de 340px (${m.aside.width})`);
   assert.ok(m.aside.width>=199.5&&m.aside.width<=340.5,`${tag}: lista entre 200 e 340px (${m.aside.width})`);
   assert.ok(near(m.aside.right,m.view.right,0.6)&&near(m.main.left,m.view.left,0.6),`${tag}: colunas ocupam a tela inteira`);
   assert.ok(near(m.asideHead.height,40,0.6),`${tag}: cabeçalho da lista de 40px`);
   assert.equal((await page.locator('.review-all-head h3').textContent()).trim(),'Todos os itens');
   assert.equal((await page.locator('.review-all-count').textContent()).trim(),'3');
   assert.deepEqual(await page.locator('.review-group-title').allTextContents(),['Vence hoje'],`${tag}: grupos`);
   assert.equal(m.rows.length,3);
   /* Cartão: raio 12px, enunciado na STIX de 24px/500 (22px em coluna estreita), #61. */
   assert.equal(m.card.radius,'12px',`${tag}: cartão com raio 12px`);
   assert.match(m.question.family,/^"?STIX Two Text/,`${tag}: enunciado na STIX`);
   assert.ok(['24px','22px'].includes(m.question.font),`${tag}: enunciado em 24px (ou 22px estreito): ${m.question.font}`);
   assert.equal(m.question.weight,'500',`${tag}: enunciado no peso 500`);
   assert.ok(m.question.height>0&&m.question.bottom<=m.card.bottom,`${tag}: enunciado dentro do cartão`);
   /* Progresso: "Para hoje 1 de 3" e a trilha. */
   assert.equal((await page.locator('.review-kicker').textContent()).trim(),'Para hoje');
   assert.equal((await page.locator('.review-position').textContent()).trim(),'1 de 3');
   assert.ok(m.track.width>=40&&near(m.track.height,4,0.6),`${tag}: trilha de progresso de 4px`);
   /* Uma ação preenchida só: Tentar de novo com o tutor. */
   const filled=m.actions.filter(a=>!/rgba\(0, 0, 0, 0\)|transparent/.test(a.bg));
   assert.equal(filled.length,1,`${tag}: uma ação preenchida (${filled.length})`);
   assert.equal((await page.locator('.review-actions .primary').textContent()).trim(),'Tentar de novo com o tutor');
   assert.deepEqual(await page.locator('.review-actions button').allTextContents(),['Tentar de novo com o tutor','Pedir um parecido','Editar','Remover']);
   /* "Como foi?": quatro respostas de 56px, abaixo do cartão, cada uma diz quando volta. */
   assert.equal((await page.locator('.review-grades-title').textContent()).trim(),'Como foi?');
   assert.equal(m.grades.length,4,`${tag}: quatro respostas`);
   for(const g of m.grades){
    assert.ok(near(g.height,56,0.6),`${tag}: resposta de 56px (${g.height})`);
    assert.ok(g.top>=m.card.bottom-0.5,`${tag}: respostas abaixo do cartão`);
   }
   assert.deepEqual(await page.locator('.review-grade-name').allTextContents(),['Errei','Difícil','Bom','Fácil']);
   assert.deepEqual(await page.locator('.review-grade-when').allTextContents(),['volta amanhã','volta amanhã','volta amanhã','volta em 3 dias']);
   /* Nada estoura: nem a janela, nem a coluna do item. */
   assert.equal(m.overflowX,0,`${tag}: sem rolagem horizontal`);
   assert.ok(m.main.scrollW<=m.main.clientW+1,`${tag}: coluna do item sem rolagem lateral`);
   await reviewShot(page,out,`caderno-itens-${theme}-${width}.png`);
  }
 }

 /* ---------- interação ---------- */
 await resize(ctx,page,1440,900);
 await page.locator('.review-row',{hasText:'Limite lateral'}).click();
 assert.equal((await page.locator('.review-question').textContent()).trim(),'Limite lateral de |x|/x em 0');
 assert.equal(await page.locator('.review-row[aria-current=true]').count(),1,'um item marcado na lista');
 assert.equal(await page.locator('.review-notes').count(),0,'sem tentativa nem dificuldade, as notas somem');
 await page.locator('#review-today .review-grade',{hasText:'Bom'}).click();
 await page.waitForFunction(()=>document.querySelector('.review-count')?.textContent.trim()==='2 para hoje · 3 no caderno');
 assert.deepEqual(await page.locator('.review-group-title').allTextContents(),['Vence hoje','Próximos']);
 assert.equal((await page.locator('.review-position').textContent()).trim(),'2 de 3');
 await page.locator('.review-close').click();
 assert.equal(await page.locator('#review-view').isHidden(),true,'o × fecha o caderno');
 assert.deepEqual(errors,[]);
});
/* ---------- #42 (6): Caderno aberto + clicar numa matéria ----------
   Clicar na matéria fecha o Caderno e vai para ela. Durante a resposta do
   tutor as OUTRAS matérias seguem travadas (com a dica), mas a atual fica
   clicável: voltar a ela do Caderno não troca de contexto. O × continua. */
await withArtifacts('review-notebook-course',async ctx=>{
 const runtime=ctx.runtime=newRuntime('review-course');
 const calc=seedCourse(runtime,'calc'),fis=seedCourse(runtime,'fis');
 const pdf=path.join(calc,'Limites.pdf');fs.writeFileSync(pdf,tinyPdf('Limites'));
 fs.writeFileSync(path.join(fis,'Ondas.pdf'),tinyPdf('Ondas'));
 writeConfigJson(runtime,{runtimePath:runtime,vaultPath:runtime,courses:[{id:'calc',name:'Cálculo I',path:calc},{id:'fis',name:'Física',path:fis}]});
 writeDeskJson(runtime,{courseId:'calc',courseStates:{calc:{pdfs:[{path:pdf,page:1}],study:{title:'',xopp:''}}}});
 ctx.app=await launchDesk({runtime,env:{FAKE_PI_QUEUE_LOG:path.join(runtime,'queue.log'),FAKE_PI_QUEUE_HOLD_MS:'60000'}});
 const page=await ctx.app.firstWindow();
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await resize(ctx,page,1440,900);
 await statusOnline(page);
 await freezeMotion(page);
 const state=()=>page.evaluate(()=>({review:document.querySelector('#references').classList.contains('review'),active:document.querySelector('#course-tabs button.active')?.dataset.id||''}));
 const openTab=()=>page.locator('#review-tab').click().then(()=>page.waitForSelector('#references.review'));
 const clickCourse=async id=>{
  if(await page.evaluate(()=>document.querySelector('header').classList.contains('tabs-compact'))){
   await page.locator('#course-menu').click();
   await page.locator(`#course-pop button[data-id="${id}"]`).click();
  }else await page.locator(`#course-tabs button[data-id="${id}"]`).click();
 };
 /* livre: outra matéria fecha o Caderno e vai para ela; a mesma também */
 await openTab();
 await clickCourse('fis');
 await page.waitForFunction(()=>!document.querySelector('#references').classList.contains('review'));
 await page.waitForFunction(()=>document.querySelector('#course-tabs button.active')?.dataset.id==='fis',undefined,{timeout:20000});
 await statusOnline(page);
 await clickCourse('calc');
 await page.waitForFunction(()=>document.querySelector('#course-tabs button.active')?.dataset.id==='calc',undefined,{timeout:20000});
 await statusOnline(page);
 /* respondendo: a matéria atual volta do Caderno; as outras travam com a dica */
 await page.locator('#prompt').fill('uma resposta longa');
 await page.locator('#send').click();
 await page.waitForFunction(()=>!document.querySelector('#stop').hidden,undefined,{timeout:15000});
 for(const [width,height] of [[1440,900],[900,650]]){
  await resize(ctx,page,width,height);
  for(const theme of ['light','dark']){
   await setTheme(page,theme);
   const tag=`respondendo ${theme} ${width}×${height}`;
   await openTab();
   const compact=await page.evaluate(()=>document.querySelector('header').classList.contains('tabs-compact'));
   const facts=await page.evaluate(c=>{
    const sel=c?'#course-pop button':'#course-tabs button[role="tab"]';
    const at=id=>document.querySelector(`${sel}[data-id="${id}"]`);
    return {current:at('calc')?.disabled,other:at('fis')?.disabled,tip:at('fis')?.getAttribute('title')||at('fis')?.dataset.tip||''};
   },compact);
   assert.equal(facts.current,false,`${tag}: a matéria atual fica clicável durante a resposta`);
   assert.equal(facts.other,true,`${tag}: a outra matéria trava`);
   assert.equal(facts.tip,'Espere a resposta terminar para trocar de matéria',`${tag}: e diz por quê`);
   await reviewShot(page,out,`caderno-respondendo-${theme}-${width}x${height}.png`);
   await clickCourse('calc');
   await page.waitForFunction(()=>!document.querySelector('#references').classList.contains('review'),undefined,{timeout:5000});
   assert.deepEqual(await state(),{review:false,active:'calc'},`${tag}: clicar na matéria fecha o Caderno e volta a ela`);
   assert.equal(await page.locator('#stop').isVisible(),true,`${tag}: a resposta segue (nada foi trocado)`);
   assert.equal(await page.locator('#toast .toast-item').count(),0,`${tag}: sem aviso de recusa`);
  }
 }
 /* o × continua fechando */
 await openTab();
 await page.locator('.review-close').click();
 await page.waitForFunction(()=>!document.querySelector('#references').classList.contains('review'));
 await page.locator('#stop').click();
 await page.waitForFunction(()=>document.querySelector('#stop').hidden,undefined,{timeout:20000});
 assert.deepEqual(errors,[],'nenhum erro de página');
});

console.log('review-notebook-ui: PASS — barra, vazio centrado, duas colunas, cartão, Como foi? e lista nos dois temas, 1440×900 e 900×650.');
