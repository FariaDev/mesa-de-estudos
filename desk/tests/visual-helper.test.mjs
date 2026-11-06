import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ensureVisualHelper} from '../scripts/visual-helper.mjs';

function cloneWithoutHelper(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'mesa-visual-helper-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 fs.mkdirSync(path.join(root,'visual-check'));
 return root;
}

test('instalar em clone sem helper compila o helper do Conferir no macOS',t=>{
 const root=cloneWithoutHelper(t);
 const calls=[];
 const result=ensureVisualHelper({root,platform:'darwin',compile:(source,output)=>{
  calls.push([source,output]);
  fs.writeFileSync(output,'binário');
  return {status:0};
 }});
 assert.equal(result,'compiled');
 assert.deepEqual(calls,[[path.join(root,'visual-check','windows.swift'),path.join(root,'visual-check','windows')]]);
});

test('helper já compilado não recompila',t=>{
 const root=cloneWithoutHelper(t);
 fs.writeFileSync(path.join(root,'visual-check','windows'),'binário');
 const result=ensureVisualHelper({root,platform:'darwin',compile:()=>assert.fail('não deveria compilar')});
 assert.equal(result,'present');
});

test('sem swiftc a instalação recebe "failed" em vez de exceção',t=>{
 const root=cloneWithoutHelper(t);
 assert.equal(ensureVisualHelper({root,platform:'darwin',compile:()=>({status:null})}),'failed');
});

test('compilador que sai com 0 sem gerar o binário conta como falha',t=>{
 const root=cloneWithoutHelper(t);
 assert.equal(ensureVisualHelper({root,platform:'darwin',compile:()=>({status:0})}),'failed');
});

test('fora do macOS não compila nada',t=>{
 const root=cloneWithoutHelper(t);
 assert.equal(ensureVisualHelper({root,platform:'linux',compile:()=>assert.fail('não deveria compilar')}),'not-mac');
});
