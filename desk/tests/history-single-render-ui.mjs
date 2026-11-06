/* Uma montagem por abertura (#115): o cache do descritor pinta o histórico e o
   `pi-connect` que devolve o MESMO conteúdo não remonta. Quando o histórico
   nativo tem uma mensagem a mais, a segunda montagem acontece — nunca se
   esconde conteúdo novo para ganhar velocidade.

   Fake do OpenCode com sessões já existentes (`FAKE_OPENCODE_SEED`): o cache do
   descritor e o histórico do servidor falso nascem do mesmo roteiro. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {withArtifacts,launchDesk,newRuntime,seedCourse,writeConfigJson,writeDeskJson,statusOnline,openSessionById} from './helpers.mjs';

const require=createRequire(import.meta.url);
const conversations=require('../src/agents/conversations.cjs');
const FAKE_OPENCODE_BIN=path.resolve(import.meta.dirname,'fake-opencode.mjs');

function displayMessages(prefix,count){
 return Array.from({length:count},(_,index)=>({
  role:index%2===0?'user':'assistant',
  content:[{type:'text',text:index%2===0?`Pergunta ${prefix}${index}`:`Resposta ${prefix}${index}`}],
  timestamp:1_700_000_000_000+index,
 }));
}

function wireMessages(messages){
 return messages.map((message,index)=>({
  id:`msg${String(index).padStart(8,'0')}`,
  type:message.role,
  time:{created:message.timestamp},
  ...(message.role==='user'?{text:message.content[0].text}:{content:message.content}),
 }));
}

function seedConversation(runtime,courseId,nativeId,messages){
 const file=conversations.createClaudeConversation({runtime,courseId,engine:'opencode'});
 conversations.updateClaudeConversation(file,{nativeSessionId:nativeId,nativeEstablished:true,messages,preview:'Conversa '+nativeId},{runtime});
 return file;
}

await withArtifacts('history-single-render',async ctx=>{
 const runtime=ctx.runtime=newRuntime('history-single-render'),course=seedCourse(runtime,'Calculo');
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'Calculo',name:'Cálculo',path:course}]});
 const same=displayMessages('A',6);
 const shorter=displayMessages('B',4);
 const longer=[...shorter,...displayMessages('B-nova',1).map((message,index)=>({...message,timestamp:1_700_000_001_000+index}))];
 const sameId=`ses_${Date.now().toString(36)}a`,changedId=`ses_${Date.now().toString(36)}b`;
 const sameFile=seedConversation(runtime,'Calculo',sameId,same);
 const changedFile=seedConversation(runtime,'Calculo',changedId,shorter);
 const seedFile=path.join(runtime,'opencode-seed.json');
 fs.writeFileSync(seedFile,JSON.stringify({sessions:{[sameId]:{messages:wireMessages(same)},[changedId]:{messages:wireMessages(longer)}}}));
 writeDeskJson(runtime,{courseId:'Calculo',session:sameFile,courseStates:{Calculo:{session:sameFile,sessions:[{path:sameFile,started:1},{path:changedFile,started:2}]}}});

 fs.chmodSync(FAKE_OPENCODE_BIN,0o755);
 const app=ctx.app=await launchDesk({runtime,pi:false,env:{LEARNING_DESK_OPENCODE:FAKE_OPENCODE_BIN,FAKE_OPENCODE_SEED:seedFile}});
 const page=await app.firstWindow();
 const errors=[];page.on('pageerror',error=>errors.push(error.message));

 await page.waitForFunction(()=>document.querySelector('#messages')?.textContent.includes('Resposta A5'),undefined,{timeout:60000});
 await statusOnline(page,{timeout:60000});
 const countRenders=()=>page.evaluate(()=>window.__historyRenders);
 await page.evaluate(()=>{
  window.__historyRenders=0;
  window.addEventListener('desk-history-rendered',()=>{window.__historyRenders+=1;});
 });

 /* Conteúdo diferente: a mensagem nova do nativo aparece e a segunda montagem conta. */
 await page.evaluate(()=>{window.__historyRenders=0;});
 await openSessionById(page,changedFile);
 await page.waitForFunction(()=>document.querySelector('#messages')?.textContent.includes('Pergunta B-nova0'),undefined,{timeout:60000});
 assert.equal(await countRenders(),2,'histórico nativo maior remonta');

 /* Conteúdo igual: só o cache do descritor monta. */
 await page.evaluate(()=>{window.__historyRenders=0;});
 await openSessionById(page,sameFile);
 await page.waitForFunction(()=>document.querySelector('#messages')?.textContent.includes('Resposta A5'),undefined,{timeout:60000});
 await statusOnline(page,{timeout:60000});
 // espera fixa: o connect termina depois do primeiro paint; sem a segunda montagem não há evento novo.
 await page.waitForTimeout(500);
 assert.equal(await countRenders(),1,'abrir a mesma conversa monta uma vez');
 assert.deepEqual(errors,[],'sem erro de página');
});
console.log('ok history-single-render-ui');
