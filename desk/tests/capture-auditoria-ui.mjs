// node tests/capture-auditoria-ui.mjs — AUDITORIA DE UI/UX, RODADA 2: telas da
// matéria em claro/escuro × 1440×900/900×650 (mínimo da Mesa) em
// /tmp/opencode/ui-auditoria/rodada-2/, sem material de curso; fora do
// `npm run ui`: bloco que falha registra e o resto segue. Os estados novos
// (link, provedores) ficam em `capture-auditoria-ui-estados.mjs`.
import fs from 'node:fs';
import path from 'node:path';
import {_electron as electron} from '@playwright/test';
import {DESK,deskEnv,withArtifacts,newRuntime,seedCourse,seedNativeSession,writeConfigJson,writeDeskJson,launchDesk,statusOnline,freezeMotion,resizeWindow,setTheme,openModelPop,openSessionList,openSessionById,openNewSessionMenu,openStudyContext,captureFixtureEnv,openMore,tinyPdf,FAKE_OPENCODE,syntheticFigurePng,showSidechat} from './helpers.mjs';
import {nextFrames,layoutStable} from './waits.mjs';
import {specFor} from './fixtures/activity-specs.mjs';
import {OUT,SIZES,THEMES,shots,courseWithPdf,bootCourse,send,readState,RICH} from './capture-auditoria-ui-kit.mjs';
const failures=[];
const errorTexts={};
/* Re-rodar só alguns blocos: AUDIT_ONLY=figura,stream,quiz (tags do block). */
const ONLY=new Set((process.env.AUDIT_ONLY||'').split(',').filter(Boolean));
const block=async(tag,run)=>{
  if(ONLY.size&&!ONLY.has(tag))return;
  try{await withArtifacts(tag,run);console.log('ok',tag);}
  catch(error){const line=String(error?.message||error).split('\n')[0];failures.push(`${tag}: ${line}`);console.log('FALHOU',tag,line);}
};

/* ---- A. primeira abertura: boas-vindas, passeio, nome, pasta, tutor (login) e pronto ---- */
await block('first-run',async ctx=>{
  const runtime=ctx.runtime=newRuntime('aud-first-run');
  const home=path.join(runtime,'home');
  fs.mkdirSync(home,{recursive:true});
  const entry=path.join(runtime,'entry.cjs');
  fs.writeFileSync(entry,`require('electron').app.setPath('userData',__dirname);require(${JSON.stringify(path.join(DESK,'main.cjs'))});`);
  fs.writeFileSync(path.join(runtime,'config.json'),JSON.stringify({runtimePath:runtime,courses:[]}));
  const env=deskEnv(runtime,{HOME:home,USERPROFILE:home});
  delete env.LEARNING_DESK_RUNTIME;
  const app=ctx.app=await electron.launch({args:[entry],cwd:DESK,env});
  const page=await app.firstWindow();
  await resizeWindow(app,page,1440,900);
  await freezeMotion(page);
  await page.waitForSelector('body[data-first-run="true"]',{timeout:30000});
  const walkTo=async step=>{for(let i=0;i<14;i++){if(await page.locator('#setup-card').getAttribute('data-step')===step)return;await page.locator('#setup-next').click();}throw new Error('sem passo '+step);};
  await shots(page,app,'first-run-boas-vindas');
  await page.locator('#setup-next').click();
  await page.waitForFunction(()=>document.querySelector('#setup-card')?.dataset.step==='tour');
  await shots(page,app,'first-run-passeio');
  await walkTo('name');
  await page.locator('#first-run-name').fill('Cálculo I');
  await shots(page,app,'first-run-nome');
  await walkTo('folder');
  const pdfs=path.join(runtime,'pdfs','Calculo');
  fs.mkdirSync(pdfs,{recursive:true});
  fs.writeFileSync(path.join(pdfs,'Limites.pdf'),tinyPdf('Limites',2));
  await app.evaluate(({dialog},folder)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[folder]});},pdfs);
  await page.locator('#first-run-pick').click();
  await page.waitForFunction(()=>!document.querySelector('#setup-next').disabled,undefined,{timeout:15000});
  await shots(page,app,'first-run-pasta');
  await page.locator('#setup-next').click();
  await page.waitForSelector('#setup-pi[data-pi="found"]',{timeout:30000});
  await shots(page,app,'first-run-tutor-login');
  await page.locator('#setup-tutor-actions #connect').click();
  await page.waitForFunction(()=>document.querySelector('#setup-next').textContent.trim()==='Continuar',undefined,{timeout:60000});
  await shots(page,app,'first-run-tutor-ligado');
  await page.locator('#setup-next').click();
  await page.waitForFunction(()=>document.querySelector('#setup-card')?.dataset.step==='ready');
  await shots(page,app,'first-run-pronto');
});

/* ---- B. biblioteca: abas, lista de sessões e biblioteca ---- */
await block('biblioteca',async ctx=>{
  const runtime=ctx.runtime=newRuntime('aud-biblio');
  const calc=seedCourse(runtime,'calc');
  const fis=seedCourse(runtime,'fis');
  fs.writeFileSync(path.join(calc,'Limites.pdf'),tinyPdf('Limites'));
  writeConfigJson(runtime,{runtimePath:runtime,vaultPath:runtime,courses:[{id:'calc',name:'Cálculo I',path:calc},{id:'fis',name:'Física',path:fis}]});
  const current=seedNativeSession(runtime,[{role:'user',content:[{type:'text',text:'oi'}]}],{courseId:'calc',preview:'oi'});
  const older=seedNativeSession(runtime,[{role:'user',content:[{type:'text',text:'antiga'}]}],{courseId:'calc',started:Date.now()-3600000,preview:'antiga'});
  writeDeskJson(runtime,{courseId:'calc',session:current,courseStates:{calc:{session:current,sessions:[{path:current,started:Date.now(),preview:'oi'},{path:older,started:Date.now()-3600000,preview:'antiga'}],pdfs:[],study:{title:'',xopp:''}}}});
  const app=ctx.app=await launchDesk({runtime});
  const page=await app.firstWindow();
  await resizeWindow(app,page,1440,900);
  await statusOnline(page);
  await freezeMotion(page);
  await shots(page,app,'biblioteca-materias');
  await openSessionList(page);
  await shots(page,app,'biblioteca-sessoes');
  await page.locator('#conv-library').click();
  await page.waitForSelector('#chat-library-dialog[open]');
  await shots(page,app,'biblioteca-todas');
  await page.keyboard.press('Escape');
  await openNewSessionMenu(page);
  await shots(page,app,'sessao-nova-menu');
});

/* ---- C. leitor de PDF com a barra, menu Mais opções e tutor vazio (sem mensagens) ---- */
await block('leitor',async ctx=>{
  const {page,app}=await bootCourse(ctx,'aud-leitor');
  await shots(page,app,'leitor-barra');
  const panel=page.locator('.pdf-panel').first();
  await openMore(panel);
  await shots(page,app,'leitor-mais-opcoes');
  await page.keyboard.press('Escape');
  await shots(page,app,'tutor-vazio');
});

/* ---- E. tutor conversando: Markdown, fórmula, código, tabela ---- */
await block('tutor-conversa',async ctx=>{
  const runtime=ctx.runtime=newRuntime('aud-conversa');
  const {course,pdf}=courseWithPdf(runtime);
  writeConfigJson(runtime,{runtimePath:runtime,vaultPath:runtime,courses:[{id:'calc',name:'Cálculo I',path:course}]});
  const session=seedNativeSession(runtime,[{role:'user',content:[{type:'text',text:'Como resolvo a lista 3, questão 2?'}]},{role:'assistant',content:[{type:'text',text:RICH}]}],{courseId:'calc'});
  writeDeskJson(runtime,{courseId:'calc',session,courseStates:{calc:{session,pdfs:[{path:pdf,page:1}],study:{title:'',xopp:''}}}});
  const app=ctx.app=await launchDesk({runtime});
  const page=await app.firstWindow();
  await resizeWindow(app,page,1440,900);
  await statusOnline(page);
  await freezeMotion(page);
  await page.waitForSelector('.message.assistant',{timeout:30000});
  await shots(page,app,'tutor-conversa');
});

/* ---- F. figura do tutor (resposta com imagem) ---- */
await block('figura',async ctx=>{
  /* D10: PNG sintético visível (640×360, gerado no teste), sem material real. */
  const {page}=await bootCourse(ctx,'aud-figura',{env:{FAKE_OPENCODE_LONG_IMAGE:`data:image/png;base64,${syntheticFigurePng()}`}});
  await send(page,'resposta longa com a figura da apostila');// gatilho /resposta longa/i do fake: texto + imagem
  await page.waitForSelector('#messages img',{timeout:60000});
  await layoutStable(page,'#messages').catch(()=>{});
  const app=ctx.app;
  await shots(page,app,'tutor-figura');
});

/* ---- G. quiz ---- */
await block('quiz',async ctx=>{
  const {page,app}=await bootCourse(ctx,'aud-quiz',{env:{FAKE_OPENCODE_MCP_CALL:JSON.stringify({name:'quiz',input:{question:'Quanto é 2+2?',options:[{label:'3'},{label:'4'}],correctAnswer:'4'}})}});
  await send(page,'me faz um quiz');
  await page.waitForSelector('.message.quiz .quiz-option',{timeout:60000});
  await page.locator('.message.quiz .quiz-option').filter({hasText:'4'}).click();
  await shots(page,app,'tutor-quiz');
});

/* ---- G2. diário de trabalho: turno com pensamento+ferramenta rende article.work.
   Em bloco próprio: com `FAKE_OPENCODE_MCP_CALL` ligado, o fake responde todo
   turno com o cartão e o worklog nunca chega. ---- */
await block('worklog',async ctx=>{
  const {page,app}=await bootCourse(ctx,'aud-worklog');
  await send(page,'pensar profundo sobre limites');// gatilho do worklogTurn do fake
  await page.waitForSelector('article.work',{timeout:60000});
  const workHead=page.locator('article.work .work-mark, article.work header').first();
  await workHead.scrollIntoViewIfNeeded().catch(()=>{});
  await workHead.click({timeout:10000}).catch(()=>{});
  await nextFrames(page);
  await shots(page,app,'worklog-aberto');
});

/* ---- H. perguntar (cartão de pergunta do tutor) ---- */
await block('perguntar',async ctx=>{
  const {page,app}=await bootCourse(ctx,'aud-perguntar',{env:{FAKE_OPENCODE_MCP_CALL:JSON.stringify({name:'perguntar',input:{questions:[{question:'Onde você travou?',options:[{label:'Na fatoração'},{label:'Na substituição'}],multiSelect:false}]}})}});
  await send(page,'me pergunta onde travei');
  await page.waitForFunction(()=>document.querySelectorAll('#messages .message').length>1,undefined,{timeout:60000});
  const found=await page.evaluate(()=>({quiz:document.querySelectorAll('.message.quiz,.quiz-card,.ask-card,.message.ask').length,ask:document.querySelectorAll('[data-card]').length}));
  if(!found.quiz&&!found.ask)failures.push('perguntar: nenhum cartão .quiz/.ask renderizou (ver tutor-perguntar-*)');
  await shots(page,app,'tutor-perguntar');
});

/* ---- I. atividade interativa ---- */
await block('atividade',async ctx=>{
  const {page,app}=await bootCourse(ctx,'aud-atividade',{env:{FAKE_OPENCODE_MCP_CALL:JSON.stringify({name:'criar_atividade',id:'aud-1',input:specFor('movimento')})}});
  await send(page,'Crie uma atividade de movimento.');
  await page.locator('.activity-slot[data-activity-call="aud-1"] .activity-card[data-state="ready"]').waitFor({timeout:60000});
  await page.locator('.activity-slot[data-activity-call="aud-1"] .activity-card').scrollIntoViewIfNeeded();
  await layoutStable(page,'.activity-card').catch(()=>{});
  await shots(page,app,'tutor-atividade');
});

/* ---- J. tutor em stream (resposta longa chegando) ---- */
await block('stream',async ctx=>{
  const {page,app}=await bootCourse(ctx,'aud-stream',{env:{FAKE_OPENCODE_STREAM:'long',FAKE_OPENCODE_STREAM_DELTAS:'2000',FAKE_OPENCODE_STREAM_DELTA_MS:'50'}});
  await send(page,'stream longo sobre limites');// gatilho /stream longo/i do fake
  await page.waitForFunction(()=>!document.querySelector('#stop')?.hidden,undefined,{timeout:30000});
  await page.waitForFunction(()=>(document.querySelector('.message.assistant .body')?.textContent||'').length>200,undefined,{timeout:30000});
  const streamShot=async(base)=>{
    await page.mouse.move(1,1);
    await page.evaluate(()=>{for(const tip of document.querySelectorAll('.tip'))tip.hidden=true;});
    await page.screenshot({path:path.join(OUT,base)});
  };
  await streamShot('tutor-stream-light-1440x900.png');
  await setTheme(page,'dark');
  await nextFrames(page);
  await streamShot('tutor-stream-dark-1440x900.png');
  await setTheme(page,'light');
  await resizeWindow(app,page,900,650);
  await streamShot('tutor-stream-light-900x650.png');
  await setTheme(page,'dark');
  await nextFrames(page);
  await streamShot('tutor-stream-dark-900x650.png');
  await setTheme(page,'light');
  await page.locator('#stop').click({timeout:60000});
  await page.waitForFunction(()=>document.querySelector('#stop')?.hidden!==false,undefined,{timeout:60000});
});

/* ---- K. composer com anexo do Conferir e menu ⋯ → Contexto ---- */
await block('composer',async ctx=>{
  const runtime=ctx.runtime=newRuntime('aud-composer');
  const {pdf}=courseWithPdf(runtime);
  writeDeskJson(runtime,{courseId:'calc',courseStates:{calc:{pdfs:[{path:pdf,page:1}],study:{title:'',xopp:''}}}});
  const app=ctx.app=await launchDesk({runtime,env:{...captureFixtureEnv(runtime)}});
  const page=await app.firstWindow();
  await resizeWindow(app,page,1440,900);
  await statusOnline(page);
  await freezeMotion(page);
  await page.waitForSelector('.pdf-panel canvas',{timeout:30000});
  await page.locator('#attach').click();
  await page.locator('#check').click();
  await page.waitForSelector('#attachments .attachment',{timeout:15000});
  await shots(page,app,'composer-anexo');
  await openStudyContext(page);
  await page.locator('#exercise-title').fill('Lista 2 · 7b');
  await shots(page,app,'composer-contexto');
});

/* ---- L. seletor de modelo ---- */
await block('modelo',async ctx=>{
  const {page,app}=await bootCourse(ctx,'aud-modelo',{env:{FAKE_OPENCODE_MANY_MODELS:'1',FAKE_OPENCODE_SECOND_MODEL:'1'}});
  await openModelPop(page);
  await page.locator('#model-list .model-row:not([aria-selected="true"])').first().hover();
  await nextFrames(page);
  await shots(page,app,'seletor-modelo');
});

/* ---- M. chat lateral e Formulário ---- */
await block('sidechat',async ctx=>{
  const runtime=ctx.runtime=newRuntime('aud-side');
  const course=seedCourse(runtime,'calc');
  fs.writeFileSync(path.join(course,'Limites.pdf'),tinyPdf('Limites',2));
  fs.writeFileSync(path.join(course,'Formulario.pdf'),tinyPdf('Formulas',2));
  writeConfigJson(runtime,{runtimePath:runtime,vaultPath:runtime,courses:[{id:'calc',name:'Cálculo I',path:course}]});  const pdfA=path.join(course,'Limites.pdf');
  writeDeskJson(runtime,{courseId:'calc',courseStates:{calc:{pdfs:[{path:pdfA,page:1}],study:{title:'',xopp:''}}}});
  const app=ctx.app=await launchDesk({runtime});
  const page=await app.firstWindow();
  await resizeWindow(app,page,1440,900);
  await statusOnline(page);
  await freezeMotion(page);
  await showSidechat(page);
  await page.locator('#sidechat-prompt').fill('dúvida rápida do formulário');
  await shots(page,app,'chat-lateral');
});

/* ---- N. sessão legada só leitura (o menu de sessão nova está no bloco B) ---- */
await block('legada',async ctx=>{
  const runtime=ctx.runtime=newRuntime('aud-legada');
  courseWithPdf(runtime);
  const old=path.join(runtime,'pi-1700000000000.jsonl');
  fs.writeFileSync(old,[{type:'message',message:{role:'user',content:[{type:'text',text:'Como resolvo a lista?'}]}},{type:'message',message:{role:'assistant',content:[{type:'text',text:'Comece isolando o termo.'}]}}].map(line=>JSON.stringify(line)).join('\n')+'\n');
  writeDeskJson(runtime,{courseId:'calc',session:old,courseStates:{calc:{session:old,sessions:[{path:old,started:1700000000000,preview:'Como resolvo a lista?'}]}}});
  const app=ctx.app=await launchDesk({runtime,env:{LEARNING_DESK_VISIBLE_ENGINES:'opencode'}});
  const page=await app.firstWindow();
  await resizeWindow(app,page,1440,900);
  await freezeMotion(page);
  await openSessionById(page,old);
  await page.waitForFunction(()=>!document.querySelector('#legacy-session')?.hidden,undefined,{timeout:30000});
  await shots(page,app,'sessao-legada');
});

/* ---- P. GeoGebra e calculadora ---- */
await block('ggb-calc',async ctx=>{
  const {page,app}=await bootCourse(ctx,'aud-ggb');
  await page.locator('#course-tabs [data-id="geogebra"]').click();
  await page.waitForFunction(()=>document.querySelector('#course-tabs [data-id="geogebra"]')?.classList.contains('active'),undefined,{timeout:15000});
  await page.waitForTimeout(8000);// espera fixa: o applet do GeoGebra baixa da CDN na primeira abertura
  await shots(page,app,'geogebra');
  /* D11: a view nativa não sai no screenshot do Playwright; tenta o
     capturePage do host (`ggb-shot`, o mesmo do botão Conferir), no último
     tamanho que `shots` deixou (900x650). Se o applet
     não estiver pronto, fica registrado em vez da imagem. */
  try{
   const shot=await page.evaluate(()=>window.desk.ggbShot());
   fs.writeFileSync(path.join(OUT,'geogebra-host-900x650.png'),Buffer.from(String(shot.dataUrl).split(',')[1],'base64'));
  }catch(error){
   fs.writeFileSync(path.join(OUT,'geogebra-host-ERRO.txt'),`capturePage do host indisponível nesta rodada: ${String(error?.message||error)}\n`);
  }
  /* `shots` termina em 900×650, onde `tabs-compact` esconde a aba calc: volta
     a 1440 antes de clicar (o mesmo tamanho do resto do bloco). */
  await resizeWindow(app,page,1440,900);
  await page.locator('#course-tabs [data-id="calc"]').click();
  await page.locator('#calc-toggle').click();
  await page.waitForFunction(()=>document.querySelector('#calc-toggle')?.getAttribute('aria-expanded')==='true',undefined,{timeout:10000});
  await page.locator('#expression').fill('sin(pi/2)');
  await page.locator('#expression').press('Enter');
  await page.waitForFunction(()=>document.querySelector('#result')?.textContent.trim()!=='',undefined,{timeout:10000});
  await shots(page,app,'calculadora');
});

/* ---- Q. Conferir (anexo, toast e linha ao tutor) ---- */
await block('conferir',async ctx=>{
  const runtime=ctx.runtime=newRuntime('aud-conferir');
  const {pdf}=courseWithPdf(runtime);
  writeDeskJson(runtime,{courseId:'calc',courseStates:{calc:{pdfs:[{path:pdf,page:1}],study:{title:'',xopp:''}}}});
  const app=ctx.app=await launchDesk({runtime,env:{...captureFixtureEnv(runtime)}});
  const page=await app.firstWindow();
  await resizeWindow(app,page,1440,900);
  await statusOnline(page);
  await freezeMotion(page);
  await page.locator('#attach').click();
  await page.locator('#check').click();
  await page.waitForSelector('#attachments .attachment',{timeout:15000});
  await send(page,'confere meu desenvolvimento');
  await page.waitForFunction(()=>document.querySelectorAll('#messages .message').length>0,undefined,{timeout:60000});
  await shots(page,app,'conferir');
});

/* ---- R. Ajustes (5 seções) e Sobre ---- */
await block('ajustes-sobre',async ctx=>{
  const {page,app}=await bootCourse(ctx,'aud-ajustes');
  await page.keyboard.press('ControlOrMeta+,');
  await page.waitForSelector('#settings-dialog[open]');
  for(const sec of ['materias','leitores','mesa','avisos','pastas']){
    await page.locator('#settings-tab-'+sec).click();
    await nextFrames(page);
    await page.mouse.move(1,1);
    for(const [width,height] of SIZES){
      await resizeWindow(app,page,width,height);
      for(const theme of THEMES){
        await setTheme(page,theme);
        await nextFrames(page);
        await page.mouse.move(1,1);
        const saved=await page.evaluate(()=>{
          const inputs=[...document.querySelectorAll('#settings-form input')].filter(i=>i.value.includes('/'));
          const keep=inputs.map(i=>i.value);
          inputs.forEach(i=>{i.value='…/'+i.value.split('/').filter(Boolean).pop();});
          return keep;
        }).catch(()=>[]);
        await page.screenshot({path:path.join(OUT,`ajustes-${sec}-${theme}-${width}x${height}.png`)});
        await page.evaluate(keep=>{
          [...document.querySelectorAll('#settings-form input')].filter(i=>i.value.startsWith('…/')).forEach((i,k)=>{if(keep[k]!==undefined)i.value=keep[k];});
        },saved).catch(()=>{});
      }
    }
    await setTheme(page,'light');
  }
  await resizeWindow(app,page,1440,900);
  await page.keyboard.press('Escape');
  await page.waitForFunction(()=>!document.querySelector('#settings-dialog').open);
  await page.locator('#settings-menu .nav-trigger').click();
  await page.locator('#settings-menu #about').click();
  await page.waitForSelector('#about-dialog[open]');
  await shots(page,app,'sobre');
});

/* ---- S. notas da versão ---- */
await block('novidades',async ctx=>{
  const runtime=ctx.runtime=newRuntime('aud-news');
  courseWithPdf(runtime);
  writeDeskJson(runtime,{courseId:'calc',releaseNotesSeen:'1.0.2'});
  const app=ctx.app=await launchDesk({runtime,env:{LEARNING_DESK_RELEASE_VERSION:'1.1.0'}});
  const page=await app.firstWindow();
  await resizeWindow(app,page,1440,900);
  await freezeMotion(page);
  await page.waitForSelector('#release-notes-dialog[open]',{timeout:30000});
  await shots(page,app,'sobre-novidades');
});

/* ---- T. revisão, estatísticas, notas, busca, backup e compartilhar ---- */
await block('estudo-dialogos',async ctx=>{
  const {page,app}=await bootCourse(ctx,'aud-estudo');
  await page.locator('#review-tab').click();
  await page.waitForSelector('#references.review',{timeout:15000});
  await shots(page,app,'revisao');
  /* `shots` termina em 900×650, onde `tabs-compact` esconde a aba calc. */
  await resizeWindow(app,page,1440,900);
  await page.locator('#course-tabs [data-id="calc"]').click();
  const studyItem=async(id,wait)=>{
    await page.locator('#study-menu .nav-trigger').click();
    await page.locator(`#study-menu ${id}`).click();
    await page.waitForSelector(wait,{timeout:15000});
    await shots(page,app,id.replace(/^#|study-|-open$/g,'').replace(/-/g,'_'));
    await page.keyboard.press('Escape');
  };
  await studyItem('#study-stats-open','#study-stats-dialog[open]');
  await studyItem('#study-backup-open','#mesa-backup-panel[open]');
  await page.locator('#study-menu .nav-trigger').click();
  await page.locator('#study-menu #study-share-open').click();
  await page.waitForTimeout(1200);// espera fixa: o destino do compartilhar abre sem seletor estável
  await shots(page,app,'compartilhar');
});

/* ---- U. Guia e Relatar um problema ---- */
await block('triage',async ctx=>{
  const {page,app}=await bootCourse(ctx,'aud-triage');
  await page.keyboard.press('ControlOrMeta+/');
  await page.waitForSelector('#help-dialog[open]');
  await shots(page,app,'guia');
  await page.locator('#help-triage').click();
  await page.waitForSelector('#triage-dialog[open]');
  await page.waitForFunction(()=>document.querySelector('#triage-report')?.textContent.includes('## Ambiente'),null,{timeout:60000});
  await shots(page,app,'relatar-problema');
});

/* ---- V. erros do tutor: sem OpenCode e cota grátis; chave/login ficam no
   diálogo de provedores (capture-auditoria-ui-estados.mjs), que é a rota real
   de `FAKE_OPENCODE_KEY`/`FAKE_OPENCODE_OAUTH`. ---- */
await block('erro-sem-motor',async ctx=>{
  const runtime=ctx.runtime=newRuntime('aud-err-motor');
  const {pdf}=courseWithPdf(runtime);
  writeDeskJson(runtime,{courseId:'calc',courseStates:{calc:{pdfs:[{path:pdf,page:1}],study:{title:'Lista 2 · 7b',xopp:''}}}});
  const ghost=path.join(runtime,'sem-opencode');
  const app=ctx.app=await launchDesk({runtime,opencode:false,env:{LEARNING_DESK_OPENCODE:ghost}});
  const page=await app.firstWindow();
  await resizeWindow(app,page,1440,900);
  await freezeMotion(page);
  await page.waitForSelector('#tutor-state #connect',{timeout:30000});
  await page.locator('#connect').click();
  await page.waitForSelector('#tutor-state[data-state="error"]',{timeout:30000});
  errorTexts['sem-motor']=await readState(page);
  await shots(page,app,'erro-sem-motor');
});
await block('erro-cota',async ctx=>{
  const {page,app}=await bootCourse(ctx,'aud-err-cota',{env:{FAKE_OPENCODE_FAIL:'free-tier'}});
  await send(page,'explique derivadas');
  /* O 403 do Zen aparece no diário do turno, não como mensagem do tutor. */
  await page.waitForFunction(()=>[...document.querySelectorAll('#messages *')].some(el=>el.children.length===0&&el.textContent.includes('recusou o modelo grátis')),undefined,{timeout:60000});
  await page.waitForFunction(()=>!document.querySelector('#send').disabled,undefined,{timeout:30000});
  errorTexts['cota-gratis']=await page.evaluate(()=>({line:[...document.querySelectorAll('#messages *')].filter(el=>el.children.length===0&&el.textContent.includes('recusou o modelo grátis')).map(el=>el.textContent.trim())[0]||''}));
  await shots(page,app,'erro-cota-gratis');
});

/* ---- W. carregando (ligando, com Cancelar) e sem conexão ---- */
await block('carregando',async ctx=>{
  const runtime=ctx.runtime=newRuntime('aud-loading');
  const {pdf}=courseWithPdf(runtime);
  writeDeskJson(runtime,{courseId:'calc',courseStates:{calc:{pdfs:[{path:pdf,page:1}],study:{title:'',xopp:''}}}});
  const wrapper=path.join(runtime,'opencode-gate.mjs');
  fs.writeFileSync(wrapper,`#!/usr/bin/env node\nimport {spawn} from 'node:child_process';\nimport fs from 'node:fs';\nconst here=process.cwd();\nconst gate=${JSON.stringify(path.join(runtime,'gate.open'))};\nconst timer=setInterval(()=>{\n if(!fs.existsSync(gate))return;\n clearInterval(timer);\n const child=spawn(process.execPath,[${JSON.stringify(FAKE_OPENCODE)},...process.argv.slice(2)],{stdio:'inherit'});\n child.on('exit',code=>process.exit(code??0));\n},50);\n`);
  fs.chmodSync(wrapper,0o755);
  const app=ctx.app=await launchDesk({runtime,env:{LEARNING_DESK_OPENCODE:wrapper}});
  const page=await app.firstWindow();
  await resizeWindow(app,page,1440,900);
  await freezeMotion(page);
  await page.waitForSelector('#tutor-state[data-state="connecting"]',{timeout:30000});
  errorTexts['ligando']=await readState(page);
  await shots(page,app,'tutor-ligando');
  await page.locator('#connect-cancel').click();
  await page.waitForFunction(()=>document.querySelector('#tutor-state')?.dataset.state==='resume'||document.querySelector('#tutor-state')?.dataset.state==='off',undefined,{timeout:15000});
  errorTexts['cancelado']=await readState(page);
  await shots(page,app,'tutor-cancelado');
});
await block('vazio-carregando-erro',async ctx=>{
  /* Leitor vazio (matéria sem PDF). O sem-conexão tem bloco próprio abaixo,
     com o estado real (auditoria rodada 4): a Mesa é local e não tem faixa
     permanente — o erro aparece ao enviar sem rede. */
  const runtime=ctx.runtime=newRuntime('aud-empty');
  const course=seedCourse(runtime,'calc');
  writeConfigJson(runtime,{runtimePath:runtime,vaultPath:runtime,courses:[{id:'calc',name:'Cálculo I',path:course}]});
  writeDeskJson(runtime,{courseId:'calc',courseStates:{calc:{pdfs:[],study:{title:'',xopp:''}}}});
  const app=ctx.app=await launchDesk({runtime});
  const page=await app.firstWindow();
  await resizeWindow(app,page,1440,900);
  await statusOnline(page);
  await freezeMotion(page);
  await shots(page,app,'leitor-vazio');
});
await block('sem-conexao',async ctx=>{
  /* Enviar com o provedor fora do ar (DNS): o turno falha e a conversa mostra
     o erro em português, com o texto preservado. É este o `sem-conexao-*`. */
  const {page,app}=await bootCourse(ctx,'aud-sem-conexao',{env:{FAKE_OPENCODE_FAIL:'network'}});
  await send(page,'explique derivadas sem rede');
  await page.waitForFunction(()=>[...document.querySelectorAll('#messages *')].some(el=>el.children.length===0&&el.textContent.includes('Sem conexão')),undefined,{timeout:60000});
  await page.waitForFunction(()=>!document.querySelector('#send').disabled,undefined,{timeout:30000});
  errorTexts['sem-conexao']=await page.evaluate(()=>({line:[...document.querySelectorAll('#messages *')].filter(el=>el.children.length===0&&el.textContent.includes('Sem conexão')).map(el=>el.textContent.trim())[0]||''}));
  await shots(page,app,'sem-conexao');
});

fs.writeFileSync(path.join(OUT,'failures.json'),JSON.stringify({failures,errorTexts},null,2));
console.log('capturas em',OUT);
console.log('falhas:',JSON.stringify(failures,null,2));
