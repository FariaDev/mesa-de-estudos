/* Cartões como passo do diário (#92, achado P1): os argumentos da ferramenta
   levam a resposta certa e a explicação. Reabrir a conversa (Pi JSONL, Claude
   e OpenCode) ou receber o `toolcall_end` ao vivo não pode pintar isso no DOM
   antes de o aluno responder. Fake do Pi; nenhum motor real. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {launchDesk,newRuntime,seedCourse,seedSession,statusOnline,withArtifacts,writeConfigJson,writeDeskJson} from './helpers.mjs';

const require=createRequire(import.meta.url);
const conversations=require('../src/agents/conversations.cjs');

const SECRET='SEGREDO-QUE-NAO-PODE-APARECER';
const EXPLANATION='EXPLICACAO-QUE-NAO-PODE-APARECER';
const args={question:'Quanto é 2+2?',options:[{label:'3'},{label:'4'}],correctAnswer:SECRET,explanation:EXPLANATION};

function seed(runtime){
 const course=seedCourse(runtime,'Calculus I');
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'Calculus I',name:'Cálculo I',path:course}]});
 return course;
}

function message(name){
 return {role:'assistant',content:[{type:'text',text:'Deixei o cartão.'},{type:'toolCall',id:'card-1',name,arguments:args}],timestamp:2_000};
}
const result={role:'toolResult',toolCallId:'card-1',content:[{type:'text',text:'Mostrado ao aluno.'}],timestamp:3_000};

async function assertHidden(page,label){
 await page.waitForFunction(()=>document.querySelector('#messages')?.textContent.includes('Deixei o cartão'),undefined,{timeout:30000});
 const text=await page.locator('#messages').textContent();
 const html=await page.locator('#messages').innerHTML();
 for(const value of [SECRET,EXPLANATION]){
  assert.ok(!text.includes(value),`${label}: o texto do diário não contém ${value}`);
  assert.ok(!html.includes(value),`${label}: o HTML do diário não contém ${value}`);
 }
}

await withArtifacts('p1-histórico-pi',async ctx=>{
 const runtime=ctx.runtime=newRuntime('p1-pi');
 seed(runtime);
 const session=seedSession(runtime,[
  {type:'message',message:{role:'user',content:[{type:'text',text:'me dá um quiz'}]}},
  {type:'message',message:message('mesa_quiz')},
  {type:'message',message:{role:'toolResult',toolCallId:'card-1',content:[{type:'text',text:'Mostrado ao aluno.'}],timestamp:3_000}},
 ]);
 writeDeskJson(runtime,{session,courseId:'Calculus I'});
 const app=ctx.app=await launchDesk({runtime});
 const page=await app.firstWindow();
 await assertHidden(page,'Pi JSONL');
});

await withArtifacts('p1-histórico-claude',async ctx=>{
 const runtime=ctx.runtime=newRuntime('p1-claude');
 seed(runtime);
 const session=conversations.createClaudeConversation({runtime,courseId:'Calculus I',engine:'claude'});
 conversations.updateClaudeConversation(session,{messages:[message('mcp__mesa__quiz'),result]},{runtime});
 writeDeskJson(runtime,{session,courseId:'Calculus I'});
 const app=ctx.app=await launchDesk({runtime});
 const page=await app.firstWindow();
 await assertHidden(page,'Claude');
});

await withArtifacts('p1-histórico-opencode',async ctx=>{
 const runtime=ctx.runtime=newRuntime('p1-opencode');
 seed(runtime);
 const session=conversations.createClaudeConversation({runtime,courseId:'Calculus I',engine:'opencode'});
 conversations.updateClaudeConversation(session,{messages:[message('mesa_quiz'),result]},{runtime});
 writeDeskJson(runtime,{session,courseId:'Calculus I'});
 const app=ctx.app=await launchDesk({runtime});
 const page=await app.firstWindow();
 await assertHidden(page,'OpenCode');
});

await withArtifacts('p1-vivo-pi',async ctx=>{
 const runtime=ctx.runtime=newRuntime('p1-vivo');
 seed(runtime);
 const session=seedSession(runtime,[{type:'message',message:{role:'assistant',content:[{type:'text',text:'Vamos revisar.'}]}}]);
 writeDeskJson(runtime,{session,courseId:'Calculus I'});
 const app=ctx.app=await launchDesk({runtime,env:{FAKE_PI_QUIZ_TOOLCALL:'1'}});
 const page=await app.firstWindow();
 await statusOnline(page);
 await page.locator('#prompt').fill('quiz ao vivo');
 await page.locator('#send').click();
 await page.waitForSelector('.message.quiz .quiz-option',{timeout:30000});
 await page.waitForFunction(()=>document.querySelector('#messages')?.textContent.includes('Deixei o cartão'),undefined,{timeout:30000});
 const text=await page.locator('#messages').textContent();
 const html=await page.locator('#messages').innerHTML();
 for(const value of ['correctAnswer','Pela definição']){
  assert.ok(!text.includes(value),`ao vivo: o texto do diário não contém ${value}`);
  assert.ok(!html.includes(value),`ao vivo: o HTML do diário não contém ${value}`);
 }
});

/* Sessões gravadas antes da #92 usavam as ferramentas nativas `quiz`,
   `ask_user` e `AskUserQuestion`. Elas continuam abrindo (sem card montado e
   sem erro na janela) — o histórico antigo não vira passo nem bolha quebrada. */
await withArtifacts('p1-histórico-legado',async ctx=>{
 const runtime=ctx.runtime=newRuntime('p1-legado');
 seed(runtime);
 const legacy=(id,name)=>({type:'message',message:{role:'assistant',content:[
  {type:'text',text:'Deixei o cartão.'},
  {type:'toolCall',id,name,arguments:args},
 ],timestamp:2_000}});
 const resultOf=id=>({type:'message',message:{role:'toolResult',toolCallId:id,content:[{type:'text',text:'Mostrado ao aluno.'}],timestamp:3_000}});
 const session=seedSession(runtime,[
  {type:'message',message:{role:'user',content:[{type:'text',text:'conversa antiga'}]}},
  legacy('card-1','quiz'),resultOf('card-1'),
  legacy('card-2','ask_user'),resultOf('card-2'),
  legacy('card-3','AskUserQuestion'),resultOf('card-3'),
 ]);
 writeDeskJson(runtime,{session,courseId:'Calculus I'});
 const app=ctx.app=await launchDesk({runtime});
 const page=await app.firstWindow();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await assertHidden(page,'legado');
 assert.deepEqual(errors,[]);
 assert.equal(await page.locator('.quiz-card').count(),0,'cartão antigo não é remontado');
});
