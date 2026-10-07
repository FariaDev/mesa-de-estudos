import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {InMemoryTransport} from '@modelcontextprotocol/sdk/inMemory.js';
import {createTutorPdf} from '../src/extensions/tutor-pdf/client.mjs';
import {fakeSdk,waitFor} from './claude-fixtures.mjs';
const require=createRequire(import.meta.url);
const {createTutorMaterialBridge}=require('../tutor-materials.cjs');
const {createTutorPdfServer,TOOL_NAME}=require('../src/agents/tutor-pdf.cjs');
const {ClaudeAdapter}=require('../src/agents/claude-adapter.cjs');
const payload={title:'Pitágoras',markdown:'# Exemplo\n\n$$c=\\sqrt{9+16}=5$$'};

test('fechar durante a inicialização não deixa um servidor aberto',async()=>{
 const bridge=createTutorMaterialBridge({createMaterial:async()=>({prepared:true})});
 const starting=bridge.start();await bridge.close();await starting;
 assert.throws(()=>bridge.grant({session:'closed'}),/indisponível/);
 await assert.rejects(bridge.start(),/encerrada/);
});

test('ponte do tutor captura o escopo, valida conteúdo e revoga a credencial',async()=>{
 const calls=[];
 const bridge=createTutorMaterialBridge({createMaterial:async(scope,args)=>{calls.push({scope,args});return {prepared:true,name:'Pitágoras.pdf'};}});
 await bridge.start();
 try{
  const scope={session:'A',freeSessionId:'free-A'},grant=bridge.grant(scope);scope.session='B';
  assert.equal((await createTutorPdf(grant,payload)).prepared,true);
  assert.equal(calls[0].scope.session,'A');assert.equal(calls[0].args.markdown,payload.markdown);
  const post=(body,token=grant.token)=>fetch(grant.url,{method:'POST',headers:{'content-type':'application/json','x-mesa-token':token},body:JSON.stringify(body)});
  assert.equal((await post(payload,'invalid')).status,403);
  assert.equal((await post({...payload,title:' '})).status,400);
  assert.equal((await post({...payload,markdown:'x'.repeat(262145)})).status,400);
  assert.equal(calls.length,1);
  bridge.revoke(grant.token);
  await assert.rejects(createTutorPdf(grant,payload),/autorizada/);
  assert.equal(calls.length,1);
 }finally{await bridge.close();}
});

test('cancelar o cliente ou revogar o escopo aborta a geração em andamento',async()=>{
 let activeSignal;
 const bridge=createTutorMaterialBridge({createMaterial:async(_scope,{signal})=>{
  activeSignal=signal;
  await new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(Error('cancelado')),{once:true}));
 }});
 await bridge.start();
 try{
  for(const revoke of [false,true]){
   activeSignal=null;const grant=bridge.grant({session:'cancel'}),controller=new AbortController();
   const pending=createTutorPdf(grant,payload,controller.signal);const rejected=assert.rejects(pending);
   await waitFor(()=>!!activeSignal);
   if(revoke)bridge.revoke(grant.token);else controller.abort();
   await rejected;await waitFor(()=>activeSignal.aborted);
  }
 }finally{await bridge.close();}
});

async function mcpClient(server){
 const [a,b]=InMemoryTransport.createLinkedPair();
 const client=new Client({name:'mesa-pdf-contract',version:'1.0.0'});
 await server.instance.connect(b);await client.connect(a);return client;
}
test('SDK oficial Claude anuncia e executa criar_pdf pelo protocolo MCP',async()=>{
 const calls=[];
 const server=await createTutorPdfServer(async args=>{calls.push(args);return {prepared:true,name:'Pitágoras.pdf'};});
 const client=await mcpClient(server);
 try{
  const {tools}=await client.listTools();assert.deepEqual(tools.map(t=>t.name),['criar_pdf']);
  assert.equal(tools[0].annotations.destructiveHint,false);
  const result=await client.callTool({name:'criar_pdf',arguments:payload});
  assert.equal(result.isError,undefined);assert.equal(JSON.parse(result.content[0].text).prepared,true);
  assert.equal(calls[0].markdown,payload.markdown);
  const invalid=await client.callTool({name:'criar_pdf',arguments:{...payload,title:''}});
  assert.equal(invalid.isError,true);assert.equal(calls.length,1);
 }finally{await client.close();await server.instance.close();}
});

test('adaptador Claude libera só o gerador nativo e recusa um servidor antigo',async()=>{
 const sdk=fakeSdk(),calls=[];
 const adapter=new ClaudeAdapter({conversationId:'free-contract',cwd:process.cwd(),sdkLoader:async()=>sdk,createMaterial:async args=>{calls.push(args);return {prepared:true,name:'native.pdf'};}});
 let client;
 try{
  await adapter._ensureQuery();
  const options=sdk.state.queries[0].options;
  assert.deepEqual(Object.keys(options.mcpServers),['mesa']);assert.deepEqual(options.allowedTools,[TOOL_NAME]);
  assert.equal((await options.canUseTool(TOOL_NAME,payload,{})).behavior,'allow');
  assert.equal((await options.canUseTool('mcp__other__write',payload,{})).behavior,'deny');
  client=await mcpClient(options.mcpServers.mesa);
  assert.equal((await client.callTool({name:'criar_pdf',arguments:payload})).isError,undefined);
  assert.equal(calls.length,1);adapter.close();
  const stale=await client.callTool({name:'criar_pdf',arguments:payload});
  assert.equal(stale.isError,true);assert.match(stale.content[0].text,/encerrada/);assert.equal(calls.length,1);
 }finally{adapter.close();await client?.close();}
});
