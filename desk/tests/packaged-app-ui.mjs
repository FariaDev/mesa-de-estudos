// O app empacotado com o Claude Code do usuário (#51). Os outros testes rodam a
// Mesa a partir de desk/, onde o binário do SDK existia; por isso nenhum viu o
// defeito do atalho instalado ("esperada 2.1.301, encontrada 2.1.296"). Aqui o
// `Mesa de Estudos.app` é montado numa pasta temporária com a mesma rotina do
// `npm run install-app` (`installBundle`), sem assinatura, sem atalho em
// ~/Applications e sem tocar no app do repositório, e sobe pelo executável do
// bundle com uma casa temporária: o Claude Code falso fica onde o instalador
// oficial o põe (`~/.local/bin/claude`, também no PATH) e responde só a
// `--version` e `auth status`. A Query é o SDK sintético (copiado para dentro
// do payload temporário, onde o main exige os fixtures); a detecção é a de
// produção. Três versões: dentro da faixa conecta, mais nova que a testada
// conecta com aviso, série nova recusa com a frase. Nenhuma inferência.
//
// Uso: npm run test:packaged (só macOS: o bundle .app é de macOS).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {withArtifacts,newRuntime,seedCourse,writeDeskJson,writeConfigJson,launchDesk,statusOnline,DESK} from './helpers.mjs';
import {pollUntil} from './waits.mjs';
const require=createRequire(import.meta.url);
const bundle=require('../bundle-runtime.cjs');
const conversations=require('../src/agents/conversations.cjs');
const {AUTH_CONFLICT_ENV,CLAUDE_RANGE}=require('../src/agents/claude-environment.cjs');
const NO_CONFLICT=Object.fromEntries(AUTH_CONFLICT_ENV.map(name=>[name,'']));
const SDK_FIXTURES=['claude-sdk-fake.mjs','claude-sdk-executable-spy.mjs'];

if(process.platform!=='darwin'){
 console.log('packaged-app-ui: o Mesa de Estudos.app é um bundle de macOS; nada a testar neste sistema.');
 process.exit(0);
}

/* APFS clona o Electron.app (~300 MB) sem copiar bytes; fora dele, cópia comum. */
function cloneApp(source,target){
 try{execFileSync('cp',['-cR',source,target],{stdio:'pipe'});}
 catch{fs.rmSync(target,{recursive:true,force:true});execFileSync('cp',['-R',source,target],{stdio:'pipe'});}
}

function buildBundle(root){
 const app=path.join(root,'Mesa de Estudos.app');
 cloneApp(path.join(DESK,'node_modules','electron','dist','Electron.app'),app);
 const version=JSON.parse(fs.readFileSync(path.join(DESK,'package.json'),'utf8')).version||'';
 const {dest}=bundle.installBundle({desk:DESK,root:path.resolve(DESK,'..'),app,version});
 const scope=path.join(dest,'node_modules','@anthropic-ai');
 assert.ok(fs.existsSync(path.join(scope,'claude-agent-sdk','sdk.mjs')),'o SDK vai no bundle');
 assert.deepEqual(fs.readdirSync(scope).filter(name=>name.startsWith('claude-agent-sdk-')),[],'o binário do SDK fica fora do bundle: não há reserva');
 const fixtures=path.join(dest,'tests','fixtures');
 fs.mkdirSync(fixtures,{recursive:true});
 for(const name of SDK_FIXTURES)fs.copyFileSync(path.join(DESK,'tests','fixtures',name),path.join(fixtures,name));
 return {app,dest,exe:path.join(app,'Contents','MacOS','Electron')};
}

function fakeClaude(file,version,probes){
 fs.mkdirSync(path.dirname(file),{recursive:true});
 fs.writeFileSync(file,['#!/bin/sh',
  `echo "$0 $*" >> ${JSON.stringify(probes)}`,
  'case "$1" in',
  `  --version) echo "${version} (Claude Code)";;`,
  '  auth) echo \'{"loggedIn":true,"authMethod":"oauth","apiProvider":"firstParty"}\';;',
  '  *) exit 1;;',
  'esac',''].join('\n'));
 fs.chmodSync(file,0o755);
 return fs.realpathSync(file);
}

async function scenario(built,name,version,check){
 await withArtifacts(`packaged-app-${name}`,async ctx=>{
  const runtime=ctx.runtime=newRuntime(`packaged-app-${name}`),folder=seedCourse(runtime,'Synthetic');
  const home=path.join(runtime,'casa'),bin=path.join(home,'.local','bin');
  const probes=path.join(runtime,'probes.log'),trace=path.join(runtime,'executables.log');
  fs.writeFileSync(probes,'');
  const claude=fakeClaude(path.join(bin,'claude'),version,probes);
  const file=conversations.createClaudeConversation({runtime,courseId:'Synthetic'});
  /* Sem `claudePath`: a Mesa acha o Claude Code onde o instalador oficial o põe. */
  writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'Synthetic',name:'Synthetic',path:folder}]});
  writeDeskJson(runtime,{courseId:'Synthetic',session:file,courseStates:{Synthetic:{session:file,sessions:[{path:file}]}}});
  ctx.app=await launchDesk({runtime,pi:false,execPath:built.exe,env:{
   ...NO_CONFLICT,
   HOME:home,
   PATH:`${bin}:/usr/bin:/bin:/usr/sbin:/sbin`,
   LEARNING_DESK_CLAUDE_HOME:'',
   LEARNING_DESK_CLAUDE_DETECT:'1',
   LEARNING_DESK_CLAUDE_SDK_FACTORY:path.join(built.dest,'tests','fixtures','claude-sdk-executable-spy.mjs'),
   FAKE_CLAUDE_EXECUTABLE_TRACE:trace,
  }});
  const page=await ctx.app.firstWindow(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const appPath=await ctx.app.evaluate(({app})=>app.getAppPath());
  assert.equal(fs.realpathSync(appPath),fs.realpathSync(built.dest),'o app que subiu é o do bundle temporário');
  const calls=()=>fs.readFileSync(probes,'utf8').trim().split('\n').filter(Boolean);
  const rows=()=>fs.existsSync(trace)?fs.readFileSync(trace,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse):[];
  const log=()=>fs.existsSync(path.join(runtime,'desk.log'))?fs.readFileSync(path.join(runtime,'desk.log'),'utf8'):'';
  await check({page,claude,calls,rows,log,errors});
 });
}

async function openAbout(page){
 await page.locator('#settings-menu .nav-trigger').click();
 await page.locator('#about').click();
 await page.waitForSelector('#about-dialog[open]');
 await page.waitForFunction(()=>!!document.querySelector('#component-rows [data-id="claude"]')&&document.querySelector('#component-rows [data-id="claude"] .component-state')?.textContent!=='Verificando…',undefined,{timeout:15000});
}

const root=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'mesa-packaged-')));
try{
 const built=buildBundle(root);

 /* 1. O caso do defeito: o 2.1.296 do usuário, que o app instalado recusava. */
 await scenario(built,'in-range','2.1.296',async ({page,claude,calls,rows,log,errors})=>{
  await statusOnline(page,{timeout:30000});
  assert.equal(rows()[0]?.executable,claude,'a Query roda o Claude Code do usuário');
  assert.ok(calls().includes(`${claude} auth status --json`),'o login é lido nele');
  assert.ok(calls().every(line=>line.startsWith(claude+' ')),'nenhum outro Claude é executado');
  assert.doesNotMatch(log(),/mais nova que a testada|pareamento/);
  assert.deepEqual(errors,[]);
 });

 /* 2. Mais nova que a testada, na série: conecta e avisa no log e no Sobre. */
 await scenario(built,'ahead','2.1.400',async ({page,claude,rows,log,errors})=>{
  await statusOnline(page,{timeout:30000});
  assert.equal(rows()[0]?.executable,claude);
  await pollUntil(log,text=>text.includes(`2.1.400 é mais nova que a testada com esta Mesa (${CLAUDE_RANGE.tested})`),{timeout:15000,what:'o aviso no desk.log'});
  await openAbout(page);
  const row=page.locator('#component-rows [data-id="claude"]');
  assert.match(await row.textContent(),/2\.1\.400/);
  assert.equal(await row.locator('.component-ahead').textContent(),'mais nova que a testada','o Sobre avisa, sem bloquear');
  assert.equal(await page.locator('#status-dot.online').count(),1,'segue conectado');
  assert.deepEqual(errors,[]);
 });

 /* 3. Série nova: recusa antes do login, com a frase e o conserto na coluna. */
 await scenario(built,'new-series','2.2.0',async ({page,calls,rows,errors})=>{
  await page.waitForSelector('#tutor-state[data-state="error"][data-fix="about"]',{timeout:30000});
  const text=await page.locator('#tutor-state .ts-fine').textContent();
  assert.equal(text,`O Claude Code 2.2.0 é de uma série que a Mesa ainda não aceita (${CLAUDE_RANGE.minimum} a 2.1.x): procure uma versão nova da Mesa no Sobre.`);
  assert.equal(await page.locator('#tutor-state #state-claude-about').count(),1);
  assert.equal(await page.locator('#status-dot.online').count(),0,'não conecta');
  assert.deepEqual(rows(),[],'nenhuma Query foi aberta');
  assert.equal(calls().some(line=>/ auth /.test(line)),false,'fora da faixa nunca chega ao login');
  assert.deepEqual(errors,[]);
 });
}finally{
 fs.rmSync(root,{recursive:true,force:true});
}
console.log('packaged-app-ui: PASS — bundle montado pela rotina do install-app numa pasta temporária, sem binário do SDK: 2.1.296 conecta, 2.1.400 conecta com aviso, 2.2.0 recusa com a frase; Claude Code falso, SDK sintético, sem inferência.');
