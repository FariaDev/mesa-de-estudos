/* Atividade interativa na conversa, medida na janela (issues #33 e #42). Desde
   o #42 o quadro fica solto: sem cartão, borda nem cabeçalho; as ferramentas do
   canto (tela cheia, recomeçar, parar) aparecem no hover/foco com 28px; embaixo
   só a linha discreta com "Levar ao tutor"; a descrição textual segue no DOM,
   fora da vista. A altura do quadro SEGUE o conteúdo e o estilo de base da Mesa
   vale dentro do quadro. Nos dois temas, em 1440×900 e 900×650. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {launchDesk,withArtifacts,DESK,screenshotDirectory,enterFree,setTheme,freezeMotion,resizeWindow} from './helpers.mjs';
import {layoutStable} from './waits.mjs';

const measureCard=()=>{
 const card=document.querySelector('.activity-slot .activity-card');
 const vis=el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'&&!el.hidden;};
 const buttons=[...card.querySelectorAll('.activity-tools button,.activity-foot button')].filter(vis);
 const frame=card.querySelector('.activity-frame'),stage=card.querySelector('.activity-stage'),foot=card.querySelector('.activity-foot');
 const box=card.getBoundingClientRect(),cs=getComputedStyle(card);
 return {
  buttons:buttons.map(b=>({act:b.dataset.act,h:Math.round(b.getBoundingClientRect().height),label:b.getAttribute('aria-label')||b.textContent.trim(),inTools:!!b.closest('.activity-tools')})),
  frameH:Math.round(frame.getBoundingClientRect().height),
  stageH:Math.round(stage.getBoundingClientRect().height),
  footH:Math.round(foot.getBoundingClientRect().height),
  border:cs.borderTopWidth,radius:cs.borderTopLeftRadius,bg:cs.backgroundColor,
  card:{top:Math.round(box.top),bottom:Math.round(box.bottom),left:Math.round(box.left),right:Math.round(box.right)},
  description:card.querySelector('.activity-alternative').textContent.length,
  win:{w:innerWidth,h:innerHeight},
 };
};
const measureFrame=()=>{
 const body=document.body,style=getComputedStyle(body);
 const content=Math.ceil(body.getBoundingClientRect().height+parseFloat(style.marginTop)+parseFloat(style.marginBottom));
 const h=(sel)=>{const el=document.querySelector(sel);return el?Math.round(el.getBoundingClientRect().height):null;};
 const radius=(sel)=>{const el=document.querySelector(sel);return el?getComputedStyle(el).borderTopLeftRadius:null;};
 return {content,inner:innerHeight,button:h('#attempt'),input:h('#guess'),inputRadius:radius('#guess'),buttonRadius:radius('#attempt'),
  buttonBg:getComputedStyle(document.querySelector('#attempt')).backgroundColor,font:getComputedStyle(document.body).fontSize,heading:getComputedStyle(document.querySelector('h2')).fontSize};
};

await withArtifacts('activity-card-ui',async ctx=>{
 ctx.runtime=fs.mkdtempSync(path.join(os.tmpdir(),'mesa-activity-card-'));
 const pi=path.join(DESK,'tests/fixtures/mesa-interactive-pi.mjs');fs.chmodSync(pi,0o755);
 fs.writeFileSync(path.join(ctx.runtime,'config.json'),JSON.stringify({runtimePath:ctx.runtime,vaultPath:ctx.runtime,courses:[]}));
 ctx.app=await launchDesk({runtime:ctx.runtime,env:{LEARNING_DESK_PI:pi}});
 const page=await ctx.app.firstWindow(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await enterFree(page);
 await page.evaluate(async()=>{await (await import('./src/state.mjs')).connect();});
 await freezeMotion(page);
 await page.locator('#prompt').fill('Crie uma atividade de movimento.');await page.locator('#send').click();
 const slot=page.locator('.activity-slot[data-activity-call="integrated-call-1"]');
 await slot.locator('.activity-card[data-state="ready"]').waitFor({timeout:12000});
 const frame=page.frames().find(f=>f.url().startsWith('mesa-activity://artifact/'));
 const shots=screenshotDirectory('activity-card-ui');
 /* Espera o quadro reportar a altura do conteúdo (80ms de taxa + 160ms de debounce). */
 const settle=async()=>{await page.waitForFunction(()=>{const f=document.querySelector('.activity-frame'),c=document.querySelector('.activity-card');return f&&c&&f.getBoundingClientRect().height>0;});await layoutStable(page,'.activity-card');};
 for(const size of [[1440,900],[900,650]]){
  await resizeWindow(ctx.app,page,...size,{content:true});
  for(const theme of ['light','dark']){
   await setTheme(page,theme);
   await frame.waitForFunction(t=>document.documentElement.dataset.theme===t,theme);
   await slot.locator('.activity-card').scrollIntoViewIfNeeded();
   await settle();
   const tag=`${size.join('x')} ${theme}`;
   await slot.locator('.activity-stage').hover();
   await layoutStable(page,'.activity-card');
   const card=await page.evaluate(measureCard);
   assert.equal(card.border,'0px',`${tag}: sem borda de cartão`);
   assert.equal(card.bg,'rgba(0, 0, 0, 0)',`${tag}: sem fundo de cartão`);
   assert.equal(card.radius,'0px',`${tag}: sem raio de cartão`);
   assert.deepEqual(card.buttons.filter(b=>b.inTools).map(b=>b.act).sort(),['expand','restart','stop'],`${tag}: ferramentas do canto da atividade (${JSON.stringify(card.buttons)})`);
   for(const b of card.buttons)assert.equal(b.h,28,`${tag}: ${b.act} com 28px`);
   assert.deepEqual(card.buttons.filter(b=>!b.inTools).map(b=>b.label),['Levar ao tutor'],`${tag}: embaixo só "Levar ao tutor"`);
   assert.ok(card.footH<=30,`${tag}: linha de baixo discreta (${card.footH}px)`);
   assert.ok(card.description>40,`${tag}: descrição textual presente para o leitor de tela`);
   const inner=await frame.evaluate(measureFrame);
   /* O quadro tem a altura do CONTEÚDO: sem vão fixo sob a atividade. */
   assert.ok(Math.abs(card.frameH-inner.content)<=2,`${tag}: quadro (${card.frameH}px) segue o conteúdo (${inner.content}px)`);
   assert.ok(card.frameH<=1200&&card.frameH>=48);
   assert.equal(card.stageH,card.frameH,`${tag}: o palco é o próprio quadro (sem linha nem moldura)`);
   /* Estilo de base dentro do quadro. */
   assert.equal(inner.button,30,`${tag}: botão do quadro com 30px`);assert.equal(inner.input,30,`${tag}: campo do quadro com 30px`);
   assert.equal(inner.inputRadius,'8px');assert.equal(inner.buttonRadius,'8px');assert.equal(inner.font,'13px');assert.equal(inner.heading,'15px');
   await slot.locator('.activity-card').screenshot({path:path.join(shots,`card-${size.join('x')}-${theme}.png`)});
  }
 }
 /* Tela cheia: o mesmo iframe cobre a janela; o conteúdo continua o mesmo. */
 await resizeWindow(ctx.app,page,1440,900,{content:true});
 for(const theme of ['light','dark']){
  await setTheme(page,theme);
  await slot.locator('.activity-stage').hover();
  await slot.locator('[data-act="expand"]').click();
  await layoutStable(page,'.activity-slot .activity-stage');
  const stage=await page.evaluate(()=>{const r=document.querySelector('.activity-slot .activity-stage').getBoundingClientRect();return {l:r.left,t:r.top,r:r.right,b:r.bottom,w:innerWidth,h:innerHeight};});
  assert.ok(stage.l<=0.5&&stage.t<=0.5&&stage.r>=stage.w-0.5&&stage.b>=stage.h-0.5,`${theme}: tela cheia cobre a janela (${JSON.stringify(stage)})`);
  assert.equal(await frame.locator('#s').textContent()!=='',true,'o quadro segue vivo');
  await page.screenshot({path:path.join(shots,`tela-cheia-${theme}.png`)});
  await page.keyboard.press('Escape');
  await page.waitForFunction(()=>!document.querySelector('.activity-card.activity-fullscreen'));
 }
 /* "Levar ao tutor" anexa, nunca envia. */
 await page.locator('#prompt').fill('');
 await slot.locator('[data-act="draft"]').click();
 assert.match(await page.locator('#prompt').inputValue(),/^\[Atividade: Explorar o MRUV\]/);
 assert.match(await slot.locator('.activity-status').textContent(),/Tentativa anexada ao rascunho/);
 assert.deepEqual(errors,[]);
});
console.log('activity-card-ui: PASS — atividade solta (sem cartão), ferramentas do canto de 28px, só "Levar ao tutor" embaixo, altura segue o conteúdo, tela cheia e estilo de base no quadro, nos dois temas e tamanhos.');
