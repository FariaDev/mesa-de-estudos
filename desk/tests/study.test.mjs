import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
const {authorizeRestoredStudy}=createRequire(import.meta.url)('../study.cjs');

test('a persisted Xournal file is reauthorized when its session is restored',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'desk-study-'));
 try{
  const xopp=path.join(dir,'tentativa.xopp');fs.writeFileSync(xopp,'test');
  const allowed=new Set();const restored=authorizeRestoredStudy({title:'Lista 2 · 7b',xopp},allowed);
  assert.equal(restored.xopp,xopp);assert.equal(allowed.has(xopp),true);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('restoration rejects missing files and non-Xournal extensions',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'desk-study-invalid-'));
 try{
  const pdf=path.join(dir,'tentativa.pdf');fs.writeFileSync(pdf,'test');
  for(const xopp of [pdf,path.join(dir,'missing.xopp')]){
   const allowed=new Set();const restored=authorizeRestoredStudy({xopp},allowed);
   assert.equal(restored.xopp,'');assert.equal(allowed.size,0);
  }
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
