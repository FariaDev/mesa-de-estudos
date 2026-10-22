/* Identidade de execução do host Pi (achado N1): testes puros da decisão de
   encaminhar/descartar evento. O renderer/E2E fica em `timeline-late.mjs`. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {createTurnIdentity,toolIdsOf}=createRequire(import.meta.url)('../src/turn-identity.cjs');

test('toolIdsOf cobre declaração, execução e message_end', () => {
 assert.deepEqual(toolIdsOf({type:'tool_execution_start',toolCallId:'t1'}),['t1']);
 assert.deepEqual(toolIdsOf({type:'message_update',assistantMessageEvent:{type:'toolcall_end',toolCall:{id:'t2'}}}),['t2']);
 assert.deepEqual(toolIdsOf({type:'message_end',message:{content:[{type:'toolCall',id:'t3'},{type:'text',text:'x'}]}}),['t3']);
 assert.deepEqual(toolIdsOf({type:'message_end',message:{content:[{type:'text',text:'x'}]}}),[]);
});

test('identidade: corrida entre agent_start e agent_settled; aposentados não voltam', () => {
 const id=createTurnIdentity();
 assert.equal(id.arrive({type:'agent_start'}).hostRun,'host-run-1');
 assert.equal(id.arrive({type:'message_start',message:{role:'assistant'}}).hostRun,'host-run-1');
 assert.equal(id.arrive({type:'message_update',assistantMessageEvent:{type:'toolcall_end',toolCall:{id:'t1',name:'x'}}}).hostRun,'host-run-1');
 assert.equal(id.arrive({type:'tool_execution_start',toolCallId:'t1',toolName:'x'}).hostRun,'host-run-1');
 assert.equal(id.arrive({type:'agent_end',willRetry:false}).hostRun,'host-run-1');
 assert.equal(id.arrive({type:'agent_settled'}).hostRun,'host-run-1');
 /* Fechada a corrida, pintura sem corrida aberta é atraso: não passa. */
 assert.equal(id.arrive({type:'message_update',assistantMessageEvent:{type:'text_delta',delta:'x',contentIndex:2}}),null);
 assert.equal(id.arrive({type:'message_end',message:{role:'assistant',content:[{type:'text',text:'x'}]}}),null);
 assert.equal(id.arrive({type:'tool_execution_end',toolCallId:'t1',toolName:'x'}),null);
 /* Corrida nova: id aposentado segue marcado `stale` (o renderer descarta). */
 assert.equal(id.arrive({type:'agent_start'}).hostRun,'host-run-2');
 const staleTool=id.arrive({type:'tool_execution_start',toolCallId:'t1',toolName:'x'});
 assert.equal(staleTool.stale,true,'tool_execution_start com id aposentado sai stale');
 assert.equal(staleTool.hostRun,'host-run-2');
 const staleEnd=id.arrive({type:'message_end',message:{role:'assistant',content:[{type:'toolCall',id:'t1',name:'x'}]}});
 assert.equal(staleEnd.stale,true,'message_end com id aposentado sai stale');
 const staleCall=id.arrive({type:'message_update',assistantMessageEvent:{type:'toolcall_end',toolCall:{id:'t1'}}});
 assert.equal(staleCall.stale,true,'toolcall_end com id aposentado sai stale');
 /* Evento da corrida nova com id novo passa carimbado com a corrida nova. */
 assert.equal(id.arrive({type:'message_start',message:{role:'assistant'}}).hostRun,'host-run-2');
 assert.equal(id.arrive({type:'tool_execution_start',toolCallId:'t2',toolName:'y'}).hostRun,'host-run-2');
});

test('identidade: agent_start sem settle anterior aposenta o que a corrida deixou', () => {
 const id=createTurnIdentity();
 id.arrive({type:'agent_start'});
 id.arrive({type:'tool_execution_start',toolCallId:'t1',toolName:'x'});
 /* steer/corte: nova corrida sem agent_settled — a antiga não pinta mais. */
 assert.equal(id.arrive({type:'agent_start'}).hostRun,'host-run-2');
 assert.equal(id.arrive({type:'tool_execution_end',toolCallId:'t1',toolName:'x'}).stale,true);
});

test('identidade: retry DENTRO do mesmo turno não invalida o id; corte sim', () => {
 const id=createTurnIdentity();
 id.arrive({type:'agent_start'});
 id.arrive({type:'tool_execution_start',toolCallId:'t1',toolName:'x'});
 /* auto_retry sem novo agent_start: o id continua o mesmo passo. */
 const retry=id.arrive({type:'tool_execution_start',toolCallId:'t1',toolName:'x'});
 assert.equal(retry.stale,undefined,'retry no mesmo turno não pode marcar stale');
 assert.equal(id.arrive({type:'tool_execution_end',toolCallId:'t1',toolName:'x'}).stale,undefined,'o end do mesmo turno pinta');
 /* steer/corte (novo agent_start sem settle) aposenta a corrida anterior. */
 id.arrive({type:'agent_start'});
 assert.equal(id.arrive({type:'tool_execution_end',toolCallId:'t1',toolName:'x'}).stale,true);
});

test('identidade: reset de transporte limpa o ledger sem reiniciar o contador (R3)', () => {
 const id=createTurnIdentity();
 id.arrive({type:'agent_start'});
 id.arrive({type:'tool_execution_start',toolCallId:'t1',toolName:'x'});
 id.arrive({type:'agent_settled'});
 assert.deepEqual(id.state().retired,['t1'],'o id conhecido foi aposentado');
 /* Queda/reconexão no MESMO bridge: o processo novo não herda o ledger. */
 id.reset();
 const after=id.state();
 assert.deepEqual(after.retired,[],'reset limpa o ledger do processo que morreu');
 assert.equal(after.open,false);
 assert.equal(after.run,null);
 /* O contador NÃO volta: a corrida nova é host-run-2 (nunca host-run-1). */
 assert.equal(id.arrive({type:'agent_start'}).hostRun,'host-run-2','reset preserva a unicidade da corrida no mesmo bridge');
 /* O provedor pode reusar o id nativo no processo novo: não é stale. */
 const reused=id.arrive({type:'tool_execution_start',toolCallId:'t1',toolName:'x'});
 assert.equal(reused.stale,undefined,'id reusado depois do reset é legítimo');
 assert.equal(reused.hostRun,'host-run-2');
});

test('identidade: host legado sem agent_start abre corrida implícita', () => {
 const id=createTurnIdentity();
 assert.equal(id.arrive({type:'message_start',message:{role:'assistant'}}).hostRun,'host-run-1');
 assert.equal(id.arrive({type:'message_update',assistantMessageEvent:{type:'text_delta',delta:'oi'}}).hostRun,'host-run-1');
 assert.equal(id.arrive({type:'agent_settled'}).hostRun,'host-run-1');
 /* Sem o contrato de agent_start não há como provar atraso: abre a próxima
    corrida implícita (o fluxo legado continua). */
 assert.equal(id.arrive({type:'message_start',message:{role:'assistant'}}).hostRun,'host-run-2');
});

test('identidade: eventos de sessão fora do contrato não são tocados', () => {
 const id=createTurnIdentity();
 const compact={type:'compaction_end',reason:'threshold'};
 assert.equal(id.arrive(compact),compact);
 assert.equal(id.arrive({type:'queue_update',steering:[],followUp:[]}).hostRun,undefined);
});
