import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {ptText} from './pt-text.mjs';
import {tempDir} from './temp-dir.mjs';

/* Painel "Componentes" com tudo injetado (fetch e comandos falsos, sem rede):
   aviso de Node antigo (decisão do núcleo), Xournal++ só informativo e a ordem
   das linhas vinda de `dialogsCore.componentIds()`. */
const require = createRequire(import.meta.url);
const components = require('../components.cjs');
const updater = require('../updater.cjs');

const tmp = () => tempDir('mesa-components-test');

/* Nenhum teste enxerga o claude nem o binário do SDK DESTA máquina. */
const NO_CLAUDE = {claudeLauncher: ''};

test('collect: linhas na ordem do núcleo, Mesa pelo cache do updater', async () => {
  const deskDir = tmp();
  const cacheFile = path.join(deskDir, 'update.json');
  updater.writeCache(cacheFile, {release: {at: Date.now(), version: '0.4.1', notes: '', url: ''}});
  const fetchJson = async (url) => {
    if (url === updater.XOURNAL_RELEASES_URL) return {tag_name: 'v1.2.7'};
    throw Error('URL inesperada: ' + url);
  };
  const run = async () => ({stdout: ''});
  const {rows} = await components.collect({
    deskDir, config: {}, cacheFile, version: '0.4.0', manual: true, fetchJson, run,
    platform: 'linux', nodeVersion: '22.19.0', envPath: '', ...NO_CLAUDE,
  });
  assert.deepEqual(rows.map((r) => r.id), ['claude', 'node', 'xournal'], 'ordem: Claude Code, Node, Xournal++ (a Mesa não é linha)');

  const [claude, node, xournal] = rows;
  assert.equal(claude.version, '', 'sem launcher não há versão');
  assert.equal(claude.state, 'unknown');
  assert.match(ptText(claude.hint), /Não encontrado/);

  assert.equal(node.state, 'ok');
  assert.equal(node.version, '22.19.0');
  assert.equal(ptText(node.label), 'Node (sistema)', 'o Node do painel é o do sistema (fato injetado aqui)');
  assert.equal(node.hint, '');

  assert.equal(xournal.state, 'unknown', 'sem exec no fake, a versão do Xournal++ é desconhecida');
  assert.equal(xournal.link, updater.XOURNAL_SITE_URL);
  assert.equal(ptText(xournal.linkLabel), 'Abrir o site');
  assert.equal(xournal.canUpdate, false, 'o app não atualiza o Xournal++');
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
  const base = {deskDir: tmp(), config: {}, cacheFile: '', version: '0.4.0', testMode: true, run: async () => ({stdout: ''}), platform: 'linux', envPath: '', ...NO_CLAUDE};
  const comSistema = await components.collect({...base, nodeVersion: '24.4.0', nodeSource: 'system'});
  const comNode = comSistema.rows.find((row) => row.id === 'node');
  assert.equal(comSistema.rows.some((row) => row.id === 'pi'), false, 'a linha do Pi não existe mais');
  assert.equal(ptText(comNode.label), 'Node (sistema)');
  const semSistema = await components.collect({...base, nodeVersion: '22.19.0', nodeSource: 'embedded'});
  const semNode = semSistema.rows.find((row) => row.id === 'node');
  assert.equal(ptText(semNode.label), 'Node (embutido)');
  assert.match(ptText(semNode.hint), /node do sistema/);
});

test('collect: Node abaixo de 22.19 avisa (o corte é do núcleo)', async () => {
  const base = {deskDir: tmp(), config: {}, cacheFile: '', version: '0.4.0', testMode: true, run: async () => ({stdout: ''}), platform: 'linux', envPath: '', ...NO_CLAUDE};
  const antigo = await components.collect({...base, nodeVersion: '22.18.0'});
  const antigoNode = antigo.rows.find((row) => row.id === 'node');
  assert.equal(antigoNode.state, 'warn');
  assert.match(ptText(antigoNode.note), /22\.19/);
  const limite = await components.collect({...base, nodeVersion: '22.19.0'});
  assert.equal(limite.rows.find((row) => row.id === 'node').state, 'ok');
  const velho = await components.collect({...base, nodeVersion: '20.11.0'});
  assert.equal(velho.rows.find((row) => row.id === 'node').state, 'warn');
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
      throw Error('URL inesperada');
    },
    run, platform: 'darwin', nodeVersion: '22.19.0', envPath: '', ...NO_CLAUDE,
  });
  assert.ok(chamadas.some(([cmd]) => cmd.endsWith('PlistBuddy')), 'a versão vem do plist');
  const xournal = rows.find((row) => row.id === 'xournal');
  assert.equal(xournal.version, '1.2.5');
  assert.equal(xournal.state, 'outdated');
  assert.equal(xournal.latest, '1.2.7');
  assert.equal(xournal.canUpdate, false, 'informativo: o app não mexe no Xournal++');
  assert.equal(xournal.link, updater.XOURNAL_SITE_URL);
});

/* #51: a Mesa usa só o Claude Code instalado. A linha diz a faixa quando a
   versão dele fica fora, avisa "mais nova que a testada" sem bloquear e não
   fala mais em reserva. */
test('linha do Claude Code: fora da faixa diz a faixa; mais nova só avisa; sem reserva', async () => {
  const tested = require('../src/tested-versions.json');
  const row = async (version) => {
    const run = async (file, args) => (file === '/x/claude' && args[0] === '--version' ? {stdout: `${version} (Claude Code)\n`} : {stdout: ''});
    const {rows} = await components.collect({
      deskDir: tmp(), config: {}, cacheFile: '', version: '0.4.0', testMode: true, run,
      platform: 'linux', nodeVersion: '22.19.0', envPath: '', claudeLauncher: '/x/claude', latestOverride: {claude: version},
    });
    return rows.find((r) => r.id === 'claude');
  };
  const old = await row('2.1.250');
  assert.equal(old.version, '2.1.250');
  assert.equal(ptText(old.hint), `Atualize o Claude Code: a versão 2.1.250 é anterior à faixa que a Mesa aceita (${tested.claudeMinimum} a 2.1.x).`);
  const ahead = await row('2.1.400');
  assert.equal(ahead.hint, '');
  assert.equal(ahead.ahead, true);
  assert.match(ptText(ahead.warning), /mais nova que a testada/);
  const atTested = await row(tested.claude);
  assert.equal(atTested.hint, '');
  assert.equal(atTested.ahead, false);
  for (const r of [old, ahead, atTested]) assert.doesNotMatch(JSON.stringify(r), /[Rr]eserva/);
});
