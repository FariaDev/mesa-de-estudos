// node tests/ggb-chat-fullscreen-ui.mjs — o GeoGebra na tela inteira do tutor (#98).
// A view do applet é nativa, acima do DOM: ao esconder os leitores ela tem de
// sair de cima do tutor sem mudar de tamanho (um retângulo 1×1 recarregaria o
// applet e poderia perder o que o aluno desenhou); na volta, reaparece no
// retângulo das referências com a construção intacta. Applet falso
// (`fake-ggb.html`), 1440×900.
import assert from 'node:assert/strict';
import path from 'node:path';
import {
 withArtifacts,newRuntime,seedCourse,writeConfigJson,writeDeskJson,launchDesk,statusOnline,DESK,freezeMotion,resizeWindow,pageWindow
} from './helpers.mjs';
import {pollUntil} from './waits.mjs';

/** A view do GeoGebra (a que não é a página da Mesa): visível? onde? */
const viewState=async(app,page)=>(await pageWindow(app,page)).evaluate(bw=>{
 const view=bw.contentView.children.find(child=>child.webContents&&child.webContents!==bw.webContents);
 return view?{visible:view.getVisible(),bounds:view.getBounds()}:null;
});
/** O retângulo que a view deve ocupar: a coluna das referências abaixo da barra do GeoGebra. */
const expectedArea=page=>page.evaluate(()=>{
 const ref=document.querySelector('#references').getBoundingClientRect(),bar=document.querySelector('#ggb-bar').offsetHeight;
 return {x:Math.round(ref.left),y:Math.round(ref.top+bar),width:Math.round(ref.width),height:Math.round(Math.max(0,ref.height-bar))};
});
const near=(a,b)=>['x','y','width','height'].every(key=>Math.abs(a[key]-b[key])<=1);

/** Espera a view visível no retângulo das referências. */
async function viewSettles(app,page,what){
 await pollUntil(async()=>({view:await viewState(app,page),want:await expectedArea(page)}),
  ({view,want})=>!!view&&view.visible&&near(view.bounds,want),{timeout:5000,what});
}

await withArtifacts('ggb-chat-fullscreen',async ctx=>{
 const runtime=ctx.runtime=newRuntime('ggb-chat-full');
 const course=seedCourse(runtime,'calc');
 writeConfigJson(runtime,{runtimePath:runtime,vaultPath:runtime,courses:[{id:'calc',name:'Cálculo I',path:course}]});
 writeDeskJson(runtime,{courseId:'calc'});
 const app=ctx.app=await launchDesk({runtime,env:{LEARNING_DESK_GGB_PAGE:path.join(DESK,'tests/fixtures/fake-ggb.html')}});
 const page=await app.firstWindow(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await resizeWindow(app,page,1440,900);
 await statusOnline(page);
 await freezeMotion(page);
 await page.locator('.ggb-tab').click();
 await viewSettles(app,page,'a view do GeoGebra aberta no lugar das referências');
 const win=await pageWindow(app,page);
 const inApplet=code=>win.evaluate((bw,source)=>{
  const view=bw.contentView.children.find(child=>child.webContents&&child.webContents!==bw.webContents);
  return view?view.webContents.executeJavaScript(source):null;
 },code);
 await inApplet('window.ggbApplet.evalCommand("A=(1,2)")');
 const before=await viewState(app,page);
 assert.equal(before.visible,true,'a view começa à vista');
 assert.deepEqual(await inApplet('window.ggbApplet.getAllObjectNames()'),'A','o applet tem a construção do aluno');

 /* Tela inteira: a view nativa não pode continuar por cima do tutor, e o
    retângulo guardado não pode virar 1×1 (isso redimensionaria e recarregaria
    o applet). */
 await page.locator('#chat-full').click();
 await page.waitForFunction(()=>document.body.classList.contains('chat-full'));
 const covered=await pollUntil(()=>viewState(app,page),view=>!!view&&!view.visible,{timeout:5000,onTimeout:'return',what:'a view do GeoGebra sair de cima do tutor em tela inteira'});
 assert.equal(covered.visible,false,'a view nativa sai de cima do tutor em tela inteira');
 assert.ok(near(covered.bounds,before.bounds),`a view escondida guarda o retângulo de antes (${JSON.stringify(covered.bounds)} × ${JSON.stringify(before.bounds)})`);

 /* Volta: a view reaparece no lugar certo, com a mesma construção. */
 await page.locator('#chat-full').click();
 await page.waitForFunction(()=>!document.body.classList.contains('chat-full'));
 await viewSettles(app,page,'a view volta ao retângulo das referências');
 assert.deepEqual(await inApplet('window.ggbApplet.getAllObjectNames()'),'A','a construção continua no applet');
 assert.deepEqual(errors,[],'nenhum erro de página');
 console.log('PASS ggb-chat-fullscreen-ui — na tela inteira a view sai de cima sem mudar de tamanho; na volta reaparece no lugar com a construção.');
});
