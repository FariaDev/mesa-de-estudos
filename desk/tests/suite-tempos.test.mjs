/* Tempos do corredor (#48): ordem dos mais lentos, agrupamento por rodada e
   leitura tolerante de uma trilha .jsonl com linha truncada. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {appendTimingRow,groupByRun,meanByFile,readTimingRows,slowest} from './suite-tempos.mjs';

const row=(file,ms,run='r1',extra={})=>({suite:'janelas',file,ms,status:'ok',jobs:2,run,ts:'2026-10-15T10:00:00.000Z',...extra});

test('slowest ordena do maior para o menor e respeita o corte',()=>{
 const top=slowest([row('a',5),row('b',9),row('c',7)],2);
 assert.deepEqual(top.map(r=>r.file),['b','c']);
});

test('slowest desempata pelo nome para o resumo ser estável',()=>{
 assert.deepEqual(slowest([row('z',3),row('a',3)]).map(r=>r.file),['a','z']);
});

test('groupByRun separa as rodadas e meanByFile tira a média entre elas',()=>{
 const runs=groupByRun([row('a',10,'r1'),row('b',4,'r1'),row('a',20,'r2')]);
 assert.equal(runs.length,2);
 assert.deepEqual(meanByFile(runs).find(r=>r.file==='a'),{file:'a',ms:15,count:2});
});

test('trilha .jsonl: acrescenta linhas e ignora a truncada',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'suite-tempos-'));
 const file=path.join(dir,'sub','t.jsonl');
 try{
  appendTimingRow(file,row('a',1));
  fs.appendFileSync(file,'{"file":"cortada"\n');
  appendTimingRow(file,row('b',2));
  assert.deepEqual(readTimingRows(file).map(r=>r.file),['a','b']);
  assert.deepEqual(readTimingRows(path.join(dir,'nao-existe.jsonl')),[]);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
