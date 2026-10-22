import test from 'node:test';
import assert from 'node:assert/strict';
import {ptText} from './pt-text.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {installFakeTools} from './fake-tool-binaries.mjs';

/* Avisos e "Atualizar" do Pi e do Claude Code (#45), com `brew`/`npm`/`claude`
   FALSOS (tests/fake-tool-binaries.mjs): nada daqui roda o comando de verdade,
   nem fala com a rede (as versões "mais novas" entram por `latestOverride`). */
const require = createRequire(import.meta.url);
const {createToolUpdates, sanitizeNotices} = require('../tool-updates.cjs');
const {CLAUDE_RANGE} = require('../src/agents/claude-environment.cjs');
const tested = require('../src/tested-versions.json');

const DAY = 24 * 60 * 60 * 1000;
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-tool-updates-'));

function harness({fake = {}, latest = {pi: '1.4.0', claude: '2.1.302'}, busy = false, bridge = true, now = 20_000 * DAY, state = {}, allowRun = true, run} = {}) {
  const dir = tmp();
  const tools = installFakeTools(dir, fake);
  const seen = {persist: 0, relink: 0, events: [], logs: []};
  const box = {state, busy, bridge, now};
  const host = createToolUpdates({
    runtime: path.join(dir, 'runtime'), deskDir: path.join(dir, 'desk'), config: () => ({}),
    state: () => box.state, persist: () => { seen.persist++; },
    isBusy: async () => box.busy, hasBridge: () => box.bridge, relink: () => { seen.relink++; },
    send: (channel, payload) => seen.events.push({channel, payload}),
    appendLog: (src, line) => seen.logs.push(`${src}: ${line}`),
    testMode: true, allowRunInTest: allowRun, now: () => box.now,
    latestOverride: latest || undefined, piPath: tools.piPath, claudeLauncher: tools.claudeLauncher,
    searchDirs: [tools.bin], home: dir, ...(run ? {run} : {}),
  });
  fs.mkdirSync(path.join(dir, 'runtime'), {recursive: true});
  return {host, tools, seen, box, dir};
}

test('tabela "testada com esta Mesa": o Claude testado é a referência da faixa aceita e o Pi passou nos testes nativos', () => {
  assert.equal(tested.claude, CLAUDE_RANGE.tested, 'a faixa lê a tabela: uma fonte só (#51)');
  assert.equal(tested.claudeMinimum, CLAUDE_RANGE.minimum);
  assert.match(tested.pi, /^\d+\.\d+\.\d+$/);
});

test('sanitizeNotices: só versões estritas e dia inteiro; o resto vira vazio', () => {
  assert.deepEqual(sanitizeNotices({pi: {seen: '1.3.0', ignored: '1.4.0-rc.1', remindDay: 'x'}, claude: {remindDay: 20000.5}, outro: 1}),
    {pi: {seen: '1.3.0', ignored: '', remindDay: 0}, claude: {seen: '', ignored: '', remindDay: 0}});
  assert.deepEqual(sanitizeNotices(null).pi, {seen: '', ignored: '', remindDay: 0});
  assert.equal(sanitizeNotices({pi: {remindDay: 20000}}).pi.remindDay, 20000);
});

test('notices: versão nova acende a linha e o ponto; sem rede não há aviso nem erro', async () => {
  const h = harness();
  const s = await h.host.notices();
  assert.deepEqual(s.lines.map((l) => [l.id, l.name, l.version]), [['pi', 'Pi', '1.4.0'], ['claude', 'Claude Code', '2.1.302']]);
  assert.equal(s.dot, true);
  assert.equal(s.lines[0].ahead, true, 'a 1.4.0 passa da testada (1.3.0)');
  assert.equal(s.lines[1].ahead, true, 'a 2.1.302 passa da testada (2.1.301)');

  const offline = harness({latest: null});
  const quiet = await offline.host.notices();
  assert.deepEqual(quiet.lines, []);
  assert.equal(quiet.dot, false);
  assert.equal(quiet.items.pi.unreachable, true, 'não deu para conferir é fato, não erro');
});

test('abrir o Sobre vê a versão: o ponto some, a linha fica, e só uma mais nova acende de novo', async () => {
  const h = harness();
  const opened = await h.host.opened();
  assert.equal(opened.dot, false);
  assert.equal(opened.lines.length, 2, 'ver não é ignorar');
  assert.equal(h.seen.persist, 2);
  assert.equal(h.box.state.toolNotices.pi.seen, '1.4.0');
  assert.equal((await h.host.notices()).dot, false, 'reabrir a Mesa não acende o ponto de novo');
});

test('"Lembrar depois" cala hoje e volta amanhã como novidade', async () => {
  const h = harness();
  await h.host.opened();
  const calada = await h.host.postpone('pi');
  assert.deepEqual(calada.lines.map((l) => l.id), ['claude']);
  assert.equal(h.box.state.toolNotices.pi.remindDay, 20_001);
  h.box.now += DAY;
  const volta = await h.host.notices();
  assert.deepEqual(volta.lines.map((l) => l.id), ['pi', 'claude']);
  assert.equal(volta.dot, true, 'no dia combinado o ponto reacende');
});

test('"Ignorar esta versão" cala a versão; uma mais nova acorda o aviso', async () => {
  const h = harness();
  await h.host.ignore('claude');
  assert.equal(h.box.state.toolNotices.claude.ignored, '2.1.302');
  assert.deepEqual((await h.host.notices()).lines.map((l) => l.id), ['pi']);
  const nova = harness({state: h.box.state, latest: {pi: '1.4.0', claude: '2.1.303'}});
  assert.deepEqual((await nova.host.notices()).lines.map((l) => l.id), ['pi', 'claude']);
  await assert.rejects(() => h.host.ignore('node'), /ferramenta desconhecida: "node"; esperado pi ou claude/);
});

test('run (Homebrew): roda o comando exato, mostra a frase e religa o tutor', async () => {
  const h = harness();
  const r = await h.host.run('pi');
  assert.deepEqual(h.tools.calls(), [{tool: 'brew', args: ['upgrade', 'pi-coding-agent']}]);
  assert.equal(r.ok, true);
  assert.equal(ptText(r.sentence), 'Pi atualizado para 1.4.0. O tutor religou com a versão nova.');
  assert.equal(r.relink, true);
  assert.equal(h.seen.relink, 1);
  assert.match(r.output, /brew rodando upgrade pi-coding-agent/);
  assert.deepEqual(r.notices.lines.map((l) => l.id), ['claude'], 'o Pi já está na nova: a linha dele some');
  assert.ok(h.seen.logs.some((l) => l.includes('brew upgrade pi-coding-agent')), 'o comando fica no log; a saída não');
});

test('run (npm global): npm i -g do pacote do Pi', async () => {
  const h = harness({fake: {install: 'npm'}});
  const r = await h.host.run('pi');
  assert.deepEqual(h.tools.calls(), [{tool: 'npm', args: ['i', '-g', '@earendil-works/pi-coding-agent']}]);
  assert.equal(r.ok, true);
});

test('run (Claude Code): `claude update`; o tutor "religa na versão nova" se ela couber na faixa (#51)', async () => {
  const h = harness();
  const r = await h.host.run('claude');
  assert.deepEqual(h.tools.calls(), [{tool: 'claude', args: ['update']}]);
  assert.equal(ptText(r.sentence), 'Claude Code atualizado para 2.1.302. O tutor religou com a versão nova.', 'mais nova que a testada, na série: o tutor usa');
  assert.equal(r.relink, true);

  const serieNova = harness({fake: {claudeAfter: '2.2.0'}});
  const r2 = await serieNova.host.run('claude');
  assert.equal(ptText(r2.sentence), 'Claude Code atualizado para 2.2.0.', 'série nova fica fora da faixa: não promete religar com ela');
  assert.equal(r2.relink, true, 'o tutor reconecta mesmo assim (e a coluna diz a recusa)');
});

test('run: comando que falha vira frase e saída, sem religar nada', async () => {
  const h = harness({fake: {failBrew: true}});
  const r = await h.host.run('pi');
  assert.equal(r.ok, false);
  assert.equal(ptText(r.sentence), 'Não deu para atualizar o Pi. Veja a saída abaixo.');
  assert.match(r.output, /falhou de propósito/);
  assert.equal(h.seen.relink, 0);
});

test('run: terminou bem mas a versão não mudou — não se chama de sucesso', async () => {
  const h = harness({fake: {stuckVersion: true}});
  const r = await h.host.run('pi');
  assert.equal(r.ok, true);
  assert.match(ptText(r.sentence), /O comando terminou, mas o Pi segue na 1\.2\.0\./);
  assert.equal(h.seen.relink, 0, 'sem versão nova não há por que religar');
});

test('run: recusas — tutor respondendo, instalação sem comando, ferramenta desconhecida, modo de teste', async () => {
  const ocupado = harness({busy: true});
  await assert.rejects(() => ocupado.host.run('pi'), (error) => /Espere o tutor terminar a resposta/.test(ptText(error.message)));
  assert.deepEqual(ocupado.tools.calls(), [], 'nada rodou');

  const solto = harness({fake: {install: 'unknown'}});
  await assert.rejects(() => solto.host.run('pi'), (error) => /sem comando para rodar: pi \(unknown\)/.test(ptText(error.message)));
  assert.deepEqual(solto.tools.calls(), []);

  await assert.rejects(() => harness().host.run('xournal'), /ferramenta desconhecida: "xournal"; esperado pi ou claude/);
  await assert.rejects(() => harness({allowRun: false}).host.run('pi'), (error) => /desativada no modo de teste/.test(ptText(error.message)));
});

test('run: o lock compartilhado impede duas atualizações ao mesmo tempo e é solto no fim', async () => {
  const h = harness();
  const lockFile = require('../updater.cjs').lockFileOf(path.join(h.dir, 'runtime'));
  fs.writeFileSync(lockFile, JSON.stringify({at: Date.now()}));
  await assert.rejects(() => h.host.run('pi'), (error) => /já existe uma atualização em andamento/.test(ptText(error.message)));
  fs.rmSync(lockFile);
  await h.host.run('pi');
  assert.equal(fs.existsSync(lockFile), false, 'o lock não fica preso depois do comando');
});

test('run: sem o instalador no computador a frase é de falha, com o nome do que faltou', async () => {
  const h = harness();
  fs.rmSync(path.join(h.tools.bin, 'brew'));
  const r = await h.host.run('pi');
  assert.equal(r.ok, false);
  assert.match(ptText(r.output), /Não achei "brew" neste computador/);
});

/* Regressão: ao abrir a Mesa o aviso lia a versão com `pi --version`, e isso
   subia o Pi (extensões e tudo) com o cwd da pasta da Mesa — o teste da aba
   Livre acusou um Pi fora de matéria/Livre. Aviso só lê o package.json. */
test('notices: nunca executa o Pi para ler a versão', async () => {
  const spawned = [];
  const h = harness({fake: {install: 'unknown'}, run: async (file, args) => {
    spawned.push([file, ...args]);
    return {stdout: '2.1.296 (Claude Code)'};
  }});
  const s = await h.host.notices();
  assert.equal(spawned.some(([file]) => file === h.tools.piPath), false, 'o Pi não foi executado');
  assert.equal(s.items.pi.available, false, 'sem package.json não há versão instalada, logo nada a avisar');
});

/* Sem reserva do SDK (#51): os avisos só perguntam a versão ao Claude Code do usuário. */
test('notices: só o Claude Code do usuário é consultado, e só com --version', async () => {
  const spawned = [];
  const h = harness({run: async (file, args) => {
    spawned.push([file, ...args]);
    return {stdout: '2.1.296 (Claude Code)'};
  }});
  await h.host.notices();
  const claudeCalls = spawned.filter(([file]) => /claude/.test(path.basename(file)));
  assert.deepEqual(claudeCalls, [[h.tools.claudeLauncher, '--version']], 'nenhum outro binário do Claude, nenhum auth');
});
