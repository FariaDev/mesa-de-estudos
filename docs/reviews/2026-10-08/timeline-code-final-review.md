# Revisão final independente — linha do tempo do turno (código)

Data: 2026-10-08. READ ONLY no produto: nenhum arquivo de produto/teste foi
editado; nenhum commit/push/install/update, nenhum app pessoal e nenhum provedor
real. Probes sintéticos em `/private/tmp` (Electron real, fixture própria) e
testes Electron/unit existentes. Este relatório é o único artefato escrito.

Escopo: `desk/src/{chat,worklog,timeline}.mjs`, `desk/src/agents/{claude-adapter,service,history}.cjs`
(áreas da timeline) e seus testes. Renderer de atividades, PDF, núcleo Bend e agentes fora da
timeline NÃO foram revisados. Sem provedor autenticado e sem app instalado.

## Veredito

- **A (root, P1 — `contentIndexes` finais do Claude): confirmado.** A correção
  `contentIndex=e.message.contentIndexes?.[i]??i` (`chat.mjs:1103`) e a chave de
  delta `blockMessageId=ame.messageId??assistantId??…` (`chat.mjs:1039-1040`)
  continuam de pé; repro original e teste integrado passam.
- **B (Pi sem `message.id`): corrigido nos caminhos do contrato do Pi, com 2
  ressalvas residuais P3** (N2 e N3). `nextAssistantId`/`ensureAssistantId`
  (`chat.mjs:656/661`), `messageEnded` e `assistantAnchors` reconciliam deltas,
  final-only, `message_end` isolado e duas mensagens sem id; nesses caminhos
  vivo × reload coincide.
- **C (código morto): resolvido.** `grep -n "turnGen\|assistantKeyFor\|trackStep"`
  em `desk/src/chat.mjs` → exit 1, nenhuma linha.
- **Novo achado N1 (P2, aberto): atraso do turno anterior pinta no turno novo.**
  Repro próprio com Electron real descrito abaixo. Contraria o gate do plano
  ("Parar, eventos atrasados… não restauram turno abandonado") e o item 6
  ("um booleano de parada sozinho não distingue evento atrasado do turno
  anterior depois de começar outro turno").

Veredito geral: A e C confirmados; B corrigido nos caminhos do contrato;
**aprovação condicionada** até tratar N1.

## Evidência executada (tudo nesta rodada)

- `node --test tests/timeline.test.mjs tests/timeline-adapter.test.mjs
  tests/worklog.test.mjs tests/worklog-view.test.mjs tests/claude-adapter.test.mjs
  tests/agent-history.test.mjs tests/agent-service.test.mjs` → **124 pass / 0 fail**.
- `node --test tests/*.test.mjs` → **1184 pass / 0 fail** (o autor relatou 1181;
  a contagem mudou com os testes novos, sem falhas).
- `node tests/hunt-timeline.mjs` → blocos `order` e `mixed` **PASSED** (ordem
  ao vivo, slot é o mesmo nó da declaração, reload, concorrência, retry, quiz,
  Parar sem turno novo, adoção de conversa).
- `node tests/timeline-noid.mjs` → **PASS** (deltas, final-only, sem início,
  pensamento, duas mensagens sem id; vivo × reload iguais).
- `node tests/mesa-claude-activity-ui.mjs` → **PASS**; partes
  `["Explorar…","Antes da atividade Claude.","","activity","Depois da atividade Claude."]`.
- `node tests/worklog-parity.mjs` → exit 0.
- `HUNT=worklog-history,worklog-live,worklog-live-text,abort,diary-error,diary-stop,
  thinking-open,quiz-edge,dialog-ui,history-images,diary-touched,quiz-focus,markdown
  node tests/hunt-chat.mjs` → 13 blocos PASSED.
- Probes originais (só-leitura): `probe-adapter-indexes.mjs` →
  `contentIndexes [[0,1],[2,3]]` para dois quadros parciais do mesmo
  `message.id`; `probe-noid.mjs` → ordens/textos esperados, `pageerrors: []`.
- Probe próprio `/private/tmp/timeline-final-review/probe-variants.mjs` +
  fixture `pi-final.mjs` (Electron real, eventos sintéticos): N1, N2 e N3 abaixo.

## Achados

### N1 — P2 — Eventos atrasados do turno parado pintam no turno NOVO

- Arquivo: `desk/src/chat.mjs` — `staleEvent` (`:683`) só descarta atraso por
  `stoppedTurn`/`turnClosed`/`busy`; com turno novo aberto (`turnClosed===false`)
  o Pi não manda `runId`, então `e.runId!=null&&turnRunId!=null&&…` é falso e o
  evento segue para `message_update`/`message_end` (`:1037`, `:1093`).
- Efeito medido: com "Parar" na rodada 1 e um novo envio na rodada 2 ainda
  aberta, a fala atrasada da rodada 1 entra na bolha da rodada 2 e **concatena**
  no delta da rodada 2: `deltaWindowLastText: "Fala atrasada da rodada 1.Fala da
  rodada 2."`; o `message_end` da rodada 2 depois substitui pelo texto correto
  (a sujeira some no fim do turno e no reload, mas fica visível durante o stream).
  O `tool_execution_end` atrasado também muda o slot da rodada 1 de `stopped`
  para `done` — comportamento diferente do hunt `mixed` (sem turno novo), que
  mantém `stopped`: o mesmo evento tem resultado distinto conforme o timing.
- Repro: `node /private/tmp/timeline-final-review/probe-variants.mjs` (caso A):
  envia "rodada um" → espera slot `late-1` → Escape → espera `.work[data-live=false]`
  → envia "rodada dois" → `duringLate` mostra `texts:["Fala atrasada da rodada 1."]`
  no grupo da rodada 2 e `late-1.status="done"`; a janela do delta imprime a
  concatenação. Reload do mesmo histórico volta correto.
- Correção sugerida (não implementada): o host Pi precisa carimbar turno/run no
  evento (como o Claude via `runId`) ou o renderer deve invalidar a identidade de
  mensagem já recolhida; sem isso o item 6 do plano não fecha para Pi.

### N2 — P3 — Fallback sem `contentIndex`: texto→ferramenta→texto duplica fala

- Arquivo: `desk/src/chat.mjs` — chave vazia nos deltas (`:1040`), adoção da
  bolha corrente em `settleAssistantBlock` (`:729`) e chave `(id,index)` no
  `message_end` (`:1093-1103`).
- Efeito medido (host sem `contentIndex`; fora do contrato documentado do Pi):
  live `["Antes sem índice.","Antes sem índice.","Depois sem índice."]`, grupo
  `[user,assistant,work,activity-slot,assistant,assistant]`; reload projeta
  `["Antes sem índice.","Depois sem índice."]`, grupo
  `[user,assistant,work,activity-slot,assistant]`: a adoção do `message_end` toma
  a bolha do "Depois" para o "Antes" e cria outra para o "Depois".
- Repro: mesmo probe, caso B ("sem índice aqui"). `fake-pi.mjs`/hunt-chat não
  cobrem texto→ferramenta→texto sem `contentIndex` no mesmo `message_end`.

### N3 — P3 — Dois `message_end` sem `message_start`: a 1ª fala é sobrescrita

- Arquivo: `desk/src/chat.mjs:1093` — `id=e.message.id??assistantId??ensureAssistantId()`
  reusa o `assistantId` já encerrado (`messageEnded=true`, `:1113`) e
  `assistantBlocks` não é rotacionado: a chave `#0` da 2ª mensagem colide com a
  da 1ª.
- Efeito: live só `"Final isolado dois."` (grupo `[user,assistant]`); reload
  `["Final isolado um.","Final isolado dois."]` (grupo `[user,assistant,assistant]`).
  Extensão do caminho "`message_end` isolado" coberto só na 1ª mensagem.
- Repro: mesmo probe, caso C ("dois finais isolados"). Fora do contrato
  documentado (Pi sempre manda `message_start`), por isso P3.

## Pontos verificados sem achado

- **Ordem/declaração antes da próxima fala**: `toolcall_end`/`content_block_start`
  reservam o passo e o slot (`declareTool`); hunt `order` mostra
  `[user,work,assistant,work,activity-slot,assistant]`, slot é o mesmo nó e a
  fala final fica depois dele; Claude integrado idem.
- **Resultado tardio no slot original, sem mover o slot**: `segmentOfStep` por
  IDs + `renderSegment` repinta o segmento dono; hunt `mixed` (duas ferramentas,
  resultados fora de ordem, `duo-a` error/`duo-b` done) e `sameNode` do hunt
  `order`; o renderer de iframe não foi revisitado (fora do escopo).
- **Segmentos com limites explícitos**: `from`/`to`/`ids` em `timeline.mjs`,
  conteúdo por `segmentSteps` (IDs), nunca `steps.slice(from)` sem fim
  (`timeline.test.mjs` cobre segmento fechado + passo tardio).
- **Parar/troca/stale**: cobertos por `hunt-timeline` `mixed` (Parar sem turno
  novo e adoção de conversa) e pelo probe original — ressalva N1 quando um turno
  novo começa antes do atraso.
- **Quiz preservado**: fora do diário, cartão e veredito (hunt `mixed` 2c);
  `historyTurns` continua projetando o toolCall do quiz no histórico, como antes.
- **Claude, vários quadros `assistant` com o mesmo `message.id`**: índices
  globais do adapter (`_advanceBlockCursor`) confirmados por probe independente
  (`[[0,1],[2,3]]`) e pelo teste integrado; dedupe por `uuid`/impressão digital
  do conteúdo, nunca só pelo id.
- **Pi sem `message.id` (caminhos do contrato)**: deltas, `text_end`, final-only,
  `message_end` isolado e duas mensagens com `message_start` — `timeline-noid`
  PASS e vivo × reload iguais.
- **Código morto C**: removido (`grep` exit 1); `worklog-parity` e suíte cheio ok.

## Objeções e limitações reais

- O handoff do autor afirma que o item 6 do plano está coberto; N1 mostra que o
  booleano de parada não distingue atraso do turno anterior depois de começar
  outro (exatamente o que o plano previu). Sem `runId` no Pi, a correção precisa
  de carimbo no host ou de invalidação de identidade no renderer.
- B e C estão corrigidos para os caminhos documentados (Pi sempre manda
  `message_start` e `contentIndex`); as variantes N2/N3 são de host não conforme
  e ficam registradas como ressalva P3, não como regressão.
- Prova é Electron real com runtime/fixture sintéticos: não prova inferência de
  provedor real nem o app instalado. O caminho Claude ponta-a-ponta de reload
  não tem fixture própria (coberto em unidade/normalizeHistory).
- Rodar os testes criou diretórios ignorados `.test-runtime-*` e
  `desk/fora-da-area.png` (gitignored); nenhum arquivo versionado foi alterado.
- Não revisei: renderer de atividades, PDF, núcleo Bend, backup/exportação e
  agentes fora da timeline.

## Handoff

Revisão concluída. Nenhuma edição de produto/teste; nenhuma pendência minha de
edição. Ownership liberado: `chat.mjs`, `worklog.mjs`, `timeline.mjs`, os agentes
e os testes da timeline ficam livres para o root corrigir N1 (e, se quiser, N2/N3)
e rodar a validação final geral. Evidências dos probes ficam em
`/private/tmp/timeline-final-review/` (efêmeras).
