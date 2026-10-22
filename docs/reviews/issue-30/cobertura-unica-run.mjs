import {spawn} from 'node:child_process';
import fs from 'node:fs';
const files=fs.readdirSync('tests').filter(f=>f.endsWith('.test.mjs'));
let i=0,running=0;const out=[];
function next(){
 while(running<4&&i<files.length){
  const f=files[i++];running++;
  const n=f.replace('.test.mjs','');
  const t=Date.now();
  const p=spawn(process.execPath,['--test','--experimental-test-coverage','--test-reporter=lcov',`--test-reporter-destination=/tmp/cov/${n}.lcov`,'--test-reporter=spec',`--test-reporter-destination=/tmp/cov/${n}.spec`,'tests/'+f],{stdio:'ignore'});
  p.on('exit',code=>{running--;out.push({n,code,s:(Date.now()-t)/1000});fs.writeFileSync('/tmp/cov/times.json',JSON.stringify(out));if(i>=files.length&&!running)console.log('DONE');next();});
 }
}
next();
