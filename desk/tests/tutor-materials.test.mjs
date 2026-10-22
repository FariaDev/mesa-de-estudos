import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {InMemoryTransport} from '@modelcontextprotocol/sdk/inMemory.js';
import {createTutorPdf} from '../src/extensions/tutor-pdf/client.mjs';
import {fakeSdk,waitFor} from './claude-fixtures.mjs';
import {ptText,enText} from './pt-text.mjs';
import {message} from '../src/i18n.mjs';
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
 const bridge=createTutorMaterialBridge({createMaterial:async(scope,args)=>{calls.push({scope,args});return {prepared:true,name:'Pitágoras.pdf'};},tutorText:ptText});
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

test('modelo e opcoes são opcionais: sem eles o pedido segue como antes; inválidos voltam como erro',async()=>{
 const calls=[];
 const bridge=createTutorMaterialBridge({createMaterial:async(scope,args)=>{calls.push(args);return {prepared:true,model:args.modelo||'livre'};},tutorText:ptText});
 await bridge.start();
 try{
  const grant=bridge.grant({session:'M'});
  await createTutorPdf(grant,payload);
  assert.equal(calls[0].modelo,undefined);assert.equal(calls[0].opcoes,undefined);
  await createTutorPdf(grant,{...payload,modelo:'lista',opcoes:{colunas:'auto',gabarito:true}});
  assert.equal(calls[1].modelo,'lista');assert.deepEqual(calls[1].opcoes,{colunas:'auto',gabarito:true});
  const post=body=>fetch(grant.url,{method:'POST',headers:{'content-type':'application/json','x-mesa-token':grant.token},body:JSON.stringify(body)});
  const unknown=await post({...payload,modelo:'cartaz'});
  assert.equal(unknown.status,400);assert.equal((await unknown.json()).error,'Pedido de PDF inválido: modelo recebeu "cartaz"; esperado lista|apostila|resumo|simulado|formulario|livre.');
  assert.equal((await post({...payload,modelo:7})).status,400);
  assert.equal((await post({...payload,opcoes:[1]})).status,400);
  assert.equal((await post({...payload,opcoes:{rodape:'x'.repeat(2100)}})).status,400);
  assert.equal(calls.length,2);
 }finally{await bridge.close();}
});

/* Regressão (#43 fase 3): o erro marcado do gerador (`err.pdf.*`) ia cru ao
   modelo, com a marca U+E000; agora vai na língua do tutor. */
test('ponte devolve ao tutor o erro do gerador já traduzido',async()=>{
 const bridge=createTutorMaterialBridge({createMaterial:async()=>{throw Error(message('err.pdf.sessionChanged'));},tutorText:enText});
 await bridge.start();
 try{
  const grant=bridge.grant({session:'A'});
  await assert.rejects(createTutorPdf(grant,payload),error=>error.message===enText(message('err.pdf.sessionChanged'))&&!error.message.includes('\uE000'));
 }finally{await bridge.close();}
});
test('as duas ferramentas do tutor usam o mesmo texto e os ids do núcleo',async()=>{
 const guide=await import('../src/extensions/tutor-pdf/guide.mjs');
 const model=require('../material-model.cjs');
 assert.deepEqual(guide.MODEL_IDS,model.MODEL_IDS);
 for(const id of model.MODEL_IDS)assert.match(guide.TOOL_DESCRIPTION,new RegExp(`- ${id} —`));
 const keys=new Set();
 for(const id of model.MODEL_IDS)for(const spec of model.optionSpecs(id).specs)keys.add(spec.key);
 assert.deepEqual([...keys].sort(),[...guide.OPTION_KEYS].sort());
 for(const key of guide.OPTION_KEYS)assert.match(guide.TOOL_DESCRIPTION,new RegExp(`\\b${key}\\b`));
 assert.match(guide.TOOL_DESCRIPTION,/\{longa\}/);
 const server=await createTutorPdfServer(async()=>({prepared:true}));
 const client=await mcpClient(server);
 try{
  const {tools}=await client.listTools();
  const tool=tools.find(entry=>entry.name==='criar_pdf');
  assert.equal(tool.description,guide.TOOL_DESCRIPTION);
  assert.deepEqual(tool.inputSchema.properties.modelo.enum,guide.MODEL_IDS);
  assert.ok(tool.inputSchema.properties.opcoes);
  assert.deepEqual([...tool.inputSchema.required].sort(),['markdown','title']);
  /* #40: o esquema anunciado é o dos campos do guia — o mesmo que o Pi monta. */
  const fields=await import('../src/extensions/tool-fields.mjs');
  assert.deepEqual(fields.canonical(tool.inputSchema),fields.canonicalFields(guide.FIELDS));
  const source=fs.readFileSync(path.join(import.meta.dirname,'..','src','extensions','tutor-pdf','index.ts'),'utf8');
  assert.match(source,/parameters:typeboxObject\(Type,FIELDS\)/);
  assert.match(source,/text:resultText\(result\)/);
  const bad=await client.callTool({name:'criar_pdf',arguments:{...payload,modelo:'cartaz'}});
  assert.equal(bad.isError,true);
 }finally{await client.close();await server.instance.close();}
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
  assert.equal(result.isError,undefined);
  /* O resultado é a frase do guia, a mesma do Pi (#40): nada de JSON interno. */
  assert.match(result.content[0].text,/^Material “Pitágoras” preparado no diálogo de PDF\./);
  assert.match(result.content[0].text,/o arquivo ainda não foi salvo/);
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
