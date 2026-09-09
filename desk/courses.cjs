const fs=require('node:fs');const path=require('node:path');
const DEFAULT_LABELS={'Calculus I':'Cálculo I','Discrete Math':'Matemática Discreta','Physics I':'Física I','Algorithms II':'Algoritmos II'};

function discoverCourses(vault,labels={}){
 if(!vault)return [];
 const root=path.join(vault,'Courses');
 if(!fs.existsSync(root))return [];
 const names={...DEFAULT_LABELS,...labels};
 return fs.readdirSync(root,{withFileTypes:true}).filter(e=>e.isDirectory()&&fs.existsSync(path.join(root,e.name,'_state.md'))).map(e=>({id:e.name,name:names[e.name]||e.name,path:path.join(root,e.name)}));
}

function listPdfs(dir,depth=0,seen=new Set(),files=new Set(),result=[]){
 if(depth>6)return result;
 try{
  const real=fs.realpathSync(dir);
  if(seen.has(real))return result;
  seen.add(real);
  for(const name of fs.readdirSync(dir)){
   const p=path.join(dir,name),stat=fs.statSync(p);
   if(stat.isDirectory())listPdfs(p,depth+1,seen,files,result);
   else if(/\.pdf$/i.test(name)){
    const realFile=fs.realpathSync(p);
    if(!files.has(realFile)){files.add(realFile);result.push({name,path:p});}
   }
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
 const seen=new Set(),files=new Set(),result=[];
 roots.forEach(r=>listPdfs(r,0,seen,files,result));
 return result.sort((a,b)=>a.name.localeCompare(b.name));
}

function mergeCourses(config){
 const labels={};
 for(const c of config?.courses||[])if(c?.id&&c.name)labels[c.id]=c.name;
 const byId=new Map();
 if(config?.vaultPath)for(const c of discoverCourses(config.vaultPath,labels))byId.set(c.id,c);
 for(const c of config?.courses||[]){
  if(!c?.path||!fs.existsSync(c.path))continue;
  const id=c.id||path.basename(c.path);
  const prev=byId.get(id);
  byId.set(id,{id,name:c.name||prev?.name||id,path:c.path});
 }
 return [...byId.values()];
}

module.exports={DEFAULT_LABELS,discoverCourses,courseLibrary,mergeCourses};
