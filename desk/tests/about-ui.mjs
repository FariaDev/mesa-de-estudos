// node tests/about-ui.mjs — Sobre (ticket #34), medido na janela.
// Mede o casco (540px, raio 16px, marca de 44px, nome em serifa de 24px, × de 28px,
// faixa de atualização de 44px, bolinha de 7px, ações de 30px, rodapé de 52px encostado
// na base, sem vão vazio) nos dois temas, em 1440×900 e 900×650, com a faixa "Atualizada."
// e com a faixa "vX disponível"; a marca é a G1 do acento (#70); confere "Créditos e licenças" e "Abrir o log".
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
 withArtifacts,newRuntime,seedCourse,writeConfigJson,writeDeskJson,launchDesk,statusOnline,tinyPdf,
 reviewShot,screenshotDirectory,setTheme,freezeMotion,resizeWindow
} from './helpers.mjs';
import {layoutStable} from './waits.mjs';

const out=screenshotDirectory('about');
const near=(a,b,tol=1)=>Math.abs(a-b)<=tol;
const resize=async(ctx,page,width,height)=>{
 await resizeWindow(ctx.app,page,width,height,{content:true});
 await layoutStable(page,'main');
};
const measure=page=>page.evaluate(()=>{
 const box=sel=>{const el=document.querySelector(sel);if(!el)return null;const b=el.getBoundingClientRect(),s=getComputedStyle(el);return {top:b.top,bottom:b.bottom,left:b.left,right:b.right,width:b.width,height:b.height,font:s.fontSize,family:s.fontFamily,weight:s.fontWeight,radius:s.borderTopLeftRadius,border:parseFloat(s.borderTopWidth)>0&&s.borderTopStyle!=='none'&&!/rgba\(0, 0, 0, 0\)|transparent/.test(s.borderTopColor)};};
 const all=sel=>[...document.querySelectorAll(sel)].map(el=>{const b=el.getBoundingClientRect();return {w:b.width,h:b.height,text:el.textContent.trim()};});
 const rows=[...document.querySelectorAll('#component-rows .component-row')].map(r=>{const b=r.getBoundingClientRect();return {id:r.dataset.id,top:b.top,bottom:b.bottom,height:b.height,overflow:r.scrollWidth-r.clientWidth};});
 const dialog=document.querySelector('#about-dialog');
 return {
  dialog:box('#about-dialog'),mark:box('.about-mark'),markSrc:document.querySelector('.about-mark')?.getAttribute('src')||'',name:box('#about-name,.about-name'),lead:box('#about-lead'),
  close:box('.about-head .dialog-close'),strip:box('#about-update'),icon:box('.update-icon'),check:box('#update-check'),
  refresh:box('#components-refresh'),foot:box('.about-foot'),body:box('.about-body'),
  dots:all('.component-dot'),rows,actions:[...document.querySelectorAll('.component-actions button,.about-update button:not(.icon-btn),.about-links button')].map(b=>Math.round(b.getBoundingClientRect().height)),
  heading:document.querySelector('#about-uses').textContent.trim(),vh:innerHeight,vw:innerWidth,
  overflow:dialog.scrollWidth-dialog.clientWidth,bodyScroll:document.querySelector('.about-body').scrollHeight-document.querySelector('.about-body').clientHeight
 };
});

await withArtifacts('about',async ctx=>{
 const runtime=ctx.runtime=newRuntime('about-ui');
 const course=seedCourse(runtime,'calc');
 const pdf=path.join(course,'Limites.pdf');fs.writeFileSync(pdf,tinyPdf('Limites'));
 writeConfigJson(runtime,{runtimePath:runtime,vaultPath:runtime,courses:[{id:'calc',name:'Cálculo I',path:course}]});
 writeDeskJson(runtime,{accent:'violet',courseId:'calc',courseStates:{calc:{pdfs:[{path:pdf,page:1}],study:{title:'',xopp:''}}}});
 ctx.app=await launchDesk({runtime});
 const page=await ctx.app.firstWindow();
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await resize(ctx,page,1440,900);
 await statusOnline(page);
 await freezeMotion(page);
 await page.waitForSelector('.pdf-panel canvas',{timeout:30000});
 await ctx.app.evaluate(({ipcMain})=>{
  ipcMain.removeHandler('update-check');
  ipcMain.handle('update-check',async()=>({status:'current',version:'0.5.0',notes:'',url:'',current:'0.5.0',checkedAt:Date.now()}));
  ipcMain.removeHandler('components');
  ipcMain.handle('components',async()=>({rows:[
   {id:'pi',label:'Pi',version:'0.90.0',state:'outdated',latest:'0.91.0',hint:'Em desk/.pi-local.',canUpdate:true},
   {id:'node',label:'Node (sistema)',version:'24.5.0',state:'ok'},
   {id:'xournal',label:'Xournal++',version:'',state:'unknown',link:'https://github.com/xournalpp/xournalpp/releases/latest',linkLabel:'Abrir o site'}
  ]}));
 });
 await page.locator('#settings-menu .nav-trigger').click();
 await page.locator('#about').click();
 await page.waitForSelector('#about-dialog[open]');
 await page.waitForFunction(()=>/^Atualizada\. Conferido hoje às \d{1,2}:\d{2}\.$/.test(document.querySelector('#about-update .update-text')?.textContent||''),undefined,{timeout:10000});
 await page.waitForFunction(()=>![...document.querySelectorAll('#component-rows .component-state')].some(e=>e.textContent==='Verificando…'),undefined,{timeout:10000});

 const check=(m,tag)=>{
  assert.equal(m.dialog.radius,'16px',`${tag}: raio 16px`);
  assert.ok(m.dialog.bottom<=m.vh&&m.dialog.right<=m.vw&&m.dialog.left>=0&&m.dialog.top>=0,`${tag}: cabe na janela`);
  assert.ok(near(m.dialog.width,540,1),`${tag}: diálogo de 540px (${m.dialog.width})`);
  assert.ok(near(m.mark.width,44,0.6)&&near(m.mark.height,44,0.6),`${tag}: marca de 44px`);
  /* #70: a marca é a G1 do acento escolhido, não o quadrado com "M" de antes da #61. */
  assert.match(m.markSrc,/assets\/app-icon\/mesa-violet\.svg$/,`${tag}: marca G1 no acento violeta (${m.markSrc})`);
  assert.equal(m.name.font,'24px',`${tag}: nome de 24px`);
  assert.match(m.name.family,/Newsreader|Iowan|Charter|Georgia|serif/i,`${tag}: nome serifado`);
  assert.ok(near(m.close.width,28,0.6)&&near(m.close.height,28,0.6)&&!m.close.border,`${tag}: × de 28px sem borda`);
  assert.ok(near(m.strip.height,44,1),`${tag}: faixa de atualização de 44px (${m.strip.height})`);
  assert.ok(near(m.icon.width,20,0.6),`${tag}: ícone de estado`);
  assert.ok(near(m.check.width,30,0.6)&&near(m.check.height,30,0.6),`${tag}: verificar é ícone de 30px`);
  assert.ok(near(m.refresh.width,30,0.6)&&near(m.refresh.height,30,0.6),`${tag}: conferir de novo é ícone de 30px`);
  assert.equal(m.heading,'O que a Mesa usa');
  assert.deepEqual(m.rows.map(r=>r.id),['pi','node','xournal'],`${tag}: Pi, Node, Xournal++`);
  assert.ok(m.dots.length===3&&m.dots.every(d=>near(d.w,7,0.6)&&near(d.h,7,0.6)),`${tag}: bolinha de 7px`);
  assert.ok(m.rows.every(r=>r.overflow<=0),`${tag}: linhas sem rolagem lateral`);
  assert.ok(m.actions.every(h=>near(h,30,0.6)),`${tag}: ações de 30px (${m.actions})`);
  assert.ok(near(m.foot.height,52,1)&&m.foot.border,`${tag}: rodapé de 52px com filete (${m.foot.height})`);
  assert.ok(m.dialog.bottom-m.foot.bottom<=1,`${tag}: rodapé encosta na base`);
  assert.ok(m.overflow<=0,`${tag}: sem rolagem lateral`);
  const last=m.rows[m.rows.length-1];
  assert.ok(m.foot.top-last.bottom<=30,`${tag}: sem vão vazio entre a última linha e o rodapé (${m.foot.top-last.bottom})`);
 };

 for(const [width,height] of [[1440,900],[900,650]]){
  await resize(ctx,page,width,height);
  for(const theme of ['light','dark']){
   await setTheme(page,theme);
   const tag=`${theme} ${width}×${height}`;
   check(await measure(page),tag);
   assert.match((await page.locator('#about-lead').textContent()).trim(),/^Versão \d.*licença MIT$/,`${tag}: linha de versão`);
   assert.equal(await page.locator('#component-rows [data-id="xournal"] .component-state').textContent(),'não dá para conferir daqui');
   assert.equal((await page.locator('#component-rows [data-id="xournal"] .component-hint').textContent()).trim(),'Atualiza pelo site oficial.');
   assert.equal(await page.locator('#update-pi').textContent(),'Atualizar o Pi');
   await reviewShot(page,out,`sobre-atualizada-${theme}-${width}.png`);
  }
 }

 /* Créditos e licenças abre a lista sem estourar a janela; Abrir o log fica à mão. */
 await resize(ctx,page,900,650);
 await page.locator('#about-credits-toggle').click();
 assert.equal(await page.locator('#about-credits-toggle').getAttribute('aria-expanded'),'true');
 assert.equal(await page.locator('#about-credits').isVisible(),true,'a lista de créditos aparece');
 /* #42: o que foi adaptado de perto do T3 Code leva o aviso MIT; o Chart.js embutido também está creditado. */
 const credits=await page.locator('#about-credits').innerText();
 assert.match(credits,/T3 Code/);
 assert.match(credits,/Chart\.js/);
 assert.match(credits,/Lobe Icons 1\.95\.1 — logos dos provedores e dos fabricantes.*MIT, © 2023 LobeHub/,'os logos do seletor de modelo creditados, com a licença');
 /* #61: os ícones do Lucide (ISC) e a STIX embutida (OFL) levam o aviso. */
 assert.match(credits,/Lucide — .*ISC, © Lucide Contributors/,'o Lucide creditado, com a licença');
 assert.match(credits,/STIX Two Text 2\.13 — .*SIL OFL 1\.1/,'a STIX creditada, com a licença');
 assert.match(await page.locator('#about-license-t3').textContent(),/Copyright \(c\) 2026 T3 Tools Inc\. Permission is hereby granted/);
 const withCredits=await measure(page);
 assert.ok(withCredits.dialog.bottom<=withCredits.vh,'com créditos o diálogo continua cabendo em 900×650');
 assert.ok(near(withCredits.foot.height,52,1)&&withCredits.dialog.bottom-withCredits.foot.bottom<=1,'o rodapé continua inteiro com os créditos');
 await reviewShot(page,out,'sobre-creditos-dark-900.png');
 await page.locator('#about-credits-toggle').click();
 assert.equal(await page.locator('#about-credits').isHidden(),true,'o segundo clique recolhe');
 assert.equal(await page.locator('#about-log').textContent(),'Abrir o log');
 assert.equal((await page.locator('.about-by').textContent()).trim(),'Feita por Lucas Faria');

 /* Versão nova: a faixa vira "vX disponível · O que mudou · Atualizar e reiniciar". */
 await resize(ctx,page,1440,900);
 await ctx.app.evaluate(({ipcMain})=>{
  ipcMain.removeHandler('update-check');
  ipcMain.handle('update-check',async()=>({status:'update',version:'0.6.0',notes:'Corpo curto da Release.',url:'https://example.com/notas',current:'0.5.0',checkedAt:Date.now()}));
 });
 await page.locator('#components-refresh').click();
 await page.waitForSelector('#update-apply',{timeout:10000});
 for(const theme of ['light','dark']){
  await setTheme(page,theme);
  const m=await measure(page);
  assert.equal((await page.locator('#about-update .update-text').textContent()).trim(),'v0.6.0 disponível');
  assert.equal((await page.locator('#update-notes').textContent()).trim(),'O que mudou');
  assert.equal((await page.locator('#update-apply').textContent()).trim(),'Atualizar e reiniciar');
  assert.ok(m.strip.height>=44&&m.strip.height<=90,`${theme}: faixa com versão nova (${m.strip.height})`);
  assert.ok(near(m.foot.height,52,1)&&m.dialog.bottom-m.foot.bottom<=1,`${theme}: rodapé intacto`);
  await reviewShot(page,out,`sobre-disponivel-${theme}-1440.png`);
 }
 await page.locator('#about-dialog .dialog-close').click();
 await page.waitForFunction(()=>!document.querySelector('#about-dialog').open);
 assert.deepEqual(errors,[]);
});
console.log('about-ui: PASS — casco, faixa de atualização, linhas de componentes, créditos e rodapé medidos nos dois temas e tamanhos.');
