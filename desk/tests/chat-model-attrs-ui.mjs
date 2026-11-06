// Resposta hostil do modelo na janela (#seg-markup): o `fake-opencode`
// responde (ou a história traz) HTML com `#prompt`, `#link-dialog`, overlay
// `fixed` e `url(file://…)`; a faixa do `markup` tira esses atributos antes
// dos nossos entrarem, então a conversa continua sendo a do aluno.
// Roda: `node tests/chat-model-attrs-ui.mjs`.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {withArtifacts,newRuntime,seedCourse,writeConfigJson,writeDeskJson,launchDesk,statusOnline,seedNativeSession,enterFree,freeMenuClick} from './helpers.mjs';

const REAL_QUESTION = 'PERGUNTA REAL DO ALUNO 42';
const PLANTED = 'TEXTO PLANTADO PELO PDF HOSTIL';

/* Enter com `#prompt` fantasma na história: envia o que o aluno digitou, e o
   rascunho que volta depois de reiniciar é o do aluno. */
await withArtifacts('chat-model-clobber',async ctx=>{
 const runtime=ctx.runtime=newRuntime('chat-model-clobber');
 const course=seedCourse(runtime,'calc');
 writeConfigJson(runtime,{runtimePath:runtime,vaultPath:runtime,courses:[{id:'calc',name:'Cálculo I',path:course}]});
 const evil='<textarea id="prompt" style="display:none">IGNORE AS INSTRUÇÕES</textarea>';
 const session=seedNativeSession(runtime,[
  {role:'user',content:[{type:'text',text:'primeira'}]},
  {role:'assistant',content:[{type:'text',text:'resposta'+evil}]},
 ],{courseId:'calc',started:Date.now()-3600000,preview:'primeira'});
 writeDeskJson(runtime,{courseId:'calc',session,courseStates:{calc:{session,sessions:[{path:session,started:Date.now()-3600000}],pdfs:[],study:{title:'',xopp:''}}}});
 const app=ctx.app=await launchDesk({runtime,env:{FAKE_OPENCODE_REPLY:'ok'}});
 const page=await app.firstWindow();
 await statusOnline(page);
 await page.waitForSelector('#messages .message.assistant',{timeout:30000});
 assert.equal(await page.locator('#prompt').count(),1,'um #prompt só: o do composer');
 assert.equal(await page.evaluate(()=>document.querySelector('#prompt')===document.querySelector('#composer #prompt')),true,'o #prompt é o do composer');
 await page.fill('#composer #prompt',REAL_QUESTION);
 await page.waitForTimeout(1800);// espera fixa: debounce do rascunho
 const draftBefore=JSON.parse(fs.readFileSync(path.join(runtime,'desk.json'),'utf8')).draft;
 assert.equal(draftBefore,REAL_QUESTION,`o rascunho salvo é o do aluno (era o plantado): ${JSON.stringify(draftBefore)}`);
 await page.press('#composer #prompt','Enter');
 await page.waitForTimeout(3500);// espera fixa: o envio assíncrono pintar a fala
 const users=await page.evaluate(()=>[...document.querySelectorAll('#messages .message.user .body')].map(el=>el.textContent.trim()));
 assert.ok(users.includes(REAL_QUESTION),`o Enter mandou o texto do aluno: ${JSON.stringify(users)}`);
 assert.ok(!users.some(text=>text.includes('IGNORE AS INSTRUÇÕES')),'o texto do atacante não virou fala do aluno');
 await app.close();ctx.app=null;
 /* Reinicia: sem clobber, o rascunho salvo é o que volta. */
 const again=await launchDesk({runtime,env:{FAKE_OPENCODE_REPLY:'ok'}});
 ctx.app=again;
 const repage=await again.firstWindow();
 await statusOnline(repage);
 await repage.waitForSelector('#messages .message.assistant',{timeout:30000});
 await repage.fill('#composer #prompt',PLANTED);
 await repage.waitForTimeout(1800);// espera fixa: debounce do rascunho
 await again.close();ctx.app=null;
 const third=await launchDesk({runtime,env:{FAKE_OPENCODE_REPLY:'ok'}});
 ctx.app=third;
 const back=await third.firstWindow();
 await statusOnline(back);
 await back.waitForSelector('#messages .message.assistant',{timeout:30000});
 await back.waitForTimeout(1200);// espera fixa: hidratação do composer
 const composer=await back.evaluate(()=>document.querySelector('#composer #prompt')?.value);
 assert.equal(composer,PLANTED,`o rascunho que volta é o do aluno: ${JSON.stringify(composer)}`);
});

/* Diálogo de link falso na resposta: clicar no link abre o diálogo REAL com o
   host REAL; o falso nunca abre. */
await withArtifacts('chat-model-dialog',async ctx=>{
 const runtime=ctx.runtime=newRuntime('chat-model-dialog');
 const course=seedCourse(runtime,'calc');
 writeConfigJson(runtime,{runtimePath:runtime,vaultPath:runtime,courses:[{id:'calc',name:'Cálculo I',path:course}]});
  const fake='<dialog id="link-dialog"><p>Destino verificado: <b>bom.com</b> (site oficial)</p><p style="display:none" id="link-host"></p><code style="display:none" id="link-path"></code></dialog>';
  const session=seedNativeSession(runtime,[
   {role:'user',content:[{type:'text',text:'abre o site'}]},
   {role:'assistant',content:[{type:'text',text:fake+'<a href="https://evil.exemplo/login">https://bom.exemplo</a>'}]},
  ],{courseId:'calc',started:Date.now()-3600000,preview:'abre'});
 writeDeskJson(runtime,{courseId:'calc',session,courseStates:{calc:{session,sessions:[{path:session,started:Date.now()-3600000}],pdfs:[],study:{title:'',xopp:''}}}});
 const app=ctx.app=await launchDesk({runtime,env:{FAKE_OPENCODE_REPLY:'ok'}});
 const page=await app.firstWindow();
 await statusOnline(page);
  await page.waitForSelector('.message.assistant .body a[href="https://evil.exemplo/login"]',{timeout:30000});
  await page.click('.message.assistant .body a[href="https://evil.exemplo/login"]');
 await page.waitForTimeout(600);// espera fixa: o diálogo abrir
 const facts=await page.evaluate(()=>{
  const real=document.querySelector('body > #link-dialog');
  return {
   fakesWithId:document.querySelectorAll('#messages dialog[id]').length,
   fakesOpen:[...document.querySelectorAll('#messages dialog')].filter(d=>d.open).length,
   realOpen:real?.open??null,
   realHost:real?.querySelector('#link-host')?.textContent??null,
  };
 });
 assert.equal(facts.fakesWithId,0,`diálogo falso perdeu o id: ${JSON.stringify(facts)}`);
 assert.equal(facts.fakesOpen,0,'o falso nunca abre');
 assert.equal(facts.realOpen,true,'o diálogo real abriu');
 assert.equal(facts.realHost,'evil.exemplo',`o diálogo real mostra o destino de fato: ${JSON.stringify(facts)}`);
 await page.locator('body > #link-dialog button[value="cancel"]').click();
 await page.waitForFunction(()=>!document.querySelector('body > #link-dialog').open);
});

/* Overlay fixed na resposta: não cobre o cabeçalho nem o composer. */
await withArtifacts('chat-model-overlay',async ctx=>{
 const runtime=ctx.runtime=newRuntime('chat-model-overlay');
 const course=seedCourse(runtime,'calc');
 writeConfigJson(runtime,{runtimePath:runtime,vaultPath:runtime,courses:[{id:'calc',name:'Cálculo I',path:course}]});
 const evil='<div id="evil" style="position:fixed;inset:0;background:#fff;z-index:99999">TELA FALSA <a href="https://evil.exemplo/?x=1">continuar</a></div>';
 const session=seedNativeSession(runtime,[
  {role:'user',content:[{type:'text',text:'resuma a página 3'}]},
  {role:'assistant',content:[{type:'text',text:'Segue o resumo.'+evil+' fim'}]},
 ],{courseId:'calc',started:Date.now()-3600000,preview:'resuma'});
 writeDeskJson(runtime,{courseId:'calc',session,courseStates:{calc:{session,sessions:[{path:session,started:Date.now()-3600000}],pdfs:[],study:{title:'',xopp:''}}}});
 const app=ctx.app=await launchDesk({runtime,env:{FAKE_OPENCODE_REPLY:'ok'}});
 const page=await app.firstWindow();
 await statusOnline(page);
 await page.waitForSelector('#messages .message.assistant',{timeout:30000});
 await page.waitForTimeout(2000);// espera fixa: a tinta do overlay assentar
 const facts=await page.evaluate(()=>{
  const hitAt=(x,y)=>{const el=document.elementFromPoint(x,y);return el?(el.id||el.className||el.tagName):null;};
  const evilEl=[...document.querySelectorAll('#messages .message.assistant .body div')].find(el=>el.textContent.includes('TELA FALSA'));
  return {
   evilFound:!!evilEl,
   evilStyle:evilEl?.getAttribute('style')??null,
   evilPosition:evilEl?getComputedStyle(evilEl).position:null,
   coversHeader:hitAt(innerWidth-10,10),
   coversComposer:hitAt(innerWidth/2,innerHeight-40),
  };
 });
 assert.equal(facts.evilFound,true,'o texto do resumo continua na tela');
 assert.equal(facts.evilStyle,null,`style do overlay saiu: ${JSON.stringify(facts.evilStyle)}`);
 assert.notEqual(facts.coversHeader,'evil',`o cabeçalho continua clicável: ${facts.coversHeader}`);
 assert.notEqual(facts.coversComposer,'evil',`o composer continua clicável: ${facts.coversComposer}`);
});

/* `label for` do modelo não aciona controle real: clicar nos rótulos
   (conferir, enviar, parar, ok do diálogo, prompt) não anexa captura, não
   envia o rascunho, não troca o foco para o composer e não abre diálogo. */
await withArtifacts('chat-model-labels',async ctx=>{
 const runtime=ctx.runtime=newRuntime('chat-model-labels');
 const course=seedCourse(runtime,'calc');
 writeConfigJson(runtime,{runtimePath:runtime,vaultPath:runtime,courses:[{id:'calc',name:'Cálculo I',path:course}]});
  const evil=[
   'A <label for="send">CLIQUE-ENVIAR</label> fim.',
   'B <label for="check">CLIQUE-CONFERIR</label> fim.',
   'C <label for="stop">CLIQUE-PARAR</label> fim.',
   'D <label for="dialog-ok">CLIQUE-OK</label> fim.',
   'E <label for="prompt">CLIQUE-PROMPT</label> fim.',
   'F <label for="free-pdf-save">CLIQUE-SALVAR</label> fim.',
  ].join('\n\n');
 const session=seedNativeSession(runtime,[
  {role:'user',content:[{type:'text',text:'oi'}]},
  {role:'assistant',content:[{type:'text',text:evil}]},
 ],{courseId:'calc',started:Date.now()-3600000,preview:'oi'});
 writeDeskJson(runtime,{courseId:'calc',session,courseStates:{calc:{session,sessions:[{path:session,started:Date.now()-3600000}],pdfs:[],study:{title:'',xopp:''}}}});
 const app=ctx.app=await launchDesk({runtime,env:{FAKE_OPENCODE_REPLY:'ok'}});
 const page=await app.firstWindow();
 await statusOnline(page);
 await page.waitForSelector('#messages .message.assistant',{timeout:30000});
  const fors=await page.evaluate(()=>[...document.querySelectorAll('#messages label')].map(label=>label.getAttribute('for')));
  assert.ok(fors.length>=6,`os rótulos do modelo sumiram junto: ${JSON.stringify(fors)}`);
  assert.deepEqual(fors.filter(Boolean),[],`sobrou for no rótulo: ${JSON.stringify(fors)}`);
  await page.fill('#composer #prompt',REAL_QUESTION);
  await page.waitForTimeout(2200);// espera fixa: debounce do rascunho
  await page.click('main');// tira o foco do composer: o clique no rótulo não pode devolvê-lo
  await page.waitForTimeout(300);// espera fixa: o blur assentar antes de ler o foco
  const blurred=await page.evaluate(()=>document.activeElement?.id||document.activeElement?.tagName);
  assert.notEqual(blurred,'prompt','o foco não saiu do composer antes dos cliques');
  for(const text of ['CLIQUE-ENVIAR','CLIQUE-CONFERIR','CLIQUE-PARAR','CLIQUE-OK','CLIQUE-PROMPT','CLIQUE-SALVAR']){
  await page.locator(`#messages label:has-text("${text}")`).first().click({timeout:5000});
  await page.waitForTimeout(300);// espera fixa: a ativação do controle seria síncrona ao clique
 }
 await page.waitForTimeout(2500);// espera fixa: o envio e a captura assíncronos teriam pintado a fala e o anexo
 const facts=await page.evaluate(()=>({
  users:[...document.querySelectorAll('#messages .message.user .body')].map(el=>el.textContent.trim()),
  attachments:[...document.querySelectorAll('#attachments .attachment')].map(el=>el.textContent.trim().slice(0,60)),
  attachmentsHidden:document.querySelector('#attachments')?.hidden,
  active:document.activeElement?.id||document.activeElement?.tagName,
  piOpen:document.querySelector('#pi-dialog')?.open??null,
  linkOpen:document.querySelector('body > #link-dialog')?.open??null,
  composer:document.querySelector('#composer #prompt')?.value,
 }));
 assert.deepEqual(facts.users,['oi'],`o rascunho foi enviado pelo rótulo: ${JSON.stringify(facts.users)}`);
 assert.deepEqual(facts.attachments,[],`o conferir capturou pelo rótulo: ${JSON.stringify(facts.attachments)}`);
 assert.equal(facts.attachmentsHidden,true,'o painel de anexos abriu pelo rótulo');
 assert.notEqual(facts.active,'prompt',`o rótulo roubou o foco para o composer: ${facts.active}`);
 assert.equal(facts.piOpen,false,'o rótulo abriu o diálogo');
 assert.equal(facts.linkOpen,false,'o rótulo abriu o diálogo de link');
 assert.equal(facts.composer,REAL_QUESTION,`o rascunho mudou com os cliques: ${JSON.stringify(facts.composer)}`);
});

/* URL relativa e cerca hostil na janela: `src`/`href` relativo perde o
   atributo (sem pedido ao arquivo), a cerca colada ganha prefixo e a `class`
   da casa não vira overlay. */
await withArtifacts('chat-model-file-fence',async ctx=>{
 const runtime=ctx.runtime=newRuntime('chat-model-file-fence');
 const course=seedCourse(runtime,'calc');
 writeConfigJson(runtime,{runtimePath:runtime,vaultPath:runtime,courses:[{id:'calc',name:'Cálculo I',path:course}]});
 const marker=path.join(runtime,'marker.png');
 fs.writeFileSync(marker,Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==','base64'));
 const deskDir=path.resolve('..');
 const rel=path.relative(deskDir,marker).split(path.sep).join('/');
 const evil=[
  `IMG relativo <img src="${rel}" alt="REL-IMG" width="8" height="8"> fim.`,
  `LINK relativo <a href="${rel}">REL-LINK</a> fim.`,
  `<table background="${rel}"><tr><td>REL-TABELA</td></tr></table>`,
  `<video poster="${rel}" width="8" height="8"></video>`,
  'Achado A: cerca com id colado.',
  '```svg',
  '<svg viewBox="0 0 10 10"><rect x="a"id="prompt" width="10" height="10" fill="red"/></svg>',
  '```',
  'Achado B: classe da casa.',
  '```svg',
  '<svg class="palette-backdrop" viewBox="0 0 100 30"><text x="10" y="20" fill="black">SESSAO</text></svg>',
  '```',
  'Achado C: image-set com arquivo.',
  '```svg',
  `<svg viewBox="0 0 10 10" style='background-image:image-set("file://${marker}" 1x)'><rect width="10" height="10"/></svg>`,
  '```',
  'Fim.',
 ].join('\n\n');
 const session=seedNativeSession(runtime,[
  {role:'user',content:[{type:'text',text:'oi'}]},
  {role:'assistant',content:[{type:'text',text:evil}]},
 ],{courseId:'calc',started:Date.now()-3600000,preview:'oi'});
 writeDeskJson(runtime,{courseId:'calc',session,courseStates:{calc:{session,sessions:[{path:session,started:Date.now()-3600000}],pdfs:[],study:{title:'',xopp:''}}}});
 const app=ctx.app=await launchDesk({runtime,env:{FAKE_OPENCODE_REPLY:'ok'}});
 const page=await app.firstWindow();
 await statusOnline(page);
 await page.waitForSelector('#messages .message.assistant',{timeout:30000});
 await page.waitForTimeout(2500);// espera fixa: o pedido ao arquivo teria chegado
 const facts=await page.evaluate(()=>{
  const body=document.querySelector('#messages .message.assistant .body');
  const hitAt=(x,y)=>{const el=document.elementFromPoint(x,y);return el?(el.id||el.className?.baseVal||el.className||el.tagName):null;};
  const relImg=body.querySelector('img[alt="REL-IMG"]');
  const relLink=[...body.querySelectorAll('a')].find(a=>a.textContent.includes('REL-LINK'));
  return {
   promptCount:document.querySelectorAll('#prompt').length,
   imgSrc:relImg?relImg.getAttribute('src'):'sem-img',
   imgWidth:relImg?relImg.naturalWidth:-1,
   linkHref:relLink?relLink.getAttribute('href'):'sem-link',
   tableBg:body.querySelector('table')?body.querySelector('table').getAttribute('background'):'sem-tabela',
   videoPoster:body.querySelector('video')?body.querySelector('video').getAttribute('poster'):'sem-video',
   svgClasses:[...body.querySelectorAll('svg')].map(svg=>svg.getAttribute('class')),
   svgStyles:[...body.querySelectorAll('svg')].map(svg=>svg.getAttribute('style')),
   svgBg:[...body.querySelectorAll('svg')].map(svg=>getComputedStyle(svg).backgroundImage),
   coversHeader:hitAt(innerWidth-10,10),
  };
 });
 assert.equal(facts.promptCount,1,'um #prompt só: o do composer');
 assert.equal(facts.imgSrc,null,`src relativo passou: ${JSON.stringify(facts.imgSrc)}`);
 assert.equal(facts.imgWidth,0,`a imagem relativa carregou: ${facts.imgWidth}`);
 assert.equal(facts.linkHref,null,`href relativo passou: ${JSON.stringify(facts.linkHref)}`);
 assert.equal(facts.tableBg,null,`background da tabela passou: ${JSON.stringify(facts.tableBg)}`);
 assert.equal(facts.videoPoster,null,`poster do vídeo passou: ${JSON.stringify(facts.videoPoster)}`);
 assert.ok(facts.svgClasses.every(cls=>cls===null||!cls.includes('palette-backdrop')),'a classe da casa virou overlay');
 assert.ok(facts.svgStyles.every(style=>style===null||!/image-set|url\(/i.test(style)),`image-set passou: ${JSON.stringify(facts.svgStyles)}`);
 assert.ok(facts.svgBg.every(bg=>bg==='none'||!bg.includes('file:')),`fundo com arquivo aplicou: ${JSON.stringify(facts.svgBg)}`);
 assert.notEqual(facts.coversHeader,'palette-backdrop',`o cabeçalho foi coberto: ${facts.coversHeader}`);
});

/* `url(file://…)` no style: não sai pedido nenhum e o fundo não aplica. */
await withArtifacts('chat-model-cssread',async ctx=>{
 const runtime=ctx.runtime=newRuntime('chat-model-cssread');
 const course=seedCourse(runtime,'calc');
 writeConfigJson(runtime,{runtimePath:runtime,vaultPath:runtime,courses:[{id:'calc',name:'Cálculo I',path:course}]});
 const marker='segredo-janela-atar';
 const evil=`<div id="leak" style="background:url(file:///tmp/${marker}.png);width:80px;height:80px">CONTEUDO-VAZAMENTO</div>`;
 const session=seedNativeSession(runtime,[
  {role:'user',content:[{type:'text',text:'resuma'}]},
  {role:'assistant',content:[{type:'text',text:'resumo'+evil}]},
 ],{courseId:'calc',started:Date.now()-3600000,preview:'resuma'});
 writeDeskJson(runtime,{courseId:'calc',session,courseStates:{calc:{session,sessions:[{path:session,started:Date.now()-3600000}],pdfs:[],study:{title:'',xopp:''}}}});
 const app=ctx.app=await launchDesk({runtime,env:{FAKE_OPENCODE_REPLY:'ok'}});
 const page=await app.firstWindow();
 const requests=[];
 page.on('request',req=>{if(req.url().includes(marker))requests.push(req.url());});
 await statusOnline(page);
 await page.waitForSelector('.message.assistant',{timeout:30000});
 await page.waitForTimeout(2500);// espera fixa: o pedido ao arquivo teria chegado
 const facts=await page.evaluate(()=>{
  const el=[...document.querySelectorAll('#messages .message.assistant .body div')].find(node=>node.textContent.includes('CONTEUDO-VAZAMENTO'));
  return {found:!!el,style:el?.getAttribute('style')??null,backgroundImage:el?getComputedStyle(el).backgroundImage:null};
 });
 assert.deepEqual(requests,[],`nenhum pedido ao arquivo: ${JSON.stringify(requests)}`);
 assert.equal(facts.style,null,`style com url(file://…) saiu: ${JSON.stringify(facts.style)}`);
 assert.equal(facts.backgroundImage,'none',`fundo não aplicou: ${facts.backgroundImage}`);
});

/* Prévia viva do Livre com material hostil: a faixa entra com `id`/`class`
   sob prefixo — sem clobber de `#prompt`, sem overlay `fixed`, sem
   `url(file://…)` e sem `for` que ative o controle da janela. */
await withArtifacts('chat-model-pdfpreview',async ctx=>{
 const runtime=ctx.runtime=newRuntime('chat-model-pdfpreview');
 fs.writeFileSync(path.join(runtime,'config.json'),JSON.stringify({runtimePath:runtime,vaultPath:runtime,courses:[]}));
 const marker=path.join(os.tmpdir(),`mesa-preview-${process.pid}.png`);
 fs.writeFileSync(marker,Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==','base64'));
 const md=[
  '# Material hostil sintético',
  '',
  '<div id="prompt" style="display:none">FAKE-PROMPT-PDF</div>',
  '',
  '<div id="overlay-pdf" style="position:fixed;inset:0;z-index:99999;background:#fff">TELA FALSA PDF</div>',
  '',
  `<div id="bg-file" style="width:40px;height:40px;background-image:url(file://${marker})">BG-FILE</div>`,
  '',
  '<div id="bg-remote" style="width:40px;height:40px;background-image:url(https://evil.exemplo/bg.png)">BG-REMOTE</div>',
  '',
  `<div id="bg-imageset" style='width:40px;height:40px;background-image:image-set("file://${marker}" 1x)'>BG-IMAGESET</div>`,
  '',
  `<table background="file://${marker}"><tr><td>TABELA-BG</td></tr></table>`,
  '',
  '<div id="free-pdf-status">FAKE-STATUS</div>',
  '',
  '<div id="free-pdf-save">FAKE-SAVE</div>',
  '',
  '<label for="send">CLIQUE-ENVIAR-PDF</label>',
  '',
  '<a href="https://exemplo.com/x">LINK-PDF</a>',
  '',
  'Fim do material.',
 ].join('\n');
 const app=ctx.app=await launchDesk({runtime,env:{FAKE_OPENCODE_REPLY:'ok'}});
 const page=await app.firstWindow();
 await enterFree(page);
 await freeMenuClick(page,'#free-generate-pdf');
 await page.waitForSelector('#free-pdf-dialog[open]',{timeout:10000});
 await page.fill('#free-pdf-content',md);
 await page.waitForTimeout(2500);// espera fixa: a prévia renderizar
 const facts=await page.evaluate(()=>{
  const box=document.querySelector('#free-pdf-preview');
  const hitAt=(x,y)=>{const el=document.elementFromPoint(x,y);return el?(el.id||el.className||el.tagName):null;};
  const overlay=[...box.querySelectorAll('div')].find(el=>el.textContent.includes('TELA FALSA PDF'));
  const bgFile=[...box.querySelectorAll('div')].find(el=>el.textContent.includes('BG-FILE'));
  const bgRemote=[...box.querySelectorAll('div')].find(el=>el.textContent.includes('BG-REMOTE'));
  const bgImageSet=[...box.querySelectorAll('div')].find(el=>el.textContent.includes('BG-IMAGESET'));
  return {
   previewHtml:box.innerHTML.slice(0,3000),
   promptCount:document.querySelectorAll('#prompt').length,
   statusCount:document.querySelectorAll('#free-pdf-status').length,
   saveCount:document.querySelectorAll('#free-pdf-save').length,
   dialogCount:box.querySelectorAll('#link-dialog').length,
   prefixedStatus:box.querySelectorAll('[id$="-free-pdf-status"]').length,
   prefixedPrompt:box.querySelectorAll('[id$="-prompt"]').length,
   fors:[...box.querySelectorAll('label')].map(label=>label.getAttribute('for')),
   overlayStyle:overlay?.getAttribute('style')??null,
   overlayPosition:overlay?getComputedStyle(overlay).position:null,
   coversHeader:hitAt(innerWidth-10,10),
   bgFileStyle:bgFile?.getAttribute('style')??null,
   bgFileBg:bgFile?getComputedStyle(bgFile).backgroundImage:null,
   bgRemoteBg:bgRemote?getComputedStyle(bgRemote).backgroundImage:null,
   bgImageSetStyle:bgImageSet?.getAttribute('style')??null,
   tableBg:box.querySelector('table')?.getAttribute('background')??null,
   hasLink:box.querySelector('a[href="https://exemplo.com/x"]')!==null,
   hasEnd:box.textContent.includes('Fim do material.'),
  };
 });
 try{fs.rmSync(marker,{force:true});}catch{/* sintético */}
 assert.equal(facts.promptCount,1,'um #prompt só: o do composer');
 assert.equal(facts.statusCount,1,'um #free-pdf-status só: o real');
 assert.equal(facts.saveCount,1,'um #free-pdf-save só: o real');
 assert.equal(facts.dialogCount,0,'a prévia plantou #link-dialog');
 assert.ok(facts.prefixedStatus>=1,'o id do modelo na prévia perdeu o prefixo em vez de ganhá-lo');
 assert.ok(facts.prefixedPrompt>=1,'o #prompt do modelo na prévia perdeu o prefixo em vez de ganhá-lo');
 assert.deepEqual(facts.fors.filter(Boolean),[],`sobrou for na prévia: ${JSON.stringify(facts.fors)}`);
 assert.ok(!facts.overlayStyle||!/position\s*:/i.test(facts.overlayStyle),`position passou na prévia: ${JSON.stringify(facts.overlayStyle)}`);
 assert.notEqual(facts.overlayPosition,'fixed',`overlay fixed na prévia: ${facts.overlayPosition}`);
 assert.notEqual(facts.coversHeader,'overlay-pdf',`a prévia cobre o cabeçalho: ${facts.coversHeader}`);
 assert.ok(!facts.bgFileStyle||!facts.bgFileStyle.includes('file:'),`url(file://…) na prévia: ${JSON.stringify(facts.bgFileStyle)}`);
 assert.equal(facts.bgFileBg,'none',`fundo com arquivo aplicou na prévia: ${facts.bgFileBg}`);
 assert.equal(facts.bgRemoteBg,'none',`fundo remoto aplicou na prévia (a CSP barra): ${facts.bgRemoteBg}`);
 assert.ok(!facts.bgImageSetStyle||!facts.bgImageSetStyle.includes('image-set'),`image-set na prévia: ${JSON.stringify(facts.bgImageSetStyle)}`);
 assert.ok(!facts.previewHtml.includes('.png'),`caminho do arquivo vazou na prévia: ${facts.previewHtml.slice(0,400)}`);
 assert.equal(facts.tableBg,null,`background da tabela passou na prévia: ${JSON.stringify(facts.tableBg)}`);
 assert.equal(facts.hasLink,true,'o link honesto sumiu da prévia');
 assert.equal(facts.hasEnd,true,'o texto honesto sumiu da prévia');
});
