// node tests/settings-busy-ui.mjs — Configurações com o tutor respondendo e
// avisos sobre diálogo aberto (ticket #42, parte A, item 3), medidos na janela.
// Cobre: sem mudança, Salvar só fecha (mesmo respondendo); com mudança e o tutor
// respondendo, o rodapé diz que dá para salvar quando ele terminar e o Salvar
// fica desligado até o fim da resposta; o erro de salvar aparece DENTRO do
// diálogo, ao lado do Salvar, sem aviso flutuante; e nenhum aviso (`#toast`)
// fica atrás de um diálogo aberto — nem o que nasce com o diálogo aberto, nem o
// que já estava na tela quando o diálogo abriu. Nos dois temas, em 1440×900 e
// 900×650. Capturas para olho humano só com MESA_REVIEW_SHOTS.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
 withArtifacts,newRuntime,seedCourse,writeConfigJson,writeDeskJson,launchDesk,statusOnline,tinyPdf,
 reviewShot,screenshotDirectory,setTheme,freezeMotion,resizeWindow,pageWindow
} from './helpers.mjs';
import {layoutStable,nextFrames} from './waits.mjs';

const out=screenshotDirectory('settings-busy');
const BUSY_HINT='O tutor está respondendo. Dá para salvar quando ele terminar.';
const size=(app,page,width,height)=>resizeWindow(app,page,width,height);

/* O aviso está pintado por cima de tudo onde aparece? Com um diálogo modal
   aberto, o resto da página é inerte e o teste de clique (`elementFromPoint`)
   o pula mesmo quando está pintado em cima; a prova é o pixel. O host lê um
   pixel do fundo do aviso (na margem, longe do texto) com `capturePage` e
   compara com a cor do fundo do aviso. */
const toastOnTop=async(app,page)=>{
 await layoutStable(page,'#toast .toast-item');
 const at=await page.evaluate(()=>{
  const box=document.querySelector('#toast'),item=box.querySelector('.toast-item');
  if(!item)return null;
  const rgba=text=>{const v=text.match(/[\d.]+/g).map(Number);return [v[0],v[1],v[2],v[3]??1];};
  const r=item.getBoundingClientRect(),bg=rgba(getComputedStyle(item).backgroundColor);
  /* Atrás do véu do diálogo aberto o fundo do aviso sairia misturado com ele. */
  const dialog=[...document.querySelectorAll('dialog')].find(d=>d.open);
  const veil=dialog?rgba(getComputedStyle(dialog,'::backdrop').backgroundColor):[0,0,0,0];
  const behind=bg.slice(0,3).map((c,i)=>c*(1-veil[3])+veil[i]*veil[3]);
  return {x:Math.round(r.left+4),y:Math.round(r.top+r.height/2-4),bg:bg.slice(0,3),behind,open:box.matches(':popover-open')};
 });
 if(!at)return {item:false};
 const px=await (await pageWindow(app,page)).evaluate(async(win,{x,y})=>{
  const image=await win.webContents.capturePage({x,y,width:8,height:8});
  const {width,height}=image.getSize(),bitmap=image.toBitmap();
  const i=(Math.floor(height/2)*width+Math.floor(width/2))*4;
  return [bitmap[i+2],bitmap[i+1],bitmap[i]];
 },{x:at.x,y:at.y});
 const dist=c=>Math.max(...px.map((value,i)=>Math.abs(value-c[i])));
 const top=dist(at.bg)<=8&&dist(at.bg)<dist(at.behind);
 return {item:true,open:at.open,top,pixel:px,bg:at.bg,behind:at.behind.map(Math.round)};
};

await withArtifacts('settings-busy',async ctx=>{
 const runtime=ctx.runtime=newRuntime('settings-busy');
 const course=seedCourse(runtime,'calc');
 fs.writeFileSync(path.join(course,'Limites.pdf'),tinyPdf('Limites'));
 writeConfigJson(runtime,{runtimePath:runtime,vaultPath:runtime,courses:[{id:'calc',name:'Cálculo I',path:course}]});
 writeDeskJson(runtime,{courseId:'calc'});
 ctx.app=await launchDesk({runtime,env:{FAKE_PI_QUEUE_LOG:path.join(runtime,'queue.log'),FAKE_PI_QUEUE_HOLD_MS:'60000'}});
 const page=await ctx.app.firstWindow();
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await size(ctx.app,page,1440,900);
 await statusOnline(page);
 await freezeMotion(page);

 const openSettings=async()=>{
  await page.keyboard.press('ControlOrMeta+,');
  await page.waitForSelector('#settings-dialog[open]');
 };
 const dialogOpen=()=>page.evaluate(()=>document.querySelector('#settings-dialog').open);
 const footer=()=>page.evaluate(()=>{
  const hint=document.querySelector('#settings-hint'),save=document.querySelector('#settings-save'),error=document.querySelector('#settings-error');
  const probe=document.createElement('span');probe.style.color='var(--muted)';hint.parentElement.append(probe);
  const muted=getComputedStyle(probe).color;probe.remove();
  const box=el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width};};
  return {hint:hint.textContent.trim(),hintShown:!hint.hidden&&hint.getBoundingClientRect().width>0,hintColor:getComputedStyle(hint).color,muted,disabled:save.disabled,
   error:error.hidden?'':error.textContent.trim(),errorBox:error.hidden?null:box(error),saveBox:box(save),cancelBox:box(document.querySelector('#settings-dialog .settings-actions button[value="cancel"]')),row:box(document.querySelector('#settings-dialog .settings-actions'))};
 });
 /* Com runtime de teste o main não grava o config.json: a configuração em uso é a do host. */
 const configOf=()=>page.evaluate(()=>window.desk.getConfig().then(r=>r.config));
 const busy=()=>page.waitForFunction(()=>!document.querySelector('#stop').hidden,undefined,{timeout:15000});
 const idle=()=>page.waitForFunction(()=>document.querySelector('#stop').hidden,undefined,{timeout:30000});

 /* ---------- 1. respondendo, sem mudança: Salvar só fecha ---------- */
 await page.locator('#prompt').fill('pergunta longa');
 await page.locator('#send').click();
 await busy();
 await openSettings();
 let f=await footer();
 assert.equal(f.disabled,false,'sem mudança pendente o Salvar não trava');
 assert.notEqual(f.hint,BUSY_HINT,'sem mudança pendente o rodapé não fala da resposta');
 const before=await configOf();
 await page.locator('#settings-save').click();
 await page.waitForFunction(()=>!document.querySelector('#settings-dialog').open,undefined,{timeout:5000});
 assert.deepEqual(await configOf(),before,'nada foi gravado');
 assert.equal(await page.locator('#toast .toast-item').count(),0,'nenhum aviso de recusa');
 assert.equal(await page.locator('#stop').isVisible(),true,'a resposta segue');

 /* ---------- 2. respondendo, com mudança: o rodapé explica e o Salvar espera ---------- */
 for(const [width,height] of [[1440,900],[900,650]]){
  await size(ctx.app,page,width,height);
  for(const theme of ['light','dark']){
   await setTheme(page,theme);
   const tag=`${theme} ${width}×${height}`;
   await openSettings();
   await page.locator('#settings-tab-mesa').click();
   const original=await page.locator('#cfg-title').inputValue();
   await page.locator('#cfg-title').fill(`Mesa ${theme} ${width}`);
   await nextFrames(page);
   f=await footer();
   assert.equal(f.hint,BUSY_HINT,`${tag}: o rodapé diz que dá para salvar quando o tutor terminar`);
   assert.equal(f.hintShown,true,`${tag}: a frase aparece no rodapé`);
   assert.equal(f.hintColor,f.muted,`${tag}: a frase sobe para --muted (é o motivo do Salvar desligado)`);
   assert.equal(f.disabled,true,`${tag}: o Salvar fica desligado até o fim da resposta`);
   assert.ok(f.row.right-f.saveBox.right>=0&&f.saveBox.top>=f.row.top-0.5&&f.saveBox.bottom<=f.row.bottom+0.5,`${tag}: o Salvar fica no rodapé`);
   await page.keyboard.press('Enter');
   await page.waitForTimeout(150);// espera fixa: "nada acontece em 0,15 s" — Enter num campo não fecha o diálogo
   assert.equal(await dialogOpen(),true,`${tag}: Enter num campo também espera`);
   await reviewShot(page,out,`respondendo-com-mudanca-${theme}-${width}x${height}.png`);
   /* desfazer a mudança solta o Salvar (não há o que recusar) */
   await page.locator('#cfg-title').fill(original);
   await nextFrames(page);
   assert.equal((await footer()).disabled,false,`${tag}: sem mudança pendente o Salvar volta`);
   await page.locator('#settings-dialog button[value="cancel"]').last().click();
   await page.waitForFunction(()=>!document.querySelector('#settings-dialog').open);
  }
 }
 await size(ctx.app,page,1440,900);
 await setTheme(page,'light');

 /* ---------- 3. a resposta termina com o diálogo aberto: o Salvar acorda ---------- */
 await openSettings();
 await page.locator('#settings-tab-mesa').click();
 await page.locator('#cfg-title').fill('Mesa da Ana');
 await nextFrames(page);
 assert.equal((await footer()).disabled,true);
 await page.locator('#stop').evaluate(el=>el.click());
 await idle();
 await page.waitForFunction(()=>!document.querySelector('#settings-save').disabled,undefined,{timeout:10000});
 f=await footer();
 assert.notEqual(f.hint,BUSY_HINT,'terminada a resposta, o rodapé volta ao da seção');
 await page.locator('#settings-save').click();
 await page.waitForFunction(()=>!document.querySelector('#settings-dialog').open,undefined,{timeout:15000});
 assert.equal((await configOf()).desk?.title,'Mesa da Ana','salvou depois da resposta');
 await statusOnline(page);

 /* ---------- 4. erro de salvar: dentro do diálogo, ao lado do Salvar ---------- */
 await ctx.app.evaluate(({ipcMain})=>{ipcMain.removeHandler('save-config');ipcMain.handle('save-config',async()=>{throw new Error('Pare a resposta antes de mudar as configurações.');});});
 for(const [width,height] of [[1440,900],[900,650]]){
  await size(ctx.app,page,width,height);
  for(const theme of ['light','dark']){
   await setTheme(page,theme);
   const tag=`erro ${theme} ${width}×${height}`;
   await openSettings();
   await page.locator('#settings-tab-mesa').click();
   await page.locator('#cfg-title').fill(`Outra ${theme} ${width}`);
   await page.locator('#settings-save').click();
   await page.waitForFunction(()=>!document.querySelector('#settings-error').hidden,undefined,{timeout:5000});
   f=await footer();
   assert.equal(await dialogOpen(),true,`${tag}: o diálogo segue aberto`);
   assert.match(f.error,/Pare a resposta antes de mudar as configurações/,`${tag}: o motivo aparece no diálogo`);
   assert.equal(f.hintShown,false,`${tag}: o erro ocupa o lugar da frase do rodapé`);
   assert.ok(f.errorBox.right<=f.cancelBox.left+0.5,`${tag}: o erro fica à esquerda dos botões, na linha do Salvar`);
   assert.ok(f.errorBox.top>=f.row.top-0.5&&f.errorBox.bottom<=f.row.bottom+0.5,`${tag}: o erro fica dentro do rodapé`);
   assert.equal(await page.locator('#toast .toast-item').count(),0,`${tag}: nenhum aviso flutuante (que ficaria atrás do diálogo)`);
   await reviewShot(page,out,`erro-ao-salvar-${theme}-${width}x${height}.png`);
   await page.locator('#cfg-title').fill(`Outra ${theme} ${width}!`);
   assert.equal(await page.locator('#settings-error').isHidden(),true,`${tag}: mexer no campo limpa o erro`);
   await page.locator('#settings-dialog button[value="cancel"]').last().click();
   await page.waitForFunction(()=>!document.querySelector('#settings-dialog').open);
  }
 }
 await size(ctx.app,page,1440,900);
 await setTheme(page,'light');

 /* ---------- 5. nenhum aviso atrás de diálogo aberto ---------- */
 for(const [width,height] of [[1440,900],[900,650]]){
  await size(ctx.app,page,width,height);
  for(const theme of ['light','dark']){
   await setTheme(page,theme);
   const tag=`aviso ${theme} ${width}×${height}`;
   /* nasce com o diálogo aberto */
   await openSettings();
   await page.locator('#settings-tab-pastas').click();
   await page.locator('#cfg-pi-detect').click();
   await page.waitForSelector('#toast .toast-item');
   let top=await toastOnTop(ctx.app,page);
   assert.equal(top.open,true,`${tag}: o aviso está na camada superior`);
   assert.equal(top.top,true,`${tag}: o aviso aparece por cima do diálogo (${JSON.stringify(top)})`);
   await reviewShot(page,out,`aviso-sobre-dialogo-${theme}-${width}x${height}.png`);
   await page.locator('#settings-dialog button[value="cancel"]').last().click();
   await page.waitForFunction(()=>!document.querySelector('#settings-dialog').open);
   /* já estava na tela quando o diálogo abriu */
   await page.locator('#cfg-pi-detect').evaluate(el=>el.click());
   await page.waitForSelector('#toast .toast-item');
   await openSettings();
   await nextFrames(page);
   top=await toastOnTop(ctx.app,page);
   assert.equal(top.top,true,`${tag}: o aviso de antes volta para cima do diálogo que abriu depois (${JSON.stringify(top)})`);
   await page.locator('#settings-dialog button[value="cancel"]').last().click();
   await page.waitForFunction(()=>!document.querySelector('#settings-dialog').open);
   await page.waitForFunction(()=>!document.querySelector('#toast .toast-item'),undefined,{timeout:8000});
   assert.equal(await page.evaluate(()=>document.querySelector('#toast').matches(':popover-open')),false,`${tag}: sem aviso, a camada some`);
  }
 }
 assert.deepEqual(errors,[],'nenhum erro de página');
});

console.log('settings-busy-ui: PASS — salvar respondendo, erro no diálogo e aviso por cima, nos dois temas, 1440×900 e 900×650.');
