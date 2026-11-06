// Cerca e SVG solto sem `viewBox` (rodada 2026-11): `<svg width="20000"
// height="20000">` virava rolagem de 24 mil px porque nenhuma regra de coluna
// casava (`svg[viewBox]`). A cerca e a faixa do modelo derivam o `viewBox`
// das dimensões numéricas para a CSS escalar à coluna sem cortar o honesto,
// e a altura final tem teto. Figuras honestas (prolog, doctype, aria, xlink
// sem elo, filter sem carga externa) viram figura; `<style>`, `<use>`,
// `<image>`, entidade HTML e atributo sem aspas continuam código.
// Roda: `node tests/svg-viewbox-ui.mjs`.
import assert from 'node:assert/strict';
import {withArtifacts,newRuntime,seedCourse,seedNativeSession,writeConfigJson,writeDeskJson,launchDesk,statusOnline} from './helpers.mjs';

const huge = '<svg width="20000" height="20000"><rect width="20000" height="20000" fill="red"/></svg>';
const nested = [
  '<svg viewBox="0 0 10 10">',
  '<svg x="-5000" y="-5000" width="20000" height="20000"><rect width="20000" height="20000" fill="red"/></svg>',
  '<rect x="0" y="0" width="10" height="10" fill="blue"/>',
  '</svg>',
].join('\n');
const filterHonest = '<svg viewBox="0 0 20 20"><filter id="f"><feGaussianBlur stdDeviation="1"/></filter><rect width="20" height="20" fill="red" filter="url(#f)"/></svg>';
const xlinkBare = '<svg viewBox="0 0 20 20"><a xlink:href="#x"><text>oi</text></a></svg>';
const ariaHonest = '<svg viewBox="0 0 120 80" role="img" aria-label="Triangulo"><polygon points="1,1 5,5 1,5" fill="red"/></svg>';
const prolog = '<?xml version="1.0"?>\n<svg viewBox="0 0 20 20"><rect width="20" height="20"/></svg>';
const doctype = '<!DOCTYPE svg>\n<svg viewBox="0 0 20 20"><rect width="20" height="20"/></svg>';
const negStyle = '<svg viewBox="0 0 20 20"><style>.a{fill:red}</style><rect class="a" width="20" height="20"/></svg>';
const negUse = '<svg viewBox="0 0 20 20"><defs><path id="p" d="M0 0L10 10"/></defs><use href="#p"/></svg>';
const negImage = '<svg viewBox="0 0 20 20"><image href="data:image/png;base64,iVBORw0KGgo=" width="10" height="10"/></svg>';
const negEntity = '<svg viewBox="0 0 20 20"><text>a&nbsp;b</text></svg>';
const negUnquoted = '<svg viewBox="0 0 20 20"><rect width=20 height=20 fill=red/></svg>';
const tall = '<svg viewBox="0 0 10 10000"><rect x="0" y="0" width="10" height="10000" fill="red"/></svg>';
/* Quarta contraprova: largura sem `viewBox` derivável (cerca e solto), segunda
   dimensão inválida, expoente, comentário antes da raiz e `role` hostil. */
const wOnly = '<svg width="20000"><rect width="100" height="100" fill="red"/></svg>';
const wZeroH = '<svg width="20000" height="0"><rect width="100" height="100" fill="red"/></svg>';
const wExp = '<svg width="1e4" height="100"><rect width="100" height="100" fill="red"/></svg>';
const wNeg = '<svg width="20000" height="-1"><rect width="100" height="100" fill="red"/></svg>';
const wInf = '<svg width="20000" height="Infinity"><rect width="100" height="100" fill="red"/></svg>';
const prologComment = '<?xml version="1.0"?>\n<!-- figura honesta -->\n<svg viewBox="0 0 20 20"><rect width="20" height="20"/></svg>';
const honestBare = '<svg viewBox="0 0 100 60"><rect width="100" height="60" fill="red"/></svg>';
const roleHostile = '<svg viewBox="0 0 100 30" role="button" aria-label="Clique para enviar"><text y="12">FALSO-BOTAO</text></svg>';
const roleImg = '<svg viewBox="0 0 100 30" role="img" aria-label="Triangulo honesto"><polygon points="1,1 5,5 1,5" fill="red"/></svg>';

const fence = (body) => ['```svg', body, '```'].join('\n');
const text = [
  'VIEWBOX',
  '',
  'L-huge', '', fence(huge), '',
  'L-nested', '', fence(nested), '',
  'L-filter', '', fence(filterHonest), '',
  'L-xlink', '', fence(xlinkBare), '',
  'L-aria', '', fence(ariaHonest), '',
  'L-prolog', '', fence(prolog), '',
  'L-doctype', '', fence(doctype), '',
  'L-neg-style', '', fence(negStyle), '',
  'L-neg-use', '', fence(negUse), '',
  'L-neg-image', '', fence(negImage), '',
  'L-neg-entity', '', fence(negEntity), '',
  'L-neg-unquoted', '', fence(negUnquoted), '',
  'L-tall', '', fence(tall), '',
  'L-inline', '', 'solto <svg width="300" height="60"><rect width="300" height="60" fill="red"/></svg> fim', '',
  'L-w-only', '', fence(wOnly), '',
  'L-w-zeroH', '', fence(wZeroH), '',
  'L-w-exp', '', fence(wExp), '',
  'L-w-neg', '', fence(wNeg), '',
  'L-w-inf', '', fence(wInf), '',
  'L-w-inline', '', 'solto <svg width="20000"><rect width="100" height="100" fill="red"/></svg> fim', '',
  'L-prolog-comment', '', fence(prologComment), '',
  'L-honest-bare', '', fence(honestBare), '',
  'L-role-hostile', '', fence(roleHostile), '',
  'L-role-img', '', fence(roleImg), '',
].join('\n');

await withArtifacts('svg-viewbox',async ctx=>{
  const runtime=ctx.runtime=newRuntime('svg-viewbox');
  const course=seedCourse(runtime,'calc');
  writeConfigJson(runtime,{runtimePath:runtime,vaultPath:runtime,courses:[{id:'calc',name:'Cálculo I',path:course}]});
  const session=seedNativeSession(runtime,[
    {role:'user',content:[{type:'text',text:'oi'}]},
    {role:'assistant',content:[{type:'text',text}]},
  ],{courseId:'calc',started:Date.now()-3600000,preview:'oi'});
  writeDeskJson(runtime,{courseId:'calc',session,courseStates:{calc:{session,sessions:[{path:session,started:Date.now()-3600000}],pdfs:[],study:{title:'',xopp:''}}}});
  const app=ctx.app=await launchDesk({runtime,env:{FAKE_OPENCODE_REPLY:'ok'}});
  const page=await app.firstWindow();
  const errors=[];
  page.on('pageerror',(error)=>errors.push(String(error)));
  await statusOnline(page);
  await page.waitForSelector('#messages .message.assistant .body',{timeout:30000});
  await page.waitForFunction(() => document.querySelectorAll('#messages div.figure[data-figure=svg]').length >= 17, null, {timeout: 30000});
  // espera fixa: o layout assenta após as figuras para medir os rects
  await page.waitForTimeout(2500);
  const facts=await page.evaluate(()=>{
    const bodies=[...document.querySelectorAll('#messages .message.assistant .body')];
    const body=bodies[0];
    const byLabel=(label)=>{const p=[...body.querySelectorAll('p')].find((el)=>el.textContent.trim()===label);return p?p.nextElementSibling:null;};
    const probe=(label)=>{
      const node=byLabel(label);
      const figure=node?.matches?.('div.figure[data-figure=svg]')?node:node?.querySelector?.('div.figure[data-figure=svg]');
      const code=node?.matches?.('.codeblock')?node:node?.querySelector?.('.codeblock');
      const inline=node?.matches?.('svg')?node:node?.querySelector?.(':scope > svg');
      const svg=figure?.querySelector('svg')||inline;
      const rect=svg?.getBoundingClientRect();
      return {
        figure:figure?figure.innerHTML.slice(0,1200):null,
        code:code?code.textContent.slice(0,120):null,
        viewBox:svg?.getAttribute('viewBox'),
        svgRect:rect?{w:rect.width,h:rect.height}:null,
        filter:figure?.querySelector('filter')?.outerHTML.slice(0,200)||null,
        aria:svg?.getAttribute('aria-label'),
        role:svg?.getAttribute('role'),
        xlink:figure?.querySelector('a')?.getAttribute('xlink:href')||null,
      };
    };
    const messages=document.querySelector('#messages');
    return {
      huge:probe('L-huge'), nested:probe('L-nested'), filter:probe('L-filter'),
      xlink:probe('L-xlink'), aria:probe('L-aria'), prolog:probe('L-prolog'),
      doctype:probe('L-doctype'), negStyle:probe('L-neg-style'), negUse:probe('L-neg-use'),
      negImage:probe('L-neg-image'), negEntity:probe('L-neg-entity'),
      negUnquoted:probe('L-neg-unquoted'), tall:probe('L-tall'), inline:probe('L-inline'),
      wOnly:probe('L-w-only'), wZeroH:probe('L-w-zeroH'), wExp:probe('L-w-exp'),
      wNeg:probe('L-w-neg'), wInf:probe('L-w-inf'), wInline:probe('L-w-inline'),
      prologComment:probe('L-prolog-comment'), honestBare:probe('L-honest-bare'),
      roleHostile:probe('L-role-hostile'), roleImg:probe('L-role-img'),
      figureCount:body.querySelectorAll('div.figure[data-figure=svg]').length,
      codeCount:body.querySelectorAll('.codeblock').length,
      scroll:{w:messages.scrollWidth,h:messages.scrollHeight,cw:messages.clientWidth},
    };
  });
  /* Sem viewBox com dimensão numérica: vira figura com o viewBox derivado e
     cabe na coluna (nada de 24 mil px). */
  assert.match(facts.huge.figure||'',/<svg/,'huge não virou figura');
  assert.equal(facts.huge.viewBox,'0 0 20000 20000',`viewBox do huge: ${facts.huge.viewBox}`);
  assert.ok((facts.huge.svgRect?.h||1e9) < 2000,`huge estourou a coluna: ${JSON.stringify(facts.huge.svgRect)}`);
  /* Aninhado contido na figura externa. */
  assert.match(facts.nested.figure||'',/<svg/,'nested não virou figura');
  assert.ok((facts.nested.svgRect?.h||1e9) < 2000,`nested estourou: ${JSON.stringify(facts.nested.svgRect)}`);
  /* Honestas que faltavam: filter, xlink sem elo, aria, preâmbulo. */
  assert.match(facts.filter.figure||'',/<svg/,'filter não virou figura');
  assert.ok(facts.filter.filter && /feGaussianBlur/i.test(facts.filter.filter),`primitiva do filter sumiu: ${facts.filter.filter}`);
  assert.match(facts.xlink.figure||'',/<svg/,'xlink sem elo não virou figura');
  assert.equal(facts.xlink.xlink,'#x',`xlink:href não sobreviveu: ${facts.xlink.xlink}`);
  assert.match(facts.aria.figure||'',/<svg/,'aria não virou figura');
  assert.equal(facts.aria.aria,'Triangulo',`aria-label sumiu: ${facts.aria.aria}`);
  assert.match(facts.prolog.figure||'',/<svg/,'preâmbulo xml não virou figura');
  assert.match(facts.doctype.figure||'',/<svg/,'doctype svg não virou figura');
  /* As que continuam código. */
  for (const key of ['negStyle','negUse','negImage','negEntity','negUnquoted']) {
    assert.ok(facts[key].code && !facts[key].figure,`${key} virou figura (não deveria): ${(facts[key].figure||'').slice(0,200)}`);
  }
  /* Alto honesto com teto final; solto sem viewBox escala sem cortar. */
  assert.match(facts.tall.figure||'',/<svg/,'tall não virou figura');
  assert.ok((facts.tall.svgRect?.h||1e9) <= 700,`tall sem teto: ${JSON.stringify(facts.tall.svgRect)}`);
  assert.equal(facts.inline.viewBox,'0 0 300 60',`viewBox do solto: ${facts.inline.viewBox}`);
  assert.ok((facts.inline.svgRect?.w||1e9) <= 600,`solto estourou a coluna: ${JSON.stringify(facts.inline.svgRect)}`);
  /* Quarta contraprova: largura sem `viewBox` derivável fica na coluna pelo
     teto de CSS (não depende de `viewBox`, vale aninhado e solto). */
  for (const key of ['wOnly','wZeroH','wNeg','wInf']) {
    assert.match(facts[key].figure||'',/<svg/,`${key} não virou figura`);
    assert.equal(facts[key].viewBox,null,`${key} derivou viewBox sem par válido: ${facts[key].viewBox}`);
    assert.ok((facts[key].svgRect?.w||1e9) <= 600,`${key} estourou a coluna: ${JSON.stringify(facts[key].svgRect)}`);
  }
  assert.match(facts.wExp.figure||'',/<svg/,'wExp não virou figura');
  assert.equal(facts.wExp.viewBox,'0 0 1e4 100',`expoente não derivou: ${facts.wExp.viewBox}`);
  assert.ok((facts.wExp.svgRect?.w||1e9) <= 600,`wExp estourou a coluna: ${JSON.stringify(facts.wExp.svgRect)}`);
  assert.ok((facts.wInline.svgRect?.w||1e9) <= 600,`solto largo estourou a coluna: ${JSON.stringify(facts.wInline.svgRect)}`);
  /* Comentário (e preâmbulo) antes da raiz não derruba figura honesta. */
  assert.match(facts.prologComment.figure||'',/<svg/,'comentário antes da raiz virou código');
  assert.match(facts.honestBare.figure||'',/<svg viewBox="0 0 100 60"/,'honesta só com viewBox mudou');
  /* `role` hostil sai, `img` honesto fica, `aria-label` continua. */
  assert.match(facts.roleHostile.figure||'',/<svg/,'role hostil virou código (não deveria: só o role sai)');
  assert.equal(facts.roleHostile.role,null,`role hostil sobreviveu: ${facts.roleHostile.role}`);
  assert.equal(facts.roleHostile.aria,'Clique para enviar',`aria-label honesto sumiu: ${facts.roleHostile.aria}`);
  assert.equal(facts.roleImg.role,'img',`role="img" honesto sumiu: ${facts.roleImg.role}`);
  /* Nenhuma rolagem gigante na conversa. */
  assert.ok(facts.scroll.h < 20000,`rolagem de ataque: ${JSON.stringify(facts.scroll)}`);
  assert.ok(facts.scroll.w - facts.scroll.cw < 60,`rolagem horizontal de ataque: ${JSON.stringify(facts.scroll)}`);
  assert.deepEqual(errors,[],`erros de página: ${JSON.stringify(errors)}`);
  await app.close();ctx.app=null;
});
console.log('svg-viewbox-ui: ok');
