import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/* Perfil falso para o "Relatar um problema" (#62): uma casa inteira de mentira,
   recheada do que NÃO pode sair do computador — caminhos pessoais, nomes de
   matéria e de PDF, chaves no `desk.log`, os `auth.json` do Pi e do OpenCode,
   sessões JSONL, captura e um trecho de sessão colado no log. `secrets` lista
   cada texto que o teste de vazamento procura na saída.

   Traz também um `opencode` e um `pi` falsos que só respondem a `--version` e
   `models`; qualquer outro subcomando (como `opencode run`) grava em
   `forbiddenLog` e sai com erro, para o teste provar que a triagem nunca chama
   inferência. Só macOS/Linux (scripts `sh`). */

const COURSE_A='Cálculo Sigiloso IV';
const COURSE_B='Física Confidencial';
const COURSE_C='Química Reservada';
const PDF_A='Prova Vazada do Professor Zé.pdf';
const PDF_B='Gabarito_Secreto_2026.pdf';
const KEY_LOG='sk-ant-api03-VAZOUNOLOGabcdefghijklmnop';
const KEY_BEARER='tokenBearerVazado1234567890';
const KEY_GITHUB='ghp_VazamentoDoGithub1234567890abcdef';
const KEY_PI_AUTH='sk-pi-auth-CHAVEDOPI0987654321zyx';
const KEY_OPENCODE_AUTH='oc-zen-CHAVEDOOPENCODE1122334455';
const SESSION_TEXT='minha dúvida particular sobre a questão 7';
const SESSION_TITLE='Sessão sobre o divórcio dos meus pais';
const CAPTURE='captura-do-caderno-da-ana.png';

/** @param {string} file @param {string} text */
function put(file,text){
 fs.mkdirSync(path.dirname(file),{recursive:true});
 fs.writeFileSync(file,text);
}

/** @param {string} file @param {string} body */
function executable(file,body){
 put(file,`#!/bin/sh\n${body}\n`);
 fs.chmodSync(file,0o755);
}

/* As linhas vão cruas, sem o `logEntryLine` (que já mascara chave): o log de
   uma versão antiga, ou de quem escapou da máscara, também tem de sair limpo. */
const logLine=entry=>JSON.stringify(entry);

/** @param {{home: string, runtime: string, vault: string}} where */
function deskLog({home,runtime,vault}){
 const pdf=path.join(vault,COURSE_A,'Sources',PDF_A);
 return [
  logLine({ts:'2026-10-21T10:00:00Z',level:'error',area:'pdf',msg:`não abriu ${pdf}: ENOENT`}),
  logLine({ts:'2026-10-21T10:01:00Z',level:'error',area:'pi',msg:`falhou com ${KEY_LOG} e Authorization: Bearer ${KEY_BEARER}`}),
  logLine({ts:'2026-10-21T10:02:00Z',level:'warn',area:'study',msg:`matéria ${COURSE_B} e ${COURSE_C} sem fonte; token ${KEY_GITHUB}`}),
  logLine({ts:'2026-10-21T10:03:00Z',level:'error',area:'session',msg:`linha ruim: {"type":"message","role":"user","content":"${SESSION_TEXT}"}`}),
  logLine({ts:'2026-10-21T10:04:00Z',level:'error',area:'session',msg:`não li ${path.join(runtime,'learning','sessions','2026-10-21_abc.jsonl')}`}),
  logLine({ts:'2026-10-21T10:05:00Z',level:'error',area:'conferir',msg:`captura ${path.join(home,'Desktop',CAPTURE)} falhou`}),
  logLine({ts:'2026-10-21T10:06:00Z',level:'info',area:'pi',msg:`chave carregada ${KEY_PI_AUTH}`}),
  logLine({ts:'2026-10-21T10:07:00Z',level:'error',area:'opencode',msg:`auth: {"opencode":{"type":"api","key":"${KEY_OPENCODE_AUTH}"}}`}),
  `Error: erro antigo em texto em ${path.join(vault,COURSE_B)} e C:\\Users\\ana.secreta\\Documents\\${PDF_B}`,
 ].join('\n')+'\n';
}

/** @param {string} home @param {string} vault @param {string} runtime */
function courses(home,vault,runtime){
 put(path.join(vault,COURSE_A,'Sources',PDF_A),'%PDF-1.4 falso');
 put(path.join(vault,COURSE_A,'_state.md'),'# estado\n');
 put(path.join(vault,COURSE_B,'_state.md'),'# estado\n');
 put(path.join(vault,COURSE_B,'Sources',PDF_B),'%PDF-1.4 falso');
 put(path.join(vault,'Courses',COURSE_C,'_state.md'),'# estado\n');
 put(path.join(vault,'TUTOR.md'),'tutor');
 put(path.join(runtime,'config.json'),JSON.stringify({runtimePath:runtime,vaultPath:vault,courses:[{id:'calc-sigiloso',name:COURSE_A,path:path.join(vault,COURSE_A)}]}));
 put(path.join(runtime,'desk.json'),JSON.stringify({modelRecents:{pi:[['xai','grok-4']],opencode:[['opencode','deepseek-v4.1-flash-free']]},modelFavorites:{pi:[['anthropic','claude-sonnet-5-5'],['opencode','big-pickle']]},sessionTitles:{x:SESSION_TITLE},pdfs:[path.join(vault,COURSE_A,'Sources',PDF_A)]}));
 put(path.join(runtime,'learning','sessions','2026-10-21_abc.jsonl'),JSON.stringify({role:'user',content:SESSION_TEXT})+'\n');
 put(path.join(home,'Desktop',CAPTURE),'png falso');
}

/** @param {string} home @param {string} forbiddenLog @param {string[]} freeIds */
function engines(home,forbiddenLog,freeIds){
 put(path.join(home,'.pi','agent','auth.json'),JSON.stringify({opencode:{type:'api',key:KEY_PI_AUTH}}));
 put(path.join(home,'.local','share','opencode','auth.json'),JSON.stringify({opencode:{type:'api',key:KEY_OPENCODE_AUTH}}));
 const models=['opencode/gpt-5.5',...freeIds.map(id=>`opencode/${id}`)].join('\\n');
 const forbid=`echo "$@" >> '${forbiddenLog}'; exit 3`;
 executable(path.join(home,'.opencode','bin','opencode'),
  `case "$1" in\n --version) echo 0.15.2 ;;\n models) printf '${models}\\n' ;;\n *) ${forbid} ;;\nesac`);
 executable(path.join(home,'bin','pi'),`case "$1" in\n --version) echo 0.99.4 ;;\n *) ${forbid} ;;\nesac`);
}

/**
 * Cria o perfil falso numa pasta temporária.
 * @param {{opencode?: boolean, freeIds?: string[]}} [options]
 *   `opencode: false` não instala o OpenCode falso; `freeIds` são os grátis que ele lista
 * @returns {{home: string, runtime: string, vault: string, env: Record<string, string>, secrets: string[], forbiddenLog: string, cleanup: () => void}}
 * @example const profile=createFakeTriageProfile(); spawnSync('node',['scripts/triage.mjs'],{env:profile.env});
 */
export function createFakeTriageProfile({opencode=true,freeIds=['big-pickle','deepseek-v4.1-flash-free','minimax-m3-free']}={}){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'mesa-triage-'));
 const home=path.join(root,'Users','ana.secreta');
 const runtime=path.join(home,'MesaRuntimePrivada');
 const vault=path.join(home,'Documents','Cofre Particular da Ana');
 const forbiddenLog=path.join(root,'forbidden-calls.log');
 courses(home,vault,runtime);
 engines(home,forbiddenLog,freeIds);
 if(!opencode)fs.rmSync(path.join(home,'.opencode'),{recursive:true,force:true});
 put(path.join(runtime,'desk.log'),deskLog({home,runtime,vault}));
 const env={
  HOME:home,USERPROFILE:home,PATH:process.env.PATH||'',
  LEARNING_DESK_RUNTIME:runtime,LEARNING_DESK_PI:path.join(home,'bin','pi'),
  LEARNING_CANVAS_DIR:path.join(home,'Developer','learning-canvas'),
 };
 const secrets=[
  root,home,runtime,vault,'ana.secreta','Cofre Particular da Ana','MesaRuntimePrivada',
  COURSE_A,COURSE_B,COURSE_C,'calc-sigiloso',PDF_A,PDF_B,PDF_A.replace('.pdf',''),PDF_B.replace('.pdf',''),'Professor Zé',
  KEY_LOG,KEY_BEARER,KEY_GITHUB,KEY_PI_AUTH,KEY_OPENCODE_AUTH,
  SESSION_TEXT,SESSION_TITLE,'2026-10-21_abc',CAPTURE,'caderno-da-ana',
 ];
 return {home,runtime,vault,env,secrets,forbiddenLog,cleanup:()=>fs.rmSync(root,{recursive:true,force:true})};
}
