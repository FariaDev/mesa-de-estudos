/* Fala repetida no fim do turno (#112), na janela real: resposta em dois passos
   do modelo (texto → ferramenta → texto), cada passo com o seu
   `assistantMessageID`, contra o `opencode serve` falso.

   O renderer guarda os blocos de fala por id e limpa o mapa quando um id novo
   começa. Se o `message_end` do passo anterior só chega no fim do turno, ele
   pinta a primeira fala outra vez depois da última — era o sintoma do #112.
   O leitor do OpenCode agora fecha cada passo antes de abrir o próximo. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {withArtifacts,newRuntime,seedCourse,writeDeskJson,writeConfigJson,launchDesk,sendEnabled,statusOnline} from './helpers.mjs';

const require=createRequire(import.meta.url);
const conversations=require('../src/agents/conversations.cjs');
const FAKE_OPENCODE_BIN=path.resolve(import.meta.dirname,'fake-opencode.mjs');

await withArtifacts('opencode-repeat',async ctx=>{
 const runtime=ctx.runtime=newRuntime('opencode-repeat'),folder=seedCourse(runtime,'Calculo');
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'Calculo',name:'Cálculo',path:folder}]});
 const first=conversations.createClaudeConversation({runtime,courseId:'Calculo',engine:'opencode'});
 writeDeskJson(runtime,{courseId:'Calculo',session:first,courseStates:{Calculo:{session:first,sessions:[{path:first}]}}});
 fs.chmodSync(FAKE_OPENCODE_BIN,0o755);
 const steps=[
  {text:'Primeira frase.',tool:{name:'mesa_calcular',input:{expressao:'2+2'},output:'4'}},
  {text:'Segunda frase.'},
 ];
 const app=ctx.app=await launchDesk({runtime,opencode:false,env:{LEARNING_DESK_OPENCODE:FAKE_OPENCODE_BIN,FAKE_OPENCODE_STEPS:JSON.stringify(steps)}});
 const page=await app.firstWindow();
 const errors=[];page.on('pageerror',error=>errors.push(error.message));

 await statusOnline(page,{timeout:60000});
 await page.locator('#prompt').fill('duas frases com ferramenta no meio');
 await page.locator('#send').click();
 await page.waitForFunction(()=>[...document.querySelectorAll('.message.assistant .body')].some(el=>el.textContent.includes('Segunda frase.')),undefined,{timeout:30000});
 await sendEnabled(page,{timeout:30000});

 const texts=await page.evaluate(()=>[...document.querySelectorAll('.message.assistant .body')].map(el=>el.textContent.trim()));
 assert.deepEqual(texts,['Primeira frase.','Segunda frase.'],'a primeira fala não reaparece depois da segunda');
 assert.deepEqual(errors,[]);
 await app.close();ctx.app=null;
});
console.log('ok opencode-repeat-ui');
