/* Diálogo "Montar PDF" com os modelos do tutor (ticket #39), medido na janela:
   o rascunho do tutor chega com `modelo`/`opcoes`, a troca de cartão refaz a
   prévia sem chamar o tutor nem mexer no texto, Cancelar descarta, Salvar
   lembra o modelo da sessão, e o diálogo cabe em 1440×900 e 900×650 nos dois
   temas. Conteúdo de exemplo inventado; sem material de curso. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {DESK,fakePiSource,launchDesk,withArtifacts,enterFree,screenshotDirectory,freeMenuClick,setTheme,freezeMotion} from './helpers.mjs';
import {layoutStable,nextFrames} from './waits.mjs';

const out=process.env.MESA_REVIEW_SHOTS?screenshotDirectory('pdf-models-dialog-ui'):'';
const markdown=`# Lista de exemplo — razões trigonométricas

## Enunciados

1. Calcule o valor de cada expressão:
   1. $\\sin 30^\\circ$
   2. $\\cos 60^\\circ$
   3. $\\tan 45^\\circ$
   4. $\\sin 90^\\circ$
2. Resolva a equação $2x+3=11$ e verifique a resposta.
3. Mostre que $\\sin^2 x+\\cos^2 x=1$ para todo $x$.

## Gabarito

1. a) $1/2$ b) $1/2$ c) $1$ d) $1$
2. $x=4$
3. Consequência do teorema de Pitágoras.`;

await withArtifacts('pdf-models-dialog-ui',async ctx=>{
 const runtime=ctx.runtime=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'mesa-pdf-models-ui-')));
 const demo=path.join(runtime,'pi-models-demo.mjs');
 const source=fakePiSource(),marker="else if(/quiz/i.test(studentText(e.message)))emitQuiz(e.message);";assert.ok(source.includes(marker));
 const branch=`else if(String(e.message).includes('Prepare um PDF na Mesa')){
 streaming=true;emit({type:'agent_start'});
 (async()=>{
  try{
   const {createTutorPdf}=await import(${JSON.stringify(pathToFileURL(path.join(DESK,'src/extensions/tutor-pdf/client.mjs')).href)});
   const result=await createTutorPdf(JSON.parse(process.env.LEARNING_DESK_MATERIAL_BRIDGE),{title:'Lista de exemplo',markdown:${JSON.stringify(markdown)},modelo:'lista',opcoes:{colunas:'auto',gabarito:true}});
   fs.writeFileSync(${JSON.stringify(path.join(runtime,'tool-result.json'))},JSON.stringify(result));
   streaming=false;emitText('Preparei a **Lista de exemplo**. Revise a prévia e clique em Salvar PDF e abrir.');
  }catch(error){streaming=false;emitText('Falha: '+error.message);}
 })();
 } ${marker}`;
 fs.writeFileSync(demo,source.replace(marker,()=>branch).replace('function emitText(text){',"function emitText(text){\n if(session)fs.appendFileSync(session,JSON.stringify({type:'message',message:{role:'assistant',content:[{type:'text',text}]}})+'\\n');"));fs.chmodSync(demo,0o755);
 fs.writeFileSync(path.join(runtime,'config.json'),JSON.stringify({runtimePath:runtime,vaultPath:runtime,courses:[],desk:{title:'Mesa de Estudos',panels:[{label:'Material',prefer:[],toggle:''},{label:'Formulário',prefer:[],toggle:'Formulário'}]}}));
 ctx.app=await launchDesk({runtime,env:{LEARNING_DESK_PI:demo}});
 const page=await ctx.app.firstWindow(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await enterFree(page);
 /* A janela da página, não a primeira da lista: a prévia do PDF abre uma
    janela escondida que pode vir antes e levar o redimensionamento. */
 const win=await ctx.app.browserWindow(page);
 const setSize=(w,h)=>win.evaluate((bw,[w,h])=>bw.setSize(w,h),[w,h]);
 await setSize(1440,900);
 await page.evaluate(async()=>{const {S,connect}=await import('./src/state.mjs');window.__mesaState=S;if(!S.connected)await connect();});
 await page.waitForFunction(()=>window.__mesaState.connected&&!window.__mesaState.busy);
 await freezeMotion(page);
 const shot=async name=>{if(!out)return;await nextFrames(page,4);await page.screenshot({path:path.join(out,name+'.png')});};

 /* ---------- o tutor pede a Lista: o diálogo abre nela ---------- */
 await page.locator('#free-tutor-pdf').click();
 await page.locator('#tutor-pdf-request').fill('Uma lista curta de trigonometria.');
 await page.locator('#tutor-pdf-send').click();
 await page.waitForFunction(()=>document.querySelector('#free-pdf-dialog').open&&!window.__mesaState.busy,undefined,{timeout:30000});
 assert.equal(JSON.parse(fs.readFileSync(path.join(runtime,'tool-result.json'),'utf8')).prepared,true);

 const state=()=>page.evaluate(()=>{
  const checked=document.querySelector('#pdf-model-strip [role=radio][aria-checked=true]');
  const wrapper=document.querySelector('#free-pdf-preview .pdf-model');
  return {
   group:document.querySelector('#pdf-model-strip').getAttribute('role'),
   cards:[...document.querySelectorAll('#pdf-model-strip [role=radio]')].map(card=>card.dataset.model),
   checked:checked?.dataset.model||'',
   preview:wrapper?.dataset.model||'livre',
   status:document.querySelector('#free-pdf-status').textContent,
   pages:document.querySelector('#free-pdf-page-count').textContent,
   text:document.querySelector('#free-pdf-content').value,
   messages:document.querySelectorAll('#messages article.message').length,
   busy:window.__mesaState.busy,
   options:[...document.querySelectorAll('#pdf-model-options .pdf-opt')].map(row=>row.textContent.trim()),
   seg:[...document.querySelectorAll('#pdf-model-options .pdf-seg button')].map(button=>`${button.textContent}:${button.getAttribute('aria-pressed')}`),
  };
 });
 let now=await state();
 assert.equal(now.group,'radiogroup');
 assert.deepEqual(now.cards,['lista','apostila','resumo','simulado','formulario','livre']);
 assert.equal(now.checked,'lista','o diálogo abre no modelo que o tutor pediu');
 assert.equal(now.preview,'lista','a prévia usa o modelo escolhido');
 assert.match(now.status,/O tutor escolheu Lista pelo pedido\. Trocar o modelo não muda o texto\./);
 assert.match(now.pages,/^página 1 de \d+$/);
 await page.waitForFunction(()=>/Auto · \d/.test(document.querySelector('#pdf-model-options')?.textContent||''),undefined,{timeout:8000});
 now=await state();
 assert.ok(now.seg.some(entry=>/^Auto · 3:true$/.test(entry)),`itens curtos: Auto escolhe 3 colunas (${now.seg})`);
 /* A prévia real (o PDF da Mesa) chega sozinha depois do modelo: a paginação
    é a do PDF — folha da lista e folha do gabarito. */
 await page.waitForFunction(()=>!!document.querySelector('#free-pdf-pages canvas')&&!document.querySelector('#free-pdf-page-count').hasAttribute('data-estimate'),undefined,{timeout:30000});
 now=await state();
 assert.equal(now.pages,'página 1 de 2','a lista com gabarito separado tem duas folhas no PDF real');
 assert.equal(await page.locator('#free-pdf-page-count').getAttribute('data-estimate'),null,'paginação exata, não estimativa');
 await shot('01-lista-1440x900-claro-pdf-real');
 await shot('01-lista-1440x900-claro');

 /* ---------- trocar de cartão: prévia na hora, texto e tutor intactos ---------- */
 const before=now;
 for(const id of ['apostila','resumo','simulado','formulario','livre','lista']){
  await page.locator(`#pdf-model-strip [data-model="${id}"]`).click();
  await page.waitForFunction(wanted=>{
   const wrapper=document.querySelector('#free-pdf-preview .pdf-model');
   return (wrapper?.dataset.model||'livre')===wanted;
  },id,{timeout:1000});
  const after=await state();
  assert.equal(after.checked,id);
  assert.equal(after.text,before.text,'trocar o modelo não muda o texto');
  assert.equal(after.messages,before.messages,'trocar o modelo não chama o tutor');
  assert.equal(after.busy,false);
  if(id!=='lista')assert.match(after.status,new RegExp(`Modelo trocado para ${id==='formulario'?'Formulário':id[0].toUpperCase()+id.slice(1)}`));
  if(id==='livre'){assert.equal(after.options.length,0,'o Livre não tem opções');assert.match(await page.locator('#pdf-model-options').textContent(),/não tem opções/);}
 }

 /* ---------- opções do Simulado: espaço Grande vira 80 mm e a longa 110 mm ---------- */
 await page.locator('#free-pdf-content').fill('# Prova de exemplo\n\n## Questão 1 (2,0)\n\nEnuncie o teorema de Pitágoras.\n\n## Questão 2 (3,0) {longa}\n\nDemonstre-o.');
 await page.locator('#pdf-model-strip [data-model="simulado"]').click();
 await page.locator('#pdf-model-options .pdf-seg button[data-value="grande"]').click();
 const heights=await page.evaluate(()=>[...document.querySelectorAll('#free-pdf-preview .pdf-q')].map(node=>node.style.getPropertyValue('--ans')));
 assert.deepEqual(heights,['80mm','110mm'],'Grande: 80 mm; a questão marcada como longa sobe um degrau');
 /* ---------- Cancelar descarta a troca; o rascunho segue no modelo do tutor ---------- */
 await page.locator('#free-pdf-form .dialog-actions button[value=cancel]').click();
 await page.waitForFunction(()=>!document.querySelector('#free-pdf-dialog').open);
 await page.locator('#tutor-material-status button').click();
 await page.waitForSelector('#free-pdf-dialog[open]');
 now=await state();
 assert.equal(now.checked,'lista','Cancelar descartou a troca de modelo');
 assert.equal(now.text,markdown,'e o texto do rascunho segue o do tutor');
 assert.match(now.status,/O tutor escolheu Lista/);

 /* ---------- medidas: dois temas × dois tamanhos ---------- */
 for(const [theme,size] of [['light',[1440,900]],['dark',[1440,900]],['light',[900,650]],['dark',[900,650]]]){
  await setSize(...size);
  await page.waitForFunction(([w])=>Math.abs(outerWidth-w)<=1,[size[0]]);
  await setTheme(page,theme);
  await layoutStable(page,'main');
  const m=await page.evaluate(()=>{
   const dialog=document.querySelector('#free-pdf-dialog');
   const box=dialog.getBoundingClientRect();
   const rect=selector=>{const el=dialog.querySelector(selector);if(!el)return null;const r=el.getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:r.width,height:r.height};};
   const foot=dialog.querySelector('.dialog-actions');
   const footBox=foot.getBoundingClientRect();
   const editor=dialog.querySelector('.pdf-builder-edit');
   return {
    win:[innerWidth,innerHeight],
    box:{top:box.top,bottom:box.bottom,left:box.left,right:box.right},
    radius:getComputedStyle(dialog).borderTopLeftRadius,
    title:getComputedStyle(dialog.querySelector('h2')).fontSize,
    close:(()=>{const r=dialog.querySelector('.help-head .icon-btn').getBoundingClientRect();return [Math.round(r.width),Math.round(r.height)];})(),
    footer:{height:Math.round(footBox.height),gap:Math.round(box.bottom-footBox.bottom),lines:new Set([...foot.querySelectorAll('button')].map(b=>Math.round(b.getBoundingClientRect().top))).size,buttons:[...foot.querySelectorAll('button')].map(b=>Math.round(b.getBoundingClientRect().height))},
    controls:[...dialog.querySelectorAll('select,input[type=text]')].filter(c=>c.getBoundingClientRect().height>0).map(c=>Math.round(c.getBoundingClientRect().height)),
    cards:[...dialog.querySelectorAll('.pdf-model-card')].map(card=>{const r=card.getBoundingClientRect(),name=card.querySelector('.pdf-model-name');return {w:Math.round(r.width),h:Math.round(r.height),cut:name.scrollWidth>name.clientWidth,blurb:getComputedStyle(card.querySelector('.pdf-model-blurb')).display!=='none'};}),
    strip:rect('.pdf-model-strip'),
    editor:{overflowX:editor.scrollWidth>editor.clientWidth+1,rect:rect('.pdf-builder-edit')},
    text:rect('#free-pdf-content'),
    options:rect('.pdf-options'),
    view:rect('.pdf-builder-view'),
    pageCount:rect('#free-pdf-page-count'),
    status:{cut:(()=>{const s=dialog.querySelector('#free-pdf-status');return s.scrollWidth>s.clientWidth+1;})(),text:dialog.querySelector('#free-pdf-status').textContent},
   };
  });
  const tag=`${theme} ${size.join('x')}`;
  assert.ok(m.box.top>=0&&m.box.left>=0&&m.box.bottom<=m.win[1]&&m.box.right<=m.win[0],`${tag}: o diálogo cabe na janela (${JSON.stringify(m.box)} em ${m.win})`);
  assert.equal(m.radius,'16px',`${tag}: raio 16px`);
  assert.equal(m.title,'15px',`${tag}: título de 15px`);
  assert.deepEqual(m.close,[28,28],`${tag}: × de 28px`);
  assert.equal(m.footer.height,52,`${tag}: rodapé de 52px`);
  assert.equal(m.footer.lines,1,`${tag}: botões do rodapé numa linha`);
  assert.deepEqual([...new Set(m.footer.buttons)],[30],`${tag}: botões de 30px`);
  assert.deepEqual([...new Set(m.controls)],[30],`${tag}: campos de 30px (${m.controls})`);
  assert.equal(m.cards.length,6,`${tag}: seis cartões à vista`);
  for(const card of m.cards)assert.equal(card.cut,false,`${tag}: nome do modelo inteiro`);
  assert.equal(m.cards[0].blurb,size[0]>=1440,`${tag}: a frase do cartão aparece só onde cabe`);
  assert.equal(m.editor.overflowX,false,`${tag}: edição sem rolagem horizontal`);
  assert.ok(m.text.height>=90,`${tag}: o texto tem altura útil (${m.text.height})`);
  assert.ok(m.options&&m.options.height>=30,`${tag}: opções do modelo à vista`);
  assert.ok(m.view.width>=300,`${tag}: prévia com largura útil (${m.view.width})`);
  assert.ok(m.pageCount.height>0,`${tag}: contagem de páginas visível`);
  await shot(`02-${theme}-${size.join('x')}`);
 }

 /* ---------- Salvar lembra o modelo da sessão ---------- */
 await setSize(1440,900);
 await page.locator('#pdf-model-strip [data-model="apostila"]').click();
 await page.locator('#free-pdf-save').click();
 await page.waitForFunction(()=>!document.querySelector('#free-pdf-dialog').open&&!!document.querySelector('.pdf-page[data-rendered] canvas'),undefined,{timeout:60000});
 const saved=await page.evaluate(()=>window.__mesaState.panels[0].path);
 assert.ok(fs.statSync(saved).size>1000);
 assert.match(execFileSync('pdftotext',[saved,'-'],{encoding:'utf8'}),/Lista de exemplo/);
 await freeMenuClick(page,'#free-generate-pdf');
 await page.waitForSelector('#free-pdf-dialog[open]');
 now=await state();
 assert.equal(now.checked,'apostila','o último modelo salvo vale na próxima abertura');
 assert.match(now.status,/Modelo Apostila, o último que você usou aqui\./);
 assert.deepEqual(errors,[]);
 console.log('pdf-models-dialog-ui: PASS — modelo do tutor, troca sem tutor, Cancelar descarta, Salvar lembra e medidas nos dois temas e tamanhos.');
});
