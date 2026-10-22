/* Padrão dos diálogos, medido na janela (teste à mão de 2026-10-13).
   Todo <dialog> da Mesa segue as mesmas medidas: raio 16px; título de 15px
   (menos o do Guia, 22px em serifa desde a #64);
   fechar no cabeçalho é um × de 28px sem borda; botões de rodapé, campos e
   seletores com 30px; rodapé com filete tem 52px e encosta na base. Ninguém
   escreve "Atualizar" num botão: é ícone ao lado do que atualiza. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {launchDesk,withArtifacts,seedCourse,tinyPdf,writeConfigJson,writeDeskJson,freezeMotion,setTheme,resizeWindow} from './helpers.mjs';
import {nextFrames} from './waits.mjs';

const measure=()=>{
 const vis=el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none';};
 const bordered=el=>{const s=getComputedStyle(el);return parseFloat(s.borderTopWidth)>0&&s.borderTopStyle!=='none'&&!/rgba\(0, 0, 0, 0\)|transparent/.test(s.borderTopColor);};
 const out=[];
 for(const dialog of document.querySelectorAll('dialog')){
  if(!dialog.id)continue;
  try{dialog.showModal();}catch{continue;}
  const box=dialog.getBoundingClientRect(),style=getComputedStyle(dialog);
  const buttons=[...dialog.querySelectorAll('button')].filter(vis);
  const head=buttons.filter(b=>/^Fechar/.test(b.getAttribute('aria-label')||'')&&b.getBoundingClientRect().top-box.top<70);
  const feet=[...dialog.querySelectorAll('.dialog-actions,menu,.study-footer,.study-stats-foot,.mesa-bkp-actions')].filter(vis).filter(f=>parseFloat(getComputedStyle(f).borderTopWidth)>0);
  out.push({
   id:dialog.id,
   radius:style.borderTopLeftRadius,
   /* #64: o título do Guia (`.guide-title`) é a exceção de 22px em serifa. */
   titles:[...dialog.querySelectorAll('h2:not(.guide-title)')].filter(vis).map(h=>getComputedStyle(h).fontSize),
   close:head.map(b=>({w:Math.round(b.getBoundingClientRect().width),h:Math.round(b.getBoundingClientRect().height),bordered:bordered(b),text:b.textContent.trim()})),
   dupClose:head.length?buttons.filter(b=>!head.includes(b)&&b.textContent.trim()==='Fechar').length:0,
   refreshText:buttons.filter(b=>b.textContent.trim()==='Atualizar').length,
   controls:[...dialog.querySelectorAll('select,input[type=text],input[type=search],input[type=number],input[type=url],input:not([type])')].filter(vis).map(c=>Math.round(c.getBoundingClientRect().height)),
   feet:feet.map(f=>({h:Math.round(f.getBoundingClientRect().height),gap:Math.round(box.bottom-f.getBoundingClientRect().bottom),lines:new Set([...f.querySelectorAll('button')].filter(vis).map(b=>Math.round(b.getBoundingClientRect().top))).size,buttons:[...f.querySelectorAll('button')].filter(vis).map(b=>Math.round(b.getBoundingClientRect().height))})),
  });
  dialog.close();
 }
 return out;
};

await withArtifacts('dialog-standard-ui',async ctx=>{
 const runtime=ctx.runtime=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'mesa-dialog-standard-')));
 const course=seedCourse(runtime,'calc'),pdf=path.join(course,'Limites.pdf');
 fs.writeFileSync(pdf,tinyPdf('Limites'));
 writeConfigJson(runtime,{runtimePath:runtime,vaultPath:runtime,courses:[{id:'calc',name:'Cálculo',path:course}]});
 writeDeskJson(runtime,{courseId:'calc',courseStates:{calc:{pdfs:[{path:pdf,page:1}]}}});
 ctx.app=await launchDesk({runtime});
 const page=await ctx.app.firstWindow(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.waitForSelector('.pdf-page[data-rendered] canvas');
 await freezeMotion(page);
 /* Os diálogos de estudo nascem na primeira abertura. */
 const dismiss=async()=>{for(let i=0;i<3;i++){await page.keyboard.press('Escape');await nextFrames(page,2);}};
 for(const id of ['study-stats-open','study-notes-open','study-search-open','study-backup-open']){
  await page.locator('#study-menu .nav-trigger').click();
  await page.locator(`#study-menu #${id}`).click();
  await page.waitForSelector('dialog[open]');
  await dismiss();
 }
 await page.locator('#session-title').click();
 await page.locator('#conversations-pop').getByText('Buscar e organizar',{exact:false}).click();
 await page.waitForSelector('#chat-library-dialog[open]');
 await dismiss();
 await page.keyboard.press('ControlOrMeta+/');
 await page.waitForSelector('#help-dialog[open]');
 await page.locator('#keys-customize').click();
 await page.waitForSelector('#keys-dialog[open]');
 await dismiss();
 const expected=['study-stats-dialog','study-notes-dialog','study-search-dialog','mesa-backup-panel','chat-library-dialog','keys-dialog','settings-dialog','help-dialog','about-dialog','image-dialog','free-add-dialog'];
 for(const theme of ['light','dark']){
  await setTheme(page,theme);
  const rows=await page.evaluate(measure);
  const ids=rows.map(row=>row.id);
  for(const id of expected)assert.ok(ids.includes(id),`${theme}: ${id} entrou na medição`);
  for(const row of rows){
   const tag=`${theme} ${row.id}`;
   assert.equal(row.radius,'16px',`${tag}: raio 16px`);
   for(const size of row.titles)assert.equal(size,'15px',`${tag}: título de 15px`);
   for(const close of row.close){
    assert.deepEqual([close.w,close.h,close.bordered],[28,28,false],`${tag}: fechar do cabeçalho é × de 28px sem borda (${JSON.stringify(close)})`);
    assert.equal(close.text,'×',`${tag}: fechar do cabeçalho é ×`);
   }
   assert.equal(row.dupClose,0,`${tag}: com × no cabeçalho não há "Fechar" repetido no rodapé`);
   if(['keys-dialog','image-dialog'].includes(row.id))assert.equal(row.close.length,1,`${tag}: tem o × do cabeçalho`);
   assert.equal(row.refreshText,0,`${tag}: Atualizar é ícone, não texto`);
   for(const height of row.controls)assert.equal(height,30,`${tag}: campos e seletores com 30px`);
   for(const foot of row.feet){
    assert.ok(foot.gap<=1,`${tag}: o rodapé encosta na base (${foot.gap}px)`);
    if(foot.lines<=1)assert.equal(foot.h,52,`${tag}: rodapé de 52px`);
    for(const height of foot.buttons)assert.equal(height,30,`${tag}: botões do rodapé com 30px`);
   }
  }
 }
 /* Em 900×650 todo diálogo cabe inteiro na janela. */
 await resizeWindow(ctx.app,page,900,650,{content:true});
 const small=await page.evaluate(()=>{
  const out=[];
  for(const dialog of document.querySelectorAll('dialog')){
   if(!dialog.id)continue;
   try{dialog.showModal();}catch{continue;}
   const box=dialog.getBoundingClientRect();
   out.push({id:dialog.id,left:Math.round(box.left),top:Math.round(box.top),right:Math.round(innerWidth-box.right),bottom:Math.round(innerHeight-box.bottom)});
   dialog.close();
  }
  return out;
 });
 for(const row of small)assert.ok(row.left>=0&&row.top>=0&&row.right>=0&&row.bottom>=0,`900×650 ${row.id}: cabe na janela (${JSON.stringify(row)})`);
 assert.deepEqual(errors,[]);
});
console.log('dialog-standard-ui: PASS — raio, título, ×, campos de 30px e rodapé de 52px em todos os diálogos, nos dois temas.');
