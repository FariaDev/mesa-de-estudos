import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
const {resolvePi,missingPiMessage,spawnEnv}=createRequire(import.meta.url)('../pi.cjs');

test('resolvePi finds a configured binary and a PATH entry',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'desk-pi-'));
 try{
  const file=path.join(dir,'pi');
  fs.writeFileSync(file,'');
  assert.equal(resolvePi({configPath:file}),file);
  const prev=process.env.PATH;
  process.env.PATH=dir+path.delimiter+prev;
  try{assert.equal(resolvePi({}),file);}finally{process.env.PATH=prev;}
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('missing Pi gets a setup message',()=>{
 const err=Object.assign(Error('spawn pi ENOENT'),{code:'ENOENT'});
 assert.match(missingPiMessage(err),/npm run setup/);
 assert.match(missingPiMessage(),/npm run setup/);
 assert.equal(missingPiMessage(Error('Pi encerrou (1).')),'Pi encerrou (1).');
});

test('spawnEnv puts the Pi directory first on PATH',()=>{
 const env=spawnEnv('/opt/custom/bin/pi');
 assert.equal(env.PATH.split(path.delimiter)[0],'/opt/custom/bin');
 assert.equal(env.PI_LEARNING_NO_OBSIDIAN,'1');
});
