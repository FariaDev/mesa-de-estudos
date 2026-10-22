/* Para cada teste de visão pura, lista os literais de string esperados que NÃO
   aparecem em core/laws|proofs do módulo correspondente (pista de asserção sem
   lei). Uso: node literais-nas-leis.mjs teste:modulo[,modulo2] ... */
import fs from 'node:fs';
const root=new URL('../../../',import.meta.url).pathname;
for(const spec of process.argv.slice(2)){
 const [file,mods]=spec.split(':');
 const src=fs.readFileSync(`${root}desk/tests/${file}.test.mjs`,'utf8');
 const bend=mods.split(',').flatMap(m=>['laws','proofs'].map(d=>fs.readFileSync(`${root}core/${d}/${m}.bend`,'utf8'))).join('\n');
 const core=mods.split(',').map(m=>fs.readFileSync(`${root}core/${m}.bend`,'utf8')).join('\n');
 const hay=bend+core;
 const lits=new Set();
 for(const m of src.matchAll(/'((?:[^'\\\n]|\\.)+)'/g)){const s=m[1];if(s.length>=4&&!/^node:|^\.\.?\//.test(s))lits.add(s);}
 const miss=[...lits].filter(s=>!hay.includes(s.replace(/\\'/g,"'")));
 console.log(`\n## ${file} (${mods}) literais=${lits.size} sem-lei=${miss.length}`);
 for(const s of miss.slice(0,40))console.log('  -',s.slice(0,110));
}
