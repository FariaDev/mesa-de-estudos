import {ptT} from './pt-text.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn, execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {tempDir, cleanup, write} from './study-backup-fixtures.mjs';

const require = createRequire(import.meta.url);
const backup = require('../src/study-data/backup.cjs');
const packages = require('../src/study-data/packages.cjs');
const stats = require('../src/study-data/statistics.cjs');
const {createBackupServices} = require('../src/study-data/backup-services.cjs');
const {registerBackupHost} = require('../study-backup-host.cjs');

test('compartilhar A exporta só conversas com dono A, no formato atual e no legado', () => {
 const runtime=tempDir('mesa-share-owners');
 try {
  const a=write(runtime,'pi-a.jsonl','conversa escolhida\n');
  const b=write(runtime,'pi-b.jsonl','PRIVADO-B\n');
  write(runtime,'pi-unknown.jsonl','PRIVADO-SEM-DONO\n');
  const ambiguous=write(runtime,'pi-ambiguous.jsonl','PRIVADO-AMBIGUO\n');
  const homonym=write(runtime,'pi-homonym.jsonl','PRIVADO-HOMONIMO\n');
  write(runtime,'conversations/claude-unknown.json',JSON.stringify({messages:[],courseId:''}));
  write(runtime,'conversations/claude-b.json',JSON.stringify({messages:[],courseId:'B'}));
  for(const legacy of [false,true]){
   const state={courseId:'A',session:a,courseStates:{A:{session:a,sessions:[{path:ambiguous},{path:path.join(runtime,'elsewhere',path.basename(homonym))}]},B:{session:b,sessions:[{path:ambiguous}]}}};
   write(runtime,'desk.json',JSON.stringify(legacy?{state}:state));
   const result=packages.buildPackage({runtime,course:{id:'A',name:'A'},include:{conversations:true}});
   const chats=result.manifest.files.filter(file=>file.kind==='conversations');
   assert.deepEqual(chats.map(file=>file.rel),['pi/pi-a.jsonl']);
  }
 } finally {cleanup(runtime);}
});

test('batimentos ocultos, logs e índice não adiam backup; atividade real adia', () => {
 const runtime=tempDir('mesa-idle-evidence'),root=tempDir('mesa-idle-backups');
 const now=Date.now(),old=now-3600000,settings={auto:true,idleMinutes:30,intervalHours:24};
 try {
  const state=write(runtime,'desk.json','{}');fs.utimesSync(state,old/1000,old/1000);
  stats.control(runtime,{action:'start',courseId:'A',at:old});
  stats.recordActivity(runtime,{id:'hidden',courseId:'A',at:now,now,visible:false,running:true});
  write(runtime,'study-search/index.json','{}');write(runtime,'desk.log','manutenção');
  assert.equal(backup.shouldAutoBackup({runtime,root,settings,now}).due,true);
  assert.equal(stats.readStore(runtime).meta.activeAt,old);
  stats.recordActivity(runtime,{id:'active',courseId:'A',at:now+15000,now:now+15000,visible:true,running:true});
  assert.equal(backup.shouldAutoBackup({runtime,root,settings,now:now+15000}).why,'mesa em uso');
  stats.recordPrompt(runtime,{id:'prompt',courseId:'A',at:now+20000,accepted:true});
  assert.equal(stats.readStore(runtime).meta.activeAt,now+20000);
  stats.reset(runtime,{confirm:true});
  assert.ok(stats.readStore(runtime).meta.activeAt>=now+20000,'reset explícito preserva a evidência de atividade');
 } finally {cleanup(runtime,root);}
});

test('atividade do backup não segue symlink do store de estatísticas', () => {
 const runtime=tempDir('mesa-idle-link'),outside=tempDir('mesa-stats-outside');
 try {
  const target=write(outside,'stats.json',JSON.stringify({meta:{activeAt:Date.now()+3600000}}));
  fs.symlinkSync(target,path.join(runtime,'study-stats.json'));
  assert.equal(backup.latestActivity(runtime),0);
 } finally {cleanup(runtime,outside);}
});

test('consulta do agendador sem backup devido não trava navegação nem persiste estado', async () => {
 const runtime=tempDir('mesa-auto-host'),root=tempDir('mesa-auto-host-backups');
 let mutations=0,persists=0,idles=0;
 try {
  write(runtime,'desk.json','{}');backup.writeConfig(runtime,{destination:root,auto:true,idleMinutes:30,intervalHours:24});
  const host=registerBackupHost({t:ptT,ipcMain:{handle(){}},dialog:{},shell:{},win:()=>null,runtime:()=>runtime,deskDir:'',courses:()=>[],courseId:()=>'',persist:()=>{persists++;},idle:async()=>{idles++;},mutate:async(_kind,fn)=>{mutations++;return fn();},stop(){},afterRestore(){},adopt(){},log(){}});
  assert.equal((await host.auto()).ran,false);
  assert.deepEqual([mutations,persists,idles],[0,0,0]);
  const old=Date.now()/1000-3600;
  for(const name of ['desk.json','mesa-backup.json'])fs.utimesSync(path.join(runtime,name),old,old);
  const result=await host.auto();
  assert.equal(result.ok,true,'persistência de manutenção não invalida a decisão de inatividade');
  assert.deepEqual([mutations,persists,idles],[1,0,1]);
 } finally {cleanup(runtime,root);}
});

test('backups manual e automático fazem commit local; somente envio explícito chega ao remoto', async () => {
 const runtime=tempDir('mesa-git-services'),root=tempDir('mesa-git-versions'),gitRoot=tempDir('mesa-git-mirror'),remote=tempDir('mesa-git-remote');
 try {
  execFileSync('git',['init','--bare','-q',remote]);
  write(runtime,'desk.json','{}');
  const service=createBackupServices({runtime:()=>runtime,settingsFile:path.join(runtime,'mesa-backup.json'),backupRoot:()=>root,gitRoot:()=>gitRoot});
  service.configure({destination:root,git:true,gitRoot,gitRemote:remote,auto:true,idleMinutes:1,intervalHours:1});
  const old=Date.now()/1000-3600;for(const file of fs.readdirSync(runtime))fs.utimesSync(path.join(runtime,file),old,old);
  let ticks=0;const timer=setInterval(()=>ticks++,5);
  let automatic;
  try {automatic=await service.auto();} finally {clearInterval(timer);}
  assert.equal(automatic.ok,true);assert.equal(automatic.result.git.committed,true);
  assert.ok(ticks>0,'processo principal mantém timers durante Git');
  assert.equal(execFileSync('git',['--git-dir',remote,'for-each-ref'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim(),'');
  const manual=await service.run();assert.ok(manual.git.commit);assert.equal(manual.git.pushed,false);
  const pushed=await service.gitPush();assert.equal(pushed.pushed,true);
  assert.equal(execFileSync('git',['--git-dir',remote,'rev-parse','refs/heads/main'],{encoding:'utf8'}).trim(),manual.git.commit);
  assert.equal((await service.status()).git.head,manual.git.commit);
 } finally {cleanup(runtime,root,gitRoot,remote);}
});

test('falha do Git em backup automático preserva snapshot local e registra erro', async () => {
 const runtime=tempDir('mesa-auto-git-failure'),root=tempDir('mesa-auto-git-versions'),gitRoot=tempDir('mesa-auto-git-invalid');
 try {
  write(runtime,'desk.json','{}');write(gitRoot,'arquivo-do-usuario','preservar');
  const service=createBackupServices({runtime:()=>runtime,settingsFile:path.join(runtime,'mesa-backup.json'),backupRoot:()=>root,gitRoot:()=>gitRoot});
  service.configure({destination:root,git:true,gitRoot,auto:true,idleMinutes:1,intervalHours:1});
  const old=Date.now()/1000-3600;for(const file of fs.readdirSync(runtime))fs.utimesSync(path.join(runtime,file),old,old);
  const result=await service.auto();assert.equal(result.ok,true);assert.ok(result.result.git.error);
  assert.ok(fs.existsSync(result.result.path));assert.ok((await service.status()).gitError);
  assert.equal(fs.readFileSync(path.join(gitRoot,'arquivo-do-usuario'),'utf8'),'preservar');
 } finally {cleanup(runtime,root,gitRoot);}
});

test('cache de núcleo publicado por dois processos contém somente artefatos completos', async () => {
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'mesa-core-cache-race-'));
 const helper=pathToFileURL(path.join(import.meta.dirname,'study-core-build.mjs')).href;
 const code=`import {buildStudyCores} from ${JSON.stringify(helper)}; const built=buildStudyCores({entries:['studystats.bend'],cacheRoot:${JSON.stringify(root)}}); await import('node:url').then(async({pathToFileURL})=>{const core=await import(pathToFileURL(built.corePath('studystats')).href); if(!core.default) throw Error('artefato incompleto');}); console.log(built.dir);`;
 const run=()=>new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,['--input-type=module','-e',code],{stdio:['ignore','pipe','pipe']});let out='',err='';
  child.stdout.on('data',data=>out+=data);child.stderr.on('data',data=>err+=data);child.on('error',reject);child.on('exit',code=>code===0?resolve(out.trim()):reject(Error(err)));
 });
 try {
  const results=await Promise.all([run(),run()]);assert.equal(results[0],results[1]);
  assert.deepEqual(fs.readdirSync(root),[path.basename(results[0])],'staging exclusivo removido, cache compartilhado preservado');
  const before=fs.statSync(path.join(results[0],'studystats.core.js')).mtimeMs;
  assert.equal(await run(),results[0]);assert.equal(fs.statSync(path.join(results[0],'studystats.core.js')).mtimeMs,before);
 } finally {cleanup(root);}
});
