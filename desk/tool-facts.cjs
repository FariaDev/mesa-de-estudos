/* Fatos de host do Pi e do Claude Code para os avisos de atualização (#45).

   Aqui só se LÊ o mundo e se monta o comando; quem decide o que aparece é o
   núcleo (`core/updatenotice.bend`) e quem roda é `tool-run.cjs`.

   - Quem instalou o Pi: a pasta da Mesa (`desk/.pi-local`), o Homebrew
     (`.../Cellar/<fórmula>/...`), o npm global (`.../node_modules/@earendil-works/
     pi-coding-agent/`) ou algo que a Mesa não reconhece (só o comando, com
     "Copiar").
   - Claude Code: só `claude --version`. NUNCA `auth status`, login nem
     inferência (a sessão do usuário não é assunto daqui). Não há mais binário
     de reserva do SDK (#51).
   - Nenhum comando é montado com texto vindo de fora: a fórmula do Homebrew
     passa por uma lista de caracteres seguros antes de entrar no comando. */
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const updater=require('./updater.cjs');

const PI_PACKAGE='@earendil-works/pi-coding-agent';
const SAFE_FORMULA=/^[a-z0-9][a-z0-9@._+-]{0,63}$/i;

/** @typedef {'local'|'brew'|'npm'|'unknown'|''} PiInstallKind */
/** @typedef {{kind:PiInstallKind, formula:string}} PiInstall */

/** Primeira linha numérica `X.Y.Z` de uma saída de `--version`; '' se não houver.
 *  @param {unknown} text @returns {string}
 *  @example versionFromOutput('2.1.296 (Claude Code)') // '2.1.296' */
function versionFromOutput(text){
 const m=/(\d+)\.(\d+)\.(\d+)/.exec(String(text||''));
 return m?`${m[1]}.${m[2]}.${m[3]}`:'';
}

function realOrSame(file){
 try{return fs.realpathSync(file);}catch{return file;}
}

/** Quem instalou o Pi, olhando o caminho REAL do binário.
 *  @param {{piPath:string, localRoot:string}} input `localRoot` vem de
 *  `components.piLocalRoot` ('' se não é o local da Mesa).
 *  @returns {PiInstall}
 *  @example piInstall({piPath:'/opt/homebrew/bin/pi',localRoot:''}) // {kind:'brew',formula:'pi-coding-agent'} se o link cai em .../Cellar/pi-coding-agent/... */
function piInstall({piPath,localRoot}){
 if(!piPath)return {kind:'',formula:''};
 if(localRoot)return {kind:'local',formula:''};
 const real=realOrSame(piPath).replace(/\\/g,'/');
 const cellar=/\/Cellar\/([^/]+)\//.exec(real);
 if(cellar&&SAFE_FORMULA.test(cellar[1]))return {kind:'brew',formula:cellar[1]};
 if(real.includes('/node_modules/@earendil-works/pi-coding-agent/'))return {kind:'npm',formula:''};
 return {kind:'unknown',formula:''};
}

/** O comando da atualização, para a confirmação e para rodar.
 *  `mode`: 'run' = a Mesa roda depois de confirmar; 'copy' = só o comando com
 *  "Copiar"; 'local' = o botão de sempre (a Mesa reinicia); 'none' = nada.
 *  @param {{id:'pi'|'claude', install:PiInstall, claudeLauncher:string}} input
 *  @returns {{mode:'run'|'copy'|'local'|'none', command:string, file:string, args:string[]}} */
function updatePlan({id,install,claudeLauncher}){
 if(id==='claude'){
  if(!claudeLauncher)return {mode:'none',command:'',file:'',args:[]};
  return {mode:'run',command:'claude update',file:claudeLauncher,args:['update']};
 }
 if(install.kind==='local')return {mode:'local',command:'',file:'',args:[]};
 if(install.kind==='brew'){
  return {mode:'run',command:`brew upgrade ${install.formula}`,file:'brew',args:['upgrade',install.formula]};
 }
 if(install.kind==='npm'){
  return {mode:'run',command:`npm i -g ${PI_PACKAGE}`,file:'npm',args:['i','-g',PI_PACKAGE]};
 }
 if(install.kind==='unknown')return {mode:'copy',command:`npm i -g ${PI_PACKAGE}`,file:'',args:[]};
 return {mode:'none',command:'',file:'',args:[]};
}

/** Executável por nome nos mesmos diretórios que o worker semeia (o app aberto
 *  pelo Finder nasce com PATH mínimo: `brew`/`npm` precisam continuar acháveis).
 *  Caminho com separador é devolvido como está.
 *  @param {string} name @param {NodeJS.ProcessEnv} env @param {string} home
 *  @param {string[]=} dirsOverride lista fixa de diretórios (testes)
 *  @returns {string} caminho absoluto, ou '' se não achou */
function executableIn(name,env=process.env,home=os.homedir(),dirsOverride){
 if(!name)return '';
 if(name.includes('/')||name.includes('\\'))return name;
 const names=process.platform==='win32'?[name+'.cmd',name+'.exe',name]:[name];
 const dirs=dirsOverride||updater.workerEnv(env,home).PATH.split(path.delimiter);
 for(const dir of dirs){
  for(const candidate of names){
   const file=path.join(dir||'.',candidate);
   try{if(fs.statSync(file).isFile())return file;}catch{/* próximo diretório */}
  }
 }
 return '';
}

/** `claude --version` do launcher do usuário: '' se ausente, travado ou sem versão.
 *  @param {{launcher:string, run:Function}} input @returns {Promise<string>} */
async function claudeInstalledVersion({launcher,run}){
 if(!launcher)return '';
 try{
  const r=await run(launcher,['--version'],{timeout:8000});
  return versionFromOutput(r.stdout);
 }catch{return '';}
}

module.exports={PI_PACKAGE,versionFromOutput,piInstall,updatePlan,executableIn,claudeInstalledVersion};
