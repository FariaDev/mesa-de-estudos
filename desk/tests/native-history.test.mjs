import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {ptMatches} from './pt-text.mjs';
const {readNativeHistory}=createRequire(import.meta.url)('../src/agents/native-history.cjs');
const sessionId='11111111-1111-4111-8111-111111111111';
test('export crosses display limit and paginates API entries without duplicates',async()=>{
 const rows=Array.from({length:501},(_,id)=>({id,type:id%3?'assistant':'user',message:{content:id%3?'text':[{type:'tool_result'}]}})),calls=[];
 const sdkLoader=async()=>({getSessionMessages:async(id,options)=>{calls.push({id,...options});return rows.slice(options.offset,options.offset+options.limit);}});
 const result=await readNativeHistory({sessionId,dir:'/own',sdkLoader});
 assert.deepEqual(result,rows);assert.deepEqual(calls.map(c=>c.offset),[0,200,400,501]);
 assert.ok(calls.every(c=>c.id===sessionId&&c.dir==='/own'));
});
test('export limit fails explicitly before returning a partial transcript',async()=>{
 await assert.rejects(readNativeHistory({sessionId,sdkLoader:async()=>({getSessionMessages:async()=>[{text:'too big'}]}),maxRows:1}),ptMatches(/Nenhum arquivo parcial/));
});

const UUID = sessionId;
/** SDK de mentira: devolve as páginas na ordem e depois lista vazia. */
const fakeHistorySdk = (pages) => async () => ({getSessionMessages: async () => pages.shift() ?? []});

test('readNativeHistory diz o que veio quando a identidade ou a página está fora do formato', async () => {
  await assert.rejects(readNativeHistory({sessionId: 'abc', sdkLoader: fakeHistorySdk([])}), ptMatches(/recebido "abc"; esperado um UUID/));
  await assert.rejects(readNativeHistory({sessionId: UUID, sdkLoader: fakeHistorySdk([{rows: 1}])}), ptMatches(/recebido \{rows\}; esperado array/));
  await assert.rejects(readNativeHistory({sessionId: UUID, sdkLoader: async () => ({})}), ptMatches(/falta getSessionMessages/));
});

test('readNativeHistory recusa histórico acima do teto e diz os números', async () => {
  await assert.rejects(readNativeHistory({sessionId: UUID, maxRows: 1, sdkLoader: fakeHistorySdk([[{a: 1}, {b: 2}]])}), ptMatches(/\(2 entradas e \d+ bytes; teto de 1 entradas/));
});
