import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
const {resolvePi,missingPiMessage,spawnEnv,userBinDirs}=createRequire(import.meta.url)('../pi.cjs');

/* Um app aberto pelo Finder nasce com PATH mínimo (/usr/bin:/bin:...), e o que o
   usuário instalou em casa — bun, homebrew — some do ambiente. Foi assim que o
   servidor MCP de Música não subiu ("env: bun: No such file or directory") e o
   mesmo vale para skills que chamam binário de casa. Os diretórios existentes
   entram antes do PATH herdado. */
test('spawnEnv põe os diretórios de ferramenta do usuário antes do PATH herdado',()=>{
 const env=spawnEnv('/opt/homebrew/bin/pi');
 const parts=env.PATH.split(path.delimiter);
 assert.equal(parts[0],'/opt/homebrew/bin');
 for(const dir of userBinDirs())assert.ok(parts.includes(dir),`${dir} fora do PATH`);
});

test('userBinDirs descarta o que não existe no home',()=>{
 const bogus='/home/que-nao-existe-mesmo';
 const dirs=userBinDirs(bogus);
 assert.ok(dirs.every(d=>!d.startsWith(bogus)));
});

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
 assert.equal(env.PI_OM_PASSIVE,'1');
});
