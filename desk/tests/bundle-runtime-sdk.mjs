// SDK oficial e payload real, com CLI sintético local: sem login/inferência.
// node tests/bundle-runtime-sdk.mjs [--payload /pasta/temporaria]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url);
const {stageBundlePayload,runtimePackages}=require('../bundle-runtime.cjs');
const desk=path.resolve(import.meta.dirname,'..');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'mesa-bundle-sdk-'));
const outputIndex=process.argv.indexOf('--payload');
if(outputIndex>=0)assert.ok(process.argv[outputIndex+1]&&!process.argv[outputIndex+1].startsWith('--'),'--payload exige uma pasta nova');
const payload=outputIndex<0?path.join(root,'payload'):path.resolve(process.argv[outputIndex+1]);
assert.equal(fs.existsSync(payload),false,'--payload deve apontar para uma pasta nova; o teste não sobrescreve instalações');
let query;
const abort=new AbortController();
function bytes(dir){return fs.readdirSync(dir,{withFileTypes:true}).reduce((sum,e)=>{const file=path.join(dir,e.name);return sum+(e.isDirectory()?bytes(file):fs.statSync(file).size);},0);}
try{
 const nm=path.join(desk,'node_modules');
 const roots=['marked','katex','dompurify','pdfjs-dist','@anthropic-ai/claude-agent-sdk'];
 const full=runtimePackages(nm,roots),lean=runtimePackages(nm,roots,{externalClaude:true});
 const omitted=full.filter(p=>!lean.some(q=>q.relative===p.relative));
 if(!omitted.length)console.warn('Nenhum CLI opcional instalado nesta plataforma; contrato com CLI externo continua sendo testado.');
 const sdkPackage=require(path.join(nm,'@anthropic-ai','claude-agent-sdk','package.json'));
 assert.deepEqual(Object.keys(sdkPackage.optionalDependencies||{}).filter(n=>n.startsWith('@anthropic-ai/claude-agent-sdk-')).sort(),['darwin-arm64','darwin-x64','linux-arm64','linux-arm64-musl','linux-x64','linux-x64-musl','win32-arm64','win32-x64'].map(n=>'@anthropic-ai/claude-agent-sdk-'+n).sort(),'mudança nos nomes de CLIs exige revisar a política de empacotamento');
 // Um pacote aninhado não declarado seria removido pelo filtro de cópia.
 // Verifica as árvores reais antes do staging para detectar essa mudança.
 const selected=new Set(full.map(p=>path.resolve(p.source)));
 function checkNested(dir){
  for(const e of fs.readdirSync(dir,{withFileTypes:true})){
   if(!e.isDirectory())continue;
   const child=path.join(dir,e.name);
   if(e.name==='node_modules'){
    for(const item of fs.readdirSync(child,{withFileTypes:true})){
     if(!item.isDirectory()||item.name.startsWith('.'))continue;
     const candidate=path.join(child,item.name);
     const packages=item.name.startsWith('@')?fs.readdirSync(candidate).map(name=>path.join(candidate,name)):[candidate];
     for(const pkg of packages)if(fs.existsSync(path.join(pkg,'package.json')))assert.ok(selected.has(path.resolve(pkg)),'pacote aninhado fora do grafo declarado: '+path.relative(nm,pkg));
    }
   }
   checkNested(child);
  }
 }
 for(const p of full)checkNested(p.source);
 assert.ok(omitted.every(p=>p.relative.startsWith('@anthropic-ai/claude-agent-sdk-')));
 const managed=stageBundlePayload(desk,payload);
 assert.ok(managed.includes(path.join('node_modules','@anthropic-ai/claude-agent-sdk')));
 for(const p of omitted)assert.equal(fs.existsSync(path.join(payload,'node_modules',p.relative)),false);
 const sdk=await import(pathToFileURL(path.join(payload,'node_modules','@anthropic-ai','claude-agent-sdk','sdk.mjs')).href);
 assert.equal(typeof sdk.query,'function');
 const marker=path.join(root,'launched'),cli=path.join(root,'external-cli.mjs');
 fs.writeFileSync(cli,`import fs from 'node:fs';import readline from 'node:readline';
fs.writeFileSync(process.env.MESA_EXTERNAL_CLI_MARKER,'external');
for await(const line of readline.createInterface({input:process.stdin})){
 const m=JSON.parse(line);
 if(m.type==='control_request')process.stdout.write(JSON.stringify({type:'control_response',response:{subtype:'success',request_id:m.request_id,response:{commands:[],models:[],agents:[],account:{}}}})+'\\n');
}
`);
 /* Entrada que nunca manda mensagem: segura a sessão aberta até o abort. */
 // eslint-disable-next-line require-yield -- o gerador vazio é a entrada sem mensagens que o SDK espera
 async function* input(){await new Promise(resolve=>abort.signal.addEventListener('abort',resolve,{once:true}));}
 query=sdk.query({prompt:input(),options:{pathToClaudeCodeExecutable:cli,executable:process.execPath,cwd:root,env:{PATH:process.env.PATH,HOME:root,MESA_EXTERNAL_CLI_MARKER:marker},settingSources:[],strictMcpConfig:true,mcpServers:{},tools:[],abortController:abort}});
 const timeout=setTimeout(()=>abort.abort(),10000);
 try{const result=await query.initializationResult();assert.deepEqual(result.models,[]);assert.equal(fs.readFileSync(marker,'utf8'),'external');}
 finally{clearTimeout(timeout);}
 console.log(JSON.stringify({check:'official-sdk-external-cli',sdkVersion:require(path.join(payload,'node_modules','@anthropic-ai','claude-agent-sdk','package.json')).version,payloadBytes:bytes(payload),omitted:omitted.map(p=>({name:p.relative,bytes:bytes(p.source)})),payload:outputIndex<0?'temporary (removed after check)':payload},null,2));
}finally{
 abort.abort();query?.close();fs.rmSync(root,{recursive:true,force:true});
}
