/* Por teste: literais ESPERADOS (fora do nome do teste e da mensagem final de
   cada assert) que não aparecem nas leis/provas/núcleo do módulo.
   Uso: node valores-nas-leis.mjs arquivo:modulo[,modulo2] ... */
import fs from 'node:fs';
const root = new URL('../../../', import.meta.url).pathname;
for (const spec of process.argv.slice(2)) {
  const [file, mods] = spec.split(':');
  const src = fs.readFileSync(`${root}desk/tests/${file}.test.mjs`, 'utf8');
  const hay = mods.split(',').flatMap((m) => ['laws/', 'proofs/', ''].map((d) => fs.readFileSync(`${root}core/${d}${m}.bend`, 'utf8'))).join('\n');
  const parts = src.split(/\n(?=test\()/);
  console.log(`\n## ${file} (${mods})`);
  for (const p of parts.slice(1)) {
    const name = (p.match(/^test\('((?:[^'\\]|\\.)*)'/) || [])[1] || '?';
    let body = p.slice(p.indexOf('\n'));
    body = body.replace(/,\s*'(?:[^'\\\n]|\\.)*'\s*\)\s*;/g, ');').replace(/,\s*`[^`]*`\s*\)\s*;/g, ');');
    const lits = new Set();
    for (const m of body.matchAll(/'((?:[^'\\\n]|\\.)+)'/g)) { const s = m[1].replace(/\\'/g, "'"); if (s.length >= 3 && !/^node:|^\.\.?\//.test(s)) lits.add(s); }
    const miss = [...lits].filter((s) => !hay.includes(s));
    console.log(`- ${miss.length === 0 ? 'OK ' : 'FALTA'} [${lits.size - miss.length}/${lits.size}] ${name.slice(0, 90)}${miss.length ? '\n      ' + miss.slice(0, 6).map((s) => JSON.stringify(s.slice(0, 50))).join(' ') : ''}`);
  }
}
