// node tests/tool-updates-ui.mjs — avisos de atualização do Pi e do Claude Code (#45), medidos na janela.
// Cenários (cada um sobe uma Mesa com `brew`/`npm`/`claude` FALSOS, nomeados em
// tests/fake-tool-binaries.mjs; nada de rede nem de instalador de verdade):
//   avisos   — Pi (Homebrew) e Claude Code com versão nova: ponto no ⚙, duas linhas no topo
//              do Sobre, o ponto some ao abrir, "Lembrar depois", confirmação com o comando
//              exato, Cancelar não roda nada, Atualizar roda só depois do clique;
//   ⚙ (#52)  — o ponto leva às Configurações, que mostram a mesma linha com "Ver no Sobre";
//   falha    — `brew upgrade` sai com erro: uma frase + a saída numa área rolável;
//   offline  — sem versão nova conhecida: nenhum ponto, nenhuma linha, "não deu para conferir";
//   à frente — Pi mais novo que o testado: "mais nova que a testada" e a confirmação avisa;
//   cópia    — instalação que a Mesa não reconhece: só o comando com "Copiar".
// Sobre e ⚙ são medidos nos dois temas, em 1440×900 e 900×650.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
 withArtifacts,newRuntime,seedCourse,writeConfigJson,writeDeskJson,launchDesk,statusOnline,tinyPdf,
 reviewShot,screenshotDirectory,setTheme,freezeMotion,resizeWindow
} from './helpers.mjs';
import {installFakeTools} from './fake-tool-binaries.mjs';
import {nextFrames} from './waits.mjs';

const out=screenshotDirectory('issue-45');
const near=(a,b,tol=1)=>Math.abs(a-b)<=tol;
const SIZES=[[1440,900],[900,650]];
const THEMES=['light','dark'];

const measureAbout=page=>page.evaluate(()=>{
 const rect=el=>{const b=el.getBoundingClientRect();return {top:b.top,bottom:b.bottom,left:b.left,right:b.right,width:b.width,height:b.height};};
 const dialog=document.querySelector('#about-dialog');
 const trigger=document.querySelector('#settings-trigger');
 const dot=getComputedStyle(trigger,'::after');
 const notices=[...document.querySelectorAll('#about-notices .about-notice')].map(el=>({id:el.dataset.id,text:el.querySelector('.update-text').textContent.trim(),...rect(el),buttons:[...el.querySelectorAll('button')].map(b=>({text:b.textContent.trim(),h:b.getBoundingClientRect().height})),overflow:el.scrollWidth-el.clientWidth}));
 const rows=[...document.querySelectorAll('#component-rows .component-row')].map(el=>({id:el.dataset.id,state:el.querySelector('.component-state')?.textContent.trim()||'',...rect(el),overflow:el.scrollWidth-el.clientWidth,actions:[...el.querySelectorAll('button')].map(b=>b.textContent.trim())}));
 const run=document.querySelector('#component-rows .component-run');
 const output=document.querySelector('#component-rows .run-output');
 return {
  vw:innerWidth,vh:innerHeight,dialog:rect(dialog),overflow:dialog.scrollWidth-dialog.clientWidth,
  foot:rect(document.querySelector('.about-foot')),box:document.querySelector('#about-notices').hidden?null:rect(document.querySelector('#about-notices')),
  notices,rows,
  trigger:{dot:trigger.dataset.dot,title:trigger.title,label:trigger.getAttribute('aria-label'),dotWidth:parseFloat(dot.width),dotContent:dot.content},
  run:run?{phase:run.dataset.phase,text:run.textContent.replace(/\s+/g,' ').trim(),...rect(run),command:run.querySelector('.run-command')?.textContent||''}:null,
  output:output?{h:output.getBoundingClientRect().height,scroll:output.scrollHeight-output.clientHeight,text:output.textContent}:null,
  body:{scroll:document.querySelector('.about-body').scrollHeight-document.querySelector('.about-body').clientHeight}
 };
});

const resize=async(ctx,page,width,height)=>{
 await resizeWindow(ctx.app,page,width,height,{content:true});
 await nextFrames(page,3);
};

/* Sobe a Mesa com os instaladores falsos. `latest` vira LEARNING_DESK_TOOL_LATEST
   (sem ele a conferência fica "offline" em modo de teste). */
async function launch(ctx,tag,{fake={},latest=null,fixtures=true}={}){
 const runtime=ctx.runtime=newRuntime(tag);
 const course=seedCourse(runtime,'calc');
 const pdf=path.join(course,'Limites.pdf');fs.writeFileSync(pdf,tinyPdf('Limites'));
 writeConfigJson(runtime,{runtimePath:runtime,vaultPath:runtime,courses:[{id:'calc',name:'Cálculo I',path:course}]});
 writeDeskJson(runtime,{courseId:'calc',courseStates:{calc:{pdfs:[{path:pdf,page:1}],study:{title:'',xopp:''}}}});
 const tools=installFakeTools(path.join(runtime,'tools'),fake);
 const env={};
 if(fixtures){
  env.LEARNING_DESK_TOOL_FAKE_BIN=tools.bin;
  env.LEARNING_DESK_CLAUDE_LAUNCHER=tools.claudeLauncher;
  if(latest)env.LEARNING_DESK_TOOL_LATEST=JSON.stringify(latest);
 }
 if(fixtures)env.LEARNING_DESK_TOOL_PI_PATH=tools.piPath;
 ctx.app=await launchDesk({runtime,env});
 const page=await ctx.app.firstWindow();
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await resize(ctx,page,1440,900);
 await statusOnline(page);
 await freezeMotion(page);
 await page.waitForSelector('.pdf-panel canvas',{timeout:30000});
 return {page,tools,errors,runtime};
}

async function openAbout(page){
 await page.locator('#settings-menu .nav-trigger').click();
 await page.locator('#about').click();
 await page.waitForSelector('#about-dialog[open]');
 await page.waitForFunction(()=>![...document.querySelectorAll('#component-rows .component-state')].some(e=>e.textContent==='Verificando…')&&document.querySelectorAll('#component-rows .component-row').length>=4,undefined,{timeout:15000});
}
async function closeAbout(page){
 await page.locator('#about-dialog .dialog-close').click();
 await page.waitForFunction(()=>!document.querySelector('#about-dialog').open);
}
const tag=(theme,w)=>`${theme} ${w}`;

/* O casco que vale para qualquer cenário aberto: cabe, sem rolagem lateral,
   rodapé encostado, linhas na ordem Pi, Claude Code, Node, Xournal++. */
function assertShell(m,label){
 assert.ok(m.dialog.bottom<=m.vh&&m.dialog.right<=m.vw&&m.dialog.left>=0&&m.dialog.top>=0,`${label}: cabe na janela`);
 assert.ok(m.overflow<=0,`${label}: sem rolagem lateral`);
 assert.deepEqual(m.rows.map(r=>r.id),['pi','claude','node','xournal'],`${label}: Pi, Claude Code, Node, Xournal++`);
 assert.ok(m.rows.every(r=>r.overflow<=0),`${label}: linhas sem rolagem lateral`);
 assert.ok(near(m.foot.height,52,1)&&m.dialog.bottom-m.foot.bottom<=1,`${label}: rodapé de 52px encostado na base`);
 for(const n of m.notices){
  assert.ok(n.overflow<=0,`${label}: aviso ${n.id} sem rolagem lateral`);
  assert.ok(n.buttons.every(b=>near(b.h,28,0.6)),`${label}: botões do aviso de 28px (${n.buttons.map(b=>b.h)})`);
  assert.ok(n.right<=m.dialog.right+0.5,`${label}: aviso ${n.id} dentro do diálogo`);
 }
}

await withArtifacts('tool-updates-avisos',async ctx=>{
 const {page,tools,errors}=await launch(ctx,'tool-avisos',{latest:{pi:'1.3.0',claude:'2.1.301'},fake:{piAfter:'1.3.0',claudeAfter:'2.1.301'}});
 /* O ponto no ⚙ aparece sem toast nem modal; o título diz que há atualização. */
 await page.waitForFunction(()=>document.querySelector('#settings-trigger').dataset.dot==='true',undefined,{timeout:15000});
 let m=await measureAbout(page);
 assert.equal(m.trigger.title,'Ajustes · há uma atualização');
 assert.equal(m.trigger.label,'Ajustes · há uma atualização');
 assert.ok(near(m.trigger.dotWidth,7,0.6),`ponto de 7px (${m.trigger.dotWidth})`);
 assert.equal(await page.locator('#toast:visible,.toast:visible').count(),0,'nenhum toast anuncia a atualização');
 assert.equal(await page.locator('dialog[open]').count(),0,'nenhum modal abre sozinho');
 /* O menu do ⚙ diz onde o ponto leva: o item Ajustes tem o mesmo ponto. */
 await page.locator('#settings-menu .nav-trigger').click();
 const itemDot=await page.evaluate(()=>{const d=getComputedStyle(document.querySelector('#settings-pop #settings'),'::after');return {w:parseFloat(d.width),content:d.content};});
 assert.ok(near(itemDot.w,7,0.6),`ponto de 7px no item Ajustes (${JSON.stringify(itemDot)})`);
 const aboutDot=await page.evaluate(()=>getComputedStyle(document.querySelector('#settings-pop #about'),'::after').content);
 assert.equal(aboutDot,'none','só o item Ajustes ganha o ponto');
 await page.keyboard.press('Escape');
 for(const theme of THEMES){
  await setTheme(page,theme);
  await reviewShot(page,out,`engrenagem-ponto-${theme}-1440.png`);
 }

 await openAbout(page);
 m=await measureAbout(page);
 assert.deepEqual(m.notices.map(n=>n.id),['pi','claude']);
 assert.equal(m.notices[0].text,'Pi 1.3.0 disponível');
 assert.equal(m.notices[1].text,'Claude Code 2.1.301 disponível');
 assert.deepEqual(m.notices[0].buttons.map(b=>b.text),['Lembrar depois','Ignorar esta versão']);
 assert.equal(m.trigger.dot,'false','abrir o Sobre apaga o ponto');
 assert.equal(m.trigger.title,'Ajustes');
 /* Pi pelo Homebrew: "Atualizar" (não o botão "Atualizar o Pi"); Claude Code idem. */
 const piRow=m.rows.find(r=>r.id==='pi'),claudeRow=m.rows.find(r=>r.id==='claude');
 assert.deepEqual(piRow.actions,['Atualizar']);
 assert.deepEqual(claudeRow.actions,['Atualizar']);
 assert.ok(claudeRow.state.length>0,'o Claude Code tem estado');

 for(const [width,height] of SIZES){
  await resize(ctx,page,width,height);
  for(const theme of THEMES){
   await setTheme(page,theme);
   const label=tag(theme,`${width}×${height}`);
   const now=await measureAbout(page);
   assertShell(now,label);
   assert.ok(now.notices.length===2&&now.box&&now.box.top>=now.dialog.top,`${label}: linhas no topo do Sobre`);
   await reviewShot(page,out,`sobre-avisos-${theme}-${width}.png`);
  }
 }

 /* Sem clique, nada roda. Cancelar não roda nada; o comando é o exato. */
 assert.deepEqual(tools.calls(),[],'nenhum instalador rodou sozinho');
 await resize(ctx,page,1440,900);
 await page.locator('#component-rows [data-id="pi"] .tool-ask').click();
 await page.waitForSelector('#component-rows [data-id="pi"] .component-run[data-phase="confirm"]');
 m=await measureAbout(page);
 assert.equal(m.run.command,'brew upgrade pi-coding-agent');
 assert.match(m.run.text,/^Vai rodar: brew upgrade pi-coding-agent/);
 assert.doesNotMatch(m.run.text,/mais nova que a testada/,'versão dentro do testado não avisa');
 for(const theme of THEMES){
  await setTheme(page,theme);
  await reviewShot(page,out,`sobre-confirmacao-pi-${theme}-1440.png`);
 }
 await page.locator('#component-rows [data-id="pi"] .run-cancel').click();
 assert.equal(await page.locator('#component-rows .component-run').count(),0,'Cancelar fecha a confirmação');
 assert.deepEqual(tools.calls(),[],'Cancelar não roda nada');

 /* "Lembrar depois" some a linha do Pi; o ponto fica fechado enquanto o Sobre está aberto. */
 await page.locator('#about-notices [data-id="pi"].notice-btn').first().click();
 await page.waitForFunction(()=>document.querySelectorAll('#about-notices .about-notice').length===1);
 assert.equal((await measureAbout(page)).notices[0].id,'claude');

 /* Atualizar o Claude Code: confirma, roda, uma frase de resultado + saída. */
 await page.locator('#component-rows [data-id="claude"] .tool-ask').click();
 m=await measureAbout(page);
 assert.equal(m.run.command,'claude update');
 await page.locator('#component-rows [data-id="claude"] .run-confirm').click();
 await page.waitForSelector('#component-rows [data-id="claude"] .component-run[data-phase="done"]',{timeout:20000});
 m=await measureAbout(page);
 assert.deepEqual(tools.calls().map(c=>[c.tool,...c.args]),[['claude','update']],'só o claude update rodou, depois da confirmação');
 assert.match(m.run.text,/Claude Code/);
 assert.match(m.run.text,/2\.1\.301/);
 assert.ok(m.output&&/Checking for updates/.test(m.output.text),'a saída do comando aparece');
 for(const theme of THEMES){
  await setTheme(page,theme);
  await reviewShot(page,out,`sobre-resultado-claude-${theme}-1440.png`);
 }
 await page.locator('#component-rows [data-id="claude"] .run-close').click();
 await closeAbout(page);

 /* Aberta de novo, sem versão mais nova ainda: o ponto não volta. */
 await nextFrames(page,4);
 assert.equal((await measureAbout(page)).trigger.dot,'false','sem versão mais nova o ponto não volta');
 assert.deepEqual(errors,[]);
});

await withArtifacts('tool-updates-configuracoes',async ctx=>{
 const {page,tools,errors}=await launch(ctx,'tool-config',{latest:{pi:'1.3.0',claude:'2.1.301'},fake:{piAfter:'1.3.0',claudeAfter:'2.1.301'}});
 /* #52: o ponto do ⚙ leva a quem abre o ⚙. O menu abre as Configurações, e elas
    mostram a MESMA linha (com "Ver no Sobre"); ver a linha apaga o ponto. */
 /* Antes de abrir qualquer coisa: o ponto está aceso. */
 await page.waitForFunction(()=>document.querySelector('#settings-trigger').dataset.dot==='true',undefined,{timeout:15000});
 await page.locator('#settings-menu .nav-trigger').click();
 await page.locator('#settings-pop button').first().click();
 await page.waitForSelector('#settings-dialog[open]');
 await page.waitForFunction(()=>document.querySelector('#settings-trigger').dataset.dot==='false',undefined,{timeout:5000});
 const inSettings=()=>page.evaluate(()=>{
  const dialog=document.querySelector('#settings-dialog').getBoundingClientRect(),box=document.querySelector('#settings-notices'),body=document.querySelector('#settings-body');
  const rect=el=>el.getBoundingClientRect();
  return {
   hidden:box.hidden,first:body.firstElementChild===box,top:rect(box).top-rect(body).top,right:rect(box).right,dialogRight:dialog.right,dialogBottom:dialog.bottom,bottom:rect(box).bottom,
   lines:[...box.querySelectorAll('.about-notice')].map(el=>({id:el.dataset.id,text:el.querySelector('.update-text').textContent.trim(),buttons:[...el.querySelectorAll('button')].map(b=>b.textContent.trim()),overflow:el.scrollWidth-el.clientWidth})),
   dot:document.querySelector('#settings-trigger').dataset.dot,
  };
 });
 for(const [width,height] of SIZES){
  await resize(ctx,page,width,height);
  for(const theme of THEMES){
   await setTheme(page,theme);
   const label=tag(theme,`${width}×${height}`),s=await inSettings();
   assert.equal(s.hidden,false,`${label}: a linha aparece nas Configurações`);
   assert.ok(s.first&&s.top<=28,`${label}: primeiro bloco do corpo das Configurações, só com o respiro do topo (${s.top})`);
   assert.deepEqual(s.lines.map(l=>l.text),['Pi 1.3.0 disponível','Claude Code 2.1.301 disponível'],`${label}: a mesma linha do Sobre`);
   assert.ok(s.lines.every(l=>l.buttons.includes('Ver no Sobre')&&l.buttons.includes('Lembrar depois')&&l.overflow<=0),`${label}: ações à mão, sem rolagem lateral (${JSON.stringify(s.lines)})`);
   assert.ok(s.right<=s.dialogRight+0.5&&s.bottom<=s.dialogBottom,`${label}: a linha cabe no diálogo`);
   await reviewShot(page,out,`configuracoes-aviso-${theme}-${width}.png`);
  }
 }
 await resize(ctx,page,1440,900);
 /* "Ver no Sobre" abre o Sobre por cima, com o "Atualizar" da linha do componente. */
 await page.locator('#settings-notices .about-notice[data-id="pi"] button',{hasText:'Ver no Sobre'}).click();
 await page.waitForSelector('#about-dialog[open]');
 await page.waitForFunction(()=>![...document.querySelectorAll('#component-rows .component-state')].some(e=>e.textContent==='Verificando…')&&document.querySelectorAll('#component-rows .component-row').length>=4,undefined,{timeout:15000});
 assert.equal(await page.locator('#component-rows [data-id="pi"] .tool-ask').count(),1,'o Sobre mostra o "Atualizar"');
 await closeAbout(page);
 await page.locator('#settings-dialog button[value="cancel"]').last().click();
 await page.waitForFunction(()=>!document.querySelector('#settings-dialog').open);
 /* Fechar não traz o ponto de volta; a linha segue valendo até a pessoa resolvê-la. */
 assert.equal((await measureAbout(page)).trigger.dot,'false','ver a linha nas Configurações apagou o ponto');
 assert.deepEqual(tools.calls(),[],'nada rodou sozinho');
 assert.deepEqual(errors,[]);

});

await withArtifacts('tool-updates-falha',async ctx=>{
 const {page,tools,errors}=await launch(ctx,'tool-falha',{latest:{pi:'1.4.0',claude:'2.1.296'},fake:{failBrew:true}});
 await openAbout(page);
 await page.locator('#component-rows [data-id="pi"] .tool-ask').click();
 await page.locator('#component-rows [data-id="pi"] .run-confirm').click();
 await page.waitForSelector('#component-rows [data-id="pi"] .component-run[data-phase="failed"]',{timeout:20000});
 for(const [width,height] of SIZES){
  await resize(ctx,page,width,height);
  for(const theme of THEMES){
   await setTheme(page,theme);
   const label=tag(theme,`${width}×${height}`);
   const m=await measureAbout(page);
   assertShell(m,label);
   assert.match(m.run.text,/^Não deu para atualizar o Pi\. Veja a saída abaixo\./,`${label}: uma frase de falha`);
   assert.ok(m.output&&/falhou de propósito/.test(m.output.text),`${label}: a saída mostra o erro`);
   assert.ok(m.output.h<=145,`${label}: a saída é uma área rolável de até 140px (${m.output.h})`);
   assert.ok(m.run.right<=m.dialog.right,`${label}: o painel cabe no diálogo`);
   await reviewShot(page,out,`sobre-falha-${theme}-${width}.png`);
  }
 }
 assert.deepEqual(tools.calls().map(c=>c.tool),['brew']);
 assert.deepEqual(errors,[]);
});

await withArtifacts('tool-updates-offline',async ctx=>{
 /* Sem LEARNING_DESK_TOOL_LATEST: em modo de teste a rede não existe → offline. */
 const {page,errors}=await launch(ctx,'tool-offline',{});
 /* O main responde `tool-notices` só depois de ler as versões: sem versão mais nova conhecida, volta sem linha e sem ponto. */
 const summary=await page.evaluate(()=>window.desk.toolNotices());
 assert.deepEqual([summary.lines,summary.dot],[[],false],'offline: sem linha e sem ponto');
 assert.ok(summary.items.pi.unreachable&&summary.items.claude.unreachable,'offline: a conferência diz que não deu para conferir');
 let m=await measureAbout(page);
 assert.equal(m.trigger.dot,'false','offline não põe ponto');
 await openAbout(page);
 for(const [width,height] of SIZES){
  await resize(ctx,page,width,height);
  for(const theme of THEMES){
   await setTheme(page,theme);
   const label=tag(theme,`${width}×${height}`);
   m=await measureAbout(page);
   assertShell(m,label);
   assert.equal(m.notices.length,0,`${label}: nenhuma linha de aviso`);
   assert.equal(m.box,null,`${label}: a área de avisos fica escondida`);
   const claude=m.rows.find(r=>r.id==='claude');
   assert.match(claude.state,/não deu para conferir/,`${label}: o Claude Code diz que não deu para conferir`);
   await reviewShot(page,out,`sobre-offline-${theme}-${width}.png`);
  }
 }
 assert.deepEqual(errors,[]);
});

await withArtifacts('tool-updates-a-frente',async ctx=>{
 /* Pi 1.4.0 instalado e é a última, mas a Mesa foi testada com a 1.3.0. */
 const {page,tools,errors}=await launch(ctx,'tool-frente',{latest:{pi:'1.5.0',claude:'2.1.296'},fake:{piVersion:'1.4.0',piAfter:'1.5.0'}});
 await openAbout(page);
 const m=await measureAbout(page);
 assert.match(m.notices[0].text,/^Pi 1\.5\.0 disponível · mais nova que a testada/);
 await page.locator('#component-rows [data-id="pi"] .tool-ask').click();
 const confirm=await measureAbout(page);
 assert.match(confirm.run.text,/mais nova que a testada com esta Mesa \(1\.3\.0\)/,'a confirmação avisa');
 assert.equal(await page.locator('#component-rows [data-id="pi"] .run-confirm').isEnabled(),true,'o aviso nunca bloqueia');
 for(const [width,height] of SIZES){
  await resize(ctx,page,width,height);
  for(const theme of THEMES){
   await setTheme(page,theme);
   const label=tag(theme,`${width}×${height}`);
   assertShell(await measureAbout(page),label);
   await reviewShot(page,out,`sobre-mais-nova-${theme}-${width}.png`);
  }
 }
 assert.deepEqual(tools.calls(),[]);
 assert.deepEqual(errors,[]);
});

await withArtifacts('tool-updates-copia',async ctx=>{
 const {page,tools,errors}=await launch(ctx,'tool-copia',{latest:{pi:'1.4.0',claude:'2.1.299'},fake:{install:'solto'}});
 await openAbout(page);
 let m=await measureAbout(page);
 const pi=m.rows.find(r=>r.id==='pi');
 assert.deepEqual(pi.actions,['Copiar'],'instalação desconhecida: só o comando, com Copiar');
 assert.match(await page.locator('#component-rows [data-id="pi"] .tool-copy').getAttribute('aria-label'),/Copiar o comando: npm i -g @earendil-works\/pi-coding-agent/);
 for(const [width,height] of SIZES){
  await resize(ctx,page,width,height);
  for(const theme of THEMES){
   await setTheme(page,theme);
   assertShell(await measureAbout(page),tag(theme,`${width}×${height}`));
   await reviewShot(page,out,`sobre-copiar-${theme}-${width}.png`);
  }
 }

 /* Tutor respondendo: a ação do Claude Code fica desligada, com a dica. */
 await resize(ctx,page,1440,900);
 await page.evaluate(async()=>{(await import('./src/state.mjs')).setBusy(true);});
 await page.waitForSelector('#component-rows [data-id="claude"] button[disabled]');
 await measureAbout(page);
 assert.match(await page.locator('#component-rows [data-id="claude"] .component-wait').textContent(),/Espere o tutor terminar/);
 await reviewShot(page,out,'sobre-tutor-ocupado-dark-1440.png');
 await page.evaluate(async()=>{(await import('./src/state.mjs')).setBusy(false);});
 await page.waitForFunction(()=>!document.querySelector('#component-rows [data-id="claude"] button[disabled]'));
 assert.deepEqual(tools.calls(),[]);

 /* Vocabulário (ui-smoke): "Pi" só em Sobre e Configurações. Fechado o Sobre, a tela não o diz. */
 await closeAbout(page);
 const visible=await page.evaluate(()=>[...document.querySelectorAll('body *')].filter(el=>{const b=el.getBoundingClientRect();return b.width>0&&b.height>0&&getComputedStyle(el).visibility!=='hidden'&&!el.closest('dialog');}).map(el=>el.childNodes.length===1&&el.firstChild.nodeType===3?el.textContent:'').join(' '));
 /* "Pi de teste" é o nome do modelo do Pi falso: dado do provedor, não vocabulário (como no ui-smoke). */
 assert.doesNotMatch(visible.replace(/Pi de teste/g,''),/\bPi\b/,'fora do Sobre e das Configurações a interface não diz Pi');
 assert.deepEqual(errors,[]);
});
console.log('tool-updates-ui: PASS — ponto no ⚙, linhas e ações do Sobre, confirmação, saída, offline e "mais nova que a testada" medidos nos dois temas e tamanhos.');
