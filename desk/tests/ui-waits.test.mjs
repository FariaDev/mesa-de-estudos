/* Esperas fixas nos testes de janela e hunts (#48), sem Electron.

   `waitForTimeout(N)`, `sleep(N)` e `new Promise(r=>setTimeout(r,N))` só ficam
   onde o próprio tempo é o que se testa (debounce, timeout, "nada acontece em
   N ms"), e dizem isso num comentário `espera fixa: <motivo>` na mesma linha ou
   na de cima. O que espera um estado da tela usa `waitForFunction`,
   `locator.waitFor` ou `pollUntil`/`layoutStable` de `waits.mjs`.

   O teto abaixo só pode CAIR: ao converter mais uma espera, baixe o número no
   mesmo commit. Subir exige uma espera nova sem o comentário — troque por
   condição ou escreva por que o tempo é o que se testa. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {huntFiles,uiFiles} from './suite-files.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
export const MAX_UNMARKED_FIXED_WAITS=0;

const FIXED_WAIT=/\bwaitForTimeout\(|\bsleep\(\s*[^\s)]|new Promise\(.*=>\s*setTimeout\(/;
const MARKER=/espera fixa:/;
const HELPER_DEFINITION=/^\s*(?:export\s+)?const\s+sleep\s*=/;

/** Linhas (1-based) de `source` com espera fixa sem o comentário `espera fixa:`. */
export function unmarkedFixedWaits(source){
 const lines=source.split('\n');
 const found=[];
 lines.forEach((line,index)=>{
  if(!FIXED_WAIT.test(line)||HELPER_DEFINITION.test(line))return;
  if(MARKER.test(line)||MARKER.test(lines[index-1]||''))return;
  found.push(index+1);
 });
 return found;
}

function unmarkedByFile(){
 const files=[...new Set([...uiFiles(),...huntFiles()])];
 return files.map(file=>({file,lines:unmarkedFixedWaits(fs.readFileSync(path.join(here,file),'utf8'))})).filter(row=>row.lines.length);
}

test('unmarkedFixedWaits aceita o comentário na linha ou na de cima',()=>{
 const source=[
  "await page.waitForTimeout(300);",
  "await page.waitForTimeout(300);// espera fixa: debounce de 250 ms",
  "// espera fixa: nada acontece em 1 s",
  "await sleep(1000);",
  "const sleep=ms=>new Promise(r=>setTimeout(r,ms));",
  "await new Promise(r=>setTimeout(r,50));"
 ].join('\n');
 assert.deepEqual(unmarkedFixedWaits(source),[1,6]);
});

test('esperas fixas sem comentário nos testes de janela e hunts não passam do teto',()=>{
 const rows=unmarkedByFile();
 const total=rows.reduce((sum,row)=>sum+row.lines.length,0);
 const detail=rows.map(row=>`${row.file}: ${row.lines.length} (linhas ${row.lines.join(', ')})`).join('\n');
 assert.ok(total<=MAX_UNMARKED_FIXED_WAITS,`${total} esperas fixas sem "espera fixa:" (teto ${MAX_UNMARKED_FIXED_WAITS}):\n${detail}`);
});
