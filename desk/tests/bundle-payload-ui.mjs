/* Payload real do instalador em diretório isolado; nenhuma instalação local,
   credencial ou inferência. Verifica boot, import do SDK e impressão real. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {_electron as electron} from '@playwright/test';
import bundle from '../bundle-runtime.cjs';
import {DESK,deskEnv,withArtifacts} from './helpers.mjs';

await withArtifacts('bundle-payload-ui',async ctx=>{
 const tmp=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'mesa-bundle-payload-')));
 ctx.runtime=tmp;
 const payload=path.join(tmp,'app'),runtime=path.join(tmp,'user-data');
 fs.mkdirSync(runtime);
 fs.writeFileSync(path.join(runtime,'config.json'),JSON.stringify({runtimePath:runtime,vaultPath:runtime,courses:[]}));
 const managed=bundle.stageBundlePayload(DESK,payload);
 assert.ok(managed.includes('node_modules/@anthropic-ai/claude-agent-sdk'));
 const require=createRequire(path.join(payload,'package.json'));
 const sdkPath=require.resolve('@anthropic-ai/claude-agent-sdk');
 assert.ok(sdkPath.startsWith(payload+path.sep),'SDK resolvido dentro do payload');
 const sdk=await import(pathToFileURL(sdkPath).href);
 assert.equal(typeof sdk.query,'function');assert.equal(typeof sdk.getSessionMessages,'function');
 const {createTutorPdfServer}=require('./src/agents/tutor-pdf.cjs');
 const nativePdf=await createTutorPdfServer(async()=>({prepared:true}));
 assert.ok(nativePdf.instance,'servidor oficial de PDF resolve SDK e zod dentro do payload');
 await nativePdf.instance.close();
 assert.ok(fs.existsSync(path.join(payload,'src','extensions','tutor-pdf','index.ts')),'extensão PDF do Pi distribuída');
 ctx.app=await electron.launch({args:[payload],cwd:tmp,env:deskEnv(runtime)});
 const page=await ctx.app.firstWindow(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.waitForSelector('#free-bar');
 if(await page.locator('#welcome-dialog').evaluate(el=>el.open))await page.keyboard.press('Escape');
 assert.ok(page.url().startsWith(pathToFileURL(payload).href),'renderer veio do payload');
 await page.locator('#free-generate-pdf').click();
 await page.locator('#free-pdf-title').fill('Payload isolado');
 await page.locator('#free-pdf-content').fill('# Payload isolado\n\nImpressão do pacote distribuído.\n\n$$a^2+b^2=c^2$$');
 await page.waitForSelector('#free-pdf-preview .katex');
 await page.locator('#free-pdf-save').click();
 await page.waitForFunction(()=>!document.querySelector('#free-pdf-dialog').open&&!!document.querySelector('.pdf-page[data-rendered] canvas'),undefined,{timeout:60000});
 const pdf=await page.evaluate(async()=>{const {S}=await import('./src/state.mjs');return {path:S.panels[0].path,text:(await (await S.panels[0].doc.getPage(1)).getTextContent()).items.map(x=>x.str).join(' ')};});
 assert.equal(fs.readFileSync(pdf.path).subarray(0,5).toString(),'%PDF-');
 assert.match(pdf.text,/Payload isolado/);assert.deepEqual(errors,[]);
 console.log('PASS: payload real isolado inicia, resolve/importa SDK completo e imprime PDF com matemática; sem inferência.');
});
