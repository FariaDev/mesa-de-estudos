# Mesa no Codex — revisão independente das correções R1–R6 (2026-10-06)

Revisão **independente e somente leitura** das correções da rodada `host-r6`
(servidor/biblioteca/PNG) e `ui-r6` (painel/ponte), escritas pelo agente de
implementação em Pi Mesa Dev (Command Code, `deepseek-v4.1-flash`, thinking max,
full-access). **Nenhum uso de opencode-go**, nenhuma delegação a ele.

O que **não** foi feito:

- Nenhuma linha de implementação alterada; o único arquivo escrito é este
  relatório. Nenhuma regeneração de artefato, nenhum `git reset/checkout/clean/
  commit/push`; o checkout sujo preexistente foi preservado (scripts de
  reprodução e logs só em `/tmp`, fora do repositório).
- Nenhum app real (Codex/Xournal++) aberto, instalado, reiniciado ou carregado;
  nenhuma credencial/sessão/configuração pessoal lida; nenhum material de curso;
  somente PDFs sintéticos e a ponte simulada de teste.
- Nada de `desk/`, `core/`, `chat/`, `claude-mod/` ou `visual-check/` foi
  tocado. `npm test` do pacote rodou duas vezes (tempo total ~6 s cada), só com
  diretórios temporários.
- **Nenhum native browser / app install / chamada de modelo / rede** nesta
  revisão (a única consulta de rede relevante já estava feita: os arquivos
  oficiais do `ext-apps` estavam em `/tmp` e foram reconferidos por sha256).

Fontes de contrato: `AGENTS.md` (raiz), `codex-plugin/AGENTS.md`,
`docs/reviews/mesa-codex-ui-api-20261006.md`,
`docs/reviews/mesa-codex-ui-review-20261006.md` (R1–R7),
`docs/reviews/mesa-codex-ui-capabilities-20261006.md`,
`codex-plugin/mesa-study/server/CONTRACT.md`, README/skill do pacote e o
código/testes listados abaixo.

---

## 0. Snapshot revisado (âncora temporal)

- Momento da verificação: **2026-10-06, 19:33–19:37 -03**. Suíte completa do
  pacote executada duas vezes: **140/140 passando, 0 falhas, 0 skipped**
  (`npm test` → `node --test tests/*.test.mjs`), com **Poppler real presente**
  (`/opt/homebrew/bin/pdftocairo`, `/opt/homebrew/bin/pdfinfo`), portanto os
  testes de renderização real rodaram, não pularam. Log:
  `/tmp/mesa-fixes-review-tests-20261006.log`.
- Contagem por arquivo (confere com a alegação da rodada): ui-client **40**,
  ui-server-library **15**, ui-server **7**, mcp-guards **11**, mcp-parity 8,
  mcp-stdio 8, mcp-poppler 3, mcp-capture 5, package-manifest 9,
  package-doctor 15, package-doctor-startup-parity 5, package-prepare-local 13,
  integration-stage 1 ⇒ 140.
- Hashes (sha256) dos arquivos-chave desta rodada, **idênticos no início e no
  fim da revisão** (nenhuma edição concorrente durante o meu trabalho):

| Arquivo | sha256 |
|---|---|
| `server/library.mjs` | `e1c9fe64cfcfe644b403f58ba99e258f8412bc9876e84532f29eff8bd12c954e` |
| `server/tools.mjs` | `de551b07ab12d433411c5b69aac994381782e02ba3a5be514e9e2e6f6ea8a945` |
| `server/png.mjs` | `80c740a973e525fcf8982001c1f77a62545a2cfda627cb1da4aa54fc37e34ae1` |
| `server/checks.mjs` | `a9565c854935abbb893e47de1bfabde2b9bdc16e73fab1e740006a3849e243fe` |
| `server/server.mjs` | `9a07cfb26d1c04b70da96fb05d500f8a09ec926a951251c8b9a47eb5020a5c58` |
| `server/ui.mjs` | `c64cd2c7e21a37690e41efb765c687c2bd7e66cc5a5b2eafad4b18757bad0d3c` |
| `ui/desk.html` | `db6505fd838d60606925b884d301bd49b24b9dad3b0a3f78a7ebed111734cfb6` |
| `tests/ui-client.test.mjs` | `ea0c9c3295b7f2bdd45dab41a9c98a7fcf1e3c5ce80eb9eea5e781457dc03c81` |
| `tests/ui-server-library.test.mjs` | `e5c75f19a46c122015fcf5a064505412b1ae4c986e532581ed8deb6c850c4c48` |
| `tests/mcp-guards.test.mjs` | `75972f9ef3eb128c6fe2f3680ad045ea0b90442ddc83b5543201a4360a206516` |
| `tests/ui-server.test.mjs` | `ecf6acfae54d13276dff9a4e643468487c6c534d2c9693d7a629e1a70821edc6` |

- **Concorrência `ui-r6`**: `ui/desk.html` = `db6505fd…` e
  `tests/ui-client.test.mjs` = `ea0c9c32…` são exatamente os hashes pós-edição
  declarados por `docs/reviews/mesa-codex-ui-capabilities-20261006.md` no fim
  da rodada de UI (log `[mesa] hostCapabilities`, 40 testes). A rodada `ui-r6`
  está, portanto, concluída e congelada; não houve edição posterior durante
  esta revisão. O lado servidor (`library.mjs`/`tools.mjs`/`png.mjs` e os testes
  de biblioteca/guards) é o pós-`host-r6`, com hashes diferentes do snapshot da
  revisão anterior — esperado, foram as correções.

---

## 1. R1 — TOCTOU `lstat → readdir` da biblioteca

**Status: corrigido no nível alegado, com resíduo portátil documentado.**
Não reabro o achado.

Código (`server/library.mjs`, hash `e1c9fe64…`):

- a varredura agora usa **`opendir` + `read` em fluxo** (nada de `readdir`
  integral antes do teto);
- cada diretório é revalidado com `lstat` **antes e depois** de abrir, exigindo
  `dev+ino` idênticos (`sameIdentity`) e negando symlink/não-diretório
  (`walk`, linhas ~185–225);
- o `realpath` do diretório aberto precisa cair **dentro da raiz congelada**;
- cada entrada candidata a PDF passa por `lstat` + `realpath` **na aceitação**
  (`acceptFile`), recusando symlink, tipo trocado e caminho fora da raiz;
- a identidade de cada raiz é reconferida **até o retorno** e, se mudou, os
  arquivos daquela raiz são descartados (`dropFrom(markBefore)`) com
  `truncated:true`.

Reproduções independentes (`/tmp/mesa-fixes-review-repro-20261006.mjs`, usa a
API real `listLibraryPdfs` com o hook atual `openDir`):

```
R1a lstat->opendir: files=[] truncated=true visited=0
R1b read-race:      files=[] truncated=true escaped=[]
```

- **R1a** troca a raiz por symlink para fora **entre o `lstat` e o `opendir`**
  (cenário do hook antigo `listDir`): a revalidação pós-abertura recusa antes
  de ler; zero arquivos, `truncated:true`.
- **R1b** troca a raiz por symlink **na primeira leitura do fluxo** (a janela
  exata do achado R1: entradas passam a vir do diretório externo): todos os
  caminhos montados sob a raiz resolvem para fora e são descartados por
  `lstat+realpath`; zero arquivos, `truncated:true`, nenhum caminho escapado.

**Nota de evidência (sem culpa)**: o script antigo
`/tmp/mesa-review-race-demo.mjs` injetava um hook chamado `listDir`, que a nova
implementação não usa mais — reexecutá-lo hoje não testa a janela (o hook é
ignorado e a varredura usa `opendir` real). A reprodução acima cobre os mesmos
cenários com o hook vigente. O script multi-raiz antigo
(`/tmp/mesa-review-truncated-multiroot.mjs`) continua executável e é o R3 abaixo.

**Resíduo honesto** (mantido, aceito): o Node portátil não expõe
`openat`/`O_NOFOLLOW` por descritor de diretório; uma troca de caminho **depois**
da aceitação pode fazer o caminho devolvido apontar para outro lugar. Isso está
declarado no cabeçalho de `library.mjs` e em `server/CONTRACT.md`
(“TOCTOU residual (honesto)”), e o consumo posterior (`mesa_page`) revalida o
realpath contra as raízes congeladas. Não é exigível provar contra um adversário
local correndo infinitamente contra o filesystem; o que a correção garante —
nenhum caminho fora da raiz no momento da aceitação e trocas comuns
detectadas/truncadas — foi verificado.

---

## 2. R2 — `readdir` integral antes do teto; IO não limitado

**Status: corrigido.** A alegação agora é precisa: o teto limita o **IO da
varredura**, não o universo do filesystem.

Reprodução independente (mesmo script, diretório real com 3000 entradas
`.txt`, `maxEntries: 10`):

```
R2 3000 entradas: visited=10 reads=11 closes=1 truncated=true files=0
```

- `visited = 10` (teto), `reads = 11` (teto + **uma** sonda de fim), `closes = 1`
  — o diretório **não** é enumerado inteiro e o fluxo é fechado sempre;
- a sonda extra é **por fluxo ativo**; com a profundidade máxima 6 (+ a raiz),
  o custo pós-orçamento é limitado a uma leitura por nível ativo (≤ 7), não
  uma varredura; o teste `varredura para no teto sem ler o diretório inteiro e
  fecha o fluxo` pina `reads <= 11` e `closes == 1`;
- “claimed 4000, não FS inteiro”: o teto de entradas examinadas (4000) corta a
  leitura; `maxDepth = 6` e `maxFiles = 200` continuam pinados por teste
  (`LIBRARY_LIMITS` deepEqual);
- quando `truncated:true`, a lista devolvida é **subconjunto da ordem de
  enumeração**, não “os N primeiros em ordem alfabética”; só a lista devolvida
  é ordenada (nome e, no empate, caminho; comparação binária). Isso está
  declarado no cabeçalho de `library.mjs`, no `CONTRACT.md` e na descrição de
  `mesa_library` — sem promessa que exija ler o universo inteiro;
- `grep`: nenhum `readdir` no caminho da biblioteca; o único `readdir` restante
  é `host/output.mjs:149` (poda do cache, herdada do snapshot do host — fora do
  escopo deste achado).

---

## 3. R3 — `mesa_library` com raiz pulada devolvia `truncated:false`

**Status: corrigido.**

- `server/tools.mjs#library` agora computa `inspectRoots` e devolve
  `truncated: found.truncated || skipped > 0`, onde `skipped` conta raízes
  ausentes + trocadas + não-diretório. Sem raiz válida, mantém a recusa
  específica (`ROOT_CHANGED` / `ROOT_NOT_DIRECTORY` / `ROOT_NOT_FOUND`).
- `librarySnapshot` (a `library` do `mesa_open`) aplica a mesma regra quando há
  ao menos uma raiz válida.

Reprodução com o **script exato da revisão anterior**
(`/tmp/mesa-review-truncated-multiroot.mjs`, raiz válida + raiz trocada por
symlink depois do startup, via protocolo MCP real):

```
mesa_library: {"ok":true,"kind":"library",
  "files":[{"filePath":"…/valida/ok.pdf","name":"ok.pdf"}],
  "truncated":true}                        ← antes: truncated:false
status roots checks: {"valid":1,"missing":0,"changed":1,"notDirectory":0} available:true
```

Também confirmei no repro próprio (`/tmp/mesa-fixes-review-repro-…`): mix
válida+trocada ⇒ `truncated:true`; **todas** trocadas ⇒ `library` lança
`ROOT_CHANGED` (não devolve lista vazia “completa”). O teste
`mesa_library/mesa_open: raiz válida + raiz pulada marca truncated na
biblioteca` cobre os três estados (múltiplas raízes) dentro da suíte.

**Observação residual (baixa, não bloqueante, já pinada por teste):** no
`mesa_open` **sem** nenhuma raiz válida, `library` sai `{files:[],truncated:
false}` com o motivo em `status.setup.roots.checks` — escolha deliberada
(“raízes ausentes/trocadas não derrubam o painel; o status explica”) e
testada (`…/mesa_open: raiz válida + raiz pulada…`, trecho “Todas as raízes
ausentes”). Diferente do `mesa_library`, que recusa. Consistente o suficiente
para o painel (o status está no mesmo `structuredContent`); fica registrado
como decisão, não como defeito.

---

## 4. R4 — `hostCapabilities.message.text` / `updateModelContext.structuredContent`

**Status: resolvido como questão de fonte; compatibilidade do Codex real
continua pendente (não é possível fechar por teste local).** A objeção anterior
(“o relatório não tinha fonte; não estabelece bug”) está endereçada.

- A rodada `ui-r6` consultou o repositório oficial `modelcontextprotocol/
  ext-apps` (schema executável, revisão 2026-01-26) e documentou arquivo,
  linha e sha256 em `docs/reviews/mesa-codex-ui-capabilities-20261006.md`.
  **Reconferi os artefatos em `/tmp`**: `ext-apps-spec-types.ts`,
  `ext-apps-schema.ts`, `ext-apps-app.ts` e `ext-apps-spec-check.mdx` têm
  exatamente os sha256 da tabela do documento
  (`f46212be…`, `678f11a9…`, `1f631679…`, `ee452a7d…`), inclusive as cópias
  “check” baixadas depois. As linhas citadas conferem: em `spec.types.ts`,
  `McpUiSupportedContentBlockModalities` com `text?: {}` (l. 464) e
  `structuredContent?: {}` (l. 474), e `McpUiHostCapabilities` com
  `updateModelContext?` (l. 521) e `message?` (l. 523); em `generated/schema.ts`,
  `text` (l. 453), `updateModelContext` (l. 558) e `message` (l. 563).
- Os gates do painel (`ui/desk.html`, hash `db6505fd…`) seguem o schema:
  `messageCapabilityOff()` desliga quando `message` existe sem `text`
  (ausência = não declarado); `updateModelContext` só envia com
  `structuredContent`; `hostCapabilities` nulo/ausente ⇒ **tenta** o
  `ui/message` e mostra a recusa real da ponte (fallback honesto). A API do
  `App` só verifica o handshake — o feature detect é do View, como o painel faz.
- Testes que pinam: `capabilities (schema ext-apps 2026-01-26)…`,
  `capabilities: host sem hostCapabilities tenta e mostra a recusa real`,
  `ajuda: capability ausente…`, `diagnóstico: handshake registra
  hostCapabilities cru no console do host` — todos passam.
- **Reconfirmado**: `ui/message` continua com `content` em **array**
  (`content: [{type:'text', text: helpMessage()}]` no `askHelp`; teste
  `pedir ajuda: ui/message com referências e sem imagem` e o teste de caps nulo
  assertam `Array.isArray(content)`); época/`opToken` e o aviso de “nova
  captura” seguem intactos (§7).

Pendente (inalterado): registrar o **JSON cru** de `hostCapabilities` no app
Codex. O painel imprime uma linha `[mesa] hostCapabilities {…}` no console do
host depois do handshake exatamente para isso; sem esse registro, a
compatibilidade real continua **não validada**. Não há garantia de que o Codex
anuncie o schema.

---

## 5. R5 — teto do PNG não reconferido após a leitura

**Status: corrigido.**

- `server/png.mjs` (hash `80c740a9…`) checa `stat.size > maxBytes` **e**
  reconfere `bytes.length > maxBytes` **depois** do `readFile`, com
  `IMAGE_TOO_LARGE` e detalhe do tamanho lido; nada é truncado e nenhum byte
  acima do teto é devolvido.
- Reprodução independente (arquivo cresce entre `stat` e `read` via hook
  `readFile`): `code=IMAGE_TOO_LARGE bytes=5632 limit=4096 grew=true`.
- Teste que pina: `PNG: arquivo que cresce entre o stat e a leitura não devolve
  bytes acima do teto` (mcp-guards, injeta o crescimento e confere
  `error.detail.bytes/limit`).
- Resíduo herdado e documentado no cabeçalho do `png.mjs` e no `CONTRACT.md`:
  a checagem de realpath do cache e a leitura são duas operações; um arquivo
  trocado por outro **já dentro do cache** entre a checagem e a leitura pode
  ser lido — o teto de bytes, porém, vale para o conteúdo lido. Exige escrita
  concorrente no cache privado (0700); aceito como risco residual.

---

## 6. R6 — `size-changed` podia sair antes do handshake

**Status: corrigido.**

- `ui/desk.html` (hash `db6505fd…`): `measure()` retorna sem enviar enquanto
  `state.initialized !== true` e **não grava** `lastSizeSent` na medida
  pré-handshake; `reportInitialSize()` é chamado **depois** de
  `notify('ui/notifications/initialized', {})` e mede o layout **atual**; o
  dedupe por medida continua valendo depois, e o teardown continua parando
  tudo.
- Testes que pinam: `size-changed nunca sai antes do handshake; o inicial sai
  depois de initialized` (handshake atrasado + timer + observer ⇒ zero avisos;
  após a resposta, `initialized` vem antes e o primeiro `size-changed` sai uma
  única vez), `medida pré-handshake não conta como enviada…` (layout muda para
  512×861 antes do fim; o único aviso usa a medida atual) e os testes de
  dedupe/teardown/teto de altura existentes. Todos passam.
- O teste antigo de dedupe/tamanho foi preservado; `ui-client` subiu de 35
  para 40 com os casos de R4/R6.

---

## 7. Objeções anteriores — fechamento explícito

- **Comentário do `closeStream`** (`library.mjs`): o `catch` registra que a
  falha de `close` não é reportada porque o fluxo já está inutilizável e o
  handle é liberado pelo GC; o que se garante é que o `close` foi **tentado
  sempre** (`finally`). Verifiquei o comportamento: não há cenário em que uma
  falha de close **engula** truncamento — quando o `close` falha no fim
  natural, a listagem já foi lida por completo (`truncated:false` é honesto);
  quando a saída foi antecipada por teto/erro/depth, `truncated` já é `true`.
  O teste `falha de leitura no close não derruba a varredura nem engole
  truncated` pina exatamente isso. Não inventei cenário adversário adicional.
- **Contagem de testes não é prova de carga do app nem de captura real**:
  confirmado e mantido. Os 140 testes cobrem protocolo MCP real (SDK oficial,
  in-memory e stdio), Poppler real com PDFs sintéticos, staging real e a
  **ponte simulada** em `node:vm`. Nada disso prova: painel renderizado dentro
  do Codex, `data:image/png` no iframe hospedado, `hostCapabilities` real,
  resolução de `tools/call` pelo host, captura real do Xournal++/permissão de
  Gravação de Tela, nem ingestão do marketplace pelo app. Os rótulos do
  README/`CONTRACT.md`/`ui/README.md`/`manual-study.md` continuam honestos
  (“com SIMULADOR”, “não é o app”, “pendente”).
- **Verificação de capacidades do host (R4)**: reconfirmada na fonte (§4), com
  a ressalva de que o Codex real segue sem contrato documentado na matriz
  oficial de clientes.

---

## 8. Contrato e não regressão (confirmação rápida)

- Sete ferramentas, e **só** `mesa_open` com template: `_meta.ui.resourceUri` e
  `openai/outputTemplate` = `ui://mesa-study/desk-v1.html`; as outras seis sem
  `_meta` (testes ui-server, stdio e integração do staging; `tools/list` do
  pacote real).
- Resource com MIME `text/html;profile=mcp-app`, lido de `ui/desk.html` no
  `resources/read` (byte a byte) e `_meta.ui` com CSP vazio; HTML
  self-contained (sem rede/CDN/iframe/`fetch`/`import`/`require`, sem ink
  canvas).
- `mesa_open` sem `filePath`: nenhum PDF lido, `page:null`; com `filePath`:
  PNG completo por Poppler, mesmas checagens/estado de `mesa_page`; erro nunca
  devolve imagem antiga nem `structuredContent` de sucesso.
- `mesa_library`/`mesa_open.library`: varredura somente leitura das raízes já
  validadas, `truncated` honesto (teto/falha/raiz pulada), campos extras
  descartados pelo schema (raízes não vêm do pedido).
- Captura só por ação explícita; `ui/message` sem anexar imagem; aviso de nova
  captura; `commitCapture` diz que a imagem foi devolvida pelo MCP “não é uma
  prévia só local”.
- Versão `0.2.0-experimental` em `package.json`, `package-lock.json`,
  `plugin.json` e `SERVER_VERSION`.
- Os cinco data tools anteriores (`mesa_status`, `mesa_page`, `mesa_windows`,
  `mesa_capture`, `mesa_context`) mantêm nomes/schemas/anotações; nenhuma
  regressão observada nas suítes MCP.

---

## 9. Resíduos que **não** bloqueiam esta rodada

1. `mesa_open` sem nenhuma raiz válida devolve `library:{files:[],truncated:
   false}` com o motivo em `status` (decisão testada do painel; §3). Opcional:
   alinhar a `truncated:true` se o produto preferir a regra “raiz pulada
   sempre trunca”, mas isso muda o teste pinado.
2. TOCTOU portátil residual (R1) e troca de arquivo dentro do cache (R5),
   ambos documentados no código e no `CONTRACT.md`; exigem escrita local
   concorrente e não expõem conteúdo fora das raízes/cache.
3. Compatibilidade do Codex real (painel, `data:` PNG, capabilities,
   `tools/call` do iframe, captura real) — pendente de teste manual; fora do
   alcance local/read-only.
4. `ui/README.md` mantém a nota de bancada (medição de zoom em Chromium
   simulado, não no Codex) — correta.

Nenhum **blocker concreto** de implementação foi encontrado nas correções
R1–R6; as alterações dos dois agentes (`host-r6` e `ui-r6`) convivem sem
conflito e sem regressão de contrato.

---

## 10. Limites desta revisão e próximos passos (do dono do processo)

- Esta revisão **não executou** o app Codex, não instalou/reiniciou nada, não
  carregou o plugin, não capturou o Xournal++ real e não leu material de curso.
  Tudo o que está marcado como local é local/simulado; o que está marcado como
  real é Poppler real com PDFs sintéticos.
- Ficam para o root (fora do meu escopo de revisão): suíte final consolidada,
  estágio instalado via SDK, preparação/empacotamento e o teste humano no app.
  Este relatório não antecipa nem substitui esses passos.

### Artefatos desta revisão (fora do repositório)

- `/tmp/mesa-fixes-review-repro-20261006.mjs` — repro R1a/R1b/R2/R3/R3b/R5
  (API real; saída na seção correspondente).
- `/tmp/mesa-review-truncated-multiroot.mjs` — repro R3 da revisão anterior,
  reexecutado como está (sem alterar o script).
- `/tmp/mesa-fixes-review-tests-20261006.log` — suíte completa 140/140
  (2026-10-06 ~19:37 -03).
