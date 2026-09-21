// Paridade do "Buscar neste PDF": lógica antiga do pdf.mjs × núcleo Bend
// (src/generated/find.core.js). Roda da pasta desk: `node tests/find-parity.mjs`.
import findCore from '../src/generated/find.core.js';

// Tradutor para o formato do artefato (`PageHits{page,count}`; Nat = BigInt).
const hitsList=hits=>hits.reduceRight((tail,{page,count})=>({$:'Con',head:{page:BigInt(page),count:BigInt(count)},tail}),{$:'Nil'});

// --- antigo (o que estava inline no pdf.mjs) -------------------------------
function oldTarget(cycle,pages,current){return cycle?(pages.find(p=>p.page>current)||pages[0]).page:pages[0].page;}
function oldCount(term,pages,total,current){
 if(!term||!total)return{hidden:true,text:''};
 const here=pages.find(p=>p.page===current),before=pages.filter(p=>p.page<current).reduce((s,p)=>s+p.count,0);
 return{hidden:false,text:here?`${before+1}/${total}`:`${total} ocorrências`};
}

// --- novo (via núcleo) ------------------------------------------------------
function newTarget(cycle,pages,current){
 const hit=findCore.cycleTarget(cycle,hitsList(pages),BigInt(current));
 return hit.$==='Some'?Number(hit.value):pages[0].page;
}
function newCount(term,pages,total,current){
 if(!term||!total)return{hidden:true,text:''};
 const out=findCore.findCount(hitsList(pages),BigInt(current));
 return{hidden:out.$==='Hidden',text:out.$==='Shown'?`${out.index}/${out.total}`:out.$==='All'?`${out.total} ocorrências`:''};
}

let seed=0x5eed;
const rnd=n=>{seed=(seed*1103515245+12345)>>>0;return seed%n;};

const CASES=20000;
let checked=0;
for(let i=0;i<CASES;i++){
 const pages=[];let n=0,total=0;
 const count=rnd(8); // 0..7 páginas com ocorrências
 const picks=[...Array(31)].map((_,k)=>k+1).filter(()=>rnd(3)===0);
 for(const page of picks){pages.push({page,count:1+rnd(5)});total+=pages.at(-1).count;n++;}
 const current=1+rnd(36);
 const term=rnd(4)===0?'':'limite';
 const cycle=rnd(2)===0;
 const same=term!==''&&total>0&&pages.length>0; // ciclo só existe com termo e lista
 if(same){
  const a=oldTarget(cycle,pages,current),b=newTarget(cycle,pages,current);
  if(a!==b){console.error(`ciclo divergiu: pages=${JSON.stringify(pages)} current=${current} cycle=${cycle} old=${a} new=${b}`);process.exit(1);}
  checked++;
 }
 const a=oldCount(term,pages,total,current),b=newCount(term,pages,total,current);
 if(a.hidden!==b.hidden||a.text!==b.text){console.error(`contador divergiu: pages=${JSON.stringify(pages)} total=${total} term=${JSON.stringify(term)} current=${current} old=${JSON.stringify(a)} new=${JSON.stringify(b)}`);process.exit(1);}
 checked++;
}
console.log(`FIND PASSED (${checked} comparações em ${CASES} casos)`);
