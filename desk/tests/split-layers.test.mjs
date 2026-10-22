// Módulos divididos em camadas na #43 fase 2: a porta pública reexporta as
// funções das camadas (os mesmos objetos) e cada camada só requer as de baixo.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const DESK = path.join(import.meta.dirname, '..');

/** Porta pública, prefixo das camadas (quando difere do nome da porta), módulos
 *  antigos com o mesmo prefixo que não são camada, camadas da mais baixa para a
 *  mais alta e um nome reexportado de cada. */
const SPLITS = [
  {portal: 'src/study-data/search.cjs', layers: {
    'search-text.cjs': 'fold', 'search-sources.cjs': 'gather', 'search-index.cjs': 'loadIndex', 'search-extract.cjs': 'defaultPdfText'}},
  {portal: 'src/study-data/backup.cjs', layers: {
    'backup-files.cjs': 'snapshotsRoot', 'backup-config.cjs': 'readConfig', 'backup-capture.cjs': 'buildSources',
    'backup-snapshot.cjs': 'snapshot', 'backup-schedule.cjs': 'shouldAutoBackup', 'backup-relocate.cjs': null}},
  {portal: 'free-workspaces.cjs', base: 'free-workspace', layers: {
    'free-workspace-record.cjs': 'folderSlug', 'free-workspace-store.cjs': 'ensureWorkspace',
    'free-workspace-materials.cjs': 'importPdf', 'free-workspace-promotion.cjs': 'preparePromotion'}},
  {portal: 'updater.cjs', layers: {
    'updater-core.cjs': 'semverCompare', 'updater-check.cjs': 'checkForUpdates', 'updater-files.cjs': 'applyZip', 'updater-worker.cjs': 'spawnWorker'}},
  {portal: 'activity-runtime.cjs', base: 'activity', outside: ['activity-store.cjs'], layers: {
    'activity-protocol.cjs': 'parseActivityUrl', 'activity-lockdown-script.cjs': 'LOCKDOWN_SCRIPT',
    'activity-page-script.cjs': 'RUNTIME_SCRIPT', 'activity-document.cjs': 'buildActivityDocument'}},
  {portal: 'sidechat.cjs', base: 'sidechat', outside: ['sidechat-host.cjs'], layers: {'sidechat-store.cjs': 'conversationList'}},
  {portal: 'src/study-data/packages.cjs', base: 'package', layers: {
    'package-common.cjs': 'writePackageFile', 'package-source.cjs': 'importNoteStore', 'package-read.cjs': 'openPackage', 'package-import.cjs': 'importPackage'}},
];

for (const {portal, layers, base: layerBase, outside = []} of SPLITS) {
  const dir = path.dirname(path.join(DESK, portal));
  const names = Object.keys(layers);

  test(`${portal} reexporta as funções das camadas, não cópias`, () => {
    const api = require(path.join(DESK, portal));
    for (const [layer, name] of Object.entries(layers)) {
      if (!name) continue;
      assert.equal(api[name], require(path.join(dir, layer))[name], `${name} devia vir de ${layer}`);
    }
  });

  test(`${portal}: cada camada só requer camadas abaixo dela`, () => {
    names.forEach((name, index) => {
      const source = fs.readFileSync(path.join(dir, name), 'utf8');
      const base = layerBase || path.basename(portal, '.cjs');
      const local = [...source.matchAll(new RegExp(`require\\('\\./(${base}[^']*)'\\)`, 'g'))].map(match => match[1]);
      for (const dep of local.filter(name => !outside.includes(name))) {
        const at = names.indexOf(dep);
        assert.ok(at > -1 && at < index, `${name} requer ${dep}; esperado só camadas abaixo de ${name}`);
      }
    });
  });
}
