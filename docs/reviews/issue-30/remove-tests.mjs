/* Remove blocos `test('nome', …)` de nível de arquivo pelo nome exato.
   Uso: node remove-tests.mjs arquivo.test.mjs "nome 1" "nome 2" … */
import fs from 'node:fs';
const [file, ...names] = process.argv.slice(2);
const p = new URL(`../../../desk/tests/${file}`, import.meta.url).pathname;
let lines = fs.readFileSync(p, 'utf8').split('\n');
let removed = 0;
for (const name of names) {
  const i = lines.findIndex((l) => l.startsWith("test('") && l.includes(`'${name}'`) );
  if (i < 0) { console.error('não achei:', name); process.exitCode = 1; continue; }
  let j = i;
  while (j < lines.length && !/^\}\)\s*;?\s*$/.test(lines[j])) j++;
  // leva junto os comentários logo acima e UMA linha em branco
  let s = i;
  while (s > 0 && /^\s*(\/\/|\/\*|\*)/.test(lines[s - 1])) s--;
  let e = j + 1;
  if (lines[e] === '') e++;
  removed += e - s;
  lines.splice(s, e - s);
}
fs.writeFileSync(p, lines.join('\n'));
console.log(file, 'removidas', removed, 'linhas');
