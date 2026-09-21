import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {makeZip} from './zipkit.mjs';

/* Aplicação do updater em raiz fake (modos git e zip), SEM rede e SEM processo
   real: comandos (git/npm/node) e o reopen são falsos/injetados. Os cenários
   cobrem o contrato: lista explícita, caminhos protegidos, versão conferida,
   falha no meio (rollback + a versão antiga sobe de novo) e o único estado que
   quebra o invariante — lock trocado com o `npm ci` morto no meio. */
const require = createRequire(import.meta.url);
const updater = require('../updater.cjs');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-updateflow-test-'));
const write = (file, text) => { fs.mkdirSync(path.dirname(file), {recursive: true}); fs.writeFileSync(file, text); };
const read = (file) => fs.readFileSync(file, 'utf8');

/* Raiz fake do instalado (o que um amigo com zip tem em casa): código do desk +
   core + dados do usuário que NENHUM update pode tocar. */
function fakeInstallRoot() {
  const root = tmp();
  write(path.join(root, 'desk', 'package.json'), '{"version":"0.4.0"}');
  write(path.join(root, 'desk', 'package-lock.json'), '{"lock":"antigo"}');
  write(path.join(root, 'desk', 'main.cjs'), 'main antigo');
  write(path.join(root, 'desk', 'index.html'), 'index antigo');
  write(path.join(root, 'desk', 'src', 'foo.mjs'), 'foo antigo');
  write(path.join(root, 'desk', 'templates', 'TUTOR.md'), 'tutor antigo');
  write(path.join(root, 'core', 'view.bend'), 'core antigo');
  write(path.join(root, 'desk', '.runtime', 'desk.json'), '{"dados":"do usuario"}');
  write(path.join(root, 'desk', '.runtime', 'pi-1.jsonl'), 'sessao do usuario');
  write(path.join(root, 'config.json'), '{"keep":"config"}');
  write(path.join(root, 'aula.pdf'), 'pdf do usuario');
  write(path.join(root, 'rascunho.xopp'), 'xopp do usuario');
  return root;
}

const PROTEGIDOS = [
  ['config.json', '{"keep":"config"}'],
  ['aula.pdf', 'pdf do usuario'],
  ['rascunho.xopp', 'xopp do usuario'],
  ['desk/.runtime/desk.json', '{"dados":"do usuario"}'],
  ['desk/.runtime/pi-1.jsonl', 'sessao do usuario'],
];

const NOVO = {
  'mesa-de-estudos-0.4.1/desk/package.json': '{"version":"0.4.1"}',
  'mesa-de-estudos-0.4.1/desk/package-lock.json': '{"lock":"novo"}',
  'mesa-de-estudos-0.4.1/desk/main.cjs': 'main novo',
  'mesa-de-estudos-0.4.1/desk/index.html': 'index novo',
  'mesa-de-estudos-0.4.1/desk/src/foo.mjs': 'foo novo',
  'mesa-de-estudos-0.4.1/desk/src/novo.mjs': 'criado pelo update',
  'mesa-de-estudos-0.4.1/desk/templates/TUTOR.md': 'tutor novo',
  'mesa-de-estudos-0.4.1/core/view.bend': 'core novo',
  /* Entradas que o zip NUNCA pode pousar: dados do usuário e o que está fora
     da lista explícita (inclusive um install-source.json forjado). */
  'mesa-de-estudos-0.4.1/config.json': 'ATAQUE',
  'mesa-de-estudos-0.4.1/aula.pdf': 'ATAQUE',
  'mesa-de-estudos-0.4.1/rascunho.xopp': 'ATAQUE',
  'mesa-de-estudos-0.4.1/desk/.runtime/desk.json': 'ATAQUE',
  'mesa-de-estudos-0.4.1/desk/.runtime/pi-9.jsonl': 'ATAQUE',
  'mesa-de-estudos-0.4.1/desk/node_modules/evil.js': 'ATAQUE',
  'mesa-de-estudos-0.4.1/desk/install-source.json': 'ATAQUE',
  'mesa-de-estudos-0.4.1/docs/HISTORIA.md': 'fora da lista',
};

function fakeRun(script = () => ({stdout: ''})) {
  const calls = [];
  const run = async (cmd, args = [], opts = {}) => {
    calls.push([cmd, ...args]);
    return script(cmd, args, opts, calls);
  };
  return {run, calls};
}

function logOf(runtime) {
  return read(path.join(runtime, 'desk.log'));
}

test('modo zip: substitui só a lista explícita, protegido intocado, npm ci só com lock novo', async () => {
  const root = fakeInstallRoot();
  const runtime = tmp();
  const reopens = [];
  const {run, calls} = fakeRun();
  let pedidoUrl = '';
  const result = await updater.applyUpdate({
    mode: 'zip', rootDir: root, deskDir: path.join(root, 'desk'), runtime,
    announcedVersion: '0.4.1',
    fetchBuffer: async (url) => { pedidoUrl = url; return makeZip(NOVO); },
    run,
    reopen: () => reopens.push('reabriu'),
    waitPid: 0,
  });
  assert.equal(result.ok, true);
  assert.match(pedidoUrl, /codeload\.github\.com\/FariaDev\/mesa-de-estudos\/zip\/refs\/tags\/v0\.4\.1$/);

  assert.equal(read(path.join(root, 'desk', 'main.cjs')), 'main novo');
  assert.equal(read(path.join(root, 'desk', 'index.html')), 'index novo');
  assert.equal(read(path.join(root, 'desk', 'src', 'foo.mjs')), 'foo novo');
  assert.equal(read(path.join(root, 'desk', 'templates', 'TUTOR.md')), 'tutor novo');
  assert.equal(read(path.join(root, 'core', 'view.bend')), 'core novo');
  assert.equal(read(path.join(root, 'desk', 'src', 'novo.mjs')), 'criado pelo update');
  for (const [rel, texto] of PROTEGIDOS) assert.equal(read(path.join(root, rel)), texto, `protegido intocado: ${rel}`);
  assert.equal(read(path.join(root, 'desk', 'package-lock.json')), '{"lock":"novo"}', 'o lock novo entra (e é o que dispara o npm ci)');
  assert.equal(fs.existsSync(path.join(root, 'desk', 'node_modules', 'evil.js')), false);
  assert.equal(fs.existsSync(path.join(root, 'desk', 'install-source.json')), false);
  assert.equal(fs.existsSync(path.join(root, 'docs')), false, 'fora da lista explícita não entra');

  assert.deepEqual(calls, [['npm', 'ci']], 'npm ci só porque o package-lock.json mudou');
  assert.deepEqual(reopens, ['reabriu'], 'a Mesa reabre sozinha depois do update');
  assert.match(logOf(runtime), /concluído/);
});

test('modo zip: lock igual não roda npm ci', async () => {
  const root = fakeInstallRoot();
  const runtime = tmp();
  const {run, calls} = fakeRun();
  const zip = makeZip({'x/desk/main.cjs': 'main novo', 'x/desk/package.json': '{"version":"0.4.0"}', 'x/desk/package-lock.json': '{"lock":"antigo"}'});
  const result = await updater.applyUpdate({
    mode: 'zip', rootDir: root, deskDir: path.join(root, 'desk'), runtime, announcedVersion: '0.4.0',
    fetchBuffer: async () => zip, run, reopen: () => {}, waitPid: 0,
  });
  assert.equal(result.ok, true);
  assert.deepEqual(calls, [], 'sem mudança de lock não há npm ci (nem git/node)');
});

test('modo zip: package.json extraído não bate com a anunciada → nada é tocado', async () => {
  const root = fakeInstallRoot();
  const runtime = tmp();
  const reopens = [];
  const {run, calls} = fakeRun();
  const result = await updater.applyUpdate({
    mode: 'zip', rootDir: root, deskDir: path.join(root, 'desk'), runtime,
    announcedVersion: '9.9.9',
    fetchBuffer: async () => makeZip(NOVO),
    run, reopen: () => reopens.push('reabriu'), waitPid: 0,
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /não bate com a anunciada/);
  assert.equal(read(path.join(root, 'desk', 'main.cjs')), 'main antigo');
  assert.equal(fs.existsSync(path.join(root, 'desk', 'src', 'novo.mjs')), false);
  assert.deepEqual(calls, []);
  assert.deepEqual(reopens, ['reabriu'], 'falhou: a versão antiga sobe de novo sozinha');
  assert.match(logOf(runtime), /FALHOU/);
  assert.match(logOf(runtime), /rollback/);
});

test('modo zip: caminho com .. é barrado antes de qualquer escrita', async () => {
  const root = fakeInstallRoot();
  const runtime = tmp();
  const zip = makeZip({'x/desk/package.json': '{"version":"0.4.1"}', 'x/../evil.txt': 'fuga'});
  const result = await updater.applyUpdate({
    mode: 'zip', rootDir: root, deskDir: path.join(root, 'desk'), runtime,
    announcedVersion: '0.4.1',
    fetchBuffer: async () => zip, run: async () => ({stdout: ''}), reopen: () => {}, waitPid: 0,
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /suspeito/);
  assert.equal(fs.existsSync(path.join(path.dirname(root), 'evil.txt')), false);
  assert.equal(read(path.join(root, 'desk', 'main.cjs')), 'main antigo');
});

test('modo zip: falha no meio → rollback devolve a versão antiga inteira e reabre', async () => {
  const root = fakeInstallRoot();
  const runtime = tmp();
  /* Um diretório no lugar de um arquivo do zip: a escrita morre no meio da
     cópia, depois de já ter gravado outros arquivos novos. */
  fs.mkdirSync(path.join(root, 'desk', 'src', 'bloqueado.mjs'));
  const zip = makeZip({
    ...NOVO,
    'mesa-de-estudos-0.4.1/desk/src/bloqueado.mjs': 'não vai entrar',
  });
  const reopens = [];
  const result = await updater.applyUpdate({
    mode: 'zip', rootDir: root, deskDir: path.join(root, 'desk'), runtime,
    announcedVersion: '0.4.1',
    fetchBuffer: async () => zip,
    run: async () => ({stdout: ''}),
    reopen: () => reopens.push('reabriu'),
    waitPid: 0,
  });
  assert.equal(result.ok, false);
  assert.equal(read(path.join(root, 'desk', 'main.cjs')), 'main antigo', 'arquivo de código intacto');
  assert.equal(read(path.join(root, 'desk', 'src', 'foo.mjs')), 'foo antigo');
  assert.equal(fs.existsSync(path.join(root, 'desk', 'src', 'novo.mjs')), false, 'arquivo criado no meio sai no rollback');
  for (const [rel, texto] of PROTEGIDOS) assert.equal(read(path.join(root, rel)), texto, `protegido intocado: ${rel}`);
  assert.equal(read(path.join(root, 'desk', 'package-lock.json')), '{"lock":"antigo"}', 'lock antigo de volta no rollback');
  assert.deepEqual(reopens, ['reabriu'], 'a versão antiga sobe de novo sozinha');
  const log = logOf(runtime);
  assert.match(log, /FALHOU/);
  assert.match(log, /rollback aplicado/);
});

test('modo git: pull --ff-only; npm ci só quando o lock mudou', async () => {
  const root = fakeInstallRoot();
  fs.mkdirSync(path.join(root, '.git'));
  const runtime = tmp();
  const {run, calls} = fakeRun((cmd, args) => {
    if (cmd === 'git' && args[0] === 'rev-parse') return {stdout: 'abc123\n'};
    if (cmd === 'git' && args[0] === 'pull') write(path.join(root, 'desk', 'main.cjs'), 'main novo');
    return {stdout: ''};
  });
  const result = await updater.applyUpdate({
    mode: 'git', rootDir: root, deskDir: path.join(root, 'desk'), runtime,
    announcedVersion: '0.4.1', run, reopen: () => {}, waitPid: 0,
  });
  assert.equal(result.ok, true);
  assert.equal(read(path.join(root, 'desk', 'main.cjs')), 'main novo');
  assert.deepEqual(calls, [['git', 'rev-parse', 'HEAD'], ['git', 'pull', '--ff-only']], 'sem lock novo não há npm ci');
  assert.match(logOf(runtime), /git pull --ff-only ok/);
});

test('modo git: pull falha → rollback, git reset e a versão antiga reabre', async () => {
  const root = fakeInstallRoot();
  fs.mkdirSync(path.join(root, '.git'));
  const runtime = tmp();
  const reopens = [];
  const {run, calls} = fakeRun((cmd, args) => {
    if (cmd === 'git' && args[0] === 'rev-parse') return {stdout: 'abc123\n'};
    if (cmd === 'git' && args[0] === 'pull') throw Error('sem rede');
    return {stdout: ''};
  });
  const result = await updater.applyUpdate({
    mode: 'git', rootDir: root, deskDir: path.join(root, 'desk'), runtime,
    announcedVersion: '0.4.1', run, reopen: () => reopens.push('reabriu'), waitPid: 0,
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /sem rede/);
  assert.deepEqual(calls, [['git', 'rev-parse', 'HEAD'], ['git', 'pull', '--ff-only'], ['git', 'reset', '--hard', 'abc123']], 'o rollback volta o clone para a cabeça antiga');
  assert.equal(read(path.join(root, 'desk', 'main.cjs')), 'main antigo');
  assert.deepEqual(reopens, ['reabriu']);
  assert.match(logOf(runtime), /FALHOU \(sem rede\)/);
});

test('lock mudou + npm ci falhou no meio: rollback refaz o ci com o lock antigo', async () => {
  const root = fakeInstallRoot();
  fs.mkdirSync(path.join(root, '.git'));
  const runtime = tmp();
  const reopens = [];
  let npmCount = 0;
  const {run, calls} = fakeRun((cmd, args) => {
    if (cmd === 'git' && args[0] === 'rev-parse') return {stdout: 'abc123\n'};
    if (cmd === 'git' && args[0] === 'pull') {
      /* O pull trouxe lock novo — é o único estado que quebra o invariante. */
      write(path.join(root, 'desk', 'package.json'), '{"version":"0.4.1"}');
      write(path.join(root, 'desk', 'package-lock.json'), '{"lock":"novo"}');
      return {stdout: ''};
    }
    if (cmd === 'npm' && args[0] === 'ci') {
      npmCount++;
      if (npmCount === 1) throw Error('npm ci morreu no meio');
      return {stdout: ''};
    }
    return {stdout: ''};
  });
  const result = await updater.applyUpdate({
    mode: 'git', rootDir: root, deskDir: path.join(root, 'desk'), runtime,
    announcedVersion: '0.4.1', run, reopen: () => reopens.push('reabriu'), waitPid: 0,
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /npm ci morreu/);
  assert.equal(npmCount, 2, 'o rollback roda o npm ci de recuperação com o lock antigo');
  assert.deepEqual(calls.map((c) => c.slice(0, 2).join(' ')), [
    'git rev-parse', 'git pull', 'npm ci', 'git reset', 'npm ci',
  ], 'ordem: pull → ci quebra → reset/restore → ci de recuperação');
  assert.equal(read(path.join(root, 'desk', 'package.json')), '{"version":"0.4.0"}', 'package.json antigo de volta');
  assert.equal(read(path.join(root, 'desk', 'package-lock.json')), '{"lock":"antigo"}', 'lock antigo de volta');
  assert.deepEqual(reopens, ['reabriu'], 'a versão antiga sobe de novo sozinha');
  const log = logOf(runtime);
  assert.match(log, /FALHOU \(npm ci morreu no meio\)/);
  assert.match(log, /npm ci de recuperação ok \(lock antigo de volta\)/);
});

test('applyPiOnly: npm install do Pi local no pós-fechamento; falha vira motivo no log', async () => {
  const deskDir = path.join(tmp(), 'desk');
  fs.mkdirSync(deskDir, {recursive: true});
  const runtime = tmp();
  const reopens = [];
  const ok = fakeRun();
  const okResult = await updater.applyPiOnly({deskDir, runtime, run: ok.run, reopen: () => reopens.push('reabriu')});
  assert.equal(okResult.ok, true);
  assert.deepEqual(ok.calls, [['npm', 'install', '@earendil-works/pi-coding-agent@latest']]);
  assert.deepEqual(reopens, ['reabriu']);

  const falha = fakeRun(() => { throw Error('registry fora do ar'); });
  const badResult = await updater.applyPiOnly({deskDir, runtime, run: falha.run, reopen: () => reopens.push('reabriu')});
  assert.equal(badResult.ok, false);
  assert.match(logOf(runtime), /FALHOU ao atualizar o Pi \(registry fora do ar\)/);
  assert.deepEqual(reopens, ['reabriu', 'reabriu'], 'mesmo na falha a Mesa reabre (com o Pi que já estava)');
});
