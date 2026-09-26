'use strict';

/* Perfil explícito da Mesa.
 *
 * O problema: a Mesa nasce herdando a descoberta inteira do Pi — todas as
 * extensões globais, o overlay do vault e os pacotes. Uma extensão global nova
 * entra na Mesa sem ninguém decidir, e o custo (prompt, ferramentas, processos)
 * aparece do mesmo jeito.
 *
 * Aqui a lista é declarada e verificável: `npm run profile` mede o que a sessão
 * REALMENTE carregou (ferramenta por ferramenta, com a origem) e compara com o
 * esperado. Sem medição, a lista seria só uma promessa.
 *
 * A trava vem LIGADA e `desk.pinnedExtensions: false` em config.json volta a
 * herdar a descoberta inteira. O default é este porque foi medido: o perfil
 * fixado reproduz exatamente o mesmo conjunto de ferramentas (36 registradas,
 * 21 ativas) da descoberta herdada — ver `npm run profile`. A descoberta de
 * skills e de arquivos de contexto não passa por `--no-extensions`.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

/* Extensões globais que a Mesa espera carregar (nome do diretório em
   ~/.pi/agent/extensions, ou arquivo solto na raiz de extensions/). */
const GLOBAL_EXTENSIONS = [
  'ask-user/index.ts',
  'browser/index.ts',
  'context-mode/index.ts',
  'copy-all/index.ts',
  'custom-header.ts',
  'git-info/index.ts',
  'model-info/index.ts',
  'net-dns-order.ts',
  'notifications/index.ts',
  'observational-memory',
  'prompt-snippets/index.ts',
  'research-tools/index.ts',
  'subagents/index.ts',
  'workspace-guard/index.ts',
];

/* Overlay do curso (`.pi/extensions/*` do vault): a Mesa lê pelo caminho do
   curso e pelos links que o `prepareCourse` cria no runtime. */
const OVERLAY_EXTENSIONS = [
  'anki-cards.ts',
  'code-study-guard.ts',
  'geogebra.ts',
  'learning-session.ts',
  'quiz.ts',
  'visual-check.ts',
];

/* Pacotes das settings que a Mesa precisa (o `--no-extensions` os desliga junto). */
const PACKAGES = ['npm:pi-mcp-adapter'];

/* Medido numa sessão real de curso (sonda de diagnóstico, 2026-09-23): 36
   ferramentas registradas, 21 ativas. Serve de linha de base para o verificador
   — se a lista mudar, o relatório mostra. */
const EXPECTED_ACTIVE = [
  'ask_user', 'bash', 'edit', 'geogebra', 'mcp', 'mcpScript',
  'mcp__anki', 'mcp__apple_mail', 'mcp__apple_notes', 'mcp__calendar',
  'mcp__obsidian', 'mcp__youtube', 'obsidian-note', 'quiz', 'read',
  'subagent_cancel', 'subagent_check', 'subagent_list', 'subagent_spawn',
  'subagent_wait', 'write',
];

const EXPECTED_INACTIVE = [
  'anki_cards',
  'browser_click', 'browser_close', 'browser_console', 'browser_eval',
  'browser_fill', 'browser_goto', 'browser_network', 'browser_screenshot',
  'find', 'grep', 'ls', 'powershell', 'web_fetch', 'web_search',
];

function extensionsRoot(home = os.homedir()) {
  return path.join(home, '.pi', 'agent', 'extensions');
}

/** Caminhos absolutos das extensões globais que existem nesta máquina. */
function globalExtensionPaths(home = os.homedir()) {
  const root = extensionsRoot(home);
  return GLOBAL_EXTENSIONS.map((rel) => path.join(root, rel));
}

/** Caminhos das extensões do overlay do curso/vault. */
function overlayExtensionPaths(overlayDirs) {
  const out = [];
  for (const dir of (Array.isArray(overlayDirs) ? overlayDirs : [])) {
    for (const name of OVERLAY_EXTENSIONS) {
      const file = path.join(dir, 'extensions', name);
      if (fs.existsSync(file) && !out.includes(file)) out.push(file);
    }
  }
  return out;
}

function declaredPackages(settingsPath) {
  try {
    const packages = JSON.parse(fs.readFileSync(settingsPath, 'utf8'))?.packages;
    return Array.isArray(packages) ? packages.filter((p) => typeof p === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * Argumentos de lançamento do perfil fixado. Só devolve as entradas que existem
 * — caminho inexistente na linha de comando é ruído, não intenção.
 * @param {{home?: string, overlayDirs?: string[], settingsPath?: string}} options
 */
function pinnedArgs({home, overlayDirs, settingsPath} = {}) {
  const declared = declaredPackages(settingsPath || path.join(home || os.homedir(), '.pi', 'agent', 'settings.json'));
  const args = ['--no-extensions'];
  for (const file of [...globalExtensionPaths(home), ...overlayExtensionPaths(overlayDirs)]) {
    if (fs.existsSync(file)) args.push('--extension', file);
  }
  for (const pkg of PACKAGES) if (declared.includes(pkg)) args.push('--extension', pkg);
  return args;
}

/** Relatório de drift entre o medido e o esperado. */
function compare(expectedActive, observedActive) {
  const observed = new Set(observedActive);
  const expected = new Set(expectedActive);
  return {
    missing: [...expected].filter((name) => !observed.has(name)).sort(),
    extra: [...observed].filter((name) => !expected.has(name)).sort(),
  };
}

module.exports = {
  GLOBAL_EXTENSIONS, PACKAGES, OVERLAY_EXTENSIONS,
  EXPECTED_ACTIVE, EXPECTED_INACTIVE,
  extensionsRoot, globalExtensionPaths, overlayExtensionPaths,
  declaredPackages, pinnedArgs, compare,
};
