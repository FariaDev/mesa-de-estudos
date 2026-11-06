// node tests/capture-auditoria-ui-kit.mjs — helpers comuns das capturas da
// auditoria de UI/UX (rodada 2): janela, temas, boot de matéria e a conversa
// rica, divididos entre `capture-auditoria-ui.mjs` e `capture-auditoria-ui-estados.mjs`
// para os dois ficarem abaixo do teto de linhas. Imagens fora do repositório.
import fs from 'node:fs';
import path from 'node:path';
import {newRuntime,seedCourse,writeConfigJson,writeDeskJson,launchDesk,statusOnline,freezeMotion,resizeWindow,setTheme,tinyPdf} from './helpers.mjs';
import {nextFrames,layoutStable} from './waits.mjs';

export const OUT=process.env.AUDIT_OUT||'/tmp/opencode/ui-auditoria/rodada-2';
fs.mkdirSync(OUT,{recursive:true});
export const SIZES=[[1440,900],[900,650]];
export const THEMES=['light','dark'];
export const RICH='# Ideia central\n\nComece pelo **limite fundamental** e separe o termo dominante.\n\n1. Divida numerador e denominador por $x$.\n2. Use $\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1$.\n\n> Não substitua antes de simplificar.\n\n```js\nconst limite = (x) => Math.sin(x) / x;\nconsole.log(limite(1e-6));\n```\n\n| x | f(x) |\n|---|---|\n| 0,1 | 0,998 |\n\nVeja o [guia da matéria](https://exemplo.com/guia).';

/* Janela inteira em cada tema×tamanho; esconde dicas e máscara caminhos locais nos campos. */
export async function shots(page,app,base){
  for(const [width,height] of SIZES){
    await resizeWindow(app,page,width,height);
    await layoutStable(page,'main').catch(()=>{});
    for(const theme of THEMES){
      await setTheme(page,theme);
      await nextFrames(page);
      await page.mouse.move(1,1);
      await page.evaluate(()=>{for(const tip of document.querySelectorAll('.tip'))tip.hidden=true;});
      const saved=await page.evaluate(()=>{
        /* Só caminho absoluto: `sin(pi/2)` da calculadora não é pasta. */
        const inputs=[...document.querySelectorAll('input')].filter(i=>/^(?:\/|[A-Za-z]:[\\/]|\\\\)/.test(i.value));
        const keep=inputs.map(i=>i.value);
        inputs.forEach(i=>{i.value='…/'+i.value.split('/').filter(Boolean).pop();});
        return keep;
      }).catch(()=>[]);
      await page.screenshot({path:path.join(OUT,`${base}-${theme}-${width}x${height}.png`)});
      await page.evaluate(keep=>{
        [...document.querySelectorAll('input')].filter(i=>i.value.startsWith('…/')).forEach((i,k)=>{if(keep[k]!==undefined)i.value=keep[k];});
      },saved).catch(()=>{});
    }
  }
  await setTheme(page,'light');
}
export const courseWithPdf=(runtime,id='calc',name='Cálculo I')=>{
  const course=seedCourse(runtime,id);
  const pdf=path.join(course,'Limites.pdf');
  fs.writeFileSync(pdf,tinyPdf('Limites e derivadas'));
  writeConfigJson(runtime,{runtimePath:runtime,vaultPath:runtime,courses:[{id,name,path:course}]});
  return {course,pdf};
};
export const bootCourse=async(ctx,tag,{env={}}={})=>{
  const runtime=ctx.runtime=newRuntime(tag);
  const {course,pdf}=courseWithPdf(runtime);
  writeDeskJson(runtime,{courseId:'calc',courseStates:{calc:{pdfs:[{path:pdf,page:1}],study:{title:'',xopp:''}}}});
  const app=ctx.app=await launchDesk({runtime,env});
  const page=await app.firstWindow();
  await resizeWindow(app,page,1440,900);
  await statusOnline(page);
  await freezeMotion(page);
  await page.waitForSelector('.pdf-panel canvas',{timeout:30000});
  return {page,app,runtime,course,pdf};
};
export const send=async(page,text)=>{
  await page.locator('#prompt').fill(text);
  await page.locator('#send').click();
};
export const readState=page=>page.evaluate(()=>{
  const state=document.querySelector('#tutor-state');
  return {state:state?.dataset.state||'',lead:state?.querySelector('.ts-lead')?.textContent.trim()||'',fine:state?.querySelector('.ts-fine')?.textContent.trim()||'',placeholder:document.querySelector('#prompt')?.placeholder||''};
});
