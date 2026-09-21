import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';

const require=createRequire(import.meta.url);
const {resolvePi,spawnEnv}=require('../pi.cjs');
const deskDir=path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const envRuntime=process.env.LEARNING_DESK_RUNTIME||'';
const configDir=envRuntime||(process.platform==='win32'?path.join(process.env.APPDATA||'', 'Mesa de Estudos'):path.join(os.homedir(),'Library','Application Support','Mesa de Estudos'));
let configPi='';
try{configPi=String(JSON.parse(fs.readFileSync(path.join(configDir,'config.json'),'utf8')).piPath||'');}catch{}
const pi=resolvePi({configPath:configPi,deskDir,envPath:process.env.LEARNING_DESK_PI||''});
if(!pi){
 console.log('pi não encontrado; contrato ignorado');
 process.exit(0);
}

const courseDir=path.join(deskDir,'.runtime','learning','Courses','Calculus I');
const cwd=fs.existsSync(courseDir)?courseDir:deskDir;
const session=path.join(os.tmpdir(),`desk-contract-${Date.now()}-${process.pid}.jsonl`);

const child=spawn(pi,['--mode','rpc','--session',session,'--approve'],{cwd,env:spawnEnv(pi),stdio:['pipe','pipe','pipe'],windowsHide:true});
const deadline=setTimeout(()=>{console.error('contrato: Pi não respondeu em 25s');child.kill('SIGKILL');},25000);

const waiters=new Map();
let buffer='';
child.stdout.setEncoding('utf8');
child.stdout.on('data',chunk=>{
 buffer+=chunk;
 let n;
 while((n=buffer.indexOf('\n'))>=0){
  const raw=buffer.slice(0,n);buffer=buffer.slice(n+1);
  if(!raw.trim())continue;
  let e;try{e=JSON.parse(raw);}catch{continue;}
  if(e.type==='response'&&waiters.has(e.id)){
   const w=waiters.get(e.id);waiters.delete(e.id);
   e.success?w.resolve(e.data):w.reject(Error(e.error||'Pi recusou a solicitação.'));
  }
 }
});
function request(type,args={}){
 return new Promise((resolve,reject)=>{
  const id=`contrato-${++seq}`;
  waiters.set(id,{resolve,reject});
  child.stdin.write(JSON.stringify({id,type,...args})+'\n');
 });
}
let seq=0;
try{
 await new Promise((resolve,reject)=>{child.once('spawn',resolve);child.once('error',reject);});
 const state=await request('get_state');
 assert.equal(typeof state.isStreaming,'boolean','get_state.isStreaming deve ser booleano');
 assert.equal(typeof state.sessionFile,'string','get_state.sessionFile deve ser string');
 const stats=await request('get_session_stats');
 let usage=stats?.contextUsage;
 if(!usage&&stats&&stats.tokens&&stats.contextWindow)usage={tokens:stats.tokens,contextWindow:stats.contextWindow,percent:stats.tokens/stats.contextWindow*100};
 assert.ok(usage,'get_session_stats deve trazer uso de contexto');
 assert.equal(typeof usage.tokens,'number','contextUsage.tokens deve ser número');
 assert.equal(typeof usage.contextWindow,'number','contextUsage.contextWindow deve ser número');
 assert.equal(typeof usage.percent,'number','contextUsage.percent deve ser número');
 const catalog=await request('get_commands');
 assert.ok(Array.isArray(catalog?.commands),'get_commands.commands deve ser lista');
 assert.ok(catalog.commands.every(c=>c&&typeof c.name==='string'),'cada comando deve ter name');
 console.log(`contrato: shapes ok (cwd=${path.basename(cwd)}, comandos=${catalog.commands.length})`);
}catch(e){
 console.error('contrato falhou:',e.message);
 process.exitCode=1;
}finally{
 clearTimeout(deadline);
 try{child.kill();}catch{}
 child.stdout?.destroy?.();
 setTimeout(()=>{try{child.kill('SIGKILL');}catch{}},500);
 try{fs.rmSync(session,{force:true});}catch{}
}
