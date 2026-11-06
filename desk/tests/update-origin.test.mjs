import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fakeIpcMain,fakeShell} from './fake-electron-shell.mjs';
import {tempDir} from './temp-dir.mjs';

/* De onde o app se atualiza (#109): o Sobre usa o MESMO fato do updater
   (`install-source.json` / raiz com `.git`) e não adivinha pasta pessoal.
   Origem normal, pasta de desenvolvimento, worktree e origem inválida; o
   caminho sai com `~` e nunca vai para log. */
const require=createRequire(import.meta.url);
const {readInstallSource,gitCheckout,homePathLabel,updateOrigin}=require('../update-origin.cjs');
const {registerUpdateHost}=require('../update-host.cjs');

const tmp=()=>tempDir('mesa-origin-test');

function newClone(root,{worktree=false}={}){
 fs.mkdirSync(root,{recursive:true});
 if(!worktree){fs.mkdirSync(path.join(root,'.git'),{recursive:true});return root;}
 const gitDir=path.join(tmp(),'gitdir');
 fs.mkdirSync(gitDir,{recursive:true});
 fs.writeFileSync(path.join(root,'.git'),`gitdir: ${gitDir}\n`);
 return root;
}

function writeSource(deskDir,sourcePath){
 fs.mkdirSync(deskDir,{recursive:true});
 fs.writeFileSync(path.join(deskDir,'install-source.json'),JSON.stringify({path:sourcePath,remote:'https://example.com/mesa.git'}));
}

test('readInstallSource: arquivo torto, vazio ou sem path conta como ausência',()=>{
 const desk=tmp();
 assert.equal(readInstallSource(desk),null,'sem arquivo');
 fs.writeFileSync(path.join(desk,'install-source.json'),'{');
 assert.equal(readInstallSource(desk),null,'JSON torto');
 fs.writeFileSync(path.join(desk,'install-source.json'),JSON.stringify({path:''}));
 assert.equal(readInstallSource(desk),null,'path vazio');
 fs.writeFileSync(path.join(desk,'install-source.json'),JSON.stringify({path:'/x',remote:'r'}));
 assert.deepEqual(readInstallSource(desk),{path:'/x',remote:'r'});
});

test('gitCheckout: diretório é clone; arquivo gitdir só vale com o gitdir existente',()=>{
 const clone=newClone(path.join(tmp(),'clone'));
 assert.deepEqual(gitCheckout(clone),{worktree:false});
 const worktree=newClone(path.join(tmp(),'worktree'),{worktree:true});
 assert.deepEqual(gitCheckout(worktree),{worktree:true});
 assert.equal(gitCheckout(path.join(tmp(),'sem-git')),null);
 const broken=path.join(tmp(),'broken');
 fs.mkdirSync(broken,{recursive:true});
 fs.writeFileSync(path.join(broken,'.git'),'gitdir: /caminho/que/sumiu\n');
 assert.equal(gitCheckout(broken),null,'worktree com gitdir sumido não é checkout válido');
});

test('homePathLabel: a pasta pessoal vira ~ e o resto fica absoluto',()=>{
 assert.equal(homePathLabel('/home/ana','/home/ana'),'~');
 assert.equal(homePathLabel('/home/ana/Dev/mesa','/home/ana'),path.join('~','Dev/mesa'));
 assert.equal(homePathLabel('/home/ana2/mesa','/home/ana'),'/home/ana2/mesa','prefixo parecido não é a casa');
 assert.equal(homePathLabel('/opt/mesa','/home/ana'),'/opt/mesa');
});

test('updateOrigin: rodando do código mantém o comportamento de hoje',()=>{
 const desk=tmp();
 assert.deepEqual(updateOrigin({packaged:false,deskDir:desk}),{kind:'source',path:'',worktree:false});
});

test('updateOrigin: instalação sem clone é a Release oficial',()=>{
 const root=tmp(),desk=path.join(root,'app','desk');
 fs.mkdirSync(desk,{recursive:true});
 assert.deepEqual(updateOrigin({packaged:true,deskDir:desk,home:root}),{kind:'normal',path:'',worktree:false});
});

test('updateOrigin: bundle ligado a um clone é pasta de desenvolvimento',()=>{
 const root=tmp(),desk=path.join(root,'app','desk'),clone=newClone(path.join(root,'mesa'));
 writeSource(desk,clone);
 assert.deepEqual(updateOrigin({packaged:true,deskDir:desk,home:root}),{kind:'development',path:path.join('~','mesa'),worktree:false});
});

/* O jeito normal de instalar é clonar o repositório público: dizer "pasta de
   desenvolvimento" ali seria falso para todo usuário, inclusive o autor. */
test('updateOrigin: clone do repositório público é a Release oficial; fork e privado, não',()=>{
 const root=tmp();
 const cases=[
  ['https://github.com/FariaDev/mesa-de-estudos.git','normal'],
  ['git@github.com:FariaDev/mesa-de-estudos.git','normal'],
  ['https://github.com/FariaDev/mesa-de-estudos','normal'],
  ['https://github.com/FariaDev/mesa-e-conversa.git','development'],
  ['https://github.com/outra-pessoa/mesa-de-estudos.git','development'],
 ];
 cases.forEach(([url,kind],index)=>{
  const desk=path.join(root,`app${index}`,'desk'),clone=newClone(path.join(root,`mesa${index}`));
  fs.writeFileSync(path.join(clone,'.git','config'),`[core]\n\tbare = false\n[remote "origin"]\n\turl = ${url}\n\tfetch = +refs/heads/*:refs/remotes/origin/*\n`);
  writeSource(desk,clone);
  assert.equal(updateOrigin({packaged:true,deskDir:desk,home:root}).kind,kind,url);
 });
});

test('updateOrigin: worktree é rotulado como pasta de desenvolvimento (worktree)',()=>{
 const root=tmp(),desk=path.join(root,'app','desk'),worktree=newClone(path.join(root,'Dev','mesa-wt'),{worktree:true});
 writeSource(desk,worktree);
 assert.deepEqual(updateOrigin({packaged:true,deskDir:desk,home:root}),{kind:'development',path:path.join('~','Dev','mesa-wt'),worktree:true});
});

test('updateOrigin: pasta que sumiu é origem indisponível',()=>{
 const root=tmp(),desk=path.join(root,'app','desk'),missing=path.join(root,'sumiu');
 writeSource(desk,missing);
 assert.deepEqual(updateOrigin({packaged:true,deskDir:desk,home:root}),{kind:'unavailable',path:path.join('~','sumiu'),worktree:false});
});

test('updateOrigin: pasta que existe mas não é clone é origem indisponível',()=>{
 const root=tmp(),desk=path.join(root,'app','desk'),plain=path.join(root,'pasta');
 fs.mkdirSync(plain,{recursive:true});
 writeSource(desk,plain);
 assert.deepEqual(updateOrigin({packaged:true,deskDir:desk,home:root}),{kind:'unavailable',path:path.join('~','pasta'),worktree:false});
});

test('updateOrigin: clone na raiz da instalação também é desenvolvimento',()=>{
 const home=tmp(),root=newClone(path.join(home,'mesa')),desk=path.join(root,'desk');
 fs.mkdirSync(desk,{recursive:true});
 assert.deepEqual(updateOrigin({packaged:true,deskDir:desk,home}),{kind:'development',path:homePathLabel(root,home),worktree:false});
});

function hostWith({runtime,deskDir,packaged}){
 const ipcMain=fakeIpcMain();
 registerUpdateHost({
  ipcMain,shell:fakeShell(),runtime,deskDir,logFile:path.join(runtime,'desk.log'),testMode:false,
  app:{isPackaged:packaged,getVersion:()=>'1.1.0'},config:()=>({}),win:()=>null,
  piBinary:()=>'',appendLog:()=>{},toolHost:{state:()=>({}),persist:()=>{},isBusy:()=>false,hasBridge:()=>false,relink:()=>{}},
 });
 return ipcMain;
}

test('host: IPC de origem e "não dá para verificar" quando a pasta sumiu',async()=>{
 const runtime=tmp(),desk=path.join(runtime,'app','desk'),missing=path.join(runtime,'sumiu');
 writeSource(desk,missing);
 const ipcMain=hostWith({runtime,deskDir:desk,packaged:true});
 assert.deepEqual(await ipcMain.invoke('update-origin'),{kind:'unavailable',path:homePathLabel(missing,os.homedir()),worktree:false});
 const check=await ipcMain.invoke('update-check',{manual:true});
 assert.equal(check.status,'unverifiable','origem inválida nunca vira "Atualizada"');
 assert.equal(check.current,'1.1.0');
});

test('host: rodando do código o IPC esconde a origem',async()=>{
 const runtime=tmp();
 const ipcMain=hostWith({runtime,deskDir:runtime,packaged:false});
 assert.deepEqual(await ipcMain.invoke('update-origin'),{kind:'source',path:'',worktree:false});
});
