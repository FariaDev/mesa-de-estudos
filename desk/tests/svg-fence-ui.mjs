// node tests/svg-fence-ui.mjs — a cerca `svg` na conversa (#release OpenCode):
// o desenho aparece como figura, com a cor do tema, e a linha em branco não
// quebra. Capturas em /tmp/mesa-so-opencode.
import assert from 'node:assert/strict';
import path from 'node:path';
import {withArtifacts,newRuntime,seedCourse,seedSession,writeDeskJson,writeConfigJson,launchDesk,statusOnline,setTheme,freezeMotion,resizeWindow,reviewShot,screenshotDirectory} from './helpers.mjs';
import {nextFrames} from './waits.mjs';

const out=screenshotDirectory('svg-fence');
const fence=['```svg','<svg viewBox="0 0 160 100" role="img" aria-label="Retângulo de exemplo">','','<rect x="10" y="10" width="140" height="80" fill="var(--plot-1)" stroke="currentColor"/>','<text x="80" y="55" text-anchor="middle" fill="currentColor">figura</text>','</svg>','```'].join('\n');

await withArtifacts('svg-fence',async ctx=>{
 const runtime=ctx.runtime=newRuntime('svg-fence');
 const course=seedCourse(runtime,'calc');
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'calc',name:'Cálculo',path:course}]});
 const session=seedSession(runtime,[{type:'message',message:{role:'assistant',content:[{type:'text',text:`O desenho:\n\n${fence}`}]}}]);
 writeDeskJson(runtime,{courseId:'calc',session});
 const app=ctx.app=await launchDesk({runtime});
 const page=await app.firstWindow();
 const errors=[];page.on('pageerror',(error)=>errors.push(error.message));
 await resizeWindow(app,page,1440,900);
 await statusOnline(page);
 await freezeMotion(page);
 const figure=page.locator('#messages .figure[data-figure="svg"] svg');
 await figure.waitFor({timeout:30000});
 assert.equal(await page.locator('#messages .codeblock pre').count(),0,'a cerca não ficou como código');
 assert.equal(await figure.locator('rect').count(),1);
 assert.equal(await figure.locator('rect').getAttribute('fill'),'var(--plot-1)','a cor do tema se mantém');
 for(const theme of ['light','dark']){
  await setTheme(page,theme);
  await nextFrames(page);
  await page.screenshot({path:path.join('/tmp/mesa-so-opencode',`svg-fence-${theme}.png`)});
  await reviewShot(page,out,`svg-fence-${theme}.png`);
 }
 assert.deepEqual(errors,[],`erros de página: ${JSON.stringify(errors)}`);
});
console.log('svg-fence-ui: ok');
