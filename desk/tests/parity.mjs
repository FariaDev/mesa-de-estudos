// npm run test:parity — roda cada `tests/*-parity.mjs` da pasta.
// A lista vem da varredura, não de uma lista à mão: foi uma lista à mão que
// deixou o `state-adapter.cjs` fora do bundle. Cada verificador compara a lógica
// antiga com o núcleo Bend e sai != 0 quando diverge — é a ponte entre as leis
// (que provam o núcleo) e o host (que pode ignorá-lo). Node puro, sem Electron.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const app = path.resolve(here, '..');
const files = fs.readdirSync(here).filter((f) => f.endsWith('-parity.mjs')).sort();

if (!files.length) {
  console.error('test:parity: nenhum *-parity.mjs encontrado em tests/');
  process.exit(1);
}

const failed = [];
for (const file of files) {
  const started = Date.now();
  const run = spawnSync(process.execPath, [path.join(here, file)], {cwd: app, stdio: 'inherit'});
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  if (run.status) failed.push(file);
  console.log(`parity ${run.status ? 'FALHOU' : 'ok'} ${file} (${seconds}s)`);
}

if (failed.length) {
  console.error(`test:parity: ${failed.length} de ${files.length} falharam: ${failed.join(', ')}`);
  process.exit(1);
}
console.log(`test:parity: ${files.length} verificadores de paridade ok.`);
