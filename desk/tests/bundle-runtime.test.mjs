import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {runtimePackages}=require('../bundle-runtime.cjs');
const {userDataDirectory}=require('../user-data.cjs');

test('payload resolve peers e versões aninhadas sem depender da fonte',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'mesa-bundle-graph-'));
 try{
  const nm=path.join(root,'source','node_modules'),dest=path.join(root,'payload','node_modules');
  const pkg=(rel,json,js)=>{const dir=path.join(nm,rel);fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'package.json'),JSON.stringify({main:'index.cjs',...json}));fs.writeFileSync(path.join(dir,'index.cjs'),js);};
  pkg('a',{name:'a',dependencies:{b:'2'},peerDependencies:{peer:'1'},optionalDependencies:{absent:'1'}},"module.exports=[require('b'),require('peer')]");
  pkg('a/node_modules/b',{name:'b'},"module.exports='nested-v2'");
  pkg('b',{name:'b'},"module.exports='root-v1'");
  pkg('peer',{name:'peer'},"module.exports='peer'");
  for(const entry of runtimePackages(nm,['a','b'])){const out=path.join(dest,entry.relative);fs.mkdirSync(path.dirname(out),{recursive:true});fs.cpSync(entry.source,out,{recursive:true});}
  fs.rmSync(path.join(root,'source'),{recursive:true});
  const load=createRequire(path.join(root,'payload','entry.cjs'));
  assert.deepEqual(load('a'),['nested-v2','peer']);assert.equal(load('b'),'root-v1');
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('payload recusa dependência obrigatória ausente e nomes que escapam',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'mesa-bundle-missing-'));
 try{fs.mkdirSync(path.join(root,'node_modules'));assert.throws(()=>runtimePackages(path.join(root,'node_modules'),['missing']),/Dependência ausente/);assert.throws(()=>runtimePackages(path.join(root,'node_modules'),['scope\\..\\escape']),/Pacote inválido/);}
 finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('doctor usa userData da plataforma e respeita os overrides',()=>{
 assert.equal(userDataDirectory({platform:'win32',home:'/home',env:{APPDATA:'/roaming'}}),path.join('/roaming','Mesa de Estudos'));
 assert.equal(userDataDirectory({platform:'darwin',home:'/home',env:{}}),path.join('/home','Library','Application Support','Mesa de Estudos'));
 assert.equal(userDataDirectory({platform:'linux',home:'/home',env:{}}),path.join('/home','.config','Mesa de Estudos'));
 assert.equal(userDataDirectory({platform:'linux',home:'/home',env:{XDG_CONFIG_HOME:'/xdg'}}),path.join('/xdg','Mesa de Estudos'));
 assert.equal(userDataDirectory({platform:'win32',env:{LEARNING_DESK_RUNTIME:'/runtime'}}),'/runtime');
});
