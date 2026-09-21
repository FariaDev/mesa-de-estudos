// Roda tests/ui-smoke.mjs três vezes seguidas; para no primeiro fracasso propagando o exit code.
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const desk=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
for(let i=1;i<=3;i++){
 const run=spawnSync(process.execPath,['tests/ui-smoke.mjs'],{cwd:desk,stdio:'inherit'});
 if(run.status){
  console.error(`test:ui:x3: o smoke falhou na execução ${i} de 3.`);
  process.exit(run.status||1);
 }
}
console.log('SMOKE x3 STABLE');
