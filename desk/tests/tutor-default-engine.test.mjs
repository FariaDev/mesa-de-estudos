/* Motor padrão sem Pi (#93): a ordem de preferência e a detecção de presença.
   Em testMode nenhum processo é executado; fora dele, só o `--version` do
   OpenCode encontrado é lido (1.x não conta), e o Pi real do PATH de quem roda
   os testes nunca decide uma janela de teste. */
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

test('defaultEngineFrom: Pi primeiro; sem Pi, Claude; sem os dois, OpenCode; nada cai no Pi', () => {
 assert.deepEqual(ENGINE_ORDER,['pi','claude','opencode']);
 assert.equal(defaultEngineFrom({pi:'/p',claude:'/c',opencode:'/o'}),'pi');
 assert.equal(defaultEngineFrom({claude:'/c',opencode:'/o'}),'claude');
 assert.equal(defaultEngineFrom({opencode:'/o'}),'opencode');
 assert.equal(defaultEngineFrom({}),'opencode','sem motor o padrão é OpenCode; o erro fala dele, nunca do Pi');
});

test('engineNames devolve os nomes legíveis na ordem de preferência', () => {
 assert.deepEqual(engineNames({opencode:'/o',pi:'/p'}),['Pi','OpenCode']);
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

test('em testMode só os fakes do ambiente contam', () => {
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mesa-default-engine-'));
 try{
  const pi=fakeBin(dir,'pi'),claude=fakeBin(dir,'claude'),opencode=fakeBin(dir,'opencode');
  const opencodeOnly=detectTutorEngines({env:{LEARNING_DESK_OPENCODE:opencode},testMode:true,deskDir:dir,config:{},home:dir});
  assert.deepEqual(opencodeOnly,{pi:'',claude:'',opencode});
  assert.equal(defaultTutorEngine({env:{LEARNING_DESK_OPENCODE:opencode},testMode:true,deskDir:dir,config:{},home:dir}),'opencode');
  const piOnly=detectTutorEngines({env:{LEARNING_DESK_PI:pi},testMode:true,deskDir:dir,config:{},home:dir});
  assert.equal(piOnly.pi,pi);
  assert.equal(defaultEngineFrom(piOnly),'pi');
  const claudeOnly=detectTutorEngines({env:{LEARNING_DESK_CLAUDE:claude,LEARNING_DESK_CLAUDE_HOME:dir},testMode:true,deskDir:dir,config:{claudePath:claude},home:dir});
  assert.equal(claudeOnly.claude,claude);
  assert.equal(defaultEngineFrom(claudeOnly),'claude');
  assert.deepEqual(detectTutorEngines({env:{},testMode:true,deskDir:dir,config:{},home:dir}),{pi:'',claude:'',opencode:''});
 } finally { fs.rmSync(dir,{recursive:true,force:true}); }
});
