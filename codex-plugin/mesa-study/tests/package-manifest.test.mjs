/* Testes do pacote estático: manifesto Codex (.codex-plugin/plugin.json),
   .mcp.json, marketplace local e assets. Somente leitura da árvore real;
   arquivos temporários são fixtures sintéticas sob o tmpdir. */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  ASSET_FILES,
  PLACEHOLDER_SIZE,
  buildPlaceholderPng,
  crc32,
  encodePng,
  ensurePlaceholderAssets,
} from '../scripts/make-assets.mjs';
import {ENV as SERVER_ENV, SERVER_VERSION} from '../server/config.mjs';

const pluginRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const marketplaceRoot = path.resolve(pluginRoot, '..');

/* SemVer completo (regex oficial do semver.org), para provar que o prerelease
   `-experimental` é versão válida de verdade — não uma constraint inventada. */
const SEMVER_RE =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;

function readJson(target) {
  return JSON.parse(fs.readFileSync(target, 'utf8'));
}

function assertInsideRoot(relative, label) {
  assert.ok(typeof relative === 'string' && relative.startsWith('./'), `${label} deve começar com ./: ${relative}`);
  assert.ok(!relative.split('/').includes('..'), `${label} não pode conter ..: ${relative}`);
  const resolved = path.resolve(pluginRoot, relative);
  assert.ok(resolved === pluginRoot || resolved.startsWith(pluginRoot + path.sep), `${label} deve ficar dentro do plugin: ${relative}`);
  return resolved;
}

function readPngHeader(buffer) {
  assert.deepEqual(
    [...buffer.subarray(0, 8)],
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    'assinatura PNG',
  );
  assert.equal(buffer.readUInt32BE(8), 13, 'IHDR com 13 bytes');
  assert.equal(buffer.subarray(12, 16).toString('ascii'), 'IHDR');
  const data = buffer.subarray(16, 29);
  const width = data.readUInt32BE(0);
  const height = data.readUInt32BE(4);
  assert.equal(crc32(buffer.subarray(12, 29)), buffer.readUInt32BE(29), 'CRC do IHDR');
  return {width, height};
}

test('manifesto Codex: plugin.json compatível, caminhos ./ e interface', () => {
  const manifest = readJson(path.join(pluginRoot, '.codex-plugin/plugin.json'));
  assert.equal(manifest.name, 'mesa-study');
  assert.match(manifest.version, SEMVER_RE, 'version precisa ser SemVer (prerelease permitido)');
  assert.equal(typeof manifest.description, 'string');
  assert.ok(manifest.description.length > 0 && manifest.description.length <= 4000);
  assert.equal(typeof manifest.author?.name, 'string');
  assert.equal(manifest.license, 'MIT');
  assert.ok(!('$schema' in manifest), 'o formato Codex omite $schema (é do Agent Plugins)');

  assertInsideRoot(manifest.skills, 'skills');
  assert.equal(manifest.skills, './skills/');
  assert.ok(fs.statSync(path.join(pluginRoot, 'skills')).isDirectory());

  assertInsideRoot(manifest.mcpServers, 'mcpServers');
  assert.equal(manifest.mcpServers, './.mcp.json');
  assert.ok(fs.statSync(path.join(pluginRoot, '.mcp.json')).isFile());

  const ui = manifest.interface;
  assert.ok(ui && typeof ui === 'object');
  for (const key of ['displayName', 'shortDescription', 'longDescription', 'developerName', 'category']) {
    assert.equal(typeof ui[key], 'string', `interface.${key} precisa ser string`);
    assert.ok(ui[key].length > 0, `interface.${key} não pode ser vazio`);
  }
  assert.ok(ui.displayName.length <= 30, 'displayName tem limite de 30 caracteres na submissão');
  assert.ok(ui.shortDescription.length <= 30, 'shortDescription tem limite de 30 caracteres na submissão');
  assert.ok(ui.longDescription.length <= 4000);
  assert.ok(ui.developerName.length <= 80);
  assert.ok(Array.isArray(ui.capabilities) && ui.capabilities.length > 0);
  for (const capability of ui.capabilities) assert.equal(typeof capability, 'string');

  const icon = assertInsideRoot(ui.composerIcon, 'composerIcon');
  const logo = assertInsideRoot(ui.logo, 'logo');
  assert.ok(fs.statSync(icon).isFile());
  assert.ok(fs.statSync(logo).isFile());
});

test('versão: manifesto = package.json = SERVER_VERSION (prerelease SemVer real)', () => {
  const manifest = readJson(path.join(pluginRoot, '.codex-plugin/plugin.json'));
  const pkg = readJson(path.join(pluginRoot, 'package.json'));
  assert.equal(manifest.version, '0.2.2-experimental');
  assert.equal(manifest.version, pkg.version, 'mesma versão do pacote npm');
  assert.equal(manifest.version, SERVER_VERSION, 'mesma versão anunciada pelo servidor MCP');
  const parsed = manifest.version.match(SEMVER_RE);
  assert.ok(parsed, 'prerelease válido, não constraint inventada');
  assert.equal(parsed[1], '0');
  assert.equal(parsed[2], '2');
  assert.equal(parsed[3], '2');
  assert.equal(parsed[4], 'experimental');
});

test('LICENSE: cópia exata do LICENSE da raiz do repositório', () => {
  const repoRoot = path.resolve(pluginRoot, '..', '..');
  const packaged = fs.readFileSync(path.join(pluginRoot, 'LICENSE'));
  const rootLicense = fs.readFileSync(path.join(repoRoot, 'LICENSE'));
  assert.ok(packaged.equals(rootLicense), 'byte a byte igual ao LICENSE da raiz');
  assert.match(packaged.toString('utf8'), /^MIT License/);
});

test('.mcp.json: stdio mesa, caminhos relativos ao plugin, sem expansão de $', () => {
  const mcpPath = path.join(pluginRoot, '.mcp.json');
  const raw = fs.readFileSync(mcpPath, 'utf8');
  assert.ok(!raw.includes('${'), '.mcp.json não pode usar expansão de variáveis não documentada');
  assert.ok(!raw.includes('CODEX_PLUGIN_ROOT') && !raw.includes('CLAUDE_PLUGIN_ROOT'));

  const parsed = readJson(mcpPath);
  const mesa = parsed.mcpServers?.mesa;
  assert.ok(mesa && typeof mesa === 'object', 'mcpServers.mesa');
  assert.equal(mesa.command, 'node');
  assert.deepEqual(mesa.args, ['./server/main.mjs']);
  assert.equal(mesa.cwd, './');
  assert.deepEqual(mesa.env_vars, [
    'MESA_STUDY_ROOTS',
    'MESA_STUDY_CACHE_DIR',
    'MESA_XOURNAL_HELPER',
    'MESA_STUDY_MAX_IMAGE_BYTES',
    'MESA_STUDY_TUTOR_FILE',
    'MESA_STUDY_LEARNER_FILE',
    'MESA_STUDY_STATE_FILE',
  ]);
  assert.deepEqual(mesa.env_vars, Object.values(SERVER_ENV), 'lista do manifesto = variáveis que o servidor realmente lê');
  for (const relative of mesa.args) {
    assert.ok(relative.startsWith('./'), `arg deve começar com ./: ${relative}`);
    assert.ok(!relative.split('/').includes('..'));
  }
  assert.equal(typeof mesa.type, 'undefined', 'formato .mcp.json do Codex omite type no stdio');
});

test('marketplace local: source.path ./mesa-study dentro da raiz codex-plugin', () => {
  const marketplacePath = path.join(marketplaceRoot, '.agents/plugins/marketplace.json');
  assert.ok(fs.statSync(marketplacePath).isFile());
  const marketplace = readJson(marketplacePath);
  assert.equal(marketplace.name, 'mesa-local');
  assert.equal(typeof marketplace.interface?.displayName, 'string');
  assert.ok(Array.isArray(marketplace.plugins) && marketplace.plugins.length === 1);
  const entry = marketplace.plugins[0];
  assert.equal(entry.name, 'mesa-study');
  assert.equal(entry.source?.source, 'local');
  assert.equal(entry.source?.path, './mesa-study');
  assert.ok(!entry.source.path.includes('..'));
  assert.equal(entry.policy?.installation, 'AVAILABLE');
  assert.equal(entry.policy?.authentication, 'ON_INSTALL');
  assert.equal(typeof entry.category, 'string');
  assert.ok(entry.category.length > 0);
  const resolved = path.resolve(marketplaceRoot, entry.source.path);
  assert.equal(fs.realpathSync(resolved), fs.realpathSync(pluginRoot));
  assert.ok(!fs.existsSync(path.resolve(marketplaceRoot, '.agents/plugins', entry.source.path)), 'source.path é relativo à raiz do marketplace, não à pasta .agents/plugins/');
});

test('assets: PNGs quadrados >= 48 com IHDR e CRC válidos', () => {
  for (const name of ASSET_FILES) {
    const file = path.join(pluginRoot, 'assets', name);
    const buffer = fs.readFileSync(file);
    const {width, height} = readPngHeader(buffer);
    assert.ok(width >= 48 && height >= 48, `${name} precisa ter pelo menos 48x48`);
    assert.equal(width, height, `${name} precisa ser quadrado`);
    assert.equal(width, PLACEHOLDER_SIZE);
  }
});

test('make-assets: encodePng determinístico e não sobrescreve sem force', () => {
  const first = buildPlaceholderPng(64);
  const second = buildPlaceholderPng(64);
  assert.ok(first.equals(second), 'saída determinística');
  const {width, height} = readPngHeader(first);
  assert.equal(width, 64);
  assert.equal(height, 64);
  const small = encodePng(48, 48, () => [0, 0, 0, 255]);
  assert.equal(readPngHeader(small).width, 48);

  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa assets ç '));
  const created = ensurePlaceholderAssets({root});
  assert.equal(created.written.length, ASSET_FILES.length);
  const icon = path.join(root, 'assets', 'icon.png');
  fs.writeFileSync(icon, 'conteudo local');
  const again = ensurePlaceholderAssets({root});
  assert.deepEqual(again.written, []);
  assert.equal(again.skipped.length, ASSET_FILES.length);
  assert.equal(fs.readFileSync(icon, 'utf8'), 'conteudo local', 'sem --force, nada é sobrescrito');
  const forced = ensurePlaceholderAssets({root, force: true});
  assert.equal(forced.written.length, ASSET_FILES.length);
  assert.ok(fs.readFileSync(icon).subarray(0, 8).equals(buildPlaceholderPng().subarray(0, 8)));
});

test('skill mesa empacotada existe com frontmatter mínimo', () => {
  const skill = fs.readFileSync(path.join(pluginRoot, 'skills/mesa/SKILL.md'), 'utf8');
  assert.match(skill, /^---\n/);
  assert.match(skill, /\nname: mesa\n/);
  assert.match(skill, /\ndescription: /);
});

test('README: staging standalone, prerelease e limites do modo sem skill', () => {
  const readme = fs.readFileSync(path.join(pluginRoot, 'README.md'), 'utf8');
  assert.ok(!readme.includes('Planilha de fato'), 'typo antigo não volta');
  assert.ok(readme.includes('.agents/plugins/marketplace.json'));
  assert.ok(readme.includes('mesa-study-local'), 'marketplace gerado nomeado');
  assert.ok(
    readme.includes('source: "./"') || readme.includes('source.path` é `./'),
    'source ./ do marketplace standalone documentado',
  );
  assert.ok(readme.includes('Mantenha a cópia'), 'aviso de manter o staging por causa dos args absolutos');
  assert.ok(readme.includes('não instala a skill'), 'limite da Opção B explícito');
  assert.ok(readme.includes('ferramentas funcionam sem skill'), 'ferramentas valem sem skill');
  assert.ok(readme.includes('$mesa'), 'menção documentada');
  assert.ok(readme.includes('MESA_STUDY_MAX_IMAGE_BYTES'));
  assert.ok(readme.includes('STARTUP_INVALID'), 'paridade com a inicialização documentada');
  assert.ok(readme.includes('0.2.2-experimental'), 'versão prerelease documentada');
});
