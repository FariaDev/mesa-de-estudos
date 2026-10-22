# Issue #48 — testes de janela e hunts mais rápidos, sem perder cobertura

Resultado do trabalho na branch `claude/confident-kare-f357a4` (commits locais, sem push).
Máquina: macOS, Electron real, runtime sintético. Nenhuma inferência real, nenhum PDF ou
material de curso tocado, `desk/config.cjs`, `chat/` e o núcleo Bend intactos.

## Resumo

| | Antes | Depois | Variação |
|---|---|---|---|
| `npm run ui` (59 arquivos) | 380 s (401 / 372 / 366), 2 falhas em 3 rodadas | **237 s** (236 / 238 / 238), 3 por vez, 0 falhas | −38% |
| `npm run hunts` (23 + 1 pulado) | 335 s (340 / 336 / 330) | **306 s** (306 / 306 / 306), 2 por vez, 0 falhas | −9% |
| Esperas fixas sem motivo (ui + hunts) | **320** (190 + 130), nenhuma comentada | **0** sem motivo; 115 que testam o próprio tempo, cada uma com `espera fixa: <motivo>` | teto do teste: 0 |
| `--jobs` default | 2 / 2 | **3** (ui) / **2** (hunts) | ver abaixo |

"Antes" é o commit `ccc4f25` (instrumentação de tempo, nenhuma espera convertida), medido
em três rodadas de cada suíte a `--jobs 2`. "Depois" são as três rodadas finais nos defaults
novos (`npm run ui`, `npm run hunts`, sem flags), em sequência, com nenhum Electron de outra
worktree vivo no início e no fim de cada rodada.

Parte do ganho do `ui` (380 → 311 s) é só das esperas por condição, a `--jobs 2`; o resto
(311 → 237 s) vem de subir para 3 por vez.

## Portões

| Portão | Resultado |
|---|---|
| `npm run verify:bend` | ok — 88 artefatos reproduzíveis, provas verdes |
| `MESA_GATE_CACHE=0 npm test` | 1349 testes, 1349 passam, 0 falham |
| `npm run test:claude-ui` | passa (sem autenticação real, SDK sintético) |
| `npm run ui` × 3 seguidas | 59 ok, 0 falhas, nas três |
| `npm run hunts` × 3 seguidas | 23 ok, 0 falhas, 1 pulado nas três (`hunt-handoff`, sem `chat/node_modules`) |

## Medição

O corredor (`tests/run-suite.mjs`) grava uma linha por arquivo em
`desk/.runtime/suite-tempos.jsonl` e `launchDesk` grava o custo de abrir janela em
`launch-tempos.jsonl` (fora do git). `node tests/suite-tempos.mjs [--suite hunts|janelas]`
imprime o total por rodada e a média por arquivo; o resumo do corredor mostra os 10 mais
lentos da rodada.

### 10 mais lentos — `npm run ui` (média das 3 rodadas, `--jobs 2` antes, 3 depois)

| Antes | | Depois | |
|---|---|---|---|
| ui-smoke.mjs | 99,2 s | ui-smoke.mjs | 92,1 s |
| timeline-late.mjs | 34,5 s | timeline-late.mjs | 34,1 s |
| settings-busy-ui.mjs | 25,6 s | settings-busy-ui.mjs | 21,6 s |
| sidechat-layout-ui.mjs | 23,4 s | improvements-ui.mjs | 20,3 s |
| send-offline-ui.mjs | 23,0 s | send-offline-ui.mjs | 18,6 s |
| layout-rules-ui.mjs | 22,4 s | composer-box-ui.mjs | 17,0 s |
| activity-viz-ui.mjs | 22,4 s | mesa-interactive-ui.mjs | 16,3 s |
| reader-bar-ui.mjs | 21,1 s | sidechat-layout-ui.mjs | 15,9 s |
| improvements-ui.mjs | 20,4 s | activity-viz-ui.mjs | 15,8 s |
| tutor-states-ui.mjs | 20,2 s | first-run-ui.mjs | 15,7 s |

`ui-smoke` e `timeline-late` ficam quase iguais: são a rodada completa de uma área e um
cenário longo de linha do tempo, onde o tempo gasto é o cenário em si. Nenhum cenário foi
cortado nem fundido para ganhar tempo.

### 10 mais lentos — `npm run hunts` (média das 3 rodadas, 2 por vez nos dois lados)

| Antes | | Depois | |
|---|---|---|---|
| hunt-activity-isolation.mjs | 151,8 s | hunt-activity-isolation.mjs | 151,7 s |
| hunt-chaos.mjs | 147,6 s | hunt-chaos.mjs | 118,3 s |
| hunt-chat.mjs | 62,0 s | hunt-chat.mjs | 57,8 s |
| hunt-queue.mjs | 48,6 s | hunt-queue.mjs | 48,6 s |
| hunt-activity-watchdog.mjs | 46,9 s | hunt-activity-watchdog.mjs | 46,9 s |
| hunt-shell.mjs | 38,9 s | hunt-shell.mjs | 30,1 s |
| hunt-calc-ggb.mjs | 29,1 s | hunt-activity-ui.mjs | 24,4 s |
| hunt-activity-ui.mjs | 23,7 s | hunt-calc-ggb.mjs | 24,3 s |
| hunt-activity-spike.mjs | 22,4 s | hunt-activity-spike.mjs | 22,3 s |
| hunt-timeline.mjs | 18,6 s | hunt-timeline.mjs | 18,4 s |

`hunt-activity-isolation`, `-queue` e `-watchdog` não mudaram porque o tempo deles é
fixo por desenho (prazos do watchdog, janelas de medição); as esperas que sobraram ali
estão todas marcadas. A rodada de hunts é limitada por esses dois arquivos mais longos
rodando em paralelo, por isso ganhou pouco (−9%).

## Esperas fixas

- Antes: **320** (`waitForTimeout`, `sleep(N)`, `new Promise(... setTimeout)`) em 59 arquivos
  de janela e 24 hunts, nenhuma justificada (190 no `ui`, 130 nos hunts).
- Depois: **0 sem motivo**. As **115** que restam (47 no `ui`, 68 nos hunts) testam o próprio
  tempo — debounce, timeout, "nada acontece em N ms", janela de medição de batimento,
  intervalo do polling — e cada uma tem `espera fixa: <motivo>` na linha ou na de cima.
- `tests/ui-waits.test.mjs` fixa o teto em 0 e reprova a espera nova sem motivo; o teto só
  pode cair (já está no piso).
- `tests/waits.mjs` (com `tests/waits.test.mjs`, 6 testes): `pollUntil` (lê até a regra
  aprovar, erro com o valor visto), `layoutStable`, `nextFrames`, `pdfRenderIdle`.

## Reuso de janela: não implementado

Medido nas três rodadas de baseline (`launch-tempos.jsonl`):

| | `ui` | `hunts` |
|---|---|---|
| Janelas abertas por rodada | 103 | 75 |
| Pintada média até a primeira janela útil | 604 ms | 540 ms |
| Custo total de abrir janela por rodada | ~62 s | ~40 s |
| Soma dos tempos dos arquivos por rodada | ~680 s | ~661 s |
| Arquivos com mais de uma janela | 21 | 8 |
| Janelas que um reuso **dentro do arquivo** poderia poupar | 54 (~32 s) | 57 (~31 s) |

Reusar dentro do arquivo poupa ~5% da soma dos arquivos (~16 s de relógio a 2 por vez) em
cada suíte, e custa isolamento: o cenário seguinte herdaria o estado do anterior (runtime,
sessão, tema, configuração), que é justamente o que esses testes querem garantir limpo. O
ganho não justifica o risco; não implementei. Reusar **entre arquivos** poderia chegar a uns
100 s da soma, mas quebra o isolamento por arquivo que o corredor assume; fica registrado
como possibilidade, não como recomendação.

## `--jobs`: experimento

Três rodadas seguidas por valor, no mesmo código (`564136e`), sem Electron de outra
worktree no início e no fim de cada rodada. Critério da issue: só muda o default se o valor
novo fechar três rodadas seguidas com zero falhas e for mais rápido.

| `--jobs` | `ui` (3 rodadas) | falhas | `hunts` (3 rodadas) | falhas |
|---|---|---|---|---|
| 2 | 311 / 312 / 311 s | 0 / 0 / 0 | 305 / 306 / 308 s | 0 / 0 / 0 |
| 3 | 236 / 236 / 235 s | 0 / 0 / 0 | 209 / 209 / 209 s | 0 / 0 / **1** |
| 4 | 204 / 203 / 204 s | 0 / 0 / 0 | 161 / 159 / 159 s | 0 / **1** / **1** |

Decisão:

- **`ui` → 3 por vez** (−24% sobre 2 por vez). O 4 também fechou limpo, mas deixa menos
  folga a quem tem outro programa pesado aberto; fica disponível com `--jobs 4`.
- **`hunts` → continua em 2.** Com 3 e 4 o `hunt-activity-ui` reprova ("estado 13K + tentativa
  3,5K persiste os dois campos" / "A atividade demorou demais para carregar"). Esse texto é o
  timeout de carga do próprio card de atividade, que estoura quando três ou quatro
  Electrons disputam a máquina. Não afrouxei prazo nem asserção para forçar o 3: seria
  esconder um sintoma de carga. Os waits que troquei nesse arquivo não alteram a seção; o
  teste continua passando sozinho e a 2 por vez.

Os comentários de `tests/run-ui.mjs` e `tests/run-hunts.mjs` trazem esses números; o
`docs/agents/portoes.md` e o resumo do corredor ("N por vez") refletem os defaults.

## Falhas que a conversão para condição revelou (e a correção)

Tirar a espera fixa expôs corridas que o tempo escondia. Cada uma foi corrigida esperando o
estado certo, sem relaxar asserção:

- `tutor-states-ui`: `nextFrames` importado dentro do template do Pi falso (`ReferenceError`);
  import movido para fora.
- `pdf-rotation`: marcador ausente, zoom 525→525 e geometria 0×0 na página 2 — passa a
  esperar `pdfRenderIdle` e a ler marcador/geometria com `pollUntil`. **Esse mesmo arquivo
  reprovou duas vezes no baseline** (2 das 3 rodadas), então a instabilidade já existia; as
  três rodadas finais não o reprovaram.
- `free-study-integration-ui`: `#free-more` invisível após reiniciar (a primeira execução é
  decidida depois de conectar) — `enterFree` depois do `connectIfNeeded`.
- `color-roles-ui`: `.pdf-page` sem estilo — espera o `.pdf-page` anexado antes de medir.
- `hunt-chaos`: título de estudo persistido vazio e trava de sessão — espera
  `!switching && !connecting` antes de preencher o rascunho e usa `pollUntil` no
  `desk.json` (`study.title`, `draft`) e em `sessionLocked`.

## Rodadas contaminadas, refeitas

A sessão #45 (UI/UX da mesa de estudos) estava rodando Electron ao mesmo tempo que parte das
minhas medições, e avisou. As rodadas de baseline e as primeiras rodadas do código novo
feitas nessa janela foram **descartadas e refeitas** (arquivadas fora do repositório, nunca
entram nas tabelas). Todas as rodadas acima usam um script que espera não haver Electron de
outra worktree antes de começar e anota quantos havia no fim (`outrasWorktreesNoFim=0` em
todas). As rodadas do código novo anteriores à correção das condições acima também foram
descartadas e refeitas depois delas.

## Órfãos de Electron

Um único: ao rodar `npm run hunts` em primeiro plano, a ferramenta de execução matou o
processo por tempo (saída 144) e deixou Electron para trás. Origem: a minha própria rodada
interrompida; matei à mão e confirmei que nada sobrou. A lição virou prática (e está no
`portoes.md`): rodada longa de Electron vai em segundo plano, nunca em primeiro plano com
prazo. Nas rodadas finais nenhum Electron de teste sobrou.

## O que não mudou

- `tests/proc-tree.mjs`, `closeApp` com prazo, `resizeWindow`/`pageWindow` de
  `tests/helpers.mjs` e o relatório `fix-ui-intermitentes-2-resultado.md` ficaram como
  estavam.
- Cobertura: o número de arquivos e de cenários é o mesmo (59 de janela, 23 hunts + 1
  pulado); nenhum teste foi cortado, fundido ou enfraquecido.
- `docs/agents/portoes.md` ganhou: uma sessão com teste de janela por vez por máquina; a
  tabela área → filtro (rodar a suíte da área durante o trabalho e a cheia no fim);
  esperas por condição; medir antes de mexer.

## Commits (locais)

```
d8b474a test(desk): esperas por condição (waits.mjs) e teto de esperas fixas sem motivo (#48)
182029e test(desk): troca esperas fixas por espera de condição nos testes de janela e hunts (#48)
6e22369 test(desk): corrige corridas achadas ao validar as esperas por condição (#48)
564136e test(desk): hunt-chaos e color-roles esperam o estado que antes o tempo escondia (#48)
af9d12a test(desk): npm run ui passa a 3 por vez; hunts fica em 2, com os números medidos (#48)
```

(Mais o commit deste relatório.) Sem push e sem PR, como pedido.
