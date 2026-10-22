/* Figura em tela cheia (#52, parte 2), medida na janela. Uma visualização que é
   só uma figura com legenda (SVG e imagem) cresce até caber na tela cheia, sem
   deformar, centralizada, com a legenda inteira embaixo. Nos dois temas, em
   1440×900 e 900×650. Pi sintético (sem modelo) publicando pela ponte real.
   Capturas só com MESA_REVIEW_SHOTS. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {launchDesk,withArtifacts,DESK,screenshotDirectory,reviewShot,enterFree,setTheme,freezeMotion,resizeWindow} from './helpers.mjs';
import {layoutStable,pollUntil} from './waits.mjs';

const out=screenshotDirectory('activity-figure');
const NATURAL_RATIO=320/220;
const FIGURES=[
 {kind:'svg',call:'integrated-call-1',prompt:'Mostre uma figura.',media:'svg'},
 {kind:'imagem',call:'integrated-call-2',prompt:'Mostre uma figura imagem.',media:'img'},
];

const measureFigure=frame=>frame.evaluate(()=>{
 const rect=el=>{const b=el.getBoundingClientRect();return {left:b.left,right:b.right,top:b.top,bottom:b.bottom,width:b.width,height:b.height};};
 const media=document.querySelector('[data-figure-media]'),caption=document.querySelector('[data-figure-caption]');
 /* O que se vê, não a caixa: o SVG desenha o 1º <rect> (moldura 320×220) e a imagem
    encaixa por `object-fit:contain` dentro da caixa dela. */
 const drawn=(()=>{
  if(!media)return null;
  if(media.tagName.toLowerCase()==='svg')return rect(media.querySelector('rect'));
  const box=media.getBoundingClientRect(),fit=Math.min(box.width/media.naturalWidth,box.height/media.naturalHeight);
  const width=media.naturalWidth*fit,height=media.naturalHeight*fit,left=box.left+(box.width-width)/2,top=box.top+(box.height-height)/2;
  return {left,right:left+width,top,bottom:top+height,width,height,objectFit:getComputedStyle(media).objectFit};
 })();
 return {drawn,
  display:document.documentElement.dataset.display,figure:document.documentElement.dataset.figure,
  vw:innerWidth,vh:innerHeight,media:media?rect(media):null,caption:caption?rect(caption):null,
  captionText:caption?.textContent.trim()||'',
  scrollOverflow:document.documentElement.scrollHeight-innerHeight,
 };
});

await withArtifacts('activity-figure-ui',async ctx=>{
 ctx.runtime=fs.mkdtempSync(path.join(os.tmpdir(),'mesa-activity-figure-'));
 const pi=path.join(DESK,'tests/fixtures/mesa-interactive-pi.mjs');fs.chmodSync(pi,0o755);
 fs.writeFileSync(path.join(ctx.runtime,'config.json'),JSON.stringify({runtimePath:ctx.runtime,vaultPath:ctx.runtime,courses:[]}));
 ctx.app=await launchDesk({runtime:ctx.runtime,env:{LEARNING_DESK_PI:pi}});
 const page=await ctx.app.firstWindow(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const size=(width,height)=>resizeWindow(ctx.app,page,width,height,{content:true});
 await size(1440,900);
 await enterFree(page);
 await page.evaluate(async()=>{await (await import('./src/state.mjs')).connect();});
 await freezeMotion(page);
 const send=async text=>{await page.waitForFunction(()=>!document.querySelector('#send').disabled,undefined,{timeout:30000});await page.locator('#prompt').fill(text);await page.locator('#send').click();};
 for(const figure of FIGURES){
  await send(figure.prompt);
  await page.locator(`.activity-slot[data-activity-call="${figure.call}"] .activity-card[data-state="ready"]`).waitFor({timeout:30000});
 }

 for(const [width,height] of [[1440,900],[900,650]]){
  await size(width,height);
  for(const theme of ['light','dark']){
   await setTheme(page,theme);
   for(const figure of FIGURES){
    const label=`${figure.kind} ${theme} ${width}×${height}`;
    const slot=page.locator(`.activity-slot[data-activity-call="${figure.call}"]`);
    await slot.scrollIntoViewIfNeeded();
    await slot.locator('.activity-card[data-state="ready"] .activity-iframe').waitFor({timeout:15000});
    const iframe=await slot.locator('.activity-iframe').elementHandle();
    const frame=await iframe.contentFrame();
    await slot.locator('.activity-stage').hover();
    await slot.locator('[data-act="expand"]').click();
    await frame.waitForFunction(()=>document.documentElement.dataset.display==='fullscreen'&&document.documentElement.dataset.figure==='on',undefined,{timeout:10000});
    await layoutStable(page,'.activity-fullscreen .activity-stage');
    await pollUntil(()=>measureFigure(frame),m=>m.media&&m.drawn.width>400,{timeout:5000,interval:50,what:`a figura ${figure.kind} crescer na tela cheia`,onTimeout:'return'});
    const m=await measureFigure(frame);
    const at=await iframe.boundingBox(),win=await page.evaluate(()=>({w:innerWidth,h:innerHeight}));
    assert.equal(m.figure,'on',`${label}: reconhecida como figura`);
    assert.ok(m.drawn.width>=320*1.8,`${label}: cresceu além do tamanho natural (${Math.round(m.drawn.width)}×${Math.round(m.drawn.height)})`);
    assert.ok(Math.abs(m.drawn.width/m.drawn.height-NATURAL_RATIO)<=0.03,`${label}: mantém a proporção (${(m.drawn.width/m.drawn.height).toFixed(3)} × ${NATURAL_RATIO.toFixed(3)})`);
    assert.ok(m.drawn.height>=m.vh*0.6||m.drawn.width>=m.vw*0.6,`${label}: ocupa a maior parte da tela (${Math.round(m.drawn.width)}×${Math.round(m.drawn.height)} em ${m.vw}×${m.vh})`);
    assert.ok(Math.abs(at.x+(m.drawn.left+m.drawn.right)/2-win.w/2)<=2,`${label}: centralizada na janela (${at.x+(m.drawn.left+m.drawn.right)/2} × ${win.w/2})`);
    assert.ok(m.drawn.top>=0&&m.drawn.left>=0&&m.drawn.right<=m.vw+0.5,`${label}: dentro da tela`);
    assert.ok(at.y+m.drawn.top>=8,`${label}: não colada no topo da janela (${at.y+m.drawn.top})`);
    assert.equal(m.captionText,'Exemplo da apostila',`${label}: legenda presente`);
    assert.ok(m.caption.top>=m.drawn.bottom-1,`${label}: legenda abaixo da figura`);
    assert.ok(at.y+m.caption.bottom<=win.h&&m.caption.bottom<=m.vh+0.5&&m.caption.right<=m.vw+0.5&&m.caption.left>=-0.5,`${label}: legenda inteira, sem corte (${Math.round(at.y+m.caption.bottom)} × ${win.h})`);
    assert.ok(m.scrollOverflow<=1,`${label}: sem rolagem no quadro (${m.scrollOverflow})`);
    await reviewShot(page,out,`${figure.kind}-tela-cheia-${width}x${height}-${theme}.png`);
    await page.keyboard.press('Escape');
    await page.waitForFunction(()=>!document.querySelector('.activity-fullscreen'));
    /* Fora da tela cheia o quadro volta ao que era: sem marca de figura. */
    await frame.waitForFunction(()=>document.documentElement.dataset.display==='inline',undefined,{timeout:5000});
   }
  }
 }
 assert.deepEqual(errors,[]);
});
console.log('activity-figure-ui: PASS — SVG e imagem em tela cheia crescem até caber, mantêm a proporção, ficam centralizadas e com a legenda inteira, nos dois temas e tamanhos.');
