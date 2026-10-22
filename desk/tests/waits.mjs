/* Esperas por condição dos testes de janela e hunts (#48).

   `page.waitForTimeout` só fica onde o próprio tempo é o que se testa
   (debounce, timeout, "nada acontece em N ms"), com um comentário
   `espera fixa: <motivo>` na mesma linha ou na de cima — o
   `ui-waits.test.mjs` conta as que não têm. O resto espera o estado:
   - `pollUntil`: lê um valor até uma regra aprovar, com tempo-limite e erro que
     diz o que esperava e o que viu (`onTimeout:'return'` devolve o último valor
     em vez de lançar, para quem decide o que fazer com a ausência);
   - `layoutStable`: o retângulo do elemento parou de mudar por alguns quadros
     (depois de redimensionar, recolher, abrir painel);
   - `nextFrames`: alguns quadros pintados, para o renderer aplicar o que o teste
     acabou de causar;
   - `pdfRenderIdle`: o leitor de PDF não está pintando (`data-rendering`) e a
     rolagem/pintura parou de mudar por alguns quadros (depois de zoom, ajuste,
     giro ou redimensionar). */

/** Lê `read()` a cada `interval` ms até `accept(valor)` ser verdadeiro.
 *  Devolve o valor aprovado; no estouro lança com `what` e o último valor visto.
 *  await pollUntil(()=>page.evaluate(()=>document.title),t=>t==='Mesa',{what:'o título "Mesa"'}) */
export async function pollUntil(read,accept,{timeout=10000,interval=50,what='a condição',onTimeout='throw'}={}){
 const deadline=Date.now()+timeout;
 let last;
 for(;;){
  last=await read();
  if(accept(last))return last;
  if(Date.now()>=deadline){
   if(onTimeout==='return')return last;
   throw Error(`esperava ${what} em ${timeout} ms; último valor visto: ${JSON.stringify(last)}`);
  }
  await new Promise(done=>setTimeout(done,interval));// espera fixa: intervalo do próprio polling
 }
}

/** O retângulo de `selector` ficou igual por `frames` quadros seguidos.
 *  Sem o elemento, espera ele aparecer (até o `timeout`). */
export async function layoutStable(page,selector,{frames=4,timeout=5000}={}){
 await page.evaluate(sel=>{(window.__layoutStable??={})[sel]=null;},selector);
 await page.waitForFunction(([sel,needed])=>{
  const el=document.querySelector(sel);
  if(!el)return false;
  const box=el.getBoundingClientRect();
  const key=[box.x,box.y,box.width,box.height].map(n=>Math.round(n*10)).join(',');
  const memory=(window.__layoutStable??={});
  const seen=memory[sel];
  memory[sel]=seen&&seen.key===key?{key,count:seen.count+1}:{key,count:1};
  return memory[sel].count>=needed;
 },[selector,frames],{polling:'raf',timeout});
}

/** Dois quadros pintados: o renderer teve a chance de aplicar a mudança que o
 *  teste acabou de causar (valor digitado, classe trocada) antes da leitura. */
export function nextFrames(page,count=2){
 return page.evaluate(n=>new Promise(done=>{
  const step=left=>left<=0?done():requestAnimationFrame(()=>step(left-1));
  step(n);
 }),count);
}

/** Os leitores de PDF pararam: nenhuma página com `data-rendering`, e a rolagem,
 *  a altura e o número de páginas pintadas iguais por `frames` quadros seguidos
 *  (~250 ms com o padrão, mais que o debounce de render do leitor).
 *  await field(0,'.in').click();await pdfRenderIdle(page); */
export async function pdfRenderIdle(page,{frames=15,timeout=20000}={}){
 await page.evaluate(()=>{window.__pdfRenderIdle=null;});
 await page.waitForFunction(needed=>{
  if(document.querySelector('.pdf-page[data-rendering]')){window.__pdfRenderIdle=null;return false;}
  const key=[...document.querySelectorAll('.pdf-panel')].map(panel=>{
   const box=panel.querySelector('.pdf-viewport');
   const painted=panel.querySelectorAll('.pdf-page[data-rendered]').length;
   return box?[Math.round(box.scrollTop),box.scrollHeight,painted].join(':'):'-';
  }).join('|');
  const seen=window.__pdfRenderIdle;
  window.__pdfRenderIdle=seen&&seen.key===key?{key,count:seen.count+1}:{key,count:1};
  return window.__pdfRenderIdle.count>=needed;
 },frames,{polling:'raf',timeout});
}
