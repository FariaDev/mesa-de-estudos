// node tests/tutor-states-ui.mjs — estados do tutor na coluna (ticket #17),
// testados na janela. Desligado (com retomada guardada e sem), ligando (com
// Cancelar que interrompe de verdade) e sem resposta (motivo em uma frase e
// as três saídas). Mede tamanho de fonte e distâncias nos dois temas, em
// 1440×900 e 900×650 (com a calculadora aberta), e grava capturas dos quatro
// estados para olhar com os olhos.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
 withArtifacts,newRuntime,seedCourse,writeConfigJson,writeDeskJson,launchDesk,statusOnline,tinyPdf,FAKE_PI,
 reviewShot,screenshotDirectory,setTheme,freezeMotion,resizeWindow
} from './helpers.mjs';
import {layoutStable,nextFrames,pollUntil} from './waits.mjs';

const out=screenshotDirectory('tutor-states');
const size=(app,page,width,height)=>resizeWindow(app,page,width,height);
const RECORD={stopped:'travei na 3 do item b',next:'seguir para a 4 e depois revisar a 2',exercise:'Lista 2 · 7b',xopp:'',pages:[]};

/* Pi de bancada: espera o arquivo-portão aparecer antes de subir o fake (a
   janela "ligando" fica aberta o tempo que o teste quiser) e, com
   TS_MODE=fail, morre na hora com um código (o motivo da falha). O pid fica em
   disco para provar que Cancelar derrubou o processo. */
function writeGatePi(runtime){
 const wrapper=path.join(runtime,'pi-gate.mjs');
 fs.writeFileSync(wrapper,`#!/usr/bin/env node
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const here=path.dirname(new URL(import.meta.url).pathname);
fs.writeFileSync(path.join(here,'pi-gate.pid'),String(process.pid));
if(process.env.TS_MODE==='fail'){process.stderr.write('falha combinada do teste\\n');process.exit(7);}
const gate=path.join(here,'pi-gate.open');
const timer=setInterval(()=>{
 if(!fs.existsSync(gate))return;
 clearInterval(timer);
 const child=spawn(process.execPath,[${JSON.stringify(FAKE_PI)},...process.argv.slice(2)],{stdio:'inherit'});
 child.on('exit',code=>process.exit(code??0));
},50);
`);
 fs.chmodSync(wrapper,0o755);
 return {wrapper,pid:path.join(runtime,'pi-gate.pid'),gate:path.join(runtime,'pi-gate.open')};
}

function seed(runtime,{record=true,sessions=false}={}){
 const course=seedCourse(runtime,'calc');
 const pdf=path.join(course,'Limites.pdf');fs.writeFileSync(pdf,tinyPdf('Limites e derivadas'));
 writeConfigJson(runtime,{runtimePath:runtime,vaultPath:runtime,courses:[{id:'calc',name:'Cálculo',path:course}]});
 /* Duas sessões antigas sem assunto (arquivo vazio, sem prévia): a lista tem de
    distingui-las pelo nome (#27, item 6). */
 const old=sessions?[new Date(2026,9,10,13,27),new Date(2026,9,10,13,41)].map((when,i)=>{
  const file=path.join(runtime,`pi-old-${i}.jsonl`);fs.writeFileSync(file,'');
  return {path:file,started:when.getTime(),preview:''};
 }):[];
 writeDeskJson(runtime,{courseId:'calc',courseStates:{calc:{pdfs:[{path:pdf,page:1}],study:{title:'Lista 2 · 7b',xopp:''},sessions:old}},pdfs:[{path:pdf,page:1}],study:{title:'Lista 2 · 7b',xopp:''}});
 if(record)fs.writeFileSync(path.join(runtime,'resume.json'),JSON.stringify({calc:RECORD}));
}

/* O que a pessoa vê: textos, tamanhos, distâncias e se algo vaza da coluna. */
const read=page=>page.evaluate(()=>{
 const q=sel=>document.querySelector(sel);
 const box=el=>{if(!el)return null;const r=el.getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:r.width,height:r.height};};
 const state=q('#tutor-state');
 const lead=state?.querySelector('.ts-lead'),fine=state?.querySelector('.ts-fine'),actions=state?.querySelector('.ts-actions'),text=state?.querySelector('.ts-text');
 const style=el=>el?getComputedStyle(el):null;
 const column=q('#chat').getBoundingClientRect();
 const composerBox=q('#composer-box');
 const activity=q('#activity');
 const buttons=[...(actions?.querySelectorAll('button')||[])];
 return {
  state:state?.dataset.state||'',hidden:!!state?.hidden,
  lead:lead?.textContent||'',fine:fine?.textContent||'',
  buttons:buttons.map(b=>({id:b.id,text:b.textContent.trim(),cls:b.className,size:getComputedStyle(b).fontSize,weight:getComputedStyle(b).fontWeight})),
  leadSize:style(lead)?.fontSize||'',fineSize:style(fine)?.fontSize||'',
  leadColor:style(lead)?.color||'',fineColor:style(fine)?.color||'',
  boxes:{state:box(state),text:box(text),actions:box(actions),composer:box(composerBox),activity:box(activity),column:{top:column.top,bottom:column.bottom,left:column.left,right:column.right}},
  gapTextActions:text&&actions?actions.getBoundingClientRect().top-text.getBoundingClientRect().bottom:null,
  gapActionsBox:actions&&composerBox?composerBox.getBoundingClientRect().top-actions.getBoundingClientRect().bottom:null,
  overflowX:state?state.scrollWidth-state.clientWidth:0,
  activityText:activity?.textContent||'',
  activityOverflow:activity?activity.scrollWidth-activity.clientWidth:0,
  win:{width:innerWidth,height:innerHeight}
 };
});

const withinColumn=(view,note)=>{
 const {state,column}=view.boxes;
 assert.ok(state,`${note}: bloco medido`);
 assert.ok(state.left>=column.left-0.5&&state.right<=column.right+0.5,`${note}: o bloco cabe na largura da coluna (${JSON.stringify({left:state.left,right:state.right,column})})`);
 assert.ok(view.overflowX<=0.5,`${note}: nada vaza para o lado (${view.overflowX})`);
 assert.ok(view.activityOverflow<=0.5,`${note}: a linha de atividade não vaza (${view.activityOverflow})`);
 const {text,actions,composer}=view.boxes;
 assert.ok(actions&&actions.height>=30,`${note}: os botões existem e têm altura (${JSON.stringify(actions)})`);
 assert.ok(actions.right<=column.right+0.5,`${note}: os botões ficam na coluna`);
 assert.ok(text.bottom<=actions.top+0.5,`${note}: texto acima dos botões`);
 assert.ok(actions.bottom<=composer.top+0.5,`${note}: os botões não passam por baixo da caixa de mensagem (${actions.bottom} × ${composer.top})`);
 assert.ok(actions.bottom<=view.win.height+0.5,`${note}: os botões estão à vista na janela`);
};
const typography=(view,note)=>{
 assert.equal(view.leadSize,'15px',`${note}: a linha em destaque é 15px`);
 if(view.fine)assert.equal(view.fineSize,'13px',`${note}: a linha miúda é 13px`);
 if(view.fine)assert.notEqual(view.fineColor,view.leadColor,`${note}: a linha miúda é mais discreta`);
 for(const b of view.buttons){
  assert.equal(b.size,'13px',`${note}: o botão "${b.text}" é 13px (canvas: .bt)`);
  if(/ts-(primary|secondary)/.test(b.cls))assert.equal(b.weight,'600',`${note}: o botão "${b.text}" é semibold`);
 }
};
const shot=(page,name)=>reviewShot(page,out,name);

const gaps={};
const record=(key,view)=>{
 (gaps[key]??={})[view.state]={text:view.gapTextActions,box:view.gapActionsBox};
};

/* A janela pequena, com a calculadora aberta (o pior caso da coluna): mede o
   estado como está, grava as capturas nos dois temas e volta ao tamanho de
   antes com a calculadora recolhida. */
async function small(page,app,label){
 await size(app,page,900,650);
 await layoutStable(page,'#messages');
 const toggle=page.locator('#calc-toggle');
 if(await toggle.getAttribute('aria-expanded')!=='true'){
  await toggle.click();
  await page.waitForFunction(()=>document.querySelector('#calc-toggle')?.getAttribute('aria-expanded')==='true');
 }
 await layoutStable(page,'#messages');
 const view=await read(page);
 typography(view,`${label} 900`);withinColumn(view,`${label} 900 com a calculadora aberta`);
 record('900x650',view);
 for(const theme of ['light','dark']){
  await setTheme(page,theme);await nextFrames(page);
  await shot(page,`${theme}-900x650-${label}-calculadora.png`);
 }
 await setTheme(page,'light');
 await toggle.click();
 await page.waitForFunction(()=>document.querySelector('#calc-toggle')?.getAttribute('aria-expanded')==='false');
 await size(app,page,1440,900);
 await layoutStable(page,'#messages');
}

await withArtifacts('tutor-states',async ctx=>{
 const runtime=ctx.runtime=newRuntime('tutorstates');
 seed(runtime);
 const gate=writeGatePi(runtime);
 const app=ctx.app=await launchDesk({runtime,env:{LEARNING_DESK_PI:gate.wrapper}});
 const page=await app.firstWindow();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await size(app,page,1440,900);
 await page.waitForSelector('.pdf-panel',{timeout:30000});
 await freezeMotion(page);

 /* ---- ligando: o Pi não sobe (portão fechado); Cancelar interrompe ---- */
 await page.waitForSelector('#tutor-state[data-state="connecting"]',{timeout:20000});
 let view=await read(page);
 assert.equal(view.lead,'Chamando o tutor');
 assert.deepEqual(view.buttons.map(b=>b.text),['Cancelar']);
 assert.equal(view.activityText,'','a linha de atividade não repete "Chamando o tutor…"');
 typography(view,'ligando 1440');withinColumn(view,'ligando 1440');record('1440x900',view);
 assert.equal(await page.locator('#tutor-state').getAttribute('role'),'status','"ligando" é anunciado como estado');
 assert.equal(await page.locator('#prompt').getAttribute('placeholder'),'Pode ir escrevendo: vai assim que ele atender…','ligando: a caixa diz que a mensagem vai quando ele atender (#27)');
 /* a caixa aceita texto enquanto liga */
 await page.locator('#prompt').fill('mensagem enquanto o tutor liga');
 assert.equal(await page.locator('#prompt').inputValue(),'mensagem enquanto o tutor liga');
 await page.locator('#prompt').fill('');
 for(const theme of ['light','dark']){
  await setTheme(page,theme);await nextFrames(page);
  await shot(page,`${theme}-1440x900-ligando.png`);
 }
 await setTheme(page,'light');
 await small(page,app,'ligando');
 const pid=Number(fs.readFileSync(gate.pid,'utf8'));
 assert.ok(pid>0);
 await page.locator('#connect-cancel').click();
 await page.waitForFunction(()=>document.querySelector('#tutor-state')?.dataset.state==='resume',undefined,{timeout:10000});
 const isAlive=p=>{try{process.kill(p,0);return true;}catch{return false;}};
 await pollUntil(()=>isAlive(pid),alive=>!alive,{timeout:5000,interval:50,what:`o processo ${pid} do tutor morrer`,onTimeout:'return'});
 assert.equal(isAlive(pid),false,'Cancelar derrubou o processo do tutor que estava subindo');
 /* abre o portão: nada que já foi cancelado pode ressuscitar a conexão */
 fs.writeFileSync(gate.gate,'');
 await page.waitForTimeout(1500);// espera fixa: "nada acontece em 1,5 s" — com o portão aberto, a chamada cancelada não ressuscita a conexão
 assert.equal(await page.locator('#status-dot.online').count(),0,'cancelada, a chamada não volta sozinha');
 assert.equal((await read(page)).state,'resume','a coluna fica no "onde parei" depois de cancelar');

 /* ---- desligado com retomada guardada ---- */
 view=await read(page);
 assert.equal(view.lead,'Da última vez você parou em Lista 2 · 7b: travei na 3 do item b');
 assert.equal(view.fine,'Próximo passo: seguir para a 4 e depois revisar a 2');
 assert.deepEqual(view.buttons.map(b=>b.text),['Retomar','Sessão nova','Esquecer']);
 typography(view,'retomada 1440');withinColumn(view,'retomada 1440');record('1440x900',view);
 assert.equal(view.activityText,'');
 assert.equal(await page.locator('#prompt').getAttribute('placeholder'),'Ou escreva: o tutor liga para responder…','desligado: a caixa diz que o tutor liga para responder (#27)');
 await page.locator('#prompt').fill('texto com o tutor desligado');
 assert.equal(await page.locator('#prompt').inputValue(),'texto com o tutor desligado','a caixa aceita texto desligado');
 await page.locator('#prompt').fill('');
 for(const theme of ['light','dark']){
  await setTheme(page,theme);await nextFrames(page);
  await shot(page,`${theme}-1440x900-desligado-com-retomada.png`);
 }
 await setTheme(page,'light');
 await small(page,app,'desligado-com-retomada');

 /* ---- Retomar: devolve questão/página e escreve a mensagem; nada é enviado ---- */
 await page.locator('#resume-go').click();
 await page.waitForFunction(()=>document.querySelector('#tutor-state')?.dataset.state==='off',undefined,{timeout:10000});
 assert.equal(await page.locator('#prompt').inputValue(),'Continuar de onde parei.\n\nOnde parei: travei na 3 do item b\n\nPróximo passo: seguir para a 4 e depois revisar a 2');
 assert.deepEqual(Object.keys(JSON.parse(fs.readFileSync(path.join(runtime,'resume.json'),'utf8'))),[],'Retomar limpa o registro');
 await page.locator('#prompt').fill('');

 /* ---- desligado sem retomada: só o convite ---- */
 view=await read(page);
 assert.equal(view.state,'off');
 assert.equal(view.lead,'O tutor está desligado.');
 assert.deepEqual(view.buttons.map(b=>b.text),['Chamar o tutor']);
 typography(view,'convite 1440');withinColumn(view,'convite 1440');record('1440x900',view);
 for(const theme of ['light','dark']){
  await setTheme(page,theme);await nextFrames(page);
  await shot(page,`${theme}-1440x900-desligado-sem-retomada.png`);
 }
 await setTheme(page,'light');
 await small(page,app,'desligado-sem-retomada');

 /* ---- Esquecer e Sessão nova (a partir de um registro novo) ---- */
 fs.writeFileSync(path.join(runtime,'resume.json'),JSON.stringify({calc:RECORD}));
 await page.evaluate(async data=>{const {setResumeRecord}=await import('./src/resume.mjs');setResumeRecord(data);},RECORD);
 await page.waitForFunction(()=>document.querySelector('#tutor-state')?.dataset.state==='resume');
 await page.locator('#resume-forget').click();
 await page.waitForFunction(()=>document.querySelector('#tutor-state')?.dataset.state==='off',undefined,{timeout:10000});
 assert.deepEqual(Object.keys(JSON.parse(fs.readFileSync(path.join(runtime,'resume.json'),'utf8'))),[],'Esquecer apaga o registro');
 assert.equal(await page.locator('#exercise-title').inputValue(),'Lista 2 · 7b','Esquecer não mexe no contexto de estudo');

 fs.writeFileSync(path.join(runtime,'resume.json'),JSON.stringify({calc:RECORD}));
 await page.evaluate(async data=>{const {setResumeRecord}=await import('./src/resume.mjs');setResumeRecord(data);},RECORD);
 await page.waitForFunction(()=>document.querySelector('#tutor-state')?.dataset.state==='resume');
 const sessionBefore=await page.locator('#session-title').getAttribute('data-session');
 await page.locator('#resume-new').click();
 await statusOnline(page,{timeout:30000});
 assert.notEqual(await page.locator('#session-title').getAttribute('data-session'),sessionBefore,'Sessão nova abre outra sessão');
 assert.equal(await page.locator('#tutor-state').evaluate(el=>el.hidden),true,'ligado, com o registro deixado para trás: o bloco some');

 assert.deepEqual(errors,[]);
});

/* ---- sem resposta, em outra abertura (o Pi morre com um código) ---- */
await withArtifacts('tutor-states-error',async ctx=>{
 const runtime=ctx.runtime=newRuntime('tutorstates-err');
 seed(runtime,{record:false,sessions:true});
 const gate=writeGatePi(runtime);
 const app=ctx.app=await launchDesk({runtime,env:{LEARNING_DESK_PI:gate.wrapper,TS_MODE:'fail'}});
 const page=await app.firstWindow();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await size(app,page,1440,900);
 await page.waitForSelector('.pdf-panel',{timeout:30000});
 await freezeMotion(page);
 await page.waitForSelector('#tutor-state[data-state="error"]',{timeout:30000});
 let view=await read(page);
 assert.equal(view.lead,'O tutor não atendeu.');
 assert.equal(view.fine,'O tutor fechou sem aviso.','o motivo em português, sem o código de saída (o número fica no log, #27)');
 assert.equal(/\d/.test(view.fine),false,'nenhum número na frase');
 assert.deepEqual(view.buttons.map(b=>b.text),['Chamar de novo','Ver o log','Ajustes do Pi']);
 assert.equal(view.activityText,'','o erro não vai também para a linha de atividade');
 assert.equal(await page.locator('#prompt').getAttribute('placeholder'),'Pode ir escrevendo: vai assim que ele atender…','sem resposta: a mensagem fica guardada e vai quando ele atender (#27)');
 assert.equal(await page.locator('#toast > *').count(),0,'sem aviso flutuante repetindo o erro que a coluna já escreve (#23)');
 typography(view,'erro 1440');withinColumn(view,'erro 1440');record('1440x900',view);
 await page.locator('#prompt').fill('texto sem resposta do tutor');
 assert.equal(await page.locator('#prompt').inputValue(),'texto sem resposta do tutor','a caixa aceita texto sem resposta');
 await page.locator('#prompt').fill('');
 for(const theme of ['light','dark']){
  await setTheme(page,theme);await nextFrames(page);
  await shot(page,`${theme}-1440x900-sem-resposta.png`);
 }
 await setTheme(page,'light');

 /* Ver o log: pede à janela principal para abrir o log (o teste só conta). */
 await app.evaluate(({ipcMain})=>{
  globalThis.__openLogCalls=0;
  ipcMain.removeHandler('open-log');
  ipcMain.handle('open-log',()=>{globalThis.__openLogCalls++;return {ok:false};});
 });
 await page.locator('#state-log').click();
 let calls;
 calls=await pollUntil(()=>app.evaluate(()=>globalThis.__openLogCalls),Boolean,{timeout:3000,interval:50,what:'Ver o log chamar o log da Mesa',onTimeout:'return'});
 assert.equal(calls,1,'Ver o log chama o log da Mesa');

 /* Ajustes do Pi: Configurações abertas no campo do caminho do Pi. */
 await page.locator('#state-pi').click();
 await page.waitForFunction(()=>document.querySelector('#settings-dialog')?.open&&document.activeElement?.id==='cfg-pi',undefined,{timeout:10000});
 await page.keyboard.press('Escape');
 await page.waitForFunction(()=>!document.querySelector('#settings-dialog').open);

 /* Chamar de novo: tenta de novo e volta a "sem resposta" com o mesmo motivo (o Pi ainda morre). */
 await page.locator('#connect').click();
 await page.waitForFunction(()=>document.querySelector('#tutor-state')?.dataset.state==='error',undefined,{timeout:20000});
 assert.equal((await read(page)).fine,'O tutor fechou sem aviso.');
 const log=fs.readFileSync(path.join(runtime,'desk.log'),'utf8');
 assert.match(log,/Chamada ao tutor falhou: .*O tutor parou \(7\)/,'o código de saída fica no log da Mesa');

 /* #27 item 1: com o Pi falhando, nenhum caminho repete o erro num aviso
    flutuante — a coluna já o escreve. Sessão nova, abrir uma sessão da lista,
    /compact e /conferir. */
 const onlyColumn=async label=>{
  await page.waitForFunction(()=>document.querySelector('#tutor-state')?.dataset.state==='error',undefined,{timeout:20000});
  await page.waitForTimeout(500);// espera fixa: "nada acontece em 0,5 s" — a falha de conexão não vira aviso flutuante
  const toasts=await page.locator('#toast > *').allInnerTexts();
  assert.deepEqual(toasts.filter(t=>/tutor|Pi|conex|atend/i.test(t)),[],`${label}: o erro de conexão aparece só na coluna (${JSON.stringify(toasts)})`);
  assert.equal((await read(page)).fine,'O tutor fechou sem aviso.',`${label}: a coluna segue com o motivo`);
 };
 await page.locator('#new-session').click();
 await page.locator('#new-session-default').click();
 await onlyColumn('Sessão nova');
 await page.locator('#session-title').click();
 await page.waitForSelector('#conv-list .conv-row:not(.current)',{timeout:10000});
 /* item 6: duas sessões sem assunto não aparecem as duas como "Sessão" — o
    nome traz a data e a hora, e a linha de meta não repete a data. */
 const rows=await page.locator('#conv-list .conv-row').evaluateAll(els=>els.map(e=>({title:e.querySelector('.conv-title').textContent,meta:e.querySelector('.conv-meta').textContent})));
 const titles=rows.map(r=>r.title);
 assert.equal(new Set(titles).size,titles.length,`nomes distintos na lista: ${JSON.stringify(titles)}`);
 assert.ok(titles.includes('Sessão de 10/10, 13:27')&&titles.includes('Sessão de 10/10, 13:41'),`nome com data e hora: ${JSON.stringify(titles)}`);
 for(const row of rows.filter(r=>/^Sessão de /.test(r.title)))assert.equal(row.meta,'',`a meta não repete a data: ${JSON.stringify(row)}`);
 await page.locator('#conv-list .conv-row:not(.current)').first().click();
 await onlyColumn('abrir sessão da lista');
 await page.locator('#prompt').fill('/compact');
 await page.keyboard.press('Enter');
 await onlyColumn('/compact');
 await page.locator('#prompt').fill('/conferir');
 await page.keyboard.press('Enter');
 await onlyColumn('/conferir');
 await page.locator('#prompt').fill('');

 await small(page,app,'sem-resposta');
 assert.deepEqual(errors,[]);
});

/* ---- sem resposta com instrução do motor: Pi ausente (#23) ---- */
await withArtifacts('tutor-states-no-pi',async ctx=>{
 const runtime=ctx.runtime=newRuntime('tutorstates-nopi');
 seed(runtime,{record:false});
 /* Um "Pi" cujo interpretador não existe: o spawn volta ENOENT, que é o
    "Pi não encontrado" do host, sem depender do que a máquina tem instalado. */
 const ghost=path.join(runtime,'pi-ghost');
 fs.writeFileSync(ghost,'#!/nonexistent/interpreter\n');
 fs.chmodSync(ghost,0o755);
 const app=ctx.app=await launchDesk({runtime,env:{LEARNING_DESK_PI:ghost}});
 const page=await app.firstWindow();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await size(app,page,1440,900);
 await page.waitForSelector('.pdf-panel',{timeout:30000});
 await freezeMotion(page);
 await page.waitForSelector('#tutor-state #connect',{timeout:30000});
 await page.locator('#connect').click();
 await page.waitForSelector('#tutor-state[data-state="error"]',{timeout:30000});
 const view=await read(page);
 assert.equal(view.lead,'O tutor não atendeu.');
 assert.match(view.fine,/^Tutor não encontrado\. Rode npm run setup/,'o motivo traz também a instrução do motor');
 assert.equal(await page.locator('#toast > *').count(),0,'sem aviso flutuante repetindo o erro da coluna');
 typography(view,'sem Pi 1440');withinColumn(view,'sem Pi 1440');
 await small(page,app,'sem-pi');
 const narrow=await read(page);
 assert.match(narrow.fine,/Rode npm run setup/,'a instrução segue à vista na janela mínima');
 assert.deepEqual(errors,[]);
});

/* ---- as distâncias são as mesmas nos três estados (medidas, não vistas) ---- */
for(const [size,table] of Object.entries(gaps)){
 const states=Object.entries(table);
 if(states.length<2)continue;
 const [firstName,first]=states[0];
 for(const [name,value] of states.slice(1)){
  assert.ok(Math.abs(value.text-first.text)<=0.5,`${size}: texto → botões igual em ${firstName} e ${name} (${first.text} × ${value.text})`);
  assert.ok(Math.abs(value.box-first.box)<=0.5,`${size}: botões → caixa de mensagem igual em ${firstName} e ${name} (${first.box} × ${value.box})`);
 }
}
console.log('TUTOR STATES PASSED: desligado (com e sem retomada), ligando com Cancelar de verdade e sem resposta com motivo e saídas; fontes 15/13px e distâncias iguais nos dois temas e tamanhos.');
console.log('capturas em',out);
