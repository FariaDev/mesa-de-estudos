/* Teste de mentira para o corredor: sobe um "Electron" (grupo próprio, surdo ao
   SIGTERM), imprime `FILHO <pid>` e faz o que o modo pedir.
     trava        — fica preso (com a guarda dos testes)
     trava-surdo  — fica preso e ignora SIGTERM (sem guarda, como código preso)
     sai-sujo     — sai com 0 sem guarda, deixando o filho vivo (depois de 1,5 s,
                    o tempo de um teste de verdade)
     sai-guardado — sai com 1 com a guarda (o caminho de um teste que reprova) */
import {spawn} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {guardChildren} from '../../proc-tree.mjs';

const mode=process.argv[2];
if(mode==='trava'||mode==='sai-guardado')guardChildren();
if(mode==='trava-surdo')process.on('SIGTERM',()=>{});
const here=path.dirname(fileURLToPath(import.meta.url));
const child=spawn(process.execPath,[path.join(here,'electron-like.cjs')],{detached:true,stdio:['ignore','pipe','ignore']});
child.stdout.once('data',()=>{
 console.log(`FILHO ${child.pid}`);
 if(mode==='sai-sujo'){child.unref();child.stdout.destroy();setTimeout(()=>process.exit(0),1500);}
 if(mode==='sai-guardado')process.exit(1);
});
setInterval(()=>{},1e6);
