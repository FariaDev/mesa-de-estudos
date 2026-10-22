import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {withArtifacts,launchDesk,newRuntime,seedCourse,writeConfigJson,tinyPdf,statusOnline,screenshotDirectory,setTheme,freezeMotion,resizeWindow} from './helpers.mjs';
import {BAR,measure,assertLayout,near,settle} from './layout-measure.mjs';
import {layoutStable} from './waits.mjs';

/* Chat lateral no padrão novo (ticket #19): ao lado de um leitor ele segue as
   regras da coluna do tutor. Mede na janela real, nos dois temas, em 1440×900
   e 900×650, com um e com dois leitores:
   - cabeçalho de 40px na mesma linha das barras vizinhas (nome, sessão nova,
     Mais opções, fechar), sem a barra de abas de apoio;
   - linha de escopo (material e página de origem; não entra na sessão
     principal) com UMA ação, "Atualizar contexto";
   - a mesma caixa de mensagem da coluna do tutor (moldura, campo e botão);
   - abrir, fechar e alternar com o segundo leitor, com um e dois leitores;
   - nada vaza em 900×650.
   As imagens saem em `desk/tests/artifacts/lateral-…` para olho humano. */

const SHOT_DIR=screenshotDirectory('lateral');
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
async function openDesk(ctx,tag,{two}){
 const runtime=ctx.runtime=newRuntime(tag),course=seedCourse(runtime,'Test');
 fs.writeFileSync(path.join(course,'Limites.pdf'),tinyPdf(['Lista 2 - Limites','5. lim x->2 (x^2 - 4)/(x - 2)','6. lim x->0 sen(3x)/x'],4));
 if(two)fs.writeFileSync(path.join(course,'Formulario.pdf'),tinyPdf(['Formulario','lim sen x / x = 1'],2));
 const desk=two?{pinnedExtensions:false}:{panels:[{label:'Lista',prefer:['Limites']}],pinnedExtensions:false};
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'Test',name:'Cálculo I',path:course}],desk});
 ctx.app=await launchDesk({runtime});
 const page=await ctx.app.firstWindow();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await statusOnline(page);
 await page.waitForSelector('.pdf-panel canvas',{timeout:25000});
 await freezeMotion(page);
 return {page,errors};
}
async function openSidechat(page){
 await page.locator('#sidechat-toggle').click();
 await page.waitForFunction(()=>{
  const el=document.querySelector('#sidechat');
  if(!el||el.hidden||el.getBoundingClientRect().width<=0)return false;
  const prompt=document.querySelector('#sidechat-prompt');
  return !!prompt&&!prompt.disabled&&!document.querySelector('#sidechat-messages .sidechat-msg.system');
 },undefined,{timeout:20000});
}
const style=(page,selector,prop)=>page.locator(selector).evaluate((el,name)=>getComputedStyle(el)[name],prop);

/* A caixa do chat lateral é a do tutor: mesma moldura, mesmo campo, mesmo
   botão principal. Compara os estilos calculados dos dois lados. */
async function assertSameBox(page,label){
 const pairs=[
  ['#composer-box','#sidechat-box',['borderTopWidth','borderTopLeftRadius','borderTopColor','backgroundColor']],
  ['#prompt','#sidechat-prompt',['borderTopWidth','fontSize','lineHeight','paddingLeft','backgroundColor']],
  ['#send','#sidechat-send',['height','backgroundColor','borderTopLeftRadius','fontSize','color']],
  ['#goes-along','#sidechat-scope',['fontSize','color','paddingLeft']]
 ];
 for(const [tutor,lateral,props] of pairs)for(const prop of props){
  assert.equal(await style(page,lateral,prop),await style(page,tutor,prop),`${label}: ${lateral} ${prop} igual a ${tutor}`);
 }
}

/* Enviar leva a mesma seta do tutor e a linha de escopo cabe em até duas linhas,
   com a ação de renovar o contexto à vista (#23). */
async function assertSendAndScope(page,label){
 const facts=await page.evaluate(()=>{
  const arrow=el=>el?.querySelector('svg')?.outerHTML||'';
  const scope=document.querySelector('#sidechat-scope-text'),box=document.querySelector('#sidechat-scope'),refresh=document.querySelector('#sidechat-refresh');
  const line=Number.parseFloat(getComputedStyle(scope).lineHeight)||Number.parseFloat(getComputedStyle(scope).fontSize)*1.4;
  const b=box.getBoundingClientRect(),r=refresh.getBoundingClientRect();
  return {sidechat:arrow(document.querySelector('#sidechat-send')),tutor:arrow(document.querySelector('#send')),
   lines:Math.round((b.height-Number.parseFloat(getComputedStyle(box).paddingTop)-Number.parseFloat(getComputedStyle(box).paddingBottom))/line),
   refreshInside:r.left>=b.left-0.5&&r.right<=b.right+0.5&&r.width>0,refreshName:refresh.getAttribute('aria-label')||''};
 });
 assert.ok(facts.sidechat,`${label}: o Enviar do chat lateral tem a seta`);
 assert.equal(facts.sidechat,facts.tutor,`${label}: a seta é a mesma do Enviar do tutor`);
 assert.ok(facts.lines<=2,`${label}: a linha de escopo cabe em até duas linhas (${facts.lines})`);
 assert.equal(facts.refreshInside,true,`${label}: Atualizar contexto fica dentro da linha`);
 assert.equal(facts.refreshName,'Atualizar contexto',`${label}: o nome acessível segue completo`);
}

await withArtifacts('lateral-dois-leitores',async ctx=>{
 const {page,errors}=await openDesk(ctx,'lateral-dois',{two:true});

 /* Sem a barra de abas de apoio: o chat lateral abre e fecha pelo cabeçalho. */
 assert.equal(await page.locator('#support-bar').count(),0,'não há mais a barra de abas de apoio');
 assert.equal(await page.locator('#support-tab-chat').count(),0,'a aba "Chat lateral" não existe');
 await openSidechat(page);
 assert.equal(await page.locator('#sidechat-toggle').getAttribute('aria-pressed'),'true','o botão do cabeçalho do tutor mostra o chat aberto');

 /* Cabeçalho: nome, sessão nova, Mais opções e fechar — e nada de ação de contexto aqui. */
 assert.match((await page.locator('#sidechat-title').textContent()).trim(),/^Chat lateral$/);
 for(const id of ['sidechat-new','sidechat-more','sidechat-close'])assert.equal(await page.locator(`.sidechat-head #${id}`).isVisible(),true,`${id} está no cabeçalho`);
 assert.equal(await page.locator('.sidechat-head #sidechat-refresh').count(),0,'Atualizar contexto não mora no cabeçalho');
 const head=await page.locator('.sidechat-head').boundingBox();
 assert.ok(near(head.height,BAR,.6),`cabeçalho do chat lateral com ${BAR}px (${head.height})`);
 const readerBar=await page.locator('#pdf-grid .pdf-panel .pdf-title').first().boundingBox();
 assert.ok(near(head.y,readerBar.y,.6),'cabeçalho do chat lateral na mesma linha da barra do leitor');

 /* Linha de escopo: material e página, que não entra na sessão principal, e
    uma ação só. */
 const scope=page.locator('#sidechat-scope');
 assert.equal(await scope.isVisible(),true,'a linha de escopo aparece');
 assert.match((await page.locator('#sidechat-scope-text').textContent()).trim(),/^Sobre Limites\.pdf p\. 1, Formulario\.pdf p\. 1\. Não entra na sessão principal\.$/,'a linha diz o material e a página de origem (os dois leitores) e que não entra na principal');
 assert.equal(await scope.locator('button').count(),1,'a linha tem uma ação só');
 assert.equal((await scope.locator('button').textContent()).trim(),'Atualizar contexto');
 assert.equal(await page.locator('#sidechat button:has-text("Atualizar contexto")').count(),1,'Atualizar contexto é o único caminho para renovar o contexto');
 await assertSameBox(page,'duas matérias');

 /* Mais opções: menu do cabeçalho; Esc fecha e não pára nada. */
 await page.locator('#sidechat-more').click();
 const menu=page.locator('#sidechat-more-pop');
 assert.equal(await menu.isVisible(),true,'Mais opções abre o menu');
 assert.equal(await menu.getAttribute('role'),'menu');
 assert.equal(await page.locator('#sidechat-more').getAttribute('aria-expanded'),'true');
 assert.match(await menu.textContent(),/Ver o contexto copiado/);
 await page.keyboard.press('Escape');
 assert.equal(await menu.isHidden(),true,'Esc fecha o menu');
 await page.locator('#sidechat-more').click();
 await page.locator('#sidechat-more-pop [role=menuitem]').first().click();
 assert.equal(await menu.isHidden(),true,'escolher o item fecha o menu');
 await page.waitForFunction(()=>!document.querySelector('#sidechat-context-pop').hidden);
 assert.match(await page.locator('#sidechat-context-pop').innerText(),/Limites\.pdf/,'o contexto copiado lista o material');
 await page.locator('#sidechat-context-pop .primary').click();

 /* Atualizar contexto continua sendo explícito e funciona. */
 await page.locator('#sidechat-refresh').click();
 await page.waitForFunction(()=>document.querySelector('#toast')?.textContent.includes('Contexto atualizado'),undefined,{timeout:10000});

 /* Fechar volta ao Formulário (com dois leitores); o botão do tutor reabre. */
 await page.locator('#sidechat-close').click();
 await page.waitForFunction(()=>document.querySelector('#sidechat').hidden,undefined,{timeout:5000});
 assert.equal(await page.locator('#pdf-grid .pdf-panel,#support-slot .pdf-panel').evaluateAll(list=>list.filter(el=>el.getBoundingClientRect().width>0).length),2,'fechar devolve o segundo leitor');
 assert.equal(await page.locator('#sidechat-toggle').getAttribute('aria-pressed'),'false');
 await openSidechat(page);
 await page.locator('#sidechat-toggle').click();
 await page.waitForFunction(()=>document.querySelector('#sidechat').hidden);
 assert.equal(await page.locator('#sidechat-toggle').getAttribute('aria-pressed'),'false','o botão do tutor também fecha');

 /* Alternar com o segundo leitor: Estudar → Formulário traz o leitor e tira o chat. */
 await openSidechat(page);
 await page.locator('#study-menu .nav-trigger').click();
 await page.locator('#reference-toggle').click();
 await page.waitForFunction(()=>document.querySelector('#sidechat').hidden);
 assert.equal(await page.locator('#reference-toggle').getAttribute('aria-pressed'),'true','o Formulário voltou');
 await page.keyboard.press('Escape');

 /* Recolher o Formulário deixa uma faixa para reabrir; o chat segue abrindo. */
 await page.locator('#study-menu .nav-trigger').click();
 await page.locator('#reference-toggle').click();
 await page.keyboard.press('Escape');
 const restore=page.locator('#support-restore');
 await restore.waitFor({state:'visible',timeout:5000});
 const strip=await restore.boundingBox();
 assert.ok(strip.width>=28&&strip.width<=44,`faixa de reabrir estreita (${strip.width}px)`);
 await restore.click();
 await page.waitForFunction(()=>document.querySelector('#reference-toggle')?.getAttribute('aria-pressed')==='true');
 assert.equal(await restore.isHidden(),true,'a faixa some quando o Formulário volta');

 /* Mede e fotografa nos dois temas e tamanhos. */
 for(const [theme,tag] of THEMES){
  await setTheme(page,theme);
  for(const size of [WIDE,MINIMUM]){
   await setSize(ctx.app,page,size);
   const base=`dois-${tag}-${size.join('x')}`;
   await openSidechat(page);
   /* Cada rodada começa com um chat lateral vazio (o anterior fica guardado). */
   page.once('dialog',dialog=>dialog.accept());
   await page.locator('#sidechat-new').click();
   await page.waitForSelector('#sidechat-messages .sidechat-empty',{timeout:10000});
   await layoutStable(page,'#sidechat');
   assertLayout(await layoutNow(page),`chat lateral ${base}`,{readers:1});
   await assertSendAndScope(page,`chat lateral ${base}`);
   await shot(page,`${base}-vazio.png`);
   await page.locator('#sidechat-more').click();
   await shot(page,`${base}-mais-opcoes.png`);
   await page.keyboard.press('Escape');
   await page.locator('#sidechat-prompt').fill('teorema do chat lateral');
   await page.locator('#sidechat-prompt').press('Enter');
   await page.waitForFunction(()=>[...document.querySelectorAll('#sidechat-messages .sidechat-msg.assistant .sidechat-body')].some(el=>el.textContent.includes('Pitágoras')),undefined,{timeout:30000});
   assertLayout(await layoutNow(page),`chat lateral com mensagens ${base}`,{readers:1});
   await shot(page,`${base}-mensagens.png`);
   await page.locator('#sidechat-close').click();
   await page.waitForFunction(()=>document.querySelector('#sidechat').hidden);
  }
 }
 assert.deepEqual(errors,[]);
 console.log('PASS: chat lateral com dois leitores');
});

await withArtifacts('lateral-um-leitor',async ctx=>{
 const {page,errors}=await openDesk(ctx,'lateral-um',{two:false});
 assert.equal(await page.locator('#support-bar').count(),0,'sem barra de abas de apoio');
 assert.equal(await page.locator('#support-restore').isHidden(),true,'com um leitor não há faixa de reabrir');
 assert.equal(await page.locator('#support-slot').isHidden(),true,'o layout padrão (um leitor) fica intacto');
 for(const [theme,tag] of THEMES){
  await setTheme(page,theme);
  for(const size of [WIDE,MINIMUM]){
   await setSize(ctx.app,page,size);
   await openSidechat(page);
   const base=`um-${tag}-${size.join('x')}`;
   assertLayout(await layoutNow(page),`chat lateral ${base}`,{readers:1});
   assert.equal(await page.locator('#sidechat-scope-text').textContent(),'Sobre Limites.pdf p. 1. Não entra na sessão principal.','a linha de escopo vale com um leitor');
   await assertSendAndScope(page,`chat lateral ${base}`);
   await shot(page,`${base}-vazio.png`);
   await page.locator('#sidechat-close').click();
   await page.waitForFunction(()=>document.querySelector('#sidechat').hidden);
   assert.equal(await page.locator('#support-slot').isHidden(),true,'fechar devolve a largura toda ao leitor');
   assert.equal(await page.locator('#sidechat-toggle').getAttribute('aria-pressed'),'false');
  }
 }
 assert.deepEqual(errors,[]);
 console.log('PASS: chat lateral com um leitor');
});
