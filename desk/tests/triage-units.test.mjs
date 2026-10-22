import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createScrubber,cleanLogLines,looksLikeSession} from '../triage-scrub.mjs';
import {freeZenIds,pickTriageModel} from '../triage-free-model.mjs';
import {agentPrompt,freePrompt,shellQuote,opencodeCommand,piCommand,issueUrl,isIssueUrl} from '../triage-outputs.mjs';
import {piModelChoices} from '../triage-pi-model.mjs';
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
 assert.equal(scrub('vault /Users/ana/Cofre e config /Users/ana/.pi'),'vault <vault> e config ~/.pi');
 assert.equal(scrub('C:\\Users\\ana\\Cofre\\Cálculo II'),'C:<matéria 1>','a letra do disco não é pessoal');
});

test('o limpador tira nome de matéria, PDF, captura e sessão mesmo fora de caminho',()=>{
 assert.equal(scrub('a matéria cálculo ii travou'),'a matéria <matéria 1> travou');
 assert.equal(scrub('abriu Lista 3 - Integrais.pdf'),'abriu <pdf>');
 assert.equal(scrub('abriu (Prova Final.pdf)'),'abriu (<pdf>)');
 assert.equal(scrub('foto: caderno.png; 2026-10-21.jsonl'),'foto: <arquivo>; <sessão>');
 assert.equal(scrub('falhou Prova Final.pdf'),'<pdf>','nome com espaço leva a palavra de antes: perde contexto, não vaza');
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

test('os prompts levam o relatório e mandam rascunhar sem criar',()=>{
 assert.match(agentPrompt('RELATORIO','abc123'),/commit abc123[\s\S]*Não crie a issue[\s\S]*RELATORIO$/);
 assert.match(freePrompt('RELATORIO'),/Não crie a issue e não altere nenhum arquivo[\s\S]*RELATORIO$/);
});

test('o endereço da issue cabe no limite e só ele é aceito pelo host',()=>{
 const short=issueUrl('## Ambiente');
 assert.equal(short.truncated,false);
 assert.equal(new URL(short.url).searchParams.get('body')?.endsWith('## Ambiente'),true);
 const long=issueUrl('linha longa\n'.repeat(2000));
 assert.equal(long.truncated,true);
 assert.ok(long.url.length<=7500);
 assert.match(new URL(long.url).searchParams.get('body')||'',/relatório cortado/);
 assert.equal(isIssueUrl(short.url),true);
 assert.equal(isIssueUrl('https://evil.example/?x'),false);
 assert.equal(isIssueUrl('https://github.com/FariaDev/mesa-e-conversa/issues/new'),false);
});

test('o texto do doctor é o de sempre',()=>{
 assert.equal(doctorText([{name:'A',ok:true,detail:'x'}]),'✓ A: x\n\nSetup learning pronto.');
 assert.equal(doctorText([{name:'B',ok:false,detail:'y'}]),'✗ B: y\n\n1 verificação(ões) precisa(m) de atenção.');
});

test('os modelos do Pi: o em uso, os recentes e os favoritos, sem os grátis do Zen',()=>{
 const state={modelRecents:{pi:[['xai','grok-4'],['openai','gpt-5.5']],claude:[['anthropic','x']]},modelFavorites:{pi:[['opencode','big-pickle'],['xai','grok-4']]}};
 assert.deepEqual(piModelChoices({current:{engine:'pi',model:'anthropic/claude-sonnet-5-5'},state}),['anthropic/claude-sonnet-5-5','xai/grok-4','openai/gpt-5.5']);
 assert.deepEqual(piModelChoices({current:{engine:'claude',model:'anthropic/x'},state}),['xai/grok-4','openai/gpt-5.5']);
 assert.deepEqual(piModelChoices({current:{engine:'pi',model:'opencode/deepseek-v4.1-flash-free'},state:{}}),[],'grátis do Zen pelo Pi volta 403 (#57)');
 assert.deepEqual(piModelChoices({}),[]);
});

test('o comando do Pi usa o modelo da lista, ou o padrão do Pi, e some sem Pi',()=>{
 const facts={pi:true,piModels:['xai/grok-4','openai/gpt-5.5']};
 assert.deepEqual(piCommand(facts,"it's",'darwin'),{command:"pi --model xai/grok-4 'it'\\''s'",model:'xai/grok-4'});
 assert.equal(piCommand(facts,'p','darwin','openai/gpt-5.5').command,"pi --model openai/gpt-5.5 'p'");
 assert.equal(piCommand(facts,'p','darwin','; rm -rf ~').model,'xai/grok-4','modelo fora da lista não entra no comando');
 assert.deepEqual(piCommand({pi:true,piModels:[]},'p','darwin'),{command:"pi 'p'",model:''});
 assert.deepEqual(piCommand({pi:false,piModels:['xai/grok-4']},'p','darwin'),{command:null,reason:'triage.pi.missing'});
});
