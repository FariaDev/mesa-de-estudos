// node --test tests/fake-pi-student-text.test.mjs — regressão: o fake Pi responde com quiz
// só quando o ALUNO escreve "quiz", não quando o contexto da Mesa (caminhos de worktree
// como `quizzical-…`) contém a palavra.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

const FAKE_PI=path.join(path.dirname(fileURLToPath(import.meta.url)),'fake-pi.mjs');

/** Manda `message` ao fake Pi e devolve os nomes das ferramentas iniciadas. @param {string} message @returns {Promise<string[]>} */
async function toolsStartedBy(message){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fake-pi-student-'));
 const child=spawn(process.execPath,[FAKE_PI,'--session',path.join(dir,'s.jsonl')],{stdio:['pipe','pipe','inherit']});
 let out='';child.stdout.on('data',chunk=>{out+=chunk;});
 child.stdin.write(JSON.stringify({type:'prompt',id:'p1',message})+'\n');
 /* O fake processa stdin em ordem: a resposta do get_state prova que o prompt já foi tratado (mesmo sob carga). */
 child.stdin.write(JSON.stringify({type:'get_state',id:'s1'})+'\n');
 for(let waited=0;waited<10000&&!out.includes('"s1"');waited+=50)await new Promise(resolve=>setTimeout(resolve,50));
 await new Promise(resolve=>setTimeout(resolve,300));
 child.kill();fs.rmSync(dir,{recursive:true,force:true});
 return out.split('\n').filter(Boolean).map(line=>JSON.parse(line)).filter(e=>e.type==='tool_execution_start').map(e=>e.toolName);
}

test('"quiz" no texto do aluno dispara o quiz',async()=>{
 assert.deepEqual(await toolsStartedBy('me faz um quiz'),['quiz']);
});

test('"quiz" só no caminho do contexto da Mesa não dispara o quiz',async()=>{
 const message='explica limites\n\n[Contexto da Mesa]\n- referências abertas:\n  · /Users/x/.claude/worktrees/quizzical-ride-1a2b/Courses/Calc/Lista.pdf#page=1';
 assert.deepEqual(await toolsStartedBy(message),[]);
});

test('"quiz" no bloco de menções também não dispara',async()=>{
 const message='explica limites\n\n[Ferramenta pedida na Mesa: geogebra]\nUse quizzical tools';
 assert.deepEqual(await toolsStartedBy(message),[]);
});

test('no chat lateral o contexto vem antes da fala: "quiz" da fala dispara, o do contexto não',async()=>{
 const envelope=fala=>`[Contexto do chat lateral]\n· /Users/x/worktrees/quizzical-ride/a.pdf\n[Fim do contexto do chat lateral]\n\n${fala}`;
 assert.deepEqual(await toolsStartedBy(envelope('explica limites')),[]);
 assert.deepEqual(await toolsStartedBy(envelope('me faz um quiz')),['quiz']);
});
