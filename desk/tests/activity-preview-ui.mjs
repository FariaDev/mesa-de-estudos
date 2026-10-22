/* Prévia do quadro pelo tutor (#42, parte B), de ponta a ponta e sem modelo:
   o Pi sintético chama a ferramenta de prévia pela ponte HTTP real da Mesa e a
   Mesa monta o documento numa janela invisível e offline, com o mesmo quadro
   isolado da conversa. Prova que:
   - a prévia devolve um PNG, a altura do conteúdo e o console do documento;
   - a largura padrão é a do texto da resposta e o tema/largura pedidos valem;
   - um erro no documento aparece no console devolvido, com a linha;
   - a prévia não grava nada: nenhuma atividade publicada, nenhum arquivo no
     diretório de atividades e nada novo na conversa.
   O caminho Claude da mesma prévia é o handler MCP de `activity-tools.cjs`,
   coberto em `tests/activity-tools.test.mjs`. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {launchDesk,withArtifacts,DESK,enterFree,freezeMotion,screenshotDirectory,resizeWindow} from './helpers.mjs';
import {pollUntil} from './waits.mjs';

const files=dir=>{const out=[];const walk=d=>{if(!fs.existsSync(d))return;for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())walk(p);else out.push(p);}};walk(dir);return out.sort();};
const png=b64=>{const buf=Buffer.from(b64,'base64');return {magic:buf.subarray(0,8).toString('hex'),width:buf.readUInt32BE(16),height:buf.readUInt32BE(20)};};

await withArtifacts('activity-preview-ui',async ctx=>{
 ctx.runtime=fs.mkdtempSync(path.join(os.tmpdir(),'mesa-activity-preview-'));
 const pi=path.join(DESK,'tests/fixtures/mesa-interactive-pi.mjs');fs.chmodSync(pi,0o755);
 fs.writeFileSync(path.join(ctx.runtime,'config.json'),JSON.stringify({runtimePath:ctx.runtime,vaultPath:ctx.runtime,courses:[]}));
 const out=path.join(ctx.runtime,'preview.json');
 ctx.app=await launchDesk({runtime:ctx.runtime,env:{LEARNING_DESK_PI:pi,FAKE_PI_PREVIEW_OUT:out}});
 const page=await ctx.app.firstWindow(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await resizeWindow(ctx.app,page,1440,900,{content:true});
 await enterFree(page);
 await page.evaluate(async()=>{await (await import('./src/state.mjs')).connect();});
 await freezeMotion(page);
 const before=files(ctx.runtime).filter(f=>!f.endsWith('preview.json'));
 const column=await page.evaluate(()=>{const m=document.querySelector('#messages'),s=getComputedStyle(m);return Math.round(m.clientWidth-parseFloat(s.paddingLeft)-parseFloat(s.paddingRight));});
 const run=async text=>{
  fs.rmSync(out,{force:true});
  await page.waitForFunction(()=>!document.querySelector('#send').disabled,undefined,{timeout:30000});
  await page.locator('#prompt').fill(text);await page.locator('#send').click();
  await pollUntil(()=>fs.existsSync(out),found=>found,{timeout:30000,interval:200,what:'o arquivo da prévia',onTimeout:'return'});
  assert.ok(fs.existsSync(out),`a prévia respondeu ("${text}")`);
  const result=JSON.parse(fs.readFileSync(out,'utf8'));
  assert.equal(result.error,undefined,`sem erro de ferramenta (${result.error})`);
  return result;
 };

 /* ---- visualização: print, altura e console; largura da coluna por padrão ---- */
 const chart=await run('Faça uma previa do grafico.');
 assert.equal(chart.previewed,true);
 assert.equal(chart.width,column,`largura padrão = texto da resposta (${chart.width} × ${column})`);
 assert.equal(chart.theme,'claro');
 assert.ok(chart.contentHeight>=300&&chart.contentHeight<=900,`altura do conteúdo plausível (${chart.contentHeight})`);
 const shot=png(chart.screenshot.data);
 assert.equal(shot.magic,'89504e470d0a1a0a','o print é um PNG');
 assert.equal(shot.width,chart.width,'o PNG tem a largura da prévia');
 assert.equal(shot.height,chart.capturedHeight,'o PNG tem a altura capturada');
 assert.ok(chart.consoleMessages.some(m=>m.level==='log'&&m.text==='pontos 7'),`console.log volta ao tutor (${JSON.stringify(chart.consoleMessages)})`);
 assert.equal(chart.consoleMessages.filter(m=>m.level==='error').length,0,'documento certo: sem erro');

 /* ---- erro no documento: aparece no console, com a linha; tema e largura pedidos ---- */
 const broken=await run('Faça uma previa com erro.');
 assert.equal(broken.width,390,'largura pedida');
 assert.equal(broken.theme,'escuro','tema pedido');
 const levels=broken.consoleMessages.map(m=>m.level);
 assert.deepEqual(levels.slice(0,2),['log','warning'],`log e aviso na ordem (${JSON.stringify(broken.consoleMessages)})`);
 const error=broken.consoleMessages.find(m=>m.level==='error');
 assert.ok(error,'a exceção aparece no console devolvido');
 assert.match(error.text,/Cannot set properties of null/);
 assert.match(error.text,/linha \d+/,'com a linha');
 assert.equal(png(broken.screenshot.data).magic,'89504e470d0a1a0a');

 /* O que o tutor recebe, para revisão visual (só com MESA_REVIEW_SHOTS). */
 if(process.env.MESA_REVIEW_SHOTS){
  const dir=screenshotDirectory('activity-preview');
  fs.writeFileSync(path.join(dir,`previa-grafico-${chart.width}px-claro.png`),Buffer.from(chart.screenshot.data,'base64'));
  fs.writeFileSync(path.join(dir,`previa-com-erro-${broken.width}px-escuro.png`),Buffer.from(broken.screenshot.data,'base64'));
 }

 /* ---- nada gravado ---- */
 const after=files(ctx.runtime).filter(f=>!f.endsWith('preview.json'));
 const added=after.filter(f=>!before.includes(f)).map(f=>path.relative(ctx.runtime,f)).filter(f=>/activit/i.test(f));
 assert.deepEqual(added,[],`nenhum arquivo de atividade foi gravado pela prévia (${JSON.stringify(added)})`);
 assert.equal((await page.evaluate(()=>window.desk.activityList())).items.length,0,'nenhuma atividade publicada');
 assert.equal(await page.locator('.activity-slot').count(),0,'nada apareceu na conversa');
 assert.equal(await page.evaluate(()=>[...document.querySelectorAll('iframe')].filter(f=>String(f.src).startsWith('mesa-activity:')).length),0,'nenhum quadro na janela da Mesa');
 assert.deepEqual(errors,[]);
});
console.log('activity-preview-ui: PASS — prévia offline devolve PNG, altura e console (com o erro e a linha), na largura da coluna ou na pedida, e não grava nada.');
