const fs=require('node:fs');const path=require('node:path');
const core=require('./src/generated/courses.core.js').default;
const DEFAULT_LABELS={'Calculus I':'Cálculo I','Discrete Math':'Matemática Discreta','Physics I':'Física I','Algorithms II':'Algoritmos II'};

/* Tradutores para o formato do artefato Bend (registros sem tag; listas
   Con/Nil). O núcleo é core/courses.bend. */
const toCourses=xs=>xs.reduceRight((tail,c)=>({$:'Con',head:{id:c.id,name:c.name,path:c.path},tail}),{$:'Nil'});
const fromCourses=ls=>{const out=[];for(let l=ls;l&&l.$==='Con';l=l.tail)out.push({id:l.head.id,name:l.head.name,path:l.head.path});return out;};
const toPdfs=xs=>xs.reduceRight((tail,p)=>({$:'Con',head:{name:p.name,path:p.path,canonical:p.canonical},tail}),{$:'Nil'});
const fromPdfs=ls=>{const out=[];for(let l=ls;l&&l.$==='Con';l=l.tail)out.push({name:l.head.name,path:l.head.path,canonical:l.head.canonical});return out;};

function discoverCourses(vault,labels={}){
 if(!vault)return [];
 const root=path.join(vault,'Courses');
 if(!fs.existsSync(root))return [];
 const names={...DEFAULT_LABELS,...labels};
 return fs.readdirSync(root,{withFileTypes:true}).filter(e=>e.isDirectory()&&fs.existsSync(path.join(root,e.name,'_state.md'))).map(e=>({id:e.name,name:names[e.name]||e.name,path:path.join(root,e.name)}));
}

/* Varre a árvore juntando todo .pdf com o caminho canônico (realpath); a
   dedupe por canônico fica no núcleo. `seen` corta os ciclos de symlink. */
function listPdfs(dir,depth=0,seen=new Set(),result=[]){
 if(depth>6)return result;
 try{
  const real=fs.realpathSync(dir);
  if(seen.has(real))return result;
  seen.add(real);
  for(const name of fs.readdirSync(dir)){
   const p=path.join(dir,name),stat=fs.statSync(p);
   if(stat.isDirectory())listPdfs(p,depth+1,seen,result);
   else if(/\.pdf$/i.test(name))result.push({name,path:p,canonical:fs.realpathSync(p)});
  }
 }catch{}
 return result;
}

function courseLibrary(course){
 if(!course||!fs.existsSync(course))return [];
 const roots=[];
 const sources=path.join(course,'Sources');
 if(fs.existsSync(sources))roots.push(sources);
 const state=path.join(course,'_state.md');
 if(fs.existsSync(state)){
  const text=fs.readFileSync(state,'utf8');
  const block=text.match(/^source_roots:\s*\n((?:[ \t]+.*\n?)*)/m)?.[1]||'';
  for(const line of block.split('\n')){
   const raw=line.match(/^\s*-\s*(.+?)\s*$/)?.[1];
   if(raw)roots.push(path.resolve(course,raw.replace(/^["']|["']$/g,'')));
  }
 }
 if(!roots.length)roots.push(course);
 const seen=new Set(),all=[];
 roots.forEach(r=>listPdfs(r,0,seen,all));
 const order=new Map();
 all.forEach((p,i)=>{if(!order.has(p.canonical))order.set(p.canonical,i);});
 /* O núcleo dedupa (primeiro canônico vence); a ordem final fica a do app:
    nome em localeCompare e, no empate, a ordem de varredura (como o sort
    estável de antes). */
 return fromPdfs(core.courseLibrary(toPdfs(all)))
  .sort((a,b)=>a.name.localeCompare(b.name)||(order.get(a.canonical)??0)-(order.get(b.canonical)??0))
  .map(({name,path})=>({name,path}));
}

function mergeCourses(config){
 const labels={};
 for(const c of config?.courses||[])if(c?.id&&c.name)labels[c.id]=c.name;
 const discovered=config?.vaultPath?discoverCourses(config.vaultPath,labels):[];
 const cfg=[];
 for(const c of config?.courses||[]){
  if(!c?.path||!fs.existsSync(c.path))continue;
  cfg.push({id:c.id||path.basename(c.path),name:c.name||'',path:c.path});
 }
 return fromCourses(core.mergeCourses(toCourses(discovered),toCourses(cfg)));
}

module.exports={DEFAULT_LABELS,discoverCourses,courseLibrary,mergeCourses};
