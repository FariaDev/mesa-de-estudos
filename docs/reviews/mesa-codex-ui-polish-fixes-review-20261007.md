# Revisão final r3 — correções A–E da UI/UX do painel Mesa no Codex (2026-10-07)

- **Data:** 2026-10-07, depois da revisão r2
  (`docs/reviews/mesa-codex-ui-polish-review-20261007.md`) e da rodada de
  correções A–E do root.
- **Escopo revisado:** `codex-plugin/mesa-study/ui/desk.html`,
  `codex-plugin/mesa-study/tests/ui-client.test.mjs` e
  `codex-plugin/mesa-study/ui/README.md`. `server/`, `skills/`, manifests,
  versão e o staging foram tocados só para conferir que ficaram intocados.
- **Modo:** somente leitura do código/fixtures; o único arquivo escrito no
  repo foi este relatório. Rodei uma sonda em `/tmp` (cópia da suíte com o
  `ui/` do repo apenas espelhado por symlink; nada do repo foi alterado).
  Nenhum install, inferência, captura real, login, browser, modelo,
  Xournal++ real, commit, push ou reinício. Fixtures sintéticas apenas.
- **Contexto recebido (não reproduzido por mim):** QA de navegador do root
  amplo; o root vai repetir o caso vazio/recuperação no código atual e no
  staging fresco. Nada aqui valida o app Codex nativo; o painel dentro do
  Codex continua pendente, como o próprio relatório de implementação
  registra.

## 1. Snapshot revisado (sha256 completo)

| Arquivo | sha256 |
|---|---|
| `codex-plugin/mesa-study/ui/desk.html` | `fad5298a84b407c69a1ed58871cf81bdc7968c47de6299d0a3368fd835a4c1f8` |
| `codex-plugin/mesa-study/tests/ui-client.test.mjs` | `f88d59945bdeeac6a9d9d687e8de814f90ca1dd37110ef738829260dfc01c86c` |
| `codex-plugin/mesa-study/ui/README.md` | `d8760a6dae39f463492f5741cd5798346765ebad466f6f60fc029a1490b83ad9` |
| `codex-plugin/mesa-study/package.json` (intocado) | `ab68c272d468834eacee804fdab8bee829cd0a834e295c4ac2ebea76eefa4071` (segue `0.2.2-experimental`) |
| `codex-plugin/mesa-study/.codex-plugin/plugin.json` (intocado) | `1729f729bd9b602c010368262068713052fb9fbb5fe9644e889eb8aa09f31b2d` (segue `0.2.2-experimental`) |
| `codex-plugin/mesa-study/server/index.mjs` (intocado) | `016bca46e4246a9d344cb2094a3abf2a79298c98cfaa7c69ed6129ba8b0a5ef5` |
| `codex-plugin/mesa-study/skills/mesa/SKILL.md` (intocado) | `e476f3b6d25e4a3ffa763578fc9c9e135cb859254aca74d4adce4259a07890ab` |
| `codex-plugin/mesa-study/ui/desk-html.mjs` (intocado) | `94bda97b17d12cde14f22f39eebfd231e074ba66b2c8f618c98c1701f7627afa` (byte-idêntico ao staging pré-rodada) |

Esses cinco hashes de estrutura (server, skill, plugin.json, package.json,
desk-html.mjs) são exatamente os mesmos da tabela do r2: nada de API,
template, sete ferramentas, versão ou manifest mudou nesta rodada.

O staging fresco `codex-plugin/.local-smoke/mesa-polish-final-20261007-h_h9shxg/`
tem `plugin/ui/desk.html` e `plugin/ui/README.md` **byte a byte iguais** aos
arquivos atuais acima (confirmei por `sha256sum`), ou seja, o staging que o
root preparou corresponde à árvore revisada. O baseline pré-rodada segue em
`mesa-context-final-install-20261007-1jdjyqsc` (`desk.html` `0f0cd3b4…`,
o "antes" do r2).

`diff -rq` da árvore contra esse baseline mostra, fora dos artefatos de
staging e de `tests/` (não incluído no staging): `ui/desk.html`,
`ui/README.md` (esta rodada) e `scripts/doctor.mjs` +
`scripts/prepare-local.mjs` (mudança concorrente do context review r4 do
root — remoção da chave morta `readFile` do `profileIo`, 1 linha cada,
fora do escopo de UI; não toquei neles). `server/`, `skills/`, manifests,
`package.json`, `package-lock.json` e `ui/desk-html.mjs` ficam
byte-idênticos.

**Limite de prova desta revisão:** a versão exata revisada no r2
(`desk.html` `0ba923fb…`, teste `896174bb…`, README `d5175a62…`) não está
retida em disco — o staging não inclui `tests/` e nenhum snapshot
intermediário ficou em `.local-smoke`. Portanto o delta A–E foi verificado
por leitura de código + sonda de comportamento + diff cumulativo contra o
baseline pré-rodada, e **não** por `diff` byte a byte contra o snapshot do
r2. Os cinco hunks que mudam em relação ao que o r2 descreveu são
exatamente os listados na seção 3.

## 2. Checagens executadas

- `node --test tests/ui-client.test.mjs` → **50/50**, 0 fail, 0 skip
  (r2: 49; uma prova nova).
- UI trio (`ui-client` + `ui-server` + `ui-server-library`) → **72/72**,
  0 fail, 0 skip (r2: 71).
- `npm test` (pacote completo, Node v26.10.0) → **179/179**, 0 fail,
  0 skip, ~6,4 s (r2: 178/178). Confere a claim do root.
- Sonda em `/tmp` (a suíte atual copiada + 4 cenários novos, `ui/`
  espelhado do repo): **54/54**, incluindo a rotação completa do rótulo
  (seção 4).
- Estático: `node --check` do script extraído e do teste OK; chaves do CSS
  balanceadas (0); nenhum id duplicado; nenhum `position:sticky`; o único
  `position:absolute` é o `.sr-only`; zero `.focus(`; zero `innerHTML`;
  markup do zoom com `—`; `Último` aparece uma única vez no HTML (no
  `updateDocLabel`).
- Paridade `resources/read` × `ui/desk.html` continua pinada em
  `tests/ui-server.test.mjs:137-138` (o teste passa no trio).

## 3. Fechamento de A–E

### A — [Baixo] Nota de biblioteca vazia com doc anterior: **fechado**

`renderLibrary` agora decide a nota por `shown === 0`, com dois textos
honestos (`ui/desk.html:1097-1103`): com `currentFile`, "Nenhum PDF apareceu
na biblioteca. O último PDF continua no seletor; use Ir para tentar
reabri-lo ou confira as pastas liberadas na configuração do plugin."; sem
`currentFile`, "Nenhum PDF autorizado…". O seletor continua com a última
referência (opção sintética se o arquivo saiu da lista) e nada reabre
sozinho.

Evidência de comportamento (teste `biblioteca vazia após página…`,
`ui-client.test.mjs:705-737`): nota visível + `"Nenhum PDF apareceu…
último PDF… Ir"`; `mesa-library` mantém `/raiz/exercicio.pdf`; `mesa_page`
não é chamado; clique em **Ir** pede `{filePath:/raiz/exercicio.pdf,page:2}`
e, no sucesso, o rótulo volta a `exercicio.pdf — página 2 de 5` com
`data-context=page` e ajuda habilitada; falha seguinte volta a
`Último PDF: …`. A sonda própria reproduziu também o caso fresco
(`Nenhum PDF autorizado`, valor `''` no placeholder do select) e o caso
`truncated: true` com `files: []` (nota de vazio, não a de truncamento).
**Sem regressão:** a nota nunca é sobrescrita por `refreshFeatureGates`
nem dispara chamadas.

### B — [Baixo] Legenda sem marcador de "última": **fechado**

`updateDocLabel` prefixa `Último PDF: ` somente quando
`state.shownContext === null` (`ui/desk.html:1323`); `commitPage` chama
`updateDocLabel()` **depois** de gravar `shownContext` (página), então
página fresca/recuperada não leva prefixo; `showPageMeta` chama
`updateDocLabel()` antes, mas o efeito é transitório síncrono, sem pintura
intermediária; captura válida continua no ramo `Xournal++ — …` e nunca
recebe prefixo; falha/vazio chamam `commitEmpty` (limpa `shownContext`) e o
prefixo reaparece.

Evidência: asserção atualizada em `ui-client.test.mjs:1472`
(`Último PDF: exercicio.pdf — página 1 de 3` na captura obsoleta) e as duas
asserções do caso A (`:716`, `:735`). A sonda reproduziu a ordenação
completa:

`página 2/5 (sem prefixo)` → `em voo (sem prefixo, prévia provada)` →
`sucesso 3/5 (sem prefixo)` → `mesa_open vazio (Último PDF: … página 3 de 5
+ nota + data-context=none)` → `captura válida (Xournal++ — Rascunho, sem
Último, data-context=capture)` → `falha (Último PDF: … página 3 de 5)` →
`recuperação por Ir (sem prefixo, data-context=page, ajuda habilitada)`.

### C — [Informativo] `title` vazio nos controles com doc ativo: **fechado**

`updatePageControls` (`ui/desk.html:1012-1016`): com ferramentas e doc,
`prev`/`next`/`go`/`pageInput` ganham "Página anterior" / "Próxima página" /
"Ir para a página" / "Página"; sem doc, o motivo do desabilitado é
"Escolha um PDF na lista para navegar pelas páginas."; sem tools,
`toolsGateText()` continua precedendo. A sonda confirmou os dois casos
(normal e `caps: null`, com `mesa-next`/`mesa-go` desabilitados e nenhuma
chamada a `mesa_page`).

### D — [Informativo] `100%` estático no fallback sem host: **fechado**

O markup agora nasce com `—` (`ui/desk.html:276`), então o caminho
defensivo sem host (retorno antes de `wireControls`/`updateZoomButtons`)
não mostra número inventado; no fluxo embarcado `updateZoomButtons` produz
`Ajustada`/`NN%`/`—`. Verificação de markup (o DOM falso do teste não lê o
texto estático) + teste `zoom:` (`ui-client.test.mjs:1072-1103`), que pina
`Ajustada`, `125%`, `Ajustar`, `aria-pressed` e "zoom não fala com o
servidor".

### E — [Informativo] caps nulo: texto × comportamento: **fechado**

O comentário (`ui/desk.html:760-763`) e o `ui/README.md` (seções de aparência
e de feature detect, ~`:99-102`) agora dizem o que o código faz: sem
`hostCapabilities`, `serverToolsSupported()` (`:764-767`) devolve `false` e
`tools/call` fica desligado, enquanto `ui/message` e
`ui/update-model-context` tentam e mostram a recusa real. O teste
`capabilities: host sem hostCapabilities…` (`ui-client.test.mjs:1586-1605`)
foi estendido com as negativas de ferramenta: `mesa-library`/`mesa-next`
desabilitados, clique em `mesa-next` sem `mesa_page`, e a metade de mensagem
preservada (tentativa + recusa honesta + nova tentativa possível).
Comportamento inalterado; só texto/teste.

## 4. Ordenação semântica, contratos adjacentes e "nada mais mudou"

- **Invariante do rótulo:** `hasImage ⇒ shownContext ≠ null` (só
  `commitPage`/`commitCapture` chamam `showImage`, e ambos gravam
  `shownContext` antes de `updateDocLabel`; `commitEmpty`/`previewFailed`/
  `resetView` limpam os dois). Logo o prefixo marca exatamente "sem prévia
  provada", e o resumo da Tutoria (`updateContextSummary`) e a ajuda
  (`helpContextReady`) concordam com ele nos quatro estados
  (página/captura/em voo/falha-vazio) — a sonda percorreu os quatro.
- **Contratos adjacentes re-checados por código + suíte passando:**
  gates de `tools/call`/`ui/message`/`update-model-context`; época global
  (`invalidateInFlight`/`opToken` em `loadPage` e `captureWindow`); rolagem
  só em `commitPage` quando a chave muda (`resetViewportScroll` não é
  chamado por zoom); busy escondido ao fim de cada caminho
  (`setBusy(false)`/`clearBusyUi`); `#mesa-help-pending` só visível em voo;
  status normal curto e sem prosa do servidor (`Página N de M.`,
  `readySummary` só para anomalias); estado vazio gracioso (fresco e após
  doc); tela cheia só com capacidade declarada + modo atual (teste
  `tela cheia:`, `:1212`); zoom verídico; PNG validado antes de comprometer
  contexto; `event.source === window.parent`; sete ferramentas com só
  `mesa_open` declarando template (suíte do servidor).
- **"Nada mais mudou":** os 49 testes do r2 continuam passando (50 − 1
  novo = 49) e nenhum foi removido/renomeado; o diff cumulativo contra o
  baseline pré-rodada mostra apenas a rodada de implementação descrita no
  r2 + os cinco hunks A–E acima + o teste novo/asserções atualizadas. Os
  endurecimentos de comportamento pedidos no r2 (fix A e B) estão fechados
  sem alterar os contratos de segurança, época ou teclado.

## 5. Limites de prova

- A suíte é VM + DOM falso + ponte simulada: não prova layout, recorte de
  texto, spinner, zoom real, `data:image/png` no Codex, captura real nem
  `hostCapabilities` cru do Codex. D (e o rótulo de zoom no fallback sem
  host) têm evidência de markup, não de DOM falso.
- A sonda `/tmp` usa o mesmo DOM falso da suíte, apenas com cenários
  adicionais; não é evidência de navegador. O QA de layout no harness/root
  segue com o root.
- Não fiz `diff` byte a byte contra o snapshot do r2 (não retido). A
  cobertura contra regressão é a suíte completa 179/179 + leitura dos cinco
  hunks + diff contra o baseline pré-rodada.
- Sem `tests/manual-study.md`, sem captura, sem Xournal++ real, sem material
  de curso, sem credenciais/sessões, sem modelo e sem rede.

## 6. Veredito

**Nenhum bloqueador.** A, B, C, D e E estão fechados no código, com teste
de comportamento nos dois casos que importavam (biblioteca vazia após doc;
prefixo de última referência) e verificação da ordenação do rótulo em
página/em voo/sucesso/vazio/captura/falha/recuperação. Os 179/179 da suíte
completa, a paridade `resources/read` × `ui/desk.html`, o escopo de arquivos
(server/skills/manifest/versão/`desk-html.mjs` byte-idênticos ao baseline) e
a consistência com o staging fresco estão de pé.

**Aprovado para o empacotamento local do root**, com a validação no app
Codex nativo ainda pendente (nada aqui autoriza dizer "validado no Codex").
