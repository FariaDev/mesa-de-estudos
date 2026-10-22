// Paridade do Claude com o Pi (#58) na janela, com SDK, conta e matéria artificiais.
/* Cobre o que o aluno vê com o Claude Code: o medidor de contexto (janela
   nativa do `result`), o rascunho de revisão pela ponte descartável, o catálogo de comandos no menu `/`, um comando de skill
   pelo ciclo do prompt, o steer com ⌘/Ctrl+⏎ (item `priority: 'now'` na mesma
   fila, aceito pelo eco), a compactação manual que apaga o medidor e a recusa
   expressa da compactação. Nenhum processo Pi nasce. Roteiros da fixture:
   `[claude:steer-wait]` e `[claude:compact-fail]` em `fixtures/claude-sdk-fake.mjs`. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {withArtifacts,newRuntime,seedCourse,writeDeskJson,writeConfigJson,launchDesk,sendEnabled,statusOnline,toastWait,DESK} from './helpers.mjs';
const conversations=createRequire(import.meta.url)('../src/agents/conversations.cjs');

const FIXTURE_TEXT='Resposta de teste do Claude (fixture)';
const meterHidden=page=>page.locator('#ctx-meter').evaluate(el=>el.hidden);
const lastAnswer=page=>page.locator('#messages .message.assistant .body').last().textContent();

await withArtifacts('claude-parity',async ctx=>{
 const runtime=ctx.runtime=newRuntime('claude-parity'),folder=seedCourse(runtime,'Paridade');
 const file=conversations.createClaudeConversation({runtime,courseId:'Paridade'});
 const starts=path.join(runtime,'pi-starts'),trap=path.join(runtime,'pi-trap.sh'),log=path.join(runtime,'claude-prompts.log');
 fs.writeFileSync(trap,`#!/bin/sh\nprintf started >> '${starts}'\nexit 1\n`,{mode:0o755});
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'Paridade',name:'Paridade',path:folder}]});
 writeDeskJson(runtime,{courseId:'Paridade',session:file,courseStates:{Paridade:{session:file,sessions:[{path:file}]}}});
 const rows=()=>fs.existsSync(log)?fs.readFileSync(log,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse):[];
 const app=ctx.app=await launchDesk({runtime,pi:false,env:{LEARNING_DESK_PI:trap,FAKE_CLAUDE_LOG:log,LEARNING_DESK_CLAUDE_SDK_FACTORY:path.join(DESK,'tests','fixtures','claude-sdk-fake.mjs')}});
 const page=await app.firstWindow();
 await statusOnline(page,{timeout:60000});
 const send=async text=>{await page.locator('#prompt').fill(text);await page.locator('#send').click();};

 /* ---- medidor: escondido sem amostra; depois do turno, a janela nativa ---- */
 assert.equal(await meterHidden(page),true,'sem turno, sem medidor');
 await send('primeira pergunta');
 await sendEnabled(page,{timeout:30000});
 await page.waitForFunction(()=>document.querySelector('#ctx-meter')?.hidden===false,undefined,{timeout:20000});
 assert.match(await page.locator('#ctx-meter').getAttribute('title'),/200/,'o balão cita a janela de 200 mil tokens do result');

 /* ---- rascunho de revisão: ponte descartável, sem ferramentas nem sessão gravada ---- */
 const promptsBefore=rows().length;
 await page.locator('#messages .message.assistant').first().getByRole('button',{name:'Guardar para revisar'}).click();
 await page.waitForFunction(()=>document.querySelector('#review-difficulty')?.value==='Dificuldade do rascunho (fixture).',undefined,{timeout:30000});
 assert.equal(await page.locator('#review-question').inputValue(),'Pergunta do rascunho (fixture).');
 assert.equal(rows().length,promptsBefore+1,'o rascunho manda um prompt só');
 assert.match(rows().at(-1).text,/primeira pergunta/,'o rascunho leva a pergunta como dado');
 await page.keyboard.press('Escape');
 await page.waitForFunction(()=>!document.querySelector('#review-dialog')?.open);

 /* ---- comandos: o catálogo do SDK entra no menu `/` ---- */
 await page.locator('#prompt').fill('/rev');
 await page.waitForFunction(()=>[...document.querySelectorAll('#slash-list [role="option"]')].some(row=>/revisar/.test(row.textContent||'')),undefined,{timeout:15000});
 await page.keyboard.press('Escape');
 await send('/revisar a prova 2');
 await sendEnabled(page,{timeout:30000});
 assert.equal(rows().at(-1).text,'/revisar a prova 2','o comando vai como texto `/nome args` pelo ciclo do prompt');
 assert.match(await lastAnswer(page),/Você disse: \/revisar a prova 2/);

 /* ---- steer: ⌘/Ctrl+⏎ com o turno aberto entra na mesma consulta ---- */
 await send('[claude:steer-wait] explique a questão');
 await page.waitForSelector('#stop:not([hidden])');
 await page.locator('#prompt').fill('use a fórmula 2');
 await page.locator('#prompt').press('ControlOrMeta+Enter');
 await page.waitForFunction(text=>(document.querySelector('#messages')?.textContent||'').includes(text),'Steer recebido: use a fórmula 2',{timeout:30000});
 await sendEnabled(page,{timeout:30000});
 const steer=rows().find(row=>row.marker==='steer');
 assert.ok(steer,'o steer chegou à fixture');
 assert.equal(steer.text,'use a fórmula 2');
 assert.equal(steer.priority,'now','o item do steer pede prioridade imediata ao CLI');
 assert.equal(rows().filter(row=>row.marker==='steer-wait').length,1,'o turno principal foi enviado uma vez só');
 assert.match(await lastAnswer(page),new RegExp(FIXTURE_TEXT.replace(/[()]/g,'\\$&')),'o turno fecha com o result nativo');
 assert.equal(await page.locator('#messages .message.assistant').filter({hasText:'Steer recebido'}).count(),1,'uma resposta para o turno com steer');

 /* ---- compactação manual: o resultado expresso; o medidor antigo sai ---- */
 await page.waitForFunction(()=>document.querySelector('#ctx-meter')?.hidden===false,undefined,{timeout:20000});
 await send('/compact mantenha as fórmulas');
 await toastWait(page,'Contexto compactado',{timeout:30000});
 assert.equal(rows().at(-1).text,'/compact mantenha as fórmulas','as instruções vão no comando nativo');
 await page.waitForFunction(()=>document.querySelector('#ctx-meter')?.hidden===true,undefined,{timeout:20000});
 await send('/compact [claude:compact-fail]');
 await toastWait(page,'Nada para compactar (fixture).',{timeout:30000});
 await sendEnabled(page,{timeout:30000});

 assert.equal(fs.existsSync(starts),false,'o Claude não inicia o Pi');
 console.log('CLAUDE PARITY UI PASSED: medidor nativo; rascunho de revisão pela ponte descartável; menu / com o catálogo do SDK; comando pelo prompt; steer priority now aceito pelo eco; /compact apaga o medidor; recusa expressa da compactação; zero Pi.');
});
