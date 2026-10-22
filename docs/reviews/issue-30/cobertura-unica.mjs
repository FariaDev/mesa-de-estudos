import fs from 'node:fs';
const times=JSON.parse(fs.readFileSync('/tmp/cov/times.json'));
const bad=times.filter(t=>t.code!==0).map(t=>t.n);
const cover={};// n -> Set(file:line)
const total=new Set();
for(const {n} of times){
 const p=`/tmp/cov/${n}.lcov`;if(!fs.existsSync(p)){cover[n]=new Set();continue;}
 const set=new Set();let file=null;
 for(const l of fs.readFileSync(p,'utf8').split('\n')){
  if(l.startsWith("SF:")){file=l.slice(3);if(/^tests\/|node_modules|^\.\.|generated|\/tests\//.test(file))file=null;}
  else if(file&&l.startsWith('DA:')){const [ln,h]=l.slice(3).split(',');if(+h>0){set.add(file+':'+ln);total.add(file+':'+ln);}}
 }
 cover[n]=set;
}
const count=new Map();
for(const s of Object.values(cover))for(const k of s)count.set(k,(count.get(k)||0)+1);
const rows=times.map(({n,code,s})=>{const set=cover[n];let u=0;for(const k of set)if(count.get(k)===1)u++;return {n,code,s:+s.toFixed(1),lines:set.size,unique:u};});
fs.writeFileSync('/tmp/cov/rows.json',JSON.stringify(rows));
console.log('failed:',bad.join(' '));
console.log('total covered prod lines (unit):',total.size);
console.log('zero unique:');
console.log(rows.filter(r=>r.unique===0).sort((a,b)=>b.s-a.s).map(r=>`${r.n}(${r.lines}l,${r.s}s)`).join(' '));
console.log('low unique (1-5):');
console.log(rows.filter(r=>r.unique>0&&r.unique<=5).map(r=>`${r.n}(${r.unique}/${r.lines})`).join(' '));
