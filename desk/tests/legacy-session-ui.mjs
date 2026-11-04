// node tests/legacy-session-ui.mjs — #release OpenCode: uma conversa de motor
// fora da vista abre em somente leitura, com o aviso e o caminho para a sessão
// nova; com um motor só, o "+" não abre menu. Capturas em /tmp/mesa-so-opencode.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {withArtifacts,newRuntime,seedCourse,writeConfigJson,writeDeskJson,launchDesk,freezeMotion,resizeWindow,setTheme,reviewShot,screenshotDirectory,currentSession,openSessionById} from './helpers.mjs';
import {nextFrames} from './waits.mjs';

const out=screenshotDirectory('legacy-session');

await withArtifacts('legacy-session',async ctx=>{
 const runtime=ctx.runtime=newRuntime('legacy');
 const course=seedCourse(runtime,'calc');
 const old=path.join(runtime,'pi-1700000000000.jsonl');
 fs.writeFileSync(old,[
  {type:'message',message:{role:'user',content:[{type:'text',text:'Como resolvo a lista?'}]}},
  {type:'message',message:{role:'assistant',content:[{type:'text',text:'Comece isolando o termo.'}]}}
 ].map(line=>JSON.stringify(line)).join('\n')+'\n');
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'calc',name:'Cálculo',path:course}]});
 writeDeskJson(runtime,{courseId:'calc',session:old,courseStates:{calc:{session:old,sessions:[{path:old,started:1700000000000,preview:'Como resolvo a lista?'}]}}});
 const app=ctx.app=await launchDesk({runtime,env:{LEARNING_DESK_VISIBLE_ENGINES:'opencode'}});
 const page=await app.firstWindow();
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await resizeWindow(app,page,1440,900);
 await freezeMotion(page);

 await openSessionById(page,old);
 await page.waitForFunction(()=>!document.querySelector('#legacy-session')?.hidden,undefined,{timeout:30000});
 assert.equal(await page.locator('#composer-box').isHidden(),true,'o composer sai da conversa antiga');
 assert.equal(await page.locator('#legacy-session p').textContent(),'Sessão antiga, só para leitura.');
 assert.equal(await page.locator('#legacy-new-session').textContent(),'Nova sessão');
 assert.match(await page.locator('#legacy-new-session').getAttribute('class')||'',/\bprimary\b/,'Nova sessão é a ação principal');
 assert.equal(await page.locator('#tutor-state').isHidden(),true,'o estado de tutor desligado não compete com o aviso');
 const footer=await page.evaluate(()=>{
  const text=document.querySelector('#legacy-session p').getBoundingClientRect();
  const button=document.querySelector('#legacy-new-session').getBoundingClientRect();
  const column=document.querySelector('#sidebar').getBoundingClientRect();
  return {sameRow:Math.abs((text.top+text.bottom)/2-(button.top+button.bottom)/2)<=1,inside:button.right<=column.right+0.5&&text.left>=column.left-0.5};
 });
 assert.equal(footer.sameRow,true,'frase e botão na mesma fileira');
 assert.equal(footer.inside,true,'o rodapé fica alinhado à coluna');
 assert.match(await page.locator('#messages').innerText(),/Comece isolando o termo/,'o histórico antigo continua legível');
 await page.screenshot({path:path.join('/tmp/mesa-so-opencode','legacy-session.png')});
 await reviewShot(page,out,'legacy-session.png');

 const before=await currentSession(page);
 await page.locator('#legacy-new-session').click();
 await page.waitForFunction(id=>document.querySelector('#session-title')?.dataset.session!==id,before,{timeout:30000});
 await page.waitForFunction(()=>document.querySelector('#legacy-session')?.hidden&&!document.querySelector('#composer-box')?.hidden,undefined,{timeout:30000});
 assert.match(await currentSession(page),/conversations\/opencode-[^/]+\.json$/,'a sessão nova é OpenCode');

 /* Um motor só: o "+" cria direto e não abre o menu de escolha. */
 const current=await currentSession(page);
 await page.locator('#new-session').click();
 await page.waitForFunction(id=>document.querySelector('#session-title')?.dataset.session!==id,current,{timeout:30000});
 assert.equal(await page.locator('#new-session-pop').isHidden(),true,'com um motor só, o "+" não abre menu');
 await nextFrames(page);
 await setTheme(page,'dark');
 await page.screenshot({path:path.join('/tmp/mesa-so-opencode','new-session-sem-menu-escuro.png')});
 await reviewShot(page,out,'new-session-sem-menu-escuro.png');
 assert.deepEqual(errors,[],`erros de página: ${JSON.stringify(errors)}`);
});
console.log('legacy-session-ui: ok');
