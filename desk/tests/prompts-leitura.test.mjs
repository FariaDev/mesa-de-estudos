/* Arquivo de leitura dos prompts (#40, R1–R3): `scripts/prompts-leitura.mjs`
   monta, a partir do código, o texto final de cada prompt com tokens e o antes
   e depois. Os fakes com nome substituem o SDK do Pi e o do Claude. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {systemPieces, toolPieces, renderReading, extractBaseline, OUTPUT} from '../scripts/prompts-leitura.mjs';

const require = createRequire(import.meta.url);
const prompts = require('../src/agents/desk-prompts.cjs');
const desk = path.resolve(import.meta.dirname, '..');

/* Fakes do que os SDKs anunciam: uma ferramenta da Mesa por motor e uma do
   próprio Pi, que não pode entrar no arquivo. */
async function fakeClaudeTools() {
  return [{name: 'mcp__mesa__criar_pdf', description: 'Prepare o PDF.', input_schema: {type: 'object'}}];
}
async function fakePiRequest() {
  return {
    version: '9.9.9',
    sections: {preamble: 'coding assistant', rules: 'regras', cwd: 'Current working directory: /tmp/x', addendum: 'adendo'},
    tools: [{name: 'read', description: 'Lê', input_schema: {}}, {name: 'mesa_criar_pdf', description: 'Prepare o PDF.', input_schema: {type: 'object'}}],
  };
}
async function fakeNoPi() {
  return null;
}

test('as peças de sistema são o texto que a Mesa manda, por motor e sessão', () => {
  const pieces = Object.fromEntries(systemPieces(desk).map((piece) => [piece.id, piece.text]));
  assert.equal(pieces['pi-main'], prompts.piPrompt({materialTools: true}));
  assert.equal(pieces['pi-side'], prompts.piPrompt());
  assert.equal(pieces['claude-main'], prompts.claudePrompt({tools: true}));
  assert.equal(pieces['claude-side'], prompts.claudePrompt());
  assert.equal(pieces.tutor, fs.readFileSync(path.join(desk, 'templates', 'TUTOR.md'), 'utf8'));
});

test('ferramentas: só as da Mesa; o prompt do próprio Pi entra só como número', async () => {
  const withPi = await toolPieces(desk, {claudeTools: fakeClaudeTools, piRequest: fakePiRequest});
  assert.deepEqual(withPi.pieces.map((piece) => piece.title), ['mcp__mesa__criar_pdf', 'mesa_criar_pdf']);
  assert.deepEqual(Object.keys(withPi.piSections), ['preamble', 'rules']);
  assert.match(withPi.pieces[0].text, /Prepare o PDF\.\n\nEsquema:\n\{/);
  assert.equal(withPi.pieces[0].sent, JSON.stringify((await fakeClaudeTools())[0]));
  const noPi = await toolPieces(desk, {claudeTools: fakeClaudeTools, piRequest: fakeNoPi});
  assert.equal(noPi.pieces.length, 1);
  assert.equal(noPi.piSections, null);
});

test('render: antes e depois, igual, novo e cerca que aguenta crase no texto', () => {
  const after = [
    {id: 'a', group: 'G', title: 'Mudou', text: 'novo texto com ```bloco```'},
    {id: 'b', group: 'G', title: 'Igual', text: 'mesmo'},
    {id: 'c', group: 'H', title: 'Nova', text: 'só agora'},
  ];
  const before = [{id: 'a', group: 'G', title: 'Mudou', text: 'velho'}, {id: 'b', group: 'G', title: 'Igual', text: 'mesmo'}];
  const text = renderReading({after, before, ref: 'abc123', piSections: null, piVersion: null});
  assert.match(text, /"Antes" é o commit `abc123`/);
  assert.match(text, /\| Nova \| — \| \d+ \| novo \|/);
  assert.match(text, /\| Igual \| (\d+) \| \1 \| 0 \|/);
  assert.match(text, /### Igual[\s\S]*\*\*Igual ao antes\.\*\*/);
  assert.match(text, /### Mudou[\s\S]*\*\*Depois:\*\*[\s\S]*\*\*Antes:\*\*[\s\S]*velho/);
  assert.match(text, /````text\nnovo texto com ```bloco```\n````/);
  assert.match(text, /### Nova[\s\S]*\(não existia\)/);
  assert.match(text, /O Pi não está instalado/);
  assert.match(text, /## Skills/);
});

test('o arquivo de leitura não leva caminho pessoal', async () => {
  const tools = await toolPieces(desk, {claudeTools: fakeClaudeTools, piRequest: fakePiRequest});
  const text = renderReading({after: [...systemPieces(desk), ...tools.pieces], before: [], ref: 'HEAD', piSections: tools.piSections, piVersion: '9.9.9'});
  assert.equal(text.includes(os.homedir()), false);
  assert.doesNotMatch(text, /\/tmp\/x|coding assistant/);
});

test('o antes sai do git numa pasta temporária, com as dependências do desk', () => {
  const baseline = extractBaseline('HEAD');
  try {
    assert.ok(fs.existsSync(path.join(baseline.deskDir, 'templates', 'TUTOR.md')));
    assert.ok(fs.existsSync(path.join(baseline.deskDir, 'src', 'agents', 'desk-prompts.cjs')));
    assert.ok(fs.lstatSync(path.join(baseline.deskDir, 'node_modules')).isSymbolicLink());
  } finally {
    baseline.cleanup();
  }
  assert.equal(fs.existsSync(baseline.deskDir), false);
  assert.throws(() => extractBaseline('x; rm -rf /'), /ref do git inválida: "x; rm -rf \/" \(esperado um commit, branch ou tag\)/);
});

test('o arquivo commitado está em dia com os prompts (rode o script ao mudá-los)', () => {
  const committed = fs.readFileSync(OUTPUT, 'utf8');
  for (const piece of systemPieces(desk)) {
    assert.ok(committed.includes('\n' + piece.text + '\n'), `${piece.title} desatualizado: node scripts/prompts-leitura.mjs`);
  }
});
