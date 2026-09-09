import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
const {courseLibrary,mergeCourses}=createRequire(import.meta.url)('../courses.cjs');
const {normalize,needsSetup,seedConfig}=createRequire(import.meta.url)('../config.cjs');

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

test('seedConfig points at the home vault when Courses exists',()=>{
 const seed=seedConfig();
 if(fs.existsSync(path.join(os.homedir(),'Documents','Obsidian Vault','Courses'))){
  assert.match(seed.vaultPath,/Obsidian Vault$/);
  assert.ok(seed.courses.length>=1);
 }else{
  assert.equal(seed.vaultPath,'');
 }
});
