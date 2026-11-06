import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {collectTriage,reportText} from '../triage-report.mjs';
import {agentPrompt,opencodeCommand,issueUrl} from '../triage-outputs.mjs';

/* `npm run triage` (#62): imprime o relatório limpo e as três saídas. Nada sai
   da máquina por aqui: o endereço da issue é só impresso, para a pessoa abrir,
   revisar e enviar. O texto do terminal é o catálogo pt-BR. */
const desk=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const catalog=JSON.parse(fs.readFileSync(path.join(desk,'src','locales','pt-BR.json'),'utf8'));
const say=(key,args={})=>String(catalog[key]||key).replace(/\{(\w+)\}/g,(whole,name)=>name in args?String(args[name]):whole);

const {facts}=collectTriage();
const report=reportText(facts);
const prompt=agentPrompt(report,facts.commit);
const opencode=opencodeCommand(facts,report,process.platform);
const issue=issueUrl(report);
const rule='─'.repeat(60);

console.log(`${say('triage.lead')}\n${rule}\n${report}\n${rule}\n`);
console.log(`# ${say('triage.out.agent')}\n\n${prompt}\n${rule}\n`);
if(opencode.command){
 console.log(`# ${say('triage.out.opencode')}\n${say('triage.freeWarning',{model:opencode.model,policy:say(opencode.policyKey).toLowerCase()})}\n\n${opencode.command}\n${rule}\n`);
}else{
 console.log(`# ${say('triage.out.opencode')}\n${say(opencode.reason)}\n${rule}\n`);
}
console.log(`# ${say('triage.openIssue')}\n${issue.truncated?`${say('triage.issueTruncated')}\n`:''}${issue.url}`);
