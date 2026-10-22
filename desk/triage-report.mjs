// @ts-check
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import {doctorChecks,doctorText} from './doctor-checks.mjs';
import {createScrubber,cleanLogLines} from './triage-scrub.mjs';
import {freeZenIds,pickTriageModel} from './triage-free-model.mjs';
import {piModelChoices} from './triage-pi-model.mjs';

/* Coleta do "Relatar um problema" (#62): o ambiente (versões, commit,
   motores), o doctor, o motor e o modelo em uso e as últimas linhas de erro do
   `desk.log`. Nada aqui lê sessão, `auth.json`, chave nem material: só
   versões, o resultado do doctor (que olha existência de arquivo) e o log da
   própria Mesa. O texto sai pelo limpador (`triage-scrub.mjs`) antes de
   qualquer saída. Comandos externos (git, `--version`, `opencode models`)
   entram por `runCommand`, e nos testes por fake com nome. */

const require=createRequire(import.meta.url);
const {courseLibrary}=require('./courses.cjs');
const {resolvePi}=require('./pi.cjs');
const {findOpenCodeLauncher}=require('./src/agents/opencode-process.cjs');
const deskDir=path.dirname(fileURLToPath(import.meta.url));

/** @typedef {(command: string, args: string[], options?: {cwd?: string}) => {status: number | null, stdout: string}} RunCommand */
/** @typedef {{engine: string, model: string}} TriageChoice */
/** @typedef {{name: string, version: string}} TriageEngine */
/**
 * @typedef {{
 *   mesa: string, commit: string, electron: string, os: string, node: string,
 *   engines: TriageEngine[], doctor: string, choices: TriageChoice[], log: string[],
 *   freeModel: import('./triage-free-model.mjs').TriageModel | null, opencode: boolean,
 *   pi: boolean, piModels: string[]
 * }} TriageFacts
 */

/** @type {RunCommand} */
export function runCommand(command,args,{cwd}={}){
 const result=spawnSync(command,args,{cwd,encoding:'utf8',timeout:15000,shell:process.platform==='win32'&&/\.(cmd|bat)$/i.test(command)});
 return {status:result.status,stdout:String(result.stdout||'')};
}

/** @param {RunCommand} run @param {string} command @param {string[]} args @param {string} [cwd] @returns {string} */
function firstLine(run,command,args,cwd){
 try{
  const result=run(command,args,{cwd});
  return result.status===0?String(result.stdout||'').trim().split('\n')[0]:'';
 }catch{return '';}
}

/** @param {string} file @returns {string} */
function packageVersion(file){
 try{return String(JSON.parse(fs.readFileSync(file,'utf8')).version||'');}catch{return '';}
}

/** @param {RunCommand} run @param {string} platform @returns {string} */
function systemLabel(run,platform){
 if(platform==='darwin'){
  const version=firstLine(run,'sw_vers',['-productVersion']);
  return `macOS ${version||os.release()} (${process.arch})`;
 }
 if(platform==='win32')return `Windows ${os.release()} (${process.arch})`;
 return `${os.type()} ${os.release()} (${process.arch})`;
}

/**
 * Pi, Claude Agent SDK e OpenCode, com a versão de quem está instalado.
 * @param {{run: RunCommand, env: NodeJS.ProcessEnv, home: string, config: any}} options
 * @returns {{engines: TriageEngine[], opencodeBin: string, piBin: string}}
 */
function engineVersions({run,env,home,config}){
 const missing='não instalado';
 const pi=resolvePi({configPath:config.piPath,deskDir,envPath:env.LEARNING_DESK_PI||''});
 const sdk=packageVersion(path.join(deskDir,'node_modules','@anthropic-ai','claude-agent-sdk','package.json'));
 const opencodeBin=findOpenCodeLauncher({envPath:env.LEARNING_DESK_OPENCODE||'',home});
 return {opencodeBin,piBin:pi||'',engines:[
  {name:'Pi',version:pi?(firstLine(run,pi,['--version'])||'não respondeu'):missing},
  {name:'Claude Agent SDK',version:sdk||missing},
  {name:'OpenCode',version:opencodeBin?(firstLine(run,opencodeBin,['--version'])||'não respondeu'):missing},
 ]};
}

/**
 * O estado de interface (`desk.json`): só os recentes e favoritos do seletor
 * são lidos dele; nada de sessão.
 * @param {string} runtime
 * @returns {{modelRecents?: unknown, modelFavorites?: unknown}}
 */
function readDeskState(runtime){
 try{
  const state=JSON.parse(fs.readFileSync(path.join(runtime,'desk.json'),'utf8'));
  return state&&typeof state==='object'?{modelRecents:state.modelRecents,modelFavorites:state.modelFavorites}:{};
 }catch{return {};}/* sem desk.json: nenhuma escolha ainda */
}

/**
 * Motor e modelo em uso. Da janela vem a escolha atual; pelo terminal, o
 * primeiro recente de cada motor no estado de interface.
 * @param {{modelRecents?: unknown}} state @param {TriageChoice | null} current
 * @returns {TriageChoice[]}
 */
function readChoices(state,current){
 if(current?.engine)return [{engine:String(current.engine),model:String(current.model||'')}];
 const recents=state.modelRecents;
 if(!recents||typeof recents!=='object')return [];
 return Object.entries(recents)
  .filter(([,pairs])=>Array.isArray(pairs)&&Array.isArray(pairs[0]))
  .map(([engine,pairs])=>({engine,model:pairs[0].map(String).join('/')}));
}

/** @param {string} runtime @returns {string} */
function readDeskLog(runtime){
 const read=file=>{try{return fs.readFileSync(file,'utf8');}catch{return '';}};
 return read(path.join(runtime,'desk.log.1'))+read(path.join(runtime,'desk.log'));
}

/**
 * Pastas do vault (até `Courses/*`): o nome de uma matéria que a Mesa ainda não
 * reconhece também é pessoal.
 * @param {string} vault
 * @returns {string[]}
 */
function vaultFolderNames(vault){
 const folders=dir=>{try{return fs.readdirSync(dir,{withFileTypes:true}).filter(entry=>entry.isDirectory()).map(entry=>entry.name);}catch{return [];}};
 if(!vault)return [];
 return [...folders(vault),...folders(path.join(vault,'Courses'))].filter(name=>!name.startsWith('.')&&name!=='Courses');
}

/**
 * O que é pessoal nesta máquina: casa, runtime, vault, matérias e PDFs.
 * @param {import('./doctor-checks.mjs').DoctorContext} context @param {string} home
 * @returns {(text: string) => string}
 */
function profileScrubber({runtime,vault,courses},home){
 const paths=[{text:runtime,label:'<runtime>'},{text:vault,label:'<vault>'}];
 const names=[];
 courses.forEach((course,at)=>{
  const label=`<matéria ${at+1}>`;
  paths.push({text:course.path,label});
  for(const text of [course.name,course.id,path.basename(course.path||'')])names.push({text,label});
  for(const pdf of courseLibrary(course.path)){
   names.push({text:pdf.name,label:'<pdf>'},{text:pdf.name.replace(/\.pdf$/i,''),label:'<pdf>'});
  }
 });
 for(const text of vaultFolderNames(vault))names.push({text,label:'<pasta>'});
 return createScrubber({home,paths,names});
}

/**
 * Junta os fatos da triagem, já limpos.
 * @param {{env?: NodeJS.ProcessEnv, home?: string, platform?: string, run?: RunCommand,
 *   choice?: TriageChoice | null, electron?: string, logLimit?: number}} [options]
 * @returns {{facts: TriageFacts, scrub: (text: string) => string}}
 * @example const {facts}=collectTriage({choice: {engine: 'pi', model: 'xai/grok-4'}});
 */
export function collectTriage({env=process.env,home=os.homedir(),platform=process.platform,run=runCommand,choice=null,electron='',logLimit=20}={}){
 const {rows,context}=doctorChecks({env,home});
 const scrub=profileScrubber(context,home);
 const {engines,opencodeBin,piBin}=engineVersions({run,env,home,config:context.config});
 const state=readDeskState(context.runtime);
 const models=opencodeBin?commandOutput(run,opencodeBin,['models','opencode']):'';
 const facts={
  mesa:packageVersion(path.join(deskDir,'package.json')),
  commit:firstLine(run,'git',['describe','--always','--dirty'],path.dirname(deskDir))||'fora de um clone git',
  electron:electron||packageVersion(path.join(deskDir,'node_modules','electron','package.json'))||'não instalado',
  os:systemLabel(run,platform),
  node:process.version,
  engines:engines.map(engine=>({name:engine.name,version:scrub(engine.version)})),
  doctor:scrub(doctorText(rows)),
  choices:readChoices(state,choice).map(item=>({engine:scrub(item.engine),model:scrub(item.model)})),
  log:cleanLogLines(readDeskLog(context.runtime),{scrub,limit:logLimit}),
  freeModel:opencodeBin?pickTriageModel(freeZenIds(models)):null,
  opencode:!!opencodeBin,
  pi:!!piBin,
  piModels:piModelChoices({current:choice,state}).map(scrub),
 };
 return {facts,scrub};
}

/** @param {RunCommand} run @param {string} command @param {string[]} args @returns {string} */
function commandOutput(run,command,args){
 try{const result=run(command,args);return result.status===0?String(result.stdout||''):'';}catch{return '';}
}

/**
 * O relatório em Markdown, do jeito que a pessoa lê e que vai para a issue.
 * @param {TriageFacts} facts
 * @returns {string}
 * @example reportText(facts).startsWith('## Ambiente') // true
 */
export function reportText(facts){
 const engines=facts.engines.map(engine=>`- ${engine.name}: ${engine.version}`);
 const choices=facts.choices.length?facts.choices.map(item=>`- ${item.engine}: ${item.model||'(sem modelo escolhido)'}`):['- (nenhum registrado)'];
 const log=facts.log.length?facts.log:['(sem erros recentes)'];
 return [
  '## Ambiente',
  `- Mesa: ${facts.mesa} (commit ${facts.commit})`,
  `- Electron: ${facts.electron}`,
  `- Sistema: ${facts.os}`,
  `- Node: ${facts.node}`,
  '',
  '## Motores',
  ...engines,
  '',
  '## Motor e modelo em uso',
  ...choices,
  '',
  '## Doctor',
  '```',
  facts.doctor,
  '```',
  '',
  `## Últimos erros do desk.log (${facts.log.length})`,
  '```',
  ...log,
  '```',
 ].join('\n');
}
