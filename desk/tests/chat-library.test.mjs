import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ptMatches} from './pt-text.mjs';
import library from '../src/study-data/chat-library.cjs';

function setup(t){const runtime=fs.mkdtempSync(path.join(os.tmpdir(),'mesa-chat-library-'));t.after(()=>fs.rmSync(runtime,{recursive:true,force:true}));return runtime;}
function entries(runtime){return [
 {session:path.join(runtime,'pi-1.jsonl'),courseId:'calc',courseName:'Cálculo',preview:'Como calcular limites?',started:Date.now()-365*86400000,engine:'pi'},
 {session:path.join(runtime,'conversations','claude-1.json'),courseId:'fis',courseName:'Física',preview:'Movimento uniforme',started:Date.now(),engine:'claude'}
];}
test('conversa de um ano continua disponível e rótulo não modifica sessão',t=>{
 const runtime=setup(t),source=entries(runtime);fs.writeFileSync(source[0].session,'historico original');
 const old=library.list(runtime,source).find(x=>x.courseId==='calc');assert.ok(old);
 library.update(runtime,old.id,{title:'Limites fundamentais',topic:'Limites',favorite:true},source);
 assert.equal(fs.readFileSync(source[0].session,'utf8'),'historico original');
 const saved=library.list(runtime,source)[0];assert.equal(saved.id,old.id);assert.equal(saved.title,'Limites fundamentais');assert.equal(saved.favorite,true);
 assert.equal(library.list(runtime,source,{query:'calculo',topic:'Limites',favorites:true}).length,1);
});
test('ID obsoleto ou forjado não escreve e patch desconhecido é recusado',t=>{
 const runtime=setup(t),source=entries(runtime),id=library.list(runtime,source)[0].id;
 assert.throws(()=>library.update(runtime,id,{title:'novo'},[]),ptMatches(/disponível/));
 assert.throws(()=>library.update(runtime,id,{path:'/tmp/sensitive'},source),ptMatches(/inválida/));
 assert.throws(()=>library.resolve(runtime,'../../auth.json',source),ptMatches(/inválida/));
 assert.equal(fs.existsSync(path.join(runtime,library.FILE)),false);
});
test('rótulos continuam após mover a pasta de dados para outro computador',t=>{
 const runtime=setup(t),source=entries(runtime),row=library.list(runtime,source).find(x=>x.courseId==='calc');
 library.update(runtime,row.id,{title:'Retomar limites'},source);
 const restored=path.join(runtime,'restore');fs.mkdirSync(restored);fs.copyFileSync(path.join(runtime,library.FILE),path.join(restored,library.FILE));
 const restoredRows=library.list(restored,entries(restored));
 assert.equal(restoredRows.find(x=>x.courseId==='calc').title,'Retomar limites');
 assert.equal(restoredRows.find(x=>x.courseId==='calc').id,row.id);
});
test('arquivo ilegível e symlink são preservados e nunca substituídos',t=>{
 const runtime=setup(t),file=path.join(runtime,library.FILE),source=entries(runtime);
 fs.writeFileSync(file,'{quebrado');assert.throws(()=>library.list(runtime,source),ptMatches(/preservado/));assert.equal(fs.readFileSync(file,'utf8'),'{quebrado');
 fs.unlinkSync(file);const external=path.join(runtime,'external.json');fs.writeFileSync(external,'{"version":1,"items":{}}');fs.symlinkSync(external,file);
 assert.throws(()=>library.read(runtime),ptMatches(/preservado/));assert.equal(fs.readFileSync(external,'utf8'),'{"version":1,"items":{}}');
});

test('sessão sem título sai como mensagem marcada, traduzida no display (#41)', (t) => {
  const runtime = setup(t);
  const [item] = library.list(runtime, [{session: path.join(runtime, 'pi-9.jsonl'), courseId: 'calc', courseName: 'Cálculo', preview: '', started: Date.now(), engine: 'pi'}]);
  assert.ok(item.title.startsWith(''), `título sem nome deveria ser mensagem marcada, veio: ${JSON.stringify(item.title)}`);
  assert.ok(item.title.includes('chatlib.untitled'));
});
