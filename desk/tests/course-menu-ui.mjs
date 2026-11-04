// node tests/course-menu-ui.mjs — nome de matéria com marcação no seletor e nas abas (revisão de segurança).
// O nome da matéria vem da pasta: `<img src=x onerror=…>` e `<style>` no nome têm de
// aparecer como texto, não executar nem virar elemento. A matéria ativa ganha o ícone
// `check` no seletor (data-icon), então é o caminho que passava por innerHTML. Os menus
// do tutor (Mais opções, Nova sessão) seguem com ícone e rótulo depois da troca do
// `iconize` para nós DOM.
import assert from 'node:assert/strict';
import {withArtifacts,newRuntime,seedCourse,writeConfigJson,launchDesk,statusOnline,freezeMotion} from './helpers.mjs';

const HOSTILE='<img src=x onerror="window.__ataque=1"><style>#course-pop{display:none}</style>Física';

await withArtifacts('course-menu',async ctx=>{
 const runtime=ctx.runtime=newRuntime('course-menu');
 const calculo=seedCourse(runtime,'Calculo'),hostil=seedCourse(runtime,'Hostil');
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'Calculo',name:'Cálculo I',path:calculo},{id:'Hostil',name:HOSTILE,path:hostil}],desk:{pinnedExtensions:false}});
 ctx.app=await launchDesk({runtime});
 const page=await ctx.app.firstWindow();
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await statusOnline(page);
 await freezeMotion(page);
 await page.waitForSelector('#course-tabs button[data-id=Hostil]');
 await page.waitForFunction(()=>!document.querySelector('#course-tabs button[data-id=Hostil]')?.disabled);
 /* Torna a matéria hostil a ativa: é quando o seletor ganha `data-icon="check"`. */
 await page.locator('#course-tabs button[data-id=Hostil]').click();
 await page.waitForFunction(()=>document.querySelector('#course-tabs button[data-id=Hostil]')?.getAttribute('aria-selected')==='true');
 /* espera fixa: a imagem com `src` quebrado dispara o `onerror` depois de carregar; dá tempo de ele rodar. */
 await page.waitForTimeout(400);
 const menu=await page.evaluate(()=>{
  const pop=document.querySelector('#course-pop'),item=pop.querySelector('[data-id="Hostil"]');
  return {
   imgs:pop.querySelectorAll('img').length+document.querySelectorAll('#course-tabs img').length,
   styles:pop.querySelectorAll('style').length+document.querySelectorAll('#course-tabs style').length,
   fired:window.__ataque===1,
   label:item?.querySelector('span')?.textContent??null,
   icon:!!item?.querySelector('svg'),
  };
 });
 assert.equal(menu.fired,false,'a marcação do nome não executa');
 assert.equal(menu.imgs,0,'nenhum <img> do nome vira elemento no seletor e nas abas');
 assert.equal(menu.styles,0,'nenhum <style> do nome vira elemento');
 assert.equal(menu.label,HOSTILE,'o nome da matéria ativa aparece inteiro, como texto, no rótulo');
 assert.equal(menu.icon,true,'a matéria ativa mantém o ícone do seletor');
 /* Os menus do tutor: nenhum `data-icon` sobra sem virar ícone + rótulo. */
 const tutor=await page.evaluate(()=>({
  leftover:['#chat-more-pop','#new-session-pop'].reduce((n,sel)=>n+document.querySelectorAll(`${sel} [data-icon]`).length,0),
  withLabel:['#chat-more-pop','#new-session-pop'].reduce((n,sel)=>n+document.querySelectorAll(`${sel} svg + span`).length,0),
 }));
 assert.equal(tutor.leftover,0,'todo data-icon do menu do tutor vira ícone');
 assert.ok(tutor.withLabel>0,'os itens do menu do tutor têm ícone e rótulo em <span>');
 assert.deepEqual(errors,[],`erros de página: ${JSON.stringify(errors)}`);
});
console.log('course-menu-ui: ok');
