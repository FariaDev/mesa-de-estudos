import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {ptText, ptMatches} from './pt-text.mjs';
const require=createRequire(import.meta.url),materials=require('../src/study-data/course-materials.cjs'),{courseLibrary}=require('../courses.cjs');

function withRuntime(fn){
 const runtime=fs.mkdtempSync(path.join(os.tmpdir(),'mesa-course-pdf-'));
 try{return fn(runtime);}finally{fs.rmSync(runtime,{recursive:true,force:true});}
}
function scenario(runtime){
 const source=path.join(runtime,'Resumo.pdf');fs.writeFileSync(source,'%PDF-1.4\nResumo original');
 const root=path.join(runtime,'discreta');fs.mkdirSync(path.join(root,'Sources'),{recursive:true});fs.writeFileSync(path.join(root,'Sources','Lista.pdf'),'%PDF-1.4\nLista');
 const course={id:'discreta',name:'Matemática Discreta',path:root},workspace={materials:[{id:'material-1',name:'Resumo.pdf',path:source}]};
 return {source,root,course,workspace};
}

test('cópia Livre para matéria preserva original, homônimos e descoberta com Sources',()=>{
 withRuntime((runtime)=>{
  const {source,root,course,workspace}=scenario(runtime);
  const first=materials.addToCourse({workspace,materialId:'material-1',course});
  const second=materials.addToCourse({workspace,materialId:'material-1',course});
  assert.notEqual(first.path,second.path);assert.deepEqual(fs.readFileSync(first.path),fs.readFileSync(source));
  assert.deepEqual(fs.readFileSync(second.path),fs.readFileSync(source));
  assert.equal(courseLibrary(root).length,3);
  assert.throws(()=>materials.addToCourse({workspace,materialId:'forjado',course}),ptMatches(/não encontrado/));
  assert.equal(fs.readFileSync(source,'utf8'),'%PDF-1.4\nResumo original');
 });
});

test('a publicação é atômica: o nome final só nasce com os bytes completos',()=>{
 withRuntime((runtime)=>{
  const {source,course,workspace}=scenario(runtime);
  const sourceBytes=fs.readFileSync(source),real=fs.linkSync,seen=[];
  fs.linkSync=(from,to)=>{seen.push({from,to,ino:fs.statSync(from).ino,bytes:fs.readFileSync(from)});return real(from,to);};
  let result;
  try{result=materials.addToCourse({workspace,materialId:'material-1',course});}
  finally{fs.linkSync=real;}
  assert.equal(seen.length,1,'o primeiro candidato foi publicado por link exclusivo');
  assert.deepEqual(seen[0].bytes,sourceBytes,'o temporário já estava completo no momento de publicar');
  assert.equal(seen[0].to,result.path);
  assert.equal(fs.statSync(result.path).ino,seen[0].ino,'o arquivo final é o mesmo objeto do temporário (sem cópia parcial visível)');
  assert.deepEqual(fs.readFileSync(result.path),sourceBytes);
 });
});

test('sem link (EPERM) a cópia exclusiva mantém o nome livre e os bytes',()=>{
 withRuntime((runtime)=>{
  const {source,root,course,workspace}=scenario(runtime);
  const real=fs.linkSync;
  fs.linkSync=()=>{const error=new Error('EPERM');error.code='EPERM';throw error;};
  try{
   const first=materials.addToCourse({workspace,materialId:'material-1',course});
   const second=materials.addToCourse({workspace,materialId:'material-1',course});
   assert.equal(first.name,'Resumo.pdf');
   assert.equal(second.name,'Resumo-2.pdf');
   assert.deepEqual(fs.readFileSync(first.path),fs.readFileSync(source));
   assert.deepEqual(fs.readFileSync(second.path),fs.readFileSync(source));
   assert.equal(courseLibrary(root).length,3);
  }finally{fs.linkSync=real;}
 });
});

test('troca da pasta por link no meio da publicação é detectada e o arquivo sai',()=>{
 withRuntime((runtime)=>{
  const {source,root,course,workspace}=scenario(runtime);
  const materialsDir=path.join(root,'Materiais da Mesa'),saved=path.join(root,'Materiais da Mesa.saved'),outside=path.join(runtime,'fora');
  fs.mkdirSync(outside);
  const real=fs.linkSync;
  /* A troca acontece DEPOIS das checagens da pasta e ANTES do link. O
     temporário é replicado no destino falso para o link "vencer" e o
     pós-check ter o que pegar. */
  fs.linkSync=(from,to)=>{
   const base=path.basename(from);
   fs.renameSync(materialsDir,saved);
   fs.symlinkSync(outside,materialsDir);
   fs.copyFileSync(path.join(saved,base),path.join(outside,base));
   return real(from,to);
  };
  let error=null;
  try{materials.addToCourse({workspace,materialId:'material-1',course});}
  catch(caught){error=caught;}
  finally{fs.linkSync=real;}
  assert.ok(error,'a publicação com a pasta trocada falha');
  assert.match(ptText(error.message),/mudou|inválida/);
  assert.deepEqual(fs.readdirSync(outside).filter((name)=>name.endsWith('.pdf')),[],'nada fica escrito fora da pasta da matéria');
  fs.rmSync(materialsDir,{force:true});
  fs.renameSync(saved,materialsDir);
  /* O temporário interrompido pode ficar como sobra oculta; o que não pode
     aparecer na pasta original é um PDF. */
  assert.deepEqual(fs.readdirSync(path.join(root,'Materiais da Mesa')).filter((name)=>name.endsWith('.pdf')),[]);
  assert.equal(fs.readFileSync(source,'utf8'),'%PDF-1.4\nResumo original');
 });
});

test('Materiais da Mesa já como link externo é recusada sem escrever',()=>{
 withRuntime((runtime)=>{
  const {root,course,workspace}=scenario(runtime);
  const outside=path.join(runtime,'fora');fs.mkdirSync(outside);
  fs.symlinkSync(outside,path.join(root,'Materiais da Mesa'));
  assert.throws(()=>materials.addToCourse({workspace,materialId:'material-1',course}),ptMatches(/Pasta de materiais inválida/));
  assert.deepEqual(fs.readdirSync(outside),[]);
 });
});

test('material ausente ou fora de PDF não é copiado',()=>{
 withRuntime((runtime)=>{
  const {root,course,workspace}=scenario(runtime);
  assert.throws(()=>materials.addToCourse({workspace,materialId:'material-1',course:{id:'x',name:'X',path:path.join(runtime,'nao-existe')}}),/ENOENT/);
  const notPdf=path.join(runtime,'Resumo.pdf');fs.writeFileSync(notPdf,'não é PDF');
  const broken={materials:[{id:'m',name:'Resumo.pdf',path:notPdf}]};
  assert.throws(()=>materials.addToCourse({workspace:broken,materialId:'m',course}),ptMatches(/não é um PDF válido/));
  assert.equal(fs.existsSync(path.join(root,'Materiais da Mesa')),false);
 });
});

test('prévia do tutor pertence a uma conversa e sobrevive reabertura; arquivo inválido é preservado',()=>{
 const runtime=fs.mkdtempSync(path.join(os.tmpdir(),'mesa-course-draft-'));
 try{
  const scope={courseId:'discreta',session:path.join(runtime,'pi-1.jsonl')};
  const draft=materials.prepareDraft(runtime,scope,{title:'Grafos',markdown:'# Grafos\n\n$$V={1,2}$$'});
  assert.equal(materials.getDraft(runtime,scope).id,draft.id);
  assert.equal(materials.getDraft(runtime,{...scope,session:path.join(runtime,'pi-2.jsonl')}),null);
  materials.clearDraft(runtime,scope,'outro-id');assert.equal(materials.getDraft(runtime,scope).id,draft.id);
  materials.clearDraft(runtime,scope,draft.id);assert.equal(materials.getDraft(runtime,scope),null);
  const file=path.join(runtime,materials.FILE);fs.writeFileSync(file,'{ inválido');
  assert.throws(()=>materials.prepareDraft(runtime,scope,{title:'Outra',markdown:'Texto'}),ptMatches(/preservado/));
  assert.equal(fs.readFileSync(file,'utf8'),'{ inválido');
 }finally{fs.rmSync(runtime,{recursive:true,force:true});}
});
