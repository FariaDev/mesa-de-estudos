import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import {offerGeogebraOffline} from './geogebra-offline.mjs';
import {enableRepoHooks,hooksMessage} from './git-hooks.mjs';
import {ensureElectronBinary} from './electron-binary.mjs';
import {ensureVisualHelper} from './visual-helper.mjs';
import os from 'node:os';

const require=createRequire(import.meta.url);
const {detectTutorEngines,engineNames,defaultEngineFrom,ENGINE_NAMES}=require('../tutor-default-engine.cjs');
const {filterDetected}=require('../visible-engines.cjs');

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
/* Electron 45 baixa o binário só quando pedido; o setup pede antes da primeira janela. */
try{ensureElectronBinary({electronDir:path.join(desk,'node_modules','electron')});}
catch(error){fail(error.message);process.exit(1);}

if(ensureVisualHelper({root:path.resolve(desk,'..')})==='failed')fail('Não foi possível compilar a integração visual. Instale as Command Line Tools do Xcode e rode npm run setup novamente.');

/* O setup não instala motor nenhum. Sem o OpenCode, a primeira abertura da
   Mesa o instala. */
/* Mesma vista do app: o motor oculto neste release não vira "padrão" no setup. */
const engines=filterDetected(detectTutorEngines({config:{},deskDir:desk,env:process.env,testMode:false}),{testMode:false,env:process.env});
const engineLabels=engineNames(engines);
const preferredEngine=defaultEngineFrom(engines);
if(!engineLabels.length)log('Nenhum tutor encontrado. A Mesa abre e instala o OpenCode na primeira abertura.');

/* GeoGebra offline (#55): opcional. --geogebra aceita a licença sem perguntar,
   --no-geogebra pula; sem terminal, pula. Falhar aqui não derruba o setup. */
const geogebraFlag=process.argv.includes('--geogebra')?'yes':process.argv.includes('--no-geogebra')?'no':'ask';
await offerGeogebraOffline({choice:geogebraFlag});

const repoRoot=path.resolve(desk,'..');
const bendInstalled=fs.existsSync(path.join(process.env.BEND_HOME||path.join(os.homedir(),'.bend'),'current'));
const hooks=enableRepoHooks({root:repoRoot,bendInstalled,git:(args)=>spawnSync('git',args,{cwd:repoRoot,encoding:'utf8'})});
if(hooksMessage(hooks))log(hooksMessage(hooks));

fs.mkdirSync(starter,{recursive:true});
for(const name of ['TUTOR.md','LEARNER.md']){
 const dest=path.join(starter,name);
 if(!fs.existsSync(dest))fs.copyFileSync(path.join(templates,name),dest);
}

log('');
log('Pronto.');
log(engineLabels.length?`Tutor: ${engineLabels.join(', ')} (padrão: ${ENGINE_NAMES[preferredEngine]}).`:'Tutor: nenhum encontrado — a Mesa abre, mas o tutor só conversa depois de instalar um.');

log('Kit inicial: '+starter);
log('');
log('Próximos passos:');
log('  1. npm start');
log('  2. Na primeira abertura, escolha a pasta de dados e pelo menos uma matéria (nome + pasta de PDFs).');
log('  3. O motor escolhido pede as credenciais na primeira conexão (ficam nele, não na Mesa).');
log('  4. Windows: Conferir Xournal++ não está disponível; PDFs, calculadora e tutor funcionam.');
if(process.platform==='darwin')log('  5. Mac (opcional): npm run install-app monta o Mesa de Estudos.app ao lado de desk/.');
