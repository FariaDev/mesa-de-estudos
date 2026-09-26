import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const {readConfig,seedConfig}=require('../config.cjs');
const {mergeCourses,courseLibrary}=require('../courses.cjs');
const {resolvePi}=require('../pi.cjs');
const profile=require('../profiles.cjs');
const handoff=require('../handoff.cjs');
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

/* --- Perfil e permissões: o que a sessão vai carregar e o que ela pode fazer ---
   O portão em si (bloqueio antes da execução) mora no workspace-guard; aqui o
   objetivo é tornar visível o que ele vai aplicar, para que uma superfície de
   permissão quebrada apareça no doctor em vez de só no log da sessão. */
const agentDir=path.join(os.homedir(),'.pi','agent');
const settingsPath=path.join(agentDir,'settings.json');
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
for(const pkg of profile.PACKAGES){
 const declared=profile.declaredPackages(settingsPath).includes(pkg);
 /* Sem o pacote nas settings o perfil fixado derruba as integrações MCP junto. */
 check(`Pacote exigido · ${pkg}`,declared,declared?settingsPath:`falta em ${settingsPath} — o perfil fixado não carrega`);
}
const mcpPath=path.join(agentDir,'mcp.json');
let mcpCount=0;
try{mcpCount=Object.keys(JSON.parse(fs.readFileSync(mcpPath,'utf8'))?.mcpServers||{}).length;}catch{}
check('Integrações MCP declaradas',fs.existsSync(mcpPath)&&mcpCount>0,`${mcpCount} servidor(es) em ${mcpPath}`);
const guardExt=path.join(agentDir,'extensions','workspace-guard','index.ts');
check('Guard antes da execução',fs.existsSync(guardExt),guardExt);
const codeGuard=vault&&path.join(vault,'.pi','extensions','code-study-guard.ts');
check('Guard de estudo de código',codeGuard&&fs.existsSync(codeGuard),codeGuard||'overlay não encontrado');
let tempOk=false,tempWhy=os.tmpdir();
try{const probe=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'mesa-doctor-')),'.probe');fs.writeFileSync(probe,'ok');fs.rmSync(path.dirname(probe),{recursive:true,force:true});tempOk=true;}catch(e){tempWhy=e.message;}
check('Diretório temporário gravável',tempOk,tempWhy);
/* PATH pode não existir (ambiente enxuto) e o git tem outro nome no Windows. */
const PATH_DIRS=(process.env.PATH||'').split(path.delimiter).filter(Boolean);
const GIT_NAMES=process.platform==='win32'?['git.exe','git.cmd','git']:['git'];
const git=PATH_DIRS.flatMap(dir=>GIT_NAMES.map(name=>path.join(dir,name))).find(p=>{try{return fs.existsSync(p);}catch{return false;}});
check('Executável git',git,git||'não encontrado no PATH — o updater por git e o verify o usam');

/* Bilhete da Conversa → Mesa. O caminho é contrato entre os dois apps: se o
   runtime não for gravável, a Conversa diz "levado" e a Mesa nunca recebe —
   falha silenciosa, exatamente o tipo que o doctor existe para pegar.
   Fase deixada por uma execução anterior aparece aqui porque o destino depende
   do que ela significa: `reivindicado-*` (o envio não começou) volta para a
   fila, `enviando-*` (envio iniciado sem confirmação) vai para `duvida/` e não
   é reenviado sozinho. */
const bilhete=handoff.readHandoff({runtime});
const bilheteDir=handoff.handoffDir(runtime);
let bilheteOk=false,bilheteDetail=bilheteDir;
try{
 fs.mkdirSync(bilheteDir,{recursive:true});
 const probe=path.join(bilheteDir,`.doctor-${process.pid}`);
 fs.writeFileSync(probe,'ok');
 fs.unlinkSync(probe);
 bilheteOk=true;
 const fases=fs.readdirSync(bilheteDir);
 const pendentes=fases.filter(n=>n.startsWith(handoff.CLAIM_PREFIX)).length;
 const enviando=fases.filter(n=>n.startsWith(handoff.SENDING_PREFIX)).length;
 const arquivados=fs.existsSync(handoff.archiveDir(runtime))?fs.readdirSync(handoff.archiveDir(runtime)).length:0;
 const duvidas=fs.existsSync(handoff.doubtDir(runtime))?fs.readdirSync(handoff.doubtDir(runtime)).length:0;
 const partes=[
  bilhete.bilhete?`pendente: ${(bilhete.bilhete.goal||bilhete.bilhete.question).slice(0,60)}`:'nada pendente',
  pendentes?`${pendentes} reivindicado(s) de execução anterior (volta à fila)`:'',
  enviando?`${enviando} envio(s) interrompido(s) — vai para dúvida, sem reenvio`:'',
  duvidas?`${duvidas} em dúvida (confira antes de reenviar)`:'',
  arquivados?`${arquivados} arquivado(s)`:'',
 ];
 bilheteDetail=`${bilheteDir} · ${partes.filter(Boolean).join(' · ')}`;
}catch(e){bilheteDetail=e.message;}
check('Bilhete Conversa → Mesa',bilheteOk,bilheteDetail);

for(const row of rows)console.log(`${row.ok?'✓':'✗'} ${row.name}: ${row.detail}`);
const failed=rows.filter(r=>!r.ok);
console.log(`\n${failed.length?`${failed.length} verificação(ões) precisa(m) de atenção.`:'Setup learning pronto.'}`);
if(failed.length)process.exitCode=1;
