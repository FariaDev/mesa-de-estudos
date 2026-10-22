// @ts-check
'use strict';

const path=require('node:path');
const {Worker}=require('node:worker_threads');
const {isIssueUrl}=require('./triage-outputs.mjs');

/* "Relatar um problema" (#62), no host. Canais:
   - `triage-report` {engine, model} → {ok, result} com o relatório limpo e as
     três saídas, montados no `triage-worker.mjs` (fora do processo principal);
   - `triage-open-issue` {url}       → abre no navegador SÓ o endereço de issue
     nova do repositório (`isIssueUrl`), depois do clique da pessoa.
   Nada aqui manda dado para a rede: quem envia a issue é a pessoa, no GitHub. */

/**
 * @typedef {{report: string, agentPrompt: string,
 *   opencode: {command: string, model: string, policyKey: string} | {command: null, reason: string},
 *   pi: ({command: string, model: string} | {command: null, reason: string}) & {facts: {pi: boolean, piModels: string[]}, platform: string},
 *   issue: {url: string, truncated: boolean}}} TriageResult
 */

/** @param {unknown} value @param {number} max @returns {string} */
const shortText=(value,max)=>typeof value==='string'?value.slice(0,max):'';

/**
 * @param {{choice: {engine: string, model: string} | null, electron: string, platform: string}} input
 * @param {string} [workerFile]
 * @returns {Promise<{ok: true, result: TriageResult} | {ok: false, error: string}>}
 */
function runTriageWorker(input,workerFile=path.join(__dirname,'triage-worker.mjs')){
 return new Promise(resolve=>{
  const worker=new Worker(workerFile,{workerData:input});
  worker.once('message',resolve);
  worker.once('error',error=>resolve({ok:false,error:String(error?.message||error)}));
  worker.once('exit',code=>{if(code!==0)resolve({ok:false,error:`o worker da triagem saiu com ${code}`});});
 });
}

/**
 * Registra os canais da triagem.
 * @param {{ipcMain: {handle: Function}, openExternal: (url: string) => unknown,
 *   electronVersion: string, platform?: string, runWorker?: typeof runTriageWorker}} deps
 * @example registerTriageHost({ipcMain, openExternal: openExternalLink, electronVersion: process.versions.electron});
 */
function registerTriageHost({ipcMain,openExternal,electronVersion,platform=process.platform,runWorker=runTriageWorker}){
 ipcMain.handle('triage-report',(_event,payload)=>{
  const engine=shortText(payload?.engine,40),model=shortText(payload?.model,200);
  return runWorker({choice:engine?{engine,model}:null,electron:electronVersion,platform});
 });
 ipcMain.handle('triage-open-issue',async(_event,payload)=>{
  const url=payload?.url;
  if(!isIssueUrl(url))return {ok:false,error:`endereço de issue inválido: esperado https://github.com/FariaDev/mesa-e-conversa/issues/new?…, veio ${JSON.stringify(String(url).slice(0,80))}`};
  await openExternal(url);
  return {ok:true};
 });
}

module.exports={registerTriageHost,runTriageWorker};
