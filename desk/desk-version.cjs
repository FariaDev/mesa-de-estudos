'use strict';

const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');

/* Rótulo de versão do Sobre: versão do app (ou do package.json) e, num clone,
   o `git describe`. Calculado uma vez. Saiu do main.cjs na #43 fase 2. */

/**
 * @param {{app:{getVersion:()=>string}, deskDir:string}} options app do Electron e pasta desk/
 * @returns {()=>string} rótulo memorizado, como "0.5.0 ca681f7-dirty"
 * @example const deskVersionLabel=createDeskVersionLabel({app,deskDir});
 */
function createDeskVersionLabel({app,deskDir}){
 let deskVersionMemo=null;
 return function deskVersionLabel(){
  if(deskVersionMemo!=null)return deskVersionMemo;
  let version='';
  try{version=app.getVersion()||'';}catch{/* sem versão do app: cai no package.json */}
  if(!version){try{version=require('./package.json').version||'';}catch{/* sem versão: o rótulo fica vazio */}}
  let suffix='';
  try{
   const repoRoot=path.join(deskDir,'..');
   if(version&&fs.existsSync(path.join(repoRoot,'.git')))suffix=execFileSync('git',['describe','--always','--dirty'],{cwd:repoRoot,timeout:5000}).toString().trim();
  }catch{/* sem git ou timeout: o rótulo fica sem sufixo */}
  deskVersionMemo=suffix?`${version} ${suffix}`:version;
  return deskVersionMemo;
 };
}

/**
 * A versão que decide a janela de novidades. Em teste, só a da chave
 * `LEARNING_DESK_RELEASE_VERSION`: sem ela, os testes de janela não dependem do
 * número do `package.json` nem ganham um modal a cada release.
 * @param {string} label rótulo do Sobre
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {string}
 * @example releaseNotesVersion('1.1.0 ca681f7-dirty', {}) // '1.1.0'
 */
function releaseNotesVersion(label,env=process.env){
 if(env.DESK_TEST==='1')return String(env.LEARNING_DESK_RELEASE_VERSION||'');
 return String(label||'').split(' ')[0];
}

module.exports={createDeskVersionLabel,releaseNotesVersion};
