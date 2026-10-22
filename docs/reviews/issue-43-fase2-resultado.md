# #43 fase 2 — arquivos grandes divididos por responsabilidade

Branch `claude/festive-yalow-99cdc7`, local, sem push nem PR. Base:
`ca681f7` (merge-base com `main`). A fase 3 (tipos, lint, erros, logs) fica de
fora.

## Resultado em números

Conta de `desk/` com as regras de `tests/file-size.test.mjs` (`.cjs .mjs .js
.css .html`, fora `node_modules`, `tests`, `assets`, `locales`,
`src/generated` e pastas com ponto).

| | Antes (`ca681f7`) | Depois |
|---|---|---|
| Arquivos de código | 215 | 313 |
| Linhas no total | 56 107 | 57 297 (+1 190: cabeçalho, `require`/`import`, JSDoc das fábricas novas) |
| Acima de 800 linhas | 18 | 1 (`index.html`, 865) |
| Entre 501 e 800 | 11 | 18 (os que caíram do legado para essa faixa) |
| Maior arquivo novo | — | 487 (`src/free-study-pdf.mjs`) |

Nenhum arquivo criado nesta fase passa de 500 linhas.

O teto ficou travado em `desk/tests/file-size.test.mjs` (commit `626d9eb`):
- 800 linhas para qualquer arquivo;
- 500 para arquivo novo;
- `LEGACY_CAPS` guarda o teto próprio de quem ainda passa de 800 e só pode
  cair. Agora tem só `index.html: 865`;
- `MEDIUM_FILES` lista quem está entre 501 e 800 e só encolhe.

## O que foi para onde

Na tabela, o número entre parênteses é a contagem de linhas. A descrição de
cada módulo está em `docs/agents/mapa.md`, seção "Arquivos divididos por
responsabilidade".

| Antes | Depois | Para onde foi |
|---|---|---|
| `src/agents/claude-adapter.cjs` (3056) | 788 | `-contract`, `-input`, `-history`, `-controls`, `-turns`, `-query`, `-rate-limit`, `-stream` e `-permissions`, instalados no protótipo por `src/prototype-mixins.cjs` |
| `style.css` (2166) | 139 | 16 CSS por área em `src/`, importados na ordem original por `src/desk-areas.css` |
| `main.cjs` (1970) | 676 | **Partida:** `desk-boot-config`, `desk-log`, `ggb-cache`, `desk-version`, `desk-state-sanitize`, `free-boot-recovery`.<br>**Tutor:** `tutor-engine-host`, `prompt-images`, `tutor-bridge-host`, `tutor-session-ipc`, `tutor-prompt-host`.<br>**Livre:** `desk-guards-host`, `free-session-host`, `free-promotion-host`, `config-write`.<br>**Matéria:** `course-state-host`, `study-records-host`, `chat-export-host`.<br>**App:** `desk-menu`, `desk-notify-host`. |
| `src/study-data/search.cjs` (1400) | 492 | `search-text`, `-sources`, `-index`, `-extract` |
| `src/study-data/backup.cjs` (1385) | 399 | `backup-files`, `-config`, `-capture`, `-snapshot`, `-schedule`, `-relocate` |
| `src/main.mjs` (1233) | 769 | `nav-menus`, `header-tabs`, `context-pop`, `course-conversations`, `about-update` |
| `activity-runtime.cjs` (1155) | 354 | `activity-protocol`, `-lockdown-script`, `-page-script`, `-document` |
| `src/activity.mjs` (1126) | 490 | `activity-messages`, `-card-dom`, `-frame` |
| `src/free-study.mjs` (1085) | 385 | `free-study-base`, `-chrome`, `-pdf` |
| `free-workspaces.cjs` (1063) | 131 | `free-workspace-record`, `-store`, `-materials`, `-promotion` |
| `src/chat.mjs` (1026) | 529 | `chat-turn-state`, `-message-view`, `-turn`, `-notices` |
| `updater.cjs` (1023) | 344 | `updater-core`, `-check`, `-files`, `-worker` |
| `src/materials/template.mjs` (994) | 449 | `template-protect`, `-tokens`, `-page` |
| `src/sidechat.mjs` (920) | 767 | `sidechat-message-view`, `sidechat-requests` |
| `src/state.mjs` (884) | 768 | `context-meter`, `live-view` |
| `sidechat.cjs` (838) | 596 | `sidechat-store` |
| `src/study-data/packages.cjs` (811) | 210 | `package-common`, `-source`, `-read`, `-import` |
| `index.html` (865) | 865 | não mudou (veja "Pendências") |

### Como ficou sem mudar comportamento

- **Porta pública intacta.** Cada arquivo dividido continua exportando o mesmo
  objeto. As camadas `.cjs` só requerem camadas abaixo delas, e as portas
  reexportam as mesmas funções. Os dois pontos estão travados em
  `tests/split-layers.test.mjs`.
- **Estado do main por um objeto `live`.** O estado vivo do main chega aos hosts
  pelo `live`, com getters e setters. Host criado antes de outro recebe a função
  dele por wrapper, nunca por valor.
- **Estado mutável do renderer num objeto.** Exemplos: `freeState` e
  `turnState`. As fábricas `createX(ctx)` leem o contexto de forma preguiçosa.
- **Injeção onde haveria ciclo de import.** Exemplos: `initHeaderTabs` e
  `connectPdfDialog`.
- **CSS na mesma ordem.** `src/desk-areas.css` importa os pedaços na ordem do
  `style.css` antigo. Conferi que a concatenação deles é idêntica ao original.
- **Efeitos de topo no mesmo ponto.** Quando uma divisão tirava um efeito de
  topo do lugar, ele virou uma função chamada exatamente onde estava antes. É o
  caso de `installContextMeter()` no `state.mjs`, que mantém a ordem dos
  listeners.
- **Nenhum núcleo Bend mexido.** `npm run verify:bend` dá 68 artefatos
  reproduzíveis e as provas ficam verdes.

### Duplicação entre `desk/` e os hosts

Commit `f4e410b`:

- **`plain-object.cjs`:** substitui 20 cópias de `isPlainObject` nos módulos do
  main. `tests/plain-object.test.mjs` impede que algum `.cjs` volte a defini-la.
- **`json-file.cjs`:** leva o `readJson` tolerante (5 cópias) e o `atomicWrite`
  (2 cópias em uso; a de `package-common.cjs` nunca era chamada e saiu).
- **Variantes com comportamento próprio ficaram onde estão:**
  - `readJson` do `activity-store` (erro `CORRUPT`);
  - `readJson` do `search-text` (limite de tamanho);
  - `writeAtomic` do `sidechat-store` (serializa e limpa o temporário).
- **Fica para depois:**
  - `escapeHtml` aparece em 5 versões diferentes (`phone-page`,
    `activity-document`, `highlight`, `backup-panel`, `template`), e as
    diferenças de regex mudam a saída. Unificar é ticket próprio.
  - `applyAttrs` do `tooltip.mjs` faz outra coisa que o de `live-view.mjs`.
  - `isPlainObject` e `isObject` do renderer (`src/layout-presets.mjs`,
    `src/layout-settings.mjs`) não podem usar `require`.

## Bugs achados e corrigidos (cada um com teste de regressão)

1. **Sessão Livre da partida hidratava antes do host do tutor existir**
   (`60f849a`). Ao tirar o motor do main, o host do motor passou a nascer
   depois do `bootFree`. O erro de TDZ caía no `catch` da hidratação, e a
   conversa Claude da partida era gravada como Pi. Agora a hidratação vem
   depois; o teste de regressão está em `core.test.mjs`.
2. **Aviso de ref inválida no envio ao tutor não saía traduzido** (`35315f6`).
   No `pi-prompt`, um `let message` local escondia o `message()` do i18n. A
   variável virou `promptText`.
3. **O worker de atualização não levava o `src/i18n.mjs`** (`fdd0116`). Desde a
   #41, o worker copiado para o tmpdir caía em `MODULE_NOT_FOUND`. Agora
   `WORKER_FILES` lista as partes e o i18n, e `stageWorkerFiles` devolve
   `{ok:false}` se a cópia falhar.

## Portões

- **`MESA_GATE_CACHE=0 npm test`:** verde em todo commit. No fim: 1604 testes,
  1604 ok.
- **`npm run verify:bend`:** ok.
- **`node tests/bundle-payload-ui.mjs`:** PASS.
- **`npm run test:packaged`:** PASS.
- **`npm run ui`:** 68 ok, 3 falhas. As três falham igual na base `ca681f7`
  (rodei numa worktree temporária, já removida), então não vêm desta fase:
  - `language-ui`: sobra "and" em "Change model and effort." no rótulo do tutor;
  - `model-indicator-ui`: o teste não espera o `phone-photo` na fileira;
  - `sidechat-layout-ui`: a tela desta máquina não deixa a janela chegar a
    1440×900 (fica 1440×853).

  Os commits da `main` posteriores à base (`6f4ac20`, `74d2697`, `d430757`)
  mexem em `language-sweep.mjs` e `model-indicator-ui.mjs` e podem já corrigir
  as duas primeiras.
- **`npm run hunts`:** 23 ok, 1 falha (`hunt-language`: "Made with GeoGebra®"
  nas Configurações). Também falha igual na base.
- **Intermitentes sob carga:** `test-harness`, `free-host-ipc` e `study-ipc`
  deram timeout uma vez cada durante a fase. Passam sozinhos e nas rodadas
  seguintes. Uma rodada do `npm test` contou 1598 em vez de 1600 (erro do
  reporter); a repetição e a comparação numa worktree limpa deram o número
  certo.

## Pendências e observações

- **`index.html` (865) segue acima do teto.** Os módulos consultam o DOM dele
  ao carregar (por exemplo `$('#auto-compact').onclick` no `state.mjs` e os
  listeners do `main.mjs`). Montar parte da marcação por JS muda o momento em
  que os nós existem, ou seja, muda comportamento. Candidato natural: o
  conteúdo do Guia da Mesa (`#help-dialog`, cerca de 225 linhas de texto
  estático), montado na abertura a partir dos catálogos. Fica para um ticket
  próprio. O teto de 865 só pode cair.
- **Divisões do renderer sem teste de unidade.** São as de `src/main.mjs`,
  `free-study`, `chat`, `sidechat` e `state`. Os módulos dependem do DOM e do
  `state.mjs`, então quem as cobre é a bateria de janelas. A exceção é
  `src/activity.mjs`, que ganhou fakes de DOM nomeados
  (`tests/fake-activity-dom.mjs`) e `tests/activity-host-groups.test.mjs`.
- **Commits com dois módulos.** A regra era um módulo por commit, mas alguns
  juntaram dois hosts do mesmo assunto, que saíram juntos do main porque um
  chama o outro:
  - `9eb1111`: guardas e sessões Livre;
  - `db2697f`: promoção Livre e `config-write`;
  - `ffa0344`: menu e notificação;
  - `f976139`: registros de estudo e exportação do chat;
  - `51b0398`: IPC do tutor e `pi-prompt`;
  - `f4e410b`: os dois utilitários de duplicação.
- **Código morto encontrado (para a fase 3).** `uniqueName` em
  `free-workspace-record.cjs` já não era chamado no `free-workspaces.cjs`
  original. Ficou como estava.
- **Cherry-pick do `74d2697` da `main`.** Esse commit adiciona duas regras
  `#check` ao `style.css` (Conferir só com ícone no degrau `compact`). Depois
  desta fase, elas vão em `desk/src/header.css`, logo depois da linha 128 (a
  regra `#include-refs span{display:none}`). As duas linhas que ele soma ao
  `updateCheckButton` continuam em `src/state.mjs`, que esta fase não moveu.
- **CSS por `@import`.** `index.html` liga `src/desk-areas.css` logo depois do
  `style.css`. O `phone-host` continua lendo a paleta do `style.css`, onde os
  tokens ficaram.
