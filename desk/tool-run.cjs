/* Roda o comando de atualização de uma ferramenta e entrega a saída.

   Só o `file`+`args` que `tool-facts.updatePlan` montou chegam aqui (nunca texto
   do renderizador); a Mesa só roda DEPOIS da confirmação da pessoa. O processo
   não lê o teclado (stdin fechado), tem prazo e a saída guarda só o rabo (as
   últimas ~64 KB) — a Sobre mostra isso numa área rolável. */
const {spawn}=require('node:child_process');
const updater=require('./updater.cjs');

const RUN_TIMEOUT_MS=10*60*1000;
const OUTPUT_TAIL_BYTES=64*1024;
/* Códigos de cor e de cursor não ajudam numa caixa de texto. */
// eslint-disable-next-line no-control-regex -- o ESC dos códigos ANSI é o que se quer tirar
const ANSI=/\u001b\[[0-9;?]*[ -/]*[@-~]/g;

function plainOutput(text){
 return String(text||'').replace(ANSI,'').replace(/\r(?!\n)/g,'\n');
}

function tailOf(text){
 return text.length>OUTPUT_TAIL_BYTES?'…\n'+text.slice(text.length-OUTPUT_TAIL_BYTES):text;
}

/**
 * @param {{file:string,args:string[],env?:NodeJS.ProcessEnv,cwd?:string,
 *   onOutput?:(text:string)=>void,timeoutMs?:number,spawnFn?:Function}} input
 * @returns {Promise<{ok:boolean,code:number|null,output:string,error:string}>}
 *   Nunca rejeita: falha de spawn, prazo e saída ≠ 0 voltam como `ok:false`.
 * @example await runTool({file:'/usr/bin/true',args:[]}) // {ok:true,code:0,output:'',error:''}
 */
function runTool({file,args,env=process.env,cwd,onOutput,timeoutMs=RUN_TIMEOUT_MS,spawnFn=spawn}){
 return new Promise(resolve=>{
  let output='';
  let settled=false;
  let timer=null;
  const finish=result=>{
   if(settled)return;
   settled=true;
   if(timer)clearTimeout(timer);
   resolve({...result,output:tailOf(plainOutput(output)).trim()});
  };
  const feed=chunk=>{
   output=tailOf(output+String(chunk));
   if(onOutput)onOutput(tailOf(plainOutput(output)));
  };
  let child;
  try{
   child=spawnFn(file,args,{env,cwd,stdio:['ignore','pipe','pipe'],windowsHide:true,shell:updater.needsShell(file)});
  }catch(e){
   finish({ok:false,code:null,error:`não foi possível iniciar o comando (${String(e&&e.message||e)})`});
   return;
  }
  child.stdout?.on('data',feed);
  child.stderr?.on('data',feed);
  child.on('error',e=>finish({ok:false,code:null,error:`não foi possível iniciar o comando (${String(e&&e.message||e)})`}));
  child.on('close',code=>finish({ok:code===0,code,error:code===0?'':`o comando saiu com código ${code}`}));
  timer=setTimeout(()=>{
   try{child.kill('SIGTERM');}catch{/* já saiu */}
   finish({ok:false,code:null,error:'o comando passou do prazo e foi interrompido'});
  },timeoutMs);
 });
}

module.exports={RUN_TIMEOUT_MS,OUTPUT_TAIL_BYTES,plainOutput,runTool};
