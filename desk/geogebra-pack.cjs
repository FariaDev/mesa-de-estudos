'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');
const {causeText}=require('./src/error-detail.mjs');

/* Pacote offline do GeoGebra (#55): o "Math Apps Bundle" oficial, baixado por
   QUEM USA a Mesa para `desk/.runtime/geogebra/`. A Mesa não o distribui: a
   licença do GeoGebra é pessoal e intransferível (geogebra.org/license, cláusulas
   2 e 11, atualizada em nov/2025), então o download é opcional, com consentimento
   no `setup`, versão fixada e hash conferido. Sem o pacote, o applet continua
   sendo o da web. O SHA-256 abaixo foi calculado no primeiro download (o
   GeoGebra não publica hash); outro arquivo na mesma URL é recusado. */
const PACK=Object.freeze({
 version:'5.4.932.1',
 url:'https://download.geogebra.org/installers/5.4/geogebra-math-apps-bundle-5-4-932-1.zip',
 sha256:'c139f3edb51c004ec67d83226a1f1215486f8559ad98ee37e9e775aac278e96e',
 bytes:33454039,
 unpackedMegabytes:116,
});
const ENTRY='GeoGebra/deployggb.js';
const INFO_FILE='pack.json';

/** Pasta do pacote dentro do clone: `<root>/desk/.runtime/geogebra`. @param {string} root @returns {string} */
const packDirFor=root=>path.join(root,'desk','.runtime','geogebra');

/** Pasta que o app serve: dentro dela ficam `pack.json` e `GeoGebra/`. @param {string} dir @returns {string} */
const contentRoot=dir=>path.join(dir,'GeoGebra');

/**
 * Lê o `pack.json` e confere que o pacote é a versão fixada e está inteiro.
 * @param {string} dir pasta do pacote
 * @returns {{version:string,sha256:string}|null} `null` se faltar, estiver estragado ou for de outra versão
 * @example readInstalledPack('/x/desk/.runtime/geogebra') // {version:'5.4.932.1',sha256:'…'} ou null
 */
function readInstalledPack(dir){
 if(!dir)return null;
 try{
  const info=JSON.parse(fs.readFileSync(path.join(dir,INFO_FILE),'utf8'));
  if(info?.version!==PACK.version||info?.sha256!==PACK.sha256)return null;
  if(!fs.statSync(path.join(dir,ENTRY)).isFile())return null;
  return {version:info.version,sha256:info.sha256};
 }catch{return null;}
}

/** Baixa a URL inteira para a memória (33 MB). @param {string} url @returns {Promise<Buffer>} */
async function fetchZipBuffer(url){
 const response=await fetch(url,{redirect:'follow'});
 if(!response.ok)throw Error(`Download recusado: ${url} respondeu ${response.status}; esperado 200.`);
 return Buffer.from(await response.arrayBuffer());
}

/** Extrai com o `tar` do sistema (bsdtar lê zip no macOS e no Windows 10+). @param {string} zipFile @param {string} dest */
function extractWithTar(zipFile,dest){
 const run=spawnSync('tar',['-xf',zipFile,'-C',dest],{encoding:'utf8'});
 if(run.error||run.status)throw Error(`Não foi possível extrair o pacote com o tar do sistema (${causeText(run.error||run.stderr.trim())||'status '+run.status}).`);
}

/**
 * Confere tamanho e SHA-256 do zip baixado.
 * @param {Buffer} zip
 * @param {{sha256:string,bytes:number}} [expected]
 * @throws {Error} com o valor recebido e o esperado
 */
function verifyZip(zip,expected=PACK){
 const sha256=crypto.createHash('sha256').update(zip).digest('hex');
 if(zip.length!==expected.bytes||sha256!==expected.sha256)throw Error(`Pacote do GeoGebra não confere: recebido ${zip.length} bytes, sha256 ${sha256}; esperado ${expected.bytes} bytes, sha256 ${expected.sha256}.`);
 return sha256;
}

/**
 * Baixa, confere o hash, extrai numa pasta vizinha e só então troca a pasta final:
 * uma queda no meio nunca deixa um pacote pela metade como se estivesse pronto.
 * @param {{dir:string,fetchZip?:(url:string)=>Promise<Buffer>,extractZip?:(zipFile:string,dest:string)=>void,expected?:typeof PACK,log?:(line:string)=>void}} options
 * @returns {Promise<{dir:string,version:string}>}
 * @example await installPack({dir:packDirFor(root),log:console.log}) // {dir:'…/geogebra',version:'5.4.932.1'}
 */
async function installPack({dir,fetchZip=fetchZipBuffer,extractZip=extractWithTar,expected=PACK,log=()=>{}}){
 log(`Baixando o GeoGebra ${expected.version} de ${expected.url}…`);
 const zip=await fetchZip(expected.url);
 const sha256=verifyZip(zip,expected);
 const staging=`${dir}.parte-${process.pid}`;
 fs.rmSync(staging,{recursive:true,force:true});
 fs.mkdirSync(staging,{recursive:true});
 try{
  const zipFile=path.join(staging,'pacote.zip');
  fs.writeFileSync(zipFile,zip);
  const unpacked=path.join(staging,'conteudo');
  fs.mkdirSync(unpacked);
  log('Hash conferido. Extraindo…');
  extractZip(zipFile,unpacked);
  if(!fs.existsSync(path.join(unpacked,ENTRY)))throw Error(`O pacote extraído não tem ${ENTRY}; esperado o Math Apps Bundle ${expected.version}.`);
  fs.writeFileSync(path.join(unpacked,INFO_FILE),JSON.stringify({version:expected.version,sha256,url:expected.url},null,1)+'\n');
  fs.rmSync(dir,{recursive:true,force:true});
  fs.mkdirSync(path.dirname(dir),{recursive:true});
  fs.renameSync(unpacked,dir);
 }finally{fs.rmSync(staging,{recursive:true,force:true});}
 return {dir,version:expected.version};
}

/** Apaga o pacote baixado (o applet volta a ser o da web). @param {string} dir */
function removePack(dir){fs.rmSync(dir,{recursive:true,force:true});}

module.exports={PACK,ENTRY,INFO_FILE,packDirFor,contentRoot,readInstalledPack,installPack,verifyZip,removePack,fetchZipBuffer,extractWithTar};
