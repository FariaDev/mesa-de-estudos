import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {estimateTokens} from '../scripts/measure-prompts.mjs';

/* Trava o tamanho do AGENTS.md (#43): ele é lido em toda sessão, então o
   detalhe mora em docs/agents/ e aqui fica só o que todo agente precisa.
   Régua de tokens: a mesma do `scripts/measure-prompts.mjs` (aprox., ~15%). */
const ROOT = path.resolve(import.meta.dirname, '..', '..');
const AGENTS = path.join(ROOT, 'AGENTS.md');
const MAX_LINES = 150;
const MAX_TOKENS = 2000;
const MOVE_HINT = 'Mova o detalhe para docs/agents/ (mapa de features e bilhete em mapa.md, '
  + 'release/updater em release.md, schema e exemplos em customizar.md, portões em portoes.md) '
  + 'e deixe no AGENTS.md só uma linha com o ponteiro.';

const text = fs.readFileSync(AGENTS, 'utf8');

test('AGENTS.md cabe em 150 linhas', () => {
  const lines = text.replace(/\n$/, '').split('\n').length;
  assert.ok(lines <= MAX_LINES, `AGENTS.md tem ${lines} linhas; o teto é ${MAX_LINES}. ${MOVE_HINT}`);
});

test('AGENTS.md cabe em 2 mil tokens', () => {
  const tokens = estimateTokens(text);
  assert.ok(tokens <= MAX_TOKENS, `AGENTS.md tem ~${tokens} tokens; o teto é ${MAX_TOKENS}. ${MOVE_HINT}`);
});

test('as regras invioláveis seguem no AGENTS.md', () => {
  const required = [
    ['defaults de `desk/config.cjs`', 'não alterar os defaults da mesa do autor'],
    ['PDFs nem materiais de curso', 'não alterar PDFs nem materiais'],
    ['sessões JSONL', 'não publicar sessões JSONL'],
    ['credenciais do Pi', 'não publicar credenciais'],
    ['Mesa de Estudos.app', 'não publicar o bundle'],
    ['Dois apps', 'dois apps separados'],
    ['canvas de tinta', 'sem canvas de tinta'],
    ['núcleo Bend', 'lógica que não quebra mora no núcleo'],
    ['`core/laws/`', 'leis'],
    ['`core/proofs/`', 'provas'],
    ['`desk/src/generated/*`', 'artefatos gerados commitados'],
    ['npm run verify:bend', 'portão do núcleo'],
    ['MESA_GATE_CACHE=0 npm test', 'portão de testes'],
  ];
  for (const [needle, rule] of required) {
    assert.ok(text.includes(needle), `AGENTS.md perdeu a regra "${rule}" (esperava o trecho ${needle}).`);
  }
});

test('os ponteiros de docs/agents/ do AGENTS.md existem', (t) => {
  // Instalação por zip não carrega docs/: só confere num clone.
  if (!fs.existsSync(path.join(ROOT, 'docs'))) return t.skip('sem docs/ nesta instalação');
  const refs = [...text.matchAll(/docs\/agents\/[\w.-]+\.md/g)].map((m) => m[0]);
  assert.ok(refs.length >= 4, `AGENTS.md aponta ${refs.length} arquivos de docs/agents/; esperava ao menos mapa, release, customizar e portoes.`);
  for (const ref of new Set(refs)) {
    assert.ok(fs.existsSync(path.join(ROOT, ref)), `AGENTS.md aponta ${ref}, que não existe.`);
  }
});
