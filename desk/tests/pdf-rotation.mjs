// Rotação de 90° por leitor (pedido do usuário: "girar o PDF").
//
// Foco: ciclo 0→90→180→270→0 somado à rotação NATIVA da página, geometria do
// canvas/textLayer por orientação (dimensões e pixels do marcador), página
// atual mantida, leitores independentes, troca A→B→A, giro rápido durante o
// render, estado no disco entre execuções, legado/inválido (string/fração),
// mesmo PDF nos dois leitores (snapshot por painel vence o mapa, 0 incluído),
// troca de matéria com o mapa por curso, fit/zoom/busca/seleção/captura
// girados e a barra em 900x650. PDFs sintéticos no runtime do teste; nada real
// é tocado. Roda da pasta desk: `node tests/pdf-rotation.mjs`.
import path from 'node:path';import fs from 'node:fs';
import {withArtifacts,launchDesk,newRuntime,seedCourse,writeDeskJson,writeConfigJson,toastWait,statusOnline} from './helpers.mjs';

/* ------------------------------------------------------------------ */
/* PDFs de teste: 400x700 assimétricos, marcador vermelho no canto     */
/* superior esquerdo (coordenadas do PDF) e texto pesquisável. A página*/
/* 1 pode nascer com /Rotate 90 nativo; a 2 nasce em pé.               */
/* ------------------------------------------------------------------ */

function pdfBytes(objects){
 let out='%PDF-1.4\n';const offsets=[];
 objects.forEach((obj,i)=>{offsets.push(out.length);out+=`${i+1} 0 obj\n${obj}\nendobj\n`;});
 const startxref=out.length;
 out+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.map(off=>`${String(off).padStart(10,'0')} 00000 n \n`).join('')}trailer\n<</Size ${objects.length+1}/Root 1 0 R>>\nstartxref\n${startxref}\n%%EOF\n`;
 return Buffer.from(out,'latin1');
}
function asymmetricPdf({nativeRotate=false}={}){
 const marker='1 0 0 rg 0 600 100 100 re f';
 const text=n=>`BT /F1 16 Tf 72 320 Td (pagina ${n} marcador) Tj ET`;
 const contents=[`${marker}\n${text('um')}`,`${marker}\n${text('dois')}`];
 const page1=`<</Type/Page/Parent 2 0 R/MediaBox[0 0 400 700]${nativeRotate?'/Rotate 90':''}/Resources<</Font<</F1 5 0 R>>>>/Contents 6 0 R>>`;
 const page2='<</Type/Page/Parent 2 0 R/MediaBox[0 0 400 700]/Resources<</Font<</F1 5 0 R>>>>/Contents 7 0 R>>';
 return pdfBytes([
  '<</Type/Catalog/Pages 2 0 R>>',
  '<</Type/Pages/Kids[3 0 R 4 0 R]/Count 2>>',
  page1,page2,
  '<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>',
  `<</Length ${contents[0].length}>>\nstream\n${contents[0]}\nendstream`,
  `<</Length ${contents[1].length}>>\nstream\n${contents[1]}\nendstream`,
 ]);
}
function singlePdf(){
 const contents='BT /F1 16 Tf 72 320 Td (outro documento) Tj ET';
 return pdfBytes([
  '<</Type/Catalog/Pages 2 0 R>>',
  '<</Type/Pages/Kids[3 0 R]/Count 1>>',
  '<</Type/Page/Parent 2 0 R/MediaBox[0 0 400 700]/Resources<</Font<</F1 4 0 R>>>>/Contents 5 0 R>>',
  '<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>',
  `<</Length ${contents.length}>>\nstream\n${contents}\nendstream`,
 ]);
}

await withArtifacts('pdf-rotation',async ctx=>{
 let failures=0;
 const check=(name,cond,detail='')=>{if(!cond)failures++;console.log(`${cond?'ok  ':'FAIL'} ${name}${detail?` — ${detail}`:''}`);};
 const runtime=ctx.runtime=newRuntime('pdf-rotation');
 const course=seedCourse(runtime,'Girar');
 const outra=seedCourse(runtime,'Outra');
 const um=path.join(course,'Um.pdf');
 const dois=path.join(course,'Dois.pdf');
 const tres=path.join(course,'Tres.pdf');
 fs.writeFileSync(um,asymmetricPdf({nativeRotate:true}));
 fs.writeFileSync(dois,asymmetricPdf());
 fs.writeFileSync(tres,singlePdf());
 writeConfigJson(runtime,{
  vaultPath:runtime,
  courses:[{id:'Girar',name:'Girar',path:course},{id:'Outra',name:'Outra',path:outra}],
  desk:{panels:[{label:'Um',prefer:['Um']},{label:'Dois',prefer:['Dois']}]}
 });
 // Estado "legado/sujo": `pdfs[]` com rotação malformada (string "90" e fração
 // 90.5) e um mapa com valores que o núcleo recusa (45, string e negativo). O
 // boot tem de cair em 0 nos dois e sanear; nenhum host pode lançar por isso.
 writeDeskJson(runtime,{courseId:'Girar',pdfs:[{path:um,page:1,rotation:'90'},{path:dois,page:1,rotation:90.5}],pdfRotations:{[um]:45,[dois]:'90',[tres]:-90},layoutVersion:1});

 const readStateAt=rt=>JSON.parse(fs.readFileSync(path.join(rt,'desk.json'),'utf8'));
 const waitStateAt=async(rt,pred,label,timeout=15000)=>{
  const t0=Date.now();
  for(;;){
   let state=null;try{state=readStateAt(rt);}catch{}
   if(state&&pred(state))return state;
   if(Date.now()-t0>timeout)throw new Error(`desk.json não chegou em: ${label}`);
   await new Promise(r=>setTimeout(r,150));
  }
 };
 const readState=()=>readStateAt(runtime);
 const waitState=(pred,label)=>waitStateAt(runtime,pred,label);

 // Helpers por janela: os painéis giram no DOM, então tudo é re-consultado.
 function helpers(page){
  const field=(idx,sel)=>page.locator('.pdf-panel').nth(idx).locator(sel);
  // O tooltip do app troca `title` por `data-tip` nos nós novos: o rótulo da
  // orientação vale nos dois (e o aria-label sempre acompanha).
  const title=idx=>page.evaluate(i=>{const b=document.querySelectorAll('.pdf-panel')[i]?.querySelector('.rotate');return b?(b.getAttribute('title')||b.getAttribute('data-tip')||''):'';},idx);
  const waitTitle=(idx,deg)=>page.waitForFunction(([i,d])=>{const b=document.querySelectorAll('.pdf-panel')[i]?.querySelector('.rotate');const text=b?.getAttribute('title')||b?.getAttribute('data-tip')||'';return text.includes(`atual: ${d}°`);},[idx,deg],{timeout:30000});
  const waitRotation=(idx,pageNo,deg)=>page.waitForFunction(([i,p,d])=>{
   const panel=document.querySelectorAll('.pdf-panel')[i];
   const el=[...panel.querySelectorAll('.pdf-page')].find(e=>e.dataset.page===String(p));
   return el?.querySelector('.textLayer')?.dataset.mainRotation===String(d);
  },[idx,pageNo,deg],{timeout:30000});
  const waitCanvas=(idx,pageNo)=>page.waitForFunction(([i,p])=>{
   const panel=document.querySelectorAll('.pdf-panel')[i];
   const el=[...panel.querySelectorAll('.pdf-page')].find(e=>e.dataset.page===String(p));
   return !!el?.querySelector('canvas');
  },[idx,pageNo],{timeout:30000});
  const waitPage=(idx,pageNo)=>page.waitForFunction(([i,p])=>document.querySelectorAll('.pdf-panel')[i]?.querySelector('.page-number')?.value===String(p),[idx,pageNo],{timeout:10000});
  // O `change` do input[type=number] só dispara na interação de teclado: o
  // `.fill` do Playwright em `type=number` escreve o valor e dispara `input`,
  // mas nunca `change` (confirmado na sonda). O teste pagina como o usuário:
  // foca, seleciona o número, digita e confirma com Enter.
  const typePage=async(idx,n)=>{
   const input=field(idx,'.page-number');
   await input.click();
   await page.keyboard.press('ControlOrMeta+a');
   await page.keyboard.type(String(n));
   await page.keyboard.press('Enter');
  };
  const scrollTo=(idx,pageNo)=>page.evaluate(([i,p])=>{
   const panel=document.querySelectorAll('.pdf-panel')[i],box=panel.querySelector('.pdf-viewport');
   const el=[...panel.querySelectorAll('.pdf-page')].find(e=>e.dataset.page===String(p));
   box.scrollTop=Math.max(0,el.offsetTop-4);box.dispatchEvent(new Event('scroll'));
  },[idx,pageNo]);
  const geom=(idx,pageNo)=>page.evaluate(([i,p])=>{
   const panel=document.querySelectorAll('.pdf-panel')[i];
   const el=[...panel.querySelectorAll('.pdf-page')].find(e=>e.dataset.page===String(p));
   const canvas=el?.querySelector('canvas'),layer=el?.querySelector('.textLayer'),span=layer?.querySelector('span');
   const spanRect=span?.getBoundingClientRect(),pageRect=el?.getBoundingClientRect();
   return {boxW:el?.offsetWidth||0,boxH:el?.offsetHeight||0,canvasW:canvas?.width||0,canvasH:canvas?.height||0,cssW:parseFloat(canvas?.style.width||'0'),cssH:parseFloat(canvas?.style.height||'0'),mainRotation:layer?.dataset.mainRotation??null,spans:layer?layer.querySelectorAll('span').length:0,spanInside:!!spanRect&&!!pageRect&&spanRect.left>=pageRect.left-2&&spanRect.right<=pageRect.right+2&&spanRect.top>=pageRect.top-2&&spanRect.bottom<=pageRect.bottom+2,spanText:span?.textContent??''};
  },[idx,pageNo]);
  // Canto do marcador vermelho no canvas (TL/TR/BL/BR) — pixels de verdade.
  const marker=(idx,pageNo)=>page.evaluate(([i,p])=>{
   const panel=document.querySelectorAll('.pdf-panel')[i];
   const el=[...panel.querySelectorAll('.pdf-page')].find(e=>e.dataset.page===String(p));
   const canvas=el?.querySelector('canvas');
   if(!canvas)return null;
   const {width:w,height:h}=canvas;
   const data=canvas.getContext('2d').getImageData(0,0,w,h).data;
   let minX=w,maxX=-1,minY=h,maxY=-1,count=0;
   for(let y=0;y<h;y+=4){
    for(let x=0;x<w;x+=4){
     const o=(y*w+x)*4;
     if(data[o]>180&&data[o+1]<90&&data[o+2]<90){count++;if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;}
    }
   }
   if(!count)return null;
   const cx=(minX+maxX)/2,cy=(minY+maxY)/2;
   return {corner:(cx<w/2?'L':'R')+(cy<h/2?'T':'B'),w,h,count};
  },[idx,pageNo]);
  const expectGeom=async(label,idx,pageNo,deg,corner,portrait)=>{
   await waitRotation(idx,pageNo,deg);
   const g=await geom(idx,pageNo),m=await marker(idx,pageNo);
   check(`${label}: textLayer com rotação ${deg}`,g.mainRotation===String(deg),`${g.mainRotation}`);
   check(`${label}: ${portrait?'retrato':'paisagem'} (caixa)`,portrait?g.boxH>g.boxW:g.boxW>g.boxH,`${g.boxW}x${g.boxH}`);
   check(`${label}: canvas acompanha a caixa`,portrait?g.canvasH>g.canvasW:g.canvasW>g.canvasH,`${g.canvasW}x${g.canvasH}`);
   check(`${label}: marcador no canto ${corner}`,m&&m.corner===corner,m?`${m.corner} (${m.count}px)`:'sem marcador');
   check(`${label}: textLayer com spans`,g.spans>0&&g.spanText.includes('pagina'),`${g.spans} spans`);
   check(`${label}: span dentro da página girada`,g.spanInside,`${g.spanInside}`);
   return g;
  };
  return {field,title,waitTitle,waitRotation,waitCanvas,waitPage,typePage,scrollTo,geom,marker,expectGeom};
 }

 /* ---------- execução A: legado/inválido, ciclo e estado no disco ---------- */
 {
  const app=ctx.app=await launchDesk({runtime,env:{LEARNING_VAULT:runtime}});
  const page=await app.firstWindow();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text());});
  const H=helpers(page);
  await page.waitForSelector('.pdf-panel .pdf-document .pdf-page',{timeout:30000});
  await page.waitForFunction(()=>document.querySelectorAll('.pdf-panel .pdf-page canvas').length>=2,undefined,{timeout:30000});
  const tools=await page.evaluate(()=>[...document.querySelectorAll('.pdf-panel')[0].querySelectorAll('.pdf-tools > *')].map(el=>el.className.split(' ')[0]));
  check('toolbar: rotate é o último controle',tools.at(-1)==='rotate',tools.join(','));
  check('toolbar: botão de girar tem SVG do host',(await H.field(0,'.rotate svg.icon').count())===1);
  check('toolbar: andaime data-icon não vaza',(await H.field(0,'.rotate').getAttribute('data-icon'))===null);
  check('legado/inválido: painel 0 nasce em 0° (rotation string "90" recusada)',(await H.title(0)).includes('atual: 0°'),await H.title(0));
  check('legado: painel 1 nasce em 0° (rotation 90.5 recusada)',(await H.title(1)).includes('atual: 0°'),await H.title(1));
  await H.expectGeom('nativa 90 + usuário 0 (p1)',0,1,90,'RT',false);
  await H.expectGeom('nativa 0 + usuário 0 (p2)',0,2,0,'LT',true);

  // gira com a página 2 atual: ela continua a atual depois do novo layout
  await H.scrollTo(0,2);await H.waitPage(0,2);await H.waitCanvas(0,2);
  await H.field(0,'.rotate').click();
  await H.waitTitle(0,90);
  await toastWait(page,'Orientação: 90°',{timeout:8000});
  check('girar avisa a orientação no canal de status existente',true);
  check('foco fica no botão de girar (swap do botão)',await page.evaluate(()=>document.activeElement?.classList.contains('rotate')));
  await H.expectGeom('nativa 0 + usuário 90 (p2)',0,2,90,'RT',false);
  check('âncora: página 2 continua atual depois de girar',(await H.field(0,'.page-number').inputValue())==='2');
  await H.scrollTo(0,1);
  await H.expectGeom('nativa 90 + usuário 90 (p1)',0,1,180,'RB',true);
  check('página 1 volta a ser a atual',(await H.field(0,'.page-number').inputValue())==='1');

  // ciclo completo na página 1
  await H.field(0,'.rotate').click();await H.waitTitle(0,180);
  await H.expectGeom('nativa 90 + usuário 180 (p1)',0,1,270,'LB',false);
  await H.field(0,'.rotate').click();await H.waitTitle(0,270);
  await H.expectGeom('nativa 90 + usuário 270 (p1)',0,1,0,'LT',true);
  await H.field(0,'.rotate').click();await H.waitTitle(0,0);
  await H.expectGeom('ciclo fechou (360 = 0)',0,1,90,'RT',false);
  await H.field(0,'.rotate').click();await H.waitTitle(0,90);

  const state=await waitState(s=>s.pdfRotations?.[um]===90&&!s.pdfRotations?.[dois]&&!s.pdfRotations?.[tres],'mapa saneado com Um em 90');
  check('estado: mapa guarda a orientação por caminho',state.pdfRotations[um]===90,JSON.stringify(state.pdfRotations));
  check('estado: rotações inválidas saem do mapa',Object.keys(state.pdfRotations).length===1,JSON.stringify(state.pdfRotations));
  check('estado: snapshot do painel leva a rotação',state.pdfs?.[0]?.rotation===90,JSON.stringify(state.pdfs?.[0]));
  check('execução A sem erro de renderer',errors.length===0,errors.slice(0,2).join(' | '));
  await app.close();ctx.app=null;
 }

 /* ---------- execução B: reabrir, independência, A→B→A, uso girado ---------- */
 {
  const app=ctx.app=await launchDesk({runtime,env:{LEARNING_VAULT:runtime}});
  const page=await app.firstWindow();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text());});
  const H=helpers(page);
  await page.waitForSelector('.pdf-panel .pdf-document .pdf-page',{timeout:30000});
  await H.waitRotation(0,1,180);await H.waitCanvas(0,1);
  check('reabrir: painel 0 restaura 90° do disco',(await H.title(0)).includes('atual: 90°'),await H.title(0));
  const g0=await H.geom(0,1);
  check('reabrir: canvas na orientação salva (180 efetivo)',g0.mainRotation==='180'&&g0.boxH>g0.boxW,JSON.stringify({r:g0.mainRotation,w:g0.boxW,h:g0.boxH}));
  check('reabrir: painel 1 nasce em 0° (sem herdar)',(await H.title(1)).includes('atual: 0°'),await H.title(1));
  await H.waitRotation(1,1,0);
  const g1=await H.geom(1,1);
  check('independência: painel 1 intacto',g1.mainRotation==='0'&&g1.boxW<g1.boxH,JSON.stringify({r:g1.mainRotation,w:g1.boxW,h:g1.boxH}));

  // recarregar o renderer (⌘R) reidrata do estado do main, sem perder a volta
  await page.reload();
  await page.waitForSelector('.pdf-panel .pdf-document .pdf-page',{timeout:30000});
  await H.waitRotation(0,1,180);await H.waitRotation(1,1,0);
  check('recarregar o renderer mantém a orientação salva',(await H.title(0)).includes('atual: 90°'),await H.title(0));

  // âncora de página no giro
  await H.typePage(0,2);
  await H.waitPage(0,2);await H.waitCanvas(0,2);
  await H.field(0,'.rotate').click();await H.waitTitle(0,180);
  await page.waitForTimeout(600);
  const anchor=await page.evaluate(()=>{const panel=document.querySelectorAll('.pdf-panel')[0],box=panel.querySelector('.pdf-viewport'),el=[...panel.querySelectorAll('.pdf-page')].find(e=>e.dataset.page==='2');return {page:panel.querySelector('.page-number').value,top:box.scrollTop,elTop:el.offsetTop,elBottom:el.offsetTop+el.offsetHeight};});
  check('âncora: girar mantém a página 2',anchor.page==='2',JSON.stringify(anchor));
  check('âncora: scroll fica dentro da página 2',anchor.top>=anchor.elTop-4&&anchor.top<=anchor.elBottom,JSON.stringify(anchor));

  // troca A→B→A: B não herda; voltar restaura pelo docMemo
  await H.field(0,'.pdf-select').selectOption(dois);
  await page.waitForFunction(()=>document.querySelectorAll('.pdf-panel')[0].querySelector('.pdf-foot')?.textContent.includes('Dois.pdf'),undefined,{timeout:30000});
  await H.waitRotation(0,1,0);
  check('trocar PDF não herda a orientação do outro',(await H.title(0)).includes('atual: 0°'),await H.title(0));
  const gb=await H.geom(0,1);
  check('trocar PDF: Dois em 0° (retrato)',gb.mainRotation==='0'&&gb.boxW<gb.boxH,JSON.stringify({r:gb.mainRotation,w:gb.boxW,h:gb.boxH}));
  await H.field(0,'.rotate').click();await H.waitTitle(0,90);
  await H.waitRotation(0,1,90);
  const gb90=await H.geom(0,1);
  check('trocar PDF: Dois girou para paisagem',gb90.boxW>gb90.boxH,JSON.stringify({w:gb90.boxW,h:gb90.boxH}));
  await H.field(0,'.pdf-select').selectOption(um);
  await page.waitForFunction(()=>document.querySelectorAll('.pdf-panel')[0].querySelector('.pdf-foot')?.textContent.includes('Um.pdf'),undefined,{timeout:30000});
  await H.waitRotation(0,1,270);
  check('voltar ao PDF restaura a orientação (docMemo)',(await H.title(0)).includes('atual: 180°'),await H.title(0));
  const gu=await H.geom(0,1);
  check('voltar ao PDF: canvas em 270 efetivo',gu.mainRotation==='270'&&gu.boxW>gu.boxH,JSON.stringify({r:gu.mainRotation,w:gu.boxW,h:gu.boxH}));

  // paginação contínua + fit/zoom girados (a âncora deixou o Um na página 2).
  // Um render atrasado (janela/ResizeObserver) não pode sobrescrever a página
  // sendo digitada: foca, digita 1, força um render com o redimensionamento e
  // só então confirma com Enter — o valor tem de sobreviver até lá.
  const pageInput=H.field(0,'.page-number');
  await pageInput.click();await page.keyboard.press('ControlOrMeta+a');await page.keyboard.type('1');
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1462,852));
  await page.waitForTimeout(600);
  check('página digitada sobrevive a um render atrasado',(await pageInput.inputValue())==='1',await pageInput.inputValue());
  await page.keyboard.press('Enter');
  await H.waitPage(0,1);
  await H.field(0,'.next').click();await H.waitPage(0,2);
  await H.field(0,'.prev').click();await H.waitPage(0,1);
  check('paginação contínua segue funcionando girada',true);
  await H.field(0,'.fit').click();
  await page.waitForFunction(()=>document.querySelectorAll('.pdf-panel')[0].querySelector('.zoom-label').textContent.trim()==='100%',undefined,{timeout:5000});
  await page.waitForTimeout(700);
  const fitG=await H.geom(0,1);
  check('fit na orientação girada mantém 100% e a página',fitG.mainRotation==='270',JSON.stringify(fitG.mainRotation));
  const fitW=fitG.cssW;
  await H.field(0,'.in').click();
  await page.waitForFunction(()=>document.querySelectorAll('.pdf-panel')[0].querySelector('.zoom-label').textContent.trim()==='120%',undefined,{timeout:5000});
  await page.waitForTimeout(900);
  const zoomG=await H.geom(0,1);
  check('zoom na orientação girada repinta maior',zoomG.cssW>fitW*1.1,`${fitW} → ${zoomG.cssW}`);

  // busca, seleção e captura na orientação girada
  await H.field(0,'.find-toggle').click();
  await H.field(0,'.pdf-find input').fill('marcador');
  await H.field(0,'.pdf-find button').click();
  await page.waitForFunction(()=>{const c=document.querySelectorAll('.pdf-panel')[0].querySelector('.find-count');return !!c&&!c.hidden&&c.textContent.trim()==='1/2';},undefined,{timeout:30000});
  await page.waitForFunction(()=>document.querySelectorAll('.pdf-panel')[0].querySelectorAll('.pdf-hl').length>0,undefined,{timeout:30000});
  check('busca na orientação girada conta e destaca',true);
  const sel=await page.evaluate(()=>{const span=document.querySelectorAll('.pdf-panel')[0].querySelector('.textLayer span');if(!span)return '';const r=document.createRange();r.selectNodeContents(span);const s=getSelection();s.removeAllRanges();s.addRange(r);return s.toString();});
  check('seleção de texto funciona na orientação girada',sel.includes('pagina'),sel);
  await page.keyboard.press('Escape');
  await page.waitForFunction(()=>document.querySelectorAll('.pdf-panel')[0].querySelector('.pdf-find').hidden===true,undefined,{timeout:5000});

  const beforeShot=await H.field(0,'.page-number').inputValue();
  await H.field(0,'.page-shot').click();
  await page.waitForSelector('#attachments .attachment img',{timeout:15000});
  const shot=await page.evaluate(()=>{const img=document.querySelector('#attachments .attachment img');return {alt:img.getAttribute('alt'),w:img.naturalWidth,h:img.naturalHeight};});
  check('captura da página girada anexa a imagem',/p1\.png$/.test(shot.alt),shot.alt);
  check('captura sai na orientação visual (paisagem)',shot.w>shot.h,`${shot.w}x${shot.h}`);
  check('captura não mexe na página atual',(await H.field(0,'.page-number').inputValue())===beforeShot);
  await page.locator('#attachments .attachment-remove').click();

  // trocar para outro PDF preserva o mapa; a barra em 900x650 continua usável
  await H.field(0,'.pdf-select').selectOption(tres);
  await page.waitForFunction(()=>document.querySelectorAll('.pdf-panel')[0].querySelector('.pdf-foot')?.textContent.includes('Tres.pdf'),undefined,{timeout:30000});
  await H.waitRotation(0,1,0);
  check('PDF novo não herda orientação',(await H.title(0)).includes('atual: 0°'),await H.title(0));
  const away=await waitState(s=>s.pdfRotations?.[um]===180&&s.pdfRotations?.[dois]===90&&!s.pdfRotations?.[tres],'mapa preservado com Um/Dois fora de cena');
  check('mapa preserva PDFs fora de cena',away.pdfRotations[um]===180&&away.pdfRotations[dois]===90,JSON.stringify(away.pdfRotations));
  await H.field(0,'.pdf-select').selectOption(um);
  await page.waitForFunction(()=>document.querySelectorAll('.pdf-panel')[0].querySelector('.pdf-foot')?.textContent.includes('Um.pdf'),undefined,{timeout:30000});
  await H.waitRotation(0,1,270);
  check('voltar de novo restaura a orientação',(await H.title(0)).includes('atual: 180°'),await H.title(0));

  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(900,650));
  await page.waitForTimeout(500);
  const small=await page.evaluate(()=>{
   const panel=document.querySelectorAll('.pdf-panel')[0];
   const tools=panel.querySelector('.pdf-tools');
   const btn=panel.querySelector('.rotate');
   const r=btn.getBoundingClientRect();
   return {sw:tools.scrollWidth,cw:tools.clientWidth,btn:{x:r.x,y:r.y,w:r.width,h:r.height},vw:innerWidth,vh:innerHeight};
  });
  check('900x650: barra de ferramentas não vaza na horizontal',small.sw<=small.cw+1,JSON.stringify(small));
  check('900x650: botão de girar visível e dentro da janela',small.btn.w>0&&small.btn.h>0&&small.btn.x>=0&&small.btn.x+small.btn.w<=small.vw+1&&small.btn.y>=0&&small.btn.y+small.btn.h<=small.vh+1,JSON.stringify(small.btn));
  await H.field(0,'.rotate').click();
  await H.waitTitle(0,270);
  await H.waitRotation(0,1,0);
  check('900x650: botão de girar é clicável',true);
  await H.expectGeom('900x650: giro completo (nativa 90 + 270)',0,1,0,'LT',true);

  // giro rápido: 4 cliques consecutivos no mesmo tick (o mais rápido que o
  // usuário consegue) com renders disparando em cima; a orientação final
  // (270 = ciclo completo) e o canvas/textLayer visíveis têm de ser os últimos,
  // sem canvas velho sobrando e com a página 2 preservada.
  await H.typePage(0,2);await H.waitPage(0,2);await H.waitCanvas(0,2);
  await page.evaluate(()=>{const panel=document.querySelectorAll('.pdf-panel')[0];for(let i=0;i<4;i++)panel.querySelector('.rotate').click();});
  await H.waitTitle(0,270);
  await H.expectGeom('giro rápido (4 cliques no mesmo tick): p2 volta a 270',0,2,270,'LB',false);
  await page.waitForFunction(()=>{const panel=document.querySelectorAll('.pdf-panel')[0];const el=[...panel.querySelectorAll('.pdf-page')].find(e=>e.dataset.page==='2');return !!el&&!el.dataset.rendering&&(el.dataset.rendered||'').split(':')[2]==='270';},undefined,{timeout:30000});
  const fast=await page.evaluate(()=>{const panel=document.querySelectorAll('.pdf-panel')[0];const el=[...panel.querySelectorAll('.pdf-page')].find(e=>e.dataset.page==='2');return {canvases:el.querySelectorAll('canvas').length,layers:el.querySelectorAll('.textLayer').length,rendered:el.dataset.rendered||'',rendering:el.dataset.rendering||'',page:panel.querySelector('.page-number').value};});
  check('giro rápido: um único canvas na página 2',fast.canvases===1,JSON.stringify(fast));
  check('giro rápido: um único textLayer na página 2',fast.layers===1,JSON.stringify(fast));
  check('giro rápido: canvas é o da orientação final (chave 270)',fast.rendered.split(':')[2]==='270',fast.rendered);
  check('giro rápido: nenhum render preso',fast.rendering==='',fast.rendering);
  check('giro rápido: página 2 preservada',fast.page==='2',fast.page);
  // mesma corrida com cliques reais (Playwright re-resolve o botão trocado a
  // cada clique, como o usuário): o estado final tem de ser o mesmo.
  for(let i=0;i<4;i++)await H.field(0,'.rotate').click();
  await H.waitTitle(0,270);
  await H.waitRotation(0,2,270);
  await page.waitForFunction(()=>{const panel=document.querySelectorAll('.pdf-panel')[0];const el=[...panel.querySelectorAll('.pdf-page')].find(e=>e.dataset.page==='2');return !!el&&!el.dataset.rendering&&(el.dataset.rendered||'').split(':')[2]==='270';},undefined,{timeout:30000});
  check('giro rápido com clique real: estado final estável',(await H.title(0)).includes('atual: 270°')&&(await H.field(0,'.page-number').inputValue())==='2',await H.title(0));

  check('execução B sem erro de renderer',errors.length===0,errors.slice(0,2).join(' | '));
  await app.close();ctx.app=null;
 }

 /* ---------- execução C: segunda reabertura restaura o estado final ---------- */
 {
  const app=ctx.app=await launchDesk({runtime,env:{LEARNING_VAULT:runtime}});
  const page=await app.firstWindow();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const H=helpers(page);
  await page.waitForSelector('.pdf-panel .pdf-document .pdf-page',{timeout:30000});
  await H.waitRotation(0,1,0);await H.waitRotation(1,1,0);
  check('2ª reabertura: painel 0 volta em 270°',(await H.title(0)).includes('atual: 270°'),await H.title(0));
  // O painel 1 nunca girou (snapshot próprio 0): o mapa tem 90 do Dois (o
  // painel 0 o girou ao passar por ele na execução B), mas o snapshot do painel
  // vence o mapa — sem herdar.
  check('2ª reabertura: painel 1 volta em 0° (snapshot próprio vence o mapa)',(await H.title(1)).includes('atual: 0°'),await H.title(1));
  const state=readState();
  check('2ª reabertura: mapa no disco com as duas orientações',state.pdfRotations?.[um]===270&&state.pdfRotations?.[dois]===90,JSON.stringify(state.pdfRotations));
  check('execução C sem erro de renderer',errors.length===0,errors.slice(0,2).join(' | '));
  await app.close();ctx.app=null;
 }

 /* ---------- execução D: o MESMO PDF nos dois leitores ---------- */
 /* O mapa é compartilhado por caminho; o snapshot é de cada painel. Com o
    mesmo documento aberto nos dois leitores, girar um não pode arrastar o
    outro — nem no boot (snapshot 0 vence o mapa) nem entre relançamentos. */
 {
  writeConfigJson(runtime,{
   vaultPath:runtime,
   courses:[{id:'Girar',name:'Girar',path:course}],
   desk:{panels:[{label:'Um A',prefer:['Um']},{label:'Um B',prefer:['Um']}]}
  });
  // Mapa compartilhado em 90 (do painel 0) + snapshots distintos: o painel 1
  // tem 0 explícito e NÃO pode herdar os 90 que o mapa guardou para o caminho.
  writeDeskJson(runtime,{courseId:'Girar',pdfs:[{path:um,page:1,zoom:1,rotation:90,scrollX:0,scrollY:0,invert:false,minimized:false},{path:um,page:1,zoom:1,rotation:0,scrollX:0,scrollY:0,invert:false,minimized:false}],pdfRotations:{[um]:90},layoutVersion:1});
  const app=ctx.app=await launchDesk({runtime,env:{LEARNING_VAULT:runtime}});
  const page=await app.firstWindow();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text());});
  const H=helpers(page);
  await page.waitForSelector('.pdf-panel .pdf-document .pdf-page',{timeout:30000});
  await H.waitRotation(0,1,180);await H.waitRotation(1,1,90);
  check('mesmo PDF: painel 0 volta no próprio 90°',(await H.title(0)).includes('atual: 90°'),await H.title(0));
  check('mesmo PDF: painel 1 mantém o snapshot 0° (vence o mapa 90)',(await H.title(1)).includes('atual: 0°'),await H.title(1));
  // Independência real: girar o painel 0 (90→180) não mexe no painel 1.
  await H.field(0,'.rotate').click();await H.waitTitle(0,180);
  await H.waitRotation(0,1,270);
  check('mesmo PDF: girar um leitor não gira o outro',(await H.title(1)).includes('atual: 0°'),await H.title(1));
  check('mesmo PDF: canvas do painel 1 intacto em 90° efetivo',(await H.geom(1,1)).mainRotation==='90');
  // A→B→A no painel 1: o docMemo é do painel e vence o mapa (que agora tem 180).
  await H.field(1,'.pdf-select').selectOption(dois);
  await page.waitForFunction(()=>document.querySelectorAll('.pdf-panel')[1].querySelector('.pdf-foot')?.textContent.includes('Dois.pdf'),undefined,{timeout:30000});
  await H.waitRotation(1,1,0);
  check('mesmo PDF: o painel 1 troca para Dois em 0°',(await H.title(1)).includes('atual: 0°'),await H.title(1));
  await H.field(1,'.rotate').click();await H.waitTitle(1,90);
  await H.waitRotation(1,1,90);
  await H.field(1,'.pdf-select').selectOption(um);
  await page.waitForFunction(()=>document.querySelectorAll('.pdf-panel')[1].querySelector('.pdf-foot')?.textContent.includes('Um.pdf'),undefined,{timeout:30000});
  await H.waitRotation(1,1,90);
  check('mesmo PDF: voltar usa a volta própria do painel (docMemo), não o mapa',(await H.title(1)).includes('atual: 0°'),await H.title(1));
  check('mesmo PDF: painel 0 segue na volta dele',(await H.title(0)).includes('atual: 180°'),await H.title(0));
  const disk=await waitState(s=>s.pdfs?.[0]?.rotation===180&&s.pdfs?.[1]?.rotation===0&&s.pdfRotations?.[um]===180,'snapshots por painel no disco');
  check('mesmo PDF: disco guarda um snapshot por painel',disk.pdfs[0].rotation===180&&disk.pdfs[1].rotation===0,JSON.stringify(disk.pdfs.map(p=>p.rotation)));
  check('mesmo PDF: mapa guarda a última volta do caminho',disk.pdfRotations[um]===180,JSON.stringify(disk.pdfRotations));
  check('execução D sem erro de renderer',errors.length===0,errors.slice(0,2).join(' | '));
  await app.close();ctx.app=null;
  // Relançar: os snapshots por painel vencem o mapa de novo (o mapa tem 180).
  const app2=ctx.app=await launchDesk({runtime,env:{LEARNING_VAULT:runtime}});
  const page2=await app2.firstWindow();
  const errors2=[];page2.on('pageerror',e=>errors2.push(e.message));
  const H2=helpers(page2);
  await page2.waitForSelector('.pdf-panel .pdf-document .pdf-page',{timeout:30000});
  await H2.waitRotation(0,1,270);await H2.waitRotation(1,1,90);
  check('mesmo PDF: reabrir mantém as duas orientações independentes',(await H2.title(0)).includes('atual: 180°')&&(await H2.title(1)).includes('atual: 0°'),`${await H2.title(0)} | ${await H2.title(1)}`);
  check('execução D (reabrir) sem erro de renderer',errors2.length===0,errors2.slice(0,2).join(' | '));
  await app2.close();ctx.app=null;
 }

 /* ---------- execução E: troca de matéria — o mapa é por curso ---------- */
 /* A orientação vive no estado da matéria: girar em A não pode aparecer em B,
    e voltar para A tem de restaurar orientação e o resto do layout. */
 {
  const umOutra=path.join(outra,'Um.pdf');
  fs.writeFileSync(umOutra,asymmetricPdf({nativeRotate:true}));
  writeConfigJson(runtime,{
   vaultPath:runtime,
   courses:[{id:'Girar',name:'Girar',path:course},{id:'Outra',name:'Outra',path:outra}],
   desk:{panels:[{label:'Um',prefer:['Um']}]}
  });
  writeDeskJson(runtime,{courseId:'Girar',pdfs:[{path:um,page:1,zoom:1.2,rotation:90,scrollX:0,scrollY:0,invert:false,minimized:false}],pdfRotations:{[um]:90},layoutVersion:1});
  const app=ctx.app=await launchDesk({runtime,env:{LEARNING_VAULT:runtime}});
  const page=await app.firstWindow();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const H=helpers(page);
  await page.waitForSelector('.pdf-panel .pdf-document .pdf-page',{timeout:30000});
  await H.waitRotation(0,1,180);
  check('matéria A abre com a orientação própria',(await H.title(0)).includes('atual: 90°'),await H.title(0));
  check('matéria A abre com o zoom próprio',(await page.locator('.pdf-panel .zoom-label').textContent()).trim()==='120%');
  await page.waitForFunction(()=>[...document.querySelectorAll('#course-tabs button')].every(t=>!t.disabled),undefined,{timeout:30000});
  await page.locator('#course-tabs button[data-id="Outra"]').click();
  await page.waitForFunction(()=>document.querySelector('#course-tabs button[data-id="Outra"]')?.classList.contains('active'),undefined,{timeout:30000});
  await page.waitForFunction(()=>document.querySelector('.pdf-panel .pdf-foot')?.textContent.includes('Um.pdf')&&!!document.querySelector('.pdf-panel .pdf-page canvas'),undefined,{timeout:30000});
  await H.waitRotation(0,1,90);
  check('matéria B nasce em 0° (sem herdar A)',(await H.title(0)).includes('atual: 0°'),await H.title(0));
  await page.waitForFunction(()=>[...document.querySelectorAll('#course-tabs button')].every(t=>!t.disabled),undefined,{timeout:30000});
  await page.locator('#course-tabs button[data-id="Girar"]').click();
  await page.waitForFunction(()=>document.querySelector('#course-tabs button[data-id="Girar"]')?.classList.contains('active'),undefined,{timeout:30000});
  await page.waitForFunction(()=>document.querySelector('.pdf-panel .pdf-foot')?.textContent.includes('Um.pdf')&&!!document.querySelector('.pdf-panel .pdf-page canvas'),undefined,{timeout:30000});
  await H.waitRotation(0,1,180);
  check('voltar à matéria A restaura a orientação',(await H.title(0)).includes('atual: 90°'),await H.title(0));
  check('voltar à matéria A restaura o zoom (sem perdas de layout)',(await page.locator('.pdf-panel .zoom-label').textContent()).trim()==='120%');
  const perCourse=await waitState(s=>s.courseStates?.Girar?.pdfRotations?.[um]===90&&!!s.courseStates?.Outra,'estado por matéria no disco');
  check('matéria B não ganhou a rotação da matéria A',!perCourse.courseStates.Outra.pdfRotations?.[umOutra],JSON.stringify(perCourse.courseStates.Outra.pdfRotations||{}));
  check('execução E sem erro de renderer',errors.length===0,errors.slice(0,2).join(' | '));
  await app.close();ctx.app=null;
 }

 console.log(`\nPDF ROTATION: ${failures} falha(s)`);
 if(failures)throw new Error(`pdf-rotation: ${failures} falha(s) (artefatos salvos pelo harness)`);
});
