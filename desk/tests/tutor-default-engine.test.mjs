/* Motor padrão (#93): a ordem de preferência e a detecção de presença. Em
   testMode nenhum processo é executado; fora dele, só o `--version` do OpenCode
   encontrado é lido (1.x não conta). */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const {ENGINE_ORDER,defaultEngineFrom,detectTutorEngines,defaultTutorEngine,engineNames}=require('../tutor-default-engine.cjs');

function fakeBin(dir,name){
 fs.mkdirSync(dir,{recursive:true});
 const file=path.join(dir,name);
 fs.writeFileSync(file,'#!/bin/sh\nexit 0\n');
 fs.chmodSync(file,0o755);
 return file;
}

test('defaultEngineFrom: OpenCode primeiro; sem ele, Claude; sem os dois, OpenCode', () => {
 assert.deepEqual(ENGINE_ORDER,['opencode','claude']);
 assert.equal(defaultEngineFrom({claude:'/c',opencode:'/o'}),'opencode');
 assert.equal(defaultEngineFrom({claude:'/c'}),'claude');
 assert.equal(defaultEngineFrom({opencode:'/o'}),'opencode');
 assert.equal(defaultEngineFrom({}),'opencode','sem motor o padrão é OpenCode');
});

test('engineNames devolve os nomes legíveis na ordem de preferência', () => {
 assert.deepEqual(engineNames({opencode:'/o',claude:'/c'}),['OpenCode','Claude Code']);
 assert.deepEqual(engineNames({}),[]);
});

test('OpenCode 1.x não conta como motor pronto; versão ilegível não bloqueia (#93)', {skip: process.platform === 'win32' && 'o binário falso é script sh'}, () => {
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mesa-default-engine-version-'));
 try{
  const old=fakeBin(dir,'opencode-antigo');
  fs.writeFileSync(old,'#!/bin/sh\necho 1.19.5\n');
  const found=detectTutorEngines({env:{LEARNING_DESK_OPENCODE:old},deskDir:dir,config:{},home:dir,platform:'linux'});
  assert.equal(found.opencode,'','a 1.x confirmada sai da fila');
  assert.equal(found.opencodeOld,'1.19.5');
  assert.equal(defaultEngineFrom({...found,pi:'',claude:''}),'opencode','sem outro motor, o padrão é OpenCode');
  const unknown=fakeBin(dir,'opencode-sem-versao');
  const other=detectTutorEngines({env:{LEARNING_DESK_OPENCODE:unknown},deskDir:dir,config:{},home:dir,platform:'linux'});
  assert.equal(other.opencode,unknown,'versão ilegível não bloqueia');
  assert.equal(other.opencodeOld,undefined);
 } finally { fs.rmSync(dir,{recursive:true,force:true}); }
});

test('opencodePath escolhido à mão conta como motor instalado (#102)', {skip: process.platform === 'win32' && 'o binário falso é script sh'}, () => {
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mesa-default-engine-manual-'));
 try{
  const chosen=fakeBin(dir,'opencode-escolhido');
  fs.writeFileSync(chosen,'#!/bin/sh\necho 2.2.4\n');
  const found=detectTutorEngines({config:{opencodePath:chosen},env:{},deskDir:dir,home:dir,platform:'linux'});
  assert.equal(found.opencode,chosen);
  assert.equal(found.opencodeOld,undefined);
 } finally { fs.rmSync(dir,{recursive:true,force:true}); }
});

test('em testMode só os fakes do ambiente contam', () => {
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mesa-default-engine-'));
 try{
  const claude=fakeBin(dir,'claude'),opencode=fakeBin(dir,'opencode');
  const opencodeOnly=detectTutorEngines({env:{LEARNING_DESK_OPENCODE:opencode},testMode:true,deskDir:dir,config:{},home:dir});
  assert.deepEqual(opencodeOnly,{claude:'',opencode});
  assert.equal(defaultTutorEngine({env:{LEARNING_DESK_OPENCODE:opencode},testMode:true,deskDir:dir,config:{},home:dir}),'opencode');
  const claudeOnly=detectTutorEngines({env:{LEARNING_DESK_CLAUDE:claude,LEARNING_DESK_CLAUDE_HOME:dir},testMode:true,deskDir:dir,config:{claudePath:claude},home:dir});
  assert.equal(claudeOnly.claude,claude);
  assert.equal(defaultEngineFrom(claudeOnly),'claude');
  assert.deepEqual(detectTutorEngines({env:{},testMode:true,deskDir:dir,config:{},home:dir}),{claude:'',opencode:''});
 } finally { fs.rmSync(dir,{recursive:true,force:true}); }
});
