import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const {readConfig,seedConfig}=require('../config.cjs');
const {mergeCourses,courseLibrary}=require('../courses.cjs');
const {resolvePi}=require('../pi.cjs');
const desk=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const repo=path.dirname(desk);
const configDir=process.env.LEARNING_DESK_RUNTIME||(process.platform==='win32'?path.join(process.env.APPDATA||'', 'Mesa de Estudos'):path.join(os.homedir(),'Library','Application Support','Mesa de Estudos'));
const configPath=path.join(configDir,'config.json');
const config=readConfig(configPath)||seedConfig({runtimePath:process.env.LEARNING_DESK_RUNTIME||''});
if(process.env.LEARNING_VAULT)config.vaultPath=process.env.LEARNING_VAULT;
const runtime=process.env.LEARNING_DESK_RUNTIME||config.runtimePath||path.join(path.dirname(configPath),'runtime');
const rows=[];
const check=(name,ok,detail)=>rows.push({name,ok:!!ok,detail});

const [nodeMajor,nodeMinor]=process.versions.node.split('.').map(Number);
check('Node 22.19+',nodeMajor>22||(nodeMajor===22&&nodeMinor>=19),process.version);
const dependenciesReady=fs.existsSync(path.join(desk,'node_modules','electron'));
check('Dependências da Mesa',dependenciesReady,dependenciesReady?'instaladas':'rode npm ci');
const pi=resolvePi({configPath:config.piPath,deskDir:desk,envPath:process.env.LEARNING_DESK_PI||''});
check('Executável do Pi',pi,pi||'rode npm run setup ou configure o caminho');
const vault=config.vaultPath;
check('Vault / pasta de dados',vault&&fs.existsSync(vault),vault||'não configurado');
for(const name of ['TUTOR.md','LEARNER.md'])check(`Política ${name}`,vault&&fs.existsSync(path.join(vault,name)),vault?path.join(vault,name):'vault não configurado');
const overlay=vault&&path.join(vault,'.pi');
check('Overlay .pi',overlay&&fs.existsSync(overlay),overlay||'vault não configurado');
const extension=overlay&&path.join(overlay,'extensions','visual-check.ts');
let visualTarget='',visualOk=false,visualDetail='reexportação não encontrada';
if(extension&&fs.existsSync(extension)){
 const text=fs.readFileSync(extension,'utf8');
 const match=text.match(/export\s+\{[^}]*\}\s+from\s+["']([^"']+)["']/)||text.match(/resolve\(dirname\([^)]*\),\s*["']([^"']+)["']\)/);
 if(match){
  visualTarget=path.resolve(path.dirname(extension),match[1]);
  // O jiti do Pi resolve relativos a partir do caminho virtual (simbólico), então o
  // alvo só é seguro se estiver dentro do overlay, for absoluto ou vier de realpath em runtime.
  const root=path.resolve(overlay);
  const escapes=!visualTarget.startsWith(root+path.sep);
  const safe=path.isAbsolute(match[1])||/realpathSync/.test(text);
  visualOk=fs.existsSync(visualTarget)&&(!escapes||safe);
  visualDetail=visualOk?visualTarget:`${visualTarget} (re-export relativo quebra quando o .pi é simbólico; resolva via realpath em runtime ou caminho absoluto)`;
 }
}
check('Extensão visual',visualOk,visualDetail);
check('Capturador visual',process.platform!=='darwin'||fs.existsSync(path.join(repo,'visual-check','windows')),process.platform==='darwin'?path.join(repo,'visual-check','windows'):'não se aplica neste sistema');
const courses=mergeCourses(config);
check('Matérias configuradas',courses.length>0,`${courses.length} encontrada(s)`);
for(const course of courses){
 const sourceCount=courseLibrary(course.path).length;
 check(`Fontes · ${course.name}`,sourceCount>0,`${sourceCount} PDF(s) acessível(is)`);
}
let persistence=false,why=runtime;
try{fs.mkdirSync(runtime,{recursive:true});const probe=path.join(runtime,`.doctor-${process.pid}`);fs.writeFileSync(probe,'ok');fs.unlinkSync(probe);persistence=true;}catch(e){why=e.message;}
check('Persistência da Mesa',persistence,why);

for(const row of rows)console.log(`${row.ok?'✓':'✗'} ${row.name}: ${row.detail}`);
const failed=rows.filter(r=>!r.ok);
console.log(`\n${failed.length?`${failed.length} verificação(ões) precisa(m) de atenção.`:'Setup learning pronto.'}`);
if(failed.length)process.exitCode=1;
