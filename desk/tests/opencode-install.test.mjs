/* Instalação do OpenCode (#release OpenCode): alvo npm, SRI, cópia atômica
   (sem script remoto) e o fluxo completo com tar real, rede e HOME falsos.
   Nada aqui toca no HOME da pessoa, no OpenCode 1.19.5 nem no servidor do T3. */
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {EventEmitter} from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {ptText} from './pt-text.mjs';

const require=createRequire(import.meta.url);
const {runCommand,PINNED_VERSION,OpenCodeInstallError,openCodeTarget,openCodeInstallSupported,installOpenCode,placeBinary}=require('../src/agents/opencode-install.cjs');
const {loginBinary}=await import('../src/setup-view.mjs');
import ptBR from '../src/locales/pt-BR.json' with {type: 'json'};
import en from '../src/locales/en.json' with {type: 'json'};

const response=(body)=>({ok:true,status:200,headers:{get:()=>body.length===undefined?null:String(body.length)},json:async()=>body,text:async()=>body});

function cpu({avx2=true,musl=false}={}){
 return {
  readFile(file){
   if(file==='/proc/cpuinfo')return avx2?'flags : fpu avx2\n':'flags : fpu\n';
   if(file==='/etc/alpine-release'&&musl)return '3.20\n';
   const error=Error(`ENOENT: ${file}`);error.code='ENOENT';throw error;
  },
  runSync:()=>({stdout:''}),
 };
}

function sourceBinary(root,text='#!/bin/sh\necho 2.2.4\n'){
 const file=path.join(root,'opencode-download');
 fs.writeFileSync(file,text);
 fs.chmodSync(file,0o755);
 return file;
}

function binFiles(home){
 try{return fs.readdirSync(path.join(home,'.opencode','bin')).sort();}catch{return [];}
}

test('openCodeTarget escolhe o pacote do instalador v2',()=>{
 const linux=cpu();
 assert.equal(openCodeTarget({platform:'linux',arch:'x64',...linux}),'linux-x64');
 assert.equal(openCodeTarget({platform:'linux',arch:'x64',...cpu({avx2:false})}),'linux-x64-baseline');
 assert.equal(openCodeTarget({platform:'linux',arch:'x64',...cpu({musl:true})}),'linux-x64-musl');
 assert.equal(openCodeTarget({platform:'darwin',arch:'arm64',...linux}),'darwin-arm64');
 const windows={...linux,runSync:()=>({stdout:'1'})};
 assert.equal(openCodeTarget({platform:'win32',arch:'x64',...windows}),'windows-x64');
 assert.equal(openCodeTarget({platform:'freebsd',arch:'x64',...linux}),'');
 assert.equal(openCodeInstallSupported({platform:'freebsd',arch:'x64',...linux}),false);
});

test('installOpenCode baixa o pacote fixado, confere o SRI e coloca o binário sem script remoto',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'mesa-opencode-install-'));
 const home=path.join(root,'home'),work=path.join(root,'work');
 try{
  fs.mkdirSync(path.join(work,'package','bin'),{recursive:true});
  const binary=path.join(work,'package','bin','opencode');
  fs.writeFileSync(binary,'#!/bin/sh\necho 2.2.4\n');
  fs.chmodSync(binary,0o755);
  const archive=path.join(root,'opencode.tgz');
  const packed=spawnSync('tar',['-czf',archive,'-C',work,'package'],{encoding:'utf8'});
  assert.equal(packed.status,0,packed.stderr);
  const bytes=fs.readFileSync(archive);
  const integrity='sha512-'+crypto.createHash('sha512').update(bytes).digest('base64');
  const calls=[];
  const fetchImpl=async url=>{
   calls.push(url);
   if(url.includes('/@opencode%2fcli-linux-x64/2.2.4'))return response({dist:{integrity,tarball:'https://example.test/opencode.tgz'}});
   if(url==='https://example.test/opencode.tgz'){
    return {ok:true,status:200,headers:{get:()=>String(bytes.length)},body:(async function*(){yield bytes;})()};
   }
   throw Error(`fetch inesperado: ${url}`);
  };
  const phases=[],commands=[];
  const spawnProcess=(file,args,options)=>{
   commands.push(file);
   if(file==='tar')return spawn(file,args,options);
   const child=new EventEmitter();
   child.stdout=new EventEmitter();child.stdout.setEncoding=()=>{};child.stderr=new EventEmitter();child.stderr.setEncoding=()=>{};
   child.stdin={end:()=>{}};child.kill=()=>{};
   setImmediate(()=>{
    if(args.includes('--version'))child.stdout.emit('data','opencode v2.2.4\n');
    child.emit('close',0);
   });
   return child;
  };
  const result=await installOpenCode({home,platform:'linux',arch:'x64',...cpu(),fetchImpl,spawnProcess,onProgress:p=>phases.push(p.phase)});
  assert.equal(PINNED_VERSION,'2.2.4');
  assert.equal(result.ok,true);
  assert.equal(result.version,'2.2.4');
  assert.equal(result.binary,path.join(home,'.opencode','bin','opencode'));
  assert.equal(fs.readFileSync(result.binary,'utf8'),'#!/bin/sh\necho 2.2.4\n');
  assert.equal(fs.existsSync(path.join(home,'.opencode','bin','opencode2')),true);
  assert.deepEqual(binFiles(home),['opencode','opencode2'],'sem temporário sobrando');
  assert.deepEqual([...new Set(phases)],['prepare','download','extract','install','verify','done']);
  assert.ok(calls.every(url=>!url.includes('opencode.ai/v2/install')),'nenhum instalador remoto é chamado');
  assert.deepEqual([...new Set(commands.map(file=>path.basename(file)))].sort(),['opencode','tar'],'só tar e o --version do binário instalado');
 } finally {fs.rmSync(root,{recursive:true,force:true});}
});

test('installOpenCode recusa SRI que não confere e plataforma desconhecida',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'mesa-opencode-install-bad-'));
 try{
  const unsupported=await installOpenCode({home:root,platform:'freebsd',arch:'x64',...cpu()}).catch(error=>error);
  assert.equal(unsupported.code,'unsupported');
  const bytes=Buffer.from('nao-e-o-pacote');
  const fetchImpl=async url=>{
   if(url.includes('/@opencode%2fcli-linux-x64/2.2.4'))return response({dist:{integrity:'sha512-AAAA',tarball:'https://example.test/bad.tgz'}});
   if(url==='https://example.test/bad.tgz')return {ok:true,status:200,headers:{get:()=>String(bytes.length)},body:(async function*(){yield bytes;})()};
   throw Error(`fetch inesperado: ${url}`);
  };
  const error=await installOpenCode({home:root,platform:'linux',arch:'x64',...cpu(),fetchImpl}).catch(reason=>reason);
  assert.ok(error instanceof OpenCodeInstallError);
  assert.equal(error.code,'integrity');
 } finally {fs.rmSync(root,{recursive:true,force:true});}
});

test('a confirmação da atualização avisa que outros programas usam o mesmo OpenCode',()=>{
 assert.equal(ptBR['firstrun.tutor.opencodeOldConfirm'],'Atualizar o OpenCode {version}? A Mesa troca o programa pela versão 2.2.4. Outros programas no seu computador que usam esse OpenCode também passarão a usar a versão nova. Suas conversas e preferências continuam.');
 assert.equal(en['firstrun.tutor.opencodeOldConfirm'],'Update OpenCode {version}? The Mesa replaces the program with version 2.2.4. Other programs on your computer that use this OpenCode will also start using the new version. Your conversations and preferences stay.');
 assert.doesNotMatch(ptBR['firstrun.tutor.opencodeOldConfirm'],/T3 Code|~\/\.opencode/);
 assert.doesNotMatch(en['firstrun.tutor.opencodeOldConfirm'],/T3 Code|~\/\.opencode/);
});

test('o comando de login usa o caminho do binário, com ~ colável e aspas só com espaço',()=>{
 assert.equal(loginBinary('/home/ana/.opencode/bin/opencode','linux'),'~/.opencode/bin/opencode');
 assert.equal(loginBinary('/home/ana/.opencode/bin/opencode','darwin'),'~/.opencode/bin/opencode');
 assert.equal(loginBinary('/home/Ana Maria/.opencode/bin/opencode','linux'),'"/home/Ana Maria/.opencode/bin/opencode"');
 assert.equal(loginBinary('/opt/opencode/bin/opencode','linux'),'/opt/opencode/bin/opencode');
 assert.equal(loginBinary('C:\\Users\\ana\\.opencode\\bin\\opencode','win32'),'C:\\Users\\ana\\.opencode\\bin\\opencode.exe');
 assert.equal(loginBinary('', 'linux'),'');
});

/* O Windows recusa renomear sobre arquivo aberto; o caminho dele é `replaceWindows`. */
test('placeBinary troca por rename atômico e quem está rodando segue no arquivo antigo',{skip:process.platform==='win32'&&'rename sobre arquivo aberto é só POSIX'},async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'mesa-opencode-atomic-'));
 try{
  const home=path.join(root,'home'),bin=path.join(home,'.opencode','bin');
  fs.mkdirSync(bin,{recursive:true});
  const installed=path.join(bin,'opencode'),old='#!/bin/sh\necho 1.19.5\n',fresh='#!/bin/sh\necho 2.2.4\n';
  fs.writeFileSync(installed,old);fs.chmodSync(installed,0o755);
  const fd=fs.openSync(installed,'r');
  try{
   await placeBinary({binary:sourceBinary(root,fresh),home,platform:'linux'});
   const fromFd=Buffer.alloc(Buffer.byteLength(old));
   fs.readSync(fd,fromFd,0,fromFd.length,0);
   assert.equal(fromFd.toString(),old,'o processo antigo continua lendo o arquivo antigo');
  }finally{fs.closeSync(fd);}
  assert.equal(fs.readFileSync(installed,'utf8'),fresh,'o destino é o binário novo');
  assert.deepEqual(binFiles(home),['opencode','opencode2'],'sem temporário sobrando');
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('placeBinary preserva symlink para dentro da pasta e recusa link para fora',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'mesa-opencode-symlink-'));
 try{
  const home=path.join(root,'home'),bin=path.join(home,'.opencode','bin');
  fs.mkdirSync(bin,{recursive:true});
  const target=path.join(bin,'opencode-2.2.3');
  fs.writeFileSync(target,'#!/bin/sh\necho 2.2.3\n');
  fs.symlinkSync('opencode-2.2.3',path.join(bin,'opencode'));
  await placeBinary({binary:sourceBinary(root),home,platform:'linux'});
  assert.equal(fs.lstatSync(path.join(bin,'opencode')).isSymbolicLink(),true,'o symlink continua symlink');
  assert.equal(fs.readFileSync(target,'utf8'),'#!/bin/sh\necho 2.2.4\n','o alvo dentro da pasta foi trocado');
  assert.deepEqual(binFiles(home),['opencode','opencode-2.2.3','opencode2'],'sem temporário sobrando');

  const outside=path.join(root,'outside'),outsideFile=path.join(outside,'opencode');
  fs.mkdirSync(outside,{recursive:true});fs.writeFileSync(outsideFile,'fora');
  const other=path.join(root,'other');
  const otherBin=path.join(other,'.opencode','bin');
  fs.mkdirSync(otherBin,{recursive:true});
  fs.symlinkSync(outsideFile,path.join(otherBin,'opencode'));
  const error=await placeBinary({binary:sourceBinary(root),home:other,platform:'linux'}).catch(reason=>reason);
  assert.equal(error.code,'symlink','link para fora não é seguido');
  assert.equal(fs.readFileSync(outsideFile,'utf8'),'fora','nada foi escrito fora da pasta');
  assert.equal(fs.lstatSync(path.join(otherBin,'opencode')).isSymbolicLink(),true);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('falha no meio não quebra o binário anterior nem deixa temporário',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'mesa-opencode-fail-'));
 try{
  const home=path.join(root,'home'),bin=path.join(home,'.opencode','bin');
  fs.mkdirSync(bin,{recursive:true});
  const installed=path.join(bin,'opencode'),old='#!/bin/sh\necho 1.19.5\n';
  fs.writeFileSync(installed,old);
  const fsp=await import('node:fs/promises');
  const copyFile=async(from,to)=>{await fsp.writeFile(to,'parcial');throw Object.assign(Error('disco cheio'),{code:'ENOSPC'});};
  const error=await placeBinary({binary:sourceBinary(root),home,platform:'linux',copyFile}).catch(reason=>reason);
  assert.equal(error.code,'space','ENOSPC vira falta de espaço');
  assert.equal(fs.readFileSync(installed,'utf8'),old,'o destino anterior fica intacto');
  assert.deepEqual(binFiles(home),['opencode'],'nenhum temporário sobrando');
  const denied=await placeBinary({binary:sourceBinary(root),home,platform:'linux',copyFile:async()=>{throw Object.assign(Error('negado'),{code:'EACCES'});}}).catch(reason=>reason);
  assert.equal(denied.code,'permission','EACCES vira falta de permissão');
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('Windows: troca o .exe pelo .old-<timestamp> e falha em uso pede para fechar os programas',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'mesa-opencode-windows-'));
 try{
  const home=path.join(root,'home'),bin=path.join(home,'.opencode','bin');
  fs.mkdirSync(bin,{recursive:true});
  const installed=path.join(bin,'opencode.exe'),old='exe-antigo';
  fs.writeFileSync(installed,old);
  const placed=await placeBinary({binary:sourceBinary(root,'exe-novo'),home,platform:'win32'});
  assert.equal(placed,installed);
  assert.equal(fs.readFileSync(installed,'utf8'),'exe-novo');
  assert.match(fs.readFileSync(path.join(bin,'opencode2.cmd'),'utf8'),/opencode\.exe/);
  assert.deepEqual(binFiles(home),['opencode.exe','opencode2.cmd'],'o .old sai quando não está em uso');

  const busyHome=path.join(root,'busy');
  const busyBin=path.join(busyHome,'.opencode','bin');
  fs.mkdirSync(busyBin,{recursive:true});
  const busy=path.join(busyBin,'opencode.exe');
  fs.writeFileSync(busy,old);
  const fsp=await import('node:fs/promises');
  const rename=async(from,to)=>{
   if(from===busy)throw Object.assign(Error('em uso'),{code:'EPERM'});
   return fsp.rename(from,to);
  };
  const error=await placeBinary({binary:sourceBinary(root,'exe-novo'),home:busyHome,platform:'win32',rename}).catch(reason=>reason);
  assert.equal(error.code,'busy');
  assert.match(ptText(error.message),/Feche os programas que usam o OpenCode/);
  assert.equal(fs.readFileSync(busy,'utf8'),old,'o .exe anterior fica intacto');
  assert.deepEqual(binFiles(busyHome),['opencode.exe'],'sem temporário sobrando');

  const rollbackHome=path.join(root,'rollback');
  const rollbackBin=path.join(rollbackHome,'.opencode','bin');
  fs.mkdirSync(rollbackBin,{recursive:true});
  const rollback=path.join(rollbackBin,'opencode.exe');
  fs.writeFileSync(rollback,old);
  let moved=false;
  const renameRollback=async(from,to)=>{
   if(from===rollback&&to.includes('.old-')){moved=true;return fsp.rename(from,to);}
   if(moved&&from.includes('.opencode-new-')){moved=false;throw Object.assign(Error('em uso'),{code:'EBUSY'});}
   return fsp.rename(from,to);
  };
  const rollbackError=await placeBinary({binary:sourceBinary(root,'exe-novo'),home:rollbackHome,platform:'win32',rename:renameRollback}).catch(reason=>reason);
  assert.equal(rollbackError.code,'busy');
  assert.equal(fs.readFileSync(rollback,'utf8'),old,'o antigo volta ao lugar depois da falha');
  assert.deepEqual(binFiles(rollbackHome),['opencode.exe'],'sem temporário sobrando');
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('comando que sai sem ler stdin não derruba o processo com EPIPE',async()=>{
 const child=new EventEmitter();
 child.stdout=new EventEmitter();child.stdout.setEncoding=()=>{};
 child.stderr=new EventEmitter();child.stderr.setEncoding=()=>{};
 child.stdin=new EventEmitter();
 child.stdin.end=()=>{setImmediate(()=>{
  child.stdin.emit('error',Object.assign(Error('write EPIPE'),{code:'EPIPE'}));
  child.emit('close',0);
 });};
 const result=await runCommand('fake',[],{spawnProcess:()=>child});
 assert.equal(result.stdout,'');
});
