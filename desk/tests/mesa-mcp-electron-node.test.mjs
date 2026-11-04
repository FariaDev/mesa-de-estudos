/* O MCP `mesa` sem Node instalado (#93): o OpenCode sobe o servidor com o
   executável do próprio app em `ELECTRON_RUN_AS_NODE=1`; aqui o binário do
   Electron faz esse papel e responde initialize/tools/list de verdade. Não
   depende do Node do PATH nem de janela (sem DISPLAY). */
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import path from 'node:path';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const electron=require('electron');
const server=path.join(import.meta.dirname,'..','src','extensions','mesa-mcp','server.mjs');

test('o MCP sobe no Node do Electron e lista as ferramentas sem Node do sistema', async () => {
 const child=spawn(electron,[server],{
  env:{...process.env,ELECTRON_RUN_AS_NODE:'1',LEARNING_DESK_ACTIVITY_BRIDGE:'',LEARNING_DESK_MATERIAL_BRIDGE:'',LEARNING_DESK_GGB_BRIDGE:''},
  stdio:['pipe','pipe','pipe'],
 });
 let buffer='';
 const replies=[];
 child.stdout.setEncoding('utf8');
 child.stdout.on('data',(chunk)=>{
  buffer+=chunk;
  let cut;
  while((cut=buffer.indexOf('\n'))>=0){
   const line=buffer.slice(0,cut).trim();buffer=buffer.slice(cut+1);
   if(line)replies.push(JSON.parse(line));
  }
 });
 try{
  await new Promise((resolve,reject)=>{child.once('spawn',resolve);child.once('error',reject);});
  child.stdin.write(`${JSON.stringify({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-06-18'}})}\n`);
  child.stdin.write(`${JSON.stringify({jsonrpc:'2.0',id:2,method:'tools/list'})}\n`);
  for(let attempt=0;attempt<200&&replies.length<2;attempt++)await new Promise((resolve)=>setTimeout(resolve,20));
  assert.equal(replies.find((reply)=>reply.id===1)?.result?.serverInfo?.name,'mesa');
  const names=replies.find((reply)=>reply.id===2)?.result?.tools?.map((tool)=>tool.name)||[];
  assert.deepEqual(names,['calcular'],'sem pontes, o catálogo traz só a calculadora; o servidor em si sobe no Electron');
 } finally {
  child.kill('SIGKILL');
 }
});
