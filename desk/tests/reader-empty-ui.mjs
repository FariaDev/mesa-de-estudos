import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {withArtifacts,launchDesk,newRuntime,seedCourse,tinyPdf,writeConfigJson,statusOnline,screenshotDirectory,setTheme,freezeMotion,toastWait,resizeWindow} from './helpers.mjs';
import {settle} from './layout-measure.mjs';
import {pollUntil} from './waits.mjs';

/* Leitor sem material (ticket #12 da spec de redesenho): numa matéria sem PDFs
   cada leitor mostra a folha branca "Lista 0" — título, nome da matéria e quatro
   caminhos para pôr um material ali, com "Abrir PDF…", "Mostrar a pasta" e
   "Pedir ao tutor" — e, abaixo, a área tracejada "Solte um PDF aqui". A barra
   diz "Nenhum material". O leitor inteiro aceita soltar um PDF (também com um
   material já aberto); durante o arraste aparece "Solte para abrir em <rótulo>".
   Soltar o que não é PDF avisa e não quebra. A folha é papel: branca com texto
   escuro nos dois temas. Quando a matéria ganha um PDF, a folha dá lugar ao
   material. Mede na janela real, nos dois temas, em 1440×900 e 900×650, com um
   e com dois leitores. As imagens ficam numa pasta `leitor-vazio-…` de
   desk/tests/artifacts para olho humano; não são asserção. */

const SHOT_DIR=screenshotDirectory('leitor-vazio');
const WIDE=[1440,900],MINIMUM=[900,650];
const THEMES=[['light','claro'],['dark','escuro']];
const COURSE='Cálculo I';

async function setSize(app,page,[width,height]){
 await resizeWindow(app,page,width,height);
 await settle(page);
}
async function shot(page,name){
 await page.mouse.move(2,2);
 await page.screenshot({path:path.join(SHOT_DIR,name)});
}

/* Matéria SEM PDFs: o runtime nasce com a pasta vazia. */
async function openDesk(ctx,tag,{two}){
 const runtime=ctx.runtime=newRuntime(tag),course=seedCourse(runtime,'Test');
 const desk=two?{pinnedExtensions:false}:{panels:[{label:'Lista',prefer:['Limites']}],pinnedExtensions:false};
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'Test',name:COURSE,path:course}],desk});
 ctx.app=await launchDesk({runtime});
 const page=await ctx.app.firstWindow();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await statusOnline(page);
 await page.waitForSelector('.pdf-panel .reader-sheet',{timeout:25000});
 await freezeMotion(page);
 return {page,errors,runtime,course};
}

const luminance=([r,g,b])=>{const f=v=>{v/=255;return v<=.03928?v/12.92:((v+.055)/1.055)**2.4;};return .2126*f(r)+.7152*f(g)+.0722*f(b);};
const contrast=(a,b)=>{const [hi,lo]=[luminance(a),luminance(b)].sort((x,y)=>y-x);return (hi+.05)/(lo+.05);};

/* A folha de cada leitor à vista, medida de uma vez. */
function sheets(page){
 return page.evaluate(()=>{
  const shown=el=>{if(!el)return false;const cs=getComputedStyle(el),r=el.getBoundingClientRect();return r.width>0&&r.height>0&&cs.visibility!=='hidden'&&cs.display!=='none';};
  const rect=el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};};
  const rgb=value=>(String(value).match(/[\d.]+/g)||[]).slice(0,3).map(Number);
  return [...document.querySelectorAll('#pdf-grid .pdf-panel')].filter(shown).map(panel=>{
   const sheet=panel.querySelector('.reader-sheet');
   const viewport=panel.querySelector('.pdf-viewport');
   const select=panel.querySelector('.pdf-select');
   const out={
    label:panel.getAttribute('aria-label'),
    barMaterial:select?.selectedOptions[0]?.textContent.trim()||'',
    hasSheet:!!sheet,viewport:viewport?rect(viewport):null,
    hScroll:viewport?viewport.scrollWidth>viewport.clientWidth+1:false,
    placeholder:!!panel.querySelector('.pdf-placeholder'),
    barKids:[...panel.querySelectorAll(':scope>.pdf-title>*')].filter(el=>{const b=el.getBoundingClientRect();return b.width>0&&b.height>0;}).map(el=>el.tagName==='STRONG'?'label':el.tagName==='SELECT'?'select':(el.className||'').split(/\s+/)[0])
   };
   if(!sheet)return out;
   const text=el=>el?el.textContent.replace(/\s+/g,' ').trim():'';
   const zone=sheet.querySelector('.sheet-drop');
   const colorOf=el=>rgb(getComputedStyle(el).color);
   const textEls=[...sheet.querySelectorAll('h1,.sheet-course,.sheet-intro,.sheet-item,.sheet-item button,.sheet-drop strong,.sheet-drop small')].filter(shown);
   Object.assign(out,{
    sheet:rect(sheet),background:rgb(getComputedStyle(sheet).backgroundColor),
    title:text(sheet.querySelector('h1')),course:text(sheet.querySelector('.sheet-course')),
    intro:text(sheet.querySelector('.sheet-intro')),
    courseStyle:(()=>{const cs=getComputedStyle(sheet.querySelector('.sheet-course'));return {italic:cs.fontStyle,align:cs.textAlign};})(),
    titleStyle:(()=>{const cs=getComputedStyle(sheet.querySelector('h1'));return {size:cs.fontSize,align:cs.textAlign};})(),
    items:[...sheet.querySelectorAll('.sheet-item')].map(el=>text(el)),
    actions:[...sheet.querySelectorAll('button')].map(el=>({text:text(el),...rect(el),color:colorOf(el)})),
    zone:zone?{text:text(zone),borderStyle:getComputedStyle(zone).borderTopStyle,...rect(zone)}:null,
    colors:textEls.map(el=>({tag:el.tagName.toLowerCase(),text:text(el).slice(0,40),color:colorOf(el)})),
    overflowing:[...sheet.querySelectorAll('*')].filter(shown).filter(el=>{const r=el.getBoundingClientRect();const v=viewport.getBoundingClientRect();return r.right>v.right+.5||r.left<v.left-.5;}).map(el=>el.className||el.tagName),
    truncated:textEls.filter(el=>el.scrollWidth>el.clientWidth+1&&getComputedStyle(el).display!=='inline').map(el=>text(el).slice(0,30)),
    docCanvas:!!panel.querySelector('canvas')
   });
   return out;
  });
 });
}

function assertSheets(list,label,{readers}){
 assert.equal(list.length,readers,`${label}: ${readers} leitor(es) à vista`);
 for(const [i,s] of list.entries()){
  const tag=`${label} leitor ${i+1} (${s.label})`;
  assert.ok(s.hasSheet,`${tag}: a folha está no leitor`);
  assert.equal(s.placeholder,false,`${tag}: o texto antigo do leitor vazio saiu`);
  assert.equal(s.barMaterial,'Nenhum material',`${tag}: a barra diz "Nenhum material"`);
  assert.equal(s.title,'Lista 0',`${tag}: título da folha`);
  /* #27 B3: sem material a barra é rótulo, "Nenhum material" e Mais opções. */
  /* O rótulo cede em leitor estreito (container query da barra), então só ele pode faltar. */
  assert.deepEqual(s.barKids.filter(k=>k!=='label'),['select','more'],`${tag}: a barra sem material só tem rótulo, "Nenhum material" e Mais opções (${s.barKids})`);
  /* #27 B13: título centrado, subtítulo em itálico, texto do canvas. */
  assert.equal(s.courseStyle.italic,'italic',`${tag}: o subtítulo é itálico`);
  assert.equal(s.courseStyle.align,'center',`${tag}: o subtítulo é centrado`);
  assert.equal(s.titleStyle.align,'center',`${tag}: o título é centrado`);
  assert.match(s.intro,/^Esta folha fica no lugar do seu primeiro PDF\. Resolva qualquer um dos itens abaixo\.$/,`${tag}: a introdução diz o que a folha é`);
  assert.match(s.items[2],/eles aparecem aqui sozinhos\./,`${tag}: o item 3 diz que os arquivos aparecem sozinhos`);
  assert.ok(s.course.includes(COURSE),`${tag}: a folha diz o nome da matéria (${s.course})`);
  assert.equal(s.items.length,4,`${tag}: quatro itens`);
  assert.match(s.items[0],/Arraste um PDF/i,`${tag}: item 1 é arrastar um PDF`);
  assert.match(s.items[1],/outro lugar/i,`${tag}: item 2 é abrir de outro lugar`);
  assert.match(s.items[2],/pasta da mat[ée]ria/i,`${tag}: item 3 é a pasta da matéria`);
  assert.match(s.items[3],/lista.*tutor/i,`${tag}: item 4 é pedir ao tutor`);
  assert.deepEqual(s.actions.map(a=>a.text),['Abrir PDF…','Mostrar a pasta','Pedir ao tutor'],`${tag}: cada item com ação traz o seu atalho`);
  for(const a of s.actions)assert.ok(a.width>=44&&a.height>=18,`${tag}: "${a.text}" é um alvo clicável (${a.width}×${a.height})`);
  assert.ok(s.zone,`${tag}: há a área de soltar`);
  assert.match(s.zone.text,/Solte um PDF aqui/,`${tag}: a área diz "Solte um PDF aqui"`);
  assert.equal(s.zone.borderStyle,'dashed',`${tag}: a área é tracejada`);
  assert.ok(s.zone.top>=s.actions[2].bottom-1,`${tag}: a área de soltar fica abaixo dos itens`);
  /* A folha é papel: branca com texto escuro nos dois temas, página inteira. */
  assert.deepEqual(s.background,[255,255,255],`${tag}: a folha é branca`);
  assert.ok(Math.abs(s.sheet.width-s.viewport.width)<=18,`${tag}: a folha ocupa a largura do leitor (${s.sheet.width} de ${s.viewport.width})`);
  for(const c of s.colors){
   assert.ok(luminance(c.color)<.25,`${tag}: texto escuro sobre a folha (${c.tag} "${c.text}" rgb(${c.color}))`);
   assert.ok(contrast(c.color,[255,255,255])>=4.5,`${tag}: contraste legível (${c.tag} "${c.text}")`);
  }
  for(const a of s.actions)assert.ok(contrast(a.color,[255,255,255])>=4.5,`${tag}: "${a.text}" legível sobre branco`);
  assert.deepEqual(s.overflowing,[],`${tag}: nada passa da borda do leitor`);
  assert.deepEqual(s.truncated,[],`${tag}: nada cortado`);
  assert.equal(s.hScroll,false,`${tag}: sem rolagem horizontal`);
 }
}

/* DataTransfer com arquivos reais do disco (o `File` nativo carrega o caminho
   que `webUtils.getPathForFile` resolve no preload). */
async function transferOf(page,files){
 await page.evaluate(()=>{
  document.querySelector('#drop-source')?.remove();
  const input=document.createElement('input');input.type='file';input.id='drop-source';input.multiple=true;document.body.append(input);
 });
 await page.locator('#drop-source').setInputFiles(files);
 return page.evaluateHandle(()=>{
  const dt=new DataTransfer();
  for(const file of document.querySelector('#drop-source').files)dt.items.add(file);
  return dt;
 });
}
const reader=(page,i)=>page.locator('#pdf-grid .pdf-panel').nth(i);
const overlay=(page,i)=>reader(page,i).locator('.pdf-drop-hint');

await withArtifacts('leitor-vazio-dois',async ctx=>{
 const {page,errors,runtime,course}=await openDesk(ctx,'leitor-vazio-dois',{two:true});
 for(const [theme,tag] of THEMES){
  await setTheme(page,theme);
  for(const size of [WIDE,MINIMUM]){
   await setSize(ctx.app,page,size);
   assertSheets(await sheets(page),`dois leitores ${tag} ${size.join('x')}`,{readers:2});
   await shot(page,`dois-leitores-${tag}-${size.join('x')}.png`);
  }
 }
 await setTheme(page,'light');
 await setSize(ctx.app,page,WIDE);

 const pdfs={
  first:path.join(runtime,'Solto A.pdf'),second:path.join(runtime,'Solto B.pdf'),third:path.join(runtime,'Solto C.pdf'),
  text:path.join(runtime,'anotacoes.txt')
 };
 fs.writeFileSync(pdfs.first,tinyPdf('Solto A pagina 1'));
 fs.writeFileSync(pdfs.second,tinyPdf('Solto B pagina 1'));
 fs.writeFileSync(pdfs.third,tinyPdf('Solto C pagina 1'));
 fs.writeFileSync(pdfs.text,'isto não é um PDF');

 /* Arrasto: o leitor inteiro é alvo e diz em qual rótulo o PDF vai abrir. */
 const transfer=await transferOf(page,[pdfs.first]);
 const labels=['Enunciado','Formulário & apoio'];
 for(const [theme,tag] of THEMES){
  await setTheme(page,theme);
  for(const size of [WIDE,MINIMUM]){
   await setSize(ctx.app,page,size);
   for(const [i,label] of labels.entries()){
    for(const spot of ['.reader-sheet .sheet-drop','.reader-sheet h1','.pdf-title']){
     await reader(page,i).locator(spot).first().dispatchEvent('dragover',{dataTransfer:transfer});
     assert.ok(await overlay(page,i).isVisible(),`${tag} ${size.join('x')}: o arraste sobre ${spot} do leitor ${i+1} mostra a sobreposição`);
     assert.equal((await overlay(page,i).textContent()).trim(),`Solte para abrir em ${label}`,`${tag}: a sobreposição diz o rótulo do leitor ${i+1}`);
     const look=await overlay(page,i).evaluate(el=>{const s=getComputedStyle(el);return {border:s.borderTopWidth,style:s.borderTopStyle,size:s.fontSize,color:s.color,bg:s.backgroundColor,accent:getComputedStyle(document.documentElement).getPropertyValue('--accent-paper').trim()};});
     assert.equal(look.border,'1px',`${tag}: o contorno da sobreposição é de 1px (${look.border})`);
     assert.equal(look.size,'15px',`${tag}: o texto da sobreposição é 15px`);
     const lum=c=>{const n=(c.match(/[\d.]+/g)||[]).slice(0,3).map(Number);return /^ok(lab|lch)/.test(c)?n[0]:(n[0]+n[1]+n[2])/765;};
     assert.ok(lum(look.bg)>.85,`${tag}: a sobreposição é clara nos dois temas, como o papel (${look.bg})`);
     assert.ok(lum(look.color)<.7,`${tag}: o texto leva o acento sobre branco (${look.color})`);
     const other=1-i;
     assert.ok(await overlay(page,other).isHidden(),`${tag}: o outro leitor não mostra a sobreposição`);
     const box=await overlay(page,i).boundingBox(),stage=await reader(page,i).locator('.pdf-viewport').boundingBox();
     assert.ok(box.width>=stage.width*.85&&box.height>=stage.height*.85,`${tag}: a sobreposição cobre o leitor (${box.width}×${box.height} de ${stage.width}×${stage.height})`);
     if(spot==='.reader-sheet h1')await shot(page,`arrasto-${tag}-${size.join('x')}-leitor-${i+1}.png`);
     await reader(page,i).locator(spot).first().dispatchEvent('dragleave',{dataTransfer:transfer});
     assert.ok(await overlay(page,i).isHidden(),`${tag}: a sobreposição some ao sair do leitor`);
    }
   }
  }
 }
 await setTheme(page,'light');
 await setSize(ctx.app,page,WIDE);

 /* Soltar algo que não é PDF: avisa, não quebra, a folha continua. */
 const notPdf=await transferOf(page,[pdfs.text]);
 await reader(page,0).locator('.reader-sheet .sheet-drop').dispatchEvent('drop',{dataTransfer:notPdf});
 await toastWait(page,'Solte um arquivo PDF neste leitor.');
 assert.equal(await reader(page,0).locator('.reader-sheet').count(),1,'não-PDF: a folha continua no leitor');
 assert.ok(await overlay(page,0).isHidden(),'não-PDF: a sobreposição não fica presa');

 /* Soltar um PDF no leitor 1 abre o arquivo ali, de onde ele está. */
 await reader(page,0).locator('.reader-sheet .sheet-drop').dispatchEvent('drop',{dataTransfer:await transferOf(page,[pdfs.first])});
 await reader(page,0).locator('canvas').first().waitFor({timeout:20000});
 await toastWait(page,'aberto em Enunciado');
 assert.equal(await reader(page,0).locator('.reader-sheet').count(),0,'a folha dá lugar ao material');
 assert.equal(await reader(page,1).locator('.reader-sheet').count(),1,'o outro leitor continua com a folha');
 assert.match(await reader(page,0).locator('.pdf-select option:checked').textContent(),/Solto A/,'a barra mostra o material solto');
 assert.deepEqual(fs.readdirSync(course).filter(name=>/\.pdf$/i.test(name)),[],'soltar abre o arquivo de onde ele está: nada foi copiado para a pasta da matéria');
 await shot(page,'depois-de-soltar-claro-1440x900.png');

 /* Em qualquer ponto do leitor 2: pela própria barra. */
 await reader(page,1).locator('.pdf-title').dispatchEvent('drop',{dataTransfer:await transferOf(page,[pdfs.second])});
 await reader(page,1).locator('canvas').first().waitFor({timeout:20000});
 assert.equal(await reader(page,1).locator('.reader-sheet').count(),0,'o leitor 2 também troca a folha pelo material');
 assert.match(await reader(page,1).locator('.pdf-select option:checked').textContent(),/Solto B/);

 /* Com um material já aberto o leitor continua alvo, e o arrasto mostra a sobreposição. */
 const third=await transferOf(page,[pdfs.third]);
 await reader(page,0).locator('.pdf-viewport').dispatchEvent('dragover',{dataTransfer:third});
 assert.ok(await overlay(page,0).isVisible(),'com material aberto: o arrasto mostra a sobreposição');
 assert.equal((await overlay(page,0).textContent()).trim(),'Solte para abrir em Enunciado');
 await shot(page,'arrasto-com-material-claro-1440x900.png');
 await reader(page,0).locator('.pdf-viewport').dispatchEvent('drop',{dataTransfer:third});
 await page.waitForFunction(()=>/Solto C/.test(document.querySelector('#pdf-grid .pdf-panel .pdf-select')?.selectedOptions[0]?.textContent||''),undefined,{timeout:20000});
 /* O "Abrindo o PDF…" dura até o material carregar: espera a sobreposição sair. */
 await page.waitForFunction(()=>document.querySelector('#pdf-grid .pdf-panel .pdf-drop-hint')?.hidden===true,undefined,{timeout:20000});
 assert.deepEqual(errors,[],'sem erros na página');
});

await withArtifacts('leitor-vazio-acoes',async ctx=>{
 const {page,errors,runtime,course}=await openDesk(ctx,'leitor-vazio-acoes',{two:false});
 for(const [theme,tag] of THEMES){
  await setTheme(page,theme);
  for(const size of [WIDE,MINIMUM]){
   await setSize(ctx.app,page,size);
   assertSheets(await sheets(page),`um leitor ${tag} ${size.join('x')}`,{readers:1});
   assert.equal(await reader(page,0).locator('.pdf-title strong').textContent(),'Lista','o rótulo vem do config.json');
   await shot(page,`um-leitor-${tag}-${size.join('x')}.png`);
  }
 }
 await setTheme(page,'light');
 await setSize(ctx.app,page,WIDE);
 const sheet=reader(page,0).locator('.reader-sheet');

 /* Mostrar a pasta: abre a pasta da matéria no sistema. */
 await ctx.app.evaluate(({shell})=>{globalThis.__opened=[];shell.openPath=async target=>{globalThis.__opened.push(target);return '';};});
 await sheet.getByRole('button',{name:'Mostrar a pasta'}).click();
 await pollUntil(()=>ctx.app.evaluate(()=>globalThis.__opened.length),count=>count>=1,{what:'o openPath do atalho "Mostrar a pasta"',onTimeout:'return'});
 const opened=await ctx.app.evaluate(()=>globalThis.__opened);
 assert.deepEqual(opened.map(p=>fs.realpathSync(p)),[fs.realpathSync(course)],'Mostrar a pasta abre a pasta da matéria');

 /* Pedir ao tutor: abre o pedido de PDF já falando de lista de exercícios. */
 await sheet.getByRole('button',{name:'Pedir ao tutor'}).click();
 await page.locator('#tutor-pdf-dialog[open]').waitFor({timeout:5000});
 const request=await page.locator('#tutor-pdf-request').inputValue();
 assert.match(request,/lista de exerc[ií]cios/i,'o pedido já fala de uma lista de exercícios');
 assert.ok(request.includes(COURSE),'o pedido cita a matéria');
 await page.locator('#tutor-pdf-send').click();
 await page.waitForFunction(()=>/Prepare um PDF na Mesa/.test(document.querySelector('#messages')?.textContent||''),undefined,{timeout:15000});
 assert.equal(await page.locator('#tutor-pdf-dialog[open]').count(),0,'o diálogo fecha ao enviar');

 /* Abrir PDF…: o seletor de arquivos do sistema; o escolhido abre no leitor. */
 const chosen=path.join(runtime,'Escolhido.pdf');fs.writeFileSync(chosen,tinyPdf('Escolhido pagina 1'));
 await ctx.app.evaluate(({dialog},file)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]});},chosen);
 await sheet.getByRole('button',{name:'Abrir PDF…'}).click();
 await reader(page,0).locator('canvas').first().waitFor({timeout:20000});
 assert.equal(await reader(page,0).locator('.reader-sheet').count(),0,'Abrir PDF…: a folha dá lugar ao material');
 assert.match(await reader(page,0).locator('.pdf-select option:checked').textContent(),/Escolhido/);
 await shot(page,'um-leitor-claro-1440x900-material.png');
 assert.deepEqual(errors,[],'sem erros na página');
});

await withArtifacts('leitor-vazio-pasta',async ctx=>{
 const {page,errors,course}=await openDesk(ctx,'leitor-vazio-pasta',{two:false});
 assert.equal(await reader(page,0).locator('.reader-sheet').count(),1,'começa com a folha');

 /* A matéria ganha um PDF pela pasta: ao voltar para a Mesa a folha dá lugar a ele. */
 fs.writeFileSync(path.join(course,'Limites.pdf'),tinyPdf('Limites pagina 1'));
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
 await reader(page,0).locator('canvas').first().waitFor({timeout:20000});
 assert.equal(await reader(page,0).locator('.reader-sheet').count(),0,'a folha dá lugar ao PDF que chegou à pasta');
 assert.match(await reader(page,0).locator('.pdf-select option:checked').textContent(),/Limites/);

 /* Livre não tem folha: o vazio da aba é o dela (e não quebra). */
 await page.evaluate(async()=>{
  const {loadCourse}=await import('./src/state.mjs');
  await loadCourse(await window.desk.switchCourse('mesa-free'));
 });
 await page.waitForFunction(()=>document.querySelectorAll('#pdf-grid .pdf-panel').length>0);
 assert.equal(await page.locator('#pdf-grid .reader-sheet').count(),0,'na aba Livre não há folha "Lista 0"');
 assert.deepEqual(errors,[],'sem erros na página');
});

console.log('READER EMPTY UI PASSED: folha Lista 0, soltar PDF, sobreposição e ações, nos dois temas, 1440×900 e 900×650.');
