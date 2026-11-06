import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {makeZip} from './zipkit.mjs';
import {TEST_COMMIT, makeSignedRelease} from './fake-update-release.mjs';
import {tempDir, trackTempDir} from './temp-dir.mjs';

/* Aplicação do updater em raiz fake (modos git e zip), SEM rede e SEM processo
   real: comandos (git/npm/node) e o reopen são falsos/injetados. Os cenários
   cobrem o contrato: lista explícita, caminhos protegidos, versão conferida,
   falha no meio (rollback + a versão antiga sobe de novo) e o único estado que
   quebra o invariante — lock trocado com o `npm ci` morto no meio. */
const require = createRequire(import.meta.url);
const updater = require('../updater.cjs');

const tmp = () => tempDir('mesa-updateflow-test');
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
  const urls = [];
  const release = makeSignedRelease({version: '0.4.1', commit: TEST_COMMIT, zip: makeZip(NOVO)});
  const result = await updater.applyUpdate({
    mode: 'zip', rootDir: root, deskDir: path.join(root, 'desk'), runtime,
    announcedVersion: '0.4.1', publicKey: release.publicKey,
    fetchBuffer: async (url) => { urls.push(url); return release.fetchBuffer(url); },
    run,
    reopen: () => reopens.push('reabriu'),
    waitPid: 0,
  });
  assert.equal(result.ok, true);
  assert.deepEqual(urls, [release.urls.manifest, release.urls.signature, release.urls.zip], 'baixa o manifesto assinado, a assinatura e o zip da Release');

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
  assert.match(logOf(runtime), /v0\.4\.1 no lugar \(conferida no package\.json\)/, 'a versão logada é a CONFERIDA (A3)');

  /* B1: o manifesto da instalação nasce com o que foi escrito. */
  const manifesto = JSON.parse(read(path.join(root, '.update-manifest.json')));
  assert.equal(manifesto.version, '0.4.1');
  assert.ok(manifesto.files.includes('desk/main.cjs'));
  assert.ok(manifesto.files.includes('desk/src/novo.mjs'));
});

test('modo zip: lock igual não roda npm ci', async () => {
 const root = fakeInstallRoot();
 write(path.join(root, 'desk', 'package.json'), '{"version":"0.3.9"}'); /* abaixo da anunciada: a trava anti-rollback deixa passar */
 const runtime = tmp();
  const {run, calls} = fakeRun();
  const zip = makeZip({'x/desk/main.cjs': 'main novo', 'x/desk/package.json': '{"version":"0.4.0"}', 'x/desk/package-lock.json': '{"lock":"antigo"}'});
  const release = makeSignedRelease({version: '0.4.0', commit: TEST_COMMIT, zip});
  const result = await updater.applyUpdate({
    mode: 'zip', rootDir: root, deskDir: path.join(root, 'desk'), runtime, announcedVersion: '0.4.0',
    publicKey: release.publicKey, fetchBuffer: release.fetchBuffer, run, reopen: () => {}, waitPid: 0,
  });
  assert.equal(result.ok, true);
  assert.deepEqual(calls, [], 'sem mudança de lock não há npm ci (nem git/node)');
});

test('modo zip: package.json extraído não bate com a anunciada → nada é tocado', async () => {
  const root = fakeInstallRoot();
  const runtime = tmp();
  const reopens = [];
  const {run, calls} = fakeRun();
  const release = makeSignedRelease({version: '9.9.9', commit: TEST_COMMIT, zip: makeZip(NOVO)});
  const result = await updater.applyUpdate({
    mode: 'zip', rootDir: root, deskDir: path.join(root, 'desk'), runtime,
    announcedVersion: '9.9.9', publicKey: release.publicKey,
    fetchBuffer: release.fetchBuffer,
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
  const release = makeSignedRelease({version: '0.4.1', commit: TEST_COMMIT, zip});
  const result = await updater.applyUpdate({
    mode: 'zip', rootDir: root, deskDir: path.join(root, 'desk'), runtime,
    announcedVersion: '0.4.1', publicKey: release.publicKey,
    fetchBuffer: release.fetchBuffer, run: async () => ({stdout: ''}), reopen: () => {}, waitPid: 0,
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
  const release = makeSignedRelease({version: '0.4.1', commit: TEST_COMMIT, zip});
  const result = await updater.applyUpdate({
    mode: 'zip', rootDir: root, deskDir: path.join(root, 'desk'), runtime,
    announcedVersion: '0.4.1', publicKey: release.publicKey,
    fetchBuffer: release.fetchBuffer,
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

test('lock mudou + npm ci falhou no meio: rollback refaz o ci com o lock antigo', async () => {
  const root = fakeInstallRoot();
  fs.mkdirSync(path.join(root, '.git'));
  const runtime = tmp();
  const reopens = [];
  let npmCount = 0;
  const {run, calls} = fakeRun((cmd, args) => {
    if (cmd === 'git' && args[0] === 'rev-parse') return {stdout: TEST_COMMIT + '\n'};
    if (cmd === 'git' && args[0] === 'merge') {
      /* O merge trouxe lock novo — é o único estado que quebra o invariante. */
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
  const release = makeSignedRelease({version: '0.4.1', commit: TEST_COMMIT, zip: Buffer.from('zip')});
  const result = await updater.applyUpdate({
    mode: 'git', rootDir: root, deskDir: path.join(root, 'desk'), runtime,
    announcedVersion: '0.4.1', publicKey: release.publicKey, fetchBuffer: release.fetchBuffer,
    run, reopen: () => reopens.push('reabriu'), waitPid: 0,
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /npm ci morreu/);
  assert.equal(npmCount, 2, 'o rollback roda o npm ci de recuperação com o lock antigo');
  assert.deepEqual(calls.map((c) => c.slice(0, 2).join(' ')), [
    'git rev-parse', 'git status', 'git rev-parse', 'git merge', 'git rev-parse', 'npm ci', 'git reset', 'npm ci',
  ], 'ordem: status → conferência da tag → merge ff → HEAD assinado → ci quebra → reset/restore → ci de recuperação');
  assert.ok(calls.find((c) => c[0] === 'git' && c[1] === 'merge')?.includes('--ff-only'), 'nunca faz merge de verdade: só avança em fast-forward');
  assert.equal(read(path.join(root, 'desk', 'package.json')), '{"version":"0.4.0"}', 'package.json antigo de volta');
  assert.equal(read(path.join(root, 'desk', 'package-lock.json')), '{"lock":"antigo"}', 'lock antigo de volta');
  assert.deepEqual(reopens, ['reabriu'], 'a versão antiga sobe de novo sozinha');
  const log = logOf(runtime);
  assert.match(log, /FALHOU \(npm ci morreu no meio\)/);
  assert.match(log, /npm ci de recuperação ok \(lock antigo de volta\)/);
});

/* A1: falha DEPOIS do npm ci (no modo bundle, o install-app — que é o próprio
   apply — estoura) → o rollback refaz o ci com o lock antigo mesmo assim
   (deps mexidas ≠ "só quando o ci começou"), e a assinatura partida do
   install-app morto é refeita. */
test('A1: falha depois do npm ci → rollback refaz as dependências (depsTouched persiste)', {skip: process.platform !== 'darwin'}, async () => {
  const clone = fakeInstallRoot();
  fs.mkdirSync(path.join(clone, '.git'));
  /* O payload do bundle (o que o install-app reescreve por inteiro). */
  const payload = tmp();
  write(path.join(payload, 'package.json'), '{"version":"0.4.0"}');
  write(path.join(payload, 'main.cjs'), 'main antigo (payload)');
  const runtime = tmp();
  let npmCount = 0;
  const release = makeSignedRelease({version: '0.4.1', commit: TEST_COMMIT, zip: Buffer.from('zip')});
  const {run} = fakeRun((cmd, args) => {
    if (cmd === 'git' && args[0] === 'rev-parse') return {stdout: TEST_COMMIT + '\n'};
    if (cmd === 'git' && args[0] === 'merge') {
      write(path.join(clone, 'desk', 'package-lock.json'), '{"lock":"novo"}');
      return {stdout: ''};
    }
    /* O fake do reset emula o git de verdade: volta os arquivos rastreados. */
    if (cmd === 'git' && args[0] === 'reset') {
      write(path.join(clone, 'desk', 'package-lock.json'), '{"lock":"antigo"}');
      return {stdout: ''};
    }
    if (cmd === 'npm' && args[0] === 'ci') {npmCount++; return {stdout: ''};}
    if (cmd === 'node') throw Error('install-app estourou no meio');
    if (cmd === 'codesign') return {stdout: ''};
    return {stdout: ''};
  });
  const result = await updater.applyUpdate({
    mode: 'bundle', rootDir: clone, deskDir: payload, runtime,
    announcedVersion: '0.4.1', sourceInfo: {path: clone},
    publicKey: release.publicKey, fetchBuffer: release.fetchBuffer,
    run, reopen: () => {}, waitPid: 0,
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /install-app estourou/);
  assert.equal(npmCount, 2, 'o npm ci de recuperação roda no rollback (dependências voltam ao lock antigo)');
  assert.equal(read(path.join(clone, 'desk', 'package-lock.json')), '{"lock":"antigo"}');
  assert.equal(read(path.join(payload, 'main.cjs')), 'main antigo (payload)', 'o payload volta à versão anterior');
  const log = logOf(runtime);
  assert.match(log, /FALHOU \(install-app estourou no meio\)/);
  assert.match(log, /npm ci de recuperação ok/);
  assert.match(log, /bundle re-assinado \(ad-hoc\) após o rollback/);
});

/* A1 (continuação): quando o sync de recuperação PASSA, o payload ganha as
   dependências do clone restaurado de volta (o node_modules é refeito pelo
   install-app) e o fallback ad-hoc não é necessário. */
test('A1: rollback re-sincroniza as dependências do payload quando o sync passa', {skip: process.platform !== 'darwin'}, async () => {
  const clone = fakeInstallRoot();
  fs.mkdirSync(path.join(clone, '.git'));
  const payload = tmp();
  write(path.join(payload, 'package.json'), '{"version":"0.4.0"}');
  write(path.join(payload, 'main.cjs'), 'main antigo (payload)');
  const runtime = tmp();
  let nodeCalls = 0;
  const assinaturas = [];
  const release = makeSignedRelease({version: '0.4.1', commit: TEST_COMMIT, zip: Buffer.from('zip')});
  const {run} = fakeRun((cmd, args) => {
    if (cmd === 'git' && args[0] === 'rev-parse') return {stdout: TEST_COMMIT + '\n'};
    if (cmd === 'node') {nodeCalls++; if (nodeCalls === 1) throw Error('install-app estourou no meio'); return {stdout: ''};}
    if (cmd === 'codesign') {assinaturas.push(args.join(' ')); return {stdout: ''};}
    return {stdout: ''};
  });
  const result = await updater.applyUpdate({
    mode: 'bundle', rootDir: clone, deskDir: payload, runtime,
    announcedVersion: '0.4.1', sourceInfo: {path: clone},
    publicKey: release.publicKey, fetchBuffer: release.fetchBuffer,
    run, reopen: () => {}, waitPid: 0,
  });
  assert.equal(result.ok, false);
  assert.equal(nodeCalls, 2, 'o install-app de recuperação é re-rodado no rollback');
  const log = logOf(runtime);
  assert.match(log, /payload do bundle re-sincronizado após o rollback/);
  assert.deepEqual(assinaturas, [], 'com o sync de recuperação ok, não precisa do fallback ad-hoc');
});

/* B1/A5: o manifesto é dado do disco — entrada adulterada nunca vira delete
   fora da raiz; o órfão gerenciado sai normalmente. */
test('B1: entrada de manifesto fora da raiz é recusada (sem delete arbitrário)', () => {
  const root = tmp();
  write(path.join(root, 'desk', 'src', 'velho.mjs'), 'órfão gerenciado');
  const vitima = path.join(tmp(), 'vitima-manifesto.txt');
  write(vitima, 'não me apaga');
  const linhas = [];
  const removidos = updater.removeOrphans(root, ['desk/src/velho.mjs', '../' + path.basename(vitima), '/etc/hosts'], [], (l) => linhas.push(l));
  assert.equal(removidos, 1, 'só o órfão gerenciado é removido');
  assert.equal(fs.existsSync(path.join(root, 'desk', 'src', 'velho.mjs')), false, 'o órfão gerenciado sai');
  assert.equal(fs.existsSync(vitima), true, 'o arquivo fora da raiz sobrevive');
  assert.match(linhas.join('\n'), /entrada de manifesto recusada/);
});

/* ---------- D5: órfãos gerenciados, adicionados locais e symlink ---------- */

test('D5/B1: órfão gerenciado some; adição local fica; manifesto renasce', async () => {
  const root = fakeInstallRoot();
  const runtime = tmp();
  /* Instalação anterior (0.4.0) gerenciava main.cjs, src/foo.mjs e src/velho.mjs;
     um arquivo local do usuário (src/meu.mjs) nunca esteve no manifesto. */
  write(path.join(root, 'desk', 'src', 'velho.mjs'), 'velho (gerenciado)');
  write(path.join(root, 'desk', 'src', 'meu.mjs'), 'meu arquivo local');
  fs.writeFileSync(path.join(root, '.update-manifest.json'), JSON.stringify({
    version: '0.4.0',
    files: ['desk/package.json', 'desk/main.cjs', 'desk/src/foo.mjs', 'desk/src/velho.mjs'],
  }, null, 2));

  /* O zip 0.4.1 não tem velho.mjs (o módulo morreu) nem meu.mjs. */
  const zip = makeZip({
    'x/desk/package.json': '{"version":"0.4.1"}',
    'x/desk/main.cjs': 'main novo',
    'x/desk/src/foo.mjs': 'foo novo',
  });
  const release = makeSignedRelease({version: '0.4.1', commit: TEST_COMMIT, zip});
  const result = await updater.applyUpdate({
    mode: 'zip', rootDir: root, deskDir: path.join(root, 'desk'), runtime, announcedVersion: '0.4.1',
    publicKey: release.publicKey, fetchBuffer: release.fetchBuffer, run: async () => ({stdout: ''}), reopen: () => {}, waitPid: 0,
  });
  assert.equal(result.ok, true);
  assert.equal(fs.existsSync(path.join(root, 'desk', 'src', 'velho.mjs')), false, 'órfão gerenciado sai (estava no manifesto, sumiu da versão nova)');
  assert.equal(read(path.join(root, 'desk', 'src', 'meu.mjs')), 'meu arquivo local', 'arquivo local (nunca gerenciado) fica');
  const novo = JSON.parse(read(path.join(root, '.update-manifest.json')));
  assert.equal(novo.version, '0.4.1');
  assert.ok(!novo.files.includes('desk/src/velho.mjs'));
  assert.ok(!novo.files.includes('desk/src/meu.mjs'), 'o arquivo local não entra no manifesto');
  assert.match(logOf(runtime), /órfão gerenciado removido: desk\/src\/velho\.mjs/);
});

/* #50: o app Conversa saiu do repositório, mas a pasta `chat/` continua nos
   computadores de quem o usava (com `node_modules` e o `.runtime` com as
   conversas). O update por zip só mexe no que a lista de código aceita, e
   `chat/` nunca foi dela: nem mesmo uma entrada de manifesto apontando para lá
   (instalação antiga, arquivo adulterado) vira delete. Os módulos mortos da
   Mesa e do núcleo, esses sim gerenciados, saem como órfãos. */
test('#50: instalação antiga com chat/ no disco atualiza sem apagar nem tocar na pasta', async () => {
  const root = fakeInstallRoot();
  const runtime = tmp();
  const CHAT = {
    'chat/main.cjs': 'conversa antiga',
    'chat/package.json': '{"name":"conversa"}',
    'chat/src/generated/view.core.js': 'artefato da conversa',
    'chat/node_modules/dep/index.js': 'dependência instalada',
    'chat/.runtime/chat.json': '{"sessoes":"do usuario"}',
  };
  for (const [rel, texto] of Object.entries(CHAT)) write(path.join(root, rel), texto);
  write(path.join(root, 'desk', 'handoff.cjs'), 'bilhete (gerenciado)');
  write(path.join(root, 'core', 'handoff.bend'), 'núcleo do bilhete (gerenciado)');
  write(path.join(root, 'core', 'chatlist.bend'), 'núcleo só da Conversa (gerenciado)');
  fs.writeFileSync(path.join(root, '.update-manifest.json'), JSON.stringify({
    version: '0.4.0',
    files: ['desk/package.json', 'desk/main.cjs', 'desk/handoff.cjs', 'core/handoff.bend', 'core/chatlist.bend', ...Object.keys(CHAT)],
  }, null, 2));

  const zip = makeZip({
    'x/desk/package.json': '{"version":"0.4.1"}',
    'x/desk/main.cjs': 'main novo',
  });
  const release = makeSignedRelease({version: '0.4.1', commit: TEST_COMMIT, zip});
  const result = await updater.applyUpdate({
    mode: 'zip', rootDir: root, deskDir: path.join(root, 'desk'), runtime, announcedVersion: '0.4.1',
    publicKey: release.publicKey, fetchBuffer: release.fetchBuffer, run: async () => ({stdout: ''}), reopen: () => {}, waitPid: 0,
  });

  assert.equal(result.ok, true, 'a atualização termina bem com chat/ no disco');
  for (const [rel, texto] of Object.entries(CHAT)) assert.equal(read(path.join(root, rel)), texto, `chat/ intocado: ${rel}`);
  assert.equal(read(path.join(root, 'desk', 'main.cjs')), 'main novo', 'o resto da atualização aconteceu');
  for (const rel of ['desk/handoff.cjs', 'core/handoff.bend', 'core/chatlist.bend']) {
    assert.equal(fs.existsSync(path.join(root, rel)), false, `órfão gerenciado sai: ${rel}`);
  }
  const log = logOf(runtime);
  assert.match(log, /entrada de manifesto recusada: chat\/main\.cjs/, 'o updater recusa a entrada e diz qual');
  assert.doesNotMatch(log, /órfão gerenciado removido: chat\//, 'e nunca registra remoção em chat/');
  const novo = JSON.parse(read(path.join(root, '.update-manifest.json')));
  assert.ok(novo.files.every((rel) => !rel.startsWith('chat/')), 'o manifesto novo não gerencia chat/');
});

test('D5/B2: symlink no destino (ou no pai) é recusado antes da escrita', async () => {
  const root = fakeInstallRoot();
  const runtime = tmp();
  const fora = tmp();
  fs.symlinkSync(path.join(fora, 'alvo.mjs'), path.join(root, 'desk', 'src', 'link.mjs'));
  /* E um diretório que é link para fora da raiz gerenciada: */
  fs.symlinkSync(fora, path.join(root, 'desk', 'src', 'escapou'));
  const zip = makeZip({
    'x/desk/package.json': '{"version":"0.4.1"}',
    'x/desk/src/link.mjs': 'não pode pisar no link',
    'x/desk/src/escapado.mjs': 'não vai entrar', /* por baixo de um dir-link */
  });
  const reopens = [];
  const release = makeSignedRelease({version: '0.4.1', commit: TEST_COMMIT, zip});
  const result = await updater.applyUpdate({
    mode: 'zip', rootDir: root, deskDir: path.join(root, 'desk'), runtime, announcedVersion: '0.4.1',
    publicKey: release.publicKey, fetchBuffer: release.fetchBuffer, run: async () => ({stdout: ''}), reopen: () => reopens.push('r'), waitPid: 0,
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /link simbólico/);
  assert.equal(fs.existsSync(path.join(fora, 'alvo.mjs')), false, 'nada foi escrito através do link');
  assert.equal(fs.existsSync(path.join(fora, 'escapado.mjs')), false, 'nada foi escrito dentro do diretório-link');
  assert.equal(read(path.join(root, 'desk', 'main.cjs')), 'main antigo', 'rollback intacto');
  assert.deepEqual(reopens, ['r']);
});

/* ---------- D4: rollback incompleto retém o backup ---------- */

test('D4/A5: recuperação que falha PRESERVA o backup e diz o caminho no log', async () => {
  const root = fakeInstallRoot();
  const runtime = tmp();
  /* A escrita morre no meio (diretório no lugar do arquivo do zip) → o
     rollback precisa rodar; o RESTORE injetado quebra → o backup TEM de ficar
     no lugar (nunca apagado em cima de um rollback incompleto). */
  const zip = makeZip({
    ...NOVO,
    'mesa-de-estudos-0.4.1/desk/src/bloqueado.mjs': 'não vai entrar',
  });
  fs.mkdirSync(path.join(root, 'desk', 'src', 'bloqueado.mjs'));
  let backupInjetado = null;
  const release = makeSignedRelease({version: '0.4.1', commit: TEST_COMMIT, zip});
  const result = await updater.applyUpdate({
    mode: 'zip', rootDir: root, deskDir: path.join(root, 'desk'), runtime, announcedVersion: '0.4.1',
    publicKey: release.publicKey, fetchBuffer: release.fetchBuffer,
    run: async () => ({stdout: ''}),
    reopen: () => {}, waitPid: 0,
    restore: (rootDir, backupDir) => {
      backupInjetado = backupDir; // confere que é o MESMO backup do instantâneo
      throw Error('disco cheio no meio do restore');
    },
  });
  assert.equal(result.ok, false);
  assert.equal(result.incomplete, true, 'a falha é declarada como recuperação incompleta');
  /* O backup preservado (A5) é lixo de teste: registra para o sweep garantido. */
  if (result.backup) trackTempDir(result.backup);
  assert.ok(result.backup && fs.existsSync(result.backup), 'o backup fica no disco');
  assert.equal(backupInjetado, result.backup, 'o backup reportado é o que o updater criou');
  const entries = logOf(runtime).split('\n').filter(Boolean).map((line) => JSON.parse(line));
  assert.ok(entries.some((entry) => /rollback incompleto \(disco cheio no meio do restore\)/.test(entry.msg)));
  /* O log é JSON: a barra invertida do caminho do Windows chega dobrada. Lê o
     campo `msg` já decodificado em vez de montar regex sobre o texto cru. */
  const preserved = entries.find((entry) => entry.msg.includes('backup PRESERVADO em'));
  assert.ok(preserved?.msg.includes(result.backup), preserved?.msg);
  /* O restore foi interrompido antes de copiar: o código novo sobreviveu — é
     exatamente por isso que o backup não pode ser apagado. */
  assert.equal(read(path.join(root, 'desk', 'main.cjs')), 'main novo');
});

/* Regressão (2026-11-05): o rollback COMPLETO apaga o instantâneo — só o
   rollback incompleto o preserva (A5). Sem o rm, cada update desfeito deixava
   um `mesa-update-backup-*` inteiro no /tmp. O TMPDIR isolado torna a contagem
   imune a outros testes em paralelo. */
test('rollback completo não deixa mesa-update-backup para trás', async () => {
  const root = fakeInstallRoot();
  const runtime = tmp();
  const isolado = tempDir('mesa-tmpdir-isolado');
  const anterior = process.env.TMPDIR;
  process.env.TMPDIR = isolado;
  try {
    fs.mkdirSync(path.join(root, 'desk', 'src', 'bloqueado.mjs'));
    const zip = makeZip({
      ...NOVO,
      'mesa-de-estudos-0.4.1/desk/src/bloqueado.mjs': 'não vai entrar',
    });
    const release = makeSignedRelease({version: '0.4.1', commit: TEST_COMMIT, zip});
    const result = await updater.applyUpdate({
      mode: 'zip', rootDir: root, deskDir: path.join(root, 'desk'), runtime, announcedVersion: '0.4.1',
      publicKey: release.publicKey, fetchBuffer: release.fetchBuffer,
      run: async () => ({stdout: ''}), reopen: () => {}, waitPid: 0,
    });
    assert.equal(result.ok, false);
    assert.match(logOf(runtime), /rollback aplicado/);
    assert.equal(result.incomplete, undefined, 'rollback completo: nada é declarado incompleto');
    assert.deepEqual(fs.readdirSync(isolado), [], 'nenhum mesa-update-backup-* sobra do rollback completo');
  } finally {
    if (anterior === undefined) delete process.env.TMPDIR;
    else process.env.TMPDIR = anterior;
  }
});

/* Regressão (2026-11-05): falha ao apagar o instantâneo depois de um rollback
   completo só vai ao log (não vira exceção que o catch do apply leria como
   rollback incompleto). A pasta-mãe só-leitura faz o rm falhar. */
test('backup de rollback completo que não apaga só vai ao log', {skip: process.platform === 'win32' || process.getuid?.() === 0}, () => {
  const mae = tempDir('mesa-backup-mae');
  const backup = path.join(mae, 'mesa-update-backup-x');
  fs.mkdirSync(path.join(backup, 'desk'), {recursive: true});
  fs.writeFileSync(path.join(backup, 'desk', 'main.cjs'), 'antigo');
  fs.chmodSync(mae, 0o500);
  const linhas = [];
  try {
    assert.equal(updater.discardUpdateBackup(backup, (linha) => linhas.push(linha)), false);
  } finally {
    fs.chmodSync(mae, 0o700);
  }
  assert.match(linhas.join('\n'), /instantâneo não foi apagado/);
  assert.equal(updater.discardUpdateBackup(backup, (linha) => linhas.push(linha)), true);
  assert.equal(fs.existsSync(backup), false);
});

/* Regressão (revisão de segurança, 2026-11-05): no caminho feliz o rm do
   instantâneo também estava dentro do try; se falhasse, o catch desfazia o
   update já aplicado lendo um backup meio apagado. A pasta-mãe só-leitura
   faz o rm falhar depois do instantâneo. */
test('falha ao apagar o instantâneo depois do update não desfaz o update', {skip: process.platform === 'win32' || process.getuid?.() === 0}, async () => {
  const root = fakeInstallRoot();
  const runtime = tmp();
  const isolado = tempDir('mesa-tmpdir-isolado');
  const anterior = process.env.TMPDIR;
  process.env.TMPDIR = isolado;
  try {
    const release = makeSignedRelease({version: '0.4.1', commit: TEST_COMMIT, zip: makeZip(NOVO)});
    const result = await updater.applyUpdate({
      mode: 'zip', rootDir: root, deskDir: path.join(root, 'desk'), runtime, announcedVersion: '0.4.1',
      publicKey: release.publicKey, fetchBuffer: release.fetchBuffer,
      run: async () => ({stdout: ''}), reopen: () => {}, waitPid: 0,
      snapshot: (snapshotRoot, backup, include) => {
        updater.snapshotTree(snapshotRoot, backup, include);
        fs.chmodSync(isolado, 0o500);
      },
    });
    assert.equal(result.ok, true, 'a limpeza do instantâneo não é parte da transação');
    assert.equal(read(path.join(root, 'desk', 'main.cjs')), 'main novo');
    assert.match(logOf(runtime), /instantâneo não foi apagado/);
  } finally {
    fs.chmodSync(isolado, 0o700);
    if (anterior === undefined) delete process.env.TMPDIR;
    else process.env.TMPDIR = anterior;
  }
});

/* ---------- A4: PID que não sai no prazo aborta sem tocar nada ---------- */

test('D3/A4: PID que não sai no prazo → update abortado, disco intacto, sem reabrir', async () => {
  const root = fakeInstallRoot();
  const runtime = tmp();
  const reopens = [];
  const result = await updater.applyUpdate({
    mode: 'zip', rootDir: root, deskDir: path.join(root, 'desk'), runtime, announcedVersion: '0.4.1',
    fetchBuffer: async () => makeZip(NOVO),
    run: async () => ({stdout: ''}),
    reopen: () => reopens.push('reabriu'),
    waitPid: process.pid, /* o próprio processo de teste está vivo */
    pidTimeout: 250,
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /não encerrou no prazo/);
  assert.equal(read(path.join(root, 'desk', 'main.cjs')), 'main antigo', 'nada foi escrito');
  assert.equal(fs.existsSync(path.join(root, 'desk', 'src', 'novo.mjs')), false);
  assert.deepEqual(reopens, [], 'abortou: nada a reabrir');
  assert.match(logOf(runtime), /FALHOU \(o app não encerrou no prazo/);
});

test('D3/A4: PID que sai normalmente destrava a aplicação', async () => {
 const root = fakeInstallRoot();
 write(path.join(root, 'desk', 'package.json'), '{"version":"0.3.9"}'); /* abaixo da anunciada: a trava anti-rollback deixa passar */
 const runtime = tmp();
  const child = require('node:child_process').spawn('sleep', ['0.2']);
  const zip = makeZip({'x/desk/main.cjs': 'main novo', 'x/desk/package.json': '{"version":"0.4.0"}'});
  const release = makeSignedRelease({version: '0.4.0', commit: TEST_COMMIT, zip});
  const result = await updater.applyUpdate({
    mode: 'zip', rootDir: root, deskDir: path.join(root, 'desk'), runtime, announcedVersion: '0.4.0',
    publicKey: release.publicKey, fetchBuffer: release.fetchBuffer,
    run: async () => ({stdout: ''}),
    reopen: () => {},
    waitPid: child.pid,
    pidTimeout: 15000,
  });
  assert.equal(result.ok, true, 'com o PID saído o update aplica');
  assert.equal(read(path.join(root, 'desk', 'main.cjs')), 'main novo');
  child.kill();
});

/* ---------- #80: atualização assinada ---------- */

test('#80: chave pública marcador recusa sem sequer baixar a release', async () => {
  const root = fakeInstallRoot();
  const runtime = tmp();
  const release = makeSignedRelease({version: '0.4.1', commit: TEST_COMMIT, zip: makeZip(NOVO)});
  let downloads = 0;
  const result = await updater.applyUpdate({
    mode: 'zip', rootDir: root, deskDir: path.join(root, 'desk'), runtime, announcedVersion: '0.4.1',
    publicKey: 'PLACEHOLDER — chave ainda não configurada',
    fetchBuffer: async (url) => { downloads++; return release.fetchBuffer(url); },
    run: async () => ({stdout: ''}), reopen: () => {}, waitPid: 0,
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /chave pública de atualização não foi configurada/);
  assert.equal(downloads, 0, 'o marcador recusa antes de qualquer download');
  assert.equal(read(path.join(root, 'desk', 'main.cjs')), 'main antigo', 'nada aplicado');
});

test('#80: manifesto ausente (404) recusa a atualização inteira', async () => {
  const root = fakeInstallRoot();
  const runtime = tmp();
  const release = makeSignedRelease({version: '0.4.1', commit: TEST_COMMIT, zip: makeZip(NOVO)});
  const result = await updater.applyUpdate({
    mode: 'zip', rootDir: root, deskDir: path.join(root, 'desk'), runtime, announcedVersion: '0.4.1',
    publicKey: release.publicKey,
    fetchBuffer: async () => { throw Error('HTTP 404'); },
    run: async () => ({stdout: ''}), reopen: () => {}, waitPid: 0,
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /manifesto assinado/);
  assert.match(result.reason, /HTTP 404/);
  assert.equal(read(path.join(root, 'desk', 'main.cjs')), 'main antigo', 'nada aplicado');
});

test('#80: branch que para fora do commit assinado recusa e desfaz (só o commit da Release vale)', async () => {
  const root = fakeInstallRoot();
  fs.mkdirSync(path.join(root, '.git'));
  const runtime = tmp();
  const outroCommit = 'c'.repeat(40);
  let heads = 0;
  const calls = [];
  const run = async (cmd, args) => {
    calls.push([cmd, ...args]);
    if (cmd === 'git' && args[0] === 'rev-parse') {
      if (args[1] === '--verify') return {stdout: `${TEST_COMMIT}\n`};
      heads++;
      return {stdout: `${heads === 1 ? TEST_COMMIT : outroCommit}\n`};
    }
    return {stdout: ''};
  };
  const release = makeSignedRelease({version: '0.4.1', commit: TEST_COMMIT, zip: Buffer.from('zip')});
  const result = await updater.applyUpdate({
    mode: 'git', rootDir: root, deskDir: path.join(root, 'desk'), runtime,
    announcedVersion: '0.4.1', publicKey: release.publicKey, fetchBuffer: release.fetchBuffer,
    run, reopen: () => {}, waitPid: 0,
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /manifesto assinado é do commit/);
  assert.ok(calls.some((call) => call[0] === 'git' && call[1] === 'reset'), 'rollback volta o HEAD anterior');
  assert.ok(!calls.some((call) => call[0] === 'npm' && call[1] === 'ci'), 'sem lock novo, sem npm ci');
  assert.equal(read(path.join(root, 'desk', 'main.cjs')), 'main antigo');
});

test('#80: commit da tag diferente do manifesto recusa git e bundle antes do merge', async () => {
  for (const mode of ['git', 'bundle']) {
    const clone = fakeInstallRoot();
    fs.mkdirSync(path.join(clone, '.git'));
    const payload = mode === 'bundle' ? tmp() : null;
    if (payload) {
      write(path.join(payload, 'package.json'), '{"version":"0.4.0"}');
      write(path.join(payload, 'main.cjs'), 'main antigo (payload)');
    }
    const runtime = tmp();
    const calls = [];
    const outroCommit = 'b'.repeat(40);
    const run = async (cmd, args) => {
      calls.push([cmd, ...args]);
      if (cmd === 'git' && args[0] === 'rev-parse') {
        return {stdout: args[1] === '--verify' ? `${outroCommit}\n` : `${TEST_COMMIT}\n`};
      }
      return {stdout: ''};
    };
    const release = makeSignedRelease({version: '0.4.1', commit: TEST_COMMIT, zip: Buffer.from('zip')});
    const result = await updater.applyUpdate({
      mode, rootDir: clone, deskDir: payload || path.join(clone, 'desk'), runtime,
      announcedVersion: '0.4.1', sourceInfo: mode === 'bundle' ? {path: clone} : null,
      publicKey: release.publicKey, fetchBuffer: release.fetchBuffer, run, reopen: () => {}, waitPid: 0,
    });
  assert.equal(result.ok, false, `${mode}: recusa`);
  assert.match(result.reason, /commit da tag v0\.4\.1/, `${mode}: motivo diz a tag`);
  assert.match(result.reason, /não bate com o commit do manifesto assinado/, `${mode}: motivo diz o manifesto`);
  assert.ok(!calls.some((call) => call[0] === 'git' && call[1] === 'merge'), `${mode}: merge nunca acontece`);
  assert.equal(read(path.join(clone, 'desk', 'main.cjs')), 'main antigo', `${mode}: nada aplicado`);
 }
});

/* ---------- Anti-rollback: a anunciada tem de ser mais nova que a instalada ----------
   Quem controla os metadados da Release pública, sem a chave, pode marcar uma
   versão assinada ANTIGA como `latest`; sem a trava, o updater instalava. A
   recusa vem antes de qualquer mutação e antes de baixar (o `downloads` conta
   os GETs do manifesto/assinatura/zip). */

/* Instalação numa versão, com o zip assinado de outra. */
function olderSignedRelease(installed, announced) {
  const root = fakeInstallRoot();
  write(path.join(root, 'desk', 'package.json'), `{"version":"${installed}"}`);
  const zip = makeZip({
   'x/desk/package.json': `{"version":"${announced}"}`,
   'x/desk/main.cjs': `main da v${announced}`,
  });
  return {root, release: makeSignedRelease({version: announced, commit: TEST_COMMIT, zip})};
}

test('anti-rollback: versão assinada mais velha recusa sem baixar e sem tocar o disco', async () => {
 const {root, release} = olderSignedRelease('0.4.1', '0.4.0');
 const runtime = tmp();
 const reopens = [];
 let downloads = 0;
 const result = await updater.applyUpdate({
  mode: 'zip', rootDir: root, deskDir: path.join(root, 'desk'), runtime,
  announcedVersion: '0.4.0', publicKey: release.publicKey,
  fetchBuffer: async (url) => { downloads++; return release.fetchBuffer(url); },
  run: async () => ({stdout: ''}), reopen: () => reopens.push('reabriu'), waitPid: 0,
 });
 assert.equal(result.ok, false);
 assert.match(result.reason, /não é mais nova/);
 assert.match(result.reason, /0\.4\.0/);
 assert.match(result.reason, /0\.4\.1/);
 assert.equal(downloads, 0, 'a trava vem antes de baixar o manifesto');
 assert.equal(read(path.join(root, 'desk', 'main.cjs')), 'main antigo', 'nada aplicado');
 assert.equal(read(path.join(root, 'desk', 'package.json')), '{"version":"0.4.1"}');
 assert.equal(fs.existsSync(path.join(root, '.update-manifest.json')), false, 'sem prova de aplicação');
 assert.deepEqual(reopens, [], 'recusa antes de mutar: nada a reabrir');
 assert.match(logOf(runtime), /não é mais nova/);
});

test('anti-rollback: versão igual à instalada recusa (reinstalar não é update)', async () => {
 const {root, release} = olderSignedRelease('0.4.0', '0.4.0');
 const runtime = tmp();
 let downloads = 0;
 const result = await updater.applyUpdate({
  mode: 'zip', rootDir: root, deskDir: path.join(root, 'desk'), runtime,
  announcedVersion: '0.4.0', publicKey: release.publicKey,
  fetchBuffer: async (url) => { downloads++; return release.fetchBuffer(url); },
  run: async () => ({stdout: ''}), reopen: () => {}, waitPid: 0,
 });
 assert.equal(result.ok, false);
 assert.match(result.reason, /não é mais nova/);
 assert.equal(downloads, 0, 'a trava vem antes de baixar o manifesto');
 assert.equal(read(path.join(root, 'desk', 'main.cjs')), 'main antigo', 'nada aplicado');
});

test('anti-rollback: allowOlder aplica a mais velha; sem ele, a mesma recusa', async () => {
 /* Só o CLI passa `allowOlder` (com `--versao` explícito): a chamada automática
    nunca passa, então o caminho automático segue travado. */
 for (const allowOlder of [false, true]) {
  const {root, release} = olderSignedRelease('0.4.1', '0.4.0');
  const runtime = tmp();
  const result = await updater.applyUpdate({
   mode: 'zip', rootDir: root, deskDir: path.join(root, 'desk'), runtime,
   announcedVersion: '0.4.0', publicKey: release.publicKey, fetchBuffer: release.fetchBuffer,
   run: async () => ({stdout: ''}), reopen: () => {}, waitPid: 0, allowOlder,
  });
  assert.equal(result.ok, allowOlder, `allowOlder=${allowOlder}`);
  assert.equal(read(path.join(root, 'desk', 'main.cjs')), allowOlder ? 'main da v0.4.0' : 'main antigo');
 }
});

test('anti-rollback no modo git: anunciada mais velha recusa antes de qualquer git', async () => {
 const {root, release} = olderSignedRelease('0.4.1', '0.4.0');
 const runtime = tmp();
 const {run, calls} = fakeRun();
 const result = await updater.applyUpdate({
  mode: 'git', rootDir: root, deskDir: path.join(root, 'desk'), runtime,
  announcedVersion: '0.4.0', publicKey: release.publicKey, fetchBuffer: release.fetchBuffer,
  run, reopen: () => {}, waitPid: 0,
 });
 assert.equal(result.ok, false);
 assert.match(result.reason, /não é mais nova/);
 assert.deepEqual(calls, [], 'nem o git rev-parse roda antes da trava');
 assert.equal(read(path.join(root, 'desk', 'main.cjs')), 'main antigo', 'nada aplicado');
});
