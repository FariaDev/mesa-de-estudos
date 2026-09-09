export const PAGE_TURN_THRESHOLD=80;
export const PAGE_TURN_COOLDOWN=280;

export function pageTurnFromWheel({deltaY=0,atTop=false,atBottom=false,fits=false,accum=0,now=0,lastTurn=0,threshold=PAGE_TURN_THRESHOLD,cooldown=PAGE_TURN_COOLDOWN}={}){
 if(now&&lastTurn&&now-lastTurn<cooldown)return {accum:0,turn:0};
 const towardNext=deltaY>0,towardPrev=deltaY<0;
 if(!fits){
  if(towardNext&&!atBottom)return {accum:0,turn:0};
  if(towardPrev&&!atTop)return {accum:0,turn:0};
 }
 if(!towardNext&&!towardPrev)return {accum,turn:0};
 const next=accum+deltaY;
 if(next>=threshold)return {accum:0,turn:1};
 if(next<=-threshold)return {accum:0,turn:-1};
 return {accum:next,turn:0};
}
