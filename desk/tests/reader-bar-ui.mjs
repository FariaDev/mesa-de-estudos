import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {withArtifacts,launchDesk,newRuntime,seedCourse,writeConfigJson,statusOnline,screenshotDirectory,setTheme,freezeMotion,showSidechat,closeSidechat,resizeWindow} from './helpers.mjs';
import {BAR,near,settle} from './layout-measure.mjs';

/* Barra única do leitor (ticket #11 da spec de redesenho): cada leitor tem UMA
   linha de 40px — rótulo, material (o nome encurta com reticências), página
   anterior/próxima e por número, busca, favoritos/sumário e "Mais opções" — e
   nunca quebra nem passa da borda. Zoom, ajustar, inverter, girar, capturar,
   abrir outro PDF e recolher moram no menu "Mais opções" e continuam
   funcionando. O segundo leitor recolhido vira uma faixa estreita com o
   rótulo, e a faixa o reabre. Mede na janela real, nos dois temas, em
   1440×900 e 900×650, com um e com dois leitores. As imagens ficam numa pasta
   `leitor-…` de desk/tests/artifacts para olho humano; não são asserção. */

const SHOT_DIR=screenshotDirectory('leitor');
const WIDE=[1440,900],MINIMUM=[900,650];
const THEMES=[['light','claro'],['dark','escuro']];
/* PDF de várias páginas: o `tinyPdf` do helper põe as linhas na mesma página. */
function pagesPdf(count,line){
 const objects=['<</Type/Catalog/Pages 2 0 R>>',`<</Type/Pages/Kids[${Array.from({length:count},(_,i)=>`${4+i} 0 R`).join(' ')}]/Count ${count}>>`,'<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>'];
 for(let i=0;i<count;i++)objects.push(`<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Resources<</Font<</F1 3 0 R>>>>/Contents ${4+count+i} 0 R>>`);
 for(let i=0;i<count;i++){
  const contents=`BT /F1 16 Tf 72 720 Td (${line(i+1)}) Tj ET`;
  objects.push(`<</Length ${contents.length}>>\nstream\n${contents}\nendstream`);
 }
 let out='%PDF-1.4\n';const offsets=[];
 objects.forEach((obj,i)=>{offsets.push(out.length);out+=`${i+1} 0 obj\n${obj}\nendobj\n`;});
 const startxref=out.length;
 out+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.map(off=>`${String(off).padStart(10,'0')} 00000 n \n`).join('')}trailer\n<</Size ${objects.length+1}/Root 1 0 R>>\nstartxref\n${startxref}\n%%EOF\n`;
 return Buffer.from(out,'latin1');
}

const LONG='Lista de exercicios numero 7 com um nome de arquivo muito comprido que nunca cabe numa barra de leitor estreito';

async function setSize(app,page,[width,height]){
 await resizeWindow(app,page,width,height);
 await settle(page);
}
async function shot(page,name){
 await page.mouse.move(2,2);
 await page.screenshot({path:path.join(SHOT_DIR,name)});
}

async function openDesk(ctx,tag,{two}){
 const runtime=ctx.runtime=newRuntime(tag),course=seedCourse(runtime,'Test');
 fs.writeFileSync(path.join(course,'Limites.pdf'),pagesPdf(6,n=>`Limites pagina ${n}`));
 fs.writeFileSync(path.join(course,`${LONG}.pdf`),pagesPdf(4,n=>`Lista longa pagina ${n}`));
 if(two)fs.writeFileSync(path.join(course,'Formulario.pdf'),pagesPdf(3,n=>`Formulario pagina ${n}`));
 const desk=two?{pinnedExtensions:false}:{panels:[{label:'Lista',prefer:['Limites']}],pinnedExtensions:false};
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'Test',name:'Cálculo I',path:course}],desk});
 ctx.app=await launchDesk({runtime});
 const page=await ctx.app.firstWindow();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await statusOnline(page);
 await page.waitForSelector('.pdf-panel canvas',{timeout:25000});
 await freezeMotion(page);
 return {page,errors};
}

/* A barra de cada leitor à vista, medida de uma vez. */
function bars(page){
 return page.evaluate(()=>{
  const shown=el=>{if(!el)return false;const cs=getComputedStyle(el),r=el.getBoundingClientRect();return r.width>0&&r.height>0&&cs.visibility!=='hidden'&&cs.display!=='none';};
  const rect=el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};};
  return [...document.querySelectorAll('#pdf-grid .pdf-panel')].filter(shown).map(panel=>{
   const title=panel.querySelector('.pdf-title');
   const select=panel.querySelector('.pdf-select');
   const icon=panel.querySelector('.pdf-title .more svg');
   /* Quantos caracteres do nome o seletor mostra: o que cabe na largura dele
      menos o recuo, a borda e a seta (38px medidos no seletor nativo), com as
      reticências quando o nome não cabe inteiro. */
   const fit=el=>{
    if(!el)return null;
    const cs=getComputedStyle(el),ctx=document.createElement('canvas').getContext('2d');
    ctx.font=`${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const text=(el.selectedOptions[0]?.textContent||'').trim(),room=el.getBoundingClientRect().width-38,ellipsis=ctx.measureText('…').width;
    let n=0;
    while(n<text.length&&ctx.measureText(text.slice(0,n+1)).width+(n+1<text.length?ellipsis:0)<=room)n++;
    return {text,chars:n};
   };
   return {
    label:panel.getAttribute('aria-label'),panel:rect(panel),
    title:shown(title)?rect(title):null,
    hasToolsRow:!!panel.querySelector('.pdf-tools'),
    scrolls:title?title.scrollWidth>title.clientWidth+1:false,
    kids:title?[...title.children].filter(shown).map(el=>({cls:String(el.className),tag:el.tagName.toLowerCase(),...rect(el)})):[],
    select:shown(select)?{...rect(select),textOverflow:getComputedStyle(select).textOverflow,fit:fit(select),fontSize:getComputedStyle(select).fontSize}:null,
    pageFont:shown(panel.querySelector('.page-number'))?getComputedStyle(panel.querySelector('.page-number')).fontSize:null,
    moreIcon:shown(icon)?rect(icon):null,
    menuHidden:panel.querySelector('.pdf-more-pop')?.hidden??null
   };
  });
 });
}

function assertOneLine(list,label,{readers}){
 assert.equal(list.length,readers,`${label}: ${readers} leitor(es) à vista`);
 for(const [i,bar] of list.entries()){
  const tag=`${label} leitor ${i+1} (${bar.label})`;
  assert.ok(bar.title,`${tag}: há barra`);
  assert.ok(near(bar.title.height,BAR),`${tag}: a barra tem uma linha de ${BAR}px (${bar.title.height})`);
  assert.equal(bar.hasToolsRow,false,`${tag}: não há segunda linha de ferramentas`);
  assert.equal(bar.scrolls,false,`${tag}: nada passa da borda da barra`);
  const mid=(bar.title.top+bar.title.bottom)/2;
  for(const kid of bar.kids){
   assert.ok(kid.left>=bar.title.left-.5&&kid.right<=bar.title.right+.5,`${tag}: ${kid.cls} dentro da barra (${kid.left}..${kid.right} de ${bar.title.left}..${bar.title.right})`);
   assert.ok(kid.top>=bar.title.top-.5&&kid.bottom<=bar.title.bottom+.5&&Math.abs((kid.top+kid.bottom)/2-mid)<=1.5,`${tag}: ${kid.cls} na linha única`);
  }
  /* Leitor estreito (contêiner ≤330px de conteúdo + 18px de recuo): o total de
     páginas cede, e ≤290px o rótulo também — o painel guarda o nome acessível. */
  const roomy=bar.title.width>348,tight=bar.title.width<=308;
  /* Em leitor estreito as setas de página cedem (#23): o campo de página, a
     rolagem contínua e as teclas seguem navegando. */
  const needed=['pdf-select','page-number','find-toggle','nav','more',...(tight?[]:['prev','next']),...(roomy?['page-total']:[])];
  for(const cls of needed){
   assert.ok(bar.kids.some(k=>k.cls.split(/\s+/).includes(cls)),`${tag}: ${cls} está na barra`);
  }
  if(!tight)assert.ok(bar.kids.some(k=>k.tag==='strong'),`${tag}: o rótulo está na barra`);
  assert.ok(bar.label,`${tag}: o leitor guarda o nome acessível`);
  for(const cls of ['in','out','fit','invert','rotate','page-shot','open','collapse']){
   assert.ok(!bar.kids.some(k=>k.cls.split(/\s+/).includes(cls)),`${tag}: ${cls} saiu da barra (vai para Mais opções)`);
  }
  /* #27 B6: controles a 13px; em leitor estreito (≤330px) o fallback é 12px. */
  const font=bar.title.width>348?'13px':bar.title.width<=330+18?'12px':null;
  if(font){
   assert.equal(bar.select.fontSize,font,`${tag}: o seletor está em ${font} numa barra de ${bar.title.width}px`);
   if(bar.pageFont)assert.equal(bar.pageFont,font,`${tag}: o campo de página está em ${font}`);
  }
  assert.ok(bar.select&&bar.select.width>=44,`${tag}: o material continua legível (${bar.select?.width}px)`);
  const shownChars=Math.min(8,bar.select.fit.text.length);
  assert.ok(bar.select.fit.chars>=shownChars,`${tag}: o seletor mostra pelo menos ${shownChars} caracteres do nome "${bar.select.fit.text}" (mostra ${bar.select.fit.chars} em ${bar.select.width}px)`);
  assert.equal(bar.select.textOverflow,'ellipsis',`${tag}: o nome longo encurta com reticências`);
  assert.ok(bar.moreIcon,`${tag}: Mais opções à vista`);
  assert.ok(near(bar.panel.right-bar.moreIcon.right,12,1),`${tag}: o último ícone a 12px da borda do leitor (${bar.panel.right-bar.moreIcon.right})`);
  assert.equal(bar.menuHidden,true,`${tag}: o menu nasce fechado`);
 }
}

const reader=(page,i)=>page.locator('#pdf-grid .pdf-panel').nth(i);

await withArtifacts('leitor-dois',async ctx=>{
 const {page,errors}=await openDesk(ctx,'leitor-dois',{two:true});
 for(const [theme,tag] of THEMES){
  await setTheme(page,theme);
  for(const size of [WIDE,MINIMUM]){
   await setSize(ctx.app,page,size);
   assertOneLine(await bars(page),`dois leitores ${tag} ${size.join('x')}`,{readers:2});
   assert.deepEqual(await page.locator('#pdf-grid .pdf-panel').evaluateAll(list=>list.map(el=>el.getAttribute('aria-label'))),['Enunciado','Formulário & apoio'],'rótulos padrão do config');
   await shot(page,`dois-leitores-${tag}-${size.join('x')}.png`);
  }
 }
 await setTheme(page,'light');
 await setSize(ctx.app,page,WIDE);

 const first=reader(page,0);
 const zoom=()=>first.locator('.zoom-label').textContent().then(s=>s.trim());
 const menu=first.locator('.pdf-more-pop');

 /* Mais opções: tudo o que saiu da barra está lá e funciona. */
 await first.locator('.more').click();
 await menu.waitFor({state:'visible'});
 assert.equal(await first.locator('.more').getAttribute('aria-expanded'),'true','Mais opções: expandido ao abrir');
 for(const cls of ['in','out','fit','invert','rotate','page-shot','open','collapse','zoom-label']){
  assert.ok(await menu.locator(`.${cls}`).first().isVisible(),`Mais opções: ${cls} à vista no menu`);
 }
 await shot(page,'dois-leitores-claro-1440x900-mais-opcoes.png');
 await menu.locator('.in').click();
 assert.equal(await zoom(),'120%','zoom + no menu');
 assert.ok(await menu.isVisible(),'o menu fica aberto para ajustar o zoom de novo');
 await menu.locator('.out').click();
 await menu.locator('.out').click();
 assert.equal(await zoom(),'80%','zoom − no menu');
 await menu.locator('.fit').click();
 assert.equal(await zoom(),'100%','ajustar à largura no menu');
 assert.ok(await menu.isHidden(),'escolher uma ação fecha o menu');
 await first.locator('.more').click();
 await menu.locator('.invert').click();
 assert.equal(await first.locator('.invert').getAttribute('aria-pressed'),'true','inverter cores no menu');
 await first.locator('.more').click();
 await menu.locator('.invert').click();
 await first.locator('.more').click();
 await menu.locator('.rotate').click();
 await page.waitForFunction(()=>{const p=document.querySelector('#pdf-grid .pdf-panel .pdf-page');const r=p?.getBoundingClientRect();return r&&r.height<r.width;},undefined,{timeout:8000});
 for(let i=0;i<3;i++){await first.locator('.more').click();await menu.locator('.rotate').click();}
 await first.locator('.more').click();
 await page.keyboard.press('Escape');
 assert.ok(await menu.isHidden(),'Esc fecha o menu');
 await first.locator('.more').click();
 await page.locator('#prompt').click();
 assert.ok(await menu.isHidden(),'clicar fora fecha o menu');

 /* O atalho ⌘⇧I continua valendo com o menu fechado (o botão vive dentro dele). */
 await first.locator('.pdf-viewport').click({position:{x:40,y:40}});
 await page.keyboard.press('ControlOrMeta+Shift+I');
 assert.equal(await first.locator('.invert').getAttribute('aria-pressed'),'true','⌘⇧I inverte com o menu fechado');
 assert.ok(await menu.isHidden(),'o atalho não abre o menu');
 await page.keyboard.press('ControlOrMeta+Shift+I');
 assert.equal(await first.locator('.invert').getAttribute('aria-pressed'),'false','⌘⇧I desfaz');

 /* #42 (5): "Página escura" — opcional, desligada por padrão mesmo no tema
    escuro, por leitor (o outro leitor não muda e trocar de material mantém),
    inverte papel e texto preservando o matiz. */
 const darkState=async i=>reader(page,i).evaluate(panel=>{
  const item=panel.querySelector('.invert'),canvas=panel.querySelector('.pdf-page canvas');
  return {label:item.textContent.trim(),pressed:item.getAttribute('aria-pressed'),state:getComputedStyle(item,'::after').content,filter:canvas?getComputedStyle(canvas).filter:'',inverted:panel.querySelector('.pdf-viewport').classList.contains('inverted')};
 });
 for(const [theme] of THEMES){
  await setTheme(page,theme);
  const off=await darkState(0);
  assert.equal(off.label,'Página escura',`${theme}: o item se chama Página escura`);
  assert.equal(off.pressed,'false',`${theme}: desligada por padrão, mesmo no tema escuro`);
  assert.equal(off.state,'"Desligada"',`${theme}: o menu diz que está desligada`);
  assert.equal(off.inverted,false,`${theme}: a página continua branca`);
 }
 await setTheme(page,'dark');
 await first.locator('.more').click();
 await menu.locator('.invert').click();
 const on=await darkState(0);
 assert.equal(on.pressed,'true','ligar a Página escura no menu');
 assert.match(on.filter,/invert\(1\) hue-rotate\(180deg\)/,`inverte preservando o matiz (${on.filter})`);
 assert.equal((await darkState(1)).inverted,false,'o outro leitor não muda: é estado por leitor');
 await first.locator('.more').click();
 assert.equal((await darkState(0)).state,'"Ligada"','o menu diz que está ligada');
 await shot(page,'pagina-escura-escuro-1440x900-menu.png');
 await page.keyboard.press('Escape');
 await shot(page,'pagina-escura-escuro-1440x900.png');
 const keep=await first.locator('.pdf-select option').evaluateAll(list=>list.map(o=>({value:o.value,text:o.textContent,selected:o.selected})));
 await first.locator('.pdf-select').selectOption(keep.find(o=>o.value&&!o.selected&&/Formul/i.test(o.text)).value);
 await page.waitForFunction(()=>document.querySelector('#pdf-grid .pdf-panel .page-total')?.textContent.trim()==='/ 3',undefined,{timeout:10000});
 assert.equal((await darkState(0)).inverted,true,'trocar de material mantém a Página escura do leitor');
 await first.locator('.pdf-select').selectOption(keep.find(o=>o.selected).value);
 await page.waitForFunction(()=>document.querySelector('#pdf-grid .pdf-panel .page-total')?.textContent.trim()==='/ 6',undefined,{timeout:10000});
 await first.locator('.more').click();
 await menu.locator('.invert').click();
 assert.equal((await darkState(0)).pressed,'false','desligar a Página escura');
 await setTheme(page,'light');

 /* #42 (4): borda de foco — uma regra só. O painel onde está o foco (leitor,
    coluna do tutor ou chat lateral) ganha o mesmo contorno de 1px na cor do
    anel; os outros não têm contorno. */
 const rings=()=>page.evaluate(()=>{
  const probe=document.createElement('span');probe.style.color='var(--ring)';document.body.append(probe);
  const ring=getComputedStyle(probe).color;probe.remove();
  const look=el=>{if(!el)return null;const cs=getComputedStyle(el,'::after');return {on:cs.content!=='none'&&cs.borderTopStyle==='solid',width:cs.borderTopWidth,color:cs.borderTopColor,inset:[cs.top,cs.left,cs.right,cs.bottom].join(' ')};};
  return {ring,reader:look(document.querySelectorAll('#pdf-grid .pdf-panel')[0]),other:look(document.querySelectorAll('#pdf-grid .pdf-panel')[1]),tutor:look(document.querySelector('#sidebar')),side:look(document.querySelector('#sidechat'))};
 });
 const only=(r,who,label)=>{
  for(const key of ['reader','other','tutor','side']){
   if(!r[key])continue;
   if(key===who){
    assert.equal(r[key].on,true,`${label}: ${key} ganha o contorno`);
    assert.equal(r[key].width,'1px',`${label}: contorno de 1px`);
    assert.equal(r[key].color,r.ring,`${label}: contorno na cor do anel`);
    assert.equal(r[key].inset,'0px 0px 0px 0px',`${label}: contorno por dentro do painel`);
   }else assert.equal(r[key].on,false,`${label}: ${key} sem contorno`);
  }
 };
 for(const [theme,tag] of THEMES){
  await setTheme(page,theme);
  for(const size of [WIDE,MINIMUM]){
   await setSize(ctx.app,page,size);
   const label=`${tag} ${size.join('x')}`;
   await first.locator('.page-number').focus();
   only(await rings(),'reader',`${label} leitor`);
   await shot(page,`foco-leitor-${tag}-${size.join('x')}.png`);
   await page.locator('#prompt').focus();
   only(await rings(),'tutor',`${label} tutor`);
   await shot(page,`foco-tutor-${tag}-${size.join('x')}.png`);
   await showSidechat(page);
   await page.locator('#sidechat-prompt').focus();
   only(await rings(),'side',`${label} chat lateral`);
   await shot(page,`foco-chat-lateral-${tag}-${size.join('x')}.png`);
   await closeSidechat(page);
  }
 }
 await setTheme(page,'light');
 await setSize(ctx.app,page,WIDE);

 /* Páginas: por número e pelos botões. */
 await first.locator('.page-number').fill('3');
 await first.locator('.page-number').press('Enter');
 await page.waitForFunction(()=>document.querySelector('#pdf-grid .pdf-panel .pdf-foot')?.textContent.includes('Página 3'),undefined,{timeout:8000});
 await first.locator('.next').click();
 await page.waitForFunction(()=>document.querySelector('#pdf-grid .pdf-panel .pdf-foot')?.textContent.includes('Página 4'),undefined,{timeout:8000});
 await first.locator('.prev').click();
 await page.waitForFunction(()=>document.querySelector('#pdf-grid .pdf-panel .pdf-foot')?.textContent.includes('Página 3'),undefined,{timeout:8000});

 /* Material: trocar pelo nome na barra. */
 const options=await first.locator('.pdf-select option').evaluateAll(list=>list.map(o=>({value:o.value,text:o.textContent,selected:o.selected})));
 const other=options.find(o=>o.value&&!o.selected&&/Formul/i.test(o.text));
 assert.ok(other,'a biblioteca oferece outro material');
 await first.locator('.pdf-select').selectOption(other.value);
 await page.waitForFunction(()=>document.querySelector('#pdf-grid .pdf-panel .page-total')?.textContent.trim()==='/ 3',undefined,{timeout:10000});
 await first.locator('.pdf-select').selectOption(options.find(o=>o.selected).value);
 await page.waitForFunction(()=>document.querySelector('#pdf-grid .pdf-panel .page-total')?.textContent.trim()==='/ 6',undefined,{timeout:10000});

 /* Busca e favoritos: continuam na barra e não a quebram. */
 await first.locator('.find-toggle').click();
 await first.locator('.pdf-find').waitFor({state:'visible'});
 assertOneLine(await bars(page),'busca aberta',{readers:2});
 await first.locator('.find-toggle').click();
 await first.locator('.nav').click();
 await first.locator('.pdf-nav-pop').waitFor({state:'visible'});
 assert.ok(await first.locator('.pdf-nav-pop .nav-save').isVisible(),'favoritos: guardar a página está no painel');
 await page.keyboard.press('Escape');

 /* Recolher o segundo leitor: vira faixa estreita com o rótulo e reabre. */
 const second=reader(page,1),before=await second.boundingBox();
 await second.locator('.more').click();
 await second.locator('.pdf-more-pop .collapse').click();
 await page.waitForFunction(()=>document.querySelectorAll('#pdf-grid .pdf-panel')[1]?.classList.contains('minimized'));
 await settle(page);
 const strip=await second.boundingBox();
 assert.ok(strip.width<=40&&strip.width>=28,`faixa recolhida estreita (${strip.width}px)`);
 const restore=second.locator('.pdf-restore');
 assert.ok(await restore.isVisible(),'a faixa tem o botão de reabrir');
 assert.match(await restore.textContent(),/Formul/,'a faixa mostra o rótulo do leitor');
 assert.ok(await second.locator('.pdf-title').isHidden(),'a barra some enquanto recolhido');
 const grown=await first.boundingBox();
 assert.ok(grown.width>before.width,'o primeiro leitor ocupa o espaço que sobrou');
 await shot(page,'dois-leitores-claro-1440x900-recolhido.png');
 await restore.click();
 await settle(page);
 const reopened=await second.boundingBox();
 assert.ok(near(reopened.width,before.width,3),`reabrir devolve a largura (${reopened.width} de ${before.width})`);
 assertOneLine(await bars(page),'depois de reabrir',{readers:2});
 assert.deepEqual(errors,[],'sem erros na página');
});

await withArtifacts('leitor-um',async ctx=>{
 const {page,errors}=await openDesk(ctx,'leitor-um',{two:false});
 for(const [theme,tag] of THEMES){
  await setTheme(page,theme);
  for(const size of [WIDE,MINIMUM]){
   await setSize(ctx.app,page,size);
   assertOneLine(await bars(page),`um leitor ${tag} ${size.join('x')}`,{readers:1});
   assert.equal(await reader(page,0).locator('.pdf-title strong').textContent(),'Lista','o rótulo vem do config.json');
   assert.equal(await reader(page,0).getAttribute('aria-label'),'Lista','o painel guarda o rótulo do config.json');
   await shot(page,`um-leitor-${tag}-${size.join('x')}.png`);
  }
 }
 /* Nome longo: encurta com reticências, sem quebrar nem passar da borda. */
 await setTheme(page,'light');
 await setSize(ctx.app,page,MINIMUM);
 const select=reader(page,0).locator('.pdf-select');
 const long=(await select.locator('option').evaluateAll(list=>list.map(o=>({value:o.value,text:o.textContent})))).find(o=>o.text.startsWith('Lista de exercicios'));
 assert.ok(long,'a biblioteca tem o material de nome longo');
 await select.selectOption(long.value);
 await page.waitForFunction(()=>document.querySelector('#pdf-grid .pdf-panel .page-total')?.textContent.trim()==='/ 4',undefined,{timeout:10000});
 await settle(page);
 assertOneLine(await bars(page),'nome longo 900x650',{readers:1});
 await shot(page,'um-leitor-claro-900x650-nome-longo.png');
 assert.deepEqual(errors,[],'sem erros na página');
});
