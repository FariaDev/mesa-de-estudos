// Caça a bugs do leitor de PDF da Mesa: fase offline (fuzz do destaque da
// busca contra o algoritmo do Electron antigo) + fase de app (harness do
// ui-smoke, runtime temporário, fake Pi, PDFs gerados no runtime).
// Roda da pasta desk: `node tests/hunt-pdf.mjs`.
import path from 'node:path';import fs from 'node:fs';import {fileURLToPath} from 'node:url';
import {withArtifacts,launchDesk,newRuntime,seedCourse,writeDeskJson,writeConfigJson,statusOnline,toastWait} from './helpers.mjs';
import pdfPage from '../src/generated/pdfpageview.core.js';

/* ------------------------------------------------------------------ */
/* Fase 0 — fuzz do realce (hlSegments × algoritmo antigo do pdf.mjs)  */
/* ------------------------------------------------------------------ */

const FOLD_MAP={á:'a',à:'a',â:'a',ã:'a',ä:'a',å:'a',é:'e',è:'e',ê:'e',ë:'e',í:'i',ì:'i',î:'i',ï:'i',ó:'o',ò:'o',ô:'o',õ:'o',ö:'o',ú:'u',ù:'u',û:'u',ü:'u',ç:'c',ñ:'n',ý:'y',ÿ:'y'};
const fold=text=>String(text??'').toLowerCase().replace(/[áàâãäåéèêëíìîïóòôõöúùûüçñýÿ]/g,ch=>FOLD_MAP[ch]||ch);
// Algoritmo do `highlightLayer` pré-rewrite (git 7075557:desk/src/pdf.mjs):
// busca na dobra (`lower`) e recorta o texto original.
function oldHighlight(text,folded,term){
 const out=[];let pos=0;
 for(;;){
  const idx=folded.indexOf(term,pos);
  if(idx<0){if(pos<text.length)out.push({t:'text',s:text.slice(pos)});break;}
  if(idx>pos)out.push({t:'text',s:text.slice(pos,idx)});
  out.push({t:'mark',s:text.slice(idx,idx+term.length)});
  pos=idx+term.length;
 }
 return out;
}
function listToArray(nodes){const out=[];for(let cur=nodes;cur&&cur.$==='Con';cur=cur.tail)out.push(cur.head);return out;}
function newHighlight(text,folded,term){
 return listToArray(pdfPage.hlSegments(text,folded,term)).map(node=>node.$==='ViewEl'
  ?{t:'mark',s:node.kids.head.text}
  :{t:'text',s:node.text});
}
const shape=segs=>segs.map(s=>`${s.t==='mark'?'[':'`'}${s.s}${s.t==='mark'?']':'`'}`).join('');
let seed=0xC0FFEE;
const rnd=n=>{seed=(seed*1103515245+12345)>>>0;return seed%n;};
const ALPHABET='abcáàãçéíóúÇÃÉAB 0123456789';
function fuzzHighlight(cases){
 let checked=0,bad=0;
 for(let i=0;i<cases;i++){
  const len=1+rnd(24);
  let text='';for(let k=0;k<len;k++)text+=ALPHABET[rnd(ALPHABET.length)];
  const folded=fold(text);
  // termo: trecho da dobra (força casamento) metade das vezes; lixo na outra.
  let term;
  if(rnd(2)===0&&len>1){const start=rnd(len);term=folded.slice(start,start+1+rnd(len-start));}
  else{const tlen=1+rnd(3);for(let k=0;k<tlen;k++)term+=ALPHABET[rnd(ALPHABET.length)];}
  if(!term)continue;
  const oldSegs=folded.includes(term)?oldHighlight(text,folded,term):[{t:'text',s:text}];
  const newSegs=newHighlight(text,folded,term);
  const same=shape(oldSegs)===shape(newSegs);
  const joined=newSegs.map(s=>s.s).join('');
  if(!same||joined!==text){
   bad++;
   if(bad<=5)console.error(`FUZZ divergiu:\n  text=${JSON.stringify(text)}\n  term=${JSON.stringify(term)}\n  old=${shape(oldSegs)}\n  new=${shape(newSegs)}\n  join=${JSON.stringify(joined)}`);
  }
  checked++;
 }
 return {checked,bad};
}

/* ------------------------------------------------------------------ */
/* PDFs de teste no runtime (multi-página, WinAnsi p/ acentos)         */
/* ------------------------------------------------------------------ */

function pdfBytes(objects){
 let out='%PDF-1.4\n';const offsets=[];
 objects.forEach((obj,i)=>{offsets.push(out.length);out+=`${i+1} 0 obj\n${obj}\nendobj\n`;});
 const startxref=out.length;
 out+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.map(off=>`${String(off).padStart(10,'0')} 00000 n \n`).join('')}trailer\n<</Size ${objects.length+1}/Root 1 0 R>>\nstartxref\n${startxref}\n%%EOF\n`;
 return Buffer.from(out,'latin1');
}
// N páginas, uma linha por página (`line(n,total)`), Helvetica/WinAnsi.
function multiPagePdf(count,line){
 const objects=['<</Type/Catalog/Pages 2 0 R>>',`<</Type/Pages/Kids[${Array.from({length:count},(_,i)=>`${4+i} 0 R`).join(' ')}]/Count ${count}>>`,'<</Type/Font/Subtype/Type1/BaseFont/Helvetica/Encoding/WinAnsiEncoding>>'];
 for(let i=0;i<count;i++)objects.push(`<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Resources<</Font<</F1 3 0 R>>>>/Contents ${4+count+i} 0 R>>`);
 for(let i=0;i<count;i++){
  const contents=`BT /F1 16 Tf 72 720 Td (${String(line(i+1,count)).replace(/([\\()])/g,'\\$1')}) Tj ET`;
  objects.push(`<</Length ${Buffer.byteLength(contents,'latin1')}>>\nstream\n${contents}\nendstream`);
 }
 return pdfBytes(objects);
}

/* ------------------------------------------------------------------ */
/* Fase 1 — app                                                         */
/* ------------------------------------------------------------------ */

await withArtifacts('hunt-pdf',async ctx=>{
 // ---------- offline ----------
 const fuzz=fuzzHighlight(30000);
 console.log(`FASE offline: ${fuzz.checked} casos de destaque, ${fuzz.bad} divergências`);
 let failures=0;
 const check=(name,cond,detail='')=>{if(!cond)failures++;console.log(`${cond?'ok  ':'FAIL'} ${name}${detail?` — ${detail}`:''}`);};
 check('hlSegments: paridade com o algoritmo antigo',fuzz.bad===0,`${fuzz.bad} divergências`);

 // ---------- runtime ----------
 const runtime=ctx.runtime=newRuntime('hunt-pdf');
 const stress=seedCourse(runtime,'Estresse');
 const lista=path.join(stress,'Lista.pdf');
 const formul=path.join(stress,'Formul.pdf');
 const extra=path.join(stress,'Extra.pdf');
 fs.writeFileSync(lista,multiPagePdf(220,(n,total)=>`Página ${n} de ${total} - integral comum`));
 fs.writeFileSync(formul,multiPagePdf(3,(n,total)=>`Fórmula ${n}: ação`));
 fs.writeFileSync(extra,multiPagePdf(1,()=>`Outro documento qualquer`));
 const vazia=seedCourse(runtime,'Vazia');
 writeDeskJson(runtime,{courseId:'Estresse',pdfs:[{path:lista,page:200,zoom:1.4,scrollX:0,scrollY:0,invert:false},{path:formul,minimized:true}],layoutVersion:1});
 writeConfigJson(runtime,{
  vaultPath:runtime,
  courses:[{id:'Estresse',name:'Estresse',path:stress},{id:'Vazia',name:'Vazia',path:vazia}],
  desk:{panels:[{label:'Lista',prefer:['Lista']},{label:'Formulário',prefer:['Formul']}]}
 });
 const app=ctx.app=await launchDesk({runtime,env:{LEARNING_VAULT:runtime}});
 const page=await app.firstWindow();
 const pageErrors=[],consoleErrors=[];
 page.on('pageerror',e=>pageErrors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
 const p0=page.locator('.pdf-panel').nth(0);
 const p1=page.locator('.pdf-panel').nth(1);
 const settle=ms=>page.waitForTimeout(ms);
 const field=(idx,sel)=>page.locator('.pdf-panel').nth(idx).locator(sel);
 const num=(idx,sel)=>page.locator('.pdf-panel').nth(idx).locator(sel).inputValue();
 /* 45s (e não 30s): a suíte roda hunts em paralelo e o doc de 220 páginas
    atrasa a pintura sob carga — o timeout curto virava falso negativo. */
 const waitNum=(idx,value)=>page.waitForFunction(([i,v])=>document.querySelectorAll('.pdf-panel')[i]?.querySelector('.page-number')?.value===String(v),[idx,value],{timeout:45000});
 const waitCanvas=(idx,n)=>page.waitForFunction(([i,p])=>{const panel=document.querySelectorAll('.pdf-panel')[i];const el=[...panel.querySelectorAll('.pdf-page')].find(e=>e.dataset.page===String(p));return !!el&&!!el.querySelector('canvas');},[idx,n],{timeout:45000});
 const waitFindText=(idx,text)=>page.waitForFunction(([i,t])=>{const panel=document.querySelectorAll('.pdf-panel')[i];const c=panel?.querySelector('.find-count');return !!c&&!c.hidden&&c.textContent.trim()===t;},[idx,text],{timeout:60000});

 try{
  await page.waitForSelector('.pdf-panel .pdf-document .pdf-page',{timeout:30000});
  await page.waitForFunction(()=>document.querySelectorAll('.pdf-panel').length===2,undefined,{timeout:15000});
  check('boot: dois leitores com PDFs',await page.locator('.pdf-panel .pdf-document').count()===2);
  check('boot: Lista tem 220 âncoras de página',await p0.locator('.pdf-document > .pdf-page').count()===220,`${await p0.locator('.pdf-document > .pdf-page').count()}`);
  check('boot: Formul tem 3 âncoras de página',await p1.locator('.pdf-document > .pdf-page').count()===3);

  // restauração do desk.json: página 200 e zoom 140%
  await waitNum(0,200);
  check('boot: restaura página 200 do desk.json',true);
  check('boot: restaura zoom 140% do desk.json',(await field(0,'.zoom-label').textContent()).trim()==='140%',(await field(0,'.zoom-label').textContent()).trim());
  await waitCanvas(0,200);
  check('boot: canvas da página 200 pintado',true);

  // virtualização: só a banda visível renderiza
  const rendered=await page.evaluate(()=>document.querySelectorAll('.pdf-panel')[0].querySelectorAll('.pdf-page[data-rendered]').length);
  check('virtualização: páginas renderizadas bem abaixo de 220',rendered>0&&rendered<25,`${rendered} renderizadas`);
  check('sem shimmer preso: páginas visíveis têm data-rendered',await page.evaluate(()=>{const panel=document.querySelectorAll('.pdf-panel')[0];const box=panel.querySelector('.pdf-viewport');return [...panel.querySelectorAll('.pdf-page')].filter(el=>el.offsetTop+el.offsetHeight>=box.scrollTop&&el.offsetTop<=box.scrollTop+box.clientHeight).every(el=>el.dataset.rendered);}));
  check('total do rodapé bate com o documento',(await field(0,'.page-total').textContent()).trim()==='/ 220',(await field(0,'.page-total').textContent()).trim());

  // leitor 2 nasce minimizado (fechou assim): ícone no boot e restauração
  check('boot: leitor minimizado nasce com classe e aria-pressed',await page.evaluate(()=>{const p=document.querySelectorAll('.pdf-panel')[1];return p.classList.contains('minimized')&&p.querySelector('.collapse').getAttribute('aria-pressed')==='true';}));
  check('boot: leitor minimizado nasce com o SVG do colapsar',(await field(1,'.collapse svg.icon').count())===1);
  await field(1,'.collapse').click();
  await page.waitForFunction(()=>!document.querySelectorAll('.pdf-panel')[1].classList.contains('minimized'),undefined,{timeout:5000});
  await waitCanvas(1,1);
  check('restaurar o leitor minimizado no boot repinta a página',true);
  check('restaurar o leitor minimizado mantém a página 1',(await num(1,'.page-number'))==='1');
  check('rodapé do leitor restaurado fica pronto',(await field(1,'.pdf-foot').textContent()).includes('Página 1 de 3 · rolagem contínua · Formul.pdf'),(await field(1,'.pdf-foot').textContent()).trim());

  // nitidez: canvas com fator >= 2 (dpr ou 2)
  const crisp=await page.evaluate(()=>{const c=document.querySelectorAll('.pdf-panel')[0].querySelector('.pdf-page[data-page="200"] canvas');return c?{w:c.width,cw:c.clientWidth}:null;});
  check('canvas nítido: backing store >= 2x o CSS',!!crisp&&crisp.w>=crisp.cw*2-2,JSON.stringify(crisp));

  // navegação: last/next/prev disabled e clamp do input
  await field(0,'.page-number').fill('220');await field(0,'.page-number').press('Enter');await waitNum(0,220);
  check('next desabilitado na última página',await field(0,'.next').isDisabled());
  check('prev habilitado na última página',!(await field(0,'.prev').isDisabled()));
  await field(0,'.page-number').fill('999');await field(0,'.page-number').press('Enter');await waitNum(0,220);
  check('página acima do total clampa na última',true);
  await field(0,'.page-number').fill('0');await field(0,'.page-number').press('Enter');await waitNum(0,1);
  check('página 0 clampa na primeira',true);
  await waitCanvas(0,1);
  check('prev desabilitado na primeira página',await field(0,'.prev').isDisabled());
  check('next habilitado na primeira página',!(await field(0,'.next').isDisabled()));

  // scroll até a página 100 e zoom durante o scroll (assenta o layout: um
  // render em voo ignora o scroll e o `scrollY` do host ficaria velho)
  await page.evaluate(()=>{const panel=document.querySelectorAll('.pdf-panel')[0],box=panel.querySelector('.pdf-viewport'),pg=[...panel.querySelectorAll('.pdf-page')].find(e=>e.dataset.page==='100');box.scrollTop=pg.offsetTop;box.dispatchEvent(new Event('scroll'));});
  await page.waitForTimeout(300);
  await page.evaluate(()=>{const panel=document.querySelectorAll('.pdf-panel')[0],box=panel.querySelector('.pdf-viewport');box.dispatchEvent(new Event('scroll'));});
  await waitNum(0,100);
  const beforeZoom=await page.evaluate(()=>document.querySelectorAll('.pdf-panel')[0].querySelector('.pdf-viewport').scrollTop);
  await field(0,'.in').click();
  check('zoom: rótulo atualiza na hora',(await field(0,'.zoom-label').textContent()).trim()==='160%',(await field(0,'.zoom-label').textContent()).trim());
  await settle(900);await waitCanvas(0,100);
  check('zoom durante o scroll mantém a página atual',(await num(0,'.page-number'))==='100',(await num(0,'.page-number')));
  const zoomed=await page.evaluate(()=>{const panel=document.querySelectorAll('.pdf-panel')[0],box=panel.querySelector('.pdf-viewport'),pg=[...panel.querySelectorAll('.pdf-page')].find(e=>e.dataset.page==='100');return {top:box.scrollTop,pgTop:pg.offsetTop,pgBottom:pg.offsetTop+pg.offsetHeight,boxBottom:box.scrollTop+box.clientHeight};});
  check('zoom durante o scroll preserva a posição',zoomed.top>=zoomed.pgTop-2&&zoomed.top<=zoomed.pgBottom&&zoomed.top>beforeZoom,JSON.stringify({antes:Math.round(beforeZoom),...Object.fromEntries(Object.entries(zoomed).map(([k,v])=>[k,Math.round(v)]))}));

  // zoom pelo wheel com ctrl
  const zoomBefore=await field(0,'.zoom-label').textContent();
  await field(0,'.pdf-viewport').evaluate(el=>el.dispatchEvent(new WheelEvent('wheel',{deltaY:-100,ctrlKey:true,bubbles:true,cancelable:true})));
  await settle(200);
  check('ctrl+wheel aumenta o zoom',parseInt(await field(0,'.zoom-label').textContent(),10)>parseInt(zoomBefore,10),`${zoomBefore} → ${await field(0,'.zoom-label').textContent()}`);
  await settle(900);
  check('ctrl+wheel não perde a página',(await num(0,'.page-number'))==='100',(await num(0,'.page-number')));

  // redimensionar a janela mantém a página
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1050,760));
  await settle(1200);
  check('redimensionar a janela mantém a página atual',(await num(0,'.page-number'))==='100',(await num(0,'.page-number')));
  await waitCanvas(0,100);
  check('redimensionar a janela repinta a página visível',true);

  // ajustar à largura volta o zoom para 100% e mantém a página
  await field(0,'.fit').click();
  await page.waitForFunction(()=>document.querySelectorAll('.pdf-panel')[0].querySelector('.zoom-label').textContent.trim()==='100%',undefined,{timeout:5000});
  await settle(900);
  check('fit zera o zoom e mantém a página atual',(await num(0,'.page-number'))==='100',(await num(0,'.page-number')));
  await field(0,'.in').click();
  await settle(900);

  // colapso/expansão: ícone sobrevive ao swap e foco de teclado fica
  check('collapse: SVG antes de minimizar',(await field(0,'.collapse svg.icon').count())===1);
  await field(0,'.collapse').click();
  await page.waitForFunction(()=>document.querySelector('.pdf-panel').classList.contains('minimized'),undefined,{timeout:5000});
  check('collapse: SVG depois de minimizar (swapInto re-iconiza)',(await field(0,'.collapse svg.icon').count())===1);
  check('collapse: andaime data-icon não vaza',(await field(0,'.collapse').getAttribute('data-icon'))===null);
  await field(0,'.collapse').click();
  await page.waitForFunction(()=>!document.querySelector('.pdf-panel').classList.contains('minimized'),undefined,{timeout:5000});
  check('collapse: SVG depois de restaurar',(await field(0,'.collapse svg.icon').count())===1);
  await field(0,'.collapse').focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(()=>document.querySelector('.pdf-panel').classList.contains('minimized'),undefined,{timeout:5000});
  check('collapse: foco continua no botão (teclado)',await page.evaluate(()=>document.activeElement?.classList.contains('collapse')));
  await page.keyboard.press('Enter');
  await page.waitForFunction(()=>!document.querySelector('.pdf-panel').classList.contains('minimized'),undefined,{timeout:5000});
  check('collapse: restaurar devolve o foco',await page.evaluate(()=>document.activeElement?.classList.contains('collapse')));

  // os dois leitores minimizados: classes do grid por combinação
  const gridClasses=()=>page.evaluate(()=>({otherMin:document.querySelector('#pdf-grid').classList.contains('other-min'),hasMin:document.querySelector('#pdf-grid').classList.contains('has-min'),hasOtherMin:document.querySelector('#pdf-grid').classList.contains('has-other-min')}));
  await field(0,'.collapse').click();
  await field(1,'.collapse').click();
  await page.waitForFunction(()=>document.querySelectorAll('.pdf-panel.minimized').length===2,undefined,{timeout:5000});
  const bothMin=await gridClasses();
  check('grid: os dois minimizados = has-min, sem other-min',bothMin.hasMin&&!bothMin.otherMin&&!bothMin.hasOtherMin,JSON.stringify(bothMin));
  await field(1,'.collapse').click();
  await page.waitForFunction(()=>document.querySelectorAll('.pdf-panel.minimized').length===1,undefined,{timeout:5000});
  const onlyFirst=await gridClasses();
  check('grid: só o primeiro minimizado = other-min + has-min',onlyFirst.otherMin&&onlyFirst.hasMin&&!onlyFirst.hasOtherMin,JSON.stringify(onlyFirst));
  await field(0,'.collapse').click();
  await page.waitForFunction(()=>document.querySelectorAll('.pdf-panel.minimized').length===0,undefined,{timeout:5000});
  const noneMin=await gridClasses();
  check('grid: nenhum minimizado = sem classes',!noneMin.otherMin&&!noneMin.hasMin&&!noneMin.hasOtherMin,JSON.stringify(noneMin));

  // busca com acentos/caixa no painel 1 (3 páginas "Fórmula N: ação")
  await field(1,'.find-toggle').click();
  await field(1,'.pdf-find input').fill('AÇÃO');
  await field(1,'.pdf-find button').click();
  await waitFindText(1,'1/3');
  check('busca com acento e caixa encontra as 3 ocorrências',true);
  const hl=await p1.locator('.pdf-hl').first().evaluate(el=>({tag:el.tagName,text:el.textContent,cls:el.className}));
  check('destaque preserva o texto original',hl.tag==='I'&&hl.text==='ação'&&hl.cls==='pdf-hl',JSON.stringify(hl));
  await field(1,'.pdf-find button').click();
  await waitFindText(1,'2/3');
  check('ciclo da busca avança para a próxima página',(await num(1,'.page-number'))==='2',(await num(1,'.page-number')));
  await field(1,'.pdf-find input').fill('FÓRMULA');
  await field(1,'.pdf-find button').click();
  await waitFindText(1,'1/3');
  check('termo novo volta para a primeira ocorrência',(await num(1,'.page-number'))==='1',(await num(1,'.page-number')));
  await field(1,'.pdf-find input').fill('inexistente');
  await field(1,'.pdf-find button').click();
  await toastWait(page,'Texto não encontrado');
  await page.waitForFunction(()=>document.querySelectorAll('.pdf-panel')[1]?.querySelectorAll('.pdf-hl').length===0,undefined,{timeout:10000});
  check('termo sem casamento não destaca nada',true);
  await page.keyboard.press('Escape');
  await page.waitForFunction(()=>document.querySelectorAll('.pdf-panel')[1]?.querySelector('.pdf-find')?.hidden===true,undefined,{timeout:5000});
  await page.waitForFunction(()=>document.querySelectorAll('.pdf-panel')[1]?.querySelectorAll('.pdf-hl').length===0,undefined,{timeout:5000});
  check('Esc limpa os destaques e esconde o contador',await field(1,'.find-count').isHidden());
  check('Esc devolve o foco ao painel',await page.evaluate(()=>document.querySelectorAll('.pdf-panel')[1].contains(document.activeElement)));

  // concorrência: a PRIMEIRA busca no doc grande (varredura sem cache de texto)
  // e troca de documento no meio dela. A troca é agendada dentro da página
  // (~30ms) para cair na janela em que a varredura ainda roda e o PDF novo
  // ainda não abriu — a corrida que prendia o contador antigo.
  await field(0,'.find-toggle').click();
  await field(0,'.pdf-find input').fill('integral comum');
  await field(0,'.pdf-find button').click();
  await page.evaluate(extraPath=>{setTimeout(()=>{const s=document.querySelectorAll('.pdf-panel')[0].querySelector('.pdf-select');s.value=extraPath;s.dispatchEvent(new Event('change',{bubbles:true}));},30);},extra);
  await page.waitForFunction(()=>document.querySelectorAll('.pdf-panel')[0].querySelector('.pdf-foot')?.textContent.includes('Extra.pdf'),undefined,{timeout:30000});
  await page.waitForFunction(()=>document.querySelectorAll('.pdf-panel')[0].querySelectorAll('.pdf-page').length===1,undefined,{timeout:30000});
  await page.waitForFunction(()=>{const b=document.querySelectorAll('.pdf-panel')[0].querySelector('.pdf-find button');return b&&!b.disabled&&b.textContent==='Buscar';},undefined,{timeout:30000});
  check('trocar de doc no meio da busca não deixa botão preso',true);
  await page.waitForFunction(()=>document.querySelectorAll('.pdf-panel')[0].querySelector('.find-count').hidden,undefined,{timeout:10000});
  check('trocar de doc no meio da busca não herda o contador antigo',true);
  await page.waitForFunction(()=>document.querySelectorAll('.pdf-panel')[0].querySelectorAll('.pdf-hl').length===0,undefined,{timeout:10000});
  check('trocar de doc no meio da busca não deixa destaque preso',true);

  // restaurar layout por documento (docMemo), sem corrida: página/zoom
  // explícitos antes de sair; Extra → Lista tem que voltar neles.
  await field(0,'.pdf-select').selectOption(lista);
  await page.waitForFunction(()=>document.querySelectorAll('.pdf-panel')[0].querySelector('.page-total').textContent==='/ 220',undefined,{timeout:30000});
  await field(0,'.page-number').fill('150');await field(0,'.page-number').press('Enter');await waitNum(0,150);
  await field(0,'.in').click();
  await settle(900);
  const memoPage=await num(0,'.page-number'),memoZoom=(await field(0,'.zoom-label').textContent()).trim();
  await field(0,'.pdf-select').selectOption(extra);
  await page.waitForFunction(()=>document.querySelectorAll('.pdf-panel')[0].querySelectorAll('.pdf-page').length===1,undefined,{timeout:30000});
  await field(0,'.pdf-select').selectOption(lista);
  await page.waitForFunction(()=>document.querySelectorAll('.pdf-panel')[0].querySelector('.page-total').textContent==='/ 220',undefined,{timeout:30000});
  await waitNum(0,Number(memoPage));
  check('voltar para o doc anterior restaura página (docMemo)',true);
  check('voltar para o doc anterior restaura zoom',(await field(0,'.zoom-label').textContent()).trim()===memoZoom,`${await field(0,'.zoom-label').textContent()} vs ${memoZoom}`);
  await waitCanvas(0,Number(memoPage));

  // busca longa no doc de 220 páginas + contador por página
  await field(0,'.pdf-find input').fill('integral comum');
  await field(0,'.pdf-find button').click();
  await waitFindText(0,'1/220');
  check('busca no doc grande: primeira ocorrência da página 1',(await num(0,'.page-number'))==='1');
  await field(0,'.pdf-find button').click();
  await waitFindText(0,'2/220');
  check('busca no doc grande: ciclo avança para a página 2',(await num(0,'.page-number'))==='2',(await num(0,'.page-number')));
  await field(0,'.page-number').fill('200');await field(0,'.page-number').press('Enter');await waitNum(0,200);
  await waitFindText(0,'200/220');
  check('contador acompanha a página atual (200/220)',true);
  const hl0=await p0.locator('.pdf-hl').first().evaluate(el=>el.textContent);
  check('destaque no doc grande usa o texto original',hl0==='integral comum',hl0);
  await field(0,'.in').click();
  await settle(900);
  await page.waitForFunction(()=>{const c=document.querySelectorAll('.pdf-panel')[0].querySelector('.find-count');return !!c&&!c.hidden&&/^\d+\/220$/.test(c.textContent.trim());},undefined,{timeout:10000});
  const zoomPage=Number(await num(0,'.page-number'));
  check('zoom com busca ativa mantém contador e destaque',Math.abs(zoomPage-200)<=2&&(await p0.locator('.pdf-hl').count())>0,`página ${zoomPage}, ${await p0.locator('.pdf-hl').count()} destaques`);

  // contador fora da página do hit: "N ocorrências"
  await field(0,'.pdf-find input').fill('Página 200');
  await field(0,'.pdf-find button').click();
  await waitFindText(0,'1/1');
  check('termo de ocorrência única vai para a página 200',(await num(0,'.page-number'))==='200',(await num(0,'.page-number')));
  await field(0,'.page-number').fill('1');await field(0,'.page-number').press('Enter');await waitNum(0,1);
  await waitFindText(0,'1 ocorrências');
  check('contador na página sem hit mostra o total',true);
  await field(0,'.page-number').fill('200');await field(0,'.page-number').press('Enter');await waitNum(0,200);

  // divisor: limites de 20%/80% e passos de teclado
  const gridBox=await page.locator('#pdf-grid').boundingBox();
  const divider=page.locator('.pdf-divider');
  const divBox=await divider.boundingBox();
  await page.mouse.move(divBox.x+divBox.width/2,divBox.y+divBox.height/2);
  await page.mouse.down();
  await page.mouse.move(gridBox.x+2,divBox.y+divBox.height/2,{steps:3});
  await page.mouse.up();
  const splitLeft=await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--pdf-left').trim());
  check('divisor clampa no mínimo de 20%',splitLeft==='20%',splitLeft);
  await divider.focus();await page.keyboard.press('ArrowLeft');
  check('ArrowLeft no limite não passa de 20%',(await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--pdf-left').trim()))==='20%');
  await page.keyboard.press('ArrowRight');
  check('ArrowRight anda 2%',(await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--pdf-left').trim()))==='22%');
  const divBox2=await divider.boundingBox();
  await page.mouse.move(divBox2.x+divBox2.width/2,divBox2.y+divBox2.height/2);
  await page.mouse.down();
  await page.mouse.move(gridBox.x+gridBox.width-2,divBox2.y+divBox2.height/2,{steps:3});
  await page.mouse.up();
  check('divisor clampa no máximo de 80%',(await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--pdf-left').trim()))==='80%');

  // ☑ página 200 como imagem no chat
  await field(0,'.page-shot').click();
  await page.waitForSelector('#attachments .attachment img',{timeout:15000});
  check('page-shot anexa a página restaurada',/p200\.png/.test(await page.locator('#attachments .attachment img').getAttribute('alt')));
  await page.locator('#attachments .attachment-remove').click();

  // troca de matéria: ida e volta com layout salvo
  await statusOnline(page);
  const beforeSwitch=await page.evaluate(()=>({page:document.querySelectorAll('.pdf-panel')[0].querySelector('.page-number').value,zoom:document.querySelectorAll('.pdf-panel')[0].querySelector('.zoom-label').textContent}));
  await page.locator('#course-tabs button[data-id="Vazia"]').click();
  await page.waitForFunction(()=>document.querySelector('#course-tabs button[data-id="Vazia"]').classList.contains('active'),undefined,{timeout:30000});
  await page.waitForFunction(()=>document.querySelectorAll('.pdf-panel')[0]?.querySelector('.pdf-placeholder'),undefined,{timeout:30000});
  check('matéria vazia mostra placeholders',await page.locator('.pdf-placeholder').count()===2);
  const emptyAria=await page.evaluate(()=>document.querySelectorAll('.pdf-panel')[0]?.querySelector('.invert')?.getAttribute('aria-pressed'));
  check('invert sem doc mantém aria-pressed="false" do contrato antigo',emptyAria==='false',`aria-pressed=${JSON.stringify(emptyAria)}`);
  await page.locator('#course-tabs button[data-id="Estresse"]').click();
  await page.waitForFunction(()=>document.querySelector('#course-tabs button[data-id="Estresse"]').classList.contains('active'),undefined,{timeout:30000});
  await waitNum(0,Number(beforeSwitch.page));
  check('volta da matéria restaura página',(await num(0,'.page-number'))===String(beforeSwitch.page));
  check('volta da matéria restaura zoom',(await field(0,'.zoom-label').textContent()).trim()===beforeSwitch.zoom.trim(),`${await field(0,'.zoom-label').textContent()} vs ${beforeSwitch.zoom}`);
  await waitCanvas(0,Number(beforeSwitch.page));

  // busca num doc recém-trocado não herda estado
  check('doc recém-trocado começa sem contador',await field(0,'.find-count').isHidden());
 }catch(e){
  check('execução do roteiro',false,e.stack?.split('\n').slice(0,3).join(' | ')||e.message);
 }
 await page.screenshot({path:path.join(path.dirname(fileURLToPath(import.meta.url)),'artifacts','hunt-pdf-final.png')}).catch(()=>{});

 // log do runtime
 let log='';
 try{log=fs.readFileSync(path.join(runtime,'desk.log'),'utf8');}catch{}
 const rendererLog=log.split('\n').filter(Boolean).map(l=>{try{return JSON.parse(l);}catch{return null;}}).filter(e=>e&&e.src==='renderer');
 check('sem erro de renderer no desk.log',rendererLog.length===0,rendererLog.slice(0,2).map(e=>e.line).join(' | '));
 check('sem pageerror',pageErrors.length===0,pageErrors.slice(0,3).join(' | '));
 check('sem erro no console',consoleErrors.length===0,consoleErrors.slice(0,3).join(' | '));

 console.log(`\nHUNT PDF: ${failures} falha(s)`);
 if(failures)throw new Error(`hunt-pdf: ${failures} falha(s) (artefatos salvos pelo harness)`);
});
