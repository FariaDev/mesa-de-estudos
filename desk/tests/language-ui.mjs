import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {launchDesk,newRuntime,seedCourse,tinyPdf,writeConfigJson,withArtifacts,screenshotDirectory,setTheme,freezeMotion,resizeWindow} from './helpers.mjs';
import {layoutStable,pollUntil} from './waits.mjs';
import ptBR from '../locales/pt-BR.json' with {type: 'json'};
import en from '../locales/en.json' with {type: 'json'};
import {uiTexts,assertNoOtherLanguage,assertEnglishVocabulary} from './language-sweep.mjs';

/* Idioma da interface (#41, fase 1), na janela real: o padrão segue o idioma do
   sistema (fr-FR → English, pt-PT → Português) sem gravar nada; a troca vale na
   hora, atualiza `<html lang>` e os menus nativos, sobrevive ao Cancelar das
   Configurações e fica lembrada em `desk.json`; a primeira abertura também
   escolhe o idioma. Cada tela da casca é varrida atrás de palavras do OUTRO
   idioma e medida (sem estouro nem corte) nos dois idiomas, nos dois temas, em
   1440×900 e 900×650. Capturas em MESA_REVIEW_SHOTS (olho humano, não asserção). */

const SHOT_DIR=screenshotDirectory('idioma');
const SIZES=[[1440,900],[900,650]];
const THEMES=['light','dark'];
const SECTIONS=['materias','leitores','mesa','avisos','pastas'];

/** Elementos visíveis cujo conteúdo é maior que a caixa (texto cortado ou vazando). A camada de texto do PDF é o conteúdo do material (pdf.js), o `.pdf-viewport` rola de propósito e o `.pdf-divider` é uma barra de 1px com área de arraste: nenhum é texto da interface. */
const clipped=(page,selector)=>page.evaluate(sel=>{
  const out=[];
  for(const el of document.querySelectorAll(`${sel} *`)){
    if(el.closest('[hidden]')||!el.getClientRects().length||el.matches('input,select,textarea,option,svg,svg *,code')||el.closest('.textLayer')||el.matches('.pdf-viewport,.pdf-divider'))continue;
    if(el.scrollWidth>el.clientWidth+1&&el.clientWidth>0)out.push(`${el.tagName.toLowerCase()}${el.id?'#'+el.id:''}${typeof el.className==='string'&&el.className?'.'+el.className.split(' ').join('.'):''}: ${(el.textContent||'').trim().slice(0,40)} (${el.scrollWidth}>${el.clientWidth})`);
  }
  const root=document.querySelector(sel).getBoundingClientRect();
  if(root.right>innerWidth+1||root.bottom>innerHeight+1||root.left<-1||root.top<-1)out.push(`${sel} fora da janela: ${Math.round(root.left)},${Math.round(root.top)} ${Math.round(root.width)}×${Math.round(root.height)}`);
  return out;
},selector);

/* A captura não leva caminho real: a pasta de dados mostra só o nome da última pasta durante a foto. */
async function maskedShot(page,file){
  const real=await page.evaluate(()=>[...document.querySelectorAll('.setup-path,#setup-chosen-folder,#setup-summary dd')].map(el=>{const text=el.textContent;if(/[\\/]/.test(text))el.textContent='…/'+text.split(/[\\/]/).filter(Boolean).pop();return text;}));
  await page.screenshot({path:file});
  await page.evaluate(texts=>{[...document.querySelectorAll('.setup-path,#setup-chosen-folder,#setup-summary dd')].forEach((el,i)=>{if(texts[i]!==undefined)el.textContent=texts[i];});},real);
}

const htmlLang=page=>page.evaluate(()=>document.documentElement.lang);
const waitLang=(page,lang)=>page.waitForFunction(l=>document.documentElement.lang===l,lang,{timeout:10000});
const readDesk=runtime=>JSON.parse(fs.readFileSync(path.join(runtime,'desk.json'),'utf8'));
const menuLabels=app=>app.evaluate(({Menu})=>Menu.getApplicationMenu().items.map(item=>({label:item.label,items:(item.submenu?.items||[]).map(sub=>sub.label).filter(Boolean)})));

function scenario(tag,{courses=true}={}){
  const runtime=newRuntime(tag);
  const list=[];
  if(courses){
    const dir=seedCourse(runtime,'A');
    fs.writeFileSync(path.join(dir,'Limites.pdf'),tinyPdf('Exercise',3));
    list.push({id:'A',name:'Calculus',path:dir});
  }
  /* Rótulos dos leitores são dado da pessoa (o padrão fica em português por regra do projeto): aqui, ASCII neutro. */
  const panels=[{label:'Problems',prefer:['Limites']},{label:'Support',prefer:['Formul'],toggle:'Formulas'}];
  writeConfigJson(runtime,{runtimePath:runtime,vaultPath:runtime,courses:list,desk:{panels}});
  return runtime;
}

async function boot(ctx,runtime,locale,{ready='.pdf-panel canvas'}={}){
  ctx.app=await launchDesk({runtime,env:{LEARNING_DESK_LOCALE:locale}});
  const page=await ctx.app.firstWindow();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.waitForSelector(ready,{timeout:30000});
  await freezeMotion(page);
  return {page,errors};
}

const openSettings=async page=>{
  await page.keyboard.press('ControlOrMeta+,');
  await page.waitForSelector('#settings-dialog[open]');
};
const cancelSettings=async page=>{
  await page.locator('#settings-dialog button[value="cancel"]').last().click();
  await page.waitForFunction(()=>!document.querySelector('#settings-dialog').open);
};
const pickLanguage=async(page,lang)=>{
  await page.locator('#settings-tab-avisos').click();
  await page.selectOption('#ui-language',lang);
  await waitLang(page,lang);
};

/* ---- 1. Padrão do sistema, troca na hora, Cancelar, lembrança e menus ---- */
await withArtifacts('idioma-troca',async ctx=>{
  const runtime=ctx.runtime=scenario('language-switch');

  let {page,errors}=await boot(ctx,runtime,'fr-FR');
  assert.equal(await htmlLang(page),'en','idioma do sistema sem pt → English');
  assert.equal(fs.existsSync(path.join(runtime,'desk.json'))&&readDesk(runtime).uiLanguage!==undefined&&readDesk(runtime).uiLanguage!=='',false,'seguir o sistema não grava escolha');
  const header=await uiTexts(page,'header');
  assertNoOtherLanguage('en',header,'barra superior');
  assertEnglishVocabulary(header,'barra superior');
  const topEn=await menuLabels(ctx.app);
  assert.ok(topEn.some(m=>m.label===en['menu.edit']),`menu nativo em inglês: ${JSON.stringify(topEn.map(m=>m.label))}`);
  assertNoOtherLanguage('en',topEn.flatMap(m=>[m.label,...m.items]),'menus nativos');

  await openSettings(page);
  assert.equal(await page.locator('#settings-title').textContent(),en['settings.title']);
  assertNoOtherLanguage('en',await uiTexts(page,'#settings-dialog'),'Configurações');
  assert.equal(await page.locator('#tutor-language').inputValue(),'follow','tutor acompanha as mensagens por padrão');

  await pickLanguage(page,'pt-BR');
  assert.equal(await page.locator('#settings-title').textContent(),ptBR['settings.title'],'a troca vale na hora, com o diálogo aberto');
  assertNoOtherLanguage('pt-BR',await uiTexts(page,'#settings-dialog'),'Configurações');
  assertNoOtherLanguage('pt-BR',await uiTexts(page,'header'),'barra superior');
  await pollUntil(()=>menuLabels(ctx.app),menus=>menus.some(m=>m.label===ptBR['menu.edit']),{what:'menu nativo em português'});
  assert.equal(readDesk(runtime).uiLanguage,'pt-BR','escolha gravada em desk.json');
  assert.equal(JSON.parse(fs.readFileSync(path.join(runtime,'config.json'),'utf8')).uiLanguage,undefined,'o config.json não leva o idioma');

  await cancelSettings(page);
  assert.equal(await htmlLang(page),'pt-BR','Cancelar não desfaz o idioma (como o tema)');
  await openSettings(page);
  await pickLanguage(page,'en');
  await cancelSettings(page);
  assert.equal(await htmlLang(page),'en','trocar de volta e cancelar também vale');
  await pickLanguage_via_reopen(page,'pt-BR');
  assert.deepEqual(errors,[],'sem erro de página');
  await ctx.app.close();

  /* Lembrado: a escolha vence o idioma do sistema na próxima abertura. */
  ({page,errors}=await boot(ctx,runtime,'fr-FR'));
  assert.equal(await htmlLang(page),'pt-BR','a escolha guardada vence o sistema');
  assertNoOtherLanguage('pt-BR',await uiTexts(page,'header'),'barra superior');
  assert.deepEqual(errors,[]);
});

async function pickLanguage_via_reopen(page,lang){
  await openSettings(page);
  await pickLanguage(page,lang);
  await cancelSettings(page);
}

/* ---- 2. pt-PT segue o português ---- */
await withArtifacts('idioma-pt-pt',async ctx=>{
  const runtime=ctx.runtime=scenario('language-ptpt');
  const {page}=await boot(ctx,runtime,'pt-PT');
  assert.equal(await htmlLang(page),'pt-BR','pt-PT → Português');
});

/* ---- 3. Idioma do tutor: a escolha fica em desk.json ---- */
await withArtifacts('idioma-tutor',async ctx=>{
  const runtime=ctx.runtime=scenario('language-tutor');
  const {page}=await boot(ctx,runtime,'pt-BR');
  await openSettings(page);
  await page.locator('#settings-tab-avisos').click();
  for(const choice of ['en','pt-BR','follow']){
    await page.selectOption('#tutor-language',choice);
    await pollUntil(()=>readDesk(runtime).tutorLanguage,value=>value===choice,{what:`tutorLanguage "${choice}" em desk.json`});
  }
  /* Com o tutor ligado e ocioso a troca já o religou; sem tutor ligado a nota diz quando vale (o ciclo completo é do tutor-language-ipc-smoke). */
  const note=await page.locator('#tutor-language-note').textContent();
  assert.ok([ptBR['settings.tutorLanguage.note'],ptBR['settings.tutorLanguage.relinked']].includes(note),`a nota diz quando vale: ${JSON.stringify(note)}`);
});

/* ---- 4. Primeira abertura ---- */
await withArtifacts('idioma-primeira-abertura',async ctx=>{
  const runtime=ctx.runtime=scenario('language-first-run',{courses:false});
  const {page,errors}=await boot(ctx,runtime,'fr-FR',{ready:'body[data-first-run="true"]'});
  assert.equal(await htmlLang(page),'en');
  const pressed=()=>page.evaluate(()=>[...document.querySelectorAll('#first-run-language [data-language]')].filter(b=>b.getAttribute('aria-pressed')==='true').map(b=>b.dataset.language));
  assert.deepEqual(await pressed(),['en']);
  assert.equal((await page.locator('#first-run-language').innerText()).replace(/\s+/g,' '),'Português · English','seletor "Português · English"');
  /* #64: a primeira abertura é a tela cheia `#setup`; o convite do tutor mora no passo Tutor. */
  const english=await uiTexts(page,'#setup');
  assertNoOtherLanguage('en',english,'primeira abertura');
  assertEnglishVocabulary(english,'primeira abertura');
  /* Até o passo Tutor: passeio pulado, nome e pasta (o seletor do sistema é falso). */
  const pdfs=path.join(runtime,'pdfs-idioma');fs.mkdirSync(pdfs,{recursive:true});fs.writeFileSync(path.join(pdfs,'Lista.pdf'),tinyPdf('Lista',1));
  await ctx.app.evaluate(({dialog},folder)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[folder]});},pdfs);
  await page.locator('#first-run-help').click();
  await page.locator('#setup-skip-tour').click();
  await page.locator('#first-run-name').fill('Calculus');
  await page.locator('#setup-next').click();
  await page.locator('#first-run-pick').click();
  await page.waitForFunction(()=>!document.querySelector('#setup-next').disabled);
  await page.locator('#setup-next').click();
  assert.equal(await page.locator('#setup-card').getAttribute('data-step'),'tutor');
  assert.match(await page.locator('#setup-card').textContent(),/I'm the tutor/,'convite do tutor em inglês');
  await page.locator('#first-run-language [data-language="pt-BR"]').click();
  await waitLang(page,'pt-BR');
  assert.deepEqual(await pressed(),['pt-BR']);
  assertNoOtherLanguage('pt-BR',await uiTexts(page,'#setup'),'primeira abertura (inclui o convite do tutor)');
  assert.equal(await page.locator('#first-run-name').getAttribute('placeholder'),ptBR['firstrun.namePlaceholder']);
  /* Regressão: o convite do tutor ficava na língua anterior depois da troca (chave em cache sem o idioma). */
  assert.match(await page.locator('#setup-card').textContent(),new RegExp(ptBR['firstrun.tutor.lead'].replace(/[.]/g,'\\.')),'convite do tutor em português');
  assert.equal(await page.locator('#setup-tutor-actions #connect').textContent(),ptBR['tutor.connect'],'os botões do tutor trocam de idioma');
  assert.equal(readDesk(runtime).uiLanguage,'pt-BR');
  const problems=[];
  for(const language of ['en','pt-BR']){
    await page.locator(`#first-run-language [data-language="${language}"]`).click();
    await waitLang(page,language);
    for(const theme of THEMES){
      await setTheme(page,theme);
      for(const [width,height] of SIZES){
        await resizeWindow(ctx.app,page,width,height);
        await layoutStable(page,'#setup-card');
        const tag=`${language}-${theme}-${width}x${height}`;
        for(const m of await clipped(page,'#setup'))problems.push(`${tag} #setup: ${m}`);
        await maskedShot(page,path.join(SHOT_DIR,`primeira-abertura-${tag}.png`));
      }
    }
  }
  assert.deepEqual(problems,[],'texto cortado ou fora da janela na primeira abertura');
  assert.deepEqual(errors,[]);
});

/* ---- 5. Telas medidas: idioma × tema × tamanho ---- */
await withArtifacts('idioma-telas',async ctx=>{
  const runtime=ctx.runtime=scenario('language-screens');
  const {page,errors}=await boot(ctx,runtime,'pt-BR');
  const problems=[];
  for(const language of ['en','pt-BR']){
    await openSettings(page);
    await pickLanguage(page,language);
    await cancelSettings(page);
    for(const theme of THEMES){
      await setTheme(page,theme);
      for(const [width,height] of SIZES){
        await resizeWindow(ctx.app,page,width,height);
        await layoutStable(page,'main');
        const tag=`${language}-${theme}-${width}x${height}`;
        for(const m of await clipped(page,'header'))problems.push(`${tag} barra: ${m}`);
        await page.screenshot({path:path.join(SHOT_DIR,`barra-${tag}.png`)});
        await openSettings(page);
        for(const section of SECTIONS){
          await page.locator(`#settings-tab-${section}`).click();
          await layoutStable(page,'#settings-dialog');
          for(const m of await clipped(page,'#settings-dialog'))problems.push(`${tag} ${section}: ${m}`);
          await page.screenshot({path:path.join(SHOT_DIR,`config-${section}-${tag}.png`)});
        }
        assertNoOtherLanguage(language,await uiTexts(page,'#settings-dialog'),`Configurações ${tag}`);
        await cancelSettings(page);
      }
    }
  }
  assert.deepEqual(problems,[],'texto cortado ou fora da janela');
  assert.deepEqual(errors,[]);
});

/* ---- 6. Coluna do tutor e leitores (fase 2): varridos e medidos nos dois idiomas ---- */
const TUTOR_POPUPS=[
  ['model-indicator','#model-pop'],
  ['session-title','#conversations-pop'],
  ['chat-more','#chat-more-pop'],
  ['new-session','#new-session-pop'],
  ['context-edit','#context-pop'],
];
const closePopups=page=>page.keyboard.press('Escape');

/** Abre o popover do botão, mede e varre, e fecha. */
async function sweepTutorPopup(page,language,tag,[button,popup],problems){
  await page.locator(`#${button}`).click();
  await page.waitForSelector(`${popup}:not([hidden])`,{timeout:10000});
  await layoutStable(page,popup);
  for(const m of await clipped(page,popup))problems.push(`${tag} ${popup}: ${m}`);
  assertNoOtherLanguage(language,await uiTexts(page,popup),`${popup} ${tag}`);
  await closePopups(page);
  await page.waitForSelector(`${popup}[hidden]`,{state:'attached',timeout:10000});
}

await withArtifacts('idioma-tutor-e-leitores',async ctx=>{
  const runtime=ctx.runtime=scenario('language-tutor-column');
  const {page,errors}=await boot(ctx,runtime,'pt-BR');
  const problems=[];
  for(const language of ['en','pt-BR']){
    await openSettings(page);
    await pickLanguage(page,language);
    await cancelSettings(page);
    for(const theme of THEMES){
      await setTheme(page,theme);
      for(const [width,height] of SIZES){
        await resizeWindow(ctx.app,page,width,height);
        await layoutStable(page,'main');
        const tag=`${language}-${theme}-${width}x${height}`;
        for(const selector of ['#chat','#references']){
          for(const m of await clipped(page,selector))problems.push(`${tag} ${selector}: ${m}`);
          const texts=await uiTexts(page,selector);
          assertNoOtherLanguage(language,texts,`${selector} ${tag}`);
          if(language==='en')assertEnglishVocabulary(texts,`${selector} ${tag}`);
        }
        await page.screenshot({path:path.join(SHOT_DIR,`tutor-e-leitores-${tag}.png`)});
        for(const popup of TUTOR_POPUPS)await sweepTutorPopup(page,language,tag,popup,problems);
      }
    }
  }
  assert.deepEqual(problems,[],'texto cortado ou fora da janela na coluna do tutor e nos leitores');
  assert.deepEqual(errors,[]);
});
console.log('idioma da interface: padrão do sistema, troca na hora, lembrança, primeira abertura, telas, coluna do tutor e leitores medidos');
