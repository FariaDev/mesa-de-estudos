/* Arquivo de leitura dos prompts (#40, R1–R3): `scripts/prompts-leitura.mjs`
   monta, a partir do código, o texto final de cada prompt com tokens e o antes
   e depois. Os fakes com nome substituem as ferramentas do Claude. */
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

/* Fake do que o SDK anuncia: uma ferramenta da Mesa. */
async function fakeClaudeTools() {
  return [{name: 'mcp__mesa__criar_pdf', description: 'Prepare o PDF.', input_schema: {type: 'object'}}];
}

test('as peças de sistema são o texto que a Mesa manda, por motor e sessão', () => {
  const pieces = Object.fromEntries(systemPieces(desk).map((piece) => [piece.id, piece.text]));
  assert.equal(pieces['claude-main'], prompts.claudePrompt({tools: true}));
  assert.equal(pieces['claude-side'], prompts.claudePrompt());
  assert.equal(pieces.tutor, fs.readFileSync(path.join(desk, 'templates', 'TUTOR.md'), 'utf8'));
});

test('ferramentas: só as da Mesa, com o esquema do SDK', async () => {
  const tools = await toolPieces(desk, {claudeTools: fakeClaudeTools});
  assert.deepEqual(tools.pieces.map((piece) => piece.title), ['mcp__mesa__criar_pdf']);
  assert.match(tools.pieces[0].text, /Prepare o PDF\.\n\nEsquema:\n\{/);
  assert.equal(tools.pieces[0].sent, JSON.stringify((await fakeClaudeTools())[0]));
});

test('render: antes e depois, igual, novo e cerca que aguenta crase no texto', () => {
  const after = [
    {id: 'a', group: 'G', title: 'Mudou', text: 'novo texto com ```bloco```'},
    {id: 'b', group: 'G', title: 'Igual', text: 'mesmo'},
    {id: 'c', group: 'H', title: 'Nova', text: 'só agora'},
  ];
  const before = [{id: 'a', group: 'G', title: 'Mudou', text: 'velho'}, {id: 'b', group: 'G', title: 'Igual', text: 'mesmo'}];
  const text = renderReading({after, before, ref: 'abc123'});
  assert.match(text, /"Antes" é o commit `abc123`/);
  assert.match(text, /\| Nova \| — \| \d+ \| novo \|/);
  assert.match(text, /\| Igual \| (\d+) \| \1 \| 0 \|/);
  assert.match(text, /### Igual[\s\S]*\*\*Igual ao antes\.\*\*/);
  assert.match(text, /### Mudou[\s\S]*\*\*Depois:\*\*[\s\S]*\*\*Antes:\*\*[\s\S]*velho/);
  assert.match(text, /````text\nnovo texto com ```bloco```\n````/);
  assert.match(text, /### Nova[\s\S]*\(não existia\)/);
  assert.doesNotMatch(text, /\bPi\b/);
  assert.match(text, /## Skills/);
});

test('o arquivo de leitura não leva caminho pessoal', async () => {
  const tools = await toolPieces(desk, {claudeTools: fakeClaudeTools});
  const text = renderReading({after: [...systemPieces(desk), ...tools.pieces], before: [], ref: 'HEAD'});
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
