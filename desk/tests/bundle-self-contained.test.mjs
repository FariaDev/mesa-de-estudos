// node --test tests/bundle-self-contained.test.mjs — o payload do app instalado não pode
// depender de arquivo do repositório fora dele. Já aconteceu: o app instalado carregou um
// shim `Courses/…/.pi/extensions/geogebra.ts` que importava `geogebra/index.ts` da raiz do
// repositório (apagado na #53) e o tutor não subia.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {stageBundlePayload}=require('../bundle-runtime.cjs');

const DESK=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const REPO_ROOT=path.dirname(DESK);
const CODE_EXTENSIONS=/\.(?:cjs|mjs|js|ts|json)$/;
const BLOCK_COMMENT=/\/\*[\s\S]*?\*\//g;
const LINE_COMMENT=/(^|[^:'"`\\])\/\/.*$/gm;
const RELATIVE_SPECIFIER=/(['"`])(\.{1,2}\/[^'"`\s]*)\1/g;

/** Arquivos de código do payload, sem `node_modules` (pacote de terceiro tem a própria árvore). @param {string} dir @returns {string[]} */
function payloadCodeFiles(dir){
 return fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{
  const full=path.join(dir,entry.name);
  if(entry.isDirectory())return entry.name==='node_modules'?[]:payloadCodeFiles(full);
  return CODE_EXTENSIONS.test(entry.name)?[full]:[];
 });
}

/**
 * Referências de um arquivo do payload que saem dele: caminho relativo que passa da raiz
 * do payload ou caminho absoluto do repositório/da pasta desk.
 * @param {string} file @param {string} payload @param {string[]} absoluteRoots
 * @returns {string[]} descrições `arquivo: valor`
 */
function escapes(file,payload,absoluteRoots){
 /* Comentário que cita `../x` não é import: sai antes de procurar. */
 const text=fs.readFileSync(file,'utf8').replace(BLOCK_COMMENT,'').replace(LINE_COMMENT,'$1'),shown=path.relative(payload,file),found=[];
 for(const match of text.matchAll(RELATIVE_SPECIFIER)){
  const target=path.resolve(path.dirname(file),match[2]);
  if(path.relative(payload,target).startsWith('..'))found.push(`${shown}: ${match[2]}`);
 }
 for(const root of absoluteRoots)if(text.includes(root))found.push(`${shown}: caminho absoluto ${root}`);
 return found;
}

/** Monta o payload de `desk/` numa pasta temporária e roda `check(payload)`. @param {(payload:string)=>void} check */
function withStagedPayload(check){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'mesa-bundle-self-'));
 try{
  const payload=path.join(root,'payload');
  stageBundlePayload(DESK,payload);
  check(payload);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
}

test('o payload do bundle não referencia caminho fora dele nem o repositório',()=>{
 withStagedPayload(payload=>{
  const files=payloadCodeFiles(payload);
  assert.ok(files.length>20,`payload com código (achou ${files.length} arquivos)`);
  const roots=[...new Set([REPO_ROOT,fs.realpathSync(REPO_ROOT)])];
  const bad=files.flatMap(file=>escapes(file,payload,roots));
  assert.deepEqual(bad,[],`o app instalado não acharia estes caminhos (esperava só caminhos dentro do payload):\n${bad.join('\n')}`);
 });
});

test('o detector pega o caso real: shim que importa o repositório fora do payload',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'mesa-bundle-detect-'));
 try{
  const payload=path.join(root,'payload');fs.mkdirSync(path.join(payload,'src'),{recursive:true});
  const shim=path.join(payload,'src','geogebra.ts');
  fs.writeFileSync(shim,"import tool from '../../geogebra/index.ts';\nimport ok from './local.ts';\n");
  assert.deepEqual(escapes(shim,payload,[]),['src/geogebra.ts: ../../geogebra/index.ts']);
  const absolute=path.join(payload,'a.cjs');fs.writeFileSync(absolute,`require('${REPO_ROOT}/geogebra/index.ts')`);
  assert.equal(escapes(absolute,payload,[REPO_ROOT]).length,1);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
