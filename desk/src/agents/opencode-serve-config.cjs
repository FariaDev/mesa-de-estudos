// @ts-check
'use strict';

/* Config do `opencode serve` da Mesa (#91): nenhuma ferramenta nativa de
   arquivo, shell ou rede. O tutor só alcança o MCP `mesa` e as ferramentas de
   leitura que ele mesmo oferece. O `opencode.json` fica num diretório do
   runtime e vai em `OPENCODE_CONFIG_DIR`; se a gravação falhar, o servidor
   sobe com o MESMO JSON em `OPENCODE_CONFIG_CONTENT`, nunca com permissão
   `ask` herdada de outro app.

   O 1.19.5 também lê `tools` e `permission`, mas não roda o turno da Mesa: o
   adaptador fala a API v2 do `serve` e ele responde 400 `Missing key at
   ["prompt"]` (antes da #91; ver `opencode-version.cjs`). O 2.2.4 traduz
   `tools` para as permissões `shell`/`edit`/`read` em `deny` (e
   `write`/`patch` caem em `edit`). O `tools` sozinho não basta no 2.2.4:
   `execute` (Code Mode, com `fetch`), `skill` e os `opencode_*` ficam fora
   dele. Por isso a regra `*: deny` fecha tudo e `mesa_*: allow` abre só as
   ferramentas do MCP da Mesa — medido no 2.2.4: sem ela, `execute` chamava
   `fetch` e a lista de ferramentas nativas aparecia. */

const fs = require('node:fs');
const path = require('node:path');
const {readPersonalConfig, sanitizePersonalConfig} = require('./opencode-personal-config.cjs');

/** Ferramentas nativas do OpenCode desligadas no tutor. */
const NATIVE_TOOLS = Object.freeze([
  'bash', 'shell', 'edit', 'write', 'multiedit', 'apply_patch', 'patch',
  'read', 'glob', 'grep', 'list', 'task', 'subagent', 'webfetch', 'websearch',
  'browser', 'todowrite', 'todoread', 'question', 'skill',
]);

const TOOLS = Object.freeze(Object.fromEntries(NATIVE_TOOLS.map((name) => [name, false])));

/* O `permission` é a segunda trava e a forma que o 2.2.4 resolve.
   `*: deny` vem antes de `mesa_*: allow`: a última regra que casa decide, e
   as ferramentas do MCP `mesa` são as únicas que o tutor pode chamar. */
const PERMISSION = Object.freeze({
  bash: 'deny',
  shell: 'deny',
  edit: 'deny',
  write: 'deny',
  read: 'deny',
  '*': 'deny',
  'mesa_*': 'allow',
});

const CONFIG = Object.freeze({
  $schema: 'https://opencode.ai/config.json',
  tools: TOOLS,
  permission: PERMISSION,
});

/**
 * Escreve (ou regrava) o config do servidor e devolve o diretório dele.
 * @param {{runtime: string}} options
 * @returns {string} caminho do diretório que vai em `OPENCODE_CONFIG_DIR`
 * @example const dir = writeServeConfig({runtime: '/r'});
 */
function writeServeConfig({runtime}) {
  if (typeof runtime !== 'string' || !runtime) throw new TypeError(`writeServeConfig: runtime inválido (${JSON.stringify(runtime)}); esperado caminho do runtime da Mesa`);
  const directory = path.join(runtime, 'opencode-config');
  fs.mkdirSync(directory, {recursive: true});
  fs.writeFileSync(path.join(directory, 'opencode.json'), `${JSON.stringify(CONFIG, null, 2)}\n`);
  return directory;
}

/**
 * Ambiente do servidor: o herdado, sempre sem config apontado por outro app e
 * sem o projeto (`opencode.json` da pasta) poder reabrir ferramenta nativa.
 * Com `configDir`, aponta o servidor para o config da Mesa; sem ele, o MESMO
 * JSON vai em `OPENCODE_CONFIG_CONTENT` (o plano B da gravação que falhou).
 * @param {Record<string, string|undefined>} env
 * @param {string|null} configDir
 * @param {{provider?: Record<string, unknown>, model?: string, small_model?: string}} [personal]
 * @returns {Record<string, string|undefined>}
 * @example serveEnv({OPENCODE_CONFIG_CONTENT: '{}'}, '/r/opencode-config').OPENCODE_CONFIG_DIR // '/r/opencode-config'
 * @example serveEnv({}, null).OPENCODE_CONFIG_CONTENT // '{"tools":…,"permission":…}'
 */
function serveEnv(env, configDir, personal = {}) {
  /** @type {Record<string, string|undefined>} */
  const out = {...env};
  /* O app aberto pelo Finder nasce com PATH mínimo; o provedor claude-agent
     do OpenCode procura o `claude` da pessoa no PATH. Os mesmos diretórios de
     usuário que o Pi usa entram antes, sem tocar no config pessoal. */
  const home = String(env.HOME || '');
  const userBins = ['.local/bin', '.bun/bin', '.cargo/bin', '.deno/bin']
    .map((rel) => path.join(home, ...rel.split('/')))
    .concat(['/opt/homebrew/bin', '/usr/local/bin'])
    .filter((dir) => { try { return fs.statSync(dir).isDirectory(); } catch { return false; } });
  if (home) out.PATH = [...new Set([...userBins, ...String(env.PATH || '').split(path.delimiter).filter(Boolean)])].join(path.delimiter);
  delete out.OPENCODE_CONFIG;
  delete out.OPENCODE_CONFIG_CONTENT;
  delete out.OPENCODE_CONFIG_DIR;
  delete out.OPENCODE_PERMISSION;
  delete out.OPENCODE_CLI_CONFIG_CONTENT;
  /* O `opencode.json` da pasta da conversa (e dos ancestrais) sobrepõe o
     config da Mesa: com um `{"permission":{"shell":"allow"}}` ali, o shell
     roda de verdade. Medido no 2.2.4; o mesmo config é resolvido pelo 1.19.5,
     que não chega ao turno pela API v2. */
  out.OPENCODE_DISABLE_PROJECT_CONFIG = '1';
  /* O 2.2.4 também lê `~/.claude` e `~/.agents` como instruções; o tutor da
     Mesa não herda CLAUDE.md/AGENTS.md de outro app (#93). */
  out.OPENCODE_DISABLE_CLAUDE_CODE = '1';
  const allowed = sanitizePersonalConfig(personal);
  const hasPersonal = Object.keys(allowed).length > 0;
  const merged = hasPersonal ? {...allowed, ...CONFIG} : CONFIG;
  if (configDir) {
    out.OPENCODE_CONFIG_DIR = configDir;
    /* O conteúdo inline só carrega a pessoa; as travas continuam no arquivo
       gravado. As duas cópias da trava também impedem que uma versão futura
       inverta a precedência. */
    if (hasPersonal) out.OPENCODE_CONFIG_CONTENT = JSON.stringify(merged);
  } else out.OPENCODE_CONFIG_CONTENT = JSON.stringify(merged);
  return out;
}

module.exports = {NATIVE_TOOLS, TOOLS, PERMISSION, CONFIG, readPersonalConfig, serveEnv, writeServeConfig};
