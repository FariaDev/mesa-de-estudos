# #63: linguagem de movimento, resultado

Inventário e tokens em [`docs/design/movimento.md`](../design/movimento.md),
aprovados pelo autor em 2026-10-21 antes de aplicar.

## O que mudou

- **Tokens** (`desk/style.css`): `--t-fast` 120ms, `--t-base` 180ms (era 150),
  `--t-slow` 320ms (no lugar de `--t-slower` 500ms), `--t-loop` 1.2s para os
  laços, `--ease-out` e `--ease-move`, e os pontos de partida
  `--from-drop`/`--from-rise`/`--from-zoom`.
- **Um módulo de movimento**: `motion-density.css` virou `src/motion.css`
  (movimento) e `src/density.css` (densidade), na mesma posição da cascata.
  Keyframes únicos (`mesa-in` lê `--motion-from`; `mesa-in-up` saiu), uma regra
  `.closing` só (a cópia de `notices.css` saiu), entrada e saída por `[hidden]`
  com `display … allow-discrete` + `@starting-style`, e diálogos que agora
  também fecham animados (com o véu).
- **Saídas novas**: seletor de modelo, popovers do tutor e do chat lateral,
  "Vai junto", foto do celular, paleta ⌘K, barra do GeoGebra, desfazer, aviso de
  atualização, balões e botão de citar, diálogos.
- **Entradas novas**: as mesmas acima, mais mensagem nova (tutor e chat
  lateral), estado do tutor, anexos e menções, e o fade do conteúdo que volta
  ao abrir tutor, apoio, chat lateral, calculadora e caderno.
- **Reduzir movimento num lugar só**: o `@media` do `motion.css` só redefine
  tokens (`--from-*: none`, `--t-base` = fast, `--t-slow` e `--t-loop` = 0s).
  Saíram os blocos de `tutor-chat`, `slash-menu` (que já zerava tudo, escondido
  na folha do menu de barra), `mesa-qol`, `icon-motion` e `activity`.
- **Medidor sem `width`**: o núcleo emite `--meter:42%` (`meterFill` em
  `core/statusview.bend`, lei e prova renomeadas) e a barra enche por
  `transform:scaleX(var(--meter))` em `--t-slow`/`--ease-move`.
- **#61 absorvida**: copiar, guardar e conferir em `--t-slow`; o
  `cubic-bezier(.3,.7,.4,1)` do guardar virou `--ease-move`; a piscada da
  Folhinha é `calc(var(--t-loop) * 3)` (os mesmos 3.6s).
- Literais soltos e `ease` implícito trocados por tokens (`model-picker`,
  `readers`, `tutor-chat`, `activity`); hover e foco que estavam em base foram
  para fast.

## Decisões tomadas no caminho

- **Troca de matéria sem fade**: as páginas do PDF são canvas redesenhados também
  no zoom, então um fade nelas piscaria a cada zoom. O inventário registra
  "nenhum" e o motivo.
- **Menu de barra (`/`) sem saída**: some ao digitar, e esperar a saída
  atrapalharia o teclado.
- **`activity.css` sem fallback**: `var(--t-fast, 120ms)` virou
  `var(--t-fast)`. A fixture `tests/fixtures/activity/ui-host.html` não carrega
  os tokens e fica sem a transição de hover, que não é medida ali.
- **A janela de atividade** (`activity-page-script.cjs`) é outro documento e
  mantém o próprio `prefers-reduced-motion`.
- **Relógios de reserva** das saídas `.closing` em JS (fila 180ms, menus 400ms,
  busca 300ms, aviso 600ms) ficaram como estavam: todos acima do `--t-fast`.

## Portão: `tests/motion-tokens.test.mjs`

`tests/motion-lint.mjs` lê `desk/style.css` e `desk/src/*.css` e recusa,
com `arquivo:linha propriedade: achado → token a usar`:

- tempo literal em `transition*`/`animation*` (aponta o token mais perto);
- `ease`, `ease-in`, `ease-out`, `ease-in-out`, `cubic-bezier()`, `steps()`,
  `linear()`, e a palavra `linear` fora de animação infinita;
- item com duração e **sem** curva (cairia no `ease` padrão), fora de
  `allow-discrete`;
- `transition` de `all`, `width`, `height`, `top`/`left`/`right`/`bottom`,
  `inset`, `min-`/`max-`, `margin*`, `padding*`.

**Conferido que morde:**

1. Rodado sobre o CSS de antes da #63 (`git show HEAD:` de cada folha), acusa
   26 pontos, entre eles a transição de `width` do medidor, o `ease` solto do
   chevron, os `.38s`/`.5s` e o `cubic-bezier` da #61, o `.01ms` do
   `slash-menu` e as transições sem curva do `model-picker`.
2. Mutação: acrescentar `.slash-pop{transition:opacity 200ms ease-in}` ao
   `slash-menu.css` atual derruba o teste com
   `src/slash-menu.css:25 transition: 200ms → use var(--t-base)` e
   `… ease-in → use var(--ease-out) …`. Revertido.
3. O próprio teste guarda sete linhas reais do CSS antigo como casos que têm de
   acusar.

## Portões

- `npm run verify:bend`: ok (toolchain fixada, artefatos em dia, provas verdes).
- `MESA_GATE_CACHE=0 npm test`: 1967 de 1970. As 3 falhas
  (`free-host-ipc.test.mjs` "aba Livre no host" e as duas de prazo estourado em
  `test-harness.test.mjs`) foram tempo esgotado com a máquina em carga 95
  (outra sessão rodando junto). Os dois arquivos sozinhos: 12/12.
  - Antes disso a rodada caiu por ambiente: o `brew upgrade` de outra sessão
    trocou o `simdutf` e o `node` parou no meio; e o Electron do worktree tinha
    vindo truncado no `npm ci` (reinstalado com `node node_modules/electron/install.js`).
- Testes de janela, um por vez com a vez liberada pelo orquestrador:
  - `motion-ui` (novo): verde. Mede, sem `freezeMotion`, que o seletor de
    modelo entra de `--from-rise` e sai animado, que o diálogo entra e sai,
    que o Conferir toca o flash, que o medidor dá `matrix(0.42, …)` sem
    transição de largura, e que com `reducedMotion:'reduce'` emulado os
    `--from-*` são `none`, o spinner dura 0s e o seletor abre sem
    deslocamento. **Morde**: tirar `--from-rise:none` do `@media` derruba o
    teste com "nada se desloca com movimento reduzido".
  - Os 48 que medem posição/tempo (`rg -l "freezeMotion|layoutStable"`): 48/48
    na rodada final. Os outros 32 testes de janela: 32/32. Todos os 24 hunts:
    24/24.
  - O `color-roles-ui` caiu uma vez em 3s, na partida (cor de `.pdf-page`
    vazia), e passou nas repetições: intermitente, sem relação com movimento.

## Testes que precisaram mudar

A saída animada deixa o elemento na tela por `--t-fast` depois de ganhar
`[hidden]`, e o `isHidden()`/`isVisible()` do Playwright dizia "aberto" nesse
meio-tempo. Para o usuário não muda nada: na saída o popover já tem
`pointer-events:none`, e clicar no gatilho reabre. Os testes passaram a ler o
estado certo:

- `tests/helpers.mjs`: `insideHidden(locator)` lê o atributo `[hidden]`. Usado
  em `freeMenuClick`, `openTutorMore`, `openMore`, `openSessionList`,
  `closeSessionList`, `openStudyContext` e no fechar do "Vai junto",
  `openNewSessionMenu`, no abrir e no fechar do seletor de modelo. Sem isso,
  `free-study-ui` e `ui-smoke` esperavam 30s num menu que estava saindo.
- `ui-smoke`, `hunt-chat` (botão de citar), `hunt-calc-ggb` e `hunt-review`
  (`#ggb-bar`): `waitFor({state:'hidden'})` no lugar da leitura imediata.
- `ui-smoke` e `hunt-calc-ggb`: o estilo do medidor agora é `--meter:N%`.
- `folhinha.test.mjs`: a piscada para pelo `--t-loop:0s` do reduzir global.

## Retorno de um amigo do autor (via orquestrador)

1. **Conferir**: em vez de apagar o ícone, o fundo do botão acende no acento e
   volta ao dele (`motion-flash` em `icon-motion.css`, `--t-slow`,
   `--ease-out`). Quadros em `issue-63/quadros/conferir-flash-*`.
2. a 4. (lápis da Folhinha gira só na ponta; Cintilar sem fundo cinza; brilho
   do contorno `linear`, sem pausa): ainda não estão no app. Viraram regra em
   `docs/design/movimento.md`, "Regras para animações que ainda não entraram".

## Revisão visual

[`issue-63/quadros/`](issue-63/quadros/): quadros a 0, 25, 50, 75 e 100% de
cada transição, pausados pelas Web Animations (sem depender do tempo real),
claro e escuro, só com o perfil falso do teste: seletor de modelo entrando,
diálogo de configurações entrando e o flash do Conferir. Para gerar de novo:
`MESA_REVIEW_SHOTS=<pasta> npm run ui -- motion-ui`.
