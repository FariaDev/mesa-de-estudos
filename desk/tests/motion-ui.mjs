import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {withArtifacts,launchDesk,newRuntime,seedCourse,writeConfigJson,tinyPdf,statusOnline,screenshotDirectory,setTheme} from './helpers.mjs';
import {nextFrames} from './waits.mjs';

/* Linguagem de movimento (#63, docs/design/movimento.md), na janela real e sem
   freezeMotion: popover e diálogo entram do ponto de partida e também saem
   animados; o medidor de contexto enche por transform; com "reduzir
   movimento" emulado nada se desloca e laços duram 0s. Com MESA_REVIEW_SHOTS,
   grava quadros pausados (Web Animations) das transições principais, claro e
   escuro, para o autor revisar; os quadros não são asserção. */

const SHOT_DIR=screenshotDirectory('movimento');
const FRAMES=[0,.25,.5,.75,1];

/* Abre um popover pelo clique do JS e lê o transform no mesmo quadro: o
   @starting-style põe a transição no começo, então o valor é o de partida. */
const openAndRead=(page,trigger,pop)=>page.evaluate(([t,p])=>{
 document.querySelector(t).click();
 const el=document.querySelector(p);
 return {hidden:el.hidden,transform:getComputedStyle(el).transform,running:el.getAnimations().map(a=>a.transitionProperty||a.animationName)};
},[trigger,pop]);
/* Fecha pelo mesmo gatilho (alterna) e lê no mesmo quadro: a saída já começou. */
const closeAndRead=(page,trigger,pop)=>page.evaluate(([t,p])=>{
 document.querySelector(t).click();
 const el=document.querySelector(p);
 return {hidden:el.hidden,display:getComputedStyle(el).display,running:el.getAnimations().map(a=>a.transitionProperty||a.animationName)};
},[trigger,pop]);
async function settle(page,selector){
 await page.waitForFunction(s=>[...document.querySelectorAll(s)].every(el=>el.getAnimations().every(a=>a.playState!=='running')),selector,{timeout:5000});
}

/* Pausa as animações do elemento em cada fração e captura a região dele. */
async function captureFrames(page,selector,name){
 if(!process.env.MESA_REVIEW_SHOTS)return;
 for(const fraction of FRAMES){
  await page.evaluate(([s,f])=>{
   for(const el of document.querySelectorAll(s))for(const a of el.getAnimations({subtree:true})){
    a.pause();
    const total=Number(a.effect?.getComputedTiming().endTime)||0;
    a.currentTime=total*f;
   }
  },[selector,fraction]);
  const box=await page.locator(selector).first().boundingBox();
  if(box)await page.screenshot({path:path.join(SHOT_DIR,`${name}-${String(Math.round(fraction*100)).padStart(3,'0')}.png`),clip:{x:Math.max(0,box.x-24),y:Math.max(0,box.y-24),width:box.width+48,height:box.height+48}});
 }
 await page.evaluate(s=>{for(const el of document.querySelectorAll(s))for(const a of el.getAnimations({subtree:true}))a.finish();},selector);
}

async function popoverMoves(page,theme){
 const opened=await openAndRead(page,'#model-indicator','#model-pop');
 assert.equal(opened.hidden,false,'o seletor de modelo abriu');
 assert.notEqual(opened.transform,'none',`o seletor entra de --from-rise (veio ${opened.transform})`);
 assert.ok(opened.running.includes('opacity'),`a entrada é transição de opacidade (veio ${opened.running})`);
 await captureFrames(page,'#model-pop',`seletor-entra-${theme}`);
 await settle(page,'#model-pop');
 const closed=await closeAndRead(page,'#model-indicator','#model-pop');
 assert.equal(closed.hidden,true,'o gatilho fecha o seletor');
 assert.notEqual(closed.display,'none','o seletor ainda está na tela durante a saída');
 assert.ok(closed.running.includes('opacity'),`a saída também anima (veio ${closed.running})`);
 await page.waitForFunction(()=>getComputedStyle(document.querySelector('#model-pop')).display==='none',undefined,{timeout:2000});
}

async function dialogMoves(page,theme){
 await page.keyboard.press('ControlOrMeta+,');
 await page.waitForSelector('#settings-dialog[open]');
 await captureFrames(page,'#settings-dialog',`dialogo-entra-${theme}`);
 await settle(page,'#settings-dialog');
 const running=await page.evaluate(()=>{const d=document.querySelector('#settings-dialog');d.close();return {open:d.open,display:getComputedStyle(d).display,running:d.getAnimations().map(a=>a.transitionProperty)};});
 assert.equal(running.open,false);
 assert.notEqual(running.display,'none','o diálogo fica na tela enquanto sai');
 assert.ok(running.running.includes('opacity'),`o diálogo sai animado (veio ${running.running})`);
 await page.waitForFunction(()=>getComputedStyle(document.querySelector('#settings-dialog')).display==='none',undefined,{timeout:2000});
}

/* Conferir acende o fundo do botão (flash) em vez de só apagar o ícone. */
async function checkFlashes(page,theme){
 const flash=await page.evaluate(async()=>{
  const {playShutter}=await import('./src/icon-motion.mjs');
  const button=document.querySelector('#check');
  const before=getComputedStyle(button).backgroundColor;
  playShutter(button);
  return {before,during:getComputedStyle(button).backgroundColor,names:button.getAnimations().map(a=>a.animationName)};
 });
 assert.ok(flash.names.includes('motion-flash'),`o Conferir toca o flash (veio ${flash.names})`);
 assert.notEqual(flash.during,flash.before,'o fundo acende no começo do flash');
 await captureFrames(page,'#check',`conferir-flash-${theme}`);
}

/* O medidor não anima largura: enche por scaleX a partir da variável que o núcleo emite. */
async function meterFills(page){
 const meter=await page.evaluate(()=>{
  const meter=document.querySelector('#ctx-meter'),i=meter.querySelector('.bar i');
  /* Sem uso do contexto o medidor (e o menu onde mora) nasce escondido, e sem
     caixa o transform resolvido é none: mostra a cadeia só para medir. */
  const shown=[];
  for(let el=meter;el;el=el.parentElement)if(el.hidden){el.hidden=false;shown.push(el);}
  i.setAttribute('style','--meter:42%');
  if(!CSS.supports('transform','scaleX(42%)'))return {transform:'scaleX com % não suportado',property:''};
  for(const a of i.getAnimations())a.finish();
  const s=getComputedStyle(i);
  const out={transform:s.transform,property:s.transitionProperty};
  for(const el of shown)el.hidden=true;
  return out;
 });
 assert.match(meter.transform,/^matrix\(0\.42, 0, 0, 1, 0, 0\)$/,`scaleX(42%) (veio ${meter.transform})`);
 assert.doesNotMatch(meter.property,/width/,'o medidor não transiciona largura');
}

async function reducedMotion(page){
 await page.emulateMedia({reducedMotion:'reduce'});
 await nextFrames(page);
 const tokens=await page.evaluate(()=>{
  const root=getComputedStyle(document.documentElement);
  const spin=document.createElement('span');spin.className='step-spin';document.body.append(spin);
  const loop=getComputedStyle(spin).animationDuration;spin.remove();
  return {rise:root.getPropertyValue('--from-rise').trim(),drop:root.getPropertyValue('--from-drop').trim(),base:root.getPropertyValue('--t-base').trim(),loop};
 });
 assert.deepEqual({rise:tokens.rise,drop:tokens.drop},{rise:'none',drop:'none'},'nada se desloca com movimento reduzido');
 assert.equal(tokens.loop,'0s','laço (spinner) dura 0s com movimento reduzido');
 const opened=await openAndRead(page,'#model-indicator','#model-pop');
 assert.equal(opened.transform,'none',`o seletor só faz fade (veio ${opened.transform})`);
 await settle(page,'#model-pop');
 await closeAndRead(page,'#model-indicator','#model-pop');
 await page.emulateMedia({reducedMotion:'no-preference'});
}

await withArtifacts('movimento',async ctx=>{
 const runtime=ctx.runtime=newRuntime('movimento'),course=seedCourse(runtime,'Test');
 fs.writeFileSync(path.join(course,'Limites.pdf'),tinyPdf('Exercise',6));
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'Test',name:'Teste',path:course}],desk:{pinnedExtensions:false}});
 ctx.app=await launchDesk({runtime});
 const page=await ctx.app.firstWindow();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await statusOnline(page);
 await page.waitForSelector('.pdf-panel canvas',{timeout:25000});
 for(const theme of ['light','dark']){
  await setTheme(page,theme);
  await popoverMoves(page,theme);
  await dialogMoves(page,theme);
  await checkFlashes(page,theme);
 }
 await meterFills(page);
 await reducedMotion(page);
 assert.deepEqual(errors,[]);
 console.log('PASS: movimento — entra e sai pelos tokens, medidor por transform, reduzir movimento global');
});

console.log('Screenshots:',SHOT_DIR);
