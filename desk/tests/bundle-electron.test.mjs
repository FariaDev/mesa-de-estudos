import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {ensureBundleExists, syncBundleElectron} = require('../bundle-electron.cjs');

/* Fake do sistema do macOS (`plutil`, `ditto`): o plist é um JSON de teste. */
function fakeMacSystem({failCopyOf = ''} = {}) {
  const read = (plist) => JSON.parse(fs.readFileSync(plist, 'utf8'));
  return {
    readPlistValue: (plist, key) => read(plist)[key] || '',
    writePlistValue: (plist, key, value) => fs.writeFileSync(plist, JSON.stringify({...read(plist), [key]: value})),
    copyAppTree(from, to) {
      if (failCopyOf && from.endsWith(failCopyOf)) throw Error(`cópia falhou: ${failCopyOf}`);
      fs.cpSync(from, to, {recursive: true});
    },
  };
}

function fakeApp(root, name, version, marker, extra = {}) {
  const app = path.join(root, name);
  fs.mkdirSync(path.join(app, 'Contents', 'Frameworks'), {recursive: true});
  fs.mkdirSync(path.join(app, 'Contents', 'MacOS'), {recursive: true});
  fs.mkdirSync(path.join(app, 'Contents', 'Resources', 'app'), {recursive: true});
  fs.writeFileSync(path.join(app, 'Contents', 'Info.plist'), JSON.stringify({CFBundleVersion: version, CFBundleName: name, ...extra}));
  fs.writeFileSync(path.join(app, 'Contents', 'Frameworks', 'lib'), marker);
  fs.writeFileSync(path.join(app, 'Contents', 'MacOS', 'Electron'), marker);
  fs.writeFileSync(path.join(app, 'Contents', 'Resources', 'app', 'dados'), 'payload');
  return app;
}

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-bundle-electron-'));
  t.after(() => fs.rmSync(root, {recursive: true, force: true}));
  const source = fakeApp(root, 'Electron.app', '45.2.0', 'novo', {LSMinimumSystemVersion: '12.0'});
  return {root, source, app: fakeApp(root, 'Mesa de Estudos.app', '44.7.2', 'velho', {LSMinimumSystemVersion: '11.0'})};
}

const read = (app, ...rel) => fs.readFileSync(path.join(app, 'Contents', ...rel), 'utf8');
const plist = (app) => JSON.parse(read(app, 'Info.plist'));

test('#103: bundle atrás recebe o Electron novo e mantém payload e nome', (t) => {
  const {source, app} = fixture(t);
  const result = syncBundleElectron({source, app, deps: fakeMacSystem()});
  assert.deepEqual(result, {changed: true, from: '44.7.2', to: '45.2.0'});
  assert.equal(read(app, 'Frameworks', 'lib'), 'novo');
  assert.equal(read(app, 'MacOS', 'Electron'), 'novo');
  assert.equal(read(app, 'Resources', 'app', 'dados'), 'payload');
  assert.equal(plist(app).CFBundleVersion, '45.2.0');
  assert.equal(plist(app).LSMinimumSystemVersion, '12.0');
  assert.equal(plist(app).CFBundleName, 'Mesa de Estudos.app');
  assert.deepEqual(fs.readdirSync(path.join(app, 'Contents')).filter((name) => /\.(novo|antigo)$/.test(name)), []);
});

test('#103: bundle na versão certa não é tocado', (t) => {
  const {root, source} = fixture(t);
  const app = fakeApp(root, 'Igual.app', '45.2.0', 'mesmo');
  assert.equal(syncBundleElectron({source, app, deps: fakeMacSystem()}).changed, false);
  assert.equal(read(app, 'Frameworks', 'lib'), 'mesmo');
});

test('#103: falha ao copiar mantém o Electron antigo inteiro e não deixa sobra', (t) => {
  const {source, app} = fixture(t);
  assert.throws(() => syncBundleElectron({source, app, deps: fakeMacSystem({failCopyOf: 'Electron'})}), /cópia falhou/);
  assert.equal(read(app, 'Frameworks', 'lib'), 'velho');
  assert.equal(read(app, 'MacOS', 'Electron'), 'velho');
  assert.equal(plist(app).CFBundleVersion, '44.7.2');
  assert.deepEqual(fs.readdirSync(path.join(app, 'Contents')).filter((name) => /\.(novo|antigo)$/.test(name)), []);
});

test('#103: versão ilegível na origem recusa com o caminho esperado', (t) => {
  const {root, app} = fixture(t);
  const source = fakeApp(root, 'Sem.app', '', 'x');
  assert.throws(() => syncBundleElectron({source, app, deps: fakeMacSystem()}), /CFBundleVersion/);
  assert.equal(read(app, 'Frameworks', 'lib'), 'velho');
});

test('clone novo ganha o .app a partir do Electron; .app existente fica', (t) => {
  const {root, source, app} = fixture(t);
  assert.equal(ensureBundleExists({source, app, deps: fakeMacSystem()}), false);
  assert.equal(read(app, 'Frameworks', 'lib'), 'velho');
  const fresh = path.join(root, 'Novo.app');
  assert.equal(ensureBundleExists({source, app: fresh, deps: fakeMacSystem()}), true);
  assert.equal(read(fresh, 'Frameworks', 'lib'), 'novo');
  assert.throws(() => ensureBundleExists({source: path.join(root, 'nada'), app: path.join(root, 'Outro.app'), deps: fakeMacSystem()}), /Electron ausente/);
});
