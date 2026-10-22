/* Corre os hunts (`tests/hunt-*.mjs`) em paralelo.
   Cada hunt sobe o próprio Electron com runtime de mentira e porta própria, então
   dá para rodar vários de uma vez sem que um atropele o outro — em série a rodada
   passa de sete minutos; dois por vez (o default) corta boa parte disso.

   Uso:
     node tests/run-hunts.mjs                    # todos, 2 por vez
     node tests/run-hunts.mjs fila               # só os arquivos que casam
     node tests/run-hunts.mjs --jobs 4           # mais paralelismo
     node tests/run-hunts.mjs fila --filter nota # 1º argv de cada hunt (bloco/cenário)

   Corredor, status "pulado" e prazo por arquivo: `tests/run-suite.mjs`. */
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs,runSuite} from './run-suite.mjs';
import {huntFiles} from './suite-files.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
/* Dois por vez é o default: cada hunt sobe um Electron inteiro, e com mais a
   máquina satura (o app demora a pintar e o cenário estoura o timeout — falso
   negativo). Medido em #48, três rodadas por valor, sem outra sessão com Electron:
   2 por vez ~306 s e zero falhas; 3 por vez ~209 s mas `hunt-activity-ui` reprovou
   em 1 das 3 (o card estoura o próprio "demorou demais para carregar"); 4 por vez
   ~160 s com 2 falhas das 3. Por isso o default fica em 2. `--jobs 3`/`4` numa
   máquina folgada, `--jobs 1` para investigar. */
const {jobs,block,timeout,verbose,match}=parseArgs(process.argv.slice(2),{jobs:2});

const files=huntFiles(match);
if(!files.length){
 console.log(`nenhum hunt casa com "${match}"`);
 process.exit(1);
}
process.exit(await runSuite({label:'hunts',dir:here,files,jobs,block,timeout,verbose}));
