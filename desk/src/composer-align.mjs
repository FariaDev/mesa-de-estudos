/* Alinha o fio do composer do chat lateral ao do tutor. A calculadora só existe
   na coluna do tutor, então a medida vira variável de CSS e o lateral usa essa
   altura a mais no próprio campo. */

/**
 * Calcula a altura do composer do tutor e a faixa abaixo dele. Com o tutor fora
 * da tela ou a calculadora aberta, cada coluna volta para o próprio pé.
 * @param {{composerTop:number,composerBottom:number,columnBottom:number,calculatorCollapsed:boolean}} facts medidas da coluna
 * @returns {{height:number,foot:number}} alturas em px
 * @example tutorComposerFootprint({composerTop:500,composerBottom:640,columnBottom:680,calculatorCollapsed:true}) // {height:140,foot:40}
 */
export function tutorComposerFootprint({composerTop,composerBottom,columnBottom,calculatorCollapsed}){
 const height=Math.max(0,composerBottom-composerTop);
 if(!height)return {height:0,foot:0};
 return {height,foot:calculatorCollapsed?Math.max(0,columnBottom-composerBottom):0};
}

/**
 * Mantém `--tutor-composer-h` e `--tutor-foot-h` em dia com a coluna do tutor.
 * @param {{root:HTMLElement,composer:HTMLElement|null,calculator:HTMLElement|null,column:HTMLElement|null}} parts elementos da Mesa
 * @returns {void}
 * @example installComposerAlign({root:document.documentElement,composer,calculator,column})
 */
export function installComposerAlign({root,composer,calculator,column}){
 if(!composer||!calculator||!column||typeof ResizeObserver!=='function')return;
 const applyAlign=()=>{
  const box=composer.getBoundingClientRect();
  const {height,foot}=tutorComposerFootprint({composerTop:box.top,composerBottom:box.bottom,columnBottom:column.getBoundingClientRect().bottom,calculatorCollapsed:calculator.classList.contains('collapsed')});
  root.style.setProperty('--tutor-composer-h',`${height}px`);
  root.style.setProperty('--tutor-foot-h',`${foot}px`);
 };
 const observer=new ResizeObserver(applyAlign);
 for(const element of [composer,calculator,column])observer.observe(element);
 applyAlign();
}
