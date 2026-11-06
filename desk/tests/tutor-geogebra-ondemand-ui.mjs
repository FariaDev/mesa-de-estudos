// node tests/tutor-geogebra-ondemand-ui.mjs — GeoGebra sob demanda e quadro limpo por uso (#53), na janela.
// O OpenCode de mentira chama a ponte REAL do GeoGebra pelo MCP; o applet é a página
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
 const promptLog=path.join(runtime,'prompts.jsonl'),mcpLog=path.join(runtime,'mcp-ggb.log');
 const calls=[
  {name:'geogebra',input:{action:'run',command:'A=(1,2)'}},
  {name:'geogebra',input:{action:'run',command:'B=(3,3)'}},
  {name:'geogebra',input:{action:'state'}},
  {name:'geogebra',input:{action:'run',command:'C=(0,0)',continuar:true}},
 ];
 const page_=path.join(DESK,'tests/fixtures/fake-ggb.html');
 ctx.app=await launchDesk({runtime,env:{LEARNING_DESK_GGB_PAGE:page_,FAKE_OPENCODE_QUEUE_LOG:promptLog,FAKE_OPENCODE_MCP_CALLS:JSON.stringify(calls),FAKE_OPENCODE_MCP_LOG:mcpLog}});
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
 const answers=()=>{try{return fs.readFileSync(mcpLog,'utf8').trim().split('\n').filter(Boolean).map(line=>JSON.parse(line).result);}catch{return [];}};
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
  return list[list.length-1];
 };
 const back=page.locator('#ggb-back');
 const backHidden=()=>back.evaluate(el=>el.hidden);

 /* 0. A aba vazia não abre muda: a barra diz que está carregando (A4). */
 await page.locator('#course-tabs [data-id="geogebra"]').click();
 await page.waitForFunction(()=>document.querySelector('#references').classList.contains('ggb'),undefined,{timeout:10000});
 assert.equal(await page.locator('#ggb-board-note').isVisible(),true,'a barra espelha o carregamento');
 assert.match(await page.locator('#ggb-board-note').textContent(),/Carregando|Loading/,'a barra diz que está carregando');
 await page.waitForFunction(()=>document.querySelector('#ggb-board-note').hidden,undefined,{timeout:15000});
 await page.locator('#course-tabs [data-id="calc"]').click();
 await page.waitForFunction(()=>!document.querySelector('#references').classList.contains('ggb'),undefined,{timeout:10000});

 /* 1. Aba fechada: o pedido ao geogebra abre o applet sozinho e roda o comando. */
 assert.equal(await page.evaluate(()=>document.querySelector('#references').classList.contains('ggb')),false,'começa com a aba GeoGebra fechada');
 let answer=await ask('ggb: A=(1,2)');
 assert.doesNotMatch(answer,/indisponível|recusou/i,`o pedido não falha com a aba fechada (${answer})`);
 assert.match(answer,/Comando aceito pelo GeoGebra/,'o comando rodou');
 await page.waitForFunction(()=>document.querySelector('#references').classList.contains('ggb'),undefined,{timeout:10000});
 assert.deepEqual(await objects(),['A'],'o applet foi aberto e tem a construção do tutor');
 const sent=fs.readFileSync(promptLog,'utf8');
 assert.match(sent,/Ferramenta pedida na Mesa: geogebra/,'a menção chegou ao tutor como instrução');
 assert.equal(await backHidden(),true,'primeiro uso: não há construção anterior para voltar');
 assert.doesNotMatch(await page.locator('#messages .message.user .body').first().textContent(),/Ferramenta pedida/,'o balão do aluno não mostra a instrução');

 /* 2. O aluno desenha; o pedido seguinte começa vazio e a construção do aluno fica guardada. */
 await inApplet('window.ggbApplet.evalCommand("S=(5,5)")');
 assert.deepEqual(await objects(),['A','S'],'o aluno acrescentou um objeto');
 answer=await ask('ggb: B=(3,3)');
 assert.match(answer,/Comando aceito pelo GeoGebra/,'o segundo comando rodou');
 assert.match(answer,/quadro começou vazio.*construção do aluno/s,'a resposta diz que o quadro foi limpo e guardou a construção do aluno');
 assert.deepEqual(await objects(),['B'],'o segundo uso começa com o quadro vazio');
 await page.waitForFunction(()=>!document.querySelector('#ggb-back').hidden,undefined,{timeout:5000});
 await reviewShot(page,out,'depois-do-segundo-uso.png');

 /* 3. Ler não limpa; continuar mantém. */
 answer=await ask('ggb-estado');
 assert.match(answer,/Objetos atuais/,'ler o estado funciona');
 assert.deepEqual(await objects(),['B'],'ler não limpa o quadro');
 answer=await ask('ggb-continuar: C=(0,0)',{chip:false});
 assert.deepEqual(await objects(),['B','C'],'«continuar» acrescenta sem limpar');
 assert.doesNotMatch(answer,/quadro começou vazio/,'sem limpeza quando continua');

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
