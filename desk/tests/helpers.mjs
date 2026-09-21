import {_electron as electron} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {testEnv} from './electron-env.mjs';

// Boot compartilhado dos smokes de UI (ui-smoke/subjects-ui) + artefatos de falha.
const here=path.dirname(fileURLToPath(import.meta.url));
export const DESK=path.resolve(here,'..');
export const FAKE_PI=path.join(DESK,'tests','fake-pi.mjs');
export const PLOT_PNG='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const ARTIFACTS=path.join(DESK,'tests','artifacts');

export function tinyPdf(text,repeat=1){
 const lines=Array.isArray(text)?text:[text];
 const contents=Array.from({length:repeat},(_,i)=>`BT /F1 16 Tf 72 ${720-i*30} Td (${lines[i%lines.length]}) Tj ET`).join('\n');
 const objects=['<</Type/Catalog/Pages 2 0 R>>','<</Type/Pages/Kids[3 0 R]/Count 1>>','<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Resources<</Font<</F1 4 0 R>>>>/Contents 5 0 R>>','<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>',`<</Length ${contents.length}>>\nstream\n${contents}\nendstream`];
 let out='%PDF-1.4\n';const offsets=[];
 objects.forEach((obj,i)=>{offsets.push(out.length);out+=`${i+1} 0 obj\n${obj}\nendobj\n`;});
 const startxref=out.length;
 out+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.map(off=>`${String(off).padStart(10,'0')} 00000 n \n`).join('')}trailer\n<</Size ${objects.length+1}/Root 1 0 R>>\nstartxref\n${startxref}\n%%EOF\n`;
 return Buffer.from(out,'latin1');
}

export function newRuntime(tag='run'){
 const runtime=path.resolve(DESK,'.test-runtime-'+Date.now()+'-'+tag);
 fs.mkdirSync(path.join(runtime,'learning','Courses'),{recursive:true});
 return runtime;
}
export function seedCourse(runtime,id){
 const dir=path.join(runtime,'learning','Courses',id);
 fs.mkdirSync(dir,{recursive:true});
 return dir;
}
export function seedPlot(runtime,course){
 const file=path.join(runtime,'learning','Courses',course,'plot.png');
 fs.mkdirSync(path.dirname(file),{recursive:true});
 fs.writeFileSync(file,Buffer.from(PLOT_PNG,'base64'));
 return file;
}
export function seedSession(runtime,records){
 const file=path.join(runtime,'pi-'+Date.now()+'.jsonl');
 fs.writeFileSync(file,records.map(record=>JSON.stringify(record)+'\n').join(''));
 return file;
}
export function writeDeskJson(runtime,data){fs.writeFileSync(path.join(runtime,'desk.json'),JSON.stringify(data));}
export function writeConfigJson(runtime,data){fs.writeFileSync(path.join(runtime,'config.json'),JSON.stringify(data));}

export function deskEnv(runtime,extra={},pi=true){
 const base={LEARNING_DESK_RUNTIME:runtime};
 if(pi)base.LEARNING_DESK_PI=FAKE_PI;
 return testEnv({...base,...extra});
}
export async function launchDesk({runtime,env={},pi=true,execPath=''}={}){
 fs.chmodSync(FAKE_PI,0o755);
 const fullEnv=deskEnv(runtime,env,pi);
 const bin=execPath||process.env.DESK_ELECTRON_BIN||'';
 if(bin)return electron.launch({executablePath:bin,args:[],cwd:DESK,env:fullEnv});
 return electron.launch({args:[path.join(DESK,'main.cjs')],cwd:DESK,env:fullEnv});
}

export function toastWait(page,text,{timeout=8000}={}){
 return page.waitForFunction(t=>{
  const box=document.querySelector('#toast');
  return !!box&&[...box.querySelectorAll('.toast-item')].some(el=>!el.classList.contains('out')&&el.textContent.includes(t));
 },text,{timeout});
}
export function sendEnabled(page,{timeout=15000}={}){
 return page.waitForFunction(()=>!document.querySelector('#send').disabled,undefined,{timeout});
}
export function statusOnline(page,{timeout=30000}={}){
 return page.waitForSelector('#status-dot.online',{timeout});
}

const ARTIFACT_FILE=/(\.jsonl$)|(\.log(\.\d+)?$)|(^desk\.json$)|(^config\.json$)|(ggb-bridge\.json$)/;
export async function saveArtifacts(ctx){
 const stamp=new Date().toISOString().replace(/[:.]/g,'-').replace(/Z$/,'');
 const dir=path.join(ARTIFACTS,`${stamp}-${ctx.block||'falha'}`);
 fs.mkdirSync(dir,{recursive:true});
 const runtime=ctx.runtime;
 if(runtime&&fs.existsSync(runtime)){
  for(const name of fs.readdirSync(runtime)){
   const full=path.join(runtime,name);
   try{
    if(fs.statSync(full).isFile()&&ARTIFACT_FILE.test(name))fs.copyFileSync(full,path.join(dir,name));
   }catch{}
  }
  const ggbDir=path.join(runtime,'ggb');
  if(fs.existsSync(ggbDir))fs.cpSync(ggbDir,path.join(dir,'ggb'),{recursive:true});
 }
 const pages=ctx.app?.windows?.()||[];
 let index=0;
 for(const page of pages){try{await page.screenshot({path:path.join(dir,`page-${++index}.png`)});}catch{}}
 console.error(`[artefatos] falha registrada em: ${dir}`);
 return dir;
}

// withArtifacts('<bloco>', async ctx=>{...}): em QUALQUER falha, copia o runtime do teste
// (desk.json, sessões, desk.log, ggb-bridge.json, ggb/) e um screenshot por janela aberta
// para desk/tests/artifacts/<timestamp>-<bloco>/ antes de rejeitar. No sucesso fecha o app
// e apaga o runtime, como antes.
export async function withArtifacts(block,run){
 const ctx={block,runtime:'',app:null};
 let ok=false;
 try{
  const out=await run(ctx);
  ok=true;
  return out;
 }catch(e){
  try{await saveArtifacts(ctx);}catch{}
  throw e;
 }finally{
  try{if(ctx.app)await ctx.app.close();}catch{}
  if(ok&&ctx.runtime){try{fs.rmSync(ctx.runtime,{recursive:true,force:true});}catch{}}
 }
}
