// @ts-check
'use strict';

/* Config do `opencode serve` da Mesa (#91): nenhuma ferramenta nativa de
   arquivo, shell ou rede. O tutor só alcança o MCP `mesa` e as ferramentas de
   leitura que ele mesmo oferece. O `opencode.json` fica num diretório do
   runtime e vai em `OPENCODE_CONFIG_DIR`; se a gravação falhar, o servidor
   sobe com o MESMO JSON em `OPENCODE_CONFIG_CONTENT`, nunca com permissão
   `ask` herdada de outro app.

   Achado de 2026-11-05 (Zen/Go, OpenCode 2.2.4): o servidor responde 429
   `FreeUsageLimitError` a qualquer modelo — grátis sem chave ou Go com chave —
   quando a ferramenta `read` NÃO é oferecida. A bisseção com o binário real
   mostrou que só `read` destrava; a chave `tools` não resolve. Por isso este
   config NÃO tem `tools` (com ela, mesmo com `read` ligado, o 429 volta) e
   mantém `read` na lista que o servidor manda ao modelo.

   A barreira continua no servidor do OpenCode, não no cliente: `read` é
   oferecida, mas `permission.read` nega TODOS os caminhos reais com
   `'*': 'deny'`. A única regra `allow` é o sentinela `/mesa-nada-existe/*`,
   que não existe e que ninguém cria — o modelo não tem `write`/`edit`/`bash`.
   Sem essa regra `allow`, o 2.2.4 retira `read` da lista (medido), e o grátis
   volta ao 429; por isso o sentinela fica. Leitura real deu
   "Permission denied: read" dentro do workspace e "external_directory" fora;
   symlink e `..` também são negados, e nenhum conteúdo chega ao modelo.

   O `skill` ainda aparece na lista (o 2.2.4 o injeta), mas `'*': 'deny'`
   recusa a chamada e a descoberta só vê as skills embutidas: nada de `HOME`,
   do projeto nem do workspace. O 1.19.5 também lê `tools` e `permission`, mas
   não roda o turno da Mesa: o adaptador fala a API v2 do `serve` e ele
   responde 400 `Missing key at ["prompt"]` (antes da #91; ver
   `opencode-version.cjs`). */

const fs = require('node:fs');
const path = require('node:path');
const {readPersonalConfig, sanitizePersonalConfig} = require('./opencode-personal-config.cjs');

/* O caminho que só existe para o 2.2.4 manter `read` na lista. É absoluto,
   fora do workspace e não é criado por nenhuma ferramenta da Mesa. A barreira
   não depende de ele não existir: no Windows ele resolve para `C:\\mesa-nada-
   existe`, que um usuário comum pode criar. O que nega é `external_directory`
   sob `*: deny` (medido no Linux com a pasta existindo; Windows não foi medido). */
const READ_SENTINEL = '/mesa-nada-existe/*';

/* O `permission` é a trava e a forma que o 2.2.4 resolve. A ORDEM importa: a
   última regra que casa decide. `*: deny` fecha tudo e vem primeiro;
   `mesa_*: allow` e o objeto do `read` vêm depois, senão o `*` desfaria o
   `allow` do sentinela e o 2.2.4 retiraria `read` da lista (medido). */
const PERMISSION = Object.freeze({
  '*': 'deny',
  'mesa_*': 'allow',
  bash: 'deny',
  shell: 'deny',
  edit: 'deny',
  write: 'deny',
  read: Object.freeze({'*': 'deny', [READ_SENTINEL]: 'allow'}),
});

/* Sem `tools`: a chave desliga a ferramenta antes de o `read` destravar o
   grátis (ver o comentário do topo). */
const CONFIG = Object.freeze({
  $schema: 'https://opencode.ai/config.json',
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
 * @example serveEnv({}, null).OPENCODE_CONFIG_CONTENT // '{"permission":…}'
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
  /* CONFIG por último: `permission` e a ausência de `tools` vencem qualquer
     coisa que a pessoa tenha no config dela (a lista permitida já descarta
     `permission`/`tools`, mas a precedência fica explícita). */
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

module.exports = {READ_SENTINEL, PERMISSION, CONFIG, readPersonalConfig, serveEnv, writeServeConfig};
