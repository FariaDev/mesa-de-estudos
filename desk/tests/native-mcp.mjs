/* Integração opt-in com o SDK Pi instalado e servidor MCP de teste local.
   Não usa modelo/provedor, credenciais ou dados reais. Exercita QuickJS,
   transporte stdio e hooks reais; a mensagem de assistant é uma fixture. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const {resolvePi} = require('../pi.cjs');
let pkg = path.dirname(fs.realpathSync(resolvePi({deskDir:path.resolve(import.meta.dirname,'..')})));
while (!fs.existsSync(path.join(pkg,'package.json'))) pkg = path.dirname(pkg);
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-native-contract-'));
const agentDir = path.join(root, 'agent');
fs.mkdirSync(agentDir);
process.env.PI_CODING_AGENT_DIR = agentDir;
const sdk = await import(pathToFileURL(path.join(pkg,'dist','index.js')));
const server = path.join(root, 'mcp-server.mjs');
const audit = path.join(root, 'calls.jsonl');
fs.writeFileSync(server, `import fs from 'node:fs';import readline from 'node:readline';
const reply=(id,result)=>process.stdout.write(JSON.stringify({jsonrpc:'2.0',id,result})+'\\n');
const names=['echo','delete-demo','error-demo'];
for await(const line of readline.createInterface({input:process.stdin})){
 const e=JSON.parse(line);if(e.id===undefined)continue;
 if(e.method==='initialize')reply(e.id,{protocolVersion:e.params.protocolVersion,capabilities:{tools:{}},serverInfo:{name:'contract',version:'1'}});
 else if(e.method==='tools/list')reply(e.id,{tools:names.map(name=>({name,description:name,inputSchema:{type:'object',properties:{value:{type:'string'}}},outputSchema:{type:'object',properties:{value:{type:'string'}}}}))});
 else if(e.method==='tools/call'){fs.appendFileSync(${JSON.stringify(audit)},JSON.stringify(e.params)+'\\n');const bad=e.params.name==='error-demo';reply(e.id,{content:[{type:'text',text:bad?'fixture failed':e.params.arguments.value||'ok'}],structuredContent:{value:bad?'fixture-error':e.params.arguments.value||'ok'},...(bad?{isError:true}:{})});}
 else reply(e.id,{});
}
`);
fs.writeFileSync(path.join(agentDir,'mcp.json'),JSON.stringify({mcpServers:{contract:{command:process.execPath,args:[server],approveTools:['delete-*']}}}));
const model = {id:'fixture',name:'Fixture (not called)',provider:'fixture',api:'openai-completions',baseUrl:'http://127.0.0.1:1',reasoning:false,input:['text'],cost:{input:0,output:0,cacheRead:0,cacheWrite:0},contextWindow:100000,maxTokens:1000};
try {
 for (const app of ['desk','chat']) {
  const appDir = path.resolve(import.meta.dirname,'..','..',app);
  const settingsManager = sdk.SettingsManager.create(root,agentDir);
  settingsManager.applyOverrides({defaultTools:['+codemode','+tool_search']});
  const resourceLoader = new sdk.DefaultResourceLoader({cwd:root,agentDir,settingsManager,noExtensions:true,noSkills:true,noPromptTemplates:true,noProjectContext:true,
   additionalExtensionPaths:[path.join(appDir,...(app==='desk'?['src']:[]),'extensions','mcp-policy'),...(app==='chat'?[path.join(appDir,'extensions','mcp-guard')]:[])],
   extensionFactories:[sdk.createMcpExtension(),sdk.createCodemodeExtension(),sdk.createToolSearchExtension()],
  });
  await resourceLoader.reload();
  const {session} = await sdk.createAgentSession({cwd:root,agentDir,model,resourceLoader,settingsManager,sessionManager:sdk.SessionManager.inMemory(),...(app==='chat'?{noTools:'builtin'}:{})});
  const events=[];
  session.subscribe(e=>events.push(e));
  try {
   await session.bindExtensions({});
   for(let i=0;i<100&&!session.getAllTools().some(t=>t.name==='mcp__contract__echo');i++)await new Promise(r=>setTimeout(r,50));
   assert.ok(session.getAllTools().some(t=>t.name==='mcp__contract__echo'),'handshake MCP');
   const msg={role:'assistant',content:[{type:'toolCall',id:'probe',name:'codemode',arguments:{}}],api:model.api,provider:model.provider,model:model.id,stopReason:'toolUse',timestamp:Date.now(),usage:{input:0,output:0,cacheRead:0,cacheWrite:0,totalTokens:0,cost:{input:0,output:0,cacheRead:0,cacheWrite:0,total:0}}};
   session.agent.state.messages.push(msg);
   session.sessionManager.appendMessage(msg);
   const run=async code=>session.agent.state.tools.find(t=>t.name==='codemode').execute('probe',{code},new AbortController().signal);
   const result=await run('const r=await Promise.all([tools.mcp__contract__echo({value:"A"}),tools.mcp__contract__echo({value:"B"})]);store("contract",r);return r.map(x=>x.structuredContent.value).join("");');
   assert.match(JSON.stringify(result.content),/AB/,'QuickJS compõe dados estruturados');
   assert.match(JSON.stringify((await run('return load("contract").length;')).content),/2/,'estado do Codemode');
   await run('return await tools.mcp__contract__delete_demo({value:"should-not-run"});');
   assert.ok(!fs.readFileSync(audit,'utf8').includes('delete-demo'),'approveTools impede execução sem confirmação');
   const error=await run('await tools.mcp__contract__error_demo({});return await tools.mcp__contract__error_demo({});');
   assert.match(JSON.stringify(error.content),/fixture-error/,'guarda não perde structuredContent em falhas repetidas');
   assert.ok(events.some(e=>e.type==='tool_execution_end'&&e.parentToolCallId),'eventos de chamadas aninhadas');
   if(app==='chat'){
    // Mesmo se outra extensão reativar read, a política do app continua válida.
    session.setActiveToolsByName([...session.getActiveToolNames(),'read']);
    const secret=path.join(root,'private.txt');fs.writeFileSync(secret,'NATIVE-PRIVATE-MARKER');
    const blocked=await run(`return await tools.read({path:${JSON.stringify(secret)}});`);
    assert.ok(!JSON.stringify(blocked).includes('NATIVE-PRIVATE-MARKER'));
    assert.match(JSON.stringify(blocked),/disco ou shell/);
   }
   console.log(`${app}: MCP stdio, QuickJS paralelo, store/load, structuredContent, aprovação e eventos aninhados OK`);
  }finally{await session._extensionRunner.emit({type:'session_shutdown'});session.dispose();}
 }
} finally {fs.rmSync(root,{recursive:true,force:true});}
