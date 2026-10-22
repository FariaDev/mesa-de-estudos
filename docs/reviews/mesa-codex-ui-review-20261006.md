# Mesa no Codex — revisão independente do painel MCP Apps (2026-10-06)

Revisão **independente, somente leitura de código + testes sintéticos**: nenhuma
linha de implementação foi alterada; o único arquivo escrito é este relatório.
Nenhum app real (Codex/Xournal++), nenhuma credencial/sessão/configuração
pessoal, nenhum material de curso, nenhum PDF não sintético, nenhuma inferência,
nenhuma instalação/reinício e nenhuma delegação (nenhum uso de opencode-go ou de
outro provedor). O checkout sujo preexistente foi preservado.

Fontes de contrato usadas: `AGENTS.md` (raiz), `codex-plugin/AGENTS.md`,
`docs/reviews/mesa-codex-ui-api-20261006.md` (pesquisa documental primária),
`codex-plugin/mesa-study/server/CONTRACT.md`, README/skill/manifest do pacote e
o código/testes listados abaixo. `/tmp/mesa-openai-extensions-doc-20261006.md`
foi lido como fonte secundária (extensões OpenAI/ChatGPT), nunca como prova do
Codex real.

---

## 0. Snapshot revisado (âncora temporal)

- Momento da verificação: **2026-10-06 19:18:51 -03**; suíte completa executada
  nesse instante: **126/126 passando, 0 falhas, 0 skipped** (`npm test` →
  `node --test tests/*.test.mjs`).
- Por arquivo: ui-client **35**, ui-server-library **7**, ui-server **7**,
  mcp-guards 10, mcp-parity 8, mcp-stdio 8, mcp-poppler 3, mcp-capture 5,
  package-manifest 9, package-doctor 15, package-doctor-startup-parity 5,
  package-prepare-local 13, integration-stage 1.
- Hashes (sha256) dos arquivos-chave desta rodada:
  - `ui/desk.html` = `569a9331225857e91548ac4a12873b1515bd2a7cd9098faac37d0bed1371a9a1`
  - `server/library.mjs` = `75509a874545b1b01e172dad030461d9451b1a17eea7839716d3af1e5a83eef5`
  - `server/tools.mjs` = `b49b033a2ea6b825341daae24c06c5b5ddc00efb53b45bb78e0d57e87b5a17b7`
  - `tests/ui-client.test.mjs` = `6205105d0c66d5b959cec14fe9f0f37509e8e37c671d101cb58423fa72e9bb4f`
  - `tests/ui-server.test.mjs` = `ecf6acfae54d13276dff9a4e643468487c6c534d2c9693d7a629e1a70821edc6`
  - `tests/ui-server-library.test.mjs` = `571276a33d17b8684c36c41200e0881ca65641cd72204225c13e319642b7a2f8`
- **Ressalva de concorrência com o agente de UI**: os mtimes dessa área são
  recentes (`server/library.mjs` 19:04, `tests/ui-server*` 19:06/19:09,
  `tests/ui-client.test.mjs` 19:09, `ui/desk.html` 19:11, `README.md` 19:14).
  O snapshot acima já contém os 35 testes de `ui-client` (inclusive o bloco
  final de época/r2). Uma edição posterior do agente de UI invalida os hashes,
  não o restante do relatório; a suíte não foi conflitada.

---

## 1. Contrato — verificação item por item

| Item do contrato | Status | Evidência |
|---|---|---|
| `mesa_open({filePath?,page?})` é o único render tool | ✅ | `server/tools.mjs` `DESK_TOOL_META`; teste `tools/list: sete ferramentas e só mesa_open...` (ui-server) e `integration-stage` |
| `_meta.ui.resourceUri` + `openai/outputTemplate` = `ui://mesa-study/desk-v1.html` | ✅ | `server/tools.mjs`; `server/ui.mjs`; testes de catálogo nos três níveis (in-process, stdio, pacote) |
| Resource MIME `text/html;profile=mcp-app`, inline `ui/desk.html` lido no `resources/read` | ✅ | `server/ui.mjs`, `server/server.mjs`; teste `resources/read: HTML versionado...` compara byte a byte com o arquivo |
| `structuredContent {ok:true,kind:'desk',status,library,page}` | ✅ | `server/tools.mjs#open`; testes `mesa_open sem/com filePath` |
| PNG completo só com `filePath`; sem `filePath` nenhum PDF é lido | ✅ | teste `mesa_open sem filePath` verifica ausência de bloco de imagem e cache não criado; `integration-stage` |
| Erro nunca devolve imagem antiga nem `structuredContent` | ✅ | `wrapTool` (server.mjs) + testes `mesa_open: falha nunca devolve imagem antiga` |
| `mesa_library({}) → {ok,kind:'library',files,truncated}` | ✅ (forma) / ⚠️ (conteúdo, achado R3) | `server/tools.mjs#library`; teste de contrato em ui-server-library |
| Sete ferramentas totais; cinco anteriores mantidas | ✅ | `TOOL_DEFS` + testes `mcp-stdio`/`mcp-parity`; nenhuma regressão encontrada (§4) |
| `mesa_page` e demais data tools sem template de UI | ✅ | TESTE `tools/list` percorre todas e falha se `_meta` existir fora de `mesa_open` |
| Ponte `ui/initialize` → `initialized`, `tools/call`, `ui/message` com `content` ARRAY | ✅ (simulador) / ⏳ (host) | `ui/desk.html` linhas 407-416, 1139; teste `pedir ajuda: ui/message...` asserta `Array.isArray(content)` |
| Fallback honesto sem suporte a UI | ✅ | Servidor devolve imagem+meta como tool comum (ui-server com cliente sem `io.modelcontextprotocol/ui`); painel desliga controles sem `serverTools`/`message` e sem host |
| Versão `0.2.0-experimental` em manifest/package/lock/config | ✅ | `plugin.json`, `package.json`, `package-lock.json`, `SERVER_VERSION`; teste `versão: manifesto = package.json = SERVER_VERSION` |
| Testes locais / Poppler real / Codex UI real discriminados | ✅ | README, `ui/README.md`, `tests/manual-study.md` e cabeçalhos dos testes usam rótulos explícitos ("com SIMULADOR", "não é o app") |
| Empacotamento leva o recurso (`ui/desk.html`) | ✅ | `scripts/prepare-local.mjs` `COPY_ENTRIES`/`REQUIRED_SOURCE_FILES`; `integration-stage` lê o HTML do pacote preparado e o serve via SDK |

Legenda: ✅ confirmado no código/teste local · ⚠️ confirmado com ressalva ·
⏳ pendente de teste no app real.

---

## 2. Achados por severidade

### R1 — Média — TOCTOU residual na varredura da biblioteca (lstat → readdir); a alegação de "symlink nunca seguido / nenhum caminho escapa" não fecha

**Local.** `server/library.mjs#walk` (lstat em `server/library.mjs:87`;
`readdir` em `:98`; ordenação/limite em `:103`/`:106`). Comentário de cabeçalho
(`server/library.mjs:3-10`) e `server/CONTRACT.md:148-150` afirmam que um
diretório trocado por symlink no meio da varredura **não é seguido** e que
"nenhum caminho listado escapa da raiz".

**Comportamento.** A revalidação `lstat(dir)` e a leitura `readdir(dir)` são
duas syscalls separadas: basta trocar `dir` por um symlink **entre** elas para
o `readdir` listar o alvo externo. Os `Dirent` resultantes são processados com
`full = path.join(dir, name)` e arquivos `.pdf` regulares entram em `files`.

**Reprodução (não altera o repo).** `node /tmp/mesa-review-race-demo.mjs`
(injeta `listDir` que executa a troca na janela e depois chama `readdir`):

```
RACE files: [{"filePath":"…/raiz/escapou.pdf","name":"escapou.pdf"}]
RACE truncated: false visited: 2
```

Ou seja: a listagem devolveu o caminho externo **e** `truncated:false` — nem o
sinal de incompletude foi honesto nesse caso.

**Impacto concreto.** `mesa_library` e `mesa_open.library` podem expor
nomes/caminhos de arquivos fora das raízes enquanto a corrida está ativa. O
conteúdo dos PDFs **não** sai por essa via: `mesa_page` sobre esse caminho
resolve o realpath e falha (`ROOT_CHANGED`/`PATH_OUTSIDE_ROOTS`) — a pesquisa e
os testes de confinamento do host seguem válidos no estado estacionário. O
achado é de honestidade de contrato/confinamento, não de leitura de conteúdo;
exige escrita local concorrente no diretório-pai durante a janela.

**Lacuna de teste.** O teste `biblioteca: diretório trocado por symlink no meio
da varredura não é seguido` (ui-server-library) só cobre a revalidação de
**entrada** do diretório: ele mente no `readdir` do **pai** (que devolve a
entrada como `directory`) e a revalidação `lstat` subsequente pula. A janela
`lstat→readdir` do próprio diretório não é exercitada. Um teste mínimo seria o
hook acima (troca dentro do `listDir`) assertando "nenhum caminho fora da raiz
ou `truncated/erro` honesto". Correção de implementação (varrer por fd/`opendir`
ou reconferir `realpath` de cada entrada) é decisão dos implementadores; não é
pedido de redesenho.

### R2 — Baixa/Média — `readdir` lê todas as entradas antes do teto de 4000; "varredura bounded" não vale para IO/memória

**Local.** `server/library.mjs:98-103`: `entries = await readDir(dir, {withFileTypes:true})`
seguido de `[...entries].sort(...)`. O teto `maxEntries` (4000) só é aplicado
no laço seguinte (`:106`). `server/CONTRACT.md:174` e `README.md` falam em
"varredura bounded"/"teto de entradas visitadas".

**Reprodução.** `node /tmp/mesa-review-race-demo.mjs` (segunda parte):
diretório com 3000 `.txt` e `limits:{maxEntries:10}` →

```
IO readdir returned: 3000 entries; visited: 10 truncated: true
```

**Impacto.** O teto limita o **processamento**, não a leitura: um diretório
enorme sob uma raiz (ou raiz apontando para pasta cheia) gera pico de
IO/memória + sort O(n log n) independentemente do teto. `truncated` continua
honesto (diz que a listagem pode estar incompleta), mas a documentação sugere
limite de varredura que não existe no IO. Nota secundária: `mesa_open` com
`filePath` faz o snapshot da biblioteca **antes** de renderizar a página, então
esse custo entra no caminho crítico da abertura com PDF (não é a mesma coisa que
`mesa_page`).

**Lacuna de teste.** O teste de limites asserta `visited <= maxEntries`; nada
mede quantas entradas o `readdir` devolveu. Se a intenção for manter o custo
limitado, o teste deveria usar um `listDir` instrumentado e/ou a leitura
deveria parar mais cedo; se a intenção for "teto de visita", ajustar a redação
do contrato/README.

### R3 — Baixa — `mesa_library` devolve `truncated:false` quando uma raiz configurada foi pulada (ausente/trocada) e outra é válida

**Local.** `server/tools.mjs#library` chama `rootsForPageOperation(config.roots)`
(`server/checks.mjs:46-73`), que devolve **somente** as raízes válidas e ignora
silenciosamente as demais quando há ao menos uma válida. O resultado não carrega
`checks`, só `{ok,kind,files,truncated}`.

**Reprodução.** `node /tmp/mesa-review-truncated-multiroot.mjs` (troca uma raiz
por symlink **depois** do startup, mantendo outra raiz válida):

```
mesa_library: {"ok":true,"kind":"library","files":[…/valida/ok.pdf],"truncated":false}
status roots checks: {"valid":1,"missing":0,"changed":1,"notDirectory":0} available:true
```

**Impacto.** Quem chama apenas `mesa_library` recebe uma lista sem o campo que
explicaria a raiz pulada e com `truncated:false`; a mesma consulta via
`mesa_status`/`mesa_open.status` mostra `checks.changed=1`. O contrato diz
"`truncated:true` sempre que um teto ou falha de leitura impede a varredura
completa" (`CONTRACT.md`), então há divergência de honestidade. Correção barata
(mesmo shape): computar `inspectRoots` junto e marcar `truncated:true` quando
houver raiz pulada.

**Lacuna de teste.** O teste multi-raízes (`mcp-guards`, `raízes: com várias
roots...`) cobre `mesa_status`/`mesa_page`; nenhum teste chama `mesa_library`
com mix válida+ausente/trocada.

### R4 — Média (potencial; confirmar no host real) — as chaves de `hostCapabilities` assumidas para `ui/message`/`ui/update-model-context` não constam da fonte local

**Local.** `ui/desk.html:1104-1108` (`messageCapabilityOff`: desliga se
`caps.message` não existir ou `caps.message.text` não for verdadeiro) e
`:1098-1100` (`updateModelContext` exige `caps.updateModelContext.structuredContent`).
Os fixtures repetem a forma assumida (`tests/ui-client.test.mjs:272-276`:
`message:{text:{}}`, `updateModelContext:{structuredContent:{}}`).

**Problema.** O resumo de `hostCapabilities` na pesquisa local
(`docs/reviews/mesa-codex-ui-api-20261006.md`, §3.2/§6) lista
`serverTools`, `serverResources`, `openLinks`, `logging`, `sandbox` e **não
menciona** `message`/`updateModelContext`. Não há schema ext-apps vendorizado
neste checkout para desempatar (busca local não encontrou
`McpUiHostCapabilities`). Se o Codex real anunciar um objeto de capabilities
sem a chave `message` (mesmo aceitando `ui/message`), o botão **Pedir ajuda**
fica permanentemente desabilitado; o mesmo vale para o contexto estruturado.

**Por que o teste não pega.** O simulador usa exatamente as chaves assumidas
pelo próprio cliente, então converte a suposição em fato. **Ação mínima pedida
ao teste real (V2/V4 do manual): registrar o JSON cru de `hostCapabilities` da
resposta de `ui/initialize`.** Se ausente mas `ui/message` funcionar, a política
já usada para `caps` nulo ("tenta e trata falha") é a mais segura.

### R5 — Baixa — confinamento de página/bytes com janela check-then-use; teto de PNG não é reconferido após a leitura

**Local.** `server/png.mjs:50` compara `stat.size > maxBytes`, mas depois
`fs.readFile(realFile)` (`:57`) e nenhuma revalidação de `bytes.length` contra
`maxBytes` (só assinatura PNG em `:58`). No fluxo de página,
`host/page.mjs#resolveAuthorizedFile` resolve `realPath` uma vez e os executáveis
(pdfinfo/pdftocairo) são chamados com essa **string** depois de
`ensureCacheDir`/poda/criação de subdiretório; o servidor entrega ao host apenas
raízes revalidadas (`checks.mjs`), mas o host re-resolve o realpath por conta
própria (`host/paths.mjs`) — duas verificações em momentos distintos.

**Impacto.** Em mutação concorrente (troca de arquivo/raiz após a checagem),
o teto de bytes pode ser excedido no retorno e o confinamento por realpath pode
seguir o alvo novo. Requer escrita local durante a janela; no estado estacionário
os testes de symlink/realpath passam. **Contratos afetados por precisão:**
"confinamento por realpath no host" (`CONTRACT.md`) e "teto do PNG devolvido"
(`README`). Endurecimento mínimo, sem redesenho: reconferir `bytes.length`
pós-leitura e, se quiserem fechar a corrida de conteúdo, validar por fd/abrir
depois da checagem.

**Lacuna de teste.** Nenhum teste cobre mutação entre checagem e uso; o teto é
testado só com `stat` já acima do limite.

### R6 — Baixa — `ui/notifications/size-changed` pode ser enviado antes do fim do handshake

**Local.** `ui/desk.html`: `setupSizeReporter()` é armado antes de `start()`
(observa `documentElement` na hora + `setTimeout(measure, 100)`), e `notify`
não checa `state.initialized`. O handshake tem timeout de 15 s.

**Impacto.** Se o host descartar mensagens anteriores à resposta de
`ui/initialize`, o primeiro aviso de tamanho pode ser perdido (efeito cosmético
até o próximo resize), não quebra funcionalidade. Hosts tolerantes não são
afetados. **Lacuna de teste:** `ui-client.test.mjs:1013` testa conteúdo/dedupe
do `size-changed`, mas nunca a ordem em relação a `ui/initialize`.

### R7 — Informativo — `openai/ui.entrypoints` (`{type:"thread"}`) existe na doc de extensões, mas não é exigência deste contrato

`/tmp/mesa-openai-extensions-doc-20261006.md` documenta
`_meta["openai/ui"].entrypoints` (global/thread/file) como superfícies do
**ChatGPT**. O pacote declara só o alias `openai/outputTemplate`, e o contrato
congelado não pede entrypoint. Se a validação real mostrar que o painel não
aparece só com o template, o entrypoint `thread` é a superfície documentada a
tentar — **como hipótese ChatGPT, sem confundir com prova de compatibilidade do
Codex**. Nada a corrigir agora.

---

## 3. Confirmação dos achados de rodadas anteriores

| Achado | Status nesta revisão | Onde |
|---|---|---|
| Página/preview/contexto atuais atômicos após falha | **Confirmado** | `server/tools.mjs#page` (store só após `readBoundedPng`), `server/state.mjs`; testes `mesa_open: falha nunca devolve imagem antiga`, `falha de página: prévia limpa...`, `applyDesk com PNG divergente...` |
| Token global página/captura + teardown invalidam resposta obsoleta | **Confirmado** | `ui/desk.html` `invalidateInFlight`/`opToken`, `teardown()`; testes `corrida: resposta obsoleta...`, `corrida página × captura...`, `época: *` (5), `teardown: ... ignora resposta tardia` |
| Zoom com as duas bordas alcançáveis no overflow (sem cortar a esquerda) | **Confirmado por código/teste; bancada citada, não reexecutada** | CSS `#mesa-image{flex:none;margin:0 auto}` + `applyZoomToImage`; teste `zoom: CSS não encolhe a imagem...`; medição de iframe registrada em `ui/README.md:97-101` |
| Ajuda/mensagem: um pedido por vez, sem duplicar, com gate de host | **Confirmado (com a ressalva R4)** | `helpActive` + `updateHelp`; testes `ajuda: um pedido por vez...`, `ajuda: capability ausente...` |
| Aviso de nova captura (não reaproveitar a prévia) | **Confirmado** | `CAPTURE_NOTICE_TEXT` + `commitCapture`/`helpMessage`; testes `conferir Xournal++...`, `conferência: aviso de nova captura...` |
| Nenhuma captura automática | **Confirmado** | testes assertam zero `mesa_capture`/`mesa_windows` antes de cliques; servidor só captura em `mesa_capture` |
| UI/resource empacotados (`prepare-local`) | **Confirmado** | `COPY_ENTRIES` inclui `ui`; `REQUIRED_SOURCE_FILES` inclui `ui/desk.html`; `integration-stage` lê o HTML do staging |
| Raiz trocada por symlink não autoriza o alvo (estado estacionário) | **Confirmado** | `checks.mjs`; testes `raízes: root trocada...`, `mesa_library/mesa_open: raiz trocada...`; **corridas residuais em R1/R5** |
| Confinamento de janela/cache no host | **Confirmado (estado estacionário)** | `host/capture.mjs` (id+app+ownerPID, nunca tela inteira), `server/png.mjs` (realpath no cache); testes de captura simulada e `PNG: leitura limitada recusa arquivo fora do cache` |
| Scanner bounded (200 pdf / 4000 entradas / 6 níveis) e sem hidden/symlink | **Parcial — não aceito como "TOCTOU fechado" nem "IO bounded"** | Limites existem e são testados, mas R1/R2 mostram que a janela lstat→readdir e a leitura integral do diretório não são limitadas |

---

## 4. Regressões e impacto nos cinco anteriores

Nenhuma regressão de contrato foi encontrada nas cinco ferramentas
preexistentes (`mesa_status`, `mesa_page`, `mesa_windows`, `mesa_capture`,
`mesa_context`): nomes, schemas, anotações e handlers permanecem, e as suítes
`mcp-stdio`, `mcp-guards`, `mcp-poppler` e `mcp-capture` passam. O `mesa_open`
reusa literalmente `page()` para render (mesmo cache/estado/checagens), o que os
testes comparam byte a byte (sha256) com `mesa_page`.

Observações de impacto, sem reescrita de arquitetura:

- `mesa_open` com `filePath` paga o snapshot da biblioteca **antes** de
  renderizar (R2); em raiz grande isso atrasa a abertura. Alternativa mínima
  seria renderizar a página e compor a biblioteca em paralelo/depois — decisão
  dos implementadores.
- As lacunas R1/R2/R3 vivem no código **novo** de biblioteca (`server/library.mjs`,
  `server/tools.mjs`), não no host herdado do snapshot.

---

## 5. Testes: o que provam e o que não provam

**Provam (verificado nesta revisão):**

- Protocolo MCP real com SDK oficial em transporte in-memory e stdio, com
  cliente que **não** anuncia `io.modelcontextprotocol/ui` (fallback de host sem
  UI), sete ferramentas e só `mesa_open` com template.
- `resources/read` real devolvendo o `ui/desk.html` do disco byte a byte, MIME
  `text/html;profile=mcp-app` e `_meta.ui` esperado; HTML sem rede
  (`https?://`, `<link>`, `fetch`, `import()`, `require()` ausentes).
- Poppler real com PDFs sintéticos (caminho com espaços/Unicode, página 2,
  bytes completos vs `structuredContent`, teto de imagem sem truncar).
- Ponte do painel executando o script inline real em `node:vm` com DOM e
  `postMessage` simulados: handshake, `tools/call` com `{name,arguments}`,
  `ui/message` com **array** de ContentBlock, teardown, tamanho, tema,
  display-mode, época/corridas, cancelamento, timeout, validação de PNG e
  `textContent`-only (sem `innerHTML`).
- Empacotamento: `prepare-local` copia `ui/`, gera `.mcp.json`/TOML/marketplace,
  e o teste de integração sobe o servidor **do pacote preparado** via SDK real.
- Paridade do snapshot do host com `SNAPSHOT.json` (incluindo diff mínimo de
  `capture.mjs`).

**Não provam (limites honestos confirmados):** nada no app Codex (painel,
`data:` no iframe, `ui/initialize` real, resolução dos nomes de ferramenta do
lado do host), nada de captura real do Xournal++/permissão de Gravação de Tela,
nada do `.mcp.json` relativo (`cwd`/`env_vars`) na ingestão do app. As formas de
`hostCapabilities` (R4) e a ordem `size-changed`×`initialize` (R6) são
suposições do simulador.

---

## 6. Validação real pendente (não é achado de código)

Os itens abaixo estão corretamente marcados como pendentes no README,
`ui/README.md` e `tests/manual-study.md`; minha revisão os mantém abertos:

1. `$mesa`/`mesa_open` numa sessão real: painel renderiza? à direita? PNG em
   `data:` aparece? O host anuncia `extensions["io.modelcontextprotocol/ui"]`?
2. Registrar o **JSON cru de `hostCapabilities`** da resposta de `ui/initialize`
   (crítico para R4) e se `tools/call` do iframe resolve os nomes não
   prefixados (`mesa_page` etc.), já que o host pode expor `mcp__mesa__*` ao
   modelo.
3. Navegação/zoom, Pedir ajuda, teardown/tela cheia no app real.
4. Captura real da janela escolhida do Xournal++ com permissão de macOS e o
   aviso de destino da imagem.
5. `.mcp.json` do catálogo dev (`cwd:"./"`, `env_vars`) — o staging com caminhos
   absolutos é a alternativa já pronta.

---

## 7. Objeções restantes / conclusão

- O contrato principal do experimento está **implementado e testado no plano
  local**: `mesa_open` como único render tool, recurso MCP Apps inline, PNG
  completo por Poppler, biblioteca de raízes congeladas, captura explícita,
  sete ferramentas sem regressão, fallback honesto. A suíte de 126 testes é
  majoritariamente significativa (SDK real, Poppler real, bridge simulada,
  staging real) e os limites estão rotulados.
- **R1 e R2 devem ser corrigidos ou ter a redação do contrato ajustada**: as
  frases "diretório trocado por symlink ... não é seguido; nenhum caminho
  listado escapa da raiz" e "varredura bounded" não resistem à reprodução
  (evidência em `/tmp/mesa-review-race-demo.mjs`). R3 é o mesmo tema na
  honestidade do `truncated` com múltiplas raízes.
- **R4 é o risco funcional de maior impacto potencial no Codex real** e não é
  observável por teste local: o gate de `ui/message` depende de uma chave de
  capability que a fonte local não documenta. Precisa do JSON real do host
  antes de considerar "Pedir ajuda" validado.
- R5/R6/R7 são riscos residuais/informativos; nenhum justifica reescrever a
  arquitetura nem adicionar funcionalidade nesta rodada.
- Nada nesta revisão valida o app Codex; a distinção
  **documentado/simulado local ≠ Codex real** permanece e precisa continuar
  explícita nos textos do pacote (o que o snapshot já faz).

---

### Artefatos de reprodução usados nesta revisão (fora do repositório)

- `/tmp/mesa-review-race-demo.mjs` — R1 (troca lstat→readdir) e R2 (readdir
  integral antes do teto).
- `/tmp/mesa-review-truncated-multiroot.mjs` — R3 (mix raiz válida + trocada).
- `/tmp/mesa-review-tests-20261006.log` e `/tmp/mesa-review-tests2-20261006.log` —
  execuções completas (126/126).
