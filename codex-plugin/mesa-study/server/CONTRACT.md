# Contrato do servidor MCP `mesa-study-codex` (V0 experimental)

Servidor MCP stdio que expõe a Mesa de Estudos ao Codex **sem inferência**: ele
renderiza PDFs (Poppler real, confinado) e lista/captura a janela escolhida do
Xournal++ (helper declarado na inicialização). Este documento é o contrato que
o empacotamento pode citar; README/manifest do plugin são resolvidos pelo
agente pai.

## Entrada e exports

- Executável: `node server/main.mjs` (stdio MCP; stdout é só protocolo).
- `server/index.mjs` reexporta a superfície estável: `parseStartupConfig`,
  `usageText`, `createMcpServer`, `createToolHandlers`, `TOOL_DEFS`,
  `readBoundedPng`, `listXournalWindows`, `resolveHelperPath`,
  `createContextStore`, `MAX_PROFILE_BYTES`, `inspectProfilePathSync`,
  `readProfile`, `MAX_STATE_BYTES`, `STATE_KIND`, `STATE_VERSION`,
  `STATE_CONCURRENCY_NOTE`, `inspectStatePathSync`, `loadCheckpoint`,
  `saveCheckpoint`, `clearCheckpoint`, `evaluateCandidate`, `main`,
  `startStdio`, `isMainEntry`, constante
  `SERVER_NAME`/`SERVER_VERSION`, `HOST_SNAPSHOT` e limites.
- `createMcpServer({config, deps, log})` devolve `{server, handlers, toolNames}`;
  `deps` é só para injetar `run`/`nowMs`/`nowDate`/`isExecutable`/`poppler`/
  `screencapturePath`/`platform`/`pageTools` em testes. **Chamadas MCP nunca
  escolhem executáveis, raízes ou cache.**

## Configuração de inicialização (congelada)

| Flag | Ambiente | Efeito |
|---|---|---|
| `--root /abs` (repetível, até 64) | `MESA_STUDY_ROOTS` (JSON de caminhos) | Raízes autorizadas de PDFs. flag vence env de verdade: com `--root`, o env nem é lido (env malformado não derruba o startup); dedupe por realpath; raiz inexistente é pulada pelo host |
| `--cache-dir /abs` | `MESA_STUDY_CACHE_DIR` | Cache privado 0700 das páginas/capturas (retenção 30 dias herdada do host) |
| `--xournal-helper /abs` | `MESA_XOURNAL_HELPER` | Helper de janelas do Xournal++; **sem ele a captura recusa e o PDF continua** |
| `--max-image-bytes N` | `MESA_STUDY_MAX_IMAGE_BYTES` | Teto do PNG devolvido (padrão 8 MiB; faixa 4 KiB–32 MiB) |
| `--tutor-file /abs.md` | `MESA_STUDY_TUTOR_FILE` | Perfil de estudo TUTOR exposto por `mesa_context` (opcional; arquivo regular UTF-8 até 64 KiB; symlink/diretório/não-UTF8/acima do teto recusam `STARTUP_INVALID`) |
| `--learner-file /abs.md` | `MESA_STUDY_LEARNER_FILE` | Perfil de estudo LEARNER, mesmas regras do tutor (opcional) |
| `--state-file /abs/cache.json` | `MESA_STUDY_STATE_FILE` | Checkpoint opt-in de retomada; exige cacheDir e precisa ser filho DIRETO do cache, `.json`, até 64 KiB (opcional) |
| `--help` | — | Uso no **stderr**, exit 0 |

Sem `--root`: o servidor inicia, `mesa_status` mostra o setup e `mesa_page`
recusa com `ROOTS_NOT_CONFIGURED`. Entrada inválida: exit 2, uma linha JSON +
uso no stderr, sem abrir o protocolo. A raiz é congelada pelo caminho canônico;
quando ela ainda não existe, o congelamento antecipa o canônico do ancestral
existente mais próximo (ex.: `/tmp` → `/private/tmp` no macOS).

### Perfis de estudo (opt-in)

- `--tutor-file`/`--learner-file` (ou as envs) congelam o caminho CANÔNICO no
  startup; nenhuma chamada MCP escolhe arquivo de perfil e **diretório não é
  varrido**. No startup, leaf symlink, não-arquivo, acima de 64 KiB e conteúdo
  não-UTF8 recusam com `STARTUP_INVALID`; arquivo inexistente é aceito e aparece
  como indisponível (sem corpo) até existir.
- `mesa_status.studyProfile` mostra configurado/disponível/estado/erro SEM
  corpo: `{frozenAtStartup, maxBytes, files:{tutor:{configured, available,
  role, source, path, state, error}, learner:{...}}, guidance[]}`.
- `mesa_context` (get) expõe `studyProfile` com texto e metadados de origem SÓ
  dos arquivos autorizados: `{configured, available, role, source, path, state,
  error, bytes, sha256, updatedAt, text}`; papel não configurado devolve
  `configured:false` e `text:null`. Erro (troca por symlink, identidade
  diferente do canônico, teto, encoding) devolve `available:false`, `error`
  (`PROFILE_*`) e `text:null` — nunca corpo de outro alvo.
- A leitura relê o arquivo a cada `mesa_context`/`mesa_status` e revalida
  leaf regular e não-symlink, `realpath` igual ao canônico congelado, teto de
  bytes e UTF-8; troca depois do startup vira erro claro. O canônico congelado
  é conferido ANTES de ler o conteúdo e a leitura é limitada de verdade
  (descritor + `maxBytes+1`, com `O_NOFOLLOW` no leaf onde a plataforma tem a
  flag e dev+ino conferidos antes/depois): arquivo que cresce na corrida vira
  `oversize` e troca de identidade vira `changed`, ambos SEM corpo. Nenhum
  corpo de perfil entra em log ou em `mesa_status`.

### Checkpoint de retomada (opt-in)

- Só existe com `--state-file`/`MESA_STUDY_STATE_FILE`; **sem flag nada é
  gravado nem lido além do cache normal**. O caminho tem de ser filho DIRETO
  do cacheDir canônico e terminar em `.json`; fora/symlink/não-arquivo recusam
  `STARTUP_INVALID` no startup.
- Formato pequeno e fechado: `{version:1, kind:'mesa-study-resume', updatedAt,
  page:{path,page}|null, note|null}`. NUNCA guarda imagem, bytes de página,
  id/caminho de captura, snapshot ou histórico; campo extra recusa o arquivo
  inteiro (tamper não injeta nada).
- Gravação ATÔMICA: temporário exclusivo 0600 no mesmo diretório + fsync +
  rename; o checkpoint final fica 0600. Falha de persistência NÃO derruba a
  operação que deu certo e nunca é reportada como salva (`saved:false` +
  `error`; a `mesa_page` continua sucesso com a imagem). A leitura também é
  limitada de verdade (descritor + `maxBytes+1`, `O_NOFOLLOW` onde houver e
  dev+ino antes/depois); arquivo que cresce na corrida vira `oversize` e
  troca de identidade vira `changed`, sem corpo.
- Reinício/reabertura: `mesa_context` devolve `resumeCandidate` e NUNCA
  restaura `context.page`, imagem ou captura. `resumeCandidate` só é
  `available:true` se o caminho do documento, depois de NORMALIZADO
  (`path.resolve`) e de `realpath` resolvido, continuar dentro de uma raiz
  congelada válida, for arquivo regular não-symlink e `.pdf`; `..` textual e
  symlink de diretório que escapa da raiz devolvem `outside-roots` ANTES de
  qualquer `lstat` de caminho externo. `document.path`/`name` e a extensão
  saem do caminho resolvido. Senão devolve `available:false` com `reason`
  (`no-page`, `outside-roots`, `roots-changed`, `roots-missing`,
  `path-missing`, `path-invalid`, `not-pdf`). Retomar de verdade é um novo
  `mesa_page`/`mesa_open` com `filePath`, que refaz todas as checagens.
- Checkpoint corrompido/tampered/acima do teto é ignorado com erro claro
  (`resumeCandidate.state` + `error` `STATE_*`) e sem imagem de fallback.
- `mesa_context action=clear` remove SÓ o checkpoint, explicitamente, sem
  tocar nos outros arquivos do cache; `action=set` grava nota + página ativa
  (ou a página do candidato válido, quando este processo ainda não renderizou)
  e reporta `saved`/`cleared` honestamente. Um render explícito do MESMO
  documento+página, em processo novo sem nota ativa, preserva a nota que o
  checkpoint já guardava; outro documento/página NÃO herda a nota antiga (a
  nota persistida não vira nota ativa, não restaura imagem/captura e
  `action=clear` continua apagando o checkpoint inteiro).
- Com `cacheDir` indisponível agora (symlink, arquivo, dono/modo errados),
  o checkpoint NÃO é lido: `mesa_status.persistence` e o
  `resumeCandidate`/`persistence` de `mesa_context` reportam
  `state:'cache-unavailable'` com `STATE_CACHE_UNAVAILABLE` e sem candidato
  retomável; um `action=set`/`clear` falha honestamente
  (`saved:false`/`cleared:false` + erro do cache) sem mentir sucesso.
- **Concorrência (honesta):** um `--state-file` é UM espaço de estudo
  explícito, não uma sessão: pode ser compartilhado por processos do host e
  não tem isolamento por conversa/thread. Sem locks, a última gravação
  bem-sucedida vence; a leitura sempre revalida.

`mesa_status.persistence` diagnostica o checkpoint sem corpo:
`{configured, source, path, available, state, checkpoint:{present, savedAt,
page, document, noteBytes, resumable, reason}, error, operation?,
concurrency}`.

## Status: configurado × disponível

`mesa_status` distingue o que o startup aceitou (`configured`) do que é
verificável agora (`available`), sempre com checagens somente leitura — o
status não cria o cache, não toca as raízes e não executa nada:

- raízes: `available` quando ao menos uma raiz ainda resolve para o canônico
  congelado no startup e é diretório; `checks` conta
  válidas/ausentes/trocadas/não-diretório;
- cacheDir: `available` quando o caminho é diretório real do próprio usuário
  sem escrita por grupo/outros, ou quando ainda não existe e o ancestral
  existente mais próximo é diretório gravável (`state:
  'absent-creatable'`; o host cria 0700 no primeiro uso). Symlink, arquivo,
  dono/modo errados e falhas de IO aparecem como indisponíveis;
- helper: `available` exige arquivo executável agora; `ready.capture` exige
  também macOS (`darwin`) e `screencapture` executável, além do cache
  disponível;
- `ready.{pdf,windows,capture}` significam "pode funcionar agora"; falha de
  verificação nunca vira `ready:true`.

## Ferramentas

| Ferramenta | Entrada | Saída | `readOnlyHint` |
|---|---|---|---|
| `mesa_status` | — | setup/capacidades/limites/guia + `studyProfile`/`persistence` sem corpo | `true` |
| `mesa_open` | `{filePath?, page?}` | bloco `image/png` (só com `filePath`) + texto/`structuredContent` do desk | `false` (pode escrever cache/estado) |
| `mesa_library` | — | `{ok,kind:'library',files,truncated}` | `true` |
| `mesa_page` | `{filePath, page}` | bloco `image/png` + texto com metadados | `false` (escreve cache/estado) |
| `mesa_windows` | — | janelas do Xournal++ (sem capturar) | `true` |
| `mesa_capture` | `{windowId}` | bloco `image/png` + metadados da janela | `false` (escreve cache/estado) |
| `mesa_context` | `{action?, note?}` | estado pequeno da sessão + `studyProfile` (texto só dos arquivos autorizados) + `resumeCandidate`/`persistence` | `false` (pode mutar estado) |

São SETE ferramentas no total; as cinco anteriores continuam iguais. Só
`mesa_open` é render tool (declara o recurso MCP Apps em `_meta`); `mesa_page`
continua uma operação de dados e nenhuma outra ferramenta declara template de
UI. `mesa_open` sem `filePath` abre o painel com o status e a biblioteca e NÃO
lê PDF nenhum; com `filePath`, usa o MESMO handler da `mesa_page` (mesmas
checagens, mesmo cache, mesmo estado) e devolve o PNG completo. Falha nunca
devolve imagem antiga: o erro sai sem bloco `image/png` e sem
`structuredContent`.

Sucesso: `content` = [imagem opcional, `{type:'text', text: <meta JSON>}`] e
`structuredContent` = meta. Erro: `isError:true` com um bloco text contendo
`{ok:false,error:{code,message,detail?}}` (sem `structuredContent`).

Formato do `mesa_open` (render tool): `structuredContent` =
`{ok:true, kind:'desk', status:<meta de mesa_status>, library:{files:[{filePath,
name}], truncated:boolean}, page:<meta de mesa_page|null>}`. Sem `filePath`,
`page` é `null` e a `library` pode vir vazia com o motivo no `status`
(raízes ausentes/trocadas não derrubam o painel). `page` sem `filePath` é
recusado com `OPEN_INVALID`.

Códigos novos do servidor: `ROOTS_NOT_CONFIGURED`, `CACHE_DIR_NOT_CONFIGURED`,
`CONTEXT_INVALID`, `IMAGE_TOO_LARGE`, `STARTUP_INVALID`, `ROOT_CHANGED`,
`ROOT_NOT_DIRECTORY`, `OPEN_INVALID`, `UI_RESOURCE_MISSING`,
`UI_RESOURCE_INVALID`, `UI_RESOURCE_TOO_LARGE`; perfis usam `PROFILE_SYMLINK`,
`PROFILE_NOT_FILE`, `PROFILE_OVERSIZE`, `PROFILE_ENCODING`, `PROFILE_CHANGED`,
`PROFILE_IO`, `PROFILE_MISSING`; checkpoint usa `STATE_INVALID`,
`STATE_OVERSIZE`, `STATE_SYMLINK`, `STATE_NOT_FILE`, `STATE_OUTSIDE`,
`STATE_NOT_JSON`, `STATE_CHANGED`, `STATE_IO`, `STATE_WRITE_FAILED`,
`STATE_TOO_LARGE`, `STATE_CACHE_SYMLINK`, `STATE_CACHE_NOT_DIRECTORY` e
`STATE_CACHE_UNAVAILABLE` (os dois primeiros vêm da recusa do cacheDir em
`saveCheckpoint`/`clearCheckpoint`; o último do diagnóstico/gate de cache em
`mesa_status`/`mesa_context`). O resto vem do host snapshot
(`PATH_OUTSIDE_ROOTS`, `PATH_NOT_FOUND`, `NOT_PDF_EXTENSION`, `PAGE_OUT_OF_RANGE`,
`TOOL_MISSING`, `CAPTURE_*`, `PDF_*`...). Schema inválido é recusado pelo SDK
("Invalid arguments") sem derrubar a sessão.

## Painel MCP Apps (experimental)

- Recurso único: URI `ui://mesa-study/desk-v1.html`, MIME
  `text/html;profile=mcp-app`, conteúdo lido de `ui/desk.html` no momento do
  `resources/read` (nunca no startup). HTML 100% inline (CSS/JS no próprio
  arquivo), sem CDN/rede, sem iframe e sem `import`/`require`.
- `_meta` do conteúdo: `{ui:{prefersBorder:true, csp:{connectDomains:[],
  resourceDomains:[]}}}` — painel sem rede; o CSP declarado é o default
  restritivo com zero domínios extras.
- `mesa_open` declara o recurso nos dois formatos: `_meta.ui.resourceUri`
  (padrão MCP Apps) e o alias `openai/outputTemplate` (documentado na
  referência de plugins da OpenAI). Não há metadados OpenAI-only além desse
  alias (nada de `openai/ui`, domínios ou modos de exibição inventados).
- `visibility` explícita `['model','app']` em `mesa_open`; o host sem suporte a
  MCP Apps trata a ferramenta como tool comum e recebe imagem + metadados no
  `content` (fallback textual/imagem preservado).
- HTML ausente/inválido/acima do teto não derruba a sessão: as sete
  ferramentas continuam funcionando e o `resources/read` falha com erro claro
  (`UI_RESOURCE_*`).
- A ponte `ui/initialize` → `ui/notifications/initialized`, `tools/call` e
  `ui/message` (content em ARRAY) vive no HTML e é coberta por simulador de
  host em `tests/ui-client.test.mjs`; ela NÃO foi validada no app Codex real.

## Invariantes de segurança

- Raízes/cache/executáveis fixados na inicialização; campos extras no pedido
  são descartados pelo schema (testado com `roots`, `cacheDir`, `helperPath`,
  `confirm`).
- A raiz congelada é uma IDENTIDADE, não só uma string: antes de cada
  `mesa_page`, só raízes cujo `realpath` ATUAL é exatamente o canônico
  congelado no startup e que continuam diretório são repassadas ao host. Raiz
  trocada por symlink para outro alvo falha `ROOT_CHANGED` (nunca autoriza o
  alvo novo); raiz que virou arquivo falha `ROOT_NOT_DIRECTORY`; raiz ausente
  é pulada, como no host (`ROOT_NOT_FOUND` só quando nenhuma resolve). Raiz
  que já era symlink no startup é resolvida ao canônico e segue valendo.
- Confinamento por realpath no host: symlink que escapa da raiz é recusado.
- Captura: `windowId` obrigatório, seleção/revalidação antes e depois,
  `screencapture -x -o -lID` (nunca tela inteira), erro sem imagem antiga.
- A proveniência da captura registra a instrução e a origem REAL da imagem
  (captura atual da janela revalidada); o servidor NÃO verifica consentimento
  e não existe parâmetro booleano que finja essa verificação — aprovação de
  chamada, quando existir, é do cliente/app hospedeiro.
- `mesa_context` guarda a última captura BEM-SUCEDIDA; falha não substitui a
  anterior nem devolve imagem antiga.
- PNG lido só dentro do cache privado; acima do teto → `IMAGE_TOO_LARGE` sem
  truncar (arquivo completo permanece). O teto é reconferido também DEPOIS da
  leitura: se o arquivo crescer entre o `stat` e o `readFile`, a resposta é
  `IMAGE_TOO_LARGE` — nenhum byte acima do teto é devolvido.
- `mesa_library` (e a `library` do `mesa_open`) varre SÓ as raízes já
  validadas pela identidade congelada, em FLUXO (`opendir` + leitura de
  entrada a entrada), com tetos explícitos que limitam o IO (200 arquivos,
  4000 entradas examinadas — a sonda de fim de cada fluxo pode ler uma a mais
  para saber se o diretório acabou — e 6 níveis) e cada fluxo de diretório é
  fechado sempre (fim natural, teto ou erro). A lista devolvida é ordenada (nome e caminho);
  quando `truncated:true`, o SUBCONJUNTO veio da ordem de enumeração do
  sistema de arquivos — a varredura não promete “os N primeiros em ordem
  alfabética” (isso exigiria ler o universo inteiro). `truncated:true` também
  quando uma raiz configurada foi PULADA (ausente, trocada ou arquivo) e
  outra continua válida: a `library` devolve o subconjunto alcançável; sem
  nenhuma raiz válida, `mesa_library` recusa (ROOT_CHANGED /
  ROOT_NOT_DIRECTORY / ROOT_NOT_FOUND) e o `mesa_open` sem `filePath` abre com
  biblioteca vazia e o motivo no status. Entradas ocultas (prefixo `.`),
  internas (`_`) e symlinks ficam fora; cada diretório é revalidado por lstat
  antes e depois de abrir (dev+ino) e entradas candidatas são revalidadas por
  lstat + realpath DENTRO da raiz congelada antes de entrar na lista; a
  identidade da raiz é reconferida até o retorno e, se mudou no meio, os
  arquivos dela são descartados. A listagem não abre nem lê o conteúdo dos
  PDFs.
- TOCTOU residual (honesto): o Node portátil não tem `openat`/`O_NOFOLLOW`
  relativo a descritor de diretório, então uma troca de caminho depois que a
  entrada foi aceita pode fazer o caminho devolvido apontar para outro lugar.
  Garantia efetiva: nenhum caminho listado resolvia para fora da raiz no
  momento da aceitação, trocas comuns (lstat→abertura, mudança de tipo,
  raiz trocada no meio) são detectadas e/ou descartadas com `truncated:true`, e
  o consumo posterior (`mesa_page`) revalida o realpath contra as raízes
  congeladas de novo. A identidade congelada é o caminho CANÔNICO: o startup
  não guarda dev/ino, então um diretório substituído no mesmo caminho entre o
  startup e a varredura é tratado como a raiz (por desenho); a revalidação de
  dev+ino cobre mudanças DURANTE a varredura. O confinamento por realpath do
  PNG no cache não captura troca por outro arquivo já dentro do cache entre a
  checagem e a leitura (herdado do host), mas o teto de bytes é revalidado no
  conteúdo lido.
- Perfis e checkpoint usam leitura LIMITADA por descritor
  (`server/bounded.mjs`): no máximo `maxBytes+1` bytes são lidos,
  `O_NOFOLLOW` recusa symlink de leaf onde a plataforma expõe a flag e
  dev+ino (lstat → fstat pós-open → lstat final) precisam bater; troca de
  identidade vira `changed` e crescimento vira `oversize` sem devolver corpo.
  Em perfis, o canônico congelado é conferido ANTES de ler o conteúdo. A
  garantia honesta continua limitada pelo Node portátil: não há `openat`
  relativo a descritor de diretório, então uma corrida adversarial completa de
  TOCTOU não é prometida além do que as revalidações acima cobrem.
- `resumeCandidate` confina em duas etapas antes de classificar: primeiro o
  caminho normalizado (`path.resolve`) contra as raízes congeladas válidas e,
  depois, o `realpath` resolvido; `..` textual e symlink de diretório que
  escapa da raiz saem como `outside-roots` sem `lstat` de caminho externo.
- `mesa_context` é memória do processo; fora do cache do host, a ÚNICA
  gravação durável possível é o checkpoint opt-in, e ele nunca contém imagem,
  captura ou histórico (só `page.path`/`page.page`/`note`/`updatedAt`).
- Nenhuma ferramenta chama modelo, inicia inferência ou abre navegação; logs no
  stderr são genéricos (sem caminho/conteúdo de PDF); processos usam argv sem
  shell (`host/proc.mjs`, único a tocar `child_process`).

## Snapshot do host

`host/` é cópia byte a byte de `claude-mod/mesa-study/host` com hashes em
`host/SNAPSHOT.json`; `host/capture.mjs` é o único ajustado (default do helper
declarado na inicialização, sem `../../../visual-check/windows`). Os testes de
paridade conferem hash, diff mínimo e comportamento das funções puras. A origem
não é editada.

## Limites de verificação (honestos)

- Testado: protocolo MCP real sobre stdio com o SDK oficial e processo filho
  real; Poppler real com PDFs sintéticos (inclusive caminho com espaços e
  não-ASCII); captura **simulada** com `run` injetado (a tela real nunca é
  tocada) e erros de seleção com helper falso; status somente leitura
  (configurado × disponível, sem criar o cache); identidade congelada das
  raízes (troca por symlink depois do startup, raiz-arquivo, ausente que vira
  link ou pasta real); confinamento do PNG ao cache (inclusive arquivo que
  cresce entre stat e leitura, sem devolver bytes acima do teto); leitura
  limitada de perfis/checkpoint com IO injetado (troca de identidade antes/depois
  da abertura vira `changed`, crescimento vira `oversize`, canônico de perfil
  conferido antes do conteúdo) e candidato de retomada com `..` textual/symlink
  de diretório fora da raiz (nunca `available`, sem lstat externo, `mesa_page`
  do mesmo caminho recusa); cacheDir inseguro não lê checkpoint nem forma
  candidato; nota preservada na retomada do mesmo documento+página; mesa_open
  (com e sem filePath, teto de imagem, falha sem imagem antiga) e mesa_library
  (varredura em fluxo com tetos de IO, fluxo fechado em teto/erro, entradas
  candidatas revalidadas por lstat+realpath, raiz trocada no meio da varredura
  sem listar o alvo, mix de raiz válida com raiz pulada marcando
  `truncated`, symlinks/ocultos e recusa sem raiz válida) inclusive no pacote
  preparado por `scripts/prepare-local.mjs`; `resources/read` do painel com
  URI/MIME/`_meta`.

- Resíduo não coberto por teste local: corridas adversariais completas de
  TOCTOU (o Node portátil não expõe `openat`/`O_NOFOLLOW` por descritor); o que
  se garante é o descrito em “Invariantes de segurança” — sem caminho externo
  listado no momento da aceitação e trocas comuns detectadas/truncadas.
- Testado COM SIMULADOR (não é o app): a ponte interna do painel
  (`ui/initialize`, `tools/call`, `ui/message` com content em array, teardown,
  tamanho, tema) em `tests/ui-client.test.mjs`, rodando o HTML real em
  `node:vm` com DOM e `postMessage` de mentira. Isso NÃO comprova a exibição
  no Codex.
- Não testado aqui: carregamento do plugin no app Codex e exibição do painel
  no app real (`data:` para o PNG, painel à direita, modos de exibição),
  permissão real de Gravação de Tela, execução do helper real
  `visual-check/windows` e captura real do desktop. Empacotamento/manifest
  ficam para o agente pai.
