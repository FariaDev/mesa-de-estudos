// node tests/composer-mentions-ui.mjs — menções `@` das ferramentas do tutor (#53), na janela.
// Cobre: `@` abre a lista curta (ícone, nome, uma linha), ↑↓ com wrap, Esc fecha sem apagar o
// texto, o filtro pelo nome, ⏎ vira chip (o `@trecho` sai do campo), o × tira o chip, o teto de
// três chips, e a mensagem enviada leva a instrução ao tutor sem mostrá-la no balão do aluno.
// Nos dois temas, em 1440×900 e 900×650; capturas só com MESA_REVIEW_SHOTS.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
 withArtifacts,newRuntime,seedCourse,writeConfigJson,writeDeskJson,launchDesk,statusOnline,tinyPdf,
 reviewShot,screenshotDirectory,setTheme,freezeMotion,resizeWindow,DESK
} from './helpers.mjs';
import {layoutStable,nextFrames,pollUntil} from './waits.mjs';

const out=screenshotDirectory('composer-mentions');
const IDS=['geogebra','visualizar','atividade','pdf'];
const SIZES=[[1440,900],[900,650]];
const THEMES=['light','dark'];

const menuState=page=>page.evaluate(()=>{
 const menu=document.querySelector('#mention-menu');
 const rows=[...menu.querySelectorAll('.mention-item')].map(row=>({
  key:row.dataset.key,active:row.classList.contains('active'),selected:row.getAttribute('aria-selected'),
  name:row.querySelector('.slash-name')?.textContent||'',desc:row.querySelector('.slash-desc')?.textContent||'',
  icon:!!row.querySelector('.mention-icon svg'),
 }));
 const box=menu.getBoundingClientRect();
 return {hidden:menu.hidden,rows,box:{top:box.top,left:box.left,right:box.right,bottom:box.bottom},value:document.querySelector('#prompt').value};
});
const chipIds=page=>page.locator('#mention-chips .mention-chip').evaluateAll(chips=>chips.map(chip=>chip.dataset.tool));
const waitMenu=(page,hidden)=>page.waitForFunction(want=>document.querySelector('#mention-menu').hidden===want,hidden,{timeout:5000});

await withArtifacts('composer-mentions',async ctx=>{
 const runtime=ctx.runtime=newRuntime('mentions');
 const course=seedCourse(runtime,'calc');
 const pdf=path.join(course,'Limites.pdf');fs.writeFileSync(pdf,tinyPdf('Limites'));
 writeConfigJson(runtime,{runtimePath:runtime,vaultPath:runtime,courses:[{id:'calc',name:'Cálculo I',path:course}]});
 writeDeskJson(runtime,{courseId:'calc',courseStates:{calc:{pdfs:[{path:pdf,page:1}],study:{title:'',xopp:''}}}});
 const piLog=path.join(runtime,'pi-messages.log');
 const pi=path.join(DESK,'tests/fixtures/mesa-geogebra-pi.mjs');fs.chmodSync(pi,0o755);
 ctx.app=await launchDesk({runtime,env:{LEARNING_DESK_PI:pi,FAKE_PI_GGB_LOG:piLog}});
 const page=await ctx.app.firstWindow(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await resizeWindow(ctx.app,page,1440,900);
 await statusOnline(page);
 await freezeMotion(page);
 await page.evaluate(async()=>{await (await import('./src/state.mjs')).connect();});
 await page.waitForFunction(()=>!document.querySelector('#send').disabled,undefined,{timeout:30000});
 const field=page.locator('#prompt');

 for(const theme of THEMES)for(const [width,height] of SIZES){
  const label=`${theme} ${width}×${height}`;
  await resizeWindow(ctx.app,page,width,height);
  await setTheme(page,theme);
  await nextFrames(page,3);
  await field.fill('');

  /* `@` abre a lista curta, na ordem do catálogo, com ícone, nome e descrição. */
  await field.click();
  await page.keyboard.type('@');
  await waitMenu(page,false);
  await layoutStable(page,'#mention-menu');
  let state=await menuState(page);
  assert.deepEqual(state.rows.map(row=>row.key),IDS,`${label}: as quatro ferramentas, na ordem do catálogo`);
  assert.ok(state.rows.every(row=>row.icon&&row.name.startsWith('@')&&row.desc.length>0),`${label}: cada linha tem ícone, nome e descrição (${JSON.stringify(state.rows)})`);
  assert.equal(state.rows[0].active,true,`${label}: a primeira linha começa ativa`);
  assert.ok(state.box.top>=0&&state.box.left>=0&&state.box.right<=width&&state.box.bottom<=height,`${label}: o menu cabe na janela (${JSON.stringify(state.box)})`);
  const composerTop=await page.evaluate(()=>document.querySelector('#composer').getBoundingClientRect().top);
  assert.ok(state.box.bottom<=composerTop+1,`${label}: o menu abre acima da caixa (${state.box.bottom} > ${composerTop})`);
  await reviewShot(page,out,`menu-${theme}-${width}x${height}.png`);

  /* ↑↓ com wrap; Esc fecha e deixa o `@` no campo. */
  await page.keyboard.press('ArrowUp');
  assert.equal((await menuState(page)).rows.find(row=>row.active)?.key,'pdf',`${label}: ↑ na primeira volta à última`);
  await page.keyboard.press('ArrowDown');
  assert.equal((await menuState(page)).rows.find(row=>row.active)?.key,'geogebra',`${label}: ↓ na última volta à primeira`);
  await page.keyboard.press('ArrowDown');
  assert.equal((await menuState(page)).rows.find(row=>row.active)?.key,'visualizar',`${label}: ↓ avança`);
  await page.keyboard.press('Escape');
  await waitMenu(page,true);
  assert.equal(await field.inputValue(),'@',`${label}: Esc fecha sem apagar o texto`);
  assert.equal((await chipIds(page)).length,0,`${label}: Esc não cria chip`);

  /* Filtro pelo nome e ⏎: o chip entra, o `@trecho` sai e o texto do aluno fica. */
  await field.fill('Mostre isso @ge');
  await waitMenu(page,false);
  state=await menuState(page);
  assert.deepEqual(state.rows.map(row=>row.key),['geogebra'],`${label}: «@ge» filtra para o geogebra`);
  await page.keyboard.press('Enter');
  await waitMenu(page,true);
  assert.deepEqual(await chipIds(page),['geogebra'],`${label}: ⏎ insere o chip`);
  assert.equal(await field.inputValue(),'Mostre isso ',`${label}: o @trecho sai do campo e o texto do aluno fica`);
  await layoutStable(page,'#mention-chips');
  const chipFits=await page.evaluate(()=>{
   const chip=document.querySelector('#mention-chips .mention-chip').getBoundingClientRect(),box=document.querySelector('#composer-box').getBoundingClientRect();
   return chip.left>=box.left-0.5&&chip.right<=box.right+0.5&&chip.top>=box.top-0.5&&chip.bottom<=box.bottom+0.5&&chip.height>=16;
  });
  assert.ok(chipFits,`${label}: o chip fica dentro da caixa de mensagem`);
  await reviewShot(page,out,`chip-${theme}-${width}x${height}.png`);

  /* Teto de três e remoção pelo ×. */
  for(const name of ['visualizar','atividade','pdf']){
   await field.fill(`@${name}`);
   await waitMenu(page,false);
   await page.keyboard.press('Enter');
   await waitMenu(page,true);
  }
  assert.deepEqual(await chipIds(page),['geogebra','visualizar','atividade'],`${label}: no máximo três chips; o quarto é recusado`);
  await page.locator('#mention-chips .mention-chip[data-tool="visualizar"] .mention-chip-remove').click();
  assert.deepEqual(await chipIds(page),['geogebra','atividade'],`${label}: o × tira só aquele chip`);
  await page.locator('#mention-chips .mention-chip-remove').evaluateAll(buttons=>buttons.forEach(button=>button.click()));
  await pollUntil(()=>chipIds(page),ids=>ids.length===0,{what:'os chips saírem'});
  await field.fill('');
 }

 /* Enviada: a instrução vai ao tutor (idioma da tela), o balão do aluno só mostra o texto e os chips saem. */
 await resizeWindow(ctx.app,page,1440,900);
 await field.fill('@geogebra');
 await waitMenu(page,false);
 await page.keyboard.press('Enter');
 await field.fill('Explique a derivada de x².');
 await page.locator('#send').click();
 const received=await pollUntil(()=>{try{return fs.readFileSync(piLog,'utf8').trim().split('\n').filter(Boolean).map(line=>JSON.parse(line).message);}catch{return [];}},list=>list.length>0,{what:'a mensagem chegar ao Pi'});
 assert.match(received[0],/^Explique a derivada de x²\.\n\n\[Ferramenta pedida na Mesa: geogebra\]\n.*geogebra/,`a instrução vem logo depois do texto do aluno (${JSON.stringify(received[0])})`);
 await page.locator('#messages .message.user .body').first().waitFor();
 const bubble=await page.locator('#messages .message.user .body').first().textContent();
 assert.equal(bubble.trim(),'Explique a derivada de x².','o balão do aluno não mostra o bloco da menção');
 assert.deepEqual(await chipIds(page),[],'os chips saem com o envio');
 assert.deepEqual(errors,[],'sem erro de página');
});
console.log('composer-mentions-ui: PASS — @ lista as ferramentas, navega por teclado, vira chip, respeita o teto e envia a instrução sem poluir o balão (claro e escuro, 1440×900 e 900×650).');
