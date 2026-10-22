import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {reviewShot,withArtifacts,launchDesk,newRuntime,seedCourse,writeConfigJson,tinyPdf,statusOnline,toastWait,sendEnabled,screenshotDirectory,setTheme,freezeMotion,openSessionLibrary,resizeWindow} from './helpers.mjs';
import {layoutStable} from './waits.mjs';

/* Papéis de cor nos dois temas (ticket #6 da spec de redesenho): mede na
   janela real o que o usuário vê — fundo do app, superfície, coluna do tutor,
   palco do leitor, seleção, hover, borda e borda forte —, e as regras que
   valem para a tela inteira: nenhum cinza azulado, sombra só no que flutua
   (menus, diálogos, avisos), página do PDF sempre branca e texto legível.
   As imagens claro/escuro em 1440×900 e 900×650 saem em
   uma pasta `cores-…` de desk/tests/artifacts para olho humano; não são asserção. */

const SHOT_DIR=screenshotDirectory('cores');

const ROLES={
 light:{bg:[239,239,239,1],surface:[255,255,255,1],tutor:[244,244,244,1],stage:[203,203,203,1],selected:[232,232,232,1],hover:[242,242,242,1],border:[218,218,218,1],borderStrong:[199,199,199,1]},
 dark:{bg:[31,31,31,1],surface:[44,44,44,1],tutor:[36,36,36,1],stage:[25,25,25,1],selected:[255,255,255,.09],hover:[255,255,255,.06],border:[255,255,255,.10],borderStrong:[255,255,255,.16]}
};
const SIZES=[[1440,900],[900,650]];
/* O que pode ter sombra: menus (e os popovers e a paleta, que fazem papel de
   menu), diálogos e avisos — o próprio elemento que flutua, não o que está
   dentro dele. */
const FLOATING='dialog,.nav-pop,.toast-item,#undo-notice,.pdf-nav-pop,#conversations-pop,#context-pop,.slash-pop,.palette';

function rgba(text){
 const m=/^rgba?\(([^)]+)\)$/.exec(String(text).trim());
 if(!m)return null;
 const parts=m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
 return [parts[0],parts[1],parts[2],parts.length>3?parts[3]:1];
}
function sameColor(actual,expected,label){
 const got=rgba(actual);
 assert.ok(got,`${label}: cor legível (${actual})`);
 const close=got.slice(0,3).every((v,i)=>Math.abs(v-expected[i])<=1)&&Math.abs(got[3]-expected[3])<=.011;
 assert.ok(close,`${label}: esperado rgba(${expected.join(', ')}), veio ${actual}`);
}

async function setSize(app,page,[width,height]){
 await resizeWindow(app,page,width,height);
 await layoutStable(page,'main');
 await page.waitForSelector('.pdf-page',{state:'attached',timeout:10000});
}
const shot=(page,name)=>reviewShot(page,SHOT_DIR,name);
const style=(page,selector,prop)=>page.locator(selector).first().evaluate((el,p)=>getComputedStyle(el)[p],prop);

/* Varre o que está visível e devolve os fatos de cor de cada elemento. */
function scan(page){
 return page.evaluate(floating=>{
  const parse=text=>{
   const m=/^rgba?\(([^)]+)\)$/.exec(String(text).trim());
   if(!m)return null;
   const p=m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
   return [p[0],p[1],p[2],p.length>3?p[3]:1];
  };
  const name=el=>el.tagName.toLowerCase()+(el.id?'#'+el.id:'')+(typeof el.className==='string'&&el.className?'.'+el.className.trim().split(/\s+/).join('.'):'');
  const lum=([r,g,b])=>{const f=v=>{v/=255;return v<=.03928?v/12.92:((v+.055)/1.055)**2.4;};return .2126*f(r)+.7152*f(g)+.0722*f(b);};
  const over=(top,under)=>{const a=top[3];return [0,1,2].map(i=>top[i]*a+under[i]*(1-a)).concat(1);};
  /* Fundo efetivo: compõe os fundos translúcidos dos ancestrais até um opaco.
     `null` quando algum fundo do caminho não é rgb (mistura com o acento). */
  const backdrop=el=>{
   const layers=[];
   for(let node=el;node&&node.nodeType===1;node=node.parentElement){
    const raw=getComputedStyle(node).backgroundColor,color=parse(raw);
    if(!color)return null;
    if(color[3]===0)continue;
    layers.push(color);
    if(color[3]===1)break;
   }
   if(!layers.length||layers[layers.length-1][3]!==1)layers.push([255,255,255,1]);
   return layers.reduceRight((under,top)=>over(top,under));
  };
  const out={bluish:[],shadows:[],floating:[],lowContrast:[]};
  const seen=new Set();
  for(const el of document.querySelectorAll('body *')){
   const cs=getComputedStyle(el),rect=el.getBoundingClientRect();
   if(rect.width<=0||rect.height<=0||cs.visibility==='hidden'||cs.display==='none')continue;
   let faded=false;
   for(let node=el;node&&node.nodeType===1;node=node.parentElement)if(Number(getComputedStyle(node).opacity)<1){faded=true;break;}
   const colors=[['color',cs.color],['background',cs.backgroundColor]];
   for(const side of ['Top','Right','Bottom','Left'])if(parseFloat(cs[`border${side}Width`])>0&&cs[`border${side}Style`]!=='none')colors.push([`border-${side.toLowerCase()}`,cs[`border${side}Color`]]);
   /* A folha do material (página do PDF e a prévia do PDF pelo tutor) tem tinta
      própria, a mesma que vai para o arquivo: não é cinza da interface. */
   const sheet=!!el.closest('.pdf-page,.pdf-doc');
   /* A amostra de cor de acento (Configurações → Aparência) é o próprio acento
      da spec — o grafite `#27272a` tem um fio de azul de propósito —, não um
      cinza da interface. */
   const sample=el.matches('.accent-dot');
   for(const [prop,raw] of colors){
    const c=parse(raw);
    if(!c||c[3]===0||(sheet&&prop==='color')||(sample&&prop==='background'))continue;
    const max=Math.max(c[0],c[1],c[2]),min=Math.min(c[0],c[1],c[2]);
    /* Cinza (pouca saturação) puxando para o azul. */
    if(max-min<=24&&c[2]>Math.max(c[0],c[1])){
     const key=prop+raw;
     if(!seen.has(key)){seen.add(key);out.bluish.push(`${name(el)} ${prop}: ${raw}`);}
    }
   }
   if(cs.boxShadow!=='none'){
    /* Sombra de verdade: deslocada ou desfocada. Anel de foco e fio interno
       (`inset`) são contorno, não profundidade. */
    const real=cs.boxShadow.split(/,(?![^(]*\))/).some(part=>{
     if(/\binset\b/.test(part))return false;
     const n=part.replace(/[a-z]+\([^)]*\)/g,'').match(/-?[\d.]+px/g)?.map(parseFloat)||[];
     return (n[0]||0)!==0||(n[1]||0)!==0||(n[2]||0)>0;
    });
    if(real)(el.matches(floating)?out.floating:out.shadows).push(`${name(el)}: ${cs.boxShadow}`);
   }
   /* Texto de verdade: separadores decorativos ("·") não entram na conta. */
   const ownText=[...el.childNodes].some(n=>n.nodeType===3&&/[\p{L}\p{N}]/u.test(n.textContent));
   if(ownText&&!faded&&!el.closest(':disabled')&&!el.closest('.pdf-page')){
    const fg=parse(cs.color),bg=backdrop(el);
    if(fg&&bg&&fg[3]>0&&Math.max(fg[0],fg[1],fg[2])-Math.min(fg[0],fg[1],fg[2])<=24){
     const text=over(fg,bg),a=lum(text),b=lum(bg);
     const ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
     if(ratio<4.5)out.lowContrast.push(`${name(el)} "${el.textContent.trim().slice(0,24)}": ${ratio.toFixed(2)} (${cs.color} sobre rgb(${bg.slice(0,3).map(Math.round).join(', ')}))`);
    }
   }
  }
  return out;
 },FLOATING);
}
/* `floats`: o que tem de aparecer com sombra nesta tela (trecho do nome). */
async function assertClean(page,label,floats=''){
 const facts=await scan(page);
 assert.deepEqual(facts.bluish,[],`${label}: nenhum cinza azulado`);
 assert.deepEqual(facts.shadows,[],`${label}: sombra só em menus, diálogos e avisos`);
 assert.deepEqual(facts.lowContrast,[],`${label}: texto cinza legível (4.5:1)`);
 if(floats)assert.ok(facts.floating.some(item=>item.includes(floats)),`${label}: ${floats} tem sombra (${facts.floating.join(' | ')||'nenhuma'})`);
}
/* A página como o olho vê: o pixel do canto do canvas, sem filtro por cima. */
/* Espera o canvas da página existir e estar pintado: com a máquina ocupada o
   reajuste do leitor refaz o canvas e a leitura pegava o nó antigo, solto do DOM. */
async function pagePixel(page){
 /* Espera e leitura no mesmo passo: em duas chamadas, o reajuste podia trocar o
    canvas entre a espera e a leitura, e o pixel vinha [0,0,0,0]. */
 const handle=await page.waitForFunction(()=>{
  const canvas=[...document.querySelectorAll('.pdf-page canvas')].find(c=>c.isConnected&&c.width>0);
  if(!canvas)return null;
  const [r,g,b,a]=canvas.getContext('2d').getImageData(3,3,1,1).data;
  return a>0?{pixel:[r,g,b,a/255],filter:getComputedStyle(canvas).filter}:null;
 },undefined,{timeout:15000});
 return handle.jsonValue();
}

await withArtifacts('papeis-de-cor',async ctx=>{
 const runtime=ctx.runtime=newRuntime('papeis-de-cor'),course=seedCourse(runtime,'Test');
 fs.mkdirSync(path.join(runtime,'learning','Courses','Outra'),{recursive:true});
 fs.writeFileSync(path.join(course,'Limites.pdf'),tinyPdf('Exercise',6));
 fs.writeFileSync(path.join(course,'Formulario.pdf'),tinyPdf('Support',6));
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'Test',name:'Teste',path:course},{id:'Outra',name:'Outra matéria',path:path.join(runtime,'learning','Courses','Outra')}],desk:{pinnedExtensions:false}});
 ctx.app=await launchDesk({runtime});
 const page=await ctx.app.firstWindow();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await statusOnline(page);
 await page.waitForSelector('.pdf-panel canvas',{timeout:25000});
 await freezeMotion(page);
 /* Uma fala de cada lado, para o balão do usuário e a resposta entrarem na conta. */
 await page.locator('#prompt').fill('Na 7b cheguei em 0/0 e travei. Qual teorema eu uso?');
 await page.locator('#send').click();
 await page.waitForSelector('.message.user',{timeout:15000});
 await page.waitForSelector('.message.assistant',{timeout:20000});
 await sendEnabled(page,{timeout:20000});

 for(const theme of ['light','dark']){
  const role=ROLES[theme],tag=theme==='light'?'claro':'escuro';
  await setTheme(page,theme);
  for(const size of SIZES){
   const label=`${tag} ${size.join('x')}`;
   await setSize(ctx.app,page,size);
   await page.mouse.move(2,2);

   sameColor(await style(page,'body','backgroundColor'),role.bg,`${label}: fundo do app`);
   sameColor(await style(page,'header','backgroundColor'),role.surface,`${label}: superfície (barra superior)`);
   sameColor(await style(page,'.pdf-panel','backgroundColor'),role.surface,`${label}: superfície (leitor)`);
   sameColor(await style(page,'#sidebar','backgroundColor'),role.tutor,`${label}: coluna do tutor`);
   sameColor(await style(page,'.pdf-viewport','backgroundColor'),role.stage,`${label}: palco do leitor`);
   assert.notEqual(await style(page,'#sidebar','backgroundColor'),await style(page,'.pdf-panel','backgroundColor'),`${label}: tutor e leitores têm fundos diferentes`);

   /* Seleção em cinza neutro: aba de matéria ativa. */
   sameColor(await style(page,'#course-tabs button.active','backgroundColor'),role.selected,`${label}: aba de matéria ativa`);
   const accent=await style(page,'#send','backgroundColor');
   assert.notEqual(await style(page,'#course-tabs button.active','color'),accent,`${label}: a aba ativa não usa o acento no texto`);

   /* Linhas de 1px: borda sob as barras de painel; borda forte entre os planos
      (leitor | leitor | tutor), que são colados e não têm borda própria. */
   assert.equal(await style(page,'.pdf-title','borderBottomWidth'),'1px',`${label}: linha da barra do leitor tem 1px`);
   sameColor(await style(page,'.pdf-title','borderBottomColor'),role.border,`${label}: borda`);
   assert.equal(await style(page,'.chat-head','borderBottomWidth'),'1px',`${label}: linha da barra do tutor tem 1px`);
   sameColor(await style(page,'.chat-head','borderBottomColor'),role.border,`${label}: borda (tutor)`);
   assert.equal(await style(page,'#divider','width'),'1px',`${label}: linha entre leitores e tutor tem 1px`);
   sameColor(await style(page,'#divider','backgroundColor'),role.borderStrong,`${label}: borda forte (tutor)`);
   assert.equal(await style(page,'.pdf-divider','width'),'1px',`${label}: linha entre os leitores tem 1px`);
   sameColor(await style(page,'.pdf-divider','backgroundColor'),role.borderStrong,`${label}: borda forte (leitores)`);
   assert.equal(await style(page,'header','borderBottomWidth'),'1px',`${label}: borda da barra superior tem 1px`);
   sameColor(await style(page,'header','borderBottomColor'),role.borderStrong,`${label}: borda forte (barra superior)`);

   /* A página do PDF é branca nos dois temas. */
   sameColor(await style(page,'.pdf-page','backgroundColor'),[255,255,255,1],`${label}: página do PDF`);
   const sheet=await pagePixel(page);
   assert.deepEqual(sheet,{pixel:[255,255,255,1],filter:'none'},`${label}: papel da página pintado de branco`);

   await assertClean(page,label);
   await shot(page,`${tag}-${size.join('x')}.png`);

   /* Hover: realce neutro na superfície; dentro do tutor, o tom de seleção. */
   await page.locator('#study-menu .nav-trigger').hover();
   sameColor(await style(page,'#study-menu .nav-trigger','backgroundColor'),role.hover,`${label}: hover na barra superior`);
   await page.locator('#new-session').hover();
   sameColor(await style(page,'#new-session','backgroundColor'),role.selected,`${label}: hover dentro da coluna do tutor`);
   await page.mouse.move(2,2);
  }

  /* Balão do usuário na coluna do tutor: superfície com borda. */
  sameColor(await style(page,'#messages .message.user .body','backgroundColor'),role.surface,`${tag}: balão do usuário`);
  sameColor(await style(page,'#messages .message.user .body','borderTopColor'),role.border,`${tag}: borda do balão`);

  /* O que flutua tem sombra — e continua sem cinza azulado e legível. */
  await page.locator('#study-menu .nav-trigger').click();
  await page.waitForSelector('#study-menu.open .nav-pop');
  await page.mouse.move(2,2);
  await assertClean(page,`${tag} menu Estudar`,'nav-pop');
  await shot(page,`${tag}-menu.png`);
  await page.keyboard.press('Escape');
  await page.waitForFunction(()=>!document.querySelector('#study-menu.open'));

  await page.keyboard.press('ControlOrMeta+,');
  await page.waitForSelector('#settings-dialog[open]');
  sameColor(await style(page,'#settings-dialog','backgroundColor'),role.surface,`${tag}: diálogo na superfície`);
  await assertClean(page,`${tag} Configurações`,'settings-dialog');
  await shot(page,`${tag}-configuracoes.png`);
  await page.keyboard.press('Escape');
  await page.waitForFunction(()=>!document.querySelector('#settings-dialog').open);

  /* Lista de sessões: diálogo com sombra; a etiqueta de assunto é neutra. */
  await openSessionLibrary(page);
  await page.waitForSelector('dialog.study-dialog[open] .chat-library-topic');
  sameColor(await style(page,'.chat-library-topic','backgroundColor'),role.selected,`${tag}: etiqueta de assunto`);
  assert.notEqual(await style(page,'.chat-library-topic','color'),await style(page,'#send','backgroundColor'),`${tag}: etiqueta de assunto sem acento`);
  await page.mouse.move(2,2);
  await assertClean(page,`${tag} lista de sessões`,'study-dialog');
  await shot(page,`${tag}-sessoes.png`);
  await page.keyboard.press('Escape');
  await page.waitForFunction(()=>!document.querySelector('dialog.study-dialog[open]'));

  /* Item ativo da paleta de ações: cinza de seleção. */
  await page.keyboard.press('ControlOrMeta+k');
  await page.waitForSelector('.palette-backdrop:not([hidden]) .palette-item.active');
  sameColor(await style(page,'.palette-item.active','backgroundColor'),role.selected,`${tag}: item ativo da paleta de ações`);
  await assertClean(page,`${tag} paleta de ações`,'palette');
  await shot(page,`${tag}-paleta.png`);
  await page.keyboard.press('Escape');
  await page.waitForFunction(()=>!document.querySelector('.palette-backdrop:not([hidden])'));

  await page.evaluate(async()=>{const state=await import('./src/state.mjs');state.toast('Aviso de teste');});
  await toastWait(page,'Aviso de teste');
  await assertClean(page,`${tag} aviso`,'toast-item');
  /* #27 B12: aviso em 13px, sem botão Desfazer. A posição (canto, junto do tutor)
     mudou na #52 e é medida em tests/toast-position-ui.mjs. */
  const toastBox=await page.evaluate(()=>{
   const el=document.querySelector('#toast .toast-item');
   return {size:getComputedStyle(el).fontSize,undo:!!el.querySelector('button')};
  });
  assert.equal(toastBox.size,'13px',`${tag}: aviso em 13px`);
  assert.equal(toastBox.undo,false,`${tag}: aviso comum sem Desfazer`);
  await shot(page,`${tag}-aviso.png`);
  await page.waitForFunction(()=>!document.querySelector('#toast .toast-item'),undefined,{timeout:15000});
 }

 await setTheme(page,'auto');
 assert.deepEqual(errors,[]);
 console.log('PASS: papéis de cor nos temas claro e escuro, em 1440x900 e 900x650');
});

console.log('Screenshots:',SHOT_DIR);
