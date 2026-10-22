// node tests/ggb-divider-drag-ui.mjs — arrastar o divisor do chat com a aba
// GeoGebra aberta (ajustes do GeoGebra). A view do applet é nativa, acima do
// DOM: antes ela ficava no retângulo velho durante e depois do arrasto, cobria
// o divisor quando o chat crescia e roubava o ponteiro. Agora, no começo do
// arrasto ela vira uma captura e some; no fim volta uma vez, no retângulo novo.
// O teclado no divisor também move a view. Applet falso (`fake-ggb.html`),
// 1440×900 e 900×650, nos dois temas.
import assert from 'node:assert/strict';
import path from 'node:path';
import {
 withArtifacts,newRuntime,seedCourse,writeConfigJson,writeDeskJson,launchDesk,statusOnline,DESK,
 reviewShot,screenshotDirectory,setTheme,freezeMotion,resizeWindow,pageWindow
} from './helpers.mjs';
import {layoutStable,pollUntil} from './waits.mjs';

const out=screenshotDirectory('ggb-divider-drag');

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
const chatWidth=page=>page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--chat').trim());

/** Espera a view visível no retângulo das referências; devolve quanto demorou. */
async function viewSettles(app,page,what){
 const started=Date.now();
 await pollUntil(async()=>({view:await viewState(app,page),want:await expectedArea(page)}),
  ({view,want})=>!!view&&view.visible&&near(view.bounds,want),{timeout:5000,what});
 return Date.now()-started;
}

await withArtifacts('ggb-divider-drag',async ctx=>{
 const runtime=ctx.runtime=newRuntime('ggb-drag');
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

 for(const [theme,width,height] of [['light',1440,900],['dark',1440,900],['light',900,650],['dark',900,650]]){
  const tag=`${theme==='light'?'claro':'escuro'}-${width}x${height}`;
  await setTheme(page,theme);
  await resizeWindow(app,page,width,height);
  await layoutStable(page,'#references');
  await viewSettles(app,page,`${tag}: a view acompanha a janela`);

  /* ---- arrasto: o chat cresce, a view sai de cima e o divisor segue recebendo o ponteiro ---- */
  const box=await page.locator('#divider').boundingBox();
  const x0=box.x+box.width/2,y0=box.y+box.height/2;
  const before=await chatWidth(page);
  await page.mouse.move(x0,y0);await page.mouse.down();
  await page.mouse.move(x0-60,y0,{steps:3});
  const during=await pollUntil(()=>viewState(app,page),view=>!!view&&!view.visible,{timeout:3000,what:`${tag}: a view nativa sai de cima durante o arrasto`});
  assert.equal(during.visible,false);
  await page.locator('#references .ggb-freeze').waitFor({state:'attached',timeout:3000});
  /* O ponteiro passa por onde a view estava: o divisor continua no comando. */
  await page.mouse.move(x0-140,y0,{steps:4});
  const mid=await chatWidth(page);
  assert.notEqual(mid,before,`${tag}: o arrasto muda a largura do chat (${before} → ${mid})`);
  await reviewShot(page,out,`${tag}-arrastando.png`);
  await page.mouse.up();
  const settle=await viewSettles(app,page,`${tag}: no fim do arrasto a view volta no retângulo novo`);
  assert.ok(settle<=500,`${tag}: a view volta sem atraso visível (${settle} ms)`);
  assert.equal(await page.locator('#references .ggb-freeze').count(),0,`${tag}: a captura sai quando a view volta`);
  console.log(`${tag}: chat ${before} → ${await chatWidth(page)}, view de volta em ${settle} ms`);
  await reviewShot(page,out,`${tag}-depois.png`);

  /* ---- teclado no divisor: sem `resize` da janela, a view também acompanha ---- */
  await page.locator('#divider').focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await viewSettles(app,page,`${tag}: o divisor pelo teclado move a view`);

  /* ---- clique sem arrasto: a view não fica escondida ---- */
  const again=await page.locator('#divider').boundingBox();
  await page.mouse.click(again.x+again.width/2,again.y+again.height/2);
  await viewSettles(app,page,`${tag}: um clique no divisor não deixa a view escondida`);
 }
 assert.deepEqual(errors,[],'nenhum erro de página');
 console.log('PASS ggb-divider-drag-ui — capturas em',out);
});
