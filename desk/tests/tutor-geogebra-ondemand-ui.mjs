// node tests/tutor-geogebra-ondemand-ui.mjs — GeoGebra sob demanda e quadro limpo por uso (#53), na janela.
// O Pi de mentira (`mesa-geogebra-pi.mjs`) chama a ponte REAL do GeoGebra; o applet é a página
// falsa `fake-ggb.html` (sem internet), trocada pelo seam LEARNING_DESK_GGB_PAGE do modo de teste.
// Cobre: aba fechada → o pedido abre o applet e roda o comando; o segundo pedido começa com o
// quadro vazio (a construção do aluno fica guardada); «Voltar à construção anterior» restaura
// e troca; ler o estado nunca limpa; `continuar` mantém; nada disso aparece no balão do aluno.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
 withArtifacts,newRuntime,seedCourse,writeConfigJson,writeDeskJson,launchDesk,statusOnline,tinyPdf,
 reviewShot,screenshotDirectory,freezeMotion,resizeWindow,pageWindow,DESK
} from './helpers.mjs';
import {pollUntil} from './waits.mjs';

const out=screenshotDirectory('tutor-geogebra-ondemand');

await withArtifacts('tutor-geogebra-ondemand',async ctx=>{
 const runtime=ctx.runtime=newRuntime('ggb-ondemand');
 const course=seedCourse(runtime,'calc');
 const pdf=path.join(course,'Limites.pdf');fs.writeFileSync(pdf,tinyPdf('Limites'));
 writeConfigJson(runtime,{runtimePath:runtime,vaultPath:runtime,courses:[{id:'calc',name:'Cálculo I',path:course}]});
 writeDeskJson(runtime,{courseId:'calc',courseStates:{calc:{pdfs:[{path:pdf,page:1}],study:{title:'',xopp:''}}}});
 const piLog=path.join(runtime,'pi-messages.log'),piOut=path.join(runtime,'pi-ggb.log');
 const pi=path.join(DESK,'tests/fixtures/mesa-geogebra-pi.mjs');fs.chmodSync(pi,0o755);
 const page_=path.join(DESK,'tests/fixtures/fake-ggb.html');
 ctx.app=await launchDesk({runtime,env:{LEARNING_DESK_PI:pi,LEARNING_DESK_GGB_PAGE:page_,FAKE_PI_GGB_LOG:piLog,FAKE_PI_GGB_OUT:piOut}});
 const page=await ctx.app.firstWindow(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await resizeWindow(ctx.app,page,1440,900);
 await statusOnline(page);
 await freezeMotion(page);
 await page.evaluate(async()=>{await (await import('./src/state.mjs')).connect();});
 await page.waitForFunction(()=>!document.querySelector('#send').disabled,undefined,{timeout:30000});

 const win=await pageWindow(ctx.app,page);
 /* Roda código na página do applet falso (a view do GeoGebra, nunca a janela da Mesa). */
 const inApplet=code=>win.evaluate((bw,source)=>{
  const view=bw.contentView.children.find(child=>child.webContents&&child.webContents!==bw.webContents);
  return view?view.webContents.executeJavaScript(source):null;
 },code);
 const objects=async()=>String(await inApplet('window.ggbApplet?window.ggbApplet.getAllObjectNames():""')||'').split('\n').filter(Boolean).sort();
 const answers=()=>{try{return fs.readFileSync(piOut,'utf8').trim().split('\n').filter(Boolean).map(line=>JSON.parse(line));}catch{return [];}};
 const ask=async(text,{chip=true}={})=>{
  const before=answers().length;
  if(chip){
   await page.locator('#prompt').fill('@geogebra');
   await page.waitForFunction(()=>document.querySelector('#mention-menu').hidden===false,undefined,{timeout:5000});
   await page.keyboard.press('Enter');
  }
  await page.locator('#prompt').fill(text);
  await page.waitForFunction(()=>!document.querySelector('#send').disabled,undefined,{timeout:30000});
  await page.locator('#send').click();
  const list=await pollUntil(async()=>answers(),found=>found.length>before,{timeout:40000,what:`a resposta da ponte para «${text}»`});
  await page.waitForFunction(()=>document.querySelector('#stop').hidden,undefined,{timeout:30000});
  return list[list.length-1].answer;
 };
 const back=page.locator('#ggb-back');
 const backHidden=()=>back.evaluate(el=>el.hidden);

 /* 1. Aba fechada: o pedido ao geogebra abre o applet sozinho e roda o comando. */
 assert.equal(await page.evaluate(()=>document.querySelector('#references').classList.contains('ggb')),false,'começa com a aba GeoGebra fechada');
 let answer=await ask('ggb: A=(1,2)');
 assert.equal(answer.error,undefined,`o pedido não falha com a aba fechada (${JSON.stringify(answer)})`);
 assert.equal(answer.ok,true,'o comando rodou');
 await page.waitForFunction(()=>document.querySelector('#references').classList.contains('ggb'),undefined,{timeout:10000});
 assert.deepEqual(await objects(),['A'],'o applet foi aberto e tem a construção do tutor');
 const sent=fs.readFileSync(piLog,'utf8');
 assert.match(sent,/Ferramenta pedida na Mesa: geogebra/,'a menção chegou ao tutor como instrução');
 assert.equal(await backHidden(),true,'primeiro uso: não há construção anterior para voltar');
 assert.doesNotMatch(await page.locator('#messages .message.user .body').first().textContent(),/Ferramenta pedida/,'o balão do aluno não mostra a instrução');

 /* 2. O aluno desenha; o pedido seguinte começa vazio e a construção do aluno fica guardada. */
 await inApplet('window.ggbApplet.evalCommand("S=(5,5)")');
 assert.deepEqual(await objects(),['A','S'],'o aluno acrescentou um objeto');
 answer=await ask('ggb: B=(3,3)');
 assert.equal(answer.ok,true,'o segundo comando rodou');
 assert.equal(answer.board?.cleared,true,'a resposta diz que o quadro foi limpo');
 assert.equal(answer.board?.origin,'student','e que a construção guardada tinha mão do aluno');
 assert.deepEqual(await objects(),['B'],'o segundo uso começa com o quadro vazio');
 await page.waitForFunction(()=>!document.querySelector('#ggb-back').hidden,undefined,{timeout:5000});
 await reviewShot(page,out,'depois-do-segundo-uso.png');

 /* 3. Ler não limpa; continuar mantém. */
 answer=await ask('ggb-estado');
 assert.equal(answer.error,undefined,'ler o estado funciona');
 assert.deepEqual(await objects(),['B'],'ler não limpa o quadro');
 answer=await ask('ggb-continuar: C=(0,0)',{chip:false});
 assert.deepEqual(await objects(),['B','C'],'«continuar» acrescenta sem limpar');
 assert.equal(answer.board?.cleared,false,'sem limpeza quando continua');

 /* 4. Voltar restaura a construção do aluno (A e S) e guarda o que estava no quadro. */
 await back.click();
 await pollUntil(objects,names=>names.join()==='A,S',{what:'a construção anterior de volta (A, S)'});
 await page.waitForFunction(()=>/Construção anterior de volta/.test(document.querySelector('#ggb-board-note').textContent),undefined,{timeout:5000});
 assert.equal(await backHidden(),false,'depois de voltar, ainda dá para voltar à que saiu (troca)');
 await reviewShot(page,out,'depois-de-voltar.png');
 await back.click();
 await pollUntil(objects,names=>names.join()==='B,C',{what:'a troca devolve B e C'});
 assert.deepEqual(errors,[],'sem erro de página');
});
console.log('tutor-geogebra-ondemand-ui: PASS — o geogebra abre sozinho com a aba fechada, o segundo uso começa vazio, ler/continuar não limpam e «Voltar» restaura (e troca).');
