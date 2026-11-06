/* Fatos de host do Claude Code para os avisos de atualização (#45).

   Aqui só se LÊ o mundo e se monta o comando; quem decide o que aparece é o
   núcleo (`core/updatenotice.bend`) e quem roda é `tool-run.cjs`.

   - Claude Code: só `claude --version`. NUNCA `auth status`, login nem
     inferência (a sessão do usuário não é assunto daqui). Não há mais binário
     de reserva do SDK (#51).
   - Nenhum comando é montado com texto vindo de fora. */
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const updater=require('./updater.cjs');

/** Primeira linha numérica `X.Y.Z` de uma saída de `--version`; '' se não houver.
 *  @param {unknown} text @returns {string}
 *  @example versionFromOutput('2.1.296 (Claude Code)') // '2.1.296' */
function versionFromOutput(text){
 const m=/(\d+)\.(\d+)\.(\d+)/.exec(String(text||''));
 return m?`${m[1]}.${m[2]}.${m[3]}`:'';
}

/** O comando da atualização, para a confirmação e para rodar.
 *  `mode`: 'run' = a Mesa roda depois de confirmar; 'copy' = só o comando com
 *  "Copiar"; 'none' = nada.
 *  @param {{id:'claude', claudeLauncher:string}} input
 *  @returns {{mode:'run'|'copy'|'local'|'none', command:string, file:string, args:string[]}} */
function updatePlan({id,claudeLauncher}){
 if(id==='claude'){
  if(!claudeLauncher)return {mode:'none',command:'',file:'',args:[]};
  return {mode:'run',command:'claude update',file:claudeLauncher,args:['update']};
 }
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

module.exports={versionFromOutput,updatePlan,executableIn,claudeInstalledVersion};
