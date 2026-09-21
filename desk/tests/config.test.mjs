import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
const {courseLibrary,mergeCourses}=createRequire(import.meta.url)('../courses.cjs');
const {normalize,needsSetup,seedConfig,pickPdfs,defaultDesk}=createRequire(import.meta.url)('../config.cjs');

test('a folder of PDFs is a course even without _state.md',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'desk-plain-'));
 try{
  const folder=path.join(root,'Minha Materia');
  fs.mkdirSync(folder);fs.writeFileSync(path.join(folder,'lista.pdf'),'x');
  const courses=mergeCourses({courses:[{id:'mine',name:'Minha matéria',path:folder}]});
  assert.equal(courses.length,1);
  assert.equal(courses[0].name,'Minha matéria');
  assert.equal(courseLibrary(folder).length,1);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('config names overlay discovered vault courses',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'desk-overlay-'));
 try{
  const course=path.join(root,'Courses','Calculus I');
  fs.mkdirSync(course,{recursive:true});
  fs.writeFileSync(path.join(course,'_state.md'),'---\ncourse: Calculus I\n---\n');
  const merged=mergeCourses({vaultPath:root,courses:[{id:'Calculus I',name:'Calc',path:course}]});
  assert.equal(merged[0].name,'Calc');
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('needsSetup is true without vault or courses',()=>{
 assert.equal(needsSetup(normalize({}),[]),true);
 assert.equal(needsSetup(normalize({vaultPath:'/definitely/missing'}),[]),true);
});

test('omitting desk keeps the original Enunciado / Formulário defaults',()=>{
 const desk=normalize({}).desk;
 assert.deepEqual(desk.panels.map(p=>p.label),['Enunciado','Formulário & apoio']);
 assert.deepEqual(desk.panels[0].prefer,['Limites']);
 assert.deepEqual(desk.panels[1].prefer,['Formul']);
 assert.equal(desk.calculator,true);
});

test('pickPdfs follows Limites then Formulário, then leftover files',()=>{
 const library=[
  {name:'Apostila.pdf',path:'/a'},
  {name:'Formulário de M03.pdf',path:'/f'},
  {name:'M03 - Lista Limites.pdf',path:'/l'}
 ];
 const picked=pickPdfs(library,defaultDesk().panels);
 assert.equal(picked[0].path,'/l');
 assert.equal(picked[1].path,'/f');
});

test('a single panel config hides the second reader preference',()=>{
 const desk=normalize({desk:{panels:[{label:'Lista',prefer:['lista']}]}}).desk;
 assert.equal(desk.panels.length,1);
 assert.equal(desk.panels[0].label,'Lista');
 const picked=pickPdfs([{name:'lista-1.pdf',path:'/1'},{name:'form.pdf',path:'/2'}],desk.panels);
 assert.equal(picked.length,1);
 assert.equal(picked[0].path,'/1');
});

test('seedConfig points at the home vault when Courses exists',()=>{
 const seed=seedConfig();
 if(fs.existsSync(path.join(os.homedir(),'Documents','Obsidian Vault','Courses'))){
  assert.match(seed.vaultPath,/Obsidian Vault$/);
  assert.ok(seed.courses.length>=1);
 }else{
  assert.equal(seed.vaultPath,'');
 }
});

test('normalizePanel keeps valid prefer and toggle pairs',()=>{
 const desk=normalize({desk:{panels:[
  {label:'Enunciado',prefer:['Lista de Limites','Enunci']},
  {label:'Apoio',prefer:['Tabela'],toggle:'Tabela'}
 ]}}).desk;
 assert.deepEqual(desk.panels[0],{label:'Enunciado',prefer:['Lista de Limites','Enunci'],toggle:''},'slot 1 não tem toggle default em config.cjs');
 assert.deepEqual(desk.panels[1],{label:'Apoio',prefer:['Tabela'],toggle:'Tabela'},'prefer/toggle válidos são preservados');
});

test('absent, empty or non-array panels fall back to the default readers',()=>{
 const fallback=defaultDesk().panels;
 assert.deepEqual(normalize({desk:{panels:'Limites'}}).desk.panels,fallback);
 assert.deepEqual(normalize({desk:{panels:[]}}).desk.panels,fallback);
 assert.deepEqual(normalize({desk:{panels:null}}).desk.panels,fallback);
 const three=normalize({desk:{panels:[{label:'A'},{label:'B'},{label:'C'}]}}).desk.panels;
 assert.equal(three.length,2,'no máximo dois leitores');
 assert.deepEqual(three,[
  {label:'A',prefer:['Limites'],toggle:''},
  {label:'B',prefer:['Formul'],toggle:'Formulário'}
 ],'cada slot herda o prefer/toggle do default dele');
});

test('empty prefer or toggle inherits the slot default and cannot be cleared via JSON (limitação conhecida; decisão 2026-09-15)',()=>{
 // Comportamento atual: prefer []/ausente/não-array herda o prefer do slot; toggle ausente ou ''
 // herda o toggle do slot. Não há hoje como limpar prefer/toggle pelo config.json — este teste
 // trava o contrato até uma decisão da UI dizer o contrário. O slot 0 não tem toggle default
 // (fica ''); o rótulo do botão volta a "Formulário" no renderer (applyDesk usa `||'Formulário'`).
 const desk=normalize({desk:{panels:[{label:'Lista',prefer:[],toggle:''}]}}).desk;
 assert.equal(desk.panels.length,1);
 assert.deepEqual(desk.panels[0],{label:'Lista',prefer:['Limites'],toggle:''});
 const secondEmpty=normalize({desk:{panels:[{label:'Lista',prefer:['lista']},{label:'Apoio',prefer:['tabela'],toggle:''}]}}).desk;
 assert.equal(secondEmpty.panels[1].toggle,'Formulário','toggle vazio no slot 1 herda o default — não dá para limpar');
 const asString=normalize({desk:{panels:[{label:'Lista',prefer:'lista'}]}}).desk;
 assert.deepEqual(asString.panels[0].prefer,['Limites'],'prefer como string cai no default do slot');
});

test('a panel without prefer keeps the default preference for its slot',()=>{
 const desk=normalize({desk:{panels:[{label:'Lista'}]}}).desk;
 assert.equal(desk.panels.length,1);
 assert.deepEqual(desk.panels[0],{label:'Lista',prefer:['Limites'],toggle:''});
});

test('desk flags survive normalize with sane defaults',()=>{
 const base=normalize({desk:{}});
 assert.equal(base.desk.refsToggle,true);
 assert.equal(base.desk.endDay,true);
 assert.equal(base.desk.studyContext,true);
 const off=normalize({desk:{refsToggle:false,endDay:false,studyContext:false}});
 assert.equal(off.desk.refsToggle,false);
 assert.equal(off.desk.endDay,false);
 assert.equal(off.desk.studyContext,false);
 const partial=normalize({desk:{refsToggle:false}});
 assert.equal(partial.desk.refsToggle,false);
 assert.equal(partial.desk.endDay,true);
 assert.equal(partial.desk.panels.length,2);
});

