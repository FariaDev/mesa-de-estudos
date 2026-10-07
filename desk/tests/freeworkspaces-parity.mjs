// Paridade do contrato da aba Livre: os limites, a sequência de nomes e o
// recorte que o host (free-workspaces.cjs / material-pdf.cjs) aplica têm de
// sair do núcleo Bend (src/generated/freeworkspaces.core.js), não de literais
// repetidos. Roda da pasta desk: `node tests/freeworkspaces-parity.mjs`.
import {createRequire} from 'node:module';
import freeCore from '../src/generated/freeworkspaces.core.js';

const require = createRequire(import.meta.url);
const store = require('../free-workspaces.cjs');
const materialPdf = require('../material-pdf.cjs');

let checked = 0;
const same = (label, a, b) => {
  if (a !== b) {
    console.error(`divergiu ${label}: host=${JSON.stringify(a)} núcleo=${JSON.stringify(b)}`);
    process.exit(1);
  }
  checked += 1;
};

for (const [name, host, core] of [
  ['maxTitle', store.maxTitle(), Number(freeCore.maxTitle())],
  ['maxName', store.maxName(), Number(freeCore.maxName())],
  ['maxDraftChars', store.maxDraftChars(), Number(freeCore.maxDraftChars())],
  ['maxMaterials', store.maxMaterials(), Number(freeCore.maxMaterials())],
  ['maxSlug', store.maxSlug(), Number(freeCore.maxSlug())],
  ['freeCourseId', store.freeCourseId(), freeCore.freeCourseId()],
  ['freeCourseName', store.freeCourseName(), freeCore.freeCourseName()],
  ['defaultTitle', store.defaultTitle(), freeCore.defaultTitle()],
]) same(name, host, core);

// O host corta o rascunho com slice; o número continua sendo o do núcleo e o
// miolo (espaços/linhas) não é aparado.
const longDraft = 'x'.repeat(store.maxDraftChars() + 50);
same('draft cap', store.cutDraft(longDraft).length, store.maxDraftChars());
same('draft keep', store.cutDraft('  linha  '), '  linha  ');

// A sequência de nomes que o host grava é exatamente a do núcleo.
const stem = store.sanitizeStem('Limites');
for (const [attempt, expected] of [[0, 'Limites.pdf'], [1, 'Limites-2.pdf'], [2, 'Limites-3.pdf'], [9, 'Limites-10.pdf']]) {
  same(`candidate ${attempt}`, freeCore.candidateName(stem, '.pdf', BigInt(attempt)), expected);
  same(`folder ${attempt}`, freeCore.candidateFolder(stem, BigInt(attempt)), expected.replace(/\.pdf$/, ''));
}

// Sanitização nunca passa dos tetos do núcleo.
same('stem cap', store.sanitizeStem('a'.repeat(1000)).length <= store.maxName() - 4, true);
same('slug cap', store.folderSlug('a'.repeat(1000)).length <= store.maxSlug(), true);
same('pdf stem cap', materialPdf.sanitizeStem('a'.repeat(1000)).length <= store.maxName() - 4, true);
same('stem reserved', store.sanitizeStem('CON'), '_CON');
same('slug reserved', store.folderSlug('CON'), '_CON');
same('payload kind', store.workspacePayload({id: 's', title: 'T', materials: [], promotion: null}).kind, 'free');

console.log(`FREE PASSED (${checked} comparações)`);
