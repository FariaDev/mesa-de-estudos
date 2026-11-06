// @ts-check
'use strict';
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');

/* Procedência das atualizações (#109): de onde o app instalado se atualiza.
   A fonte é a MESMA do updater — `install-source.json` no payload do bundle
   (`bundle-runtime.cjs#recordInstallSource`) e, sem ele, a raiz com `.git`
   (clones). O Sobre só mostra o fato; quem aplica continua sendo `updater.cjs`.

   Os rótulos são fatos do disco:
   - `source`: a Mesa roda do código, sem app instalado (comportamento de hoje);
   - `normal`: instalação por zip/Release, ou clone do repositório público, que
     é o jeito normal de instalar (`OFFICIAL_REMOTE`);
   - `development`: bundle ligado a outro clone ou a um worktree, com `.git` válido;
   - `unavailable`: o bundle aponta para uma origem que sumiu ou não é clone —
     o updater não consegue aplicar, então o Sobre não pode dizer "atualizada". */

const OFFICIAL_REMOTE=/github\.com[:/]FariaDev\/mesa-de-estudos(\.git)?\/?\s*$/i;

/**
 * O clone é do repositório público? Só o `origin` conta: um fork ou o repositório
 * privado continuam sendo pasta de desenvolvimento.
 * @param {string} sourcePath raiz do clone
 * @param {(file: string, encoding: 'utf8') => string} readFileSync
 * @returns {boolean}
 * @example isOfficialClone('/Users/ana/Developer/mesa-de-estudos') // true
 */
function isOfficialClone(sourcePath,readFileSync=fs.readFileSync){
 let config;
 try{config=readFileSync(path.join(sourcePath,'.git','config'),'utf8');}
 catch{return false;}
 const section=/\[remote "origin"\]([^[]*)/.exec(config);
 const url=section&&/^\s*url\s*=\s*(.+)$/m.exec(section[1]);
 return !!url&&OFFICIAL_REMOTE.test(url[1]);
}

/**
 * Lê o `install-source.json` do payload exatamente como o `update-host` sempre
 * leu: JSON torto, vazio ou sem `path` conta como ausência (o updater cai em
 * git/zip, e o Sobre mostra o que o updater faria).
 * @param {string} deskDir pasta `desk/` do payload
 * @param {(file: string) => string} [readFile]
 * @returns {{path: string, remote?: string} | null}
 * @example readInstallSource('/Applications/Mesa.app/Contents/Resources/app/desk')
 */
function readInstallSource(deskDir,readFile=file=>fs.readFileSync(file,'utf8')){
 try{
  const source=JSON.parse(readFile(path.join(deskDir,'install-source.json')));
  if(source&&typeof source.path==='string'&&source.path)return source;
 }catch{/* sem install-source.json: instalação por git ou zip */}
 return null;
}

/**
 * Reconhece um checkout git pelo `.git`: diretório é clone comum; arquivo
 * `gitdir: …` é worktree (ou submódulo) e só vale se o gitdir existir.
 * @param {string} sourcePath raiz do clone/worktree
 * @param {{existsSync?: (file: string) => boolean, statSync?: (file: string) => fs.Stats, readFileSync?: (file: string, encoding: 'utf8') => string}} [io]
 * @returns {{worktree: boolean} | null} `null` quando não há checkout válido
 * @example gitCheckout('/home/ana/mesa') // {worktree:false}
 */
function gitCheckout(sourcePath,io={}){
 const existsSync=io.existsSync??fs.existsSync;
 const statSync=io.statSync??fs.statSync;
 const readFileSync=io.readFileSync??fs.readFileSync;
 const gitPath=path.join(sourcePath,'.git');
 let stat;
 try{stat=statSync(gitPath);}
 catch{return null;}
 if(stat.isDirectory())return {worktree:false};
 let content;
 try{content=readFileSync(gitPath,'utf8');}
 catch{return null;}
 const found=/^\s*gitdir:\s*(.+?)\s*$/m.exec(content);
 if(!found)return null;
 const gitDir=path.resolve(sourcePath,found[1]);
 return existsSync(gitDir)?{worktree:true}:null;
}

/**
 * Caminho para mostrar no Sobre: a pasta pessoal vira `~` (o caminho completo
 * não vai para log nem para mensagem de erro) e o resto fica absoluto.
 * @param {string} location caminho absoluto
 * @param {string} [home] pasta pessoal do usuário
 * @returns {string}
 * @example homePathLabel('/home/ana/Dev/mesa','/home/ana') // '~/Dev/mesa'
 */
function homePathLabel(location,home=os.homedir()){
 const full=path.resolve(String(location||''));
 const base=path.resolve(String(home||''));
 const relative=path.relative(base,full);
 const same=process.platform==='win32'?full.toLowerCase()===base.toLowerCase():full===base;
 if(!same&&(relative.startsWith('..')||path.isAbsolute(relative)))return full;
 if(!relative)return '~';
 return path.join('~',relative);
}

/**
 * Fatos da origem para o Sobre. `packaged` é a instalação de verdade
 * (`app.isPackaged`); rodando do código o Sobre fica como hoje.
 * @param {{packaged?: boolean, deskDir?: string, home?: string, readFile?: (file: string) => string, existsSync?: (file: string) => boolean, statSync?: (file: string) => fs.Stats, readFileSync?: (file: string, encoding: 'utf8') => string}} options
 * @returns {{kind: 'source'|'normal'|'development'|'unavailable', path: string, worktree: boolean}}
 * @example updateOrigin({packaged:true,deskDir:'/tmp/app/desk'}) // {kind:'development',path:'~/mesa',worktree:true}
 */
function updateOrigin({packaged=false,deskDir='',home=os.homedir(),readFile,existsSync=fs.existsSync,statSync=fs.statSync,readFileSync=fs.readFileSync}={}){
 const checkoutOf=location=>gitCheckout(location,{existsSync,statSync,readFileSync});
 if(!packaged)return {kind:'source',path:'',worktree:false};
 const source=readInstallSource(deskDir,readFile);
 const sourcePath=source?path.resolve(String(source.path)):path.resolve(deskDir,'..');
 if(source){
  if(!existsSync(sourcePath))return {kind:'unavailable',path:homePathLabel(sourcePath,home),worktree:false};
  const checkout=checkoutOf(sourcePath);
  if(!checkout)return {kind:'unavailable',path:homePathLabel(sourcePath,home),worktree:false};
  if(!checkout.worktree&&isOfficialClone(sourcePath,readFileSync))return {kind:'normal',path:'',worktree:false};
  return {kind:'development',path:homePathLabel(sourcePath,home),worktree:checkout.worktree};
 }
 const rootCheckout=checkoutOf(sourcePath);
 if(rootCheckout&&!rootCheckout.worktree&&isOfficialClone(sourcePath,readFileSync))return {kind:'normal',path:'',worktree:false};
 if(rootCheckout)return {kind:'development',path:homePathLabel(sourcePath,home),worktree:rootCheckout.worktree};
 if(existsSync(path.join(sourcePath,'.git')))return {kind:'unavailable',path:homePathLabel(sourcePath,home),worktree:false};
 return {kind:'normal',path:'',worktree:false};
}

module.exports={readInstallSource,gitCheckout,isOfficialClone,homePathLabel,updateOrigin};
