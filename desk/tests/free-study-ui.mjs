/* Teste real do renderer Livre e loadCourse, com APIs livres simuladas.
   Runtime, userData e PDFs sintéticos; não acessa o app instalado.
   A integração IPC/provider real é validada em testes separados. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {launchDesk,seedCourse,writeConfigJson,writeDeskJson,tinyPdf,withArtifacts} from './helpers.mjs';

/* Runtime sintético em /tmp antes do `app.whenReady` (o main deriva o userData
   dele quando LEARNING_DESK_RUNTIME aponta para cá); o PDF sintético vive na
   pasta da matéria de teste — é o caminho que o host autoriza no boot, e é o
   que a sessão livre reusa pela ponte, como o root fará com a biblioteca da
   sessão de verdade. */
const runtime=fs.mkdtempSync(path.join(os.tmpdir(),'free-study-ui-'));
const course=seedCourse(runtime,'Mesa');
const pdfPath=path.join(course,'sessao-sintetica.pdf');
fs.writeFileSync(pdfPath,tinyPdf('Sessao livre sintetica'));
const panels=[{label:'Enunciado',prefer:[],toggle:''},{label:'Formulário',prefer:[],toggle:'Formulário'}];
writeConfigJson(runtime,{runtimePath:runtime,vaultPath:runtime,courses:[{id:'Mesa',name:'Mesa',path:course}],desk:{title:'Mesa teste',panels}});
writeDeskJson(runtime,{courseId:'Mesa'});

function assertInside(label,rect,width,height){
 assert.ok(rect.top>=-1&&rect.left>=-1&&rect.bottom<=height+1&&rect.right<=width+1,`${label} dentro da janela (${JSON.stringify(rect)} em ${width}x${height})`);
}

await withArtifacts('free-study-ui',async ctx=>{
 ctx.runtime=runtime;
 const app=await launchDesk({runtime});
 ctx.app=app;
 const page=await app.firstWindow();
 const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.waitForSelector('.pdf-panel');
 await page.waitForTimeout(300);

 /* ---------- mesa normal: nada da aba Livre aparece ---------- */
 assert.equal(await page.locator('#free-bar').isHidden(),true,'barra Livre escondida na matéria');
 assert.equal(await page.locator('#free-empty').isHidden(),true,'vazio Livre escondido na matéria');
 assert.equal(await page.locator('main').evaluate(el=>el.classList.contains('workspace-free')),false,'main sem a marca Livre');
 assert.equal(await page.locator('#pdf-grid').isVisible(),true,'grade de leitores normal visível');
 /* O PDF sintético está na pasta da matéria: o leitor normal o abre pela
    preferência de sempre — comportamento intocado, e o caminho fica autorizado
    no host (o que a sessão livre reusa depois pela ponte). */
 await page.waitForFunction(()=>[...document.querySelectorAll('.pdf-panel .pdf-select')].some(select=>select.value),undefined,{timeout:20000});
 const normalPdf=await page.evaluate(()=>document.querySelector('.pdf-panel .pdf-select')?.value||'');
 assert.equal(normalPdf,pdfPath,'a matéria normal abre o PDF semeado (caminho autorizado no host)');

 /* ---------- helpers do teste: payload e o mesmo caminho do root ---------- */
 await page.evaluate(()=>{
  window.__freeCalls=[];
  window.__freeBase=null;
  window.__freePayload=(over={})=>({
   state:{...(over.state||{})},
   config:over.config,
   library:over.library||[],
   course:over.course||'Livre',
   courseId:over.courseId||'mesa-free',
   courses:over.courses||[{id:'Mesa',name:'Mesa'},{id:'mesa-free',name:'Livre'}],
   preferred:[],pending:over.pending||{items:[]},resume:null,bookmarks:[],review:[],messages:[],
   workspace:{kind:'free',id:'mesa-free',title:'Sessão sintética',materials:[],...(over.workspace||{})},
   session:over.session||'pi-livre-1.jsonl',
   sessions:over.sessions||[{label:'Livre 1',path:'pi-livre-1.jsonl'}],
   captureAvailable:false,detectedPi:'',platform:'darwin',deskVersion:'0.0.0-test',
  });
  window.__dispatchWorkspace=data=>window.dispatchEvent(new CustomEvent('desk-workspace',{detail:data}));
  /* loadCourse publica o workspace; nenhuma emissão manual substitui a
     integração do renderer. Só as respostas das APIs livres são simuladas. */
  window.__applyWorkspace=async data=>{
   const state=await import('./src/state.mjs');
   await state.loadCourse(data);
  };
  /* Payload completo com o config real da mesa (como o host devolverá). */
  window.__freeData=async(over={})=>{
   const info=await window.desk.getConfig();
   const data=window.__freePayload({config:info.config,...over});
   window.__freeBase=data;
   return data;
  };
 });

 /* ---------- sessão livre sem PDF (mesmo caminho do root) ---------- */
 await page.evaluate(()=>window.__applyWorkspace(window.__freePayload()));
 await page.waitForFunction(()=>!document.querySelector('#free-bar').hidden);
 assert.equal(await page.locator('#free-title').inputValue(),'Sessão sintética','título da sessão no campo');
 assert.equal(await page.evaluate(async()=>{const {S}=await import('./src/state.mjs');return S.workspace.kind;}),'free','loadCourse hidrata o workspace livre');
 assert.equal(await page.locator('#course-tabs button[data-id="mesa-free"]').count(),1,'evento de loadCourse publica as abas');
 assert.equal(await page.locator('#free-materials').isDisabled(),true,'sem materiais o seletor fica desabilitado');
 assert.match(await page.locator('#free-materials option').first().textContent(),/Nenhum material/);
 assert.equal(await page.locator('#references').evaluate(el=>el.classList.contains('free-empty')),true,'sem PDF a sessão entra no vazio');
 assert.equal(await page.locator('#free-empty').isVisible(),true,'texto orientado visível');
 assert.equal(await page.locator('#pdf-grid').isHidden(),true,'leitores escondidos no vazio');
 assert.equal(await page.locator('#support-bar').isHidden(),true,'área de apoio escondida no vazio');
 assert.equal(await page.evaluate(()=>[...document.querySelectorAll('.pdf-panel .pdf-select')].filter(select=>select.value).length),0,'a sessão livre recomeça sem PDF');
 const emptySidebar=await page.locator('#sidebar').evaluate(el=>el.getBoundingClientRect().width);
 assert.ok(emptySidebar>=320,`no vazio a conversa ocupa espaço útil (${emptySidebar}px)`);

 /* ---------- abrir PDF pela ponte do contrato ---------- */
 await page.evaluate(pdf=>{
  window.deskFreeBridge={
   freeOpenPdf:async()=>{
    window.__freeCalls.push({api:'freeOpenPdf'});
    return window.__freeData({
     library:[{path:pdf,name:'sessao-sintetica.pdf'}],
     state:{pdfs:[{path:pdf,page:1,zoom:1}]},
     workspace:{materials:[{id:'m1',name:'sessao-sintetica.pdf',path:pdf,kind:'pdf'}]},
    });
   },
  };
 },pdfPath);
 await page.locator('#free-empty-open').click();
 await page.waitForFunction(()=>{
  const references=document.querySelector('#references');
  return references.classList.contains('workspace-free')&&!references.classList.contains('free-empty');
 },undefined,{timeout:20000});
 assert.equal(await page.evaluate(()=>window.__freeCalls.filter(call=>call.api==='freeOpenPdf').length),1,'freeOpenPdf chamado uma vez');
 assert.equal(await page.locator('#free-materials').isEnabled(),true,'material listado habilita o seletor');
 assert.deepEqual(await page.evaluate(()=>[...document.querySelectorAll('#free-materials option')].map(option=>option.textContent)),['Abrir um material…','sessao-sintetica.pdf']);
 assert.equal(await page.locator('#free-empty').isHidden(),true,'PDF aberto sai do vazio');
 /* Largura útil: o leitor saiu do `display:none` do vazio e precisa renderizar na
    largura real da coluna (o observador de tamanho re-renderiza). */
 await page.waitForFunction(()=>{
  const canvas=document.querySelector('#pdf-grid .pdf-page[data-rendered] canvas');
  return !!canvas&&canvas.getBoundingClientRect().width>100;
 },undefined,{timeout:30000});
 const pageWidth=await page.evaluate(()=>document.querySelector('#pdf-grid .pdf-page[data-rendered]').getBoundingClientRect().width);
 assert.ok(pageWidth>100,`página do PDF com largura útil (${pageWidth}px)`);
 /* Selecionar o material no cabeçalho reusa o leitor normal (mesmo caminho do
    "Abrir um material…"). */
 await page.selectOption('#free-materials',pdfPath);
 await page.waitForFunction(p=>document.querySelector('#pdf-grid .pdf-select')?.value===p,pdfPath,{timeout:10000});

 /* Payload sem histórico é uma atualização parcial da conversa Pi; uma
    lista vazia explícita é autoritativa e limpa o histórico anterior. */
 await page.evaluate(async()=>{
  const {showHistory}=await import('./src/chat.mjs');
  showHistory([{role:'assistant',content:[{type:'text',text:'Marcador de histórico'}]}]);
  const data=await window.__freeData({library:window.__freeBase.library,state:window.__freeBase.state,workspace:window.__freeBase.workspace});
  delete data.messages;
  await window.__applyWorkspace(data);
 });
 assert.match(await page.locator('#messages').textContent(),/Marcador de histórico/,'atualização sem histórico preserva a conversa corrente');
 await page.evaluate(()=>window.__applyWorkspace({...window.__freeBase,messages:[]}));
 assert.equal(await page.locator('#messages .message').count(),0,'histórico vazio explícito limpa a conversa anterior');

 /* Fila guardada da sessão: o initialData completo repõe o `pending` sem
    enviar nada sozinho (mesma regra da Mesa normal, sem autosend). */
 await page.evaluate(async()=>{
  const data=await window.__freeData({pending:{items:[{id:'q-livre',text:'rascunho na fila'}],held:true},state:window.__freeBase.state,library:window.__freeBase.library,workspace:window.__freeBase.workspace});
  await window.__applyWorkspace(data);
 });
 await page.waitForFunction(()=>!!document.querySelector('#composer .queue-strip'),undefined,{timeout:10000});
 assert.deepEqual(await page.evaluate(()=>[...document.querySelectorAll('.queue-item span')].map(span=>span.textContent)),['rascunho na fila'],'pending do initialData repõe a fila da sessão');
 await page.waitForTimeout(800);
 assert.equal(await page.locator('#messages .message.user').count(),0,'fila adotada não envia sozinha');
 assert.equal(await page.evaluate(async()=>{const {S}=await import('./src/state.mjs');return S.busy;}),false,'fila adotada não abre turno');

 /* ---------- gerar PDF: prévia, erro inline e salvar ---------- */
 await page.locator('#free-generate-pdf').click();
 await page.waitForSelector('#free-pdf-dialog[open]');
 assert.equal(await page.locator('#free-pdf-source').isDisabled(),true,'sem resposta a origem fica desabilitada');
 assert.equal(await page.locator('#free-pdf-content').inputValue(),'','sessão sem resposta começa em branco para colar');
 await page.keyboard.press('Escape');
 await page.waitForFunction(()=>!document.querySelector('#free-pdf-dialog').open);
 /* Respostas do assistente: a origem é o texto CRU do chat (`_raw`), nunca o
    DOM com KaTeX; resposta em andamento (`typing`) fica fora. */
 await page.evaluate(()=>{
  const host=document.querySelector('#messages');
  const add=(raw,typing)=>{
   const element=document.createElement('article');
   element.className='message assistant'+(typing?' typing':'');
   element.dataset.fake='free-test';
   element._raw=raw;
   const body=document.createElement('div');body.className='body';body.textContent=raw;
   element.append(body);host.append(element);
  };
  add('# Primeira\n\nFórmula $x$ no texto');
  add('Segunda resposta com $y^2$');
  add('Em andamento, não entra','typing');
 });
 await page.locator('#free-generate-pdf').click();
 await page.waitForSelector('#free-pdf-dialog[open]');
 assert.equal(await page.locator('#free-pdf-source').isEnabled(),true,'respostas habilitam a origem');
 assert.equal(await page.locator('#free-pdf-source option').count(),2,'só respostas concluídas entram na origem');
 assert.match(await page.locator('#free-pdf-source option').first().textContent(),/^Resposta 1/);
 assert.equal(await page.locator('#free-pdf-content').inputValue(),'Segunda resposta com $y^2$','origem padrão é a última resposta');
 await page.selectOption('#free-pdf-source','0');
 assert.equal(await page.locator('#free-pdf-content').inputValue(),'# Primeira\n\nFórmula $x$ no texto','trocar a origem recarrega o texto cru');
 await page.keyboard.press('Escape');
 await page.waitForFunction(()=>!document.querySelector('#free-pdf-dialog').open);
 await page.evaluate(()=>{for(const element of document.querySelectorAll('#messages article[data-fake="free-test"]'))element.remove();});
 await page.locator('#free-generate-pdf').click();
 await page.waitForSelector('#free-pdf-dialog[open]');
 assert.equal(await page.locator('#free-pdf-source').isDisabled(),true,'sem respostas a origem volta a ficar desabilitada');
 await page.locator('#free-pdf-title').fill('Resumo sintético');
 const source='# Título\n\nFórmula: $x^2+1$\n\n- um\n- dois';
 await page.locator('#free-pdf-content').fill(source);
 await page.waitForFunction(()=>!!document.querySelector('#free-pdf-preview .katex'),undefined,{timeout:8000});
 await page.evaluate(()=>{
  window.__freeCalls=[];
  window.deskFreeBridge.freeSaveMaterial=async()=>{window.__freeCalls.push({api:'freeSaveMaterial'});throw new Error('Falha sintética ao gravar');};
 });
 /* Ocupado: a UI recusa antes de chamar o host (o host revalida depois). */
 await page.evaluate(async()=>{const m=await import('./src/state.mjs');m.S.busy=true;});
 await page.locator('#free-pdf-save').click();
 await page.waitForFunction(()=>{
  const error=document.querySelector('#free-pdf-error');
  return error&&!error.hidden&&/Espere/.test(error.textContent);
 });
 assert.equal(await page.evaluate(()=>window.__freeCalls.length),0,'ocupado não chama o host');
 await page.evaluate(async()=>{const m=await import('./src/state.mjs');m.S.busy=false;});
 await page.locator('#free-pdf-save').click();
 await page.waitForFunction(()=>{
  const error=document.querySelector('#free-pdf-error');
  return error&&!error.hidden&&/Falha sintética/.test(error.textContent);
 });
 assert.equal(await page.locator('#free-pdf-dialog').evaluate(dialog=>dialog.open),true,'erro mantém o diálogo aberto');
 assert.equal(await page.locator('#free-pdf-content').inputValue(),source,'erro preserva o conteúdo');
 assert.equal(await page.locator('#free-pdf-save').isEnabled(),true,'salvar volta após o erro');
 /* Ponte com sucesso: o payload devolvido é initialData completo (loadCourse real). */
 await page.evaluate(pdf=>{
  window.__freeCalls=[];
  window.deskFreeBridge.freeSaveMaterial=async payload=>{
   window.__freeCalls.push({api:'freeSaveMaterial',payload});
   const data=await window.__freeData({
    library:[{path:pdf,name:'sessao-sintetica.pdf'}],
    state:{pdfs:[{path:pdf,page:1,zoom:1}]},
    workspace:{materials:[
     {id:'m1',name:'sessao-sintetica.pdf',path:pdf,kind:'pdf'},
     {id:'gerado-1',name:payload.title,path:'/tmp/gerado-sintetico.pdf',kind:'pdf'},
    ]},
   });
   return {saved:true,material:{id:'gerado-1',name:payload.title,path:'/tmp/gerado-sintetico.pdf',kind:'pdf'},data};
  };
 },pdfPath);
 await page.locator('#free-pdf-save').click();
 await page.waitForFunction(()=>!document.querySelector('#free-pdf-dialog').open,undefined,{timeout:20000});
 await page.waitForFunction(()=>[...document.querySelectorAll('#free-materials option')].some(option=>option.textContent==='Resumo sintético'));
 const saved=await page.evaluate(()=>window.__freeCalls.find(call=>call.api==='freeSaveMaterial'));
 assert.equal(saved.payload.title,'Resumo sintético','título enviado ao host');
 assert.match(saved.payload.markdown,/x\^2\+1/,'Markdown/LaTeX cru enviado sem serializar o DOM');

 /* ---------- cancelar, Esc e Enter: teclado sem chamar o host à toa ---------- */
 const savedCalls=()=>page.evaluate(()=>window.__freeCalls.filter(call=>call.api==='freeSaveMaterial').length);
 const before=await savedCalls();
 await page.locator('#free-generate-pdf').click();
 await page.waitForSelector('#free-pdf-dialog[open]');
 await page.locator('#free-pdf-dialog button[value="cancel"]').last().click();
 await page.waitForFunction(()=>!document.querySelector('#free-pdf-dialog').open);
 assert.equal(await savedCalls(),before,'cancelar não salva nada');
 /* O diálogo nativo devolve o foco ao gatilho; a sessão livre não sequestra o
    teclado depois de fechar. */
 assert.equal(await page.evaluate(()=>document.activeElement&&document.activeElement.id),'free-generate-pdf','Cancelar devolve o foco ao botão que abriu');
 await page.locator('#free-generate-pdf').click();
 await page.waitForSelector('#free-pdf-dialog[open]');
 await page.keyboard.press('Escape');
 await page.waitForFunction(()=>!document.querySelector('#free-pdf-dialog').open);
 assert.equal(await savedCalls(),before,'Esc não salva nada');
 assert.equal(await page.evaluate(()=>document.activeElement&&document.activeElement.id),'free-generate-pdf','Esc devolve o foco ao botão que abriu');
 /* O botão `×` é o primeiro submit do formulário: Enter no título precisa
    confirmar a ação principal, não fechar. */
 await page.locator('#free-generate-pdf').click();
 await page.waitForSelector('#free-pdf-dialog[open]');
 await page.locator('#free-pdf-title').fill('PDF por teclado');
 await page.locator('#free-pdf-content').fill('conteúdo por teclado');
 await page.locator('#free-pdf-title').press('Enter');
 await page.waitForFunction(()=>!document.querySelector('#free-pdf-dialog').open,undefined,{timeout:20000});
 assert.equal(await savedCalls(),before+1,'Enter no título salva');
 const keySaved=await page.evaluate(()=>window.__freeCalls.filter(call=>call.api==='freeSaveMaterial').at(-1));
 assert.equal(keySaved.payload.title,'PDF por teclado','título confirmado por teclado');

 /* ---------- renomear a sessão ---------- */
 /* Controle negativo: ação que mantém o escopo (renomear) não anuncia troca de
    conversa — o evento é o seam do chat lateral/avisos. */
 await page.evaluate(()=>{
  window.__freeCalls=[];
  window.__convEvents=0;
  window.addEventListener('desk-conversation-changed',()=>{window.__convEvents++;});
  window.deskFreeBridge.freeRename=async({title})=>{
   window.__freeCalls.push({api:'freeRename',title});
   return window.__freeData({workspace:{...(window.__freeBase.workspace||{}),title}});
  };
 });
 await page.locator('#free-title').fill('Sessão renomeada');
 await page.locator('#free-title').press('Enter');
 await page.waitForFunction(()=>window.__freeCalls.some(call=>call.api==='freeRename'),undefined,{timeout:10000});
 assert.equal((await page.evaluate(()=>window.__freeCalls.find(call=>call.api==='freeRename'))).title,'Sessão renomeada');
 assert.equal(await page.locator('#free-title').inputValue(),'Sessão renomeada');
 await page.waitForFunction(()=>!document.querySelector('#free-title').disabled);
 assert.equal(await page.evaluate(()=>window.__convEvents),0,'renomear (mesmo escopo) não anuncia troca de conversa');

 /* ---------- criar matéria: cancelar (Enter) e confirmar ---------- */
 await page.locator('#free-promote').click();
 await page.waitForSelector('#free-promote-dialog[open]');
 assert.equal(await page.locator('#free-promote-session').textContent(),'Sessão renomeada','prévia mostra a conversa');
 assert.match(await page.locator('#free-promote-materials').textContent(),/sessao-sintetica\.pdf/,'prévia lista os materiais');
 await page.locator('#free-promote-name').fill('Matéria Nova');
 await page.evaluate(()=>{window.deskFreeBridge.freePromote=async()=>({cancelled:true});});
 await page.locator('#free-promote-name').press('Enter');
 await page.waitForFunction(()=>{
  const error=document.querySelector('#free-promote-error');
  return error&&!error.hidden&&/cancelada/.test(error.textContent);
 });
 assert.equal(await page.locator('#free-promote-dialog').evaluate(dialog=>dialog.open),true,'cancelar a pasta mantém o diálogo para tentar de novo');
 assert.equal(await page.locator('#free-promote-name').inputValue(),'Matéria Nova','cancelar preserva o nome digitado');
 await page.evaluate(()=>{
  window.__freeCalls=[];
  window.deskFreeBridge.freePromote=async({name})=>{
   window.__freeCalls.push({api:'freePromote',name});
   return {created:true,course:{id:'materia-nova',name},data:window.__freePayload({state:{},course:name,courseId:'materia-nova',courses:[{id:'Mesa',name:'Mesa'},{id:'mesa-free',name:'Livre'},{id:'materia-nova',name}],workspace:{kind:'course',id:'materia-nova',title:name}})};
  };
 });
 /* A promoção troca cwd/curso e o host fecha o processo antigo: registrar cada
    transição de S.connected prova o reset e a reconexão do escopo novo. */
 await page.evaluate(async()=>{
  const {S}=await import('./src/state.mjs');
  let value=!!S.connected;
  window.__connLog=[value];
  Object.defineProperty(S,'connected',{configurable:true,get(){return value;},set(next){value=!!next;window.__connLog.push(value);}});
  S.connected=true;
 });
 await page.locator('#free-promote-save').click();
 await page.waitForFunction(()=>!document.querySelector('#free-promote-dialog').open,undefined,{timeout:20000});
 await page.waitForFunction(()=>document.querySelector('#free-bar').hidden);
 assert.equal(await page.locator('#free-bar').isHidden(),true,'matéria criada deixa de ser Livre');
 assert.equal(await page.locator('#course-tabs button[data-id="materia-nova"]').count(),1,'matéria criada entra imediatamente nas abas');
 assert.equal(await page.locator('#course-tabs button[data-id="materia-nova"]').evaluate(el=>el.classList.contains('active')),true,'nova matéria é a aba ativa');
 assert.equal(await page.evaluate(async()=>{const {S}=await import('./src/state.mjs');return S.workspace.kind;}),'course','estado hidrata a nova matéria');
 assert.deepEqual(await page.evaluate(()=>window.__freeCalls),[{api:'freePromote',name:'Matéria Nova'}]);
 /* Processo antigo morto pela troca de cwd: a UI não pode continuar "conectada"
    nele e precisa tentar a conexão do novo escopo (mesmo caminho do
    `switchCourse`, preservando o histórico transferido). */
 await page.waitForFunction(()=>window.__connLog.includes(false),undefined,{timeout:10000});
 await page.waitForFunction(()=>window.__connLog.at(-1)===true,undefined,{timeout:20000});
 const connLog=await page.evaluate(()=>window.__connLog);
 assert.ok(connLog.length>=3&&connLog.includes(false)&&connLog.at(-1)===true,`promoção reseta a conexão antiga e reconecta (${connLog.join('>')})`);

 /* ---------- guarda de geração: resultado atrasado não pinta outro escopo ---------- */
 await page.evaluate(()=>window.__applyWorkspace(window.__freePayload({state:{},workspace:{title:'Sessão guarda'}})));
 await page.waitForFunction(()=>!document.querySelector('#free-bar').hidden);
 await page.evaluate(()=>{
  window.__resolveSave=null;
  window.deskFreeBridge.freeSaveMaterial=()=>new Promise(resolve=>{
   window.__resolveSave=()=>resolve({saved:true,material:{id:'x',name:'x'},data:window.__freePayload({state:{},workspace:{kind:'free',title:'Tarde demais'}})});
  });
 });
 await page.locator('#free-generate-pdf').click();
 await page.locator('#free-pdf-title').fill('Tarde demais');
 await page.locator('#free-pdf-content').fill('conteúdo atrasado');
 await page.locator('#free-pdf-save').click();
 await page.waitForFunction(()=>typeof window.__resolveSave==='function');
 await page.evaluate(()=>window.__applyWorkspace(window.__freePayload({state:{},course:'Mesa',courseId:'Mesa',workspace:{kind:'course',id:'Mesa',title:'Mesa'}})));
 await page.waitForFunction(()=>document.querySelector('#free-bar').hidden);
 await page.evaluate(()=>window.__resolveSave());
 await page.waitForTimeout(400);
 assert.equal(await page.locator('#free-bar').isHidden(),true,'resultado atrasado não reabre a aba Livre');
 assert.equal(await page.locator('#free-pdf-dialog').evaluate(dialog=>dialog.open),false,'sair do Livre fecha o diálogo');

 /* ---------- host autoritativo: payload livre com matéria real ativa não pinta ---------- */
 await page.evaluate(()=>window.__dispatchWorkspace(window.__freePayload({state:{},workspace:{title:'Fora de hora'}})));
 await page.waitForTimeout(200);
 assert.equal(await page.locator('#free-bar').isHidden(),true,'payload livre sem troca real não reabre a aba');
 assert.equal(await page.locator('main').evaluate(el=>el.classList.contains('workspace-free')),false,'main continua sem a marca Livre');
 assert.equal(await page.locator('#pdf-grid').isVisible(),true,'grade normal continua visível');

 /* ---------- troca de curso com a MESMA sessão anuncia troca de conversa ---------- */
 const convDelta=await page.evaluate(async()=>{
  const state=await import('./src/state.mjs');
  let count=0;
  const listener=()=>{count++;};
  window.addEventListener('desk-conversation-changed',listener);
  await state.loadCourse(window.__freePayload({state:{},workspace:{kind:'free',title:'Sessão base'},session:'pi-mesma.jsonl'}));
  count=0;
  await state.loadCourse(window.__freePayload({state:{},course:'Mesa',courseId:'Mesa',workspace:{kind:'course',id:'Mesa',title:'Mesa'},session:'pi-mesma.jsonl'}));
  window.removeEventListener('desk-conversation-changed',listener);
  return count;
 });
 assert.equal(convDelta,1,'curso novo com a mesma sessão anuncia a troca uma vez (promoção/chat lateral)');

 /* ---------- ação atrasada da sessão livre A não invade a sessão livre B ---------- */
 await page.evaluate(pdf=>window.__applyWorkspace(window.__freePayload({state:{chatWidth:511},library:[{path:pdf,name:'sessao-sintetica.pdf'}],workspace:{kind:'free',title:'Sessão A'},session:'pi-livre-A.jsonl',sessions:[{label:'A',path:'pi-livre-A.jsonl'}]})),pdfPath);
 await page.waitForFunction(()=>document.querySelector('#free-title')?.value==='Sessão A');
 assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--chat').trim()),'511px','medida da sessão A aplicada');
 await page.evaluate(async()=>{
  const {showHistory}=await import('./src/chat.mjs');
  showHistory([{role:'assistant',content:[{type:'text',text:'Histórico da sessão A'}]}]);
 });
 await page.evaluate(()=>{
  window.__resolveStale=null;
  window.deskFreeBridge.freeSaveMaterial=()=>new Promise(resolve=>{
   window.__resolveStale=()=>resolve({saved:true,material:{id:'stale',name:'stale'},data:window.__freePayload({state:{chatWidth:511},library:[{path:'/tmp/nao-deve-aparecer.pdf',name:'stale.pdf'}],workspace:{kind:'free',title:'Sessão A'},session:'pi-livre-A.jsonl'})});
  });
 });
 await page.locator('#free-generate-pdf').click();
 await page.locator('#free-pdf-title').fill('A');
 await page.locator('#free-pdf-content').fill('conteúdo A');
 await page.locator('#free-pdf-save').click();
 await page.waitForFunction(()=>typeof window.__resolveStale==='function');
 /* Troca para a sessão livre B (MESMO curso, sessão diferente). */
 await page.evaluate(()=>window.__applyWorkspace(window.__freePayload({state:{chatWidth:505},library:[],workspace:{kind:'free',title:'Sessão B'},session:'pi-livre-B.jsonl',sessions:[{label:'B',path:'pi-livre-B.jsonl'}]})));
 await page.waitForFunction(()=>document.querySelector('#free-title')?.value==='Sessão B');
 await page.evaluate(async()=>{const {showHistory}=await import('./src/chat.mjs');showHistory([{role:'assistant',content:[{type:'text',text:'Histórico da sessão B'}]}]);});
 await page.evaluate(()=>window.__resolveStale());
 await page.waitForTimeout(500);
 assert.equal(await page.locator('#free-title').inputValue(),'Sessão B','resultado atrasado não troca o título da sessão atual');
 assert.match(await page.locator('#messages').textContent(),/Histórico da sessão B/,'resultado atrasado não substitui o histórico da sessão atual');
 assert.doesNotMatch(await page.locator('#messages').textContent(),/Histórico da sessão A/);
 assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--chat').trim()),'505px','resultado atrasado não reaplica medidas de layout');
 assert.deepEqual(await page.evaluate(async()=>{const {S}=await import('./src/state.mjs');return S.library;}),[],'biblioteca da sessão A não vaza para B');
 assert.equal(await page.locator('#free-materials').isDisabled(),true,'sessão B sem materiais mantém o seletor vazio');
 assert.equal(await page.locator('#free-pdf-dialog').evaluate(dialog=>dialog.open),false,'diálogo de salvar continua fechado');

 /* ---------- epoch: carga anterior não reaplica medidas depois da carga nova ---------- */
 const epoch=await page.evaluate(async()=>{
  const state=await import('./src/state.mjs');
  const a=window.__freePayload({state:{chatWidth:531},workspace:{kind:'free',title:'Carga A'},session:'pi-carga-A.jsonl'});
  const b=window.__freePayload({state:{chatWidth:505},workspace:{kind:'free',title:'Carga B'},session:'pi-carga-B.jsonl'});
  const first=state.loadCourse(a);
  const second=state.loadCourse(b);
  return {results:[await first,await second]};
 });
 assert.deepEqual(epoch.results,[false,true],'carga anterior termina descartada e a posterior aplica');
 assert.equal(await page.locator('#free-title').inputValue(),'Carga B','título final é da carga posterior');
 assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--chat').trim()),'505px','medida final é da carga posterior');

 /* ---------- 900x650: barra, diálogo e o vazio caibam na janela ---------- */
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(900,650));
 await page.waitForFunction(()=>innerWidth<=910&&innerHeight<=660,undefined,{timeout:10000}).catch(()=>{});
 await page.waitForTimeout(300);
 await page.evaluate(()=>window.__applyWorkspace(window.__freePayload({state:{},workspace:{title:'Sessão sintética'}})));
 await page.waitForFunction(()=>!document.querySelector('#free-bar').hidden);
 const barFit=await page.evaluate(()=>{
  const rect=document.querySelector('#free-bar').getBoundingClientRect();
  return {top:rect.top,bottom:rect.bottom,left:rect.left,right:rect.right};
 });
 assertInside('barra Livre',barFit,await page.evaluate(()=>innerWidth),await page.evaluate(()=>innerHeight));
 const smallSidebar=await page.locator('#sidebar').evaluate(el=>el.getBoundingClientRect().width);
 assert.ok(smallSidebar>=320,`900x650: vazio mantém a conversa útil (${smallSidebar}px)`);
 await page.locator('#free-generate-pdf').click();
 await page.waitForSelector('#free-pdf-dialog[open]');
 const dialogFit=await page.evaluate(()=>{
  const dialog=document.querySelector('#free-pdf-dialog');
  const rect=dialog.getBoundingClientRect();
  return {open:dialog.open,top:rect.top,bottom:rect.bottom,left:rect.left,right:rect.right,width:innerWidth,height:innerHeight};
 });
 assertInside('diálogo Gerar PDF',dialogFit,dialogFit.width,dialogFit.height);
 await page.keyboard.press('Escape');
 await page.waitForFunction(()=>!document.querySelector('#free-pdf-dialog').open);

 assert.deepEqual(errors,[],'nenhum erro de página durante o fluxo');
});
console.log('free-study-ui: fluxo completo da aba Livre passou (chrome, vazio, abrir PDF com largura útil, gerar PDF, teclado, renomear, criar matéria, guarda de geração, host autoritativo, 900x650).');
