/* Revisão da rodada 2 de UI: `.mesa-bkp-status span` e `.mesa-bkp-live` venciam as
   classes de estado por especificidade, e erro e sucesso do backup saíam cinza. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {newRuntime,seedCourse,writeConfigJson,launchDesk,statusOnline} from './helpers.mjs';

const runtime=newRuntime('backup-status-color');
const course=seedCourse(runtime,'Test');
writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'Test',name:'Cálculo I',path:course}]});
const app=await launchDesk({runtime});
try{
 const page=await app.firstWindow();
 await statusOnline(page);
 const colors=await page.evaluate(()=>{
  const root=document.createElement('div');
  root.className='mesa-bkp';
  root.innerHTML=`<div class="mesa-bkp-status"><span class="mesa-bkp-error" id="s-err"></span><span class="mesa-bkp-ok" id="s-ok"></span><span class="mesa-bkp-warn" id="s-warn"></span></div>
   <div class="mesa-bkp-actions"><span class="mesa-bkp-live mesa-bkp-error" id="l-err"></span><span class="mesa-bkp-live mesa-bkp-ok" id="l-ok"></span><span class="mesa-bkp-live" id="l-plain"></span></div>
   <span id="t-danger" style="color:var(--danger-text)"></span><span id="t-success" style="color:var(--success-text)"></span><span id="t-warn" style="color:var(--warn-text)"></span><span id="t-muted" style="color:var(--muted)"></span>`;
  document.body.append(root);
  const read=id=>getComputedStyle(root.querySelector(`#${id}`)).color;
  return Object.fromEntries(['s-err','s-ok','s-warn','l-err','l-ok','l-plain','t-danger','t-success','t-warn','t-muted'].map(id=>[id,read(id)]));
 });
 assert.equal(colors['s-err'],colors['t-danger'],'erro no quadro de status');
 assert.equal(colors['s-ok'],colors['t-success'],'sucesso no quadro de status');
 assert.equal(colors['s-warn'],colors['t-warn'],'aviso no quadro de status');
 assert.equal(colors['l-err'],colors['t-danger'],'erro na linha ao vivo');
 assert.equal(colors['l-ok'],colors['t-success'],'sucesso na linha ao vivo');
 assert.equal(colors['l-plain'],colors['t-muted'],'linha ao vivo neutra segue discreta');
 console.log('backup-status-color-ui OK');
}finally{
 await app.close();
 fs.rmSync(runtime,{recursive:true,force:true});
}
