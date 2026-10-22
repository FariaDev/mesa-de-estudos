/* Instala/atualiza o bundle Mesa de Estudos.app (espelhava o script da Conversa, aposentada na #50).
   - Sincroniza o código em Contents/Resources/app: .cjs/.mjs, src/, assets/, templates/, locales/ e
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
const pkg=JSON.parse(fs.readFileSync(path.join(desk,'package.json'),'utf8'));

/* O bundle .app é só macOS: fora dele a Mesa roda de fonte (`npm start`). */
if(process.platform!=='darwin'){
 console.log('Mesa de Estudos.app é um bundle de macOS. Neste sistema rode `npm start` (ou um atalho para `npm start` na pasta desk/).');
 process.exit(0);
}

if(!fs.existsSync(app))throw new Error('Mesa de Estudos.app não encontrada — rode npm run setup antes.');

/* 1–3. Código, manifesto e auxiliares: a mesma rotina que o teste do app
   empacotado (#51) usa numa pasta temporária, sem o atalho nem a assinatura. */
runtimeBundle.installBundle({desk,root,app,version:pkg.version||''});

/* 4. Assinatura (mesma regra que a Conversa seguia: certificado se houver, senão ad-hoc). */
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
