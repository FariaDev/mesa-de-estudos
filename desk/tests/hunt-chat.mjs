/* Caça a bugs da onda Bend no escopo do chat/diário (Mesa de Estudos).
   Roda com o harness do ui-smoke: Playwright, janela oculta, fake Pi, runtime
   temporário. Uso:
     node tests/hunt-chat.mjs                # todos os blocos
     HUNT=markdown,worklog-history node tests/hunt-chat.mjs
   Evidências (runtime + screenshot) ficam em tests/artifacts/<stamp>-<bloco>
   quando o bloco pede (`EVIDENCE=1`) ou falha. Nunca toca em .runtime/. */
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import {withArtifacts,launchDesk,newRuntime,seedCourse,seedPlot,seedNativeSession,writeDeskJson,writeConfigJson,toastWait,sendEnabled,statusOnline,PLOT_PNG,saveArtifacts} from './helpers.mjs';
import {icon} from '../icons.mjs';
import {trackTempDir} from './temp-dir.mjs';
import attachCore from '../src/generated/attachments.core.js';

/* Teto de bytes crus de um anexo (16 MB hoje): a lei mora em
   `core/laws/attachments.bend` e o teto é inclusivo — o arquivo do teste tem de
   passar dele por um byte para a recusa acontecer. */
const MAX_RAW_BYTES=Number(attachCore.maxRawBytes());


/* Cada bloco que sobe a janela precisa de config próprio: sem ele a Mesa abre
   na primeira execução e nunca chega ao status online (este computador não tem
   o vault do autor). O merge deixa vários `seedConfigured` no mesmo bloco. */
function seedConfigured(runtime,id){
 const course=seedCourse(runtime,id);
 let config={};
 try{config=JSON.parse(fs.readFileSync(path.join(runtime,'config.json'),'utf8'));}catch{}
 const courses=(Array.isArray(config.courses)?config.courses:[]).filter(entry=>entry.id!==id);
 courses.push({id,name:id,path:course});
 writeConfigJson(runtime,{...config,vaultPath:runtime,courses});
 return course;
}

const WANT=(process.env.HUNT||'').split(',').map(s=>s.trim()).filter(Boolean);
const EVIDENCE=process.env.EVIDENCE==='1';
const want=name=>!WANT.length||WANT.includes(name);
const log=(...a)=>console.log(...a);
function watch(page){
 const errors=[],consoleErrors=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
 return {errors,consoleErrors};
}
function deskLog(runtime){try{return fs.readFileSync(path.join(runtime,'desk.log'),'utf8');}catch{return '';}}
function png(){return Buffer.from(PLOT_PNG,'base64');}
/* Corpo interno do SVG de icons.mjs, normalizado como o browser serializa
   (<path/> vira <path></path>), para comparar com o DOM. */
const iconBody=name=>icon(name).replace(/^<svg[^>]*>/,'').replace(/<\/svg>$/,'').replace(/<(\w+)([^>]*)\/>/g,'<$1$2></$1>');
/* ------------------------------------------------------------------ */
/* 1. Markdown/LaTeX/HTML: sintaxe torta, XSS, assets e fallback        */
/* ------------------------------------------------------------------ */
if(want('markdown'))await withArtifacts('hunt-markdown',async ctx=>{
 const runtime=ctx.runtime=newRuntime('hunt-md');
 const course=seedConfigured(runtime,'Hunt');
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'Hunt',name:'Hunt',path:course}]});
 const plot=seedPlot(runtime,'Hunt');
 const missing=path.join(runtime,'learning','Courses','Hunt','nao-existe.png');
 const outside=path.join(trackTempDir(fs.mkdtempSync(path.join(os.tmpdir(),'mesa-fora-'))),'fora-da-area.png');
 fs.writeFileSync(outside,png());
 const texts=[
  'inline $x^2$ e \\(y\\) e \\[z\\] e escape \\$5 e malformado $a',
  'display:\n\n$$\\int_0^1 x\\,dx$$',
  'quebrado: $\\frac{$',
  '```js\nconst f = (x) => x > 1 && x < 9;\nif (a < b) return "ok";\n```',
  '```\nplain code\n```',
  '```html\n<script>alert(1)</script>\n```',
  `![curva **forte**](file://${plot} "título")`,
  `![sumida](file://${missing})`,
  `![fora](file://${outside})`,
  'xss <script>window.__xss=1</script> <img src=x onerror="window.__xss=2">',
  '[link](https://example.com) e [js](javascript:window.__xss=9)',
  '`'+`file://${plot}`+'`',
 ];
 const sessionFile=seedNativeSession(runtime,[
  {type:'message',message:{role:'user',content:[{type:'text',text:'teste de markdown'}]}},
  {type:'message',message:{role:'assistant',content:texts.map(text=>({type:'text',text}))}},
 ],{courseId:'Hunt'});
 writeDeskJson(runtime,{session:sessionFile,courseId:'Hunt'});
 const app=ctx.app=await launchDesk({runtime});
 const page=await app.firstWindow();const w=watch(page);
 await statusOnline(page);
 await page.waitForSelector('#messages .katex',{timeout:20000});
 await page.waitForSelector('#messages figure.asset img.plot',{timeout:20000});
 const facts=await page.evaluate(()=>{
  const body=document.querySelector('#messages .message.assistant .body');
  const figures=[...document.querySelectorAll('#messages figure.asset')];
  return {
   xss:window.__xss??null,
   scripts:body.querySelectorAll('script').length,
   inline:body.querySelectorAll('.katex').length,
   display:body.querySelectorAll('.katex-display').length,
   errors:body.querySelectorAll('.katex-error').length,
   tex:[...body.querySelectorAll('[data-tex]')].map(el=>el.dataset.tex),
   figures:figures.map(f=>({img:f.querySelector('img.plot')?true:false,caption:f.querySelector('figcaption')?.textContent??null,path:f.querySelector('img.plot')?.dataset.path??null})),
   fallback:[...body.querySelectorAll('code')].map(c=>c.textContent),
   codeBlocks:[...body.querySelectorAll('.codeblock')].map(block=>({lang:block.querySelector('.code-lang')?.textContent??'',pre:block.querySelector('pre')?.textContent??''})),
   links:[...body.querySelectorAll('a')].map(a=>({href:a.getAttribute('href'),text:a.textContent})),
   imgs:[...body.querySelectorAll('img')].map(i=>({cls:i.className,src:(i.getAttribute('src')||'').slice(0,40)})),
   escaped:body.textContent.includes('$5'),
  };
 });
 log('[markdown] fatos:',JSON.stringify(facts,null,1));
 if(w.consoleErrors.length)log('[markdown] console errors:',w.consoleErrors);
 assert.equal(facts.xss,null,'XSS não executa');
 assert.equal(facts.scripts,0,'script não sobrevive ao sanitize');
 assert.ok(facts.inline>=3,`inline math renderiza (${facts.inline})`);
 assert.ok(facts.display>=1,'display math renderiza');
 assert.ok(facts.tex.includes('$x^2$'),'data-tex guarda a fonte inline');
 assert.ok(facts.tex.includes('$$\\int_0^1 x\\,dx$$'),'data-tex guarda a fonte display');
 // quirk pré-existente (igual ao pré-rewrite): `\$` NÃO escapa — o `$` vira
 // abre-math e engole o texto até o próximo `$`. Registrado, não é regressão.
 log(`[markdown] escape \\$5 literal? ${facts.escaped} (comportamento do pré-rewrite também)`);
 const captionFig=facts.figures.find(f=>f.caption==='curva **forte**');
 assert.ok(captionFig,'figura do Markdown com legenda crua');
 assert.ok(captionFig.path&&captionFig.path.endsWith('plot.png'),'data-path da figura');
 assert.ok(facts.figures.filter(f=>f.img).length>=2,'imagem do Markdown e code-span viram figure');
 assert.ok(facts.fallback.some(t=>t.includes('nao-existe.png')),'imagem sumida volta como código');
 assert.ok(facts.fallback.some(t=>t.includes('fora-da-area.png')),'imagem fora da área volta como código (readImage recusa)');
 assert.ok(facts.codeBlocks.some(b=>b.pre.includes('=>')&&b.pre.includes('&&')&&b.pre.includes('<')),'bloco js preserva setas/ampersand/menor');
 assert.ok(facts.links.some(l=>l.href==='https://example.com'),'link http preservado');
 assert.ok(!facts.links.some(l=>(l.href||'').startsWith('javascript')),'href javascript removido');
 assert.deepEqual(w.errors,[],'sem pageerror');
 const dlog=deskLog(runtime);
 if(w.consoleErrors.length)log('[markdown] console errors:',w.consoleErrors);
 if(dlog)log('[markdown] desk.log:',dlog.slice(0,400));
 if(EVIDENCE)await saveArtifacts(ctx);
 log('HUNT markdown PASSED (com observações acima)');
});

/* ------------------------------------------------------------------ */
/* 2. Diário a partir do histórico: todos os kinds/status e o fold      */
/* ------------------------------------------------------------------ */
if(want('worklog-history'))await withArtifacts('hunt-worklog-history',async ctx=>{
 const runtime=ctx.runtime=newRuntime('hunt-wlhist');
 const course=seedConfigured(runtime,'Calc');
 const ts=1700000000000;
 const sessionFile=seedNativeSession(runtime,[
  {type:'message',message:{role:'user',content:[{type:'text',text:'pesquise e resuma'}],timestamp:ts}},
  {type:'message',message:{role:'assistant',content:[
   {type:'thinking',thinking:'Vou buscar referências.'},
   {type:'toolCall',id:'t1',name:'web_search',arguments:{query:'limites'}},
   {type:'toolCall',id:'t2',name:'open_reference',arguments:{query:'teorema fundamental'}},
   {type:'toolCall',id:'t3',name:'web_fetch',arguments:{url:'https://example.com/artigo'}},
   {type:'toolCall',id:'t4',name:'bash',arguments:{cmd:'ls -la'}},
   {type:'toolCall',id:'t5',name:'web_search',arguments:{query:'sem resultado'}},
  ],timestamp:ts+1000}},
  {type:'message',message:{role:'toolResult',toolCallId:'t1',toolName:'web_search',isError:false,content:[{type:'text',text:'1. [OD](https://example.com/od)'}],details:{results:[{title:'OD',url:'https://example.com/od'}]},timestamp:ts+2000}},
  {type:'message',message:{role:'toolResult',toolCallId:'t2',toolName:'open_reference',isError:false,content:[{type:'text',text:'referência: livro X'}],details:{},timestamp:ts+2500}},
  {type:'message',message:{role:'toolResult',toolCallId:'t3',toolName:'web_fetch',isError:false,content:[{type:'text',text:'conteúdo'}],details:{title:'Artigo',source:'https://example.com/artigo'},timestamp:ts+3000}},
  {type:'message',message:{role:'toolResult',toolCallId:'t4',toolName:'bash',isError:true,content:[{type:'text',text:'bloqueado'}],details:{},timestamp:ts+3500}},
  {type:'message',message:{role:'assistant',content:[{type:'text',text:'Resumo final.'}],timestamp:ts+4000}},
 ],{courseId:'Calc'});
 writeDeskJson(runtime,{session:sessionFile,courseId:'Calc'});
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'Calc',name:'Calc',path:course}]});
 const app=ctx.app=await launchDesk({runtime});
 const page=await app.firstWindow();const w=watch(page);
 await statusOnline(page);
 await page.waitForSelector('#messages .work',{timeout:20000});
 const snap=await page.evaluate(()=>{
  const work=document.querySelector('#messages .work');
  return {
   live:work.dataset.live,expanded:work.dataset.expanded,title:work.querySelector('.work-title').textContent,meta:work.querySelector('.work-meta').textContent,
   mark:!!work.querySelector('.work-mark svg'),
   dotsHidden:work.querySelector('.work-dots')?.hidden??null,
   steps:[...work.querySelectorAll('.work-step')].map(step=>({
    kind:step.dataset.kind,status:step.dataset.status,detail:step.dataset.detail,key:step.dataset.key,
    label:step.querySelector('.step-label').textContent,time:step.querySelector('.step-time')?.textContent??null,
    preview:step.querySelector('.step-preview').textContent,previewHidden:step.querySelector('.step-preview').hidden,
    text:step.querySelector('.step-text').textContent,textHidden:step.querySelector('.step-text').hidden,
    detailHidden:step.querySelector('.step-detail').hidden,
    links:[...step.querySelectorAll('.step-link')].map(a=>({href:a.getAttribute('href'),text:a.textContent})),
    linksHidden:step.querySelector('.step-links').hidden,
    toggleAria:step.querySelector('.step-toggle').getAttribute('aria-expanded'),
    statusIcon:step.querySelector('.step-status svg')?.innerHTML??'',
    iconName:step.querySelector('.step-icon svg')?.innerHTML??'',
   })),
  };
 });
 log('[worklog-history] snapshot:',JSON.stringify(snap,null,1));
 assert.equal(snap.live,'false');
 assert.equal(snap.expanded,'false','histórico nasce recolhido');
 assert.match(snap.title,/^Trabalhou por /);
 assert.match(snap.title,/2 buscas · 1 consulta · 1 página · 1 ferramenta/,'contagem por kind inclui parado/erro');
 assert.equal(snap.dotsHidden,true,'dots escondidos no fim');
 assert.deepEqual(snap.steps.map(s=>s.kind),['thinking','search','reference','fetch','tool','search']);
 assert.deepEqual(snap.steps.map(s=>s.status),['done','done','done','done','error','stopped']);
 assert.deepEqual(snap.steps.map(s=>s.detail),['true','true','true','true','true','false'],'passo parado sem resultado não tem detalhe');
 assert.ok(snap.steps.every(s=>s.toggleAria==='false'&&s.detailHidden),'passos fechados por padrão (detalhe escondido)');
 assert.match(snap.steps[1].label,/^Procurou na web: «limites»$/);
 assert.match(snap.steps[4].label,/^Usou bash$/);
 assert.match(snap.steps[5].label,/^Procurou na web: «sem resultado»$/);
 assert.deepEqual(snap.steps[1].links.map(l=>l.href),['https://example.com/od'],'link da busca');
 assert.match(snap.steps[3].links[0].href,/example\.com\/artigo/,'fetch vira link');
 assert.ok(snap.steps.every(s=>s.statusIcon),'todo passo fechado tem ícone de status');
 assert.ok(snap.steps.every(s=>s.time===null),'o passo não mostra horário próprio (#90)');
 // ícones coerentes com data-kind/data-status (assets do host)
 const KIND_ICON={thinking:'sparkles',search:'search',reference:'book',fetch:'globe',tool:'wrench',error:'alert'};
 const STATUS_ICON={done:'check',error:'alert',stopped:'stop'};
 snap.steps.forEach((s,i)=>{
  assert.equal(s.iconName,iconBody(KIND_ICON[s.kind]),`ícone do kind ${s.kind} (passo ${i})`);
  assert.equal(s.statusIcon,iconBody(STATUS_ICON[s.status]),`ícone do status ${s.status} (passo ${i})`);
 });
 assert.deepEqual(w.errors,[]);
 // abre o passo de erro e o parado; confere detalhe e foco
 const work=page.locator('#messages .work');
 await work.locator('.work-head').click();
 await page.waitForFunction(()=>document.querySelector('#messages .work').dataset.expanded==='true');
 const errStep=work.locator('.work-step[data-status="error"]');
 await errStep.locator('.step-toggle').click();
 await page.waitForFunction(()=>{const s=document.querySelector('.work-step[data-status="error"]');return s&&!s.querySelector('.step-text').hidden&&s.querySelector('.step-text').textContent.includes('bloqueado');});
 const focusAfter=await page.evaluate(()=>({key:document.activeElement?.dataset?.key||'',detail:document.activeElement?.closest?.('.work-step')?.dataset?.status||''}));
 assert.equal(focusAfter.key,'step-toggle-t4','o foco volta ao toggle depois do re-render');
 assert.equal(focusAfter.detail,'error');
 await errStep.locator('.step-toggle').click();
 await page.waitForFunction(()=>document.querySelector('.work-step[data-status="error"] .step-detail').hidden);
 assert.deepEqual(w.errors,[]);
 const dlog=deskLog(runtime);if(dlog)log('[worklog-history] desk.log:',dlog.slice(0,400));
 if(EVIDENCE)await saveArtifacts(ctx);
 log('HUNT worklog-history PASSED');
});

/* ------------------------------------------------------------------ */
/* 3. Diário ao vivo (observer no meio do turno) + interrupção          */
/* ------------------------------------------------------------------ */
if(want('worklog-live'))await withArtifacts('hunt-worklog-live',async ctx=>{
 const runtime=ctx.runtime=newRuntime('hunt-wllive');
 seedConfigured(runtime,'Calc');
 writeDeskJson(runtime,{courseId:'Calc'});
 const app=ctx.app=await launchDesk({runtime});
 const page=await app.firstWindow();const w=watch(page);
 await statusOnline(page);
 // Observa o DOM enquanto o turno corre: o fake emite os eventos em rajada,
 // mas cada um chega em um task do renderer — o MutationObserver registra o
 // estado intermediário (diário vivo, passo running com spinner/preview).
 await page.evaluate(()=>{
  window.__liveSnaps=[];
  const record=()=>{
   const work=document.querySelector('#messages .work[data-live="true"]');
   if(!work)return;
   const steps=[...work.querySelectorAll('.work-step')].map(s=>({
    kind:s.dataset.kind,status:s.dataset.status,
    label:s.querySelector('.step-label').textContent,
    preview:s.querySelector('.step-preview').textContent,previewHidden:s.querySelector('.step-preview').hidden,
    spin:!!s.querySelector('.step-spin'),
   }));
   window.__liveSnaps.push({activity:document.querySelector('#activity').textContent.trim(),title:work.querySelector('.work-title').textContent,meta:work.querySelector('.work-meta').textContent,expanded:work.dataset.expanded,dotsHidden:work.querySelector('.work-dots').hidden,steps});
  };
  const obs=new MutationObserver(record);
  obs.observe(document.querySelector('#messages'),{subtree:true,childList:true,attributes:true,attributeFilter:['data-live','data-expanded','data-status']});
  obs.observe(document.querySelector('#activity'),{subtree:true,childList:true,characterData:true});
  window.__liveObs=obs;
 });
 await page.locator('#prompt').fill('pensar profundo');
 await page.locator('#send').click();
 await page.waitForFunction(()=>[...document.querySelectorAll('.message.assistant .body')].some(el=>el.textContent.includes('É o OD.')),undefined,{timeout:20000});
 await sendEnabled(page,{timeout:15000});
 await page.waitForFunction(()=>{const all=document.querySelectorAll('.work');const el=all[all.length-1];return el&&el.dataset.live==='false';},undefined,{timeout:15000});
 const live=await page.evaluate(()=>{window.__liveObs?.disconnect();return window.__liveSnaps;});
 log('[worklog-live] snapshots vivos:',JSON.stringify(live,null,1));
 const running=live.flatMap(s=>s.steps).find(s=>s.status==='running');
 assert.ok(running,'o observer viu um passo running');
 assert.equal(running.kind,'search');
 assert.match(running.label,/^Procurando na web: «kojima xbox»$/);
 assert.equal(running.spin,true,'passo running mostra o spinner');
 assert.ok(live.some(s=>s.expanded==='true'),'o diário vivo abre');
 assert.ok(live.some(s=>s.dotsHidden===false),'os dots pulsam durante o turno');
 /* Regressão (captura do autor, 2026-10-21): com o diário vivo à vista, a faixa
    de baixo não repete o "pensando" nem o passo. */
 for(const snap of live)assert.equal(snap.activity,'',`com o diário vivo ("${snap.title}"), a faixa de baixo fica calada (veio "${snap.activity}")`);
 // o turno termina recolhido e com ícones coerentes
 const done=await page.evaluate(()=>{
  const work=[...document.querySelectorAll('.work')].at(-1);
  return {title:work.querySelector('.work-title').textContent,mark:work.querySelector('.work-mark svg')?.innerHTML??'',steps:[...work.querySelectorAll('.work-step')].map(s=>({kind:s.dataset.kind,status:s.dataset.status,statusIcon:s.querySelector('.step-status svg')?.innerHTML??''}))};
 });
 assert.match(done.title,/^Trabalhou por .* · 1 busca$/);
 assert.equal(done.mark,iconBody('check'),'marca de sucesso no fim');
 assert.deepEqual(done.steps.map(s=>s.status),['done','done']);
 assert.ok(done.steps.every(s=>s.statusIcon),'ícones de status no fim');
 assert.deepEqual(w.errors,[]);
 if(EVIDENCE)await saveArtifacts(ctx);
 log('HUNT worklog-live PASSED');
});

/* Turno só de texto: o fake não emite ferramenta, então não nasce diário — a
   faixa mostra o rótulo com o relógio do stream. O teste fixa o desenho. */
if(want('worklog-live-text'))await withArtifacts('hunt-worklog-text',async ctx=>{
 const runtime=ctx.runtime=newRuntime('hunt-wltext');
 seedConfigured(runtime,'Calc');
 writeDeskJson(runtime,{courseId:'Calc'});
 const app=ctx.app=await launchDesk({runtime,env:{FAKE_OPENCODE_CHAOS:'stall'}});
 const page=await app.firstWindow();const w=watch(page);
 await statusOnline(page);
 await page.locator('#prompt').fill('responda e trave no meio');
 await page.locator('#send').click();
 await page.waitForFunction(()=>[...document.querySelectorAll('.message.assistant .body')].some(el=>el.textContent.includes('Vou travar agora…')),undefined,{timeout:20000});
 await page.waitForTimeout(2200);// espera fixa: o relógio do diário é o que se testa — em 2,2 s a faixa continua estática, sem contador
 const live=await page.evaluate(()=>({
  work:document.querySelectorAll('#messages .work').length,
  activity:document.querySelector('#activity').textContent,activityTitle:document.querySelector('#activity').title,
  activityRole:document.querySelector('#activity').getAttribute('role'),
  stopHidden:document.querySelector('#stop').hidden,sendDisabled:document.querySelector('#send').disabled,
  partial:document.querySelector('.message.assistant .body')?.textContent??'',
  copyBtn:!!document.querySelector('.message.assistant .msg-copy'),
  pulse:!!document.querySelector('#activity .pulse'),
 }));
 log('[worklog-live-text] snapshot:',JSON.stringify(live,null,1));
 assert.equal(live.work,0,'turno só de texto não abre diário');
 assert.match(live.activity,/^Tutor está pensando… · \d+s$/,'faixa mostra o relógio do stream');
 assert.equal(live.activityTitle,live.activity);
 assert.equal(live.activityRole,'status');
 assert.equal(live.stopHidden,false,'Parar visível durante o stream');
 assert.equal(live.sendDisabled,true,'Enviar travado durante o stream');
 assert.match(live.partial,/Vou travar agora…/,'texto parcial já aparece');
 assert.equal(live.copyBtn,true,'bolha viva já tem Copiar');
 assert.deepEqual(w.errors,[]);
 log('HUNT worklog-live-text PASSED (observações no log)');
});







/* ------------------------------------------------------------------ */
/* 3c. Quiz: pular (cancelado), errar e nota da explicação              */
/* ------------------------------------------------------------------ */
if(want('quiz-edge'))await withArtifacts('hunt-quiz-edge',async ctx=>{
 const runtime=ctx.runtime=newRuntime('hunt-quiz-edge');
 seedConfigured(runtime,'Calc');
 writeDeskJson(runtime,{courseId:'Calc'});
 const quiz={name:'quiz',input:{question:'Quanto é 1+1?',details:'Pergunta de teste',options:[{label:'1'},{label:'2'}],correctAnswer:'2',explanation:'A resposta é $2$.'}};
 const app=ctx.app=await launchDesk({runtime,env:{FAKE_OPENCODE_MCP_CALLS:JSON.stringify([quiz,quiz])}});
 const page=await app.firstWindow();const w=watch(page);
 await statusOnline(page);
 // pular: veredito cancelado, sem marcas e sem ações
 await page.locator('#prompt').fill('quiz de teste');
 await page.locator('#send').click();
 await page.waitForSelector('.message.quiz .quiz-option');
 const card=page.locator('.message.quiz').first();
 assert.equal((await card.locator('.quiz-details').textContent()).trim(),'Pergunta de teste','details do quiz');
 await card.locator('.quiz-skip').click();
 await card.locator('.quiz-dismissed').waitFor({timeout:10000});
 assert.equal(await card.locator('.quiz-dismissed').textContent(),'Dispensado.');
 assert.equal(await card.locator('.quiz-option.correct,.quiz-option.wrong,.quiz-option.dim').count(),0,'cancelado não marca opções');
 assert.equal(await card.locator('.quiz-mark').count(),0);
 assert.equal(await card.locator('.quiz-dismissed').textContent(),'Dispensado.','o estado dispensado substitui as ações de envio');
 await sendEnabled(page);
 // errar: ✗ Incorreta com a opção errada marcada e a correta também
 await page.locator('#prompt').fill('quiz de teste');
 await page.locator('#send').click();
 await page.waitForFunction(()=>document.querySelectorAll('.message.quiz').length===2);
 const second=page.locator('.message.quiz').nth(1);
 await second.locator('.quiz-option').nth(0).click();
 await page.waitForFunction(()=>{const cards=document.querySelectorAll('.message.quiz');return cards[1]?.querySelector('.quiz-verdict')?.textContent.includes('Incorreta');});
 assert.equal(await second.locator('.quiz-option.wrong').count(),1,'opção errada marcada');
 assert.equal(await second.locator('.quiz-option.correct').count(),1,'a correta também é mostrada');
 assert.match(await second.locator('.quiz-option.wrong .quiz-mark').textContent(),/✗/);
 assert.match(await second.locator('.quiz-option.correct .quiz-mark').textContent(),/✓/);
 assert.ok(await second.locator('.quiz-explain .katex').count()>=1,'explicação com LaTeX');
 await sendEnabled(page);
 assert.deepEqual(w.errors,[]);
 if(EVIDENCE)await saveArtifacts(ctx);
 log('HUNT quiz-edge PASSED');
});

/* ------------------------------------------------------------------ */
/* 3d. Histórico: teto de 6 imagens e limpeza dos marcadores de contexto */
/* ------------------------------------------------------------------ */
if(want('history-images'))await withArtifacts('hunt-history-images',async ctx=>{
 const runtime=ctx.runtime=newRuntime('hunt-hist-img');
 seedConfigured(runtime,'Hunt');
 const records=[];
 for(let i=1;i<=8;i++){
  records.push({type:'message',message:{role:'user',content:[{type:'text',text:`imagem ${i}`},{type:'image',data:PLOT_PNG,mimeType:'image/png'}],timestamp:1700000000000+i*1000}});
  records.push({type:'message',message:{role:'assistant',content:[{type:'text',text:`ok ${i}`}],timestamp:1700000000000+i*1000+500}});
 }
 records.push({type:'message',message:{role:'user',content:[{type:'text',text:'pergunta real\n\n[Contexto da sessão na Mesa: matéria · p. 2]\n\n[Referências abertas: Limites.pdf p. 3]'}],timestamp:17000000010000}});
 records.push({type:'message',message:{role:'assistant',content:[{type:'text',text:'resposta final'}],timestamp:17000000010500}});
 const sessionFile=seedNativeSession(runtime,records,{courseId:'Hunt'});
 writeDeskJson(runtime,{session:sessionFile,courseId:'Hunt'});
 const app=ctx.app=await launchDesk({runtime});
 const page=await app.firstWindow();const w=watch(page);
 await statusOnline(page);
 await page.waitForSelector('#messages .message.user img.shot',{timeout:20000});
 const snap=await page.evaluate(()=>({
  shots:document.querySelectorAll('#messages .message.user img.shot').length,
  wraps:document.querySelectorAll('#messages .img-wrap img.shot').length,
  copied:document.querySelectorAll('#messages .img-wrap .img-copy').length,
  lastUser:[...document.querySelectorAll('#messages .message.user')].at(-1).querySelector('.body').textContent,
  alts:[...document.querySelectorAll('#messages .message.user img.shot')].map(i=>i.getAttribute('alt')),
 }));
 log('[history-images] snapshot:',JSON.stringify(snap,null,1));
 assert.equal(snap.shots,6,'o histórico mantém só as 6 imagens mais novas');
 assert.equal(snap.wraps,6,'toda imagem do histórico ganha o overlay de cópia');
 assert.equal(snap.copied,6);
 assert.equal(snap.lastUser.trim(),'pergunta real','os marcadores de contexto saem do display');
 assert.ok(!snap.lastUser.includes('Contexto da sessão'),'sem marcador de contexto');
 assert.ok(!snap.lastUser.includes('Referências abertas'),'sem marcador de referências');
 assert.deepEqual(w.errors,[]);
 if(EVIDENCE)await saveArtifacts(ctx);
 log('HUNT history-images PASSED');
});


/* Dois cards de quiz na mesma conversa: o foco restaurado no clique de uma
   opção não pode pular para o card anterior (as keys `quiz-option-N` repetem
   entre cards). O pré-rewrite atualizava o card no lugar e não perdia o foco. */
if(want('quiz-focus'))await withArtifacts('hunt-quiz-focus',async ctx=>{
 const runtime=ctx.runtime=newRuntime('hunt-quiz-focus');
 seedConfigured(runtime,'Calc');
 writeDeskJson(runtime,{courseId:'Calc'});
 const quiz={name:'quiz',input:{question:'Pergunta de teste',options:[{label:'1'},{label:'2'}],correctAnswer:['2'],multiSelect:true}};
 const app=ctx.app=await launchDesk({runtime,env:{FAKE_OPENCODE_MCP_CALLS:JSON.stringify([quiz,quiz])}});
 const page=await app.firstWindow();const w=watch(page);
 await statusOnline(page);
 await page.locator('#prompt').fill('quiz multi');
 await page.locator('#send').click();
 await page.waitForSelector('.message.quiz .quiz-option');
 const first=page.locator('.message.quiz').first();
 await first.locator('.quiz-option').nth(0).click();
 await first.locator('.quiz-option').nth(1).click();
 await first.locator('.quiz-send').click();
 await page.waitForFunction(()=>document.querySelectorAll('.quiz-verdict').length===1);
 await sendEnabled(page);
 await page.locator('#prompt').fill('quiz multi');
 await page.locator('#send').click();
 await page.waitForFunction(()=>document.querySelectorAll('.message.quiz').length===2);
 const second=page.locator('.message.quiz').nth(1);
 await second.locator('.quiz-option').nth(0).click();
 await page.waitForFunction(()=>{const cards=document.querySelectorAll('.message.quiz');return cards[1].querySelector('.quiz-option').getAttribute('aria-checked')==='true';});
 const focus=await page.evaluate(()=>{
  const cards=[...document.querySelectorAll('.message.quiz')];
  const active=document.activeElement;
  return {inCard:cards.findIndex(card=>card.contains(active)),key:active?.dataset?.cardKey||'',tag:active?.tagName||'',checked:active?.getAttribute?.('aria-checked')||''};
 });
 log('[quiz-focus] foco depois do clique no 2º card:',JSON.stringify(focus));
 assert.equal(focus.inCard,1,'o foco fica no card clicado, não no primeiro com a mesma key');
 assert.equal(focus.key,'option-1');
 assert.equal(focus.checked,'true','o foco está na opção marcada');
 assert.deepEqual(w.errors,[]);
 if(EVIDENCE)await saveArtifacts(ctx);
 log('HUNT quiz-focus PASSED');
});

/* ------------------------------------------------------------------ */
/* 4. Composer: anexos (teto, grande, tipo), rascunho por matéria       */
/* ------------------------------------------------------------------ */
if(want('composer'))await withArtifacts('hunt-composer',async ctx=>{
 const runtime=ctx.runtime=newRuntime('hunt-composer');
 seedConfigured(runtime,'A');seedConfigured(runtime,'B');
 const imgs=[];
 for(let i=1;i<=5;i++){const f=path.join(runtime,`anexo-${i}.png`);fs.writeFileSync(f,png());imgs.push(f);}
 const big=path.join(runtime,'grande-demais.png');
 // um byte ACIMA do teto: exatamente no teto o anexo entra (o teto é inclusivo)
 fs.writeFileSync(big,Buffer.alloc(MAX_RAW_BYTES+1,7));
 const txt=path.join(runtime,'nota.txt');fs.writeFileSync(txt,'não é imagem');
 writeDeskJson(runtime,{courseId:'A'});
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'A',name:'Matéria A',path:path.join(runtime,'learning','Courses','A')},{id:'B',name:'Matéria B',path:path.join(runtime,'learning','Courses','B')}]});
 const app=ctx.app=await launchDesk({runtime,env:{LEARNING_VAULT:runtime}});
 const page=await app.firstWindow();const w=watch(page);
 await statusOnline(page);
 // tipo errado é ignorado
 await page.setInputFiles('#attach-input',txt);
 await page.waitForTimeout(250);// espera fixa: "nada acontece em 0,25 s" — arquivo de tipo errado não vira anexo
 assert.equal(await page.locator('#attachments').isHidden(),true,'arquivo de texto não vira anexo');
 // teto de 4
 await page.setInputFiles('#attach-input',imgs);
 await toastWait(page,'Máximo de 4 imagens');
 assert.equal(await page.locator('#attachments .attachment').count(),4,'teto de 4 anexos');
 // grande demais
 await page.locator('#attachments .attachment-remove').first().click();
 await page.setInputFiles('#attach-input',big);
 await toastWait(page,'grande demais');
 assert.equal(await page.locator('#attachments .attachment').count(),3,'grande demais não entra');
 // remover o primeiro de dois: o × do sobrevivente continua funcionando
 await page.setInputFiles('#attach-input',imgs[0]);
 await page.waitForFunction(()=>document.querySelectorAll('#attachments .attachment').length===4);
 const namesBefore=await page.locator('#attachments .attachment img').evaluateAll(es=>es.map(e=>e.getAttribute('alt')));
 await page.locator('#attachments .attachment-remove').first().click();
 const namesAfter=await page.locator('#attachments .attachment img').evaluateAll(es=>es.map(e=>e.getAttribute('alt')));
 assert.deepEqual(namesAfter,namesBefore.slice(1),'remover o primeiro reindexa os demais');
 await page.locator('#attachments .attachment-remove').first().click();
 assert.equal(await page.locator('#attachments .attachment').count(),2,'o × do sobrevivente continua ligado');
 // rascunho por matéria
 await page.locator('#attachments .attachment-remove').first().click();
 await page.locator('#attachments .attachment-remove').first().click();
 await page.waitForFunction(()=>document.querySelector('#attachments').hidden);
 await page.locator('#prompt').fill('rascunho da matéria A');
 await page.locator('#course-tabs button[data-id="B"]').click();
 await page.waitForFunction(()=>{const t=document.querySelector('#course-tabs button[data-id="B"]');return t?.classList.contains('active');},{timeout:20000});
 await statusOnline(page,{timeout:30000});
 assert.equal(await page.locator('#prompt').inputValue(),'','matéria B não herda o rascunho de A');
 await page.locator('#prompt').fill('rascunho da matéria B');
 await page.locator('#course-tabs button[data-id="A"]').click();
 await page.waitForFunction(()=>{const t=document.querySelector('#course-tabs button[data-id="A"]');return t?.classList.contains('active');},{timeout:20000});
 await statusOnline(page,{timeout:30000});
 await page.waitForFunction(()=>document.querySelector('#prompt').value==='rascunho da matéria A',undefined,{timeout:10000});
 assert.deepEqual(w.errors,[]);
 const dlog=deskLog(runtime);if(dlog)log('[composer] desk.log:',dlog.slice(0,400));
 if(EVIDENCE)await saveArtifacts(ctx);
 log('HUNT composer PASSED');
});

/* ------------------------------------------------------------------ */
/* 5. Composer: citação (truncagem 8000), ⏎ envia e ⇧⏎ quebra linha    */
/* ------------------------------------------------------------------ */
if(want('quote'))await withArtifacts('hunt-quote',async ctx=>{
 const runtime=ctx.runtime=newRuntime('hunt-quote');
 seedConfigured(runtime,'Hunt');
 const long='palavra '.repeat(1400).trim(); // ~11k chars
 const sessionFile=seedNativeSession(runtime,[
  {type:'message',message:{role:'user',content:[{type:'text',text:long}]}},
  {type:'message',message:{role:'assistant',content:[{type:'text',text:'ok'}]}},
 ],{courseId:'Hunt'});
 writeDeskJson(runtime,{session:sessionFile,courseId:'Hunt'});
 const app=ctx.app=await launchDesk({runtime});
 const page=await app.firstWindow();const w=watch(page);
 await statusOnline(page);
 await page.waitForSelector('#messages .message.user');
 await page.evaluate(()=>{
  const p=document.querySelector('#messages .message.user .body');
  const range=document.createRange();range.selectNodeContents(p);
  const selection=getSelection();selection.removeAllRanges();selection.addRange(range);
 });
 await page.waitForSelector('#quote-btn:not([hidden])',{timeout:8000});
 await page.locator('#quote-btn').dispatchEvent('click');
 const quoted=await page.locator('#prompt').inputValue();
 const flat=quoted.split('\n').map(line=>line.replace(/^> ?/,'')).join('\n').trim();
 log('[quote] quoted length:',quoted.length,'flat length:',flat.length);
 assert.ok(quoted.startsWith('> '),'citação vira blockquote');
 assert.ok(flat.length<=8005,`citação truncada em 8000 (${flat.length})`);
 assert.ok(flat.endsWith('…'),'truncagem marca com reticências');
 await page.waitForFunction(()=>document.querySelector('#quote-btn')?.hidden===true,undefined,{timeout:2000}); // botão some depois de citar (com fade, #63)
 // ⏎ envia; ⇧⏎ quebra linha
 await page.locator('#prompt').fill('');
 await page.locator('#prompt').fill('teorema');
 await page.locator('#prompt').press('Shift+Enter');
 await page.waitForTimeout(200);// espera fixa: "nada acontece em 0,2 s" — ⇧⏎ não envia
 assert.equal(await page.locator('#messages .message.user').count(),1,'⇧⏎ não envia');
 assert.match(await page.locator('#prompt').inputValue(),/\n/,'⇧⏎ quebra linha');
 await page.locator('#prompt').press('Enter');
 await page.waitForFunction(()=>document.querySelectorAll('#messages .message.user').length===2,undefined,{timeout:10000});
 await page.waitForFunction(()=>[...document.querySelectorAll('.message.assistant .body')].some(el=>el.textContent.includes('Pitágoras')),undefined,{timeout:20000});
 assert.deepEqual(w.errors,[]);
 if(EVIDENCE)await saveArtifacts(ctx);
 log('HUNT quote PASSED');
});

/* ------------------------------------------------------------------ */
/* 6. Toasts: teto de 3, saída e clique inerte                          */
/* ------------------------------------------------------------------ */
if(want('toasts'))await withArtifacts('hunt-toasts',async ctx=>{
 const runtime=ctx.runtime=newRuntime('hunt-toast');
 seedConfigured(runtime,'Hunt');
 writeDeskJson(runtime,{courseId:'Hunt'});
 const app=ctx.app=await launchDesk({runtime});
 const page=await app.firstWindow();const w=watch(page);
 await page.waitForSelector('.pdf-panel',{timeout:30000});
 // dispara 5 toasts reais pela calculadora (expressão inválida)
 for(let i=0;i<5;i++){
  await page.evaluate(()=>{const e=document.querySelector('#expression');e.value='sqrt(';document.querySelector('#calc-form button').click();});
  await page.waitForTimeout(60);// espera fixa: intervalo da rajada de erros (o tempo entre eles é o que se testa)
 }
 const count=await page.locator('#toast .toast-item').count();
 log('[toasts] itens na fila:',count);
 assert.ok(count<=3,`teto de 3 toasts (viu ${count})`);
 const role=await page.locator('#toast').getAttribute('role');
 assert.equal(role,'status');
 await page.locator('#toast .toast-item').first().dispatchEvent('click');
 await page.waitForTimeout(100);// espera fixa: "nada acontece em 0,1 s" — o clique no toast não derruba a fila
 assert.ok(await page.locator('#toast .toast-item').count()>=1,'clique no toast não derruba a fila');
 await page.waitForFunction(()=>!document.querySelector('#toast .toast-item'),undefined,{timeout:12000});
 assert.deepEqual(w.errors,[]);
 log('HUNT toasts PASSED');
});

/* ------------------------------------------------------------------ */
/* 7. Rolagem: abrir passo com a conversa no topo não puxa para o fim   */
/* ------------------------------------------------------------------ */
if(want('scroll'))await withArtifacts('hunt-scroll',async ctx=>{
 const runtime=ctx.runtime=newRuntime('hunt-scroll');
 seedConfigured(runtime,'Hunt');
 const long=Array.from({length:150},(_,i)=>`Parágrafo ${i+1}: ${'texto '.repeat(12)}`).join('\n\n');
 const ts=1700000000000;
 const sessionFile=seedNativeSession(runtime,[
  {type:'message',message:{role:'user',content:[{type:'text',text:'mensagem longa'}],timestamp:ts}},
  {type:'message',message:{role:'assistant',content:[{type:'thinking',thinking:'Pensando com calma.'},{type:'toolCall',id:'t1',name:'web_search',arguments:{query:'longo'}}],timestamp:ts+1000}},
  {type:'message',message:{role:'toolResult',toolCallId:'t1',toolName:'web_search',isError:false,content:[{type:'text',text:'resultado'}],details:{results:[{title:'R',url:'https://example.com/r'}]},timestamp:ts+2000}},
  {type:'message',message:{role:'assistant',content:[{type:'text',text:long}],timestamp:ts+3000}},
 ],{courseId:'Hunt'});
 writeDeskJson(runtime,{session:sessionFile,courseId:'Hunt'});
 const app=ctx.app=await launchDesk({runtime});
 const page=await app.firstWindow();const w=watch(page);
 await statusOnline(page);
 await page.waitForSelector('#messages .work',{timeout:20000});
 /* Em janela baixa (conteúdo < 700px) o scroller é o #chat; nos tamanhos
    normais é o #messages. O contrato é "não puxar a rolagem", no que rola. */
 await page.waitForFunction(()=>{const c=document.querySelector('#chat'),m=document.querySelector('#messages');const s=c.scrollHeight>c.clientHeight+1?c:m;return s.scrollHeight>s.clientHeight+300;});
  const before=await page.evaluate(()=>{const c=document.querySelector('#chat'),m=document.querySelector('#messages');const s=c.scrollHeight>c.clientHeight+1?c:m;s.dispatchEvent(new WheelEvent('wheel',{bubbles:true,deltaY:-800}));s.scrollTop=0;s.dispatchEvent(new Event('scroll',{bubbles:true}));return s.scrollTop;});
 await page.locator('#messages .work-head').dispatchEvent('click');
 await page.waitForFunction(()=>document.querySelector('#messages .work').dataset.expanded==='true');
 await page.waitForTimeout(300);// espera fixa: "nada acontece em 0,3 s" — abrir o diário no topo não puxa a rolagem
 const afterOpen=await page.evaluate(()=>{const c=document.querySelector('#chat'),m=document.querySelector('#messages');return (c.scrollHeight>c.clientHeight+1?c:m).scrollTop;});
 assert.ok(afterOpen<=before+4,`abrir o diário no topo não puxa a rolagem (${before} -> ${afterOpen})`);
 await page.locator('.work-step .step-toggle').first().dispatchEvent('click');
 await page.waitForTimeout(300);// espera fixa: "nada acontece em 0,3 s" — abrir um passo no topo não puxa a rolagem
 const afterStep=await page.evaluate(()=>{const c=document.querySelector('#chat'),m=document.querySelector('#messages');return (c.scrollHeight>c.clientHeight+1?c:m).scrollTop;});
 assert.ok(afterStep<=before+4,`abrir um passo no topo não puxa a rolagem (${before} -> ${afterStep})`);
 assert.deepEqual(w.errors,[]);
 if(EVIDENCE)await saveArtifacts(ctx);
 log('HUNT scroll PASSED');
});

log('HUNT DONE');
