# #58 — Claude Code com as mesmas funções do Pi: resultado

Branch de trabalho: `claude/competent-heyrovsky-b6f012`. Commits locais, um
por camada, sem push e sem PR.

| Commit | Camada |
|---|---|
| `b713e0c` | Núcleo: caps do Claude ligam steer, compactação manual, rascunho, comandos, quiz e medidor; bilhete falso nos três motores |
| `e42a6fa` | Adaptador/serviço: steer, comandos `/`, compactação, medidor e a ponte do rascunho |
| `2106ea9` | Host/IPC: `pi-compact`, o medidor no `pi-settings`/`pi-health` e o `review-draft` do Claude |
| `c201d4c` | Renderer: o padrão do motor certo na faixa de esforço, a estrela no teclado e o medidor que apaga sem número |
| `3e6d115` | Serviço (correção achada pela janela): o steer não troca a política de leitura do turno em voo |
| `b9cfae0` | Testes de janela: `claude-parity-ui` no `test:claude-ui`, a estrela no teclado e o padrão por motor |

## Item por item

| Função | O que o Pi faz | O que o Claude faz agora | Prova |
|---|---|---|---|
| Steer (⌘/Ctrl+⏎ ocupado) | `streamingBehavior:'steer'` no RPC: o Pi trata a mensagem no turno em curso | Item `priority:'now'` na MESMA `MessageQueue` da consulta viva. O eco com o mesmo uuid é o aceite, o turno segue até o `result` nativo, e o uuid do steer entra na família do turno para a correlação. Fila fechada é recusa (`notSent`). Prazo, queda ou close sem eco ficam incertos e pegajosos. O steer mantém a política de leitura do turno | `claude-parity.test.mjs` (7 testes de steer, inclusive a regressão da política), `claude-parity-ui.mjs` (⌘⏎ na janela, `priority:'now'` no log da fixture, uma resposta só) |
| Compactação manual | `compact` no RPC, com o resumo e os tokens | `/compact <instruções>` na mesma fila, fora do ciclo de turno. O fim é o `system/status` com `compact_result`; a recusa traz o `compact_error` numa frase. Prazo (240 s) ou queda sem resultado ficam incertos. Um pedido por vez, só com o tutor parado | `claude-compaction.test.mjs`, `claude-parity.test.mjs`, `tutor-session-ipc.test.mjs`, `claude-parity-ui.mjs` (aviso "Contexto compactado", medidor apagado, recusa expressa) |
| Compactação automática | Toggle `autoCompaction` | **Desligada** (cap falso). O CLI compacta sozinho e a Mesa vê a fronteira `trigger:'auto'`: vira aviso e apaga o medidor. O toggle exigiria mexer no ajuste do CLI, o que não dá para provar sem modelo real | Lei `caps_claude_auto_compactacao_catalogo`, `tutor-session-ipc.test.mjs` (`pi-auto-compaction` recusa o Claude) |
| Medidor de contexto | `get_session_stats` | Tokens da última resposta (entrada + saída + cache) contra `modelUsage[modelo].contextWindow` do `result`. Uso torto, modelo sem janela ou fronteira de compactação apagam a amostra. No renderer, a leitura de saúde sem número apaga o medidor (`meterUsage`) | `claude-usage.test.mjs`, `claude-parity.test.mjs`, `meter-usage.test.mjs`, `claude-parity-ui.mjs` (aparece com a janela de 200 mil; some depois do `/compact`) |
| Comandos `/` | `get_commands` | `Query.supportedCommands()` guardado por consulta e trocado pelo `system/commands_changed`; leitura que falha é lista vazia. O comando sai como texto `/nome args` pelo MESMO ciclo de entrega do prompt | `claude-parity.test.mjs`, `claude-parity-ui.mjs` (catálogo no menu `/`, `/revisar a prova 2` pelo prompt) |
| Rascunho de revisão | Pi temporário que devolve o JSON | `ClaudeAdapter` descartável: pasta `.review-draft-*` própria, `tools:[]`, todas as ferramentas negadas e `persistSession:false`, atrás de um `NativeService`. Quem lê e valida o JSON é o mesmo `generateReviewDraft` do Pi. A pasta sai no fim | `claude-parity.test.mjs`, `study-records-host.test.mjs`, `claude-parity-ui.mjs` (campos preenchidos, um prompt só) |
| Quiz/atividade | Extensão `mesa-activity` | O MCP `mcp__mesa__criar_atividade` já existia; só o cap ligou | `claude-activity-tools.test.mjs`, `mesa-claude-activity-ui.mjs` (no `test:claude-ui`) |
| Bilhete (`handoff`) | — | Falso nos três motores (decisão abaixo) | Leis `caps_pi_bilhete` e `caps_claude_bilhete_catalogo` |

**Seletor da #59.**

- **Faixa de esforço.** O nível `default` diz "Padrão do Claude" ou "Padrão
  do OpenCode" conforme o motor (`effortLevelText`); um motor sem nome
  próprio fica com "Padrão". Provas: `effort-strip.test.mjs`,
  `claude-controls-ui.mjs` e `opencode-ui.mjs`.
- **Estrela de favorito.** Responde a **⌘D** (Ctrl+D fora do macOS) na linha
  ativa, sem tirar o foco da busca, e a linha ativa continua no mesmo modelo.
  - **Por que esse atalho:** é o "favoritar" dos navegadores, e na Mesa está
    livre. O ⌘⇧D é a densidade, e a busca só recebe letras sem modificador.
  - **Leitor de tela:** o `aria-hidden` saiu. O estado vai na descrição da
    linha (`aria-describedby`): "Favorito; ⌘D tira dos favoritos" ou "⌘D
    favorita". A troca é anunciada numa região `status`.
  - **Provas:** `model-picker.test.mjs` (`isFavoriteShortcut`,
    `activeAfterFlip`) e `model-picker-ui.mjs`.

## O que veio da branch, o que foi refeito e o que os ajudantes fizeram

A branch `t3/opencode-provider` serviu só de especificação. Os commits
`fa87b66`, `c988f59`, `c427f0a`, `12de58f`, `e4a65a9`, `fcefe56`, `1f7b5be`,
`d64993e`, `4056a18`, `a794128` e `f4aa958` foram lidos com `git show`; nada
foi mesclado, rebaseado nem copiado por cherry-pick.

**Aproveitado como contrato:**
- o `priority:'now'` do steer e o aceite pelo eco;
- o `/compact` com o fim pelo `compact_result`;
- a janela pelo `modelUsage.contextWindow`;
- o `supportedCommands` com o `commands_changed`;
- o rascunho sem ferramentas e sem sessão gravada;
- o `meterUsage` de `a794128`.

**Refeito no estilo do main.** O adaptador ganhou três mixins com
`// @ts-check` (`-steer`, `-commands`, `-meter`), tipados por
`types/claude-adapter-host.d.ts`. A lógica sem I/O foi para dois módulos
puros (`claude-compaction.cjs`, `claude-usage.cjs`).

**Rascunho, em vez do `claude-draft.cjs` da branch** (336 linhas, com um
leitor de stream próprio): reaproveita o `NativeService` e o
`generateReviewDraft` em 40 linhas (`claude-review-draft.cjs`). Não existe um
segundo caminho para o Claude.

**Tamanho dos arquivos:** `claude-adapter.cjs` ficou abaixo do teto de 800
linhas (`_currentModelInfo` e `_capabilities` foram para o mixin de
controles), e todo arquivo novo tem menos de 500.

**Ajudantes:** o DeepSeek (`opencode/deepseek-v4.1-flash-free`) escreveu
`tests/claude-usage.test.mjs` e `tests/claude-compaction.test.mjs` (32
testes). Revisei o diff e aceitei sem mudança. O resto foi feito nesta
sessão.

**Correção achada pela janela.** O host manda a `toolPolicy` em todo prompt,
e com turno aberto o adaptador recusa trocá-la. Por isso o primeiro ⌘⏎ do
`claude-parity-ui` morria antes de sair. Ficou no commit `3e6d115`, com teste
de regressão. Sem a correção, o teste falha.

## Decisão do bilhete (`handoff`)

O campo **fica** no contrato `Caps` e é **falso nos três motores**, inclusive
no Pi:
- o bilhete veio da Conversa, aposentada na #50, e nenhum motor o implementa;
- tirar o campo agora mudaria a aridade do `Caps` em todas as leis e provas,
  então ele sai junto com a migração do `Nat` (#49).

Nada de bilhete foi implementado.

## Portões rodados (em `desk/`)

| Portão | Resultado |
|---|---|
| `npm run verify:bend` | ok: 68 artefatos reproduzíveis, provas verdes |
| `npm run typecheck` | ok |
| `npx eslint .` | ok |
| `MESA_GATE_CACHE=0 npm test` | 1845 testes, nenhuma falha |
| `npm run test:claude-ui` | os 10 arquivos passam, inclusive o novo `claude-parity-ui.mjs` |
| `node tests/native-tutor-pdf.mjs`, `native-activity-tool.mjs`, `native-tool-parity.mjs` | ok |
| `npm run test:packaged` | ok |
| `node tests/model-picker-ui.mjs`, `opencode-ui.mjs`, `claude-controls-ui.mjs` (textos mudados) | ok |
| `node tests/fixtures/claude-sdk-fake.mjs` (autoteste da fixture) | ok |
| `npm run ui -- claude,opencode,model-picker,model-indicator,composer,slash,queue,tutor` | ok: os 12 arquivos que o filtro escolhe (`claude-parity-ui`, `composer-mentions-ui`, `model-picker-ui`, `model-indicator-ui`, `opencode-ui`, `tutor-geogebra-ondemand-ui`, `sidechat-claude-ipc-smoke`, `composer-box-ui`, `tutor-header-ui`, `tutor-language-ipc-smoke`, `tutor-pdf-ui`, `tutor-states-ui`) |

O `tests/fake-pi.mjs` não mudou.

## O que ficou sem prova

Tudo abaixo depende do Claude Code real, que não foi chamado (nada de login,
`auth status` nem inferência). O roteiro está em
[`docs/manual/claude-paridade.md`](../manual/claude-paridade.md).

- O CLI real ecoando o item de `priority:'now'` no meio de um turno com
  ferramenta, e tratando-o "já".
- O eco de replay do `/compact` e dos comandos `/` no CLI real, e a forma
  exata do `compact_result` e do `compact_error` nesta versão.
- O rascunho de revisão com modelo real: o JSON sai limpo e nenhuma sessão é
  gravada em `~/.claude/projects`.
- A compactação automática do CLI, vista só como aviso.
- O anúncio da estrela no VoiceOver. A janela prova o DOM (`aria-describedby`
  e a região `status`), não a fala do leitor.

## Prova com modelo real

(a preencher com a tabela do roteiro manual)
