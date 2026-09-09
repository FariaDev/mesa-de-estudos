import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';

const require=createRequire(import.meta.url);
const {resolvePi}=require('../pi.cjs');

const desk=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const templates=path.join(desk,'templates');
const starter=path.join(desk,'.runtime','starter');

function log(msg){console.log(msg);}
function fail(msg){console.error(msg);process.exitCode=1;}

const major=Number(process.versions.node.split('.')[0]);
if(major<20){
 fail('Node 20 ou mais novo é necessário. Versão atual: '+process.version);
 process.exit(1);
}

if(!fs.existsSync(path.join(desk,'node_modules','electron'))){
 log('Instalando dependências (npm ci)…');
 const r=spawnSync('npm',['ci'],{cwd:desk,stdio:'inherit',shell:process.platform==='win32'});
 if(r.status){fail('npm ci falhou.');process.exit(r.status);}
}

let pi=resolvePi({deskDir:desk,envPath:process.env.LEARNING_DESK_PI||''});
if(!pi){
 log('Pi não encontrado. Instalando @earendil-works/pi-coding-agent localmente…');
 let r=spawnSync('npm',['install','@earendil-works/pi-coding-agent'],{cwd:desk,stdio:'inherit',shell:process.platform==='win32'});
 if(r.status){
  log('Pacote @earendil-works/pi-coding-agent indisponível. Tentando @mariozechner/pi-coding-agent…');
  r=spawnSync('npm',['install','@mariozechner/pi-coding-agent'],{cwd:desk,stdio:'inherit',shell:process.platform==='win32'});
 }
 if(r.status)fail('Não foi possível instalar o Pi. Instale-o depois ou indique o caminho em Configurações.');
 pi=resolvePi({deskDir:desk});
}

fs.mkdirSync(starter,{recursive:true});
for(const name of ['TUTOR.md','LEARNER.md']){
 const dest=path.join(starter,name);
 if(!fs.existsSync(dest))fs.copyFileSync(path.join(templates,name),dest);
}

log('');
log('Pronto.');
if(pi)log('Pi: '+pi);
else log('Pi ainda não está no PATH. Abra Configurações e indique o executável.');
log('Kit inicial: '+starter);
log('');
log('Próximos passos:');
log('  1. npm start');
log('  2. Na primeira abertura, escolha a pasta de dados e pelo menos uma matéria (nome + pasta de PDFs).');
log('  3. O Pi pede as credenciais do provedor na primeira conexão (ficam no Pi, não na Mesa).');
log('  4. Windows: Conferir Xournal++ não está disponível; PDFs, calculadora e Pi funcionam.');
if(process.platform==='darwin')log('  5. Mac (opcional): npm run install-app se Mesa de Estudos.app já existir ao lado de desk/.');
