import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {_electron as electron} from '@playwright/test';
import {DESK,FAKE_PI,deskEnv,newRuntime,tinyPdf,withArtifacts,screenshotDirectory,setTheme,freezeMotion,resizeWindow,reviewShot,openModelPop,pickModel,modelRows,selectedModelKey} from './helpers.mjs';
import {pollUntil,nextFrames} from './waits.mjs';
import {createFakeOpencode} from './fake-opencode.mjs';

/* Começar sem plano pago (#44; motor OpenCode na #57), na janela real: o botão
   da primeira abertura → o cartão de aviso (conta, cartão, cobrança, onde a
   chave fica) → o site abre no navegador do sistema → a Mesa volta ao foco, lê
   a área de transferência SÓ ali e pergunta "Usar esta chave?" com a chave
   mascarada → testa só a lista de modelos → guarda a chave → "Começar sessão
   OpenCode" abre uma sessão OpenCode, o servidor da Mesa sobe com a chave no
   ambiente e o seletor traz os grátis primeiro, com a política de cada um.
   Depois: aviso único de modelo pago, bloco das Configurações com "Como evitar
   cobrança", os dois idiomas e a varredura que prova que a chave não está em
   lugar nenhum do runtime.

   Sem rede, Keychain, navegador nem área de transferência reais: console
   falso (`fake-opencode.mjs`), cofre falso (`fake-secret-cipher.cjs`), arquivo
   no lugar da área de transferência e links "abertos" gravados em
   `opened-links.jsonl`. Nenhum modelo é chamado: o `opencode serve` é o
   `fake-opencode.mjs` (LEARNING_DESK_OPENCODE). Imagens só com MESA_REVIEW_SHOTS. */

const step=n=>{if(process.env.MESA_TEST_STEPS)console.error(`[free-models-ui] passo ${n}`);};
const SHOT_DIR=screenshotDirectory('modelos-gratis');
const SIZES=[[1440,900],[900,650]];
const THEMES=['light','dark'];
const KEY_A='sk-janela-teste-aaaa1111bbbb2222';
const KEY_B='sk-janela-teste-cccc3333dddd4444';
const KEY_C='sk-arquivo-teste-eeee5555ffff6666';
const CIPHER=path.resolve(import.meta.dirname,'fake-secret-cipher.cjs');
const FREE_MODEL='deepseek-v4.1-flash-free';
const FAKE_OPENCODE_BIN=path.resolve(import.meta.dirname,'fake-opencode.mjs');

const tempDir=tag=>fs.mkdtempSync(path.join(os.tmpdir(),`mesa-${tag}-`));
const readLinks=runtime=>{
 const file=path.join(runtime,'opened-links.jsonl');
 return fs.existsSync(file)?fs.readFileSync(file,'utf8').split('\n').filter(Boolean).map(line=>JSON.parse(line).url):[];
};
const readLaunches=file=>fs.existsSync(file)?fs.readFileSync(file,'utf8').split('\n').filter(Boolean).map(line=>JSON.parse(line)):[];

/* Todo byte de arquivo sob `dir` (recursivo) que contém `needle`. */
function filesContaining(dir,needle){
 const hits=[];
 for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
  const full=path.join(dir,entry.name);
  if(entry.isDirectory()){hits.push(...filesContaining(full,needle));continue;}
  try{if(fs.readFileSync(full).includes(Buffer.from(needle)))hits.push(full);}catch{}
 }
 return hits;
}

async function boot(ctx,{homeDir,validKeys,clipboard}){
 const fake=await createFakeOpencode({validKeys});
 const runtime=ctx.runtime=newRuntime('modelos-gratis');
 const clipboardFile=path.join(tempDir('clip'),'clipboard.txt');
 fs.writeFileSync(clipboardFile,clipboard);
 const launchLog=path.join(tempDir('launch'),'launches.jsonl');
 const serveLog=path.join(tempDir('serve'),'serve.jsonl');
 /* Primeira abertura: userData no runtime e sem override de runtime, como o first-run-ui. */
 const entry=path.join(runtime,'entry.cjs');
 fs.writeFileSync(entry,`require('electron').app.setPath('userData',__dirname);require(${JSON.stringify(path.join(DESK,'main.cjs'))});`);
 fs.writeFileSync(path.join(runtime,'config.json'),JSON.stringify({runtimePath:runtime,courses:[]}));
 fs.chmodSync(FAKE_PI,0o755);
 fs.chmodSync(FAKE_OPENCODE_BIN,0o755);
 const env=deskEnv(runtime,{
  HOME:homeDir,USERPROFILE:homeDir,
  FAKE_PI_OPENCODE:'1',FAKE_PI_OPENCODE_LOG:launchLog,
  LEARNING_DESK_SECRET_CIPHER:CIPHER,LEARNING_DESK_OPENCODE_BASE:fake.url,
  LEARNING_DESK_OPENCODE_HOME:homeDir,LEARNING_DESK_FAKE_CLIPBOARD:clipboardFile,
  LEARNING_DESK_OPENCODE:FAKE_OPENCODE_BIN,FAKE_OPENCODE_LOG:serveLog,
 });
 delete env.LEARNING_DESK_RUNTIME;
 ctx.app=await electron.launch({args:[entry],cwd:DESK,env});
 const page=await ctx.app.firstWindow();
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.waitForSelector('body[data-first-run="true"]',{timeout:30000});
 await freezeMotion(page);
 return {page,fake,runtime,clipboardFile,launchLog,serveLog,errors,setClipboard:value=>fs.writeFileSync(clipboardFile,value)};
}

/* #64: o convite mora no passo Tutor da tela de passos; chega lá com o passeio
   pulado, um nome e uma pasta de PDF sintética (o seletor do sistema é falso). */
async function toTutorStep(ctx,page,runtime){
 const pdfs=path.join(runtime,'pdfs-convite');
 fs.mkdirSync(pdfs,{recursive:true});fs.writeFileSync(path.join(pdfs,'Lista.pdf'),tinyPdf('Lista',1));
 await ctx.app.evaluate(({dialog},folder)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[folder]});},pdfs);
 await page.locator('#first-run-help').click();
 await page.locator('#setup-skip-tour').click();
 await page.locator('#first-run-name').fill('Cálculo I');
 await page.locator('#setup-next').click();
 await page.locator('#first-run-pick').click();
 await page.waitForFunction(()=>!document.querySelector('#setup-next').disabled);
 await page.locator('#setup-next').click();
}

/* Pelo seletor das Configurações (seção escondida): é ele que repinta a janela. */
const pickLanguage=(page,language)=>page.evaluate(value=>{const select=document.querySelector('#ui-language');select.value=value;select.dispatchEvent(new Event('change',{bubbles:true}));},language);
const regainFocus=page=>page.evaluate(()=>window.dispatchEvent(new Event('focus')));
const dialogText=page=>page.locator('#free-models-dialog').innerText().then(text=>text.replace(/\s+/g,' ').trim());

/* O que o diálogo mostra cabe na janela: dentro dela, sem rolagem lateral, com o rodapé numa linha só. */
const fits=page=>page.evaluate(()=>{
 const dialog=document.querySelector('#free-models-dialog');
 const box=dialog.getBoundingClientRect();
 const footer=[...dialog.querySelectorAll('.study-footer button')].filter(b=>b.getClientRects().length);
 return {inside:box.left>=0&&box.top>=0&&box.right<=innerWidth&&box.bottom<=innerHeight,
  overflowX:dialog.scrollWidth>dialog.clientWidth,footerLines:new Set(footer.map(b=>Math.round(b.getBoundingClientRect().top))).size,
  radius:getComputedStyle(dialog).borderTopLeftRadius,title:getComputedStyle(dialog.querySelector('h2')).fontSize};
});

await withArtifacts('modelos-gratis',async ctx=>{
 const home=tempDir('home');
 const {page,fake,runtime,setClipboard,launchLog,serveLog,errors}=await boot(ctx,{homeDir:home,validKeys:[KEY_A,KEY_B],clipboard:'texto qualquer que não é chave'});

 step(1);
 /* 1. O convite da primeira abertura: ao lado de "Chamar o tutor". */
 await toTutorStep(ctx,page,runtime);
 const button=page.locator('#setup-tutor-actions #free-models');
 await button.waitFor({timeout:15000});
 assert.equal((await button.textContent()).trim(),'Usar modelos grátis');
 assert.equal(await button.getAttribute('class'),'','ação secundária, ao lado da principal');
 assert.equal(await page.locator('#setup-tutor-actions #connect').getAttribute('class'),'primary','"Chamar o tutor" continua lá, como principal');
 await button.click();
 await page.waitForSelector('#free-models-dialog[open]');

 step(2);
 /* 2. O cartão avisa antes de abrir o site, em português. */
 const card=await dialogText(page);
 for(const part of ['conta no OpenCode','cartão','Grátis não cobram','recarga automática','só neste computador'])assert.ok(card.includes(part),`o cartão diz "${part}": ${card}`);
 assert.equal(await page.locator('#free-models-authfile').isVisible(),false,'sem arquivo do OpenCode, sem atalho');
 assert.deepEqual(readLinks(runtime),[],'nada abre antes do clique');
 for(const theme of THEMES){
  await setTheme(page,theme);
  for(const [width,height] of SIZES){
   await resizeWindow(ctx.app,page,width,height);
   await nextFrames(page,3);
   const got=await fits(page);
   assert.deepEqual([got.inside,got.overflowX,got.footerLines,got.radius,got.title],[true,false,1,'16px','15px'],`${theme} ${width}×${height}: cartão cabe, rodapé numa linha (${JSON.stringify(got)})`);
   await reviewShot(page,SHOT_DIR,`cartao-${theme}-${width}x${height}.png`);
  }
 }
 await resizeWindow(ctx.app,page,1440,900);

 step(3);
 /* 3. Abrir o site: o link vai ao navegador do sistema; a Mesa pede a chave. */
 await page.locator('#free-models-open-site').click();
 await pollUntil(()=>readLinks(runtime),links=>links.length===1,{what:'um link aberto'});
 assert.deepEqual(readLinks(runtime),['https://opencode.ai/auth']);
 await page.locator('#free-models-key').waitFor();

 step(4);
 /* 4. Voltou o foco com algo que não é chave na área de transferência: nada é oferecido. */
 await regainFocus(page);
 await nextFrames(page,4);
 assert.equal(await page.locator('#free-models-clip').isVisible(),false);

 step(5);
 /* 5. Voltou o foco com uma chave: "Usar esta chave?" com a máscara, nunca a chave. */
 setClipboard(KEY_A+'\n');
 await regainFocus(page);
 await page.locator('#free-models-clip').waitFor({state:'visible'});
 assert.equal((await page.locator('#free-models-masked').textContent()).trim(),'sk-••••2222');
 assert.ok(!(await page.content()).includes(KEY_A),'a chave inteira nunca chega à página');
 await reviewShot(page,SHOT_DIR,'usar-esta-chave.png');
 await page.locator('#free-models-clip-no').click();
 await page.locator('#free-models-clip').waitFor({state:'hidden'});
 await regainFocus(page);
 await nextFrames(page,4);
 assert.equal(await page.locator('#free-models-clip').isVisible(),false,'a chave recusada não é oferecida de novo');
 assert.equal(fs.existsSync(path.join(runtime,'opencode-key.bin')),false,'recusar não guarda nada');

 step(6);
 /* 6. Outra chave copiada → confirmar: teste só da lista, guarda e convida para a sessão OpenCode. */
 setClipboard(KEY_B);
 await regainFocus(page);
 await page.locator('#free-models-clip').waitFor({state:'visible'});
 assert.equal((await page.locator('#free-models-masked').textContent()).trim(),'sk-••••4444');
 await page.locator('#free-models-clip-yes').click();
 await page.waitForSelector('#free-models-done:not(:empty)',{timeout:30000});
 assert.equal((await page.locator('#free-models-done').textContent()).trim(),'A chave foi guardada. Os modelos grátis do OpenCode Zen funcionam numa sessão OpenCode: comece uma para estudar com eles.');
 for(const request of fake.requests)assert.deepEqual([request.method,request.path],['GET','/inference/v1/models'],'só a lista de modelos; nenhuma inferência');
 assert.ok(fake.requests.some(request=>request.bearer&&request.valid),'a chave foi testada de verdade');
 assert.equal(await page.locator('#free-models-start').isVisible(),true,'o passo final convida para a sessão OpenCode');
 await reviewShot(page,SHOT_DIR,'pronto.png');

 step(7);
 /* 7. "Começar sessão OpenCode": sessão nova no motor OpenCode e o seletor com os grátis primeiro. */
 await page.locator('#free-models-start').click();
 await page.waitForFunction(()=>!document.querySelector('#free-models-dialog').open);
 await page.waitForSelector('#session-title[data-engine="opencode"]',{timeout:30000});
 /* #64: a sessão sobe por baixo da tela de passos, que só passa a dizer que o
    tutor está ligado; o seletor de modelo é da Mesa, então sai pelo Livre. */
 await page.waitForFunction(()=>document.querySelector('#setup-next')?.textContent.trim()==='Continuar',undefined,{timeout:30000});
 await page.locator('#setup-free').click();
 await page.waitForFunction(()=>!document.body.dataset.firstRun);
 await pollUntil(async()=>(await modelRows(page)).length,count=>count>=3,{what:'o catálogo do servidor no seletor',timeout:30000});
 await openModelPop(page);
 const rows=await modelRows(page);
 const fallback=page.locator('#model-list .model-row-default');
 assert.deepEqual([await fallback.getAttribute('aria-disabled'),await fallback.getAttribute('aria-selected'),(await fallback.innerText()).trim()],['true','true','Padrão do OpenCode'],'sem escolha, a linha do padrão do servidor (não escolhível)');
 assert.deepEqual(rows.map(row=>JSON.parse(row.key)[1]),['big-pickle',FREE_MODEL,'gpt-5.5'],'os grátis primeiro, por nome');
 assert.deepEqual(await page.locator('#model-list .model-group-title').allTextContents(),['Grátis','OpenCode Zen'],'os grátis num grupo próprio; o pago no do provedor');
 const by=id=>rows.find(row=>JSON.parse(row.key)[1]===id);
 assert.ok(by(FREE_MODEL).free&&by(FREE_MODEL).note.includes('Não guarda nem treina'),`grátis com a política: ${by(FREE_MODEL).note}`);
 assert.ok(by('big-pickle').note.includes('Pode usar para treinar'));
 /* No grupo do provedor a segunda linha traz os fatos do catálogo (ajustes do seletor): o pago mostra o preço, nunca uma política de grátis. */
 assert.ok(!by('gpt-5.5').free&&by('gpt-5.5').paid&&/US\$/.test(by('gpt-5.5').note)&&!/trein|guarda|privacidade/i.test(by('gpt-5.5').note),`pago: o preço, sem marca (${by('gpt-5.5').note})`);
 /* Acabamento da #59: o selo "Grátis" volta na linha, com a política no `title`; o pago segue sem selo. */
 const badge=key=>page.locator(`#model-list [role="option"][data-key='${key}']`).first().evaluate(row=>[row.querySelector('.model-row-top .model-row-badge')?.textContent||'',row.title]);
 const [freeBadge,freeTitle]=await badge(by(FREE_MODEL).key);
 assert.equal(freeBadge,'Grátis');
 assert.match(freeTitle,/Não guarda nem treina/);
 const [paidBadge,paidTitle]=await badge(by('gpt-5.5').key);
 assert.equal(paidBadge,'','pago: sem selo');
 assert.doesNotMatch(paidTitle,/trein|guarda|privacidade/i,`pago: sem política na dica (${paidTitle})`);
 await reviewShot(page,SHOT_DIR,'seletor.png');
 await page.keyboard.press('Escape');

 step(8);
 /* 8. A chave chegou ao servidor da Mesa só pelo ambiente; nunca na linha de comando, no Pi nem em arquivo do runtime. */
 const serveStarts=readLaunches(serveLog).filter(entry=>entry.start);
 assert.equal(serveStarts.length,1,'um servidor OpenCode, já com a chave');
 assert.deepEqual([serveStarts[0].keyPresent,serveStarts[0].argv.join(' ').includes(KEY_B),serveStarts[0].serverPasswordInherited],[true,false,false]);
 assert.ok(readLaunches(launchLog).every(launch=>!launch.keyInArgs),'o Pi nunca recebe a chave na linha de comando');
 assert.deepEqual(filesContaining(runtime,KEY_B),[],'a chave não está em nenhum arquivo do runtime');
 assert.deepEqual(filesContaining(runtime,KEY_A),[]);
 assert.equal(fs.existsSync(path.join(runtime,'opencode-key.bin')),true,'a chave está no cofre (cifrada)');

 step(9);
 /* 9. Modelo pago: confirma uma vez. */
 const choose=id=>pickModel(page,'opencode',id);
 const chosen=value=>value?JSON.parse(value)[1]:'';
 await choose('gpt-5.5');
 await page.waitForSelector('#free-models-dialog[open]');
 assert.ok((await dialogText(page)).includes('Este modelo cobra por uso'));
 await reviewShot(page,SHOT_DIR,'modelo-pago.png');
 await page.locator('#free-models-form [data-show="paid"][value="cancel"]').click();
 await page.waitForFunction(()=>!document.querySelector('#free-models-dialog').open);
 await pollUntil(()=>selectedModelKey(page),value=>chosen(value)==='',{what:'o seletor de volta no padrão do servidor'});
 assert.equal(JSON.parse(fs.readFileSync(path.join(runtime,'desk.json'),'utf8')).opencodePaidOk,false,'voltar não conta como aceite');
 await choose('gpt-5.5');
 await page.locator('#free-models-paid-yes').click();
 await pollUntil(()=>selectedModelKey(page),value=>chosen(value)==='gpt-5.5',{what:'o modelo pago escolhido'});
 await choose(FREE_MODEL);
 await pollUntil(()=>selectedModelKey(page),value=>chosen(value)===FREE_MODEL,{what:'de volta ao grátis'});
 await choose('gpt-5.5');
 await pollUntil(()=>selectedModelKey(page),value=>chosen(value)==='gpt-5.5',{what:'o pago de novo, sem perguntar'});
 assert.equal(await page.locator('#free-models-dialog').evaluate(el=>el.open),false,'a pergunta é uma vez só');
 await choose(FREE_MODEL);
 await pollUntil(()=>selectedModelKey(page),value=>chosen(value)===FREE_MODEL,{what:'de volta ao grátis'});
 await page.keyboard.press('Escape');

 step(10);
 /* 10. Configurações → Pastas e programas: máscara, Testar, "Como evitar cobrança", Remover. */
 await page.keyboard.press('ControlOrMeta+,');
 await page.waitForSelector('#settings-dialog[open]');
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('desk-open-settings',{detail:{section:'pastas'}})));
 await page.locator('#cfg-free-models').waitFor({state:'visible'});
 await pollUntil(()=>page.locator('#cfg-opencode-key').inputValue(),value=>value==='sk-••••4444',{what:'a chave mascarada'});
 assert.deepEqual(await page.locator('#cfg-opencode-key').evaluate(el=>[el.type,el.readOnly]),['text',true],'guardada: a máscara à vista, só leitura');
 assert.equal(await page.locator('#cfg-opencode-save').isVisible(),false);
 await page.locator('#cfg-avoid-charges summary').click();
 const avoid=await page.locator('#cfg-avoid-charges').innerText();
 for(const part of ['Como evitar cobrança','recarga automática','limite mensal','não segura a recarga automática','marca Grátis'])assert.ok(avoid.includes(part),`"Como evitar cobrança" diz "${part}": ${avoid}`);
 for(const theme of THEMES){
  await setTheme(page,theme);
  for(const [width,height] of SIZES){
   await resizeWindow(ctx.app,page,width,height);
   await nextFrames(page,3);
   const got=await page.evaluate(()=>{
    const block=document.querySelector('#cfg-free-models'),body=document.querySelector('#settings-body');
    const rights=[...block.querySelectorAll('input,button,summary,p')].filter(el=>el.getClientRects().length).map(el=>el.getBoundingClientRect().right);
    return {overflowX:body.scrollWidth>body.clientWidth,pastEdge:Math.max(...rights)>body.getBoundingClientRect().right+0.5,
     control:Math.round(document.querySelector('#cfg-opencode-key').getBoundingClientRect().height)};
   });
   assert.deepEqual(got,{overflowX:false,pastEdge:false,control:30},`${theme} ${width}×${height}: o bloco cabe nas Configurações (${JSON.stringify(got)})`);
   await page.locator('#cfg-free-models').scrollIntoViewIfNeeded();
   await reviewShot(page,SHOT_DIR,`configuracoes-${theme}-${width}x${height}.png`);
  }
 }
 await resizeWindow(ctx.app,page,1440,900);
 await page.locator('#cfg-opencode-test').click();
 await page.waitForSelector('#cfg-opencode-status:has-text("A chave funciona.")');

 step(11);
 /* 11. Inglês: o bloco, o cartão e o seletor trocam de língua na hora. */
 await pickLanguage(page,'en');
 await page.waitForSelector('#cfg-free-models .set-group-label:has-text("Free models (OpenCode Zen)")');
 assert.ok((await page.locator('#cfg-avoid-charges').innerText()).includes('How to avoid charges'));
 assert.ok((await page.locator('#cfg-avoid-charges').innerText()).includes('does not hold back auto-reload'));
 const english=await page.locator('#model-list').evaluate(list=>[...list.querySelectorAll('.model-group-title,.model-row-default .model-row-name,.model-row-note')].map(node=>node.textContent));
 assert.ok(english.includes('OpenCode default'),`linha do padrão em inglês: ${english.join(' | ')}`);
 assert.ok(english.includes('Free')&&english.some(text=>text.includes('Does not store or train')),`seletor em inglês: ${english.join(' | ')}`);
 await pickLanguage(page,'pt-BR');
 await page.waitForSelector('#cfg-free-models .set-group-label:has-text("Modelos gratuitos")');

 step(12);
 /* 12. Remover: apaga o cofre e devolve o campo para colar. */
 await page.locator('#cfg-opencode-remove').click();
 await pollUntil(()=>fs.existsSync(path.join(runtime,'opencode-key.bin')),gone=>gone===false,{what:'o cofre apagado'});
 await page.waitForSelector('#cfg-opencode-save',{state:'visible'});
 assert.equal(await page.locator('#cfg-opencode-key').inputValue(),'');
 assert.equal(await page.locator('#cfg-opencode-key').evaluate(el=>el.type),'password','sem chave, o campo volta a ser de senha');
 assert.deepEqual(errors,[],'sem erro de página');
});

/* Atalho "Usar a chave do OpenCode deste computador": só diz que o arquivo existe até o clique. */
await withArtifacts('modelos-gratis-arquivo',async ctx=>{
 const home=tempDir('home');
 const authDir=path.join(home,'.local','share','opencode');
 fs.mkdirSync(authDir,{recursive:true});
 fs.writeFileSync(path.join(authDir,'auth.json'),JSON.stringify({opencode:{type:'api',key:KEY_C}}));
 const {page,runtime}=await boot(ctx,{homeDir:home,validKeys:[KEY_C],clipboard:''});
 await toTutorStep(ctx,page,runtime);
 await page.locator('#setup-tutor-actions #free-models').click();
 await page.locator('#free-models-authfile').waitFor({state:'visible'});
 assert.ok((await page.locator('#free-models-authnote').textContent()).includes('~/.local/share/opencode/auth.json'),'diz qual arquivo vai ler');
 assert.equal(fs.existsSync(path.join(runtime,'opencode-key.bin')),false,'nada lido nem guardado antes do clique');
 await page.locator('#free-models-authfile').click();
 await page.waitForSelector('#free-models-done:not(:empty)',{timeout:30000});
 assert.equal(fs.existsSync(path.join(runtime,'opencode-key.bin')),true);
 assert.deepEqual(filesContaining(runtime,KEY_C),[],'a cópia fica cifrada no cofre da Mesa');
});
console.log('ok free-models-ui');
