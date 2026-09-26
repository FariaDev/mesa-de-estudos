// Caça a bugs da onda Bend (calculadora, GeoGebra e status/rodapé).
//
// Exploratório: sobe a Mesa no harness do ui-smoke (janela oculta, fake Pi,
// runtime temporário) e exercita os cantos que o contrato não cobre —
// colapso/ângulo/histórico/guia/divisor, ativar-desativar GGB + ponte +
// snapshot, medidor/ctx-tip/auto-compact/seletor/rodapé. Passo quebrado vira
// BUG com print em tests/artifacts/hunt-calc-ggb-<stamp>/; achado fora do
// escopo vira NOTA (mesmo peso de repro, sem derrubar o script). Rode com
// `node tests/hunt-calc-ggb.mjs`.
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {withArtifacts,launchDesk,newRuntime,seedCourse,seedSession,writeDeskJson,writeConfigJson,tinyPdf,toastWait,statusOnline,FAKE_PI} from './helpers.mjs';

const HERE=path.dirname(fileURLToPath(import.meta.url));
const ART=path.join(HERE,'artifacts','hunt-calc-ggb-'+Date.now());
fs.mkdirSync(ART,{recursive:true});
const problems=[];
const notes=[];
let page=null,shotIndex=0;
async function shot(tag){
 if(!page)return '';
 const file=path.join(ART,`${String(++shotIndex).padStart(2,'0')}-${tag.replace(/[^\w-]+/g,'_').slice(0,60)}.png`);
 try{await page.screenshot({path:file});}catch{}
 return file;
}
async function check(name,fn){
 try{await fn();console.log('  ok  '+name);}
 catch(e){
  const file=await shot(name);
  problems.push({name,message:e?.message||String(e),shot:file});
  console.log('  BUG '+name+'\n      '+(e?.message||e));
 }
}
async function note(name,fn){
 try{await fn();console.log('  ok  '+name);}
 catch(e){
  const file=await shot(name);
  notes.push({name,message:e?.message||String(e),shot:file});
  console.log('  NOTA (fora do escopo) '+name+'\n      '+(e?.message||e));
 }
}
function dump(){
 if(notes.length){
  console.log(`\nNOTAS (fora do escopo, com repro):`);
  for(const n of notes)console.log(' - '+n.name+'\n   '+(n.shot?n.shot+'\n   ':'')+n.message);
 }
 if(problems.length){
  console.log(`\nHUNT: ${problems.length} problema(s) no escopo:`);
  for(const p of problems)console.log(' - '+p.name+'\n   '+(p.shot?p.shot+'\n   ':'')+p.message);
 }else console.log('\nHUNT: nenhum problema no escopo.');
}

/* Wrapper de fake-Pi para a caça:
   - `pi-percent.txt` reescreve o contextUsage de get_session_stats (ou esconde);
   - HUNT_PI_BOOT_DELAY_MS atrasa o nascimento do Pi (janela para "conectando");
   - HUNT_HOLD_AGENT_END_MS segura o agent_end e reporta isStreaming=true no
     get_state enquanto segura (janela de turno busy de verdade). */
function writeHuntPi(runtime){
 const ctl=path.join(runtime,'pi-percent.txt');
 const wrapper=path.join(runtime,'pi-hunt.mjs');
 fs.writeFileSync(ctl,'99');
 fs.writeFileSync(wrapper,`#!/usr/bin/env node
import {spawn} from 'node:child_process';
import readline from 'node:readline';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const ctl=path.join(here,'pi-percent.txt');
const bootDelay=Number(process.env.HUNT_PI_BOOT_DELAY_MS)||0;
const holdMs=Number(process.env.HUNT_HOLD_AGENT_END_MS)||0;
let child=null,held=0;
const queue=[];
const statsPending=new Set(),getStatePending=new Set();
function send(line){if(child)child.stdin.write(line+'\\n');else queue.push(line);}
function start(){
 child=spawn(process.execPath,[${JSON.stringify(FAKE_PI)},...process.argv.slice(2)],{stdio:['pipe','pipe','inherit']});
 for(const line of queue)child.stdin.write(line+'\\n');
 queue.length=0;
 readline.createInterface({input:child.stdout}).on('line',line=>{
  if(holdMs&&/"type":"agent_end"/.test(line)){held++;setTimeout(()=>{held--;forward(line);},holdMs);return;}
  forward(line);
 });
 child.on('exit',(code,signal)=>process.exit(code==null?(signal?1:0):code));
}
readline.createInterface({input:process.stdin}).on('line',line=>{
 try{
  const e=JSON.parse(line);
  if(e&&e.type==='get_session_stats')statsPending.add(String(e.id));
  if(e&&e.type==='get_state')getStatePending.add(String(e.id));
 }catch{}
 send(line);
});
function forward(line){
 let out=line;
 try{
  const e=JSON.parse(line);
  if(e&&e.type==='response'&&statsPending.has(String(e.id))){
   statsPending.delete(String(e.id));
   let raw='';try{raw=fs.readFileSync(ctl,'utf8').trim();}catch{}
   if(raw==='hidden'){if(e.data&&typeof e.data==='object')e.data.contextUsage=null;}
   else if(raw){const pct=Number(raw);if(Number.isFinite(pct))e.data={...(e.data||{}),contextUsage:{tokens:Math.round(pct*2000),contextWindow:200000,percent:pct}};}
   out=JSON.stringify(e);
  }else if(e&&e.type==='response'&&getStatePending.has(String(e.id))){
   getStatePending.delete(String(e.id));
   if(held>0&&e.data&&typeof e.data==='object')e.data.isStreaming=true;
   out=JSON.stringify(e);
  }
 }catch{}
 process.stdout.write(out+'\\n');
}
process.stdin.on('end',()=>child&&child.stdin.end());
if(bootDelay)setTimeout(start,bootDelay);else start();
`);
 fs.chmodSync(wrapper,0o755);
 return {wrapper,ctl};
}
const setPercent=(ctl,value)=>fs.writeFileSync(ctl,String(value));
/* Dispara um stats novo sem esperar o poll de 15s: o clique do auto-compact
   pede get_session_stats e chama updateMeter com o resultado. */
async function refreshMeter(ctl,value){
 setPercent(ctl,value);
 await page.locator('#auto-compact').click();
}
function watchErrors(p,bag){
 p.on('pageerror',e=>bag.push('pageerror: '+e.message));
 p.on('console',m=>{if(m.type()==='error')bag.push('console: '+m.text());});
}

await withArtifacts('hunt-calc-ggb',async ctx=>{
 const runtime=ctx.runtime=newRuntime('hunt');
 const courseA=seedCourse(runtime,'Calc');
 const courseB=seedCourse(runtime,'Geo');
 fs.writeFileSync(path.join(courseA,'Integral.pdf'),tinyPdf('Integral de teste para a caça',4));
 fs.writeFileSync(path.join(courseB,'Limites.pdf'),tinyPdf('Limites de teste para a caça',2));
 const session=seedSession(runtime,[{type:'message',message:{role:'user',content:[{type:'text',text:'sessão da caça'}]}}]);
 const older=path.join(runtime,'pi-1700000000000.jsonl');
 fs.writeFileSync(older,JSON.stringify({type:'message',message:{role:'user',content:[{type:'text',text:'sessão antiga da caça'}]}})+'\n');
 writeDeskJson(runtime,{session,courseId:'Calc',courseStates:{Calc:{session,sessions:[{path:session,started:Date.now(),preview:'sessão da caça'},{path:older,started:1700000000000,preview:'sessão antiga da caça'}]}}});
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'Calc',name:'Cálculo',path:courseA},{id:'Geo',name:'Geometria',path:courseB}]});
 const {wrapper,ctl}=writeHuntPi(runtime);
 const errors=[];
 let app=ctx.app=await launchDesk({runtime,env:{LEARNING_DESK_PI:wrapper,HUNT_PI_BOOT_DELAY_MS:'2500',HUNT_HOLD_AGENT_END_MS:'3000'}});
 page=ctx.page=await app.firstWindow();
 watchErrors(page,errors);
 await page.waitForSelector('#expression',{timeout:30000});

 // ------------------------------------------------------------------ 1. estados de conexão
 console.log('\n== conexão ==');
 await check('status: conectando — ponto pulsante, tooltip e controles escondidos',async()=>{
  const bootDot=await page.evaluate(()=>{const d=document.querySelector('#status-dot');return {cls:d.className,tip:d.getAttribute('data-tip'),aria:d.getAttribute('aria-label')};});
  assert.ok(bootDot.cls===''||bootDot.cls==='connecting','ponto nasce off (ou já conectando): '+JSON.stringify(bootDot));
  if(bootDot.cls===''){assert.equal(bootDot.tip,null,'off não tem data-tip');assert.ok(bootDot.aria===null||bootDot.aria==='Pi desconectado','off sem aria errada: '+bootDot.aria);}
  await page.waitForSelector('#status-dot.connecting',{timeout:15000});
  const dot=await page.evaluate(()=>{const d=document.querySelector('#status-dot');return {tip:d.getAttribute('data-tip'),title:d.hasAttribute('title'),aria:d.getAttribute('aria-label'),anim:getComputedStyle(d).animationName};});
  assert.equal(dot.tip,'Conectando ao Pi');
  assert.equal(dot.title,false);
  assert.equal(dot.aria,'Conectando ao Pi');
  assert.notEqual(dot.anim,'none','pulso do connecting é animação');
  assert.equal(await page.locator('#auto-compact').isHidden(),true);
  assert.equal(await page.locator('#ctx-meter').isHidden(),true);
  assert.equal(await page.locator('#foot-status').isHidden(),true);
 });
 await check('status: online — data-tip sem title, auto-compact e medidor aparecem',async()=>{
  await statusOnline(page);
  await page.waitForSelector('#auto-compact:not([hidden])',{timeout:15000});
  const dot=await page.evaluate(()=>{const d=document.querySelector('#status-dot');return {cls:d.className,tip:d.getAttribute('data-tip'),title:d.hasAttribute('title'),aria:d.getAttribute('aria-label')};});
  assert.equal(dot.cls,'online');
  assert.equal(dot.tip,'Pi conectado');
  assert.equal(dot.title,false,'o ponto usa data-tip, não title');
  assert.equal(dot.aria,'Pi conectado');
  const auto=await page.evaluate(()=>{const el=document.querySelector('#auto-compact');return {title:el.hasAttribute('title'),tip:el.getAttribute('data-tip'),pressed:el.getAttribute('aria-pressed'),cls:el.className};});
  assert.equal(auto.title,false,'auto-compact nasce com data-tip (sem title)');
  assert.match(auto.tip,/Compactação automática/);
  assert.equal(auto.cls,auto.pressed==='true'?'on':'');
  assert.equal(await page.locator('#ctx-tip').isHidden(),true);
  // o rodapé é lido aqui, antes de qualquer hover/clique (o tooltip troca
  // data-tip → title enquanto o alvo está armado)
  await page.waitForSelector('#foot-status:not([hidden])');
  const foot=await page.evaluate(()=>{const el=document.querySelector('#foot-status');return {title:el.hasAttribute('title'),tip:el.getAttribute('data-tip')||'',aria:el.getAttribute('aria-label')||'',items:[...el.querySelectorAll('.fs-item')].map(i=>i.textContent),classes:[...el.querySelectorAll('.fs-item')].map(i=>i.className),seps:el.querySelectorAll('.fs-sep').length};});
  assert.equal(foot.title,false,'rodapé usa data-tip, não title');
  assert.equal(foot.aria,foot.tip);
  assert.equal(foot.items.length,3,'modelo, esforço e contexto');
  assert.deepEqual(foot.classes,['fs-item fs-model','fs-item fs-eff','fs-item fs-ctx']);
  assert.match(foot.tip,/·/);
  assert.equal(foot.seps,2,'um separador entre cada par');
 });

 // ------------------------------------------------------------------ 2. calculadora
 console.log('\n== calculadora ==');
 await check('calc: casco inicial (corpo visível, sem classe, aria-expanded)',async()=>{
  assert.equal(await page.locator('#calc-body').isVisible(),true);
  assert.equal(await page.locator('#calculator').getAttribute('class'),null);
  assert.equal(await page.locator('#calc-toggle').getAttribute('aria-expanded'),'true');
  assert.equal(await page.locator('#calc-history button').count(),0);
  assert.equal(await page.locator('#result').textContent(),'0');
 });
 await check('calc: clique no select do ângulo não colapsa; título colapsa e reabre',async()=>{
  await page.evaluate(()=>document.querySelector('#angle').dispatchEvent(new MouseEvent('click',{bubbles:true})));
  assert.equal(await page.locator('#calc-body').isHidden(),false);
  await page.locator('#calc-toggle > span').first().click();
  assert.equal(await page.locator('#calc-body').isHidden(),true);
  assert.equal(await page.locator('#calc-toggle').getAttribute('aria-expanded'),'false');
  assert.equal(await page.locator('#calculator').getAttribute('class'),'collapsed');
  assert.equal(await page.evaluate(()=>document.activeElement===document.querySelector('#calc-toggle')),true,'o foco fica no toggle');
  await page.locator('#calc-toggle > span').first().click();
  assert.equal(await page.locator('#calc-body').isVisible(),true);
  assert.equal(await page.locator('#calc-toggle').getAttribute('aria-expanded'),'true');
 });
 await check('calc: avaliar válido entra no histórico e o Reuse foca o input',async()=>{
  await page.locator('#expression').fill('sqrt(16)+sin(pi/2)');
  await page.locator('#calc-form button').click();
  assert.equal(await page.locator('#result').textContent(),'5');
  await page.locator('#expression').fill('2+3');
  await page.locator('#expression').press('Enter');
  assert.equal(await page.locator('#result').textContent(),'5');
  assert.equal(await page.evaluate(()=>document.activeElement===document.querySelector('#expression')),true,'Enter mantém o foco no input');
  const rows=await page.locator('#calc-history button').evaluateAll(es=>es.map(e=>({t:e.textContent,x:e.dataset.expr})));
  assert.deepEqual(rows,[{t:'2+3 = 5',x:'2+3'},{t:'sqrt(16)+sin(pi/2) = 5',x:'sqrt(16)+sin(pi/2)'}],'mais novo primeiro');
  await page.locator('#calc-history button').last().click();
  assert.equal(await page.locator('#expression').inputValue(),'sqrt(16)+sin(pi/2)');
  assert.equal(await page.evaluate(()=>document.activeElement===document.querySelector('#expression')),true);
 });
 await check('calc: GRAUS marca selected, avalia sin(30) e sobrevive ao re-render',async()=>{
  await page.locator('#angle').selectOption('deg');
  assert.equal(await page.locator('#angle').inputValue(),'deg');
  assert.equal(await page.locator('#angle option[selected]').getAttribute('value'),'deg');
  await page.locator('#expression').fill('sin(30)');
  await page.locator('#calc-form button').click();
  assert.equal(await page.locator('#result').textContent(),'0.5');
  await page.locator('#calc-toggle > span').first().click();
  await page.locator('#calc-toggle > span').first().click();
  assert.equal(await page.locator('#angle option[selected]').getAttribute('value'),'deg','selected sobrevive ao re-render');
  assert.equal(await page.locator('#expression').inputValue(),'sin(30)','expressão sobrevive ao colapso');
  await page.locator('#angle').selectOption('rad');
  assert.equal(await page.locator('#angle option[selected]').getAttribute('value'),'rad');
  await page.locator('#expression').fill('sin(30)');
  await page.locator('#calc-form button').click();
  assert.notEqual(await page.locator('#result').textContent(),'0.5','RAD volta a avaliar em radianos');
 });
 await check('calc: teclado no select não colapsa nem perde o foco',async()=>{
  await page.locator('#angle').selectOption('rad');
  await page.locator('#angle').focus();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  assert.equal(await page.locator('#calc-body').isVisible(),true,'teclado no select não colapsa o corpo');
  assert.equal(await page.locator('#angle').inputValue(),'rad');
  assert.equal(await page.evaluate(()=>document.activeElement===document.querySelector('#angle')),true,'select mantém o foco');
  await page.locator('#angle').selectOption('deg');
  assert.equal(await page.locator('#angle option[selected]').getAttribute('value'),'deg');
  await page.locator('#angle').selectOption('rad');
 });
 await check('calc: expressão inválida vira — com toast e sem histórico',async()=>{
  await page.locator('#angle').selectOption('rad');
  const before=await page.locator('#calc-history button').count();
  await page.locator('#expression').fill('sqrt(');
  await page.locator('#calc-form button').click();
  assert.equal(await page.locator('#result').textContent(),'—');
  await toastWait(page,'Expressão inválida',{timeout:5000});
  await page.locator('#expression').fill('1/0');
  await page.locator('#calc-form button').click();
  assert.equal(await page.locator('#result').textContent(),'—');
  await toastWait(page,'Resultado indefinido',{timeout:5000});
  assert.equal(await page.locator('#calc-history button').count(),before,'erros não entram no histórico');
 });
 await check('calc: histórico limita em 8, sem os mais antigos',async()=>{
  for(let i=10;i<=20;i++){await page.locator('#expression').fill(`${i}+0`);await page.locator('#expression').press('Enter');}
  const rows=await page.locator('#calc-history button').evaluateAll(es=>es.map(e=>e.textContent));
  assert.equal(rows.length,8);
  assert.equal(rows[0],'20+0 = 20');
  assert.equal(rows[7],'13+0 = 13','os mais antigos saíram');
  assert.ok(!rows.some(t=>t.startsWith('sqrt(16)')),'o passado distante saiu');
 });
 await check('calc: exemplos do guia avaliam (vírgula decimal, pi, potência, log)',async()=>{
  for(const [expr,want] of [['(2+3)*4','20'],['2*pi','6.28318530718'],['2^3','8'],['sqrt(16)','4'],['1,5+1','2.5'],['log(100)','2'],['ln(e)','1']]){
   await page.locator('#expression').fill(expr);
   await page.locator('#expression').press('Enter');
   assert.equal(await page.locator('#result').textContent(),want,expr+' → '+want);
  }
 });
 await check('calc: recíprocas, inversas e ângulos exatos em GRAUS',async()=>{
  await page.locator('#angle').selectOption('deg');
  for(const [expr,want] of [['sec(60)','2'],['csc(30)','2'],['cot(45)','1'],['cot(90)','0'],['sec(180)','-1'],['asin(0.5)','30'],['acos(0.5)','60'],['atan(1)','45'],['cos(90)','0'],['sin(180)','0'],['tan(180)','0']]){
   await page.locator('#expression').fill(expr);
   await page.locator('#expression').press('Enter');
   assert.equal(await page.locator('#result').textContent(),want,expr+' → '+want);
  }
  const before=await page.locator('#calc-history button').count();
  for(const expr of ['tan(90)','sec(90)','csc(0)','cot(0)']){
   await page.locator('#expression').fill(expr);
   await page.locator('#calc-form button').click();
   assert.equal(await page.locator('#result').textContent(),'—',expr+' é indefinido');
   await toastWait(page,'Resultado indefinido',{timeout:5000});
  }
  assert.equal(await page.locator('#calc-history button').count(),before,'polos não entram no histórico');
  await page.locator('#angle').selectOption('rad');
  await page.locator('#expression').fill('sec(pi/2)');
  await page.locator('#calc-form button').click();
  assert.equal(await page.locator('#result').textContent(),'—','em RAD o polo de pi/2 também é indefinido');
  await toastWait(page,'Resultado indefinido',{timeout:5000});
  await page.locator('#expression').fill('cot(pi/2)');
  await page.locator('#expression').press('Enter');
  assert.equal(await page.locator('#result').textContent(),'0','em RAD o zero de pi/2 sai exato');
 });
 await check('calc: guia tem os códigos da view e o open sobrevive ao render',async()=>{
  assert.equal(await page.locator('#calc-guide code').count(),17);
  await page.locator('#calc-guide summary').click();
  assert.equal(await page.locator('#calc-guide').evaluate(el=>el.open),true);
  await page.locator('#angle').selectOption('deg');
  assert.equal(await page.locator('#calc-guide').evaluate(el=>el.open),true,'open sobrevive à troca de ângulo');
  await page.locator('#calc-toggle > span').first().click();
  await page.locator('#calc-toggle > span').first().click();
  assert.equal(await page.locator('#calc-guide').evaluate(el=>el.open),true,'open sobrevive ao colapso');
  assert.equal(await page.locator('#calc-guide code').count(),17);
  await page.locator('#calc-guide summary').click();
  await page.locator('#angle').selectOption('rad');
  assert.equal(await page.locator('#calc-guide').evaluate(el=>el.open),false,'fechar a guia também sobrevive');
 });
 await check('calc: teclado do divisor NÃO reabre a calculadora (paridade com o antigo)',async()=>{
  await page.locator('#calc-toggle > span').first().click();
  assert.equal(await page.locator('#calc-body').isHidden(),true);
  await page.locator('#calc-divider').focus();
  await page.keyboard.press('ArrowUp');
  assert.equal(await page.locator('#calc-body').isHidden(),true,'seta não reabre (só o arrasto)');
  await page.locator('#calc-toggle > span').first().click();
 });
 await check('calc: divisor arrasta, reabre a calculadora e limita 72..70%',async()=>{
  await page.locator('#calc-toggle > span').first().click();
  assert.equal(await page.locator('#calc-body').isHidden(),true);
  const divider=page.locator('#calc-divider');
  const box=await divider.boundingBox();
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
  await page.mouse.down();
  await page.mouse.move(box.x+box.width/2,box.y-40,{steps:4});
  assert.equal(await page.locator('#calc-body').isVisible(),true,'arrastar reabre a calculadora (expandCalculator)');
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2,{steps:2});
  await page.mouse.up();
  await page.waitForTimeout(600);
  const height=await page.evaluate(()=>parseInt(getComputedStyle(document.documentElement).getPropertyValue('--calc'))||0);
  assert.ok(height>=72,'mínimo 72 (viu '+height+')');
  assert.equal(JSON.parse(fs.readFileSync(path.join(runtime,'desk.json'),'utf8')).calcHeight,height,'calcHeight salvo bate com o --calc');
  await page.locator('#calc-divider').focus();
  for(let i=0;i<40;i++)await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(80);
  assert.equal(await page.evaluate(()=>parseInt(getComputedStyle(document.documentElement).getPropertyValue('--calc'))),72,'ArrowDown trava no mínimo');
  for(let i=0;i<50;i++)await page.keyboard.press('ArrowUp');
  await page.waitForTimeout(80);
  assert.equal(await page.evaluate(()=>parseInt(getComputedStyle(document.documentElement).getPropertyValue('--calc'))),700,'ArrowUp trava no máximo');
  for(let i=0;i<25;i++)await page.keyboard.press('ArrowDown'); // volta para 200 e deixa a UI clicável
  await page.waitForTimeout(700);
  assert.equal(await page.evaluate(()=>parseInt(getComputedStyle(document.documentElement).getPropertyValue('--calc'))),200,'restaura uma altura confortável');
 });

 // ------------------------------------------------------------------ 3. medidor / ctx-tip
 console.log('\n== medidor / rodapé ==');
 await check('medidor: 57 sem warn, 62 warn, 84 warn, 85 hot, 90/99 hot',async()=>{
  await refreshMeter(ctl,57);
  await page.waitForFunction(()=>document.querySelector('#ctx-meter em').textContent==='57%',undefined,{timeout:8000});
  assert.equal((await page.locator('#ctx-meter').getAttribute('class'))||'','');
  assert.equal(await page.locator('#ctx-meter i').getAttribute('style'),'width:57%');
  for(const [pct,cls] of [[62,'warn'],[84,'warn'],[85,'hot'],[90,'hot'],[99,'hot']]){
   await refreshMeter(ctl,pct);
   await page.waitForFunction(p=>document.querySelector('#ctx-meter em').textContent===p+'%',String(pct),{timeout:8000});
   assert.equal(await page.locator('#ctx-meter').getAttribute('class'),cls,pct+'% → '+cls);
   assert.equal(await page.locator('#ctx-meter i').getAttribute('style'),'width:'+pct+'%');
  }
 });
 await check('medidor: 59.5 arredonda para 60/warn; 84.5 arredonda para 85/hot (contrato)',async()=>{
  await refreshMeter(ctl,59.5);
  await page.waitForFunction(()=>document.querySelector('#ctx-meter em').textContent==='60%',undefined,{timeout:8000});
  assert.equal(await page.locator('#ctx-meter i').getAttribute('style'),'width:60%');
  assert.equal(await page.locator('#ctx-meter').getAttribute('class'),'warn');
  await refreshMeter(ctl,84.5);
  await page.waitForFunction(()=>document.querySelector('#ctx-meter em').textContent==='85%',undefined,{timeout:8000});
  assert.equal(await page.locator('#ctx-meter').getAttribute('class'),'hot');
  assert.equal(await page.locator('#ctx-meter').getAttribute('data-no-tip'),'');
 });
 await check('medidor: sem usage o medidor some e o rodapé perde o contexto',async()=>{
  try{
   await refreshMeter(ctl,'hidden');
   await page.waitForFunction(()=>document.querySelector('#ctx-meter').hidden===true,undefined,{timeout:8000});
   await page.waitForFunction(()=>!document.querySelector('#foot-status .fs-ctx'),undefined,{timeout:8000});
   assert.equal(await page.locator('#ctx-meter').getAttribute('hidden'),'');
  }finally{
   await refreshMeter(ctl,62);
   await page.waitForFunction(()=>document.querySelector('#ctx-meter em').textContent==='62%',undefined,{timeout:8000});
  }
 });
 await check('ctx-tip: hover mostra o texto do fato e não vaza a janela',async()=>{
  await page.locator('#ctx-meter').hover();
  await page.waitForFunction(()=>{const tip=document.querySelector('#ctx-tip'),meter=document.querySelector('#ctx-meter');return !!tip&&!tip.hidden&&!!meter._tipText&&tip.textContent===meter._tipText;},{timeout:5000});
  const tip=await page.evaluate(()=>{const t=document.querySelector('#ctx-tip');const r=t.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,vw:innerWidth,vh:innerHeight,text:t.textContent};});
  assert.match(tip.text,/^Contexto do modelo: 62%/);
  assert.ok(tip.left>=0&&tip.right<=tip.vw+1,'não vaza horizontal (left='+Math.round(tip.left)+' right='+Math.round(tip.right)+' vw='+tip.vw+')');
  assert.ok(tip.top>=0&&tip.bottom<=tip.vh+1,'não vaza vertical (top='+Math.round(tip.top)+' bottom='+Math.round(tip.bottom)+' vh='+tip.vh+')');
  await page.mouse.move(6,400);
  await page.waitForFunction(()=>document.querySelector('#ctx-tip').hidden,undefined,{timeout:5000});
 });
 await check('ctx-tip: clique no rodapé abre/fecha e o texto é o do medidor',async()=>{
  await page.locator('#foot-status').click();
  await page.waitForFunction(()=>!document.querySelector('#ctx-tip').hidden,undefined,{timeout:5000});
  assert.equal(await page.evaluate(()=>document.querySelector('#ctx-tip').textContent===document.querySelector('#ctx-meter')._tipText),true);
  await page.locator('#foot-status').click();
  await page.waitForFunction(()=>document.querySelector('#ctx-tip').hidden,undefined,{timeout:5000});
  // Enter no botão do rodapé alterna igual ao clique (ele é um <button> de verdade)
  await page.locator('#foot-status').focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(()=>!document.querySelector('#ctx-tip').hidden,undefined,{timeout:5000});
  await page.keyboard.press('Enter');
  await page.waitForFunction(()=>document.querySelector('#ctx-tip').hidden,undefined,{timeout:5000});
 });
 await check('ctx-tip: em janela estreita o balão fica dentro dela',async()=>{
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(980,700));
  await page.waitForTimeout(300);
  // texto novo força um posicionamento novo, medido com o nó ainda oculto
  await refreshMeter(ctl,63);
  await page.waitForFunction(()=>document.querySelector('#ctx-meter em').textContent==='63%',undefined,{timeout:8000});
  await page.mouse.move(6,400);
  await page.locator('#ctx-meter').hover();
  await page.waitForFunction(()=>!document.querySelector('#ctx-tip').hidden,undefined,{timeout:5000});
  const tip=await page.evaluate(()=>{const t=document.querySelector('#ctx-tip');const r=t.getBoundingClientRect();return {left:r.left,right:r.right,vw:innerWidth};});
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1280,820));
  await page.waitForTimeout(250);
  await page.mouse.move(6,400);
  await page.waitForFunction(()=>document.querySelector('#ctx-tip').hidden,undefined,{timeout:5000});
  await refreshMeter(ctl,62);
  await page.waitForFunction(()=>document.querySelector('#ctx-meter em').textContent==='62%',undefined,{timeout:8000});
  console.log(`      janela estreita: balão left=${Math.round(tip.left)} right=${Math.round(tip.right)} vw=${tip.vw}`);
  assert.ok(tip.right<=tip.vw+1,'com a janela estreita o balão fica dentro dela (right='+Math.round(tip.right)+' vw='+tip.vw+')');
 });
 await note('ctx-tip: resize com o balão aberto não reposiciona (fica fora da janela)',async()=>{
  await page.locator('#foot-status').click();
  await page.waitForFunction(()=>!document.querySelector('#ctx-tip').hidden,undefined,{timeout:5000});
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(980,700));
  await page.waitForTimeout(400);
  const box=await page.locator('#ctx-tip').boundingBox();
  const vw=await page.evaluate(()=>innerWidth);
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1280,820));
  await page.waitForTimeout(250);
  await page.locator('#foot-status').click();
  await page.waitForFunction(()=>document.querySelector('#ctx-tip').hidden,undefined,{timeout:5000});
  await page.mouse.move(6,400);
  console.log(`      resize: balão right=${Math.round((box?.x||0)+(box?.width||0))} vw=${vw}`);
  assert.ok(box&&box.x+box.width<=vw+1,'o balão devia continuar dentro da janela depois do resize (right='+Math.round((box?.x||0)+(box?.width||0))+' vw='+vw+')');
 });
 await check('rodapé: no turno busy sobram só as partes do contexto',async()=>{
  await page.locator('#prompt').fill('explique o teorema de Pitágoras');
  await page.locator('#send').click();
  await page.waitForFunction(()=>document.querySelector('#send').disabled,undefined,{timeout:8000});
  assert.equal(await page.locator('#session-select').isDisabled(),true,'seletor travado no turno');
  await page.waitForFunction(()=>document.querySelectorAll('#foot-status .fs-item').length===1,undefined,{timeout:8000});
  const items=await page.locator('#foot-status .fs-item').allTextContents();
  assert.match(items[0],/%$/,'o contexto continua');
  await page.waitForSelector('#messages .message.assistant:not(.quiz) .katex',{timeout:20000});
  await page.waitForFunction(()=>!document.querySelector('#send').disabled,undefined,{timeout:20000});
  await page.waitForFunction(()=>document.querySelectorAll('#foot-status .fs-item').length===3,undefined,{timeout:8000});
  assert.equal(await page.locator('#session-select').isDisabled(),false);
 });
 await check('seletor: opções com selected única e troca de sessão',async()=>{
  await page.waitForFunction(()=>{const s=document.querySelector('#session-select');return s&&s.options.length>=2&&!s.disabled;},undefined,{timeout:20000});
  const info=await page.evaluate(()=>{const s=document.querySelector('#session-select');return {label:s.getAttribute('aria-label'),values:[...s.options].map(o=>o.value),selected:[...s.options].filter(o=>o.selected).map(o=>o.value),value:s.value};});
  assert.equal(info.label,'Conversa');
  assert.equal(info.selected.length,1);
  assert.equal(info.selected[0],info.value);
  const old=info.values.find(v=>v.endsWith('pi-1700000000000.jsonl'));
  assert.ok(old,'a sessão antiga aparece');
  await page.locator('#session-select').selectOption(old);
  await page.waitForFunction(v=>document.querySelector('#session-select').value===v,old,{timeout:20000});
  await page.waitForFunction(()=>document.querySelector('#messages').textContent.includes('sessão antiga da caça'),undefined,{timeout:20000});
  const back=info.values.find(v=>v.endsWith(path.basename(session)));
  await page.locator('#session-select').selectOption(back);
  await page.waitForFunction(v=>document.querySelector('#session-select').value===v,back,{timeout:20000});
 });

 // ------------------------------------------------------------------ 4. GeoGebra
 console.log('\n== GeoGebra ==');
 const bridgeFile=path.join(runtime,'ggb-bridge.json');
 let bridge=null,ggbReady=false;
 const post=(body,route='/run',token)=>fetch(`http://127.0.0.1:${bridge.port}${route}`,{method:'POST',headers:{'content-type':'application/json','x-desk-token':token??bridge.token},body:JSON.stringify(body)});
 await check('ggb: aba ativa sobrepõe o PDF grid, marca a aba e mostra a barra',async()=>{
  await page.locator('#course-tabs button[data-id="geogebra"]').click();
  await page.waitForFunction(()=>document.querySelector('#references').classList.contains('ggb')&&!document.querySelector('#ggb-bar').hidden,undefined,{timeout:10000});
  const tab=await page.evaluate(()=>{const t=document.querySelector('#course-tabs button[data-id="geogebra"]');return {active:t.classList.contains('active'),aria:t.getAttribute('aria-selected'),role:t.getAttribute('role'),disabled:t.disabled};});
  assert.equal(tab.active,true);
  assert.equal(tab.aria,'true');
  assert.equal(tab.role,'tab');
  assert.equal(tab.disabled,false);
  assert.equal(await page.locator('#pdf-grid').first().evaluate(el=>getComputedStyle(el).visibility),'hidden');
  assert.equal(await page.locator('#ggb-shot').isVisible(),true);
  assert.ok(fs.existsSync(bridgeFile),'ggb-bridge.json existe');
 });
 await check('ggb: ponte valida token, rotas e corpo',async()=>{
  bridge=JSON.parse(fs.readFileSync(bridgeFile,'utf8'));
  assert.equal((await post({command:'f(x)=x'},'/run','errado')).status,403);
  assert.equal((await post('{nada','/run')).status,400);
  assert.equal((await post({command:''})).status,400);
  assert.equal((await post({command:'x'.repeat(2001)})).status,400);
  assert.equal((await fetch(`http://127.0.0.1:${bridge.port}/nada`,{method:'POST',headers:{'x-desk-token':bridge.token}})).status,404);
 });
 await check('ggb: shot espera o applet e o Print no chat anexa a imagem',async()=>{
  for(let i=0;i<30;i++){
   try{const s=await page.evaluate(()=>window.desk.ggbShot());if(s?.dataUrl){ggbReady=true;break;}}
   catch(e){if(!/carregando/.test(String(e.message)))throw e;}
   await page.waitForTimeout(1000);
  }
  if(!ggbReady){
   const err=await page.evaluate(()=>window.desk.ggbShot().then(()=>null,e=>String(e.message||e)));
   assert.match(err,/carregando/,'offline ainda explica que o applet está carregando');
   console.log('      (sem applet pronto: só o portão do shot foi exercitado)');
   return;
  }
  const shot=await page.evaluate(()=>window.desk.ggbShot());
  assert.match(shot.dataUrl,/^data:image\/png;base64,/);
  await page.locator('#ggb-shot').click();
  await page.waitForSelector('#attachments .attachment img',{timeout:15000});
  assert.match(await page.locator('#attachments .attachment img').getAttribute('alt'),/geogebra/i);
  await page.locator('#attachments .attachment-remove').click();
  await page.waitForFunction(()=>document.querySelector('#attachments').hidden);
 });
 if(ggbReady)await check('ggb: construção, snapshot ao sair e restauração ao voltar',async()=>{
  const run=await (await post({command:'h(x)=x^3'})).json();
  assert.equal(run.ok,true,'evalCommand da ponte');
  const stateNow=await (await post({},'/state')).json();
  assert.ok(stateNow.ok&&/h/.test(stateNow.state?.objects||''),'objeto aparece no state');
  const png=await (await post({},'/screenshot')).json();
  assert.ok(png.png&&png.png.length>100,'/screenshot devolve PNG base64');
  await page.locator('#course-tabs button[data-id="Calc"]').click();
  await page.waitForFunction(()=>!document.querySelector('#references').classList.contains('ggb'));
  let saved=false;
  for(let i=0;i<50&&!saved;i++){await page.waitForTimeout(200);saved=fs.existsSync(path.join(runtime,'ggb','Calc.b64'))&&fs.readFileSync(path.join(runtime,'ggb','Calc.b64'),'utf8').length>0;}
  assert.ok(saved,'sair do GGB grava o snapshot da matéria');
  const desk=JSON.parse(fs.readFileSync(path.join(runtime,'desk.json'),'utf8'));
  assert.equal(desk.courseStates?.Calc?.ggbBase64,undefined,'desk.json não guarda mais ggbBase64');
  await page.locator('#course-tabs button[data-id="geogebra"]').click();
  await page.waitForFunction(()=>document.querySelector('#references').classList.contains('ggb'));
  let restored=false;
  for(let i=0;i<60&&!restored;i++){
   await page.waitForTimeout(500);
   const ready=await page.evaluate(()=>window.desk.ggbShot().then(()=>true,()=>false));
   if(!ready)continue;
   const state=await (await post({},'/state')).json();
   restored=/h/.test(state.state?.objects||'');
  }
  assert.ok(restored,'voltar na aba restaura a construção do snapshot');
 });
 if(ggbReady)await check('ggb: redimensionar a janela reaplica a construção depois do reload do applet',async()=>{
  const before=await (await post({},'/state')).json();
  assert.ok(/h/.test(before.state?.objects||''),'antes do resize a construção está lá');
  // objeto criado agora e ainda não snapshotado: precisa sobreviver à captura do resize
  const made=await (await post({command:'k(x)=x^2+1'})).json();
  assert.equal(made.ok,true,'objeto vivo criado pela ponte');
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1240,860));
  let after=null;
  for(let i=0;i<60;i++){
   await page.waitForTimeout(500);
   const ready=await page.evaluate(()=>window.desk.ggbShot().then(()=>true,()=>false));
   if(!ready)continue;
   after=await (await post({},'/state')).json();
   if(/h/.test(after.state?.objects||'')&&/k/.test(after.state?.objects||''))break;
  }
  assert.ok(/h/.test(after?.state?.objects||''),'depois do resize a construção antiga continua (antes: '+String(before.state?.objects||'').split('\n')[0]+'; depois: '+String(after?.state?.objects||'').split('\n')[0]+')');
  assert.ok(/k/.test(after?.state?.objects||''),'depois do resize o objeto vivo ainda não snapshotado continua ('+String(after?.state?.objects||'').split('\n')[0]+')');
 });
 await check('ggb: sair para OUTRA matéria desativa e devolve o PDF grid',async()=>{
  if(!await page.locator('#references').evaluate(el=>el.classList.contains('ggb'))){
   await page.locator('#course-tabs button[data-id="geogebra"]').click();
   await page.waitForFunction(()=>document.querySelector('#references').classList.contains('ggb'));
  }
  await page.locator('#course-tabs button[data-id="Geo"]').click();
  await page.waitForFunction(()=>!document.querySelector('#references').classList.contains('ggb'),undefined,{timeout:10000});
  assert.equal(await page.locator('#ggb-bar').isHidden(),true);
  assert.equal(await page.locator('#pdf-grid').first().evaluate(el=>getComputedStyle(el).visibility),'visible');
 });
 await check('ggb: reativar já ativo é no-op; clique na matéria corrente desativa',async()=>{
  await page.locator('#course-tabs button[data-id="geogebra"]').click();
  await page.waitForFunction(()=>document.querySelector('#references').classList.contains('ggb'));
  const before=await page.locator('#references').getAttribute('class');
  await page.locator('#course-tabs button[data-id="geogebra"]').click();
  await page.waitForTimeout(300);
  assert.equal(await page.locator('#references').getAttribute('class'),before);
  assert.equal(await page.locator('#ggb-bar').isHidden(),false);
  await page.locator('#course-tabs button[data-id="Geo"]').click();
  await page.waitForFunction(()=>!document.querySelector('#references').classList.contains('ggb'));
  assert.equal(await page.locator('#reference-toggle').getAttribute('hidden'),null,'o toggle do formulário continua presente');
 });

 // ------------------------------------------------------------------ 5. layout extremo
 console.log('\n== layout ==');
 await note('layout: com --calc alto o composer do chat fica sob a calculadora (CSS pré-rewrite)',async()=>{
  await page.evaluate(()=>document.documentElement.style.setProperty('--calc','700px'));
  await page.waitForTimeout(250);
  const hit=await page.evaluate(()=>{
   const send=document.querySelector('#send').getBoundingClientRect();
   const el=document.elementFromPoint(send.x+send.width/2,send.y+send.height/2);
   return {atSend:el?el.id||el.tagName:'',sendY:Math.round(send.y),chatBottom:Math.round(document.querySelector('#chat').getBoundingClientRect().bottom),calcTop:Math.round(document.querySelector('#calculator').getBoundingClientRect().top)};
  });
  await page.evaluate(()=>document.documentElement.style.setProperty('--calc','200px'));
  assert.equal(hit.atSend,'send','o botão Enviar continua clicável (chat bottom='+hit.chatBottom+', send y='+hit.sendY+', calc top='+hit.calcTop+'; acertou '+hit.atSend+')');
 });

 // ------------------------------------------------------------------ 6. persistência e erro
 console.log('\n== persistência / erro ==');
 await check('calc: altura sobrevive ao relançamento',async()=>{
  await page.locator('#calc-divider').focus();
  await page.waitForTimeout(150);
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(120);
  const expected=await page.evaluate(()=>parseInt(getComputedStyle(document.documentElement).getPropertyValue('--calc')));
  let saved=null;
  for(let i=0;i<25;i++){
   await page.waitForTimeout(120);
   saved=JSON.parse(fs.readFileSync(path.join(runtime,'desk.json'),'utf8')).calcHeight;
   if(saved===expected)break;
  }
  assert.equal(saved,expected,'o save debounced chegou ao desk.json');
  await ctx.app.close();
  app=ctx.app=await launchDesk({runtime,env:{LEARNING_DESK_PI:wrapper}});
  page=ctx.page=await ctx.app.firstWindow();
  watchErrors(page,errors);
  await page.waitForSelector('#expression',{timeout:30000});
  // `loadCourse` só aplica o --calc depois de montar os PDFs; espera o inline
  await page.waitForFunction(v=>document.documentElement.style.getPropertyValue('--calc')===v+'px',String(expected),{timeout:30000});
  assert.equal(await page.evaluate(()=>parseInt(getComputedStyle(document.documentElement).getPropertyValue('--calc'))),expected,'--calc restaurado do desk.json');
  assert.equal(await page.locator('#angle option[selected]').getAttribute('value'),'rad','ângulo não é persistido (paridade)');
  assert.equal(await page.locator('#calc-guide').evaluate(el=>el.open),false,'guia não é persistida');
  assert.equal(await page.locator('#calc-history button').count(),0,'histórico não é persistido (paridade)');
 });
 await check('status: Pi que não sobe vira ponto error com tooltip',async()=>{
  const errRuntime=newRuntime('hunt-erro');
  seedCourse(errRuntime,'Calc');
  writeDeskJson(errRuntime,{courseId:'Calc'});
  writeConfigJson(errRuntime,{vaultPath:errRuntime,courses:[{id:'Calc',name:'Cálculo',path:path.join(errRuntime,'learning','Courses','Calc')}]});
  const errApp=await launchDesk({runtime:errRuntime,env:{LEARNING_DESK_PI:'/usr/bin/false'}});
  try{
   const errPage=await errApp.firstWindow();
   await errPage.waitForSelector('#status-dot.error',{timeout:20000});
   const dot=await errPage.evaluate(()=>{const d=document.querySelector('#status-dot');return {tip:d.getAttribute('data-tip'),aria:d.getAttribute('aria-label'),title:d.hasAttribute('title')};});
   assert.match(dot.tip,/Pi desconectado|Falha ao conectar/);
   assert.equal(dot.aria,dot.tip);
   assert.equal(dot.title,false);
   assert.equal(await errPage.locator('#auto-compact').isHidden(),true,'sem conexão o auto-compact fica oculto');
   assert.equal(await errPage.locator('#foot-status').isHidden(),true);
  }finally{await errApp.close();}
 });

 // ------------------------------------------------------------------ 7. sinais
 console.log('\n== sinais ==');
 await check('sinais: nenhum pageerror/console.error do renderer',async()=>{assert.deepEqual(errors,[]);});
 await check('sinais: desk.log do runtime sem stack inesperada',async()=>{
  const log=path.join(runtime,'desk.log');
  if(fs.existsSync(log)){
   const text=fs.readFileSync(log,'utf8');
   const bad=text.split('\n').filter(line=>line&&!/erro forçado|pi-|EADDR|ECONN|ENOENT|GeoGebra|geogebra/i.test(line));
   assert.deepEqual(bad,[],'linhas inesperadas no desk.log');
  }
 });
 await check('ggb: recarregar o renderer (⌘R) descarta a View nativa',async()=>{
  await page.locator('#course-tabs button[data-id="geogebra"]').click();
  await page.waitForFunction(()=>document.querySelector('#references').classList.contains('ggb'));
  let ready=false;
  for(let i=0;i<30&&!ready;i++){
   ready=await page.evaluate(()=>window.desk.ggbShot().then(()=>true,()=>false));
   if(!ready)await page.waitForTimeout(1000);
  }
  assert.ok(ready,'o applet voltou a ficar pronto');
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.reload());
  await page.waitForSelector('#expression',{timeout:30000});
  await page.waitForTimeout(1500);
  const ui=await page.evaluate(()=>({cls:document.querySelector('#references').classList.contains('ggb'),bar:document.querySelector('#ggb-bar').hidden}));
  let viewAlive=false;
  try{const s=await page.evaluate(()=>window.desk.ggbShot());viewAlive=!!s?.dataUrl;}catch{}
  assert.equal(viewAlive,false,'depois do reload a View nativa devia sair (classe ggb='+ui.cls+', bar hidden='+ui.bar+', ggbShot respondeu='+viewAlive+')');
  assert.equal(ui.cls,false,'a Mesa volta sem a classe ggb');
  assert.equal(ui.bar,true,'a barra do GGB fica escondida');
  // reativar depois do reload mostra a mesma View viva (o applet não foi recriado)
  await page.locator('#course-tabs button[data-id="geogebra"]').click();
  await page.waitForFunction(()=>document.querySelector('#references').classList.contains('ggb'));
  let back=false;
  for(let i=0;i<30&&!back;i++){
   back=await page.evaluate(()=>window.desk.ggbShot().then(()=>true,()=>false));
   if(!back)await page.waitForTimeout(500);
  }
  assert.ok(back,'depois do reload do renderer a aba reativa a View nativa');
 });
 // guarda o runtime junto dos prints quando houver algo a relatar
 if(problems.length||notes.length){
  for(const name of fs.readdirSync(runtime)){
   if(!/^(desk\.json|config\.json|desk\.log(\.\d+)?|ggb-bridge\.json|.*\.jsonl)$/.test(name))continue;
   try{fs.copyFileSync(path.join(runtime,name),path.join(ART,name));}catch{}
  }
  try{fs.cpSync(path.join(runtime,'ggb'),path.join(ART,'ggb'),{recursive:true});}catch{}
 }
 await app.close();
});

dump();
if(problems.length)process.exitCode=1;
