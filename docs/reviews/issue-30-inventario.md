# Inventário de testes do #30 (base `87a39ea`)

Publicado **antes** de qualquer remoção. O livro-razão por arquivo está em `docs/reviews/issue-30-livro-razao.md`; os insumos (outlines, medições, scripts) em `docs/reviews/issue-30/`.

## Linha de base

| Comando | Resultado | Tempo |
|---|---|---|
| `MESA_GATE_CACHE=0 npm test` | 1316 testes + 5 de portão, verde | 54,9 s (`node --test` 22,9 s; soma isolada dos 130 arquivos: 94 s) |
| `npm run hunts` (2 por vez) | 22 ok, 1 falha (`hunt-handoff`: sem `chat/node_modules`) | 352 s |
| janelas, uma por vez (46 arquivos) | 41 ok, 5 falham já na base | 736 s |
| `npm run test:claude-ui` | 9 ok | 30,8 s |
| **Total** | | **≈ 1174 s**; meta ≤ ≈ 820 s |

Cobertura nativa do `npm test`: linhas 75,73 % · ramos 79,25 % · funções 65,85 %. `desk/tests/`: 251 arquivos, 52 923 linhas (253 arquivos contados em rows.json, 53176 linhas com os 2 novos de hoje).

Falhas na base (relatadas, não apagadas): `activity-concurrency-ui`, `improvements-ui`, `material-preview-ui`, `material-template-dialog-ui`, `mesa-interactive-ui`, `hunt-handoff` (no worktree); `layout-rules-ui` e `model-indicator-ui` falharam em pares; `subjects-ui` oscila.

## Raias (áreas do Mapa do AGENTS.md)

| raia | arquivos | linhas | tempo | unidades | R | F | C | D |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| agentes-claude-a | 17 | 6512 | 2 s | 217 | 214 | 0 | 0 | 3 |
| agentes-claude-b | 36 | 3887 | 296 s | 129 | 124 | 0 | 0 | 5 |
| calc-estado-config | 22 | 4905 | 131 s | 119 | 114 | 1 | 1 | 3 |
| estudo-backup | 18 | 4275 | 14 s | 117 | 115 | 0 | 0 | 2 |
| estudo-resto | 29 | 4935 | 81 s | 198 | 194 | 0 | 4 | 0 |
| fila-timeline-worklog | 19 | 4390 | 203 s | 85 | 74 | 0 | 0 | 11 |
| leitor-pdf | 16 | 3613 | 72 s | 67 | 67 | 0 | 0 | 0 |
| livre-materia | 18 | 3465 | 63 s | 93 | 93 | 0 | 0 | 0 |
| pi-bilhete | 17 | 3007 | 76 s | 92 | 90 | 1 | 0 | 1 |
| sidechat | 12 | 2677 | 55 s | 54 | 50 | 0 | 0 | 4 |
| updater-infra | 20 | 2690 | 6 s | 96 | 89 | 0 | 3 | 4 |
| visoes-a | 15 | 2543 | 3 s | 148 | 120 | 0 | 0 | 28 |
| visoes-b | 14 | 6277 | 422 s | 14 | 14 | 0 | 0 | 0 |

Por tipo: unitários 29127 linhas · janelas 12895 · hunts 8131 · apoio/outros 3023.

## Plano de camadas

| camada redundante | guardião que fica | o que sai |
|---|---|---|
| Testes JS de **visão pura** (árvore sem host) ao lado da lei+prova Bend do mesmo valor: tabsview, tutorstate, tutorheader, settingsview, attachview, composerbox, deskflags, statusview, slashview | `core/laws/<módulo>.bend` + `core/proofs/<módulo>.bend` (o portão `test:proof` roda os dois) | só os testes cujo valor esperado inteiro consta na lei; os que dependem de texto/fato só do teste ficam |
| `sidechat-scope`, `agent-core`, `send-offline` contra `sidechat`, `agentcaps`/`agentdelivery`, `pending` | as leis desses módulos | arquivos inteiros |
| Armazéns de desfazer (`review-undo`, `pdf-notes-undo`) repetem a matriz do módulo compartilhado | `deletion-undo.test.mjs` | prazo do host e token inventado em cada armazém |
| Fluxo do atualizador em modo git com exec simulado (`updateflow`) ao lado de git real | `gitreal.test.mjs` (D1, repositório de verdade) | 3 testes de modo git simulado |
| Órfãos sem asserção ou fora da rodada (`live-pi`, `reference-*`, `design-check`, `installed-smoke`, `capture-new-ui`) | janelas que medem as mesmas telas; `app-smoke` | arquivos inteiros |
| Varreduras de fonte (`study-history-retention` ×2, "módulo é puro" ×2) | testes comportamentais do mesmo arquivo | 4 testes |
| Cálculo da calculadora repetido no hunt (`hunt-calc-ggb`) | `core.test.mjs` (calculator), `calculator-ui`, `calcview.test` | blocos do avaliador |

Não é camada redundante, e fica: `tabsview` paridade com o `renderTabs` antigo, aplicadores de DOM (calcview, firstrun, readersheet, auxview, shortcutview, talkview, pdfview, pdfpageview, toast-view, dialogsview, accent-state), `pdfnav` (forma gerada), `*-parity.mjs`, `gitreal`, `handoff`, `send`.

### Infraestrutura de tempo (já feita, commit 5c801ac)

`npm run ui` (`tests/run-ui.mjs`, mesmo corredor de `hunts`: `tests/run-suite.mjs`, 2 por vez, saída 77 = pulado). Primeira rodada completa: **49 arquivos em 383 s** (43 ok, 6 falham, os mesmos da base). Limpeza de runtimes/capturas na saída e fim dos vazamentos (`git status --ignored` limpo).

## Candidatos a decidir com mais evidência (não apagados)

- Família `claude-*` (adapter 1835 linhas, native-controls 809, environment 560, turn-policy 533, questions 486, controls 468): há camadas mockadas sobre o mesmo contrato; falta provar por teste qual guardião é mais forte antes de cortar.
- Janelas que medem a mesma tela e podem virar uma só (uma subida do Electron): tutor-header-ui + model-indicator-ui; responsive-ui + responsive-chat-calc-ui + layout-rules-ui; reader-bar-ui + reader-empty-ui; settings-sections-ui + settings-resources-ui; trio de sidechat-*.
- ≈ 256 `waitForTimeout` fixos nas janelas/hunts (~222 s de espera): trocar por espera de condição.
- Hunts mais caros: hunt-activity-isolation, hunt-chaos, hunt-chat, ui-smoke (100 s).

## Honestidade sobre a meta

Com a barra de retenção, o que se prova redundante hoje é **61 testes + 8 consolidações + 2 correções** (≈ 3 % das linhas, estimado; o número real sai do commit de cada raia). A meta de −20 % de linhas só se alcança com a fusão de janelas e a redução da família `claude-*`, que dependem de decisões acima. O ganho de tempo vem do corredor (`npm run ui`: 736 → 383 s) e de tirar capturas/esperas fixas.

## Cobertura antes

75,73 % linhas / 79,25 % ramos / 65,85 % funções (`node --test --experimental-test-coverage tests/*.test.mjs`).
