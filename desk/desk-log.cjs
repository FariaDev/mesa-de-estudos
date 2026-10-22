'use strict';

const fs=require('node:fs');
const {logEntryLine,readableLog}=require('./src/log-entry.mjs');

/* Log do main (`desk.log`, uma linha JSON por entrada, com rotação em 256 KB).
   Saiu do main.cjs na #43 fase 2; na fase 3 a linha virou
   `{ts, level, area, msg, ...campos}` (formato em `src/log-entry.mjs`). */
const LOG_ROTATE_BYTES=262144;

/**
 * Cria o gravador do `desk.log`.
 * @param {{logFile:string, logText:(raw:string)=>string}} options arquivo e tradutor
 *   da linha para o português do log (pode lançar enquanto o idioma não existe)
 * @returns {import('./types/host-deps').AppendLog} grava uma linha; nunca lança
 * @example const appendLog=createDeskLog({logFile,logText:raw=>languageHost.logText(raw)});
 * appendLog('update','worker não confirmou o arranque',{level:'warn',version:'0.5.1'});
 */
function createDeskLog({logFile,logText}){
 let logSize=0;try{logSize=fs.statSync(logFile).size;}catch{/* log ainda não existe */}
 return function appendLog(area,line,extra={}){
  try{
   let raw=String(line??'');
   /* O log é sempre em português; `languageHost` nasce depois dos primeiros logs, e até lá a linha sai como veio. */
   try{raw=logText(raw);}catch{/* languageHost ainda não existe */}
   const {level,...fields}=extra||{};
   const entry=logEntryLine({area,msg:raw,level,fields});
   if(!entry)return;
   if(logSize>LOG_ROTATE_BYTES){try{fs.renameSync(logFile,`${logFile}.1`);}catch{/* rotação é best-effort; o log segue no mesmo arquivo */}logSize=0;}
   fs.appendFileSync(logFile,entry);
   logSize+=Buffer.byteLength(entry);
  }catch{/* o log nunca derruba quem o chama (nem se registra no próprio log) */}
 };
}

/**
 * Entrada do log para um processo do Electron que caiu (`child-process-gone`,
 * `render-process-gone`): frase curta e os detalhes como campos.
 * @param {{type?: string, reason?: string, exitCode?: number} | undefined} details
 * @returns {{msg: string, extra: {level: 'error', type: string, reason: string, exitCode: number | null}}}
 * @example processGoneEntry({type: 'GPU', reason: 'crashed', exitCode: 5}).msg // 'processo GPU caiu'
 */
function processGoneEntry(details){
 const type=details?.type||'';
 return {
  msg:type?`processo ${type} caiu`:'processo caiu',
  extra:{level:'error',type,reason:details?.reason||'',exitCode:Number.isFinite(details?.exitCode)?Number(details?.exitCode):null},
 };
}

/** @param {string} file @returns {string} */
function readIfExists(file){
 try{return fs.readFileSync(file,'utf8');}catch{return '';}
}

/**
 * Leitor do "Ver o log" do Sobre: junta `desk.log.1` e `desk.log` em texto
 * legível num arquivo `.log` ao lado (o backup barra `*.log`) e devolve o caminho.
 * @param {{logFile: string, readableFile: string}} files
 * @returns {string} o arquivo legível, pronto para `shell.openPath`
 * @example writeReadableLog({logFile, readableFile: path.join(runtime, 'desk-legivel.log')})
 */
function writeReadableLog({logFile,readableFile}){
 const text=readableLog(readIfExists(`${logFile}.1`)+readIfExists(logFile));
 fs.writeFileSync(readableFile,text||'(log vazio)\n');
 return readableFile;
}

module.exports={createDeskLog,processGoneEntry,writeReadableLog};
