/* Motor OpenCode na janela real (#57), contra o `fake-opencode.mjs` no lugar
   do `opencode serve` (LEARNING_DESK_OPENCODE): nenhum modelo é chamado.

   Prova, de ponta a ponta: o item "Sessão nova com OpenCode" cria a conversa
   no motor certo; o tutor liga pelo servidor que a Mesa é dona (127.0.0.1,
   senha só no ambiente, registro no ledger do runtime); a sessão nasce com a
   pasta da conversa e as permissões de estudo; o MCP `mesa` vai sem chave; as
   instruções da Mesa vão só no primeiro prompt; a resposta aparece, o medidor
   de contexto tem número, o `/` lista os comandos do servidor, a compactação
   manual fecha; ao sair, o servidor é encerrado e o ledger esvazia. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {withArtifacts,newRuntime,seedCourse,writeDeskJson,writeConfigJson,launchDesk,sendEnabled,statusOnline,currentEngine,newSession,openTutorMore} from './helpers.mjs';
import {pollUntil} from './waits.mjs';

const require=createRequire(import.meta.url);
const conversations=require('../src/agents/conversations.cjs');
const {LEDGER_FILE,processExists}=require('../src/agents/opencode-orphans.cjs');
const FAKE_OPENCODE_BIN=path.resolve(import.meta.dirname,'fake-opencode.mjs');
const step=n=>{if(process.env.MESA_TEST_STEPS)console.error(`[opencode-ui] passo ${n}`);};
const readLog=file=>fs.existsSync(file)?fs.readFileSync(file,'utf8').split('\n').filter(Boolean).map(line=>JSON.parse(line)):[];

await withArtifacts('opencode-motor',async ctx=>{
 const runtime=ctx.runtime=newRuntime('opencode-motor'),folder=seedCourse(runtime,'Calculo');
 const serveLog=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'mesa-oc-serve-')),'serve.jsonl');
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'Calculo',name:'Cálculo',path:folder}]});
 const first=conversations.createClaudeConversation({runtime,courseId:'Calculo',engine:'opencode'});
 writeDeskJson(runtime,{courseId:'Calculo',session:first,courseStates:{Calculo:{session:first,sessions:[{path:first}]}}});
 fs.chmodSync(FAKE_OPENCODE_BIN,0o755);
 const app=ctx.app=await launchDesk({runtime,pi:false,env:{LEARNING_DESK_OPENCODE:FAKE_OPENCODE_BIN,FAKE_OPENCODE_LOG:serveLog}});
 const page=await app.firstWindow();
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 const submit=async text=>{await page.locator('#prompt').fill(text);await page.locator('#send').click();};
 const body=text=>page.waitForFunction(t=>[...document.querySelectorAll('.message.assistant .body')].some(el=>el.textContent.includes(t)),text,{timeout:30000});

 step(1);
 /* 1. A conversa salva abre no motor OpenCode e o tutor liga pelo servidor da Mesa. */
 await statusOnline(page,{timeout:60000});
 assert.equal(await currentEngine(page),'opencode');
 /* #58: o nível padrão da faixa diz o OpenCode, não o Claude. */
 await page.waitForFunction(()=>document.querySelector('#effort-strip [data-level="default"]')?.textContent==='Padrão do OpenCode',undefined,{timeout:15000});
 const ledger=JSON.parse(fs.readFileSync(path.join(runtime,LEDGER_FILE),'utf8'));
 assert.ok(Number.isInteger(ledger.pid)&&processExists(ledger.pid),'o servidor vivo está no ledger');
 assert.ok(!JSON.stringify(ledger).toLowerCase().includes('password'),'o ledger não guarda senha');
 const start=readLog(serveLog).find(entry=>entry.start);
 assert.deepEqual(start.argv.slice(0,3),['serve','--hostname','127.0.0.1']);
 assert.equal(start.serverPasswordInherited,false,'a senha herdada do shell não passa');

 step(2);
 /* 2. Primeiro envio: sessão com a pasta da conversa e as permissões de estudo; MCP sem chave; instruções só no primeiro prompt. */
 await submit('Oi, tutor');await body('Resposta do OpenCode falso');await sendEnabled(page);
 await submit('Segunda pergunta');await body('Segunda pergunta');await sendEnabled(page);
 const record=conversations.readClaudeConversation(first,{runtime});
 assert.equal(record.nativeEstablished,true);
 const requests=readLog(serveLog).filter(entry=>!entry.start);
 assert.ok(requests.every(entry=>entry.authorized),'todo pedido leva a senha certa');
 const created=requests.find(entry=>entry.method==='POST'&&entry.url==='/api/session');
 /* O servidor cunha o `ses_` (403 do grátis com id da Mesa) e o descritor o guarda. */
 assert.equal(created.body.id,undefined,'a Mesa não manda id próprio');
 assert.match(record.nativeSessionId,/^ses_/);
 assert.ok(requests.some(entry=>entry.url===`/api/session/${record.nativeSessionId}/prompt`),'o prompt vai à sessão que o servidor cunhou');
 assert.ok(created.body.location.directory.endsWith(path.join('opencode-workspaces',record.id)),`a pasta da própria conversa: ${created.body.location.directory}`);
 assert.deepEqual(created.body.permissions.map(rule=>[rule.action,rule.effect]),[['edit','deny'],['shell','deny'],['subagent','deny'],['browser','deny']]);
 const mcp=requests.find(entry=>entry.method==='PUT'&&entry.url.startsWith('/api/experimental/mcp/mesa'));
 assert.equal(mcp.body.config.type,'local');
 assert.equal(mcp.body.config.environment.ELECTRON_RUN_AS_NODE,'1');
 assert.ok(!Object.keys(mcp.body.config.environment).some(name=>/KEY|PASSWORD/.test(name)),'o MCP não recebe chave nem senha');
 const prompts=requests.filter(entry=>entry.method==='POST'&&/\/prompt$/.test(entry.url)).map(entry=>String(entry.body.text||''));
 assert.equal(prompts.length,2);
 assert.match(prompts[0],/tutor da Mesa de Estudos/,'as instruções da Mesa vão no primeiro prompt');
 assert.doesNotMatch(prompts[1],/tutor da Mesa de Estudos/,'e só no primeiro');
 assert.equal(await page.locator('.message.user').filter({hasText:'tutor da Mesa de Estudos'}).count(),0,'as instruções não aparecem na conversa');

 step(3);
 /* 3. Medidor de contexto com número, comandos do servidor no "/" e compactação manual. */
 await pollUntil(()=>page.locator('#ctx-meter').evaluate(el=>!el.hidden&&/\d/.test(el.textContent+el.title)),ok=>ok,{what:'o medidor com número',timeout:15000});
 await page.locator('#prompt').fill('/');
 await page.waitForFunction(()=>document.body.textContent.includes('/review'),undefined,{timeout:15000});
 await page.locator('#prompt').fill('');
 await openTutorMore(page);
 await page.locator('#more-compact-now').click();
 await pollUntil(()=>readLog(serveLog).some(entry=>entry.method==='POST'&&/\/compact$/.test(String(entry.url))),ok=>ok,{what:'o pedido de compactação',timeout:15000});
 await sendEnabled(page,{timeout:30000});

 step(4);
 /* 4. Sessão nova com OpenCode pelo menu: outra conversa, outro `ses_`, mesmo servidor. */
 await newSession(page,{opencode:true});
 await pollUntil(()=>page.locator('#session-title').getAttribute('data-session'),value=>value&&value!==first,{what:'a sessão nova'});
 assert.equal(await currentEngine(page),'opencode');
 await statusOnline(page,{timeout:60000});
 /* O fake responde com o fim do prompt, e o bloco de contexto da sessão nova vem depois do texto: espera a resposta, não o eco. */
 await submit('Começando de novo');await body('Resposta do OpenCode falso');await sendEnabled(page);
 assert.equal(readLog(serveLog).filter(entry=>entry.start).length,1,'o mesmo servidor serve as duas conversas');
 const sessions=readLog(serveLog).map(entry=>/^\/api\/session\/([^/]+)\/prompt$/.exec(String(entry.url||''))?.[1]).filter(Boolean);
 assert.equal(new Set(sessions).size,2,'cada conversa tem o seu ses_');
 assert.deepEqual(errors,[],'sem erro de página');

 step(5);
 /* 5. Ao sair, a Mesa encerra o servidor e esvazia o ledger. */
 await app.close();ctx.app=null;
 await pollUntil(()=>processExists(ledger.pid),alive=>alive===false,{what:'o servidor encerrado',timeout:15000});
 assert.equal(fs.existsSync(path.join(runtime,LEDGER_FILE)),false,'o ledger esvazia');
});
console.log('ok opencode-ui');
