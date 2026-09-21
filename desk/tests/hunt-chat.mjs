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
import {withArtifacts,launchDesk,newRuntime,seedCourse,seedPlot,seedSession,writeDeskJson,writeConfigJson,toastWait,sendEnabled,statusOnline,PLOT_PNG,saveArtifacts} from './helpers.mjs';
import {icon} from '../icons.mjs';

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
function png(size=64){return Buffer.from(PLOT_PNG,'base64');}
/* Corpo interno do SVG de icons.mjs, normalizado como o browser serializa
   (<path/> vira <path></path>), para comparar com o DOM. */
const iconBody=name=>icon(name).replace(/^<svg[^>]*>/,'').replace(/<\/svg>$/,'').replace(/<(\w+)([^>]*)\/>/g,'<$1$2></$1>');
/* Fake Pi roteirizado para os caminhos que o fake-pi padrão não alcança:
   agente que começa (agent_start), pensa devagar, abre ferramenta e então
   falha (`desk_error`) ou é interrompido (abort → agent_end). Grava no runtime
   temporário e entra por LEARNING_DESK_PI. */
function writeHuntPi(runtime){
 const file=path.join(runtime,'hunt-pi.mjs');
 fs.writeFileSync(file,`#!/usr/bin/env node
import fs from 'node:fs';
const MODE=process.env.HUNT_PI_MODE||'error';
const THINK_MS=Number(process.env.HUNT_PI_THINK_MS)||400;
const THINK_TEXT=process.env.HUNT_PI_THINK_TEXT||'Vou considerar ';
const model={provider:'test',id:'offline',name:'Pi de teste',input:['text','image']};
let streaming=false;
function reply(e,data){process.stdout.write(JSON.stringify({type:'response',id:e.id,success:true,data})+'\\n');}
function emit(ev){process.stdout.write(JSON.stringify(ev)+'\\n');}
function uiLog(entry){try{if(process.env.HUNT_PI_LOG)fs.appendFileSync(process.env.HUNT_PI_LOG,JSON.stringify(entry)+'\\n');}catch{}}
process.stdin.setEncoding('utf8');let buffer='';
process.stdin.on('data',chunk=>{buffer+=chunk;let end;while((end=buffer.indexOf('\\n'))>=0){const raw=buffer.slice(0,end);buffer=buffer.slice(end+1);if(!raw.trim())continue;let e;try{e=JSON.parse(raw);}catch{continue;}
 if(e.type==='extension_ui_response'){uiLog(e);continue;}
 if(e.type==='get_state')reply(e,{model,thinkingLevel:'off',isStreaming:streaming,pendingMessageCount:0,autoCompactionEnabled:true});
 else if(e.type==='get_messages')reply(e,{messages:[]});
 else if(e.type==='get_available_models')reply(e,{models:[model]});
 else if(e.type==='get_commands')reply(e,{commands:[]});
 else if(e.type==='get_session_stats')reply(e,{contextUsage:{tokens:12000,contextWindow:200000,percent:6}});
 else if(e.type==='set_auto_compaction'||e.type==='set_model'||e.type==='set_thinking_level')reply(e,{});
 else if(e.type==='compact')reply(e,{summary:'resumo',tokensBefore:1000});
 else if(e.type==='clear_queue')reply(e,{});
 else if(e.type==='abort'){reply(e,{});setTimeout(()=>{if(streaming){emit({type:'agent_end'});streaming=false;}},120);}
 else if(e.type==='prompt'){
  reply(e,{});streaming=true;
  if(MODE==='ui'){
   emit({type:'extension_ui_request',id:'ui-notify',method:'notify',message:'Aviso do hunt',notifyType:'info'});
   emit({type:'extension_ui_request',id:'ui-confirm',method:'confirm',title:'Confirmar?',message:'Deseja seguir?'});
   emit({type:'extension_ui_request',id:'ui-input',method:'input',title:'Digite',message:'Um valor',prefill:'pré',placeholder:'dica'});
   emit({type:'extension_ui_request',id:'ui-editor',method:'editor',title:'Edite',message:'Texto',prefill:'linha1',placeholder:'escreva'});
   emit({type:'extension_ui_request',id:'ui-select',method:'select',title:'Escolha',message:'Uma opção',options:['um','dois'],prefill:'dois'});
   emit({type:'extension_ui_request',id:'ui-text',method:'set_editor_text',text:'texto no composer'});
   return;
  }
  emit({type:'agent_start'});
  emit({type:'message_start',message:{role:'assistant'}});
  emit({type:'message_update',assistantMessageEvent:{type:'thinking_delta',delta:THINK_TEXT}});
  setTimeout(()=>{
   emit({type:'message_update',assistantMessageEvent:{type:'thinking_delta',delta:'com calma.'}});
   emit({type:'tool_execution_start',toolCallId:'hunt-t1',toolName:'web_search',args:{query:'teste do hunt'}});
   setTimeout(()=>{
    if(MODE==='error'){emit({type:'desk_error',message:'Falha combinada do hunt.'});streaming=false;return;}
    emit({type:'tool_execution_end',toolCallId:'hunt-t1',toolName:'web_search',isError:false,result:{content:[{type:'text',text:'ok'}],details:{results:[{title:'Hunt',url:'https://example.com/hunt'}]}}});
    emit({type:'message_start',message:{role:'assistant'}});
    emit({type:'message_update',assistantMessageEvent:{type:'text_delta',delta:'Terminei.'}});
    emit({type:'message_end',message:{role:'assistant',content:[{type:'text',text:'Terminei.'}]}});
    emit({type:'agent_end'});streaming=false;
   },3000);
  },THINK_MS);
 }
 else if(e.id)reply(e,{});
}});
`);
 fs.chmodSync(file,0o755);
 return file;
}

/* ------------------------------------------------------------------ */
/* 1. Markdown/LaTeX/HTML: sintaxe torta, XSS, assets e fallback        */
/* ------------------------------------------------------------------ */
if(want('markdown'))await withArtifacts('hunt-markdown',async ctx=>{
 const runtime=ctx.runtime=newRuntime('hunt-md');
 seedCourse(runtime,'Hunt');
 const plot=seedPlot(runtime,'Hunt');
 const missing=path.join(runtime,'learning','Courses','Hunt','nao-existe.png');
 const outside=path.join(runtime,'..','fora-da-area.png');
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
 const sessionFile=seedSession(runtime,[
  {type:'message',message:{role:'user',content:[{type:'text',text:'teste de markdown'}]}},
  {type:'message',message:{role:'assistant',content:texts.map(text=>({type:'text',text}))}},
 ]);
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
 const course=seedCourse(runtime,'Calc');
 const ts=1700000000000;
 const sessionFile=seedSession(runtime,[
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
 ]);
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
    label:step.querySelector('.step-label').textContent,time:step.querySelector('.step-time').textContent,
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
 seedCourse(runtime,'Calc');
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
    time:s.querySelector('.step-time').textContent,spin:!!s.querySelector('.step-spin'),
   }));
   window.__liveSnaps.push({title:work.querySelector('.work-title').textContent,meta:work.querySelector('.work-meta').textContent,expanded:work.dataset.expanded,dotsHidden:work.querySelector('.work-dots').hidden,steps});
  };
  const obs=new MutationObserver(record);
  obs.observe(document.querySelector('#messages'),{subtree:true,childList:true,attributes:true,attributeFilter:['data-live','data-expanded','data-status']});
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

/* Turno só de texto: o fake não emite agent_start/thinking/ferramenta, então
   não nasce diário — a faixa fica no rótulo estático. Mesmo desenho do
   pré-rewrite; o teste fixa o comportamento. */
if(want('worklog-live-text'))await withArtifacts('hunt-worklog-text',async ctx=>{
 const runtime=ctx.runtime=newRuntime('hunt-wltext');
 seedCourse(runtime,'Calc');
 writeDeskJson(runtime,{courseId:'Calc'});
 const app=ctx.app=await launchDesk({runtime,env:{FAKE_PI_CHAOS:'stall'}});
 const page=await app.firstWindow();const w=watch(page);
 await statusOnline(page);
 await page.locator('#prompt').fill('responda e trave no meio');
 await page.locator('#send').click();
 await page.waitForFunction(()=>[...document.querySelectorAll('.message.assistant .body')].some(el=>el.textContent.includes('Vou travar agora…')),undefined,{timeout:20000});
 await page.waitForTimeout(2200);
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
 assert.equal(live.work,0,'turno só de texto não abre diário (sem agent_start no fake)');
 assert.equal(live.activity,'Pi está pensando…','faixa estática sem relógio');
 assert.equal(live.activityTitle,live.activity);
 assert.equal(live.activityRole,'status');
 assert.equal(live.stopHidden,false,'Parar visível durante o stream');
 assert.equal(live.sendDisabled,true,'Enviar travado durante o stream');
 assert.match(live.partial,/Vou travar agora…/,'texto parcial já aparece');
 assert.equal(live.copyBtn,true,'bolha viva já tem Copiar');
 assert.deepEqual(w.errors,[]);
 log('HUNT worklog-live-text PASSED (observações no log)');
});

/* stream-abort puro: o fake morre antes de qualquer agent_start/thinking/
   ferramenta, então não há diário para recolher — só o texto parcial, o toast
   e o busy destravado (o smoke cobre o resto). */
if(want('abort'))await withArtifacts('hunt-abort',async ctx=>{
 const runtime=ctx.runtime=newRuntime('hunt-abort');
 seedCourse(runtime,'Chaos');
 writeDeskJson(runtime,{courseId:'Chaos'});
 const app=ctx.app=await launchDesk({runtime,env:{FAKE_PI_CHAOS:'stream-abort'}});
 const page=await app.firstWindow();const w=watch(page);
 await statusOnline(page);
 await page.locator('#prompt').fill('comece a responder e caia no meio');
 await page.locator('#send').click();
 await toastWait(page,'Pi encerrou',{timeout:20000});
 await sendEnabled(page,{timeout:15000});
 const snap=await page.evaluate(()=>({
  works:document.querySelectorAll('.work').length,
  partial:[...document.querySelectorAll('.message.assistant .body')].map(el=>el.textContent).filter(t=>t.includes('cair no meio')).length,
  stopHidden:document.querySelector('#stop').hidden,
 }));
 log('[abort] snapshot:',JSON.stringify(snap));
 assert.equal(snap.works,0,'sem agent_start não nasce diário (igual ao pré-rewrite)');
 assert.equal(snap.partial,1,'texto parcial sobrevive ao erro');
 assert.equal(snap.stopHidden,true,'Parar some com o busy destravado');
 assert.deepEqual(w.errors,[]);
 log('HUNT abort PASSED');
});

/* desk_error com diário aberto: o fake roteirizado emite agent_start +
   pensamento + ferramenta antes de falhar. O host precisa fechar o diário
   como interrompido e marcar o erro. */
if(want('diary-error'))await withArtifacts('hunt-diary-error',async ctx=>{
 const runtime=ctx.runtime=newRuntime('hunt-diary-error');
 seedCourse(runtime,'Calc');
 writeDeskJson(runtime,{courseId:'Calc'});
 const pi=writeHuntPi(runtime);
 const app=ctx.app=await launchDesk({runtime,env:{LEARNING_DESK_PI:pi,HUNT_PI_MODE:'error'}});
 const page=await app.firstWindow();const w=watch(page);
 await statusOnline(page);
 await page.locator('#prompt').fill('comece e falhe no meio');
 await page.locator('#send').click();
 await toastWait(page,'Falha combinada do hunt.',{timeout:20000});
 await sendEnabled(page,{timeout:15000});
 await page.waitForFunction(()=>{const all=document.querySelectorAll('.work');const el=all[all.length-1];return el&&el.dataset.live==='false';},undefined,{timeout:15000});
 const snap=await page.evaluate(()=>{
  const work=[...document.querySelectorAll('.work')].at(-1);
  return {title:work.querySelector('.work-title').textContent,expanded:work.dataset.expanded,
   mark:work.querySelector('.work-mark svg')?.innerHTML??'',
   dotsHidden:work.querySelector('.work-dots').hidden,
   steps:[...work.querySelectorAll('.work-step')].map(s=>({kind:s.dataset.kind,status:s.dataset.status,label:s.querySelector('.step-label').textContent,statusIcon:s.querySelector('.step-status svg')?.innerHTML??'',text:s.querySelector('.step-text').textContent})),
  };
 });
 log('[diary-error] snapshot:',JSON.stringify(snap,null,1));
 assert.match(snap.title,/^Turno interrompido após /);
 assert.equal(snap.expanded,'false','diário recolhe no erro');
 assert.equal(snap.dotsHidden,true);
 assert.equal(snap.mark,iconBody('alert'),'marca vira alerta');
 assert.deepEqual(snap.steps.map(s=>s.kind),['thinking','search','error'],'passo de erro entra no diário');
 assert.deepEqual(snap.steps.map(s=>s.status),['done','stopped','error'],'ferramenta pendente fecha como parada');
 assert.match(snap.steps[2].text,/Erro do Pi: Falha combinada do hunt\./);
 assert.ok(snap.steps.every(s=>s.statusIcon),'todo passo tem ícone de status');
 assert.deepEqual(w.errors,[]);
 if(EVIDENCE)await saveArtifacts(ctx);
 log('HUNT diary-error PASSED');
});

/* Parada do usuário (Esc) com diário aberto: a ferramenta running vira
   stopped, o título vira "Você parou após…" e o passo de pensamento fica
   expandido com o preview. */
if(want('diary-stop'))await withArtifacts('hunt-diary-stop',async ctx=>{
 const runtime=ctx.runtime=newRuntime('hunt-diary-stop');
 seedCourse(runtime,'Calc');
 writeDeskJson(runtime,{courseId:'Calc'});
 const pi=writeHuntPi(runtime);
 const app=ctx.app=await launchDesk({runtime,env:{LEARNING_DESK_PI:pi,HUNT_PI_MODE:'stop'}});
 const page=await app.firstWindow();const w=watch(page);
 await statusOnline(page);
 await page.locator('#prompt').fill('comece e espere');
 await page.locator('#send').click();
 // primeiro estado vivo: pensamento running (o fake segura 400ms até a ferramenta)
 await page.waitForSelector('.work-step[data-kind="thinking"][data-status="running"]',{timeout:10000});
 const liveThinking=await page.evaluate(()=>{
  const work=document.querySelector('#messages .work');
  const thinking=work.querySelector('.work-step[data-kind="thinking"]');
  return {live:work.dataset.live,title:work.querySelector('.work-title').textContent,meta:work.querySelector('.work-meta').textContent,
   dots:!work.querySelector('.work-dots').hidden,mark:work.querySelector('.work-mark svg')?.innerHTML??'',
   status:thinking.dataset.status,label:thinking.querySelector('.step-label').textContent,
   preview:thinking.querySelector('.step-preview').textContent,previewHidden:thinking.querySelector('.step-preview').hidden,
   spin:!!thinking.querySelector('.step-spin'),time:thinking.querySelector('.step-time').textContent,
   activity:document.querySelector('#activity').textContent};
 });
 log('[diary-stop] pensamento vivo:',JSON.stringify(liveThinking,null,1));
 assert.equal(liveThinking.live,'true');
 assert.equal(liveThinking.title,'Pensando…','título vivo do pensamento');
 assert.equal(liveThinking.dots,true);
 assert.equal(liveThinking.mark,iconBody('sparkles'),'marca viva é o sparkles');
 assert.equal(liveThinking.status,'running');
 assert.equal(liveThinking.label,'Pensando…');
 assert.match(liveThinking.preview,/^Vou considerar/,`preview vivo do pensamento (${liveThinking.preview})`);
 assert.equal(liveThinking.previewHidden,false);
 assert.equal(liveThinking.spin,true,'spinner no pensamento vivo');
 // segundo estado vivo: a ferramenta running com o pensamento já fechado
 await page.waitForSelector('.work-step[data-status="running"][data-kind="search"]',{timeout:10000});
 await page.waitForTimeout(1000);
 const live=await page.evaluate(()=>{
  const work=document.querySelector('#messages .work');
  const thinking=work.querySelector('.work-step[data-kind="thinking"]');
  const running=work.querySelector('.work-step[data-status="running"]');
  return {live:work.dataset.live,title:work.querySelector('.work-title').textContent,meta:work.querySelector('.work-meta').textContent,
   dots:!work.querySelector('.work-dots').hidden,mark:work.querySelector('.work-mark svg')?.innerHTML??'',
   thinking:{status:thinking.dataset.status,label:thinking.querySelector('.step-label').textContent,preview:thinking.querySelector('.step-preview').textContent,previewHidden:thinking.querySelector('.step-preview').hidden},
   running:{kind:running.dataset.kind,label:running.querySelector('.step-label').textContent,spin:!!running.querySelector('.step-spin'),time:running.querySelector('.step-time').textContent},
   activity:document.querySelector('#activity').textContent};
 });
 log('[diary-stop] ferramenta viva:',JSON.stringify(live,null,1));
 assert.equal(live.live,'true');
 assert.equal(live.title,'Procurando na web: «teste do hunt»','título vivo segue o passo corrente');
 assert.match(live.meta,/^\d+s$/);
 assert.equal(live.dots,true);
 assert.equal(live.thinking.status,'done');
 assert.match(live.thinking.label,/^Pensou por \d+s$/);
 assert.equal(live.thinking.preview,'','preview some quando o pensamento fecha');
 assert.equal(live.thinking.previewHidden,true);
 assert.equal(live.running.kind,'search');
 assert.equal(live.running.spin,true,'spinner na ferramenta viva');
 assert.match(live.activity,/Procurando na web: «teste do hunt» · \d+s/,'faixa mostra o passo vivo com relógio');
 await page.keyboard.press('Escape');
 await page.waitForFunction(()=>{const all=document.querySelectorAll('.work');const el=all[all.length-1];return el&&el.dataset.live==='false';},undefined,{timeout:15000});
 const snap=await page.evaluate(()=>{
  const work=[...document.querySelectorAll('.work')].at(-1);
  return {title:work.querySelector('.work-title').textContent,expanded:work.dataset.expanded,
   mark:work.querySelector('.work-mark svg')?.innerHTML??'',
   steps:[...work.querySelectorAll('.work-step')].map(s=>({kind:s.dataset.kind,status:s.dataset.status,statusIcon:s.querySelector('.step-status svg')?.innerHTML??''}))};
 });
 log('[diary-stop] fim:',JSON.stringify(snap,null,1));
 assert.match(snap.title,/^Você parou após \d+s · 1 busca$/);
 assert.equal(snap.expanded,'false');
 assert.deepEqual(snap.steps.map(s=>s.status),['done','stopped']);
 assert.equal(snap.steps[1].statusIcon,iconBody('stop'),'ícone de parada na ferramenta interrompida');
 assert.equal(snap.mark,iconBody('alert'),'marca de alerta também na parada do usuário (paridade com o pré-rewrite: qualquer reason vira alerta)');
 assert.deepEqual(w.errors,[]);
 if(EVIDENCE)await saveArtifacts(ctx);
 log('HUNT diary-stop PASSED');
});

/* ------------------------------------------------------------------ */
/* 3b. Diálogos do Pi (confirm/input/editor/select), fila e respostas   */
/* ------------------------------------------------------------------ */
if(want('dialog-ui'))await withArtifacts('hunt-dialog-ui',async ctx=>{
 const runtime=ctx.runtime=newRuntime('hunt-dialog-ui');
 seedCourse(runtime,'Calc');
 writeDeskJson(runtime,{courseId:'Calc'});
 const pi=writeHuntPi(runtime);
 const logFile=path.join(runtime,'ui-responses.jsonl');
 const app=ctx.app=await launchDesk({runtime,env:{LEARNING_DESK_PI:pi,HUNT_PI_MODE:'ui',HUNT_PI_LOG:logFile}});
 const page=await app.firstWindow();const w=watch(page);
 await statusOnline(page);
 await page.locator('#prompt').fill('ui');
 await page.locator('#send').click();
 await toastWait(page,'Aviso do hunt',{timeout:15000});
 // confirm
 await page.waitForSelector('#pi-dialog[open]');
 assert.equal(await page.locator('#dialog-title').textContent(),'Confirmar?','título do confirm');
 assert.equal(await page.locator('#dialog-message').textContent(),'Deseja seguir?');
 assert.equal(await page.locator('#dialog-fields #dialog-value').count(),0,'confirm não tem campo');
 await page.locator('#dialog-ok').click();
 // input
 await page.waitForFunction(()=>document.querySelector('#pi-dialog[open]')&&document.querySelector('#dialog-title').textContent==='Digite');
 const input=page.locator('#dialog-value');
 assert.equal(await input.evaluate(el=>el.tagName),'INPUT');
 assert.equal(await input.inputValue(),'pré','prefill do input');
 assert.equal(await input.getAttribute('placeholder'),'dica');
 await input.fill('novo');
 await page.locator('#dialog-ok').click();
 // editor
 await page.waitForFunction(()=>document.querySelector('#pi-dialog[open]')&&document.querySelector('#dialog-title').textContent==='Edite');
 const editor=page.locator('#dialog-value');
 assert.equal(await editor.evaluate(el=>el.tagName),'TEXTAREA');
 assert.equal(await editor.inputValue(),'linha1');
 assert.equal(await editor.getAttribute('placeholder'),'escreva');
 await editor.fill('linha2');
 await page.locator('#pi-dialog button[value="cancel"]').click();
 // select
 await page.waitForFunction(()=>document.querySelector('#pi-dialog[open]')&&document.querySelector('#dialog-title').textContent==='Escolha');
 const pick=page.locator('#dialog-value');
 assert.equal(await pick.evaluate(el=>el.tagName),'SELECT');
 assert.deepEqual(await pick.locator('option').evaluateAll(es=>es.map(o=>o.value)),['um','dois'],'opções do select vêm do núcleo');
 assert.equal(await pick.inputValue(),'dois','prefill marca a opção');
 await pick.selectOption('um');
 await page.locator('#dialog-ok').click();
 await page.waitForFunction(()=>!document.querySelector('#pi-dialog').open);
 // set_editor_text chega ao composer
 await page.waitForFunction(()=>document.querySelector('#prompt').value==='texto no composer');
 const responses=fs.readFileSync(logFile,'utf8').trim().split('\n').map(l=>JSON.parse(l));
 log('[dialog-ui] respostas:',JSON.stringify(responses));
 assert.deepEqual(responses.find(r=>r.id==='ui-confirm'),{id:'ui-confirm',type:'extension_ui_response',confirmed:true},'confirm responde confirmed');
 assert.deepEqual(responses.find(r=>r.id==='ui-input'),{id:'ui-input',type:'extension_ui_response',value:'novo'},'input responde o valor digitado');
 assert.deepEqual(responses.find(r=>r.id==='ui-editor'),{id:'ui-editor',type:'extension_ui_response',cancelled:true},'editor cancelado responde cancelled');
 assert.deepEqual(responses.find(r=>r.id==='ui-select'),{id:'ui-select',type:'extension_ui_response',value:'um'},'select responde a opção escolhida');
 assert.deepEqual(w.errors,[]);
 if(EVIDENCE)await saveArtifacts(ctx);
 log('HUNT dialog-ui PASSED');
});

/* O relógio do diário vivo não pode repintar a árvore inteira: seleção e
   rolagem do detalhe aberto precisam sobreviver ao tick de 1s (o pré-rewrite
   só atualizava o tempo). */
if(want('diary-selection'))await withArtifacts('hunt-diary-selection',async ctx=>{
 const runtime=ctx.runtime=newRuntime('hunt-diary-sel');
 seedCourse(runtime,'Calc');
 writeDeskJson(runtime,{courseId:'Calc'});
 const pi=writeHuntPi(runtime);
 const app=ctx.app=await launchDesk({runtime,env:{LEARNING_DESK_PI:pi,HUNT_PI_MODE:'stop',HUNT_PI_THINK_MS:'9000',HUNT_PI_THINK_TEXT:'palavra '.repeat(200)}});
 const page=await app.firstWindow();const w=watch(page);
 await statusOnline(page);
 await page.locator('#prompt').fill('pense bastante');
 await page.locator('#send').click();
 await page.waitForSelector('.work-step[data-kind="thinking"][data-status="running"]',{timeout:15000});
 await page.locator('.work-step[data-kind="thinking"] .step-toggle').dispatchEvent('click');
 await page.waitForFunction(()=>{const s=document.querySelector('.work-step[data-kind="thinking"] .step-detail');return s&&!s.hidden;});
 await page.evaluate(()=>{
  const pre=document.querySelector('.work-step[data-kind="thinking"] .step-text');
  pre.scrollTop=40;
  const range=document.createRange();range.selectNodeContents(pre);
  const selection=getSelection();selection.removeAllRanges();selection.addRange(range);
 });
 const before=await page.evaluate(()=>({collapsed:getSelection().isCollapsed,scroll:document.querySelector('.work-step[data-kind="thinking"] .step-text').scrollTop,lines:document.querySelector('.work-step[data-kind="thinking"] .step-text').textContent.length}));
 await page.waitForTimeout(2400);
 const after=await page.evaluate(()=>({collapsed:getSelection().isCollapsed,scroll:document.querySelector('.work-step[data-kind="thinking"] .step-text').scrollTop,meta:document.querySelector('.work .work-meta')?.textContent??'',open:!document.querySelector('.work-step[data-kind="thinking"] .step-detail').hidden}));
 log('[diary-selection] antes:',JSON.stringify(before),'depois:',JSON.stringify(after));
 assert.equal(before.collapsed,false,'seleção montada');
 assert.equal(after.open,true,'o detalhe continua aberto no tick');
 assert.equal(after.collapsed,false,'o tick de 1s não pode apagar a seleção do detalhe');
 assert.equal(after.scroll,40,'o tick de 1s não pode resetar a rolagem do detalhe');
 assert.match(after.meta,/^\d+s$/,'o relógio continua andando no tick');
 await page.keyboard.press('Escape');
 await page.waitForFunction(()=>{const all=document.querySelectorAll('.work');const el=all[all.length-1];return el&&el.dataset.live==='false';},undefined,{timeout:15000});
 assert.deepEqual(w.errors,[]);
 if(EVIDENCE)await saveArtifacts(ctx);
 log('HUNT diary-selection PASSED');
});

/* ------------------------------------------------------------------ */
/* 3c. Quiz: pular (cancelado), errar e nota da explicação              */
/* ------------------------------------------------------------------ */
if(want('quiz-edge'))await withArtifacts('hunt-quiz-edge',async ctx=>{
 const runtime=ctx.runtime=newRuntime('hunt-quiz-edge');
 seedCourse(runtime,'Calc');
 writeDeskJson(runtime,{courseId:'Calc'});
 const app=ctx.app=await launchDesk({runtime});
 const page=await app.firstWindow();const w=watch(page);
 await statusOnline(page);
 // pular: veredito cancelado, sem marcas e sem ações
 await page.locator('#prompt').fill('quiz de teste');
 await page.locator('#send').click();
 await page.waitForSelector('.message.quiz .quiz-option');
 const card=page.locator('.message.quiz').first();
 assert.equal(await card.locator('.quiz-details').textContent(),'Pergunta de teste','details do quiz');
 await card.locator('.quiz-skip').click();
 await page.waitForFunction(()=>[...document.querySelectorAll('.quiz-verdict')].some(el=>el.textContent.includes('Quiz cancelado')));
 assert.equal(await card.locator('.quiz-verdict').textContent(),'Quiz cancelado.');
 assert.equal(await card.locator('.quiz-option.correct,.quiz-option.wrong,.quiz-option.dim').count(),0,'cancelado não marca opções');
 assert.equal(await card.locator('.quiz-mark').count(),0);
 assert.equal(await card.locator('.quiz-actions').count(),0,'ações somem no cancelado');
 await sendEnabled(page);
 // errar: ✗ Incorreta com a opção errada marcada e a correta também
 await page.locator('#prompt').fill('quiz de teste');
 await page.locator('#send').click();
 await page.waitForFunction(()=>document.querySelectorAll('.message.quiz').length===2);
 const second=page.locator('.message.quiz').nth(1);
 await second.locator('.quiz-option').nth(0).click();
 await page.waitForFunction(()=>document.querySelectorAll('.quiz-verdict').length===2&&document.querySelectorAll('.quiz-verdict')[1].textContent.includes('Incorreta'));
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
 seedCourse(runtime,'Hunt');
 const records=[];
 for(let i=1;i<=8;i++){
  records.push({type:'message',message:{role:'user',content:[{type:'text',text:`imagem ${i}`},{type:'image',data:PLOT_PNG,mimeType:'image/png'}],timestamp:1700000000000+i*1000}});
  records.push({type:'message',message:{role:'assistant',content:[{type:'text',text:`ok ${i}`}],timestamp:1700000000000+i*1000+500}});
 }
 records.push({type:'message',message:{role:'user',content:[{type:'text',text:'pergunta real\n\n[Contexto da sessão na Mesa: matéria · p. 2]\n\n[Referências abertas: Limites.pdf p. 3]'}],timestamp:17000000010000}});
 records.push({type:'message',message:{role:'assistant',content:[{type:'text',text:'resposta final'}],timestamp:17000000010500}});
 const sessionFile=seedSession(runtime,records);
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

/* ------------------------------------------------------------------ */
/* 3e. Diário: o fold tocado pelo usuário sobrevive ao fim do turno      */
/* ------------------------------------------------------------------ */
if(want('diary-touched'))await withArtifacts('hunt-diary-touched',async ctx=>{
 const runtime=ctx.runtime=newRuntime('hunt-diary-touched');
 seedCourse(runtime,'Calc');
 writeDeskJson(runtime,{courseId:'Calc'});
 const pi=writeHuntPi(runtime);
 const app=ctx.app=await launchDesk({runtime,env:{LEARNING_DESK_PI:pi,HUNT_PI_MODE:'normal',HUNT_PI_THINK_MS:'1500'}});
 const page=await app.firstWindow();const w=watch(page);
 await statusOnline(page);
 // 1º turno: usuário recolhe o diário vivo; no fim ele continua recolhido
 await page.locator('#prompt').fill('primeiro');
 await page.locator('#send').click();
 await page.waitForSelector('.work[data-live=true]',{timeout:15000});
 await page.locator('.work[data-live=true] .work-head').dispatchEvent('click');
 await page.waitForFunction(()=>document.querySelector('.work[data-live=true]')?.dataset.expanded==='false');
 await page.waitForFunction(()=>{const all=document.querySelectorAll('.work');const el=all[all.length-1];return el&&el.dataset.live==='false';},undefined,{timeout:15000});
 assert.equal(await page.locator('.work').last().getAttribute('data-expanded'),'false','recolhido pelo usuário continua recolhido');
 await sendEnabled(page,{timeout:15000});
 // 2º turno: usuário recolhe e reabre o diário vivo; no fim continua aberto
 await page.locator('#prompt').fill('segundo');
 await page.locator('#send').click();
 await page.waitForSelector('.work[data-live=true]',{timeout:15000});
 await page.locator('.work[data-live=true] .work-head').dispatchEvent('click');
 await page.waitForFunction(()=>document.querySelector('.work[data-live=true]')?.dataset.expanded==='false');
 await page.locator('.work[data-live=true] .work-head').dispatchEvent('click');
 await page.waitForFunction(()=>document.querySelector('.work[data-live=true]')?.dataset.expanded==='true');
 await page.waitForFunction(()=>{const all=document.querySelectorAll('.work');const el=all[all.length-1];return el&&el.dataset.live==='false';},undefined,{timeout:15000});
 assert.equal(await page.locator('.work').last().getAttribute('data-expanded'),'true','aberto pelo usuário continua aberto');
 assert.deepEqual(w.errors,[]);
 log('HUNT diary-touched PASSED');
});

/* Dois cards de quiz na mesma conversa: o foco restaurado no clique de uma
   opção não pode pular para o card anterior (as keys `quiz-option-N` repetem
   entre cards). O pré-rewrite atualizava o card no lugar e não perdia o foco. */
if(want('quiz-focus'))await withArtifacts('hunt-quiz-focus',async ctx=>{
 const runtime=ctx.runtime=newRuntime('hunt-quiz-focus');
 seedCourse(runtime,'Calc');
 writeDeskJson(runtime,{courseId:'Calc'});
 const app=ctx.app=await launchDesk({runtime});
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
  return {inCard:cards.findIndex(card=>card.contains(active)),key:active?.dataset?.key||'',tag:active?.tagName||'',checked:active?.getAttribute?.('aria-checked')||''};
 });
 log('[quiz-focus] foco depois do clique no 2º card:',JSON.stringify(focus));
 assert.equal(focus.inCard,1,'o foco fica no card clicado, não no primeiro com a mesma key');
 assert.equal(focus.key,'quiz-option-1');
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
 seedCourse(runtime,'A');seedCourse(runtime,'B');
 const imgs=[];
 for(let i=1;i<=5;i++){const f=path.join(runtime,`anexo-${i}.png`);fs.writeFileSync(f,png());imgs.push(f);}
 const big=path.join(runtime,'grande-demais.png');
 fs.writeFileSync(big,Buffer.alloc(16*1024*1024,7));
 const txt=path.join(runtime,'nota.txt');fs.writeFileSync(txt,'não é imagem');
 writeDeskJson(runtime,{courseId:'A'});
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'A',name:'Matéria A',path:path.join(runtime,'learning','Courses','A')},{id:'B',name:'Matéria B',path:path.join(runtime,'learning','Courses','B')}]});
 const app=ctx.app=await launchDesk({runtime,env:{LEARNING_VAULT:runtime}});
 const page=await app.firstWindow();const w=watch(page);
 await statusOnline(page);
 // tipo errado é ignorado
 await page.setInputFiles('#attach-input',txt);
 await page.waitForTimeout(250);
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
 await page.waitForTimeout(900);
 await page.locator('#course-tabs button[data-id="B"]').click();
 await page.waitForFunction(()=>{const t=document.querySelector('#course-tabs button[data-id="B"]');return t?.classList.contains('active');},{timeout:20000});
 await statusOnline(page,{timeout:30000});
 assert.equal(await page.locator('#prompt').inputValue(),'','matéria B não herda o rascunho de A');
 await page.locator('#prompt').fill('rascunho da matéria B');
 await page.waitForTimeout(900);
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
/* 5. Composer: citação (truncagem 8000), Cmd+Enter e Enter simples     */
/* ------------------------------------------------------------------ */
if(want('quote'))await withArtifacts('hunt-quote',async ctx=>{
 const runtime=ctx.runtime=newRuntime('hunt-quote');
 seedCourse(runtime,'Hunt');
 const long='palavra '.repeat(1400).trim(); // ~11k chars
 const sessionFile=seedSession(runtime,[
  {type:'message',message:{role:'user',content:[{type:'text',text:long}]}},
  {type:'message',message:{role:'assistant',content:[{type:'text',text:'ok'}]}},
 ]);
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
 await page.locator('#quote-btn').click();
 const quoted=await page.locator('#prompt').inputValue();
 const flat=quoted.split('\n').map(line=>line.replace(/^> ?/,'')).join('\n').trim();
 log('[quote] quoted length:',quoted.length,'flat length:',flat.length);
 assert.ok(quoted.startsWith('> '),'citação vira blockquote');
 assert.ok(flat.length<=8005,`citação truncada em 8000 (${flat.length})`);
 assert.ok(flat.endsWith('…'),'truncagem marca com reticências');
 assert.equal(await page.locator('#quote-btn').isHidden(),true,'botão some depois de citar');
 // Cmd+Enter envia; Enter simples não
 await page.locator('#prompt').fill('');
 await page.locator('#prompt').fill('teorema');
 await page.locator('#prompt').press('Enter');
 await page.waitForTimeout(200);
 assert.equal(await page.locator('#messages .message.user').count(),1,'Enter simples não envia');
 assert.match(await page.locator('#prompt').inputValue(),/\n/,'Enter simples quebra linha');
 await page.locator('#prompt').press('Meta+Enter');
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
 seedCourse(runtime,'Hunt');
 writeDeskJson(runtime,{courseId:'Hunt'});
 const app=ctx.app=await launchDesk({runtime});
 const page=await app.firstWindow();const w=watch(page);
 await page.waitForSelector('.pdf-panel',{timeout:30000});
 // dispara 5 toasts reais pela calculadora (expressão inválida)
 for(let i=0;i<5;i++){
  await page.evaluate(()=>{const e=document.querySelector('#expression');e.value='sqrt(';document.querySelector('#calc-form button').click();});
  await page.waitForTimeout(60);
 }
 const count=await page.locator('#toast .toast-item').count();
 log('[toasts] itens na fila:',count);
 assert.ok(count<=3,`teto de 3 toasts (viu ${count})`);
 const role=await page.locator('#toast').getAttribute('role');
 assert.equal(role,'status');
 await page.locator('#toast .toast-item').first().dispatchEvent('click');
 await page.waitForTimeout(100);
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
 seedCourse(runtime,'Hunt');
 const long=Array.from({length:150},(_,i)=>`Parágrafo ${i+1}: ${'texto '.repeat(12)}`).join('\n\n');
 const ts=1700000000000;
 const sessionFile=seedSession(runtime,[
  {type:'message',message:{role:'user',content:[{type:'text',text:'mensagem longa'}],timestamp:ts}},
  {type:'message',message:{role:'assistant',content:[{type:'thinking',thinking:'Pensando com calma.'},{type:'toolCall',id:'t1',name:'web_search',arguments:{query:'longo'}}],timestamp:ts+1000}},
  {type:'message',message:{role:'toolResult',toolCallId:'t1',toolName:'web_search',isError:false,content:[{type:'text',text:'resultado'}],details:{results:[{title:'R',url:'https://example.com/r'}]},timestamp:ts+2000}},
  {type:'message',message:{role:'assistant',content:[{type:'text',text:long}],timestamp:ts+3000}},
 ]);
 writeDeskJson(runtime,{session:sessionFile,courseId:'Hunt'});
 const app=ctx.app=await launchDesk({runtime});
 const page=await app.firstWindow();const w=watch(page);
 await statusOnline(page);
 await page.waitForSelector('#messages .work',{timeout:20000});
 await page.waitForFunction(()=>document.querySelector('#messages').scrollHeight>document.querySelector('#messages').clientHeight+300);
 const before=await page.evaluate(()=>{const m=document.querySelector('#messages');m.scrollTop=0;m.dispatchEvent(new Event('scroll'));return m.scrollTop;});
 await page.locator('#messages .work-head').dispatchEvent('click');
 await page.waitForFunction(()=>document.querySelector('#messages .work').dataset.expanded==='true');
 await page.waitForTimeout(300);
 const afterOpen=await page.evaluate(()=>document.querySelector('#messages').scrollTop);
 assert.ok(afterOpen<=before+4,`abrir o diário no topo não puxa a rolagem (${before} -> ${afterOpen})`);
 await page.locator('.work-step .step-toggle').first().dispatchEvent('click');
 await page.waitForTimeout(300);
 const afterStep=await page.evaluate(()=>document.querySelector('#messages').scrollTop);
 assert.ok(afterStep<=before+4,`abrir um passo no topo não puxa a rolagem (${before} -> ${afterStep})`);
 assert.deepEqual(w.errors,[]);
 if(EVIDENCE)await saveArtifacts(ctx);
 log('HUNT scroll PASSED');
});

log('HUNT DONE');
