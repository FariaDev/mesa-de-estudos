/* O 403 do grátis do Zen na janela real (bug do motor OpenCode, 2026-10-20),
   contra o `fake-opencode.mjs` com FAKE_OPENCODE_FAIL=free-tier: o servidor
   aceita a mensagem e o SSE traz `session.step.failed` +
   `session.execution.failed` com o `FreeTierError`, como o `opencode serve`
   2.0.32 faz. Antes a bolha ficava sem resposta e sem erro; agora a frase
   própria aparece NA CONVERSA (diário do turno), o envio volta e a conexão
   segue de pé (o erro não é fatal). Nenhum modelo é chamado. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {withArtifacts,newRuntime,seedCourse,writeDeskJson,writeConfigJson,launchDesk,sendEnabled,statusOnline,currentEngine} from './helpers.mjs';

const require=createRequire(import.meta.url);
const conversations=require('../src/agents/conversations.cjs');
const FAKE_OPENCODE_BIN=path.resolve(import.meta.dirname,'fake-opencode.mjs');
const FREE_TIER_LINE='O OpenCode Zen recusou o modelo grátis nesta sessão (403).';

await withArtifacts('opencode-free-tier',async ctx=>{
 const runtime=ctx.runtime=newRuntime('opencode-free-tier'),folder=seedCourse(runtime,'Calculo');
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'Calculo',name:'Cálculo',path:folder}]});
 const first=conversations.createClaudeConversation({runtime,courseId:'Calculo',engine:'opencode'});
 writeDeskJson(runtime,{courseId:'Calculo',session:first,courseStates:{Calculo:{session:first,sessions:[{path:first}]}}});
 fs.chmodSync(FAKE_OPENCODE_BIN,0o755);
 const app=ctx.app=await launchDesk({runtime,pi:false,env:{LEARNING_DESK_OPENCODE:FAKE_OPENCODE_BIN,FAKE_OPENCODE_FAIL:'free-tier'}});
 const page=await app.firstWindow();
 const errors=[];page.on('pageerror',error=>errors.push(error.message));

 await statusOnline(page,{timeout:60000});
 assert.equal(await currentEngine(page),'opencode');
 await page.locator('#prompt').fill('Diga só: oi');
 await page.locator('#send').click();

 /* A frase fica na coluna da conversa, não só no aviso que some. */
 await page.waitForFunction(line=>{
  const toast=document.querySelector('#toast');
  return [...document.querySelectorAll('body *')].some(el=>!toast?.contains(el)&&el.children.length===0&&el.textContent.includes(line));
 },FREE_TIER_LINE,{timeout:30000});
 await sendEnabled(page,{timeout:30000});
 await statusOnline(page,{timeout:15000});
 assert.deepEqual(errors,[],'sem erro de página');
});
console.log('ok opencode-free-tier-ui');
