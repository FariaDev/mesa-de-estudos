/* Idioma do tutor (#41): as três opções chegam ao Pi no prompt ENVIADO, sem
   inferência real. A escolha mora em `desk.json`; o main monta o prompt ao ligar
   o Pi e o Pi de teste (`fake-pi.mjs`, com `FAKE_PI_PROMPT_LOG`) grava o arquivo
   que recebeu em `--append-system-prompt`. A frase vem da base comum
   (`desk-prompts.cjs`), a mesma que o Claude usa (testado em
   `desk-prompts.test.mjs`). */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {launchDesk,newRuntime,seedCourse,writeConfigJson,writeDeskJson,statusOnline} from './helpers.mjs';
import {pollUntil} from './waits.mjs';

const {TUTOR_LANGUAGE_LINES}=createRequire(import.meta.url)('../src/agents/desk-prompts.cjs');
const OPTIONS=['follow','pt-BR','en'];

async function sentPrompt(tutorLanguage,desk={}){
 const runtime=newRuntime(`tutor-language-${tutorLanguage}`);
 const course=seedCourse(runtime,'A');
 writeConfigJson(runtime,{runtimePath:runtime,vaultPath:runtime,courses:[{id:'A',name:'Calculus',path:course}]});
 writeDeskJson(runtime,{tutorLanguage,...desk});
 const log=path.join(runtime,'prompt-recebido.md');
 const app=await launchDesk({runtime,env:{FAKE_PI_PROMPT_LOG:log}});
 try{
  const page=await app.firstWindow();
  await statusOnline(page);
  return await pollUntil(()=>fs.existsSync(log)?fs.readFileSync(log,'utf8'):'',text=>text.length>0,{what:'o prompt que o Pi recebeu'});
 }finally{await app.close();}
}

for(const option of OPTIONS){
 const prompt=await sentPrompt(option);
 assert.ok(!prompt.startsWith('ERRO'),`o Pi de teste leu o prompt: ${prompt.slice(0,120)}`);
 assert.ok(prompt.includes(TUTOR_LANGUAGE_LINES[option]),`tutor "${option}": o prompt enviado traz a frase "${TUTOR_LANGUAGE_LINES[option]}"`);
 for(const other of OPTIONS.filter(name=>name!==option)){
  assert.ok(!prompt.includes(TUTOR_LANGUAGE_LINES[other]),`tutor "${option}": o prompt enviado não traz a frase de "${other}"`);
 }
 console.log(`ok  tutor ${option}: ${TUTOR_LANGUAGE_LINES[option]}`);
}

/* O programa de escrita escolhido no Conferir entra na base; sem escolha, a frase é genérica. */
const generic=await sentPrompt('follow');
assert.match(generic,/resolve à mão no caderno digital, ao lado\./,'sem escolha: caderno digital');
assert.ok(!generic.includes('Xournal'),'sem escolha: nenhum programa fixo');
const chosen=await sentPrompt('follow',{conferirApp:{app:'GoodNotes',key:'goodnotes'}});
assert.match(chosen,/resolve à mão no GoodNotes, ao lado\./,'com escolha: o nome do programa');
console.log('programa de escrita: genérico sem escolha, nome com escolha');
console.log('idioma do tutor: três opções no prompt enviado');

/* Trocar o idioma do tutor religa o tutor para valer na hora (#41, fase 2). O Pi de
   teste regrava `FAKE_PI_PROMPT_LOG` a cada subida; apagar o arquivo antes da troca
   prova que o prompt novo veio de uma subida nova, não da primeira. */
const promptText=log=>fs.existsSync(log)?fs.readFileSync(log,'utf8'):'';
const chooseTutorLanguage=(page,value)=>page.evaluate(choice=>{
 const select=document.querySelector('#tutor-language');
 select.value=choice;select.dispatchEvent(new Event('change',{bubbles:true}));
},value);

async function relinkScenario(name,body){
 const runtime=newRuntime(name);
 const course=seedCourse(runtime,'A');
 writeConfigJson(runtime,{runtimePath:runtime,vaultPath:runtime,courses:[{id:'A',name:'Calculus',path:course}]});
 writeDeskJson(runtime,{tutorLanguage:'pt-BR'});
 const log=path.join(runtime,'prompt-recebido.md');
 const app=await launchDesk({runtime,env:{FAKE_PI_PROMPT_LOG:log,FAKE_PI_QUEUE_LOG:path.join(runtime,'fila.log'),FAKE_PI_QUEUE_HOLD_MS:'2500'}});
 try{
  const page=await app.firstWindow();
  await statusOnline(page);
  await pollUntil(()=>promptText(log),text=>text.includes(TUTOR_LANGUAGE_LINES['pt-BR']),{what:'o primeiro prompt, em português'});
  fs.rmSync(log);
  await body(page,log);
 }finally{await app.close();}
}

await relinkScenario('tutor-language-relink-idle',async(page,log)=>{
 await chooseTutorLanguage(page,'en');
 const prompt=await pollUntil(()=>promptText(log),text=>text.length>0,{what:'o prompt da subida nova'});
 assert.ok(prompt.includes(TUTOR_LANGUAGE_LINES.en),'tutor ocioso: o Pi religado recebeu a frase em inglês');
 await statusOnline(page);
 console.log('ok  tutor ocioso: religado na hora, prompt novo no Pi');
});

await relinkScenario('tutor-language-relink-busy',async(page,log)=>{
 await page.fill('#prompt','pergunta que segura o turno');
 await page.click('#send');
 await page.waitForFunction(()=>!document.querySelector('#stop').hidden,undefined,{timeout:15000});
 await chooseTutorLanguage(page,'en');
 await pollUntil(()=>page.locator('#tutor-language-note').getAttribute('data-i18n'),key=>key==='settings.tutorLanguage.note',{what:'a nota "vale na próxima vez" com o tutor ocupado'});
 assert.equal(promptText(log),'','tutor ocupado: o Pi não foi religado no meio da resposta');
 await page.waitForFunction(()=>document.querySelector('#stop').hidden,undefined,{timeout:30000});
 const prompt=await pollUntil(()=>promptText(log),text=>text.length>0,{what:'o prompt da subida depois da resposta'});
 assert.ok(prompt.includes(TUTOR_LANGUAGE_LINES.en),'tutor ocupado: religou ao ficar ocioso, com a frase em inglês');
 console.log('ok  tutor ocupado: nota mantida, religado ao ficar ocioso');
});
