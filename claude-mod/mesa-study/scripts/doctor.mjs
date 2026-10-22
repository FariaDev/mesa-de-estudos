#!/usr/bin/env node
/* Doctor local do plugin `mesa-study`.
   - import-safe/testável: `collectDoctorReport`/`runDoctor` são exportados e
     só executam quando argv[1] é este arquivo;
   - `--target desktop` (padrão) cobre os pré-requisitos locais do Claude
     Desktop Code; `--target cli` exige Claude Code CLI >=2.1.287;
   - Poppler vem do MESMO resolvedor fixo do host (host/tools.mjs): só
     diretórios conhecidos, primeiro candidato executável (X_OK), nunca PATH
     e nunca caminho do pedido; ausência do arquivo (NOT_FOUND) é diferente
     de arquivo presente sem execução (NOT_EXECUTABLE);
   - `ran` de cada check diz se a sonda chegou a executar (ENOENT/queda do
     runner = não executou), independente de a versão ter sido lida;
   - sonda com timeout/ausência nunca vira "disponível" por texto de versão;
   - o helper nativo NUNCA é executado aqui (só lstat/executabilidade); a
     ausência dele é aviso, não bloqueio — PDFs não dependem do helper;
   - nada de conta, ajustes globais, login, carregamento do plugin, permissão
     de captura ou chamada de modelo: apenas diagnóstico local. "ok" NÃO
     significa pronto para uso. */

import path from 'node:path';
import fs from 'node:fs/promises';
import {runProcess} from '../host/proc.mjs';
import {resolvePopplerTools, isExecutableFile} from '../host/tools.mjs';
import {POPPLER_DIRS} from '../host/config.mjs';
import {
  ScriptError,
  atLeastVersion,
  isMainEntry,
  parseSemverTuple,
  pluginRootFrom,
  scriptErrorMessage,
  tailText,
} from './shared.mjs';

export const TARGETS = Object.freeze(['desktop', 'cli']);

/* Mínimos oficiais atuais (docs de plugins/mods): Claude Desktop Code
   (Mods) >=2.1.286, Claude Code CLI >=2.1.287; Node pelo engines do package. */
export const MINIMUMS = Object.freeze({
  node: '22.19.0',
  claudeDesktop: '2.1.286',
  claudeCli: '2.1.287',
});

const PROBE_TIMEOUT_MS = 5000;
const PROBE_MAX_BUFFER = 16384;
const HELPER_BUILD_HINT = 'node scripts/build-helper.mjs';

const PROBE_FAILURE_TEXT = Object.freeze({
  NOT_FOUND: 'não encontrado',
  NOT_EXECUTABLE: 'não é executável',
  UNRESOLVED: 'não foi resolvido',
  TIMEOUT: `não respondeu em ${PROBE_TIMEOUT_MS} ms (timeout)`,
  FAILED: 'falhou ao responder',
  RUN_THREW: 'não pôde ser executado',
  VERSION_UNPARSED: 'respondeu sem versão reconhecível',
});

function probeFailureText(reason) {
  return PROBE_FAILURE_TEXT[reason] || 'indisponível';
}

export function doctorUsage() {
  return [
    'Uso: node scripts/doctor.mjs [--target desktop|cli]',
    '',
    '  desktop (padrão)  Pré-requisitos locais do Claude Desktop Code (Mods >=2.1.286).',
    '  cli               Exige Claude Code CLI >=2.1.287; CLI antigo/ausente não bloqueia o Desktop.',
    '',
    'Só requisitos locais: Node, Poppler (pdfinfo/pdftocairo) e helper nativo presente.',
    'O doctor NÃO executa o helper, NÃO compila nada, NÃO abre sessão, NÃO lê conta/ajustes',
    'globais e NÃO chama modelo. Versão interna do Desktop, login, carregamento do plugin e',
    'permissão de captura só se confirmam numa sessão real. Saída 2 = pré-requisito local pendente.',
  ].join('\n');
}

export function parseDoctorArgs(argv) {
  const args = Array.isArray(argv) ? argv : [];
  if (args.includes('--help') || args.includes('-h')) {
    if (args.length !== 1) throw new ScriptError('USAGE', 'Use --help sozinho.');
    return {help: true, target: 'desktop'};
  }
  let target = 'desktop';
  let seenTarget = false;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--target') {
      if (seenTarget) throw new ScriptError('USAGE', '--target repetido.');
      const value = args[index + 1];
      if (value === undefined) throw new ScriptError('USAGE', '--target exige desktop ou cli.');
      target = value;
      seenTarget = true;
      index += 1;
      continue;
    }
    if (typeof arg === 'string' && arg.startsWith('--target=')) {
      if (seenTarget) throw new ScriptError('USAGE', '--target repetido.');
      target = arg.slice('--target='.length);
      seenTarget = true;
      continue;
    }
    throw new ScriptError('USAGE', `Argumento desconhecido: ${String(arg)}.`);
  }
  if (!TARGETS.includes(target)) {
    throw new ScriptError('USAGE', `Alvo inválido: ${target}. Use desktop ou cli.`);
  }
  return {help: false, target};
}

/* Executa a sonda e tenta extrair a versão. Não lança: devolve resultado
   estável. `ran` diz se o processo chegou a executar (queda do runner ou
   ENOENT = não executou). Ferramentas que imprimem a versão e saem com
   código != 0 (ex.: Poppler -v em algumas versões) continuam disponíveis,
   mas timeout e ausência NUNCA viram versão válida por causa do texto. */
async function probeVersion(run, binary, args) {
  let result;
  try {
    result = await run([binary, ...args], {timeoutMs: PROBE_TIMEOUT_MS, maxBuffer: PROBE_MAX_BUFFER});
  } catch (error) {
    return {available: false, ran: false, tuple: null, version: null, reason: 'RUN_THREW', detail: tailText(error && error.message)};
  }
  const ran = Boolean(result) && result.missing !== true;
  const text = `${result && result.stdout ? result.stdout : ''}\n${result && result.stderr ? result.stderr : ''}`.trim();
  const tuple = parseSemverTuple(text);
  if (result && result.ok) {
    if (tuple) return {available: true, ran, tuple, version: tuple.join('.'), reason: null};
    return {available: false, ran, tuple: null, version: null, reason: 'VERSION_UNPARSED'};
  }
  if (result && result.missing) {
    return {available: false, ran: false, tuple: null, version: null, reason: 'NOT_FOUND'};
  }
  if (result && result.timedOut) {
    return {available: false, ran, tuple: null, version: null, reason: 'TIMEOUT', detail: {timeoutMs: PROBE_TIMEOUT_MS}};
  }
  if (tuple) return {available: true, ran, tuple, version: tuple.join('.'), reason: null};
  return {available: false, ran, tuple: null, version: null, reason: 'FAILED', detail: tailText(result && result.stderr)};
}

/* Poppler: resolvedor fixo do host + presença (stat) e execução (X_OK)
   antes de rodar. Nunca procura no PATH e nunca aceita caminho de fora. */
async function popplerCheck(name, {tools, isExecutable, stat, run}) {
  const searchedDirs = [...POPPLER_DIRS];
  const toolPath = tools && typeof tools[name] === 'string' ? tools[name] : null;
  if (!toolPath) return {available: false, path: null, ran: false, reason: 'UNRESOLVED', searchedDirs};
  const exists = await stat(toolPath).then(() => true, () => false);
  if (!exists) {
    return {
      available: false,
      path: toolPath,
      ran: false,
      reason: 'NOT_FOUND',
      searchedDirs,
      hint: `Poppler ausente nos diretórios conhecidos (${searchedDirs.join(', ')}); instale o pacote completo (ex.: brew install poppler) e rode de novo.`,
    };
  }
  if (!isExecutable(toolPath)) {
    return {
      available: false,
      path: toolPath,
      ran: false,
      reason: 'NOT_EXECUTABLE',
      searchedDirs,
      hint: `${toolPath} existe mas não pode ser executado; reinstale o Poppler ou corrija a permissão de execução do arquivo.`,
    };
  }
  const probe = await probeVersion(run, toolPath, ['-v']);
  if (!probe.available) {
    return {available: false, path: toolPath, ran: probe.ran, reason: probe.reason, searchedDirs, detail: probe.detail};
  }
  if (!probe.tuple) return {available: false, path: toolPath, ran: probe.ran, reason: 'VERSION_UNPARSED', searchedDirs};
  return {available: true, path: toolPath, ran: probe.ran, version: probe.version, searchedDirs};
}

/* Helper nativo: só presença/executabilidade. `ran:false` é explícito — o
   doctor não executa o helper em nenhuma hipótese. */
async function helperCheck(helperPath, {lstat, isExecutable}) {
  const base = {path: helperPath, ran: false, buildHint: HELPER_BUILD_HINT};
  const stat = await lstat(helperPath).then((value) => value, () => null);
  if (!stat) return {...base, present: false, executable: false, reason: 'MISSING'};
  if (stat.isSymbolicLink()) return {...base, present: true, symlink: true, executable: false, reason: 'SYMLINK'};
  if (!stat.isFile()) {
    return {...base, present: true, symlink: false, executable: false, kind: stat.isDirectory() ? 'directory' : 'other', reason: 'NOT_A_FILE'};
  }
  const executable = isExecutable(helperPath);
  return {...base, present: true, symlink: false, executable, reason: executable ? null : 'NOT_EXECUTABLE'};
}

async function claudeCliCheck(run, target) {
  const probe = await probeVersion(run, 'claude', ['--version']);
  const supported = probe.available && !!probe.tuple && atLeastVersion(probe.tuple, parseSemverTuple(MINIMUMS.claudeCli));
  return {
    available: probe.available,
    ran: probe.ran,
    version: probe.version,
    minimum: MINIMUMS.claudeCli,
    supported,
    role: target === 'cli' ? 'required' : 'informational',
    reason: probe.available ? (probe.tuple ? null : 'VERSION_UNPARSED') : probe.reason,
  };
}

/* Bloqueio do CLI com a causa real: timeout/falha não podem ser relatados como
   "não encontrado". */
function claudeCliBlocker(check) {
  if (check.available) return `Claude Code CLI ${check.version} < ${MINIMUMS.claudeCli}.`;
  switch (check.reason) {
    case 'NOT_FOUND':
      return 'Claude Code CLI não encontrado.';
    case 'TIMEOUT':
      return `Claude Code CLI ${probeFailureText('TIMEOUT')}; confirme a instalação (>= ${MINIMUMS.claudeCli}) e rode de novo.`;
    case 'FAILED':
      return `Claude Code CLI ${probeFailureText('FAILED')}; confirme a instalação e rode de novo.`;
    case 'VERSION_UNPARSED':
      return `Claude Code CLI respondeu sem versão reconhecível (esperado >= ${MINIMUMS.claudeCli}); confirme a instalação.`;
    case 'RUN_THREW':
      return `Claude Code CLI ${probeFailureText('RUN_THREW')}; confirme a instalação.`;
    default:
      return 'Claude Code CLI indisponível para o diagnóstico.';
  }
}

/* Bloqueio do Poppler com causa específica (ausência ≠ sem execução). */
function popplerBlocker(name, check) {
  switch (check.reason) {
    case 'NOT_FOUND':
      return `${name}: não encontrado nos diretórios conhecidos (${check.searchedDirs.join(', ')}); páginas PDF exigem o Poppler completo.`;
    case 'NOT_EXECUTABLE':
      return `${name}: existe em ${check.path} mas não é executável; páginas PDF exigem o Poppler completo.`;
    case 'TIMEOUT':
      return `${name}: não respondeu em tempo (timeout); páginas PDF exigem o Poppler completo.`;
    case 'VERSION_UNPARSED':
      return `${name}: respondeu sem versão reconhecível; páginas PDF exigem o Poppler completo.`;
    case 'FAILED':
      return `${name}: falhou ao responder; páginas PDF exigem o Poppler completo.`;
    case 'RUN_THREW':
      return `${name}: não pôde ser executado; páginas PDF exigem o Poppler completo.`;
    default:
      return `${name}: indisponível (${check.reason}); páginas PDF exigem o Poppler completo.`;
  }
}

export async function collectDoctorReport({
  target = 'desktop',
  root = pluginRootFrom(import.meta.url),
  deps = {},
} = {}) {
  if (!TARGETS.includes(target)) throw new ScriptError('USAGE', `Alvo inválido: ${target}. Use desktop ou cli.`);

  const run = deps.run || runProcess;
  const tools = deps.tools || resolvePopplerTools();
  const isExecutable = deps.isExecutable || isExecutableFile;
  const stat = deps.stat || ((file) => fs.stat(file));
  const platform = deps.platform ?? process.platform;
  const nodeVersion = deps.nodeVersion ?? process.versions.node;
  const now = typeof deps.now === 'function' ? deps.now : () => new Date();
  const helperPath = deps.helperPath || path.join(path.resolve(root), 'native', 'windows');
  const lstat = deps.lstat || ((file) => fs.lstat(file));

  const nodeTuple = parseSemverTuple(nodeVersion) || String(nodeVersion).split('.').map(Number);
  const nodeSupported = atLeastVersion(nodeTuple, parseSemverTuple(MINIMUMS.node));

  const pdfinfo = await popplerCheck('pdfinfo', {tools, isExecutable, stat, run});
  const pdftocairo = await popplerCheck('pdftocairo', {tools, isExecutable, stat, run});
  const claudeCli = await claudeCliCheck(run, target);
  const helper = await helperCheck(helperPath, {lstat, isExecutable});

  const blockers = [];
  const warnings = [];

  if (!nodeSupported) blockers.push(`Node ${nodeVersion} < ${MINIMUMS.node}; atualize o Node do sistema.`);
  for (const [name, check] of [['pdfinfo', pdfinfo], ['pdftocairo', pdftocairo]]) {
    if (check.available) continue;
    blockers.push(popplerBlocker(name, check));
  }
  if (target === 'cli' && !claudeCli.supported) {
    blockers.push(claudeCliBlocker(claudeCli));
  }

  if (target === 'desktop') {
    if (!claudeCli.available) {
      if (claudeCli.reason === 'NOT_FOUND') {
        warnings.push({code: 'CLI_MISSING', message: `Claude Code CLI não encontrado (informativo; não bloqueia o Desktop, que precisa de Mods >=${MINIMUMS.claudeDesktop}).`});
      } else {
        warnings.push({code: 'CLI_UNUSABLE', message: `Claude Code CLI não pôde ser confirmado: ${probeFailureText(claudeCli.reason)} (informativo; não bloqueia o Desktop, que precisa de Mods >=${MINIMUMS.claudeDesktop}).`});
      }
    } else if (!claudeCli.supported) {
      warnings.push({code: 'CLI_OLD', message: `Claude Code CLI ${claudeCli.version} < ${MINIMUMS.claudeCli} (informativo; não bloqueia o Desktop).`});
    }
  }
  if (!helper.present) {
    warnings.push({code: 'HELPER_MISSING', message: `Helper nativo ausente em ${helper.path}; capture/Conferir Xournal++ exige "${HELPER_BUILD_HINT}" uma vez. PDFs não dependem disso.`});
  } else if (helper.symlink) {
    warnings.push({code: 'HELPER_SYMLINK', message: `Helper nativo é um link simbólico (${helper.path}); compile o arquivo real com "${HELPER_BUILD_HINT}".`});
  } else if (!helper.executable) {
    warnings.push({code: 'HELPER_NOT_EXECUTABLE', message: `Helper nativo não é executável em ${helper.path}; recompile com "${HELPER_BUILD_HINT}".`});
  }
  if (platform !== 'darwin') {
    warnings.push({code: 'HELPER_PLATFORM', message: `Plataforma ${platform}: o helper de captura é macOS; capture/Conferir Xournal++ não está disponível.`});
  }

  return {
    ok: blockers.length === 0,
    target,
    platform,
    generatedAt: now().toISOString(),
    checks: {
      node: {available: true, version: nodeVersion, minimum: MINIMUMS.node, supported: nodeSupported},
      pdfinfo: {...pdfinfo},
      pdftocairo: {...pdftocairo},
      claudeCli,
      helper,
      desktopCode: {
        minimumMods: MINIMUMS.claudeDesktop,
        versionKnown: false,
        reason: 'NOT_VERIFIABLE_LOCALLY',
        note: 'A versão interna do Claude Desktop Code só se lê numa sessão real do Desktop.',
      },
    },
    blockers,
    warnings,
    unknowns: {
      desktopCodeVersion: `Mods >=${MINIMUMS.claudeDesktop}: não verificável fora do Desktop.`,
      login: 'Login/conta não são inspecionados por este script.',
      pluginLoaded: 'O carregamento do plugin no Desktop não é testado aqui.',
      capturePermission: 'A permissão de Gravação de Tela só se confirma numa captura real.',
      inference: 'Nenhuma chamada de modelo é feita aqui.',
    },
    note: 'Diagnóstico local apenas: "ok" não significa pronto para uso. Confirme versão do Desktop, login, plugin carregado e permissão de captura numa sessão real.',
  };
}

export async function runDoctor(argv, {
  stdout = (text) => process.stdout.write(text),
  stderr = (text) => process.stderr.write(text),
  deps = {},
  root,
} = {}) {
  let parsed;
  try {
    parsed = parseDoctorArgs(argv);
  } catch (error) {
    stderr(`${scriptErrorMessage(error)}\n`);
    return 2;
  }
  if (parsed.help) {
    stdout(`${doctorUsage()}\n`);
    return 0;
  }
  const report = await collectDoctorReport({target: parsed.target, root, deps});
  stdout(`${JSON.stringify(report, null, 2)}\n`);
  return report.ok ? 0 : 2;
}

if (isMainEntry(process.argv[1], import.meta.url)) {
  process.exitCode = await runDoctor(process.argv.slice(2));
}
