/* Caminho de Pi, Claude Code e Xournal++ nas Configurações (#83), na janela real
   e com o `save-config` de verdade: o renderer não troca esses caminhos por
   mensagem própria (um `saveConfig` com xournalPath arbitrário é ignorado); só o
   diálogo do main (`pickExecutable`) e o Limpar do campo mudam o valor, e o
   Salvar grava. O diálogo nativo é trocado por um stub no processo principal.
   O `userData` aponta para o runtime do teste, como em `settings-sections-ui.mjs`,
   para o `config.json` ser gravado de verdade. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {_electron as electron} from '@playwright/test';
import {DESK,deskEnv,newRuntime,seedCourse,writeConfigJson,withArtifacts} from './helpers.mjs';

/* Troca o `showOpenDialog` do processo principal pela resposta dada. */
const stubDialog=(app,answer)=>app.evaluate(({dialog},value)=>{dialog.showOpenDialog=async()=>value;},answer);

await withArtifacts('configuracoes-executaveis',async ctx=>{
 const runtime=ctx.runtime=newRuntime('settings-executables');
 const course=seedCourse(runtime,'A');
 const bin=path.join(runtime,'bin');fs.mkdirSync(bin,{recursive:true});
 const fakeExecutable=name=>{const file=path.join(bin,name);fs.writeFileSync(file,'#!/bin/sh\nexit 0\n');fs.chmodSync(file,0o755);return file;};
 const claudeChosen=fakeExecutable('claude-escolhido'),xournalChosen=fakeExecutable('xournalpp-escolhido');
 writeConfigJson(runtime,{runtimePath:runtime,vaultPath:runtime,claudePath:'/opt/claude-salvo',xournalPath:'/opt/xournal-salvo',courses:[{id:'A',name:'Cálculo',path:course}]});
 const configFile=path.join(runtime,'config.json');
 const readConfig=()=>JSON.parse(fs.readFileSync(configFile,'utf8'));
 const entry=path.join(runtime,'entry.cjs');
 fs.writeFileSync(entry,`require('electron').app.setPath('userData',__dirname);require(${JSON.stringify(path.join(DESK,'main.cjs'))});`);
 const env=deskEnv(runtime);delete env.LEARNING_DESK_RUNTIME;
 ctx.app=await electron.launch({args:[entry],cwd:DESK,env});
 const page=await ctx.app.firstWindow();
 await page.waitForFunction(()=>window.desk&&typeof window.desk.pickExecutable==='function');
 const current=async()=>(await page.evaluate(()=>window.desk.getConfig())).config;
 const save=config=>page.evaluate(next=>window.desk.saveConfig(next),config);

 /* A regressão: o renderer manda um caminho que ninguém escolheu. */
 await save({...await current(),xournalPath:'/tmp/evil-xournal',claudePath:'/tmp/evil-claude'});
 assert.equal(readConfig().xournalPath,'/opt/xournal-salvo','save-config com xournalPath arbitrário não altera o caminho');
 assert.equal(readConfig().claudePath,'/opt/claude-salvo','nem o do Claude Code');

 /* O canal de diálogo: cancelar não muda; escolher muda, pelo Salvar. */
 await stubDialog(ctx.app,{canceled:true,filePaths:[]});
 assert.equal(await page.evaluate(()=>window.desk.pickExecutable('xournal')),null,'cancelar o diálogo devolve null');
 await stubDialog(ctx.app,{canceled:false,filePaths:[xournalChosen]});
 assert.equal(await page.evaluate(()=>window.desk.pickExecutable('xournal')),xournalChosen,'o diálogo do main devolve o caminho escolhido');
 await save({...await current(),xournalPath:xournalChosen});
 assert.equal(readConfig().xournalPath,xournalChosen,'o caminho escolhido no diálogo é gravado');

 /* Pelas Configurações: Escolher… no Claude Code, Salvar. */
 await page.keyboard.press('ControlOrMeta+,');
 await page.waitForSelector('#settings-dialog[open]');
 await page.locator('#settings-tab-pastas').click();
 assert.notEqual(await page.locator('#cfg-claude').getAttribute('readonly'),null,'o campo não aceita digitação');
 await stubDialog(ctx.app,{canceled:false,filePaths:[claudeChosen]});
 await page.locator('#cfg-claude-browse').click();
 assert.equal(await page.locator('#cfg-claude').inputValue(),claudeChosen,'o campo mostra o escolhido');
 await page.locator('#settings-save').click();
 await page.waitForFunction(()=>!document.querySelector('#settings-dialog').open);
 assert.equal(readConfig().claudePath,claudeChosen,'Salvar grava o Claude Code escolhido');

 /* Limpar: volta ao automático (vazio), e o Salvar aceita o vazio. */
 await page.keyboard.press('ControlOrMeta+,');
 await page.waitForSelector('#settings-dialog[open]');
 await page.locator('#settings-tab-pastas').click();
 await page.locator('#cfg-xournal-clear').click();
 assert.equal(await page.locator('#cfg-xournal').inputValue(),'','Limpar esvazia o campo');
 await page.locator('#settings-save').click();
 await page.waitForFunction(()=>!document.querySelector('#settings-dialog').open);
 assert.equal(readConfig().xournalPath,'','Limpar volta ao automático');
});
