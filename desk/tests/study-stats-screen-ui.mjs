// node tests/study-stats-screen-ui.mjs — Estatísticas (ticket #34), medidas na janela.
// Cobre os critérios da tela: casco do diálogo (raio 16px, título de 15px, × de
// 28px, rodapé de 52px rente ao fundo), manchete em serifa, UMA ação no
// cronômetro, barras de 150px com dia vazio em fio de 2px, tabela por matéria,
// uso do tutor em texto corrido dentro de uma seção recolhida e nada que estoure.
// Nos dois temas, em 1440×900 e 900×650. Capturas só com MESA_REVIEW_SHOTS.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {
 withArtifacts,newRuntime,seedCourse,writeConfigJson,writeDeskJson,launchDesk,statusOnline,tinyPdf,
 reviewShot,screenshotDirectory,setTheme,freezeMotion,resizeWindow
} from './helpers.mjs';
import {layoutStable} from './waits.mjs';

const require=createRequire(import.meta.url);
const statistics=require('../src/study-data/statistics.cjs');
const out=screenshotDirectory('study-stats-screen');
const near=(a,b,tol=1)=>Math.abs(a-b)<=tol;
const resize=async(ctx,page,width,height)=>{
 await resizeWindow(ctx.app,page,width,height,{content:true});
 await layoutStable(page,'main');
};
const measure=page=>page.evaluate(()=>{
 const box=sel=>{const el=document.querySelector(sel);if(!el)return null;const b=el.getBoundingClientRect(),s=getComputedStyle(el);return {top:b.top,bottom:b.bottom,left:b.left,right:b.right,width:b.width,height:b.height,font:s.fontSize,family:s.fontFamily,radius:s.borderTopLeftRadius,weight:s.fontWeight,borderTop:parseFloat(s.borderTopWidth),scrollW:el.scrollWidth,clientW:el.clientWidth};};
 const all=sel=>[...document.querySelectorAll(sel)].map(el=>{const b=el.getBoundingClientRect();return {top:b.top,bottom:b.bottom,width:b.width,height:b.height};});
 return {
  dialog:box('#study-stats-dialog'),title:box('#study-stats-title'),close:box('.study-stats-close'),
  segment:box('#study-stats-period'),segmentButtons:all('#study-stats-period button'),course:box('#study-stats-course'),
  headline:box('#study-stats-headline'),support:box('#study-stats-support'),timer:box('.study-stats-timer'),
  action:box('#study-stats-timer-action'),chart:box('#study-stats-chart'),bars:all('.study-stats-chart .study-stats-bar'),
  table:box('#study-stats-courses'),foot:box('.study-stats-foot'),reset:box('.study-stats-reset'),
  scroll:box('.study-stats-scroll'),
  overflowX:document.documentElement.scrollWidth-document.documentElement.clientWidth,
  vh:innerHeight
 };
});

await withArtifacts('study-stats-screen',async ctx=>{
 const runtime=ctx.runtime=newRuntime('study-stats-screen');
 const course=seedCourse(runtime,'calc');
 const pdf=path.join(course,'Limites.pdf');fs.writeFileSync(pdf,tinyPdf('Limites'));
 writeConfigJson(runtime,{runtimePath:runtime,vaultPath:runtime,courses:[{id:'calc',name:'Cálculo I',path:course}]});
 writeDeskJson(runtime,{courseId:'calc',courseStates:{calc:{pdfs:[{path:pdf,page:1}],study:{title:'',xopp:''}}}});
 /* Quatro dias com tempo, três sem; uma pergunta e tokens sem cache. */
 const now=Date.now();
 for(const back of [0,1,2,4]){
  const at=now-back*86400000;
  statistics.control(runtime,{action:'start',at:at-90000,courseId:'calc'});
  for(const beat of [at-60000,at-30000,at])statistics.recordActivity(runtime,{id:`seed-${back}-${beat}`,at:beat,now:beat,running:true,visible:true,courseId:'calc'});
  statistics.control(runtime,{action:'stop',at,courseId:'calc'});
 }
 statistics.recordPrompt(runtime,{id:'p1',at:now,accepted:true,courseId:'calc'});
 statistics.recordUsage(runtime,{id:'u1',at:now,courseId:'calc',engine:'pi',input:{available:true,count:139400},output:{available:true,count:17000}});

 ctx.app=await launchDesk({runtime});
 const page=await ctx.app.firstWindow();
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await resize(ctx,page,1440,900);
 await statusOnline(page);
 await freezeMotion(page);
 await page.waitForSelector('.pdf-panel canvas',{timeout:30000});
 await page.locator('#study-menu .nav-trigger').click();
 await page.locator('#study-menu #study-stats-open').click();
 await page.waitForSelector('#study-stats-dialog[open]');
 await page.waitForFunction(()=>document.querySelectorAll('.study-stats-chart .study-stats-bar').length===7);

 for(const [width,height] of [[1440,900],[900,650]]){
  await resize(ctx,page,width,height);
  for(const theme of ['light','dark']){
   await setTheme(page,theme);
   const tag=`${theme} ${width}×${height}`;
   const m=await measure(page);
   /* Casco do diálogo padrão. */
   assert.equal(m.dialog.radius,'16px',`${tag}: raio 16px`);
   assert.ok(near(m.dialog.width,680,1)||m.dialog.width<=width*0.92+1,`${tag}: largura de ~680px (${m.dialog.width})`);
   assert.equal(m.title.font,'15px',`${tag}: título de 15px`);
   assert.equal((await page.locator('#study-stats-title').textContent()).trim(),'Estatísticas de estudo');
   assert.ok(near(m.close.width,28,0.6)&&near(m.close.height,28,0.6),`${tag}: × de 28px`);
   assert.match(await page.locator('.study-stats-close').getAttribute('aria-label'),/^Fechar/);
   assert.ok(near(m.foot.height,52,1.2),`${tag}: rodapé de 52px (${m.foot.height})`);
   assert.ok(m.foot.borderTop>0,`${tag}: filete no rodapé`);
   assert.ok(near(m.foot.bottom,m.dialog.bottom,1.5),`${tag}: rodapé rente ao fundo`);
   assert.ok(m.dialog.bottom<=m.vh,`${tag}: cabe na janela`);
   /* Controles. */
   assert.deepEqual(await page.locator('#study-stats-period button').allTextContents(),['7 dias','30 dias','Tudo']);
   assert.ok(near(m.course.height,30,0.6),`${tag}: seletor de matéria de 30px (${m.course.height})`);
   assert.ok(m.segmentButtons.every(b=>near(b.height,26,0.6)),`${tag}: segmentos de 26px dentro do contêiner`);
   assert.ok(near(m.action.height,30,0.6),`${tag}: ação do cronômetro de 30px`);
   assert.ok(near(m.reset.height,30,0.6),`${tag}: Apagar… de 30px`);
   assert.equal((await page.locator('.study-stats-reset').textContent()).trim(),'Apagar…');
   /* Manchete e linha de apoio. */
   assert.match(m.headline.family,/Newsreader|Iowan|Charter|Georgia|serif/i,`${tag}: manchete serifada`);
   assert.equal(m.headline.font,'26px');
   assert.match((await page.locator('#study-stats-headline').textContent()).trim(),/ de estudo em 4 sessões$/);
   assert.match((await page.locator('#study-stats-support').textContent()).trim(),/^1 pergunta ao tutor · melhor dia: /);
   /* Cronômetro: faixa de 44px, uma ação, sem sessão = Retomar e nada para encerrar. */
   assert.ok(near(m.timer.height,44,1),`${tag}: faixa do cronômetro de 44px (${m.timer.height})`);
   assert.equal((await page.locator('#study-stats-session-text').textContent()).trim(),'Pausado · nada está sendo contado');
   assert.equal((await page.locator('#study-stats-timer-action').textContent()).trim(),'Retomar');
   assert.equal(await page.locator('.study-stats-end').isHidden(),true);
   /* Barras: gráfico de 150px, dia vazio em fio de 2px, nenhuma passa de 44px de largura. */
   assert.ok(near(m.chart.height,150,1),`${tag}: gráfico de 150px (${m.chart.height})`);
   assert.equal(m.bars.length,7);
   const empties=m.bars.filter(b=>near(b.height,2,0.6));
   assert.equal(empties.length,3,`${tag}: três dias vazios viram fio de 2px`);
   assert.ok(m.bars.every(b=>b.width<=44.6),`${tag}: barras de até 44px`);
   assert.equal((await page.locator('.study-stats-day').count()),7,`${tag}: dia da semana embaixo de cada barra`);
   /* Tabela por matéria. */
   assert.deepEqual(await page.locator('#study-stats-courses th').allTextContents(),['Matéria','Tempo','Sessões','Perguntas']);
   assert.equal((await page.locator('#study-stats-courses tbody td').first().textContent()).trim(),'Cálculo I');
   /* Uso do tutor: recolhido, em palavras. */
   assert.equal(await page.locator('#study-stats-usage').evaluate(el=>el.open),false,`${tag}: uso do tutor recolhido`);
   assert.equal((await page.locator('#study-stats-usage summary').textContent()).trim(),'Uso do tutor no período');
   assert.match(await page.locator('#study-stats-usage-text').textContent(),/^139 mil tokens lidos · 17 mil escritos$/);
   assert.match(await page.locator('.study-stats-foot p').textContent(),/Só neste computador/);
   /* Nada estoura. */
   assert.equal(m.overflowX,0,`${tag}: sem rolagem horizontal`);
   assert.ok(m.scroll.scrollW<=m.scroll.clientW+1,`${tag}: miolo sem rolagem lateral`);
   await reviewShot(page,out,`estatisticas-${theme}-${width}.png`);
  }
 }

 /* Interação: iniciar mostra "Contando agora" com Pausar e a ação discreta de encerrar. */
 await resize(ctx,page,1440,900);
 await page.locator('#study-stats-timer-action').click();
 await page.waitForFunction(()=>document.querySelector('#study-stats-session-text')?.textContent.includes('Contando agora'));
 assert.equal((await page.locator('#study-stats-timer-action').textContent()).trim(),'Pausar');
 assert.equal(await page.locator('.study-stats-end').isVisible(),true);
 await page.locator('#study-stats-period [data-period="30"]').click();
 await page.waitForFunction(()=>document.querySelectorAll('.study-stats-chart .study-stats-bar').length===30);
 assert.equal(await page.locator('#study-stats-period [aria-checked="true"]').textContent(),'30 dias');
 await page.locator('.study-stats-close').click();
 assert.equal(await page.locator('#study-stats-dialog').evaluate(el=>el.open),false,'o × fecha');
 assert.deepEqual(errors,[]);
});
console.log('study-stats-screen-ui: PASS — casco, manchete, cronômetro de uma ação, barras, tabela e uso do tutor nos dois temas, 1440×900 e 900×650.');
