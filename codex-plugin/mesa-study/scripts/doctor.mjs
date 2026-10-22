#!/usr/bin/env node
/* Doctor SOMENTE LEITURA do plugin Mesa experimental (Codex).

   Confere requisitos locais: versão do Node, o próprio pacote (manifestos,
   arquivos de runtime, assets), dependências instaladas em node_modules,
   Poppler (pdfinfo/pdftocairo), helper de janelas do Xournal++ e a
   configuração de inicialização (MESA_STUDY_ROOTS, MESA_STUDY_CACHE_DIR,
   MESA_XOURNAL_HELPER, MESA_STUDY_MAX_IMAGE_BYTES).

   A prontidão espelha as recusas REAIS da inicialização do servidor
   (server/config.mjs: STARTUP_INVALID) e as checagens do primeiro uso do cache
   (host/output.mjs: leaf real, do próprio UID, privado 0700): configuração que
   o servidor recusaria — ou que o host recusaria ao escrever o cache — nunca
   sai como "PDF pronto". `ok` exige `ready.pdf` E zero bloqueios; pacote
   incompleto (manifestos/assets/issues) também bloqueia.

   O que ele NUNCA faz: chamar modelo, abrir sessão do Codex/CLI, ler
   credenciais ou sessões, instalar/atualizar qualquer coisa, criar o cacheDir,
   escrever arquivos, varrer pastas de PDFs, abrir/reiniciar apps ou capturar
   tela. Só lê o disco e roda `--version`/`-v` das ferramentas de linha de
   comando. Raízes/cache/helper vêm do ambiente do processo; zero raízes é um
   estado válido (a leitura de PDF fica desabilitada) e o doctor só reporta.

   Saída: um único JSON no stdout (estável para máquinas); resumo humano no
   stderr. Código de saída 0 = PDF pronto; 2 = pré-requisito pendente;
   1 = erro interno/uso. */

import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {MAX_PATH_CHARS, MAX_ROOTS} from '../host/config.mjs';
import {inspectCacheDir} from '../server/checks.mjs';
import {MAX_PROFILE_BYTES, inspectProfilePathSync, profileReason} from '../server/profiles.mjs';
import {MAX_STATE_BYTES, inspectStatePathSync, stateReason} from '../server/persistence.mjs';

export const MIN_NODE = Object.freeze([22, 19, 0]);
export const POPPLER_DIRS = Object.freeze(['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin']);
export const SCREENCAPTURE_PATH = '/usr/sbin/screencapture';
export const DEFAULT_MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const MIN_MAX_IMAGE_BYTES = 4 * 1024;
export const MAX_MAX_IMAGE_BYTES = 32 * 1024 * 1024;

export const ENV = Object.freeze({
  roots: 'MESA_STUDY_ROOTS',
  cacheDir: 'MESA_STUDY_CACHE_DIR',
  xournalHelper: 'MESA_XOURNAL_HELPER',
  maxImageBytes: 'MESA_STUDY_MAX_IMAGE_BYTES',
  tutorFile: 'MESA_STUDY_TUTOR_FILE',
  learnerFile: 'MESA_STUDY_LEARNER_FILE',
  stateFile: 'MESA_STUDY_STATE_FILE',
});

export const REQUIRED_PACKAGE_FILES = Object.freeze([
  '.codex-plugin/plugin.json',
  '.mcp.json',
  'server/main.mjs',
  'ui/desk.html',
  'host/errors.mjs',
  'skills/mesa/SKILL.md',
]);

export const REQUIRED_NODE_MODULES = Object.freeze(['@modelcontextprotocol/sdk', 'zod']);

export function defaultRoot(moduleUrl = import.meta.url) {
  return path.resolve(path.dirname(fileURLToPath(moduleUrl)), '..');
}

export function parseNodeVersion(text) {
  const match = String(text || '').trim().match(/^v?(\d+)\.(\d+)\.(\d+)/);
  return match ? match.slice(1).map(Number) : null;
}

export function versionAtLeast(tuple, minimum) {
  if (!Array.isArray(tuple) || !Array.isArray(minimum)) return false;
  for (let index = 0; index < minimum.length; index += 1) {
    const a = tuple[index] ?? 0;
    const b = minimum[index] ?? 0;
    if (a !== b) return a > b;
  }
  return true;
}

export function isExecutableFile(candidate, io = {}) {
  const statSync = io.stat || fs.statSync;
  const accessSync = io.access || fs.accessSync;
  try {
    if (!statSync(candidate).isFile()) return false;
    accessSync(candidate, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/* Mesma resolução do host (host/tools.mjs): só os diretórios fixos, na ordem,
   primeiro executável vence; sem candidato, devolve o do primeiro diretório. */
export function resolveFixedDirTool(name, {dirs = POPPLER_DIRS, isExecutable = isExecutableFile} = {}) {
  for (const dir of dirs) {
    const candidate = path.join(dir, name);
    if (isExecutable(candidate)) return candidate;
  }
  return path.join(dirs[0], name);
}

function defaultIo() {
  return {
    exists: (target) => fs.existsSync(target),
    stat: (target) => fs.statSync(target),
    lstat: (target) => fs.lstatSync(target),
    access: (target, mode) => fs.accessSync(target, mode),
    readFile: (target) => fs.readFileSync(target, 'utf8'),
    readFileBuffer: (target) => fs.readFileSync(target),
    realpath: (target) => fs.realpathSync(target),
    getuid: () => (typeof process.getuid === 'function' ? process.getuid() : null),
    exec: (binary, args) => {
      const result = spawnSync(binary, args, {encoding: 'utf8', timeout: 5000, maxBuffer: 16384});
      if (result.error) throw result.error;
      if (result.status !== 0) {
        throw Object.assign(new Error(`${binary} saiu ${result.status}`), {code: `EXIT_${result.status}`});
      }
      return `${result.stdout || ''}\n${result.stderr || ''}`;
    },
  };
}

function probeBinary(binary, args, io) {
  try {
    const output = String(io.exec(binary, args));
    const match = output.match(/(\d+)\.(\d+)\.(\d+)/);
    return {available: true, version: match ? match[0] : null, tuple: match ? match.slice(1).map(Number) : null};
  } catch (error) {
    return {available: false, code: (error && error.code) || 'UNAVAILABLE'};
  }
}

function realpathOrNull(target, io) {
  try {
    return io.realpath(target);
  } catch {
    return null;
  }
}

function describePathState(target, io) {
  let stat = null;
  try {
    stat = io.stat(target);
  } catch {
    return {exists: false, isDirectory: false};
  }
  return {exists: true, isDirectory: stat.isDirectory(), isFile: stat.isFile()};
}

export function parseSetup(env = {}, io = defaultIo()) {
  const roots = {configured: false, source: 'none', valid: true, error: null, count: 0, entries: [], missing: [], ready: false};
  const rawRoots = env[ENV.roots];
  if (rawRoots !== undefined && rawRoots !== null && String(rawRoots).trim() !== '') {
    roots.configured = true;
    roots.source = 'env';
    let parsed = null;
    try {
      parsed = JSON.parse(String(rawRoots));
    } catch {
      roots.valid = false;
      roots.error = `${ENV.roots} precisa ser um JSON de array de caminhos absolutos.`;
    }
    if (parsed !== null) {
      if (!Array.isArray(parsed) || parsed.some((root) => typeof root !== 'string')) {
        roots.valid = false;
        roots.error = `${ENV.roots} precisa ser um JSON de array de caminhos absolutos.`;
      } else if (parsed.length > MAX_ROOTS) {
        roots.valid = false;
        roots.error = `${ENV.roots} tem ${parsed.length} raízes; o servidor aceita no máximo ${MAX_ROOTS} (STARTUP_INVALID).`;
      } else {
        const seen = new Set();
        for (const root of parsed) {
          const resolved = path.resolve(root);
          if (!path.isAbsolute(root)) {
            roots.valid = false;
            roots.error = `${ENV.roots} contém caminho não absoluto: ${root}`;
            continue;
          }
          if (root.length > MAX_PATH_CHARS) {
            roots.valid = false;
            roots.error = `Raiz excede ${MAX_PATH_CHARS} caracteres: ${root.slice(0, 80)}…`;
            continue;
          }
          const canonical = realpathOrNull(resolved, io) || resolved;
          if (seen.has(canonical)) continue;
          seen.add(canonical);
          const state = describePathState(canonical, io);
          roots.entries.push({path: canonical, exists: state.exists, isDirectory: state.isDirectory});
          if (!state.exists) roots.missing.push(canonical);
          else if (!state.isDirectory) {
            roots.valid = false;
            roots.error = `Raiz não é diretório: ${canonical}`;
          }
        }
      }
    }
  }
  roots.count = roots.entries.length;
  roots.ready = roots.configured && roots.valid && roots.entries.some((entry) => entry.exists && entry.isDirectory);

  const cacheDir = {
    configured: false, source: 'none', path: null, absolute: false, withinLimit: false,
    exists: false, isDirectory: false, symlink: false, safe: false, issue: null, ready: false,
  };
  const rawCache = env[ENV.cacheDir];
  if (rawCache !== undefined && rawCache !== null && String(rawCache).trim() !== '') {
    const text = String(rawCache).trim();
    cacheDir.configured = true;
    cacheDir.source = 'env';
    cacheDir.path = path.resolve(text);
    cacheDir.absolute = path.isAbsolute(text);
    cacheDir.withinLimit = text.length <= MAX_PATH_CHARS;
    const state = describePathState(cacheDir.path, io);
    cacheDir.exists = state.exists;
    cacheDir.isDirectory = state.isDirectory;
    let rawExists = false;
    try {
      rawExists = io.exists(cacheDir.path);
    } catch {
      rawExists = false;
    }
    if (!cacheDir.withinLimit) {
      cacheDir.issue = `excede ${MAX_PATH_CHARS} caracteres`;
    } else if (cacheDir.exists) {
      let leaf = null;
      try {
        leaf = io.lstat(cacheDir.path);
      } catch {
        leaf = null;
      }
      const uid = typeof io.getuid === 'function' ? io.getuid() : (typeof process.getuid === 'function' ? process.getuid() : null);
      if (leaf && leaf.isSymbolicLink()) {
        cacheDir.symlink = true;
        cacheDir.issue = 'é um symlink (o host exige diretório real)';
      } else if (!state.isDirectory) {
        cacheDir.issue = 'não é diretório';
      } else if (!leaf) {
        cacheDir.issue = 'não pôde ser inspecionado';
      } else if (uid !== null && typeof leaf.uid === 'number' && leaf.uid !== uid) {
        cacheDir.issue = 'pertence a outro usuário';
      } else if (typeof leaf.mode === 'number' && (leaf.mode & 0o022) !== 0) {
        cacheDir.issue = 'é gravável por grupo/outros (o host exige 0700)';
      }
    } else if (rawExists) {
      cacheDir.issue = 'não pôde ser inspecionado';
    } else {
      const availability = inspectCacheDir(cacheDir.path, {
        lstat: io.lstat, stat: io.stat, realpath: io.realpath, access: io.access,
        getuid: io.getuid,
      });
      if (!availability.available) {
        cacheDir.issue = `pasta ausente não pode ser criada (${availability.state})`;
      }
    }
    cacheDir.safe = cacheDir.issue === null;
    cacheDir.ready = cacheDir.absolute && cacheDir.withinLimit && cacheDir.safe;
  }

  const xournalHelper = {
    configured: false, source: 'none', path: null, absolute: false, withinLimit: false,
    valid: true, exists: false, executable: false, ready: false,
  };
  const rawHelper = env[ENV.xournalHelper];
  if (rawHelper !== undefined && rawHelper !== null && String(rawHelper).trim() !== '') {
    const text = String(rawHelper).trim();
    xournalHelper.configured = true;
    xournalHelper.source = 'env';
    xournalHelper.path = path.resolve(text);
    xournalHelper.absolute = path.isAbsolute(text);
    xournalHelper.withinLimit = text.length <= MAX_PATH_CHARS;
    xournalHelper.valid = xournalHelper.absolute && xournalHelper.withinLimit;
    xournalHelper.exists = describePathState(xournalHelper.path, io).exists;
    xournalHelper.executable = xournalHelper.valid && isExecutableFile(xournalHelper.path, io);
    xournalHelper.ready = xournalHelper.executable;
  }

  const rawMax = env[ENV.maxImageBytes];
  let maxImageBytes = null;
  let maxImageBytesValid = true;
  let maxImageBytesConfigured = false;
  let maxImageBytesError = null;
  if (rawMax !== undefined && rawMax !== null && rawMax !== '') {
    maxImageBytesConfigured = true;
    const numeric = Number(String(rawMax).trim());
    if (Number.isFinite(numeric)) maxImageBytes = numeric;
    maxImageBytesValid =
      Number.isInteger(numeric) && numeric >= MIN_MAX_IMAGE_BYTES && numeric <= MAX_MAX_IMAGE_BYTES;
    if (!maxImageBytesValid) {
      maxImageBytesError =
        `${ENV.maxImageBytes} precisa ser um inteiro entre ${MIN_MAX_IMAGE_BYTES} e ${MAX_MAX_IMAGE_BYTES} bytes; ` +
        'o servidor recusa a inicialização com STARTUP_INVALID (não há fallback para o padrão).';
    }
  }

  const profileIo = {
    lstat: io.lstat,
    realpath: io.realpath,
  };

  /* Perfil de estudo: espelha exatamente a aceitação do servidor (absoluto,
     limite de caminho, arquivo regular não-symlink até MAX_PROFILE_BYTES e
     UTF-8); symlink/tipo/teto/encoding recusam o startup de verdade. Arquivo
     inexistente é aceito (fica indisponível, sem corpo). */
  const inspectProfileRole = (raw, role) => {
    const info = {
      role,
      configured: false,
      source: 'none',
      path: null,
      absolute: false,
      withinLimit: false,
      valid: true,
      state: null,
      available: false,
      bytes: null,
      error: null,
    };
    if (raw === undefined || raw === null || String(raw).trim() === '') return info;
    const text = String(raw).trim();
    info.configured = true;
    info.source = 'env';
    info.path = path.resolve(text);
    info.absolute = path.isAbsolute(text);
    info.withinLimit = text.length <= MAX_PATH_CHARS;
    if (!info.absolute || !info.withinLimit) {
      info.valid = false;
      info.error = !info.absolute ? 'não é caminho absoluto' : `excede ${MAX_PATH_CHARS} caracteres`;
      return info;
    }
    const inspection = inspectProfilePathSync(info.path, {io: profileIo});
    info.state = inspection.state;
    info.available = inspection.state === 'ready';
    info.bytes = Number.isInteger(inspection.bytes) ? inspection.bytes : null;
    if (inspection.state !== 'ready' && inspection.state !== 'missing') {
      info.valid = false;
      info.error = profileReason(inspection.state);
    }
    if (inspection.canonical) info.path = inspection.canonical;
    return info;
  };

  const stateFile = {
    configured: false,
    source: 'none',
    path: null,
    absolute: false,
    withinLimit: false,
    cacheConfigured: cacheDir.configured,
    withinCache: false,
    valid: true,
    state: null,
    available: false,
    error: null,
  };
  const rawState = env[ENV.stateFile];
  if (rawState !== undefined && rawState !== null && String(rawState).trim() !== '') {
    const text = String(rawState).trim();
    stateFile.configured = true;
    stateFile.source = 'env';
    stateFile.path = path.resolve(text);
    stateFile.absolute = path.isAbsolute(text);
    stateFile.withinLimit = text.length <= MAX_PATH_CHARS;
    if (!stateFile.absolute) {
      stateFile.valid = false;
      stateFile.error = 'não é caminho absoluto';
    } else if (!stateFile.withinLimit) {
      stateFile.valid = false;
      stateFile.error = `excede ${MAX_PATH_CHARS} caracteres`;
    } else if (!cacheDir.configured || !cacheDir.absolute) {
      stateFile.valid = false;
      stateFile.error = `exige ${ENV.cacheDir}/--cache-dir configurado e absoluto (o checkpoint mora dentro do cache)`;
    } else {
      const inspection = inspectStatePathSync(stateFile.path, cacheDir.path, {
        io: {lstat: io.lstat, realpath: io.realpath},
      });
      stateFile.state = inspection.state;
      stateFile.valid = inspection.state === 'ready' || inspection.state === 'missing';
      stateFile.available = stateFile.valid && cacheDir.ready;
      if (!stateFile.valid) stateFile.error = stateReason(inspection.state);
      if (inspection.canonicalState) stateFile.path = inspection.canonicalState;
      stateFile.withinCache =
        !!inspection.canonicalState &&
        !!inspection.canonicalCache &&
        path.dirname(inspection.canonicalState) === inspection.canonicalCache;
    }
  }

  return {
    roots,
    cacheDir,
    xournalHelper,
    studyProfile: {
      tutor: inspectProfileRole(env[ENV.tutorFile], 'tutor'),
      learner: inspectProfileRole(env[ENV.learnerFile], 'learner'),
    },
    stateFile,
    maxImageBytes: {
      configured: maxImageBytesConfigured,
      value: maxImageBytes,
      valid: maxImageBytesValid,
      error: maxImageBytesError,
      default: DEFAULT_MAX_IMAGE_BYTES,
    },
  };
}

export function checkPackage(root, io = defaultIo()) {
  const result = {
    root,
    exists: io.exists(root),
    missing: [],
    issues: [],
    manifests: {
      pluginJson: {path: path.join(root, '.codex-plugin/plugin.json'), present: false, valid: false, name: null, version: null, error: null},
      mcpJson: {
        path: path.join(root, '.mcp.json'),
        present: false,
        valid: false,
        error: null,
        server: {name: 'mesa', present: false, command: null, args: null, cwd: null, envVars: null},
      },
    },
    assets: {icon: false, logo: false},
    ok: false,
  };
  if (!result.exists) {
    result.issues.push(`Raiz do pacote não existe: ${root}`);
    return result;
  }
  for (const relative of REQUIRED_PACKAGE_FILES) {
    if (!io.exists(path.join(root, relative))) result.missing.push(relative);
  }
  const pluginJson = result.manifests.pluginJson;
  if (io.exists(pluginJson.path)) {
    pluginJson.present = true;
    try {
      const parsed = JSON.parse(io.readFile(pluginJson.path));
      pluginJson.valid = true;
      pluginJson.name = parsed.name ?? null;
      pluginJson.version = parsed.version ?? null;
      if (parsed.name !== 'mesa-study') result.issues.push(`plugin.json com name inesperado: ${parsed.name}`);
      if (!parsed.skills) result.issues.push('plugin.json sem campo skills.');
      if (!parsed.mcpServers) result.issues.push('plugin.json sem campo mcpServers.');
      if (!parsed.interface || typeof parsed.interface !== 'object') result.issues.push('plugin.json sem objeto interface.');
    } catch (error) {
      pluginJson.error = error && error.message ? error.message : String(error);
      result.issues.push(`plugin.json inválido: ${pluginJson.error}`);
    }
  }
  const mcpJson = result.manifests.mcpJson;
  if (io.exists(mcpJson.path)) {
    mcpJson.present = true;
    try {
      const parsed = JSON.parse(io.readFile(mcpJson.path));
      mcpJson.valid = true;
      const server = parsed && parsed.mcpServers ? parsed.mcpServers.mesa : null;
      if (!server || typeof server !== 'object') {
        result.issues.push('.mcp.json sem mcpServers.mesa.');
      } else {
        mcpJson.server = {
          name: 'mesa',
          present: true,
          command: server.command ?? null,
          args: Array.isArray(server.args) ? server.args : null,
          cwd: server.cwd ?? null,
          envVars: Array.isArray(server.env_vars) ? server.env_vars : null,
        };
        if (typeof server.command !== 'string' || server.command === '') result.issues.push('.mcp.json: mesa.command ausente.');
        if (!Array.isArray(server.args) || server.args.length === 0) result.issues.push('.mcp.json: mesa.args ausente.');
      }
    } catch (error) {
      mcpJson.error = error && error.message ? error.message : String(error);
      result.issues.push(`.mcp.json inválido: ${mcpJson.error}`);
    }
  }
  result.assets.icon = io.exists(path.join(root, 'assets/icon.png'));
  result.assets.logo = io.exists(path.join(root, 'assets/logo.png'));
  if (!result.assets.icon || !result.assets.logo) {
    result.issues.push('assets/icon.png e assets/logo.png são exigidos pela validação de pacote Codex; rode scripts/make-assets.mjs.');
  }
  result.ok =
    result.missing.length === 0 &&
    result.issues.length === 0 &&
    pluginJson.valid &&
    pluginJson.name === 'mesa-study' &&
    mcpJson.valid &&
    mcpJson.server.present;
  return result;
}

export function checkDependencies(root, io = defaultIo()) {
  const modulesRoot = path.join(root, 'node_modules');
  const missing = [];
  for (const dependency of REQUIRED_NODE_MODULES) {
    if (!io.exists(path.join(modulesRoot, dependency, 'package.json'))) missing.push(dependency);
  }
  return {path: modulesRoot, installed: missing.length === 0, missing, required: [...REQUIRED_NODE_MODULES]};
}

export function checkPoppler(io = defaultIo()) {
  const tools = {};
  for (const name of ['pdfinfo', 'pdftocairo']) {
    const candidate = resolveFixedDirTool(name, {isExecutable: (target) => isExecutableFile(target, io)});
    const executable = isExecutableFile(candidate, io);
    tools[name] = executable ? {path: candidate, ...probeBinary(candidate, ['-v'], io)} : {path: candidate, available: false, version: null, code: 'TOOL_MISSING'};
  }
  return {available: tools.pdfinfo.available === true && tools.pdftocairo.available === true, dirs: [...POPPLER_DIRS], tools};
}

export function runDoctor({
  root = defaultRoot(),
  env = process.env,
  platform = process.platform,
  nodeVersion = process.versions.node,
  execPath = process.execPath,
  io: ioOverrides = {},
} = {}) {
  const io = {...defaultIo(), ...ioOverrides};
  const tuple = parseNodeVersion(nodeVersion);
  const checks = {
    platform: {current: platform, captureSupported: platform === 'darwin'},
    node: {version: nodeVersion, tuple, execPath, required: `>=${MIN_NODE.join('.')}`, supported: versionAtLeast(tuple, MIN_NODE)},
    launcher: {command: 'node', ...probeBinary('node', ['--version'], io)},
    package: checkPackage(root, io),
    dependencies: checkDependencies(root, io),
    poppler: checkPoppler(io),
    screencapture: {path: SCREENCAPTURE_PATH, available: platform === 'darwin' && isExecutableFile(SCREENCAPTURE_PATH, io)},
    setup: parseSetup(env, io),
  };

  const environmentReady =
    checks.node.supported &&
    checks.launcher.available &&
    checks.package.ok &&
    checks.dependencies.installed &&
    checks.poppler.available;
  const startupAcceptable =
    checks.setup.roots.valid &&
    checks.setup.cacheDir.absolute &&
    checks.setup.maxImageBytes.valid &&
    checks.setup.xournalHelper.valid &&
    checks.setup.studyProfile.tutor.valid &&
    checks.setup.studyProfile.learner.valid &&
    checks.setup.stateFile.valid;
  const setupReady =
    startupAcceptable && checks.setup.roots.ready && checks.setup.cacheDir.ready;
  const ready = {
    pdf: environmentReady && setupReady,
    capture:
      environmentReady &&
      setupReady &&
      checks.platform.captureSupported &&
      checks.screencapture.available &&
      checks.setup.xournalHelper.ready,
  };

  const blocked = [];
  const warnings = [];
  if (!checks.node.supported) blocked.push(`Node ${checks.node.version} é anterior a ${MIN_NODE.join('.')}.`);
  if (!checks.launcher.available) blocked.push('`node` não foi encontrado no PATH do processo que inicia o servidor.');
  if (!checks.package.exists) blocked.push(`Pacote não encontrado em ${root}.`);
  if (checks.package.missing.length > 0) blocked.push(`Arquivos do pacote ausentes: ${checks.package.missing.join(', ')}.`);
  for (const issue of checks.package.issues) blocked.push(issue);
  if (!checks.dependencies.installed) {
    blocked.push(
      `node_modules sem: ${checks.dependencies.missing.join(', ')}. Rode \`npm ci\` na pasta do plugin (nada é instalado automaticamente).`,
    );
  }
  if (!checks.poppler.available) {
    blocked.push(`Poppler não encontrado em ${POPPLER_DIRS.join(', ')} (pdfinfo/pdftocairo são exigidos por mesa_page).`);
  }
  if (!checks.setup.roots.configured) {
    blocked.push('Nenhuma raiz de PDF configurada (MESA_STUDY_ROOTS / --root); a leitura de PDF fica desabilitada.');
  } else if (!checks.setup.roots.valid) {
    blocked.push(checks.setup.roots.error || 'Raízes de PDF inválidas.');
  } else if (!checks.setup.roots.ready) {
    blocked.push(`Nenhuma raiz de PDF existente e legível (ausentes: ${checks.setup.roots.missing.join(', ') || '—'}).`);
  }
  if (!checks.setup.cacheDir.configured) {
    blocked.push('cacheDir não configurado (MESA_STUDY_CACHE_DIR / --cache-dir); mesa_page e mesa_capture escrevem nele.');
  } else if (!checks.setup.cacheDir.absolute) {
    blocked.push('cacheDir precisa ser caminho absoluto.');
  } else if (!checks.setup.cacheDir.ready) {
    blocked.push(
      `cacheDir inválido para o host (${checks.setup.cacheDir.issue}): ${checks.setup.cacheDir.path}. ` +
        `Use um diretório real, privado (0700) e do próprio usuário, com caminho de até ${MAX_PATH_CHARS} caracteres.`,
    );
  }
  if (checks.setup.xournalHelper.configured && !checks.setup.xournalHelper.valid) {
    blocked.push(
      `Helper do Xournal++ inválido na inicialização (${
        checks.setup.xournalHelper.absolute ? `excede ${MAX_PATH_CHARS} caracteres` : 'não é caminho absoluto'
      }): o servidor recusa STARTUP_INVALID. Remova ${ENV.xournalHelper} ou corrija o caminho.`,
    );
  } else if (checks.setup.xournalHelper.configured && !checks.setup.xournalHelper.executable) {
    warnings.push(`Helper do Xournal++ configurado mas não executável: ${checks.setup.xournalHelper.path}`);
  } else if (!checks.setup.xournalHelper.configured) {
    warnings.push('Helper do Xournal++ não configurado: mesa_windows/mesa_capture recusam; a leitura de PDF segue funcionando.');
  }
  if (!checks.platform.captureSupported) warnings.push('Captura do Xournal++ só existe no macOS.');
  if (!checks.setup.maxImageBytes.valid) {
    blocked.push(
      `Configuração de ${ENV.maxImageBytes} inválida; o servidor recusa a inicialização com STARTUP_INVALID em vez de usar o padrão de ${DEFAULT_MAX_IMAGE_BYTES} bytes.`,
    );
  }
  for (const role of ['tutor', 'learner']) {
    const profile = checks.setup.studyProfile[role];
    const envName = role === 'tutor' ? ENV.tutorFile : ENV.learnerFile;
    if (profile.configured && !profile.valid) {
      blocked.push(
        `Perfil ${role} inválido na inicialização (${profile.error}): o servidor recusa STARTUP_INVALID. ` +
          `Corrija ${envName} (arquivo regular UTF-8 até ${MAX_PROFILE_BYTES} bytes) ou remova a configuração.`,
      );
    } else if (profile.configured && profile.state === 'missing') {
      warnings.push(
        `Perfil ${role} configurado mas o arquivo ainda não existe: o servidor sobe e mesa_context reporta indisponível, sem corpo.`,
      );
    }
  }
  if (checks.setup.stateFile.configured && !checks.setup.stateFile.valid) {
    blocked.push(
      `stateFile inválido na inicialização (${checks.setup.stateFile.error}): o servidor recusa STARTUP_INVALID. ` +
        `Use um ${ENV.stateFile} .json dentro do cacheDir (${MAX_STATE_BYTES} bytes de teto) ou remova a configuração.`,
    );
  }

  return {
    checks,
    ready,
    blocked,
    warnings,
    ok: ready.pdf && blocked.length === 0,
    note:
      'Somente requisitos locais. Espelha as recusas reais da inicialização (STARTUP_INVALID) — incluindo perfis de estudo (symlink/tipo/teto/UTF-8) e checkpoint dentro do cache — ' +
      'e as checagens do cache no primeiro uso, ' +
      'mas não valida carregamento no app Codex, exibição de imagem pelo modelo, captura real, permissões do macOS nem inferência; ' +
      'nada é instalado/alterado e zero raízes é um estado válido (PDF desabilitado).',
  };
}

function usage() {
  return [
    'Uso: node scripts/doctor.mjs [--root DIR] [--help]',
    '',
    '  --root DIR   raiz do plugin (padrão: a pasta que contém scripts/)',
    '  --help       mostra esta ajuda',
    '',
    'Lê o ambiente atual (MESA_STUDY_ROOTS, MESA_STUDY_CACHE_DIR, MESA_XOURNAL_HELPER,',
    'MESA_STUDY_MAX_IMAGE_BYTES, MESA_STUDY_TUTOR_FILE, MESA_STUDY_LEARNER_FILE,',
    'MESA_STUDY_STATE_FILE). Saída JSON no stdout; resumo no stderr.',
    'Código de saída: 0 PDF pronto; 2 pré-requisito pendente; 1 uso/erro interno.',
  ].join('\n');
}

function parseArgs(argv) {
  const options = {root: null, help: false};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = String(argv[index]);
    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }
    if (arg === '--root' || arg.startsWith('--root=')) {
      const eq = arg.indexOf('=');
      if (eq !== -1) {
        options.root = arg.slice(eq + 1);
      } else {
        options.root = argv[index + 1];
        index += 1;
      }
      continue;
    }
    throw new Error(`Argumento desconhecido: ${arg}`);
  }
  return options;
}

function summaryLines(result) {
  const {checks, ready, blocked, warnings} = result;
  const mark = (value) => (value ? 'ok' : 'pendente');
  const lines = [
    'Mesa experimental (Codex) — doctor (somente leitura)',
    `node ${checks.node.version} (${mark(checks.node.supported)}) · launcher ${mark(checks.launcher.available)} · pacote ${mark(checks.package.ok)} · deps ${mark(checks.dependencies.installed)} · Poppler ${mark(checks.poppler.available)}`,
    `raízes ${checks.setup.roots.count} (${mark(checks.setup.roots.ready)}) · cache ${mark(checks.setup.cacheDir.ready)} · helper Xournal++ ${mark(checks.setup.xournalHelper.ready)}`,
    `perfis tutor/learner ${mark(checks.setup.studyProfile.tutor.valid && checks.setup.studyProfile.learner.valid)} · checkpoint ${mark(checks.setup.stateFile.valid)}`,
    `PDF: ${ready.pdf ? 'pronto' : 'pendente'} · captura: ${ready.capture ? 'pronta' : 'indisponível'}`,
  ];
  for (const item of blocked) lines.push(`bloqueio: ${item}`);
  for (const item of warnings) lines.push(`aviso: ${item}`);
  return lines;
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
      const root = options.root ? path.resolve(options.root) : defaultRoot();
      const result = runDoctor({root});
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      process.stderr.write(`${summaryLines(result).join('\n')}\n`);
      process.exitCode = result.ok ? 0 : 2;
    }
  } catch (error) {
    process.stderr.write(`doctor: ${error && error.message ? error.message : error}\n${usage()}\n`);
    process.exitCode = 1;
  }
}
