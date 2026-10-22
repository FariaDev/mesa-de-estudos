// node tests/hunt-language.mjs — caça ao idioma errado (#41, fase 3).
// Sobe a Mesa em English e em Português e percorre as telas (menus, diálogos,
// Guia, Sobre, Configurações, paleta, Estatísticas, Caderno de revisão, aba
// Livre, GeoGebra, biblioteca de sessões…). Em cada estado lê o texto visível
// (texto, placeholder, aria-label, title, inclusive o que está oculto) e falha
// se achar palavra do OUTRO idioma, mensagem de núcleo sem tradução (U+E000) ou,
// em inglês, o vocabulário proibido (chat/thread/conversation). Lista tudo de
// uma vez, com a tela de cada achado.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {launchDesk,newRuntime,seedCourse,tinyPdf,writeConfigJson,withArtifacts,freezeMotion,statusOnline,openSessionLibrary} from './helpers.mjs';
import {uiTexts,findOtherLanguage} from './language-sweep.mjs';


/* Nomes neutros: o que a pessoa nomeia (matéria, arquivo) não é frase da interface. */
function scenario(tag){
  const runtime=newRuntime(tag);
  const dir=seedCourse(runtime,'A');
  fs.writeFileSync(path.join(dir,'Limites.pdf'),tinyPdf('Exercise',3));
  const panels=[{label:'Problems',prefer:['Limites']},{label:'Support',prefer:['Formul'],toggle:'Formulas'}];
  writeConfigJson(runtime,{runtimePath:runtime,vaultPath:runtime,courses:[{id:'A',name:'Calc',path:dir}],desk:{panels,endDay:true}});
  return runtime;
}

const closeAll=async page=>{
  for(let i=0;i<3;i++)await page.keyboard.press('Escape');
  await page.waitForTimeout(120);// espera fixa: Escape fecha o diálogo em animação curta e não há estado a consultar
};

/** Roda `open` (que leva a tela ao estado) e varre; falha de abertura vira achado, não aborta a caça. */
async function visit(ctx,name,open,options){
  try{
    await open(ctx.page);
    await ctx.page.waitForTimeout(250);// espera fixa: o texto da tela se assenta depois da abertura e não há evento que o diga
    const fresh=(await uiTexts(ctx.page,'body',options?.vocabulary===false?'':'#about-dialog,#settings-dialog')).filter(text=>!ctx.seen.has(text));
    fresh.forEach(text=>ctx.seen.add(text));
    ctx.findings.push(...findOtherLanguage(ctx.language,fresh,name,options));
  }catch(error){
    ctx.findings.push(`${name}: não abriu (${String(error.message).split('\n')[0]})`);
  }
  await closeAll(ctx.page).catch(()=>{});
}

const menu=(trigger,item)=>async page=>{
  await page.locator(`${trigger} .nav-trigger`).click();
  if(item)await page.locator(item).click();
};

const SCREENS=[
  ['janela principal',async()=>{}],
  ['menu Estudar',menu('#study-menu')],
  ['menu Ajustes',menu('#settings-menu')],
  ['Configurações',menu('#settings-menu','#settings'),{vocabulary:false}],
  ['Guia',menu('#settings-menu','#help')],
  ['Atalhos',menu('#settings-menu','#shortcuts')],
  ['Sobre',menu('#settings-menu','#about'),{vocabulary:false}],
  ['buscar estudos',menu('#study-menu','#study-search-open')],
  ['revisar hoje',menu('#study-menu','#study-review-today')],
  ['anotações dos PDFs',menu('#study-menu','#study-notes-open')],
  ['Estatísticas',menu('#study-menu','#study-stats-open')],
  ['Cópia de segurança',menu('#study-menu','#study-backup-open')],
  ['Compartilhar',menu('#study-menu','#study-share-open')],
  ['PDF do tutor',menu('#study-menu','#study-tutor-pdf')],
  ['paleta de comandos',async page=>page.keyboard.press('ControlOrMeta+k')],
  ['Encerrar por hoje',async page=>{await page.locator('#chat-more').click();await page.locator('#chat-more-pop #end-day').click();}],
  ['biblioteca de sessões',openSessionLibrary],
  ['Caderno de revisão',async page=>page.locator('#review-tab').click()],
  ['GeoGebra',async page=>page.locator('#course-tabs [data-id="geogebra"]').click()],
  ['calculadora aberta',async page=>page.locator('#calc-toggle').click()],
  ['menu de sessão nova',async page=>page.locator('#new-session').click()],
  ['chat lateral',async page=>page.locator('#sidechat-toggle').click()],
  ['menções @',async page=>{await page.locator('#prompt').fill('@');await page.waitForTimeout(300);// espera fixa: o popup de menções abre depois de uma busca assíncrona sem estado observável
  }],
  ['aba Livre',async page=>page.locator('#course-tabs [data-id="mesa-free"]').click()],
  ['Livre: mais opções',async page=>page.locator('#free-more').click()],
  ['Livre: montar PDF',async page=>{await page.locator('#free-more').click();await page.locator('#free-generate-pdf').click();}],
  ['Livre: criar matéria',async page=>{await page.locator('#free-more').click();await page.locator('#free-promote').click();}],
];

for(const language of ['en','pt-BR']){
  await withArtifacts(`hunt-language-${language}`,async ctx=>{
    const runtime=ctx.runtime=scenario(`hunt-language-${language}`);
    ctx.app=await launchDesk({runtime,env:{LEARNING_DESK_LOCALE:language}});
    const page=await ctx.app.firstWindow();
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.waitForSelector('.pdf-panel canvas',{timeout:30000});
    await statusOnline(page);
    await freezeMotion(page);
    const state={page,language,findings:[],seen:new Set()};
    for(const [name,open,options] of SCREENS)await visit(state,name,open,options);
    const unique=[...new Set(state.findings)];
    assert.ok(!unique.length,`${language}: ${unique.length} achado(s) de idioma\n${unique.join('\n')}`);
    assert.deepEqual(errors,[],'sem erro de página');
  });
}
console.log('hunt-language: telas varridas em English e Português sem palavra do outro idioma');
