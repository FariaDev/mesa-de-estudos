// @ts-check
import {parentPort,workerData} from 'node:worker_threads';
import {collectTriage,reportText} from './triage-report.mjs';
import {agentPrompt,opencodeCommand,piCommand,issueUrl} from './triage-outputs.mjs';

/* Worker do "Relatar um problema" na janela (#62): a coleta roda `git`,
   `--version` e `opencode models` de forma síncrona (até 15 s cada) e não
   pode travar o processo principal. Devolve o relatório limpo e as três
   saídas prontas; o host só repassa. */

/**
 * @param {{choice: {engine: string, model: string} | null, electron: string, platform: string}} input
 * @returns {import('./triage-host.cjs').TriageResult}
 */
function buildTriage({choice,electron,platform}){
 const {facts}=collectTriage({choice,electron});
 const report=reportText(facts);
 const prompt=agentPrompt(report,facts.commit);
 return {report,agentPrompt:prompt,opencode:opencodeCommand(facts,report,platform),
  pi:{facts:{pi:facts.pi,piModels:facts.piModels},platform,...piCommand(facts,prompt,platform)},issue:issueUrl(report)};
}

try{
 parentPort?.postMessage({ok:true,result:buildTriage(workerData)});
}catch(error){
 parentPort?.postMessage({ok:false,error:String(/** @type {Error} */(error)?.message||error)});
}
