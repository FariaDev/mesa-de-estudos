/* O aviso rápido (#toast) mora no canto inferior direito, junto do tutor (#52).
   Medido na janela, nos dois temas, em 1440×900 e 900×650:
   - com o tutor aberto: acima da caixa do tutor, na coluna dele (borda direita
     alinhada à da caixa) e sem tapar o leitor;
   - com o tutor recolhido: no canto da janela, acima do botão de reabrir;
   - depois de reabrir o tutor, volta à coluna;
   - continua acima de um diálogo aberto (popover, #42).
   Capturas só com MESA_REVIEW_SHOTS. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
 withArtifacts,newRuntime,seedCourse,writeConfigJson,writeDeskJson,launchDesk,statusOnline,tinyPdf,
 reviewShot,screenshotDirectory,setTheme,freezeMotion,resizeWindow
} from './helpers.mjs';
import {nextFrames} from './waits.mjs';
import {captureWindow,pixelsAt,rgbDistance} from './window-pixels.mjs';

const out=screenshotDirectory('toast-position');
const MESSAGE='Print do GeoGebra anexado à mensagem.';

const showToast=async page=>{
 await page.evaluate(async text=>{(await import('./src/state.mjs')).toast(text);},MESSAGE);
 await page.waitForFunction(()=>document.querySelector('#toast .toast-item:not(.closing):not(.out)'));
 await nextFrames(page,3);
};
const measure=page=>page.evaluate(()=>{
 const rect=el=>{const b=el.getBoundingClientRect();return {left:b.left,right:b.right,top:b.top,bottom:b.bottom,width:b.width,height:b.height};};
 const item=document.querySelector('#toast .toast-item:not(.closing):not(.out)');
 const at=item?rect(item):null;
 return {
  vw:innerWidth,vh:innerHeight,item:at,
  composer:rect(document.querySelector('#composer')),box:rect(document.querySelector('#composer-box')),chat:rect(document.querySelector('#chat')),
  restore:(()=>{const el=document.querySelector('#chat-restore');return el&&el.getClientRects().length?rect(el):null;})(),
  collapsed:document.body.classList.contains('chat-collapsed'),
  popoverOpen:document.querySelector('#toast').matches(':popover-open'),
 };
});
const near=(a,b,tolerance=1)=>Math.abs(a-b)<=tolerance;

await withArtifacts('toast-position',async ctx=>{
 const runtime=ctx.runtime=newRuntime('toast-position');
 const course=seedCourse(runtime,'calc');
 const pdf=path.join(course,'Limites.pdf');fs.writeFileSync(pdf,tinyPdf('Limites'));
 writeConfigJson(runtime,{runtimePath:runtime,vaultPath:runtime,courses:[{id:'calc',name:'Cálculo I',path:course}]});
 writeDeskJson(runtime,{courseId:'calc',courseStates:{calc:{pdfs:[{path:pdf,page:1}],study:{title:'',xopp:''}}}});
 ctx.app=await launchDesk({runtime});
 const page=await ctx.app.firstWindow(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await resizeWindow(ctx.app,page,1440,900,{content:true});
 await statusOnline(page);
 await freezeMotion(page);
 await page.waitForSelector('.pdf-panel canvas',{timeout:30000});

 for(const [width,height] of [[1440,900],[900,650]]){
  await resizeWindow(ctx.app,page,width,height,{content:true});
  for(const theme of ['light','dark']){
   await setTheme(page,theme);
   const label=`${theme} ${width}×${height}`;

   /* Tutor aberto: sobre a coluna dele, acima da caixa, sem tapar o leitor. */
   await showToast(page);
   let m=await measure(page);
   assert.equal(m.collapsed,false,`${label}: tutor aberto`);
   assert.equal(m.popoverOpen,true,`${label}: o aviso é popover aberto`);
   assert.ok(m.item.bottom<=m.composer.top+0.5,`${label}: acima da caixa do tutor (${m.item.bottom} × ${m.composer.top})`);
   assert.ok(m.composer.top-m.item.bottom<=40,`${label}: colado à caixa, não solto no meio (${m.composer.top-m.item.bottom})`);
   assert.ok(near(m.item.right,m.box.right,2),`${label}: alinhado à borda direita da caixa do tutor (${m.item.right} × ${m.box.right})`);
   assert.ok(m.item.left>=m.chat.left-0.5,`${label}: dentro da coluna do tutor, sem tapar o leitor (${m.item.left} × ${m.chat.left})`);
   assert.ok(m.item.top>=0&&m.item.bottom<=m.vh,`${label}: dentro da janela`);
   await reviewShot(page,out,`toast-aberto-${theme}-${width}.png`);

   /* Tutor recolhido: canto da janela, acima do botão de reabrir. */
   await page.keyboard.press('ControlOrMeta+\\');
   await page.waitForFunction(()=>document.body.classList.contains('chat-collapsed'));
   await nextFrames(page,4);
   await showToast(page);
   m=await measure(page);
   assert.equal(m.collapsed,true,`${label}: tutor recolhido`);
   assert.ok(m.vw-m.item.right>=8&&m.vw-m.item.right<=40,`${label}: no canto direito da janela (${m.vw-m.item.right})`);
   assert.ok(m.vh-m.item.bottom>=8&&m.vh-m.item.bottom<=120,`${label}: no pé da janela (${m.vh-m.item.bottom})`);
   if(m.restore)assert.ok(m.item.bottom<=m.restore.top+0.5||m.item.right<=m.restore.left+0.5||m.item.left>=m.restore.right-0.5,`${label}: não cobre o botão de reabrir`);
   await reviewShot(page,out,`toast-recolhido-${theme}-${width}.png`);
   await page.locator('#chat-restore').click();
   await page.waitForFunction(()=>!document.body.classList.contains('chat-collapsed'));
   await nextFrames(page,4);

   /* Reaberto, volta à coluna. */
   await showToast(page);
   m=await measure(page);
   assert.ok(near(m.item.right,m.box.right,2),`${label}: reabrir devolve o aviso à coluna`);
  }
 }

 /* Acima de diálogo (#42): o aviso nasce na camada superior, não por trás do modal.
    O diálogo é esticado sobre a janela toda para cobrir o aviso, e o pixel
    onde o aviso está tem de ser o da cor dele (o `elementFromPoint` não serve:
    o aviso não recebe o mouse). Só no macOS, onde há captura da janela. */
 await resizeWindow(ctx.app,page,1440,900,{content:true});
 await page.keyboard.press('ControlOrMeta+,');
 await page.waitForSelector('#settings-dialog[open]');
 await page.evaluate(()=>{document.querySelector('#settings-dialog').style.cssText='position:fixed;inset:0;width:100vw;height:100vh;max-width:none;max-height:none;margin:0';});
 await showToast(page);
 await reviewShot(page,out,'toast-sobre-dialogo-1440.png');
 if(process.platform==='darwin'){
  const spot=await page.evaluate(()=>{
   const item=document.querySelector('#toast .toast-item:not(.closing):not(.out)'),b=item.getBoundingClientRect();
   const [r,g,bl]=getComputedStyle(item).backgroundColor.match(/\d+/g).map(Number);
   return {x:b.left+8,y:(b.top+b.bottom)/2,color:[r,g,bl]};
  });
  const shot=await captureWindow(ctx.app,page,path.join(ctx.runtime,'toast-sobre-dialogo.png'));
  const [rgb]=await pixelsAt(ctx.app,shot,[{x:spot.x,y:spot.y}]);
  assert.ok(rgbDistance(rgb,spot.color)<=6,`o aviso fica acima do diálogo aberto: pixel ${rgb} × cor do aviso ${spot.color}`);
 }
 assert.deepEqual(errors,[]);
});
console.log('toast-position-ui: PASS — aviso rápido no canto da coluna do tutor, no canto da janela com o tutor recolhido e acima de diálogo, nos dois temas e tamanhos.');
