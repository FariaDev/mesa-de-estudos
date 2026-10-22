# #49: fronteira `Nat` (BigInt → number) no bend 2.0.37

**Estado:** a Mesa roda no bend 2.0.37 (`bendlang/bend@d2aeefc1`), fixado em
`core/toolchain.json`, e os artefatos foram regenerados. Nenhuma lei nem prova
mudou de conteúdo. A única exceção é a saída do `handoff`, abaixo.
`chat/` saiu do escopo: a Conversa foi aposentada na #50.

## Commits (um por camada)

| Commit | Camada |
|---|---|
| `fe8639e` | `handoff` sai do contrato `Caps` (ainda no 2.0.27) |
| `53fc0ec`, `c2202ad` (wholeNat), `b8c5e47` (roundNat) | casca `desk/src/bend-nat.mjs` |
| `42beb4e` | hosts do main |
| `67a73ec` | renderer |
| `b810e6b` | defeito achado na migração: `stop()` do `rpc.cjs` |
| `b93f073` | testes, paridades e a regra que trava o BigInt |
| `bee6982` | refixar a toolchain, artefatos regenerados, documentação |

Entre o commit da casca e o da refixação, a árvore não fecha a suíte: o código
já passa `number`, mas os artefatos ainda são do 2.0.27. A suíte fecha de novo
no `bee6982`.

## A casca

`desk/src/bend-nat.mjs` (`// @ts-check`, no `tsconfig.json`; testes em
`desk/tests/bend-nat.test.mjs`). O main faz `require` dela e o renderer faz
`import`.

- `toNat(n)`: para o que a própria Mesa produz (tamanho de lista, índice,
  `Date.now()`, status HTTP). Recusa fração, negativo, NaN, string, BigInt e
  valor acima de `NAT_MAX`, com `TypeError` que diz o valor recebido e o formato
  esperado.
- `wholeNat(x, min = 0)`: para o que vem de fora (JSON em disco, IPC, DOM).
  Trunca, leva não finito a `min` e satura em `min..NAT_MAX`. Nunca lança.
  Substitui os `BigInt(Math.max(0, Math.trunc(Number(x) || 0)))` e os `whole()`
  locais.
- `roundNat(x)`: `wholeNat(Math.round(x))`, para medidas em px (presets do main
  e do renderer, quadro de atividade).

**Teto: `NAT_MAX = 2^48 - 1`, não 2^53.** O artefato do 2.0.37 aceita um `Nat`
de entrada até 2^53 (`nat_in`), mas soma e multiplicação passam por `nat_chk`,
que lança acima de 2^48-1 ("a Nat past the largest immediate"). O 2.0.27 tinha o
mesmo `nat_chk` em BigInt, então o teto efetivo não mudou.

**Regra travada:** `bend-nat.test.mjs` varre `desk/` e `core/` (fora
`node_modules`, `generated`, `.runtime`) e reprova `BigInt(` e literal `\d+n`.
Há três exceções, cada uma com motivo: a casca, o próprio teste e
`tests/pdf-model-samples.cjs`, onde `12+3n` é texto de matemática. Um segundo
teste confirma que a varredura pega `=== 0n`, `assert.equal(x, 2n)` e
`f(10n, 1n)`, e não pega `token1n` nem `x.n1n`.

## `Nat` que cruzam a fronteira e o limite de cada um

O limite é sempre 2^48-1 ≈ 2,8·10^14. "Folga" compara o pior caso realista com
esse teto.

| Valor | Onde | Pior caso realista | Cabe? |
|---|---|---|---|
| `now`, `expiresAt`, `deadline` (ms) | `deletion-undo.cjs`, `src/undo-deletion.mjs` (`expiryFrom`, `isExpired`, `remainingMs`, `secondsLeft`) | `Date.now()` ≈ 1,8·10^12, mais o TTL. 2^48 ms é o ano 10889 | sim, folga de ~150× |
| TTL de desfazer (ms) | `deletion-undo.cjs` | segundos a minutos | sim |
| batimento anterior e atual (s) | `statistics.cjs` (`activeSeconds`) | `Date.now()/1000` ≈ 1,8·10^9 | sim |
| segundos de estudo, sessões, perguntas, tokens | `statistics.cjs`, `study-stats-text.mjs` (`durationLabel`, `countLabel`, `TokenCount`) | somas de uma vida de uso; tokens ≈ 10^9 a 10^10 | sim |
| dia, fuso em minutos, dia da semana | `statistics.cjs` (`dayNumber`, `inPeriod`, `windowStart`, `weekdayLabel`) | dia ≈ 2·10^4; fuso ≤ 840; 0..6 | sim |
| dia, intervalo, repetições, lapsos e vencimento da revisão | `review-schedule.cjs`, `src/review.mjs` | dias ≈ 10^4; contagens pequenas | sim |
| páginas (física, impressa, total, alvo, favoritos, sumário, notas, retomada, citação) | `pdf.mjs`, `pdf-labels.mjs`, `nav.mjs`, `bookmarks.cjs`, `resume.cjs`, `review.cjs`, `pending.cjs`, `annotations.cjs`, `pdf-notes.mjs`, `study-search.mjs`, `chat-refs.mjs`, `materials/model.mjs` | milhares; deslocamento impresso ≤ 10^6 (`MAX_PAGE_OFFSET`) | sim |
| profundidade do sumário, rotação (0..270), zoom % | `nav.mjs`, `pdf.mjs`, `desk-state-sanitize.cjs` | pequenos | sim |
| contagens de ocorrências da busca | `pdf.mjs` (`findCount`, `cycleTarget`) | milhares | sim |
| tamanhos de lista (fila, anexos, imagens, quadro, entradas da revisão) | `pending.cjs`, `queue.mjs`, `ggb-board.cjs`, `ggb.mjs`, `review.mjs` | dezenas a centenas | sim |
| `MAX_DRAFT` (caracteres) | `pending.cjs` (`cutText`) | constante pequena | sim |
| `pending` e `seq` do rpc | `rpc.cjs` | `seq` cresce um por pedido. Mesmo 1000 pedidos/s levariam ~9000 anos para chegar a 2^48 | sim |
| tentativa de nome livre | `material-pdf.cjs`, `free-workspace-*.cjs` | `MAX_ATTEMPTS` | sim |
| contagem de tentativas na fila | `queue-retry.mjs` (`retryDelay`) | `maxAutoRetries` | sim |
| porcentagem do medidor, ajuste de colunas | `context-meter.mjs`, `materials/model.mjs` | 0..100, px | sim |
| larguras, alturas e divisão (px, ‰) | `layout-presets.cjs`, `src/layout-presets.mjs`, `activity-view.mjs` | px de tela; o núcleo apara | sim |
| status HTTP | `opencode-host.cjs` (`outcome`) | 100..599 | sim |
| data da sessão (dia, mês, hora, minuto) | `lib.cjs` (`formatSessionLabel`) | ≤ 59 | sim |
| limite de quadro do framing | `tests/framing-parity.mjs` | 32 MiB | sim |

**Nenhum valor chega perto do teto.** Os que vêm do disco passam por `wholeNat`,
que satura em 2^48-1. Um JSON adulterado com página 10^20 vira página 2^48-1 em
vez de lançar. Antes, o BigInt aceitava o número exato. Para uma página, nenhum
dos dois comportamentos faz sentido, e saturar não derruba a leitura.

## `F32`

O 2.0.37 passa os argumentos `F32` por `Math.fround`, e o 2.0.27 não fazia isso
(`wheel` e `state` não tinham nenhum `fround`; agora têm 6 e 3). Não precisei
mudar nada:

- `state`: o `state-adapter.cjs` já devolvia `Math.fround(.2/.8)` ao decimal
  canônico, e o `state-parity.mjs` cobre isso. A paridade passa.
- `wheel`: `tests/wheel.test.mjs` usa deltas que o F32 representa exatamente e
  passa. O acumulado da roda agora arredonda para F32 a cada passo. O limiar
  compara dentro do núcleo, então a diferença fica abaixo de 10^-7 px por evento.

## Defeito achado: `stop()` do `rpc.cjs` (`b810e6b`)

`stop()` espalhava os quatro fatos de `facts()` (vivo, parado, pendentes, seq)
no `rpcstate.onStop`, que recebe três (vivo, pendentes, seq). No 2.0.27, o
booleano `stopped` entrava calado como `pending`, e o tamanho da fila virava o
novo `seq`. O `seq` voltava a 0 a cada `stop()`, e os ids `desk-N` podiam se
repetir depois de religar. No 2.0.37, o `nat_in` recusou o booleano. A correção
passa os três fatos certos, e o teste de regressão
`stop mantém o seq: o próximo pedido nunca repete id` está em
`tests/rpc.test.mjs`.

É o mesmo tipo de defeito que a migração só acha se algum teste passar por ali:
o `nat_in` vigia os `Nat` no topo de cada função exportada, e um erro de
aridade só aparece quando cai num parâmetro `Nat`. Não há verificação estática
das aridades das chamadas aos artefatos.

## `core/unsafe-scan.mjs`: fica

Teste negativo numa cópia de `core/` no scratchpad, com uma lei falsa
`{True{} == False{}}` provada por um `@unsafe def` que nunca termina:

| Toolchain | Resultado |
|---|---|
| 2.0.27 (`~/.bend`) | `All terms check.`, exit 0 |
| 2.0.37 fixado | `SOME PROOFS FAIL`, `defs that depend on @unsafe: laws/wheel.cheat_law, proofs/wheel.cheatp`, exit 1 |

O `bend PROOF.bend` simples do 2.0.37 já recusa `@unsafe` e código estrangeiro
(`book_promises`). **Decisão: a varredura fica**, como segunda camada barata.
Ela não depende da toolchain e pega o escape numa máquina que ainda tenha o
`~/.bend` antigo, antes de o `verify` reclamar da versão. Atualizei os
comentários, a mensagem de recusa, `docs/agents/portoes.md` e o teste
`core-unsafe`.

## `handoff` removido (`fe8639e`)

- `core/agentcaps.bend`: sai o campo `handoff` de `Caps` (13 → 12 campos), sai
  `ControlHandoff`, e saem a posição dele nos sete literais e o caso em
  `controlVisible`.
- `core/laws/agentcaps.bend` e `core/proofs/agentcaps.bend`: saem as quatro
  leis `caps_{claude,claude,pi,opencode}_bilhete*` e as provas delas. Os
  literais das leis de fatos perdem a posição.
- `desk/src/state.mjs`: sai a chave de `CAP_KEYS`.
- `desk/src/agents/claude-adapter-contract.cjs`: sai `handoff: false`.
- Testes: `agent-service.test.mjs` passa a exigir que nenhum motor (`claude`,
  `pi`, `opencode`, desconhecido) traga a chave.
- `rg -n handoff desk core`: sobram só o comentário histórico em
  `core/agentcaps.bend` e os testes que provam a aposentadoria da Conversa (a
  pasta `handoff/` antiga no backup, o updater apagando `handoff.cjs`). Nenhum
  consumidor do cap.
- Verificado no 2.0.27, antes da migração: `verify:bend` verde e 1840/1840.

## Contagem

| | Antes (`389bc1f`) | Depois |
|---|---|---|
| Linhas com `BigInt(`, literal `\d+n` ou `bigint` em `desk/` e `core/` (fora gerados) | 195 linhas em 50 arquivos (`BigInt(`: 111 linhas em 40 arquivos; literal: 81 em 16; `bigint`: 4 em 4) | `BigInt(` só na casca e no teste dela. Literal só nas três exceções da regra. `bigint` só em `error-detail.mjs` (descreve qualquer valor recebido) e `highlight.mjs` (palavra-chave SQL) |
| Artefatos gerados com BigInt | 56 de 68 | 0 de 68 |

## Portões

Rodados com `source ~/.bend-toolchains/d2aeefc1/env.sh` e `BEND_BIN` vazio. O
`~/.bend` continua no 2.0.27 (ver "Sem prova").

| Portão | Resultado |
|---|---|
| `npm run verify:bend` (HEAD fixado) | ok: 68 artefatos reproduzíveis, `ALL PROOFS CHECK` |
| `MESA_GATE_CACHE=0 npm test` | 1848/1848, 7 paridades ok, `check`/`typecheck`/`lint` ok |
| `npm run test:claude-ui` | 10/10 arquivos PASS (SDK sintético, sem inferência) |
| `npm run test:packaged` | PASS (Claude Code falso, sem inferência) |
| `node tests/native-tutor-pdf.mjs` | PASS |
| `node tests/native-activity-tool.mjs` | PASS |
| `node tests/native-tool-parity.mjs` | ok |
| `npm run ui` | 74/74 ok (72 na rodada cheia; os 2 restantes repetidos com a tela desbloqueada, ver abaixo) |
| `npm run hunts` | 24/24 ok |

Na rodada cheia do `npm run ui`, `activity-ggb-overlay-ui` e `toast-position-ui`
falharam no `screencapture -l <janela>`, com a mensagem "could not create image
from window", antes de qualquer asserção da Mesa. A tela do Mac estava bloqueada
(`CGSSessionScreenIsLocked = true`; o usuário estava no Remote Control), e os dois
são os únicos testes que usam `tests/window-pixels.mjs` (pixels reais da janela).
Com a tela desbloqueada, `npm run ui -- activity-ggb-overlay,toast-position --jobs 1`
passou: 2 ok, no `main` com os commits da #49.

## O que ficou sem prova

- **`--verdict` (recheck pelo kernel BendTT em Lean):** não rodei. A máquina
  não tem Lean nem elan, e instalar sai do escopo. O `ALL PROOFS CHECK` acima é
  o do bend2.
- **`~/.bend` ainda é 2.0.27.** Não mexi nele, nem no `~/.bun`. Num shell sem o
  `env.sh`, `npm run verify:bend`, o `npm test` (o pretest reconstrói os
  artefatos com o `~/.bend`) e o hook de pre-push vão falhar ou regenerar com o
  2.0.27. O `tests/study-core-build.mjs` também compila o núcleo de estudo com
  o `BEND_HOME`. Trocar o `~/.bend` para d2aeefc1 é decisão do usuário, porque
  outras worktrees no `main` ainda esperam o 2.0.27.
- **Aridade das chamadas aos artefatos:** não há checagem estática. O defeito do
  `rpc.cjs` apareceu por um teste. Outra chamada com aridade errada que não caia
  num `Nat` continua calada.
- **Saturação em `wholeNat`:** um valor do disco acima de 2^48-1 vira 2^48-1, e
  antes o BigInt o levava exato. Não há teste de janela para isso; só os testes
  unitários da casca.
- **Roda do PDF em F32:** o arredondamento do acumulado está coberto por
  `wheel.test` com deltas exatos. Não medi com deltas fracionários de trackpad
  reais.
