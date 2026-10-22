/* Quadro do tutor no motor OpenCode (#70), na janela real, contra o
   `fake-opencode.mjs`: o fake chama `criar_atividade` no MCP `mesa` que a Mesa
   registrou, como o OpenCode 2.0.32 faz. No teste manual da v1.0.0 o quadro
   não aparecia: o MCP ia sem `codemode: false`, o modelo só alcançava a
   ferramenta pela `execute`, e o chat nunca via `mesa_criar_atividade`.
   Prova: o slot nasce com o id da chamada do SSE e o cartão fica pronto. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {withArtifacts,newRuntime,seedCourse,writeDeskJson,writeConfigJson,launchDesk,statusOnline,reviewShot,screenshotDirectory} from './helpers.mjs';

const require=createRequire(import.meta.url);
const conversations=require('../src/agents/conversations.cjs');
const FAKE_OPENCODE_BIN=path.resolve(import.meta.dirname,'fake-opencode.mjs');
const out=screenshotDirectory('opencode-activity');
const ACTIVITY={
 title:'Reta secante',objective:'Prever o sinal da inclinação',alternativeMarkdown:'Escolha o sinal de m antes de mover h.',
 html:'<p id="m">m = 0,31</p>',css:'',js:'',
};

await withArtifacts('opencode-activity',async ctx=>{
 const runtime=ctx.runtime=newRuntime('opencode-activity'),folder=seedCourse(runtime,'Calculo');
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'Calculo',name:'Cálculo',path:folder}]});
 const first=conversations.createClaudeConversation({runtime,courseId:'Calculo',engine:'opencode'});
 writeDeskJson(runtime,{courseId:'Calculo',session:first,courseStates:{Calculo:{session:first,sessions:[{path:first}]}}});
 fs.chmodSync(FAKE_OPENCODE_BIN,0o755);
 ctx.app=await launchDesk({runtime,pi:false,env:{LEARNING_DESK_OPENCODE:FAKE_OPENCODE_BIN,FAKE_OPENCODE_MCP_CALL:JSON.stringify({name:'criar_atividade',input:ACTIVITY})}});
 const page=await ctx.app.firstWindow();
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await statusOnline(page,{timeout:60000});
 await page.locator('#prompt').fill('faça uma atividade interativa');
 await page.locator('#send').click();

 const slot=page.locator('.activity-slot[data-activity-call^="call_"]');
 await slot.locator('.activity-card[data-state="ready"]').waitFor({timeout:30000});
 const call=await slot.getAttribute('data-activity-call');
 const listed=(await page.evaluate(()=>window.desk.activityList())).items;
 assert.equal(listed.length,1,'uma atividade publicada');
 assert.equal(listed[0].toolCallId,call,'publicada com o id da chamada vista no SSE, não um id próprio');
 assert.equal(listed[0].title,'Reta secante');
 assert.equal(await page.locator('.work-step[data-kind="tool"] .step-label').filter({hasText:/execute/}).count(),0,'a chamada não passa pela execute do Code Mode');
 await reviewShot(page,out,'opencode-quadro.png');
 assert.deepEqual(errors,[],'sem erro de página');
});
console.log('ok opencode-activity-ui');
