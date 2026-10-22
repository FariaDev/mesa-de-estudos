# Mesa no Codex — capabilities do host (R4) e ordem do `size-changed` (R6): fonte primária, correção e evidência

Data: 2026-10-06 · Escopo: rodada de correção da revisão independente
`docs/reviews/mesa-codex-ui-review-20261006.md` (achados **R4** e **R6**).
Agente: implementação de UI (`ui/**`) + `tests/ui-client.test.mjs`; o servidor,
o host, `server/png.mjs` e `server/library.mjs` continuam com o outro agente.
Runtime de implementação: Pi Mesa Dev (Command Code). **Nenhum uso de
opencode-go**, nenhuma delegação a ele.

O que **não** foi feito (limites honestos):

- Nenhum app real (Codex/Xournal++) aberto, instalado, reiniciado ou carregado;
  nenhuma credencial/sessão/configuração pessoal lida; nenhum material de curso;
  somente PDFs sintéticos e a ponte simulada de teste.
- Nenhum `npm install`, nenhuma mutação de `desk/`, `core/`, `chat/`,
  `claude-mod/` ou `visual-check/`; o checkout sujo preexistente foi preservado
  (sem `git reset/checkout/clean/commit/push`).
- A consulta de fonte usou `curl` (GET anônimo, sem instalação) em URLs públicas
  do repositório oficial; nada foi baixado para dentro do repositório.
- A validação no **Codex real continua pendente** e sem garantia (ver §5).

---

## 1. R4 — `hostCapabilities.message.text` e `updateModelContext.structuredContent` em fonte primária

### 1.1 O que foi consultado (arquivo, revisão e URL)

Repo oficial: `github.com/modelcontextprotocol/ext-apps`, branch `main`
(revisão de spec **2026-01-26**; `package.json` do repo reportou versão 2.0.3 no
momento da consulta). Arquivos baixados por GET anônimo em **2026-10-06
19:29 -03** e conferidos por sha256:

| Arquivo | URL (raw) | sha256 (conferido) |
|---|---|---|
| `src/spec.types.ts` | <https://raw.githubusercontent.com/modelcontextprotocol/ext-apps/main/src/spec.types.ts> | `f46212be3355fa0437c81b01659187efacdeef6fa50be23be02a47d03610bc6a` |
| `src/generated/schema.ts` | <https://raw.githubusercontent.com/modelcontextprotocol/ext-apps/main/src/generated/schema.ts> | `678f11a9288642ab4cf6c765a31238ee508027961f25941f9b13cce28de298d0` |
| `src/app.ts` | <https://raw.githubusercontent.com/modelcontextprotocol/ext-apps/main/src/app.ts> | `1f631679e471f66f227f9c603ebc6408f941b5e0c4767dbe73f30d1d07a478ed` |
| `specification/2026-01-26/apps.mdx` | <https://raw.githubusercontent.com/modelcontextprotocol/ext-apps/main/specification/2026-01-26/apps.mdx> | `ee452a7d1b9b7fb900acfeb4d6932d3963375b0f3f37d196a4b93eb80312af0e` |

Consistência: as cópias de `src/generated/schema.ts` e `src/app.ts` já em
`/tmp` de rodada anterior têm o **mesmo sha256** das cópias baixadas agora — a
consulta de hoje confere com o material usado antes.

### 1.2 Campos exatos (fonte executável: tipos + schema gerado)

`src/spec.types.ts` (interface `McpUiHostCapabilities`, linha 494):

- linha 521: `updateModelContext?: McpUiSupportedContentBlockModalities;`
- linha 523: `message?: McpUiSupportedContentBlockModalities;`

`src/spec.types.ts` (interface `McpUiSupportedContentBlockModalities`, linha 462):

- linha 464: `text?: {};`
- linha 474: `structuredContent?: {};`

`src/generated/schema.ts` (schema Zod gerado, o que o SDK usa em runtime):

- linha 498: `export const McpUiHostCapabilitiesSchema = z.object({`
- linhas 558-561: `updateModelContext:` com
  `McpUiSupportedContentBlockModalitiesSchema.optional().describe("Host accepts context updates (ui/update-model-context) …")`
- linhas 563-565: `message: McpUiSupportedContentBlockModalitiesSchema.optional().describe("Host supports receiving content messages (ui/message) from the view.")`
- linha 451: `export const McpUiSupportedContentBlockModalitiesSchema = z.object({`
- linha 453: `text: z.object({}).optional().describe("Host supports text content blocks.")`
- linhas 474-478: `structuredContent: z.object({}).optional().describe("Host supports structured content.")`

Conclusão da verificação: **a suposição do painel está correta**. As chaves
existem no contrato executável, e cada modalidade (inclusive `text` e
`structuredContent`) é **opcional**: ausência significa "não declarada".

### 1.3 A API do SDK não faz o gate; o View precisa fazer

`src/app.ts`:

- `getHostCapabilities()` (linha 767) devolve `McpUiHostCapabilities | undefined`
  guardado em `this._hostCapabilities = result.hostCapabilities` (linha 2038).
- `sendMessage` (linha 1552) e `updateModelContext` (linha 1643) apenas chamam
  `_assertInitialized(...)`; **não** checam capabilities antes de enviar.
- Ou seja: feature detect é responsabilidade do View (o painel Mesa já faz).

### 1.4 Divergência de fontes: a prosa da spec está atrás do tipos

`specification/2026-01-26/apps.mdx`, seção `### Host Capabilities` (linha 622),
ainda descreve uma interface `HostCapabilities` (linhas 628-666) com apenas
`experimental`, `openLinks`, `serverTools`, `serverResources`, `logging` e
`sandbox` — **sem** `message`/`updateModelContext`. O contrato executável
(`spec.types.ts` + `schema.ts`) é mais novo que essa seção e inclui as duas
chaves. Documentar as duas coisas importa: quem ler só a prosa conclui (como a
pesquisa local anterior) que as chaves não existem, mas o schema que o SDK
valida as documenta.

### 1.5 Decisão (sem afrouxar os gates)

- `serverTools` → habilita `tools/call` (navegação, biblioteca, janelas, captura).
- `message.text` → habilita **Pedir ajuda** (`ui/message`, `content` de texto).
  Se `message` existe mas `text` não foi declarado (ex.: `message: {image: {}}`),
  o painel **não tenta**.
- `updateModelContext.structuredContent` → habilita `ui/update-model-context`
  (só referências, nunca imagem). Se só `text` foi declarado, o painel **não
  envia** (o payload dele é `structuredContent`).
- `hostCapabilities` nulo/ausente (host fora do padrão; no schema o campo é
  obrigatório no resultado de `ui/initialize`): o painel **tenta** `ui/message`
  e mostra a recusa real da ponte como erro honesto — a mesma política já usada
  para "caps nulo" que a revisão apontou como a mais segura. Para
  `ui/update-model-context` a falha é silenciosa (contexto é melhor esforço; não
  é ação visível do usuário).

Nada foi afrouxado: chave ausente continua sendo "não declarado → não tenta".

### 1.6 Testes que fixam a decisão

`tests/ui-client.test.mjs` (rodam o script inline real com a ponte simulada):

- `capabilities (schema ext-apps 2026-01-26): message.text e updateModelContext.structuredContent são as modalidades exigidas`
  — `message: {image: {}}` desliga e não envia; `updateModelContext: {text: {}}`
  não recebe `ui/update-model-context`; as duas chaves na forma do schema
  habilitam os dois pedidos.
- `capabilities: host sem hostCapabilities tenta e mostra a recusa real` —
  `hostCapabilities: null`: `ui/message` é tentado, resposta `isError` vira erro
  visível e dá para tentar de novo.
- `diagnóstico: handshake registra hostCapabilities cru no console do host (R4, teste real pendente)`
  — o painel emite **uma** linha `[mesa] hostCapabilities {…}` depois do
  handshake (e nada antes), exatamente para o teste real conseguir copiar o
  JSON cru sem montar instrumentação própria; o log não vai à conversa nem à
  rede.
- Testes existentes preservados: `ajuda: capability ausente desliga o botão e
  nenhum clique envia mensagem` (inclui `message: {}`), `feature detect: sem
  ui/message…`, `serverTools ausente: …` (gate de tools/call).

O comentário de fonte foi fixado no próprio painel (`ui/desk.html`, bloco antes
de `serverToolsSupported()`) citando `spec.types.ts`/`McpUiHostCapabilities` e a
regra "chave ausente = não declarada".

---

## 2. R6 — `size-changed` antes do handshake: correção

**Antes.** `setupSizeReporter()` era armado antes de `start()`; `measure()` não
checava `state.initialized` e podia enviar `ui/notifications/size-changed` antes
da resposta de `ui/initialize` (perdido por host que descarta mensagens
pré-handshake).

**Depois** (`ui/desk.html`):

- `measure()` só envia com `state.initialized === true`; a medida pré-handshake
  não grava em `lastSizeSent`.
- Depois de `notify('ui/notifications/initialized', {})`, `reportInitialSize()`
  mede as dimensões **atuais** do layout e envia o primeiro aviso uma única vez
  — mesmo que o observer/timer já tenha medido antes do handshake.
- O dedupe por medida continua valendo depois; teardown continua parando tudo;
  sem `ResizeObserver` o aviso inicial continua (via `reportInitialSize()`).

Testes novos (`tests/ui-client.test.mjs`):

- `tamanho: size-changed nunca sai antes do handshake; o inicial sai depois de initialized`
  — handshake atrasado de propósito (`ui/initialize` sem resposta), timer de
  100ms e observer disparados: zero `size-changed` e zero `initialized`; após a
  resposta, `initialized` vem antes e o primeiro `size-changed` sai exatamente
  uma vez com a medida atual.
- `tamanho: medida pré-handshake não conta como enviada; o aviso inicial usa o layout atual e o dedupe segue`
  — medida pré-handshake 400×800, layout muda para 512×861 antes do handshake:
  o único aviso inicial é 512×861; mesma medida não repete; medida nova reavisa.

Testes existentes de dedupe, teto de altura (20000 px), teardown e ausência de
`ResizeObserver` continuam passando.

---

## 3. Resultados desta rodada (simulador local, não Codex)

- `node --test tests/ui-client.test.mjs` → **40/40 passando, 0 falhas**
  (eram 35; +2 de R6, +2 de R4 e +1 do diagnóstico do handshake),
  2026-10-06 ~19:33 -03.
- `npm test` (pacote `codex-plugin/mesa-study` inteiro) → **140/140 passando,
  0 falhas** no mesmo instante.
- Discriminação: tudo aqui é **ponte simulada em `node:vm`**, mais os testes de
  Poppler/staging dos outros arquivos. Nada é execução no app Codex nem captura
  real do Xournal++.

Arquivos desta rodada (sha256 depois das edições):

| Arquivo | sha256 |
|---|---|
| `codex-plugin/mesa-study/ui/desk.html` | `db6505fd838d60606925b884d301bd49b24b9dad3b0a3f78a7ebed111734cfb6` |
| `codex-plugin/mesa-study/tests/ui-client.test.mjs` | `ea0c9c3295b7f2bdd45dab41a9c98a7fcf1e3c5ce80eb9eea5e781457dc03c81` |
| `codex-plugin/mesa-study/ui/README.md` | `470538a67fa7977311f0de33dfd3c5165c7d5489e2d7f1a939b5ed3d83e73f3a` |
| `docs/reviews/mesa-codex-ui-capabilities-20261006.md` (este documento) | evidência viva da rodada; sem hash auto-referente estável |

Antes das edições, os hashes eram `569a9331…` (`ui/desk.html`) e `6205105d…`
(`tests/ui-client.test.mjs`), iguais aos do snapshot da revisão independente.

Arquivos **não** tocados por esta rodada (seguem do outro agente):
`server/ui.mjs`, `server/server.mjs`, `server/tools.mjs`, `server/library.mjs`,
`server/png.mjs`, `host/**`, `scripts/**`, `README.md` do pacote, `SKILL.md`,
`tests/manual-study.md` e os demais testes.

---

## 4. Preservações exigidas

- Metadados atômicos de página/preview/contexto, token global de época, zoom
  com as duas bordas, `ui/message` com `content` ARRAY, aviso de nova captura e
  captura somente por ação explícita: sem mudança de comportamento; os testes
  que os pinam seguem passando.
- `ui/README.md`: a nota de que o **loader real é `server/ui.mjs`** e a de que
  a imagem MCP **não é uma prévia exclusivamente local** (destino depende do
  host) foram mantidas; a seção nova só acrescenta capabilities/ordem.
- Versão `0.2.0-experimental` e contrato das sete ferramentas: intactos.

---

## 5. Pendente no Codex real (sem garantia)

Nada nesta rodada valida o app. Para fechar o R4 no host real, o teste manual
deve registrar o **JSON cru de `hostCapabilities`** da resposta de
`ui/initialize` (o painel registra uma linha `[mesa] hostCapabilities …` no
console do host depois do handshake; se o console não estiver acessível, copie
das mensagens da ponte) e conferir:

1. `message.text` presente? `updateModelContext.structuredContent` presente?
   `serverTools` presente? (É isso que habilita **Pedir ajuda**, contexto e
   `tools/call` no painel.)
2. O host resolve `tools/call` do iframe pelos nomes não prefixados
   (`mesa_page` etc.) ou expõe `mcp__mesa__*` ao modelo?
3. O painel renderiza (lado direito?), `data:image/png` aparece, e
   `ui/notifications/size-changed` pós-handshake é aceito?
4. Se `hostCapabilities` vier sem as chaves (ou `null`), registrar a recusa
   real do `ui/message` — o fallback honesto do painel é exatamente esse.

Até esse registro, **Codex real = pendente, sem garantia**. A matriz oficial de
clientes continua sem o Codex e o repo oficial não traz contrato de host para o
app; o que este documento prova é o contrato executável do **schema** e o
comportamento do painel contra ele, não a compatibilidade do Codex.

---

## 6. O que este documento prova e o que não prova

**Prova:** (a) `message.text` e `updateModelContext.structuredContent` constam do
contrato executável oficial (tipos + schema gerado) da revisão 2026-01-26, com
arquivo/linha/sha256; (b) a prosa da spec omite as chaves; (c) os gates do
painel correspondem ao schema (ausência = não declarada) e o fallback de caps
nulo é tentar + erro honesto; (d) a ordem `initialize → initialized →
size-changed` está corrigida e pinada por teste; (e) a suíte local passa.

**Não prova:** qualquer comportamento do Codex real, o conteúdo real de
`hostCapabilities` no app, a resolução dos nomes de ferramenta pelo host, a
captura real do Xournal++ nem a exibição do painel. Esses itens continuam
pendentes de teste manual e devem permanecer rotulados assim no README/skill.
