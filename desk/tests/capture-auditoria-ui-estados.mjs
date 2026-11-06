// node tests/capture-auditoria-ui-estados.mjs — estados que a rodada 1 não
// capturou: diálogo de link e os erros reais do diálogo de provedores
// (`FAKE_OPENCODE_KEY=reject` e `FAKE_OPENCODE_OAUTH=failed` só valem nas
// rotas do diálogo: é preciso abri-lo e tentar). Claro/escuro × 1440×900 e
// 900×650, com `fake-opencode`, sem material real. Imagens fora do repositório.
import fs from 'node:fs';
import path from 'node:path';
import {withArtifacts,newRuntime,seedNativeSession,writeDeskJson,launchDesk,statusOnline,freezeMotion,resizeWindow} from './helpers.mjs';
import {OUT,shots,courseWithPdf,bootCourse} from './capture-auditoria-ui-kit.mjs';
const failures=[];
/* Re-rodar só alguns blocos: AUDIT_ONLY=link-dialogo,erro-dialogo. */
const ONLY=new Set((process.env.AUDIT_ONLY||'').split(',').filter(Boolean));
const block=async(tag,run)=>{
  if(ONLY.size&&!ONLY.has(tag))return;
  try{await withArtifacts(tag,run);console.log('ok',tag);}
  catch(error){const line=String(error?.message||error).split('\n')[0];failures.push(`${tag}: ${line}`);console.log('FALHOU',tag,line);}
};

/* ---- L. diálogo de link do corpo da resposta (https) ---- */
await block('link-dialogo',async ctx=>{
  const runtime=ctx.runtime=newRuntime('aud-link');
  const {pdf}=courseWithPdf(runtime);
  const session=seedNativeSession(runtime,[{role:'user',content:[{type:'text',text:'onde está o guia?'}]},{role:'assistant',content:[{type:'text',text:'Veja o [guia da matéria](https://exemplo.com/guia).'}]}],{courseId:'calc'});
  writeDeskJson(runtime,{courseId:'calc',session,courseStates:{calc:{session,pdfs:[{path:pdf,page:1}],study:{title:'',xopp:''}}}});
  const app=ctx.app=await launchDesk({runtime});
  const page=await app.firstWindow();
  await resizeWindow(app,page,1440,900);
  await statusOnline(page);
  await freezeMotion(page);
  const link=page.locator('.message.assistant .body a[href="https://exemplo.com/guia"]');
  await link.waitFor({timeout:30000});
  await link.click();
  await page.waitForSelector('#link-dialog[open]',{timeout:15000});
  await shots(page,app,'link-dialogo');
});

/* ---- M. erros reais do diálogo de provedores: chave recusada e login falho ---- */
const openProviderSettings=async page=>{
  await page.keyboard.press('ControlOrMeta+,');
  await page.waitForSelector('#settings-dialog[open]');
  await page.locator('#settings-tabs [data-sec="pastas"]').click();
  await page.waitForSelector('#cfg-opencode-providers .op-provider',{timeout:30000});
};
await block('erro-dialogo',async ctx=>{
  const {page,app}=await bootCourse(ctx,'aud-dialog-key',{env:{FAKE_OPENCODE_KEY:'reject'}});
  await openProviderSettings(page);
  await page.locator('#cfg-opencode-providers .op-provider[data-provider="openai"] [data-action="key"]').click();
  await page.locator('#cfg-opencode-providers [data-role="key-input"]').fill('sk-auditoria-recusada-000');
  await page.locator('#cfg-opencode-providers [data-role="key-input"]').press('Enter');
  await page.waitForSelector('#cfg-opencode-providers .op-login[data-phase="failed"]',{timeout:30000});
  await page.locator('#cfg-opencode-providers .op-login').scrollIntoViewIfNeeded();
  await shots(page,app,'erro-chave-recusada-dialogo');
});
await block('erro-login-dialogo',async ctx=>{
  const {page,app}=await bootCourse(ctx,'aud-dialog-oauth',{env:{FAKE_OPENCODE_OAUTH:'failed'}});
  await openProviderSettings(page);
  await page.locator('#cfg-opencode-providers .op-provider[data-provider="xai"] [data-action="login"]').click();
  await page.waitForSelector('#cfg-opencode-providers .op-login[data-phase="failed"]',{timeout:30000});
  await page.locator('#cfg-opencode-providers .op-login').scrollIntoViewIfNeeded();
  await shots(page,app,'erro-login-dialogo');
});

fs.writeFileSync(path.join(OUT,'failures-estados.json'),JSON.stringify(failures,null,2));
console.log('capturas de estados em',OUT);
console.log('falhas:',JSON.stringify(failures,null,2));
