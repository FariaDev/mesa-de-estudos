import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {createUsageEvents}=require('../src/study-data/usage-events.cjs');
const stats=require('../src/study-data/statistics.cjs');
const {restoreConfiguration}=require('../src/study-data/restore-config.cjs');
const conversations=require('../src/agents/conversations.cjs');
const fixture=fn=>{const root=fs.mkdtempSync(path.join(os.tmpdir(),'mesa-study-edge-'));try{fn(root);}finally{fs.rmSync(root,{recursive:true,force:true});}};

test('quadros divididos reservam a métrica quando ela chega; replay alterado não duplica',()=>fixture(root=>{
 const record=payload=>stats.recordUsage(root,{...payload,courseId:'calc'});
 const event=createUsageEvents({session:'s',engine:()=> 'claude',record});
 event({type:'message_end',message:{id:'msg-1',role:'assistant',content:[{type:'text',text:'Primeira parte'}]}});
 event({type:'message_end',message:{id:'msg-1',role:'assistant',usage:{input:120,output:30,cacheRead:5,cacheWrite:7}}});
 event({type:'agent_settled'});
 const before=stats.summary(root,{period:'all'}).usage;
 event({type:'message_end',message:{id:'msg-1',role:'assistant',model:'outro',usage:{input:999,output:999}}});
 event({type:'agent_settled'});
 assert.deepEqual(stats.summary(root,{period:'all'}).usage,before);
 assert.equal(Number(before.input.count),120);assert.equal(Number(before.cache.count),12);
}));

test('mensagens distintas com conteúdo igual contam separadamente; uso ausente continua indisponível',()=>fixture(()=>{
 const received=[];const event=createUsageEvents({session:'s',engine:()=> 'pi',record:payload=>received.push(payload)});
 for(const id of ['1','2'])event({type:'message_end',message:{id,role:'assistant',content:[],usage:{input:3,output:4}}});
 assert.notEqual(received[0].id,received[1].id);
 event({type:'message_end',message:{id:'3',role:'assistant',content:[]}});assert.equal(received.length,2);
 event({type:'agent_end'});assert.equal(received.length,3);assert.equal(received[2].input,undefined);
}));

test('configuração remapeada preserva extras e cria matéria ausente na máquina nova',()=>fixture(root=>{
 const file=path.join(root,'config.json'),materials=path.join(root,'courses','calc');fs.mkdirSync(materials,{recursive:true});
 fs.writeFileSync(file,JSON.stringify({custom:'preservar',courses:[{id:'outro',name:'Outro',path:root,extra:42}],desk:{future:true,panels:[{label:'PDF',futurePanel:true}]}}));
 const result={materialsRemapped:[{courseId:'calc',name:'Cálculo',from:'/pasta-antiga',to:materials}]};
 restoreConfiguration({configFile:file,runtime:root,result,services:{}});
 const saved=JSON.parse(fs.readFileSync(file));assert.equal(saved.custom,'preservar');assert.equal(saved.desk.future,true);assert.equal(saved.desk.panels[0].futurePanel,true);
 assert.equal(saved.courses.find(item=>item.id==='outro').extra,42);assert.equal(saved.courses.find(item=>item.id==='calc').path,materials);
 assert.deepEqual(result.restoreWarnings,[]);
}));

test('configuração symlinkada permanece intacta e falha de devolução é avisada',()=>fixture(root=>{
 const target=path.join(root,'original.json'),link=path.join(root,'config.json');fs.writeFileSync(target,JSON.stringify({courses:[]}));fs.symlinkSync(target,link);
 const before=fs.readFileSync(target),materials=path.join(root,'materials');fs.mkdirSync(materials);
 const result={materialsRemapped:[{courseId:'calc',to:materials}]};restoreConfiguration({configFile:link,runtime:root,result,services:{}});
 assert.deepEqual(fs.readFileSync(target),before);assert.ok(fs.lstatSync(link).isSymbolicLink());assert.ok(result.restoreWarnings.length);
 const failed={restoreConfig:true};restoreConfiguration({configFile:target,runtime:root,result:failed,services:{externalPlan:()=>[]}});
 assert.match(failed.restoreWarnings[0],/preservadas/);
}));

test('transcrição importada persiste depois do primeiro aceite e atualização do cache',()=>fixture(root=>{
 const file=conversations.createClaudeConversation({runtime:root,courseId:'calc'});
 conversations.updateClaudeConversation(file,{importedTranscript:'user: Minha lista original'},{runtime:root});
 conversations.updateClaudeConversation(file,{nativeEstablished:true,messages:[{role:'assistant',content:[{type:'text',text:'Nova resposta'}]}]},{runtime:root});
 assert.equal(conversations.readClaudeConversation(file,{runtime:root}).importedTranscript,'user: Minha lista original');
 assert.throws(()=>conversations.updateClaudeConversation(file,{importedTranscript:'troca'},{runtime:root}),/imutável/);
 assert.throws(()=>conversations.updateClaudeConversation(file,{importedTranscript:'x'.repeat(50001)},{runtime:root}),/importedTranscript inválido: recebido string\(50001\); esperado string\(0\.\.50000\)/);
}));
