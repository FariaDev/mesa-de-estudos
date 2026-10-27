import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {reviewShot,withArtifacts,launchDesk,newRuntime,seedCourse,writeConfigJson,tinyPdf,statusOnline,screenshotDirectory,setTheme,freezeMotion,resizeWindow} from './helpers.mjs';
import {layoutStable,nextFrames,pollUntil} from './waits.mjs';

/* Cor de acento (ticket #9 da spec de redesenho): mede na janela real, nos dois
   temas e para cada um dos seis acentos, o que o usuário vê — a ação principal,
   o link e o alternador ligado —, que trocar em Configurações vale na hora (sem
   Salvar, e mesmo cancelando), que a escolha volta na abertura seguinte e que
   um link dentro de folha branca segue legível. As imagens claro/escuro em
   1440×900 e 900×650 saem numa pasta `acento-…` de desk/tests/artifacts para
   olho humano; não são asserção. */

const SHOT_DIR=screenshotDirectory('acento');
const SIZES=[[1440,900],[900,650]];
const ACCENTS=['blue','violet','green','orange','pink','graphite'];
const LABELS={blue:'Azul',violet:'Violeta',green:'Verde',orange:'Laranja',pink:'Rosa',graphite:'Grafite'};
/* Tabela de acento da spec (#4): preenchimento e texto por tema. No claro o
   texto é o próprio preenchimento. */
const FILL={
 light:{blue:'#2548c7',violet:'#6d28d9',green:'#0f7b55',orange:'#c2410c',pink:'#c02667',graphite:'#27272a'},
 dark:{blue:'#506cdf',violet:'#8c52ef',green:'#13865e',orange:'#d0460d',pink:'#d8306b',graphite:'#ededed'}
};
const TEXT={
 light:FILL.light,
 dark:{blue:'#8fa8ff',violet:'#a78bfa',green:'#5fd3a4',orange:'#fb9a6b',pink:'#f783ac',graphite:'#ededed'}
};

const hex=text=>[1,3,5].map(i=>parseInt(text.slice(i,i+2),16));
function rgb(text){
 const m=/^rgba?\(([^)]+)\)$/.exec(String(text).trim());
 assert.ok(m,`cor legível (${text})`);
 return m[1].split(/[,\s/]+/).filter(Boolean).map(Number).slice(0,3);
}
function sameColor(actual,expectedHex,label){
 const got=rgb(actual),want=hex(expectedHex);
 assert.ok(got.every((v,i)=>Math.abs(v-want[i])<=1),`${label}: esperado ${expectedHex}, veio ${actual}`);
}
const lum=([r,g,b])=>{const f=v=>{v/=255;return v<=.03928?v/12.92:((v+.055)/1.055)**2.4;};return .2126*f(r)+.7152*f(g)+.0722*f(b);};
const contrast=(a,b)=>{const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};

const style=(page,selector,prop)=>page.locator(selector).first().evaluate((el,p)=>getComputedStyle(el)[p],prop);
async function setSize(app,page,[width,height]){
 await resizeWindow(app,page,width,height);
 await layoutStable(page,'main');
}
const shot=(page,name)=>reviewShot(page,SHOT_DIR,name);
const accentOf=page=>page.evaluate(()=>document.documentElement.dataset.accent||'blue');
async function openAppearance(page){
 await page.keyboard.press('ControlOrMeta+,');
 await page.waitForSelector('#settings-dialog[open]');
 await page.locator('#settings-tab-avisos').click();
 await page.locator('#accent-mode').scrollIntoViewIfNeeded();
}
async function pick(page,accent){
 await page.locator(`#accent-mode [data-accent="${accent}"]`).click();
 await page.waitForFunction(a=>(document.documentElement.dataset.accent||'blue')===a,accent,{timeout:5000});
}
/* Um link no balão do tutor e outro numa folha branca, montados com as classes
   reais: o que se mede é a regra do stylesheet, não um texto de exemplo. */
async function fixtures(page){
 /* As Estatísticas montam o diálogo (e o stylesheet das barras) na 1ª abertura:
    abre pela busca de comandos, como o usuário, e fecha. */
 await page.keyboard.press('ControlOrMeta+k');
 const input=page.locator('#command-palette .palette-input');
 await input.waitFor({timeout:5000});
 await input.fill('Estatísticas');
 await page.waitForFunction(()=>[...document.querySelectorAll('#command-palette .palette-item .label')].some(el=>el.textContent.includes('Estatísticas')));
 await nextFrames(page);
 await page.keyboard.press('Enter');
 await page.waitForSelector('.study-stats-dialog[open]',{timeout:5000});
 await page.keyboard.press('Escape');
 await page.waitForFunction(()=>!document.querySelector('.study-stats-dialog')?.open,undefined,{timeout:5000});
 await page.evaluate(()=>{
  const tutor=document.createElement('div');
  tutor.className='message assistant';tutor.id='accent-fixture-tutor';
  tutor.innerHTML='<div class="body"><a href="#" id="accent-fixture-link">trecho do material</a></div>';
  document.querySelector('#sidebar').append(tutor);
  const sheet=document.createElement('div');
  sheet.className='pdf-page';sheet.id='accent-fixture-sheet';
  sheet.style.cssText='position:fixed;left:0;top:0;width:200px;height:60px;z-index:-1;pointer-events:none';
  sheet.innerHTML='<div class="pdf-doc"><a href="#" id="accent-fixture-paper-link">link na folha</a></div>';
  document.body.append(sheet);
  /* Sobras do acento (#23): as quatro peças reais, com as classes do
     stylesheet — aviso de atualização, dica de soltar PDF, barra das
     Estatísticas e tecla pressionada do editor de atalhos. */
  const notice=document.querySelector('#update-notice');
  notice.hidden=false;notice.textContent='Atualização disponível';
  const hint=document.createElement('div');
  hint.className='pdf-drop-hint';hint.id='accent-fixture-drop';hint.textContent='Solte para abrir';
  hint.style.cssText='visibility:hidden';
  document.querySelector('.pdf-panel').append(hint);
  const bar=document.createElement('div');
  bar.className='study-stats-bar';bar.id='accent-fixture-bar';
  bar.style.cssText='position:fixed;left:0;top:0;width:8px;height:8px;z-index:-1;pointer-events:none';
  /* A regra da barra vive em `.study-stats-col .study-stats-bar` (tela nova). */
  const col=document.createElement('div');
  col.className='study-stats-col';
  col.append(bar);
  document.body.append(col);
  const keys=document.createElement('div');
  keys.id='keys-dialog';
  keys.innerHTML='<button class="keys-rec" id="accent-fixture-key" aria-pressed="true">Gravando…</button>';
  keys.style.cssText='display:none';
  document.body.append(keys);
 });
}
async function readRuntimeAccent(runtime){
 const file=path.join(runtime,'desk.json');
 const readAccent=()=>{try{return JSON.parse(fs.readFileSync(file,'utf8')).accent||null;}catch{return null;}};
 return pollUntil(readAccent,accent=>!!accent,{timeout:3000,interval:100,what:'o acento em desk.json',onTimeout:'return'});
}

await withArtifacts('cor-de-acento',async ctx=>{
 const runtime=ctx.runtime=newRuntime('cor-de-acento'),course=seedCourse(runtime,'Test');
 fs.writeFileSync(path.join(course,'Limites.pdf'),tinyPdf('Exercise',6));
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'Test',name:'Teste',path:course}],desk:{pinnedExtensions:false}});
 ctx.app=await launchDesk({runtime});
 let page=await ctx.app.firstWindow();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await statusOnline(page);
 await page.waitForSelector('.pdf-panel canvas',{timeout:25000});
 await freezeMotion(page);
 await fixtures(page);

 /* Quem nunca escolheu vê azul. */
 await setTheme(page,'light');
 assert.equal(await accentOf(page),'blue','padrão: azul');

 await openAppearance(page);
 const options=await page.locator('#accent-mode [data-accent]').evaluateAll(list=>list.map(el=>el.dataset.accent));
 assert.deepEqual(options,ACCENTS,'seis opções, azul primeiro');
 assert.equal(await page.locator('#accent-mode [data-accent="blue"]').getAttribute('aria-checked'),'true','azul marcado de início');
 for(const accent of ACCENTS)assert.equal((await page.locator(`#accent-mode [data-accent="${accent}"]`).innerText()).trim(),LABELS[accent],`rótulo de ${accent}`);

 for(const theme of ['light','dark']){
  await setTheme(page,theme);
  for(const accent of ACCENTS){
   const label=`${theme} ${accent}`;
   await pick(page,accent);
   assert.equal(await page.locator(`#accent-mode [data-accent="${accent}"]`).getAttribute('aria-checked'),'true',`${label}: opção marcada`);
   assert.equal(await page.locator('#accent-mode [aria-checked="true"]').count(),1,`${label}: uma opção só marcada`);

   /* Ação principal: o botão Salvar do diálogo. */
   sameColor(await style(page,'#settings-save','backgroundColor'),FILL[theme][accent],`${label}: preenchimento da ação principal`);
   const onPrimary=rgb(await style(page,'#settings-save','color')),fill=rgb(await style(page,'#settings-save','backgroundColor'));
   assert.ok(contrast(onPrimary,fill)>=4.5,`${label}: texto da ação principal legível (${contrast(onPrimary,fill).toFixed(2)})`);
   if(theme==='dark'&&accent==='graphite'){
    assert.ok(lum(onPrimary)<lum(fill),`${label}: grafite no escuro usa texto escuro sobre preenchimento claro`);
    assert.ok(lum(fill)>.7,`${label}: preenchimento claro`);
   }

   /* Link no balão do tutor: tom de texto do tema, legível sobre a coluna. */
   sameColor(await style(page,'#accent-fixture-link','color'),TEXT[theme][accent],`${label}: link`);
   const column=rgb(await style(page,'#sidebar','backgroundColor'));
   assert.ok(contrast(rgb(await style(page,'#accent-fixture-link','color')),column)>=4.5,`${label}: link legível na coluna do tutor`);

   /* Alternador ligado: Referências incluídas. */
   assert.equal(await page.locator('#include-refs').getAttribute('aria-pressed'),'true');
   sameColor(await style(page,'#include-refs','color'),TEXT[theme][accent],`${label}: alternador ligado`);

   /* Sobras do acento: seguem a cor escolhida. Linhas e barras leem sobre a
      superfície com o tom de texto do acento; a tecla pressionada é preenchimento. */
   const surface=rgb(await style(page,'#settings-dialog','backgroundColor'));
   const lines=[['#update-notice','borderTopColor','borda do aviso de atualização'],
    ['#accent-fixture-drop','borderTopColor','dica de soltar PDF no leitor'],
    ['#accent-fixture-bar','backgroundColor','barra das Estatísticas']];
   const paperInk=await page.evaluate(()=>{const i=document.createElement('i');i.style.cssText='position:fixed;color:var(--accent-paper)';document.body.append(i);const c=getComputedStyle(i).color;i.remove();return c;});
   for(const [selector,prop,what] of lines){
    const value=await style(page,selector,prop);
    if(selector==='#accent-fixture-drop'){
     /* A dica cobre a folha branca nos dois temas (#26): leva o tom de acento
        sobre papel, e é a folha, não a superfície do tema, que ela precisa ler. */
     assert.equal(value,paperInk,`${label}: ${what} usa o acento sobre papel`);
     assert.ok(contrast(rgb(value),[255,255,255])>=3,`${label}: ${what} legível sobre o papel (${contrast(rgb(value),[255,255,255]).toFixed(2)})`);
     continue;
    }
    sameColor(value,TEXT[theme][accent],`${label}: ${what}`);
    assert.ok(contrast(rgb(value),surface)>=3,`${label}: ${what} legível sobre a superfície (${contrast(rgb(value),surface).toFixed(2)})`);
   }
   sameColor(await style(page,'#accent-fixture-key','backgroundColor'),FILL[theme][accent],`${label}: tecla pressionada no editor de atalhos`);
   {
    const key=rgb(await style(page,'#accent-fixture-key','color')),keyBg=rgb(await style(page,'#accent-fixture-key','backgroundColor'));
    assert.ok(contrast(key,keyBg)>=4.5,`${label}: texto da tecla pressionada legível`);
   }

   /* Folha branca: o link continua legível com qualquer acento, nos dois temas. */
   const paper=rgb(await style(page,'#accent-fixture-sheet','backgroundColor'));
   assert.deepEqual(paper,[255,255,255],`${label}: folha branca`);
   const paperLink=rgb(await style(page,'#accent-fixture-paper-link','color'));
   assert.ok(contrast(paperLink,paper)>=4.5,`${label}: link na folha branca legível (${contrast(paperLink,paper).toFixed(2)})`);
   /* O tom é o do acento no claro, mesmo com a interface no escuro: a folha
      não muda de papel. (Sem isso o teste passaria com o azul do navegador.) */
   sameColor(await style(page,'#accent-fixture-paper-link','color'),FILL.light[accent],`${label}: link na folha usa o tom do acento legível sobre branco`);
  }
 }

 /* Vale na hora: sem Salvar, e continua valendo ao cancelar. */
 await setTheme(page,'light');
 await pick(page,'blue');
 const before=await style(page,'#settings-save','backgroundColor');
 await pick(page,'orange');
 assert.notEqual(await style(page,'#settings-save','backgroundColor'),before,'a ação principal muda sem esperar o Salvar');
 await page.locator('#settings-dialog button[value="cancel"]').last().click();
 await page.waitForFunction(()=>!document.querySelector('#settings-dialog').open);
 assert.equal(await accentOf(page),'orange','cancelar não desfaz o acento');
 assert.equal(await readRuntimeAccent(runtime),'orange','o acento foi gravado como estado de interface');
 const config=JSON.parse(fs.readFileSync(path.join(runtime,'config.json'),'utf8'));
 assert.equal('accent' in config,false,'o acento não vira campo do config.json');
 assert.equal('accent' in (config.desk||{}),false,'nem do bloco desk');

 /* Capturas: Aparência aberta, claro e escuro, nos dois tamanhos, com mais de
    um acento além do azul (grafite no escuro). */
 const shots=[['light','green'],['light','violet'],['dark','graphite'],['dark','pink']];
 for(const [theme,accent] of shots){
  await setTheme(page,theme);
  for(const size of SIZES){
   await setSize(ctx.app,page,size);
   await openAppearance(page);
   await pick(page,accent);
   await page.mouse.move(2,2);
   await shot(page,`${theme}-${accent}-${size.join('x')}-configuracoes.png`);
   await page.keyboard.press('Escape');
   await page.waitForFunction(()=>!document.querySelector('#settings-dialog').open);
   await shot(page,`${theme}-${accent}-${size.join('x')}-mesa.png`);
  }
 }
 await setSize(ctx.app,page,[1440,900]);

 /* Abertura seguinte: a escolha volta. */
 await setTheme(page,'light');
 await openAppearance(page);
 await pick(page,'pink');
 await page.keyboard.press('Escape');
 await page.waitForFunction(()=>!document.querySelector('#settings-dialog').open);
 assert.equal(await readRuntimeAccent(runtime),'pink');
 await ctx.app.close();
 ctx.app=await launchDesk({runtime});
 page=await ctx.app.firstWindow();page.on('pageerror',e=>errors.push(e.message));
 await statusOnline(page);
 await page.waitForSelector('.pdf-panel canvas',{timeout:25000});
 assert.equal(await accentOf(page),'pink','a escolha persiste entre aberturas');
 await openAppearance(page);
 assert.equal(await page.locator('#accent-mode [data-accent="pink"]').getAttribute('aria-checked'),'true','a opção salva volta marcada');
 await page.keyboard.press('Escape');

 assert.deepEqual(errors,[]);
 console.log('PASS: cor de acento — seis opções, nos dois temas, na hora e persistente');
});

console.log('Screenshots:',SHOT_DIR);
