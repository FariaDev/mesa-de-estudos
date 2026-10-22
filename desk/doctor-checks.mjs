// @ts-check
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';

/* Checagens do `npm run doctor`, numa fonte só para o próprio doctor
   (`scripts/doctor.mjs`, que só imprime) e para o "Relatar um problema" (#62),
   que mostra o resultado no relatório limpo. Mora em `desk/` (e não em
   `scripts/`) porque o app instalado também roda a triagem e o pacote só leva
   os módulos da raiz de `desk/`. */

const require=createRequire(import.meta.url);
const {readConfig,seedConfig}=require('./config.cjs');
const {mergeCourses,courseLibrary}=require('./courses.cjs');
const {resolvePi}=require('./pi.cjs');
const profile=require('./profiles.cjs');
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

/** @param {DoctorRow[]} rows @param {NodeJS.ProcessEnv} env @param {any} config */
function checkSetup(rows,env,config){
 const check=(name,ok,detail)=>rows.push({name,ok:!!ok,detail:String(detail??'')});
 const [nodeMajor,nodeMinor]=process.versions.node.split('.').map(Number);
 check('Node 22.19+',nodeMajor>22||(nodeMajor===22&&nodeMinor>=19),process.version);
 const dependenciesReady=fs.existsSync(path.join(desk,'node_modules','electron'));
 check('Dependências da Mesa',dependenciesReady,dependenciesReady?'instaladas':'rode npm ci');
 const pi=resolvePi({configPath:config.piPath,deskDir:desk,envPath:env.LEARNING_DESK_PI||''});
 check('Executável do Pi',pi,pi||'rode npm run setup ou configure o caminho');
 if(!pi)return;
 const result=spawnSync(pi,['--version'],{encoding:'utf8',timeout:10000,shell:process.platform==='win32'&&/\.(cmd|bat)$/i.test(pi)});
 const version=String(result.stdout||'').trim();
 const [major,minor,patch]=version.split('.').map(Number);
 check('Pi 0.99.1+ (MCP nativo)',result.status===0&&Number.isInteger(major)&&(major>0||minor>99||(minor===99&&patch>=1)),version||'não respondeu; atualize o Pi');
}

/** @param {string} overlay @param {NodeJS.ProcessEnv} env @param {string} home @returns {{ok: boolean, detail: string}} */
function visualExtension(overlay,env,home){
 const extension=overlay&&path.join(overlay,'extensions','visual-check.ts');
 if(!extension||!fs.existsSync(extension))return {ok:false,detail:'reexportação não encontrada'};
 const text=fs.readFileSync(extension,'utf8');
 const envShim=text.match(/LEARNING_CANVAS_DIR[\s\S]*?\),\s*["']([^"']+)["']\)/);
 const match=envShim||text.match(/export\s+\{[^}]*\}\s+from\s+["']([^"']+)["']/)||text.match(/resolve\(dirname\([^)]*\),\s*["']([^"']+)["']\)/);
 if(envShim){
  const base=env.LEARNING_CANVAS_DIR||path.join(home,'Developer','learning-canvas');
  const target=path.join(base,envShim[1]);
  return {ok:fs.existsSync(target),detail:target};
 }
 if(!match)return {ok:false,detail:'reexportação não encontrada'};
 const target=path.resolve(path.dirname(extension),match[1]);
 // O jiti do Pi resolve relativos a partir do caminho virtual (simbólico), então o
 // alvo só é seguro se estiver dentro do overlay, for absoluto ou vier de realpath em runtime.
 const root=path.resolve(overlay);
 const escapes=!target.startsWith(root+path.sep);
 const safe=path.isAbsolute(match[1])||/realpathSync/.test(text);
 const ok=fs.existsSync(target)&&(!escapes||safe);
 return {ok,detail:ok?target:`${target} (re-export relativo quebra quando o .pi é simbólico; resolva via realpath em runtime ou caminho absoluto)`};
}

/** @param {DoctorRow[]} rows @param {DoctorContext} context @param {NodeJS.ProcessEnv} env @param {string} home */
function checkVault(rows,{vault,courses,runtime},env,home){
 const check=(name,ok,detail)=>rows.push({name,ok:!!ok,detail:String(detail??'')});
 check('Vault / pasta de dados',vault&&fs.existsSync(vault),vault||'não configurado');
 for(const name of ['TUTOR.md','LEARNER.md'])check(`Política ${name}`,vault&&fs.existsSync(path.join(vault,name)),vault?path.join(vault,name):'vault não configurado');
 const overlay=vault&&path.join(vault,'.pi');
 check('Overlay .pi',overlay&&fs.existsSync(overlay),overlay||'vault não configurado');
 const visual=visualExtension(overlay,env,home);
 check('Extensão visual',visual.ok,visual.detail);
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

/* --- Perfil e permissões: o que a sessão vai carregar e o que ela pode fazer ---
   O portão em si (bloqueio antes da execução) mora no workspace-guard; aqui o
   objetivo é tornar visível o que ele vai aplicar, para que uma superfície de
   permissão quebrada apareça no doctor em vez de só no log da sessão. */
/** @param {DoctorRow[]} rows @param {DoctorContext} context @param {NodeJS.ProcessEnv} env @param {string} home */
function checkProfile(rows,{config,vault},env,home){
 const check=(name,ok,detail)=>rows.push({name,ok:!!ok,detail:String(detail??'')});
 const agentDir=path.join(home,'.pi','agent');
 const profileOn=config.desk?.pinnedExtensions!==false;
 const declaredPaths=profile.globalExtensionPaths();
 const presentPaths=declaredPaths.filter(f=>fs.existsSync(f));
 const overlayCount=profile.overlayExtensionPaths([vault&&path.join(vault,'.pi')]).length;
 if(!profileOn){
  check('Perfil de carregamento',true,'perfil herdado (desk.pinnedExtensions: false)');
 }else{
  const missing=declaredPaths.filter(f=>!fs.existsSync(f));
  check('Perfil de carregamento',missing.length===0,`${presentPaths.length}/${declaredPaths.length} extensões globais + ${overlayCount} do overlay${missing.length?` · ausentes: ${missing.map(f=>path.basename(path.dirname(f))).join(', ')}`:''}`);
 }
 const mcpPath=path.join(agentDir,'mcp.json');
 let mcpCount=0;
 try{mcpCount=Object.keys(JSON.parse(fs.readFileSync(mcpPath,'utf8'))?.mcpServers||{}).length;}catch{/* sem mcp.json: zero servidores */}
 check('Integrações MCP declaradas',fs.existsSync(mcpPath)&&mcpCount>0,`${mcpCount} servidor(es) em ${mcpPath}`);
 const guardExt=path.join(agentDir,'extensions','workspace-guard','index.ts');
 check('Guard antes da execução',fs.existsSync(guardExt),guardExt);
 const codeGuard=vault&&path.join(vault,'.pi','extensions','code-study-guard.ts');
 check('Guard de estudo de código',codeGuard&&fs.existsSync(codeGuard),codeGuard||'overlay não encontrado');
 let tempOk=false,tempWhy=os.tmpdir();
 try{const probe=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'mesa-doctor-')),'.probe');fs.writeFileSync(probe,'ok');fs.rmSync(path.dirname(probe),{recursive:true,force:true});tempOk=true;}catch(e){tempWhy=e.message;}
 check('Diretório temporário gravável',tempOk,tempWhy);
 /* PATH pode não existir (ambiente enxuto) e o git tem outro nome no Windows. */
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
 checkSetup(rows,env,context.config);
 checkVault(rows,context,env,home);
 checkProfile(rows,context,env,home);
 return {rows,context};
}

/**
 * As linhas no formato que o `npm run doctor` sempre imprimiu.
 * @param {DoctorRow[]} rows
 * @returns {string}
 * @example doctorText([{name:'Node 22.19+',ok:true,detail:'v22.19.0'}]) // '✓ Node 22.19+: v22.19.0\n\nSetup learning pronto.'
 */
export function doctorText(rows){
 const lines=rows.map(row=>`${row.ok?'✓':'✗'} ${row.name}: ${row.detail}`);
 const failed=rows.filter(r=>!r.ok);
 return `${lines.join('\n')}\n\n${failed.length?`${failed.length} verificação(ões) precisa(m) de atenção.`:'Setup learning pronto.'}`;
}
