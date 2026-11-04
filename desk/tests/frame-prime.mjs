/* A janela de teste nasce escondida (`show: !TEST_MODE` em main.cjs). No X11
   uma janela que nunca apareceu (ou que acabou de ser redimensionada) só
   entrega ~1 BeginFrame por segundo ao compositor: `requestAnimationFrame`,
   `layoutStable` e `nextFrames` ficam parados, mesmo com
   `backgroundThrottling:false` e os interruptores do Chromium.
   Um screencast do CDP (32×32, qualidade baixa) pede quadros ao compositor e
   o mantém a 60 fps sem mostrar a janela: nada de gerenciador de janelas
   reencaixando, redimensionando ou medindo no lugar errado (#49). */
const STREAMS=new WeakMap();

async function startStream(page){
 const session=await page.context().newCDPSession(page);
 STREAMS.set(page,session);
 session.on('Page.screencastFrame',(frame)=>{
  session.send('Page.screencastFrameAck',{sessionId:frame.sessionId}).catch(()=>{});
 });
 page.once('close',()=>{
  STREAMS.delete(page);
  session.send('Page.stopScreencast').catch(()=>{});
  session.detach().catch(()=>{});
 });
 await session.send('Page.startScreencast',{format:'jpeg',quality:5,maxWidth:32,maxHeight:32,everyNthFrame:1});
}

/** Mantém o compositor da página escondida pedindo quadros.
 *  `await primeHiddenFrames(page)` antes de medir quadros ou depois de um resize. */
export async function primeHiddenFrames(page){
 /* Página falsa dos testes unitários (waits.test.mjs) não tem CDP. */
 if(STREAMS.has(page)||typeof page?.context!=='function')return;
 await startStream(page);
}
