// Paridade dos núcleos de matérias/estudo do desk: lógica antiga (referência
// inline, como estava em courses.cjs/study.cjs) × núcleo Bend
// (src/generated/{courses,study}.core.js). Roda da pasta desk:
// `node tests/cores-parity.mjs`.
import path from 'node:path';
import coursesCore from '../src/generated/courses.core.js';
import studyCore from '../src/generated/study.core.js';

// --- tradutores (espelham desk/courses.cjs) ---------------------------------
const toCourses=xs=>xs.reduceRight((tail,c)=>({$:'Con',head:{id:c.id,name:c.name,path:c.path},tail}),{$:'Nil'});
const fromCourses=ls=>{const out=[];for(let l=ls;l&&l.$==='Con';l=l.tail)out.push({id:l.head.id,name:l.head.name,path:l.head.path});return out;};
const toPdfs=xs=>xs.reduceRight((tail,p)=>({$:'Con',head:{name:p.name,path:p.path,canonical:p.canonical},tail}),{$:'Nil'});
const fromPdfs=ls=>{const out=[];for(let l=ls;l&&l.$==='Con';l=l.tail)out.push({name:l.head.name,path:l.head.path,canonical:l.head.canonical});return out;};

// --- referência antiga ------------------------------------------------------
function oldMergeCourses(discovered,config,exists){
 const byId=new Map();
 for(const c of discovered)byId.set(c.id,c);
 for(const c of config||[]){
  if(!c?.path||!exists(c.path))continue;
  const id=c.id||path.basename(c.path);
  const prev=byId.get(id);
  byId.set(id,{id,name:c.name||prev?.name||id,path:c.path});
 }
 return [...byId.values()];
}
function oldLibrary(files){
 const seen=new Set(),out=[];
 for(const f of files){
  if(seen.has(f.canonical))continue;
  seen.add(f.canonical);
  out.push({name:f.name,path:f.path});
 }
 return out.sort((a,b)=>a.name.localeCompare(b.name));
}
function oldCleanStudy(title,xopp,exists){
 const t=typeof title==='string'?title.trim().slice(0,240):'';
 const x=typeof xopp==='string'?xopp.trim():'';
 return {title:t,xopp:x&&exists(x)&&path.extname(x).toLowerCase()==='.xopp'?x:''};
}

// --- novas (como os adaptadores usam o núcleo) ------------------------------
function newMergeCourses(discovered,config,exists){
 const cfg=[];
 for(const c of config||[]){
  if(!c?.path||!exists(c.path))continue;
  cfg.push({id:c.id||path.basename(c.path),name:c.name||'',path:c.path});
 }
 return fromCourses(coursesCore.mergeCourses(toCourses(discovered),toCourses(cfg)));
}
function newLibrary(files){
 const order=new Map();
 files.forEach((f,i)=>{if(!order.has(f.canonical))order.set(f.canonical,i);});
 return fromPdfs(coursesCore.courseLibrary(toPdfs(files)))
  .sort((a,b)=>a.name.localeCompare(b.name)||(order.get(a.canonical)??0)-(order.get(b.canonical)??0))
  .map(({name,path})=>({name,path}));
}
function newCleanStudy(title,xopp,exists){
 const t=typeof title==='string'?title:'';
 const x=typeof xopp==='string'?xopp.trim():'';
 const out=studyCore.cleanStudy(t,x,!!x&&exists(x));
 return {title:out.title,xopp:out.xopp};
}

// --- aleatório --------------------------------------------------------------
let seed=0xc0ffee;
const rnd=n=>{seed=(seed*1103515245+12345)>>>0;return seed%n;};
const pick=xs=>xs[rnd(xs.length)];

const IDS=['A','B','C','Calculus I'];
const NAMES=['','Novo nome','Matemática Discreta','Cálculo I','Álgebra'];
const PDFS=['a.pdf','B.pdf','Lista 1.pdf','Formulário.pdf','limites.pdf','Álgebra linear.pdf'];
const DIRS=['/w','/w/Courses/A','/w/outro'];
const XOPPS=['a.xopp','B.XOPP','c.pdf','sem-extensao','espaco .xopp','calc.xopp.txt'];

const CASES=20000;
let checked=0;
for(let i=0;i<CASES;i++){
 // mergeCourses
 const discovered=[];
 for(let k=0,n=rnd(4);k<n;k++)discovered.push({id:pick(IDS),name:pick(NAMES)||pick(IDS),path:pick(DIRS)});
 const config=[];
 for(let k=0,n=rnd(4);k<n;k++)config.push({id:rnd(3)?pick(IDS):undefined,name:pick(NAMES),path:rnd(4)?pick(DIRS):undefined});
 const exists=p=>p!=='/w/outro'&&p!==undefined;
 const a=oldMergeCourses(discovered,config,exists),b=newMergeCourses(discovered,config,exists);
 if(JSON.stringify(a)!==JSON.stringify(b)){console.error(`merge divergiu:\n discovered=${JSON.stringify(discovered)}\n config=${JSON.stringify(config)}\n old=${JSON.stringify(a)}\n new=${JSON.stringify(b)}`);process.exit(1);}
 checked++;

 // courseLibrary
 const files=[];
 for(let k=0,n=rnd(7);k<n;k++)files.push({name:pick(PDFS),path:`${pick(DIRS)}/${pick(PDFS)}`,canonical:pick(['/r1/a','/r1/b','/r2/a','/r2/c'])});
 const la=oldLibrary(files),lb=newLibrary(files);
 if(JSON.stringify(la)!==JSON.stringify(lb)){console.error(`biblioteca divergiu:\n files=${JSON.stringify(files)}\n old=${JSON.stringify(la)}\n new=${JSON.stringify(lb)}`);process.exit(1);}
 checked++;

 // cleanStudy
 const title=pick(['','   Limites e derivadas  ','T'.repeat(260),'  x  ']);
 const xopp=pick(XOPPS);
 const studyExists=p=>p==='a.xopp'||p==='calc.xopp.txt'||p==='espaco .xopp';
 const sa=oldCleanStudy(title,xopp,studyExists),sb=newCleanStudy(title,xopp,studyExists);
 if(JSON.stringify(sa)!==JSON.stringify(sb)){console.error(`estudo divergiu: title=${JSON.stringify(title)} xopp=${JSON.stringify(xopp)}\n old=${JSON.stringify(sa)}\n new=${JSON.stringify(sb)}`);process.exit(1);}
 checked++;
}
console.log(`CORES PASSED (${checked} comparações em ${CASES} casos)`);
