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
  assert.match(logOf(runtime), /v0\.4\.1 no lugar \(conferida no package\.json\)/, 'a versão logada é a CONFERIDA (A3)');

  /* B1: o manifesto da instalação nasce com o que foi escrito. */
  const manifesto = JSON.parse(read(path.join(root, '.update-manifest.json')));
  assert.equal(manifesto.version, '0.4.1');
  assert.ok(manifesto.files.includes('desk/main.cjs'));
  assert.ok(manifesto.files.includes('desk/src/novo.mjs'));
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
  /* A3: a versão CONFERIDA (package.json = 0.4.0 aqui) é a que volta no result. */
  assert.equal(result.version, '0.4.0', 'a versão devolvida é a instalada, não a anunciada');
  assert.deepEqual(calls, [
    ['git', 'rev-parse', 'HEAD'], ['git', 'status', '--porcelain'], ['git', 'pull', '--ff-only'],
  ], 'status do clone antes do pull (A5); sem lock novo não há npm ci');
  assert.match(logOf(runtime), /git pull --ff-only ok \(branch de desenvolvimento do clone\)/);
});

test('modo git: clone com trabalho local é recusado antes de qualquer mutação (A5)', async () => {
  const root = fakeInstallRoot();
  fs.mkdirSync(path.join(root, '.git'));
  const runtime = tmp();
  const {run, calls} = fakeRun((cmd, args) => {
    if (cmd === 'git' && args[0] === 'rev-parse') return {stdout: 'abc123\n'};
    if (cmd === 'git' && args[0] === 'status') return {stdout: ' M desk/main.cjs\n'};
    return {stdout: ''};
  });
  const reopens = [];
  const result = await updater.applyUpdate({
    mode: 'git', rootDir: root, deskDir: path.join(root, 'desk'), runtime,
    announcedVersion: '0.4.1', run, reopen: () => reopens.push('reabriu'), waitPid: 0,
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /trabalho local/);
  assert.deepEqual(calls, [['git', 'rev-parse', 'HEAD'], ['git', 'status', '--porcelain']], 'o pull NEM COMEÇA');
  assert.equal(read(path.join(root, 'desk', 'main.cjs')), 'main antigo', 'o trabalho local não foi tocado');
  assert.deepEqual(reopens, ['reabriu']);
  assert.match(logOf(runtime), /FALHOU \(o clone tem trabalho local/);
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
  assert.deepEqual(calls, [
    ['git', 'rev-parse', 'HEAD'], ['git', 'status', '--porcelain'], ['git', 'pull', '--ff-only'], ['git', 'reset', '--hard', 'abc123'],
  ], 'o rollback volta o clone para a cabeça antiga');
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
    'git rev-parse', 'git status', 'git pull', 'npm ci', 'git reset', 'npm ci',
  ], 'ordem: status → pull → ci quebra → reset/restore → ci de recuperação');
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
test('A1: falha depois do npm ci → rollback refaz as dependências (depsTouched persiste)', async () => {
  const clone = fakeInstallRoot();
  fs.mkdirSync(path.join(clone, '.git'));
  /* O payload do bundle (o que o install-app reescreve por inteiro). */
  const payload = tmp();
  write(path.join(payload, 'package.json'), '{"version":"0.4.0"}');
  write(path.join(payload, 'main.cjs'), 'main antigo (payload)');
  const runtime = tmp();
  let npmCount = 0;
  const {run} = fakeRun((cmd, args) => {
    if (cmd === 'git' && args[0] === 'rev-parse') return {stdout: 'abc123\n'};
    if (cmd === 'git' && args[0] === 'pull') {
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
  const {run} = fakeRun((cmd, args) => {
    if (cmd === 'git' && args[0] === 'rev-parse') return {stdout: 'abc123\n'};
    if (cmd === 'node') {nodeCalls++; if (nodeCalls === 1) throw Error('install-app estourou no meio'); return {stdout: ''};}
    if (cmd === 'codesign') {assinaturas.push(args.join(' ')); return {stdout: ''};}
    return {stdout: ''};
  });
  const result = await updater.applyUpdate({
    mode: 'bundle', rootDir: clone, deskDir: payload, runtime,
    announcedVersion: '0.4.1', sourceInfo: {path: clone},
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
  const vitima = path.join(path.dirname(root), 'vitima-manifesto.txt');
  write(vitima, 'não me apaga');
  const linhas = [];
  const removidos = updater.removeOrphans(root, ['desk/src/velho.mjs', '../' + path.basename(vitima), '/etc/hosts'], [], (l) => linhas.push(l));
  assert.equal(removidos, 1, 'só o órfão gerenciado é removido');
  assert.equal(fs.existsSync(path.join(root, 'desk', 'src', 'velho.mjs')), false, 'o órfão gerenciado sai');
  assert.equal(fs.existsSync(vitima), true, 'o arquivo fora da raiz sobrevive');
  assert.match(linhas.join('\n'), /entrada de manifesto recusada/);
});

test('applyPiOnly: npm install do Pi local no pós-fechamento; falha vira motivo no log', async () => {
  const deskDir = path.join(tmp(), 'desk');
  fs.mkdirSync(deskDir, {recursive: true});
  const runtime = tmp();
  const reopens = [];
  let cwdVisto = '';
  const ok = fakeRun((cmd, args, opts) => { cwdVisto = opts?.cwd || ''; return {stdout: ''}; });
  const okResult = await updater.applyPiOnly({deskDir, runtime, run: ok.run, reopen: () => reopens.push('reabriu')});
  assert.equal(okResult.ok, true);
  assert.deepEqual(ok.calls, [['npm', 'install', '@earendil-works/pi-coding-agent@latest']]);
  /* A2: o npm do Pi agora roda em desk/.pi-local (package.json próprio, fora
     da árvore npm da Mesa) — o cwd do npm é a pasta do Pi, nunca o desk. */
  assert.equal(cwdVisto, path.join(deskDir, '.pi-local'), 'o npm do Pi roda dentro de desk/.pi-local');
  assert.equal(fs.existsSync(path.join(deskDir, '.pi-local', 'package.json')), true, 'a pasta do Pi local tem package.json próprio');
  assert.equal(fs.existsSync(path.join(deskDir, 'package.json')), false, 'o npm do Pi NÃO cria package.json na raiz do desk');
  assert.equal(reopens.length, 1);

  const falha = fakeRun(() => { throw Error('registry fora do ar'); });
  const badResult = await updater.applyPiOnly({deskDir, runtime, run: falha.run, reopen: () => reopens.push('reabriu')});
  assert.equal(badResult.ok, false);
  assert.match(logOf(runtime), /FALHOU ao atualizar o Pi \(registry fora do ar\)/);
  assert.equal(reopens.length, 2, 'mesmo na falha a Mesa reabre (com o Pi que já estava)');
});

/* ---------- D2: o Pi local sobrevive à atualização da Mesa ---------- */

test('D2/A2: update da Mesa deixa o Pi local (.pi-local) resolvível e executável', async () => {
  const root = fakeInstallRoot();
  const deskDir = path.join(root, 'desk');
  /* Contrato novo: o Pi mora em desk/.pi-local, com lock próprio. */
  const piHome = path.join(deskDir, '.pi-local');
  fs.mkdirSync(path.join(piHome, 'node_modules', '.bin'), {recursive: true});
  fs.writeFileSync(path.join(piHome, 'package.json'), '{"name":"mesa-pi-local","version":"1.0.0","private":true}');
  fs.writeFileSync(path.join(piHome, 'node_modules', '.bin', 'pi'), '#!/usr/bin/env node\n');
  fs.chmodSync(path.join(piHome, 'node_modules', '.bin', 'pi'), 0o755);
  const {resolvePi, ensurePiLocalHome} = require('../pi.cjs');
  const antes = resolvePi({deskDir});
  assert.equal(antes, path.join(piHome, 'node_modules', '.bin', 'pi'), 'o Pi local vence os candidatos automáticos');

  const runtime = tmp();
  const zip = makeZip({
    'x/desk/package.json': '{"version":"0.4.1"}',
    'x/desk/package-lock.json': '{"lock":"novo"}',
    'x/desk/main.cjs': 'main novo',
  });
  const result = await updater.applyUpdate({
    mode: 'zip', rootDir: root, deskDir, runtime, announcedVersion: '0.4.1',
    fetchBuffer: async () => zip, run: async () => ({stdout: ''}), reopen: () => {}, waitPid: 0,
  });
  assert.equal(result.ok, true);
  /* O update reescreveu o desk inteiro; o Pi local (e o lock dele) ficou. */
  assert.equal(fs.existsSync(path.join(piHome, 'node_modules', '.bin', 'pi')), true, 'o binário do Pi continua lá');
  assert.equal(resolvePi({deskDir}), antes, 'resolvePi continua achando o Pi local');
  assert.equal(ensurePiLocalHome(deskDir), piHome, 'o ensure mantém a mesma pasta');
  /* E o lock do Pi nunca foi para a lista do updater (protegido de fato). */
  const manifesto = JSON.parse(read(path.join(root, '.update-manifest.json')));
  assert.ok(!manifesto.files.some((f) => f.startsWith('.pi-local/')), 'o Pi local está fora do manifesto do zip');
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
  const result = await updater.applyUpdate({
    mode: 'zip', rootDir: root, deskDir: path.join(root, 'desk'), runtime, announcedVersion: '0.4.1',
    fetchBuffer: async () => zip, run: async () => ({stdout: ''}), reopen: () => {}, waitPid: 0,
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
  const result = await updater.applyUpdate({
    mode: 'zip', rootDir: root, deskDir: path.join(root, 'desk'), runtime, announcedVersion: '0.4.1',
    fetchBuffer: async () => zip, run: async () => ({stdout: ''}), reopen: () => reopens.push('r'), waitPid: 0,
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
  const result = await updater.applyUpdate({
    mode: 'zip', rootDir: root, deskDir: path.join(root, 'desk'), runtime, announcedVersion: '0.4.1',
    fetchBuffer: async () => zip,
    run: async () => ({stdout: ''}),
    reopen: () => {}, waitPid: 0,
    restore: (rootDir, backupDir) => {
      backupInjetado = backupDir; // confere que é o MESMO backup do instantâneo
      throw Error('disco cheio no meio do restore');
    },
  });
  assert.equal(result.ok, false);
  assert.equal(result.incomplete, true, 'a falha é declarada como recuperação incompleta');
  assert.ok(result.backup && fs.existsSync(result.backup), 'o backup fica no disco');
  assert.equal(backupInjetado, result.backup, 'o backup reportado é o que o updater criou');
  const log = logOf(runtime);
  assert.match(log, /rollback incompleto \(disco cheio no meio do restore\)/);
  assert.match(log, new RegExp(`backup PRESERVADO em ${result.backup.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
  /* O restore foi interrompido antes de copiar: o código novo sobreviveu — é
     exatamente por isso que o backup não pode ser apagado. */
  assert.equal(read(path.join(root, 'desk', 'main.cjs')), 'main novo');
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
  const runtime = tmp();
  const child = require('node:child_process').spawn('sleep', ['0.2']);
  const result = await updater.applyUpdate({
    mode: 'zip', rootDir: root, deskDir: path.join(root, 'desk'), runtime, announcedVersion: '0.4.0',
    fetchBuffer: async () => makeZip({'x/desk/main.cjs': 'main novo', 'x/desk/package.json': '{"version":"0.4.0"}'}),
    run: async () => ({stdout: ''}),
    reopen: () => {},
    waitPid: child.pid,
    pidTimeout: 15000,
  });
  assert.equal(result.ok, true, 'com o PID saído o update aplica');
  assert.equal(read(path.join(root, 'desk', 'main.cjs')), 'main novo');
  child.kill();
});
