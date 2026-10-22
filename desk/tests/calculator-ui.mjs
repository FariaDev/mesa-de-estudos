// node tests/calculator-ui.mjs — calculadora em uma linha (ticket #16), na janela.
// Cobre cada critério de aceitação: recolhida é UMA linha de 40px (--bar) no pé
// da coluna do tutor e calcula ali mesmo; o controle expande para o painel com
// ângulo, histórico e guia e recolhe de volta; o estado expandido/recolhido é
// lembrado entre aberturas (fora do config.json); com `calculator:false` a
// linha some e o espaço volta para as mensagens; os atalhos continuam; nada
// estoura em 900×650.
// Grava capturas (claro/escuro, 1440×900 e 900×650) para olho humano.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
 withArtifacts,newRuntime,seedCourse,writeConfigJson,writeDeskJson,launchDesk,statusOnline,tinyPdf,
 reviewShot,screenshotDirectory,setTheme,freezeMotion,resizeWindow
} from './helpers.mjs';
import {measure,settle,assertLayout} from './layout-measure.mjs';
import {layoutStable,pollUntil} from './waits.mjs';

const out=screenshotDirectory('calculator');
const BAR=40;
const size=(app,page,width,height)=>resizeWindow(app,page,width,height);
const rect=(page,selector)=>page.evaluate(sel=>{
 const el=document.querySelector(sel);if(!el)return null;
 const cs=getComputedStyle(el),b=el.getBoundingClientRect();
 if(cs.display==='none'||b.width===0&&b.height===0)return null;
 return {top:b.top,bottom:b.bottom,left:b.left,right:b.right,width:b.width,height:b.height};
},selector);
const cssVar=(page,name)=>page.evaluate(n=>parseInt(getComputedStyle(document.documentElement).getPropertyValue(n)),name);
/* O painel expandido abre inteiro: o corpo não rola, a menos que o teto de 70%
   da coluna tenha sido atingido. */
const fit=page=>page.evaluate(()=>{
 const body=document.querySelector('#calc-body'),calc=document.querySelector('#calculator'),side=document.querySelector('#sidebar');
 return {hidden:body.scrollHeight-body.clientHeight,height:calc.getBoundingClientRect().height,cap:side.getBoundingClientRect().height*0.7};
});
const assertFits=async(page,label)=>{
 const f=await fit(page);
 assert.ok(f.hidden<=1||f.height>=f.cap-1,`${label}: o painel abre inteiro (sobra ${f.hidden}px escondido, altura ${f.height} de teto ${Math.round(f.cap)})`);
};
const result=page=>page.locator('#result').textContent().then(t=>t.trim());
const near=(a,b,tol=1)=>Math.abs(a-b)<=tol;
const evalIn=async(page,expr)=>{await page.locator('#expression').fill(expr);await page.locator('#expression').press('Enter');};
const savedView=runtime=>{try{return JSON.parse(fs.readFileSync(path.join(runtime,'desk.json'),'utf8')).viewLayout||null;}catch{return null;}};
const waitSaved=(runtime,collapsed)=>pollUntil(()=>savedView(runtime),view=>view?.calculatorCollapsed===collapsed,{timeout:8000,interval:100,what:`o estado da calculadora (${collapsed?'recolhida':'expandida'}) no desk.json`});
const relaunch=async(ctx,runtime)=>{
 await ctx.app.close();
 const app=ctx.app=await launchDesk({runtime});
 const page=await app.firstWindow();
 await size(app,page,1440,900);
 await statusOnline(page);
 await freezeMotion(page);
 await page.waitForSelector('#expression',{timeout:30000});
 return page;
};

function seed(tag,{desk}={}){
 const runtime=newRuntime(tag);
 const course=seedCourse(runtime,'calc');
 const pdf=path.join(course,'Limites.pdf');fs.writeFileSync(pdf,tinyPdf('Limites e derivadas'));
 const formulas=path.join(course,'Formulario.pdf');fs.writeFileSync(formulas,tinyPdf('Formulas'));
 writeConfigJson(runtime,{runtimePath:runtime,vaultPath:runtime,courses:[{id:'calc',name:'Cálculo I',path:course}],...(desk?{desk}:{})});
 writeDeskJson(runtime,{courseId:'calc',courseStates:{calc:{pdfs:[{path:pdf,page:1},{path:formulas,page:1}],study:{title:'',xopp:''}}}});
 return runtime;
}

await withArtifacts('calculator',async ctx=>{
 const runtime=ctx.runtime=seed('calculator');
 ctx.app=await launchDesk({runtime});
 let page=await ctx.app.firstWindow();
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await size(ctx.app,page,1440,900);
 await statusOnline(page);
 await freezeMotion(page);
 await page.waitForSelector('#expression');

 /* ---------- 1. recolhida: uma linha de 40px no pé da coluna, e calcula ---------- */
 assert.equal(await page.locator('#calc-toggle').getAttribute('aria-expanded'),'false','a calculadora abre recolhida');
 let bar=await rect(page,'#calculator');
 assert.ok(near(bar.height,BAR,0.5),`recolhida, a calculadora tem ${BAR}px (${bar.height})`);
 assert.equal(await cssVar(page,'--bar'),BAR,'a linha usa o token --bar');
 const column=await page.evaluate(()=>{
  const r=sel=>{const el=document.querySelector(sel);if(!el||el.hidden)return null;const b=el.getBoundingClientRect();return b.height>0?{top:b.top,bottom:b.bottom,left:b.left,right:b.right}:null;};
  return {sidebar:r('#sidebar'),composer:r('#composer'),calc:r('#calculator'),divider:r('#calc-divider'),chat:r('#chat')};
 });
 assert.ok(column.calc.top>=column.composer.bottom-0.5,'a linha fica abaixo da caixa de mensagem, não cobre nada');
 assert.ok(near(column.calc.left,column.sidebar.left,0.5)&&near(column.calc.right,column.sidebar.right,0.5),'a linha vai de ponta a ponta da coluna');
 assert.ok(near(column.calc.bottom,column.sidebar.bottom,1),'a linha é o último bloco da coluna');
 assert.equal(column.divider,null,'recolhida não há alça: a altura é fixa');
 assert.equal(await page.locator('#calc-body').isHidden(),true,'o painel expandido não aparece recolhida');
 for(const sel of ['#angle','#calc-history','#calc-guide'])assert.equal(await page.locator(sel).isHidden(),true,`${sel} só aparece expandida`);
 // campo e resultado na mesma linha, dentro dos 40px
 await page.locator('#expression').fill('sqrt(16)+sin(pi/2)');
 await page.locator('#expression').press('Enter');
 assert.equal(await result(page),'5','Enter calcula na própria linha');
 bar=await rect(page,'#calculator');
 assert.ok(near(bar.height,BAR,0.5),'calcular não muda a altura da linha');
 const line=await page.evaluate(()=>{
  const c=document.querySelector('#calculator').getBoundingClientRect();
  const m=sel=>{const b=document.querySelector(sel).getBoundingClientRect();return {top:b.top,bottom:b.bottom,left:b.left,right:b.right,mid:(b.top+b.bottom)/2};};
  return {bar:c,input:m('#expression'),result:m('#result'),toggle:m('#calc-toggle'),unit:m('.calc-unit')};
 });
 for(const name of ['input','result','toggle','unit']){
  const item=line[name];
  assert.ok(item.top>=line.bar.top-0.5&&item.bottom<=line.bar.bottom+0.5,`${name} cabe nos 40px da linha`);
  assert.ok(near(item.mid,line.input.mid,2),`${name} está na mesma linha do campo (${item.mid} × ${line.input.mid})`);
 }
 assert.ok(line.result.left>=line.input.right-0.5,'o resultado vem depois do campo, na mesma linha');
 assert.match(await page.locator('.calc-unit').textContent(),/^RAD$/,'a linha mostra a unidade vigente');
 /* #27 B15: "= 5" se lê junto, em mono 13px/600. */
 const together=await page.evaluate(()=>{
  const eq=document.querySelector('#calc-form button'),out=document.querySelector('#result');
  const e=eq.getBoundingClientRect(),r=out.getBoundingClientRect(),ec=getComputedStyle(eq),rc=getComputedStyle(out);
  return {gap:r.left-e.right,eq:{size:ec.fontSize,weight:ec.fontWeight,family:ec.fontFamily},out:{size:rc.fontSize,weight:rc.fontWeight,family:rc.fontFamily},eqW:e.width,eqH:e.height};
 });
 assert.ok(together.gap>=0&&together.gap<=6,`o = e o resultado ficam juntos (${together.gap}px)`);
 for(const part of [together.eq,together.out]){
  assert.equal(part.size,'13px','= e resultado em 13px');
  assert.equal(part.weight,'600','= e resultado em 600');
  assert.match(part.family,/mono|Menlo/i,'= e resultado em mono');
 }
 assert.ok(together.eqW>=20&&together.eqH>=24,`o = continua um alvo clicável (${together.eqW}×${together.eqH})`);
 await page.locator('#calc-form button').click();
 assert.equal(await result(page),'5','o botão = também calcula');
 // erro: o resultado vira — e o aviso aparece, sem mexer na linha
 await evalIn(page,'sqrt(');
 assert.equal(await result(page),'—','expressão inválida vira —');
 assert.ok(near((await rect(page,'#calculator')).height,BAR,0.5),'o erro não muda a altura da linha');
 await evalIn(page,'sqrt(16)+sin(pi/2)');
 const emptyLine=await rect(page,'#expression');
 assert.ok(emptyLine.width>=80,`o campo tem largura útil na linha (${emptyLine.width}px)`);
 await reviewShot(page,out,'recolhida-com-resultado-claro-1440.png');

 /* ---------- 2. o controle expande: ângulo, histórico e guia; recolhe de volta ---------- */
 await evalIn(page,'2+3');
 await evalIn(page,'10/4');
 const toggle=page.locator('#calc-toggle');
 assert.equal(await toggle.getAttribute('aria-label'),'Expandir calculadora');
 await toggle.click();
 assert.equal(await toggle.getAttribute('aria-expanded'),'true');
 assert.equal(await toggle.getAttribute('aria-label'),'Recolher calculadora','o nome acessível diz o que o clique faz agora');
 assert.equal(await page.locator('#calc-body').isVisible(),true,'expandir mostra o painel');
 assert.equal(await page.locator('#angle').isVisible(),true,'o ângulo aparece expandida');
 assert.equal(await page.locator('#calc-history').isVisible(),true,'o histórico aparece expandida');
 assert.equal(await page.locator('#calc-guide summary').isVisible(),true,'o guia "Como usar" aparece expandida');
 assert.deepEqual(await page.locator('#calc-history button').evaluateAll(es=>es.map(e=>e.getAttribute('aria-label'))),['10/4 = 2,5','2+3 = 5','sqrt(16)+sin(pi/2) = 5','sqrt(16)+sin(pi/2) = 5','sqrt(16)+sin(pi/2) = 5'],'o histórico lista os cálculos, o mais novo primeiro (o erro não entra)');
 const openBar=await rect(page,'#calculator');
 assert.ok(openBar.height>BAR+60,`expandida, a calculadora cresce (${openBar.height}px)`);
 assert.ok(near(openBar.height,await cssVar(page,'--calc'),2),`a altura expandida segue --calc (${openBar.height} × ${await cssVar(page,'--calc')})`);
 const head=await rect(page,'#expression'),barRect=await rect(page,'#calc-bar');
 assert.ok(near(barRect.height,BAR,1.5),`a linha continua sendo a barra de ${BAR}px no topo do painel (${barRect.height})`);
 assert.ok(head.bottom<=barRect.bottom+0.5,'campo e resultado seguem na barra do painel');
 assert.equal(await page.evaluate(()=>document.activeElement?.id),'calc-toggle','o foco fica no controle');
 assert.equal(await page.locator('#calc-divider').isVisible(),true,'expandida, a alça de altura aparece');
 assert.equal(await page.locator('.calc-unit').isHidden(),true,'expandida, a unidade vive só no seletor (sem duplicar)');
 await assertFits(page,'expandida com histórico');
 await reviewShot(page,out,'expandida-com-historico-claro-1440.png');
 // o ângulo do painel vale para a linha
 await page.locator('#angle button[data-angle="deg"]').click();
 await evalIn(page,'sin(30)');
 assert.equal(await result(page),'0,5','GRAUS: sin(30) = 0,5');
 // o histórico reutiliza a expressão (atalho do painel)
 await page.locator('#calc-history button').nth(1).click();
 assert.equal(await page.locator('#expression').inputValue(),'10/4','clicar no histórico devolve a expressão ao campo');
 assert.equal(await page.evaluate(()=>document.activeElement?.id),'expression','e leva o foco ao campo');
 // o guia abre dentro do painel e o painel cresce para mostrá-lo
 const beforeGuide=(await rect(page,'#calculator')).height;
 await page.locator('#calc-guide summary').click();
 assert.equal(await page.locator('#calc-guide').evaluate(el=>el.open),true);
 await layoutStable(page,'#calculator');
 await assertFits(page,'com o "Como usar" aberto');
 assert.deepEqual(await page.locator('.calc-groups dt').allTextContents(),['Operações','Funções','Trigonometria','Constantes'],'o guia mostra os nomes em quatro grupos');
 assert.equal(await page.locator('.calc-tips li').count(),5,'e as dicas em lista');
 await reviewShot(page,out,'expandida-como-usar-claro-1440.png');
 await page.locator('#calc-guide summary').click();
 /* #42 (8): fechar o "Como usar" devolve o painel à altura de antes. */
 await layoutStable(page,'#calculator');
 assert.ok(near((await rect(page,'#calculator')).height,beforeGuide,0.5),`fechar o "Como usar" volta à altura de antes (${beforeGuide}px)`);
 for(const [theme,width,height] of [['light',1440,900],['dark',1440,900],['light',900,650],['dark',900,650]]){
  await setTheme(page,theme);
  await size(ctx.app,page,width,height);
  await layoutStable(page,'#calculator');
  const tag=`${theme}-${width}x${height}`;
  await page.evaluate(()=>document.documentElement.style.setProperty('--calc','200px'));
  await layoutStable(page,'#calculator');
  const start=(await rect(page,'#calculator')).height;
  await page.locator('#calc-guide summary').click();
  await layoutStable(page,'#calculator');
  const open=(await rect(page,'#calculator')).height;
  assert.ok(open>start+1,`${tag}: abrir o "Como usar" cresce o painel (${start} → ${open})`);
  await reviewShot(page,out,`como-usar-aberto-${tag}.png`);
  await page.locator('#calc-guide summary').click();
  await layoutStable(page,'#calculator');
  const closed=(await rect(page,'#calculator')).height;
  assert.ok(near(closed,start,0.5),`${tag}: fechar devolve a altura de antes (${start} → ${open} → ${closed})`);
  await reviewShot(page,out,`como-usar-fechado-${tag}.png`);
 }
 await setTheme(page,'light');
 await size(ctx.app,page,1440,900);
 await layoutStable(page,'#calculator');
 /* Quem arrasta a alça com o guia aberto fica com a altura que escolheu. */
 await page.locator('#calc-guide summary').click();
 await layoutStable(page,'#calculator');
 await page.evaluate(()=>document.documentElement.style.setProperty('--calc','333px'));
 await page.locator('#calc-guide summary').click();
 await layoutStable(page,'#calculator');
 assert.ok(near((await rect(page,'#calculator')).height,333,0.5),'altura arrastada com o guia aberto fica ao fechar');
 // regressão: uma altura guardada menor que o conteúdo não corta o painel ao abrir
 await toggle.click();
 await page.evaluate(()=>document.documentElement.style.setProperty('--calc','110px'));
 await toggle.click();
 await assertFits(page,'altura guardada de 110px');
 assert.ok(await page.locator('#calc-guide summary').isVisible(),'o "Como usar" fica à vista sem rolar');
 // recolher volta à linha, mantendo expressão, resultado e ângulo
 await toggle.click();
 assert.equal(await toggle.getAttribute('aria-expanded'),'false');
 assert.ok(near((await rect(page,'#calculator')).height,BAR,0.5),'recolher volta à linha de 40px');
 assert.equal(await page.locator('#calc-body').isHidden(),true);
 assert.equal(await page.locator('#expression').inputValue(),'10/4','a expressão fica');
 assert.equal(await result(page),'0,5','o resultado fica');
 assert.match(await page.locator('.calc-unit').textContent(),/^GRAUS$/,'a linha recolhida avisa que a conta está em GRAUS');
 assert.equal(await page.evaluate(()=>document.activeElement?.id),'calc-toggle');
 await toggle.click();
 await page.locator('#angle button[data-angle="rad"]').click();
 await toggle.click();
 assert.match(await page.locator('.calc-unit').textContent(),/^RAD$/,'voltar a RAD atualiza a linha');

 /* ---------- 3. a altura só vale expandida; a alça não sobra recolhida ---------- */
 await page.evaluate(()=>document.documentElement.style.setProperty('--calc','400px'));
 assert.ok(near((await rect(page,'#calculator')).height,BAR,0.5),'recolhida, --calc não muda nada: a linha é fixa');
 assert.equal(await page.locator('#calc-divider').isHidden(),true,'recolhida, a alça não existe nem recebe foco');
 await toggle.click();
 assert.ok(near((await rect(page,'#calculator')).height,400,2),'expandida, a altura guardada (--calc) volta');
 await page.locator('#calc-divider').focus();
 await page.keyboard.press('ArrowUp');
 assert.equal(await cssVar(page,'--calc'),420,'o teclado na alça ajusta a altura expandida');
 await page.evaluate(()=>document.documentElement.style.setProperty('--calc','220px'));
 await toggle.click();

 /* ---------- 4. o estado é lembrado entre aberturas, fora do config.json ---------- */
 await toggle.click();
 assert.equal(await toggle.getAttribute('aria-expanded'),'true');
 await waitSaved(runtime,false);
 page=await relaunch(ctx,runtime);
 errors.length=0;page.on('pageerror',error=>errors.push(error.message));
 assert.equal(await page.locator('#calc-toggle').getAttribute('aria-expanded'),'true','reaberta, a calculadora segue expandida');
 assert.equal(await page.locator('#calc-body').isVisible(),true);
 assert.ok((await rect(page,'#calculator')).height>BAR+60,'e com a altura do painel');
 await page.locator('#calc-toggle').click();
 await waitSaved(runtime,true);
 page=await relaunch(ctx,runtime);
 errors.length=0;page.on('pageerror',error=>errors.push(error.message));
 assert.equal(await page.locator('#calc-toggle').getAttribute('aria-expanded'),'false','reaberta, segue recolhida');
 assert.ok(near((await rect(page,'#calculator')).height,BAR,0.5));
 const config=fs.existsSync(path.join(runtime,'config.json'))?fs.readFileSync(path.join(runtime,'config.json'),'utf8'):'';
 assert.doesNotMatch(config,/collapsed|expandid|recolhid/i,'o estado da calculadora não vai para o config.json');
 assert.equal(JSON.parse(config).desk?.calculator,undefined,'o config.json não ganhou campo da calculadora');

 /* ---------- 5. 900×650: nada estoura; mensagens se comportam ---------- */
 await size(ctx.app,page,900,650);
 await layoutStable(page,'#calculator');
 await settle(page);
 await evalIn(page,'sqrt(16)+sin(pi/2)');
 let m=await measure(page);
 assertLayout(m,'900×650 recolhida',{readers:2});
 const over=await page.evaluate(()=>{const c=document.querySelector('#calculator');const f=document.querySelector('#calc-form');return {bar:c.scrollWidth-c.clientWidth,form:f.scrollWidth-f.clientWidth,doc:document.documentElement.scrollWidth-innerWidth};});
 assert.ok(over.bar<=1&&over.form<=1&&over.doc<=1,`a linha não estoura em 900×650 (${JSON.stringify(over)})`);
 assert.ok(near((await rect(page,'#calculator')).height,BAR,0.5),'a linha segue com 40px em 900×650');
 const narrow=await page.evaluate(()=>{
  const c=document.querySelector('#calculator').getBoundingClientRect();
  return ['#expression','#result','#calc-toggle','#calc-form button'].map(sel=>{const b=document.querySelector(sel).getBoundingClientRect();return {sel,ok:b.left>=c.left-0.5&&b.right<=c.right+0.5,w:b.width};});
 });
 for(const item of narrow)assert.ok(item.ok&&item.w>0,`${item.sel} cabe na linha em 900×650`);
 // o composer e a linha não se cobrem
 const stack=await page.evaluate(()=>{
  const r=sel=>{const el=document.querySelector(sel);if(!el)return null;const b=el.getBoundingClientRect();return {top:b.top,bottom:b.bottom,height:b.height};};
  return {composer:r('#composer'),calc:r('#calculator'),messages:r('#messages'),vh:innerHeight};
 });
 assert.ok(stack.composer.bottom<=stack.calc.top+0.5,`o composer não cobre a linha (${stack.composer.bottom} × ${stack.calc.top})`);
 assert.ok(stack.calc.bottom<=stack.vh+0.5,'a linha segue inteira na janela');
 m=await measure(page);
 assertLayout(m,'900×650 recolhida',{readers:2});
 // expandida em 900×650
 await page.locator('#calc-toggle').click();
 await evalIn(page,'2+3');
 await evalIn(page,'10/4');
 await layoutStable(page,'#calculator');
 m=await measure(page);
 assertLayout(m,'900×650 expandida',{readers:2});
 const tall=await page.evaluate(()=>{
  const r=sel=>{const el=document.querySelector(sel);const b=el.getBoundingClientRect();return {top:b.top,bottom:b.bottom,height:b.height};};
  return {composer:r('#composer'),calc:r('#calculator'),vh:innerHeight};
 });
 assert.ok(tall.composer.bottom<=tall.calc.top+0.5,'expandida, a calculadora não cobre o composer');
 assert.ok(tall.calc.bottom<=tall.vh+0.5,'expandida, cabe na janela');
 await assertFits(page,'900×650 expandida');
 await page.locator('#calc-toggle').click();

 /* ---------- 6. capturas: claro/escuro × 1440×900 e 900×650 × três estados ---------- */
 for(const theme of ['light','dark']){
  for(const [width,height] of [[1440,900],[900,650]]){
   await setTheme(page,theme);
   await size(ctx.app,page,width,height);
   await layoutStable(page,'#calculator');
   await settle(page);
   const tag=`${theme==='light'?'claro':'escuro'}-${width}x${height}`;
   // recolhida vazia
   await page.locator('#expression').fill('');
   await page.evaluate(()=>{document.querySelector('#result').textContent='';});
   if(await page.locator('#calc-toggle').getAttribute('aria-expanded')==='true')await page.locator('#calc-toggle').click();
   await reviewShot(page,out,`recolhida-vazia-${tag}.png`);
   // recolhida com resultado
   await evalIn(page,'sqrt(16)+sin(pi/2)');
   await reviewShot(page,out,`recolhida-resultado-${tag}.png`);
   // expandida com histórico
   await evalIn(page,'2+3');
   await evalIn(page,'10/4');
   await page.locator('#calc-toggle').click();
   await layoutStable(page,'#calculator');
   await reviewShot(page,out,`expandida-historico-${tag}.png`);
   /* Medidas do painel (mesmo contrato nos dois temas e tamanhos): grupo de
      ângulo com 2 botões de 24px, linhas do histórico de 28px com a conta à
      esquerda e o resultado à direita, "Limpar" ligado e dentro da coluna. */
   const panel=await page.evaluate(()=>{
    const q=sel=>document.querySelector(sel);
    const box=el=>{const b=el.getBoundingClientRect();return {left:b.left,right:b.right,top:b.top,bottom:b.bottom,height:b.height,width:b.width};};
    const side=box(q('#sidebar'));
    const seg=[...q('#angle').querySelectorAll('button')].map(box);
    const pressed=[...q('#angle').querySelectorAll('button')].map(b=>b.getAttribute('aria-pressed'));
    const rows=[...q('#calc-history').querySelectorAll('button')].map(b=>({row:box(b),expr:box(b.querySelector('.calc-hist-expr')),res:box(b.querySelector('.calc-hist-res'))}));
    const clear=q('#calc-clear');
    return {side,seg,pressed,rows,clear:{...box(clear),disabled:clear.disabled},head:box(q('.calc-hist-head h3')),body:box(q('#calc-body'))};
   });
   assert.equal(panel.seg.length,2,`${tag}: dois botões de unidade`);
   for(const b of panel.seg)assert.ok(near(b.height,24,0.6),`${tag}: botão de unidade com 24px (${b.height})`);
   assert.deepEqual(panel.pressed,['true','false'],`${tag}: RAD pressionado`);
   assert.ok(panel.rows.length>=2,`${tag}: o histórico tem linhas`);
   for(const r of panel.rows){
    assert.ok(near(r.row.height,28,0.6),`${tag}: linha do histórico com 28px (${r.row.height})`);
    assert.ok(r.expr.right<=r.res.left+0.5,`${tag}: a conta fica à esquerda do resultado`);
    assert.ok(r.res.right<=panel.side.right+0.5&&r.row.left>=panel.side.left-0.5,`${tag}: a linha cabe na coluna`);
   }
   assert.equal(panel.clear.disabled,false,`${tag}: Limpar ligado com contas`);
   assert.ok(panel.clear.right<=panel.side.right-8,`${tag}: Limpar dentro da coluna`);
   assert.ok(near(panel.head.left-panel.side.left,12,1),`${tag}: título Histórico a 12px da borda (${panel.head.left-panel.side.left})`);
   await page.locator('#calc-clear').click();
   assert.equal(await page.locator('#calc-history button').count(),0,`${tag}: Limpar esvazia a lista`);
   assert.equal(await page.locator('#calc-clear').isDisabled(),true,`${tag}: sem contas, Limpar desliga`);
   assert.equal(await page.locator('.calc-hist-empty').isVisible(),true,`${tag}: a frase do vazio aparece`);
   await page.locator('#calc-toggle').click();
  }
 }
 assert.deepEqual(errors,[],`erros de página: ${JSON.stringify(errors)}`);
});

/* ---------- 7. desligada no config.json: a linha some e o espaço volta ---------- */
await withArtifacts('calculator-off',async ctx=>{
 const withCalc=ctx.runtime=seed('calc-on');
 ctx.app=await launchDesk({runtime:withCalc});
 let page=await ctx.app.firstWindow();
 await size(ctx.app,page,1440,900);
 await statusOnline(page);
 await freezeMotion(page);
 await page.waitForSelector('#expression');
 const before=await page.evaluate(()=>{
  const r=sel=>{const el=document.querySelector(sel);const b=el.getBoundingClientRect();return {top:b.top,bottom:b.bottom,height:b.height};};
  return {messages:r('#messages'),chat:r('#chat'),sidebar:r('#sidebar')};
 });
 await ctx.app.close();
 fs.rmSync(withCalc,{recursive:true,force:true});

 const runtime=ctx.runtime=seed('calc-off',{desk:{calculator:false}});
 ctx.app=await launchDesk({runtime});
 page=await ctx.app.firstWindow();
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await size(ctx.app,page,1440,900);
 await statusOnline(page);
 await freezeMotion(page);
 await layoutStable(page,'#prompt');
 for(const sel of ['#calculator','#calc-divider','#expression','#result','#calc-toggle'])assert.equal(await page.locator(sel).isHidden(),true,`${sel} some com calculator:false`);
 const after=await page.evaluate(()=>{
  const r=sel=>{const el=document.querySelector(sel);const b=el.getBoundingClientRect();return {top:b.top,bottom:b.bottom,height:b.height};};
  return {messages:r('#messages'),chat:r('#chat'),sidebar:r('#sidebar')};
 });
 const gained=after.messages.height-before.messages.height;
 assert.ok(gained>=BAR-2,`o espaço da linha volta para as mensagens (ganhou ${gained}px)`);
 assert.ok(near(after.chat.bottom,after.sidebar.bottom,1.5),'a conversa desce até o pé da coluna');
 await reviewShot(page,out,'desligada-claro-1440.png');
 await size(ctx.app,page,900,650);
 await layoutStable(page,'#prompt');
 await settle(page);
 const m=await measure(page);
 assertLayout(m,'900×650 sem calculadora',{readers:2});
 await reviewShot(page,out,'desligada-claro-900x650.png');
 assert.deepEqual(errors,[],`erros de página: ${JSON.stringify(errors)}`);
});
console.log('calculator-ui: ok');
