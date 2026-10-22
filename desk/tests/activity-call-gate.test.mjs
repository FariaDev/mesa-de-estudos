import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {ptMatches} from './pt-text.mjs';
const require=createRequire(import.meta.url);
const {createActivityCallGate}=require('../src/agents/activity-call-gate.cjs');
const spec={title:'MRUV',objective:'Explorar aceleração',alternativeMarkdown:'s=at²/2',html:'<p>Explorar</p>',css:'',js:'',katex:false};
test('PreToolUse substitui referência do modelo e preserva ID real e hash',async()=>{
 let scope={active:true,conversationId:'synthetic',generation:3,runId:'turn-1'};
 const calls=[],gate=createActivityCallGate({current:()=>scope,publish:async args=>{calls.push(args);return {published:true};}});
 await assert.rejects(gate.execute({...spec,callRef:'invented'}),ptMatches(/^Referência de chamada inválida: recebido "invented"; esperado/));
 const input=gate.reserve({tool_use_id:'real-tool-id',tool_input:{...spec,callRef:'invented'}});
 assert.notEqual(input.callRef,'invented');
 await assert.rejects(gate.execute({...input,html:'<p>Alterado</p>'}),ptMatches(/^Referência de chamada inválida: recebido "/));
 assert.deepEqual(await gate.execute(input),{published:true});assert.equal(calls[0].toolCallId,'real-tool-id');
 scope={...scope,runId:'turn-2'};
 await assert.rejects(gate.execute(input),ptMatches(/^Referência de chamada inválida: recebido "/));
 scope={...scope,runId:'turn-1',generation:4};
 await assert.rejects(gate.execute(input),ptMatches(/^Referência de chamada inválida: recebido "/));
 scope={...scope,generation:3,active:false};
 await assert.rejects(gate.execute(input),ptMatches(/Rodada encerrada/));
 assert.equal(calls.length,1);
});
test('hook sem ID nativo ou payload inválido não cria autorização',()=>{
 const gate=createActivityCallGate({current:()=>({active:true,conversationId:'c',generation:1,runId:'r'}),publish:()=>{throw Error('não deve publicar');}});
 assert.throws(()=>gate.reserve({tool_input:spec}),/toolCallId/);
 assert.throws(()=>gate.reserve({tool_use_id:'id',tool_input:{}}));
});
test('revisão por activityId: hash cobre o campo e o execute propaga sem inventar',async()=>{
 const scope={active:true,conversationId:'c',generation:1,runId:'r'};
 const calls=[],gate=createActivityCallGate({current:()=>scope,publish:async args=>{calls.push(args);return {published:true};}});
 const reserved=gate.reserve({tool_use_id:'toolu-rev',tool_input:{...spec,activityId:'act-abc12345'}});
 /* Trocar a revisão depois da reserva altera o paramsHash e a referência morre. */
 await assert.rejects(gate.execute({...reserved,activityId:'act-outro1234'}),ptMatches(/^Referência de chamada inválida: recebido "/));
 assert.deepEqual(await gate.execute(reserved),{published:true});
 assert.equal(calls[0].activityId,'act-abc12345');
 assert.equal(calls[0].toolCallId,'toolu-rev');
 const plain=gate.reserve({tool_use_id:'toolu-plain',tool_input:{...spec}});
 await gate.execute(plain);
 assert.equal(calls[1].activityId,undefined,'sem activityId o campo não é inventado');
});
