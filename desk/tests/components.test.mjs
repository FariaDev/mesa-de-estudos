import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';

/* Painel "Componentes" com tudo injetado (fetch e comandos falsos, sem rede):
   resolução da versão do Pi, aviso de Node antigo (decisão do núcleo), Xournal++
   só informativo e a ordem das linhas vinda de `dialogsCore.componentIds()`. */
const require = createRequire(import.meta.url);
const components = require('../components.cjs');
const updater = require('../updater.cjs');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-components-test-'));

function seedLocalPi(deskDir, {version = '0.90.0', symlink = true} = {}) {
  const pkgDir = path.join(deskDir, 'node_modules', '@earendil-works', 'pi-coding-agent');
  fs.mkdirSync(path.join(pkgDir, 'dist'), {recursive: true});
  fs.writeFileSync(path.join(pkgDir, 'package.json'), JSON.stringify({name: '@earendil-works/pi-coding-agent', version}));
  fs.writeFileSync(path.join(pkgDir, 'dist', 'cli.js'), '#!/usr/bin/env node\n');
  const bin = path.join(deskDir, 'node_modules', '.bin');
  fs.mkdirSync(bin, {recursive: true});
  const alvo = path.join(pkgDir, 'dist', 'cli.js');
  if (symlink) fs.symlinkSync(path.relative(bin, alvo), path.join(bin, 'pi'));
  else fs.writeFileSync(path.join(bin, 'pi'), '#!/usr/bin/env node\n');
  fs.chmodSync(path.join(bin, 'pi'), 0o755);
  return path.join(bin, 'pi');
}

test('piVersion: package.json do binário resolvido (symlink do .bin)', async () => {
  const deskDir = tmp();
  const pi = seedLocalPi(deskDir, {version: '0.90.0'});
  let chamadas = 0;
  const run = async () => { chamadas++; return {stdout: ''}; };
  assert.equal(await components.piVersion({piPath: pi, run}), '0.90.0');
  assert.equal(chamadas, 0, 'sem package.json o fallback seria o --version; aqui não precisou');
});

test('piVersion: sem package.json por perto, cai no pi --version com timeout', async () => {
  const deskDir = tmp();
  const pi = seedLocalPi(deskDir, {symlink: false});
  fs.rmSync(path.join(deskDir, 'node_modules', '@earendil-works'), {recursive: true, force: true});
  const chamadas = [];
  const run = async (cmd, args, opts) => {
    chamadas.push({cmd, args, timeout: opts?.timeout});
    return {stdout: 'pi 0.86.1\n'};
  };
  assert.equal(await components.piVersion({piPath: pi, run}), '0.86.1');
  assert.deepEqual(chamadas, [{cmd: pi, args: ['--version'], timeout: 5000}]);
  assert.equal(await components.piVersion({piPath: pi, run: async () => { throw Error('travou'); }}), '', 'timeout/falha = sem versão, sem erro');
});

test('piIsLocal: só o local da Mesa é atualizável pela Mesa (.pi-local e node_modules antigo)', () => {
  const deskDir = tmp();
  const pi = seedLocalPi(deskDir);
  assert.equal(components.piIsLocal(pi, deskDir), true);
  assert.equal(components.piLocalRoot(pi, deskDir), 'node_modules');
  assert.equal(components.piIsLocal('/opt/homebrew/bin/pi', deskDir), false);
  assert.equal(components.piIsLocal('', deskDir), false);
  /* Contrato novo: o Pi da Mesa mora em desk/.pi-local (fora da árvore npm). */
  const local = path.join(deskDir, '.pi-local', 'node_modules', '.bin', 'pi');
  fs.mkdirSync(path.dirname(local), {recursive: true});
  fs.writeFileSync(local, '#!/usr/bin/env node\n');
  fs.chmodSync(local, 0o755);
  assert.equal(components.piIsLocal(local, deskDir), true);
  assert.equal(components.piLocalRoot(local, deskDir), '.pi-local');
  const real = fs.realpathSync.native ? fs.realpathSync(local) : fs.realpathSync(local);
  assert.equal(components.piIsLocal(real, deskDir), true, 'caminho resolvido também vale');
});

test('collect: linhas na ordem do núcleo, Mesa pelo cache do updater', async () => {
  const deskDir = tmp();
  seedLocalPi(deskDir, {version: '0.86.1'});
  const cacheFile = path.join(deskDir, 'update.json');
  updater.writeCache(cacheFile, {release: {at: Date.now(), version: '0.4.1', notes: '', url: ''}});
  const fetchJson = async (url) => {
    if (url === updater.PI_REGISTRY_URL) return {version: '0.90.0'};
    if (url === updater.XOURNAL_RELEASES_URL) return {tag_name: 'v1.2.7'};
    throw Error('URL inesperada: ' + url);
  };
  const run = async () => ({stdout: ''});
  const {rows, piLocal} = await components.collect({
    deskDir, config: {}, cacheFile, version: '0.4.0', manual: true, fetchJson, run,
    platform: 'linux', nodeVersion: '22.19.0', envPath: '',
  });
  assert.deepEqual(rows.map((r) => r.id), ['mesa', 'pi', 'node', 'xournal'], 'ordem: Mesa, Pi, Node, Xournal++');
  assert.equal(piLocal, true);

  const [mesa, pi, node, xournal] = rows;
  assert.equal(mesa.state, 'outdated');
  assert.equal(mesa.latest, '0.4.1');
  assert.equal(mesa.version, '0.4.0');
  assert.equal(mesa.canUpdate, false, 'a Mesa se atualiza pelo updater, não por aqui');

  assert.equal(pi.state, 'outdated');
  assert.equal(pi.latest, '0.90.0');
  assert.equal(pi.canUpdate, true, 'Pi local com versão nova = botão Atualizar Pi');
  assert.match(pi.hint, /node_modules|\.pi-local/);

  assert.equal(node.state, 'ok');
  assert.equal(node.version, '22.19.0');
  assert.equal(node.label, 'Node (sistema)', 'o Node do painel é o do sistema (fato injetado aqui)');
  assert.equal(node.hint, '');

  assert.equal(xournal.state, 'unknown', 'sem exec no fake, a versão do Xournal++ é desconhecida');
  assert.equal(xournal.link, updater.XOURNAL_SITE_URL);
  assert.equal(xournal.linkLabel, 'Ver página');
  assert.equal(xournal.canUpdate, false, 'o app não atualiza o Xournal++');
});

test('collect: Pi de PATH mostra o comando e não vira botão', async () => {
  const deskDir = tmp();
  const global = path.join(tmp(), 'bin');
  fs.mkdirSync(global, {recursive: true});
  const pi = path.join(global, 'pi');
  fs.writeFileSync(pi, '#!/usr/bin/env node\n');
  fs.chmodSync(pi, 0o755);
  const {rows} = await components.collect({
    deskDir,
    config: {},
    cacheFile: '',
    version: '0.4.0',
    testMode: true,
    piPath: pi,
    run: async () => ({stdout: '0.86.1\n'}),
    platform: 'linux',
    nodeVersion: '22.19.0',
    envPath: '',
  });
  const piRow = rows[1];
  assert.equal(piRow.version, '0.86.1');
  assert.equal(piRow.canUpdate, false);
  assert.match(piRow.hint, /npm install -g @earendil-works\/pi-coding-agent@latest/);
});

test('collect: sem Pi e sem registry = desconhecido, sem erro', async () => {
  const {rows} = await components.collect({
    deskDir: tmp(), config: {}, cacheFile: '', version: '0.4.0', testMode: true, piPath: '',
    run: async () => { throw Error('não roda'); }, platform: 'win32', nodeVersion: '22.19.0', envPath: '',
  });
  assert.equal(rows[0].state, 'unknown', 'Mesa sem checagem = desconhecido');
  assert.equal(rows[1].state, 'unknown');
  assert.match(rows[1].hint, /npm run setup/);
  assert.equal(rows[3].state, 'unknown');
  assert.match(rows[3].hint, /Configurações/);
});

test('collect: Node do SISTEMA é medido de verdade; sem node cai no embutido, rotulado', async () => {
  const chamadas = [];
  const medido = await components.systemNodeVersion({run: async (cmd, args, opts) => {
    chamadas.push({cmd, args, timeout: opts?.timeout});
    return {stdout: 'v24.4.1\n'};
  }});
  assert.deepEqual(medido, {version: '24.4.1', source: 'system'}, 'a versão vem do node --version do sistema');
  assert.deepEqual(chamadas, [{cmd: 'node', args: ['--version'], timeout: 5000}]);

  const embutido = await components.systemNodeVersion({run: async () => { throw Error('node não está no PATH'); }});
  assert.equal(embutido.source, 'embedded', 'sem resposta do sistema = runtime embutido');
  assert.equal(embutido.version, String(process.versions.node));

  /* E o painel rotula os dois: */
  const base = {deskDir: tmp(), config: {}, cacheFile: '', version: '0.4.0', testMode: true, run: async () => ({stdout: ''}), platform: 'linux', envPath: ''};
  const comSistema = await components.collect({...base, nodeVersion: '24.4.0', nodeSource: 'system'});
  assert.equal(comSistema.rows[2].label, 'Node (sistema)');
  const semSistema = await components.collect({...base, nodeVersion: '22.19.0', nodeSource: 'embedded'});
  assert.equal(semSistema.rows[2].label, 'Node (embutido)');
  assert.match(semSistema.rows[2].hint, /node do sistema/);
});

test('collect: Node abaixo de 22.19 avisa (o corte é do núcleo)', async () => {
  const base = {deskDir: tmp(), config: {}, cacheFile: '', version: '0.4.0', testMode: true, run: async () => ({stdout: ''}), platform: 'linux', envPath: ''};
  const antigo = await components.collect({...base, nodeVersion: '22.18.0'});
  assert.equal(antigo.rows[2].state, 'warn');
  assert.equal(antigo.rows[2].note, 'abaixo de 22.19 — o Pi exige Node 22.19+');
  const limite = await components.collect({...base, nodeVersion: '22.19.0'});
  assert.equal(limite.rows[2].state, 'ok');
  const velho = await components.collect({...base, nodeVersion: '20.11.0'});
  assert.equal(velho.rows[2].state, 'warn');
});

test('collect: Xournal++ no macOS lê o CFBundleShortVersionString e compara (só informativo)', async () => {
  const deskDir = tmp();
  const app = path.join(deskDir, 'Xournal++.app');
  fs.mkdirSync(path.join(app, 'Contents'), {recursive: true});
  fs.writeFileSync(path.join(app, 'Contents', 'Info.plist'), '<plist/>');
  const cacheFile = path.join(deskDir, 'update.json');
  updater.writeCache(cacheFile, {xournal: {at: Date.now(), version: '1.2.7'}});
  const chamadas = [];
  const run = async (cmd, args) => {
    chamadas.push([cmd, ...args]);
    return {stdout: '1.2.5\n'};
  };
  const {rows} = await components.collect({
    deskDir, config: {xournalPath: app}, cacheFile, version: '0.4.0', manual: true,
    fetchJson: async (url) => {
      if (url === updater.XOURNAL_RELEASES_URL) return {tag_name: 'v1.2.7'};
      if (url === updater.PI_REGISTRY_URL) return {version: '0.90.0'};
      throw Error('URL inesperada');
    },
    run, platform: 'darwin', nodeVersion: '22.19.0', envPath: '',
  });
  assert.ok(chamadas.some(([cmd]) => cmd.endsWith('PlistBuddy')), 'a versão vem do plist');
  const xournal = rows[3];
  assert.equal(xournal.version, '1.2.5');
  assert.equal(xournal.state, 'outdated');
  assert.equal(xournal.latest, '1.2.7');
  assert.equal(xournal.canUpdate, false, 'informativo: o app não mexe no Xournal++');
  assert.equal(xournal.link, updater.XOURNAL_SITE_URL);
});
