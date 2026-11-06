import test from 'node:test';
import assert from 'node:assert/strict';
import {ptText} from './pt-text.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {installFakeTools} from './fake-tool-binaries.mjs';
import {tempDir} from './temp-dir.mjs';

/* Avisos e "Atualizar" do Claude Code (#45), com `claude` FALSO
   (tests/fake-tool-binaries.mjs): nada daqui roda o comando de verdade, nem
   fala com a rede (as versões "mais novas" entram por `latestOverride`). */
const require = createRequire(import.meta.url);
const {createToolUpdates, sanitizeNotices} = require('../tool-updates.cjs');
const {CLAUDE_RANGE} = require('../src/agents/claude-environment.cjs');
const tested = require('../src/tested-versions.json');

const DAY = 24 * 60 * 60 * 1000;
const tmp = () => tempDir('mesa-tool-updates');

function harness({fake = {}, latest = {claude: '2.1.302'}, busy = false, bridge = true, now = 20_000 * DAY, state = {}, allowRun = true, run, claudeLauncher} = {}) {
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
    latestOverride: latest || undefined, claudeLauncher: claudeLauncher === undefined ? tools.claudeLauncher : claudeLauncher,
    searchDirs: [tools.bin], home: dir, ...(run ? {run} : {}),
  });
  fs.mkdirSync(path.join(dir, 'runtime'), {recursive: true});
  return {host, tools, seen, box, dir};
}

test('tabela "testada com esta Mesa": o Claude testado é a referência da faixa aceita', () => {
  assert.equal(tested.claude, CLAUDE_RANGE.tested, 'a faixa lê a tabela: uma fonte só (#51)');
  assert.equal(tested.claudeMinimum, CLAUDE_RANGE.minimum);
});

test('sanitizeNotices: só versões estritas e dia inteiro; o resto vira vazio', () => {
  assert.deepEqual(sanitizeNotices({claude: {seen: '2.1.302', ignored: '2.1.303-rc.1', remindDay: 'x'}, outro: 1}),
    {claude: {seen: '2.1.302', ignored: '', remindDay: 0}});
  assert.deepEqual(sanitizeNotices(null).claude, {seen: '', ignored: '', remindDay: 0});
  assert.equal(sanitizeNotices({claude: {remindDay: 20000}}).claude.remindDay, 20000);
});

test('notices: versão nova acende a linha e o ponto; sem rede não há aviso nem erro', async () => {
  const h = harness();
  const s = await h.host.notices();
  assert.deepEqual(s.lines.map((l) => [l.id, l.name, l.version]), [['claude', 'Claude Code', '2.1.302']]);
  assert.equal(s.dot, true);
  assert.equal(s.lines[0].ahead, true, 'a 2.1.302 passa da testada');

  const offline = harness({latest: null});
  const quiet = await offline.host.notices();
  assert.deepEqual(quiet.lines, []);
  assert.equal(quiet.dot, false);
  assert.equal(quiet.items.claude.unreachable, true, 'não deu para conferir é fato, não erro');
});

test('abrir o Sobre vê a versão: o ponto some, a linha fica, e só uma mais nova acende de novo', async () => {
  const h = harness();
  const opened = await h.host.opened();
  assert.equal(opened.dot, false);
  assert.equal(opened.lines.length, 1, 'ver não é ignorar');
  assert.equal(h.seen.persist, 1);
  assert.equal(h.box.state.toolNotices.claude.seen, '2.1.302');
  assert.equal((await h.host.notices()).dot, false, 'reabrir a Mesa não acende o ponto de novo');
});

test('"Lembrar depois" cala hoje e volta amanhã como novidade', async () => {
  const h = harness();
  await h.host.opened();
  const calada = await h.host.postpone('claude');
  assert.deepEqual(calada.lines, []);
  assert.equal(h.box.state.toolNotices.claude.remindDay, 20_001);
  h.box.now += DAY;
  const volta = await h.host.notices();
  assert.deepEqual(volta.lines.map((l) => l.id), ['claude']);
  assert.equal(volta.dot, true, 'no dia combinado o ponto reacende');
});

test('"Ignorar esta versão" cala a versão; uma mais nova acorda o aviso', async () => {
  const h = harness();
  await h.host.ignore('claude');
  assert.equal(h.box.state.toolNotices.claude.ignored, '2.1.302');
  assert.deepEqual((await h.host.notices()).lines, []);
  const nova = harness({state: h.box.state, latest: {claude: '2.1.303'}});
  assert.deepEqual((await nova.host.notices()).lines.map((l) => l.id), ['claude']);
  await assert.rejects(() => h.host.ignore('node'), /ferramenta desconhecida: "node"; esperado claude/);
});

test('run (Claude Code): `claude update`; o tutor "religa na versão nova" se ela couber na faixa (#51)', async () => {
  const h = harness();
  const r = await h.host.run('claude');
  assert.deepEqual(h.tools.calls(), [{tool: 'claude', args: ['update']}]);
  assert.equal(ptText(r.sentence), 'Claude Code atualizado para 2.1.302. O tutor religou com a versão nova.', 'mais nova que a testada, na série: o tutor usa');
  assert.equal(r.relink, true);
  assert.equal(h.seen.relink, 1);
  assert.match(r.output, /Checking for updates/);
  assert.deepEqual(r.notices.lines, [], 'o Claude já está na nova: a linha dele some');
  assert.ok(h.seen.logs.some((l) => l.includes('claude update')), 'o comando fica no log; a saída não');

  const serieNova = harness({fake: {claudeAfter: '2.2.0'}});
  const r2 = await serieNova.host.run('claude');
  assert.equal(ptText(r2.sentence), 'Claude Code atualizado para 2.2.0.', 'série nova fica fora da faixa: não promete religar com ela');
  assert.equal(r2.relink, true, 'o tutor reconecta mesmo assim (e a coluna diz a recusa)');
});

test('run: comando que falha vira frase e saída, sem religar nada', async () => {
  const h = harness({fake: {failClaude: true}});
  const r = await h.host.run('claude');
  assert.equal(r.ok, false);
  assert.equal(ptText(r.sentence), 'Não deu para atualizar o Claude Code. Veja a saída abaixo.');
  assert.match(r.output, /update falhou/);
  assert.equal(h.seen.relink, 0);
});

test('run: terminou bem mas a versão não mudou — não se chama de sucesso', async () => {
  const h = harness({fake: {stuckVersion: true}});
  const r = await h.host.run('claude');
  assert.equal(r.ok, true);
  assert.match(ptText(r.sentence), /O comando terminou, mas o Claude Code segue na 2\.1\.296\./);
  assert.equal(h.seen.relink, 0, 'sem versão nova não há por que religar');
});

test('run: recusas — tutor respondendo, instalação sem comando, ferramenta desconhecida, modo de teste', async () => {
  const ocupado = harness({busy: true});
  await assert.rejects(() => ocupado.host.run('claude'), (error) => /Espere o tutor terminar a resposta/.test(ptText(error.message)));
  assert.deepEqual(ocupado.tools.calls(), [], 'nada rodou');

  const solto = harness({claudeLauncher: ''});
  await assert.rejects(() => solto.host.run('claude'), (error) => /sem comando para rodar: claude/.test(ptText(error.message)));
  assert.deepEqual(solto.tools.calls(), []);

  await assert.rejects(() => harness().host.run('xournal'), /ferramenta desconhecida: "xournal"; esperado claude/);
  await assert.rejects(() => harness({allowRun: false}).host.run('claude'), (error) => /desativada no modo de teste/.test(ptText(error.message)));
});

test('run: o lock compartilhado impede duas atualizações ao mesmo tempo e é solto no fim', async () => {
  const h = harness();
  const lockFile = require('../updater.cjs').lockFileOf(path.join(h.dir, 'runtime'));
  fs.writeFileSync(lockFile, JSON.stringify({at: Date.now()}));
  await assert.rejects(() => h.host.run('claude'), (error) => /já existe uma atualização em andamento/.test(ptText(error.message)));
  fs.rmSync(lockFile);
  await h.host.run('claude');
  assert.equal(fs.existsSync(lockFile), false, 'o lock não fica preso depois do comando');
});

test('run: sem o instalador no computador a frase é de falha, com o nome do que faltou', async () => {
  const h = harness();
  fs.rmSync(h.tools.claudeLauncher);
  const r = await h.host.run('claude');
  assert.equal(r.ok, false);
  assert.match(ptText(r.output), /não foi possível iniciar o comando|Não achei "claude"/);
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
