import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';

const desk=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const root=path.resolve(desk,'..');
const app=path.join(root,'Mesa de Estudos.app');
const dest=path.join(app,'Contents','Resources','app');
if(!fs.existsSync(app))throw new Error('Mesa de Estudos.app não encontrada.');
fs.mkdirSync(dest,{recursive:true});
const files=['main.cjs','preload.cjs','rpc.cjs','courses.cjs','config.cjs','pi.cjs','lib.cjs','calculator.mjs','renderer.mjs','icons.mjs','text.mjs','wheel.mjs','index.html','style.css','package.json'];
for(const file of files){
 const from=path.join(desk,file);
 if(!fs.existsSync(from))throw new Error('Arquivo ausente: '+file);
 fs.copyFileSync(from,path.join(dest,file));
}
fs.cpSync(path.join(desk,'assets'),path.join(dest,'assets'),{recursive:true});
fs.cpSync(path.join(desk,'templates'),path.join(dest,'templates'),{recursive:true});
fs.mkdirSync(path.join(dest,'scripts'),{recursive:true});
fs.copyFileSync(path.join(desk,'scripts','install-app.mjs'),path.join(dest,'scripts','install-app.mjs'));
const helper=path.join(root,'visual-check','windows');
if(fs.existsSync(helper)){
 fs.mkdirSync(path.join(app,'Contents','Resources','visual-check'),{recursive:true});
 fs.copyFileSync(helper,path.join(app,'Contents','Resources','visual-check','windows'));
}
const icns=path.join(desk,'assets','mesa.icns');
if(fs.existsSync(icns))fs.copyFileSync(icns,path.join(app,'Contents','Resources','mesa.icns'));
fs.utimesSync(app,new Date(),new Date());
const userApps=path.join(process.env.HOME,'Applications');
fs.mkdirSync(userApps,{recursive:true});
const alias=path.join(userApps,'Mesa de Estudos.app');
try{fs.lstatSync(alias);fs.rmSync(alias,{recursive:true,force:true});}catch{}
execFileSync('osascript',['-e',`tell application "Finder" to make alias file to POSIX file ${JSON.stringify(app)} at POSIX file ${JSON.stringify(userApps)}`]);
execFileSync('/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister',['-f',app]);
console.log('Atualizado:',app);
console.log('Atalho:',alias);
