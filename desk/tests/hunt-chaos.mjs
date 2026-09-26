#!/usr/bin/env node
/* Caça adversarial da Mesa de Estudos (onda de bugs pós-rewrite Bend).

   Roda cenários encadeados com o fake-pi de caos (`hunt-pi.mjs`) em runtimes
   temporários, usando o mesmo harness do `ui-smoke.mjs`. NÃO toca em
   `desk/.runtime`, não instala nada e não altera o app.

   Uso:
     node tests/hunt-chaos.mjs            # todos os cenários
     node tests/hunt-chaos.mjs persist    # só os que casam com o filtro

   Saída: ✓/✗ por checagem; [achado] para o que é degradação sem crash. No fim
   imprime o resumo e sai com código 1 se algum `must` falhou. Em falha o
   runtime do cenário vira artefato (helpers.saveArtifacts). */
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {withArtifacts,newRuntime,seedCourse,seedSession,writeDeskJson,writeConfigJson,launchDesk,statusOnline,sendEnabled,toastWait,DESK} from './helpers.mjs';

const HUNT_PI=path.join(DESK,'tests','hunt-pi.mjs');
try{fs.chmodSync(HUNT_PI,0o755);}catch{}
const FILTER=process.argv[2]||'';
const results=[];
let failures=0;

function must(name,ok,detail=''){
 results.push({name,ok:!!ok,hard:true,detail});
 if(ok)console.log(`  ✓ ${name}`);
 else{failures++;console.error(`  ✗ ${name}${detail?` — ${detail}`:''}`);}
}
function probe(name,ok,detail=''){
 results.push({name,ok:!!ok,hard:false,detail});
 if(ok)console.log(`  ✓ ${name}`);
 else console.log(`  [achado] ${name}${detail?` — ${detail}`:''}`);
}
function huntEnv(modes,extra={}){
 return {LEARNING_DESK_PI:HUNT_PI,HUNT_PI_MODES:modes||'',...extra};
}
function coursePath(runtime,id){return path.join(runtime,'learning','Courses',id);}
function seedCourseWithFile(runtime,id,name,bytes){
 const dir=seedCourse(runtime,id);
 fs.writeFileSync(path.join(dir,name),bytes);
 return dir;
}
function writeConfig(runtime,ids){
 writeConfigJson(runtime,{vaultPath:runtime,courses:ids.map(id=>({id,name:`Matéria ${id}`,path:coursePath(runtime,id)}))});
}
function seedSessionAs(runtime,name,records){
 const file=path.join(runtime,name);
 fs.writeFileSync(file,records.map(record=>JSON.stringify(record)+'\n').join(''));
 return file;
}
function watch(page){
 const errors={pageerrors:[],consoles:[]};
 page.on('pageerror',e=>errors.pageerrors.push(String(e.message)));
 page.on('console',m=>{if(m.type()==='error')errors.consoles.push(m.text());});
 return errors;
}
function deskLog(runtime){
 try{
  return fs.readFileSync(path.join(runtime,'desk.log'),'utf8').split('\n').filter(Boolean).map(line=>{try{return JSON.parse(line);}catch{return {src:'?',line};}});
 }catch{return [];}
}
function runtimeProblems(runtime){
 return deskLog(runtime).filter(entry=>entry.src!=='pi'||!/^\[hunt-pi\]/.test(entry.line||''));
}
function pdfText(runtime){try{return JSON.parse(fs.readFileSync(path.join(runtime,'desk.json'),'utf8'));}catch{return null;}}
function stateJson(runtime){try{return fs.readFileSync(path.join(runtime,'desk.json'),'utf8');}catch{return '';}}

/* PDF multi-página mínimo (mesma estrutura do tinyPdf dos helpers). */
function multiPdf(pageLines){
 const objects=[];
 const pageCount=pageLines.length;
 const fontIndex=3+pageCount*2;
 objects.push('<</Type/Catalog/Pages 2 0 R>>');
 objects.push(`<</Type/Pages/Kids[${pageLines.map((_,i)=>`${3+i*2} 0 R`).join(' ')}]/Count ${pageCount}>>`);
 pageLines.forEach((lines,i)=>{
  const contentIndex=4+i*2;
  objects.push(`<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Resources<</Font<</F1 ${fontIndex} 0 R>>>>/Contents ${contentIndex} 0 R>>`);
  const contents=lines.map((text,j)=>`BT /F1 16 Tf 72 ${720-j*30} Td (${text}) Tj ET`).join('\n');
  objects.push(`<</Length ${contents.length}>>\nstream\n${contents}\nendstream`);
 });
 objects.push('<</Type/Font/Subtype/Type1/BaseFont/Helvetica/Encoding/WinAnsiEncoding>>');
 let out='%PDF-1.4\n';const offsets=[];
 objects.forEach((obj,i)=>{offsets.push(out.length);out+=`${i+1} 0 obj\n${obj}\nendobj\n`;});
 const startxref=out.length;
 out+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.map(off=>`${String(off).padStart(10,'0')} 00000 n \n`).join('')}trailer\n<</Size ${objects.length+1}/Root 1 0 R>>\nstartxref\n${startxref}\n%%EOF\n`;
 return Buffer.from(out,'latin1');
}

async function scenario(name,fn){
 if(FILTER&&!name.includes(FILTER))return;
 console.log(`\n== ${name} ==`);
 try{
  await fn();
  console.log(`  — ${name}: fim`);
 }catch(e){
  failures++;
  console.error(`  ✗ ${name}: EXCEÇÃO — ${e&&e.message||e}`);
  results.push({name:`${name} (exceção)`,ok:false,hard:true,detail:String(e&&e.message||e)});
 }
}

/* Informa um app já lançado para o harness de artefatos/fechamento. */
function track(ctx,app){ctx.app=app;return app;}

/* ====================================================================== */
/* 1. framing do Pi: lixo, fragmento sem newline, ack dividido, dup, ack perdido (timeout) */
await scenario('pi-framing',async()=>{
 await withArtifacts('hunt-pi-framing',async ctx=>{
  const runtime=ctx.runtime=newRuntime('hunt-framing');
  seedCourse(runtime,'A');writeConfig(runtime,['A']);writeDeskJson(runtime,{courseId:'A'});
  const app=track(ctx,await launchDesk({runtime,env:huntEnv('garbage-prompt,unknown-prompt,chunks-prompt,dup-reply-prompt,chunks-event')}));
  const page=await app.firstWindow();const errs=watch(page);
  await statusOnline(page);
  await page.locator('#prompt').fill('primeira da caça');
  await page.locator('#send').click();
  await page.waitForFunction(()=>[...document.querySelectorAll('#messages .message.assistant .body')].some(el=>el.textContent.includes('Eco de caça')),undefined,{timeout:30000});
  await sendEnabled(page,{timeout:20000});
  must('fim do turno apesar de lixo + fragmento + ack duplicado',true);
  const texts=await page.locator('#messages .message.assistant .body').allTextContents();
  must('delta com emoji cortado em bytes é remontado',texts.some(t=>t.includes('🐛')),JSON.stringify(texts).slice(0,220));
  const dotAfterGarbage=await page.locator('#status-dot').getAttribute('class');
  probe('ponto volta a online sozinho depois do lixo no stdout',/online/.test(dotAfterGarbage||''),`class=${dotAfterGarbage}`);
  await page.locator('#prompt').fill('segunda da caça');
  await page.locator('#send').click();
  await page.waitForFunction(()=>[...document.querySelectorAll('#messages .message.assistant .body')].some(el=>el.textContent.includes('Eco de caça: segunda')),undefined,{timeout:20000});
  await sendEnabled(page,{timeout:20000});
  must('mensagem seguinte funciona com o mesmo processo',true);
  must('sem pageerror',errs.pageerrors.length===0,errs.pageerrors.join(' | '));
  probe('sem erro de console no renderer',errs.consoles.length===0,errs.consoles.join(' | '));
  // O ack do 1º prompt nunca chegou (fragmento engoliu a linha): o pedido fica
  // pendente até o timeout de 60s do rpc.cjs e aí ActKill mata o Pi — mesmo com
  // a conversa ociosa. Mede o estrago.
  const before=Date.now();
  let stale=false;
  try{
   await page.waitForFunction(()=>{const t=document.querySelector('#toast');return !!t&&!t.hidden&&/parou de responder/i.test(t.textContent);},undefined,{timeout:70000});
   stale=true;
  }catch{}
  const elapsed=Math.round((Date.now()-before)/1000);
  probe('ack perdido derruba a conexão viva no timeout (60s) sem o usuário agir',!stale,stale?`toast de timeout ${elapsed}s depois do fim do turno; dot=${await page.locator('#status-dot').getAttribute('class')}`:'não derrubou');
  must('app continua utilizável depois do timeout',await page.locator('#send').isEnabled());
  await page.locator('#prompt').fill('terceira da caça depois do timeout');
  await page.locator('#send').click();
  await page.waitForFunction(()=>[...document.querySelectorAll('#messages .message.assistant .body')].some(el=>el.textContent.includes('Eco de caça: terceira')),undefined,{timeout:45000});
  await sendEnabled(page,{timeout:20000});
  must('reconecta e responde depois do timeout',true);
  const problemas=runtimeProblems(runtime).filter(e=>!/parou de responder|Resposta inválida|Pi encerrou/.test(e.line||''));
  probe('desk.log sem estrago além dos avisos esperados',problemas.length===0,problemas.map(e=>e.line).join(' | ').slice(0,300));
 });
});

/* ====================================================================== */
/* 2. Pi morto no meio de um get_messages grande, duas vezes */
await scenario('pi-kill-messages',async()=>{
 await withArtifacts('hunt-kill-messages',async ctx=>{
  const runtime=ctx.runtime=newRuntime('hunt-killmsg');
  const many=[];
  for(let i=0;i<400;i++)many.push({type:'message',message:{role:i%2?'assistant':'user',content:[{type:'text',text:`mensagem ${i} de uma sessão grande para a queda no meio`}]}});
  const session=seedSession(runtime,many);
  seedCourse(runtime,'A');writeConfig(runtime,['A']);writeDeskJson(runtime,{session,courseId:'A'});
  const app=track(ctx,await launchDesk({runtime,env:huntEnv('kill-messages',{HUNT_PI_KILL_MESSAGES:'2'})}));
  const page=await app.firstWindow();const errs=watch(page);
  const waitError=async()=>{await page.waitForFunction(()=>{const t=document.querySelector('#toast');return !!t&&!t.hidden&&/encerrou|parou de responder|Pi/i.test(t.textContent);},undefined,{timeout:30000});};
  const waitQuiet=async()=>{await page.waitForFunction(()=>!document.querySelector('#toast .toast-item'),undefined,{timeout:12000});};
  await waitError();
  must('queda no meio do get_messages vira erro visível',true);
  must('send habilitado depois da queda',await page.locator('#send').isEnabled());
  must('abas reabilitadas depois da queda',await page.evaluate(()=>[...document.querySelectorAll('#course-tabs button')].every(b=>!b.disabled)));
  await waitQuiet();
  await page.locator('#prompt').fill('mensagem após a queda 1');
  await page.locator('#send').click();
  await page.waitForFunction(()=>{const t=document.querySelector('#toast');return !!t&&!t.hidden&&/encerrou|parou de responder|Pi/i.test(t.textContent);},undefined,{timeout:30000});
  must('segunda queda também destrava',await page.locator('#send').isEnabled());
  await waitQuiet();
  await page.locator('#prompt').fill('mensagem após a queda 2');
  await page.locator('#send').click();
  await page.waitForFunction(()=>[...document.querySelectorAll('#messages .message.assistant .body')].some(el=>el.textContent.includes('Eco de caça: mensagem após a queda 2')),undefined,{timeout:40000});
  await sendEnabled(page,{timeout:20000});
  const msgs=await page.locator('#messages .message').count();
  must('terceiro ciclo conecta e responde',true);
  probe('histórico grande renderizou',msgs>=400,`${msgs} mensagens no DOM`);
  must('sem pageerror',errs.pageerrors.length===0,errs.pageerrors.join(' | '));
  must('desk.json continua JSON válido',pdfText(runtime)!==null);
  probe('sem erro de console no renderer',errs.consoles.length===0,errs.consoles.join(' | ').slice(0,200));
 });
});

/* ====================================================================== */
/* 3. três quedas no prompt e reconexão; histórico não duplica */
await scenario('pi-reconnect-cycles',async()=>{
 await withArtifacts('hunt-reconnect',async ctx=>{
  const runtime=ctx.runtime=newRuntime('hunt-reconnect');
  seedCourse(runtime,'A');writeConfig(runtime,['A']);writeDeskJson(runtime,{courseId:'A'});
  const app=track(ctx,await launchDesk({runtime,env:huntEnv('kill-prompt',{HUNT_PI_KILL_PROMPTS:'3'})}));
  const page=await app.firstWindow();const errs=watch(page);
  await statusOnline(page);
  const sendAndWait=async(text,{queda=false}={})=>{
   await page.locator('#prompt').fill(text);
   await page.locator('#send').click();
   let appeared=true;
   try{await page.waitForFunction(t=>[...document.querySelectorAll('#messages .message.user')].some(el=>el.textContent.includes(t)),text,{timeout:15000});}
   catch{appeared=false;}
   if(!appeared){
    const state=await page.evaluate(()=>({prompt:document.querySelector('#prompt').value,toast:(document.querySelector('#toast').textContent||'').slice(0,240)}));
    probe(`clique em Enviar na janela de queda não perde o texto digitado`,state.prompt.trim()===text,JSON.stringify(state));
    if(state.toast.includes('Error invoking remote method'))probe('toast não mostra boilerplate do Electron',false,JSON.stringify(state.toast));
    // reenvia para o roteiro seguir
    await page.locator('#prompt').fill(text);
    await page.locator('#send').click();
    await page.waitForFunction(t=>[...document.querySelectorAll('#messages .message.user')].some(el=>el.textContent.includes(t)),text,{timeout:45000});
   }
   await page.waitForFunction(()=>!document.querySelector('#send').disabled,undefined,{timeout:45000});
   if(queda){
    /* `kill-prompt` mata o Pi de caça LOGO depois de aceitar: esperar a queda
       APARECER antes da mensagem seguinte. Sem isso, a próxima mensagem é
       escrita na janela em que o processo ainda responde mas já está condenado
       — o app entrega a mensagem a um Pi que morre em seguida e nenhuma resposta
       vem. Era daí que este cenário saía vermelho de vez em quando: o mesmo
       roteiro falha ~1 em 4 no HEAD limpo, sem nenhuma mudança do app (corrida
       do mock, não do produto). A reconexão em si continua sendo o que o ciclo
       prova: ela acontece no envio seguinte, que sobe um Pi novo. */
    await page.waitForFunction(()=>document.querySelector('#status-dot').className.includes('error'),undefined,{timeout:15000});
   }
   return appeared;
  };
  for(let i=1;i<=3;i++){
   await sendAndWait(`ciclo ${i}`,{queda:true});
   if(process.env.HUNT_DEBUG)console.log('    debug ciclo',i,await page.evaluate(()=>({prompt:document.querySelector('#prompt').value,toast:(document.querySelector('#toast').textContent||'').slice(0,240),users:document.querySelectorAll('#messages .message.user').length,dot:document.querySelector('#status-dot').getAttribute('class'),busy:document.querySelector('#send').disabled})));
   const users=await page.locator('#messages .message.user').allTextContents();
   must(`ciclo ${i}: um único balão de usuário por envio`,users.filter(t=>t.includes(`ciclo ${i}`)).length===1,JSON.stringify(users));
   must(`ciclo ${i}: send destravado`,await page.locator('#send').isEnabled());
  }
  await sendAndWait('final da caça');
  await page.waitForFunction(()=>[...document.querySelectorAll('#messages .message.assistant .body')].some(el=>el.textContent.includes('Eco de caça: final')),undefined,{timeout:45000});
  await sendEnabled(page,{timeout:20000});
  const users=await page.locator('#messages .message.user').allTextContents();
  const unique=new Set(users);
  must('histórico reconstruído sem duplicar usuário',unique.size===users.length,JSON.stringify(users));
  const fullToast=await page.locator('#toast').textContent();
  probe('toast de erro não vaza boilerplate do Electron',!/Error invoking remote method/.test(fullToast),fullToast.slice(0,240));
  must('sem pageerror',errs.pageerrors.length===0,errs.pageerrors.join(' | '));
  probe('sem erro de console no renderer',errs.consoles.length===0,errs.consoles.join(' | ').slice(0,200));
 });
});

/* ====================================================================== */
/* 4. trocar de matéria durante o stream (espera de 12s, cliques em fila, vazamento) */
await scenario('switch-vs-stream',async()=>{
 await withArtifacts('hunt-switch-stream',async ctx=>{
  const runtime=ctx.runtime=newRuntime('hunt-switch');
  seedCourse(runtime,'A');seedCourse(runtime,'B');
  const sessionA=seedSessionAs(runtime,'pi-1000000000001.jsonl',[{type:'message',message:{role:'user',content:[{type:'text',text:'SEGREDO-A'}]}}]);
  const sessionB=seedSessionAs(runtime,'pi-1000000000002.jsonl',[{type:'message',message:{role:'user',content:[{type:'text',text:'SEGREDO-B'}]}}]);
  writeDeskJson(runtime,{session:sessionA,courseId:'A',courseStates:{A:{session:sessionA},B:{session:sessionB}}});
  writeConfig(runtime,['A','B']);
  const app=track(ctx,await launchDesk({runtime,env:huntEnv('')}));
  const page=await app.firstWindow();const errs=watch(page);
  await statusOnline(page);
  await page.waitForFunction(()=>document.querySelector('#messages')?.textContent.includes('SEGREDO-A'),undefined,{timeout:20000});
  // (a) atalho ⌘2 com stream aberto: a aba está disabled para clique, mas o atalho
  //     não consulta o disabled; mede o tempo até o aviso.
  await page.locator('#prompt').fill('trave aqui');
  await page.locator('#send').click();
  await page.waitForFunction(()=>[...document.querySelectorAll('#messages .message.assistant .body')].some(el=>el.textContent.includes('Vou travar')),undefined,{timeout:15000});
  probe('aba fica disabled durante o stream (clique bloqueado)',await page.evaluate(()=>document.querySelector('#course-tabs button[data-id="B"]').disabled));
  const t0=Date.now();
  await page.keyboard.press('ControlOrMeta+2');
  let toastAt=0;
  try{
   await page.waitForFunction(()=>{const t=document.querySelector('#toast');return !!t&&!t.hidden&&/Pare a resposta/i.test(t.textContent);},undefined,{timeout:18000});
   toastAt=(Date.now()-t0)/1000;
  }catch{}
  probe('atalho de matéria durante o stream avisa o usuário na hora',toastAt>0&&toastAt<1.5,toastAt?`aviso após ${toastAt.toFixed(1)}s`:'nenhum aviso em 18s');
  must('aba ativa continua a A durante o stream',await page.evaluate(()=>document.querySelector('#course-tabs button.active')?.dataset.id==='A'));
  must('sem pageerror no stream',errs.pageerrors.length===0,errs.pageerrors.join(' | '));
  await page.keyboard.press('Escape');
  await sendEnabled(page,{timeout:20000});
  await page.waitForTimeout(2500);
  probe('troca bloqueada não é aplicada depois do abort',await page.evaluate(()=>document.querySelector('#course-tabs button.active')?.dataset.id==='A'));
  // (b) atalho durante o stream + abort em seguida: a troca recusada é descartada
  //     (a mesma política de (a): o aviso "Pare a resposta" não deixa a troca
  //     pendente para depois)
  await page.locator('#prompt').fill('trave de novo');
  await page.locator('#send').click();
  await page.waitForFunction(()=>[...document.querySelectorAll('#messages .message.assistant .body')].some(el=>el.textContent.includes('Vou travar')),undefined,{timeout:15000});
  await page.keyboard.press('ControlOrMeta+2');
  await page.waitForTimeout(800);
  await page.keyboard.press('Escape');
  await sendEnabled(page,{timeout:45000});
  await page.waitForTimeout(2500);
  const st=await page.evaluate(()=>{
   const active=document.querySelector('#course-tabs button.active')?.dataset.id||'';
   const text=document.querySelector('#messages').textContent;
   const panels=document.querySelectorAll('.pdf-panel').length;
   const busy=!!document.querySelector('#send').disabled;
   const sel=document.querySelector('#session-select')?.value||'';
   return {active,panels,busy,hasA:text.includes('SEGREDO-A'),hasB:text.includes('SEGREDO-B'),sel,title:document.title};
  });
  probe('atalho recusado durante o stream não troca de matéria depois do abort',st.active==='A',JSON.stringify(st));
  probe('conteúdo da conversa casa com a aba ativa',st.active==='A'?(st.hasA&&!st.hasB):(st.active==='B'?(st.hasB&&!st.hasA):false),JSON.stringify(st));
  must('exatamente 2 leitores depois da troca',st.panels===2,JSON.stringify(st));
  must('send destravado depois da troca',st.busy===false,JSON.stringify(st));
  // (c) dois atalhos em rajada durante o stream (B e volta para A), depois aborta
  await page.locator('#prompt').fill('trave pela terceira vez');
  await page.locator('#send').click();
  await page.waitForFunction(()=>[...document.querySelectorAll('#messages .message.assistant .body')].some(el=>el.textContent.includes('Vou travar')),undefined,{timeout:15000});
  await page.keyboard.press('ControlOrMeta+1');
  await page.waitForTimeout(300);
  await page.keyboard.press('ControlOrMeta+2');
  await page.waitForTimeout(900);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(9000);
  const st2=await page.evaluate(()=>{
   const active=document.querySelector('#course-tabs button.active')?.dataset.id||'';
   const text=document.querySelector('#messages').textContent;
   const panels=document.querySelectorAll('.pdf-panel').length;
   const busy=!!document.querySelector('#send').disabled;
   return {active,panels,busy,hasA:text.includes('SEGREDO-A'),hasB:text.includes('SEGREDO-B'),acts:document.querySelectorAll('#course-tabs button.active').length};
  });
  probe('fila de atalhos termina numa única aba ativa',['A','B'].includes(st2.active)&&st2.acts===1,JSON.stringify(st2));
  probe('conteúdo casa com a aba final',st2.active==='A'?(st2.hasA&&!st2.hasB):(st2.active==='B'?(st2.hasB&&!st2.hasA):false),JSON.stringify(st2));
  must('exatamente 2 leitores no fim da fila',st2.panels===2,JSON.stringify(st2));
  must('send destravado no fim da fila',st2.busy===false,JSON.stringify(st2));
  must('sem pageerror na fila de trocas',errs.pageerrors.length===0,errs.pageerrors.join(' | '));
  // (d) o mesmo atalho com o turno encerrado troca de verdade: a recusa de (a)/(b)
  //     não é pegajosa (a aba só está travada enquanto o Pi responde)
  await page.keyboard.press('ControlOrMeta+1');
  await page.waitForFunction(()=>document.querySelector('#course-tabs button.active')?.dataset.id==='A',undefined,{timeout:45000});
  await page.waitForFunction(()=>document.querySelector('#messages').textContent.includes('SEGREDO-A'),undefined,{timeout:45000});
  must('⌘1 com o turno encerrado volta para a matéria A',true);
  await page.keyboard.press('ControlOrMeta+2');
  await page.waitForFunction(()=>document.querySelector('#course-tabs button.active')?.dataset.id==='B',undefined,{timeout:45000});
  await page.waitForFunction(()=>document.querySelector('#messages').textContent.includes('SEGREDO-B'),undefined,{timeout:45000});
  must('⌘2 com o turno encerrado troca para a matéria B',true);
  must('sem pageerror na troca tardia',errs.pageerrors.length===0,errs.pageerrors.join(' | '));
  probe('sem erro de console no renderer',errs.consoles.length===0,errs.consoles.join(' | ').slice(0,200));
 });
});

/* ====================================================================== */
/* 5. Esc aborta o stream; parcial fica; próximo envio funciona */
await scenario('esc-abort',async()=>{
 await withArtifacts('hunt-esc-abort',async ctx=>{
  const runtime=ctx.runtime=newRuntime('hunt-abort');
  seedCourse(runtime,'A');writeConfig(runtime,['A']);writeDeskJson(runtime,{courseId:'A'});
  const app=track(ctx,await launchDesk({runtime,env:huntEnv('')}));
  const page=await app.firstWindow();const errs=watch(page);
  await statusOnline(page);
  await page.locator('#prompt').fill('trave no meio');
  await page.locator('#send').click();
  await page.waitForSelector('.message.assistant .body',{timeout:15000});
  await page.keyboard.press('Escape');
  const t0=Date.now();
  await sendEnabled(page,{timeout:15000});
  const ms=Date.now()-t0;
  must('Esc destrava o busy em menos de 15s',true);
  probe('destravamento rápido',ms<4000,`${ms}ms`);
  must('Parar volta a esconder',await page.locator('#stop').isHidden());
  const partial=await page.locator('#messages .message.assistant .body').first().textContent();
  probe('texto parcial do stream abortado permanece',/travar/i.test(partial),partial.slice(0,80));
  const toasts=await page.locator('#toast').textContent();
  probe('abort não gera toast de erro',!/encerrou|parou de responder/i.test(toasts),toasts);
  await page.locator('#prompt').fill('depois do abort');
  await page.locator('#send').click();
  await page.waitForFunction(()=>[...document.querySelectorAll('#messages .message.assistant .body')].some(el=>el.textContent.includes('Eco de caça: depois do abort')),undefined,{timeout:20000});
  await sendEnabled(page,{timeout:20000});
  must('conversa segue depois do abort',true);
  // Esc repetido em rajada: não pode ligar/desligar nada nem vazar toast
  for(let i=0;i<4;i++)await page.keyboard.press('Escape');
  await page.waitForTimeout(600);
  must('Esc em rajada não trava o app',await page.locator('#send').isEnabled());
  must('sem pageerror',errs.pageerrors.length===0,errs.pageerrors.join(' | '));
  probe('sem erro de console no renderer',errs.consoles.length===0,errs.consoles.join(' | ').slice(0,200));
 });
});

/* ====================================================================== */
/* 6. diálogos do Pi no meio do stream (+ fila de dois, cancelamento por Esc) */
await scenario('dialogs-stream',async()=>{
 await withArtifacts('hunt-dialogs',async ctx=>{
  const runtime=ctx.runtime=newRuntime('hunt-dialogs');
  seedCourse(runtime,'A');writeConfig(runtime,['A']);writeDeskJson(runtime,{courseId:'A'});
  const app=track(ctx,await launchDesk({runtime,env:huntEnv('dialog-prompt,two-dialogs-prompt')}));
  const page=await app.firstWindow();const errs=watch(page);
  await statusOnline(page);
  await page.locator('#prompt').fill('diálogo no meio');
  await page.locator('#send').click();
  await page.waitForSelector('#pi-dialog[open]',{timeout:15000});
  must('diálogo do Pi abre no meio do stream',true);
  must('leque mostra as opções do Pi',(await page.locator('#dialog-value option').allTextContents()).join(',')==='Alfa,Beta');
  const activeBefore=await page.evaluate(()=>document.querySelector('#course-tabs button.active')?.dataset.id);
  await page.keyboard.press('ControlOrMeta+1');
  await page.waitForTimeout(300);
  must('⌘1 com diálogo aberto não troca de matéria',await page.evaluate(()=>document.querySelector('#course-tabs button.active')?.dataset.id)===activeBefore);
  await page.keyboard.press('ControlOrMeta+\\');
  await page.waitForTimeout(200);
  must('⌘\\ com diálogo aberto não recolhe o chat',await page.evaluate(()=>!document.body.classList.contains('chat-collapsed')));
  await page.locator('#dialog-value').selectOption('Beta');
  await page.locator('#pi-dialog .primary').click();
  await page.waitForFunction(()=>[...document.querySelectorAll('#messages .message.assistant .body')].some(el=>el.textContent.includes('Resposta Beta')),undefined,{timeout:20000});
  await sendEnabled(page,{timeout:20000});
  must('resposta ao select retoma o stream',true);
  await page.locator('#prompt').fill('dois de uma vez');
  await page.locator('#send').click();
  await page.waitForSelector('#pi-dialog[open]',{timeout:15000});
  must('primeiro da fila aparece',(await page.locator('#dialog-title').textContent()).includes('Primeiro'));
  await page.keyboard.press('Escape');
  await page.waitForFunction(()=>{const d=document.querySelector('#pi-dialog');return d.open&&/Segundo/.test(document.querySelector('#dialog-title').textContent);},undefined,{timeout:10000});
  must('Esc cancela o primeiro e a fila mostra o segundo',true);
  await page.locator('#dialog-value').fill('texto da caça');
  await page.locator('#pi-dialog .primary').click();
  await page.waitForFunction(()=>[...document.querySelectorAll('#messages .message.assistant .body')].some(el=>el.textContent.includes('Fim dos diálogos')),undefined,{timeout:20000});
  await sendEnabled(page,{timeout:20000});
  must('fila de diálogos drena sem prender o busy',true);
  must('nenhum diálogo fica aberto',await page.evaluate(()=>!document.querySelector('#pi-dialog').open));
  must('sem pageerror',errs.pageerrors.length===0,errs.pageerrors.join(' | '));
  probe('sem erro de console no renderer',errs.consoles.length===0,errs.consoles.join(' | ').slice(0,200));
 });
});

/* ====================================================================== */
/* 7. corridas de UI: ⌘F durante render, colapsar durante busca, divisor no resize,
      menus/diálogos em rajada, toasts em tempestade */
await scenario('rapid-ui',async()=>{
 await withArtifacts('hunt-rapid-ui',async ctx=>{
  const runtime=ctx.runtime=newRuntime('hunt-rapid');
  const giant=multiPdf(Array.from({length:160},(_,i)=>[`página ${i+1} do PDF gigante da caça`,`linha de apoio ${i+1}`]));
  seedCourseWithFile(runtime,'A','gigante.pdf',giant);
  seedCourseWithFile(runtime,'A','apoio.pdf',multiPdf([['apoio página única com uma página']]));
  writeConfig(runtime,['A']);
  writeDeskJson(runtime,{courseId:'A',courseStates:{A:{pdfs:[]}}});
  const app=track(ctx,await launchDesk({runtime,env:huntEnv('')}));
  const page=await app.firstWindow();const errs=watch(page);
  await page.waitForSelector('.pdf-panel canvas',{timeout:40000});
  await page.waitForFunction(()=>[...document.querySelectorAll('.pdf-panel .pdf-document')].length===2,undefined,{timeout:40000});
  must('dois leitores montam o PDF gigante',true);
  const panels=await page.locator('.pdf-panel').count();
  must('exatamente 2 painéis',panels===2,`${panels}`);
  // ⌘F em rajada durante o render
  for(let i=0;i<8;i++)await page.keyboard.press('ControlOrMeta+f');
  const findOpen=await page.evaluate(()=>{const f=document.querySelector('.pdf-panel .pdf-find');return f&&!f.hidden&&document.activeElement===f.querySelector('input');});
  must('⌘F em rajada foca a busca uma vez',findOpen);
  await page.waitForFunction(()=>document.querySelector('.pdf-panel .textLayer span'),undefined,{timeout:60000});
  // painel 0 (apoio.pdf, 1 página): busca simples
  await page.locator('.pdf-panel .pdf-find input').first().fill('página');
  await page.locator('.pdf-panel .pdf-find button').first().click();
  await page.waitForSelector('.pdf-panel .pdf-hl',{timeout:60000});
  must('busca no painel 0 acha e destaca',true);
  const count0=await page.locator('.pdf-panel .find-count').first().textContent();
  probe('contador do painel 0 preenchido',/\d/.test(count0),count0);
  await page.keyboard.press('Escape');
  await page.waitForFunction(()=>document.querySelector('.pdf-panel .pdf-find').hidden,undefined,{timeout:5000});
  must('Esc limpa e fecha a busca',true);
  // painel 1 (gigante.pdf, 160 páginas): busca longa + colapso do painel 0 no meio
  const p1=page.locator('.pdf-panel').nth(1);
  await p1.locator('.find-toggle').click();
  await p1.locator('.pdf-find input').fill('página');
  await p1.locator('.pdf-find button').click();
  await page.locator('.pdf-panel').first().locator('.collapse').click();
  await page.waitForFunction(()=>document.querySelector('.pdf-panel').classList.contains('minimized'),undefined,{timeout:5000});
  await page.waitForSelector('.pdf-panel .pdf-hl',{timeout:90000});
  must('busca em 160 páginas acha e destaca (colapso no meio)',true);
  const count1=await p1.locator('.find-count').textContent();
  probe('contador da busca longa preenchido',/\d+/.test(count1),count1);
  await page.locator('.pdf-panel').first().locator('.collapse').click();
  await page.waitForFunction(()=>!document.querySelector('.pdf-panel').classList.contains('minimized'),undefined,{timeout:5000});
  await page.waitForSelector('.pdf-panel .pdf-hl',{timeout:20000});
  must('busca sobrevive ao colapsar/expandir',true);
  await page.keyboard.press('Escape');
  await page.waitForFunction(()=>document.querySelectorAll('.pdf-panel .pdf-find')[1].hidden,undefined,{timeout:5000});
  must('Esc limpa a busca do painel focado',true);
  // divisor durante resize da janela
  const before=await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--pdf-left'));
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1000,700));
  await page.waitForTimeout(400);
  const divider=await page.locator('.pdf-divider').boundingBox();
  await page.mouse.move(divider.x+divider.width/2,divider.y+divider.height/2);
  await page.mouse.down();
  await page.mouse.move(divider.x+200,divider.y+divider.height/2,{steps:6});
  await page.mouse.up();
  await page.waitForTimeout(500);
  const after=await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--pdf-left'));
  probe('divisor ainda responde durante o resize',after.trim()!==before.trim()&&after.trim()!=='',`${JSON.stringify(before)} -> ${JSON.stringify(after)}`);
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1200,800));
  await page.waitForTimeout(400);
  must('canvas continua vivo depois do resize',await page.locator('.pdf-panel canvas').count()>=2);
  // menus e diálogos em rajada
  for(let i=0;i<5;i++){
   await page.locator('#mesa-menu .nav-trigger').click();
   await page.mouse.click(6,400);
  }
  must('menus não ficam presos abertos',await page.evaluate(()=>!document.querySelector('#mesa-menu').classList.contains('open')&&document.querySelector('#mesa-menu .nav-trigger').getAttribute('aria-expanded')==='false'));
  for(let i=0;i<3;i++){
   await page.keyboard.press('ControlOrMeta+,');
   await page.waitForSelector('#settings-dialog[open]',{timeout:5000});
   await page.keyboard.press('Escape');
   await page.waitForFunction(()=>!document.querySelector('#settings-dialog').open,undefined,{timeout:5000});
  }
  must('Configurações abre/fecha em rajada',true);
  await page.keyboard.press('ControlOrMeta+/');
  await page.waitForSelector('#help-dialog[open]',{timeout:5000});
  await page.locator('#keys-customize').click();
  await page.waitForSelector('#keys-dialog[open]',{timeout:5000});
  await page.keyboard.press('Escape');
  await page.waitForFunction(()=>!document.querySelector('#keys-dialog').open,undefined,{timeout:5000});
  await page.keyboard.press('Escape');
  await page.waitForFunction(()=>!document.querySelector('#help-dialog').open,undefined,{timeout:5000});
  must('ajuda/atalhos fecham em cadeia',true);
  // toasts em tempestade
  await page.evaluate(()=>{document.querySelector('#expression').value='sqrt(';const b=document.querySelector('#calc-form button');for(let i=0;i<5;i++)b.click();});
  const storm=await page.locator('#toast .toast-item').count();
  probe('fila de toasts respeita o teto de 3',storm<=3,`${storm} itens`);
  await page.waitForFunction(()=>!document.querySelector('#toast .toast-item'),undefined,{timeout:12000});
  must('toasts somem sozinhos',true);
  must('uma única aba ativa no fim',await page.evaluate(()=>document.querySelectorAll('#course-tabs button.active').length===1));
  must('exatamente 2 painéis no fim',await page.locator('.pdf-panel').count()===2);
  must('sem pageerror',errs.pageerrors.length===0,errs.pageerrors.join(' | '));
  must('desk.json continua JSON válido',pdfText(runtime)!==null,stateJson(runtime).slice(0,120));
  probe('sem erro de console no renderer',errs.consoles.length===0,errs.consoles.join(' | ').slice(0,300));
  const problemas=runtimeProblems(runtime);
  probe('desk.log sem erros inesperados',problemas.length===0,problemas.map(e=>`${e.src}:${e.line}`).join(' | ').slice(0,300));
 });
});

/* ====================================================================== */
/* 8. dois launches no MESMO runtime: persistência de aba/tema/densidade/rascunho */
await scenario('persist-two-launches',async()=>{
 await withArtifacts('hunt-persist',async ctx=>{
  const runtime=ctx.runtime=newRuntime('hunt-persist');
  seedCourseWithFile(runtime,'A','Limites.pdf',multiPdf([['limites página um'],['limites página dois']]));
  seedCourse(runtime,'B');
  writeConfig(runtime,['A','B']);
  writeDeskJson(runtime,{courseId:'A'});
  const app1=track(ctx,await launchDesk({runtime,env:huntEnv('')}));
  const page1=await app1.firstWindow();
  const errs1=watch(page1);
  await statusOnline(page1);
  await page1.waitForSelector('.pdf-panel canvas',{timeout:30000});
  await page1.locator('#mesa-menu .nav-trigger').click();
  await page1.locator('#theme-cycle').click();
  await page1.locator('#theme-cycle').click();
  await page1.waitForTimeout(500);
  await page1.locator('#mesa-menu .nav-trigger').click();
  await page1.locator('#settings').click();
  await page1.waitForSelector('#settings-dialog[open]',{timeout:10000});
  await page1.locator('#density-mode').selectOption('compacta');
  await page1.locator('#settings-dialog button[value="cancel"]').last().click();
  await page1.waitForFunction(()=>!document.querySelector('#settings-dialog').open,undefined,{timeout:5000});
  await page1.locator('#course-tabs button[data-id="B"]').click();
  await page1.waitForFunction(()=>document.querySelector('#course-tabs button.active')?.dataset.id==='B',undefined,{timeout:20000});
  await page1.locator('#prompt').fill('rascunho persistente da caça');
  await page1.locator('#exercise-title').fill('Lista 9 · questão 3');
  await page1.waitForTimeout(900);
  await app1.close();
  ctx.app=null;
  const persisted=pdfText(runtime);
  must('desk.json gravado no fechamento',persisted!==null);
  must('tema escuro persistiu',persisted?.theme==='dark',JSON.stringify(persisted?.theme));
  must('matéria ativa persistiu',persisted?.courseId==='B',JSON.stringify(persisted?.courseId));
  must('rascunho persistiu',persisted?.draft==='rascunho persistente da caça',JSON.stringify(persisted?.draft));
  must('estudo (título) persistiu',persisted?.study?.title==='Lista 9 · questão 3',JSON.stringify(persisted?.study));
  // segundo launch no MESMO runtime
  const app2=track(ctx,await launchDesk({runtime,env:huntEnv('')}));
  const page2=await app2.firstWindow();const errs2=watch(page2);
  await page2.waitForSelector('.pdf-panel',{timeout:30000});
  const restored=await page2.evaluate(()=>({
   theme:document.documentElement.dataset.theme||'',
   dense:document.body.classList.contains('dense'),
   active:document.querySelector('#course-tabs button.active')?.dataset.id||'',
   draft:document.querySelector('#prompt').value,
   title:document.querySelector('#exercise-title').value,
   chat:getComputedStyle(document.documentElement).getPropertyValue('--chat').trim(),
   density:localStorage.getItem('mesa.density'),
   sessions:[...document.querySelectorAll('#session-select option')].map(o=>o.textContent),
  }));
  must('tema restaurado no segundo launch',restored.theme==='dark',JSON.stringify(restored));
  must('densidade restaurada no segundo launch',restored.dense&&restored.density==='compacta',JSON.stringify(restored));
  must('aba B ativa no segundo launch',restored.active==='B',JSON.stringify(restored));
  must('rascunho restaurado',restored.draft==='rascunho persistente da caça',JSON.stringify(restored.draft));
  must('título de estudo restaurado',restored.title==='Lista 9 · questão 3',JSON.stringify(restored.title));
  must('sem pageerror no 1º launch',errs1.pageerrors.length===0,errs1.pageerrors.join(' | '));
  must('sem pageerror no 2º launch',errs2.pageerrors.length===0,errs2.pageerrors.join(' | '));
  probe('sem erro de console',errs1.consoles.length+errs2.consoles.length===0,[...errs1.consoles,...errs2.consoles].join(' | ').slice(0,200));
 });
});

/* ====================================================================== */
/* 9. desk.json/config.json corrompidos (runtime temporário) */
const CORRUPT=[
 {name:'desk-truncado',desk:'{"courseId":"A","pdfs":[{"path":'},
 {name:'desk-pdfs-objeto',desk:'{"courseId":"A","pdfs":{"a":1}}'},
 {name:'desk-sessao-numero',desk:'{"courseId":"A","session":123}'},
 {name:'desk-coursestates-nulo',desk:'{"courseId":"A","courseStates":{"A":null}}'},
 {name:'desk-array',desk:'[]'},
 {name:'desk-bounds-lixo',desk:'{"courseId":"A","bounds":"x"}',config:true},
 {name:'config-truncado',desk:'{"courseId":"A"}',config:'{"vaultPath":'},
 {name:'config-courses-string',desk:'{"courseId":"A"}',config:'{"vaultPath":"__VAULT__","courses":"nope"}'},
];
for(const variant of CORRUPT){
 await scenario(`data-${variant.name}`,async()=>{
  await withArtifacts(`hunt-data-${variant.name}`,async ctx=>{
   const before=failures;
   const runtime=ctx.runtime=newRuntime('hunt-data-'+variant.name);
   seedCourse(runtime,'A');
   if(variant.config===undefined){
    writeConfig(runtime,['A']);
   }else if(variant.config===true){
    writeConfig(runtime,['A']);
   }else{
    fs.writeFileSync(path.join(runtime,'config.json'),variant.config.replace('__VAULT__',runtime.replace(/\\/g,'\\\\')));
   }
   fs.writeFileSync(path.join(runtime,'desk.json'),variant.desk);
   const env=huntEnv('');
   if(variant.name==='config-truncado')env.HOME=path.join(runtime,'casa-falsa');
   const app=track(ctx,await launchDesk({runtime,env}));
   const page=await app.firstWindow();const errs=watch(page);
   await page.waitForSelector('#prompt',{timeout:20000});
   await page.waitForTimeout(1800);
   const st=await page.evaluate(()=>({
    tabs:[...document.querySelectorAll('#course-tabs button')].map(b=>b.dataset.id),
    panels:document.querySelectorAll('.pdf-panel').length,
    settingsOpen:!!document.querySelector('#settings-dialog')?.open,
    configDialog:!!document.querySelector('#settings-dialog')?.open?document.querySelector('#settings-title')?.textContent:'',
    toast:(document.querySelector('#toast')?.textContent||'').slice(0,160),
    connected:!!document.querySelector('#status-dot')?.classList.contains('online'),
   }));
   // O contrato mínimo: prompt existe, o app não morre e a UI tem saída (aba ou config).
   must(`${variant.name}: renderer vivo`,await page.locator('#prompt').count()===1);
   must(`${variant.name}: sem pageerror`,errs.pageerrors.length===0,errs.pageerrors.join(' | '));
   const usable=st.tabs.length>0||st.settingsOpen;
   must(`${variant.name}: UI aproveitável (aba ou Configurações)`,usable,JSON.stringify(st));
   if(st.tabs.length>0)probe(`${variant.name}: leitores montados`,st.panels>0,JSON.stringify(st));
   if(!usable||st.panels===0){
    const dir=path.join(DESK,'tests','artifacts','hunt');
    fs.mkdirSync(dir,{recursive:true});
    await page.screenshot({path:path.join(dir,`${variant.name}.png`)}).catch(()=>{});
    console.log(`    evidência: tests/artifacts/hunt/${variant.name}.png · toast=${JSON.stringify(st.toast)}`);
   }
   if(failures>before){
    const dir=path.join(DESK,'tests','artifacts','hunt');
    fs.mkdirSync(dir,{recursive:true});
    fs.copyFileSync(path.join(runtime,'desk.json'),path.join(dir,`${variant.name}-desk.json`));
    throw Error(`${variant.name}: falha dura — runtime e desk.json preservados`);
   }
  });
 });
}

/* ====================================================================== */
/* 10. sessão enorme (histórico grande + mensagem gigante) */
await scenario('long-session',async()=>{
 await withArtifacts('hunt-long-session',async ctx=>{
  const runtime=ctx.runtime=newRuntime('hunt-long');
  const many=[];
  many.push({type:'message',message:{role:'user',content:[{type:'text',text:'início da sessão longa da caça'}]}});
  // volume grande, mas com quebras de linha a cada 80 chars (sem token gigante
  // sem espaço — esse caso patológico tem cenário próprio, long-token-hang)
  many.push({type:'message',message:{role:'assistant',content:[{type:'text',text:Array.from({length:2500},()=>'y'.repeat(80)).join('\n')+' fim do bloco gigante'}]}});
  for(let i=0;i<600;i++)many.push({type:'message',message:{role:i%2?'assistant':'user',content:[{type:'text',text:`mensagem ${i} da sessão longa — ${'palavra '.repeat(20)}`}]}});
  const session=seedSessionAs(runtime,'pi-1000000000010.jsonl',many);
  const older=seedSessionAs(runtime,'pi-1000000000011.jsonl',[{type:'message',message:{role:'user',content:[{type:'text',text:'sessão antiga curta da caça'}]}}]);
  seedCourse(runtime,'A');writeConfig(runtime,['A']);
  writeDeskJson(runtime,{session,courseId:'A',courseStates:{A:{session,sessions:[{path:session,started:1,preview:'longa'},{path:older,started:2,preview:'curta'}]}}});
  const app=track(ctx,await launchDesk({runtime,env:huntEnv('',{HUNT_PI_DELAY:'1'})}));
  const page=await app.firstWindow();const errs=watch(page);
  const t0=Date.now();
  await statusOnline(page,{timeout:60000});
  await page.waitForFunction(()=>document.querySelector('#messages .message'),undefined,{timeout:120000});
  const connectMs=Date.now()-t0;
  const st=await page.evaluate(()=>({
   msgs:document.querySelectorAll('#messages .message').length,
   nodes:document.querySelectorAll('#messages *').length,
   big:/fim do bloco gigante/.test(document.querySelector('#messages').textContent),
   meter:!document.querySelector('#ctx-meter').hidden,
   select:document.querySelector('#session-select').value,
   options:document.querySelectorAll('#session-select option').length,
  }));
  must('histórico enorme renderiza',st.msgs>400,JSON.stringify(st));
  must('mensagem gigante aparece',st.big,JSON.stringify({nodes:st.nodes}));
  must('medidor de contexto visível',st.meter,JSON.stringify(st));
  probe('conexão da sessão longa sem demora absurda',connectMs<60000,`${connectMs}ms`);
  console.log(`    DOM: ${st.nodes} nós em #messages · ${st.msgs} mensagens`);
  await page.locator('#prompt').fill('depois da longa');
  await page.locator('#send').click();
  await page.waitForFunction(()=>[...document.querySelectorAll('#messages .message.assistant .body')].some(el=>el.textContent.includes('Eco de caça: depois da longa')),undefined,{timeout:60000});
  await sendEnabled(page,{timeout:30000});
  must('conversa segue na sessão longa',true);
  // troca para a curta e volta
  const curta=await page.evaluate(()=>[...document.querySelectorAll('#session-select option')].map(o=>o.value).find(v=>v.includes('pi-')&&document.querySelector('#session-select').value!==v));
  if(curta){
   await page.locator('#session-select').selectOption(curta);
   await page.waitForTimeout(2500);
   const val=await page.locator('#session-select').inputValue();
   must('troca de sessão não prende o seletor',val===curta,`${val}`);
   must('seletor reabilitado',!(await page.locator('#session-select').isDisabled()));
   const live=await page.evaluate(()=>[...document.querySelectorAll('#session-select option')].map(o=>o.value).find(v=>v!==document.querySelector('#session-select').value));
   if(live){
    await page.locator('#session-select').selectOption(live);
    await page.waitForTimeout(2500);
    must('volta para a sessão longa',!(await page.locator('#session-select').isDisabled()));
   }
  }
  must('sem pageerror na sessão longa',errs.pageerrors.length===0,errs.pageerrors.join(' | '));
  probe('sem erro de console no renderer',errs.consoles.length===0,errs.consoles.join(' | ').slice(0,300));
 });
});

/* ====================================================================== */
/* 10b. token gigante sem espaço seguido de mensagens: o renderer trav */
await scenario('long-token-hang',async()=>{
 const runtime=newRuntime('hunt-token');
 const big='x'.repeat(20000)+' fim do bloco gigante';
 const records=[{type:'message',message:{role:'user',content:[{type:'text',text:'oi'}]}},{type:'message',message:{role:'assistant',content:[{type:'text',text:big}]}}];
 for(let i=0;i<100;i++)records.push({type:'message',message:{role:i%2?'assistant':'user',content:[{type:'text',text:`m ${i}`}]}});
 const sessionFile=seedSessionAs(runtime,'pi-1000000000099.jsonl',records);
 seedCourse(runtime,'A');writeConfig(runtime,['A']);
 writeDeskJson(runtime,{session:sessionFile,courseId:'A'});
 const app=await launchDesk({runtime,env:huntEnv('')});
 const page=await app.firstWindow();
 const t0=Date.now();let rendered=false;
 try{await page.waitForFunction(()=>document.querySelectorAll('#messages .message').length>=102,undefined,{timeout:30000});rendered=true;}catch{}
 const secs=((Date.now()-t0)/1000).toFixed(1);
 if(rendered){
  probe('token longo + mensagens seguintes renderiza',true);
 }else{
  let cpu='';
  try{
   const out=execFileSync('ps',['-eo','pcpu,command'],{encoding:'utf8'});
   cpu=out.split('\n').filter(line=>/Electron Helper \(Renderer\)/.test(line)).map(line=>parseFloat(line.trim())).sort((a,b)=>b-a)[0]||'';
  }catch{}
  must('histórico com token longo seguido de mensagens renderiza sem travar',false,`UI congelada: nenhuma mensagem em ${secs}s; renderer a ~${cpu}% de CPU`);
  const dir=path.join(DESK,'tests','artifacts','hunt');fs.mkdirSync(dir,{recursive:true});
  fs.copyFileSync(sessionFile,path.join(dir,'token-longo-sessao.jsonl'));
  console.log(`    evidência: tests/artifacts/hunt/token-longo-sessao.jsonl (102 mensagens, 1 token de 20 KB)`);
 }
 try{app.process().kill('SIGKILL');}catch{}
 try{await app.close();}catch{}
 try{fs.rmSync(runtime,{recursive:true,force:true});}catch{}
});

/* ====================================================================== */
/* 11. erros do IPC não deveriam vazar boilerplate do Electron no toast */
await scenario('error-toast-ipc',async()=>{
 await withArtifacts('hunt-error-toast',async ctx=>{
  const runtime=ctx.runtime=newRuntime('hunt-erro');
  seedCourse(runtime,'A');writeConfig(runtime,['A']);writeDeskJson(runtime,{courseId:'A'});
  const app=track(ctx,await launchDesk({runtime,env:{LEARNING_DESK_PI:'/usr/bin/false'}}));
  const page=await app.firstWindow();const errs=watch(page);
  await page.waitForFunction(()=>{const t=document.querySelector('#toast');return !!t&&t.textContent.trim().length>0;},undefined,{timeout:20000});
  const toast=await page.locator('#toast').textContent();
  probe('toast de falha de conexão não mostra "Error invoking remote method"',!/Error invoking remote method/.test(toast),JSON.stringify(toast.slice(0,200)));
  probe('toast de falha fala a língua do usuário',/Pi/i.test(toast),JSON.stringify(toast.slice(0,160)));
  must('send continua habilitado após a falha',await page.locator('#send').isEnabled());
  must('sem pageerror',errs.pageerrors.length===0,errs.pageerrors.join(' | '));
 });
});

/* ====================================================================== */
/* 12. teclado e a11y: foco preso em diálogo, Esc em tudo, aria coerente */
await scenario('keyboard-a11y',async()=>{
 await withArtifacts('hunt-keyboard',async ctx=>{
  const runtime=ctx.runtime=newRuntime('hunt-keyboard');
  seedCourseWithFile(runtime,'A','Limites.pdf',multiPdf([['limites página um'],['limites página dois']]));
  seedCourse(runtime,'B');
  writeConfig(runtime,['A','B']);writeDeskJson(runtime,{courseId:'A'});
  const app=track(ctx,await launchDesk({runtime,env:huntEnv('')}));
  const page=await app.firstWindow();const errs=watch(page);
  await statusOnline(page);
  await page.waitForSelector('.pdf-panel canvas',{timeout:30000});
  // tablist: roles e aria
  const tabs=await page.evaluate(()=>{
   const list=document.querySelector('#course-tabs');
   const buttons=[...list.querySelectorAll('button')];
   return {role:list.getAttribute('role'),label:list.getAttribute('aria-label'),buttons:buttons.map(b=>({role:b.getAttribute('role'),sel:b.getAttribute('aria-selected'),tabindex:b.getAttribute('tabindex')}))};
  });
  must('course-tabs é tablist com role=tab',tabs.role==='tablist'&&tabs.buttons.every(b=>b.role==='tab'),JSON.stringify(tabs));
  must('toda aba expõe aria-selected',tabs.buttons.every(b=>b.sel!==null));
  probe('tablist usa roving tabindex',tabs.buttons.some(b=>b.tabindex!==null),JSON.stringify(tabs.buttons));
  // setas: o contrato ARIA de tablist pede navegação por setas; o app tem ⌘Tab
  await page.locator('#course-tabs button').first().focus();
  const beforeArrow=await page.evaluate(()=>document.activeElement?.dataset?.id||'');
  await page.keyboard.press('ArrowRight');
  const afterArrow=await page.evaluate(()=>document.activeElement?.dataset?.id||'');
  probe('seta direita move o foco entre abas (padrão ARIA de tablist)',afterArrow!==beforeArrow,`foco: ${JSON.stringify(beforeArrow)} -> ${JSON.stringify(afterArrow)}`);
  // foco preso no diálogo: Configurações
  await page.keyboard.press('ControlOrMeta+,');
  await page.waitForSelector('#settings-dialog[open]',{timeout:8000});
  let inside=true,seq=[];
  for(let i=0;i<60;i++){
   await page.keyboard.press('Tab');
   const where=await page.evaluate(()=>{const a=document.activeElement;return {in:!!a?.closest?.('#settings-dialog'),tag:a?.tagName,id:a?.id||a?.className||''};});
   seq.push(where.id);
   if(!where.in)inside=false;
  }
  must('Tab não escapa do diálogo modal (60 toques)',inside,seq.slice(-6).join(','));
  await page.keyboard.press('Escape');
  await page.waitForFunction(()=>!document.querySelector('#settings-dialog').open,undefined,{timeout:5000});
  must('Esc fecha Configurações',true);
  // Esc fecha cada diálogo
  for(const [open,close,key] of [
   ['help-dialog','help-dialog','ControlOrMeta+/'],
   ['about-dialog','about-dialog',''],
   ['end-day-dialog','end-day-dialog',''],
  ]){
   if(open==='about-dialog'){await page.locator('#mesa-menu .nav-trigger').click();await page.locator('#about').click();}
   else if(open==='end-day-dialog'){await page.locator('#study-menu .nav-trigger').click();await page.locator('#end-day').click();}
   else{await page.keyboard.press(key);}
   await page.waitForSelector(`#${open}[open]`,{timeout:8000});
   await page.keyboard.press('Escape');
   await page.waitForFunction(sel=>{const d=document.querySelector(sel);return !d||!d.open;},`#${open}`,{timeout:5000}).catch(()=>{});
   must(`Esc fecha #${open}`,await page.evaluate(sel=>!document.querySelector(sel).open,`#${open}`));
  }
  // atalhos de diálogo com outro modal aberto não deveriam empilhar
  await page.keyboard.press('ControlOrMeta+/');
  await page.waitForSelector('#help-dialog[open]',{timeout:8000});
  await page.keyboard.press('ControlOrMeta+,');
  await page.waitForTimeout(400);
  probe('⌘, com a Ajuda aberta não empilha outro modal',await page.evaluate(()=>!document.querySelector('#settings-dialog').open));
  await page.keyboard.press('Escape');
  await page.waitForFunction(()=>!document.querySelector('#settings-dialog').open,undefined,{timeout:5000});
  await page.keyboard.press('Escape');
  await page.waitForFunction(()=>!document.querySelector('#help-dialog').open,undefined,{timeout:5000});
  // Enter no menu: abre/fecha com Enter e repõe aria-expanded
  await page.locator('#study-menu .nav-trigger').focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(()=>document.querySelector('#study-menu').classList.contains('open'),undefined,{timeout:5000});
  must('Enter abre o menu Estudar',await page.locator('#study-menu .nav-trigger').getAttribute('aria-expanded')==='true');
  await page.keyboard.press('Enter');
  await page.waitForFunction(()=>!document.querySelector('#study-menu').classList.contains('open'),undefined,{timeout:5000});
  must('Enter fecha o menu Estudar',await page.locator('#study-menu .nav-trigger').getAttribute('aria-expanded')==='false');
  await page.keyboard.press('Enter');
  await page.waitForFunction(()=>document.querySelector('#study-menu').classList.contains('open'),undefined,{timeout:5000});
  await page.keyboard.press('Escape');
  await page.waitForFunction(()=>!document.querySelector('#study-menu').classList.contains('open'),undefined,{timeout:5000});
  must('Esc fecha o menu aberto e tira o foco do gatilho',await page.evaluate(()=>!document.activeElement?.closest?.('#study-menu')));
  // aria dos controles vivos
  const aria=await page.evaluate(()=>({
   dot:{role:document.querySelector('#status-dot').getAttribute('role'),label:document.querySelector('#status-dot').getAttribute('aria-label')||document.querySelector('#status-dot').getAttribute('data-tip')||''},
   refs:document.querySelector('#include-refs').getAttribute('aria-pressed'),
   auto:document.querySelector('#auto-compact').getAttribute('aria-pressed'),
   calc:document.querySelector('#calc-toggle').getAttribute('aria-expanded'),
   find:document.querySelector('.pdf-panel .find-toggle').getAttribute('aria-pressed'),
   collapse:document.querySelector('.pdf-panel .collapse').getAttribute('aria-pressed'),
   invert:document.querySelector('.pdf-panel .invert').getAttribute('aria-pressed'),
   sessions:document.querySelector('#session-select').getAttribute('aria-label'),
   toastRole:document.querySelector('#toast').getAttribute('role'),
   activityRole:document.querySelector('#activity').getAttribute('role'),
  }));
  must('ponto de conexão tem role=img e rótulo',aria.dot.role==='img'&&aria.dot.label.length>0,JSON.stringify(aria.dot));
  must('botões de estado expõem aria-pressed',[aria.refs,aria.auto,aria.find,aria.collapse,aria.invert].every(v=>v!=='null'&&v!==null),JSON.stringify(aria));
  must('calculadora expõe aria-expanded',aria.calc==='true');
  must('seletor de conversa tem aria-label',aria.sessions==='Conversa');
  must('toast é role=status',aria.toastRole==='status');
  must('faixa de atividade é role=status',aria.activityRole==='status');
  // foco devolvido ao fechar o diálogo aberto pelo atalho
  await page.locator('#prompt').focus();
  await page.keyboard.press('ControlOrMeta+,');
  await page.waitForSelector('#settings-dialog[open]',{timeout:8000});
  await page.keyboard.press('Escape');
  await page.waitForFunction(()=>!document.querySelector('#settings-dialog').open,undefined,{timeout:5000});
  const back=await page.evaluate(()=>({id:document.activeElement?.id||'',tag:document.activeElement?.tagName||''}));
  probe('fechar o diálogo devolve o foco ao campo anterior',back.id==='prompt',JSON.stringify(back));
  must('sem pageerror',errs.pageerrors.length===0,errs.pageerrors.join(' | '));
  probe('sem erro de console no renderer',errs.consoles.length===0,errs.consoles.join(' | ').slice(0,200));
 });
});

/* ====================================================================== */
console.log(`\n===== resumo (${results.length} checagens, ${failures} falhas) =====`);
const achados=results.filter(r=>!r.ok);
for(const r of achados)console.log(`${r.hard?'✗':'[achado]'} ${r.name}${r.detail?` — ${r.detail}`:''}`);
if(failures)console.error(`CAÇA: ${failures} falha(s) de contrato.`);
else console.log('CAÇA: nenhuma falha dura de contrato.');
process.exitCode=failures?1:0;
