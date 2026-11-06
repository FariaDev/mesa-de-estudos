import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createScrubber,cleanLogLines,looksLikeSession} from '../triage-scrub.mjs';
import {freeZenIds,pickTriageModel} from '../triage-free-model.mjs';
import {agentPrompt,freePrompt,shellQuote,shellWord,opencodeCommand,opencodeLauncher,issueUrl,isIssueUrl} from '../triage-outputs.mjs';
import {doctorText} from '../doctor-checks.mjs';

/* Peças do "Relatar um problema" (#62). O vazamento de ponta a ponta é do
   `triage-leak.test.mjs`; aqui ficam as regras de cada peça. */

const scrub=createScrubber({
 home:'/Users/ana',
 paths:[{text:'/Users/ana/Cofre/Cálculo II',label:'<matéria 1>'},{text:'/Users/ana/Cofre',label:'<vault>'}],
 names:[{text:'Cálculo II',label:'<matéria 1>'},{text:'Lista 3 - Integrais.pdf',label:'<pdf>'}],
});

test('o limpador troca o caminho mais longo primeiro e a casa vira ~',()=>{
 assert.equal(scrub('erro em /Users/ana/Cofre/Cálculo II/x.md'),'erro em <matéria 1>/x.md');
 assert.equal(scrub('vault /Users/ana/Cofre e config /Users/ana/.config'),'vault <vault> e config ~/.config');
 assert.equal(scrub('C:\\Users\\ana\\Cofre\\Cálculo II'),'C:<matéria 1>','a letra do disco não é pessoal');
});

test('o limpador tira nome de matéria, PDF, captura e sessão mesmo fora de caminho',()=>{
 assert.equal(scrub('a matéria cálculo ii travou'),'a matéria <matéria 1> travou');
 assert.equal(scrub('abriu Lista 3 - Integrais.pdf'),'abriu <pdf>');
 assert.equal(scrub('abriu (Prova Final.pdf)'),'abriu (<pdf>)');
 assert.equal(scrub('foto: caderno.png; 2026-10-21.jsonl'),'foto: <arquivo>; <sessão>');
 assert.equal(scrub('falhou Prova Final.pdf'),'<pdf>','nome com espaço leva a palavra de antes: perde contexto, não vaza');
});

test('o limpador apaga o segmento inteiro depois da barra, com pontuação dentro (C-01)',()=>{
  const local=createScrubber({home:'/Users/ana',paths:[],names:[]});
  assert.equal(local('não abriu /Users/ana/Downloads/Lista, Cálculo.pdf: ENOENT'),'não abriu ~/Downloads<pdf>: ENOENT');
  assert.equal(local('não abriu /Users/ana/Downloads/Cálculo (1).pdf: ENOENT'),'não abriu ~/Downloads<pdf>: ENOENT');
  assert.equal(local('falhou /home/ana/docs/a;b.xopp: ENOENT'),'falhou ~/docs<arquivo>: ENOENT');
  assert.equal(local('falhou C:\\Users\\ana\\Docs\\Lista, Cálculo.pdf: ENOENT'),'falhou C:~\\Docs<pdf>: ENOENT');
  assert.equal(local('não li /r/learning/sessions/2026-10-21_abc.jsonl'),'não li /r/learning/sessions<sessão>');
});

test('a linha hostil não explode o limpador (sem retrocesso catastrófico)',()=>{
  const local=createScrubber({home:'/Users/ana',paths:[],names:[]});
  const hostile='/x/'+'a,'.repeat(20000)+'.pdf: ENOENT';
  const start=Date.now();
  const out=local(hostile);
  assert.ok(Date.now()-start<1000,`limpou ${hostile.length} caracteres em menos de 1 s`);
  assert.match(out,/^\/x<pdf>: ENOENT$/);
  const hostileParens='/x/'+'('.repeat(20000)+'.pdf';
  const start2=Date.now();
  local(hostileParens);
  assert.ok(Date.now()-start2<1000,'parênteses repetidos também não explodem');
});

test('o limpador troca a casa de outra pessoa e esconde chaves',()=>{
 assert.equal(scrub('/Users/bia/x e /home/carlos/y'),'~/x e ~/y');
 assert.equal(scrub('sk-ant-api03-abcdefghijklmnop12'),'[oculto]');
 assert.equal(scrub('ghp_abcdefghijklmnopqrstuvwxyz12'),'[oculto]');
 assert.equal(scrub('{"type":"api","key":"oc-123"}'),'{"type":"api",[oculto]}');
});

test('linha de log com cara de sessão sai sem o texto; info não entra',()=>{
 assert.equal(looksLikeSession('{"role":"user","content":"x"}'),true);
 assert.equal(looksLikeSession('pdf não abriu'),false);
 const log=[
  JSON.stringify({ts:'t1',level:'info',area:'a',msg:'ok'}),
  JSON.stringify({ts:'t2',level:'error',area:'b',msg:'quebrou em /Users/ana/x\n  at f\n  at g\n  at h'}),
  JSON.stringify({ts:'t3',level:'warn',area:'c',msg:'{"role":"user","content":"segredo"}'}),
  'texto antigo',
 ].join('\n');
 assert.deepEqual(cleanLogLines(log,{scrub}),[
  't2 error [b] quebrou em ~/x |   at f |   at g',
  '(linha omitida: parecia conteúdo de sessão)',
  'texto antigo',
 ]);
 assert.equal(cleanLogLines(log,{scrub,limit:1}).length,1);
});

test('a lista viva vira só os grátis do Zen',()=>{
 assert.deepEqual(freeZenIds('opencode/gpt-5.5\nopencode/big-pickle\nopenrouter/x:free\nopencode/minimax-m3-free\n'),['big-pickle','minimax-m3-free']);
 assert.deepEqual(freeZenIds(''),[]);
});

/* Um id com aspa ou `;` passaria no `isFree` do núcleo (termina em `-free`) e
   quebraria o comando que a pessoa cola no terminal: a lista descarta tudo
   fora do formato de id de modelo. */
test('a lista viva descarta id fora do formato de modelo (injeção no comando)',()=>{
 const hostis=[
  "opencode/evil';touch /tmp/pwned;echo'-free",
  'opencode/evil";touch /tmp/pwned;echo"-free',
  'opencode/evil`id`-free',
  'opencode/evil$(id)-free',
  'opencode/evil touch-free',
  'opencode/evil|tee-free',
  'opencode/evil&wait-free',
 ].join('\n');
 assert.deepEqual(freeZenIds(hostis),[],'nada com aspa, crase, $, espaço, | ou & passa');
 assert.deepEqual(
  freeZenIds('opencode/deepseek-v4.1-flash-free\nopencode/minimax-m3-free\nopencode/big-pickle\n'),
  ['deepseek-v4.1-flash-free','minimax-m3-free','big-pickle'],
  'os ids reais (com ponto e hífen) continuam passando',
 );
});

test('a escolha prefere DeepSeek Flash, depois MiniMax, sem nome fixo',()=>{
 assert.equal(pickTriageModel(['big-pickle','minimax-m3-free','deepseek-v5-flash-free'])?.model,'opencode/deepseek-v5-flash-free');
 assert.equal(pickTriageModel(['big-pickle','minimax-m3-free'])?.model,'opencode/minimax-m3-free');
 assert.equal(pickTriageModel(['big-pickle','glm-5.3-flash-free'])?.id,'glm-5.3-flash-free','fora das famílias, o que não guarda vem antes');
 assert.equal(pickTriageModel([]),null);
 assert.equal(pickTriageModel(['deepseek-v4.1-flash-free'])?.policyKey,'freeModels.policy.zero');
 assert.equal(pickTriageModel(['minimax-m3-free'])?.policyKey,'freeModels.policy.unknown');
});

test('as aspas do comando sobrevivem ao shell',{skip:process.platform==='win32'},()=>{
 const text="it's \"$HOME\" `x` \\ fim";
 const echoed=spawnSync('sh',['-c',`printf %s ${shellQuote(text,'darwin')}`],{encoding:'utf8'}).stdout;
 assert.equal(echoed,text);
 assert.equal(shellQuote("it's",'win32'),"'it''s'");
});

test('o comando do OpenCode some sem OpenCode ou sem grátis',()=>{
 assert.deepEqual(opencodeCommand({opencode:false,freeModel:null},'r','darwin'),{command:null,reason:'triage.opencode.missing'});
 assert.deepEqual(opencodeCommand({opencode:true,freeModel:null},'r','darwin'),{command:null,reason:'triage.opencode.noFree'});
 const out=opencodeCommand({opencode:true,freeModel:{model:'opencode/x-free',policyKey:'k'}},'relatório','darwin');
 assert.ok(out.command?.startsWith("opencode run --model opencode/x-free '"));
 assert.ok(out.command?.includes('relatório'));
});

/* O modelo vai cru no comando comum (legível) e citado quando precisa: um id
   com aspa/`;` colado cru executaria na máquina de quem colou. */
test('o modelo do comando é citado quando precisa, e segue legível no comum',()=>{
 assert.equal(shellWord('opencode/x-free','darwin'),'opencode/x-free','o comum segue sem aspas');
 assert.equal(shellWord("opencode/evil';touch x;echo'-free",'darwin'),"'opencode/evil'\\'';touch x;echo'\\''-free'",'hostil vai entre aspas íntegro');
 const out=opencodeCommand({opencode:true,freeModel:{model:"opencode/evil';touch x;echo'-free",policyKey:'k'}},'r','darwin');
 assert.ok(out.command?.includes("'opencode/evil'"),'o comando cola o modelo citado');
 assert.ok(!out.command?.includes('--model opencode/evil'),'nunca cola o modelo cru depois de --model');
});

test('os prompts levam o relatório e mandam rascunhar sem criar',()=>{
 assert.match(agentPrompt('RELATORIO','abc123'),/commit abc123[\s\S]*Não crie a issue[\s\S]*RELATORIO$/);
 assert.match(agentPrompt('RELATORIO','abc123'),/gh issue list --repo FariaDev\/mesa-de-estudos /);
 assert.match(freePrompt('RELATORIO'),/Não crie a issue e não altere nenhum arquivo[\s\S]*RELATORIO$/);
 assert.match(freePrompt('RELATORIO'),/gh issue list --repo FariaDev\/mesa-de-estudos /);
 assert.doesNotMatch(freePrompt('RELATORIO'),/FariaDev\/mesa-e-conversa/);
});

test('o endereço da issue cabe no limite e só ele é aceito pelo host',()=>{
 const short=issueUrl('## Ambiente');
 assert.equal(short.truncated,false);
 assert.match(short.url,/^https:\/\/github\.com\/FariaDev\/mesa-de-estudos\/issues\/new\?/);
 assert.equal(new URL(short.url).searchParams.get('body')?.endsWith('## Ambiente'),true);
 const long=issueUrl('linha longa\n'.repeat(2000));
 assert.equal(long.truncated,true);
 assert.ok(long.url.length<=7500);
 assert.match(new URL(long.url).searchParams.get('body')||'',/relatório cortado/);
 assert.equal(isIssueUrl(short.url),true);
 assert.equal(isIssueUrl('https://evil.example/?x'),false);
 assert.equal(isIssueUrl('https://github.com/FariaDev/mesa-e-conversa/issues/new?title=a&body=b'),false,'o repositório privado não é aceito');
 assert.equal(isIssueUrl('https://github.com/FariaDev/mesa-de-estudos/issues/new'),false);
});

test('o texto do doctor é o de sempre',()=>{
 assert.equal(doctorText([{name:'A',ok:true,detail:'x'}]),'✓ A: x\n\nSetup learning pronto.');
 assert.equal(doctorText([{name:'B',ok:false,detail:'y'}]),'✗ B: y\n\n1 verificação(ões) precisa(m) de atenção.');
});

test('o comando acha o OpenCode instalado pela Mesa fora do PATH, sem caminho pessoal',()=>{
 assert.equal(opencodeLauncher('/Users/a/.opencode/bin/opencode','/Users/a','darwin'),'~/.opencode/bin/opencode');
 assert.equal(opencodeLauncher('C:\\Users\\a\\.opencode\\bin\\opencode.exe','C:\\Users\\a','win32'),'& "$HOME\\.opencode\\bin\\opencode.exe"');
 assert.equal(opencodeLauncher('/opt/homebrew/bin/opencode','/Users/a','darwin'),'opencode','no PATH fica o nome');
 assert.equal(opencodeLauncher('','/Users/a','darwin'),'opencode');
 const out=opencodeCommand({opencode:true,opencodeLauncher:'~/.opencode/bin/opencode',freeModel:{model:'opencode/x-free',policyKey:'k'}},'r','darwin');
 assert.ok(out.command?.startsWith('~/.opencode/bin/opencode run --model '));
});

test('o comando não deixa serviço do OpenCode para trás quando o flag existe',()=>{
 const free={model:'opencode/x-free',policyKey:'k'};
 assert.ok(opencodeCommand({opencode:true,opencodeStandalone:true,freeModel:free},'r','darwin').command?.startsWith('opencode run --standalone --model '));
 assert.ok(opencodeCommand({opencode:true,opencodeStandalone:false,freeModel:free},'r','darwin').command?.startsWith('opencode run --model '));
});
