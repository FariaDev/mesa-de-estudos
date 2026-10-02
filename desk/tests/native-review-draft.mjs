/* Opt-in: Pi/provedor reais, rascunho sintético sem ferramentas nem sessão salva. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {PiBridge}=require('../rpc.cjs');
const {resolvePi,spawnEnv}=require('../pi.cjs');
const {DRAFT_PROMPT,generateReviewDraft}=require('../review-draft.cjs');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'mesa-native-draft-'));
const pi=resolvePi({deskDir:path.resolve(import.meta.dirname,'..')}),promptFile=path.join(root,'prompt.md');
fs.writeFileSync(promptFile,DRAFT_PROMPT);
const b=new PiBridge({cwd:root,session:path.join(root,'session.jsonl'),pi,env:spawnEnv(pi),promptFile,extraArgs:['--no-tools','--no-extensions','--no-skills','--no-prompt-templates','--no-session']});
const events=[];b.on('event',e=>events.push(e));
try{
 const item=await generateReviewDraft({bridge:b,context:{question:'Quanto é 2 + 2?',attempt:'Somei dois com dois.',answer:'O resultado é 4. Você somou corretamente.',selection:''},ref:null});
 assert.ok(item.question);assert.equal(typeof item.attempt,'string');assert.equal(typeof item.difficulty,'string');
 assert.ok(events.some(e=>e.type==='agent_settled'),'a sugestão esperou settled');
 assert.ok(!events.some(e=>e.type==='tool_execution_start'),'nenhuma ferramenta foi executada');
 assert.equal(fs.existsSync(path.join(root,'session.jsonl')),false,'sem sessão persistida');
 console.log('PASS: Pi/provedor reais geraram JSON de revisão, settled recebido, sem ferramentas nem sessão persistida');
}finally{b.removeAllListeners();b.stop();fs.rmSync(root,{recursive:true,force:true});}
