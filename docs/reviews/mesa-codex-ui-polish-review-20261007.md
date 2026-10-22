# Revisão final independente r2 — UI/UX do painel Mesa no Codex (2026-10-07)

- **Data:** 2026-10-07, depois da rodada de implementação
  (`docs/reviews/mesa-codex-ui-polish-implementation-20261007.md`).
- **Escopo revisado:** `codex-plugin/mesa-study/ui/desk.html`,
  `codex-plugin/mesa-study/tests/ui-client.test.mjs`,
  `codex-plugin/mesa-study/ui/README.md`. `server/`, `skills/`, manifests,
  versão e o staging foram tocados só para conferir que ficaram intocados.
- **Modo:** somente leitura do código/fixtures; os únicos arquivos escritos
  foram este relatório e um harness temporário em `/tmp` (fora do repo, já
  descartável). Nenhum install, inferência, captura real, login, browser meu,
  commit, push ou reinício. Fixtures sintéticas apenas.
- **QA do root recebido como contexto (não reproduzido por mim):** o root
  passou desktop/estreito/tema escuro/zoom/busy/dedupe de ajuda/recusa no
  navegador e `npm test` 178/178. Nada aqui valida o app Codex nativo; o
  painel dentro do Codex continua pendente, como o próprio relatório de
  implementação registra.

## 1. Snapshot revisado (sha256 completo)

| Arquivo | sha256 |
|---|---|
| `codex-plugin/mesa-study/ui/desk.html` | `0ba923fbe73b346525adb223e63f07ba470c269315a26d5b43062b471e2bd00d` |
| `codex-plugin/mesa-study/tests/ui-client.test.mjs` | `896174bbe08882d98fdcb27541e3242429df82e2dfbbe62fab7ce95ef637c4d8` |
| `codex-plugin/mesa-study/ui/README.md` | `d5175a62c834eeefaedd2ea79f925eaf96cf78ae0d15b9685fa8d5edc1958d6d` |
| `docs/reviews/mesa-codex-ui-polish-implementation-20261007.md` | `89c6f6525e86eca9d0326acd5300e72c3fbe12c238853fcbd165e1a16606f782` |
| `codex-plugin/mesa-study/package.json` (intocado) | `ab68c272d468834eacee804fdab8bee829cd0a834e295c4ac2ebea76eefa4071` (segue `0.2.2-experimental`) |
| `codex-plugin/mesa-study/.codex-plugin/plugin.json` (intocado) | `1729f729bd9b602c010368262068713052fb9fbb5fe9644e889eb8aa09f31b2d` |
| `codex-plugin/mesa-study/server/index.mjs` (intocado) | `016bca46e4246a9d344cb2094a3abf2a79298c98cfaa7c69ed6129ba8b0a5ef5` |
| `codex-plugin/mesa-study/skills/mesa/SKILL.md` (intocado) | `e476f3b6d25e4a3ffa763578fc9c9e135cb859254aca74d4adce4259a07890ab` |

O "antes" declarado de `ui/desk.html`
(`0f0cd3b4031670dc0ce3292ef3c13053a2aa1e093db72601c2670b4adf37664b`) bate
byte a byte com a cópia staged pré-rodada em
`codex-plugin/.local-smoke/mesa-context-final-install-20261007-1jdjyqsc/plugin/ui/desk.html`
(e também em `mesa-context-final-check-20261007-jdokmqit`) — o diff desta
revisão foi feito contra ela.

`diff -rq` da árvore contra essa cópia staged mostra só: `ui/desk.html` e
`ui/README.md` (desta rodada), `scripts/doctor.mjs` e
`scripts/prepare-local.mjs` (mudança concorrente do context review r4 do root,
remoção da chave `readFile` de `profileIo` — confirmada no diff, 1 linha cada)
e `.mcp.json` (o staged é o arquivo **instalado**, com caminhos absolutos; a
árvore é o template relativo). `server/`, `skills/`, plugin.json,
`package.json`, `package-lock.json` e `ui/desk-html.mjs` ficaram
byte-idênticos: nada de API, template, versão ou manifest mudou. O teste
"tools/list: sete ferramentas e só mesa_open declara o recurso MCP Apps"
continua passando (escopo de modelo nativo preservado).

## 2. Checagens próprias executadas

- `node --test tests/ui-client.test.mjs` → **49/49**, 0 fail, 0 skip.
- UI trio (`ui-client` + `ui-server` + `ui-server-library`) → **71/71**,
  0 fail, 0 skip.
- `npm test` (pacote completo, Node v26.10.0) → **178/178**, 0 fail,
  0 skip, ~6,7 s. Confere a claim do pai.
- `tests/ui-server.test.mjs:137-138` continua comparando o texto servido por
  `resources/read` com o `ui/desk.html` em disco (paridade real).
- Sonda de comportamento em `/tmp` (cópia do `ui-client.test.mjs` com os
  caminhos absolutizados e dois casos EDGE novos, sem tocar o repo):
  reproduziu o cenário do QA do root (`mesa_open` válido com
  `library.files=[]` depois de uma página exibida) e o host com
  `hostCapabilities: null`. Saídas relevantes abaixo, nos achados.
- `node --check` do script extraído e do teste (rodei via as próprias
  suítes); CSS com chaves balanceadas; sem ids duplicados
  (`grep -o 'id="…"' | uniq -d` vazio); nenhum `position:sticky` e nenhum
  `position:absolute` fora do `.sr-only`.

Não há cópia pré-rodada de `tests/ui-client.test.mjs` em `.local-smoke`
(o staging não inclui `tests/`), então o delta "43 → 49" e os seis nomes de
teste novos são o que o relatório de implementação declara; o que verifiquei
de fato é a suíte atual com 49 casos passando e os cenários novos presentes.

## 3. Claims do relatório de implementação (por código + teste)

| Claim | Status | Evidência |
|---|---|---|
| `Tutoria` + resumo vivo (`#mesa-context` com `data-context=page\|capture\|none`) sempre do exibido, limpa na falha | **Confirmado** | `ui/desk.html` `updateContextSummary()`/`shownContext`; teste `tutoria: contexto ativo…`; em voo o resumo segue o exibido |
| Legenda fora do papel (`.pdf-foot` no fluxo, sem gradiente/absolute) | **Confirmado** | CSS `.pdf-foot` sem `position`; teste `zoom: CSS…` pina `doesNotMatch(/position:absolute/)` e o markup põe o rodapé fora de `.pdf-stage` |
| Chip de carregamento visível com texto da operação certa; prévia provada retida; ajuda desligada em voo; cancelamento religa | **Confirmado** | `#mesa-busy` (`role=status`, hidden fora do uso), `setBusy`/`clearBusyUi`; testes `carregando:` e `cancelamento:` |
| Rolagem: zoom não mexe; página diferente volta ao topo; reenvio da mesma não | **Confirmado** | `resetViewportScroll` só em `commitPage` com `shownKey` diferente; teste `rolagem:` |
| Vazio/biblioteca vazia/desabilitados com orientação de usuário | **Confirmado (com ressalva A)** | placeholders e títulos revisados; teste da nota "Nenhum PDF autorizado" no caso **sem** doc anterior (`ui-client.test.mjs:705-712`); a ressalva está no achado A |
| Ajuda pendente visível, um `ui/message`, rascunho preservado, sem entrega inventada, tipo do pedido capturado no envio | **Confirmado** | `#mesa-help-pending`; testes `pedido:` e `ajuda: confirmação mantém o tipo…` |
| Sem auto-ajuda, auto-retry, auto-captura ou auto-scroll; captura só no clique | **Confirmado** | `askHelp`/`captureWindow` só em listeners; teste `conferir Xournal++:` (0 chamadas antes do clique) |
| A11y: labels, `focus-visible`, `aria-live` só quando relevante, sem `focus()` | **Confirmado** | teste `acessibilidade:`; `!/\.focus\s*\(/`; regiões vivas `hidden` fora do uso; `touch-action:manipulation` novo |
| Fullscreen só com capacidade declarada **e** modo atual; sem ack, nada muda | **Confirmado** | `data-display` só com `availableDisplayModes` contendo `fullscreen`; teste `tela cheia:` inclusive `host-context-changed` |
| Zoom honesto (`Ajustar`/`Ajustada`/`NN%`/`—`, `aria-pressed`) | **Confirmado no fluxo embarcado** | teste `zoom:` — ressalva D no fallback sem host |
| Segurança (textContent, sem `innerHTML`, PNG validado, tetos, origem) | **Confirmado** | testes `segurança:`, `ponte: mensagem de outra origem…`, `serverTools ausente:`; gates `tools/call`/`ui/message` |
| Época: resposta antiga (página × captura, host push) não sobrescreve | **Confirmado** | quatro testes `época:`; cancelamento e timeout limpam busy |
| Só os 3 arquivos + relatório mudaram; nada em server/skill/manifest/versão | **Confirmado** | `diff -rq` da seção 1 |

## 4. Achados

Nenhum bloqueador. Os achados abaixo são de UX/consistência ou de
documentação, sem impacto em segurança, dados ou protocolo.

### A. [Baixo] Nota de biblioteca vazia some quando existe um doc anterior

- **Onde:** `ui/desk.html:1095`
  (`if (shown === 0 && !state.currentFile) { setLibraryNote('Nenhum PDF autorizado…') }`)
  dentro de `renderLibrary` (`:1060`).
- **Cenário reproduzido (sonda em `/tmp`, não no repo):** após um doc/página
  válidos, um `mesa_open` novo com `page: null` e `library.files: []`. Saída:
  `docLabel = "exercicio.pdf — página 2 de 5"`,
  `context = "Nenhuma página carregada de exercicio.pdf." (data-context=none)`,
  `libraryNote` vazia/escondida, select habilitado com a única opção
  `exercicio.pdf`, `#mesa-help` desligado, placeholder "Nenhuma página
  aberta…", e "Próxima"/"Ir" ainda habilitados (clicar em Próxima chama
  `mesa_page {filePath:/raiz/exercicio.pdf,page:3}`).
- **Por que importa:** é exatamente o caso em que a orientação nova de
  biblioteca vazia mais ajudaria (a pasta liberada ficou sem PDFs, ou a
  seleção sintética do harness), e o seletor segue apresentando um arquivo
  como se ainda estivesse na lista autorizada — a opção única já está
  selecionada, então o `change` não pode re-selecioná-la; quem reabre é o
  "Ir"/setas. A legenda stale (achado B) reforça a leitura de "contexto
  ativo".
- **Recomendação (pequena e contida):** mostrar uma nota honesta também quando
  `shown === 0` com `currentFile`, por exemplo "Nenhum PDF autorizado; o
  último aberto continua no seletor.", preservando a semântica deliberada de
  última referência. Não é bloqueador porque contexto/placeholder já dizem
  que não há página ativa e a re-requisição é possível.
- **Aceite sugerido:** teste de comportamento "mesa_open vazio depois de
  página" (nota visível + select mantendo a última referência + ajuda
  desligada) — o caso fresco já está pinado em `ui-client.test.mjs:705-712`.

### B. [Baixo, pré-existente] `#mesa-doc-label` sem marcador de "última" quando não há prévia

- **Onde:** `ui/desk.html:1310` (`updateDocLabel`); asserção que pina a
  semântica em `tests/ui-client.test.mjs:1438` ("referência antiga de PDF
  continua no rótulo sem prévia").
- **Fato:** com a prévia limpa (falha ou `mesa_open` sem página), a legenda
  continua `exercicio.pdf — página 2 de 5`, sem prefixo "Último:", enquanto o
  placeholder e o resumo da Tutoria já dizem que não há página ativa. Um
  usuário pode ler a legenda como estado corrente.
- **Nota de documentação:** o relatório de implementação
  (`…implementation-20261007.md:206-208`) diz que a distinção "está
  documentada no README"; conferi o `ui/README.md` e **não há** menção à
  semântica de última referência do rótulo (só à posição da legenda no
  rodapé). Ou o README ganha essa linha, ou o rótulo passa a se declarar.
- **Recomendação:** prefixar "Último: " (ou similar) quando
  `state.shownContext === null` e ainda houver referência, atualizando a
  asserção `:1438`; alternativa mínima é documentar a decisão no README.
  Não é bloqueador: é comportamento herdado do baseline (o diff desta rodada
  não mudou `updateDocLabel`), e o que dirige a ajuda é o resumo da Tutoria,
  que limpa corretamente.

### C. [Informativo] `title` vazio nos controles de navegação com doc ativo

- **Onde:** `ui/desk.html:1010`
  (`var navTitle = !toolsOk ? toolsGateText() : !hasDoc ? 'Escolha um PDF…' : '';`).
- Anterior/Próxima mantêm `aria-label` e `Ir` tem texto visível; só o
  tooltip some quando há doc. O root já classificou como polimento não
  bloqueador; concordo. Se quiser fechar, definir títulos curtos
  ("Página anterior", "Próxima página", "Ir para a página") quando
  habilitados, sem tocar em comportamento.

### D. [Informativo] Fallback sem host mantém `100%` estático no rótulo de zoom

- **Onde:** markup `ui/desk.html:276`
  (`<span id="mesa-zoom-value" class="zoom-label">100%</span>`) + retorno
  antecipado em `ui/desk.html:424-429` (`window.parent === window`), que
  acontece antes de `wireControls()`/`updateZoomButtons()`.
- **Fato:** com o arquivo aberto direto (sem host), o rótulo fica em `100%`
  com todos os controles desabilitados — o único caso restante do número
  inventado que a rodada removeu no fluxo embarcado. O harness VM não ajudou
  a medir isso (o DOM falso não lê o texto estático do markup), então o
  achado é de leitura de código/markup, não de reprodução.
- **Recomendação:** chamar `updateZoomButtons()` (ou o ajuste do rótulo)
  antes do `return` do caminho sem host, ou trocar o texto inicial do markup
  para `—`. Impacto cosmético em caminho defensivo; não bloqueador.

### E. [Informativo] Capacidades nulas: comentário/README dizem "tenta", mas `tools/call` é desligado

- **Onde:** `ui/desk.html:755-766` — o comentário afirma "`hostCapabilities`
  nulo (host fora do padrão) tenta e mostra a recusa real da ponte", mas
  `serverToolsSupported()` devolve `Boolean(caps && caps.serverTools)` →
  `false` com caps nulo. `ui/README.md:97-98` repete a frase sem distinção
  por modalidade.
- **Sonda:** com `hostCapabilities: null`, o select fica desabilitado com o
  título "Este aplicativo não permite chamar as ferramentas…";
  `#mesa-help` fica habilitado e `ui/message` é tentado (recusa real vira
  erro honesto) — porque `messageCapabilityOff()` e `updateModelContext`
  tratam caps nulo como "tenta". O teste
  `capabilities: host sem hostCapabilities tenta…` só cobre a metade
  `ui/message`, então a inconsistência passou.
- **Recomendação:** alinhar ou o texto (comentário + README) ou o
  comportamento de `serverToolsSupported`; como `hostCapabilities` é
  obrigatório no schema 2026-01-26, um host assim já está fora do padrão.
  Pré-existente da rodada anterior, não regressão desta. Não bloqueador.

## 5. Resposta direta aos dois pontos do QA do root

- **"Falta orientação de biblioteca vazia depois de um doc anterior é
  problema real?"** — Sim, real, porém **baixo** e não bloqueador: é o
  caso em que a orientação mais serve e ela some justamente porque existe
  `currentFile` (achado A). Vale um ajuste pequeno de condição/wording +
  teste; o resto do estado (contexto/placeholder/ajuda) já está honesto.
- **"A legenda stale parece ativa (sem 'Último')?"** — Sim, parece; é
  comportamento herdado e pinado por teste (achado B). Vale prefixo de
  "última referência" **ou** uma linha no `ui/README.md` dizendo que a
  semântica é deliberada (hoje o README não diz, apesar do relatório de
  implementação afirmar que diz). Não bloqueador porque o resumo da Tutoria
  — que descreve o botão de ajuda — limpa corretamente.

## 6. Limites de prova

- A suíte é VM + DOM falso + ponte simulada: não prova layout, recorte de
  texto, spinner, zoom real, `data:image/png` no Codex, captura real,
  `hostCapabilities` cru do Codex nem tela cheia do host. O QA de navegador
  é do root (recebido como contexto, não reproduzido aqui).
- Os dois achados A/B foram reproduzidos com o DOM/ponte simulados; D/E são
  de leitura de código/markup/sonda controlada; C é de leitura.
- Não medi o painel em larguras reais nesta rodada; a evidência de
  `justify-content:center`/bordas a 125% citada no README é de bancada
  anterior (harness Chromium), não minha.
- Sem `tests/manual-study.md`, sem captura, sem Xournal++ real, sem material
  de curso, sem credenciais/sessões.

## 7. Veredito

**Nenhum bloqueador.** Os 178/178 da suíte completa, a paridade
`resources/read` × `ui/desk.html`, o escopo de arquivos (server/skills/
manifest/versão byte-idênticos ao staging pré-rodada) e os contratos
centrais do pedido — contexto que limpa na falha, legenda fora do papel,
busy honesto com prévia provada, rolagem preservada no zoom, orientação de
usuário, ajuda pendente/rascunho preservado, época única, gates de
capacidade, fullscreen só com ack, zoom rotulado de verdade no fluxo
embarcado e sete ferramentas intocadas — estão de pé. Os achados A e B são
melhorias pequenas de honestidade/consistência (recomendo fazê-las, com
teste de comportamento no caso A), C–E são polimento/documentação.

**Aprovado para o empacotamento local do root**, com a validação no app
Codex nativo ainda pendente (nada aqui autoriza dizer "validado no Codex").
