// node tests/model-picker-catalog-ui.mjs — o seletor de modelo com um catálogo
// grande (ajustes do seletor e do indicador): o Pi do usuário entrega ~390
// modelos do OpenRouter, mais xai, opencode-go, openai-codex e commandcode. Com
// o Pi de mentira em 450 modelos (`FAKE_PI_MANY_MODELS=450`, nomes no formato
// "Fabricante: Modelo"), confere na janela:
//   - o trilho: OpenAI Codex e xAI com o logo do dono, os sem logo com monograma, todos diferentes, com dica e nome acessível;
//   - o logo do fabricante em cada subgrupo do OpenRouter, ou o monograma;
//   - a ordem por nome dentro do grupo e os subgrupos por fabricante no OpenRouter,
//     sem o prefixo repetido nas linhas, e a busca pelo nome completo;
//   - a segunda linha: fatos do catálogo no grupo do provedor, o provedor nos mistos;
//   - os `:free` do OpenRouter no grupo Grátis, com selo e "sem informação de privacidade";
//   - a densidade (uns 10 modelos à vista em 1440×900, alvo de 24px ou mais);
//   - o tempo de abrir, de cada tecla na busca e dos quadros ao rolar.
// 1440×900 e 900×650, nos dois temas.
import assert from 'node:assert/strict';
import {
 withArtifacts,newRuntime,seedCourse,writeConfigJson,writeDeskJson,launchDesk,statusOnline,
 reviewShot,screenshotDirectory,setTheme,freezeMotion,resizeWindow,closeModelPop
} from './helpers.mjs';
import {layoutStable} from './waits.mjs';

const out=screenshotDirectory('model-picker-catalog');
const BUDGET_MS=50;
/* [id, nome, logo esperado ou '' para o monograma] (logos dos fabricantes) */
const USER_RAIL=[['openai-codex','OpenAI Codex','openai'],['xai','xAI','grok'],['opencode-go','OpenCode Go','opencode'],['commandcode','Command Code','commandcode']];

/* Abre o popover pelo clique e mede até a lista ter layout (paint síncrono + reflow). */
const openTimed=page=>page.evaluate(()=>{
 const started=performance.now();
 document.querySelector('#model-indicator').click();
 void document.querySelector('#model-list').offsetHeight;
 return performance.now()-started;
});
/* Cada tecla na busca: o `input` repinta a lista; o reflow forçado entra na conta. */
const typeTimed=(page,text)=>page.evaluate(word=>{
 const search=document.querySelector('#model-search'),times=[];
 search.value='';
 for(const char of word){
  const started=performance.now();
  search.value+=char;
  search.dispatchEvent(new Event('input',{bubbles:true}));
  void document.querySelector('#model-list').offsetHeight;
  times.push(performance.now()-started);
 }
 return times;
},text);
/* Rola a lista inteira, um passo por quadro, e devolve o maior intervalo entre quadros. */
const scrollFrames=page=>page.evaluate(async()=>{
 const list=document.querySelector('#model-list'),gaps=[];
 list.scrollTop=0;
 let last=await new Promise(requestAnimationFrame);
 while(list.scrollTop+list.clientHeight<list.scrollHeight-1){
  list.scrollTop+=120;
  const now=await new Promise(requestAnimationFrame);
  gaps.push(now-last);last=now;
 }
 return {frames:gaps.length,worst:Math.max(...gaps)};
});

await withArtifacts('model-picker-catalog',async ctx=>{
 const runtime=ctx.runtime=newRuntime('picker-catalog');
 const course=seedCourse(runtime,'calc');
 writeConfigJson(runtime,{runtimePath:runtime,vaultPath:runtime,courses:[{id:'calc',name:'Cálculo',path:course}]});
 writeDeskJson(runtime,{courseId:'calc'});
 const app=ctx.app=await launchDesk({runtime,env:{FAKE_PI_MANY_MODELS:'450',FAKE_PI_REASONING:'1'}});
 const page=await app.firstWindow();
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await resizeWindow(app,page,1440,900);
 await statusOnline(page);
 await freezeMotion(page);
 const timings=[];

 for(const [theme,width,height] of [['light',1440,900],['dark',1440,900],['light',900,650],['dark',900,650]]){
  const tag=`${theme==='light'?'claro':'escuro'}-${width}x${height}`;
  await setTheme(page,theme);
  await resizeWindow(app,page,width,height);
  await layoutStable(page,'#model-indicator');
  const open=await openTimed(page);
  await page.locator('#model-pop').waitFor({state:'visible'});
  assert.ok(await page.locator('#model-list [role="option"]').count()>=440,`${tag}: a lista traz o catálogo grande`);

  /* ---- trilho: logo ou monograma distinto, dica e nome acessível ---- */
  const rail=await page.locator('#model-rail .model-rail-item[data-kind="provider"]').evaluateAll(items=>items.map(item=>({tip:item.dataset.tip,label:item.getAttribute('aria-label'),html:item.innerHTML,brand:item.querySelector('svg')?.dataset.brand||'',mono:item.querySelector('.provider-mono')?.textContent||'',color:item.querySelector('.provider-mono')?getComputedStyle(item.querySelector('.provider-mono')).color:''})));
  const chips=USER_RAIL.map(([,name])=>rail.find(entry=>entry.tip===name));
  for(const [i,chip] of chips.entries()){
   assert.ok(chip,`${tag}: ${USER_RAIL[i][1]} está no trilho`);
   assert.equal(chip.label,USER_RAIL[i][1],`${tag}: o nome acessível diz o provedor`);
   assert.equal(chip.brand,USER_RAIL[i][2],`${tag}: ${USER_RAIL[i][1]} tem o logo certo (${chip.brand||'monograma'})`);
   if(USER_RAIL[i][2])continue;
   assert.ok(chip.mono,`${tag}: ${USER_RAIL[i][1]} tem monograma, não o ícone genérico`);
   assert.notEqual(chip.color,'rgba(0, 0, 0, 0)',`${tag}: o monograma tem cor`);
  }
  assert.equal(new Set(chips.map(chip=>chip.html)).size,chips.length,`${tag}: os chips do usuário não ficam iguais (${chips.map(chip=>chip.brand||chip.mono).join(', ')})`);

  /* ---- OpenRouter: subgrupos por fabricante, A–Z, sem o prefixo nas linhas ---- */
  const router=await page.evaluate(()=>{
   const group=[...document.querySelectorAll('#model-list .model-group[data-kind="provider"]')].find(box=>box.querySelector('.model-group-title')?.textContent==='OpenRouter');
   const sections=[...group.querySelectorAll('.model-section-title')].map(node=>node.querySelector('.model-section-name').textContent);
   const logos=Object.fromEntries([...group.querySelectorAll('.model-section-title')].map(node=>[node.querySelector('.model-section-name').textContent,node.querySelector('.model-section-logo svg')?.dataset.brand||node.querySelector('.model-section-logo .provider-mono')?.textContent||'']));
   const logoSize=group.querySelector('.model-section-logo svg')?.getBoundingClientRect().width||0;
   const first=[];
   for(let node=group.querySelector('.model-section-title')?.nextElementSibling;node&&node.matches('[role="option"]');node=node.nextElementSibling)first.push(node.querySelector('.model-row-name').textContent);
   const row=group.querySelector('[role="option"]');
   return {sections,logos,logoSize,first,meta:row.querySelector('.model-row-meta').textContent,provider:!!row.querySelector('.model-row-provider'),label:row.getAttribute('aria-label')||''};
  });
  const sorted=[...router.sections].sort((a,b)=>a.localeCompare(b,'pt-BR',{sensitivity:'base'}));
  assert.ok(router.sections.length>=10,`${tag}: o OpenRouter se divide por fabricante (${router.sections.length})`);
  assert.deepEqual(router.sections,sorted,`${tag}: fabricantes em ordem A–Z`);
  assert.equal(router.sections[0],'AI21',`${tag}: o primeiro fabricante é o primeiro A–Z`);
  assert.ok(router.first.every(name=>!name.includes(': ')),`${tag}: as linhas do subgrupo saem sem "Fabricante: " (${router.first.slice(0,3)})`);
  assert.deepEqual(router.first,[...router.first].sort((a,b)=>a.localeCompare(b,'pt-BR',{sensitivity:'base',numeric:true})),`${tag}: dentro do fabricante, por nome`);
  assert.match(router.label,/^AI21: /,`${tag}: o nome acessível da linha guarda o nome completo`);
  for(const [vendor,brand] of [['OpenAI','openai'],['xAI','grok'],['Meta','meta'],['Qwen','qwen'],['Moonshot AI','moonshot'],['Z.AI','zai'],['MiniMax','minimax'],['Amazon','nova'],['Microsoft','microsoft'],['Cohere','cohere'],['Perplexity','perplexity'],['NousResearch','nousresearch'],['Liquid','liquid'],['Inception','inception']])
   assert.equal(router.logos[vendor],brand,`${tag}: o subgrupo ${vendor} tem o logo do fabricante`);
  assert.equal(router.logos.Sao10K,'SK',`${tag}: fabricante sem logo fica com o monograma`);
  assert.equal(router.logoSize,12,`${tag}: o logo do subgrupo no tamanho do da linha`);
  assert.equal(router.provider,false,`${tag}: no grupo do provedor a segunda linha não repete o provedor`);
  assert.match(router.meta,/\d+ (mil|mi)/,`${tag}: a segunda linha diz a janela de contexto (${router.meta})`);
  assert.match(router.meta,/US\$/,`${tag}: e o preço do pago (${router.meta})`);

  /* ---- Grátis: os `:free` do OpenRouter com selo e política desconhecida ---- */
  const free=await page.evaluate(()=>{
   const rows=[...document.querySelectorAll('#model-list .model-group[data-kind="free"] [role="option"]')];
   const router=rows.filter(row=>JSON.parse(row.dataset.key)[0]==='openrouter');
   return {count:router.length,badge:router.every(row=>!!row.querySelector('.model-row-badge')),notes:router.slice(0,1).map(row=>row.querySelector('.model-row-meta').textContent)};
  });
  assert.ok(free.count>=40,`${tag}: os grátis do OpenRouter estão no grupo Grátis (${free.count})`);
  assert.equal(free.badge,true,`${tag}: todos com o selo`);
  assert.match(free.notes[0],/OpenRouter.*Sem informação de privacidade/,`${tag}: no grupo misto, o provedor e a política (${free.notes[0]})`);

  /* ---- densidade: linhas inteiras à vista e alvo de clique ---- */
  const density=await page.evaluate(()=>{
   const list=document.querySelector('#model-list'),box=list.getBoundingClientRect();
   const rows=[...list.querySelectorAll('[role="option"]')].map(row=>row.getBoundingClientRect());
   return {whole:rows.filter(r=>r.top>=box.top-0.5&&r.bottom<=box.bottom+0.5).length,height:Math.min(...rows.slice(0,20).map(r=>r.height))};
  });
  assert.ok(density.height>=24,`${tag}: alvo de clique de pelo menos 24px (${density.height}px)`);
  /* 48px por linha (o autor pediu folga, 2026-10-21): uns 9 à vista. */
  if(width===1440)assert.ok(density.whole>=8,`${tag}: cabem uns 9 modelos à vista (${density.whole})`);
  assert.ok(density.height>=46,`${tag}: linha com folga, não grudada (${density.height}px)`);
  await reviewShot(page,out,`${tag}-lista.png`);
  /* Os subgrupos do OpenRouter à vista, para a revisão dos logos dos fabricantes. */
  if(process.env.MESA_REVIEW_SHOTS){
   for(const vendor of ['OpenAI','xAI']){
    await page.evaluate(name=>new Promise(done=>{
     const title=[...document.querySelectorAll('#model-list .model-section-title')].find(node=>node.textContent.trim()===name);
     title?.scrollIntoView({block:'start'});
     requestAnimationFrame(()=>requestAnimationFrame(done));
    }),vendor);
    await reviewShot(page,out,`${tag}-fabricante-${vendor.toLowerCase()}.png`);
   }
  }

  /* ---- busca: pelo nome completo e pelo fabricante ---- */
  const keys=await typeTimed(page,'deepseek v4');
  const hits=await page.locator('#model-list [role="option"]').evaluateAll(rows=>rows.map(row=>row.getAttribute('aria-label')||row.querySelector('.model-row-name').textContent));
  assert.ok(hits.length>0&&hits.every(name=>/deepseek/i.test(name)),`${tag}: a busca acha pelo fabricante e pelo nome (${hits.slice(0,3)})`);
  await reviewShot(page,out,`${tag}-busca.png`);
  await typeTimed(page,'');
  await page.evaluate(()=>{const s=document.querySelector('#model-search');s.value='';s.dispatchEvent(new Event('input',{bubbles:true}));});
  const scroll=await scrollFrames(page);
  timings.push({tag,open,keyMax:Math.max(...keys),keyMean:keys.reduce((a,b)=>a+b,0)/keys.length,scrollWorst:scroll.worst,scrollFrames:scroll.frames});
  await closeModelPop(page);
 }

 for(const time of timings){
  console.log(`desempenho ${time.tag}: abrir ${time.open.toFixed(1)} ms; tecla média ${time.keyMean.toFixed(1)} ms, pior ${time.keyMax.toFixed(1)} ms; rolar ${time.scrollFrames} quadros, pior intervalo ${time.scrollWorst.toFixed(1)} ms`);
  assert.ok(time.open<=BUDGET_MS,`${time.tag}: abrir em até ${BUDGET_MS} ms (${time.open.toFixed(1)})`);
  assert.ok(time.keyMax<=BUDGET_MS,`${time.tag}: cada tecla em até ${BUDGET_MS} ms (${time.keyMax.toFixed(1)})`);
  assert.ok(time.scrollWorst<=BUDGET_MS,`${time.tag}: rolar sem quadro acima de ${BUDGET_MS} ms (${time.scrollWorst.toFixed(1)})`);
 }
 assert.deepEqual(errors,[],'nenhum erro de página');
 console.log('PASS model-picker-catalog-ui — capturas em',out);
});
