// Retenção de canvas/textLayer no leitor de PDF: um passeio REAL (Electron,
// runtime sintético e Pi de mentira) por um documento de 36 páginas mede quantos
// canvases continuam vivos depois da janela de render — a evidência que separa
// "renderiza perto" de "descarta longe". Depois de comprovado o crescimento,
// também prova a política de descarte: ida/volta, teletransporte, busca, zoom,
// rotação, seleção e dois leitores continuam funcionando com o orçamento.
//
// Rodar em desk/:
//   node tests/hunt-pdf-retention.mjs
// Baseline (antes do descarte: só mede, sem exigir o limite):
//   MESA_PDF_RETENTION_BASELINE=1 node tests/hunt-pdf-retention.mjs
import fs from 'node:fs';
import path from 'node:path';
import {withArtifacts,launchDesk,newRuntime,seedCourse,writeDeskJson,writeConfigJson,menuLocator,resizeWindow} from './helpers.mjs';
import {pdfRenderIdle} from './waits.mjs';
import {multiPagePdf} from './synthetic-pdf.mjs';

const PAGES=36;
const BASELINE=process.env.MESA_PDF_RETENTION_BASELINE==='1';
// Teto do teste em "canvases por painel": o orçamento do host conta até 12 no total,
// preservando a banda de pintura mesmo quando ela supera esse teto, com folga para DPR/janela de outra máquina. O
// que importa aqui é não crescer com o tamanho do documento.
const MAX_RETAINED=18;

let failures=0;
const check=(name,cond,detail='')=>{if(!cond)failures++;console.log(`${cond?'ok  ':'FAIL'} ${name}${detail?` — ${detail}`:''}`);};

/* ------------------------------------------------------------------ */
/* Cenário                                                            */
/* ------------------------------------------------------------------ */

await withArtifacts('pdf-retention',async ctx=>{
 const runtime=ctx.runtime=newRuntime('pdf-retention'),course=seedCourse(runtime,'Longa');
 const longo=path.join(course,'Longo.pdf');
 const curto=path.join(course,'Curto.pdf');
 fs.writeFileSync(longo,multiPagePdf(PAGES,(n,total)=>`Página ${n} de ${total} - integral comum`));
 fs.writeFileSync(curto,multiPagePdf(4,(n,total)=>`Resumo ${n} de ${total} - segue o baile`));
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'Longa',name:'Longa',path:course}],desk:{panels:[{label:'Longo',prefer:['Longo']},{label:'Curto',prefer:['Curto']}]}});
 writeDeskJson(runtime,{courseId:'Longa',pdfs:[{path:longo,page:1,zoom:1},{path:curto,page:1,zoom:1}],layoutVersion:1});

 const app=ctx.app=await launchDesk({runtime,env:{LEARNING_VAULT:runtime}});
 const page=await app.firstWindow();
 const pageErrors=[],consoleErrors=[];
 page.on('pageerror',e=>pageErrors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});

 const field=(i,sel)=>menuLocator(page.locator('.pdf-panel').nth(i),sel);
 const num=(i,sel)=>page.locator('.pdf-panel').nth(i).locator(sel).inputValue();
 const settle=()=>pdfRenderIdle(page);
 const waitCanvas=(i,n)=>page.waitForFunction(([idx,p])=>{const panel=document.querySelectorAll('.pdf-panel')[idx];const el=[...panel.querySelectorAll('.pdf-page')].find(e=>e.dataset.page===String(p));return !!el&&!!el.querySelector(':scope > canvas');},[i,n],{timeout:45000});
 const waitNoCanvas=(i,n)=>page.waitForFunction(([idx,p])=>{const panel=document.querySelectorAll('.pdf-panel')[idx];const el=[...panel.querySelectorAll('.pdf-page')].find(e=>e.dataset.page===String(p));return !!el&&!el.querySelector(':scope > canvas');},[i,n],{timeout:15000});
 const gotoPage=async(i,n)=>{await field(i,'.page-number').fill(String(n));await field(i,'.page-number').press('Enter');await waitCanvas(i,n);};
 // Mede o que está retido no painel (canvas com backing store vivo e textLayer).
 const retention=async i=>page.evaluate(idx=>{
  const panel=document.querySelectorAll('.pdf-panel')[idx];
  const pages=[...panel.querySelectorAll('.pdf-document > .pdf-page')];
  const canvases=pages.map(el=>el.querySelector(':scope > canvas')).filter(Boolean);
  const bytes=canvases.reduce((sum,c)=>sum+c.width*c.height*4,0);
  const layers=panel.querySelectorAll('.pdf-document .textLayer').length;
  const box=panel.querySelector('.pdf-viewport');
  const visible=pages.filter(el=>el.offsetTop+el.offsetHeight>=box.scrollTop&&el.offsetTop<=box.scrollTop+box.clientHeight);
  const duplicates=pages.filter(el=>el.querySelectorAll(':scope > canvas').length>1).length;
  return {
   pages:pages.length,canvases:canvases.length,bytes,layers,
   rendered:pages.filter(el=>el.dataset.rendered).length,
   rendering:pages.filter(el=>el.dataset.rendering).length,
   duplicates,
   visible:visible.length,
   visibleMissing:visible.filter(el=>!el.querySelector(':scope > canvas')).length,
   visibleLayers:visible.filter(el=>el.querySelector(':scope > .textLayer')).length,
   maxBytes:canvases.reduce((max,c)=>Math.max(max,c.width*c.height*4),0),
   scrollTop:Math.round(box.scrollTop),clientHeight:box.clientHeight
  };
 },i);
 const report=(tag,stats)=>console.log(`RETENTION ${tag} ${JSON.stringify(stats)}`);

 try{
  await page.waitForFunction(()=>document.querySelectorAll('.pdf-panel').length===2,undefined,{timeout:30000});
  await page.waitForFunction(total=>document.querySelectorAll('.pdf-panel')[0]?.querySelectorAll('.pdf-document > .pdf-page').length===total,PAGES,{timeout:30000});
  await page.waitForFunction(()=>document.querySelectorAll('.pdf-panel')[1]?.querySelectorAll('.pdf-document > .pdf-page').length===4,undefined,{timeout:30000});
  // Tamanho fixo para o número de páginas na banda não variar com a máquina.
  await resizeWindow(app,page,1400,900);
  await settle();
  await waitCanvas(0,1);await waitCanvas(1,1);
  check('boot: dois leitores com documento',(await retention(0)).pages===PAGES&&(await retention(1)).pages===4);
  check('boot: página visível pintada nos dois leitores',await page.evaluate(()=>document.querySelectorAll('.pdf-panel').length===2&&[...document.querySelectorAll('.pdf-panel')].every(p=>p.querySelector('.pdf-page[data-rendered] canvas'))));
  check('boot: textLayer visível na página de cada leitor',await page.evaluate(()=>[...document.querySelectorAll('.pdf-panel')].every(p=>p.querySelector('.pdf-page[data-rendered] .textLayer'))));

  const boot=await retention(0);report('boot',boot);

  // ---------- passeio para a frente: 1 → 36 (navegação real) ----------
  for(let n=1;n<=PAGES;n++)await gotoPage(0,n);
  await settle();
  const forward=await retention(0);report('walk-forward',forward);
  const memForward=await app.evaluate(({app})=>app.getAppMetrics().filter(m=>m.type==='Tab').map(m=>Math.round((m.memory?.workingSetSize||0)/1024)));
  console.log(`MEMORY after-walk rendererWSMB=${JSON.stringify(memForward)}`);
  check('passeio até o fim: página visível pintada',forward.visibleMissing===0,`${forward.visibleMissing} sem canvas`);
  check('passeio até o fim: textLayer visível preservado',forward.visibleLayers===forward.visible,`${forward.visibleLayers}/${forward.visible}`);

  // ---------- volta: 36 → 1 (repinta o que o descarte soltou) ----------
  for(let n=PAGES;n>=1;n--)await gotoPage(0,n);
  await settle();
  const back=await retention(0);report('walk-back',back);
  check('volta ao começo: página visível pintada',back.visibleMissing===0,`${back.visibleMissing} sem canvas`);

  // ---------- teletransporte: 30 → 2, guardando o canvas da 30 ----------
  await gotoPage(0,30);
  await settle();
  const held=await page.evaluate(()=>{const c=document.querySelectorAll('.pdf-panel')[0].querySelector('.pdf-page[data-page="30"] canvas');window.__pdfRetentionProbe=c;return !!c;});
  check('teletransporte: canvas da página 30 existe antes de sair',held);
  await gotoPage(0,2);
  if(!BASELINE)await waitNoCanvas(0,30);
  await settle();
  const probe=await page.evaluate(()=>{const c=window.__pdfRetentionProbe;return c?{width:c.width,height:c.height,connected:c.isConnected,inDocument:!!c.closest('.pdf-page')}:null;});
  report('teleport-probe',probe);
  if(!BASELINE){
   check('descarte: canvas fora da janela é solto',!!probe&&!probe.connected,JSON.stringify(probe));
   check('descarte: backing store zerado antes de soltar',!!probe&&probe.width===0&&probe.height===0,JSON.stringify(probe));
   // Render atrasado não pode reinstalar canvas na página descartada.
   await page.waitForTimeout(700);// espera fixa: "nada acontece em 0,7 s" — render atrasado não reinstala canvas na página descartada
   check('descarte: render atrasado não reinstala canvas',await page.evaluate(()=>!document.querySelectorAll('.pdf-panel')[0].querySelector('.pdf-page[data-page="30"] canvas')));
  }

  // ---------- busca depois do descarte ----------
  await field(0,'.find-toggle').click();
  await field(0,'.pdf-find input').fill('Página 30 de 36');
  await field(0,'.pdf-find button').click();
  await page.waitForFunction(()=>{const c=document.querySelectorAll('.pdf-panel')[0].querySelector('.find-count');return !!c&&!c.hidden&&c.textContent.trim()==='1/1';},undefined,{timeout:60000});
  await waitCanvas(0,30);
  const hl=await page.locator('.pdf-panel').nth(0).locator('.pdf-hl').first().textContent();
  check('busca após descarte: acha, navega e destaca',hl==='Página 30 de 36',JSON.stringify(hl));
  await page.keyboard.press('Escape');
  await page.waitForFunction(()=>document.querySelectorAll('.pdf-panel')[0].querySelectorAll('.pdf-hl').length===0,undefined,{timeout:10000});
  check('busca após descarte: Esc limpa o destaque',true);

  // ---------- zoom e rotação depois do descarte ----------
  await field(0,'.in').click();
  await page.waitForFunction(()=>document.querySelectorAll('.pdf-panel')[0].querySelector('.zoom-label').textContent.trim()==='120%',undefined,{timeout:5000});
  await settle();await waitCanvas(0,30);
  const crisp=await page.evaluate(()=>{const c=document.querySelectorAll('.pdf-panel')[0].querySelector('.pdf-page[data-page="30"] canvas');return c?{w:c.width,cw:c.clientWidth,h:c.height,ch:c.clientHeight}:null;});
  check('zoom após descarte: canvas nítido >= 2x o CSS',!!crisp&&crisp.w>=crisp.cw*2-2&&crisp.h>=crisp.ch*2-2,JSON.stringify(crisp));
  await field(0,'.fit').click();
  await page.waitForFunction(()=>document.querySelectorAll('.pdf-panel')[0].querySelector('.zoom-label').textContent.trim()==='100%',undefined,{timeout:5000});
  await settle();await waitCanvas(0,30);
  check('fit após descarte: volta a 100% na mesma página',(await num(0,'.page-number'))==='30',await num(0,'.page-number'));

  await field(0,'.rotate').click();
  await settle();await waitCanvas(0,30);
  const rotated=await retention(0);report('post-rotation',rotated);
  check('rotação após descarte: documento inteiro e página pintada',rotated.pages===PAGES&&rotated.visibleMissing===0,JSON.stringify(rotated));

  // ---------- seleção no textLayer visível ----------
  const selection=await page.evaluate(()=>{
   const panel=document.querySelectorAll('.pdf-panel')[0];
   const box=panel.querySelector('.pdf-viewport');
   const el=[...panel.querySelectorAll('.pdf-document > .pdf-page')].find(e=>{const t=e.querySelector(':scope > .textLayer');return t&&e.offsetTop+e.offsetHeight>=box.scrollTop&&e.offsetTop<=box.scrollTop+box.clientHeight;});
   if(!el)return null;
   const layer=el.querySelector('.textLayer');
   const range=document.createRange();range.selectNodeContents(layer);
   const sel=window.getSelection();sel.removeAllRanges();sel.addRange(range);
   const text=sel.toString();
   sel.removeAllRanges();
   return {text:text.trim(),spans:layer.querySelectorAll('span').length};
  });
  check('seleção: textLayer visível expõe spans selecionáveis',!!selection&&selection.text.length>5&&selection.spans>0,JSON.stringify(selection));

  // ---------- dois leitores: o descarte é por painel ----------
  const other=await retention(1);report('other-reader',other);
  check('dois leitores: o segundo continua pintado e completo',other.pages===4&&other.canvases>=1&&other.visibleMissing===0,JSON.stringify(other));
  await field(1,'.page-number').fill('3');await field(1,'.page-number').press('Enter');await waitCanvas(1,3);
  check('dois leitores: o segundo navega normalmente',(await num(1,'.page-number'))==='3');

  // ---------- corrida: saltos rápidos 1 ↔ 36 sem esperar ----------
  for(let k=0;k<12;k++){const n=k%2?PAGES:1;await field(0,'.page-number').fill(String(n));await field(0,'.page-number').press('Enter');}
  await gotoPage(0,PAGES);
  await settle();
  const race=await retention(0);report('race',race);
  check('corrida: nenhum render preso',race.rendering===0,`${race.rendering} renderizando`);
  check('corrida: nenhum canvas duplicado',race.duplicates===0,`${race.duplicates} duplicados`);
  check('corrida: página final visível pintada',race.visibleMissing===0);

  // ---------- orçamento (só depois do descarte) ----------
  if(BASELINE){
   console.log(`BASELINE: retenção medida sem exigir limite (boot=${boot.canvases}, forward=${forward.canvases}, back=${back.canvases}, bytes forward=${(forward.bytes/1048576).toFixed(1)}MB)`);
  }else{
   const perCanvas=Math.max(forward.maxBytes,back.maxBytes,boot.maxBytes,1);
   check('orçamento: canvas retidos não crescem com o documento',forward.canvases<=MAX_RETAINED,`${forward.canvases} (teto ${MAX_RETAINED})`);
   check('orçamento: bytes retidos limitados pelo teto de canvases',forward.bytes<=MAX_RETAINED*perCanvas,`${(forward.bytes/1048576).toFixed(1)}MB (teto ${(MAX_RETAINED*perCanvas/1048576).toFixed(1)}MB)`);
   check('orçamento: volta não acumula (histerese)',back.canvases<=MAX_RETAINED,`${back.canvases} (teto ${MAX_RETAINED})`);
   check('orçamento: corrida não vaza canvas',race.canvases<=MAX_RETAINED,`${race.canvases} (teto ${MAX_RETAINED})`);
   check('orçamento: textLayer retidos acompanham os canvases',forward.layers<=MAX_RETAINED,`${forward.layers} (teto ${MAX_RETAINED})`);
   check('orçamento: baseline de boot já era pequeno',boot.canvases<=4&&boot.bytes<=perCanvas*4,`${boot.canvases} canvases, ${(boot.bytes/1048576).toFixed(1)}MB`);
  }

  const metrics=await app.evaluate(({app})=>app.getAppMetrics().map(m=>({type:m.type,pid:m.pid,wsMB:Math.round((m.memory?.workingSetSize||0)/1024),privateMB:Math.round((m.memory?.privateBytes||0)/1024)})));
  console.log(`MEMORY app ${JSON.stringify(metrics)}`);

  let log='';
  try{log=fs.readFileSync(path.join(runtime,'desk.log'),'utf8');}catch{}
  const rendererLog=log.split('\n').filter(Boolean).map(l=>{try{return JSON.parse(l);}catch{return null;}}).filter(e=>e&&e.area==='renderer');
  check('sem erro de renderer no desk.log',rendererLog.length===0,rendererLog.slice(0,2).map(e=>e.msg).join(' | '));
  check('sem pageerror',pageErrors.length===0,pageErrors.slice(0,3).join(' | '));
  check('sem erro no console',consoleErrors.length===0,consoleErrors.slice(0,3).join(' | '));
 }catch(e){
  check('execução do roteiro',false,e.stack?.split('\n').slice(0,3).join(' | ')||e.message);
 }

 console.log(`\nHUNT PDF RETENTION: ${failures} falha(s)${BASELINE?' (modo baseline: limites de descarte não exigidos)':''}`);
 if(failures)throw new Error(`hunt-pdf-retention: ${failures} falha(s) (artefatos salvos pelo harness)`);
});
