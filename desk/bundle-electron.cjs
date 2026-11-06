'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');

/* O update trocava só o payload do `.app`: atualizando da 1.0.2 para a 1.1.0, o
   Electron do bundle ficava no 44 enquanto o `package.json` pedia o 45 (#103).
   Mora fora do `installBundle` porque o teste do app empacotado monta o bundle
   já na versão certa. */

function readPlistValue(plist,key){
 try{return execFileSync('plutil',['-extract',key,'raw',plist],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();}
 catch{return '';}
}

function writePlistValue(plist,key,value){
 execFileSync('plutil',['-replace',key,'-string',value,plist],{stdio:'pipe'});
}

/* `ditto` preserva os symlinks e os atributos dos frameworks do Electron. */
function copyAppTree(from,to){
 execFileSync('ditto',[from,to],{stdio:'pipe'});
}

const SYSTEM_DEPS={readPlistValue,writePlistValue,copyAppTree};

/**
 * Cria o `.app` a partir do Electron de `node_modules`, se ele ainda não existir.
 * @param {{source: string, app: string, deps?: typeof SYSTEM_DEPS}} input `source` é o Electron.app
 * @returns {boolean} true quando criou
 * @example ensureBundleExists({source: 'node_modules/electron/dist/Electron.app', app: 'Mesa de Estudos.app'})
 */
function ensureBundleExists({source,app,deps=SYSTEM_DEPS}){
 if(fs.existsSync(path.join(app,'Contents','Info.plist')))return false;
 if(!fs.existsSync(path.join(source,'Contents','Info.plist')))throw Error(`Electron ausente: esperava ${JSON.stringify(source)}; rode npm ci`);
 deps.copyAppTree(source,app);
 return true;
}

/* Troca por renomeação: o bundle nunca fica sem frameworks, e uma falha na troca
   devolve os antigos. */
function swapRuntime({source,app,deps}){
 const contents=path.join(app,'Contents');
 const parts=[['Frameworks'],['MacOS','Electron']];
 const staged=parts.map((rel)=>({rel,live:path.join(contents,...rel),next:path.join(contents,...rel)+'.novo',old:path.join(contents,...rel)+'.antigo'}));
 const swapped=[];
 try{
  for(const item of staged)deps.copyAppTree(path.join(source,'Contents',...item.rel),item.next);
  for(const item of staged){
   fs.renameSync(item.live,item.old);
   swapped.push(item);
   fs.renameSync(item.next,item.live);
  }
 }catch(error){
  for(const item of swapped.reverse()){
   fs.rmSync(item.live,{recursive:true,force:true});
   fs.renameSync(item.old,item.live);
  }
  throw error;
 }finally{
  for(const item of staged)fs.rmSync(item.next,{recursive:true,force:true});
 }
 for(const item of staged)fs.rmSync(item.old,{recursive:true,force:true});
}

/**
 * Deixa o Electron do `.app` na versão de `node_modules`. O install-app assina depois.
 * @param {{source: string, app: string, deps?: typeof SYSTEM_DEPS}} input `source` é o Electron.app
 * @returns {{changed: boolean, from: string, to: string}}
 * @example syncBundleElectron({source: 'node_modules/electron/dist/Electron.app', app: 'Mesa de Estudos.app'})
 */
function syncBundleElectron({source,app,deps=SYSTEM_DEPS}){
 const sourcePlist=path.join(source,'Contents','Info.plist'),appPlist=path.join(app,'Contents','Info.plist');
 const to=deps.readPlistValue(sourcePlist,'CFBundleVersion');
 if(!to)throw Error(`versão do Electron ilegível: esperava CFBundleVersion em ${JSON.stringify(sourcePlist)}`);
 const from=deps.readPlistValue(appPlist,'CFBundleVersion');
 if(from===to)return {changed:false,from,to};
 swapRuntime({source,app,deps});
 deps.writePlistValue(appPlist,'CFBundleVersion',to);
 const minimum=deps.readPlistValue(sourcePlist,'LSMinimumSystemVersion');
 if(minimum)deps.writePlistValue(appPlist,'LSMinimumSystemVersion',minimum);
 return {changed:true,from,to};
}

module.exports={ensureBundleExists,syncBundleElectron};
