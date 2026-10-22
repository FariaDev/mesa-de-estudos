// node tests/model-picker-ui.mjs — o seletor de modelo organizado (#59), na janela:
// busca + lista com grupos por provedor, recentes no topo (guardados no
// desk.json, fora do config.json), teclado completo (↑↓ com volta, ⏎, Esc) e os
// papéis ARIA. Acabamento visual: superfície só (sem título nem bordas
// internas), logos no trilho, linhas em duas camadas, estrela de favorito
// (Favoritos no topo, no desk.json), faixa de esforço no rodapé e nenhuma linha
// cortada ao abrir. Mede nos dois temas, em 1440×900 e 900×650, e grava
// capturas só com MESA_REVIEW_SHOTS. O catálogo vem do Pi de mentira (FAKE_PI_MANY_MODELS).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
 withArtifacts,newRuntime,seedCourse,writeConfigJson,writeDeskJson,launchDesk,statusOnline,
 reviewShot,screenshotDirectory,setTheme,freezeMotion,openModelPop,closeModelPop,pickModel,modelRows,selectedModelKey,
 modelPickerLocked,indicatorText,resizeWindow,effortState
} from './helpers.mjs';
import {pollUntil,nextFrames} from './waits.mjs';

const out=screenshotDirectory('seletor-modelo');
const ENV={FAKE_PI_MANY_MODELS:'1',FAKE_PI_SECOND_MODEL:'1',FAKE_PI_REASONING:'1'};
const names=page=>modelRows(page).then(rows=>rows.map(row=>row.name));
const titles=page=>page.locator('#model-list .model-group-title').allTextContents();
const activeName=page=>page.evaluate(()=>{
 const id=document.querySelector('#model-search').getAttribute('aria-activedescendant');
 return id?document.getElementById(id)?.querySelector('.model-row-name')?.textContent||'':'';
});
const recentsOnDisk=runtime=>JSON.parse(fs.readFileSync(path.join(runtime,'desk.json'),'utf8')).modelRecents;
const favoritesOnDisk=runtime=>JSON.parse(fs.readFileSync(path.join(runtime,'desk.json'),'utf8')).modelFavorites;
const groupNames=(page,kind)=>page.locator(`#model-list .model-group[data-kind="${kind}"] .model-row-name`).allTextContents();
const railTitles=page=>page.locator('#model-rail .model-rail-item').evaluateAll(items=>items.map(item=>item.dataset.tip));

await withArtifacts('model-picker',async ctx=>{
 const runtime=ctx.runtime=newRuntime('modelpicker');
 const course=seedCourse(runtime,'calc');
 writeConfigJson(runtime,{runtimePath:runtime,vaultPath:runtime,courses:[{id:'calc',name:'Cálculo',path:course}]});
 writeDeskJson(runtime,{courseId:'calc'});
 let app=ctx.app=await launchDesk({runtime,env:ENV});
 let page=await app.firstWindow();
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await resizeWindow(app,page,1440,900);
 await statusOnline(page);
 await freezeMotion(page);

 /* ---- papéis e estrutura: combobox + listbox + grupos com título ---- */
 await openModelPop(page);
 assert.equal(await page.locator('select#model-select').count(),0,'o <select> nativo saiu');
 let search=page.locator('#model-search');
 assert.deepEqual(await search.evaluate(el=>[el.getAttribute('role'),el.getAttribute('aria-controls'),el.getAttribute('aria-autocomplete'),el.getAttribute('aria-expanded'),el.placeholder]),
  ['combobox','model-list','list','true','Buscar modelos…']);
 assert.equal(await page.locator('#model-list').getAttribute('role'),'listbox');
 assert.equal(await page.locator('#model-search').getAttribute('aria-label'),'Modelo','o "Modelo" é nome acessível, não título visível');
 assert.equal(await page.locator('#model-list').getAttribute('aria-label'),'Modelo');
 assert.equal(await page.locator('#model-label').count(),0);
 const surface=await page.evaluate(()=>{
  const style=selector=>getComputedStyle(document.querySelector(selector));
  return {picker:style('#model-picker').borderTopWidth,rail:style('#model-rail').borderRightWidth,popPad:style('#model-pop').paddingTop,
   width:Math.round(document.querySelector('#model-pop').getBoundingClientRect().width),scrollbar:style('#model-list').scrollbarWidth};
 });
 assert.ok(surface.width>=340&&surface.width<=360,`o popover largo, como o do T3 (${surface.width}px)`);
 assert.deepEqual({...surface,width:0},{picker:'0px',rail:'0px',popPad:'0px',width:0,scrollbar:'thin'},'uma superfície só, sem bordas internas e com barra fina');
 assert.deepEqual(await titles(page),['Anthropic','meu-provedor','OpenAI','test','xAI'],'um grupo por provedor, A–Z; o id desconhecido aparece cru');
 assert.equal(await page.locator('#model-list [role="group"]').count(),5);
 assert.equal(await page.locator('#model-list [role="group"]').first().getAttribute('aria-labelledby'),'model-group-0');
 assert.deepEqual(await names(page),['Sonnet 5','Modelo caseiro','GPT 5.5','Pi com visão','Pi de teste','Grok 4','Grok 4 Fast'],'dentro do grupo a ordem é por nome, sem caixa nem acento (ajustes do seletor)');
 assert.equal(await page.locator('#model-list [role="option"]').count(),7);
 assert.equal(await page.locator('#model-list [role="option"][aria-selected="true"]').count(),1,'uma linha só marcada como em uso');
 assert.equal(await selectedModelKey(page),JSON.stringify(['test','offline']),'a linha em uso é o modelo da sessão');
 assert.equal(await page.locator('#model-list .model-group[data-kind="recent"]').count(),0,'sem uso anterior, sem Recentes');
 assert.equal(await activeName(page),'Pi de teste','ao abrir, a linha ativa é a em uso');
 await reviewShot(page,out,'claro-1440x900-lista.png');

 /* ---- trilho de provedores (como o do T3 Code): uma entrada por grupo, pula até ele ---- */
 assert.deepEqual(await page.locator('#model-rail .model-rail-item').evaluateAll(items=>items.map(item=>[item.dataset.tip,item.getAttribute('aria-label'),item.textContent,item.querySelector('svg')?.dataset.brand||'monograma'])),
  [['Anthropic','Anthropic','','anthropic'],['meu-provedor','meu-provedor','MP','monograma'],['OpenAI','OpenAI','','openai'],['test','test','T','monograma'],['xAI','xAI','','grok']],'o trilho tem o logo do provedor (o xAI com o do Grok); sem logo, o monograma com as letras do nome; a dica e o nome acessível dizem o provedor (logos dos fabricantes)');
 assert.equal(await page.locator('#model-rail').getAttribute('aria-hidden'),'true','o trilho é só visual: os grupos já têm título');
 assert.equal(await page.locator('#model-rail .model-rail-item.active').getAttribute('data-tip'),'test','o trilho marca o grupo da linha ativa');
 /* duas camadas: o nome em cima; no grupo do provedor, os fatos do catálogo embaixo
    (o provedor já está no título, ajustes do seletor); a estrela à direita */
 assert.deepEqual(await page.locator(`#model-list [data-key='${JSON.stringify(['anthropic','sonnet-5'])}']`).evaluate(row=>[
  row.querySelector('.model-row-top .model-row-name')?.textContent,row.querySelector('.model-row-meta .model-row-provider')?.textContent??null,
  row.querySelector('.model-row-meta .model-row-note')?.textContent,!!row.querySelector('.model-row-star svg'),row.querySelector('.model-row-badge')]),
  ['Sonnet 5',null,'visão · raciocínio',true,null],'linha em duas camadas: no grupo do provedor, os fatos no lugar do nome dele; a estrela; sem selo (não é grátis)');
 const focusBefore=await page.evaluate(()=>document.activeElement?.id);
 await page.locator('#model-rail .model-rail-item[data-tip="xAI"]').click();
 assert.equal(await activeName(page),'Grok 4','clicar no provedor leva a linha ativa ao primeiro modelo dele');
 assert.equal(await page.locator('#model-rail .model-rail-item.active').getAttribute('data-group'),'4','o trilho marca o xAI (o hover troca o title pela dica da Mesa)');
 assert.equal(await page.evaluate(()=>{const list=document.querySelector('#model-list').getBoundingClientRect(),title=document.querySelector('#model-group-4').getBoundingClientRect();return title.top>=list.top-1&&title.bottom<=list.bottom+1;}),true,'o título do grupo fica à vista');
 assert.equal(await page.evaluate(()=>document.activeElement?.id),focusBefore,'clicar no trilho não rouba o foco');

 /* ---- estrela: liga e desliga o favorito, sem escolher o modelo ---- */
 const star=(provider,id)=>page.locator(`#model-list .model-group[data-kind="provider"] [data-key='${JSON.stringify([provider,id])}'] .model-row-star`);
 await star('xai','grok-4').click();
 await pollUntil(()=>titles(page),list=>list[0]==='Favoritos',{what:'o grupo Favoritos no topo'});
 assert.deepEqual(await groupNames(page,'favorite'),['Grok 4']);
 assert.equal((await railTitles(page))[0],'Favoritos','a estrela no topo do trilho');
 assert.equal(await page.locator('#model-rail .model-rail-item[data-kind="favorite"] svg').count(),1);
 assert.equal(await star('xai','grok-4').getAttribute('data-favorite'),'1','a estrela fica acesa');
 assert.match(await star('xai','grok-4').getAttribute('title'),/^Tirar dos favoritos \((⌘D|Ctrl\+D)\)$/,'a dica diz o atalho (#58)');
 assert.equal(await selectedModelKey(page),JSON.stringify(['test','offline']),'a estrela não troca o modelo');
 await pollUntil(()=>favoritesOnDisk(runtime),favorites=>favorites?.pi?.length===1,{what:'o favorito no desk.json'});
 assert.deepEqual(favoritesOnDisk(runtime),{pi:[['xai','grok-4']]});
 await star('anthropic','sonnet-5').click();
 await pollUntil(()=>groupNames(page,'favorite'),list=>list.join()==='Grok 4,Sonnet 5',{what:'favoritos na ordem em que foram marcados'});
 await star('anthropic','sonnet-5').click();
 await pollUntil(()=>groupNames(page,'favorite'),list=>list.join()==='Grok 4',{what:'desmarcar tira do grupo'});
 await pollUntil(()=>favoritesOnDisk(runtime),favorites=>favorites?.pi?.length===1,{what:'o desmarcado sai do desk.json'});
 assert.equal(Object.hasOwn(JSON.parse(fs.readFileSync(path.join(runtime,'config.json'),'utf8')),'modelFavorites'),false,'os favoritos não vão para o config.json');

 /* ---- estrela pelo teclado (#58): ⌘D/Ctrl+D na linha ativa, foco na busca ---- */
 const activeStar=()=>page.evaluate(()=>{
  const row=document.getElementById(document.querySelector('#model-search').getAttribute('aria-activedescendant')||'');
  const star=row?.querySelector('.model-row-star');
  return {name:row?.querySelector('.model-row-name')?.textContent||'',favorite:star?.dataset.favorite||'',described:document.getElementById(row?.getAttribute('aria-describedby')||'')?.getAttribute('aria-label')||'',hidden:star?.getAttribute('aria-hidden')||null};
 });
 const keySearch=page.locator('#model-search');
 await keySearch.focus();
 await keySearch.fill('GPT 5.5');
 await pollUntil(()=>activeName(page),name=>name==='GPT 5.5',{what:'a busca põe o GPT 5.5 na linha ativa'});
 let starState=await activeStar();
 assert.equal(starState.hidden,null,'a estrela não está mais escondida do leitor de tela');
 assert.match(starState.described,/^(⌘D|Ctrl\+D) favorita$/,'a linha descreve o estado e o atalho');
 await keySearch.press('ControlOrMeta+d');
 await pollUntil(()=>page.locator('#model-picker-status').textContent(),text=>text==='GPT 5.5 nos favoritos',{what:'o anúncio da estrela ligada'});
 starState=await activeStar();
 assert.equal(starState.name,'GPT 5.5','a linha ativa segue o mesmo modelo');
 assert.equal(starState.favorite,'1');
 assert.match(starState.described,/^Favorito; (⌘D|Ctrl\+D) tira dos favoritos$/);
 assert.equal(await page.evaluate(()=>document.activeElement?.id),'model-search','o foco fica na busca');
 await pollUntil(()=>favoritesOnDisk(runtime),favorites=>favorites?.pi?.length===2,{what:'o favorito do teclado no desk.json'});
 await keySearch.press('ControlOrMeta+d');
 await pollUntil(()=>page.locator('#model-picker-status').textContent(),text=>text==='GPT 5.5 fora dos favoritos',{what:'o anúncio da estrela desligada'});
 await pollUntil(()=>favoritesOnDisk(runtime),favorites=>favorites?.pi?.length===1,{what:'desmarcar pelo teclado sai do desk.json'});
 assert.equal(await keySearch.inputValue(),'GPT 5.5','o atalho não escreve na busca');
 await keySearch.fill('');
 await pollUntil(()=>selectedModelKey(page),key=>key===JSON.stringify(['test','offline']),{what:'o atalho não troca o modelo'});

 /* ---- clicar escolhe, mantém o popover aberto e põe o modelo nos recentes ---- */
 await pickModel(page,'openai','gpt-5.5');
 await pollUntil(()=>indicatorText(page),text=>text.startsWith('GPT 5.5'),{what:'o indicador com o modelo novo'});
 assert.equal(await page.locator('#model-pop').isVisible(),true,'escolher não fecha o popover (o esforço vem a seguir)');
 assert.equal(await selectedModelKey(page),JSON.stringify(['openai','gpt-5.5']));
 await pollUntil(()=>titles(page),list=>list.slice(0,2).join()==='Favoritos,Recentes',{what:'Recentes logo abaixo dos Favoritos'});
 assert.deepEqual(await page.locator('#model-list .model-group[data-kind="recent"] .model-row-name').allTextContents(),['GPT 5.5']);
 assert.equal(await page.locator('#model-list .model-group[data-kind="recent"] .model-row-provider').first().textContent(),'OpenAI','no grupo Recentes a linha diz o provedor');
 await pickModel(page,'xai','grok-4');
 await pollUntil(()=>indicatorText(page),text=>text.startsWith('Grok 4'),{what:'o segundo modelo'});
 await pollUntil(()=>page.locator('#model-list .model-group[data-kind="recent"] .model-row-name').allTextContents(),list=>list.join()==='Grok 4,GPT 5.5',{what:'recentes, do mais novo ao mais velho'});
 await pollUntil(()=>recentsOnDisk(runtime),recents=>recents?.pi?.[0]?.[1]==='grok-4',{what:'os recentes no desk.json'});
 assert.deepEqual(recentsOnDisk(runtime).pi,[['xai','grok-4'],['openai','gpt-5.5']]);
 assert.equal(Object.hasOwn(JSON.parse(fs.readFileSync(path.join(runtime,'config.json'),'utf8')),'modelRecents'),false,'os recentes não vão para o config.json');

 /* ---- busca: nome, id e provedor; sem acento nem caixa; Recentes saem ---- */
 await search.fill('GROK');
 assert.equal(await page.locator('#model-rail').isVisible(),false,'um grupo só: sem trilho');
 assert.deepEqual(await names(page),['Grok 4','Grok 4 Fast']);
 assert.deepEqual(await titles(page),['xAI'],'sem Recentes na busca; grupos sem resultado somem');
 await search.fill('openai gpt');
 assert.deepEqual(await names(page),['GPT 5.5']);
 await search.fill('caseiro');
 assert.deepEqual(await names(page),['Modelo caseiro']);
 await search.fill('zzz');
 assert.equal(await page.locator('#model-list [role="option"]').count(),0);
 assert.equal(await page.locator('#model-empty').isVisible(),true,'sem resultado: a mensagem aparece');
 assert.match(await page.locator('#model-empty').innerText(),/Nenhum modelo com “zzz”\./);
 assert.equal(await page.locator('#model-empty').getAttribute('role'),'status');
 await search.fill('');
 assert.equal(await page.locator('#model-empty').isHidden(),true);
 assert.equal((await names(page)).length>=8,true,'busca vazia traz tudo de volta (com os recentes repetidos no topo)');

 /* ---- faixa de esforço no rodapé: rádios, setas com volta, o indicador acompanha ---- */
 let effort=await effortState(page);
 assert.ok(effort.levels.length>=3&&!effort.locked,`a faixa traz os níveis do motor (${JSON.stringify(effort)})`);
 await page.locator('#effort-strip [aria-checked="true"]').focus();
 const startAt=effort.levels.indexOf(effort.value);
 await page.keyboard.press('ArrowRight');
 const nextLevel=effort.levels[(startAt+1)%effort.levels.length];
 await pollUntil(()=>effortState(page),state=>state.value===nextLevel&&!state.locked,{what:'→ escolhe o próximo nível'});
 assert.equal(await page.evaluate(()=>document.activeElement?.dataset.level),nextLevel,'o foco anda junto');
 assert.equal(await page.locator('#effort-strip [tabindex="0"]').count(),1,'foco itinerante: um só nível no Tab');
 await page.keyboard.press('Home');
 await pollUntil(()=>effortState(page),state=>state.value===effort.levels[0]&&!state.locked,{what:'Home vai ao primeiro'});
 await page.keyboard.press('ArrowLeft');
 await pollUntil(()=>effortState(page),state=>state.value===effort.levels.at(-1)&&!state.locked,{what:'← no começo volta ao fim'});
 await page.locator(`#effort-strip [data-level="${effort.value}"]`).click();
 await pollUntil(()=>effortState(page),state=>state.value===effort.value&&!state.locked,{what:'o clique devolve o nível de antes'});
 assert.equal(await page.locator('#model-pop').isVisible(),true,'mexer no esforço não fecha o popover');

 /* ---- teclado: ↑↓ com volta, ⏎ escolhe, Esc fecha e devolve o foco ---- */
 await closeModelPop(page);
 await page.locator('#model-indicator').focus();
 await page.keyboard.press('ArrowDown');
 await page.waitForFunction(()=>document.activeElement?.id==='model-search');
 assert.equal(await page.locator('#model-pop').isVisible(),true,'↓ no indicador abre o popover e entra na busca');
 assert.equal(await search.inputValue(),'','a busca abre limpa');
 await page.keyboard.type('grok');
 assert.equal(await activeName(page),'Grok 4','a primeira da busca fica ativa');
 await page.keyboard.press('ArrowDown');
 assert.equal(await activeName(page),'Grok 4 Fast');
 await page.keyboard.press('ArrowDown');
 assert.equal(await activeName(page),'Grok 4','↓ no fim volta ao começo');
 await page.keyboard.press('ArrowUp');
 assert.equal(await activeName(page),'Grok 4 Fast','↑ no começo volta ao fim');
 assert.equal(await page.evaluate(()=>document.activeElement.id),'model-search','o foco nunca sai da busca');
 assert.equal(await page.locator('#model-list .model-row.active').count(),1);
 await page.keyboard.press('Enter');
 await pollUntil(()=>indicatorText(page),text=>text.startsWith('Grok 4 Fast'),{what:'⏎ escolhe a linha ativa'});
 assert.equal(await page.locator('#model-pop').isVisible(),true);
 await page.keyboard.press('Escape');
 await page.locator('#model-pop').waitFor({state:'hidden'});
 assert.equal(await page.evaluate(()=>document.activeElement.id),'model-indicator','Esc devolve o foco ao indicador');
 await pollUntil(()=>recentsOnDisk(runtime),recents=>recents?.pi?.[0]?.[1]==='grok-4-fast',{what:'⏎ também entra nos recentes'});

 /* ---- reabrir o popover limpa a busca e deixa a linha em uso à vista ---- */
 await openModelPop(page);
 await search.fill('sonnet');
 await closeModelPop(page);
 await openModelPop(page);
 assert.equal(await search.inputValue(),'','reabrir limpa a busca');
 assert.equal(await activeName(page),'Grok 4 Fast');
 await closeModelPop(page);

 /* ---- depois de fechar e abrir o app, os recentes continuam ---- */
 await app.close();
 app=ctx.app=await launchDesk({runtime,env:ENV});
 page=await app.firstWindow();
 search=page.locator('#model-search');
 await resizeWindow(app,page,1440,900);
 await statusOnline(page);
 await openModelPop(page);
 await pollUntil(()=>page.locator('#model-list .model-group[data-kind="recent"] .model-row-name').allTextContents(),list=>list.join()==='Grok 4 Fast,Grok 4,GPT 5.5',{what:'recentes de volta depois de reabrir'});
 assert.deepEqual(await groupNames(page,'favorite'),['Grok 4'],'favoritos de volta depois de reabrir');

 /* ---- medidas: os dois temas, 1440×900 e 900×650 ---- */
 for(const theme of ['light','dark']){
  await setTheme(page,theme);
  for(const [width,height] of [[1440,900],[900,650]]){
   await resizeWindow(app,page,width,height);
   await closeModelPop(page);
   await openModelPop(page);
   await nextFrames(page,3);
   const got=await page.evaluate(()=>{
    const pop=document.querySelector('#model-pop').getBoundingClientRect(),list=document.querySelector('#model-list'),box=list.getBoundingClientRect();
    const inner=document.querySelector('#model-pop');
    const row=document.querySelector('#model-list .model-row').getBoundingClientRect();
    return {inside:pop.left>=-0.5&&pop.top>=-0.5&&pop.right<=window.innerWidth+0.5&&pop.bottom<=window.innerHeight+0.5,
     listShown:box.height>=60,listScrolls:list.scrollHeight>list.clientHeight,popScrollsAlone:inner.scrollHeight>inner.clientHeight+1,
     overflowX:list.scrollWidth>list.clientWidth+1,rowHeight:Math.round(row.height),searchHeight:Math.round(document.querySelector('#model-search').getBoundingClientRect().height)};
   });
   assert.equal(got.inside,true,`${theme} ${width}×${height}: o popover cabe na janela (${JSON.stringify(got)})`);
   assert.equal(got.listShown,true,`${theme} ${width}×${height}: a lista tem altura útil (${JSON.stringify(got)})`);
   assert.equal(got.popScrollsAlone,false,`${theme} ${width}×${height}: só a lista rola, não o popover (${JSON.stringify(got)})`);
   assert.equal(got.overflowX,false,`${theme} ${width}×${height}: sem rolagem lateral (${JSON.stringify(got)})`);
   assert.ok(got.rowHeight>=28,`${theme} ${width}×${height}: linha clicável (${got.rowHeight}px)`);
   /* a linha em uso fica à vista dentro da lista */
   const shown=await page.evaluate(()=>{const list=document.querySelector('#model-list').getBoundingClientRect(),row=document.querySelector('#model-list [aria-selected="true"]').getBoundingClientRect();return row.top>=list.top-1&&row.bottom<=list.bottom+1;});
   assert.equal(shown,true,`${theme} ${width}×${height}: a linha em uso está visível na lista`);
   const cut=await page.evaluate(()=>{
    const list=document.querySelector('#model-list'),box=list.getBoundingClientRect(),inset=parseFloat(getComputedStyle(list).paddingTop)||0;
    const line=box.top+inset;
    return [...list.querySelectorAll('.model-group-title,.model-row')].map(node=>node.getBoundingClientRect()).filter(r=>r.top<line-0.5&&r.bottom>line+0.5).length;
   });
   assert.equal(cut,0,`${theme} ${width}×${height}: ao abrir, nenhuma linha cortada no topo da lista`);
   await reviewShot(page,out,`${theme}-${width}x${height}-lista.png`);
   await search.fill('grok');
   await reviewShot(page,out,`${theme}-${width}x${height}-busca.png`);
   await search.fill('zzz');
   await reviewShot(page,out,`${theme}-${width}x${height}-sem-resultado.png`);
   await search.fill('');
  }
 }
 await closeModelPop(page);

 await resizeWindow(app,page,1440,900);
 assert.equal(await modelPickerLocked(page),false,'com o tutor ligado e ocioso, a lista não está travada');
 assert.deepEqual(errors,[],'nenhum erro de página');
 console.log('MODEL PICKER UI PASSED: grupos, recentes, busca, teclado, papéis ARIA, dois temas e dois tamanhos.');
});
