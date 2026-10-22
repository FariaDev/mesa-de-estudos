import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import os from 'node:os';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {runtimePackages,stageBundlePayload,installBundle}=require('../bundle-runtime.cjs');
const {userDataDirectory}=require('../user-data.cjs');

test('payload resolve peers e versões aninhadas sem depender da fonte',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'mesa-bundle-graph-'));
 try{
  const nm=path.join(root,'source','node_modules'),dest=path.join(root,'payload','node_modules');
  const pkg=(rel,json,js)=>{const dir=path.join(nm,rel);fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'package.json'),JSON.stringify({main:'index.cjs',...json}));fs.writeFileSync(path.join(dir,'index.cjs'),js);};
  pkg('a',{name:'a',dependencies:{b:'2'},peerDependencies:{peer:'1'},optionalDependencies:{absent:'1'}},"module.exports=[require('b'),require('peer')]");
  pkg('a/node_modules/b',{name:'b'},"module.exports='nested-v2'");
  pkg('b',{name:'b'},"module.exports='root-v1'");
  pkg('peer',{name:'peer'},"module.exports='peer'");
  for(const entry of runtimePackages(nm,['a','b'])){const out=path.join(dest,entry.relative);fs.mkdirSync(path.dirname(out),{recursive:true});fs.cpSync(entry.source,out,{recursive:true});}
  fs.rmSync(path.join(root,'source'),{recursive:true});
  const load=createRequire(path.join(root,'payload','entry.cjs'));
  assert.deepEqual(load('a'),['nested-v2','peer']);assert.equal(load('b'),'root-v1');
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('payload recusa dependência obrigatória ausente e nomes que escapam',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'mesa-bundle-missing-'));
 try{fs.mkdirSync(path.join(root,'node_modules'));assert.throws(()=>runtimePackages(path.join(root,'node_modules'),['missing']),/Dependência ausente/);assert.throws(()=>runtimePackages(path.join(root,'node_modules'),['scope\\..\\escape']),/Pacote inválido/);}
 finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('bundle usa Claude externo sem perder peers, codecs ou versões aninhadas',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'mesa-bundle-external-'));
 try{
  const source=path.join(root,'source'),nm=path.join(source,'node_modules'),dest=path.join(root,'payload');
  fs.mkdirSync(path.join(source,'scripts'),{recursive:true});
  fs.mkdirSync(path.join(source,'src','locales'),{recursive:true});fs.writeFileSync(path.join(source,'src','locales','en.json'),'{}');
  for(const name of ['index.html','ggb.html','style.css','package.json','config.example.json','free-models.json','scripts/install-app.mjs'])fs.writeFileSync(path.join(source,name),'{}');
  const pkg=(rel,json,js="module.exports=true")=>{const dir=path.join(nm,rel);fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'package.json'),JSON.stringify({name:rel,main:'index.cjs',...json}));fs.writeFileSync(path.join(dir,'index.cjs'),js);};
  for(const name of ['marked','katex','dompurify'])pkg(name,{});
  const cli='@anthropic-ai/claude-agent-sdk-darwin-arm64';
  pkg('@anthropic-ai/claude-agent-sdk',{peerDependencies:{peer:'1'},optionalDependencies:{[cli]:'1',other:'1'}},"module.exports=[require('peer'),require('other')]");
  pkg('@anthropic-ai/claude-agent-sdk/node_modules/'+cli,{name:cli});
  pkg('peer',{},"module.exports='peer'");
  pkg('other',{},"module.exports='optional'");
  pkg('pdfjs-dist',{optionalDependencies:{codec:'1'},dependencies:{nested:'2'}},"module.exports=[require('codec'),require('nested')]");
  pkg('codec',{},"module.exports='codec'");
  pkg('pdfjs-dist/node_modules/nested',{name:'nested'},"module.exports='nested-v2'");
  pkg('nested',{},"module.exports='root-v1'");
  assert.ok(runtimePackages(nm,['@anthropic-ai/claude-agent-sdk']).some(p=>p.relative.endsWith(cli)),'a API geral mantém o CLI por padrão');
  const managed=stageBundlePayload(source,dest);
  assert.ok(!managed.some(p=>p.endsWith(cli)),'o manifesto do app omite o CLI');
  assert.ok(managed.includes('src')&&fs.existsSync(path.join(dest,'src','locales','en.json')),'os catálogos de idioma (#41, #72) entram no payload dentro de src/: sem eles o app instalado não abre');
  assert.equal(fs.existsSync(path.join(dest,'node_modules','@anthropic-ai/claude-agent-sdk/node_modules',cli)),false,'a cópia do pai não reintroduz o CLI aninhado');
  fs.rmSync(source,{recursive:true});
  const load=createRequire(path.join(dest,'entry.cjs'));
  assert.deepEqual(load('@anthropic-ai/claude-agent-sdk'),['peer','optional']);
  assert.deepEqual(load('pdfjs-dist'),['codec','nested-v2']);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('CLI exigido por outra dependência não é omitido',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'mesa-bundle-required-'));
 try{
  const nm=path.join(root,'node_modules'),cli='@anthropic-ai/claude-agent-sdk-win32-x64';
  for(const [name,json] of [['@anthropic-ai/claude-agent-sdk',{optionalDependencies:{[cli]:'1'}}],['required',{dependencies:{[cli]:'1'}}],[cli,{}]]){
   const dir=path.join(nm,name);fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'package.json'),JSON.stringify({name,...json}));
  }
  assert.ok(runtimePackages(nm,['@anthropic-ai/claude-agent-sdk','required'],{externalClaude:true}).some(p=>p.relative===cli));
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('doctor usa userData da plataforma e respeita os overrides',()=>{
 assert.equal(userDataDirectory({platform:'win32',home:'/home',env:{APPDATA:'/roaming'}}),path.join('/roaming','Mesa de Estudos'));
 assert.equal(userDataDirectory({platform:'darwin',home:'/home',env:{}}),path.join('/home','Library','Application Support','Mesa de Estudos'));
 assert.equal(userDataDirectory({platform:'linux',home:'/home',env:{}}),path.join('/home','.config','Mesa de Estudos'));
 assert.equal(userDataDirectory({platform:'linux',home:'/home',env:{XDG_CONFIG_HOME:'/xdg'}}),path.join('/xdg','Mesa de Estudos'));
 assert.equal(userDataDirectory({platform:'win32',env:{LEARNING_DESK_RUNTIME:'/runtime'}}),'/runtime');
});

/* #51: a rotina do install-app sem o que toca o sistema (assinatura, atalho,
   LaunchServices), para o teste do app empacotado montar o bundle numa pasta
   temporária. Só macOS: o Info.plist passa pelo `plutil`. */
test('installBundle: versão no Info.plist, payload, manifesto e órfãos, sem binário do SDK',{skip:process.platform!=='darwin'&&'o bundle .app é de macOS'},()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'mesa-install-bundle-'));
 try{
  const source=path.join(root,'desk'),nm=path.join(source,'node_modules'),app=path.join(root,'Mesa de Estudos.app');
  fs.mkdirSync(path.join(source,'scripts'),{recursive:true});
  for(const name of ['index.html','ggb.html','style.css','package.json','config.example.json','free-models.json','scripts/install-app.mjs','main.cjs'])fs.writeFileSync(path.join(source,name),'{}');
  const pkg=(rel,json)=>{const dir=path.join(nm,rel);fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'package.json'),JSON.stringify({name:rel,...json}));};
  for(const name of ['marked','katex','dompurify','pdfjs-dist'])pkg(name,{});
  const cli='@anthropic-ai/claude-agent-sdk-darwin-arm64';
  pkg('@anthropic-ai/claude-agent-sdk',{optionalDependencies:{[cli]:'1'}});pkg(cli,{});
  fs.mkdirSync(path.join(app,'Contents','Resources','app'),{recursive:true});
  execFileSync('plutil',['-create','xml1',path.join(app,'Contents','Info.plist')]);
  const dest=path.join(app,'Contents','Resources','app');
  fs.writeFileSync(path.join(dest,'velho.cjs'),'órfão');fs.writeFileSync(path.join(dest,'local.txt'),'da pessoa');
  fs.writeFileSync(path.join(dest,'.update-manifest.json'),JSON.stringify({files:['velho.cjs','../fora']}));
  const out=installBundle({desk:source,root,app,version:'9.8.7'});
  assert.equal(out.dest,dest);
  assert.equal(execFileSync('plutil',['-extract','CFBundleShortVersionString','raw',path.join(app,'Contents','Info.plist')],{encoding:'utf8'}).trim(),'9.8.7');
  assert.ok(fs.existsSync(path.join(dest,'main.cjs')));
  assert.equal(fs.existsSync(path.join(dest,'velho.cjs')),false,'o órfão do manifesto antigo sai');
  assert.equal(fs.existsSync(path.join(dest,'local.txt')),true,'arquivo local fica');
  const manifest=JSON.parse(fs.readFileSync(path.join(dest,'.update-manifest.json'),'utf8'));
  assert.equal(manifest.version,'9.8.7');assert.deepEqual(manifest.files,out.managed);
  assert.equal(fs.existsSync(path.join(dest,'node_modules',cli)),false,'sem binário do SDK: a Mesa usa o Claude Code do usuário');
  assert.throws(()=>installBundle({desk:source,root,app:path.join(root,'nada.app'),version:'1.0.0'}),/esperava um \.app com Contents\/Info\.plist, recebeu/);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
