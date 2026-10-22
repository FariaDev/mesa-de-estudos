'use strict';

const fs=require('node:fs');
const path=require('node:path');
const zlib=require('node:zlib');
const {CODE_DIRS,CODE_ROOT_DIRS,CODE_ROOT_FILES,SKIP_TREE}=require('./updater-core.cjs');

/* Atualização — arquivos: o que é código substituível e o que é protegido,
   zip mínimo (inflateRaw), destino real sem symlink, manifesto da instalação,
   aplicação do zip e instantâneo/rollback.
   Saiu de updater.cjs na #43 fase 2; o worker copia este arquivo junto
   (`WORKER_FILES`). */

function normalizeRel(rel){
 return String(rel||'').replace(/\\/g,'/').replace(/^\.\//,'').replace(/^\/+/,'');
}
/* O cinto de segurança do modo zip: mesmo que a lista de código erre, nada
   destes caminhos sai do zip para o disco do usuário. */
function isProtected(rel){
 const norm=normalizeRel(rel);
 if(!norm)return true;
 const parts=norm.split('/');
 if(parts.some(p=>p==='..'||p===''))return true;
 if(/^[a-zA-Z]:/.test(norm))return true;
 if(/(^|\/)(config\.json|desk\.json|install-source\.json|\.update-manifest\.json)$/i.test(norm))return true;
 if(/(^|\/)\.runtime(\/|$)/.test(norm))return true;
 if(/(^|\/)node_modules(\/|$)/.test(norm))return true;
 if(/\.(jsonl|xopp|pdf|log)$/i.test(norm))return true;
 if(/\.app(\/|$)/.test(norm))return true;
 return false;
}
/* Lista explícita do que o modo zip pode substituir: módulos de código e
   documentos de UI do desk (tests incluído — o manifesto apaga o órfão),
   o miolo de src/assets/templates/locales/scripts/tests e as árvores de código do
   repo (core/geogebra/visual-check/.githooks + raiz + docs/agents/*.md).
   `locales` fica na lista (#72) para o manifesto de quem já está na 1.0.0
   apagar `desk/locales/`; os catálogos novos moram em `src/locales`.
   Nada fora desta lista é tocado — e a lista nunca inclui o protegido. */
function isReplaceable(rel){
 const norm=normalizeRel(rel);
 if(!norm||isProtected(norm))return false;
 const parts=norm.split('/');
 const [first,second]=parts;
 if(first==='desk'&&parts.length===2){
  return /\.(cjs|mjs|html|css|md|json)$/i.test(second)&&!/^(config|desk)\.json$/.test(second);
 }
 if(first==='desk'&&parts.length>2)return CODE_DIRS.has(second);
 /* Só docs/agents/*.md: o AGENTS.md, o README e o SETUP apontam para eles;
    o resto de docs/ é pesado e fica de fora. */
 if(first==='docs')return parts.length===3&&second==='agents'&&/\.md$/i.test(parts[2]);
 if(parts.length>1)return CODE_ROOT_DIRS.has(first);
 return CODE_ROOT_FILES.has(norm);
}
/* Zip mínimo (leitura): codeload entrega .zip e o worker não pode depender de
   unzip/tar — parsing próprio com inflateRaw do zlib. */
function readZip(buffer){
 const end=buffer.lastIndexOf(Buffer.from([0x50,0x4b,0x05,0x06]));
 if(end<0)throw Error(`zip sem diretório central: ${buffer.length} bytes sem a assinatura PK\\x05\\x06`);
 const count=buffer.readUInt16LE(end+10);
 const cdOffset=buffer.readUInt32LE(end+16);
 const entries=[];
 let pos=cdOffset;
 for(let i=0;i<count;i++){
  if(buffer.readUInt32LE(pos)!==0x02014b50)throw Error('zip corrompido (entrada '+i+')');
  const method=buffer.readUInt16LE(pos+10);
  const size=buffer.readUInt32LE(pos+20);
  const nameLen=buffer.readUInt16LE(pos+28);
  const extraLen=buffer.readUInt16LE(pos+30);
  const commentLen=buffer.readUInt16LE(pos+32);
  const localAt=buffer.readUInt32LE(pos+42);
  const name=buffer.toString('utf8',pos+46,pos+46+nameLen);
  pos+=46+nameLen+extraLen+commentLen;
  if(name.endsWith('/'))continue;
  if(buffer.readUInt32LE(localAt)!==0x04034b50)throw Error('zip corrompido (cabeçalho de '+name+')');
  const localNameLen=buffer.readUInt16LE(localAt+26);
  const localExtraLen=buffer.readUInt16LE(localAt+28);
  const dataAt=localAt+30+localNameLen+localExtraLen;
  const raw=buffer.subarray(dataAt,dataAt+size);
  const data=method===0?Buffer.from(raw):method===8?zlib.inflateRawSync(raw):null;
  if(!data)throw Error('zip com método de compressão não suportado ('+method+')');
  entries.push({name,data});
 }
 return entries;
}
/* Zip-slip fica barrado antes de qualquer escrita: nada de `..`, absoluto ou
   unidade de disco nos nomes do zip. */
function assertSafeEntries(entries){
 for(const entry of entries){
  const norm=normalizeRel(entry.name);
  if(!norm||norm.split('/').some(p=>p==='..')||/^[a-zA-Z]:/.test(norm)||entry.name.startsWith('/')){
   throw Error('zip com caminho suspeito: '+entry.name);
  }
 }
}
function stripCommonRoot(entries){
 const names=entries.map(e=>normalizeRel(e.name));
 const first=names[0]?names[0].split('/')[0]:null;
 const nested=first&&names.every(n=>n.startsWith(first+'/'));
 return entries.map((entry,i)=>({name:nested?names[i].slice(first.length+1):names[i],data:entry.data}));
}
/* writeFileSync/copyFileSync SEGUEM links: alvo que é symlink (ou que mora
   dentro de um diretório que é) pode pousar fora da raiz gerenciada. O par
   abaixo lê o destino com lstat e recusa antes de qualquer escrita — link para
   fora, link para dentro, tanto faz: conservador, nenhum link é seguido. */
function assertRealTarget(rootDir,abs,rel){
 try{
  const st=fs.lstatSync(abs);
  if(st.isSymbolicLink())throw Error(`alvo é link simbólico (${rel}) — recusado`);
  if(!st.isFile()&&!st.isDirectory())throw Error(`alvo não é arquivo regular (${rel}) — recusado`);
 }catch(e){
  if(e&&e.code==='ENOENT')return; // não existe ainda: nada a seguir
  throw e;
 }
 const root=path.resolve(rootDir);
 let cur=path.dirname(path.resolve(abs));
 while(cur===root||cur.startsWith(root+path.sep)){
  if(cur===root)break;
  let st;
  try{st=fs.lstatSync(cur);}catch(e){if(e&&e.code==='ENOENT')break;throw e;}
  if(st.isSymbolicLink())throw Error(`diretório pai é link simbólico (${cur}) — recusado`);
  cur=path.dirname(cur);
 }
}
/* O que a instalação CONSIDERA gerenciado, por versão, gravado no disco:
   o próximo update apaga o que era gerenciado e sumiu da versão nova
   (órfão) e preserva o que nunca esteve no manifesto (arquivo local). */
function manifestFile(rootDir){
 return path.join(rootDir,'.update-manifest.json');
}
function readManifest(rootDir){
 try{
  const data=JSON.parse(fs.readFileSync(manifestFile(rootDir),'utf8'));
  if(data&&Array.isArray(data.files))return data.files.filter(f=>typeof f==='string');
 }catch{}
 return [];
}
function writeManifest(rootDir,version,files){
 try{
  fs.mkdirSync(path.dirname(manifestFile(rootDir)),{recursive:true});
  fs.writeFileSync(manifestFile(rootDir),JSON.stringify({version,at:new Date().toISOString(),files},null,2)+'\n');
 }catch{}
}
/* Órfão = estava no manifesto anterior e não voltou na versão nova. */
function removeOrphans(rootDir,previous,written,log=()=>{}){
 const now=new Set(written);
 let removed=0;
 for(const rel of previous||[]){
  const norm=normalizeRel(rel);
  if(!norm||now.has(norm))continue;
  /* O manifesto é dado do disco: só apaga o que a lista de código aceita —
     entrada adulterada (`../x`, absoluto) nunca vira delete fora da raiz. */
  if(!isReplaceable(norm)){log('update: entrada de manifesto recusada: '+norm);continue;}
  const target=path.join(rootDir,...norm.split('/'));
  try{
   fs.rmSync(target,{force:true});
   removed++;
   log('update: órfão gerenciado removido: '+norm);
  }catch(e){log('update: órfão não removido ('+norm+'): '+String(e&&e.message||e));}
 }
 return removed;
}
/* Aplica o zip com o staging conferido ANTES da cópia: a versão do
   `package.json` extraído bate com a anunciada, SÓ a lista explícita é
   copiada, protegido nunca, alvo com link simbólico recusado ANTES da
   escrita. Devolve os arquivos escritos (`written`, vira o manifesto novo),
   os criados (o rollback apaga) e os pulados. */
function applyZip(buffer,{rootDir,announcedVersion='',log=()=>{},created=[],written=[]}={}){
 const raw=readZip(buffer);
 assertSafeEntries(raw);
 const entries=stripCommonRoot(raw);
 assertSafeEntries(entries);
 const pkg=entries.find(e=>e.name==='desk/package.json');
 if(!pkg)throw Error(`zip sem desk/package.json: ${entries.length} entradas, nenhuma com esse nome`);
 let version;
 try{version=String(JSON.parse(pkg.data.toString('utf8')).version||'');}catch{throw Error('desk/package.json ilegível no zip');}
 if(announcedVersion&&version!==String(announcedVersion)){
  throw Error(`a versão do zip (${version}) não bate com a anunciada (${announcedVersion})`);
 }
 let replaced=0,skipped=0;
 for(const entry of entries){
  if(!isReplaceable(entry.name)){skipped++;if(isProtected(entry.name))log('update: ignorado (protegido): '+entry.name);continue;}
  const target=path.join(rootDir,...entry.name.split('/'));
  const rel=path.relative(rootDir,target);
  if(rel.startsWith('..')||path.isAbsolute(rel))throw Error('alvo fora da raiz: '+entry.name);
  assertRealTarget(rootDir,target,rel);
  const existed=fs.existsSync(target);
  fs.mkdirSync(path.dirname(target),{recursive:true});
  fs.writeFileSync(target,entry.data);
  if(!existed)created.push(entry.name);
  written.push(entry.name);
  replaced++;
 }
 return {created,written,replaced,skipped,version};
}
/* O que o rollback precisa para devolver a versão antiga: SOMENTE os arquivos
   que a atualização gerencia (a lista explícita + o manifesto anterior) —
   nunca a raiz toda (PDFs, config.json e árvores de outros produtos ficam
   fora do instantâneo por construção). `include` é o predicado da lista. */
function snapshotTree(rootDir,backupDir,include){
 const files=[];
 const walk=(rel)=>{
  const abs=rel?path.join(rootDir,rel):rootDir;
  for(const entry of fs.readdirSync(abs,{withFileTypes:true})){
   const childRel=rel?path.join(rel,entry.name):entry.name;
   if(entry.isDirectory()){
    if(SKIP_TREE.has(entry.name)||entry.name.endsWith('.app')||entry.name.startsWith('.test-runtime-'))continue;
    walk(childRel);
    continue;
   }
   if(!entry.isFile())continue;
   if(include&&!include(childRel))continue;
   const dest=path.join(backupDir,childRel);
   fs.mkdirSync(path.dirname(dest),{recursive:true});
   fs.copyFileSync(path.join(rootDir,childRel),dest);
   files.push(childRel);
  }
 };
 walk('');
 return files;
}
function restoreTree(rootDir,backupDir,created=[]){
 const files=[];
 const walk=(rel)=>{
  const abs=rel?path.join(backupDir,rel):backupDir;
  for(const entry of fs.readdirSync(abs,{withFileTypes:true})){
   const childRel=rel?path.join(rel,entry.name):entry.name;
   if(entry.isDirectory()){walk(childRel);continue;}
   if(!entry.isFile())continue;
   const target=path.join(rootDir,childRel);
   /* O update não devia ter feito links, mas se fez o restore não os segue. */
   try{const st=fs.lstatSync(target);if(st.isSymbolicLink())fs.rmSync(target,{force:true});}catch{}
   fs.mkdirSync(path.dirname(target),{recursive:true});
   fs.copyFileSync(path.join(backupDir,childRel),target);
   files.push(childRel);
  }
 };
 walk('');
 /* Arquivo que o update criou (não existia antes) sai junto — nada de orfão
    da versão nova sobrevivendo ao rollback. */
 for(const rel of created){
  if(files.includes(rel))continue;
  fs.rmSync(path.join(rootDir,...normalizeRel(rel).split('/')),{force:true});
 }
 return files;
}

module.exports={normalizeRel,isProtected,isReplaceable,readZip,assertSafeEntries,stripCommonRoot,assertRealTarget,manifestFile,readManifest,writeManifest,removeOrphans,applyZip,snapshotTree,restoreTree};
