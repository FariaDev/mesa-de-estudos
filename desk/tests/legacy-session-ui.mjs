// node tests/legacy-session-ui.mjs — #release OpenCode: uma conversa de motor
// fora da vista abre em somente leitura, com o aviso e o caminho para a sessão
// nova; com um motor só, o "+" não abre menu. Capturas em /tmp/mesa-so-opencode.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import {withArtifacts,newRuntime,seedCourse,writeConfigJson,writeDeskJson,launchDesk,freezeMotion,resizeWindow,setTheme,reviewShot,screenshotDirectory,currentSession,openSessionById,openSessionLibrary,sessionIds} from './helpers.mjs';
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
 const oldBytes=fs.readFileSync(old,'utf8');
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'calc',name:'Cálculo',path:course}]});
 writeDeskJson(runtime,{courseId:'calc',session:old,courseStates:{calc:{session:old,sessions:[{path:old,started:1700000000000,preview:'Como resolvo a lista?'}]}}});
 const app=ctx.app=await launchDesk({runtime,pi:false,env:{LEARNING_DESK_VISIBLE_ENGINES:'opencode',LEARNING_DESK_OPENCODE:path.resolve(import.meta.dirname,'fake-opencode.mjs')}});
 const page=await app.firstWindow();
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await resizeWindow(app,page,1440,900);
 await freezeMotion(page);

 await openSessionById(page,old);
 await page.waitForFunction(()=>!document.querySelector('#legacy-session')?.hidden,undefined,{timeout:30000});
 assert.equal(await page.locator('#composer-box').isHidden(),true,'o composer sai da conversa antiga');
 assert.equal(await page.locator('#legacy-session p').textContent(),'Sessão antiga, só para leitura.');
 assert.equal(await page.locator('#legacy-new-session').textContent(),'Nova sessão');
  assert.equal(await page.locator('#legacy-continue').textContent(),'Continuar no OpenCode com o contexto');
  /* O botão "Continuar…" é escrito à mão: a troca de idioma o reaplica (#87). */
  await page.keyboard.press('ControlOrMeta+,');
  await page.waitForSelector('#settings-dialog[open]',{timeout:15000});
  await page.locator('#settings-tab-avisos').click();
  await page.selectOption('#ui-language','en');
  await page.waitForFunction(()=>document.documentElement.lang==='en',{timeout:10000});
  assert.equal(await page.locator('#legacy-continue').textContent(),'Continue in OpenCode with the context');
  await page.selectOption('#ui-language','pt-BR');
  await page.waitForFunction(()=>document.documentElement.lang==='pt-BR',{timeout:10000});
  assert.equal(await page.locator('#legacy-continue').textContent(),'Continuar no OpenCode com o contexto');
  await page.locator('#settings-dialog button[value="cancel"]').last().click();
  await page.waitForFunction(()=>!document.querySelector('#settings-dialog').open,undefined,{timeout:15000});
 assert.match(await page.locator('#legacy-continue').getAttribute('class')||'',/\bprimary\b/,'Continuar com o contexto é a ação principal');
 assert.match(await page.locator('#legacy-new-session').getAttribute('class')||'',/\bsecondary\b/,'Nova sessão vazia fica ao lado');
 assert.equal(await page.locator('#tutor-state').isHidden(),true,'o estado de tutor desligado não compete com o aviso');
 const footer=await page.evaluate(()=>{
  const text=document.querySelector('#legacy-session p').getBoundingClientRect();
  const actions=document.querySelector('#legacy-session .legacy-actions').getBoundingClientRect();
  const button=document.querySelector('#legacy-new-session').getBoundingClientRect();
  const column=document.querySelector('#sidebar').getBoundingClientRect();
  return {below:text.bottom<=actions.top+0.5,inside:button.right<=column.right+0.5&&text.left>=column.left-0.5&&actions.left>=column.left-0.5};
 });
 assert.equal(footer.below,true,'frase acima das ações');
 assert.equal(footer.inside,true,'o rodapé fica alinhado à coluna');
 assert.match(await page.locator('#messages').innerText(),/Comece isolando o termo/,'o histórico antigo continua legível');
 await page.screenshot({path:path.join('/tmp/mesa-so-opencode','legacy-session.png')});
 await reviewShot(page,out,'legacy-session.png');

 /* O lateral da conversa antiga não tem motor: mostra o histórico, sem caixa
    de envio e sem chat novo (2ª revisão do release). */
 await page.locator('#sidechat-toggle').click();
 await page.waitForSelector('#sidechat',{state:'visible',timeout:15000});
 assert.equal(await page.locator('#sidechat-composer').isHidden(),true,'o lateral da conversa antiga não escreve');
 assert.equal(await page.locator('#sidechat-new').isHidden(),true,'o lateral da conversa antiga não cria chat novo');
 await page.locator('#sidechat-toggle').click();
 await page.waitForSelector('#sidechat',{state:'hidden',timeout:15000});

 const before=await currentSession(page);
 await page.locator('#legacy-new-session').click();
 await page.waitForFunction(id=>document.querySelector('#session-title')?.dataset.session!==id,before,{timeout:30000});
 await page.waitForFunction(()=>document.querySelector('#legacy-session')?.hidden&&!document.querySelector('#composer-box')?.hidden,undefined,{timeout:30000});
 assert.match(await currentSession(page),/conversations\/opencode-[^/]+\.json$/,'a sessão nova é OpenCode');

 await page.locator('#sidechat-toggle').click();
 await page.waitForSelector('#sidechat',{state:'visible',timeout:15000});
 await page.waitForFunction(()=>!document.querySelector('#sidechat-composer').hidden&&!document.querySelector('#sidechat-new').hidden,undefined,{timeout:15000});
 await page.locator('#sidechat-toggle').click();
 await page.waitForSelector('#sidechat',{state:'hidden',timeout:15000});

 /* A biblioteca de conversas também passa pela mesma regra (3ª revisão): abrir
    a antiga esconde o composer e voltar para a atual devolve. */
 const openFromLibrary=async text=>{
  await openSessionLibrary(page);
  await page.waitForSelector('#chat-library-dialog[open]');
  await page.waitForSelector('.chat-library-row');
  const row=await page.evaluateHandle(wanted=>[...document.querySelectorAll('.chat-library-row')].find(item=>item.innerText.includes(wanted)&&!item.innerText.includes('Sessão atual')),text);
  await row.asElement().$('.chat-library-resume').then(button=>button.click());
  await page.waitForFunction(()=>!document.querySelector('#chat-library-dialog').open,undefined,{timeout:30000});
 };
 await openFromLibrary('Como resolvo a lista?');
 await page.waitForFunction(()=>!document.querySelector('#legacy-session')?.hidden,undefined,{timeout:30000});
 assert.equal(await page.locator('#composer-box').isHidden(),true,'antiga aberta pela biblioteca não escreve');
 await page.locator('#legacy-new-session').click();
 await page.waitForFunction(()=>document.querySelector('#legacy-session')?.hidden&&!document.querySelector('#composer-box')?.hidden,undefined,{timeout:30000});
 await openFromLibrary('Como resolvo a lista?');
 await page.waitForFunction(()=>!document.querySelector('#legacy-session')?.hidden,undefined,{timeout:30000});
 await openFromLibrary('OpenCode');
 await page.waitForFunction(()=>document.querySelector('#legacy-session')?.hidden&&!document.querySelector('#composer-box')?.hidden,undefined,{timeout:30000});

 /* Continuar no OpenCode leva o digest e deixa a conversa antiga na lista (#87). */
 await openFromLibrary('Como resolvo a lista?');
 await page.waitForFunction(()=>!document.querySelector('#legacy-session')?.hidden,undefined,{timeout:30000});
 const beforeContinue=await currentSession(page);
 await page.locator('#legacy-continue').click();
 await page.waitForFunction(id=>document.querySelector('#session-title')?.dataset.session!==id,beforeContinue,{timeout:30000});
 await page.waitForFunction(()=>document.querySelector('#legacy-session')?.hidden&&!document.querySelector('#composer-box')?.hidden,undefined,{timeout:30000});
 const continued=await currentSession(page);
 assert.match(continued,/conversations\/opencode-[^/]+\.json$/,'Continuar cria a sessão OpenCode');
 const require=createRequire(import.meta.url);
 const conversations=require('../src/agents/conversations.cjs');
 const continuedRecord=conversations.readClaudeConversation(continued,{runtime});
 assert.match(continuedRecord.importedTranscript,/aluno: Como resolvo a lista\?/);
 assert.match(continuedRecord.importedTranscript,/tutor: Comece isolando o termo\./);
 assert.deepEqual(continuedRecord.origin,{session:old,engine:'pi'});
 assert.equal(fs.readFileSync(old,'utf8'),oldBytes,'o JSONL antigo segue intocado');
 assert.ok((await sessionIds(page)).includes(old),'a conversa antiga continua na lista');

 /* Um motor só: o "+" cria direto e não abre o menu de escolha. */
 const current=await currentSession(page);
 await page.locator('#new-session').click({button:'right'});
 await nextFrames(page);
 assert.equal(await page.locator('#new-session-pop').isHidden(),true,'com um motor só, o clique direito não abre menu');
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
