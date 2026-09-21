// Adaptador do núcleo provado em core/wheel.bend: o host resolve os fatos
// (cooldown, limites, direção, limiar) e o núcleo decide. Para mudar a lógica,
// edite o core e rode `npm run build:bend` — este arquivo só traduz.
import core from './src/generated/wheel.core.js';

export const PAGE_TURN_THRESHOLD=80;
export const PAGE_TURN_COOLDOWN=280;

export function pageTurnFromWheel({deltaY=0,atTop=false,atBottom=false,fits=false,accum=0,now=0,lastTurn=0,threshold=PAGE_TURN_THRESHOLD,cooldown=PAGE_TURN_COOLDOWN}={}){
 const blocked=!!(now&&lastTurn&&now-lastTurn<cooldown);
 const towardNext=deltaY>0,towardPrev=deltaY<0;
 const next=accum+deltaY;
 const over=next>=threshold,under=next<=-threshold;
 const out=core.pageTurn(blocked,fits,towardNext,towardPrev,atTop,atBottom,over,under,accum,next);
 return {accum:out.accum,turn:out.turn.$==='Next'?1:out.turn.$==='Prev'?-1:0};
}
