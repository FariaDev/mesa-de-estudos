#!/usr/bin/env node
/* Prepara uma cópia local (staging) do plugin Mesa experimental para o Codex.

   O que faz:
   - copia o pacote (manifesto, skill, servidor, host, assets, scripts) da
     origem para um destino NOVO/VAZIO escolhido pelo usuário;
   - grava no destino um `.mcp.json` com caminhos ABSOLUTOS (comando node,
     `--root`, `--cache-dir`, `--xournal-helper`, `--max-image-bytes`) — a
     configuração fica explícita e congelada na inicialização do servidor;
   - grava `.agents/plugins/marketplace.json` no destino: um marketplace
     standalone cujo `source.path` é `./` (a própria pasta do destino), pronto
     para a pessoa adicionar como marketplace local e instalar sem depender do
     catálogo de desenvolvimento do repositório;
   - grava `mesa-mcp-servers.toml`, um bloco standalone para registro manual
     em `~/.codex/config.toml` (Settings → MCP servers), sem tocar em nada;
   - copia `node_modules` se ele existir na origem (dependências já aprovadas
     neste checkout); se não existir, o staging fica claramente BLOQUEADO até
     `npm ci` — este script nunca instala nada.

   Em falha, a limpeza é por PROPRIEDADE: cada nó criado entra num diário com
   dev/ino e a limpeza só remove o que bate com o diário (arquivo/symlink) ou
   diretório que continua vazio; arquivo alheio/corrida é preservado, e um
   destino que já existia nunca é apagado — volta ao estado vazio anterior.

   O que NÃO faz: não altera configuração global/pessoal do Codex, não mexe no
   app instalado, não registra marketplace, não ativa plugin, não instala
   dependências, não reinicia apps, não chama modelo, não lê PDFs/materiais.
   O destino nunca é sobrescrito: precisa não existir ou estar vazio.

   Uso:
     node scripts/prepare-local.mjs --dest "/caminho/novo" \
       [--root "/pasta/de/PDFs"]... [--cache-dir "/cache"] \
       [--xournal-helper "/bin/helper"] [--max-image-bytes N] \
       [--node "/caminho/node"] [--source "origem"]

   Código de saída: 0 staging pronto; 2 staging criado mas bloqueado
   (node_modules ou arquivos de runtime ausentes); 1 uso/erro. */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {MAX_PATH_CHARS} from '../host/config.mjs';
import {inspectProfilePathSync, profileReason} from '../server/profiles.mjs';
import {MAX_STATE_BYTES, inspectStatePathSync, stateReason} from '../server/persistence.mjs';

export const COPY_ENTRIES = Object.freeze([
  '.codex-plugin',
  'README.md',
  'LICENSE',
  'package.json',
  'package-lock.json',
  'server',
  'ui',
  'host',
  'skills',
  'assets',
  'scripts',
]);

export const REQUIRED_SOURCE_FILES = Object.freeze([
  '.codex-plugin/plugin.json',
  '.mcp.json',
  'server/main.mjs',
  'ui/desk.html',
  'host/errors.mjs',
  'skills/mesa/SKILL.md',
]);

export const DEFAULT_CACHE_DIR_NAME = '.mesa-cache';
export const TOML_FILE = 'mesa-mcp-servers.toml';
export const MARKETPLACE_FILE = '.agents/plugins/marketplace.json';
export const STAGE_MARKETPLACE_NAME = 'mesa-study-local';
export const STAGE_PLUGIN_NAME = 'mesa-study';

export const MIN_MAX_IMAGE_BYTES = 4 * 1024;
export const MAX_MAX_IMAGE_BYTES = 32 * 1024 * 1024;

export class UserError extends Error {}

export function defaultSource(moduleUrl = import.meta.url) {
  return path.resolve(path.dirname(fileURLToPath(moduleUrl)), '..');
}

export function isPlaceholderPath(value) {
  if (typeof value !== 'string') return true;
  const text = value.trim();
  return text === '' || /[<>]/.test(text) || text.startsWith('~');
}

/* Prefere o `node` alcançável pelo PATH (ex.: /opt/homebrew/bin/node, symlink
   estável da instalação) ao caminho versionado de process.execPath; sem PATH
   válido, cai no executável atual. Sempre devolve um caminho absoluto. */
export function defaultNodeLauncher({env = process.env, execPath = process.execPath, io = {}} = {}) {
  const exists = io.exists || fs.existsSync;
  const access = io.access || fs.accessSync;
  const pathValue = env && typeof env.PATH === 'string' ? env.PATH : '';
  for (const dir of pathValue.split(path.delimiter)) {
    if (!dir) continue;
    const candidate = path.join(path.resolve(dir), 'node');
    try {
      if (!exists(candidate)) continue;
      access(candidate, fs.constants.X_OK);
      return candidate;
    } catch {
      // continua procurando
    }
  }
  return execPath;
}

export function isAncestorOrEqual(candidate, descendant) {
  return descendant === candidate || descendant.startsWith(candidate + path.sep);
}

/* String básica TOML: aspas, escape e controles viram sequências seguras. */
export function tomlString(value) {
  let out = '"';
  for (const char of String(value)) {
    const code = char.codePointAt(0);
    if (char === '\\') out += '\\\\';
    else if (char === '"') out += '\\"';
    else if (char === '\n') out += '\\n';
    else if (char === '\r') out += '\\r';
    else if (char === '\t') out += '\\t';
    else if (code < 0x20 || code === 0x7f) out += `\\u${code.toString(16).padStart(4, '0')}`;
    else out += char;
  }
  return `${out}"`;
}

function realpathOrNull(target) {
  try {
    return fs.realpathSync(target);
  } catch {
    return null;
  }
}

function pathState(target) {
  try {
    return fs.statSync(target);
  } catch {
    return null;
  }
}

/* Caminho canônico mesmo quando o destino ainda não existe: sobe até o
   ancestral existente, resolve o realpath dele e reanexa o restante. Evita
   que /var × /private/var (macOS) fure as comparações de confinamento. */
function canonicalForCompare(target) {
  const existing = realpathOrNull(target);
  if (existing) return existing;
  let current = target;
  const parts = [];
  while (current && !fs.existsSync(current)) {
    parts.unshift(path.basename(current));
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  const base = realpathOrNull(current) || current;
  return parts.length > 0 ? path.join(base, ...parts) : base;
}

/* Normaliza e valida a configuração de inicialização. Zero raízes é válido
   (PDF desabilitado); raiz ampla (/, home, ancestral do checkout) é recusada;
   raiz inexistente é mantida e só avisada (o host pula roots ausentes). */
export function normalizeConfig({
  roots = [],
  cacheDir = null,
  cacheDirSource = 'default',
  xournalHelper = null,
  maxImageBytes = null,
  tutorFile = null,
  learnerFile = null,
  stateFile = null,
  destRoot,
  sourceRoot,
  home = os.homedir(),
} = {}) {
  const errors = [];
  const normalizedRoots = [];
  const rootNotes = [];

  for (const raw of roots) {
    if (isPlaceholderPath(raw)) {
      errors.push(`Raiz inválida (vazia ou placeholder): ${JSON.stringify(raw)}.`);
      continue;
    }
    const text = raw.trim();
    if (!path.isAbsolute(text)) {
      errors.push(`Raiz precisa ser caminho absoluto: ${text}.`);
      continue;
    }
    const resolved = path.resolve(text);
    const canonical = realpathOrNull(resolved) || resolved;
    if (
      resolved === path.parse(resolved).root ||
      canonical === path.parse(canonical).root ||
      resolved === home ||
      canonical === home
    ) {
      errors.push(`Raiz ampla demais recusada: ${resolved}. Aponte a pasta explícita de PDFs, não a raiz do sistema nem a home.`);
      continue;
    }
    if (isAncestorOrEqual(canonical, sourceRoot)) {
      errors.push(`Raiz inclui o checkout inteiro: ${resolved}. Escolha a pasta de PDFs, não um ancestral do plugin.`);
      continue;
    }
    const state = pathState(canonical);
    if (state && !state.isDirectory()) {
      errors.push(`Raiz não é diretório: ${canonical}.`);
      continue;
    }
    if (!normalizedRoots.includes(canonical)) normalizedRoots.push(canonical);
    if (!state) rootNotes.push(`Raiz ainda não existe (será ignorada pelo servidor até existir): ${canonical}`);
  }

  let normalizedCache = null;
  if (cacheDir === null || cacheDir === undefined || (typeof cacheDir === 'string' && cacheDir.trim() === '')) {
    if (!destRoot) errors.push('Destino ausente para o cacheDir padrão.');
    else normalizedCache = path.join(destRoot, DEFAULT_CACHE_DIR_NAME);
    cacheDirSource = 'default';
  } else {
    if (isPlaceholderPath(cacheDir)) {
      errors.push(`cacheDir inválido (vazio ou placeholder): ${JSON.stringify(cacheDir)}.`);
    } else {
      const text = cacheDir.trim();
      if (!path.isAbsolute(text)) {
        errors.push(`cacheDir precisa ser caminho absoluto: ${text}.`);
      } else {
        const resolved = path.resolve(text);
        if (resolved === path.parse(resolved).root || resolved === home) {
          errors.push(`cacheDir amplo demais recusado: ${resolved}. Use uma pasta privada.`);
        } else {
          normalizedCache = resolved;
          cacheDirSource = 'flag';
        }
      }
    }
  }

  let normalizedHelper = null;
  if (xournalHelper !== null && xournalHelper !== undefined && String(xournalHelper).trim() !== '') {
    if (isPlaceholderPath(xournalHelper)) {
      errors.push(`Helper inválido (vazio ou placeholder): ${JSON.stringify(xournalHelper)}.`);
    } else {
      const text = String(xournalHelper).trim();
      if (!path.isAbsolute(text)) {
        errors.push(`Helper precisa ser caminho absoluto: ${text}.`);
      } else {
        const resolved = path.resolve(text);
        const stat = pathState(resolved);
        if (!stat || !stat.isFile()) {
          errors.push(`Helper não é arquivo regular: ${resolved}.`);
        } else {
          try {
            fs.accessSync(resolved, fs.constants.X_OK);
            normalizedHelper = resolved;
          } catch {
            errors.push(`Helper não é executável: ${resolved}.`);
          }
        }
      }
    }
  }

  let normalizedMax = null;
  if (maxImageBytes !== null && maxImageBytes !== undefined && String(maxImageBytes).trim() !== '') {
    const numeric = Number(String(maxImageBytes).trim());
    if (!Number.isInteger(numeric) || numeric < MIN_MAX_IMAGE_BYTES || numeric > MAX_MAX_IMAGE_BYTES) {
      errors.push(`--max-image-bytes precisa ser inteiro entre ${MIN_MAX_IMAGE_BYTES} e ${MAX_MAX_IMAGE_BYTES}.`);
    } else {
      normalizedMax = numeric;
    }
  }

  /* Perfis de estudo: espelha a aceitação do servidor (arquivo regular
     não-symlink, UTF-8, até MAX_PROFILE_BYTES); caminho inexistente é aceito
     e vira aviso — o servidor sobe e reporta indisponível sem corpo. */
  const profileIo = {
    lstat: (target) => fs.lstatSync(target),
    realpath: (target) => fs.realpathSync(target),
  };
  const normalizedProfiles = {tutor: null, learner: null};
  for (const [role, raw] of [['tutor', tutorFile], ['learner', learnerFile]]) {
    if (raw === null || raw === undefined || String(raw).trim() === '') continue;
    if (isPlaceholderPath(raw)) {
      errors.push(`--${role}-file inválido (vazio ou placeholder): ${JSON.stringify(raw)}.`);
      continue;
    }
    const text = String(raw).trim();
    if (!path.isAbsolute(text)) {
      errors.push(`--${role}-file precisa ser caminho absoluto: ${text}.`);
      continue;
    }
    if (text.length > MAX_PATH_CHARS) {
      errors.push(`--${role}-file excede ${MAX_PATH_CHARS} caracteres.`);
      continue;
    }
    const inspection = inspectProfilePathSync(path.resolve(text), {io: profileIo});
    if (inspection.state !== 'ready' && inspection.state !== 'missing') {
      errors.push(`--${role}-file inválido: ${profileReason(inspection.state)} (${text})`);
      continue;
    }
    normalizedProfiles[role] = inspection.canonical || path.resolve(text);
    if (inspection.state === 'missing') {
      rootNotes.push(`Perfil ${role} ainda não existe (o servidor sobe e mesa_context reporta indisponível, sem corpo): ${normalizedProfiles[role]}`);
    }
  }

  /* Checkpoint: filho DIRETO do cache canônico, .json; fora do cache o
     servidor recusa STARTUP_INVALID e o staging recusa antes. */
  let normalizedStateFile = null;
  if (stateFile !== null && stateFile !== undefined && String(stateFile).trim() !== '') {
    if (isPlaceholderPath(stateFile)) {
      errors.push(`--state-file inválido (vazio ou placeholder): ${JSON.stringify(stateFile)}.`);
    } else if (!normalizedCache) {
      errors.push('--state-file exige um cacheDir utilizável (o checkpoint mora dentro do cache).');
    } else {
      const text = String(stateFile).trim();
      if (!path.isAbsolute(text)) {
        errors.push(`--state-file precisa ser caminho absoluto: ${text}.`);
      } else if (text.length > MAX_PATH_CHARS) {
        errors.push(`--state-file excede ${MAX_PATH_CHARS} caracteres.`);
      } else {
        const inspection = inspectStatePathSync(path.resolve(text), normalizedCache, {
          io: {lstat: (target) => fs.lstatSync(target), realpath: (target) => fs.realpathSync(target)},
        });
        if (inspection.state !== 'ready' && inspection.state !== 'missing') {
          errors.push(`--state-file inválido: ${stateReason(inspection.state)} (${text}; teto ${MAX_STATE_BYTES} bytes)`);
        } else {
          normalizedStateFile = inspection.canonicalState;
        }
      }
    }
  }

  return {
    errors,
    notes: rootNotes,
    roots: normalizedRoots,
    cacheDir: normalizedCache,
    cacheDirSource,
    xournalHelper: normalizedHelper,
    maxImageBytes: normalizedMax,
    tutorFile: normalizedProfiles.tutor,
    learnerFile: normalizedProfiles.learner,
    stateFile: normalizedStateFile,
  };
}

function missingAncestors(target) {
  const chain = [];
  let current = target;
  while (current && !fs.existsSync(current)) {
    chain.push(current);
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return chain;
}

async function lstatAsyncOrNull(target) {
  try {
    return await fsp.lstat(target);
  } catch {
    return null;
  }
}

/* Registro de propriedade: identidade (dev/ino) do nó que ACABAMOS de criar.
   A limpeza só remove o que ainda bate com esse registro; o que outra pessoa
   (ou uma corrida) tiver trocado fica de pé. */
export function ownedEntry(target, type) {
  let stat = null;
  try {
    stat = fs.lstatSync(target);
  } catch {
    stat = null;
  }
  return {
    path: target,
    type,
    dev: stat && typeof stat.dev === 'number' ? stat.dev : null,
    ino: stat && typeof stat.ino === 'number' ? stat.ino : null,
  };
}

function sameIdentity(stat, entry) {
  if (!stat) return false;
  if (entry.dev === null || entry.ino === null) return true;
  return stat.dev === entry.dev && stat.ino === entry.ino;
}

function matchesType(stat, type) {
  if (!stat) return false;
  if (type === 'dir') return stat.isDirectory();
  if (type === 'symlink') return stat.isSymbolicLink();
  return stat.isFile();
}

async function recordOwned(journal, target, type) {
  journal.push(ownedEntry(target, type));
}

/* Cópia que preserva o TEXTO do symlink (relativo continua relativo) e nunca
   segue links. O fs.cp do Node reescreve links relativos para absolutos
   apontando para a origem; aqui o staging fica autocontido.
   Cada nó criado é registrado no diário (`journal`) ainda DENTRO da cópia, de
   modo que uma falha no meio de um diretório deixa rastro de propriedade para
   a limpeza — nunca um resíduo sem dono. */
async function copyTreePreservingLinks(from, to, journal) {
  const stat = await fsp.lstat(from);
  if (stat.isSymbolicLink()) {
    const target = await fsp.readlink(from);
    await fsp.symlink(target, to);
    await recordOwned(journal, to, 'symlink');
    return;
  }
  if (stat.isDirectory()) {
    if (await lstatAsyncOrNull(to)) throw new Error(`Destino já existe durante a cópia: ${to}`);
    await fsp.mkdir(to, {mode: stat.mode & 0o777});
    await recordOwned(journal, to, 'dir');
    await fsp.chmod(to, stat.mode & 0o777);
    for (const entry of await fsp.readdir(from)) {
      await copyTreePreservingLinks(path.join(from, entry), path.join(to, entry), journal);
    }
    return;
  }
  if (stat.isFile()) {
    if (await lstatAsyncOrNull(to)) throw new Error(`Destino já existe durante a cópia: ${to}`);
    try {
      await fsp.copyFile(from, to, fs.constants.COPYFILE_EXCL);
    } catch (error) {
      // cópia parcial de arquivo: se o destino nasceu, é nosso até prova em contrário.
      // EEXIST significa corrida/alheio: nunca registrar como propriedade.
      if (error && error.code !== 'EEXIST' && (await lstatAsyncOrNull(to))) {
        await recordOwned(journal, to, 'file');
      }
      throw error;
    }
    await recordOwned(journal, to, 'file');
    await fsp.chmod(to, stat.mode & 0o777);
    return;
  }
  throw new Error(`Entrada não suportada na cópia (nem arquivo, nem diretório, nem symlink): ${from}`);
}

/* Limpeza por propriedade: arquivos/symlinks do diário somem; diretórios só
   via rmdir (NUNCA recursivo) e apenas enquanto batem com o diário — arquivo
   alheio dentro de um diretório nosso impede o rmdir e preserva todo mundo.
   Destino que já existia nunca é apagado; destino novo volta a não existir se
   ficou vazio (ancestrais criados por nós idem). */
export async function cleanupPartial(destRoot, journal = [], createdDest = false, ancestorChain = []) {
  for (const entry of [...journal].reverse()) {
    try {
      const stat = await lstatAsyncOrNull(entry.path);
      if (!matchesType(stat, entry.type) || !sameIdentity(stat, entry)) continue;
      if (entry.type === 'dir') await fsp.rmdir(entry.path);
      else await fsp.rm(entry.path, {force: true});
    } catch {
      // melhor esforço: preserva o que não é comprovadamente nosso ou não esvaziou
    }
  }
  if (!createdDest) return;
  try {
    await fsp.rmdir(destRoot);
  } catch {
    // não vazio ou alheio: preserva
  }
  for (const ancestor of ancestorChain) {
    try {
      await fsp.rmdir(ancestor);
    } catch {
      // diretório não está vazio ou não foi criado só por nós: preserva
    }
  }
}

/* Args do servidor no staging: caminhos absolutos e config congelada na
   inicialização. Flags opcionais só entram quando de fato configuradas; os
   perfis/checkpoint entram como --tutor-file/--learner-file/--state-file. */
export function buildServerArgs({destRoot, roots = [], cacheDir, xournalHelper, maxImageBytes, tutorFile, learnerFile, stateFile}) {
  const args = [path.join(destRoot, 'server', 'main.mjs')];
  for (const root of roots) args.push('--root', root);
  if (cacheDir) args.push('--cache-dir', cacheDir);
  if (xournalHelper) args.push('--xournal-helper', xournalHelper);
  if (maxImageBytes !== null && maxImageBytes !== undefined) args.push('--max-image-bytes', String(maxImageBytes));
  if (tutorFile) args.push('--tutor-file', tutorFile);
  if (learnerFile) args.push('--learner-file', learnerFile);
  if (stateFile) args.push('--state-file', stateFile);
  return args;
}

function buildMcpJson({destRoot, node, roots, cacheDir, xournalHelper, maxImageBytes, tutorFile, learnerFile, stateFile}) {
  const args = buildServerArgs({destRoot, roots, cacheDir, xournalHelper, maxImageBytes, tutorFile, learnerFile, stateFile});
  return {
    mcpServers: {
      mesa: {
        command: node,
        args,
        cwd: destRoot,
      },
    },
  };
}

export function buildTomlSnippet({destRoot, node, roots, cacheDir, xournalHelper, maxImageBytes, tutorFile, learnerFile, stateFile}) {
  const args = buildServerArgs({destRoot, roots, cacheDir, xournalHelper, maxImageBytes, tutorFile, learnerFile, stateFile});
  return [
    '# Mesa de Estudos (experimental) — servidor MCP standalone',
    '# Gerado por codex-plugin/mesa-study/scripts/prepare-local.mjs.',
    '# Cole este bloco em ~/.codex/config.toml (Settings → MCP servers) para registrar',
    '# o servidor manualmente, sem instalar o pacote pelo marketplace.',
    '# Use o plugin OU este standalone: os dois juntos duplicam as ferramentas.',
    '# Caminhos absolutos deste computador e desta cópia; se mover a pasta, gere de novo.',
    '',
    '[mcp_servers.mesa]',
    `command = ${tomlString(node)}`,
    `args = [${args.map(tomlString).join(', ')}]`,
    `cwd = ${tomlString(destRoot)}`,
    '',
  ].join('\n');
}

/* Marketplace standalone gerado DENTRO do destino: a raiz do marketplace é o
   próprio staging e `source.path` é `./` (o plugin está na raiz). Assim a
   pessoa adiciona a pasta gerada como marketplace local e instala
   `mesa-study@mesa-study-local` — sem depender do catálogo de desenvolvimento
   do repositório (que usa `.mcp.json` relativo + env_vars, não configurado). */
export function buildStageMarketplace() {
  return {
    name: STAGE_MARKETPLACE_NAME,
    interface: {displayName: 'Mesa de Estudos staging (experimental)'},
    plugins: [
      {
        name: STAGE_PLUGIN_NAME,
        source: {source: 'local', path: './'},
        policy: {installation: 'AVAILABLE', authentication: 'ON_INSTALL'},
        category: 'Education & Research',
      },
    ],
  };
}

/* Executa a preparação. Lança UserError para uso/validação; erros de IO
   sobem como Error e o staging parcial é limpo por propriedade. */
export async function prepareLocal(options) {
  if (isPlaceholderPath(options.dest)) throw new UserError('--dest é obrigatório (caminho novo ou diretório vazio).');
  const sourceInput = options.source || defaultSource();
  const sourceRoot = realpathOrNull(sourceInput);
  if (!sourceRoot) throw new UserError(`Origem não encontrada: ${sourceInput}`);
  if (!fs.existsSync(path.join(sourceRoot, '.codex-plugin/plugin.json'))) {
    throw new UserError(`Origem não parece um plugin (sem .codex-plugin/plugin.json): ${sourceRoot}`);
  }

  const destRoot = path.resolve(options.dest.trim());
  const destCanonical = canonicalForCompare(destRoot);
  if (
    destRoot === sourceRoot ||
    destCanonical === sourceRoot ||
    isAncestorOrEqual(destCanonical, sourceRoot) ||
    isAncestorOrEqual(sourceRoot, destCanonical)
  ) {
    throw new UserError('--dest precisa ficar fora da árvore da origem (nem dentro, nem contendo o plugin).');
  }

  const nodeInput = options.node && String(options.node).trim() !== '' ? String(options.node).trim() : defaultNodeLauncher();
  if (!path.isAbsolute(nodeInput)) throw new UserError(`--node precisa ser caminho absoluto: ${nodeInput}`);
  const nodeStat = pathState(nodeInput);
  if (!nodeStat || !nodeStat.isFile()) throw new UserError(`--node não é arquivo: ${nodeInput}`);
  try {
    fs.accessSync(nodeInput, fs.constants.X_OK);
  } catch {
    throw new UserError(`--node não é executável: ${nodeInput}`);
  }

  const destStat = (() => {
    try {
      return fs.lstatSync(destRoot);
    } catch {
      return null;
    }
  })();
  const destCreated = destStat === null;
  if (destStat) {
    if (destStat.isSymbolicLink()) throw new UserError(`--dest é um symlink; use um diretório real: ${destRoot}`);
    if (!destStat.isDirectory()) throw new UserError(`--dest existe e não é diretório: ${destRoot}`);
    const entries = await fsp.readdir(destRoot);
    if (entries.length > 0) throw new UserError(`--dest não está vazio; nada foi sobrescrito: ${destRoot}`);
  }

  const config = normalizeConfig({
    roots: options.roots || [],
    cacheDir: options.cacheDir ?? null,
    xournalHelper: options.xournalHelper ?? null,
    maxImageBytes: options.maxImageBytes ?? null,
    tutorFile: options.tutorFile ?? null,
    learnerFile: options.learnerFile ?? null,
    stateFile: options.stateFile ?? null,
    destRoot,
    sourceRoot,
  });
  if (config.errors.length > 0) throw new UserError(config.errors.join('\n'));

  const missingSource = REQUIRED_SOURCE_FILES.filter((relative) => !fs.existsSync(path.join(sourceRoot, relative)));
  const modulesSource = path.join(sourceRoot, 'node_modules');
  const modulesPresent = fs.existsSync(modulesSource);

  const ancestorChain = missingAncestors(destRoot);
  const journal = [];
  try {
    await fsp.mkdir(destRoot, {recursive: true});

    const copied = [];
    for (const entry of COPY_ENTRIES) {
      const from = path.join(sourceRoot, entry);
      if (!fs.existsSync(from)) continue;
      const to = path.join(destRoot, entry);
      await copyTreePreservingLinks(from, to, journal);
      copied.push(entry);
    }

    const mcpJson = buildMcpJson({
      destRoot,
      node: nodeInput,
      roots: config.roots,
      cacheDir: config.cacheDir,
      xournalHelper: config.xournalHelper,
      maxImageBytes: config.maxImageBytes,
      tutorFile: config.tutorFile,
      learnerFile: config.learnerFile,
      stateFile: config.stateFile,
    });
    const mcpTarget = path.join(destRoot, '.mcp.json');
    await fsp.writeFile(mcpTarget, `${JSON.stringify(mcpJson, null, 2)}\n`, {flag: 'wx'});
    await recordOwned(journal, mcpTarget, 'file');
    const tomlTarget = path.join(destRoot, TOML_FILE);
    await fsp.writeFile(tomlTarget, buildTomlSnippet({
      destRoot,
      node: nodeInput,
      roots: config.roots,
      cacheDir: config.cacheDir,
      xournalHelper: config.xournalHelper,
      maxImageBytes: config.maxImageBytes,
      tutorFile: config.tutorFile,
      learnerFile: config.learnerFile,
      stateFile: config.stateFile,
    }), {flag: 'wx'});
    await recordOwned(journal, tomlTarget, 'file');

    const marketplaceDir = path.join(destRoot, '.agents');
    const marketplacePluginsDir = path.join(marketplaceDir, 'plugins');
    await fsp.mkdir(marketplaceDir, {mode: 0o755});
    await recordOwned(journal, marketplaceDir, 'dir');
    await fsp.mkdir(marketplacePluginsDir, {mode: 0o755});
    await recordOwned(journal, marketplacePluginsDir, 'dir');
    const marketplaceTarget = path.join(destRoot, MARKETPLACE_FILE);
    await fsp.writeFile(marketplaceTarget, `${JSON.stringify(buildStageMarketplace(), null, 2)}\n`, {flag: 'wx'});
    await recordOwned(journal, marketplaceTarget, 'file');

    let nodeModulesCopied = false;
    if (modulesPresent) {
      await copyTreePreservingLinks(modulesSource, path.join(destRoot, 'node_modules'), journal);
      nodeModulesCopied = true;
    }

    const blocked = missingSource.map((relative) => `Arquivo de runtime ausente na origem: ${relative}`);
    if (!nodeModulesCopied) {
      blocked.push('node_modules ausente na origem; o staging fica bloqueado até `npm ci` no destino.');
    }

    const nextSteps = [];
    if (!nodeModulesCopied) {
      nextSteps.push(`cd ${destRoot} && npm ci   # baixa as dependências de runtime; nada é instalado automaticamente`);
    }
    if (missingSource.length > 0) {
      nextSteps.push('Aguardar/entregar os arquivos de runtime acima antes de usar o servidor.');
    }
    nextSteps.push(
      `Marketplace standalone pronto em ${MARKETPLACE_FILE} (source "./"): adicione ESTA pasta (${destRoot}) como marketplace local no app/CLI e instale ${STAGE_PLUGIN_NAME}@${STAGE_MARKETPLACE_NAME} — ação sua; nada é registrado/ativado por este script.`,
    );
    nextSteps.push(
      'Mantenha esta cópia no lugar: o .mcp.json usa caminhos absolutos desta pasta; mesmo depois que o app copiar o plugin para o cache, o servidor executado continua sendo o desta cópia.',
    );
    if (config.roots.length === 0) {
      nextSteps.push('Zero raízes: a leitura de PDF fica desabilitada; gere o staging de novo com --root "/pasta/de/PDFs".');
    }
    if (!config.xournalHelper) {
      nextSteps.push('Sem --xournal-helper a captura fica desligada; a leitura de PDF segue funcionando.');
    }
    if (config.tutorFile || config.learnerFile || config.stateFile) {
      const declared = [
        config.tutorFile ? `tutor: ${config.tutorFile}` : null,
        config.learnerFile ? `learner: ${config.learnerFile}` : null,
        config.stateFile ? `checkpoint: ${config.stateFile}` : null,
      ].filter(Boolean);
      nextSteps.push(
        `Config opt-in gravada nos args: ${declared.join(' · ')}. O checkpoint é UM espaço de estudo explícito (pode ser compartilhado por processos; a última gravação vence) e a retomada nunca restaura imagem/captura sozinha.`,
      );
    }

    return {
      ok: blocked.length === 0,
      source: sourceRoot,
      dest: destRoot,
      node: nodeInput,
      copied,
      generated: ['.mcp.json', TOML_FILE, MARKETPLACE_FILE],
      marketplace: {name: STAGE_MARKETPLACE_NAME, plugin: STAGE_PLUGIN_NAME, file: MARKETPLACE_FILE, sourcePath: './'},
      nodeModules: {path: path.join(destRoot, 'node_modules'), copied: nodeModulesCopied, presentInSource: modulesPresent},
      config: {
        roots: config.roots,
        rootsSource: config.roots.length > 0 ? 'flag' : 'none',
        cacheDir: config.cacheDir,
        cacheDirSource: config.cacheDirSource,
        xournalHelper: config.xournalHelper,
        maxImageBytes: config.maxImageBytes,
        tutorFile: config.tutorFile,
        learnerFile: config.learnerFile,
        stateFile: config.stateFile,
      },
      blocked,
      nextSteps,
      notes: [
        ...config.notes,
        'Staging estático: editar a origem não atualiza esta cópia; gere de novo.',
        'Nada de configuração global, app ou sessão foi tocado por este script.',
      ],
    };
  } catch (error) {
    await cleanupPartial(destRoot, journal, destCreated, ancestorChain);
    throw error;
  }
}

function usage() {
  return [
    'Uso: node scripts/prepare-local.mjs --dest DIR [opções]',
    '',
    '  --dest DIR              destino novo ou vazio (obrigatório; nunca sobrescreve)',
    '  --source DIR            origem (padrão: a pasta que contém scripts/)',
    '  --root DIR              raiz de PDFs (repetível; zero raízes é permitido)',
    '  --cache-dir DIR         cache privado (padrão: <dest>/.mesa-cache)',
    '  --xournal-helper BIN    helper de janelas do Xournal++ (opcional)',
    '  --max-image-bytes N     teto do PNG devolvido (4096..33554432)',
    '  --tutor-file ARQ        perfil TUTOR.md congelado (regular UTF-8, <= 65536 bytes; opcional)',
    '  --learner-file ARQ      perfil LEARNER.md congelado (regular UTF-8, <= 65536 bytes; opcional)',
    '  --state-file JSON       checkpoint de retomada DENTRO do cache (opcional; nunca é ligado por padrão)',
    '  --node BIN              executável node para o .mcp.json (padrão: o node do PATH; senão, o atual)',
    '  --help                  mostra esta ajuda',
    '',
    'Gera no destino: .mcp.json (caminhos absolutos), mesa-mcp-servers.toml e',
    '.agents/plugins/marketplace.json (marketplace standalone, source "./").',
    'Código de saída: 0 pronto; 2 criado mas bloqueado; 1 uso/erro.',
  ].join('\n');
}

function takeValue(argv, index, flag) {
  const arg = argv[index];
  const eq = arg.indexOf('=');
  if (eq !== -1) return {value: arg.slice(eq + 1), consumed: 0};
  const next = argv[index + 1];
  if (next === undefined) throw new UserError(`${flag} exige um valor.`);
  return {value: next, consumed: 1};
}

export function parseArgs(argv) {
  const options = {
    dest: null,
    source: null,
    roots: [],
    cacheDir: null,
    xournalHelper: null,
    maxImageBytes: null,
    tutorFile: null,
    learnerFile: null,
    stateFile: null,
    node: null,
    help: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = String(argv[index]);
    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }
    if (arg === '--dest' || arg.startsWith('--dest=')) {
      const {value, consumed} = takeValue(argv, index, '--dest');
      options.dest = value;
      index += consumed;
      continue;
    }
    if (arg === '--source' || arg.startsWith('--source=')) {
      const {value, consumed} = takeValue(argv, index, '--source');
      options.source = value;
      index += consumed;
      continue;
    }
    if (arg === '--root' || arg.startsWith('--root=')) {
      const {value, consumed} = takeValue(argv, index, '--root');
      options.roots.push(value);
      index += consumed;
      continue;
    }
    if (arg === '--cache-dir' || arg.startsWith('--cache-dir=')) {
      const {value, consumed} = takeValue(argv, index, '--cache-dir');
      options.cacheDir = value;
      index += consumed;
      continue;
    }
    if (arg === '--xournal-helper' || arg.startsWith('--xournal-helper=')) {
      const {value, consumed} = takeValue(argv, index, '--xournal-helper');
      options.xournalHelper = value;
      index += consumed;
      continue;
    }
    if (arg === '--max-image-bytes' || arg.startsWith('--max-image-bytes=')) {
      const {value, consumed} = takeValue(argv, index, '--max-image-bytes');
      options.maxImageBytes = value;
      index += consumed;
      continue;
    }
    if (arg === '--tutor-file' || arg.startsWith('--tutor-file=')) {
      const {value, consumed} = takeValue(argv, index, '--tutor-file');
      options.tutorFile = value;
      index += consumed;
      continue;
    }
    if (arg === '--learner-file' || arg.startsWith('--learner-file=')) {
      const {value, consumed} = takeValue(argv, index, '--learner-file');
      options.learnerFile = value;
      index += consumed;
      continue;
    }
    if (arg === '--state-file' || arg.startsWith('--state-file=')) {
      const {value, consumed} = takeValue(argv, index, '--state-file');
      options.stateFile = value;
      index += consumed;
      continue;
    }
    if (arg === '--node' || arg.startsWith('--node=')) {
      const {value, consumed} = takeValue(argv, index, '--node');
      options.node = value;
      index += consumed;
      continue;
    }
    throw new UserError(`Argumento desconhecido: ${arg}`);
  }
  return options;
}

function isMainEntry(entry, moduleUrl = import.meta.url) {
  if (typeof entry !== 'string' || entry === '') return false;
  try {
    return fs.realpathSync(entry) === fs.realpathSync(fileURLToPath(moduleUrl));
  } catch {
    return false;
  }
}

if (isMainEntry(process.argv[1])) {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
      process.stdout.write(`${usage()}\n`);
      process.exitCode = 0;
    } else {
      const report = await prepareLocal(options);
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
      const lines = [
        `staging: ${report.dest}`,
        `node_modules: ${report.nodeModules.copied ? 'copiado da origem' : 'AUSENTE — bloqueado até npm ci'}`,
        `raízes: ${report.config.roots.length} · cache: ${report.config.cacheDir} (${report.config.cacheDirSource}) · helper: ${report.config.xournalHelper || 'desligado'}`,
        `perfis: tutor=${report.config.tutorFile || 'desligado'} · learner=${report.config.learnerFile || 'desligado'} · checkpoint=${report.config.stateFile || 'desligado'}`,
        `marketplace: ${report.marketplace.file} (${report.marketplace.plugin}@${report.marketplace.name}) — adicionar é ação sua`,
      ];
      for (const item of report.blocked) lines.push(`bloqueio: ${item}`);
      for (const step of report.nextSteps) lines.push(`próximo: ${step}`);
      process.stderr.write(`${lines.join('\n')}\n`);
      process.exitCode = report.ok ? 0 : 2;
    }
  } catch (error) {
    const message = error && error.message ? error.message : String(error);
    process.stderr.write(`prepare-local: ${message}\n${error instanceof UserError ? `${usage()}\n` : ''}`);
    process.exitCode = 1;
  }
}
