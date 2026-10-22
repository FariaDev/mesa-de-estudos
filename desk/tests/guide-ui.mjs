// node tests/guide-ui.mjs — Guia da Mesa (tickets #34 e #64), medido e percorrido na janela.
// Mede o casco (raio 16px, lateral de 252px com a mascote e ícones, título de 22px em
// serifa, barra de 44px, × de 28px, busca de 30px, miolo de até 760px, sem rolagem
// lateral) nos dois temas, em 1440×900 e 900×650; percorre as sete seções só por
// "Próximo: … →" até a última e volta só por "← Anterior"; confere o foco no título, a
// lateral que acompanha e a busca em lista de leitura (#64: cada achado diz a seção).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
 withArtifacts,newRuntime,seedCourse,writeConfigJson,writeDeskJson,launchDesk,statusOnline,tinyPdf,
 reviewShot,screenshotDirectory,setTheme,freezeMotion,resizeWindow
} from './helpers.mjs';
import {layoutStable} from './waits.mjs';

const out=screenshotDirectory('guide');
const near=(a,b,tol=1)=>Math.abs(a-b)<=tol;
const resize=async(ctx,page,width,height)=>{
 await resizeWindow(ctx.app,page,width,height,{content:true});
 await layoutStable(page,'main');
};
const ORDER=['Começar','O tutor','Leitores de PDF','Chat lateral','Revisão','Calculadora','Atalhos'];
const TITLES=['Mesa ao lado, caderno do outro','Conversar com o tutor','Ler e citar o material','Uma pergunta à parte','Voltar no que errou','Conta rápida, sem gastar tokens','Atalhos'];
const current=page=>page.locator('.guide-nav-item[aria-current="page"]').textContent().then(t=>t.trim());
const nav=page=>page.locator('.guide-nav-item').allTextContents().then(xs=>xs.map(x=>x.trim()));
const measure=page=>page.evaluate(()=>{
 const box=sel=>{const el=document.querySelector(sel);if(!el)return null;const b=el.getBoundingClientRect(),s=getComputedStyle(el);return {top:b.top,bottom:b.bottom,left:b.left,right:b.right,width:b.width,height:b.height,font:s.fontSize,family:s.fontFamily,radius:s.borderTopLeftRadius,weight:s.fontWeight};};
 const dialog=document.querySelector('#help-dialog');
 return {
  dialog:box('#help-dialog'),side:box('.guide-side'),title:box('#help-title'),search:box('#guide-search'),bar:box('.guide-bar'),
  close:box('.guide-bar .dialog-close'),sectionTitle:box('#guide-section-title'),lead:box('#guide-lead'),page:box('.guide-page'),
  items:[...document.querySelectorAll('.guide-nav-item')].map(el=>el.getBoundingClientRect().height),
  scroll:{w:document.querySelector('#guide-scroll').scrollWidth,c:document.querySelector('#guide-scroll').clientWidth},
  vh:innerHeight,vw:innerWidth,sidebarOverflow:dialog.scrollWidth-dialog.clientWidth
 };
});

await withArtifacts('guide',async ctx=>{
 const runtime=ctx.runtime=newRuntime('guide-ui');
 const course=seedCourse(runtime,'calc');
 const pdf=path.join(course,'Limites.pdf');fs.writeFileSync(pdf,tinyPdf('Limites'));
 writeConfigJson(runtime,{runtimePath:runtime,vaultPath:runtime,courses:[{id:'calc',name:'Cálculo I',path:course}]});
 writeDeskJson(runtime,{courseId:'calc',courseStates:{calc:{pdfs:[{path:pdf,page:1}],study:{title:'',xopp:''}}}});
 ctx.app=await launchDesk({runtime});
 const page=await ctx.app.firstWindow();
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await resize(ctx,page,1440,900);
 await statusOnline(page);
 await freezeMotion(page);
 await page.waitForSelector('.pdf-panel canvas',{timeout:30000});
 await page.keyboard.press('ControlOrMeta+/');
 await page.waitForSelector('#help-dialog[open]');

 /* ---------- casco e medidas ---------- */
 for(const [width,height] of [[1440,900],[900,650]]){
  await resize(ctx,page,width,height);
  for(const theme of ['light','dark']){
   await setTheme(page,theme);
   const tag=`${theme} ${width}×${height}`;
   const m=await measure(page);
   assert.equal(m.dialog.radius,'16px',`${tag}: raio 16px`);
   assert.ok(m.dialog.bottom<=m.vh&&m.dialog.right<=m.vw,`${tag}: cabe na janela`);
   assert.ok(near(m.side.width,252,1),`${tag}: lateral de 252px (${m.side.width})`);
   assert.equal((await page.locator('#help-title').textContent()).trim(),'Guia da Mesa');
   /* #64: o título do guia é o único de diálogo em serifa de 22px (exceção do padrão de 15px). */
   assert.equal(m.title.font,'22px',`${tag}: título de 22px`);
   assert.match(m.title.family,/STIX|serif/i,`${tag}: título em serifa`);
   assert.equal(await page.locator('.guide-side .guide-mascote svg').count(),3,`${tag}: o trio ∫ Σ ∇ na lateral`);
   assert.equal(await page.locator('.guide-nav-item .guide-nav-icon').count(),ORDER.length,`${tag}: um ícone por seção`);
   assert.ok(near(m.search.height,30,0.6),`${tag}: busca de 30px (${m.search.height})`);
   assert.equal(await page.locator('#guide-search').getAttribute('placeholder'),'Buscar no guia');
   assert.deepEqual(await nav(page),ORDER,`${tag}: seções na ordem da lateral`);
   assert.ok(m.items.every(h=>near(h,34,0.6)),`${tag}: itens da lateral de 34px`);
   assert.ok(near(m.bar.height,44,1),`${tag}: barra de 44px (${m.bar.height})`);
   assert.ok(near(m.close.width,28,0.6)&&near(m.close.height,28,0.6),`${tag}: × de 28px`);
   assert.equal(await page.locator('.guide-bar .dialog-close').getAttribute('aria-label'),'Fechar o guia');
   assert.match(m.sectionTitle.family,/Newsreader|Iowan|Charter|Georgia|serif/i,`${tag}: título da seção serifado`);
   assert.equal(m.sectionTitle.font,'30px',`${tag}: título de 30px`);
   assert.equal(m.lead.font,'15px',`${tag}: abertura de 15px (protótipo da #64)`);
   assert.ok(m.page.width<=760.5,`${tag}: miolo de até 760px (${m.page.width})`);
   assert.ok(m.scroll.w<=m.scroll.c+1,`${tag}: sem rolagem lateral`);
   await reviewShot(page,out,`guia-comecar-${theme}-${width}.png`);
  }
 }

 /* ---------- percorrer por Próximo e voltar por Anterior ---------- */
 await resize(ctx,page,1440,900);
 await page.locator('#guide-search').fill('');
 await page.locator('.guide-nav-item',{hasText:'Começar'}).click();
 assert.equal(await page.locator('.guide-prev').count(),0,'a primeira seção não tem Anterior');
 for(let i=0;i<ORDER.length;i++){
  assert.equal(await current(page),ORDER[i],`lateral acompanha: ${ORDER[i]}`);
  assert.equal((await page.locator('#guide-section-title').textContent()).trim(),TITLES[i]);
  assert.equal((await page.locator('#guide-crumb').textContent()).trim(),`Guia · ${ORDER[i]}`);
  assert.equal(await page.locator('section[data-section]:not([hidden])').count(),1,'uma seção por vez');
  if(i<ORDER.length-1){
   const next=page.locator('.guide-next');
   assert.equal((await next.textContent()).trim(),`Próximo: ${ORDER[i+1]} →`);
   await next.click();
   assert.equal(await page.evaluate(()=>document.activeElement?.id),'guide-section-title',`foco no título de ${ORDER[i+1]}`);
  }
 }
 assert.equal(await page.locator('.guide-next').count(),0,'a última seção não tem Próximo');
 for(let i=ORDER.length-1;i>0;i--){
  assert.equal(await current(page),ORDER[i]);
  assert.equal((await page.locator('.guide-prev').textContent()).trim(),'← Anterior');
  await page.locator('.guide-prev').click();
  assert.equal(await page.evaluate(()=>document.activeElement?.id),'guide-section-title');
 }
 assert.equal(await current(page),'Começar');
 assert.equal(await page.locator('.guide-prev').count(),0);
 assert.equal(await page.locator('.guide-next').count(),1);

 /* ---------- a lateral escolhe a seção ---------- */
 await page.locator('.guide-nav-item',{hasText:'Revisão'}).click();
 assert.equal((await page.locator('.guide-next').textContent()).trim(),'Próximo: Calculadora →');
 assert.equal(await page.locator('.guide-prev').count(),1);
 assert.equal(await page.locator('#guide-section-title').textContent(),'Voltar no que errou');
 assert.match(await page.locator('.guide-topic h4').allTextContents().then(x=>x.join('|')),/Guardar para revisar\|Como foi\?\|Tentar de novo/);

 /* ---------- busca (#64): lista de leitura, a lateral não filtra ---------- */
 await page.locator('#guide-search').fill('xournal');
 assert.deepEqual(await nav(page),ORDER,'a busca não esconde seções da lateral');
 assert.equal(await page.locator('.guide-nav-item[aria-current="page"]').count(),0,'na busca nenhuma seção fica marcada');
 assert.equal((await page.locator('#guide-crumb').textContent()).trim(),'Guia · Busca');
 assert.equal((await page.locator('#guide-section-title').textContent()).trim(),'Busca: “xournal”');
 const rows=page.locator('#guide-results .guide-hit');
 const found=await rows.count();
 assert.ok(found>0,'a busca acha tópicos');
 assert.match((await page.locator('#guide-lead').textContent()).trim(),new RegExp(`^${found} tópicos? no guia\\.$`));
 const from=await page.locator('#guide-results .guide-hit-section').allTextContents();
 assert.equal(from.length,found,'cada achado diz a seção de onde veio');
 assert.ok(from.every(x=>ORDER.includes(x.trim())),`seções conhecidas: ${from.join(',')}`);
 assert.deepEqual([...new Set(from.map(x=>x.trim()))],ORDER.filter(x=>from.map(y=>y.trim()).includes(x)),'os achados seguem a ordem do guia');
 assert.equal(await page.locator('#guide-results [id]').count(),0,'a cópia não duplica ids');
 assert.equal(await page.locator('section[data-section]:not([hidden])').count(),0,'na busca nenhuma seção inteira aparece');
 assert.equal(await page.locator('.guide-next,.guide-prev').count(),0,'sem Próximo/Anterior na busca');
 /* O botão da seção leva até ela e limpa a busca. */
 const target=from[0].trim();
 await page.locator('#guide-results .guide-hit-section').first().click();
 assert.equal(await page.locator('#guide-search').inputValue(),'');
 assert.equal(await current(page),target);
 assert.equal(await page.evaluate(()=>document.activeElement?.id),'guide-section-title');
 await page.locator('#guide-search').fill('acentuacao');
 assert.equal(await page.locator('#guide-empty').isVisible(),true,'sem resultado, o guia diz');
 assert.equal(await page.locator('#guide-empty .guide-empty-mascote .mascote-nabla[data-humor="pensando"]').count(),1,'a mascote pensando no vazio');
 assert.equal(await page.locator('#guide-results').isVisible(),false);
 await page.locator('#guide-search').fill('CALCULADORA');
 assert.ok((await page.locator('#guide-results .guide-hit-section').allTextContents()).map(x=>x.trim()).includes('Calculadora'),'busca sem caixa nem acento acha "Calculadora"');
 await reviewShot(page,out,'guia-busca-light-1440.png');
 await page.locator('#guide-search').fill('');
 assert.deepEqual(await nav(page),ORDER);
 assert.equal(await page.locator('section[data-section]:not([hidden])').count(),1);

 /* #64: o Começar não diz que a Mesa exige Xournal++ nem mesa digitalizadora. */
 await page.locator('.guide-nav-item',{hasText:'Começar'}).click();
 const start=await page.locator('section[data-section="comecar"]').innerText();
 assert.doesNotMatch(start,/precisa(?:r)? (?:do|de) Xournal|exige/i);

 /* ---------- atalhos ---------- */
 await page.locator('.guide-nav-item',{hasText:'Atalhos'}).click();
 assert.deepEqual(await page.locator('.guide-keygroup h4').allTextContents(),['Mensagem','Material','Mesa']);
 assert.ok(await page.locator('#keys-customize').isVisible(),'Personalizar atalhos… visível');
 assert.equal(await page.locator('.guide-key[data-key="help"] .guide-combo').innerText().then(t=>t.replace(/\s+/g,'')),'⌘/');
 await page.locator('#keys-customize').click();
 await page.waitForSelector('#keys-dialog[open]');
 await page.keyboard.press('Escape');
 await page.waitForFunction(()=>!document.querySelector('#keys-dialog').open);

 /* ---------- fechar e reabrir mantém a seção, limpa a busca ---------- */
 await page.locator('#guide-search').fill('tutor');
 await page.locator('.guide-bar .dialog-close').click();
 assert.equal(await page.locator('#help-dialog').evaluate(el=>el.open),false,'o × fecha');
 await page.keyboard.press('ControlOrMeta+/');
 await page.waitForSelector('#help-dialog[open]');
 assert.equal(await page.locator('#guide-search').inputValue(),'');
 assert.deepEqual(await nav(page),ORDER);
 await page.keyboard.press('Escape');
 assert.deepEqual(errors,[]);
});
console.log('guide-ui: PASS — casco medido nos dois temas e tamanhos, Próximo/Anterior pelas sete seções, busca em lista e atalhos.');
