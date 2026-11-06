import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {createFakeTriageProfile} from './fake-triage-profile.mjs';

const {findOpenCodeLauncher}=createRequire(import.meta.url)('../src/agents/opencode-process.cjs');

/* Teste de vazamento do "Relatar um problema" (#62): roda o `npm run triage`
   de verdade num perfil falso recheado de caminhos, chaves, `auth.json`,
   JSONL, nomes de matéria e de PDF, e falha se qualquer um aparecer na saída —
   inclusive dentro do endereço da issue, já decodificado. Também prova que o
   OpenCode falso só ouviu `--version` e `models` (nunca `run`). */

const SCRIPT=path.resolve(import.meta.dirname,'..','scripts','triage.mjs');
const skip=process.platform==='win32'?'o perfil falso usa scripts sh':false;

/** @param {Record<string, string>} env @returns {string} */
function runTriage(env){
 const result=spawnSync(process.execPath,[SCRIPT],{env,encoding:'utf8',timeout:60000});
 assert.equal(result.status,0,`npm run triage saiu com ${result.status}: ${result.stderr}`);
 return result.stdout;
}

/** A saída como a pessoa veria em qualquer lugar: o texto e o endereço da issue decodificado. */
function everyForm(stdout){
 const url=stdout.match(/https:\/\/github\.com\/\S+/)?.[0]||'';
 const query=new URL(url).searchParams;
 return [stdout,query.get('title')||'',query.get('body')||''].join('\n').toLowerCase();
}

/** @param {string} out @param {string[]} secrets */
function assertNoLeak(out,secrets){
 const leaks=secrets.filter(secret=>out.includes(secret.toLowerCase()));
 assert.deepEqual(leaks,[],`vazou do perfil falso: ${JSON.stringify(leaks)}`);
}

test('o relatório não vaza caminho, chave, auth.json, JSONL, matéria nem PDF',{skip},()=>{
 const profile=createFakeTriageProfile();
 try{
  const stdout=runTriage(profile.env);
  assertNoLeak(everyForm(stdout),profile.secrets);
  assert.match(stdout,/## Ambiente/);
  assert.match(stdout,/## Doctor/);
  assert.match(stdout,/<matéria 1>/,'a matéria aparece só como rótulo');
  assert.match(stdout,/\[oculto\]/,'as chaves do log viram [oculto]');
  assert.match(stdout,/linha omitida: parecia conteúdo de sessão/);
  assert.match(stdout,/https:\/\/github\.com\/FariaDev\/mesa-de-estudos\/issues\/new\?/);
  assert.doesNotMatch(stdout,/FariaDev\/mesa-e-conversa/);
 }finally{profile.cleanup();}
});

test('OpenCode só é consultado (versão e lista), nunca chamado para inferência',{skip},()=>{
 const profile=createFakeTriageProfile();
 try{
  const stdout=runTriage(profile.env);
  assert.match(stdout,/opencode run --standalone --model opencode\/deepseek-v4\.1-flash-free '/,'DeepSeek Flash vem antes de MiniMax e do big-pickle');
  assert.match(stdout,/Política de dados deste modelo: não guarda nem treina\./);
  assert.equal(fs.existsSync(profile.forbiddenLog),false,`chamada proibida: ${fs.existsSync(profile.forbiddenLog)?fs.readFileSync(profile.forbiddenLog,'utf8'):''}`);
 }finally{profile.cleanup();}
});

test('sem OpenCode instalado, a saída do OpenCode some com explicação',{skip},t=>{
 const profile=createFakeTriageProfile({opencode:false});
 try{
  /* O triage também procura em /opt/homebrew/bin, /usr/local/bin e no shell
     de login, fora do HOME falso: num Mac com OpenCode ali o perfil não
     consegue escondê-lo (rodada 5 do Mac, 2026-11-06). Aí não há o que provar. */
  const real=findOpenCodeLauncher({home:profile.env.HOME,env:profile.env});
  if(real){t.skip('este computador tem OpenCode fora do HOME, que o perfil falso não esconde');return;}
  const stdout=runTriage(profile.env);
  assert.doesNotMatch(stdout,/opencode run/);
  assert.match(stdout,/OpenCode ausente neste computador/);
  assertNoLeak(everyForm(stdout),profile.secrets);
 }finally{profile.cleanup();}
});

test('sem modelo grátis na lista viva, a saída do OpenCode some com explicação',{skip},()=>{
 const profile=createFakeTriageProfile({freeIds:[]});
 try{
  const stdout=runTriage(profile.env);
  assert.doesNotMatch(stdout,/opencode run/);
  assert.match(stdout,/O OpenCode não tem modelo grátis agora/);
 }finally{profile.cleanup();}
});
