import fs from 'node:fs';
const [,, ...files]=process.argv;
for(const f of files){
 const p=fs.existsSync(f)?f:'tests/'+f;
 const s=fs.readFileSync(p,'utf8').split('\n');
 console.log(`\n### ${f} (${s.length} linhas)`);
 const marks=[];
 s.forEach((l,i)=>{const m=l.match(/^\s*(?:test|it|describe)\((['"`])(.{0,110})/);if(m)marks.push([i+1,m[2]]);});
 marks.forEach(([n,t],i)=>{const end=(marks[i+1]?.[0]??s.length+1)-1;console.log(`${n}-${end} (${end-n+1}) ${t}`);});
}
