/* SDK Pi instalado, extensão e HTTP reais; nenhum modelo/credencial/inferência. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {resolvePi}=require('../pi.cjs');
const {createTutorMaterialBridge}=require('../tutor-materials.cjs');
const desk=path.resolve(import.meta.dirname,'..');
let pkg=path.dirname(fs.realpathSync(resolvePi({deskDir:desk})));
while(!fs.existsSync(path.join(pkg,'package.json')))pkg=path.dirname(pkg);
const root=fs.mkdtempSync(path.join(os.tmpdir(),'pi-native-tutor-pdf-')),agentDir=path.join(root,'agent');fs.mkdirSync(agentDir);
process.env.PI_CODING_AGENT_DIR=agentDir;
const calls=[];
const bridge=createTutorMaterialBridge({createMaterial:async(scope,args)=>{calls.push({scope,args});return {prepared:true,name:'Material.pdf',path:path.join(root,'Material.pdf')};}});
await bridge.start();process.env.LEARNING_DESK_MATERIAL_BRIDGE=JSON.stringify(bridge.grant({session:'native-test'}));
let session;
try{
 const sdk=await import(pathToFileURL(path.join(pkg,'dist','index.js')));
 const settingsManager=sdk.SettingsManager.create(root,agentDir);
 const resourceLoader=new sdk.DefaultResourceLoader({cwd:root,agentDir,settingsManager,noExtensions:true,noSkills:true,noPromptTemplates:true,noProjectContext:true,additionalExtensionPaths:[path.join(desk,'src','extensions','tutor-pdf')]});
 await resourceLoader.reload();
 const model={id:'fixture',name:'No inference',provider:'fixture',api:'openai-completions',baseUrl:'http://127.0.0.1:1',reasoning:false,input:['text'],cost:{input:0,output:0,cacheRead:0,cacheWrite:0},contextWindow:100000,maxTokens:1000};
 ({session}=await sdk.createAgentSession({cwd:root,agentDir,model,resourceLoader,settingsManager,sessionManager:sdk.SessionManager.inMemory()}));
 await session.bindExtensions({});
 const tool=session.agent.state.tools.find(t=>t.name==='mesa_criar_pdf');assert.ok(tool,'extensão nativa disponível ao tutor');
 const result=await tool.execute('pdf-test',{title:'Material',markdown:'# Escrito pelo tutor\n\n$$2+2=4$$'},new AbortController().signal);
 assert.equal(result.details.prepared,true);assert.equal(calls.length,1);assert.equal(calls[0].scope.session,'native-test');
 assert.match(calls[0].args.markdown,/2\+2=4/);
 console.log('PASS: SDK Pi carrega a extensão e executa mesa_criar_pdf pela ponte real; sem inferência.');
}finally{if(session){await session._extensionRunner.emit({type:'session_shutdown'});session.dispose();}await bridge.close();fs.rmSync(root,{recursive:true,force:true});}
