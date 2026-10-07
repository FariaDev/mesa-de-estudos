/* Smoke de CONTRATO do chat lateral Claude pela ponte REAL (preload + main +
 * SDK fake da fixture): cria a conversa principal Claude por
 * `window.desk.newSession('claude')`, abre o chat lateral no MESMO motor com
 * sessão/descritor próprios, promove turnos com streaming e settled, confere o
 * que o fakeClaude recebeu (ref PDF#page=N, questão ativa e matéria), a
 * autorização de `readPaths` (permissão de Read no PDF fora do cwd), permissão,
 * cancelamento, rascunho e retomada após reinício — e que NENHUM processo Pi e
 * nenhum binário Claude real nascem nesse caminho.
 *
 *   node tests/sidechat-claude-ipc-smoke.mjs
 *
 * O wiring do main é exercitado de verdade (`createEngine` → fábrica do canal
 * lateral): com o main antigo (`descriptor` OBJETO em vez de `descriptor.claude`)
 * este arquivo falha no primeiro prompt do lateral, com "registro indisponível".
 * Para a regressão controlada, aponte SIDECHAT_CLAUDE_ENTRY para uma cópia
 * temporária do main com o wiring antigo; o padrão é o main real do app.
 *
 * Tudo é sintético/artificial: curso e PDF da fixture, SDK fake injetado por
 * `LEARNING_DESK_CLAUDE_SDK_FACTORY` (só com DESK_TEST=1), binário do Claude e
 * do Pi apontados para traps locais. Nada autentica nem fala com provedor real;
 * o runtime é temporário e apagado ao final. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {_electron as electron} from '@playwright/test';
import {testEnv} from './electron-env.mjs';
import {withArtifacts,newRuntime,seedCourse,tinyPdf,writeDeskJson,writeConfigJson,FAKE_PI,DESK} from './helpers.mjs';

const ENTRY=process.env.SIDECHAT_CLAUDE_ENTRY||path.join(DESK,'main.cjs');
const FIXTURE=path.join(DESK,'tests','fixtures','claude-sdk-sidechat-fake.mjs');
const FIXTURE_TEXT='Resposta de teste do Claude (fixture)';
const QUESTION='Questão sintética do chat lateral';
const USER_TEXT='confira a página três [claude:multi]';
const PERM_TEXT='[claude:permission-allow]';
const STALL_TEXT='[claude:stall]';
const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function trapScript(sentinel,real){
 return `#!/bin/sh\necho "$$ $@" >> "${sentinel}"\n`+(real?`exec "${real}" "$@"\n`:'exit 1\n');
}
function writeTrap(file,body){
 fs.writeFileSync(file,body);
 fs.chmodSync(file,0o755);
 return file;
}
const sentinelLines=file=>{
 try{return fs.readFileSync(file,'utf8').trim().split('\n').filter(Boolean);}
 catch{return [];}
};
const logEntries=file=>{
 try{return fs.readFileSync(file,'utf8').trim().split('\n').filter(Boolean).map(line=>JSON.parse(line));}
 catch{return [];}
};

await withArtifacts('sidechat-claude-ipc',async ctx=>{
 let checks=0;
 const must=(name,value,predicate=true)=>{
  const ok=predicate===true?Boolean(value):Boolean(predicate(value));
  checks+=1;
  console.log(`${ok?'ok':'FALHA'}  ${name}${ok?'':` -> ${JSON.stringify(value)}`}`);
  assert.ok(ok,`${name}`);
  return value;
 };
 const runtime=ctx.runtime=newRuntime('sidechat-claude-ipc');
 const course=seedCourse(runtime,'Synthetic');
 const pdfPath=path.join(course,'Limites.pdf');
 fs.writeFileSync(pdfPath,tinyPdf('Limites',3));
 const piSentinel=path.join(runtime,'pi-starts.log');
 const claudeSentinel=path.join(runtime,'claude-starts.log');
 const claudeLog=path.join(runtime,'claude-prompts.log');
 const store=path.join(runtime,'claude-store');
 const piTrap=writeTrap(path.join(runtime,'pi-trap.sh'),trapScript(piSentinel,FAKE_PI));
 const claudeTrap=writeTrap(path.join(runtime,'claude-trap.sh'),trapScript(claudeSentinel,''));
 writeConfigJson(runtime,{runtimePath:runtime,vaultPath:runtime,courses:[{id:'Synthetic',name:'Matemática sintética',path:course}],claudePath:claudeTrap});
 writeDeskJson(runtime,{courseId:'Synthetic'});
 const env={
  LEARNING_DESK_RUNTIME:runtime,
  LEARNING_DESK_PI:piTrap,
  LEARNING_DESK_CLAUDE:claudeTrap,
  LEARNING_DESK_CLAUDE_SDK_FACTORY:FIXTURE,
  FAKE_CLAUDE_LOG:claudeLog,
  FAKE_CLAUDE_STORE:store,
  FAKE_CLAUDE_READ_TARGET:pdfPath,
  FAKE_CLAUDE_DELAY_MS:'8'
 };
 const launch=()=>electron.launch({args:[ENTRY],cwd:DESK,env:testEnv(env)});
 const watch=page=>{
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource/.test(m.text()))console.log('CONSOLE',m.text());});
 };
 const errors=[];
 let app=ctx.app=await launch();
 let page=await app.firstWindow();
 watch(page);
 await page.waitForFunction(()=>window.desk&&typeof window.desk.newSession==='function',undefined,{timeout:20000});
 await page.waitForSelector('.pdf-panel',{timeout:30000});
 await page.waitForSelector('#status-dot.online',{timeout:30000});
 await page.evaluate(()=>{
  window.__scEvents=[];
  window.desk.onSidechatEvent(payload=>window.__scEvents.push(payload));
 });

 /* ---------- 1. conversa principal Claude pela API real (window.desk) ---------- */
 const created=await page.evaluate(()=>window.desk.newSession('claude'));
 must('newSession(claude) devolve conversa Claude (descriptor JSON)',created,
  v=>v?.engine==='claude'&&/[/\\]conversations[/\\]claude-[0-9a-f-]{36}\.json$/.test(String(v?.session||'')));
 const mainDescriptorPath=created.session;
 must('a conversa principal Claude existe em runtime/conversations',mainDescriptorPath,
  p=>typeof p==='string'&&fs.existsSync(p));
 /* A questão ativa entra no snapshot do lateral: grava ANTES de abrir. */
 await page.evaluate(title=>window.desk.save({study:{title}}),QUESTION);
 /* Daqui em diante, qualquer processo Pi novo aparece no sentinela. */
 fs.writeFileSync(piSentinel,'');

 /* ---------- 2. chat lateral nasce no MESMO motor, sessão própria ---------- */
 const opened=await page.evaluate(ref=>window.desk.sidechatOpen({refs:[ref]}),{path:pdfPath,page:3});
 must('chat lateral nasce no motor Claude com id próprio',opened,
  v=>v?.engine==='claude'&&/^sc-[0-9a-f-]{36}$/.test(String(v?.id)));
 must('abrir não inicia turno',opened,v=>v?.busy===false&&Array.isArray(v?.messages)&&v.messages.length===0);
 must('snapshot lateral preserva a ref PDF validada (página != 1)',opened.context?.refs,
  v=>Array.isArray(v)&&v.length===1&&v[0].path===pdfPath&&v[0].page===3);
 const sideDescriptorPath=path.join(runtime,'sidechats',`${opened.id}.json`);
 const sideDescriptor=JSON.parse(fs.readFileSync(sideDescriptorPath,'utf8'));
 must('descritor lateral aponta para a conversa Claude dele (não a principal)',sideDescriptor,
  v=>v.engine==='claude'&&typeof v.claude==='string'&&fs.existsSync(v.claude)&&v.claude!==mainDescriptorPath);

 /* ---------- 3. prompt lateral: streaming, eventos e resposta ---------- */
 const prompt=await page.evaluate(({id,text})=>window.desk.sidechatPrompt({id,text}),{id:opened.id,text:USER_TEXT});
 must('prompt lateral aceito pelo canal Claude',prompt,
  v=>v?.sent===true&&v.engine==='claude'&&typeof v.streaming==='boolean');
 await page.waitForFunction(id=>window.__scEvents.some(p=>p.id===id&&p.event.type==='agent_settled'),opened.id,{timeout:30000});
 const events=await page.evaluate(id=>window.__scEvents.filter(p=>p.id===id).map(p=>p.event),opened.id);
 must('turno lateral emite agent_start/message_end/agent_settled no canal próprio',events,
  list=>['agent_start','message_end','agent_settled'].every(type=>list.some(e=>e.type===type)));
 must('streaming do lateral emite text_delta',events,
  list=>list.some(e=>e.type==='message_update'&&e.assistantMessageEvent?.type==='text_delta'&&typeof e.assistantMessageEvent.delta==='string'));
 must('streaming fragmentado chega em mais de um delta',events,
  list=>list.filter(e=>e.type==='message_update'&&e.assistantMessageEvent?.type==='text_delta').length>=2);
 const read=await page.evaluate(id=>window.desk.sidechatRead({id}),opened.id);
 must('história lateral tem a resposta do fakeClaude',read,
  v=>v.messages.some(m=>m.role==='assistant'&&m.content?.some(p=>p.type==='text'&&p.text.includes(FIXTURE_TEXT))));
 must('fala do usuário entra sem o envelope de contexto',read,v=>{
  const user=v.messages.find(m=>m.role==='user');
  const text=(user?.content||[]).map(p=>p.text||'').join('');
  return text.includes('confira a página três')&&!text.includes('[Contexto do chat lateral]');
 });
 const turn=logEntries(claudeLog).find(e=>String(e.text||'').includes('confira a página três'));
 must('fakeClaude recebeu o prompt do lateral',turn,Boolean);
 must('prompt do lateral carrega a ref do snapshot como PDF#page=3',turn?.text,
  t=>String(t).includes(`${pdfPath}#page=3`));
 must('prompt do lateral carrega a questão ativa do principal',turn?.text,
  t=>String(t).includes(`- exercício ativo: ${QUESTION}`));
 must('prompt do lateral carrega a matéria ativa',turn?.text,
  t=>String(t).includes('- matéria: Matemática sintética'));

 /* ---------- 4. sessão nativa independente da principal ---------- */
 const sideClaude=JSON.parse(fs.readFileSync(sideDescriptor.claude,'utf8'));
 const mainDescriptor=JSON.parse(fs.readFileSync(mainDescriptorPath,'utf8'));
 must('nativeSessionId do lateral é próprio (≠ principal)',{side:sideClaude.nativeSessionId,main:mainDescriptor.nativeSessionId},
  v=>UUID_RE.test(v.side)&&UUID_RE.test(v.main)&&v.side!==v.main);
 must('histórico nativo do lateral foi para o store do fake (sessão própria)',
  path.join(store,`session-${sideClaude.nativeSessionId}.json`),p=>fs.existsSync(p));
 must('a conversa principal não recebeu o prompt lateral',
  path.join(store,`session-${mainDescriptor.nativeSessionId}.json`),p=>!fs.existsSync(p));

 /* ---------- 5. permissão: o Read do PDF fora do cwd só passa por readPaths ---------- */
 const permPrompt=await page.evaluate(({id,text})=>window.desk.sidechatPrompt({id,text}),{id:opened.id,text:PERM_TEXT});
 must('prompt de permissão aceito no canal lateral',permPrompt,v=>v?.sent===true);
 await page.waitForFunction(id=>window.__scEvents.some(p=>p.id===id&&p.event.type==='extension_ui_request'&&p.event.permission===true),opened.id,{timeout:30000});
 const requestId=await page.evaluate(id=>window.__scEvents.filter(p=>p.id===id&&p.event.type==='extension_ui_request').at(-1).event.id,opened.id);
 const responded=await page.evaluate(({id,requestId:rid})=>window.desk.sidechatRespond({id,response:{id:rid,confirmed:true}}),{id:opened.id,requestId});
 must('permissão de leitura do PDF roteada e concedida pelo canal lateral',responded,v=>v?.ok===true);
 await page.waitForFunction(id=>window.__scEvents.some(p=>p.id===id&&p.event.type==='message_end'&&JSON.stringify(p.event.message||{}).includes('Permissão concedida')),opened.id,{timeout:30000});

 /* ---------- 6. cancelamento do turno lateral ---------- */
 const startsBefore=await page.evaluate(id=>window.__scEvents.filter(p=>p.id===id&&p.event.type==='agent_start').length,opened.id);
 const settlesBefore=await page.evaluate(id=>window.__scEvents.filter(p=>p.id===id&&p.event.type==='agent_settled').length,opened.id);
 const stallPrompt=await page.evaluate(({id,text})=>window.desk.sidechatPrompt({id,text}),{id:opened.id,text:STALL_TEXT});
 must('turno em espera aceito para exercitar o cancelamento',stallPrompt,v=>v?.sent===true);
 await page.waitForFunction(({id,n})=>window.__scEvents.filter(p=>p.id===id&&p.event.type==='agent_start').length>n,{id:opened.id,n:startsBefore},{timeout:30000});
 const aborted=await page.evaluate(id=>window.desk.sidechatAbort({id}),opened.id);
 must('cancelamento responde pelo canal lateral',aborted,v=>v?.aborted===true);
 await page.waitForFunction(({id,n})=>window.__scEvents.filter(p=>p.id===id&&p.event.type==='agent_settled').length>n,{id:opened.id,n:settlesBefore},{timeout:30000});
 const settled=await page.evaluate(id=>window.__scEvents.filter(p=>p.id===id&&p.event.type==='agent_settled').at(-1).event,opened.id);
 must('turno cancelado fecha em agent_settled cancelled',settled,v=>v?.cancelled===true);

 /* ---------- 7. rascunho e persistência ---------- */
 const saved=await page.evaluate(id=>window.desk.sidechatSave({id,draft:'rascunho lateral claude'}),opened.id);
 must('rascunho do lateral salvo no descritor próprio',saved,v=>v?.ok===true&&v.draft==='rascunho lateral claude');
 const beforeRestart=await page.evaluate(id=>window.desk.sidechatRead({id}),opened.id);
 must('entrega do lateral fechada como settled (sem incerteza)',beforeRestart,
  v=>v.delivery?.status==='settled'&&v.uncertain===false);
 const contextAt=beforeRestart.context.at;

 /* ---------- 8. reinício: retomada do mesmo chat, snapshot congelado ---------- */
 await app.close();
 fs.writeFileSync(piSentinel,'');
 app=ctx.app=await launch();
 page=await app.firstWindow();
 watch(page);
 await page.waitForFunction(()=>window.desk&&typeof window.desk.sidechatOpen==='function',undefined,{timeout:20000});
 await page.waitForSelector('.pdf-panel',{timeout:30000});
 await page.evaluate(()=>{
  window.__scEvents=[];
  window.desk.onSidechatEvent(payload=>window.__scEvents.push(payload));
 });
 const reopened=await page.evaluate(()=>window.desk.sidechatOpen({refs:[]}));
 must('reinício: retoma o MESMO chat lateral Claude',reopened,v=>v?.id===opened.id&&v.engine==='claude');
 must('reinício: snapshot original congelado (at não recopia o principal)',reopened,v=>v.context?.at===contextAt);
 must('reinício: rascunho preservado',reopened,v=>v.draft==='rascunho lateral claude');
 must('reinício: histórico com a resposta do fakeClaude',reopened,
  v=>v.messages.some(m=>m.role==='assistant'&&m.content?.some(p=>p.type==='text'&&p.text.includes(FIXTURE_TEXT))));
 must('reinício: entrega settled, sem incerteza',reopened,v=>v.delivery?.status==='settled'&&v.uncertain===false);

 /* ---------- 9. incerteza de aceite em voo sobrevive ao reinício ---------- */
 /* `[claude:stall]` é aceito (delivery accepted no lado e no nativo) e o turno
    fica "pensando": sem agent_settled, fechar o app deixa os dois descritores em
    voo. Ao reabrir, o payload tem de expor a incerteza SEM iniciar processo, e o
    primeiro envio novo é recusado — o anterior nunca é repetido sozinho. */
 const stallRestart=await page.evaluate(({id,text})=>window.desk.sidechatPrompt({id,text}),{id:opened.id,text:STALL_TEXT});
 must('stall posterior aceito antes do desligamento',stallRestart,v=>v?.sent===true);
 const uncertainDraft='rascunho incerto preservado';
 await page.evaluate(({id,draft})=>window.desk.sidechatSave({id,draft}),{id:opened.id,draft:uncertainDraft});
 const historyBefore=await page.evaluate(id=>window.desk.sidechatRead({id}).then(v=>v.messages.length),opened.id);
 must('histórico anterior existe antes do desligamento',historyBefore,v=>v>=2);
 await app.close();
 app=ctx.app=await launch();
 page=await app.firstWindow();
 watch(page);
 await page.waitForFunction(()=>window.desk&&typeof window.desk.sidechatOpen==='function',undefined,{timeout:20000});
 await page.waitForSelector('.pdf-panel',{timeout:30000});
 await page.evaluate(()=>{
  window.__scEvents=[];
  window.desk.onSidechatEvent(payload=>window.__scEvents.push(payload));
 });
 const uncertainOpen=await page.evaluate(()=>window.desk.sidechatOpen({refs:[]}));
 must('reinício após aceite em voo: retoma o MESMO chat lateral Claude',uncertainOpen,
  v=>v?.id===opened.id&&v.engine==='claude');
 must('reinício após aceite em voo: open expõe uncertain (payload e ledger coerentes)',uncertainOpen,
  v=>v?.uncertain===true&&v.delivery?.status==='uncertain');
 must('reinício após aceite em voo: rascunho preservado',uncertainOpen,v=>v?.draft===uncertainDraft);
 must('reinício após aceite em voo: histórico preservado',uncertainOpen,
  v=>Array.isArray(v?.messages)&&v.messages.length>=historyBefore);
 const uncertainBlocked=await page.evaluate(({id,text})=>window.desk.sidechatPrompt({id,text}),{id:opened.id,text:'não pode repetir'});
 must('novo prompt recusado com uncertain sem reenviar a mensagem anterior',uncertainBlocked,
  v=>v?.sent===false&&v?.uncertain===true&&v?.retryable===false);
 const freshAfterUncertain=await page.evaluate(()=>window.desk.sidechatOpen({fresh:true}));
 must('fresh continua disponível depois da incerteza',freshAfterUncertain,
  v=>/^sc-[0-9a-f-]{36}$/.test(String(v?.id))&&v.id!==opened.id&&v.uncertain===false);
 must('o chat incerto antigo continua preservado em disco',path.join(runtime,'sidechats',`${opened.id}.json`),
  p=>fs.existsSync(p));

 /* ---------- 10. sem fallback: nenhum Pi e nenhum binário Claude real ---------- */
 must('nenhum processo Pi nasce entre criar Claude e retomar o lateral',sentinelLines(piSentinel),v=>v.length===0);
 must('o SDK fake não executa o binário real do Claude',sentinelLines(claudeSentinel),v=>v.length===0);
 must('sem erros de página no renderer',errors,v=>v.length===0);

 console.log(`SIDECHAT CLAUDE IPC PASSED (${checks} checks): conversa principal Claude por window.desk.newSession; lateral no mesmo motor com sessão nativa própria; streaming e settled; ref PDF#page=3, questão e matéria no prompt do fakeClaude; permissão de leitura do PDF por readPaths; cancelamento; rascunho e retomada após reinício; aceite em voo vira incerto no reinício com novo prompt recusado, fresh disponível e histórico/rascunho preservados; zero processo Pi e zero binário Claude real.`);
});
