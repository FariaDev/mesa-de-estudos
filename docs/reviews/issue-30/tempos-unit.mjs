// Tempo de parede de cada tests/*.test.mjs, um por vez (mede o custo isolado).
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
const dir = new URL('../../../desk/tests/', import.meta.url);
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.test.mjs')).sort();
const out = {};
for (const f of files) {
  const t = Date.now();
  const r = spawnSync(process.execPath, ['--test', 'tests/' + f], {cwd: new URL('../', dir).pathname, encoding: 'utf8'});
  out[f] = {s: +((Date.now() - t) / 1000).toFixed(1), ok: r.status === 0};
}
fs.writeFileSync(new URL('./unit-times.json', import.meta.url), JSON.stringify(out, null, 1));
console.log('feito', files.length);
