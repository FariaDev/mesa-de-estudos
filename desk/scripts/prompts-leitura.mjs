#!/usr/bin/env node
/* Gera `docs/reviews/prompts-leitura.md`: o texto final de cada prompt que a
 * Mesa manda aos motores, para o usuário ler, com o tamanho em tokens e o
 * antes e depois de cada um (#40, R1–R3).
 *
 *   node scripts/prompts-leitura.mjs                  # antes = BASELINE_REF
 *   node scripts/prompts-leitura.mjs --antes <ref>    # outro commit como antes
 *   node scripts/prompts-leitura.mjs --stdout         # imprime em vez de gravar
 *
 * Monta tudo com o mesmo código do app (`desk-prompts.cjs`, as ferramentas do
 * Claude, as extensões do Pi pelo SDK instalado), sem modelo, login nem rede,
 * e conta com a régua de `measure-prompts.mjs`. O "antes" sai do git: as
 * pastas `desk/src` e `desk/templates` do commit vão para uma pasta temporária
 * e passam pelo mesmo coletor. Nada vem do perfil do usuário (`~/.pi`): o Pi
 * roda numa pasta temporária, sem extensões nem skills dele. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {estimateTokens, claudeTools, piRequest, templateProfile} from './measure-prompts.mjs';

const desk = path.resolve(import.meta.dirname, '..');
const repoRoot = path.resolve(desk, '..');
const require = createRequire(path.join(desk, 'package.json'));

/* O `main` antes das R1–R3 (#40). */
export const BASELINE_REF = '38062bf';
export const OUTPUT = path.join(repoRoot, 'docs', 'reviews', 'prompts-leitura.md');

/**
 * @typedef {{id: string, group: string, title: string, note?: string, text: string, sent?: string}} PromptPiece
 * `text` é o que se lê; `sent`, quando difere, é o que vai ao modelo e é o que
 * se mede (o esquema vai em JSON compacto, mas se lê indentado).
 */

/**
 * Peças de texto puro: prompts de sistema dos dois motores e os templates.
 * @param {string} deskDir pasta do desk (a atual ou a extraída do git)
 * @returns {PromptPiece[]}
 * @example systemPieces(desk).map((piece) => piece.id) // ['pi-main', 'pi-side', ...]
 */
export function systemPieces(deskDir) {
  const prompts = require(path.join(deskDir, 'src', 'agents', 'desk-prompts.cjs'));
  const [tutor, learner] = templateProfile(deskDir);
  /* Idioma do tutor (#41): a frase que a base comum traz em cada opção. O
     baseline não a tem (a base antiga fixava o português). */
  const languageOptions = [['follow', 'Acompanhar minhas mensagens (padrão)'], ['pt-BR', 'Português'], ['en', 'English']];
  const languagePieces = prompts.TUTOR_LANGUAGE_LINES
    ? languageOptions.map(([value, label]) => ({id: `tutor-language-${value}`, group: 'Idioma do tutor', title: `Idioma do tutor — ${label}`, note: value === 'follow' ? 'A frase entra na base comum, igual para o Pi e o Claude, em toda sessão. Vale na próxima conexão com o tutor.' : undefined, text: prompts.TUTOR_LANGUAGE_LINES[value]}))
    : [];
  const profileNote = 'Numa matéria, o TUTOR.md e o LEARNER.md vêm logo depois (os da matéria, do vault ou estes templates); na aba Livre, nada.';
  return [
    {id: 'pi-main', group: 'Prompts de sistema', title: 'Pi — sessão principal', note: 'Anexado ao prompt do próprio Pi com `--append-system-prompt`. O TUTOR.md e o LEARNER.md chegam pelo overlay do usuário, fora deste texto. Os textos de sistema mostram o idioma do tutor no padrão (Acompanhar minhas mensagens); as outras duas opções trocam só a frase de idioma, mostrada abaixo.', text: prompts.piPrompt({materialTools: true})},
    {id: 'pi-side', group: 'Prompts de sistema', title: 'Pi — chat lateral', note: 'Mesmo mecanismo; o chat lateral não tem as ferramentas de PDF e de quadro.', text: prompts.piPrompt()},
    {id: 'claude-main', group: 'Prompts de sistema', title: 'Claude — sessão principal (matéria e aba Livre)', note: `Substitui o prompt do Claude Code. ${profileNote} Uma sessão Pi aberta no Claude leva ainda a transcrição importada, no fim.`, text: prompts.claudePrompt({tools: true})},
    {id: 'claude-side', group: 'Prompts de sistema', title: 'Claude — chat lateral', note: profileNote, text: prompts.claudePrompt()},
    ...languagePieces,
    {id: 'tutor', group: 'Perfil de estudo (templates)', title: 'templates/TUTOR.md', note: 'O que uma matéria sem TUTOR.md próprio recebe. Quem já copiou o seu não é afetado.', text: tutor.text},
    {id: 'learner', group: 'Perfil de estudo (templates)', title: 'templates/LEARNER.md', note: 'Não mudou nesta rodada.', text: learner.text},
  ];
}

/* Uma ferramenta como o motor a anuncia: lê-se a descrição e o esquema
   indentado; mede-se o objeto inteiro em JSON compacto. */
function toolPiece(engine, tool) {
  const schema = JSON.stringify(tool.input_schema, null, 2);
  return {
    id: `${engine.toLowerCase()}-tool-${tool.name}`, group: `Ferramentas — ${engine}`, title: tool.name,
    text: `${tool.description}\n\nEsquema:\n${schema}`, sent: JSON.stringify(tool),
  };
}

/**
 * Ferramentas da Mesa nos dois motores. Sem o Pi instalado, só as do Claude.
 * @param {string} deskDir
 * @param {{piRequest?: typeof piRequest, claudeTools?: typeof claudeTools}} [deps]
 * @returns {Promise<{pieces: PromptPiece[], piSections: Record<string, string>|null, piVersion: string|null}>}
 */
export async function toolPieces(deskDir, deps = {}) {
  const loadClaude = deps.claudeTools || claudeTools;
  const loadPi = deps.piRequest || piRequest;
  const pieces = (await loadClaude(deskDir)).map((tool) => toolPiece('Claude', tool));
  const pi = await loadPi({materialTools: true, deskDir});
  if (!pi) return {pieces, piSections: null, piVersion: null};
  for (const tool of pi.tools.filter((item) => item.name.startsWith('mesa_'))) pieces.push(toolPiece('Pi', tool));
  /* As seções do próprio Pi entram só como número: o texto delas traz a pasta
     de instalação do Pi e a pasta temporária. */
  const {cwd, addendum, ...own} = pi.sections;
  return {pieces, piSections: own, piVersion: pi.version};
}

/**
 * Copia `desk/src` e `desk/templates` de um commit para uma pasta temporária,
 * com as dependências do desk atual.
 * @param {string} ref commit, branch ou tag
 * @param {{root?: string, git?: (args: string[]) => Buffer}} [options]
 * @returns {{deskDir: string, cleanup: () => void}}
 */
export function extractBaseline(ref, {root = repoRoot, git = (args) => execFileSync('git', args, {cwd: root, maxBuffer: 1 << 28})} = {}) {
  if (!/^[\w./-]+$/.test(ref)) throw Error(`ref do git inválida: ${JSON.stringify(ref)} (esperado um commit, branch ou tag)`);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-prompts-antes-'));
  const archive = path.join(dir, 'antes.tar');
  fs.writeFileSync(archive, git(['archive', '--format=tar', ref, 'desk/src', 'desk/templates']));
  execFileSync('tar', ['-xf', archive, '-C', dir]);
  const deskDir = path.join(dir, 'desk');
  fs.symlinkSync(path.join(desk, 'node_modules'), path.join(deskDir, 'node_modules'), 'dir');
  return {deskDir, cleanup: () => fs.rmSync(dir, {recursive: true, force: true})};
}

const tokensOf = (piece) => (piece ? estimateTokens(piece.sent ?? piece.text) : null);
const fence = (text) => {
  const ticks = '`'.repeat(Math.max(3, ...[...text.matchAll(/`+/g)].map((match) => match[0].length + 1)));
  return `${ticks}text\n${text}\n${ticks}`;
};
const number = (value) => (value === null ? '—' : value.toLocaleString('pt-BR'));

function delta(before, after) {
  if (before === null) return 'novo';
  if (after === null) return 'removido';
  if (before === after) return '0';
  const change = ((after - before) / before) * 100;
  return `${after - before > 0 ? '+' : ''}${after - before} (${change > 0 ? '+' : ''}${change.toFixed(1).replace('.', ',')}%)`;
}

function summaryTable(after, before) {
  const lines = ['| Peça | Antes (tokens) | Depois (tokens) | Diferença |', '|---|---:|---:|---|'];
  for (const piece of after) {
    const old = before.find((item) => item.id === piece.id);
    lines.push(`| ${piece.title} | ${number(tokensOf(old))} | ${number(tokensOf(piece))} | ${delta(tokensOf(old), tokensOf(piece))} |`);
  }
  return lines.join('\n');
}

function pieceSection(piece, old) {
  const lines = [`### ${piece.title}`, ''];
  if (piece.note) lines.push(piece.note, '');
  lines.push(`Tokens: antes ${number(tokensOf(old))} · depois ${number(tokensOf(piece))}.`, '');
  const same = old && old.text === piece.text;
  lines.push(same ? '**Igual ao antes.**' : '**Depois:**', '', fence(piece.text), '');
  if (!same) lines.push('**Antes:**', '', old ? fence(old.text) : '(não existia)', '');
  return lines.join('\n');
}

const SKILLS = [
  '## Skills',
  '',
  'A Mesa não carrega skill própria em nenhum motor.',
  '',
  '- **Claude:** `settingSources: []` e `strictMcpConfig: true` (`src/agents/claude-adapter.cjs`): nenhuma skill, nenhum `CLAUDE.md` nem MCP herdado. As ferramentas são `Read`, `Glob`, `Grep`, `AskUserQuestion` e as quatro da Mesa acima (PDF, mostrar, prévia do quadro e GeoGebra).',
  '- **Pi:** o perfil fixado (`profiles.cjs`) liga as extensões da Mesa e as do perfil do usuário. Skills, as extensões do overlay (`quiz`…) e o TUTOR.md lido pelo `learning-session` vêm de `~/.pi` e do vault, que são pessoais e ficam fora deste arquivo.',
].join('\n');

/**
 * Monta o Markdown de leitura.
 * @param {{after: PromptPiece[], before: PromptPiece[], ref: string, piSections: Record<string, string>|null, piVersion: string|null}} input
 * @returns {string}
 */
export function renderReading({after, before, ref, piSections, piVersion}) {
  const out = [
    '# Prompts da Mesa — texto para leitura',
    '',
    `Gerado por \`desk/scripts/prompts-leitura.mjs\` a partir do código; não edite à mão. "Antes" é o commit \`${ref}\`. Tokens pela régua de \`scripts/measure-prompts.mjs\` (estimador local: erra ~15% no valor absoluto, mas a comparação usa a mesma régua).`,
    '',
    '## Resumo',
    '',
    summaryTable(after, before),
    '',
  ];
  if (piSections) {
    out.push(`O Pi ${piVersion} soma o prompt dele antes do adendo da Mesa (preâmbulo, lista de ferramentas, regras e docs: ${number(Object.values(piSections).reduce((sum, text) => sum + estimateTokens(text), 0))} tokens) e as ferramentas \`read\`, \`bash\`, \`edit\` e \`write\`. Esse texto é do Pi, não muda com a Mesa e traz caminhos da instalação, por isso não está aqui.`, '');
  } else out.push('O Pi não está instalado nesta máquina: as ferramentas dele ficaram de fora.', '');
  let group = '';
  for (const piece of after) {
    if (piece.group !== group) out.push(`## ${(group = piece.group)}`, '');
    out.push(pieceSection(piece, before.find((item) => item.id === piece.id)));
  }
  out.push(SKILLS, '');
  return out.join('\n');
}

async function collect(deskDir, deps) {
  const tools = await toolPieces(deskDir, deps);
  return {pieces: [...systemPieces(deskDir), ...tools.pieces], piSections: tools.piSections, piVersion: tools.piVersion};
}

/**
 * Coleta o antes e o depois e devolve o Markdown.
 * @param {{ref?: string}} [options]
 * @returns {Promise<string>}
 */
export async function buildReading({ref = BASELINE_REF} = {}) {
  const now = await collect(desk);
  const baseline = extractBaseline(ref);
  try {
    const old = await collect(baseline.deskDir);
    return renderReading({after: now.pieces, before: old.pieces, ref, piSections: now.piSections, piVersion: now.piVersion});
  } finally {
    baseline.cleanup();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const at = process.argv.indexOf('--antes');
  const text = await buildReading({ref: at > 0 ? process.argv[at + 1] : BASELINE_REF});
  if (process.argv.includes('--stdout')) process.stdout.write(text);
  else {
    fs.writeFileSync(OUTPUT, text);
    process.stdout.write(`gravado: ${path.relative(repoRoot, OUTPUT)}\n`);
  }
}
