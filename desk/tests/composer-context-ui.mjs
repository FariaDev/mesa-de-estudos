// node tests/composer-context-ui.mjs — Mais opções → Contexto (#123), na janela.
// O resumo do que vai junto (matéria, PDFs e páginas, questão e .xopp) e a
// edição do contexto de estudo deixaram o composer e moram no submenu. Cobre o
// certo para um PDF, vários e nenhum, nos dois tamanhos, o acompanhamento da
// página, o caminho de teclado até a edição, o medidor e os demais itens do
// menu. Sem Pi e sem modelo real: o motor é o `fake-opencode.mjs`.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
 withArtifacts,newRuntime,seedCourse,writeConfigJson,writeDeskJson,launchDesk,tinyPdf,tinyPdfPages,
 freezeMotion,resizeWindow,reviewShot,screenshotDirectory,insideHidden
} from './helpers.mjs';
import {nextFrames} from './waits.mjs';

const FAKE_OPENCODE=path.resolve(import.meta.dirname,'fake-opencode.mjs');
const out=screenshotDirectory('composer-context');
const rect=(page,selector)=>page.evaluate(sel=>{const r=document.querySelector(sel)?.getBoundingClientRect();return r&&{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};},selector);
const inside=(box,outer,note)=>assert.ok(box&&box.left>=outer.left-0.5&&box.top>=outer.top-0.5&&box.right<=outer.right+0.5&&box.bottom<=outer.bottom+0.5,`${note}: ${JSON.stringify(box)} dentro de ${JSON.stringify(outer)}`);
const summaryText=page=>page.locator('#context-summary').textContent();

async function openContext(page){
 const more=page.locator('#chat-more-pop');
 if(await insideHidden(more))await page.locator('#chat-more').click();
 await more.waitFor({state:'visible'});
 const submenu=page.locator('#more-context-menu');
 if(await insideHidden(submenu))await page.locator('#more-context').click();
 await submenu.waitFor({state:'visible'});
}
async function closeMenus(page){
 for(let i=0;i<2&&!(await insideHidden(page.locator('#chat-more-pop')));i++)await page.keyboard.press('Escape');
 await page.locator('#chat-more-pop').waitFor({state:'hidden'});
}

await withArtifacts('composer-context',async ctx=>{
 const runtime=ctx.runtime=newRuntime('composer-context');
 const course=seedCourse(runtime,'calc');
 const one=path.join(course,'Limites.pdf');
 const two=path.join(course,'Formulario.pdf');
 fs.writeFileSync(one,tinyPdfPages(5,'Limites'));
 fs.writeFileSync(two,tinyPdf('Formulas'));
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'calc',name:'Cálculo I',path:course}]});
 writeDeskJson(runtime,{courseId:'calc',courseStates:{calc:{pdfs:[{path:one,page:3},{path:two,page:1}],study:{title:'',xopp:''}}}});
 fs.chmodSync(FAKE_OPENCODE,0o755);
 const app=ctx.app=await launchDesk({runtime,pi:false,env:{LEARNING_DESK_OPENCODE:FAKE_OPENCODE}});
 const page=await app.firstWindow();
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.waitForSelector('#composer');
 await page.waitForFunction(()=>document.querySelector('#context-summary')?.textContent.includes('Limites.pdf'));
 await resizeWindow(app,page,1440,900);
 await page.evaluate(async()=>{const state=await import('./src/state.mjs');state.S.panels[0].page=3;state.updateContextSummary();});
 await freezeMotion(page);

 /* 1. Vários PDFs: matéria e uma pílula por material, com a página. */
 assert.match(await summaryText(page),/Cálculo I/,'a matéria vai no resumo');
 assert.match(await summaryText(page),/Limites\.pdf p\.3/,'o primeiro PDF vai com a página');
 assert.match(await summaryText(page),/Formulario\.pdf p\.1/,'o segundo PDF também aparece');
 assert.equal(await page.locator('#context-summary>.goes-course').count(),1,'a matéria é a primeira pílula');

 /* 2. O resumo acompanha a página do leitor. */
 await page.evaluate(async()=>{const state=await import('./src/state.mjs');state.S.panels[0].page=5;state.updateContextSummary();});
 assert.match(await summaryText(page),/Limites\.pdf p\.5/,'o resumo acompanha a página do PDF');

 /* 3. Referências desligadas refletem no resumo; ligadas, os PDFs voltam. */
 await page.locator('#include-refs').click();
 assert.equal(await page.locator('#include-refs').getAttribute('aria-pressed'),'false');
 assert.match(await summaryText(page),/Referências desligadas/,'desligar o livro diz que os PDFs não vão');
 assert.doesNotMatch(await summaryText(page),/Limites\.pdf/,'desligado, nenhum material é listado');
 await page.locator('#include-refs').click();
 assert.match(await summaryText(page),/Limites\.pdf p\.5/,'ligado de novo, os materiais voltam');

 /* 4. Um PDF e nenhum: o resumo não inventa material. */
 await page.evaluate(async()=>{const state=await import('./src/state.mjs');state.S.panels[1].path='';state.updateContextSummary();});
 assert.match(await summaryText(page),/Limites\.pdf p\.5/,'um PDF só lista o que está aberto');
 assert.doesNotMatch(await summaryText(page),/Formulario\.pdf/,'o PDF fechado sai do resumo');
 await page.evaluate(async()=>{const state=await import('./src/state.mjs');state.S.panels[0].path='';state.updateContextSummary();});
 assert.doesNotMatch(await summaryText(page),/\.pdf/,'sem material, nenhum PDF aparece');
 await page.evaluate(async({one,two})=>{const state=await import('./src/state.mjs');state.S.panels[0].path=one;state.S.panels[0].page=3;state.S.panels[1].path=two;state.S.panels[1].page=1;state.updateContextSummary();},{one,two});

 /* 5. O submenu mostra o resumo, a edição, o medidor e os demais itens. */
 await openContext(page);
 assert.equal(await page.locator('#more-context-menu #context-summary').count(),1,'o resumo mora no submenu');
 assert.equal(await page.locator('#more-context-menu #more-context-what').count(),1,'o bloco do que vai junto existe');
 assert.equal(await page.locator('#more-context-menu #study-context').isVisible(),true,'a edição do contexto está à vista');
 assert.equal(await page.locator('#more-context-menu #context-pop-refs').isVisible(),true,'a nota das referências acompanha a edição');
 assert.equal(await page.locator('#more-context-menu #more-context-what #context-summary').count(),1,'o resumo vem antes do medidor');
 assert.equal(await page.locator('#more-context-slot #ctx-meter').count(),1,'o medidor vivo continua no submenu');
 for(const id of ['#more-auto-compact','#more-compact-now'])assert.equal(await page.locator(`${id}`).count(),1,`${id} continua no submenu`);
 for(const id of ['#end-day','#export-chat','#chat-collapse'])assert.equal(await page.locator(`#chat-more-pop ${id}`).count(),1,`${id} continua no Mais opções`);
 inside(await rect(page,'#more-context-menu'),{left:0,top:0,right:1440,bottom:900},'1440×900 submenu');
 await reviewShot(page,out,'contexto-varios-claro-1440.png');
 await closeMenus(page);

 /* 6. Teclado: ↓ abre o Mais opções, → abre o Contexto e Tab chega à edição. */
 await page.locator('#chat-more').focus();
 await page.keyboard.press('ArrowDown');
 await page.waitForFunction(()=>!document.querySelector('#chat-more-pop').hidden);
 assert.equal(await page.evaluate(()=>document.activeElement?.id),'more-context','a seta para baixo entra no Mais opções');
 await page.keyboard.press('ArrowRight');
 await page.waitForFunction(()=>!document.querySelector('#more-context-menu').hidden);
 let focused='';
 for(let i=0;i<6;i++){
  focused=await page.evaluate(()=>document.activeElement?.id);
  if(focused==='exercise-title')break;
  await page.keyboard.press('Tab');
 }
 assert.equal(focused,'exercise-title','o Tab chega ao campo da lista/questão');
 assert.equal(await page.locator('#exercise-title').getAttribute('aria-label'),'Lista ou questão ativa','o campo tem nome acessível');
 assert.equal(await page.locator('#more-context').getAttribute('aria-controls'),'more-context-menu','o gatilho aponta para o submenu');
 await page.keyboard.type('Lista 4 · q.9');
 await page.waitForFunction(()=>document.querySelector('#context-summary').textContent.includes('Lista 4 · q.9'));
 assert.match(await summaryText(page),/Lista 4 · q\.9/,'digitar no campo atualiza o resumo na hora');
 await page.keyboard.press('Escape');
 assert.equal(await page.evaluate(()=>document.querySelector('#more-context-menu').hidden),true,'Esc fecha só o submenu');
 await page.keyboard.press('Escape');
 await page.locator('#chat-more-pop').waitFor({state:'hidden'});
 const saved=await page.evaluate(async()=>{const state=await import('./src/state.mjs');return state.studySnapshot();});
 assert.equal(saved.title,'Lista 4 · q.9','a edição é a questão ativa da sessão');

 /* 7. Janela pequena: o mesmo submenu cabe e continua editável. */
 await resizeWindow(app,page,900,650);
 await nextFrames(page,2);
 await openContext(page);
 inside(await rect(page,'#more-context-menu'),{left:0,top:0,right:900,bottom:650},'900×650 submenu');
 assert.equal(await page.locator('#study-context').isVisible(),true,'na janela pequena a edição continua à vista');
 /* Flag `studyContext` desligada: nada de bloco com borda e sem o que editar. */
 await page.evaluate(()=>{document.querySelector('#study-context').hidden=true;});
 assert.equal(await page.locator('#more-context-edit').isVisible(),false,'sem contexto de estudo o bloco de edição some');
 await page.evaluate(()=>{document.querySelector('#study-context').hidden=false;});
 assert.match(await summaryText(page),/Cálculo I/,'o resumo continua correto na janela pequena');
 assert.match(await summaryText(page),/Limites\.pdf p\.3/,'e acompanha a página');
 await page.evaluate(async()=>{const state=await import('./src/state.mjs');state.S.panels[1].path='';state.updateContextSummary();});
 assert.match(await summaryText(page),/Limites\.pdf p\.3/,'na janela pequena, um PDF só lista o aberto');
 assert.doesNotMatch(await summaryText(page),/Formulario\.pdf/,'o PDF fechado continua fora');
 await page.evaluate(async()=>{const state=await import('./src/state.mjs');state.S.panels[0].path='';state.updateContextSummary();});
 assert.doesNotMatch(await summaryText(page),/\.pdf/,'na janela pequena, sem material nenhum PDF aparece');
 await page.evaluate(async({one,two})=>{const state=await import('./src/state.mjs');state.S.panels[0].path=one;state.S.panels[0].page=3;state.S.panels[1].path=two;state.S.panels[1].page=1;state.updateContextSummary();},{one,two});
 await reviewShot(page,out,'contexto-varios-claro-900.png');
 await closeMenus(page);

 assert.deepEqual(errors,[],'sem erro de página');
});
console.log('ok composer-context-ui');
