/* Instala/atualiza o bundle Mesa de Estudos.app (espelha chat/scripts/install-app.mjs).
   - Sincroniza o código em Contents/Resources/app: .cjs/.mjs, src/, assets/, templates/ e
     scripts/, além das dependências de runtime do renderer (marked/katex/dompurify/pdfjs-dist,
     importadas direto de node_modules pelo index.html e pelo renderer).
   - Mantém a versão do package.json no Info.plist.
   - Assina (certificado, se houver; senão ad-hoc), registra no LaunchServices e deixa um
     atalho em ~/Applications.
   Uso: npm run install-app */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import runtimeBundle from '../bundle-runtime.cjs';

const desk=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const root=path.resolve(desk,'..');
const app=path.join(root,'Mesa de Estudos.app');
const dest=path.join(app,'Contents','Resources','app');
const pkg=JSON.parse(fs.readFileSync(path.join(desk,'package.json'),'utf8'));

/* O bundle .app é só macOS: fora dele a Mesa roda de fonte (`npm start`). */
if(process.platform!=='darwin'){
 console.log('Mesa de Estudos.app é um bundle de macOS. Neste sistema rode `npm start` (ou um atalho para `npm start` na pasta desk/).');
 process.exit(0);
}

if(!fs.existsSync(app))throw new Error('Mesa de Estudos.app não encontrada — rode npm run setup antes.');

function setPlist(key,value){
 const plist=path.join(app,'Contents','Info.plist');
 try{
  execFileSync('plutil',['-replace',key,'-string',String(value),plist],{stdio:'pipe'});
 }catch{
  execFileSync('plutil',['-insert',key,'-string',String(value),plist],{stdio:'inherit'});
 }
}
setPlist('CFBundleShortVersionString',pkg.version||'0.0.0');

/* 1. Código do app. */
const managed=runtimeBundle.stageBundlePayload(desk,dest);
/* Procedência do bundle: o updater dele (modo bundle) atualiza o clone que o
   originou e re-sincroniza — sem isto não há como voltar à fonte. Fora de um
   clone git não há o que registrar. */
if(fs.existsSync(path.join(root,'.git'))){
 let remote='';
 try{remote=execFileSync('git',['-C',root,'remote','get-url','origin'],{encoding:'utf8'}).trim();}catch{}
 fs.writeFileSync(path.join(dest,'install-source.json'),JSON.stringify({path:root,remote},null,2)+'\n');
}
/* Manifesto da instalação (A1/B1, no espírito do modo zip): o que ESTE payload
   considera gerenciado, gravado no disco. Órfão = estava gerenciado e a
   versão nova não tem — sai do bundle; arquivo local (nunca no manifesto)
   fica. Sem isto, código removido ficava para trás e o app morria. */
let previous=[];
try{previous=JSON.parse(fs.readFileSync(path.join(dest,'.update-manifest.json'),'utf8')).files||[];}catch{}
for(const rel of previous){
 if(managed.includes(rel))continue;
 /* Manifesto é dado do disco: recusa caminho que saia do payload (absoluto,
    `..`) — delete arbitrário por manifesto adulterado não passa. */
 const partes=String(rel).split(/[\\/]/);
 if(typeof rel!=='string'||!rel||partes.some(p=>p===''||p==='..')||path.isAbsolute(String(rel))||/^[a-zA-Z]:/.test(String(rel)))continue;
 fs.rmSync(path.join(dest,...partes),{recursive:true,force:true});
}
fs.writeFileSync(path.join(dest,'.update-manifest.json'),JSON.stringify({version:pkg.version||'',at:new Date().toISOString(),files:managed},null,2)+'\n');

/* 3. Auxiliares fora do payload. */
const helper=path.join(root,'visual-check','windows');
if(fs.existsSync(helper)){
 fs.mkdirSync(path.join(app,'Contents','Resources','visual-check'),{recursive:true});
 fs.copyFileSync(helper,path.join(app,'Contents','Resources','visual-check','windows'));
}
const icns=path.join(desk,'assets','mesa.icns');
if(fs.existsSync(icns))fs.copyFileSync(icns,path.join(app,'Contents','Resources','mesa.icns'));
fs.utimesSync(app,new Date(),new Date());

/* 4. Assinatura (mesma regra da Conversa: certificado se houver, senão ad-hoc). */
function signingIdentity(){
 if(process.env.MESA_SIGN_IDENTITY)return process.env.MESA_SIGN_IDENTITY;
 try{
  const out=execFileSync('security',['find-identity','-v','-p','codesigning'],{encoding:'utf8'});
  const match=out.match(/"([^"]+)"/);
  return match?match[1]:'';
 }catch{return '';}
}
if(process.platform==='darwin'){
 const identity=signingIdentity();
 if(identity){
  execFileSync('codesign',['--force','--deep','--sign',identity,app],{stdio:'inherit'});
  console.log('Assinado com:',identity);
 }else{
  execFileSync('codesign',['--force','--deep','--sign','-',app],{stdio:'inherit'});
  console.log('Aviso: sem certificado de assinatura, o macOS pede a permissão de Gravação de Tela de novo a cada atualização.');
  console.log('Crie um certificado "Assinatura de Código" uma vez (Acesso às Chaves → Assistente de Certificado) — veja SETUP.md.');
 }
}

/* 5. Atalho em ~/Applications + registro no LaunchServices.
   O Finder batiza alias de "«nome» alias"; renomeamos para o nome canônico e removemos
   qualquer variante antiga — sem isso, cada instalação deixava mais um alias para trás. */
const userApps=path.join(process.env.HOME,'Applications');
fs.mkdirSync(userApps,{recursive:true});
const alias=path.join(userApps,'Mesa de Estudos.app');
for(const name of fs.readdirSync(userApps)){
 if(/^Mesa de Estudos\.app( \d+| alias.*)?$/.test(name))fs.rmSync(path.join(userApps,name),{recursive:true,force:true});
}
execFileSync('osascript',['-e',[
 'tell application "Finder"',
 `set a to make alias file to POSIX file ${JSON.stringify(app)} at POSIX file ${JSON.stringify(userApps)}`,
 'set name of a to "Mesa de Estudos.app"',
 'end tell',
].join('\n')]);
execFileSync('/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister',['-f',app]);
console.log('Atualizado:',app);
console.log('Atalho:',alias);
