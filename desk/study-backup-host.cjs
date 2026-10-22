// @ts-check
'use strict';
const path=require('node:path');
const backup=require('./src/study-data/backup.cjs');
const {createBackupServices}=require('./src/study-data/backup-services.cjs');
const {message: uiMsg}=require('./src/i18n.mjs');

function registerBackupHost({ipcMain,dialog,shell,t,win,runtime,deskDir,courses,courseId,persist,idle,mutate,stop,afterRestore,adopt,external=()=>[],log}){
 const picked=new Set(),packages=new Set();
 const settings=()=>backup.readConfig(runtime());
 const services=createBackupServices({runtime,deskDir,repoRoot:path.dirname(deskDir),settingsFile:path.join(runtime(),'mesa-backup.json'),backupRoot:()=>settings().destination||'',gitRoot:()=>settings().gitRoot||'',courses,external,log});
 const folder=value=>{if(typeof value!=='string'||(!picked.has(value)&&value!==settings().destination&&value!==settings().gitRoot))throw Error(uiMsg('err.backup.pickFolder'));return value;};
 const guarded=(fn,{persistState=true}={})=>mutate('backup',async()=>{await idle(uiMsg('err.idle.operation'));if(persistState)persist();return fn();});
 const pickFolder=async()=>{const result=await dialog.showOpenDialog(win(),{title:t('backup.pickFolder'),properties:['openDirectory','createDirectory']});if(result.canceled)return null;const value=result.filePaths[0];picked.add(value);return value;};
 ipcMain.handle('backup-pick-folder',pickFolder);
 ipcMain.handle('backup-status',()=>services.status());
 ipcMain.handle('backup-list',()=>services.listVersions());
 ipcMain.handle('backup-config',(_e,patch)=>{
  if(!patch||typeof patch!=='object'||Array.isArray(patch))throw Error(uiMsg('err.backup.badConfig'));
  const clean={};for(const k of ['auto','intervalHours','idleMinutes','keep','binaries','git','gitRemote'])if(Object.hasOwn(patch,k))clean[k]=patch[k];
  if(patch.destination)clean.destination=services.guardDestination(folder(patch.destination));
  if(patch.gitRoot)clean.gitRoot=services.guardGitRoot(folder(patch.gitRoot));
  return services.configure(clean);
 });
 ipcMain.handle('backup-run',(_e,payload)=>guarded(()=>services.run({reason:'manual',label:String(payload?.label||'').slice(0,160)})));
 ipcMain.handle('backup-verify',(_e,payload)=>services.verify(payload?.snapshotId));
 ipcMain.handle('backup-restore-preview',(_e,payload)=>guarded(async()=>{const plan=await services.previewRestore(payload?.snapshotId);return {...plan,configAvailable:services.externalPlan(plan).some(item=>item.ref==='mesa-config.json'&&item.authorized)};}));
 ipcMain.handle('backup-restore-cancel',(_e,payload)=>services.cancelRestore(payload?.planId));
 ipcMain.handle('backup-restore-apply',(_e,payload)=>guarded(async()=>{stop();const materials=['keep','remap','auto'].includes(payload?.materials)?payload.materials:(payload?.remapMaterials===true?'remap':'auto');const result={...await services.applyRestore(payload?.planId,{materials}),restoreConfig:payload?.restoreConfig===true};const data=await afterRestore(result);return {...result,data};}));
 ipcMain.handle('backup-active-course',()=>services.courseFor(courseId())||{id:courseId(),name:t('free.tab'),path:''});
 ipcMain.handle('backup-git-push',()=>guarded(()=>services.gitPush()));
 ipcMain.handle('share-pick-file',async()=>{const result=await dialog.showOpenDialog(win(),{filters:[{name:t('backup.fileFilter'),extensions:['mesa-materia']}],properties:['openFile']});if(result.canceled)return null;packages.add(result.filePaths[0]);return result.filePaths[0];});
 ipcMain.handle('share-export-course',(_e,payload)=>guarded(()=>{
  if(!services.courseFor(courseId()))throw Error(uiMsg('err.backup.openToShare'));
  return services.exportCourse({directory:folder(payload?.directory),courseId:courseId(),conversations:payload?.conversations===true});
 }));
 const importArgs=payload=>{if(!packages.has(payload?.file))throw Error(uiMsg('err.backup.pickPackage'));return {file:payload.file,directory:folder(payload?.directory),name:String(payload?.name||'').slice(0,160)};};
 ipcMain.handle('share-import-preview',(_e,payload)=>services.previewImport(importArgs(payload)));
 ipcMain.handle('share-import-course',(_e,payload)=>guarded(async()=>{const result=services.importCourse(importArgs(payload));return {...result,data:await adopt(result)};}));
 ipcMain.handle('backup-open-folder',(_e,value)=>shell.openPath(folder(value)));
 return {services,auto:()=>{
  const due=services.autoDue();
  return due.due?guarded(()=>services.auto(),{persistState:false}):Promise.resolve({ran:false,why:due.why});
 }};
}
module.exports={registerBackupHost};
