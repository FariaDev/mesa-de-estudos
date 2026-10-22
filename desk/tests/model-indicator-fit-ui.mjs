// node tests/model-indicator-fit-ui.mjs — o degrau do indicador de modelo com
// um nome comprido do OpenRouter (ajustes do seletor e do indicador). O usuário
// viu a fileira quase vazia e o indicador só com o ponto e a faísca: o nome
// "DeepSeek: DeepSeek V4.1 Flash" passava do teto do `.mi-model` e o host
// contava esse corte como "não cabe", então todo degrau falhava e sobrava o
// "icon". Aqui: o nome curto aparece enquanto couber, o degrau escolhido é
// sempre o mais folgado que cabe (arrastando a coluna e trocando o tamanho da
// janela), e o indicador tem alvo e contraste de controle, nos dois temas,
// em 1440×900 e 900×650.
import assert from 'node:assert/strict';
import path from 'node:path';
import {
 withArtifacts,newRuntime,seedCourse,writeConfigJson,writeDeskJson,launchDesk,statusOnline,
 reviewShot,screenshotDirectory,setTheme,freezeMotion,pickModel,closeModelPop,resizeWindow
} from './helpers.mjs';
import {layoutStable} from './waits.mjs';

const out=screenshotDirectory('model-indicator-fit');
const LADDER=['','compact','model','icon'];
const LONG={provider:'openrouter',id:'deepseek/deepseek-v4.1-flash',full:'DeepSeek: DeepSeek V4.1 Flash',short:'DeepSeek V4.1 Flash'};

/* Na página: o degrau atual e, para cada degrau mais folgado, se ele vazaria
   a fileira. O degrau certo é o primeiro que não vaza. */
const ladderProbe=page=>page.evaluate(ladder=>{
 const row=document.querySelector('#composer-box .composer-actions'),button=document.querySelector('#model-indicator');
 const model=button.querySelector('.mi-model'),text=button.querySelector('.mi-text');
 /* Nos degraus "" e "compact" o nome vai inteiro (até o teto); no "model", até o piso. */
 const floor=Number.parseFloat(getComputedStyle(button).getPropertyValue('--mi-model-floor'))||0;
 const leastOf=step=>step==='model'?floor:Infinity;
 const capOf=()=>Number.parseFloat(getComputedStyle(model).maxWidth)||Infinity;
 const cramped=step=>getComputedStyle(text).display!=='none'&&model.clientWidth+1<Math.min(model.scrollWidth,capOf(),leastOf(step));
 const fit=row.dataset.fit||'';
 const overflows={};
 for(const step of ladder.slice(0,ladder.indexOf(fit))){row.dataset.fit=step;overflows[step]=row.scrollWidth>row.clientWidth+1||cramped(step);}
 row.dataset.fit=fit;
 const stop=document.querySelector('#stop:not([hidden])')||document.querySelector('#send');
 return {
  fit,overflows,overflow:row.scrollWidth-row.clientWidth,
  shown:getComputedStyle(text).display==='none'?'':model.textContent.trim(),
  squeezed:cramped(fit),
  gapToAction:stop.getBoundingClientRect().left-button.getBoundingClientRect().right,
  label:button.getAttribute('aria-label')||''
 };
},LADDER);

/* Contraste do texto do indicador contra o fundo de verdade (o primeiro
   ancestral com cor), pela tela de um canvas, que entende oklab e color-mix. */
const indicatorLook=page=>page.evaluate(()=>{
 const button=document.querySelector('#model-indicator'),text=button.querySelector('.mi-model');
 const rgb=color=>{const c=document.createElement('canvas').getContext('2d');c.fillStyle='#000';c.fillStyle=color;c.fillRect(0,0,1,1);const [r,g,b,a]=c.getImageData(0,0,1,1).data;return {r,g,b,a};};
 let bg=null;
 for(let el=button;el&&!bg;el=el.parentElement){const c=rgb(getComputedStyle(el).backgroundColor);if(c.a>200)bg=c;}
 bg=bg||{r:255,g:255,b:255};
 const fg=rgb(getComputedStyle(text).color);
 const lum=({r,g,b})=>[r,g,b].map(v=>{v/=255;return v<=0.03928?v/12.92:((v+0.055)/1.055)**2.4;}).reduce((s,v,i)=>s+v*[0.2126,0.7152,0.0722][i],0);
 const [hi,lo]=[lum(fg),lum(bg)].sort((a,b)=>b-a);
 const box=button.getBoundingClientRect();
 return {contrast:(hi+0.05)/(lo+0.05),width:box.width,height:box.height};
});

const assertLadder=(step,tag)=>{
 assert.ok(LADDER.includes(step.fit),`${tag}: degrau conhecido (${step.fit})`);
 assert.ok(step.overflow<=1,`${tag}: nada vaza da fileira (${step.overflow}px, degrau "${step.fit}")`);
 for(const [looser,spills] of Object.entries(step.overflows))assert.equal(spills,true,`${tag}: o degrau "${looser}" caberia, mas a fileira ficou em "${step.fit}"`);
 assert.equal(step.squeezed,false,`${tag}: o nome do modelo não é espremido além do que o degrau "${step.fit}" deixa (${step.shown})`);
 assert.ok(step.gapToAction>=0&&step.gapToAction<=8,`${tag}: o indicador fica colado no Enviar/Parar (${step.gapToAction}px)`);
};

await withArtifacts('model-indicator-fit',async ctx=>{
 const runtime=ctx.runtime=newRuntime('modelfit');
 const course=seedCourse(runtime,'calc');
 writeConfigJson(runtime,{runtimePath:runtime,vaultPath:runtime,courses:[{id:'calc',name:'Cálculo',path:course}]});
 writeDeskJson(runtime,{courseId:'calc'});
 const app=ctx.app=await launchDesk({runtime,env:{FAKE_PI_MANY_MODELS:'450',FAKE_PI_REASONING:'1',FAKE_PI_QUEUE_LOG:path.join(runtime,'fila.jsonl'),FAKE_PI_QUEUE_HOLD_MS:'30000'}});
 const page=await app.firstWindow();
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await resizeWindow(app,page,1440,900);
 await statusOnline(page);
 await freezeMotion(page);
 await pickModel(page,LONG.provider,LONG.id);
 await page.waitForFunction(name=>(document.querySelector('#model-indicator')?.getAttribute('aria-label')||'').includes(name),LONG.short,{timeout:15000});
 await closeModelPop(page);

 /* ---- nome curto enquanto couber, nos dois temas e tamanhos ---- */
 for(const [theme,width,height] of [['light',1440,900],['dark',1440,900],['light',900,650],['dark',900,650]]){
  await setTheme(page,theme);
  await resizeWindow(app,page,width,height);
  await layoutStable(page,'#model-indicator');
  const tag=`${theme==='light'?'claro':'escuro'}-${width}x${height}`;
  const step=await ladderProbe(page);
  assertLadder(step,tag);
  assert.notEqual(step.fit,'icon',`${tag}: com a fileira folgada, o indicador não vira só ícone`);
  assert.match(step.shown,new RegExp(`^${LONG.short}`),`${tag}: mostra o nome curto, sem o "Fabricante: " (${step.shown})`);
  assert.match(step.label,new RegExp(LONG.short),`${tag}: o nome acessível diz o modelo`);
  const look=await indicatorLook(page);
  assert.ok(look.height>=24&&look.width>=24,`${tag}: alvo de pelo menos 24px (${look.width}×${look.height})`);
  assert.ok(look.contrast>=4.5,`${tag}: texto do indicador com contraste de leitura (${look.contrast.toFixed(2)}:1)`);
  console.log(`indicador ${tag}: degrau "${step.fit}", texto "${step.shown}", contraste ${look.contrast.toFixed(2)}:1`);
  await reviewShot(page,out,`${tag}-fileira.png`);
 }

 /* ---- arrastando o divisor do chat, o degrau acompanha nos dois sentidos ---- */
 await setTheme(page,'light');
 await resizeWindow(app,page,1440,900);
 await layoutStable(page,'#model-indicator');
 const divider=page.locator('#divider');
 const box=await divider.boundingBox();
 const x0=box.x+box.width/2,y0=box.y+box.height/2;
 const seen=[];
 await page.mouse.move(x0,y0);await page.mouse.down();
 for(const dx of [120,240,360,480,360,240,120,0,-120,-240,0]){
  await page.mouse.move(x0+dx,y0,{steps:4});
  await layoutStable(page,'#model-indicator');
  const step=await ladderProbe(page);
  seen.push(`${dx}→"${step.fit}"`);
  assertLadder(step,`arrasto ${dx}px`);
 }
 await page.mouse.up();
 console.log('degraus no arrasto:',seen.join(', '));

 /* ---- com o tutor respondendo (Parar no lugar do Enviar), a fileira não se desmonta ---- */
 await page.locator('#prompt').fill('uma pergunta');
 await page.locator('#send').click();
 await page.locator('#stop').waitFor({state:'visible',timeout:15000});
 await layoutStable(page,'#model-indicator');
 const busy=await ladderProbe(page);
 assertLadder(busy,'respondendo');
 assert.notEqual(busy.fit,'icon','respondendo: com espaço, o nome do modelo segue à vista');
 await reviewShot(page,out,'claro-1440x900-respondendo.png');
 await page.locator('#stop').click();
 await page.locator('#send').waitFor({state:'visible',timeout:15000});

 /* ---- o degrau não fica velho: a fonte e o nome mudam depois da medida ---- */
 const afterFonts=await page.evaluate(async()=>{await document.fonts.ready;return true;});
 assert.equal(afterFonts,true);
 assertLadder(await ladderProbe(page),'depois das fontes');
 assert.deepEqual(errors,[],'nenhum erro de página');
 console.log('PASS model-indicator-fit-ui — capturas em',out);
});
