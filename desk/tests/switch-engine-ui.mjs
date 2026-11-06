/* #87: troca de motor no meio da conversa leva o contexto. Dois motores
   visíveis só em teste (LEARNING_DESK_VISIBLE_ENGINES), com os fakes nomeados:
   `fake-opencode.mjs` e a fixture do SDK do Claude. Nenhum motor real. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {withArtifacts,newRuntime,seedCourse,writeConfigJson,writeDeskJson,launchDesk,statusOnline,currentSession,currentEngine,sendEnabled,sessionIds,sessionRows,DESK} from './helpers.mjs';

const require=createRequire(import.meta.url);
const conversations=require('../src/agents/conversations.cjs');
const FAKE_OPENCODE_BIN=path.resolve(import.meta.dirname,'fake-opencode.mjs');
const CLAUDE_FIXTURE=path.join(DESK,'tests','fixtures','claude-sdk-fake.mjs');
const NO_PI_PATH=[path.dirname(process.execPath),'/usr/bin','/bin'].join(path.delimiter);

function claudeTrap(runtime){
 const file=path.join(runtime,'claude-fake.sh');
 fs.writeFileSync(file,['#!/bin/sh',
  'case "$1" in',
  '  --version) echo "2.1.296 (Claude Code)";;',
  '  auth) echo \'{"loggedIn":true,"authMethod":"oauth","apiProvider":"firstParty"}\';;',
  '  *) exit 1;;',
  'esac',''].join('\n'));
 fs.chmodSync(file,0o755);
 return file;
}

await withArtifacts('switch-engine',async ctx=>{
 const runtime=ctx.runtime=newRuntime('switch-engine');
 const folder=seedCourse(runtime,'Calculo');
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'Calculo',name:'Cálculo',path:folder}]});
 const first=conversations.createClaudeConversation({runtime,courseId:'Calculo',engine:'opencode'});
 writeDeskJson(runtime,{courseId:'Calculo',session:first,courseStates:{Calculo:{session:first,sessions:[{path:first}]}}});
 fs.chmodSync(FAKE_OPENCODE_BIN,0o755);
 const app=ctx.app=await launchDesk({runtime,pi:false,env:{
  HOME:runtime,USERPROFILE:runtime,PATH:NO_PI_PATH,LEARNING_DESK_CLAUDE_HOME:'',
  LEARNING_DESK_OPENCODE:FAKE_OPENCODE_BIN,
  LEARNING_DESK_CLAUDE:claudeTrap(runtime),
  LEARNING_DESK_CLAUDE_SDK_FACTORY:CLAUDE_FIXTURE,
  LEARNING_DESK_VISIBLE_ENGINES:'claude,opencode',
 }});
 const page=await app.firstWindow();
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 const submit=async text=>{await page.locator('#prompt').fill(text);await page.locator('#send').click();};
 const body=text=>page.waitForFunction(t=>[...document.querySelectorAll('.message.assistant .body')].some(el=>el.textContent.includes(t)),text,{timeout:30000});
 const menu=async()=>{
  await page.locator('#new-session').click({button:'right'});
  await page.waitForSelector('#new-session-pop:not([hidden])',{timeout:5000});
  return page.locator('#new-session-pop button').evaluateAll(buttons=>buttons.map(button=>({id:button.id,text:button.textContent.trim()})));
 };
 await statusOnline(page,{timeout:60000});
 assert.equal(await currentEngine(page),'opencode','o primeiro uso escolhe o motor pronto sem perguntar');

 await submit('Pergunta que precisa atravessar a troca');
 await body('Resposta do OpenCode falso');
 await sendEnabled(page);
 const opencodeSession=await currentSession(page);
 const opencodeBytes=fs.readFileSync(opencodeSession,'utf8');

  const firstMenu=await menu();
  assert.deepEqual(firstMenu.map(item=>item.id),['new-session-opencode','new-session-claude'],'o menu lista os motores prontos');
  assert.match(firstMenu[0].text,/OpenCode \(atual\)/);
  assert.match(firstMenu[1].text,/Claude/);
  /* desk-engine-facts repinta o menu Nova sessão sem fechar nem mover o foco (#87). */
  await page.locator('#new-session').focus();
  const focusedBefore=await page.evaluate(()=>document.activeElement?.id);
  await page.evaluate(async()=>{
   const {S}=await import('./src/state.mjs');
   S.visibleEngines=['opencode'];
   window.dispatchEvent(new Event('desk-engine-facts'));
  });
  await page.waitForFunction(()=>[...document.querySelectorAll('#new-session-pop button')].length===0,undefined,{timeout:5000});
  assert.equal(await page.locator('#new-session-pop').isHidden(),false,'o menu continua aberto no repintar');
  assert.equal(await page.evaluate(()=>document.activeElement?.id),focusedBefore,'o foco fica onde estava');
  await page.evaluate(async()=>{
   const {S}=await import('./src/state.mjs');
   S.visibleEngines=['claude','opencode'];
   window.dispatchEvent(new Event('desk-engine-facts'));
  });
  await page.waitForFunction(()=>[...document.querySelectorAll('#new-session-pop button')].length===2,undefined,{timeout:5000});
  assert.deepEqual(await page.locator('#new-session-pop button').evaluateAll(buttons=>buttons.map(button=>button.id)),['new-session-opencode','new-session-claude'],'o menu volta com os dois motores');
 await page.locator('#new-session-claude').click();
 await page.waitForFunction(id=>document.querySelector('#session-title')?.dataset.session!==id,opencodeSession,{timeout:30000});
 await page.waitForFunction(()=>document.querySelector('#session-title')?.dataset.engine==='claude',undefined,{timeout:30000});
 await statusOnline(page,{timeout:60000});
 await submit('Pergunta feita no Claude');
 await body('Resposta de teste do Claude (fixture)');
 await sendEnabled(page);
 const claudeSession=await currentSession(page);
 assert.match(path.basename(claudeSession),/^claude-[0-9a-f-]{36}\.json$/,'o destino da troca é Claude');
 assert.equal(fs.readFileSync(opencodeSession,'utf8'),opencodeBytes,'o descritor de origem não é reescrito');
 const claudeRecord=conversations.readClaudeConversation(claudeSession,{runtime});
 assert.match(claudeRecord.importedTranscript,/aluno: Pergunta que precisa atravessar a troca/);
 assert.match(claudeRecord.importedTranscript,/tutor: Resposta do OpenCode falso/);
 assert.deepEqual(claudeRecord.origin,{session:opencodeSession,engine:'opencode'});
 assert.equal(claudeRecord.handoff.kind,'digest');
 assert.ok((await sessionIds(page)).includes(opencodeSession),'a conversa antiga continua na lista');
 const rows=await sessionRows(page);
 const lineage=rows.find(row=>row.id===claudeSession);
 assert.match(lineage.meta,/continua de OpenCode/,'a lista mostra a linhagem');

 /* Volta: Claude → OpenCode, com o contexto do Claude. */
 const backMenu=await menu();
 assert.deepEqual(backMenu.map(item=>item.id),['new-session-claude','new-session-opencode'],'o motor atual vem primeiro');
 assert.match(backMenu[0].text,/Claude.*\(atual\)/);
 await page.locator('#new-session-opencode').click();
 await page.waitForFunction(id=>document.querySelector('#session-title')?.dataset.session!==id,claudeSession,{timeout:30000});
 await page.waitForFunction(()=>document.querySelector('#session-title')?.dataset.engine==='opencode',undefined,{timeout:30000});
 await statusOnline(page,{timeout:60000});
 const backSession=await currentSession(page);
 assert.match(path.basename(backSession),/^opencode-[0-9a-f-]{36}\.json$/,'o destino de volta é OpenCode');
 const backRecord=conversations.readClaudeConversation(backSession,{runtime});
 assert.match(backRecord.importedTranscript,/tutor: Resposta de teste do Claude \(fixture\)/);
 assert.deepEqual(backRecord.origin,{session:claudeSession,engine:'claude'});
 assert.ok((await sessionIds(page)).includes(claudeSession),'a conversa Claude continua na lista');
 assert.deepEqual(errors,[],`erros de página: ${JSON.stringify(errors)}`);
});
console.log('switch-engine-ui: ok');
