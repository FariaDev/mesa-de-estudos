/* Portão do núcleo do `npm test`, com cache por conteúdo.

   `npm run build:bend` + `npm run test:proof` + `npm run test:parity` custam perto
   de um minuto e só podem mudar quando muda o que entra neles. Quem diz o que
   entra é `scripts/gate-hash.mjs`: o núcleo Bend (`core/**`), os artefatos
   gerados dos dois apps, os verificadores de paridade (e os hosts que eles
   importam) e o `package.json`. Se o hash é o mesmo da última rodada aprovada, os
   três são pulados — dizendo que pulou, nunca em silêncio.

   `npm run check` (sintaxe dos hosts) roda sempre: é barato e é o que pega o
   arquivo pela metade de quem está editando.

   Os três passos rodam por `scripts/gate-run.mjs`, que resolve o comando do npm
   por plataforma (Windows precisa de `npm.cmd` com shell) e nunca sai calado
   quando o spawn falha.

   Para forçar a rodada inteira: `MESA_GATE_CACHE=0 npm test`.
   O portão de release (`npm run verify:bend`) NÃO usa este cache. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {gateHash} from './gate-hash.mjs';
import {runStep} from './gate-run.mjs';

const desk=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const root=path.resolve(desk,'..');
const CACHE=path.join(desk,'node_modules','.cache','mesa-core-gate.json');

/* Um passo que não roda (npm fora do PATH, interrupção) tem de DIZER isso: era
   o caso em que o portão saía com 1 sem uma linha de explicação. */
function run(script){
 const out=runStep({script,cwd:desk});
 if(!out.ok)process.exit(out.status||1);
}

run('check');

const {hash,count}=gateHash({root,desk});
const forced=process.env.MESA_GATE_CACHE==='0';
let cached=null;
try{cached=JSON.parse(fs.readFileSync(CACHE,'utf8'));}catch{}

if(!forced&&cached?.hash===hash){
 console.log(`portão já aprovado para este conteúdo (${count} arquivos: núcleo, artefatos, verificadores de paridade e o que eles importam) — pulando build, provas e paridade.`);
 console.log('(MESA_GATE_CACHE=0 npm test força a rodada inteira.)');
 process.exit(0);
}

run('build:bend');
run('test:proof');
run('test:parity');
/* O hash de agora, não o de antes: o build escreve os artefatos e é o
   resultado dele que a próxima rodada vai reencontrar. */
const after=gateHash({root,desk});
fs.mkdirSync(path.dirname(CACHE),{recursive:true});
fs.writeFileSync(CACHE,JSON.stringify({hash:after.hash,count:after.count,at:new Date().toISOString()},null,1));
console.log(`portão do núcleo ok: build, provas e paridade (${after.count} arquivos; hash guardado).`);
