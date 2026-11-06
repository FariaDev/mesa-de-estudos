// node tests/no-vision-ui.mjs — aviso de modelo sem visão (`attach.noVision`).
// Com um modelo só-texto, anexar imagem avisa em vez de fingir que o modelo
// vê; com um modelo com visão, o mesmo anexo entra calado na bandeja.
import assert from 'node:assert/strict';
import {withArtifacts,newRuntime,seedCourse,writeConfigJson,writeDeskJson,launchDesk,statusOnline,freezeMotion,toastWait,pickModel,selectedModelKey,PLOT_PNG} from './helpers.mjs';
import {pollUntil} from './waits.mjs';

const PNG={name:'plot.png',mimeType:'image/png',buffer:Buffer.from(PLOT_PNG,'base64')};

await withArtifacts('no-vision',async ctx=>{
 const runtime=ctx.runtime=newRuntime('novision');
 const course=seedCourse(runtime,'calc');
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'calc',name:'Cálculo',path:course}]});
 writeDeskJson(runtime,{courseId:'calc'});
 const app=ctx.app=await launchDesk({runtime,env:{FAKE_OPENCODE_TEXT_ONLY:'1'}});
 const page=await app.firstWindow();
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await statusOnline(page);
 await freezeMotion(page);

 /* Modelo com visão: o anexo entra calado. */
 await pickModel(page,'opencode','big-pickle');
 await pollUntil(()=>selectedModelKey(page),key=>JSON.parse(key||'null')?.[1]==='big-pickle',{what:'o modelo com visão em uso'});
 await page.locator('#attach-input').setInputFiles(PNG);
 await page.waitForSelector('#attachments .attachment');
 await page.waitForTimeout(1500);// espera fixa: "nada acontece em 1,5 s" — sem aviso de visão com modelo que vê
 assert.equal(await page.locator('#toast').isHidden(),true,'com visão, anexar não avisa');
 assert.equal(await page.locator('#attachments .attachment').count(),1,'o anexo entra na bandeja');
 await page.locator('#attachments .attachment-remove').first().evaluate(el=>el.click());
 await page.waitForFunction(()=>document.querySelector('#attachments').hidden);

 /* Modelo só-texto: o anexo entra na bandeja e o aviso conta que ele não vê. */
 await pickModel(page,'opencode','text-only');
 await pollUntil(()=>selectedModelKey(page),key=>JSON.parse(key||'null')?.[1]==='text-only',{what:'o modelo só-texto em uso'});
 await page.locator('#attach-input').setInputFiles(PNG);
 await page.waitForSelector('#attachments .attachment');
 await toastWait(page,'não aceita imagens');
 assert.equal(await page.locator('#attachments .attachment').count(),1,'o anexo entra na bandeja mesmo sem visão');
 assert.deepEqual(errors,[],`erros de página: ${JSON.stringify(errors)}`);
});
console.log('no-vision-ui: ok');
