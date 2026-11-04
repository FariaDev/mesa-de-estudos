'use strict';

const crypto=require('node:crypto');
const fs=require('node:fs');
const {semverParse}=require('./updater-core.cjs');
const {causeText,invalidValue}=require('./src/error-detail.mjs');
const {createI18n}=require('./src/i18n.mjs');
const ptCatalog=require('./src/locales/pt-BR.json');

/* Atualização assinada (#80): o release publica um manifesto com versão,
   commit, SHA-256 e tamanho do zip, assinado com Ed25519 pela chave do autor.
   O updater só aplica o que confere com esse manifesto; sem ele (ou com
   assinatura/hash/commit diferentes) a atualização é recusada.
   O `reason` do update viaja como texto puro para o Sobre (como em
   updater-files.cjs): traduzimos aqui, na fonte, e não vazamos caminho pessoal. */
const REFUSED=createI18n({catalogs:{'pt-BR':ptCatalog,en:ptCatalog},language:'pt-BR'}).t;
function refuse(key,args){return Error(REFUSED(key,args));}

const PLACEHOLDER_MARK='PLACEHOLDER';
const MANIFEST_MAX_BYTES=64*1024;
const SIGNATURE_MAX_BYTES=8*1024;
const ZIP_MAX_BYTES=64*1024*1024;
const RELEASE_ASSET_BASE='https://github.com/FariaDev/mesa-de-estudos/releases/download/v';

/**
 * A versão estável sem `v` (o nome dos assets e o manifesto usam `X.Y.Z`).
 * @param {string} value versão anunciada, com ou sem `v`
 * @returns {string}
 * @example normalizeVersion('v1.0.3') // '1.0.3'
 */
function normalizeVersion(value){
 if(!semverParse(value))throw Error(invalidValue('versão da atualização',value,'semver X.Y.Z (com ou sem v)'));
 return String(value).trim().replace(/^v/,'');
}

/**
 * URLs públicas dos três assets de uma Release assinada.
 * @param {string} version versão estável (`X.Y.Z`)
 * @returns {{manifest:string,signature:string,zip:string}}
 * @example updateAssetUrls('1.0.3').manifest // 'https://github.com/…/mesa-manifest-v1.0.3.json'
 */
function updateAssetUrls(version){
 const v=normalizeVersion(version);
 const base=`${RELEASE_ASSET_BASE}${v}`;
 return {
  manifest:`${base}/mesa-manifest-v${v}.json`,
  signature:`${base}/mesa-manifest-v${v}.sig`,
  zip:`${base}/mesa-estudos-${v}.zip`,
 };
}

/**
 * Lê a chave pública do disco; ausente ou ilegível vira string vazia (que a
 * verificação trata como marcador e recusa o update).
 * @param {string} file caminho de `update-signing-key.pub`
 * @returns {string}
 * @example readUpdatePublicKey(path.join(deskDir, 'update-signing-key.pub'))
 */
function readUpdatePublicKey(file){
 try{return fs.readFileSync(file,'utf8');}catch{return '';}
}

/**
 * O arquivo commitado ainda é o marcador (ou está vazio)?
 * @param {string} publicKey conteúdo PEM ou o marcador
 * @returns {boolean}
 * @example isPlaceholderKey('PLACEHOLDER — gere a chave') // true
 */
function isPlaceholderKey(publicKey){
 const text=String(publicKey||'').trim();
 return !text||text.includes(PLACEHOLDER_MARK);
}

/**
 * A chave pública utilizável; marcador ou PEM inválido recusam a atualização.
 * @param {string} publicKey conteúdo PEM SPKI
 * @returns {crypto.KeyObject}
 * @example publicKeyOf(fs.readFileSync('update-signing-key.pub', 'utf8'))
 */
function publicKeyOf(publicKey){
 if(isPlaceholderKey(publicKey))throw refuse('err.update.signingKeyMissing');
 try{return crypto.createPublicKey(String(publicKey));}
 catch(error){throw refuse('err.update.signingKeyInvalid',{detail:causeText(error)});}
}

function invalidManifest(detail){return refuse('err.update.manifestInvalid',{detail});}

function commitText(value){
 const commit=String(value||'').trim().toLowerCase();
 if(!/^[0-9a-f]{40}([0-9a-f]{24})?$/.test(commit))throw invalidManifest('campo commit ausente ou fora do formato SHA');
 return commit;
}

function zipBytesNumber(value){
 const bytes=Number(value);
 if(!Number.isSafeInteger(bytes)||bytes<=0)throw invalidManifest('campo zipBytes ausente ou não inteiro positivo');
 return bytes;
}

function zipHashText(value){
 const hash=String(value||'').trim().toLowerCase();
 if(!/^[0-9a-f]{64}$/.test(hash))throw invalidManifest('campo zipSha256 ausente ou fora do formato SHA-256');
 return hash;
}

/**
 * Os campos do manifesto, já validados (sem confiar na assinatura ainda).
 * @param {Buffer} bytes conteúdo exato do `mesa-manifest-vX.Y.Z.json`
 * @returns {{version:string,commit:string,zipSha256:string,zipBytes:number}}
 * @example parseManifest(Buffer.from('{"version":"1.0.3",…}'))
 */
function parseManifest(bytes){
 let parsed;
 try{parsed=JSON.parse(bytes.toString('utf8'));}
 catch{throw invalidManifest('JSON ilegível');}
 if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw invalidManifest('raiz não é objeto');
 const version=typeof parsed.version==='string'?parsed.version.trim().replace(/^v/,''):'';
 if(!semverParse(version))throw invalidManifest('campo version ausente ou fora do formato X.Y.Z');
 return {
  version,
  commit:commitText(parsed.commit),
  zipSha256:zipHashText(parsed.zipSha256),
  zipBytes:zipBytesNumber(parsed.zipBytes),
 };
}

function signatureBuffer(bytes){
 const text=Buffer.isBuffer(bytes)?bytes.toString('utf8'):String(bytes||'');
 const compact=text.replace(/\s+/g,'');
 if(!compact||!/^[A-Za-z0-9+/]+={0,2}$/.test(compact))throw Error('assinatura ausente ou fora do formato base64');
 const signature=Buffer.from(compact,'base64');
 if(signature.length!==64)throw Error(`assinatura com ${signature.length} bytes; esperado 64 (Ed25519)`);
 return signature;
}

/**
 * Confere a assinatura Ed25519 do manifesto e devolve os campos validados.
 * Recusa (Error em pt-BR) quando a chave é o marcador, a assinatura não
 * confere, o manifesto é inválido ou a versão não é a anunciada.
 * @param {{manifestBytes:Buffer,signatureBytes:Buffer,publicKey:string,announcedVersion?:string}} input
 * @returns {{version:string,commit:string,zipSha256:string,zipBytes:number}}
 * @example verifySignedManifest({manifestBytes, signatureBytes, publicKey, announcedVersion: '1.0.3'})
 */
function verifySignedManifest({manifestBytes,signatureBytes,publicKey,announcedVersion=''}){
 const key=publicKeyOf(publicKey);
 const version=announcedVersion?normalizeVersion(announcedVersion):'';
 let signature;
 try{signature=signatureBuffer(signatureBytes);}
 catch{throw refuse('err.update.signatureInvalid',{version:version||'?'});}
 let valid;
 try{valid=crypto.verify(null,Buffer.from(manifestBytes),key,signature);}catch{valid=false;}
 if(!valid)throw refuse('err.update.signatureInvalid',{version:version||'?'});
 const manifest=parseManifest(Buffer.from(manifestBytes));
 if(version&&manifest.version!==version){
  throw refuse('err.update.manifestVersion',{manifest:manifest.version,version});
 }
 return manifest;
}

/**
 * O zip baixado é exatamente o que o manifesto assinado declara (tamanho e SHA-256).
 * @param {Buffer} zip
 * @param {{zipBytes:number,zipSha256:string}} manifest
 * @returns {{sha256:string}} o hash conferido
 * @example assertZipMatchesManifest(zip, manifest)
 */
function assertZipMatchesManifest(zip,manifest){
 const buffer=Buffer.from(zip);
 if(buffer.length!==manifest.zipBytes){
  throw refuse('err.update.zipBytes',{received:buffer.length,expected:manifest.zipBytes});
 }
 const sha256=crypto.createHash('sha256').update(buffer).digest('hex');
 if(sha256!==manifest.zipSha256)throw refuse('err.update.zipHash');
 return {sha256};
}

/**
 * A recusa de tag ausente, com o nome que o autor deve buscar/publicar.
 * @param {string} version versão estável
 * @returns {Error}
 * @example throw tagMissingError('1.0.3')
 */
function tagMissingError(version){
 return refuse('err.update.tagMissing',{tag:`v${normalizeVersion(version)}`});
}

/**
 * O commit da tag do release bate com o commit do manifesto assinado.
 * @param {{commit:string,version:string}} manifest
 * @param {string} tagCommit saída de `git rev-parse vX.Y.Z^{commit}`
 * @param {{tag?:string}} [opts]
 * @returns {string} o commit conferido
 * @example assertTagCommitMatches(manifest, 'a1b2…')
 */
function assertTagCommitMatches(manifest,tagCommit,{tag=`v${manifest.version}`}={}){
 const commit=String(tagCommit||'').trim().toLowerCase();
 if(commit!==manifest.commit){
  throw refuse('err.update.commitMismatch',{tag,commit:commit||'?',expected:manifest.commit});
 }
 return commit;
}

/**
 * O commit em que o repositório ficou depois do pull é exatamente o commit
 * assinado (a branch pode estar à frente da tag, mas só o commit da Release
 * é autenticado).
 * @param {{commit:string}} manifest
 * @param {string} headCommit saída de `git rev-parse HEAD`
 * @returns {string} o commit conferido
 * @example assertAppliedCommitMatches(manifest, commit) // 'a1b2…'
 */
function assertAppliedCommitMatches(manifest,headCommit){
 const commit=String(headCommit||'').trim().toLowerCase();
 if(commit!==manifest.commit){
  throw refuse('err.update.headMismatch',{commit:commit||'?',expected:manifest.commit});
 }
 return commit;
}

/**
 * O zip declarado no manifesto cabe no teto do download.
 * @param {{zipBytes:number}} manifest
 * @param {number} maxBytes
 * @returns {number} o tamanho declarado
 * @example assertZipWithinLimit(manifest, ZIP_MAX_BYTES)
 */
function assertZipWithinLimit(manifest,maxBytes){
 if(manifest.zipBytes>maxBytes)throw refuse('err.update.zipTooLarge',{bytes:manifest.zipBytes,max:maxBytes});
 return manifest.zipBytes;
}

/**
 * Baixa um asset da Release com teto de tamanho; falha de rede e corpo grande
 * viram a recusa traduzida daquele asset (`failureKey`).
 * @param {{fetchBuffer:Function,url:string,maxBytes:number,version:string,failureKey:string}} input
 * @returns {Promise<Buffer>}
 * @example fetchReleaseAsset({fetchBuffer, url, maxBytes: MANIFEST_MAX_BYTES, version: '1.0.3', failureKey: 'err.update.manifestDownload'})
 */
async function fetchReleaseAsset({fetchBuffer,url,maxBytes,version,failureKey}){
 let buffer;
 try{buffer=await fetchBuffer(url,{maxBytes});}
 catch(error){throw refuse(failureKey,{version,error:causeText(error)});}
 if(!Buffer.isBuffer(buffer)&&!(buffer instanceof Uint8Array))throw refuse(failureKey,{version,error:'resposta vazia'});
 const bytes=Buffer.from(buffer);
 if(!bytes.length)throw refuse(failureKey,{version,error:'resposta vazia'});
 if(bytes.length>maxBytes)throw refuse('err.update.downloadTooLarge',{max:maxBytes,received:bytes.length});
 return bytes;
}

/**
 * Baixa e confere a Release assinada: manifesto, assinatura e (quando o modo
 * precisa) o zip com tamanho e SHA-256 do manifesto. Nada é aplicado aqui.
 * @param {{version:string,publicKey:string,fetchBuffer:Function,needZip:boolean,
 *   manifestMaxBytes?:number,signatureMaxBytes?:number,zipMaxBytes?:number}} input
 * @returns {Promise<{manifest:{version:string,commit:string,zipSha256:string,zipBytes:number},zip:Buffer|null,urls:{manifest:string,signature:string,zip:string}}>}
 * @example const release=await loadSignedRelease({version:'1.0.3', publicKey, fetchBuffer, needZip:true})
 */
async function loadSignedRelease({version,publicKey,fetchBuffer,needZip,manifestMaxBytes=MANIFEST_MAX_BYTES,signatureMaxBytes=SIGNATURE_MAX_BYTES,zipMaxBytes=ZIP_MAX_BYTES}){
 const v=normalizeVersion(version);
 if(isPlaceholderKey(publicKey))throw refuse('err.update.signingKeyMissing');
 const urls=updateAssetUrls(v);
 const manifestBytes=await fetchReleaseAsset({fetchBuffer,url:urls.manifest,maxBytes:manifestMaxBytes,version:v,failureKey:'err.update.manifestDownload'});
 const signatureBytes=await fetchReleaseAsset({fetchBuffer,url:urls.signature,maxBytes:signatureMaxBytes,version:v,failureKey:'err.update.signatureDownload'});
 const manifest=verifySignedManifest({manifestBytes,signatureBytes,publicKey,announcedVersion:v});
 if(!needZip)return {manifest,zip:null,urls};
 assertZipWithinLimit(manifest,zipMaxBytes);
 const zip=await fetchReleaseAsset({fetchBuffer,url:urls.zip,maxBytes:zipMaxBytes,version:v,failureKey:'err.update.zipDownload'});
 assertZipMatchesManifest(zip,manifest);
 return {manifest,zip,urls};
}

module.exports={
 PLACEHOLDER_MARK,MANIFEST_MAX_BYTES,SIGNATURE_MAX_BYTES,ZIP_MAX_BYTES,
 updateAssetUrls,normalizeVersion,readUpdatePublicKey,isPlaceholderKey,publicKeyOf,
 parseManifest,verifySignedManifest,assertZipMatchesManifest,assertTagCommitMatches,assertAppliedCommitMatches,assertZipWithinLimit,tagMissingError,
 fetchReleaseAsset,loadSignedRelease,
};
