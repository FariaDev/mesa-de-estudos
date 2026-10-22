# Revisão de fechamento independente — timeline/rpc (R1/R3, contrato Pi) — 2026-10-08

READ ONLY no produto: nenhum arquivo/teste de produto foi editado; nenhum
commit/install/update, nenhum provedor real, nenhum dado pessoal, nenhum app
pessoal. Único artefato escrito: este relatório. Probes sintéticos em
`/private/tmp/timeline-residual-review/` (rerodados) e
`/private/tmp/timeline-closing-review/` (novo probe de queda/reuso). `git status`
estável antes/depois; nada versionado mudou por esta rodada.

## Escopo verificado

`desk/src/chat.mjs`, `desk/rpc.cjs`, `desk/src/turn-identity.cjs`, ligação
`connect()`→`showHistory` (`src/state.mjs`), `claude-adapter/service` (só o
`runId`), e testes `timeline*/rpc/turn-identity/worklog*/claude/agents/snapshot`.
PDF, atividades, núcleo Bend, `chat/` e `main.cjs` não foram revisados.

## Veredito

- **A (root, P1 `contentIndexes`): preservado.** `contentIndexes?.[i]??i` e a
  chave de delta por `ame.messageId` de pé; `timeline-adapter` + unit focada e
  `mesa-claude-activity-ui` PASS (partes `["Explorar…","Antes…","","activity",
  "Depois…"]`).
- **B (Pi sem `message.id`): preservado.** `host-msg-N`, `messageEnded`,
  `assistantLoose` FIFO e âncoras; `timeline-noid` PASS (deltas, só final, sem
  início, pensamento, duas mensagens; vivo × reload).
- **C (código morto): resolvido.** `grep "turnGen|assistantKeyFor|trackStep"`
  em `chat.mjs` → exit 1.
- **N2/N3: preservados.** `assistantLoose` reconcilia sem `contentIndex`;
  `messageEnded` rotaciona identidade sem `message_start`; bloco N2/N3 do
  `timeline-late` PASS (vivo × reload).
- **R1: FECHADO.** `clearLateEndText` não existe (grep exit 1) e nenhuma
  igualdade/sufixo decide posse: `staleEvent`/`retiredToolEvent` descartam só
  por identidade e `settleAssistantBlock` nunca limpa por texto. Probe original
  (7 variantes) rerodado: `sem-delta-igual/sufixo/igual-cont` →
  `liveAltered:false`, vivo = reload = fala; nenhum sample destrutivo (as
  entradas em `leakTexts` são prefixos legítimos do stream). Blocos R1
  {igual,sufixo,cont} do `timeline-late` PASS.
- **R3: FECHADO (host + renderer).** Host: `turn-identity.reset()` limpa
  run/open/tools/retired sem reiniciar `seq`; `rpc.start()` chama o reset só
  ao subir processo novo; teste `rpc.test` (queda real `exit 9` + `t1` reusado)
  e probe `identityAcrossCrash` → `run2Stale:false`, `run2HostRun:"host-run-2"`,
  ledger do processo morto limpo. Renderer: `retiredHostRuns`/`retiredTurnTools`
  zerados em troca real de conversa (`desk-conversation-changed`) e em recarga
  (`showHistory`); Parar na MESMA conversa mantém a proteção. Probe novo de
  fechamento (`probe-crash-reuse.mjs`, Electron real + fixture que morre com
  `exit 9`): reconexão na MESMA conversa reusa o id nativo e o slot/texto finais
  pintam (`status done`, versão 7) — `connect()` recarrega o histórico
  (`showHistory(result.messages)`), que é justamente o reset. Controle com id
  diferente idem. Bloco R3 `switch-reuse` PASS.
- **N1: aceito SOB O CONTRATO; regressões concretas fechadas.** `timeline-late`
  N1 ×3 PASS com o contrato parada→settle→envio (resposta do abort ainda
  pendente) e com as formas fora do contrato afirmando o limite. Barreira
  rerodada: `disabledAfterStop:true`, `settledBeforeSend:true`,
  `abortRepliedBeforeSend:false`, `promptWhileAbortPending:true` — não há
  serialização de abort no host; quem segura a corrida nova é o
  settle/`isStreaming` do Pi (fonte 1.1.0 conferida na rodada residual).
- **R2/R4: honestamente NÃO verdes (não-contratuais).** R2: delta anônimo
  atrasado aparece no stream da corrida nova (`controle/igual/sufixo/sem-end`
  com `liveAltered:true`; sem o end, persiste); o end autoritativo/reload
  vence. R4: `lateSettleClosesNewRun` fecha a corrida ativa no host — sem id de
  corrida no `agent_settled` não há o que atribuir; não alcançável no contrato.
  Nenhuma heurística nova mascara isso.

## Verificação executada nesta rodada

- Unit focada (timeline/worklog/view/claude/agents/turn-identity/rpc/rpc-settled)
  → **141 pass / 0 fail** (confere o handoff).
- Electron: `timeline-late` **8 blocos PASS** (N1×3, R1×3, N2/N3, R3);
  `timeline-noid` PASS; `hunt-timeline` `order`+`mixed` PASSED (ordem, slot
  mesmo nó, concorrência, retry, quiz, Parar, adoção).
- `mesa-claude-activity-ui` PASS; `worklog-parity` exit 0; `snapshot.test.mjs`
  0 fail (copia `src/turn-identity.cjs`).
- Probes rerodados: `probe-residual.mjs` (tabela R1/R2 + barreira, `errors:[]`)
  e `probe-identity.mjs` (R3/R4/retry/barreira). Suíte geral/full não foi
  duplicada (é do root); syntax-check/hunts amplos não rerodados de propósito.

## Inspeção dos pontos pedidos

- **Adoção da primeira sessão não mata o turno:** o handler de
  `desk-conversation-changed` retorna antes do `settleTurn` quando
  `!turnConversation` (só adota `turnConversation`). O `resetRetiredLedgers()`
  incondicional do topo é inócuo nesse caminho (conversa nova nasce com ledgers
  vazios); nenhum caso concreto encontrado.
- **Colisão de corrida em bridge novo:** `seq` reinicia por instância de
  `PiBridge`, mas todo bridge novo nasce de troca de sessão/matéria com
  `assertIdle` e dispara `desk-conversation-changed`/`showHistory`, que zeram
  `retiredHostRuns` antes de qualquer evento novo; reconexão na mesma conversa
  reusa o MESMO bridge (seq monotônico). Sem colisão observável.
- **Claude com `runId` explícito preservado:** `_emit`/`_emitTurn` carimbam
  `wireUuid` e o service mapeia para `agent_start`/`agent_settled`; a identidade
  do Pi (`turn-identity`) não toca o caminho Claude. `mesa-claude-activity-ui`
  PASS.
- **Ressalvas não-contratuais remanescentes:** R5 segue de pé (identidade em
  host puro, sem lei/prova Bend; `sidechat` ignora `stale`/`hostRun` — unit + ipc-smoke
  verificados na rodada anterior, não rerodados); queda antes de o
  histórico existir casaria ledger sem `showHistory`, mas exige id nativo
  reusado (premissa não garantida) — registrado, não bloqueia.

## Limites

Prova = Electron real + runtime/fixture sintéticos + fonte instalada do Pi 1.1.0;
nada aqui prova inferência de provedor real, app instalado, plataforma nativa
(macOS sim; Windows não), nem substitui a suíte geral congelada do root. Tempos
dos probes são do runtime sintético.

## Handoff

Domínio **fechado sob o contrato documentado do Pi 1.1** para R1/R3 e para
A/B/C/N2/N3; N1 aceito sob contrato; R2/R4/R5 permanecem ressalvas
não-contratuais/arquiteturais documentadas, sem portão verde artificial.
Ownership liberado: `chat.mjs`, `rpc.cjs`, `turn-identity.cjs`, testes
timeline/rpc e `snapshot.test.mjs`. Nenhuma edição de produto/teste feita.
