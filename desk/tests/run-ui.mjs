/* Corre os testes de janela (Electron real, runtime sintético) em paralelo
   limitado — o mesmo corredor de `npm run hunts`.

   Uso:
     npm run ui                          # todos, 3 por vez
     npm run ui -- composer              # só os arquivos que casam
     npm run ui -- --jobs 4 --verbose    # mais paralelismo, saída inteira

   A lista de arquivos e os motivos de cada exclusão: `tests/suite-files.mjs`. */
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs,runSuite} from './run-suite.mjs';
import {uiFiles} from './suite-files.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
/* Três por vez é o default (#48), medido em três rodadas seguidas por valor, sem
   outra sessão com Electron aberto: 2 por vez ~311 s, 3 por vez ~236 s, 4 por vez
   ~204 s, todas sem falha. O 4 também fechou limpo, mas deixa menos folga para
   quem abre outro programa pesado junto; `--jobs 1` serve para investigar. */
const {jobs,block,timeout,verbose,match}=parseArgs(process.argv.slice(2),{jobs:3});

const files=uiFiles(match);
if(!files.length){
 console.log(`nenhum teste de janela casa com "${match}"`);
 process.exit(1);
}
process.exit(await runSuite({label:'janelas',dir:here,files,jobs,block,timeout,verbose}));
