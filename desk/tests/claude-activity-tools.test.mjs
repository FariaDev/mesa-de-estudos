import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {InMemoryTransport} from '@modelcontextprotocol/sdk/inMemory.js';
import {fakeSdk} from './claude-fixtures.mjs';
const require=createRequire(import.meta.url);
const {ClaudeAdapter}=require('../src/agents/claude-adapter.cjs');
const {ACTIVITY_TOOL_NAME}=require('../src/agents/activity-tools.cjs');
const spec={title:'Movimento',objective:'Explorar posição',alternativeMarkdown:'s=at²/2',html:'<p>Movimento</p>',css:'',js:'',katex:false};

test('SDK MCP anuncia PDF e atividade; hook injeta ID nativo sem confirmação extra',async()=>{
 const sdk=fakeSdk(),calls=[];
 const adapter=new ClaudeAdapter({conversationId:'synthetic-tools',cwd:process.cwd(),sdkLoader:async()=>sdk,
  createMaterial:async()=>({prepared:true}),createActivity:async args=>{calls.push(args);return {published:true,id:'act-synthetic',version:1};}});
 let client;
 try{
  await adapter._ensureQuery();
  const options=sdk.state.queries[0].options;
  assert.deepEqual(options.allowedTools,['mcp__mesa__criar_pdf',ACTIVITY_TOOL_NAME]);
  const [a,b]=InMemoryTransport.createLinkedPair();
  client=new Client({name:'mesa-activity-contract',version:'1'});
  await options.mcpServers.mesa.instance.connect(b);await client.connect(a);
  assert.deepEqual((await client.listTools()).tools.map(t=>t.name),['criar_pdf','criar_atividade']);
  const invoke=args=>client.callTool({name:'criar_atividade',arguments:args});
  assert.equal((await invoke({...spec,callRef:'invented'})).isError,true);
  adapter._turn={finalized:false};adapter._runId='synthetic-turn';
  const hook=options.hooks.PreToolUse[0].hooks[0];
  const reserved=await hook({tool_name:ACTIVITY_TOOL_NAME,tool_use_id:'toolu_native',tool_input:{...spec,callRef:'model-value'}});
  assert.equal(reserved.hookSpecificOutput.permissionDecision,'allow');
  const injected=reserved.hookSpecificOutput.updatedInput;
  assert.notEqual(injected.callRef,'model-value');
  assert.equal((await options.canUseTool(ACTIVITY_TOOL_NAME,injected,{})).behavior,'allow');
  assert.equal((await invoke({...injected,html:'<p>Modificado</p>'})).isError,true);
  assert.equal((await invoke(injected)).isError,undefined);
  assert.equal(calls[0].toolCallId,'toolu_native');
  adapter._cancelRequested=true;
  assert.equal((await invoke(injected)).isError,true);
  adapter._cancelRequested=false;adapter._runId='another-turn';
  assert.equal((await invoke(injected)).isError,true);
  assert.equal(calls.length,1);
  adapter._turn=null;adapter.close();
  assert.equal((await invoke(injected)).isError,true);
 }finally{adapter._turn=null;adapter.close();await client?.close();}
});
