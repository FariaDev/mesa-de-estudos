# Mesa de Estudos — plugin experimental para o Codex

Plugin **separado** do app Mesa de Estudos: skill de tutoria (`mesa`), servidor
MCP stdio e painel MCP Apps experimental com PDF visível, seleção de documento,
navegação de páginas e conferência explícita do Xournal++. O Xournal++ continua
sendo a superfície de escrita; o chat do Codex continua sendo o tutor.

> **Estado:** a versão anterior foi instalada/habilitada pela CLI e o usuário
> mostrou uma resposta correta ao exercício sintético. A exibição desta nova
> interface dentro do Codex e a captura real ainda precisam de teste no app.
> Testes de ponte simulada não comprovam compatibilidade visual do aplicativo.

## Abrir a interface

Em uma conversa nova com esta versão do plugin instalada, peça:

```text
$mesa Abra a Mesa visual.
```

A skill deve chamar `mesa_open`, que declara o recurso MCP Apps
`ui://mesa-study/desk-v1.html`. `mesa_page` continua sendo uma operação de dados:
chamá-la sozinha não abre um painel. O componente é HTML/CSS/JavaScript local,
sem rede em runtime. Seus botões usam a ponte MCP Apps do hospedeiro.
A biblioteca lista apenas PDFs nas raízes fixadas na inicialização.

Navegar uma página não envia automaticamente uma nova pergunta ao tutor.
**Pedir ajuda** envia um pedido ao chat para que o modelo receba a página via
`mesa_page`. **Conferir Xournal++** exige escolha de janela e captura explícita;
a imagem é devolvida pelo MCP ao cliente, sem garantia de prévia exclusivamente
local. Ao pedir ajuda sobre a captura, uma **nova captura da janela escolhida**
é solicitada ao tutor; a prévia anterior não substitui essa operação. O servidor
não executa inferência.

## O que o pacote contém

```
mesa-study/
├── .codex-plugin/plugin.json   # manifesto de compatibilidade Codex (doc oficial)
├── .mcp.json                   # servidor stdio "mesa" (formato .mcp.json do Codex)
├── skills/mesa/SKILL.md        # skill de tutoria e conferência
├── server/                     # servidor MCP stdio (7 ferramentas)
├── ui/desk.html                # painel MCP Apps self-contained
├── host/                       # operações confinadas de PDF/captura (snapshot do protótipo Claude)
├── assets/icon.png, logo.png   # placeholders geométricos exigidos pela validação de pacote
├── scripts/doctor.mjs          # requisitos locais, somente leitura
├── scripts/prepare-local.mjs   # cópia local com configuração absoluta + marketplace standalone
├── scripts/make-assets.mjs     # gera/atualiza os PNGs do manifesto
├── LICENSE                     # cópia exata do LICENSE MIT da raiz
└── tests/                      # testes do pacote, roteiro manual e integração do staging
```

O manifesto usa o formato **`.codex-plugin/plugin.json`** (compatibilidade),
com `skills: "./skills/"` e `mcpServers: "./.mcp.json"` — os campos oficiais do
formato Codex. A versão `0.2.2-experimental` é a mesma do `package.json` e do
`SERVER_VERSION` do servidor (prerelease SemVer válido, verificado pelos
testes). Não há `plugin.json`
portátil (Agent Plugins): este pacote é para teste local, e a documentação
oficial diz que MCP stdio local não é publicável na submissão pública (que exige
HTTPS remoto).

## Requisitos

- **Node.js 22.19+** (mesma exigência do restante do produto).
- **Poppler** com `pdfinfo` e `pdftocairo` (o host procura em
  `/opt/homebrew/bin`, `/usr/local/bin`, `/usr/bin` — nunca no PATH).
- **macOS** apenas para captura do Xournal++ (helper `visual-check/windows` do
  checkout, gravação de tela) — a leitura de PDF funciona sem ela.
- App Codex ou Codex CLI com suporte a plugins. A documentação oficial introduz
  plugins no app **26.324 (2026-03-25)**; **não há versão mínima documentada**
  para o manifesto de compatibilidade. Valide no app atualizado.
- Pendência de fato: o carregamento dentro do app e o `cwd` relativo do
  `.mcp.json` **não foram validados** (ver lacunas na pesquisa). O staging com
  caminhos absolutos + marketplace próprio existe justamente para não depender
  desse ponto.

## Verificações locais (nada toca o app)

```sh
cd codex-plugin/mesa-study

# 1. Requisitos locais, somente leitura (JSON no stdout, resumo no stderr).
node scripts/doctor.mjs
# código 0 = PDF pronto; 2 = pré-requisito pendente; 1 = uso/erro.

# 2. Todos os testes automatizados (MCP real, pacote e integração do staging).
npm test                       # node --test tests/*.test.mjs

# 3. Só a camada de empacotamento (manifesto, versão, LICENSE, doctor, staging).
node --test tests/package-*.test.mjs

# 4. Só a integração do pacote gerado (SDK real, servidor como subprocesso,
#    Poppler sintético; nada de app/modelo/captura real).
node --test tests/integration-stage.test.mjs
```

O doctor lê `MESA_STUDY_ROOTS`, `MESA_STUDY_CACHE_DIR`, `MESA_XOURNAL_HELPER`
e `MESA_STUDY_MAX_IMAGE_BYTES` do ambiente atual. Ele **não** chama modelo, não
lê credenciais/sessões, não cria o cache, não instala nada e não abre o app.
Zero raízes é um estado válido (só desabilita a leitura de PDF).

A prontidão dele espelha o que o servidor REAL faria. Entradas que o
`parseStartupConfig` recusaria (`STARTUP_INVALID`) — JSON inválido, raiz não
absoluta ou acima de 64, `max-image-bytes` fora da faixa (4 KiB–32 MiB), helper
não absoluto — zeram o `ok`; cache existente que o host recusaria (symlink,
arquivo, gravável por grupo/outros, de outro dono) também bloqueia; pacote
incompleto (assets, manifesto torto, `issues`) idem. Para um cache ainda ausente,
confere também se o ancestral existente é um diretório gravável, sem criar nada.
A saída só é 0 com
`ready.pdf` **e** zero bloqueios. Os testes de paridade comparam o veredito com
o parser real do servidor, sem abrir o app.

## Preparar uma cópia local (staging)

O jeito mais previsível de usar fora do catálogo de desenvolvimento é gerar uma
cópia com caminhos absolutos no `.mcp.json` — o app não precisa herdar o
ambiente do shell:

```sh
node scripts/prepare-local.mjs \
  --dest "/Users/voce/mesa-codex-study" \
  --root "/Users/voce/Documents/Curso/PDFs" \
  --root "/Users/voce/Documents/Curso/Listas" \
  --cache-dir "/Users/voce/.cache/mesa-study-codex" \
  --xournal-helper "/Users/voce/caminho/do/checkout/visual-check/windows"
```

- `--dest` precisa **não existir** ou estar vazio: nada é sobrescrito. Em falha,
  a limpeza é **por propriedade**: só o que o script criou sai (arquivo por
  identidade dev/ino; diretório por `rmdir`, nunca `rm -rf`), arquivo alheio ou
  de corrida fica de pé, e um destino que já existia volta vazio — nunca é
  apagado;
- `--root` é repetível e **zero raízes é permitido** (a leitura de PDF fica
  desabilitada, `mesa_status` explica); raízes amplas (`/`, home, ancestral do
  checkout) e placeholders são recusados; raiz inexistente só gera aviso;
- `--cache-dir` pode ser omitido (padrão: `<dest>/.mesa-cache`, criado 0700 no
  primeiro uso); `--xournal-helper` pode ser omitido (captura desligada);
- `node_modules` é **copiado** se já existir na origem; se não existir, o
  staging é criado mas fica **bloqueado até `npm ci` no destino** (o script
  nunca instala nada; código de saída 2);
- são gerados `dest/.mcp.json` (node absoluto + `--root/--cache-dir/...` + teto
  opcional) e `dest/mesa-mcp-servers.toml` (bloco standalone para registro
  manual);
- também é gerado `dest/.agents/plugins/marketplace.json`: um marketplace
  **standalone** cuja raiz é o próprio destino e cujo `source.path` é `./` —
  pronto para a Opção A abaixo, sem depender do catálogo do repositório;
- nada de configuração global, app ou sessão é tocado. Editar a origem não
  atualiza a cópia: gere de novo.

**Mantenha a cópia no lugar.** Mesmo depois que o app copiar o plugin para o
cache dele, os argumentos absolutos do `.mcp.json` continuam apontando para o
staging — é o servidor desta pasta que roda. Se mover/deletar o staging, o
plugin instalado quebra até você gerar outra cópia e reinstalar.

## Ativar no Codex (ações da pessoa, não automatizadas)

### Opção A (recomendada) — marketplace do staging

Depois de rodar `prepare-local`:

1. adicione a **pasta do staging** como marketplace local — no app
   (Plugins → adicionar marketplace local apontando para o destino) ou no
   terminal com `codex plugin marketplace add "/caminho/do/staging"` (isso grava
   no config pessoal; é decisão de quem instala, fora deste repositório);
2. instale `mesa-study@mesa-study-local`;
3. comece uma conversa nova e fale `$mesa`.

A CLI observada copia o plugin para
`~/.codex/plugins/cache/mesa-study-local/mesa-study/<versão>/`, mas o `.mcp.json`
de lá aponta para os caminhos absolutos do staging (ver “Mantenha a cópia”).
Editar o staging exige reinstalar/atualizar no app. Plugins com MCP são marcados
**Desktop only** pela documentação oficial.

### Opção A2 (dev, opcional) — catálogo do repositório

O catálogo em `codex-plugin/.agents/plugins/marketplace.json` aponta para o
pacote de desenvolvimento (`./mesa-study`) e está rotulado como **dev, sem
configurar**: o `.mcp.json` dele usa `command: node` relativo + `cwd: "./"` e
`env_vars`, que dependem de o app resolver cwd/ambiente — pontos **ainda não
validados**. De propósito, **não** existe `.agents/plugins/` na raiz do
repositório: abrir o repo no app não descobre nada automaticamente. Use este
catálogo só para desenvolver/testar o pacote; para uso normal, prefira a
Opção A.

### Opção B — servidor MCP standalone (sem plugin, sem skill)

Cole o bloco de `dest/mesa-mcp-servers.toml` em `~/.codex/config.toml`
(Settings → MCP servers) ou use o snippet para registrar por CLI. Isso altera a
configuração pessoal do Codex — **ação de quem instala, fora do escopo deste
repositório**.

O standalone **não instala a skill**: sem o plugin, `$mesa` não existe e o
Codex só enxerga as ferramentas MCP (que podem aparecer como `mcp__mesa__*`).
As **ferramentas funcionam sem skill** (dá para chamá-las e conferir os nomes
reais na sessão), mas o fluxo de tutoria depende das instruções da skill —
para o fluxo completo, instale o plugin (Opção A). Use o plugin **ou** o
standalone; registrando os dois, as ferramentas aparecem duplicadas.

### Skill

Codex usa menção com `$` para skills (documentado); com o plugin instalado,
fale `$mesa` numa conversa nova. `/mesa` **não** é sintaxe documentada — não
use. A ativação implícita vem da descrição da skill. Sem o plugin instalado não
há skill nem menção `$mesa` (ver Opção B). Confirme os nomes reais das
ferramentas na sessão; não invente namespace.

## Configuração do servidor (congelada na inicialização)

| Flag do servidor | Ambiente equivalente | Efeito |
|---|---|---|
| `--root /abs` (repetível) | `MESA_STUDY_ROOTS` (JSON de caminhos) | Raízes de PDF autorizadas; flag vence o ambiente; dedupe por realpath; máximo 64 |
| `--cache-dir /abs` | `MESA_STUDY_CACHE_DIR` | Cache privado (0700) de páginas/capturas, retenção de 30 dias |
| `--xournal-helper /abs` | `MESA_XOURNAL_HELPER` | Helper de janelas; sem ele, captura recusa e PDF segue |
| `--max-image-bytes N` | `MESA_STUDY_MAX_IMAGE_BYTES` | Teto do PNG devolvido (padrão 8 MiB, faixa 4 KiB–32 MiB) |

O `.mcp.json` do repositório usa `env_vars` com **sete** variáveis: as quatro
acima e as três de perfis/checkpoint da seção “Perfis de tutoria e retomada”
(nomes repassados ao processo do servidor), e `cwd: "./"` — os dois pontos **a
validar no app**. O staging usa argumentos absolutos e não depende de env_vars;
o bloco standalone TOML também. Valores inválidos (JSON torto, caminho
relativo, teto fora da faixa) encerram a inicialização com `STARTUP_INVALID` —
o servidor não “cai no padrão” silenciosamente.

Nenhuma chamada de ferramenta escolhe raízes, cache ou executáveis: campos
extras são descartados pelo schema. Captura é **somente** a janela escolhida do
Xournal++ (nunca a tela inteira), revalidada antes e depois; erro nunca devolve
imagem antiga.

## O que está testado

| Camada | Evidência | Limite |
|---|---|---|
| Painel MCP Apps | `tests/ui-client.test.mjs` (DOM/ponte simulados) e `tests/ui-server*.test.mjs` (recurso e biblioteca reais) | não prova exibição no app nem captura real |
| Protocolo MCP stdio | `tests/mcp-*.test.mjs` (cliente SDK real, servidor em processo e como subprocesso) | não prova carregamento pelo host Codex |
| Renderização Poppler | testes com PDFs **sintéticos** (caminhos com espaços/Unicode, página inválida, PNG completo) | não prova leitura de material real nem exibição no app |
| Confinamento de raízes | testes de caminho fora da raiz, schema extra, cache 0700 | raízes são fixadas por quem inicia o servidor |
| Captura | helper **falso** sintético; revalidação e recusa de tela inteira | captura real exige macOS + permissão de Gravação de Tela (pendente) |
| Empacotamento | `tests/package-*.test.mjs`: manifesto + versão (prerelease = `package.json` = servidor), LICENSE cópia exata da raiz, paridade doctor × parser real do servidor, marketplace standalone do staging, limpeza por propriedade (FIFO/arquivo alheio), escapes/symlinks/sem sobrescrita | não prova ingestão do marketplace pelo app |
| Integração do staging | `tests/integration-stage.test.mjs`: `prepare-local` → `.mcp.json` gerado → servidor real via SDK → render e confinamento (Poppler sintético) | não prova o app; não envia imagem a modelo |

**Evidência anterior (0.1):** a CLI confirmou instalação e habilitação do
marketplace local; o usuário mostrou no app a transcrição e a solução corretas
do PDF sintético. Não inspecionamos a chamada MCP dessa conversa. Isso não
comprova a exibição da interface da versão 0.2.

**Pendências explícitas da interface:** carregar a versão 0.2 numa conversa
nova e confirmar o painel visível, navegação, contexto de ajuda e captura real
do Xournal++ com permissão do macOS. O `env_vars` + `cwd` relativo do catálogo
dev também continua sem validação no app; o staging usa caminhos absolutos.
O roteiro de teste manual está em `tests/manual-study.md`. Os testes de cliente
UI usam um hospedeiro simulado e não comprovam compatibilidade visual do Codex.

## Limites e segurança

- PDFs são somente leitura e só de caminhos dentro das raízes escolhidas.
- A imagem da ferramenta entra na conversa do modelo; não é uma prévia
  exclusivamente local. A skill avisa isso antes da primeira captura.
- O contexto ativo vive no processo. `--state-file` habilita um checkpoint
  opcional de PDF/página/anotação; ao reiniciar ele vira só candidato de retomada,
  nunca uma imagem ou página aberta automaticamente.
- O cache guarda páginas/capturas privadas (0700) com poda de 30 dias; nada é
  publicado.
- Sem inferência, autenticação, instalação global ou alteração do app nos testes.
- Publicação pública do caminho stdio não é suportada pela submissão oficial
  (exige MCP remoto HTTPS); este pacote é para uso local.

## Recursos e fontes

Gerados por este pacote: `scripts/doctor.mjs`, `scripts/prepare-local.mjs`,
`scripts/make-assets.mjs`, `.codex-plugin/plugin.json`, `.mcp.json` e
`codex-plugin/.agents/plugins/marketplace.json` (catálogo dev do repositório).
O staging gerado acrescenta `.agents/plugins/marketplace.json` (standalone,
`source: "./"`). Os PNGs de `assets/` são placeholders geométricos (rode
`make-assets.mjs --force` para regerar); a identidade visual final não faz parte
deste experimento. O `LICENSE` é cópia exata do LICENSE MIT da raiz do
repositório.

Documentação oficial usada (consultas de 2026-10-05 e 2026-10-06):

- [Package your plugin](https://developers.openai.com/plugins/build/plugins) —
  formato `.codex-plugin/plugin.json`, campos de `interface`, marketplace local,
  `mcpServers` e ausência de `$schema` no formato Codex.
- [Upload and submit your plugin](https://developers.openai.com/plugins/deploy/submission) —
  campos de manifesto, exigência de `composerIcon`/`logo` na validação de pacote
  e restrição de MCP stdio local na submissão pública.
- [Plugin management](https://developers.openai.com/codex/enterprise/plugin-management) —
  formato do marketplace e plugins com MCP marcados **Desktop only**.
- [MCP](https://developers.openai.com/codex/extend/mcp) e
  [Config reference](https://developers.openai.com/codex/config-file/config-reference) —
  campos stdio (`command`, `args`, `env`, `env_vars`, `cwd`) e política por
  `plugins.<plugin>.mcp_servers.<server>`.
- [Plugins (Agents API)](https://developers.openai.com/api/docs/guides/agents-api/tools/plugins) —
  `env_vars` para stdio em `.mcp.json` e `cwd` relativo à raiz do plugin.
- [Build skills](https://developers.openai.com/codex/build-skills) — menções
  com `$` no Codex (e não `/`).

- [Build a ChatGPT UI](https://developers.openai.com/plugins/build/chatgpt-ui) —
  recurso MCP Apps, ponte do hospedeiro e metadados de renderização. O contrato
  consultado não basta para comprovar exibição neste app Codex.

Pesquisa local e lacunas: `../../docs/reviews/mesa-codex-ui-api-20261006.md`,
`../../docs/reviews/mesa-codex-api-20261005.md` e
`../../docs/STATUS-MESA-CODEX-PLUGIN-2026-10-05.md`. Onde a documentação não
fecha — exemplo: `.mcp.json` stdio completo, ingestão do marketplace gerado e
exibição de imagem — o README e os testes marcam como **a validar no app**, sem
inventar contrato.

## Licença

MIT, como o restante do projeto — cópia exata em [`LICENSE`](LICENSE).


## Perfis de tutoria e retomada (opcionais)

O modelo e a conversa continuam no Codex. A skill `$mesa` e as instruções MCP
orientam o estudo; o plugin não inicia Pi nem substitui o system prompt do host.
`TUTOR.md`, `LEARNER.md`, materiais e histórico da Mesa Electron não são
importados automaticamente.

Na configuração de inicialização ou em `scripts/prepare-local.mjs`, escolha:

| Flag | Ambiente equivalente | Uso |
|---|---|---|
| `--tutor-file /caminho/TUTOR.md` | `MESA_STUDY_TUTOR_FILE` | Preferências de tutoria do arquivo regular escolhido. |
| `--learner-file /caminho/LEARNER.md` | `MESA_STUDY_LEARNER_FILE` | Preferências do aluno, escolhidas explicitamente. |
| `--state-file /caminho/cache/estudo.json` | `MESA_STUDY_STATE_FILE` | Checkpoint opcional, filho direto do cache privado configurado. |

Sem essas opções, nenhum perfil ou checkpoint é procurado/lido. Caminhos não
podem ser escolhidos por chamadas MCP. Cada perfil é UTF-8, limitado a 64 KiB,
revalidado ao consultar contexto; o status mostra disponibilidade sem o texto.
O texto só aparece em `mesa_context`. Alterações no arquivo escolhido podem
atualizar as preferências; mudança de caminho exige reconfiguração do servidor.

O checkpoint registra somente PDF/página/anotação e data. Não guarda imagens,
capturas, credenciais nem transcrição do chat. Após reiniciar, `$mesa retomar`
consulta o candidato e renderiza de novo com as raízes atuais. Abrir a Mesa
normalmente não abre o PDF salvo. Falha de gravação é reportada e não derruba
um render bem-sucedido; não afirmar que salvou quando `saved:false`.

Um arquivo de estado corresponde a **um espaço de estudo configurado**, sem
isolamento por conversa: processos que usam o mesmo arquivo compartilham o
checkpoint, e a última gravação bem-sucedida vence. Para espaços independentes,
use configurações/arquivos separados. O histórico continua pertencendo ao Codex.

## Manutenção do snapshot do host

A suíte normal verifica todos os hashes da cópia fixada em `host/SNAPSHOT.json`,
inclusive `capture.mjs` ajustado. O protótipo Claude pode evoluir separadamente.
Para uma migração deliberada do host, a comparação com a origem atual é opt-in:

```sh
MESA_VERIFY_SNAPSHOT_ORIGIN=1 node --test tests/mcp-parity.test.mjs
```

Essa comparação pode falhar quando a origem mudou depois do snapshot; não
ressincronize o projeto irmão nem altere os hashes para mascarar divergências.
