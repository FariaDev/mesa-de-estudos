// @ts-check
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';

/* Checagens do `npm run doctor`, numa fonte só para o próprio doctor
   (`scripts/doctor.mjs`, que só imprime) e para o "Relatar um problema" (#62),
   que mostra o resultado no relatório limpo. Mora em `desk/` (e não em
   `scripts/`) porque o app instalado também roda a triagem e o pacote só leva
   os módulos da raiz de `desk/`. */

const require=createRequire(import.meta.url);
const {readConfig,seedConfig}=require('./config.cjs');
const {mergeCourses,courseLibrary}=require('./courses.cjs');
const {detectTutorEngines,engineNames,defaultEngineFrom,ENGINE_NAMES}=require('./tutor-default-engine.cjs');
const {visibleEngines}=require('./visible-engines.cjs');
const desk=path.dirname(fileURLToPath(import.meta.url));
const repo=path.dirname(desk);

/** @typedef {{name: string, ok: boolean, detail: string}} DoctorRow */
/** @typedef {{config: any, configPath: string, runtime: string, vault: string, courses: Array<{id: string, name: string, path: string}>}} DoctorContext */

/**
 * Onde a Mesa guarda config e runtime, do jeito que o doctor sempre leu.
 * @param {{env?: NodeJS.ProcessEnv, home?: string}} [options]
 * @returns {DoctorContext}
 * @example doctorContext().runtime // '~/Library/Application Support/Mesa de Estudos/runtime'
 */
export function doctorContext({env=process.env,home=os.homedir()}={}){
 const configDir=env.LEARNING_DESK_RUNTIME||(process.platform==='win32'?path.join(env.APPDATA||'', 'Mesa de Estudos'):path.join(home,'Library','Application Support','Mesa de Estudos'));
 const configPath=path.join(configDir,'config.json');
 const config=readConfig(configPath)||seedConfig({runtimePath:env.LEARNING_DESK_RUNTIME||''});
 if(env.LEARNING_VAULT)config.vaultPath=env.LEARNING_VAULT;
 const runtime=env.LEARNING_DESK_RUNTIME||config.runtimePath||path.join(path.dirname(configPath),'runtime');
 return {config,configPath,runtime,vault:config.vaultPath||'',courses:mergeCourses(config)};
}

/** @param {DoctorRow[]} rows @param {NodeJS.ProcessEnv} env @param {any} config @param {string} home */
function checkSetup(rows,env,config,home){
 const check=(name,ok,detail)=>rows.push({name,ok:!!ok,detail:String(detail??'')});
 const [nodeMajor]=process.versions.node.split('.').map(Number);
 /* Node só é exigência do setup a partir do código; o app e o MCP rodam no
    Node do Electron (#93). */
 check('Node 20+ (setup a partir do código)',nodeMajor>=20,process.version);
 const dependenciesReady=fs.existsSync(path.join(desk,'node_modules','electron'));
 check('Dependências da Mesa',dependenciesReady,dependenciesReady?'instaladas':'rode npm ci');
 const all=detectTutorEngines({config,deskDir:desk,env,home,testMode:false});
 const shown=visibleEngines({testMode:false,env});
 const engines=Object.fromEntries(Object.entries(all).filter(([id])=>shown.includes(id)));
 const labels=engineNames(engines);
 check('Tutor instalado',labels.length>0,labels.length?`${labels.join(', ')} (padrão: ${ENGINE_NAMES[defaultEngineFrom(engines)]})`:'instale o OpenCode na primeira abertura (ou use o Claude Code que já existe)');
}

/** @param {DoctorRow[]} rows @param {DoctorContext} context */
function checkVault(rows,{vault,courses,runtime}){
 const check=(name,ok,detail)=>rows.push({name,ok:!!ok,detail:String(detail??'')});
 check('Vault / pasta de dados',vault&&fs.existsSync(vault),vault||'não configurado');
 for(const name of ['TUTOR.md','LEARNER.md'])check(`Política ${name}`,vault&&fs.existsSync(path.join(vault,name)),vault?path.join(vault,name):'vault não configurado');
 check('Capturador visual',process.platform!=='darwin'||fs.existsSync(path.join(repo,'visual-check','windows')),process.platform==='darwin'?path.join(repo,'visual-check','windows'):'não se aplica neste sistema');
 check('Matérias configuradas',courses.length>0,`${courses.length} encontrada(s)`);
 for(const course of courses){
  const sourceCount=courseLibrary(course.path).length;
  check(`Fontes · ${course.name}`,sourceCount>0,`${sourceCount} PDF(s) acessível(is)`);
 }
 let persistence=false,why=runtime;
 try{fs.mkdirSync(runtime,{recursive:true});const probe=path.join(runtime,`.doctor-${process.pid}`);fs.writeFileSync(probe,'ok');fs.unlinkSync(probe);persistence=true;}catch(e){why=e.message;}
 check('Persistência da Mesa',persistence,why);
}

/* --- Ambiente: o temporário e o git que o updater e o verify usam --- */
/** @param {DoctorRow[]} rows @param {DoctorContext} _context @param {NodeJS.ProcessEnv} env */
function checkProfile(rows,_context,env){
 const check=(name,ok,detail)=>rows.push({name,ok:!!ok,detail:String(detail??'')});
 let tempOk=false,tempWhy=os.tmpdir();
 try{const probe=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'mesa-doctor-')),'.probe');fs.writeFileSync(probe,'ok');fs.rmSync(path.dirname(probe),{recursive:true,force:true});tempOk=true;}catch(e){tempWhy=e.message;}
 check('Diretório temporário gravável',tempOk,tempWhy);
 const PATH_DIRS=(env.PATH||'').split(path.delimiter).filter(Boolean);
 const GIT_NAMES=process.platform==='win32'?['git.exe','git.cmd','git']:['git'];
 const git=PATH_DIRS.flatMap(dir=>GIT_NAMES.map(name=>path.join(dir,name))).find(p=>{try{return fs.existsSync(p);}catch{return false;}});
 check('Executável git',git,git||'não encontrado no PATH — o updater por git e o verify o usam');
}

/**
 * Roda todas as checagens do doctor e devolve as linhas, sem imprimir.
 * @param {{env?: NodeJS.ProcessEnv, home?: string}} [options]
 * @returns {{rows: DoctorRow[], context: DoctorContext}}
 * @example const {rows}=doctorChecks(); rows.filter(r=>!r.ok).length // 0 com o setup pronto
 */
export function doctorChecks({env=process.env,home=os.homedir()}={}){
 const context=doctorContext({env,home});
 /** @type {DoctorRow[]} */
 const rows=[];
 checkSetup(rows,env,context.config,home);
 checkVault(rows,context);
 checkProfile(rows,context,env);
 return {rows,context};
}

/**
 * As linhas no formato que o `npm run doctor` sempre imprimiu.
 * @param {DoctorRow[]} rows
 * @returns {string}
 * @example doctorText([{name:'Node 20+ (setup a partir do código)',ok:true,detail:'v20.0.0'}]) // '✓ Node 20+ (setup a partir do código): v20.0.0\n\nSetup learning pronto.'
 */
export function doctorText(rows){
 const lines=rows.map(row=>`${row.ok?'✓':'✗'} ${row.name}: ${row.detail}`);
 const failed=rows.filter(r=>!r.ok);
 return `${lines.join('\n')}\n\n${failed.length?`${failed.length} verificação(ões) precisa(m) de atenção.`:'Setup learning pronto.'}`;
}
