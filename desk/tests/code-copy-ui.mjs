// node tests/code-copy-ui.mjs — o copiar do bloco de código (#release OpenCode):
// botão-ícone discreto, sem inverter para branco, fora do início do código e da
// barra de rolagem; confirma com o check sem mexer no layout. Claro e escuro.
import assert from 'node:assert/strict';
import path from 'node:path';
import {withArtifacts,newRuntime,seedCourse,seedSession,writeDeskJson,writeConfigJson,launchDesk,statusOnline,setTheme,freezeMotion,resizeWindow,reviewShot,screenshotDirectory} from './helpers.mjs';
import {nextFrames} from './waits.mjs';

const out=screenshotDirectory('code-copy');
const composite=(fg,bg)=>{const parse=(value)=>{const m=value.match(/[\d.]+/g).map(Number);return {r:m[0],g:m[1],b:m[2],a:m[3]??1};};const f=parse(fg),b=parse(bg);const a=f.a+b.a*(1-f.a);return `rgb(${Math.round((f.r*f.a+b.r*b.a*(1-f.a))/a)}, ${Math.round((f.g*f.a+b.g*b.a*(1-f.a))/a)}, ${Math.round((f.b*f.a+b.b*b.a*(1-f.a))/a)})`;};
const contrast=(page,fg,bg)=>page.evaluate(({fg,bg})=>{
 const parse=(value)=>{const m=value.match(/[\d.]+/g).map(Number);return {r:m[0],g:m[1],b:m[2],a:m[3]??1};};
 const lin=(v)=>{v/=255;return v<=0.03928?v/12.92:((v+0.055)/1.055)**2.4;};
 const lum=(c)=>0.2126*lin(c.r)+0.7152*lin(c.g)+0.0722*lin(c.b);
 const a=parse(fg),b=parse(bg);
 const l1=Math.max(lum(a),lum(b)),l2=Math.min(lum(a),lum(b));
 return (l1+0.05)/(l2+0.05);
},{fg,bg});

await withArtifacts('code-copy',async ctx=>{
 const runtime=ctx.runtime=newRuntime('code-copy');
 const course=seedCourse(runtime,'calc');
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'calc',name:'Cálculo',path:course}]});
 const session=seedSession(runtime,[{type:'message',message:{role:'assistant',content:[{type:'text',text:'Veja o código:\n\n```js\nconst soma = (a, b) => a + b;\nconsole.log(soma(2, 3));\n```\n\nE sem linguagem:\n\n```\nsem_etiqueta()\n```'}]}}]);
 writeDeskJson(runtime,{courseId:'calc',session});
 const app=ctx.app=await launchDesk({runtime});
 const page=await app.firstWindow();
 const errors=[];page.on('pageerror',(error)=>errors.push(error.message));
 await resizeWindow(app,page,1440,900);
 await statusOnline(page);
 await freezeMotion(page);
 await page.waitForSelector('.codeblock .code-copy',{timeout:30000});
 const block=page.locator('.codeblock').first();
 const copy=block.locator('.code-copy');
 assert.equal(await block.locator('.code-head .code-lang').count(),1,'com linguagem, a etiqueta mora no cabeçalho');
 assert.equal(await block.locator('.code-head .code-lang').textContent(),'JS');
 assert.equal(await page.locator('.codeblock').nth(1).locator('.code-head .code-lang').count(),0,'sem linguagem, sem etiqueta');
 assert.equal(await page.locator('.codeblock').nth(1).locator('.code-head .code-copy').count(),1,'o copiar continua no cabeçalho');
 assert.equal(await copy.locator('svg.icon').count(),1,'o copiar usa o mesmo ícone da mensagem, não texto');
 assert.equal((await copy.getAttribute('aria-label')).length>0,true,'tem nome acessível');
 assert.equal(await copy.getAttribute('title'),'Copiar','a dica é "Copiar"');
 const before=await copy.evaluate((el)=>el.getBoundingClientRect().toJSON());
 for(const theme of ['light','dark']){
  await setTheme(page,theme);
  await block.hover();
  await copy.hover();
  await nextFrames(page);
  const look=await page.evaluate(()=>{
   const button=document.querySelector('.codeblock .code-copy');
   const head=document.querySelector('.codeblock .code-head');
   const pre=document.querySelector('.codeblock pre');
   const b=button.getBoundingClientRect(),h=head.getBoundingClientRect(),p=pre.getBoundingClientRect(),s=getComputedStyle(button),ps=getComputedStyle(pre);
   return {opacity:s.opacity,background:s.backgroundColor,color:s.color,radius:s.borderTopLeftRadius,
    width:b.width,height:b.height,left:b.left,right:b.right,top:b.top,bottom:b.bottom,headLeft:h.left,headRight:h.right,headBottom:h.bottom,
    preLeft:p.left,preRight:p.right,preTop:p.top,preBottom:p.bottom,
    padTop:ps.paddingTop,padRight:ps.paddingRight,padBottom:ps.paddingBottom,padLeft:ps.paddingLeft,
    preBackground:getComputedStyle(document.querySelector('.codeblock')).backgroundColor};
  });
  assert.equal(look.opacity,'1',`${theme}: o botão está à vista no cabeçalho`);
  assert.ok(look.width>=24&&look.height>=24,`${theme}: alvo de 24px (${look.width}x${look.height})`);
  assert.ok(look.radius!=='0px',`${theme}: raio de botão (${look.radius})`);
  assert.notEqual(await copy.evaluate((el)=>getComputedStyle(el).backgroundColor),'rgb(255, 255, 255)',`${theme}: o hover não inverte para branco`);
  const ratio=await contrast(page,look.color,composite(look.background,look.preBackground));
  assert.ok(ratio>=3,`${theme}: contraste no hover (${ratio.toFixed(2)}:1, ${look.color} em ${look.background})`);
  assert.ok(look.left>=look.headLeft-0.5&&look.right<=look.headRight+0.5,`${theme}: o copiar fica dentro do cabeçalho`);
  assert.ok(look.right>=look.headRight-8,`${theme}: o copiar alinha à direita (${look.right}/${look.headRight})`);
  assert.ok(look.bottom<=look.preTop+0.5,`${theme}: o código começa abaixo do cabeçalho (${look.bottom} × ${look.preTop})`);
  assert.deepEqual([look.padTop,look.padRight,look.padBottom,look.padLeft],['12px','12px','12px','12px'],`${theme}: respiro igual nos quatro lados do código`);
  await block.screenshot({path:path.join('/tmp/mesa-so-opencode',`code-copy-${theme}.png`)});
 }
 await copy.focus();
 assert.equal(await copy.evaluate((el)=>getComputedStyle(el).opacity),'1','o foco do teclado também mostra o botão');
 await copy.click();
 await page.waitForFunction(()=>document.querySelector('.codeblock .code-copy')?.classList.contains('ok'),undefined,{timeout:5000});
 assert.equal(await copy.locator('svg.motion-copied').count(),1,'a confirmação é o ícone de check');
 const during=await copy.evaluate((el)=>el.getBoundingClientRect().toJSON());
 assert.deepEqual(during,before,'a confirmação não desloca o layout');
 await page.waitForFunction(()=>!document.querySelector('.codeblock .code-copy')?.classList.contains('ok'),undefined,{timeout:5000});
 assert.equal(await copy.locator('svg.icon').count(),1,'o ícone de copiar volta');
 assert.deepEqual(errors,[],`erros de página: ${JSON.stringify(errors)}`);
 await reviewShot(page,out,'code-copy-fim.png');
});
console.log('code-copy-ui: ok');
