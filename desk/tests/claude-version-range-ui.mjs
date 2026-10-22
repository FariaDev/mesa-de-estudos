// Faixa de versões do Claude Code na janela (#51), no lugar do teste da reserva
// do SDK (#32, `claude-sdk-binary-ui.mjs`): a Mesa usa sempre o Claude Code do
// usuário. Dentro da faixa conecta (principal e chat lateral retomam os IDs
// nativos exatos pelo binário do usuário); mais nova que a testada conecta e
// deixa a linha no desk.log; fora da faixa recusa antes do login, com a frase e
// o conserto na coluna do tutor. Os binários são scripts que só respondem a
// --version e `auth status --json`; o SDK é o fixture sintético. Nada real roda.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {withArtifacts,newRuntime,seedCourse,writeDeskJson,writeConfigJson,launchDesk,statusOnline,sendEnabled,DESK} from './helpers.mjs';
import {pollUntil} from './waits.mjs';
const require=createRequire(import.meta.url);
const conversations=require('../src/agents/conversations.cjs');
const {AUTH_CONFLICT_ENV,CLAUDE_RANGE}=require('../src/agents/claude-environment.cjs');
// The host environment may carry API/endpoint variables; empty values are
// ignored by the conflict check, so the scenarios stay hermetic.
const NO_CONFLICT=Object.fromEntries(AUTH_CONFLICT_ENV.map(name=>[name,'']));

function fakeClaude(file,version,probes){
 const body=['#!/bin/sh',
  `echo "$0 $*" >> ${JSON.stringify(probes)}`,
  'case "$1" in',
  `  --version) echo "${version} (Claude Code)";;`,
  '  auth) echo \'{"loggedIn":true,"authMethod":"oauth","apiProvider":"firstParty","email":"pessoa@example.com"}\';;',
  '  *) exit 1;;',
  'esac',''].join('\n');
 fs.writeFileSync(file,body);fs.chmodSync(file,0o755);
 return fs.realpathSync(file);
}

async function scenario(name,version,check){
 await withArtifacts(`claude-version-range-${name}`,async ctx=>{
  const runtime=ctx.runtime=newRuntime(`claude-version-range-${name}`),folder=seedCourse(runtime,'Synthetic');
  const probes=path.join(runtime,'probes.log'),trace=path.join(runtime,'executables.log');
  fs.writeFileSync(probes,'');
  const bin=path.join(runtime,'bin');fs.mkdirSync(bin);
  const user=fakeClaude(path.join(bin,'claude'),version,probes);
  /* O último executável observado é de outra versão: o launcher atual vence. */
  const old=path.join(runtime,'claude-old-2.1.246');fs.writeFileSync(old,'#!/bin/sh\nexit 1\n');fs.chmodSync(old,0o755);
  const file=conversations.createClaudeConversation({runtime,courseId:'Synthetic'});
  conversations.updateClaudeConversation(file,{pinnedExecutable:old,nativeEstablished:true},{runtime});
  const id=conversations.readClaudeConversation(file,{runtime}).nativeSessionId;
  writeConfigJson(runtime,{vaultPath:runtime,claudePath:user,courses:[{id:'Synthetic',name:'Synthetic',path:folder}]});
  writeDeskJson(runtime,{courseId:'Synthetic',session:file,courseStates:{Synthetic:{session:file,sessions:[{path:file}]}}});
  ctx.app=await launchDesk({runtime,pi:false,env:{
   ...NO_CONFLICT,
   LEARNING_DESK_CLAUDE:user,
   LEARNING_DESK_CLAUDE_DETECT:'1',
   LEARNING_DESK_CLAUDE_SDK_FACTORY:path.join(DESK,'tests/fixtures/claude-sdk-executable-spy.mjs'),
   FAKE_CLAUDE_EXECUTABLE_TRACE:trace,
  }});
  const page=await ctx.app.firstWindow(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const calls=()=>fs.readFileSync(probes,'utf8').trim().split('\n').filter(Boolean);
  const rows=()=>fs.existsSync(trace)?fs.readFileSync(trace,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse):[];
  const log=()=>fs.existsSync(path.join(runtime,'desk.log'))?fs.readFileSync(path.join(runtime,'desk.log'),'utf8'):'';
  await check({page,runtime,file,id,user,calls,rows,log,errors});
 });
}

async function refusedColumn(page){
 await page.waitForSelector('#tutor-state[data-state="error"][data-fix]',{timeout:30000});
 return page.evaluate(()=>({fix:document.querySelector('#tutor-state').dataset.fix,text:document.querySelector('#tutor-state .ts-fine')?.textContent||'',buttons:[...document.querySelectorAll('#tutor-state button')].map(b=>b.id)}));
}

// 1. O 2.1.296 do defeito: dentro da faixa, principal e lateral usam o binário do usuário.
await scenario('in-range','2.1.296',async ({page,runtime,file,id,user,calls,rows,log,errors})=>{
 await statusOnline(page,{timeout:30000});
 assert.deepEqual(rows()[0],{executable:user,resume:id,newSession:null},'principal retoma o ID exato pelo Claude Code do usuário');
 await page.locator('#prompt').fill('continuar o estudo');await page.locator('#send').click();await sendEnabled(page);
 assert.equal(conversations.readClaudeConversation(file,{runtime}).pinnedExecutable,user,'pinnedExecutable é só o último binário observado');
 await page.locator('#sidechat-toggle').click();await page.waitForSelector('#sidechat-prompt:not([disabled])');
 const opened=await page.evaluate(()=>window.desk.sidechatOpen({}));
 const side=JSON.parse(fs.readFileSync(path.join(runtime,'sidechats',opened.id+'.json'),'utf8')).claude;
 conversations.updateClaudeConversation(side,{nativeEstablished:true},{runtime});
 const sideId=conversations.readClaudeConversation(side,{runtime}).nativeSessionId;
 await page.locator('#sidechat-prompt').fill('continuar no lateral');await page.locator('#sidechat-send').click();
 await page.waitForFunction(()=>document.querySelector('#sidechat-messages')?.textContent.includes('Resposta de teste'));
 assert.deepEqual(rows().at(-1),{executable:user,resume:sideId,newSession:null},'lateral retoma o próprio ID pelo Claude Code do usuário');
 assert.ok(calls().every(line=>line.startsWith(user+' ')),'nenhum outro binário do Claude é consultado (sem reserva)');
 assert.equal(calls().some(line=>line===`${user} auth status --json`),true,'o login é lido no binário que será usado');
 assert.doesNotMatch(log(),/mais nova que a testada|binário do SDK/,'na faixa testada, nenhuma linha de aviso');
 assert.equal(log().includes('pessoa@example.com'),false,'nenhum dado de conta chega ao log');
 assert.deepEqual(errors,[]);
});

// 2. Mais nova que a testada, na série: conecta e o log diz a versão.
await scenario('ahead','2.1.400',async ({page,user,rows,log,errors})=>{
 await statusOnline(page,{timeout:30000});
 assert.equal(rows()[0].executable,user);
 await pollUntil(log,text=>text.includes(`2.1.400 é mais nova que a testada com esta Mesa (${CLAUDE_RANGE.tested})`),{timeout:15000,what:'a linha de "mais nova que a testada" no desk.log'});
 assert.equal(await page.locator('#tutor-state[data-state="error"]').count(),0,'mais nova nunca bloqueia');
 assert.deepEqual(errors,[]);
});

// 3. Abaixo do mínimo: recusa antes do login; Atualizar Claude Code abre a confirmação do #45.
await scenario('below','2.1.250',async ({page,user,calls,rows,errors})=>{
 const column=await refusedColumn(page);
 assert.equal(column.fix,'update');
 assert.equal(column.text,`Atualize o Claude Code: a versão 2.1.250 é anterior à faixa que a Mesa aceita (${CLAUDE_RANGE.minimum} a 2.1.x).`);
 assert.deepEqual(column.buttons,['state-claude-update','connect','state-log']);
 assert.equal(await page.locator('#status-dot.online').count(),0,'não conecta');
 assert.deepEqual(rows(),[],'nenhuma Query foi aberta');
 assert.equal(calls().some(line=>/ auth /.test(line)),false,'versão fora da faixa nunca chega ao login');
 await page.locator('#state-claude-update').click();
 await page.waitForSelector('#about-dialog[open] #component-rows [data-id="claude"] .component-run[data-phase="confirm"]',{timeout:15000});
 const confirm=await page.locator('#component-rows [data-id="claude"] .component-run').textContent();
 assert.match(confirm,/Vai rodar: claude update/,'a confirmação mostra o comando exato; nada roda sem o clique');
 assert.equal(calls().some(line=>line===`${user} update`),false,'o Claude Code não foi atualizado');
 assert.deepEqual(errors,[]);
});

// 4. Série nova: recusa e manda procurar a Mesa nova no Sobre.
await scenario('series','2.2.0',async ({page,calls,rows,errors})=>{
 const column=await refusedColumn(page);
 assert.equal(column.fix,'about');
 assert.match(column.text,/^O Claude Code 2\.2\.0 é de uma série que a Mesa ainda não aceita/);
 assert.deepEqual(column.buttons,['state-claude-about','connect','state-log']);
 assert.deepEqual(rows(),[]);
 assert.equal(calls().some(line=>/ auth /.test(line)),false);
 await page.locator('#state-claude-about').click();
 await page.waitForSelector('#about-dialog[open]',{timeout:15000});
 assert.deepEqual(errors,[]);
});
console.log('claude-version-range-ui: PASS — user Claude Code only: in range and newer-than-tested connect (main + sidechat, exact native IDs), below minimum and new series refuse before auth with the fix in the tutor column; fake binaries and synthetic SDK only.');
