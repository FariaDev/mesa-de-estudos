// @ts-check
/* Cache limitado das fórmulas já renderizadas pelo KaTeX. O stream do tutor
   repinta a resposta inteira a cada ~80 ms: sem cache, toda fórmula já fechada
   era renderizada de novo em cada repintura (medido em `tests/perf-probe.mjs`).
   O resultado do KaTeX depende só do TeX e do modo (display), então a chave é
   essa; o `null` de uma fórmula inválida também fica guardado para não repetir
   a exceção a cada delta. */

/**
 * Cria o cache. `render` devolve o HTML (ou `null` para uma fórmula inválida).
 * @template T
 * @param {(tex:string, display:boolean)=>T} render
 * @param {{limit?:number}} [options]
 * @returns {{render:(tex:string, display:boolean)=>T, stats:()=>{hits:number, misses:number, size:number}, reset:()=>void}}
 * @example const cache=createMathCache(tex=>katex.renderToString(tex));cache.render('x^2',false);
 */
export function createMathCache(render,{limit=512}={}){
 const entries=new Map();
 let hits=0,misses=0;
 return {
  render(tex,display){
   const key=`${display?'D':'I'}\u0000${tex}`;
   if(entries.has(key)){hits++;return /** @type {T} */(entries.get(key));}
   misses++;
   const value=render(tex,display);
   entries.set(key,value);
   if(entries.size>limit){
    const oldest=entries.keys().next().value;
    if(oldest!==undefined)entries.delete(oldest);
   }
   return value;
  },
  stats(){return {hits,misses,size:entries.size};},
  reset(){entries.clear();hits=0;misses=0;},
 };
}
