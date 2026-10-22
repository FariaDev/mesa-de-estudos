import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {withArtifacts,launchDesk,newRuntime,seedCourse,writeConfigJson,tinyPdf,statusOnline,sendEnabled,screenshotDirectory,setTheme,freezeMotion,moreClick,tutorMore,resizeWindow} from './helpers.mjs';
import {measure,assertLayout,assertFill,near,settle} from './layout-measure.mjs';

/* Regras de layout (ticket #7 da spec de redesenho): mede na janela real o que
   o usuário vê — leitores e tutor colados entre si e nas bordas da janela, sem
   cantos de cartão; barra superior de 44px e barras de painel de 40px por
   linha; recuo de 12px; página do PDF na largura do leitor; zoom, giro e
   divisórias funcionando; nada fora da tela nem cortado em 900×650. Vale com
   um e com dois leitores, nos dois temas. As imagens claro/escuro em 1440×900
   e 900×650 saem numa pasta `layout-…` de desk/tests/artifacts para olho
   humano; não são asserção. */

const SHOT_DIR=screenshotDirectory('layout');
const WIDE=[1440,900],MINIMUM=[900,650];
const THEMES=[['light','claro'],['dark','escuro']];

async function setSize(app,page,[width,height]){
 await resizeWindow(app,page,width,height);
 await settle(page);
}
async function shot(page,name){
 await page.mouse.move(2,2);
 await page.screenshot({path:path.join(SHOT_DIR,name)});
}
async function layoutNow(page){
 await settle(page);
 return measure(page);
}

/* Abre a Mesa numa matéria com um ou dois leitores e uma fala de cada lado,
   para as imagens mostrarem a coluna do tutor em uso. */
async function openDesk(ctx,tag,{two}){
 const runtime=ctx.runtime=newRuntime(tag),course=seedCourse(runtime,'Test');
 const lines=['Lista 2 - Limites','Calcule, quando existir, cada um dos limites abaixo.','5. lim x->2 (x^2 - 4)/(x - 2)','6. lim x->0 sen(3x)/x','7. Usando os limites fundamentais','8. lim x->inf (1 + 2/x)^x'];
 fs.writeFileSync(path.join(course,'Limites.pdf'),tinyPdf(lines,6));
 if(two)fs.writeFileSync(path.join(course,'Formulario.pdf'),tinyPdf(['Formulario','sen^2 x + cos^2 x = 1','lim sen x / x = 1'],3));
 const desk=two?{pinnedExtensions:false}:{panels:[{label:'Lista',prefer:['Limites']}],pinnedExtensions:false};
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'Test',name:'Cálculo I',path:course}],desk});
 ctx.app=await launchDesk({runtime});
 const page=await ctx.app.firstWindow();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await statusOnline(page);
 await page.waitForSelector('.pdf-panel canvas',{timeout:25000});
 await freezeMotion(page);
 await page.locator('#prompt').fill('Na 7b cheguei em 0/0 e travei. Qual teorema eu uso?');
 await page.locator('#send').click();
 await page.waitForSelector('.message.assistant',{timeout:20000});
 await sendEnabled(page,{timeout:20000});
 return {page,errors};
}
/* As regras valem nos dois temas e nos dois tamanhos; na janela larga cada
   barra do leitor cabe numa linha só. */
async function assertEveryThemeAndSize(ctx,page,scene,readers){
 for(const [theme,tag] of THEMES){
  await setTheme(page,theme);
  for(const size of [WIDE,MINIMUM]){
   await setSize(ctx.app,page,size);
   assertLayout(await measure(page),`${scene} ${tag} ${size.join('x')}`,{readers,oneLine:size===WIDE});
   await shot(page,`${scene.replace(/\s+/g,'-')}-${tag}-${size.join('x')}.png`);
  }
 }
}
async function openSidechat(page){
 await page.locator('#sidechat-toggle').click();
 await page.waitForFunction(()=>{const el=document.querySelector('#sidechat');return el&&!el.hidden&&el.getBoundingClientRect().width>0;},undefined,{timeout:15000});
}
const reader=(page,i)=>page.locator('#pdf-grid .pdf-panel').nth(i);
async function drag(page,locator,dx){
 const b=await locator.boundingBox();
 const x=b.x+b.width/2,y=b.y+b.height/2;
 await page.mouse.move(x,y);await page.mouse.down();
 await page.mouse.move(x+dx/2,y,{steps:4});await page.mouse.move(x+dx,y,{steps:4});
 await page.mouse.up();
}

await withArtifacts('layout-dois-leitores',async ctx=>{
 const {page,errors}=await openDesk(ctx,'layout-dois',{two:true});
 await assertEveryThemeAndSize(ctx,page,'dois leitores',2);
 await setTheme(page,'light');
 await setSize(ctx.app,page,WIDE);

 /* Zoom: a página cresce e encolhe; "ajustar" devolve a largura do leitor. */
 const first=reader(page,0),firstNow=async()=>(await layoutNow(page)).readers[0];
 const fitted=await firstNow();
 await moreClick(first,'.in');
 let seen=await firstNow();
 assert.equal(seen.zoom,'120%','zoom: o rótulo acompanha');
 /* 120% da largura útil DESTE momento: com a página maior a barra de rolagem
    clássica (mouse ligado no macOS) aparece e tira ~11px do leitor. */
 assert.ok(near(seen.page.width,seen.client*1.2,2),`zoom: a página cresce 20% (${seen.page.width} de ${seen.client} úteis; ajustada era ${fitted.page.width})`);
 await moreClick(first,'.out');
 await moreClick(first,'.out');
 seen=await firstNow();
 assert.equal(seen.zoom,'80%','zoom: diminui');
 assert.ok(near(seen.page.width,seen.client*.8,2),`zoom: a página encolhe 20% (${seen.page.width} de ${seen.client} úteis)`);
 await moreClick(first,'.fit');
 seen=await firstNow();
 assert.equal(seen.zoom,'100%','ajustar: volta a 100%');
 assertFill(seen,'ajustar à largura');

 /* Giro: a página deitada continua na largura do leitor; quatro giros voltam. */
 await moreClick(first,'.rotate');
 seen=await firstNow();
 assert.ok(seen.page.height<seen.page.width,`giro: a página fica deitada (${seen.page.width}×${seen.page.height})`);
 assertFill(seen,'página girada');
 for(let i=0;i<3;i++)await moreClick(first,'.rotate');
 seen=await firstNow();
 assert.ok(seen.page.height>seen.page.width,'giro: quatro giros voltam à página em pé');
 assertFill(seen,'página de volta em pé');

 /* Divisória entre os leitores: arrasta, os dois continuam colados e as páginas
    se ajustam à largura nova (a barra do leitor segue numa linha só). */
 let before=await layoutNow(page);
 await drag(page,page.locator('.pdf-divider'),120);
 let after=await layoutNow(page);
 assert.ok(near(after.readers[0].panel.width-before.readers[0].panel.width,120,3),`divisória dos leitores: o primeiro leitor cresce 120px (${after.readers[0].panel.width-before.readers[0].panel.width})`);
 assert.ok(near(before.readers[1].panel.width-after.readers[1].panel.width,120,3),'divisória dos leitores: o segundo cede o espaço');
 assertLayout(after,'depois de arrastar a divisória dos leitores',{readers:2});

 /* Divisória do tutor: arrasta e usa o teclado. */
 before=after;
 await drag(page,page.locator('#divider'),-90);
 after=await layoutNow(page);
 assert.ok(near(after.sidebar.width-before.sidebar.width,90,3),`divisória do tutor: a coluna cresce 90px (${after.sidebar.width-before.sidebar.width})`);
 assertLayout(after,'depois de arrastar a divisória do tutor',{readers:2});
 await page.locator('#divider').focus();
 await page.keyboard.press('ArrowRight');
 const keyed=await layoutNow(page);
 assert.ok(keyed.sidebar.width<after.sidebar.width,'divisória do tutor: a seta move pelo teclado');
 assertLayout(keyed,'depois de mover a divisória pelo teclado',{readers:2});

 /* Chat lateral no lugar do segundo leitor: mesmo plano, colado. */
 await openSidechat(page);
 assertLayout(await layoutNow(page),'dois leitores com chat lateral',{readers:1,oneLine:true});
 await shot(page,'dois-leitores-claro-1440x900-chat-lateral.png');

 /* Leitor minimizado: vira uma faixa estreita na altura da coluna, sem cortar
    nada, e o outro leitor fica com a largura (e a página o acompanha). */
 await page.locator('#sidechat-close').click();
 await page.waitForFunction(()=>document.querySelectorAll('#pdf-grid .pdf-panel:not([hidden])').length===2);
 const secondOpen=(await layoutNow(page)).readers[1];
 await moreClick(first,'.collapse');
 const minimized=await layoutNow(page),[strip,other]=minimized.readers;
 assert.ok(strip.panel.width>=28&&strip.panel.width<=40,`leitor minimizado: faixa estreita (${strip.panel.width}px)`);
 assert.ok(strip.panel.height>200&&near(strip.panel.height,other.panel.height,1),`leitor minimizado: a faixa tem a altura do leitor ao lado (${strip.panel.height})`);
 assert.ok(near(strip.panel.left,0)&&near(strip.panel.top,other.panel.top),'leitor minimizado: a faixa encosta no canto da coluna');
 assert.deepEqual(minimized.offscreen,[],'leitor minimizado: nenhum controle cortado');
 assert.ok(other.panel.width>secondOpen.panel.width+100,'leitor minimizado: o outro leitor ganha a largura');
 assert.ok(near(other.panel.right,minimized.references.right),'leitor minimizado: o outro leitor encosta na linha do tutor');
 assertFill(other,'leitor ao lado do minimizado');
 await shot(page,'dois-leitores-claro-1440x900-minimizado.png');
 await moreClick(first,'.collapse');
 assertLayout(await layoutNow(page),'depois de restaurar o leitor',{readers:2});

 /* Tutor recolhido: os leitores continuam colados à coluna que sobra e o
    botão de reabrir fica à vista, sem cobrir controle nenhum. */
 await tutorMore(page,'#chat-collapse').click();
 await page.waitForFunction(()=>document.body.classList.contains('chat-collapsed'));
 assertLayout(await layoutNow(page),'tutor recolhido',{readers:2});
 const restore=await page.locator('#chat-restore').evaluate(el=>{
  const r=el.getBoundingClientRect(),hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
  const covers=[...document.querySelectorAll('header button,main button,main select,main input,main textarea')].filter(other=>{
   const o=other.getBoundingClientRect();
   return other!==el&&o.width>0&&o.height>0&&o.left<r.right&&o.right>r.left&&o.top<r.bottom&&o.bottom>r.top;
  }).map(other=>other.id||other.className||other.tagName);
  return {onTop:hit===el,inside:r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight,covers};
 });
 assert.deepEqual(restore,{onTop:true,inside:true,covers:[]},'tutor recolhido: o botão de reabrir fica à vista e não cobre controles');
 await shot(page,'dois-leitores-claro-1440x900-tutor-recolhido.png');
 await page.locator('#chat-restore').click();
 await page.waitForFunction(()=>!document.body.classList.contains('chat-collapsed'));
 assertLayout(await layoutNow(page),'tutor de volta',{readers:2});

 assert.deepEqual(errors,[]);
 console.log('PASS: dois leitores colados, barras de 44/40px, recuo de 12px, PDF na largura, zoom, giro, divisórias, leitor minimizado e tutor recolhido');
});

await withArtifacts('layout-um-leitor',async ctx=>{
 const {page,errors}=await openDesk(ctx,'layout-um',{two:false});
 await assertEveryThemeAndSize(ctx,page,'um leitor',1);

 /* Um leitor com o chat lateral ao lado, na janela mínima. */
 await openSidechat(page);
 assertLayout(await layoutNow(page),'um leitor com chat lateral 900x650',{readers:1});
 await shot(page,'um-leitor-escuro-900x650-chat-lateral.png');

 assert.deepEqual(errors,[]);
 console.log('PASS: um leitor colado ao tutor, PDF na largura, com e sem chat lateral');
});

console.log('Screenshots:',SHOT_DIR);
