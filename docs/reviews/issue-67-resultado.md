# #67 — Revisão final antes da v1.0.0

Escopo fechado: o que era pequeno foi corrigido aqui, com teste; o que era grande virou uma linha em "Adiado", com o motivo. Commits na branch `claude/affectionate-saha-0a797e`, sem push.

## Achados

| # | Frente | Achado | Situação |
|---|---|---|---|
| 1 | Consistência | O teste de tom cobria só `setup.*`, `firstrun.*`, `guide.*`, `mascote.*` e `phone.*`. Estendido ao catálogo todo. Ficam de fora o "©" dos créditos do Sobre (é símbolo legal, não emoji) e a fala `firstrun.tutor.lead`, que já era exceção desde a #64. Única violação encontrada: `quiz.correct`, "✓ Correta!", que virou "✓ Correta." | corrigido, `c961e74` |
| 2 | Consistência | "sem plano pago" passava a ideia de que a própria Mesa tem um plano pago. Virou "sem assinatura de IA" em `freeModels.openTitle` e `freeModels.settings.lead`, nas duas línguas, e no texto de reserva do `index.html`. O teste recusa "plano pago"/"paid plan" no catálogo. Pedido da sessão orquestradora. | corrigido, `e1e2d2c` |
| 3 | Consistência | Trio ∫ Σ ∇: aparece junto só no setup (Boas-vindas e Pronto) e no Guia. Página do celular e registro do tutor usam um personagem por vez. Bate com a #64. | sem mudança |
| 4 | Acessibilidade | Usadas como cor de texto, `--danger`, `--success` e `--warn` ficavam abaixo de 4,5:1. No claro: verde 2,87, âmbar 2,77 e vermelho 4,20 sobre `--bg`. No escuro: vermelho 3,48 sobre `--surface`. Criados `--danger-text`, `--success-text` e `--warn-text`, que passam AA em `--bg`, `--surface` e `--side`; as 26 regras `color:` passaram a usá-los. O tom de ícone, borda e fundo não mudou. | corrigido, `a612cf5` |
| 5 | Acessibilidade | `tests/contrast.test.mjs` (novo) confere, nos dois temas: texto, texto fraco e texto de status; os 6 acentos como link e como fundo da ação principal. Todos passam AA. | corrigido, `a612cf5` |
| 6 | Acessibilidade | Menus Matéria, Estudar e Ajustes. Antes, o Esc com o foco num item jogava o foco no `body`, e não havia navegação por setas. Agora segue o padrão de botão de menu do WAI-ARIA: Enter/Espaço/↓ abrem no primeiro item, ↑ abre no último, as setas dão a volta, Home/End vão às pontas, Tab fecha e o Esc devolve o foco ao gatilho. `hunt-shell` e `hunt-chaos` fixavam o comportamento antigo e foram atualizados. | corrigido, `267c2a8` e `93912b7` |
| 7 | Acessibilidade | Alvos de clique abaixo de 24px (WCAG 2.5.8): remover menção e remover anexo (18px) ganharam uma borda invisível de 3px (o desenho continua em 18px); o remover marcador do sumário (22px) foi para 24px. `tests/target-size.test.mjs` varre as folhas atrás de botão com largura ou altura fixa abaixo de 24px. | corrigido, `b8a4d69` |
| 8 | Acessibilidade | Os botões da fila de mensagens (`.queue-item button`) têm 18px e ficam a 4px um do outro. A borda invisível sobreporia os vizinhos, então fica na lista de adiados do teste. | **adiado**: precisa redesenhar a linha da fila |
| 9 | Acessibilidade | No tema escuro, o `--accent-fill` (fundo da ação principal, alternador ligado) fica abaixo de 3:1 contra as superfícies em 5 dos 6 acentos. Exemplo: azul a 2,46 sobre `--surface`; só o grafite passa. O texto em cima passa AA, e o botão se identifica pelo rótulo. O alternador ainda conta com a posição do botão. | **adiado**: mexe na paleta da #9, decisão de desenho |
| 10 | Acessibilidade | Foco visível: a regra global `:focus-visible` cobre o app. Os campos com `outline:none` (busca do PDF, campo do composer, edição da fila) têm o anel no contêiner (`:focus-within`) ou borda própria. | sem mudança |
| 11 | Pontas soltas | Ponto do ⚙ (`1001bb1`): no visual basta, e o rótulo acessível do gatilho já diz "Ajustes · há uma atualização". Mas, no escuro, o ponto usava `--accent-fill`, abaixo de 3:1 contra o fundo, e ele é a única pista visual. Passou a usar `--accent-text`; no claro, os dois tons são o mesmo. | corrigido, `89b3695` |
| 12 | Pontas soltas | Ícone G1 em 16px: a ∫ vira uma barra escura. Estudo de variante pequena: folha reta e maior, sem sombra nem dobra, ∫ com as pontas mais abertas e traço de 104. Ela lê como ∫ em 16 e 32px. Comparação em [issue-67/icone-g1-16-32-atual-vs-pequeno.png](issue-67/icone-g1-16-32-atual-vs-pequeno.png) (atual 16, variante 16, atual 32, variante 32) e SVG em [issue-67/icone-g1-pequeno-violeta.svg](issue-67/icone-g1-pequeno-violeta.svg). | **adiado**: identidade é decisão do autor. Se aprovar, entra como opção `small` em `scripts/app-icon-art.mjs`, usada para 16–32px no `.ico` e no `.icns` |
| 13 | Desempenho | O `MutationObserver` das sobreposições (`ggb.mjs`) fazia `querySelectorAll` no documento inteiro a cada mudança de classe, mesmo com o GeoGebra desligado. A lógica foi para `src/overlay-watch.mjs`, que só conta com a view ligada e esquece a contagem ao desligar, para o primeiro estado depois de religar não se perder. | corrigido, `66d47c0` |
| 14 | Desempenho | Numa sessão longa, cada turno recalculava o layout de todas as mensagens: 1000 mensagens dão ~72 mil nós. As mensagens fora da vista agora usam `content-visibility:auto`, com `contain-intrinsic-size:auto`, que guarda a altura medida. A última mensagem, que cresce no streaming, fica de fora. | corrigido, `065da97` |
| 15 | Desempenho | PDF grande: o `render()` do leitor chama `doc.getPage(n)` em sequência para todas as páginas antes de pintar a primeira (cerca de 0,2 ms por página: 2000 páginas somam ~0,4 s). O salto ao fim também cresce com o número de páginas (~0,1 s com 600, ~0,5 s com 2000). | **adiado**: mexe no layout do leitor e no núcleo `pdfpageview`. A medida ficou registrada |
| 16 | Desempenho | Trabalho repetido em repouso: em 10 s com o tutor ligado e dois PDFs, ~1 layout, ~1 recálculo de estilo e 1–2 ms de script. Nenhum laço ocioso. | sem mudança |
| 17 | Desempenho | Memória numa sessão longa: o heap fica em ~12 MiB com 1000 mensagens e sobe ~1,3 MiB em 30 turnos (depois de GC). Não há sinal de vazamento. | sem mudança |
| 18 | Atualização | Teste de ponta a ponta 0.5.0 → 1.0.0: instalar a v0.5.0 pública, criar matéria e sessão, atualizar pelo Sobre e conferir os dados. | **adiado**: as regras desta sessão proíbem `install-app`, `update` e `setup`, e a 1.0.0 ainda não existe como release. Conferi só o código: `isProtected` (`updater-files.cjs`) nunca grava por cima de `config.json`, `desk.json`, `.runtime/`, `*.jsonl`, `*.xopp`, `*.pdf` nem `node_modules`. O teste real fica para o passo de publicação |
| 19 | Portões | `tests/model-picker-catalog.test.mjs` ("~450 modelos abaixo de um quadro") falhou uma vez no `npm test` paralelo (83 ms contra o teto de 25). Isolado, passa 3 de 3. | **adiado**: intermitente por carga; o teto é tempo de parede dentro de uma rodada paralela |
| 20 | Portões | `ggb-divider-drag-ui.mjs` falhou uma vez na rodada cheia: a captura congelada não apareceu no prazo de 3 s, com a carga da máquina em ~12. Isolado, passa 3 de 3. | **adiado**: intermitente por carga, prazo curto do teste |

Não revisei à mão espaçamento e ícones nas telas, nos dois temas e em 900×650. Ficaram cobertos pelas suítes que já existem (`topbar-ui`, `responsive`, `layout`, `settings`), que passaram na rodada cheia.

## Desempenho

A sonda nova `tests/perf-probe.mjs` é opt-in e fica fora do `npm run ui`. Ela usa runtime sintético, Pi de mentira e PDFs gerados por `tests/synthetic-pdf.mjs`; o gerador saiu do `hunt-pdf-retention`, que agora o importa. Sem material de curso. Comando:

```sh
node tests/perf-probe.mjs --runs 1 --pages 2000 --history 1000 --turns 30 --idle 10
```

A máquina estava sob carga de outras sessões (média de carga entre 6 e 12). Por isso a comparação é A/B intercalada: três pares, sempre "antes" seguido de "depois". O "antes" roda num worktree temporário em `ae25ea4` (sonda pronta, sem as correções de desempenho). Os valores são a mediana dos 3 pares. macOS arm64, Electron 44.7.2.

| Medida | Antes | Depois | Observação |
|---|---|---|---|
| Janela aberta (launch → `firstWindow`) | 475 ms | 507 ms | ruído: código não tocado |
| Página carregada | 730 ms | 788 ms | ruído |
| Janela utilizável (tutor ligado, Enviar habilitado) | 1033 ms | 995 ms | ruído |
| PDF de 2000 páginas nos dois leitores: primeira página pintada | 1451 ms | 1598 ms | ruído: leitor não tocado; ver achado 15 |
| PDF de 2000 páginas: salto à última | 503 ms | 627 ms | ruído: faixas de 496–890 e 557–690 |
| PDF: canvases vivos / heap | 6 / 12,3 MiB | 6 / 12,3 MiB | |
| Sessão de 1000 mensagens: abrir o histórico | 1653 ms | 1532 ms | |
| **Sessão de 1000 mensagens: tempo por turno** | **274 ms** | **142 ms** | achados 13 e 14. Um par "depois" deu 936 ms num pico de carga; os outros dois deram 121 e 142 |
| Heap depois de 30 turnos (com GC) | 13,4 MiB | 13,5 MiB | |
| Repouso de 10 s: layouts / recálculos / script | 1 / 1 / 1 ms | 1 / 1 / 2 ms | |

Medidas isoladas de cada correção, 3 rodadas com o mesmo cenário de 1000 mensagens: o turno estava em 245 ms. Com o observador corrigido caiu para 218 ms, e com o `content-visibility` para 117 ms.

## Testes novos

- `tests/contrast.test.mjs`: contraste AA dos dois temas, dos 6 acentos e do texto de status. Também confere que nenhuma folha usa `color:var(--danger|success|warn)` e que o ponto da atualização passa 3:1.
- `tests/menu-roving.test.mjs`: as setas, Home/End e a volta no fim do menu (`src/menu-roving.mjs`, novo).
- `tests/target-size.test.mjs`: alvos de 24px.
- `tests/overlay-watch.test.mjs`: o observador não conta com o GeoGebra desligado e não perde o fechamento depois de religar.
- `tests/chat-long-session-css.test.mjs`: segura a regra do `content-visibility` no portão rápido.
- `tests/setup-flow.test.mjs`: tom no catálogo todo e "plano pago" recusado.
- `tests/topbar-ui.mjs`: teclado no menu Estudar (↓, ↑, Home, Esc devolve o foco).

## Portões

| Portão | Resultado |
|---|---|
| `npm test` (por commit) | verde em todos os commits; o último deu 2016 passam, 0 falham |
| `npm run verify:bend` | ok: toolchain fixada, artefatos em dia, provas verdes |
| `MESA_GATE_CACHE=0 npm test` | 2015 passam, 0 falham (antes do commit `e1e2d2c`, que só acrescentou 1 teste; o `npm test` depois dele passou) |
| `npm run ui` (rodada cheia) | 79 ok, 1 falha intermitente (`ggb-divider-drag-ui`, achado 20; isolado passa 3 de 3) |
| `npm run hunts` (rodada cheia) | 22 ok, 2 falhas: `hunt-shell` e `hunt-chaos` fixavam o foco antigo dos menus (achado 6). Corrigidos em `93912b7`; `npm run hunts -- chaos,shell` passa |
| `npm run ui -- free-models` | ok, depois da troca de texto |

A rodada cheia de `ui` e `hunts` rodou antes de `93912b7` e `e1e2d2c`. Depois deles, rodei só as suítes que esses commits afetam: `chaos`, `shell` e `free-models`. A rodada cheia não foi repetida.
