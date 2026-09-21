// npm run test:watchdog — valida o destravamento do watchdog com TIMING REAL.
// O watchdog (src/state.mjs) pinga a saúde a cada 15s. Enquanto o Pi reporta streaming, cada
// ping zera busyStall; depois que o stream cai, o primeiro ping com idade de busy > 60s marca
// busyStall=1 e destrava no 3º consecutivo (≈45s de pings, medido: unlock ~105s após o envio).
// Não há knob no renderer (área congelada), então o teste é opt-in e lento.
// Cenário: fake-pi em modo 'stall' responde o prompt e reporta streaming por 65s, depois
// fica mudo (nenhum agent_end) — exatamente o caso que o watchdog existe para cobrir.
import assert from 'node:assert/strict';
import {withArtifacts,newRuntime,seedCourse,writeDeskJson,writeConfigJson,launchDesk,toastWait,statusOnline,sendEnabled} from './helpers.mjs';

await withArtifacts('watchdog',async ctx=>{
 const runtime=ctx.runtime=newRuntime('watchdog');
 seedCourse(runtime,'Watch');
 writeDeskJson(runtime,{courseId:'Watch'});
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'Watch',name:'Matéria Watch',path:runtime+'/learning/Courses/Watch'}]});
 const app=ctx.app=await launchDesk({runtime,env:{FAKE_PI_CHAOS:'stall'}});
 const page=await app.firstWindow();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await statusOnline(page);
 await page.locator('#prompt').fill('responda e trave no meio');
 await page.locator('#send').click();
 await page.waitForFunction(()=>document.querySelector('#send').disabled,undefined,{timeout:20000});
 // ping de saúde em busy: enquanto o fake reporta streaming, cada ping zera busyStall e nada destrava
 await page.waitForTimeout(45000);
 assert.equal(await page.locator('#send').isEnabled(),false,'streaming ativo mantém a interface presa de propósito');
 // watchdog real: após o stream cair (65s), 3 pings consecutivos destravam; medido ~105s após o envio (poll até 150s)
 await sendEnabled(page,{timeout:150000});
 await toastWait(page,'destravada',{timeout:8000});
 assert.equal(await page.locator('#stop').isHidden(),true,'Parar volta a esconder com busy liberado');
 // a conversa segue funcionando depois do destravamento
 await page.locator('#prompt').fill('quiz de teste');
 await page.locator('#send').click();
 await page.waitForSelector('.message.quiz .quiz-option',{timeout:30000});
 await page.locator('.message.quiz .quiz-option').nth(1).click();
 await page.waitForFunction(()=>[...document.querySelectorAll('.quiz-verdict')].some(el=>el.textContent.includes('Correta')),undefined,{timeout:20000});
 await sendEnabled(page);
 await statusOnline(page,{timeout:15000});
 assert.deepEqual(errors,[]);
 console.log('WATCHDOG PASSED: busy preso destrava sozinho (~105s após o envio: 65s de stream ativo + 3 pings), toast avisa e a conversa segue.');
});
